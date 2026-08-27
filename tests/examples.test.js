// Quality gate for the worked examples: valid shape + ids, and each example
// produces its intended verdict (computed with the real validators).
// Run with:  npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';

import { EXAMPLES } from '../src/examples/index.js';
import matrix from '../src/schema/matrix.json';
import pathwaysData from '../src/schema/pathways.json';
import { pathwayVerdict } from '../src/lib/pathway.js';
import { validationResults } from '../src/lib/validation.js';
import { effectiveCroissant, declaredMime } from '../src/generators/croissant.js';
import { validateCroissant } from '../src/lib/croissantValidation.js';

const overlayIds = pathwaysData.sub_domains.flatMap((s) => s.overlay.map((o) => o.id));
const validIds = new Set([...matrix.criteria.map((c) => c.id), ...overlayIds]);

test('seven examples with unique ids and valid pathways/stage', () => {
  assert.equal(EXAMPLES.length, 7);
  assert.equal(new Set(EXAMPLES.map((e) => e.id)).size, 7);
  for (const e of EXAMPLES) {
    assert.ok(['A', 'B', 'C'].includes(e.record.pathway), `${e.id}: bad pathway`);
    assert.equal(e.record.schema_version, 'assessment_record_v0', `${e.id}: bad schema_version`);
  }
});

test('every answer id resolves to a real criterion or overlay', () => {
  for (const e of EXAMPLES) {
    for (const id of Object.keys(e.record.answers)) {
      assert.ok(validIds.has(id), `${e.id}: unknown criterion id ${id}`);
    }
  }
});

test('each example produces its intended verdict (via the real validators)', () => {
  for (const e of EXAMPLES) {
    const r = e.record;
    const results = validationResults(r);
    const v = pathwayVerdict(r.pathway, r.answers, r.sub_domain, results, r.stage);
    const detail = `${e.id}: met=${v.met} ${v.satisfiedCount}/${v.requiredCount} bottlenecks=[${v.bottlenecks}]`;

    assert.equal(v.met, e.expectMet, detail);
    if (e.expectMet) {
      assert.equal(v.satisfiedCount, v.requiredCount, `${detail} — expected all required satisfied`);
    }
    if (e.expectBottleneck) {
      assert.ok(v.bottlenecks.includes(e.expectBottleneck), `${detail} — expected ${e.expectBottleneck}`);
    }
  }
});

// The materials example is the only one built through the Croissant builder
// rather than a pinned descriptor — it exercises model -> descriptor composition
// end to end, which no other example does.
test('the materials example composes a loadable descriptor from its builder model', () => {
  const ex = EXAMPLES.find((e) => e.id === 'alpha-quartz-xrd');
  assert.ok(ex, 'materials example missing');
  assert.equal(ex.record.croissant, null, 'it must not pin a raw override');
  assert.equal(ex.record.croissant_model.files.length, 2);

  const desc = effectiveCroissant(ex.record);
  const res = validateCroissant(desc, { expectedMime: declaredMime(ex.record) });
  assert.deepEqual(res.errors, []);
  assert.ok(res.valid && res.loadable, 'the builder model must yield a loadable descriptor');

  // Composed, not hand-written: @ids derive from the file names, and every field
  // resolves to a declared file.
  const ids = desc.distribution.map((d) => d['@id']);
  assert.deepEqual(ids, ['patterns.csv', 'alpha_quartz_relaxed.cif']);
  for (const f of desc.recordSet[0].field) {
    assert.ok(ids.includes(f.source.fileObject['@id']));
  }
  // The declared CIF encoding is present, so the cross-check stays quiet.
  assert.ok(!res.warnings.some((w) => /declares encodingFormat/.test(w)));
});
