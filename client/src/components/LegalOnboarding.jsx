import { useState, useEffect, useRef, useCallback } from 'react';
import './LegalOnboarding.css';
import { DocumentAutoFill } from './DocumentAutoFill.jsx';

const API = '/api';

// ─────────────────────────────────────────────
// Module field definitions (CLO/Legal Advisor perspective)
// ─────────────────────────────────────────────
const MODULE_CONFIGS = {
  poa: {
    id: 'poa',
    label: 'POA Management',
    icon: '📜',
    description: 'Upload and extract Power of Attorney documents. Captures holder details, authority scope, validity dates, notarisation status and jurisdictional law — essential for entities operating across multiple jurisdictions.',
    endpoint: `${API}/poa`,
    extractEndpoint: `${API}/poa/extract`,
    aiExtract: true,
    acceptBulk: true,
    requiredKeys: ['parent', 'holderName', 'scope'],
    fields: [
      { key: 'fileId',          label: 'File ID / Notarisation Ref',      type: 'text',     hint: 'Unique reference from the notarised document.' },
      { key: 'parent',          label: 'Parent Holding',                   type: 'text',     required: true },
      { key: 'opco',            label: 'Legal Entity / OpCo',              type: 'text' },
      { key: 'holderName',      label: 'Holder Full Name (as per passport)',type: 'text',     required: true, hint: 'Exact name of the attorney-in-fact.' },
      { key: 'holderRole',      label: 'Holder Role / Designation',        type: 'text' },
      { key: 'poaType',         label: 'POA Type',                         type: 'select',   options: ['Banking', 'General', 'Government', 'Real Estate', 'Corporate', 'Limited', 'Special'] },
      { key: 'scope',           label: 'Scope / Authorities Granted',      type: 'textarea', required: true, hint: 'List all numbered powers and any stated limitations.' },
      { key: 'jurisdiction',    label: 'Jurisdiction',                     type: 'text',     hint: 'City or emirate where the POA was executed.' },
      { key: 'issuingAuthority',label: 'Issuing Authority / Governing Law',type: 'text' },
      { key: 'signedOn',        label: 'Signed On',                        type: 'date' },
      { key: 'validFrom',       label: 'Valid From',                       type: 'date' },
      { key: 'validUntil',      label: 'Valid Until',                      type: 'date',     hint: 'Critical — missed expiry means loss of legal authority.' },
      { key: 'notarised',       label: 'Notarised',                        type: 'checkbox' },
      { key: 'mofaStamp',       label: 'MOFA Stamp (Ministry of Foreign Affairs)', type: 'checkbox', hint: 'Mandatory for use in UAE government transactions.' },
      { key: 'embassyStamp',    label: 'Embassy / Apostille Stamp',        type: 'checkbox' },
      { key: 'notes',           label: 'Notes / Conditions',               type: 'textarea' },
    ],
    aiSteps: [
      'Extracting document text and structure',
      'Identifying holder name and role',
      'Parsing authority scope and limitations',
      'Extracting dates and validity period',
      'Checking notarisation and stamp status',
    ],
  },
  ip: {
    id: 'ip',
    label: 'IP Management',
    icon: '®',
    description: 'Register trademarks, patents and design rights. Tracks class, registration number, renewal deadlines and agent details — missed renewals result in irrevocable loss of IP rights.',
    endpoint: `${API}/ip`,
    aiExtract: false,
    acceptBulk: true,
    requiredKeys: ['parent', 'mark', 'jurisdiction'],
    fields: [
      { key: 'parent',          label: 'Parent Holding',          type: 'text',   required: true },
      { key: 'opco',            label: 'Legal Entity / OpCo',     type: 'text' },
      { key: 'mark',            label: 'Trademark / IP Name',     type: 'text',   required: true, hint: 'The registered or applied-for mark exactly as on certificate.' },
      { key: 'class',           label: 'IP Class (Nice Class)',   type: 'text',   hint: 'WIPO Nice Classification number(s), e.g. Class 36 for financial services.' },
      { key: 'ipType',          label: 'IP Type',                 type: 'select', options: ['Trademark', 'Patent', 'Design Right', 'Trade Name', 'Copyright', 'Domain'] },
      { key: 'jurisdiction',    label: 'Jurisdiction',            type: 'text',   required: true },
      { key: 'registrationNo',  label: 'Registration Number',     type: 'text' },
      { key: 'applicationNo',   label: 'Application Number',      type: 'text' },
      { key: 'filingDate',      label: 'Filing Date',             type: 'date' },
      { key: 'registrationDate',label: 'Registration Date',       type: 'date' },
      { key: 'renewalDate',     label: 'Renewal / Expiry Date',   type: 'date',   hint: 'CRITICAL — alert at 6 months prior to expiry.' },
      { key: 'status',          label: 'Status',                  type: 'select', options: ['Active', 'Pending', 'Expired', 'Opposed', 'Cancelled', 'Lapsed'] },
      { key: 'agent',           label: 'IP Agent / Representative',type: 'text' },
      { key: 'notes',           label: 'Notes',                   type: 'textarea' },
    ],
    aiSteps: [],
  },
  licence: {
    id: 'licence',
    label: 'Licence Management',
    icon: '🏛',
    description: 'Track commercial, professional and regulatory licences. Expiry of a key licence can result in suspension of operations, regulatory penalties or loss of market authorisation.',
    endpoint: `${API}/licences`,
    aiExtract: false,
    acceptBulk: true,
    requiredKeys: ['parent', 'licenceType', 'jurisdiction'],
    fields: [
      { key: 'parent',          label: 'Parent Holding',          type: 'text',   required: true },
      { key: 'opco',            label: 'Legal Entity / OpCo',     type: 'text' },
      { key: 'licenceType',     label: 'Licence Type',            type: 'text',   required: true, hint: 'E.g. Commercial, Financial Services, Healthcare, Import/Export.' },
      { key: 'licenceNo',       label: 'Licence Number',          type: 'text' },
      { key: 'jurisdiction',    label: 'Jurisdiction',            type: 'text',   required: true },
      { key: 'issuingAuthority',label: 'Issuing Authority',       type: 'text' },
      { key: 'regulatoryBody',  label: 'Regulatory Body',         type: 'text',   hint: 'E.g. DFSA, CBUAE, SAMA, DED.' },
      { key: 'validFrom',       label: 'Valid From',              type: 'date' },
      { key: 'validUntil',      label: 'Valid Until / Renewal',   type: 'date',   hint: 'Renewal triggers 60 days before expiry per most GCC regulators.' },
      { key: 'status',          label: 'Status',                  type: 'select', options: ['Active', 'Pending Renewal', 'Under Review', 'Suspended', 'Expired', 'Revoked'] },
      { key: 'dependencies',    label: 'Dependent Licences / Conditions', type: 'text', hint: 'List any conditions or prerequisite approvals.' },
      { key: 'renewalFee',      label: 'Renewal Fee (currency)',  type: 'text' },
      { key: 'notes',           label: 'Notes',                   type: 'textarea' },
    ],
    aiSteps: [],
  },
  litigation: {
    id: 'litigation',
    label: 'Litigations Management',
    icon: '⚖',
    description: 'Record court cases, arbitration proceedings and regulatory investigations. Tracks financial exposure, counsel assignments and hearing schedules — essential for board reporting and provisioning.',
    endpoint: `${API}/litigations`,
    aiExtract: true,
    acceptBulk: true,
    requiredKeys: ['parent', 'caseId', 'court'],
    fields: [
      { key: 'parent',          label: 'Parent Holding',               type: 'text',   required: true },
      { key: 'opco',            label: 'Legal Entity / OpCo',          type: 'text' },
      { key: 'caseId',          label: 'Case ID / Reference Number',   type: 'text',   required: true, hint: 'Official court or arbitration reference number.' },
      { key: 'court',           label: 'Court / Forum',                type: 'text',   required: true, hint: 'E.g. DIFC Court, ADGM Courts, Dubai Courts, DIAC Arbitration.' },
      { key: 'jurisdiction',    label: 'Jurisdiction',                 type: 'text' },
      { key: 'claimType',       label: 'Claim Type',                   type: 'select', options: ['Commercial Dispute', 'Employment', 'Regulatory Enforcement', 'IP Dispute', 'Contract Breach', 'Real Estate', 'Tax / Customs', 'Other'] },
      { key: 'claimant',        label: 'Claimant',                     type: 'text',   hint: 'Party bringing the claim.' },
      { key: 'respondent',      label: 'Respondent / Defendant',       type: 'text' },
      { key: 'claimAmount',     label: 'Claim Amount (with currency)', type: 'text',   hint: 'As stated in the claim statement.' },
      { key: 'expectedExposure',label: 'Expected Financial Exposure',  type: 'text',   hint: 'Legal team estimate for provisioning and board disclosure.' },
      { key: 'status',          label: 'Status',                       type: 'select', options: ['Open', 'In Progress', 'Discovery / Evidence Stage', 'Awaiting Judgment', 'Settled', 'Closed – Won', 'Closed – Lost', 'Appeal Filed', 'Enforcement Stage'] },
      { key: 'filingDate',      label: 'Filing / Commencement Date',   type: 'date' },
      { key: 'nextHearingDate', label: 'Next Hearing / Deadline Date', type: 'date',   hint: 'Upcoming procedural deadline or hearing date.' },
      { key: 'externalCounsel', label: 'External Counsel / Law Firm',  type: 'text' },
      { key: 'internalOwner',   label: 'Internal Legal Owner',         type: 'text' },
      { key: 'provisioned',     label: 'Provision Made in Accounts',   type: 'checkbox', hint: 'Has finance been notified and a provision recorded?' },
      { key: 'boardNotified',   label: 'Board / Audit Committee Notified', type: 'checkbox' },
      { key: 'notes',           label: 'Notes / Strategy Summary',     type: 'textarea' },
    ],
    aiSteps: [],
  },
};

// ─────────────────────────────────────────────
// Utility: normalize a string for fuzzy header matching
// ─────────────────────────────────────────────
function normalizeKey(s) {
  return String(s || '').toLowerCase().replace(/[\s_\-\.]/g, '');
}

/**
 * Given source file headers and module expected field keys,
 * returns { conformant: bool, matchedKeys: [], unmatchedKeys: [], headerMap: {} }
 * headerMap: { sourceHeader -> bestMatchedFieldKey | null }
 */
function checkConformance(sourceHeaders, moduleConfig) {
  const expectedKeys = moduleConfig.fields.map((f) => f.key);
  const headerMap = {};
  const matchedKeys = [];

  for (const header of sourceHeaders) {
    const normH = normalizeKey(header);
    const matched = expectedKeys.find(
      (k) => normalizeKey(k) === normH || normalizeKey(k).includes(normH) || normH.includes(normalizeKey(k))
    );
    headerMap[header] = matched || null;
    if (matched && !matchedKeys.includes(matched)) matchedKeys.push(matched);
  }

  const requiredMatched = moduleConfig.requiredKeys.filter((k) => matchedKeys.includes(k));
  const conformant = requiredMatched.length === moduleConfig.requiredKeys.length &&
    matchedKeys.length >= Math.ceil(expectedKeys.length * 0.4);

  return {
    conformant,
    matchedKeys,
    unmatchedSourceHeaders: sourceHeaders.filter((h) => !headerMap[h]),
    headerMap,
  };
}

/**
 * Find a saved custom mapping that best matches the given source headers.
 * Returns the mapping object or null.
 */
function findMatchingMapping(sourceHeaders, savedMappings) {
  if (!savedMappings || savedMappings.length === 0) return null;
  const normSource = new Set(sourceHeaders.map(normalizeKey));
  let best = null;
  let bestScore = 0;
  for (const mapping of savedMappings) {
    const mappingKeys = Object.keys(mapping.fieldMap || {});
    const matchCount = mappingKeys.filter((k) => normSource.has(normalizeKey(k))).length;
    const score = mappingKeys.length > 0 ? matchCount / mappingKeys.length : 0;
    if (score > bestScore && score >= 0.6) {
      bestScore = score;
      best = mapping;
    }
  }
  return best;
}

// ─────────────────────────────────────────────
// FieldMappingModal
// ─────────────────────────────────────────────
function FieldMappingModal({ moduleConfig, sourceHeaders, initialMap, onSave, onUseOnce, onCancel }) {
  const [fieldMap, setFieldMap] = useState(() => {
    const map = {};
    for (const h of sourceHeaders) {
      map[h] = initialMap?.[h] || '';
    }
    return map;
  });
  const [mappingName, setMappingName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const appFields = [{ key: '', label: '— Ignore this column —' }, ...moduleConfig.fields];

  const handleSave = async () => {
    if (!mappingName.trim()) { setError('Please enter a name for this mapping.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API}/field-mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: mappingName.trim(),
          module: moduleConfig.id,
          fieldMap,
          sourceFields: sourceHeaders,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      onSave(data.mapping, fieldMap);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="lo-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="fm-modal-title">
      <div className="lo-modal lo-modal--mapping">
        <div className="lo-modal-header">
          <h2 id="fm-modal-title">Field Mapping Required</h2>
          <p className="lo-modal-subtitle">
            The uploaded file has column names that don't directly match the <strong>{moduleConfig.label}</strong> fields.
            Map each source column to the correct application field, then save the mapping for future reuse.
          </p>
        </div>
        <div className="lo-modal-body">
          <div className="lo-mapping-table">
            <div className="lo-mapping-table-head">
              <span>Source Column (from file)</span>
              <span>Maps To Application Field</span>
            </div>
            {sourceHeaders.map((header) => (
              <div key={header} className="lo-mapping-row">
                <span className="lo-mapping-source">{header}</span>
                <select
                  className="lo-mapping-select"
                  value={fieldMap[header] || ''}
                  onChange={(e) => setFieldMap((m) => ({ ...m, [header]: e.target.value }))}
                >
                  {appFields.map((f) => (
                    <option key={f.key} value={f.key}>{f.label || f.key}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="lo-mapping-save-row">
            <label htmlFor="mapping-name" className="lo-mapping-name-label">
              Save this mapping as:
            </label>
            <input
              id="mapping-name"
              type="text"
              className="lo-mapping-name-input"
              placeholder="e.g. Court System Export Format"
              value={mappingName}
              onChange={(e) => setMappingName(e.target.value)}
              maxLength={80}
            />
            <span className="lo-mapping-badge-preview">Custom Mapping</span>
          </div>
          {error && <p className="lo-mapping-error">{error}</p>}
        </div>
        <div className="lo-modal-footer">
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn-secondary" onClick={() => onUseOnce(fieldMap)}>
            Use Once (don't save)
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Mapping & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MappingInUseToast — shown when a saved mapping is auto-applied
// ─────────────────────────────────────────────
function MappingInUseToast({ mappingName, onDismiss }) {
  return (
    <div className="lo-mapping-toast" role="status">
      <span className="lo-mapping-toast-icon">🔗</span>
      <span>
        Custom mapping <strong>"{mappingName}"</strong> is being applied to this file.
      </span>
      <button className="lo-mapping-toast-dismiss" onClick={onDismiss} aria-label="Dismiss">×</button>
    </div>
  );
}

// ─────────────────────────────────────────────
// AIProgressPanel — shown in right panel during extraction
// ─────────────────────────────────────────────
function AIProgressPanel({ steps }) {
  if (!steps || steps.length === 0) return null;
  return (
    <div className="lo-ai-progress">
      <h4 className="lo-ai-progress-title">AI Extraction in Progress</h4>
      <ul className="lo-ai-steps">
        {steps.map((step, i) => (
          <li key={i} className={`lo-ai-step lo-ai-step--${step.status}`}>
            <span className="lo-ai-step-icon">
              {step.status === 'done' ? '✓' : step.status === 'running' ? '⟳' : '○'}
            </span>
            <span className="lo-ai-step-label">{step.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────
// FormField — renders a single field based on type
// ─────────────────────────────────────────────
function FormField({ field, value, onChange }) {
  const handleChange = (e) => {
    const val = field.type === 'checkbox' ? e.target.checked : e.target.value;
    onChange(field.key, val);
  };

  if (field.type === 'checkbox') {
    return (
      <div className="lo-field lo-field--checkbox">
        <label className="lo-field-checkbox-label">
          <input type="checkbox" checked={!!value} onChange={handleChange} />
          <span>{field.label}</span>
        </label>
        {field.hint && <span className="lo-field-hint">{field.hint}</span>}
      </div>
    );
  }

  // Textarea and full-width fields span both grid columns
  const isWide = field.type === 'textarea';
  return (
    <div
      className={`lo-field ${field.required ? 'lo-field--required' : ''}`}
      style={isWide ? { gridColumn: '1 / -1' } : undefined}
    >
      <label className="lo-field-label" htmlFor={`field-${field.key}`}>
        {field.label}
        {field.required && <span className="lo-field-required-star" aria-hidden>*</span>}
      </label>
      {field.type === 'textarea' ? (
        <textarea
          id={`field-${field.key}`}
          className="lo-field-input lo-field-textarea"
          value={value || ''}
          onChange={handleChange}
          rows={4}
          placeholder={field.hint || ''}
        />
      ) : field.type === 'select' ? (
        <select
          id={`field-${field.key}`}
          className="lo-field-input"
          value={value || ''}
          onChange={handleChange}
        >
          <option value="">— Select —</option>
          {(field.options || []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : (
        <input
          id={`field-${field.key}`}
          type={field.type}
          className="lo-field-input"
          value={value || ''}
          onChange={handleChange}
          placeholder={field.hint || ''}
        />
      )}
      {field.hint && field.type !== 'textarea' && (
        <span className="lo-field-hint">{field.hint}</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// LegalOnboardingPanel — right-panel component (top-level to keep Fast Refresh happy)
// ─────────────────────────────────────────────
function LegalOnboardingPanel({ wizardStep, config, aiProgress, uploadedFiles, activeMapping, formData, savedMappings }) {
  if (wizardStep === 1) {
    return (
      <div className="lo-panel-content">
        <h3 className="lo-panel-title">About {config.label}</h3>
        <p className="lo-panel-desc">{config.description}</p>
        <div className="lo-panel-section">
          <h4>Accepted Formats</h4>
          <ul className="lo-panel-list">
            {config.aiExtract && <li><span className="lo-badge lo-badge--ai">AI</span> PDF, JPG, PNG, TIFF — AI-extracted</li>}
            {config.acceptBulk && <li><span className="lo-badge lo-badge--bulk">BULK</span> CSV, XLSX — Field mapping supported</li>}
          </ul>
        </div>
        <div className="lo-panel-section">
          <h4>Expected Fields</h4>
          <ul className="lo-panel-list lo-panel-fields">
            {config.fields.map((f) => (
              <li key={f.key}>
                {f.label}
                {f.required && <span className="lo-panel-required">required</span>}
              </li>
            ))}
          </ul>
        </div>
        {savedMappings.length > 0 && (
          <div className="lo-panel-section">
            <h4>Saved Custom Mappings</h4>
            <ul className="lo-panel-list">
              {savedMappings.map((m) => (
                <li key={m.id} className="lo-panel-mapping-item">
                  <span className="lo-badge lo-badge--custom">Custom</span>
                  {m.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (wizardStep === 2) {
    return (
      <div className="lo-panel-content">
        {aiProgress.length > 0 && <AIProgressPanel steps={aiProgress} />}
        {uploadedFiles.length > 0 && (
          <div className="lo-panel-section">
            <h4>Uploaded Files</h4>
            <ul className="lo-panel-list">
              {uploadedFiles.map((f, i) => (
                <li key={i} className="lo-panel-file-item">
                  <span className="lo-panel-file-icon">📄</span>
                  <span>
                    <strong>{f.name}</strong>
                    <br />
                    <small>{(f.size / 1024).toFixed(1)} KB</small>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {activeMapping && (
          <div className="lo-panel-section">
            <div className="lo-panel-mapping-active">
              <span className="lo-badge lo-badge--custom">Custom Mapping</span>
              <span className="lo-panel-mapping-name">"{activeMapping.name}"</span>
              <p className="lo-panel-mapping-note">
                The source file uses non-standard column names. This mapping translates them to the application fields.
              </p>
            </div>
          </div>
        )}
        <div className="lo-panel-section">
          <h4>Completion</h4>
          <div className="lo-panel-progress">
            {config.fields.map((f) => (
              <div key={f.key} className={`lo-panel-progress-row ${formData[f.key] ? 'lo-panel-progress-row--done' : ''}`}>
                <span>{f.required ? '* ' : ''}{f.label}</span>
                <span>{formData[f.key] ? '✓' : '–'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ─────────────────────────────────────────────
// Main LegalOnboarding component
// ─────────────────────────────────────────────
export function LegalOnboarding({ language = 'en', parents = [] }) {
  const [wizardStep, setWizardStep] = useState(1);
  const [selectedModule, setSelectedModule] = useState('poa');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [formData, setFormData] = useState({});
  const [aiProgress, setAiProgress] = useState([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');

  // Custom field mapping state
  const [savedMappings, setSavedMappings] = useState([]);
  const [activeMapping, setActiveMapping] = useState(null); // { id, name, fieldMap }
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [pendingFileHeaders, setPendingFileHeaders] = useState([]);
  const [pendingInitialMap, setPendingInitialMap] = useState({});
  const [showMappingToast, setShowMappingToast] = useState(false);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [justSaved, setJustSaved] = useState(null);

  const fileInputRef = useRef(null);
  const config = MODULE_CONFIGS[selectedModule];

  // Load saved mappings when module changes
  useEffect(() => {
    fetch(`${API}/field-mappings?module=${selectedModule}`)
      .then((r) => r.json())
      .then((data) => setSavedMappings(Array.isArray(data) ? data : []))
      .catch(() => setSavedMappings([]));
  }, [selectedModule]);

  // Reset form when module changes (back to step 1)
  const handleModuleChange = (moduleId) => {
    setSelectedModule(moduleId);
    setFormData({});
    setUploadedFiles([]);
    setAiProgress([]);
    setActiveMapping(null);
    setShowMappingToast(false);
    setExtractError('');
    setSaveError('');
    setJustSaved(null);
    setWizardStep(1);
  };

  const handleFieldChange = (key, value) => {
    setFormData((d) => ({ ...d, [key]: value }));
  };

  // Merge AI-extracted fields from DocumentAutoFill into formData
  const handleDocAutoFill = (fields) => {
    setFormData((d) => ({ ...d, ...fields }));
  };

  // ── File Upload handling ──
  const handleFileDrop = useCallback((e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    processFileList(files);
  }, [selectedModule, savedMappings]);

  const handleFileInput = (e) => {
    const files = Array.from(e.target.files || []);
    processFileList(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  async function processFileList(files) {
    if (files.length === 0) return;
    const file = files[0]; // process first file; batch handled in step 2 for bulk
    setUploadedFiles(files);
    setExtractError('');
    setActiveMapping(null);
    setShowMappingToast(false);

    const lower = file.name.toLowerCase();
    const isBulk = lower.endsWith('.csv') || lower.endsWith('.xlsx') || lower.endsWith('.xls');

    if (isBulk) {
      await handleBulkFileConformance(file, files);
    } else if (config.aiExtract) {
      setWizardStep(2);
      await runAiExtraction(file);
    } else {
      setWizardStep(2);
    }
  }

  async function handleBulkFileConformance(file, allFiles) {
    // Get headers from server
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${API}/field-mappings/preview-headers`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || !data.headers) throw new Error(data.error || 'Could not read file headers');

      const sourceHeaders = data.headers;

      // Check direct conformance
      const { conformant, headerMap } = checkConformance(sourceHeaders, config);
      if (conformant) {
        setWizardStep(2);
        return;
      }

      // Check saved mappings
      const matched = findMatchingMapping(sourceHeaders, savedMappings);
      if (matched) {
        setActiveMapping({ id: matched.id, name: matched.name, fieldMap: matched.fieldMap });
        setShowMappingToast(true);
        setWizardStep(2);
        return;
      }

      // Non-conformant, no saved mapping → show mapping modal
      setPendingFileHeaders(sourceHeaders);
      setPendingInitialMap(headerMap);
      setShowMappingModal(true);
    } catch (e) {
      setExtractError(`File header check failed: ${e.message}`);
    }
  }

  async function runAiExtraction(file) {
    const steps = config.aiSteps.map((label) => ({ label, status: 'pending' }));
    setAiProgress(steps);
    setIsExtracting(true);

    // Animate steps
    let i = 0;
    const interval = setInterval(() => {
      setAiProgress((prev) =>
        prev.map((s, idx) => {
          if (idx < i) return { ...s, status: 'done' };
          if (idx === i) return { ...s, status: 'running' };
          return s;
        })
      );
      i++;
      if (i > steps.length) clearInterval(interval);
    }, 800);

    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await fetch(config.extractEndpoint, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Extraction failed');

      clearInterval(interval);
      setAiProgress((prev) => prev.map((s) => ({ ...s, status: 'done' })));

      if (data.extracted) {
        setFormData((prev) => {
          const merged = { ...prev };
          for (const [k, v] of Object.entries(data.extracted)) {
            if (v !== undefined && v !== null && v !== '') merged[k] = v;
          }
          return merged;
        });
      }
    } catch (e) {
      clearInterval(interval);
      setAiProgress((prev) => prev.map((s) => ({ ...s, status: 'done' })));
      setExtractError(`AI extraction encountered an issue: ${e.message}. Please fill in fields manually.`);
    } finally {
      setIsExtracting(false);
    }
  }

  // ── Mapping modal callbacks ──
  const handleMappingSave = (savedMapping, fieldMap) => {
    setActiveMapping({ id: savedMapping.id, name: savedMapping.name, fieldMap });
    setSavedMappings((prev) => {
      const filtered = prev.filter((m) => m.id !== savedMapping.id);
      return [savedMapping, ...filtered];
    });
    setShowMappingModal(false);
    setShowMappingToast(true);
    setWizardStep(2);
  };

  const handleMappingUseOnce = (fieldMap) => {
    setActiveMapping({ id: null, name: 'One-time mapping', fieldMap });
    setShowMappingModal(false);
    setWizardStep(2);
  };

  // ── Save record ──
  async function handleSave() {
    setSaveError('');
    setIsSaving(true);

    const payload = {
      ...formData,
      ...(activeMapping ? { customMappingId: activeMapping.id, customMappingName: activeMapping.name } : {}),
    };

    // Basic required field check
    const missing = config.requiredKeys.filter((k) => !payload[k]);
    if (missing.length > 0) {
      setSaveError(`Required fields missing: ${missing.join(', ')}`);
      setIsSaving(false);
      return;
    }

    try {
      const res = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');

      setJustSaved({ module: config.label, data: payload });
      setWizardStep(3);
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setIsSaving(false);
    }
  }

  function handleReset() {
    setWizardStep(1);
    setFormData({});
    setUploadedFiles([]);
    setAiProgress([]);
    setActiveMapping(null);
    setShowMappingToast(false);
    setExtractError('');
    setSaveError('');
    setJustSaved(null);
  }

  // ── Breadcrumb steps ──
  const STEPS = [
    { n: 1, label: 'Select & Upload' },
    { n: 2, label: 'Review & Fill Fields' },
    { n: 3, label: 'Confirm & Save' },
  ];

  // ── Render ──
  return (
    <div className="lo-wizard">
      {/* Field Mapping Modal */}
      {showMappingModal && (
        <FieldMappingModal
          moduleConfig={config}
          sourceHeaders={pendingFileHeaders}
          initialMap={pendingInitialMap}
          onSave={handleMappingSave}
          onUseOnce={handleMappingUseOnce}
          onCancel={() => setShowMappingModal(false)}
        />
      )}

      {/* Breadcrumb */}
      <div className="lo-breadcrumb">
        {STEPS.map((step) => (
          <div
            key={step.n}
            className={`lo-breadcrumb-step ${wizardStep === step.n ? 'lo-breadcrumb-step--active' : ''} ${wizardStep > step.n ? 'lo-breadcrumb-step--done' : ''}`}
          >
            <span className="lo-breadcrumb-num">{wizardStep > step.n ? '✓' : step.n}</span>
            <span className="lo-breadcrumb-label">{step.label}</span>
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="lo-wizard-layout">
        {/* ── Main column ── */}
        <div className="lo-wizard-main">

          {/* STEP 1: Module select + upload */}
          {wizardStep === 1 && (
            <div className="lo-step">
              <h2 className="lo-step-title">Select Legal Document Type</h2>
              <p className="lo-step-subtitle">
                Choose the Legal module for which you are uploading documents, then upload your file.
              </p>

              {/* Module cards */}
              <div className="lo-module-cards">
                {Object.values(MODULE_CONFIGS).map((mod) => (
                  <button
                    key={mod.id}
                    className={`lo-module-card ${selectedModule === mod.id ? 'lo-module-card--active' : ''}`}
                    onClick={() => handleModuleChange(mod.id)}
                  >
                    <span className="lo-module-card-icon">{mod.icon}</span>
                    <span className="lo-module-card-label">{mod.label}</span>
                  </button>
                ))}
              </div>

              {/* Upload zone */}
              <div
                className="lo-upload-zone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={config.aiExtract
                    ? '.pdf,.jpg,.jpeg,.png,.tiff,.tif,.csv,.xlsx,.xls'
                    : '.csv,.xlsx,.xls,.pdf'}
                  multiple
                  onChange={handleFileInput}
                  style={{ display: 'none' }}
                />
                <div className="lo-upload-icon">⬆</div>
                <p className="lo-upload-primary">
                  Drag & drop or <span className="lo-upload-link">browse</span> to upload
                </p>
                <p className="lo-upload-hint">
                  {config.aiExtract
                    ? 'PDF / JPG / PNG / TIFF for AI extraction  ·  CSV / XLSX for bulk import'
                    : 'CSV / XLSX for bulk import  ·  PDF for manual reference'}
                </p>
                {uploadedFiles.length > 0 && (
                  <div className="lo-upload-selected">
                    {uploadedFiles.map((f, i) => (
                      <span key={i} className="lo-upload-chip">{f.name}</span>
                    ))}
                  </div>
                )}
              </div>

              {extractError && <p className="lo-error">{extractError}</p>}

              <div className="lo-step-actions">
                <button
                  className="btn-primary"
                  disabled={uploadedFiles.length === 0}
                  onClick={() => {
                    if (uploadedFiles.length > 0) processFileList(uploadedFiles);
                    else setWizardStep(2);
                  }}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Field review & fill */}
          {wizardStep === 2 && (
            <div className="lo-step">
              <h2 className="lo-step-title">{config.label} — Review & Fill Fields</h2>
              {activeMapping && (
                <div className="lo-active-mapping-banner">
                  <span className="lo-badge lo-badge--custom">Custom Mapping</span>
                  <span>Using saved mapping: <strong>"{activeMapping.name}"</strong></span>
                </div>
              )}
              {showMappingToast && (
                <MappingInUseToast
                  mappingName={activeMapping?.name || ''}
                  onDismiss={() => setShowMappingToast(false)}
                />
              )}
              {extractError && <p className="lo-error">{extractError}</p>}
              {isExtracting && (
                <p className="lo-extracting-msg">Extracting document data, please wait…</p>
              )}
              <DocumentAutoFill
                module={selectedModule}
                onApply={handleDocAutoFill}
                compact
                fieldLabels={Object.fromEntries(config.fields.map((f) => [f.key, f.label]))}
              />
              <div className="lo-fields-grid">
                {config.fields.map((field) => (
                  <FormField
                    key={field.key}
                    field={field}
                    value={formData[field.key]}
                    onChange={handleFieldChange}
                  />
                ))}
              </div>
              {saveError && <p className="lo-error">{saveError}</p>}
              <div className="lo-step-actions">
                <button className="btn-secondary" onClick={() => setWizardStep(1)}>Back</button>
                <button className="btn-primary" onClick={() => setWizardStep(3)}>
                  Review & Confirm
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Confirm & Save */}
          {wizardStep === 3 && !justSaved && (
            <div className="lo-step">
              <h2 className="lo-step-title">Review & Confirm</h2>
              <p className="lo-step-subtitle">
                Verify all extracted and filled data before saving the record to <strong>{config.label}</strong>.
              </p>
              {activeMapping && (
                <div className="lo-active-mapping-banner">
                  <span className="lo-badge lo-badge--custom">Custom Mapping</span>
                  <span>Source file was non-conformant. Mapping used: <strong>"{activeMapping.name}"</strong></span>
                </div>
              )}
              <div className="lo-review-grid">
                {config.fields.map((field) => {
                  const val = formData[field.key];
                  if (val === undefined || val === null || val === '' || val === false) return null;
                  return (
                    <div key={field.key} className="lo-review-item">
                      <span className="lo-review-label">{field.label}</span>
                      <span className="lo-review-value">
                        {field.type === 'checkbox'
                          ? (val ? '✓ Yes' : '✗ No')
                          : String(val)}
                      </span>
                    </div>
                  );
                })}
              </div>
              {saveError && <p className="lo-error">{saveError}</p>}
              <div className="lo-step-actions">
                <button className="btn-secondary" onClick={() => setWizardStep(2)}>Back to Edit</button>
                <button className="btn-primary" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Saving…' : `Save to ${config.label}`}
                </button>
              </div>
            </div>
          )}

          {/* SUCCESS */}
          {justSaved && (
            <div className="lo-success-banner">
              <div className="lo-success-icon">✓</div>
              <h2>Record Saved Successfully</h2>
              <p>
                The record has been saved to <strong>{justSaved.module}</strong>.
                {justSaved.data?.customMappingName && (
                  <span className="lo-success-mapping">
                    {' '}Source file used custom mapping: <strong>"{justSaved.data.customMappingName}"</strong>
                  </span>
                )}
              </p>
              <div className="lo-step-actions">
                <button className="btn-primary" onClick={handleReset}>Upload Another Document</button>
              </div>
            </div>
          )}
        </div>

        {/* ── Right panel ── */}
        {wizardStep < 3 && !justSaved && (
          <aside className="lo-wizard-panel">
            <LegalOnboardingPanel
              wizardStep={wizardStep}
              config={config}
              aiProgress={aiProgress}
              uploadedFiles={uploadedFiles}
              activeMapping={activeMapping}
              formData={formData}
              savedMappings={savedMappings}
            />
          </aside>
        )}
      </div>
    </div>
  );
}
