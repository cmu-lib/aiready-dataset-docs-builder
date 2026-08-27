// Worked-examples picker. Loading an example replaces the current assessment
// (LOAD) and jumps to Review so the verdict/heatmap is visible immediately.

import { useNavigate } from 'react-router-dom';
import { EXAMPLES } from '../examples/index.js';
import { useAssessment } from '../state/assessment.jsx';

export default function Examples() {
  const { dispatch } = useAssessment();
  const navigate = useNavigate();

  const load = (ex) => {
    dispatch({ type: 'LOAD', record: ex.record });
    navigate('/review');
  };

  return (
    <section>
      <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">Examples</span>
      <h2 className="mt-1 text-xl font-semibold">Worked examples</h2>
      <p className="mt-2 max-w-[70ch] text-sm text-muted">
        Load a pre-filled example to explore the assessment end-to-end, or use one as a template.
        Loading replaces your current answers. Clinical and genomic examples use synthetic data only.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {EXAMPLES.map((ex) => (
          <div key={ex.id} className="flex flex-col border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink">{ex.title}</h3>
              <span className="shrink-0 border border-line px-1.5 py-0.5 text-[0.65rem] font-medium text-muted">
                Pathway {ex.record.pathway}
                {ex.record.sub_domain ? ` · ${ex.record.sub_domain}` : ''}
              </span>
            </div>
            <p className="mt-1 flex-1 text-xs text-muted">{ex.description}</p>
            <button
              type="button"
              onClick={() => load(ex)}
              className="mt-3 self-start bg-brand-btn px-3 py-1.5 text-xs font-medium text-surface hover:opacity-90"
            >
              Load example →
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
