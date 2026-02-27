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

/** Official rulebook / framework URLs and descriptions for each framework. */
export const FRAMEWORK_REFERENCES = {
  'DFSA Rulebook': {
    url: 'https://www.dfsa.ae/rulebook',
    description: 'Dubai Financial Services Authority Rulebook – comprehensive framework and controls for the DIFC.',
  },
  SAMA: {
    url: 'https://rulebook.sama.gov.sa/en',
    description: 'SAMA Rulebook – laws and implementing regulations for financial institutions regulated by the Saudi Central Bank (SAMA).',
  },
  CMA: {
    url: 'https://cma.org.sa',
    description: 'Capital Market Authority – framework and regulations for the Saudi capital market.',
  },
  'Dubai 2040': {
    url: 'https://u.ae/en/about-the-uae/strategic-initiatives/dubai-2040-urban-master-plan',
    description: 'Dubai 2040 Urban Master Plan – strategic framework for sustainable development and urban planning.',
  },
  'Saudi 2030': {
    url: 'https://www.vision2030.gov.sa',
    description: 'Saudi Vision 2030 – national strategy and framework for economic and social transformation.',
  },
  SDAIA: {
    url: 'https://sdaia.gov.sa',
    description: 'Saudi Data and AI Authority – national data governance and AI ethics framework.',
  },
  'ADGM FSRA Rulebook': {
    url: 'https://en.adgm.thomsonreuters.com/rulebook/fsra',
    description: 'ADGM Financial Services Regulatory Authority Rulebook – financial services, markets and AML/CFT in Abu Dhabi Global Market.',
  },
  'ADGM Companies Regulations': {
    url: 'https://www.adgm.com',
    description: 'ADGM Companies Regulations – company registration, governance and compliance in ADGM.',
  },
  'CBUAE Rulebook': {
    url: 'https://rulebook.centralbank.ae',
    description: 'Central Bank of the UAE Rulebook – federal banking, insurance, payment systems and AML/CFT.',
  },
  'UAE AML/CFT': {
    url: 'https://www.centralbank.ae/en/anti-money-laundering',
    description: 'UAE Federal AML/CFT framework – Federal Decree-Law and CBUAE/supervisory authority guidance.',
  },
  'UAE Federal Laws': {
    url: 'https://uaelegislation.gov.ae',
    description: 'UAE federal commercial, labour and sector laws applicable to mainland and free zones where applicable.',
  },
  'JAFZA Operating Regulations': {
    url: 'https://www.jafza.ae',
    description: 'Jebel Ali Free Zone operating regulations – licensing, customs and company setup.',
  },
  'DMCC Company Regulations': {
    url: 'https://www.dmcc.ae',
    description: 'DMCC company formation and governance regulations for the Dubai Multi Commodities Centre.',
  },
  'DMCC Compliance & AML': {
    url: 'https://www.dmcc.ae',
    description: 'DMCC compliance and AML/CFT obligations for commodity and trading activities.',
  },
  'QFCRA Rules': {
    url: 'https://www.qfc.qa',
    description: 'Qatar Financial Centre Regulatory Authority – financial services, governance and AML in the QFC.',
  },
  'Qatar AML Law': {
    url: 'https://www.qfc.qa',
    description: 'Qatar national AML/CFT law and related regulations.',
  },
  'CBB Rulebook': {
    url: 'https://www.cbb.gov.bh',
    description: 'Central Bank of Bahrain Rulebook – banking, insurance and AML/CFT.',
  },
  'BHB Sustainability ESG': {
    url: 'https://www.bahrainbourse.com',
    description: 'Bahrain Bourse sustainability and ESG listing and disclosure requirements.',
  },
  'Oman CMA Regulations': {
    url: 'https://www.cma.gov.om',
    description: 'Oman Capital Market Authority – securities, listing and corporate governance.',
  },
  'Oman AML Law': {
    url: 'https://www.cma.gov.om',
    description: 'Oman national AML/CFT law and implementing regulations.',
  },
  'Kuwait CMA Regulations': {
    url: 'https://www.cma.gov.kw',
    description: 'Kuwait Capital Markets Authority – securities and listing regulations.',
  },
  'Kuwait AML Law': {
    url: 'https://www.cma.gov.kw',
    description: 'Kuwait national AML/CFT law and related regulations.',
  },
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
