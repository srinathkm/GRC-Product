import { useState, useEffect } from 'react';

const API = '/api';
const ALL_VALUE = '';

export function RbacSelector({ selectedParent, selectedOpCo, onParentChange, onOpCoChange }) {
  const [parents, setParents] = useState([]);
  const [allOpcos, setAllOpcos] = useState([]);
  const [opcosForParent, setOpcosForParent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [opcoListLoading, setOpcoListLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/companies/roles`)
      .then((r) => r.json())
      .then((data) => {
        setParents(data.parents || []);
        setAllOpcos(data.opcos || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedParent || selectedParent === ALL_VALUE) {
      setOpcosForParent([]);
      return;
    }
    setOpcosForParent([]);
    onOpCoChange?.(ALL_VALUE);
    setOpcoListLoading(true);
    fetch(`${API}/companies/by-parent?parent=${encodeURIComponent(selectedParent)}`)
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data.opcos) ? data.opcos : [];
        const names = [...new Set(list.map((o) => (o && o.name) || o).filter(Boolean))].sort();
        setOpcosForParent(names);
      })
      .catch(() => setOpcosForParent([]))
      .finally(() => setOpcoListLoading(false));
  }, [selectedParent]);

  // OpCo list only when a parent is selected: "All" is limited to OpCos under that parent.
  const opcoOptions = selectedParent && selectedParent !== ALL_VALUE ? opcosForParent : [];

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
            disabled={opcoListLoading && !!selectedParent}
          >
            <option value={ALL_VALUE}>All</option>
            {(selectedParent && selectedParent !== ALL_VALUE && opcosForParent.length === 0 && !opcoListLoading
              ? []
              : opcoOptions
            ).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          {opcoListLoading && selectedParent && <span className="rbac-loading-inline">Loading…</span>}
        </div>
      </div>
    </div>
  );
}
