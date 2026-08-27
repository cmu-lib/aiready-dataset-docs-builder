// The validator lookup: matching the registry to a record's data, and the page that
// shows it. §2.5 of the paper ends by making the choice of a domain validator "a lookup
// process"; this covers that lookup end to end, because the registry sat in the bundle
// unreachable by any user for months while every layer of it was individually correct.
//
// Run with:  npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import {
  matchValidators,
  unmatchedValidators,
  ALL_VALIDATORS,
  criteriaBackedBy,
  recordSignals,
} from '../src/lib/validators.js';

const rec = (over = {}) => ({ pathway: 'B', sub_domain: 'general', answers: {}, ...over });
const fmt = (id) => ({ 'sustainability.l1.open_format': { value: id } });
const names = (list) => list.map((v) => v.validator_name);

// --- matching ---------------------------------------------------------------

test('a declared format surfaces its own validator ahead of the general ones', () => {
  const m = matchValidators(rec({ answers: fmt('NetCDF') }));
  assert.equal(m[0].id, 'cf-checker', `expected CF-checker first, got ${names(m)}`);
  assert.equal(m[0].score, 3, 'a format the researcher named is the most specific signal');
  assert.match(m[0].why, /you declared NetCDF/);
});

test('the discipline matters even when the format says nothing', () => {
  // A clinical Parquet dataset needs a bias audit, and the tools that produce one are
  // reachable from the sub-domain rather than from the format.
  const m = matchValidators(rec({ pathway: 'C', sub_domain: 'clinical', answers: fmt('Parquet') }));
  const ids = m.map((v) => v.id);
  assert.ok(ids.includes('aequitas') && ids.includes('fairlearn'), names(m));
  const aequitas = m.find((v) => v.id === 'aequitas');
  assert.match(aequitas.why, /Clinical/);
  // Tabular profiling tools match on the declared format, so they outrank it.
  assert.ok(ids.indexOf('great-expectations') < ids.indexOf('aequitas'));
});

test('a materials encoding standard is matched, not only the release format', () => {
  const m = matchValidators({
    pathway: 'C',
    sub_domain: 'materials',
    answers: {
      ...fmt('CSV'),
      'fairness.l3.materials.encoding_standard': { value: 'CIF' },
    },
  });
  const ids = m.map((v) => v.id);
  assert.ok(ids.includes('checkcif'), names(m));
  assert.equal(m.find((v) => v.id === 'checkcif').score, 3);
  // The sub-domain also brings in the materials-wide tools.
  assert.ok(ids.includes('nexus-validate') && ids.includes('optimade-validator'));
});

test('producing a PROV-O record always brings the graph validator', () => {
  for (const pathway of ['B', 'C']) {
    const ids = matchValidators(rec({ pathway })).map((v) => v.id);
    assert.ok(ids.includes('shacl'), `${pathway}: ${ids}`);
  }
  // Pathway A produces no provenance record, so it does not.
  assert.ok(!matchValidators(rec({ pathway: 'A' })).map((v) => v.id).includes('shacl'));
});

test('an empty record suggests nothing rather than guessing', () => {
  // Suggesting the whole catalogue would be worse than suggesting none: the page falls
  // back to the community registries instead.
  assert.deepEqual(matchValidators({ pathway: 'A', sub_domain: null, answers: {} }), []);
  assert.equal(recordSignals({}).size, 0);
});

test('matched and unmatched partition the registry exactly once', () => {
  const r = rec({ pathway: 'C', sub_domain: 'materials', answers: fmt('HDF5') });
  const m = matchValidators(r).map((v) => v.id);
  const u = unmatchedValidators(r).map((v) => v.id);
  assert.equal(new Set([...m, ...u]).size, ALL_VALIDATORS.length);
  assert.equal(m.filter((id) => u.includes(id)).length, 0);
});

test('criteriaBackedBy is the inverse of a criterion naming a validator', () => {
  const backs = criteriaBackedBy('aequitas').map((c) => c.id);
  assert.ok(backs.includes('characterization.l3.bias_audit'), backs);
  // Including overlay criteria, which is where the discipline-specific links live.
  assert.ok(criteriaBackedBy('checkcif').some((c) => c.id.includes('materials')));
  assert.deepEqual(criteriaBackedBy('no-such-validator'), []);
});

// --- the page ---------------------------------------------------------------

const record = {
  schema_version: 'assessment_record_v0',
  stage: 'upgrade',
  pathway: 'C',
  sub_domain: 'materials',
  started_at: null,
  answers: { 'sustainability.l1.open_format': { value: 'HDF5' } },
  dataset: { name: 'ds', description: '', version: '' },
  croissant: null,
  croissant_model: { files: [], recordSets: [] },
  provo: null,
  provenance: { sources: [], steps: [] },
};
globalThis.localStorage = { getItem: () => JSON.stringify(record), setItem: () => {} };

const { AssessmentProvider } = await import('../src/state/assessment.jsx');
const { default: ValidatorsPage } = await import('../src/routes/Validators.jsx');

const render = () =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={['/validators']}>
      <AssessmentProvider>
        <Routes>
          <Route path="*" element={<ValidatorsPage />} />
        </Routes>
      </AssessmentProvider>
    </MemoryRouter>,
  );

test('the page suggests for the record, links the tool, and says why', () => {
  const html = render();
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  assert.ok(text.includes('Suggested for your dataset'));
  assert.ok(text.includes('cnxvalidate'), 'a materials/HDF5 validator should be suggested');
  assert.ok(text.includes('Suggested because'), 'no reason given for a suggestion');
  assert.ok(html.includes('href="https://github.com/nexusformat/cnxvalidate"'), 'tool not linked');

  // Execution mode is on the card, since it decides whether the user runs it elsewhere.
  assert.ok(text.includes('run locally') || text.includes('hosted service'));

  // The whole catalogue stays reachable, and so does the long-tail fallback.
  assert.ok(text.includes('the rest of the registry') || text.includes('The rest of the registry'));
  for (const registry of ['FAIRsharing', 'DCC Disciplinary Metadata Catalogue', 'RDA Metadata Standards Catalog']) {
    assert.ok(text.includes(registry), `missing registry: ${registry}`);
  }
});

test('the page says what a tool backs, in the framework\'s own terms', () => {
  const text = render().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.ok(text.includes('Backs'), 'no reverse link from validator to criterion');
});

// --- the level axis and the artifact axis -----------------------------------

test('an L3 claim is bounded by the rung its artifact reaches', async () => {
  const { levelSupport, reachesDegree, artifactDegrees } = await import('../src/lib/actionability.js');
  const { validateCroissant } = await import('../src/lib/croissantValidation.js');
  const { validateProvo } = await import('../src/lib/provoValidation.js');
  const { loadableCroissant, provModel } = await import('../src/examples/build.js');
  const { effectiveProvo } = await import('../src/generators/provo.js');

  const ladderFor = (croissant) => {
    const provo = effectiveProvo({ answers: {}, provenance: provModel() });
    return artifactDegrees({
      croissant,
      croissantResult: validateCroissant(croissant),
      provo,
      provoResult: validateProvo(provo),
    });
  };

  const good = loadableCroissant({ name: 'ds', url: 'https://example.org/ds' });
  const support = levelSupport(ladderFor(good));
  const by = Object.fromEntries(support.map((e) => [`${e.dimension} ${e.level}`, e]));

  // A descriptor with a real checksum and resolvable URLs reaches grounded, which is what
  // Computability L3 rests on: a pipeline has to be able to fetch the file.
  assert.equal(by['Computability L3'].ok, true, by['Computability L3'].message);
  assert.equal(by['FAIRness L3'].ok, true);

  // Replace the checksum with the template's row of zeros and the same descriptor no
  // longer supports the claim, even though nothing about the criteria changed. This is
  // the distinction the correspondence exists to make visible.
  const placeholder = { ...good, distribution: [{ ...good.distribution[0], sha256: '0'.repeat(64) }] };
  const weak = Object.fromEntries(levelSupport(ladderFor(placeholder)).map((e) => [`${e.dimension} ${e.level}`, e]));
  assert.equal(weak['Computability L3'].ok, false);
  assert.match(weak['Computability L3'].message, /needs the descriptor at Grounded/);
  // Provenance is unaffected: it depends on the PROV record, not the descriptor.
  assert.equal(weak['Provenance L3'].ok, true);

  // reachesDegree is cumulative, and 'executable' can never be reached because the tool
  // reports it out-of-scope rather than passing it.
  const degrees = ladderFor(good).croissant;
  assert.equal(reachesDegree(degrees, 'schema_valid'), true);
  assert.equal(reachesDegree(degrees, 'executable'), false);
  assert.equal(reachesDegree(degrees, 'no-such-rung'), false);
});

test('every correspondence names a real dimension, level, artifact, and rung', async () => {
  const guidance = (await import('../src/schema/guidance.json')).default;
  const matrix = (await import('../src/schema/matrix.json')).default;
  const { DEGREE_IDS } = await import('../src/lib/actionability.js');

  const entries = guidance.degrees.supports;
  assert.ok(entries.length >= 4);
  for (const e of entries) {
    assert.ok(matrix.dimensions.includes(e.dimension), `unknown dimension ${e.dimension}`);
    assert.ok(matrix.cells[e.dimension][e.level], `unknown cell ${e.dimension}/${e.level}`);
    assert.ok(['croissant', 'provo'].includes(e.artifact), `unknown artifact ${e.artifact}`);
    assert.ok(DEGREE_IDS.includes(e.min_degree), `unknown rung ${e.min_degree}`);
    // 'executable' is never certified, so requiring it would make the claim unreachable.
    assert.notEqual(e.min_degree, 'executable');
    assert.ok(e.why?.length > 40, `${e.dimension} ${e.level} has no rationale`);
  }
});
