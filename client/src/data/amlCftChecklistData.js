/**
 * amlCftChecklistData.js
 * ========================
 * UAE AML/CFT Compliance Checklist — 17 regulatory domains.
 * Each item maps to specific UAE laws, Cabinet Decisions, and CBUAE Standards.
 *
 * Item shape:
 *   id              – unique slug  (DOMAIN-NNN)
 *   control         – compliance assertion (yes/no statement)
 *   evidence        – documentation required to substantiate the control
 *   regulatoryRef   – specific UAE law / article / standard citation
 *   reviewFrequency – how often this control should be re-assessed
 *   critical        – true if non-compliance triggers immediate regulatory action
 */

export const AML_CFT_DOMAINS = [
  // ─── 1. Governance & Organizational Framework ────────────────────────────────
  {
    id: 'GOV',
    domain: 'Governance & Organizational Framework',
    items: [
      {
        id: 'GOV-001',
        control: 'Board-approved AML/CFT Policy is documented, current, and reviewed at least annually',
        evidence: 'Board resolution approving policy; AML/CFT Policy with effective date and version history',
        regulatoryRef: 'FDL 20/2018 Art. 20; Cab. Dec. 10/2019 Art. 4; CBUAE AML/CFT Standards §3.1',
        reviewFrequency: 'Annual',
        critical: true,
      },
      {
        id: 'GOV-002',
        control: 'A dedicated, sufficiently senior MLRO / Compliance Officer has been formally appointed',
        evidence: 'Appointment letter; MLRO notification to regulator; role profile with authority levels',
        regulatoryRef: 'FDL 20/2018 Art. 20(4); Cab. Dec. 10/2019 Art. 4(3); CBUAE AML/CFT Standards §3.3',
        reviewFrequency: 'On change of officer',
        critical: true,
      },
      {
        id: 'GOV-003',
        control: 'The MLRO has sufficient authority, resources, and independence to discharge AML/CFT duties',
        evidence: 'Organisational chart; budget allocation records; documented escalation rights to Board',
        regulatoryRef: 'Cab. Dec. 10/2019 Art. 4(3)(b); CBUAE AML/CFT Standards §3.3.3',
        reviewFrequency: 'Annual',
        critical: false,
      },
      {
        id: 'GOV-004',
        control: 'AML/CFT roles and responsibilities are clearly documented across all three lines of defence',
        evidence: 'Three-lines-of-defence framework document; RACI matrix for AML/CFT controls',
        regulatoryRef: 'CBUAE AML/CFT Standards §3.2; DFSA AML Rulebook Rule 3.1',
        reviewFrequency: 'Annual',
        critical: false,
      },
      {
        id: 'GOV-005',
        control: 'Internal escalation procedures for AML/CFT matters are documented and known to relevant staff',
        evidence: 'Internal escalation policy; evidence of staff acknowledgement (signed or e-learning)',
        regulatoryRef: 'Cab. Dec. 10/2019 Art. 4(5); CBUAE AML/CFT Standards §6.2',
        reviewFrequency: 'Annual',
        critical: false,
      },
      {
        id: 'GOV-006',
        control: 'Compliance with AML/CFT obligations is reported to the Board or senior management at least semi-annually',
        evidence: 'Board/management meeting minutes referencing AML/CFT; MLRO periodic report',
        regulatoryRef: 'CBUAE AML/CFT Standards §3.3.6; DFSA AML Rulebook Rule 3.3',
        reviewFrequency: 'Semi-annual',
        critical: false,
      },
    ],
  },

  // ─── 2. Business Risk Assessment ─────────────────────────────────────────────
  {
    id: 'BRA',
    domain: 'Business Risk Assessment (BRA)',
    items: [
      {
        id: 'BRA-001',
        control: 'A documented Enterprise-Wide Risk Assessment (EWRA) exists, is Board-approved, and updated at least every two years or after significant business change',
        evidence: 'EWRA document; version history; senior management / Board sign-off',
        regulatoryRef: 'FDL 20/2018 Art. 17; Cab. Dec. 10/2019 Art. 3; FATF R.1',
        reviewFrequency: 'Biennial / on material change',
        critical: true,
      },
      {
        id: 'BRA-002',
        control: 'The EWRA covers all ML/TF/PF risk factors: customers, products, services, delivery channels, and geographic exposure',
        evidence: 'EWRA risk taxonomy; risk factor weighting and scoring methodology',
        regulatoryRef: 'Cab. Dec. 10/2019 Art. 3(2); CBUAE AML/CFT Standards §4.2',
        reviewFrequency: 'Biennial',
        critical: false,
      },
      {
        id: 'BRA-003',
        control: 'UAE National Risk Assessment (NRA 2020) findings are incorporated into the EWRA',
        evidence: 'Reference to UAE NRA in EWRA; gap analysis against NRA findings',
        regulatoryRef: 'FDL 20/2018 Art. 17(2); Cab. Dec. 10/2019 Art. 3(1)',
        reviewFrequency: 'On each new NRA publication',
        critical: false,
      },
      {
        id: 'BRA-004',
        control: 'Proliferation Financing (PF) risk has been assessed separately in line with FATF 2020 revisions',
        evidence: 'PF risk section in EWRA or standalone PF risk assessment; MLRO sign-off',
        regulatoryRef: 'FATF R.1 (2020 revision); CBUAE PF Risk Guidance Note (2022)',
        reviewFrequency: 'Annual',
        critical: true,
      },
      {
        id: 'BRA-005',
        control: 'Residual risk ratings are determined for each risk category and used to calibrate the strength of controls',
        evidence: 'Risk heat map; control mapping matrix linking risk ratings to control intensity',
        regulatoryRef: 'CBUAE AML/CFT Standards §4.4; FATF R.1',
        reviewFrequency: 'Annual',
        critical: false,
      },
    ],
  },

  // ─── 3. Customer Due Diligence / KYC ─────────────────────────────────────────
  {
    id: 'CDD',
    domain: 'Customer Due Diligence (CDD) / Know Your Customer (KYC)',
    items: [
      {
        id: 'CDD-001',
        control: 'CDD procedures are documented and applied to all new customers before or during onboarding',
        evidence: 'CDD policy; onboarding workflow records; sample customer CDD files',
        regulatoryRef: 'FDL 20/2018 Art. 8; Cab. Dec. 10/2019 Art. 7; FATF R.10',
        reviewFrequency: 'Annual policy review',
        critical: true,
      },
      {
        id: 'CDD-002',
        control: 'Identity verification is performed using reliable, independent source documents for all individual customers',
        evidence: 'ID verification procedures; Emirates ID / passport copies; digital verification logs',
        regulatoryRef: 'Cab. Dec. 10/2019 Art. 7(1); CBUAE AML/CFT Standards §5.2',
        reviewFrequency: 'Ongoing (trigger-based refresh)',
        critical: true,
      },
      {
        id: 'CDD-003',
        control: 'Beneficial ownership (≥25% threshold) is identified and verified for all legal entity customers',
        evidence: 'BO declaration forms; supporting corporate documentation; Cab. Dec. 74/2020 register check',
        regulatoryRef: 'FDL 20/2018 Art. 8(5); Cab. Dec. 74/2020; FATF R.10; FATF R.24',
        reviewFrequency: 'On change / Annual review',
        critical: true,
      },
      {
        id: 'CDD-004',
        control: 'Enhanced Due Diligence (EDD) is applied to high-risk customers, PEPs, and non-face-to-face relationships',
        evidence: 'EDD procedures; list of EDD-classified customers; MLRO EDD sign-off records',
        regulatoryRef: 'Cab. Dec. 10/2019 Art. 9; CBUAE AML/CFT Standards §5.5; FATF R.12',
        reviewFrequency: 'At onboarding; periodic re-assessment per risk tier',
        critical: true,
      },
      {
        id: 'CDD-005',
        control: 'Simplified Due Diligence (SDD) is applied only where specific documented low-risk conditions are met and approved',
        evidence: 'SDD eligibility criteria; approved product/customer list for SDD; risk rationale record',
        regulatoryRef: 'Cab. Dec. 10/2019 Art. 8; CBUAE AML/CFT Standards §5.4',
        reviewFrequency: 'Annual',
        critical: false,
      },
      {
        id: 'CDD-006',
        control: 'Existing customers undergo periodic CDD refresh at intervals aligned to their risk classification',
        evidence: 'CDD refresh schedule (by risk tier); evidence of periodic reviews for sample customers',
        regulatoryRef: 'Cab. Dec. 10/2019 Art. 7(4); CBUAE AML/CFT Standards §5.7; FATF R.10',
        reviewFrequency: 'Per risk tier schedule',
        critical: false,
      },
      {
        id: 'CDD-007',
        control: 'Business relationships are refused or terminated where CDD cannot be satisfactorily completed',
        evidence: 'Exit / declination policy; records of declined or terminated relationships with rationale',
        regulatoryRef: 'Cab. Dec. 10/2019 Art. 7(5); FDL 20/2018 Art. 10',
        reviewFrequency: 'As applicable',
        critical: true,
      },
    ],
  },

  // ─── 4. Customer Risk Rating ──────────────────────────────────────────────────
  {
    id: 'CRR',
    domain: 'Customer Risk Rating',
    items: [
      {
        id: 'CRR-001',
        control: 'A risk-based customer risk rating (CRR) methodology is documented, applied at onboarding, and updated periodically',
        evidence: 'CRR methodology document; risk scoring model; sample customer risk ratings',
        regulatoryRef: 'Cab. Dec. 10/2019 Art. 3; CBUAE AML/CFT Standards §5.3; FATF R.1',
        reviewFrequency: 'Annual methodology review; customer refresh per risk tier',
        critical: true,
      },
      {
        id: 'CRR-002',
        control: 'CRR methodology factors in nationality, residency, business type, product use, delivery channel, and geographic exposure',
        evidence: 'Risk factor weighting matrix in CRR methodology; evidence of consistent application',
        regulatoryRef: 'CBUAE AML/CFT Standards §5.3.2; FATF R.10 Interpretive Note',
        reviewFrequency: 'Annual',
        critical: false,
      },
      {
        id: 'CRR-003',
        control: 'PEP status and adverse media screening results are factored into the customer risk rating',
        evidence: 'Screening system integration with CRR; MLRO sign-off for PEP high-risk overrides',
        regulatoryRef: 'Cab. Dec. 10/2019 Art. 9; FATF R.12; CBUAE AML/CFT Standards §5.5',
        reviewFrequency: 'Ongoing (event-driven)',
        critical: true,
      },
      {
        id: 'CRR-004',
        control: 'High-risk customer onboarding requires MLRO and/or senior management approval before the relationship commences',
        evidence: 'Approval workflow records; MLRO high-risk onboarding approval register',
        regulatoryRef: 'Cab. Dec. 10/2019 Art. 9(2); CBUAE AML/CFT Standards §5.5.4',
        reviewFrequency: 'Per high-risk onboarding event',
        critical: true,
      },
    ],
  },

  // ─── 5. Sanctions Screening ───────────────────────────────────────────────────
  {
    id: 'SAN',
    domain: 'Sanctions Screening',
    items: [
      {
        id: 'SAN-001',
        control: 'All customers, beneficial owners, and counterparties are screened against the UAE Local Terrorist List (LTL) and UN Consolidated Sanctions List at onboarding and on an ongoing basis',
        evidence: 'Screening system records; screening policy; alert management log; UAEFIU list update confirmations',
        regulatoryRef: 'FDL 20/2018 Art. 14–16; Cab. Dec. 10/2019 Art. 25; CBUAE Sanctions Guidance',
        reviewFrequency: 'Real-time at onboarding; daily batch or real-time ongoing',
        critical: true,
      },
      {
        id: 'SAN-002',
        control: 'International sanctions lists (OFAC, EU, HM Treasury, UN) are included in the screening programme',
        evidence: 'List management policy; list update logs; vendor SLAs for list currency',
        regulatoryRef: 'FDL 20/2018 Art. 14; CBUAE AML/CFT Standards §9.1',
        reviewFrequency: 'Continuous list updates',
        critical: true,
      },
      {
        id: 'SAN-003',
        control: 'Targeted Financial Sanctions (TFS) funds-freeze procedures are implemented immediately upon designation without prior notification to the customer',
        evidence: 'TFS procedures; evidence of executed freezing actions; UAEFIU freeze notifications',
        regulatoryRef: 'FDL 20/2018 Art. 15; Cab. Dec. 10/2019 Art. 25(4)',
        reviewFrequency: 'Real-time / per designation event',
        critical: true,
      },
      {
        id: 'SAN-004',
        control: 'Sanctions screening alerts are reviewed, documented, and escalated to the MLRO within a defined SLA',
        evidence: 'Alert resolution workflow; escalation records; closed-alert files with rationale',
        regulatoryRef: 'Cab. Dec. 10/2019 Art. 25(3); CBUAE AML/CFT Standards §9.3',
        reviewFrequency: 'Per alert event',
        critical: true,
      },
      {
        id: 'SAN-005',
        control: 'Screening system match-rates and false-positive statistics are monitored and reported to management periodically',
        evidence: 'Screening MI reports; fuzzy-matching threshold calibration records',
        regulatoryRef: 'CBUAE AML/CFT Standards §9.4',
        reviewFrequency: 'Quarterly',
        critical: false,
      },
    ],
  },

  // ─── 6. Transaction Monitoring ────────────────────────────────────────────────
  {
    id: 'TXM',
    domain: 'Transaction Monitoring',
    items: [
      {
        id: 'TXM-001',
        control: 'An automated transaction monitoring system (TMS) is deployed covering all relevant transactions and accounts',
        evidence: 'TMS configuration documentation; system scope statement; vendor contract',
        regulatoryRef: 'Cab. Dec. 10/2019 Art. 16; CBUAE AML/CFT Standards §8.1; FATF R.20',
        reviewFrequency: 'Annual system review',
        critical: true,
      },
      {
        id: 'TXM-002',
        control: 'TMS scenarios and rules are grounded in the EWRA and are reviewed and tuned at least annually',
        evidence: 'Scenario rationale documentation; annual tuning review report; model validation records',
        regulatoryRef: 'CBUAE AML/CFT Standards §8.2; FATF R.1',
        reviewFrequency: 'Annual',
        critical: false,
      },
      {
        id: 'TXM-003',
        control: 'All TMS alerts are investigated, documented, and closed with a rationale within a defined SLA',
        evidence: 'Alert management records; SLA metrics dashboard; sample closed-alert files',
        regulatoryRef: 'Cab. Dec. 10/2019 Art. 16(2); CBUAE AML/CFT Standards §8.3',
        reviewFrequency: 'Ongoing; monthly MI',
        critical: true,
      },
      {
        id: 'TXM-004',
        control: 'High-risk customers are subject to enhanced transaction monitoring intensity',
        evidence: 'EDD transaction monitoring parameters; risk-based monitoring matrix',
        regulatoryRef: 'CBUAE AML/CFT Standards §8.1.3; FATF R.10',
        reviewFrequency: 'Annual review of parameters',
        critical: false,
      },
      {
        id: 'TXM-005',
        control: 'Cash transactions at or above AED 55,000 are identified, flagged, and subject to enhanced monitoring and CTR reporting',
        evidence: 'Cash threshold detection policy; CTR records; large-cash transaction MI',
        regulatoryRef: 'Cab. Dec. 10/2019 Art. 18; CBUAE AML/CFT Standards §10.2',
        reviewFrequency: 'Ongoing',
        critical: true,
      },
    ],
  },

  // ─── 7. Suspicious Transaction / Activity Reporting ──────────────────────────
  {
    id: 'STR',
    domain: 'Suspicious Transaction / Activity Reporting (STR/SAR)',
    items: [
      {
        id: 'STR-001',
        control: 'Written STR/SAR policy and procedures are in place, covering criteria for suspicion, internal reporting, and external filing via goAML',
        evidence: 'STR/SAR policy; goAML registration certificate; internal reporting form template',
        regulatoryRef: 'FDL 20/2018 Art. 9; Cab. Dec. 10/2019 Art. 15; FATF R.20',
        reviewFrequency: 'Annual',
        critical: true,
      },
      {
        id: 'STR-002',
        control: 'All STRs/SARs are filed with the UAEFIU via goAML without undue delay (as soon as practicable after forming suspicion)',
        evidence: 'goAML submission receipts; internal STR register with forming-of-suspicion and filing dates',
        regulatoryRef: 'FDL 20/2018 Art. 9(2); Cab. Dec. 10/2019 Art. 15(3)',
        reviewFrequency: 'Per filing event',
        critical: true,
      },
      {
        id: 'STR-003',
        control: 'Tipping-off prohibition is understood by all relevant staff and enforced through policy and training',
        evidence: 'Anti-tipping-off policy; training records acknowledging the prohibition; staff declarations',
        regulatoryRef: 'FDL 20/2018 Art. 11; Cab. Dec. 10/2019 Art. 15(6)',
        reviewFrequency: 'Annual training cycle',
        critical: true,
      },
      {
        id: 'STR-004',
        control: 'Internal suspicion reports from staff are assessed by the MLRO within a defined timeframe before the external filing decision is made',
        evidence: 'Internal reporting form; MLRO assessment log with timestamps; disposition records',
        regulatoryRef: 'Cab. Dec. 10/2019 Art. 15(2); CBUAE AML/CFT Standards §6.1',
        reviewFrequency: 'Per internal report',
        critical: false,
      },
      {
        id: 'STR-005',
        control: 'MLRO decisions not to file an STR are documented with a clear written rationale',
        evidence: 'MLRO no-file decision log; written rationale for each decision',
        regulatoryRef: 'CBUAE AML/CFT Standards §6.1.5',
        reviewFrequency: 'Per no-file decision',
        critical: false,
      },
    ],
  },

  // ─── 8. Cash Transaction Reporting ───────────────────────────────────────────
  {
    id: 'CTR',
    domain: 'Cash Transaction Reporting (CTR)',
    items: [
      {
        id: 'CTR-001',
        control: 'Procedures for identifying and reporting single or linked cash transactions ≥ AED 55,000 to the UAEFIU via goAML are documented and operational',
        evidence: 'CTR reporting procedures; goAML CTR submission logs; threshold detection system evidence',
        regulatoryRef: 'FDL 20/2018 Art. 9(3); Cab. Dec. 10/2019 Art. 18; CBUAE AML/CFT Standards §10.2',
        reviewFrequency: 'Annual procedure review',
        critical: true,
      },
      {
        id: 'CTR-002',
        control: 'Structuring (deliberate splitting of transactions to avoid reporting thresholds) is actively detected and reported',
        evidence: 'TMS structuring scenarios; STR records for detected structuring cases',
        regulatoryRef: 'FDL 20/2018 Art. 9; Cab. Dec. 10/2019 Art. 18(3)',
        reviewFrequency: 'Ongoing monitoring',
        critical: true,
      },
      {
        id: 'CTR-003',
        control: 'CTR filing volumes, accuracy, and timeliness are tracked and reviewed by the MLRO periodically',
        evidence: 'MLRO CTR management information dashboard; quarterly review records',
        regulatoryRef: 'CBUAE AML/CFT Standards §10.3',
        reviewFrequency: 'Monthly / Quarterly',
        critical: false,
      },
    ],
  },

  // ─── 9. Record Keeping ────────────────────────────────────────────────────────
  {
    id: 'REC',
    domain: 'Record Keeping',
    items: [
      {
        id: 'REC-001',
        control: 'CDD records (identity documents, BO information, business purpose) are retained for a minimum of 5 years from the end of the business relationship',
        evidence: 'Data retention policy; system retention controls; sample record retrieval test',
        regulatoryRef: 'FDL 20/2018 Art. 25; Cab. Dec. 10/2019 Art. 22; FATF R.11',
        reviewFrequency: 'Annual policy review',
        critical: true,
      },
      {
        id: 'REC-002',
        control: 'Transaction records sufficient to reconstruct individual transactions are retained for at least 5 years',
        evidence: 'Transaction archiving policy; system audit trail records; sample retrieval evidence',
        regulatoryRef: 'FDL 20/2018 Art. 25(1)(b); Cab. Dec. 10/2019 Art. 22(2)',
        reviewFrequency: 'Annual policy review',
        critical: true,
      },
      {
        id: 'REC-003',
        control: 'All STR/SAR filings, MLRO assessments, alert investigations, and related correspondence are retained for at least 5 years',
        evidence: 'STR register; goAML archive; MLRO case files; alert management records',
        regulatoryRef: 'FDL 20/2018 Art. 25; Cab. Dec. 10/2019 Art. 22',
        reviewFrequency: 'Annual',
        critical: false,
      },
      {
        id: 'REC-004',
        control: 'Records are stored securely and can be made available to competent authorities in a timely manner upon request',
        evidence: 'Records access and security policy; evidence of response to any past regulatory data requests',
        regulatoryRef: 'FDL 20/2018 Art. 25(2); CBUAE AML/CFT Standards §11.1',
        reviewFrequency: 'Annual',
        critical: true,
      },
    ],
  },

  // ─── 10. Training & Awareness ─────────────────────────────────────────────────
  {
    id: 'TRN',
    domain: 'Training & Awareness',
    items: [
      {
        id: 'TRN-001',
        control: 'All relevant staff receive AML/CFT induction training before or immediately upon commencing AML-sensitive roles',
        evidence: 'Induction training records; completion certificates; training curriculum content',
        regulatoryRef: 'Cab. Dec. 10/2019 Art. 20; CBUAE AML/CFT Standards §12.1; FATF R.18',
        reviewFrequency: 'At induction; ongoing refreshers',
        critical: true,
      },
      {
        id: 'TRN-002',
        control: 'AML/CFT refresher training is conducted at least annually for all relevant staff',
        evidence: 'Annual training schedule; attendance records; pass rates by department',
        regulatoryRef: 'Cab. Dec. 10/2019 Art. 20; CBUAE AML/CFT Standards §12.2',
        reviewFrequency: 'Annual',
        critical: false,
      },
      {
        id: 'TRN-003',
        control: 'Training content is updated to reflect regulatory changes, emerging typologies, and lessons from internal cases',
        evidence: 'Training content version history; MLRO sign-off on annual content update',
        regulatoryRef: 'CBUAE AML/CFT Standards §12.3',
        reviewFrequency: 'Annual',
        critical: false,
      },
      {
        id: 'TRN-004',
        control: 'Training effectiveness is assessed through post-training testing and results are reported to management',
        evidence: 'Post-training assessment results; training MI report to management',
        regulatoryRef: 'CBUAE AML/CFT Standards §12.4',
        reviewFrequency: 'Annual',
        critical: false,
      },
      {
        id: 'TRN-005',
        control: 'Senior management and Board members receive AML/CFT governance briefings at least annually',
        evidence: 'Board training records; management briefing materials; attendance evidence',
        regulatoryRef: 'CBUAE AML/CFT Standards §12.5; DFSA AML Rulebook Rule 3.3',
        reviewFrequency: 'Annual',
        critical: false,
      },
    ],
  },

  // ─── 11. Third-Party Reliance & Outsourcing ───────────────────────────────────
  {
    id: 'TPR',
    domain: 'Third-Party Reliance & Outsourcing (TPRM)',
    items: [
      {
        id: 'TPR-001',
        control: 'Reliance on third parties for CDD is only applied where permissible under UAE law and a written reliance agreement is in place',
        evidence: 'Third-party reliance agreements; list of approved introducers/third parties; legal opinion where required',
        regulatoryRef: 'Cab. Dec. 10/2019 Art. 13; FATF R.17',
        reviewFrequency: 'Annual review of each agreement',
        critical: true,
      },
      {
        id: 'TPR-002',
        control: 'Outsourced AML/CFT functions are subject to contractual AML obligations and periodic performance oversight',
        evidence: 'Outsourcing contracts with AML/CFT clauses; vendor risk assessment; performance review records',
        regulatoryRef: 'CBUAE AML/CFT Standards §13.2; DFSA AML Rulebook Rule 9.1',
        reviewFrequency: 'Annual',
        critical: false,
      },
      {
        id: 'TPR-003',
        control: 'Ultimate regulatory responsibility for CDD compliance remains with the regulated entity regardless of third-party reliance',
        evidence: 'Policy statement on third-party liability; legal sign-off on reliance framework',
        regulatoryRef: 'Cab. Dec. 10/2019 Art. 13(3); FATF R.17',
        reviewFrequency: 'Annual',
        critical: false,
      },
    ],
  },

  // ─── 12. Correspondent Banking ────────────────────────────────────────────────
  {
    id: 'COR',
    domain: 'Correspondent Banking',
    items: [
      {
        id: 'COR-001',
        control: 'Pre-relationship AML/CFT due diligence is conducted on all correspondent bank relationships before commencement',
        evidence: 'Correspondent bank due diligence files; SWIFT KYC Registry evidence; MLRO sign-off',
        regulatoryRef: 'Cab. Dec. 10/2019 Art. 14; CBUAE AML/CFT Standards §7.1; FATF R.13',
        reviewFrequency: 'At onboarding; periodic review per risk tier',
        critical: true,
      },
      {
        id: 'COR-002',
        control: 'Shell bank relationships are prohibited and correspondents provide written representations confirming they do not allow shell banks to use their accounts',
        evidence: 'Anti-shell bank policy; contractual representations from correspondents; annual confirmations',
        regulatoryRef: 'Cab. Dec. 10/2019 Art. 14(4); FATF R.13(b)',
        reviewFrequency: 'Annual confirmations',
        critical: true,
      },
      {
        id: 'COR-003',
        control: 'Payable-through account (PTA) controls are documented and applied where applicable',
        evidence: 'PTA policy; controls documentation; correspondent agreements referencing PTA restrictions',
        regulatoryRef: 'CBUAE AML/CFT Standards §7.3; FATF R.13',
        reviewFrequency: 'Annual',
        critical: false,
      },
    ],
  },

  // ─── 13. New Payment Settlement Technologies ─────────────────────────────────
  {
    id: 'NPS',
    domain: 'New Payment Settlement Technologies (NPST)',
    items: [
      {
        id: 'NPS-001',
        control: 'A risk assessment covering ML/TF/PF risks is conducted before launching new or innovative products, services, or delivery channels',
        evidence: 'Pre-launch product risk assessment; MLRO sign-off; Board/senior management approval record',
        regulatoryRef: 'Cab. Dec. 10/2019 Art. 3(2)(d); CBUAE AML/CFT Standards §4.3; FATF R.15',
        reviewFrequency: 'Prior to each new product/channel launch',
        critical: true,
      },
      {
        id: 'NPS-002',
        control: 'Wire transfer originator and beneficiary information requirements (FATF R.16 / SWIFT gpi) are complied with for all cross-border transfers',
        evidence: 'Wire transfer procedures; system configuration for originator/beneficiary data capture; sample wire records',
        regulatoryRef: 'Cab. Dec. 10/2019 Art. 17; CBUAE AML/CFT Standards §10.1; FATF R.16',
        reviewFrequency: 'Annual',
        critical: true,
      },
      {
        id: 'NPS-003',
        control: 'Virtual Asset (VA) activities, if conducted, are registered or licensed with the relevant UAE authority (VARA/CBUAE) and covered by dedicated AML/CFT controls',
        evidence: 'VARA/CBUAE registration or licence; VA-specific AML/CFT policy; Travel Rule compliance records',
        regulatoryRef: 'FDL 20/2018 Art. 2 (as amended); VARA AML/CFT Guidelines 2023; FATF R.15/16',
        reviewFrequency: 'Annual; per regulatory update',
        critical: true,
      },
    ],
  },

  // ─── 14. High-Risk Categories & Jurisdictions ─────────────────────────────────
  {
    id: 'HRC',
    domain: 'High-Risk Categories & Jurisdictions',
    items: [
      {
        id: 'HRC-001',
        control: 'Procedures for identifying and applying EDD to Politically Exposed Persons (PEPs) — domestic and foreign — are operational',
        evidence: 'PEP identification procedures; PEP register; EDD records for PEP customers; MLRO approvals',
        regulatoryRef: 'Cab. Dec. 10/2019 Art. 9; CBUAE AML/CFT Standards §5.5; FATF R.12',
        reviewFrequency: 'Ongoing screening; annual review of existing PEP customers',
        critical: true,
      },
      {
        id: 'HRC-002',
        control: 'Business with customers or counterparties in FATF "black" and "grey" list jurisdictions is subject to countermeasures or enhanced scrutiny per CBUAE guidance',
        evidence: 'High-risk jurisdiction policy; restricted/EDD jurisdiction list; evidence of countermeasures applied',
        regulatoryRef: 'Cab. Dec. 10/2019 Art. 11; CBUAE AML/CFT Standards §5.6; FATF R.19',
        reviewFrequency: 'Updated with each FATF plenary cycle (3× per year)',
        critical: true,
      },
      {
        id: 'HRC-003',
        control: 'Designated Non-Financial Business and Professions (DNFBP) customers are identified and subject to appropriate CDD and monitoring',
        evidence: 'DNFBP categorisation in CDD/CRR system; MLRO sign-off on DNFBP customers',
        regulatoryRef: 'FDL 20/2018 Art. 3; Cab. Dec. 10/2019 Art. 7(3)(c); FATF R.22–23',
        reviewFrequency: 'At onboarding; annual review',
        critical: false,
      },
      {
        id: 'HRC-004',
        control: 'High-value dealers, real estate transactions, and trade finance exposures are subject to sector-specific enhanced controls',
        evidence: 'Sector risk assessments; sector-specific controls documentation; sample customer files',
        regulatoryRef: 'UAE NRA 2020 sector findings; FDL 20/2018 Art. 3; FATF R.22',
        reviewFrequency: 'Annual',
        critical: false,
      },
    ],
  },

  // ─── 15. Regulatory Reporting & Cooperation ───────────────────────────────────
  {
    id: 'RPT',
    domain: 'Regulatory Reporting & Cooperation',
    items: [
      {
        id: 'RPT-001',
        control: 'All mandatory AML/CFT regulatory reports (STRs, CTRs, annual MLRO report) are submitted accurately and on time',
        evidence: 'Filing register with submission dates; regulator acknowledgements; MLRO annual report signed by management',
        regulatoryRef: 'FDL 20/2018 Art. 9; Cab. Dec. 10/2019 Art. 15, 18; CBUAE AML/CFT Standards §6.2',
        reviewFrequency: 'Per reporting deadline',
        critical: true,
      },
      {
        id: 'RPT-002',
        control: 'The entity cooperates fully and promptly with competent authorities (UAEFIU, CBUAE, DFSA, ADGM, SCA etc.) on all information requests',
        evidence: 'Regulatory correspondence log; response-time tracking records; legal/compliance sign-off on responses',
        regulatoryRef: 'FDL 20/2018 Art. 26–27; FATF R.31',
        reviewFrequency: 'Per information request event',
        critical: true,
      },
      {
        id: 'RPT-003',
        control: 'An annual MLRO report covering AML/CFT programme effectiveness is prepared and presented to Board or senior management',
        evidence: 'MLRO annual report document; Board/senior management sign-off or meeting minutes',
        regulatoryRef: 'CBUAE AML/CFT Standards §3.3.6; DFSA AML Rulebook Rule 3.3',
        reviewFrequency: 'Annual',
        critical: false,
      },
    ],
  },

  // ─── 16. Internal Audit & Independent Review ─────────────────────────────────
  {
    id: 'AUD',
    domain: 'Internal Audit & Independent Review',
    items: [
      {
        id: 'AUD-001',
        control: 'An independent AML/CFT audit covering all key controls is conducted at least annually',
        evidence: 'Internal audit charter with AML/CFT scope; audit reports; findings and management responses',
        regulatoryRef: 'Cab. Dec. 10/2019 Art. 4(4); CBUAE AML/CFT Standards §14.1; FATF R.18(b)',
        reviewFrequency: 'Annual',
        critical: true,
      },
      {
        id: 'AUD-002',
        control: 'Audit findings are reported directly to the Board / Audit Committee with a formal remediation tracking process',
        evidence: 'Board/Audit Committee meeting minutes; consolidated findings tracker; management response letters',
        regulatoryRef: 'CBUAE AML/CFT Standards §14.2; DFSA AML Rulebook Rule 3.4',
        reviewFrequency: 'Per audit cycle',
        critical: false,
      },
      {
        id: 'AUD-003',
        control: 'High and medium severity audit findings are remediated within agreed timelines and closures are validated by Internal Audit',
        evidence: 'Remediation evidence packs; internal audit closure sign-off records; overdue findings MI',
        regulatoryRef: 'CBUAE AML/CFT Standards §14.3',
        reviewFrequency: 'Per finding SLA',
        critical: false,
      },
      {
        id: 'AUD-004',
        control: 'A continuous AML/CFT compliance monitoring and testing programme operates between formal audit cycles',
        evidence: 'Compliance testing plan; sample test results; quarterly compliance reporting to management',
        regulatoryRef: 'CBUAE AML/CFT Standards §14.4; FATF R.18',
        reviewFrequency: 'Ongoing; quarterly reporting',
        critical: false,
      },
    ],
  },

  // ─── 17. Escalation & Enforcement ────────────────────────────────────────────
  {
    id: 'ESC',
    domain: 'Escalation & Enforcement',
    items: [
      {
        id: 'ESC-001',
        control: 'A documented disciplinary framework addresses AML/CFT non-compliance by staff, including termination for deliberate misconduct',
        evidence: 'HR disciplinary policy with AML/CFT provisions; records of any past disciplinary actions (redacted)',
        regulatoryRef: 'FDL 20/2018 Art. 23; Cab. Dec. 10/2019 Art. 4(5)(d)',
        reviewFrequency: 'Annual',
        critical: false,
      },
      {
        id: 'ESC-002',
        control: 'Regulatory enforcement actions, fines, or remediation commitments are tracked and managed at senior management level',
        evidence: 'Regulatory correspondence log; remediation plan with milestones; senior management sign-off',
        regulatoryRef: 'FDL 20/2018 Art. 22 (penalties); Cab. Dec. 10/2019 Art. 26',
        reviewFrequency: 'Per enforcement event; ongoing tracking',
        critical: true,
      },
      {
        id: 'ESC-003',
        control: 'Whistleblower and good-faith reporting protections under the AML/CFT law are communicated to all relevant staff',
        evidence: 'Whistleblower policy; staff communication records; intranet publication evidence',
        regulatoryRef: 'FDL 20/2018 Art. 12 (protection from liability); CBUAE AML/CFT Standards §6.3',
        reviewFrequency: 'Annual communication',
        critical: false,
      },
      {
        id: 'ESC-004',
        control: 'Freeze/seizure orders issued by competent authorities are executed immediately and acknowledged within required regulatory timeframes',
        evidence: 'Asset freeze register; authority notification confirmations; legal team action records',
        regulatoryRef: 'FDL 20/2018 Art. 15; Cab. Dec. 10/2019 Art. 25(4)',
        reviewFrequency: 'Per order event',
        critical: true,
      },
    ],
  },
];

/** Flat list of all items for easy lookup by ID */
export const AML_CFT_ALL_ITEMS = AML_CFT_DOMAINS.flatMap((d) =>
  d.items.map((item) => ({ ...item, domainId: d.id, domainLabel: d.domain }))
);

/**
 * Kuwait AML/CFT Compliance Checklist — internal benchmarks.
 *
 * For now, Kuwait benchmarks reuse the same 17-domain structure as the UAE
 * checklist, with Kuwait-specific wording and regulatory references applied.
 * (Each item id is prefixed with `KWT-` to keep state separated from UAE.)
 */
function transformUaeTextToKuwait(text) {
  let s = String(text ?? '');

  // Core geography / jurisdiction terms
  s = s.replace(/\bUAE\b/gi, 'Kuwait');
  s = s.replace(/United Arab Emirates/gi, 'State of Kuwait');

  // Core authorities / systems
  s = s.replace(/\bUAEFIU\b/gi, 'FIU Kuwait');
  s = s.replace(/\bCBUAE\b/gi, 'Central Bank of Kuwait');
  s = s.replace(/\bgoAML\b/gi, 'Kuwait FIU electronic reporting system (to be confirmed)');

  // Typical UAE-specific document/citation fragments
  s = s.replace(/FDL\s*20\/2018/gi, 'Kuwait AML Law (Law No. 106 of 2013) (to be confirmed)');
  s = s.replace(/Cab\.\s*Dec\.\s*10\/2019/gi, 'Kuwait implementing regulations / FIU guidance (to be confirmed)');
  s = s.replace(/Cab\.\s*Dec\./gi, 'Kuwait implementing regulations / FIU guidance (to be confirmed)');

  // Threshold placeholders
  s = s.replace(/AED\s*55,000/gi, 'KWD cash reporting threshold (to be confirmed)');

  // Common UAE-ID phrasing
  s = s.replace(/Emirates ID/gi, 'Kuwait civil ID / passport');

  // Keep FATF references as-is; replace other UAE regulators with generic Kuwait authorities.
  s = s.replace(/\bDFSA\b/gi, 'Kuwait securities / financial regulator (to be confirmed)');
  s = s.replace(/\bADGM\b/gi, 'Kuwait competent authorities (to be confirmed)');
  s = s.replace(/\bSCA\b/gi, 'Kuwait competent authorities (to be confirmed)');
  s = s.replace(/\bUAE Local Terrorist List\b/gi, 'Kuwait Local Terrorist List');

  return s;
}

export const AML_CFT_DOMAINS_KUWAIT = AML_CFT_DOMAINS.map((d) => ({
  ...d,
  id: `KWT-${d.id}`,
  domain: transformUaeTextToKuwait(d.domain),
  items: d.items.map((it) => ({
    ...it,
    id: `KWT-${it.id}`,
    control: transformUaeTextToKuwait(it.control),
    evidence: transformUaeTextToKuwait(it.evidence),
    regulatoryRef: transformUaeTextToKuwait(it.regulatoryRef),
  })),
}));

/** Flat list of all Kuwait items for easy lookup by ID */
export const AML_CFT_ALL_ITEMS_KUWAIT = AML_CFT_DOMAINS_KUWAIT.flatMap((d) =>
  d.items.map((item) => ({ ...item, domainId: d.id, domainLabel: d.domain }))
);

const DOMAIN_LIBRARY = {
  financial: [
    { id: 'GOV', domain: 'Governance & Accountability', controls: [
      ['Board-approved compliance framework and annual attestations are in place', true, 'Annual'],
      ['Senior compliance officer appointment, independence, and reporting lines are documented', true, 'On change / Annual'],
      ['Roles and responsibilities across first, second, and third lines are formally defined', false, 'Annual'],
      ['Material compliance issues are escalated to senior management within defined SLAs', true, 'Ongoing'],
    ]},
    { id: 'RISK', domain: 'Regulatory Risk Assessment', controls: [
      ['Enterprise compliance risk assessment is documented and refreshed for material changes', true, 'Annual / On change'],
      ['Risk taxonomy covers products, clients, channels, geography, and outsourcing', false, 'Annual'],
      ['High-risk activities have enhanced controls and pre-approval requirements', true, 'Ongoing'],
      ['Risk scoring methodology and residual risk treatment are evidenced', false, 'Annual'],
    ]},
    { id: 'CTRL', domain: 'Control Execution & Surveillance', controls: [
      ['Mandatory preventive controls are embedded into onboarding and transaction workflows', true, 'Ongoing'],
      ['Exception handling, overrides, and maker-checker controls are logged and reviewed', true, 'Monthly'],
      ['Automated surveillance/scenario rules are tuned and validated periodically', false, 'Quarterly'],
      ['Control breaches trigger documented investigation and root-cause analysis', true, 'Per event'],
    ]},
    { id: 'RPT', domain: 'Regulatory Reporting & Notifications', controls: [
      ['Statutory returns and regulatory notifications are submitted accurately and on time', true, 'Per deadline'],
      ['Regulator requests are tracked with accountable owner and closure evidence', true, 'Per request'],
      ['Late filing and breach registers are maintained with remediation actions', false, 'Monthly'],
      ['Management information includes timeliness, quality, and breach metrics', false, 'Monthly'],
    ]},
    { id: 'DOC', domain: 'Documentation & Record Retention', controls: [
      ['Policies, SOPs, and control standards are version-controlled and approved', false, 'Annual'],
      ['Evidence is retained in retrievable form per local retention requirements', true, 'Ongoing'],
      ['Critical decisions and approvals are supported by complete audit trails', true, 'Ongoing'],
      ['Third-party and intercompany compliance obligations are contractually documented', false, 'Annual'],
    ]},
    { id: 'AUD', domain: 'Independent Assurance & Remediation', controls: [
      ['Independent compliance testing/audit plan covers high-risk obligations', true, 'Annual'],
      ['Findings are risk-rated with accountable owners and due dates', false, 'Per cycle'],
      ['High/Critical findings are escalated and tracked to validated closure', true, 'Monthly'],
      ['Lessons learned are incorporated into policies, controls, and training', false, 'Quarterly'],
    ]},
  ],
  corporate: [
    { id: 'GOV', domain: 'Corporate Governance', controls: [
      ['Constitutional documents, delegated authorities, and governance approvals are current', true, 'Annual'],
      ['Board and committee governance calendar is maintained and executed', false, 'Quarterly'],
      ['Conflict-of-interest declarations are completed and reviewed', false, 'Annual'],
      ['Material corporate actions follow formal approval workflows', true, 'Per event'],
    ]},
    { id: 'LIC', domain: 'Licensing & Entity Administration', controls: [
      ['Commercial licences and permits are valid, renewed, and conditions tracked', true, 'Monthly'],
      ['Regulatory filings for entity changes are submitted within statutory timelines', true, 'Per event'],
      ['Branch/free-zone/mainland legal structure is reflected in operational controls', false, 'Annual'],
      ['Authorised signatory matrix aligns with licence scope and legal mandates', true, 'On change'],
    ]},
    { id: 'OPS', domain: 'Operational Compliance', controls: [
      ['Mandatory legal notices, registers, and statutory books are maintained', true, 'Quarterly'],
      ['Contract templates include mandatory local law and regulatory clauses', false, 'Annual'],
      ['Material outsourcing arrangements include compliance obligations and audit rights', false, 'Annual'],
      ['Breach incidents are logged and resolved with preventive actions', true, 'Per event'],
    ]},
    { id: 'RPT', domain: 'Authority Interaction & Reporting', controls: [
      ['Authority submissions and renewals are filed accurately and on time', true, 'Per deadline'],
      ['Inspection requests are tracked and responded to with evidence packs', true, 'Per request'],
      ['Regulatory commitments are monitored to completion', true, 'Monthly'],
      ['Management receives periodic status on filing and inspection readiness', false, 'Monthly'],
    ]},
    { id: 'DOC', domain: 'Records & Legal Evidence', controls: [
      ['Core legal records are retained as per jurisdictional retention periods', true, 'Ongoing'],
      ['Document repositories support rapid retrieval for audit/inspection', false, 'Quarterly'],
      ['Arabic/English official documents are controlled for consistency where required', false, 'Annual'],
      ['Corporate minute books and resolutions are complete and signed', true, 'Quarterly'],
    ]},
    { id: 'AUD', domain: 'Compliance Monitoring', controls: [
      ['Internal compliance reviews cover licence conditions and statutory obligations', true, 'Annual'],
      ['Findings and remediation actions are logged with owner and timeline', false, 'Per review'],
      ['Critical non-compliance events are escalated to management immediately', true, 'Per event'],
      ['Recurring issues trigger process redesign and control hardening', false, 'Quarterly'],
    ]},
  ],
  data: [
    { id: 'GOV', domain: 'Data Governance & Accountability', controls: [
      ['Data governance policy and accountable officer are formally appointed', true, 'Annual'],
      ['Data classification and ownership are documented across critical systems', true, 'Annual'],
      ['Cross-border and third-party data handling obligations are defined', true, 'Annual'],
      ['Governance committee reviews high-risk data decisions and incidents', false, 'Quarterly'],
    ]},
    { id: 'PRV', domain: 'Privacy & Lawful Processing', controls: [
      ['Personal data processing has lawful basis and purpose limitation controls', true, 'Ongoing'],
      ['Consent/notice mechanisms are documented and auditable where required', false, 'Ongoing'],
      ['Data subject rights process is operational with SLA tracking', true, 'Monthly'],
      ['Retention and deletion schedules are enforced', true, 'Quarterly'],
    ]},
    { id: 'SEC', domain: 'Information Security Controls', controls: [
      ['Access control, authentication, and privileged access reviews are enforced', true, 'Quarterly'],
      ['Encryption and secure transmission controls are applied to sensitive data', true, 'Ongoing'],
      ['Vulnerability management and patching SLAs are monitored', true, 'Monthly'],
      ['Security logging and monitoring detect unauthorized access', true, 'Ongoing'],
    ]},
    { id: 'IR', domain: 'Incident Response & Breach Management', controls: [
      ['Data/security incident response plan is approved and tested', true, 'Annual'],
      ['Incidents are classified, investigated, and tracked to closure', true, 'Per event'],
      ['Regulatory and stakeholder notification obligations are mapped and met', true, 'Per event'],
      ['Post-incident lessons learned drive control improvements', false, 'Per event'],
    ]},
    { id: 'TPR', domain: 'Third-Party & Outsourcing Data Controls', controls: [
      ['Vendor due diligence evaluates privacy/security controls before onboarding', true, 'Per onboarding'],
      ['Contracts include data protection clauses, breach notices, and audit rights', true, 'Per contract'],
      ['Third-party assurance evidence is collected and reviewed periodically', false, 'Annual'],
      ['Shared-service processing activities are documented and risk-assessed', false, 'Annual'],
    ]},
    { id: 'AUD', domain: 'Assurance, Training & Continuous Compliance', controls: [
      ['Periodic privacy/security compliance testing is performed independently', true, 'Annual'],
      ['Mandatory role-based training completion is tracked and enforced', false, 'Annual'],
      ['Control deficiencies have remediation plans with accountable owners', true, 'Monthly'],
      ['Compliance dashboard includes KRIs, breaches, and remediation progress', false, 'Monthly'],
    ]},
  ],
  strategy: [
    { id: 'GOV', domain: 'Strategy Governance', controls: [
      ['Strategic program governance and accountable sponsors are documented', true, 'Annual'],
      ['Program objectives are mapped to regulator/authority expectations', false, 'Annual'],
      ['Portfolio steering cadence and decisions are minuted', false, 'Quarterly'],
      ['Critical strategic risks are escalated to executive governance', true, 'Quarterly'],
    ]},
    { id: 'PLAN', domain: 'Implementation Planning & Resourcing', controls: [
      ['Roadmaps, milestones, and dependencies are baselined and approved', true, 'Quarterly'],
      ['Resource plans and budget controls support execution commitments', false, 'Quarterly'],
      ['Inter-entity operating model (parent/opco) responsibilities are clear', false, 'Annual'],
      ['Material plan variances trigger corrective action workflows', true, 'Monthly'],
    ]},
    { id: 'KPI', domain: 'KPI Measurement & Outcomes', controls: [
      ['KPIs are defined with owners, targets, and evidence sources', true, 'Quarterly'],
      ['Progress reporting uses validated data with auditability', true, 'Monthly'],
      ['Underperformance thresholds and escalation triggers are predefined', true, 'Monthly'],
      ['Program benefits realization is tracked and reviewed', false, 'Quarterly'],
    ]},
    { id: 'RISK', domain: 'Risk, Compliance & Sustainability Alignment', controls: [
      ['Strategic initiatives include compliance-by-design checkpoints', true, 'Per initiative'],
      ['Risk assessments cover legal, operational, cyber, and reputational impacts', true, 'Quarterly'],
      ['Sustainability and resilience obligations are integrated into delivery', false, 'Annual'],
      ['Independent challenge function reviews strategic control quality', false, 'Annual'],
    ]},
    { id: 'RPT', domain: 'Public/Authority Reporting & Transparency', controls: [
      ['Program disclosures and authority reporting are timely and accurate', true, 'Per deadline'],
      ['Evidence packs support reported progress metrics', false, 'Monthly'],
      ['External stakeholder communications follow approval controls', false, 'Per release'],
      ['Non-compliance in disclosures is remediated with root-cause analysis', true, 'Per event'],
    ]},
    { id: 'AUD', domain: 'Assurance & Improvement', controls: [
      ['Periodic assurance reviews test strategic delivery controls', false, 'Annual'],
      ['Findings are risk-rated and tracked to closure', false, 'Per review'],
      ['High/Critical deficiencies have accelerated remediation', true, 'Monthly'],
      ['Control lessons learned are embedded into next planning cycle', false, 'Annual'],
    ]},
  ],
  esg: [
    { id: 'GOV', domain: 'ESG Governance & Accountability', controls: [
      ['ESG governance structure and board oversight are documented', true, 'Annual'],
      ['ESG policy set and role-based accountability are approved', true, 'Annual'],
      ['Material ESG risks are integrated into enterprise governance', false, 'Quarterly'],
      ['Compliance obligations for ESG disclosures are assigned', true, 'Annual'],
    ]},
    { id: 'MAT', domain: 'Materiality & Risk Assessment', controls: [
      ['Materiality methodology is documented and periodically refreshed', true, 'Annual'],
      ['Stakeholder input and sector context are evidenced in materiality outcomes', false, 'Annual'],
      ['Climate, social, and governance risks are assessed with clear owners', true, 'Annual'],
      ['Materiality changes trigger KPI and disclosure updates', false, 'On change'],
    ]},
    { id: 'DATA', domain: 'ESG Data Quality & Controls', controls: [
      ['ESG data dictionary, lineage, and ownership are defined', true, 'Annual'],
      ['Data collection controls include validation and reconciliation checks', true, 'Quarterly'],
      ['Manual adjustments are logged with approval and rationale', false, 'Monthly'],
      ['Evidence for reported ESG metrics is retained and retrievable', true, 'Ongoing'],
    ]},
    { id: 'TGT', domain: 'Targets, Programs & Monitoring', controls: [
      ['ESG targets are approved, measurable, and time-bound', false, 'Annual'],
      ['Program delivery plans map initiatives to targets and owners', false, 'Quarterly'],
      ['Performance against targets is monitored and escalated when off-track', true, 'Monthly'],
      ['Corrective actions for underperformance are tracked to closure', true, 'Monthly'],
    ]},
    { id: 'DISC', domain: 'Disclosure & Reporting Compliance', controls: [
      ['ESG disclosures follow required framework/regulatory guidance', true, 'Per deadline'],
      ['Disclosure governance includes legal and compliance review', true, 'Per disclosure cycle'],
      ['Public statements are supported by evidence and traceability', true, 'Per disclosure cycle'],
      ['Disclosure errors are corrected with transparent restatement process', true, 'Per event'],
    ]},
    { id: 'AUD', domain: 'Assurance & Continuous Improvement', controls: [
      ['Independent assurance scope includes key ESG metrics and controls', false, 'Annual'],
      ['Assurance findings are risk-rated and remediated with owners', false, 'Per cycle'],
      ['Critical disclosure/control gaps trigger executive escalation', true, 'Per event'],
      ['Improvement plans are integrated into next reporting cycle', false, 'Annual'],
    ]},
  ],
};

const FRAMEWORK_CATALOG = [
  { key: 'DFSA Rulebook', authority: 'Dubai Financial Services Authority', jurisdictions: ['DIFC, UAE'], family: 'financial', riskThemes: ['Market conduct', 'Prudential controls', 'AML/CFT', 'Governance'] },
  { key: 'SAMA', authority: 'Saudi Central Bank', jurisdictions: ['KSA'], family: 'financial', riskThemes: ['Banking compliance', 'Consumer protection', 'AML/CFT', 'Operational resilience'] },
  { key: 'CMA', authority: 'Capital Market Authority (Saudi Arabia)', jurisdictions: ['KSA'], family: 'financial', riskThemes: ['Capital markets', 'Disclosure', 'Conduct', 'Governance'] },
  { key: 'Dubai 2040', authority: 'Government of Dubai', jurisdictions: ['Dubai, UAE'], family: 'strategy', riskThemes: ['Urban strategy', 'Program governance', 'Delivery assurance'] },
  { key: 'Saudi 2030', authority: 'Vision 2030 Program Offices / Government of KSA', jurisdictions: ['KSA'], family: 'strategy', riskThemes: ['Strategic delivery', 'Transformation governance', 'KPI assurance'] },
  { key: 'SDAIA', authority: 'Saudi Data & AI Authority', jurisdictions: ['KSA'], family: 'data', riskThemes: ['Data governance', 'AI governance', 'Privacy', 'Cybersecurity'] },
  { key: 'ADGM FSRA Rulebook', authority: 'ADGM FSRA', jurisdictions: ['ADGM, UAE'], family: 'financial', riskThemes: ['Financial regulation', 'AML/CFT', 'Conduct', 'Governance'] },
  { key: 'ADGM Companies Regulations', authority: 'ADGM Registration Authority', jurisdictions: ['ADGM, UAE'], family: 'corporate', riskThemes: ['Corporate governance', 'Entity administration', 'Statutory filings'] },
  { key: 'CBUAE Rulebook', authority: 'Central Bank of the UAE', jurisdictions: ['UAE'], family: 'financial', riskThemes: ['Prudential controls', 'AML/CFT', 'Consumer protection', 'Reporting'] },
  { key: 'UAE Federal Laws', authority: 'UAE Federal Government', jurisdictions: ['UAE'], family: 'corporate', riskThemes: ['Corporate law', 'Statutory governance', 'Licensing obligations'] },
  { key: 'JAFZA Operating Regulations', authority: 'JAFZA Authority', jurisdictions: ['JAFZA, Dubai, UAE'], family: 'corporate', riskThemes: ['Free-zone operations', 'Licensing', 'Entity compliance'] },
  { key: 'DMCC Company Regulations', authority: 'DMCC Authority', jurisdictions: ['DMCC, Dubai, UAE'], family: 'corporate', riskThemes: ['Company regulations', 'Governance', 'Licensing and filings'] },
  { key: 'DMCC Compliance & AML', authority: 'DMCC Authority', jurisdictions: ['DMCC, Dubai, UAE'], family: 'financial', riskThemes: ['AML/CFT', 'Free-zone compliance', 'Reporting'] },
  { key: 'ADHICS', authority: 'Department of Health - Abu Dhabi', jurisdictions: ['Abu Dhabi, UAE'], family: 'data', riskThemes: ['Health data security', 'Privacy', 'Cyber governance'] },
  { key: 'DHA Health Data Protection Regulation', authority: 'Dubai Health Authority', jurisdictions: ['Dubai, UAE'], family: 'data', riskThemes: ['Health data protection', 'Privacy compliance', 'Information security'] },
  { key: 'QFCRA Rules', authority: 'QFCRA', jurisdictions: ['QFC, Qatar'], family: 'financial', riskThemes: ['Financial regulation', 'AML/CFT', 'Governance', 'Reporting'] },
  { key: 'Qatar AML Law', authority: 'State of Qatar Competent Authorities', jurisdictions: ['Qatar'], family: 'financial', riskThemes: ['AML/CFT', 'Sanctions', 'Suspicious reporting', 'Record keeping'] },
  { key: 'CBB Rulebook', authority: 'Central Bank of Bahrain', jurisdictions: ['Bahrain'], family: 'financial', riskThemes: ['Prudential regulation', 'AML/CFT', 'Governance', 'Disclosures'] },
  { key: 'BHB Sustainability ESG', authority: 'Bahrain Bourse', jurisdictions: ['Bahrain'], family: 'esg', riskThemes: ['ESG governance', 'Disclosure', 'Sustainability performance'] },
  { key: 'Oman CMA Regulations', authority: 'Capital Market Authority (Oman)', jurisdictions: ['Oman'], family: 'financial', riskThemes: ['Capital markets', 'Governance', 'Disclosure controls'] },
  { key: 'Oman AML Law', authority: 'Oman Competent Authorities', jurisdictions: ['Oman'], family: 'financial', riskThemes: ['AML/CFT', 'Monitoring', 'STR/CTR compliance'] },
  { key: 'Kuwait CMA Regulations', authority: 'Capital Markets Authority (Kuwait)', jurisdictions: ['Kuwait'], family: 'financial', riskThemes: ['Market compliance', 'Governance', 'Regulatory reporting'] },
  { key: 'Kuwait AML Law', authority: 'Kuwait Competent Authorities', jurisdictions: ['Kuwait'], family: 'financial', riskThemes: ['AML/CFT', 'Sanctions', 'Transaction controls'] },
];

function makeIdPrefix(frameworkKey) {
  return frameworkKey
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((p) => p.slice(0, 3).toUpperCase())
    .join('')
    .slice(0, 8);
}

function buildChecklistForFramework(meta) {
  const blueprint = DOMAIN_LIBRARY[meta.family] || DOMAIN_LIBRARY.financial;
  const prefix = makeIdPrefix(meta.key);
  const domains = blueprint.map((d) => ({
    id: `${prefix}-${d.id}`,
    domain: d.domain,
    items: d.controls.map(([statement, critical, reviewFrequency], idx) => ({
      id: `${prefix}-${d.id}-${String(idx + 1).padStart(3, '0')}`,
      control: `${statement} under ${meta.key}.`,
      evidence: `Approved policy/SOP, control logs, management approvals, and sample records evidencing compliance for ${meta.key}.`,
      regulatoryRef: `${meta.authority} - ${meta.key} (internal benchmark alignment for GCC operations).`,
      reviewFrequency,
      critical,
    })),
  }));
  const allItems = domains.flatMap((d) => d.items.map((item) => ({ ...item, domainId: d.id, domainLabel: d.domain })));
  return {
    key: meta.key,
    label: `${meta.key} Internal Compliance Checklist`,
    domains,
    allItems,
    llmAuditor: `expert ${meta.key} compliance auditor for GCC organizations`,
    profile: {
      authority: meta.authority,
      jurisdictions: meta.jurisdictions,
      applicableEntityTypes: ['Parent holding companies', 'OpCos', 'Regulated entities', 'Free-zone entities where applicable'],
      riskThemes: meta.riskThemes,
    },
  };
}

const GENERATED_FRAMEWORK_CHECKLISTS = Object.fromEntries(
  FRAMEWORK_CATALOG.map((meta) => [meta.key, buildChecklistForFramework(meta)])
);

export const AML_CFT_CHECKLISTS = {
  UAE: {
    key: 'UAE',
    label: 'UAE AML/CFT Compliance Checklist',
    domains: AML_CFT_DOMAINS,
    allItems: AML_CFT_ALL_ITEMS,
    llmAuditor: 'expert UAE AML/CFT compliance auditor',
  },
  'UAE AML/CFT': {
    key: 'UAE AML/CFT',
    label: 'UAE AML/CFT Compliance Checklist',
    domains: AML_CFT_DOMAINS,
    allItems: AML_CFT_ALL_ITEMS,
    llmAuditor: 'expert UAE AML/CFT compliance auditor',
  },
  Kuwait: {
    key: 'Kuwait',
    label: 'Kuwait AML/CFT Compliance Checklist',
    domains: AML_CFT_DOMAINS_KUWAIT,
    allItems: AML_CFT_ALL_ITEMS_KUWAIT,
    llmAuditor: 'expert Kuwait AML/CFT compliance auditor',
  },
  ...GENERATED_FRAMEWORK_CHECKLISTS,
};
