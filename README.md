# AI-Readiness Assessment & Documentation builder

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.22149126.svg)](https://doi.org/10.5281/zenodo.22149126)

An interactive, browser-based tool that helps researchers assess whether their datasets are ready for publication, community sharing, or model training. The app implements the tiered assessment framework from *A data-centric framework for assessing and documenting research data for machine learning reuse* (González-Espinoza et al., 2026), combining the seven pre-model dimensions of the Bridge2AI Standards Working Group, the Data Readiness Levels of Lawrence, and the FAIR Maturity Indicators.

🔗 **Live app:** https://cmu-lib.github.io/aiready-dataset-docs-builder/

> ⚠️ **Status: proof-of-concept prototype — v0.1.0, pre-release (work in progress).** This app exists to demonstrate the framework, not as a production release. The core contribution is the review and the framework described in the paper; the tool is a proof of concept built on top of it. Interfaces, schema ids, and generated artifacts may still change before a 1.0 release.

## What it does

The tool walks a researcher through a structured self-assessment of their dataset across seven dimensions — FAIRness, Provenance, Characterization, Ethics, Pre-model Explainability, Sustainability, and Computability — and three readiness levels (L1 Accessible, L2 Faithful, L3 Task-ready). The required criteria for each dimension depend on where the researcher intends to publish or use the dataset.

At the end of the assessment, the app generates:

- a machine-readable **assessment report** (JSON)
- a **datasheet** or **healthsheet** in Markdown (Gebru et al. 2021; Rostamzadeh et al. 2022)
- a **Croissant** JSON-LD descriptor for ML-framework consumption (MLCommons 2024)
- a **PROV-O** JSON-LD provenance record (W3C 2013)
- a release-ready bundle combining all of the above

Before any of that, it also produces a **collection guide**: what to write down while the work is happening, so those documents are fillable later. See [Collection guide](#collection-guide).

## Audience pathways

The audience selector drives which criteria are required vs. optional. A researcher picks one pathway at the start:

| Pathway | Tier | Use case |
|---|---|---|
| **A — Accessible** | L1 | A person finds it and reads it: Figshare, an institutional repository, GitHub, or paper supplementary material. DOI + basic metadata. Croissant descriptor **recommended** (not required) — including one at L1 makes the dataset trivially upgradable to L2 later and ML-loadable today. |
| **B — Faithful** | L2 | A pipeline loads it, with someone preparing the load: Hugging Face, Kaggle, OpenML, or Dataverse. ML-ready metadata expected; Croissant descriptor required. |
| **C — Task-ready** | L3 | An automated or semi-automated workflow consumes it with nobody preparing the data first — a workflow engine, an AutoML system, or an instrumented laboratory that ingests it and walks its lineage unattended. Full provenance, bias audit, ethics-as-metadata, model-card linkage. |

**The levels measure machine-actionability, and governance is a separate axis.** Sensitive data carries access controls at every level; clearing them does not raise the level, and reaching L3 does not remove them. So the **discipline and governance sub-domain is selected independently of the pathway** — a human-subjects dataset aimed at L2 owes the same oversight evidence as one aimed at L3. Each overlay criterion carries the level of the base criterion it mirrors and becomes required at that tier: consent wording at L1, a de-identification method at L2, oversight and access evidence at L3. Until schema 0.6.0 the sub-domain was nested under Pathway C and unreachable elsewhere, which made governance a function of actionability.

The sub-selector adds discipline-specific criteria and pre-fills candidate deposition targets under FAIRness. Each overlay declares the dimension it belongs to, so a sub-domain is not confined to Ethics — the biomedical sub-domains overlay Ethics only, because that is where their distinguishing evidence lives, while Materials science also overlays FAIRness, Provenance, and Characterization. Overlays are additive: no sub-domain removes or relaxes anything in the base matrix.

- *General* (default) — standard L3 ethics evidence. Targets: PhysioNet, NIH Data Commons, generalist repositories with controlled-access tier.
- *Clinical / health* — swaps in the healthsheet template, surfaces IRB protocol ID and HIPAA de-identification method. Targets: **CHoRUS** (Bridge2AI Clinical Care Grand Challenge), PhysioNet, MIMIC-style controlled-access repositories.
- *Genomic / functional-genomics* — surfaces consent type, dbGaP accession, re-identification risk. Targets: **CM4AI** (Bridge2AI Cell Maps for AI Grand Challenge), dbGaP, GenBank for non-restricted derivatives.
- *Voice / public-health biomarker* — surfaces speaker consent, demographic representation audit, and accent / language coverage. Target: **Bridge2AI-Voice** (Voice as a Biomarker of Health Grand Challenge).
- *Institutional / human-subjects* — surfaces IRB and tiered-access policy. Targets: institutional Dataverse instances with restricted-access tier, ICPSR for social-science human-subjects data.
- *Materials science (computational & experimental)* — the first non-biomedical sub-domain, and the one that motivated making overlays dimension-aware. Surfaces domain-repository deposition, discipline encoding (CIF for crystal structures, NeXus for neutron/X-ray/muon experiments, CML for molecules), shared-vocabulary interoperability (EMMO, OPTIMADE, NOMAD Metainfo), a-priori provenance capture (AiiDA, FireWorks/atomate, signac, Nextflow + nf-prov, CWLProv, Workflow-Run RO-Crate), per-run instrument or computational parameters, and — in place of consent — the licensing and redistribution terms of third-party source data. Targets: **NOMAD**, **Materials Cloud Archive**, OQMD, ICSD, with Zenodo/Figshare/Dryad marked explicitly as a generalist fallback. Validators referenced: checkCIF (IUCr), cnxvalidate, optimade-validator.

The four Bridge2AI Grand Challenges (CM4AI, CHoRUS, Bridge2AI-Voice, AI-READI) are named explicitly in Clark et al. [1] as the originating context for the seven-dimension framework, so aligning Pathway C deposition targets to them keeps the assessment criteria and the candidate repositories consistent. The Materials science sub-domain is the first extension beyond that biomedical origin: it demonstrates that the seven dimensions transfer to a discipline where the binding constraint is not consent but encoding, ontology mapping, and provenance-by-construction — captured as the workflow runs, because at high throughput it cannot be reconstructed afterward.

## How it works

The assessment matrix (7 dimensions × 3 levels) is encoded as a JSON schema separate from the UI. **How far that separation goes today:** the seven schema files under `src/schema/` are plain JSON with no logic in them, and every consumer reads them through a `lib/` module rather than hardcoding values, so a fork can re-level criteria, add fields, or replace a whole vocabulary without touching application code — and the test suite tells it when a contract breaks (ids, levels, cumulative membership, citation resolution, cell coverage). What that does *not* yet mean is loading your own matrix into the running app: the files are resolved by Vite at build time, so adapting the tool means forking, editing JSON, and rebuilding. Runtime import of a user-supplied matrix, vocabulary set, or validator registry is a planned improvement rather than a current capability. Each criterion declares which pathways require it (`required_in_pathways`) and, where relevant, which merely recommend it (`recommended_in_pathways`) — Croissant at L1 is the standing example. The audience pathway therefore sets the required threshold per dimension; recommended-but-unmet criteria are surfaced as "additional strengths" without affecting the tier verdict.

The review screen shows a 7×3 heatmap. A cell turns green only when all its required criteria are satisfied. Unmet criteria surface inline remediation hints with section references back to the source paper.

## Features

- **Wizard flow** — starting point → audience selector → seven dimension pages → review/scorecard → export, with the collection guide reachable at any time
- **Prefilled options** drawn from controlled vocabularies in the source paper: licenses (CC-BY, CC0, ODbL), formats (Parquet, HDF5, NetCDF, Zarr, DICOM, NIfTI), repositories by tier — L1 (Figshare, Zenodo, institutional, GitHub), L2 (Hugging Face, Kaggle, OpenML, Dataverse, Dryad), L3 generic (PhysioNet, NIH Data Commons, dbGaP, ICPSR, GenBank), L3 Bridge2AI Grand Challenges (CM4AI, CHoRUS, Bridge2AI-Voice, AI-READI). Discipline vocabularies extend the same mechanism — Materials science adds repositories (NOMAD, Materials Cloud, OQMD, ICSD), encoding standards (CIF, NeXus, CML), an interoperability layer (EMMO, OPTIMADE, NOMAD Metainfo), and provenance engines (AiiDA, FireWorks, signac, nf-prov, CWLProv). "Custom" entry always available.
- **Binary checkmark heatmap** — pass/fail per cell, optional-criteria list below the heatmap
- **L3 and the ladder are the same claim** — the paper defines L3 as machine-actionable enough for an automated or semi-automated workflow to consume the dataset unattended, which is what the ladder measures, seen from the level axis instead of the artifact axis. `guidance.json` declares the correspondence: FAIRness and Computability L3 need the descriptor at `grounded` (a pipeline cannot fetch a file whose contentUrl is a label or whose checksum is the template's row of zeros), Provenance and Pre-model Explainability L3 need the PROV record `referentially sound` (a `wasDerivedFrom` edge pointing at an undeclared node is not a traversable pipeline). The Export page states it under each artifact's ladder, the review scorecard flags any L3 claim its artifacts cannot support, and `conformance-report.json` carries it — so answering a criterion no longer implies a capability the released files do not have
- **Per-dimension readiness profile** — the datasheet opens with it and `assessment-report.json` carries it: for each dimension, the level it reaches, the status of each of its three cells, and how many of its criteria are documented non-applicabilities. Readiness is a per-dimension property, so a deposit can reach L3 on four dimensions and L1 on two; the single met/not-met verdict cannot express that, and the review heatmap now shows the level each dimension reaches beside its row. Attained level is capped by what the chosen pathway actually asked about
- **Documented non-applicability is its own state** — non-human-subjects data has no consent basis to record and no de-identification method to name. Eight criteria declare `may_not_apply` and carry an explicit "Not applicable to this dataset" control; a flagged vocabulary value or "N/A" in free text counts too. It reports as `not-applicable` rather than as a satisfied requirement, so a materials deposit is not shown as equivalent to one carrying real IRB oversight, and the datasheet renders the basis as *not applicable to this dataset* instead of a gap. The explicit control is the only route open to a checkbox, which has no third state, and to an automated criterion, whose validator is bypassed rather than failed
- **Cell-to-criterion crosswalk** — the 21 cell texts of the paper's assessment matrix live in `matrix.json`, alongside the criteria that operationalise them, and each expands to one to five checkable criteria. Where a criterion asks for something the cell wording does not name, it carries a `beyond_cell` attribution saying which table, figure, or section of the paper it comes from; `tests/matrix.test.js` asserts every cell is populated, no criterion sits outside a declared cell, and every extension is attributed. Seven criteria currently carry one, listed on the start page under the matrix
- **Every worksheet row speaks in the right voice** — each criterion declares either a `collection_hint` (there is a capture moment, and here it is) or a `no_capture` statement (nothing to record in advance, and why: assigned by the repository at deposit, or computed from the released files). The guide used to substitute `remediation` for the 32 criteria that had neither, printing reviewer-voice fix instructions inside a document about what to write down beforehand; `tests/matrix.test.js` now requires exactly one of the two, so a stated absence is a decision on record rather than an omission
- **The basis of every answer, in the datasheet** — each answer is followed by how it is given: `validator-checked`, `attested; evidence: <link>`, `human judgement`, or `not yet recorded`. A reader deciding whether to trust the dataset can tell a validated fact from a declared one, and a short "How to read this datasheet" preamble defines the four tags. An unmet criterion is tagged `not yet recorded` rather than with its mode, because nothing was validated, declared, or judged for it
- **Verification record for the whole assessment** — `conformance-report.json` (v2) covers every required criterion, not only the ones a validator can settle, and gives each mode its own status vocabulary: `pass`/`fail`/`pending` for automated, `declared`/`undeclared` for attested, `recorded`/`unrecorded` for manual, plus `upcoming` for anything not yet due at the user's lifecycle stage. Reusing `pass` for a declaration would assert that something was verified when nobody verified anything. Each entry carries the sentence saying what confirms it, so the report reads without the paper beside it
- **Degrees of machine-actionability** — explained in the collection guide, where the four forms of a record end, and computed per artifact on the Export page. Both read the five rungs from `guidance.json`, so the explanation and the verdict cannot drift. The ladder from the source paper: well-formed → schema-valid → referentially sound → grounded → executable. *Machine-readable* and *machine-actionable* are not the same property, and the ladder is what separates them: a descriptor can validate against the schema while a field source points at an undeclared file (not referentially sound), or resolve perfectly while its checksum is still the template's row of zeros and its licence is free text (not grounded). The Croissant and PROV-O tabs show the rung reached and what is blocking the next one; `conformance-report.json` records the same verdict per artifact. **Executable is deliberately not certified** — it would mean round-tripping each artifact through the tool that will consume it and dereferencing identifiers over the network, neither of which an offline checker can do, so the report names the check that would certify it and marks the rung out-of-scope
- **Three template generators** — Croissant, PROV-O, datasheet/healthsheet. The datasheet is editable before download; the Croissant descriptor and PROV-O record are composed from their builders, with raw JSON-LD editing available as an explicit, reversible override
- **Inlined seeded examples** — seven reference datasets shipped with the bundle:
  - Tabular Zenodo dataset (Pathway A)
  - Hugging Face dataset with Croissant descriptor (Pathway B)
  - BIDS neuroimaging dataset
  - Synthetic MIMIC-shaped clinical dataset (Pathway C → Clinical, CHoRUS-aligned)
  - Synthetic CM4AI-style cell-mapping dataset (Pathway C → Genomic)
  - α-quartz XRD + DFT relaxation (Pathway C → Materials science; built through the Croissant builder)
  - High-energy physics ROOT example (illustrates FAIR-for-models linkage)
- **Collection guide** — a printable worksheet of what to observe and when, generated from the same criteria (see below)
- **What confirms each criterion** — every one of the 72 criteria carries a `verification_hint`: one sentence naming what would confirm it. Automated hints state what the tool actually checks and where it stops; attested hints name the artifact that backs the declaration; manual hints name the stakeholder role that confirms it and how. The hint is visible on the criterion card, so the mode chip is glossed in context, and the sentence's voice per mode is enforced in `tests/matrix.test.js`
- **The to-do list is a plan, not a list of gaps** — items are grouped by lifecycle stage in the order the work happens, with acquisition and curation marked **closing** (a consent wording is gone once collection ends; a DOI is five minutes at deposit, and the old flat list gave them equal billing). Each item says what would confirm it before how to close it, names the stakeholder role that confirms it, and links the tool whose report is the evidence. Four kinds of not-done are kept apart rather than flattened into "unmet": actionable now, not yet due, locked by a past decision (document it as a limitation — fixing it is not available), and **bounded by a released artifact** short of a ladder rung, where answering the criterion cannot help. A `By owner` section makes the same work assignable. No effort estimates: the tool has no basis for them
- **A crosswalk to Gebru's headings** — the generated datasheet is ordered by assessment dimension so one criterion is never printed under two stage headings, which leaves a reviewer arriving with the template's seven groups in mind looking at seven dimensions. A closing section maps each group (Motivation, Composition, Collection process, Preprocessing, Uses, Distribution, Maintenance) to the sections that answer it, with the group's own guiding question; a test asserts every target section exists
- **Verification is a phase, not an implication** — the tool's top-level picture used to read *FAIR-published + documentation → ML-ready*, which is the claim §3.5 exists to refute: producing a descriptor and having one a pipeline can act on are different things. The diagram now has a **Checked** node between them; the guide opens with the five phases in order (capture → document → **verify** → release → steward) and says the third is the one most easily skipped; each documentation layer states what checks it, including the datasheet, which nothing checks mechanically at all; and the L3 level meaning says verification is not optional at that tier, because those claims are bounded by how far the released artifacts climb the ladder
- **Validating before release, and after it** — the collection guide carries the paper's five validation categories (statistical, structural, domain expert review, bias and fairness, reproducibility) with what settles each, including the one no validator can; plus the post-release obligations release does not end — versioning and citing the version, deprecating rather than withdrawing, a route for errata, a stated cadence, and a format-migration plan
- **Pick-lists that explain themselves** — five controlled vocabularies shipped bare lists of ids; each value now carries a note drawn from the paper's tables (what k-anonymity guarantees and why the k must be recorded, how `restricted` differs from `controlled`, what each green-AI intervention reduces and the metric it is reported by), shown under the selection. Two vocabularies that were referenced by nothing are wired as non-binding suggestions on the free-text criteria they belong to
- **Validator lookup** (`/validators`) — the tool runs the general checks itself (Croissant structure, PROV-O shapes, identifier grounding) and *references* discipline validators rather than reimplementing them. The page suggests them from what the record declares — release format, discipline, whether a provenance record is being produced — ranked most-specific first and each stating why it matched: declaring NetCDF surfaces CF-checker, a clinical sub-domain surfaces Aequitas and Fairlearn, a materials CIF export surfaces checkCIF. Each card carries how the tool is run (in the app, locally, or a hosted service) and which assessment criteria its report backs. Where nothing matches, the three community registries (FAIRsharing, DCC, RDA MSC) are the authoritative lookup for the long tail
- **Validator suggestions on the criterion** — where a criterion names the tool whose report is its evidence, it is linked on the card; an attested criterion that names none links to the lookup instead, so "a declaration accompanied by an external validator's report" always has somewhere to get the report
- **Verification modes explained** — what each mode asks of the user is stated as a legend on each dimension page, a panel under the review scorecard showing how much of the assessment a validator can settle, and a section of the collection guide. One definition in `guidance.json` feeds all of them
- **Two authoring builders** — files and columns compose the Croissant descriptor; sources and steps compose the PROV-O record, so neither requires hand-written JSON-LD
- **Offline-capable** — once loaded, the app runs entirely in the browser with no external runtime calls

## Collection guide

The assessment asks for a Croissant descriptor and a provenance record. Neither is fillable unless
somebody wrote the right things down while the work was happening, and by the time the assessment is
run it is usually too late: instrument settings, operator, calibration state, and consent wording are
available at the moment of collection and progressively harder to recover after it.

The **Research data collection guide** (its own entry in the top navigation, or `/guide`) closes that
gap. It covers:

- **The four forms of a record** — paper notebook → electronic lab notebook → structured capture
  (templated ELN, LIMS, or an instrument export in a disciplinary format) → machine-actionable
  (Croissant and PROV-O, terms bound to shared vocabularies). One worked observation is carried
  through all four, with what each form gains, what it still withholds, and how strongly it obliges
  you to adopt a standard. Where acquisition is semi-automated or fully automated, the progression
  collapses: the engine writes the machine-actionable record in real time with the experiment.
- **The six questions** — who, what, when, where, why, how, and which artifact each answer lands in.
  This is why the tool emits more than one document: Croissant answers *what*, PROV-O answers
  *how it came to be*.
- **What builds each documentation layer** — the records a project already keeps, mapped onto the
  artifact they populate, over the identifier and vocabulary schemes (ORCID, ROR, RRID, PIDINST, DOI,
  SPDX, UCUM, LOINC/SNOMED, EMMO) that ground all three.
- **A per-run log template** and a **worksheet** of every observation the selected pathway will ask
  for, grouped by the lifecycle stage at which it is still capturable. The acquisition group comes
  first because it is the only one that becomes unrecoverable.
- **Binding terms to shared vocabularies** (Pathway C), with three worked examples, and a survey of
  the tools that reduce the burden: workflow engines that emit provenance as a by-product, formats
  that carry their own metadata, ELN/LIMS, identifier schemes, metadata templates, and repositories
  that parse structured metadata from raw output.

The worksheet is generated from the same criteria as the assessment, so adding a criterion or a
sub-domain overlay extends the guide with no separate edit. Criteria carry a `collection_hint` (what
to record, at the time) distinct from `remediation` (how to close a gap); L3 criteria and all
sub-domain overlays have one, and the rest fall back to their remediation text.

It is available three ways: **on screen**, as a **Markdown download**, and as a **PDF** through the
browser's print dialog. The PDF is a separate rendering rather than a print stylesheet over the web
page — serif body sized in points, numbered sections, a contents list, tables in place of coloured
chips, and a masthead and colophon so a page found on its own still says what it describes.

## Tech stack

- **React** + **Vite** for the static bundle
- **Tailwind CSS** for styling
- **zod** for JSON-Schema validation of user inputs (also used to validate generated Croissant descriptors against the bundled MLCommons schema)
- **HashRouter** for deep links on GitHub Pages without server-side rewrites
- Plain-JS JSON-LD construction (no Node runtime required at load time)
- **`localStorage`** for resumable in-progress assessments, plus a **JSON export** of the whole record as an archival artifact. `localStorage` is a prototype-grade choice (private-browsing tabs disable it, and it is per-origin/per-browser), so an assessment resumes in the same browser but does not travel between devices

## Repository structure

```
aiready-dataset-docs-builder/
├── index.html · vite.config.js · package.json
├── public/favicon.svg
├── src/
│   ├── main.jsx                     # React root + HashRouter + AssessmentProvider
│   ├── App.jsx                      # route table
│   ├── routes/
│   │   ├── StartingPoint.jsx        # lifecycle intake (index route)
│   │   ├── AudienceSelector.jsx     # pathway + Pathway-C sub-domain
│   │   ├── DimensionPage.jsx        # one page per dimension, schema-driven
│   │   ├── Review.jsx               # 7×3 heatmap + verdict
│   │   ├── Documents.jsx            # datasheet / Croissant / PROV-O authoring (was Export.jsx)
│   │   ├── Conformance.jsx          # per-artifact actionability ladder + verification report
│   │   ├── Download.jsx             # release-bundle assembly
│   │   ├── Guide.jsx                # collection guide, readable and printable
│   │   ├── Validators.jsx           # discipline-validator lookup (/validators)
│   │   ├── Examples.jsx · References.jsx   # /export survives as an inline redirect in App.jsx
│   ├── components/
│   │   ├── Layout.jsx · Carousel.jsx · CriterionField.jsx
│   │   ├── guidance.jsx             # ladder / questions / layer-input blocks (shared)
│   │   ├── CollectionGuide.jsx      # the guide on screen
│   │   ├── CollectionGuidePrint.jsx # the guide as a paper document
│   │   ├── CroissantBuilder.jsx     # files + record sets -> Croissant
│   │   ├── ProvenanceBuilder.jsx    # sources + steps -> PROV-O
│   │   └── DegreeLadder.jsx         # per-artifact actionability rungs (Conformance)
│   ├── lib/
│   │   ├── dimensions.js · pathway.js · stages.js
│   │   ├── depositionTargets.js     # pathway/sub-domain-scoped repository options
│   │   ├── grounding.js · croissantValidation.js · provoValidation.js · validation.js
│   │   ├── actionability.js         # degrees of machine-actionability per artifact
│   │   ├── validators.js            # registry resolution + data-driven matching
│   │   ├── shacl.js · report.js · thisWork.js · download.js
│   ├── generators/
│   │   └── croissant.js · provo.js · datasheet.js · todo.js · collectionGuide.js
│   ├── schema/
│   │   ├── matrix.json              # 7×3 assessment matrix
│   │   ├── pathways.json            # A / B / C; six Pathway-C sub-domains with L3 overlays
│   │   ├── vocabularies.json        # licenses, formats, repositories, discipline vocabularies
│   │   ├── validators.json          # discipline-validator registry
│   │   ├── references.json          # citation registry
│   │   └── guidance.json            # standing guidance prose (ladder, questions, examples)
│   ├── examples/build.js · index.js # seven correct-by-construction records
│   ├── shapes/provo.shapes.ttl      # SHACL profile for the PROV-O record
│   ├── assets/                      # CMU + TRDA logos
│   └── styles/tailwind.css
├── tests/                           # vitest: schema validity, generators, validators, examples
└── .github/workflows/deploy.yml     # build + test + gh-pages deploy
```

## Getting started

### Run locally

```bash
git clone https://github.com/cmu-lib/aiready-dataset-docs-builder.git
cd aiready-dataset-docs-builder
npm install
npm run dev
```

The dev server runs at `http://localhost:5173`.

### Build for production

```bash
npm run build
```

The static bundle is written to `dist/`.

### Deploy to GitHub Pages

The included workflow at `.github/workflows/deploy.yml` builds and deploys on every push to `main`. To enable:

1. In repo settings, set **Pages → Source** to `GitHub Actions`.
2. Push to `main`.

If you fork this under a different repository name, update `base` in `vite.config.js` to match it (currently `/aiready-dataset-docs-builder/`), or the built assets will 404.

## Customizing the assessment

The assessment matrix lives at `src/schema/matrix.json`. Each entry describes one criterion:

```json
{
  "id": "fairness.l2.croissant_descriptor",
  "dimension": "FAIRness",
  "level": "L2",
  "label": "Croissant 1.0 descriptor present and validates against the MLCommons schema",
  "evidence_type": "boolean",
  "verification": "automated",
  "lifecycle_stage": "documentation",
  "required_in_pathways": ["B", "C"],
  "recommended_in_pathways": ["A"],
  "references": ["Akhtar2024", "Clark2026"],
  "remediation": "Use the in-app Croissant generator. Including a descriptor at L1 makes the dataset directly ML-loadable today and trivially upgradable to L2."
}
```

`required_in_pathways` follows the cumulative ladder (L1 → A/B/C, L2 → B/C, L3 → C) and is
test-enforced. `verification` is `automated`, `attested`, or `manual`; `lifecycle_stage` drives
whether a criterion shows as active, locked, or upcoming given the researcher's starting point.
`evidence_type` selects the input widget, and `controlled_vocabulary` criteria name a
`vocabulary_key` resolved in `vocabularies.json`.

To create a domain-tuned variant (e.g., a high-energy-physics profile), edit `matrix.json` and rebuild. The schema files are plain JSON with no code references to individual criteria, so a discipline profile is a data change. (Loading a tuned schema at runtime, without a rebuild, is a possible future extension rather than a current feature.)

### Adding a discipline sub-domain

A discipline that needs extra criteria is added as a sub-domain in `src/schema/pathways.json`, without touching the base matrix. Sub-domains sit at the top level of that file rather than inside a pathway, because the discipline and governance context is independent of the target level. One entry supplies the label, the deposition-target vocabulary, the documentation template (`datasheet` or `healthsheet`), and an `overlay` array. Each overlay entry names the `dimension` it belongs to, so it is merged into that dimension's page, that cell of the heatmap, and the matching section of the generated datasheet — no component code changes. The overlay's `remediation` string is what the researcher reads as fill-in guidance, so it is where the concrete field names of the discipline's standards belong.

The supporting data lives alongside it: controlled vocabularies in `vocabularies.json` (referenced by `vocabulary_key`), any discipline validators in `validators.json`, and citations in `references.json` (every key in an overlay's `references` array must resolve there — `tests/matrix.test.js` enforces this, along with id uniqueness against the base matrix and vocabulary resolution). Each overlay declares its own level and obeys the same cumulative rule as the matrix, so it becomes required at the tier that matches the base criterion it mirrors — consent wording at L1, a de-identification method at L2, oversight evidence at L3 — and the id carries that level, which the tests also check. The Materials science sub-domain is the worked example of the full pattern.

## References

The framework, dimensions, and templates implemented here are drawn from:

1. Clark, T. et al. (2024–2026). *AI-readiness for Biomedical Data: Bridge2AI Recommendations.* bioRxiv 2024.10.23.619844 (multiple revisions; v5 dated 23 March 2026). doi:10.1101/2024.10.23.619844
2. Lawrence, N. D. (2017). *Data Readiness Levels.* arXiv:1705.02245 [cs.DB], 5 May 2017. doi:10.48550/arXiv.1705.02245
3. Bahim, C., Casorrán-Amilburu, C., Dekkers, M., Herczog, E., Loozen, N., Repanas, K., Russell, K., & Stall, S. (2020). *The FAIR Data Maturity Model: An Approach to Harmonise FAIR Assessments.* Data Science Journal 19(1): 41. doi:10.5334/dsj-2020-041
4. Wilkinson, M. D., Dumontier, M., Aalbersberg, IJ. J., et al. (2016). *The FAIR Guiding Principles for scientific data management and stewardship.* Scientific Data 3: 160018. doi:10.1038/sdata.2016.18
5. Akhtar, M., Benjelloun, O., Conforti, C., et al. (2024). *Croissant: A Metadata Format for ML-Ready Datasets.* In *Proceedings of the Eighth Workshop on Data Management for End-to-End Machine Learning (DEEM '24)*, Santiago, Chile, 9 June 2024, pp. 1–6. doi:10.1145/3650203.3663326
6. Lebo, T., Sahoo, S., & McGuinness, D. (eds.) (2013). *PROV-O: The PROV Ontology.* W3C Recommendation, 30 April 2013. https://www.w3.org/TR/prov-o/
7. Gebru, T., Morgenstern, J., Vecchione, B., Wortman Vaughan, J., Wallach, H., Daumé III, H., & Crawford, K. (2021). *Datasheets for Datasets.* Communications of the ACM 64(12): 86–92. doi:10.1145/3458723
8. Mitchell, M., Wu, S., Zaldivar, A., et al. (2019). *Model Cards for Model Reporting.* In *Proceedings of the Conference on Fairness, Accountability, and Transparency (FAT\* '19)*, Atlanta, GA, USA, 29–31 January 2019, pp. 220–229. doi:10.1145/3287560.3287596
9. Rostamzadeh, N., Mincu, D., Roy, S., et al. (2022). *Healthsheet: Development of a Transparency Artifact for Health Datasets.* In *Proceedings of the 2022 ACM Conference on Fairness, Accountability, and Transparency (FAccT '22)*, Seoul, Republic of Korea, 21–24 June 2022, pp. 1943–1961. doi:10.1145/3531146.3533239
10. Ravi, N., Chaturvedi, P., Huerta, E. A., et al. (2022). *FAIR principles for AI models with a practical application for accelerated high energy diffraction microscopy.* Scientific Data 9: 657. doi:10.1038/s41597-022-01712-9

The app's References page renders this list from `src/schema/references.json`, with resolvable DOI links.

### Materials science sub-domain

Most of the sources the Materials science overlay cites are now in the framework paper's bibliography and carry its reference number in the registry (Ghiringhelli et al. 2023 and Huber et al. 2020 among them). Five are cited only by the overlay and not by the paper. They are held in the same registry (`src/schema/references.json`, marked `source: "materials-guidance"` and carrying no `ref`) and render after the numbered list on the app's References page.

- Hall, S. R., Allen, F. H., & Brown, I. D. (1991). *The crystallographic information file (CIF): a new standard archive file for crystallography.* Acta Crystallographica A47(6): 655–685. doi:10.1107/S010876739101067X
- Andersen, C. W. et al. (2021). *OPTIMADE, an API for exchanging materials data.* Scientific Data 8: 217. doi:10.1038/s41597-021-00974-z
- European Materials Modelling Council (2021). *EMMO — Elementary Multiperspective Material Ontology.* https://emmo-repo.github.io/
- Pizzi, G., Cepellotti, A., Sabatini, R., Marzari, N., & Kozinsky, B. (2016). *AiiDA: automated interactive infrastructure and database for computational science.* Computational Materials Science 111: 218–230. doi:10.1016/j.commatsci.2015.09.013
- Ó Carragáin, E., Goble, C., Sefton, P., & Soiland-Reyes, S. (2019). *A lightweight approach to research object data packaging (RO-Crate).* BOSC 2019, ISMB/ECCB. doi:10.5281/zenodo.3250687

## License

The application code is released under the MIT License. The assessment framework it implements is documented in the source paper cited above; see that paper for attribution requirements when adapting the framework itself.

## Citation

Cite the **framework paper** when you use the tiered assessment model itself — the seven dimensions, the L1/L2/L3 levels, or the audience pathways — in a study or in your own tooling.

Cite the **software** when you use the app to produce artifacts you ship or publish: a datasheet or healthsheet, a Croissant descriptor, a PROV-O provenance record, a release bundle, or a machine-readable assessment report. In practice this is the more common case — the documentation builder is what most users take away, and datasets released with artifacts generated here should point back to it so the templates and vocabularies used are traceable.

```bibtex
@misc{gonzalez2026airready,
  title  = {A data-centric framework for assessing and documenting
            research data for machine learning reuse},
  author = {González-Espinoza et al.},
  year   = {2026},
  institution = {Carnegie Mellon University, University Libraries}
}

@software{airready_app_2026,
  title   = {AI-Readiness Assessment and Documentation Builder:
             a browser-based generator for datasheets, Croissant
             descriptors, and PROV-O provenance records},
  author  = {González-Espinoza et al.},
  year    = {2026},
  version = {0.1.0 (proof-of-concept prototype, pre-release)},
  url     = {https://github.com/cmu-lib/aiready-dataset-docs-builder},
  note    = {Work in progress. Live app: https://cmu-lib.github.io/aiready-dataset-docs-builder/}
}
```

The documentation artifacts the builder emits implement published templates and specifications that carry their own attribution: datasheets (Gebru et al. 2021), healthsheets (Rostamzadeh et al. 2022), Croissant (Akhtar et al. 2024), and PROV-O (W3C 2013). Cite those alongside this tool when the artifact itself is the object of discussion — see [References](#references).

## Contributing

Issues and pull requests are welcome. For substantive changes to the assessment matrix itself, please open an issue first describing the rationale and the source it derives from — the matrix is intended to track the published framework, and divergences should be documented.

## AI Disclosure Statement

This project was built using GitHub Co-pilot as autocomplete, Claude Code (Opus 4.8 in manual mode) for most of the webpage architecture, backend and documentation, and the chatbot version of Claude Opus 4.8 for the visual design. Everything generated with LLMs was planned prior to execution and revised after generation, sometimes with iterated prompts, most of the content was edited before publishing. Not a single LLM-generated content was produced by using _zero-shot_ techniques or with Agents (automatic delegation). The authors of this project are thankful to Open Science and all the contributors of Open Source that made the training data for Large Language Models possible. 

## Contact

Alfredo González-Espinoza · agonzal3@andrew.cmu.edu · Carnegie Mellon University Libraries
