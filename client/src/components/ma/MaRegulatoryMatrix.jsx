/**
 * Regulatory matrix: framework, authority, action type, typical days.
 */
export function MaRegulatoryMatrix({ regulatoryMatrix }) {
  if (!Array.isArray(regulatoryMatrix) || regulatoryMatrix.length === 0) return null;
  return (
    <div className="analysis-ma-card analysis-ma-card--full">
      <h5 className="analysis-ma-card-title">Regulatory matrix</h5>
      <p className="analysis-ma-card-desc">Indicative authority mapping and typical post-signing horizons.</p>
      <div className="analysis-ma-timelines-wrap">
        <table className="analysis-ma-timelines-table">
          <thead>
            <tr>
              <th>Framework</th>
              <th>Zone</th>
              <th>Authority</th>
              <th>Action type</th>
              <th>Typical days</th>
            </tr>
          </thead>
          <tbody>
            {regulatoryMatrix.map((row) => (
              <tr key={row.framework}>
                <td>{row.framework}</td>
                <td>{row.zone}</td>
                <td>{row.authority}</td>
                <td>{row.actionType}</td>
                <td><strong>{row.typicalDaysPostSigning}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
