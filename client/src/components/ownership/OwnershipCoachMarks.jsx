import './OwnershipGraph.css';

const STORAGE_KEY = 'og-coach-v1-dismissed';

export function shouldShowOwnershipCoach() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== '1';
  } catch {
    return true;
  }
}

export function dismissOwnershipCoach() {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

/**
 * First-visit tips for the ownership graph (Phase 2 coach marks).
 */
export function OwnershipCoachMarks({ visible, onDismiss }) {
  if (!visible) return null;

  return (
    <div className="og-coach-overlay" role="dialog" aria-modal="true" aria-labelledby="og-coach-title">
      <div className="og-coach-card">
        <h2 id="og-coach-title" className="og-coach-title">
          How to use this chart
        </h2>
        <ol className="og-coach-list">
          <li>Click a <strong>node</strong> to see upstream and downstream stakes and evidence in the right-hand pane.</li>
          <li>Click an <strong>edge</strong> (the line between entities) to focus on that relationship only.</li>
          <li>Use <strong>Search</strong>, <strong>Focus subject</strong>, and the path dropdown to trace ownership without losing your place.</li>
        </ol>
        <div className="og-coach-actions">
          <button type="button" className="og-btn og-btn-primary" onClick={onDismiss}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
