export function ChangeDetail({ change, frameworkReferences = {}, onClose, detailContext }) {
  const ref = frameworkReferences[change.framework];
  const hasOpcos = detailContext && Array.isArray(detailContext.companies) && detailContext.companies.length > 0;
  return (
    <div className="detail-body">
      {change.fullText}
      {hasOpcos && (
        <div className="detail-opcos">
          <h4 className="detail-opcos-title">Affected OpCos under {detailContext.parent}</h4>
          <ul className="detail-opcos-list">
            {detailContext.companies.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="detail-meta">
        {ref && (
          <>
            <a href={ref.url} target="_blank" rel="noopener noreferrer">
              Official rulebook: {change.framework}
            </a>
            {change.sourceUrl && ' · '}
          </>
        )}
        {change.sourceUrl && (
          <a href={change.sourceUrl} target="_blank" rel="noopener noreferrer">
            View source
          </a>
        )}
      </div>
    </div>
  );
}
