// Croissant builder — the file list and column list the assessment cannot
// collect. generateCroissant composes `distribution` and `recordSet` from this
// model, so what the builder produces always passes the structural and
// referential checks: no hand-written JSON-LD, and no dangling references.
//
// Sibling of ProvenanceBuilder, and deliberately the same shape: a whole-model
// dispatch, an add/update/remove trio per collection, a schematic strip, and a
// "how to fill this in" box. The one structural guarantee worth noting is the
// field's file picker — it offers only declared files, so `source.fileObject`
// cannot point at something that does not exist.

import { useState } from 'react';
import vocabularies from '../schema/vocabularies.json';
import { useAssessment } from '../state/assessment.jsx';
import {
  nextRowId,
  seedTemplateRows,
  encodingFormatOptions,
  suggestedFormat,
} from '../generators/croissant.js';

const DATA_TYPES = vocabularies.vocabularies.croissant_datatypes?.values ?? [];
const FORMATS = encodingFormatOptions();
const CUSTOM = '__custom__';

const inputClass = 'rounded-none border border-line px-2 py-1 text-sm';
const smallInputClass = 'rounded-none border border-line px-2 py-1 text-xs';

export default function CroissantBuilder() {
  const { state, dispatch } = useAssessment();
  const model = state.croissant_model ?? { files: [], recordSets: [] };
  const set = (next) => dispatch({ type: 'SET_CROISSANT_MODEL', croissant_model: next });

  const files = model.files ?? [];
  const recordSets = model.recordSets ?? [];
  const empty = files.length === 0 && recordSets.length === 0;

  // Two files sharing a name would collide as Croissant @ids. The generator
  // suffixes them so the descriptor stays valid; flag it here so the user can fix
  // the cause rather than discover `data.csv-2` in the output.
  const names = files.map((f) => (f.name ?? '').trim()).filter(Boolean);
  const duplicated = new Set(names.filter((n, i) => names.indexOf(n) !== i));

  const addFile = () =>
    set({
      ...model,
      files: [
        ...files,
        {
          id: nextRowId('file', files.map((f) => f.id)),
          name: '',
          contentUrl: '',
          encodingFormat: suggestedFormat(state).mime,
          sha256: '',
        },
      ],
    });
  const updateFile = (id, patch) =>
    set({ ...model, files: files.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
  const removeFile = (id) => set({ ...model, files: files.filter((f) => f.id !== id) });

  const addRecordSet = () =>
    set({
      ...model,
      recordSets: [
        ...recordSets,
        { id: nextRowId('recordset', recordSets.map((r) => r.id)), name: '', fields: [] },
      ],
    });
  const updateRecordSet = (id, patch) =>
    set({ ...model, recordSets: recordSets.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const removeRecordSet = (id) =>
    set({ ...model, recordSets: recordSets.filter((r) => r.id !== id) });

  const allFieldIds = recordSets.flatMap((r) => (r.fields ?? []).map((f) => f.id));
  const addField = (rs) =>
    updateRecordSet(rs.id, {
      fields: [
        ...(rs.fields ?? []),
        {
          id: nextRowId('field', allFieldIds),
          name: '',
          dataType: 'sc:Text',
          fileId: files[0]?.id ?? '',
          column: '',
        },
      ],
    });
  const updateField = (rs, fieldId, patch) =>
    updateRecordSet(rs.id, {
      fields: (rs.fields ?? []).map((f) => (f.id === fieldId ? { ...f, ...patch } : f)),
    });
  const removeField = (rs, fieldId) =>
    updateRecordSet(rs.id, { fields: (rs.fields ?? []).filter((f) => f.id !== fieldId) });

  return (
    <div className="mt-4 rounded-none border border-line bg-surface p-4">
      <h3 className="text-sm font-semibold">Build the descriptor (files and columns)</h3>
      <p className="mt-1 text-xs text-muted">
        Everything else in croissant.json comes from your answers. These two lists do not: they
        describe the files you are shipping and the columns inside them, and they are what makes the
        dataset <span className="font-medium text-ink">directly loadable</span> by an ML framework.
      </p>

      {/* Croissant schematic: what the two lists map to */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="border border-line bg-surface-2 px-2 py-1">
          File <span className="text-faint">· cr:FileObject</span>
        </span>
        <span className="text-faint">—source→</span>
        <span className="border border-ok-line bg-ok-bg px-2 py-1 text-ok">
          Column <span className="opacity-70">· cr:Field</span>
        </span>
        <span className="text-faint">grouped in</span>
        <span className="border border-info-line bg-info-bg px-2 py-1 text-info">
          Record set <span className="opacity-70">· cr:RecordSet</span>
        </span>
      </div>

      <div className="mt-3 border border-info-line bg-info-bg p-3 text-xs text-muted">
        <p className="font-semibold text-info">How to fill this in</p>
        <ul className="mt-1 list-inside list-disc space-y-1">
          <li>
            <span className="font-medium text-ink">Files</span> — one per file you are depositing.
            The URL is where it resolves once published; the checksum is optional but lets a
            consumer verify they got the bytes you released.
          </li>
          <li>
            <span className="font-medium text-ink">Record sets</span> — one per table or collection.
            A single tabular dataset usually needs exactly one.
          </li>
          <li>
            <span className="font-medium text-ink">Columns</span> — one per variable a consumer will
            read. Pick which file it comes from and the column name inside that file; they can
            differ from the name you publish it under.
          </li>
          <li>
            You do not have to list every column to be valid — but a consumer can only load what is
            declared here.
          </li>
        </ul>
      </div>

      {empty && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border border-line bg-surface-2 p-3">
          <p className="text-xs text-muted">
            Nothing declared yet. Start from a template seeded with your declared format, then edit
            it.
          </p>
          <button
            type="button"
            onClick={() => set(seedTemplateRows(model, state))}
            className="rounded-none border border-line px-3 py-1.5 text-xs hover:bg-idle-bg"
          >
            Start from a template
          </button>
        </div>
      )}

      {/* Files */}
      <div className="mt-4">
        <h4 className="text-xs font-semibold text-muted">Files</h4>
        <div className="mt-2 space-y-2">
          {files.map((f) => (
            <div key={f.id} className="rounded-none border border-line p-3">
              <div className="flex items-center gap-2">
                <input
                  value={f.name ?? ''}
                  onChange={(e) => updateFile(f.id, { name: e.target.value })}
                  placeholder="file name (e.g. patterns.cif)"
                  className={`flex-1 font-medium ${inputClass}`}
                />
                <button type="button" onClick={() => removeFile(f.id)} className="text-xs text-bad">
                  remove
                </button>
              </div>
              {duplicated.has((f.name ?? '').trim()) && (
                <p className="mt-1 text-[0.7rem] text-warn">
                  Another file has this name. Both will still export, but with altered identifiers —
                  give them distinct names.
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  value={f.contentUrl ?? ''}
                  onChange={(e) => updateFile(f.id, { contentUrl: e.target.value })}
                  placeholder="URL where the file resolves"
                  className={`min-w-[16rem] flex-1 ${smallInputClass}`}
                />
                <FormatSelect
                  value={f.encodingFormat ?? ''}
                  onValue={(v) => updateFile(f.id, { encodingFormat: v })}
                />
                <input
                  value={f.sha256 ?? ''}
                  onChange={(e) => updateFile(f.id, { sha256: e.target.value })}
                  placeholder="sha256 (optional)"
                  className={`min-w-[12rem] flex-1 ${smallInputClass}`}
                />
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={addFile} className="mt-2 text-xs text-muted underline">
          + Add file
        </button>
      </div>

      {/* Record sets */}
      <div className="mt-4">
        <h4 className="text-xs font-semibold text-muted">Record sets</h4>
        <div className="mt-2 space-y-3">
          {recordSets.map((rs) => (
            <div key={rs.id} className="rounded-none border border-line p-3">
              <div className="flex items-center gap-2">
                <input
                  value={rs.name ?? ''}
                  onChange={(e) => updateRecordSet(rs.id, { name: e.target.value })}
                  placeholder="record set name (e.g. patterns)"
                  className={`flex-1 font-medium ${inputClass}`}
                />
                <button
                  type="button"
                  onClick={() => removeRecordSet(rs.id)}
                  className="text-xs text-bad"
                >
                  remove set
                </button>
              </div>

              <div className="mt-2">
                <span className="text-[0.7rem] font-medium text-muted">Columns</span>
                {files.length === 0 && (
                  <p className="text-[0.7rem] text-faint">
                    Add a file first so columns have somewhere to come from.
                  </p>
                )}
                <div className="mt-1 space-y-1">
                  {(rs.fields ?? []).map((fd) => (
                    <div key={fd.id} className="flex flex-wrap items-center gap-2">
                      <input
                        value={fd.name ?? ''}
                        onChange={(e) => updateField(rs, fd.id, { name: e.target.value })}
                        placeholder="name (e.g. two_theta)"
                        className={`min-w-[10rem] flex-1 ${smallInputClass}`}
                      />
                      <select
                        value={fd.dataType ?? ''}
                        onChange={(e) => updateField(rs, fd.id, { dataType: e.target.value })}
                        className={smallInputClass}
                      >
                        <option value="">— type —</option>
                        {DATA_TYPES.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      {/* Only declared files are offered, so a field can never
                          reference a distribution entry that does not exist. */}
                      <select
                        value={fd.fileId ?? ''}
                        onChange={(e) => updateField(rs, fd.id, { fileId: e.target.value })}
                        className={smallInputClass}
                      >
                        <option value="">— from file —</option>
                        {files.map((f) => (
                          <option key={f.id} value={f.id}>
                            {(f.name ?? '').trim() || f.id}
                          </option>
                        ))}
                      </select>
                      <input
                        value={fd.column ?? ''}
                        onChange={(e) => updateField(rs, fd.id, { column: e.target.value })}
                        placeholder="column in that file"
                        className={`min-w-[10rem] flex-1 ${smallInputClass}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeField(rs, fd.id)}
                        className="text-xs text-bad"
                      >
                        remove
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => addField(rs)}
                  className="mt-1 text-xs text-muted underline"
                >
                  + Add column
                </button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={addRecordSet} className="mt-2 text-xs text-muted underline">
          + Add record set
        </button>
      </div>
    </div>
  );
}

// Media type picker, with the free-text fallback every controlled list in this
// app keeps — the format vocabularies cannot cover every lab's output.
function FormatSelect({ value, onValue }) {
  const known = FORMATS.some((f) => f.mime === value);
  // Local flag, not derived from `value`: choosing "Custom…" clears the value,
  // which would otherwise immediately hide the input the user is about to type in.
  const [custom, setCustom] = useState(Boolean(value) && !known);

  return (
    <span className="flex min-w-[14rem] flex-1 gap-2">
      <select
        value={custom ? CUSTOM : value}
        onChange={(e) => {
          if (e.target.value === CUSTOM) {
            setCustom(true);
            onValue('');
          } else {
            setCustom(false);
            onValue(e.target.value);
          }
        }}
        className={`flex-1 ${smallInputClass}`}
      >
        <option value="">— media type —</option>
        {FORMATS.map((f) => (
          <option key={f.mime} value={f.mime}>
            {f.label}
          </option>
        ))}
        <option value={CUSTOM}>Custom…</option>
      </select>
      {custom && (
        <input
          value={value}
          onChange={(e) => onValue(e.target.value)}
          placeholder="media type"
          className={`flex-1 ${smallInputClass}`}
        />
      )}
    </span>
  );
}
