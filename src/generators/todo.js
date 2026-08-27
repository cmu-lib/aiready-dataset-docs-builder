// To-do generator — an ordered action plan, not a flat list of gaps.
//
// The previous version predated the verification and capture axes: it listed unmet
// criteria with their remediation text and grouped them into "do now", "coming up", and
// "document as-is". That collapsed distinctions the schema now carries, and a to-do list
// that puts a DOI (assigned at deposit, five minutes) beside consent wording
// (unrecoverable once collection ends) has failed at the one job a to-do list has.
//
// What ordering the schema now supports:
//
//   * `lifecycle_stage` separates work whose window is closing from work that will still
//     be there next month. Acquisition and curation items lead, flagged as closing.
//   * `verification_hint` says what would confirm the item; `remediation` says how to
//     close it. A plan wants both, in that order — the old output printed only the second.
//   * The stakeholder role named in a manual hint makes an item assignable, which is
//     §6.3's "every dimension needs a named owner" at the point someone picks up work.
//   * Four kinds of not-done, which the old version flattened into one: unmet, not yet
//     due, locked (a past decision — document it, do not attempt it), and bounded by an
//     artifact short of a ladder rung, where no amount of answering will help.
//   * A declared validator turns "report a bias audit" into "run Aequitas, attach it".
//
// No effort or time estimates: the tool has no basis for them.
//
// `buildTodo` is the model and `generateTodo` renders Markdown over it, the same split as
// the collection guide, so a printable or interactive view needs no second implementation.

import {
  getPathway,
  requiredCriteria,
  recommendedForPathway,
  isCriterionSatisfied,
  isCriterionNotApplicable,
} from '../lib/pathway.js';
import { isLocked, isUpcoming, getStage } from '../lib/stages.js';
import { validationResults } from '../lib/validation.js';
import { effectiveCroissant } from './croissant.js';
import { effectiveProvo } from './provo.js';
import { validateCroissant } from '../lib/croissantValidation.js';
import { validateProvo } from '../lib/provoValidation.js';
import { artifactDegrees, unsupportedLevels } from '../lib/actionability.js';
import { validatorsFor, executionNote } from '../lib/validators.js';
import { citeThisWorkShort } from '../lib/thisWork.js';
import vocabularies from '../schema/vocabularies.json';

// Stages in the order the work happens, with whether the window closes. Acquisition and
// curation are the two the collection guide calls unrecoverable: a variable that was
// never written down cannot be audited afterwards.
const STAGE_ORDER = ['acquisition', 'curation', 'documentation', 'governance', 'release'];
const CLOSING = new Set(['acquisition', 'curation']);
const STAGE_TITLE = {
  acquisition: 'While the work is happening',
  curation: 'While you clean and transform',
  documentation: 'When you write it up',
  governance: 'Before you fix the access arrangement',
  release: 'At deposit',
};
const STAGE_NOTE = {
  acquisition:
    'These close. Once the run is over, an instrument setting or a consent wording either was recorded or was not.',
  curation:
    'Each transformation is invisible in the released file unless it is recorded as it is applied.',
  documentation: 'Still actionable after publication, so these are the safest to defer.',
  governance: 'Revisitable in principle, and consent wording and repository choice constrain each other.',
  release: 'Assigned or fixed at deposit.',
};

// The role a manual criterion's hint names as its confirmer. Derived from the hint rather
// than duplicated in a field: every manual hint is written in the voice "<role> confirms
// this by …", and todo.test.js asserts that every one of them yields a role, so a
// reworded hint that drops its owner fails loudly instead of silently unassigning work.
const ROLES = (vocabularies.vocabularies.stakeholder_roles?.values ?? []).map((v) => ({
  id: v.id,
  // "Data steward — FAIRness, Computability" -> "Data steward"
  name: v.label.split('—')[0].trim(),
}));

export function ownerOf(criterion) {
  if (criterion.verification === 'automated') return { id: 'tool', name: 'The tool' };
  if (criterion.verification === 'attested') return { id: 'depositor', name: 'You' };
  const hint = criterion.verification_hint ?? '';
  const found = ROLES.filter((r) => new RegExp(`\\b${r.name}\\b`, 'i').test(hint));
  if (found.length === 0) return { id: 'unassigned', name: 'Unassigned' };
  // A criterion can name two roles ("the domain expert and the ML practitioner agree").
  return {
    id: found.map((r) => r.id).join('+'),
    name: found.map((r) => r.name).join(' and '),
  };
}

const itemFor = (criterion, extra = {}) => ({
  id: criterion.id,
  label: criterion.label,
  dimension: criterion.dimension,
  level: criterion.level,
  stage: criterion.lifecycle_stage,
  mode: criterion.verification,
  confirms: criterion.verification_hint ?? '',
  how: criterion.remediation ?? '',
  owner: ownerOf(criterion),
  validators: validatorsFor(criterion).map((v) => ({
    id: v.id,
    name: v.validator_name,
    url: v.validator_url,
    how: executionNote(v),
  })),
  ...extra,
});

export function buildTodo(record, opts = {}) {
  const { pathway, sub_domain: subDomain, stage, dataset = {}, answers = {} } = record;
  const results = opts.results ?? validationResults(record);

  const croissant = opts.croissant ?? effectiveCroissant(record);
  const provo = opts.provo ?? effectiveProvo(record);
  const ladder = artifactDegrees({
    croissant,
    croissantResult: validateCroissant(croissant),
    provo,
    provoResult: validateProvo(provo),
    shacl: opts.shacl,
  });
  // A cell whose artifact is short of its rung cannot be cleared by answering criteria,
  // so those items are separated out rather than listed as work.
  const bounded = new Map(
    unsupportedLevels(ladder, pathway).map((e) => [`${e.dimension}/${e.level}`, e]),
  );

  const required = requiredCriteria(pathway, subDomain);
  const open = required.filter(
    (c) =>
      !isCriterionSatisfied(c, answers[c.id], results) &&
      !isCriterionNotApplicable(c, answers[c.id]),
  );

  const limitations = [];
  const later = [];
  const blocked = [];
  const actionable = [];
  for (const c of open) {
    if (isLocked(c, stage)) {
      limitations.push(itemFor(c));
    } else if (isUpcoming(c, stage)) {
      later.push(itemFor(c));
    } else {
      const bound = bounded.get(`${c.dimension}/${c.level}`);
      if (bound) blocked.push(itemFor(c, { blockedBy: bound }));
      else actionable.push(itemFor(c));
    }
  }

  const groups = STAGE_ORDER.map((s) => ({
    stage: s,
    title: STAGE_TITLE[s],
    note: STAGE_NOTE[s],
    closing: CLOSING.has(s),
    items: actionable.filter((i) => i.stage === s),
  })).filter((g) => g.items.length > 0);

  // The same actionable items, gathered by who confirms them. In a one-person team every
  // group is the same person, and the list still says which hat they are wearing.
  const byOwner = [];
  for (const item of actionable) {
    let bucket = byOwner.find((b) => b.id === item.owner.id);
    if (!bucket) {
      bucket = { id: item.owner.id, name: item.owner.name, items: [] };
      byOwner.push(bucket);
    }
    bucket.items.push(item);
  }
  byOwner.sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name));

  const optional = recommendedForPathway(pathway).filter(
    (c) => !isCriterionSatisfied(c, answers[c.id], results),
  );

  return {
    meta: {
      datasetName: dataset.name ?? '',
      pathway,
      pathwayName: getPathway(pathway)?.name ?? '',
      level: getPathway(pathway)?.level ?? '',
      subDomain: subDomain ?? null,
      stage: getStage(stage)?.title ?? stage ?? null,
      generated: opts.now ?? new Date().toISOString(),
      total: required.length,
      open: open.length,
      closing: groups.filter((g) => g.closing).reduce((n, g) => n + g.items.length, 0),
    },
    groups,
    byOwner,
    blocked,
    later,
    limitations,
    optional: optional.map((c) => itemFor(c)),
  };
}

export function generateTodo(record, opts = {}) {
  const t = buildTodo(record, opts);
  const L = [];
  const p = (s = '') => L.push(s);

  p(`# AI-readiness to-do${t.meta.datasetName ? ` — ${t.meta.datasetName}` : ''}`);
  p();
  p(`- **Starting point:** ${t.meta.stage ?? '—'}`);
  p(`- **Target pathway:** ${t.meta.pathway} — ${t.meta.pathwayName} (${t.meta.level})`);
  if (t.meta.subDomain) p(`- **Discipline:** ${t.meta.subDomain}`);
  p(`- **Generated:** ${t.meta.generated}`);
  p(`- **Open:** ${t.meta.open} of ${t.meta.total} required criteria`);
  if (t.meta.closing > 0) {
    p(`- **Closing:** ${t.meta.closing} of those describe a moment that will not come back`);
  }
  p();
  p('> What remains to make this dataset machine-learning-ready, in the order the work happens.');
  p(`> Implements the framework of ${citeThisWorkShort()}`);
  p();

  const item = (i, indent = '') => {
    p(`${indent}- [ ] **${i.label}** _(${i.dimension} · ${i.level} · ${i.mode})_`);
    if (i.owner.id !== 'tool') p(`${indent}  - **Who.** ${i.owner.name}`);
    if (i.confirms) p(`${indent}  - **Done when.** ${i.confirms}`);
    if (i.how) p(`${indent}  - **How.** ${i.how}`);
    for (const v of i.validators) {
      p(`${indent}  - **Tool.** ${v.name} (${v.how}) — ${v.url}`);
    }
  };

  if (t.groups.length) {
    p('## The work, in order');
    p();
    for (const g of t.groups) {
      p(`### ${g.title}${g.closing ? ' — closing' : ''}`);
      p();
      p(`_${g.note}_`);
      p();
      for (const i of g.items) item(i);
      p();
    }
  }

  if (t.blocked.length) {
    p('## Blocked by a released artifact');
    p();
    p(
      '_Answering these will not clear them. The claim rests on an artifact that has not reached the rung it needs, so fix the artifact first._',
    );
    p();
    for (const i of t.blocked) {
      p(`- [ ] **${i.label}** _(${i.dimension} · ${i.level})_`);
      p(`  - **Blocked.** ${i.blockedBy.message}`);
      p(`  - **Why it matters.** ${i.blockedBy.why}`);
    }
    p();
  }

  if (t.byOwner.length) {
    p('## By owner');
    p();
    p(
      '_The same work, gathered by who confirms it. In a one-person team every group is the same person; the point is which hat they are wearing._',
    );
    p();
    for (const b of t.byOwner) {
      p(`- **${b.name}** — ${b.items.length} item${b.items.length === 1 ? '' : 's'}`);
      for (const i of b.items) p(`  - ${i.label}`);
    }
    p();
  }

  if (t.later.length) {
    p('## Not due yet');
    p();
    p('_Belongs to a later stage. Nothing to do now beyond knowing it is coming._');
    p();
    for (const i of t.later) p(`- [ ] **${i.label}** _(due at ${i.stage})_`);
    p();
  }

  if (t.limitations.length) {
    p('## Document as a limitation');
    p();
    p(
      '_A past decision at a stage that cannot be revisited. Record what was done and disclose the gap; attempting to fix it is not available._',
    );
    p();
    for (const i of t.limitations) {
      p(`- [ ] **${i.label}** _(${i.stage} — fixed)_`);
      if (i.confirms) p(`  - **Done when.** ${i.confirms}`);
    }
    p();
  }

  if (t.optional.length) {
    p('## Optional strengthening');
    p();
    p('_Not required for this pathway, and each one makes the next tier cheaper._');
    p();
    for (const i of t.optional) p(`- [ ] **${i.label}** _(${i.dimension})_`);
    p();
  }

  if (t.meta.open === 0) {
    p('Every required criterion for this pathway is satisfied or declared not applicable.');
    p();
  }

  return L.join('\n');
}
