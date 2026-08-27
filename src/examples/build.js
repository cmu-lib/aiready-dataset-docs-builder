// Helpers to build worked-example assessment records that are correct by
// construction: every required criterion for the pathway gets a value that
// satisfies its check, plus a loadable Croissant and a provenance model so the
// descriptor-driven checks pass too. Examples then override a few fields for
// realism (or drop one to demonstrate a gap).

import vocabularies from '../schema/vocabularies.json';
import { requiredCriteria } from '../lib/pathway.js';
import { CROISSANT_CONTEXT, CROISSANT_CONFORMS_TO } from '../generators/croissant.js';

const RECORD_VERSION = 'assessment_record_v0';
const firstVocab = (key) => vocabularies.vocabularies[key]?.values?.[0]?.id ?? 'custom';

// Criteria whose automated check constrains the format more tightly than the
// generic evidence_type sample below. A DOI is a fine stand-in for "identifier"
// in general and is not a dbGaP accession, so without these the examples would
// fail a check that is working correctly.
const SAMPLE_BY_ID = {
  'ethics.l3.genomic.dbgap_accession': 'phs002204.v1.p1',
  'ethics.l3.clinical.dua_template': 'https://physionet.org/content/mimiciv/view-dua/',
  'ethics.l3.institutional.tiered_access_policy':
    'https://www.icpsr.umich.edu/web/pages/ICPSR/access/restricted/',
};

function sampleValue(c) {
  if (SAMPLE_BY_ID[c.id]) return SAMPLE_BY_ID[c.id];
  switch (c.evidence_type) {
    case 'boolean':
      return true;
    case 'identifier':
      return '10.5281/zenodo.1234567'; // valid DOI form (satisfies grounding)
    case 'uri':
      return 'https://example.org/dataset';
    case 'file':
      return 'evidence.pdf';
    case 'controlled_vocabulary':
      return firstVocab(c.vocabulary_key);
    default:
      return `Documented for the ${c.dimension} dimension.`;
  }
}

export function loadableCroissant({ name, description = '', license, url }) {
  return {
    '@context': CROISSANT_CONTEXT,
    '@type': 'sc:Dataset',
    conformsTo: CROISSANT_CONFORMS_TO,
    name,
    description,
    license: license ?? 'https://creativecommons.org/licenses/by/4.0/',
    url: url ?? 'https://example.org/dataset',
    version: '1.0.0',
    'rai:dataUseCases': 'Research use; not for clinical decision-making.',
    'rai:dataLimitations': 'Known selection effects — see the characterization record.',
    distribution: [
      {
        '@type': 'cr:FileObject',
        '@id': 'data.parquet',
        name: 'data.parquet',
        contentUrl: `${url ?? 'https://example.org/dataset'}/data.parquet`,
        encodingFormat: 'application/vnd.apache.parquet',
        // A real-shaped digest, not the template's row of zeros: an example claiming
        // Computability L3 needs a descriptor that could actually support an unattended
        // load, and a placeholder checksum is what the `grounded` rung exists to catch.
        sha256: '9f2c4e1b7a5d3086bcae5f4192d7c0b83e6a17f45c9d2be0813a6f4d5c7e29ab',
      },
    ],
    recordSet: [
      {
        '@type': 'cr:RecordSet',
        '@id': 'records',
        name: 'records',
        field: [
          {
            '@type': 'cr:Field',
            '@id': 'records/id',
            name: 'id',
            dataType: 'sc:Integer',
            source: { fileObject: { '@id': 'data.parquet' }, extract: { column: 'id' } },
          },
        ],
      },
    ],
  };
}

export function provModel({ sourceName = 'Raw source', outputName = 'derived variable' } = {}) {
  return {
    sources: [{ id: 'src1', name: sourceName }],
    steps: [
      {
        id: 'st1',
        label: 'Curation',
        inputs: ['src1'],
        outputs: [{ id: 'o1', name: outputName }],
        software: 'python 3.11',
        agentRole: 'data_steward',
      },
    ],
  };
}

// Build a fully-satisfying record for a pathway, with optional answer overrides
// and `drop` (criterion ids to leave unmet — to demonstrate a gap).
//
// `croissantModel` supplies the structured builder model instead of a raw
// descriptor: the record then leaves `croissant` null and the descriptor is
// composed from the model, which is how a researcher using the builder actually
// works. Without it the example pins a raw override, which is fine for examples
// that only need *a* loadable descriptor.
export function completeRecord({
  pathway,
  subDomain = null,
  stage = 'upgrade',
  dataset,
  answers = {},
  drop = [],
  croissantModel = null,
}) {
  const base = {};
  for (const c of requiredCriteria(pathway, subDomain)) base[c.id] = { value: sampleValue(c) };

  const overrides = Object.fromEntries(
    Object.entries(answers).map(([k, v]) => [k, typeof v === 'object' && v !== null ? v : { value: v }]),
  );
  const merged = { ...base, ...overrides };
  for (const id of drop) delete merged[id];

  return {
    schema_version: RECORD_VERSION,
    stage,
    pathway,
    sub_domain: subDomain,
    started_at: null,
    dataset: {
      name: dataset.name,
      description: dataset.description ?? '',
      version: dataset.version ?? '1.0.0',
    },
    answers: merged,
    croissant: croissantModel ? null : loadableCroissant(dataset),
    croissant_model: croissantModel ?? { files: [], recordSets: [] },
    provo: null,
    provenance: provModel({ sourceName: dataset.sourceName, outputName: dataset.outputName }),
  };
}
