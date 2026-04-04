/**
 * Phase B: saved scenarios list, save, load, delete, compare two assessments.
 */
import { useState, useEffect, useCallback } from 'react';

export function MaScenarioPanel({
  apiBase,
  parentGroup,
  target,
  dealStructure,
  synergyAnnual,
  regulatedTarget,
  currentResult,
  onLoadScenario,
  onNotify,
}) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [compareIdA, setCompareIdA] = useState('');
  const [compareIdB, setCompareIdB] = useState('');
  const [compareResult, setCompareResult] = useState(null);

  const refresh = useCallback(async () => {
    if (!parentGroup?.trim()) {
      setList([]);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`${apiBase}/ma/scenarios?parentGroup=${encodeURIComponent(parentGroup.trim())}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'List failed');
      setList(data.scenarios || []);
    } catch (e) {
      onNotify?.(e.message || 'Could not load scenarios');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [apiBase, parentGroup, onNotify]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveScenario = async () => {
    const name = saveName.trim();
    if (!name || !parentGroup?.trim() || !target?.trim() || !currentResult) {
      onNotify?.('Enter a scenario name and generate an assessment first.');
      return;
    }
    const body = {
      parentGroup: parentGroup.trim(),
      name,
      target: target.trim(),
      dealStructure: dealStructure || undefined,
      synergyAnnualAed: synergyAnnual?.trim() ? Number(synergyAnnual) : undefined,
      regulatedTarget: !!regulatedTarget,
      reportId: currentResult.reportId,
      assessmentSnapshot: {
        ...currentResult,
        parentGroup: parentGroup.trim(),
        target: target.trim(),
      },
    };
    try {
      const r = await fetch(`${apiBase}/ma/scenarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Save failed');
      setSaveName('');
      onNotify?.('Scenario saved.');
      await refresh();
    } catch (e) {
      onNotify?.(e.message || 'Save failed');
    }
  };

  const loadScenario = async (id) => {
    if (!parentGroup?.trim()) return;
    try {
      const r = await fetch(
        `${apiBase}/ma/scenarios/${encodeURIComponent(id)}?parentGroup=${encodeURIComponent(parentGroup.trim())}`,
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Load failed');
      onLoadScenario?.(data);
    } catch (e) {
      onNotify?.(e.message || 'Load failed');
    }
  };

  const deleteScenario = async (id) => {
    if (!parentGroup?.trim() || !window.confirm('Delete this saved scenario?')) return;
    try {
      const r = await fetch(
        `${apiBase}/ma/scenarios/${encodeURIComponent(id)}?parentGroup=${encodeURIComponent(parentGroup.trim())}`,
        { method: 'DELETE' },
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Delete failed');
      onNotify?.('Scenario deleted.');
      setCompareResult(null);
      await refresh();
    } catch (e) {
      onNotify?.(e.message || 'Delete failed');
    }
  };

  const runCompare = async () => {
    if (!parentGroup?.trim() || !compareIdA || !compareIdB || compareIdA === compareIdB) {
      onNotify?.('Select two different scenarios to compare.');
      return;
    }
    try {
      const q = new URLSearchParams({
        parentGroup: parentGroup.trim(),
        id1: compareIdA,
        id2: compareIdB,
      });
      const r = await fetch(`${apiBase}/ma/scenarios/compare?${q}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Compare failed');
      setCompareResult(data);
    } catch (e) {
      onNotify?.(e.message || 'Compare failed');
    }
  };

  if (!parentGroup?.trim()) return null;

  return (
    <div className="analysis-ma-card analysis-ma-card--full">
      <h5 className="analysis-ma-card-title">Saved scenarios</h5>
      <p className="analysis-ma-card-desc">
        Persist assessments under this parent group for audit and side-by-side comparison (server-stored JSON).
      </p>

      <div className="analysis-ma-scenario-save">
        <label htmlFor="ma-scenario-name" className="analysis-ma-scenario-label">Scenario name</label>
        <input
          id="ma-scenario-name"
          type="text"
          className="analysis-select"
          style={{ maxWidth: '20rem' }}
          placeholder="e.g. Base case Q1"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
        />
        <button
          type="button"
          className="analysis-btn analysis-btn-secondary"
          onClick={saveScenario}
          disabled={!currentResult || !saveName.trim() || !target?.trim()}
        >
          Save current assessment
        </button>
      </div>

      {loading ? (
        <p className="analysis-ma-card-note">Loading…</p>
      ) : list.length === 0 ? (
        <p className="analysis-ma-card-note">No saved scenarios for this parent group yet.</p>
      ) : (
        <div className="analysis-ma-timelines-wrap">
          <table className="analysis-ma-timelines-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Target</th>
                <th>One-time (AED)</th>
                <th>Annual (AED)</th>
                <th>Weeks</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.target}</td>
                  <td>{row.totalOneTimeAED != null ? row.totalOneTimeAED.toLocaleString() : '—'}</td>
                  <td>{row.totalAnnualAED != null ? row.totalAnnualAED.toLocaleString() : '—'}</td>
                  <td>{row.totalWeeks ?? '—'}</td>
                  <td>{row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '—'}</td>
                  <td>
                    <button type="button" className="analysis-btn analysis-btn-secondary analysis-btn--sm" onClick={() => loadScenario(row.id)}>
                      Load
                    </button>
                    {' '}
                    <button type="button" className="analysis-btn analysis-btn-secondary analysis-btn--sm" onClick={() => deleteScenario(row.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="analysis-ma-compare">
        <h6 className="analysis-ma-compare-title">Compare two scenarios</h6>
        <div className="analysis-ma-compare-row">
          <select
            className="analysis-select"
            value={compareIdA}
            onChange={(e) => setCompareIdA(e.target.value)}
            aria-label="First scenario"
          >
            <option value="">Scenario A…</option>
            {list.map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </select>
          <select
            className="analysis-select"
            value={compareIdB}
            onChange={(e) => setCompareIdB(e.target.value)}
            aria-label="Second scenario"
          >
            <option value="">Scenario B…</option>
            {list.map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </select>
          <button type="button" className="analysis-btn analysis-btn-primary" onClick={runCompare} disabled={list.length < 2}>
            Compare
          </button>
        </div>
      </div>

      {compareResult && (
        <div className="analysis-ma-compare-result">
          <h6 className="analysis-ma-compare-title">Comparison</h6>
          <p className="analysis-ma-meta">
            <strong>{compareResult.scenarioA?.name}</strong> vs <strong>{compareResult.scenarioB?.name}</strong>
          </p>
          {compareResult.diff && (
            <div className="analysis-ma-timelines-wrap">
              <table className="analysis-ma-timelines-table">
                <tbody>
                  <tr>
                    <th scope="row">One-time total (AED)</th>
                    <td>{compareResult.diff.financial?.totalOneTimeAED_A ?? '—'} vs {compareResult.diff.financial?.totalOneTimeAED_B ?? '—'}</td>
                    <td>Δ {compareResult.diff.financial?.totalOneTimeDelta?.toLocaleString?.() ?? compareResult.diff.financial?.totalOneTimeDelta}</td>
                  </tr>
                  <tr>
                    <th scope="row">Annual run-rate (AED)</th>
                    <td>{compareResult.diff.financial?.totalAnnualAED_A ?? '—'} vs {compareResult.diff.financial?.totalAnnualAED_B ?? '—'}</td>
                    <td>Δ {compareResult.diff.financial?.totalAnnualDelta?.toLocaleString?.() ?? compareResult.diff.financial?.totalAnnualDelta}</td>
                  </tr>
                  <tr>
                    <th scope="row">Integration weeks</th>
                    <td>{compareResult.diff.timeline?.totalWeeks_A ?? '—'} vs {compareResult.diff.timeline?.totalWeeks_B ?? '—'}</td>
                    <td>Δ {compareResult.diff.timeline?.weeksDelta}</td>
                  </tr>
                  <tr>
                    <th scope="row">Frameworks (only A / only B)</th>
                    <td colSpan={2}>
                      {(compareResult.diff.frameworks?.onlyInA || []).join(', ') || '—'}
                      {' / '}
                      {(compareResult.diff.frameworks?.onlyInB || []).join(', ') || '—'}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Risk rows</th>
                    <td colSpan={2}>{compareResult.diff.risks?.countA} vs {compareResult.diff.risks?.countB}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
