import { useState, useEffect, useMemo, useRef } from 'react';
import './UltimateBeneficiaryOwner.css';

const API = '/api';
const STORAGE_KEY = 'ubo_register';

/** Mandatory UBO register fields per UAE/CBUAE and GCC ME regulations. */
const MANDATORY_UBO_FIELDS = [
  { id: 'fullName', label: 'Full name (as per ID)', required: true },
  { id: 'nationality', label: 'Nationality', required: true },
  { id: 'dateOfBirth', label: 'Date of birth', required: true, type: 'date' },
  { id: 'placeOfBirth', label: 'Place of birth', required: true },
  { id: 'idType', label: 'ID type (Passport / National ID)', required: true },
  { id: 'idNumber', label: 'ID number', required: true },
  { id: 'idCountryOfIssue', label: 'Country of issuance', required: true },
  { id: 'idExpiry', label: 'ID expiry date', required: true, type: 'date' },
  { id: 'address', label: 'Residential address or address for notices', required: true },
  { id: 'countryOfResidence', label: 'Country of residence', required: true },
  { id: 'percentageOwnership', label: 'Percentage ownership / control', required: true },
  { id: 'natureOfControl', label: 'Nature of control (ownership / voting / other means)', required: true },
  { id: 'dateBecameBeneficialOwner', label: 'Date became beneficial owner', required: true, type: 'date' },
];

/** Mandatory documents for UBO compliance in the Middle East (UAE, KSA, GCC). */
const MANDATORY_UBO_DOCUMENTS = [
  { id: 'passport_or_id', label: 'Passport or National ID (copy)', description: 'Valid, clear copy of passport or national ID' },
  { id: 'proof_of_address', label: 'Proof of address', description: 'Utility bill or bank statement (within 3 months)' },
  { id: 'ownership_structure', label: 'Ownership structure document', description: 'Diagram or table showing ownership chain up to UBO' },
  { id: 'board_resolution', label: 'Board resolution / authorization', description: 'Authorizing disclosure and registration of UBO' },
  { id: 'register_of_beneficiaries', label: 'Register of Beneficiaries', description: 'Official corporate document reflecting the ultimate beneficial owner(s)' },
  { id: 'ubo_declaration', label: 'UBO declaration form', description: 'Signed declaration of beneficial ownership' },
  { id: 'company_extract', label: 'Company extract / trade license', description: 'Current extract or license of the entity' },
];

/** UAE Trade Registry (traderegistry.ae) modules: look up, download, add records. Maps to UBO document ids for "Apply to UBO". */
const TRADE_REGISTRY_URL = 'https://traderegistry.ae/';
const TRADE_REGISTRY_MODULES = [
  { id: 'ownership_structure_chart', label: 'Ownership Structure Chart', uboDocId: 'ownership_structure' },
  { id: 'register_of_directors', label: 'Register of Directors', uboDocId: 'board_resolution' },
  { id: 'register_of_beneficiaries', label: 'Register of Beneficiaries', uboDocId: 'register_of_beneficiaries' },
  { id: 'ubo_declaration', label: 'UBO Declaration', uboDocId: 'ubo_declaration' },
];

function loadUboRegister() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

function saveUboRegister(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (_) {}
}

function getUboKey(parent, opco) {
  return `${parent || ''}::${opco || ''}`;
}

/** Structured UBO data for target OpCo (M&A PDF). Reads from localStorage. */
export function getUboDataForMa(parent, opco) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    const key = getUboKey(parent, opco);
    const rec = data[key];
    if (!rec) return null;
    const docs = rec.documents || [];
    const completed = docs.filter((d) => d.uploaded || d.completed).length;
    const total = MANDATORY_UBO_DOCUMENTS.length;
    return {
      status: rec.status || '',
      percentage: rec.percentage != null ? rec.percentage : null,
      lastUpdated: rec.lastUpdated || '',
      notes: rec.notes || '',
      documentsCompleted: completed,
      totalDocuments: total,
      details: rec.details && typeof rec.details === 'object' ? rec.details : {},
    };
  } catch (_) {
    return null;
  }
}

/** Build a short UBO summary string for M&A assessment PDF (reads from localStorage). */
export function getUboSummaryForMa(parent, opco) {
  const data = getUboDataForMa(parent, opco);
  if (!data) return '';
  const parts = [];
  if (data.status) parts.push(`UBO register status: ${data.status}`);
  if (data.percentage != null) parts.push(`Holding: ${data.percentage}%`);
  if (data.lastUpdated) parts.push(`Last updated: ${data.lastUpdated}`);
  if (data.notes) parts.push(`Notes: ${data.notes}`);
  parts.push(`Mandatory documents: ${data.documentsCompleted}/${data.totalDocuments} completed.`);
  if (data.details?.fullName) parts.push(`UBO name: ${data.details.fullName}`);
  return parts.join(' ');
}

const REGISTRY_STORAGE_KEY = 'ubo_registry_records';
const UBO_CHANGES_STORAGE_KEY = 'ubo_changes_log';
const UBO_CHANGES_MAX = 100;

function loadUboChanges() {
  try {
    const raw = localStorage.getItem(UBO_CHANGES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

function addUboChange(parent, opco, message) {
  try {
    const prev = loadUboChanges();
    const next = [{ at: new Date().toISOString(), parent: parent || '', opco: opco || '', message: message || '' }, ...prev].slice(0, UBO_CHANGES_MAX);
    localStorage.setItem(UBO_CHANGES_STORAGE_KEY, JSON.stringify(next));
  } catch (_) {}
}

function loadRegistryRecords() {
  try {
    const raw = localStorage.getItem(REGISTRY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

function saveRegistryRecords(data) {
  try {
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(data));
  } catch (_) {}
}

function getRegistryRecordKey(parent, opco, moduleId) {
  return `${parent || ''}::${opco || ''}::${moduleId || ''}`;
}

const STATUS_OPTIONS = [
  { value: 'Updated', label: 'Updated' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Not updated', label: 'Not updated' },
];

const DEFAULT_DETAILS = Object.fromEntries(
  MANDATORY_UBO_FIELDS.map((f) => [f.id, ''])
);

const DEFAULT_DOCUMENTS = MANDATORY_UBO_DOCUMENTS.map((d) => ({
  ...d,
  uploaded: false,
  fileName: '',
  uploadedAt: '',
}));

export function UltimateBeneficiaryOwner({ language = 'en', selectedParentHolding, companiesRefreshKey = 0 }) {
  const [opcos, setOpcos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uboData, setUboData] = useState(loadUboRegister);
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingOpco, setEditingOpco] = useState(null);
  const [viewingOpco, setViewingOpco] = useState(null);
  const [activeTab, setActiveTab] = useState('register');
  const [opcoLookupQuery, setOpcoLookupQuery] = useState('');
  const [opcoLookupResults, setOpcoLookupResults] = useState([]);
  const [allParentOpcos, setAllParentOpcos] = useState({});
  const [opcoLookupLoading, setOpcoLookupLoading] = useState(false);
  const [expandedLookupOpcos, setExpandedLookupOpcos] = useState(() => new Set()); // register | structure | documents
  const [form, setForm] = useState({
    percentage: 100,
    status: 'Not updated',
    lastUpdated: '',
    notes: '',
    details: { ...DEFAULT_DETAILS },
    documents: JSON.parse(JSON.stringify(DEFAULT_DOCUMENTS)),
  });
  const [extractLoading, setExtractLoading] = useState(false);
  const [extractMessage, setExtractMessage] = useState('');
  const fileInputRef = useRef(null);
  const [registryRecords, setRegistryRecords] = useState(loadRegistryRecords);
  const [registryModal, setRegistryModal] = useState(null); // { moduleId, moduleLabel } when adding a record
  const [registryForm, setRegistryForm] = useState({ opco: '', summary: '', fileName: '', applyToUbo: true });
  const [parentOpcoCount, setParentOpcoCount] = useState(0);
  const [multiShareholderOpcos, setMultiShareholderOpcos] = useState([]);
  const [selectedStructureOpco, setSelectedStructureOpco] = useState(null);
  const [expandedStructureOpcos, setExpandedStructureOpcos] = useState(() => new Set());
  const [structureFilter, setStructureFilter] = useState('all'); // 'all' | 'multi-ubo'
  const [expandedMandatoryOpcos, setExpandedMandatoryOpcos] = useState(() => new Set());
  const [showViewChanges, setShowViewChanges] = useState(false);
  const [uboChanges, setUboChanges] = useState(loadUboChanges);
  const [expandedRegisterOpcos, setExpandedRegisterOpcos] = useState(() => new Set());

  useEffect(() => {
    // Reload UBO register whenever upstream company data refreshes,
    // so onboarding updates and UBO edits are reflected consistently.
    setUboData(loadUboRegister());
  }, [companiesRefreshKey]);

  useEffect(() => {
    setRegistryRecords(loadRegistryRecords());
  }, []);

  useEffect(() => {
    fetch(`${API}/companies/parent-opco-counts`)
      .then((r) => r.json())
      .then((data) => {
        const item = (data.parents || []).find((p) => p.parent === selectedParentHolding);
        setParentOpcoCount(item ? item.opcoCount : 0);
      })
      .catch(() => setParentOpcoCount(0));
  }, [selectedParentHolding, companiesRefreshKey]);

  useEffect(() => {
    // Derive multi-shareholder OpCos from the UBO register itself (localStorage),
    // so that onboarding structures and manual edits are always reflected here.
    const THRESHOLD = 25;
    const byOpco = new Map();
    Object.entries(uboData || {}).forEach(([key, rec]) => {
      const [parent, opco] = key.split('::');
      if (!parent || !opco) return;
      const pct = rec.percentage ?? 100;
      if (!byOpco.has(opco)) byOpco.set(opco, []);
      byOpco.get(opco).push({ parent, percentage: pct });
    });
    const result = [];
    for (const [opco, shareholders] of byOpco.entries()) {
      const withEnough = shareholders.filter((s) => (s.percentage ?? 0) >= THRESHOLD);
      if (withEnough.length >= 2) {
        result.push({ opco, shareholders });
      }
    }
    setMultiShareholderOpcos(result);
  }, [uboData]);

  useEffect(() => {
    // Derive parent → OpCos map directly from UBO register so onboarding entries are included.
    const map = {};
    Object.keys(uboData || {}).forEach((key) => {
      const [parent, opco] = key.split('::');
      if (!parent || !opco) return;
      if (!map[parent]) map[parent] = new Set();
      map[parent].add(opco);
    });
    const obj = {};
    Object.entries(map).forEach(([parent, set]) => {
      obj[parent] = Array.from(set).sort();
    });
    setAllParentOpcos(obj);
  }, [uboData, companiesRefreshKey]);

  useEffect(() => {
    if (!selectedParentHolding) {
      setOpcos([]);
      return;
    }
    setLoading(true);
    fetch(`${API}/companies/by-parent?parent=${encodeURIComponent(selectedParentHolding)}`)
      .then((r) => r.json())
      .then((data) => {
        const list = data.opcos || [];
        const seen = new Set();
        const unique = list.filter(({ name }) => {
          if (seen.has(name)) return false;
          seen.add(name);
          return true;
        });
        setOpcos(unique.map(({ name }) => name));
      })
      .catch(() => setOpcos([]))
      .finally(() => setLoading(false));
  }, [selectedParentHolding, companiesRefreshKey]);

  const getRecord = (opco) => {
    const keyForSelectedParent = getUboKey(selectedParentHolding, opco);
    const rawForSelectedParent = uboData[keyForSelectedParent];

    // Gather all UBO records for this OpCo across all parents.
    const allMatches = Object.entries(uboData || {}).filter(([key]) => {
      const [, opcoName] = key.split('::');
      return opcoName === opco;
    });

    // If there are no matches at all, fall back to the default accessor.
    if (!allMatches.length && !rawForSelectedParent) {
      return getRecordFor(selectedParentHolding, opco);
    }

    // Determine which record to use for percentage/status:
    // - Prefer the record for the currently selected parent.
    // - Otherwise, fall back to the first matching record.
    const baseRaw =
      rawForSelectedParent || (allMatches.length ? allMatches[0][1] : {});

    // Determine the record with the latest lastUpdated timestamp to source
    // canonical certificate details and lastUpdated for the drawer.
    let latestRecord = null;
    let latestDate = null;
    for (const [, rec] of allMatches) {
      const d = rec && rec.lastUpdated ? new Date(rec.lastUpdated) : null;
      if (!d || Number.isNaN(d.getTime())) continue;
      if (!latestDate || d > latestDate) {
        latestDate = d;
        latestRecord = rec;
      }
    }

    const recordForDetails = latestRecord || baseRaw || {};

    return {
      percentage:
        baseRaw && baseRaw.percentage !== undefined
          ? baseRaw.percentage
          : 100,
      status: baseRaw && baseRaw.status ? baseRaw.status : 'Not updated',
      lastUpdated: recordForDetails.lastUpdated || '',
      notes: baseRaw && baseRaw.notes ? baseRaw.notes : '',
      details: recordForDetails.details
        ? { ...DEFAULT_DETAILS, ...recordForDetails.details }
        : { ...DEFAULT_DETAILS },
      documents:
        Array.isArray(baseRaw && baseRaw.documents) &&
        (baseRaw.documents || []).length
          ? MANDATORY_UBO_DOCUMENTS.map((d) => {
              const docsArray = baseRaw.documents || [];
              const doc =
                docsArray.find((x) => x.id === d.id) || {
                  ...d,
                  uploaded: false,
                  fileName: '',
                  uploadedAt: '',
                };
              return { ...d, ...doc };
            })
          : JSON.parse(JSON.stringify(DEFAULT_DOCUMENTS)),
    };
  };

  const runOpcoLookup = () => {
    const q = (opcoLookupQuery || '').trim().toLowerCase();
    if (!q) {
      setOpcoLookupResults([]);
      return;
    }
    setOpcoLookupLoading(true);
    const parentOpcos = allParentOpcos || {};
    const matches = [];
    for (const [parent, opcoList] of Object.entries(parentOpcos)) {
      if (!Array.isArray(opcoList)) continue;
      for (const opco of opcoList) {
        if (opco && opco.toLowerCase().includes(q)) {
          matches.push({ parent, opco, record: getRecordFor(parent, opco) });
        }
      }
    }
    const byOpco = new Map();
    for (const m of matches) {
      if (!byOpco.has(m.opco)) byOpco.set(m.opco, []);
      byOpco.get(m.opco).push({ parent: m.parent, record: m.record });
    }
    const results = Array.from(byOpco.entries())
      .map(([opco, parents]) => ({ opco, parents }))
      .sort((a, b) => a.opco.localeCompare(b.opco));
    setOpcoLookupResults(results);
    setExpandedLookupOpcos(new Set());
    setOpcoLookupLoading(false);
  };

  const getRecordFor = (parent, opco) => {
    const key = getUboKey(parent, opco);
    const r = uboData[key] || {};
    return {
      percentage: r.percentage ?? 100,
      status: r.status || 'Not updated',
      lastUpdated: r.lastUpdated || '',
      notes: r.notes || '',
      details: r.details ? { ...DEFAULT_DETAILS, ...r.details } : { ...DEFAULT_DETAILS },
      documents: Array.isArray(r.documents) && r.documents.length
        ? MANDATORY_UBO_DOCUMENTS.map((d) => {
            const doc = r.documents.find((x) => x.id === d.id) || { ...d, uploaded: false, fileName: '', uploadedAt: '' };
            return { ...d, ...doc };
          })
        : JSON.parse(JSON.stringify(DEFAULT_DOCUMENTS)),
    };
  };

  const saveRecord = (opco, record) => {
    const key = getUboKey(selectedParentHolding, opco);
    const prev = getRecord(opco);
    const next = {
      ...uboData,
      [key]: {
        percentage: record.percentage ?? prev.percentage,
        status: record.status ?? prev.status,
        lastUpdated: record.lastUpdated ?? prev.lastUpdated,
        notes: record.notes !== undefined ? record.notes : prev.notes,
        details: record.details ? { ...prev.details, ...record.details } : prev.details,
        documents: record.documents ? record.documents : prev.documents,
      },
    };
    setUboData(next);
    saveUboRegister(next);
    setEditingOpco(null);
    setForm({
      percentage: 100,
      status: 'Not updated',
      lastUpdated: '',
      notes: '',
      details: { ...DEFAULT_DETAILS },
      documents: JSON.parse(JSON.stringify(DEFAULT_DOCUMENTS)),
    });
  };

  const openEdit = (opco) => {
    const r = getRecord(opco);
    setForm({
      percentage: r.percentage ?? 100,
      status: r.status || 'Not updated',
      lastUpdated: r.lastUpdated || '',
      notes: r.notes || '',
      details: { ...DEFAULT_DETAILS, ...r.details },
      documents: r.documents.map((d) => ({ ...d })),
    });
    setEditingOpco(opco);
    setExtractMessage('');
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtractLoading(true);
    setExtractMessage('');
    const fd = new FormData();
    fd.append('file', file);
    fetch(`${API}/ubo/extract`, { method: 'POST', body: fd })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        if (data.extracted) {
          setForm((f) => ({
            ...f,
            details: { ...f.details, ...data.extracted },
          }));
        }
        setExtractMessage(data.message || 'Extraction complete.');
      })
      .catch((err) => setExtractMessage(err.message || 'Extraction failed.'))
      .finally(() => {
        setExtractLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      });
  };

  const markDocumentUploaded = (docId, fileName) => {
    const doc = form.documents.find((d) => d.id === docId);
    if (!doc) return;
    setForm((f) => ({
      ...f,
      documents: f.documents.map((d) =>
        d.id === docId
          ? { ...d, uploaded: true, fileName: fileName || d.fileName, uploadedAt: new Date().toISOString().slice(0, 10) }
          : d
      ),
    }));
  };

  const filteredOpcos = useMemo(() => {
    if (statusFilter === 'all') return opcos;
    return opcos.filter((opco) => getRecord(opco).status === statusFilter);
  }, [opcos, statusFilter, uboData]);

  const summary = useMemo(() => {
    const total = opcos.length;
    const updated = opcos.filter((opco) => getRecord(opco).status === 'Updated').length;
    const pending = opcos.filter((opco) => getRecord(opco).status === 'Pending').length;
    const notUpdated = opcos.filter((opco) => getRecord(opco).status === 'Not updated').length;
    return { total, updated, pending, notUpdated };
  }, [opcos, uboData]);

  // Normalise a parent holding / entity name so that only the legal entity
  // or person name remains (without trailing jurisdiction/location labels).
  function cleanParentEntityName(raw) {
    if (!raw || typeof raw !== 'string') return '';
    let name = raw.trim();
    if (!name) return '';

    // Strip anything in parentheses at the end, e.g. "Alpha Holdings (Cayman Islands)".
    const parenIndex = name.indexOf('(');
    if (parenIndex > 0) {
      name = name.slice(0, parenIndex).trim();
    }

    const jurisTokens = [
      'DIFC',
      'ADGM',
      'MAINLAND UAE',
      'UAE',
      'KSA',
      'SAUDI ARABIA',
      'QATAR',
      'BAHRAIN',
      'OMAN',
      'KUWAIT',
      'CAYMAN ISLANDS',
      'CAYMAN',
      'BRITISH VIRGIN ISLANDS',
      'BVI',
      'DUBAI',
      'ABU DHABI',
      'SAUDI',
      'EMIRATES',
      'FREE ZONE',
    ].map((t) => t.toUpperCase());

    const normalise = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

    // Hyphen-separated suffixes first, e.g. "Alpha Holdings - DIFC".
    let hyphenParts = name.split(/\s*[-–]\s*/);
    if (hyphenParts.length > 1) {
      const lastNorm = normalise(hyphenParts[hyphenParts.length - 1]);
      if (jurisTokens.includes(lastNorm) || /^[A-Z]{2,5}$/.test(lastNorm)) {
        hyphenParts.pop();
        name = hyphenParts.join(' - ').trim();
      }
    }

    // Token-based stripping from the end, e.g.
    // "Alpha Holdings Limited Cayman Islands" → "Alpha Holdings Limited".
    const words = name.split(/\s+/);
    while (words.length) {
      const lastOne = normalise(words[words.length - 1]);
      const lastTwo = words.length >= 2 ? normalise(words.slice(-2).join(' ')) : '';

      if (lastTwo && jurisTokens.includes(lastTwo)) {
        words.splice(-2, 2);
        continue;
      }
      if (lastOne && jurisTokens.includes(lastOne)) {
        words.pop();
        continue;
      }
      break;
    }

    name = words.join(' ').trim();
    return name;
  }

  /** Holding structure: matches UBO register – parent at root, each OpCo with %; OpCos with multiple UBOs show all parent holdings with % and status. */
  const holdingStructure = useMemo(() => {
    const root = {
      name: selectedParentHolding || 'Parent (UBO)',
      percentage: 100,
      isRoot: true,
      children: [],
    };
    if (!opcos.length) return root;

    const children = opcos.map((opco) => {
      // Derive shareholders for this OpCo from the UBO register. Onboarding
      // "Review & Confirm → Parent Holding Name | Ownership %" writes
      // percentage + certificate details + UBO declaration document for each
      // (parent, opco) pair; later UBO edits update the same keys.
      const shareholdersRaw = [];
      Object.entries(uboData || {}).forEach(([key, rec]) => {
        const [parentRaw, keyOpco] = key.split('::');
        if (keyOpco !== opco) return;

        // Normalise parent name so that holding structure groups by the
        // cleaned Entity / Full Name (without concatenated jurisdiction),
        // even if older entries were saved with "Name + Jurisdiction".
        const parent = cleanParentEntityName(parentRaw);
        if (!parent) return;

        const hasOnboardingDetails =
          !!(rec.details && (rec.details.uboCertificateNumber || rec.details.tradeLicenceNumber || rec.details.registeredAddress)) ||
          (Array.isArray(rec.documents) &&
            rec.documents.some((d) => d.id === 'ubo_declaration' && (d.uploaded || d.completed)));

        shareholdersRaw.push({
          parent,
          percentage: rec.percentage ?? 100,
          status: rec.status || 'Not updated',
          isOnboarding: hasOnboardingDetails,
        });
      });

      // Deduplicate by cleaned parent name so we don't show the same entity
      // multiple times for the same OpCo (e.g. "Alpha Holdings Limited" and
      // "Alpha Holdings Limited Cayman Islands" collapse into one).
      const dedupMap = new Map();
      shareholdersRaw.forEach((s) => {
        dedupMap.set(s.parent, s);
      });
      let shareholders = Array.from(dedupMap.values());

      // Holding Structure is driven only by Onboarding: show only parent holdings
      // that came from Review & Confirm (Parent Holding Name | Ownership %).
      // Any pre-existing or non-onboarding entries for this OpCo are not shown.
      const onboardingShareholders = shareholders.filter((s) => s.isOnboarding);
      shareholders = onboardingShareholders;

      const r = getRecord(opco);
      const multiCount = shareholders.filter((s) => (s.percentage ?? 0) >= 25).length;
      const primaryShare = shareholders.find((s) => s.parent === selectedParentHolding) || shareholders[0];
      return {
        name: opco,
        percentage: primaryShare ? primaryShare.percentage ?? '' : '',
        parent: selectedParentHolding,
        shareholders,
        isMultiUBO: multiCount > 1,
      };
    });

    root.children = children;
    return root;
  }, [selectedParentHolding, opcos, uboData]);

  const handleExport = () => {
    const headers = ['OpCo', 'Parent Holding', '% Holding by Parent', 'UBO Register Status', 'Last Updated', 'Notes', 'Full Name', 'Nationality', 'ID Number'];
    const rows = opcos.map((opco) => {
      const r = getRecord(opco);
      const d = r.details || {};
      return [
        opco,
        selectedParentHolding || '',
        r.percentage,
        r.status,
        r.lastUpdated,
        (r.notes || '').replace(/,/g, ';'),
        d.fullName || '',
        d.nationality || '',
        d.idNumber || '',
      ];
    });
    const csv = [headers.join(','), ...rows.map((row) => row.map((c) => `"${String(c)}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `UBO_Register_${(selectedParentHolding || 'Parent').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const markAllAsUpdated = () => {
    const today = new Date().toISOString().slice(0, 10);
    let next = { ...uboData };
    opcos.forEach((opco) => {
      const key = getUboKey(selectedParentHolding, opco);
      const r = getRecord(opco);
      next[key] = { ...r, status: 'Updated', lastUpdated: today };
    });
    setUboData(next);
    saveUboRegister(next);
  };

  const markMandatoryDocCompleted = (opco, docId, completed, fileName = '') => {
    const r = getRecord(opco);
    const docLabel = MANDATORY_UBO_DOCUMENTS.find((d) => d.id === docId)?.label || docId;
    const documents = (r.documents || []).map((d) =>
      d.id === docId
        ? { ...d, uploaded: !!completed, fileName: fileName || d.fileName, uploadedAt: completed ? new Date().toISOString().slice(0, 10) : '' }
        : d
    );
    saveRecord(opco, { ...r, documents });
    addUboChange(selectedParentHolding, opco, completed ? `Document "${docLabel}" marked completed for ${opco}` : `Document "${docLabel}" unmarked for ${opco}`);
    setUboChanges(loadUboChanges());
  };

  const handleMandatoryDocFile = (opco, docId, e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    markMandatoryDocCompleted(opco, docId, true, file.name);
    setUboChanges(loadUboChanges());
    e.target.value = '';
  };

  const downloadUboRegistrationDocument = async (opco) => {
    const r = getRecord(opco);
    try {
      const res = await fetch(`${API}/pdf/ubo-registration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parent: selectedParentHolding,
          opco,
          details: r.details || {},
        }),
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `UBO_Registration_${(opco || 'OpCo').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err.message || 'Failed to download UBO registration document.';
      setExtractMessage(msg);
      alert(msg);
    }
  };

  const saveRegistryRecord = (moduleId, moduleLabel, uboDocId) => {
    const { opco, summary, fileName, applyToUbo } = registryForm;
    if (!opco) return;
    const key = getRegistryRecordKey(selectedParentHolding, opco, moduleId);
    const record = {
      moduleId,
      moduleLabel,
      opco,
      addedAt: new Date().toISOString().slice(0, 10),
      summary: summary || '',
      fileName: fileName || (fileName ? 'From UAE Trade Registry' : ''),
      source: 'traderegistry.ae',
      appliedToUbo: !!applyToUbo,
    };
    const nextRegistry = { ...registryRecords, [key]: record };
    setRegistryRecords(nextRegistry);
    saveRegistryRecords(nextRegistry);

    if (applyToUbo && uboDocId) {
      const uboKey = getUboKey(selectedParentHolding, opco);
      const prev = getRecord(opco);
      const documents = (prev.documents || []).map((d) =>
        d.id === uboDocId
          ? { ...d, uploaded: true, fileName: fileName || `From UAE Trade Registry - ${moduleLabel}`, uploadedAt: record.addedAt }
          : d
      );
      const noteFromRegistry = summary ? `[UAE Trade Registry - ${moduleLabel}] ${summary}`.trim() : '';
      const notes = prev.notes ? (noteFromRegistry ? `${prev.notes}\n${noteFromRegistry}` : prev.notes) : noteFromRegistry;
      const nextUbo = {
        ...uboData,
        [uboKey]: {
          ...prev,
          documents,
          notes,
          lastUpdated: record.addedAt,
          status: prev.status === 'Updated' ? 'Updated' : 'Pending',
        },
      };
      setUboData(nextUbo);
      saveUboRegister(nextUbo);
    }

    setRegistryModal(null);
    setRegistryForm({ opco: '', summary: '', fileName: '', applyToUbo: true });
  };

  const getRegistryRecordsByModule = (moduleId) => {
    return opcos.filter((opco) => {
      const key = getRegistryRecordKey(selectedParentHolding, opco, moduleId);
      return registryRecords[key];
    }).map((opco) => {
      const key = getRegistryRecordKey(selectedParentHolding, opco, moduleId);
      return { opco, ...registryRecords[key] };
    });
  };

  if (!selectedParentHolding) {
    return (
      <div className="ubo-section">
        <h2 className="ubo-title">Ultimate Beneficial Owner (UBO)</h2>
        <p className="ubo-intro">
          Enter and manage UBO register details per ME regulations: mandatory fields, document upload with auto-extraction, holding structure, and mandatory documents checklist.
        </p>
        <div className="ubo-lookup">
          <label htmlFor="ubo-opco-lookup-empty">Look up OpCo by name</label>
          <input
            id="ubo-opco-lookup-empty"
            type="text"
            className="ubo-lookup-input"
            value={opcoLookupQuery}
            onChange={(e) => setOpcoLookupQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runOpcoLookup()}
            placeholder="Type OpCo name to search UBO register…"
          />
          <button type="button" className="ubo-btn ubo-btn-secondary" onClick={runOpcoLookup}>Search</button>
          {opcoLookupLoading && <p className="ubo-lookup-loading">Searching all parent holding groups…</p>}
          {!opcoLookupLoading && opcoLookupResults.length > 0 && (
            <div className="ubo-lookup-results">
              <h4 className="ubo-lookup-results-title">OpCo(s) found — same as Holding structure (aligned with UBO register)</h4>
              <div className="ubo-structure-viz-opcos ubo-lookup-opcos">
                {opcoLookupResults.map(({ opco, parents }) => {
                  const isExpanded = expandedLookupOpcos.has(opco);
                  const toggleLookupOpco = () => {
                    setExpandedLookupOpcos((prev) => {
                      const next = new Set(prev);
                      if (next.has(opco)) next.delete(opco);
                      else next.add(opco);
                      return next;
                    });
                  };
                  const primaryPct = parents[0]?.record?.percentage ?? '—';
                  const isMultiUBO = parents.length > 1;
                  return (
                    <div key={opco} className="ubo-structure-viz-opco-wrap">
                      <button
                        type="button"
                        className="ubo-structure-viz-opco ubo-structure-viz-opco-header"
                        onClick={toggleLookupOpco}
                        aria-expanded={isExpanded}
                        aria-controls={`ubo-lookup-details-${opco.replace(/\s/g, '-')}`}
                      >
                        <span className={`ubo-structure-viz-chevron ${isExpanded ? 'ubo-structure-viz-chevron-open' : ''}`} aria-hidden="true" />
                        <span className="ubo-structure-viz-opco-name">{opco}</span>
                        <span className="ubo-structure-viz-pct">{primaryPct}{typeof primaryPct === 'number' ? '%' : ''}</span>
                        {isMultiUBO && <span className="ubo-structure-viz-multi-badge">Multiple UBOs</span>}
                      </button>
                      <div
                        id={`ubo-lookup-details-${opco.replace(/\s/g, '-')}`}
                        className={`ubo-structure-viz-details ${isExpanded ? 'ubo-structure-viz-details-open' : ''}`}
                        role="region"
                        aria-label={`UBO details for ${opco}`}
                      >
                        <div className="ubo-structure-viz-parents">
                          {parents.map(({ parent, record }) => (
                            <div key={parent} className="ubo-structure-viz-parent" role="presentation">
                              <span className="ubo-structure-viz-parent-name">{parent}</span>
                              <span className="ubo-structure-viz-pct">{record.percentage}%</span>
                              <span className={`ubo-status ubo-status-${(record.status || '').replace(/\s+/g, '-').toLowerCase()}`}>{record.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {!opcoLookupLoading && opcoLookupQuery.trim() && opcoLookupResults.length === 0 && (
            <p className="ubo-lookup-no-results">No OpCos matching &quot;{opcoLookupQuery.trim()}&quot; in any parent holding group.</p>
          )}
        </div>
        <div className="ubo-empty">
          <p>Select a <strong>Parent Holding company</strong> in the <strong>Parent Holding Overview</strong> to view OpCos and manage the UBO register.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="ubo-section">
        <h2 className="ubo-title">Ultimate Beneficial Owner (UBO)</h2>
        <div className="ubo-loading">Loading OpCos…</div>
      </div>
    );
  }

  if (opcos.length === 0) {
    return (
      <div className="ubo-section">
        <h2 className="ubo-title">Ultimate Beneficial Owner (UBO)</h2>
        <div className="ubo-parent-banner">Parent Holding: <strong>{selectedParentHolding}</strong></div>
        <div className="ubo-lookup">
          <label htmlFor="ubo-opco-lookup-noopcos">Look up OpCo by name</label>
          <input
            id="ubo-opco-lookup-noopcos"
            type="text"
            className="ubo-lookup-input"
            value={opcoLookupQuery}
            onChange={(e) => setOpcoLookupQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runOpcoLookup()}
            placeholder="Type OpCo name to search UBO register…"
          />
          <button type="button" className="ubo-btn ubo-btn-secondary" onClick={runOpcoLookup}>Search</button>
          {opcoLookupLoading && <p className="ubo-lookup-loading">Searching all parent holding groups…</p>}
          {!opcoLookupLoading && opcoLookupResults.length > 0 && (
            <div className="ubo-lookup-results">
              <h4 className="ubo-lookup-results-title">OpCo(s) found — same as Holding structure (aligned with UBO register)</h4>
              <div className="ubo-structure-viz-opcos ubo-lookup-opcos">
                {opcoLookupResults.map(({ opco, parents }) => {
                  const isExpanded = expandedLookupOpcos.has(opco);
                  const toggleLookupOpco = () => {
                    setExpandedLookupOpcos((prev) => {
                      const next = new Set(prev);
                      if (next.has(opco)) next.delete(opco);
                      else next.add(opco);
                      return next;
                    });
                  };
                  const primaryPct = parents[0]?.record?.percentage ?? '—';
                  const isMultiUBO = parents.length > 1;
                  return (
                    <div key={opco} className="ubo-structure-viz-opco-wrap">
                      <button
                        type="button"
                        className="ubo-structure-viz-opco ubo-structure-viz-opco-header"
                        onClick={toggleLookupOpco}
                        aria-expanded={isExpanded}
                        aria-controls={`ubo-lookup-details-${opco.replace(/\s/g, '-')}`}
                      >
                        <span className={`ubo-structure-viz-chevron ${isExpanded ? 'ubo-structure-viz-chevron-open' : ''}`} aria-hidden="true" />
                        <span className="ubo-structure-viz-opco-name">{opco}</span>
                        <span className="ubo-structure-viz-pct">{primaryPct}{typeof primaryPct === 'number' ? '%' : ''}</span>
                        {isMultiUBO && <span className="ubo-structure-viz-multi-badge">Multiple UBOs</span>}
                      </button>
                      <div
                        id={`ubo-lookup-details-${opco.replace(/\s/g, '-')}`}
                        className={`ubo-structure-viz-details ${isExpanded ? 'ubo-structure-viz-details-open' : ''}`}
                        role="region"
                        aria-label={`UBO details for ${opco}`}
                      >
                        <div className="ubo-structure-viz-parents">
                          {parents.map(({ parent, record }) => (
                            <div key={parent} className="ubo-structure-viz-parent" role="presentation">
                              <span className="ubo-structure-viz-parent-name">{parent}</span>
                              <span className="ubo-structure-viz-pct">{record.percentage}%</span>
                              <span className={`ubo-status ubo-status-${(record.status || '').replace(/\s+/g, '-').toLowerCase()}`}>{record.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {!opcoLookupLoading && opcoLookupQuery.trim() && opcoLookupResults.length === 0 && (
            <p className="ubo-lookup-no-results">No OpCos matching &quot;{opcoLookupQuery.trim()}&quot; in any parent holding group.</p>
          )}
        </div>
        <div className="ubo-empty"><p>No OpCos found for <strong>{selectedParentHolding}</strong>.</p></div>
      </div>
    );
  }

  return (
    <div className="ubo-section">
      <h2 className="ubo-title">Ultimate Beneficial Owner (UBO)</h2>
      <p className="ubo-intro">
        Enter, update and manage UBO register details as required by UAE, KSA and GCC regulations. Upload documents to auto-fill fields, view the full holding structure with % ownership, and track mandatory compliance documents.
      </p>

      <div className="ubo-parent-banner">
        Parent Holding (UBO): <strong>{selectedParentHolding}</strong>
      </div>

      <div className="ubo-lookup">
        <label htmlFor="ubo-opco-lookup">Look up OpCo by name</label>
        <input
          id="ubo-opco-lookup"
          type="text"
          className="ubo-lookup-input"
          value={opcoLookupQuery}
          onChange={(e) => setOpcoLookupQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runOpcoLookup()}
          placeholder="Type OpCo name to search UBO register…"
        />
        <button type="button" className="ubo-btn ubo-btn-secondary" onClick={runOpcoLookup}>Search</button>
        {opcoLookupLoading && <p className="ubo-lookup-loading">Searching all parent holding groups…</p>}
        {!opcoLookupLoading && opcoLookupResults.length > 0 && (
          <div className="ubo-lookup-results">
            <h4 className="ubo-lookup-results-title">OpCo(s) found — same as Holding structure (aligned with UBO register)</h4>
            <div className="ubo-structure-viz-opcos ubo-lookup-opcos">
              {opcoLookupResults.map(({ opco, parents }) => {
                const isExpanded = expandedLookupOpcos.has(opco);
                const toggleLookupOpco = () => {
                  setExpandedLookupOpcos((prev) => {
                    const next = new Set(prev);
                    if (next.has(opco)) next.delete(opco);
                    else next.add(opco);
                    return next;
                  });
                };
                const primaryPct = parents[0]?.record?.percentage ?? '—';
                const isMultiUBO = parents.length > 1;
                return (
                  <div key={opco} className="ubo-structure-viz-opco-wrap">
                    <button
                      type="button"
                      className="ubo-structure-viz-opco ubo-structure-viz-opco-header"
                      onClick={toggleLookupOpco}
                      aria-expanded={isExpanded}
                      aria-controls={`ubo-lookup-details-${opco.replace(/\s/g, '-')}`}
                    >
                      <span className={`ubo-structure-viz-chevron ${isExpanded ? 'ubo-structure-viz-chevron-open' : ''}`} aria-hidden="true" />
                      <span className="ubo-structure-viz-opco-name">{opco}</span>
                      <span className="ubo-structure-viz-pct">{primaryPct}{typeof primaryPct === 'number' ? '%' : ''}</span>
                      {isMultiUBO && <span className="ubo-structure-viz-multi-badge">Multiple UBOs</span>}
                    </button>
                    <div
                      id={`ubo-lookup-details-${opco.replace(/\s/g, '-')}`}
                      className={`ubo-structure-viz-details ${isExpanded ? 'ubo-structure-viz-details-open' : ''}`}
                      role="region"
                      aria-label={`UBO details for ${opco}`}
                    >
                      <div className="ubo-structure-viz-parents">
                        {parents.map(({ parent, record }) => (
                          <div key={parent} className="ubo-structure-viz-parent" role="presentation">
                            <span className="ubo-structure-viz-parent-name">{parent}</span>
                            <span className="ubo-structure-viz-pct">{record.percentage}%</span>
                            <span className={`ubo-status ubo-status-${(record.status || '').replace(/\s+/g, '-').toLowerCase()}`}>{record.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {!opcoLookupLoading && opcoLookupQuery.trim() && opcoLookupResults.length === 0 && (
          <p className="ubo-lookup-no-results">No OpCos matching &quot;{opcoLookupQuery.trim()}&quot; in any parent holding group.</p>
        )}
      </div>

      <div className="ubo-tabs">
        <button
          type="button"
          className={`ubo-tab ${activeTab === 'register' ? 'ubo-tab-active' : ''}`}
          onClick={() => setActiveTab('register')}
        >
          UBO Register
        </button>
        <button
          type="button"
          className={`ubo-tab ${activeTab === 'structure' ? 'ubo-tab-active' : ''}`}
          onClick={() => setActiveTab('structure')}
        >
          Holding Structure
        </button>
        <button
          type="button"
          className={`ubo-tab ${activeTab === 'documents' ? 'ubo-tab-active' : ''}`}
          onClick={() => setActiveTab('documents')}
        >
          Mandatory Documents
        </button>
        <button
          type="button"
          className={`ubo-tab ${activeTab === 'registry' ? 'ubo-tab-active' : ''}`}
          onClick={() => setActiveTab('registry')}
        >
          UAE Trade Registry
        </button>
      </div>

      {activeTab === 'register' && (
        <>
          <div className="ubo-summary-cards">
            <div className="ubo-summary-card">
              <span className="ubo-summary-value">{summary.updated}</span>
              <span className="ubo-summary-label">Register updated</span>
            </div>
            <div className="ubo-summary-card">
              <span className="ubo-summary-value">{summary.pending}</span>
              <span className="ubo-summary-label">Pending</span>
            </div>
            <div className="ubo-summary-card">
              <span className="ubo-summary-value">{summary.notUpdated}</span>
              <span className="ubo-summary-label">Not updated</span>
            </div>
            <div className="ubo-summary-card ubo-summary-total">
              <span className="ubo-summary-value">{summary.total}</span>
              <span className="ubo-summary-label">Total OpCos</span>
            </div>
          </div>

          <div className="ubo-toolbar">
            <div className="ubo-filter">
              <label htmlFor="ubo-status-filter">Status</label>
              <select id="ubo-status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All</option>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="ubo-actions">
              <button type="button" className="ubo-btn ubo-btn-secondary" onClick={() => { setShowViewChanges(true); setUboChanges(loadUboChanges()); }}>View Changes</button>
              <button type="button" className="ubo-btn ubo-btn-secondary" onClick={markAllAsUpdated}>Mark all as updated</button>
              <button type="button" className="ubo-btn ubo-btn-primary" onClick={handleExport}>Export to CSV</button>
            </div>
          </div>

          <div className="ubo-table-wrap">
            <table className="ubo-table">
              <thead>
                <tr>
                  <th>OpCo</th>
                  <th>% Holding by Parent</th>
                  <th>UBO Register Status</th>
                  <th>Last Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOpcos.map((opco) => {
                  const r = getRecord(opco);
                  const isExpanded = expandedRegisterOpcos.has(opco);
                  const toggleExpanded = () => {
                    setExpandedRegisterOpcos((prev) => {
                      const next = new Set(prev);
                      if (next.has(opco)) next.delete(opco);
                      else next.add(opco);
                      return next;
                    });
                  };
                  return (
                    <>
                      <tr key={opco}>
                        <td>
                          <button
                            type="button"
                            className="ubo-link ubo-opco-toggle"
                            onClick={toggleExpanded}
                            aria-expanded={isExpanded}
                            aria-controls={`ubo-register-details-${opco.replace(/\s/g, '-').replace(/[()]/g, '')}`}
                          >
                            {opco}
                          </button>
                        </td>
                        <td>{r.percentage}%</td>
                        <td>
                          <span className={`ubo-status ubo-status-${r.status.replace(/\s+/g, '-').toLowerCase()}`}>{r.status}</span>
                        </td>
                        <td>{r.lastUpdated || '—'}</td>
                        <td>
                          <button type="button" className="ubo-link" onClick={() => setViewingOpco(opco)}>View details</button>
                          <span className="ubo-sep">|</span>
                          <button type="button" className="ubo-link" onClick={() => openEdit(opco)}>Enter / Update UBO</button>
                          <span className="ubo-sep">|</span>
                          <button
                            type="button"
                            className="ubo-link"
                            onClick={() => downloadUboRegistrationDocument(opco)}
                            title="Download pre-filled UBO registration document; sign and upload via UAE Trade Registry"
                          >
                            Download UBO doc
                          </button>
                          {r.status !== 'Updated' && (
                            <>
                              <span className="ubo-sep">|</span>
                              <button
                                type="button"
                                className="ubo-link ubo-link-quick"
                                onClick={() => saveRecord(opco, { status: 'Updated', lastUpdated: new Date().toISOString().slice(0, 10) })}
                              >
                                Mark updated
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="ubo-register-details-row">
                          <td colSpan={5} id={`ubo-register-details-${opco.replace(/\s/g, '-').replace(/[()]/g, '')}`}>
                            <div className="ubo-register-details-grid">
                              <div className="ubo-register-details-group">
                                <h4>Onboarding certificate</h4>
                                <div className="ubo-register-details-grid-inner">
                                  <div>
                                    <strong>UBO Certificate Number</strong>
                                    <div>{r.details?.uboCertificateNumber || '—'}</div>
                                  </div>
                                  <div>
                                    <strong>Date of Issue</strong>
                                    <div>{r.details?.dateOfIssue || '—'}</div>
                                  </div>
                                  <div>
                                    <strong>Registered Address</strong>
                                    <div>{r.details?.registeredAddress || '—'}</div>
                                  </div>
                                  <div>
                                    <strong>Trade Licence Number</strong>
                                    <div>{r.details?.tradeLicenceNumber || '—'}</div>
                                  </div>
                                  <div>
                                    <strong>Jurisdiction</strong>
                                    <div>{r.details?.certificateJurisdiction || '—'}</div>
                                  </div>
                                </div>
                              </div>
                              <div className="ubo-register-details-group">
                                <h4>Mandatory details</h4>
                                <div className="ubo-register-details-grid-inner">
                                  {r.details?.relationshipType === 'corporate' ? (
                                    <>
                                      <div>
                                        <strong>Corporate Name</strong>
                                        <div>{r.details?.corporateName || '—'}</div>
                                      </div>
                                      <div>
                                        <strong>Ownership %</strong>
                                        <div>{r.percentage ?? '—'}{typeof r.percentage === 'number' ? '%' : ''}</div>
                                      </div>
                                      <div>
                                        <strong>Jurisdiction of Incorporation</strong>
                                        <div>{r.details?.corporateJurisdictionOfIncorporation || r.details?.certificateJurisdiction || '—'}</div>
                                      </div>
                                      <div>
                                        <strong>Registration Number</strong>
                                        <div>{r.details?.corporateRegistrationNumber || '—'}</div>
                                      </div>
                                      <div>
                                        <strong>Registered Address</strong>
                                        <div>{r.details?.corporateRegisteredAddress || r.details?.registeredAddress || '—'}</div>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div>
                                        <strong>Full name (as per ID)</strong>
                                        <div>{r.details?.fullName || '—'}</div>
                                      </div>
                                      <div>
                                        <strong>Nationality</strong>
                                        <div>{r.details?.nationality || '—'}</div>
                                      </div>
                                      <div>
                                        <strong>Date of birth</strong>
                                        <div>{r.details?.dateOfBirth || '—'}</div>
                                      </div>
                                      <div>
                                        <strong>Place of birth</strong>
                                        <div>{r.details?.placeOfBirth || '—'}</div>
                                      </div>
                                      <div>
                                        <strong>ID type (Passport / National ID)</strong>
                                        <div>{r.details?.idType || '—'}</div>
                                      </div>
                                      <div>
                                        <strong>ID number</strong>
                                        <div>{r.details?.idNumber || '—'}</div>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>

          {parentOpcoCount > 10 && multiShareholderOpcos.length > 0 && (
            <div className="ubo-multi-shareholder">
              <h3 className="ubo-multi-shareholder-title">OpCos with multiple shareholders (≥25%)</h3>
              <p className="ubo-multi-shareholder-intro">
                The following OpCos have more than one shareholder holding ≥25%. UBO register status is shown per parent.
              </p>
              <div className="ubo-multi-shareholder-trees">
                {multiShareholderOpcos.map((item) => (
                  <div key={item.opco} className="ubo-multi-tree-card">
                    <div className="ubo-multi-tree-opco ubo-multi-tree-node-root">
                      <span className="ubo-multi-tree-entity">{item.opco}</span>
                      <span className="ubo-multi-tree-badge">OpCo</span>
                    </div>
                    <div className="ubo-multi-tree-parents">
                      {(item.shareholders || []).filter((s) => s.percentage >= 25).map((sh) => {
                        const rec = getRecordFor(sh.parent, item.opco);
                        return (
                          <div key={sh.parent} className="ubo-multi-tree-node ubo-multi-tree-parent">
                            <span className="ubo-multi-tree-connector" />
                            <span className="ubo-multi-tree-entity">{sh.parent}</span>
                            <span className="ubo-multi-tree-pct">{sh.percentage}%</span>
                            <span className={`ubo-status ubo-status-${rec.status.replace(/\s+/g, '-').toLowerCase()}`} title={`UBO register: ${rec.status}`}>
                              {rec.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'structure' && (
        <div className="ubo-structure">
          <h3 className="ubo-structure-title">Holding structure (aligned with UBO register)</h3>
          <p className="ubo-structure-intro">
            Same pattern as the UBO register: parent holding and each OpCo with %; OpCos with multiple UBOs show all parent holdings and status. Expand an OpCo to see details; selected OpCo and its parent(s) are highlighted.
          </p>
          <div className="ubo-structure-filter-row">
            <div className="ubo-structure-cards">
              <button
                type="button"
                className={`ubo-structure-card ${structureFilter === 'all' ? 'ubo-structure-card-selected' : ''}`}
                onClick={() => setStructureFilter('all')}
                aria-pressed={structureFilter === 'all'}
              >
                <span className="ubo-structure-card-value">{holdingStructure.children.length}</span>
                <span className="ubo-structure-card-label">All OpCos</span>
              </button>
              <button
                type="button"
                className={`ubo-structure-card ubo-structure-card-multi ${structureFilter === 'multi-ubo' ? 'ubo-structure-card-selected' : ''}`}
                onClick={() => setStructureFilter('multi-ubo')}
                aria-pressed={structureFilter === 'multi-ubo'}
              >
                <span className="ubo-structure-card-value">{holdingStructure.children.filter((c) => c.isMultiUBO).length}</span>
                <span className="ubo-structure-card-label">OpCos with multiple UBOs</span>
              </button>
            </div>
            <div className="ubo-structure-select-wrap">
              <label htmlFor="ubo-structure-criteria">Show</label>
              <select
                id="ubo-structure-criteria"
                value={structureFilter}
                onChange={(e) => setStructureFilter(e.target.value)}
              >
                <option value="all">All OpCos</option>
                <option value="multi-ubo">OpCos with multiple UBOs only</option>
              </select>
            </div>
          </div>
          <div className="ubo-structure-viz">
            <div
              className={`ubo-structure-viz-root ${selectedStructureOpco ? 'ubo-structure-viz-highlight' : ''}`}
              role="presentation"
            >
              <span className="ubo-structure-viz-label">{holdingStructure.name}</span>
              <span className="ubo-structure-badge">UBO</span>
            </div>
            <div className="ubo-structure-viz-connector" aria-hidden="true" />
            <div className="ubo-structure-viz-opcos">
              {(structureFilter === 'multi-ubo' ? holdingStructure.children.filter((c) => c.isMultiUBO) : holdingStructure.children).map((child) => {
                const isExpanded = expandedStructureOpcos.has(child.name);
                const isSelected = selectedStructureOpco === child.name;
                const highlightParents = isSelected && child.shareholders?.length;
                const toggleExpand = () => {
                  setExpandedStructureOpcos((prev) => {
                    const next = new Set(prev);
                    if (next.has(child.name)) next.delete(child.name);
                    else next.add(child.name);
                    return next;
                  });
                  setSelectedStructureOpco(isExpanded ? null : child.name);
                };
                return (
                  <div key={child.name} className="ubo-structure-viz-opco-wrap">
                    <button
                      type="button"
                      className={`ubo-structure-viz-opco ubo-structure-viz-opco-header ${isSelected ? 'ubo-structure-viz-opco-selected' : ''}`}
                      onClick={toggleExpand}
                      aria-expanded={isExpanded}
                      aria-controls={`ubo-structure-details-${child.name.replace(/\s/g, '-')}`}
                    >
                      <span className={`ubo-structure-viz-chevron ${isExpanded ? 'ubo-structure-viz-chevron-open' : ''}`} aria-hidden="true" />
                      <span className="ubo-structure-viz-opco-name">{child.name}</span>
                      {child.isMultiUBO && <span className="ubo-structure-viz-multi-badge">Multiple UBOs</span>}
                    </button>
                    {child.shareholders && child.shareholders.length > 0 && (
                      <div
                        id={`ubo-structure-details-${child.name.replace(/\s/g, '-')}`}
                        className={`ubo-structure-viz-details ${isExpanded ? 'ubo-structure-viz-details-open' : ''}`}
                        role="region"
                        aria-label={`Details for ${child.name}`}
                      >
                        <div className="ubo-structure-viz-parents">
                          {child.shareholders.map((sh) => (
                            <div
                              key={sh.parent}
                              className={`ubo-structure-viz-parent ${highlightParents && isSelected ? 'ubo-structure-viz-highlight' : ''}`}
                              role="presentation"
                            >
                              <span className="ubo-structure-viz-parent-name">{sh.parent}</span>
                              <span className="ubo-structure-viz-pct">{sh.percentage}%</span>
                              <span className={`ubo-status ubo-status-${(sh.status || '').replace(/\s+/g, '-').toLowerCase()}`}>{sh.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="ubo-mandatory-docs">
          <h3 className="ubo-mandatory-title">Mandatory documents for UBO compliance (Middle East)</h3>
          <p className="ubo-mandatory-intro">Upload documents and mark as completed per OpCo. Changes are reflected in the UBO register and in View Changes. Expand an OpCo to see and manage its documents.</p>
          <div className="ubo-mandatory-per-opco">
            {opcos.map((opco) => {
              const r = getRecord(opco);
              const docs = r.documents || [];
              const isExpanded = expandedMandatoryOpcos.has(opco);
              const completedCount = docs.filter((d) => d.uploaded).length;
              const toggleMandatoryOpco = () => {
                setExpandedMandatoryOpcos((prev) => {
                  const next = new Set(prev);
                  if (next.has(opco)) next.delete(opco);
                  else next.add(opco);
                  return next;
                });
              };
              return (
                <div key={opco} className="ubo-mandatory-opco-block">
                  <button
                    type="button"
                    className="ubo-mandatory-opco-header"
                    onClick={toggleMandatoryOpco}
                    aria-expanded={isExpanded}
                    aria-controls={`ubo-mandatory-docs-${opco.replace(/\s/g, '-').replace(/[()]/g, '')}`}
                  >
                    <span className={`ubo-mandatory-opco-chevron ${isExpanded ? 'ubo-mandatory-opco-chevron-open' : ''}`} aria-hidden="true" />
                    <span className="ubo-mandatory-opco-name">{opco}</span>
                    <span className="ubo-mandatory-opco-badge">{completedCount} / {MANDATORY_UBO_DOCUMENTS.length} completed</span>
                  </button>
                  <div
                    id={`ubo-mandatory-docs-${opco.replace(/\s/g, '-').replace(/[()]/g, '')}`}
                    className={`ubo-mandatory-opco-body ${isExpanded ? 'ubo-mandatory-opco-body-open' : ''}`}
                    role="region"
                    aria-label={`Documents for ${opco}`}
                  >
                  <div className="ubo-mandatory-doc-rows">
                    {MANDATORY_UBO_DOCUMENTS.map((doc) => {
                      const docState = docs.find((d) => d.id === doc.id) || { uploaded: false, fileName: '', uploadedAt: '' };
                      return (
                        <div key={doc.id} className="ubo-mandatory-doc-row">
                          <div className="ubo-mandatory-doc-info">
                            <strong>{doc.label}</strong>
                            <span className="ubo-mandatory-desc">{doc.description}</span>
                          </div>
                          <label className="ubo-mandatory-doc-completed">
                            <input
                              type="checkbox"
                              checked={!!docState.uploaded}
                              onChange={(e) => markMandatoryDocCompleted(opco, doc.id, e.target.checked)}
                            />
                            Mark completed
                          </label>
                          <div className="ubo-mandatory-doc-upload">
                            <input
                              id={`ubo-mandatory-file-${opco.replace(/\s/g, '-')}-${doc.id}`}
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,application/pdf,image/*"
                              className="ubo-file-input ubo-file-input-hidden"
                              onChange={(e) => handleMandatoryDocFile(opco, doc.id, e)}
                            />
                            <button type="button" className="ubo-btn ubo-btn-secondary ubo-btn-sm" onClick={() => document.getElementById(`ubo-mandatory-file-${opco.replace(/\s/g, '-')}-${doc.id}`)?.click()}>
                              Upload
                            </button>
                          </div>
                          {docState.uploaded && (docState.fileName || docState.uploadedAt) && (
                            <span className="ubo-mandatory-doc-meta">{docState.fileName || `Completed ${docState.uploadedAt}`}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="ubo-mandatory-note">Changes here update the UBO register for each OpCo. Use <button type="button" className="ubo-link" onClick={() => { setShowViewChanges(true); setUboChanges(loadUboChanges()); }}>View Changes</button> to see the change history.</p>
        </div>
      )}

      {activeTab === 'registry' && (
        <div className="ubo-registry">
          <h3 className="ubo-registry-title">UAE Trade Registry — Look up, download &amp; add records</h3>
          <p className="ubo-registry-intro">
            Use the <a href={TRADE_REGISTRY_URL} target="_blank" rel="noopener noreferrer" className="ubo-registry-link">UAE Trade Registry Smart Portal (traderegistry.ae)</a> to look up or obtain official corporate documents. Add records below to drive the UBO register and mandatory documents for each OpCo.
          </p>
          <div className="ubo-registry-table-wrap">
            <table className="ubo-table ubo-registry-table">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Look up</th>
                  <th>Download</th>
                  <th>Add record / Status</th>
                </tr>
              </thead>
              <tbody>
                {TRADE_REGISTRY_MODULES.map((mod) => {
                  const records = getRegistryRecordsByModule(mod.id);
                  return (
                    <tr key={mod.id}>
                      <td><strong>{mod.label}</strong></td>
                      <td>
                        <a href={TRADE_REGISTRY_URL} target="_blank" rel="noopener noreferrer" className="ubo-link">Open UAE Trade Registry</a>
                      </td>
                      <td>
                        <a href={TRADE_REGISTRY_URL} target="_blank" rel="noopener noreferrer" className="ubo-link">Download from portal</a>
                      </td>
                      <td>
                        <button type="button" className="ubo-btn ubo-btn-secondary ubo-btn-sm" onClick={() => setRegistryModal({ moduleId: mod.id, moduleLabel: mod.label, uboDocId: mod.uboDocId })}>Add record</button>
                        {records.length > 0 && (
                          <ul className="ubo-registry-status-list">
                            {records.map((r) => (
                              <li key={r.opco}>
                                <span className="ubo-registry-status-opco">{r.opco}</span>: added {r.addedAt}{r.appliedToUbo ? ', applied to UBO' : ''}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Enter / Update UBO (full form + upload + extract) */}
      {editingOpco && (
        <div className="ubo-modal-overlay" onClick={() => setEditingOpco(null)}>
          <div className="ubo-modal ubo-modal-large" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="ubo-modal-close" onClick={() => setEditingOpco(null)} aria-label="Close" title="Close">×</button>
            <h3 className="ubo-modal-title">Enter / Update UBO details — {editingOpco}</h3>
            <p className="ubo-modal-subtitle">Mandatory fields as per UAE and GCC UBO register requirements.</p>

            <div className="ubo-upload-block">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,application/pdf,image/*"
                onChange={handleFileSelect}
                className="ubo-file-input"
              />
              <button
                type="button"
                className="ubo-btn ubo-btn-secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={extractLoading}
              >
                {extractLoading ? 'Extracting…' : 'Upload document to auto-fill fields'}
              </button>
              {extractMessage && <p className="ubo-extract-msg">{extractMessage}</p>}
            </div>

            <form
              className="ubo-form"
              onSubmit={(e) => {
                e.preventDefault();
                saveRecord(editingOpco, {
                  percentage: form.percentage,
                  status: form.status,
                  lastUpdated: form.lastUpdated || (form.status === 'Updated' ? new Date().toISOString().slice(0, 10) : ''),
                  notes: form.notes,
                  details: form.details,
                  documents: form.documents,
                });
                addUboChange(selectedParentHolding, editingOpco, `UBO details updated for ${editingOpco}`);
                setUboChanges(loadUboChanges());
              }}
            >
              <div className="ubo-form-section">
                <h4>Holding &amp; status</h4>
                <div className="ubo-form-row">
                  <label>% Holding by parent</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={form.percentage}
                    onChange={(e) => setForm((f) => ({ ...f, percentage: Number(e.target.value) || 0 }))}
                  />
                </div>
                <div className="ubo-form-row">
                  <label>UBO register status</label>
                  <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="ubo-form-row">
                  <label>Last updated (date)</label>
                  <input
                    type="date"
                    value={form.lastUpdated}
                    onChange={(e) => setForm((f) => ({ ...f, lastUpdated: e.target.value }))}
                  />
                </div>
              </div>

              <div className="ubo-form-section">
                <h4>Mandatory UBO details (ME register)</h4>
                {MANDATORY_UBO_FIELDS.map((field) => (
                  <div key={field.id} className="ubo-form-row">
                    <label>{field.label}{field.required ? ' *' : ''}</label>
                    {field.type === 'date' ? (
                      <input
                        type="date"
                        value={form.details[field.id] || ''}
                        onChange={(e) => setForm((f) => ({
                          ...f,
                          details: { ...f.details, [field.id]: e.target.value },
                        }))}
                      />
                    ) : (
                      <input
                        type="text"
                        value={form.details[field.id] || ''}
                        onChange={(e) => setForm((f) => ({
                          ...f,
                          details: { ...f.details, [field.id]: e.target.value },
                        }))}
                        placeholder={field.label}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="ubo-form-section">
                <h4>Mandatory documents (attach / confirm)</h4>
                {form.documents.map((doc) => (
                  <div key={doc.id} className="ubo-doc-row">
                    <span className="ubo-doc-label">{doc.label}</span>
                    <span className="ubo-doc-desc">{doc.description}</span>
                    <label className="ubo-doc-check">
                      <input
                        type="checkbox"
                        checked={!!doc.uploaded}
                        onChange={(e) => setForm((f) => ({
                          ...f,
                          documents: f.documents.map((d) =>
                            d.id === doc.id ? { ...d, uploaded: e.target.checked, fileName: d.fileName || (e.target.checked ? 'Attached' : ''), uploadedAt: e.target.checked ? new Date().toISOString().slice(0, 10) : '' } : d
                          ),
                        }))}
                      />
                      Uploaded
                    </label>
                    {doc.uploaded && doc.fileName && <span className="ubo-doc-filename">{doc.fileName}</span>}
                  </div>
                ))}
              </div>

              <div className="ubo-form-row">
                <label>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="Optional notes"
                />
              </div>

              <div className="ubo-form-actions">
                <button type="button" className="ubo-btn ubo-btn-secondary" onClick={() => setEditingOpco(null)}>Cancel</button>
                <button type="submit" className="ubo-btn ubo-btn-primary">Save UBO details</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View details modal */}
      {viewingOpco && (
        <div className="ubo-modal-overlay" onClick={() => setViewingOpco(null)}>
          <div className="ubo-modal ubo-modal-view ubo-modal-large" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="ubo-modal-close" onClick={() => setViewingOpco(null)} aria-label="Close" title="Close">×</button>
            <h3 className="ubo-modal-title">UBO details — {viewingOpco}</h3>
            {(() => {
              const r = getRecord(viewingOpco);
              return (
                <div className="ubo-view-details">
                  <p><strong>% Holding by parent:</strong> {r.percentage}%</p>
                  <p><strong>UBO register status:</strong> <span className={`ubo-status ubo-status-${r.status.replace(/\s+/g, '-').toLowerCase()}`}>{r.status}</span></p>
                  <p><strong>Last updated:</strong> {r.lastUpdated || '—'}</p>
                  <div className="ubo-view-section">
                    <h4>Mandatory details</h4>
                    {MANDATORY_UBO_FIELDS.map((f) => (
                      <p key={f.id}><strong>{f.label}:</strong> {r.details?.[f.id] || '—'}</p>
                    ))}
                  </div>
                  <div className="ubo-view-section">
                    <h4>Documents</h4>
                    {r.documents?.map((d) => (
                      <p key={d.id}>{d.label}: {d.uploaded ? `Uploaded${d.fileName ? ` (${d.fileName})` : ''}` : 'Not uploaded'}</p>
                    ))}
                  </div>
                  {r.notes && <p><strong>Notes:</strong><br />{r.notes}</p>}
                  <p className="ubo-download-doc-note">Download the pre-filled UBO registration document below; sign and upload via the UAE Trade Registry section.</p>
                </div>
              );
            })()}
            <div className="ubo-form-actions">
              <button type="button" className="ubo-btn ubo-btn-secondary" onClick={() => downloadUboRegistrationDocument(viewingOpco)}>Download UBO doc</button>
              <button type="button" className="ubo-btn ubo-btn-secondary" onClick={() => setViewingOpco(null)}>Close</button>
              <button type="button" className="ubo-btn ubo-btn-primary" onClick={() => { setViewingOpco(null); openEdit(viewingOpco); }}>Edit</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add record from UAE Trade Registry */}
      {registryModal && (
        <div className="ubo-modal-overlay" onClick={() => { setRegistryModal(null); setRegistryForm({ opco: '', summary: '', fileName: '', applyToUbo: true }); }}>
          <div className="ubo-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="ubo-modal-close" onClick={() => { setRegistryModal(null); setRegistryForm({ opco: '', summary: '', fileName: '', applyToUbo: true }); }} aria-label="Close" title="Close">×</button>
            <h3 className="ubo-modal-title">Add record — {registryModal.moduleLabel}</h3>
            <p className="ubo-modal-subtitle">Record from <a href={TRADE_REGISTRY_URL} target="_blank" rel="noopener noreferrer">UAE Trade Registry (traderegistry.ae)</a>. Details here will update the UBO section for the selected OpCo when you tick &quot;Apply to UBO&quot;.</p>
            <div className="ubo-form-section">
              <div className="ubo-form-row">
                <label>OpCo *</label>
                <select
                  value={registryForm.opco}
                  onChange={(e) => setRegistryForm((f) => ({ ...f, opco: e.target.value }))}
                >
                  <option value="">Select OpCo</option>
                  {opcos.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div className="ubo-form-row">
                <label>Summary / details (optional)</label>
                <textarea
                  value={registryForm.summary}
                  onChange={(e) => setRegistryForm((f) => ({ ...f, summary: e.target.value }))}
                  rows={3}
                  placeholder="Paste or type details from the registry document…"
                />
              </div>
              <div className="ubo-form-row">
                <label>File name (optional)</label>
                <input
                  type="text"
                  value={registryForm.fileName}
                  onChange={(e) => setRegistryForm((f) => ({ ...f, fileName: e.target.value }))}
                  placeholder="e.g. Ownership_Structure_OpCo_2025.pdf"
                />
              </div>
              <div className="ubo-form-row ubo-form-row-check">
                <label>
                  <input
                    type="checkbox"
                    checked={registryForm.applyToUbo}
                    onChange={(e) => setRegistryForm((f) => ({ ...f, applyToUbo: e.target.checked }))}
                  />
                  Apply to UBO (mark corresponding document as uploaded and update UBO outcome for this OpCo)
                </label>
              </div>
            </div>
            <div className="ubo-form-actions">
              <button type="button" className="ubo-btn ubo-btn-secondary" onClick={() => { setRegistryModal(null); setRegistryForm({ opco: '', summary: '', fileName: '', applyToUbo: true }); }}>Cancel</button>
              <button type="button" className="ubo-btn ubo-btn-primary" onClick={() => saveRegistryRecord(registryModal.moduleId, registryModal.moduleLabel, registryModal.uboDocId)} disabled={!registryForm.opco}>
                Save &amp; apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: View Changes */}
      {showViewChanges && (
        <div className="ubo-modal-overlay" onClick={() => setShowViewChanges(false)}>
          <div className="ubo-modal ubo-modal-large" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="ubo-modal-close" onClick={() => setShowViewChanges(false)} aria-label="Close" title="Close">×</button>
            <h3 className="ubo-modal-title">View Changes</h3>
            <p className="ubo-modal-subtitle">Recent UBO register and mandatory document changes.</p>
            {uboChanges.length === 0 ? (
              <p className="ubo-changes-empty">No changes recorded yet.</p>
            ) : (
              <ul className="ubo-changes-list">
                {uboChanges.map((entry, i) => (
                  <li key={i} className="ubo-changes-item">
                    <span className="ubo-changes-time">{entry.at ? new Date(entry.at).toLocaleString() : ''}</span>
                    <span className="ubo-changes-message">{entry.message || ''}</span>
                    {entry.opco && <span className="ubo-changes-opco">{entry.opco}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
