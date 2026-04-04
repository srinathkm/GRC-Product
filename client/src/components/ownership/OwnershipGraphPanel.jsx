import { useCallback, useEffect, useState } from 'react';
import OwnershipGraphView from './OwnershipGraphView.jsx';
import { buildOwnershipGraphContextId } from './ownershipGraphContextId.js';
import { OwnershipCoachMarks, shouldShowOwnershipCoach, dismissOwnershipCoach } from './OwnershipCoachMarks.jsx';
import './OwnershipGraph.css';

const API = '/api';

/**
 * UBO tab: upload a cap table / shareholder register → ownership chart (decision-support).
 * Phase 2: persisted graph per context, coach marks, link to UBO register.
 */
export default function OwnershipGraphPanel({
  subjectHint = '',
  parentHolding = '',
  selectedOpco = '',
  registerOpcoNames = [],
  onOpenInRegister,
}) {
  const contextId = buildOwnershipGraphContextId(parentHolding, selectedOpco);

  const [graph, setGraph] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [extractionMeta, setExtractionMeta] = useState(null);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [coachOpen, setCoachOpen] = useState(false);

  const persistGraph = useCallback(
    async (g, w, meta, name) => {
      if (!contextId || !g?.nodes?.length) return;
      try {
        await fetch(`${API}/ubo/ownership-graph/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contextId,
            graph: g,
            warnings: w,
            extractionMeta: meta,
            fileName: name || '',
          }),
        });
      } catch {
        /* non-fatal */
      }
    },
    [contextId],
  );

  useEffect(() => {
    if (!contextId) return undefined;
    let cancelled = false;
    fetch(`${API}/ubo/ownership-graph/${encodeURIComponent(contextId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.graph?.nodes?.length) return;
        setGraph(data.graph);
        setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
        setExtractionMeta(data.extractionMeta || null);
        if (data.fileName) setFileName(data.fileName);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [contextId]);

  useEffect(() => {
    if (!graph?.nodes?.length) return;
    if (!shouldShowOwnershipCoach()) return;
    setCoachOpen(true);
  }, [graph]);

  const dismissCoach = useCallback(() => {
    dismissOwnershipCoach();
    setCoachOpen(false);
  }, []);

  const onFile = useCallback(
    async (e) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      setLoading(true);
      setError('');
      setGraph(null);
      setWarnings([]);
      setExtractionMeta(null);
      setFileName(file.name);
      try {
        const fd = new FormData();
        fd.append('file', file);
        if (subjectHint) fd.append('subjectHint', subjectHint);
        const res = await fetch(`${API}/ubo/ownership-graph/extract`, {
          method: 'POST',
          body: fd,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg =
            typeof data.error === 'string'
              ? data.error
              : 'Upload could not be processed. Try a smaller file or a text-based PDF.';
          setError(msg);
          if (data.graph && Array.isArray(data.graph.nodes)) setGraph(data.graph);
          setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
          setExtractionMeta(data.extractionMeta || null);
          return;
        }
        setGraph(data.graph || null);
        setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
        setExtractionMeta(data.extractionMeta || null);
        if (data.fileName) setFileName(data.fileName);
        if (data.graph?.nodes?.length) {
          await persistGraph(data.graph, data.warnings, data.extractionMeta, data.fileName || file.name);
        }
      } catch (err) {
        setError(
          err && err.message
            ? `Network error: ${err.message}`
            : 'Something went wrong while uploading. Check your connection and try again.',
        );
      } finally {
        setLoading(false);
        e.target.value = '';
      }
    },
    [subjectHint, persistGraph],
  );

  return (
    <div className="ubo-mandatory-docs" data-testid="ownership-graph-panel">
      <h3 className="og-panel-title">Ownership graph</h3>
      <p className="og-panel-sub">
        From an uploaded shareholder register or cap table — multi-level ownership in one place. This chart supports
        internal review only; verify against signed documents before relying on it for filings or disclosures.
      </p>
      {contextId ? (
        <p className="og-panel-sub og-panel-context">
          Saved scope: <strong>{parentHolding || '—'}</strong>
          {selectedOpco ? (
            <>
              {' '}
              · OpCo filter: <strong>{selectedOpco}</strong>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="og-panel-upload">
        <p>
          Accepted: PDF, Word, or clear images. Text must be selectable or OCR-readable; scanned-only pages may return an
          empty chart.
        </p>
        <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={onFile} disabled={loading} data-testid="ownership-graph-file-input" />
        {loading ? <div className="og-skeleton" style={{ marginTop: '1rem' }} aria-busy="true" aria-label="Loading chart" /> : null}
      </div>

      {error ? (
        <div className="og-error" role="alert">
          {error}
        </div>
      ) : null}

      {!loading && graph?.nodes?.length ? (
        <OwnershipGraphView
          graph={graph}
          warnings={warnings}
          extractionMeta={extractionMeta}
          fileName={fileName}
          registerOpcoNames={registerOpcoNames}
          onOpenInRegister={onOpenInRegister}
        />
      ) : null}

      {!loading && !graph?.nodes?.length && !error ? (
        <p className="ubo-empty">
          Upload a document to generate a chart. The UBO register and holding structure tabs are unchanged if you skip
          this.
        </p>
      ) : null}

      <details className="og-about">
        <summary>About this chart</summary>
        <p>
          Model output is normalized and checked for cycles on the server. Version {graph?.schemaVersion || '1'}. Timestamps
          in the bar refer to server extraction time. When a scope is set above, the latest chart for that scope is saved on
          the server for this workspace.
        </p>
      </details>

      {coachOpen && graph?.nodes?.length ? (
        <OwnershipCoachMarks visible={coachOpen} onDismiss={dismissCoach} />
      ) : null}
    </div>
  );
}
