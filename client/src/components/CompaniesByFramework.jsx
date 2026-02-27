import { useState, useEffect } from 'react';

const API = '/api';

export function CompaniesByFramework({ framework, selectedParentHolding }) {
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!framework) {
      setParents([]);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`${API}/companies?framework=${encodeURIComponent(framework)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setParents(Array.isArray(data.parents) ? data.parents : []);
      })
      .catch((e) => {
        setError(e.message);
        setParents([]);
      })
      .finally(() => setLoading(false));
  }, [framework]);

  if (!framework) return null;

  const filteredParents = selectedParentHolding
    ? parents.filter((item) => item.parent === selectedParentHolding)
    : [];

  return (
    <section className="companies-section">
      <h3 className="companies-section-title">Companies & entities under {framework}</h3>
      {!selectedParentHolding && (
        <p className="companies-empty">Select a Parent Holding in the Parent Holding Overview to see its OpCos for this framework.</p>
      )}
      {selectedParentHolding && loading && <p className="companies-loading">Loading…</p>}
      {selectedParentHolding && error && <p className="companies-error">Error: {error}</p>}
      {selectedParentHolding && !loading && !error && filteredParents.length === 0 && (
        <p className="companies-empty">No OpCos found for the selected Parent Holding in this framework.</p>
      )}
      {selectedParentHolding && !loading && !error && filteredParents.length > 0 && (
        <div className="companies-by-parent">
          {filteredParents.map((item, i) => (
            <div key={i} className="companies-parent-block">
              <h4 className="companies-parent-name">{item.parent}</h4>
              <ul className="companies-list">
                {(item.companies || []).map((name, j) => (
                  <li key={j} className="companies-list-item">
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
