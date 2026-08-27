// Collection guide — what to write down, and when, so the assessment and its
// artifacts are fillable later. The complement of todo.js: that one lists what is
// still *unmet*, this one lists what has to be *observed*, including for criteria
// already answered.
//
// Two design choices worth stating:
//
//   * Schema-driven. The worksheet walks requiredCriteria(pathway, subDomain), so
//     adding a criterion or a sub-domain overlay extends the guide with no edit
//     here. A hand-written guide would drift within one release.
//
//   * Grouped by lifecycle_stage, not by dimension. A collection guide is read in
//     the order the work happens — what to capture while acquiring, while curating,
//     at deposit — and a dimension is a property of the criterion, not of the
//     moment you can still act on it. The dimension travels along as a tag.
//
// `collection_hint` is the observation to record; `remediation` is how to close a
// gap. Criteria without a hint (L1/L2 at present) fall back to remediation, so the
// guide is complete from day one and improves as hints are written.

import { getPathway, requiredCriteria, isCriterionSatisfied, LEVELS, PATHWAYS } from '../lib/pathway.js';
import { getStage } from '../lib/stages.js';
import { validationResults } from '../lib/validation.js';
import { citeThisWorkShort } from '../lib/thisWork.js';
import guidance from '../schema/guidance.json';
import references from '../schema/references.json';

// Which pathways require a given level. A pathway requires every level up to and
// including its own, so this is derived from the ladder rather than restated:
// L1 -> A,B,C; L2 -> B,C; L3 -> C. Same cumulative rule matrix.test.js enforces.
const LEVEL_ORDER = ['L1', 'L2', 'L3'];
const pathwaysRequiring = (levelId) =>
  PATHWAYS.filter((p) => LEVEL_ORDER.indexOf(p.level) >= LEVEL_ORDER.indexOf(levelId)).map((p) => p.id);

// The legend for the level tags on worksheet rows. Structure (id, name, DRL band)
// comes from the matrix; the sentence explaining each comes from guidance.json.
const levelLegend = () =>
  LEVELS.map((l) => ({
    ...l,
    meaning: guidance.levels.meaning[l.id],
    requiredIn: pathwaysRequiring(l.id),
  }));

// Citation keys resolve in references.json, the registry the matrix already uses,
// so the guide cites the same works the assessment does and a key cannot go stale
// in one place while surviving in the other.
const resolve = (keys = []) =>
  keys.map((key) => ({ key, ...references.citations[key] })).filter((c) => c.title);

export const citationHref = (c) => (c.doi ? `https://doi.org/${c.doi}` : (c.url ?? null));

export const citationText = (c) =>
  `${c.authors} (${c.year ?? 'n.d.'}). ${c.title}. ${c.venue}.`;

// Order the work actually happens in.
const STAGE_ORDER = ['acquisition', 'curation', 'documentation', 'governance', 'release'];

const STAGE_TITLES = {
  acquisition: 'While collecting or running',
  curation: 'While cleaning, transforming, or de-identifying',
  documentation: 'While writing it up',
  governance: 'Before you commit to an access arrangement',
  release: 'At deposit',
};

const STAGE_NOTES = {
  acquisition:
    'The only rows that become unrecoverable. Everything here describes a moment that will not come back — once the run is over, the instrument settings, the operator, and the consent wording either were written down or were not.',
  curation:
    'Each transformation is invisible in the released file unless recorded as it is applied.',
  documentation: 'Always actionable, including long after publication.',
  governance:
    'Decide these early even though you can revisit them: consent wording and repository choice constrain each other.',
  release: 'Assigned or fixed at deposit; nothing to capture beforehand beyond the intent.',
};

// What to write down for a criterion — and, where there is nothing to write down in
// advance, why not.
//
// This used to fall back to `remediation` when no hint existed, which covered 32 of
// 72 rows with text written for a reviewer closing a gap after the fact: past tense,
// addressed to someone fixing a release, printed inside a worksheet about what to
// capture beforehand. A third of the guide spoke in the wrong voice. Every criterion
// now declares either a capture moment or its absence, and matrix.test.js keeps it
// that way; the remediation fallback remains only so a hand-added criterion renders
// something rather than a blank.
export const whatToRecord = (criterion) =>
  criterion?.collection_hint ?? criterion?.no_capture ?? criterion?.remediation ?? '';

// Which of the two a row is showing, so the renderers can label it honestly instead
// of presenting "nothing to record" under a heading that says Record.
//   'record'   — there is something to capture, and whatToRecord says what
//   'none'     — nothing to capture in advance, and whatToRecord says why
//   'fallback' — neither declared; the criterion is incomplete
export const captureKind = (criterion) => {
  if (criterion?.collection_hint) return 'record';
  if (criterion?.no_capture) return 'none';
  return 'fallback';
};

export const hasCollectionHint = (criterion) => Boolean(criterion?.collection_hint);

// The vocabulary or format constraint on an answer, where the schema declares one.
const constraintFor = (criterion) => {
  if (criterion.evidence_type === 'controlled_vocabulary') {
    return `choose from a controlled list (${criterion.vocabulary_key ?? 'scoped to your pathway'})`;
  }
  if (criterion.evidence_type === 'identifier') return 'an identifier (DOI, ORCID, accession)';
  if (criterion.evidence_type === 'uri') return 'a resolvable URL';
  if (criterion.evidence_type === 'file') return 'a file or a link to one';
  if (criterion.evidence_type === 'boolean') return 'yes or no';
  return 'free text';
};

// The structured guide model. Rendering (Markdown here, print later) reads this.
export function buildCollectionGuide(record, opts = {}) {
  const { pathway, sub_domain: subDomain, stage, dataset = {}, answers = {} } = record;
  const results = opts.results ?? validationResults(record);
  const meta = getPathway(pathway);
  const stageObj = getStage(stage);

  const criteria = requiredCriteria(pathway, subDomain);
  const groups = STAGE_ORDER.map((s) => ({
    stage: s,
    title: STAGE_TITLES[s],
    note: STAGE_NOTES[s],
    rows: criteria
      .filter((c) => c.lifecycle_stage === s)
      .map((c) => ({
        id: c.id,
        label: c.label,
        dimension: c.dimension,
        level: c.level,
        record: whatToRecord(c),
        recordKind: captureKind(c),
        // The other axis of the row: what to write down, and what will confirm it.
        // A row nobody can settle mechanically is worth knowing about while you are
        // still deciding how much effort to spend capturing it.
        mode: c.verification,
        confirms: c.verification_hint ?? '',
        constraint: constraintFor(c),
        satisfied: isCriterionSatisfied(c, answers[c.id], results),
      })),
  })).filter((g) => g.rows.length > 0);

  const total = groups.reduce((n, g) => n + g.rows.length, 0);
  const recorded = groups.reduce((n, g) => n + g.rows.filter((r) => r.satisfied).length, 0);

  return {
    meta: {
      datasetName: dataset.name ?? '',
      pathway,
      pathwayName: meta?.name ?? '',
      level: meta?.level ?? '',
      subDomain: subDomain ?? null,
      stage: stageObj?.title ?? stage ?? null,
      generated: opts.now ?? new Date().toISOString(),
      total,
      recorded,
    },
    workflow: guidance.workflow,
    ladder: guidance.ladder,
    ladderRefs: resolve(guidance.ladder_references),
    automation: { ...guidance.automation, refs: resolve(guidance.automation.references) },
    // The degrees pick up where the four forms end; the modes explain the tags on
    // every worksheet row. Both are prose from the schema, so the printed guide,
    // the web guide, and the Export ladder read from one source.
    degrees: { ...guidance.degrees, refs: resolve(guidance.degrees.references) },
    verificationModes: {
      ...guidance.verification_modes,
      refs: resolve(guidance.verification_modes.references),
    },
    validation: { ...guidance.validation, refs: resolve(guidance.validation.references) },
    stewardship: { ...guidance.stewardship, refs: resolve(guidance.stewardship.references) },
    whQuestions: guidance.wh_questions,
    whQuestionsRefs: resolve(guidance.wh_questions_references),
    documentationInputs: {
      ...guidance.documentation_inputs,
      refs: resolve(guidance.documentation_inputs.references),
    },
    levels: { lead: guidance.levels.lead, rows: levelLegend() },
    runLogFields: guidance.run_log_fields,
    // The ontology section is L3 material: below Pathway C nothing requires a
    // bound vocabulary, so it is offered as background rather than instruction.
    ontology: {
      applies: pathway === 'C',
      examples: guidance.ontology_examples,
      refs: resolve(guidance.ontology_examples_references),
    },
    burden: guidance.burden_reduction.map((b) => ({ ...b, refs: resolve(b.references) })),
    groups,
    // Every work cited anywhere above, once, in registry order so the numbered
    // framework sources keep their numbering and the guidance additions follow.
    sources: (() => {
      const used = new Set([
        ...guidance.ladder_references,
        ...guidance.automation.references,
        ...guidance.degrees.references,
        ...guidance.verification_modes.references,
        ...guidance.validation.references,
        ...guidance.stewardship.references,
        ...guidance.wh_questions_references,
        ...guidance.documentation_inputs.references,
        ...guidance.ontology_examples_references,
        ...guidance.burden_reduction.flatMap((b) => b.references ?? []),
      ]);
      return Object.keys(references.citations)
        .filter((k) => used.has(k))
        .map((key) => ({ key, ...references.citations[key] }));
    })(),
  };
}

export function generateCollectionGuide(record, opts = {}) {
  const g = buildCollectionGuide(record, opts);
  const L = [];
  const p = (s = '') => L.push(s);

  p(`# What to collect${g.meta.datasetName ? ` — ${g.meta.datasetName}` : ''}`);
  p();
  p(`- **Target pathway:** ${g.meta.pathway} — ${g.meta.pathwayName} (${g.meta.level})`);
  if (g.meta.subDomain) p(`- **Sub-domain:** ${g.meta.subDomain}`);
  if (g.meta.stage) p(`- **Starting point:** ${g.meta.stage}`);
  p(`- **Generated:** ${g.meta.generated}`);
  p(`- **Recorded so far:** ${g.meta.recorded} of ${g.meta.total}`);
  p();
  p('> A worksheet for the observations behind the assessment: what to write down, and when.');
  p(`> Implements the framework of ${citeThisWorkShort()}`);
  p();

  p('## The shape of the work');
  p();
  p(g.workflow.lead);
  p();
  for (const [i, ph] of g.workflow.phases.entries()) {
    p(`${i + 1}. **${ph.name}.** ${ph.what}`);
  }
  p();

  p('## From notes to machine-actionable');
  p();
  for (const r of g.ladder) {
    p(`### ${r.icon} ${r.rung} (${r.obligation})`);
    p();
    if (r.via) p(`_Reached by: ${r.via}._`);
    if (r.via) p();
    p('```');
    p(r.sample);
    p('```');
    p();
    p(`**Gains.** ${r.gains}`);
    p();
    p(`**Still out of reach.** ${r.out_of_reach}`);
    p();
    p(`**Standards.** ${r.standards}`);
    p();
  }
  p(`### ${g.automation.icon} ${g.automation.title}`);
  p();
  p(g.automation.text);
  p();
  p(`_${g.automation.examples}_`);
  p();
  p('Each form is cheap to produce while standing on the one before it. Retrofitting the one above, after the run is over, is where the cost lands.');
  p();
  if (g.ladderRefs.length) p(`_Sources: ${g.ladderRefs.map((c) => `${c.authors} (${c.year})`).join('; ')}._`);
  if (g.ladderRefs.length) p();

  p('## Degrees of machine-actionability');
  p();
  p(g.degrees.lead);
  p();
  for (const r of g.degrees.rungs) {
    p(`- **${r.label}** — _${r.check}._ ${r.means}`);
  }
  p();
  p(g.degrees.scope_note);
  p();
  if (g.degrees.refs.length) {
    p(`_Sources: ${g.degrees.refs.map((c) => `${c.authors} (${c.year})`).join('; ')}._`);
    p();
  }

  p('## How each row is confirmed');
  p();
  p(g.verificationModes.lead);
  p();
  for (const m of g.verificationModes.modes) p(`- **${m.label}** — ${m.definition}`);
  p();
  p(`_${g.verificationModes.note}_`);
  p();
  if (g.verificationModes.refs.length) {
    p(`_Sources: ${g.verificationModes.refs.map((c) => `${c.authors} (${c.year})`).join('; ')}._`);
    p();
  }

  p('## Validating before release');
  p();
  p(g.validation.lead);
  p();
  for (const c of g.validation.categories) {
    p(`### ${c.name}`);
    p();
    p(c.check);
    p();
    p(`_${c.tools}_`);
    p();
  }
  p(g.validation.report_note);
  p();
  p(g.validation.pipeline_note);
  p();
  p(g.validation.lookup_note);
  p();
  if (g.validation.refs.length) {
    p(`_Sources: ${g.validation.refs.map((c) => `${c.authors} (${c.year})`).join('; ')}._`);
    p();
  }

  p('## After release');
  p();
  p(g.stewardship.lead);
  p();
  for (const x of g.stewardship.practices) p(`- **${x.name}.** ${x.what}`);
  p();
  if (g.stewardship.refs.length) {
    p(`_Sources: ${g.stewardship.refs.map((c) => `${c.authors} (${c.year})`).join('; ')}._`);
    p();
  }

  p('## The six questions');
  p();
  p('| | Record | Lands in |');
  p('|---|---|---|');
  for (const w of g.whQuestions) p(`| **${w.q}** | ${w.record} | ${w.lands} |`);
  p();
  if (g.whQuestionsRefs.length) {
    p(`_Sources: ${g.whQuestionsRefs.map((c) => `${c.authors} (${c.year})`).join('; ')}._`);
    p();
  }

  p('## What builds each layer');
  p();
  p('The records below are the raw material for the three released artifacts. Most of them already exist somewhere in a project; the work is routing them.');
  p();
  for (const l of g.documentationInputs.layers) {
    p(`**${l.layer}** is built from:`);
    p();
    for (const src of l.sources) p(`- ${src}`);
    p();
    if (l.checked_by) {
      p(`_Checked by: ${l.checked_by}_`);
      p();
    }
  }
  if (g.documentationInputs.verification_note) {
    p(g.documentationInputs.verification_note);
    p();
  }
  p(
    `**${g.documentationInputs.grounding.label}:** ${g.documentationInputs.grounding.schemes.join(' · ')}. ` +
      g.documentationInputs.grounding.note,
  );
  p();

  p('## Per-run log');
  p();
  p('Repeat once per run, sample, or job. Fill it as the work happens.');
  p();
  for (const f of g.runLogFields) p(`- [ ] ${f}: ______________________`);
  p();

  p('## Worksheet');
  p();
  p('Everything this pathway will ask for, in the order the work happens. Ticked rows are already recorded in the tool.');
  p();
  p(g.levels.lead);
  p();
  p('| Level | Name | DRL band | Required in | What it is for |');
  p('|---|---|---|---|---|');
  for (const l of g.levels.rows) {
    p(`| **${l.id}** | ${l.name} | ${l.drl_band} | ${l.requiredIn.join(', ')} | ${l.meaning} |`);
  }
  p();
  for (const grp of g.groups) {
    p(`### ${grp.title}`);
    p();
    p(`_${grp.note}_`);
    p();
    for (const r of grp.rows) {
      p(`- [${r.satisfied ? 'x' : ' '}] **${r.label}** _(${r.dimension} · ${r.level})_`);
      if (r.record) {
        p(`  - **${r.recordKind === 'none' ? 'Nothing to record in advance' : 'Record'}.** ${r.record}`);
      }
      if (r.confirms) p(`  - **Confirmed by (${r.mode}).** ${r.confirms}`);
      p(`  - _Answer format: ${r.constraint}._`);
    }
    p();
  }

  if (g.ontology.applies) {
    p('## Binding terms to shared vocabularies');
    p();
    p('At L3 the consumer needs the meaning of your column, which a field name alone cannot carry. Three worked examples.');
    p();
    for (const ex of g.ontology.examples) {
      p(`### ${ex.title}`);
      p();
      p(`**As collected.** \`${ex.as_collected}\``);
      p();
      p(`**The problem.** ${ex.problem}`);
      p();
      p(`**Machine-actionable.** ${ex.actionable}`);
      p();
      p(`**Why it matters.** ${ex.why}`);
      p();
    }
  }

  p('## Making this less burdensome');
  p();
  p('The first three remove the work. The rest reduce it. None of them decide what matters — that stays yours.');
  p();
  for (const b of g.burden) {
    p(`- **${b.title}** _(${b.effect} the work)_ — ${b.what}`);
    p(`  - ${b.examples}`);
    if (b.refs.length) p(`  - _${b.refs.map((c) => `${c.authors} (${c.year})`).join('; ')}_`);
  }
  p();

  p('## Sources');
  p();
  p('Works cited above, with resolvable identifiers.');
  p();
  for (const c of g.sources) {
    const href = citationHref(c);
    p(`- ${citationText(c)}${href ? ` <${href}>` : ''}`);
  }
  p();

  return L.join('\n');
}
