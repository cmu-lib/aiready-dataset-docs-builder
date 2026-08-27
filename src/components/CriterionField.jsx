// One criterion input. Switches the widget on `evidence_type`, shows the
// `verification` mode (automated / attested / manual), the recommended tag when
// applicable, collapsible guidance, and an optional note / evidence-link field.
//
// Controlled by the parent: `answer` is { value, notes } from state; `onChange`
// receives a partial patch ({ value } or { notes }) that the reducer merges.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import vocabularies from '../schema/vocabularies.json';
import guidance from '../schema/guidance.json';
import { isLocked } from '../lib/stages.js';
import { depositionTargets } from '../lib/depositionTargets.js';
import { validatorsFor, executionNote } from '../lib/validators.js';

// The three modes, their wording, and their definitions come from guidance.json,
// so the chip here, the legend on the dimension page, and the collection guide
// cannot disagree about what "attested" means. The definition rides along as the
// chip's tooltip: the label alone never said what the mode required of the user.
const VERIFICATION_BADGE = Object.fromEntries(
  guidance.verification_modes.modes.map((m) => [
    m.id,
    { label: m.label, cls: m.tone, definition: m.definition },
  ]),
);

const vocabValues = (key) => vocabularies.vocabularies[key]?.values ?? [];

// Option list for a controlled-vocabulary criterion. Most read their static
// `vocabulary_key`; a criterion declaring `vocabulary_scope` resolves its options
// from the pathway / sub-domain instead, so the deposition-target list matches
// where the researcher is actually depositing.
const optionsFor = (criterion, pathway, subDomain) =>
  criterion.vocabulary_scope === 'deposition_targets'
    ? depositionTargets(criterion, pathway, subDomain)
    : { values: vocabValues(criterion.vocabulary_key), recommended: [] };

// Automated criteria whose check reads a generated artifact rather than this
// field's own answer — their input is not meaningful here; they are completed on
// the Documents page. Maps id -> the artifact that drives it, and the Documents
// tab that artifact lives on so the pointer can be a link rather than an
// instruction.
const DESCRIPTOR_DRIVEN = {
  'fairness.l2.croissant_descriptor': ['Croissant descriptor', 'croissant'],
  'computability.l3.direct_ml_load': ['Croissant descriptor', 'croissant'],
  'fairness.l3.responsible_ai_annotations': ['Croissant descriptor', 'croissant'],
  'provenance.l3.prov_record_present': ['PROV-O record', 'provo'],
  'provenance.l3.entity_per_variable': ['PROV-O record', 'provo'],
  'provenance.l3.activity_per_step': ['PROV-O record', 'provo'],
  'explainability.l3.feature_lineage_intact': ['PROV-O record', 'provo'],
};

function StatusPill({ pending, result }) {
  if (pending) {
    return (
      <span className="rounded-none bg-idle-bg px-1.5 py-0.5 text-[0.65rem] font-medium text-muted">
        validator pending
      </span>
    );
  }
  if (result?.ok) {
    return (
      <span className="rounded-none bg-ok-bg px-1.5 py-0.5 text-[0.65rem] font-medium text-ok">
        ✓ validated
      </span>
    );
  }
  return (
    <span className="rounded-none bg-bad-bg px-1.5 py-0.5 text-[0.65rem] font-medium text-bad">
      × not valid
    </span>
  );
}

export default function CriterionField({ criterion, answer, onChange, requirement = 'required', result, stage, extra, pathway, subDomain }) {
  const value = answer?.value ?? '';
  const notes = answer?.notes ?? '';
  const notApplicable = answer?.not_applicable === true;
  const badge = VERIFICATION_BADGE[criterion.verification] ?? VERIFICATION_BADGE.manual;
  const automated = criterion.verification === 'automated';
  const pending = automated && !result && !notApplicable;
  const [descriptorArtifact, descriptorTab] = DESCRIPTOR_DRIVEN[criterion.id] ?? [];
  const locked = isLocked(criterion, stage);
  const validators = validatorsFor(criterion);
  // The note attached to whatever value is currently selected, and the candidate terms
  // a free-text criterion suggests. Both read from vocabularies.json.
  const selectedNote =
    criterion.evidence_type === 'controlled_vocabulary'
      ? vocabValues(criterion.vocabulary_key).find((v) => v.id === value)?.note
      : undefined;
  const suggestions = criterion.suggested_values ? vocabValues(criterion.suggested_values) : [];

  return (
    <div className="rounded-none border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-ink">{criterion.label}</span>
        <div className="flex shrink-0 gap-1">
          {requirement === 'recommended' && (
            <span className="rounded-none bg-info-bg px-1.5 py-0.5 text-[0.65rem] font-medium text-info">
              recommended
            </span>
          )}
          {locked && (
            <span className="rounded-none bg-warn-bg px-1.5 py-0.5 text-[0.65rem] font-medium text-warn">
              locked
            </span>
          )}
          {automated && !notApplicable && <StatusPill pending={pending} result={result} />}
          {notApplicable && (
            <span className="rounded-none bg-idle-bg px-1.5 py-0.5 text-[0.65rem] font-medium text-muted">
              ⊘ not applicable
            </span>
          )}
          <span
            title={badge.definition}
            className={`rounded-none px-1.5 py-0.5 text-[0.65rem] font-medium ${badge.cls}`}
          >
            {badge.label}
          </span>
        </div>
      </div>

      {/* Criteria that may genuinely not apply — no human subjects to de-identify, no
          classification target to balance, no model trained on this yet — get an explicit
          declaration. It is the only route open to a checkbox, which has no third state,
          and to an automated criterion, whose validator would otherwise fail an empty
          field the user was right to leave empty. */}
      {criterion.may_not_apply && (
        <label className="mt-3 flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={notApplicable}
            onChange={(e) => onChange({ not_applicable: e.target.checked })}
          />
          Not applicable to this dataset
        </label>
      )}

      <div className={`mt-3 ${notApplicable ? 'opacity-50' : ''}`}>
        {descriptorArtifact ? (
          <p className="text-xs text-muted">
            Validated from the {descriptorArtifact}; complete and check it on the{' '}
            <Link to={`/documents?tab=${descriptorTab}`} className="text-link underline">
              Documents page
            </Link>
            .
          </p>
        ) : (
          <FieldInput
            criterion={criterion}
            value={value}
            onValue={(v) => onChange({ value: v })}
            pathway={pathway}
            subDomain={subDomain}
          />
        )}
      </div>

      {extra && <div className="mt-3">{extra}</div>}

      {automated && !notApplicable && result && !result.ok && (
        <p className="mt-1 text-xs text-bad">{result.message}</p>
      )}

      {/* What would confirm this row. Visible rather than folded into the Guidance
          details below, because it says what "done" means, where remediation says
          how to close a gap — different questions, and only one of them is needed
          before you answer. The sentence carries its own mode in its voice ("The
          tool checks…", "You declare…", "<role> confirms…"), which is enforced in
          matrix.test.js, so it doubles as the in-context gloss on the mode chip. */}
      {/* Why this option, not just which. A pick-list of eight de-identification
          methods with no explanation asks the user to already know the answer; the
          notes come from the paper's own tables via vocabularies.json. */}
      {selectedNote && (
        <p className="mt-2 border-l-2 border-line pl-2 text-xs text-muted">{selectedNote}</p>
      )}

      {/* Candidate phrasings or vocabularies for a free-text criterion. Non-binding:
          the answer stays free text, and these are the terms the field usually wants. */}
      {suggestions.length > 0 && (
        <p className="mt-2 flex flex-wrap items-baseline gap-1.5 text-xs">
          <span className="font-mono text-[0.65rem] uppercase tracking-wider text-faint">
            Usually one of
          </span>
          {suggestions.map((v) => (
            <span key={v.id} title={v.note ?? ''} className="border border-line px-1.5 py-0.5 text-[0.7rem] text-muted">
              {v.label}
            </span>
          ))}
        </p>
      )}

      {criterion.verification_hint && (
        <p className="mt-2 text-xs text-muted">
          <span className="mr-1 font-mono text-[0.65rem] uppercase tracking-wider text-faint">
            Confirms
          </span>
          {criterion.verification_hint}
        </p>
      )}

      {/* The tools whose report is the evidence for this row. Sourced from the
          validator registry, which shipped unreachable until now. Where the criterion
          names none, an attested row still needs a report from somewhere, so point at
          the lookup rather than leaving the question hanging. */}
      {validators.length === 0 && criterion.verification === 'attested' && (
        <p className="mt-1.5 text-xs text-muted">
          <Link to="/validators" className="text-link underline">
            Find a validator for your data
          </Link>{' '}
          to attach a report.
        </p>
      )}
      {validators.length > 0 && (
        <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-mono text-[0.65rem] uppercase tracking-wider text-faint">
            Report from
          </span>
          {validators.map((v) => (
            <a
              key={v.id}
              href={v.validator_url}
              target="_blank"
              rel="noreferrer"
              className="border border-line px-1.5 py-0.5 text-[0.7rem] text-ink hover:border-muted"
            >
              {v.validator_name}
              <span className="ml-1 text-[0.62rem] text-faint">{executionNote(v)}</span>
            </a>
          ))}
        </p>
      )}

      {locked && (
        <p className="mt-1 text-xs text-warn">
          Reflects a past {criterion.lifecycle_stage} decision. Record what was done; if it falls
          short, document it as a known limitation of the release.
        </p>
      )}

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-muted">Guidance</summary>
        <p className="mt-1 text-xs text-muted">{criterion.remediation}</p>
      </details>

      {!descriptorArtifact && (
        <input
          type="text"
          value={notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder={
            criterion.verification === 'attested'
              ? 'Link the report that backs this (optional)'
              : 'Note (optional)'
          }
          className="mt-2 w-full rounded-none border border-line px-2 py-1 text-xs"
        />
      )}
    </div>
  );
}

function FieldInput({ criterion, value, onValue, pathway, subDomain }) {
  const t = criterion.evidence_type;

  if (t === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onValue(e.target.checked)}
        />
        Yes
      </label>
    );
  }

  if (t === 'controlled_vocabulary') {
    const { values, recommended } = optionsFor(criterion, pathway, subDomain);
    return <VocabSelect values={values} recommended={recommended} value={value} onValue={onValue} />;
  }

  if (t === 'text') {
    return (
      <textarea
        rows={2}
        value={value}
        onChange={(e) => onValue(e.target.value)}
        className="w-full rounded-none border border-line px-2 py-1 text-sm"
      />
    );
  }

  // uri | identifier | file
  const placeholder = t === 'uri' ? 'https://…' : t === 'file' ? 'file name or link' : 'identifier';
  return (
    <input
      type={t === 'uri' ? 'url' : 'text'}
      value={value}
      onChange={(e) => onValue(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-none border border-line px-2 py-1 text-sm"
    />
  );
}

function VocabSelect({ values, recommended = [], value, onValue }) {
  const ids = values.map((v) => v.id);
  const CUSTOM = '__custom__';
  const [custom, setCustom] = useState(Boolean(value) && !ids.includes(value));

  // When some options are recommended for the current sub-domain, group them so
  // the distinction is visible rather than implied by ordering alone.
  const rec = values.filter((v) => recommended.includes(v.id));
  const rest = values.filter((v) => !recommended.includes(v.id));
  const opt = (v) => (
    <option key={v.id} value={v.id}>
      {v.label}
    </option>
  );

  return (
    <div>
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
        className="w-full rounded-none border border-line px-2 py-1 text-sm"
      >
        <option value="">— select —</option>
        {rec.length > 0 ? (
          <>
            <optgroup label="Recommended for this sub-domain">{rec.map(opt)}</optgroup>
            <optgroup label="Other options">{rest.map(opt)}</optgroup>
          </>
        ) : (
          values.map(opt)
        )}
        <option value={CUSTOM}>Custom…</option>
      </select>
      {custom && (
        <input
          type="text"
          value={value}
          onChange={(e) => onValue(e.target.value)}
          placeholder="Custom value"
          className="mt-2 w-full rounded-none border border-line px-2 py-1 text-sm"
        />
      )}
    </div>
  );
}
