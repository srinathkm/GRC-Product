/**
 * defenderMapping.js — Static configuration for Azure Defender → GRC Dashboard.
 * Scoring weights, framework mappings, score bands, penalty definitions.
 */

export const DEFENDER_TO_GCC_FRAMEWORK = {
  'SAMA Cyber Security Framework': { gccFramework: 'SAMA_CSF', weight: 0.40, applicableJurisdictions: ['KSA'] },
  'Saudi Arabia - Essential Cybersecurity Controls (ECC-1:2018)': { gccFramework: 'SAMA_CSF', weight: 0.35, applicableJurisdictions: ['KSA'] },
  'Saudi Arabia - Cybersecurity Framework': { gccFramework: 'SAMA_CSF', weight: 0.38, applicableJurisdictions: ['KSA'] },
  'UAE - CBUAE Cyber Security Framework': { gccFramework: 'CBUAE_CYBER', weight: 0.40, applicableJurisdictions: ['UAE'] },
  'UAE CBUAE Cybersecurity Framework': { gccFramework: 'CBUAE_CYBER', weight: 0.40, applicableJurisdictions: ['UAE'] },
  'UAE NESA Information Assurance Standards': { gccFramework: 'NESA', weight: 0.30, applicableJurisdictions: ['UAE'] },
  'Saudi Arabia - Personal Data Protection Law (PDPL)': { gccFramework: 'SDAIA', weight: 0.35, applicableJurisdictions: ['KSA'] },
  'KSA - PDPL': { gccFramework: 'KSA_PDPL', weight: 0.30, applicableJurisdictions: ['KSA'] },
  'Qatar - National Cybersecurity Framework': { gccFramework: 'QCERT', weight: 0.35, applicableJurisdictions: ['Qatar'] },
  'Qatar QCERT': { gccFramework: 'QCERT', weight: 0.35, applicableJurisdictions: ['Qatar'] },
  'UAE Personal Data Protection Law': { gccFramework: 'UAE_PDPL', weight: 0.30, applicableJurisdictions: ['UAE'] },
  'UAE - PDPL': { gccFramework: 'UAE_PDPL', weight: 0.30, applicableJurisdictions: ['UAE'] },
  'NIST SP 800-53 Rev. 5': { gccFramework: null, weight: 0.10, applicableJurisdictions: ['UAE', 'KSA', 'Qatar'] },
  'ISO 27001': { gccFramework: null, weight: 0.15, applicableJurisdictions: ['UAE', 'KSA', 'Qatar'] },
  'CIS Microsoft Azure Foundations Benchmark': { gccFramework: null, weight: 0.10, applicableJurisdictions: ['UAE', 'KSA', 'Qatar'] },
  'Microsoft Cloud Security Benchmark': { gccFramework: null, weight: 0.10, applicableJurisdictions: ['UAE', 'KSA', 'Qatar'] },
};

export const SPS_WEIGHTS = {
  FRAMEWORK_COVERAGE: 0.35,
  VULNERABILITY: 0.30,
  ALERT_STATUS: 0.20,
  SECURE_SCORE: 0.15,
};

export const SCORE_BANDS = [
  { min: 90, max: 100, label: 'Exemplary', color: '#059669', bgLight: '#D1FAE5' },
  { min: 75, max: 89, label: 'Compliant', color: '#0284C7', bgLight: '#DBEAFE' },
  { min: 50, max: 74, label: 'Developing', color: '#D97706', bgLight: '#FEF3C7' },
  { min: 25, max: 49, label: 'Deficient', color: '#DC2626', bgLight: '#FEE2E2' },
  { min: 0, max: 24, label: 'Critical', color: '#7C3AED', bgLight: '#EDE9FE' },
];

export const REPORT_TYPES = [
  'secure_score',
  'recommendations',
  'regulatory_compliance',
  'vulnerability_assessment',
  'alert_incident',
];

export const JURISDICTION_FRAMEWORK_MAP = {
  UAE: ['CBUAE_CYBER', 'NESA', 'UAE_PDPL'],
  KSA: ['SAMA_CSF', 'SDAIA', 'KSA_PDPL'],
  Qatar: ['QCERT'],
  Bahrain: ['CBUAE_CYBER'],
  Oman: ['NESA'],
  Kuwait: ['NESA'],
  DIFC: ['CBUAE_CYBER', 'UAE_PDPL'],
  ADGM: ['CBUAE_CYBER', 'UAE_PDPL'],
};
