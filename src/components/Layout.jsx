// App shell: branded masthead (CMU University Libraries), top navigation, the
// routed outlet, a "Developed by" TRDA footer, and a light/dark theme toggle.

import { useEffect, useState } from 'react';
import { NavLink, Link, Outlet } from 'react-router-dom';
import { useAssessment } from '../state/assessment.jsx';
import cmuDarkgray from '../assets/cmu-ul-darkgray.png';
import cmuWhite from '../assets/cmu-ul-white.png';
import trdaLogo from '../assets/trda.png';

const THEME_KEY = 'ai-readiness-theme';

const systemTheme = () =>
  window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

// Theme override: null = follow the OS; otherwise 'light' | 'dark' stamped on <html>.
function useThemeToggle() {
  const [override, setOverride] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    try {
      if (override) {
        root.setAttribute('data-theme', override);
        localStorage.setItem(THEME_KEY, override);
      } else {
        root.removeAttribute('data-theme');
        localStorage.removeItem(THEME_KEY);
      }
    } catch {
      if (override) root.setAttribute('data-theme', override);
    }
  }, [override]);

  const effective = override ?? systemTheme();
  const toggle = () => setOverride(effective === 'dark' ? 'light' : 'dark');
  return { effective, toggle };
}

const linkClass = ({ isActive }) =>
  `px-3 py-1.5 rounded-none text-sm transition-colors ${
    isActive ? 'bg-brand-btn text-surface' : 'text-muted hover:bg-surface-2'
  }`;

// The collection guide is not a wizard step: it is read before and alongside the
// assessment rather than as one of its stages. It carries the guidance action
// colour so the nav says so, matching its download and print buttons.
const guideLinkClass = ({ isActive }) =>
  `px-3 py-1.5 rounded-none text-sm transition-colors ${
    isActive ? 'bg-guide-btn text-guide-btn-fg' : 'text-guide-btn hover:bg-info-bg'
  }`;

// Transparent logo, sits directly on the page background (no plaque).
function Logo({ src, alt, imgClass }) {
  return <img src={src} alt={alt} className={`block w-auto ${imgClass}`} />;
}

export default function Layout() {
  const { effective, toggle } = useThemeToggle();
  const { state } = useAssessment();
  const showConformance = state.pathway === 'B' || state.pathway === 'C';

  return (
    <div className="min-h-screen bg-ground text-ink">
      <div className="h-[3px] bg-accent" />

      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-none bg-accent text-white" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12.5l5 5L20 6" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">AI-Readiness Assessment</h1>
              <p className="text-xs text-muted">Making research data machine-learning-ready: tiered self-assessment and documentation builder</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Logo
              src={effective === 'dark' ? cmuWhite : cmuDarkgray}
              alt="Carnegie Mellon University Libraries"
              imgClass="h-20"
            />
            <button
              type="button"
              onClick={toggle}
              className="rounded-none border border-line px-3 py-1.5 text-xs text-ink hover:border-muted"
              aria-label={`Switch to ${effective === 'dark' ? 'light' : 'dark'} theme`}
            >
              {effective === 'dark' ? '☀ Light' : '☾ Dark'}
            </button>
          </div>
        </div>

        <nav className="mx-auto flex max-w-4xl flex-wrap gap-1 px-6 pb-3">
          <NavLink to="/" end className={linkClass}>
            Start
          </NavLink>
          <NavLink to="/audience" className={linkClass}>
            Audience
          </NavLink>
          <NavLink to="/review" className={linkClass}>
            Review
          </NavLink>
          <NavLink to="/documents" className={linkClass}>
            Documents
          </NavLink>
          {/* Conformance states how far up the machine-actionability ladder the
              released artifacts reach — a position the framework asks for from L2
              upward. At Pathway A it is not a step the depositor skipped; it is not
              a step they have. */}
          {showConformance && (
            <NavLink to="/conformance" className={linkClass}>
              Conformance
            </NavLink>
          )}
          <NavLink to="/download" className={linkClass}>
            Download
          </NavLink>
          <NavLink to="/guide" className={guideLinkClass}>
            Research data collection guide
          </NavLink>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-6 py-8">
          <div className="flex items-center gap-3">
            <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">
              Developed by
            </span>
            <Logo src={trdaLogo} alt="Tartan Research Data Alliance" imgClass="h-24" />
          </div>
          <div className="max-w-sm text-xs text-faint">
            <p>
              Proof-of-concept prototype (v0.1.0, pre-release) for the AI-readiness framework — a
              work in progress, not a finished release. Runs entirely in your browser; nothing is
              uploaded.
            </p>
            <p className="mt-1">
              <Link to="/examples" className="text-link underline">Examples</Link>
              {' · '}
              <Link to="/validators" className="text-link underline">Validators</Link>
              {' · '}
              <Link to="/references" className="text-link underline">References &amp; sources</Link>
            </p>
            <p className="mt-2">
              <a
                href="https://forms.gle/wSQoMUJxUMqZGoon6"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-none bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              >
                Share feedback →
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
