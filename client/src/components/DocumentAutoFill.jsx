/**
 * DocumentAutoFill.jsx
 * ====================
 * Drop-in component that adds AI-powered document extraction to any form.
 *
 * How it works:
 *   1. User drops/selects one or more documents.
 *   2. Each file is sent to POST /api/extract (single) or POST /api/extract/batch.
 *   3. Extracted fields are shown in a review panel with confidence badges.
 *   4. "Apply to form" merges extracted values into the parent form.
 *   5. When the form is saved the parent should call `onFeedback(corrections)`
 *      with any fields the user edited — the system records these as learning.
 *
 * Props:
 *   module        string   – one of: poa | contracts | ip | licences | litigations | ubo
 *   onApply       fn(fields)  – called with { fieldName: value } when user confirms
 *   onBatchResults fn(results) – called with array of results in batch mode
 *   fieldLabels   object   – { fieldName: "Human Label" } for display
 *   batchMode     bool     – if true renders batch uploader (default: false)
 *   compact       bool     – smaller inline layout (default: false)
 */

import { useRef, useState } from 'react';

const API = '/api';

// ── Confidence badge ──────────────────────────────────────────────────────────
function ConfidenceBadge({ value }) {
  const pct = Math.round((value || 0) * 100);
  const color =
    pct >= 85 ? '#16a34a' :   // green
    pct >= 60 ? '#d97706' :   // amber
                '#dc2626';    // red
  return (
    <span style={{
      fontSize: '10px', fontWeight: 600, padding: '1px 6px',
      borderRadius: '10px', background: color + '20', color,
      border: `1px solid ${color}40`, whiteSpace: 'nowrap',
    }}>
      {pct}%
    </span>
  );
}

// ── Single result preview panel ───────────────────────────────────────────────
function ExtractionPreview({ result, fieldLabels, onApply, onDismiss }) {
  const [overrides, setOverrides] = useState({});

  if (!result || !result.fields) return null;

  const entries = Object.entries(result.fields).filter(([, f]) => f.value != null && f.value !== '');

  if (entries.length === 0) {
    return (
      <div style={styles.previewBox}>
        <p style={{ color: '#6b7280', margin: 0, fontSize: '13px' }}>
          No fields could be extracted from <strong>{result.filename}</strong>.
          The document may be scanned or in an unsupported format.
        </p>
        <button onClick={onDismiss} style={styles.btnSecondary}>Dismiss</button>
      </div>
    );
  }

  const merged = Object.fromEntries(
    entries.map(([k, f]) => [k, overrides[k] !== undefined ? overrides[k] : f.value])
  );

  return (
    <div style={styles.previewBox}>
      <div style={styles.previewHeader}>
        <span style={{ fontWeight: 600, fontSize: '13px' }}>
          Extracted from <em>{result.filename}</em>
          {result.learningCount > 0 && (
            <span style={{ marginLeft: 8, color: '#6366f1', fontSize: '11px' }}>
              (model trained on {result.learningCount} documents)
            </span>
          )}
        </span>
      </div>

      <div style={styles.fieldGrid}>
        {entries.map(([field, info]) => {
          const label = (fieldLabels && fieldLabels[field]) || field;
          const displayVal = overrides[field] !== undefined ? overrides[field] : info.value;
          const valStr = typeof displayVal === 'boolean' ? String(displayVal) : (displayVal ?? '');

          return (
            <div key={field} style={styles.fieldRow}>
              <div style={styles.fieldLabel}>
                <span>{label}</span>
                <ConfidenceBadge value={info.confidence} />
                {info.label && <span style={styles.sourceTag}>{info.label}</span>}
              </div>
              <input
                type="text"
                value={valStr}
                onChange={(e) => setOverrides((p) => ({ ...p, [field]: e.target.value }))}
                style={styles.fieldInput}
              />
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          onClick={() => onApply(merged)}
          style={styles.btnPrimary}
        >
          Apply to form
        </button>
        <button onClick={onDismiss} style={styles.btnSecondary}>Dismiss</button>
      </div>
    </div>
  );
}

// ── Batch results summary panel ───────────────────────────────────────────────
function BatchSummary({ response, fieldLabels, onApplyAll, onDismiss }) {
  const [selected, setSelected] = useState(() => {
    const s = {};
    (response?.results || []).forEach((_, i) => { s[i] = true; });
    return s;
  });

  if (!response) return null;
  const results = response.results || [];

  const toggleAll = (val) => {
    const s = {};
    results.forEach((_, i) => { s[i] = val; });
    setSelected(s);
  };

  const applySelected = () => {
    const chosen = results.filter((_, i) => selected[i] && !results[i].error);
    onApplyAll(chosen.map((r) => ({
      filename: r.filename,
      fields: Object.fromEntries(
        Object.entries(r.fields || {})
          .filter(([, f]) => f.value != null && f.value !== '')
          .map(([k, f]) => [k, f.value])
      ),
    })));
  };

  return (
    <div style={styles.previewBox}>
      <div style={styles.previewHeader}>
        <span style={{ fontWeight: 600, fontSize: '13px' }}>
          Batch extraction — {response.succeeded}/{response.total} succeeded
          {response.learningCount > 0 && (
            <span style={{ marginLeft: 8, color: '#6366f1', fontSize: '11px' }}>
              (model trained on {response.learningCount} documents)
            </span>
          )}
        </span>
        <span style={{ fontSize: '12px', color: '#6b7280' }}>
          Select records to import
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button onClick={() => toggleAll(true)}  style={styles.btnTiny}>Select all</button>
        <button onClick={() => toggleAll(false)} style={styles.btnTiny}>Clear</button>
      </div>

      <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
        {results.map((r, i) => {
          const fieldCount = Object.values(r.fields || {}).filter((f) => f.value != null && f.value !== '').length;
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px',
              background: i % 2 === 0 ? '#fff' : '#f9fafb',
              borderBottom: '1px solid #f3f4f6',
            }}>
              <input
                type="checkbox"
                checked={!!selected[i]}
                disabled={!!r.error}
                onChange={(e) => setSelected((p) => ({ ...p, [i]: e.target.checked }))}
                style={{ margin: 0 }}
              />
              <span style={{ flex: 1, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.filename}
              </span>
              {r.error
                ? <span style={{ color: '#dc2626', fontSize: '11px' }}>Failed</span>
                : <span style={{ color: '#16a34a', fontSize: '11px' }}>{fieldCount} fields</span>
              }
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={applySelected} style={styles.btnPrimary}>
          Import selected ({Object.values(selected).filter(Boolean).length})
        </button>
        <button onClick={onDismiss} style={styles.btnSecondary}>Dismiss</button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function DocumentAutoFill({ module, onApply, onBatchResults, fieldLabels = {}, batchMode = false, compact = false }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [result, setResult]     = useState(null);      // single result
  const [batch, setBatch]       = useState(null);      // batch response
  const fileInputRef            = useRef(null);

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setError('');
    setResult(null);
    setBatch(null);
    setLoading(true);

    try {
      if (!batchMode || files.length === 1) {
        // Single file
        const fd = new FormData();
        fd.append('file', files[0]);
        fd.append('module', module);
        const resp = await fetch(`${API}/extract`, { method: 'POST', body: fd });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Extraction failed');
        setResult(data);
      } else {
        // Batch
        const fd = new FormData();
        Array.from(files).forEach((f) => fd.append('files', f));
        fd.append('module', module);
        const resp = await fetch(`${API}/extract/batch`, { method: 'POST', body: fd });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Batch extraction failed');
        setBatch(data);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleApply = (fields) => {
    if (onApply) onApply(fields);
    setResult(null);
    setBatch(null);
  };

  const handleBatchApplyAll = (items) => {
    if (onBatchResults) onBatchResults(items);
    setBatch(null);
  };

  return (
    <div style={{ marginBottom: compact ? 8 : 16 }}>
      {/* Drop zone */}
      {!result && !batch && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            ...styles.dropZone,
            borderColor: dragging ? '#6366f1' : '#d1d5db',
            background:  dragging ? '#eef2ff' : '#fafafa',
            padding:     compact ? '10px 14px' : '18px 20px',
            cursor:      loading ? 'wait' : 'pointer',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple={batchMode}
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.tiff,.tif,.txt"
            style={{ display: 'none' }}
            onChange={(e) => handleFiles(e.target.files)}
          />

          {loading ? (
            <span style={styles.dropText}>
              <span style={styles.spinner} /> Analysing document{batchMode ? 's' : ''}…
            </span>
          ) : (
            <span style={styles.dropText}>
              <span style={{ fontSize: compact ? 16 : 20, marginRight: 8 }}>🤖</span>
              {batchMode
                ? 'Drop documents here (or click) — the AI will extract all fields automatically'
                : 'Drop a document here to auto-fill form fields with AI'
              }
              <span style={styles.dropHint}>
                PDF, DOCX, JPG, PNG · max 25 MB{batchMode ? ' · up to 50 files' : ''}
              </span>
            </span>
          )}
        </div>
      )}

      {error && (
        <div style={styles.errorBanner}>
          ⚠ {error}
          <button onClick={() => setError('')} style={styles.btnTiny}>Dismiss</button>
        </div>
      )}

      {/* Single result preview */}
      {result && (
        <ExtractionPreview
          result={result}
          fieldLabels={fieldLabels}
          onApply={handleApply}
          onDismiss={() => setResult(null)}
        />
      )}

      {/* Batch summary */}
      {batch && (
        <BatchSummary
          response={batch}
          fieldLabels={fieldLabels}
          onApplyAll={handleBatchApplyAll}
          onDismiss={() => setBatch(null)}
        />
      )}
    </div>
  );
}

/**
 * Helper hook — call inside a form component to wire up autofill + feedback.
 *
 *   const { applyExtracted, buildFeedback } = useDocumentAutoFill(moduleType);
 *
 *   <DocumentAutoFill module={moduleType} onApply={applyExtracted} />
 *   <button onClick={() => buildFeedback(originalExtracted, currentFormValues)}>Save</button>
 */
export function useDocumentAutoFill(moduleType) {
  const lastExtracted = useRef({});

  /** Merge extracted values into form state. Returns cleaned flat { fieldName: value }. */
  const applyExtracted = (fields) => {
    lastExtracted.current = fields;
    return fields;
  };

  /**
   * After the user saves, send any corrections back to the learning service.
   * `original`  – the extracted values ({ fieldName: value })
   * `current`   – current form values ({ fieldName: value })
   */
  const sendFeedback = async (original, current) => {
    const corrections = {};
    for (const [k, v] of Object.entries(current || {})) {
      const orig = (original || lastExtracted.current)[k];
      if (v && v !== orig) corrections[k] = v;
    }
    if (Object.keys(corrections).length === 0) return;
    try {
      await fetch(`/api/extract/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: moduleType, corrections }),
      });
    } catch { /* silent */ }
  };

  return { applyExtracted, sendFeedback };
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  dropZone: {
    border: '1.5px dashed',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'border-color 0.15s, background 0.15s',
    userSelect: 'none',
  },
  dropText: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    fontSize: 13,
    color: '#374151',
  },
  dropHint: {
    fontSize: 11,
    color: '#9ca3af',
    width: '100%',
    textAlign: 'center',
  },
  previewBox: {
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '14px 16px',
    background: '#f9fafb',
  },
  previewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 4,
  },
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '8px',
  },
  fieldRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  fieldLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 11,
    color: '#6b7280',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  sourceTag: {
    fontSize: 10,
    color: '#9ca3af',
    fontStyle: 'italic',
    marginLeft: 2,
  },
  fieldInput: {
    fontSize: 12,
    padding: '4px 8px',
    border: '1px solid #d1d5db',
    borderRadius: 5,
    background: '#fff',
    color: '#111827',
    width: '100%',
    boxSizing: 'border-box',
  },
  btnPrimary: {
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: 600,
    background: '#4f46e5',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  },
  btnSecondary: {
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: 500,
    background: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    cursor: 'pointer',
  },
  btnTiny: {
    padding: '3px 8px',
    fontSize: 11,
    background: '#f3f4f6',
    color: '#374151',
    border: '1px solid #e5e7eb',
    borderRadius: 4,
    cursor: 'pointer',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px',
    background: '#fef2f2',
    border: '1px solid #fca5a5',
    borderRadius: 6,
    fontSize: 12,
    color: '#991b1b',
    marginTop: 6,
  },
  spinner: {
    display: 'inline-block',
    width: 12,
    height: 12,
    border: '2px solid #d1d5db',
    borderTopColor: '#6366f1',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
};
