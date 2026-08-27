// Unit tests for PROV-O structural validation. Run with:  npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';

import { validateProvo } from '../src/lib/provoValidation.js';
import { generateProvo, PROVO_CONTEXT } from '../src/generators/provo.js';

test('a generated scaffold is well-formed but has no variable entities', () => {
  const res = validateProvo(
    generateProvo({
      pathway: 'C',
      answers: {
        'provenance.l3.agents_with_roles': { value: 'data_steward' },
        'provenance.l2.software_versions': { value: 'python 3.11' },
      },
    }),
  );
  assert.equal(res.valid, true); // well-formed record present
  assert.equal(res.agentWithRoleCount, 1);
  assert.equal(res.activityCount, 1); // curation activity records software
  assert.equal(res.variableEntityCount, 0); // must be completed by the user
  assert.equal(res.derivationIntact, false);
});

test('a builder-composed record passes all PROV structural checks', () => {
  const record = {
    pathway: 'C',
    answers: {},
    provenance: {
      sources: [{ id: 's1', name: 'Raw' }],
      steps: [{ id: 'st1', label: 'Clean', inputs: ['s1'], outputs: [{ id: 'o1', name: 'age' }], software: 'py', agentRole: 'data_steward' }],
    },
  };
  const res = validateProvo(generateProvo(record));
  assert.equal(res.valid, true);
  assert.equal(res.variableEntityCount, 1);
  assert.equal(res.activityCount, 1);
  assert.equal(res.agentWithRoleCount, 1);
  assert.equal(res.derivationIntact, true);
});

test('malformed records are invalid', () => {
  assert.equal(validateProvo(null).valid, false);
  assert.equal(validateProvo({ '@context': {} }).valid, false); // no prov, no @graph
  assert.equal(validateProvo({ '@context': PROVO_CONTEXT, '@graph': [] }).valid, false); // no entity
});

test('variable entities with lineage make derivationIntact true', () => {
  const desc = {
    '@context': PROVO_CONTEXT,
    '@graph': [
      { '@id': '#dataset', '@type': 'prov:Entity' },
      {
        '@id': '#var/age',
        '@type': 'prov:Entity',
        kind: 'variable',
        'prov:wasDerivedFrom': { '@id': '#dataset' },
      },
    ],
  };
  const res = validateProvo(desc);
  assert.equal(res.valid, true);
  assert.equal(res.variableEntityCount, 1);
  assert.equal(res.derivationIntact, true);
});

test('a variable entity without lineage breaks derivationIntact', () => {
  const desc = {
    '@context': PROVO_CONTEXT,
    '@graph': [
      { '@id': '#dataset', '@type': 'prov:Entity' },
      { '@id': '#var/age', '@type': 'prov:Entity', kind: 'variable' },
    ],
  };
  const res = validateProvo(desc);
  assert.equal(res.variableEntityCount, 1);
  assert.equal(res.derivationIntact, false);
});
