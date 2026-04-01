import { useEffect, useState, useCallback } from 'react';
import './ManagementDashboard.css';

const API = '/api';

// ── Monochrome SVG icons (enterprise chrome — no emoji) ───────────────────
function IconSvg({ children, className = 'mgmt-icon' }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
function IconDocument() {
  return (
    <IconSvg>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </IconSvg>
  );
}
function IconAlertTriangle() {
  return (
    <IconSvg>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </IconSvg>
  );
}
function IconCalendar() {
  return (
    <IconSvg>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </IconSvg>
  );
}
function IconBuilding() {
  return (
    <IconSvg>
      <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
      <line x1="9" y1="9" x2="9" y2="9.01" /><line x1="9" y1="12" x2="9" y2="12.01" /><line x1="9" y1="15" x2="9" y2="15.01" />
    </IconSvg>
  );
}
function IconScroll() {
  return (
    <IconSvg>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </IconSvg>
  );
}
function IconBadge() {
  return (
    <IconSvg>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 8h10M7 12h6" />
    </IconSvg>
  );
}
function IconFolder() {
  return (
    <IconSvg>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </IconSvg>
  );
}
function IconScale() {
  return (
    <IconSvg>
      <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" />
    </IconSvg>
  );
}
function IconIp() {
  return (
    <IconSvg>
      <circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </IconSvg>
  );
}
// ── helpers ──────────────────────────────────────────────────────────────────

function daysChipClass(daysLeft) {
  if (daysLeft <= 7) return 'mgmt-days-chip-critical';
  if (daysLeft <= 30) return 'mgmt-days-chip-warning';
  return 'mgmt-days-chip-healthy';
}

function heatClass(count, max) {
  if (!max) return 'mgmt-heat-low';
  const ratio = count / max;
  if (ratio >= 0.75) return 'mgmt-heat-high';
  if (ratio >= 0.5) return 'mgmt-heat-elevated';
  if (ratio >= 0.25) return 'mgmt-heat-moderate';
  return 'mgmt-heat-low';
}

function typeClass(type) {
  if (type === 'POA') return 'mgmt-expiry-type-poa';
  if (type === 'Licence') return 'mgmt-expiry-type-licence';
  if (type === 'Contract') return 'mgmt-expiry-type-contract';
  return 'mgmt-expiry-type-default';
}

function healthTone(score) {
  if (score < 40) return { tone: 'critical', label: 'Critical posture' };
  if (score < 65) return { tone: 'warning', label: 'Developing posture' };
  if (score < 80) return { tone: 'medium', label: 'Compliant posture' };
  return { tone: 'healthy', label: 'Healthy posture' };
}

function kpiVariantFromFlags({ critical, expiring, highRisk }) {
  if (critical > 0 || highRisk > 0) return 'risk';
  if (expiring > 0) return 'attention';
  return 'neutral';
}

function handleKeyboardActivate(event, callback) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    callback();
  }
}

function severityClass(severity = '') {
  const value = String(severity || '').toLowerCase();
  if (value === 'critical') return 'mgmt-sev-critical';
  if (value === 'high') return 'mgmt-sev-high';
  if (value === 'medium') return 'mgmt-sev-medium';
  return 'mgmt-sev-low';
}

// ── Health score: compact bar + label (readable in reduced motion) ─────────
function HealthSummary({ score }) {
  const { tone, label } = healthTone(score);
  return (
    <div className={`mgmt-health-summary mgmt-health-summary--${tone}`}>
      <div className="mgmt-health-summary-top">
        <span className="mgmt-health-score-num">{score}</span>
        <span className="mgmt-health-score-label">Compliance health index</span>
      </div>
      <div className="mgmt-health-bar-track" aria-hidden="true">
        <div className="mgmt-health-bar-fill" style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
      </div>
      <p className="mgmt-health-status-text">{label}</p>
    </div>
  );
}

// ── KPI tile: neutral surface; semantic left border via variant only ────────
function KpiTile({
  icon,
  value,
  label,
  sub,
  variant = 'neutral',
  onClick,
  navHint = 'Open',
}) {
  return (
    <button
      type="button"
      className={`mgmt-kpi-tile mgmt-kpi-tile--${variant}`}
      onClick={onClick}
    >
      {icon && <span className="mgmt-kpi-icon">{icon}</span>}
      <div className="mgmt-kpi-value">{value}</div>
      <div className="mgmt-kpi-label">{label}</div>
      {sub && <div className="mgmt-kpi-sub">{sub}</div>}
      <span className="mgmt-kpi-nav-hint">{navHint}</span>
    </button>
  );
}

function StatStripItem({ icon, value, label, sub, onClick }) {
  return (
    <button type="button" className="mgmt-stat-strip-item" onClick={onClick}>
      {icon && <span className="mgmt-stat-strip-icon" aria-hidden="true">{icon}</span>}
      <span className="mgmt-stat-strip-value">{value}</span>
      <span className="mgmt-stat-strip-label">{label}</span>
      {sub && <span className="mgmt-stat-strip-sub">{sub}</span>}
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
          title={`${framework}: ${count} changes — open governance`}
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
          onClick={() => onNavigate('org-dashboard', { selectedOpco: opco })}
          title={`${opco}: ${changeCount} regulatory changes — open org dashboard`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => handleKeyboardActivate(e, () => onNavigate('org-dashboard', { selectedOpco: opco }))}
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
    <div className="mgmt-table-scroll">
      <table className="mgmt-expiry-table">
        <thead>
          <tr>
            <th scope="col">Type</th>
            <th scope="col">Name</th>
            <th scope="col">OpCo</th>
            <th scope="col">Expiry</th>
            <th scope="col">Days left</th>
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
                onClick={() => onNavigate(row.module, { selectedOpco: row.opco, selectedParentHolding: row.parent })}
                title={`Open ${row.module}`}
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
    </div>
  );
}

function AttentionDriversTable({ drivers, onNavigate }) {
  if (!drivers.length) {
    return <p className="mgmt-opco-empty">No significant negative drivers recorded.</p>;
  }
  return (
    <div className="mgmt-table-scroll">
      <table className="mgmt-attention-table">
        <thead>
          <tr>
            <th scope="col">Driver</th>
            <th scope="col">Impact</th>
            <th scope="col">Review</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map((d) => (
            <tr key={d.factor}>
              <td>{d.factor}</td>
              <td className="mgmt-td-num">{d.impact}</td>
              <td>
                <button type="button" className="mgmt-table-action" onClick={() => onNavigate('dependency-intelligence')}>
                  Dependency intelligence
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClusterTable({ clusters, onNavigate }) {
  if (!clusters.length) {
    return <p className="mgmt-opco-empty">No clusters in the selected scope.</p>;
  }
  return (
    <div className="mgmt-table-scroll">
      <table className="mgmt-attention-table">
        <thead>
          <tr>
            <th scope="col">OpCo</th>
            <th scope="col">Severity</th>
            <th scope="col">Unresolved</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {clusters.map((c) => (
            <tr key={c.id}>
              <td title={c.opco}>{c.opco}</td>
              <td><span className={`mgmt-sev-badge ${severityClass(c.severity)}`}>{c.severity}</span></td>
              <td className="mgmt-td-num">{c.unresolvedCount}</td>
              <td>
                <button type="button" className="mgmt-table-action" onClick={() => onNavigate('dependency-intelligence')}>
                  Open
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DataComplianceCommandPane({ detail, onNavigate, selectedOpco, selectedParentHolding }) {
  if (!detail) {
    return null;
  }
  const topDrivers = Array.isArray(detail.riskDrivers) ? detail.riskDrivers.slice(0, 6) : [];
  const remediation = Array.isArray(detail.remediationQueue) ? detail.remediationQueue.slice(0, 6) : [];
  const coverage = detail.sourceCoverage || {};

  return (
    <section className="mgmt-panel mgmt-band-panel" aria-labelledby="mgmt-dc-heading">
      <div className="mgmt-panel-header">
        <h3 id="mgmt-dc-heading" className="mgmt-panel-title">Data compliance posture</h3>
        <button
          type="button"
          className="mgmt-panel-link"
          onClick={() => onNavigate('data-security', { selectedOpco, selectedParentHolding })}
        >
          Open data security module
        </button>
      </div>
      <div className="mgmt-dc-kpi-row">
        <div className="mgmt-dc-kpi">
          <div className="mgmt-dc-kpi-label">Score</div>
          <div className="mgmt-dc-kpi-value">{detail.overallScore ?? 0}</div>
          <div className="mgmt-dc-kpi-sub">{detail.band || 'unknown'}</div>
        </div>
        <div className="mgmt-dc-kpi">
          <div className="mgmt-dc-kpi-label">Confidence</div>
          <div className="mgmt-dc-kpi-value">{detail.confidence ?? 0}%</div>
          <div className="mgmt-dc-kpi-sub">{detail.reliability || 'low'} reliability</div>
        </div>
        <div className="mgmt-dc-kpi">
          <div className="mgmt-dc-kpi-label">Coverage</div>
          <div className="mgmt-dc-kpi-value">{Math.round((coverage.ratio || 0) * 100)}%</div>
          <div className="mgmt-dc-kpi-sub">{coverage.trusted ? 'trusted' : 'untrusted'}</div>
        </div>
        <div className="mgmt-dc-kpi">
          <div className="mgmt-dc-kpi-label">Escalations</div>
          <div className="mgmt-dc-kpi-value">{detail.governance?.escalationRequired || 0}</div>
          <div className="mgmt-dc-kpi-sub">critical overdue</div>
        </div>
      </div>
      <div className="mgmt-dc-grid">
        <div>
          <h4 className="mgmt-subsection-title">Risk drivers</h4>
          <div className="mgmt-table-scroll">
            {topDrivers.length === 0 ? (
              <p className="mgmt-opco-empty">No high-impact data drivers detected.</p>
            ) : (
              <table className="mgmt-attention-table">
                <thead>
                  <tr>
                    <th scope="col">Factor</th>
                    <th scope="col">Severity</th>
                    <th scope="col">Impact</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {topDrivers.map((driver) => (
                    <tr key={`${driver.factor}-${driver.severity}`}>
                      <td>{driver.factor}</td>
                      <td><span className={`mgmt-sev-badge ${severityClass(driver.severity)}`}>{driver.severity}</span></td>
                      <td className="mgmt-td-num">{driver.impact}</td>
                      <td>
                        <button type="button" className="mgmt-table-action" onClick={() => onNavigate('data-sovereignty', { selectedOpco })}>
                          Data sovereignty
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <div>
          <h4 className="mgmt-subsection-title">Remediation queue</h4>
          <div className="mgmt-table-scroll">
            {remediation.length === 0 ? (
              <p className="mgmt-opco-empty">No remediation actions are open.</p>
            ) : (
              <table className="mgmt-attention-table">
                <thead>
                  <tr>
                    <th scope="col">OpCo</th>
                    <th scope="col">Owner</th>
                    <th scope="col">Due</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {remediation.map((item) => (
                    <tr key={item.id}>
                      <td title={item.opco}>{item.opco}</td>
                      <td>{item.owner}</td>
                      <td>{item.dueDate || '—'}</td>
                      <td>
                        <button type="button" className="mgmt-table-action" onClick={() => onNavigate('task-tracker', { selectedOpco, selectedParentHolding })}>
                          Task tracker
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function ManagementDashboard({
  onNavigateToView,
  selectedDays,
  selectedOpco,
  onSelectedDaysChange,
  onSelectedOpcoChange,
  selectedParentHolding = '',
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [opcoList, setOpcoList] = useState([]);

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

  useEffect(() => { load(selectedDays, selectedOpco); }, [selectedDays, selectedOpco, load]);

  const handleRefresh = () => load(selectedDays, selectedOpco, true);

  const navigate = (view, extra = {}) => {
    if (!onNavigateToView) return;
    onNavigateToView(view, {
      selectedOpco,
      selectedDays,
      selectedParentHolding,
      ...extra,
    });
  };

  if (loading) return <div className="mgmt-dash"><div className="mgmt-dash-loading">Loading dashboard…</div></div>;
  if (error)   return <div className="mgmt-dash"><div className="mgmt-dash-error">Error: {error}</div></div>;
  if (!data)   return null;

  const { entities, regulatoryChanges, poa, licences, contracts, litigations, ip,
          upcomingExpiry, topOpcoAlerts, feedStatus, complianceHealthScore, complianceHealthDetail = null, generatedAt, intelligence = {}, dependencyIntelligence = {}, dataComplianceDetail = null } = data;

  const lineageImpacts = Array.isArray(intelligence.lineageImpacts) ? intelligence.lineageImpacts : [];
  const dataComplianceInsights = Array.isArray(intelligence.dataComplianceInsights) ? intelligence.dataComplianceInsights : [];
  const litigationObligationInsights = Array.isArray(intelligence.litigationObligationInsights) ? intelligence.litigationObligationInsights : [];
  const documentationGaps = Array.isArray(intelligence.documentationGaps) ? intelligence.documentationGaps : [];

  const totalExpiring = (poa.expiringSoon || 0) + (licences.expiringSoon || 0) + (contracts.expiringSoon || 0);
  const totalExpired  = (poa.expired || 0) + (licences.expired || 0) + (contracts.expired || 0);
  const topNegativeDrivers = Array.isArray(complianceHealthDetail?.topNegativeDrivers)
    ? complianceHealthDetail.topNegativeDrivers
    : [];

  const healthVariant = complianceHealthScore < 40 ? 'risk' : complianceHealthScore < 65 ? 'attention' : 'neutral';
  const topClusters = (dependencyIntelligence.topClusters || []).slice(0, 5);

  return (
    <main className="mgmt-dash" id="management-dashboard-main" role="main" aria-label="Management compliance dashboard">
      <header className="mgmt-dash-header">
        <div>
          <h1 className="mgmt-dash-title">Management dashboard</h1>
          <p className="mgmt-dash-subtitle">
            {selectedOpco
              ? <>Scope: <strong>{selectedOpco}</strong> · {entities.totalParents} parent holding{entities.totalParents !== 1 ? 's' : ''}</>
              : <>Portfolio view · {entities.totalParents} parent holding{entities.totalParents !== 1 ? 's' : ''} · {entities.totalOpcos} OpCos</>
            }
          </p>
        </div>
        <div className="mgmt-dash-header-right">
          {feedStatus?.lastRun && (
            <span className="mgmt-dash-feed-badge">
              Regulatory feed {new Date(feedStatus.lastRun).toLocaleDateString()}
            </span>
          )}
          <span className="mgmt-dash-last-updated">
            Snapshot <time dateTime={generatedAt || undefined}>{generatedAt ? new Date(generatedAt).toLocaleString() : '—'}</time>
          </span>
          <select
            className="mgmt-dash-period-select"
            value={selectedOpco}
            onChange={(e) => onSelectedOpcoChange?.(e.target.value)}
            aria-label="Filter by operating company"
          >
            <option value="">All OpCos</option>
            {opcoList.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <select
            className="mgmt-dash-period-select"
            value={selectedDays}
            onChange={(e) => onSelectedDaysChange?.(Number(e.target.value))}
            aria-label="Regulatory change period"
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
            {refreshing ? 'Refreshing…' : 'Refresh data'}
          </button>
        </div>
      </header>

      {/* Band 1 — Executive summary */}
      <section className="mgmt-band" aria-labelledby="mgmt-exec-heading">
        <h2 id="mgmt-exec-heading" className="mgmt-band-title">Executive summary</h2>
        <p className="mgmt-band-lead">Posture and the few metrics that frame regulatory and legal pressure for this scope.</p>
        <div className="mgmt-dash-kpi-row mgmt-dash-kpi-row--exec">
          <div className={`mgmt-kpi-health-card mgmt-kpi-tile--${healthVariant}`}>
            <HealthSummary score={complianceHealthScore} />
            <div className="mgmt-kpi-label mgmt-kpi-label-centered">Compliance health</div>
            <div className="mgmt-kpi-sub mgmt-kpi-sub-centered">{selectedOpco || 'Whole portfolio'}</div>
          </div>

          <KpiTile
            icon={<IconDocument />}
            value={regulatoryChanges.total}
            label="Regulatory changes"
            sub={`${regulatoryChanges.critical} critical deadlines in window`}
            variant="neutral"
            onClick={() => navigate('governance-framework')}
          />

          <KpiTile
            icon={<IconAlertTriangle />}
            value={regulatoryChanges.critical}
            label="Critical deadlines"
            sub={`≤90 days · ${regulatoryChanges.overdue} overdue`}
            variant={kpiVariantFromFlags({ critical: regulatoryChanges.critical, expiring: 0, highRisk: regulatoryChanges.overdue })}
            onClick={() => navigate('governance-framework')}
          />

          <KpiTile
            icon={<IconCalendar />}
            value={totalExpiring}
            label="Expiring soon (60d)"
            sub="POA, licences, contracts"
            variant={kpiVariantFromFlags({ critical: 0, expiring: totalExpiring, highRisk: 0 })}
            onClick={() => navigate('poa-management')}
          />

          <KpiTile
            icon={<IconBuilding />}
            value={selectedOpco ? selectedOpco : entities.totalOpcos}
            label={selectedOpco ? 'Selected OpCo' : 'Active OpCos'}
            sub={selectedOpco ? `${entities.totalParents} parent context` : `${entities.totalParents} parent holdings`}
            variant="neutral"
            onClick={() => navigate('org-overview')}
          />
        </div>
      </section>

      {/* Band 2 — Requires attention */}
      <section className="mgmt-band" aria-labelledby="mgmt-attention-heading">
        <h2 id="mgmt-attention-heading" className="mgmt-band-title">Requires attention</h2>
        <p className="mgmt-band-lead">Drivers behind the health score, legal register load, and dependency exposure.</p>

        {complianceHealthDetail && (
          <div className="mgmt-panel mgmt-band-panel">
            <div className="mgmt-panel-header">
              <h3 className="mgmt-panel-title">Score drivers</h3>
              <span className={`mgmt-health-confidence mgmt-health-confidence-${complianceHealthDetail.reliability || 'low'}`}>
                Model confidence {complianceHealthDetail.confidence ?? 0}% ({complianceHealthDetail.reliability || 'low'})
              </span>
            </div>
            <AttentionDriversTable drivers={topNegativeDrivers} onNavigate={navigate} />
          </div>
        )}

        <div className="mgmt-panel mgmt-band-panel">
          <h3 className="mgmt-panel-title">Legal registers</h3>
          <p className="mgmt-band-lead mgmt-band-lead--inline">Active volume by register — open the module to act.</p>
          <div className="mgmt-stat-strip" role="group" aria-label="Legal register counts">
            <StatStripItem icon={<IconScroll />} value={poa.total} label="POAs" sub={`${poa.expiringSoon} expiring · ${poa.expired} expired`} onClick={() => navigate('poa-management')} />
            <StatStripItem icon={<IconBadge />} value={licences.total} label="Licences" sub={`${licences.expiringSoon} expiring`} onClick={() => navigate('licence-management')} />
            <StatStripItem icon={<IconFolder />} value={contracts.total} label="Contracts" sub={`${contracts.expiringSoon} expiring`} onClick={() => navigate('contracts-management')} />
            <StatStripItem icon={<IconScale />} value={litigations.total} label="Litigations" sub={`${litigations.highRisk} high risk`} onClick={() => navigate('litigations-management')} />
            <StatStripItem icon={<IconIp />} value={ip.total} label="IP assets" sub="Registered" onClick={() => navigate('ip-management')} />
          </div>
        </div>

        <div className="mgmt-panel mgmt-band-panel">
          <div className="mgmt-panel-header">
            <h3 className="mgmt-panel-title">Dependency exposure</h3>
            <button type="button" className="mgmt-panel-link" onClick={() => navigate('dependency-intelligence')}>Open dependency intelligence</button>
          </div>
          <div className="mgmt-dep-summary-row">
            <div className="mgmt-dep-metric">
              <span className="mgmt-dep-metric-label">Clusters</span>
              <span className="mgmt-dep-metric-value">{dependencyIntelligence.totalClusters || 0}</span>
              <span className="mgmt-dep-metric-sub">{dependencyIntelligence.criticalClusters || 0} critical · {dependencyIntelligence.highClusters || 0} high</span>
            </div>
            <div className="mgmt-dep-metric">
              <span className="mgmt-dep-metric-label">Estimated exposure (AED)</span>
              <span className="mgmt-dep-metric-value">{Number(dependencyIntelligence.totalExposureAed || 0).toLocaleString()}</span>
              <span className="mgmt-dep-metric-sub">Litigation and contractual linkage</span>
            </div>
          </div>
          <ClusterTable clusters={topClusters} onNavigate={navigate} />
        </div>
      </section>

      {/* Band 3 — Portfolio activity */}
      <section className="mgmt-band" aria-labelledby="mgmt-activity-heading">
        <h2 id="mgmt-activity-heading" className="mgmt-band-title">Portfolio activity</h2>
        <p className="mgmt-band-lead">Where regulatory change volume concentrates by framework and by OpCo.</p>
        <div className="mgmt-dash-mid-row">
          <div className="mgmt-panel">
            <div className="mgmt-panel-header">
              <h3 className="mgmt-panel-title">Regulatory activity by framework</h3>
              <button type="button" className="mgmt-panel-link" onClick={() => navigate('governance-framework')}>Governance framework</button>
            </div>
            <FrameworkBars topFrameworks={regulatoryChanges.topFrameworks} onNavigate={navigate} />
          </div>
          <div className="mgmt-panel">
            <div className="mgmt-panel-header">
              <h3 className="mgmt-panel-title">OpCo exposure</h3>
              <button type="button" className="mgmt-panel-link" onClick={() => navigate('org-dashboard')}>Org dashboard</button>
            </div>
            <p className="mgmt-heatmap-caption">Shading indicates relative change count in the selected period. Select a cell to open that OpCo.</p>
            <OpcoHeatMap topOpcoAlerts={topOpcoAlerts} onNavigate={navigate} />
          </div>
        </div>
      </section>

      {/* Band 4 — Registers & expiries */}
      <section className="mgmt-band" aria-labelledby="mgmt-expiry-heading">
        <h2 id="mgmt-expiry-heading" className="mgmt-band-title">Upcoming expirations</h2>
        <p className="mgmt-band-lead">Next 60 days across POA, licences, and contracts. {totalExpired > 0 && <span className="mgmt-expired-inline">{totalExpired} item(s) already expired — resolve in the legal modules.</span>}</p>
        <div className="mgmt-panel mgmt-band-panel">
          <ExpiryTable upcomingExpiry={upcomingExpiry} onNavigate={navigate} />
        </div>
      </section>

      <DataComplianceCommandPane
        detail={dataComplianceDetail}
        onNavigate={navigate}
        selectedOpco={selectedOpco}
        selectedParentHolding={selectedParentHolding}
      />

      {/* Band 5 — Deeper intelligence (progressive disclosure) */}
      <details className="mgmt-deep-intel">
        <summary className="mgmt-deep-intel-summary">Additional intelligence signals</summary>
        <p className="mgmt-band-lead">Lineage, cross-border AI risk, litigation linkage, and documentation gaps. Open when you need operational depth.</p>
        <div className="mgmt-intel-grid">
          <div className="mgmt-panel">
            <h3 className="mgmt-panel-title">Framework lineage impact</h3>
            {lineageImpacts.length === 0 ? (
              <p className="mgmt-opco-empty">No active lineage impacts detected.</p>
            ) : (
              <ul className="mgmt-intel-plain-list">
                {lineageImpacts.slice(0, 6).map((row, idx) => (
                  <li key={`${row.opco}-${idx}`}>
                    <strong>{row.opco}</strong> · Owner {row.legalOwner}
                    <span className="mgmt-intel-plain-meta">POAs expiring {row.expiringPoaCount} · Soonest {row.soonestPoaExpiry || '—'} · Impact {row.impactScore}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mgmt-panel">
            <h3 className="mgmt-panel-title">Cross-border data / AI</h3>
            {dataComplianceInsights.length === 0 ? (
              <p className="mgmt-opco-empty">No cross-border transfer risks flagged.</p>
            ) : (
              <ul className="mgmt-intel-plain-list">
                {dataComplianceInsights.slice(0, 6).map((row, idx) => (
                  <li key={`${row.opco}-${idx}`}>
                    <button type="button" className="mgmt-intel-link" onClick={() => navigate('data-security', { selectedOpco: row.opco })}>
                      {row.opco} · {row.model} ({row.hostRegion})
                    </button>
                    <span className="mgmt-intel-plain-meta">{row.risk} · {row.regulation} · {row.severity}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mgmt-panel">
            <h3 className="mgmt-panel-title">Litigation and IP / contract linkage</h3>
            {litigationObligationInsights.length === 0 ? (
              <p className="mgmt-opco-empty">No linked litigation obligations.</p>
            ) : (
              <ul className="mgmt-intel-plain-list">
                {litigationObligationInsights.slice(0, 6).map((row, idx) => (
                  <li key={`${row.caseId}-${idx}`}>
                    <strong>Case {row.caseId}</strong> · {row.opco} · {row.commercialImpact} impact
                    <span className="mgmt-intel-plain-meta">Contracts {row.relatedContracts.length} · IP {row.relatedIpAssets.length} · AED {Number(row.financialExposure || 0).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mgmt-panel">
            <h3 className="mgmt-panel-title">Documentation gaps</h3>
            {documentationGaps.length === 0 ? (
              <p className="mgmt-opco-empty">No critical documentation gaps.</p>
            ) : (
              <ul className="mgmt-intel-plain-list">
                {documentationGaps.slice(0, 8).map((row, idx) => (
                  <li key={`${row.module}-${row.recordId}-${idx}`}>
                    <strong>{row.module}</strong> · {row.recordId} · {row.criticality}
                    <span className="mgmt-intel-plain-meta">{row.opco} · Missing: {(row.missingItems || []).join(', ')}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </details>
    </main>
  );
}
