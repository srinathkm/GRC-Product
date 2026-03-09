import { useCallback, useEffect, useMemo, useState } from 'react';
import { t, formatNumber } from '../i18n';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const TABS = [
  { id: 'overview', labelKey: 'orgDashboardTabOverview' },
  { id: 'shortcomings', labelKey: 'orgDashboardTabShortcomings' },
  { id: 'entities', labelKey: 'orgDashboardTabEntities' },
];

function getBand(score) {
  if (score >= 90) return { label: 'Exemplary', color: '#059669', bg: '#d1fae5', border: '#6ee7b7' };
  if (score >= 75) return { label: 'Compliant', color: '#0284c7', bg: '#e0f2fe', border: '#7dd3fc' };
  if (score >= 50) return { label: 'Developing', color: '#d97706', bg: '#fef3c7', border: '#fcd34d' };
  if (score >= 25) return { label: 'Deficient', color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' };
  return { label: 'Critical', color: '#7c3aed', bg: '#ede9fe', border: '#c4b5fd' };
}

function healthPct(active, total) {
  if (!total) return 100;
  return Math.round((active / total) * 100);
}

function fmtAed(n) {
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `AED ${(n / 1_000).toFixed(0)}K`;
  return `AED ${n}`;
}

const SEVERITY_COLORS = { critical: '#dc2626', high: '#f97316', medium: '#eab308', low: '#64748b' };

function ScoreGauge({ score, size = 88 }) {
  const band = getBand(score);
  const r = size / 2 - 8;
  const circ = Math.PI * r;
  const dash = circ * (score / 100);
  const cx = size / 2;
  const cy = size / 2 + 4;
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  return (
    <svg width={size} height={size * 0.62} viewBox={`0 0 ${size} ${size * 0.62}`} style={{ overflow: 'visible', display: 'block' }}>
      <path d={arc} fill="none" stroke="#e2e8f0" strokeWidth="7" strokeLinecap="round" />
      <path d={arc} fill="none" stroke={band.color} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} style={{ transition: 'stroke-dasharray 0.8s ease' }} />
      <text x={cx} y={cy - 3} textAnchor="middle" fontSize={size * 0.26} fontWeight="800" fontFamily="var(--font-mono), monospace" fill={band.color}>{score}</text>
    </svg>
  );
}

function MetricTile({ value, label, sub, color, bg, icon, pulse }) {
  return (
    <div className="org-dash-metric-tile" style={{ background: bg || '#f8fafc', borderColor: `${color}33` }}>
      {pulse && <div className="org-dash-metric-pulse" style={{ background: color }} />}
      <div className="org-dash-metric-icon">{icon}</div>
      <div className="org-dash-metric-value" style={{ color }}>{value}</div>
      <div className="org-dash-metric-label">{label}</div>
      {sub && <div className="org-dash-metric-sub">{sub}</div>}
    </div>
  );
}

function IssueSeverityBar({ issues }) {
  const total = issues.critical + issues.high + issues.medium + issues.low;
  if (!total) return <span className="org-dash-issues-none">No open issues</span>;
  const segs = [
    { key: 'critical', label: 'Critical' },
    { key: 'high', label: 'High' },
    { key: 'medium', label: 'Medium' },
    { key: 'low', label: 'Low' },
  ].filter((s) => issues[s.key] > 0);
  return (
    <div className="org-dash-issue-bar">
      <div className="org-dash-issue-bar-track">
        {segs.map((s) => (
          <div key={s.key} className="org-dash-issue-bar-seg" style={{ flex: issues[s.key], background: SEVERITY_COLORS[s.key] }} />
        ))}
      </div>
      <div className="org-dash-issue-bar-legend">
        {segs.map((s) => (
          <div key={s.key} className="org-dash-issue-legend-item">
            <span className="org-dash-issue-dot" style={{ background: SEVERITY_COLORS[s.key] }} />
            <span>{issues[s.key]} {s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Pill({ count, label, color, bg, icon }) {
  if (!count) return null;
  return (
    <span className="org-dash-pill" style={{ background: bg, borderColor: `${color}33`, color }}>
      <span>{icon}</span> {count} <span className="org-dash-pill-label">{label}</span>
    </span>
  );
}

function OpCoCard({ opco, onSelect, language }) {
  const gcsBand = getBand(opco.gcs);
  const lohsBand = getBand(opco.lohs);
  const accent = opco.issues.critical > 0 ? '#dc2626' : opco.issues.high > 0 ? '#f97316' : '#0284c7';
  const pills = [
    { count: opco.poa.expired, label: 'POA expired', color: '#dc2626', bg: '#fee2e2', icon: 'POA' },
    { count: opco.poa.expiringSoon, label: 'POA expiring', color: '#f97316', bg: '#ffedd5', icon: 'EXP' },
    { count: opco.poa.broadScope, label: 'broad scope', color: '#d97706', bg: '#fef3c7', icon: 'BSC' },
    { count: opco.licences.expired, label: 'lic expired', color: '#dc2626', bg: '#fee2e2', icon: 'LIC' },
    { count: opco.documents.missing, label: 'docs missing', color: '#d97706', bg: '#fef3c7', icon: 'DOC' },
    { count: opco.officers.unassigned, label: 'unassigned', color: '#64748b', bg: '#f1f5f9', icon: 'OFC' },
  ];
  return (
    <div className="org-dash-opco-card" style={{ borderLeftColor: accent }} onClick={() => onSelect(opco)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(opco); } }}>
      <div className="org-dash-opco-card-main">
        <div className="org-dash-opco-card-info">
          <div className="org-dash-opco-name">{opco.name}</div>
          <div className="org-dash-opco-jurisdiction">{opco.jurisdiction}</div>
          <IssueSeverityBar issues={opco.issues} />
        </div>
        <div className="org-dash-opco-gauges">
          <div className="org-dash-opco-gauge-wrap">
            <ScoreGauge score={opco.gcs} size={72} />
            <div className="org-dash-opco-gauge-label" style={{ color: gcsBand.color }}>GCS</div>
          </div>
          <div className="org-dash-opco-gauge-wrap">
            <ScoreGauge score={opco.lohs} size={72} />
            <div className="org-dash-opco-gauge-label" style={{ color: lohsBand.color }}>LOHS</div>
          </div>
        </div>
        <div className="org-dash-opco-pills">
          {pills.map((p, i) => <Pill key={i} {...p} />)}
        </div>
        <div className="org-dash-opco-view">View detail →</div>
      </div>
    </div>
  );
}

const POA_LOAD_FILE_ID_KEY = 'poaLoadFileId';

function OpCoDetailDrawer({ opco, onClose, language, onNavigateToView }) {
  const openPoaWithFileId = (fileId) => {
    try {
      sessionStorage.setItem(POA_LOAD_FILE_ID_KEY, fileId);
    } catch (_) {}
    if (typeof onNavigateToView === 'function') onNavigateToView('poa-management');
  };
  const gcsBand = getBand(opco.gcs);
  const lohsBand = getBand(opco.lohs);
  const poaHealth = healthPct(opco.poa.active, opco.poa.total);
  const licHealth = healthPct(opco.licences.active, opco.licences.total);
  const healthColor = (pct) => (pct >= 80 ? '#0284c7' : pct >= 55 ? '#d97706' : '#dc2626');
  const domainItems = (items) => items.map((item, i) => (
    <div key={i} className="org-dash-drawer-domain-row">
      <span className="org-dash-drawer-domain-label">{item.label}</span>
      <span className="org-dash-drawer-domain-value" style={{ color: item.bad ? '#dc2626' : item.warn ? '#f97316' : 'var(--text-muted)' }}>{item.value}</span>
    </div>
  ));
  return (
    <div className="org-dash-drawer-backdrop" onClick={onClose}>
      <div className="org-dash-drawer-panel anim-slide-in" onClick={(e) => e.stopPropagation()}>
        <div className="org-dash-drawer-header">
          <div>
            <div className="org-dash-drawer-header-sub">Entity Detail</div>
            <div className="org-dash-drawer-header-title">{opco.name}</div>
            <div className="org-dash-drawer-header-meta">{opco.jurisdiction}</div>
          </div>
          <button type="button" className="org-dash-drawer-close" onClick={onClose}>×</button>
        </div>
        <div className="org-dash-drawer-scores">
          <div className="org-dash-drawer-score-box">
            <div className="org-dash-drawer-score-label">GCS - Regulatory</div>
            <ScoreGauge score={opco.gcs} size={78} />
            <div className="org-dash-drawer-score-band" style={{ color: gcsBand.color }}>{gcsBand.label}</div>
          </div>
          <div className="org-dash-drawer-score-box">
            <div className="org-dash-drawer-score-label">LOHS - Legal Ops</div>
            <ScoreGauge score={opco.lohs} size={78} />
            <div className="org-dash-drawer-score-band" style={{ color: lohsBand.color }}>{lohsBand.label}</div>
          </div>
          <div className="org-dash-drawer-score-box org-dash-drawer-issues-box">
            <div className="org-dash-drawer-score-label">Issue Severity</div>
            <IssueSeverityBar issues={opco.issues} />
          </div>
        </div>
        <div className="org-dash-drawer-body">
          <section className="org-dash-drawer-section">
            <div className="org-dash-drawer-section-title">Domain Health</div>
            <div className="org-dash-drawer-domains">
              <div className="org-dash-drawer-domain-tile">
                <div className="org-dash-drawer-domain-head">
                  <span>POA</span>
                  <span className="org-dash-drawer-domain-health" style={{ color: healthColor(poaHealth) }}>{poaHealth}%</span>
                </div>
                {domainItems([
                  { label: 'Active', value: opco.poa.active },
                  { label: 'Expiring', value: opco.poa.expiringSoon, warn: opco.poa.expiringSoon > 0 },
                  { label: 'Expired', value: opco.poa.expired, bad: opco.poa.expired > 0 },
                  { label: 'Broad Scope', value: opco.poa.broadScope, warn: opco.poa.broadScope > 0 },
                ])}
              </div>
              <div className="org-dash-drawer-domain-tile">
                <div className="org-dash-drawer-domain-head">
                  <span>Licences</span>
                  <span className="org-dash-drawer-domain-health" style={{ color: healthColor(licHealth) }}>{licHealth}%</span>
                </div>
                {domainItems([
                  { label: 'Active', value: opco.licences.active },
                  { label: 'Expiring', value: opco.licences.expiringSoon, warn: opco.licences.expiringSoon > 0 },
                  { label: 'Expired', value: opco.licences.expired, bad: opco.licences.expired > 0 },
                ])}
              </div>
            </div>
          </section>
          <section className="org-dash-drawer-section">
            <div className="org-dash-drawer-section-title">Top remediation actions</div>
            <div className="org-dash-drawer-remediation">
              {(() => {
                const rows = [];
                let rank = 0;
                if (opco.poa?.expired > 0) {
                  rank++;
                  const fileIds = opco.poa.expiredFileIds || [];
                  rows.push(
                    <div key="expired" className="org-dash-drawer-rem-row">
                      <span className="org-dash-drawer-rem-num">{rank}</span>
                      <span>Renew expired POAs — {opco.poa.expired} expired{fileIds.length > 0 && (
                        <span className="org-dash-drawer-rem-fileids"> File ID: {fileIds.map((fid) => (
                          <button key={fid} type="button" className="org-dash-drawer-fileid-link" onClick={() => openPoaWithFileId(fid)}>{fid}</button>
                        ))}</span>
                      )}</span>
                    </div>
                  );
                }
                if (opco.poa?.expiringSoon > 0) {
                  rank++;
                  const fileIds = opco.poa.expiringSoonFileIds || [];
                  rows.push(
                    <div key="expiring" className="org-dash-drawer-rem-row">
                      <span className="org-dash-drawer-rem-num">{rank}</span>
                      <span>Review POAs expiring within 30 days — {opco.poa.expiringSoon} expiring soon{fileIds.length > 0 && (
                        <span className="org-dash-drawer-rem-fileids"> File ID: {fileIds.map((fid) => (
                          <button key={fid} type="button" className="org-dash-drawer-fileid-link" onClick={() => openPoaWithFileId(fid)}>{fid}</button>
                        ))}</span>
                      )}</span>
                    </div>
                  );
                }
                if (opco.poa?.broadScope > 0) rows.push(<div key="broad" className="org-dash-drawer-rem-row"><span className="org-dash-drawer-rem-num">{++rank}</span><span>Review POAs with broad scope — {opco.poa.broadScope} need scope review</span></div>);
                if (opco.governanceOverdue > 0) rows.push(<div key="gov-overdue" className="org-dash-drawer-rem-row"><span className="org-dash-drawer-rem-num">{++rank}</span><span>Address overdue regulatory deadlines — {opco.governanceOverdue} overdue</span></div>);
                if (opco.governanceDueSoon > 0) rows.push(<div key="gov-soon" className="org-dash-drawer-rem-row"><span className="org-dash-drawer-rem-num">{++rank}</span><span>Address regulatory deadlines due within 30 days — {opco.governanceDueSoon} due soon</span></div>);
                if (opco.licences?.expired > 0) rows.push(<div key="lic" className="org-dash-drawer-rem-row"><span className="org-dash-drawer-rem-num">{++rank}</span><span>Renew expired licences — {opco.licences.expired} expired</span></div>);
                if (opco.officers?.unassigned > 0) rows.push(<div key="off" className="org-dash-drawer-rem-row"><span className="org-dash-drawer-rem-num">{++rank}</span><span>Assign compliance officers — {opco.officers.unassigned} unassigned</span></div>);
                if (opco.documents?.missing > 0) rows.push(<div key="doc" className="org-dash-drawer-rem-row"><span className="org-dash-drawer-rem-num">{++rank}</span><span>Upload missing documents — {opco.documents.missing} required</span></div>);
                if (rows.length === 0) return <div className="org-dash-drawer-rem-empty">No critical remediation actions at this time.</div>;
                return rows;
              })()}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ShortcomingBar({ label, value, max, color, icon, detail }) {
  const pct = Math.min(100, max ? (value / max) * 100 : 0);
  return (
    <div className="org-dash-shortcoming-bar">
      <div className="org-dash-shortcoming-head">
        <span className="org-dash-shortcoming-icon">{icon}</span>
        <span className="org-dash-shortcoming-label">{label}</span>
        <span className="org-dash-shortcoming-value" style={{ color }}>{value}</span>
      </div>
      {detail && <span className="org-dash-shortcoming-detail">{detail}</span>}
      <div className="org-dash-shortcoming-track">
        <div className="org-dash-shortcoming-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function dashboardVisibilityForRole(role) {
  const all = {
    showGcs: true,
    showLohs: true,
    showTileCritical: true,
    showTileHigh: true,
    showTileLic: true,
    showTilePoa: true,
    showTileLitigation: true,
    showTileUnassigned: true,
    showShortcomingPoa: true,
    showShortcomingLic: true,
    showShortcomingDoc: true,
  };
  if (!role || role === 'c-level' || role === 'board') return all;
  if (role === 'legal-team') {
    return { ...all, showGcs: false, showTileCritical: false, showTileHigh: false };
  }
  if (role === 'governance-team') return all;
  if (role === 'data-security-team') {
    return { ...all, showTileCritical: false, showTileHigh: false, showTilePoa: false, showTileLic: false, showTileLitigation: false, showShortcomingPoa: false, showShortcomingLic: false };
  }
  return all;
}

export function OrganizationDashboard({ language = 'en', parents = [], selectedParentHolding, onParentHoldingChange, onNavigateToView, selectedRole = '' }) {
  const visibility = dashboardVisibilityForRole(selectedRole);
  const [activeTab, setActiveTab] = useState('overview');
  const [opcosWithMeta, setOpcosWithMeta] = useState([]);
  const [opcoStats, setOpcoStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOpco, setSelectedOpco] = useState(null);
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState(1);

  const parentList = useMemo(() => Array.isArray(parents) ? parents : [], [parents]);
  const selectedParent = selectedParentHolding || (parentList.length ? parentList[0] : '');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const parentParam = selectedParent ? `parent=${encodeURIComponent(selectedParent)}` : '';
    const url = selectedParent ? `/api/companies/by-parent?${parentParam}` : '/api/companies/roles';
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list = data.opcos || (Array.isArray(data.opcos) ? data.opcos : []);
        const names = list.map((o) => (typeof o === 'string' ? o : o.name)).filter(Boolean);
        const uniq = [...new Set(names)];
        const withMeta = uniq.map((name, i) => {
          const item = list.find((o) => (typeof o === 'string' ? o : o.name) === name);
          const framework = item && item.framework ? item.framework : '—';
          return { id: i + 1, name, jurisdiction: framework };
        });
        setOpcosWithMeta(withMeta);
        return withMeta;
      })
      .then((opcoList) => {
        if (cancelled || !opcoList.length) {
          setOpcoStats([]);
          setLoading(false);
          return;
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        Promise.all([
          fetch('/api/poa').then((r) => r.json()).then((arr) => Array.isArray(arr) ? arr : []),
          ...opcoList.map((op) =>
            fetch(`/api/changes/opco-alerts?days=365&opco=${encodeURIComponent(op.name)}`).then((r) => r.json()).then((data) => ({ name: op.name, data: Array.isArray(data) ? data[0] : null }))
          ),
        ]).then(([poaList, ...alerts]) => {
          if (cancelled) return;
          const alertsByOpco = {};
          alerts.forEach(({ name, data }) => { alertsByOpco[name] = data || null; });
          const stats = opcoList.map((op) => {
            const poaForOpco = (poaList || []).filter((r) => {
              const n = String(r.opco || '').trim().toLowerCase();
              const w = op.name.toLowerCase();
              return n && (n === w || n.includes(w) || w.includes(n));
            });
            let total = poaForOpco.length;
            let active = 0;
            let expiringSoon = 0;
            let expired = 0;
            let revoked = 0;
            let broadScope = 0;
            const expiredFileIds = [];
            const expiringSoonFileIds = [];
            poaForOpco.forEach((r) => {
              if (r.revoked) revoked++;
              else {
                const end = r.validUntil ? new Date(r.validUntil) : null;
                if (!end || Number.isNaN(end.getTime())) active++;
                else {
                  end.setHours(0, 0, 0, 0);
                  const days = Math.ceil((end - today) / ONE_DAY_MS);
                  const fileId = (r.fileId || '').trim();
                  if (days < 0) {
                    expired++;
                    if (fileId) expiredFileIds.push(fileId);
                  } else if (days <= 30) {
                    expiringSoon++;
                    if (fileId) expiringSoonFileIds.push(fileId);
                  } else active++;
                }
              }
            });
            const gov = alertsByOpco[op.name];
            let overdueCount = 0;
            let dueSoonCount = 0;
            if (gov && Array.isArray(gov.frameworks)) {
              gov.frameworks.forEach((fw) => {
                (fw.changes || []).forEach((c) => {
                  if (!c.deadline) return;
                  const d = new Date(c.deadline);
                  if (Number.isNaN(d.getTime())) return;
                  d.setHours(0, 0, 0, 0);
                  const daysLeft = Math.ceil((d - today) / ONE_DAY_MS);
                  if (daysLeft < 0) overdueCount++;
                  else if (daysLeft <= 30) dueSoonCount++;
                });
              });
            }
            const lohsPct = total ? Math.round((active / total) * 100) : 100;
            const gcsDeduction = overdueCount * 12 + dueSoonCount * 5;
            const gcs = Math.max(0, Math.min(100, 100 - gcsDeduction));
            const lohs = Math.max(0, Math.min(100, lohsPct - (expired * 10) - (expiringSoon * 5)));
            const critical = expired + overdueCount;
            const high = expiringSoon + dueSoonCount;
            const medium = broadScope + (revoked > 0 ? 1 : 0);
            const low = 0;
            return {
              id: op.id,
              name: op.name,
              jurisdiction: op.jurisdiction,
              sector: '—',
              gcs,
              lohs,
              status: gcs >= 75 && lohs >= 75 ? 'compliant' : gcs >= 50 ? 'developing' : 'deficient',
              issues: { critical, high, medium, low },
              governanceOverdue: overdueCount,
              governanceDueSoon: dueSoonCount,
              poa: { total, active, expiringSoon, expired, revoked, broadScope, unattested: 0, expiredFileIds, expiringSoonFileIds },
              licences: { total: 10, active: 8, expiringSoon: 1, expired: 0, cascadeRisk: 0 },
              ip: { total: 0, active: 0, renewalDue: 0, gapJurisdictions: [], proofOfUseDue: 0, oppositionPending: 0 },
              litigation: { active: 0, exposure: 0, hearingIn7Days: 0, counselConflict: 0, defaultRisk: 0 },
              documents: { missing: 0, expiring: 0, lowConfidence: 0 },
              officers: { unassigned: 0 },
            };
          });
          setOpcoStats(stats);
          setLoading(false);
        }).catch(() => {
          setOpcoStats([]);
          setLoading(false);
        });
      })
      .catch(() => {
        setOpcosWithMeta([]);
        setOpcoStats([]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedParent]);

  const agg = useMemo(() => {
    if (!opcoStats.length) return { avgGcs: 0, avgLohs: 0, totalCritical: 0, totalHigh: 0, totalExpiredLic: 0, totalExpiredPOA: 0, totalExposure: 0, totalUnassigned: 0 };
    const avgGcs = Math.round(opcoStats.reduce((s, o) => s + o.gcs, 0) / opcoStats.length);
    const avgLohs = Math.round(opcoStats.reduce((s, o) => s + o.lohs, 0) / opcoStats.length);
    const totalCritical = opcoStats.reduce((s, o) => s + o.issues.critical, 0);
    const totalHigh = opcoStats.reduce((s, o) => s + o.issues.high, 0);
    const totalExpiredLic = opcoStats.reduce((s, o) => s + o.licences.expired, 0);
    const totalExpiredPOA = opcoStats.reduce((s, o) => s + o.poa.expired, 0);
    const totalExposure = opcoStats.reduce((s, o) => s + o.litigation.exposure, 0);
    const totalUnassigned = opcoStats.reduce((s, o) => s + o.officers.unassigned, 0);
    return { avgGcs, avgLohs, totalCritical, totalHigh, totalExpiredLic, totalExpiredPOA, totalExposure, totalUnassigned };
  }, [opcoStats]);

  const sortedStats = useMemo(() => {
    const arr = [...opcoStats];
    arr.sort((a, b) => {
      const va = a[sortBy];
      const vb = b[sortBy];
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va || '').localeCompare(String(vb || ''));
      return sortDir * (cmp < 0 ? -1 : cmp > 0 ? 1 : 0);
    });
    return arr;
  }, [opcoStats, sortBy, sortDir]);

  const toggleSort = useCallback((key) => {
    setSortBy(key);
    setSortDir((d) => (sortBy === key ? -d : 1));
  }, [sortBy]);

  const orgName = selectedParent || 'All OpCos';
  const lastUpdated = new Date().toLocaleString(language === 'ar' ? 'ar' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <div className="org-dash">
      <div className="org-dash-nav">
        <div className="org-dash-nav-brand">
          <span className="org-dash-nav-brand-label">{t(language, 'orgDashboardNavBrand')}</span>
          <span className="org-dash-nav-divider" />
          <span className="org-dash-nav-org">{orgName}</span>
          {parentList.length > 0 && (
            <select
              className="org-dash-nav-select"
              value={selectedParent}
              onChange={(e) => onParentHoldingChange && onParentHoldingChange(e.target.value)}
              aria-label={t(language, 'selectParentPlaceholder')}
            >
              <option value="">All OpCos</option>
              {parentList.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          )}
        </div>
        <div className="org-dash-nav-live">
          <span className="org-dash-nav-pulse" />
          <span className="org-dash-nav-updated">Live — {lastUpdated}</span>
        </div>
      </div>
      <div className="org-dash-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`org-dash-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {t(language, tab.labelKey)}
          </button>
        ))}
      </div>
      <main className="org-dash-main">
        {loading ? (
          <p className="org-dash-loading">Loading dashboard…</p>
        ) : activeTab === 'overview' && (
          <div className="org-dash-overview anim-fade-up">
            <div className="org-dash-overview-top">
              <div className="org-dash-score-block">
                {visibility.showGcs && (
                  <>
                    <div className="org-dash-score-item">
                      <div className="org-dash-score-label">Group GCS</div>
                      <ScoreGauge score={agg.avgGcs} size={90} />
                      <div className="org-dash-score-band" style={{ color: getBand(agg.avgGcs).color }}>{getBand(agg.avgGcs).label}</div>
                    </div>
                    {visibility.showLohs && <div className="org-dash-score-divider" />}
                  </>
                )}
                {visibility.showLohs && (
                  <div className="org-dash-score-item">
                    <div className="org-dash-score-label">Group LOHS</div>
                    <ScoreGauge score={agg.avgLohs} size={90} />
                    <div className="org-dash-score-band" style={{ color: getBand(agg.avgLohs).color }}>{getBand(agg.avgLohs).label}</div>
                  </div>
                )}
              </div>
              <div className="org-dash-metrics">
                {visibility.showTileCritical && <MetricTile value={agg.totalCritical} label="Critical Issues" sub="Immediate action" color="#dc2626" bg="#fff5f5" icon="CRIT" pulse={agg.totalCritical > 0} />}
                {visibility.showTileHigh && <MetricTile value={agg.totalHigh} label="High Issues" sub="Action within 48 hrs" color="#f97316" bg="#fff7ed" icon="HIGH" />}
                {visibility.showTileLic && <MetricTile value={agg.totalExpiredLic} label="Licences Expired" sub="Operational risk" color="#dc2626" bg="#fff5f5" icon="LIC" pulse={agg.totalExpiredLic > 0} />}
                {visibility.showTilePoa && <MetricTile value={agg.totalExpiredPOA} label="POAs Expired" sub="Signatory invalid" color="#f97316" bg="#fff7ed" icon="POA" />}
                {visibility.showTileLitigation && <MetricTile value={fmtAed(agg.totalExposure)} label="Litigation Exposure" sub="Weighted total" color="#7c3aed" bg="#faf5ff" icon="LIT" />}
                {visibility.showTileUnassigned && <MetricTile value={agg.totalUnassigned} label="Unassigned Officers" sub="No compliance owner" color="#64748b" bg="#f8fafc" icon="OFC" />}
              </div>
            </div>
            <div className="org-dash-entity-heading">Entity Shortcomings — {opcoStats.length} Operating Companies</div>
            <div className="org-dash-cards">
              {opcoStats.map((opco) => (
                <OpCoCard key={opco.id} opco={opco} onSelect={setSelectedOpco} language={language} />
              ))}
            </div>
            {selectedOpco && <OpCoDetailDrawer opco={selectedOpco} onClose={() => setSelectedOpco(null)} language={language} onNavigateToView={onNavigateToView} />}
          </div>
        )}
        {!loading && activeTab === 'shortcomings' && (
          <div className="org-dash-shortcomings">
            {visibility.showShortcomingPoa && (
              <section className="org-dash-shortcoming-cat">
                <div className="org-dash-shortcoming-cat-title">Power of Attorney</div>
                {opcoStats.map((op) => (
                  <ShortcomingBar key={op.id} label={op.name} value={op.poa.expired + op.poa.expiringSoon} max={op.poa.total || 1} color="#f97316" icon="POA" detail={`${op.poa.expired} expired, ${op.poa.expiringSoon} expiring`} />
                ))}
              </section>
            )}
            {visibility.showShortcomingLic && (
              <section className="org-dash-shortcoming-cat">
                <div className="org-dash-shortcoming-cat-title">Licences</div>
                {opcoStats.map((op) => (
                  <ShortcomingBar key={op.id} label={op.name} value={op.licences.expired} max={op.licences.total || 1} color="#dc2626" icon="LIC" />
                ))}
              </section>
            )}
            {visibility.showShortcomingDoc && (
              <section className="org-dash-shortcoming-cat">
                <div className="org-dash-shortcoming-cat-title">Documents &amp; Officers</div>
                {opcoStats.map((op) => (
                  <ShortcomingBar key={op.id} label={op.name} value={op.documents.missing + op.officers.unassigned} max={20} color="#d97706" icon="DOC" />
                ))}
              </section>
            )}
          </div>
        )}
        {!loading && activeTab === 'entities' && (
          <div className="org-dash-entities">
            <table className="org-dash-table">
              <thead>
                <tr>
                  <th><button type="button" className="org-dash-th-btn" onClick={() => toggleSort('name')}>OpCo</button></th>
                  <th><button type="button" className="org-dash-th-btn" onClick={() => toggleSort('jurisdiction')}>Jurisdiction</button></th>
                  <th><button type="button" className="org-dash-th-btn" onClick={() => toggleSort('gcs')}>GCS</button></th>
                  <th><button type="button" className="org-dash-th-btn" onClick={() => toggleSort('lohs')}>LOHS</button></th>
                  <th>Issues</th>
                </tr>
              </thead>
              <tbody>
                {sortedStats.map((op) => (
                  <tr key={op.id} onClick={() => setSelectedOpco(op)} className="org-dash-table-row-click">
                    <td>{op.name}</td>
                    <td>{op.jurisdiction}</td>
                    <td>{formatNumber(language, op.gcs)}</td>
                    <td>{formatNumber(language, op.lohs)}</td>
                    <td><IssueSeverityBar issues={op.issues} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selectedOpco && <OpCoDetailDrawer opco={selectedOpco} onClose={() => setSelectedOpco(null)} language={language} onNavigateToView={onNavigateToView} />}
          </div>
        )}
      </main>
    </div>
  );
}
