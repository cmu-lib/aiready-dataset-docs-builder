// Unit tests for the lifecycle stage lock logic. Run with:  npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';

import { lockedStages, isLocked, isActionable, upcomingStages, isUpcoming } from '../src/lib/stages.js';

const crit = (lifecycle_stage) => ({ id: 'x', lifecycle_stage });

test('lockedStages: plan locks nothing, prepare locks acquisition, upgrade locks acquisition+curation', () => {
  assert.deepEqual([...lockedStages('plan')], []);
  assert.deepEqual([...lockedStages('prepare')].sort(), ['acquisition']);
  assert.deepEqual([...lockedStages('upgrade')].sort(), ['acquisition', 'curation']);
  assert.deepEqual([...lockedStages(null)], []); // unset behaves like plan
});

test('isLocked / isActionable follow the stage', () => {
  // Plan: nothing locked.
  assert.equal(isLocked(crit('acquisition'), 'plan'), false);

  // Prepare: acquisition locked, curation still actionable.
  assert.equal(isLocked(crit('acquisition'), 'prepare'), true);
  assert.equal(isLocked(crit('curation'), 'prepare'), false);

  // Upgrade: acquisition + curation locked.
  assert.equal(isLocked(crit('acquisition'), 'upgrade'), true);
  assert.equal(isLocked(crit('curation'), 'upgrade'), true);

  // Documentation and governance are never locked.
  assert.equal(isLocked(crit('documentation'), 'upgrade'), false);
  assert.equal(isLocked(crit('governance'), 'upgrade'), false);

  // isActionable is the inverse.
  assert.equal(isActionable(crit('curation'), 'upgrade'), false);
  assert.equal(isActionable(crit('documentation'), 'upgrade'), true);
});

test('upcomingStages: Plan defers all non-acquisition; Prepare defers release-time only', () => {
  assert.deepEqual(
    [...upcomingStages('plan')].sort(),
    ['curation', 'documentation', 'governance', 'release'],
  );
  assert.deepEqual([...upcomingStages('prepare')], ['release']);
  assert.deepEqual([...upcomingStages('upgrade')], []);

  assert.equal(isUpcoming(crit('acquisition'), 'plan'), false); // active in Plan
  assert.equal(isUpcoming(crit('release'), 'plan'), true); // a DOI — deferred
  // Prepare: documentation (Croissant/datasheet) is active, but release (DOI) is deferred.
  assert.equal(isUpcoming(crit('documentation'), 'prepare'), false);
  assert.equal(isUpcoming(crit('release'), 'prepare'), true);
  // Upgrade: the DOI exists, so release is active (not upcoming).
  assert.equal(isUpcoming(crit('release'), 'upgrade'), false);
});
