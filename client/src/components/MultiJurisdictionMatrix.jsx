import { useState, useEffect, useMemo } from 'react';
import './MultiJurisdictionMatrix.css';

const API = '/api';

/**
 * Free zones and jurisdictions in GCC / Middle East with details and applicable regulations.
 */
const FREE_ZONES_AND_JURISDICTIONS = [
  {
    id: 'DIFC',
    name: 'Dubai International Financial Centre',
    location: 'Dubai, UAE',
    type: 'Financial Free Zone',
    description: 'DIFC is an onshore financial free zone with its own legal and regulatory framework. It hosts banks, asset managers, insurers and fintech. The DFSA is the independent regulator.',
    regulations: [
      { name: 'DFSA Rulebook', category: 'Financial, Governance, AML', scope: 'Financial services, conduct of business, prudential, AML/CFT' },
    ],
  },
  {
    id: 'ADGM',
    name: 'Abu Dhabi Global Market',
    location: 'Abu Dhabi, UAE',
    type: 'Financial Free Zone',
    description: 'ADGM is a financial free zone on Al Maryah Island with its own civil and commercial law. FSRA regulates financial services; registration and AML rules apply.',
    regulations: [
      { name: 'ADGM FSRA Rulebook', category: 'Financial, Governance, AML', scope: 'Financial services, markets, AML/CFT' },
      { name: 'ADGM Companies Regulations', category: 'Governance', scope: 'Company registration and governance' },
    ],
  },
  {
    id: 'JAFZA',
    name: 'Jebel Ali Free Zone',
    location: 'Dubai, UAE',
    type: 'Trade & Logistics Free Zone',
    description: 'JAFZA is one of the largest free zones globally. It caters to trading, logistics and manufacturing with customs and licensing under Dubai free zone rules.',
    regulations: [
      { name: 'JAFZA Operating Regulations', category: 'Governance', scope: 'Licensing, customs, company setup' },
      { name: 'UAE AML/CFT (free zone)', category: 'AML', scope: 'AML obligations for designated entities' },
    ],
  },
  {
    id: 'DMCC',
    name: 'Dubai Multi Commodities Centre',
    location: 'Dubai, UAE',
    type: 'Commodities & Trade Free Zone',
    description: 'DMCC focuses on commodities trading, precious metals and related services. It has its own company and licensing regime.',
    regulations: [
      { name: 'DMCC Company Regulations', category: 'Governance', scope: 'Company formation and governance' },
      { name: 'DMCC Compliance & AML', category: 'AML', scope: 'AML/CFT for commodity and trading activities' },
    ],
  },
  {
    id: 'DUBAI_MAINLAND',
    name: 'Dubai (Mainland / Onshore)',
    location: 'Dubai, UAE',
    type: 'Onshore Jurisdiction',
    description: 'Dubai mainland is subject to UAE federal law and Dubai government regulations, including urban planning and sustainability under Dubai 2040.',
    regulations: [
      { name: 'Dubai 2040 Urban Master Plan', category: 'Governance', scope: 'Urban planning, sustainability, development' },
      { name: 'UAE Federal Laws', category: 'Governance', scope: 'Commercial, labour, AML where applicable' },
    ],
  },
  {
    id: 'AD_MAINLAND',
    name: 'Abu Dhabi (Mainland)',
    location: 'Abu Dhabi, UAE',
    type: 'Onshore Jurisdiction',
    description: 'Abu Dhabi mainland follows UAE federal law and local regulations. ADGM sits separately as a financial free zone.',
    regulations: [
      { name: 'UAE Federal Laws', category: 'Governance, Financial, AML', scope: 'Federal commercial, banking, AML' },
    ],
  },
  {
    id: 'SHARJAH',
    name: 'Sharjah (Free Zones & Mainland)',
    location: 'Sharjah, UAE',
    type: 'Free Zone & Onshore',
    description: 'Sharjah has multiple free zones (e.g. SAIF Zone) and mainland. Regulations align with UAE federal and local requirements.',
    regulations: [
      { name: 'Sharjah Free Zone Regulations', category: 'Governance', scope: 'Licensing and company setup' },
      { name: 'UAE Federal Laws', category: 'Governance, AML', scope: 'As applicable to mainland and zone' },
    ],
  },
  {
    id: 'RAS_AL_KHAIMAH',
    name: 'Ras Al Khaimah (RAK) Free Zones',
    location: 'Ras Al Khaimah, UAE',
    type: 'Free Zone',
    description: 'RAK has several free zones (RAK ICC, RAK Economic Zone) with company and licensing regulations.',
    regulations: [
      { name: 'RAK Free Zone Regulations', category: 'Governance', scope: 'Company registration, licensing' },
    ],
  },
  {
    id: 'KSA_ONShore',
    name: 'Saudi Arabia (Onshore / National)',
    location: 'Saudi Arabia (KSA)',
    type: 'Onshore Jurisdiction',
    description: 'National regulatory framework: SAMA (banking, insurance, AML), CMA (capital markets, governance), and sector regulators. Vision 2030 and SDAIA drive strategic and data/AI governance.',
    regulations: [
      { name: 'SAMA Regulations & AML Rules', category: 'Financial, AML', scope: 'Banking, insurance, AML/CFT' },
      { name: 'CMA Rules & Corporate Governance', category: 'Financial, Governance', scope: 'Securities, listing, governance' },
      { name: 'Vision 2030 / Strategic Frameworks', category: 'Governance', scope: 'Local content, Saudization, sector strategy' },
      { name: 'SDAIA / NDMO Data & AI Governance', category: 'Governance', scope: 'Data governance, AI ethics' },
    ],
  },
  {
    id: 'KSA_GIGA',
    name: 'Saudi Giga-Projects (NEOM, Red Sea, etc.)',
    location: 'Saudi Arabia (KSA)',
    type: 'Special Zones',
    description: 'Giga-projects may have special economic or regulatory arrangements under Vision 2030 and relevant authorities.',
    regulations: [
      { name: 'Vision 2030 / Project-Specific Regulations', category: 'Governance', scope: 'As per project and national law' },
    ],
  },
  {
    id: 'QATAR',
    name: 'Qatar Financial Centre (QFC) & Mainland',
    location: 'Qatar',
    type: 'Financial Free Zone & Onshore',
    description: 'QFC is a financial free zone; Qatar mainland is regulated by QCB and other authorities.',
    regulations: [
      { name: 'QFCRA Rules', category: 'Financial, Governance, AML', scope: 'Financial services in QFC' },
      { name: 'Qatar AML Law', category: 'AML', scope: 'National AML/CFT' },
    ],
  },
  {
    id: 'BAHRAIN',
    name: 'Bahrain (BHB, CBB)',
    location: 'Bahrain',
    type: 'Financial Hub & Onshore',
    description: 'Bahrain Bourse and Central Bank of Bahrain regulate listed entities and financial institutions; ESG and sustainability disclosures apply.',
    regulations: [
      { name: 'CBB Rulebook', category: 'Financial, AML', scope: 'Banking, insurance, AML' },
      { name: 'BHB Sustainability / ESG', category: 'Governance', scope: 'Listing and disclosure' },
    ],
  },
  {
    id: 'OMAN',
    name: 'Oman (CMA, MSM)',
    location: 'Oman',
    type: 'Onshore Jurisdiction',
    description: 'Capital Market Authority and Muscat Stock Exchange govern listed and financial entities.',
    regulations: [
      { name: 'Oman CMA Regulations', category: 'Financial, Governance', scope: 'Securities, governance' },
      { name: 'Oman AML Law', category: 'AML', scope: 'National AML/CFT' },
    ],
  },
  {
    id: 'KUWAIT',
    name: 'Kuwait (CMA, Boursa Kuwait)',
    location: 'Kuwait',
    type: 'Onshore Jurisdiction',
    description: 'Capital Markets Authority and Boursa Kuwait regulate capital markets and listed companies.',
    regulations: [
      { name: 'Kuwait CMA Regulations', category: 'Financial, Governance', scope: 'Securities, listing' },
      { name: 'Kuwait AML Law', category: 'AML', scope: 'National AML/CFT' },
    ],
  },
];

/** Map our framework keys to free zone / jurisdiction id for OpCo display. */
const FRAMEWORK_TO_ZONE_ID = {
  'DFSA Rulebook': 'DIFC',
  'Dubai 2040': 'DUBAI_MAINLAND',
  SAMA: 'KSA_ONShore',
  CMA: 'KSA_ONShore',
  'Saudi 2030': 'KSA_ONShore',
  SDAIA: 'KSA_ONShore',
  'ADGM FSRA Rulebook': 'ADGM',
  'ADGM Companies Regulations': 'ADGM',
  'CBUAE Rulebook': 'AD_MAINLAND',
  'UAE AML/CFT': 'AD_MAINLAND',
  'UAE Federal Laws': 'AD_MAINLAND',
  'JAFZA Operating Regulations': 'JAFZA',
  'DMCC Company Regulations': 'DMCC',
  'DMCC Compliance & AML': 'DMCC',
  'QFCRA Rules': 'QATAR',
  'Qatar AML Law': 'QATAR',
  'CBB Rulebook': 'BAHRAIN',
  'BHB Sustainability ESG': 'BAHRAIN',
  'Oman CMA Regulations': 'OMAN',
  'Oman AML Law': 'OMAN',
  'Kuwait CMA Regulations': 'KUWAIT',
  'Kuwait AML Law': 'KUWAIT',
};

const FRAMEWORK_META = {
  'DFSA Rulebook': {
    zoneId: 'DIFC',
    location: 'DIFC, Dubai, UAE',
    locationShort: 'DIFC (UAE)',
    categories: ['Financial', 'Governance', 'AML'],
    name: 'DFSA Rulebook',
    description: 'Dubai Financial Services Authority — financial services, conduct of business, prudential and AML/CFT in DIFC.',
  },
  'Dubai 2040': {
    zoneId: 'DUBAI_MAINLAND',
    location: 'Dubai, UAE',
    locationShort: 'Dubai (UAE)',
    categories: ['Governance'],
    name: 'Dubai 2040 Urban Master Plan',
    description: 'Urban planning, sustainability and development regulations in Dubai.',
  },
  SAMA: {
    zoneId: 'KSA_ONShore',
    location: 'Saudi Arabia (KSA)',
    locationShort: 'KSA',
    categories: ['Financial', 'AML'],
    name: 'SAMA Regulations & AML Rules',
    description: 'Saudi Central Bank — banking, insurance, AML/CFT and prudential regulation.',
  },
  CMA: {
    zoneId: 'KSA_ONShore',
    location: 'Saudi Arabia (KSA)',
    locationShort: 'KSA',
    categories: ['Financial', 'Governance'],
    name: 'CMA Rules & Corporate Governance',
    description: 'Capital Market Authority — securities, listing, corporate governance and disclosure.',
  },
  'Saudi 2030': {
    zoneId: 'KSA_ONShore',
    location: 'Saudi Arabia (KSA)',
    locationShort: 'KSA',
    categories: ['Governance'],
    name: 'Vision 2030 / Strategic Frameworks',
    description: 'Strategic initiatives, local content, Saudization and sector development.',
  },
  SDAIA: {
    zoneId: 'KSA_ONShore',
    location: 'Saudi Arabia (KSA)',
    locationShort: 'KSA',
    categories: ['Governance'],
    name: 'SDAIA / NDMO Data & AI Governance',
    description: 'Data governance, AI ethics and national data management.',
  },
  'ADGM FSRA Rulebook': {
    zoneId: 'ADGM',
    location: 'Abu Dhabi Global Market, UAE',
    locationShort: 'ADGM (UAE)',
    categories: ['Financial', 'Governance', 'AML'],
    name: 'ADGM FSRA Rulebook',
    description: 'ADGM Financial Services Regulatory Authority — financial services, markets and AML/CFT.',
  },
  'ADGM Companies Regulations': {
    zoneId: 'ADGM',
    location: 'Abu Dhabi Global Market, UAE',
    locationShort: 'ADGM (UAE)',
    categories: ['Governance'],
    name: 'ADGM Companies Regulations',
    description: 'Company registration and governance in ADGM.',
  },
  'CBUAE Rulebook': {
    zoneId: 'AD_MAINLAND',
    location: 'UAE (Federal)',
    locationShort: 'UAE',
    categories: ['Financial', 'AML'],
    name: 'CBUAE Rulebook',
    description: 'Central Bank of the UAE — federal banking, insurance, payment systems and AML/CFT.',
  },
  'UAE AML/CFT': {
    zoneId: 'AD_MAINLAND',
    location: 'UAE (Federal)',
    locationShort: 'UAE',
    categories: ['AML'],
    name: 'UAE AML/CFT',
    description: 'UAE Federal AML/CFT law and supervisory authority guidance.',
  },
  'UAE Federal Laws': {
    zoneId: 'AD_MAINLAND',
    location: 'UAE (Federal)',
    locationShort: 'UAE',
    categories: ['Governance', 'Financial', 'AML'],
    name: 'UAE Federal Laws',
    description: 'Federal commercial, labour and sector laws applicable to mainland and free zones.',
  },
  'JAFZA Operating Regulations': {
    zoneId: 'JAFZA',
    location: 'Jebel Ali Free Zone, Dubai, UAE',
    locationShort: 'JAFZA (UAE)',
    categories: ['Governance'],
    name: 'JAFZA Operating Regulations',
    description: 'Licensing, customs and company setup in Jebel Ali Free Zone.',
  },
  'DMCC Company Regulations': {
    zoneId: 'DMCC',
    location: 'DMCC, Dubai, UAE',
    locationShort: 'DMCC (UAE)',
    categories: ['Governance'],
    name: 'DMCC Company Regulations',
    description: 'Company formation and governance in Dubai Multi Commodities Centre.',
  },
  'DMCC Compliance & AML': {
    zoneId: 'DMCC',
    location: 'DMCC, Dubai, UAE',
    locationShort: 'DMCC (UAE)',
    categories: ['AML'],
    name: 'DMCC Compliance & AML',
    description: 'AML/CFT for commodity and trading activities in DMCC.',
  },
  'QFCRA Rules': {
    zoneId: 'QATAR',
    location: 'Qatar Financial Centre & Mainland',
    locationShort: 'Qatar',
    categories: ['Financial', 'Governance', 'AML'],
    name: 'QFCRA Rules',
    description: 'Qatar Financial Centre Regulatory Authority — financial services in QFC.',
  },
  'Qatar AML Law': {
    zoneId: 'QATAR',
    location: 'Qatar',
    locationShort: 'Qatar',
    categories: ['AML'],
    name: 'Qatar AML Law',
    description: 'National AML/CFT law and regulations.',
  },
  'CBB Rulebook': {
    zoneId: 'BAHRAIN',
    location: 'Bahrain',
    locationShort: 'Bahrain',
    categories: ['Financial', 'AML'],
    name: 'CBB Rulebook',
    description: 'Central Bank of Bahrain — banking, insurance and AML/CFT.',
  },
  'BHB Sustainability ESG': {
    zoneId: 'BAHRAIN',
    location: 'Bahrain',
    locationShort: 'Bahrain',
    categories: ['Governance'],
    name: 'BHB Sustainability / ESG',
    description: 'Bahrain Bourse listing and sustainability/ESG disclosure requirements.',
  },
  'Oman CMA Regulations': {
    zoneId: 'OMAN',
    location: 'Oman',
    locationShort: 'Oman',
    categories: ['Financial', 'Governance'],
    name: 'Oman CMA Regulations',
    description: 'Oman Capital Market Authority — securities and corporate governance.',
  },
  'Oman AML Law': {
    zoneId: 'OMAN',
    location: 'Oman',
    locationShort: 'Oman',
    categories: ['AML'],
    name: 'Oman AML Law',
    description: 'National AML/CFT law and regulations.',
  },
  'Kuwait CMA Regulations': {
    zoneId: 'KUWAIT',
    location: 'Kuwait',
    locationShort: 'Kuwait',
    categories: ['Financial', 'Governance'],
    name: 'Kuwait CMA Regulations',
    description: 'Kuwait Capital Markets Authority — securities and listing.',
  },
  'Kuwait AML Law': {
    zoneId: 'KUWAIT',
    location: 'Kuwait',
    locationShort: 'Kuwait',
    categories: ['AML'],
    name: 'Kuwait AML Law',
    description: 'National AML/CFT law and regulations.',
  },
};

const GCC_FRAMEWORKS = Object.keys(FRAMEWORK_META);

const zoneById = Object.fromEntries(
  FREE_ZONES_AND_JURISDICTIONS.map((z) => [z.id, z])
);

export function MultiJurisdictionMatrix({ language = 'en', selectedParentHolding, companiesRefreshKey = 0 }) {
  const [opcos, setOpcos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterMultiRegion, setFilterMultiRegion] = useState(false); // when true, show only OpCos operating in multiple regions

  useEffect(() => {
    if (!selectedParentHolding) {
      setOpcos([]);
      return;
    }
    setLoading(true);
    fetch(`${API}/companies/by-parent?parent=${encodeURIComponent(selectedParentHolding)}`)
      .then((r) => r.json())
      .then((data) => {
        const list = (data.opcos || []).filter((item) =>
          GCC_FRAMEWORKS.includes(item.framework) ||
          (Array.isArray(item.locations) && item.locations.length > 0)
        );
        setOpcos(list);
      })
      .catch(() => setOpcos([]))
      .finally(() => setLoading(false));
  }, [selectedParentHolding, companiesRefreshKey]);

  const [frameworkLocationOpen, setFrameworkLocationOpen] = useState({});

  const rows = useMemo(() => {
    const out = [];
    for (const item of opcos) {
      if (Array.isArray(item.locations) && item.locations.length > 0) {
        out.push({
          opcoName: item.name,
          fromLicence: true,
          locations: item.locations,
          applicableFrameworks: Array.isArray(item.applicableFrameworks) ? item.applicableFrameworks : [],
          applicableFrameworksByLocation: Array.isArray(item.applicableFrameworksByLocation) ? item.applicableFrameworksByLocation : [],
        });
      } else {
        const meta = FRAMEWORK_META[item.framework];
        if (!meta) continue;
        const zone = zoneById[meta.zoneId];
        out.push({
          opcoName: item.name,
          fromLicence: false,
          zoneId: meta.zoneId,
          zone,
          location: meta.location,
          locationShort: meta.locationShort,
          categories: meta.categories.join(', '),
          frameworkName: meta.name,
          description: meta.description,
        });
      }
    }
    return out;
  }, [opcos]);

  const opcoToLocations = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      if (!map[r.opcoName]) map[r.opcoName] = new Set();
      if (r.fromLicence && r.locations) {
        r.locations.forEach((loc) => map[r.opcoName].add(loc));
      } else if (r.location) {
        map[r.opcoName].add(r.location);
      }
    });
    return map;
  }, [rows]);

  const opcoToZones = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      if (!map[r.opcoName]) map[r.opcoName] = [];
      if (!r.fromLicence && r.zone && !map[r.opcoName].some((z) => z.id === r.zone.id)) {
        map[r.opcoName].push(r.zone);
      }
    });
    return map;
  }, [rows]);

  const opcoToFrameworks = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      if (!map[r.opcoName]) map[r.opcoName] = [];
      if (r.fromLicence) {
        const pairs = r.applicableFrameworksByLocation && r.applicableFrameworksByLocation.length > 0
          ? r.applicableFrameworksByLocation
          : (r.applicableFrameworks || []).map((fwName) => ({ framework: fwName, location: null, category: null }));
        pairs.forEach((p) => {
          const fwName = typeof p === 'object' && p && typeof p.framework === 'string' ? p.framework : String(p);
          const location = typeof p === 'object' && p && p.location != null ? p.location : null;
          const category = typeof p === 'object' && p && p.category != null && String(p.category).trim() ? String(p.category).trim() : 'From sector & location (LLM)';
          map[r.opcoName].push({
            zone: null,
            zoneId: null,
            location: location ?? '',
            categories: category,
            frameworkName: fwName,
            description: 'Applicable per sector of operation and licence location(s).',
          });
        });
      } else {
        map[r.opcoName].push({
          zone: r.zone,
          zoneId: r.zoneId,
          location: r.location,
          categories: r.categories,
          frameworkName: r.frameworkName,
          description: r.description,
        });
      }
    });
    return map;
  }, [rows]);

  const uniqueOpcos = useMemo(() => {
    const set = new Set(rows.map((r) => r.opcoName));
    return Array.from(set);
  }, [rows]);

  /** OpCos in multiple regions: 2+ zones (framework-based) or 2+ locations (licence-based). */
  const multiRegionOpcos = useMemo(() => {
    return uniqueOpcos.filter((name) => {
      const zones = opcoToZones[name] || [];
      const locs = opcoToLocations[name];
      const locCount = locs ? locs.size : 0;
      return zones.length > 1 || locCount > 1;
    });
  }, [uniqueOpcos, opcoToZones, opcoToLocations]);

  const displayedOpcos = filterMultiRegion ? multiRegionOpcos : uniqueOpcos;

  return (
    <div className="multi-jurisdiction-matrix">
      <h2 className="mjm-title">Multi Jurisdiction Matrix</h2>
      <p className="mjm-intro">
        All OpCos for the selected Parent Holding with operations across the <strong>GCC and Middle East</strong>, including <strong>Free Zones and jurisdictions</strong>. For each OpCo: <strong>free zone / jurisdiction details</strong>, <strong>locations</strong> of operations, and <strong>applicable regulations</strong> for those zones.
      </p>

      {!selectedParentHolding ? (
        <div className="mjm-empty">
          <p>Select a <strong>Parent Holding company</strong> in the <strong>Parent Holding Overview</strong> section to see OpCos, free zones and applicable regulations.</p>
        </div>
      ) : loading ? (
        <div className="mjm-loading">Loading OpCos…</div>
      ) : uniqueOpcos.length === 0 ? (
        <div className="mjm-empty">
          <p>No OpCos with <strong>GCC / Middle East operations</strong> found for <strong>{selectedParentHolding}</strong>.</p>
        </div>
      ) : (
        <>
          <p className="mjm-parent-label">
            Parent: <strong>{selectedParentHolding}</strong> — {uniqueOpcos.length} OpCo{uniqueOpcos.length !== 1 ? 's' : ''} with operations across GCC and Middle East
          </p>

          <div className="mjm-cards">
            <button
              type="button"
              className={`mjm-card mjm-card-all ${!filterMultiRegion ? 'mjm-card-selected' : ''}`}
              onClick={() => setFilterMultiRegion(false)}
              aria-pressed={!filterMultiRegion}
            >
              <span className="mjm-card-value">{uniqueOpcos.length}</span>
              <span className="mjm-card-label">All OpCos</span>
            </button>
            <button
              type="button"
              className={`mjm-card mjm-card-multi-region ${filterMultiRegion ? 'mjm-card-selected' : ''}`}
              onClick={() => setFilterMultiRegion(true)}
              aria-pressed={filterMultiRegion}
              title="OpCos operating in multiple countries or trade zones"
            >
              <span className="mjm-card-value">{multiRegionOpcos.length}</span>
              <span className="mjm-card-label">OpCos in multiple regions</span>
            </button>
          </div>

          {filterMultiRegion && multiRegionOpcos.length === 0 && (
            <p className="mjm-empty-inline">
              No OpCos in this parent operate in multiple countries or trade zones.
            </p>
          )}

          {displayedOpcos.map((opcoName) => (
            <div key={opcoName} className="mjm-opco-block">
              <h3 className="mjm-opco-name">{opcoName}</h3>
              <p className="mjm-opco-locations">
                <strong>Locations of operations:</strong>{' '}
                {Array.from(opcoToLocations[opcoName] || []).join('; ')}
              </p>

              <h4 className="mjm-opco-subtitle">Free Zones & Jurisdictions where this entity operates</h4>
              {(opcoToZones[opcoName] || []).length > 0 ? (opcoToZones[opcoName] || []).map((zone) => (
                <div key={zone.id} className="mjm-zone-detail">
                  <div className="mjm-zone-header">
                    <span className="mjm-zone-name">{zone.name}</span>
                    <span className="mjm-zone-type">{zone.type}</span>
                    <span className="mjm-zone-loc">{zone.location}</span>
                  </div>
                  <p className="mjm-zone-desc">{zone.description}</p>
                  <p className="mjm-zone-regs-title">Applicable regulations for this zone:</p>
                  <ul className="mjm-zone-regs">
                    {zone.regulations.map((reg, i) => (
                      <li key={i}>
                        <strong>{reg.name}</strong> ({reg.category}) — {reg.scope}
                      </li>
                    ))}
                  </ul>
                </div>
              )) : (opcoToLocations[opcoName] && opcoToLocations[opcoName].size > 0) ? (
                <p className="mjm-opco-licence-note">Regions from <strong>Regional Branch Commercial Licence</strong> (see locations above). Applicable frameworks evaluated by LLM from sector of operation and these locations.</p>
              ) : null}

              <div className="mjm-frameworks-cards">
                {(() => {
                  const list = opcoToFrameworks[opcoName] || [];
                  if (list.length === 0) {
                    return <p className="mjm-frameworks-empty">No frameworks have been evaluated yet for this entity.</p>;
                  }
                  const grouped = list.reduce((acc, fw) => {
                    const locLabel = (fw.location && String(fw.location).trim()) || 'Unspecified location';
                    if (!acc[locLabel]) acc[locLabel] = [];
                    acc[locLabel].push(fw);
                    return acc;
                  }, {});
                  return Object.entries(grouped).map(([locLabel, group], idx) => {
                    const key = `${opcoName}::${locLabel}`;
                    const isOpen = !!frameworkLocationOpen[key];
                    const zoneName = group.find((fw) => fw.zone && fw.zone.name)?.zone?.name || group[0].zoneId || '';
                    return (
                      <div key={key} className="mjm-framework-card">
                        <button
                          type="button"
                          className="mjm-framework-card-header"
                          onClick={() =>
                            setFrameworkLocationOpen((prev) => ({
                              ...prev,
                              [key]: !prev[key],
                            }))
                          }
                          aria-expanded={isOpen}
                        >
                          <div className="mjm-framework-card-main">
                            <span className="mjm-framework-card-location">{locLabel}</span>
                            {zoneName && <span className="mjm-framework-card-zone">{zoneName}</span>}
                          </div>
                          <div className="mjm-framework-card-meta">
                            <span className="mjm-framework-card-count">
                              {group.length} framework{group.length !== 1 ? 's' : ''}
                            </span>
                            <span className="mjm-framework-card-chevron" aria-hidden="true">
                              {isOpen ? '▾' : '▸'}
                            </span>
                          </div>
                        </button>
                        {isOpen && (
                          <div className="mjm-framework-card-body">
                            <ul className="mjm-framework-card-list">
                              {group.map((fw, i) => (
                                <li key={i} className="mjm-framework-card-item">
                                  <div className="mjm-framework-card-item-header">
                                    <strong className="mjm-framework-card-name">{fw.frameworkName}</strong>
                                    {fw.categories && (
                                      <span className="mjm-framework-card-categories">{fw.categories}</span>
                                    )}
                                  </div>
                                  {fw.description && (
                                    <p className="mjm-framework-card-desc">{fw.description}</p>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          ))}

          <div className="mjm-legend">
            <h4>GCC / Middle East frameworks by category</h4>
            <ul>
              <li><strong>Financial</strong> — Banking, capital markets, prudential (e.g. DFSA, SAMA, CMA)</li>
              <li><strong>Governance</strong> — Corporate governance, disclosure, strategy (e.g. CMA, Dubai 2040, Saudi 2030, SDAIA)</li>
              <li><strong>AML</strong> — Anti‑money laundering / CFT (e.g. DFSA, SAMA)</li>
              <li><strong>Other</strong> — Sector-specific (data, AI, urban planning)</li>
            </ul>
          </div>

        </>
      )}
    </div>
  );
}
