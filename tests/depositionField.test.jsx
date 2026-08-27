// The repo's one render test, and it exists for a specific reason: the
// deposition-target bug lived in the *wiring* between pathways.json, the
// resolver, and CriterionField's <select> — every layer can be individually
// correct while the props are not threaded through. depositionTargets.test.js
// covers the resolver; this covers the wiring.
//
// Server-rendered with react-dom/server (already a dependency) rather than a DOM
// harness, so it needs no new packages and no jsdom. `localStorage` is stubbed
// because AssessmentProvider seeds its initial record from it.
//
// Run with:  npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const record = (subDomain) => ({
  schema_version: 'assessment_record_v0',
  stage: 'upgrade',
  pathway: 'C',
  sub_domain: subDomain,
  started_at: '2026-08-07T00:00:00Z',
  answers: { 'sustainability.l1.open_format': { value: 'CSV' } },
  dataset: { name: 'ds', description: '', version: '' },
  croissant: null,
  provo: null,
  provenance: { sources: [], steps: [] },
});

let current = record('materials');
globalThis.localStorage = {
  getItem: () => JSON.stringify(current),
  setItem: () => {},
};

// Imported after the stub is installed — the provider reads localStorage on init.
const { AssessmentProvider } = await import('../src/state/assessment.jsx');
const { default: DimensionPage } = await import('../src/routes/DimensionPage.jsx');

const renderFairness = (subDomain) => {
  current = record(subDomain);
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={['/dimension/fairness']}>
      <AssessmentProvider>
        <Routes>
          <Route path="/dimension/:slug" element={<DimensionPage />} />
        </Routes>
      </AssessmentProvider>
    </MemoryRouter>,
  );
};

test('a materials record is offered materials repositories, not biomedical ones', () => {
  const html = renderFairness('materials');
  assert.ok(html.includes('Deposition repository'), 'the deposition criterion did not render');
  for (const good of ['NOMAD', 'Materials Cloud Archive', 'OQMD', 'ICSD']) {
    assert.ok(html.includes(good), `missing option: ${good}`);
  }
  // The regression: before the fix this select listed the biomedical vocabulary.
  // Note the criterion's remediation text is deliberately sub-domain-neutral, so
  // these names must not appear anywhere on the page for a materials record.
  for (const bad of ['PhysioNet', 'dbGaP', 'ICPSR']) {
    assert.ok(!html.includes(bad), `biomedical target leaked into a materials record: ${bad}`);
  }
});

test('a clinical record gets its recommended targets grouped and listed first', () => {
  const html = renderFairness('clinical');
  assert.ok(html.includes('Recommended for this sub-domain'), 'recommended optgroup missing');
  assert.ok(html.includes('Other options'), 'non-recommended optgroup missing');
  // PhysioNet is filtered in from repositories_l3_general, not clinical's own vocabulary.
  assert.ok(html.includes('PhysioNet'), 'filtered-in target missing');
  assert.ok(html.indexOf('CHoRUS') < html.indexOf('CM4AI'), 'recommended targets not sorted first');
});

test('the general sub-domain keeps the ungrouped list', () => {
  const html = renderFairness('general');
  assert.ok(html.includes('PhysioNet'), 'general targets missing');
  assert.ok(
    !html.includes('Recommended for this sub-domain'),
    'no filter is declared for general, so nothing should be grouped',
  );
});
