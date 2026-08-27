// Schema-validity tests for the AI-readiness matrix and pathways.
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

const matrix = await loadJson('matrix.json');
const pathways = await loadJson('pathways.json');
const vocabularies = await loadJson('vocabularies.json');
const references = await loadJson('references.json');
const validators = await loadJson('validators.json');
const guidanceDoc = await loadJson('guidance.json');

const VALID_PATHWAYS = new Set(['A', 'B', 'C']);
const VALID_LEVELS = new Set(['L1', 'L2', 'L3']);
const VALID_EVIDENCE_TYPES = new Set([
  'boolean',
  'text',
  'uri',
  'identifier',
  'file',
  'controlled_vocabulary',
]);
const VALID_VERIFICATION = new Set(['automated', 'attested', 'manual']);
const VALID_LIFECYCLE_STAGE = new Set([
  'acquisition',
  'curation',
  'documentation',
  'governance',
  'release',
]);
const REQUIRED_DIMENSIONS = [
  'FAIRness',
  'Provenance',
  'Characterization',
  'Ethics',
  'Pre-model Explainability',
  'Sustainability',
  'Computability',
];

const cumulativeExpected = (level) => {
  if (level === 'L1') return ['A', 'B', 'C'];
  if (level === 'L2') return ['B', 'C'];
  if (level === 'L3') return ['C'];
  throw new Error(`unknown level ${level}`);
};

test('matrix declares the seven Bridge2AI dimensions and three levels', () => {
  assert.deepEqual(matrix.dimensions, REQUIRED_DIMENSIONS);
  assert.deepEqual(
    matrix.levels.map((l) => l.id),
    ['L1', 'L2', 'L3'],
  );
});

test('every dimension × level cell has at least one criterion', () => {
  const seen = new Set();
  for (const c of matrix.criteria) {
    seen.add(`${c.dimension}::${c.level}`);
  }
  for (const dim of REQUIRED_DIMENSIONS) {
    for (const lvl of ['L1', 'L2', 'L3']) {
      assert.ok(
        seen.has(`${dim}::${lvl}`),
        `missing criterion for cell ${dim} / ${lvl}`,
      );
    }
  }
});

test('every criterion has a unique id', () => {
  const ids = matrix.criteria.map((c) => c.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual(dupes, [], `duplicate criterion ids: ${dupes.join(', ')}`);
});

test('criterion ids follow the dimension.level.slug convention', () => {
  for (const c of matrix.criteria) {
    assert.match(
      c.id,
      /^[a-z_]+\.l[123]\.[a-z0-9_]+$/,
      `criterion id ${c.id} does not match dimension.level.slug`,
    );
  }
});

test('every criterion declares a known dimension, level, and evidence_type', () => {
  for (const c of matrix.criteria) {
    assert.ok(
      REQUIRED_DIMENSIONS.includes(c.dimension),
      `unknown dimension on ${c.id}: ${c.dimension}`,
    );
    assert.ok(VALID_LEVELS.has(c.level), `unknown level on ${c.id}: ${c.level}`);
    assert.ok(
      VALID_EVIDENCE_TYPES.has(c.evidence_type),
      `unknown evidence_type on ${c.id}: ${c.evidence_type}`,
    );
  }
});

test('every criterion declares a valid verification mode', () => {
  for (const c of matrix.criteria) {
    assert.ok(
      VALID_VERIFICATION.has(c.verification),
      `${c.id} has invalid or missing verification mode: ${c.verification}`,
    );
  }
});

test('every criterion declares a valid lifecycle_stage', () => {
  for (const c of matrix.criteria) {
    assert.ok(
      VALID_LIFECYCLE_STAGE.has(c.lifecycle_stage),
      `${c.id} has invalid or missing lifecycle_stage: ${c.lifecycle_stage}`,
    );
  }
});

test('Ethics criteria are never automated (ethics adequacy is human-judged)', () => {
  for (const c of matrix.criteria) {
    if (c.dimension !== 'Ethics') continue;
    assert.notEqual(
      c.verification,
      'automated',
      `${c.id} is an Ethics criterion marked automated; ethics must be attested or manual`,
    );
  }
});

test('every required_in_pathways list contains only A, B, or C', () => {
  for (const c of matrix.criteria) {
    assert.ok(Array.isArray(c.required_in_pathways), `${c.id} missing required_in_pathways`);
    for (const p of c.required_in_pathways) {
      assert.ok(VALID_PATHWAYS.has(p), `${c.id} required_in_pathways has invalid value ${p}`);
    }
  }
});

test('cumulative semantics: L1→ABC, L2→BC, L3→C', () => {
  for (const c of matrix.criteria) {
    const expected = cumulativeExpected(c.level);
    assert.deepEqual(
      [...c.required_in_pathways].sort(),
      expected,
      `${c.id} (level ${c.level}) should be required in ${expected.join(',')} but is required in ${c.required_in_pathways.join(',')}`,
    );
  }
});

test('recommended_in_pathways (when present) only contains valid pathways and never overlaps required_in_pathways', () => {
  for (const c of matrix.criteria) {
    if (!c.recommended_in_pathways) continue;
    for (const p of c.recommended_in_pathways) {
      assert.ok(VALID_PATHWAYS.has(p), `${c.id} recommended_in_pathways has invalid value ${p}`);
      assert.ok(
        !c.required_in_pathways.includes(p),
        `${c.id} marks pathway ${p} both required and recommended`,
      );
    }
  }
});

test('controlled_vocabulary criteria reference an existing vocabulary_key', () => {
  for (const c of matrix.criteria) {
    if (c.evidence_type !== 'controlled_vocabulary') continue;
    assert.ok(c.vocabulary_key, `${c.id} is controlled_vocabulary but has no vocabulary_key`);
    assert.ok(
      Object.prototype.hasOwnProperty.call(vocabularies.vocabularies, c.vocabulary_key),
      `${c.id} references unknown vocabulary_key ${c.vocabulary_key}`,
    );
  }
});

test('collection_hint, when present, is prose distinct from remediation', () => {
  // The two answer different questions: collection_hint is the observation to
  // record at the time, remediation is how to close the gap afterwards. If they
  // are identical the hint adds nothing and should be dropped rather than faked.
  const check = (c, where) => {
    if (c.collection_hint === undefined) return;
    assert.ok(
      typeof c.collection_hint === 'string' && c.collection_hint.trim().length > 20,
      `${where} ${c.id} has an empty or trivial collection_hint`,
    );
    assert.notEqual(
      c.collection_hint.trim(),
      (c.remediation ?? '').trim(),
      `${where} ${c.id} duplicates remediation as its collection_hint`,
    );
  };
  for (const c of matrix.criteria) check(c, 'criterion');
  const cPath = pathways.pathways.find((p) => p.id === 'C');
  for (const sub of pathways.sub_domains) for (const o of sub.overlay) check(o, 'overlay');
});

test('vocabulary_scope, when present, names a supported resolver', () => {
  // A criterion may defer its option list to the pathway / sub-domain instead of
  // its static vocabulary_key. Only one resolver exists today; a typo here would
  // silently fall back to the static key, which is the bug this guards.
  const SUPPORTED = new Set(['deposition_targets']);
  for (const c of matrix.criteria) {
    if (c.vocabulary_scope === undefined) continue;
    assert.ok(
      SUPPORTED.has(c.vocabulary_scope),
      `${c.id} declares unsupported vocabulary_scope ${c.vocabulary_scope}`,
    );
    assert.equal(
      c.evidence_type,
      'controlled_vocabulary',
      `${c.id} declares vocabulary_scope but is not a controlled_vocabulary criterion`,
    );
  }
});

test('sub-domain deposition_targets_filter ids resolve in some repositories_* vocabulary', () => {
  const repoIds = new Set(
    Object.entries(vocabularies.vocabularies)
      .filter(([k]) => k.startsWith('repositories_'))
      .flatMap(([, v]) => v.values.map((x) => x.id)),
  );
  const c = pathways.pathways.find((p) => p.id === 'C');
  for (const sub of pathways.sub_domains) {
    for (const id of sub.deposition_targets_filter ?? []) {
      assert.ok(
        repoIds.has(id),
        `sub-domain ${sub.id} filter names ${id}, which is in no repositories_* vocabulary`,
      );
    }
  }
});

test('every references[] citation key resolves in references.json', () => {
  const known = new Set(Object.keys(references.citations));
  for (const c of matrix.criteria) {
    assert.ok(Array.isArray(c.references) && c.references.length > 0, `${c.id} has no references`);
    for (const r of c.references) {
      assert.ok(known.has(r), `${c.id} cites unknown reference ${r}`);
    }
  }
});

test('every criterion declares a capture moment or states its absence', () => {
  // The capture axis, made total. Before this, 32 of 72 criteria declared neither and
  // the guide silently substituted `remediation` — text addressed to a reviewer
  // fixing a release, printed in a worksheet about what to write down beforehand.
  // Exactly one of the two fields, so "nothing to capture" is a decision on record
  // rather than an omission.
  const overlays = pathways.sub_domains.flatMap((s) => s.overlay ?? []);

  for (const c of [...matrix.criteria, ...overlays]) {
    const hasHint = typeof c.collection_hint === 'string';
    const hasNone = typeof c.no_capture === 'string';
    assert.ok(
      hasHint !== hasNone,
      `${c.id} must declare either collection_hint or no_capture, not ${hasHint ? 'both' : 'neither'}`,
    );
    if (hasNone) {
      assert.ok(
        c.no_capture.trim().length > 20,
        `${c.id} no_capture must say why there is nothing to record`,
      );
      assert.notEqual(c.no_capture.trim(), (c.remediation ?? '').trim());
      // The capture axis and the verification axis are independent: a record count is
      // human-confirmed against the released files and still has nothing to capture
      // during collection. What a stated absence cannot be is a criterion at the
      // acquisition or curation stage, because those are the moments the guide calls
      // irrecoverable — if the observation is only available while the work happens,
      // there is by definition something to write down.
      assert.ok(
        !['acquisition', 'curation'].includes(c.lifecycle_stage),
        `${c.id} sits at the ${c.lifecycle_stage} stage, which cannot be revisited, so it needs a collection_hint`,
      );
    }
  }
});

test('every criterion says what would confirm it', () => {
  // The schema had a capture axis (collection_hint: what to record) and no
  // verification axis, so 59 of 72 criteria declared a mode and named no check.
  // A chip reading "attested" without this is a label, not guidance.
  const overlays = pathways.sub_domains.flatMap((s) => s.overlay ?? []);

  for (const c of [...matrix.criteria, ...overlays]) {
    assert.ok(
      typeof c.verification_hint === 'string' && c.verification_hint.trim().length > 30,
      `${c.id} has no verification_hint`,
    );
    // The hint has to speak in the voice of its mode, or the three modes collapse
    // back into an undifferentiated chip.
    if (c.verification === 'automated') {
      assert.match(c.verification_hint, /^The tool checks|^The tool infers|^The tool validates|^The tool counts/,
        `${c.id} is automated; its hint should state what the tool checks`);
    }
    if (c.verification === 'attested') {
      assert.match(c.verification_hint, /You declare/,
        `${c.id} is attested; its hint should name the evidence backing the declaration`);
    }
    if (c.verification === 'manual') {
      assert.match(c.verification_hint, /confirms|agree on/,
        `${c.id} is manual; its hint should name who confirms it and how`);
    }
  }
});

test('validators named by a criterion resolve in the registry', () => {
  // Same contract as `references`: a link to a tool that is not in validators.json
  // would render as a suggestion the user cannot act on.
  const known = new Set(validators.validators.map((v) => v.id));
  const overlays = pathways.sub_domains.flatMap((s) => s.overlay ?? []);

  let linked = 0;
  for (const c of [...matrix.criteria, ...overlays]) {
    if (!c.validators) continue;
    assert.ok(Array.isArray(c.validators) && c.validators.length > 0, `${c.id} has an empty validators array`);
    for (const v of c.validators) {
      assert.ok(known.has(v), `${c.id} names unknown validator "${v}"`);
    }
    linked += 1;
  }
  // A guard against the field silently falling out of use as criteria are edited.
  assert.ok(linked >= 8, `only ${linked} criteria link a validator; the registry is going unused`);
});

test('every automated criterion has a wired check, overlays included', async () => {
  // 'automated' is a promise that something runs. Three overlay criteria were
  // promoted to automated in 0.5.0 on the strength of a syntactic check; if one of
  // those checks is ever removed, the badge would keep claiming a validator that
  // no longer exists.
  const { AUTOMATED_WITH_VALIDATOR } = await import('../src/lib/validation.js');
  const overlays = pathways.sub_domains.flatMap((s) => s.overlay ?? []);

  for (const c of [...matrix.criteria, ...overlays]) {
    if (c.verification !== 'automated') continue;
    assert.ok(
      AUTOMATED_WITH_VALIDATOR.has(c.id),
      `${c.id} is marked automated but no check is wired in lib/validation.js`,
    );
  }
});

test('every cell of the paper matrix has text, and every criterion lands in one', () => {
  // The matrix has 21 cells and more criteria than that, so the expansion has to
  // be auditable in both directions: no cell without criteria (a requirement the
  // paper states and the tool never asks about) and no criterion outside a
  // declared cell (a requirement the tool invents).
  const dimensions = matrix.dimensions;
  const levels = matrix.levels.map((l) => l.id);

  assert.equal(Object.keys(matrix.cells).length, dimensions.length);
  for (const d of dimensions) {
    assert.ok(matrix.cells[d], `no cells declared for ${d}`);
    for (const l of levels) {
      const text = matrix.cells[d][l];
      assert.ok(typeof text === 'string' && text.trim() !== '', `cell ${d}/${l} has no text`);
    }
  }

  const populated = new Set();
  for (const c of matrix.criteria) {
    assert.ok(matrix.cells[c.dimension]?.[c.level], `${c.id} sits outside any declared cell`);
    populated.add(`${c.dimension}/${c.level}`);
  }
  const empty = dimensions
    .flatMap((d) => levels.map((l) => `${d}/${l}`))
    .filter((cell) => !populated.has(cell));
  assert.deepEqual(empty, [], `cells with no criteria: ${empty.join(', ')}`);
});

test('a criterion the cell text does not name is attributed to the paper', () => {
  // `beyond_cell` is the audit trail: it says where a requirement comes from when
  // the matrix cell does not name it. Attribution is mandatory — an unexplained
  // extra requirement is indistinguishable from scope creep.
  for (const c of matrix.criteria) {
    if (!c.beyond_cell) continue;
    const { source, note } = c.beyond_cell;
    assert.ok(
      typeof source === 'string' && /Table|Figure|§/.test(source),
      `${c.id} beyond_cell.source must point at a table, figure, or section: ${source}`,
    );
    assert.ok(
      typeof note === 'string' && note.trim().length > 40,
      `${c.id} beyond_cell.note must say why the criterion exists`,
    );
  }
});

test('every citation in the paper bibliography is actually cited by the tool', () => {
  // The registry mirrors the paper's bibliography, which makes it easy for an entry to
  // be renumbered and maintained while nothing in the tool ever refers to it. Three
  // sat that way — the Data Cards Playbook, the GPT-5.5 system card, and Raza et al. —
  // numbered, resolvable, and pointing at nothing.
  const cited = new Set();
  const overlays = pathways.sub_domains.flatMap((s) => s.overlay ?? []);
  for (const c of [...matrix.criteria, ...overlays]) {
    for (const r of c.references ?? []) cited.add(r);
  }
  for (const p of pathways.pathways) for (const r of p.references ?? []) cited.add(r);

  // guidance.json carries references on several blocks, under two naming conventions.
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node)) {
      if ((k === 'references' || k.endsWith('_references')) && Array.isArray(v)) v.forEach((r) => cited.add(r));
      else walk(v);
    }
  };
  walk(guidanceDoc);

  const uncited = Object.entries(references.citations)
    .filter(([, c]) => c.ref !== undefined)
    .map(([key]) => key)
    .filter((key) => !cited.has(key));
  assert.deepEqual(uncited, [], `numbered but cited by nothing: ${uncited.join(', ')}`);
});

test('reference numbering is contiguous and mirrors the paper bibliography', () => {
  // The References page sorts on `ref`, and the rendered <ol> markers only agree
  // with the paper's bracketed numbers while these are 1..N with no gaps. They
  // silently drifted once when a section was inserted into the manuscript and
  // every entry after it shifted by one, so the invariant is asserted here.
  const entries = Object.entries(references.citations);
  const numbered = entries.filter(([, c]) => c.ref !== undefined);
  const refs = numbered.map(([, c]) => c.ref).sort((a, b) => a - b);

  assert.deepEqual(
    refs,
    refs.map((_, i) => i + 1),
    `reference numbers are not contiguous 1..${refs.length}: ${refs.join(', ')}`,
  );

  // An entry is in the paper's bibliography (has a `ref`) or is cited only by a
  // sub-domain overlay (has a `source` tag) — never both, never neither.
  for (const [key, c] of entries) {
    const hasRef = c.ref !== undefined;
    const hasSource = c.source !== undefined;
    assert.ok(
      hasRef !== hasSource,
      `${key} must carry either a 'ref' (in the paper's bibliography) or a 'source' tag (outside it), not ${
        hasRef ? 'both' : 'neither'
      }`,
    );
  }
});

test('every criterion has a non-empty label and remediation', () => {
  for (const c of matrix.criteria) {
    assert.ok(typeof c.label === 'string' && c.label.length > 0, `${c.id} missing label`);
    assert.ok(
      typeof c.remediation === 'string' && c.remediation.length > 0,
      `${c.id} missing remediation`,
    );
  }
});

test('pathways A/B/C are declared with the expected level mapping', () => {
  const byId = Object.fromEntries(pathways.pathways.map((p) => [p.id, p]));
  assert.equal(byId.A?.level, 'L1');
  assert.equal(byId.B?.level, 'L2');
  assert.equal(byId.C?.level, 'L3');
  assert.equal(byId.A?.drl_band, 'C');
  assert.equal(byId.B?.drl_band, 'B');
  assert.equal(byId.C?.drl_band, 'A');
});

test('pathway deposition_targets_vocabulary keys resolve in vocabularies.json', () => {
  for (const p of pathways.pathways) {
    if (!p.deposition_targets_vocabulary) continue;
    assert.ok(
      Object.prototype.hasOwnProperty.call(vocabularies.vocabularies, p.deposition_targets_vocabulary),
      `pathway ${p.id} references unknown vocabulary ${p.deposition_targets_vocabulary}`,
    );
  }
});

test('Pathway C declares six sub-domains including the resolved set', () => {
  const c = pathways.pathways.find((p) => p.id === 'C');
  assert.ok(c, 'Pathway C missing');
  assert.equal(pathways.sub_domains.length, 6, 'expected exactly six sub-domains');
  const ids = pathways.sub_domains.map((s) => s.id).sort();
  assert.deepEqual(
    ids,
    ['clinical', 'general', 'genomic', 'institutional', 'materials', 'voice'],
    `unexpected sub-domain set: ${ids.join(', ')}`,
  );
  assert.ok(
    ids.includes(c.default_sub_domain),
    `default_sub_domain ${c.default_sub_domain} not in sub-domain list`,
  );
});

test('Pathway C overlays sit at L3, in a known dimension, and resolve their vocabulary and citations', () => {
  const c = pathways.pathways.find((p) => p.id === 'C');
  for (const sub of pathways.sub_domains) {
    assert.ok(Array.isArray(sub.overlay), `sub-domain ${sub.id} has no overlay array`);
    for (const o of sub.overlay) {
      assert.ok(
        REQUIRED_DIMENSIONS.includes(o.dimension),
        `overlay ${o.id} (sub-domain ${sub.id}) declares unknown dimension ${o.dimension}`,
      );
      // Overlays used to be L3-only, which tied a discipline's governance evidence
      // to the actionability level. Since 0.6.0 each takes the level of the base
      // criterion it mirrors and obeys the same cumulative rule, so a clinical
      // dataset aimed at L2 picks up its L1 and L2 obligations and not the L3 ones.
      assert.ok(VALID_LEVELS.has(o.level), `overlay ${o.id} has an unknown level ${o.level}`);
      assert.deepEqual(
        [...o.required_in_pathways].sort(),
        cumulativeExpected(o.level),
        `overlay ${o.id} (level ${o.level}) breaks the cumulative rule`,
      );
      // The id encodes the level, for overlays as for base criteria.
      assert.ok(
        o.id.includes(`.${o.level.toLowerCase()}.`),
        `overlay ${o.id} does not carry its level ${o.level} in its id`,
      );
      // Overlays declare a lifecycle stage like every matrix criterion, so the
      // stage-aware locked/upcoming logic treats them the same way. Uniform
      // across all sub-domains: a locked badge appearing under one discipline
      // and not another would read as a bug rather than a statement.
      assert.ok(
        VALID_LIFECYCLE_STAGE.has(o.lifecycle_stage),
        `overlay ${o.id} has invalid or missing lifecycle_stage: ${o.lifecycle_stage}`,
      );
      assert.ok(VALID_EVIDENCE_TYPES.has(o.evidence_type), `overlay ${o.id} evidence_type invalid`);
      // Every overlay declares a mode, like every matrix criterion. This was
      // optional until 0.5.0, and eleven overlays fell through the gap and
      // rendered as 'manual' because that is CriterionField's fallback — the mode
      // was an accident of the default rather than a decision.
      assert.ok(
        VALID_VERIFICATION.has(o.verification),
        `overlay ${o.id} has invalid or missing verification mode: ${o.verification}`,
      );
      // Ethics *adequacy* is human-judged and never automated: no validator settles
      // whether a consent basis is sufficient or a review was thorough. What may be
      // automated is the syntax of an identifier or a link the ethics evidence points
      // at — a dbGaP accession, a DUA URL — which is a check on the pointer, not on
      // the judgement. So the constraint is scoped to the evidence type rather than
      // to the dimension.
      if (o.dimension === 'Ethics' && o.verification === 'automated') {
        assert.ok(
          ['identifier', 'uri'].includes(o.evidence_type),
          `overlay ${o.id} is automated but its evidence (${o.evidence_type}) is a judgement, not a checkable pointer`,
        );
      }
      assert.ok(
        typeof o.label === 'string' && o.label.length > 0 &&
          typeof o.remediation === 'string' && o.remediation.length > 0,
        `overlay ${o.id} missing label or remediation`,
      );
      if (o.evidence_type === 'controlled_vocabulary') {
        assert.ok(
          Object.prototype.hasOwnProperty.call(vocabularies.vocabularies, o.vocabulary_key),
          `overlay ${o.id} references unknown vocabulary ${o.vocabulary_key}`,
        );
      }
      for (const r of o.references ?? []) {
        assert.ok(
          Object.prototype.hasOwnProperty.call(references.citations, r),
          `overlay ${o.id} cites unknown reference ${r}`,
        );
      }
    }
  }
});

test('sub-domain deposition_targets_vocabulary keys resolve in vocabularies.json', () => {
  const c = pathways.pathways.find((p) => p.id === 'C');
  for (const sub of pathways.sub_domains) {
    if (!sub.deposition_targets_vocabulary) continue;
    assert.ok(
      Object.prototype.hasOwnProperty.call(vocabularies.vocabularies, sub.deposition_targets_vocabulary),
      `sub-domain ${sub.id} references unknown vocabulary ${sub.deposition_targets_vocabulary}`,
    );
  }
});

test('Pathway C overlay ids are unique across all sub-domains and do not collide with matrix criterion ids', () => {
  const matrixIds = new Set(matrix.criteria.map((c) => c.id));
  const c = pathways.pathways.find((p) => p.id === 'C');
  const seen = new Set();
  for (const sub of pathways.sub_domains) {
    for (const o of sub.overlay) {
      assert.ok(!seen.has(o.id), `duplicate overlay id ${o.id}`);
      seen.add(o.id);
      assert.ok(!matrixIds.has(o.id), `overlay id ${o.id} collides with a matrix criterion id`);
    }
  }
});

test('format vocabularies pair mime with ext, and declare plausible media types', () => {
  const formatKeys = Object.keys(vocabularies.vocabularies).filter((k) => k.startsWith('formats_'));
  assert.ok(formatKeys.length > 0, 'no formats_* vocabularies found');
  for (const key of formatKeys) {
    for (const v of vocabularies.vocabularies[key].values) {
      const hasMime = v.mime !== undefined;
      const hasExt = v.ext !== undefined;
      // Either both facets are present (used together to seed a Croissant
      // distribution entry) or neither — e.g. a BIDS directory has no single
      // media type, so it declares nothing rather than half a pair.
      assert.equal(
        hasMime,
        hasExt,
        `${key}/${v.id} declares only one of mime/ext; they are used together`,
      );
      if (hasMime) {
        assert.match(v.mime, /^[a-z]+\/[a-zA-Z0-9.+-]+$/, `${key}/${v.id} mime is not a media type`);
        assert.match(v.ext, /^[a-z0-9.]+$/, `${key}/${v.id} ext is not a bare extension`);
      }
    }
  }
});

test('vocabulary entries each have a non-empty values array', () => {
  for (const [key, vocab] of Object.entries(vocabularies.vocabularies)) {
    assert.ok(Array.isArray(vocab.values) && vocab.values.length > 0, `vocabulary ${key} has no values`);
    const ids = vocab.values.map((v) => v.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    assert.deepEqual(dupes, [], `vocabulary ${key} has duplicate ids: ${dupes.join(', ')}`);
  }
});

test('label_overrides target real criteria and only reword them', () => {
  const ids = new Set(matrix.criteria.map((c) => c.id));
  const c = pathways.pathways.find((p) => p.id === 'C');
  const REWORDABLE = new Set(['label', 'remediation']);
  for (const sub of pathways.sub_domains) {
    for (const [id, patch] of Object.entries(sub.label_overrides ?? {})) {
      assert.ok(ids.has(id), `sub-domain ${sub.id} overrides unknown criterion ${id}`);
      for (const key of Object.keys(patch)) {
        // Rewording only: an override must never change evidence_type,
        // required_in_pathways, verification, or anything else that would make a
        // criterion mean something different under one sub-domain.
        assert.ok(REWORDABLE.has(key), `sub-domain ${sub.id} override of ${id} changes ${key}`);
        assert.ok(typeof patch[key] === 'string' && patch[key].length > 0, `${id}.${key} is empty`);
      }
    }
  }
});

test('every schema file carries the same version (they move in lockstep)', () => {
  // Versions diverged once (three files at 0.2.0, two at 0.1.0) and it made
  // "which schema is this record written against?" unanswerable. One version for
  // the set; 1.0.0 is cut when the criterion ids are considered stable.
  const versions = [matrix, pathways, vocabularies, references, validators, guidanceDoc].map((f) => f.version);
  assert.equal(new Set(versions).size, 1, `schema versions have diverged: ${versions.join(', ')}`);
  assert.match(versions[0], /^\d+\.\d+\.\d+$/);
});

test('every citation key in guidance.json resolves in references.json', () => {
  // The guide cites the same registry the matrix does, so a key cannot go stale
  // in one and survive in the other.
  const known = new Set(Object.keys(references.citations));
  const check = (keys, where) => {
    for (const k of keys ?? []) assert.ok(known.has(k), `${where} cites unknown reference ${k}`);
  };
  check(guidanceDoc.ladder_references, 'ladder');
  check(guidanceDoc.automation.references, 'automation');
  check(guidanceDoc.wh_questions_references, 'wh_questions');
  check(guidanceDoc.documentation_inputs.references, 'documentation_inputs');
  check(guidanceDoc.ontology_examples_references, 'ontology_examples');
  for (const b of guidanceDoc.burden_reduction) check(b.references, `burden "${b.title}"`);

  // The claims that name specific tools must be attributed; only the two that
  // describe a practice rather than a published system may go uncited.
  const uncited = guidanceDoc.burden_reduction.filter((b) => (b.references ?? []).length === 0);
  assert.ok(uncited.length <= 2, `too many uncited burden items: ${uncited.map((b) => b.title).join(', ')}`);
});
