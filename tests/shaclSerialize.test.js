// Serialization tests for the SHACL report and PROV-O Turtle export (Phase 4).
// Run with:  npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';

import { validateProvoShacl, serializeReport, provoToTurtle } from '../src/lib/shacl.js';
import { generateProvo, PROVO_CONTEXT } from '../src/generators/provo.js';

const conformant = {
  '@context': PROVO_CONTEXT,
  '@graph': [
    { '@id': 'urn:ex:dataset', '@type': 'prov:Entity', 'rdfs:label': 'Dataset' },
    { '@id': 'urn:ex:raw', '@type': 'prov:Entity', 'rdfs:label': 'Raw' },
    { '@id': 'urn:ex:agent', '@type': 'prov:Agent', 'rdfs:label': 'Steward' },
    {
      '@id': 'urn:ex:act',
      '@type': 'prov:Activity',
      'prov:used': { '@id': 'urn:ex:raw' },
      'prov:wasAssociatedWith': { '@id': 'urn:ex:agent' },
    },
  ],
};

test('serializeReport emits Turtle with the SHACL ValidationReport', async () => {
  const scaffold = generateProvo({ pathway: 'C', answers: {} });
  const { dataset } = await validateProvoShacl(scaffold);
  const ttl = await serializeReport(dataset, 'turtle');
  assert.match(ttl, /sh:ValidationReport|ValidationReport/);
});

test('serializeReport emits parseable JSON-LD', async () => {
  const scaffold = generateProvo({ pathway: 'C', answers: {} });
  const { dataset } = await validateProvoShacl(scaffold);
  const jsonldStr = await serializeReport(dataset, 'jsonld');
  const parsed = JSON.parse(jsonldStr);
  assert.ok(Array.isArray(parsed) || typeof parsed === 'object');
});

test('provoToTurtle serializes a PROV record to Turtle', async () => {
  const ttl = await provoToTurtle(conformant);
  assert.match(ttl, /prov:Activity/);
  assert.match(ttl, /prov:used/);
});
