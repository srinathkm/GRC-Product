import { useEffect, useState, useCallback } from 'react';
import './ManagementDashboard.css';

const API = '/api';

// ── helpers ──────────────────────────────────────────────────────────────────

function daysChipStyle(daysLeft) {
  if (daysLeft <= 7)  return { background: 'rgba(239,68,68,0.18)',  color: '#ef4444', border: '1px solid #ef444444' };
  if (daysLeft <= 30) return { background: 'rgba(234,179,8,0.18)',  color: '#eab308', border: '1px solid #eab30844' };
  return               { background: 'rgba(34,197,94,0.13)',  color: '#22c55e', border: '1px solid #22c55e44' };
}

function heatColor(count, max) {
  if (!max) return 'rgba(59,130,246,0.15)';
  const ratio = count / max;
  if (ratio >= 0.75) return 'rgba(239,68,68,0.65)';
  if (ratio >= 0.5)  return 'rgba(234,179,8,0.55)';
  if (ratio >= 0.25) return 'rgba(59,130,246,0.45)';
  return 'rgba(34,197,94,0.30)';
}

function typeStyle(type) {
  const map = {
    POA:      { bg: 'rgba(139,92,246,0.18)', color: '#a78bfa' },
    Licence:  { bg: 'rgba(59,130,246,0.18)', color: '#60a5fa' },
    Contract: { bg: 'rgba(234,179,8,0.18)',  color: '#fbbf24' },
  };
  return map[type] || { bg: 'rgba(100,116,139,0.18)', color: '#94a3b8' };
}

// ── Health score gauge (SVG semicircle) ──────────────────────────────────────
function HealthGauge({ score }) {
  const r = 36;
  const cx = 44;
  const cy = 46;
  const circ = Math.PI * r;
  const dash = circ * (score / 100);
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  let color = '#22c55e';
  let label = 'Healthy';
  if (score < 40) { color = '#ef4444'; label = 'Critical'; }
  else if (score < 65) { color = '#eab308'; label = 'Developing'; }
  else if (score < 80) { color = '#3b82f6'; label = 'Compliant'; }

  return (
    <div className="mgmt-health-arc-wrap">
      <svg width="88" height="56" viewBox="0 0 88 56" style={{ overflow: 'visible' }}>
        <path d={arc} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" strokeLinecap="round" />
        <path d={arc} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`} style={{ transition: 'stroke-dasharray 0.8s ease' }} />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="18" fontWeight="800"
          fontFamily="var(--font-mono),monospace" fill={color}>{score}</text>
      </svg>
      <div style={{ fontSize: '0.7rem', color, fontWeight: 700, textAlign: 'center', marginTop: '-4px' }}>{label}</div>
    </div>
  );
}

// ── KPI tile ────────────────────────────────────────────────────────────────
function KpiTile({ icon, value, label, sub, accentColor, onClick, navHint = 'View →' }) {
  return (
    <button
      type="button"
      className="mgmt-kpi-tile"
      style={{ '--kpi-accent': accentColor, textAlign: 'left', border: 'none', width: '100%' }}
      onClick={onClick}
    >
      <span className="mgmt-kpi-icon">{icon}</span>
      <div className="mgmt-kpi-value">{value}</div>
      <div className="mgmt-kpi-label">{label}</div>
      {sub && <div className="mgmt-kpi-sub">{sub}</div>}
      <span className="mgmt-kpi-nav-hint">{navHint}</span>
    </button>
  );
}

// ── Framework bar chart ──────────────────────────────────────────────────────
function FrameworkBars({ topFrameworks, onNavigate }) {
  if (!topFrameworks || topFrameworks.length === 0) {
    return <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No changes recorded in this period.</p>;
  }
  const max = topFrameworks[0]?.count || 1;
  return (
    <div className="mgmt-fw-bars">
      {topFrameworks.map(({ framework, count }) => (
        <div
          key={framework}
          className="mgmt-fw-bar-row"
          onClick={() => onNavigate('governance-framework')}
          title={`${framework}: ${count} changes — click to view`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onNavigate('governance-framework')}
        >
          <span className="mgmt-fw-bar-label" title={framework}>{framework}</span>
          <div className="mgmt-fw-bar-track">
            <div className="mgmt-fw-bar-fill" style={{ width: `${(count / max) * 100}%` }} />
          </div>
          <span className="mgmt-fw-bar-count">{count}</span>
        </div>
      ))}
    </div>
  );
}

// ── OpCo heat map ────────────────────────────────────────────────────────────
function OpcoHeatMap({ topOpcoAlerts, onNavigate }) {
  if (!topOpcoAlerts || topOpcoAlerts.length === 0) {
    return <p className="mgmt-opco-empty">No OpCo alerts in this period.</p>;
  }
  const max = topOpcoAlerts[0]?.changeCount || 1;
  return (
    <div className="mgmt-opco-grid">
      {topOpcoAlerts.map(({ opco, changeCount }) => (
        <div
          key={opco}
          className="mgmt-opco-cell"
          style={{ background: heatColor(changeCount, max) }}
          onClick={() => onNavigate('org-dashboard')}
          title={`${opco}: ${changeCount} regulatory changes — click to view dashboard`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onNavigate('org-dashboard')}
        >
          <div className="mgmt-opco-cell-name" title={opco}>{opco}</div>
          <div className="mgmt-opco-cell-count">{changeCount}</div>
        </div>
      ))}
    </div>
  );
}

// ── Expiry tracker table ─────────────────────────────────────────────────────
function ExpiryTable({ upcomingExpiry, onNavigate }) {
  if (!upcomingExpiry || upcomingExpiry.length === 0) {
    return <p className="mgmt-expiry-empty">No upcoming expirations in next 60 days.</p>;
  }
  return (
    <table className="mgmt-expiry-table">
      <thead>
        <tr>
          <th>Type</th>
          <th>Name</th>
          <th>OpCo</th>
          <th>Expiry</th>
          <th>Days Left</th>
        </tr>
      </thead>
      <tbody>
        {upcomingExpiry.map((row, i) => {
          const ts = typeStyle(row.type);
          const dc = daysChipStyle(row.daysLeft);
          return (
            <tr
              key={i}
              className="mgmt-expiry-row"
              onClick={() => onNavigate(row.module)}
              title={`Go to ${row.module}`}
            >
              <td>
                <span
                  className="mgmt-expiry-type-badge"
                  style={{ background: ts.bg, color: ts.color }}
                >
                  {row.type}
                </span>
              </td>
              <td style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={row.name}>{row.name}</td>
              <td style={{ maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.7rem', color: 'var(--text-muted)' }}
                  title={row.opco}>{row.opco}</td>
              <td style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{row.expiryDate}</td>
              <td>
                <span className="mgmt-days-chip" style={dc}>{row.daysLeft}d</span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Quick actions ────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { icon: '🏢', label: 'Onboarding',          desc: 'Add new entities',               view: 'onboarding' },
  { icon: '📋', label: 'Governance Framework', desc: 'Review regulatory changes',      view: 'governance-framework' },
  { icon: '👁️', label: 'UBO Register',          desc: 'Beneficial ownership records',   view: 'ubo' },
  { icon: '📄', label: 'POA Management',        desc: 'Power of attorney tracking',     view: 'poa-management' },
  { icon: '⚖️', label: 'Litigations',           desc: 'Active cases overview',          view: 'litigations-management' },
  { icon: '🌱', label: 'ESG Summary',           desc: 'Maturity assessment',            view: 'esg' },
  { icon: '🛡️', label: 'Data Sovereignty',      desc: 'Localisation compliance',        view: 'data-sovereignty' },
  { icon: '📊', label: 'Risk Predictor',        desc: 'AI-driven risk analysis',        view: 'analysis' },
];

function QuickActions({ onNavigate }) {
  return (
    <div className="mgmt-quick-grid">
      {QUICK_ACTIONS.map(({ icon, label, desc, view }) => (
        <button
          key={view}
          type="button"
          className="mgmt-quick-tile"
          onClick={() => onNavigate(view)}
        >
          <span className="mgmt-quick-icon">{icon}</span>
          <div>
            <div className="mgmt-quick-label">{label}</div>
            <div className="mgmt-quick-desc">{desc}</div>
          </div>
          <span className="mgmt-quick-arrow">›</span>
        </button>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function ManagementDashboard({ onNavigateToView, selectedOpco = '', onOpcoChange }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(30);
  const [refreshing, setRefreshing] = useState(false);
  const [opcoList, setOpcoList] = useState([]);
  const [boardPackGenerating, setBoardPackGenerating] = useState(false);

  // Fetch available OpCos once on mount
  useEffect(() => {
    fetch(`${API}/companies/roles`)
      .then((r) => r.json())
      .then((json) => { if (Array.isArray(json.opcos)) setOpcoList(json.opcos); })
      .catch(() => {});
  }, []);

  const load = useCallback((d, opco, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    const url = opco
      ? `${API}/dashboard/summary?days=${d}&opco=${encodeURIComponent(opco)}`
      : `${API}/dashboard/summary?days=${d}`;
    fetch(url)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch((e) => setError(e.message))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { load(days, selectedOpco); }, [days, selectedOpco, load]);

  const handleRefresh = () => load(days, selectedOpco, true);

  const handleBoardPack = useCallback(async () => {
    if (boardPackGenerating) return;
    setBoardPackGenerating(true);
    try {
      const body = { periodDays: days };
      if (selectedOpco) body.opco = selectedOpco;
      if (data?.opcoFilter === null && !selectedOpco) body.parentHolding = '';
      const res = await fetch('/api/board-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match ? match[1] : 'Board_Compliance_Pack.pdf';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`Board Pack generation failed: ${e.message}`);
    } finally {
      setBoardPackGenerating(false);
    }
  }, [boardPackGenerating, days, selectedOpco, data]);

  const navigate = (view) => {
    if (onNavigateToView) onNavigateToView(view);
  };

  if (loading) return <div className="mgmt-dash"><div className="mgmt-dash-loading">Loading dashboard…</div></div>;
  if (error)   return <div className="mgmt-dash"><div className="mgmt-dash-error">Error: {error}</div></div>;
  if (!data)   return null;

  const { entities, regulatoryChanges, poa, licences, contracts, litigations, ip,
          upcomingExpiry, topOpcoAlerts, feedStatus, complianceHealthScore, generatedAt,
          opcoFrameworks } = data;

  const totalExpiring = (poa.expiringSoon || 0) + (licences.expiringSoon || 0) + (contracts.expiringSoon || 0);
  const totalExpired  = (poa.expired || 0) + (licences.expired || 0) + (contracts.expired || 0);

  // When a specific OpCo is selected, only show that OpCo in the heat map
  const filteredOpcoAlerts = selectedOpco
    ? topOpcoAlerts.filter((a) => a.opco.toLowerCase() === selectedOpco.toLowerCase())
    : topOpcoAlerts;

  return (
    <div className="mgmt-dash">
      {/* ── HEADER ── */}
      <div className="mgmt-dash-header">
        <div>
          <h2 className="mgmt-dash-title">Management Dashboard</h2>
          <div className="mgmt-dash-subtitle">
            {selectedOpco
              ? <><span style={{ color: 'var(--accent)', fontWeight: 600 }}>{selectedOpco}</span> · OpCo view</>
              : <>Cross-portfolio compliance intelligence · {entities.totalParents} parent{entities.totalParents !== 1 ? 's' : ''} · {entities.totalOpcos} OpCos</>
            }
          </div>
        </div>
        <div className="mgmt-dash-header-right">
          {feedStatus?.lastRun && (
            <span className="mgmt-dash-feed-badge">
              Feed: {new Date(feedStatus.lastRun).toLocaleDateString()}
            </span>
          )}
          <span className="mgmt-dash-last-updated">
            Updated {generatedAt ? new Date(generatedAt).toLocaleTimeString() : '—'}
          </span>
          {opcoList.length > 0 && (
            <select
              className="mgmt-dash-period-select"
              value={selectedOpco}
              onChange={(e) => onOpcoChange && onOpcoChange(e.target.value)}
              aria-label="Filter by OpCo"
              style={{ minWidth: '160px' }}
            >
              <option value="">All OpCos</option>
              {opcoList.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          )}
          <select
            className="mgmt-dash-period-select"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            aria-label="Select time period"
          >
            <option value={30}>Last 30 days</option>
            <option value={180}>Last 6 months</option>
            <option value={365}>Last 1 year</option>
          </select>
          <button
            type="button"
            className="btn btn-board-pack"
            onClick={handleBoardPack}
            disabled={boardPackGenerating}
            title={selectedOpco ? `Generate Board Pack for ${selectedOpco}` : 'Generate Board Compliance Pack for this period'}
          >
            {boardPackGenerating
              ? <><span className="bp-spinner" />Generating…</>
              : <><span className="bp-icon">📋</span>Board Pack</>
            }
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: '0.76rem', padding: '5px 12px' }}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ── KPI ROW ── */}
      <div>
        <p className="mgmt-dash-section-title">Key Performance Indicators</p>
        <div className="mgmt-dash-kpi-row">
          {/* Health score gauge */}
          <div className="mgmt-kpi-tile health-score" style={{ '--kpi-accent': complianceHealthScore >= 80 ? '#22c55e' : complianceHealthScore >= 60 ? '#3b82f6' : '#ef4444' }}>
            <HealthGauge score={complianceHealthScore} />
            <div className="mgmt-kpi-label" style={{ textAlign: 'center', marginTop: '0.2rem' }}>Compliance Health</div>
            <div className="mgmt-kpi-sub" style={{ textAlign: 'center' }}>{selectedOpco ? `${selectedOpco} score` : 'Portfolio-wide score'}</div>
          </div>

          <KpiTile
            icon="📋"
            value={regulatoryChanges.total}
            label="Regulatory Changes"
            sub={`${regulatoryChanges.critical} critical deadlines`}
            accentColor="#3b82f6"
            onClick={() => navigate('governance-framework')}
          />

          <KpiTile
            icon="⚠️"
            value={regulatoryChanges.critical}
            label="Critical Deadlines"
            sub={`≤90 days · ${regulatoryChanges.overdue} overdue`}
            accentColor={regulatoryChanges.critical > 0 ? '#ef4444' : '#22c55e'}
            onClick={() => navigate('governance-framework')}
          />

          <KpiTile
            icon="🔔"
            value={totalExpiring}
            label="Expiring Soon"
            sub={`POA · Licences · Contracts (60d)`}
            accentColor={totalExpiring > 0 ? '#eab308' : '#22c55e'}
            onClick={() => navigate('poa-management')}
          />

          {/* Active Entities tile: hidden when a specific OpCo is selected */}
          {!selectedOpco && (
            <KpiTile
              icon="🏢"
              value={entities.totalOpcos}
              label="Active Entities"
              sub={`${entities.totalParents} parent holdings`}
              accentColor="#8b5cf6"
              onClick={() => navigate('org-overview')}
            />
          )}

          {/* When an OpCo is selected, show overdue framework items instead */}
          {selectedOpco && (
            <KpiTile
              icon="⏰"
              value={regulatoryChanges.overdueFrameworks ?? regulatoryChanges.overdue}
              label="Overdue Framework Items"
              sub={`${regulatoryChanges.overdue} overdue change${regulatoryChanges.overdue !== 1 ? 's' : ''} across frameworks`}
              accentColor={regulatoryChanges.overdue > 0 ? '#ef4444' : '#22c55e'}
              onClick={() => navigate('governance-framework')}
            />
          )}
        </div>
      </div>

      {/* ── SECONDARY KPIs (legal operations) ── */}
      <div>
        <p className="mgmt-dash-section-title">Legal Operations Overview</p>
        <div className="mgmt-dash-kpi-row" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          <KpiTile icon="📜" value={poa.total} label="Active POAs"
            sub={`${poa.expiringSoon} expiring · ${poa.expired} expired`}
            accentColor="#a78bfa" onClick={() => navigate('poa-management')} />
          <KpiTile icon="🪪" value={licences.total} label="Active Licences"
            sub={`${licences.expiringSoon} expiring · ${licences.expired} expired`}
            accentColor="#60a5fa" onClick={() => navigate('licence-management')} />
          <KpiTile icon="📑" value={contracts.total} label="Active Contracts"
            sub={`${contracts.expiringSoon} expiring · ${contracts.expired} expired`}
            accentColor="#fbbf24" onClick={() => navigate('contracts-management')} />
          <KpiTile icon="⚖️" value={litigations.total} label="Active Litigations"
            sub={`${litigations.highRisk} high risk`}
            accentColor={litigations.highRisk > 0 ? '#ef4444' : '#94a3b8'}
            onClick={() => navigate('litigations-management')} />
          <KpiTile icon="💡" value={ip.total} label="IP Assets"
            sub="Registered &amp; active"
            accentColor="#34d399" onClick={() => navigate('ip-management')} />
        </div>
      </div>

      {/* ── MIDDLE ROW ── */}
      <div className="mgmt-dash-mid-row">
        {/* Framework activity bar chart */}
        <div className="mgmt-panel">
          <div className="mgmt-panel-header">
            <span className="mgmt-panel-title">Regulatory Activity by Framework</span>
            <button type="button" className="mgmt-panel-link" onClick={() => navigate('governance-framework')}>
              View all →
            </button>
          </div>
          <FrameworkBars topFrameworks={regulatoryChanges.topFrameworks} onNavigate={navigate} />
        </div>

        {/* OpCo heat map */}
        <div className="mgmt-panel">
          <div className="mgmt-panel-header">
            <span className="mgmt-panel-title">OpCo Exposure Heat Map</span>
            <button type="button" className="mgmt-panel-link" onClick={() => navigate('org-dashboard')}>
              View details →
            </button>
          </div>
          <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.6rem', marginTop: 0 }}>
            Colour intensity = regulatory change exposure. Click any cell for entity details.
          </p>
          <OpcoHeatMap topOpcoAlerts={filteredOpcoAlerts} onNavigate={navigate} />
        </div>
      </div>

      {/* ── BOTTOM ROW ── */}
      <div className="mgmt-dash-bottom-row">
        {/* Expiry tracker */}
        <div className="mgmt-panel">
          <div className="mgmt-panel-header">
            <span className="mgmt-panel-title">Upcoming Expirations <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.72rem' }}>(next 60 days)</span></span>
            {totalExpired > 0 && (
              <span style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 600 }}>
                {totalExpired} already expired
              </span>
            )}
          </div>
          <ExpiryTable upcomingExpiry={upcomingExpiry} onNavigate={navigate} />
        </div>

        {/* Quick navigate */}
        <div className="mgmt-panel">
          <div className="mgmt-panel-header">
            <span className="mgmt-panel-title">Quick Navigation</span>
          </div>
          <QuickActions onNavigate={navigate} />
        </div>
      </div>
    </div>
  );
}
