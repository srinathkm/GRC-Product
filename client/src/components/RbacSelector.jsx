import { useState, useEffect } from 'react';

const API = '/api';
const ALL_VALUE = '';

export function RbacSelector({ selectedParent, selectedOpCo, onParentChange, onOpCoChange }) {
  const [parents, setParents] = useState([]);
  const [opcos, setOpcos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/companies/roles`)
      .then((r) => r.json())
      .then((data) => {
        setParents(data.parents || []);
        setOpcos(data.opcos || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rbac-section">
        <span className="rbac-loading">Loading roles…</span>
      </div>
    );
  }

  return (
    <div className="rbac-section">
      <div className="rbac-dropdowns">
        <div className="rbac-dropdown-wrap">
          <label htmlFor="rbac-parent">Parent Holding</label>
          <select
            id="rbac-parent"
            className="rbac-select"
            value={selectedParent}
            onChange={(e) => onParentChange(e.target.value)}
          >
            <option value={ALL_VALUE}>All</option>
            {parents.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="rbac-dropdown-wrap">
          <label htmlFor="rbac-opco">OpCo</label>
          <select
            id="rbac-opco"
            className="rbac-select"
            value={selectedOpCo}
            onChange={(e) => onOpCoChange(e.target.value)}
          >
            <option value={ALL_VALUE}>All</option>
            {opcos.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
