import { useState, useEffect } from 'react';
import { FrameworkSelector } from './FrameworkSelector';
import { RbacSelector } from './RbacSelector';
import { ChangeSnippet } from './ChangeSnippet';
import { CompaniesByFramework } from './CompaniesByFramework';
import { ChangesTree } from './ChangesTree';
import { AssignTaskModal } from './AssignTaskModal';

const API = '/api';

export function Dashboard({
  language = 'en',
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
  const [summaryCounts, setSummaryCounts] = useState({});
  const [assignTaskContext, setAssignTaskContext] = useState(null); // { changeId, parent, extraContext, change }
  const [opcoAlerts, setOpcoAlerts] = useState({});
  const [opcoAlertsLoading, setOpcoAlertsLoading] = useState(false);
  const [opcoAlertsError, setOpcoAlertsError] = useState(null);
  const selectedParent = selectedParentHolding;
  const setSelectedParent = onParentHoldingChange || (() => {});

  const hasFrameworkSelection = !!selectedFramework;
  const isFilteredByFramework = !!selectedFramework;

  // Governance summary cards: re-fetch whenever selected period changes.
  // Only frameworks with at least one change in the selected period will be shown.
  useEffect(() => {
    if (frameworks.length === 0) return;
    fetch(`${API}/changes/summary?days=${selectedDays}`)
      .then((r) => r.json())
      .then((data) => setSummaryCounts(typeof data === 'object' && data !== null ? data : {}))
      .catch(() => setSummaryCounts({}));
  }, [frameworks.length, selectedDays]);

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
  }, [selectedFramework, selectedDays, selectedParentHolding]);

  // Load OpCo → framework alerts using the same period as the Dashboard.
  useEffect(() => {
    if (frameworks.length === 0) {
      setOpcoAlerts({});
      setOpcoAlertsError(null);
      setOpcoAlertsLoading(false);
      return;
    }
    setOpcoAlertsLoading(true);
    setOpcoAlertsError(null);
    const q = new URLSearchParams();
    q.set('days', String(selectedDays));
    q.set('lookup', '1');
    fetch(`${API}/changes/opco-alerts?${q}`)
      .then((r) => r.json())
      .then((rows) => {
        const map = {};
        if (Array.isArray(rows)) {
          rows.forEach((row) => {
            if (row && row.opco) {
              map[row.opco] = row;
            }
          });
        }
        setOpcoAlerts(map);
      })
      .catch((e) => {
        setOpcoAlerts({});
        setOpcoAlertsError(e.message || 'Failed to load OpCo alerts');
      })
      .finally(() => setOpcoAlertsLoading(false));
  }, [frameworks.length, selectedDays]);

  const selectedOpcoAlertEntry =
    selectedOpCo && opcoAlerts[selectedOpCo] ? opcoAlerts[selectedOpCo] : null;
  const selectedOpcoFrameworkAlerts = selectedOpcoAlertEntry
    ? (Array.isArray(selectedOpcoAlertEntry.frameworks)
        ? selectedOpcoAlertEntry.frameworks
        : []
      ).filter((fw) => frameworks.includes(fw.framework))
    : [];
  const selectedOpcoTotalChanges = selectedOpcoFrameworkAlerts.reduce(
    (sum, fw) => sum + (fw.changesCount || 0),
    0,
  );

  const handleDownloadXbrl = () => {
    const body = { days: selectedDays, lookup: false };
    if (isFilteredByFramework) body.framework = selectedFramework;
    fetch(`${API}/pdf/xbrl`, {
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
        const filename = match ? match[1].trim() : 'regulatory-changes.xbrl';
        const blob = await r.blob();
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
      .catch((e) => alert('XBRL export failed: ' + (e.message || String(e))));
  };

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
      {frameworks.length > 0 && (
        <section className="governance-framework-summary" aria-labelledby="governance-summary-heading">
          <h2 id="governance-summary-heading" className="governance-summary-title">Governance Framework Summary</h2>
          {(() => {
            const periodLabel = periodOptions.find((o) => o.value === selectedDays)?.label || `${selectedDays} days`;
            const activeFrameworks = frameworks.filter((fw) => {
              const fwSummary = summaryCounts[fw];
              const count = typeof fwSummary === 'number' ? fwSummary : (fwSummary?.count ?? 0);
              return count > 0;
            });
            return (
              <>
                {activeFrameworks.length === 0 && Object.keys(summaryCounts).length > 0 && (
                  <p className="governance-summary-empty">No regulatory changes recorded in the selected period ({periodLabel}). Adjust the time period to see active frameworks.</p>
                )}
                <div className="governance-summary-cards">
                  {activeFrameworks.map((fw) => {
                    const ref = frameworkReferences[fw];
                    const abbreviation = ref?.abbreviation ?? fw;
                    const authority = ref?.authority ?? '';
                    const fwSummary = summaryCounts[fw];
                    const count = typeof fwSummary === 'number' ? fwSummary : (fwSummary?.count ?? 0);
                    const hasCritical = fwSummary?.hasCritical ?? false;
                    const isSelected = fw === selectedFramework;
                    return (
                      <button
                        key={fw}
                        type="button"
                        className={`governance-summary-card ${isSelected ? 'governance-summary-card-selected' : ''} ${hasCritical ? 'governance-summary-card-critical' : ''}`}
                        onClick={() => onFrameworkChange(fw)}
                        aria-pressed={isSelected}
                        aria-label={`${abbreviation}: ${authority || fw}. ${count} updates in ${periodLabel}. Select to show change summary.`}
                      >
                        {hasCritical && <span className="governance-summary-card-critical-dot" aria-label="Has critical deadline" title="Has critical deadline" />}
                        <span className="governance-summary-card-abbr">{abbreviation}</span>
                        {authority && <span className="governance-summary-card-authority">{authority}</span>}
                        <span className="governance-summary-card-updates">
                          {count} Update{count !== 1 ? 's' : ''} · {periodLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </section>
      )}

      <div className="framework-selector-row">
        <FrameworkSelector
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

      {frameworks.length === 0 ? (
        <div className="dashboard-no-framework">
          <p className="dashboard-no-framework-msg">No frameworks loaded. Go to <strong>Onboarding</strong>, set <strong>Sector of Operations</strong> and <strong>Licencing Authorities</strong>, then use &quot;View applicable frameworks&quot; or confirm an organization to load the frameworks that apply. The Framework dropdown will then list only those.</p>
        </div>
      ) : !hasFrameworkSelection ? (
        <div className="dashboard-no-framework">
          <p className="dashboard-no-framework-msg">Select a framework from the dropdown above or click a framework card in the summary to view <strong>Impact: Framework → Change → Parent Holding company</strong> and the changes below.</p>
        </div>
      ) : (
        <>
          <RbacSelector
            selectedParent={selectedParent}
            selectedOpCo={selectedOpCo}
            onParentChange={setSelectedParent}
            onOpCoChange={(v) => setSelectedOpCo(v)}
          />

        {selectedOpCo && (
          <div
            className={`dashboard-opco-alert ${
              selectedOpcoFrameworkAlerts.length > 0
                ? 'dashboard-opco-alert-has-updates'
                : 'dashboard-opco-alert-no-updates'
            }`}
          >
            {opcoAlertsLoading ? (
              <span>Checking recent framework updates for <span className="dashboard-opco-alert-strong">{selectedOpCo}</span>…</span>
            ) : opcoAlertsError ? (
              <span>Could not check framework updates for <span className="dashboard-opco-alert-strong">{selectedOpCo}</span>.</span>
            ) : selectedOpcoFrameworkAlerts.length === 0 ? (
              <span>
                No recent changes in the selected time period for frameworks associated with{' '}
                <span className="dashboard-opco-alert-strong">{selectedOpCo}</span>.
              </span>
            ) : (
              <span>
                <span className="dashboard-opco-alert-strong">{selectedOpCo}</span> is part of{' '}
                {selectedOpcoFrameworkAlerts.length} framework
                {selectedOpcoFrameworkAlerts.length !== 1 ? 's' : ''} with{' '}
                {selectedOpcoTotalChanges} recent change
                {selectedOpcoTotalChanges !== 1 ? 's' : ''} in the last {selectedDays} day
                {selectedDays !== 1 ? 's' : ''}.
              </span>
            )}
          </div>
        )}

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
            onAssignTasks={(changeId, parent, extraContext = {}) => {
              const change = changes.find((c) => c.id === changeId) || null;
              setAssignTaskContext({ changeId, parent, extraContext, change });
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
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDownloadXbrl}
              title="Download XBRL regulatory data file"
              style={{ marginLeft: '0.5rem' }}
            >
              Export XBRL
            </button>
          </div>
        </>
      )}

      {assignTaskContext && (
        <AssignTaskModal
          change={assignTaskContext.change}
          parent={assignTaskContext.parent}
          extraContext={assignTaskContext.extraContext}
          onClose={() => setAssignTaskContext(null)}
          onCreated={() => setAssignTaskContext(null)}
        />
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
