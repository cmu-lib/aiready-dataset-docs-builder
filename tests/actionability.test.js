// Unit tests for the degrees of machine-actionability (the paper's actionability
// ladder). Run with:  npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  DEGREES,
  DEGREE_IDS,
  attainedDegree,
  croissantDegrees,
  provoDegrees,
  artifactDegrees,
} from '../src/lib/actionability.js';
import { validateCroissant } from '../src/lib/croissantValidation.js';
import { validateProvo } from '../src/lib/provoValidation.js';
import { CROISSANT_CONTEXT, CROISSANT_CONFORMS_TO } from '../src/generators/croissant.js';
import { effectiveProvo, PROVO_CONTEXT } from '../src/generators/provo.js';
import { buildConformanceReport, CONFORMANCE_VERSION } from '../src/lib/report.js';
import guidanceDoc from '../src/schema/guidance.json';

const guidanceModes = () => guidanceDoc.verification_modes.modes;

// --- fixtures --------------------------------------------------------------

// A descriptor that reaches the tool's ceiling: valid, referentially sound, and
// with every value a consumer must dereference expressed as a resolvable one.
const groundedCroissant = () => ({
  '@context': CROISSANT_CONTEXT,
  '@type': 'sc:Dataset',
  conformsTo: CROISSANT_CONFORMS_TO,
  name: 'example-dataset',
  description: 'A placeholder tabular dataset.',
  license: 'https://creativecommons.org/licenses/by/4.0/',
  url: 'https://example.org/datasets/example',
  distribution: [
    {
      '@type': 'cr:FileObject',
      '@id': 'data.parquet',
      name: 'data.parquet',
      contentUrl: 'https://example.org/datasets/example/data.parquet',
      encodingFormat: 'application/vnd.apache.parquet',
      sha256: 'a'.repeat(64),
    },
  ],
  recordSet: [
    {
      '@type': 'cr:RecordSet',
      '@id': 'records',
      name: 'records',
      field: [
        {
          '@type': 'cr:Field',
          '@id': 'records/id',
          name: 'id',
          dataType: 'sc:Integer',
          source: { fileObject: { '@id': 'data.parquet' }, extract: { column: 'id' } },
        },
      ],
    },
  ],
});

const degreesFor = (desc) => croissantDegrees(desc, validateCroissant(desc));
const provoFor = (desc, opts) => provoDegrees(desc, validateProvo(desc), opts);

// --- the ladder itself -----------------------------------------------------

test('the ladder is the five degrees of the paper, in order', () => {
  assert.deepEqual(DEGREE_IDS, [
    'well_formed',
    'schema_valid',
    'referentially_sound',
    'grounded',
    'executable',
  ]);
  for (const d of DEGREES) assert.ok(d.label && d.check, `${d.id} needs a label and a check`);
});

test('attainedDegree is the highest rung with every rung below it passing', () => {
  const all = (status) => Object.fromEntries(DEGREE_IDS.map((id) => [id, { status, message: '' }]));

  // out-of-scope ends the run, so a fully passing artifact tops out at grounded —
  // the tool's stated ceiling.
  const ceiling = { ...all('pass'), executable: { status: 'out-of-scope', message: '' } };
  assert.equal(attainedDegree(ceiling), 'grounded');

  const brokenSchema = { ...ceiling, schema_valid: { status: 'fail', message: '' } };
  assert.equal(attainedDegree(brokenSchema), 'well_formed');

  assert.equal(attainedDegree(all('fail')), null);
});

// --- Croissant -------------------------------------------------------------

test('a complete descriptor reaches grounded, and never claims executable', () => {
  const d = degreesFor(groundedCroissant());
  assert.equal(d.well_formed.status, 'pass');
  assert.equal(d.schema_valid.status, 'pass');
  assert.equal(d.referentially_sound.status, 'pass');
  assert.equal(d.grounded.status, 'pass', d.grounded.message);
  assert.equal(d.executable.status, 'out-of-scope');
  assert.equal(d.attained, 'grounded');
});

test('executable is out-of-scope even when everything else fails', () => {
  // 'fail' would imply a check ran and the artifact lost; it never runs.
  assert.equal(degreesFor(null).executable.status, 'out-of-scope');
  assert.equal(degreesFor(groundedCroissant()).executable.status, 'out-of-scope');
});

test('a missing required property fails schema-valid, not referential soundness', () => {
  const desc = groundedCroissant();
  delete desc.name;
  const d = degreesFor(desc);
  assert.equal(d.well_formed.status, 'pass');
  assert.equal(d.schema_valid.status, 'fail');
  assert.match(d.schema_valid.message, /name is required/);
  // Rungs above a failure report that they were not assessed rather than passing.
  assert.equal(d.referentially_sound.status, 'fail');
  assert.match(d.referentially_sound.message, /not assessed/i);
  assert.equal(d.attained, 'well_formed');
});

test('a field source pointing nowhere is schema-valid but not referentially sound', () => {
  const desc = groundedCroissant();
  desc.recordSet[0].field[0].source.fileObject['@id'] = 'not-declared.parquet';
  const d = degreesFor(desc);
  assert.equal(d.schema_valid.status, 'pass');
  assert.equal(d.referentially_sound.status, 'fail');
  assert.match(d.referentially_sound.message, /undeclared distribution/);
  assert.equal(d.attained, 'schema_valid');
});

test('a duplicate @id breaks referential soundness', () => {
  const desc = groundedCroissant();
  desc.recordSet[0]['@id'] = 'data.parquet';
  const d = degreesFor(desc);
  assert.equal(d.referentially_sound.status, 'fail');
  assert.match(d.referentially_sound.message, /duplicate @id/);
});

test('the placeholder checksum is referentially sound but not grounded', () => {
  // This is the distinction the ladder exists to draw: the descriptor validates and
  // its references resolve, but a consumer reading sha256 learns nothing.
  const desc = groundedCroissant();
  desc.distribution[0].sha256 = '0'.repeat(64);
  const d = degreesFor(desc);
  assert.equal(d.referentially_sound.status, 'pass');
  assert.equal(d.grounded.status, 'fail');
  assert.match(d.grounded.message, /placeholder/);
  assert.equal(d.attained, 'referentially_sound');
});

test('a free-text or absent licence and url block grounded', () => {
  const desc = groundedCroissant();
  delete desc.license;
  desc.url = 'see our website';
  const d = degreesFor(desc);
  assert.equal(d.referentially_sound.status, 'pass');
  assert.equal(d.grounded.status, 'fail');
  assert.match(d.grounded.message, /no license|resolvable URI/);
});

test('a metadata-only descriptor has nothing to ground', () => {
  const desc = groundedCroissant();
  desc.distribution = [];
  desc.recordSet = [];
  const d = degreesFor(desc);
  assert.equal(d.schema_valid.status, 'pass'); // empty is a warning, not an error
  assert.equal(d.grounded.status, 'fail');
  assert.match(d.grounded.message, /nothing to ground/);
});

test('unparseable raw text fails the first rung and attains nothing', () => {
  const d = croissantDegrees(null, null, { parseError: 'Unexpected token }' });
  assert.equal(d.well_formed.status, 'fail');
  assert.match(d.well_formed.message, /does not parse/i);
  assert.equal(d.attained, null);
});

// --- PROV-O ----------------------------------------------------------------

test('the generated PROV scaffold is referentially sound but not grounded', () => {
  // Its nodes are local fragments (#dataset, #activity-curation) with no agent:
  // internally consistent, externally meaningless. That is exactly the gap
  // between referential soundness and grounding.
  const d = provoFor(effectiveProvo({ answers: {} }));
  assert.equal(d.schema_valid.status, 'pass');
  assert.equal(d.referentially_sound.status, 'pass');
  assert.match(d.referentially_sound.message, /has not been run/);
  assert.equal(d.grounded.status, 'fail');
  assert.match(d.grounded.message, /resolvable URI or DOI|prov:Agent/);
  assert.equal(d.attained, 'referentially_sound');
});

test('a dangling PROV link fails referential soundness', () => {
  const desc = {
    '@context': PROVO_CONTEXT,
    '@graph': [
      {
        '@id': '#dataset',
        '@type': 'prov:Entity',
        'prov:wasGeneratedBy': { '@id': '#activity-that-does-not-exist' },
      },
    ],
  };
  const d = provoFor(desc);
  assert.equal(d.schema_valid.status, 'pass');
  assert.equal(d.referentially_sound.status, 'fail');
  assert.match(d.referentially_sound.message, /dangling reference/);
});

test('a record with resolvable ids and an ORCID agent reaches grounded', () => {
  const desc = {
    '@context': PROVO_CONTEXT,
    '@graph': [
      {
        '@id': 'https://doi.org/10.5281/zenodo.123',
        '@type': 'prov:Entity',
        'prov:wasGeneratedBy': { '@id': '#activity-curation' },
      },
      {
        '@id': '#activity-curation',
        '@type': 'prov:Activity',
        'prov:wasAssociatedWith': { '@id': 'https://orcid.org/0000-0002-1825-0097' },
      },
      { '@id': 'https://orcid.org/0000-0002-1825-0097', '@type': 'prov:Agent', role: 'data_steward' },
    ],
  };
  const d = provoFor(desc);
  assert.equal(d.referentially_sound.status, 'pass');
  assert.equal(d.grounded.status, 'pass', d.grounded.message);
  assert.equal(d.attained, 'grounded');
});

test('a non-conforming SHACL report fails referential soundness even when links resolve', () => {
  const desc = effectiveProvo({ answers: {} });
  const shacl = { conforms: false, results: [{ message: 'Activity needs an input.' }] };
  const d = provoFor(desc, { shacl });
  assert.equal(d.referentially_sound.status, 'fail');
  assert.match(d.referentially_sound.message, /SHACL/);
});

test('a conforming SHACL report certifies the referential rung', () => {
  const desc = effectiveProvo({ answers: {} });
  const d = provoFor(desc, { shacl: { conforms: true, results: [] } });
  assert.equal(d.referentially_sound.status, 'pass');
  assert.match(d.referentially_sound.message, /conforms to the PROV-O profile/);
});

// --- report integration ----------------------------------------------------

test('the conformance report carries the ladder for both artifacts', () => {
  const rep = buildConformanceReport(
    { pathway: 'C', sub_domain: 'general', answers: {} },
    { now: '2026-07-16T00:00:00.000Z' },
  );
  assert.equal(rep.schema_version, CONFORMANCE_VERSION);
  assert.deepEqual(
    rep.ladder.degrees.map((d) => d.id),
    DEGREE_IDS,
  );
  for (const artifact of ['croissant', 'provo']) {
    const d = rep.ladder[artifact];
    assert.ok(d, `${artifact} ladder missing`);
    assert.equal(d.executable.status, 'out-of-scope');
    for (const id of DEGREE_IDS) {
      assert.ok(
        ['pass', 'fail', 'out-of-scope'].includes(d[id].status),
        `${artifact}.${id} has an unexpected status`,
      );
      assert.ok(d[id].message, `${artifact}.${id} has no message`);
    }
  }
});

test('artifactDegrees threads the SHACL report through to the PROV ladder', () => {
  const provo = effectiveProvo({ answers: {} });
  const withShacl = artifactDegrees({
    provo,
    provoResult: validateProvo(provo),
    shacl: { conforms: true, results: [] },
  });
  assert.match(withShacl.provo.referentially_sound.message, /conforms/);

  const without = artifactDegrees({ provo, provoResult: validateProvo(provo) });
  assert.match(without.provo.referentially_sound.message, /has not been run/);
});

// --- the ladder's prose and its logic come from one place -------------------

test('the rungs come from guidance.json, so the guide and the verdict cannot drift', () => {
  // The degrees are explained in the collection guide and computed here. They used
  // to be a literal in this module, which is exactly how the app and the paper's
  // figure diverged once before.
  const guidance = guidanceDoc;
  assert.deepEqual(guidance.degrees.rungs.map((r) => r.id), DEGREE_IDS);
  for (const r of guidance.degrees.rungs) {
    assert.ok(r.label && r.check, `${r.id} needs a label and a certifying check`);
    assert.ok(r.means?.length > 40, `${r.id} needs a plain-language explanation`);
    assert.ok(r.tone, `${r.id} needs a tone for the guide strip`);
  }
  // Table 6's wording is quoted, so the check text must survive verbatim.
  const grounded = guidance.degrees.rungs.find((r) => r.id === 'grounded');
  assert.equal(grounded.check, 'Values are resolvable identifiers, not free text');
  assert.ok(guidance.degrees.lead && guidance.degrees.scope_note);
});

test('the three verification modes are defined, and match what criteria declare', () => {
  // A chip reading "attested" told the user nothing until these definitions existed.
  const modes = guidanceModes();
  assert.deepEqual(modes.map((m) => m.id).sort(), ['attested', 'automated', 'manual']);
  for (const m of modes) {
    assert.ok(m.definition?.length > 40, `${m.id} has no definition`);
    assert.ok(m.tone, `${m.id} has no tone`);
  }
});
