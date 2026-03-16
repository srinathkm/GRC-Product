import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/** Inline AI confidence badge shown next to field labels after extraction. */
function AiBadge({ meta }) {
  if (!meta || !meta.confidence) return null;
  const pct = Math.round(meta.confidence * 100);
  const cls = meta.confidence >= 0.8 ? 'ai-badge--high' : meta.confidence >= 0.5 ? 'ai-badge--med' : 'ai-badge--low';
  const title = meta.label ? `AI extracted · found under "${meta.label}"` : 'AI extracted';
  return <span className={`ai-badge ${cls}`} title={title}>AI {pct}%</span>;
}

const CONTRACT_TYPES = ['Vendor', 'Employment', 'Service', 'NDA', 'Lease', 'Partnership'];
const STATUS_OPTIONS = [
  'Draft',
  'Pending Review',
  'Pending Approval (Legal)',
  'Pending Approval (Finance)',
  'Active',
  'Expired',
  'Terminated',
];
const RISK_LEVELS = ['Low', 'Medium', 'High'];

const ACCEPT = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX_SIZE_BYTES = 25 * 1024 * 1024;

function computeLifecycleStatus(record) {
  if (!record) return null;
  const statusStr = (record.status || '').toLowerCase();
  if (statusStr.includes('revoked')) return 'revoked';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (record.expiryDate) {
    const d = new Date(record.expiryDate);
    if (!Number.isNaN(d.getTime())) {
      d.setHours(0, 0, 0, 0);
      if (d < today) return 'expired';
      return 'active';
    }
  }
  if (statusStr.includes('active')) return 'active';
  return null;
}

export function ContractsManagement({ language = 'en', parents = [], selectedParentHolding, onParentHoldingChange, currentView = 'contracts-management' }) {
  const [records, setRecords] = useState([]);
  const [filterParent, setFilterParent] = useState(selectedParentHolding || '');
  const [filterOpco, setFilterOpco] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterWorkflow, setFilterWorkflow] = useState('all'); // all | needs-review | pending-approval
  const [filterContractId, setFilterContractId] = useState('');
  const [contractIdLookup, setContractIdLookup] = useState(''); // applied on Lookup click / Enter
  const [opcosForParent, setOpcosForParent] = useState([]);
  const [opcosForFormParent, setOpcosForFormParent] = useState([]);
  const [allOpcos, setAllOpcos] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState([]); // { fileId, contractId, originalName, extracted? }[]
  const [pendingSavePayload, setPendingSavePayload] = useState(null);
  const [pendingSaveDiff, setPendingSaveDiff] = useState(null);

  // AI extraction metadata — tracks which form fields were auto-populated by AI and with what confidence
  const [aiExtractedMeta, setAiExtractedMeta] = useState({}); // { fieldKey: { confidence, label } }
  const originalExtractedRef = useRef({});                     // snapshot of AI values for feedback diff
  const [learningCount, setLearningCount] = useState(0);

  // AI contextual summary for Notes field
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summarizeError, setSummarizeError] = useState('');

  const [form, setForm] = useState({
    contractId: '',
    parent: selectedParentHolding || '',
    opco: '',
    contractType: 'Vendor',
    title: '',
    counterparty: '',
    effectiveDate: '',
    expiryDate: '',
    renewalWindowStart: '',
    renewalWindowEnd: '',
    vatAmount: '',
    taxAmount: '',
    netAmount: '',
    totalAmount: '',
    obligations: '',
    riskLevel: 'Medium',
    status: 'Draft',
    documentLink: '',
    documentOriginalName: '',
    pendingApprovalFrom: '',
    reviewDueBy: '',
    assignedTo: '',
    notes: '',
  });

  // Load parents + all opcos for filters (opco-only and parent+opco)
  useEffect(() => {
    fetch('/api/companies/roles')
      .then((r) => r.json())
      .then((data) => {
        setAllOpcos(Array.isArray(data.opcos) ? data.opcos : []);
      })
      .catch(() => setAllOpcos([]));
  }, []);

  useEffect(() => {
    if (!filterParent) {
      setOpcosForParent([]);
      return;
    }
    fetch(`/api/companies/by-parent?parent=${encodeURIComponent(filterParent)}`)
      .then((r) => r.json())
      .then((data) => {
        const list = (data.opcos || []).map((o) => (typeof o === 'string' ? o : o.name)).filter(Boolean);
        setOpcosForParent(list);
      })
      .catch(() => setOpcosForParent([]));
  }, [filterParent]);

  useEffect(() => {
    if (!form.parent) {
      setOpcosForFormParent([]);
      return;
    }
    fetch(`/api/companies/by-parent?parent=${encodeURIComponent(form.parent)}`)
      .then((r) => r.json())
      .then((data) => {
        const list = (data.opcos || []).map((o) => (typeof o === 'string' ? o : o.name)).filter(Boolean);
        setOpcosForFormParent(list);
      })
      .catch(() => setOpcosForFormParent([]));
  }, [form.parent]);

  const loadContracts = useCallback(() => {
    const q = new URLSearchParams();
    if (filterParent) q.set('parent', filterParent);
    if (filterOpco) q.set('opco', filterOpco);
    if (contractIdLookup) q.set('contractId', contractIdLookup);
    const url = q.toString() ? `/api/contracts?${q.toString()}` : '/api/contracts';
    fetch(url)
      .then((r) => r.json())
      .then((data) => setRecords(Array.isArray(data) ? data : []))
      .catch(() => setRecords([]));
  }, [filterParent, filterOpco, contractIdLookup]);

  useEffect(() => {
    loadContracts();
  }, [loadContracts]);

  useEffect(() => {
    if (selectedParentHolding && selectedParentHolding !== filterParent) {
      setFilterParent(selectedParentHolding);
      setForm((prev) => ({ ...prev, parent: selectedParentHolding }));
    }
  }, [selectedParentHolding]);

  const handleParentFilterChange = (value) => {
    setFilterParent(value);
    setFilterOpco('');
    if (onParentHoldingChange) onParentHoldingChange(value);
    setForm((prev) => ({ ...prev, parent: value, opco: '' }));
    const q = new URLSearchParams();
    if (value) q.set('parent', value);
    fetch(q.toString() ? `/api/contracts?${q.toString()}` : '/api/contracts')
      .then((r) => r.json())
      .then((data) => setRecords(Array.isArray(data) ? data : []))
      .catch(() => setRecords([]));
  };

  const handleOpcoFilterChange = (value) => {
    setFilterOpco(value);
    const q = new URLSearchParams();
    if (filterParent) q.set('parent', filterParent);
    if (value) q.set('opco', value);
    fetch(q.toString() ? `/api/contracts?${q.toString()}` : '/api/contracts')
      .then((r) => r.json())
      .then((data) => setRecords(Array.isArray(data) ? data : []))
      .catch(() => setRecords([]));
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const performSave = (payload) => {
    // Send user corrections as learning feedback before saving (fire-and-forget).
    const snapshot = originalExtractedRef.current;
    if (Object.keys(snapshot).length > 0) {
      const corrections = {};
      for (const [key, origVal] of Object.entries(snapshot)) {
        const currentVal = payload[key];
        if (
          currentVal !== undefined && currentVal !== null && currentVal !== '' &&
          String(currentVal) !== String(origVal)
        ) {
          corrections[key] = currentVal;
        }
      }
      if (Object.keys(corrections).length > 0) {
        fetch('/api/extract/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ module: 'contracts', corrections }),
        }).catch(() => {});
      }
      originalExtractedRef.current = {}; // clear after first save
    }

    fetch('/api/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then(() => {
        setEditingId(null);
        setPendingSavePayload(null);
        setPendingSaveDiff(null);
        setAiExtractedMeta({});
        loadContracts();
      })
      .catch(() => {});
  };

  const handleSave = (e) => {
    e.preventDefault();
    const parent = (form.parent || '').trim();
    const contractType = (form.contractType || '').trim();
    if (!parent || !contractType) return;
    const payload = {
      ...(editingId ? { id: editingId } : {}),
      ...form,
      parent,
    };
    // Check for existing contract with same fileId/documentLink (excluding the one being edited).
    const fileId = (payload.documentLink || '').trim();
    const existing = fileId
      ? records.find((r) => (r.documentLink || '').trim() === fileId && (!editingId || r.id !== editingId))
      : null;
    if (existing) {
      const FIELDS_TO_COMPARE = [
        'parent',
        'opco',
        'contractType',
        'title',
        'counterparty',
        'effectiveDate',
        'expiryDate',
        'renewalWindowStart',
        'renewalWindowEnd',
        'vatAmount',
        'taxAmount',
        'netAmount',
        'totalAmount',
        'status',
        'pendingApprovalFrom',
        'reviewDueBy',
        'assignedTo',
        'obligations',
        'notes',
      ];
      const diffs = FIELDS_TO_COMPARE.map((field) => {
        const beforeVal = existing[field] != null ? String(existing[field]) : '';
        const afterVal = payload[field] != null ? String(payload[field]) : '';
        return beforeVal !== afterVal ? { field, before: beforeVal, after: afterVal } : null;
      }).filter(Boolean);
      if (diffs.length > 0) {
        setPendingSavePayload(payload);
        setPendingSaveDiff(diffs);
        return;
      }
    }
    performSave(payload);
  };

  const updateWorkflow = (id, updates) => {
    fetch(`/api/contracts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
      .then((r) => r.json())
      .then(() => loadContracts())
      .catch(() => {});
  };

  const visibleRecords = useMemo(() => {
    return records.filter((r) => {
      if (filterStatus && filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (filterWorkflow === 'needs-review' && r.status !== 'Pending Review') return false;
      if (filterWorkflow === 'pending-approval') {
        const s = (r.status || '').toLowerCase();
        if (!s.includes('pending approval')) return false;
      }
      return true;
    });
  }, [records, filterStatus, filterWorkflow]);

  const stats = useMemo(() => {
    let total = 0;
    let needsReview = 0;
    let pendingApproval = 0;
    let expiring = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    records.forEach((r) => {
      total += 1;
      if (r.status === 'Pending Review') needsReview += 1;
      if ((r.status || '').toLowerCase().includes('pending approval')) pendingApproval += 1;
      if (r.expiryDate) {
        const d = new Date(r.expiryDate);
        d.setHours(0, 0, 0, 0);
        const diff = Math.ceil((d - today) / (24 * 60 * 60 * 1000));
        if (diff >= 0 && diff <= 90) expiring += 1;
      }
    });
    return { total, needsReview, pendingApproval, expiring };
  }, [records]);

  const formLifecycleStatus = useMemo(() => computeLifecycleStatus(form), [form.status, form.expiryDate]);

  const filterOpcoOptions = filterParent ? opcosForParent : allOpcos;
  const formOpcoOptions = form.parent ? opcosForFormParent : allOpcos;

  const validateFile = (file) => {
    if (file.size > MAX_SIZE_BYTES) return `"${file.name}" exceeds 25 MB.`;
    const ext = (file.name || '').split('.').pop()?.toLowerCase();
    const ok = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'tiff', 'tif'].includes(ext);
    if (!ok) return `"${file.name}" not allowed. Use PDF, DOC, DOCX, JPG, PNG or TIFF.`;
    return null;
  };

  /**
   * Apply extracted fields from an upload result to the form.
   * Also records AI metadata for badge display and stores a snapshot for feedback.
   * `ex` is the flat extracted object returned by /api/contracts/upload.
   */
  const applyExtractedToForm = useCallback((item) => {
    const ex = item.extracted || {};

    // Build the form patch from extracted values
    const patch = {
      contractId:          item.contractId          || undefined,
      documentLink:        item.fileId              || undefined,
      documentOriginalName: item.originalName       || undefined,
      title:               ex.title                || undefined,
      counterparty:        ex.counterparty          || undefined,
      effectiveDate:       ex.effectiveDate         || undefined,
      expiryDate:          ex.expiryDate            || undefined,
      renewalWindowStart:  ex.renewalStart          || undefined,
      renewalWindowEnd:    ex.renewalEnd            || undefined,
      vatAmount:           ex.vatAmount  != null    ? String(ex.vatAmount)  : undefined,
      taxAmount:           ex.taxAmount  != null    ? String(ex.taxAmount)  : undefined,
      netAmount:           ex.netAmount  != null    ? String(ex.netAmount)  : undefined,
      totalAmount:         ex.totalAmount != null   ? String(ex.totalAmount): undefined,
      contractType:        ex.contractType          || undefined,
      riskLevel:           ex.riskLevel             || undefined,
    };

    // Strip undefined so we only overwrite fields that were actually extracted
    const cleanPatch = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));

    setForm((prev) => ({ ...prev, ...cleanPatch }));

    // Build AI metadata badges for extracted fields (confidence approx. 0.80 — from universal engine)
    const AI_CONFIDENCE = 0.8;
    const meta = {};
    const snapshot = {};
    const aiFields = ['title', 'counterparty', 'effectiveDate', 'expiryDate',
      'renewalWindowStart', 'renewalWindowEnd', 'vatAmount', 'taxAmount',
      'netAmount', 'totalAmount', 'contractType', 'riskLevel'];
    for (const f of aiFields) {
      const val = cleanPatch[f];
      if (val !== undefined && val !== '') {
        meta[f] = { confidence: AI_CONFIDENCE, label: '' };
        snapshot[f] = val;
      }
    }
    setAiExtractedMeta(meta);
    originalExtractedRef.current = snapshot;
    if (item.learningCount !== undefined) setLearningCount(item.learningCount);
  }, []);

  const onUpload = useCallback(
    (fileList) => {
      const files = Array.isArray(fileList) ? fileList : (fileList ? [fileList] : []);
      if (files.length === 0) return;
      for (const f of files) {
        const err = validateFile(f);
        if (err) {
          setUploadError(err);
          return;
        }
      }
      setUploadError('');
      setUploadLoading(true);
      const body = new FormData();
      files.forEach((f) => body.append('files', f));
      fetch('/api/contracts/upload', { method: 'POST', body })
        .then((res) => res.json().then((data) => ({ res, data })))
        .then(({ res, data }) => {
          if (!res.ok) {
            setUploadError(data.error || 'Upload failed');
            return;
          }
          const results = Array.isArray(data.results) ? data.results : [];
          setUploadedFiles((prev) => [...prev, ...results]);
          if (results.length > 0) {
            applyExtractedToForm(results[0]);
          }
        })
        .catch(() => setUploadError('Upload failed'))
        .finally(() => setUploadLoading(false));
    },
    [applyExtractedToForm]
  );

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      const files = e.dataTransfer?.files;
      if (files?.length) onUpload(Array.from(files));
    },
    [onUpload]
  );

  const applyUploadToForm = (item) => {
    applyExtractedToForm(item);
  };

  // ── AI Summarize — generates grounded 3-point executive summary into Notes ──
  const handleSummarize = useCallback(async () => {
    setSummarizeError('');
    setIsSummarizing(true);
    try {
      const res = await fetch('/api/extract/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: 'contracts',
          fields: { ...form, notes: undefined }, // exclude notes to avoid circular input
          opco: form.opco || '',
          parent: form.parent || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Summary generation failed');
      if (data.summary) {
        setForm((prev) => ({ ...prev, notes: data.summary }));
      }
    } catch (e) {
      setSummarizeError(e.message);
    } finally {
      setIsSummarizing(false);
    }
  }, [form]);

  // Upload Document Contract section only: show upload in a table, separate from other content
  if (currentView === 'contracts-upload') {
    return (
      <div className="lit-section">
        <h2 className="lit-title">Upload Document Contract</h2>
        <p className="lit-intro">
          Upload contract documents (PDF, DOC, DOCX) to onboard new contracts. After uploading, go to Contract Lifecycle Management to complete metadata and add to the register.
        </p>
        <div className="lit-table-wrap contract-upload-table-wrap">
          <table className="lit-table contract-upload-table">
            <thead>
              <tr>
                <th>Upload contract document</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div
                    className={`contract-upload-zone ${uploadLoading ? 'poa-upload-loading' : ''}`}
                    onDrop={onDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onDragLeave={(e) => e.preventDefault()}
                  >
                    <input
                      type="file"
                      accept={ACCEPT}
                      multiple
                      className="contract-upload-input"
                      onChange={(e) => {
                        const list = e.target?.files;
                        if (list?.length) onUpload(Array.from(list));
                        e.target.value = '';
                      }}
                      disabled={uploadLoading}
                      aria-label="Choose contract files to upload (multi-select)"
                    />
                    {uploadLoading ? (
                      <span>Uploading…</span>
                    ) : (
                      <>
                        <span className="poa-upload-icon" aria-hidden>📄</span>
                        <p className="poa-upload-text">Drag and drop contract documents here, or click to browse (multi-select)</p>
                        <p className="poa-upload-hint">PDF, DOC, DOCX — max 25 MB each. Select multiple files to upload.</p>
                      </>
                    )}
                  </div>
                  {uploadError && <p className="poa-upload-error">{uploadError}</p>}
                  {uploadedFiles.length > 0 && (
                    <div className="contract-uploaded-list-wrap">
                      <p className="lit-intro" style={{ marginTop: '0.75rem', marginBottom: '0.5rem' }}>Uploaded files — scroll right to review:</p>
                      <div className="contract-uploaded-list" dir="ltr">
                        {uploadedFiles.map((item, idx) => (
                          <div key={item.fileId || idx} className="contract-uploaded-card">
                            <span className="contract-uploaded-id">{item.contractId}</span>
                            <span className="contract-uploaded-name" title={item.originalName}>{item.originalName}</span>
                            <a href={`/api/contracts/file/${encodeURIComponent(item.fileId)}`} target="_blank" rel="noopener noreferrer" className="contract-uploaded-link">Open</a>
                            <button type="button" className="lit-btn-secondary" onClick={() => applyUploadToForm(item)}>Use for new contract</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Contract Lifecycle Management: register, filters, form — no upload block
  return (
    <div className="lit-section">
      <h2 className="lit-title">Contract Lifecycle Management</h2>
      <p className="lit-intro">
        Central register of <strong>contracts</strong> across the group — vendor agreements, employment contracts,
        service agreements, NDAs, leases and partnership deeds. Track <strong>obligations, deadlines, renewal windows</strong> and
        risk exposure. Use the Upload Document Contract section to onboard contract files.
      </p>

      <div className="lit-cards">
        <div className="lit-card">
          <span className="lit-card-label">Total contracts</span>
          <span className="lit-card-value">{stats.total}</span>
        </div>
        <div className="lit-card poa-card-warning">
          <span className="lit-card-label">Needs review</span>
          <span className="lit-card-value">{stats.needsReview}</span>
        </div>
        <div className="lit-card poa-card-warning">
          <span className="lit-card-label">Pending approval</span>
          <span className="lit-card-value">{stats.pendingApproval}</span>
        </div>
        <div className="lit-card">
          <span className="lit-card-label">Expiring in 90 days</span>
          <span className="lit-card-value">{stats.expiring}</span>
        </div>
      </div>

      <div className="lit-filters">
        <div className="lit-filter-row">
          <label htmlFor="con-parent-select">Parent Holding</label>
          <select
            id="con-parent-select"
            className="lit-select"
            value={filterParent}
            onChange={(e) => handleParentFilterChange(e.target.value)}
          >
            <option value="">All</option>
            {parents.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="lit-filter-row">
          <label htmlFor="con-opco-select">OpCo</label>
          <select
            id="con-opco-select"
            className="lit-select"
            value={filterOpco}
            onChange={(e) => handleOpcoFilterChange(e.target.value)}
          >
            <option value="">All</option>
            {filterOpcoOptions.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="lit-filter-row">
          <label htmlFor="con-status-select">Status</label>
          <select
            id="con-status-select"
            className="lit-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="lit-filter-row">
          <label htmlFor="con-workflow-select">Workflow</label>
          <select
            id="con-workflow-select"
            className="lit-select"
            value={filterWorkflow}
            onChange={(e) => setFilterWorkflow(e.target.value)}
          >
            <option value="all">All</option>
            <option value="needs-review">Needs review</option>
            <option value="pending-approval">Pending approval</option>
          </select>
        </div>
        <div className="lit-filter-row">
          <label htmlFor="con-contract-id">Contract ID / File ID</label>
          <input
            id="con-contract-id"
            type="text"
            className="lit-select"
            placeholder="Lookup by Contract ID…"
            value={filterContractId}
            onChange={(e) => setFilterContractId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), setContractIdLookup(filterContractId))}
          />
          <button type="button" className="lit-btn-secondary" onClick={() => setContractIdLookup(filterContractId)} style={{ marginLeft: '0.5rem' }}>Lookup</button>
        </div>
      </div>

      <form className="lit-form" onSubmit={handleSave}>
        <div className="contract-form-header">
          <h3 className="lit-form-title">Add / update contract</h3>
          {formLifecycleStatus && (
            <div className={`contract-status-indicator contract-status-indicator--${formLifecycleStatus}`}>
              <span className="contract-status-dot" aria-hidden />
              <span className="contract-status-label">
                {formLifecycleStatus === 'expired' && 'Expired'}
                {formLifecycleStatus === 'active' && 'Active'}
                {formLifecycleStatus === 'revoked' && 'Revoked'}
              </span>
            </div>
          )}
        </div>
        {learningCount > 0 && (
          <p className="contract-learning-badge">
            🧠 Model trained on <strong>{learningCount}</strong> contract{learningCount !== 1 ? 's' : ''} — extraction accuracy improves with every upload.
          </p>
        )}
        <div className="lit-form-grid">
          <div className="lit-field">
            <label>Contract ID / File ID</label>
            <input
              className="lit-input"
              type="text"
              value={form.contractId}
              onChange={(e) => handleFormChange('contractId', e.target.value)}
              placeholder="e.g. CON-20250223-ABC123 or from upload"
            />
          </div>
          <div className="lit-field">
            <label>Parent Holding</label>
            <select
              className="lit-input"
              value={form.parent}
              onChange={(e) => handleFormChange('parent', e.target.value)}
              required
            >
              <option value="">Select parent…</option>
              {parents.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="lit-field">
            <label>OpCo</label>
            <select
              className="lit-input"
              value={form.opco}
              onChange={(e) => handleFormChange('opco', e.target.value)}
            >
              <option value="">—</option>
              {formOpcoOptions.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div className="lit-field">
            <label>Contract type</label>
            <select
              className="lit-input"
              value={form.contractType}
              onChange={(e) => handleFormChange('contractType', e.target.value)}
              required
            >
              {CONTRACT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="lit-field">
            <label>Title <AiBadge meta={aiExtractedMeta.title} /></label>
            <input
              className={`lit-input${aiExtractedMeta.title ? ' lit-input--ai' : ''}`}
              type="text"
              value={form.title}
              onChange={(e) => handleFormChange('title', e.target.value)}
              placeholder="Contract title or reference"
            />
          </div>
          <div className="lit-field">
            <label>Counterparty / Parties <AiBadge meta={aiExtractedMeta.counterparty} /></label>
            <input
              className={`lit-input${aiExtractedMeta.counterparty ? ' lit-input--ai' : ''}`}
              type="text"
              value={form.counterparty}
              onChange={(e) => handleFormChange('counterparty', e.target.value)}
              placeholder="Other party name(s)"
            />
          </div>
          <div className="lit-field">
            <label>Effective date <AiBadge meta={aiExtractedMeta.effectiveDate} /></label>
            <input
              className={`lit-input${aiExtractedMeta.effectiveDate ? ' lit-input--ai' : ''}`}
              type="date"
              value={form.effectiveDate}
              onChange={(e) => handleFormChange('effectiveDate', e.target.value)}
            />
          </div>
          <div className="lit-field">
            <label>Expiry date <AiBadge meta={aiExtractedMeta.expiryDate} /></label>
            <input
              className={`lit-input${aiExtractedMeta.expiryDate ? ' lit-input--ai' : ''}`}
              type="date"
              value={form.expiryDate}
              onChange={(e) => handleFormChange('expiryDate', e.target.value)}
            />
          </div>
          <div className="lit-field">
            <label>Net amount <AiBadge meta={aiExtractedMeta.netAmount} /></label>
            <input
              className={`lit-input${aiExtractedMeta.netAmount ? ' lit-input--ai' : ''}`}
              type="number"
              min="0"
              step="0.01"
              value={form.netAmount}
              onChange={(e) => handleFormChange('netAmount', e.target.value)}
              placeholder="Net (before VAT/taxes)"
            />
          </div>
          <div className="lit-field">
            <label>VAT amount <AiBadge meta={aiExtractedMeta.vatAmount} /></label>
            <input
              className={`lit-input${aiExtractedMeta.vatAmount ? ' lit-input--ai' : ''}`}
              type="number"
              min="0"
              step="0.01"
              value={form.vatAmount}
              onChange={(e) => handleFormChange('vatAmount', e.target.value)}
              placeholder="VAT"
            />
          </div>
          <div className="lit-field">
            <label>Taxes <AiBadge meta={aiExtractedMeta.taxAmount} /></label>
            <input
              className={`lit-input${aiExtractedMeta.taxAmount ? ' lit-input--ai' : ''}`}
              type="number"
              min="0"
              step="0.01"
              value={form.taxAmount}
              onChange={(e) => handleFormChange('taxAmount', e.target.value)}
              placeholder="Other taxes"
            />
          </div>
          <div className="lit-field">
            <label>Total amount <AiBadge meta={aiExtractedMeta.totalAmount} /></label>
            <input
              className={`lit-input${aiExtractedMeta.totalAmount ? ' lit-input--ai' : ''}`}
              type="number"
              min="0"
              step="0.01"
              value={form.totalAmount}
              onChange={(e) => handleFormChange('totalAmount', e.target.value)}
              placeholder="Total contract value"
            />
          </div>
          <div className="lit-field">
            <label>Renewal window start <AiBadge meta={aiExtractedMeta.renewalWindowStart} /></label>
            <input
              className={`lit-input${aiExtractedMeta.renewalWindowStart ? ' lit-input--ai' : ''}`}
              type="date"
              value={form.renewalWindowStart}
              onChange={(e) => handleFormChange('renewalWindowStart', e.target.value)}
            />
          </div>
          <div className="lit-field">
            <label>Renewal window end <AiBadge meta={aiExtractedMeta.renewalWindowEnd} /></label>
            <input
              className={`lit-input${aiExtractedMeta.renewalWindowEnd ? ' lit-input--ai' : ''}`}
              type="date"
              value={form.renewalWindowEnd}
              onChange={(e) => handleFormChange('renewalWindowEnd', e.target.value)}
            />
          </div>
          <div className="lit-field">
            <label>Risk level <AiBadge meta={aiExtractedMeta.riskLevel} /></label>
            <select
              className="lit-input"
              value={form.riskLevel}
              onChange={(e) => handleFormChange('riskLevel', e.target.value)}
            >
              {RISK_LEVELS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="lit-field">
            <label>Status</label>
            <select
              className="lit-input"
              value={form.status}
              onChange={(e) => handleFormChange('status', e.target.value)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="lit-field">
            <label>Pending approval from</label>
            <select
              className="lit-input"
              value={form.pendingApprovalFrom}
              onChange={(e) => handleFormChange('pendingApprovalFrom', e.target.value)}
            >
              <option value="">—</option>
              <option value="Legal">Legal</option>
              <option value="Finance">Finance</option>
              <option value="Procurement">Procurement</option>
            </select>
          </div>
          <div className="lit-field">
            <label>Review due by</label>
            <input
              className="lit-input"
              type="date"
              value={form.reviewDueBy}
              onChange={(e) => handleFormChange('reviewDueBy', e.target.value)}
            />
          </div>
          <div className="lit-field">
            <label>Assigned to</label>
            <input
              className="lit-input"
              type="text"
              value={form.assignedTo}
              onChange={(e) => handleFormChange('assignedTo', e.target.value)}
              placeholder="Team or person"
            />
          </div>
          <div className="lit-field lit-field-wide">
            <label>Obligations</label>
            <textarea
              className="lit-input"
              rows={2}
              value={form.obligations}
              onChange={(e) => handleFormChange('obligations', e.target.value)}
              placeholder="Key obligations, milestones"
            />
          </div>
          <div className="lit-field lit-field-wide">
            <label>Notes / AI Summary</label>
            <textarea
              className="lit-input"
              rows={5}
              value={form.notes}
              onChange={(e) => handleFormChange('notes', e.target.value)}
              placeholder="Use 'AI Summarize' to auto-generate a contextual 3-point executive summary from the contract data."
            />
            <div className="contract-summarize-row">
              <button
                type="button"
                className="contract-btn-summarize"
                disabled={isSummarizing}
                onClick={handleSummarize}
                title="Generate a grounded 3-point executive summary (context, impact, next steps)"
              >
                {isSummarizing ? '⏳ Generating summary…' : '✨ AI Summarize'}
              </button>
              {summarizeError && <span className="contract-summarize-error">{summarizeError}</span>}
            </div>
          </div>
        </div>
        <div className="lit-form-actions">
          <button type="submit" className="lit-btn-primary">
            {editingId ? 'Update contract' : 'Save contract'}
          </button>
          <button
            type="button"
            className="lit-btn-secondary"
            onClick={() => {
              setEditingId(null);
              setForm({
                contractId: '',
                parent: filterParent || '',
                opco: '',
                contractType: 'Vendor',
                title: '',
                counterparty: '',
                effectiveDate: '',
                expiryDate: '',
                renewalWindowStart: '',
                renewalWindowEnd: '',
                vatAmount: '',
                taxAmount: '',
                netAmount: '',
                totalAmount: '',
                obligations: '',
                riskLevel: 'Medium',
                status: 'Draft',
                documentLink: '',
                documentOriginalName: '',
                pendingApprovalFrom: '',
                reviewDueBy: '',
                assignedTo: '',
                notes: '',
              });
            }}
          >
            New contract
          </button>
        </div>
      </form>

      <section className="lit-list-section">
        <h3 className="lit-list-title">Contract register</h3>
        {visibleRecords.length === 0 ? (
          <p className="lit-empty">No contracts for the selected filters.</p>
        ) : (
          <div className="lit-table-wrap">
            <table className="lit-table">
              <thead>
                <tr>
                  <th>Contract ID</th>
                  <th>Parent</th>
                  <th>OpCo</th>
                  <th>Type</th>
                  <th>Title</th>
                  <th>Counterparty</th>
                  <th>Effective</th>
                  <th>Expiry</th>
                  <th>Status</th>
                  <th>Risk</th>
                  <th>Document</th>
                  <th>Workflow</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => {
                      setEditingId(r.id);
                      setForm({
                        contractId: r.contractId || r.documentLink || '',
                        parent: r.parent || '',
                        opco: r.opco || '',
                        contractType: r.contractType || 'Vendor',
                        title: r.title || '',
                        counterparty: r.counterparty || '',
                        effectiveDate: r.effectiveDate || '',
                        expiryDate: r.expiryDate || '',
                        renewalWindowStart: r.renewalWindowStart || '',
                        renewalWindowEnd: r.renewalWindowEnd || '',
                        vatAmount: r.vatAmount != null ? String(r.vatAmount) : '',
                        taxAmount: r.taxAmount != null ? String(r.taxAmount) : '',
                        netAmount: r.netAmount != null ? String(r.netAmount) : '',
                        totalAmount: r.totalAmount != null ? String(r.totalAmount) : '',
                        obligations: r.obligations || '',
                        riskLevel: r.riskLevel || 'Medium',
                        status: r.status || 'Draft',
                        documentLink: r.documentLink || '',
                        documentOriginalName: r.documentOriginalName || '',
                        pendingApprovalFrom: r.pendingApprovalFrom || '',
                        reviewDueBy: r.reviewDueBy || '',
                        assignedTo: r.assignedTo || '',
                        notes: r.notes || '',
                      });
                    }}
                  >
                    <td>{r.contractId || r.documentLink || '—'}</td>
                    <td>{r.parent}</td>
                    <td>{r.opco || '—'}</td>
                    <td>{r.contractType || '—'}</td>
                    <td>{r.title || '—'}</td>
                    <td>{r.counterparty || '—'}</td>
                    <td>{r.effectiveDate || '—'}</td>
                    <td>{r.expiryDate || '—'}</td>
                    <td>{r.status || '—'}</td>
                    <td>{r.riskLevel || '—'}</td>
                    <td>
                      {r.documentLink ? (
                        <a href={`/api/contracts/file/${encodeURIComponent(r.documentLink)}`} target="_blank" rel="noopener noreferrer">Open</a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {r.pendingApprovalFrom && <span>{r.pendingApprovalFrom}</span>}
                      {r.reviewDueBy && <span title="Review due"> Due {r.reviewDueBy}</span>}
                      {!r.pendingApprovalFrom && !r.reviewDueBy && '—'}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {r.status === 'Pending Review' && (
                        <button
                          type="button"
                          className="lit-btn-secondary"
                          style={{ marginRight: 4 }}
                          onClick={() => updateWorkflow(r.id, { status: 'Pending Approval (Legal)', pendingApprovalFrom: 'Legal' })}
                        >
                          Send to Legal
                        </button>
                      )}
                      {(r.status || '').toLowerCase().includes('pending approval') && (
                        <button
                          type="button"
                          className="lit-btn-primary"
                          style={{ marginRight: 4 }}
                          onClick={() => updateWorkflow(r.id, { status: 'Active', pendingApprovalFrom: '' })}
                        >
                          Approve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {pendingSavePayload && pendingSaveDiff && (
        <div className="lit-modal-backdrop">
          <div className="lit-modal">
            <h3 className="lit-list-title">Existing contract for this file</h3>
            <p className="lit-intro">
              There is already a contract using this File ID. If you continue, the following fields will be updated.
            </p>
            <div className="lit-table-wrap">
              <table className="lit-table">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Current value</th>
                    <th>New value</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingSaveDiff.map((d) => (
                    <tr key={d.field}>
                      <td>{d.field}</td>
                      <td>{d.before || '—'}</td>
                      <td>{d.after || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="lit-form-actions">
              <button
                type="button"
                className="lit-btn-primary"
                onClick={() => {
                  if (pendingSavePayload) performSave(pendingSavePayload);
                }}
              >
                Update contract
              </button>
              <button
                type="button"
                className="lit-btn-secondary"
                onClick={() => {
                  setPendingSavePayload(null);
                  setPendingSaveDiff(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
