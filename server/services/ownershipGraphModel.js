/**
 * OwnershipGraphV1 — canonical model + validation + cycle detection.
 * Pure functions; safe for unit tests without LLM.
 */

const NODE_TYPES = new Set(['person', 'corporate', 'trust', 'fund', 'unknown']);
const EDGE_KINDS = new Set(['owns', 'controls', 'votes']);

function safeStr(v, max = 500) {
  if (v == null) return '';
  const s = String(v).trim();
  return s.length > max ? s.slice(0, max) : s;
}

function makeId(prefix, label, salt) {
  const base = `${label || 'node'}::${salt}`;
  let h = 0;
  for (let i = 0; i < base.length; i++) {
    h = (Math.imul(31, h) + base.charCodeAt(i)) | 0;
  }
  return `${prefix}-${Math.abs(h).toString(36)}`;
}

/**
 * @param {unknown} raw
 * @returns {{ ok: boolean, errors: string[], graph?: object }}
 */
export function validateOwnershipGraphV1(raw) {
  const errors = [];
  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: ['Graph must be an object'] };
  }
  const g = raw;
  if (g.schemaVersion !== '1' && g.schemaVersion !== 1) {
    errors.push('schemaVersion must be 1');
  }
  if (!Array.isArray(g.nodes)) errors.push('nodes must be an array');
  if (!Array.isArray(g.edges)) errors.push('edges must be an array');

  const ids = new Set();
  if (Array.isArray(g.nodes)) {
    g.nodes.forEach((n, i) => {
      if (!n || typeof n !== 'object') {
        errors.push(`nodes[${i}] invalid`);
        return;
      }
      const id = safeStr(n.id, 80);
      if (!id) errors.push(`nodes[${i}].id required`);
      else if (ids.has(id)) errors.push(`duplicate node id: ${id}`);
      else ids.add(id);
      const t = safeStr(n.type, 32).toLowerCase() || 'unknown';
      if (!NODE_TYPES.has(t)) errors.push(`nodes[${i}].type invalid: ${t}`);
    });
  }

  if (Array.isArray(g.edges)) {
    const edgeIds = new Set();
    g.edges.forEach((e, i) => {
      if (!e || typeof e !== 'object') {
        errors.push(`edges[${i}] invalid`);
        return;
      }
      const id = safeStr(e.id, 80);
      if (id) {
        if (edgeIds.has(id)) errors.push(`duplicate edge id: ${id}`);
        edgeIds.add(id);
      }
      const src = safeStr(e.source, 80);
      const tgt = safeStr(e.target, 80);
      if (!src) errors.push(`edges[${i}].source required`);
      if (!tgt) errors.push(`edges[${i}].target required`);
      const k = safeStr(e.kind, 20).toLowerCase() || 'owns';
      if (!EDGE_KINDS.has(k)) errors.push(`edges[${i}].kind invalid: ${k}`);
      if (e.percent != null && e.percent !== '') {
        const p = Number(e.percent);
        if (Number.isNaN(p) || p < 0 || p > 100) errors.push(`edges[${i}].percent out of range`);
      }
    });
  }

  g.subjectNodeId = g.subjectNodeId != null ? safeStr(g.subjectNodeId, 80) : '';

  if (Array.isArray(g.nodes) && Array.isArray(g.edges) && errors.length === 0) {
    for (const e of g.edges) {
      const src = safeStr(e.source, 80);
      const tgt = safeStr(e.target, 80);
      if (src && !ids.has(src)) errors.push(`edge references unknown source: ${src}`);
      if (tgt && !ids.has(tgt)) errors.push(`edge references unknown target: ${tgt}`);
    }
  }

  return { ok: errors.length === 0, errors, graph: errors.length === 0 ? g : undefined };
}

/**
 * Tarjan SCC — nodes participating in cycles (by id).
 */
export function findNodeIdsInDirectedCycles(nodes, edges) {
  const nodeList = (nodes || []).map((n) => safeStr(n.id, 80)).filter(Boolean);
  const index = new Map();
  const lowlink = new Map();
  const onStack = new Set();
  const stack = [];
  let idx = 0;
  const inCycle = new Set();

  const adj = new Map();
  for (const n of nodeList) adj.set(n, []);
  for (const e of edges || []) {
    const s = safeStr(e.source, 80);
    const t = safeStr(e.target, 80);
    if (s && t && adj.has(s)) adj.get(s).push(t);
  }

  function strongConnect(v) {
    index.set(v, idx);
    lowlink.set(v, idx);
    idx += 1;
    stack.push(v);
    onStack.add(v);

    for (const w of adj.get(v) || []) {
      if (!index.has(w)) {
        strongConnect(w);
        lowlink.set(v, Math.min(lowlink.get(v), lowlink.get(w)));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v), index.get(w)));
      }
    }

    if (lowlink.get(v) === index.get(v)) {
      const comp = [];
      let w;
      do {
        w = stack.pop();
        onStack.delete(w);
        comp.push(w);
      } while (w !== v);
      if (comp.length > 1) comp.forEach((c) => inCycle.add(c));
    }
  }

  for (const v of nodeList) {
    if (!index.has(v)) strongConnect(v);
  }

  // Self-loops
  for (const e of edges || []) {
    const s = safeStr(e.source, 80);
    const t = safeStr(e.target, 80);
    if (s && t && s === t) inCycle.add(s);
  }

  return inCycle;
}

/**
 * Normalize LLM / loose JSON into OwnershipGraphV1.
 * @returns {{ graph: object, warnings: string[] }}
 */
export function normalizeOwnershipGraphV1(raw, opts = {}) {
  const warnings = [];
  const subjectHint = opts.subjectHint ? safeStr(opts.subjectHint, 200) : '';

  let obj = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw.replace(/^```json?\s*|\s*```$/g, '').trim());
    } catch {
      return {
        graph: emptyGraph(subjectHint),
        warnings: ['Could not parse JSON from model output.'],
      };
    }
  }

  if (!obj || typeof obj !== 'object') {
    return { graph: emptyGraph(subjectHint), warnings: ['Model returned non-object JSON.'] };
  }

  const rawNodes = Array.isArray(obj.nodes) ? obj.nodes : [];
  const rawEdges = Array.isArray(obj.edges) ? obj.edges : [];

  const labelToId = new Map();
  const nodes = [];
  const seenIds = new Set();
  let salt = 0;

  for (const n of rawNodes) {
    if (!n || typeof n !== 'object') continue;
    let id = safeStr(n.id, 80);
    const label = safeStr(n.label, 300) || safeStr(n.name, 300) || 'Unknown entity';
    const type = (safeStr(n.type, 32).toLowerCase() || 'unknown');
    const t = NODE_TYPES.has(type) ? type : 'unknown';
    if (!id) {
      const key = label.toLowerCase();
      if (labelToId.has(key)) id = labelToId.get(key);
      else {
        id = makeId('n', label, salt++);
        labelToId.set(key, id);
      }
    } else if (label) {
      labelToId.set(label.toLowerCase(), id);
    }
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    const jurisdiction = safeStr(n.jurisdiction, 200) || null;
    const inferred = !!n.inferred || n.confidence === 'low';
    nodes.push({
      id,
      label,
      type: t,
      ...(jurisdiction ? { jurisdiction } : {}),
      ...(inferred ? { warning: true } : {}),
    });
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  if (nodes.length === 0 && subjectHint) {
    const sid = makeId('n', subjectHint, 0);
    nodes.push({ id: sid, label: subjectHint, type: 'corporate' });
    nodeIds.add(sid);
  }

  const edges = [];
  let eSalt = 0;
  for (const e of rawEdges) {
    if (!e || typeof e !== 'object') continue;
    let src = safeStr(e.source, 80);
    let tgt = safeStr(e.target, 80);
    if (!src || !tgt) continue;
    if (!nodeIds.has(src) || !nodeIds.has(tgt)) {
      const sl = safeStr(e.sourceLabel, 200);
      const tl = safeStr(e.targetLabel, 200);
      if (sl && labelToId.has(sl.toLowerCase())) src = labelToId.get(sl.toLowerCase());
      if (tl && labelToId.has(tl.toLowerCase())) tgt = labelToId.get(tl.toLowerCase());
    }
    if (!nodeIds.has(src) || !nodeIds.has(tgt)) {
      warnings.push(`Skipped edge: unknown endpoint (${src} → ${tgt})`);
      continue;
    }
    const kind = (safeStr(e.kind, 20).toLowerCase() || 'owns');
    const k = EDGE_KINDS.has(kind) ? kind : 'owns';
    const edgeId = safeStr(e.id, 80) || makeId('e', `${src}-${tgt}`, eSalt++);
    const pct = e.percent != null && e.percent !== '' ? Number(e.percent) : null;
    const confidence = safeStr(e.confidence, 20).toLowerCase() || null;
    const citations = Array.isArray(e.citations)
      ? e.citations
          .slice(0, 20)
          .map((c) => ({
            page: c && c.page != null ? safeStr(c.page, 40) : '',
            quote: c && c.quote != null ? safeStr(c.quote, 2000) : '',
          }))
          .filter((c) => c.page || c.quote)
      : [];

    edges.push({
      id: edgeId,
      source: src,
      target: tgt,
      kind: k,
      ...(pct != null && !Number.isNaN(pct) ? { percent: Math.min(100, Math.max(0, pct)) } : {}),
      ...(confidence ? { confidence } : {}),
      ...(citations.length ? { citations } : {}),
    });
  }

  let subjectNodeId = safeStr(obj.subjectNodeId, 80);
  if (!subjectNodeId && subjectHint) {
    const match = nodes.find((n) => n.label.toLowerCase() === subjectHint.toLowerCase());
    if (match) subjectNodeId = match.id;
  }
  if (!subjectNodeId && nodes.length) {
    const corporate = nodes.find((n) => n.type === 'corporate');
    subjectNodeId = (corporate || nodes[0]).id;
  }

  let graph = {
    schemaVersion: '1',
    nodes,
    edges: edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target)),
    subjectNodeId: subjectNodeId || (nodes[0] && nodes[0].id) || '',
  };

  const cycleIds = findNodeIdsInDirectedCycles(graph.nodes, graph.edges);
  if (cycleIds.size) warnings.push('Graph contains ownership cycles or cross-holdings (see highlighted nodes).');

  let validated = validateOwnershipGraphV1(graph);
  if (!validated.ok) {
    warnings.push(...validated.errors);
    graph = emptyGraph(subjectHint);
    validated = validateOwnershipGraphV1(graph);
    if (!validated.ok) return { graph: emptyGraph(subjectHint), warnings };
  }

  for (const n of graph.nodes) {
    if (cycleIds.has(n.id)) n.warning = true;
  }
  for (const e of graph.edges) {
    if (cycleIds.has(e.source) && cycleIds.has(e.target)) e.cycleFlag = true;
  }

  return { graph: validated.graph || graph, warnings };
}

function emptyGraph(subjectHint) {
  const hint = safeStr(subjectHint, 200);
  if (!hint) {
    return { schemaVersion: '1', nodes: [], edges: [], subjectNodeId: '' };
  }
  const id = makeId('n', hint, 0);
  return {
    schemaVersion: '1',
    nodes: [{ id, label: hint, type: 'corporate' }],
    edges: [],
    subjectNodeId: id,
  };
}

export function mergeDuplicateEdges(edges) {
  const map = new Map();
  for (const e of edges || []) {
    const key = `${e.source}|${e.target}|${e.kind}`;
    if (!map.has(key)) map.set(key, { ...e });
    else {
      const cur = map.get(key);
      if (e.percent != null && cur.percent == null) cur.percent = e.percent;
      if (e.citations?.length && !cur.citations?.length) cur.citations = e.citations;
    }
  }
  return [...map.values()];
}
