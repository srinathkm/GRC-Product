import { useEffect, useState } from 'react';

const EMPTY_FIELDS = {
  fileId: '',
  parent: '',
  opco: '',
  holderName: '',
  holderRole: '',
  poaType: '',
  scope: '',
  jurisdiction: '',
  issuingAuthority: '',
  signedOn: '',
  validFrom: '',
  validUntil: '',
  notarised: false,
  mofaStamp: false,
  embassyStamp: false,
  notes: '',
};

function mergeExtracted(extracted) {
  return {
    ...EMPTY_FIELDS,
    ...(extracted && typeof extracted === 'object' ? extracted : {}),
  };
}

export function POAExtractionReview({ payload, onUseInForm, onBackToUpload, onBackToList }) {
  const { single, results = [] } = payload || {};
  const [selectedIndex, setSelectedIndex] = useState(0);
  const items = results.length ? results : (single ? [{ filename: single.filename, extracted: single.extracted, fromDocument: single.fromDocument }] : []);
  const current = items[selectedIndex];
  const [edited, setEdited] = useState(() => (current ? mergeExtracted(current.extracted) : EMPTY_FIELDS));

  useEffect(() => {
    if (current) setEdited(mergeExtracted(current.extracted));
  }, [selectedIndex, results?.length, single?.filename]);

  if (!current) {
    return (
      <div className="poa-extraction-review">
        <p className="poa-extraction-empty">No extraction result to review.</p>
        <div className="poa-extraction-actions">
          <button type="button" className="poa-btn-secondary" onClick={onBackToList}>Back to POA list</button>
        </div>
      </div>
    );
  }

  const updateField = (field, value) => {
    setEdited((prev) => ({ ...prev, [field]: value }));
  };

  const handleUseInForm = () => {
    onUseInForm?.(edited);
  };

  return (
    <div className="poa-extraction-review">
      <h3 className="poa-extraction-title">Review extracted POA details</h3>
      {items.length > 1 && (
        <div className="poa-extraction-tabs">
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              className={`poa-extraction-tab ${i === selectedIndex ? 'poa-extraction-tab-active' : ''}`}
              onClick={() => {
                setSelectedIndex(i);
                setEdited(mergeExtracted(item.extracted));
              }}
            >
              {item.filename}
            </button>
          ))}
        </div>
      )}
      {items.length === 1 && <p className="poa-extraction-filename">{current.filename}</p>}
      <div className="poa-extraction-form">
        <div className="poa-extraction-grid">
          <div className="poa-field">
            <label>File ID</label>
            <input
              className="poa-input"
              type="text"
              value={edited.fileId}
              onChange={(e) => updateField('fileId', e.target.value)}
              placeholder="Notarisation Reference No (unique key)"
            />
          </div>
          <div className="poa-field">
            <label>Parent Holding</label>
            <input
              className="poa-input"
              type="text"
              value={edited.parent}
              onChange={(e) => updateField('parent', e.target.value)}
            />
          </div>
          <div className="poa-field">
            <label>OpCo / Entity</label>
            <input
              className="poa-input"
              type="text"
              value={edited.opco}
              onChange={(e) => updateField('opco', e.target.value)}
            />
          </div>
          <div className="poa-field">
            <label>Attorney / Holder name</label>
            <input
              className="poa-input"
              type="text"
              value={edited.holderName}
              onChange={(e) => updateField('holderName', e.target.value)}
            />
          </div>
          <div className="poa-field">
            <label>Role / Position</label>
            <input
              className="poa-input"
              type="text"
              value={edited.holderRole}
              onChange={(e) => updateField('holderRole', e.target.value)}
            />
          </div>
          <div className="poa-field">
            <label>POA type</label>
            <input
              className="poa-input"
              type="text"
              value={edited.poaType}
              onChange={(e) => updateField('poaType', e.target.value)}
            />
          </div>
          <div className="poa-field poa-field-wide">
            <label>Scope of authority (numbered points and limitations)</label>
            <textarea
              className="poa-input"
              rows={6}
              value={edited.scope}
              onChange={(e) => updateField('scope', e.target.value)}
              placeholder="Numbered points and limitations from Part 3…"
            />
          </div>
          <div className="poa-field">
            <label>Jurisdiction</label>
            <input
              className="poa-input"
              type="text"
              value={edited.jurisdiction}
              onChange={(e) => updateField('jurisdiction', e.target.value)}
            />
          </div>
          <div className="poa-field">
            <label>Issuing authority</label>
            <input
              className="poa-input"
              type="text"
              value={edited.issuingAuthority}
              onChange={(e) => updateField('issuingAuthority', e.target.value)}
            />
          </div>
          <div className="poa-field">
            <label>Signed on</label>
            <input
              className="poa-input"
              type="date"
              value={edited.signedOn}
              onChange={(e) => updateField('signedOn', e.target.value)}
            />
          </div>
          <div className="poa-field">
            <label>Valid from</label>
            <input
              className="poa-input"
              type="date"
              value={edited.validFrom}
              onChange={(e) => updateField('validFrom', e.target.value)}
            />
          </div>
          <div className="poa-field">
            <label>Valid until</label>
            <input
              className="poa-input"
              type="date"
              value={edited.validUntil}
              onChange={(e) => updateField('validUntil', e.target.value)}
            />
          </div>
          <div className="poa-field poa-field-checkboxes">
            <label>Attestation</label>
            <div className="poa-checkbox-row">
              <label>
                <input
                  type="checkbox"
                  checked={!!edited.notarised}
                  onChange={(e) => updateField('notarised', e.target.checked)}
                />
                Notarised
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={!!edited.mofaStamp}
                  onChange={(e) => updateField('mofaStamp', e.target.checked)}
                />
                MOFA stamp
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={!!edited.embassyStamp}
                  onChange={(e) => updateField('embassyStamp', e.target.checked)}
                />
                Embassy stamp
              </label>
            </div>
          </div>
          <div className="poa-field poa-field-wide">
            <label>Notes</label>
            <textarea
              className="poa-input"
              rows={2}
              value={edited.notes}
              onChange={(e) => updateField('notes', e.target.value)}
            />
          </div>
        </div>
        <div className="poa-extraction-actions">
          <button type="button" className="poa-btn-primary" onClick={handleUseInForm}>
            Use in form
          </button>
          {onBackToUpload && (
            <button type="button" className="poa-btn-secondary" onClick={onBackToUpload}>
              Upload another
            </button>
          )}
          <button type="button" className="poa-btn-secondary" onClick={onBackToList}>
            Back to POA list
          </button>
        </div>
      </div>
    </div>
  );
}
