import { useEffect, useMemo, useState } from 'react';
import { POAUploadZone } from './POAUploadZone.jsx';
import { POAExtractionReview } from './POAExtractionReview.jsx';

function computeStatus(record) {
  if (record.revoked) return 'Revoked';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (record.validUntil) {
    const end = new Date(record.validUntil);
    end.setHours(0, 0, 0, 0);
    if (Number.isNaN(end.getTime())) return 'Unknown';
    const diffDays = Math.ceil((end - today) / (24 * 60 * 60 * 1000));
    if (diffDays < 0) return 'Expired';
    if (diffDays <= 30) return 'Expiring soon';
    return 'Active';
  }
  return 'Active';
}

function getFormStatus(form) {
  if (!form || (!form.validUntil && !form.revoked)) return null;
  return computeStatus({ validUntil: form.validUntil, revoked: form.revoked });
}

const API = '/api';

export function PoaManagement({ language = 'en', parents = [], selectedParentHolding, onParentHoldingChange }) {
  const [records, setRecords] = useState([]);
  const [filterParent, setFilterParent] = useState(selectedParentHolding || '');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterOpco, setFilterOpco] = useState('');
  const [opcosForParent, setOpcosForParent] = useState([]);
  const [opcoListLoading, setOpcoListLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [readOnlyPoa, setReadOnlyPoa] = useState(false);
  const [extractionPayload, setExtractionPayload] = useState(null);
  const [expandedScopeId, setExpandedScopeId] = useState(null);

  const [form, setForm] = useState({
    fileId: '',
    parent: selectedParentHolding || '',
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
    revoked: false,
    notes: '',
  });

  useEffect(() => {
    // Initial load of POAs for the current parent/opco filter from backend.
    const parent = (filterParent || '').trim();
    const opco = (filterOpco || '').trim();
    const q = new URLSearchParams();
    if (parent) q.set('parent', parent);
    if (opco) q.set('opco', opco);
    const url = q.toString() ? `/api/poa?${q.toString()}` : '/api/poa';
    fetch(url)
      .then((r) => r.json())
      .then((data) => setRecords(Array.isArray(data) ? data : []))
      .catch(() => setRecords([]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const fileId = (() => {
      try {
        const id = sessionStorage.getItem('poaLoadFileId');
        if (id) sessionStorage.removeItem('poaLoadFileId');
        return (id || '').trim();
      } catch {
        return '';
      }
    })();
    if (!fileId) return;
    fetch(`/api/poa?fileId=${encodeURIComponent(fileId)}`)
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        const rec = list[0];
        if (rec) {
          setFilterParent(rec.parent || '');
          setFilterOpco(rec.opco || '');
          setFilterStatus('all');
          setEditingId(rec.id);
          setReadOnlyPoa(computeStatus(rec) === 'Revoked' || computeStatus(rec) === 'Expired');
          setForm({
            fileId: rec.fileId || '',
            parent: rec.parent || '',
            opco: rec.opco || '',
            holderName: rec.holderName || '',
            holderRole: rec.holderRole || '',
            poaType: rec.poaType || '',
            scope: rec.scope || '',
            jurisdiction: rec.jurisdiction || '',
            issuingAuthority: rec.issuingAuthority || '',
            signedOn: rec.signedOn || '',
            validFrom: rec.validFrom || '',
            validUntil: rec.validUntil || '',
            notarised: !!rec.notarised,
            mofaStamp: !!rec.mofaStamp,
            embassyStamp: !!rec.embassyStamp,
            revoked: !!rec.revoked,
            notes: rec.notes || '',
          });
          const q = new URLSearchParams();
          if (rec.parent) q.set('parent', rec.parent);
          if (rec.opco) q.set('opco', rec.opco);
          fetch(q.toString() ? `/api/poa?${q.toString()}` : '/api/poa')
            .then((res) => res.json())
            .then((arr) => setRecords(Array.isArray(arr) ? arr : []))
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedParentHolding && selectedParentHolding !== filterParent) {
      setFilterParent(selectedParentHolding);
    }
  }, [selectedParentHolding]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!filterParent) {
      setOpcosForParent([]);
      setOpcoListLoading(false);
      return;
    }
    setOpcosForParent([]);
    setOpcoListLoading(true);
    fetch(`${API}/companies/by-parent?parent=${encodeURIComponent(filterParent)}`)
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data.opcos) ? data.opcos : [];
        const names = [...new Set(list.map((o) => (o && o.name) || o).filter(Boolean))].sort();
        setOpcosForParent(names);
      })
      .catch(() => setOpcosForParent([]))
      .finally(() => setOpcoListLoading(false));
  }, [filterParent]);

  const handleParentFilterChange = (value) => {
    setFilterParent(value);
    setFilterOpco('');
    if (onParentHoldingChange) onParentHoldingChange(value);
    setForm((prev) => ({ ...prev, parent: value }));
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFormCheckbox = (field, checked) => {
    setForm((prev) => ({
      ...prev,
      [field]: checked,
    }));
  };

  const handleAdd = (e) => {
    e.preventDefault();
    const parent = (form.parent || '').trim();
    const holderName = (form.holderName || '').trim();
    const scope = (form.scope || '').trim();
    if (!parent || !holderName || !scope) {
      return;
    }
    const payload = {
      ...(editingId ? { id: editingId } : {}),
      ...form,
      parent,
    };
    fetch('/api/poa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then(() => {
        // After successful save, reload POAs for this parent/opco combination.
        const q = new URLSearchParams();
        if (parent) q.set('parent', parent);
        if (form.opco) q.set('opco', form.opco);
        const url = q.toString() ? `/api/poa?${q.toString()}` : '/api/poa';
        return fetch(url)
          .then((r2) => r2.json())
          .then((data) => setRecords(Array.isArray(data) ? data : []))
          .catch(() => {});
      })
      .catch(() => {
        // keep existing records on error
      });
    setForm((prev) => ({
      ...prev,
      fileId: '',
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
      revoked: false,
      notes: '',
    }));
    setEditingId(null);
  };

  const visibleRecords = useMemo(() => {
    return records
      .map((r) => ({ ...r, computedStatus: computeStatus(r) }))
      .filter((r) => {
        if (filterParent && r.parent !== filterParent) return false;
        if (filterOpco && r.opco !== filterOpco) return false;
        if (filterStatus === 'all') return true;
        return r.computedStatus === filterStatus;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [records, filterParent, filterOpco, filterStatus]);

  const stats = useMemo(() => {
    let total = 0;
    let expiring = 0;
    let expired = 0;
    let revoked = 0;
    records.forEach((r) => {
      if (filterParent && r.parent !== filterParent) return;
      const status = computeStatus(r);
      total += 1;
      if (status === 'Expiring soon') expiring += 1;
      if (status === 'Expired') expired += 1;
      if (status === 'Revoked') revoked += 1;
    });
    return { total, expiring, expired, revoked };
  }, [records, filterParent]);

  const isReadOnly = readOnlyPoa;

  return (
    <div className="poa-section">
      <h2 className="poa-title">POA Management</h2>
      <p className="poa-intro">
        Central registry of <strong>powers of attorney</strong> across the group. Track who is authorised to sign,
        in which jurisdiction, for what scope, and until when. Monitor <strong>attestation status</strong> and
        <strong> expiry</strong> to avoid invalid signatories during critical transactions.
      </p>

      <div className="poa-upload-block">
        <h3 className="poa-upload-block-title">Upload POA document</h3>
        <POAUploadZone
          onExtractionComplete={(payload) => setExtractionPayload(payload)}
        />
      </div>

      {extractionPayload && (
        <POAExtractionReview
          payload={extractionPayload}
          onUseInForm={(fields) => {
            setForm((prev) => ({ ...prev, ...fields }));
            if (fields.parent) {
              setFilterParent(fields.parent);
              if (onParentHoldingChange) onParentHoldingChange(fields.parent);
            }
            setExtractionPayload(null);
          }}
          onBackToUpload={() => setExtractionPayload(null)}
          onBackToList={() => setExtractionPayload(null)}
        />
      )}

      <div className="poa-cards">
        <div className="poa-card">
          <span className="poa-card-label">Total POAs</span>
          <span className="poa-card-value">{stats.total}</span>
        </div>
        <div className="poa-card poa-card-warning">
          <span className="poa-card-label">Expiring in &lt; 30 days</span>
          <span className="poa-card-value">{stats.expiring}</span>
        </div>
        <div className="poa-card poa-card-danger">
          <span className="poa-card-label">Expired</span>
          <span className="poa-card-value">{stats.expired}</span>
        </div>
        <div className="poa-card">
          <span className="poa-card-label">Revoked</span>
          <span className="poa-card-value">{stats.revoked}</span>
        </div>
      </div>

      <div className="poa-filters">
        <div className="poa-filter-row">
          <label htmlFor="poa-parent-select">Parent Holding</label>
          <select
            id="poa-parent-select"
            className="poa-select"
            value={filterParent}
            onChange={(e) => handleParentFilterChange(e.target.value)}
          >
            <option value="">All</option>
            {parents.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="poa-filter-row">
          <label htmlFor="poa-status-select">Status</label>
          <select
            id="poa-status-select"
            className="poa-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All</option>
            <option value="Active">Active</option>
            <option value="Expiring soon">Expiring soon</option>
            <option value="Expired">Expired</option>
            <option value="Revoked">Revoked</option>
          </select>
        </div>
      </div>

      <form className="poa-form" onSubmit={handleAdd}>
        <div className="poa-form-header">
          <h3 className="poa-form-title">Add / update POA</h3>
          {getFormStatus(form) && (
            <span className={`poa-form-status poa-form-status-${getFormStatus(form).toLowerCase().replace(/\s+/g, '-')}`} title={`Status: ${getFormStatus(form)}`}>
              <span className="poa-form-status-dot" aria-hidden />
              {getFormStatus(form)}
            </span>
          )}
        </div>
        <div className="poa-form-grid">
          <div className="poa-field">
            <label>File ID</label>
            <input
              className="poa-input"
              type="text"
              value={form.fileId}
              onChange={(e) => handleFormChange('fileId', e.target.value)}
              readOnly={isReadOnly}
              placeholder="Notarisation Reference No (unique key)"
            />
          </div>
          <div className="poa-field">
            <label>Parent Holding</label>
            <select
              className="poa-input"
              value={form.parent}
              onChange={(e) => handleFormChange('parent', e.target.value)}
              disabled
              required
            >
              <option value="">Select parent…</option>
              {(form.parent && !parents.includes(form.parent) ? [form.parent, ...parents] : parents).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="poa-field">
            <label>OpCo / Entity</label>
            <select
              className="poa-input"
              value={form.opco}
              onChange={(e) => handleFormChange('opco', e.target.value)}
              disabled={isReadOnly || !form.parent || opcoListLoading}
            >
              <option value="">Select OpCo…</option>
              {(form.opco && !opcosForParent.includes(form.opco) ? [form.opco, ...opcosForParent] : opcosForParent).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div className="poa-field">
            <label>Attorney / Holder name</label>
            <input
              className="poa-input"
              type="text"
              value={form.holderName}
              onChange={(e) => handleFormChange('holderName', e.target.value)}
              readOnly={isReadOnly}
              required
            />
          </div>
          <div className="poa-field">
            <label>Role / Position</label>
            <input
              className="poa-input"
              type="text"
              value={form.holderRole}
              onChange={(e) => handleFormChange('holderRole', e.target.value)}
              readOnly={isReadOnly}
              placeholder="e.g. CFO, Legal Counsel"
            />
          </div>
          <div className="poa-field">
            <label>POA type</label>
            <input
              className="poa-input"
              type="text"
              value={form.poaType}
              onChange={(e) => handleFormChange('poaType', e.target.value)}
              readOnly={isReadOnly}
              placeholder="General / Specific / Bank / Regulatory"
            />
          </div>
          <div className="poa-field poa-field-wide">
            <label>Scope of authority</label>
            <textarea
              className="poa-input"
              rows={2}
              value={form.scope}
              onChange={(e) => handleFormChange('scope', e.target.value)}
              readOnly={isReadOnly}
              required
            />
          </div>
          <div className="poa-field">
            <label>Jurisdiction</label>
            <input
              className="poa-input"
              type="text"
              value={form.jurisdiction}
              onChange={(e) => handleFormChange('jurisdiction', e.target.value)}
              readOnly={isReadOnly}
              placeholder="e.g. UAE, KSA, Qatar"
            />
          </div>
          <div className="poa-field">
            <label>Issuing authority</label>
            <input
              className="poa-input"
              type="text"
              value={form.issuingAuthority}
              onChange={(e) => handleFormChange('issuingAuthority', e.target.value)}
              readOnly={isReadOnly}
              placeholder="e.g. Dubai Notary Public"
            />
          </div>
          <div className="poa-field">
            <label>Signed on</label>
            <input
              className="poa-input"
              type="date"
              value={form.signedOn}
              onChange={(e) => handleFormChange('signedOn', e.target.value)}
              readOnly={isReadOnly}
            />
          </div>
          <div className="poa-field">
            <label>Valid from</label>
            <input
              className="poa-input"
              type="date"
              value={form.validFrom}
              onChange={(e) => handleFormChange('validFrom', e.target.value)}
              readOnly={isReadOnly}
            />
          </div>
          <div className="poa-field">
            <label>Valid until</label>
            <input
              className="poa-input"
              type="date"
              value={form.validUntil}
              onChange={(e) => handleFormChange('validUntil', e.target.value)}
              readOnly={isReadOnly}
            />
          </div>
          <div className="poa-field poa-field-checkboxes">
            <label>Attestation status</label>
            <div className="poa-checkbox-row">
              <label>
                <input
                  type="checkbox"
                  checked={form.notarised}
                  onChange={(e) => handleFormCheckbox('notarised', e.target.checked)}
                  disabled={isReadOnly}
                />
                Notarised
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.mofaStamp}
                  onChange={(e) => handleFormCheckbox('mofaStamp', e.target.checked)}
                  disabled={isReadOnly}
                />
                MOFA stamp
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.embassyStamp}
                  onChange={(e) => handleFormCheckbox('embassyStamp', e.target.checked)}
                  disabled={isReadOnly}
                />
                Embassy stamp
              </label>
            </div>
          </div>
          <div className="poa-field">
            <label>
              <input
                type="checkbox"
                checked={form.revoked}
                onChange={(e) => handleFormCheckbox('revoked', e.target.checked)}
                disabled={isReadOnly}
              />
              {' '}
              Revoked
            </label>
          </div>
          <div className="poa-field poa-field-wide">
            <label>Notes</label>
            <textarea
              className="poa-input"
              rows={2}
              value={form.notes}
              onChange={(e) => handleFormChange('notes', e.target.value)}
              readOnly={isReadOnly}
              placeholder="Internal notes, e.g. linked bank accounts, licence dependencies, revocation details."
            />
          </div>
        </div>
        <div className="poa-form-actions">
          <button type="submit" className="poa-btn-primary" disabled={isReadOnly}>
            {editingId ? 'Update POA' : 'Save POA'}
          </button>
          <button
            type="button"
            className={`poa-btn-secondary ${form.parent && form.opco ? 'poa-btn-secondary-enabled' : ''}`}
            onClick={() => {
              const parent = (form.parent || '').trim();
              const opco = (form.opco || '').trim();
              if (!parent || !opco) return;
              setFilterParent(parent);
              setFilterOpco(opco);
              setFilterStatus('all');
            }}
            disabled={!form.parent || !form.opco}
          >
            Load POA
          </button>
          <button
            type="button"
            className={`poa-btn-secondary ${form.fileId ? 'poa-btn-secondary-enabled' : ''}`}
            onClick={() => {
              const id = (form.fileId || '').trim();
              if (!id) return;
              fetch(`/api/poa?fileId=${encodeURIComponent(id)}`)
                .then((r) => r.json())
                .then((data) => {
                  const list = Array.isArray(data) ? data : [];
                  const r = list[0];
                  if (r) {
                    setFilterParent(r.parent || '');
                    setFilterOpco(r.opco || '');
                    setFilterStatus('all');
                    setEditingId(r.id);
                    setReadOnlyPoa(computeStatus(r) === 'Revoked' || computeStatus(r) === 'Expired');
                    setForm({
                      fileId: r.fileId || '',
                      parent: r.parent || '',
                      opco: r.opco || '',
                      holderName: r.holderName || '',
                      holderRole: r.holderRole || '',
                      poaType: r.poaType || '',
                      scope: r.scope || '',
                      jurisdiction: r.jurisdiction || '',
                      issuingAuthority: r.issuingAuthority || '',
                      signedOn: r.signedOn || '',
                      validFrom: r.validFrom || '',
                      validUntil: r.validUntil || '',
                      notarised: !!r.notarised,
                      mofaStamp: !!r.mofaStamp,
                      embassyStamp: !!r.embassyStamp,
                      revoked: !!r.revoked,
                      notes: r.notes || '',
                    });
                  }
                })
                .catch(() => {});
            }}
            disabled={!form.fileId}
          >
            Load by File ID
          </button>
        </div>
      </form>

      <section className="poa-list-section">
        <h3 className="poa-list-title">POA register</h3>
        {visibleRecords.length === 0 ? (
          <p className="poa-empty">No POAs captured yet for the selected filters.</p>
        ) : (
          <div className="poa-table-wrap">
            <table className="poa-table">
              <thead>
                <tr>
                  <th>File ID</th>
                  <th>Parent</th>
                  <th>OpCo / Entity</th>
                  <th>Holder</th>
                  <th>Jurisdiction</th>
                  <th>Scope</th>
                  <th>Valid until</th>
                  <th>Status</th>
                  <th>Attestation</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map((r) => (
                  <tr
                    key={r.id}
                    className={editingId === r.id ? 'poa-row-editing' : ''}
                    onClick={() => {
                      const status = computeStatus(r);
                      const isRo = status === 'Revoked' || status === 'Expired';
                      setEditingId(r.id);
                      setReadOnlyPoa(isRo);
                      setForm({
                        fileId: r.fileId || '',
                        parent: r.parent || '',
                        opco: r.opco || '',
                        holderName: r.holderName || '',
                        holderRole: r.holderRole || '',
                        poaType: r.poaType || '',
                        scope: r.scope || '',
                        jurisdiction: r.jurisdiction || '',
                        issuingAuthority: r.issuingAuthority || '',
                        signedOn: r.signedOn || '',
                        validFrom: r.validFrom || '',
                        validUntil: r.validUntil || '',
                        notarised: !!r.notarised,
                        mofaStamp: !!r.mofaStamp,
                        embassyStamp: !!r.embassyStamp,
                        revoked: !!r.revoked,
                        notes: r.notes || '',
                      });
                    }}
                  >
                    <td>{r.fileId || '—'}</td>
                    <td>{r.parent}</td>
                    <td>{r.opco || '—'}</td>
                    <td>
                      <div className="poa-holder">
                        <span className="poa-holder-name">{r.holderName}</span>
                        {r.holderRole && <span className="poa-holder-role">{r.holderRole}</span>}
                      </div>
                    </td>
                    <td>{r.jurisdiction || '—'}</td>
                    <td className="poa-scope-cell">
                      {r.scope && r.scope.length > 140 ? (
                        <>
                          <span className="poa-scope-preview">
                            {r.scope.slice(0, 140)}
                            {'…'}
                          </span>
                          <button
                            type="button"
                            className="poa-scope-toggle"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedScopeId((prev) => (prev === r.id ? null : r.id));
                            }}
                          >
                            {expandedScopeId === r.id ? 'Hide' : 'Show full scope'}
                          </button>
                          {expandedScopeId === r.id && (
                            <div className="poa-scope-expanded">
                              {r.scope}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="poa-scope-preview">{r.scope || '—'}</span>
                      )}
                    </td>
                    <td>{r.validUntil || '—'}</td>
                    <td>
                      <span className={`poa-status-badge poa-status-${computeStatus(r).toLowerCase().replace(/\s+/g, '-')}`}>
                        {computeStatus(r)}
                      </span>
                    </td>
                    <td>
                      <div className="poa-attestation">
                        {r.notarised && <span className="poa-attestation-tag">Notarised</span>}
                        {r.mofaStamp && <span className="poa-attestation-tag">MOFA</span>}
                        {r.embassyStamp && <span className="poa-attestation-tag">Embassy</span>}
                        {!r.notarised && !r.mofaStamp && !r.embassyStamp && <span className="poa-attestation-tag poa-attestation-tag-muted">Pending</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

