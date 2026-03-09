import { useState, useRef, useEffect, useMemo } from 'react';
import './Analysis.css';
import { getUboSummaryForMa, getUboDataForMa } from './UltimateBeneficiaryOwner';
import { getEsgSummaryForMa, getEsgDataForMa } from './EsgSummary';
import { getDataSovereigntySummaryForMa } from './DataSovereignty';
import { getDataSecuritySummaryForMa } from './DataSecurityCompliance';

const API = '/api';

export function Analysis({ language = 'en', selectedParentHolding, onParentHoldingChange, parents = [], companiesRefreshKey = 0, activeView = 'analysis' }) {
  const [parent, setParent] = useState(selectedParentHolding || '');
  useEffect(() => {
    setParent(selectedParentHolding || '');
  }, [selectedParentHolding]);
  const [historicalFile, setHistoricalFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const [maDocFile, setMaDocFile] = useState(null);
  const [maResult, setMaResult] = useState(null);
  const [maLoading, setMaLoading] = useState(false);
  const [maError, setMaError] = useState(null);
  const maFileInputRef = useRef(null);
  const [maParentGroup, setMaParentGroup] = useState('');
  const [maTarget, setMaTarget] = useState('');
  const [maRoles, setMaRoles] = useState({ parents: [], opcos: [] });

  useEffect(() => {
    fetch(`${API}/companies/roles`)
      .then((r) => r.json())
      .then((data) => setMaRoles({ parents: data.parents || [], opcos: data.opcos || [] }))
      .catch(() => {});
  }, [companiesRefreshKey]);

  const handleParentChange = (p) => {
    setParent(p);
    if (onParentHoldingChange) onParentHoldingChange(p);
    setResult(null);
    setError(null);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setHistoricalFile(file || null);
    setResult(null);
  };

  const runPrediction = (parentOverride) => {
    const targetParent = (parentOverride ?? parent)?.trim();
    if (!targetParent) {
      setError('Please select a Parent Holding.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    const formData = new FormData();
    formData.append('parent', targetParent);
    if (historicalFile) formData.append('historical', historicalFile);
    fetch(`${API}/analysis/risk-prediction`, {
      method: 'POST',
      body: formData,
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setResult(data);
      })
      .catch((e) => setError(e.message || 'Prediction failed'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (selectedParentHolding?.trim()) {
      setParent(selectedParentHolding);
      setError(null);
      runPrediction(selectedParentHolding.trim());
    }
  }, [selectedParentHolding]);

  const handleMaDocChange = (e) => {
    const file = e.target.files?.[0];
    setMaDocFile(file || null);
    setMaResult(null);
    setMaError(null);
  };

  const maTargetOptions = useMemo(() => {
    const otherParents = (maRoles.parents || []).filter((p) => p !== maParentGroup);
    const opcos = maRoles.opcos || [];
    return [...otherParents, ...opcos];
  }, [maRoles.parents, maRoles.opcos, maParentGroup]);

  const runMaSimulator = () => {
    setMaLoading(true);
    setMaError(null);
    setMaResult(null);
    const formData = new FormData();
    formData.append('parentGroup', maParentGroup);
    formData.append('target', maTarget);
    if (maDocFile) formData.append('document', maDocFile);
    // UBO lookup for target OpCo (entity)
    const uboData = getUboDataForMa(maParentGroup, maTarget);
    const uboSummary = getUboSummaryForMa(maParentGroup, maTarget);
    if (uboData) formData.append('uboData', JSON.stringify(uboData));
    if (uboSummary) formData.append('uboSummary', uboSummary);
    // ESG summary for target OpCo
    const esgData = getEsgDataForMa(maTarget);
    const esgSummary = getEsgSummaryForMa(maTarget);
    if (esgData) formData.append('esgData', JSON.stringify(esgData));
    if (esgSummary) formData.append('esgSummary', esgSummary);
    // Heat map row for target OpCo (from risk prediction result)
    const heatMapRow = result?.byOpCo?.find((r) => r.opco === maTarget) ?? null;
    if (heatMapRow) formData.append('heatMapRow', JSON.stringify(heatMapRow));
    const dataSovereigntySummary = getDataSovereigntySummaryForMa(maTarget);
    const dataSecuritySummary = getDataSecuritySummaryForMa(maTarget);
    if (dataSovereigntySummary) formData.append('dataSovereigntySummary', dataSovereigntySummary);
    if (dataSecuritySummary) formData.append('dataSecuritySummary', dataSecuritySummary);
    fetch(`${API}/analysis/ma-simulator`, {
      method: 'POST',
      body: formData,
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setMaResult(data);
      })
      .catch((e) => setMaError(e.message || 'Processing failed'))
      .finally(() => setMaLoading(false));
  };

  const downloadMaReport = () => {
    if (!maResult?.reportId) return;
    fetch(`${API}/analysis/ma-simulator/report?reportId=${encodeURIComponent(maResult.reportId)}`)
      .then((r) => {
        if (!r.ok) throw new Error('Download failed');
        return r.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = maResult.downloadFilename || 'M&A-Framework-Assessment-Report.pdf';
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => setMaError('Could not download report'));
  };

  const maxBar = result?.chartData?.riskScores?.length
    ? Math.max(100, ...result.chartData.riskScores)
    : 100;

  /** Heat map: risk 0→green, 100→red. Compliance/good 0→red, 100→green. */
  const riskToColor = (v) => {
    const n = Math.max(0, Math.min(100, Number(v) ?? 0));
    const r = Math.round(34 + (239 - 34) * (n / 100));
    const g = Math.round(197 + (68 - 197) * (n / 100));
    const b = Math.round(94 + (68 - 94) * (n / 100));
    return `rgb(${r},${g},${b})`;
  };
  const complianceToColor = (v) => {
    const n = Math.max(0, Math.min(100, Number(v) ?? 0));
    return riskToColor(100 - n);
  };

  return (
    <div className="analysis-section">
      <h2 className="analysis-title">Analysis</h2>
      <p className="analysis-intro">
        Predictive risk analysis for compliance: combine current regulatory deadlines and OpCo data with optional historical compliance data to predict whether compliance will be met in time. The analysis includes <strong>financial penalty</strong> exposure (OpCo and Parent), <strong>capital investment</strong> needed to complete compliance, <strong>compliance gaps</strong> (modules not yet met and missing details), and <strong>business impact</strong> if compliance is not met. Results are shown in graphs, tables, and a detailed explanation for analysts.
      </p>

      {activeView === 'analysis' && (
      <section className="analysis-block analysis-setup">
        <h3 className="analysis-heading">Risk Predictor</h3>
        <p className="analysis-subheading">
          Select a parent holding and optionally upload historical compliance data (CSV or JSON). The model uses current system data (changes, deadlines, OpCos) and historical outcomes to predict compliance risk.
        </p>

        <div className="analysis-controls">
          <div className="analysis-control-row">
            <label htmlFor="analysis-parent">Parent Holding</label>
            <select
              id="analysis-parent"
              value={parent}
              onChange={(e) => handleParentChange(e.target.value)}
              className="analysis-select"
            >
              <option value="">Select parent…</option>
              {parents.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div className="analysis-control-row">
            <label>Historical data (optional)</label>
            <div className="analysis-upload">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.csv,application/json,text/csv,text/plain"
                onChange={handleFileChange}
                className="analysis-file-input"
              />
              <button
                type="button"
                className="analysis-btn analysis-btn-secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                {historicalFile ? historicalFile.name : 'Upload CSV or JSON'}
              </button>
              <span className="analysis-upload-hint">
                CSV: opco, year, deadlineMet | JSON: &#123; "records": [ &#123; "opco", "year", "deadlineMet" &#125; ] &#125;
              </span>
            </div>
          </div>

          <div className="analysis-control-row">
            <button
              type="button"
              className="analysis-btn analysis-btn-primary"
              onClick={runPrediction}
              disabled={loading || !parent?.trim()}
            >
              {loading ? 'Running prediction…' : 'Run risk prediction'}
            </button>
          </div>
        </div>
      </section>
      )}

      {activeView === 'ma-simulator' && (
      <section className="analysis-block analysis-ma-simulator">
        <h3 className="analysis-heading">M&amp;A Simulator</h3>
        <p className="analysis-subheading">
          Know exactly what frameworks apply before you incorporate. Select <strong>Parent Group</strong> (acquirer) and <strong>Target</strong> (entity or group to be acquired). The assessment will detail all applicable compliance logic, plus financial and commercial aspects (manpower and cross-jurisdictional system mapping). Optionally upload deal documents for extraction and review.
        </p>
        <div className="analysis-controls">
          <div className="analysis-control-row">
            <label htmlFor="ma-parent-group">Parent Group</label>
            <select
              id="ma-parent-group"
              className="analysis-select"
              value={maParentGroup}
              onChange={(e) => {
                setMaParentGroup(e.target.value);
                setMaTarget('');
                setMaResult(null);
              }}
            >
              <option value="">Select parent holding group…</option>
              {(maRoles.parents || parents || []).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <span className="analysis-upload-hint">Acquirer / parent group</span>
          </div>
          <div className="analysis-control-row">
            <label htmlFor="ma-target">Target</label>
            <select
              id="ma-target"
              className="analysis-select"
              value={maTarget}
              onChange={(e) => {
                setMaTarget(e.target.value);
                setMaResult(null);
              }}
              disabled={!maParentGroup}
            >
              <option value="">Select target (OpCo or other parent group)…</option>
              {maTargetOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <span className="analysis-upload-hint">All OpCos and parent groups except the selected Parent Group</span>
          </div>
          <div className="analysis-control-row">
            <label>Upload document (optional)</label>
            <div className="analysis-upload">
              <input
                ref={maFileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                onChange={handleMaDocChange}
                className="analysis-file-input"
              />
              <button
                type="button"
                className="analysis-btn analysis-btn-secondary"
                onClick={() => maFileInputRef.current?.click()}
              >
                {maDocFile ? maDocFile.name : 'Upload PDF, DOC or DOCX'}
              </button>
              <span className="analysis-upload-hint">
                PDF, Word or text. Extracted sections will be reviewed against SAMA, CBUAE, DFSA, CMA, SDAIA, UAE Federal, and other applicable frameworks.
              </span>
            </div>
          </div>
          <div className="analysis-control-row">
            <button
              type="button"
              className="analysis-btn analysis-btn-primary"
              onClick={runMaSimulator}
              disabled={maLoading || !maParentGroup || !maTarget}
            >
              {maLoading ? 'Generating assessment…' : 'Generate assessment'}
            </button>
          </div>
        </div>
        {maError && <div className="analysis-error">{maError}</div>}
        {maResult && (
          <div className="analysis-ma-outcome">
            <h4 className="analysis-ma-outcome-title">Assessment outcome</h4>
            {maResult.summary && <p className="analysis-ma-summary">{maResult.summary}</p>}

            <div className="analysis-ma-cards">
              {maResult.applicableFrameworksByJurisdiction && maResult.applicableFrameworksByJurisdiction.length > 0 && (
                <div className="analysis-ma-card">
                  <h5 className="analysis-ma-card-title">Applicable frameworks (by target OpCo jurisdiction)</h5>
                  <p className="analysis-ma-card-desc">Frameworks applicable for the parent based on the target OpCo&apos;s market jurisdiction.</p>
                  <ul className="analysis-ma-card-list">
                    {maResult.applicableFrameworksByJurisdiction.map((j, i) => (
                      <li key={i}>
                        <strong>{j.jurisdiction}</strong> ({j.location}): {(j.frameworks || []).join(', ')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {maResult.keyProcessesByFramework && maResult.keyProcessesByFramework.length > 0 && (
                <div className="analysis-ma-card">
                  <h5 className="analysis-ma-card-title">Key processes to complete (by governance framework)</h5>
                  <p className="analysis-ma-card-desc">Processes to be completed based on the governance framework applicable for the target OpCo and its jurisdiction.</p>
                  {maResult.keyProcessesByFramework.map((k, i) => (
                    <div key={i} className="analysis-ma-process-block">
                      <strong>{k.framework}</strong>
                      <ul>
                        {(k.processes || []).map((p, j) => (
                          <li key={j}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {maResult.dataSovereigntyAssessmentStatus && (
                <div className="analysis-ma-card">
                  <h5 className="analysis-ma-card-title">Data sovereignty assessment</h5>
                  <p className="analysis-ma-card-desc">Status of the Data Sovereignty assessment for the target OpCo.</p>
                  <p className={`analysis-ma-status-badge analysis-ma-status-badge--${(maResult.dataSovereigntyAssessmentStatus.status || '').toLowerCase().replace(/\s+/g, '-')}`}>
                    {maResult.dataSovereigntyAssessmentStatus.status}
                  </p>
                  {maResult.dataSovereigntyAssessmentStatus.summary && (
                    <p className="analysis-ma-card-note">{maResult.dataSovereigntyAssessmentStatus.summary}</p>
                  )}
                </div>
              )}

              {maResult.securityPostureAssessmentStatus && (
                <div className="analysis-ma-card">
                  <h5 className="analysis-ma-card-title">Security posture assessment</h5>
                  <p className="analysis-ma-card-desc">Status of the Security Posture assessment for the target OpCo.</p>
                  <p className={`analysis-ma-status-badge analysis-ma-status-badge--${(maResult.securityPostureAssessmentStatus.status || '').toLowerCase().replace(/\s+/g, '-')}`}>
                    {maResult.securityPostureAssessmentStatus.status}
                  </p>
                  {maResult.securityPostureAssessmentStatus.summary && (
                    <p className="analysis-ma-card-note">{maResult.securityPostureAssessmentStatus.summary}</p>
                  )}
                </div>
              )}

              {maResult.financialModelling && (
                <div className="analysis-ma-card">
                  <h5 className="analysis-ma-card-title">Financial modelling – cost to comply (AED)</h5>
                  <p className="analysis-ma-card-desc">Estimated cost to comply with all applicable compliances.</p>
                  <div className="analysis-ma-financial-summary">
                    <span className="analysis-ma-financial-total">One-time: {(maResult.financialModelling.totalOneTimeAED || 0).toLocaleString()} AED</span>
                    <span className="analysis-ma-financial-total">Annual: {(maResult.financialModelling.totalAnnualAED || 0).toLocaleString()} AED</span>
                  </div>
                  <ul className="analysis-ma-card-list">
                    {(maResult.financialModelling.breakdown || []).map((b, i) => (
                      <li key={i}>{b.item}: {(b.amountAED || 0).toLocaleString()} AED ({b.type})</li>
                    ))}
                  </ul>
                </div>
              )}

              {maResult.systemIntegrations && maResult.systemIntegrations.length > 0 && (
                <div className="analysis-ma-card">
                  <h5 className="analysis-ma-card-title">System integrations for merger</h5>
                  <p className="analysis-ma-card-desc">List of system integrations that need to be completed for the merger.</p>
                  <ul className="analysis-ma-card-list">
                    {maResult.systemIntegrations.map((s, i) => (
                      <li key={i}>
                        <span className={`analysis-ma-priority analysis-ma-priority--${(s.priority || '').toLowerCase()}`}>{s.priority}</span> {s.system}: {s.description}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {maResult.timeModel && (
                <div className="analysis-ma-card">
                  <h5 className="analysis-ma-card-title">Time model</h5>
                  <p className="analysis-ma-card-desc">Estimated time to complete integration.</p>
                  <p className="analysis-ma-time-total">
                    Total: <strong>{maResult.timeModel.totalWeeks} weeks</strong> ({maResult.timeModel.totalMonths} months)
                  </p>
                  <ul className="analysis-ma-card-list">
                    {(maResult.timeModel.phases || []).map((p, i) => (
                      <li key={i}>{p.name}: {p.weeks} weeks</li>
                    ))}
                  </ul>
                </div>
              )}

              {maResult.complianceTimelines && maResult.complianceTimelines.length > 0 && (
                <div className="analysis-ma-card analysis-ma-card--full">
                  <h5 className="analysis-ma-card-title">Compliance timelines (days post-signing)</h5>
                  <p className="analysis-ma-card-desc">Timeline in days by when each compliance should be completed once the merger is signed.</p>
                  <div className="analysis-ma-timelines-wrap">
                    <table className="analysis-ma-timelines-table">
                      <thead>
                        <tr>
                          <th>Compliance</th>
                          <th>Framework</th>
                          <th>Days post-signing</th>
                        </tr>
                      </thead>
                      <tbody>
                        {maResult.complianceTimelines.map((t, i) => (
                          <tr key={i}>
                            <td>{t.compliance}</td>
                            <td>{t.framework}</td>
                            <td><strong>{t.daysPostSigning}</strong> days</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {maResult.financialCommercial && (
              <div className="analysis-ma-financial">
                <h5>Financial and commercial aspect</h5>
                <div className="analysis-ma-financial-grid">
                  <div className="analysis-ma-financial-card">
                    <span className="analysis-ma-financial-label">Manpower (FTE)</span>
                    <span className="analysis-ma-financial-value">{maResult.financialCommercial.manpowerFte ?? '—'}</span>
                    {maResult.financialCommercial.manpowerCost != null && (
                      <span className="analysis-ma-financial-sublabel">Est. cost: {maResult.financialCommercial.manpowerCost}</span>
                    )}
                  </div>
                  <div className="analysis-ma-financial-card">
                    <span className="analysis-ma-financial-label">Cross-jurisdictional system mapping</span>
                    <p className="analysis-ma-financial-desc">{maResult.financialCommercial.crossJurisdictionalMapping || '—'}</p>
                  </div>
                  {maResult.financialCommercial.additionalCosts && (
                    <div className="analysis-ma-financial-card">
                      <span className="analysis-ma-financial-label">Additional compliance costs</span>
                      <p className="analysis-ma-financial-desc">{maResult.financialCommercial.additionalCosts}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {maResult.detailedOutcome && (
              <div className="analysis-ma-detailed">
                <h5>Detailed outcome</h5>
                <div className="analysis-ma-detailed-body">
                  {typeof maResult.detailedOutcome === 'string'
                    ? maResult.detailedOutcome.split(/\n/).map((p, i) => <p key={i}>{p}</p>)
                    : (maResult.detailedOutcome.sections || []).map((s, i) => (
                      <div key={i} className="analysis-ma-section">
                        <strong>{s.title}</strong>
                        <p>{s.content}</p>
                      </div>
                    ))}
                </div>
              </div>
            )}
            <div className="analysis-ma-actions">
              <button
                type="button"
                className="analysis-btn analysis-btn-primary"
                onClick={downloadMaReport}
                disabled={!maResult.reportId}
              >
                Download PDF for audit review
              </button>
            </div>
          </div>
        )}
      </section>
      )}

      {error && (
        <div className="analysis-error">
          {error}
        </div>
      )}

      {activeView === 'analysis' && result && (
        <>
          <section className="analysis-block analysis-summary-cards">
            <h3 className="analysis-heading">Prediction summary</h3>
            <div className="analysis-cards">
              <div className={`analysis-card analysis-card-risk analysis-risk-${(result.summary?.overallRiskLevel || '').toLowerCase()}`}>
                <span className="analysis-card-value">{result.summary?.overallRiskLevel || '—'}</span>
                <span className="analysis-card-label">Overall risk level</span>
              </div>
              <div className="analysis-card">
                <span className="analysis-card-value">{result.summary?.probabilityMeetOnTime ?? '—'}%</span>
                <span className="analysis-card-label">Probability of meeting compliance in time</span>
              </div>
              <div className="analysis-card">
                <span className="analysis-card-value">{result.summary?.atRiskOpcos ?? 0} / {result.summary?.totalOpcos ?? 0}</span>
                <span className="analysis-card-label">OpCos at risk</span>
              </div>
              {result.summary?.historicalRecordsUsed > 0 && (
                <div className="analysis-card">
                  <span className="analysis-card-value">{result.summary.historicalRecordsUsed}</span>
                  <span className="analysis-card-label">Historical records used</span>
                </div>
              )}
            </div>
          </section>

          <section className="analysis-block analysis-gauge">
            <h3 className="analysis-heading">Compliance risk gauge</h3>
            <div className="analysis-gauge-wrap">
              <div
                className="analysis-gauge-bar"
                style={{
                  width: `${result.summary?.overallRiskScore ?? 0}%`,
                  backgroundColor: (result.summary?.overallRiskScore ?? 0) >= 60 ? '#ef4444' : (result.summary?.overallRiskScore ?? 0) >= 30 ? '#eab308' : '#22c55e',
                }}
              />
              <span className="analysis-gauge-label">Risk score 0–100 (higher = higher risk)</span>
            </div>
          </section>

          {result.byOpCo?.length > 0 && (
            <section className="analysis-block analysis-heatmap-wrap">
              <h3 className="analysis-heading">Compliance &amp; risk heat map</h3>
              <p className="analysis-heatmap-desc">
                Green = compliant / low risk; red = non-compliant / high risk. Each cell shows the metric value.
              </p>
              <div className="analysis-heatmap-scroll">
                <table className="analysis-heatmap">
                  <thead>
                    <tr>
                      <th className="analysis-heatmap-row-label">OpCo</th>
                      <th title="Risk score 0–100 (higher = more risk of non-compliance)">Risk score</th>
                      <th title="Number of regulatory deadlines affecting this OpCo">Deadlines</th>
                      <th title="Historical on-time compliance rate % (if available)">Historical on-time %</th>
                      <th title="Predicted to meet compliance in time">Predicted on time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.byOpCo.map((row, i) => (
                      <tr key={i}>
                        <td className="analysis-heatmap-row-label" title={row.opco}>
                          {row.opco.length > 28 ? row.opco.slice(0, 26) + '…' : row.opco}
                        </td>
                        <td
                          className="analysis-heatmap-cell"
                          style={{ backgroundColor: riskToColor(row.riskScore) }}
                          title={`Risk: ${row.riskScore}`}
                        >
                          <span className="analysis-heatmap-value">{row.riskScore}</span>
                        </td>
                        <td
                          className="analysis-heatmap-cell"
                          style={{ backgroundColor: riskToColor(Math.min(100, (row.deadlineCount || 0) * 15)) }}
                          title={`${row.deadlineCount} deadlines`}
                        >
                          <span className="analysis-heatmap-value">{row.deadlineCount}</span>
                        </td>
                        <td
                          className="analysis-heatmap-cell"
                          style={{
                            backgroundColor: row.historicalOnTimeRate != null
                              ? complianceToColor(row.historicalOnTimeRate)
                              : 'var(--surface-hover)',
                          }}
                          title={row.historicalOnTimeRate != null ? `${row.historicalOnTimeRate}% on time` : 'No data'}
                        >
                          <span className="analysis-heatmap-value">
                            {row.historicalOnTimeRate != null ? `${row.historicalOnTimeRate}%` : '—'}
                          </span>
                        </td>
                        <td
                          className="analysis-heatmap-cell"
                          style={{
                            backgroundColor: row.predictedOnTime ? complianceToColor(100) : complianceToColor(0),
                          }}
                          title={row.predictedOnTime ? 'Predicted on time' : 'At risk'}
                        >
                          <span className="analysis-heatmap-value">{row.predictedOnTime ? 'Yes' : 'No'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="analysis-heatmap-legend">
                <span className="analysis-heatmap-legend-item">
                  <span className="analysis-heatmap-legend-swatch" style={{ backgroundColor: '#22c55e' }} />
                  Low risk / Compliant
                </span>
                <span className="analysis-heatmap-legend-item">
                  <span className="analysis-heatmap-legend-swatch" style={{ backgroundColor: '#eab308' }} />
                  Medium
                </span>
                <span className="analysis-heatmap-legend-item">
                  <span className="analysis-heatmap-legend-swatch" style={{ backgroundColor: '#ef4444' }} />
                  High risk / Non-compliant
                </span>
              </div>
            </section>
          )}

          {result.chartData && result.chartData.labels?.length > 0 && (
            <section className="analysis-block analysis-chart">
              <h3 className="analysis-heading">Risk by OpCo</h3>
              <div className="analysis-bar-chart">
                {result.chartData.labels.map((label, i) => (
                  <div key={i} className="analysis-bar-row">
                    <span className="analysis-bar-label" title={result.byOpCo[i]?.opco}>{label}</span>
                    <div className="analysis-bar-track">
                      <div
                        className="analysis-bar-fill"
                        style={{
                          width: `${(result.chartData.riskScores[i] / maxBar) * 100}%`,
                          backgroundColor: result.chartData.colors[i] || '#6b7280',
                        }}
                      />
                      <span className="analysis-bar-value">{result.chartData.riskScores[i]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {result.byOpCo?.length > 0 && (
            <section className="analysis-block analysis-table-wrap">
              <h3 className="analysis-heading">Risk by entity</h3>
              <table className="analysis-table">
                <thead>
                  <tr>
                    <th>OpCo</th>
                    <th>Risk level</th>
                    <th>Risk score</th>
                    <th>Predicted on time</th>
                    <th>Deadlines</th>
                    <th>Main factor</th>
                    {result.byOpCo.some((r) => r.historicalOnTimeRate != null) && <th>Historical on-time %</th>}
                  </tr>
                </thead>
                <tbody>
                  {result.byOpCo.map((row, i) => (
                    <tr key={i} className={`analysis-row-${row.riskLevel.toLowerCase()}`}>
                      <td>{row.opco}</td>
                      <td><span className={`analysis-badge analysis-badge-${row.riskLevel.toLowerCase()}`}>{row.riskLevel}</span></td>
                      <td>{row.riskScore}</td>
                      <td>{row.predictedOnTime ? 'Yes' : 'No'}</td>
                      <td>{row.deadlineCount}</td>
                      <td>{row.factor}</td>
                      {result.byOpCo.some((r) => r.historicalOnTimeRate != null) && (
                        <td>{row.historicalOnTimeRate != null ? `${row.historicalOnTimeRate}%` : '—'}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {result.upcomingDeadlines?.length > 0 && (
            <section className="analysis-block analysis-deadlines">
              <h3 className="analysis-heading">Upcoming deadlines (at risk)</h3>
              <ul className="analysis-deadlines-list">
                {result.upcomingDeadlines.slice(0, 15).map((d, i) => (
                  <li key={i} className="analysis-deadline-item">
                    <strong>{d.opco}</strong> — {d.title} ({d.framework}) · Deadline: {d.deadline}
                    <span className={`analysis-badge analysis-badge-${(d.riskLevel || '').toLowerCase()}`}>{d.riskLevel}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result.financialPenalties && (
            <section className="analysis-block analysis-tools-block">
              <h3 className="analysis-heading">Financial penalty (if compliance not met)</h3>
              <p className="analysis-tools-desc">
                Estimated financial penalties that may be levied on OpCos and the Parent holding if compliance deadlines are not met. Based on regulatory frameworks and gap status (overdue / at-risk).
              </p>
              <div className="analysis-penalty-parent">
                <span className="analysis-penalty-label">Parent holding total exposure</span>
                <span className="analysis-penalty-value">
                  {(result.financialPenalties.parentTotal ?? 0).toLocaleString()} {result.financialPenalties.currency || 'USD'}
                </span>
              </div>
              <div className="analysis-table-wrap">
                <table className="analysis-table">
                  <thead>
                    <tr>
                      <th>OpCo</th>
                      <th>Estimated penalty</th>
                      <th>Gaps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(result.financialPenalties.byOpCo || []).map((row, i) => (
                      <tr key={i}>
                        <td>{row.opco}</td>
                        <td>{row.estimatedPenalty?.toLocaleString()} {row.currency || 'USD'}</td>
                        <td>{row.gapCount ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {result.capitalInvestment && (
            <section className="analysis-block analysis-tools-block">
              <h3 className="analysis-heading">Capital investment (resources to complete compliance)</h3>
              <p className="analysis-tools-desc">
                Estimated investment required to complete compliance: FTE (personnel) needed to run the process and administrative costs. Total = FTE cost + Administrative costs.
              </p>
              <div className="analysis-penalty-parent">
                <span className="analysis-penalty-label">Parent holding total estimated investment</span>
                <span className="analysis-penalty-value">
                  {(result.capitalInvestment.parentTotal ?? 0).toLocaleString()} {result.capitalInvestment.currency || 'USD'}
                </span>
              </div>
              <div className="analysis-table-wrap">
                <table className="analysis-table">
                  <thead>
                    <tr>
                      <th>OpCo</th>
                      <th>Estimated cost</th>
                      <th>Gaps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(result.capitalInvestment.byOpCo || []).map((row, i) => (
                      <tr key={i}>
                        <td>{row.opco}</td>
                        <td>{row.estimatedCost?.toLocaleString()} {row.currency || 'USD'}</td>
                        <td>{row.gapCount ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(result.capitalInvestment.byOpCo?.[0]?.breakdown?.length > 0) && (
                <div className="analysis-capital-breakdown">
                  <h4 className="analysis-capital-breakdown-title">Cost breakdown (per OpCo): FTE + Administrative</h4>
                  <ul className="analysis-capital-breakdown-list">
                    {result.capitalInvestment.byOpCo[0].breakdown.map((b, i) => (
                      <li key={i}>
                        <strong>{b.item}:</strong>{' '}
                        {b.cost?.toLocaleString()} {result.capitalInvestment.currency || 'USD'}
                        {b.fteRequired != null && b.fteRequired > 0 && (
                          <span className="analysis-capital-fte"> ({b.fteRequired} FTE)</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="analysis-capital-breakdown-sum">
                    Total investment = FTE cost + Administrative costs (shown in table above).
                  </p>
                </div>
              )}
            </section>
          )}

          {result.complianceGaps && result.complianceGaps.length > 0 && (
            <section className="analysis-block analysis-tools-block">
              <h3 className="analysis-heading">Compliance modules not yet met &amp; missing details</h3>
              <p className="analysis-tools-desc">
                Which modules of compliance are not yet met and what is missing for each section.
              </p>
              <div className="analysis-gaps-table-wrap">
                <table className="analysis-table analysis-gaps-table">
                  <thead>
                    <tr>
                      <th>OpCo</th>
                      <th>Framework / module</th>
                      <th>Change</th>
                      <th>Deadline</th>
                      <th>Status</th>
                      <th>Missing details</th>
                      <th>What to do to meet compliance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.complianceGaps.map((g, i) => (
                      <tr key={i} className={`analysis-gap-status-${(g.status || '').toLowerCase().replace(/\s+/g, '-')}`}>
                        <td>{g.opco}</td>
                        <td>{g.module}</td>
                        <td>{g.changeTitle}</td>
                        <td>{g.deadline || '—'}</td>
                        <td><span className={`analysis-badge analysis-badge-${(g.status === 'Overdue' ? 'high' : g.status === 'At risk' ? 'medium' : 'low')}`}>{g.status}</span></td>
                        <td className="analysis-gap-missing">{g.missingDetails}</td>
                        <td className="analysis-gap-actions">{g.actionsToMeetCompliance ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {result.businessImpact && (
            <section className="analysis-block analysis-tools-block">
              <h3 className="analysis-heading">Business impact (if compliance not met)</h3>
              <p className="analysis-tools-desc">
                Details of the business impact if compliance is not met: regulatory, financial, reputational, and governance implications.
              </p>
              <p className="analysis-business-summary">{result.businessImpact.summary}</p>
              <div className="analysis-impacts">
                {(result.businessImpact.impacts || []).map((imp, i) => (
                  <div key={i} className={`analysis-impact-card analysis-impact-${(imp.severity || '').toLowerCase()}`}>
                    <div className="analysis-impact-header">
                      <span className="analysis-impact-type">{imp.type}</span>
                      <span className={`analysis-badge analysis-badge-${(imp.severity || '').toLowerCase()}`}>{imp.severity}</span>
                    </div>
                    <p className="analysis-impact-desc">{imp.description}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="analysis-block analysis-explanation">
            <h3 className="analysis-heading">Detailed explanation</h3>
            <div className="analysis-explanation-body">
              {(result.explanation || '').split(/\n/).map((para, i) => (
                <p key={i}>{para.replace(/\*\*(.+?)\*\*/g, '$1')}</p>
              ))}
            </div>
          </section>
        </>
      )}

      {!result && !loading && !error && parent && (
        <p className="analysis-hint">Click &quot;Run risk prediction&quot; to see the analysis.</p>
      )}
    </div>
  );
}
