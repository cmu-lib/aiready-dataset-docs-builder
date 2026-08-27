// Wizard final step — delivery. One row per file, nothing to configure but the
// RDF serialization.
//
// This is the page the old Export never was: a place that says "you are done,
// here are your files". Six tabs each carrying an editor, a validator, and a
// Download button asked every user to work out which of them concerned them
// before the tool would hand them anything. Rows appear here only when they apply
// to the record, so a Pathway-A planner sees five files and a Pathway-C deposit
// sees eight, and neither has to decide which to ignore.

import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAssessment } from '../state/assessment.jsx';
import { useArtifactSession, usableShacl } from '../state/artifactSession.jsx';
import { templateForRecord } from '../lib/pathway.js';
import { generateDatasheet } from '../generators/datasheet.js';
import { generateTodo } from '../generators/todo.js';
import { generateCollectionGuide } from '../generators/collectionGuide.js';
import { effectiveCroissant } from '../generators/croissant.js';
import { effectiveProvo } from '../generators/provo.js';
import { validationResults } from '../lib/validation.js';
import { buildAssessmentReport, buildConformanceReport } from '../lib/report.js';
import { serializeReport, provoToTurtle } from '../lib/shacl.js';
import { download, guideFilename } from '../lib/download.js';

const previewClass =
  'mt-2 max-h-[24rem] overflow-auto rounded-none border border-line bg-surface-2 p-3 font-mono text-xs whitespace-pre-wrap';

// One file in the bundle. `note` carries anything the reader has to know *before*
// downloading — a validity warning, or that a check has not been run — because a
// caveat discovered after the file is in a deposit is a caveat delivered too late.
function FileRow({ name, description, note, tone = 'muted', onDownload, preview, children }) {
  return (
    <div className="border-b border-line py-3 last:border-b-0">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm text-ink">{name}</p>
          <p className="mt-0.5 text-xs text-muted">{description}</p>
          {note && (
            <p className={`mt-1 text-xs ${tone === 'warn' ? 'text-warn' : 'text-muted'}`}>{note}</p>
          )}
          {children}
        </div>
        <button
          type="button"
          onClick={onDownload}
          className="shrink-0 rounded-none bg-brand-btn px-4 py-2 text-sm font-medium text-surface hover:opacity-90"
        >
          Download
        </button>
      </div>
      {preview && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-muted">Preview</summary>
          <pre className={previewClass}>{preview()}</pre>
        </details>
      )}
    </div>
  );
}

export default function Download() {
  const { state, dispatch } = useAssessment();
  const { drafts, rdfFormat, setRdfFormat, shaclFor, shaclIsStale, resetSession } =
    useArtifactSession();
  const navigate = useNavigate();

  if (!state.pathway) return <Navigate to="/" replace />;

  const croissant = effectiveCroissant(state);
  const provoDoc = effectiveProvo(state);
  const shacl = shaclFor(provoDoc);
  const stale = shaclIsStale(provoDoc);

  const template = templateForRecord(state);
  const datasheetName = template === 'healthsheet' ? 'healthsheet.md' : 'datasheet.md';
  const rdfExt = rdfFormat === 'turtle' ? 'ttl' : 'jsonld';
  const rdfMime = rdfFormat === 'turtle' ? 'text/turtle' : 'application/ld+json';
  const showProvenance = state.pathway === 'B' || state.pathway === 'C';
  const showTodo = state.stage === 'plan' || state.stage === 'prepare';
  const showConformance = state.pathway !== 'A';

  // Everything the report generators need, including the SHACL verdict when one
  // was produced against this exact record. Absent, they record the referential
  // rung as uncertified — which is the honest reading of "never run" and of "run
  // against an earlier draft" alike.
  const bundleOpts = () => ({
    results: validationResults(state, { croissant, provo: provoDoc }),
    croissant,
    provo: provoDoc,
    shacl: usableShacl(shacl),
  });

  const datasheet = () => drafts.datasheet ?? generateDatasheet(state);
  const todo = () => drafts.todo ?? generateTodo(state, bundleOpts());
  const croissantJson = () => JSON.stringify(croissant, null, 2);
  const assessmentReport = () => JSON.stringify(buildAssessmentReport(state, bundleOpts()), null, 2);
  const conformanceReport = () =>
    JSON.stringify(buildConformanceReport(state, bundleOpts()), null, 2);

  const downloadProvo = async () => {
    if (rdfFormat === 'turtle') download('prov.ttl', await provoToTurtle(provoDoc), 'text/turtle');
    else download('prov.jsonld', JSON.stringify(provoDoc, null, 2), 'application/ld+json');
  };

  const downloadShaclReport = async () => {
    if (!shacl?.dataset) return;
    download(
      `shacl-report.${rdfExt}`,
      await serializeReport(shacl.dataset, rdfFormat),
      rdfMime,
    );
  };

  // Save the whole assessment record to a file so it can be resumed or shared.
  // (Every row above is derived from it; this is the source.)
  const exportAssessment = () => {
    const slug =
      (state.dataset?.name ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'assessment';
    download(`${slug}-ai-readiness.json`, JSON.stringify(state, null, 2), 'application/json');
  };

  // Clear everything and begin a fresh documentation. Confirm first: this wipes
  // answers, dataset details, and any Croissant/PROV-O edits (and localStorage).
  const startNew = () => {
    const ok = window.confirm(
      'Start a new dataset documentation?\n\nThis clears all current answers, the dataset details, and any Croissant or PROV-O edits. This cannot be undone.',
    );
    if (!ok) return;
    dispatch({ type: 'RESET' });
    resetSession();
    navigate('/');
  };

  return (
    <section>
      <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">
        {showConformance ? 'Step 6 · Download' : 'Step 5 · Download'}
      </span>
      <h2 className="mt-1 text-xl font-semibold">Your release bundle</h2>
      <p className="mt-2 max-w-[70ch] text-sm text-muted">
        Each file reflects your current answers. Go back to{' '}
        <Link to="/documents" className="text-link underline">
          Documents
        </Link>{' '}
        to change any of them.
      </p>

      <div className="mt-5 border border-line bg-surface px-4">
        <FileRow
          name={datasheetName}
          description={
            template === 'healthsheet'
              ? 'Human-readable documentation, on the healthsheet template for human-subjects data.'
              : 'Human-readable documentation, on the datasheet template.'
          }
          note={drafts.datasheet !== null ? 'Includes your hand edits.' : null}
          onDownload={() => download(datasheetName, datasheet(), 'text/markdown')}
          preview={datasheet}
        />

        <FileRow
          name="croissant.json"
          description="Machine-readable dataset descriptor (Croissant 1.0, JSON-LD)."
          onDownload={() => download('croissant.json', croissantJson(), 'application/ld+json')}
          preview={croissantJson}
        />

        {showProvenance && (
          <FileRow
            name={`prov.${rdfExt}`}
            description="Provenance record: sources, processing steps, and the agents responsible (PROV-O)."
            onDownload={downloadProvo}
          >
            <label className="mt-2 flex items-center gap-2 text-xs text-muted">
              RDF format
              <select
                value={rdfFormat}
                onChange={(e) => setRdfFormat(e.target.value)}
                className="rounded-none border border-line bg-surface px-2 py-1 text-ink"
              >
                <option value="jsonld">JSON-LD</option>
                <option value="turtle">Turtle</option>
              </select>
            </label>
          </FileRow>
        )}

        <FileRow
          name="assessment-report.json"
          description="The verdict, the per-dimension readiness profile, and every answer."
          onDownload={() =>
            download('assessment-report.json', assessmentReport(), 'application/json')
          }
          preview={assessmentReport}
        />

        {showTodo && (
          <FileRow
            name="todo.md"
            description="What remains, for a dataset still being collected or prepared."
            note={drafts.todo !== null ? 'Includes your hand edits.' : null}
            onDownload={() => download('todo.md', todo(), 'text/markdown')}
            preview={todo}
          />
        )}

        {showConformance && (
          <FileRow
            name="conformance-report.json"
            description="Which automated checks passed, and how far up the machine-actionability ladder each artifact reaches."
            note={
              !usableShacl(shacl)
                ? stale
                  ? 'The provenance record changed after the last shape validation, so this report records the referential rung as uncertified.'
                  : 'Shape validation has not been run, so this report records the referential rung as uncertified.'
                : null
            }
            tone="warn"
            onDownload={() =>
              download('conformance-report.json', conformanceReport(), 'application/json')
            }
            preview={conformanceReport}
          >
            {!usableShacl(shacl) && (
              <p className="mt-1 text-xs">
                <Link to="/conformance" className="text-link underline">
                  Run Deep validate first
                </Link>{' '}
                to certify it.
              </p>
            )}
          </FileRow>
        )}

        {shacl?.dataset && (
          <FileRow
            name={`shacl-report.${rdfExt}`}
            description="The SHACL validation report itself, as RDF — the machine-readable form of the shape check."
            onDownload={downloadShaclReport}
          />
        )}
      </div>

      {/* Collection guide — guidance rather than a release-bundle document, so it
          sits outside the file list and carries its own action colour. */}
      <div className="mt-10 border-t border-line pt-5">
        <h3 className="text-sm font-semibold">Collection guide</h3>
        <p className="mt-1 max-w-[70ch] text-xs text-muted">
          What to write down while the work is happening, so these documents are fillable later: the
          four forms a record passes through, the six questions, and a worksheet of every
          observation this pathway asks for, grouped by the stage at which it is still capturable.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() =>
              download(guideFilename(state), generateCollectionGuide(state), 'text/markdown')
            }
            className="rounded-none bg-guide-btn px-4 py-2 text-sm font-medium text-guide-btn-fg hover:opacity-90"
          >
            Download collection guide (.md)
          </button>
          <Link to="/guide" className="text-xs text-link underline">
            or read it here, and save it as a PDF
          </Link>
        </div>
      </div>

      {/* Assessment file — save/resume the whole record (the source of the rows above) */}
      <div className="mt-10 border-t border-line pt-5">
        <h3 className="text-sm font-semibold">Assessment file</h3>
        <p className="mt-1 max-w-[70ch] text-xs text-muted">
          Save the whole assessment (every answer, dataset details, and your Croissant/PROV-O edits)
          to a file: an archival record of what was assessed, against which schema version, and when.
          Work in progress is kept in this browser as you go, so you can close the tab and return to
          it.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={exportAssessment}
            className="rounded-none bg-brand-btn px-4 py-2 text-sm font-medium text-surface hover:opacity-90"
          >
            Export assessment (.json)
          </button>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(showConformance ? '/conformance' : '/documents')}
          className="rounded-none border border-line px-4 py-2 text-sm hover:bg-idle-bg"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={startNew}
          className="rounded-none border border-bad-line px-4 py-2 text-sm text-bad hover:bg-bad-bg"
        >
          Start new documentation
        </button>
      </div>
    </section>
  );
}
