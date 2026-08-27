// What a criterion card tells the user. Render-tested for the same reason as
// depositionField.test.jsx: the content lives in matrix.json, the resolution in
// lib/validators.js, and the rendering in CriterionField — each can be correct
// while the card shows nothing.
//
// The specific regression guarded here: for most of this tool's life every
// criterion displayed a mode chip reading "attested" or "manual" and said nothing
// about what that required, and validators.json shipped in the bundle unreachable
// by any user.
//
// Run with:  npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import matrix from '../src/schema/matrix.json';

const { default: CriterionField } = await import('../src/components/CriterionField.jsx');

const byId = (id) => matrix.criteria.find((c) => c.id === id);

const render = (criterion, answer = {}) =>
  renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(CriterionField, {
        criterion,
        answer,
        onChange: () => {},
        pathway: 'C',
        subDomain: 'general',
      }),
    ),
  );

const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

test('every criterion card says what would confirm it', () => {
  for (const id of [
    'fairness.l1.persistent_id', // automated
    'characterization.l3.bias_audit', // attested
    'ethics.l3.oversight_documented', // manual
  ]) {
    const c = byId(id);
    const t = text(render(c));
    assert.ok(t.includes('Confirms'), `${id}: no Confirms line`);
    // The hint itself, not a paraphrase of it.
    assert.ok(t.includes(c.verification_hint.slice(0, 60)), `${id}: hint text missing`);
  }
});

test('the hint speaks in the voice of its mode, so the chip is glossed in context', () => {
  // This is why the card needs no tooltip: the sentence identifies the mode.
  assert.match(text(render(byId('fairness.l1.persistent_id'))), /Confirms The tool checks/);
  assert.match(text(render(byId('characterization.l3.bias_audit'))), /Confirms You declare/);
  assert.match(text(render(byId('ethics.l3.oversight_documented'))), /confirms the recorded approval/);
});

test('a criterion naming validators links them, with how each one is run', () => {
  const html = render(byId('characterization.l3.bias_audit'));
  const t = text(html);
  assert.ok(t.includes('Report from'), 'no validator lead-in');
  assert.ok(t.includes('Aequitas') && t.includes('Fairlearn'), 'validators not named');
  // Execution mode matters: it is the difference between a tool the app could run
  // and one the user must run elsewhere and attach a report from.
  assert.ok(t.includes('run locally'), 'execution mode not shown');
  assert.ok(html.includes('href="https://github.com/dssg/aequitas"'), 'validator not linked');
});

test('a criterion with no validators shows no empty validator row', () => {
  const t = text(render(byId('ethics.l3.oversight_documented')));
  assert.ok(!t.includes('Report from'), 'empty validator row rendered');
});

test('the note field asks an attested criterion for its backing report', () => {
  // The conformance report reads this field as `evidence`, so the placeholder has
  // to ask for the thing the report will publish.
  const attested = render(byId('characterization.l3.bias_audit'));
  assert.ok(attested.includes('Link the report that backs this'), attested.slice(0, 200));

  const manual = render(byId('ethics.l3.oversight_documented'));
  assert.ok(manual.includes('Note (optional)'));
  assert.ok(!manual.includes('Link the report that backs this'));
});
