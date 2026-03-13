import { useState, useEffect, useMemo } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { t, formatNumber } from '../i18n';
import './ParentHoldingOverview.css';

/** Build 6-month trend data: scores + Cyber Premium (inverse to Data Sovereignty) + financial outcome series. */
function buildTrendData(displayStats) {
  const g = displayStats.governanceComplianceScore ?? 87;
  const p = displayStats.policyComplianceScore ?? 84;
  const d = displayStats.dataSovereigntyComplianceScore ?? 82;
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const dte = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = dte.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    const t_ = (5 - i) / 5; // 0 -> 1 over 6 months
    const governanceScore = clamp(Math.round(g - (1 - t_) * 8 + (Math.sin(i) * 2)), 0, 100);
    const policyScore = clamp(Math.round(p - (1 - t_) * 6 + (Math.cos(i * 1.1) * 2)), 0, 100);
    const dataSovereigntyScore = clamp(Math.round(d - (1 - t_) * 5 + (Math.sin(i * 0.9) * 2)), 0, 100);
    // Inverse correlation: higher Data Sovereignty → lower Cyber Insurance Premium
    const cyberPremium = clamp(Math.round(60 + (100 - dataSovereigntyScore) * 0.38), 60, 100);
    months.push({
      month: label,
      governanceScore,
      policyScore,
      dataSovereigntyScore,
      cyberPremium,
      financialOutcomeOperations: clamp(Math.round(94 + t_ * 8 + Math.cos(i) * 2), 88, 108),
      financialOutcomeGovernance: clamp(Math.round(93 + t_ * 9 + Math.sin(i * 1.2) * 2), 88, 108),
    });
  }
  return months;
}

const API = '/api';
const UBO_STORAGE_KEY = 'ubo_register';

function getUboKeyFor(parent, opco) {
  return `${parent || ''}::${opco || ''}`;
}

function getRegisteredAddressForOpco(parentName, opcoName) {
  try {
    const raw = localStorage.getItem(UBO_STORAGE_KEY);
    if (!raw) return '';
    const data = JSON.parse(raw);
    const key = getUboKeyFor(parentName, opcoName);
    const entry = data[key];
    const details = entry?.details && typeof entry.details === 'object' ? entry.details : {};
    return typeof details.registeredAddress === 'string' ? details.registeredAddress.trim() : '';
  } catch {
    return '';
  }
}

/** Map framework to jurisdiction for display. */
function frameworkToJurisdiction(framework) {
  if (!framework) return '—';
  const uaeFrameworks = [
    'DFSA Rulebook', 'Dubai 2040', 'ADGM FSRA Rulebook', 'ADGM Companies Regulations',
    'CBUAE Rulebook', 'UAE AML/CFT', 'UAE Federal Laws', 'JAFZA Operating Regulations',
    'DMCC Company Regulations', 'DMCC Compliance & AML',
  ];
  if (uaeFrameworks.includes(framework)) return 'UAE';
  if (['SAMA', 'CMA', 'Saudi 2030', 'SDAIA'].includes(framework)) return 'KSA';
  if (['QFCRA Rules', 'Qatar AML Law'].includes(framework)) return 'Qatar';
  if (['CBB Rulebook', 'BHB Sustainability ESG'].includes(framework)) return 'Bahrain';
  if (['Oman CMA Regulations', 'Oman AML Law'].includes(framework)) return 'Oman';
  if (['Kuwait CMA Regulations', 'Kuwait AML Law'].includes(framework)) return 'Kuwait';
  return framework;
}

/** Known compliance data by OpCo name. Mix of 70s, 80s, 90s; some OpCos have all three scores above 80. */
const OPCO_COMPLIANCE_LOOKUP = {
  'Emirates NBD Capital': { governanceScore: 92, policyScore: 88, dataSovereigntyScore: 85, status: 'Compliant' },
  'Emirates Investment Bank': { governanceScore: 86, policyScore: 82, dataSovereigntyScore: 84, status: 'Compliant' },
  'Mashreq Capital': { governanceScore: 78, policyScore: 74, dataSovereigntyScore: 76, status: 'Compliant' },
  'Dubai Islamic Bank (DIFC)': { governanceScore: 72, policyScore: 69, dataSovereigntyScore: 71, status: 'At Risk' },
  'Saudi National Bank (SNB)': { governanceScore: 91, policyScore: 89, dataSovereigntyScore: 87, status: 'Compliant' },
  'Saudi National Bank': { governanceScore: 90, policyScore: 88, dataSovereigntyScore: 86, status: 'Compliant' },
  'Al Rajhi Bank': { governanceScore: 88, policyScore: 85, dataSovereigntyScore: 83, status: 'Compliant' },
  'Al Rajhi Capital': { governanceScore: 82, policyScore: 79, dataSovereigntyScore: 77, status: 'Compliant' },
  'Riyad Bank': { governanceScore: 71, policyScore: 68, dataSovereigntyScore: 70, status: 'At Risk' },
  'Riyad Capital': { governanceScore: 76, policyScore: 73, dataSovereigntyScore: 75, status: 'Compliant' },
  'STC Pay': { governanceScore: 94, policyScore: 92, dataSovereigntyScore: 90, status: 'Compliant' },
  'Saudi Telecom (STC)': { governanceScore: 89, policyScore: 86, dataSovereigntyScore: 84, status: 'Compliant' },
  'Saudi Aramco': { governanceScore: 93, policyScore: 95, dataSovereigntyScore: 91, status: 'Compliant' },
  'SNB Capital': { governanceScore: 83, policyScore: 81, dataSovereigntyScore: 82, status: 'Compliant' },
  'JP Morgan (DIFC)': { governanceScore: 96, policyScore: 94, dataSovereigntyScore: 92, status: 'Compliant' },
  'Shuaa Capital': { governanceScore: 79, policyScore: 76, dataSovereigntyScore: 78, status: 'Compliant' },
  'Arqaam Capital': { governanceScore: 75, policyScore: 72, dataSovereigntyScore: 74, status: 'Compliant' },
  'Al Mal Capital': { governanceScore: 73, policyScore: 70, dataSovereigntyScore: 72, status: 'Compliant' },
  'Goldman Sachs (DIFC)': { governanceScore: 92, policyScore: 90, dataSovereigntyScore: 88, status: 'Compliant' },
  'Deutsche Bank (DIFC)': { governanceScore: 87, policyScore: 84, dataSovereigntyScore: 85, status: 'Compliant' },
  'Standard Chartered (DIFC)': { governanceScore: 85, policyScore: 83, dataSovereigntyScore: 82, status: 'Compliant' },
  'Barclays (DIFC)': { governanceScore: 84, policyScore: 82, dataSovereigntyScore: 81, status: 'Compliant' },
  'Dubai Holding': { governanceScore: 81, policyScore: 78, dataSovereigntyScore: 80, status: 'Compliant' },
  'DP World': { governanceScore: 86, policyScore: 84, dataSovereigntyScore: 83, status: 'Compliant' },
  'Emaar Properties': { governanceScore: 83, policyScore: 81, dataSovereigntyScore: 82, status: 'Compliant' },
  'NEOM': { governanceScore: 88, policyScore: 85, dataSovereigntyScore: 86, status: 'Compliant' },
  'Red Sea Global': { governanceScore: 82, policyScore: 80, dataSovereigntyScore: 79, status: 'Compliant' },
  'ROSHN': { governanceScore: 77, policyScore: 74, dataSovereigntyScore: 76, status: 'Compliant' },
  'SABIC': { governanceScore: 84, policyScore: 86, dataSovereigntyScore: 82, status: 'Compliant' },
  'Ma\'aden': { governanceScore: 72, policyScore: 69, dataSovereigntyScore: 71, status: 'At Risk' },
  'Mada': { governanceScore: 88, policyScore: 85, dataSovereigntyScore: 86, status: 'Compliant' },
  'Saudi Payments': { governanceScore: 85, policyScore: 83, dataSovereigntyScore: 84, status: 'Compliant' },
};

const DEFAULT_COMPLIANCE = { governanceScore: 75, policyScore: 78, dataSovereigntyScore: 72, status: 'Compliant' };

/** 40% mix: 70s / 80s / 90s varied triplets (distinct per row). */
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

/** 60%: all three scores > 80. */
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

/** Return whether a change affects the given parent (by affectedParents). If no parent selected, all changes apply. */
function changeAffectsParent(change, parentName) {
  if (!parentName) return true;
  const parents = change.affectedParents || [];
  return parents.some((p) => p.parent === parentName);
}

export function ParentHoldingOverview({ language = 'en', parents = [], selectedParentHolding, onParentHoldingChange, onNavigateToView, companiesRefreshKey = 0 }) {
  const [overdueChanges, setOverdueChanges] = useState([]);
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
  // Live compliance scores from API (keyed by opco name)
  const [liveScores, setLiveScores] = useState({});
  const [overviewSummary, setOverviewSummary] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState(null);
  const [overviewKey, setOverviewKey] = useState('');

  useEffect(() => {
    if (!selectedParentHolding) {
      setOpcosForParent([]);
      setJurisdictionByOpco({});
      return;
    }
    setJurisdictionByOpco({});
    setLoadingOpcos(true);
    fetch(`${API}/companies/by-parent?parent=${encodeURIComponent(selectedParentHolding)}`)
      .then((r) => r.json())
      .then((data) => setOpcosForParent(data.opcos || []))
      .catch(() => setOpcosForParent([]))
      .finally(() => setLoadingOpcos(false));
  }, [selectedParentHolding, companiesRefreshKey]);

  useEffect(() => {
    if (!selectedParentHolding) { setLiveScores({}); return; }
    fetch(`${API}/companies/compliance-scores?parent=${encodeURIComponent(selectedParentHolding)}`)
      .then((r) => r.json())
      .then((data) => {
        const map = {};
        (data.scores || []).forEach((s) => { map[s.name] = s; });
        setLiveScores(map);
      })
      .catch(() => setLiveScores({}));
  }, [selectedParentHolding, companiesRefreshKey]);

  const COMPLIANCE_THRESHOLD = 80;

  const opcoMeta = useMemo(() => {
    const byName = {};
    for (const { name, framework, locations } of opcosForParent) {
      if (!byName[name]) byName[name] = { frameworks: [], locations: [] };
      byName[name].frameworks.push(framework);
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
    const byName = {};
    for (const { name, framework, locations } of opcosForParent) {
      if (!byName[name]) byName[name] = { frameworks: [], locations: [] };
      byName[name].frameworks.push(framework);
      if (Array.isArray(locations) && locations.length > 0) byName[name].locations = locations;
    }
    const multiSet = new Set();
    Object.entries(byName).forEach(([name, data]) => {
      if (data.locations.length > 1) multiSet.add(name);
      else if (new Set((data.frameworks || []).map(frameworkToJurisdiction).filter(Boolean)).size > 1) multiSet.add(name);
    });
    let cancelled = false;
    Object.keys(byName).forEach((opcoName) => {
      if (multiSet.has(opcoName)) return;
      const addr = getRegisteredAddressForOpco(selectedParentHolding, opcoName);
      if (!addr) return;
      fetch(`${API}/ubo/extract-country-from-address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registeredAddress: addr }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          const country = (data.country || '').trim();
          if (country) setJurisdictionByOpco((prev) => ({ ...prev, [opcoName]: country }));
        })
        .catch(() => {});
    });
    return () => { cancelled = true; };
  }, [selectedParentHolding, opcosForParent]);

  const tableRows = useMemo(() => {
    const uniqueNames = [];
    const seen = new Set();
    for (const { name } of opcosForParent) {
      if (!seen.has(name)) {
        seen.add(name);
        uniqueNames.push(name);
      }
    }
    const n = uniqueNames.length;
    const useSplit = n > 5;
    const nMix = useSplit ? Math.round(0.4 * n) : 0;
    const opcoToIndex = {};
    uniqueNames.forEach((name, i) => { opcoToIndex[name] = i; });

    return uniqueNames.map((name) => {
      const framework = (opcoMeta.byName[name]?.frameworks || [])[0];
      const isMulti = !!opcoMeta.isMultiJurisdiction[name];
      const jurisdictionDisplay = isMulti ? 'multi-jurisdiction' : (jurisdictionByOpco[name] ?? '—');
      let compliance;
      if (liveScores[name]) {
        // Use real data-driven scores from the API
        compliance = liveScores[name];
      } else if (useSplit) {
        const idx = opcoToIndex[name];
        const triplet = idx < nMix
          ? MIX_SCORE_TRIPLETS[idx % MIX_SCORE_TRIPLETS.length]
          : ABOVE80_SCORE_TRIPLETS[(idx - nMix) % ABOVE80_SCORE_TRIPLETS.length];
        compliance = { ...triplet, status: triplet.governanceScore >= COMPLIANCE_THRESHOLD && triplet.policyScore >= COMPLIANCE_THRESHOLD && triplet.dataSovereigntyScore >= COMPLIANCE_THRESHOLD ? 'Compliant' : 'Non-Compliant' };
      } else {
        compliance = OPCO_COMPLIANCE_LOOKUP[name] || DEFAULT_COMPLIANCE;
      }
      const governanceScore = compliance.governanceScore;
      const policyScore = compliance.policyScore;
      const dataSovereigntyScore = compliance.dataSovereigntyScore;
      const anyBelowThreshold =
        governanceScore < COMPLIANCE_THRESHOLD ||
        policyScore < COMPLIANCE_THRESHOLD ||
        dataSovereigntyScore < COMPLIANCE_THRESHOLD;
      const status = anyBelowThreshold ? 'Non-Compliant' : (compliance.status || 'Compliant');
      return {
        opcoName: name,
        jurisdiction: jurisdictionDisplay,
        governanceScore,
        policyScore,
        dataSovereigntyScore,
        status,
      };
    });
  }, [opcosForParent, opcoMeta, jurisdictionByOpco, liveScores]);

  // Derive aggregate stats from live scores when available
  useEffect(() => {
    const scoreValues = Object.values(liveScores);
    if (scoreValues.length === 0) return;
    const avg = (key) => Math.round(scoreValues.reduce((s, v) => s + (v[key] || 0), 0) / scoreValues.length);
    setStats((prev) => ({
      ...prev,
      governanceComplianceScore: avg('governanceScore'),
      policyComplianceScore: avg('policyScore'),
      dataSovereigntyComplianceScore: avg('dataSovereigntyScore'),
      operatingCompaniesCount: scoreValues.length || prev.operatingCompaniesCount,
    }));
  }, [liveScores]);

  // Helper: read mandatory UBO / compliance document completion for an OpCo
  // across all parent–OpCo records in the UBO register. A document is treated
  // as completed for the OpCo if it is uploaded under any parent for that OpCo.
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
          if (!d || !d.id) return;
          const id = d.id;
          if (!docsById[id]) {
            docsById[id] = { uploaded: !!d.uploaded };
          } else if (d.uploaded) {
            docsById[id].uploaded = true;
          }
        });
      });
      const ids = Object.keys(docsById);
      if (!ids.length) return null;
      const MANDATORY_TOTAL = 7; // aligns with Mandatory UBO Documents list
      const total = Math.max(ids.length, MANDATORY_TOTAL);
      const completed = ids.filter((id) => docsById[id].uploaded).length;
      if (!total) return null;
      return { completed, total };
    } catch {
      return null;
    }
  }

  // Card values = averages of the corresponding table column only (so card and column stay in sync; each score distinct).
  const displayStats = (() => {
    if (!selectedParentHolding || tableRows.length === 0) {
      return { ...stats, operatingCompaniesCount: selectedParentHolding ? tableRows.length : stats.operatingCompaniesCount };
    }
    const n = tableRows.length;
    const avgGovernance = Math.round(
      tableRows.reduce((sum, r) => sum + (r.governanceScore ?? DEFAULT_COMPLIANCE.governanceScore), 0) / n
    );
    const avgPolicy = Math.round(
      tableRows.reduce((sum, r) => sum + (r.policyScore ?? DEFAULT_COMPLIANCE.policyScore), 0) / n
    );
    const avgDataSovereignty = Math.round(
      tableRows.reduce((sum, r) => sum + (r.dataSovereigntyScore ?? DEFAULT_COMPLIANCE.dataSovereigntyScore), 0) / n
    );
    return {
      ...stats,
      operatingCompaniesCount: n,
      governanceComplianceScore: avgGovernance,
      policyComplianceScore: avgPolicy,
      dataSovereigntyComplianceScore: avgDataSovereignty,
    };
  })();

  const trendData = useMemo(
    () => (selectedParentHolding ? buildTrendData(displayStats) : []),
    [
      selectedParentHolding,
      displayStats.governanceComplianceScore,
      displayStats.policyComplianceScore,
      displayStats.dataSovereigntyComplianceScore,
    ]
  );

  useEffect(() => {
    fetch(`${API}/changes?days=365`)
      .then((r) => r.json())
      .then((data) => {
        const changes = Array.isArray(data) ? data : [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const overdue = changes.filter((c) => {
          if (!c.deadline) return false;
          const d = new Date(c.deadline);
          d.setHours(0, 0, 0, 0);
          return d < today;
        });
        setOverdueChanges(overdue);
      })
      .catch(() => {});
  }, []);

  const overdueForDisplay = selectedParentHolding
    ? overdueChanges.filter((c) => changeAffectsParent(c, selectedParentHolding))
    : [];
  const overdueCount = overdueForDisplay.length;

  const statusKey = (s) => {
    if (s === 'Compliant') return 'compliant';
    if (s === 'Non-Compliant') return 'nonCompliant';
    if (s === 'At Risk') return 'atRisk';
    return s;
  };

  // Build LLM-powered overview & summary for the selected parent using current table rows and overdue changes.
  useEffect(() => {
    const currentKey = selectedParentHolding
      ? `${selectedParentHolding}::${tableRows.length}::${overdueForDisplay.length}`
      : '';

    if (!selectedParentHolding || tableRows.length === 0) {
      setOverviewSummary(null);
      setOverviewError(null);
      setOverviewLoading(false);
      setOverviewKey('');
      return;
    }

    if (overviewKey === currentKey) {
      return;
    }

    setOverviewKey(currentKey);
    const opcosPayload = tableRows.map((row) => ({
      opcoName: row.opcoName,
      jurisdiction: row.jurisdiction,
      governanceScore: row.governanceScore,
      policyScore: row.policyScore,
      dataSovereigntyScore: row.dataSovereigntyScore,
      status: row.status,
      isMultiJurisdiction: !!opcoMeta.isMultiJurisdiction[row.opcoName],
      uboDocs: getUboDocSummary(row.opcoName),
    }));
    const overduePayload = overdueForDisplay.map((c) => {
      const opcosForRow = selectedParentHolding
        ? (c.affectedParents || []).find((p) => p.parent === selectedParentHolding)?.companies
        : c.affectedCompanies;
      const opcoList = Array.isArray(opcosForRow)
        ? opcosForRow
        : Array.isArray(c.affectedCompanies)
        ? c.affectedCompanies
        : [];
      return {
        framework: c.framework || '',
        title: c.title || '',
        deadline: c.deadline || '',
        affectedOpcos: opcoList,
      };
    });
    setOverviewLoading(true);
    setOverviewError(null);
    fetch(`${API}/analysis/overview-summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parent: selectedParentHolding,
        opcos: opcosPayload,
        overdueChanges: overduePayload,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) {
          setOverviewSummary(data);
        } else {
          setOverviewSummary(null);
          setOverviewError(data.error || 'Failed to build overview summary');
        }
      })
      .catch((e) => {
        setOverviewSummary(null);
        setOverviewError(e.message || 'Failed to build overview summary');
      })
      .finally(() => setOverviewLoading(false));
  }, [selectedParentHolding, tableRows.length, overdueForDisplay.length, overviewKey]);

  return (
    <div className="parent-overview">
      <h2 className="parent-overview-title">{t(language, 'parentOverviewTitle')}</h2>

      <div className="parent-overview-select-wrap">
        <label htmlFor="parent-holding-select">{t(language, 'parentHoldingCompany')}</label>
        <select
          id="parent-holding-select"
          className="parent-holding-select"
          value={selectedParentHolding || ''}
          onChange={(e) => onParentHoldingChange(e.target.value || '')}
        >
          <option value="">{t(language, 'selectParentPlaceholder')}</option>
          {parents.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        {selectedParentHolding && (
          <span className="parent-overview-selection-note">{t(language, 'selectionAppliesNote')}</span>
        )}
      </div>

      <div className="parent-overview-cards">
        <div className="ph-card">
          <div className="ph-card-label">{t(language, 'totalOpCos')}</div>
          <div className="ph-card-value">{selectedParentHolding ? formatNumber(language, displayStats.operatingCompaniesCount) : '—'}</div>
        </div>
        <button
          type="button"
          className="ph-card ph-card-clickable"
          onClick={() => onNavigateToView?.('governance-framework')}
          title={t(language, 'goToGovernance')}
        >
          <div className="ph-card-label">{t(language, 'governanceComplianceScore')}</div>
          <div className="ph-card-value">{selectedParentHolding ? `${formatNumber(language, displayStats.governanceComplianceScore)}%` : '—'}</div>
        </button>
        <button
          type="button"
          className="ph-card ph-card-clickable"
          onClick={() => onNavigateToView?.('multi-jurisdiction')}
          title={t(language, 'goToMultiJurisdiction')}
        >
          <div className="ph-card-label">{t(language, 'policyComplianceScore')}</div>
          <div className="ph-card-value">{selectedParentHolding ? `${formatNumber(language, displayStats.policyComplianceScore)}%` : '—'}</div>
        </button>
        <button
          type="button"
          className="ph-card ph-card-clickable"
          onClick={() => onNavigateToView?.('data-sovereignty')}
          title={t(language, 'goToDataSovereignty')}
        >
          <div className="ph-card-label">{t(language, 'dataSovereigntyComplianceScore')}</div>
          <div className="ph-card-value">{selectedParentHolding ? `${formatNumber(language, displayStats.dataSovereigntyComplianceScore)}%` : '—'}</div>
        </button>
      </div>

      {overdueCount > 0 && (
        <button
          type="button"
          className="parent-overview-ribbon parent-overview-ribbon-clickable"
          onClick={() => setShowOverdueModal(true)}
          title={t(language, 'viewOverdueTitle')}
        >
          <span className="ribbon-icon" aria-hidden>⚠</span>
          <span className="ribbon-text">
            <strong>{formatNumber(language, overdueCount)}</strong>{' '}
            {overdueCount !== 1 ? t(language, 'overdueRibbonPlural') : t(language, 'overdueRibbon')} {t(language, 'overdueRibbonSuffix')}
          </span>
        </button>
      )}

      {showOverdueModal && (
        <div className="ph-overdue-modal-overlay" onClick={() => setShowOverdueModal(false)}>
          <div className="ph-overdue-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="ph-overdue-modal-close"
              onClick={() => setShowOverdueModal(false)}
              aria-label={t(language, 'close')}
              title={t(language, 'close')}
            >
              ×
            </button>
            <h3 className="ph-overdue-modal-title">
              {t(language, 'overdueModalTitle')}
              {selectedParentHolding ? ` — ${selectedParentHolding}` : ''}
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
                      {!selectedParentHolding && <th>{t(language, 'overdueTableAffectedParents')}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {overdueForDisplay.map((c) => {
                      const opcosForRow = selectedParentHolding
                        ? (c.affectedParents || []).find((p) => p.parent === selectedParentHolding)?.companies
                        : c.affectedCompanies;
                      const opcoList = Array.isArray(opcosForRow) ? opcosForRow : (c.affectedCompanies || []);
                      const opcoNames = opcoList.join(', ') || '—';
                      return (
                        <tr key={c.id}>
                          <td>{c.framework || '—'}</td>
                          <td>{c.title || '—'}</td>
                          <td>{c.deadline ? new Date(c.deadline).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en') : '—'}</td>
                          <td>{opcoNames}</td>
                          {!selectedParentHolding && (
                            <td>
                              {(c.affectedParents || []).map((p) => p.parent).join(', ') || '—'}
                            </td>
                          )}
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

      <section className="parent-overview-table-section">
        <h3 className="parent-overview-table-title">
          {t(language, 'opcosByComplianceStatus')}
          {selectedParentHolding && (
            <span className="ph-table-subtitle"> {t(language, 'opcosFor')} {selectedParentHolding}</span>
          )}
        </h3>
        {!selectedParentHolding ? (
          <p className="ph-table-empty-msg">{t(language, 'selectParentToShow')}</p>
        ) : loadingOpcos ? (
          <p className="ph-table-loading">{t(language, 'loadingOpCos')}</p>
        ) : tableRows.length === 0 ? (
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
                {tableRows.map((row, i) => (
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

      <section className="parent-overview-summary-section">
        <h3 className="parent-overview-table-title">
          {t(language, 'overviewAndSummaryTitle')}
          {selectedParentHolding && (
            <span className="ph-table-subtitle"> {t(language, 'opcosFor')} {selectedParentHolding}</span>
          )}
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
            {overviewSummary.overallSummary && (
              <p className="ph-summary-text">{overviewSummary.overallSummary}</p>
            )}
            {overviewSummary.documentScoreSummary && (
              <p className="ph-summary-text">
                <strong>{t(language, 'overviewAndSummaryDocuments')} </strong>
                {overviewSummary.documentScoreSummary}
              </p>
            )}
            {overviewSummary.frameworkComplianceSummary && (
              <p className="ph-summary-text">
                <strong>{t(language, 'overviewAndSummaryFrameworks')} </strong>
                {overviewSummary.frameworkComplianceSummary}
              </p>
            )}
            {overviewSummary.multiJurisdictionRiskSummary && (
              <p className="ph-summary-text">
                <strong>{t(language, 'overviewAndSummaryJurisdictions')} </strong>
                {overviewSummary.multiJurisdictionRiskSummary}
              </p>
            )}
            {Array.isArray(overviewSummary.keyActions) && overviewSummary.keyActions.length > 0 && (
              <div className="ph-summary-actions">
                <h4 className="ph-summary-actions-title">{t(language, 'overviewAndSummaryActions')}</h4>
                <ul>
                  {overviewSummary.keyActions.map((action, idx) => (
                    <li key={idx}>{action}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="ph-visualization-section">
        <h3 className="parent-overview-table-title">{t(language, 'visualization')}</h3>
        {!selectedParentHolding ? (
          <p className="ph-visualization-empty">{t(language, 'selectParentToShow')}</p>
        ) : (
          <>
            <p className="ph-visualization-intro">{t(language, 'trendLast6Months')}</p>
            <div className="ph-visualization-charts">
              <div className="ph-viz-chart-card">
            <h4 className="ph-viz-chart-title">
              {t(language, 'dataSovereigntyComplianceScore')} vs {t(language, 'cyberInsurancePremium')}
            </h4>
            <div className="ph-viz-chart-inner">
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={trendData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis yAxisId="score" orientation="left" domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis yAxisId="premium" orientation="right" domain={[60, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}
                    formatter={(value, name) => [name === 'dataSovereigntyScore' ? `${value}%` : value, name === 'dataSovereigntyScore' ? t(language, 'dataSovereigntyComplianceScore') : t(language, 'cyberInsurancePremium')]}
                    labelStyle={{ color: 'var(--text)' }}
                  />
                  <Legend formatter={(name) => (name === 'dataSovereigntyScore' ? t(language, 'dataSovereigntyComplianceScore') : t(language, 'cyberInsurancePremium'))} />
                  <Line yAxisId="score" type="monotone" dataKey="dataSovereigntyScore" name="dataSovereigntyScore" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
                  <Line yAxisId="premium" type="monotone" dataKey="cyberPremium" name="cyberPremium" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="ph-viz-chart-card">
            <h4 className="ph-viz-chart-title">
              {t(language, 'policyComplianceScore')} vs {t(language, 'financialOutcomeOperations')}
            </h4>
            <div className="ph-viz-chart-inner">
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={trendData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis yAxisId="score" orientation="left" domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis yAxisId="index" orientation="right" domain={[88, 108]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}
                    formatter={(value, name) => [name === 'policyScore' ? `${value}%` : value, name === 'policyScore' ? t(language, 'policyComplianceScore') : t(language, 'financialOutcomeOperations')]}
                    labelStyle={{ color: 'var(--text)' }}
                  />
                  <Legend formatter={(name) => (name === 'policyScore' ? t(language, 'policyComplianceScore') : t(language, 'financialOutcomeOperations'))} />
                  <Line yAxisId="score" type="monotone" dataKey="policyScore" name="policyScore" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
                  <Line yAxisId="index" type="monotone" dataKey="financialOutcomeOperations" name="financialOutcomeOperations" stroke="#eab308" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="ph-viz-chart-card">
            <h4 className="ph-viz-chart-title">
              {t(language, 'governanceComplianceScore')} vs {t(language, 'financialOutcomeGovernance')}
            </h4>
            <div className="ph-viz-chart-inner">
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={trendData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis yAxisId="score" orientation="left" domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis yAxisId="index" orientation="right" domain={[88, 108]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}
                    formatter={(value, name) => [name === 'governanceScore' ? `${value}%` : value, name === 'governanceScore' ? t(language, 'governanceComplianceScore') : t(language, 'financialOutcomeGovernance')]}
                    labelStyle={{ color: 'var(--text)' }}
                  />
                  <Legend formatter={(name) => (name === 'governanceScore' ? t(language, 'governanceComplianceScore') : t(language, 'financialOutcomeGovernance'))} />
                  <Line yAxisId="score" type="monotone" dataKey="governanceScore" name="governanceScore" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
                  <Line yAxisId="index" type="monotone" dataKey="financialOutcomeGovernance" name="financialOutcomeGovernance" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
