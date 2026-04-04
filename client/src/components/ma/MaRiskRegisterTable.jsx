/**
 * Risk register table for M&A Simulator v2.
 */
export function MaRiskRegisterTable({ riskRegister }) {
  if (!Array.isArray(riskRegister) || riskRegister.length === 0) return null;
  return (
    <div className="analysis-ma-card analysis-ma-card--full">
      <h5 className="analysis-ma-card-title">Risk register</h5>
      <p className="analysis-ma-card-desc">Material integration and regulatory risks (illustrative; validate with your programme).</p>
      <div className="analysis-ma-timelines-wrap">
        <table className="analysis-ma-timelines-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Category</th>
              <th>Severity</th>
              <th>Risk</th>
              <th>Mitigation</th>
            </tr>
          </thead>
          <tbody>
            {riskRegister.map((r) => (
              <tr key={r.id || r.description}>
                <td>{r.id}</td>
                <td>{r.category}</td>
                <td>
                  <span className={`analysis-ma-severity analysis-ma-severity--${String(r.severity || '').toLowerCase()}`}>
                    {r.severity}
                  </span>
                </td>
                <td>{r.description}</td>
                <td>{r.mitigation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
