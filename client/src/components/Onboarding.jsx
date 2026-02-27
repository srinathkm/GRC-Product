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
  { id: 'regional-branch-licence', labelKey: 'onboardingDocRegionalBranchLicence' },
  { id: 'individual-commercial-registration', labelKey: 'onboardingDocIndividualCommercialRegistration', multiple: true },
  { id: 'branch-office-licences', labelKey: 'onboardingDocBranchOfficeLicences' },
];

const INDIVIDUAL_COMMERCIAL_REGISTRATION_ID = 'individual-commercial-registration';

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

export function Onboarding({ language = 'en', onOpcoAdded }) {
  const [uploads, setUploads] = useState({});
  const [uploadMode, setUploadMode] = useState({});
  const [uploadLinks, setUploadLinks] = useState({});
  const [businessActivities, setBusinessActivities] = useState('');
  const [sectorOfOperations, setSectorOfOperations] = useState([]);
  const [licencingAuthorities, setLicencingAuthorities] = useState([]);
  const [parentsList, setParentsList] = useState([]);
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const [reviewData, setReviewData] = useState({
    organizationName: '',
    uboCertificateNumber: '',
    dateOfIssue: '',
    registeredAddress: '',
    tradeLicenceNumber: '',
    certificateJurisdiction: '',
    certificateParentHoldings: [],
    businessActivities: '',
    sectorOfOperations: [],
    licencingAuthorities: [],
    parentChoice: 'existing',
    existingParent: '',
    newParentName: '',
    parentRelationshipType: '',
  });
  const [confirmedList, setConfirmedList] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [existingLinkModal, setExistingLinkModal] = useState(null); // { parentName, orgName }
  const fileRefs = useRef({});

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
      businessActivities,
      sectorOfOperations: [...sectorOfOperations],
      licencingAuthorities: [...licencingAuthorities],
      parentChoice: 'existing',
      existingParent: parentsList[0] || '',
      newParentName: '',
      parentRelationshipType: '',
    });
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
            relationshipType: ph.relationshipType || ph.type || '',
          }));
          setReviewData((prev) => ({
            ...prev,
            organizationName: extractedName || prev.organizationName,
            uboCertificateNumber: cert.uboCertificateNumber || prev.uboCertificateNumber,
            dateOfIssue: cert.dateOfIssue || prev.dateOfIssue,
            registeredAddress: cert.registeredAddress || prev.registeredAddress,
            tradeLicenceNumber: cert.tradeLicenceNumber || prev.tradeLicenceNumber,
            certificateJurisdiction: cert.jurisdiction || prev.certificateJurisdiction,
            certificateParentHoldings: parents.length ? parents : prev.certificateParentHoldings,
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
            relationshipType: ph.relationshipType || ph.type || '',
          }));
          setReviewData((prev) => ({
            ...prev,
            organizationName: extractedName || prev.organizationName,
            uboCertificateNumber: cert.uboCertificateNumber || prev.uboCertificateNumber,
            dateOfIssue: cert.dateOfIssue || prev.dateOfIssue,
            registeredAddress: cert.registeredAddress || prev.registeredAddress,
            tradeLicenceNumber: cert.tradeLicenceNumber || prev.tradeLicenceNumber,
            certificateJurisdiction: cert.jurisdiction || prev.certificateJurisdiction,
            certificateParentHoldings: parents.length ? parents : prev.certificateParentHoldings,
          }));
        } catch {
          // ignore and keep the heuristic name
        }
      })();
    }
  };

  const performConfirm = async (parentName, orgName) => {
    setConfirming(true);
    try {
      await fetch(`${API}/companies/add-opco`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentName, organizationName: orgName }),
      });
      const listRes = await fetch(`${API}/companies/onboarding-list`);
      const listJson = await listRes.json();
      setConfirmedList(listJson.list || []);
      setShowReviewPanel(false);
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
              corporateJurisdictionOfIncorporation:
                relationshipType === 'corporate'
                  ? (ph.corporateJurisdictionOfIncorporation || reviewData.certificateJurisdiction || existingDetails.corporateJurisdictionOfIncorporation || '')
                  : existingDetails.corporateJurisdictionOfIncorporation || '',
              corporateRegisteredAddress:
                relationshipType === 'corporate'
                  ? (ph.corporateRegisteredAddress || reviewData.registeredAddress || existingDetails.corporateRegisteredAddress || '')
                  : existingDetails.corporateRegisteredAddress || '',
              corporateRegistrationNumber:
                relationshipType === 'corporate'
                  ? (ph.corporateRegistrationNumber || ph.registrationNumber || existingDetails.corporateRegistrationNumber || '')
                  : existingDetails.corporateRegistrationNumber || '',
              fullName:
                relationshipType === 'member'
                  ? (ph.individualFullName || existingDetails.fullName || '')
                  : existingDetails.fullName || '',
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
      } catch {
        // ignore sync errors
      }
    } catch {
      // ignore, basic error handling can be added here
    } finally {
      setConfirming(false);
    }
  };

  const handleConfirm = () => {
    const parentName = reviewData.parentChoice === 'new'
      ? reviewData.newParentName.trim()
      : reviewData.existingParent;
    const orgName = reviewData.organizationName.trim();
    if (!parentName || !orgName) return;
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

  const handleFileChange = (docId, filesOrFile) => {
    if (docId === INDIVIDUAL_COMMERCIAL_REGISTRATION_ID) {
      const list = filesOrFile && Array.isArray(filesOrFile) ? [...filesOrFile] : (filesOrFile ? [filesOrFile] : []);
      setUploads((prev) => ({ ...prev, [docId]: list }));
    } else {
      setUploads((prev) => ({ ...prev, [docId]: filesOrFile || null }));
    }
  };

  const getUploadDisplay = (doc) => {
    const value = uploads[doc.id];
    if (doc.multiple && Array.isArray(value)) {
      if (value.length === 0) return t(language, 'onboardingUploadChoose');
      return value.length === 1 ? value[0].name : `${value.length} ${t(language, 'onboardingUploadFilesChosen')}`;
    }
    return value && value.name ? value.name : t(language, 'onboardingUploadChoose');
  };

  return (
    <div className="onboarding">
      <h2 className="onboarding-title">{t(language, 'onboardingTitle')}</h2>
      <p className="onboarding-intro">{t(language, 'onboardingIntro')}</p>

      <section className="onboarding-section onboarding-documents">
        <h3 className="onboarding-section-title">{t(language, 'onboardingDocumentsTitle')}</h3>
        <div className="onboarding-uploads">
          {DOCUMENT_TYPES.map((doc) => {
            const isMultiple = doc.id === INDIVIDUAL_COMMERCIAL_REGISTRATION_ID;
            const value = uploads[doc.id];
            const fileList = isMultiple && Array.isArray(value) ? value : [];
            const mode = uploadMode[doc.id] || 'file';
            return (
              <div key={doc.id} className="onboarding-upload-row">
                <label className="onboarding-upload-label">{t(language, doc.labelKey)}</label>
                <div className="onboarding-upload-control">
                  <div className="onboarding-upload-mode">
                    <button
                      type="button"
                      className={`onboarding-upload-mode-btn ${mode === 'file' ? 'active' : ''}`}
                      onClick={() => setUploadMode((prev) => ({ ...prev, [doc.id]: 'file' }))}
                    >
                      {t(language, 'onboardingUploadModeFile')}
                    </button>
                    <button
                      type="button"
                      className={`onboarding-upload-mode-btn ${mode === 'link' ? 'active' : ''}`}
                      onClick={() => setUploadMode((prev) => ({ ...prev, [doc.id]: 'link' }))}
                    >
                      {t(language, 'onboardingUploadModeLink')}
                    </button>
                  </div>

                  {mode === 'file' && (
                    <>
                      <input
                        ref={(el) => { fileRefs.current[doc.id] = el; }}
                        type="file"
                        accept=".pdf,.doc,.docx,image/*,application/pdf"
                        className="onboarding-file-input"
                        multiple={isMultiple}
                        onChange={(e) => {
                          if (isMultiple) {
                            const files = e.target.files ? Array.from(e.target.files) : [];
                            handleFileChange(doc.id, files);
                          } else {
                            handleFileChange(doc.id, e.target.files?.[0]);
                          }
                        }}
                        aria-label={t(language, doc.labelKey)}
                      />
                      <button
                        type="button"
                        className="onboarding-upload-btn"
                        onClick={() => fileRefs.current[doc.id]?.click()}
                      >
                        {getUploadDisplay(doc)}
                      </button>
                      {isMultiple && fileList.length > 0 && (
                        <ul className="onboarding-upload-file-list" aria-label={t(language, doc.labelKey)}>
                          {fileList.map((file, i) => (
                            <li key={`${file.name}-${i}`}>{file.name}</li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}

                  {mode === 'link' && (
                    <input
                      type="url"
                      className="onboarding-input onboarding-link-input"
                      placeholder={t(language, 'onboardingLinkPlaceholder')}
                      value={uploadLinks[doc.id] || ''}
                      onChange={(e) => setUploadLinks((prev) => ({ ...prev, [doc.id]: e.target.value }))}
                      aria-label={t(language, doc.labelKey)}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="onboarding-section onboarding-details">
        <h3 className="onboarding-section-title">{t(language, 'onboardingDetailsTitle')}</h3>
        <div className="onboarding-details-grid">
          <div className="onboarding-field">
            <label htmlFor="onboarding-business-activities">{t(language, 'onboardingBusinessActivities')}</label>
            <textarea
              id="onboarding-business-activities"
              className="onboarding-textarea"
              rows={3}
              placeholder={t(language, 'onboardingBusinessActivitiesPlaceholder')}
              value={businessActivities}
              onChange={(e) => setBusinessActivities(e.target.value)}
            />
          </div>
          <div className="onboarding-field">
            <MultiSelectDropdown
              id="onboarding-sector"
              label={t(language, 'onboardingSectorOfOperations')}
              options={SECTOR_OPTIONS}
              selected={sectorOfOperations}
              onChange={setSectorOfOperations}
              placeholder={t(language, 'onboardingSectorPlaceholder')}
            />
          </div>
          <div className="onboarding-field">
            <MultiSelectDropdown
              id="onboarding-licencing-authorities"
              label={t(language, 'onboardingLicencingAuthorities')}
              options={LICENCING_AUTHORITY_OPTIONS}
              selected={licencingAuthorities}
              onChange={setLicencingAuthorities}
              placeholder={t(language, 'onboardingLicencingAuthoritiesPlaceholder')}
            />
          </div>
        </div>
        <div className="onboarding-actions">
          <button type="button" className="onboarding-btn onboarding-btn-add" onClick={handleAddClick}>
            {t(language, 'onboardingAdd')}
          </button>
        </div>
      </section>

      {showReviewPanel && (
        <section className="onboarding-section onboarding-review">
          <h3 className="onboarding-section-title">{t(language, 'onboardingReviewTitle')}</h3>
          <p className="onboarding-section-desc">{t(language, 'onboardingReviewDesc')}</p>
          <div className="onboarding-review-fields">
            <div className="onboarding-review-grid">
              <div className="onboarding-field">
                <label htmlFor="review-org-name">{t(language, 'onboardingOrganizationName')}</label>
                <input
                  id="review-org-name"
                  type="text"
                  className="onboarding-input"
                  value={reviewData.organizationName}
                  onChange={(e) => setReviewData((p) => ({ ...p, organizationName: e.target.value }))}
                />
              </div>
              <div className="onboarding-field">
                <label htmlFor="review-ubo-cert-number">UBO Certificate Number</label>
                <input
                  id="review-ubo-cert-number"
                  type="text"
                  className="onboarding-input"
                  value={reviewData.uboCertificateNumber}
                  onChange={(e) => setReviewData((p) => ({ ...p, uboCertificateNumber: e.target.value }))}
                />
              </div>
              <div className="onboarding-field">
                <label htmlFor="review-date-of-issue">Date of Issue</label>
                <input
                  id="review-date-of-issue"
                  type="text"
                  className="onboarding-input"
                  value={reviewData.dateOfIssue}
                  onChange={(e) => setReviewData((p) => ({ ...p, dateOfIssue: e.target.value }))}
                />
              </div>
              <div className="onboarding-field">
                <label htmlFor="review-registered-address">Registered Address</label>
                <textarea
                  id="review-registered-address"
                  className="onboarding-textarea"
                  rows={2}
                  value={reviewData.registeredAddress}
                  onChange={(e) => setReviewData((p) => ({ ...p, registeredAddress: e.target.value }))}
                />
              </div>
              <div className="onboarding-field">
                <label htmlFor="review-trade-licence">Trade Licence Number</label>
                <input
                  id="review-trade-licence"
                  type="text"
                  className="onboarding-input"
                  value={reviewData.tradeLicenceNumber}
                  onChange={(e) => setReviewData((p) => ({ ...p, tradeLicenceNumber: e.target.value }))}
                />
              </div>
              <div className="onboarding-field">
                <label htmlFor="review-jurisdiction">Jurisdiction</label>
                <input
                  id="review-jurisdiction"
                  type="text"
                  className="onboarding-input"
                  value={reviewData.certificateJurisdiction}
                  onChange={(e) => setReviewData((p) => ({ ...p, certificateJurisdiction: e.target.value }))}
                />
              </div>
              <div className="onboarding-field onboarding-parent-holdings-field">
                <span className="onboarding-field-label">
                  Parent Holding Name | Ownership % | Registration Number
                  <span className="onboarding-parent-type-header">
                    <label>
                      <input
                        type="checkbox"
                        checked={reviewData.parentRelationshipType === 'corporate'}
                        onChange={() => {
                          setReviewData((p) => {
                            const type = 'corporate';
                            const rows = Array.isArray(p.certificateParentHoldings) ? p.certificateParentHoldings : [];
                            const updatedRows = rows.map((ph) => ({ ...ph, relationshipType: type }));
                            return {
                              ...p,
                              parentRelationshipType: type,
                              certificateParentHoldings: updatedRows,
                            };
                          });
                        }}
                      />
                      Corporate
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={reviewData.parentRelationshipType === 'member'}
                        onChange={() => {
                          setReviewData((p) => {
                            const type = 'member';
                            const rows = Array.isArray(p.certificateParentHoldings) ? p.certificateParentHoldings : [];
                            const updatedRows = rows.map((ph) => ({ ...ph, relationshipType: type }));
                            return {
                              ...p,
                              parentRelationshipType: type,
                              certificateParentHoldings: updatedRows,
                            };
                          });
                        }}
                      />
                      Member
                    </label>
                  </span>
                </span>
                <div className="onboarding-parent-holdings-list">
                  {(Array.isArray(reviewData.certificateParentHoldings) && reviewData.certificateParentHoldings.length > 0
                    ? reviewData.certificateParentHoldings
                    : [{}]
                  ).map((ph, idx) => (
                    <div key={`${ph.name || 'ph'}-${idx}`} className="onboarding-parent-holding-row">
                      <input
                        type="text"
                        className="onboarding-input"
                        placeholder="Parent Holding Name"
                        value={ph.name || ''}
                        onChange={(e) => {
                          const base = Array.isArray(reviewData.certificateParentHoldings)
                            ? [...reviewData.certificateParentHoldings]
                            : [{}];
                          if (!base[idx]) base[idx] = {};
                          base[idx] = { ...base[idx], name: e.target.value };
                          setReviewData((p) => ({ ...p, certificateParentHoldings: base }));
                        }}
                      />
                      <input
                        type="text"
                        className="onboarding-input"
                        placeholder="Ownership %"
                        value={ph.ownershipPercent || ''}
                        onChange={(e) => {
                          const base = Array.isArray(reviewData.certificateParentHoldings)
                            ? [...reviewData.certificateParentHoldings]
                            : [{}];
                          if (!base[idx]) base[idx] = {};
                          base[idx] = { ...base[idx], ownershipPercent: e.target.value };
                          setReviewData((p) => ({ ...p, certificateParentHoldings: base }));
                        }}
                      />
                      <input
                        type="text"
                        className="onboarding-input"
                        placeholder="Registration Number"
                        value={ph.registrationNumber || ''}
                        onChange={(e) => {
                          const base = Array.isArray(reviewData.certificateParentHoldings)
                            ? [...reviewData.certificateParentHoldings]
                            : [{}];
                          if (!base[idx]) base[idx] = {};
                          base[idx] = { ...base[idx], registrationNumber: e.target.value };
                          setReviewData((p) => ({ ...p, certificateParentHoldings: base }));
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="onboarding-field">
              <label htmlFor="review-business-activities">{t(language, 'onboardingBusinessActivities')}</label>
              <textarea
                id="review-business-activities"
                className="onboarding-textarea"
                rows={3}
                value={reviewData.businessActivities}
                onChange={(e) => setReviewData((p) => ({ ...p, businessActivities: e.target.value }))}
              />
            </div>
            <div className="onboarding-field">
              <MultiSelectDropdown
                id="review-sector"
                label={t(language, 'onboardingSectorOfOperations')}
                options={SECTOR_OPTIONS}
                selected={reviewData.sectorOfOperations}
                onChange={(v) => setReviewData((p) => ({ ...p, sectorOfOperations: v }))}
                placeholder={t(language, 'onboardingSectorPlaceholder')}
              />
            </div>
            <div className="onboarding-field">
              <MultiSelectDropdown
                id="review-licencing"
                label={t(language, 'onboardingLicencingAuthorities')}
                options={LICENCING_AUTHORITY_OPTIONS}
                selected={reviewData.licencingAuthorities}
                onChange={(v) => setReviewData((p) => ({ ...p, licencingAuthorities: v }))}
                placeholder={t(language, 'onboardingLicencingAuthoritiesPlaceholder')}
              />
            </div>
            <div className="onboarding-field onboarding-parent-choice">
              <span className="onboarding-field-label">{t(language, 'onboardingLinkToParent')}</span>
              <div className="onboarding-parent-options">
                <label className="onboarding-radio">
                  <input
                    type="radio"
                    name="parentChoice"
                    checked={reviewData.parentChoice === 'existing'}
                    onChange={() => setReviewData((p) => ({ ...p, parentChoice: 'existing' }))}
                  />
                  {t(language, 'onboardingExistingParent')}
                </label>
                <select
                  className="onboarding-select"
                  value={reviewData.existingParent}
                  onChange={(e) => setReviewData((p) => ({ ...p, existingParent: e.target.value }))}
                  disabled={reviewData.parentChoice !== 'existing'}
                >
                  <option value="">{t(language, 'onboardingSelectParent')}</option>
                  {parentsList.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <label className="onboarding-radio">
                  <input
                    type="radio"
                    name="parentChoice"
                    checked={reviewData.parentChoice === 'new'}
                    onChange={() => setReviewData((p) => ({ ...p, parentChoice: 'new' }))}
                  />
                  {t(language, 'onboardingNewParent')}
                </label>
                <input
                  type="text"
                  className="onboarding-input"
                  placeholder={t(language, 'onboardingNewParentPlaceholder')}
                  value={reviewData.newParentName}
                  onChange={(e) => setReviewData((p) => ({ ...p, newParentName: e.target.value }))}
                  disabled={reviewData.parentChoice !== 'new'}
                />
              </div>
            </div>
          </div>
          <div className="onboarding-actions">
            <button type="button" className="onboarding-btn onboarding-btn-secondary" onClick={() => setShowReviewPanel(false)}>
              {t(language, 'onboardingCancel')}
            </button>
            <button
              type="button"
              className="onboarding-btn onboarding-btn-confirm"
              onClick={handleConfirm}
              disabled={confirming || !reviewData.organizationName.trim() || (reviewData.parentChoice === 'existing' ? !reviewData.existingParent : !reviewData.newParentName.trim())}
            >
              {confirming ? t(language, 'onboardingConfirming') : t(language, 'onboardingConfirm')}
            </button>
          </div>
        </section>
      )}

      {confirmedList.length > 0 && (
        <section className="onboarding-section onboarding-confirmed">
          <h3 className="onboarding-section-title">{t(language, 'onboardingConfirmedTitle')}</h3>
          <p className="onboarding-section-desc">{t(language, 'onboardingConfirmedDesc')}</p>
          <div className="onboarding-confirmed-table-wrap">
            <table className="onboarding-confirmed-table">
              <thead>
                <tr>
                  <th>{t(language, 'onboardingOrganizationName')}</th>
                  <th>{t(language, 'onboardingParentHolding')}</th>
                </tr>
              </thead>
              <tbody>
                {confirmedList.map((row, i) => (
                  <tr key={`${row.opco}-${row.parent}-${i}`}>
                    <td>{row.opco}</td>
                    <td>{row.parent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {existingLinkModal && (
        <div className="onboarding-modal-backdrop" role="dialog" aria-modal="true">
          <div className="onboarding-modal">
            <div className="onboarding-modal-header">
              <h4 className="onboarding-modal-title">Existing relationship detected</h4>
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
