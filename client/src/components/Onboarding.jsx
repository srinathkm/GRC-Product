import { useState, useRef, useEffect } from 'react';
import { t } from '../i18n';
import './Onboarding.css';

const API = '/api';

const UBO_STORAGE_KEY = 'ubo_register';

function loadUboRegisterSafe() {
  try {
    const raw = localStorage.getItem(UBO_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveUboRegisterSafe(data) {
  try {
    localStorage.setItem(UBO_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function getUboKeyFor(parent, opco) {
  return `${parent || ''}::${opco || ''}`;
}

const DOCUMENT_TYPES = [
  { id: 'ubo-certificate', labelKey: 'onboardingDocUboCertificate' },
  { id: 'regional-branch-licence', labelKey: 'onboardingDocRegionalBranchLicence', multiple: true },
  { id: 'branch-office-licences', labelKey: 'onboardingDocBranchOfficeLicences', multiple: true },
  { id: 'passport', labelKey: 'onboardingDocPassport', multiple: true },
  { id: 'moa', labelKey: 'onboardingDocMoa', multiple: true },
];

const SECTOR_OPTIONS = [
  'Banking & Financial Services',
  'Insurance',
  'Capital Markets & Asset Management',
  'Fintech & Payment Services',
  'Energy & Utilities',
  'Real Estate & Construction',
  'Healthcare',
  'Retail & Consumer Goods',
  'Telecoms & Technology',
  'Government & Public Sector',
];

const LICENCING_AUTHORITY_OPTIONS = [
  'CBUAE (Central Bank UAE)',
  'DFSA (Dubai Financial Services Authority)',
  'ADGM FSRA',
  'DED / Mainland UAE',
  'JAFZA Authority',
  'DMCC Authority',
  'SAMA (Saudi Central Bank)',
  'CMA Saudi Arabia',
  'QFCRA (Qatar Financial Centre)',
  'CBB (Central Bank Bahrain)',
  'Oman CMA',
  'Kuwait CMA',
];

const LOCATION_OPTIONS = [
  'Dubai International Financial Centre',
  'Abu Dhabi Global Market',
  'Jebel Ali Free Zone',
  'Dubai Multi Commodities Centre',
  'Dubai (Mainland / Onshore)',
  'Abu Dhabi (Mainland)',
  'Sharjah (Free Zones & Mainland)',
  'Ras Al Khaimah (RAK) Free Zones',
  'Saudi Arabia (Onshore / National)',
  'Saudi Giga-Projects (NEOM, Red Sea, etc.)',
  'Qatar Financial Centre (QFC) & Mainland',
  'Bahrain (BHB, CBB)',
  'Oman (CMA, MSM)',
  'Kuwait (CMA, Boursa Kuwait)',
];

function MultiSelectDropdown({ id, label, options, selected, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggle = (value) => {
    if (selected.includes(value)) {
      onChange(selected.filter((s) => s !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const displayText = selected.length > 0 ? selected.join(', ') : placeholder;

  return (
    <div className="onboarding-multiselect-wrap" ref={containerRef}>
      <label htmlFor={id}>{label}</label>
      <button
        type="button"
        id={id}
        className="onboarding-multiselect-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className={selected.length === 0 ? 'onboarding-multiselect-placeholder' : ''}>
          {displayText}
        </span>
        <span className="onboarding-multiselect-chevron" aria-hidden>▼</span>
      </button>
      {open && (
        <div className="onboarding-multiselect-dropdown" role="listbox">
          {options.map((opt) => (
            <label key={opt} className="onboarding-multiselect-option">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function Onboarding({ language = 'en', onOpcoAdded, onApplicableFrameworksLoaded }) {
  const [uploads, setUploads] = useState({});
  const [uploadMode, setUploadMode] = useState({});
  const [uploadLinks, setUploadLinks] = useState({});
  const [documentUploadMode, setDocumentUploadMode] = useState('manual'); // 'manual' | 'application'
  const [sharepointAccount, setSharepointAccount] = useState('');
  const [sharepointConnected, setSharepointConnected] = useState(false);
  const [locations, setLocations] = useState([]);
  const [sectorOfOperations, setSectorOfOperations] = useState([]);
  const [licencingAuthorities, setLicencingAuthorities] = useState([]);
  const [applicableFrameworksOptions, setApplicableFrameworksOptions] = useState([]);
  const [applicableFrameworksSelected, setApplicableFrameworksSelected] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [parentsList, setParentsList] = useState([]);
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const [applicableFrameworksList, setApplicableFrameworksList] = useState([]);
  const [frameworksModalOpen, setFrameworksModalOpen] = useState(false);
  const [frameworksLoading, setFrameworksLoading] = useState(false);
  const [frameworksConfirmModal, setFrameworksConfirmModal] = useState(null); // { parentName, orgName } when showing "frameworks to be added" before confirm
  const [reviewData, setReviewData] = useState({
    organizationName: '',
    uboCertificateNumber: '',
    dateOfIssue: '',
    registeredAddress: '',
    tradeLicenceNumber: '',
    certificateJurisdiction: '',
    certificateParentHoldings: [],
    locations: [],
    sectorOfOperations: [],
    licencingAuthorities: [],
    applicableFrameworksSelected: [],
    parentChoice: 'existing',
    existingParent: '',
    newParentName: '',
    parentRelationshipType: '',
  });
  const [confirmedList, setConfirmedList] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [existingLinkModal, setExistingLinkModal] = useState(null); // { parentName, orgName }
  const [uboCertRequiredModal, setUboCertRequiredModal] = useState(false);
  const [extractedMemberDetailsModal, setExtractedMemberDetailsModal] = useState(null); // [{ fullName, idType, idNumber }, ...]
  const [pendingConfirm, setPendingConfirm] = useState(null); // { parentName, orgName }
  const [locationsModal, setLocationsModal] = useState(null); // { locations: string[], continue: () => void } when showing locations extracted from Regional Branch Licence
  const [lastLicenceLocationsForConfirm, setLastLicenceLocationsForConfirm] = useState([]); // locations to send with add-opco when user confirms
  const [expandedMandatoryEntityIndices, setExpandedMandatoryEntityIndices] = useState(() => new Set()); // indices in set = expanded; empty = all collapsed by default
  const fileRefs = useRef({});
  const hadRegionalBranchLicenceAtConfirm = useRef(false);

  // ── Wizard state ──────────────────────────────────────────────────────────
  const [wizardStep, setWizardStep] = useState(1); // 1=upload 2=details 3=review
  const [aiProgress, setAiProgress] = useState([]); // [{label, status:'pending'|'running'|'done'}]
  const [previewDocId, setPreviewDocId] = useState(null);
  const [justConfirmed, setJustConfirmed] = useState(null); // {opco, parent}

  const handleWizardBack = () => {
    if (wizardStep === 2) { setWizardStep(1); }
    if (wizardStep === 3) { setWizardStep(2); setShowReviewPanel(false); setAiProgress([]); }
  };

  useEffect(() => {
    // When the global document upload mode changes, force all document types to that mode.
    setUploadMode((prev) => {
      const next = { ...prev };
      DOCUMENT_TYPES.forEach((doc) => {
        next[doc.id] = documentUploadMode === 'manual' ? 'file' : 'link';
      });
      return next;
    });
  }, [documentUploadMode]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('sharepoint_connected');
    const session = params.get('session');
    if (connected === '1' && session) {
      try {
        sessionStorage.setItem('raqib_sharepoint_session', session);
      } catch (e) {}
      const u = new URL(window.location.href);
      u.searchParams.delete('sharepoint_connected');
      u.searchParams.delete('session');
      window.history.replaceState({}, '', u.pathname + u.search + u.hash);
    }
  }, []);

  useEffect(() => {
    if (documentUploadMode !== 'application') return;
    const session = sessionStorage.getItem('raqib_sharepoint_session');
    const headers = session ? { 'X-Raqib-Session': session } : {};
    fetch(`${API}/auth/sharepoint/status`, { credentials: 'include', headers })
      .then((r) => r.json())
      .then((data) => setSharepointConnected(!!data.connected))
      .catch(() => setSharepointConnected(false));
  }, [documentUploadMode]);

  useEffect(() => {
    fetch(`${API}/companies/roles`)
      .then((r) => r.json())
      .then((data) => setParentsList(data.parents || []))
      .catch(() => setParentsList([]));
  }, []);

  useEffect(() => {
    fetch(`${API}/companies/onboarding-list`)
      .then((r) => r.json())
      .then((data) => setConfirmedList(data.list || []))
      .catch(() => setConfirmedList([]));
  }, [showReviewPanel]);

  // Autosave form state to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem('raqib_onboarding_locs', JSON.stringify(locations));
      sessionStorage.setItem('raqib_onboarding_sectors', JSON.stringify(sectorOfOperations));
      sessionStorage.setItem('raqib_onboarding_licencing', JSON.stringify(licencingAuthorities));
    } catch { /* ignore */ }
  }, [locations, sectorOfOperations, licencingAuthorities]);

  // Mark AI progress done once extraction populates reviewData
  useEffect(() => {
    if (wizardStep === 3 && reviewData.organizationName && aiProgress.length > 0 && aiProgress.some((s) => s.status !== 'done')) {
      setAiProgress([
        { label: 'Reading document…', status: 'done' },
        { label: 'Extracting entity name…', status: 'done' },
        { label: 'Identifying ownership structure…', status: 'done' },
        { label: 'Mapping compliance frameworks…', status: 'done' },
      ]);
    }
  }, [reviewData.organizationName, wizardStep]);

  useEffect(() => {
    if (locations.length === 0 && sectorOfOperations.length === 0) {
      setApplicableFrameworksOptions([]);
      setApplicableFrameworksSelected([]);
      return;
    }
    fetch(`${API}/governance/frameworks-by-sector-and-location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locations, sectorOfOperations }),
    })
      .then((r) => r.json())
      .then((data) => {
        const pairs = Array.isArray(data.frameworkLocationPairs) ? data.frameworkLocationPairs : [];
        const names = [...new Set(pairs.map((p) => p.framework).filter(Boolean))];
        setApplicableFrameworksOptions(names);
        setApplicableFrameworksSelected((prev) => {
          if (prev.length === 0) return names;
          return prev.filter((f) => names.includes(f));
        });
      })
      .catch(() => {
        setApplicableFrameworksOptions([]);
      });
  }, [locations, sectorOfOperations]);

  const handleSharepointConnect = () => {
    const returnUrl = encodeURIComponent(window.location.href);
    const base = window.location.origin + (import.meta.env.VITE_API_BASE || '');
    window.location.href = `${base}${API}/auth/sharepoint?returnUrl=${returnUrl}`;
  };

  const handleSharepointDisconnect = () => {
    const session = sessionStorage.getItem('raqib_sharepoint_session');
    const headers = session ? { 'X-Raqib-Session': session } : {};
    fetch(`${API}/auth/sharepoint/disconnect`, { method: 'POST', credentials: 'include', headers })
      .then(() => {
        sessionStorage.removeItem('raqib_sharepoint_session');
        setSharepointConnected(false);
      })
      .catch(() => {});
  };

  const handleAddClick = () => {
    const uboFile = uploads['ubo-certificate'];
    const uboLink = uploadLinks['ubo-certificate']?.trim();

    let orgName = t(language, 'onboardingExtractedOrgDefault');
    if (uboFile && uboFile.name) {
      const fromFile = uboFile.name.replace(/\.[^.]+$/, '').trim();
      if (fromFile) orgName = fromFile;
    } else if (uboLink) {
      try {
        const urlObj = new URL(uboLink);
        const parts = urlObj.pathname.split('/').filter(Boolean);
        const last = parts[parts.length - 1] || urlObj.hostname;
        const decoded = decodeURIComponent(last);
        const fromLink = decoded.replace(/\.[^.]+$/, '').trim();
        if (fromLink) orgName = fromLink;
      } catch {
        const fallback = uboLink.split(/[/?#]/).filter(Boolean).pop() || '';
        const cleaned = fallback.replace(/\.[^.]+$/, '').trim();
        if (cleaned) orgName = cleaned;
      }
    }

    setReviewData({
      organizationName: orgName,
      uboCertificateNumber: '',
      dateOfIssue: '',
      registeredAddress: '',
      tradeLicenceNumber: '',
      certificateJurisdiction: '',
      certificateParentHoldings: [],
      locations: [...locations],
      sectorOfOperations: [...sectorOfOperations],
      licencingAuthorities: [...licencingAuthorities],
      applicableFrameworksSelected: [...applicableFrameworksSelected],
      parentChoice: 'existing',
      existingParent: parentsList[0] || '',
      newParentName: '',
      parentRelationshipType: '',
    });
    setWizardStep(3);
    setAiProgress([
      { label: 'Reading document…', status: 'running' },
      { label: 'Extracting entity name…', status: 'pending' },
      { label: 'Identifying ownership structure…', status: 'pending' },
      { label: 'Mapping compliance frameworks…', status: 'pending' },
    ]);
    setShowReviewPanel(true);

    // Try to refine the Organization name from the actual document using the LLM backend.
    // Best-effort: falls back silently on error and keeps the heuristic name above.
    if (uboFile) {
      (async () => {
        try {
          const formData = new FormData();
          formData.append('file', uboFile);
          const res = await fetch(`${API}/ubo/extract-org-from-file`, {
            method: 'POST',
            body: formData,
          });
          if (!res.ok) return;
          const data = await res.json();
          const extractedName = (data.organizationName || '').trim();
          const cert = data.certificate || {};
          const defaultRelationshipType = data.defaultRelationshipType || '';
          const parentsRaw = Array.isArray(data.parentHoldings) ? data.parentHoldings : [];
          const parents = parentsRaw.map((ph) => ({
            name: ph.name || '',
            ownershipPercent:
              ph.ownershipPercent != null && ph.ownershipPercent !== ''
                ? ph.ownershipPercent
                : (ph.percentageOwnership != null && ph.percentageOwnership !== ''
                    ? ph.percentageOwnership
                    : (ph.percentage != null && ph.percentage !== ''
                        ? ph.percentage
                        : '')),
            registrationNumber: ph.registrationNumber || '',
            relationshipType: ph.relationshipType || ph.type || defaultRelationshipType || '',
            // Corporate: from extraction (Jurisdiction of Incorporation / Registered Address columns only).
            corporateName: ph.corporateName || ph.name || '',
            corporateJurisdictionOfIncorporation: ph.corporateJurisdictionOfIncorporation || '',
            corporateRegisteredAddress: ph.corporateRegisteredAddress || '',
            corporateRegistrationNumber: ph.corporateRegistrationNumber || ph.registrationNumber || '',
            // Member-specific fields for Mandatory details in UBO drawer.
            individualFullName: ph.individualFullName || ph.fullName || '',
            individualNationality: ph.individualNationality || ph.nationality || '',
            individualDateOfBirth: ph.individualDateOfBirth || ph.dateOfBirth || '',
            individualPlaceOfBirth: ph.individualPlaceOfBirth || ph.placeOfBirth || '',
            individualIdType: ph.individualIdType || ph.idType || '',
            individualIdNumber: ph.individualIdNumber || ph.idNumber || '',
          }));
          setReviewData((prev) => ({
            ...prev,
            organizationName: extractedName || prev.organizationName,
            uboCertificateNumber: typeof cert.uboCertificateNumber === 'string' ? cert.uboCertificateNumber : '',
            dateOfIssue: cert.dateOfIssue || prev.dateOfIssue,
            registeredAddress: cert.registeredAddress || prev.registeredAddress,
            tradeLicenceNumber: cert.tradeLicenceNumber || prev.tradeLicenceNumber,
            certificateJurisdiction: cert.jurisdiction || prev.certificateJurisdiction,
            certificateParentHoldings: parents.length ? parents : prev.certificateParentHoldings,
            parentRelationshipType: (defaultRelationshipType === 'corporate' || defaultRelationshipType === 'member')
              ? defaultRelationshipType
              : prev.parentRelationshipType,
          }));
        } catch {
          // ignore; keep heuristic
        }
      })();
    } else if (uboLink) {
      (async () => {
        try {
          const res = await fetch(`${API}/ubo/extract-org-from-link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: uboLink }),
          });
          if (!res.ok) return;
          const data = await res.json();
          const extractedName = (data.organizationName || '').trim();
          const cert = data.certificate || {};
          const defaultRelationshipType = data.defaultRelationshipType || '';
          const parentsRaw = Array.isArray(data.parentHoldings) ? data.parentHoldings : [];
          const parents = parentsRaw.map((ph) => ({
            name: ph.name || '',
            ownershipPercent:
              ph.ownershipPercent != null && ph.ownershipPercent !== ''
                ? ph.ownershipPercent
                : (ph.percentageOwnership != null && ph.percentageOwnership !== ''
                    ? ph.percentageOwnership
                    : (ph.percentage != null && ph.percentage !== ''
                        ? ph.percentage
                        : '')),
            registrationNumber: ph.registrationNumber || '',
            relationshipType: ph.relationshipType || ph.type || defaultRelationshipType || '',
            // Corporate: from extraction (Jurisdiction of Incorporation / Registered Address columns only).
            corporateName: ph.corporateName || ph.name || '',
            corporateJurisdictionOfIncorporation: ph.corporateJurisdictionOfIncorporation || '',
            corporateRegisteredAddress: ph.corporateRegisteredAddress || '',
            corporateRegistrationNumber: ph.corporateRegistrationNumber || ph.registrationNumber || '',
            // Member-specific fields for Mandatory details in UBO drawer.
            individualFullName: ph.individualFullName || ph.fullName || '',
            individualNationality: ph.individualNationality || ph.nationality || '',
            individualDateOfBirth: ph.individualDateOfBirth || ph.dateOfBirth || '',
            individualPlaceOfBirth: ph.individualPlaceOfBirth || ph.placeOfBirth || '',
            individualIdType: ph.individualIdType || ph.idType || '',
            individualIdNumber: ph.individualIdNumber || ph.idNumber || '',
          }));
          setReviewData((prev) => ({
            ...prev,
            organizationName: extractedName || prev.organizationName,
            uboCertificateNumber: typeof cert.uboCertificateNumber === 'string' ? cert.uboCertificateNumber : '',
            dateOfIssue: cert.dateOfIssue || prev.dateOfIssue,
            registeredAddress: cert.registeredAddress || prev.registeredAddress,
            tradeLicenceNumber: cert.tradeLicenceNumber || prev.tradeLicenceNumber,
            certificateJurisdiction: cert.jurisdiction || prev.certificateJurisdiction,
            certificateParentHoldings: parents.length ? parents : prev.certificateParentHoldings,
            parentRelationshipType: (defaultRelationshipType === 'corporate' || defaultRelationshipType === 'member')
              ? defaultRelationshipType
              : prev.parentRelationshipType,
          }));
        } catch {
          // ignore and keep the heuristic name
        }
      })();
    }
  };

  const performConfirm = async (parentName, orgName) => {
    const locsToSend = lastLicenceLocationsForConfirm.length > 0 ? lastLicenceLocationsForConfirm : (Array.isArray(reviewData.locations) ? reviewData.locations : []);
    if (Array.isArray(reviewData.applicableFrameworksSelected) && reviewData.applicableFrameworksSelected.length > 0 && onApplicableFrameworksLoaded) {
      onApplicableFrameworksLoaded(reviewData.applicableFrameworksSelected);
    }
    setConfirming(true);
    try {
      const body = {
        parentName,
        organizationName: orgName,
        ...(locsToSend.length > 0 && { locations: locsToSend }),
        ...(Array.isArray(reviewData.sectorOfOperations) && reviewData.sectorOfOperations.length > 0 && { sectorOfOperations: reviewData.sectorOfOperations }),
        ...(Array.isArray(reviewData.applicableFrameworksSelected) && reviewData.applicableFrameworksSelected.length > 0 && { selectedFrameworks: reviewData.applicableFrameworksSelected }),
      };
      await fetch(`${API}/companies/add-opco`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setLastLicenceLocationsForConfirm([]);
      const listRes = await fetch(`${API}/companies/onboarding-list`);
      const listJson = await listRes.json();
      setConfirmedList(listJson.list || []);
      setShowReviewPanel(false);
      setWizardStep(1);
      setJustConfirmed({ opco: orgName, parent: parentName });
      setAiProgress([]);
      setUploads({});
      setLocations([]);
      setSectorOfOperations([]);
      setLicencingAuthorities([]);
      setApplicableFrameworksSelected([]);
      onOpcoAdded?.();

      // Sync UBO register so that UBO lookup and holding structure reflect onboarding data.
      try {
        const current = loadUboRegisterSafe();
        const today = new Date().toISOString().slice(0, 10);
        const opcoName = orgName;
        const structure = Array.isArray(reviewData.certificateParentHoldings)
          ? reviewData.certificateParentHoldings
          : [];

        if (structure.length > 0) {
          const next = { ...current };
          // Replace Holding Structure for this OpCo entirely: remove any existing
          // UBO register entries for this OpCo that are not in this confirm's list.
          const keysFromConfirm = new Set(
            structure.map((ph) => getUboKeyFor((ph.name || '').trim(), opcoName)).filter(Boolean)
          );
          Object.keys(next).forEach((k) => {
            if (k.endsWith(`::${opcoName}`) && !keysFromConfirm.has(k)) delete next[k];
          });
          structure.forEach((ph) => {
            const parentLabel = (ph.name || '').trim();
            if (!parentLabel) return;
            const key = getUboKeyFor(parentLabel, opcoName);
            const existing = next[key] || {};
            const pctRaw = ph.ownershipPercent;
            let pctValue = existing.percentage ?? 100;
            if (pctRaw !== '' && pctRaw != null) {
              if (typeof pctRaw === 'number') {
                pctValue = pctRaw;
              } else if (typeof pctRaw === 'string') {
                // Strip % and non-numeric characters, normalise decimal comma.
                const cleaned = pctRaw.replace(/[^\d.,-]/g, '').replace(',', '.');
                const num = Number(cleaned);
                if (!Number.isNaN(num)) pctValue = num;
              }
            }
            const existingDetails = (existing.details && typeof existing.details === 'object') ? existing.details : {};
            const relationshipType = ph.relationshipType || ph.type || '';
            const details = {
              ...existingDetails,
              uboCertificateNumber: reviewData.uboCertificateNumber || existingDetails.uboCertificateNumber || '',
              dateOfIssue: reviewData.dateOfIssue || existingDetails.dateOfIssue || '',
              registeredAddress: reviewData.registeredAddress || existingDetails.registeredAddress || '',
              tradeLicenceNumber: reviewData.tradeLicenceNumber || existingDetails.tradeLicenceNumber || '',
              certificateJurisdiction: reviewData.certificateJurisdiction || existingDetails.certificateJurisdiction || '',
              relationshipType: relationshipType || existingDetails.relationshipType || '',
              corporateName:
                relationshipType === 'corporate'
                  ? (ph.corporateName || ph.name || existingDetails.corporateName || '')
                  : existingDetails.corporateName || '',
              // Jurisdiction of Incorporation / Registered Address from extraction only (not certificate-level).
              corporateJurisdictionOfIncorporation:
                relationshipType === 'corporate'
                  ? (ph.corporateJurisdictionOfIncorporation ?? existingDetails.corporateJurisdictionOfIncorporation ?? '')
                  : existingDetails.corporateJurisdictionOfIncorporation ?? '',
              corporateRegisteredAddress:
                relationshipType === 'corporate'
                  ? (ph.corporateRegisteredAddress ?? existingDetails.corporateRegisteredAddress ?? '')
                  : existingDetails.corporateRegisteredAddress ?? '',
              corporateRegistrationNumber:
                relationshipType === 'corporate'
                  ? (ph.corporateRegistrationNumber || ph.registrationNumber || existingDetails.corporateRegistrationNumber || '')
                  : existingDetails.corporateRegistrationNumber || '',
              fullName:
                relationshipType === 'member'
                  ? (ph.individualFullName || existingDetails.fullName || '')
                  : existingDetails.fullName || '',
              // Nationality from document extraction (parentHoldings[].individualNationality) → OpCo Mandatory Details
              nationality:
                relationshipType === 'member'
                  ? (ph.individualNationality || existingDetails.nationality || '')
                  : existingDetails.nationality || '',
              dateOfBirth:
                relationshipType === 'member'
                  ? (ph.individualDateOfBirth || existingDetails.dateOfBirth || '')
                  : existingDetails.dateOfBirth || '',
              placeOfBirth:
                relationshipType === 'member'
                  ? (ph.individualPlaceOfBirth || existingDetails.placeOfBirth || '')
                  : existingDetails.placeOfBirth || '',
              idType:
                relationshipType === 'member'
                  ? (ph.individualIdType || existingDetails.idType || '')
                  : existingDetails.idType || '',
              idNumber:
                relationshipType === 'member'
                  ? (ph.individualIdNumber || existingDetails.idNumber || '')
                  : existingDetails.idNumber || '',
            };
            const existingDocs = Array.isArray(existing.documents) ? [...existing.documents] : [];
            const idxDoc = existingDocs.findIndex((d) => d.id === 'ubo_declaration');
            const baseDoc = idxDoc >= 0 ? existingDocs[idxDoc] : { id: 'ubo_declaration' };
            const declDoc = {
              ...baseDoc,
              id: 'ubo_declaration',
              uploaded: true,
              fileName: baseDoc.fileName || 'Onboarding UBO declaration',
              uploadedAt: today,
            };
            if (idxDoc >= 0) existingDocs[idxDoc] = declDoc;
            else existingDocs.push(declDoc);
            if (hadRegionalBranchLicenceAtConfirm.current) {
              const idxCompany = existingDocs.findIndex((d) => d.id === 'company_extract');
              const companyDoc = { id: 'company_extract', uploaded: true, fileName: 'Regional Branch Commercial Licence', uploadedAt: today };
              if (idxCompany >= 0) existingDocs[idxCompany] = { ...existingDocs[idxCompany], ...companyDoc };
              else existingDocs.push(companyDoc);
            }
            next[key] = {
              percentage: pctValue,
              status: existing.status || 'Updated',
              lastUpdated: today,
              notes: existing.notes || '',
              details,
              documents: existingDocs,
            };
          });
          saveUboRegisterSafe(next);
          hadRegionalBranchLicenceAtConfirm.current = false;
        } else if (parentName && opcoName) {
          const key = getUboKeyFor(parentName, opcoName);
          // Replace Holding Structure for this OpCo: only this parent-opco remains.
          const next = { ...current };
          Object.keys(next).forEach((k) => {
            if (k.endsWith(`::${opcoName}`) && k !== key) delete next[k];
          });
          const existing = next[key] || {};
          const existingDetails = (existing.details && typeof existing.details === 'object') ? existing.details : {};
          const details = {
            ...existingDetails,
            uboCertificateNumber: reviewData.uboCertificateNumber || existingDetails.uboCertificateNumber || '',
            dateOfIssue: reviewData.dateOfIssue || existingDetails.dateOfIssue || '',
            registeredAddress: reviewData.registeredAddress || existingDetails.registeredAddress || '',
            tradeLicenceNumber: reviewData.tradeLicenceNumber || existingDetails.tradeLicenceNumber || '',
            certificateJurisdiction: reviewData.certificateJurisdiction || existingDetails.certificateJurisdiction || '',
          };
          const existingDocs = Array.isArray(existing.documents) ? [...existing.documents] : [];
          const idxDoc = existingDocs.findIndex((d) => d.id === 'ubo_declaration');
          const baseDoc = idxDoc >= 0 ? existingDocs[idxDoc] : { id: 'ubo_declaration' };
          const declDoc = {
            ...baseDoc,
            id: 'ubo_declaration',
            uploaded: true,
            fileName: baseDoc.fileName || 'Onboarding UBO declaration',
            uploadedAt: today,
          };
          if (idxDoc >= 0) existingDocs[idxDoc] = declDoc;
          else existingDocs.push(declDoc);
          if (hadRegionalBranchLicenceAtConfirm.current) {
            const idxCompany = existingDocs.findIndex((d) => d.id === 'company_extract');
            const companyDoc = { id: 'company_extract', uploaded: true, fileName: 'Regional Branch Commercial Licence', uploadedAt: today };
            if (idxCompany >= 0) existingDocs[idxCompany] = { ...existingDocs[idxCompany], ...companyDoc };
            else existingDocs.push(companyDoc);
          }
          next[key] = {
            percentage: existing.percentage ?? 100,
            status: existing.status || 'Updated',
            lastUpdated: today,
            notes: existing.notes || '',
            details,
            documents: existingDocs,
          };
          saveUboRegisterSafe(next);
        }
        hadRegionalBranchLicenceAtConfirm.current = false;
      } catch {
        // ignore sync errors
      }
    } catch {
      // ignore, basic error handling can be added here
    } finally {
      setConfirming(false);
    }
  };

  const fetchApplicableFrameworks = async (sectors, authorities) => {
    setFrameworksLoading(true);
    try {
      const res = await fetch(`${API}/governance/applicable-frameworks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectorOfOperations: Array.isArray(sectors) ? sectors : [],
          licencingAuthorities: Array.isArray(authorities) ? authorities : [],
        }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.frameworks) ? data.frameworks : [];
    } catch {
      return [];
    } finally {
      setFrameworksLoading(false);
    }
  };

  const openViewFrameworksModal = async () => {
    const sectors = reviewData.sectorOfOperations || [];
    const authorities = reviewData.licencingAuthorities || [];
    const list = await fetchApplicableFrameworks(sectors, authorities);
    setApplicableFrameworksList(list);
    setFrameworksModalOpen(true);
    if (list.length > 0 && onApplicableFrameworksLoaded) onApplicableFrameworksLoaded(list);
  };

  const runConfirmFlow = (parentName, orgName) => {
    // Check if this parent-opco relationship already exists.
    setConfirming(true);
    fetch(`${API}/companies/by-parent?parent=${encodeURIComponent(parentName)}`)
      .then((r) => r.json())
      .then((data) => {
        const exists = (data.opcos || []).some((o) => (o.name || '').toLowerCase() === orgName.toLowerCase());
        if (exists) {
          // Show confirmation modal instead of proceeding immediately.
          setExistingLinkModal({ parentName, orgName });
          setConfirming(false);
        } else {
          performConfirm(parentName, orgName);
        }
      })
      .catch(() => {
        // On error, just proceed normally.
        performConfirm(parentName, orgName);
      });
  };

  const handleConfirm = async () => {
    const parentName = reviewData.parentChoice === 'new'
      ? reviewData.newParentName.trim()
      : reviewData.existingParent;
    const orgName = reviewData.organizationName.trim();
    if (!parentName || !orgName) return;
    if (!reviewData.uboCertificateNumber?.trim()) {
      setUboCertRequiredModal(true);
      return;
    }

    const rows = Array.isArray(reviewData.certificateParentHoldings)
      ? reviewData.certificateParentHoldings
      : [];
    const memberDetails = rows
      .filter((ph) => (ph.relationshipType || ph.type) === 'member')
      .map((ph) => ({
        fullName: (ph.individualFullName || ph.name || '').trim(),
        idType: (ph.individualIdType || '').trim(),
        idNumber: (ph.individualIdNumber || '').trim(),
      }))
      .filter((row) => row.fullName || row.idType || row.idNumber);

    const hasSectorOrLicencing = (reviewData.sectorOfOperations?.length > 0) || (reviewData.licencingAuthorities?.length > 0);

    const proceedAfterLocations = async () => {
      if (memberDetails.length > 0) {
        setPendingConfirm({ parentName, orgName });
        setExtractedMemberDetailsModal(memberDetails);
        return;
      }
      if (Array.isArray(reviewData.applicableFrameworksSelected) && reviewData.applicableFrameworksSelected.length > 0 && onApplicableFrameworksLoaded) {
        onApplicableFrameworksLoaded(reviewData.applicableFrameworksSelected);
        runConfirmFlow(parentName, orgName);
        return;
      }
      if (hasSectorOrLicencing && onApplicableFrameworksLoaded) {
        try {
          const list = await fetchApplicableFrameworks(reviewData.sectorOfOperations || [], reviewData.licencingAuthorities || []);
          setApplicableFrameworksList(list);
          setFrameworksConfirmModal({ parentName, orgName });
        } catch {
          setFrameworksConfirmModal({ parentName, orgName });
        }
        return;
      }
      runConfirmFlow(parentName, orgName);
    };

    const licenceFiles = uploads['regional-branch-licence'];
    const licenceFileList = Array.isArray(licenceFiles) ? licenceFiles : (licenceFiles ? [licenceFiles] : []);
    if (licenceFileList.length > 0) {
      hadRegionalBranchLicenceAtConfirm.current = true;
      setConfirming(true);
      try {
        const formData = new FormData();
        licenceFileList.forEach((file) => formData.append('files', file));
        const res = await fetch(`${API}/ubo/extract-locations-from-licence`, {
          method: 'POST',
          body: formData,
        });
        let locations = [];
        if (res.ok) {
          const data = await res.json();
          locations = Array.isArray(data?.locations) ? [...data.locations] : [];
        }
        setLastLicenceLocationsForConfirm(locations);
        setLocationsModal({
          locations,
          continue: () => {
            setLocationsModal(null);
            proceedAfterLocations();
          },
        });
      } catch {
        setLocationsModal({
          locations: [],
          continue: () => {
            setLocationsModal(null);
            proceedAfterLocations();
          },
        });
      } finally {
        setConfirming(false);
      }
      return;
    }

    proceedAfterLocations();
  };

  const handleFrameworksConfirmOk = () => {
    if (applicableFrameworksList.length > 0 && onApplicableFrameworksLoaded) onApplicableFrameworksLoaded(applicableFrameworksList);
    const info = frameworksConfirmModal;
    setFrameworksConfirmModal(null);
    if (info?.parentName && info?.orgName) runConfirmFlow(info.parentName, info.orgName);
  };

  const handleAnalyzeDocuments = async () => {
    const applyAnalyzedLocations = (extractedLocations) => {
      if (!Array.isArray(extractedLocations) || extractedLocations.length === 0) return;
      // Analyze should actively set the Location dropdown from certificate heading intelligence.
      setLocations([...new Set(extractedLocations)]);
    };

    if (documentUploadMode === 'application') {
      const linkRaw = uploadLinks['regional-branch-licence'] || '';
      const urls = linkRaw.trim().split(/[\n\s]+/).filter(Boolean);
      if (urls.length === 0) return;
      setAnalyzing(true);
      try {
        const session = sessionStorage.getItem('raqib_sharepoint_session');
        const headers = {
          'Content-Type': 'application/json',
          ...(session ? { 'X-Raqib-Session': session } : {}),
        };
        const body = JSON.stringify({ urls });
        const [locRes, sectorRes] = await Promise.all([
          fetch(`${API}/ubo/extract-locations-from-licence-urls`, { method: 'POST', credentials: 'include', headers, body }),
          fetch(`${API}/ubo/extract-sectors-from-documents-urls`, { method: 'POST', credentials: 'include', headers, body }),
        ]);
        const locData = locRes.ok ? await locRes.json() : {};
        const sectorData = sectorRes.ok ? await sectorRes.json() : {};
        const extractedLocations = Array.isArray(locData.locations) ? locData.locations : [];
        const extractedSectors = Array.isArray(sectorData.sectors) ? sectorData.sectors : [];
        applyAnalyzedLocations(extractedLocations);
        if (extractedSectors.length > 0) {
          setSectorOfOperations((prev) => [...new Set([...extractedSectors, ...prev])]);
        }
      } finally {
        setAnalyzing(false);
      }
      return;
    }
    const licenceFiles = uploads['regional-branch-licence'];
    const fileList = Array.isArray(licenceFiles) ? licenceFiles : (licenceFiles ? [licenceFiles] : []);
    if (fileList.length === 0) return;
    setAnalyzing(true);
    try {
      const formDataLoc = new FormData();
      const formDataSector = new FormData();
      fileList.forEach((file) => {
        formDataLoc.append('files', file);
        formDataSector.append('files', file);
      });
      const [locRes, sectorRes] = await Promise.all([
        fetch(`${API}/ubo/extract-locations-from-licence`, { method: 'POST', body: formDataLoc }),
        fetch(`${API}/ubo/extract-sectors-from-documents`, { method: 'POST', body: formDataSector }),
      ]);
      const locData = locRes.ok ? await locRes.json() : {};
      const sectorData = sectorRes.ok ? await sectorRes.json() : {};
      const extractedLocations = Array.isArray(locData.locations) ? locData.locations : [];
      const extractedSectors = Array.isArray(sectorData.sectors) ? sectorData.sectors : [];
      applyAnalyzedLocations(extractedLocations);
      if (extractedSectors.length > 0) {
        setSectorOfOperations((prev) => [...new Set([...extractedSectors, ...prev])]);
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFileChange = (docId, filesOrFile) => {
    const doc = DOCUMENT_TYPES.find((d) => d.id === docId);
    if (doc && doc.multiple) {
      const list = filesOrFile && Array.isArray(filesOrFile) ? [...filesOrFile] : (filesOrFile ? [filesOrFile] : []);
      setUploads((prev) => ({ ...prev, [docId]: list }));
    } else {
      setUploads((prev) => ({ ...prev, [docId]: filesOrFile || null }));
    }
    setPreviewDocId(docId);
  };

  const getUploadDisplay = (doc) => {
    const value = uploads[doc.id];
    if (doc.multiple && Array.isArray(value)) {
      if (value.length === 0) return t(language, 'onboardingUploadChoose');
      return value.length === 1 ? value[0].name : `${value.length} ${t(language, 'onboardingUploadFilesChosen')}`;
    }
    return value && value.name ? value.name : t(language, 'onboardingUploadChoose');
  };

  const allPreviewFiles = DOCUMENT_TYPES.flatMap((doc) => {
    const val = uploads[doc.id];
    if (!val) return [];
    const list = Array.isArray(val) ? val : [val];
    return list.filter(Boolean).map((f) => ({ name: f.name, size: f.size, docId: doc.id, docLabel: t(language, doc.labelKey) }));
  });

  const WIZARD_STEPS = [
    { num: 1, label: 'Upload Documents' },
    { num: 2, label: 'Company Details' },
    { num: 3, label: 'Review & Confirm' },
  ];

  return (
    <div className="onboarding onboarding-wizard">
      {/* ── Breadcrumb ── */}
      <div className="onboarding-breadcrumb">
        {WIZARD_STEPS.map((step, i) => (
          <span key={step.num} className="onboarding-breadcrumb-item">
            <button
              type="button"
              className={`onboarding-breadcrumb-step${wizardStep === step.num ? ' active' : ''}${wizardStep > step.num ? ' done' : ''}`}
              onClick={() => { if (wizardStep > step.num && !justConfirmed) { setWizardStep(step.num); if (step.num < 3) { setShowReviewPanel(false); setAiProgress([]); } } }}
              disabled={wizardStep <= step.num || !!justConfirmed}
            >
              <span className="onboarding-breadcrumb-num">{wizardStep > step.num ? '✓' : step.num}</span>
              <span className="onboarding-breadcrumb-label">{step.label}</span>
            </button>
            {i < WIZARD_STEPS.length - 1 && <span className="onboarding-breadcrumb-arrow">›</span>}
          </span>
        ))}
      </div>

      <div className="onboarding-wizard-layout">
        {/* ── Left: step content ── */}
        <div className="onboarding-wizard-main">

          {/* Success banner */}
          {justConfirmed && (
            <div className="onboarding-success-banner">
              <div className="onboarding-success-check">✓</div>
              <div className="onboarding-success-text">
                <div className="onboarding-success-title">{justConfirmed.opco} successfully added</div>
                <div className="onboarding-success-sub">Linked to parent holding: {justConfirmed.parent}</div>
              </div>
              <button type="button" className="onboarding-btn onboarding-btn-add" onClick={() => setJustConfirmed(null)}>
                + Add Another Entity
              </button>
            </div>
          )}

          {/* ── Step 1: Upload Documents ── */}
          {wizardStep === 1 && !justConfirmed && (
            <section className="onboarding-section onboarding-document-upload">
              <div className="onboarding-document-upload-header">
                <h3 className="onboarding-section-title">Document Upload</h3>
                <div className="onboarding-doc-mode-toggle">
                  <label className="onboarding-doc-mode-option">
                    <input type="radio" name="onboarding-doc-mode" value="manual" checked={documentUploadMode === 'manual'} onChange={() => setDocumentUploadMode('manual')} />
                    <span>Manual</span>
                  </label>
                  <label className="onboarding-doc-mode-option">
                    <input type="radio" name="onboarding-doc-mode" value="application" checked={documentUploadMode === 'application'} onChange={() => setDocumentUploadMode('application')} />
                    <span>Application</span>
                  </label>
                </div>
              </div>
              <div className="onboarding-upload-rows">
                {/* UBO Certificate */}
                <div className="onboarding-upload-row">
                  <label className="onboarding-upload-label">{t(language, 'onboardingDocUboCertificate')}</label>
                  <div className="onboarding-upload-control">
                    {documentUploadMode === 'manual' && (<>
                      <input ref={(el) => { fileRefs.current['ubo-certificate'] = el; }} type="file" accept=".pdf,.doc,.docx,image/*,application/pdf" className="onboarding-file-input" onChange={(e) => handleFileChange('ubo-certificate', e.target.files?.[0])} aria-label={t(language, 'onboardingDocUboCertificate')} />
                      <button type="button" className="onboarding-upload-btn" onClick={() => fileRefs.current['ubo-certificate']?.click()}>{uploads['ubo-certificate']?.name ?? t(language, 'onboardingUploadChoose')}</button>
                    </>)}
                    {documentUploadMode === 'application' && (<textarea className="onboarding-input onboarding-link-input onboarding-link-textarea" placeholder={t(language, 'onboardingLinkPlaceholder')} value={uploadLinks['ubo-certificate'] || ''} onChange={(e) => setUploadLinks((prev) => ({ ...prev, 'ubo-certificate': e.target.value }))} aria-label={t(language, 'onboardingDocUboCertificate')} rows={2} />)}
                  </div>
                </div>
                {/* Regional Branch Licence */}
                <div className="onboarding-upload-row">
                  <label className="onboarding-upload-label">{t(language, 'onboardingDocRegionalBranchLicence')}</label>
                  <div className="onboarding-upload-control">
                    {documentUploadMode === 'manual' && (<>
                      <input ref={(el) => { fileRefs.current['regional-branch-licence'] = el; }} type="file" accept=".pdf,.doc,.docx,image/*,application/pdf" className="onboarding-file-input" multiple onChange={(e) => handleFileChange('regional-branch-licence', e.target.files ? Array.from(e.target.files) : [])} aria-label={t(language, 'onboardingDocRegionalBranchLicence')} />
                      <button type="button" className="onboarding-upload-btn" onClick={() => fileRefs.current['regional-branch-licence']?.click()}>{Array.isArray(uploads['regional-branch-licence']) && uploads['regional-branch-licence'].length > 0 ? `${uploads['regional-branch-licence'].length} ${t(language, 'onboardingUploadFilesChosen')}` : t(language, 'onboardingUploadChoose')}</button>
                      {Array.isArray(uploads['regional-branch-licence']) && uploads['regional-branch-licence'].length > 0 && (<ul className="onboarding-upload-file-list">{uploads['regional-branch-licence'].map((file, i) => <li key={`${file.name}-${i}`}>{file.name}</li>)}</ul>)}
                    </>)}
                    {documentUploadMode === 'application' && (<textarea className="onboarding-input onboarding-link-input onboarding-link-textarea" placeholder={t(language, 'onboardingLinkPlaceholder')} value={uploadLinks['regional-branch-licence'] || ''} onChange={(e) => setUploadLinks((prev) => ({ ...prev, 'regional-branch-licence': e.target.value }))} aria-label={t(language, 'onboardingDocRegionalBranchLicence')} rows={2} />)}
                  </div>
                </div>
                {/* Branch Office Licences */}
                <div className="onboarding-upload-row">
                  <label className="onboarding-upload-label">{t(language, 'onboardingDocBranchOfficeLicences')}</label>
                  <div className="onboarding-upload-control">
                    {documentUploadMode === 'manual' && (<>
                      <input ref={(el) => { fileRefs.current['branch-office-licences'] = el; }} type="file" accept=".pdf,.doc,.docx,image/*,application/pdf" className="onboarding-file-input" multiple onChange={(e) => handleFileChange('branch-office-licences', e.target.files ? Array.from(e.target.files) : [])} aria-label={t(language, 'onboardingDocBranchOfficeLicences')} />
                      <button type="button" className="onboarding-upload-btn" onClick={() => fileRefs.current['branch-office-licences']?.click()}>{Array.isArray(uploads['branch-office-licences']) && uploads['branch-office-licences'].length > 0 ? `${uploads['branch-office-licences'].length} ${t(language, 'onboardingUploadFilesChosen')}` : t(language, 'onboardingUploadChoose')}</button>
                      {Array.isArray(uploads['branch-office-licences']) && uploads['branch-office-licences'].length > 0 && (<ul className="onboarding-upload-file-list">{uploads['branch-office-licences'].map((file, i) => <li key={`${file.name}-${i}`}>{file.name}</li>)}</ul>)}
                    </>)}
                    {documentUploadMode === 'application' && (<textarea className="onboarding-input onboarding-link-input onboarding-link-textarea" placeholder={t(language, 'onboardingLinkPlaceholder')} value={uploadLinks['branch-office-licences'] || ''} onChange={(e) => setUploadLinks((prev) => ({ ...prev, 'branch-office-licences': e.target.value }))} aria-label={t(language, 'onboardingDocBranchOfficeLicences')} rows={2} />)}
                  </div>
                </div>
                {/* Passport */}
                <div className="onboarding-upload-row">
                  <label className="onboarding-upload-label">{t(language, 'onboardingDocPassport')}</label>
                  <div className="onboarding-upload-control">
                    {documentUploadMode === 'manual' && (<>
                      <input ref={(el) => { fileRefs.current['passport'] = el; }} type="file" accept=".pdf,.doc,.docx,image/*,application/pdf" className="onboarding-file-input" multiple onChange={(e) => handleFileChange('passport', e.target.files ? Array.from(e.target.files) : [])} aria-label={t(language, 'onboardingDocPassport')} />
                      <button type="button" className="onboarding-upload-btn" onClick={() => fileRefs.current['passport']?.click()}>{Array.isArray(uploads['passport']) && uploads['passport'].length > 0 ? `${uploads['passport'].length} ${t(language, 'onboardingUploadFilesChosen')}` : t(language, 'onboardingUploadChoose')}</button>
                      {Array.isArray(uploads['passport']) && uploads['passport'].length > 0 && (<ul className="onboarding-upload-file-list">{uploads['passport'].map((file, i) => <li key={`${file.name}-${i}`}>{file.name}</li>)}</ul>)}
                    </>)}
                    {documentUploadMode === 'application' && (<textarea className="onboarding-input onboarding-link-input onboarding-link-textarea" placeholder={t(language, 'onboardingLinkPlaceholder')} value={uploadLinks['passport'] || ''} onChange={(e) => setUploadLinks((prev) => ({ ...prev, passport: e.target.value }))} aria-label={t(language, 'onboardingDocPassport')} rows={2} />)}
                  </div>
                </div>
                {/* MoA */}
                <div className="onboarding-upload-row">
                  <label className="onboarding-upload-label">{t(language, 'onboardingDocMoa')}</label>
                  <div className="onboarding-upload-control">
                    {documentUploadMode === 'manual' && (<>
                      <input ref={(el) => { fileRefs.current['moa'] = el; }} type="file" accept=".pdf,.doc,.docx,image/*,application/pdf" className="onboarding-file-input" multiple onChange={(e) => handleFileChange('moa', e.target.files ? Array.from(e.target.files) : [])} aria-label={t(language, 'onboardingDocMoa')} />
                      <button type="button" className="onboarding-upload-btn" onClick={() => fileRefs.current['moa']?.click()}>{Array.isArray(uploads['moa']) && uploads['moa'].length > 0 ? `${uploads['moa'].length} ${t(language, 'onboardingUploadFilesChosen')}` : t(language, 'onboardingUploadChoose')}</button>
                      {Array.isArray(uploads['moa']) && uploads['moa'].length > 0 && (<ul className="onboarding-upload-file-list">{uploads['moa'].map((file, i) => <li key={`${file.name}-${i}`}>{file.name}</li>)}</ul>)}
                    </>)}
                    {documentUploadMode === 'application' && (<textarea className="onboarding-input onboarding-link-input onboarding-link-textarea" placeholder={t(language, 'onboardingLinkPlaceholder')} value={uploadLinks['moa'] || ''} onChange={(e) => setUploadLinks((prev) => ({ ...prev, moa: e.target.value }))} aria-label={t(language, 'onboardingDocMoa')} rows={2} />)}
                  </div>
                </div>
              </div>
              {documentUploadMode === 'application' && (
                <div className="onboarding-sharepoint-connect">
                  {sharepointConnected ? (<>
                    <span className="onboarding-sharepoint-status">Connected to Corporate SharePoint</span>
                    <button type="button" className="onboarding-btn onboarding-btn-secondary" onClick={handleSharepointDisconnect}>Disconnect</button>
                  </>) : (<>
                    <a href="#" className="onboarding-sharepoint-link" onClick={(e) => { e.preventDefault(); setSharepointAccount('corp'); handleSharepointConnect(); }}>Add Corporate SharePoint</a>
                    <p className="onboarding-sharepoint-hint">Sign in with Corp SSO so Raqib can read the files from the links above for Analyze and Add.</p>
                  </>)}
                </div>
              )}
              <div className="onboarding-wizard-nav">
                <button type="button" className="onboarding-btn onboarding-btn-add" onClick={() => setWizardStep(2)}>
                  Next: Company Details →
                </button>
              </div>
            </section>
          )}

          {/* ── Step 2: Company Details ── */}
          {wizardStep === 2 && !justConfirmed && (
            <section className="onboarding-section onboarding-details">
              <h3 className="onboarding-section-title">{t(language, 'onboardingDetailsTitle')}</h3>
              <div className="onboarding-details-grid">
                <div className="onboarding-field">
                  <MultiSelectDropdown id="onboarding-location" label="Location" options={[...new Set([...LOCATION_OPTIONS, ...locations])]} selected={locations} onChange={setLocations} placeholder="Select mainland and free zones (GCC & Middle East)" />
                </div>
                <div className="onboarding-field">
                  <MultiSelectDropdown id="onboarding-sector" label={t(language, 'onboardingSectorOfOperations')} options={SECTOR_OPTIONS} selected={sectorOfOperations} onChange={setSectorOfOperations} placeholder={t(language, 'onboardingSectorPlaceholder')} />
                </div>
                <div className="onboarding-field">
                  <MultiSelectDropdown id="onboarding-licencing-authorities" label={t(language, 'onboardingLicencingAuthorities')} options={LICENCING_AUTHORITY_OPTIONS} selected={licencingAuthorities} onChange={setLicencingAuthorities} placeholder={t(language, 'onboardingLicencingAuthoritiesPlaceholder')} />
                </div>
                <div className="onboarding-field">
                  <MultiSelectDropdown id="onboarding-applicable-frameworks" label="Applicable Compliance Frameworks" options={applicableFrameworksOptions} selected={applicableFrameworksSelected} onChange={setApplicableFrameworksSelected} placeholder="Based on Location and Sector of Operations" />
                </div>
              </div>
              <div className="onboarding-documents-actions">
                <button type="button" className="onboarding-btn onboarding-btn-analyze" onClick={handleAnalyzeDocuments} disabled={analyzing || (documentUploadMode === 'manual' ? !(Array.isArray(uploads['regional-branch-licence']) ? uploads['regional-branch-licence'].length : uploads['regional-branch-licence'] ? 1 : 0) : !(uploadLinks['regional-branch-licence'] || '').trim())}>
                  {analyzing ? 'Analyzing…' : 'Analyze'}
                </button>
                <span className="onboarding-analyze-hint">Extract locations and sectors from Regional Branch Commercial Licence documents.</span>
              </div>
              <div className="onboarding-wizard-nav">
                <button type="button" className="onboarding-btn onboarding-btn-secondary" onClick={handleWizardBack}>← Back</button>
                <button type="button" className="onboarding-btn onboarding-btn-add" onClick={handleAddClick}>Review Entity →</button>
              </div>
            </section>
          )}

          {/* ── Step 3: Review & Confirm ── */}
          {wizardStep === 3 && showReviewPanel && !justConfirmed && (
            <section className="onboarding-section onboarding-review">
              <h3 className="onboarding-section-title">{t(language, 'onboardingReviewTitle')}</h3>
              <p className="onboarding-section-desc">{t(language, 'onboardingReviewDesc')}</p>
              <div className="onboarding-review-fields">
                <div className="onboarding-review-grid">
                  <div className="onboarding-field">
                    <label htmlFor="review-org-name">{t(language, 'onboardingOrganizationName')}</label>
                    <input id="review-org-name" type="text" className="onboarding-input" value={reviewData.organizationName} onChange={(e) => setReviewData((p) => ({ ...p, organizationName: e.target.value }))} />
                  </div>
                  <div className="onboarding-field">
                    <label htmlFor="review-ubo-cert-number">UBO Certificate Number <span className="onboarding-required">(Mandatory)</span></label>
                    <input id="review-ubo-cert-number" type="text" className="onboarding-input" placeholder="e.g. DF-UBO-2026-003" value={reviewData.uboCertificateNumber} onChange={(e) => setReviewData((p) => ({ ...p, uboCertificateNumber: e.target.value }))} />
                  </div>
                  <div className="onboarding-field">
                    <label htmlFor="review-date-of-issue">Date of Issue</label>
                    <input id="review-date-of-issue" type="text" className="onboarding-input" value={reviewData.dateOfIssue} onChange={(e) => setReviewData((p) => ({ ...p, dateOfIssue: e.target.value }))} />
                  </div>
                  <div className="onboarding-field">
                    <label htmlFor="review-registered-address">Registered Address</label>
                    <textarea id="review-registered-address" className="onboarding-textarea" rows={2} value={reviewData.registeredAddress} onChange={(e) => setReviewData((p) => ({ ...p, registeredAddress: e.target.value }))} />
                  </div>
                  <div className="onboarding-field">
                    <label htmlFor="review-trade-licence">Trade Licence Number</label>
                    <input id="review-trade-licence" type="text" className="onboarding-input" value={reviewData.tradeLicenceNumber} onChange={(e) => setReviewData((p) => ({ ...p, tradeLicenceNumber: e.target.value }))} />
                  </div>
                  <div className="onboarding-field">
                    <label htmlFor="review-jurisdiction">Jurisdiction</label>
                    <input id="review-jurisdiction" type="text" className="onboarding-input" value={reviewData.certificateJurisdiction} onChange={(e) => setReviewData((p) => ({ ...p, certificateJurisdiction: e.target.value }))} />
                  </div>
                  <div className="onboarding-field onboarding-parent-holdings-field">
                    <span className="onboarding-field-label">
                      {reviewData.parentRelationshipType === 'member' ? 'Full Name | Ownership % | Passport Number' : 'Parent Holding Name | Ownership % | Registration Number'}
                      <span className="onboarding-parent-type-header">
                        <label><input type="checkbox" checked={reviewData.parentRelationshipType === 'corporate'} onChange={() => { setReviewData((p) => { const type = 'corporate'; const rows = Array.isArray(p.certificateParentHoldings) ? p.certificateParentHoldings : []; return { ...p, parentRelationshipType: type, certificateParentHoldings: rows.map((ph) => ({ ...ph, relationshipType: type })) }; }); }} /> Corporate</label>
                        <label><input type="checkbox" checked={reviewData.parentRelationshipType === 'member'} onChange={() => { setReviewData((p) => { const type = 'member'; const rows = Array.isArray(p.certificateParentHoldings) ? p.certificateParentHoldings : []; return { ...p, parentRelationshipType: type, certificateParentHoldings: rows.map((ph) => ({ ...ph, relationshipType: type })) }; }); }} /> Member</label>
                      </span>
                    </span>
                    <div className="onboarding-parent-holdings-list">
                      {(Array.isArray(reviewData.certificateParentHoldings) && reviewData.certificateParentHoldings.length > 0 ? reviewData.certificateParentHoldings : [{}]).map((ph, idx) => (
                        <div key={`${ph.name || 'ph'}-${idx}`} className="onboarding-parent-holding-row">
                          <input type="text" className="onboarding-input" placeholder={reviewData.parentRelationshipType === 'member' ? 'Full Name' : 'Parent Holding Name'} value={ph.name || ''} onChange={(e) => { const base = Array.isArray(reviewData.certificateParentHoldings) ? [...reviewData.certificateParentHoldings] : [{}]; if (!base[idx]) base[idx] = {}; base[idx] = { ...base[idx], name: e.target.value }; setReviewData((p) => ({ ...p, certificateParentHoldings: base })); }} />
                          <input type="text" className="onboarding-input" placeholder="Ownership %" value={ph.ownershipPercent || ''} onChange={(e) => { const base = Array.isArray(reviewData.certificateParentHoldings) ? [...reviewData.certificateParentHoldings] : [{}]; if (!base[idx]) base[idx] = {}; base[idx] = { ...base[idx], ownershipPercent: e.target.value }; setReviewData((p) => ({ ...p, certificateParentHoldings: base })); }} />
                          <input type="text" className="onboarding-input" placeholder={reviewData.parentRelationshipType === 'member' ? 'Passport Number' : 'Registration Number'} value={ph.registrationNumber || ''} onChange={(e) => { const base = Array.isArray(reviewData.certificateParentHoldings) ? [...reviewData.certificateParentHoldings] : [{}]; if (!base[idx]) base[idx] = {}; base[idx] = { ...base[idx], registrationNumber: e.target.value }; setReviewData((p) => ({ ...p, certificateParentHoldings: base })); }} />
                        </div>
                      ))}
                    </div>
                    {Array.isArray(reviewData.certificateParentHoldings) && reviewData.certificateParentHoldings.length > 0 && (
                      <div className="onboarding-mandatory-details-section">
                        <h4 className="onboarding-mandatory-details-title">Mandatory details (all entities from document)</h4>
                        <p className="onboarding-mandatory-details-intro">The following entities were found in the document. Each shows the respective details for Corporate or Member as extracted.</p>
                        <div className="onboarding-mandatory-details-entities">
                          {reviewData.certificateParentHoldings.map((ph, idx) => {
                            const relType = ph.relationshipType || ph.type || reviewData.parentRelationshipType || '';
                            const isCorporate = relType === 'corporate';
                            const isExpanded = expandedMandatoryEntityIndices.has(idx);
                            return (
                              <div key={`mandatory-${ph.name || ph.corporateName || idx}-${idx}`} className={`onboarding-entity-details-card ${!isExpanded ? 'onboarding-entity-details-card-collapsed' : ''}`}>
                                <button type="button" className="onboarding-entity-details-header" onClick={() => setExpandedMandatoryEntityIndices((prev) => { const next = new Set(prev); if (next.has(idx)) next.delete(idx); else next.add(idx); return next; })} aria-expanded={isExpanded}>
                                  <span className="onboarding-entity-details-chevron" aria-hidden>{isExpanded ? '▼' : '▶'}</span>
                                  <strong>{isCorporate ? (ph.corporateName || ph.name || `Entity ${idx + 1}`) : (ph.individualFullName || ph.name || `Entity ${idx + 1}`)}</strong>
                                  <span className="onboarding-entity-type-badge">{isCorporate ? 'Corporate' : 'Member'}</span>
                                </button>
                                {isExpanded && (
                                  <div className="onboarding-entity-details-grid">
                                    {isCorporate ? (<>
                                      <div><strong>Entity Name</strong><div>{ph.corporateName || ph.name || '—'}</div></div>
                                      <div><strong>Jurisdiction of Incorporation</strong><div>{ph.corporateJurisdictionOfIncorporation || '—'}</div></div>
                                      <div><strong>Registered Address</strong><div>{ph.corporateRegisteredAddress || '—'}</div></div>
                                      <div><strong>Registration Number</strong><div>{ph.corporateRegistrationNumber || ph.registrationNumber || '—'}</div></div>
                                    </>) : (<>
                                      <div><strong>Full name (as per ID)</strong><div>{ph.individualFullName || ph.fullName || ph.name || '—'}</div></div>
                                      <div><strong>Nationality</strong><div>{ph.individualNationality || ph.nationality || '—'}</div></div>
                                      <div><strong>Date of birth</strong><div>{ph.individualDateOfBirth || ph.dateOfBirth || '—'}</div></div>
                                      <div><strong>Place of birth</strong><div>{ph.individualPlaceOfBirth || ph.placeOfBirth || '—'}</div></div>
                                      <div><strong>ID type (Passport / National ID)</strong><div>{ph.individualIdType || ph.idType || '—'}</div></div>
                                      <div><strong>ID number</strong><div>{ph.individualIdNumber || ph.idNumber || '—'}</div></div>
                                    </>)}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="onboarding-field">
                  <MultiSelectDropdown id="review-location" label="Location" options={[...new Set([...LOCATION_OPTIONS, ...(reviewData.locations || [])])]} selected={reviewData.locations || []} onChange={(v) => setReviewData((p) => ({ ...p, locations: v }))} placeholder="Select mainland and free zones (GCC & Middle East)" />
                </div>
                <div className="onboarding-field">
                  <MultiSelectDropdown id="review-sector" label={t(language, 'onboardingSectorOfOperations')} options={SECTOR_OPTIONS} selected={reviewData.sectorOfOperations} onChange={(v) => setReviewData((p) => ({ ...p, sectorOfOperations: v }))} placeholder={t(language, 'onboardingSectorPlaceholder')} />
                </div>
                <div className="onboarding-field">
                  <MultiSelectDropdown id="review-licencing" label={t(language, 'onboardingLicencingAuthorities')} options={LICENCING_AUTHORITY_OPTIONS} selected={reviewData.licencingAuthorities} onChange={(v) => setReviewData((p) => ({ ...p, licencingAuthorities: v }))} placeholder={t(language, 'onboardingLicencingAuthoritiesPlaceholder')} />
                </div>
                <div className="onboarding-field">
                  <MultiSelectDropdown id="review-applicable-frameworks" label="Applicable Compliance Frameworks" options={applicableFrameworksOptions} selected={reviewData.applicableFrameworksSelected || []} onChange={(v) => setReviewData((p) => ({ ...p, applicableFrameworksSelected: v }))} placeholder="Based on Location and Sector of Operations" />
                  <p className="onboarding-frameworks-hint">Strictly based on Location and Sector of Operations. These will be shown in Governance Framework Summary.</p>
                </div>
                <div className="onboarding-field onboarding-parent-choice">
                  <span className="onboarding-field-label">{t(language, 'onboardingLinkToParent')}</span>
                  <div className="onboarding-parent-options">
                    <label className="onboarding-radio"><input type="radio" name="parentChoice" checked={reviewData.parentChoice === 'existing'} onChange={() => setReviewData((p) => ({ ...p, parentChoice: 'existing' }))} /> {t(language, 'onboardingExistingParent')}</label>
                    <select className="onboarding-select" value={reviewData.existingParent} onChange={(e) => setReviewData((p) => ({ ...p, existingParent: e.target.value }))} disabled={reviewData.parentChoice !== 'existing'}>
                      <option value="">{t(language, 'onboardingSelectParent')}</option>
                      {parentsList.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <label className="onboarding-radio"><input type="radio" name="parentChoice" checked={reviewData.parentChoice === 'new'} onChange={() => setReviewData((p) => ({ ...p, parentChoice: 'new' }))} /> {t(language, 'onboardingNewParent')}</label>
                    <input type="text" className="onboarding-input" placeholder={t(language, 'onboardingNewParentPlaceholder')} value={reviewData.newParentName} onChange={(e) => setReviewData((p) => ({ ...p, newParentName: e.target.value }))} disabled={reviewData.parentChoice !== 'new'} />
                  </div>
                </div>
              </div>
              <div className="onboarding-actions">
                <button type="button" className="onboarding-btn onboarding-btn-secondary" onClick={handleWizardBack}>← Back</button>
                <button type="button" className="onboarding-btn onboarding-btn-confirm" onClick={handleConfirm} disabled={confirming || !reviewData.organizationName.trim() || (reviewData.parentChoice === 'existing' ? !reviewData.existingParent : !reviewData.newParentName.trim())}>
                  {confirming ? t(language, 'onboardingConfirming') : t(language, 'onboardingConfirm')}
                </button>
              </div>
            </section>
          )}

          {/* ── Confirmed list ── */}
          {confirmedList.length > 0 && (
            <section className="onboarding-section onboarding-confirmed">
              <h3 className="onboarding-section-title">{t(language, 'onboardingConfirmedTitle')}</h3>
              <p className="onboarding-section-desc">{t(language, 'onboardingConfirmedDesc')}</p>
              <div className="onboarding-confirmed-table-wrap">
                <table className="onboarding-confirmed-table">
                  <thead><tr><th>{t(language, 'onboardingOrganizationName')}</th><th>{t(language, 'onboardingParentHolding')}</th></tr></thead>
                  <tbody>{confirmedList.map((row, i) => (<tr key={`${row.opco}-${row.parent}-${i}`}><td>{row.opco}</td><td>{row.parent}</td></tr>))}</tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        {/* ── Right: Document Preview Panel ── */}
        <div className="onboarding-wizard-panel">
          <div className="onboarding-panel-header">
            <h4 className="onboarding-panel-title">Document Preview</h4>
          </div>

          {/* AI Extraction Progress */}
          {aiProgress.length > 0 && (
            <div className="onboarding-ai-progress">
              <div className="onboarding-ai-progress-title">AI Extraction</div>
              {aiProgress.map((step, i) => (
                <div key={i} className={`onboarding-ai-step onboarding-ai-step-${step.status}`}>
                  <span className="onboarding-ai-step-icon">{step.status === 'done' ? '✓' : step.status === 'running' ? '…' : '○'}</span>
                  <span className="onboarding-ai-step-label">{step.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Uploaded documents */}
          {allPreviewFiles.length === 0 ? (
            <div className="onboarding-panel-empty">
              <div className="onboarding-panel-empty-icon">📄</div>
              <p>Upload documents to preview them here</p>
              <p className="onboarding-panel-hint">Supported: PDF, Word, images</p>
            </div>
          ) : (
            <div className="onboarding-panel-docs">
              <div className="onboarding-panel-section-title">Uploaded Documents</div>
              {allPreviewFiles.map((file, i) => (
                <div key={i} className={`onboarding-panel-doc${previewDocId === file.docId ? ' active' : ''}`} onClick={() => setPreviewDocId(file.docId)}>
                  <div className="onboarding-panel-doc-icon">{file.name.endsWith('.pdf') ? '📋' : file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? '🖼️' : '📄'}</div>
                  <div className="onboarding-panel-doc-info">
                    <div className="onboarding-panel-doc-name">{file.name}</div>
                    <div className="onboarding-panel-doc-meta">{file.docLabel}{file.size ? ` · ${file.size < 1048576 ? `${Math.round(file.size / 1024)} KB` : `${(file.size / 1048576).toFixed(1)} MB`}` : ''}</div>
                  </div>
                  {previewDocId === file.docId && <span className="onboarding-panel-doc-check">✓</span>}
                </div>
              ))}
            </div>
          )}

          {/* Extracted data summary (step 3+) */}
          {wizardStep >= 3 && reviewData.organizationName && (
            <div className="onboarding-panel-extracted">
              <div className="onboarding-panel-section-title">Extracted Data</div>
              <div className="onboarding-panel-field"><span className="onboarding-panel-field-label">Entity</span><span className="onboarding-panel-field-value">{reviewData.organizationName}</span></div>
              {reviewData.certificateJurisdiction && <div className="onboarding-panel-field"><span className="onboarding-panel-field-label">Jurisdiction</span><span className="onboarding-panel-field-value">{reviewData.certificateJurisdiction}</span></div>}
              {reviewData.uboCertificateNumber && <div className="onboarding-panel-field"><span className="onboarding-panel-field-label">UBO Cert#</span><span className="onboarding-panel-field-value">{reviewData.uboCertificateNumber}</span></div>}
              {(reviewData.locations || []).length > 0 && <div className="onboarding-panel-field"><span className="onboarding-panel-field-label">Locations</span><span className="onboarding-panel-field-value">{(reviewData.locations || []).join(', ')}</span></div>}
              {(reviewData.sectorOfOperations || []).length > 0 && <div className="onboarding-panel-field"><span className="onboarding-panel-field-label">Sectors</span><span className="onboarding-panel-field-value">{(reviewData.sectorOfOperations || []).join(', ')}</span></div>}
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}

      {uboCertRequiredModal && (
        <div className="onboarding-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="ubo-cert-required-title">
          <div className="onboarding-modal">
            <div className="onboarding-modal-header">
              <h4 id="ubo-cert-required-title" className="onboarding-modal-title">UBO Certificate Number required</h4>
              <button
                type="button"
                className="onboarding-modal-close"
                aria-label="Close"
                onClick={() => setUboCertRequiredModal(false)}
              >
                ×
              </button>
            </div>
            <div className="onboarding-modal-body">
              <p>Please fill the &quot;UBO Certificate Number&quot; field.</p>
              <p>
                Format: <strong>DF-UBO-&lt;Year of Issue&gt;-&lt;3 Digit code&gt;</strong>
                <br />
                For example: <strong>DF-UBO-2026-003</strong>
              </p>
            </div>
            <div className="onboarding-modal-actions">
              <button
                type="button"
                className="onboarding-btn onboarding-btn-confirm"
                onClick={() => setUboCertRequiredModal(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {locationsModal && (
        <div className="onboarding-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="locations-modal-title">
          <div className="onboarding-modal">
            <div className="onboarding-modal-header">
              <h4 id="locations-modal-title" className="onboarding-modal-title">Locations from Regional Branch Commercial Licence</h4>
              <button
                type="button"
                className="onboarding-modal-close"
                aria-label="Close"
                onClick={() => {
                  locationsModal.continue();
                }}
              >
                ×
              </button>
            </div>
            <div className="onboarding-modal-body">
              <p className="onboarding-locations-intro">The following locations were extracted from the uploaded Regional Branch Commercial Licence document(s) using the app&apos;s LLM:</p>
              {!(locationsModal.locations && locationsModal.locations.length) ? (
                <p className="onboarding-locations-empty">No locations could be extracted. You can still continue to confirm.</p>
              ) : (
                <ul className="onboarding-locations-list">
                  {(locationsModal.locations || []).map((loc, idx) => (
                    <li key={idx}>{loc != null ? String(loc) : ''}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="onboarding-modal-actions">
              <button
                type="button"
                className="onboarding-btn onboarding-btn-confirm"
                onClick={() => locationsModal.continue()}
              >
                OK — Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {frameworksModalOpen && (
        <div className="onboarding-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="frameworks-modal-title">
          <div className="onboarding-modal onboarding-modal-frameworks">
            <div className="onboarding-modal-header">
              <h4 id="frameworks-modal-title" className="onboarding-modal-title">Applicable governance frameworks</h4>
              <button
                type="button"
                className="onboarding-modal-close"
                aria-label="Close"
                onClick={() => setFrameworksModalOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="onboarding-modal-body">
              <p className="onboarding-frameworks-modal-intro">Based on the selected Sector of Operations and Licencing Authorities, the following governance compliance frameworks apply. The Framework dropdown in Governance Framework Summary will show only these.</p>
              {applicableFrameworksList.length === 0 ? (
                <p className="onboarding-frameworks-empty">No frameworks matched. Select at least one Sector of Operations or Licencing Authority and try again.</p>
              ) : (
                <ul className="onboarding-frameworks-list">
                  {applicableFrameworksList.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="onboarding-modal-actions">
              <button
                type="button"
                className="onboarding-btn onboarding-btn-confirm"
                onClick={() => setFrameworksModalOpen(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {frameworksConfirmModal && (
        <div className="onboarding-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="frameworks-confirm-title">
          <div className="onboarding-modal onboarding-modal-frameworks">
            <div className="onboarding-modal-header">
              <h4 id="frameworks-confirm-title" className="onboarding-modal-title">Frameworks to be added for this organization</h4>
              <button
                type="button"
                className="onboarding-modal-close"
                aria-label="Close"
                onClick={() => setFrameworksConfirmModal(null)}
              >
                ×
              </button>
            </div>
            <div className="onboarding-modal-body">
              <p className="onboarding-frameworks-modal-intro">The following governance compliance frameworks will be applied based on Sector of Operations and Licencing Authorities. They will be used to filter the Framework dropdown in Governance Framework Summary.</p>
              {applicableFrameworksList.length === 0 ? (
                <p className="onboarding-frameworks-empty">No frameworks matched the current selection.</p>
              ) : (
                <ul className="onboarding-frameworks-list">
                  {applicableFrameworksList.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="onboarding-modal-actions">
              <button
                type="button"
                className="onboarding-btn onboarding-btn-secondary"
                onClick={() => setFrameworksConfirmModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="onboarding-btn onboarding-btn-confirm"
                onClick={handleFrameworksConfirmOk}
              >
                OK — Continue to confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {extractedMemberDetailsModal && extractedMemberDetailsModal.length > 0 && (
        <div className="onboarding-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="member-details-title">
          <div className="onboarding-modal">
            <div className="onboarding-modal-header">
              <h4 id="member-details-title" className="onboarding-modal-title">Extracted member details</h4>
              <button
                type="button"
                className="onboarding-modal-close"
                aria-label="Close"
                onClick={() => {
                  setExtractedMemberDetailsModal(null);
                  setPendingConfirm(null);
                }}
              >
                ×
              </button>
            </div>
            <div className="onboarding-modal-body">
              <p className="onboarding-extracted-intro">The following details were extracted from the document and will be used for Mandatory details when Member is selected:</p>
              <table className="onboarding-extracted-table">
                <thead>
                  <tr>
                    <th>Full Name</th>
                    <th>Passport (ID Type)</th>
                    <th>Passport Number</th>
                  </tr>
                </thead>
                <tbody>
                  {extractedMemberDetailsModal.map((row, idx) => (
                    <tr key={idx}>
                      <td>{row.fullName}</td>
                      <td>{row.idType}</td>
                      <td>{row.idNumber}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="onboarding-modal-actions">
              <button
                type="button"
                className="onboarding-btn onboarding-btn-confirm"
                onClick={() => {
                  const info = pendingConfirm;
                  setExtractedMemberDetailsModal(null);
                  if (info && info.parentName && info.orgName) {
                    runConfirmFlow(info.parentName, info.orgName);
                  }
                  setPendingConfirm(null);
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {existingLinkModal && (
        <div className="onboarding-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="existing-link-title">
          <div className="onboarding-modal">
            <div className="onboarding-modal-header">
              <h4 id="existing-link-title" className="onboarding-modal-title">Existing relationship detected</h4>
              <button
                type="button"
                className="onboarding-modal-close"
                aria-label="Close"
                onClick={() => setExistingLinkModal(null)}
              >
                ×
              </button>
            </div>
            <div className="onboarding-modal-body">
              <p>
                The relationship between parent holding <strong>{existingLinkModal.parentName}</strong> and OpCo{' '}
                <strong>{existingLinkModal.orgName}</strong> already exists in the system.
              </p>
              <p>
                Proceeding will <strong>update the existing structure</strong> with the new onboarding details instead of creating a duplicate.
              </p>
            </div>
            <div className="onboarding-modal-actions">
              <button
                type="button"
                className="onboarding-btn onboarding-btn-secondary"
                onClick={() => setExistingLinkModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="onboarding-btn onboarding-btn-confirm"
                onClick={() => {
                  const info = existingLinkModal;
                  setExistingLinkModal(null);
                  performConfirm(info.parentName, info.orgName);
                }}
              >
                Ok
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
