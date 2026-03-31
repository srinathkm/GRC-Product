import { useEffect, useMemo, useState } from 'react';
import './DependencyIntelligence.css';

const API = '/api/dependency-intelligence';

function currency(value) {
  return `AED ${Number(value || 0).toLocaleString()}`;
}

export function DependencyIntelligence({ onNavigateToView }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);
  const [clusters, setClusters] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [severity, setSeverity] = useState('');
  const [includeAi, setIncludeAi] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        if (severity) params.set('severity', severity);
        if (includeAi) params.set('includeAi', 'true');
        const [sRes, cRes] = await Promise.all([
          fetch(`${API}/summary?${params.toString()}`),
          fetch(`${API}/clusters?${params.toString()}`),
        ]);
        const sJson = await sRes.json();
        const cJson = await cRes.json();
        if (!sRes.ok) throw new Error(sJson?.error || 'Failed to load summary');
        if (!cRes.ok) throw new Error(cJson?.error || 'Failed to load clusters');
        if (!mounted) return;
        setSummary(sJson);
        setClusters(Array.isArray(cJson.items) ? cJson.items : []);
        if (!selectedId && cJson.items?.[0]?.id) setSelectedId(cJson.items[0].id);
      } catch (e) {
        if (mounted) setError(e.message || 'Unknown error');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [severity, includeAi, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedCluster(null);
      return;
    }
    let mounted = true;
    async function loadDetail() {
      try {
        const params = new URLSearchParams();
        if (includeAi) params.set('includeAi', 'true');
        const r = await fetch(`${API}/${encodeURIComponent(selectedId)}?${params.toString()}`);
        const json = await r.json();
        if (!r.ok) throw new Error(json?.error || 'Failed to load cluster detail');
        if (mounted) setSelectedCluster(json.item);
      } catch (e) {
        if (mounted) setError(e.message || 'Unknown error');
      }
    }
    loadDetail();
    return () => { mounted = false; };
  }, [selectedId, includeAi]);

  const clusterRows = useMemo(() => {
    return [...clusters].sort((a, b) => (b.impactScore || 0) - (a.impactScore || 0));
  }, [clusters]);

  if (loading) return <div className="dep-wrap"><div className="dep-note">Loading dependency intelligence...</div></div>;
  if (error) return <div className="dep-wrap"><div className="dep-error">Error: {error}</div></div>;

  return (
    <div className="dep-wrap">
      <div className="dep-header">
        <div>
          <h2 className="dep-title">Dependency Intelligence</h2>
          <p className="dep-subtitle">Deterministic lineage and score explainability across legal, compliance, data, and litigation operations.</p>
        </div>
        <div className="dep-actions">
          <select className="dep-select" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <label className="dep-ai-toggle">
            <input type="checkbox" checked={includeAi} onChange={(e) => setIncludeAi(e.target.checked)} />
            AI enrichment
          </label>
          <button type="button" className="btn btn-secondary" onClick={() => onNavigateToView?.('mgmt-dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </div>

      <div className="dep-kpis">
        <div className="dep-kpi"><span>Total clusters</span><strong>{summary?.totalClusters || 0}</strong></div>
        <div className="dep-kpi"><span>Critical</span><strong>{summary?.criticalClusters || 0}</strong></div>
        <div className="dep-kpi"><span>High</span><strong>{summary?.highClusters || 0}</strong></div>
        <div className="dep-kpi"><span>Total exposure</span><strong>{currency(summary?.totalExposureAed)}</strong></div>
      </div>

      <div className="dep-grid">
        <div className="dep-panel">
          <h3 className="dep-panel-title">Impact Clusters</h3>
          {clusterRows.length === 0 ? (
            <div className="dep-note">No clusters match the current filters.</div>
          ) : (
            <div className="dep-list">
              {clusterRows.map((row) => (
                <button
                  type="button"
                  key={row.id}
                  className={`dep-item ${selectedId === row.id ? 'active' : ''}`}
                  onClick={() => setSelectedId(row.id)}
                >
                  <div className="dep-item-top">
                    <span>{row.opco}</span>
                    <span className={`dep-sev sev-${String(row.severity || '').toLowerCase()}`}>{row.severity}</span>
                  </div>
                  <div className="dep-item-sub">
                    Score {row.impactScore} · {row.unresolvedCount} unresolved · {currency(row.exposureAed)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="dep-panel">
          <h3 className="dep-panel-title">Evidence Drill-down</h3>
          {!selectedCluster ? (
            <div className="dep-note">Select a cluster to view detail.</div>
          ) : (
            <div className="dep-detail">
              <p><strong>{selectedCluster.opco}</strong> ({selectedCluster.parent}) · Owner: {selectedCluster.legalOwner}</p>
              <p>Impact score: {selectedCluster.impactScore} · Severity: {selectedCluster.severity} · Exposure: {currency(selectedCluster.exposureAed)}</p>
              <p>AI status: {selectedCluster.aiStatus}</p>

              <h4>Top Frameworks</h4>
              <ul>
                {(selectedCluster.topFrameworks || []).map((f) => (
                  <li key={f.framework}>{f.framework} ({f.count})</li>
                ))}
              </ul>

              <h4>Dependencies</h4>
              <ul>
                {(selectedCluster.dependencies || []).map((d) => (
                  <li key={d.id}>
                    [{d.type}] {d.title} · {d.status} · {d.severity}
                  </li>
                ))}
              </ul>

              <h4>Explainability Trace</h4>
              <pre className="dep-trace">{JSON.stringify(selectedCluster.trace, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
