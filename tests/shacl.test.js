// SHACL runner tests (Phase 4). Exercises the real jsonld -> RDF -> SHACL path.
// Run with:  npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';

import { validateProvoShacl } from '../src/lib/shacl.js';
import { generateProvo, PROVO_CONTEXT } from '../src/generators/provo.js';

const conformant = {
  '@context': PROVO_CONTEXT,
  '@graph': [
    { '@id': 'urn:ex:dataset', '@type': 'prov:Entity', 'rdfs:label': 'Dataset', 'prov:wasGeneratedBy': { '@id': 'urn:ex:act' } },
    { '@id': 'urn:ex:raw', '@type': 'prov:Entity', 'rdfs:label': 'Raw input' },
    { '@id': 'urn:ex:agent', '@type': 'prov:Agent', 'rdfs:label': 'Data steward' },
    {
      '@id': 'urn:ex:act',
      '@type': 'prov:Activity',
      'rdfs:label': 'Curation',
      'prov:used': { '@id': 'urn:ex:raw' },
      'prov:wasAssociatedWith': { '@id': 'urn:ex:agent' },
    },
  ],
};

test('a complete PROV record conforms to the profile shapes', async () => {
  const { conforms, results } = await validateProvoShacl(conformant);
  assert.equal(conforms, true, JSON.stringify(results));
});

test('a builder-composed PROV record conforms to the SHACL profile', async () => {
  const record = {
    pathway: 'C',
    answers: {},
    provenance: {
      sources: [{ id: 's1', name: 'Raw' }],
      steps: [{ id: 'st1', label: 'Clean', inputs: ['s1'], outputs: [{ id: 'o1', name: 'age' }], software: 'py', agentRole: 'data_steward' }],
    },
  };
  const { conforms, results } = await validateProvoShacl(generateProvo(record));
  assert.equal(conforms, true, JSON.stringify(results));
});

test('the generated scaffold violates ActivityShape (no prov:used)', async () => {
  const scaffold = generateProvo({
    pathway: 'C',
    answers: { 'provenance.l3.agents_with_roles': { value: 'data_steward' } },
  });
  const { conforms, results } = await validateProvoShacl(scaffold);
  assert.equal(conforms, false);
  assert.ok(results.some((r) => /prov:used|input/i.test(r.message)), JSON.stringify(results));
});
