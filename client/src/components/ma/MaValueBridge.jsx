/**
 * Value bridge: synergy vs modelled integration run-rate (illustrative).
 */
export function MaValueBridge({ valueBridge }) {
  if (!valueBridge || typeof valueBridge !== 'object') return null;
  const { synergyAnnualAed, integrationOneTimeAed, integrationAnnualRunRateAed, netAnnualAfterSynergyBand, assumptions } = valueBridge;
  return (
    <div className="analysis-ma-card">
      <h5 className="analysis-ma-card-title">Value bridge (illustrative)</h5>
      <p className="analysis-ma-card-desc">Compare user-provided annual synergies to modelled integration costs.</p>
      <ul className="analysis-ma-card-list">
        <li>Annual synergy (input): {(synergyAnnualAed ?? 0).toLocaleString()} AED</li>
        <li>Modelled one-time integration: {(integrationOneTimeAed ?? 0).toLocaleString()} AED</li>
        <li>Modelled annual run-rate: {(integrationAnnualRunRateAed ?? 0).toLocaleString()} AED</li>
      </ul>
      {netAnnualAfterSynergyBand && <p className="analysis-ma-summary">{netAnnualAfterSynergyBand}</p>}
      {Array.isArray(assumptions) && assumptions.length > 0 && (
        <ul className="analysis-ma-card-list analysis-ma-card-list--muted">
          {assumptions.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
