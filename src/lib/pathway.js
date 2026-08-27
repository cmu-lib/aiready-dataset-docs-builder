// Pure pathway/verdict logic over the matrix schema. No React, no DOM — unit
// tested directly. Cumulative semantics are already encoded per-criterion in
// `required_in_pathways` (L1 -> A,B,C; L2 -> B,C; L3 -> C), so these helpers
// derive everything from that field and never re-implement the level ladder.
//
// NOTE: `isCriterionSatisfied` here is the *claimed* check — a criterion counts
// as satisfied when it has a meaningful answer. Phase 2 will tighten `automated`
// criteria so they count only when their validator passes; the signature stays
// the same so callers do not change.

import matrix from '../schema/matrix.json';
import pathwaysData from '../schema/pathways.json';
import vocabularies from '../schema/vocabularies.json';
import { isUpcoming } from './stages.js';
import { isNotApplicable } from './grounding.js';

export const ALL_CRITERIA = matrix.criteria;
export const LEVELS = matrix.levels;
export const PATHWAYS = pathwaysData.pathways;

// The 21 cell texts of the paper's assessment matrix, keyed dimension -> level.
// Rendered wherever the matrix itself is shown, so the wording and the criteria
// that operationalise it come from one file.
export const CELLS = matrix.cells;
export const cellText = (dimension, level) => CELLS?.[dimension]?.[level] ?? '';

// Criteria whose requirement the cell text does not name, with the attribution
// saying where in the paper they come from. This is the crosswalk a reader needs
// when the criterion count (larger) is compared with the cell count (21).
export const beyondCellCriteria = () => ALL_CRITERIA.filter((c) => c.beyond_cell);

export const getPathway = (id) => PATHWAYS.find((p) => p.id === id) ?? null;

// Sub-domains are independent of the pathway. A pathway is the target level, which
// measures machine-actionability; a sub-domain is the discipline and governance
// context, which the level does not determine — human or biological data demands the
// same oversight evidence whether it is aimed at L1 or L3. Until 0.6.0 these lived
// inside Pathway C and were unreachable elsewhere, which made governance a function
// of actionability.
export const SUB_DOMAINS = pathwaysData.sub_domains ?? [];
export const subDomains = () => SUB_DOMAINS;
export const getSubDomain = (subId) => SUB_DOMAINS.find((s) => s.id === subId) ?? null;

// Sub-domain overlays for a pathway. Each overlay declares its own `dimension` and
// `level`, so a sub-domain is not confined to Ethics: the biomedical sub-domains
// overlay Ethics only, `materials` also overlays FAIRness, Provenance, and
// Characterization. Which overlays apply at a given pathway is decided by each
// criterion's own `required_in_pathways`, the same cumulative rule the matrix uses —
// so a clinical dataset aimed at L2 picks up its L1 and L2 governance obligations and
// not the L3 ones. Empty only when no sub-domain is set.
export const overlaysFor = (pathway, subId) =>
  subId ? (getSubDomain(subId)?.overlay ?? []).filter((o) => isRequiredForPathway(o, pathway)) : [];

// Overlays that belong to one matrix cell (dimension × level).
const overlaysForCell = (pathway, subId, dimension, level) =>
  overlaysFor(pathway, subId).filter((o) => o.dimension === dimension && o.level === level);

// A sub-domain may reword a base criterion via `label_overrides` — a map of
// criterion id -> { label?, remediation? }. Rewording is not the same as adding:
// the criterion, its id, and its verdict semantics are untouched, only the words
// the researcher reads. Used where a general criterion is right in substance but
// wrong in vocabulary (compute cost is core-hours and a machine name in
// materials, not a cloud bill).
const labelOverridesFor = (pathway, subId) =>
  (subId ? getSubDomain(subId)?.label_overrides : null) ?? {};

export const applyLabelOverrides = (criterion, pathway, subId) => {
  const patch = labelOverridesFor(pathway, subId)[criterion?.id];
  return patch ? { ...criterion, ...patch } : criterion;
};

const withOverrides = (criteria, pathway, subId) => {
  const map = labelOverridesFor(pathway, subId);
  if (Object.keys(map).length === 0) return criteria;
  return criteria.map((c) => (map[c.id] ? { ...c, ...map[c.id] } : c));
};

// Documentation template for a record: 'healthsheet' for any sub-domain that declares
// it (clinical), else 'datasheet'. Driven by the sub-domain rather than the pathway,
// because a clinical dataset is health data at every level.
export const templateForRecord = (record) =>
  record?.sub_domain
    ? (getSubDomain(record.sub_domain)?.template ?? 'datasheet')
    : 'datasheet';

export const isRequiredForPathway = (criterion, pathway) =>
  Array.isArray(criterion.required_in_pathways) &&
  criterion.required_in_pathways.includes(pathway);

export const isRecommendedForPathway = (criterion, pathway) =>
  Array.isArray(criterion.recommended_in_pathways) &&
  criterion.recommended_in_pathways.includes(pathway);

export const criteriaForPathway = (pathway) =>
  ALL_CRITERIA.filter((c) => isRequiredForPathway(c, pathway));

// Which levels a pathway actually targets, derived from the criteria rather than
// restated as a table — the cumulative rule lives in `required_in_pathways` and
// this file does not re-implement it. A level counts as in scope when at least one
// criterion at that level is required for the pathway.
//
// Needed because a statement scoped to L3 (the ladder correspondences in
// guidance.json are all L3) must not be asserted against a Pathway-A record, which
// never claimed that level. Reporting it as unmet describes a target the depositor
// did not set.
export const levelsForPathway = (pathway) =>
  LEVELS.map((l) => l.id).filter((level) =>
    ALL_CRITERIA.some((c) => c.level === level && isRequiredForPathway(c, pathway)),
  );

export const isLevelInScope = (level, pathway) =>
  !pathway || levelsForPathway(pathway).includes(level);

export const recommendedForPathway = (pathway) =>
  ALL_CRITERIA.filter(
    (c) => isRecommendedForPathway(c, pathway) && !isRequiredForPathway(c, pathway),
  );

// A criterion is satisfied when its validator passes (automated criteria with a
// result in `results`) or, otherwise, when it carries a meaningful answer.
// answer shape: { value, notes }. `results` (optional) is the map from
// validationResults(); automated criteria without a result fall back to claimed.
export const isCriterionSatisfied = (criterion, answer, results) => {
  // A declared non-applicability satisfies the criterion whatever its mode: there is
  // nothing left to validate, declare, or judge. Checked before the validator so an
  // automated criterion marked N/A is not failed by a check on an empty field.
  if (answer?.not_applicable === true) return true;
  if (criterion.verification === 'automated' && results && results[criterion.id]) {
    return Boolean(results[criterion.id].ok);
  }
  if (!answer) return false;
  const v = answer.value;
  if (criterion.evidence_type === 'boolean') return v === true;
  if (v === null || v === undefined) return false;
  return String(v).trim() !== '';
};

// A criterion can be answered by declaring that it does not apply — non-human-subjects
// data has no consent basis to record, and no de-identification method to name. That is
// a documented attestation, not a gap, and the framework treats it as its own state:
// reporting it as "met" would make a materials deposit indistinguishable from one with
// real IRB oversight, and reporting it as "unmet" would penalise the honest answer.
//
// Two ways to declare it. A controlled-vocabulary criterion offers a value flagged
// `not_applicable` in vocabularies.json; a text or identifier criterion whose label
// permits it takes "N/A" as free text. A boolean criterion cannot express it — there is
// no third checkbox state — which is a known limit of the schema rather than a rule.
export const isCriterionNotApplicable = (criterion, answer) => {
  // An explicit declaration, set by the control on criteria that carry
  // `may_not_apply`. It comes first because it is the only route open to a boolean
  // criterion, which has no third checkbox state, and to an automated one, whose
  // validator has to be bypassed rather than failed.
  if (answer?.not_applicable === true) return true;
  const v = answer?.value;
  if (v === null || v === undefined || v === true || v === false) return false;
  if (criterion?.evidence_type === 'controlled_vocabulary') {
    const values = vocabularies.vocabularies[criterion.vocabulary_key]?.values ?? [];
    return Boolean(values.find((x) => x.id === v)?.not_applicable);
  }
  return isNotApplicable(v);
};

// Status of one matrix cell (dimension × level) for a pathway given answers.
// 'not-required'   — no criterion in the cell is required for this pathway.
// 'not-applicable' — every required criterion in the cell is a declared non-applicability.
// 'met'            — every required criterion in the cell is satisfied.
// 'unmet'          — at least one required criterion is not satisfied.
export const cellStatus = (dimension, level, pathway, answers = {}, subDomain, results, stage) => {
  let required = ALL_CRITERIA.filter(
    (c) => c.dimension === dimension && c.level === level && isRequiredForPathway(c, pathway),
  );
  required = [...required, ...overlaysForCell(pathway, subDomain, dimension, level)];
  if (required.length === 0) return 'not-required';
  const active = required.filter((c) => !isUpcoming(c, stage));
  if (active.length === 0) return 'upcoming'; // entire cell deferred to a later stage
  if (!active.every((c) => isCriterionSatisfied(c, answers[c.id], results))) return 'unmet';
  // A declared non-applicability satisfies the criterion, so this is a refinement of
  // 'met' and never changes a verdict — it only stops the heatmap from showing a
  // documented "does not apply" as the same green tick as evidence.
  return active.every((c) => isCriterionNotApplicable(c, answers[c.id]))
    ? 'not-applicable'
    : 'met';
};

// All required criteria for a pathway, including Pathway-C sub-domain overlays.
// This is what the verdict and the datasheet iterate.
export const requiredCriteria = (pathway, subDomain) =>
  withOverrides([...criteriaForPathway(pathway), ...overlaysFor(pathway, subDomain)], pathway, subDomain);

// Overall verdict for a pathway. Bottlenecks are the dimensions with any unmet
// required criterion (the paper's min-across-dimensions view).
export const pathwayVerdict = (pathway, answers = {}, subDomain, results, stage) => {
  const required = requiredCriteria(pathway, subDomain).filter((c) => !isUpcoming(c, stage));
  const unmetByDimension = {};
  let satisfiedCount = 0;
  for (const c of required) {
    if (isCriterionSatisfied(c, answers[c.id], results)) {
      satisfiedCount += 1;
    } else {
      (unmetByDimension[c.dimension] ??= []).push(c.id);
    }
  }
  return {
    met: satisfiedCount === required.length,
    requiredCount: required.length,
    satisfiedCount,
    bottlenecks: Object.keys(unmetByDimension),
    unmetByDimension,
  };
};

// Required criteria for one dimension under a pathway, in level order, including
// any Pathway C sub-domain overlays scoped to that dimension (appended after the
// base criteria).
export const criteriaForDimension = (dimension, pathway, subDomain) => {
  const base = ALL_CRITERIA.filter(
    (c) => c.dimension === dimension && isRequiredForPathway(c, pathway),
  );
  const overlays = overlaysFor(pathway, subDomain).filter((o) => o.dimension === dimension);
  return withOverrides([...base, ...overlays], pathway, subDomain);
};

// Recommended-but-not-required criteria for one dimension (e.g. Croissant at L1).
export const recommendedForDimension = (dimension, pathway) =>
  ALL_CRITERIA.filter(
    (c) =>
      c.dimension === dimension &&
      isRecommendedForPathway(c, pathway) &&
      !isRequiredForPathway(c, pathway),
  );

// The readiness profile: for each dimension, the highest level whose criteria are all
// accounted for, walking up from L1 and stopping at the first level that is not.
//
// This is what the framework actually claims — readiness is a per-dimension profile,
// not a single score — and it is the shape the paper's case studies report ("FAIRness,
// Provenance, Pre-model Explainability, and Computability reach L3; Ethics stays low").
// The overall verdict answers a different question: whether the whole target tier is
// met. A dataset can be L3 on four dimensions and L1 on two, and only the profile says so.
//
// Levels above the target are 'not-required' and stop the walk, because the tool never
// asked about them — attained is capped by what was assessed, not by what might be true.
export const dimensionProfile = (pathway, answers = {}, subDomain, results, stage) =>
  matrix.dimensions.map((dimension) => {
    const levels = {};
    let attained = null;
    let stopped = false;
    for (const { id: level } of LEVELS) {
      const status = cellStatus(dimension, level, pathway, answers, subDomain, results, stage);
      levels[level] = status;
      if (stopped) continue;
      if (status === 'met' || status === 'not-applicable') attained = level;
      else stopped = true;
    }
    const required = [
      ...ALL_CRITERIA.filter((c) => c.dimension === dimension && isRequiredForPathway(c, pathway)),
      ...overlaysFor(pathway, subDomain).filter((o) => o.dimension === dimension),
    ].filter((c) => !isUpcoming(c, stage));
    const notApplicable = required.filter((c) => isCriterionNotApplicable(c, answers[c.id]));
    return {
      dimension,
      attained,
      levels,
      criteriaCount: required.length,
      notApplicableCount: notApplicable.length,
      // True only when every criterion assessed on this dimension is a declared
      // non-applicability — the case the paper describes for a materials deposit's
      // human-subjects rows, which is narrower than the dimension as a whole.
      notApplicable: required.length > 0 && notApplicable.length === required.length,
    };
  });
