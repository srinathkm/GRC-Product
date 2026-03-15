import { useEffect, useMemo, useState } from 'react';

const API = '/api';

export function LicenceManagement({ language = 'en', parents = [], selectedParentHolding, onParentHoldingChange }) {
  const [records, setRecords] = useState([]);
  const [filterParent, setFilterParent] = useState(selectedParentHolding || '');
  const [filterStatus, setFilterStatus] = useState('all');
  const [editingId, setEditingId] = useState(null);
  const [readOnlyLic, setReadOnlyLic] = useState(false);

  const [form, setForm] = useState({
    parent: selectedParentHolding || '',
    opco: '',
    licenceType: '',
    licenceNo: '',
    jurisdiction: '',
    issuingAuthority: '',
    validFrom: '',
    validUntil: '',
    status: 'Active',
    dependencies: '',
    notes: '',
  });

  useEffect(() => {
    const parent = (filterParent || '').trim();
    const q = new URLSearchParams();
    if (parent) q.set('parent', parent);
    const url = q.toString() ? `/api/licences?${q.toString()}` : '/api/licences';
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
    fetch(`/api/licences?${q.toString()}`)
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
    const licenceType = (form.licenceType || '').trim();
    const jurisdiction = (form.jurisdiction || '').trim();
    if (!parent || !licenceType || !jurisdiction) return;
    const payload = {
      ...(editingId ? { id: editingId } : {}),
      ...form,
      parent,
    };
    fetch('/api/licences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then(() => {
        const q = new URLSearchParams();
        if (parent) q.set('parent', parent);
        const url = q.toString() ? `/api/licences?${q.toString()}` : '/api/licences';
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
    let active = 0;
    let expiring = 0;
    let expired = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    visibleRecords.forEach((r) => {
      total += 1;
      if (r.status === 'Active') active += 1;
      if (r.validUntil) {
        const d = new Date(r.validUntil);
        d.setHours(0, 0, 0, 0);
        const diff = Math.ceil((d - today) / (24 * 60 * 60 * 1000));
        if (diff < 0) expired += 1;
        else if (diff <= 30) expiring += 1;
      }
    });
    return { total, active, expiring, expired };
  }, [visibleRecords]);

  const isReadOnly = readOnlyLic;

  return (
    <div className="lic-section">
      <h2 className="lic-title">Licence Management</h2>
      <p className="lic-intro">
        Catalogue and monitor <strong>regulatory and commercial licences</strong>, along with their dependencies.
        Reduce the risk of <strong>facility closures and cascading failures</strong> described in the legal-ops business case.
      </p>

      <div className="lic-cards">
        <div className="lic-card">
          <span className="lic-card-label">Total licences</span>
          <span className="lic-card-value">{stats.total}</span>
        </div>
        <div className="lic-card">
          <span className="lic-card-label">Active</span>
          <span className="lic-card-value">{stats.active}</span>
        </div>
        <div className="lic-card">
          <span className="lic-card-label">Expiring &lt; 30 days</span>
          <span className="lic-card-value">{stats.expiring}</span>
        </div>
        <div className="lic-card">
          <span className="lic-card-label">Expired</span>
          <span className="lic-card-value">{stats.expired}</span>
        </div>
      </div>

      <div className="lic-filters">
        <div className="lic-filter-row">
          <label htmlFor="lic-parent-select">Parent Holding</label>
          <select
            id="lic-parent-select"
            className="lic-select"
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
        <div className="lic-filter-row">
          <label htmlFor="lic-status-select">Status</label>
          <select
            id="lic-status-select"
            className="lic-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All</option>
            <option value="Active">Active</option>
            <option value="Suspended">Suspended</option>
            <option value="Expired">Expired</option>
          </select>
        </div>
      </div>

      <form className="lic-form" onSubmit={handleSave}>
        <h3 className="lic-form-title">Add / update licence</h3>
        <div className="lic-form-grid">
          <div className="lic-field">
            <label>Parent Holding</label>
            <select
              className="lic-input"
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
          <div className="lic-field">
            <label>OpCo / Facility</label>
            <input
              className="lic-input"
              type="text"
              value={form.opco}
              onChange={(e) => handleFormChange('opco', e.target.value)}
              readOnly={isReadOnly}
            />
          </div>
          <div className="lic-field">
            <label>Licence type</label>
            <input
              className="lic-input"
              type="text"
              value={form.licenceType}
              onChange={(e) => handleFormChange('licenceType', e.target.value)}
              placeholder="e.g. DHA clinic licence, Civil Defence, Trade licence"
              required
            />
          </div>
          <div className="lic-field">
            <label>Licence no.</label>
            <input
              className="lic-input"
              type="text"
              value={form.licenceNo}
              onChange={(e) => handleFormChange('licenceNo', e.target.value)}
            />
          </div>
          <div className="lic-field">
            <label>Jurisdiction</label>
            <input
              className="lic-input"
              type="text"
              value={form.jurisdiction}
              onChange={(e) => handleFormChange('jurisdiction', e.target.value)}
              required
            />
          </div>
          <div className="lic-field">
            <label>Issuing authority</label>
            <input
              className="lic-input"
              type="text"
              value={form.issuingAuthority}
              onChange={(e) => handleFormChange('issuingAuthority', e.target.value)}
              placeholder="e.g. DHA, MOHAP, Municipality"
            />
          </div>
          <div className="lic-field">
            <label>Valid from</label>
            <input
              className="lic-input"
              type="date"
              value={form.validFrom}
              onChange={(e) => handleFormChange('validFrom', e.target.value)}
            />
          </div>
          <div className="lic-field">
            <label>Valid until</label>
            <input
              className="lic-input"
              type="date"
              value={form.validUntil}
              onChange={(e) => handleFormChange('validUntil', e.target.value)}
            />
          </div>
          <div className="lic-field">
            <label>Status</label>
            <select
              className="lic-input"
              value={form.status}
              onChange={(e) => handleFormChange('status', e.target.value)}
            >
              <option value="Active">Active</option>
              <option value="Suspended">Suspended</option>
              <option value="Expired">Expired</option>
            </select>
          </div>
          <div className="lic-field lic-field-wide">
            <label>Dependencies / cascade impact</label>
            <textarea
              className="lic-input"
              rows={2}
              value={form.dependencies}
              onChange={(e) => handleFormChange('dependencies', e.target.value)}
              placeholder="Describe what depends on this licence (e.g. DHA licence invalid if Civil Defence lapses)."
            />
          </div>
          <div className="lic-field lic-field-wide">
            <label>Notes</label>
            <textarea
              className="lic-input"
              rows={2}
              value={form.notes}
              onChange={(e) => handleFormChange('notes', e.target.value)}
            />
          </div>
        </div>
        <div className="lic-form-actions">
          <button type="submit" className="lic-btn-primary" disabled={isReadOnly}>
            {editingId ? 'Update licence' : 'Save licence'}
          </button>
          <button
            type="button"
            className={`lic-btn-secondary ${form.parent && form.opco ? 'lic-btn-secondary-enabled' : ''}`}
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
              fetch(`/api/licences?${q.toString()}`)
                .then((r) => r.json())
                .then((data) => setRecords(Array.isArray(data) ? data : []))
                .catch(() => {});
            }}
          >
            Load licences
          </button>
        </div>
      </form>

      <section className="lic-list-section">
        <h3 className="lic-list-title">Licence register</h3>
        {visibleRecords.length === 0 ? (
          <p className="lic-empty">No licences captured yet for the selected filters.</p>
        ) : (
          <div className="lic-table-wrap">
            <table className="lic-table">
              <thead>
                <tr>
                  <th>Parent</th>
                  <th>OpCo / Facility</th>
                  <th>Licence type</th>
                  <th>Jurisdiction</th>
                  <th>Valid until</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      let isExpired = r.status === 'Expired';
                      if (r.validUntil && !isExpired) {
                        const d = new Date(r.validUntil);
                        d.setHours(0, 0, 0, 0);
                        isExpired = d < today;
                      }
                      setEditingId(r.id);
                      setReadOnlyLic(isExpired);
                      setForm({
                        parent: r.parent || '',
                        opco: r.opco || '',
                        licenceType: r.licenceType || '',
                        licenceNo: r.licenceNo || '',
                        jurisdiction: r.jurisdiction || '',
                        issuingAuthority: r.issuingAuthority || '',
                        validFrom: r.validFrom || '',
                        validUntil: r.validUntil || '',
                        status: r.status || 'Active',
                        dependencies: r.dependencies || '',
                        notes: r.notes || '',
                      });
                    }}
                  >
                    <td>{r.parent}</td>
                    <td>{r.opco || '—'}</td>
                    <td>{r.licenceType}</td>
                    <td>{r.jurisdiction}</td>
                    <td>{r.validUntil || '—'}</td>
                    <td>{r.status || '—'}</td>
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

