// Standalone collection guide, reachable before the wizard starts. This is the
// route the intro cards link to, and its audience is someone still at the bench
// who has not chosen a pathway yet, so it cannot sit behind the Documents page's
// pathway redirect.
//
// The A/B/C picker is local state only. Browsing the guide must never silently
// set the pathway on the assessment record; a reader comparing tiers here has
// not made a decision about their dataset.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PATHWAYS } from '../lib/pathway.js';
import { useAssessment } from '../state/assessment.jsx';
import { generateCollectionGuide } from '../generators/collectionGuide.js';
import CollectionGuide from '../components/CollectionGuide.jsx';
import CollectionGuidePrint from '../components/CollectionGuidePrint.jsx';
import { download, guideFilename } from '../lib/download.js';

export default function Guide() {
  const { state } = useAssessment();
  // Default to the fullest set: the tiers are cumulative, so Pathway C contains
  // everything A and B require, and each worksheet row is tagged with its level.
  const [preview, setPreview] = useState(state.pathway ?? 'C');
  const chosen = Boolean(state.pathway);
  const record = chosen ? state : { ...state, pathway: preview, sub_domain: preview === 'C' ? (state.sub_domain ?? 'general') : null };

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">
            Before you have data
          </span>
          <h2 className="mt-1 text-xl font-semibold">Research data collection guide</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-none bg-guide-btn px-4 py-2 text-sm font-medium text-guide-btn-fg hover:opacity-90"
          >
            Save as PDF
          </button>
          <button
            type="button"
            onClick={() => download(guideFilename(record), generateCollectionGuide(record), 'text/markdown')}
            className="rounded-none border border-line px-4 py-2 text-sm hover:bg-idle-bg"
          >
            Download .md
          </button>
        </div>
      </div>

      <p className="mt-2 max-w-[70ch] text-sm text-muted print:hidden">
        What to write down while the work is happening, so the assessment and its artifacts are
        fillable later. &ldquo;Save as PDF&rdquo; opens your browser&rsquo;s print dialog, where you
        can choose to save rather than print; the filename comes from there.
      </p>

      {!chosen && (
        <div className="mt-4 flex flex-wrap items-center gap-2 print:hidden">
          <span className="text-xs text-muted">Show the worksheet for:</span>
          {PATHWAYS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreview(p.id)}
              className={`rounded-none border px-3 py-1 text-xs transition-colors ${
                preview === p.id ? 'border-ink bg-surface-2 text-ink' : 'border-line text-muted hover:border-muted'
              }`}
            >
              {p.id} — {p.name}
            </button>
          ))}
          <span className="text-[0.7rem] text-faint">Preview only. This does not set your pathway.</span>
        </div>
      )}

      {/* Two renderings of the same model: cards on screen, a report on paper. */}
      <div className="mt-6 print:hidden">
        <CollectionGuide record={record} showPathwayPicker={!chosen} />
      </div>
      <div className="hidden print:block">
        <CollectionGuidePrint record={record} />
      </div>

      <p className="mt-8 border-t border-line pt-4 text-xs text-muted print:hidden">
        Ready to start? <Link to="/" className="text-link underline">Choose your starting point</Link>.
      </p>
    </section>
  );
}
