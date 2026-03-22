/**
 * EsgSummary — redesigned for GCC organisations
 *
 * 5-tab architecture:
 *   Overview   – C-level dashboard: group score, pillar cards, insights, targets
 *   Metrics    – Live data entry for E / S / G metrics per OpCo + period
 *   Analysis   – Period trends, OpCo comparison, completeness heat-map, gap analysis
 *   Compliance – GCC regulatory framework tracker (UAE / KSA / GCC-global)
 *   Reports    – Disclosure checklist, CSV export, TCFD/GRI index
 *
 * All scores are server-computed from actual entered data (not hard-coded).
 * M&A exports (getEsgDataForMa / getEsgSummaryForMa) are preserved for backward compat.
 */
import { useState, useEffect, useRef } from 'react';
import './EsgSummary.css';

const API = '/api';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** GCC regulatory frameworks mapped to region and compliance driver. */
const GCC_FRAMEWORKS = [
  // UAE
  { id: 'uae-net-zero', region: 'UAE', name: 'UAE Net Zero by 2050', pillar: 'E', driver: 'National Strategy', description: 'Carbon neutrality target; organisations expected to disclose emissions pathways and climate transition plans.', mandatory: true },
  { id: 'cbuae-sf', region: 'UAE', name: 'CBUAE Sustainable Finance Framework', pillar: 'E/S/G', driver: 'Regulator', description: 'Central Bank of UAE guidance on sustainability disclosures for licensed financial institutions.', mandatory: true },
  { id: 'sca-esg', region: 'UAE', name: 'SCA ESG Disclosure Guidelines', pillar: 'E/S/G', driver: 'Exchange / Regulator', description: 'Securities & Commodities Authority disclosure requirements for public-listed companies.', mandatory: true },
  { id: 'dfm-adx', region: 'UAE', name: 'DFM / ADX Sustainability Reporting', pillar: 'E/S/G', driver: 'Exchange', description: 'Dubai Financial Market & Abu Dhabi Securities Exchange mandatory sustainability reports.', mandatory: true },
  { id: 'emiratisation', region: 'UAE', name: 'Emiratisation (NAFIS / MoHRE)', pillar: 'S', driver: 'Federal Law', description: '2% annual incremental Emiratisation for private sector (>50 employees); sector-specific quotas for banking, insurance.', mandatory: true },
  { id: 'uae-pdpl', region: 'UAE', name: 'UAE PDPL (Data Privacy)', pillar: 'G', description: 'Personal Data Protection Law — governance, consent and data processing obligations.', mandatory: true, driver: 'Federal Law' },
  // KSA
  { id: 'vision2030', region: 'KSA', name: 'Saudi Vision 2030', pillar: 'E/S/G', driver: 'National Strategy', description: 'Economic diversification, clean energy (50% renewable by 2030), social inclusion and governance reforms.', mandatory: false },
  { id: 'tadawul-esg', region: 'KSA', name: 'Tadawul ESG Listing Requirements', pillar: 'E/S/G', driver: 'Exchange', description: 'Saudi Exchange sustainability disclosure guidelines aligned with UN SSE and GRI.', mandatory: true },
  { id: 'cma-ksa', region: 'KSA', name: 'CMA Corporate Governance Code', pillar: 'G', driver: 'Regulator', description: 'Capital Market Authority code covering board structure, audit, related-party transactions and non-financial reporting.', mandatory: true },
  { id: 'saudisation', region: 'KSA', name: 'Saudisation (Nitaqat)', pillar: 'S', driver: 'Ministry of HR', description: 'Minimum Saudi national workforce percentages by sector and company size band.', mandatory: true },
  { id: 'ksa-netzero', region: 'KSA', name: 'Saudi Net Zero 2060 / Green Saudi', pillar: 'E', driver: 'National Strategy', description: 'Kingdom-level carbon neutrality target; 1.5bn tree planting; 50% renewable energy by 2030.', mandatory: false },
  // GCC / Global
  { id: 'tcfd', region: 'Global', name: 'TCFD', pillar: 'E', driver: 'Best Practice', description: 'Task Force on Climate-related Financial Disclosures: Governance, Strategy, Risk Management, Metrics & Targets.', mandatory: false },
  { id: 'gri', region: 'Global', name: 'GRI Standards', pillar: 'E/S/G', driver: 'Best Practice', description: 'Global Reporting Initiative universal sustainability reporting standards; widely adopted across MENA.', mandatory: false },
  { id: 'issb-ifrs', region: 'Global', name: 'IFRS S1 / S2 (ISSB)', pillar: 'E/S/G', driver: 'Accounting Standard', description: 'International Sustainability Standards Board — general sustainability and climate-related financial disclosures.', mandatory: false },
  { id: 'un-sdgs', region: 'Global', name: 'UN Sustainable Development Goals', pillar: 'E/S/G', driver: 'Best Practice', description: 'Map activities and metrics to the 17 SDGs; national alignment with UAE and KSA vision targets.', mandatory: false },
  { id: 'cdp', region: 'Global', name: 'CDP Carbon Disclosure', pillar: 'E', driver: 'Investor', description: 'Annual carbon, water and forest disclosure requested by investors and supply chain partners.', mandatory: false },
];

/** Environmental metric field definitions — drives form rendering and tooltips. */
const ENV_FIELDS = [
  { id: 'scope1Emissions', label: 'Scope 1 Emissions', unit: 'tCO₂e', type: 'number', hint: 'Direct emissions from owned/controlled sources (combustion, fleet, fugitives).' },
  { id: 'scope2Emissions', label: 'Scope 2 Emissions', unit: 'tCO₂e', type: 'number', hint: 'Indirect emissions from purchased electricity, steam, heat.' },
  { id: 'scope3Emissions', label: 'Scope 3 Emissions', unit: 'tCO₂e', type: 'number', hint: 'Value-chain emissions (supply chain, travel, investments). Required by TCFD / ISSB.' },
  { id: 'energyConsumption', label: 'Total Energy Consumption', unit: 'MWh', type: 'number', hint: 'All energy consumed across operations (electricity + fuel + heat).' },
  { id: 'renewableEnergyPct', label: 'Renewable Energy Share', unit: '%', type: 'number', min: 0, max: 100, hint: 'Percentage of total energy from renewable sources (solar, wind, hydro).' },
  { id: 'waterConsumption', label: 'Water Consumption', unit: 'm³', type: 'number', hint: 'Total fresh water withdrawn across all operations.' },
  { id: 'wasteGenerated', label: 'Waste Generated', unit: 'tonnes', type: 'number', hint: 'Total waste produced before treatment/disposal.' },
  { id: 'wasteDiversionPct', label: 'Waste Diverted from Landfill', unit: '%', type: 'number', min: 0, max: 100, hint: 'Percentage recycled, composted or recovered (not landfilled or incinerated without energy recovery).' },
  { id: 'greenBuildingCertified', label: 'Green Building Certification', unit: '', type: 'boolean', hint: 'LEED, Estidama, GSAS or equivalent certification on primary premises.' },
  { id: 'totalEmployees', label: 'Total Employees (for intensity)', unit: 'FTE', type: 'number', hint: 'Full-time equivalent headcount — used to compute per-FTE intensity ratios.' },
];

/** Social metric field definitions. */
const SOCIAL_FIELDS = [
  { id: 'totalEmployees', label: 'Total Employees', unit: 'FTE', type: 'number', hint: 'Total full-time equivalent headcount at period end.' },
  { id: 'emiratizationPct', label: 'Emiratisation Rate', unit: '%', type: 'number', min: 0, max: 100, hint: 'UAE: % of workforce that are UAE nationals. 2% annual increment required (private sector >50 employees).' },
  { id: 'emiratizationTarget', label: 'Emiratisation Target', unit: '%', type: 'number', min: 0, max: 100, hint: 'Your regulatory or voluntary Emiratisation target for this period.' },
  { id: 'saudizationPct', label: 'Saudisation Rate (Nitaqat)', unit: '%', type: 'number', min: 0, max: 100, hint: 'KSA: % of workforce that are Saudi nationals.' },
  { id: 'saudizationTarget', label: 'Saudisation Target', unit: '%', type: 'number', min: 0, max: 100, hint: 'Nitaqat-mandated or internal Saudisation target.' },
  { id: 'genderDiversityPct', label: 'Female Employees', unit: '%', type: 'number', min: 0, max: 100, hint: 'Percentage of total workforce identifying as female.' },
  { id: 'trainingHoursPerEmployee', label: 'Training Hours per FTE / Year', unit: 'hrs', type: 'number', hint: 'Average training and development hours per full-time employee annually.' },
  { id: 'employeeTurnoverPct', label: 'Employee Turnover Rate', unit: '%', type: 'number', min: 0, max: 100, hint: 'Voluntary and involuntary turnover as % of average workforce.' },
  { id: 'ltir', label: 'Lost Time Incident Rate (LTIR)', unit: 'per M hrs', type: 'number', hint: 'Number of lost-time injuries per million hours worked. Lower is better.' },
  { id: 'communityInvestmentRevenuePct', label: 'Community Investment', unit: '% revenue', type: 'number', hint: 'Charitable and community spend as % of net revenue.' },
  { id: 'employeeSatisfactionScore', label: 'Employee Satisfaction Score', unit: '/100', type: 'number', min: 0, max: 100, hint: 'Latest internal engagement or satisfaction survey score.' },
];

/** Governance metric field definitions. */
const GOV_FIELDS = [
  { id: 'boardSize', label: 'Board Size', unit: 'directors', type: 'number', hint: 'Total number of directors on the board.' },
  { id: 'independentDirectorsPct', label: 'Independent Directors', unit: '%', type: 'number', min: 0, max: 100, hint: 'Percentage of directors classified as independent. Minimum 33% recommended by SCA/CMA.' },
  { id: 'femaleBoardMembersPct', label: 'Female Board Members', unit: '%', type: 'number', min: 0, max: 100, hint: 'Percentage of board seats held by women.' },
  { id: 'boardMeetingsPerYear', label: 'Board Meetings per Year', unit: 'meetings', type: 'number', hint: 'Number of formal board meetings held in the reporting period.' },
  { id: 'antiCorruptionPolicy', label: 'Anti-corruption Policy', unit: '', type: 'boolean', hint: 'A documented and communicated anti-bribery and anti-corruption policy is in place.' },
  { id: 'whistleblowerMechanism', label: 'Whistleblower Mechanism', unit: '', type: 'boolean', hint: 'An accessible, confidential reporting channel exists for misconduct and ethical breaches.' },
  { id: 'dataPrivacyCertification', label: 'Data Privacy Certification', unit: '', type: 'boolean', hint: 'ISO 27001, UAE PDPL or equivalent data privacy controls are certified or formally assessed.' },
  { id: 'esgReportPublished', label: 'ESG Report Published', unit: '', type: 'boolean', hint: 'A sustainability / ESG report was published for the current reporting year.' },
  { id: 'thirdPartyAudit', label: 'Third-Party ESG Audit', unit: '', type: 'boolean', hint: 'ESG data independently assured by an external auditor (limited or reasonable assurance).' },
  { id: 'esgLinkedRemuneration', label: 'ESG-Linked Executive Remuneration', unit: '', type: 'boolean', hint: 'Executive KPIs or LTIP include ESG performance metrics.' },
];

/** Anonymised GCC sector peer benchmarks. */
const SECTOR_BENCHMARKS = {
  'Financial services':       { median: 58, p25: 42, p75: 68, peers: 24 },
  'Energy & utilities':       { median: 52, p25: 38, p75: 65, peers: 16 },
  'Real estate':              { median: 54, p25: 40, p75: 63, peers: 20 },
  'Telecom & technology':     { median: 62, p25: 48, p75: 74, peers: 18 },
  'Transportation & logistics':{ median: 49, p25: 35, p75: 61, peers: 14 },
  'Industrials':              { median: 47, p25: 33, p75: 59, peers: 19 },
  'Healthcare':               { median: 60, p25: 45, p75: 70, peers: 12 },
};

/** Generate last N quarters as YYYY-QN strings. */
function generatePeriods(n = 8) {
  const periods = [];
  const now = new Date();
  let year = now.getFullYear();
  let q = Math.ceil((now.getMonth() + 1) / 3);
  for (let i = 0; i < n; i++) {
    periods.push(`${year}-Q${q}`);
    q--;
    if (q < 1) { q = 4; year--; }
  }
  return periods;
}
const PERIODS = generatePeriods(8);

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function scoreColor(s) {
  if (s >= 71) return '#22c55e';
  if (s >= 51) return '#84cc16';
  if (s >= 31) return '#f59e0b';
  return '#ef4444';
}
function ratingLabel(s) {
  if (s >= 71) return 'Leading';
  if (s >= 51) return 'Progressing';
  if (s >= 31) return 'Developing';
  if (s > 0)  return 'Nascent';
  return 'No data';
}
function ratingClass(s) {
  if (s >= 71) return 'leading';
  if (s >= 51) return 'progressing';
  if (s >= 31) return 'developing';
  return 'nascent';
}
function trend(current, previous) {
  if (previous == null || previous === 0) return null;
  return current - previous;
}

// ─────────────────────────────────────────────────────────────────────────────
// PURE UI COMPONENTS (all module-level for React Fast Refresh)
// ─────────────────────────────────────────────────────────────────────────────

/** Circular score display. */
function ScoreRing({ score, label, size = 96 }) {
  const r = (size / 2) - 8;
  const circumference = 2 * Math.PI * r;
  const fill = score > 0 ? (score / 100) * circumference : 0;
  const color = scoreColor(score);
  return (
    <div className="esg2-score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={7} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={7} strokeLinecap="round"
          strokeDasharray={`${fill} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="esg2-score-ring-inner">
        <span className="esg2-score-ring-num" style={{ color }}>{score > 0 ? score : '—'}</span>
        {label && <span className="esg2-score-ring-label">{label}</span>}
      </div>
    </div>
  );
}

/** Horizontal filled bar showing a 0-100 score. */
function ScoreBar({ label, score, color, subLabel }) {
  return (
    <div className="esg2-score-bar-row">
      <div className="esg2-score-bar-meta">
        <span className="esg2-score-bar-label">{label}</span>
        {subLabel && <span className="esg2-score-bar-sub">{subLabel}</span>}
        <span className="esg2-score-bar-value" style={{ color: color || scoreColor(score) }}>{score > 0 ? score : '—'}</span>
      </div>
      <div className="esg2-score-bar-track">
        <div className="esg2-score-bar-fill" style={{ width: `${score}%`, background: color || scoreColor(score) }} />
      </div>
    </div>
  );
}

/** Trend chip: +N or -N vs previous period. */
function TrendChip({ current, previous }) {
  const delta = trend(current, previous);
  if (delta === null) return null;
  const up = delta >= 0;
  return (
    <span className={`esg2-trend-chip ${up ? 'up' : 'down'}`}>
      {up ? '▲' : '▼'} {Math.abs(delta)}
    </span>
  );
}

/** Completion badge showing data completeness %. */
function CompletenessChip({ pct }) {
  const cls = pct >= 80 ? 'high' : pct >= 40 ? 'mid' : 'low';
  return <span className={`esg2-completeness-chip ${cls}`}>{pct}% data</span>;
}

/** Single metric input field for the Metrics panel. */
function MetricInput({ fieldDef, value, onChange }) {
  const { id, label, unit, type, min, max, hint } = fieldDef;
  if (type === 'boolean') {
    return (
      <div className="esg2-metric-field esg2-metric-field-bool">
        <label className="esg2-metric-label" title={hint}>
          {label}
          {hint && <span className="esg2-metric-hint-icon" title={hint}>ⓘ</span>}
        </label>
        <div className="esg2-bool-toggle">
          <button
            type="button"
            className={`esg2-bool-btn ${value === true ? 'active' : ''}`}
            onClick={() => onChange(id, value === true ? null : true)}
          >Yes</button>
          <button
            type="button"
            className={`esg2-bool-btn ${value === false ? 'active' : ''}`}
            onClick={() => onChange(id, value === false ? null : false)}
          >No</button>
        </div>
      </div>
    );
  }
  return (
    <div className="esg2-metric-field">
      <label className="esg2-metric-label" htmlFor={`mf-${id}`} title={hint}>
        {label}{unit ? <span className="esg2-metric-unit"> ({unit})</span> : null}
        {hint && <span className="esg2-metric-hint-icon" title={hint}>ⓘ</span>}
      </label>
      <input
        id={`mf-${id}`}
        type="number"
        className="esg2-metric-input"
        value={value === null || value === undefined ? '' : value}
        min={min}
        max={max}
        step="any"
        placeholder="Enter value"
        onChange={(e) => onChange(id, e.target.value === '' ? null : Number(e.target.value))}
      />
    </div>
  );
}

/** Framework compliance status row for the Compliance panel. */
function FrameworkStatusRow({ fw, statusObj, onUpdate }) {
  const status = statusObj?.status || 'not-started';
  const statusLabels = { 'not-started': 'Not started', 'in-progress': 'In progress', 'completed': 'Completed', 'not-applicable': 'N/A' };
  const statusClass = { 'not-started': 'ns', 'in-progress': 'ip', 'completed': 'done', 'not-applicable': 'na' };
  return (
    <div className={`esg2-fw-row esg2-fw-row-${statusClass[status]}`}>
      <div className="esg2-fw-row-info">
        <div className="esg2-fw-row-name">
          {fw.mandatory && <span className="esg2-fw-mandatory-dot" title="Mandatory" />}
          {fw.name}
        </div>
        <div className="esg2-fw-row-meta">
          <span className="esg2-fw-region">{fw.region}</span>
          <span className="esg2-fw-pillar">{fw.pillar}</span>
          <span className="esg2-fw-driver">{fw.driver}</span>
        </div>
        <div className="esg2-fw-desc">{fw.description}</div>
      </div>
      <div className="esg2-fw-row-actions">
        <select
          className="esg2-fw-status-select"
          value={status}
          onChange={(e) => onUpdate(fw.id, fw.name, e.target.value, statusObj?.notes || '')}
        >
          {Object.entries(statusLabels).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        {statusObj?.lastReviewDate && (
          <span className="esg2-fw-reviewed">Reviewed {statusObj.lastReviewDate}</span>
        )}
      </div>
    </div>
  );
}

/** Insight card — actionable gap/opportunity. */
function InsightCard({ icon, title, detail, priority }) {
  const cls = priority === 'high' ? 'red' : priority === 'medium' ? 'amber' : 'green';
  return (
    <div className={`esg2-insight-card esg2-insight-${cls}`}>
      <div className="esg2-insight-icon">{icon}</div>
      <div>
        <div className="esg2-insight-title">{title}</div>
        <div className="esg2-insight-detail">{detail}</div>
      </div>
    </div>
  );
}

/** Score breakdown row (shown in Analysis). */
function BreakdownRow({ label, value, score, unit }) {
  if (value == null) return null;
  return (
    <div className="esg2-breakdown-row">
      <span className="esg2-breakdown-label">{label}</span>
      <span className="esg2-breakdown-value">{typeof value === 'number' ? `${value}${unit ? ' ' + unit : ''}` : value}</span>
      <span className="esg2-breakdown-score" style={{ color: scoreColor(score) }}>{score}/100</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERVIEW PANEL
// ─────────────────────────────────────────────────────────────────────────────
function OverviewPanel({ groupScores, opcoScores, selectedParent, onTabSwitch }) {
  if (!groupScores) {
    return (
      <div className="esg2-empty-state">
        <div className="esg2-empty-icon">📊</div>
        <h3>No ESG data yet for {selectedParent || 'this group'}</h3>
        <p>Start by entering your first set of ESG metrics in the <strong>Metrics</strong> tab. Scores are computed automatically from the data you enter.</p>
        <button className="esg2-btn esg2-btn-primary" onClick={() => onTabSwitch('metrics')}>Enter ESG Metrics</button>
      </div>
    );
  }

  const { env, social, gov, overall, rating, opcoCount } = groupScores;

  // Build insights from scores
  const insights = [];
  if (env < 40) insights.push({ icon: '🌱', title: 'Environmental score needs attention', detail: `Group E score is ${env}/100. Enter Scope 1/2 emissions and renewable energy data to identify improvement areas.`, priority: 'high' });
  if (social < 40) insights.push({ icon: '👥', title: 'Social metrics require data', detail: `Group S score is ${social}/100. Emiratisation/Saudisation compliance and gender diversity are primary drivers.`, priority: 'high' });
  if (gov < 50) insights.push({ icon: '🏛', title: 'Governance policies incomplete', detail: `Group G score is ${gov}/100. Anti-corruption policy, whistleblower mechanism and ESG report publication are quick wins.`, priority: 'medium' });
  if (overall >= 71) insights.push({ icon: '🏆', title: 'Leading ESG performance', detail: 'Group score is in the Leading band. Focus on third-party assurance and TCFD/ISSB alignment to maintain leadership.', priority: 'low' });

  const latestOpcos = Object.entries(opcoScores || {}).map(([opco, records]) => ({ opco, ...(records[0]?.computed || {}) })).sort((a, b) => (b.overall || 0) - (a.overall || 0));

  return (
    <div className="esg2-overview">
      {/* Group health score */}
      <div className="esg2-hero-section">
        <div className="esg2-hero-score">
          <ScoreRing score={overall} size={128} />
          <div className="esg2-hero-text">
            <div className={`esg2-rating-badge esg2-rating-${ratingClass(overall)}`}>{ratingLabel(overall)}</div>
            <h2 className="esg2-hero-title">Group ESG Health</h2>
            <p className="esg2-hero-sub">{selectedParent || 'Group consolidated'} · {opcoCount} operating compan{opcoCount !== 1 ? 'ies' : 'y'}</p>
          </div>
        </div>
        <div className="esg2-pillars-row">
          <div className="esg2-pillar-card esg2-pillar-e">
            <span className="esg2-pillar-icon">🌱</span>
            <span className="esg2-pillar-score" style={{ color: scoreColor(env) }}>{env || '—'}</span>
            <span className="esg2-pillar-name">Environmental</span>
            <ScoreBar label="" score={env} color="#22c55e" />
          </div>
          <div className="esg2-pillar-card esg2-pillar-s">
            <span className="esg2-pillar-icon">👥</span>
            <span className="esg2-pillar-score" style={{ color: scoreColor(social) }}>{social || '—'}</span>
            <span className="esg2-pillar-name">Social</span>
            <ScoreBar label="" score={social} color="#3b82f6" />
          </div>
          <div className="esg2-pillar-card esg2-pillar-g">
            <span className="esg2-pillar-icon">🏛</span>
            <span className="esg2-pillar-score" style={{ color: scoreColor(gov) }}>{gov || '—'}</span>
            <span className="esg2-pillar-name">Governance</span>
            <ScoreBar label="" score={gov} color="#8b5cf6" />
          </div>
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="esg2-section">
          <h3 className="esg2-section-title">Key Insights &amp; Action Items</h3>
          <div className="esg2-insights-grid">
            {insights.map((ins, i) => <InsightCard key={i} {...ins} />)}
          </div>
        </div>
      )}

      {/* OpCo leaderboard */}
      {latestOpcos.length > 0 && (
        <div className="esg2-section">
          <h3 className="esg2-section-title">Operating Company Scores</h3>
          <div className="esg2-opco-table">
            <div className="esg2-opco-table-head">
              <span>OpCo</span><span>E</span><span>S</span><span>G</span><span>Overall</span><span>Rating</span><span>Completeness</span>
            </div>
            {latestOpcos.map(({ opco, env: e, social: s, gov: g, overall: o, rating: r, completeness: c }) => (
              <div key={opco} className="esg2-opco-table-row">
                <span className="esg2-opco-name">{opco}</span>
                <span style={{ color: scoreColor(e || 0) }}>{e || '—'}</span>
                <span style={{ color: scoreColor(s || 0) }}>{s || '—'}</span>
                <span style={{ color: scoreColor(g || 0) }}>{g || '—'}</span>
                <span className="esg2-opco-overall" style={{ color: scoreColor(o || 0) }}><strong>{o || '—'}</strong></span>
                <span className={`esg2-rating-chip esg2-rating-${ratingClass(o || 0)}`}>{ratingLabel(o || 0)}</span>
                <CompletenessChip pct={c || 0} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="esg2-section esg2-quick-actions">
        <button className="esg2-btn esg2-btn-primary" onClick={() => onTabSwitch('metrics')}>📝 Enter Metrics</button>
        <button className="esg2-btn esg2-btn-secondary" onClick={() => onTabSwitch('analysis')}>📈 View Analysis</button>
        <button className="esg2-btn esg2-btn-secondary" onClick={() => onTabSwitch('compliance')}>✅ Check Compliance</button>
        <button className="esg2-btn esg2-btn-secondary" onClick={() => onTabSwitch('reports')}>📄 Reports</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// METRICS PANEL
// ─────────────────────────────────────────────────────────────────────────────
function MetricsPanel({ opcos, selectedParent }) {
  const [selectedOpco, setSelectedOpco] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState(PERIODS[0]);
  const [activePillar, setActivePillar] = useState('environmental');
  const [formData, setFormData] = useState({ environmental: {}, social: {}, governance: {} });
  const [liveScore, setLiveScore] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const saveTimer = useRef(null);

  const opco = selectedOpco || opcos[0] || '';

  // Load existing record when opco+period changes
  useEffect(() => {
    if (!opco || !selectedPeriod || !selectedParent) return;
    setLoading(true);
    fetch(`${API}/esg/metrics?parent=${encodeURIComponent(selectedParent)}&opco=${encodeURIComponent(opco)}&period=${encodeURIComponent(selectedPeriod)}`)
      .then(r => r.json())
      .then(data => {
        const record = (data.metrics || [])[0];
        if (record) {
          setFormData({ environmental: record.environmental || {}, social: record.social || {}, governance: record.governance || {} });
          setLiveScore(record.computed || null);
        } else {
          setFormData({ environmental: {}, social: {}, governance: {} });
          setLiveScore(null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [opco, selectedPeriod, selectedParent]);

  // Auto-save on field change
  function handleFieldChange(pillar, id, value) {
    const updated = { ...formData, [pillar]: { ...formData[pillar], [id]: value } };
    setFormData(updated);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => autoSave(updated), 1500);
  }

  async function autoSave(data) {
    if (!opco || !selectedPeriod || !selectedParent) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/esg/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent: selectedParent, opco, period: selectedPeriod, ...data }),
      });
      const saved = await res.json();
      setLiveScore(saved.computed || null);
      setSaveMsg('Saved ✓');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch (_) {
      setSaveMsg('Save failed');
    } finally {
      setSaving(false);
    }
  }

  const pillarFields = { environmental: ENV_FIELDS, social: SOCIAL_FIELDS, governance: GOV_FIELDS };
  const pillarColors = { environmental: '#22c55e', social: '#3b82f6', governance: '#8b5cf6' };
  const pillarIcons = { environmental: '🌱', social: '👥', governance: '🏛' };

  return (
    <div className="esg2-metrics-panel">
      {/* Selector bar */}
      <div className="esg2-metrics-selectors">
        <div className="esg2-selector-group">
          <label>Operating Company</label>
          <select value={opco} onChange={e => setSelectedOpco(e.target.value)}>
            {opcos.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="esg2-selector-group">
          <label>Reporting Period</label>
          <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}>
            {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="esg2-metrics-save-state">
          {saving && <span className="esg2-saving">Saving…</span>}
          {!saving && saveMsg && <span className={`esg2-save-msg ${saveMsg.includes('✓') ? 'ok' : 'err'}`}>{saveMsg}</span>}
        </div>
      </div>

      {/* Live score preview */}
      {liveScore && (
        <div className="esg2-live-score-bar">
          <span className="esg2-live-label">Live score preview:</span>
          {[['E', liveScore.env?.score, '#22c55e'], ['S', liveScore.social?.score, '#3b82f6'], ['G', liveScore.gov?.score, '#8b5cf6']].map(([l, s, c]) => (
            <span key={l} className="esg2-live-chip" style={{ borderColor: c }}>
              <span style={{ color: c }}>{l}</span> <strong style={{ color: scoreColor(s || 0) }}>{s || '—'}</strong>
            </span>
          ))}
          <span className="esg2-live-chip esg2-live-overall">
            Overall <strong style={{ color: scoreColor(liveScore.overall || 0) }}>{liveScore.overall || '—'}</strong>
          </span>
          <CompletenessChip pct={liveScore.completeness || 0} />
        </div>
      )}

      {/* Pillar tabs */}
      <div className="esg2-pillar-tabs">
        {['environmental', 'social', 'governance'].map(p => (
          <button
            key={p}
            className={`esg2-pillar-tab ${activePillar === p ? 'active' : ''}`}
            style={activePillar === p ? { borderBottomColor: pillarColors[p], color: pillarColors[p] } : {}}
            onClick={() => setActivePillar(p)}
          >
            {pillarIcons[p]} {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="esg2-loading">Loading record…</div>
      ) : (
        <div className="esg2-fields-grid">
          {pillarFields[activePillar].map(field => (
            <MetricInput
              key={field.id}
              fieldDef={field}
              value={formData[activePillar]?.[field.id]}
              onChange={(id, val) => handleFieldChange(activePillar, id, val)}
            />
          ))}
        </div>
      )}

      <div className="esg2-metrics-footer">
        <span className="esg2-metrics-footer-hint">
          Data is saved automatically as you type. Scores are recomputed on every save. All fields are optional — completeness percentage reflects how much data has been entered.
        </span>
        <button className="esg2-btn esg2-btn-secondary" onClick={() => autoSave(formData)}>
          Save Now
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ANALYSIS PANEL
// ─────────────────────────────────────────────────────────────────────────────
function AnalysisPanel({ opcoScores, selectedParent }) {
  const [selectedOpco, setSelectedOpco] = useState('');
  const [selectedPillar, setSelectedPillar] = useState('overall');

  const opcoNames = Object.keys(opcoScores || {});
  const opco = selectedOpco || opcoNames[0] || '';
  const opcoHistory = (opcoScores[opco] || []).slice(0, 6).reverse(); // oldest first for trend

  // Pillar score data for selected opco across periods
  const trendData = opcoHistory.map(r => ({
    period: r.period,
    env: r.computed?.env?.score || 0,
    social: r.computed?.social?.score || 0,
    gov: r.computed?.gov?.score || 0,
    overall: r.computed?.overall || 0,
  }));

  // Latest scores for all OpCos (for comparison)
  const opcoLatest = opcoNames.map(o => {
    const latest = (opcoScores[o] || [])[0];
    return { opco: o, env: latest?.computed?.env?.score || 0, social: latest?.computed?.social?.score || 0, gov: latest?.computed?.gov?.score || 0, overall: latest?.computed?.overall || 0, completeness: latest?.computed?.completeness || 0 };
  }).sort((a, b) => b.overall - a.overall);

  // Breakdown for selected opco (latest)
  const latestRecord = (opcoScores[opco] || [])[0];
  const breakdown = latestRecord?.computed || null;

  // Sector benchmark
  const sectorName = Object.keys(SECTOR_BENCHMARKS)[0];
  const benchmark = SECTOR_BENCHMARKS[sectorName];
  const latestOverall = latestRecord?.computed?.overall || 0;
  const peerCount = benchmark.peers;
  const belowPeer = benchmark.p25 > latestOverall;
  const percentile = latestOverall >= benchmark.p75 ? 75 : latestOverall >= benchmark.median ? 50 : latestOverall >= benchmark.p25 ? 25 : 10;

  if (opcoNames.length === 0) {
    return (
      <div className="esg2-empty-state">
        <div className="esg2-empty-icon">📈</div>
        <h3>No data available for analysis</h3>
        <p>Enter ESG metrics in the <strong>Metrics</strong> tab to unlock trend charts, peer benchmarking and gap analysis.</p>
      </div>
    );
  }

  return (
    <div className="esg2-analysis-panel">
      <div className="esg2-analysis-controls">
        <div className="esg2-selector-group">
          <label>View OpCo</label>
          <select value={opco} onChange={e => setSelectedOpco(e.target.value)}>
            {opcoNames.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="esg2-selector-group">
          <label>Score pillar</label>
          <select value={selectedPillar} onChange={e => setSelectedPillar(e.target.value)}>
            <option value="overall">Overall</option>
            <option value="env">Environmental (E)</option>
            <option value="social">Social (S)</option>
            <option value="gov">Governance (G)</option>
          </select>
        </div>
      </div>

      <div className="esg2-analysis-grid">
        {/* Trend chart */}
        <div className="esg2-analysis-card esg2-card-wide">
          <h4 className="esg2-card-title">Period Trend — {opco}</h4>
          {trendData.length < 2 ? (
            <p className="esg2-no-data-hint">Enter data for at least 2 periods to see trends.</p>
          ) : (
            <div className="esg2-trend-chart">
              {trendData.map((d, i) => {
                const val = d[selectedPillar === 'env' ? 'env' : selectedPillar === 'social' ? 'social' : selectedPillar === 'gov' ? 'gov' : 'overall'];
                const color = selectedPillar === 'env' ? '#22c55e' : selectedPillar === 'social' ? '#3b82f6' : selectedPillar === 'gov' ? '#8b5cf6' : scoreColor(val);
                return (
                  <div key={d.period} className="esg2-trend-col">
                    <span className="esg2-trend-val" style={{ color }}>{val}</span>
                    <div className="esg2-trend-bar-wrap">
                      <div className="esg2-trend-bar" style={{ height: `${val}%`, background: color }} />
                    </div>
                    <span className="esg2-trend-period">{d.period.replace('-', '\n')}</span>
                    {i > 0 && (
                      <TrendChip
                        current={val}
                        previous={trendData[i - 1][selectedPillar === 'env' ? 'env' : selectedPillar === 'social' ? 'social' : selectedPillar === 'gov' ? 'gov' : 'overall']}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Peer benchmarking */}
        <div className="esg2-analysis-card">
          <h4 className="esg2-card-title">GCC Peer Benchmarking</h4>
          <div className="esg2-benchmark-body">
            <div className="esg2-benchmark-score-line">
              <span className="esg2-benchmark-your">Your score: <strong style={{ color: scoreColor(latestOverall) }}>{latestOverall}</strong></span>
              <span className="esg2-benchmark-pct">~{percentile}th percentile</span>
            </div>
            <div className="esg2-benchmark-bar-group">
              {[
                { label: 'P25 peer', val: benchmark.p25, color: '#ef4444' },
                { label: 'Peer median', val: benchmark.median, color: '#f59e0b' },
                { label: 'P75 peer', val: benchmark.p75, color: '#22c55e' },
                { label: 'Your score', val: latestOverall, color: scoreColor(latestOverall) },
              ].map(b => (
                <div key={b.label} className="esg2-bm-bar-row">
                  <span className="esg2-bm-bar-label">{b.label}</span>
                  <div className="esg2-bm-bar-track">
                    <div className="esg2-bm-bar-fill" style={{ width: `${b.val}%`, background: b.color }} />
                  </div>
                  <span className="esg2-bm-bar-val" style={{ color: b.color }}>{b.val}</span>
                </div>
              ))}
            </div>
            {belowPeer && <p className="esg2-benchmark-alert">⚠ Score is below 25th percentile. Prioritise data completeness and quick-win governance policies.</p>}
            <p className="esg2-benchmark-note">Anonymised GCC peer data · {peerCount} entities</p>
          </div>
        </div>

        {/* Score breakdown */}
        {breakdown && (
          <div className="esg2-analysis-card">
            <h4 className="esg2-card-title">Score Breakdown — {opco} (Latest)</h4>
            <div className="esg2-pillar-scores-stack">
              <ScoreBar label="Environmental" score={breakdown.env?.score || 0} color="#22c55e" subLabel={`${breakdown.env?.completeness || 0}% complete`} />
              <ScoreBar label="Social" score={breakdown.social?.score || 0} color="#3b82f6" subLabel={`${breakdown.social?.completeness || 0}% complete`} />
              <ScoreBar label="Governance" score={breakdown.gov?.score || 0} color="#8b5cf6" subLabel={`${breakdown.gov?.completeness || 0}% complete`} />
            </div>
            {/* Environmental drivers */}
            {Object.keys(breakdown.env?.breakdown || {}).length > 0 && (
              <div className="esg2-breakdown-section">
                <h5>Environmental drivers</h5>
                {Object.entries(breakdown.env.breakdown).map(([k, b]) => (
                  <BreakdownRow key={k} label={k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())} value={b.value} score={b.score} unit={b.unit} />
                ))}
              </div>
            )}
            {Object.keys(breakdown.gov?.breakdown || {}).length > 0 && (
              <div className="esg2-breakdown-section">
                <h5>Governance drivers</h5>
                {Object.entries(breakdown.gov.breakdown).map(([k, b]) => (
                  <BreakdownRow key={k} label={k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())} value={b.value} score={b.score} unit={b.unit} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* OpCo comparison heat-map */}
        <div className="esg2-analysis-card esg2-card-wide">
          <h4 className="esg2-card-title">OpCo Comparison (Latest Period)</h4>
          <div className="esg2-heatmap">
            <div className="esg2-heatmap-head">
              <span>OpCo</span><span>E</span><span>S</span><span>G</span><span>Overall</span><span>Data</span>
            </div>
            {opcoLatest.map(row => (
              <div key={row.opco} className="esg2-heatmap-row">
                <span className="esg2-heatmap-opco">{row.opco}</span>
                {[row.env, row.social, row.gov, row.overall].map((s, i) => (
                  <span key={i} className="esg2-heatmap-cell" style={{ background: s ? scoreColor(s) + '28' : 'transparent', color: s ? scoreColor(s) : 'var(--text-muted)' }}>
                    {s || '—'}
                  </span>
                ))}
                <span><CompletenessChip pct={row.completeness} /></span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPLIANCE PANEL
// ─────────────────────────────────────────────────────────────────────────────
function CompliancePanel({ frameworkStatus, selectedParent, onStatusUpdate }) {
  const [regionFilter, setRegionFilter] = useState('all');

  const regions = ['all', 'UAE', 'KSA', 'Global'];
  const filtered = regionFilter === 'all' ? GCC_FRAMEWORKS : GCC_FRAMEWORKS.filter(f => f.region === regionFilter);

  const completed = GCC_FRAMEWORKS.filter(f => (frameworkStatus[f.id]?.status || 'not-started') === 'completed').length;
  const mandatory = GCC_FRAMEWORKS.filter(f => f.mandatory);
  const mandatoryCompleted = mandatory.filter(f => (frameworkStatus[f.id]?.status || 'not-started') === 'completed').length;

  return (
    <div className="esg2-compliance-panel">
      <div className="esg2-compliance-summary-bar">
        <div className="esg2-compliance-stat">
          <span className="esg2-cs-val">{completed}/{GCC_FRAMEWORKS.length}</span>
          <span className="esg2-cs-label">Frameworks completed</span>
        </div>
        <div className="esg2-compliance-stat">
          <span className="esg2-cs-val" style={{ color: mandatoryCompleted === mandatory.length ? '#22c55e' : '#ef4444' }}>
            {mandatoryCompleted}/{mandatory.length}
          </span>
          <span className="esg2-cs-label">Mandatory completed</span>
        </div>
        <div className="esg2-compliance-stat">
          <span className="esg2-cs-val">{GCC_FRAMEWORKS.filter(f => (frameworkStatus[f.id]?.status || 'not-started') === 'in-progress').length}</span>
          <span className="esg2-cs-label">In progress</span>
        </div>
      </div>

      <div className="esg2-region-filter">
        {regions.map(r => (
          <button key={r} className={`esg2-region-btn ${regionFilter === r ? 'active' : ''}`} onClick={() => setRegionFilter(r)}>
            {r === 'all' ? 'All regions' : r}
          </button>
        ))}
      </div>

      <div className="esg2-fw-list">
        {filtered.map(fw => (
          <FrameworkStatusRow
            key={fw.id}
            fw={fw}
            statusObj={frameworkStatus[fw.id] || null}
            onUpdate={onStatusUpdate}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORTS PANEL
// ─────────────────────────────────────────────────────────────────────────────
function ReportsPanel({ opcoScores, frameworkStatus, selectedParent }) {
  const opcoLatest = Object.entries(opcoScores || {}).map(([opco, records]) => ({
    opco, parent: selectedParent, ...(records[0]?.computed || {}),
    period: records[0]?.period || '',
  }));

  function exportCsv() {
    const headers = ['Parent', 'OpCo', 'Period', 'E Score', 'S Score', 'G Score', 'Overall', 'Rating', 'Completeness'];
    const rows = opcoLatest.map(r => [
      r.parent, r.opco, r.period,
      r.env?.score ?? '—', r.social?.score ?? '—', r.gov?.score ?? '—',
      r.overall ?? '—', r.rating ?? '—', r.completeness ? `${r.completeness}%` : '—',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ESG_Scores_${(selectedParent || 'Group').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const disclosureChecklist = [
    { label: 'Scope 1 & 2 Emissions disclosed', framework: 'TCFD / ISSB S2', done: opcoLatest.some(r => r.env?.breakdown?.carbonIntensity) },
    { label: 'Scope 3 Emissions disclosed', framework: 'TCFD / ISSB S2', done: opcoLatest.some(r => r.env?.breakdown?.scope3) },
    { label: 'Energy consumption disclosed', framework: 'GRI 302', done: false },
    { label: 'Water withdrawal disclosed', framework: 'GRI 303', done: opcoLatest.some(r => r.env?.breakdown?.waterIntensity) },
    { label: 'Waste metrics disclosed', framework: 'GRI 306', done: opcoLatest.some(r => r.env?.breakdown?.wasteDiversion) },
    { label: 'Emiratisation / Saudisation rate', framework: 'Regulatory (UAE/KSA)', done: opcoLatest.some(r => r.social?.breakdown?.emiratization || r.social?.breakdown?.saudization) },
    { label: 'Gender diversity metrics', framework: 'GRI 405', done: opcoLatest.some(r => r.social?.breakdown?.genderDiversity) },
    { label: 'Workforce safety (LTIR)', framework: 'GRI 403', done: opcoLatest.some(r => r.social?.breakdown?.safety) },
    { label: 'Board independence % disclosed', framework: 'GRI 405 / CMA', done: opcoLatest.some(r => r.gov?.breakdown?.boardIndependence) },
    { label: 'ESG report published', framework: 'DFM/ADX / Tadawul', done: opcoLatest.some(r => r.gov?.breakdown?.transparency?.esgReportPublished) },
    { label: 'Third-party ESG assurance', framework: 'ISSB S1', done: opcoLatest.some(r => r.gov?.breakdown?.transparency?.thirdPartyAudit) },
  ];
  const disclosedCount = disclosureChecklist.filter(d => d.done).length;

  return (
    <div className="esg2-reports-panel">
      <div className="esg2-reports-actions">
        <button className="esg2-btn esg2-btn-primary" onClick={exportCsv}>⬇ Export ESG Scores (CSV)</button>
      </div>

      <div className="esg2-section">
        <h3 className="esg2-section-title">Disclosure Checklist ({disclosedCount}/{disclosureChecklist.length} items have data)</h3>
        <div className="esg2-disclosure-list">
          {disclosureChecklist.map((item, i) => (
            <div key={i} className={`esg2-disclosure-row ${item.done ? 'done' : 'missing'}`}>
              <span className="esg2-disclosure-icon">{item.done ? '✓' : '○'}</span>
              <span className="esg2-disclosure-label">{item.label}</span>
              <span className="esg2-disclosure-fw">{item.framework}</span>
            </div>
          ))}
        </div>
      </div>

      {opcoLatest.length > 0 && (
        <div className="esg2-section">
          <h3 className="esg2-section-title">Score Summary</h3>
          <div className="esg2-opco-table">
            <div className="esg2-opco-table-head">
              <span>OpCo</span><span>Period</span><span>E</span><span>S</span><span>G</span><span>Overall</span><span>Rating</span>
            </div>
            {opcoLatest.map(r => (
              <div key={r.opco} className="esg2-opco-table-row">
                <span>{r.opco}</span>
                <span className="esg2-period-chip">{r.period}</span>
                <span style={{ color: scoreColor(r.env?.score || 0) }}>{r.env?.score || '—'}</span>
                <span style={{ color: scoreColor(r.social?.score || 0) }}>{r.social?.score || '—'}</span>
                <span style={{ color: scoreColor(r.gov?.score || 0) }}>{r.gov?.score || '—'}</span>
                <span><strong style={{ color: scoreColor(r.overall || 0) }}>{r.overall || '—'}</strong></span>
                <span className={`esg2-rating-chip esg2-rating-${ratingClass(r.overall || 0)}`}>{ratingLabel(r.overall || 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="esg2-section esg2-scoring-methodology">
        <h3 className="esg2-section-title">Scoring Methodology (Transparent)</h3>
        <div className="esg2-method-grid">
          <div className="esg2-method-card">
            <h4>🌱 Environmental (E)</h4>
            <ul>
              <li><strong>30%</strong> Carbon intensity (Scope 1+2 per FTE)</li>
              <li><strong>25%</strong> Renewable energy share</li>
              <li><strong>15%</strong> Water intensity (m³/FTE)</li>
              <li><strong>15%</strong> Waste diversion from landfill</li>
              <li><strong>10%</strong> Green building certification</li>
              <li><strong>5%</strong> Scope 3 disclosure credit</li>
            </ul>
          </div>
          <div className="esg2-method-card">
            <h4>👥 Social (S)</h4>
            <ul>
              <li><strong>25%</strong> Emiratisation / Saudisation vs target</li>
              <li><strong>20%</strong> Gender diversity (% female)</li>
              <li><strong>20%</strong> Workplace safety (LTIR)</li>
              <li><strong>15%</strong> Training hours per FTE/year</li>
              <li><strong>10%</strong> Community investment (% revenue)</li>
              <li><strong>10%</strong> Employee satisfaction score</li>
            </ul>
          </div>
          <div className="esg2-method-card">
            <h4>🏛 Governance (G)</h4>
            <ul>
              <li><strong>30%</strong> Policy adoption (anti-corruption + whistleblower + privacy)</li>
              <li><strong>30%</strong> Transparency (ESG report + 3rd-party audit)</li>
              <li><strong>25%</strong> Board independence %</li>
              <li><strong>15%</strong> Female board members %</li>
            </ul>
          </div>
        </div>
        <p className="esg2-method-note">
          Scores are computed server-side from entered data. Metrics with no data are excluded from the denominator — only entered metrics influence the score. Data completeness % indicates coverage reliability.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// M&A EXPORTS (backward compatibility — use live data when available)
// ─────────────────────────────────────────────────────────────────────────────
export function getEsgDataForMa(opcoOrParent) {
  // Synchronous fallback — returns null if no data (async fetch not possible here)
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('esg_ma_cache') : null;
    if (!raw) return null;
    const cache = JSON.parse(raw);
    return cache[opcoOrParent] || null;
  } catch (_) { return null; }
}

export function getEsgSummaryForMa(opcoOrParent) {
  const data = getEsgDataForMa(opcoOrParent);
  if (!data) return '';
  return `${data.entity || opcoOrParent} (${data.jurisdiction || ''}, ${data.year || ''}): Environmental ${data.env || '—'}, Social ${data.social || '—'}, Governance ${data.gov || '—'}; Overall ESG score ${data.overall || '—'}/100.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export function EsgSummary({ language = 'en', selectedParentHolding = '', companiesRefreshKey = 0 }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [opcos, setOpcos] = useState([]);
  const [opcoScores, setOpcoScores] = useState({});
  const [groupScores, setGroupScores] = useState(null);
  const [frameworkStatus, setFrameworkStatus] = useState({});
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);

  const parent = selectedParentHolding;

  // Fetch OpCos
  useEffect(() => {
    if (!parent) { setOpcos([]); return; }
    fetch(`${API}/companies/by-parent?parent=${encodeURIComponent(parent)}`)
      .then(r => r.json())
      .then(d => setOpcos((d.opcos || []).map(o => o.name || o).filter(Boolean)))
      .catch(() => setOpcos([]));
  }, [parent, companiesRefreshKey]);

  // Fetch ESG scores
  const fetchScores = () => {
    if (!parent) return;
    setLoading(true);
    fetch(`${API}/esg/scores?parent=${encodeURIComponent(parent)}`)
      .then(r => r.json())
      .then(d => {
        setOpcoScores(d.byOpco || {});
        setGroupScores(d.group?.opcoCount > 0 ? d.group : null);
        setLastRefresh(new Date());
        // Cache for M&A exports
        const cache = {};
        Object.entries(d.byOpco || {}).forEach(([opco, records]) => {
          const r = records[0];
          if (r) cache[opco] = { entity: opco, jurisdiction: 'GCC', year: new Date().getFullYear(), env: r.computed?.env?.score, social: r.computed?.social?.score, gov: r.computed?.gov?.score, overall: r.computed?.overall };
        });
        try { localStorage.setItem('esg_ma_cache', JSON.stringify(cache)); } catch (_) {}
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchScores(); }, [parent, companiesRefreshKey]);

  // Fetch framework status
  useEffect(() => {
    if (!parent) return;
    fetch(`${API}/esg/framework-status?parent=${encodeURIComponent(parent)}`)
      .then(r => r.json())
      .then(d => {
        const map = {};
        Object.entries(d.frameworkStatus || {}).forEach(([key, val]) => {
          const fwId = GCC_FRAMEWORKS.find(f => f.name === val.framework)?.id || val.framework;
          map[fwId] = val;
        });
        setFrameworkStatus(map);
      })
      .catch(() => {});
  }, [parent, companiesRefreshKey]);

  async function handleFrameworkStatusUpdate(fwId, fwName, status, notes) {
    if (!parent) return;
    try {
      await fetch(`${API}/esg/framework-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent, framework: fwName, status, notes }),
      });
      setFrameworkStatus(prev => ({ ...prev, [fwId]: { ...prev[fwId], status, notes, lastReviewDate: new Date().toISOString().slice(0, 10) } }));
    } catch (_) {}
  }

  const TABS = [
    { id: 'overview',    icon: '🎯', label: 'Overview' },
    { id: 'metrics',     icon: '📝', label: 'Metrics' },
    { id: 'analysis',    icon: '📈', label: 'Analysis' },
    { id: 'compliance',  icon: '✅', label: 'GCC Compliance' },
    { id: 'reports',     icon: '📄', label: 'Reports' },
  ];

  if (!parent) {
    return (
      <div className="esg2-no-parent">
        <div className="esg2-empty-icon">🌿</div>
        <h2>ESG Module</h2>
        <p>Select a <strong>Parent Holding company</strong> in the Parent Holding Overview to view and manage ESG data.</p>
      </div>
    );
  }

  return (
    <div className="esg2-root">
      {/* Header */}
      <div className="esg2-header">
        <div className="esg2-header-title">
          <h2 className="esg2-title">ESG Performance</h2>
          <span className="esg2-parent-chip">{parent}</span>
        </div>
        <div className="esg2-header-actions">
          {lastRefresh && <span className="esg2-last-refresh">Updated {lastRefresh.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>}
          <button className="esg2-btn esg2-btn-ghost" onClick={fetchScores} disabled={loading} title="Refresh scores">
            {loading ? '⟳' : '↻'} Refresh
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <nav className="esg2-tab-nav" role="tablist">
        {TABS.map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`esg2-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => { setActiveTab(tab.id); if (tab.id !== 'metrics') fetchScores(); }}
          >
            <span className="esg2-tab-icon">{tab.icon}</span>
            <span className="esg2-tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div className="esg2-tab-content" role="tabpanel">
        {activeTab === 'overview' && (
          <OverviewPanel
            groupScores={groupScores}
            opcoScores={opcoScores}
            selectedParent={parent}
            onTabSwitch={setActiveTab}
          />
        )}
        {activeTab === 'metrics' && (
          <MetricsPanel
            opcos={opcos.length > 0 ? opcos : Object.keys(opcoScores)}
            selectedParent={parent}
          />
        )}
        {activeTab === 'analysis' && (
          <AnalysisPanel
            opcoScores={opcoScores}
            selectedParent={parent}
          />
        )}
        {activeTab === 'compliance' && (
          <CompliancePanel
            frameworkStatus={frameworkStatus}
            selectedParent={parent}
            onStatusUpdate={handleFrameworkStatusUpdate}
          />
        )}
        {activeTab === 'reports' && (
          <ReportsPanel
            opcoScores={opcoScores}
            frameworkStatus={frameworkStatus}
            selectedParent={parent}
          />
        )}
      </div>
    </div>
  );
}
