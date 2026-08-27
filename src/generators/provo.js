// PROV-O generator. Builds a W3C PROV-O JSON-LD scaffold from the assessment
// answers: a dataset prov:Entity, a prov:Agent from the declared role, and a
// curation prov:Activity from the transformation/software answers, connected by
// wasGeneratedBy / wasAssociatedWith.
//
// Variable-level entities and per-step activities are NOT synthesised — the
// checklist doesn't collect them. The user adds them in the Export PROV editor,
// following a small convention the validator relies on:
//   * a variable entity is a prov:Entity carrying  "kind": "variable"
//   * its lineage is a  "prov:wasDerivedFrom"  edge to its source(s)
// So entity_per_variable / feature_lineage_intact cannot pass on the scaffold
// alone (honest "claim -> check"), mirroring the Croissant descriptor.

import vocabularies from '../schema/vocabularies.json';

export const PROVO_CONTEXT = {
  prov: 'http://www.w3.org/ns/prov#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
};

const roleLabel = (id) => {
  const v = (vocabularies.vocabularies.stakeholder_roles?.values ?? []).find((x) => x.id === id);
  return v?.label ?? id;
};

const doiUrl = (value) => {
  const s = String(value ?? '').trim();
  return /^10\.\d{4,9}\/\S+$/.test(s) ? `https://doi.org/${s}` : s;
};

const nonEmpty = (v) => v !== null && v !== undefined && String(v).trim() !== '';

export function generateProvo(record) {
  const { answers = {}, provenance } = record;
  const a = (id) => answers[id]?.value;

  const persistentId = a('fairness.l1.persistent_id');
  const datasetId = nonEmpty(persistentId) ? doiUrl(persistentId) : '#dataset';

  // Prefer the structured builder model when it has content.
  if (provenance && ((provenance.sources?.length ?? 0) > 0 || (provenance.steps?.length ?? 0) > 0)) {
    return composeFromModel(record, datasetId);
  }

  const role = a('provenance.l3.agents_with_roles');
  const transformations = a('provenance.l2.transformations_documented');
  const software = a('provenance.l2.software_versions');

  const graph = [];
  const agentId = '#agent';
  const activityId = '#activity-curation';

  const datasetEntity = {
    '@id': datasetId,
    '@type': 'prov:Entity',
    'rdfs:label': 'Released dataset',
    'prov:wasGeneratedBy': { '@id': activityId },
  };
  graph.push(datasetEntity);

  if (nonEmpty(role)) {
    graph.push({
      '@id': agentId,
      '@type': ['prov:Agent', 'prov:Person'],
      'rdfs:label': roleLabel(role),
      role, // structural marker: this agent carries a role
    });
  }

  const activity = {
    '@id': activityId,
    '@type': 'prov:Activity',
    'rdfs:label': 'Curation',
  };
  if (nonEmpty(transformations)) activity['rdfs:comment'] = String(transformations).trim();
  if (nonEmpty(software)) activity.software = String(software).trim(); // parameters/software marker
  if (nonEmpty(role)) activity['prov:wasAssociatedWith'] = { '@id': agentId };
  graph.push(activity);

  return { '@context': PROVO_CONTEXT, '@graph': graph };
}

// Compose the PROV-O graph from the step-centric builder model. Each source and
// each step output becomes a prov:Entity; each step a prov:Activity (prov:used =
// inputs, prov:wasAssociatedWith = agent); outputs carry prov:wasDerivedFrom
// (the step's inputs) and prov:wasGeneratedBy (the step). Roles become agents.
function composeFromModel(record, datasetId) {
  const { answers = {}, provenance } = record;
  const sources = provenance.sources ?? [];
  const steps = provenance.steps ?? [];
  const fallbackRole = answers['provenance.l3.agents_with_roles']?.value;

  // Resolve a builder entity id (source or output) to its RDF node @id.
  const nodeId = new Map();
  sources.forEach((s) => nodeId.set(s.id, `#source/${s.id}`));
  steps.forEach((st) => (st.outputs ?? []).forEach((o) => nodeId.set(o.id, `#var/${o.id}`)));
  const ref = (eid) => ({ '@id': nodeId.get(eid) ?? `#source/${eid}` });
  const refs = (ids) => {
    const arr = (ids ?? []).map(ref);
    return arr.length === 1 ? arr[0] : arr;
  };

  const graph = [];
  const roles = new Set();

  const datasetEntity = { '@id': datasetId, '@type': 'prov:Entity', 'rdfs:label': 'Released dataset' };
  if (steps.length) datasetEntity['prov:wasGeneratedBy'] = { '@id': `#activity/${steps[steps.length - 1].id}` };
  graph.push(datasetEntity);

  sources.forEach((s) =>
    graph.push({ '@id': `#source/${s.id}`, '@type': 'prov:Entity', 'rdfs:label': s.name || s.id }),
  );

  steps.forEach((st) => {
    const actId = `#activity/${st.id}`;
    const role = st.agentRole || fallbackRole;
    const activity = { '@id': actId, '@type': 'prov:Activity', 'rdfs:label': st.label || 'Step' };
    if ((st.inputs ?? []).length) activity['prov:used'] = refs(st.inputs);
    if (nonEmpty(st.software)) activity.software = String(st.software).trim();
    if (nonEmpty(role)) {
      activity['prov:wasAssociatedWith'] = { '@id': `#agent/${role}` };
      roles.add(role);
    }
    graph.push(activity);

    (st.outputs ?? []).forEach((o) => {
      const out = {
        '@id': `#var/${o.id}`,
        '@type': 'prov:Entity',
        kind: 'variable',
        'rdfs:label': o.name || o.id,
        'prov:wasGeneratedBy': { '@id': actId },
      };
      if ((st.inputs ?? []).length) out['prov:wasDerivedFrom'] = refs(st.inputs);
      graph.push(out);
    });
  });

  roles.forEach((role) =>
    graph.push({
      '@id': `#agent/${role}`,
      '@type': ['prov:Agent', 'prov:Person'],
      'rdfs:label': roleLabel(role),
      role,
    }),
  );

  return { '@context': PROVO_CONTEXT, '@graph': graph };
}

// The record to validate/export: the user-edited PROV record if present, else
// the scaffold generated from answers.
export const effectiveProvo = (record) =>
  record?.provo && typeof record.provo === 'object' ? record.provo : generateProvo(record);
