import { useEffect, useMemo, useState } from 'react';
import { DocumentAutoFill, useDocumentAutoFill } from './DocumentAutoFill.jsx';

const API = '/api';

const IP_FIELD_LABELS = {
  mark: 'Mark / IP Name', ipType: 'Type', class: 'Class', jurisdiction: 'Jurisdiction',
  registrationNo: 'Registration No.', applicationNo: 'Application No.',
  filingDate: 'Filing Date', registrationDate: 'Registration Date',
  renewalDate: 'Renewal Date', status: 'Status', agent: 'IP Agent',
};

export function IpManagement({ language = 'en', parents = [], selectedParentHolding, onParentHoldingChange }) {
  const [records, setRecords] = useState([]);
  const [filterParent, setFilterParent] = useState(selectedParentHolding || '');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterOpco, setFilterOpco] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [readOnlyIp, setReadOnlyIp] = useState(false);
  const { applyExtracted, sendFeedback } = useDocumentAutoFill('ip');

  const [form, setForm] = useState({
    parent: selectedParentHolding || '',
    opco: '',
    mark: '',
    class: '',
    jurisdiction: '',
    registrationNo: '',
    filingDate: '',
    registrationDate: '',
    renewalDate: '',
    status: 'Active',
    agent: '',
    notes: '',
  });

  useEffect(() => {
    const parent = (filterParent || '').trim();
    const opco = (filterOpco || '').trim();
    const q = new URLSearchParams();
    if (parent) q.set('parent', parent);
    if (opco) q.set('opco', opco);
    const url = q.toString() ? `/api/ip?${q.toString()}` : '/api/ip';
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
    setFilterOpco('');
    if (onParentHoldingChange) onParentHoldingChange(value);
    setForm((prev) => ({ ...prev, parent: value }));
    const q = new URLSearchParams();
    if (value) q.set('parent', value);
    fetch(`/api/ip?${q.toString()}`)
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

  const handleAutoFill = (fields) => {
    const extracted = applyExtracted(fields);
    setForm((prev) => ({ ...prev, ...extracted }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    const parent = (form.parent || '').trim();
    const mark = (form.mark || '').trim();
    const jurisdiction = (form.jurisdiction || '').trim();
    if (!parent || !mark || !jurisdiction) return;
    sendFeedback({}, form);  // record any user edits as learning signal
    const payload = {
      ...(editingId ? { id: editingId } : {}),
      ...form,
      parent,
    };
    fetch('/api/ip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then(() => {
        const q = new URLSearchParams();
        if (parent) q.set('parent', parent);
        if (form.opco) q.set('opco', form.opco);
        const url = q.toString() ? `/api/ip?${q.toString()}` : '/api/ip';
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
      if (filterOpco && r.opco !== filterOpco) return false;
      if (filterStatus && filterStatus !== 'all' && r.status !== filterStatus) return false;
      return true;
    });
  }, [records, filterParent, filterOpco, filterStatus]);

  const stats = useMemo(() => {
    let total = 0;
    let active = 0;
    let pending = 0;
    let expired = 0;
    visibleRecords.forEach((r) => {
      total += 1;
      if (r.status === 'Active') active += 1;
      if (r.status === 'Pending') pending += 1;
      if (r.status === 'Expired') expired += 1;
    });
    return { total, active, pending, expired };
  }, [visibleRecords]);

  const isReadOnly = readOnlyIp;

  return (
    <div className="ip-section">
      <h2 className="ip-title">IP Management</h2>
      <p className="ip-intro">
        Register and track <strong>trademarks and other IP assets</strong> across jurisdictions. Monitor registration and
        renewal dates to avoid <strong>blind spots, missed renewals and mark loss</strong> as described in the legal-ops playbook.
      </p>

      <div className="ip-cards">
        <div className="ip-card">
          <span className="ip-card-label">Total marks</span>
          <span className="ip-card-value">{stats.total}</span>
        </div>
        <div className="ip-card">
          <span className="ip-card-label">Active</span>
          <span className="ip-card-value">{stats.active}</span>
        </div>
        <div className="ip-card">
          <span className="ip-card-label">Pending</span>
          <span className="ip-card-value">{stats.pending}</span>
        </div>
        <div className="ip-card">
          <span className="ip-card-label">Expired</span>
          <span className="ip-card-value">{stats.expired}</span>
        </div>
      </div>

      <div className="ip-filters">
        <div className="ip-filter-row">
          <label htmlFor="ip-parent-select">Parent Holding</label>
          <select
            id="ip-parent-select"
            className="ip-select"
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
        <div className="ip-filter-row">
          <label htmlFor="ip-status-select">Status</label>
          <select
            id="ip-status-select"
            className="ip-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All</option>
            <option value="Active">Active</option>
            <option value="Pending">Pending</option>
            <option value="Expired">Expired</option>
          </select>
        </div>
      </div>

      <form className="ip-form" onSubmit={handleSave}>
        <h3 className="ip-form-title">Add / update IP asset</h3>
        <DocumentAutoFill module="ip" fieldLabels={IP_FIELD_LABELS} onApply={handleAutoFill} compact />
        <div className="ip-form-grid">
          <div className="ip-field">
            <label>Parent Holding</label>
            <select
              className="ip-input"
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
          <div className="ip-field">
            <label>OpCo / Entity</label>
            <input
              className="ip-input"
              type="text"
              value={form.opco}
              onChange={(e) => handleFormChange('opco', e.target.value)}
              readOnly={isReadOnly}
            />
          </div>
          <div className="ip-field">
            <label>Mark / IP name</label>
            <input
              className="ip-input"
              type="text"
              value={form.mark}
              onChange={(e) => handleFormChange('mark', e.target.value)}
              required
            />
          </div>
          <div className="ip-field">
            <label>Class / Type</label>
            <input
              className="ip-input"
              type="text"
              value={form.class}
              onChange={(e) => handleFormChange('class', e.target.value)}
              placeholder="Nice class, patent type, etc."
            />
          </div>
          <div className="ip-field">
            <label>Jurisdiction</label>
            <input
              className="ip-input"
              type="text"
              value={form.jurisdiction}
              onChange={(e) => handleFormChange('jurisdiction', e.target.value)}
              required
            />
          </div>
          <div className="ip-field">
            <label>Registration no.</label>
            <input
              className="ip-input"
              type="text"
              value={form.registrationNo}
              onChange={(e) => handleFormChange('registrationNo', e.target.value)}
            />
          </div>
          <div className="ip-field">
            <label>Filing date</label>
            <input
              className="ip-input"
              type="date"
              value={form.filingDate}
              onChange={(e) => handleFormChange('filingDate', e.target.value)}
            />
          </div>
          <div className="ip-field">
            <label>Registration date</label>
            <input
              className="ip-input"
              type="date"
              value={form.registrationDate}
              onChange={(e) => handleFormChange('registrationDate', e.target.value)}
            />
          </div>
          <div className="ip-field">
            <label>Renewal date</label>
            <input
              className="ip-input"
              type="date"
              value={form.renewalDate}
              onChange={(e) => handleFormChange('renewalDate', e.target.value)}
            />
          </div>
          <div className="ip-field">
            <label>Status</label>
            <select
              className="ip-input"
              value={form.status}
              onChange={(e) => handleFormChange('status', e.target.value)}
            >
              <option value="Active">Active</option>
              <option value="Pending">Pending</option>
              <option value="Expired">Expired</option>
            </select>
          </div>
          <div className="ip-field">
            <label>External agent</label>
            <input
              className="ip-input"
              type="text"
              value={form.agent}
              onChange={(e) => handleFormChange('agent', e.target.value)}
              placeholder="Agent firm, contact"
            />
          </div>
          <div className="ip-field ip-field-wide">
            <label>Notes</label>
            <textarea
              className="ip-input"
              rows={2}
              value={form.notes}
              onChange={(e) => handleFormChange('notes', e.target.value)}
              placeholder="Usage, opposition, proof-of-use deadlines, etc."
            />
          </div>
        </div>
        <div className="ip-form-actions">
          <button type="submit" className="ip-btn-primary" disabled={isReadOnly}>
            {editingId ? 'Update IP' : 'Save IP'}
          </button>
          <button
            type="button"
            className={`ip-btn-secondary ${form.parent && form.opco ? 'ip-btn-secondary-enabled' : ''}`}
            disabled={!form.parent || !form.opco}
            onClick={() => {
              const parent = (form.parent || '').trim();
              const opco = (form.opco || '').trim();
              if (!parent || !opco) return;
              setFilterParent(parent);
              setFilterOpco(opco);
              setFilterStatus('all');
              const q = new URLSearchParams();
              q.set('parent', parent);
              q.set('opco', opco);
              fetch(`/api/ip?${q.toString()}`)
                .then((r) => r.json())
                .then((data) => setRecords(Array.isArray(data) ? data : []))
                .catch(() => {});
            }}
          >
            Load IP
          </button>
        </div>
      </form>

      <section className="ip-list-section">
        <h3 className="ip-list-title">IP portfolio register</h3>
        {visibleRecords.length === 0 ? (
          <p className="ip-empty">No IP assets captured yet for the selected filters.</p>
        ) : (
          <div className="ip-table-wrap">
            <table className="ip-table">
              <thead>
                <tr>
                  <th>Parent</th>
                  <th>OpCo</th>
                  <th>Mark</th>
                  <th>Class</th>
                  <th>Jurisdiction</th>
                  <th>Reg. no.</th>
                  <th>Status</th>
                  <th>Renewal date</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => {
                      const isExpired = r.status === 'Expired';
                      setEditingId(r.id);
                      setReadOnlyIp(isExpired);
                      setForm({
                        parent: r.parent || '',
                        opco: r.opco || '',
                        mark: r.mark || '',
                        class: r.class || '',
                        jurisdiction: r.jurisdiction || '',
                        registrationNo: r.registrationNo || '',
                        filingDate: r.filingDate || '',
                        registrationDate: r.registrationDate || '',
                        renewalDate: r.renewalDate || '',
                        status: r.status || 'Active',
                        agent: r.agent || '',
                        notes: r.notes || '',
                      });
                    }}
                  >
                    <td>{r.parent}</td>
                    <td>{r.opco || '—'}</td>
                    <td>{r.mark}</td>
                    <td>{r.class || '—'}</td>
                    <td>{r.jurisdiction}</td>
                    <td>{r.registrationNo || '—'}</td>
                    <td>{r.status || '—'}</td>
                    <td>{r.renewalDate || '—'}</td>
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

