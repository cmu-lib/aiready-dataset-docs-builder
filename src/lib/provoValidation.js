// PROV-O structural validation — presence/structure checks over the JSON-LD
// graph (not SHACL; deeper shape validation is Phase 4). Same "sound subset"
// posture as the Croissant validator: hard errors are only genuine
// well-formedness problems; missing structure is reported via the counts the
// per-criterion checks consume.
//
// Convention (see generators/provo.js): a variable entity is a prov:Entity with
// "kind": "variable"; its lineage is a "prov:wasDerivedFrom" edge.

const hasType = (n, t) => n?.['@type'] === t || (Array.isArray(n?.['@type']) && n['@type'].includes(t));
const nonEmpty = (v) => v !== null && v !== undefined && String(v).trim() !== '';

export function validateProvo(desc) {
  const errors = [];
  const warnings = [];

  if (!desc || typeof desc !== 'object') {
    return {
      valid: false,
      errors: ['PROV record is not an object.'],
      warnings: [],
      variableEntityCount: 0,
      activityCount: 0,
      agentWithRoleCount: 0,
      derivationIntact: false,
    };
  }

  const ctx = desc['@context'];
  if (!ctx || typeof ctx !== 'object' || !(ctx.prov || ctx['@vocab'])) {
    errors.push('Missing PROV @context (expected a "prov" namespace).');
  }

  const graph = Array.isArray(desc['@graph']) ? desc['@graph'] : null;
  if (!graph) errors.push('Missing @graph array.');
  const nodes = graph ?? [];

  const entities = nodes.filter((n) => hasType(n, 'prov:Entity'));
  if (entities.length === 0) errors.push('No prov:Entity present.');

  const variableEntities = nodes.filter((n) => n.kind === 'variable' && hasType(n, 'prov:Entity'));
  const activitiesWithSoftware = nodes.filter(
    (n) => hasType(n, 'prov:Activity') && (nonEmpty(n.software) || n['prov:used']),
  );
  const agentsWithRole = nodes.filter((n) => hasType(n, 'prov:Agent') && nonEmpty(n.role));
  const derivationIntact =
    variableEntities.length > 0 && variableEntities.every((n) => Boolean(n['prov:wasDerivedFrom']));

  if (variableEntities.length === 0) warnings.push('No variable-level entities (add prov:Entity nodes with "kind":"variable").');
  if (activitiesWithSoftware.length === 0) warnings.push('No activity records software/parameters.');
  if (agentsWithRole.length === 0) warnings.push('No agent carries a role.');

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    variableEntityCount: variableEntities.length,
    activityCount: activitiesWithSoftware.length,
    agentWithRoleCount: agentsWithRole.length,
    derivationIntact,
  };
}
