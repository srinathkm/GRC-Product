import { useState, useEffect } from 'react';

const API = '/api';

export function SecurityPostureDashboard({ selectedParentHolding, onSelectOpco, uploadRefresh = 0 }) {
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedOpco, setSelectedOpco] = useState(null);
  const [scoreDetail, setScoreDetail] = useState(null);

  useEffect(() => {
    if (!selectedParentHolding) {
      setSummary([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`${API}/defender/group-summary/${encodeURIComponent(selectedParentHolding)}`)
      .then((r) => r.json())
      .then((data) => {
        setSummary(data.opcos || []);
      })
      .catch(() => setSummary([]))
      .finally(() => setLoading(false));
  }, [selectedParentHolding, uploadRefresh]);

  useEffect(() => {
    if (!selectedOpco) {
      setScoreDetail(null);
      return;
    }
    fetch(`${API}/defender/score/${encodeURIComponent(selectedOpco)}`)
      .then((r) => r.json())
      .then((data) => setScoreDetail(data))
      .catch(() => setScoreDetail(null));
  }, [selectedOpco, uploadRefresh]);

  const handleSelectOpco = (name) => {
    setSelectedOpco(name);
    if (typeof onSelectOpco === 'function') onSelectOpco(name);
  };

  if (!selectedParentHolding) {
    return (
      <div className="defender-dashboard">
        <p className="defender-dashboard-empty">Select a Parent Holding to see Security Posture scores.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="defender-dashboard">
        <p className="defender-dashboard-loading">Loading group summary…</p>
      </div>
    );
  }

  return (
    <div className="defender-dashboard">
      <h3 className="defender-dashboard-title">Security Posture Score (Defender)</h3>
      <p className="defender-dashboard-intro">
        Scores derived from uploaded Azure Defender evidence (Secure Score, Regulatory Compliance, findings). Click an OpCo for details.
      </p>
      <p className="defender-dashboard-parent">Parent: <strong>{selectedParentHolding}</strong></p>

      <div className="defender-dashboard-grid">
        {summary.length === 0 ? (
          <p className="defender-dashboard-empty">No OpCos with Defender data for this parent. Upload evidence to see scores.</p>
        ) : (
          summary.map((item) => (
            <button
              type="button"
              key={item.opcoName}
              className={`defender-dashboard-card ${selectedOpco === item.opcoName ? 'defender-dashboard-card-selected' : ''}`}
              onClick={() => handleSelectOpco(item.opcoName)}
            >
              <span className="defender-dashboard-card-name">{item.opcoName}</span>
              {item.score != null ? (
                <>
                  <span
                    className="defender-dashboard-card-score"
                    style={item.bandColor ? { color: item.bandColor } : {}}
                  >
                    {item.score}
                  </span>
                  <span className="defender-dashboard-card-band">{item.band || '—'}</span>
                </>
              ) : (
                <span className="defender-dashboard-card-no-score">No score</span>
              )}
            </button>
          ))
        )}
      </div>

      {selectedOpco && scoreDetail && (
        <div className="defender-dashboard-detail">
          <h4 className="defender-dashboard-detail-title">{selectedOpco}</h4>
          {scoreDetail.current ? (
            <>
              <div className="defender-dashboard-detail-score">
                <span
                  className="defender-dashboard-detail-value"
                  style={scoreDetail.current.bandColor ? { color: scoreDetail.current.bandColor } : {}}
                >
                  {scoreDetail.current.score}
                </span>
                <span className="defender-dashboard-detail-band">{scoreDetail.current.band}</span>
              </div>
              {scoreDetail.current.evidence && (
                <dl className="defender-dashboard-evidence">
                  <dt>Framework coverage</dt>
                  <dd>{scoreDetail.current.evidence.frameworkCoverage ?? '—'}%</dd>
                  <dt>Secure score</dt>
                  <dd>{scoreDetail.current.evidence.secureScore ?? '—'}%</dd>
                  <dt>Open Critical</dt>
                  <dd>{scoreDetail.current.evidence.openCritical ?? 0}</dd>
                  <dt>Open High</dt>
                  <dd>{scoreDetail.current.evidence.openHigh ?? 0}</dd>
                  <dt>Penalty</dt>
                  <dd>{scoreDetail.current.evidence.penalty ?? 0}</dd>
                </dl>
              )}
              {scoreDetail.history?.length > 1 && (
                <p className="defender-dashboard-history">History: {scoreDetail.history.length} snapshots</p>
              )}
            </>
          ) : (
            <p className="defender-dashboard-no-data">No score data yet. Upload Defender evidence for this OpCo.</p>
          )}
        </div>
      )}
    </div>
  );
}
