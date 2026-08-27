// Presentational blocks over src/schema/guidance.json, shared by the intro cards
// on the start page and by the generated collection guide.
//
// They live here rather than inline in StartingPoint because both surfaces must
// show the same thing: the cards are the short version a reader meets first, the
// guide is the printable long version, and two implementations of the ladder
// would diverge the way the app and the preprint figure already did once.

import { Fragment } from 'react';
import guidance from '../schema/guidance.json';

// The five phases of the work, as a strip of anchors into the sections below. It exists
// because the guide had a section for each phase and never said they were a sequence — a
// reader could finish it without noticing that verification sits between documenting and
// depositing rather than after.
export function WorkflowStrip({ className = '' }) {
  const { lead, phases } = guidance.workflow;
  return (
    <div className={className}>
      <p className="text-sm text-muted">{lead}</p>
      <ol className="mt-3 grid gap-2 sm:grid-cols-5">
        {phases.map((ph, i) => (
          <li
            key={ph.id}
            className={`border p-3 ${ph.id === 'verify' ? 'border-info-line bg-info-bg' : 'border-line bg-surface-2'}`}
          >
            <a href={`#${ph.anchor}`} className="text-xs font-semibold text-ink hover:underline">
              {i + 1}. {ph.name}
            </a>
            <p className="mt-1 text-[0.7rem] leading-tight text-muted">{ph.what}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

// The four forms an experimental record passes through, as a horizontal strip
// with the intervention that reaches each one. Scrolls rather than wraps: the
// left-to-right progression is the content, so wrapping would misrepresent it.
export function LadderStrip({ className = '' }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <div className="flex min-w-[40rem] items-stretch gap-1">
        {guidance.ladder.map((r) => (
          <Fragment key={r.rung}>
            {r.via && (
              <div className="flex w-24 shrink-0 flex-col items-center justify-center px-1">
                <span className="text-lg leading-none text-accent" aria-hidden="true">→</span>
                <span className="mt-1 text-center text-[0.65rem] leading-tight text-muted">{r.via}</span>
              </div>
            )}
            <div className={`flex-1 border p-3 text-center ${r.tone}`}>
              <div className="text-2xl leading-none" aria-hidden="true">{r.icon}</div>
              <div className="mt-1 text-xs font-semibold text-ink">{r.rung}</div>
              <div className="mt-0.5 text-[0.65rem] leading-tight text-muted">{r.kind}</div>
              <div className="mt-2 border-t border-line pt-1 text-[0.65rem] font-medium text-ink">
                {r.obligation}
              </div>
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

// Where the record is written by machine the progression is bypassed entirely.
export function AutomationNote({ className = '' }) {
  const a = guidance.automation;
  return (
    <div className={`border border-dashed border-accent bg-surface-2 p-3 ${className}`}>
      <div className="flex items-baseline gap-2">
        <span className="text-base leading-none" aria-hidden="true">{a.icon}</span>
        <span className="text-xs font-semibold text-ink">{a.title}</span>
      </div>
      <p className="mt-1 text-xs text-muted">{a.text}</p>
      <p className="mt-1 font-mono text-[0.65rem] text-faint">{a.examples}</p>
    </div>
  );
}

// One block per form: the record as it looks, what it buys, what it withholds.
// `slice` renders a contiguous subset, so the start page can split the four forms
// across two cards without either one becoming an outlier in height. Omitted, all
// four render, which is what the printable guide wants.
export function LadderDetail({ className = '', slice }) {
  const forms = slice ? guidance.ladder.slice(slice[0], slice[1]) : guidance.ladder;
  return (
    <div className={`grid gap-2 ${className}`}>
      {forms.map((r) => (
        <div key={r.rung} className="break-inside-avoid border border-line p-3">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-base leading-none" aria-hidden="true">{r.icon}</span>
            <span className="text-sm font-semibold text-ink">{r.rung}</span>
            <span className="text-[0.7rem] text-muted">{r.obligation}</span>
          </div>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap border border-line bg-surface p-2 font-mono text-[0.7rem] text-ink">
            {r.sample}
          </pre>
          <p className="mt-2 text-xs text-muted">
            <span className="font-medium text-ink">Gains:</span> {r.gains}{' '}
            <span className="font-medium text-ink">Still out of reach:</span> {r.out_of_reach}
          </p>
          <p className="mt-1 text-xs text-muted">
            <span className="font-medium text-ink">Standards:</span> {r.standards}
          </p>
        </div>
      ))}
    </div>
  );
}

// The five degrees of machine-actionability, which pick up where the four forms
// leave off: the forms describe laboratory practice, the degrees describe the file
// that comes out of it. Rendered directly under the ladder for that reason — the
// bridge between the two is the point, and separating them would lose it. The
// Conformance page shows the same five rungs as a live verdict per artifact.
export function DegreesStrip({ className = '' }) {
  const { lead, scope_note: scopeNote, rungs } = guidance.degrees;
  return (
    <div className={className}>
      <p className="text-sm text-muted">{lead}</p>
      <div className="mt-3 overflow-x-auto">
        <div className="flex min-w-[40rem] items-stretch gap-1">
          {rungs.map((r, i) => (
            <Fragment key={r.id}>
              {i > 0 && (
                <div className="flex w-6 shrink-0 items-center justify-center">
                  <span className="text-lg leading-none text-accent" aria-hidden="true">→</span>
                </div>
              )}
              <div className={`flex-1 border p-3 ${r.tone}`}>
                <div className="text-xs font-semibold text-ink">{r.label}</div>
                <div className="mt-1 border-t border-line pt-1 text-[0.65rem] leading-tight text-muted">
                  {r.check}
                </div>
              </div>
            </Fragment>
          ))}
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        {rungs.map((r) => (
          <p key={r.id} className="break-inside-avoid text-xs text-muted">
            <span className="font-medium text-ink">{r.label}.</span> {r.means}
          </p>
        ))}
      </div>
      <p className="mt-3 border border-dashed border-line bg-surface-2 p-3 text-xs text-muted">
        {scopeNote}
      </p>
    </div>
  );
}

// The three verification modes and what each requires of the user. The chips on
// every criterion carry these labels; until this block existed, nothing said what
// they meant.
export function VerificationModes({ className = '' }) {
  const { lead, modes, note } = guidance.verification_modes;
  return (
    <div className={className}>
      <p className="text-sm text-muted">{lead}</p>
      <div className="mt-3 grid gap-2">
        {modes.map((m) => (
          <div key={m.id} className="break-inside-avoid border border-line p-3">
            <span className={`px-1.5 py-0.5 text-[0.65rem] font-medium ${m.tone}`}>{m.label}</span>
            <p className="mt-1.5 text-xs text-muted">{m.definition}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs italic text-faint">{note}</p>
    </div>
  );
}

// The five categories of validation check, and what settles each. Placed in the guide
// because validation is the last stage at which an earlier defect is still catchable —
// after release it is an erratum and a model somebody already trained.
export function ValidationChecks({ className = '' }) {
  const v = guidance.validation;
  return (
    <div className={className}>
      <p className="text-sm text-muted">{v.lead}</p>
      <div className="mt-3 grid gap-2">
        {v.categories.map((c) => (
          <div key={c.id} className={`break-inside-avoid border p-3 ${c.tone}`}>
            <span className="text-sm font-semibold text-ink">{c.name}</span>
            <p className="mt-1 text-xs text-muted">{c.check}</p>
            <p className="mt-1 text-[0.7rem] text-faint">{c.tools}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 border-l-2 border-accent pl-3 text-xs text-muted">{v.report_note}</p>
      <p className="mt-2 text-xs text-muted">{v.pipeline_note}</p>
      <p className="mt-2 text-xs text-muted">{v.lookup_note}</p>
    </div>
  );
}

// What release does not end. The stewardship layer the paper argues is the actual
// rate-limiting factor for AI adoption in science.
export function Stewardship({ className = '' }) {
  const st = guidance.stewardship;
  return (
    <div className={className}>
      <p className="text-sm text-muted">{st.lead}</p>
      <dl className="mt-3 grid gap-2">
        {st.practices.map((x) => (
          <div key={x.id} className="break-inside-avoid border border-line p-3">
            <dt className="text-sm font-semibold text-ink">{x.name}</dt>
            <dd className="mt-1 text-xs text-muted">{x.what}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// The six wh-questions and the artifact each answer lands in.
export function WhQuestions({ className = '' }) {
  return (
    <div className={`grid gap-2 ${className}`}>
      {guidance.wh_questions.map((w) => (
        <div key={w.q} className="break-inside-avoid border border-line bg-surface-2 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-mono text-sm font-semibold text-accent">{w.q}</span>
            <span className="text-[0.7rem] italic text-muted">{w.lands}</span>
          </div>
          <p className="mt-1 text-xs text-muted">{w.record}</p>
        </div>
      ))}
    </div>
  );
}

// What already exists in a lab or a repo, mapped onto the layer it populates,
// over a band of the identifier and vocabulary schemes that ground all three.
// `compact` is for the start-page card, where this block sits under three numbered steps
// and the full per-layer reasoning made that slide the tallest in the carousel — which
// stretches every other card to match. Same content, two densities, one source: the card
// shows what checks each layer, the guide says why it is checked that way.
export function DocumentationInputs({ className = '', compact = false }) {
  const { layers, grounding, verification_note: verificationNote } = guidance.documentation_inputs;
  return (
    <div className={className}>
      <div className="grid gap-3 sm:grid-cols-3">
        {layers.map((l) => (
          <div key={l.layer} className="flex flex-col break-inside-avoid">
            <div className={`border p-2 text-center text-sm font-semibold text-ink ${l.tone}`}>
              {l.layer}
            </div>
            <span className="my-1 text-center text-lg leading-none text-accent" aria-hidden="true">↑</span>
            <ul className="grid gap-1">
              {l.sources.map((s) => (
                <li key={s} className="border border-line bg-surface px-2 py-1 text-[0.7rem] text-muted">
                  {s}
                </li>
              ))}
            </ul>
            {/* What checks this layer. Producing the three artifacts is not the same as
                having three a consumer can act on, and one of them is not checked
                mechanically at all — saying so per layer is more honest than a single
                band implying they are verified alike. */}
            {(compact ? l.checked_by_short : l.checked_by) && (
              <p className="mt-2 border-t border-line pt-2 text-[0.7rem] text-muted">
                <span className="font-medium text-ink">Checked by:</span>{' '}
                {compact ? l.checked_by_short : l.checked_by}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* One line, not a block: the per-layer lines above already name what verifies each
          artifact, so this only has to say where the discipline verifiers live. */}
      {!compact && verificationNote && (
        <p className="mt-3 text-[0.7rem] text-muted">{verificationNote}</p>
      )}

      <div className="mt-3 flex justify-center gap-16 text-lg leading-none text-accent" aria-hidden="true">
        <span>↑</span>
        <span>↑</span>
        <span>↑</span>
      </div>

      <div className="mt-1 border border-dashed border-line bg-surface-2 p-3 text-center">
        <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">
          {grounding.label}
        </span>
        <p className="mt-1 font-mono text-xs text-ink">{grounding.schemes.join(' · ')}</p>
        <p className="mt-1 text-[0.7rem] text-muted">{grounding.note}</p>
      </div>
    </div>
  );
}
