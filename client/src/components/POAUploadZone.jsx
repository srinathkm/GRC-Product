import { useCallback, useState } from 'react';

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.tiff,.tif,application/pdf,image/jpeg,image/png,image/tiff';
const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export function POAUploadZone({ onExtractionComplete }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validateFiles = (files) => {
    const list = Array.from(files || []);
    for (const f of list) {
      if (f.size > MAX_SIZE_BYTES) {
        return `"${f.name}" exceeds 25 MB.`;
      }
      const ext = (f.name || '').split('.').pop()?.toLowerCase();
      const ok = ['pdf', 'jpg', 'jpeg', 'png', 'tiff', 'tif'].includes(ext);
      if (!ok) return `"${f.name}" is not allowed. Use PDF, JPG, PNG or TIFF.`;
    }
    return null;
  };

  const runExtract = useCallback(async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const err = validateFiles(fileList);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const isSingle = fileList.length === 1;
      const endpoint = isSingle ? '/api/poa/extract' : '/api/poa/extract-batch';
      const body = new FormData();
      if (isSingle) {
        body.append('file', fileList[0]);
      } else {
        fileList.forEach((f) => body.append('files', f));
      }
      const res = await fetch(endpoint, { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || res.statusText || 'Extraction failed');
        return;
      }
      if (isSingle) {
        onExtractionComplete?.({ single: data, results: [{ filename: data.filename, extracted: data.extracted, fromDocument: data.fromDocument }] });
      } else {
        onExtractionComplete?.({ single: null, results: data.results || [] });
      }
    } catch (e) {
      setError(e.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  }, [onExtractionComplete]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const files = e.dataTransfer?.files;
    if (files?.length) runExtract(files);
  }, [runExtract]);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const onInputChange = useCallback((e) => {
    const files = e.target?.files;
    if (files?.length) runExtract(files);
    e.target.value = '';
  }, [runExtract]);

  return (
    <div className="poa-upload-zone">
      <div
        className={`poa-upload-drop ${dragging ? 'poa-upload-dragging' : ''} ${loading ? 'poa-upload-loading' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <input
          type="file"
          accept={ACCEPT}
          multiple
          className="poa-upload-input"
          onChange={onInputChange}
          disabled={loading}
        />
        {loading ? (
          <div className="poa-upload-loading-state">
            <span className="poa-upload-spinner" aria-hidden />
            <span>Reading document...</span>
          </div>
        ) : (
          <>
            <span className="poa-upload-icon" aria-hidden>📄</span>
            <p className="poa-upload-text">Drag and drop a POA document here, or click to browse</p>
            <p className="poa-upload-hint">PDF, JPG, PNG, TIFF — max 25 MB. Multiple files supported for batch.</p>
          </>
        )}
      </div>
      {error && <p className="poa-upload-error">{error}</p>}
    </div>
  );
}
