// Render tests for the collection guide surfaces. Kept for the same reason as
// depositionField.test.jsx: the behaviour spans the generator, two routes, and
// the shared guidance blocks, so unit tests on any one layer can pass while the
// document a user sees is wrong or unreachable.
//
// Run with:  npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

let current = {
  schema_version: 'assessment_record_v0',
  stage: null,
  pathway: null,
  sub_domain: null,
  started_at: null,
  answers: {},
  dataset: { name: '', description: '', version: '' },
  croissant: null,
  croissant_model: { files: [], recordSets: [] },
  provo: null,
  provenance: { sources: [], steps: [] },
};
globalThis.localStorage = { getItem: () => JSON.stringify(current), setItem: () => {} };

const { AssessmentProvider } = await import('../src/state/assessment.jsx');
const { default: Guide } = await import('../src/routes/Guide.jsx');
const { default: DownloadPage } = await import('../src/routes/Download.jsx');
const { ArtifactSessionProvider } = await import('../src/state/artifactSession.jsx');
const layoutModule = await import('../src/components/Layout.jsx');

const render = (Component, entry) =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[entry]}>
      <AssessmentProvider>
        <ArtifactSessionProvider>
          <Routes>
            <Route path="*" element={<Component />} />
          </Routes>
        </ArtifactSessionProvider>
      </AssessmentProvider>
    </MemoryRouter>,
  );

test('the guide is reachable with no pathway chosen, and says which set it shows', () => {
  // The whole point of the standalone route: Export redirects when no pathway is
  // set, and a reader still at the bench is exactly the audience.
  const html = render(Guide, '/guide');
  assert.ok(html.includes('Research data collection guide'));
  assert.ok(html.includes('No pathway selected yet'), 'missing the fullest-set banner');
  assert.ok(html.includes('Preview only; this does not set your pathway.'));
  assert.ok(html.includes('Task-ready'), 'should default to the L3 worksheet');
});

test('every guidance block reaches the page, including the three that rendered nowhere before', () => {
  const html = render(Guide, '/guide');
  for (const needle of [
    'From notes to machine-actionable',   // ladder
    'Semi-automated and automated laboratories', // automation
    'The six questions',                  // wh-questions
    'What builds each layer',             // documentation inputs
    'Per-run log',                        // run_log_fields
    'Anything that went wrong, or differed from protocol',
    'Worksheet',                          // schema-driven rows
    'Binding terms to shared vocabularies', // ontology_examples (L3 default)
    'A column that looks fine and is not',
    'Making this less burdensome',        // burden_reduction
    'Let the workflow engine write it',
  ]) {
    assert.ok(html.includes(needle), `missing from the guide: ${needle}`);
  }
});

test('worksheet rows carry a level tag so a lower tier can see what applies', () => {
  const html = render(Guide, '/guide');
  // ...and the legend explaining those tags sits directly above the rows.
  assert.ok(html.includes('DRL C') && html.includes('DRL B') && html.includes('DRL A'));
  assert.ok(html.includes('required in A, B, C'), 'legend does not show cumulative membership');
  assert.ok(html.indexOf('Every worksheet row is tagged') < html.indexOf('While collecting or running'));
  // Defaulting to C means L1/L2/L3 rows all appear; the tag is what makes the
  // superset readable rather than over-demanding.
  for (const lvl of ['L1', 'L2', 'L3']) {
    assert.ok(html.includes(`>${lvl}</span>`), `no ${lvl} tag on worksheet rows`);
  }
});

test('screen and paper are two trees, each hidden from the other medium', () => {
  const html = render(Guide, '/guide');
  // The card version is for the screen only; the report replaces it on paper.
  assert.ok(html.includes('print:hidden'), 'the screen version does not opt out of print');
  assert.ok(html.includes('hidden print:block'), 'the print document is not print-only');
  assert.ok(html.includes('class="guide-print"'), 'the print document is not rendered');

  // Both read the same model, so they cannot disagree about content.
  assert.ok(html.includes('<article'), 'screen document missing');
  const print = html.slice(html.indexOf('class="guide-print"'));
  for (const needle of ['Research data collection guide', 'Contents', 'The four forms of a record',
                        'The six questions', 'Worksheet: what to record, and when', 'Reducing the burden']) {
    assert.ok(print.includes(needle), `missing from the printed document: ${needle}`);
  }
});

test('the printed document is structured as a report, not a page', () => {
  const html = render(Guide, '/guide');
  const print = html.slice(html.indexOf('class="guide-print"'));

  // Masthead, contents, numbered sections, colophon: navigable on paper, and a
  // page found on its own still says what it is.
  assert.ok(print.includes('gp-masthead') && print.includes('gp-colophon'));
  assert.ok(print.includes('<nav class="gp-contents"'), 'no contents list');
  // Numbering is positional, so assert the scheme rather than pinning a title to a
  // number: inserting a section ahead of another is a content decision, not a regression.
  const numbered = [...print.matchAll(/>(\d+)\.\s[A-Z][^<]*</g)].map((m) => Number(m[1]));
  assert.ok(numbered.length >= 8, `expected numbered sections, found ${numbered.length}`);
  assert.equal(numbered[0], 1, 'numbering does not start at 1');
  assert.ok(/>\d+\. The four forms of a record</.test(print), 'the four forms section is unnumbered');
  assert.ok(print.includes('Implements the framework of González-Espinoza, A. et al.'));

  // Tables and rules rather than the screen version's coloured chips.
  assert.ok(print.includes('<table class="gp-table"'), 'no tables in the report');
  assert.ok(!print.includes('bg-info-bg') && !print.includes('bg-warn-bg'),
    'colour-fill utilities leaked into the print tree');

  // Worksheet checkboxes are drawn, and a recorded row is filled.
  assert.ok(print.includes('gp-box'), 'no checkboxes on the worksheet');
});

test('with a pathway chosen the picker and banner disappear', () => {
  current = { ...current, pathway: 'A', stage: 'plan', dataset: { name: 'ds', description: '', version: '' } };
  const html = render(Guide, '/guide');
  assert.ok(!html.includes('No pathway selected yet'));
  assert.ok(!html.includes('Preview only'));
  assert.ok(html.includes('What to collect — ds'));
  // Pathway A is L1-only, so the L3 ontology section does not apply.
  assert.ok(!html.includes('Binding terms to shared vocabularies'));
});

test('Download offers the guide apart from the release-bundle files', () => {
  current = { ...current, pathway: 'C', sub_domain: 'materials', stage: 'upgrade' };
  const html = render(DownloadPage, '/download');

  // Guidance is not a release-bundle document, so it sits outside the file list
  // and carries its own action colour rather than the ink primary.
  assert.ok(!html.includes('collection-guide.md'), 'the guide is listed as a bundle file');
  assert.ok(html.includes('Download collection guide (.md)'), 'no download button');
  assert.ok(html.includes('bg-guide-btn'), 'button does not use its own colour');
  assert.ok(html.includes('text-guide-btn-fg'), 'button foreground does not flip with the theme');

  // The document itself is not rendered here any more; the route carries it.
  assert.ok(!html.includes('What to collect'), 'the guide document is still inlined');
  assert.ok(html.includes('href="/guide"'), 'no route out to the readable guide');
});

test('the standalone route keeps both outputs, print primary', () => {
  current = { ...current, pathway: 'C', sub_domain: 'materials', stage: 'upgrade' };
  const html = render(Guide, '/guide');
  assert.ok(html.includes('bg-guide-btn'), 'Save as PDF is not the guide colour');
  assert.ok(html.includes('Download .md'));
  assert.ok(html.includes('What to collect'), 'the document is missing from its own route');
  // Materials overlays reach the worksheet through the shared generator.
  assert.ok(html.includes('Provenance captured a priori'), 'sub-domain overlay missing');
});

test('the guide has a nav entry of its own, after the wizard steps', () => {
  const { default: Layout } = layoutModule;
  const html = renderToStaticMarkup(
    <MemoryRouter initialEntries={['/guide']}>
      <AssessmentProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="guide" element={<Guide />} />
          </Route>
        </Routes>
      </AssessmentProvider>
    </MemoryRouter>,
  );
  assert.ok(html.includes('Research data collection guide'), 'no nav entry');
  assert.ok(html.includes('href="/guide"'), 'nav entry does not link to the route');
  // Sits after the last wizard step in the bar, and the bar wraps rather than
  // overflowing: this label is much longer than the step labels beside it.
  assert.ok(html.indexOf('>Research data collection guide<') > html.indexOf('>Download<'));
  assert.ok(html.includes('flex max-w-4xl flex-wrap gap-1'), 'nav cannot wrap');
  // Its own accent: the guidance colour, not the ink used by the wizard steps.
  assert.ok(html.includes('bg-guide-btn text-guide-btn-fg'), 'active nav entry lacks its accent');
  const downloadLink = html.slice(html.indexOf('>Download<') - 200, html.indexOf('>Download<'));
  assert.ok(!downloadLink.includes('guide-btn'), 'the accent leaked onto the wizard steps');
  // Reached from the nav, the page still carries the document and both outputs.
  assert.ok(html.includes('What to collect'));
  assert.ok(html.includes('Save as PDF') && html.includes('Download .md'));
});

test('the guide bridges the two ladders and explains the three modes', () => {
  // The four forms describe practice; the five degrees describe the file. The paper
  // joins them explicitly ("the four forms end where the degrees begin"), so the
  // guide must carry both, adjacent, with the degrees after the forms.
  const html = render(Guide, '/guide');

  const iForms = html.indexOf('From notes to machine-actionable');
  const iDegrees = html.indexOf('Degrees of machine-actionability');
  const iModes = html.indexOf('How each row is confirmed');
  assert.ok(iForms > -1 && iDegrees > iForms, 'degrees must follow the four forms');
  assert.ok(iModes > iDegrees, 'the verification modes come after the ladders');

  for (const rung of ['Well-formed', 'Schema-valid', 'Referentially sound', 'Grounded', 'Executable']) {
    assert.ok(html.includes(rung), `guide is missing the ${rung} rung`);
  }
  // The ceiling is disclosed in the guide, not only on the Export page.
  assert.ok(html.includes('reported as out of scope'), 'guide does not state the tool ceiling');

  // Each mode with its definition, so a chip elsewhere in the app is legible.
  assert.ok(html.includes('can be accompanied by an external'));
  assert.ok(html.includes('A recorded human judgement'));
});
