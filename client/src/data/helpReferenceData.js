/**
 * Reference data for the Help panel: GCC Frameworks, ESG MENA, Data Compliance.
 * Sourced from Multi Jurisdiction Matrix, ESG Summary, Data Sovereignty, and Data Security Compliance.
 */

export const GCC_FRAMEWORKS_ZONES = [
  { id: 'DIFC', name: 'Dubai International Financial Centre', location: 'Dubai, UAE', type: 'Financial Free Zone', description: 'DIFC is an onshore financial free zone with its own legal and regulatory framework. It hosts banks, asset managers, insurers and fintech. The DFSA is the independent regulator.', regulations: [{ name: 'DFSA Rulebook', category: 'Financial, Governance, AML', scope: 'Financial services, conduct of business, prudential, AML/CFT' }] },
  { id: 'ADGM', name: 'Abu Dhabi Global Market', location: 'Abu Dhabi, UAE', type: 'Financial Free Zone', description: 'ADGM is a financial free zone on Al Maryah Island with its own civil and commercial law. FSRA regulates financial services; registration and AML rules apply.', regulations: [{ name: 'ADGM FSRA Rulebook', category: 'Financial, Governance, AML', scope: 'Financial services, markets, AML/CFT' }, { name: 'ADGM Companies Regulations', category: 'Governance', scope: 'Company registration and governance' }] },
  { id: 'JAFZA', name: 'Jebel Ali Free Zone', location: 'Dubai, UAE', type: 'Trade & Logistics Free Zone', description: 'JAFZA is one of the largest free zones globally. It caters to trading, logistics and manufacturing with customs and licensing under Dubai free zone rules.', regulations: [{ name: 'JAFZA Operating Regulations', category: 'Governance', scope: 'Licensing, customs, company setup' }, { name: 'UAE AML/CFT (free zone)', category: 'AML', scope: 'AML obligations for designated entities' }] },
  { id: 'DMCC', name: 'Dubai Multi Commodities Centre', location: 'Dubai, UAE', type: 'Commodities & Trade Free Zone', description: 'DMCC focuses on commodities trading, precious metals and related services. It has its own company and licensing regime.', regulations: [{ name: 'DMCC Company Regulations', category: 'Governance', scope: 'Company formation and governance' }, { name: 'DMCC Compliance & AML', category: 'AML', scope: 'AML/CFT for commodity and trading activities' }] },
  { id: 'DUBAI_MAINLAND', name: 'Dubai (Mainland / Onshore)', location: 'Dubai, UAE', type: 'Onshore Jurisdiction', description: 'Dubai mainland is subject to UAE federal law and Dubai government regulations, including urban planning and sustainability under Dubai 2040.', regulations: [{ name: 'Dubai 2040 Urban Master Plan', category: 'Governance', scope: 'Urban planning, sustainability, development' }, { name: 'UAE Federal Laws', category: 'Governance', scope: 'Commercial, labour, AML where applicable' }] },
  { id: 'AD_MAINLAND', name: 'Abu Dhabi (Mainland)', location: 'Abu Dhabi, UAE', type: 'Onshore Jurisdiction', description: 'Abu Dhabi mainland follows UAE federal law and local regulations. ADGM sits separately as a financial free zone.', regulations: [{ name: 'UAE Federal Laws', category: 'Governance, Financial, AML', scope: 'Federal commercial, banking, AML' }] },
  { id: 'SHARJAH', name: 'Sharjah (Free Zones & Mainland)', location: 'Sharjah, UAE', type: 'Free Zone & Onshore', description: 'Sharjah has multiple free zones (e.g. SAIF Zone) and mainland. Regulations align with UAE federal and local requirements.', regulations: [{ name: 'Sharjah Free Zone Regulations', category: 'Governance', scope: 'Licensing and company setup' }, { name: 'UAE Federal Laws', category: 'Governance, AML', scope: 'As applicable to mainland and zone' }] },
  { id: 'RAS_AL_KHAIMAH', name: 'Ras Al Khaimah (RAK) Free Zones', location: 'Ras Al Khaimah, UAE', type: 'Free Zone', description: 'RAK has several free zones (RAK ICC, RAK Economic Zone) with company and licensing regulations.', regulations: [{ name: 'RAK Free Zone Regulations', category: 'Governance', scope: 'Company registration, licensing' }] },
  { id: 'KSA_ONShore', name: 'Saudi Arabia (Onshore / National)', location: 'Saudi Arabia (KSA)', type: 'Onshore Jurisdiction', description: 'National regulatory framework: SAMA (banking, insurance, AML), CMA (capital markets, governance), and sector regulators. Vision 2030 and SDAIA drive strategic and data/AI governance.', regulations: [{ name: 'SAMA Regulations & AML Rules', category: 'Financial, AML', scope: 'Banking, insurance, AML/CFT' }, { name: 'CMA Rules & Corporate Governance', category: 'Financial, Governance', scope: 'Securities, listing, governance' }, { name: 'Vision 2030 / Strategic Frameworks', category: 'Governance', scope: 'Local content, Saudization, sector strategy' }, { name: 'SDAIA / NDMO Data & AI Governance', category: 'Governance', scope: 'Data governance, AI ethics' }] },
  { id: 'KSA_GIGA', name: 'Saudi Giga-Projects (NEOM, Red Sea, etc.)', location: 'Saudi Arabia (KSA)', type: 'Special Zones', description: 'Giga-projects may have special economic or regulatory arrangements under Vision 2030 and relevant authorities.', regulations: [{ name: 'Vision 2030 / Project-Specific Regulations', category: 'Governance', scope: 'As per project and national law' }] },
  { id: 'QATAR', name: 'Qatar Financial Centre (QFC) & Mainland', location: 'Qatar', type: 'Financial Free Zone & Onshore', description: 'QFC is a financial free zone; Qatar mainland is regulated by QCB and other authorities.', regulations: [{ name: 'QFCRA Rules', category: 'Financial, Governance, AML', scope: 'Financial services in QFC' }, { name: 'Qatar AML Law', category: 'AML', scope: 'National AML/CFT' }] },
  { id: 'BAHRAIN', name: 'Bahrain (BHB, CBB)', location: 'Bahrain', type: 'Financial Hub & Onshore', description: 'Bahrain Bourse and Central Bank of Bahrain regulate listed entities and financial institutions; ESG and sustainability disclosures apply.', regulations: [{ name: 'CBB Rulebook', category: 'Financial, AML', scope: 'Banking, insurance, AML' }, { name: 'BHB Sustainability / ESG', category: 'Governance', scope: 'Listing and disclosure' }] },
  { id: 'OMAN', name: 'Oman (CMA, MSM)', location: 'Oman', type: 'Onshore Jurisdiction', description: 'Capital Market Authority and Muscat Stock Exchange govern listed and financial entities.', regulations: [{ name: 'Oman CMA Regulations', category: 'Financial, Governance', scope: 'Securities, governance' }, { name: 'Oman AML Law', category: 'AML', scope: 'National AML/CFT' }] },
  { id: 'KUWAIT', name: 'Kuwait (CMA, Boursa Kuwait)', location: 'Kuwait', type: 'Onshore Jurisdiction', description: 'Capital Markets Authority and Boursa Kuwait regulate capital markets and listed companies.', regulations: [{ name: 'Kuwait CMA Regulations', category: 'Financial, Governance', scope: 'Securities, listing' }, { name: 'Kuwait AML Law', category: 'AML', scope: 'National AML/CFT' }] },
];

export const ESG_MENA_FRAMEWORKS = [
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

/** Data Sovereignty / Data Compliance frameworks (jurisdiction + framework name). */
export const DATA_COMPLIANCE_FRAMEWORKS = [
  { jurisdiction: 'UAE', framework: 'UAE PDPL (Federal Decree-Law 45/2021) – classification tiers' },
  { jurisdiction: 'UAE', framework: 'CBUAE data governance circulars (financial)' },
  { jurisdiction: 'UAE', framework: 'ADGM data protection regime' },
  { jurisdiction: 'UAE', framework: 'DFSA rulebook – DIFC data handling' },
  { jurisdiction: 'UAE', framework: 'JAFZA / DMCC data and free zone rules' },
  { jurisdiction: 'KSA', framework: 'SDAIA data classification standards (NDGF)' },
  { jurisdiction: 'KSA', framework: 'Saudi PDPL (Royal Decree M/19) – critical data' },
  { jurisdiction: 'KSA', framework: 'SAMA data governance circulars (financial)' },
  { jurisdiction: 'Qatar', framework: 'Qatar PDPL and data classification' },
  { jurisdiction: 'Qatar', framework: 'QFCRA data and record-keeping rules' },
  { jurisdiction: 'Bahrain', framework: 'Bahrain PDPL and data classification' },
  { jurisdiction: 'Bahrain', framework: 'CBB rulebook – data and outsourcing' },
  { jurisdiction: 'Oman', framework: 'Oman PDPL and data localisation' },
  { jurisdiction: 'Oman', framework: 'Oman CMA / sector data rules' },
  { jurisdiction: 'Kuwait', framework: 'Kuwait PDPL and data residency' },
  { jurisdiction: 'Kuwait', framework: 'Kuwait CMA regulations – data' },
  { jurisdiction: 'Egypt', framework: 'Egypt Data Protection Law' },
  { jurisdiction: 'Jordan', framework: 'Jordan PDP and sector rules' },
];

/** Data Security / Cyber frameworks supported. */
export const DATA_SECURITY_FRAMEWORKS = [
  { label: 'NIST CSF 2.0', description: 'NIST Cybersecurity Framework 2.0' },
  { label: 'PCI DSS', description: 'Payment Card Industry Data Security Standard' },
  { label: 'ISO 27001', description: 'Information security management' },
  { label: 'SOC 2', description: 'Service Organization Control 2' },
  { label: 'SAMA CSF', description: 'SAMA Cybersecurity Framework (KSA)' },
  { label: 'CBUAE Cyber', description: 'CBUAE Cybersecurity and resilience (UAE)' },
  { label: 'NESA', description: 'UAE National Electronic Security Authority standards' },
  { label: 'SDAIA', description: 'SDAIA / NDMO data and AI security (KSA)' },
  { label: 'QCERT', description: 'Qatar CERT cybersecurity framework' },
];

/** Countries/jurisdictions supported for frameworks (unique list). */
export const SUPPORTED_COUNTRIES = [
  'UAE (Dubai, Abu Dhabi, Sharjah, Ras Al Khaimah, and free zones: DIFC, ADGM, JAFZA, DMCC)',
  'Saudi Arabia (KSA)',
  'Qatar',
  'Bahrain',
  'Oman',
  'Kuwait',
  'Egypt',
  'Jordan',
];
