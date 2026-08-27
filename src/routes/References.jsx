// References — the sources the framework, dimensions, tiers, and documentation
// formats are drawn from. Rendered as a numbered reference list with resolvable
// DOI / persistent-identifier links (library-standard for a website).

import citationsData from '../schema/references.json';
import { THIS_WORK } from '../lib/thisWork.js';

const entries = Object.entries(citationsData.citations).sort(
  (a, b) => (a[1].ref ?? 999) - (b[1].ref ?? 999),
);

const linkFor = (c) => (c.doi ? `https://doi.org/${c.doi}` : c.url || null);

export default function References() {
  return (
    <section>
      <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">Sources</span>
      <h2 className="mt-1 text-xl font-semibold">References</h2>
      <p className="mt-2 max-w-[70ch] text-sm text-muted">
        The seven pre-model dimensions, the readiness levels and FAIR criteria, and the
        documentation formats (datasheets, Croissant, PROV-O) implemented in this tool are drawn
        from the following works. Links resolve to the DOI or the canonical page.
      </p>

      <div className="mt-6 border-l-2 border-accent pl-4">
        <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">
          This tool implements
        </span>
        <p className="mt-1 text-sm text-muted">
          <span className="text-ink">{THIS_WORK.authors}</span> ({THIS_WORK.year}).{' '}
          <span className="italic">{THIS_WORK.title}</span> [{THIS_WORK.note}]. {THIS_WORK.publisher}.
        </p>
      </div>

      <h3 className="mt-8 text-sm font-semibold text-muted">Sources the framework draws on</h3>
      <ol className="mt-3 list-decimal space-y-3 pl-6 text-sm marker:text-faint">
        {entries.map(([key, c]) => {
          const href = linkFor(c);
          return (
            <li key={key} id={`ref-${key}`} className="pl-1 text-muted">
              <span className="text-ink">{c.authors}</span> {c.year ? `(${c.year}).` : '(n.d.).'}{' '}
              <span className="italic">{c.title}.</span> {c.venue}.{' '}
              {href && (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-link underline"
                >
                  {c.doi ? `https://doi.org/${c.doi}` : c.url}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
