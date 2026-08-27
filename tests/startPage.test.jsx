// Render test for the start-page carousel. It exists because the slide order has
// been rearranged repeatedly and one rearrangement silently broke a cross-slide
// text reference ("the three layers above" pointing at a slide that had moved
// below it). Order and the references that depend on it are behaviour here, not
// styling.
//
// Run with:  npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

globalThis.localStorage = { getItem: () => null, setItem: () => {} };
const { AssessmentProvider } = await import('../src/state/assessment.jsx');
const { default: StartingPoint } = await import('../src/routes/StartingPoint.jsx');

const html = renderToStaticMarkup(
  <MemoryRouter initialEntries={['/']}>
    <AssessmentProvider>
      <StartingPoint />
    </AssessmentProvider>
  </MemoryRouter>,
);
const at = (s) => {
  const i = html.indexOf(s);
  assert.ok(i >= 0, `missing from the start page: ${s}`);
  return i;
};
// Slide titles must be matched on their heading markup: several also occur as
// prose on other slides (the ladder card names "the documentation layers"), and
// a bare indexOf would match the sentence rather than the slide.
const title = (t) => at(`>${t}</h2>`);

test('slides run problem, then tool, then outputs', () => {
  const order = [
    at('Make a dataset machine-learning-ready'),
    ...[
      'The seven dimensions',
      'The three readiness levels',
      'From notes to machine-actionable',
      'Forms a person reads',
      'Forms a machine reads',
      'What to write down while you work',
      'Three steps',
      'The documentation layers',
    ].map(title),
  ];
  assert.deepEqual(order, [...order].sort((a, b) => a - b), `slides out of order: ${order}`);
  assert.equal(html.split('aria-label="Go to slide').length - 1, 9);
});

test('the ladder is split across three cards: strip, then person-read, then machine-read', () => {
  const strip = title('From notes to machine-actionable');
  const human = title('Forms a person reads');
  const machine = title('Forms a machine reads');
  const whq = title('What to write down while you work');

  // Automation band belongs with the strip, since it is a shortcut past it.
  assert.ok(at('Semi-automated and automated laboratories') > strip);
  assert.ok(at('Semi-automated and automated laboratories') < human);

  // The ELN sample sits on the person-read card, the JSON on the machine-read one.
  const eln = at('re-polished; strong peak');
  assert.ok(eln > human && eln < machine, 'ELN sample is on the wrong card');
  const json = at('prov:Activity xrd_scan');
  assert.ok(json > machine && json < whq, 'PROV sample is on the wrong card');
});

test('the two detail cards between them cover all four forms exactly once', () => {
  // LadderDetail takes index slices, so a change to the ladder length would
  // silently drop a form from the start page while the guide still showed it.
  const human = html.slice(title('Forms a person reads'), title('Forms a machine reads'));
  const machine = html.slice(title('Forms a machine reads'), title('What to write down while you work'));
  const detailOf = (part) =>
    ['Paper notebook', 'Electronic lab notebook', 'Structured capture', 'Machine-actionable']
      .filter((f) => part.includes(`${f}</span>`));
  assert.deepEqual(detailOf(human), ['Paper notebook', 'Electronic lab notebook']);
  assert.deepEqual(detailOf(machine), ['Structured capture', 'Machine-actionable']);
});

test('the four forms and their icons appear on both ladder slides', () => {
  for (const form of ['Paper notebook', 'Electronic lab notebook', 'Structured capture', 'Machine-actionable']) {
    // Once in the strip, once in the detail.
    assert.ok(html.split(form).length - 1 >= 2, `${form} should appear on both ladder slides`);
  }
  for (const icon of ['📓', '💻', '📋', '🔗', '⚙️']) assert.ok(html.includes(icon), `missing icon ${icon}`);
});

test('cross-slide references and the guide links hold', () => {
  // Broken once by a reorder: documentation layers now come after this card.
  assert.ok(!html.includes('The three layers above'), 'stale forward reference is back');
  assert.ok(html.includes('href="/guide"'), 'no link to the collection guide');
  // ReadinessDiagram is overview-only; "Three steps" carries the inputs diagram.
  assert.equal(html.split('A FAIR-published but ML-closed dataset').length - 1, 1);
  assert.ok(at('Grounded by') > title('Three steps') && at('Grounded by') < title('The documentation layers'));
});

test('the Start here cue sits at the bottom of the last slide', () => {
  // Two matches expected: the cue, and the "Start here · required" selector eyebrow.
  assert.equal(html.split('Start here').length - 1, 2);
  assert.ok(at('Start here') > title('The documentation layers'));

  // Slides stretch to the tallest, so the cue is bottom-anchored rather than
  // pushed down by a fixed margin: it claims the leftover space with mt-auto,
  // which only works if that slide is a flex column.
  const lastSlide = html.slice(html.lastIndexOf('<div class="h-full border border-line bg-surface p-8', at('Start here')));
  assert.ok(lastSlide.startsWith('<div class="h-full border border-line bg-surface p-8 flex flex-col"'),
    'the slide carrying the cue is not a flex column');
  assert.ok(html.includes('mt-auto flex flex-col items-center pt-12'), 'cue is not bottom-anchored');

  // The other slides keep the plain layout.
  assert.equal(html.split('bg-surface p-8 flex flex-col').length - 1, 1);
});

test('the matrix renders from the schema, with the out-of-cell criteria attributed', () => {
  // The cell wording used to live in a constant in this component, which is exactly
  // the drift the schema now prevents: these strings are Table 13's, and they are
  // rendered from matrix.json.
  for (const cell of ['FAIR F+A indicators', 'Storage footprint reported', 'Full pipeline provenance (W3C PROV)']) {
    at(cell);
  }

  // The 21 cells expand to more criteria than that, and the ones the cell wording
  // does not name are disclosed with their source rather than left to be noticed.
  at('ask for something the cell wording does not name');
  at('Maintenance stated'); // the L2 addition drawn from §2.7
  assert.ok(html.includes('tab:release-components') || html.includes('§2.7'),
    'out-of-cell criteria are listed without their attribution');
});
