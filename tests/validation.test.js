// Unit tests for validation wiring (validation.js) and the results-aware
// verdict. Run with:  npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';

import { validationResults, AUTOMATED_WITH_VALIDATOR } from '../src/lib/validation.js';
import { isCriterionSatisfied, pathwayVerdict, criteriaForPathway } from '../src/lib/pathway.js';
import { CROISSANT_CONTEXT, CROISSANT_CONFORMS_TO } from '../src/generators/croissant.js';

test('validationResults grounds identifiers, license, and format', () => {
  const record = {
    pathway: 'A',
    answers: {
      'fairness.l1.persistent_id': { value: '10.5281/zenodo.123' },
      'fairness.l1.landing_page': { value: 'https://example.org/ds' },
      'fairness.l1.license_explicit': { value: 'CC-BY-4.0' },
      'sustainability.l1.open_format': { value: 'Parquet' },
    },
  };
  const r = validationResults(record);
  assert.ok(r['fairness.l1.persistent_id'].ok);
  assert.ok(r['fairness.l1.landing_page'].ok);
  assert.ok(r['fairness.l1.license_explicit'].ok);
  assert.ok(r['sustainability.l1.open_format'].ok);
  assert.ok(r['computability.l1.loadable_standard_env'].ok); // cross-refs open format
});

test('a bad DOI fails its automated check even when the field is filled', () => {
  const r = validationResults({ pathway: 'A', answers: { 'fairness.l1.persistent_id': { value: 'not-a-doi' } } });
  assert.equal(r['fairness.l1.persistent_id'].ok, false);
});

test('generated (empty) Croissant fails croissant_descriptor and direct_ml_load', () => {
  const r = validationResults({ pathway: 'C', sub_domain: 'general', answers: {} });
  assert.equal(r['fairness.l2.croissant_descriptor'].ok, false);
  assert.equal(r['computability.l3.direct_ml_load'].ok, false);
});

test('responsible_ai passes when Pathway C answers scaffold rai annotations', () => {
  const r = validationResults({
    pathway: 'C',
    sub_domain: 'general',
    answers: { 'characterization.l3.scope_declared': { value: 'Intended for X.' } },
  });
  assert.ok(r['fairness.l3.responsible_ai_annotations'].ok);
});

test('isCriterionSatisfied gates automated criteria on the result, not the claim', () => {
  const crit = { id: 'fairness.l1.persistent_id', verification: 'automated', evidence_type: 'identifier' };
  const answer = { value: 'not-a-doi' };
  // Claimed check would pass (non-empty); validated check must fail.
  assert.equal(isCriterionSatisfied(crit, answer), true); // no results -> claimed fallback
  assert.equal(isCriterionSatisfied(crit, answer, { [crit.id]: { ok: false } }), false);
});

test('the 5 PROV/lineage criteria now have validators (Phase 3 wired them)', () => {
  for (const id of [
    'provenance.l3.prov_record_present',
    'provenance.l3.entity_per_variable',
    'provenance.l3.activity_per_step',
    'provenance.l3.agents_with_roles',
    'explainability.l3.feature_lineage_intact',
  ]) {
    assert.ok(AUTOMATED_WITH_VALIDATOR.has(id), `${id} should have a validator`);
  }
});

test('an automated criterion with no result still falls back to the claimed check', () => {
  // A hypothetical future automated criterion with no validator wired yet.
  const crit = { id: 'future.l1.x', verification: 'automated', evidence_type: 'boolean' };
  assert.equal(isCriterionSatisfied(crit, { value: true }, {}), true); // claimed fallback
  assert.equal(isCriterionSatisfied(crit, { value: false }, {}), false);
});

test('verdict with results counts a valid persistent id but not a bad one', () => {
  const good = { pathway: 'A', answers: { 'fairness.l1.persistent_id': { value: '10.5281/zenodo.123' } } };
  const bad = { pathway: 'A', answers: { 'fairness.l1.persistent_id': { value: 'nope' } } };
  assert.equal(pathwayVerdict('A', good.answers, undefined, validationResults(good)).satisfiedCount, 1);
  assert.equal(pathwayVerdict('A', bad.answers, undefined, validationResults(bad)).satisfiedCount, 0);
  assert.equal(criteriaForPathway('A').length, 16);
});

// The dimension page previously said "Croissant descriptor validates." while the
// Export page listed five outstanding recommendations. The message now carries the
// open-warning count so the two surfaces agree.
test('the L2 Croissant check reports how many recommended items are still open', () => {
  const scaffold = validationResults({
    pathway: 'B',
    dataset: { name: 'ds' },
    answers: {},
  });
  const msg = scaffold['fairness.l2.croissant_descriptor'];
  assert.equal(msg.ok, true, 'a named scaffold is structurally valid');
  assert.match(msg.message, /recommended item\(s\) still open/);

  // A complete, loadable descriptor has nothing open, so no count is appended.
  const complete = validationResults(
    { pathway: 'B', dataset: { name: 'ds' }, answers: {} },
    {
      croissant: {
        '@context': CROISSANT_CONTEXT,
        '@type': 'sc:Dataset',
        conformsTo: CROISSANT_CONFORMS_TO,
        name: 'ds',
        description: 'A dataset.',
        license: 'https://creativecommons.org/licenses/by/4.0/',
        url: 'https://example.org/ds',
        distribution: [
          { '@type': 'cr:FileObject', '@id': 'data.csv', encodingFormat: 'text/csv' },
        ],
        recordSet: [
          {
            '@type': 'cr:RecordSet',
            '@id': 'records',
            field: [{ '@type': 'cr:Field', '@id': 'records/id', dataType: 'sc:Integer' }],
          },
        ],
      },
    },
  );
  assert.equal(complete['fairness.l2.croissant_descriptor'].message, 'Croissant descriptor validates.');
});
