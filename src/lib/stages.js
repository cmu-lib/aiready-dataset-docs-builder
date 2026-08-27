// Lifecycle intake — where the user is in the dataset lifecycle (origin), which
// is independent of the pathway (destination/tier). Origin does not change which
// criteria are required; it tailors framing and (in the Medium tier) which
// criteria are still actionable vs. already locked. `suggestedPathway` pre-selects
// a sensible default the user can still change.

export const STAGES = [
  {
    id: 'plan',
    title: 'Starting to collect data',
    question: 'I am planning or starting to collect data.',
    suggestedPathway: null, // let the user choose
  },
  {
    id: 'prepare',
    title: 'Preparing a collected dataset',
    question: 'I have collected data and am preparing it to publish.',
    suggestedPathway: 'B',
  },
  {
    id: 'upgrade',
    title: 'Published dataset',
    question: 'I have a published dataset and want to make it machine-learning-ready.',
    suggestedPathway: 'C',
  },
];

export const getStage = (id) => STAGES.find((s) => s.id === id) ?? null;

// Lifecycle stages that are immutable given the user's starting point. Plan =
// nothing fixed yet; Prepare = data collected (acquisition fixed); Upgrade =
// published (acquisition + curation fixed). Documentation/governance are always
// forward-actionable, so never locked.
export const lockedStages = (stage) => {
  if (stage === 'prepare') return new Set(['acquisition']);
  if (stage === 'upgrade') return new Set(['acquisition', 'curation']);
  return new Set(); // plan (or unknown/unset): nothing locked
};

// A criterion is "locked" when its lifecycle_stage is immutable for the current
// stage — it stays required, but unmet locked criteria are framed as limitations
// to document rather than gaps to fix.
export const isLocked = (criterion, stage) =>
  lockedStages(stage).has(criterion?.lifecycle_stage);

export const isActionable = (criterion, stage) => !isLocked(criterion, stage);

// Lifecycle stages that are not due yet (future) given the starting point. Only
// Plan has upcoming work: while collecting, everything past acquisition is a
// roadmap item, not a current requirement (coarse rule). Prepare/Upgrade have
// nothing upcoming — they are at/after release.
export const upcomingStages = (stage) => {
  if (stage === 'plan') return new Set(['curation', 'documentation', 'governance', 'release']);
  if (stage === 'prepare') return new Set(['release']); // publish-time artifacts (DOI, landing page…) not due until deposit
  return new Set(); // upgrade (or unset): nothing upcoming — already published
};

// "Upcoming" criteria are not required at the current stage and are excluded
// from the verdict; they surface as a plan-for-later roadmap.
export const isUpcoming = (criterion, stage) =>
  upcomingStages(stage).has(criterion?.lifecycle_stage);

