/**
 * Executive summary block for M&A Simulator v2 (headline + bullets).
 */
export function MaExecutiveSummary({ executiveSummary }) {
  if (!executiveSummary || typeof executiveSummary !== 'object') return null;
  const { headline, bullets, confidence } = executiveSummary;
  return (
    <div className="analysis-ma-card analysis-ma-card--full">
      <h5 className="analysis-ma-card-title">Executive summary</h5>
      {headline && <p className="analysis-ma-executive-headline">{headline}</p>}
      {Array.isArray(bullets) && bullets.length > 0 && (
        <ul className="analysis-ma-card-list">
          {bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
      {confidence && (
        <p className="analysis-ma-card-note">
          <span className="analysis-ma-confidence">Confidence: {confidence}</span>
        </p>
      )}
    </div>
  );
}
