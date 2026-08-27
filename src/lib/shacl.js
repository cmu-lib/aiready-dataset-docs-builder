// SHACL runner (Phase 4, on-demand "Deep validate"). Expands the PROV-O JSON-LD
// to RDF, validates against the PROV profile shapes, and returns the report.
//
// Heavy RDF libraries are lazy-imported so the base app bundle stays light —
// they load only when the user triggers deep validation. We parse shapes and
// data with n3 into plain quad arrays and let rdf-validate-shacl use its own
// default environment (which bundles clownface); passing a bare rdf-ext factory
// fails because the validator needs factory.clownface.

const RELATIVE_BASE = 'urn:airready:record';

let cached = null;
async function load() {
  if (cached) return cached;
  const [jsonldMod, n3Mod, rdfMod, shaclMod, shapesMod] = await Promise.all([
    import('jsonld'),
    import('n3'),
    import('rdf-ext'),
    import('rdf-validate-shacl'),
    import('../shapes/provo.shapes.ttl?raw'),
  ]);
  cached = {
    jsonld: jsonldMod.default ?? jsonldMod,
    N3: n3Mod.default ?? n3Mod,
    rdf: rdfMod.default ?? rdfMod,
    SHACLValidator: shaclMod.default ?? shaclMod,
    shapesTtl: shapesMod.default ?? shapesMod,
  };
  return cached;
}

// Validate a PROV-O JSON-LD record against the profile shapes.
// Returns { conforms, results: [{message, path, focusNode, severity}], dataset }.
export async function validateProvoShacl(provoJsonld, opts = {}) {
  const base = opts.base ?? RELATIVE_BASE;
  const { jsonld, N3, rdf, SHACLValidator, shapesTtl } = await load();

  // Build proper DatasetCores (with .match) for both graphs; let the validator
  // use its own default environment (which provides clownface).
  const shapes = rdf.dataset(new N3.Parser().parse(shapesTtl));
  const nquads = await jsonld.toRDF(provoJsonld, { base, format: 'application/n-quads' });
  const data = rdf.dataset(new N3.Parser({ format: 'N-Quads' }).parse(nquads));

  const validator = new SHACLValidator(shapes);
  const report = await validator.validate(data);

  const results = report.results.map((r) => ({
    message: (Array.isArray(r.message) ? r.message.map((m) => m.value) : [String(r.message ?? '')])
      .filter(Boolean)
      .join(' '),
    path: r.path?.value ?? null,
    focusNode: r.focusNode?.value ?? null,
    severity: r.severity?.value ? r.severity.value.split('#').pop() : 'Violation',
  }));

  return { conforms: report.conforms, results, dataset: report.dataset };
}

const PREFIXES = {
  sh: 'http://www.w3.org/ns/shacl#',
  prov: 'http://www.w3.org/ns/prov#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
};

function writeQuads(N3, quads, opts) {
  return new Promise((resolve, reject) => {
    const writer = new N3.Writer(opts);
    writer.addQuads(quads);
    writer.end((err, result) => (err ? reject(err) : resolve(result)));
  });
}

async function datasetToTurtle(dataset) {
  const { N3 } = await load();
  return writeQuads(N3, [...dataset], { prefixes: PREFIXES });
}

async function datasetToJsonldString(dataset) {
  const { N3, jsonld } = await load();
  const nquads = await writeQuads(N3, [...dataset], { format: 'N-Quads' });
  const doc = await jsonld.fromRDF(nquads, { format: 'application/n-quads' });
  return JSON.stringify(doc, null, 2);
}

// Serialize a SHACL validation-report dataset (itself RDF) to Turtle or JSON-LD.
export async function serializeReport(reportDataset, format = 'turtle') {
  return format === 'turtle' ? datasetToTurtle(reportDataset) : datasetToJsonldString(reportDataset);
}

// Serialize a PROV-O JSON-LD record to Turtle (for the export format toggle).
export async function provoToTurtle(provoJsonld, opts = {}) {
  const { jsonld, N3 } = await load();
  const nquads = await jsonld.toRDF(provoJsonld, {
    base: opts.base ?? RELATIVE_BASE,
    format: 'application/n-quads',
  });
  const quads = new N3.Parser({ format: 'N-Quads' }).parse(nquads);
  return writeQuads(N3, quads, { prefixes: PREFIXES });
}
