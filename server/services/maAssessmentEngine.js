/**
 * Pure M&A assessment model: frameworks, costs, timelines, risk register, regulatory matrix, value bridge.
 * Loaded coefficients drive financial and time estimates; defaults apply if config file is missing or invalid.
 */

import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COEFFICIENTS_PATH = join(__dirname, '../config/ma-coefficients.json');

export const MA_SCHEMA_VERSION = '1.0.0';

export const FRAMEWORK_SCOPES = {
  'DFSA Rulebook': 'DIFC financial services, conduct of business, prudential, AML/CFT',
  SAMA: 'KSA banking, insurance, AML/CFT',
  CMA: 'KSA capital markets, listing, corporate governance',
  'Dubai 2040': 'Dubai urban planning, sustainability',
  'Saudi 2030': 'Vision 2030, local content, sector strategy',
  SDAIA: 'KSA data governance, AI ethics',
  'ADGM FSRA Rulebook': 'ADGM financial services, AML/CFT',
  'ADGM Companies Regulations': 'ADGM company registration',
  'CBUAE Rulebook': 'UAE federal banking, insurance, AML/CFT',
  'UAE AML/CFT': 'UAE federal AML/CFT',
  'UAE Federal Laws': 'UAE federal commercial, labour, sector laws',
  'JAFZA Operating Regulations': 'JAFZA licensing, customs',
  'DMCC Company Regulations': 'DMCC company formation',
  'DMCC Compliance & AML': 'DMCC AML/CFT',
  'QFCRA Rules': 'Qatar Financial Centre',
  'Qatar AML Law': 'Qatar AML/CFT',
  'CBB Rulebook': 'Bahrain banking, AML',
  'BHB Sustainability ESG': 'Bahrain Bourse ESG disclosure',
  'Oman CMA Regulations': 'Oman securities, governance',
  'Oman AML Law': 'Oman AML/CFT',
  'Kuwait CMA Regulations': 'Kuwait securities, listing',
  'Kuwait AML Law': 'Kuwait AML/CFT',
};

export const FRAMEWORK_TO_ZONE = {
  'DFSA Rulebook': { zone: 'DIFC', location: 'DIFC, Dubai, UAE' },
  'Dubai 2040': { zone: 'Dubai Mainland', location: 'Dubai, UAE' },
  SAMA: { zone: 'KSA Onshore', location: 'Saudi Arabia (KSA)' },
  CMA: { zone: 'KSA Onshore', location: 'Saudi Arabia (KSA)' },
  'Saudi 2030': { zone: 'KSA Onshore', location: 'Saudi Arabia (KSA)' },
  SDAIA: { zone: 'KSA Onshore', location: 'Saudi Arabia (KSA)' },
  'ADGM FSRA Rulebook': { zone: 'ADGM', location: 'Abu Dhabi Global Market, UAE' },
  'ADGM Companies Regulations': { zone: 'ADGM', location: 'Abu Dhabi Global Market, UAE' },
  'CBUAE Rulebook': { zone: 'Abu Dhabi Mainland', location: 'Abu Dhabi, UAE' },
  'UAE AML/CFT': { zone: 'UAE Federal', location: 'UAE' },
  'UAE Federal Laws': { zone: 'UAE Federal', location: 'UAE' },
  'JAFZA Operating Regulations': { zone: 'JAFZA', location: 'Dubai, UAE' },
  'DMCC Company Regulations': { zone: 'DMCC', location: 'Dubai, UAE' },
  'DMCC Compliance & AML': { zone: 'DMCC', location: 'Dubai, UAE' },
  'QFCRA Rules': { zone: 'Qatar QFC', location: 'Qatar' },
  'Qatar AML Law': { zone: 'Qatar', location: 'Qatar' },
  'CBB Rulebook': { zone: 'Bahrain', location: 'Bahrain' },
  'BHB Sustainability ESG': { zone: 'Bahrain', location: 'Bahrain' },
  'Oman CMA Regulations': { zone: 'Oman', location: 'Oman' },
  'Oman AML Law': { zone: 'Oman', location: 'Oman' },
  'Kuwait CMA Regulations': { zone: 'Kuwait', location: 'Kuwait' },
  'Kuwait AML Law': { zone: 'Kuwait', location: 'Kuwait' },
};

export const KEY_PROCESSES_BY_FRAMEWORK = {
  'DFSA Rulebook': ['Licence variation / notification to DFSA', 'AML/CFT policies and MLRO appointment', 'Conduct of business and client asset reporting', 'Prudential returns and capital adequacy'],
  SAMA: ['SAMA registration / licence update', 'AML/CFT and sanctions compliance', 'Capital adequacy and liquidity reporting', 'Conduct and disclosure standards'],
  CMA: ['CMA notification of change of control', 'Listing rules and disclosure', 'Corporate governance and board composition', 'Continuous disclosure obligations'],
  'CBUAE Rulebook': ['CBUAE notification / licence', 'AML/CFT and CDD alignment', 'Regulatory reporting and capital', 'Outsourcing and group policies'],
  'UAE AML/CFT': ['UBO and beneficial ownership register', 'AML/CFT policies and MLRO', 'STR reporting and record-keeping', 'Sanctions screening'],
  'UAE Federal Laws': ['Commercial licence and registration', 'Labour and immigration', 'Data protection (UAE PDPL)', 'Sector-specific authorisations'],
  SDAIA: ['Data governance and classification', 'AI ethics and assurance', 'Cross-border data transfer', 'Localisation where required'],
  'ADGM FSRA Rulebook': ['ADGM registration / notification', 'AML/CFT and conduct', 'Prudential and reporting', 'Client assets and custody'],
  'ADGM Companies Regulations': ['Company registration and filings', 'Directors and shareholders', 'Annual returns'],
  'DMCC Company Regulations': ['DMCC company update', 'Licence and compliance', 'AML/CFT (DMCC)'],
  'DMCC Compliance & AML': ['AML/CFT policies', 'MLRO and reporting', 'Record-keeping'],
  'QFCRA Rules': ['QFC notification', 'AML/CFT', 'Regulatory reporting'],
  'Qatar AML Law': ['AML/CFT policies', 'UBO and CDD', 'STR and record-keeping'],
  'CBB Rulebook': ['CBB notification', 'AML and prudential', 'Reporting and governance'],
  'Oman CMA Regulations': ['CMA notification', 'Disclosure and governance'],
  'Oman AML Law': ['AML/CFT and UBO', 'Reporting'],
  'Kuwait CMA Regulations': ['CMA notification', 'Listing and disclosure'],
  'Kuwait AML Law': ['AML/CFT and UBO', 'Reporting'],
  'JAFZA Operating Regulations': ['JAFZA licence update', 'Customs and compliance'],
  'BHB Sustainability ESG': ['ESG disclosure and reporting', 'Governance alignment'],
  'Dubai 2040': ['Sustainability and urban compliance', 'Reporting as required'],
  'Saudi 2030': ['Local content and Vision 2030 alignment', 'Sector strategy compliance'],
};

const DEFAULT_COMPLIANCE_DAYS = {
  registration: 60,
  amlCft: 90,
  dataProtection: 120,
  reporting: 90,
  crossJurisdictional: 180,
  licence: 60,
  governance: 90,
};

const DEFAULT_COEFFICIENTS = {
  version: '1.0.0',
  methodologyNote:
    'Cost and time estimates are indicative; validate with legal, compliance, finance, and IT.',
  defaultComplianceDays: { ...DEFAULT_COMPLIANCE_DAYS },
  rates: {
    oneTimeLegalAed: 400000,
    oneTimeComplianceAed: 350000,
    oneTimeITAed: 500000,
    annualFtePerFteAed: 440000,
    auditBaseAed: 150000,
    auditPerFrameworkAed: 25000,
    fteMin: 2,
    fteMax: 10,
    ftePerFrameworkBonus: 1,
  },
  timeModel: {
    baseWeeks: 26,
    weeksPerFramework: 2,
    weeksPerFrameworkCap: 12,
    phaseDueDiligenceWeeks: 4,
    phaseLicenceWeeks: 8,
    phaseAmlDataWeeks: 12,
    phaseIntegrationMinWeeks: 8,
  },
  defaultComplianceDays: { ...DEFAULT_COMPLIANCE_DAYS },
};

function mergeDeep(base, patch) {
  if (!patch || typeof patch !== 'object') return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v != null && typeof v === 'object' && !Array.isArray(v) && typeof base[k] === 'object' && base[k] != null && !Array.isArray(base[k])) {
      out[k] = mergeDeep(base[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Load coefficients from disk; on failure return embedded defaults.
 */
export async function loadCoefficients() {
  try {
    const raw = await readFile(COEFFICIENTS_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    const merged = mergeDeep(DEFAULT_COEFFICIENTS, parsed);
    if (typeof merged.version !== 'string') merged.version = DEFAULT_COEFFICIENTS.version;
    if (typeof merged.methodologyNote !== 'string') merged.methodologyNote = DEFAULT_COEFFICIENTS.methodologyNote;
    return merged;
  } catch {
    return { ...DEFAULT_COEFFICIENTS, defaultComplianceDays: { ...DEFAULT_COMPLIANCE_DAYS } };
  }
}

export function resolveFrameworkListForTarget(companiesData, target) {
  const frameworksForTarget = new Set();
  if (!target || !companiesData || typeof companiesData !== 'object') {
    return [];
  }
  for (const [fw, entries] of Object.entries(companiesData)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const companies = entry.companies || [];
      const parent = entry.parent || '';
      if (parent === target || companies.includes(target)) {
        frameworksForTarget.add(fw);
      }
    }
  }
  return Array.from(frameworksForTarget);
}

export function buildGovernanceSummaryFromChanges(changesData, frameworkList) {
  const list = Array.isArray(changesData) ? changesData : [];
  return list
    .filter((c) => c.framework && frameworkList.includes(c.framework))
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, 20)
    .map((c) => ({
      framework: c.framework,
      title: c.title || '',
      date: c.date || '',
      snippet: c.snippet || c.fullText?.slice(0, 200) || '',
    }));
}

function authorityForFramework(fw) {
  if (/DFSA/i.test(fw)) return 'DFSA';
  if (fw === 'SAMA') return 'SAMA';
  if (fw === 'CMA' || /^CMA$/i.test(fw)) return 'CMA';
  if (/CBUAE/i.test(fw)) return 'CBUAE';
  if (/ADGM FSRA/i.test(fw)) return 'ADGM FSRA';
  if (/ADGM Companies/i.test(fw)) return 'ADGM RA';
  if (/QFCRA|QFC/i.test(fw)) return 'QFC Regulatory Authority';
  if (/Qatar AML/i.test(fw)) return 'Qatar FIU / relevant authority';
  if (/CBB/i.test(fw)) return 'CBB';
  if (/DMCC/i.test(fw)) return 'DMCC';
  if (/JAFZA/i.test(fw)) return 'JAFZA';
  if (/SDAIA/i.test(fw)) return 'SDAIA';
  if (/UAE AML/i.test(fw)) return 'UAE FIU / goAML';
  if (/UAE Federal/i.test(fw)) return 'UAE Federal authorities';
  if (/Oman CMA/i.test(fw)) return 'Oman CMA';
  if (/Oman AML/i.test(fw)) return 'Oman FIU';
  if (/Kuwait CMA/i.test(fw)) return 'Kuwait CMA';
  if (/Kuwait AML/i.test(fw)) return 'Kuwait FIU';
  if (/BHB/i.test(fw)) return 'Bahrain Bourse';
  return 'Sector regulator';
}

function actionTypeForFramework(fw) {
  if (fw === 'CMA' || /CMA Regulations/i.test(fw)) {
    return 'Notification / change of control';
  }
  if (/AML|AML\/CFT/i.test(fw)) return 'AML/CFT alignment and reporting';
  if (/SDAIA|Data/i.test(fw) || /PDPL/i.test(fw)) return 'Data governance / notification';
  if (/FSRA|CBUAE|SAMA|DFSA|CBB|QFCRA/i.test(fw)) return 'Licence / prudential notification';
  return 'Registration / ongoing compliance';
}

export function buildRegulatoryMatrix(frameworkList, defaultDays) {
  const days = defaultDays || DEFAULT_COMPLIANCE_DAYS;
  return frameworkList.map((fw) => {
    const z = FRAMEWORK_TO_ZONE[fw];
    const baseDays = /AML/i.test(fw) ? days.amlCft : /SDAIA|Data/i.test(fw) ? days.dataProtection : days.reporting;
    return {
      framework: fw,
      zone: z?.zone || '—',
      location: z?.location || '—',
      authority: authorityForFramework(fw),
      actionType: actionTypeForFramework(fw),
      typicalDaysPostSigning: baseDays,
      notes: FRAMEWORK_SCOPES[fw] ? String(FRAMEWORK_SCOPES[fw]).slice(0, 120) : '',
    };
  });
}

export function buildRiskRegister({ frameworkList, parentGroup, target, financialModelling, timeModel, heatMapRow }) {
  const n = frameworkList.length;
  const highJurisdictionLoad = n > 4;
  const hasAml = frameworkList.some((f) => /AML/i.test(f));
  const riskScore = heatMapRow?.riskScore != null ? Number(heatMapRow.riskScore) : null;

  const risks = [
    {
      id: 'MA-R1',
      category: 'Regulatory',
      description:
        'Change-of-control and licensing obligations may require staggered filings across multiple authorities; timing misalignment can delay close or integration.',
      severity: highJurisdictionLoad ? 'High' : 'Medium',
      mitigation: 'Maintain a regulatory notification matrix with owner, deadline, and dependency per authority.',
    },
    {
      id: 'MA-R2',
      category: 'Operational',
      description:
        'Cross-jurisdictional system and data mapping may uncover gaps in reporting feeds, residency, or outsourcing arrangements.',
      severity: 'Medium',
      mitigation: 'Complete a joint system inventory and data-flow map within the integration window.',
    },
    {
      id: 'MA-R3',
      category: 'Financial',
      description:
        `Estimated one-time integration cost (${financialModelling?.totalOneTimeAED ?? '—'} AED) and annual run-rate (${financialModelling?.totalAnnualAED ?? '—'} AED) may vary with scope creep.`,
      severity: 'Medium',
      mitigation: 'Lock scope with legal, compliance, and IT; track variance against the modelled breakdown.',
    },
    {
      id: 'MA-R4',
      category: 'Timeline',
      description: `Indicative integration horizon is ${timeModel?.totalWeeks ?? '—'} weeks; slippage in licence or AML workstreams extends go-live.`,
      severity: (timeModel?.totalWeeks ?? 0) > 40 ? 'High' : 'Medium',
      mitigation: 'Phase gates with executive checkpoints after due diligence and licence submission.',
    },
  ];

  if (hasAml) {
    risks.push({
      id: 'MA-R5',
      category: 'AML/CFT',
      description: 'AML/CFT programme alignment, MLRO coverage, and sanctions screening integration are common findings in multi-entity mergers.',
      severity: 'High',
      mitigation: 'Harmonise group AML policy, CDD standards, and TM rules before cutover.',
    });
  }

  if (riskScore != null && riskScore >= 60) {
    risks.push({
      id: 'MA-R6',
      category: 'Portfolio',
      description: `Target OpCo risk score from heat map is elevated (${riskScore}/100), indicating existing compliance pressure.`,
      severity: 'High',
      mitigation: 'Prioritise overdue and near-term regulatory items before signing; allocate remediation capacity.',
    });
  }

  risks.push({
    id: 'MA-R7',
    category: 'Reputational',
    description: 'Enforcement or public disclosure of control issues during integration can affect stakeholders and counterparties.',
    severity: 'Medium',
    mitigation: 'Board-level oversight and transparent issue tracking through integration.',
  });

  return risks;
}

export function buildValueBridge(financialModelling, synergyAnnualAed) {
  const oneTime = financialModelling?.totalOneTimeAED ?? 0;
  const annual = financialModelling?.totalAnnualAED ?? 0;
  const synergy = Number.isFinite(Number(synergyAnnualAed)) ? Math.max(0, Number(synergyAnnualAed)) : 0;
  const netYear1 = synergy - annual;
  return {
    synergyAnnualAed: synergy,
    integrationOneTimeAed: oneTime,
    integrationAnnualRunRateAed: annual,
    netAnnualAfterSynergyBand:
      netYear1 >= 0
        ? `Net annual benefit after modelled run-rate: +${netYear1.toLocaleString()} AED (illustrative)`
        : `Net annual gap vs synergies: ${netYear1.toLocaleString()} AED (illustrative; validate synergies)`,
    assumptions: [
      'Synergy inputs are user-provided or zero if omitted.',
      'Integration costs reflect coefficient-driven estimates, not deal-specific quotes.',
    ],
  };
}

export function buildExecutiveSummary({
  parentGroup,
  target,
  frameworkList,
  financialModelling,
  timeModel,
  dealStructure,
}) {
  const fs = dealStructure && String(dealStructure).trim() ? String(dealStructure).trim() : 'Not specified';
  const bullets = [
    `Deal: Parent "${parentGroup}" and target "${target}" (${fs}).`,
    `${frameworkList.length} applicable governance framework(s) identified from entity mapping.`,
    financialModelling
      ? `Modelled one-time cost ${financialModelling.totalOneTimeAED.toLocaleString()} AED; annual run-rate ${financialModelling.totalAnnualAED.toLocaleString()} AED.`
      : 'Financial modelling not run (missing selection).',
    timeModel
      ? `Indicative integration timeline: ${timeModel.totalWeeks} weeks across phased workstreams.`
      : 'Timeline not estimated.',
  ];
  return {
    headline: `M&A compliance and integration readiness for ${target || 'target'} under ${parentGroup || 'parent'}`,
    bullets,
    confidence: 'medium',
  };
}

export function buildLineage({ coefficientVersion, companiesPathLabel, changesPathLabel }) {
  return [
    { field: 'frameworkList', source: 'companies.json entity-to-framework mapping' },
    { field: 'governanceFrameworkSummary', source: 'changes.json filtered by framework' },
    { field: 'financialModelling', source: `coefficients v${coefficientVersion || '1.0.0'} (rates)` },
    { field: 'riskRegister', source: 'heuristic rules from frameworks + optional heat map' },
    { field: 'valueBridge.synergyAnnualAed', source: 'user input (optional)' },
    { field: 'companiesData', source: companiesPathLabel || 'companies.json' },
    { field: 'changesData', source: changesPathLabel || 'changes.json' },
  ];
}

/**
 * Build tabular CSV for assessment export (UTF-8).
 */
export function assessmentToCsv(assessment) {
  const lines = [];
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  lines.push(['section', 'key', 'value'].map(esc).join(','));
  const row = (section, key, value) => lines.push([section, key, value].map(esc).join(','));

  row('meta', 'schemaVersion', assessment.schemaVersion);
  row('meta', 'coefficientVersion', assessment.coefficientVersion);
  row('meta', 'parentGroup', assessment.parentGroup);
  row('meta', 'target', assessment.target);

  if (Array.isArray(assessment.frameworkList)) {
    assessment.frameworkList.forEach((fw, i) => row('framework', `fw_${i}`, fw));
  }
  if (assessment.financialModelling?.breakdown) {
    for (const b of assessment.financialModelling.breakdown) {
      row('financial', b.item, String(b.amountAED));
    }
  }
  if (Array.isArray(assessment.riskRegister)) {
    assessment.riskRegister.forEach((r) => row('risk', r.id, `${r.severity}: ${r.description}`));
  }
  if (Array.isArray(assessment.regulatoryMatrix)) {
    assessment.regulatoryMatrix.forEach((m) =>
      row('regulatory', m.framework, `${m.authority}; ${m.actionType}; ${m.typicalDaysPostSigning}d`),
    );
  }
  return lines.join('\n');
}

/**
 * Full assessment for Parent Group + Target using in-memory companies and changes payloads.
 */
export async function runMaAssessment({
  parentGroup,
  target,
  companiesData,
  changesData,
  options = {},
}) {
  const coeff = await loadCoefficients();
  const rates = coeff.rates || DEFAULT_COEFFICIENTS.rates;
  const tm = coeff.timeModel || DEFAULT_COEFFICIENTS.timeModel;
  const defaultDays = { ...DEFAULT_COMPLIANCE_DAYS, ...(coeff.defaultComplianceDays || {}) };

  const frameworkList = resolveFrameworkListForTarget(companiesData, target);
  const governanceFrameworkSummary = buildGovernanceSummaryFromChanges(changesData, frameworkList);

  const multiJurisdictionMatrix = frameworkList.map((fw) => {
    const z = FRAMEWORK_TO_ZONE[fw];
    return { framework: fw, zone: z?.zone || '—', location: z?.location || '—' };
  });

  const complianceDetail = {
    frameworks:
      frameworkList.length > 0
        ? frameworkList.map((name) => ({
            name,
            scope: FRAMEWORK_SCOPES[name] || 'Sector-specific regulation',
            description: FRAMEWORK_SCOPES[name] || 'Sector-specific regulation',
          }))
        : [
            { name: 'UAE Federal Laws', scope: 'UAE federal commercial, labour', description: 'Default for UAE entities' },
            { name: 'CBUAE Rulebook', scope: 'If financial', description: 'Banking and financial' },
            { name: 'SAMA', scope: 'If KSA financial', description: 'KSA banking' },
            { name: 'DFSA Rulebook', scope: 'If DIFC', description: 'DIFC financial' },
          ],
    obligations: [
      'Pre-incorporation: company registration, licensing, and any sector-specific authorisations in the target jurisdiction(s).',
      'AML/CFT: beneficial ownership, CDD, record-keeping, and reporting as per applicable framework(s).',
      'Data protection: UAE PDPL / KSA PDPL alignment for personal data; cross-border transfer mechanisms where relevant.',
      'Ongoing reporting and governance: capital adequacy, conduct of business, and disclosure as per regulator.',
      "Cross-jurisdictional: where target operates in multiple jurisdictions, ensure each jurisdiction's requirements are mapped and met.",
    ],
    gaps: [
      { control: 'Licence and registration', description: "Confirm target's current licences and any new filings required post-acquisition", remediation: 'Legal and compliance review' },
      { control: 'AML/CFT and sanctions', description: 'Integrate target into group AML/sanctions policies and systems', remediation: 'Within 90 days of close' },
      { control: 'Data and IT systems', description: 'Map data flows and systems across jurisdictions; align to group standards', remediation: 'System mapping and integration plan' },
    ],
  };

  const fteEstimate = Math.min(
    rates.fteMax ?? 10,
    Math.max(rates.fteMin ?? 2, frameworkList.length + (rates.ftePerFrameworkBonus ?? 1)),
  );
  const oneTimeLegal = rates.oneTimeLegalAed ?? DEFAULT_COEFFICIENTS.rates.oneTimeLegalAed;
  const oneTimeCompliance = rates.oneTimeComplianceAed ?? DEFAULT_COEFFICIENTS.rates.oneTimeComplianceAed;
  const oneTimeIT = rates.oneTimeITAed ?? DEFAULT_COEFFICIENTS.rates.oneTimeITAed;
  const annualFtePerFte = rates.annualFtePerFteAed ?? DEFAULT_COEFFICIENTS.rates.annualFtePerFteAed;
  const annualFte = fteEstimate * annualFtePerFte;
  const auditBase = rates.auditBaseAed ?? DEFAULT_COEFFICIENTS.rates.auditBaseAed;
  const auditPerFw = rates.auditPerFrameworkAed ?? DEFAULT_COEFFICIENTS.rates.auditPerFrameworkAed;
  const annualAuditFees = auditBase + frameworkList.length * auditPerFw;

  const financialCommercial = {
    manpowerFte: `${fteEstimate} FTE (est. for compliance integration)`,
    manpowerCost: `${(fteEstimate * annualFtePerFte).toLocaleString()} AED/year (blended rate)`,
    crossJurisdictionalMapping: `Target "${target}" under Parent Group "${parentGroup}" may span ${frameworkList.length || 2} jurisdiction(s). Map systems for: (1) Regulatory reporting per framework, (2) Data residency and localisation, (3) Shared services and outsourcing limits, (4) Licence and capital requirements per entity. Recommend a cross-jurisdictional system inventory and integration roadmap within 60 days of signing.`,
    additionalCosts: 'Estimated one-time integration: AED 550,000–1,500,000 (legal, compliance, and IT alignment). Annual ongoing: FTE above plus audit and regulatory fees (AED).',
  };

  const jurisdictionGroups = {};
  for (const fw of frameworkList) {
    const z = FRAMEWORK_TO_ZONE[fw];
    const jurisdiction = z?.zone || 'Other';
    if (!jurisdictionGroups[jurisdiction]) jurisdictionGroups[jurisdiction] = [];
    jurisdictionGroups[jurisdiction].push({ framework: fw, location: z?.location || '—' });
  }
  const applicableFrameworksByJurisdiction = Object.entries(jurisdictionGroups).map(([jurisdiction, list]) => ({
    jurisdiction,
    location: list[0]?.location || '—',
    frameworks: list.map((x) => x.framework),
  }));

  const keyProcessesByFramework = frameworkList.map((fw) => ({
    framework: fw,
    processes: KEY_PROCESSES_BY_FRAMEWORK[fw] || [
      'Licence/registration update',
      'AML/CFT and beneficial ownership',
      'Regulatory reporting alignment',
      'Data protection and governance',
    ],
  }));

  let complianceTimelines = [
    { compliance: 'Company registration / licence update', framework: 'All', daysPostSigning: defaultDays.registration },
    { compliance: 'AML/CFT and UBO integration', framework: 'AML/CFT frameworks', daysPostSigning: defaultDays.amlCft },
    { compliance: 'Data protection and PDPL alignment', framework: 'Data governance', daysPostSigning: defaultDays.dataProtection },
    { compliance: 'Regulatory reporting (first submissions)', framework: 'Sector regulators', daysPostSigning: defaultDays.reporting },
    { compliance: 'Cross-jurisdictional system mapping', framework: 'Group compliance', daysPostSigning: defaultDays.crossJurisdictional },
    { compliance: 'Governance and board alignment', framework: 'Governance frameworks', daysPostSigning: defaultDays.governance },
  ];
  frameworkList.forEach((fw) => {
    const processes = KEY_PROCESSES_BY_FRAMEWORK[fw];
    if (processes && processes.length) {
      const days = fw.includes('AML') ? defaultDays.amlCft : fw.includes('Data') || fw.includes('SDAIA') ? defaultDays.dataProtection : defaultDays.reporting;
      processes.slice(0, 2).forEach((p, i) => {
        complianceTimelines.push({ compliance: p, framework: fw, daysPostSigning: days + i * 30 });
      });
    }
  });

  const systemIntegrations = [
    { system: 'Core banking / finance', description: 'General ledger, regulatory reporting feeds', priority: 'High' },
    { system: 'AML/CFT and sanctions screening', description: 'CDD, transaction monitoring, sanctions lists', priority: 'High' },
    { system: 'HR and payroll', description: 'Employee data, payroll for group reporting', priority: 'Medium' },
    { system: 'Data warehouse and BI', description: 'Group reporting and dashboards', priority: 'Medium' },
    { system: 'Document and records management', description: 'Compliance records, retention', priority: 'Medium' },
    { system: 'Identity and access (IAM)', description: 'Single sign-on, role-based access', priority: 'High' },
  ];

  const extraWeeks = Math.min(
    tm.weeksPerFrameworkCap ?? 12,
    frameworkList.length * (tm.weeksPerFramework ?? 2),
  );
  const totalWeeks = (tm.baseWeeks ?? 26) + extraWeeks;
  const phaseIntegrationWeeks = Math.max(tm.phaseIntegrationMinWeeks ?? 8, totalWeeks - (tm.phaseDueDiligenceWeeks ?? 4) - (tm.phaseLicenceWeeks ?? 8) - (tm.phaseAmlDataWeeks ?? 12));

  const timeModel = {
    totalWeeks,
    totalMonths: Math.round((totalWeeks / 4) * 10) / 10,
    phases: [
      { name: 'Due diligence and planning', weeks: tm.phaseDueDiligenceWeeks ?? 4 },
      { name: 'Licence and registration', weeks: tm.phaseLicenceWeeks ?? 8 },
      { name: 'AML/CFT and data protection', weeks: tm.phaseAmlDataWeeks ?? 12 },
      { name: 'System integration and go-live', weeks: phaseIntegrationWeeks },
    ],
  };

  const financialModelling = {
    totalOneTimeAED: oneTimeLegal + oneTimeCompliance + oneTimeIT,
    totalAnnualAED: annualFte + annualAuditFees,
    breakdown: [
      { item: 'Legal and regulatory (one-time)', amountAED: oneTimeLegal, type: 'one-time' },
      { item: 'Compliance and policy (one-time)', amountAED: oneTimeCompliance, type: 'one-time' },
      { item: 'IT and system integration (one-time)', amountAED: oneTimeIT, type: 'one-time' },
      { item: 'Compliance FTE (annual)', amountAED: annualFte, type: 'annual' },
      { item: 'Audit and regulatory fees (annual)', amountAED: annualAuditFees, type: 'annual' },
    ],
  };

  let extractedSummary = `Assessment for Parent Group "${parentGroup}" and Target "${target}". ${frameworkList.length || 4} framework(s) identified. Compliance detail and financial/commercial aspects below.`;

  const synergyAnnualAed = options.synergyAnnualAed;
  const dealStructure = options.dealStructure;

  const riskRegister = buildRiskRegister({
    frameworkList,
    parentGroup,
    target,
    financialModelling,
    timeModel,
    heatMapRow: options.heatMapRow,
  });

  const regulatoryMatrix = buildRegulatoryMatrix(frameworkList, defaultDays);

  const valueBridge = buildValueBridge(financialModelling, synergyAnnualAed);

  const executiveSummary = buildExecutiveSummary({
    parentGroup,
    target,
    frameworkList,
    financialModelling,
    timeModel,
    dealStructure,
  });

  const methodologyNote = coeff.methodologyNote || DEFAULT_COEFFICIENTS.methodologyNote;
  const coefficientVersion = coeff.version || '1.0.0';

  const lineage = buildLineage({
    coefficientVersion,
    companiesPathLabel: options.companiesPathLabel,
    changesPathLabel: options.changesPathLabel,
  });

  const base = {
    parentGroup,
    target,
    frameworkList,
    governanceFrameworkSummary,
    multiJurisdictionMatrix,
    complianceDetail,
    financialCommercial,
    applicableFrameworksByJurisdiction,
    keyProcessesByFramework,
    complianceTimelines,
    systemIntegrations,
    timeModel,
    financialModelling,
    extractedSummary,
    schemaVersion: MA_SCHEMA_VERSION,
    coefficientVersion,
    methodologyNote,
    riskRegister,
    regulatoryMatrix,
    valueBridge,
    executiveSummary,
    lineage,
    dealStructure: dealStructure || null,
    regulatedTarget: options.regulatedTarget === true,
  };

  base.csvExport = assessmentToCsv(base);

  return base;
}
