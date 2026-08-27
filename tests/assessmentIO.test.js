// Reducer tests for records entering state from outside. Uploading a saved
// assessment was removed, so LOAD now serves the worked examples (Examples.jsx)
// and is where normalize() runs; the export half remains as an archival record.
// The round-trip assertions are kept because they pin LOAD's backfill and
// normalization behaviour, which the examples depend on. Run with:  npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';

import { reducer, emptyRecord, RECORD_VERSION } from '../src/state/assessment.jsx';
import { generateCroissant, effectiveCroissant } from '../src/generators/croissant.js';

test('export -> import reproduces the record (deep round-trip)', () => {
  const record = {
    ...emptyRecord(),
    stage: 'prepare',
    pathway: 'C',
    sub_domain: 'clinical',
    answers: { 'ethics.l1.de_identification_applied': { value: true, notes: 'safe harbor' } },
    dataset: { name: 'Cohort X', description: 'desc', version: '1.0.0' },
  };

  // Simulate: write to file, read it back, LOAD it.
  const serialized = JSON.stringify(record);
  const loaded = reducer(emptyRecord(), { type: 'LOAD', record: JSON.parse(serialized) });

  assert.deepEqual(loaded, record);
  assert.equal(loaded.schema_version, RECORD_VERSION);
});

test('LOAD backfills missing keys from the empty record', () => {
  // An older/partial export lacking newer fields still yields a complete record.
  const partial = { schema_version: RECORD_VERSION, pathway: 'A' };
  const loaded = reducer(emptyRecord(), { type: 'LOAD', record: partial });

  assert.equal(loaded.pathway, 'A');
  assert.deepEqual(loaded.dataset, { name: '', description: '', version: '' });
  assert.deepEqual(loaded.answers, {});
  assert.deepEqual(loaded.provenance, { sources: [], steps: [] });
  // Added with the Croissant builder; records exported before it must still load.
  assert.deepEqual(loaded.croissant_model, { files: [], recordSets: [] });
});

test('RESET clears back to an empty record', () => {
  const dirty = { ...emptyRecord(), pathway: 'B', dataset: { name: 'x' } };
  assert.deepEqual(reducer(dirty, { type: 'RESET' }), emptyRecord());
});

// --- Croissant override normalization (builder-primary flip) ----------------
//
// The Export tab used to mirror the descriptor into `croissant` on every
// keystroke, so records saved before the flip carry one even when the user never
// edited anything. Loading those as active overrides would pin them to a stale
// descriptor: later answers, and later generator improvements, would stop
// reaching the exported file. LOAD nulls a `croissant` that carries no
// hand-authored content — no distribution entries and no record sets — since
// every other key in the descriptor is regenerable from the answers.

test('LOAD drops a croissant carrying no hand-authored files or record sets', () => {
  const base = {
    ...emptyRecord(),
    pathway: 'B',
    dataset: { name: 'ds', description: '', version: '' },
    answers: { 'fairness.l1.license_explicit': { value: 'CC-BY-4.0' } },
  };
  // Exactly what the old keystroke effect stored: generate -> stringify -> parse.
  const legacy = { ...base, croissant: JSON.parse(JSON.stringify(generateCroissant(base))) };

  const loaded = reducer(emptyRecord(), { type: 'LOAD', record: legacy });
  assert.equal(loaded.croissant, null, 'a descriptor with nothing hand-authored is not an override');
  // The descriptor is unchanged in content — only its provenance in state is.
  assert.deepEqual(effectiveCroissant(loaded), generateCroissant(base));
});

test('LOAD keeps a genuinely edited croissant', () => {
  const base = { ...emptyRecord(), pathway: 'B', dataset: { name: 'ds', description: '', version: '' } };
  const edited = {
    ...base,
    croissant: {
      ...generateCroissant(base),
      distribution: [{ '@type': 'cr:FileObject', '@id': 'data.csv', encodingFormat: 'text/csv' }],
    },
  };

  const loaded = reducer(emptyRecord(), { type: 'LOAD', record: edited });
  assert.ok(loaded.croissant, 'a hand-authored descriptor must survive import');
  assert.equal(loaded.croissant.distribution.length, 1);
});

test('a scaffold stored before later answers does not hide them from the export', () => {
  // The likely real case, and the reason the rule is "no hand-authored content"
  // rather than "byte-identical to the scaffold": the old code stored a copy when
  // the Export tab mounted, then the user went back and answered more. An exact
  // match would fail here, the stale copy would be kept as an override, and the
  // licence they just recorded would never reach croissant.json.
  const early = { ...emptyRecord(), pathway: 'B', dataset: { name: 'ds', description: '', version: '' } };
  const later = {
    ...early,
    answers: { 'fairness.l1.license_explicit': { value: 'CC-BY-4.0' } },
    croissant: JSON.parse(JSON.stringify(generateCroissant(early))), // stale: no licence
  };

  const loaded = reducer(emptyRecord(), { type: 'LOAD', record: later });
  assert.equal(loaded.croissant, null);
  assert.match(effectiveCroissant(loaded).license, /creativecommons/, 'the later answer is applied');
});

// --- Croissant builder model (tier 2, phase 1) -----------------------------

test('SET_CROISSANT_MODEL replaces the model, leaving the raw override alone', () => {
  const model = {
    files: [{ id: 'f-1', name: 'data.cif', contentUrl: '', encodingFormat: 'chemical/x-cif', sha256: '' }],
    recordSets: [
      { id: 'rs-1', name: 'records', fields: [{ id: 'fd-1', name: 'two_theta', dataType: 'sc:Float', fileId: 'f-1', column: 'two_theta' }] },
    ],
  };
  const next = reducer(emptyRecord(), { type: 'SET_CROISSANT_MODEL', croissant_model: model });

  assert.deepEqual(next.croissant_model, model);
  assert.equal(next.croissant, null, 'the builder model is not a raw override');
});

test('the builder model survives an export -> import round-trip', () => {
  const record = {
    ...emptyRecord(),
    pathway: 'C',
    sub_domain: 'materials',
    croissant_model: {
      files: [{ id: 'f-1', name: 'data.cif', contentUrl: 'https://example.org/data.cif', encodingFormat: 'chemical/x-cif', sha256: '' }],
      recordSets: [
        { id: 'rs-1', name: 'records', fields: [{ id: 'fd-1', name: 'two_theta', dataType: 'sc:Float', fileId: 'f-1', column: 'two_theta' }] },
      ],
    },
  };

  const loaded = reducer(emptyRecord(), { type: 'LOAD', record: JSON.parse(JSON.stringify(record)) });
  assert.deepEqual(loaded.croissant_model, record.croissant_model);
  // The field -> file reference is by internal id, so it survives verbatim.
  assert.equal(loaded.croissant_model.recordSets[0].fields[0].fileId, loaded.croissant_model.files[0].id);
});

test('RESET clears the builder model too', () => {
  const dirty = {
    ...emptyRecord(),
    croissant_model: { files: [{ id: 'f-1', name: 'x' }], recordSets: [] },
  };
  assert.deepEqual(reducer(dirty, { type: 'RESET' }).croissant_model, { files: [], recordSets: [] });
});
