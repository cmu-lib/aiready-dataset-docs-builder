// Unit tests for Croissant validation (structural + referential). Run: npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';

import { validateCroissant } from '../src/lib/croissantValidation.js';
import {
  generateCroissant,
  CROISSANT_CONTEXT,
  CROISSANT_CONFORMS_TO,
} from '../src/generators/croissant.js';

// A minimal complete, loadable descriptor.
const goodDescriptor = () => ({
  '@context': CROISSANT_CONTEXT,
  '@type': 'sc:Dataset',
  conformsTo: CROISSANT_CONFORMS_TO,
  name: 'example-dataset',
  description: 'A dataset.',
  license: 'https://creativecommons.org/licenses/by/4.0/',
  url: 'https://example.org/ds',
  version: '1.0.0',
  distribution: [
    { '@type': 'cr:FileObject', '@id': 'data.parquet', encodingFormat: 'application/vnd.apache.parquet' },
  ],
  recordSet: [
    {
      '@type': 'cr:RecordSet',
      '@id': 'records',
      field: [
        {
          '@type': 'cr:Field',
          '@id': 'records/id',
          dataType: 'sc:Integer',
          source: { fileObject: { '@id': 'data.parquet' } },
        },
      ],
    },
  ],
});

test('a generated scaffold is not valid (name/distribution/recordSet incomplete)', () => {
  const res = validateCroissant(generateCroissant({ pathway: 'A', answers: {} }));
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => /name is required/.test(e)));
});

test('a complete descriptor is valid and loadable', () => {
  const res = validateCroissant(goodDescriptor());
  assert.equal(res.valid, true, res.errors.join('; '));
  assert.equal(res.loadable, true);
});

test('referential integrity: field source must resolve to a declared distribution', () => {
  const d = goodDescriptor();
  d.recordSet[0].field[0].source.fileObject['@id'] = 'missing.parquet';
  const res = validateCroissant(d);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => /undeclared distribution/.test(e)));
});

test('duplicate @id is a hard error', () => {
  const d = goodDescriptor();
  d.recordSet[0]['@id'] = 'data.parquet'; // collides with the FileObject id
  const res = validateCroissant(d);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => /duplicate @id/.test(e)));
});

test('valid-but-not-loadable: metadata-only descriptor passes with warnings', () => {
  const d = goodDescriptor();
  d.distribution = [];
  d.recordSet = [];
  const res = validateCroissant(d);
  assert.equal(res.valid, true); // no hard errors — mlcroissant would accept metadata
  assert.equal(res.loadable, false); // but not directly loadable
  assert.ok(res.warnings.some((w) => /distribution is empty/.test(w)));
});

test('wrong conformsTo and @type are hard errors', () => {
  const res = validateCroissant({ '@context': {}, '@type': 'sc:Thing', conformsTo: 'x', name: 'n' });
  assert.ok(res.errors.some((e) => /@type must be/.test(e)));
  assert.ok(res.errors.some((e) => /conformsTo must be/.test(e)));
});

// The Export page renders `warnings` verbatim as the "what's still missing" list
// (it previously showed only errors[0] and discarded these). Lock the set a user
// sees on a freshly generated scaffold so that guidance cannot silently vanish.
test('a generated scaffold warns about every field the checklist does not collect', () => {
  const res = validateCroissant(
    generateCroissant({ pathway: 'A', dataset: { name: 'ds' }, answers: {} }),
  );
  assert.equal(res.valid, true, 'a scaffold with a name is structurally valid');
  assert.equal(res.loadable, false);
  for (const pattern of [
    /description is recommended/,
    /license is recommended/,
    /url is recommended/,
    /distribution is empty/,
    /recordSet is empty/,
  ]) {
    assert.ok(
      res.warnings.some((w) => pattern.test(w)),
      `expected a warning matching ${pattern}; got: ${res.warnings.join(' | ')}`,
    );
  }
});

// Cross-check against the assessment: the declared format has a known media type,
// so a descriptor shipping something else is worth flagging — as a warning, since
// either side may legitimately be the outdated one.
test('encodingFormat mismatch against the declared format is a warning, not an error', () => {
  const d = goodDescriptor(); // ships application/vnd.apache.parquet
  const res = validateCroissant(d, { expectedMime: 'chemical/x-cif' });
  assert.equal(res.valid, true, 'a mismatch must never invalidate the descriptor');
  assert.ok(
    res.warnings.some((w) => /chemical\/x-cif/.test(w) && /vnd\.apache\.parquet/.test(w)),
    `expected a mismatch warning naming both types; got: ${res.warnings.join(' | ')}`,
  );
});

test('encodingFormat cross-check stays silent when it matches, is absent, or has nothing to compare', () => {
  const d = goodDescriptor();
  const mismatch = /declares encodingFormat/;

  // Matches the declared format.
  assert.ok(
    !validateCroissant(d, { expectedMime: 'application/vnd.apache.parquet' }).warnings.some((w) =>
      mismatch.test(w),
    ),
  );
  // No expectation passed (the assessment declared nothing usable).
  assert.ok(!validateCroissant(d).warnings.some((w) => mismatch.test(w)));
  assert.ok(!validateCroissant(d, { expectedMime: '  ' }).warnings.some((w) => mismatch.test(w)));

  // No distribution declares an encodingFormat at all — already covered by the
  // "missing encodingFormat" warning; do not pile a second one on top.
  const bare = goodDescriptor();
  delete bare.distribution[0].encodingFormat;
  assert.ok(
    !validateCroissant(bare, { expectedMime: 'chemical/x-cif' }).warnings.some((w) =>
      mismatch.test(w),
    ),
  );
});
