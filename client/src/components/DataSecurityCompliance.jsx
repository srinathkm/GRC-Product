import { useState, useMemo, useEffect } from 'react';
import './DataSecurityCompliance.css';
import { DefenderUpload } from './defender/DefenderUpload.jsx';
import { SecurityPostureDashboard } from './defender/SecurityPostureDashboard.jsx';
import './defender/defender.css';

const API = '/api';

/** Per-OpCo Azure Defender–style outcomes: Security Posture, Regulatory Compliance, Data and AI Security. */
const PILLARS = [
  { id: 'securityPosture', label: 'Security Posture', description: 'Azure Defender security posture and hardening' },
  { id: 'regulatoryCompliance', label: 'Regulatory Compliance', description: 'Regulatory compliance posture from Azure Defender' },
  { id: 'dataAndAISecurity', label: 'Data and AI Security', description: 'Data protection and AI security controls' },
];

/**
 * Regulatory Compliance frameworks (e.g. NIST CSF 2.0, PCI DSS) used for failure mapping.
 * Data security regulatory compliance = the data-security theme the control maps to.
 *
 * Failure chain: Failed resource → Regulatory Compliance (framework + control) → Data security regulatory compliance
 */
const REGULATORY_FRAMEWORKS = {
  'NIST CSF 2.0': { label: 'NIST CSF 2.0', description: 'NIST Cybersecurity Framework 2.0' },
  'PCI DSS': { label: 'PCI DSS', description: 'Payment Card Industry Data Security Standard' },
  'ISO 27001': { label: 'ISO 27001', description: 'Information security management' },
  'SOC 2': { label: 'SOC 2', description: 'Service Organization Control 2' },
  'FedRAMP': { label: 'FedRAMP', description: 'Federal Risk and Authorization Management Program' },
  'CIS': { label: 'CIS Controls', description: 'Center for Internet Security Controls' },
};

/** Jurisdictional cybersecurity frameworks for control coverage mapping. */
const CYBER_FRAMEWORKS = [
  { id: 'SAMA CSF', label: 'SAMA CSF', jurisdiction: 'KSA', description: 'SAMA Cybersecurity Framework' },
  { id: 'CBUAE Cyber', label: 'CBUAE Cyber', jurisdiction: 'UAE', description: 'CBUAE Cybersecurity and resilience' },
  { id: 'NESA', label: 'NESA', jurisdiction: 'UAE', description: 'UAE National Electronic Security Authority standards' },
  { id: 'SDAIA', label: 'SDAIA', jurisdiction: 'KSA', description: 'SDAIA / NDMO data and AI security' },
  { id: 'QCERT', label: 'QCERT', jurisdiction: 'Qatar', description: 'Qatar CERT cybersecurity framework' },
];

/** Per-OpCo, per-framework: control coverage % and gaps with remediation deadlines. */
const OPCO_FRAMEWORK_COVERAGE_MOCK = {
  'Emirates NBD Capital': {
    'CBUAE Cyber': { coveragePct: 78, gaps: [{ controlId: 'CB-2', controlName: 'Incident reporting', description: '24-hour incident notification process not documented', remediationDeadline: '2025-06-30' }, { controlId: 'CB-5', controlName: 'Encryption at rest', description: 'Key management policy gap', remediationDeadline: '2025-05-15' }] },
    'NESA': { coveragePct: 82, gaps: [{ controlId: 'NESA-3.2', controlName: 'Access control', description: 'Privileged access review quarterly', remediationDeadline: '2025-04-30' }] },
  },
  'Dubai Islamic Bank (DIFC)': {
    'CBUAE Cyber': { coveragePct: 72, gaps: [{ controlId: 'CB-1', controlName: 'Governance', description: 'Board-level cyber risk reporting', remediationDeadline: '2025-05-31' }, { controlId: 'CB-4', controlName: 'Third-party risk', description: 'Vendor assessment records incomplete', remediationDeadline: '2025-07-15' }] },
    'NESA': { coveragePct: 75, gaps: [{ controlId: 'NESA-2.1', controlName: 'Asset inventory', description: 'Critical asset register update', remediationDeadline: '2025-05-20' }] },
  },
  'Saudi National Bank (SNB)': {
    'SAMA CSF': { coveragePct: 88, gaps: [{ controlId: 'SAMA-CSF-4', controlName: 'Response and recovery', description: 'DR test documentation', remediationDeadline: '2025-06-01' }] },
    'SDAIA': { coveragePct: 85, gaps: [{ controlId: 'SDAIA-DG-2', controlName: 'Data classification', description: 'Cross-border transfer log', remediationDeadline: '2025-05-30' }] },
  },
  'Riyad Bank': {
    'SAMA CSF': { coveragePct: 80, gaps: [{ controlId: 'SAMA-CSF-2', controlName: 'Protect', description: 'Patch management evidence', remediationDeadline: '2025-05-15' }, { controlId: 'SAMA-CSF-5', controlName: 'Recover', description: 'BCP update', remediationDeadline: '2025-06-30' }] },
  },
  'STC Pay': {
    'SAMA CSF': { coveragePct: 90, gaps: [] },
    'SDAIA': { coveragePct: 88, gaps: [{ controlId: 'SDAIA-DG-1', controlName: 'Data governance', description: 'Policy review cycle', remediationDeadline: '2025-07-01' }] },
  },
  'Shuaa Capital': {
    'CBUAE Cyber': { coveragePct: 70, gaps: [{ controlId: 'CB-3', controlName: 'Security testing', description: 'Penetration test overdue', remediationDeadline: '2025-04-15' }] },
    'NESA': { coveragePct: 74, gaps: [{ controlId: 'NESA-4.1', controlName: 'Monitoring', description: 'SIEM coverage gap', remediationDeadline: '2025-05-31' }] },
  },
  'JP Morgan (DIFC)': {
    'CBUAE Cyber': { coveragePct: 92, gaps: [] },
    'NESA': { coveragePct: 90, gaps: [] },
  },
  'Emirates NBD': {
    'CBUAE Cyber': { coveragePct: 85, gaps: [{ controlId: 'CB-5', controlName: 'Encryption', description: 'Key rotation evidence', remediationDeadline: '2025-05-30' }] },
    'NESA': { coveragePct: 86, gaps: [] },
  },
};

/** Which frameworks apply to which OpCo (by jurisdiction). Default: UAE = CBUAE + NESA, KSA = SAMA + SDAIA, Qatar = QCERT. */
function getFrameworksForOpco(opcoName) {
  const ksa = ['Saudi National Bank (SNB)', 'Al Rajhi Bank', 'Riyad Bank', 'STC Pay', 'Saudi Aramco', 'SABIC', 'Ma\'aden', 'Mada', 'Saudi Payments', 'NEOM', 'Red Sea Global', 'ROSHN'];
  const qatar = [];
  if (ksa.some((n) => opcoName === n || (opcoName && opcoName.includes(n)))) return ['SAMA CSF', 'SDAIA'];
  if (qatar.some((n) => opcoName === n)) return ['QCERT'];
  return ['CBUAE Cyber', 'NESA'];
}

/** Data security regulatory compliance categories – what the failing control ties to. */
const DATA_SECURITY_COMPLIANCE_CATEGORIES = {
  'Data at rest encryption': 'Data at rest encryption',
  'Data in transit protection': 'Data in transit protection',
  'Data classification and handling': 'Data classification and handling',
  'Access control and identity': 'Access control and identity',
  'Asset management and inventory': 'Asset management and inventory',
  'Incident response and logging': 'Incident response and logging',
  'Vulnerability and patch management': 'Vulnerability and patch management',
  'Secure configuration': 'Secure configuration',
};

/**
 * Failing control: failed resource → regulatory framework + control → data security compliance.
 * resource: the failed resource (e.g. storage, workload).
 * framework: e.g. NIST CSF 2.0, PCI DSS.
 * controlId: e.g. PR.DS-1, Req 3.4.
 * controlName: short name for the control.
 * dataSecurityCompliance: key from DATA_SECURITY_COMPLIANCE_CATEGORIES.
 * details: optional finding description.
 */
const OPCO_SECURITY_MOCK = {
  'Emirates NBD Capital': {
    securityPosture: { score: 82, status: 'pass', details: 'No critical recommendations.' },
    regulatoryCompliance: {
      score: 68,
      status: 'fail',
      details: 'NIST CSF 2.0 and PCI DSS controls: 3 findings.',
      failingControls: [
        { resource: 'Storage account (cardholder data)', framework: 'PCI DSS', controlId: 'Req 3.4', controlName: 'Render PAN unreadable', dataSecurityCompliance: 'Data at rest encryption', details: 'Cardholder data at rest not encrypted with strong cryptography on payment DB.' },
        { resource: 'Key Vault / secrets', framework: 'NIST CSF 2.0', controlId: 'PR.AC-4', controlName: 'Access permissions managed', dataSecurityCompliance: 'Access control and identity', details: 'Privileged access to key material not fully restricted and logged.' },
        { resource: 'Log Analytics workspace', framework: 'NIST CSF 2.0', controlId: 'DE.CM-1', controlName: 'Network monitored', dataSecurityCompliance: 'Incident response and logging', details: 'Log retention and monitoring scope gaps for STR timeline compliance.' },
      ],
    },
    dataAndAISecurity: { score: 75, status: 'fail', details: 'Data classification and retention policies need update.' },
    severity: 'High',
  },
  'Emirates Investment Bank': {
    securityPosture: { score: 91, status: 'pass', details: 'Within policy.' },
    regulatoryCompliance: { score: 88, status: 'pass', details: 'Aligned with NIST CSF 2.0 and PCI DSS.' },
    dataAndAISecurity: { score: 84, status: 'pass', details: 'Data and AI controls in place.' },
    severity: null,
  },
  'Mashreq Capital': {
    securityPosture: { score: 78, status: 'fail', details: '2 critical security recommendations (endpoint, network).' },
    regulatoryCompliance: { score: 85, status: 'pass', details: 'Compliant.' },
    dataAndAISecurity: { score: 80, status: 'pass', details: 'No issues.' },
    severity: 'Critical',
  },
  'Dubai Islamic Bank (DIFC)': {
    securityPosture: { score: 72, status: 'fail', details: 'Security baseline drift; review required.' },
    regulatoryCompliance: {
      score: 65,
      status: 'fail',
      details: 'NIST CSF 2.0, PCI DSS and ISO 27001: 4 findings.',
      failingControls: [
        { resource: 'SQL DB (client money records)', framework: 'PCI DSS', controlId: 'Req 8.2', controlName: 'Strong authentication', dataSecurityCompliance: 'Access control and identity', details: 'MFA not enforced for all admin access to client assets database.' },
        { resource: 'Blob storage (client documents)', framework: 'NIST CSF 2.0', controlId: 'PR.DS-1', controlName: 'Data at rest protected', dataSecurityCompliance: 'Data at rest encryption', details: 'Client Assets and Client Money documents – encryption key rotation not documented.' },
        { resource: 'Azure AD / IAM', framework: 'ISO 27001', controlId: 'A.9.4.1', controlName: 'Information access restriction', dataSecurityCompliance: 'Access control and identity', details: 'Beneficial ownership and CDD access not restricted by role.' },
        { resource: 'Automation / runbooks', framework: 'NIST CSF 2.0', controlId: 'GV.OC-2', controlName: 'Cybersecurity roles', dataSecurityCompliance: 'Asset management and inventory', details: 'AML/CFT control ownership and runbook approval not assigned.' },
      ],
    },
    dataAndAISecurity: { score: 70, status: 'fail', details: 'Data residency and encryption gaps.' },
    severity: 'Critical',
  },
  'Saudi National Bank (SNB)': {
    securityPosture: { score: 88, status: 'pass', details: 'Within policy.' },
    regulatoryCompliance: { score: 82, status: 'pass', details: 'SAMA and SDAIA aligned.' },
    dataAndAISecurity: { score: 86, status: 'pass', details: 'Data and AI controls in place.' },
    severity: null,
  },
  'Al Rajhi Bank': {
    securityPosture: { score: 85, status: 'pass', details: 'No critical items.' },
    regulatoryCompliance: { score: 90, status: 'pass', details: 'Compliant.' },
    dataAndAISecurity: { score: 88, status: 'pass', details: 'Compliant.' },
    severity: null,
  },
  'Riyad Bank': {
    securityPosture: { score: 74, status: 'fail', details: '1 critical and 2 high recommendations.' },
    regulatoryCompliance: {
      score: 71,
      status: 'fail',
      details: 'NIST CSF 2.0 and SOC 2: 2 findings.',
      failingControls: [
        { resource: 'SIEM / incident pipeline', framework: 'NIST CSF 2.0', controlId: 'RS.CO-2', controlName: 'Incident coordination', dataSecurityCompliance: 'Incident response and logging', details: 'Incident notification within 4 hours not documented or automated.' },
        { resource: 'API gateway (open banking)', framework: 'SOC 2', controlId: 'CC6.1', controlName: 'Logical access – authentication', dataSecurityCompliance: 'Data in transit protection', details: 'Open Banking certification against v2.1 – strong customer authentication gaps.' },
      ],
    },
    dataAndAISecurity: { score: 78, status: 'pass', details: 'Minor improvements recommended.' },
    severity: 'High',
  },
  'STC Pay': {
    securityPosture: { score: 92, status: 'pass', details: 'Strong posture.' },
    regulatoryCompliance: { score: 87, status: 'pass', details: 'SAMA and SDAIA compliant.' },
    dataAndAISecurity: { score: 89, status: 'pass', details: 'Compliant.' },
    severity: null,
  },
  'Saudi Aramco': {
    securityPosture: { score: 88, status: 'pass', details: 'Within policy.' },
    regulatoryCompliance: { score: 84, status: 'pass', details: 'SDAIA and sector rules aligned.' },
    dataAndAISecurity: { score: 82, status: 'pass', details: 'Data controls in place.' },
    severity: null,
  },
  'JP Morgan (DIFC)': {
    securityPosture: { score: 94, status: 'pass', details: 'No issues.' },
    regulatoryCompliance: { score: 91, status: 'pass', details: 'DFSA compliant.' },
    dataAndAISecurity: { score: 93, status: 'pass', details: 'Compliant.' },
    severity: null,
  },
  'Shuaa Capital': {
    securityPosture: { score: 70, status: 'fail', details: 'Security recommendations outstanding.' },
    regulatoryCompliance: {
      score: 72,
      status: 'fail',
      details: 'NIST CSF 2.0 and CIS: 2 findings.',
      failingControls: [
        { resource: 'CRM / client records', framework: 'NIST CSF 2.0', controlId: 'ID.AM-5', controlName: 'Asset inventory', dataSecurityCompliance: 'Asset management and inventory', details: 'Client classification and suitability – asset inventory for personal data incomplete.' },
        { resource: 'Backup and archive storage', framework: 'CIS', controlId: 'CIS 3.4', controlName: 'Data protection', dataSecurityCompliance: 'Data classification and handling', details: 'Retention periods and classification not aligned with PDPL.' },
      ],
    },
    dataAndAISecurity: { score: 76, status: 'pass', details: 'Acceptable.' },
    severity: 'High',
  },
  'Arqaam Capital': {
    securityPosture: { score: 79, status: 'pass', details: 'Within threshold.' },
    regulatoryCompliance: { score: 77, status: 'pass', details: 'Within threshold.' },
    dataAndAISecurity: { score: 81, status: 'pass', details: 'No issues.' },
    severity: null,
  },
  'Goldman Sachs (DIFC)': {
    securityPosture: { score: 96, status: 'pass', details: 'Strong.' },
    regulatoryCompliance: { score: 94, status: 'pass', details: 'Compliant.' },
    dataAndAISecurity: { score: 95, status: 'pass', details: 'Compliant.' },
    severity: null,
  },
  'Deutsche Bank (DIFC)': {
    securityPosture: { score: 86, status: 'pass', details: 'No critical items.' },
    regulatoryCompliance: { score: 83, status: 'pass', details: 'DFSA aligned.' },
    dataAndAISecurity: { score: 85, status: 'pass', details: 'Compliant.' },
    severity: null,
  },
  'Standard Chartered (DIFC)': {
    securityPosture: { score: 69, status: 'fail', details: '3 high-severity recommendations.' },
    regulatoryCompliance: { score: 75, status: 'pass', details: 'Within threshold.' },
    dataAndAISecurity: { score: 73, status: 'fail', details: 'Data classification gaps.' },
    severity: 'High',
  },
  'Barclays (DIFC)': {
    securityPosture: { score: 84, status: 'pass', details: 'Acceptable.' },
    regulatoryCompliance: { score: 80, status: 'pass', details: 'DFSA aligned.' },
    dataAndAISecurity: { score: 82, status: 'pass', details: 'Compliant.' },
    severity: null,
  },
  'Dubai Holding': {
    securityPosture: { score: 76, status: 'fail', details: 'Cloud security posture improvements needed.' },
    regulatoryCompliance: { score: 80, status: 'pass', details: 'UAE PDPL aligned.' },
    dataAndAISecurity: { score: 78, status: 'pass', details: 'Minor gaps.' },
    severity: 'Medium',
  },
  'DP World': {
    securityPosture: { score: 87, status: 'pass', details: 'Within policy.' },
    regulatoryCompliance: { score: 85, status: 'pass', details: 'Compliant.' },
    dataAndAISecurity: { score: 86, status: 'pass', details: 'Compliant.' },
    severity: null,
  },
  'Emaar Properties': {
    securityPosture: { score: 81, status: 'pass', details: 'No critical items.' },
    regulatoryCompliance: { score: 79, status: 'pass', details: 'Within threshold.' },
    dataAndAISecurity: { score: 83, status: 'pass', details: 'Compliant.' },
    severity: null,
  },
  'NEOM': {
    securityPosture: { score: 85, status: 'pass', details: 'Strong.' },
    regulatoryCompliance: { score: 82, status: 'pass', details: 'SDAIA aligned.' },
    dataAndAISecurity: { score: 88, status: 'pass', details: 'Compliant.' },
    severity: null,
  },
  'Red Sea Global': {
    securityPosture: { score: 80, status: 'pass', details: 'Acceptable.' },
    regulatoryCompliance: { score: 78, status: 'pass', details: 'Within threshold.' },
    dataAndAISecurity: { score: 81, status: 'pass', details: 'Compliant.' },
    severity: null,
  },
  'ROSHN': {
    securityPosture: { score: 83, status: 'pass', details: 'No issues.' },
    regulatoryCompliance: { score: 81, status: 'pass', details: 'Compliant.' },
    dataAndAISecurity: { score: 84, status: 'pass', details: 'Compliant.' },
    severity: null,
  },
  'SABIC': {
    securityPosture: { score: 86, status: 'pass', details: 'Within policy.' },
    regulatoryCompliance: { score: 84, status: 'pass', details: 'SDAIA and CMA aligned.' },
    dataAndAISecurity: { score: 87, status: 'pass', details: 'Compliant.' },
    severity: null,
  },
  'Ma\'aden': {
    securityPosture: { score: 72, status: 'fail', details: 'Security baseline and patch recommendations.' },
    regulatoryCompliance: {
      score: 74,
      status: 'fail',
      details: 'ISO 27001 and NIST CSF 2.0: 2 findings.',
      failingControls: [
        { resource: 'Data warehouse (ESG / sustainability)', framework: 'ISO 27001', controlId: 'A.12.4.1', controlName: 'Event logging', dataSecurityCompliance: 'Incident response and logging', details: 'ESG and governance metrics – audit trail and logging not complete for disclosure.' },
        { resource: 'Data share / cross-border pipeline', framework: 'NIST CSF 2.0', controlId: 'GV.SC-2', controlName: 'Supply chain risk', dataSecurityCompliance: 'Data classification and handling', details: 'Cross-border transfer and data governance documentation incomplete.' },
      ],
    },
    dataAndAISecurity: { score: 76, status: 'pass', details: 'Acceptable.' },
    severity: 'High',
  },
  'Mada': {
    securityPosture: { score: 90, status: 'pass', details: 'Strong.' },
    regulatoryCompliance: { score: 88, status: 'pass', details: 'SAMA compliant.' },
    dataAndAISecurity: { score: 91, status: 'pass', details: 'Compliant.' },
    severity: null,
  },
  'Saudi Payments': {
    securityPosture: { score: 89, status: 'pass', details: 'Within policy.' },
    regulatoryCompliance: { score: 86, status: 'pass', details: 'SAMA aligned.' },
    dataAndAISecurity: { score: 88, status: 'pass', details: 'Compliant.' },
    severity: null,
  },
};

const PASS_THRESHOLD = 80;

/** Build Data Security Compliance summary string for M&A assessment PDF. */
export function getDataSecuritySummaryForMa(opcoName) {
  const frameworks = getFrameworksForOpco(opcoName);
  const raw = getOpcoSecurity(opcoName);
  const parts = [];
  parts.push(`Applicable frameworks: ${(frameworks || []).join(', ')}.`);
  parts.push(`Security posture: ${raw.securityPosture?.score ?? '—'} (${raw.securityPosture?.status || '—'}). ${raw.securityPosture?.details || ''}`);
  parts.push(`Regulatory compliance: ${raw.regulatoryCompliance?.score ?? '—'} (${raw.regulatoryCompliance?.status || '—'}). ${raw.regulatoryCompliance?.details || ''}`);
  parts.push(`Data and AI security: ${raw.dataAndAISecurity?.score ?? '—'} (${raw.dataAndAISecurity?.status || '—'}). ${raw.dataAndAISecurity?.details || ''}`);
  if (raw.severity) parts.push(`Overall severity: ${raw.severity}.`);
  const controls = raw.regulatoryCompliance?.failingControls || [];
  if (controls.length > 0) {
    parts.push(`Failing controls: ${controls.map((c) => `${c.controlName} (${c.framework}): ${c.details || ''}`).join('; ').slice(0, 400)}.`);
  }
  return parts.join(' ');
}

function getOpcoSecurity(opcoName) {
  const raw = OPCO_SECURITY_MOCK[opcoName];
  if (!raw) {
    return {
      securityPosture: { score: 85, status: 'pass', details: 'Default – no data.' },
      regulatoryCompliance: { score: 85, status: 'pass', details: 'Default – no data.', failingControls: [] },
      dataAndAISecurity: { score: 85, status: 'pass', details: 'Default – no data.' },
      severity: null,
      overallStatus: 'compliant',
    };
  }
  const securityPosture = { ...raw.securityPosture, status: raw.securityPosture.score >= PASS_THRESHOLD ? 'pass' : 'fail' };
  const regRaw = raw.regulatoryCompliance;
  const regulatoryCompliance = {
    ...regRaw,
    status: regRaw.score >= PASS_THRESHOLD ? 'pass' : 'fail',
    failingControls: regRaw.failingControls || [],
  };
  const dataAndAISecurity = { ...raw.dataAndAISecurity, status: raw.dataAndAISecurity.score >= PASS_THRESHOLD ? 'pass' : 'fail' };
  const failing = [securityPosture, regulatoryCompliance, dataAndAISecurity].filter((p) => p.status === 'fail');
  const overallStatus = failing.length === 0 ? 'compliant' : 'failing';
  const severity = overallStatus === 'failing' ? (raw.severity || 'Medium') : null;
  return {
    securityPosture,
    regulatoryCompliance,
    dataAndAISecurity,
    severity,
    overallStatus,
  };
}

const DEFENDER_TABS = { summary: 'Summary', posture: 'Security Posture (Defender)', upload: 'Upload Evidence' };

/** Map Defender band to Summary overallStatus and severity for unified filter/cards. */
function defenderBandToStatus(band, score) {
  if (band === 'Exemplary' || band === 'Compliant') return { overallStatus: 'compliant', severity: null };
  if (band === 'Critical') return { overallStatus: 'failing', severity: 'Critical' };
  if (band === 'Deficient') return { overallStatus: 'failing', severity: 'High' };
  if (band === 'Developing') return { overallStatus: 'failing', severity: 'Medium' };
  if (score != null) {
    if (score >= 75) return { overallStatus: 'compliant', severity: null };
    if (score >= 50) return { overallStatus: 'failing', severity: 'Medium' };
    if (score >= 25) return { overallStatus: 'failing', severity: 'High' };
    return { overallStatus: 'failing', severity: 'Critical' };
  }
  return null;
}

export function DataSecurityCompliance({
  language = 'en',
  selectedParentHolding,
  companiesRefreshKey = 0,
  executiveOpco = '',
}) {
  const [opcos, setOpcos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [defenderGroupSummary, setDefenderGroupSummary] = useState([]);
  const [filterCard, setFilterCard] = useState('all'); // 'all' | 'compliant' | 'failing' | 'Critical' | 'High' | 'Medium'
  const [defenderTab, setDefenderTab] = useState('summary');
  const [uploadRefresh, setUploadRefresh] = useState(0);

  useEffect(() => {
    if (!selectedParentHolding) {
      setOpcos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`${API}/companies/by-parent?parent=${encodeURIComponent(selectedParentHolding)}`)
      .then((r) => r.json())
      .then((data) => {
        const list = data.opcos || [];
        const seen = new Set();
        const names = list
          .filter(({ name }) => name && name !== selectedParentHolding)
          .filter(({ name }) => {
            if (seen.has(name)) return false;
            seen.add(name);
            return true;
          })
          .map(({ name }) => name);
        setOpcos(names);
      })
      .catch(() => setOpcos([]))
      .finally(() => setLoading(false));
  }, [selectedParentHolding, companiesRefreshKey]);

  useEffect(() => {
    if (!selectedParentHolding) {
      setDefenderGroupSummary([]);
      return;
    }
    fetch(`${API}/defender/group-summary/${encodeURIComponent(selectedParentHolding)}`)
      .then((r) => r.json())
      .then((data) => setDefenderGroupSummary(data.opcos || []))
      .catch(() => setDefenderGroupSummary([]));
  }, [selectedParentHolding, uploadRefresh]);

  const defenderByOpco = useMemo(() => {
    const map = {};
    for (const o of defenderGroupSummary) {
      if (o && o.opcoName) map[o.opcoName] = o;
    }
    return map;
  }, [defenderGroupSummary]);

  const opcosWithSecurity = useMemo(() => {
    return opcos.map((name) => {
      const mock = getOpcoSecurity(name);
      const defender = defenderByOpco[name];
      const hasDefender = defender && defender.score != null;
      if (hasDefender) {
        const status = defenderBandToStatus(defender.band, defender.score) || { overallStatus: mock.overallStatus, severity: mock.severity };
        return {
          opcoName: name,
          ...mock,
          defenderScore: defender.score,
          defenderBand: defender.band,
          defenderBandColor: defender.bandColor,
          defenderSummary: defender.summary ?? null,
          overallStatus: status.overallStatus,
          severity: status.severity,
          securityPosture: { ...mock.securityPosture, score: defender.score },
          regulatoryCompliance: { ...mock.regulatoryCompliance, score: defender.score },
          dataAndAISecurity: { ...mock.dataAndAISecurity, score: defender.score },
        };
      }
      return { opcoName: name, ...mock };
    });
  }, [opcos, defenderByOpco]);

  const grouped = useMemo(() => {
    const compliant = opcosWithSecurity.filter((o) => o.overallStatus === 'compliant');
    const failing = opcosWithSecurity.filter((o) => o.overallStatus === 'failing');
    const critical = failing.filter((o) => o.severity === 'Critical');
    const high = failing.filter((o) => o.severity === 'High');
    const medium = failing.filter((o) => o.severity === 'Medium');
    return { compliant, failing, critical, high, medium };
  }, [opcosWithSecurity]);

  const filteredList = useMemo(() => {
    if (filterCard === 'all') return opcosWithSecurity;
    if (filterCard === 'compliant') return grouped.compliant;
    if (filterCard === 'failing') return grouped.failing;
    if (filterCard === 'Critical') return grouped.critical;
    if (filterCard === 'High') return grouped.high;
    if (filterCard === 'Medium') return grouped.medium;
    return [];
  }, [filterCard, grouped, opcosWithSecurity]);

  if (!selectedParentHolding) {
    return (
      <div className="data-security-section">
        <h2 className="data-security-title">Data Security Compliance</h2>
        <p className="data-security-intro">
          Security Posture, Regulatory Compliance, and Data and AI Security outcomes from Azure Defender, with an overall compliance score per OpCo.
        </p>
        <div className="data-security-empty data-security-empty-prompt">
          <p>Select a <strong>Parent Holding</strong> in the <strong>Parent Holding Overview</strong> to view Data Security Compliance for its OpCos.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="data-security-section">
        <h2 className="data-security-title">Data Security Compliance</h2>
        <p className="data-security-intro">Parent Holding: <strong>{selectedParentHolding}</strong></p>
        <p className="data-security-loading">Loading OpCos…</p>
      </div>
    );
  }

  return (
    <div className="data-security-section">
      <h2 className="data-security-title">Data Security Compliance</h2>
      <p className="data-security-intro">
        Security Posture, Regulatory Compliance, and Data and AI Security from Azure Defender. Overall score per OpCo is compliant or failing. Select a card to filter OpCos by outcome.
      </p>
      <div className="data-security-parent-banner">
        Parent Holding: <strong>{selectedParentHolding}</strong>
      </div>

      <div className="data-security-provenance-banner" role="note">
        <strong>Data provenance:</strong>{' '}
        Deterministic CISO/CDO metrics (model inventory, egress, remediation queue) are built on the Management Dashboard from server JSON as{' '}
        <code>dataComplianceDetail</code> in <code>/api/dashboard/summary</code>. This module combines{' '}
        <strong>Azure Defender</strong> group summaries when uploads exist with <strong>illustrative in-app mock payloads</strong> for control-gap examples—they are not interchangeable scores.
      </div>
      {executiveOpco && (
        <p className="data-security-exec-focus" role="status">
          Executive focus OpCo: <strong>{executiveOpco}</strong> (highlighted in the list below).
        </p>
      )}

      <div className="data-security-defender-tabs">
        {Object.entries(DEFENDER_TABS).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={'data-security-defender-tab ' + (defenderTab === key ? 'data-security-defender-tab-active' : '')}
            onClick={() => setDefenderTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {defenderTab === 'posture' && (
        <div className="data-security-defender-panel">
          <SecurityPostureDashboard
            selectedParentHolding={selectedParentHolding}
            uploadRefresh={uploadRefresh}
          />
        </div>
      )}
      {defenderTab === 'upload' && (
        <div className="data-security-defender-panel">
          <DefenderUpload
            selectedParentHolding={selectedParentHolding}
            opcos={opcos}
            onUploadComplete={() => setUploadRefresh((n) => n + 1)}
          />
        </div>
      )}

      {defenderTab === 'summary' && (
        <>
      <div className="data-security-summary">
        <button
          type="button"
          className={`data-security-card data-security-compliant ${filterCard === 'compliant' ? 'data-security-card-selected' : ''}`}
          onClick={() => setFilterCard('compliant')}
          aria-pressed={filterCard === 'compliant'}
        >
          <span className="data-security-card-value">{grouped.compliant.length}</span>
          <span className="data-security-card-label">Compliant</span>
        </button>
        <button
          type="button"
          className={`data-security-card data-security-failing ${filterCard === 'failing' ? 'data-security-card-selected' : ''}`}
          onClick={() => setFilterCard('failing')}
          aria-pressed={filterCard === 'failing'}
        >
          <span className="data-security-card-value">{grouped.failing.length}</span>
          <span className="data-security-card-label">Failing</span>
        </button>
        <button
          type="button"
          className={`data-security-card data-security-critical ${filterCard === 'Critical' ? 'data-security-card-selected' : ''}`}
          onClick={() => setFilterCard('Critical')}
          aria-pressed={filterCard === 'Critical'}
        >
          <span className="data-security-card-value">{grouped.critical.length}</span>
          <span className="data-security-card-label">Critical</span>
        </button>
        <button
          type="button"
          className={`data-security-card data-security-high ${filterCard === 'High' ? 'data-security-card-selected' : ''}`}
          onClick={() => setFilterCard('High')}
          aria-pressed={filterCard === 'High'}
        >
          <span className="data-security-card-value">{grouped.high.length}</span>
          <span className="data-security-card-label">High</span>
        </button>
        <button
          type="button"
          className={`data-security-card data-security-medium ${filterCard === 'Medium' ? 'data-security-card-selected' : ''}`}
          onClick={() => setFilterCard('Medium')}
          aria-pressed={filterCard === 'Medium'}
        >
          <span className="data-security-card-value">{grouped.medium.length}</span>
          <span className="data-security-card-label">Medium</span>
        </button>
        <button
          type="button"
          className={`data-security-card data-security-all ${filterCard === 'all' ? 'data-security-card-selected' : ''}`}
          onClick={() => setFilterCard('all')}
          aria-pressed={filterCard === 'all'}
        >
          <span className="data-security-card-value">{opcosWithSecurity.length}</span>
          <span className="data-security-card-label">All OpCos</span>
        </button>
      </div>

      <div className="data-security-filter">
        <label htmlFor="data-security-filter-select">Show</label>
        <select
          id="data-security-filter-select"
          value={filterCard}
          onChange={(e) => setFilterCard(e.target.value)}
        >
          <option value="all">All OpCos</option>
          <option value="compliant">Compliant only</option>
          <option value="failing">Failing only</option>
          <option value="Critical">Critical severity</option>
          <option value="High">High severity</option>
          <option value="Medium">Medium severity</option>
        </select>
      </div>

      <div className="data-security-list-section">
        <h3 className="data-security-list-title">
          {filterCard === 'all' && 'All OpCos'}
          {filterCard === 'compliant' && 'Compliant OpCos'}
          {filterCard === 'failing' && 'Failing OpCos'}
          {filterCard === 'Critical' && 'Critical severity'}
          {filterCard === 'High' && 'High severity'}
          {filterCard === 'Medium' && 'Medium severity'}
        </h3>
        {filteredList.length === 0 ? (
          <p className="data-security-empty">No OpCos match the selected filter.</p>
        ) : (
          <ul className="data-security-opco-list">
            {filteredList.map((item) => (
              <li
                key={item.opcoName}
                className={`data-security-opco-card ${item.overallStatus === 'failing' ? 'data-security-opco-failing' : ''}${executiveOpco && item.opcoName === executiveOpco ? ' data-security-opco-executive-focus' : ''}`}
              >
                <div className="data-security-opco-header">
                  <strong className="data-security-opco-name">{item.opcoName}</strong>
                  {item.defenderScore != null && (
                    <span
                      className="data-security-opco-defender-score"
                      style={item.defenderBandColor ? { color: item.defenderBandColor } : {}}
                      title="Security Posture Score (Defender)"
                    >
                      SPS: {item.defenderScore} – {item.defenderBand}
                    </span>
                  )}
                  <span className={`data-security-opco-badge data-security-badge-${item.overallStatus}`}>
                    {item.overallStatus === 'compliant' ? 'Compliant' : 'Failing'}
                  </span>
                  {item.severity && (
                    <span className={`data-security-opco-severity data-security-severity-${item.severity.toLowerCase()}`}>
                      {item.severity}
                    </span>
                  )}
                </div>
                {item.overallStatus === 'failing' && (
                  <div className="data-security-failing-details">
                    {item.defenderScore != null && (
                      <p className="data-security-defender-sps-inline">
                        Security Posture (Defender): {item.defenderScore}% – {item.defenderBand}
                      </p>
                    )}
                    <p className="data-security-failing-intro">Failing areas and details:</p>
                    {item.defenderSummary ? (
                      <div className="data-security-llm-summary" style={{ whiteSpace: 'pre-wrap' }}>
                        {item.defenderSummary}
                      </div>
                    ) : (
                    <ul className="data-security-pillar-list">
                      {item.securityPosture.status === 'fail' && (
                        <li className="data-security-pillar-item data-security-pillar-fail">
                          <strong>{PILLARS[0].label}</strong> (score {item.securityPosture.score})
                          <p className="data-security-pillar-detail">{item.securityPosture.details}</p>
                        </li>
                      )}
                      {item.regulatoryCompliance.status === 'fail' && (
                        <li className="data-security-pillar-item data-security-pillar-fail">
                          <strong>{PILLARS[1].label}</strong> (score {item.regulatoryCompliance.score})
                          {item.regulatoryCompliance.failingControls && item.regulatoryCompliance.failingControls.length > 0 ? (
                            <>
                              <p className="data-security-chain-legend">
                                Failed resource → Regulatory Compliance (framework + control) → Data security regulatory compliance
                              </p>
                              <ul className="data-security-regulation-module-list">
                                {item.regulatoryCompliance.failingControls.map((fc, idx) => (
                                  <li key={idx} className="data-security-regulation-module-item">
                                    <div className="data-security-control-chain">
                                      <span className="data-security-chain-resource" title="Failed resource">
                                        {fc.resource || fc.regulation}
                                      </span>
                                      <span className="data-security-chain-arrow" aria-hidden>→</span>
                                      <span className="data-security-chain-framework" title="Regulatory Compliance">
                                        {fc.framework}{fc.controlId ? `: ${fc.controlId}` : ''}{fc.controlName ? ` ${fc.controlName}` : fc.module ? ` — ${fc.module}` : ''}
                                      </span>
                                      <span className="data-security-chain-arrow" aria-hidden>→</span>
                                      <span className="data-security-chain-datasec" title="Data security regulatory compliance">
                                        {fc.dataSecurityCompliance || (fc.module && !fc.framework ? `Module: ${fc.module}` : '—')}
                                      </span>
                                    </div>
                                    {fc.details && <p className="data-security-pillar-detail">{fc.details}</p>}
                                  </li>
                                ))}
                              </ul>
                            </>
                          ) : (
                            <p className="data-security-pillar-detail">{item.regulatoryCompliance.details}</p>
                          )}
                        </li>
                      )}
                      {item.dataAndAISecurity.status === 'fail' && (
                        <li className="data-security-pillar-item data-security-pillar-fail">
                          <strong>{PILLARS[2].label}</strong> (score {item.dataAndAISecurity.score})
                          <p className="data-security-pillar-detail">{item.dataAndAISecurity.details}</p>
                        </li>
                      )}
                    </ul>
                    )}
                  </div>
                )}
                {item.overallStatus === 'compliant' && (
                  <div className="data-security-compliant-summary">
                    {item.defenderScore != null ? (
                      <span>Security Posture (Defender): {item.defenderScore}% – {item.defenderBand}</span>
                    ) : (
                      <>
                        <span>Security Posture {item.securityPosture.score}%</span>
                        <span>Regulatory Compliance {item.regulatoryCompliance.score}%</span>
                        <span>Data and AI Security {item.dataAndAISecurity.score}%</span>
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <section className="data-security-framework-coverage-section">
        <h3 className="data-security-framework-coverage-title">Framework-Mapped Control Coverage</h3>
        <p className="data-security-framework-coverage-intro">
          Map the organisation&apos;s security controls against the regulatory cybersecurity frameworks applicable to each OpCo&apos;s jurisdiction: <strong>SAMA CSF</strong> (KSA), <strong>CBUAE Cyber</strong>, <strong>NESA</strong> (UAE), <strong>SDAIA</strong> (KSA), <strong>QCERT</strong> (Qatar). Control coverage percentage per framework per OpCo, with gap identification and remediation deadlines.
        </p>
        <div className="data-security-framework-coverage-wrap">
          {opcos.map((opcoName) => {
            const frameworks = getFrameworksForOpco(opcoName);
            const defenderCoverage = defenderByOpco[opcoName]?.frameworkCoverage;
            const rows = frameworks.map((fwId) => {
              const fromDefender = Array.isArray(defenderCoverage) ? defenderCoverage.find((r) => r.frameworkId === fwId) : null;
              const data = fromDefender
                ? { coveragePct: fromDefender.coveragePct ?? 0, gaps: fromDefender.gaps || [] }
                : (OPCO_FRAMEWORK_COVERAGE_MOCK[opcoName]?.[fwId] || { coveragePct: 85, gaps: [] });
              const meta = CYBER_FRAMEWORKS.find((f) => f.id === fwId);
              return {
                frameworkId: fwId,
                frameworkLabel: meta?.label || fwId,
                coveragePct: data.coveragePct ?? (fromDefender ? 0 : 85),
                gaps: data.gaps || [],
                fromEvidence: !!fromDefender,
              };
            });
            return (
              <div key={opcoName} className="data-security-framework-opco-block">
                <h4 className="data-security-framework-opco-name">{opcoName}</h4>
                {defenderCoverage && defenderCoverage.length > 0 && (
                  <p className="data-security-framework-coverage-from-evidence">Coverage and gaps from uploaded Defender evidence.</p>
                )}
                <table className="data-security-framework-table">
                  <thead>
                    <tr>
                      <th>Framework</th>
                      <th>Control coverage</th>
                      <th>Gaps</th>
                      <th>Remediation deadlines</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.frameworkId}>
                        <td><strong>{row.frameworkLabel}</strong></td>
                        <td>
                          <span className={`data-security-coverage-pct ${row.coveragePct >= 80 ? 'data-security-coverage-ok' : row.coveragePct >= 60 ? 'data-security-coverage-warn' : 'data-security-coverage-fail'}`}>
                            {row.coveragePct}%
                          </span>
                        </td>
                        <td>
                          {row.gaps.length === 0 ? '—' : (
                            <ul className="data-security-framework-gaps-list">
                              {row.gaps.map((g, i) => (
                                <li key={i}>
                                  <span className="data-security-gap-control">{g.controlId} {g.controlName}</span>
                                  <span className="data-security-gap-desc">{g.description}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td>
                          {row.gaps.length === 0 ? '—' : (
                            <ul className="data-security-remediation-list">
                              {row.gaps.map((g, i) => (
                                <li key={i}>{g.remediationDeadline || '—'}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </section>
        </>
      )}
    </div>
  );
}
