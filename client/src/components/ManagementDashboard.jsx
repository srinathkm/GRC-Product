import { useEffect, useState, useCallback } from 'react';
import './ManagementDashboard.css';

const API = '/api';

// ── helpers ──────────────────────────────────────────────────────────────────

function daysChipClass(daysLeft) {
  if (daysLeft <= 7) return 'mgmt-days-chip-critical';
  if (daysLeft <= 30) return 'mgmt-days-chip-warning';
  return 'mgmt-days-chip-healthy';
}

function heatClass(count, max) {
  if (!max) return 'mgmt-heat-medium';
  const ratio = count / max;
  if (ratio >= 0.75) return 'mgmt-heat-critical';
  if (ratio >= 0.5) return 'mgmt-heat-warning';
  if (ratio >= 0.25) return 'mgmt-heat-medium';
  return 'mgmt-heat-healthy';
}

function typeClass(type) {
  if (type === 'POA') return 'mgmt-expiry-type-poa';
  if (type === 'Licence') return 'mgmt-expiry-type-licence';
  if (type === 'Contract') return 'mgmt-expiry-type-contract';
  return 'mgmt-expiry-type-default';
}

function healthTone(score) {
  if (score < 40) return { tone: 'critical', label: 'Critical' };
  if (score < 65) return { tone: 'warning', label: 'Developing' };
  if (score < 80) return { tone: 'medium', label: 'Compliant' };
  return { tone: 'healthy', label: 'Healthy' };
}

function kpiAccentClass(accentColor) {
  const map = {
    '#3b82f6': 'mgmt-kpi-accent-blue',
    '#ef4444': 'mgmt-kpi-accent-red',
    '#22c55e': 'mgmt-kpi-accent-green',
    '#eab308': 'mgmt-kpi-accent-yellow',
    '#8b5cf6': 'mgmt-kpi-accent-violet',
    '#a78bfa': 'mgmt-kpi-accent-purple',
    '#60a5fa': 'mgmt-kpi-accent-sky',
    '#fbbf24': 'mgmt-kpi-accent-amber',
    '#94a3b8': 'mgmt-kpi-accent-slate',
    '#34d399': 'mgmt-kpi-accent-emerald',
  };
  return map[accentColor] || 'mgmt-kpi-accent-default';
}

function handleKeyboardActivate(event, callback) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    callback();
  }
}

// ── Health score gauge (SVG semicircle) ──────────────────────────────────────
function HealthGauge({ score }) {
  const r = 36;
  const cx = 44;
  const cy = 46;
  const circ = Math.PI * r;
  const dash = circ * (score / 100);
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  const { tone, label } = healthTone(score);

  return (
    <div className={`mgmt-health-arc-wrap mgmt-health-tone-${tone}`}>
      <svg width="88" height="56" viewBox="0 0 88 56" className="mgmt-health-svg">
        <path d={arc} fill="none" className="mgmt-health-track" strokeWidth="8" strokeLinecap="round" />
        <path d={arc} fill="none" stroke="var(--health-color)" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`} className="mgmt-health-progress" />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="18" fontWeight="800"
          fontFamily="var(--font-mono),monospace" fill="var(--health-color)" className="mgmt-health-score">{score}</text>
      </svg>
      <div className="mgmt-health-label">{label}</div>
    </div>
  );
}

// ── KPI tile ────────────────────────────────────────────────────────────────
function KpiTile({ icon, value, label, sub, accentColor, onClick, navHint = 'View →' }) {
  return (
    <button
      type="button"
      className={`mgmt-kpi-tile ${kpiAccentClass(accentColor)}`}
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
    return <p className="mgmt-empty-note">No changes recorded in this period.</p>;
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
          onKeyDown={(e) => handleKeyboardActivate(e, () => onNavigate('governance-framework'))}
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
          className={`mgmt-opco-cell ${heatClass(changeCount, max)}`}
          onClick={() => onNavigate('org-dashboard')}
          title={`${opco}: ${changeCount} regulatory changes — click to view dashboard`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => handleKeyboardActivate(e, () => onNavigate('org-dashboard'))}
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
          const typeBadgeClass = typeClass(row.type);
          const chipClass = daysChipClass(row.daysLeft);
          return (
            <tr
              key={i}
              className="mgmt-expiry-row"
              onClick={() => onNavigate(row.module)}
              title={`Go to ${row.module}`}
            >
              <td>
                <span className={`mgmt-expiry-type-badge ${typeBadgeClass}`}>
                  {row.type}
                </span>
              </td>
              <td className="mgmt-expiry-name" title={row.name}>{row.name}</td>
              <td className="mgmt-expiry-opco" title={row.opco}>{row.opco}</td>
              <td className="mgmt-expiry-date">{row.expiryDate}</td>
              <td>
                <span className={`mgmt-days-chip ${chipClass}`}>{row.daysLeft}d</span>
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
export function ManagementDashboard({ onNavigateToView }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(30);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOpco, setSelectedOpco] = useState('');
  const [opcoList, setOpcoList] = useState([]);

  // Load OpCo list once on mount
  useEffect(() => {
    fetch(`${API}/companies/roles`)
      .then((r) => r.json())
      .then((json) => {
        const names = (json.opcos || []).map((o) => (typeof o === 'string' ? o : o.name || o)).filter(Boolean).sort();
        setOpcoList(names);
      })
      .catch(() => {});
  }, []);

  const load = useCallback((d, opco, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    const params = new URLSearchParams({ days: d });
    if (opco) params.set('opco', opco);
    fetch(`${API}/dashboard/summary?${params}`)
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

  const navigate = (view) => {
    if (onNavigateToView) onNavigateToView(view);
  };

  if (loading) return <div className="mgmt-dash"><div className="mgmt-dash-loading">Loading dashboard…</div></div>;
  if (error)   return <div className="mgmt-dash"><div className="mgmt-dash-error">Error: {error}</div></div>;
  if (!data)   return null;

  const { entities, regulatoryChanges, poa, licences, contracts, litigations, ip,
          upcomingExpiry, topOpcoAlerts, feedStatus, complianceHealthScore, generatedAt, intelligence = {} } = data;

  const lineageImpacts = Array.isArray(intelligence.lineageImpacts) ? intelligence.lineageImpacts : [];
  const dataComplianceInsights = Array.isArray(intelligence.dataComplianceInsights) ? intelligence.dataComplianceInsights : [];
  const litigationObligationInsights = Array.isArray(intelligence.litigationObligationInsights) ? intelligence.litigationObligationInsights : [];
  const documentationGaps = Array.isArray(intelligence.documentationGaps) ? intelligence.documentationGaps : [];

  const totalExpiring = (poa.expiringSoon || 0) + (licences.expiringSoon || 0) + (contracts.expiringSoon || 0);
  const totalExpired  = (poa.expired || 0) + (licences.expired || 0) + (contracts.expired || 0);

  return (
    <div className="mgmt-dash">
      {/* ── HEADER ── */}
      <div className="mgmt-dash-header">
        <div>
          <h2 className="mgmt-dash-title">Management Dashboard</h2>
          <div className="mgmt-dash-subtitle">
            {selectedOpco
              ? <>Viewing <strong>{selectedOpco}</strong> · {entities.totalParents} parent{entities.totalParents !== 1 ? 's' : ''}</>
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
          <select
            className="mgmt-dash-period-select"
            value={selectedOpco}
            onChange={(e) => setSelectedOpco(e.target.value)}
            aria-label="Select OpCo"
          >
            <option value="">All OpCos</option>
            {opcoList.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
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
            className="btn btn-secondary mgmt-refresh-btn"
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
          <div className={`mgmt-kpi-tile health-score ${complianceHealthScore >= 80 ? 'mgmt-kpi-accent-green' : complianceHealthScore >= 60 ? 'mgmt-kpi-accent-blue' : 'mgmt-kpi-accent-red'}`}>
            <HealthGauge score={complianceHealthScore} />
            <div className="mgmt-kpi-label mgmt-kpi-label-centered">Compliance Health</div>
            <div className="mgmt-kpi-sub mgmt-kpi-sub-centered">{selectedOpco ? selectedOpco : 'Portfolio-wide score'}</div>
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

          <KpiTile
            icon="🏢"
            value={selectedOpco ? selectedOpco : entities.totalOpcos}
            label="Active Entities"
            sub={selectedOpco ? `Under ${entities.totalParents} parent holding${entities.totalParents !== 1 ? 's' : ''}` : `${entities.totalParents} parent holdings`}
            accentColor="#8b5cf6"
            onClick={() => navigate('org-overview')}
          />
        </div>
      </div>

      {/* ── SECONDARY KPIs (legal operations) ── */}
      <div>
        <p className="mgmt-dash-section-title">Legal Operations Overview</p>
        <div className="mgmt-dash-kpi-row">
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
          <p className="mgmt-heatmap-caption">
            Colour intensity = regulatory change exposure. Click any cell for entity details.
          </p>
          <OpcoHeatMap topOpcoAlerts={topOpcoAlerts} onNavigate={navigate} />
        </div>
      </div>

      {/* ── BOTTOM ROW ── */}
      <div className="mgmt-dash-bottom-row">
        {/* Expiry tracker */}
        <div className="mgmt-panel">
          <div className="mgmt-panel-header">
            <span className="mgmt-panel-title">Upcoming Expirations <span className="mgmt-panel-title-sub">(next 60 days)</span></span>
            {totalExpired > 0 && (
              <span className="mgmt-expired-count">
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

      {/* ── INTELLIGENCE PANELS ── */}
      <div>
        <p className="mgmt-dash-section-title">Real-time Compliance Intelligence</p>
        <div className="mgmt-intel-grid">
          <div className="mgmt-panel">
            <div className="mgmt-panel-header">
              <span className="mgmt-panel-title">Framework Lineage Impact Tree</span>
            </div>
            {lineageImpacts.length === 0 ? (
              <p className="mgmt-opco-empty">No active lineage impacts detected.</p>
            ) : (
              <div className="mgmt-intel-list">
                {lineageImpacts.slice(0, 6).map((row, idx) => (
                  <div key={`${row.opco}-${idx}`} className="mgmt-intel-item">
                    <div className="mgmt-intel-item-title">{row.opco} · Owner: {row.legalOwner}</div>
                    <div className="mgmt-intel-item-sub">
                      POAs expiring: {row.expiringPoaCount} · Soonest: {row.soonestPoaExpiry || '—'} · Impact score: {row.impactScore}
                    </div>
                    <div className="mgmt-intel-chips">
                      {(row.frameworksImpacted || []).slice(0, 4).map((fw) => (
                        <span key={fw.framework} className="mgmt-intel-chip">{fw.framework} ({fw.count})</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mgmt-panel">
            <div className="mgmt-panel-header">
              <span className="mgmt-panel-title">Data Compliance Insights (AI Cross-Border)</span>
            </div>
            {dataComplianceInsights.length === 0 ? (
              <p className="mgmt-opco-empty">No cross-border AI data transfer risks detected.</p>
            ) : (
              <div className="mgmt-intel-list">
                {dataComplianceInsights.slice(0, 6).map((row, idx) => (
                  <div key={`${row.opco}-${row.model}-${idx}`} className="mgmt-intel-item">
                    <div className="mgmt-intel-item-title">{row.opco} · {row.model} · {row.hostRegion}</div>
                    <div className="mgmt-intel-item-sub">{row.risk}</div>
                    <div className="mgmt-intel-item-sub">Regulation: {row.regulation} · Severity: {row.severity}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mgmt-panel">
            <div className="mgmt-panel-header">
              <span className="mgmt-panel-title">Litigation Contractual/IP Impact</span>
            </div>
            {litigationObligationInsights.length === 0 ? (
              <p className="mgmt-opco-empty">No litigation linked to contractual/IP obligations.</p>
            ) : (
              <div className="mgmt-intel-list">
                {litigationObligationInsights.slice(0, 6).map((row, idx) => (
                  <div key={`${row.caseId}-${idx}`} className="mgmt-intel-item">
                    <div className="mgmt-intel-item-title">Case {row.caseId} · {row.opco} · {row.commercialImpact} impact</div>
                    <div className="mgmt-intel-item-sub">Contracts: {row.relatedContracts.length} · IP assets: {row.relatedIpAssets.length}</div>
                    <div className="mgmt-intel-item-sub">Estimated exposure: AED {Number(row.financialExposure || 0).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mgmt-panel">
            <div className="mgmt-panel-header">
              <span className="mgmt-panel-title">Incomplete Documentation Alerts</span>
            </div>
            {documentationGaps.length === 0 ? (
              <p className="mgmt-opco-empty">No critical documentation gaps found.</p>
            ) : (
              <div className="mgmt-intel-list">
                {documentationGaps.slice(0, 8).map((row, idx) => (
                  <div key={`${row.module}-${row.recordId}-${idx}`} className="mgmt-intel-item">
                    <div className="mgmt-intel-item-title">{row.module} · {row.recordId} · {row.criticality}</div>
                    <div className="mgmt-intel-item-sub">{row.opco} · Missing: {(row.missingItems || []).join(', ')}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
