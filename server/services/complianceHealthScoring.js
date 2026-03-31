import { createChatCompletion, isLlmConfigured } from './llm.js';

function clamp(v, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

function safeDiv(a, b) {
  if (!b) return 0;
  return a / b;
}

function pct(part, total) {
  return clamp(safeDiv(part, total) * 100);
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

function bandForScore(score) {
  if (score >= 90) return 'Healthy';
  if (score >= 75) return 'Compliant';
  if (score >= 50) return 'Developing';
  return 'Critical';
}

function severityRank(value) {
  const v = String(value || '').toLowerCase();
  if (v === 'critical') return 4;
  if (v === 'high') return 3;
  if (v === 'medium') return 2;
  return 1;
}

function factorWeightProfile(context = {}) {
  const base = {
    regulatoryPressure: 0.22,
    legalExpiryPressure: 0.22,
    dependencyPressure: 0.18,
    dataCompliancePressure: 0.12,
    litigationPressure: 0.10,
    documentationPressure: 0.08,
    taskExecutionPressure: 0.05,
    freshnessPressure: 0.03,
  };

  if (context.scope === 'opco') {
    base.legalExpiryPressure += 0.03;
    base.taskExecutionPressure += 0.02;
    base.regulatoryPressure -= 0.03;
    base.freshnessPressure -= 0.02;
  }

  const regulatedSectors = ['bank', 'insurance', 'health', 'fintech', 'payments'];
  if (regulatedSectors.some((x) => String(context.sector || '').toLowerCase().includes(x))) {
    base.regulatoryPressure += 0.02;
    base.dataCompliancePressure += 0.02;
    base.documentationPressure += 0.01;
    base.taskExecutionPressure -= 0.01;
    base.freshnessPressure -= 0.04;
  }

  const sum = Object.values(base).reduce((a, b) => a + b, 0) || 1;
  const out = {};
  for (const [k, v] of Object.entries(base)) out[k] = v / sum;
  return out;
}

function computeConfidence(signals = {}) {
  const coverage = signals.coverage || {};
  const freshness = signals.freshness || {};
  const coverageScores = Object.values(coverage).map((v) => (v ? 1 : 0));
  const coveragePct = coverageScores.length ? (coverageScores.reduce((a, b) => a + b, 0) / coverageScores.length) * 100 : 0;
  const ageDays = typeof freshness.ageDays === 'number' ? freshness.ageDays : 14;
  const freshnessPct = clamp(100 - ageDays * 4);
  return Math.round(clamp(coveragePct * 0.6 + freshnessPct * 0.4));
}

function computeRegulatoryPressure(regulatory = {}) {
  const total = Number(regulatory.total || 0);
  const critical = Number(regulatory.critical || 0);
  const overdue = Number(regulatory.overdue || 0);
  const criticalRate = pct(critical, Math.max(total, critical || 1));
  const overdueRate = pct(overdue, Math.max(total, overdue || 1));
  return clamp(criticalRate * 0.45 + overdueRate * 0.55 + Math.min(overdue * 5, 20));
}

function computeLegalExpiryPressure(legal = {}) {
  const totalActive = Number(legal.totalActive || 0);
  const expiringSoon = Number(legal.expiringSoon || 0);
  const expired = Number(legal.expired || 0);
  const expiryRate = pct(expiringSoon + expired, Math.max(totalActive, expiringSoon + expired || 1));
  return clamp(expiryRate * 0.55 + Math.min(expired * 8, 40) + Math.min(expiringSoon * 3, 20));
}

function computeDependencyPressure(dep = {}) {
  const critical = Number(dep.criticalClusters || 0);
  const high = Number(dep.highClusters || 0);
  const total = Number(dep.totalClusters || 0);
  const exposureAed = Number(dep.totalExposureAed || 0);
  const clusterRate = pct(critical * 2 + high, Math.max(total * 2, 1));
  const exposureRisk = clamp(Math.log10(Math.max(exposureAed, 1)) * 18 - 10);
  return clamp(clusterRate * 0.7 + exposureRisk * 0.3);
}

function computeDataCompliancePressure(insights = []) {
  let risk = 0;
  for (const item of insights || []) {
    const sev = severityRank(item?.severity);
    if (sev >= 4) risk += 14;
    else if (sev === 3) risk += 9;
    else if (sev === 2) risk += 5;
    else risk += 2;
  }
  return clamp(risk);
}

function computeLitigationPressure(litigation = {}, obligationInsights = []) {
  const total = Number(litigation.total || 0);
  const highRisk = Number(litigation.highRisk || 0);
  const exposure = (obligationInsights || []).reduce((sum, row) => sum + Number(row?.financialExposure || 0), 0);
  const countRisk = pct(highRisk, Math.max(total, highRisk || 1));
  const exposureRisk = clamp(Math.log10(Math.max(exposure, 1)) * 15 - 8);
  return clamp(countRisk * 0.65 + exposureRisk * 0.35);
}

function computeDocumentationPressure(gaps = []) {
  const score = (gaps || []).reduce((sum, g) => {
    const c = String(g?.criticality || '').toLowerCase();
    if (c === 'critical') return sum + 12;
    if (c === 'high') return sum + 8;
    if (c === 'medium') return sum + 5;
    return sum + 2;
  }, 0);
  return clamp(score);
}

function computeTaskPressure(taskSignals = {}) {
  const overdue = Number(taskSignals.overdue || 0);
  const dueSoon = Number(taskSignals.dueSoon || 0);
  const open = Number(taskSignals.open || 0);
  const overdueRate = pct(overdue, Math.max(open, overdue || 1));
  return clamp(overdueRate * 0.7 + Math.min(dueSoon * 4, 30));
}

function computeFreshnessPressure(freshness = {}) {
  const ageDays = Number(freshness.ageDays || 0);
  return clamp(ageDays * 4);
}

async function computeAiAttribution(drivers = [], context = {}) {
  if (!isLlmConfigured()) {
    return { status: 'unavailable', confidence: 0, insights: [], reason: 'LLM not configured' };
  }
  const top = (drivers || []).slice(0, 3).map((d) => ({
    factor: d.factor,
    impact: d.impact,
    score: d.normalized,
  }));
  try {
    const prompt = [
      'Provide concise compliance attribution insights.',
      'Use only provided factors. Return JSON with keys: insights (string[]), confidence (0-1).',
      JSON.stringify({ context, topDrivers: top }),
    ].join('\n');
    const out = await createChatCompletion({
      responseFormat: 'json',
      maxTokens: 180,
      messages: [
        { role: 'system', content: 'Return valid JSON only.' },
        { role: 'user', content: prompt },
      ],
    });
    const parsed = JSON.parse(out?.choices?.[0]?.message?.content || '{}');
    const confidence = Number(parsed?.confidence || 0);
    if (confidence < 0.6) {
      return { status: 'low_confidence', confidence, insights: [], reason: 'Below threshold' };
    }
    return {
      status: 'enabled',
      confidence,
      insights: Array.isArray(parsed?.insights) ? parsed.insights.slice(0, 4) : [],
      reason: null,
    };
  } catch {
    return { status: 'failed', confidence: 0, insights: [], reason: 'AI attribution failed' };
  }
}

export async function computeComplianceHealth(signals = {}, opts = {}) {
  const context = opts.context || {};
  const weights = factorWeightProfile(context);
  const confidence = computeConfidence(signals);

  const factors = [
    {
      factor: 'regulatoryPressure',
      weight: weights.regulatoryPressure,
      normalized: computeRegulatoryPressure(signals.regulatory),
      raw: signals.regulatory || {},
    },
    {
      factor: 'legalExpiryPressure',
      weight: weights.legalExpiryPressure,
      normalized: computeLegalExpiryPressure(signals.legal),
      raw: signals.legal || {},
    },
    {
      factor: 'dependencyPressure',
      weight: weights.dependencyPressure,
      normalized: computeDependencyPressure(signals.dependency),
      raw: signals.dependency || {},
    },
    {
      factor: 'dataCompliancePressure',
      weight: weights.dataCompliancePressure,
      normalized: computeDataCompliancePressure(signals.dataComplianceInsights),
      raw: { count: (signals.dataComplianceInsights || []).length },
    },
    {
      factor: 'litigationPressure',
      weight: weights.litigationPressure,
      normalized: computeLitigationPressure(signals.litigation, signals.litigationObligationInsights),
      raw: signals.litigation || {},
    },
    {
      factor: 'documentationPressure',
      weight: weights.documentationPressure,
      normalized: computeDocumentationPressure(signals.documentationGaps),
      raw: { count: (signals.documentationGaps || []).length },
    },
    {
      factor: 'taskExecutionPressure',
      weight: weights.taskExecutionPressure,
      normalized: computeTaskPressure(signals.tasks),
      raw: signals.tasks || {},
    },
    {
      factor: 'freshnessPressure',
      weight: weights.freshnessPressure,
      normalized: computeFreshnessPressure(signals.freshness),
      raw: signals.freshness || {},
    },
  ];

  const weightedRisk = factors.reduce((sum, f) => sum + f.normalized * f.weight, 0);
  const confidencePenalty = clamp((70 - confidence) * 0.15, 0, 12);
  const score = Math.round(clamp(100 - weightedRisk - confidencePenalty));
  const sortedDrivers = [...factors]
    .map((f) => ({ ...f, impact: Number((f.normalized * f.weight).toFixed(2)) }))
    .sort((a, b) => b.impact - a.impact);

  const detail = {
    modelVersion: '2.0',
    band: bandForScore(score),
    confidence,
    reliability: confidence >= 80 ? 'high' : confidence >= 60 ? 'medium' : 'low',
    lastComputedAt: new Date().toISOString(),
    drivers: sortedDrivers,
    topNegativeDrivers: sortedDrivers.slice(0, 3),
    topPositiveDrivers: sortedDrivers
      .filter((d) => d.normalized <= 25)
      .slice(0, 2),
    riskSignals: {
      regulatoryCritical: Number(signals?.regulatory?.critical || 0),
      regulatoryOverdue: Number(signals?.regulatory?.overdue || 0),
      legalExpired: Number(signals?.legal?.expired || 0),
      dependencyCriticalClusters: Number(signals?.dependency?.criticalClusters || 0),
      documentationCritical: (signals?.documentationGaps || []).filter((g) => String(g?.criticality || '').toLowerCase() === 'critical').length,
      tasksOverdue: Number(signals?.tasks?.overdue || 0),
    },
    trace: {
      traceVersion: '1.0',
      deterministic: true,
      confidencePenalty,
      weights,
      context,
      evidenceSources: [
        'changes.json',
        'poa.json',
        'licences.json',
        'contracts.json',
        'litigations.json',
        'tasks.json',
        'feed-meta.json',
        'data-sovereignty-checks.json',
      ],
    },
    aiAttribution: { status: 'disabled', confidence: 0, insights: [], reason: null },
  };

  if (opts.includeAiAttribution) {
    detail.aiAttribution = await computeAiAttribution(detail.topNegativeDrivers, context);
  }

  return {
    complianceHealthScore: score,
    complianceHealthDetail: detail,
  };
}

export function deriveScoringContext({ selectedOpco, onboarding = [] } = {}) {
  const scope = selectedOpco ? 'opco' : 'portfolio';
  if (!selectedOpco) return { scope, sector: 'mixed' };
  const row = (onboarding || []).find((r) => String(r?.opco || '').toLowerCase() === String(selectedOpco || '').toLowerCase());
  const sector = Array.isArray(row?.sectorOfOperations) && row.sectorOfOperations.length > 0
    ? String(row.sectorOfOperations[0])
    : String(row?.sector || 'mixed');
  return { scope, sector };
}

export function deriveFreshness(feedStatus = null) {
  const ageDays = daysSince(feedStatus?.lastRun);
  return { ageDays: ageDays == null ? 30 : ageDays };
}

