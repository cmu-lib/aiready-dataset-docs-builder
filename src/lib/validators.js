// Resolution against the discipline-validator registry (schema/validators.json).
//
// Until now that registry was read only by its own tests: 14 validators and three
// community registries shipped in the bundle and no user could reach any of them.
// A criterion may name the tools whose report is its evidence, via a `validators`
// array of registry ids, and this module turns those ids into something renderable.
//
// `execution` is the field that decides what the tool can promise: only
// 'in-browser' validators could ever run inside the app and mark a criterion
// automated. 'cli' and 'web-service' ones are referenced, run elsewhere, and their
// outcome recorded as attested evidence — which is why the copy for those says run
// it rather than implying the app will.
//
// Selecting a validator by the *data* rather than by the criterion — declared format
// and sub-domain → applicable tools — is the lookup the paper describes in §2.5, and
// `matchValidators` below is it. The three community registries are its fallback: no
// bundled list can cover every discipline, so when nothing matches the answer is where
// to look rather than a shrug.

import registry from '../schema/validators.json';
import vocabularies from '../schema/vocabularies.json';
import { getSubDomain, ALL_CRITERIA, SUB_DOMAINS } from './pathway.js';

export const ALL_VALIDATORS = registry.validators;
export const REGISTRIES = registry.registries;

const BY_ID = new Map(registry.validators.map((v) => [v.id, v]));

export const getValidator = (id) => BY_ID.get(id) ?? null;

// The validators a criterion names, resolved and in declared order. Unknown ids are
// dropped rather than rendered as a dead chip; matrix.test.js fails the build if one
// is ever introduced, so this is belt-and-braces for a hand-edited schema.
export const validatorsFor = (criterion) =>
  (criterion?.validators ?? []).map(getValidator).filter(Boolean);

// How the user is expected to obtain the report, phrased for each execution mode.
export const EXECUTION_NOTE = {
  'in-browser': 'runs in the app',
  cli: 'run locally',
  'web-service': 'hosted service',
};

export const executionNote = (validator) =>
  EXECUTION_NOTE[validator?.execution] ?? validator?.execution ?? '';

// --- matching a validator to the data ---------------------------------------
//
// `applies_to` is an open-world tag list mixing three kinds of signal: format ids
// ('Parquet', 'NetCDF', 'CIF'), format families and concepts ('tabular', 'statistical',
// 'RDF', 'bias'), and disciplines ('materials', 'neuroimaging', 'climate'). The record
// supplies the same three kinds, so matching is set intersection over normalised tags,
// scored by how specific the matching signal was.
//
// Deliberately generous: a validator shown that turns out not to apply costs a moment's
// reading, while one withheld is one the researcher never learns exists.

const norm = (t) => String(t).toLowerCase().replace(/[\s_-]+/g, '');

// Which vocabulary a declared format id belongs to tells us its family.
const FORMAT_FAMILY = {
  formats_tabular: ['tabular', 'statistical'],
  formats_array: ['array', 'scientific'],
  formats_imaging: ['imaging'],
  formats_materials: ['materials'],
};

const familyOf = (formatId) => {
  for (const [key, families] of Object.entries(FORMAT_FAMILY)) {
    const values = vocabularies.vocabularies[key]?.values ?? [];
    if (values.some((v) => v.id === formatId)) return families;
  }
  return [];
};

// Discipline and governance signals a sub-domain implies. Human-subjects sub-domains
// bring the bias and protected-attribute tags with them, because that is what their
// L3 rows ask for.
const SUB_DOMAIN_SIGNALS = {
  clinical: ['clinical', 'human subjects', 'bias', 'protected attributes'],
  genomic: ['genomic', 'human subjects', 'bias', 'protected attributes'],
  voice: ['voice', 'human subjects', 'bias', 'protected attributes'],
  institutional: ['social-science', 'human subjects', 'bias', 'protected attributes'],
  materials: ['materials'],
  general: [],
};

// Answers that name a format or standard directly, most specific first.
const FORMAT_ANSWERS = [
  'sustainability.l1.open_format',
  'fairness.l3.materials.encoding_standard',
  'fairness.l2.materials.ontology_mapping',
];

// The signals a record emits, each tagged with how specific it is:
//   3  the researcher named this format or standard
//   2  the discipline implies it
//   1  a family or concept the record falls into
export function recordSignals(record = {}) {
  const answers = record.answers ?? {};
  const out = new Map(); // normalised tag -> { weight, label }
  const add = (tag, weight, label) => {
    if (!tag) return;
    const k = norm(tag);
    const prev = out.get(k);
    if (!prev || prev.weight < weight) out.set(k, { weight, label });
  };

  for (const id of FORMAT_ANSWERS) {
    const v = answers[id]?.value;
    if (!v) continue;
    add(v, 3, `you declared ${v}`);
    for (const fam of familyOf(v)) add(fam, 1, `${v} is ${fam} data`);
  }

  const sub = record.sub_domain ? getSubDomain(record.sub_domain) : null;
  for (const tag of SUB_DOMAIN_SIGNALS[record.sub_domain] ?? []) {
    add(tag, 2, `you selected ${sub?.name ?? record.sub_domain}`);
  }

  // A provenance record is produced from Pathway B upward, and it is RDF, so the graph
  // validator always applies there.
  if (record.pathway === 'B' || record.pathway === 'C') {
    for (const tag of ['PROV-O', 'RDF', 'JSON-LD']) add(tag, 2, 'you are producing a PROV-O record');
  }

  return out;
}

// Validators applicable to a record, best match first. Each carries `score` (the
// strongest signal that matched), `matched` (the tags), and `why` (a sentence naming
// the reason), so the UI can say why a tool is being suggested rather than just listing it.
export function matchValidators(record = {}) {
  const signals = recordSignals(record);
  if (signals.size === 0) return [];

  return ALL_VALIDATORS.map((v) => {
    const hits = (v.applies_to ?? [])
      .map((tag) => ({ tag, sig: signals.get(norm(tag)) }))
      .filter((h) => h.sig);
    if (hits.length === 0) return null;
    const best = hits.reduce((a, b) => (b.sig.weight > a.sig.weight ? b : a));
    return {
      ...v,
      score: best.sig.weight,
      matched: hits.map((h) => h.tag),
      why: best.sig.label,
    };
  })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.validator_name.localeCompare(b.validator_name));
}

// Everything in the registry that did not match, so the page can still show the full
// catalogue under the suggestions rather than hiding it.
export function unmatchedValidators(record = {}) {
  const matched = new Set(matchValidators(record).map((v) => v.id));
  return ALL_VALIDATORS.filter((v) => !matched.has(v.id));
}

// The criteria a validator's report can back, from the `validators` arrays the criteria
// declare — the reverse of validatorsFor(). Lets the catalogue say what a tool is *for*
// in the framework's own terms rather than only what it checks.
const ALL_WITH_OVERLAYS = [
  ...ALL_CRITERIA,
  ...SUB_DOMAINS.flatMap((s) => s.overlay ?? []),
];

export const criteriaBackedBy = (validatorId) =>
  ALL_WITH_OVERLAYS.filter((c) => (c.validators ?? []).includes(validatorId));
