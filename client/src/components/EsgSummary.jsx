import { useState, useMemo, useEffect } from 'react';
import './EsgSummary.css';

const API = '/api';

const OPERATIONAL_CAPABILITIES = [
  {
    id: 'data-collection',
    title: 'Data collection & aggregation',
    description: 'Structured collection of environmental (emissions, energy, water, waste), social (workforce, safety, diversity), and governance (board, ethics, anti-corruption) data from business units and subsidiaries.',
  },
  {
    id: 'metrics-definition',
    title: 'Metrics definition & taxonomy',
    description: 'Alignment with standard ESG metrics (GRI, SASB, TCFD) and internal taxonomy; definition of KPIs, boundaries (Scope 1/2/3), and calculation methodologies.',
  },
  {
    id: 'reporting-disclosure',
    title: 'Reporting & disclosure',
    description: 'Production of sustainability reports, ESG disclosures for regulators and exchanges (e.g. Tadawul, ADX, DFM), and investor-grade reporting (annual, interim).',
  },
  {
    id: 'assurance-audit',
    title: 'Assurance & audit',
    description: 'Internal controls over ESG data; external assurance (limited/reasonable) for selected metrics; audit trails and evidence for verification.',
  },
  {
    id: 'governance-structure',
    title: 'Governance structure',
    description: 'Board oversight of ESG; dedicated committees (sustainability/ESG); ownership of ESG strategy and targets; integration with risk and compliance.',
  },
  {
    id: 'stakeholder-engagement',
    title: 'Stakeholder engagement',
    description: 'Processes to identify and engage stakeholders (investors, employees, communities, regulators); materiality assessment and double materiality where required.',
  },
  {
    id: 'scenario-analysis',
    title: 'Scenario & climate analysis',
    description: 'Climate scenario analysis (e.g. 1.5°C/2°C pathways); transition and physical risk assessment; alignment with net-zero or science-based targets where applicable.',
  },
  {
    id: 'systems-integration',
    title: 'Systems & integration',
    description: 'ESG data platforms; integration with ERP, EHS, HR and other source systems; workflow for data validation, sign-off and submission.',
  },
];

const MENA_FRAMEWORKS = [
  { name: 'GRI Standards', region: 'Global (widely used in MENA)', focus: 'Universal sustainability reporting; environmental, social, governance disclosures.' },
  { name: 'SASB Standards', region: 'Global (MENA adoption growing)', focus: 'Industry-specific ESG metrics; investor-focused materiality.' },
  { name: 'TCFD', region: 'Global (recommended in UAE/KSA)', focus: 'Climate-related financial disclosures; governance, strategy, risk, metrics.' },
  { name: 'UN Sustainable Development Goals', region: 'Global / MENA alignment', focus: 'Mapping ESG activities to SDGs; national alignment (e.g. UAE, KSA visions).' },
  { name: 'CDP (Carbon Disclosure Project)', region: 'Global (MENA participation)', focus: 'Climate, water, forests disclosure; supply chain and investor requests.' },
  { name: 'CBUAE Principles for Sustainability-Related Disclosures', region: 'UAE', focus: 'Central Bank of UAE guidance for sustainability disclosures by financial institutions.' },
  { name: 'UAE Sustainable Finance Framework / SFWG', region: 'UAE', focus: 'Sustainable Finance Working Group; coordination across ministries and regulators.' },
  { name: 'Tadawul Sustainability Disclosure Guidelines', region: 'Saudi Arabia', focus: 'Listed company sustainability reporting; alignment with UN SSE.' },
  { name: 'CMA Corporate Governance Code & ESG', region: 'Saudi Arabia', focus: 'Capital Market Authority; governance, board, non-financial reporting for listed companies.' },
  { name: 'DFM / ADX sustainability reporting', region: 'UAE', focus: 'Dubai & Abu Dhabi exchanges; mandatory sustainability reports for listed companies.' },
  { name: 'Bahrain BHB sustainability requirements', region: 'Bahrain', focus: 'Bahrain Bourse ESG and sustainability disclosure expectations.' },
];

/** Exchange options for framework alignment (GCC). */
const EXCHANGE_OPTIONS = [
  { id: 'tadawul', label: 'Tadawul', framework: 'Tadawul Sustainability Disclosure Guidelines', jurisdiction: 'KSA' },
  { id: 'dfm-adx', label: 'DFM / ADX', framework: 'DFM / ADX sustainability reporting', jurisdiction: 'UAE' },
  { id: 'bhb', label: 'BHB', framework: 'Bahrain BHB sustainability requirements', jurisdiction: 'Bahrain' },
];

/** ESG rating bands (0–100). */
function getEsgRating(score) {
  if (score >= 71) return 'Leading';
  if (score >= 41) return 'Progressing';
  return 'Developing';
}

/** Anonymised GCC sector benchmarks by industry vertical (mock). Percentile = share of peers at or below group score. */
const SECTOR_BENCHMARKS = [
  {
    industry: 'Financial services',
    sectorMedian: 76,
    peerCount: 28,
    scores: [62, 65, 68, 69, 71, 72, 73, 74, 75, 76, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 94],
  },
  {
    industry: 'Energy',
    sectorMedian: 74,
    peerCount: 18,
    scores: [58, 62, 65, 68, 70, 72, 73, 74, 75, 76, 77, 78, 80, 82, 84, 86, 88, 90],
  },
  {
    industry: 'Real estate',
    sectorMedian: 72,
    peerCount: 22,
    scores: [55, 58, 62, 65, 67, 69, 70, 71, 72, 73, 74, 75, 76, 78, 80, 82, 84, 86, 88, 90, 91, 93],
  },
  {
    industry: 'Telecom & technology',
    sectorMedian: 80,
    peerCount: 14,
    scores: [68, 72, 75, 77, 79, 80, 81, 82, 84, 86, 88, 90, 92, 94],
  },
  {
    industry: 'Transportation',
    sectorMedian: 73,
    peerCount: 16,
    scores: [58, 62, 65, 68, 70, 72, 73, 74, 75, 76, 77, 78, 80, 82, 84, 88],
  },
  {
    industry: 'Industrials & logistics',
    sectorMedian: 73,
    peerCount: 20,
    scores: [58, 62, 65, 68, 70, 72, 73, 74, 75, 76, 77, 78, 79, 80, 82, 84, 86, 88, 90, 92],
  },
  {
    industry: 'Mining & metals',
    sectorMedian: 71,
    peerCount: 12,
    scores: [58, 62, 65, 68, 70, 71, 72, 73, 75, 78, 82, 86],
  },
];

/**
 * Map parent holding name to industry vertical based on actual/public sector (banks → Financial services, railways → Transportation, etc.).
 * Uses explicit entity mapping first, then keyword fallback for any parent from API.
 */
function getIndustryForParent(parentName) {
  if (!parentName) return 'Financial services';
  const row = MOCK_ESG_DATA.find((d) => d.entity === parentName);
  if (row?.industry) return row.industry;
  const name = parentName.toLowerCase();
  if (/\b(bank|nbd|finance|investment bank|capital|islamic bank)\b/i.test(name)) return 'Financial services';
  if (/\b(aramco|oil|energy|petroleum|refining)\b/i.test(name)) return 'Energy';
  if (/\b(rail|railway|railways|port|dp world|transport|shipping|logistics|maritime)\b/i.test(name)) return 'Transportation';
  if (/\b(stc|telecom|telecommunications|technology|ict)\b/i.test(name)) return 'Telecom & technology';
  if (/\b(emaar|property|properties|real estate|developments)\b/i.test(name)) return 'Real estate';
  if (/\b(ma\'aden|maaden|mining|metals|aluminium)\b/i.test(name)) return 'Mining & metals';
  if (/\b(sabic|chemical|industrial|manufacturing)\b/i.test(name)) return 'Industrials & logistics';
  return 'Financial services';
}

/** Capability improvements for "What If" simulation: id → E/S/G score deltas (applied when toggle is on). */
const CAPABILITY_IMPACT = {
  'data-collection': { env: 2, social: 2, gov: 1 },
  'metrics-definition': { env: 2, social: 1, gov: 2 },
  'reporting-disclosure': { env: 1, social: 1, gov: 2 },
  'assurance-audit': { env: 0, social: 1, gov: 4 },
  'governance-structure': { env: 0, social: 1, gov: 3 },
  'stakeholder-engagement': { env: 1, social: 3, gov: 1 },
  'scenario-analysis': { env: 3, social: 0, gov: 1 },
  'systems-integration': { env: 1, social: 1, gov: 2 },
};

const WEIGHT_PRESETS = [
  { id: 'equal', label: 'Equal (1/3 each)', e: 33.33, s: 33.33, g: 33.34 },
  { id: 'financials', label: 'Financials (materiality)', e: 25, s: 35, g: 40 },
  { id: 'energy', label: 'Energy / Industrials', e: 45, s: 25, g: 30 },
  { id: 'custom', label: 'Custom', e: null, s: null, g: null },
];

function EsgScoreCalculator({ chartEntityData, chartEntity }) {
  const [scoreE, setScoreE] = useState(chartEntityData.env || 0);
  const [scoreS, setScoreS] = useState(chartEntityData.social || 0);
  const [scoreG, setScoreG] = useState(chartEntityData.gov || 0);
  const [weightPreset, setWeightPreset] = useState('equal');
  const [weightE, setWeightE] = useState(33.33);
  const [weightS, setWeightS] = useState(33.33);
  const [weightG, setWeightG] = useState(33.34);

  useEffect(() => {
    setScoreE(chartEntityData.env || 0);
    setScoreS(chartEntityData.social || 0);
    setScoreG(chartEntityData.gov || 0);
  }, [chartEntityData.env, chartEntityData.social, chartEntityData.gov]);

  const handlePresetChange = (presetId) => {
    setWeightPreset(presetId);
    const p = WEIGHT_PRESETS.find((x) => x.id === presetId);
    if (p && p.e != null) {
      setWeightE(p.e);
      setWeightS(p.s);
      setWeightG(p.g);
    }
  };

  const totalWeight = weightE + weightS + weightG;
  const overallScore = totalWeight > 0
    ? (scoreE * weightE + scoreS * weightS + scoreG * weightG) / totalWeight
    : 0;
  const isValidWeights = Math.abs(totalWeight - 100) < 0.1;

  return (
    <div className="esg-calc">
      <div className="esg-calc-row">
        <div className="esg-calc-block">
          <label>Pillar scores (0–100)</label>
          <div className="esg-calc-inputs">
            <div className="esg-calc-input-group">
              <span className="esg-calc-input-label">E</span>
              <input
                type="number"
                min={0}
                max={100}
                value={scoreE}
                onChange={(e) => setScoreE(Number(e.target.value) || 0)}
              />
            </div>
            <div className="esg-calc-input-group">
              <span className="esg-calc-input-label">S</span>
              <input
                type="number"
                min={0}
                max={100}
                value={scoreS}
                onChange={(e) => setScoreS(Number(e.target.value) || 0)}
              />
            </div>
            <div className="esg-calc-input-group">
              <span className="esg-calc-input-label">G</span>
              <input
                type="number"
                min={0}
                max={100}
                value={scoreG}
                onChange={(e) => setScoreG(Number(e.target.value) || 0)}
              />
            </div>
          </div>
          <button
            type="button"
            className="esg-calc-populate-btn"
            onClick={() => {
              setScoreE(chartEntityData.env || 0);
              setScoreS(chartEntityData.social || 0);
              setScoreG(chartEntityData.gov || 0);
            }}
          >
            Use scores from «{chartEntity}»
          </button>
        </div>
        <div className="esg-calc-block">
          <label>Weights (%) — industry / materiality</label>
          <select
            className="esg-calc-preset"
            value={weightPreset}
            onChange={(e) => handlePresetChange(e.target.value)}
          >
            {WEIGHT_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <div className="esg-calc-inputs">
            <div className="esg-calc-input-group">
              <span className="esg-calc-input-label">wE</span>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={weightE}
                onChange={(e) => { setWeightE(Number(e.target.value) || 0); setWeightPreset('custom'); }}
              />
            </div>
            <div className="esg-calc-input-group">
              <span className="esg-calc-input-label">wS</span>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={weightS}
                onChange={(e) => { setWeightS(Number(e.target.value) || 0); setWeightPreset('custom'); }}
              />
            </div>
            <div className="esg-calc-input-group">
              <span className="esg-calc-input-label">wG</span>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={weightG}
                onChange={(e) => { setWeightG(Number(e.target.value) || 0); setWeightPreset('custom'); }}
              />
            </div>
          </div>
          {!isValidWeights && totalWeight > 0 && (
            <p className="esg-calc-warn">Weights should sum to 100%. Current sum: {totalWeight.toFixed(1)}%</p>
          )}
        </div>
      </div>
      <div className="esg-calc-formula">
        <span>Overall ESG = (E×wE + S×wS + G×wG) / 100</span>
        <span className="esg-calc-result">
          = ({scoreE}×{weightE} + {scoreS}×{weightS} + {scoreG}×{weightG}) / 100 = <strong>{overallScore.toFixed(1)}</strong>
        </span>
      </div>
      <div className="esg-calc-overall">
        <span className="esg-calc-overall-label">Calculated overall ESG score</span>
        <span className="esg-calc-overall-value">{overallScore.toFixed(1)}</span>
      </div>
    </div>
  );
}

const MOCK_ESG_DATA = [
  { entity: 'Group Consolidated', jurisdiction: 'Multi', env: 78, social: 82, gov: 85, overall: 82, previousQuarterOverall: 79, year: 2024, industry: 'Financial services', revenueShare: 1 },
  { entity: 'Emirates NBD Group', jurisdiction: 'UAE', env: 72, social: 79, gov: 88, overall: 80, previousQuarterOverall: 78, year: 2024, industry: 'Financial services', revenueShare: 1 },
  { entity: 'Saudi National Bank Group', jurisdiction: 'KSA', env: 75, social: 83, gov: 86, overall: 81, previousQuarterOverall: 79, year: 2024, industry: 'Financial services', revenueShare: 1 },
  { entity: 'Saudi Aramco', jurisdiction: 'KSA', env: 68, social: 76, gov: 90, overall: 78, previousQuarterOverall: 76, year: 2024, industry: 'Energy', revenueShare: 1 },
  { entity: 'SABIC', jurisdiction: 'KSA', env: 74, social: 80, gov: 84, overall: 79, previousQuarterOverall: 77, year: 2024, industry: 'Industrials & logistics', revenueShare: 1 },
  { entity: 'Dubai Islamic Bank Group', jurisdiction: 'UAE', env: 70, social: 77, gov: 82, overall: 76, previousQuarterOverall: 74, year: 2024, industry: 'Financial services', revenueShare: 1 },
  { entity: 'STC', jurisdiction: 'KSA', env: 80, social: 85, gov: 87, overall: 84, previousQuarterOverall: 82, year: 2024, industry: 'Telecom & technology', revenueShare: 1 },
  { entity: 'Ma\'aden', jurisdiction: 'KSA', env: 65, social: 72, gov: 80, overall: 72, previousQuarterOverall: 70, year: 2024, industry: 'Mining & metals', revenueShare: 1 },
  { entity: 'DP World', jurisdiction: 'UAE', env: 71, social: 78, gov: 83, overall: 77, previousQuarterOverall: 75, year: 2024, industry: 'Transportation', revenueShare: 1 },
];

/** Simple hash for deterministic variance from a string. */
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < (s || '').length; i++) h = ((h << 5) - h) + (s || '').charCodeAt(i) | 0;
  return Math.abs(h);
}

/** Base ESG score for an OpCo: from MOCK_ESG_DATA if entity matches, else parent row with small variance. */
function getScoreForOpco(opcoName, parentRow) {
  const exact = MOCK_ESG_DATA.find((d) => d.entity === opcoName);
  if (exact) return { env: exact.env, social: exact.social, gov: exact.gov, overall: exact.overall };
  if (!parentRow) return { env: 70, social: 75, gov: 78, overall: 74 };
  const h = hashStr(opcoName);
  const clamp = (x) => Math.max(0, Math.min(100, Math.round(x)));
  const env = clamp((parentRow.env || 72) + (h % 7) - 3);
  const social = clamp((parentRow.social || 78) + ((h >> 3) % 7) - 3);
  const gov = clamp((parentRow.gov || 82) + ((h >> 6) % 7) - 3);
  const overall = clamp((env + social + gov) / 3);
  return { env, social, gov, overall };
}

/** Structured ESG data for target OpCo (M&A PDF). */
export function getEsgDataForMa(opcoOrParent) {
  const row = MOCK_ESG_DATA.find((d) => d.entity === opcoOrParent || (opcoOrParent && (d.entity.includes(opcoOrParent) || opcoOrParent.includes(d.entity))));
  if (!row) return null;
  return {
    entity: row.entity,
    jurisdiction: row.jurisdiction,
    year: row.year,
    env: row.env,
    social: row.social,
    gov: row.gov,
    overall: row.overall,
  };
}

/** Build ESG summary string for M&A assessment PDF (target OpCo or parent name). */
export function getEsgSummaryForMa(opcoOrParent) {
  const data = getEsgDataForMa(opcoOrParent);
  if (!data) return '';
  return `${data.entity} (${data.jurisdiction}, ${data.year}): Environmental ${data.env}, Social ${data.social}, Governance ${data.gov}; Overall ESG score ${data.overall}/100.`;
}

export function EsgSummary({ language = 'en', selectedParentHolding = '', companiesRefreshKey = 0 }) {
  const [selectedJurisdiction, setSelectedJurisdiction] = useState('all');
  const [selectedPillar, setSelectedPillar] = useState('overall');
  const [chartEntity, setChartEntity] = useState(selectedParentHolding || 'Group Consolidated');
  const [selectedExchange, setSelectedExchange] = useState('tadawul');
  const [opcosForParent, setOpcosForParent] = useState([]);
  const [simulationOpco, setSimulationOpco] = useState('');
  const [simulationToggles, setSimulationToggles] = useState({});

  useEffect(() => {
    if (selectedParentHolding) setChartEntity(selectedParentHolding);
    else setChartEntity('Group Consolidated');
  }, [selectedParentHolding]);

  useEffect(() => {
    if (!selectedParentHolding) {
      setOpcosForParent([]);
      setSimulationOpco('');
      return;
    }
    fetch(`${API}/companies/by-parent?parent=${encodeURIComponent(selectedParentHolding)}`)
      .then((r) => r.json())
      .then((data) => {
        const list = data.opcos || [];
        setOpcosForParent(list);
        setSimulationOpco((prev) => (list.some((o) => (o.name || o) === prev) ? prev : ''));
      })
      .catch(() => setOpcosForParent([]));
  }, [selectedParentHolding, companiesRefreshKey]);

  // Default exchange from parent jurisdiction
  useEffect(() => {
    const row = MOCK_ESG_DATA.find((d) => d.entity === selectedParentHolding);
    if (!row) return;
    if (row.jurisdiction === 'KSA') setSelectedExchange('tadawul');
    else if (row.jurisdiction === 'UAE') setSelectedExchange('dfm-adx');
    else if (row.jurisdiction === 'Bahrain') setSelectedExchange('bhb');
  }, [selectedParentHolding]);

  const groupEsgRow = useMemo(() => {
    const entity = selectedParentHolding || 'Group Consolidated';
    return MOCK_ESG_DATA.find((d) => d.entity === entity) || MOCK_ESG_DATA[0];
  }, [selectedParentHolding]);

  const groupScore = groupEsgRow?.overall ?? 0;
  const groupScorePrevQuarter = groupEsgRow?.previousQuarterOverall ?? groupScore;
  const trendDelta = Math.round(groupScore - groupScorePrevQuarter);
  const rating = getEsgRating(groupScore);
  const exchangeOption = EXCHANGE_OPTIONS.find((e) => e.id === selectedExchange) || EXCHANGE_OPTIONS[0];
  const frameworkName = exchangeOption.framework;

  const industryBenchmark = useMemo(() => {
    const parentName = selectedParentHolding || groupEsgRow?.entity;
    const industry = getIndustryForParent(parentName);
    const bench = SECTOR_BENCHMARKS.find((b) => b.industry === industry);
    if (!bench) return null;
    const sorted = [...bench.scores].sort((a, b) => a - b);
    const atOrBelow = sorted.filter((s) => s <= groupScore).length;
    const percentile = sorted.length > 0 ? Math.round((atOrBelow / sorted.length) * 100) : 50;
    const deltaToMedian = groupScore - bench.sectorMedian;
    return { industry: bench.industry, sectorMedian: bench.sectorMedian, peerCount: bench.peerCount, percentile, deltaToMedian };
  }, [selectedParentHolding, groupEsgRow?.entity, groupScore]);

  const uniqueOpcoNames = useMemo(() => {
    const names = (opcosForParent || []).map((o) => (o && o.name) ? o.name : o);
    return [...new Set(names)].filter(Boolean).sort();
  }, [opcosForParent]);

  const baseScoresByOpco = useMemo(() => {
    const out = {};
    uniqueOpcoNames.forEach((name) => {
      out[name] = getScoreForOpco(name, groupEsgRow);
    });
    return out;
  }, [uniqueOpcoNames, groupEsgRow]);

  const currentGroupScoreFromOpcos = useMemo(() => {
    if (uniqueOpcoNames.length === 0) return groupScore;
    const sum = uniqueOpcoNames.reduce((acc, name) => acc + (baseScoresByOpco[name]?.overall ?? 0), 0);
    return uniqueOpcoNames.length > 0 ? Math.round((sum / uniqueOpcoNames.length) * 10) / 10 : groupScore;
  }, [uniqueOpcoNames, baseScoresByOpco, groupScore]);

  const simulatedOpcoScore = useMemo(() => {
    if (!simulationOpco || !baseScoresByOpco[simulationOpco]) return null;
    const base = baseScoresByOpco[simulationOpco];
    let env = base.env;
    let social = base.social;
    let gov = base.gov;
    Object.entries(simulationToggles).forEach(([capId, on]) => {
      if (!on) return;
      const d = CAPABILITY_IMPACT[capId];
      if (d) {
        env += d.env;
        social += d.social;
        gov += d.gov;
      }
    });
    const clamp = (x) => Math.max(0, Math.min(100, Math.round(x)));
    env = clamp(env);
    social = clamp(social);
    gov = clamp(gov);
    const overall = Math.round((env + social + gov) / 3 * 10) / 10;
    return { env, social, gov, overall };
  }, [simulationOpco, baseScoresByOpco, simulationToggles]);

  const simulatedGroupScore = useMemo(() => {
    if (uniqueOpcoNames.length === 0) return currentGroupScoreFromOpcos;
    if (!simulationOpco || !simulatedOpcoScore) return currentGroupScoreFromOpcos;
    const n = uniqueOpcoNames.length;
    const sum = uniqueOpcoNames.reduce((acc, name) => {
      const overall = name === simulationOpco ? simulatedOpcoScore.overall : (baseScoresByOpco[name]?.overall ?? 0);
      return acc + overall;
    }, 0);
    return Math.round((sum / n) * 10) / 10;
  }, [uniqueOpcoNames, simulationOpco, simulatedOpcoScore, baseScoresByOpco, currentGroupScoreFromOpcos]);

  const simulationDelta = simulatedGroupScore - currentGroupScoreFromOpcos;
  const simulatedRating = getEsgRating(simulatedGroupScore);

  const jurisdictions = useMemo(() => {
    const set = new Set(MOCK_ESG_DATA.map((d) => d.jurisdiction));
    return ['all', ...Array.from(set)];
  }, []);

  const filteredData = useMemo(() => {
    let list = [...MOCK_ESG_DATA];
    if (selectedParentHolding) {
      list = list.filter((d) => d.entity === selectedParentHolding);
    }
    if (selectedJurisdiction !== 'all') {
      list = list.filter((d) => d.jurisdiction === selectedJurisdiction);
    }
    return list;
  }, [selectedJurisdiction, selectedParentHolding]);

  const chartEntityData = useMemo(() => {
    const row = MOCK_ESG_DATA.find((d) => d.entity === chartEntity);
    if (!row) return { env: 0, social: 0, gov: 0 };
    return { env: row.env, social: row.social, gov: row.gov };
  }, [chartEntity]);

  const analysisStats = useMemo(() => {
    if (filteredData.length === 0) return null;
    const pillar = selectedPillar === 'overall' ? 'overall' : selectedPillar;
    const values = filteredData.map((d) => d[pillar] ?? 0);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    return { avg: Math.round(avg), min, max, count: values.length };
  }, [filteredData, selectedPillar]);

  return (
    <div className="esg-summary">
      <h2 className="esg-summary-title">ESG Summary</h2>
      {selectedParentHolding && (
        <p className="esg-parent-banner">Showing data for <strong>{selectedParentHolding}</strong> (selected in Parent Holding Overview)</p>
      )}

      <div className="esg-hero">
        <div className="esg-hero-score-block">
          <div className="esg-hero-label">Group ESG Health Score</div>
          <div className="esg-hero-score-row">
            <span className="esg-hero-score-value">{groupScore}</span>
            <span className="esg-hero-score-scale">/ 100</span>
            <span className={`esg-hero-trend esg-hero-trend-${trendDelta >= 0 ? 'up' : 'down'}`} title="vs. last quarter">
              {trendDelta >= 0 ? '↑' : '↓'} {Math.abs(trendDelta)}
            </span>
          </div>
          <div className="esg-hero-meta">
            <span className={`esg-hero-rating esg-hero-rating-${rating.toLowerCase()}`}>{rating}</span>
            <span className="esg-hero-trend-label">vs. last quarter</span>
          </div>
        </div>
        <div className="esg-hero-exchange-block">
          <label htmlFor="esg-exchange-select" className="esg-hero-exchange-label">Exchange</label>
          <select
            id="esg-exchange-select"
            className="esg-hero-exchange-select"
            value={selectedExchange}
            onChange={(e) => setSelectedExchange(e.target.value)}
          >
            {EXCHANGE_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
          <div className="esg-hero-framework">Aligns to: <strong>{frameworkName}</strong></div>
        </div>
      </div>

      {industryBenchmark && (
        <section className="esg-section esg-benchmark-section">
          <h3 className="esg-section-title">Industry benchmarking (GCC, anonymised)</h3>
          <p className="esg-section-desc">
            Where the group&apos;s ESG score sits relative to sector peers in the GCC by industry vertical.
          </p>
          <div className="esg-benchmark-panel">
            <div className="esg-benchmark-row">
              <span className="esg-benchmark-label">Industry vertical</span>
              <span className="esg-benchmark-value">{industryBenchmark.industry}</span>
            </div>
            <div className="esg-benchmark-row">
              <span className="esg-benchmark-label">Group score</span>
              <span className="esg-benchmark-value">{groupScore}</span>
            </div>
            <div className="esg-benchmark-row">
              <span className="esg-benchmark-label">Sector median</span>
              <span className="esg-benchmark-value">{industryBenchmark.sectorMedian}</span>
            </div>
            <div className="esg-benchmark-row">
              <span className="esg-benchmark-label">Percentile ranking</span>
              <span className="esg-benchmark-value">{industryBenchmark.percentile}th percentile</span>
            </div>
            <div className="esg-benchmark-row">
              <span className="esg-benchmark-label">Delta to sector median</span>
              <span className={`esg-benchmark-delta ${industryBenchmark.deltaToMedian >= 0 ? 'esg-benchmark-delta-positive' : 'esg-benchmark-delta-negative'}`}>
                {industryBenchmark.deltaToMedian >= 0 ? '+' : ''}{industryBenchmark.deltaToMedian} pts
              </span>
            </div>
            <div className="esg-benchmark-footer">
              Peer count (anonymised): {industryBenchmark.peerCount} entities in GCC
            </div>
          </div>
        </section>
      )}

      <section className="esg-section esg-simulation-section">
        <h3 className="esg-section-title">ESG Score Impact Simulation</h3>
        <p className="esg-section-desc">
          Select an OpCo and toggle capability improvements to see how the group ESG score would change (e.g. implement TCFD climate scenario analysis or achieve third-party ESG assurance).
        </p>
        {!selectedParentHolding ? (
          <p className="esg-simulation-empty">Select a parent holding in Parent Holding Overview to run a simulation.</p>
        ) : (
          <div className="esg-simulation-block">
            <div className="esg-simulation-controls">
              <div className="esg-simulation-control-row">
                <label htmlFor="esg-simulation-opco">OpCo</label>
                <select
                  id="esg-simulation-opco"
                  className="esg-simulation-select"
                  value={simulationOpco}
                  onChange={(e) => setSimulationOpco(e.target.value)}
                >
                  <option value="">Select OpCo…</option>
                  {uniqueOpcoNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div className="esg-simulation-toggles">
                <span className="esg-simulation-toggles-label">Capability improvements</span>
                {OPERATIONAL_CAPABILITIES.map((cap) => (
                  <label key={cap.id} className="esg-simulation-toggle">
                    <input
                      type="checkbox"
                      checked={!!simulationToggles[cap.id]}
                      onChange={() => setSimulationToggles((prev) => ({ ...prev, [cap.id]: !prev[cap.id] }))}
                    />
                    <span>{cap.title}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="esg-simulation-outcome">
              <h4 className="esg-simulation-outcome-title">Impact</h4>
              {uniqueOpcoNames.length === 0 ? (
                <p className="esg-simulation-outcome-empty">No OpCos found for this parent. Simulation uses group score only.</p>
              ) : simulationOpco ? (
                <>
                  <div className="esg-simulation-opco-scores">
                    <div className="esg-simulation-opco-row">
                      <span className="esg-simulation-opco-name">{simulationOpco}</span>
                      <span className="esg-simulation-opco-current">
                        Current: E {baseScoresByOpco[simulationOpco]?.env ?? '—'} / S {baseScoresByOpco[simulationOpco]?.social ?? '—'} / G {baseScoresByOpco[simulationOpco]?.gov ?? '—'} → {baseScoresByOpco[simulationOpco]?.overall ?? '—'}
                      </span>
                    </div>
                    {simulatedOpcoScore && (
                      <div className="esg-simulation-opco-row esg-simulation-opco-simulated">
                        <span className="esg-simulation-opco-name">After improvements</span>
                        <span className="esg-simulation-opco-value">
                          E {simulatedOpcoScore.env} / S {simulatedOpcoScore.social} / G {simulatedOpcoScore.gov} → <strong>{simulatedOpcoScore.overall}</strong>
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="esg-simulation-group-row">
                    <span className="esg-simulation-group-label">Group ESG score</span>
                    <span className="esg-simulation-group-current">{currentGroupScoreFromOpcos}</span>
                    <span className="esg-simulation-group-arrow">→</span>
                    <span className="esg-simulation-group-simulated">{simulatedGroupScore}</span>
                    {simulationDelta !== 0 && (
                      <span className={`esg-simulation-delta ${simulationDelta >= 0 ? 'esg-simulation-delta-positive' : 'esg-simulation-delta-negative'}`}>
                        {simulationDelta >= 0 ? '+' : ''}{simulationDelta.toFixed(1)} pts
                      </span>
                    )}
                  </div>
                  <div className="esg-simulation-rating-row">
                    <span className="esg-simulation-rating-label">Rating</span>
                    <span className="esg-simulation-rating-current">{getEsgRating(currentGroupScoreFromOpcos)}</span>
                    <span className="esg-simulation-group-arrow">→</span>
                    <span className={`esg-simulation-rating-badge esg-simulation-rating-${simulatedRating.toLowerCase()}`}>{simulatedRating}</span>
                  </div>
                </>
              ) : (
                <p className="esg-simulation-outcome-hint">Select an OpCo and toggle one or more capability improvements to see the impact on the group ESG score.</p>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="esg-section">
        <h3 className="esg-section-title">Operational capabilities for ESG score calculation</h3>
        <p className="esg-section-desc">
          The following capabilities are required to collect, measure, and report ESG performance and to support a robust ESG score.
        </p>
        <div className="esg-capabilities-grid">
          {OPERATIONAL_CAPABILITIES.map((cap) => (
            <div key={cap.id} className="esg-capability-card">
              <h4 className="esg-capability-title">{cap.title}</h4>
              <p className="esg-capability-desc">{cap.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="esg-section esg-calculation-section">
        <h3 className="esg-section-title">ESG score calculation (global standard procedure)</h3>
        <p className="esg-section-desc">
          Globally, ESG scores are calculated using a weighted aggregation of the three pillars (Environmental, Social, Governance), typically on a 0–100 scale. Major providers (MSCI, S&P Global, LSEG, Sustainalytics) follow a similar hierarchy.
        </p>
        <div className="esg-methodology-steps">
          <div className="esg-methodology-step">
            <span className="esg-step-num">1</span>
            <div>
              <strong>Key issue / question assessment</strong> — Score at question level using frameworks (data availability, quality, relevance, performance).
            </div>
          </div>
          <div className="esg-methodology-step">
            <span className="esg-step-num">2</span>
            <div>
              <strong>Pillar scores</strong> — Aggregate question-level scores into criteria and themes, then roll up into separate E, S and G dimension scores (0–100).
            </div>
          </div>
          <div className="esg-methodology-step">
            <span className="esg-step-num">3</span>
            <div>
              <strong>Weighted aggregation</strong> — Combine pillar scores using industry-specific or materiality-based weights: <em>Overall ESG = (E × wE) + (S × wS) + (G × wG)</em>, with wE + wS + wG = 100%.
            </div>
          </div>
          <div className="esg-methodology-step">
            <span className="esg-step-num">4</span>
            <div>
              <strong>Adjustments (optional)</strong> — Apply risk exposure, management effectiveness and controversy screening where required by the methodology.
            </div>
          </div>
        </div>

        <div className="esg-calculator-card">
          <h4 className="esg-calculator-title">ESG score calculator</h4>
          <p className="esg-calculator-desc">Compute overall ESG score from E, S, G pillar scores using standard weighted aggregation.</p>
          <EsgScoreCalculator chartEntityData={chartEntityData} chartEntity={chartEntity} />
        </div>
      </section>

      <section className="esg-section">
        <h3 className="esg-section-title">Data visualization & analysis</h3>

        <div className="esg-viz-toolbar">
          <div className="esg-viz-filter">
            <label htmlFor="esg-jurisdiction">Jurisdiction</label>
            <select
              id="esg-jurisdiction"
              value={selectedJurisdiction}
              onChange={(e) => setSelectedJurisdiction(e.target.value)}
            >
              {jurisdictions.map((j) => (
                <option key={j} value={j}>{j === 'all' ? 'All' : j}</option>
              ))}
            </select>
          </div>
          <div className="esg-viz-filter">
            <label htmlFor="esg-pillar">Score pillar</label>
            <select
              id="esg-pillar"
              value={selectedPillar}
              onChange={(e) => setSelectedPillar(e.target.value)}
            >
              <option value="overall">Overall</option>
              <option value="env">Environmental</option>
              <option value="social">Social</option>
              <option value="gov">Governance</option>
            </select>
          </div>
          {analysisStats && (
            <div className="esg-viz-stats">
              <span>Average: <strong>{analysisStats.avg}</strong></span>
              <span>Min: {analysisStats.min} / Max: {analysisStats.max}</span>
              <span>Entities: {analysisStats.count}</span>
            </div>
          )}
        </div>

        <div className="esg-viz-row">
          <div className="esg-chart-card">
            <h4 className="esg-chart-title">E / S / G pillar scores</h4>
            <div className="esg-chart-entity-select">
              <label htmlFor="esg-chart-entity">Entity</label>
              <select
                id="esg-chart-entity"
                value={chartEntity}
                onChange={(e) => setChartEntity(e.target.value)}
              >
                {MOCK_ESG_DATA.map((d) => (
                  <option key={d.entity} value={d.entity}>{d.entity}</option>
                ))}
              </select>
            </div>
            <div className="esg-bar-chart">
              <div className="esg-bar-row">
                <span className="esg-bar-label">Environmental</span>
                <div className="esg-bar-track">
                  <div className="esg-bar-fill esg-bar-env" style={{ width: `${chartEntityData.env}%` }} />
                </div>
                <span className="esg-bar-value">{chartEntityData.env}%</span>
              </div>
              <div className="esg-bar-row">
                <span className="esg-bar-label">Social</span>
                <div className="esg-bar-track">
                  <div className="esg-bar-fill esg-bar-social" style={{ width: `${chartEntityData.social}%` }} />
                </div>
                <span className="esg-bar-value">{chartEntityData.social}%</span>
              </div>
              <div className="esg-bar-row">
                <span className="esg-bar-label">Governance</span>
                <div className="esg-bar-track">
                  <div className="esg-bar-fill esg-bar-gov" style={{ width: `${chartEntityData.gov}%` }} />
                </div>
                <span className="esg-bar-value">{chartEntityData.gov}%</span>
              </div>
            </div>
          </div>

          <div className="esg-table-card">
            <h4 className="esg-chart-title">ESG scores by entity (filtered)</h4>
            <div className="esg-data-table-wrap">
              <table className="esg-data-table">
                <thead>
                  <tr>
                    <th>Entity</th>
                    <th>Jurisdiction</th>
                    <th>E</th>
                    <th>S</th>
                    <th>G</th>
                    <th>Overall</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((row) => (
                    <tr key={row.entity}>
                      <td>{row.entity}</td>
                      <td>{row.jurisdiction}</td>
                      <td>{row.env}</td>
                      <td>{row.social}</td>
                      <td>{row.gov}</td>
                      <td><strong>{row.overall}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="esg-analysis-note">
          Use the jurisdiction and score pillar filters above to analyse subsets. The bar chart shows Environmental, Social and Governance scores for the selected entity; the table shows all entities matching the selected jurisdiction.
        </div>
      </section>
    </div>
  );
}
