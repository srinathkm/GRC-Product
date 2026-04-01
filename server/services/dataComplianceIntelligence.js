function norm(value) {
  return String(value || '').trim().toLowerCase();
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function safeDiv(a, b) {
  if (!b) return 0;
  return a / b;
}

function uniq(values = []) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function severityWeight(severity = '') {
  const s = norm(severity);
  if (s === 'critical') return 1;
  if (s === 'high') return 0.75;
  if (s === 'medium') return 0.45;
  return 0.2;
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

function includesAny(text, terms) {
  const t = norm(text);
  return terms.some((x) => t.includes(norm(x)));
}

function normalizeSeverity(raw = '') {
  const value = norm(raw);
  if (value === 'critical') return 'Critical';
  if (value === 'high') return 'High';
  if (value === 'medium') return 'Medium';
  if (value === 'low') return 'Low';
  return 'Medium';
}

function buildRiskDrivers(insights = []) {
  const buckets = new Map();
  for (const insight of insights) {
    const key = `${insight.jurisdiction || 'Unknown'}::${insight.severity || 'Medium'}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        jurisdiction: insight.jurisdiction || 'Unknown',
        severity: normalizeSeverity(insight.severity),
        count: 0,
        models: new Set(),
        regulations: new Set(),
      });
    }
    const row = buckets.get(key);
    row.count += 1;
    row.models.add(insight.model || 'Unknown model');
    row.regulations.add(insight.regulation || 'Data residency requirements');
  }

  const drivers = [];
  for (const row of buckets.values()) {
    const impact = clamp(
      Math.round((row.count * severityWeight(row.severity) * 22) + (row.models.size * 8)),
      0,
      100,
    );
    drivers.push({
      factor: `${row.jurisdiction} cross-border transfer risk`,
      jurisdiction: row.jurisdiction,
      severity: row.severity,
      count: row.count,
      impact,
      businessImpact: {
        regulatoryPenaltyRisk: impact >= 70 ? 'High' : impact >= 45 ? 'Medium' : 'Low',
        customerTrustRisk: impact >= 60 ? 'High' : impact >= 35 ? 'Medium' : 'Low',
        contractRevenueRisk: impact >= 75 ? 'High' : impact >= 45 ? 'Medium' : 'Low',
        operationalContinuityRisk: impact >= 80 ? 'High' : impact >= 50 ? 'Medium' : 'Low',
      },
      deterministicEvidence: {
        models: uniq(Array.from(row.models)),
        regulations: uniq(Array.from(row.regulations)),
      },
    });
  }

  return drivers.sort((a, b) => b.impact - a.impact);
}

function buildRemediationQueue({ insights = [], tasks = [] } = {}) {
  const openTasks = Array.isArray(tasks)
    ? tasks.filter((t) => !includesAny(t?.status || '', ['done', 'closed', 'cancelled']))
    : [];

  const queue = [];
  for (const item of insights.slice(0, 30)) {
    const matchedTask = openTasks.find((t) =>
      norm(t?.opco) === norm(item?.opco) &&
      (
        includesAny(t?.module || '', ['data', 'sovereignty', 'security']) ||
        includesAny(t?.title || t?.name || '', ['data', 'sovereignty', 'residency', 'cross-border'])
      )
    );

    const status = matchedTask?.status || 'open';
    const dueDate = matchedTask?.dueDate || matchedTask?.due || null;
    const isCritical = norm(item.severity) === 'critical';
    const escalationState = isCritical && status !== 'done' ? 'pending' : 'none';

    queue.push({
      id: `rem-${norm(item.opco || 'unknown')}-${norm(item.model || 'model')}-${norm(item.hostRegion || 'region')}`.replace(/[^a-z0-9-]+/g, '-'),
      opco: item.opco || 'Unknown OpCo',
      owner: matchedTask?.assignee || matchedTask?.assignedTo || 'Data Security team',
      accountableExecutive: 'CISO',
      status,
      dueDate,
      slaHours: isCritical ? 72 : 120,
      severity: normalizeSeverity(item.severity),
      risk: item.risk,
      blocker: matchedTask?.blocker || null,
      exception: {
        status: 'none',
        expiresAt: null,
        compensatingControl: null,
      },
      escalation: escalationState,
    });
  }

  return queue.slice(0, 20);
}

function deriveSourceCoverage({ aiModelUsage, sovereigntyChecks, onboardingRows, tasks }) {
  const inventoryConfigured = Array.isArray(aiModelUsage) && aiModelUsage.length > 0;
  const checksAvailable = Array.isArray(sovereigntyChecks) && sovereigntyChecks.length > 0;
  const onboardingCoverage = Array.isArray(onboardingRows) && onboardingRows.length > 0;
  const tasksAvailable = Array.isArray(tasks);

  const coverageRatio = safeDiv(
    [inventoryConfigured, checksAvailable, onboardingCoverage, tasksAvailable].filter(Boolean).length,
    4,
  );

  return {
    ratio: Number(coverageRatio.toFixed(2)),
    systems: {
      modelInventory: inventoryConfigured ? 'configured' : 'unconfigured',
      sovereigntyChecks: checksAvailable ? 'available' : 'missing',
      onboarding: onboardingCoverage ? 'available' : 'missing',
      tasks: tasksAvailable ? 'available' : 'missing',
    },
  };
}

function computeOverallScore(drivers = [], sourceCoverage = { ratio: 0 }) {
  const aggregateRisk = drivers.length === 0
    ? 0
    : Math.round(drivers.reduce((sum, d) => sum + Number(d.impact || 0), 0) / drivers.length);
  const confidencePenalty = Math.round((1 - Number(sourceCoverage?.ratio || 0)) * 30);
  const score = clamp(100 - aggregateRisk - confidencePenalty, 0, 100);
  return score;
}

function bandForScore(score) {
  if (score >= 90) return 'healthy';
  if (score >= 75) return 'compliant';
  if (score >= 50) return 'developing';
  return 'critical';
}

function reliabilityForCoverage(ratio) {
  if (ratio >= 0.85) return 'high';
  if (ratio >= 0.6) return 'medium';
  return 'low';
}

export function buildDataComplianceInsights({
  onboardingRows = [],
  aiModelUsage = [],
  sovereigntyChecks = [],
  selectedOpco = '',
}) {
  const selected = norm(selectedOpco);
  const insights = [];
  const inventoryConfigured = Array.isArray(aiModelUsage) && aiModelUsage.length > 0;
  const modelCatalog = inventoryConfigured ? aiModelUsage : [];

  for (const row of onboardingRows || []) {
    if (selected && norm(row?.opco) !== selected) continue;
    const jurisdiction = detectJurisdictionFromLocations(Array.isArray(row?.locations) ? row.locations : []);
    const sectors = Array.isArray(row?.sectorOfOperations) ? row.sectorOfOperations : [];

    if (!inventoryConfigured) {
      insights.push({
        opco: row?.opco || 'Unknown OpCo',
        parent: row?.parent || '—',
        jurisdiction,
        sectors,
        model: 'Inventory unconfigured',
        application: 'Unknown',
        hostRegion: 'Unknown',
        severity: 'High',
        regulation: 'Model inventory configuration required',
        risk: `AI model inventory is not configured for ${row?.opco || 'this OpCo'}, cross-border transfer posture is untrusted.`,
        source: 'system',
        inventoryStatus: 'unconfigured',
      });
      continue;
    }

    for (const model of modelCatalog) {
      if (!model?.dataLeavesJurisdiction) continue;
      const matchingCheck = sovereigntyChecks.find((c) =>
        includesAny(c.jurisdiction || '', [jurisdiction, 'GCC']) &&
        includesAny(c.name || '', ['data', 'localisation', 'cross-border'])
      );
      insights.push({
        opco: row?.opco || 'Unknown OpCo',
        parent: row?.parent || '—',
        jurisdiction,
        sectors,
        model: model.model || 'Unknown model',
        application: model.app || 'Unknown application',
        hostRegion: model.hostRegion || 'Unknown',
        severity: normalizeSeverity(matchingCheck?.severity || 'High'),
        regulation: matchingCheck?.regulation || 'Data residency requirements',
        risk: `${model.model || 'Model'} for ${model.app || 'application'} may transfer ${jurisdiction} operational data to ${model.hostRegion || 'Unknown region'}.`,
        source: 'deterministic',
        inventoryStatus: 'configured',
      });
    }
  }

  return insights;
}

export function computeDataComplianceDetail({
  onboardingRows = [],
  aiModelUsage = [],
  sovereigntyChecks = [],
  tasks = [],
  selectedOpco = '',
} = {}) {
  const insights = buildDataComplianceInsights({
    onboardingRows,
    aiModelUsage,
    sovereigntyChecks,
    selectedOpco,
  });

  const sourceCoverage = deriveSourceCoverage({
    aiModelUsage,
    sovereigntyChecks,
    onboardingRows,
    tasks,
  });
  const riskDrivers = buildRiskDrivers(insights);
  const remediationQueue = buildRemediationQueue({ insights, tasks });
  const overallScore = computeOverallScore(riskDrivers, sourceCoverage);
  const confidence = clamp(Math.round(sourceCoverage.ratio * 100), 0, 100);

  return {
    modelVersion: 'dc-v1',
    contractVersion: '1.0',
    overallScore,
    band: bandForScore(overallScore),
    confidence,
    reliability: reliabilityForCoverage(sourceCoverage.ratio),
    trend: 'stable',
    lastComputedAt: new Date().toISOString(),
    riskDrivers: riskDrivers.slice(0, 12),
    aiTransferRisks: insights.slice(0, 30),
    remediationQueue,
    sourceCoverage: {
      ...sourceCoverage,
      // Model inventory is mandatory for trusted cross-border posture reporting.
      trusted: sourceCoverage.ratio >= 0.6 && Array.isArray(aiModelUsage) && aiModelUsage.length > 0,
    },
    governance: {
      escalationRequired: remediationQueue.filter((r) => r.escalation === 'pending').length,
      openExceptions: remediationQueue.filter((r) => r.exception?.status !== 'none').length,
      raci: {
        ownerRole: 'Data Security team',
        accountableRole: 'CISO',
        consultedRole: 'CDO',
        informedRole: 'Board Risk Committee',
      },
    },
  };
}
