// The collection guide, rendered as a document. Shared by the standalone /guide
// route and the Export tab; they differ only in whether a pathway is already
// known, which is what `showPathwayPicker` controls.
//
// Rendered as HTML rather than a <pre> of the Markdown because this is the
// printable artifact: real headings, page-break control, and the same blocks the
// intro cards use. The Markdown generator remains the download format.
//
// Deliberately read-only. The other Export tabs are editable because those
// artifacts are the deliverable and get tuned before download; this one is
// derived from the schema and the answers, so an edit would be discarded the
// moment either changed, and there is nothing to validate it against.

import { buildCollectionGuide, citationHref, citationText } from '../generators/collectionGuide.js';
import guidanceDoc from '../schema/guidance.json';
import {
  LadderStrip,
  AutomationNote,
  LadderDetail,
  DegreesStrip,
  VerificationModes,
  ValidationChecks,
  Stewardship,
  WorkflowStrip,
  WhQuestions,
  DocumentationInputs,
} from './guidance.jsx';

// Mode tones come from guidance.json, the same source the chips on every criterion
// and the scorecard panel read, so one row cannot disagree with another.
const MODE_TAG = Object.fromEntries(
  guidanceDoc.verification_modes.modes.map((m) => [m.id, m.tone]),
);

const LEVEL_TAG = {
  L1: 'bg-idle-bg text-idle',
  L2: 'bg-info-bg text-info',
  L3: 'bg-warn-bg text-warn',
};

// Inline attribution under a section, naming the works its claims come from.
// The full reference for each is in the Sources section at the end.
function Sources({ refs }) {
  if (!refs?.length) return null;
  return (
    <p className="mt-3 text-xs text-faint">
      Sources: {refs.map((c) => `${c.authors} (${c.year})`).join('; ')}.
    </p>
  );
}

function Section({ id, title, lead, children }) {
  return (
    <section id={id} className="mt-8 break-inside-avoid">
      <h3 className="border-b border-line pb-2 text-base font-semibold text-ink">{title}</h3>
      {lead && <p className="mt-2 text-sm text-muted">{lead}</p>}
      {children}
    </section>
  );
}

export default function CollectionGuide({ record, showPathwayPicker = false }) {
  const g = buildCollectionGuide(record);

  return (
    <article className="text-ink">
      <header className="break-inside-avoid">
        <h2 className="text-xl font-semibold">
          What to collect{g.meta.datasetName ? ` — ${g.meta.datasetName}` : ''}
        </h2>
        <p className="mt-1 text-sm text-muted">
          A worksheet for the observations behind the assessment: what to write down, and when.
        </p>
        <p className="mt-2 text-xs text-faint">
          Pathway {g.meta.pathway} — {g.meta.pathwayName} ({g.meta.level})
          {g.meta.subDomain ? ` · ${g.meta.subDomain}` : ''}
          {g.meta.stage ? ` · ${g.meta.stage}` : ''} · {g.meta.recorded} of {g.meta.total} already
          recorded in the tool
        </p>
      </header>

      {showPathwayPicker && (
        <p className="mt-3 border border-warn-line bg-warn-bg p-3 text-xs text-warn">
          No pathway selected yet, so the worksheet below shows the Task-ready (L3) set, which is the
          fullest one. Because the tiers are cumulative, it contains everything the lower tiers ask
          for; each row is tagged with the level it belongs to.
        </p>
      )}

      {/* No lead here: WorkflowStrip opens with the paragraph from guidance.json, and a
          second sentence above it said the same thing twice. */}
      <Section id="workflow" title="The shape of the work">
        <WorkflowStrip className="mt-4" />
      </Section>

      <Section
        id="ladder"
        title="From notes to machine-actionable"
        lead="The documentation layers are the last of four forms an experimental record passes through, starting at the bench or the job script. One XRD observation, carried up:"
      >
        <LadderStrip className="mt-4" />
        <AutomationNote className="mt-3" />
        <LadderDetail className="mt-4" />
        <p className="mt-3 text-xs text-muted">
          Each form is cheap to produce while standing on the one before it. Retrofitting the one
          above, after the run is over, is where the cost lands.
        </p>
        <Sources refs={g.ladderRefs} />
      </Section>

      <Section
        id="degrees"
        title="Degrees of machine-actionability"
        lead="Where the four forms end, five degrees of the resulting file begin. The Conformance step reports these per artifact once you have one."
      >
        <DegreesStrip className="mt-4" />
        <Sources refs={g.degrees.refs} />
      </Section>

      <Section
        id="verification"
        title="How each row is confirmed"
        lead="The worksheet below tags every row with one of three modes. This is what each one asks of you."
      >
        <VerificationModes className="mt-4" />
        <Sources refs={g.verificationModes.refs} />
      </Section>

      <Section
        id="validation"
        title="Validating before release"
        lead="The last point at which a defect introduced earlier is still catchable."
      >
        <ValidationChecks className="mt-4" />
        <Sources refs={g.validation.refs} />
      </Section>

      <Section
        id="stewardship"
        title="After release"
        lead="Deposit is not the end of the obligation. These are the four or five sentences a downstream user needs and rarely gets."
      >
        <Stewardship className="mt-4" />
        <Sources refs={g.stewardship.refs} />
      </Section>

      <Section
        id="questions"
        title="The six questions"
        lead="These cover almost everything the assessment will ask for later. Each answer lands in a different artifact, which is why the tool produces more than one."
      >
        <WhQuestions className="mt-4" />
        <Sources refs={g.whQuestionsRefs} />
      </Section>

      <Section
        id="inputs"
        title="What builds each layer"
        lead="The records below are the raw material for the three released artifacts. Most of them already exist somewhere in a project; the work is routing them."
      >
        <DocumentationInputs className="mt-4" />
        <Sources refs={g.documentationInputs.refs} />
      </Section>

      <Section
        id="run-log"
        title="Per-run log"
        lead="Repeat once per run, sample, or job. Fill it while the work is happening."
      >
        <ul className="mt-4 grid gap-2">
          {g.runLogFields.map((f) => (
            <li key={f} className="flex items-baseline gap-2 border-b border-dashed border-line pb-2 text-sm">
              <span className="inline-block h-3 w-3 shrink-0 border border-line" aria-hidden="true" />
              <span className="shrink-0 text-muted">{f}</span>
              <span className="grow" />
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="worksheet"
        title="Worksheet"
        lead="Everything this pathway will ask for, in the order the work happens. Ticked rows are already recorded in the tool."
      >
        {/* Legend for the row tags, immediately above the rows that carry them. */}
        <div className="mt-4 border border-line bg-surface-2 p-3">
          <p className="text-xs text-muted">{g.levels.lead}</p>
          <ul className="mt-3 grid gap-2">
            {g.levels.rows.map((l) => (
              <li key={l.id} className="flex flex-wrap items-baseline gap-2 text-xs">
                <span className={`px-1 py-0.5 text-[0.65rem] font-medium ${LEVEL_TAG[l.id] ?? ''}`}>{l.id}</span>
                <span className="font-medium text-ink">{l.name}</span>
                <span className="text-faint">DRL {l.drl_band}</span>
                <span className="text-faint">· required in {l.requiredIn.join(', ')}</span>
                <span className="w-full text-muted sm:w-auto sm:flex-1">{l.meaning}</span>
              </li>
            ))}
          </ul>
        </div>

        {g.groups.map((grp) => (
          <div key={grp.stage} className="mt-5 break-inside-avoid">
            <h4 className="text-sm font-semibold text-ink">{grp.title}</h4>
            <p className="mt-1 text-xs italic text-muted">{grp.note}</p>
            <ul className="mt-2 grid gap-2">
              {grp.rows.map((r) => (
                <li key={r.id} className="break-inside-avoid border border-line p-3">
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-0.5 inline-block h-3 w-3 shrink-0 border border-line ${r.satisfied ? 'bg-ok' : ''}`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-sm font-medium text-ink">{r.label}</span>
                        <span className={`px-1 py-0.5 text-[0.65rem] font-medium ${LEVEL_TAG[r.level] ?? ''}`}>
                          {r.level}
                        </span>
                        <span className={`px-1 py-0.5 text-[0.65rem] font-medium ${MODE_TAG[r.mode] ?? ''}`}>
                          {r.mode}
                        </span>
                        <span className="text-[0.7rem] text-faint">{r.dimension}</span>
                      </div>
                      {r.record && (
                        <p className="mt-1 text-xs text-muted">
                          <span className="mr-1 font-mono text-[0.65rem] uppercase tracking-wider text-faint">
                            {r.recordKind === 'none' ? 'Nothing to record yet' : 'Record'}
                          </span>
                          {r.record}
                        </p>
                      )}
                      {r.confirms && (
                        <p className="mt-1 text-xs text-muted">
                          <span className="mr-1 font-mono text-[0.65rem] uppercase tracking-wider text-faint">
                            Confirmed by
                          </span>
                          {r.confirms}
                        </p>
                      )}
                      <p className="mt-1 text-[0.7rem] italic text-faint">Answer format: {r.constraint}.</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Section>

      {g.ontology.applies && (
        <Section
          id="ontology"
          title="Binding terms to shared vocabularies"
          lead="At L3 the consumer needs the meaning of your column, which a field name alone cannot carry."
        >
          <div className="mt-4 grid gap-3">
            {g.ontology.examples.map((ex) => (
              <div key={ex.title} className="break-inside-avoid border border-line p-3">
                <h4 className="text-sm font-semibold text-ink">{ex.title}</h4>
                <p className="mt-2 text-xs text-muted">
                  <span className="font-medium text-ink">As collected:</span>{' '}
                  <code className="font-mono">{ex.as_collected}</code>
                </p>
                <p className="mt-1 text-xs text-muted">
                  <span className="font-medium text-ink">The problem:</span> {ex.problem}
                </p>
                <p className="mt-1 text-xs text-muted">
                  <span className="font-medium text-ink">Machine-actionable:</span> {ex.actionable}
                </p>
                <p className="mt-1 text-xs text-muted">
                  <span className="font-medium text-ink">Why it matters:</span> {ex.why}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section
        id="burden"
        title="Making this less burdensome"
        lead="The first three remove the work. The rest reduce it. None of them decide what matters, which stays yours."
      >
        <div className="mt-4 grid gap-2">
          {g.burden.map((b) => (
            <div key={b.title} className="break-inside-avoid border border-line p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-ink">{b.title}</span>
                <span
                  className={`px-1 py-0.5 text-[0.65rem] font-medium ${
                    b.effect === 'removes' ? 'bg-ok-bg text-ok' : 'bg-info-bg text-info'
                  }`}
                >
                  {b.effect} the work
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">{b.what}</p>
              <p className="mt-1 font-mono text-[0.65rem] text-faint">{b.examples}</p>
              {b.refs.length > 0 && (
                <p className="mt-1 text-[0.65rem] text-faint">
                  {b.refs.map((c) => `${c.authors} (${c.year})`).join('; ')}.
                </p>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="sources"
        title="Sources"
        lead="Works cited above, with resolvable identifiers. They sit in the same registry as the assessment's own references."
      >
        <ol className="mt-4 grid list-inside list-decimal gap-2 text-xs text-muted marker:text-faint">
          {g.sources.map((c) => (
            <li key={c.key} className="break-inside-avoid">
              {citationText(c)}{' '}
              {citationHref(c) && (
                <a href={citationHref(c)} target="_blank" rel="noreferrer" className="break-all text-link underline">
                  {citationHref(c)}
                </a>
              )}
            </li>
          ))}
        </ol>
      </Section>
    </article>
  );
}
