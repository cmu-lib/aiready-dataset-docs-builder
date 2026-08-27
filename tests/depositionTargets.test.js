// Unit tests for deposition-target resolution. The bug this fixes: the
// fairness.l3.deposition_target criterion carries a static vocabulary_key of
// repositories_l3_general, so a materials-science record was offered PhysioNet,
// dbGaP, and ICPSR while its own repositories were never shown.
// Run with:  npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';

import { depositionTargets } from '../src/lib/depositionTargets.js';
import { ALL_CRITERIA, subDomains } from '../src/lib/pathway.js';

const criterion = ALL_CRITERIA.find((c) => c.id === 'fairness.l3.deposition_target');
const ids = (r) => r.values.map((v) => v.id);

test('the deposition criterion declares the scope that triggers resolution', () => {
  assert.ok(criterion, 'fairness.l3.deposition_target missing from the matrix');
  assert.equal(criterion.vocabulary_scope, 'deposition_targets');
  assert.equal(criterion.evidence_type, 'controlled_vocabulary');
});

test('materials science is offered its own repositories, not the biomedical ones', () => {
  const r = depositionTargets(criterion, 'C', 'materials');
  assert.equal(r.key, 'repositories_l3_materials');
  assert.deepEqual(ids(r), ['NOMAD', 'MaterialsCloud', 'OQMD', 'ICSD', 'Zenodo', 'Figshare', 'Dryad']);
  // The regression this guards: none of the biomedical targets may appear.
  for (const wrong of ['PhysioNet', 'dbGaP', 'ICPSR', 'CHoRUS']) {
    assert.ok(!ids(r).includes(wrong), `${wrong} should not be offered to a materials record`);
  }
});

test('a filter widens across vocabularies rather than dropping options', () => {
  // Clinical's vocabulary is repositories_l3_bridge2ai, but its filter names
  // PhysioNet, which lives in repositories_l3_general. It must still appear.
  const r = depositionTargets(criterion, 'C', 'clinical');
  assert.equal(r.key, 'repositories_l3_bridge2ai');
  assert.ok(ids(r).includes('PhysioNet'), 'PhysioNet is filtered-in from another vocabulary');
  assert.ok(ids(r).includes('CM4AI'), 'non-recommended options are kept, not dropped');
});

test('recommended targets sort first and are reported for grouping', () => {
  const r = depositionTargets(criterion, 'C', 'clinical');
  assert.deepEqual(r.recommended, ['CHoRUS', 'PhysioNet']);
  assert.deepEqual(ids(r).slice(0, 2), ['CHoRUS', 'PhysioNet']);

  const inst = depositionTargets(criterion, 'C', 'institutional');
  assert.deepEqual(inst.recommended, ['ICPSR']);
  assert.equal(ids(inst)[0], 'ICPSR');
});

test('a sub-domain with no filter keeps its vocabulary order untouched', () => {
  const r = depositionTargets(criterion, 'C', 'general');
  assert.equal(r.key, 'repositories_l3_general');
  assert.deepEqual(r.recommended, []);
  assert.equal(ids(r)[0], 'PhysioNet');
});

test('falls back to the pathway vocabulary, then to the criterion key', () => {
  // No sub-domain: Pathway C's own declaration.
  assert.equal(depositionTargets(criterion, 'C', null).key, 'repositories_l3_general');
  // Pathways A/B declare their own tiers (the criterion is L3, but resolution is
  // pathway-driven and must not fall through to a biomedical list).
  assert.equal(depositionTargets(criterion, 'A', null).key, 'repositories_l1');
  assert.equal(depositionTargets(criterion, 'B', null).key, 'repositories_l2');
  // Unknown pathway: the criterion's own key is the last resort.
  assert.equal(depositionTargets(criterion, 'Z', null).key, 'repositories_l3_general');
});

test('every Pathway C sub-domain resolves to a non-empty option list', () => {
  for (const sub of subDomains()) {
    const r = depositionTargets(criterion, 'C', sub.id);
    assert.ok(r.values.length > 0, `sub-domain ${sub.id} resolves to no deposition targets`);
    // Every id in the declared filter must survive resolution.
    for (const id of sub.deposition_targets_filter ?? []) {
      assert.ok(
        ids(r).includes(id),
        `sub-domain ${sub.id} filter names ${id}, which resolution dropped`,
      );
    }
  }
});
