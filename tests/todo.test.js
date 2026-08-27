// Unit tests for the to-do (action plan) generator. Run with:  npm test
//
// The generator was rewritten once the schema gained the verification and capture axes.
// The old version listed unmet criteria with their remediation text under "Do now" /
// "Coming up" / "Document as-is"; these tests cover what replaced it, and specifically the
// four distinctions it used to flatten: work whose window is closing, work that is not due,
// work fixed by a past decision, and work blocked by an artifact where answering the
// criterion cannot help.

import { test } from 'vitest';
import assert from 'node:assert/strict';

import { generateTodo, buildTodo, ownerOf } from '../src/generators/todo.js';
import { ALL_CRITERIA, subDomains } from '../src/lib/pathway.js';
import { loadableCroissant, provModel } from '../src/examples/build.js';

const FIXED = '2026-07-16T00:00:00.000Z';
const rec = (over = {}) => ({
  pathway: 'A',
  sub_domain: null,
  stage: 'plan',
  answers: {},
  dataset: {},
  ...over,
});

// --- ordering by when the window closes -------------------------------------

test('the plan leads with the work that cannot be done later', () => {
  // The whole point of the rewrite: a DOI is five minutes at deposit, a consent wording is
  // gone once collection ends, and the old flat list gave them equal billing.
  const t = buildTodo(rec(), { now: FIXED });
  const stages = t.groups.map((g) => g.stage);
  assert.deepEqual(stages, stages.slice().sort((a, b) => {
    const order = ['acquisition', 'curation', 'documentation', 'governance', 'release'];
    return order.indexOf(a) - order.indexOf(b);
  }));
  assert.equal(t.groups[0].stage, 'acquisition');
  assert.equal(t.groups[0].closing, true);
  assert.ok(t.meta.closing > 0, 'nothing flagged as closing at the planning stage');

  const md = generateTodo(rec(), { now: FIXED });
  assert.match(md, /### While the work is happening — closing/);
  assert.match(md, /Closing:\*\* \d+ of those describe a moment that will not come back/);
  // At the planning stage everything past acquisition is not yet due, so only the
  // acquisition group exists — which is the ordering doing its job.
  assert.deepEqual(t.groups.map((g) => g.stage), ['acquisition']);

  // At Upgrade, documentation work is actionable and is marked as the safest to defer.
  const upgrade = generateTodo(rec({ stage: 'upgrade' }), { now: FIXED });
  assert.match(upgrade, /### When you write it up/);
  assert.match(upgrade, /Still actionable after publication/);
  assert.ok(!/— closing/.test(upgrade.split('### When you write it up')[1].split('###')[0]));
});

test('each item says what would confirm it before how to close it', () => {
  // `verification_hint` and `remediation` answer different questions; the old generator
  // printed only the second, which told a user how to fix a gap without saying what done
  // looks like.
  const md = generateTodo(rec(), { now: FIXED });
  assert.match(md, /\*\*Done when\.\*\*/);
  assert.match(md, /\*\*How\.\*\*/);
  assert.ok(md.indexOf('**Done when.**') < md.indexOf('**How.**'));
});

// --- who does it ------------------------------------------------------------

test('every manual criterion names an owner, so no work is silently unassigned', () => {
  // The owner is derived from the hint's own voice rather than duplicated in a field. This
  // test is the contract: reword a manual hint so it no longer names a role and the build
  // fails here instead of quietly dropping the item into Unassigned.
  const overlays = subDomains().flatMap((s) => s.overlay ?? []);
  for (const c of [...ALL_CRITERIA, ...overlays]) {
    if (c.verification !== 'manual') continue;
    const owner = ownerOf(c);
    assert.notEqual(owner.id, 'unassigned', `${c.id} names no stakeholder role in its hint`);
  }

  // The other two modes have fixed owners: a validator, or the depositor.
  const automated = ALL_CRITERIA.find((c) => c.verification === 'automated');
  const attested = ALL_CRITERIA.find((c) => c.verification === 'attested');
  assert.equal(ownerOf(automated).id, 'tool');
  assert.equal(ownerOf(attested).id, 'depositor');
});

test('a criterion naming two roles keeps both', () => {
  const scope = ALL_CRITERIA.find((c) => c.id === 'characterization.l3.scope_declared');
  const owner = ownerOf(scope);
  assert.match(owner.name, /and/, `expected two roles, got ${owner.name}`);
});

test('the plan groups the same work by owner', () => {
  const t = buildTodo(rec({ pathway: 'C', sub_domain: 'clinical', stage: 'prepare' }), { now: FIXED });
  assert.ok(t.byOwner.length > 1, 'expected several owners at Pathway C');
  // Largest bucket first, so the person with the most to do is not buried.
  for (let i = 1; i < t.byOwner.length; i += 1) {
    assert.ok(t.byOwner[i - 1].items.length >= t.byOwner[i].items.length);
  }
  // Every actionable item appears exactly once across the owner buckets.
  const actionable = t.groups.flatMap((g) => g.items.map((i) => i.id)).sort();
  const owned = t.byOwner.flatMap((b) => b.items.map((i) => i.id)).sort();
  assert.deepEqual(owned, actionable);
  assert.match(generateTodo(rec({ pathway: 'C', sub_domain: 'clinical' }), { now: FIXED }), /## By owner/);
});

// --- the four kinds of not-done --------------------------------------------

test('locked work is a limitation to document, not a task', () => {
  // At the Upgrade stage acquisition is fixed. Listing "record the consent basis" as a
  // task tells a user to do something impossible.
  const t = buildTodo(rec({ stage: 'upgrade' }), { now: FIXED });
  const ids = t.limitations.map((i) => i.id);
  assert.ok(ids.includes('ethics.l1.consent_basis_recorded'), ids);
  assert.ok(!t.groups.flatMap((g) => g.items.map((i) => i.id)).includes('ethics.l1.consent_basis_recorded'));

  const md = generateTodo(rec({ stage: 'upgrade' }), { now: FIXED });
  assert.match(md, /## Document as a limitation/);
  assert.match(md, /attempting to fix it is not available/);
});

test('work that is not due yet is separated from work that is', () => {
  const t = buildTodo(rec({ stage: 'plan' }), { now: FIXED });
  assert.ok(t.later.some((i) => i.id === 'fairness.l1.persistent_id'), 'a DOI is not due while planning');
  assert.match(generateTodo(rec(), { now: FIXED }), /## Not due yet/);
});

test('an item bounded by an artifact is separated from work that answering can clear', () => {
  // The distinction the correspondence exists to draw: Computability L3 rests on the
  // descriptor reaching `grounded`, so no answer to the criterion clears it while the
  // descriptor's checksum is the template's row of zeros.
  const weak = loadableCroissant({ name: 'ds', url: 'https://example.org/ds' });
  weak.distribution[0].sha256 = '0'.repeat(64);
  const t = buildTodo(
    rec({ pathway: 'C', sub_domain: 'general', stage: 'upgrade', provenance: provModel() }),
    { now: FIXED, croissant: weak },
  );

  const blockedIds = t.blocked.map((i) => i.id);
  assert.ok(blockedIds.length > 0, 'nothing reported as artifact-bounded');
  assert.ok(
    blockedIds.some((id) => id.startsWith('computability.l3') || id.startsWith('fairness.l3')),
    blockedIds,
  );
  // And they are not also listed as ordinary work.
  const actionable = t.groups.flatMap((g) => g.items.map((i) => i.id));
  assert.equal(blockedIds.filter((id) => actionable.includes(id)).length, 0);

  const md = generateTodo(
    rec({ pathway: 'C', sub_domain: 'general', stage: 'upgrade' }),
    { now: FIXED, croissant: weak },
  );
  assert.match(md, /## Blocked by a released artifact/);
  assert.match(md, /Answering these will not clear them/);
});

// --- validators and non-applicability --------------------------------------

test('an item whose evidence is a tool names the tool', () => {
  const md = generateTodo(rec({ pathway: 'C', sub_domain: 'general', stage: 'upgrade' }), { now: FIXED });
  assert.match(md, /\*\*Tool\.\*\* Aequitas \(run locally\)/);
});

test('a criterion declared not applicable leaves the plan entirely', () => {
  const answers = { 'ethics.l1.consent_basis_recorded': { not_applicable: true } };
  const t = buildTodo(rec({ pathway: 'C', sub_domain: 'materials', stage: 'plan', answers }), { now: FIXED });
  const everywhere = [
    ...t.groups.flatMap((g) => g.items),
    ...t.blocked,
    ...t.later,
    ...t.limitations,
  ].map((i) => i.id);
  assert.ok(!everywhere.includes('ethics.l1.consent_basis_recorded'), 'an N/A criterion is still listed as work');
});

test('the header counts what is open, and the dataset name survives', () => {
  const md = generateTodo(rec({ dataset: { name: 'My cohort' } }), { now: FIXED });
  assert.match(md, /# AI-readiness to-do — My cohort/);
  assert.match(md, /Open:\*\* \d+ of \d+ required criteria/);
});
