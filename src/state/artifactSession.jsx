// Working state for the release bundle that is derived rather than declared, and
// therefore deliberately not persisted.
//
// Authoring, verification, and delivery used to be one page, so this state could
// live in its `useState` calls. Split across /documents, /conformance, and
// /download it has to outlive a route change — a SHACL report run on the
// conformance page is what stops the report downloaded on the next page from
// recording the referential rung as uncertified.
//
// Nothing here goes to localStorage. The assessment record is the durable thing;
// these are products of it, and a SHACL verdict surviving a reload would assert a
// check that did not run in this session.

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { validateProvoShacl } from '../lib/shacl.js';

const ArtifactSessionContext = createContext(null);

// A generated document the user has taken over by hand. `null` means "still
// generated", the same convention `state.croissant` and `state.provo` use for
// their raw overrides: an edit takes the document over, Regenerate hands it back.
// Holding the text unconditionally would freeze it at whatever the answers said
// when the provider mounted, which on a fresh load is nothing at all.
const EMPTY_DRAFTS = { datasheet: null, todo: null };

// Fingerprint of the document a SHACL report was computed from. Editing the
// provenance record after a passing run must not leave a conforming verdict
// attached to a document that has since changed — the report would claim a check
// that never saw this graph.
const fingerprint = (doc) => {
  try {
    return JSON.stringify(doc);
  } catch {
    return null;
  }
};

export function ArtifactSessionProvider({ children }) {
  const [drafts, setDrafts] = useState(EMPTY_DRAFTS);
  const [rdfFormat, setRdfFormat] = useState('jsonld');
  const [shaclState, setShaclState] = useState(null);

  const setDraft = useCallback(
    (key, text) => setDrafts((d) => ({ ...d, [key]: text })),
    [],
  );
  const clearDraft = useCallback((key) => setDrafts((d) => ({ ...d, [key]: null })), []);

  // Called alongside the record's own RESET. Without it a new documentation would
  // inherit the previous dataset's hand-edited datasheet and a SHACL verdict for a
  // provenance record that no longer exists.
  const resetSession = useCallback(() => {
    setDrafts(EMPTY_DRAFTS);
    setShaclState(null);
  }, []);

  // Runs the shape validation and stamps the result with the document it saw.
  const runDeepValidate = useCallback(async (provoDoc) => {
    const forDoc = fingerprint(provoDoc);
    setShaclState({ loading: true, forDoc });
    try {
      setShaclState({ loading: false, forDoc, ...(await validateProvoShacl(provoDoc)) });
    } catch (e) {
      setShaclState({ loading: false, forDoc, error: e.message });
    }
  }, []);

  // The report for a document, or null when none has been run against *this*
  // version of it. Callers therefore cannot accidentally read a stale verdict.
  const shaclFor = useCallback(
    (provoDoc) =>
      shaclState && shaclState.forDoc === fingerprint(provoDoc) ? shaclState : null,
    [shaclState],
  );

  // Whether a verdict exists for an older version of the record, so the
  // conformance page can say the record changed rather than silently reverting to
  // "not run".
  const shaclIsStale = useCallback(
    (provoDoc) => Boolean(shaclState) && shaclState.forDoc !== fingerprint(provoDoc),
    [shaclState],
  );

  const value = useMemo(
    () => ({
      drafts,
      setDraft,
      clearDraft,
      resetSession,
      rdfFormat,
      setRdfFormat,
      shaclFor,
      shaclIsStale,
      runDeepValidate,
    }),
    [
      drafts,
      setDraft,
      clearDraft,
      resetSession,
      rdfFormat,
      shaclFor,
      shaclIsStale,
      runDeepValidate,
    ],
  );

  return (
    <ArtifactSessionContext.Provider value={value}>{children}</ArtifactSessionContext.Provider>
  );
}

export function useArtifactSession() {
  const ctx = useContext(ArtifactSessionContext);
  if (!ctx) throw new Error('useArtifactSession must be used within an ArtifactSessionProvider');
  return ctx;
}

// The report in the shape the generators expect: present only once a run has
// completed cleanly against the current document, absent otherwise. Both
// buildConformanceReport and buildTodo treat `undefined` as "not certified", which
// is the correct reading of both "never run" and "run against an older draft".
export const usableShacl = (report) =>
  report && !report.loading && !report.error ? report : undefined;
