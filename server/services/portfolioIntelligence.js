/**
 * Portfolio intelligence — deterministic joins across ownership graphs and legal registers.
 * No ML/LLM; evidence references only (graph edge ids, record ids).
 */
import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { loadStore } from './ownershipGraphStore.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '../data');
const LIT_PATH = join(DATA, 'litigations.json');
const IP_PATH = join(DATA, 'ip.json');
const CON_PATH = join(DATA, 'contracts.json');

export function normalizeLabel(s) {
  if (s == null) return '';
  return String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0600-\u06FF\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} label
 * @param {string} query
 */
export function labelMatchesQuery(label, query) {
  const q = normalizeLabel(query);
  const l = normalizeLabel(label);
  if (q.length < 2 || l.length === 0) return false;
  if (l.includes(q)) return true;
  const words = q.split(' ').filter((w) => w.length >= 2);
  if (words.length === 0) return false;
  return words.every((w) => l.includes(w));
}

function humanizeContextId(contextId) {
  if (typeof contextId !== 'string') return '';
  return contextId.replace(/::/g, ' · ').replace(/_/g, ' ');
}

function nodeById(graph, id) {
  const nodes = graph?.nodes;
  if (!Array.isArray(nodes)) return null;
  return nodes.find((n) => n && n.id === id) || null;
}

/**
 * @param {string} query
 * @returns {Promise<{ query: string, holdings: object[], graphContexts: object[], explain: object }>}
 */
export async function computeCrossHoldings(query) {
  const q = typeof query === 'string' ? query.trim() : '';
  if (q.length < 2) {
    return {
      query: q,
      holdings: [],
      graphContexts: [],
      explain: { reason: 'Query must be at least 2 characters.' },
    };
  }

  const db = await loadStore();
  const graphs = db?.graphs && typeof db.graphs === 'object' ? db.graphs : {};
  /** @type {object[]} */
  const holdings = [];
  /** @type {object[]} */
  const graphContexts = [];

  for (const [contextId, rec] of Object.entries(graphs)) {
    const graph = rec?.graph;
    if (!graph || typeof graph !== 'object') continue;
    const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
    const edges = Array.isArray(graph.edges) ? graph.edges : [];

    const matchedNodes = nodes.filter(
      (n) => n && typeof n.label === 'string' && labelMatchesQuery(n.label, q)
    );
    if (matchedNodes.length === 0) continue;

    const matchedIds = new Set(matchedNodes.map((n) => n.id).filter(Boolean));
    const miniNodes = nodes.map((n) => ({
      id: n.id,
      label: n.label,
      type: n.type,
    }));

    const edgeKeys = new Set();
    const miniEdges = [];
    for (const mn of matchedNodes) {
      for (const e of edges) {
        if (!e) continue;
        const src = e.source;
        const tgt = e.target;
        if (src !== mn.id && tgt !== mn.id) continue;

        const otherId = src === mn.id ? tgt : src;
        const other = nodeById(graph, otherId);
        holdings.push({
          contextId,
          contextLabel: humanizeContextId(contextId),
          subjectNodeId: mn.id,
          subjectLabel: mn.label,
          subjectType: mn.type,
          edgeId: e.id || null,
          edgeKind: e.kind || 'owns',
          percent: e.percent != null ? e.percent : null,
          counterpartyNodeId: otherId,
          counterpartyLabel: other?.label || otherId,
          counterpartyType: other?.type || 'unknown',
          direction: src === mn.id ? 'outbound' : 'inbound',
          evidence: 'ownership-graph edge',
        });
        const ek = `${src}|${tgt}|${e.kind || ''}`;
        if (!edgeKeys.has(ek)) {
          edgeKeys.add(ek);
          miniEdges.push({
            id: e.id || ek,
            source: src,
            target: tgt,
            kind: e.kind,
            percent: e.percent,
          });
        }
      }
    }

    if (matchedIds.size > 0) {
      graphContexts.push({
        contextId,
        contextLabel: humanizeContextId(contextId),
        matchedNodeIds: [...matchedIds],
        nodes: miniNodes,
        edges: miniEdges,
      });
    }
  }

  return {
    query: q,
    holdings,
    graphContexts,
    explain: {
      source: 'ownership-graphs/graphs.json',
      matchedGraphs: graphContexts.length,
      edgeCount: holdings.length,
    },
  };
}

async function loadJsonArray(path) {
  try {
    const raw = await readFile(path, 'utf-8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

const IP_DISPUTE = /ip|patent|trademark|copyright|trade\s*secret/i;

/**
 * @param {string} litigationId
 */
export async function computeLitigationImpact(litigationId) {
  const id = typeof litigationId === 'string' ? litigationId.trim() : '';
  if (!id) {
    return { error: 'Missing litigation id' };
  }

  const [litigations, ipList, contracts] = await Promise.all([
    loadJsonArray(LIT_PATH),
    loadJsonArray(IP_PATH),
    loadJsonArray(CON_PATH),
  ]);

  const lit = litigations.find((r) => r && r.id === id);
  if (!lit) {
    return { error: 'Litigation not found', litigationId: id };
  }

  const opco = (lit.opco || '').trim();
  const parent = (lit.parent || '').trim();
  const claimType = (lit.claimType || '').trim();
  const status = (lit.status || '').trim();
  const notes = (lit.notes || '').trim();

  const ipLinked = ipList.filter((r) => {
    if (!r) return false;
    if (opco && r.opco !== opco) return false;
    if (parent && r.parent && r.parent !== parent) return false;
    return true;
  });

  const contractsLinked = contracts.filter((r) => {
    if (!r) return false;
    if (opco && r.opco !== opco) return false;
    if (parent && r.parent && r.parent !== parent) return false;
    return true;
  });

  const ipRelatedClaim = IP_DISPUTE.test(claimType) || IP_DISPUTE.test(notes);
  const openish = /^(open|active|pending)/i.test(status);

  let impactTier = 'low';
  const reasons = [];

  if (ipRelatedClaim) {
    reasons.push('Claim type or case notes indicate IP-related dispute.');
  }
  if (ipLinked.length > 0) {
    reasons.push(`${ipLinked.length} IP register row(s) share this OpCo (and parent scope when present).`);
  }
  if (contractsLinked.length > 0) {
    reasons.push(`${contractsLinked.length} contract row(s) share this OpCo for business exposure context.`);
  }

  if (openish && ipRelatedClaim && ipLinked.length >= 1) {
    impactTier = 'high';
    reasons.push('Rule: open matter + IP-related claim + at least one IP asset in scope → tier High.');
  } else if (ipRelatedClaim || ipLinked.length > 0) {
    impactTier = 'medium';
    reasons.push('Rule: IP linkage without full High-criteria match → tier Medium.');
  } else {
    reasons.push('Rule: no IP linkage signals → tier Low.');
  }

  return {
    litigation: {
      id: lit.id,
      caseId: lit.caseId,
      opco: lit.opco,
      parent: lit.parent,
      status: lit.status,
      claimType: lit.claimType,
      jurisdiction: lit.jurisdiction,
    },
    impactTier,
    linkedIp: ipLinked.map((r) => ({
      id: r.id,
      mark: r.mark,
      ipType: r.ipType,
      registrationNo: r.registrationNo,
      jurisdiction: r.jurisdiction,
      status: r.status,
    })),
    linkedContracts: contractsLinked.map((r) => ({
      id: r.id,
      contractId: r.contractId,
      title: r.title,
      contractType: r.contractType,
      riskLevel: r.riskLevel,
      status: r.status,
    })),
    explainability: {
      rulesVersion: 'portfolio-intelligence-v1',
      evaluatedAt: new Date().toISOString(),
      reasons,
    },
  };
}
