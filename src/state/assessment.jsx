// Assessment state: React Context + useReducer, mirrored to localStorage.
//
// The in-progress record is prototype-grade persistence (localStorage is
// per-origin/per-browser and disabled in private tabs); the durable, shareable
// artifact is the exported JSON profile. Record shape is versioned so imports
// from an older schema can be detected.

import { createContext, useContext, useEffect, useReducer } from 'react';
import { isRedundantOverride } from '../generators/croissant.js';

const STORAGE_KEY = 'ai-readiness-assessment';
export const RECORD_VERSION = 'assessment_record_v0';

export const emptyRecord = () => ({
  schema_version: RECORD_VERSION,
  stage: null, // lifecycle intake: 'plan' | 'prepare' | 'upgrade'
  pathway: null, // 'A' | 'B' | 'C'
  sub_domain: null, // discipline/governance context; independent of the pathway
  started_at: null,
  answers: {}, // { [criterionId]: { value, notes } }
  dataset: { name: '', description: '', version: '' }, // dataset-level metadata for the Croissant descriptor
  // Raw Croissant override, set only by an explicit "Edit raw" action; null means
  // the descriptor is generated from answers. Mirrors `provo` vs `provenance`.
  croissant: null,
  // Structured file/record-set model the Croissant builder populates;
  // generateCroissant composes `distribution` and `recordSet` from it. Empty =>
  // the metadata-only scaffold. Mirrors `provenance` for PROV-O.
  //
  //   files:      [{ id, name, contentUrl, encodingFormat, sha256 }]
  //   recordSets: [{ id, name, fields: [{ id, name, dataType, fileId, column }] }]
  //
  // `id` is an internal handle (React keys, and the field -> file reference); the
  // Croissant `@id` is derived from `name` at compose time. Keeping them separate
  // means renaming a file cannot break the fields that point at it — the same
  // indirection composeFromModel uses for PROV-O entities.
  croissant_model: { files: [], recordSets: [] },
  provo: null, // user-edited (raw) PROV-O record; overrides the builder when set
  // Structured, step-centric provenance the builder populates; generateProvo
  // composes the PROV-O graph from it. Empty => bare scaffold from answers.
  provenance: { sources: [], steps: [] },
});

export function reducer(state, action) {
  switch (action.type) {
    case 'SET_STAGE':
      return {
        ...state,
        stage: action.stage,
        started_at: state.started_at ?? new Date().toISOString(),
      };
    case 'SET_PATHWAY':
      // The sub-domain describes the data and its governance context, so it survives
      // a change of target level. Before 0.6.0 this cleared it whenever the pathway
      // was not C, which is why governance evidence was unreachable at A and B.
      return {
        ...state,
        pathway: action.pathway,
        sub_domain: state.sub_domain ?? 'general',
        started_at: state.started_at ?? new Date().toISOString(),
      };
    case 'SET_SUB_DOMAIN':
      return { ...state, sub_domain: action.sub_domain };
    case 'SET_ANSWER': {
      const prev = state.answers[action.id] ?? {};
      const next = { ...prev };
      if ('value' in action) next.value = action.value;
      if ('notes' in action) next.notes = action.notes;
      // A declared non-applicability is an answer in its own right, not a value: it has
      // to work for a checkbox (which has no third state) and for an automated criterion
      // (whose validator must be bypassed rather than failed).
      if ('not_applicable' in action) next.not_applicable = action.not_applicable;
      return { ...state, answers: { ...state.answers, [action.id]: next } };
    }
    case 'SET_DATASET':
      return { ...state, dataset: { ...state.dataset, ...action.dataset } };
    case 'SET_CROISSANT':
      return { ...state, croissant: action.croissant };
    case 'SET_CROISSANT_MODEL':
      return { ...state, croissant_model: action.croissant_model };
    case 'SET_PROVO':
      return { ...state, provo: action.provo };
    case 'SET_PROVENANCE':
      return { ...state, provenance: action.provenance };
    case 'LOAD':
      return normalize({ ...emptyRecord(), ...action.record });
    case 'RESET':
      return emptyRecord();
    default:
      return state;
  }
}

// One-time cleanup applied to any record entering state from outside (a saved
// localStorage record or an imported file). Records written before the Croissant
// tab became builder-primary carry a `croissant` copied from the scaffold on
// every keystroke; kept as overrides they would hide every later answer from the
// exported descriptor. Only a descriptor carrying hand-authored content — files
// or record sets — is a real override.
export function normalize(record) {
  return isRedundantOverride(record) ? { ...record, croissant: null } : record;
}

// Overlay criteria whose id changed when they were re-levelled in schema 0.6.0: the
// id encodes the level, and six overlays moved off L3 onto the level of the base
// criterion they mirror. The answers are still valid facts — an IRB protocol number
// does not change because the criterion moved — so a stored record is migrated rather
// than discarded.
const RENAMED_CRITERIA = {
  'ethics.l3.genomic.consent_type': 'ethics.l1.genomic.consent_type',
  'ethics.l3.voice.speaker_consent': 'ethics.l1.voice.speaker_consent',
  'ethics.l3.materials.source_data_licensing': 'ethics.l1.materials.source_data_licensing',
  'ethics.l3.clinical.hipaa_method': 'ethics.l2.clinical.hipaa_method',
  'ethics.l3.genomic.reid_risk': 'ethics.l2.genomic.reid_risk',
  'fairness.l3.materials.ontology_mapping': 'fairness.l2.materials.ontology_mapping',
};

function migrate(record) {
  const answers = { ...(record.answers ?? {}) };
  let moved = 0;
  for (const [from, to] of Object.entries(RENAMED_CRITERIA)) {
    if (answers[from] !== undefined) {
      answers[to] ??= answers[from];
      delete answers[from];
      moved += 1;
    }
  }
  return moved > 0 ? { ...record, answers } : record;
}

function init() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.schema_version === RECORD_VERSION) {
        return normalize(migrate({ ...emptyRecord(), ...parsed }));
      }
    }
  } catch {
    // private-mode tab, quota, or malformed JSON — fall back to a fresh record.
  }
  return emptyRecord();
}

const AssessmentContext = createContext(null);

export function AssessmentProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, init);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore persistence failures; the export flow is the durable path.
    }
  }, [state]);

  return (
    <AssessmentContext.Provider value={{ state, dispatch }}>
      {children}
    </AssessmentContext.Provider>
  );
}

export function useAssessment() {
  const ctx = useContext(AssessmentContext);
  if (!ctx) throw new Error('useAssessment must be used within an AssessmentProvider');
  return ctx;
}
