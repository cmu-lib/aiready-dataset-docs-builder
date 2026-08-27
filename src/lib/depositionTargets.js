// Deposition-target options for any criterion declaring
// `vocabulary_scope: "deposition_targets"` (today: fairness.l3.deposition_target).
//
// That criterion carries a static `vocabulary_key` of repositories_l3_general,
// which is wrong for every Pathway-C sub-domain that deposits elsewhere — a
// materials record was being offered PhysioNet, dbGaP, and ICPSR. The pathway and
// each sub-domain already declare `deposition_targets_vocabulary` (and some a
// `deposition_targets_filter`) in pathways.json; until now nothing read them.
//
// Resolution, most specific first:
//   * a sub-domain is set -> the sub-domain's vocabulary (at any pathway: where a
//                            discipline deposits does not depend on the level)
//   * otherwise           -> the pathway's vocabulary
//   * neither declared            -> the criterion's own key
//
// `deposition_targets_filter` names the targets recommended for a sub-domain. Its
// ids are not necessarily inside the resolved vocabulary (clinical's filter names
// PhysioNet, which lives in repositories_l3_general while its vocabulary is
// repositories_l3_bridge2ai), so the filter is treated as *widen and prioritise*,
// never as a subset: missing ids are pulled in from any repositories_* vocabulary
// and recommended entries sort first. Dropping options a researcher legitimately
// needs would be worse than showing a few extra.

import vocabularies from '../schema/vocabularies.json';
import { getPathway, getSubDomain } from './pathway.js';

const valuesOf = (key) => vocabularies.vocabularies[key]?.values ?? [];

const REPOSITORY_VOCABULARIES = Object.keys(vocabularies.vocabularies).filter((k) =>
  k.startsWith('repositories_'),
);

// Find a repository entry by id across every repositories_* vocabulary.
const findRepository = (id) => {
  for (const key of REPOSITORY_VOCABULARIES) {
    const hit = valuesOf(key).find((v) => v.id === id);
    if (hit) return hit;
  }
  return null;
};

// Returns { key, values, recommended } — `key` is the resolved vocabulary (for
// reporting), `values` the ordered option list, `recommended` the subset to mark.
export function depositionTargets(criterion, pathway, subDomain) {
  const sub = subDomain ? getSubDomain(subDomain) : null;
  const key =
    sub?.deposition_targets_vocabulary ??
    getPathway(pathway)?.deposition_targets_vocabulary ??
    criterion?.vocabulary_key;

  const filter = sub?.deposition_targets_filter ?? [];
  const values = [...valuesOf(key)];
  const present = new Set(values.map((v) => v.id));

  for (const id of filter) {
    if (present.has(id)) continue;
    const hit = findRepository(id);
    if (hit) {
      values.push(hit);
      present.add(id);
    }
  }

  const isRecommended = (v) => filter.includes(v.id);
  return {
    key,
    // Recommended first; original vocabulary order preserved within each group.
    values: [...values.filter(isRecommended), ...values.filter((v) => !isRecommended(v))],
    recommended: filter.filter((id) => present.has(id)),
  };
}
