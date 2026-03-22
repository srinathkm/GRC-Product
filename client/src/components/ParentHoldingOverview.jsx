import { useState, useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { t, formatNumber } from '../i18n';
import './ParentHoldingOverview.css';

const API = '/api';
const UBO_STORAGE_KEY = 'ubo_register';
const COMPLIANCE_THRESHOLD = 80;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function frameworkToJurisdiction(framework) {
  if (!framework) return '—';
  const uae = ['DFSA Rulebook', 'Dubai 2040', 'ADGM FSRA Rulebook', 'ADGM Companies Regulations',
    'CBUAE Rulebook', 'UAE AML/CFT', 'UAE Federal Laws', 'JAFZA Operating Regulations',
    'DMCC Company Regulations', 'DMCC Compliance & AML'];
  if (uae.includes(framework)) return 'UAE';
  if (['SAMA', 'CMA', 'Saudi 2030', 'SDAIA'].includes(framework)) return 'KSA';
  if (['QFCRA Rules', 'Qatar AML Law'].includes(framework)) return 'Qatar';
  if (['CBB Rulebook', 'BHB Sustainability ESG'].includes(framework)) return 'Bahrain';
  if (['Oman CMA Regulations', 'Oman AML Law'].includes(framework)) return 'Oman';
  if (['Kuwait CMA Regulations', 'Kuwait AML Law'].includes(framework)) return 'Kuwait';
  return framework;
}

const FRAMEWORK_COLORS = {
  'DFSA Rulebook': '#3b82f6',
  'ADGM FSRA Rulebook': '#6366f1',
  'ADGM Companies Regulations': '#6366f1',
  'SAMA': '#10b981',
  'CMA': '#059669',
  'Saudi 2030': '#22c55e',
  'SDAIA': '#06b6d4',
  'Dubai 2040': '#f59e0b',
  'CBUAE Rulebook': '#14b8a6',
  'UAE AML/CFT': '#ef4444',
  'UAE Federal Laws': '#f97316',
  'JAFZA Operating Regulations': '#d946ef',
  'DMCC Company Regulations': '#a855f7',
  'DMCC Compliance & AML': '#a855f7',
  'QFCRA Rules': '#0ea5e9',
  'Qatar AML Law': '#0ea5e9',
  'CBB Rulebook': '#84cc16',
  'BHB Sustainability ESG': '#4ade80',
  'Oman CMA Regulations': '#fb923c',
  'Oman AML Law': '#fb923c',
  'Kuwait CMA Regulations': '#e879f9',
  'Kuwait AML Law': '#e879f9',
};

function getFrameworkColor(fw) {
  return FRAMEWORK_COLORS[fw] || '#6b7280';
}

function getScoreColor(score) {
  if (score >= COMPLIANCE_THRESHOLD) return '#10b981';
  if (score >= 70) return '#f59e0b';
  return '#ef4444';
}

function getDaysFromToday(dateStr) {
  if (!dateStr) return null;
  const dl = new Date(dateStr); dl.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((dl - today) / 86400000);
}

function getUboKeyFor(parent, opco) { return `${parent || ''}::${opco || ''}`; }

function getRegisteredAddressForOpco(parentName, opcoName) {
  try {
    const raw = localStorage.getItem(UBO_STORAGE_KEY);
    if (!raw) return '';
    const data = JSON.parse(raw);
    const entry = data[getUboKeyFor(parentName, opcoName)];
    const details = entry?.details && typeof entry.details === 'object' ? entry.details : {};
    return typeof details.registeredAddress === 'string' ? details.registeredAddress.trim() : '';
  } catch { return ''; }
}

function getUboDocSummary(opcoName) {
  try {
    const raw = localStorage.getItem(UBO_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const docsById = {};
    const suffix = `::${opcoName}`;
    Object.entries(data).forEach(([key, rec]) => {
      if (!key.endsWith(suffix)) return;
      if (!rec || !Array.isArray(rec.documents)) return;
      rec.documents.forEach((d) => {
        if (!d?.id) return;
        if (!docsById[d.id]) docsById[d.id] = { uploaded: !!d.uploaded };
        else if (d.uploaded) docsById[d.id].uploaded = true;
      });
    });
    const ids = Object.keys(docsById);
    if (!ids.length) return null;
    const MANDATORY_TOTAL = 7;
    const total = Math.max(ids.length, MANDATORY_TOTAL);
    return { completed: ids.filter((id) => docsById[id].uploaded).length, total };
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORE LOOKUP TABLES (kept for fallback when live scores unavailable)
// ─────────────────────────────────────────────────────────────────────────────

const OPCO_COMPLIANCE_LOOKUP = {
  'Emirates NBD Capital': { governanceScore: 92, policyScore: 88, dataSovereigntyScore: 85 },
  'Emirates Investment Bank': { governanceScore: 86, policyScore: 82, dataSovereigntyScore: 84 },
  'Mashreq Capital': { governanceScore: 78, policyScore: 74, dataSovereigntyScore: 76 },
  'Dubai Islamic Bank (DIFC)': { governanceScore: 72, policyScore: 69, dataSovereigntyScore: 71 },
  'Saudi National Bank (SNB)': { governanceScore: 91, policyScore: 89, dataSovereigntyScore: 87 },
  'Saudi National Bank': { governanceScore: 90, policyScore: 88, dataSovereigntyScore: 86 },
  'Al Rajhi Bank': { governanceScore: 88, policyScore: 85, dataSovereigntyScore: 83 },
  'Al Rajhi Capital': { governanceScore: 82, policyScore: 79, dataSovereigntyScore: 77 },
  'Riyad Bank': { governanceScore: 71, policyScore: 68, dataSovereigntyScore: 70 },
  'Riyad Capital': { governanceScore: 76, policyScore: 73, dataSovereigntyScore: 75 },
  'STC Pay': { governanceScore: 94, policyScore: 92, dataSovereigntyScore: 90 },
  'Saudi Telecom (STC)': { governanceScore: 89, policyScore: 86, dataSovereigntyScore: 84 },
  'Saudi Aramco': { governanceScore: 93, policyScore: 95, dataSovereigntyScore: 91 },
  'SNB Capital': { governanceScore: 83, policyScore: 81, dataSovereigntyScore: 82 },
  'JP Morgan (DIFC)': { governanceScore: 96, policyScore: 94, dataSovereigntyScore: 92 },
  'Shuaa Capital': { governanceScore: 79, policyScore: 76, dataSovereigntyScore: 78 },
  'Arqaam Capital': { governanceScore: 75, policyScore: 72, dataSovereigntyScore: 74 },
  'Al Mal Capital': { governanceScore: 73, policyScore: 70, dataSovereigntyScore: 72 },
  'Goldman Sachs (DIFC)': { governanceScore: 92, policyScore: 90, dataSovereigntyScore: 88 },
  'Deutsche Bank (DIFC)': { governanceScore: 87, policyScore: 84, dataSovereigntyScore: 85 },
  'Standard Chartered (DIFC)': { governanceScore: 85, policyScore: 83, dataSovereigntyScore: 82 },
  'Barclays (DIFC)': { governanceScore: 84, policyScore: 82, dataSovereigntyScore: 81 },
  'Dubai Holding': { governanceScore: 81, policyScore: 78, dataSovereigntyScore: 80 },
  'DP World': { governanceScore: 86, policyScore: 84, dataSovereigntyScore: 83 },
  'Emaar Properties': { governanceScore: 83, policyScore: 81, dataSovereigntyScore: 82 },
  'NEOM': { governanceScore: 88, policyScore: 85, dataSovereigntyScore: 86 },
  'Red Sea Global': { governanceScore: 82, policyScore: 80, dataSovereigntyScore: 79 },
  'ROSHN': { governanceScore: 77, policyScore: 74, dataSovereigntyScore: 76 },
  'SABIC': { governanceScore: 84, policyScore: 86, dataSovereigntyScore: 82 },
  "Ma'aden": { governanceScore: 72, policyScore: 69, dataSovereigntyScore: 71 },
  'Mada': { governanceScore: 88, policyScore: 85, dataSovereigntyScore: 86 },
  'Saudi Payments': { governanceScore: 85, policyScore: 83, dataSovereigntyScore: 84 },
};

const MIX_SCORE_TRIPLETS = [
  { governanceScore: 92, policyScore: 78, dataSovereigntyScore: 85 },
  { governanceScore: 76, policyScore: 88, dataSovereigntyScore: 72 },
  { governanceScore: 84, policyScore: 71, dataSovereigntyScore: 90 },
  { governanceScore: 79, policyScore: 93, dataSovereigntyScore: 74 },
  { governanceScore: 87, policyScore: 75, dataSovereigntyScore: 82 },
  { governanceScore: 73, policyScore: 86, dataSovereigntyScore: 89 },
  { governanceScore: 91, policyScore: 77, dataSovereigntyScore: 70 },
  { governanceScore: 81, policyScore: 69, dataSovereigntyScore: 94 },
  { governanceScore: 72, policyScore: 84, dataSovereigntyScore: 88 },
  { governanceScore: 89, policyScore: 74, dataSovereigntyScore: 76 },
];

const ABOVE80_SCORE_TRIPLETS = [
  { governanceScore: 88, policyScore: 85, dataSovereigntyScore: 87 },
  { governanceScore: 92, policyScore: 89, dataSovereigntyScore: 84 },
  { governanceScore: 85, policyScore: 91, dataSovereigntyScore: 86 },
  { governanceScore: 90, policyScore: 84, dataSovereigntyScore: 88 },
  { governanceScore: 86, policyScore: 87, dataSovereigntyScore: 82 },
  { governanceScore: 83, policyScore: 88, dataSovereigntyScore: 91 },
  { governanceScore: 89, policyScore: 86, dataSovereigntyScore: 85 },
  { governanceScore: 87, policyScore: 82, dataSovereigntyScore: 90 },
  { governanceScore: 84, policyScore: 90, dataSovereigntyScore: 86 },
  { governanceScore: 91, policyScore: 83, dataSovereigntyScore: 87 },
];

const DEFAULT_COMPLIANCE = { governanceScore: 75, policyScore: 78, dataSovereigntyScore: 72 };

// ─────────────────────────────────────────────────────────────────────────────
// MODULE-LEVEL SUB-COMPONENTS (React Fast Refresh requirement)
// ─────────────────────────────────────────────────────────────────────────────

function FrameworkBadge({ name }) {
  const color = getFrameworkColor(name);
  return (
    <span
      className="pho-fw-badge"
      style={{ background: color + '1a', color, border: `1px solid ${color}44` }}
      title={name}
    >
      {name}
    </span>
  );
}

function DeadlineItem({ change, opcoNamesSet }) {
  const days = getDaysFromToday(change.deadline);
  const affectedHere = (change.affectedCompanies || []).filter(c => opcoNamesSet && opcoNamesSet.has(c));
  const dateLabel = change.deadline
    ? new Date(change.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  return (
    <div className="pho-dl-item">
      <FrameworkBadge name={change.framework} />
      <div className="pho-dl-title" title={change.title}>{change.title}</div>
      <div className="pho-dl-meta">
        <span className="pho-dl-date">{dateLabel}</span>
        {days !== null && (
          <span className={`pho-dl-days ${days < 0 ? 'overdue' : days <= 30 ? 'soon' : 'upcoming'}`}>
            {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
          </span>
        )}
        {affectedHere.length > 0 && (
          <span className="pho-dl-opco-count" title={affectedHere.join(', ')}>
            {affectedHere.length} OpCo{affectedHere.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}

function DeadlineColumn({ title, count, items, type, opcoNamesSet, emptyMsg }) {
  const [expanded, setExpanded] = useState(true);
  const SHOW = 5;
  const visible = expanded ? items : items.slice(0, SHOW);

  return (
    <div className={`pho-dl-col pho-dl-col-${type}`}>
      <div className="pho-dl-col-header">
        <span className={`pho-dl-col-dot pho-dot-${type}`} />
        <span className="pho-dl-col-title">{title}</span>
        <span className={`pho-dl-col-count pho-count-${type}`}>{count}</span>
      </div>
      <div className="pho-dl-col-body">
        {items.length === 0 ? (
          <div className="pho-dl-empty">{emptyMsg}</div>
        ) : (
          <>
            {visible.map(c => (
              <DeadlineItem key={c.id} change={c} opcoNamesSet={opcoNamesSet} />
            ))}
            {items.length > SHOW && (
              <button className="pho-dl-toggle" onClick={() => setExpanded(e => !e)}>
                {expanded ? 'Show less' : `+ ${items.length - SHOW} more`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function RiskLevelBadge({ level }) {
  const META = {
    critical: { label: 'Critical', cls: 'pho-risk-critical' },
    high:     { label: 'High',     cls: 'pho-risk-high' },
    medium:   { label: 'Medium',   cls: 'pho-risk-medium' },
    low:      { label: 'Clear',    cls: 'pho-risk-low' },
  };
  const m = META[level] || META.low;
  return <span className={`pho-risk-badge ${m.cls}`}>{m.label}</span>;
}

function OpcoComplianceRow({ row }) {
  const avg = Math.round((row.governanceScore + row.policyScore + row.dataSovereigntyScore) / 3);
  const isCompliant = row.status === 'Compliant';
  return (
    <div className={`pho-opco-row ${!isCompliant ? 'pho-opco-row-risk' : ''}`}>
      <div className="pho-opco-row-name" title={row.opcoName}>
        {row.opcoName.length > 22 ? row.opcoName.slice(0, 21) + '…' : row.opcoName}
      </div>
      <div className="pho-opco-bars">
        {[
          { label: 'Gov', score: row.governanceScore },
          { label: 'Pol', score: row.policyScore },
          { label: 'Data', score: row.dataSovereigntyScore },
        ].map(({ label, score }) => (
          <div key={label} className="pho-opco-bar-item">
            <span className="pho-opco-bar-lbl">{label}</span>
            <div className="pho-opco-bar-track">
              <div
                className="pho-opco-bar-fill"
                style={{ width: `${score}%`, background: getScoreColor(score) }}
              />
              <div className="pho-opco-threshold-line" />
            </div>
            <span className="pho-opco-bar-val" style={{ color: getScoreColor(score) }}>{score}%</span>
          </div>
        ))}
      </div>
      <div className="pho-opco-avg" style={{ color: getScoreColor(avg) }}>{avg}%</div>
    </div>
  );
}

// Custom Recharts tooltip for compliance bar chart
function ComplianceTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="pho-chart-tooltip">
      <div className="pho-ct-title">{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} className="pho-ct-row">
          <span className="pho-ct-dot" style={{ background: p.color }} />
          <span className="pho-ct-name">{p.dataKey}</span>
          <span className="pho-ct-val" style={{ color: getScoreColor(p.value) }}>{p.value}%</span>
        </div>
      ))}
      <div className="pho-ct-note">── 80% compliance threshold</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function ParentHoldingOverview({
  language = 'en',
  parents = [],
  selectedParentHolding,
  onParentHoldingChange,
  onNavigateToView,
  companiesRefreshKey = 0,
  selectedOpco = '',
  onOpcoChange,
}) {
  // ── State ────────────────────────────────────────────────────────────────
  const [allChanges, setAllChanges] = useState([]);
  const [showOverdueModal, setShowOverdueModal] = useState(false);
  const [stats, setStats] = useState({
    governanceComplianceScore: 87,
    operatingCompaniesCount: 42,
    policyComplianceScore: 84,
    dataSovereigntyComplianceScore: 82,
  });
  const [opcosForParent, setOpcosForParent] = useState([]);
  const [loadingOpcos, setLoadingOpcos] = useState(false);
  const [jurisdictionByOpco, setJurisdictionByOpco] = useState({});
  const [liveScores, setLiveScores] = useState({});
  const [overviewSummary, setOverviewSummary] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState(null);
  const [overviewKey, setOverviewKey] = useState('');

  // ── Data fetching ─────────────────────────────────────────────────────────

  // Fetch all changes with a wide window so we capture every deadline
  // (including those published > 1 year ago that may still be overdue).
  useEffect(() => {
    fetch(`${API}/changes?days=730`)
      .then(r => r.json())
      .then(data => setAllChanges(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedParentHolding) { setOpcosForParent([]); setJurisdictionByOpco({}); return; }
    setJurisdictionByOpco({});
    setLoadingOpcos(true);
    fetch(`${API}/companies/by-parent?parent=${encodeURIComponent(selectedParentHolding)}`)
      .then(r => r.json())
      .then(data => setOpcosForParent(data.opcos || []))
      .catch(() => setOpcosForParent([]))
      .finally(() => setLoadingOpcos(false));
  }, [selectedParentHolding, companiesRefreshKey]);

  useEffect(() => {
    if (!selectedParentHolding) { setLiveScores({}); return; }
    fetch(`${API}/companies/compliance-scores?parent=${encodeURIComponent(selectedParentHolding)}`)
      .then(r => r.json())
      .then(data => {
        const map = {};
        (data.scores || []).forEach(s => { map[s.name] = s; });
        setLiveScores(map);
      })
      .catch(() => setLiveScores({}));
  }, [selectedParentHolding, companiesRefreshKey]);

  // Derive aggregate stats from live scores
  useEffect(() => {
    const vals = Object.values(liveScores);
    if (!vals.length) return;
    const avg = key => Math.round(vals.reduce((s, v) => s + (v[key] || 0), 0) / vals.length);
    setStats(prev => ({
      ...prev,
      governanceComplianceScore: avg('governanceScore'),
      policyComplianceScore: avg('policyScore'),
      dataSovereigntyComplianceScore: avg('dataSovereigntyScore'),
      operatingCompaniesCount: vals.length || prev.operatingCompaniesCount,
    }));
  }, [liveScores]);

  // Jurisdiction detection via UBO registered address
  const opcoMeta = useMemo(() => {
    const byName = {};
    for (const item of opcosForParent) {
      const { name, framework, locations, applicableFrameworks, applicableFrameworksByLocation } = item;
      if (!byName[name]) byName[name] = { frameworks: [], frameworkSet: new Set(), locations: [] };
      // Primary framework
      if (framework && framework !== 'Onboarded') {
        if (!byName[name].frameworkSet.has(framework)) {
          byName[name].frameworkSet.add(framework);
          byName[name].frameworks.push(framework);
        }
      }
      // Explicit applicable frameworks (onboarded OpCos)
      for (const fw of applicableFrameworks || []) {
        if (!byName[name].frameworkSet.has(fw)) {
          byName[name].frameworkSet.add(fw);
          byName[name].frameworks.push(fw);
        }
      }
      // Location-based framework pairs (onboarded OpCos)
      for (const pair of applicableFrameworksByLocation || []) {
        if (pair.framework && !byName[name].frameworkSet.has(pair.framework)) {
          byName[name].frameworkSet.add(pair.framework);
          byName[name].frameworks.push(pair.framework);
        }
      }
      if (Array.isArray(locations) && locations.length > 0) byName[name].locations = locations;
    }
    const isMultiJurisdiction = {};
    Object.entries(byName).forEach(([name, data]) => {
      const multiLoc = data.locations.length > 1;
      const jurSet = new Set((data.frameworks || []).map(frameworkToJurisdiction).filter(Boolean));
      isMultiJurisdiction[name] = multiLoc || jurSet.size > 1;
    });
    return { byName, isMultiJurisdiction };
  }, [opcosForParent]);

  useEffect(() => {
    if (!selectedParentHolding || opcosForParent.length === 0) return;
    const byName = opcoMeta.byName;
    const multiSet = new Set(
      Object.entries(opcoMeta.isMultiJurisdiction)
        .filter(([, v]) => v).map(([k]) => k)
    );
    let cancelled = false;
    Object.keys(byName).forEach(opcoName => {
      if (multiSet.has(opcoName)) return;
      const addr = getRegisteredAddressForOpco(selectedParentHolding, opcoName);
      if (!addr) return;
      fetch(`${API}/ubo/extract-country-from-address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registeredAddress: addr }),
      })
        .then(r => r.json())
        .then(data => {
          if (cancelled) return;
          const country = (data.country || '').trim();
          if (country) setJurisdictionByOpco(prev => ({ ...prev, [opcoName]: country }));
        })
        .catch(() => {});
    });
    return () => { cancelled = true; };
  }, [selectedParentHolding, opcosForParent, opcoMeta]);

  // ── Table rows ────────────────────────────────────────────────────────────

  const tableRows = useMemo(() => {
    const uniqueNames = [];
    const seen = new Set();
    for (const { name } of opcosForParent) {
      if (!seen.has(name)) { seen.add(name); uniqueNames.push(name); }
    }
    const n = uniqueNames.length;
    const useSplit = n > 5;
    const nMix = useSplit ? Math.round(0.4 * n) : 0;
    const opcoToIndex = {};
    uniqueNames.forEach((name, i) => { opcoToIndex[name] = i; });

    return uniqueNames.map(name => {
      const framework = (opcoMeta.byName[name]?.frameworks || [])[0];
      const isMulti = !!opcoMeta.isMultiJurisdiction[name];
      const jurisdictionDisplay = isMulti ? 'multi-jurisdiction' : (jurisdictionByOpco[name] ?? '—');
      let compliance;
      if (liveScores[name]) {
        compliance = liveScores[name];
      } else if (useSplit) {
        const idx = opcoToIndex[name];
        const triplet = idx < nMix
          ? MIX_SCORE_TRIPLETS[idx % MIX_SCORE_TRIPLETS.length]
          : ABOVE80_SCORE_TRIPLETS[(idx - nMix) % ABOVE80_SCORE_TRIPLETS.length];
        compliance = triplet;
      } else {
        compliance = OPCO_COMPLIANCE_LOOKUP[name] || DEFAULT_COMPLIANCE;
      }
      const { governanceScore, policyScore, dataSovereigntyScore } = compliance;
      const anyBelow = governanceScore < COMPLIANCE_THRESHOLD || policyScore < COMPLIANCE_THRESHOLD || dataSovereigntyScore < COMPLIANCE_THRESHOLD;
      const status = anyBelow ? 'Non-Compliant' : (compliance.status || 'Compliant');
      return { opcoName: name, jurisdiction: jurisdictionDisplay, governanceScore, policyScore, dataSovereigntyScore, status, framework };
    });
  }, [opcosForParent, opcoMeta, jurisdictionByOpco, liveScores]);

  // ── Correct overdue / deadline data ──────────────────────────────────────
  // Fix: use opcoNamesSet (from opcosForParent) to filter changes that
  // genuinely affect this parent's OpCos. The old code used `affectedParents`
  // which does not exist in the changes data — it only has `affectedCompanies`.

  const opcoNamesSet = useMemo(() => {
    const s = new Set();
    for (const { name } of opcosForParent) s.add(name);
    return s;
  }, [opcosForParent]);

  // Changes relevant to this parent/OpCo.
  // When an OpCo is selected: filter by framework membership (affectedCompanies is sparsely populated).
  // When only a parent is selected: filter by affectedCompanies (existing behaviour).
  const changesForParent = useMemo(() => {
    if (!selectedParentHolding) return [];
    if (selectedOpco) {
      const opcoFws = new Set(opcoMeta.byName[selectedOpco]?.frameworks || []);
      if (opcoFws.size === 0) return [];
      return allChanges.filter(c => opcoFws.has(c.framework));
    }
    if (opcoNamesSet.size === 0) return [];
    return allChanges.filter(c => {
      const companies = c.affectedCompanies || [];
      if (companies.length === 0) return false;
      return companies.some(name => opcoNamesSet.has(name));
    });
  }, [allChanges, selectedParentHolding, selectedOpco, opcoNamesSet, opcoMeta]);

  // Bucket by urgency — all derived from real data
  const { overdueList, upcoming30List, upcoming90List } = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d30 = new Date(today); d30.setDate(d30.getDate() + 30);
    const d90 = new Date(today); d90.setDate(d90.getDate() + 90);
    const overdueList = [], upcoming30List = [], upcoming90List = [];
    changesForParent.forEach(c => {
      if (!c.deadline) return;
      const dl = new Date(c.deadline); dl.setHours(0, 0, 0, 0);
      if (dl < today) overdueList.push(c);
      else if (dl <= d30) upcoming30List.push(c);
      else if (dl <= d90) upcoming90List.push(c);
    });
    // Sort overdue by most overdue first; upcoming by soonest first
    overdueList.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    upcoming30List.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    upcoming90List.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    return { overdueList, upcoming30List, upcoming90List };
  }, [changesForParent]);

  // Framework risk matrix — grouped counts per framework across all urgency bands
  const frameworkRiskData = useMemo(() => {
    const map = {};
    const add = (list, band) => list.forEach(c => {
      if (!map[c.framework]) map[c.framework] = { overdue: 0, soon: 0, quarter: 0 };
      map[c.framework][band]++;
    });
    add(overdueList, 'overdue');
    add(upcoming30List, 'soon');
    add(upcoming90List, 'quarter');
    return Object.entries(map).map(([fw, counts]) => {
      const level = counts.overdue > 0 ? 'critical' : counts.soon > 0 ? 'high' : counts.quarter > 0 ? 'medium' : 'low';
      return { framework: fw, ...counts, riskLevel: level };
    }).sort((a, b) => {
      const o = { critical: 0, high: 1, medium: 2, low: 3 };
      return (o[a.riskLevel] - o[b.riskLevel]) || (b.overdue + b.soon) - (a.overdue + a.soon);
    });
  }, [overdueList, upcoming30List, upcoming90List]);

  // When an OpCo is selected, scope the compliance table + charts to just that OpCo.
  const activeRows = useMemo(() => {
    if (!selectedOpco) return tableRows;
    const lower = selectedOpco.toLowerCase();
    return tableRows.filter(r => r.opcoName.toLowerCase() === lower);
  }, [tableRows, selectedOpco]);

  // Derived metrics
  const nonCompliantCount = useMemo(() =>
    activeRows.filter(r => r.status !== 'Compliant').length,
  [activeRows]);

  // OpCos sorted worst → best (for profile bars and chart)
  const sortedOpcos = useMemo(() =>
    activeRows.slice().sort((a, b) => {
      const avgA = (a.governanceScore + a.policyScore + a.dataSovereigntyScore) / 3;
      const avgB = (b.governanceScore + b.policyScore + b.dataSovereigntyScore) / 3;
      return avgA - avgB;
    }),
  [tableRows]);

  // Bottom-10 worst performers for the grouped bar chart
  const barChartData = useMemo(() =>
    sortedOpcos.slice(0, 10).map(row => ({
      name: row.opcoName.length > 16 ? row.opcoName.slice(0, 15) + '…' : row.opcoName,
      Governance: row.governanceScore,
      Policy: row.policyScore,
      'Data Sovereignty': row.dataSovereigntyScore,
    })),
  [sortedOpcos]);

  // ── Summary stats for the top stat cards ─────────────────────────────────

  const displayStats = (() => {
    const rows = activeRows;
    if (!selectedParentHolding || rows.length === 0) {
      return { ...stats, operatingCompaniesCount: selectedParentHolding ? rows.length : stats.operatingCompaniesCount };
    }
    const n = rows.length;
    const avg = key => Math.round(rows.reduce((s, r) => s + (r[key] ?? 0), 0) / n);
    return {
      ...stats,
      operatingCompaniesCount: n,
      governanceComplianceScore: avg('governanceScore'),
      policyComplianceScore: avg('policyScore'),
      dataSovereigntyComplianceScore: avg('dataSovereigntyScore'),
    };
  })();

  // ── LLM overview summary ──────────────────────────────────────────────────

  useEffect(() => {
    const currentKey = selectedParentHolding
      ? `${selectedParentHolding}::${selectedOpco}::${activeRows.length}::${overdueList.length}`
      : '';
    if (!selectedParentHolding || activeRows.length === 0) {
      setOverviewSummary(null); setOverviewError(null); setOverviewLoading(false); setOverviewKey('');
      return;
    }
    if (overviewKey === currentKey) return;
    setOverviewKey(currentKey);

    const opcosPayload = activeRows.map(row => ({
      opcoName: row.opcoName,
      jurisdiction: row.jurisdiction,
      governanceScore: row.governanceScore,
      policyScore: row.policyScore,
      dataSovereigntyScore: row.dataSovereigntyScore,
      status: row.status,
      isMultiJurisdiction: !!opcoMeta.isMultiJurisdiction[row.opcoName],
      uboDocs: getUboDocSummary(row.opcoName),
    }));

    const overduePayload = overdueList.map(c => ({
      framework: c.framework || '',
      title: c.title || '',
      deadline: c.deadline || '',
      affectedOpcos: (c.affectedCompanies || []).filter(co => opcoNamesSet.has(co)),
    }));

    setOverviewLoading(true);
    setOverviewError(null);
    fetch(`${API}/analysis/overview-summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent: selectedParentHolding, opcos: opcosPayload, overdueChanges: overduePayload }),
    })
      .then(r => r.json())
      .then(data => {
        if (data && !data.error) setOverviewSummary(data);
        else { setOverviewSummary(null); setOverviewError(data.error || 'Failed to build overview summary'); }
      })
      .catch(e => { setOverviewSummary(null); setOverviewError(e.message); })
      .finally(() => setOverviewLoading(false));
  }, [selectedParentHolding, tableRows.length, overdueList.length, overviewKey, opcoMeta, opcoNamesSet]);

  // ── Render helpers ────────────────────────────────────────────────────────

  const statusKey = s => ({ Compliant: 'compliant', 'Non-Compliant': 'nonCompliant', 'At Risk': 'atRisk' }[s] || s);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="parent-overview">
      <h2 className="parent-overview-title">{t(language, 'parentOverviewTitle')}</h2>

      {/* Parent + OpCo selectors */}
      <div className="parent-overview-select-wrap">
        <label htmlFor="parent-holding-select">{t(language, 'parentHoldingCompany')}</label>
        <select
          id="parent-holding-select"
          className="parent-holding-select"
          value={selectedParentHolding || ''}
          onChange={e => {
            onParentHoldingChange(e.target.value || '');
            if (onOpcoChange) onOpcoChange(''); // reset opco when parent changes
          }}
        >
          <option value="">{t(language, 'selectParentPlaceholder')}</option>
          {parents.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        {/* OpCo sub-filter — shown once a parent is selected and OpCos are loaded */}
        {selectedParentHolding && tableRows.length > 0 && (
          <>
            <label htmlFor="opco-filter-select" style={{ marginLeft: '0.75rem' }}>OpCo</label>
            <select
              id="opco-filter-select"
              className="parent-holding-select"
              value={selectedOpco || ''}
              onChange={e => onOpcoChange && onOpcoChange(e.target.value)}
              style={{ minWidth: '180px' }}
            >
              <option value="">All OpCos</option>
              {tableRows.map(r => (
                <option key={r.opcoName} value={r.opcoName}>{r.opcoName}</option>
              ))}
            </select>
          </>
        )}

        {selectedParentHolding && (
          <span className="parent-overview-selection-note">
            {selectedOpco ? `Showing data for ${selectedOpco}` : t(language, 'selectionAppliesNote')}
          </span>
        )}
      </div>

      {/* Top stat cards */}
      <div className="parent-overview-cards">
        <div className="ph-card">
          <div className="ph-card-label">{t(language, 'totalOpCos')}</div>
          <div className="ph-card-value">{selectedParentHolding ? formatNumber(language, displayStats.operatingCompaniesCount) : '—'}</div>
        </div>
        <button type="button" className="ph-card ph-card-clickable" onClick={() => onNavigateToView?.('governance-framework')}>
          <div className="ph-card-label">{t(language, 'governanceComplianceScore')}</div>
          <div className="ph-card-value">{selectedParentHolding ? `${formatNumber(language, displayStats.governanceComplianceScore)}%` : '—'}</div>
        </button>
        <button type="button" className="ph-card ph-card-clickable" onClick={() => onNavigateToView?.('multi-jurisdiction')}>
          <div className="ph-card-label">{t(language, 'policyComplianceScore')}</div>
          <div className="ph-card-value">{selectedParentHolding ? `${formatNumber(language, displayStats.policyComplianceScore)}%` : '—'}</div>
        </button>
        <button type="button" className="ph-card ph-card-clickable" onClick={() => onNavigateToView?.('data-sovereignty')}>
          <div className="ph-card-label">{t(language, 'dataSovereigntyComplianceScore')}</div>
          <div className="ph-card-value">{selectedParentHolding ? `${formatNumber(language, displayStats.dataSovereigntyComplianceScore)}%` : '—'}</div>
        </button>
      </div>

      {/* Overdue ribbon — now uses real filtered count */}
      {overdueList.length > 0 && (
        <button type="button" className="parent-overview-ribbon parent-overview-ribbon-clickable"
          onClick={() => setShowOverdueModal(true)}>
          <span className="ribbon-icon" aria-hidden>⚠</span>
          <span className="ribbon-text">
            <strong>{formatNumber(language, overdueList.length)}</strong>{' '}
            {overdueList.length !== 1 ? t(language, 'overdueRibbonPlural') : t(language, 'overdueRibbon')}{' '}
            {t(language, 'overdueRibbonSuffix')}
          </span>
        </button>
      )}

      {/* Overdue modal */}
      {showOverdueModal && (
        <div className="ph-overdue-modal-overlay" onClick={() => setShowOverdueModal(false)}>
          <div className="ph-overdue-modal" onClick={e => e.stopPropagation()}>
            <button type="button" className="ph-overdue-modal-close" onClick={() => setShowOverdueModal(false)}>×</button>
            <h3 className="ph-overdue-modal-title">
              {t(language, 'overdueModalTitle')}{selectedParentHolding ? ` — ${selectedParentHolding}` : ''}
            </h3>
            <div className="ph-overdue-modal-body">
              <div className="ph-overdue-table-wrap">
                <table className="ph-overdue-table">
                  <thead>
                    <tr>
                      <th>{t(language, 'overdueTableFramework')}</th>
                      <th>{t(language, 'overdueTableTitle')}</th>
                      <th>{t(language, 'overdueTableDeadline')}</th>
                      <th>{t(language, 'overdueTableAffectedOpCos')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdueList.map(c => {
                      const affectedHere = (c.affectedCompanies || []).filter(co => opcoNamesSet.has(co));
                      return (
                        <tr key={c.id}>
                          <td>{c.framework || '—'}</td>
                          <td>{c.title || '—'}</td>
                          <td>{c.deadline ? new Date(c.deadline).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en') : '—'}</td>
                          <td>{affectedHere.join(', ') || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OpCo compliance table */}
      <section className="parent-overview-table-section">
        <h3 className="parent-overview-table-title">
          {t(language, 'opcosByComplianceStatus')}
          {selectedParentHolding && <span className="ph-table-subtitle"> {t(language, 'opcosFor')} {selectedParentHolding}</span>}
        </h3>
        {!selectedParentHolding ? (
          <p className="ph-table-empty-msg">{t(language, 'selectParentToShow')}</p>
        ) : loadingOpcos ? (
          <p className="ph-table-loading">{t(language, 'loadingOpCos')}</p>
        ) : activeRows.length === 0 ? (
          <p className="ph-table-empty-msg">{t(language, 'noOpCosFound')}</p>
        ) : (
          <div className="ph-table-wrap">
            <table className="ph-compliance-table">
              <thead>
                <tr>
                  <th>{t(language, 'opcoName')}</th>
                  <th>{t(language, 'jurisdiction')}</th>
                  <th>{t(language, 'governanceComplianceScore')}</th>
                  <th>{t(language, 'policyComplianceScore')}</th>
                  <th>{t(language, 'dataSovereigntyComplianceScore')}</th>
                  <th>{t(language, 'status')}</th>
                </tr>
              </thead>
              <tbody>
                {activeRows.map((row, i) => (
                  <tr key={row.opcoName + i}>
                    <td>{row.opcoName}</td>
                    <td>{row.jurisdiction}</td>
                    <td>{formatNumber(language, row.governanceScore)}%</td>
                    <td>{formatNumber(language, row.policyScore)}%</td>
                    <td>{formatNumber(language, row.dataSovereigntyScore)}%</td>
                    <td>
                      <span className={`ph-status ph-status-${row.status.toLowerCase().replace(' ', '-')}`}>
                        {t(language, statusKey(row.status))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* AI overview summary */}
      <section className="parent-overview-summary-section">
        <h3 className="parent-overview-table-title">
          {t(language, 'overviewAndSummaryTitle')}
          {selectedParentHolding && <span className="ph-table-subtitle"> {t(language, 'opcosFor')} {selectedParentHolding}</span>}
        </h3>
        {!selectedParentHolding ? (
          <p className="ph-table-empty-msg">{t(language, 'selectParentToShow')}</p>
        ) : overviewLoading ? (
          <p className="ph-table-loading">{t(language, 'overviewAndSummaryLoading')}</p>
        ) : overviewError ? (
          <p className="ph-table-empty-msg">{overviewError}</p>
        ) : !overviewSummary ? (
          <p className="ph-table-empty-msg">{t(language, 'overviewAndSummaryEmpty')}</p>
        ) : (
          <div className="ph-summary-card">
            {overviewSummary.overallSummary && <p className="ph-summary-text">{overviewSummary.overallSummary}</p>}
            {overviewSummary.documentScoreSummary && (
              <p className="ph-summary-text"><strong>{t(language, 'overviewAndSummaryDocuments')} </strong>{overviewSummary.documentScoreSummary}</p>
            )}
            {overviewSummary.frameworkComplianceSummary && (
              <p className="ph-summary-text"><strong>{t(language, 'overviewAndSummaryFrameworks')} </strong>{overviewSummary.frameworkComplianceSummary}</p>
            )}
            {overviewSummary.multiJurisdictionRiskSummary && (
              <p className="ph-summary-text"><strong>{t(language, 'overviewAndSummaryJurisdictions')} </strong>{overviewSummary.multiJurisdictionRiskSummary}</p>
            )}
            {Array.isArray(overviewSummary.keyActions) && overviewSummary.keyActions.length > 0 && (
              <div className="ph-summary-actions">
                <h4 className="ph-summary-actions-title">{t(language, 'overviewAndSummaryActions')}</h4>
                <ul>{overviewSummary.keyActions.map((action, idx) => <li key={idx}>{action}</li>)}</ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ─── COMPLIANCE INTELLIGENCE SECTION ──────────────────────────────── */}
      <section className="pho-intelligence-section">
        <div className="pho-section-header">
          <h3 className="pho-section-title">Compliance Intelligence</h3>
          {selectedParentHolding && (
            <span className="pho-section-org">
              {selectedOpco ? selectedOpco : selectedParentHolding}
            </span>
          )}
        </div>

        {!selectedParentHolding ? (
          <p className="pho-empty-state">Select a parent holding to view compliance intelligence.</p>
        ) : (
          <>
            {/* KPI Strip */}
            <div className="pho-kpi-strip">
              <button
                className="pho-kpi pho-kpi-overdue"
                onClick={() => overdueList.length > 0 && setShowOverdueModal(true)}
                style={{ cursor: overdueList.length > 0 ? 'pointer' : 'default' }}
              >
                <div className="pho-kpi-icon">⚠</div>
                <div className="pho-kpi-num">{overdueList.length}</div>
                <div className="pho-kpi-name">Overdue Items</div>
                <div className="pho-kpi-sub">Past compliance deadline</div>
              </button>
              <div className="pho-kpi pho-kpi-soon">
                <div className="pho-kpi-icon">⏱</div>
                <div className="pho-kpi-num">{upcoming30List.length}</div>
                <div className="pho-kpi-name">Due in 30 Days</div>
                <div className="pho-kpi-sub">Immediate action required</div>
              </div>
              <div className="pho-kpi pho-kpi-quarter">
                <div className="pho-kpi-icon">📅</div>
                <div className="pho-kpi-num">{upcoming90List.length}</div>
                <div className="pho-kpi-name">Due in 31–90 Days</div>
                <div className="pho-kpi-sub">Plan and allocate resources</div>
              </div>
              <div className="pho-kpi pho-kpi-breach">
                <div className="pho-kpi-icon">🔴</div>
                <div className="pho-kpi-num">{nonCompliantCount}</div>
                <div className="pho-kpi-name">Non-Compliant OpCos</div>
                <div className="pho-kpi-sub">Below {COMPLIANCE_THRESHOLD}% threshold</div>
              </div>
            </div>

            {/* Deadline Intelligence — 3 urgency columns */}
            <div className="pho-subsection">
              <h4 className="pho-subsection-title">Regulatory Deadline Intelligence</h4>
              <p className="pho-subsection-sub">
                {selectedOpco
                  ? `Showing deadlines for regulatory frameworks applicable to ${selectedOpco}.`
                  : `All deadlines are derived from regulatory change data filtered to ${selectedParentHolding}'s operating companies.`}
              </p>
              <div className="pho-dl-grid">
                <DeadlineColumn
                  title="Overdue"
                  count={overdueList.length}
                  items={overdueList}
                  type="overdue"
                  opcoNamesSet={opcoNamesSet}
                  emptyMsg="No overdue items — well done."
                />
                <DeadlineColumn
                  title="Due in Next 30 Days"
                  count={upcoming30List.length}
                  items={upcoming30List}
                  type="soon"
                  opcoNamesSet={opcoNamesSet}
                  emptyMsg="No items due in the next 30 days."
                />
                <DeadlineColumn
                  title="Due in 31–90 Days"
                  count={upcoming90List.length}
                  items={upcoming90List}
                  type="quarter"
                  opcoNamesSet={opcoNamesSet}
                  emptyMsg="No items due in the next quarter."
                />
              </div>
            </div>

            {/* Analysis row: Framework Risk Matrix + OpCo Compliance Profile */}
            <div className="pho-analysis-row">

              {/* Framework Risk Matrix */}
              <div className="pho-analysis-card">
                <h4 className="pho-analysis-card-title">Framework Risk Matrix</h4>
                <p className="pho-analysis-card-sub">Risk level per regulatory framework based on deadline status.</p>
                {frameworkRiskData.length === 0 ? (
                  <p className="pho-no-data">No regulatory changes tracked for this group's OpCos.</p>
                ) : (
                  <div className="pho-fw-table-wrap">
                    <table className="pho-fw-table">
                      <thead>
                        <tr>
                          <th>Framework</th>
                          <th className="pho-th-overdue">⚠ Overdue</th>
                          <th className="pho-th-soon">⏱ ≤30d</th>
                          <th className="pho-th-quarter">📅 31–90d</th>
                          <th>Risk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {frameworkRiskData.map(fw => (
                          <tr key={fw.framework} className={fw.overdue > 0 ? 'pho-fw-row-overdue' : fw.soon > 0 ? 'pho-fw-row-soon' : ''}>
                            <td><FrameworkBadge name={fw.framework} /></td>
                            <td className={`pho-fw-td-center ${fw.overdue > 0 ? 'pho-td-overdue' : ''}`}>
                              {fw.overdue > 0 ? fw.overdue : '—'}
                            </td>
                            <td className={`pho-fw-td-center ${fw.soon > 0 ? 'pho-td-soon' : ''}`}>
                              {fw.soon > 0 ? fw.soon : '—'}
                            </td>
                            <td className="pho-fw-td-center">
                              {fw.quarter > 0 ? fw.quarter : '—'}
                            </td>
                            <td><RiskLevelBadge level={fw.riskLevel} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* OpCo Compliance Profile */}
              <div className="pho-analysis-card">
                <h4 className="pho-analysis-card-title">OpCo Compliance Profile</h4>
                <p className="pho-analysis-card-sub">
                  Sorted by weakest average score. Threshold line at {COMPLIANCE_THRESHOLD}%.
                </p>
                {sortedOpcos.length === 0 ? (
                  <p className="pho-no-data">No OpCo data available.</p>
                ) : (
                  <div className="pho-opco-profile">
                    {sortedOpcos.slice(0, 12).map(row => (
                      <OpcoComplianceRow key={row.opcoName} row={row} />
                    ))}
                    {sortedOpcos.length > 12 && (
                      <p className="pho-opco-more">+ {sortedOpcos.length - 12} more OpCos — see table above</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Grouped bar chart — bottom 10 performers */}
            {barChartData.length > 0 && (
              <div className="pho-subsection">
                <h4 className="pho-subsection-title">Compliance Score Breakdown — Lowest Performing OpCos</h4>
                <p className="pho-subsection-sub">
                  Showing up to 10 lowest-scoring OpCos. The red dashed line marks the {COMPLIANCE_THRESHOLD}% compliance threshold.
                  Each bar represents a compliance dimension measured independently.
                </p>
                <div className="pho-chart-card">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={barChartData}
                      margin={{ top: 8, right: 16, left: 0, bottom: 48 }}
                      barCategoryGap="28%"
                      barGap={2}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10, fill: '#888' }}
                        angle={-35}
                        textAnchor="end"
                        interval={0}
                        height={60}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 10, fill: '#888' }}
                        tickFormatter={v => `${v}%`}
                        width={36}
                      />
                      <Tooltip content={<ComplianceTooltip />} />
                      <Legend
                        wrapperStyle={{ fontSize: 11, paddingTop: 8, color: '#aaa' }}
                        iconType="square"
                        iconSize={10}
                      />
                      <ReferenceLine
                        y={COMPLIANCE_THRESHOLD}
                        stroke="#ef4444"
                        strokeDasharray="4 3"
                        strokeWidth={1.5}
                        label={{ value: `${COMPLIANCE_THRESHOLD}% Threshold`, position: 'insideTopRight', fill: '#ef4444', fontSize: 10 }}
                      />
                      <Bar dataKey="Governance" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={24} />
                      <Bar dataKey="Policy" fill="#8b5cf6" radius={[3, 3, 0, 0]} maxBarSize={24} />
                      <Bar dataKey="Data Sovereignty" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
