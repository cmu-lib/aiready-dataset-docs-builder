// Degrees of machine-actionability — the ladder from the paper's conformance
// section (§3.5, tab:actionability-ladder). Machine-readable and machine-
// actionable are not the same property: a file can parse as valid JSON and still
// fail to load because a reference points nowhere or a value is free text where an
// identifier was needed. The ladder names the distance between the two, and each
// rung has a check that certifies it:
//
//   well-formed          parses as JSON or RDF
//   schema-valid         validates against a schema (the Croissant JSON Schema)
//   referentially sound  internal references resolve; SHACL shape constraints hold
//   grounded             values are resolvable identifiers, not free text
//   executable           a target tool ingests and acts on it
//
// The tool deliberately stops at `grounded`. `executable` would mean round-tripping
// each artifact through the tool that will eventually consume it (mlcroissant, a
// triple store), and identifier resolution over the network; both are out of reach
// for an offline, client-side checker, so the report says so plainly and names the
// check that would certify the rung. `executable` is therefore always reported
// 'out-of-scope'; reporting 'fail' would imply a check that ran.
//
// Pure module: no React, no network, no async. The SHACL report is asynchronous
// and lives on the Conformance page, so it is passed in via opts when it exists.

import guidance from '../schema/guidance.json';
import { isDoi, isOrcid, isWellFormedUri } from './grounding.js';
import { isLevelInScope } from './pathway.js';

// The rungs come from guidance.json, where they sit next to the four forms of a
// record — the two ladders meet end to end, and the collection guide explains the
// same five degrees this module computes. `tone` is a UI class, so it is dropped
// here: what travels into the conformance report is the rung, its certifying
// check, and what it means.
export const DEGREES = guidance.degrees.rungs.map(({ id, label, check, means }) => ({
  id,
  label,
  check,
  means,
}));

// Prose that belongs with the ladder wherever it is shown.
export const LADDER_LEAD = guidance.degrees.lead;
export const LADDER_SCOPE_NOTE = guidance.degrees.scope_note;
export const degreeTone = (id) =>
  guidance.degrees.rungs.find((r) => r.id === id)?.tone ?? '';

export const DEGREE_IDS = DEGREES.map((d) => d.id);
export const getDegree = (id) => DEGREES.find((d) => d.id === id) ?? null;

const pass = (message) => ({ status: 'pass', message });
const fail = (message) => ({ status: 'fail', message });
const outOfScope = (message) => ({ status: 'out-of-scope', message });

const EXECUTABLE_NOTE =
  'Not checked: certifying this means round-tripping the artifact through the tool that will consume it, which an offline checker cannot do. Verify with mlcroissant (Croissant) or your triple store (RDF) before release.';

// The highest rung reached with every rung below it passing. 'out-of-scope' ends
// the run rather than extending it, so `attained` tops out at 'grounded' — which is
// the tool's stated ceiling, not a defect. null when the artifact is not even
// well-formed.
export function attainedDegree(degrees) {
  let attained = null;
  for (const id of DEGREE_IDS) {
    if (degrees[id]?.status !== 'pass') break;
    attained = id;
  }
  return attained;
}

const withAttained = (degrees) => ({ ...degrees, attained: attainedDegree(degrees) });

const count = (n, singular, plural = `${singular}s`) =>
  `${n} ${n === 1 ? singular : plural}`;

// --- Croissant -------------------------------------------------------------
// `result` is the validateCroissant() return, which buckets its errors into
// schemaErrors and referenceErrors for exactly this purpose. `opts.parseError`
// carries the syntax error when the user is hand-editing the raw descriptor and
// the text does not parse — the one case where well-formedness genuinely fails.
export function croissantDegrees(desc, result, opts = {}) {
  const degrees = {};

  if (opts.parseError) {
    degrees.well_formed = fail(`Does not parse as JSON: ${opts.parseError}`);
  } else if (!desc || typeof desc !== 'object' || !result?.wellFormed) {
    degrees.well_formed = fail('Not a JSON object.');
  } else {
    degrees.well_formed = pass('Parses as JSON.');
  }

  const schemaErrors = result?.schemaErrors ?? [];
  const referenceErrors = result?.referenceErrors ?? [];
  const ok = degrees.well_formed.status === 'pass';

  degrees.schema_valid =
    ok && schemaErrors.length === 0
      ? pass('Required Croissant 1.0 properties present and correctly typed.')
      : fail(
          ok
            ? `${count(schemaErrors.length, 'schema error')}: ${schemaErrors[0]}`
            : 'Not assessed — the descriptor does not parse.',
        );

  degrees.referentially_sound =
    degrees.schema_valid.status === 'pass' && referenceErrors.length === 0
      ? pass('Every field source resolves to a declared distribution; all @id values unique.')
      : fail(
          referenceErrors.length > 0
            ? `${count(referenceErrors.length, 'reference error')}: ${referenceErrors[0]}`
            : 'Not assessed — the descriptor is not schema-valid.',
        );

  degrees.grounded =
    degrees.referentially_sound.status === 'pass'
      ? groundedCroissant(desc)
      : fail('Not assessed — the descriptor is not referentially sound.');

  degrees.executable = outOfScope(EXECUTABLE_NOTE);
  return withAttained(degrees);
}

// Grounding for a descriptor: the values a consumer has to dereference are
// identifiers rather than labels. Licence as a URL or SPDX id, a resolvable
// dataset URL, and every declared file carrying a contentUrl, a media type, and a
// real checksum. The all-zero sha256 is the template placeholder, so it counts as
// ungrounded — it parses, validates, and tells a consumer nothing.
function groundedCroissant(desc) {
  const gaps = [];
  const text = (v) => (typeof v === 'string' ? v.trim() : '');

  if (!text(desc.license)) gaps.push('no license');
  if (!text(desc.url)) gaps.push('no dataset url');
  else if (!isWellFormedUri(desc.url).ok) gaps.push('dataset url is not a resolvable URI');

  const distribution = Array.isArray(desc.distribution) ? desc.distribution : [];
  if (distribution.length === 0) {
    gaps.push('no files declared, so nothing to ground');
  } else {
    for (const d of distribution) {
      const id = text(d?.['@id']) || '(no id)';
      if (!isWellFormedUri(text(d?.contentUrl)).ok) gaps.push(`${id} has no resolvable contentUrl`);
      if (!text(d?.encodingFormat)) gaps.push(`${id} declares no media type`);
      const sha = text(d?.sha256);
      if (!sha) gaps.push(`${id} has no sha256`);
      else if (/^0+$/.test(sha)) gaps.push(`${id} sha256 is still the placeholder`);
    }
  }

  return gaps.length === 0
    ? pass('Licence, dataset URL, file URLs, media types, and checksums are all resolvable values.')
    : fail(`${count(gaps.length, 'ungrounded value')}: ${gaps.slice(0, 3).join('; ')}.`);
}

// --- PROV-O ----------------------------------------------------------------
// `result` is the validateProvo() return. `opts.shacl` is the asynchronous SHACL
// report ({conforms, results}) when the user has run Deep validate; without it the
// referential rung reports the synchronous internal-reference check and says the
// authoritative SHACL pass has not been run.
const PROV_LINKS = [
  'prov:wasGeneratedBy',
  'prov:used',
  'prov:wasDerivedFrom',
  'prov:wasAssociatedWith',
  'prov:wasAttributedTo',
];

const hasType = (n, t) => n?.['@type'] === t || (Array.isArray(n?.['@type']) && n['@type'].includes(t));

// Every @id a node's PROV link properties point at, flattened over the single-node
// and array forms JSON-LD allows.
function linkTargets(node) {
  const out = [];
  for (const key of PROV_LINKS) {
    const v = node?.[key];
    if (!v) continue;
    for (const ref of Array.isArray(v) ? v : [v]) {
      const id = typeof ref === 'string' ? ref : ref?.['@id'];
      if (id) out.push({ key, id });
    }
  }
  return out;
}

export function provoDegrees(desc, result, opts = {}) {
  const degrees = {};
  const isObject = Boolean(desc) && typeof desc === 'object';

  degrees.well_formed = opts.parseError
    ? fail(`Does not parse as JSON: ${opts.parseError}`)
    : isObject
      ? pass('Parses as JSON-LD; expands to RDF on deep validation.')
      : fail('Not a JSON object.');

  // The PROV-O document shape: a prov namespace, a graph, and at least one Entity.
  const structuralErrors = result?.errors ?? [];
  degrees.schema_valid =
    degrees.well_formed.status === 'pass' && structuralErrors.length === 0
      ? pass('PROV @context, @graph, and at least one prov:Entity present.')
      : fail(
          structuralErrors[0] ??
            (degrees.well_formed.status === 'pass'
              ? 'PROV-O document shape is incomplete.'
              : 'Not assessed — the record does not parse.'),
        );

  degrees.referentially_sound =
    degrees.schema_valid.status === 'pass'
      ? soundProvo(desc, opts.shacl)
      : fail('Not assessed — the record is not schema-valid.');

  degrees.grounded =
    degrees.referentially_sound.status === 'pass'
      ? groundedProvo(desc)
      : fail('Not assessed — the record is not referentially sound.');

  degrees.executable = outOfScope(EXECUTABLE_NOTE);
  return withAttained(degrees);
}

// Internal references first — every wasGeneratedBy / used / wasDerivedFrom /
// wasAssociatedWith target must exist as a node in the graph, which is the RDF
// equivalent of Croissant's field-source check. Then SHACL, when it has been run:
// the shapes assert what presence checks cannot, so a conforming report upgrades
// the message and a non-conforming one fails the rung outright.
function soundProvo(desc, shacl) {
  const nodes = Array.isArray(desc['@graph']) ? desc['@graph'] : [];
  const ids = new Set(nodes.map((n) => n?.['@id']).filter(Boolean));
  const dangling = [];
  for (const node of nodes) {
    for (const { key, id } of linkTargets(node)) {
      if (!ids.has(id)) dangling.push(`${node['@id'] ?? '(no id)'} ${key} → ${id}`);
    }
  }

  if (dangling.length > 0) {
    return fail(
      `${count(dangling.length, 'dangling reference')}: ${dangling.slice(0, 3).join('; ')}.`,
    );
  }

  if (shacl?.conforms === false) {
    const first = shacl.results?.[0]?.message;
    return fail(
      `SHACL: ${count(shacl.results?.length ?? 0, 'violation')}${first ? ` — ${first}` : ''}`,
    );
  }
  if (shacl?.conforms === true) {
    return pass('Internal references resolve and the record conforms to the PROV-O profile shapes.');
  }
  return pass(
    'Internal references all resolve. SHACL shape validation has not been run — use Deep validate on the Provenance tab to certify this rung.',
  );
}

// Grounding for a provenance record: the dataset is named by a resolvable
// identifier rather than a local fragment, and the agents responsible are ORCIDs
// or other resolvable ids rather than role labels. A record whose nodes are all
// '#dataset' and '#agent/data_steward' is internally consistent and externally
// meaningless.
function groundedProvo(desc) {
  const nodes = Array.isArray(desc['@graph']) ? desc['@graph'] : [];
  const gaps = [];

  const entities = nodes.filter((n) => hasType(n, 'prov:Entity'));
  const resolvableEntity = (n) => {
    const id = String(n?.['@id'] ?? '');
    return isWellFormedUri(id).ok || isDoi(id).ok;
  };
  if (entities.length > 0 && !entities.some(resolvableEntity)) {
    gaps.push('no entity is identified by a resolvable URI or DOI (only local #fragments)');
  }

  const agents = nodes.filter((n) => hasType(n, 'prov:Agent'));
  if (agents.length === 0) {
    gaps.push('no prov:Agent, so responsibility is unattributed');
  } else {
    const grounded = agents.filter((n) => {
      const id = String(n?.['@id'] ?? '');
      return isOrcid(id).ok || isOrcid(n?.orcid).ok || isWellFormedUri(id).ok;
    });
    if (grounded.length === 0) {
      gaps.push('no agent carries an ORCID or other resolvable identifier');
    }
  }

  return gaps.length === 0
    ? pass('Entities and agents are named by resolvable identifiers.')
    : fail(`${count(gaps.length, 'ungrounded value')}: ${gaps.join('; ')}.`);
}

// --- both artifacts, for the conformance report ----------------------------
// opts: { croissant, croissantResult, provo, provoResult, shacl, parseErrors }
export function artifactDegrees(opts = {}) {
  return {
    croissant: croissantDegrees(opts.croissant, opts.croissantResult, {
      parseError: opts.parseErrors?.croissant,
    }),
    provo: provoDegrees(opts.provo, opts.provoResult, {
      shacl: opts.shacl,
      parseError: opts.parseErrors?.provo,
    }),
  };
}

// --- the level axis and the artifact axis, related --------------------------
//
// The paper defines L3 as machine-actionable enough that a workflow engine, an AutoML
// system, or an instrumented laboratory can ingest the dataset and traverse its lineage
// unattended. That is the same property the ladder above measures, seen from the level
// axis instead of the artifact axis — so a descriptor stuck at schema-valid cannot
// support a Computability L3 claim, however the criteria are answered.
//
// The correspondence itself lives in guidance.json (`degrees.supports`), because which
// rung a level needs is a statement about the framework and not about this code.

const DEGREE_RANK = new Map(DEGREE_IDS.map((id, i) => [id, i]));

// Does an artifact's ladder reach at least `min`? 'out-of-scope' does not count as
// reached: executable is never certified here, so a rung requiring it would never pass.
export const reachesDegree = (degrees, min) => {
  const target = DEGREE_RANK.get(min);
  if (target === undefined) return false;
  for (const id of DEGREE_IDS.slice(0, target + 1)) {
    if (degrees?.[id]?.status !== 'pass') return false;
  }
  return true;
};

// For each declared correspondence, whether the artifact currently supports the claim.
// `ladder` is the artifactDegrees() result: { croissant, provo }.
//
// `pathway` bounds the answer to the levels that pathway targets. Every declared
// correspondence is currently L3, so a Pathway-A record was being told it fails four
// requirements it never took on — a false negative about a target the depositor did
// not set. Omitting the argument keeps the unbounded behaviour, which is what a caller
// asking "what would this artifact support" wants.
export function levelSupport(ladder = {}, pathway) {
  return (guidance.degrees.supports ?? [])
    .filter((entry) => isLevelInScope(entry.level, pathway))
    .map((entry) => {
      const degrees = ladder[entry.artifact];
      const required = getDegree(entry.min_degree);
      const attained = degrees?.attained ?? null;
      const ok = reachesDegree(degrees, entry.min_degree);
      return {
        ...entry,
        requiredLabel: required?.label ?? entry.min_degree,
        attained,
        attainedLabel: attained ? (getDegree(attained)?.label ?? attained) : null,
        ok,
        message: ok
          ? `The ${entry.artifact === 'provo' ? 'provenance record' : 'descriptor'} reaches ${
              getDegree(attained)?.label ?? attained
            }, which supports ${entry.dimension} ${entry.level}.`
          : `${entry.dimension} ${entry.level} needs the ${
              entry.artifact === 'provo' ? 'provenance record' : 'descriptor'
            } at ${required?.label ?? entry.min_degree}; it reaches ${
              attained ? (getDegree(attained)?.label ?? attained) : 'nothing yet'
            }.`,
      };
    });
}

// The subset blocking a level claim, for the places that only surface problems.
export const unsupportedLevels = (ladder = {}, pathway) =>
  levelSupport(ladder, pathway).filter((e) => !e.ok);
