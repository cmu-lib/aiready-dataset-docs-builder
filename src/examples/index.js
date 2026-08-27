// Worked examples — inlined, correct-by-construction assessment records that
// double as tutorials and templates. See tests/examples.test.js for the
// enforced verdicts. Synthetic data only for clinical/genomic.

import { completeRecord } from './build.js';

export const EXAMPLES = [
  {
    id: 'zenodo-tabular',
    title: 'Tabular dataset on Zenodo',
    pathway: 'A',
    description: 'A CC-BY open tabular dataset with a DOI: a typical Accessible (L1) release.',
    expectMet: true,
    record: completeRecord({
      pathway: 'A',
      dataset: {
        name: 'Community survey (open tabular)',
        description: 'A small open tabular dataset published on Zenodo.',
        license: 'https://creativecommons.org/licenses/by/4.0/',
        url: 'https://zenodo.org/records/1234567',
      },
      answers: {
        'fairness.l1.persistent_id': '10.5281/zenodo.1234567',
        'fairness.l1.license_explicit': 'CC-BY-4.0',
        'sustainability.l1.open_format': 'CSV',
        'provenance.l1.source_documented': 'Collected via an open online survey instrument in 2024.',
      },
    }),
  },
  {
    id: 'hf-croissant',
    title: 'Hugging Face dataset with Croissant',
    pathway: 'B',
    description: 'An ML-ready dataset with a Croissant descriptor: Faithful (L2).',
    expectMet: true,
    record: completeRecord({
      pathway: 'B',
      dataset: {
        name: 'Sentiment corpus (HF)',
        description: 'A tokenised text-classification dataset with a Croissant descriptor.',
        license: 'https://creativecommons.org/licenses/by/4.0/',
        url: 'https://huggingface.co/datasets/example/sentiment',
      },
      answers: {
        'fairness.l1.persistent_id': '10.57967/hf/1234',
        'fairness.l1.license_explicit': 'CC-BY-4.0',
        'sustainability.l1.open_format': 'Parquet',
        'provenance.l2.transformations_documented': 'Deduplicated, normalised text, tokenised with a documented vocabulary.',
      },
    }),
  },
  {
    id: 'bids-neuroimaging',
    title: 'BIDS neuroimaging dataset',
    pathway: 'B',
    description: 'A BIDS-organised NIfTI dataset: shows domain formats/validators at L2.',
    expectMet: true,
    record: completeRecord({
      pathway: 'B',
      dataset: {
        name: 'Resting-state fMRI (BIDS)',
        description: 'A BIDS-organised neuroimaging dataset in NIfTI.',
        license: 'https://creativecommons.org/licenses/by/4.0/',
        url: 'https://openneuro.org/datasets/ds001234',
      },
      answers: {
        'fairness.l1.persistent_id': '10.18112/openneuro.ds001234.v1.0.0',
        'fairness.l1.license_explicit': 'CC0-1.0',
        'sustainability.l1.open_format': 'NIfTI',
        'computability.l2.linked_schemas': 'Conforms to the BIDS specification; validated with the BIDS Validator.',
      },
    }),
  },
  {
    id: 'synthetic-mimic',
    title: 'Synthetic clinical dataset (MIMIC-shaped)',
    pathway: 'C',
    subDomain: 'clinical',
    description:
      'A synthetic MIMIC-shaped clinical dataset for Task-ready (L3). Intentionally missing a bias audit, which shows a Characterization bottleneck.',
    expectMet: false,
    expectBottleneck: 'Characterization',
    record: completeRecord({
      pathway: 'C',
      subDomain: 'clinical',
      dataset: {
        name: 'Synthetic ICU cohort (MIMIC-shaped)',
        description: 'A fully synthetic clinical dataset shaped like MIMIC; no real patient data.',
        license: 'https://physionet.org/content/mimiciv/view-dua/',
        url: 'https://example.org/synthetic-mimic',
        sourceName: 'Synthetic EHR generator',
        outputName: 'age (derived)',
      },
      answers: {
        'ethics.l1.de_identification_applied': true,
        'ethics.l2.de_identification_method': 'hipaa_safe_harbor',
      },
      drop: ['characterization.l3.bias_audit'], // the intentional gap
    }),
  },
  {
    id: 'synthetic-cm4ai',
    title: 'Synthetic cell-mapping dataset (CM4AI-style)',
    pathway: 'C',
    subDomain: 'genomic',
    description: 'A synthetic CM4AI-style functional-genomics dataset: a complete Task-ready (L3) example.',
    expectMet: true,
    record: completeRecord({
      pathway: 'C',
      subDomain: 'genomic',
      dataset: {
        name: 'Synthetic cell map (CM4AI-style)',
        description: 'A fully synthetic functional-genomics cell-mapping dataset.',
        license: 'https://creativecommons.org/licenses/by/4.0/',
        url: 'https://example.org/synthetic-cm4ai',
        sourceName: 'Synthetic imaging + interaction assays',
        outputName: 'protein-localization feature',
      },
    }),
  },
  {
    id: 'alpha-quartz-xrd',
    title: 'α-quartz XRD + DFT relaxation (materials science)',
    pathway: 'C',
    subDomain: 'materials',
    description:
      'A crystallography and computational materials record: CIF encoding, EMMO/OPTIMADE mapping, and provenance captured a priori by AiiDA. The only example built through the Croissant builder.',
    expectMet: true,
    record: completeRecord({
      pathway: 'C',
      subDomain: 'materials',
      dataset: {
        name: 'alpha_quartz_xrd_dft',
        description:
          'Powder XRD patterns for α-quartz with the corresponding DFT self-consistent-field and relaxation results.',
        license: 'https://creativecommons.org/licenses/by/4.0/',
        url: 'https://archive.materialscloud.org/record/example',
        sourceName: 'α-quartz structure (CIF) + XRD pattern',
        outputName: 'relaxed structure',
      },
      answers: {
        'sustainability.l1.open_format': 'HDF5',
        // The six materials overlays, answered the way the guidance describes.
        'fairness.l3.materials.domain_repository': 'MaterialsCloud',
        'fairness.l3.materials.encoding_standard': 'CIF',
        'fairness.l2.materials.ontology_mapping': 'EMMO',
        'provenance.l3.materials.apriori_capture': 'AiiDA',
        'characterization.l3.materials.acquisition_parameters':
          'XRD: Rigaku SmartLab (inst-0217), Cu Kα, 40 kV / 30 mA, 2θ 10–80°, room temperature, powder mount, operator ORCID 0000-0002-1825-0097, 2024-10-09. DFT: Quantum ESPRESSO 7.2, PBE, SSSP-efficiency pseudopotentials, k-points 6×6×6, ecutwfc 60 Ry, ecutrho 480 Ry, force threshold 1e-4 Ry/bohr.',
        'ethics.l1.materials.source_data_licensing':
          'No third-party database content is redistributed: the structure was refined in-house. Released under CC-BY-4.0 (SPDX: CC-BY-4.0). No export-control or dual-use restriction applies; no industrial embargo.',
        // Reworded for this sub-domain via label_overrides — answered in kind.
        'sustainability.l3.compute_cost_reported':
          '412 core-hours total on the institutional cluster (Intel Xeon Gold 6248, 40-core nodes): 1 SCF + 1 variable-cell relaxation, Quantum ESPRESSO 7.2.',
      },
      // Built through the builder, so the descriptor is composed from this model.
      croissantModel: {
        files: [
          {
            id: 'file-1',
            name: 'patterns.csv',
            contentUrl: 'https://archive.materialscloud.org/record/example/patterns.csv',
            encodingFormat: 'text/csv',
            sha256: '0'.repeat(64),
          },
          {
            id: 'file-2',
            name: 'alpha_quartz_relaxed.cif',
            contentUrl: 'https://archive.materialscloud.org/record/example/alpha_quartz_relaxed.cif',
            encodingFormat: 'chemical/x-cif',
            sha256: '0'.repeat(64),
          },
        ],
        recordSets: [
          {
            id: 'recordset-1',
            name: 'patterns',
            fields: [
              { id: 'field-1', name: 'two_theta', dataType: 'sc:Float', fileId: 'file-1', column: 'two_theta_deg' },
              { id: 'field-2', name: 'intensity', dataType: 'sc:Float', fileId: 'file-1', column: 'counts' },
              { id: 'field-3', name: 'sample', dataType: 'sc:Text', fileId: 'file-1', column: 'sample_id' },
            ],
          },
        ],
      },
    }),
  },
  {
    id: 'hep-root',
    title: 'High-energy physics dataset (ROOT)',
    pathway: 'B',
    description: 'A ROOT-format HEP dataset: illustrates FAIR extended to models at L2.',
    expectMet: true,
    record: completeRecord({
      pathway: 'B',
      dataset: {
        name: 'Diffraction microscopy events (ROOT)',
        description: 'A high-energy-physics dataset in ROOT format.',
        license: 'https://creativecommons.org/licenses/by/4.0/',
        url: 'https://example.org/hep-root',
      },
      answers: {
        'sustainability.l1.open_format': 'ROOT',
        'computability.l2.linked_schemas': 'ROOT TTree schema documented; loadable via uproot/PyROOT.',
      },
    }),
  },
];
