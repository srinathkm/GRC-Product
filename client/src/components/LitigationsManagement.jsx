import { useEffect, useMemo, useState } from 'react';

const API = '/api';

export function LitigationsManagement({ language = 'en', parents = [], selectedParentHolding, onParentHoldingChange }) {
  const [records, setRecords] = useState([]);
  const [filterParent, setFilterParent] = useState(selectedParentHolding || '');
  const [filterStatus, setFilterStatus] = useState('all');
  const [editingId, setEditingId] = useState(null);
  const [readOnlyLit, setReadOnlyLit] = useState(false);

  const [form, setForm] = useState({
    parent: selectedParentHolding || '',
    opco: '',
    caseId: '',
    court: '',
    jurisdiction: '',
    claimAmount: '',
    expectedExposure: '',
    status: 'Open',
    nextHearingDate: '',
    externalCounsel: '',
    notes: '',
  });

  useEffect(() => {
    const parent = (filterParent || '').trim();
    const q = new URLSearchParams();
    if (parent) q.set('parent', parent);
    const url = q.toString() ? `/api/litigations?${q.toString()}` : '/api/litigations';
    fetch(url)
      .then((r) => r.json())
      .then((data) => setRecords(Array.isArray(data) ? data : []))
      .catch(() => setRecords([]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedParentHolding && selectedParentHolding !== filterParent) {
      setFilterParent(selectedParentHolding);
      setForm((prev) => ({ ...prev, parent: selectedParentHolding }));
    }
  }, [selectedParentHolding]);

  const handleParentFilterChange = (value) => {
    setFilterParent(value);
    if (onParentHoldingChange) onParentHoldingChange(value);
    setForm((prev) => ({ ...prev, parent: value }));
    const q = new URLSearchParams();
    if (value) q.set('parent', value);
    fetch(`/api/litigations?${q.toString()}`)
      .then((r) => r.json())
      .then((data) => setRecords(Array.isArray(data) ? data : []))
      .catch(() => setRecords([]));
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    const parent = (form.parent || '').trim();
    const caseId = (form.caseId || '').trim();
    const court = (form.court || '').trim();
    if (!parent || !caseId || !court) return;
    const payload = {
      ...(editingId ? { id: editingId } : {}),
      ...form,
      parent,
    };
    fetch('/api/litigations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then(() => {
        const q = new URLSearchParams();
        if (parent) q.set('parent', parent);
        const url = q.toString() ? `/api/litigations?${q.toString()}` : '/api/litigations';
        return fetch(url)
          .then((r2) => r2.json())
          .then((data) => setRecords(Array.isArray(data) ? data : []))
          .catch(() => {});
      })
      .catch(() => {});
  };

  const visibleRecords = useMemo(() => {
    return records.filter((r) => {
      if (filterParent && r.parent !== filterParent) return false;
      if (filterStatus && filterStatus !== 'all' && r.status !== filterStatus) return false;
      return true;
    });
  }, [records, filterParent, filterStatus]);

  const stats = useMemo(() => {
    let total = 0;
    let open = 0;
    let adverse = 0;
    let settled = 0;
    visibleRecords.forEach((r) => {
      total += 1;
      if (r.status === 'Open') open += 1;
      if (r.status === 'Adverse') adverse += 1;
      if (r.status === 'Settled' || r.status === 'Closed') settled += 1;
    });
    return { total, open, adverse, settled };
  }, [visibleRecords]);

  const totalExposure = useMemo(() => {
    return visibleRecords.reduce((sum, r) => {
      const val = Number(r.expectedExposure || r.claimAmount || 0);
      return sum + (Number.isFinite(val) ? val : 0);
    }, 0);
  }, [visibleRecords]);

  const isReadOnly = readOnlyLit;

  return (
    <div className="lit-section">
      <h2 className="lit-title">Litigations Management</h2>
      <p className="lit-intro">
        Consolidated view of <strong>disputes and litigation matters</strong> across jurisdictions. Track exposure,
        status and next hearings to eliminate the <strong>visibility gap</strong> highlighted in the legal-ops business case.
      </p>

      <div className="lit-cards">
        <div className="lit-card">
          <span className="lit-card-label">Total cases</span>
          <span className="lit-card-value">{stats.total}</span>
        </div>
        <div className="lit-card">
          <span className="lit-card-label">Open</span>
          <span className="lit-card-value">{stats.open}</span>
        </div>
        <div className="lit-card">
          <span className="lit-card-label">Adverse</span>
          <span className="lit-card-value">{stats.adverse}</span>
        </div>
        <div className="lit-card">
          <span className="lit-card-label">Settled / Closed</span>
          <span className="lit-card-value">{stats.settled}</span>
        </div>
        <div className="lit-card">
          <span className="lit-card-label">Expected exposure</span>
          <span className="lit-card-value">{totalExposure.toLocaleString()} AED</span>
        </div>
      </div>

      <div className="lit-filters">
        <div className="lit-filter-row">
          <label htmlFor="lit-parent-select">Parent Holding</label>
          <select
            id="lit-parent-select"
            className="lit-select"
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
        <div className="lit-filter-row">
          <label htmlFor="lit-status-select">Status</label>
          <select
            id="lit-status-select"
            className="lit-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All</option>
            <option value="Open">Open</option>
            <option value="Adverse">Adverse</option>
            <option value="Settled">Settled</option>
            <option value="Closed">Closed</option>
          </select>
        </div>
      </div>

      <form className="lit-form" onSubmit={handleSave}>
        <h3 className="lit-form-title">Add / update case</h3>
        <div className="lit-form-grid">
          <div className="lit-field">
            <label>Parent Holding</label>
            <select
              className="lit-input"
              value={form.parent}
              onChange={(e) => handleFormChange('parent', e.target.value)}
              disabled
              required
            >
              <option value="">Select parent…</option>
              {parents.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="lit-field">
            <label>OpCo / Entity</label>
            <input
              className="lit-input"
              type="text"
              value={form.opco}
              onChange={(e) => handleFormChange('opco', e.target.value)}
              readOnly={isReadOnly}
            />
          </div>
          <div className="lit-field">
            <label>Case ID / Reference</label>
            <input
              className="lit-input"
              type="text"
              value={form.caseId}
              onChange={(e) => handleFormChange('caseId', e.target.value)}
              required
            />
          </div>
          <div className="lit-field">
            <label>Court / Forum</label>
            <input
              className="lit-input"
              type="text"
              value={form.court}
              onChange={(e) => handleFormChange('court', e.target.value)}
              required
            />
          </div>
          <div className="lit-field">
            <label>Jurisdiction</label>
            <input
              className="lit-input"
              type="text"
              value={form.jurisdiction}
              onChange={(e) => handleFormChange('jurisdiction', e.target.value)}
            />
          </div>
          <div className="lit-field">
            <label>Claim amount (AED)</label>
            <input
              className="lit-input"
              type="number"
              min="0"
              value={form.claimAmount}
              onChange={(e) => handleFormChange('claimAmount', e.target.value)}
            />
          </div>
          <div className="lit-field">
            <label>Expected exposure (AED)</label>
            <input
              className="lit-input"
              type="number"
              min="0"
              value={form.expectedExposure}
              onChange={(e) => handleFormChange('expectedExposure', e.target.value)}
            />
          </div>
          <div className="lit-field">
            <label>Status</label>
            <select
              className="lit-input"
              value={form.status}
              onChange={(e) => handleFormChange('status', e.target.value)}
            >
              <option value="Open">Open</option>
              <option value="Adverse">Adverse</option>
              <option value="Settled">Settled</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
          <div className="lit-field">
            <label>Next hearing / milestone</label>
            <input
              className="lit-input"
              type="date"
              value={form.nextHearingDate}
              onChange={(e) => handleFormChange('nextHearingDate', e.target.value)}
            />
          </div>
          <div className="lit-field">
            <label>External counsel</label>
            <input
              className="lit-input"
              type="text"
              value={form.externalCounsel}
              onChange={(e) => handleFormChange('externalCounsel', e.target.value)}
              placeholder="Firm, key partner"
            />
          </div>
          <div className="lit-field lit-field-wide">
            <label>Notes</label>
            <textarea
              className="lit-input"
              rows={2}
              value={form.notes}
              onChange={(e) => handleFormChange('notes', e.target.value)}
              placeholder="Strategy, settlement ranges, insurance notifications, etc."
            />
          </div>
        </div>
        <div className="lit-form-actions">
          <button type="submit" className="lit-btn-primary" disabled={isReadOnly}>
            {editingId ? 'Update case' : 'Save case'}
          </button>
          <button
            type="button"
            className={`lit-btn-secondary ${form.parent && form.opco ? 'lit-btn-secondary-enabled' : ''}`}
            disabled={!form.parent || !form.opco}
            onClick={() => {
              const parent = (form.parent || '').trim();
              const opco = (form.opco || '').trim();
              if (!parent || !opco) return;
              setFilterParent(parent);
              setFilterStatus('all');
              const q = new URLSearchParams();
              q.set('parent', parent);
              q.set('opco', opco);
              fetch(`/api/litigations?${q.toString()}`)
                .then((r) => r.json())
                .then((data) => setRecords(Array.isArray(data) ? data : []))
                .catch(() => {});
            }}
          >
            Load cases
          </button>
        </div>
      </form>

      <section className="lit-list-section">
        <h3 className="lit-list-title">Case register</h3>
        {visibleRecords.length === 0 ? (
          <p className="lit-empty">No cases captured yet for the selected filters.</p>
        ) : (
          <div className="lit-table-wrap">
            <table className="lit-table">
              <thead>
                <tr>
                  <th>Parent</th>
                  <th>OpCo</th>
                  <th>Case ID</th>
                  <th>Court</th>
                  <th>Status</th>
                  <th>Expected exposure (AED)</th>
                  <th>Next hearing</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => {
                      const isClosed = r.status === 'Settled' || r.status === 'Closed';
                      setEditingId(r.id);
                      setReadOnlyLit(isClosed);
                      setForm({
                        parent: r.parent || '',
                        opco: r.opco || '',
                        caseId: r.caseId || '',
                        court: r.court || '',
                        jurisdiction: r.jurisdiction || '',
                        claimAmount: r.claimAmount || '',
                        expectedExposure: r.expectedExposure || '',
                        status: r.status || 'Open',
                        nextHearingDate: r.nextHearingDate || '',
                        externalCounsel: r.externalCounsel || '',
                        notes: r.notes || '',
                      });
                    }}
                  >
                    <td>{r.parent}</td>
                    <td>{r.opco || '—'}</td>
                    <td>{r.caseId}</td>
                    <td>{r.court}</td>
                    <td>{r.status || '—'}</td>
                    <td>{(r.expectedExposure || r.claimAmount || 0).toLocaleString()}</td>
                    <td>{r.nextHearingDate || '—'}</td>
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

