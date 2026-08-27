// Unit tests for the Phase-1 export generators and the overlay-aware verdict.
// Run with:  npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';

import { pathwayVerdict, cellStatus, requiredCriteria, templateForRecord } from '../src/lib/pathway.js';
import { generateDatasheet } from '../src/generators/datasheet.js';
import { buildAssessmentReport, REPORT_VERSION } from '../src/lib/report.js';

const FIXED = '2026-07-16T00:00:00.000Z';

// ---- overlay-aware verdict ------------------------------------------------

test('requiredCriteria adds Pathway-C overlays for the chosen sub-domain', () => {
  assert.equal(requiredCriteria('A').length, 16);
  assert.equal(requiredCriteria('C', 'general').length, 55);
  assert.equal(requiredCriteria('C', 'clinical').length, 58); // 55 + 3 overlays
});

test('pathwayVerdict counts overlays for Pathway C clinical', () => {
  const v = pathwayVerdict('C', {}, 'clinical');
  assert.equal(v.requiredCount, 58);
  assert.equal(v.met, false);
});

test('cellStatus for Ethics×L3 includes overlays under Pathway C', () => {
  // Empty answers -> unmet; base Ethics L3 alone would also be unmet, so assert
  // that satisfying only base (not overlays) still leaves the cell unmet.
  const base = requiredCriteria('C', 'general').filter(
    (c) => c.dimension === 'Ethics' && c.level === 'L3',
  );
  const answers = Object.fromEntries(
    base.map((c) => [c.id, { value: c.evidence_type === 'boolean' ? true : 'x' }]),
  );
  assert.equal(cellStatus('Ethics', 'L3', 'C', answers, 'clinical'), 'unmet'); // overlays still empty
});

// ---- datasheet ------------------------------------------------------------

test('generateDatasheet renders header, sections, and not-provided placeholders', () => {
  const record = {
    pathway: 'A',
    sub_domain: null,
    answers: {
      'fairness.l1.persistent_id': { value: '10.5281/zenodo.123' },
    },
  };
  const md = generateDatasheet(record, { now: FIXED });
  assert.match(md, /^# Dataset datasheet/);
  assert.match(md, /Assessment pathway:\*\* A — Accessible \(L1\)/);
  assert.match(md, /## FAIRness/);
  assert.match(md, /Persistent identifier assigned[^\n]*10\.5281\/zenodo\.123/);
  assert.match(md, /_not provided_/); // unanswered criteria flagged
});

test('maintenance criteria render once, in their own section after the dimensions', () => {
  // Gebru's template has a Maintenance group, and a reader looks for it by name.
  // Versioning and long-term access are filed under FAIRness and Sustainability in
  // the matrix, so the generator regroups them — without printing them twice,
  // which is the failure mode the dimension-ordered layout exists to avoid.
  const md = generateDatasheet(
    {
      pathway: 'C',
      sub_domain: 'general',
      answers: {
        'sustainability.l2.maintenance_plan': { value: 'Annual refresh; superseded versions kept and marked deprecated; errata to the study inbox.' },
        'fairness.l3.versioned_release': { value: 'Concept DOI plus per-version DOIs on Zenodo.' },
      },
    },
    { now: FIXED },
  );

  const iMaint = md.indexOf('## Maintenance');
  assert.ok(iMaint > -1, 'no Maintenance section');
  assert.ok(iMaint > md.indexOf('## Ethics'), 'Maintenance should follow the dimension sections');

  for (const label of ['Maintenance stated', 'Versioned release', 'Long-term access plan']) {
    const hits = md.split(label).length - 1;
    assert.equal(hits, 1, `"${label}" appears ${hits} times, expected exactly once`);
  }
  assert.match(md, /Annual refresh/);
});

test('generateDatasheet orders Characterization before FAIRness before Ethics', () => {
  const md = generateDatasheet({ pathway: 'C', sub_domain: 'general', answers: {} }, { now: FIXED });
  const iChar = md.indexOf('## Characterization');
  const iFair = md.indexOf('## FAIRness');
  const iEthics = md.indexOf('## Ethics');
  assert.ok(iChar > -1 && iChar < iFair && iFair < iEthics);
});

// ---- healthsheet variant --------------------------------------------------

test('templateForRecord selects healthsheet only for the declaring sub-domains', () => {
  assert.equal(templateForRecord({ pathway: 'C', sub_domain: 'clinical' }), 'healthsheet');
  assert.equal(templateForRecord({ pathway: 'C', sub_domain: 'general' }), 'datasheet');
  assert.equal(templateForRecord({ pathway: 'A', sub_domain: null }), 'datasheet');
});

test('generateDatasheet emits a healthsheet title/preamble for clinical', () => {
  const md = generateDatasheet({ pathway: 'C', sub_domain: 'clinical', answers: {} }, { now: FIXED });
  assert.match(md, /^# Dataset healthsheet/);
  assert.match(md, /Healthsheet.*Rostamzadeh/);
});

test('generateDatasheet stays a datasheet for C general', () => {
  const md = generateDatasheet({ pathway: 'C', sub_domain: 'general', answers: {} }, { now: FIXED });
  assert.match(md, /^# Dataset datasheet/);
  assert.ok(!/healthsheet/i.test(md.split('\n')[0]));
});

// ---- lifecycle limitations ------------------------------------------------

test('Upgrade stage lists unmet locked (acquisition/curation) criteria as limitations', () => {
  const md = generateDatasheet(
    { pathway: 'C', sub_domain: 'general', stage: 'upgrade', answers: {} },
    { now: FIXED },
  );
  assert.match(md, /## Known limitations/);
  assert.match(md, /Consent basis recorded/); // acquisition criterion, unmet + locked
});

test('Plan stage produces no limitations section (nothing locked)', () => {
  const md = generateDatasheet(
    { pathway: 'C', sub_domain: 'general', stage: 'plan', answers: {} },
    { now: FIXED },
  );
  assert.ok(!/## Known limitations/.test(md));
});

// ---- assessment report ----------------------------------------------------

test('buildAssessmentReport wraps record with verdict and metadata', () => {
  const record = { pathway: 'A', sub_domain: null, started_at: FIXED, answers: {} };
  const report = buildAssessmentReport(record, { now: FIXED });
  assert.equal(report.schema_version, REPORT_VERSION);
  assert.equal(report.pathway, 'A');
  assert.equal(report.verdict.required_count, 16);
  assert.equal(report.verdict.satisfied_count, 0);
  assert.equal(report.verdict.met, false);
  assert.deepEqual(report.answers, {});
});

test('each answer states the basis it is given on, and an unmet one claims none', () => {
  // A datasheet is read by someone deciding whether to trust the dataset, so
  // "a validator confirmed this" and "the depositor says so" cannot look the same.
  const md = generateDatasheet(
    {
      pathway: 'C',
      sub_domain: 'general',
      stage: 'upgrade',
      answers: {
        'fairness.l1.persistent_id': { value: '10.5281/zenodo.123' },
        'characterization.l3.bias_audit': { value: 'Audited', notes: 'https://example.org/bias.html' },
        'ethics.l3.oversight_documented': { value: 'IRB 2024-1183' },
      },
    },
    { now: FIXED },
  );

  assert.match(md, /Persistent identifier[^\n]*— _validator-checked_/);
  assert.match(md, /Bias audit[^\n]*— _attested; evidence: https:\/\/example\.org\/bias\.html_/);
  assert.match(md, /Ethics oversight[^\n]*— _human judgement_/);

  // The honesty case: an unanswered criterion has no basis. Tagging it with its
  // mode would assert a judgement nobody made.
  assert.match(md, /Missingness rates per variable:\*\* _not provided_ — _not yet recorded_/);
  // An automated criterion that is simply failing says so rather than going quiet.
  assert.match(md, /Landing page[^\n]*— _validator check not passing_/);

  // And the tags are defined in the document, using the same terms.
  assert.match(md, /## How to read this datasheet/);
  assert.match(md, /\*\*validator-checked\*\* \(automated\)/);
  assert.match(md, /\*\*not yet recorded\*\*/);
});

test('an attested note is the evidence and is not also printed as a remark', () => {
  const md = generateDatasheet(
    {
      pathway: 'C',
      sub_domain: 'general',
      stage: 'upgrade',
      answers: { 'characterization.l3.bias_audit': { value: 'Audited', notes: 'report.pdf' } },
    },
    { now: FIXED },
  );
  const line = md.split('\n').find((l) => l.includes('Bias audit'));
  assert.match(line, /evidence: report\.pdf/);
  assert.ok(!line.includes('(note: report.pdf)'), 'the note is printed twice');
});

test('the datasheet maps Gebru\'s seven groups onto its own sections', () => {
  // A reviewer arrives with the template's headings in mind and finds seven dimensions.
  // The generator deliberately orders by dimension so one criterion is never printed
  // under two headings; the crosswalk is what keeps that navigable rather than opaque.
  const md = generateDatasheet({ pathway: 'C', sub_domain: 'general', answers: {} }, { now: FIXED });

  assert.match(md, /## Where each datasheet question is answered/);
  for (const group of [
    'Motivation',
    'Composition',
    'Collection process',
    'Preprocessing, cleaning, labelling',
    'Uses',
    'Distribution',
    'Maintenance',
  ]) {
    assert.ok(md.includes(`**${group}**`), `missing crosswalk group: ${group}`);
  }
  // Every group points at sections the document actually has.
  const headings = new Set((md.match(/^## (.+)$/gm) ?? []).map((h) => h.slice(3)));
  const crosswalk = md.slice(md.indexOf('## Where each datasheet question is answered')).split('\n## ')[0];
  for (const line of crosswalk.split('\n').filter((l) => l.startsWith('- **'))) {
    for (const section of line.split('→')[1].split(',').map((x) => x.trim())) {
      assert.ok(headings.has(section), `crosswalk points at a section that is not there: ${section}`);
    }
  }
  // And it comes after the content it maps, not before.
  assert.ok(md.indexOf('## Where each datasheet question is answered') > md.indexOf('## Ethics'));
});

test('a declared non-applicability is recorded as such, not as a gap', () => {
  // The route a boolean criterion needs: "no human subjects, so nothing to
  // de-identify" has no checkbox state, and answering "yes" would be a false claim.
  const md = generateDatasheet(
    {
      pathway: 'C',
      sub_domain: 'materials',
      stage: 'upgrade',
      answers: {
        'ethics.l1.de_identification_applied': { not_applicable: true },
        'ethics.l1.consent_basis_recorded': { not_applicable: true },
      },
    },
    { now: FIXED },
  );

  assert.match(md, /Direct identifiers removed or transformed:\*\* _n\/a_ — _not applicable to this dataset_/);
  assert.ok(!md.includes('Direct identifiers removed or transformed:** _not provided_'));
  assert.match(md, /\*\*not applicable to this dataset\*\* — the criterion does not apply here/);
});

test('the datasheet leads with the per-dimension profile', () => {
  // The tier verdict in the header answers whether *every* dimension cleared the target.
  // A deposit can be L3 on four dimensions and L1 on two, which is the case the framework
  // exists to describe, and the artifact a downstream reader opens should say so.
  const md = generateDatasheet(
    {
      pathway: 'C',
      sub_domain: 'materials',
      stage: 'upgrade',
      answers: { 'ethics.l2.de_identification_method': { not_applicable: true } },
    },
    { now: FIXED },
  );

  assert.match(md, /## Readiness profile/);
  assert.match(md, /\| Dimension \| Reaches \| L1 \| L2 \| L3 \| Not applicable \|/);
  for (const dimension of ['FAIRness', 'Provenance', 'Ethics', 'Computability']) {
    assert.ok(md.includes(`| ${dimension} |`), `profile is missing ${dimension}`);
  }
  // The Ethics L2 cell is the whole-cell non-applicability case: its only criterion is
  // the de-identification method, so declaring it inapplicable makes the cell n/a.
  const ethicsRow = md.split('\n').find((l) => l.startsWith('| Ethics |'));
  assert.match(ethicsRow, /n\/a/);
  assert.match(ethicsRow, /1 of \d+/, 'the count of non-applicable criteria is not shown');

  // And it comes before the answers it summarises.
  assert.ok(md.indexOf('## Readiness profile') < md.indexOf('## Characterization'));
});
