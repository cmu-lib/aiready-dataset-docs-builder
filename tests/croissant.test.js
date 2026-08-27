// Unit tests for the Croissant generator. Validation tests come with 2.3.
// Run with:  npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  generateCroissant,
  formatFacets,
  suggestedFormat,
  withTemplateEntries,
  seedTemplateRows,
  nextRowId,
  CROISSANT_CONFORMS_TO,
} from '../src/generators/croissant.js';
import { validateCroissant } from '../src/lib/croissantValidation.js';

test('generateCroissant emits a Croissant 1.0 scaffold with context and conformsTo', () => {
  const desc = generateCroissant({ pathway: 'A', answers: {} });
  assert.equal(desc['@type'], 'sc:Dataset');
  assert.equal(desc.conformsTo, CROISSANT_CONFORMS_TO);
  assert.ok(desc['@context'] && desc['@context'].cr, 'context with cr prefix present');
  // Uncollected fields left empty so validation can flag them.
  assert.equal(desc.name, '');
  assert.deepEqual(desc.distribution, []);
  assert.deepEqual(desc.recordSet, []);
});

test('generateCroissant maps license to its URL and derives url/citeAs from answers', () => {
  const desc = generateCroissant({
    pathway: 'A',
    answers: {
      'fairness.l1.license_explicit': { value: 'CC-BY-4.0' },
      'fairness.l1.persistent_id': { value: '10.5281/zenodo.123' },
    },
  });
  assert.match(desc.license, /creativecommons\.org\/licenses\/by\/4\.0/);
  assert.equal(desc.url, 'https://doi.org/10.5281/zenodo.123');
  assert.equal(desc.citeAs, '10.5281/zenodo.123');
});

test('landing page takes precedence over DOI for url', () => {
  const desc = generateCroissant({
    pathway: 'A',
    answers: {
      'fairness.l1.landing_page': { value: 'https://example.org/ds' },
      'fairness.l1.persistent_id': { value: '10.5281/zenodo.123' },
    },
  });
  assert.equal(desc.url, 'https://example.org/ds');
});

test('Pathway C scaffolds Responsible-AI annotations from answers', () => {
  const desc = generateCroissant({
    pathway: 'C',
    sub_domain: 'general',
    answers: {
      'characterization.l3.scope_declared': { value: 'Intended for X; not for clinical decisions.' },
      'characterization.l3.limitations_declared': { value: 'Selection bias in cohort.' },
    },
  });
  assert.equal(desc['rai:dataUseCases'], 'Intended for X; not for clinical decisions.');
  assert.equal(desc['rai:dataLimitations'], 'Selection bias in cohort.');
});

test('Pathway A does not add rai annotations', () => {
  const desc = generateCroissant({ pathway: 'A', answers: {} });
  assert.ok(!Object.keys(desc).some((k) => k.startsWith('rai:')));
});

// ---- format lookup + template insertion (Croissant authoring aids) ---------

test('formatFacets resolves a declared format to its media type and extension', () => {
  assert.deepEqual(formatFacets('CIF'), { mime: 'chemical/x-cif', ext: 'cif' });
  assert.deepEqual(formatFacets('Parquet'), {
    mime: 'application/vnd.apache.parquet',
    ext: 'parquet',
  });
  // NeXus is HDF5 underneath — the media type reflects the container.
  assert.equal(formatFacets('NeXus').mime, 'application/x-hdf5');
  // A custom free-text value, or a format with no single media type, resolves to nothing.
  assert.deepEqual(formatFacets('some-lab-format'), {});
  assert.deepEqual(formatFacets('BIDS'), { mime: undefined, ext: undefined });
});

test('suggestedFormat prefers the materials encoding standard over the general open format', () => {
  const record = {
    answers: {
      'sustainability.l1.open_format': { value: 'Parquet' },
      'fairness.l3.materials.encoding_standard': { value: 'CIF' },
    },
  };
  assert.deepEqual(suggestedFormat(record), { mime: 'chemical/x-cif', ext: 'cif' });
});

test('suggestedFormat falls back to the open-format answer, then to CSV', () => {
  assert.deepEqual(suggestedFormat({ answers: { 'sustainability.l1.open_format': { value: 'HDF5' } } }), {
    mime: 'application/x-hdf5',
    ext: 'h5',
  });
  assert.deepEqual(suggestedFormat({ answers: {} }), { mime: 'text/csv', ext: 'csv' });
});

test('withTemplateEntries is additive — derived keys survive, and the result is loadable', () => {
  const base = generateCroissant({
    pathway: 'C',
    sub_domain: 'materials',
    dataset: { name: 'alpha_quartz_xrd' },
    answers: {
      'fairness.l1.license_explicit': { value: 'CC-BY-4.0' },
      'fairness.l1.persistent_id': { value: '10.5281/zenodo.123' },
      'characterization.l3.scope_declared': { value: 'Phase identification.' },
      'fairness.l3.materials.encoding_standard': { value: 'CIF' },
    },
  });
  const next = withTemplateEntries(base, {
    answers: { 'fairness.l3.materials.encoding_standard': { value: 'CIF' } },
  });

  // Nothing derived from the answers is lost.
  assert.equal(next.name, 'alpha_quartz_xrd');
  assert.equal(next.citeAs, '10.5281/zenodo.123');
  assert.match(next.license, /creativecommons/);
  assert.equal(next['rai:dataUseCases'], 'Phase identification.');

  // The template is seeded from the declared discipline encoding, not a default.
  assert.equal(next.distribution.length, 1);
  assert.equal(next.distribution[0]['@id'], 'data.cif');
  assert.equal(next.distribution[0].encodingFormat, 'chemical/x-cif');

  // Each field points at the file that was just declared.
  const fields = next.recordSet[0].field;
  assert.equal(fields.length, 2);
  for (const f of fields) {
    assert.equal(f.source.fileObject['@id'], 'data.cif');
  }

  const result = validateCroissant(next);
  assert.deepEqual(result.errors, []);
  assert.ok(result.valid && result.loadable, 'template output must validate and be loadable');
});

test('withTemplateEntries never emits a duplicate @id when applied repeatedly', () => {
  const record = { answers: {} };
  let desc = generateCroissant({ pathway: 'A', dataset: { name: 'ds' }, answers: {} });
  for (let i = 0; i < 3; i += 1) desc = withTemplateEntries(desc, record);

  assert.deepEqual(
    desc.distribution.map((d) => d['@id']),
    ['data.csv', 'data-2.csv', 'data-3.csv'],
  );
  assert.deepEqual(
    desc.recordSet.map((r) => r['@id']),
    ['records', 'records-2', 'records-3'],
  );
  // The validator is the real arbiter of uniqueness — it checks fields too.
  assert.deepEqual(validateCroissant(desc).errors, []);
});

test('withTemplateEntries tolerates a descriptor with no distribution/recordSet keys', () => {
  const next = withTemplateEntries({ name: 'bare' }, { answers: {} });
  assert.equal(next.distribution.length, 1);
  assert.equal(next.recordSet.length, 1);
  assert.equal(withTemplateEntries(null, { answers: {} }), null);
});

// ---- builder model -> descriptor (tier 2, phase 2) ------------------------
//
// The contract: a descriptor composed from the builder model always passes
// validateCroissant. That is what lets the builder replace hand-written JSON —
// the same promise ProvenanceBuilder makes against the PROV-O/SHACL checks.

const materials = (model) => ({
  pathway: 'C',
  sub_domain: 'materials',
  dataset: { name: 'alpha_quartz_xrd' },
  answers: { 'fairness.l3.materials.encoding_standard': { value: 'CIF' } },
  croissant_model: model,
});

const filledModel = () => ({
  files: [
    { id: 'file-1', name: 'patterns.cif', contentUrl: 'https://example.org/patterns.cif', encodingFormat: 'chemical/x-cif', sha256: '' },
  ],
  recordSets: [
    {
      id: 'recordset-1',
      name: 'patterns',
      fields: [
        { id: 'field-1', name: 'two_theta', dataType: 'sc:Float', fileId: 'file-1', column: 'two_theta' },
        { id: 'field-2', name: 'intensity', dataType: 'sc:Float', fileId: 'file-1', column: 'counts' },
      ],
    },
  ],
});

test('a filled model composes into a valid, directly loadable descriptor', () => {
  const desc = generateCroissant(materials(filledModel()));
  const res = validateCroissant(desc);
  assert.deepEqual(res.errors, []);
  assert.ok(res.valid && res.loadable);

  assert.equal(desc.distribution[0]['@id'], 'patterns.cif');
  assert.equal(desc.distribution[0].encodingFormat, 'chemical/x-cif');
  assert.equal(desc.recordSet[0]['@id'], 'patterns');
  assert.deepEqual(
    desc.recordSet[0].field.map((f) => f['@id']),
    ['patterns/two_theta', 'patterns/intensity'],
  );
  // The column may differ from the field name; both are carried through.
  assert.equal(desc.recordSet[0].field[1].source.extract.column, 'counts');
  // Derived keys still come from the answers — the model only adds the two arrays.
  assert.equal(desc.name, 'alpha_quartz_xrd');
});

test('renaming a file rewrites its @id and every reference to it', () => {
  // The reason rows carry an internal id: fields point at `file-1`, not at the
  // filename, so a rename cannot strand them.
  const model = filledModel();
  model.files[0].name = 'renamed.cif';
  const desc = generateCroissant(materials(model));

  assert.equal(desc.distribution[0]['@id'], 'renamed.cif');
  for (const f of desc.recordSet[0].field) {
    assert.equal(f.source.fileObject['@id'], 'renamed.cif');
  }
  assert.deepEqual(validateCroissant(desc).errors, []);
});

test('a field with no file, or a deleted one, emits no source instead of a dangling reference', () => {
  const model = filledModel();
  model.recordSets[0].fields[0].fileId = ''; // never chosen
  model.recordSets[0].fields[1].fileId = 'file-99'; // file since deleted
  const desc = generateCroissant(materials(model));

  for (const f of desc.recordSet[0].field) {
    assert.equal(f.source, undefined);
  }
  const res = validateCroissant(desc);
  assert.deepEqual(res.errors, [], 'a half-filled row must never produce a hard error');
  assert.ok(res.valid);
});

test('duplicate and blank names still yield unique @ids', () => {
  const desc = generateCroissant(
    materials({
      files: [
        { id: 'file-1', name: 'data.csv' },
        { id: 'file-2', name: 'data.csv' }, // same name
        { id: 'file-3', name: '' }, // not named yet
      ],
      recordSets: [
        { id: 'recordset-1', name: 'records', fields: [{ id: 'field-1', name: 'x', fileId: 'file-2' }] },
        { id: 'recordset-2', name: 'records', fields: [{ id: 'field-2', name: 'x', fileId: 'file-1' }] },
      ],
    }),
  );

  const ids = [
    ...desc.distribution.map((d) => d['@id']),
    ...desc.recordSet.flatMap((r) => [r['@id'], ...r.field.map((f) => f['@id'])]),
  ];
  assert.equal(new Set(ids).size, ids.length, `duplicate @ids emitted: ${ids.join(', ')}`);
  assert.deepEqual(validateCroissant(desc).errors, []);
  // Each field still points at the file its row selected, despite the collision.
  assert.notEqual(
    desc.recordSet[0].field[0].source.fileObject['@id'],
    desc.recordSet[1].field[0].source.fileObject['@id'],
  );
});

test('an empty model leaves the metadata-only scaffold untouched', () => {
  const empty = generateCroissant(materials({ files: [], recordSets: [] }));
  assert.deepEqual(empty.distribution, []);
  assert.deepEqual(empty.recordSet, []);
  assert.equal(validateCroissant(empty).loadable, false);
  // Same as a record with no model at all.
  const none = generateCroissant({ ...materials(undefined), croissant_model: undefined });
  assert.deepEqual(none.distribution, none.distribution);
  assert.deepEqual(none.recordSet, []);
});

test('seedTemplateRows starts from the declared format and stays unique when repeated', () => {
  const record = materials({ files: [], recordSets: [] });
  let model = { files: [], recordSets: [] };
  model = seedTemplateRows(model, record);

  assert.equal(model.files[0].name, 'data.cif', 'seeded from the materials encoding standard');
  assert.equal(model.files[0].encodingFormat, 'chemical/x-cif');
  assert.equal(model.recordSets[0].fields.length, 2);
  assert.equal(model.recordSets[0].fields[0].fileId, model.files[0].id, 'fields wired to the new file');

  model = seedTemplateRows(model, record);
  model = seedTemplateRows(model, record);
  assert.deepEqual(model.files.map((f) => f.name), ['data.cif', 'data-2.cif', 'data-3.cif']);
  assert.equal(new Set(model.files.map((f) => f.id)).size, 3);
  assert.equal(new Set(model.recordSets.flatMap((r) => r.fields.map((f) => f.id))).size, 6);

  // And the whole thing still composes to a valid, loadable descriptor.
  const res = validateCroissant(generateCroissant({ ...record, croissant_model: model }));
  assert.deepEqual(res.errors, []);
  assert.ok(res.loadable);
});

test('nextRowId fills the first free slot', () => {
  assert.equal(nextRowId('file', []), 'file-1');
  assert.equal(nextRowId('file', ['file-1', 'file-2']), 'file-3');
  assert.equal(nextRowId('file', ['file-2']), 'file-1');
});
