// Wizard step 4 — authoring. One tab per document you write: the datasheet or
// healthsheet, the Croissant descriptor, the provenance record (Pathway B and C),
// and the to-do plan for a dataset still being collected.
//
// This page used to be Export, and carried three other jobs with it: the
// machine-actionability ladders, the SHACL pass, and six Download buttons. Those
// are now /conformance and /download. The split is by verb rather than by
// document, because the old page asked every user to decide which of six tabs
// concerned them before it would tell them anything — including users at L1, for
// whom the ladder and the conformance report make a claim the framework does not
// ask them to make.
//
// What stays here is the feedback that is corrective rather than declarative: a
// descriptor with a schema error should say so while you are editing it. What
// left is everything that states a conformance position.

import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAssessment } from '../state/assessment.jsx';
import { useArtifactSession, usableShacl } from '../state/artifactSession.jsx';
import { templateForRecord } from '../lib/pathway.js';
import { generateDatasheet } from '../generators/datasheet.js';
import { generateTodo } from '../generators/todo.js';
import {
  effectiveCroissant,
  withTemplateEntries,
  declaredMime,
  CROISSANT_CONTEXT,
  CROISSANT_CONFORMS_TO,
} from '../generators/croissant.js';
import { effectiveProvo } from '../generators/provo.js';
import { validateCroissant } from '../lib/croissantValidation.js';
import { validateProvo } from '../lib/provoValidation.js';
import { validationResults } from '../lib/validation.js';
import CroissantBuilder from '../components/CroissantBuilder.jsx';
import ProvenanceBuilder from '../components/ProvenanceBuilder.jsx';

const EXAMPLE_CROISSANT = {
  '@context': CROISSANT_CONTEXT,
  '@type': 'sc:Dataset',
  conformsTo: CROISSANT_CONFORMS_TO,
  name: 'example-tabular-dataset',
  description: 'A small placeholder tabular dataset, shown as a template to adapt.',
  license: 'https://creativecommons.org/licenses/by/4.0/',
  url: 'https://example.org/datasets/example',
  citeAs: '10.5281/zenodo.0000000',
  version: '1.0.0',
  distribution: [
    {
      '@type': 'cr:FileObject',
      '@id': 'data.parquet',
      name: 'data.parquet',
      contentUrl: 'https://example.org/datasets/example/data.parquet',
      encodingFormat: 'application/vnd.apache.parquet',
      sha256: '0'.repeat(64),
    },
  ],
  recordSet: [
    {
      '@type': 'cr:RecordSet',
      '@id': 'records',
      name: 'records',
      field: [
        {
          '@type': 'cr:Field',
          '@id': 'records/id',
          name: 'id',
          dataType: 'sc:Integer',
          source: { fileObject: { '@id': 'data.parquet' }, extract: { column: 'id' } },
        },
      ],
    },
  ],
};

const tryParse = (text) => {
  try {
    return { value: JSON.parse(text), error: null };
  } catch (e) {
    return { value: null, error: e.message };
  }
};

const editorClass = 'mt-2 w-full rounded-none border border-line p-3 font-mono text-xs';
const previewClass =
  'mt-2 max-h-[28rem] overflow-auto rounded-none border border-line bg-surface-2 p-3 font-mono text-xs whitespace-pre-wrap';

export default function Documents() {
  const { state, dispatch } = useAssessment();
  const { drafts, setDraft, clearDraft, shaclFor } = useArtifactSession();
  const navigate = useNavigate();

  // `?tab=croissant` opens a specific document directly, so criteria elsewhere in
  // the wizard can link to the artifact that completes them instead of telling
  // the user to go and find it.
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') ?? 'datasheet');
  const [croissantOverrideText, setCroissantOverrideText] = useState(() =>
    state.pathway ? JSON.stringify(effectiveCroissant(state), null, 2) : '',
  );
  const [overrideText, setOverrideText] = useState(() =>
    state.pathway ? JSON.stringify(effectiveProvo(state), null, 2) : '',
  );

  if (!state.pathway) return <Navigate to="/" replace />;

  const provoDoc = effectiveProvo(state);
  const provoResult = validateProvo(provoDoc);
  const provoJson = JSON.stringify(provoDoc, null, 2);
  const overrideActive = Boolean(state.provo);

  // A generated document until an edit takes it over; `null` in the draft store
  // means "still generated", so answering another criterion is reflected here
  // rather than frozen at whatever the answers said when the page first loaded.
  const datasheet = drafts.datasheet ?? generateDatasheet(state);
  const todo =
    drafts.todo ??
    generateTodo(state, {
      results: validationResults(state, { croissant: effectiveCroissant(state), provo: provoDoc }),
      croissant: effectiveCroissant(state),
      provo: provoDoc,
      shacl: usableShacl(shaclFor(provoDoc)),
    });

  // The descriptor is generated from answers unless a raw override is set, which
  // only an explicit "Edit raw" action does. Before this, the editor mirrored
  // itself into state on every keystroke, so the override was always on and
  // nothing generated could ever take effect.
  const croissantOverride = Boolean(state.croissant);
  const croissantDoc = effectiveCroissant(state);
  const croissantJson = JSON.stringify(croissantDoc, null, 2);
  // While overriding, validate what is actually in the editor (so a syntax error
  // is visible); otherwise validate the generated descriptor.
  const croissantParse = croissantOverride
    ? tryParse(croissantOverrideText)
    : { value: croissantDoc, error: null };
  const croissantResult = croissantParse.value
    ? validateCroissant(croissantParse.value, { expectedMime: declaredMime(state) })
    : null;

  const template = templateForRecord(state);
  const datasheetName = template === 'healthsheet' ? 'healthsheet.md' : 'datasheet.md';
  const showProvenance = state.pathway === 'B' || state.pathway === 'C';
  const showTodo = state.stage === 'plan' || state.stage === 'prepare';
  // The ladder and the conformance report state a position the framework only
  // asks for from L2 upward, so Pathway A skips straight to the files.
  const showConformance = state.pathway !== 'A';

  // Dataset details feed generateCroissant, so no descriptor write is needed —
  // except while a raw override is active, where the derived path is bypassed and
  // the name the user just typed would otherwise never reach the descriptor.
  const setDatasetField = (patch) => {
    dispatch({ type: 'SET_DATASET', dataset: patch });
    if (croissantOverride && patch.name !== undefined) {
      const next = { ...state.croissant, name: patch.name };
      dispatch({ type: 'SET_CROISSANT', croissant: next });
      setCroissantOverrideText(JSON.stringify(next, null, 2));
    }
  };

  // Take over the descriptor by hand, starting from whatever is current.
  const startCroissantOverride = (from = croissantDoc) => {
    dispatch({ type: 'SET_CROISSANT', croissant: from });
    setCroissantOverrideText(JSON.stringify(from, null, 2));
  };

  // Hand back to the generated descriptor. Destructive while hand-authored files
  // or record sets exist, so confirm in that case.
  const clearCroissantOverride = () => {
    const desc = state.croissant;
    const hasHandwork =
      (Array.isArray(desc?.distribution) && desc.distribution.length > 0) ||
      (Array.isArray(desc?.recordSet) && desc.recordSet.length > 0);
    if (hasHandwork) {
      const ok = window.confirm(
        'Discard your raw edits?\n\nThe descriptor returns to the one generated from your assessment answers, and the files and record sets you added here are lost.',
      );
      if (!ok) return;
    }
    dispatch({ type: 'SET_CROISSANT', croissant: null });
    setCroissantOverrideText(croissantJson);
  };

  // Add one cr:FileObject + one cr:RecordSet, seeded from the declared format (so
  // a materials record gets CIF, not Parquet). Additive — the name, license, DOI,
  // and RAI annotations derived from the answers are preserved. Since these live
  // in the descriptor rather than the answers, adding them takes over the
  // descriptor by hand; tier 2 moves this onto the builder model instead.
  const insertTemplate = () => {
    const base = croissantParse.value ?? croissantDoc;
    startCroissantOverride(withTemplateEntries(base, state));
  };

  const TABS = [
    { id: 'datasheet', label: datasheetName },
    { id: 'croissant', label: 'croissant.json' },
    ...(showProvenance ? [{ id: 'provo', label: 'provenance' }] : []),
    ...(showTodo ? [{ id: 'todo', label: 'todo.md' }] : []),
  ];
  const active = TABS.some((t) => t.id === tab) ? tab : 'datasheet';

  const tabClass = (id) =>
    `-mb-px whitespace-nowrap border-b-2 pb-2 text-sm transition-colors ${
      active === id
        ? 'border-accent font-medium text-ink'
        : 'border-transparent text-muted hover:text-ink'
    }`;

  return (
    <section>
      <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">
        Step 4 · Documents
      </span>
      <h2 className="mt-1 text-xl font-semibold">Write the documentation</h2>
      <p className="mt-2 max-w-[70ch] text-sm text-muted">
        Each tab is one document in the release bundle, generated from your answers and editable
        here. {showConformance ? 'Checking and downloading come next.' : 'Downloading comes next.'}
      </p>

      {/* Tabs */}
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} className={tabClass(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {/* Datasheet / healthsheet */}
        {active === 'datasheet' && (
          <div>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">{datasheetName}</h3>
              {drafts.datasheet !== null && (
                <button
                  type="button"
                  onClick={() => clearDraft('datasheet')}
                  className="text-xs text-muted underline"
                >
                  Discard edits and regenerate
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-muted">
              {drafts.datasheet === null
                ? 'Generated from your answers, and rewritten as you answer more. Editing takes it over.'
                : 'Edited by hand — later answers no longer change it.'}
            </p>
            <textarea
              value={datasheet}
              onChange={(e) => setDraft('datasheet', e.target.value)}
              rows={20}
              className={editorClass}
              spellCheck={false}
            />
          </div>
        )}

        {/* Croissant */}
        {active === 'croissant' && (
          <div>
            <h3 className="text-sm font-semibold">croissant.json</h3>

            {/* Dataset details — the name field lives here */}
            <div className="mt-3 border border-line bg-surface-2 p-3">
              <p className="text-xs text-muted">
                Dataset details populate the descriptor. A{' '}
                <span className="font-medium text-ink">name</span> is required for it to validate.
                {croissantOverride && (
                  <>
                    {' '}
                    While you are editing the descriptor by hand, only the name is carried across —
                    clear the raw edits below to have every field applied again.
                  </>
                )}
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-muted">
                  Name
                  <input
                    value={state.dataset?.name ?? ''}
                    onChange={(e) => setDatasetField({ name: e.target.value })}
                    placeholder="e.g. VA fracture-risk cohort"
                    className="mt-1 w-full rounded-none border border-line bg-surface px-2 py-1 text-sm text-ink"
                  />
                </label>
                <label className="text-xs text-muted">
                  Version
                  <input
                    value={state.dataset?.version ?? ''}
                    onChange={(e) => setDatasetField({ version: e.target.value })}
                    placeholder="e.g. 1.0.0"
                    className="mt-1 w-full rounded-none border border-line bg-surface px-2 py-1 text-sm text-ink"
                  />
                </label>
                <label className="text-xs text-muted sm:col-span-2">
                  Description
                  <textarea
                    value={state.dataset?.description ?? ''}
                    onChange={(e) => setDatasetField({ description: e.target.value })}
                    rows={2}
                    placeholder="One or two sentences describing the dataset."
                    className="mt-1 w-full rounded-none border border-line bg-surface px-2 py-1 text-sm text-ink"
                  />
                </label>
              </div>
            </div>

            {/* The builder owns distribution + recordSet. A raw override bypasses
                the generator entirely, so it would silently ignore the builder —
                say so rather than showing a form that does nothing. */}
            {croissantOverride ? (
              <p className="mt-4 border border-warn-line bg-warn-bg p-3 text-xs text-warn">
                You are editing the descriptor by hand, so the file and column builder is inactive.
                Discard the raw edits below to use it again.
              </p>
            ) : (
              <CroissantBuilder />
            )}

            {/* Validator output — errors, warnings, and what "directly loadable"
                is still missing. Sits directly under the builder so the effect of
                a change is visible without opening the raw descriptor. This is
                corrective feedback on what you are writing; the ladder that reads
                the same result as a conformance position lives on /conformance. */}
            <div className="mt-3 text-xs">
              {!croissantResult ? (
                <p className="text-bad">
                  {croissantParse.error
                    ? `Invalid JSON: ${croissantParse.error}`
                    : 'The descriptor is empty — it must be a JSON object.'}
                </p>
              ) : (
                <>
                  <p className={croissantResult.valid ? 'text-ok' : 'text-bad'}>
                    {croissantResult.valid
                      ? croissantResult.loadable
                        ? '✓ Valid and directly loadable.'
                        : '✓ Valid — metadata only; declare files and fields to make it directly loadable.'
                      : `× Not valid: ${croissantResult.errors.length} problem(s) to fix.`}
                  </p>

                  {croissantResult.errors.length > 0 && (
                    <ul className="mt-1 list-inside list-disc text-bad">
                      {croissantResult.errors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  )}

                  {croissantResult.warnings.length > 0 && (
                    <>
                      <p className="mt-2 font-medium text-warn">
                        Recommended, but not blocking validity:
                      </p>
                      <ul className="mt-1 list-inside list-disc text-warn">
                        {croissantResult.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </>
                  )}

                  {croissantResult.valid && !croissantResult.loadable && (
                    <p className="mt-2 text-muted">
                      <span className="font-medium text-ink">Directly loadable</span> needs at least
                      one{' '}
                      {croissantOverride ? (
                        <>
                          <code className="font-mono">distribution</code> entry and one{' '}
                          <code className="font-mono">recordSet</code> carrying at least one{' '}
                          <code className="font-mono">field</code>
                        </>
                      ) : (
                        'file, and one record set with at least one column, in the builder above'
                      )}
                      . This is what the{' '}
                      <span className="font-mono">computability.l3.direct_ml_load</span> criterion
                      checks.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* The raw descriptor. Secondary now that the builder writes it, so it
                is collapsed by default — except while overriding, when it is the
                editor rather than a preview. */}
            <details className="mt-4 border border-line bg-surface p-3" open={croissantOverride}>
              <summary className="cursor-pointer text-xs font-semibold text-ink">
                Descriptor (raw JSON-LD){' '}
                <span className="font-normal text-faint">
                  {croissantOverride ? '· edited by hand' : '· generated from your answers'}
                </span>
              </summary>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[0.7rem] text-muted">
                  {croissantOverride
                    ? 'Your edits are the descriptor now; the builder and the dataset details no longer regenerate it.'
                    : 'Rebuilt from your answers and the builder as you go. Editing by hand takes it over — reversible at any time.'}
                </p>
                <div className="flex shrink-0 gap-3">
                  {/* Only offered while overriding — otherwise the builder's own
                      "Start from a template" is the right entry point. */}
                  {croissantOverride ? (
                    <>
                      <button
                        type="button"
                        onClick={insertTemplate}
                        className="text-xs text-muted underline"
                      >
                        Insert a template file + record set
                      </button>
                      <button
                        type="button"
                        onClick={clearCroissantOverride}
                        className="text-xs text-bad underline"
                      >
                        Discard raw edits
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startCroissantOverride()}
                      className="text-xs text-muted underline"
                    >
                      Edit by hand
                    </button>
                  )}
                </div>
              </div>

              <textarea
                value={croissantOverride ? croissantOverrideText : croissantJson}
                readOnly={!croissantOverride}
                onChange={(e) => {
                  setCroissantOverrideText(e.target.value);
                  const p = tryParse(e.target.value);
                  if (p.value && typeof p.value === 'object') {
                    dispatch({ type: 'SET_CROISSANT', croissant: p.value });
                  }
                }}
                rows={16}
                className={editorClass}
                spellCheck={false}
              />

              {/* Key-level reference, for reading or hand-editing the JSON. Kept
                  here rather than beside the builder: the builder explains itself
                  in its own terms, this explains the serialization. */}
              <details className="mt-3 border border-line bg-surface-2 p-3">
                <summary className="cursor-pointer text-xs font-medium text-ink">
                  What the builder writes into <code className="font-mono">distribution</code> and{' '}
                  <code className="font-mono">recordSet</code>
                </summary>
                <dl className="mt-3 space-y-3 text-xs">
                  <div>
                    <dt className="font-medium text-ink">
                      <code className="font-mono">distribution[]</code> — one{' '}
                      <code className="font-mono">cr:FileObject</code> per file you ship
                    </dt>
                    <dd className="mt-1 text-muted">
                      <code className="font-mono">@id</code> (a stable string — this is what fields
                      point at) · <code className="font-mono">name</code> ·{' '}
                      <code className="font-mono">contentUrl</code> (where the file resolves) ·{' '}
                      <code className="font-mono">encodingFormat</code> (media type, e.g.{' '}
                      <code className="font-mono">text/csv</code>,{' '}
                      <code className="font-mono">application/x-hdf5</code>,{' '}
                      <code className="font-mono">chemical/x-cif</code>) ·{' '}
                      <code className="font-mono">sha256</code> (optional but recommended — lets a
                      consumer verify integrity)
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-ink">
                      <code className="font-mono">recordSet[]</code> — one{' '}
                      <code className="font-mono">cr:RecordSet</code> per table or collection
                    </dt>
                    <dd className="mt-1 text-muted">
                      <code className="font-mono">@id</code> · <code className="font-mono">name</code>{' '}
                      · <code className="font-mono">field[]</code> (the columns)
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-ink">
                      <code className="font-mono">field[]</code> — one{' '}
                      <code className="font-mono">cr:Field</code> per column or variable
                    </dt>
                    <dd className="mt-1 text-muted">
                      <code className="font-mono">@id</code> (convention:{' '}
                      <code className="font-mono">recordset/field</code>) ·{' '}
                      <code className="font-mono">name</code> ·{' '}
                      <code className="font-mono">dataType</code> (
                      <code className="font-mono">sc:Text</code>,{' '}
                      <code className="font-mono">sc:Integer</code>,{' '}
                      <code className="font-mono">sc:Float</code>,{' '}
                      <code className="font-mono">sc:Boolean</code>,{' '}
                      <code className="font-mono">sc:Date</code>) ·{' '}
                      <code className="font-mono">source.fileObject.@id</code> plus{' '}
                      <code className="font-mono">source.extract.column</code> (which file, which
                      column)
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-muted">
                  <span className="font-medium text-ink">The rule people trip on:</span> a
                  field&apos;s <code className="font-mono">source.fileObject.@id</code> must match the{' '}
                  <code className="font-mono">@id</code> of a declared distribution entry, and no two{' '}
                  <code className="font-mono">@id</code>s anywhere may repeat. The builder cannot
                  break either one — it derives every <code className="font-mono">@id</code> and
                  offers only declared files — but hand-edits can, so both are checked.
                </p>
                <p className="mt-2 text-xs text-muted">
                  Reference:{' '}
                  <a
                    href="https://docs.mlcommons.org/croissant/docs/croissant-spec.html"
                    target="_blank"
                    rel="noreferrer"
                    className="text-link underline"
                  >
                    Croissant 1.0 specification
                  </a>{' '}
                  ·{' '}
                  <a
                    href="https://github.com/mlcommons/croissant"
                    target="_blank"
                    rel="noreferrer"
                    className="text-link underline"
                  >
                    MLCommons Croissant tooling
                  </a>
                </p>
              </details>

              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-muted">
                  See a complete example descriptor (read-only)
                </summary>
                <pre className={previewClass}>{JSON.stringify(EXAMPLE_CROISSANT, null, 2)}</pre>
              </details>
            </details>
          </div>
        )}

        {/* Provenance */}
        {active === 'provo' && showProvenance && (
          <div>
            <h3 className="text-sm font-semibold">Provenance (PROV-O)</h3>

            <div className="mt-2">
              <ProvenanceBuilder />
            </div>

            <div className="mt-4 border border-line bg-surface p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">PROV-O record</h3>
                <span className="text-xs text-muted">
                  {provoResult.variableEntityCount} variables ·{' '}
                  <span className={provoResult.derivationIntact ? 'text-ok' : 'text-warn'}>
                    {provoResult.derivationIntact ? 'lineage intact' : 'lineage incomplete'}
                  </span>
                </span>
              </div>

              <p className="mt-2 text-xs text-muted">
                Shape validation against the formal PROV-O profile — the structural rules a
                downstream tool applies when it ingests lineage — runs on the{' '}
                <Link to="/conformance" className="text-link underline">
                  Conformance
                </Link>{' '}
                step.
              </p>

              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-muted">
                  Preview / advanced: raw JSON-LD {overrideActive ? '(override active)' : ''}
                </summary>
                <textarea
                  value={overrideActive ? overrideText : provoJson}
                  readOnly={!overrideActive}
                  onChange={(e) => {
                    setOverrideText(e.target.value);
                    const p = tryParse(e.target.value);
                    if (p.value && typeof p.value === 'object')
                      dispatch({ type: 'SET_PROVO', provo: p.value });
                  }}
                  rows={12}
                  className={editorClass}
                  spellCheck={false}
                />
                {overrideActive ? (
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'SET_PROVO', provo: null })}
                    className="mt-1 text-xs text-bad underline"
                  >
                    Clear override (return to builder)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setOverrideText(provoJson);
                      dispatch({ type: 'SET_PROVO', provo: provoDoc });
                    }}
                    className="mt-1 text-xs text-muted underline"
                  >
                    Edit raw (override the builder)
                  </button>
                )}
              </details>
            </div>
          </div>
        )}

        {/* To-do action plan */}
        {active === 'todo' && showTodo && (
          <div>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">todo.md</h3>
              {drafts.todo !== null && (
                <button
                  type="button"
                  onClick={() => clearDraft('todo')}
                  className="text-xs text-muted underline"
                >
                  Discard edits and regenerate
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-muted">
              Action plan of what remains, for a dataset still being collected or prepared.
            </p>
            <textarea
              value={todo}
              onChange={(e) => setDraft('todo', e.target.value)}
              rows={20}
              className={editorClass}
              spellCheck={false}
            />
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('/review')}
          className="rounded-none border border-line px-4 py-2 text-sm hover:bg-idle-bg"
        >
          ← Back to review
        </button>
        <button
          type="button"
          onClick={() => navigate(showConformance ? '/conformance' : '/download')}
          className="rounded-none bg-brand-btn px-4 py-2 text-sm font-medium text-surface hover:opacity-90"
        >
          {showConformance ? 'Check the artifacts →' : 'Download the files →'}
        </button>
      </div>
    </section>
  );
}
