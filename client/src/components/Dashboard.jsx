import { useState, useEffect } from 'react';
import { FrameworkSelector } from './FrameworkSelector';
import { RbacSelector } from './RbacSelector';
import { ChangeSnippet } from './ChangeSnippet';
import { CompaniesByFramework } from './CompaniesByFramework';
import { ChangesTree } from './ChangesTree';

const API = '/api';

export function Dashboard({
  language = 'en',
  allFrameworksValue,
  frameworkReferences,
  frameworks,
  periodOptions,
  selectedFramework,
  selectedDays,
  onFrameworkChange,
  onPeriodChange,
  selectedParentHolding = '',
  onParentHoldingChange,
}) {
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState(null);
  const [expandedChangeId, setExpandedChangeId] = useState(null);
  const [viewDetailsContext, setViewDetailsContext] = useState(null);
  const [selectedOpCo, setSelectedOpCo] = useState('');
  const selectedParent = selectedParentHolding;
  const setSelectedParent = onParentHoldingChange || (() => {});

  const hasFrameworkSelection = !!selectedFramework;
  const isFilteredByFramework = selectedFramework && selectedFramework !== allFrameworksValue;

  const loadChanges = () => {
    if (!selectedFramework) return;
    setLoading(true);
    setError(null);
    const q = new URLSearchParams();
    if (isFilteredByFramework) q.set('framework', selectedFramework);
    q.set('days', String(selectedDays));
    q.set('lookup', '1');
    fetch(`${API}/changes?${q}`)
      .then((r) => r.json())
      .then((data) => setChanges(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!selectedFramework) {
      setChanges([]);
      setError(null);
      return;
    }
    loadChanges();
  }, [selectedFramework, selectedParentHolding]);

  const handleDownloadPdf = () => {
    const body = { days: selectedDays, lookup: true };
    if (isFilteredByFramework) body.framework = selectedFramework;
    fetch(`${API}/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({ error: r.statusText }));
          throw new Error(err.error || r.statusText);
        }
        const disp = r.headers.get('Content-Disposition');
        const match = disp && disp.match(/filename="?([^";\n]+)"?/);
        const filename = match ? match[1].trim() : 'regulation-changes.pdf';
        const blob = await r.blob();
        if (blob.type && blob.type !== 'application/pdf') {
          const text = await blob.text();
          throw new Error(text || 'Server did not return a PDF');
        }
        return { blob, filename };
      })
      .then(({ blob, filename }) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch((e) => alert('PDF download failed: ' + (e.message || String(e))));
  };

  const handleSendEmail = (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setEmailStatus('sending');
    const body = { to: email.trim(), days: selectedDays };
    if (isFilteredByFramework) body.framework = selectedFramework;
    fetch(`${API}/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setEmailStatus('sent');
        setEmail('');
      })
      .catch((e) => {
        setEmailStatus('error');
        setTimeout(() => setEmailStatus(null), 3000);
        alert(e.message);
      });
  };

  return (
    <>
      <div className="framework-selector-row">
        <FrameworkSelector
          allFrameworksValue={allFrameworksValue}
          frameworks={frameworks}
          value={selectedFramework}
          onFrameworkChange={onFrameworkChange}
        />
        <div className="period-selector">
          <label htmlFor="period-select">Time period</label>
          <select
            id="period-select"
            value={selectedDays}
            onChange={(e) => onPeriodChange(Number(e.target.value))}
          >
            {periodOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={loadChanges}
          disabled={loading || !hasFrameworkSelection}
        >
          {loading ? 'Loading…' : 'Show changes'}
        </button>
      </div>

      {!hasFrameworkSelection ? (
        <div className="dashboard-no-framework">
          <p className="dashboard-no-framework-msg">Select a framework above to view <strong>Impact: Framework → Change → Parent Holding company</strong> and the changes below.</p>
        </div>
      ) : (
        <>
          <RbacSelector
            selectedParent={selectedParent}
            selectedOpCo={selectedOpCo}
            onParentChange={setSelectedParent}
            onOpCoChange={(v) => setSelectedOpCo(v)}
          />

          {isFilteredByFramework && frameworkReferences[selectedFramework] && (
            <p className="framework-reference-line">
              <span className="framework-reference-label">Official rulebook: </span>
              <a
                href={frameworkReferences[selectedFramework].url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {frameworkReferences[selectedFramework].url}
              </a>
              {frameworkReferences[selectedFramework].description && (
                <span className="framework-reference-desc"> — {frameworkReferences[selectedFramework].description}</span>
              )}
            </p>
          )}

          <ChangesTree
            changes={changes}
            selectedParent={selectedParent}
            selectedOpCo={selectedOpCo}
            onViewDetails={(id, context) => {
              setExpandedChangeId(id);
              setViewDetailsContext(context || null);
            }}
            onAssignTasks={(changeId, parent) => {
              console.log('Assign tasks', { changeId, parent });
            }}
          />

          {loading && <div className="loading">Loading changes…</div>}
          {error && <div className="error">Error: {error}</div>}
          {!loading && !error && changes.length === 0 && (
            <div className="empty-state">
              No changes in the selected time period for the selected framework. Try a longer period (e.g. 6 months or 1 year).
            </div>
          )}
          {!loading && !error && changes.length > 0 && (
            <div className="snippets-list">
              {changes.map((c) => (
                <ChangeSnippet
                  key={c.id}
                  change={c}
                  frameworkReferences={frameworkReferences}
                  expanded={expandedChangeId === c.id}
                  onExpandChange={(v) => {
                    setExpandedChangeId(v ? c.id : null);
                    if (!v) setViewDetailsContext(null);
                  }}
                  detailContext={expandedChangeId === c.id ? viewDetailsContext : null}
                />
              ))}
            </div>
          )}

          {isFilteredByFramework && (
            <CompaniesByFramework framework={selectedFramework} selectedParentHolding={selectedParent} />
          )}

          <div className="actions-row">
            <button type="button" className="btn btn-primary" onClick={handleDownloadPdf}>
              Download as PDF
            </button>
          </div>
        </>
      )}

      <section className="pdf-email-section">
        <h3>Send changes by email</h3>
        <form className="email-form" onSubmit={handleSendEmail}>
          <input
            type="email"
            placeholder="Recipient email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit" className="btn">
            {emailStatus === 'sending' ? 'Sending…' : 'Send'}
          </button>
        </form>
        {emailStatus === 'sent' && (
          <p style={{ marginTop: '0.5rem', color: 'var(--success)', fontSize: '0.9rem' }}>
            Email sent successfully.
          </p>
        )}
        {emailStatus === 'error' && (
          <p style={{ marginTop: '0.5rem', color: '#ef4444', fontSize: '0.9rem' }}>
            Failed to send. Check server SMTP config.
          </p>
        )}
      </section>
    </>
  );
}
