// Wizard step 0 — lifecycle intake. Editorial (CMU-style) layout: full-width
// text, hairline rules under headings, generous whitespace, restrained accent.
// The required starting-point selector stays near the top via a compact carousel.

import { Link, useNavigate } from 'react-router-dom';
import { STAGES } from '../lib/stages.js';
import { THIS_WORK } from '../lib/thisWork.js';
import { LEVELS } from '../lib/dimensions.js';
import { cellText, beyondCellCriteria } from '../lib/pathway.js';
import { useAssessment } from '../state/assessment.jsx';
import Carousel from '../components/Carousel.jsx';
import {
  LadderStrip,
  AutomationNote,
  LadderDetail,
  WhQuestions,
  DocumentationInputs,
} from '../components/guidance.jsx';

const STEPS = [
  ['1', 'Set your context', "Say where you are in the lifecycle and your publishing pathway. That fixes the requirement tier."],
  ['2', 'Assess seven dimensions', 'Answer a short form per dimension. Criteria validate live; a matrix shows met, unmet, or upcoming.'],
  ['3', 'Export the bundle', 'Download the datasheet, Croissant descriptor, PROV-O record, and a conformance report.'],
];

const DOC_LAYERS = [
  ['Datasheet / data card', 'Human-readable disclosure', 'What is it, and how should it be used?'],
  ['Croissant descriptor', 'ML-ready packaging · JSON-LD', 'How does an ML pipeline load it?'],
  ['PROV-O record', 'Operation-level lineage · JSON-LD', 'How was it produced?'],
];

const DIMENSIONS = [
  ['FAIRness', 'Findable, accessible, interoperable, and reusable: the dataset as a published artifact.'],
  ['Provenance', 'Sources, transformations, and versions: how the data came to be.'],
  ['Characterization', 'Distributions, coverage, missingness, and known limitations of the sample.'],
  ['Ethics', 'Consent, privacy, de-identification, licensing, and legitimate use.'],
  ['Pre-model Explainability', 'Semantics of variables, units, encodings, and missingness before any model is fit.'],
  ['Sustainability', 'Long-term access, governance, and the environmental cost of training on the data.'],
  ['Computability', 'Machine-actionable schema and metadata for direct ingestion by ML pipelines.'],
];

// Only the selector below the carousel uses this now; the muted variant went
// with the slide eyebrows.
const Eyebrow = ({ children }) => (
  <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-accent">
    {children}
  </span>
);

// `fill` makes the slide a flex column so a trailing element can claim the
// leftover space with mt-auto. Slides stretch to the height of the tallest, so
// the gap under a short slide varies; a fixed margin cannot track it. Opt-in,
// because turning every slide into a flex container is a layout change the other
// eight do not need.
function Slide({ children, fill = false }) {
  return (
    <div className={`h-full border border-line bg-surface p-8 ${fill ? 'flex flex-col' : ''}`}>
      {children}
    </div>
  );
}

// Header block with a full-width hairline rule beneath (editorial, symmetric).
// Title only: the eyebrows above these headings restated what the title already
// said, and eight of them in a row read as chrome rather than orientation.
function SlideHead({ title }) {
  return (
    <div className="border-b border-line pb-3">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
    </div>
  );
}

// A transition with the process that effects it named on the arrow — the same grammar
// LadderStrip uses for "adopt an ELN; record at the time", and the manuscript's own
// figures use for their boxed edge labels.
function Step({ label, sub }) {
  return (
    <div className="flex w-24 shrink-0 flex-col items-center justify-center px-1 sm:w-32">
      {/* Name of the process, then the arrow it labels, then the checks it consists of.
          The arrow sits between them so the caption above reads as what the transition is
          and the line below as what it involves. */}
      <span className="border border-info-line bg-info-bg px-1.5 py-0.5 text-center text-[0.7rem] font-medium leading-tight text-ink">
        {label}
      </span>
      {/* Drawn as a rule plus a head rather than set as a glyph: an arrow character is
          only as long as its font metrics allow, and this one has to read as the span
          between two states. The line flexes, so the arrow's length follows the column
          width instead of the type size. */}
      <div className="mt-1.5 flex w-full items-center" aria-hidden="true">
        <span className="h-[2px] flex-1 bg-accent" />
        <span className="border-y-[5px] border-l-[9px] border-y-transparent border-l-accent" />
      </div>
      {sub && <span className="mt-1.5 text-center text-[0.6rem] leading-tight text-faint">{sub}</span>}
    </div>
  );
}

function Node({ tone, icon, label, sub }) {
  const tones = {
    closed: 'border-warn-line bg-warn-bg',
    ready: 'border-ok-line bg-ok-bg',
    docs: 'border-dashed border-line bg-surface-2',
  };
  // `sm:flex-1 sm:basis-0 sm:min-w-0` makes the four nodes share whatever width the row
  // has, in equal parts. Fixed widths were a pixel budget against an unknown container,
  // which is why the row kept wrapping; equal flex basis cannot overflow, and equal parts
  // is also what stops the band looking lopsided. `h-full` under an items-stretch parent
  // squares the heights, so a two-line label no longer makes its box taller than the rest.
  return (
    <div
      className={`flex h-full w-36 flex-col items-center justify-center border p-3 text-center sm:w-auto sm:flex-1 sm:basis-0 sm:min-w-0 ${tones[tone]}`}
    >
      <div className="text-xl leading-none" aria-hidden="true">
        {icon}
      </div>
      <div className="mt-1.5 text-[0.8rem] font-semibold leading-tight text-ink">{label}</div>
      <div className="mt-0.5 text-[0.65rem] leading-tight text-muted">{sub}</div>
    </div>
  );
}

// The "FAIR-published + docs -> checked -> machine-learning-ready" node diagram, on
// the overview slide.
//
// Verification is named on the arrow rather than drawn as a box, because the boxes are
// states a dataset is in and verification is something done to it. Until it appeared at
// all, this diagram said that producing the documentation is what makes a dataset
// consumable — the claim §3.5 exists to refute, since machine-readable and
// machine-actionable are not the same property and checking is the distance between them.
// A fourth box also made the row wrap and left the band looking lopsided; an edge label
// carries the same content and costs no width.
//
// At sm and above the nodes take equal flex basis and share the row, so the line holds
// whatever the container width. Below sm they fall back to a fixed width and wrap.
//
// "Three steps" used to reuse it; it now carries DocumentationInputs, which
// says something the numbered steps do not.
function ReadinessDiagram({ className = '' }) {
  return (
    <div className={`border-t border-line pt-6 ${className}`}>
      <div
        className="flex flex-wrap items-stretch justify-center gap-x-1.5 gap-y-2 sm:flex-nowrap sm:gap-x-2"
        role="img"
        aria-label="A FAIR-published but ML-closed dataset, plus documentation layers, once verified, becomes machine-learning-ready: reusable by people and pipelines"
      >
        <Node tone="closed" icon="🔒" label="FAIR-published" sub="findable & accessible, but ML-closed" />
        <span className="flex shrink-0 items-center text-2xl font-light leading-none text-accent" aria-hidden="true">+</span>
        <Node tone="docs" icon="📑" label="Documentation layers" sub="datasheet · Croissant · PROV-O" />
        <Step label="verified" sub="schema · references · grounding" />
        <Node tone="ready" icon="✓" label="ML-ready" sub="reusable by people & pipelines" />
      </div>
    </div>
  );
}

// Cue pointing at the lifecycle selector below the carousel. Must sit on the
// LAST slide, since that is the one adjacent to the selector.
function StartHereCue() {
  return (
    <div className="mt-auto flex flex-col items-center pt-12 text-accent">
      <span className="text-base font-semibold uppercase tracking-wider">Start here</span>
      <span className="mt-3 animate-bounce text-7xl leading-none" aria-hidden="true">↓</span>
    </div>
  );
}

export default function StartingPoint() {
  const { state, dispatch } = useAssessment();
  const navigate = useNavigate();

  const select = (s) => {
    dispatch({ type: 'SET_STAGE', stage: s.id });
    if (s.suggestedPathway && !state.pathway) {
      dispatch({ type: 'SET_PATHWAY', pathway: s.suggestedPathway });
    }
  };

  const canContinue = Boolean(state.stage);

  return (
    <section>
      <Carousel label="About this tool">
        {/* Overview — full-width text, diagram below a rule */}
        <Slide>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-ink text-balance">
            Make a dataset machine-learning-ready: plan it, prepare it, or upgrade it
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted">
            Use it at any point in the lifecycle: while <span className="font-medium text-ink">planning</span>{' '}
            a dataset you&rsquo;re about to collect, while <span className="font-medium text-ink">preparing</span>{' '}
            a collected dataset to publish, or to <span className="font-medium text-ink">upgrade</span> one that
            is already published. A dataset can be fully{' '}
            <a href="https://doi.org/10.1038/sdata.2016.18" target="_blank" rel="noreferrer" className="text-link underline">FAIR</a>{' '}
            and still be unfit to train a model on. This tool runs a tiered assessment, generates the
            machine-readable documentation needed for reuse by people and pipelines, and checks that
            documentation in place &mdash; writing a descriptor and having one a pipeline can act on are
            different things. Not publishing yet? It also exports a to-do plan of what to set up.
          </p>

          <ReadinessDiagram className="mt-8" />

          <p className="mt-6 border-t border-line pt-4 text-xs text-muted">
            This tool implements the framework of{' '}
            <span className="text-ink">{THIS_WORK.authors}</span> ({THIS_WORK.year}).{' '}
            <cite className="italic">{THIS_WORK.title}</cite> [{THIS_WORK.note}]. {THIS_WORK.publisher}.
          </p>
        </Slide>

        {/* Seven dimensions */}
        <Slide>
          <SlideHead title="The seven dimensions" />
          <p className="mt-4 text-xs text-muted">
            Dimensions from Bridge2AI (
            <a href="https://doi.org/10.1101/2024.10.23.619844" target="_blank" rel="noreferrer" className="text-link underline">Clark et al., 2026</a>
            ); levels align to Data Readiness Levels (
            <a href="https://doi.org/10.48550/arXiv.1705.02245" target="_blank" rel="noreferrer" className="text-link underline">Lawrence, 2017</a>
            ) and the FAIR Maturity Indicators (
            <a href="https://doi.org/10.5334/dsj-2020-041" target="_blank" rel="noreferrer" className="text-link underline">Bahim et al., 2020</a>
            ).
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {DIMENSIONS.map(([name, blurb]) => (
              <div key={name} className="border border-line bg-surface-2 p-3">
                <div className="text-sm font-semibold text-ink">{name}</div>
                <p className="mt-0.5 text-xs text-muted">{blurb}</p>
              </div>
            ))}
          </div>
        </Slide>

        {/* Three levels — the assessment matrix (paper §6) */}
        <Slide>
          <SlideHead title="The three readiness levels" />
          {/* Deliberately short. Each level is defined by its consumer, which the column
              headers below carry, and the full per-level meaning lives in the collection
              guide — restating all three here made this the tallest card in the carousel,
              and the carousel stretches every other card to match. The two sentences kept
              are the ones the table cannot say: what the levels measure, and what they do
              not. */}
          <p className="mt-4 text-xs text-muted">
            AI-readiness is a graded property, and each level is defined by what consumes the
            dataset: a person at L1, a person working with a pipeline at L2, an automated or
            semi-automated workflow at L3. The level measures machine-actionability, not
            sensitivity &mdash; data needing strict access control carries it at every level.
            Bands follow the Data Readiness Levels (
            <a href="https://doi.org/10.48550/arXiv.1705.02245" target="_blank" rel="noreferrer" className="text-link underline">Lawrence, 2017</a>
            ).
          </p>

          {/* Wide screens: the full matrix as a table */}
          <div className="mt-4 hidden overflow-x-auto sm:block">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr>
                  <th className="border border-line bg-surface-2 p-2 text-ink">Dimension</th>
                  {LEVELS.map((l) => (
                    <th key={l.id} className="border border-line bg-surface-2 p-2 text-ink">
                      <div className="font-semibold">{l.id} · {l.name}</div>
                      <div className="text-[0.65rem] font-normal text-faint">DRL Band {l.drl_band}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DIMENSIONS.map(([name]) => (
                  <tr key={name}>
                    <th scope="row" className="border border-line bg-surface-2 p-2 align-top font-semibold text-ink">
                      {name}
                    </th>
                    {LEVELS.map((l) => (
                      <td key={l.id} className="border border-line p-2 align-top text-muted">
                        {cellText(name, l.id)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Narrow screens: one block per level, dimensions stacked inside */}
          <div className="mt-4 grid gap-3 sm:hidden">
            {LEVELS.map((l) => (
              <div key={l.id} className="border border-line bg-surface-2 p-3">
                <div className="flex items-baseline justify-between border-b border-line pb-1">
                  <span className="text-sm font-semibold text-ink">{l.id} · {l.name}</span>
                  <span className="text-[0.65rem] text-faint">DRL Band {l.drl_band}</span>
                </div>
                <dl className="mt-2 grid gap-1.5">
                  {DIMENSIONS.map(([name]) => (
                    <div key={name}>
                      <dt className="text-[0.7rem] font-semibold text-ink">{name}</dt>
                      <dd className="text-[0.7rem] text-muted">{cellText(name, l.id)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[0.7rem] text-muted">
            Adapted from the AI-readiness assessment matrix in{' '}
            <span className="text-ink">{THIS_WORK.authors}</span> ({THIS_WORK.year}).
          </p>

          {/* Each cell above expands to several checkable criteria. A few of those
              ask for something the cell wording does not name, so the extras are
              attributed here rather than left for a reader to spot. */}
          {beyondCellCriteria().length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[0.7rem] text-muted">
                Each cell expands to several criteria in the assessment —{' '}
                {beyondCellCriteria().length} ask for something the cell wording does not name
              </summary>
              <ul className="mt-2 space-y-1.5 text-[0.7rem] text-muted">
                {beyondCellCriteria().map((c) => (
                  <li key={c.id}>
                    <span className="text-ink">{c.label}</span> ({c.dimension} · {c.level}) —{' '}
                    {c.beyond_cell.note} <span className="text-faint">{c.beyond_cell.source}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Slide>

        {/* How it works */}
        {/* How the raw observation becomes those layers: the shape of the path */}
        <Slide>
          <SlideHead title="From notes to machine-actionable" />
          <p className="mt-4 text-sm text-muted">
            The documentation layers are the last of four forms an experimental record passes
            through, starting at the bench or the job script. The obligation to adopt a standard
            strengthens at every step.
          </p>

          <LadderStrip className="mt-5" />
          <AutomationNote className="mt-4" />

          <p className="mt-4 text-xs text-muted">
            Each form is cheap to produce while standing on the one before it. Retrofitting the one
            above, after the run is over, is where the cost lands. Metadata as the wh-questions:{' '}
            <a href="https://doi.org/10.1038/s41597-023-02501-8" target="_blank" rel="noreferrer" className="text-link underline">
              Ghiringhelli et al., 2023
            </a>
            .
          </p>
        </Slide>

        {/* The first two forms: still read by a person */}
        <Slide>
          <SlideHead title="Forms a person reads" />
          <p className="mt-4 text-sm text-muted">
            One XRD observation carried up the ladder. In the first two forms the record is written
            for a human, and a human is what it takes to get a value back out.
          </p>

          <LadderDetail className="mt-5" slice={[0, 2]} />
        </Slide>

        {/* The last two forms: read by a parser, then by a tool */}
        <Slide>
          <SlideHead title="Forms a machine reads" />
          <p className="mt-4 text-sm text-muted">
            The same observation once it is structured, and again once its terms are bound to shared
            vocabularies. A parser can consume the third form; a tool can act on the fourth.
          </p>

          <LadderDetail className="mt-5" slice={[2, 4]} />

          <p className="mt-4 text-xs text-muted">
            <Link to="/guide" className="text-link underline">Open the collection guide</Link> for the
            full worksheet of what to record, grouped by the stage at which it is still capturable.
          </p>
        </Slide>

        {/* What to capture, and where each answer lands */}
        <Slide>
          <SlideHead title="What to write down while you work" />
          <p className="mt-4 text-sm text-muted">
            Six questions cover almost everything the assessment will ask for later. Each answer
            lands in a different artifact — which is why the tool produces more than one.
          </p>
          <WhQuestions className="mt-4" />
          <p className="mt-3 text-xs text-muted">
            Captured while the run happens, this record is a flight recorder. Reconstructed
            afterwards it is a witness statement, and at high throughput, where nobody is taking
            notes, it is silence. The{' '}
            <Link to="/guide" className="text-link underline">collection guide</Link> lists every
            observation this assessment will ask for, grouped by when it is still capturable:{' '}
            <a href="https://doi.org/10.1038/s41597-020-00638-4" target="_blank" rel="noreferrer" className="text-link underline">
              Huber et al., 2020
            </a>
            .
          </p>
        </Slide>
        <Slide>
          <SlideHead title="Three steps" />
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {STEPS.map(([n, title, body]) => (
              <div key={n} className="border border-line bg-surface-2 p-4">
                <span className="grid h-6 w-6 place-items-center bg-accent text-xs font-bold text-white">{n}</span>
                <h3 className="mt-2 text-sm font-semibold text-ink">{title}</h3>
                <p className="mt-1 text-xs text-muted">{body}</p>
              </div>
            ))}
          </div>

          <DocumentationInputs compact className="mt-8 border-t border-line pt-6" />
        </Slide>

        {/* Documentation layers — last slide, so it carries the Start here cue */}
        <Slide fill>
          <SlideHead title="The documentation layers" />
          <p className="mt-4 text-sm text-muted">
            Three machine-readable layers compose into a machine-learning-ready dataset. Each answers a different
            question, and none replaces the others.
          </p>
          <div className="mt-4 grid gap-2">
            {DOC_LAYERS.map(([name, fmt, q]) => (
              <div key={name} className="flex items-center justify-between gap-3 border border-line bg-surface-2 p-3">
                <div>
                  <div className="text-sm font-semibold text-ink">{name}</div>
                  <div className="text-[0.7rem] text-muted">{fmt}</div>
                </div>
                <div className="max-w-[46%] text-right text-xs italic text-muted">{q}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            Datasheets (
            <a href="https://doi.org/10.1145/3458723" target="_blank" rel="noreferrer" className="text-link underline">Gebru et al., 2021</a>
            ), Croissant (
            <a href="https://doi.org/10.1145/3650203.3663326" target="_blank" rel="noreferrer" className="text-link underline">Akhtar et al., 2024</a>
            ), PROV-O (
            <a href="https://www.w3.org/TR/prov-o/" target="_blank" rel="noreferrer" className="text-link underline">Lebo et al., 2013</a>
            ).
          </p>

          <StartHereCue />
        </Slide>
      </Carousel>

      <p className="mt-4 text-center text-xs text-muted">
        Prefer to see it filled in? <Link to="/examples" className="text-link underline">Load a worked example</Link>.
      </p>

      {/* Starting point, required (editorial: eyebrow + rule, not a highlight box) */}
      <div className="mt-6">
        <div className="border-b border-line pb-3">
          <Eyebrow>Start here · required</Eyebrow>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
            Where are you in the dataset lifecycle?
          </h2>
          <p className="mt-2 max-w-[70ch] text-sm text-muted">
            This tailors the guidance. It doesn&rsquo;t change which criteria apply (your audience, in
            the next step, does that), but it frames them for your situation. Choose one to continue.
          </p>
        </div>

        <div className="mt-5 grid gap-3">
          {STAGES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => select(s)}
              aria-pressed={state.stage === s.id}
              className={`w-full border p-4 text-left transition-colors ${
                state.stage === s.id ? 'border-ink ring-1 ring-ink' : 'border-line hover:border-muted'
              }`}
            >
              <span className="font-semibold">{s.title}</span>
              <p className="mt-1 text-sm text-muted">{s.question}</p>
            </button>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            disabled={!canContinue}
            onClick={() => navigate('/audience')}
            className={`px-5 py-2 text-sm font-medium transition-colors ${
              canContinue ? 'bg-brand-btn text-surface hover:opacity-90' : 'cursor-not-allowed bg-idle-bg text-idle'
            }`}
          >
            Continue →
          </button>
          {!canContinue && (
            <span className="text-xs text-muted">Select your starting point to continue.</span>
          )}
        </div>
      </div>
    </section>
  );
}
