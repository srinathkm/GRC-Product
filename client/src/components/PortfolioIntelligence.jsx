import { useCallback, useEffect, useMemo, useState } from 'react';
import { t } from '../i18n';
import './PortfolioIntelligence.css';

const API = '/api/portfolio-intelligence';

function tierClass(tier) {
  const x = (tier || '').toLowerCase();
  if (x === 'high') return 'pi-tier pi-tier-high';
  if (x === 'medium') return 'pi-tier pi-tier-medium';
  return 'pi-tier pi-tier-low';
}

/**
 * Lightweight SVG sketch of one ownership context (deterministic layout, not generative).
 */
function OwnershipSketch({ graphContext }) {
  const nodes = graphContext?.nodes || [];
  const edges = graphContext?.edges || [];
  if (nodes.length === 0) return null;

  const w = 420;
  const h = 200;
  const positions = {};
  const n = nodes.length;
  nodes.forEach((node, i) => {
    const angle = (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2;
    const cx = w / 2 + Math.cos(angle) * 120;
    const cy = h / 2 + Math.sin(angle) * 55;
    positions[node.id] = { x: cx, y: cy };
  });

  return (
    <svg className="pi-svg" viewBox={`0 0 ${w} ${h}`} aria-hidden>
      {edges.map((e) => {
        const a = positions[e.source];
        const b = positions[e.target];
        if (!a || !b) return null;
        return (
          <line
            key={`${e.source}-${e.target}-${e.id || ''}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="#94a3b8"
            strokeWidth="1.5"
          />
        );
      })}
      {nodes.map((node) => {
        const p = positions[node.id];
        if (!p) return null;
        const isPerson = node.type === 'person';
        return (
          <g key={node.id}>
            {isPerson ? (
              <circle cx={p.x} cy={p.y} r="10" fill="#0ea5e9" fillOpacity="0.25" stroke="#0284c7" strokeWidth="1.5" />
            ) : (
              <rect
                x={p.x - 12}
                y={p.y - 8}
                width="24"
                height="16"
                rx="3"
                fill="#64748b"
                fillOpacity="0.2"
                stroke="#64748b"
                strokeWidth="1.2"
              />
            )}
            <text
              x={p.x}
              y={p.y + 22}
              textAnchor="middle"
              fill="#334155"
              fontSize="9"
              fontFamily="system-ui, sans-serif"
            >
              {(node.label || node.id).slice(0, 28)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function PortfolioIntelligence({ language = 'en' }) {
  const [query, setQuery] = useState('');
  const [chLoading, setChLoading] = useState(false);
  const [chError, setChError] = useState('');
  const [chData, setChData] = useState(null);

  const [litigations, setLitigations] = useState([]);
  const [litId, setLitId] = useState('');
  const [imLoading, setImLoading] = useState(false);
  const [imError, setImError] = useState('');
  const [impact, setImpact] = useState(null);

  const loadCrossHoldings = useCallback(async () => {
    const q = query.trim();
    if (q.length < 2) {
      setChError(t(language, 'portfolioIntelQueryShort'));
      return;
    }
    setChLoading(true);
    setChError('');
    try {
      const r = await fetch(`${API}/cross-holdings?${new URLSearchParams({ q })}`);
      const json = await r.json();
      if (!r.ok) throw new Error(json?.error || 'Request failed');
      setChData(json);
    } catch (e) {
      setChError(e.message || 'Unknown error');
      setChData(null);
    } finally {
      setChLoading(false);
    }
  }, [query, language]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/litigations')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setLitigations(list);
        if (list.length && !litId) setLitId(list[0].id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!litId) {
      setImpact(null);
      return;
    }
    let cancelled = false;
    setImLoading(true);
    setImError('');
    fetch(`${API}/litigations/${encodeURIComponent(litId)}/impact`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json.error) {
          setImError(json.error);
          setImpact(null);
          return;
        }
        setImpact(json);
      })
      .catch((e) => {
        if (!cancelled) setImError(e.message || 'Unknown error');
      })
      .finally(() => {
        if (!cancelled) setImLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [litId]);

  const firstContext = useMemo(() => {
    const ctx = chData?.graphContexts;
    return Array.isArray(ctx) && ctx.length ? ctx[0] : null;
  }, [chData]);

  return (
    <div className="pi-wrap">
      <div className="pi-hero">
        <h1 className="pi-title">{t(language, 'portfolioIntelTitle')}</h1>
        <p className="pi-intro">{t(language, 'portfolioIntelIntro')}</p>
      </div>

      <div className="pi-grid">
        <section className="pi-panel">
          <h2>{t(language, 'portfolioIntelCrossHeading')}</h2>
          <p className="pi-panel-note">{t(language, 'portfolioIntelCrossNote')}</p>
          <div className="pi-search-row">
            <input
              className="pi-input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t(language, 'portfolioIntelSearchPlaceholder')}
              aria-label={t(language, 'portfolioIntelSearchPlaceholder')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') loadCrossHoldings();
              }}
            />
            <button type="button" className="pi-btn" onClick={loadCrossHoldings} disabled={chLoading}>
              {chLoading ? '…' : t(language, 'portfolioIntelSearchAction')}
            </button>
          </div>
          {chError ? <p className="pi-error">{chError}</p> : null}
          {chData && (
            <>
              <div className="pi-table-wrap">
                <table className="pi-table">
                  <thead>
                    <tr>
                      <th>{t(language, 'portfolioIntelColContext')}</th>
                      <th>{t(language, 'portfolioIntelColSubject')}</th>
                      <th>{t(language, 'portfolioIntelColCounterparty')}</th>
                      <th>{t(language, 'portfolioIntelColRelation')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(chData.holdings || []).length === 0 ? (
                      <tr>
                        <td colSpan={4}>{t(language, 'portfolioIntelNoEdges')}</td>
                      </tr>
                    ) : (
                      chData.holdings.map((row, idx) => (
                        <tr key={`${row.contextId}-${row.edgeId}-${idx}`}>
                          <td>{row.contextLabel || row.contextId}</td>
                          <td>{row.subjectLabel}</td>
                          <td>{row.counterpartyLabel}</td>
                          <td>
                            {row.edgeKind}
                            {row.percent != null ? ` · ${row.percent}%` : ''}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <p className="pi-meta">
                {t(language, 'portfolioIntelMetaGraphs')}: {chData.explain?.matchedGraphs ?? 0} ·{' '}
                {t(language, 'portfolioIntelMetaEdges')}: {chData.explain?.edgeCount ?? (chData.holdings || []).length}
              </p>
              {firstContext ? (
                <div className="pi-graph-preview">
                  <h3>{t(language, 'portfolioIntelGraphPreview')}</h3>
                  <OwnershipSketch graphContext={firstContext} />
                </div>
              ) : null}
            </>
          )}
        </section>

        <section className="pi-panel">
          <h2>{t(language, 'portfolioIntelLitHeading')}</h2>
          <p className="pi-panel-note">{t(language, 'portfolioIntelLitNote')}</p>
          <select
            className="pi-select"
            value={litId}
            onChange={(e) => setLitId(e.target.value)}
            aria-label={t(language, 'portfolioIntelSelectLitigation')}
          >
            {litigations.length === 0 ? (
              <option value="">{t(language, 'portfolioIntelNoLitigations')}</option>
            ) : (
              litigations.map((l) => (
                <option key={l.id} value={l.id}>
                  {(l.caseId || l.id).slice(0, 48)}
                  {l.opco ? ` — ${l.opco.slice(0, 32)}` : ''}
                </option>
              ))
            )}
          </select>
          {imLoading ? <p className="pi-meta">{t(language, 'portfolioIntelLoadingImpact')}</p> : null}
          {imError ? <p className="pi-error">{imError}</p> : null}
          {impact && !imError ? (
            <>
              <dl className="pi-dl">
                <dt>{t(language, 'portfolioIntelCase')}</dt>
                <dd>{impact.litigation?.caseId}</dd>
                <dt>{t(language, 'portfolioIntelOpCo')}</dt>
                <dd>{impact.litigation?.opco}</dd>
                <dt>{t(language, 'portfolioIntelImpactTier')}</dt>
                <dd>
                  <span className={tierClass(impact.impactTier)}>{impact.impactTier}</span>
                </dd>
              </dl>
              <h3 className="pi-subheading">{t(language, 'portfolioIntelLinkedIp')}</h3>
              <ul className="pi-list">
                {(impact.linkedIp || []).length === 0 ? (
                  <li>{t(language, 'portfolioIntelNone')}</li>
                ) : (
                  impact.linkedIp.map((ip) => (
                    <li key={ip.id}>
                      {ip.ipType}: {ip.mark || ip.registrationNo || ip.id}
                    </li>
                  ))
                )}
              </ul>
              <h3 className="pi-subheading">{t(language, 'portfolioIntelLinkedContracts')}</h3>
              <ul className="pi-list">
                {(impact.linkedContracts || []).length === 0 ? (
                  <li>{t(language, 'portfolioIntelNone')}</li>
                ) : (
                  impact.linkedContracts.map((c) => (
                    <li key={c.id}>
                      {c.title || c.contractId}
                      {c.riskLevel ? ` (${c.riskLevel})` : ''}
                    </li>
                  ))
                )}
              </ul>
              <div className="pi-graph-preview">
                <h3>{t(language, 'portfolioIntelExplain')}</h3>
                <ul className="pi-list">
                  {(impact.explainability?.reasons || []).map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
                <p className="pi-meta">
                  {t(language, 'portfolioIntelRulesVersion')}: {impact.explainability?.rulesVersion}
                </p>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
