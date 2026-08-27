// Step-centric provenance builder. The user adds raw sources and then "adds
// steps" (curation/transformation activities); each step consumes inputs and
// produces outputs. generateProvo composes valid PROV-O from this model, so the
// structural + SHACL checks pass without hand-editing JSON.

import vocabularies from '../schema/vocabularies.json';
import { useAssessment } from '../state/assessment.jsx';

const ROLES = vocabularies.vocabularies.stakeholder_roles?.values ?? [];
const uid = (p) => `${p}-${crypto.randomUUID().slice(0, 8)}`;

export default function ProvenanceBuilder() {
  const { state, dispatch } = useAssessment();
  const model = state.provenance ?? { sources: [], steps: [] };
  const set = (next) => dispatch({ type: 'SET_PROVENANCE', provenance: next });

  const sources = model.sources ?? [];
  const steps = model.steps ?? [];

  const addSource = () => set({ ...model, sources: [...sources, { id: uid('src'), name: '' }] });
  const updateSource = (id, name) =>
    set({ ...model, sources: sources.map((s) => (s.id === id ? { ...s, name } : s)) });
  const removeSource = (id) => set({ ...model, sources: sources.filter((s) => s.id !== id) });

  const addStep = () =>
    set({
      ...model,
      steps: [...steps, { id: uid('step'), label: '', inputs: [], outputs: [], software: '', agentRole: '' }],
    });
  const updateStep = (id, patch) =>
    set({ ...model, steps: steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const removeStep = (id) => set({ ...model, steps: steps.filter((s) => s.id !== id) });

  // Entities selectable as inputs to step i: sources + outputs of earlier steps.
  const availableFor = (i) => [
    ...sources.map((s) => ({ id: s.id, name: s.name || s.id })),
    ...steps.slice(0, i).flatMap((st) => (st.outputs ?? []).map((o) => ({ id: o.id, name: o.name || o.id }))),
  ];

  return (
    <div className="mt-6 rounded-none border border-line bg-surface p-4">
      <h3 className="text-sm font-semibold">Build provenance (steps)</h3>
      <p className="mt-1 text-xs text-muted">
        Record how the released data came to be, one step at a time. Outputs of one step can be
        inputs to the next; that chain becomes the lineage in the PROV-O record.
      </p>

      {/* PROV-O schematic: what the model maps to */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="border border-line bg-surface-2 px-2 py-1">
          Source <span className="text-faint">· Entity</span>
        </span>
        <span className="text-faint">—used→</span>
        <span className="border border-info-line bg-info-bg px-2 py-1 text-info">
          Step <span className="opacity-70">· Activity + Agent</span>
        </span>
        <span className="text-faint">—generates→</span>
        <span className="border border-ok-line bg-ok-bg px-2 py-1 text-ok">
          Output <span className="opacity-70">· Entity, wasDerivedFrom</span>
        </span>
      </div>
      <p className="mt-2 text-[0.7rem] text-muted">
        PROV-O records lineage as <b>agents</b> running <b>activities</b> (your steps) that{' '}
        <b>use</b> inputs and <b>generate</b> outputs. Fill the builder below and it writes valid
        PROV-O for you, no JSON required. Follows the W3C PROV Ontology (
        <a href="https://www.w3.org/TR/prov-o/" target="_blank" rel="noreferrer" className="text-link underline">Lebo et al., 2013</a>
        ).
      </p>

      <div className="mt-3 border border-info-line bg-info-bg p-3 text-xs text-muted">
        <p className="font-semibold text-info">How to fill this in</p>
        <ul className="mt-1 list-inside list-disc space-y-1">
          <li>
            <span className="font-medium text-ink">Raw sources</span> — the inputs before any
            processing (e.g. “Raw EHR export”, “Survey responses CSV”, an upstream dataset DOI).
          </li>
          <li>
            <span className="font-medium text-ink">Steps</span> — each curation/transformation you
            applied, in order: cleaning, de-identification, harmonization, missing-value handling,
            variable/feature construction, filtering or sub-setting, aggregation.
          </li>
          <li>
            For each step, tick its <span className="font-medium text-ink">inputs</span> (sources or
            earlier steps’ outputs), name the <span className="font-medium text-ink">outputs</span>
            it produced (e.g. a derived variable), and note the{' '}
            <span className="font-medium text-ink">software/version</span> and responsible{' '}
            <span className="font-medium text-ink">role</span>.
          </li>
          <li>
            Aim for one step per meaningful decision that changed the data, enough that a reviewer
            could trace any released variable back to its raw origin.
          </li>
        </ul>
      </div>

      {/* Sources */}
      <div className="mt-4">
        <h4 className="text-xs font-semibold text-muted">Raw sources</h4>
        <div className="mt-2 space-y-2">
          {sources.map((s) => (
            <div key={s.id} className="flex gap-2">
              <input
                value={s.name}
                onChange={(e) => updateSource(s.id, e.target.value)}
                placeholder="e.g. Raw EHR export"
                className="flex-1 rounded-none border border-line px-2 py-1 text-sm"
              />
              <button type="button" onClick={() => removeSource(s.id)} className="text-xs text-bad">
                remove
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addSource} className="mt-2 text-xs text-muted underline">
          + Add source
        </button>
      </div>

      {/* Steps */}
      <div className="mt-4">
        <h4 className="text-xs font-semibold text-muted">Steps</h4>
        <div className="mt-2 space-y-3">
          {steps.map((step, i) => {
            const available = availableFor(i);
            return (
              <div key={step.id} className="rounded-none border border-line p-3">
                <div className="flex items-center gap-2">
                  <input
                    value={step.label}
                    onChange={(e) => updateStep(step.id, { label: e.target.value })}
                    placeholder={`Step ${i + 1} label (e.g. Cleaning)`}
                    className="flex-1 rounded-none border border-line px-2 py-1 text-sm font-medium"
                  />
                  <button type="button" onClick={() => removeStep(step.id)} className="text-xs text-bad">
                    remove step
                  </button>
                </div>

                {/* Inputs */}
                <div className="mt-2">
                  <span className="text-[0.7rem] font-medium text-muted">Inputs used</span>
                  {available.length === 0 ? (
                    <p className="text-[0.7rem] text-faint">Add a source (or an earlier step's output) first.</p>
                  ) : (
                    <div className="mt-1 flex flex-wrap gap-2">
                      {available.map((e) => (
                        <label key={e.id} className="flex items-center gap-1 text-xs text-ink">
                          <input
                            type="checkbox"
                            checked={(step.inputs ?? []).includes(e.id)}
                            onChange={() =>
                              updateStep(step.id, {
                                inputs: (step.inputs ?? []).includes(e.id)
                                  ? step.inputs.filter((x) => x !== e.id)
                                  : [...(step.inputs ?? []), e.id],
                              })
                            }
                          />
                          {e.name}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Outputs */}
                <div className="mt-2">
                  <span className="text-[0.7rem] font-medium text-muted">Outputs produced</span>
                  <div className="mt-1 space-y-1">
                    {(step.outputs ?? []).map((o) => (
                      <div key={o.id} className="flex gap-2">
                        <input
                          value={o.name}
                          onChange={(e) =>
                            updateStep(step.id, {
                              outputs: step.outputs.map((x) => (x.id === o.id ? { ...x, name: e.target.value } : x)),
                            })
                          }
                          placeholder="e.g. age (derived)"
                          className="flex-1 rounded-none border border-line px-2 py-1 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateStep(step.id, { outputs: step.outputs.filter((x) => x.id !== o.id) })
                          }
                          className="text-xs text-bad"
                        >
                          remove
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateStep(step.id, { outputs: [...(step.outputs ?? []), { id: uid('out'), name: '' }] })
                    }
                    className="mt-1 text-xs text-muted underline"
                  >
                    + Add output
                  </button>
                </div>

                {/* Software + agent */}
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    value={step.software}
                    onChange={(e) => updateStep(step.id, { software: e.target.value })}
                    placeholder="software / versions (e.g. python 3.11)"
                    className="flex-1 rounded-none border border-line px-2 py-1 text-xs"
                  />
                  <select
                    value={step.agentRole}
                    onChange={(e) => updateStep(step.id, { agentRole: e.target.value })}
                    className="rounded-none border border-line px-2 py-1 text-xs"
                  >
                    <option value="">— responsible role —</option>
                    {ROLES.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
        <button type="button" onClick={addStep} className="mt-2 text-xs text-muted underline">
          + Add step
        </button>
      </div>
    </div>
  );
}
