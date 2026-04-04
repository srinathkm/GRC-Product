import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import dagre from 'dagre';
import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './OwnershipGraph.css';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 72;

const TYPE_LABELS = {
  person: 'Person',
  corporate: 'Company',
  trust: 'Trust',
  fund: 'Fund',
  unknown: 'Entity',
};

function ownersMapFromEdges(edges) {
  const ownersOf = new Map();
  for (const e of edges) {
    if (!ownersOf.has(e.target)) ownersOf.set(e.target, []);
    ownersOf.get(e.target).push({ source: e.source, edge: e });
  }
  return ownersOf;
}

/** Returns ordered node ids from subject up to upstreamId along ownership (who owns whom). */
export function findUpstreamPath(subjectId, upstreamId, edges) {
  if (!subjectId || !upstreamId) return null;
  const ownersOf = ownersMapFromEdges(edges);
  const queue = [subjectId];
  const prev = new Map([[subjectId, null]]);
  const visited = new Set([subjectId]);
  while (queue.length) {
    const cur = queue.shift();
    if (cur === upstreamId) {
      const out = [];
      let x = upstreamId;
      while (x != null) {
        out.push(x);
        x = prev.get(x);
      }
      return out.reverse();
    }
    for (const { source: o } of ownersOf.get(cur) || []) {
      if (!visited.has(o)) {
        visited.add(o);
        prev.set(o, cur);
        queue.push(o);
      }
    }
  }
  return null;
}

/** Path is [subject, …, upstream]; edges are owner → owned (source owns target). */
function edgeOnPath(e, path) {
  if (!path || path.length < 2) return false;
  for (let i = 0; i < path.length - 1; i += 1) {
    const downstream = path[i];
    const upstream = path[i + 1];
    if (e.source === upstream && e.target === downstream) return true;
  }
  return false;
}

function layoutWithDagre(nodes, edges, direction) {
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  const rankdir = direction === 'down' ? 'TB' : 'BT';
  g.setGraph({ rankdir, ranksep: 72, nodesep: 32, marginx: 24, marginy: 24 });
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  edges.forEach((e) => {
    if (nodes.some((n) => n.id === e.source) && nodes.some((n) => n.id === e.target)) {
      g.setEdge(e.source, e.target);
    }
  });
  dagre.layout(g);
  return nodes.map((n) => {
    const pos = g.node(n.id);
    if (!pos) {
      return { ...n, position: { x: 0, y: 0 } };
    }
    return {
      ...n,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
    };
  });
}

function OwnershipNode({ data, selected }) {
  const t = data.type || 'unknown';
  const cls = [
    'og-node',
    `og-node-${t}`,
    data.isFocal ? 'og-node-focal' : '',
    data.warning ? 'og-node-warn' : '',
    selected ? 'og-node-selected' : '',
    data.pathHighlight ? 'og-node-path' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <Handle type="target" position={Position.Top} aria-label="" />
      <div className={cls} role="group" aria-label={`${data.label}, ${TYPE_LABELS[t] || 'entity'}`}>
        <div>{data.label}</div>
        {data.jurisdiction ? <span className="og-jur">{data.jurisdiction}</span> : null}
        <span className="og-node-type">{TYPE_LABELS[t] || 'Entity'}</span>
      </div>
      <Handle type="source" position={Position.Bottom} aria-label="" />
    </>
  );
}

const nodeTypes = { ownershipNode: OwnershipNode };

function InnerToolbar({
  fileName,
  extractedAt,
  subjectId,
  direction,
  onDirectionToggle,
  search,
  onSearchChange,
  pathTarget,
  onPathTargetChange,
  pathNodeChoices,
  hasCycle,
  reducedMotion,
}) {
  const { fitView } = useReactFlow();
  const focusSubject = useCallback(() => {
    if (!subjectId) return;
    fitView({
      nodes: [{ id: subjectId }],
      padding: 0.25,
      duration: reducedMotion ? 0 : 280,
    });
  }, [fitView, subjectId, reducedMotion]);

  return (
    <Panel position="top-left" className="og-topbar">
      <div className="og-topbar-inner">
        <span className="og-doc-name" title={fileName || ''}>
          {fileName ? `Document: ${fileName}` : 'Ownership chart'}
        </span>
        {extractedAt ? (
          <span className="og-meta">Extracted: {extractedAt}</span>
        ) : null}
        <div className="og-topbar-actions">
          <div className="og-search">
            <label htmlFor="og-search-input" className="sr-only">
              Find entity by name
            </label>
            <input
              id="og-search-input"
              type="search"
              placeholder="Search entities…"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              autoComplete="off"
            />
          </div>
          <select
            className="og-path-select"
            aria-label="Highlight path to entity"
            value={pathTarget}
            onChange={(e) => onPathTargetChange(e.target.value)}
          >
            <option value="">Path: choose upstream entity…</option>
            {pathNodeChoices.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <button type="button" className="og-btn og-btn-primary" onClick={focusSubject}>
            Focus subject
          </button>
          <button type="button" className="og-btn" onClick={onDirectionToggle} title="Toggle layout direction">
            {direction === 'down' ? 'Layout: down' : 'Layout: up'}
          </button>
        </div>
        <div className="og-legend" aria-hidden="true">
          <span>
            <span className="og-legend-line" /> Equity %
          </span>
          <span>
            <span className="og-legend-line og-legend-dash" /> Voting only
          </span>
          {hasCycle ? <span>Cycle / cross-hold flagged</span> : null}
        </div>
      </div>
    </Panel>
  );
}

function matchOpcoNameForLabel(label, opcoNames) {
  if (!label || !opcoNames?.length) return null;
  const n = String(label).trim().toLowerCase().replace(/\s+/g, ' ');
  for (const o of opcoNames) {
    const o2 = String(o).trim().toLowerCase().replace(/\s+/g, ' ');
    if (o2 === n) return o;
  }
  for (const o of opcoNames) {
    const o2 = String(o).trim().toLowerCase();
    if (n.includes(o2) || o2.includes(n)) return o;
  }
  return null;
}

function DetailPane({ graph, selectedId, selectedEdgeId, pathToShow, registerOpcoNames, onOpenInRegister }) {
  const edge = selectedEdgeId ? (graph?.edges || []).find((e) => e.id === selectedEdgeId) : null;
  const node = !edge && selectedId ? graph?.nodes?.find((n) => n.id === selectedId) : null;
  const matchedOpco = node ? matchOpcoNameForLabel(node.label, registerOpcoNames) : null;

  const liveText = node
    ? `${node.label}, ${TYPE_LABELS[node.type] || 'entity'}.`
    : edge
      ? 'Relationship selected.'
      : 'Nothing selected.';

  const incoming = node ? (graph?.edges || []).filter((e) => e.target === selectedId) : [];
  const outgoing = node ? (graph?.edges || []).filter((e) => e.source === selectedId) : [];

  const srcNode = edge ? graph?.nodes?.find((n) => n.id === edge.source) : null;
  const tgtNode = edge ? graph?.nodes?.find((n) => n.id === edge.target) : null;

  return (
    <aside className="og-pane" aria-label={edge ? 'Relationship details' : 'Entity details'}>
      <div className="og-pane-inner" aria-live="polite" aria-atomic="true">
        {edge ? (
          <>
            <h3 id="og-pane-title">
              Relationship
              <span className="og-pane-badge">{edge.kind === 'votes' ? 'Voting' : 'Ownership'}</span>
            </h3>
            <p className="og-pane-summary">
              From <strong>{srcNode?.label || edge.source}</strong> to <strong>{tgtNode?.label || edge.target}</strong>
              {edge.percent != null ? ` · ${edge.percent}%` : ''}
              {edge.confidence === 'low' ? ' · low confidence' : ''}
            </p>
            <section className="og-pane-section">
              <h4>Evidence</h4>
              {edge.citations?.length ? (
                edge.citations.map((c, i) => (
                  <div key={`${edge.id}-cite-${i}`} className="og-pane-cite">
                    {c.page ? `p. ${c.page}` : ''}
                    {c.page && c.quote ? ' — ' : ''}
                    {c.quote ? <q>{c.quote}</q> : null}
                  </div>
                ))
              ) : (
                <p className="og-pane-empty">No citation extracted for this relationship.</p>
              )}
            </section>
            <p className="og-pane-empty" style={{ fontSize: '0.8rem' }}>
              Click the map background to clear this selection and return to the chart.
            </p>
          </>
        ) : node ? (
          <>
            <h3 id="og-pane-title">
              {node.label}
              <span className="og-pane-badge">{TYPE_LABELS[node.type] || 'Entity'}</span>
              {node.warning ? <span className="og-pane-badge">Review</span> : null}
            </h3>
            <p className="og-pane-summary">{liveText}</p>
            {matchedOpco && typeof onOpenInRegister === 'function' ? (
              <p className="og-pane-actions">
                <button type="button" className="og-btn og-btn-primary" onClick={() => onOpenInRegister(matchedOpco)}>
                  Open in UBO register
                </button>
              </p>
            ) : null}
            {pathToShow && pathToShow.length > 1 ? (
              <p className="og-pane-summary">
                Path from subject: {pathToShow.map((id) => graph.nodes.find((n) => n.id === id)?.label || id).join(' → ')}
              </p>
            ) : null}
            <section className="og-pane-section">
              <h4>Owned by (upstream)</h4>
              {incoming.length ? (
                <ul className="og-pane-list">
                  {incoming.map((e) => {
                    const src = graph.nodes.find((n) => n.id === e.source);
                    return (
                      <li key={e.id}>
                        {src?.label || e.source}
                        {e.percent != null ? ` · ${e.percent}%` : ''}
                        {e.confidence === 'low' ? ' · low confidence' : ''}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="og-pane-empty">No upstream holders listed for this entity in the extract.</p>
              )}
            </section>
            <section className="og-pane-section">
              <h4>Owns (downstream)</h4>
              {outgoing.length ? (
                <ul className="og-pane-list">
                  {outgoing.map((e) => {
                    const tgt = graph.nodes.find((n) => n.id === e.target);
                    return (
                      <li key={e.id}>
                        {tgt?.label || e.target}
                        {e.percent != null ? ` · ${e.percent}%` : ''}
                        {e.kind === 'votes' ? ' · voting' : ''}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="og-pane-empty">No downstream stakes listed for this entity in the extract.</p>
              )}
            </section>
            <section className="og-pane-section">
              <h4>Evidence</h4>
              {incoming.concat(outgoing).some((e) => e.citations?.length) ? (
                incoming.concat(outgoing).flatMap((e) =>
                  (e.citations || []).map((c, i) => (
                    <div key={`${e.id}-${i}`} className="og-pane-cite">
                      {c.page ? `p. ${c.page}` : ''}
                      {c.page && c.quote ? ' — ' : ''}
                      {c.quote ? <q>{c.quote}</q> : null}
                    </div>
                  )),
                )
              ) : (
                <p className="og-pane-empty">No citations were attached to these relationships in this run.</p>
              )}
            </section>
          </>
        ) : (
          <p className="og-pane-empty">
            Select a node or an edge on the chart. Pan and zoom stay available; click empty space to clear your
            selection.
          </p>
        )}
      </div>
      <footer className="og-pane-footer">
        Chart version {graph?.schemaVersion || '1'}. This view supports decisions only — confirm material facts against
        source documents and internal policy.
      </footer>
    </aside>
  );
}

function FlowCanvas({
  graph,
  fileName,
  extractionMeta,
  warnings,
  reducedMotion,
  registerOpcoNames,
  onOpenInRegister,
}) {
  const [direction, setDirection] = useState(() => {
    try {
      return window.localStorage.getItem('og-layout-direction') || 'down';
    } catch {
      return 'down';
    }
  });
  const [selectedId, setSelectedId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [search, setSearch] = useState('');
  const [pathTarget, setPathTarget] = useState('');

  const subjectId = graph?.subjectNodeId || '';

  useEffect(() => {
    setSelectedId(null);
    setSelectedEdgeId(null);
    setPathTarget('');
  }, [graph]);

  const pathIds = useMemo(() => {
    if (!subjectId || !pathTarget || pathTarget === subjectId) return new Set();
    const p = findUpstreamPath(subjectId, pathTarget, graph?.edges || []);
    return p ? new Set(p) : new Set();
  }, [subjectId, pathTarget, graph?.edges]);

  const pathToShow = useMemo(() => {
    if (!subjectId || !pathTarget) return null;
    return findUpstreamPath(subjectId, pathTarget, graph?.edges || []);
  }, [subjectId, pathTarget, graph?.edges]);

  const searchRe = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return q;
  }, [search]);

  const { nodes: rfNodes, edges: rfEdges } = useMemo(() => {
    const rawNodes = graph?.nodes || [];
    const rawEdges = graph?.edges || [];
    const nodes = rawNodes.map((n) => ({
      id: n.id,
      type: 'ownershipNode',
      data: {
        label: n.label,
        type: n.type,
        jurisdiction: n.jurisdiction,
        isFocal: n.id === subjectId,
        warning: n.warning,
        pathHighlight: pathIds.has(n.id),
      },
    }));
    const edges = rawEdges.map((e) => {
      const isPath = pathToShow ? edgeOnPath(e, pathToShow) : false;
      const isSel = selectedEdgeId === e.id;
      const isCycle = e.cycleFlag;
      const isVote = e.kind === 'votes';
      const stroke = isCycle ? '#d97706' : isSel ? '#0f172a' : isPath ? '#1d4ed8' : '#64748b';
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.percent != null ? `${e.percent}%` : e.kind === 'votes' ? 'vote' : '',
        selected: isSel,
        animated: !reducedMotion && isPath && !isSel,
        interactionWidth: 22,
        style: {
          stroke,
          strokeWidth: isSel ? 3 : isPath ? 2.5 : isCycle ? 2 : 1.5,
          strokeDasharray: isVote ? '6 4' : isCycle ? '4 3' : undefined,
        },
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: stroke },
      };
    });

    const laid = layoutWithDagre(nodes, edges, direction);
    const dimmed = searchRe
      ? laid.map((n) => {
          const lab = (n.data.label || '').toLowerCase();
          const hit = lab.includes(searchRe);
          return {
            ...n,
            style: { opacity: hit || !searchRe ? 1 : 0.22 },
          };
        })
      : laid;

    return { nodes: dimmed, edges };
  }, [graph, direction, pathIds, pathToShow, subjectId, searchRe, reducedMotion, selectedEdgeId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges);

  useLayoutEffect(() => {
    setNodes(rfNodes);
    setEdges(rfEdges);
  }, [rfNodes, rfEdges, setNodes, setEdges]);

  const onNodeClick = useCallback((_, n) => {
    setSelectedEdgeId(null);
    setSelectedId(n.id);
  }, []);

  const onEdgeClick = useCallback((_, edge) => {
    setSelectedId(null);
    setSelectedEdgeId(edge.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedId(null);
    setSelectedEdgeId(null);
  }, []);

  const onDirectionToggle = useCallback(() => {
    setDirection((d) => {
      const next = d === 'down' ? 'up' : 'down';
      try {
        window.localStorage.setItem('og-layout-direction', next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const pathNodeChoices = useMemo(() => {
    const list = (graph?.nodes || []).filter((n) => n.id !== subjectId);
    return list.map((n) => ({ id: n.id, label: n.label }));
  }, [graph?.nodes, subjectId]);

  const hasCycle = (warnings || []).some((w) => /cycle/i.test(w));
  const extractedAt = extractionMeta?.extractedAt
    ? new Date(extractionMeta.extractedAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '';

  return (
    <div className="og-wrap">
      <div className="og-canvas-wrap">
        {hasCycle ? (
          <div className="og-banner og-banner-cycle" role="status">
            This structure includes circular or cross-holdings. Treat percentages and control as provisional until
            reconciled with the underlying register.
          </div>
        ) : null}
        {(graph?.nodes?.length || 0) > 200 ? (
          <div className="og-banner" role="status">
            Large chart ({graph.nodes.length} nodes). Use search and zoom controls to orient; consider splitting source
            documents if the layout is hard to read.
          </div>
        ) : null}
        {(warnings || []).length > 0 && !hasCycle ? (
          <div className="og-banner" role="status">
            {(warnings || []).join(' ')}
          </div>
        ) : null}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable
          edgesFocusable
          minZoom={0.15}
          maxZoom={1.85}
          fitView
          fitViewOptions={{ padding: 0.2, duration: reducedMotion ? 0 : 320 }}
        >
          <Background gap={14} size={1} />
          <Controls showInteractive={false} />
          <InnerToolbar
            fileName={fileName}
            extractedAt={extractedAt}
            subjectId={subjectId}
            direction={direction}
            onDirectionToggle={onDirectionToggle}
            search={search}
            onSearchChange={setSearch}
            pathTarget={pathTarget}
            onPathTargetChange={setPathTarget}
            pathNodeChoices={pathNodeChoices}
            hasCycle={hasCycle}
            reducedMotion={reducedMotion}
          />
        </ReactFlow>
      </div>
      <DetailPane
        graph={graph}
        selectedId={selectedId}
        selectedEdgeId={selectedEdgeId}
        pathToShow={pathToShow}
        registerOpcoNames={registerOpcoNames}
        onOpenInRegister={onOpenInRegister}
      />
    </div>
  );
}

export default function OwnershipGraphView({
  graph,
  warnings,
  extractionMeta,
  fileName,
  registerOpcoNames,
  onOpenInRegister,
}) {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const fn = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  if (!graph?.nodes?.length) {
    return (
      <p className="ubo-empty" role="status">
        No ownership nodes were returned. Upload a text-based shareholder register or cap table, or try another file.
      </p>
    );
  }

  return (
    <ReactFlowProvider>
      <FlowCanvas
        graph={graph}
        fileName={fileName}
        extractionMeta={extractionMeta}
        warnings={warnings}
        reducedMotion={reducedMotion}
        registerOpcoNames={registerOpcoNames}
        onOpenInRegister={onOpenInRegister}
      />
    </ReactFlowProvider>
  );
}
