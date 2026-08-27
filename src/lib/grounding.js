// PID and format grounding checks — the "offline-grounded" layer. Pure, no
// network: identifiers are checked for well-formedness (syntax, and checksums
// where a scheme defines one), and licenses/formats for membership in the
// bundled controlled vocabularies. Each predicate returns { ok, message } so
// callers can surface the reason a value failed.

import vocabularies from '../schema/vocabularies.json';

const ok = (message = 'ok') => ({ ok: true, message });
const bad = (message) => ({ ok: false, message });
const str = (v) => (v === null || v === undefined ? '' : String(v).trim());

// DOI: 10.<registrant>/<suffix> (accepts a doi.org URL form too).
export const isDoi = (value) => {
  const v = str(value).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  return /^10\.\d{4,9}\/\S+$/.test(v) ? ok('DOI') : bad('Not a DOI (expected 10.NNNN/suffix).');
};

// ARK: ark:/<naan>/<name>
export const isArk = (value) =>
  /^ark:\/\d{5,9}\/\S+$/.test(str(value)) ? ok('ARK') : bad('Not an ARK (expected ark:/NNNNN/name).');

// Persistent identifier accepts a DOI or an ARK.
export const isPersistentId = (value) => {
  const doi = isDoi(value);
  if (doi.ok) return doi;
  const ark = isArk(value);
  if (ark.ok) return ark;
  return bad('Not a recognised persistent identifier (DOI or ARK).');
};

// ORCID: 0000-0000-0000-000X, validated with the ISO 7064 MOD 11-2 checksum.
export const isOrcid = (value) => {
  const v = str(value).replace(/^https?:\/\/orcid\.org\//i, '');
  if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(v)) return bad('Not an ORCID (0000-0000-0000-000X).');
  const digits = v.replace(/-/g, '');
  let total = 0;
  for (let i = 0; i < 15; i += 1) total = (total + Number(digits[i])) * 2;
  const check = (12 - (total % 11)) % 11;
  const expected = check === 10 ? 'X' : String(check);
  return digits[15] === expected ? ok() : bad('ORCID checksum failed.');
};

// ROR: https://ror.org/0<6 Crockford-base32 chars><2 digits>. Syntax check
// (the mod-97 checksum is not validated offline here).
export const isRor = (value) =>
  /^https:\/\/ror\.org\/0[0-9a-hj-km-np-tv-z]{6}\d{2}$/.test(str(value))
    ? ok()
    : bad('Not a ROR id (https://ror.org/0XXXXXXXX).');

// Some criteria are explicitly conditional — "if applicable; mark N/A otherwise".
// An automated check on one of those has to accept the declared non-applicability,
// or it fails every dataset the criterion was never aimed at. Accepted spellings are
// deliberately narrow: a bare "no" or an empty box is an unanswered question, not a
// statement that the criterion does not apply.
const NOT_APPLICABLE = /^(n\/?a|not applicable|none|not required)$/i;
export const isNotApplicable = (value) => NOT_APPLICABLE.test(str(value));

// dbGaP study accession: phs###### with optional version and participant-set
// suffixes (phs000001.v3.p1). Studies are registered before they are versioned, so
// the suffixes stay optional.
export const isDbGaPAccession = (value) => {
  const v = str(value);
  if (isNotApplicable(v)) return ok('Declared not applicable.');
  return /^phs\d{6}(\.v\d+)?(\.p\d+)?$/i.test(v)
    ? ok('dbGaP accession')
    : bad('Not a dbGaP accession (expected phs000000, optionally .v1.p1), and not marked N/A.');
};

// License: value must be a recognised id in the bundled licenses vocabulary
// (SPDX-style ids: CC-BY-4.0, CC0-1.0, MIT, Apache-2.0, ODbL-1.0, …).
const LICENSE_IDS = new Set((vocabularies.vocabularies.licenses?.values ?? []).map((v) => v.id));
export const isSpdxLicense = (value) =>
  LICENSE_IDS.has(str(value)) ? ok() : bad('Not a recognised SPDX/CC license id.');

// Open format: value ∈ any bundled open-format vocabulary (tabular/array/imaging).
const OPEN_FORMAT_IDS = new Set(
  ['formats_tabular', 'formats_array', 'formats_imaging'].flatMap((k) =>
    (vocabularies.vocabularies[k]?.values ?? []).map((v) => v.id),
  ),
);
export const isOpenFormat = (value) =>
  OPEN_FORMAT_IDS.has(str(value)) ? ok() : bad('Not a recognised open format.');

// Absolute, well-formed URI.
export const isWellFormedUri = (value) => {
  try {
    const u = new URL(str(value));
    return u.protocol ? ok() : bad('Not an absolute URI.');
  } catch {
    return bad('Not a well-formed URI.');
  }
};
