// The validator lookup. §2.5 of the paper ends by making the selection of a domain
// validator "a lookup process" against the community registries; this is that lookup,
// with the bundled registry checked first.
//
// It exists because validators.json shipped in the bundle for months reachable only by
// its own tests: fourteen validators and three registries that no user could see. The
// tool asked every attested criterion for "a declaration that can be accompanied by an
// external validator's report" without ever saying which validator.
//
// Suggestions come from the record — the declared format, the discipline, whether a
// PROV-O record is being produced — so the page answers "which validator for *my* data",
// not just "which validators exist".

import { Link } from 'react-router-dom';
import { useAssessment } from '../state/assessment.jsx';
import {
  ALL_VALIDATORS,
  REGISTRIES,
  matchValidators,
  unmatchedValidators,
  criteriaBackedBy,
  executionNote,
} from '../lib/validators.js';

// How the tool relates to each execution mode. Only an in-browser validator can be run
// here and mark a criterion automated; the others are run elsewhere and their report
// recorded as attested evidence.
const EXEC_TONE = {
  'in-browser': 'bg-ok-bg text-ok',
  cli: 'bg-idle-bg text-idle',
  'web-service': 'bg-info-bg text-info',
};

function Backs({ id }) {
  const criteria = criteriaBackedBy(id);
  if (criteria.length === 0) return null;
  return (
    <p className="mt-1.5 text-xs text-muted">
      <span className="font-mono text-[0.65rem] uppercase tracking-wider text-faint">Backs</span>{' '}
      {criteria.map((c) => c.label).join(' · ')}
    </p>
  );
}

function ValidatorCard({ v, why }) {
  return (
    <div className="break-inside-avoid border border-line bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">
          <a href={v.validator_url} target="_blank" rel="noreferrer" className="text-link underline">
            {v.validator_name}
          </a>
        </h3>
        <span className={`px-1.5 py-0.5 text-[0.65rem] font-medium ${EXEC_TONE[v.execution] ?? ''}`}>
          {executionNote(v)}
        </span>
      </div>

      {why && (
        <p className="mt-1 text-xs text-accent">Suggested because {why}.</p>
      )}

      <p className="mt-1.5 text-xs text-muted">
        <span className="text-ink">{v.discipline}</span> · checks against{' '}
        <a href={v.standard_url} target="_blank" rel="noreferrer" className="text-link underline">
          {v.standard}
        </a>
      </p>
      <p className="mt-1.5 text-xs text-muted">{v.note}</p>
      <Backs id={v.id} />
      <p className="mt-1.5 font-mono text-[0.65rem] text-faint">{(v.applies_to ?? []).join(' · ')}</p>
    </div>
  );
}

export default function Validators() {
  const { state } = useAssessment();
  const suggested = matchValidators(state);
  const rest = unmatchedValidators(state);
  const hasContext = Boolean(state.pathway);

  return (
    <section>
      <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">
        Reference
      </span>
      <h2 className="mt-1 text-xl font-semibold">Validators</h2>
      <p className="mt-2 max-w-[70ch] text-sm text-muted">
        An attested criterion is a declaration that can be accompanied by an external
        validator&rsquo;s report. This is where to find the validator. The tool runs the
        general checks itself &mdash; Croissant structure, PROV-O shapes, identifier
        grounding &mdash; and references discipline validators, which stay with the
        communities that maintain them.
      </p>

      <h3 className="mt-8 border-b border-line pb-2 text-base font-semibold">
        Suggested for your dataset
      </h3>
      {!hasContext ? (
        <p className="mt-3 text-sm text-muted">
          Choose a pathway and a discipline on the{' '}
          <Link to="/audience" className="text-link underline">audience step</Link> and declare
          your release format, and the applicable validators will be listed here.
        </p>
      ) : suggested.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Nothing matched yet. Declaring the release format under{' '}
          <Link to="/dimension/sustainability" className="text-link underline">Sustainability</Link>{' '}
          is what most suggestions key on. The registries at the foot of this page cover the
          fields the bundled list does not.
        </p>
      ) : (
        <>
          <p className="mt-2 text-xs text-muted">
            Matched on what you have declared so far: the release format, the discipline, and
            whether you are producing a provenance record. Listed most specific first.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {suggested.map((v) => (
              <ValidatorCard key={v.id} v={v} why={v.why} />
            ))}
          </div>
        </>
      )}

      {rest.length > 0 && (
        <>
          <h3 className="mt-10 border-b border-line pb-2 text-base font-semibold">
            {hasContext ? 'The rest of the registry' : 'The bundled registry'}
          </h3>
          <p className="mt-2 text-xs text-muted">
            {ALL_VALIDATORS.length} validators ship with the tool. They are a seeded set, and the
            registries below are the authoritative lookup for anything absent.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {rest.map((v) => (
              <ValidatorCard key={v.id} v={v} />
            ))}
          </div>
        </>
      )}

      <h3 className="mt-10 border-b border-line pb-2 text-base font-semibold">
        When your field is not listed
      </h3>
      <p className="mt-2 max-w-[70ch] text-xs text-muted">
        Which validator applies is field-dependent, and these registries map a discipline to
        its accepted standards and the tools that check them. They turn the choice of a domain
        validator into a lookup.
      </p>
      <div className="mt-3 grid gap-2">
        {REGISTRIES.map((r) => (
          <div key={r.id} className="border border-line bg-surface-2 p-3">
            <a href={r.url} target="_blank" rel="noreferrer" className="text-sm text-link underline">
              {r.name}
            </a>
            <p className="mt-1 text-xs text-muted">{r.note}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
