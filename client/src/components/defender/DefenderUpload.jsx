import { useState, useRef } from 'react';

const API = '/api';
const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 60;

export function DefenderUpload({ selectedParentHolding, opcos = [], onUploadComplete }) {
  const [opcoName, setOpcoName] = useState('');
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadId, setUploadId] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const pollCountRef = useRef(0);

  const reset = () => {
    setUploadId(null);
    setStatus(null);
    setError(null);
    setFile(null);
    pollCountRef.current = 0;
  };

  const pollStatus = (id) => {
    if (pollCountRef.current >= MAX_POLL_ATTEMPTS) {
      setStatus({ status: 'unknown', message: 'Status check timed out.' });
      return;
    }
    fetch(API + '/defender/upload/' + id + '/status')
      .then((r) => r.json())
      .then((data) => {
        setStatus(data);
        if (data.status === 'completed') {
          if (typeof onUploadComplete === 'function') onUploadComplete();
          return;
        }
        if (data.status === 'failed') {
          setError(data.error || 'Upload failed.');
          return;
        }
        pollCountRef.current += 1;
        setTimeout(() => pollStatus(id), POLL_INTERVAL_MS);
      })
      .catch((err) => setError(err.message || 'Failed to get status'));
  };

  const submit = () => {
    if (!file || !opcoName) {
      setError('Please select an OpCo and a file.');
      return;
    }
    setError(null);
    setStatus({ status: 'processing' });
    const form = new FormData();
    form.append('file', file);
    form.append('opcoName', opcoName);
    if (selectedParentHolding) form.append('parentName', selectedParentHolding);
    if (reportDate) form.append('reportDate', reportDate);

    fetch(API + '/defender/upload', { method: 'POST', body: form })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          setStatus(null);
          return;
        }
        setUploadId(data.uploadId);
        pollCountRef.current = 0;
        pollStatus(data.uploadId);
      })
      .catch((err) => {
        setError(err.message || 'Upload failed');
        setStatus(null);
      });
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer?.files?.[0];
    if (f && (f.name.endsWith('.csv') || f.name.endsWith('.xlsx') || f.name.endsWith('.xls') || f.name.endsWith('.pdf'))) {
      setFile(f);
      setError(null);
    } else {
      setError('Please upload a CSV, Excel (.xlsx, .xls), or PDF file.');
    }
  };

  return (
    <div className="defender-upload">
      <h3 className="defender-upload-title">Upload Defender evidence</h3>
      <p className="defender-upload-intro">
        Upload Azure Defender Secure Score, Regulatory Compliance, or findings (CSV, Excel, or PDF). Select OpCo and optional report date.
      </p>
      {selectedParentHolding && (
        <p className="defender-upload-parent">Parent: <strong>{selectedParentHolding}</strong></p>
      )}
      <div className="defender-upload-form">
        <div className="defender-upload-field">
          <label htmlFor="defender-upload-opco">OpCo</label>
          <select id="defender-upload-opco" value={opcoName} onChange={(e) => setOpcoName(e.target.value)}>
            <option value="">Select OpCo</option>
            {opcos.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        <div className="defender-upload-field">
          <label htmlFor="defender-upload-date">Report date</label>
          <input id="defender-upload-date" type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
        </div>
      </div>
      <div
        className={'defender-upload-dropzone ' + (dragOver ? 'defender-upload-dropzone-active' : '')}
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.pdf"
          className="defender-upload-input-hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }}
        />
        {file ? <span className="defender-upload-filename">{file.name}</span> : <span className="defender-upload-placeholder">Drop CSV, Excel, or PDF here, or click to browse</span>}
      </div>
      {error && <p className="defender-upload-error">{error}</p>}
      {status && (
        <div className="defender-upload-status">
          <span className={'defender-upload-status-badge defender-upload-status-' + status.status}>{status.status}</span>
          {status.secureScorePct != null && <span>Secure Score: {status.secureScorePct}%</span>}
          {status.compliancePct != null && <span>Compliance: {status.compliancePct}%</span>}
          {status.findingsCount != null && status.findingsCount > 0 && <span>Findings: {status.findingsCount}</span>}
          {status.status === 'completed' && <button type="button" className="defender-upload-reset" onClick={reset}>Upload another</button>}
        </div>
      )}
      <div className="defender-upload-actions">
        <button type="button" className="defender-upload-submit" onClick={submit} disabled={!file || !opcoName || (status && status.status === 'processing')}>
          {status?.status === 'processing' ? 'Processing…' : 'Upload'}
        </button>
        {uploadId && status?.status !== 'processing' && status?.status !== 'completed' && (
          <button type="button" className="defender-upload-reset" onClick={reset}>Cancel</button>
        )}
      </div>
    </div>
  );
}
