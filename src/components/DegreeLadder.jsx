// The actionability ladder for one artifact: five rungs, each with the check that
// certifies it. Rendered as a row so the distance between "it parses" and "a tool
// can act on it" is visible at a glance — the point of the ladder. `executable` is
// always out-of-scope here, and is shown greyed rather than hidden, because a
// reader needs to know it was not checked rather than assume it passed.
//
// Lives in its own module because verification is being separated from authoring:
// the ladder is the conformance view of an artifact, not the editing view of it.

import { DEGREES, getDegree } from '../lib/actionability.js';

const DEGREE_TONE = {
  pass: 'border-ok-line bg-ok-bg text-ok',
  fail: 'border-warn-line bg-warn-bg text-warn',
  'out-of-scope': 'border-dashed border-line bg-surface-2 text-faint',
};
const DEGREE_MARK = { pass: '✓', fail: '×', 'out-of-scope': '–' };

export default function DegreeLadder({ degrees, artifact, supports }) {
  const attained = degrees.attained ? getDegree(degrees.attained)?.label : null;
  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">
          Machine-actionability
        </span>
        <span className="text-xs text-muted">
          {attained ? (
            <>
              {artifact} reaches <span className="font-medium text-ink">{attained}</span>
            </>
          ) : (
            <span className="text-warn">{artifact} is not yet well-formed</span>
          )}
        </span>
      </div>
      <ol className="mt-2 flex flex-wrap gap-1.5">
        {DEGREES.map((d) => {
          const r = degrees[d.id];
          return (
            <li
              key={d.id}
              title={`${d.check} — ${r.message}`}
              className={`border px-2 py-1 text-[0.7rem] ${DEGREE_TONE[r.status]}`}
            >
              <span aria-hidden="true">{DEGREE_MARK[r.status]}</span> {d.label}
            </li>
          );
        })}
      </ol>
      <ul className="mt-2 space-y-0.5 text-xs text-muted">
        {DEGREES.filter((d) => degrees[d.id].status !== 'pass').map((d) => (
          <li key={d.id}>
            <span className="font-medium text-ink">{d.label}:</span> {degrees[d.id].message}
          </li>
        ))}
      </ul>

      {/* What the rung means for the assessment. The level axis and the artifact axis
          measure the same property — whether a machine can consume this unattended — so
          a descriptor short of Grounded bounds what Computability can claim however the
          criteria are answered. Stating it here is the point of failure. */}
      {supports?.length > 0 && (
        <ul className="mt-2 space-y-0.5 border-t border-line pt-2 text-xs">
          {supports.map((e) => (
            <li key={`${e.dimension}-${e.level}`} className={e.ok ? 'text-ok' : 'text-warn'}>
              <span aria-hidden="true">{e.ok ? '✓' : '×'}</span>{' '}
              <span className="font-medium">{e.dimension} {e.level}</span>{' '}
              <span className="text-muted">{e.ok ? 'supported' : e.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
