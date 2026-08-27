// Render tests for the release-bundle pages. The behaviour spans three places —
// the criterion's tab id, the <Link> that builds the URL, and Documents reading
// the query param — so a unit test on any one of them would pass while the link
// still went nowhere. Kept for the same reason as depositionField.test.jsx.
//
// Since the split, three routes replace /export: /documents (authoring),
// /conformance (verification, Pathway B and C only), and /download (delivery).
// The split's whole point is which page shows what, so that is what is asserted:
// a ladder must not appear while authoring, and must appear on Conformance.
//
// Note the app mounts HashRouter, so `/documents?tab=croissant` renders as
// `#/documents?tab=croissant`; useSearchParams reads the query inside the hash.
//
// Run with:  npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const recordFor = (pathway) => ({
  schema_version: 'assessment_record_v0',
  stage: 'upgrade',
  pathway,
  sub_domain: 'materials',
  started_at: '2026-08-07T00:00:00Z',
  answers: {},
  dataset: { name: 'ds', description: '', version: '' },
  croissant: null,
  croissant_model: { files: [], recordSets: [] },
  provo: null,
  provenance: { sources: [], steps: [] },
});

let stored = recordFor('C');
globalThis.localStorage = { getItem: () => JSON.stringify(stored), setItem: () => {} };

const { AssessmentProvider } = await import('../src/state/assessment.jsx');
const { ArtifactSessionProvider } = await import('../src/state/artifactSession.jsx');
const { default: DimensionPage } = await import('../src/routes/DimensionPage.jsx');
const { default: Documents } = await import('../src/routes/Documents.jsx');
const { default: Conformance } = await import('../src/routes/Conformance.jsx');
const { default: DownloadPage } = await import('../src/routes/Download.jsx');

// Every page reads both providers now: the assessment record, and the
// non-persisted working state that carries drafts and the SHACL verdict between
// the three pages.
const render = (entry, element) =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[entry]}>
      <AssessmentProvider>
        <ArtifactSessionProvider>{element}</ArtifactSessionProvider>
      </AssessmentProvider>
    </MemoryRouter>,
  );

const RUNGS = ['Well-formed', 'Schema-valid', 'Referentially sound', 'Grounded', 'Executable'];

test('descriptor-driven criteria link to the Documents tab that completes them', () => {
  const html = renderToStaticMarkup(
    <MemoryRouter initialEntries={['/dimension/fairness']}>
      <AssessmentProvider>
        <Routes>
          <Route path="/dimension/:slug" element={<DimensionPage />} />
        </Routes>
      </AssessmentProvider>
    </MemoryRouter>,
  );
  assert.ok(html.includes('href="/documents?tab=croissant"'), 'Croissant criteria should deep-link');
  assert.ok(html.includes('Validated from the Croissant descriptor'));
});

test('Documents opens the tab named in the query param', () => {
  const at = (entry) => render(entry, <Documents />);

  assert.ok(at('/documents?tab=croissant').includes('Build the descriptor (files and columns)'));
  assert.ok(at('/documents?tab=provo').includes('Build provenance (steps)'));
  // No param, or an unknown one, falls back to the datasheet tab.
  assert.ok(at('/documents').includes('# Dataset datasheet'));
  assert.ok(at('/documents?tab=nonsense').includes('# Dataset datasheet'));
});

test('authoring shows corrective validation but never the ladder', () => {
  // The distinction the split rests on: a schema error belongs beside the editor,
  // a conformance position does not. If a ladder reappears here the separation has
  // been lost, whatever the pages look like.
  for (const entry of ['/documents?tab=croissant', '/documents?tab=provo']) {
    const html = render(entry, <Documents />);
    assert.ok(!html.includes('Machine-actionability'), `${entry} should not carry a ladder`);
    for (const rung of RUNGS) {
      assert.ok(!html.includes(rung), `${entry} should not name the ${rung} rung`);
    }
  }
  // The corrective message is still there.
  const croissant = render('/documents?tab=croissant', <Documents />);
  assert.ok(croissant.includes('Valid') || croissant.includes('Not valid'));
});

test('Conformance reports a ladder per artifact, with the uncertified rung disclosed', () => {
  const html = render('/conformance', <Conformance />);
  for (const rung of RUNGS) {
    assert.ok(html.includes(rung), `Conformance is missing the ${rung} rung`);
  }
  // Both artifacts, not just one.
  assert.ok(html.includes('croissant.json'));
  assert.ok(html.includes('prov.jsonld'));
  // The empty-answers record is not grounded, and the page says which rung it
  // reached rather than only that something is wrong.
  assert.ok(html.includes('reaches'));
  // Executable is disclosed as unchecked, not silently omitted.
  assert.ok(html.includes('does not certify'));
  // SHACL is offered here rather than while authoring.
  assert.ok(html.includes('Deep validate'));
});

test('Download lists one row per file that applies to the record', () => {
  const html = render('/download', <DownloadPage />);
  for (const file of [
    'datasheet.md',
    'croissant.json',
    'prov.jsonld',
    'assessment-report.json',
    'conformance-report.json',
  ]) {
    assert.ok(html.includes(file), `Download is missing ${file}`);
  }
  // A report downloaded before the shape pass says so, rather than implying the
  // referential rung was certified.
  assert.ok(html.includes('Shape validation has not been run'));
});

test('Pathway A gets neither the conformance report nor the ladder', () => {
  stored = recordFor('A');
  try {
    const download = render('/download', <DownloadPage />);
    assert.ok(download.includes('croissant.json'), 'Pathway A still gets a descriptor');
    assert.ok(download.includes('datasheet.md'), 'Pathway A still gets a datasheet');
    assert.ok(
      !download.includes('conformance-report.json'),
      'Pathway A should not be offered a conformance report',
    );
    // Provenance is a Pathway B/C artifact.
    assert.ok(!download.includes('prov.jsonld'));

    // Documents sends Pathway A straight to the files.
    const documents = render('/documents', <Documents />);
    assert.ok(documents.includes('Download the files'));
    assert.ok(!documents.includes('Check the artifacts'));
  } finally {
    stored = recordFor('C');
  }
});
