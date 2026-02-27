import { useState, useMemo, useEffect } from 'react';
import './DataSovereignty.css';

const API = '/api';

/** Check definitions: id, name, regulation, description, severity when not met. */
const CHECK_DEFINITIONS = [
  { id: 'uae-pdpl-residency', name: 'UAE PDPL – Data localisation', regulation: 'UAE Federal Decree-Law 45/2021 (PDPL)', description: 'Personal data processed in UAE must be stored and processed within UAE unless transfer is permitted.', severity: 'Critical' },
  { id: 'ksa-pdpl-residency', name: 'KSA PDPL – Data localisation', regulation: 'Saudi PDPL (Royal Decree M/19)', description: 'Critical personal data must be stored and processed in KSA; cross-border transfer subject to NDMO approval.', severity: 'Critical' },
  { id: 'cbuae-data-local', name: 'CBUAE – Financial data in UAE', regulation: 'CBUAE Rulebook & circulars', description: 'Regulated financial institutions must maintain core systems and customer data within UAE or approved jurisdictions.', severity: 'Critical' },
  { id: 'sama-data-local', name: 'SAMA – Financial data in KSA', regulation: 'SAMA regulations', description: 'Banking and insurance data must reside in KSA; cloud and outsourcing subject to SAMA approval.', severity: 'Critical' },
  { id: 'cross-border-transfer', name: 'Cross-border transfer mechanisms', regulation: 'UAE PDPL / KSA PDPL', description: 'Adequate transfer mechanisms (adequacy, SCCs, binding corporate rules) in place for permitted transfers.', severity: 'Critical' },
  { id: 'dpa-registration', name: 'Data Protection Authority registration', regulation: 'UAE PDPL / Executive regulations', description: 'Registration with UAE DPA where required for controllers/processors.', severity: 'Medium' },
  { id: 'data-retention', name: 'Retention limits aligned with law', regulation: 'UAE PDPL / KSA PDPL / sector rules', description: 'Retention periods defined and aligned with minimum/maximum under applicable law.', severity: 'Medium' },
  { id: 'consent-records', name: 'Consent and lawful basis records', regulation: 'UAE PDPL / KSA PDPL', description: 'Documented lawful basis and consent where required for processing.', severity: 'Medium' },
  { id: 'dpias', name: 'Data Protection Impact Assessments', regulation: 'UAE PDPL / KSA PDPL', description: 'DPIAs conducted for high-risk processing and filed with regulator where required.', severity: 'Medium' },
  { id: 'breach-notification', name: 'Breach notification readiness', regulation: 'UAE PDPL / KSA PDPL', description: 'Process to notify regulator and data subjects within required timelines.', severity: 'Medium' },
  { id: 'processor-binding', name: 'Processor binding agreements', regulation: 'UAE PDPL / KSA PDPL', description: 'Contracts with processors imposing data protection and sovereignty obligations.', severity: 'Low' },
  { id: 'cloud-sovereignty', name: 'Cloud and sovereign cloud use', regulation: 'UAE / KSA government and sector guidance', description: 'Use of in-country or approved sovereign cloud for sensitive/critical data.', severity: 'Medium' },
  { id: 'adgm-data', name: 'ADGM – Data in ADGM / UAE', regulation: 'ADGM data protection regime', description: "ADGM entities' data handling consistent with onshore UAE and ADGM rules.", severity: 'Medium' },
  { id: 'dfsa-data', name: 'DFSA – DIFC data handling', regulation: 'DFSA rulebook', description: "DIFC firms' data residency and processing in line with DFSA and UAE requirements.", severity: 'Medium' },
  { id: 'free-zone-local', name: 'Free zone data localisation', regulation: 'JAFZA / DMCC / other zone rules', description: 'Free zone entity data stored and processed in line with UAE and zone requirements.', severity: 'Low' },
];

/** Data categories for classification & inventory. */
const DATA_CATEGORIES = ['Personal data', 'Financial records', 'Health data', 'Employee data'];

/**
 * Data classification & governance frameworks across GCC and Middle East.
 * jurisdiction, framework name, localisation mandated, sovereign cloud available in jurisdiction.
 */
const DATA_FRAMEWORKS_BY_JURISDICTION = [
  { jurisdiction: 'UAE', framework: 'UAE PDPL (Federal Decree-Law 45/2021) – classification tiers', localisationMandated: true, sovereignCloudAvailable: true },
  { jurisdiction: 'UAE', framework: 'CBUAE data governance circulars (financial)', localisationMandated: true, sovereignCloudAvailable: true },
  { jurisdiction: 'UAE', framework: 'ADGM data protection regime', localisationMandated: true, sovereignCloudAvailable: true },
  { jurisdiction: 'UAE', framework: 'DFSA rulebook – DIFC data handling', localisationMandated: true, sovereignCloudAvailable: true },
  { jurisdiction: 'UAE', framework: 'JAFZA / DMCC data and free zone rules', localisationMandated: true, sovereignCloudAvailable: false },
  { jurisdiction: 'KSA', framework: 'SDAIA data classification standards (NDGF)', localisationMandated: true, sovereignCloudAvailable: true },
  { jurisdiction: 'KSA', framework: 'Saudi PDPL (Royal Decree M/19) – critical data', localisationMandated: true, sovereignCloudAvailable: true },
  { jurisdiction: 'KSA', framework: 'SAMA data governance circulars (financial)', localisationMandated: true, sovereignCloudAvailable: true },
  { jurisdiction: 'Qatar', framework: 'Qatar PDPL and data classification', localisationMandated: true, sovereignCloudAvailable: false },
  { jurisdiction: 'Qatar', framework: 'QFCRA data and record-keeping rules', localisationMandated: true, sovereignCloudAvailable: false },
  { jurisdiction: 'Bahrain', framework: 'Bahrain PDPL and data classification', localisationMandated: true, sovereignCloudAvailable: false },
  { jurisdiction: 'Bahrain', framework: 'CBB rulebook – data and outsourcing', localisationMandated: true, sovereignCloudAvailable: false },
  { jurisdiction: 'Oman', framework: 'Oman PDPL and data localisation', localisationMandated: true, sovereignCloudAvailable: false },
  { jurisdiction: 'Oman', framework: 'Oman CMA / sector data rules', localisationMandated: true, sovereignCloudAvailable: false },
  { jurisdiction: 'Kuwait', framework: 'Kuwait PDPL and data residency', localisationMandated: true, sovereignCloudAvailable: false },
  { jurisdiction: 'Kuwait', framework: 'Kuwait CMA regulations – data', localisationMandated: true, sovereignCloudAvailable: false },
  { jurisdiction: 'Egypt', framework: 'Egypt Data Protection Law', localisationMandated: true, sovereignCloudAvailable: false },
  { jurisdiction: 'Jordan', framework: 'Jordan PDP and sector rules', localisationMandated: false, sovereignCloudAvailable: false },
];

/** OpCo -> primary jurisdiction (for governing framework). Fallback from name/framework. */
function getOpcoJurisdiction(opcoName, frameworkFromApi) {
  const uaeDIFC = ['Dubai Islamic Bank (DIFC)', 'FAB (DIFC)', 'JP Morgan (DIFC)', 'Goldman Sachs (DIFC)', 'Deutsche Bank (DIFC)', 'Standard Chartered (DIFC)', 'Shuaa Capital', 'Arqaam Capital', 'Al Mal Capital', 'Emirates NBD Capital', 'Mashreq Capital', 'Emirates Investment Bank'];
  const ksa = ['Saudi Aramco', 'Saudi National Bank', 'Saudi National Bank (SNB)', 'Al Rajhi Bank', 'Al Rajhi Capital', 'Riyad Bank', 'Riyad Capital', 'STC Pay', 'Saudi Telecom (STC)', 'SNB Capital', 'NEOM', 'Red Sea Global', 'ROSHN', 'SABIC', 'Ma\'aden', 'Mada', 'Saudi Payments'];
  const uae = ['Emirates', 'Etihad Airways', 'DP World', 'Emaar Properties', 'Dubai Holding', 'Abu Dhabi Securities Exchange (ADX)', 'AD Ports Group', 'Aramex'];
  if (ksa.some((n) => opcoName && opcoName.includes(n) || n.includes(opcoName))) return 'KSA';
  if (uaeDIFC.some((n) => opcoName === n)) return 'UAE';
  if (uae.some((n) => opcoName === n)) return 'UAE';
  if (frameworkFromApi) {
    if (['DFSA Rulebook', 'JAFZA', 'DMCC', 'ADGM', 'CBUAE', 'UAE AML', 'UAE Federal Laws'].some((f) => frameworkFromApi.includes(f))) return 'UAE';
    if (['SAMA', 'CMA', 'Saudi 2030', 'SDAIA'].some((f) => frameworkFromApi.includes(f))) return 'KSA';
    if (['QFCRA Rules', 'Qatar AML Law'].some((f) => frameworkFromApi.includes(f))) return 'Qatar';
    if (['CBB Rulebook', 'BHB Sustainability ESG'].some((f) => frameworkFromApi.includes(f))) return 'Bahrain';
    if (['Oman CMA Regulations', 'Oman AML Law'].some((f) => frameworkFromApi.includes(f))) return 'Oman';
    if (['Kuwait CMA Regulations', 'Kuwait AML Law'].some((f) => frameworkFromApi.includes(f))) return 'Kuwait';
  }
  return 'UAE';
}

/** Get governing data framework label for a jurisdiction. */
function getFrameworkForJurisdiction(jurisdiction, isFinancial) {
  const list = DATA_FRAMEWORKS_BY_JURISDICTION.filter((f) => f.jurisdiction === jurisdiction);
  if (isFinancial && list.some((f) => f.framework.includes('CBUAE') || f.framework.includes('SAMA') || f.framework.includes('CBB') || f.framework.includes('QFCRA'))) {
    const financial = list.find((f) => f.framework.includes('CBUAE') || f.framework.includes('SAMA') || f.framework.includes('CBB') || f.framework.includes('QFCRA'));
    return financial ? financial.framework : list[0]?.framework || jurisdiction;
  }
  return list[0]?.framework || `${jurisdiction} data regulations`;
}

/** Per-OpCo data inventory mock: data categories held, sovereign cloud implemented. */
const OPCO_DATA_INVENTORY_MOCK = {
  'Emirates NBD Capital': { categories: ['Personal data', 'Financial records', 'Employee data'], sovereignCloudImplemented: false },
  'Emirates Investment Bank': { categories: ['Personal data', 'Financial records', 'Employee data'], sovereignCloudImplemented: false },
  'Mashreq Capital': { categories: ['Personal data', 'Financial records'], sovereignCloudImplemented: true },
  'Dubai Islamic Bank (DIFC)': { categories: ['Personal data', 'Financial records', 'Employee data'], sovereignCloudImplemented: false },
  'Saudi National Bank (SNB)': { categories: ['Personal data', 'Financial records', 'Employee data'], sovereignCloudImplemented: true },
  'Al Rajhi Bank': { categories: ['Personal data', 'Financial records'], sovereignCloudImplemented: true },
  'Riyad Bank': { categories: ['Personal data', 'Financial records', 'Employee data'], sovereignCloudImplemented: false },
  'STC Pay': { categories: ['Personal data', 'Financial records'], sovereignCloudImplemented: true },
  'Saudi Aramco': { categories: ['Personal data', 'Financial records', 'Health data', 'Employee data'], sovereignCloudImplemented: false },
  'JP Morgan (DIFC)': { categories: ['Personal data', 'Financial records', 'Employee data'], sovereignCloudImplemented: true },
  'Shuaa Capital': { categories: ['Personal data', 'Financial records'], sovereignCloudImplemented: false },
  'Arqaam Capital': { categories: ['Personal data', 'Financial records'], sovereignCloudImplemented: false },
  'Goldman Sachs (DIFC)': { categories: ['Personal data', 'Financial records', 'Employee data'], sovereignCloudImplemented: true },
  'Deutsche Bank (DIFC)': { categories: ['Personal data', 'Financial records'], sovereignCloudImplemented: true },
  'Standard Chartered (DIFC)': { categories: ['Personal data', 'Financial records', 'Employee data'], sovereignCloudImplemented: false },
  'Barclays (DIFC)': { categories: ['Personal data', 'Financial records'], sovereignCloudImplemented: false },
  'Dubai Holding': { categories: ['Personal data', 'Employee data'], sovereignCloudImplemented: false },
  'DP World': { categories: ['Personal data', 'Financial records', 'Employee data'], sovereignCloudImplemented: true },
  'Emaar Properties': { categories: ['Personal data', 'Employee data'], sovereignCloudImplemented: false },
  'NEOM': { categories: ['Personal data', 'Health data', 'Employee data'], sovereignCloudImplemented: false },
  'Red Sea Global': { categories: ['Personal data', 'Employee data'], sovereignCloudImplemented: false },
  'ROSHN': { categories: ['Personal data', 'Employee data'], sovereignCloudImplemented: false },
  'SABIC': { categories: ['Personal data', 'Financial records', 'Employee data'], sovereignCloudImplemented: true },
  'Ma\'aden': { categories: ['Personal data', 'Financial records', 'Employee data'], sovereignCloudImplemented: false },
  'Mada': { categories: ['Personal data', 'Financial records'], sovereignCloudImplemented: true },
  'Saudi Payments': { categories: ['Personal data', 'Financial records'], sovereignCloudImplemented: true },
};

function getDefaultInventory(opcoName) {
  return {
    categories: ['Personal data', 'Employee data'],
    sovereignCloudImplemented: false,
  };
}

/** Per-OpCo compliance mock: opco -> list of { checkId, met }. Missing checkId = met. */
const OPCO_COMPLIANCE_MOCK = {
  'Etihad Airways': [
    { checkId: 'uae-pdpl-residency', met: false },
    { checkId: 'cross-border-transfer', met: false },
    { checkId: 'dpa-registration', met: false },
  ],
  'AD Ports Group': [
    { checkId: 'sama-data-local', met: false },
    { checkId: 'cloud-sovereignty', met: false },
    { checkId: 'data-retention', met: false },
  ],
  'Aramex': [
    { checkId: 'uae-pdpl-residency', met: false },
    { checkId: 'consent-records', met: false },
    { checkId: 'processor-binding', met: false },
    { checkId: 'free-zone-local', met: false },
  ],
  'Saudi Aramco': [
    { checkId: 'ksa-pdpl-residency', met: false },
    { checkId: 'sama-data-local', met: false },
    { checkId: 'dpias', met: false },
  ],
  'Saudi Electricity': [
    { checkId: 'ksa-pdpl-residency', met: false },
    { checkId: 'cross-border-transfer', met: false },
  ],
  'Emirates NBD': [
    { checkId: 'cbuae-data-local', met: true },
    { checkId: 'dpa-registration', met: false },
    { checkId: 'breach-notification', met: true },
  ],
  'Dubai Islamic Bank (DIFC)': [
    { checkId: 'dfsa-data', met: false },
    { checkId: 'consent-records', met: false },
  ],
  'Abu Dhabi Securities Exchange (ADX)': [
    { checkId: 'uae-pdpl-residency', met: false },
    { checkId: 'cloud-sovereignty', met: false },
  ],
  'Emirates': [
    { checkId: 'uae-pdpl-residency', met: false },
    { checkId: 'processor-binding', met: false },
  ],
  'FAB (DIFC)': [
    { checkId: 'dfsa-data', met: false },
  ],
};

function getOpcoNonCompliances(opco, definitions) {
  const statuses = OPCO_COMPLIANCE_MOCK[opco] || [];
  const metByCheck = Object.fromEntries(statuses.map((s) => [s.checkId, s.met]));
  return definitions
    .filter((c) => !(metByCheck[c.id] ?? true))
    .map((c) => ({ ...c, severity: c.severity }));
}

/** Build Data Sovereignty summary string for M&A assessment PDF. */
export function getDataSovereigntySummaryForMa(opco) {
  const nonCompliances = getOpcoNonCompliances(opco, CHECK_DEFINITIONS);
  const inventory = OPCO_DATA_INVENTORY_MOCK[opco] || getDefaultInventory(opco);
  const parts = [];
  parts.push(`Data categories: ${(inventory.categories || []).join(', ')}. Sovereign cloud: ${inventory.sovereignCloudImplemented ? 'Yes' : 'No'}.`);
  if (nonCompliances.length === 0) {
    parts.push('No data sovereignty gaps identified for this OpCo.');
  } else {
    const bySeverity = { Critical: [], Medium: [], Low: [] };
    nonCompliances.forEach((c) => { if (bySeverity[c.severity]) bySeverity[c.severity].push(c.name); });
    if (bySeverity.Critical.length) parts.push(`Critical gaps: ${bySeverity.Critical.join('; ')}.`);
    if (bySeverity.Medium.length) parts.push(`Medium: ${bySeverity.Medium.join('; ')}.`);
    if (bySeverity.Low.length) parts.push(`Low: ${bySeverity.Low.join('; ')}.`);
  }
  return parts.join(' ');
}

export function DataSovereignty({ language = 'en', selectedParentHolding, companiesRefreshKey = 0 }) {
  const [opcos, setOpcos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState('all'); // all | Critical | Medium | Low | met

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
        const opcoList = list
          .filter(({ name }) => name && name !== selectedParentHolding)
          .filter(({ name }) => {
            if (seen.has(name)) return false;
            seen.add(name);
            return true;
          })
          .map(({ name, framework }) => ({ name, framework: framework || '' }));
        setOpcos(opcoList);
      })
      .catch(() => setOpcos([]))
      .finally(() => setLoading(false));
  }, [selectedParentHolding, companiesRefreshKey]);

  const opcoWithNonCompliance = useMemo(() => {
    return opcos.map(({ name }) => {
      const nonCompliances = getOpcoNonCompliances(name, CHECK_DEFINITIONS);
      return { opco: name, nonCompliances };
    });
  }, [opcos]);

  const grouped = useMemo(() => {
    const opcosWithCritical = opcoWithNonCompliance.filter(({ nonCompliances }) =>
      nonCompliances.some((c) => c.severity === 'Critical')
    );
    const opcosWithMedium = opcoWithNonCompliance.filter(({ nonCompliances }) =>
      nonCompliances.some((c) => c.severity === 'Medium')
    );
    const opcosWithLow = opcoWithNonCompliance.filter(({ nonCompliances }) =>
      nonCompliances.some((c) => c.severity === 'Low')
    );
    const opcosFullyMet = opcoWithNonCompliance.filter(({ nonCompliances }) => nonCompliances.length === 0);
    return {
      critical: opcosWithCritical,
      medium: opcosWithMedium,
      low: opcosWithLow,
      met: opcosFullyMet,
    };
  }, [opcoWithNonCompliance]);

  const filteredOpcos = useMemo(() => {
    if (filterSeverity === 'all') return opcoWithNonCompliance.filter(({ nonCompliances }) => nonCompliances.length > 0);
    if (filterSeverity === 'met') return grouped.met;
    if (filterSeverity === 'Critical') return grouped.critical;
    if (filterSeverity === 'Medium') return grouped.medium;
    if (filterSeverity === 'Low') return grouped.low;
    return [];
  }, [filterSeverity, grouped, opcoWithNonCompliance]);

  /** Data Classification & Inventory: per-OpCo row with categories, framework, localisation, sovereign cloud. */
  const dataClassificationRows = useMemo(() => {
    return opcos.map(({ name, framework }) => {
      const jurisdiction = getOpcoJurisdiction(name, framework);
      const frameworksForJurisdiction = DATA_FRAMEWORKS_BY_JURISDICTION.filter((f) => f.jurisdiction === jurisdiction);
      const localisationMandated = frameworksForJurisdiction.length > 0 && frameworksForJurisdiction.some((f) => f.localisationMandated);
      const sovereignCloudAvailable = frameworksForJurisdiction.some((f) => f.sovereignCloudAvailable);
      const inventory = OPCO_DATA_INVENTORY_MOCK[name] || getDefaultInventory(name);
      const governingFramework = getFrameworkForJurisdiction(
        jurisdiction,
        (inventory.categories || []).includes('Financial records')
      );
      return {
        opcoName: name,
        jurisdiction,
        governingFramework,
        dataCategories: inventory.categories || [],
        localisationMandated,
        sovereignCloudAvailable,
        sovereignCloudImplemented: inventory.sovereignCloudImplemented ?? false,
      };
    });
  }, [opcos]);

  /** C-level insight: OpCos holding sensitive personal data in jurisdictions where localisation is mandated and sovereign cloud is not yet implemented. */
  const classificationInsight = useMemo(() => {
    const sensitiveCategories = ['Personal data', 'Financial records', 'Health data'];
    const atRisk = dataClassificationRows.filter(
      (row) =>
        row.localisationMandated &&
        !row.sovereignCloudImplemented &&
        row.dataCategories.some((c) => sensitiveCategories.includes(c))
    );
    return {
      totalOpCos: dataClassificationRows.length,
      atRiskCount: atRisk.length,
      atRiskOpCos: atRisk.map((r) => r.opcoName),
    };
  }, [dataClassificationRows]);

  const handleCardSelect = (severity) => {
    setFilterSeverity(severity);
  };

  if (!selectedParentHolding) {
    return (
      <div className="data-sovereignty-section">
        <h2 className="data-sovereignty-title">Data Sovereignty</h2>
        <p className="data-sovereignty-intro">
          Per-OpCo compliance with data residency, localisation, cross-border transfer, and UAE/KSA/GCC frameworks.
        </p>
        <div className="data-sovereignty-empty data-sovereignty-empty-prompt">
          <p>Select a <strong>Parent Holding</strong> in the <strong>Parent Holding Overview</strong> section to view Data Sovereignty compliance for its OpCos.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="data-sovereignty-section">
        <h2 className="data-sovereignty-title">Data Sovereignty</h2>
        <p className="data-sovereignty-intro">Parent Holding: <strong>{selectedParentHolding}</strong></p>
        <p className="data-sovereignty-loading">Loading OpCos…</p>
      </div>
    );
  }

  return (
    <div className="data-sovereignty-section">
      <h2 className="data-sovereignty-title">Data Sovereignty</h2>
      <p className="data-sovereignty-intro">
        Per-OpCo compliance with data residency, localisation, cross-border transfer, and UAE/KSA/GCC frameworks. Select a severity card or use the dropdown to see which OpCos have not met compliance and which sections are not updated.
      </p>
      <div className="data-sovereignty-parent-banner">
        Parent Holding: <strong>{selectedParentHolding}</strong>
      </div>

      <div className="data-sovereignty-summary">
        <button
          type="button"
          className={`data-sovereignty-summary-card data-sovereignty-critical ${filterSeverity === 'Critical' ? 'data-sovereignty-card-selected' : ''}`}
          onClick={() => handleCardSelect('Critical')}
          aria-pressed={filterSeverity === 'Critical'}
        >
          <span className="data-sovereignty-summary-value">{grouped.critical.length}</span>
          <span className="data-sovereignty-summary-label">Critical</span>
        </button>
        <button
          type="button"
          className={`data-sovereignty-summary-card data-sovereignty-medium ${filterSeverity === 'Medium' ? 'data-sovereignty-card-selected' : ''}`}
          onClick={() => handleCardSelect('Medium')}
          aria-pressed={filterSeverity === 'Medium'}
        >
          <span className="data-sovereignty-summary-value">{grouped.medium.length}</span>
          <span className="data-sovereignty-summary-label">Medium</span>
        </button>
        <button
          type="button"
          className={`data-sovereignty-summary-card data-sovereignty-low ${filterSeverity === 'Low' ? 'data-sovereignty-card-selected' : ''}`}
          onClick={() => handleCardSelect('Low')}
          aria-pressed={filterSeverity === 'Low'}
        >
          <span className="data-sovereignty-summary-value">{grouped.low.length}</span>
          <span className="data-sovereignty-summary-label">Low</span>
        </button>
        <button
          type="button"
          className={`data-sovereignty-summary-card data-sovereignty-met ${filterSeverity === 'met' ? 'data-sovereignty-card-selected' : ''}`}
          onClick={() => handleCardSelect('met')}
          aria-pressed={filterSeverity === 'met'}
        >
          <span className="data-sovereignty-summary-value">{grouped.met.length}</span>
          <span className="data-sovereignty-summary-label">Met</span>
        </button>
      </div>

      <div className="data-sovereignty-filter">
        <label htmlFor="ds-severity-filter">Show</label>
        <select
          id="ds-severity-filter"
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
        >
          <option value="all">OpCos with any non-compliance</option>
          <option value="Critical">Critical only</option>
          <option value="Medium">Medium only</option>
          <option value="Low">Low only</option>
          <option value="met">Met only (fully compliant)</option>
        </select>
      </div>

      {filterSeverity === 'met' && filteredOpcos.length > 0 && (
        <div className="data-sovereignty-risks">
          <h3 className="data-sovereignty-risks-title">OpCos with all checks met</h3>
          <ul className="data-sovereignty-opco-list">
            {filteredOpcos.map(({ opco }) => (
              <li key={opco} className="data-sovereignty-opco-item data-sovereignty-item-met">
                <span className="data-sovereignty-opco-name">{opco}</span>
                <span className="data-sovereignty-opco-badge">All compliant</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {filterSeverity !== 'met' && filteredOpcos.length > 0 && (
        <div className="data-sovereignty-risks">
          <h3 className="data-sovereignty-risks-title">
            {filterSeverity === 'all' ? 'OpCos with non-compliance' : `OpCos with ${filterSeverity} non-compliance`}
          </h3>
          <ul className="data-sovereignty-list">
            {filteredOpcos.map(({ opco, nonCompliances }) => (
              <li key={opco} className="data-sovereignty-opco-card">
                <div className="data-sovereignty-opco-card-header">
                  <strong className="data-sovereignty-opco-name">{opco}</strong>
                  <span className="data-sovereignty-opco-count">{nonCompliances.length} section(s) not complied</span>
                </div>
                <ul className="data-sovereignty-check-sublist">
                  {nonCompliances.map((check) => (
                    <li key={check.id} className={`data-sovereignty-item data-sovereignty-severity-${(check.severity || '').toLowerCase()}`}>
                      <span className="data-sovereignty-item-severity">{check.severity}</span>
                      <div className="data-sovereignty-item-content">
                        <strong className="data-sovereignty-item-name">{check.name}</strong>
                        <span className="data-sovereignty-item-regulation">{check.regulation}</span>
                        <p className="data-sovereignty-item-desc">{check.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}

      {filteredOpcos.length === 0 && (
        <p className="data-sovereignty-empty">
          {filterSeverity === 'met'
            ? 'No OpCos with all checks met.'
            : `No OpCos match the selected criteria (${filterSeverity === 'all' ? 'none with non-compliance' : filterSeverity}).`}
        </p>
      )}

      <section className="data-sovereignty-classification-section">
        <h3 className="data-sovereignty-classification-title">Data Classification &amp; Inventory Visibility</h3>
        <p className="data-sovereignty-classification-intro">
          Map of data categories each OpCo holds (personal data, financial records, health data, employee data) against the regulatory framework governing it in that jurisdiction — UAE PDPL tiers, KSA SDAIA standards, CBUAE/SAMA data circulars, and GCC/ME frameworks.
        </p>

        {classificationInsight.totalOpCos > 0 && (
          <div className="data-sovereignty-c-level-insight">
            <span className="data-sovereignty-c-level-icon" aria-hidden>◉</span>
            <p className="data-sovereignty-c-level-text">
              Across <strong>{classificationInsight.totalOpCos}</strong> OpCo{classificationInsight.totalOpCos !== 1 ? 's' : ''},{' '}
              <strong>{classificationInsight.atRiskCount}</strong> hold sensitive personal data in jurisdictions where localisation is mandated and sovereign cloud is not yet implemented.
              {classificationInsight.atRiskCount > 0 && (
                <span className="data-sovereignty-c-level-detail">
                  {' '}OpCos to prioritise: {classificationInsight.atRiskOpCos.slice(0, 8).join(', ')}
                  {classificationInsight.atRiskOpCos.length > 8 ? ` and ${classificationInsight.atRiskOpCos.length - 8} more` : ''}.
                </span>
              )}
            </p>
          </div>
        )}

        <div className="data-sovereignty-inventory-wrap">
          <table className="data-sovereignty-inventory-table">
            <thead>
              <tr>
                <th>OpCo</th>
                <th>Jurisdiction</th>
                <th>Data categories held</th>
                <th>Governing framework</th>
                <th>Localisation mandated</th>
                <th>Sovereign cloud</th>
              </tr>
            </thead>
            <tbody>
              {dataClassificationRows.map((row) => (
                <tr
                  key={row.opcoName}
                  className={
                    row.localisationMandated && !row.sovereignCloudImplemented && row.dataCategories.length > 0
                      ? 'data-sovereignty-inventory-row-at-risk'
                      : ''
                  }
                >
                  <td>{row.opcoName}</td>
                  <td>{row.jurisdiction}</td>
                  <td>{row.dataCategories.length ? row.dataCategories.join(', ') : '—'}</td>
                  <td>{row.governingFramework}</td>
                  <td>{row.localisationMandated ? 'Yes' : 'No'}</td>
                  <td>
                    {row.sovereignCloudAvailable
                      ? row.sovereignCloudImplemented
                        ? 'Implemented'
                        : 'Not yet'
                      : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
