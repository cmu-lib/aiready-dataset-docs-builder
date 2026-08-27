// Croissant 1.0 descriptor generator. Builds a JSON-LD scaffold from the
// assessment answers. Fields the readiness checklist does not collect (dataset
// name, description, file distribution, record-set fields) are left empty on
// purpose: the user completes them in the export editor, and validation
// (croissantValidation.js) gates the `fairness.l2.croissant_descriptor`
// criterion — so the criterion cannot go green from generation alone.

import vocabularies from '../schema/vocabularies.json';

export const CROISSANT_CONTEXT = {
  '@language': 'en',
  '@vocab': 'https://schema.org/',
  cr: 'http://mlcommons.org/croissant/',
  rai: 'http://mlcommons.org/croissant/RAI/',
  dct: 'http://purl.org/dc/terms/',
  sc: 'https://schema.org/',
};

export const CROISSANT_CONFORMS_TO = 'http://mlcommons.org/croissant/1.0';

const licenseUrl = (id) => {
  const v = (vocabularies.vocabularies.licenses?.values ?? []).find((x) => x.id === id);
  return v?.url ?? id; // fall back to the id when no canonical URL is bundled
};

// Vocabularies whose values carry the `mime` / `ext` facets used to seed a
// distribution entry. Searched in order; first id match wins.
const FORMAT_VOCABULARIES = [
  'formats_materials',
  'formats_tabular',
  'formats_array',
  'formats_imaging',
  'formats_other',
];

// Display order for the encodingFormat picker. Deliberately not FORMAT_VOCABULARIES
// order: that one puts materials first because it encodes lookup *precedence*
// (a declared discipline encoding beats the general open-format answer), which
// would be an odd thing to show a non-materials researcher at the top of a list.
const FORMAT_PICKER_ORDER = [
  'formats_tabular',
  'formats_array',
  'formats_imaging',
  'formats_materials',
  'formats_other',
];

// Distinct media types offered by the builder's encodingFormat select, labelled
// with the format they came from. Deduplicated: HDF5 backs both NeXus and the
// array vocabulary, and must appear once.
export const encodingFormatOptions = () => {
  const seen = new Map();
  for (const key of FORMAT_PICKER_ORDER) {
    for (const v of vocabularies.vocabularies[key]?.values ?? []) {
      if (v.mime && !seen.has(v.mime)) seen.set(v.mime, `${v.id} — ${v.mime}`);
    }
  }
  return [...seen].map(([mime, label]) => ({ mime, label }));
};

// Look up a declared format id (e.g. "CIF", "Parquet") in the format
// vocabularies. Returns { mime, ext } — either may be undefined for a format
// with no single media type (a BIDS directory) or a custom free-text value.
export const formatFacets = (id) => {
  const needle = String(id ?? '').trim();
  if (!needle) return {};
  for (const key of FORMAT_VOCABULARIES) {
    const hit = (vocabularies.vocabularies[key]?.values ?? []).find((v) => v.id === needle);
    if (hit) return { mime: hit.mime, ext: hit.ext };
  }
  return {};
};

// The format the assessment declares, most specific first: a Pathway-C materials
// encoding standard (CIF / NeXus / CML) beats the general open-format answer.
const declaredFormat = (record) => {
  const a = (id) => record?.answers?.[id]?.value;
  return a('fairness.l3.materials.encoding_standard') || a('sustainability.l1.open_format');
};

// The media type implied by the declared format, or undefined when nothing usable
// is declared. Unlike suggestedFormat this deliberately does not fall back — a
// fallback would make the encodingFormat cross-check fire against a guess.
export const declaredMime = (record) => formatFacets(declaredFormat(record)).mime;

// The format to seed a template distribution entry with. Falls back to CSV so the
// inserted template is always concrete even when nothing has been declared yet.
export const suggestedFormat = (record) => {
  const { mime, ext } = formatFacets(declaredFormat(record));
  return { mime: mime ?? 'text/csv', ext: ext ?? 'csv' };
};

const doiUrl = (value) => {
  const s = String(value ?? '').trim();
  return /^10\.\d{4,9}\/\S+$/.test(s) ? `https://doi.org/${s}` : s;
};

const raiFromAnswers = (a) => {
  const rai = {};
  const scope = a('characterization.l3.scope_declared');
  const limitations = a('characterization.l3.limitations_declared');
  const coverage = a('characterization.l3.coverage_analysis');
  if (scope && String(scope).trim()) rai['rai:dataUseCases'] = String(scope).trim();
  if (limitations && String(limitations).trim()) rai['rai:dataLimitations'] = String(limitations).trim();
  if (coverage && String(coverage).trim()) rai['rai:dataCollection'] = String(coverage).trim();
  return rai;
};

// --- builder model -> distribution / recordSet ------------------------------

export const modelHasContent = (model) =>
  (model?.files?.length ?? 0) > 0 || (model?.recordSets?.length ?? 0) > 0;

// Internal handles for builder rows. Deterministic rather than crypto.randomUUID
// so the generator and its tests stay pure; uniqueness only has to hold inside
// one model, and these never reach the descriptor (the Croissant @id is derived
// from the row's name at compose time).
export const nextRowId = (prefix, existingIds = []) => {
  const taken = new Set(existingIds);
  for (let n = 1; ; n += 1) {
    if (!taken.has(`${prefix}-${n}`)) return `${prefix}-${n}`;
  }
};

// Compose the two arrays the checklist cannot collect from the builder model.
//
// Two invariants make the output always pass validateCroissant:
//   * every emitted @id is unique across files, record sets, and fields (the
//     validator treats @id uniqueness as global, and a duplicate is a hard error);
//   * a field emits `source` only when it points at a file that still exists, so
//     a half-filled row — or one whose file was deleted — degrades to a field
//     without a source rather than a dangling reference.
function composeFromModel(model) {
  const files = model.files ?? [];
  const recordSets = model.recordSets ?? [];
  const taken = new Set();

  // Internal row id -> Croissant @id. Derived from the row's name, so renaming a
  // file rewrites its @id *and* every field that references it in one pass.
  const idFor = new Map();
  const claim = (rowId, base) => {
    const id = uniqueId(String(base ?? '').trim() || rowId, taken);
    taken.add(id);
    if (rowId) idFor.set(rowId, id);
    return id;
  };

  const distribution = files.map((f) => {
    const node = { '@type': 'cr:FileObject', '@id': claim(f.id, f.name) };
    node.name = String(f.name ?? '').trim() || node['@id'];
    if (nonEmptyText(f.contentUrl)) node.contentUrl = f.contentUrl.trim();
    if (nonEmptyText(f.encodingFormat)) node.encodingFormat = f.encodingFormat.trim();
    if (nonEmptyText(f.sha256)) node.sha256 = f.sha256.trim();
    return node;
  });

  const recordSet = recordSets.map((rs) => {
    const rsId = claim(rs.id, rs.name);
    const node = { '@type': 'cr:RecordSet', '@id': rsId };
    node.name = String(rs.name ?? '').trim() || rsId;
    node.field = (rs.fields ?? []).map((f) => {
      const fieldName = String(f.name ?? '').trim();
      const field = { '@type': 'cr:Field', '@id': claim(f.id, `${rsId}/${fieldName || f.id}`) };
      field.name = fieldName || field['@id'];
      if (nonEmptyText(f.dataType)) field.dataType = f.dataType.trim();
      // Only reference a file that is still declared — deleting a file must not
      // leave a dangling source behind.
      if (f.fileId && idFor.has(f.fileId)) {
        field.source = {
          fileObject: { '@id': idFor.get(f.fileId) },
          extract: { column: nonEmptyText(f.column) ? f.column.trim() : field.name },
        };
      }
      return field;
    });
    return node;
  });

  return { distribution, recordSet };
}

const nonEmptyText = (v) => typeof v === 'string' && v.trim() !== '';

export function generateCroissant(record) {
  const { pathway, answers = {}, dataset = {} } = record;
  const a = (id) => answers[id]?.value;

  const license = a('fairness.l1.license_explicit');
  const persistentId = a('fairness.l1.persistent_id');
  const landing = a('fairness.l1.landing_page');

  const desc = {
    '@context': CROISSANT_CONTEXT,
    '@type': 'sc:Dataset',
    conformsTo: CROISSANT_CONFORMS_TO,
    name: (dataset.name ?? '').trim(), // from the Dataset details form on Export
    description: (dataset.description ?? '').trim(),
    version: (dataset.version ?? '').trim(),
    // Empty until the builder model has content — the checklist collects neither
    // a file list nor a variable list, and inventing them would let
    // computability.l3.direct_ml_load pass on a descriptor nobody can load.
    distribution: [],
    recordSet: [],
  };

  if (modelHasContent(record?.croissant_model)) {
    const composed = composeFromModel(record.croissant_model);
    desc.distribution = composed.distribution;
    desc.recordSet = composed.recordSet;
  }

  if (license) desc.license = licenseUrl(license);
  if (landing) desc.url = landing;
  else if (persistentId) desc.url = doiUrl(persistentId);
  if (persistentId) desc.citeAs = persistentId;

  // Pathway C scaffolds the Responsible-AI annotations from the answers.
  if (pathway === 'C') Object.assign(desc, raiFromAnswers(a));

  return desc;
}

// Croissant `@id`s must be unique across distribution, recordSet, and fields
// (validateCroissant hard-errors on a duplicate), so the template inserter
// uniquifies against what is already declared.
const uniqueId = (base, taken) => {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  }
};

// Same, but keeping the extension last: data.cif -> data-2.cif.
const uniqueFileId = (stem, ext, taken) => {
  const suffix = ext ? `.${ext}` : '';
  if (!taken.has(`${stem}${suffix}`)) return `${stem}${suffix}`;
  for (let n = 2; ; n += 1) {
    if (!taken.has(`${stem}-${n}${suffix}`)) return `${stem}-${n}${suffix}`;
  }
};

// Add one file row and one record-set row (two fields, wired to that file) to the
// builder model, seeded from the record's declared format — so a materials record
// starts from `data.cif` / `chemical/x-cif`. The model-level counterpart of
// withTemplateEntries below: this one is what the builder uses, that one is for
// the raw-override path where there is no model to seed.
export function seedTemplateRows(model, record) {
  const files = model?.files ?? [];
  const recordSets = model?.recordSets ?? [];
  const { mime, ext } = suggestedFormat(record);

  const takenNames = new Set(files.map((f) => String(f.name ?? '').trim()).filter(Boolean));
  const fileId = nextRowId('file', files.map((f) => f.id));
  const rsId = nextRowId('recordset', recordSets.map((r) => r.id));
  const fieldIds = recordSets.flatMap((r) => (r.fields ?? []).map((f) => f.id));

  const field = (name, dataType, taken) => ({
    id: nextRowId('field', taken),
    name,
    dataType,
    fileId,
    column: name,
  });
  const first = field('id', 'sc:Integer', fieldIds);
  const second = field('value', 'sc:Float', [...fieldIds, first.id]);

  return {
    files: [
      ...files,
      {
        id: fileId,
        name: uniqueFileId('data', ext, takenNames),
        contentUrl: '',
        encodingFormat: mime,
        sha256: '',
      },
    ],
    recordSets: [
      ...recordSets,
      { id: rsId, name: uniqueId('records', new Set(recordSets.map((r) => r.name))), fields: [first, second] },
    ],
  };
}

// Add one cr:FileObject and one cr:RecordSet (two fields, wired to that file) to
// an existing descriptor, seeded from the record's declared format. Additive on
// purpose: the derived name/license/url/citeAs/rai keys are carried through
// untouched, so showing someone the shape never costs them their work. Every
// emitted @id is unique, and each field's source points at the file just added,
// so the result satisfies the structural and referential checks.
export function withTemplateEntries(desc, record) {
  if (!desc || typeof desc !== 'object') return desc;
  const distribution = Array.isArray(desc.distribution) ? [...desc.distribution] : [];
  const recordSet = Array.isArray(desc.recordSet) ? [...desc.recordSet] : [];

  const taken = new Set();
  for (const node of [...distribution, ...recordSet]) {
    if (node?.['@id']) taken.add(node['@id']);
    for (const f of Array.isArray(node?.field) ? node.field : []) {
      if (f?.['@id']) taken.add(f['@id']);
    }
  }

  const { mime, ext } = suggestedFormat(record);
  const fileId = uniqueFileId('data', ext, taken);
  taken.add(fileId);
  const rsId = uniqueId('records', taken);

  distribution.push({
    '@type': 'cr:FileObject',
    '@id': fileId,
    name: fileId,
    contentUrl: 'https://example.org/replace-with-the-url-of-your-file',
    encodingFormat: mime,
    sha256: '0'.repeat(64),
  });

  const field = (name, dataType) => ({
    '@type': 'cr:Field',
    '@id': `${rsId}/${name}`,
    name,
    dataType,
    source: { fileObject: { '@id': fileId }, extract: { column: name } },
  });

  recordSet.push({
    '@type': 'cr:RecordSet',
    '@id': rsId,
    name: rsId,
    field: [field('id', 'sc:Integer'), field('value', 'sc:Float')],
  });

  return { ...desc, distribution, recordSet };
}

// The descriptor to validate/export: the raw override if one is set, else the
// descriptor generated from answers (and, from tier 2, the builder model).
export const effectiveCroissant = (record) =>
  record?.croissant && typeof record.croissant === 'object'
    ? record.croissant
    : generateCroissant(record);

// True when `record.croissant` holds nothing the generator could not reproduce,
// so treating it as an override buys nothing and costs correctness.
//
// Needed because the Export tab used to mirror the descriptor into state on every
// keystroke, so records saved before the builder-primary flip carry a `croissant`
// even when the user never edited one. Worse, that copy went stale the moment a
// later answer changed: kept as an override it would hide the new licence, DOI,
// or RAI annotation from the exported file.
//
// The test is `distribution` and `recordSet` both empty. Every other key in the
// descriptor is derived from the answers and the dataset form, so a descriptor
// without those two arrays contains only regenerable content — while anything a
// user hand-authored necessarily lives in them. The trade-off: a free-text edit
// made directly in the raw editor and confined to a derived key (say a reworded
// `description`) is dropped on load. That is deliberate — recovering one reworded
// string is worth less than silently exporting a stale descriptor.
export const isRedundantOverride = (record) => {
  const c = record?.croissant;
  if (!c || typeof c !== 'object') return false;
  const len = (v) => (Array.isArray(v) ? v.length : 0);
  return len(c.distribution) === 0 && len(c.recordSet) === 0;
};

