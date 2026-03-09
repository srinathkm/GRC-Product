export const FRAMEWORKS = [
  'DFSA Rulebook',
  'SAMA',
  'CMA',
  'Dubai 2040',
  'Saudi 2030',
  'SDAIA',
  // UAE – additional governance, financial, AML
  'ADGM FSRA Rulebook',
  'ADGM Companies Regulations',
  'CBUAE Rulebook',
  'UAE AML/CFT',
  'UAE Federal Laws',
  'JAFZA Operating Regulations',
  'DMCC Company Regulations',
  'DMCC Compliance & AML',
  // UAE – sector-specific (healthcare / data protection)
  'ADHICS',
  'DHA Health Data Protection Regulation',
  // Qatar
  'QFCRA Rules',
  'Qatar AML Law',
  // Bahrain
  'CBB Rulebook',
  'BHB Sustainability ESG',
  // Oman
  'Oman CMA Regulations',
  'Oman AML Law',
  // Kuwait
  'Kuwait CMA Regulations',
  'Kuwait AML Law',
];

/** Official rulebook / framework URLs, descriptions, abbreviation and issuing authority. */
export const FRAMEWORK_REFERENCES = {
  'DFSA Rulebook': {
    url: 'https://www.dfsa.ae/rulebook',
    description: 'Dubai Financial Services Authority Rulebook – comprehensive framework and controls for the DIFC.',
    abbreviation: 'DFSA',
    authority: 'Dubai Financial Services Authority',
  },
  SAMA: {
    url: 'https://rulebook.sama.gov.sa/en',
    description: 'SAMA Rulebook – laws and implementing regulations for financial institutions regulated by the Saudi Central Bank (SAMA).',
    abbreviation: 'SAMA',
    authority: 'Saudi Central Bank (SAMA)',
  },
  CMA: {
    url: 'https://cma.org.sa',
    description: 'Capital Market Authority – framework and regulations for the Saudi capital market.',
    abbreviation: 'CMA',
    authority: 'Capital Market Authority',
  },
  'Dubai 2040': {
    url: 'https://u.ae/en/about-the-uae/strategic-initiatives/dubai-2040-urban-master-plan',
    description: 'Dubai 2040 Urban Master Plan – strategic framework for sustainable development and urban planning.',
    abbreviation: 'Dubai 2040',
    authority: 'Government of Dubai',
  },
  'Saudi 2030': {
    url: 'https://www.vision2030.gov.sa',
    description: 'Saudi Vision 2030 – national strategy and framework for economic and social transformation.',
    abbreviation: 'Saudi 2030',
    authority: 'Saudi Vision 2030',
  },
  SDAIA: {
    url: 'https://sdaia.gov.sa',
    description: 'Saudi Data and AI Authority – national data governance and AI ethics framework.',
    abbreviation: 'SDAIA',
    authority: 'Saudi Data and AI Authority',
  },
  'ADGM FSRA Rulebook': {
    url: 'https://en.adgm.thomsonreuters.com/rulebook/fsra',
    description: 'ADGM Financial Services Regulatory Authority Rulebook – financial services, markets and AML/CFT in Abu Dhabi Global Market.',
    abbreviation: 'ADGM FSRA',
    authority: 'ADGM Financial Services Regulatory Authority',
  },
  'ADGM Companies Regulations': {
    url: 'https://www.adgm.com',
    description: 'ADGM Companies Regulations – company registration, governance and compliance in ADGM.',
    abbreviation: 'ADGM Co',
    authority: 'ADGM Registration Authority',
  },
  'CBUAE Rulebook': {
    url: 'https://rulebook.centralbank.ae',
    description: 'Central Bank of the UAE Rulebook – federal banking, insurance, payment systems and AML/CFT.',
    abbreviation: 'CBUAE',
    authority: 'Central Bank of the UAE',
  },
  'UAE AML/CFT': {
    url: 'https://www.centralbank.ae/en/anti-money-laundering',
    description: 'UAE Federal AML/CFT framework – Federal Decree-Law and CBUAE/supervisory authority guidance.',
    abbreviation: 'UAE AML',
    authority: 'UAE Federal / CBUAE',
  },
  'UAE Federal Laws': {
    url: 'https://uaelegislation.gov.ae',
    description: 'UAE federal commercial, labour and sector laws applicable to mainland and free zones where applicable.',
    abbreviation: 'UAE Federal',
    authority: 'UAE Federal Government',
  },
  'JAFZA Operating Regulations': {
    url: 'https://www.jafza.ae',
    description: 'Jebel Ali Free Zone operating regulations – licensing, customs and company setup.',
    abbreviation: 'JAFZA',
    authority: 'Jebel Ali Free Zone Authority',
  },
  'DMCC Company Regulations': {
    url: 'https://www.dmcc.ae',
    description: 'DMCC company formation and governance regulations for the Dubai Multi Commodities Centre.',
    abbreviation: 'DMCC Co',
    authority: 'Dubai Multi Commodities Centre',
  },
  'DMCC Compliance & AML': {
    url: 'https://www.dmcc.ae',
    description: 'DMCC compliance and AML/CFT obligations for commodity and trading activities.',
    abbreviation: 'DMCC AML',
    authority: 'Dubai Multi Commodities Centre',
  },
  ADHICS: {
    url: 'https://www.doh.gov.ae',
    description: 'Abu Dhabi Healthcare Information and Cybersecurity Standard – health information security and privacy for Abu Dhabi healthcare entities.',
    abbreviation: 'ADHICS',
    authority: 'Department of Health – Abu Dhabi',
  },
  'DHA Health Data Protection Regulation': {
    url: 'https://www.dha.gov.ae',
    description: 'Dubai Health Authority Health Data Protection Regulation – health data privacy and security requirements for Dubai healthcare providers.',
    abbreviation: 'DHA HDPR',
    authority: 'Dubai Health Authority',
  },
  'QFCRA Rules': {
    url: 'https://www.qfc.qa',
    description: 'Qatar Financial Centre Regulatory Authority – financial services, governance and AML in the QFC.',
    abbreviation: 'QFCRA',
    authority: 'Qatar Financial Centre Regulatory Authority',
  },
  'Qatar AML Law': {
    url: 'https://www.qfc.qa',
    description: 'Qatar national AML/CFT law and related regulations.',
    abbreviation: 'Qatar AML',
    authority: 'Qatar Financial Centre / State of Qatar',
  },
  'CBB Rulebook': {
    url: 'https://www.cbb.gov.bh',
    description: 'Central Bank of Bahrain Rulebook – banking, insurance and AML/CFT.',
    abbreviation: 'CBB',
    authority: 'Central Bank of Bahrain',
  },
  'BHB Sustainability ESG': {
    url: 'https://www.bahrainbourse.com',
    description: 'Bahrain Bourse sustainability and ESG listing and disclosure requirements.',
    abbreviation: 'BHB ESG',
    authority: 'Bahrain Bourse',
  },
  'Oman CMA Regulations': {
    url: 'https://www.cma.gov.om',
    description: 'Oman Capital Market Authority – securities, listing and corporate governance.',
    abbreviation: 'Oman CMA',
    authority: 'Oman Capital Market Authority',
  },
  'Oman AML Law': {
    url: 'https://www.cma.gov.om',
    description: 'Oman national AML/CFT law and implementing regulations.',
    abbreviation: 'Oman AML',
    authority: 'Oman Capital Market Authority',
  },
  'Kuwait CMA Regulations': {
    url: 'https://www.cma.gov.kw',
    description: 'Kuwait Capital Markets Authority – securities and listing regulations.',
    abbreviation: 'Kuwait CMA',
    authority: 'Kuwait Capital Markets Authority',
  },
  'Kuwait AML Law': {
    url: 'https://www.cma.gov.kw',
    description: 'Kuwait national AML/CFT law and related regulations.',
    abbreviation: 'Kuwait AML',
    authority: 'Kuwait Capital Markets Authority',
  },
};

/** Governance category/categories per framework for Multi Jurisdiction Matrix (heuristic when LLM is off). Values: Financial, Governance, AML, Other. */
export const FRAMEWORK_CATEGORIES = {
  'DFSA Rulebook': ['Financial', 'Governance', 'AML'],
  'Dubai 2040': ['Governance'],
  SAMA: ['Financial', 'AML'],
  CMA: ['Financial', 'Governance'],
  'Saudi 2030': ['Governance'],
  SDAIA: ['Governance'],
  'ADGM FSRA Rulebook': ['Financial', 'Governance', 'AML'],
  'ADGM Companies Regulations': ['Governance'],
  'CBUAE Rulebook': ['Financial', 'AML'],
  'UAE AML/CFT': ['AML'],
  'UAE Federal Laws': ['Governance', 'Financial', 'AML'],
  'JAFZA Operating Regulations': ['Governance'],
  'DMCC Company Regulations': ['Governance'],
  'DMCC Compliance & AML': ['AML'],
   ADHICS: ['Governance', 'Other'],
  'DHA Health Data Protection Regulation': ['Governance', 'Other'],
  'QFCRA Rules': ['Financial', 'Governance', 'AML'],
  'Qatar AML Law': ['AML'],
  'CBB Rulebook': ['Financial', 'AML'],
  'BHB Sustainability ESG': ['Governance'],
  'Oman CMA Regulations': ['Financial', 'Governance'],
  'Oman AML Law': ['AML'],
  'Kuwait CMA Regulations': ['Financial', 'Governance'],
  'Kuwait AML Law': ['AML'],
};

export const GUARDRAIL_MESSAGE =
  'Your question is outside the scope of this assistant. Please limit your questions to the regulatory frameworks and their recent changes: DFSA Rulebook, SAMA, CMA, Dubai 2040, Saudi 2030, SDAIA, ADGM, CBUAE, UAE AML/CFT, UAE Federal Laws, JAFZA, DMCC, QFCRA, Qatar AML, CBB, BHB, Oman CMA, Oman AML, Kuwait CMA, Kuwait AML.';

export const ALLOWED_TOPICS = [
  'DFSA', 'Rulebook', 'SAMA', 'CMA', 'Dubai 2040', 'Saudi 2030', 'SDAIA',
  'ADGM', 'FSRA', 'CBUAE', 'UAE AML', 'UAE Federal', 'JAFZA', 'DMCC',
  'QFCRA', 'Qatar AML', 'CBB', 'BHB', 'Oman CMA', 'Oman AML', 'Kuwait CMA', 'Kuwait AML',
  'regulatory', 'regulation', 'framework', 'compliance', 'change', 'amendment',
  'policy', 'rule', 'requirement', 'disclosure', 'capital', 'conduct',
  'financial', 'governance', 'vision', 'strategy', 'data', 'AI', 'ethics', 'AML', 'CFT',
];
