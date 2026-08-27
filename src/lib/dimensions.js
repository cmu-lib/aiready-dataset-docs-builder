// Dimension helpers. The seven dimensions are read from the matrix schema so
// the schema stays the single source of truth (never hard-coded here).

import matrix from '../schema/matrix.json';

export const DIMENSIONS = matrix.dimensions;
export const LEVELS = matrix.levels; // [{ id, name, drl_band }]

// "Pre-model Explainability" -> "pre-model-explainability"
export const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const BY_SLUG = new Map(DIMENSIONS.map((d) => [slugify(d), d]));

export const dimensionSlug = (dimension) => slugify(dimension);
export const dimensionBySlug = (slug) => BY_SLUG.get(slug) ?? null;
