import { useState, useEffect } from 'react';
import { ChangeDetail } from './ChangeDetail';

export function ChangeSnippet({ change, frameworkReferences = {}, expanded: controlledExpanded, onExpandChange, detailContext }) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isControlled = controlledExpanded !== undefined;
  const expanded = isControlled ? controlledExpanded : internalExpanded;
  const setExpanded = isControlled
    ? (v) => (onExpandChange || (() => {}))(typeof v === 'function' ? v(expanded) : v)
    : setInternalExpanded;

  useEffect(() => {
    if (isControlled && controlledExpanded) setInternalExpanded(true);
  }, [isControlled, controlledExpanded]);

  const ref = frameworkReferences[change.framework];

  return (
    <article
      className={`snippet-card ${expanded ? 'expanded' : ''}`}
      onClick={() => setExpanded((e) => !e)}
    >
      <div className="snippet-meta">
        <span className="snippet-framework">
          {ref ? (
            <a href={ref.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
              {change.framework}
            </a>
          ) : (
            change.framework
          )}
        </span>
        <span>{change.date}</span>
        <span>{change.category}</span>
      </div>
      <h3 className="snippet-title">{change.title}</h3>
      <p className="snippet-text">{change.snippet}</p>
      {expanded && (
        <ChangeDetail
          change={change}
          frameworkReferences={frameworkReferences}
          onClose={() => setExpanded(false)}
          detailContext={detailContext}
        />
      )}
    </article>
  );
}
