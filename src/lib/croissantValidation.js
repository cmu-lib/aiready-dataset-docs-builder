// Croissant validation — a sound, offline subset of the reference `mlcroissant`
// checks. "Sound subset" means: hard errors are things mlcroissant would also
// reject, so a descriptor that passes here is never falsely rejected relative to
// mlcroissant. Recommended-but-accepted issues are reported as warnings, not
// errors. Authoritative validation (Pyodide-loaded `mlcroissant`) is deferred.
//
// Implemented in plain JS (no zod/ajv dependency) since the emitted subset is
// small; the { valid, errors, warnings, loadable } interface is stable, so a
// schema library can be swapped in later without changing callers.
//
// Errors are additionally bucketed by the degree of machine-actionability they
// block (see lib/actionability.js and the paper's actionability ladder): a missing
// required property is a *schema* failure, while an @id collision or a field
// source pointing at an undeclared distribution is a *referential* one. `errors`
// keeps every message in discovery order regardless, so existing callers — which
// render the list or take errors[0] — are unaffected.

import { CROISSANT_CONFORMS_TO } from '../generators/croissant.js';

const isNonEmpty = (v) => typeof v === 'string' && v.trim() !== '';

// `opts.expectedMime` (from declaredMime(record)) enables a cross-check between
// the format declared in the assessment and the descriptor's encodingFormat —
// a warning, never an error: the descriptor may legitimately ship a secondary
// format, and the assessment answer may be the stale one.
export function validateCroissant(desc, opts = {}) {
  const errors = [];
  const warnings = [];
  // Parallel views on `errors`, keyed by the ladder degree each message blocks.
  const schemaErrors = [];
  const referenceErrors = [];
  const err = (message, bucket) => {
    errors.push(message);
    bucket.push(message);
  };
  const schema = (m) => err(m, schemaErrors);
  const reference = (m) => err(m, referenceErrors);

  if (!desc || typeof desc !== 'object') {
    return {
      valid: false,
      errors: ['Descriptor is not an object.'],
      warnings: [],
      loadable: false,
      wellFormed: false,
      schemaErrors: [],
      referenceErrors: [],
    };
  }

  // --- hard structural checks (mlcroissant would also fail these) ---
  if (!desc['@context'] || typeof desc['@context'] !== 'object') schema('Missing @context.');
  if (desc['@type'] !== 'sc:Dataset') schema('@type must be "sc:Dataset".');
  if (desc.conformsTo !== CROISSANT_CONFORMS_TO) {
    schema(`conformsTo must be "${CROISSANT_CONFORMS_TO}".`);
  }
  if (!isNonEmpty(desc.name)) schema('name is required and must be non-empty.');

  // --- recommended (warnings, not rejections) ---
  if (!isNonEmpty(desc.description)) warnings.push('description is recommended.');
  if (!isNonEmpty(desc.license)) warnings.push('license is recommended.');
  if (!isNonEmpty(desc.url)) warnings.push('url is recommended.');

  const distribution = Array.isArray(desc.distribution) ? desc.distribution : [];
  const recordSet = Array.isArray(desc.recordSet) ? desc.recordSet : [];
  if (distribution.length === 0) warnings.push('distribution is empty (no files declared).');
  if (recordSet.length === 0) warnings.push('recordSet is empty (no record sets declared).');

  // --- referential integrity (hard) ---
  const ids = [];
  const distIds = new Set();
  for (const d of distribution) {
    if (isNonEmpty(d?.['@id'])) {
      ids.push(d['@id']);
      distIds.add(d['@id']);
    } else {
      schema('A distribution entry is missing @id.');
    }
    if (!isNonEmpty(d?.encodingFormat)) {
      warnings.push(`distribution ${d?.['@id'] ?? '(no id)'} is missing encodingFormat.`);
    }
  }
  for (const rs of recordSet) {
    if (isNonEmpty(rs?.['@id'])) ids.push(rs['@id']);
    else schema('A recordSet entry is missing @id.');
    const fields = Array.isArray(rs?.field) ? rs.field : [];
    if (fields.length === 0) warnings.push(`recordSet ${rs?.['@id'] ?? '(no id)'} has no fields.`);
    for (const f of fields) {
      if (isNonEmpty(f?.['@id'])) ids.push(f['@id']);
      else schema(`A field in recordSet ${rs?.['@id'] ?? '(no id)'} is missing @id.`);
      const srcId = f?.source?.fileObject?.['@id'];
      if (srcId !== undefined && !distIds.has(srcId)) {
        reference(
          `field ${f?.['@id'] ?? '(no id)'} source references undeclared distribution "${srcId}".`,
        );
      }
    }
  }

  const dupes = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  if (dupes.length) reference(`duplicate @id(s): ${dupes.join(', ')}.`);

  // --- consistency with the assessment (warning) ---
  const expectedMime = isNonEmpty(opts.expectedMime) ? opts.expectedMime.trim() : '';
  if (expectedMime) {
    const declared = [...new Set(distribution.map((d) => d?.encodingFormat).filter(isNonEmpty))];
    if (declared.length > 0 && !declared.includes(expectedMime)) {
      warnings.push(
        `no distribution declares encodingFormat "${expectedMime}", the media type of the format declared in the assessment (found: ${declared.join(', ')}).`,
      );
    }
  }

  const valid = errors.length === 0;
  const loadable =
    valid &&
    distribution.length > 0 &&
    recordSet.some((rs) => Array.isArray(rs.field) && rs.field.length > 0);

  return { valid, errors, warnings, loadable, wellFormed: true, schemaErrors, referenceErrors };
}
