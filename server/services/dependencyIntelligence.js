import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createChatCompletion, isLlmConfigured } from './llm.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataRoot = join(__dirname, '../data');

const paths = {
  changes: join(dataRoot, 'changes.json'),
  onboarding: join(dataRoot, 'onboarding-opcos.json'),
  poa: join(dataRoot, 'poa.json'),
  ip: join(dataRoot, 'ip.json'),
  licences: join(dataRoot, 'licences.json'),
  litigations: join(dataRoot, 'litigations.json'),
  contracts: join(dataRoot, 'contracts.json'),
  dataSovereignty: join(dataRoot, 'data-sovereignty-checks.json'),
  aiModelUsage: join(dataRoot, 'ai-model-usage.json'),
  tasks: join(dataRoot, 'tasks.json'),
};

async function safeRead(path, fallback) {
  try {
    const raw = await readFile(path, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function norm(v) {
  return String(v || '').trim().toLowerCase();
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d - new Date()) / 86400000);
}

function includesAny(text, terms) {
  const t = norm(text);
  return terms.some((x) => t.includes(norm(x)));
}

function isRecent(dateStr, days) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const from = new Date();
  from.setDate(from.getDate() - days);
  return d >= from;
}

function detectJurisdictionFromLocations(locations = []) {
  const joined = String((locations || []).join(' ')).toLowerCase();
  if (joined.includes('saudi')) return 'KSA';
  if (joined.includes('qatar')) return 'Qatar';
  if (joined.includes('bahrain')) return 'Bahrain';
  if (joined.includes('oman')) return 'Oman';
  if (joined.includes('kuwait')) return 'Kuwait';
  return 'UAE';
}

function riskRank(severity = '') {
  const s = String(severity || '').toLowerCase();
  if (s === 'critical') return 4;
  if (s === 'high') return 3;
  if (s === 'medium') return 2;
  return 1;
}

function toSeverity(score) {
  if (score >= 80) return 'Critical';
  if (score >= 60) return 'High';
  if (score >= 35) return 'Medium';
  return 'Low';
}

function scoreBand(score) {
  if (score >= 90) return 'non_compliant';
  if (score >= 70) return 'partially_compliant';
  if (score >= 40) return 'largely_compliant';
  return 'compliant';
}

function buildTrace({ clusterId, category, score, factors, deterministicEvidence, aiEvidence }) {
  return {
    traceVersion: '1.0',
    clusterId,
    category,
    score,
    scoreBand: scoreBand(score),
    computedAt: new Date().toISOString(),
    factors,
    deterministicEvidence,
    aiEvidence,
  };
}

async function enrichWithAi(cluster) {
  if (!isLlmConfigured()) {
    return {
      aiStatus: 'unavailable',
      aiReason: 'LLM is not configured',
      aiInsights: [],
    };
  }

  const prompt = [
    'You are a compliance analyst.',
    'Given this cluster summary, return JSON only with keys "insights" (string[]) and "confidence" (0-1).',
    'Do not change deterministic facts. Only add short, actionable observations.',
    JSON.stringify({
      id: cluster.id,
      opco: cluster.opco,
      severity: cluster.severity,
      unresolvedCount: cluster.unresolvedCount,
      exposureAed: cluster.exposureAed,
      topFrameworks: cluster.topFrameworks,
    }),
  ].join('\n');

  try {
    const out = await createChatCompletion({
      responseFormat: 'json',
      maxTokens: 220,
      messages: [
        { role: 'system', content: 'Return valid JSON only.' },
        { role: 'user', content: prompt },
      ],
    });
    const content = out?.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    const confidence = Number(parsed?.confidence || 0);
    const insights = Array.isArray(parsed?.insights) ? parsed.insights.slice(0, 5) : [];
    if (confidence < 0.6 || insights.length === 0) {
      return {
        aiStatus: 'low_confidence',
        aiReason: 'Confidence below threshold',
        aiInsights: [],
      };
    }
    return {
      aiStatus: 'enabled',
      aiReason: null,
      aiInsights: insights,
      aiConfidence: confidence,
    };
  } catch {
    return {
      aiStatus: 'failed',
      aiReason: 'LLM enrichment failed',
      aiInsights: [],
    };
  }
}

export async function computeDependencyIntelligence({ days = 30, selectedOpco = '', includeAi = false } = {}) {
  const [changesRaw, onboarding, poa, ip, licences, litigations, contracts, dataSovereignty, aiModelUsage, tasks] =
    await Promise.all([
      safeRead(paths.changes, []),
      safeRead(paths.onboarding, []),
      safeRead(paths.poa, []),
      safeRead(paths.ip, []),
      safeRead(paths.licences, []),
      safeRead(paths.litigations, []),
      safeRead(paths.contracts, []),
      safeRead(paths.dataSovereignty, { checks: [] }),
      safeRead(paths.aiModelUsage, []),
      safeRead(paths.tasks, []),
    ]);

  const modelCatalog = Array.isArray(aiModelUsage) && aiModelUsage.length > 0
    ? aiModelUsage
    : [];

  const recentChanges = (changesRaw || []).filter((c) => isRecent(c.date, days));
  const selected = norm(selectedOpco);
  const matchOpco = (value) => !selected || norm(value) === selected;
  const checks = Array.isArray(dataSovereignty?.checks) ? dataSovereignty.checks : [];

  const clusters = [];
  const clusterByKey = new Map();

  function getOrCreateCluster(opcoName, parentName) {
    const opcoKey = norm(opcoName || 'unknown-opco');
    if (!clusterByKey.has(opcoKey)) {
      const id = `dep-${opcoKey.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown'}`;
      clusterByKey.set(opcoKey, {
        id,
        opco: opcoName || 'Unknown OpCo',
        parent: parentName || '—',
        legalOwner: 'Legal team',
        unresolvedCount: 0,
        exposureAed: 0,
        impactScore: 0,
        severity: 'Low',
        topFrameworks: [],
        pendingActions: [],
        dependencies: [],
        trace: null,
        aiStatus: 'disabled',
        aiInsights: [],
      });
    }
    return clusterByKey.get(opcoKey);
  }

  const opcoChangeMap = new Map();
  for (const ch of recentChanges) {
    for (const co of ch.affectedCompanies || []) {
      if (!matchOpco(co)) continue;
      if (!opcoChangeMap.has(norm(co))) opcoChangeMap.set(norm(co), []);
      opcoChangeMap.get(norm(co)).push(ch);
    }
  }

  for (const p of poa || []) {
    if (!matchOpco(p.opco)) continue;
    const du = daysUntil(p.validUntil);
    if (du == null || du > 60) continue;
    const cluster = getOrCreateCluster(p.opco, p.parent);
    const penalty = du < 0 ? 40 : du <= 15 ? 30 : 18;
    cluster.unresolvedCount += 1;
    cluster.impactScore += penalty;
    cluster.dependencies.push({
      id: `poa-${p.id || p.fileId || cluster.dependencies.length}`,
      type: 'POA',
      title: p.holderName || 'POA holder',
      status: du < 0 ? 'expired' : 'expiring',
      dueDate: p.validUntil || null,
      severity: du < 0 ? 'Critical' : 'High',
      owner: p.legalRepresentative || p.holderName || 'Legal team',
      evidence: ['poa.json', 'validUntil'],
      traceRef: 'deterministic.poa_expiry',
    });
    const ownerTask = (tasks || []).find((t) =>
      norm(t?.opco) === norm(p.opco) &&
      includesAny(t?.module || '', ['poa']) &&
      !includesAny(t?.status || '', ['done', 'closed', 'cancelled'])
    );
    if (ownerTask?.assignee || ownerTask?.assignedTo) {
      cluster.legalOwner = ownerTask.assignee || ownerTask.assignedTo;
      cluster.pendingActions.push({
        type: 'task',
        title: ownerTask.title || ownerTask.name || 'POA renewal action',
        assignee: ownerTask.assignee || ownerTask.assignedTo,
        dueDate: ownerTask.dueDate || null,
      });
    }
  }

  for (const lit of litigations || []) {
    if (!matchOpco(lit.opco)) continue;
    if (['Closed', 'Settled', 'Dismissed'].includes(lit.status)) continue;
    const cluster = getOrCreateCluster(lit.opco, lit.parent);
    const relatedContracts = (contracts || []).filter((c) => norm(c.opco) === norm(lit.opco));
    const relatedIp = (ip || []).filter((a) => norm(a.opco) === norm(lit.opco));
    if (relatedContracts.length === 0 && relatedIp.length === 0) continue;
    const baseExposure = Number(lit.claimAmount || 0) || 0;
    const computedExposure = baseExposure + relatedContracts.length * 250000 + relatedIp.length * 150000;
    cluster.exposureAed += computedExposure;
    cluster.unresolvedCount += 1;
    cluster.impactScore += computedExposure >= 1000000 ? 38 : computedExposure >= 300000 ? 24 : 12;
    cluster.dependencies.push({
      id: `lit-${lit.id || lit.caseId || cluster.dependencies.length}`,
      type: 'Litigation',
      title: lit.caseId || lit.subject || 'Litigation case',
      status: lit.status || 'Open',
      dueDate: lit.nextHearingDate || null,
      severity: computedExposure >= 1000000 ? 'Critical' : 'High',
      owner: lit.owner || 'Legal team',
      evidence: ['litigations.json', 'contracts.json', 'ip.json'],
      traceRef: 'deterministic.litigation_obligation_link',
    });
  }

  for (const row of onboarding || []) {
    if (!matchOpco(row.opco)) continue;
    const jurisdiction = detectJurisdictionFromLocations(Array.isArray(row.locations) ? row.locations : []);
    if (modelCatalog.length === 0) {
      const cluster = getOrCreateCluster(row.opco, row.parent);
      cluster.unresolvedCount += 1;
      cluster.impactScore += 20;
      cluster.dependencies.push({
        id: `data-unconfigured-${cluster.dependencies.length}`,
        type: 'DataCompliance',
        title: 'AI model inventory unconfigured',
        status: 'unknown',
        dueDate: null,
        severity: 'High',
        owner: 'Data Security team',
        evidence: ['ai-model-usage.json (missing/unconfigured)'],
        traceRef: 'deterministic.model_inventory_missing',
      });
      continue;
    }

    for (const model of modelCatalog) {
      if (!model?.dataLeavesJurisdiction) continue;
      const matchingCheck = checks.find((c) =>
        includesAny(c.jurisdiction || '', [jurisdiction, 'GCC']) &&
        includesAny(c.name || '', ['data', 'localisation', 'cross-border'])
      );
      const sev = matchingCheck?.severity || 'High';
      const cluster = getOrCreateCluster(row.opco, row.parent);
      cluster.unresolvedCount += 1;
      cluster.impactScore += sev === 'Critical' ? 30 : sev === 'High' ? 22 : 12;
      cluster.dependencies.push({
        id: `data-${cluster.dependencies.length}`,
        type: 'DataCompliance',
        title: `${model.model} (${model.hostRegion})`,
        status: 'active',
        dueDate: null,
        severity: sev,
        owner: 'Data Security team',
        evidence: ['ai-model-usage.json', 'data-sovereignty-checks.json'],
        traceRef: 'deterministic.cross_border_model_risk',
      });
    }
  }

  for (const c of contracts || []) {
    if (!matchOpco(c.opco)) continue;
    const missing = [];
    if (!c.documentLink && !c.documentOriginalName) missing.push('source_document');
    if (!c.effectiveDate) missing.push('effective_date');
    if (!c.expiryDate) missing.push('expiry_date');
    if (missing.length === 0) continue;
    const cluster = getOrCreateCluster(c.opco, c.parent);
    cluster.unresolvedCount += 1;
    cluster.impactScore += c.riskLevel === 'High' ? 24 : 14;
    cluster.dependencies.push({
      id: `doc-${c.id || c.contractId || cluster.dependencies.length}`,
      type: 'Documentation',
      title: c.contractId || c.title || 'Contract record',
      status: 'incomplete',
      dueDate: c.expiryDate || null,
      severity: c.riskLevel === 'High' ? 'Critical' : 'Medium',
      owner: 'Contracts team',
      evidence: ['contracts.json'],
      traceRef: 'deterministic.missing_documentation',
      missingFields: missing,
    });
  }

  for (const cluster of clusterByKey.values()) {
    const relatedChanges = opcoChangeMap.get(norm(cluster.opco)) || [];
    const frameworkCounts = {};
    for (const change of relatedChanges) {
      const fw = change.framework || 'Other';
      frameworkCounts[fw] = (frameworkCounts[fw] || 0) + 1;
    }
    cluster.topFrameworks = Object.entries(frameworkCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([framework, count]) => ({ framework, count }));
    cluster.impactScore = Math.min(100, cluster.impactScore + Math.min(20, relatedChanges.length * 2));
    cluster.severity = toSeverity(cluster.impactScore);
    cluster.dependencies.sort((a, b) => riskRank(b.severity) - riskRank(a.severity));
    cluster.trace = buildTrace({
      clusterId: cluster.id,
      category: 'dependency_cluster',
      score: cluster.impactScore,
      factors: {
        unresolvedCount: cluster.unresolvedCount,
        exposureAed: cluster.exposureAed,
        frameworkChangeCount: relatedChanges.length,
      },
      deterministicEvidence: {
        sources: ['changes.json', 'poa.json', 'contracts.json', 'litigations.json', 'ip.json', 'onboarding-opcos.json'],
        decisionRules: [
          'POA expiry within <=60 days contributes deterministic risk points',
          'Open litigation with contract/IP linkage contributes exposure-based points',
          'Cross-border AI model transfer contributes sovereignty risk points',
          'Missing required contract documentation contributes completeness risk points',
        ],
      },
      aiEvidence: {
        mode: includeAi ? 'additive' : 'disabled',
        precedence: 'deterministic_first',
      },
    });
    clusters.push(cluster);
  }

  clusters.sort((a, b) => b.impactScore - a.impactScore);

  if (includeAi) {
    for (const cluster of clusters) {
      const ai = await enrichWithAi(cluster);
      cluster.aiStatus = ai.aiStatus;
      cluster.aiInsights = ai.aiInsights || [];
      cluster.trace.aiEvidence.status = ai.aiStatus;
      cluster.trace.aiEvidence.reason = ai.aiReason || null;
      if (typeof ai.aiConfidence === 'number') {
        cluster.trace.aiEvidence.confidence = ai.aiConfidence;
      }
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    selectedOpco: selectedOpco || null,
    totalClusters: clusters.length,
    criticalClusters: clusters.filter((x) => x.severity === 'Critical').length,
    highClusters: clusters.filter((x) => x.severity === 'High').length,
    totalExposureAed: clusters.reduce((sum, x) => sum + Number(x.exposureAed || 0), 0),
    aiMode: includeAi ? 'hybrid' : 'deterministic_only',
    topClusters: clusters.slice(0, 10).map((c) => ({
      id: c.id,
      opco: c.opco,
      parent: c.parent,
      severity: c.severity,
      impactScore: c.impactScore,
      unresolvedCount: c.unresolvedCount,
      topFrameworks: c.topFrameworks,
    })),
  };

  return { summary, clusters };
}
