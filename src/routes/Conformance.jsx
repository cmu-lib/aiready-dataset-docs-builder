// Wizard step 5 — verification. Reachable only from Pathway B upward.
//
// The distinction this page rests on: a validator message is corrective ("this
// descriptor has a schema error, go and fix it") and belongs beside the editor,
// which is where /documents keeps it. The machine-actionability ladder is
// declarative — it states how far up the ladder a released artifact reaches, and
// which level claims that position supports. That is a conformance position, and
// the framework only asks for one from L2 upward, so a Pathway-A user never
// arrives here and is never shown a ladder they were not asked to climb.
//
// Nothing downloads from this page. Producing files is /download's job; this page
// only decides what those files will be able to say.

import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAssessment } from '../state/assessment.jsx';
import { useArtifactSession, usableShacl } from '../state/artifactSession.jsx';
import { effectiveCroissant, declaredMime } from '../generators/croissant.js';
import { effectiveProvo } from '../generators/provo.js';
import { validateCroissant } from '../lib/croissantValidation.js';
import { validateProvo } from '../lib/provoValidation.js';
import { croissantDegrees, provoDegrees, levelSupport } from '../lib/actionability.js';
import DegreeLadder from '../components/DegreeLadder.jsx';

export default function Conformance() {
  const { state } = useAssessment();
  const { shaclFor, shaclIsStale, runDeepValidate } = useArtifactSession();
  const navigate = useNavigate();

  if (!state.pathway) return <Navigate to="/" replace />;
  // Pathway A targets no level whose claim rests on a ladder rung, so the page has
  // nothing to say to it. Redirecting rather than rendering an empty state keeps
  // the nav and the route in agreement.
  if (state.pathway === 'A') return <Navigate to="/download" replace />;

  const croissantDoc = effectiveCroissant(state);
  const croissantResult = validateCroissant(croissantDoc, { expectedMime: declaredMime(state) });
  const provoDoc = effectiveProvo(state);
  const provoResult = validateProvo(provoDoc);

  const shacl = shaclFor(provoDoc);
  const stale = shaclIsStale(provoDoc);

  const croissantLadder = croissantDegrees(croissantDoc, croissantResult);
  const provoLadder = provoDegrees(provoDoc, provoResult, { shacl: usableShacl(shacl) });

  // Bounded to the levels this pathway targets, so a Pathway-B record is not told
  // it falls short of L3 correspondences it never claimed.
  const support = levelSupport({ croissant: croissantLadder, provo: provoLadder }, state.pathway);
  const supportFor = (artifact) => support.filter((e) => e.artifact === artifact);

  const showProvenance = state.pathway === 'B' || state.pathway === 'C';

  return (
    <section>
      <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">
        Step 5 · Conformance
      </span>
      <h2 className="mt-1 text-xl font-semibold">Check the artifacts</h2>
      <p className="mt-2 max-w-[70ch] text-sm text-muted">
        How far up the machine-actionability ladder each generated artifact reaches. Machine-readable
        and machine-actionable are not the same property: a file can parse as valid JSON and still
        fail to load because a reference points nowhere or a value is free text where an identifier
        was needed. Anything short here is fixed back on{' '}
        <Link to="/documents" className="text-link underline">
          Documents
        </Link>
        .
      </p>

      <div className="mt-5 border border-line bg-surface p-4">
        <h3 className="text-sm font-semibold">croissant.json</h3>
        <DegreeLadder
          degrees={croissantLadder}
          artifact="This descriptor"
          supports={supportFor('croissant')}
        />
      </div>

      {showProvenance && (
        <div className="mt-4 border border-line bg-surface p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">prov.jsonld</h3>
            <span className="text-xs text-muted">
              {provoResult.variableEntityCount} variables ·{' '}
              <span className={provoResult.derivationIntact ? 'text-ok' : 'text-warn'}>
                {provoResult.derivationIntact ? 'lineage intact' : 'lineage incomplete'}
              </span>
            </span>
          </div>

          <DegreeLadder degrees={provoLadder} artifact="This record" supports={supportFor('provo')} />

          <div className="mt-4 border-t border-line pt-3">
            <p className="mb-2 text-xs text-muted">
              Deep validation checks the record against a formal PROV-O SHACL shape (the same
              structural rules a downstream tool applies when it ingests lineage), catching problems
              like a missing agent or a broken derivation chain while you can still fix them. It is
              what certifies the <span className="font-medium text-ink">Referentially sound</span>{' '}
              rung above.
            </p>
            <button
              type="button"
              onClick={() => runDeepValidate(provoDoc)}
              className="rounded-none bg-brand-btn px-3 py-1.5 text-sm font-medium text-surface hover:opacity-90"
            >
              {shacl?.loading ? 'Validating…' : 'Deep validate (SHACL)'}
            </button>

            {/* A verdict computed from an earlier draft is reported as absent rather
                than carried forward: the record it certified no longer exists. */}
            {!shacl && stale && (
              <p className="mt-2 text-xs text-warn">
                The provenance record changed since the last run, so that verdict no longer applies.
                Validate again to certify the current record.
              </p>
            )}

            {shacl && !shacl.loading && (
              <div className="mt-2 text-sm">
                {shacl.error ? (
                  <p className="text-bad">Error: {shacl.error}</p>
                ) : (
                  <>
                    <p className={shacl.conforms ? 'text-ok' : 'text-bad'}>
                      {shacl.conforms
                        ? '✓ Conforms to the PROV-O profile.'
                        : `× ${shacl.results.length} violation(s):`}
                    </p>
                    {!shacl.conforms && (
                      <ul className="mt-1 list-inside list-disc text-xs text-muted">
                        {shacl.results.map((r, i) => (
                          <li key={i}>
                            [{r.severity}] {r.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <p className="mt-4 border-l-2 border-line pl-3 text-xs text-muted">
        <span className="font-medium text-ink">Executable</span> is the one rung this tool does not
        certify: it would mean round-tripping each artifact through the tool that will consume it,
        and dereferencing every identifier over the network. Both are out of reach offline, so the
        report names the check that would certify the rung and marks it out-of-scope.
      </p>

      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('/documents')}
          className="rounded-none border border-line px-4 py-2 text-sm hover:bg-idle-bg"
        >
          ← Back to documents
        </button>
        <button
          type="button"
          onClick={() => navigate('/download')}
          className="rounded-none bg-brand-btn px-4 py-2 text-sm font-medium text-surface hover:opacity-90"
        >
          Download the files →
        </button>
      </div>
    </section>
  );
}
