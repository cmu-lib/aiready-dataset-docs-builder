// Schema-validity tests for the discipline-validator registry (validators.json).
// Run with:  npm test   (vitest run)
//
// Ported to vitest: the test runner comes from 'vitest'; assertions stay on
// node:assert/strict so the logic is byte-identical to the pre-scaffold version.

import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaDir = join(__dirname, '..', 'src', 'schema');

const loadJson = async (name) =>
  JSON.parse(await readFile(join(schemaDir, name), 'utf8'));

const registry = await loadJson('validators.json');

const VALID_EXECUTION = new Set(['in-browser', 'cli', 'web-service']);
const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;
const looksLikeUrl = (v) => typeof v === 'string' && /^https?:\/\//.test(v);

test('registry declares a version and non-empty validators and registries arrays', () => {
  assert.ok(isNonEmptyString(registry.version), 'missing version');
  assert.ok(Array.isArray(registry.validators) && registry.validators.length > 0, 'validators must be a non-empty array');
  assert.ok(Array.isArray(registry.registries) && registry.registries.length > 0, 'registries must be a non-empty array');
});

test('every validator has a unique id', () => {
  const ids = registry.validators.map((v) => v.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual(dupes, [], `duplicate validator ids: ${dupes.join(', ')}`);
});

test('every validator declares the required fields', () => {
  for (const v of registry.validators) {
    for (const field of ['id', 'discipline', 'standard', 'standard_url', 'validator_name', 'validator_url', 'execution', 'note']) {
      assert.ok(isNonEmptyString(v[field]), `validator ${v.id ?? '(no id)'} missing/empty field ${field}`);
    }
    assert.ok(looksLikeUrl(v.standard_url), `validator ${v.id} standard_url is not a URL`);
    assert.ok(looksLikeUrl(v.validator_url), `validator ${v.id} validator_url is not a URL`);
  }
});

test('applies_to is a non-empty array of strings', () => {
  for (const v of registry.validators) {
    assert.ok(Array.isArray(v.applies_to) && v.applies_to.length > 0, `validator ${v.id} applies_to must be non-empty`);
    for (const t of v.applies_to) {
      assert.ok(isNonEmptyString(t), `validator ${v.id} applies_to has a non-string tag`);
    }
  }
});

test('every validator execution mode is one of in-browser | cli | web-service', () => {
  for (const v of registry.validators) {
    assert.ok(VALID_EXECUTION.has(v.execution), `validator ${v.id} has invalid execution: ${v.execution}`);
  }
});

test('reference_doi, when present, is a non-empty string', () => {
  for (const v of registry.validators) {
    if (v.reference_doi === undefined) continue;
    assert.ok(isNonEmptyString(v.reference_doi), `validator ${v.id} has an empty reference_doi`);
  }
});

test('every registry entry has a unique id, a name, and a resolvable-looking URL', () => {
  const ids = registry.registries.map((r) => r.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual(dupes, [], `duplicate registry ids: ${dupes.join(', ')}`);
  for (const r of registry.registries) {
    assert.ok(isNonEmptyString(r.id), 'registry entry missing id');
    assert.ok(isNonEmptyString(r.name), `registry ${r.id} missing name`);
    assert.ok(looksLikeUrl(r.url), `registry ${r.id} url is not a URL`);
  }
});
