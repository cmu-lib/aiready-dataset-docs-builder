// Machine-readable assessment report — the JSON artifact in the release bundle.
// Pure function: wraps the record with the computed verdict and generation
// metadata. Kept separate from the datasheet (human-readable) generator.

import {
  pathwayVerdict,
  requiredCriteria,
  isCriterionSatisfied,
  isCriterionNotApplicable,
  dimensionProfile,
} from './pathway.js';
import { validationResults, AUTOMATED_WITH_VALIDATOR } from './validation.js';
import { isUpcoming } from './stages.js';
import { generateCroissant } from '../generators/croissant.js';
import { effectiveProvo } from '../generators/provo.js';
import { validateCroissant } from './croissantValidation.js';
import { validateProvo } from './provoValidation.js';
import { artifactDegrees, DEGREES, levelSupport } from './actionability.js';
import { citeThisWorkShort } from './thisWork.js';

// One-line citation of the framework this tool implements, embedded in every
// machine-readable report so downstream consumers can attribute it.
const FRAMEWORK = citeThisWorkShort();

export const REPORT_VERSION = 'assessment_report_v0';
// v1 added `ladder`: the degree of machine-actionability reached by each generated
// artifact. v2 replaces the automated-only `checks` array with `criteria`, covering
// every required criterion under a per-mode status vocabulary. Breaking, and gated
// by this field — nothing downstream consumed v1.
export const CONFORMANCE_VERSION = 'conformance_report_v2';

export function buildAssessmentReport(record, opts = {}) {
  const { pathway, sub_domain: subDomain, started_at, answers = {} } = record;
  const now = opts.now ?? new Date().toISOString();
  const results = opts.results ?? validationResults(record);
  const verdict = pathwayVerdict(pathway, answers, subDomain, results, record.stage);

  return {
    schema_version: REPORT_VERSION,
    generated_at: now,
    framework: FRAMEWORK,
    pathway,
    sub_domain: subDomain ?? null,
    started_at: started_at ?? null,
    verdict: {
      met: verdict.met,
      required_count: verdict.requiredCount,
      satisfied_count: verdict.satisfiedCount,
      bottlenecks: verdict.bottlenecks,
    },
    // Readiness is a per-dimension profile, not a single score: a deposit can be L3 on
    // four dimensions and L1 on two, and only this says so. `verdict` above answers the
    // narrower question of whether the whole target tier is met.
    profile: dimensionProfile(pathway, answers, subDomain, results, record.stage),
    answers,
  };
}

// The conformance report — the machine-readable record of how every criterion in
// the assessment is confirmed, not only the ones a validator can settle.
//
// v2 covers all required criteria rather than the automated subset, and gives each
// mode its own status vocabulary:
//
//   automated   pass | fail | pending      a check ran (or is not wired yet)
//   attested    declared | undeclared      the depositor stated it; evidence optional
//   manual      recorded | unrecorded      a human judgement was written down
//   any mode    upcoming                   not due at this lifecycle stage
//
// Reusing 'pass' for a declaration would assert that something was verified when
// nobody verified anything, which is the one thing the framework asks the tool not
// to do. Distinct words let a consumer separate a validated criterion from a
// claimed one without interpreting the mode field.
export function buildConformanceReport(record, opts = {}) {
  const { pathway, sub_domain: subDomain } = record;
  const now = opts.now ?? new Date().toISOString();
  const croissant = opts.croissant ?? generateCroissant(record);
  const croissantResult = validateCroissant(croissant);
  const provo = opts.provo ?? effectiveProvo(record);
  const provoResult = validateProvo(provo);
  const results = opts.results ?? validationResults(record, { croissant });

  // Degrees of machine-actionability per artifact. `opts.shacl` is threaded
  // through when the user has run Deep validate, so a report downloaded after
  // that pass records the SHACL verdict rather than "not run".
  const ladder = artifactDegrees({
    croissant,
    croissantResult,
    provo,
    provoResult,
    shacl: opts.shacl,
  });

  const answers = record.answers ?? {};

  const criteria = requiredCriteria(pathway, subDomain).map((c) => {
    const entry = {
      criterion: c.id,
      label: c.label,
      dimension: c.dimension,
      level: c.level,
      mode: c.verification,
      // The sentence saying what confirms this criterion travels with the report,
      // on the same principle as the ladder's rung descriptions: a consumer should
      // not need the paper open to read the verdict.
      confirms: c.verification_hint ?? '',
    };
    if (c.validators?.length) entry.validators = c.validators;

    // A declared non-applicability outranks every other status: there is nothing to
    // validate, declare, or judge, and reporting it as 'pass' or 'declared' would make a
    // dataset with no human subjects look like one that answered the question.
    if (isCriterionNotApplicable(c, answers[c.id])) {
      entry.status = 'not-applicable';
      entry.message = 'Declared not applicable to this dataset.';
      return entry;
    }

    if (isUpcoming(c, record.stage)) {
      entry.status = 'upcoming';
      entry.message = `Not due at this stage; belongs to ${c.lifecycle_stage}.`;
      return entry;
    }

    if (c.verification === 'automated') {
      const hasValidator = AUTOMATED_WITH_VALIDATOR.has(c.id);
      const res = results[c.id];
      entry.status = !hasValidator ? 'pending' : res?.ok ? 'pass' : 'fail';
      entry.message = hasValidator ? (res?.message ?? '') : 'No validator wired for this criterion.';
      return entry;
    }

    // Attested and manual: the record is the answer itself, and for attested the
    // note field is where the backing report is linked.
    const answered = isCriterionSatisfied(c, answers[c.id], results);
    const note = String(answers[c.id]?.notes ?? '').trim();
    if (c.verification === 'attested') {
      entry.status = answered ? 'declared' : 'undeclared';
      if (note) entry.evidence = note;
    } else {
      entry.status = answered ? 'recorded' : 'unrecorded';
      if (note) entry.note = note;
    }
    return entry;
  });

  const tallyFor = (mode, statuses) => {
    const of = criteria.filter((c) => c.mode === mode);
    const out = { total: of.length };
    for (const st of statuses) out[st] = of.filter((c) => c.status === st).length;
    if (mode === 'attested') out.with_evidence = of.filter((c) => c.evidence).length;
    return out;
  };

  return {
    schema_version: CONFORMANCE_VERSION,
    generated_at: now,
    framework: FRAMEWORK,
    pathway,
    sub_domain: subDomain ?? null,
    croissant: {
      valid: croissantResult.valid,
      loadable: croissantResult.loadable,
      errors: croissantResult.errors,
      warnings: croissantResult.warnings,
    },
    ladder: {
      // The rungs and their certifying checks travel with the report, so a
      // consumer reads the verdict without holding the paper.
      degrees: DEGREES,
      croissant: ladder.croissant,
      provo: ladder.provo,
      // Which L3 claims the artifacts currently support. The level axis and the
      // artifact axis measure the same property — unattended machine consumption —
      // so a descriptor short of `grounded` bounds what Computability can claim,
      // however the criteria are answered.
      supports: levelSupport(ladder, pathway),
    },
    criteria,
    summary: {
      total: criteria.length,
      upcoming: criteria.filter((c) => c.status === 'upcoming').length,
      not_applicable: criteria.filter((c) => c.status === 'not-applicable').length,
      automated: tallyFor('automated', ['pass', 'fail', 'pending', 'upcoming', 'not-applicable']),
      attested: tallyFor('attested', ['declared', 'undeclared', 'upcoming', 'not-applicable']),
      manual: tallyFor('manual', ['recorded', 'unrecorded', 'upcoming', 'not-applicable']),
    },
  };
}
