// Unit tests for the conformance report. Run with:  npm test
//
// v2 covers every required criterion rather than the automated subset, so the
// tests below check two things the v1 shape could not express: that each mode
// reports in its own vocabulary, and that a declaration is never dressed up as a
// verified result.

import { test } from 'vitest';
import assert from 'node:assert/strict';

import { buildConformanceReport, CONFORMANCE_VERSION } from '../src/lib/report.js';
import { requiredCriteria } from '../src/lib/pathway.js';

const FIXED = '2026-07-16T00:00:00.000Z';
const AUTOMATED_ONLY = new Set(['pass', 'fail', 'pending']);

test('Pathway A: 5 automated checks, all failing on empty answers', () => {
  const rep = buildConformanceReport({ pathway: 'A', sub_domain: null, answers: {} }, { now: FIXED });
  assert.equal(rep.schema_version, CONFORMANCE_VERSION);
  assert.equal(rep.summary.automated.total, 5); // persistent_id, landing_page, license, open_format, loadable
  assert.equal(rep.summary.automated.pass, 0);
  assert.equal(rep.summary.automated.fail, 5);
  assert.equal(rep.summary.automated.pending, 0);
  assert.equal(rep.croissant.valid, false);
});

test('Pathway A: valid answers flip the automated checks to pass', () => {
  const record = {
    pathway: 'A',
    sub_domain: null,
    answers: {
      'fairness.l1.persistent_id': { value: '10.5281/zenodo.123' },
      'fairness.l1.landing_page': { value: 'https://example.org/ds' },
      'fairness.l1.license_explicit': { value: 'CC-BY-4.0' },
      'sustainability.l1.open_format': { value: 'Parquet' },
    },
  };
  const rep = buildConformanceReport(record, { now: FIXED });
  assert.equal(rep.summary.automated.pass, 5); // the 4 grounded + loadable (cross-refs format)
  assert.equal(rep.summary.automated.fail, 0);
});

test('Pathway C: every required criterion appears exactly once', () => {
  const rep = buildConformanceReport(
    { pathway: 'C', sub_domain: 'general', answers: {} },
    { now: FIXED },
  );
  const expected = requiredCriteria('C', 'general').map((c) => c.id).sort();
  const got = rep.criteria.map((c) => c.criterion).sort();
  assert.deepEqual(got, expected);
  assert.equal(rep.summary.total, expected.length);
  assert.equal(
    rep.summary.automated.total + rep.summary.attested.total + rep.summary.manual.total,
    rep.summary.total,
  );
});

test('a declaration is never reported as a verified result', () => {
  // The invariant the per-mode vocabulary exists to protect: if an attested or
  // manual criterion could carry 'pass', the report would assert that something was
  // checked when nothing was.
  const rep = buildConformanceReport(
    { pathway: 'C', sub_domain: 'clinical', answers: {} },
    { now: FIXED },
  );
  for (const c of rep.criteria) {
    if (c.mode === 'automated') {
      assert.ok(AUTOMATED_ONLY.has(c.status) || c.status === 'upcoming', `${c.criterion}: ${c.status}`);
    } else {
      assert.ok(
        !AUTOMATED_ONLY.has(c.status),
        `${c.criterion} is ${c.mode} but reports "${c.status}", which claims a check ran`,
      );
    }
    if (c.mode === 'attested') {
      assert.ok(['declared', 'undeclared', 'upcoming'].includes(c.status), `${c.criterion}: ${c.status}`);
    }
    if (c.mode === 'manual') {
      assert.ok(['recorded', 'unrecorded', 'upcoming'].includes(c.status), `${c.criterion}: ${c.status}`);
    }
  }
});

test('every entry carries the sentence saying what confirms it', () => {
  // The report is meant to be readable without the paper or the app beside it.
  const rep = buildConformanceReport(
    { pathway: 'C', sub_domain: 'materials', answers: {} },
    { now: FIXED },
  );
  for (const c of rep.criteria) {
    assert.ok(c.confirms && c.confirms.length > 30, `${c.criterion} has no confirms text`);
    assert.ok(c.mode && c.dimension && c.level, `${c.criterion} is missing its classification`);
  }
  // The materials overlay is where validator links cluster, so they should survive
  // into the report rather than staying an app-only affordance.
  assert.ok(rep.criteria.some((c) => Array.isArray(c.validators) && c.validators.length > 0));
});

test('an attested answer carries its evidence link; a manual one carries its note', () => {
  const record = {
    pathway: 'C',
    sub_domain: 'general',
    answers: {
      'characterization.l3.bias_audit': {
        value: 'Audited with Aequitas',
        notes: 'https://example.org/reports/bias-audit.html',
      },
      'ethics.l3.oversight_documented': {
        value: 'IRB 2024-1183, approved 2024-03-11',
        notes: 'Reviewed by the governance officer on deposit.',
      },
    },
  };
  const rep = buildConformanceReport(record, { now: FIXED });
  const by = Object.fromEntries(rep.criteria.map((c) => [c.criterion, c]));

  assert.equal(by['characterization.l3.bias_audit'].status, 'declared');
  assert.equal(by['characterization.l3.bias_audit'].evidence, 'https://example.org/reports/bias-audit.html');
  assert.equal(rep.summary.attested.with_evidence, 1);

  assert.equal(by['ethics.l3.oversight_documented'].status, 'recorded');
  assert.equal(by['ethics.l3.oversight_documented'].note, 'Reviewed by the governance officer on deposit.');
  // A manual criterion has no `evidence` key: there is no external report behind a
  // judgement, and pretending otherwise is the confusion this separation avoids.
  assert.equal(by['ethics.l3.oversight_documented'].evidence, undefined);
});

test('criteria not yet due are reported as upcoming, not as failures', () => {
  // At the planning stage most of the assessment is not answerable yet. Reporting
  // those as unmet would read as a bad dataset rather than an early one.
  const rep = buildConformanceReport(
    { pathway: 'B', sub_domain: null, stage: 'plan', answers: {} },
    { now: FIXED },
  );
  const upcoming = rep.criteria.filter((c) => c.status === 'upcoming');
  assert.ok(upcoming.length > 0, 'nothing marked upcoming at the planning stage');
  assert.equal(rep.summary.upcoming, upcoming.length);
  for (const c of upcoming) {
    assert.match(c.message, /Not due at this stage/);
  }
});

test('the ladder still travels with the report', () => {
  // v2 changed the criteria array; the machine-actionability block is untouched.
  const rep = buildConformanceReport({ pathway: 'C', sub_domain: 'general', answers: {} }, { now: FIXED });
  assert.ok(rep.ladder.degrees.length === 5);
  assert.equal(rep.ladder.croissant.executable.status, 'out-of-scope');
  assert.ok(rep.ladder.provo);
});
