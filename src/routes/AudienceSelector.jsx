// Wizard step 1 — pathway selection (rendered from pathways.json), plus the
// Pathway-C sub-domain selector. Selection is stored in assessment state; the
// Continue button routes to the first dimension.

import { Navigate, useNavigate } from 'react-router-dom';
import { PATHWAYS, subDomains } from '../lib/pathway.js';
import { DIMENSIONS, slugify } from '../lib/dimensions.js';
import { useAssessment } from '../state/assessment.jsx';

const cardClass = (active) =>
  `w-full text-left rounded-none border p-4 transition-colors ${
    active ? 'border-ink ring-1 ring-ink' : 'border-line hover:border-muted'
  }`;

export default function AudienceSelector() {
  const { state, dispatch } = useAssessment();
  const navigate = useNavigate();
  const firstDimension = `/dimension/${slugify(DIMENSIONS[0])}`;

  // Require a starting point (lifecycle stage) before the audience step.
  if (!state.stage) return <Navigate to="/" replace />;

  return (
    <section>
      <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">
        Step 1 · Audience
      </span>
      <h2 className="mt-1 text-xl font-semibold">Choose your audience</h2>
      <p className="mt-2 text-sm text-muted">
        Your pathway sets which criteria are required. Pathways are cumulative: B
        includes all of A, and C includes all of A and B.
      </p>

      <div className="mt-4 grid gap-3">
        {PATHWAYS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => dispatch({ type: 'SET_PATHWAY', pathway: p.id })}
            className={cardClass(state.pathway === p.id)}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">
                Pathway {p.id} — {p.name}
              </span>
              <span className="text-xs text-muted">
                {p.level} · DRL {p.drl_band}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">{p.tagline}</p>
          </button>
        ))}
      </div>

      {/* The sub-domain is independent of the pathway above: the pathway is the target
          level, which measures machine-actionability, while the sub-domain is the
          discipline and governance context, which the level does not decide. Human or
          biological data owes the same oversight evidence whether it is aimed at L1 or
          L3, so this selector is shown at every pathway. Until schema 0.6.0 it appeared
          only under Pathway C, which made governance a function of actionability. */}
      <div className="mt-8 border-t border-line pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">Discipline and governance context</h3>
          <span className="text-xs text-faint">independent of the level above</span>
        </div>
        <p className="mt-1 text-xs text-muted">
          Adds the evidence a discipline expects — oversight and consent for the
          human-subjects sub-domains, encoding, interoperability, and provenance for
          Materials science — and selects the documentation template. Each added
          criterion carries its own level, so it becomes required at the tier that
          matches it. Defaults to General.
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {subDomains().map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => dispatch({ type: 'SET_SUB_DOMAIN', sub_domain: s.id })}
              className={`text-left rounded-none border p-3 text-sm transition-colors ${
                state.sub_domain === s.id
                  ? 'border-ink ring-1 ring-ink'
                  : 'border-line hover:border-muted'
              }`}
            >
              <span className="font-medium">{s.name}</span>
              <p className="mt-0.5 text-xs text-muted">{s.description}</p>
            </button>
          ))}
        </div>
      </div>

      {state.pathway && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => navigate(firstDimension)}
            className="rounded-none bg-brand-btn px-4 py-2 text-sm font-medium text-surface hover:opacity-90"
          >
            Continue →
          </button>
        </div>
      )}
    </section>
  );
}
