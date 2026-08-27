// Paper rendering of the collection guide. A separate tree from the on-screen
// component rather than a print stylesheet over it, because the two want
// genuinely different documents: the screen version is a set of bordered cards
// you scroll, and this is a report you read in sequence and hold.
//
// Differences that matter on paper:
//   * serif body, sized in points, with a measured line length;
//   * numbered sections and a contents list, so a printed copy can be navigated;
//   * tables and ruled lists in place of chips and coloured panels, since colour
//     fills are unreliable in greyscale and cost ink for nothing;
//   * a masthead and a colophon, so a page found on its own still says what it
//     is, which pathway it describes, and when it was generated.
//
// Both trees read the same model from buildCollectionGuide, so the paper and the
// screen cannot disagree about content. Styling lives under `.guide-print` in
// tailwind.css rather than in utilities, which is what lets this look like a
// document instead of a web page.

import { buildCollectionGuide, citationHref, citationText } from '../generators/collectionGuide.js';
import { citeThisWork } from '../lib/thisWork.js';

// Section numbering is positional: the ontology section only appears at L3, so
// the numbers are assigned at render time rather than hard-coded.
const useSections = (g) =>
  [
    { id: 'workflow', title: 'The shape of the work' },
    { id: 'forms', title: 'The four forms of a record' },
    { id: 'degrees', title: 'Degrees of machine-actionability' },
    { id: 'verification', title: 'How each row is confirmed' },
    { id: 'validation', title: 'Validating before release' },
    { id: 'stewardship', title: 'After release' },
    { id: 'questions', title: 'The six questions' },
    { id: 'layers', title: 'What builds each documentation layer' },
    { id: 'runlog', title: 'Per-run log' },
    { id: 'worksheet', title: 'Worksheet: what to record, and when' },
    g.ontology.applies ? { id: 'ontology', title: 'Binding terms to shared vocabularies' } : null,
    { id: 'burden', title: 'Reducing the burden' },
    { id: 'sources', title: 'Sources' },
  ]
    .filter(Boolean)
    .map((s, i) => ({ ...s, n: i + 1 }));

export default function CollectionGuidePrint({ record }) {
  const g = buildCollectionGuide(record);
  const sections = useSections(g);
  const n = (id) => sections.find((s) => s.id === id)?.n;

  return (
    <div className="guide-print" lang="en">
      <header className="gp-masthead">
        <p className="gp-eyebrow">Research data collection guide</p>
        <h1>{g.meta.datasetName || 'What to collect'}</h1>
        <p className="gp-standfirst">
          What to write down while the work is happening, so the assessment and the documents it
          produces are fillable later.
        </p>
        <dl className="gp-meta">
          <div>
            <dt>Pathway</dt>
            <dd>
              {g.meta.pathway} · {g.meta.pathwayName} ({g.meta.level})
              {g.meta.subDomain ? ` · ${g.meta.subDomain}` : ''}
            </dd>
          </div>
          {g.meta.stage && (
            <div>
              <dt>Starting point</dt>
              <dd>{g.meta.stage}</dd>
            </div>
          )}
          <div>
            <dt>Items to record</dt>
            <dd>
              {g.meta.total} ({g.meta.recorded} already recorded)
            </dd>
          </div>
          <div>
            <dt>Generated</dt>
            <dd>{g.meta.generated.slice(0, 10)}</dd>
          </div>
        </dl>
      </header>

      <nav className="gp-contents" aria-label="Contents">
        <h2>Contents</h2>
        <ol>
          {sections.map((s) => (
            <li key={s.id}>{s.title}</li>
          ))}
        </ol>
      </nav>

      {/* the five phases, so the sections below read as a sequence */}
      <section className="gp-section">
        <h2>{n('workflow')}. The shape of the work</h2>
        <p>{g.workflow.lead}</p>
        <ol className="gp-sources">
          {g.workflow.phases.map((ph) => (
            <li key={ph.id}>
              <b>{ph.name}.</b> {ph.what}
            </li>
          ))}
        </ol>
      </section>

      {/* 1 — the ladder */}
      <section className="gp-section">
        <h2>
          {n('forms')}. The four forms of a record
        </h2>
        <p>
          The documentation layers are the last of four forms an experimental record passes through,
          starting at the bench or the job script. The obligation to adopt a standard strengthens at
          every step. One observation, carried up:
        </p>

        <table className="gp-table">
          <thead>
            <tr>
              <th>Form</th>
              <th>Reached by</th>
              <th>What it gains</th>
              <th>What stays out of reach</th>
            </tr>
          </thead>
          <tbody>
            {g.ladder.map((r) => (
              <tr key={r.rung}>
                <th scope="row">
                  {r.rung}
                  <span className="gp-note">{r.obligation}</span>
                </th>
                <td>{r.via ?? '—'}</td>
                <td>{r.gains}</td>
                <td>{r.out_of_reach}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {g.ladder.map((r) => (
          <div key={r.rung} className="gp-example">
            <h3>{r.rung}</h3>
            <pre>{r.sample}</pre>
            <p className="gp-standards">
              <span>Standards.</span> {r.standards}
            </p>
          </div>
        ))}

        <div className="gp-callout">
          <h3>{g.automation.title}</h3>
          <p>{g.automation.text}</p>
          <p className="gp-note">{g.automation.examples}</p>
        </div>

        <p>
          Each form is cheap to produce while standing on the one before it. Retrofitting the one
          above, after the run is over, is where the cost lands.
        </p>
        <p className="gp-note">
          Sources: {g.ladderRefs.map((c) => `${c.authors} (${c.year})`).join('; ')}.
        </p>
      </section>

      {/* the degrees ladder — where the four forms end */}
      <section className="gp-section">
        <h2>{n('degrees')}. Degrees of machine-actionability</h2>
        <p>{g.degrees.lead}</p>
        <dl className="gp-defs">
          {g.degrees.rungs.map((r) => (
            <div key={r.id}>
              <dt>{r.label}</dt>
              <dd>
                <em>{r.check}.</em> {r.means}
              </dd>
            </div>
          ))}
        </dl>
        <p>{g.degrees.scope_note}</p>
        <p className="gp-note">
          Sources: {g.degrees.refs.map((c) => `${c.authors} (${c.year})`).join('; ')}.
        </p>
      </section>

      {/* the three verification modes the worksheet rows are tagged with */}
      <section className="gp-section">
        <h2>{n('verification')}. How each row is confirmed</h2>
        <p>{g.verificationModes.lead}</p>
        <dl className="gp-defs">
          {g.verificationModes.modes.map((m) => (
            <div key={m.id}>
              <dt>{m.label}</dt>
              <dd>{m.definition}</dd>
            </div>
          ))}
        </dl>
        <p>{g.verificationModes.note}</p>
        <p className="gp-note">
          Sources: {g.verificationModes.refs.map((c) => `${c.authors} (${c.year})`).join('; ')}.
        </p>
      </section>

      {/* the five validation categories */}
      <section className="gp-section">
        <h2>{n('validation')}. Validating before release</h2>
        <p>{g.validation.lead}</p>
        <dl className="gp-defs">
          {g.validation.categories.map((c) => (
            <div key={c.id}>
              <dt>{c.name}</dt>
              <dd>
                {c.check} <em>{c.tools}</em>
              </dd>
            </div>
          ))}
        </dl>
        <p>{g.validation.report_note}</p>
        <p>{g.validation.pipeline_note}</p>
        <p>{g.validation.lookup_note}</p>
        <p className="gp-note">
          Sources: {g.validation.refs.map((c) => `${c.authors} (${c.year})`).join('; ')}.
        </p>
      </section>

      {/* what release does not end */}
      <section className="gp-section">
        <h2>{n('stewardship')}. After release</h2>
        <p>{g.stewardship.lead}</p>
        <dl className="gp-defs">
          {g.stewardship.practices.map((x) => (
            <div key={x.id}>
              <dt>{x.name}</dt>
              <dd>{x.what}</dd>
            </div>
          ))}
        </dl>
        <p className="gp-note">
          Sources: {g.stewardship.refs.map((c) => `${c.authors} (${c.year})`).join('; ')}.
        </p>
      </section>

      {/* wh-questions */}
      <section className="gp-section">
        <h2>{n('questions')}. The six questions</h2>
        <p>
          These cover almost everything the assessment asks for later. Each answer lands in a
          different artifact, which is why the tool produces more than one.
        </p>
        <table className="gp-table">
          <thead>
            <tr>
              <th>Question</th>
              <th>What to record</th>
              <th>Lands in</th>
            </tr>
          </thead>
          <tbody>
            {g.whQuestions.map((w) => (
              <tr key={w.q}>
                <th scope="row">{w.q}</th>
                <td>{w.record}</td>
                <td>{w.lands}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="gp-note">
          Sources: {g.whQuestionsRefs.map((c) => `${c.authors} (${c.year})`).join('; ')}.
        </p>
      </section>

      {/* 3 — documentation inputs */}
      <section className="gp-section">
        <h2>{n('layers')}. What builds each documentation layer</h2>
        <p>
          The records below are the raw material for the three released artifacts. Most already exist
          somewhere in a project; the work is routing them.
        </p>
        <dl className="gp-defs">
          {g.documentationInputs.layers.map((l) => (
            <div key={l.layer}>
              <dt>{l.layer}</dt>
              <dd>
                {l.sources.join(' · ')}
                {l.checked_by ? <> &mdash; <em>checked by:</em> {l.checked_by}</> : null}
              </dd>
            </div>
          ))}
          <div>
            <dt>{g.documentationInputs.grounding.label}</dt>
            <dd>
              {g.documentationInputs.grounding.schemes.join(' · ')}.{' '}
              {g.documentationInputs.grounding.note}
            </dd>
          </div>
        </dl>
        {g.documentationInputs.verification_note && <p>{g.documentationInputs.verification_note}</p>}
        <p className="gp-note">
          Sources: {g.documentationInputs.refs.map((c) => `${c.authors} (${c.year})`).join('; ')}.
        </p>
      </section>

      {/* 4 — run log */}
      <section className="gp-section">
        <h2>{n('runlog')}. Per-run log</h2>
        <p>Repeat once per run, sample, or job. Fill it while the work is happening.</p>
        <ul className="gp-fill">
          {g.runLogFields.map((f) => (
            <li key={f}>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 5 — worksheet */}
      <section className="gp-section gp-break">
        <h2>{n('worksheet')}. Worksheet: what to record, and when</h2>
        <p>{g.levels.lead}</p>
        <table className="gp-table">
          <thead>
            <tr>
              <th>Level</th>
              <th>Name</th>
              <th>DRL</th>
              <th>Required in</th>
              <th>What it is for</th>
            </tr>
          </thead>
          <tbody>
            {g.levels.rows.map((l) => (
              <tr key={l.id}>
                <th scope="row">{l.id}</th>
                <td>{l.name}</td>
                <td>{l.drl_band}</td>
                <td>{l.requiredIn.join(', ')}</td>
                <td>{l.meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {g.groups.map((grp) => (
          <div key={grp.stage} className="gp-group">
            <h3>{grp.title}</h3>
            <p className="gp-note">{grp.note}</p>
            <ul className="gp-checklist">
              {grp.rows.map((r) => (
                <li key={r.id}>
                  <span className={`gp-box${r.satisfied ? ' gp-box-done' : ''}`} aria-hidden="true" />
                  <div>
                    <p className="gp-item">
                      {r.label} <span className="gp-tag">{r.level}</span>{' '}
                      <span className="gp-note">{r.dimension}</span>
                    </p>
                    {r.record && (
                      <p className="gp-detail">
                        <b>{r.recordKind === 'none' ? 'Nothing to record in advance.' : 'Record.'}</b>{' '}
                        {r.record}
                      </p>
                    )}
                    {r.confirms && (
                      <p className="gp-detail">
                        <b>Confirmed by ({r.mode}).</b> {r.confirms}
                      </p>
                    )}
                    <p className="gp-detail gp-italic">Answer format: {r.constraint}.</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {/* 6 — ontology, L3 only */}
      {g.ontology.applies && (
        <section className="gp-section gp-break">
          <h2>{n('ontology')}. Binding terms to shared vocabularies</h2>
          <p>
            At L3 the consumer needs the meaning of a column, which a field name alone cannot
            carry.
          </p>
          {g.ontology.examples.map((ex) => (
            <div key={ex.title} className="gp-example">
              <h3>{ex.title}</h3>
              <dl className="gp-defs gp-defs-tight">
                <div>
                  <dt>As collected</dt>
                  <dd>
                    <code>{ex.as_collected}</code>
                  </dd>
                </div>
                <div>
                  <dt>The problem</dt>
                  <dd>{ex.problem}</dd>
                </div>
                <div>
                  <dt>Machine-actionable</dt>
                  <dd>{ex.actionable}</dd>
                </div>
                <div>
                  <dt>Why it matters</dt>
                  <dd>{ex.why}</dd>
                </div>
              </dl>
            </div>
          ))}
        </section>
      )}

      {/* 7 — burden */}
      <section className="gp-section">
        <h2>{n('burden')}. Reducing the burden</h2>
        <p>
          The first three remove the work. The rest reduce it. None of them decide what matters,
          which stays with the researcher.
        </p>
        <dl className="gp-defs">
          {g.burden.map((b) => (
            <div key={b.title}>
              <dt>
                {b.title}
                <span className="gp-note">{b.effect} the work</span>
              </dt>
              <dd>
                {b.what} <span className="gp-note">{b.examples}</span>
                {b.refs.length > 0 && (
                  <span className="gp-note">
                    {' '}
                    {b.refs.map((c) => `${c.authors} (${c.year})`).join('; ')}.
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 8 — sources */}
      <section className="gp-section">
        <h2>{n('sources')}. Sources</h2>
        <p>Works cited above, with resolvable identifiers.</p>
        <ol className="gp-sources">
          {g.sources.map((c) => (
            <li key={c.key}>
              {citationText(c)} {citationHref(c) && <span className="gp-doi">{citationHref(c)}</span>}
            </li>
          ))}
        </ol>
      </section>

      <footer className="gp-colophon">
        <p>
          Generated {g.meta.generated.slice(0, 10)} for pathway {g.meta.pathway} ·{' '}
          {g.meta.pathwayName}
          {g.meta.subDomain ? ` · ${g.meta.subDomain}` : ''}.
        </p>
        <p>Implements the framework of {citeThisWork()}</p>
      </footer>
    </div>
  );
}
