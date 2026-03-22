/**
 * ESG Module API
 *
 * Provides live ESG metric storage, scoring, framework compliance tracking,
 * and reporting for GCC organisations.
 *
 * Scoring methodology (server-computed, not hard-coded):
 *   Environmental (E): Carbon intensity, Renewable energy, Water, Waste, Green building
 *   Social (S): Nationalisation, Gender diversity, Training, Safety, Community, Satisfaction
 *   Governance (G): Board independence, Board diversity, Policies, Transparency
 *   Overall = weighted average of E / S / G (default 33 / 33 / 34)
 *
 * Routes:
 *   GET  /api/esg/metrics              – list metrics (filter by parent, opco, period)
 *   POST /api/esg/metrics              – save / update metrics for entity+period
 *   GET  /api/esg/scores               – compute scores for all OpCos under a parent
 *   GET  /api/esg/periods              – list periods that have data
 *   GET  /api/esg/framework-status     – GCC regulatory framework compliance status
 *   POST /api/esg/framework-status     – update framework compliance status
 *   GET  /api/esg/summary              – aggregated group summary (for M&A / dashboards)
 */

import { Router } from 'express';
import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '../data/esg-metrics.json');

async function readData() {
  try {
    const raw = await readFile(DATA_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      metrics: parsed.metrics || {},
      frameworkStatus: parsed.frameworkStatus || {},
      targets: parsed.targets || {},
    };
  } catch {
    return { metrics: {}, frameworkStatus: {}, targets: {} };
  }
}

async function writeData(data) {
  await writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function metricsKey(parent, opco, period) {
  return `${parent || ''}::${opco || ''}::${period || ''}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORING ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Environmental score from live metric data.
 * Returns { score: 0-100, completeness: 0-100, breakdown: {} }
 */
function computeEnvScore(env = {}) {
  const components = [];
  const breakdown = {};

  // 1. Carbon intensity: Scope 1+2 per FTE (30 pts max)
  const employees = env.totalEmployees || 1;
  const s1 = env.scope1Emissions;
  const s2 = env.scope2Emissions;
  if (s1 != null || s2 != null) {
    const totalCarbon = (s1 || 0) + (s2 || 0);
    const intensity = totalCarbon / Math.max(employees, 1);
    const s =
      intensity === 0 ? 100
      : intensity < 2 ? 95
      : intensity < 5 ? 82
      : intensity < 10 ? 65
      : intensity < 20 ? 48
      : intensity < 50 ? 30
      : 12;
    components.push({ name: 'Carbon intensity', score: s, weight: 30 });
    breakdown.carbonIntensity = { value: intensity.toFixed(2), unit: 'tCO₂e/FTE', score: s };
  }

  // 2. Renewable energy %: direct score (25 pts max)
  if (env.renewableEnergyPct != null) {
    const s = Math.min(100, Math.max(0, env.renewableEnergyPct));
    components.push({ name: 'Renewable energy', score: s, weight: 25 });
    breakdown.renewableEnergy = { value: env.renewableEnergyPct, unit: '%', score: s };
  }

  // 3. Water intensity: m³/FTE (15 pts max)
  if (env.waterConsumption != null) {
    const wi = env.waterConsumption / Math.max(employees, 1);
    const s =
      wi < 5 ? 100
      : wi < 15 ? 82
      : wi < 30 ? 62
      : wi < 60 ? 42
      : 20;
    components.push({ name: 'Water intensity', score: s, weight: 15 });
    breakdown.waterIntensity = { value: wi.toFixed(1), unit: 'm³/FTE', score: s };
  }

  // 4. Waste diversion from landfill % (15 pts max)
  if (env.wasteDiversionPct != null) {
    const s = Math.min(100, Math.max(0, env.wasteDiversionPct));
    components.push({ name: 'Waste diversion', score: s, weight: 15 });
    breakdown.wasteDiversion = { value: env.wasteDiversionPct, unit: '%', score: s };
  }

  // 5. Green building certification (10 pts max)
  if (env.greenBuildingCertified != null) {
    const s = env.greenBuildingCertified ? 100 : 20;
    components.push({ name: 'Green building', score: s, weight: 10 });
    breakdown.greenBuilding = { value: env.greenBuildingCertified ? 'Yes' : 'No', score: s };
  }

  // 6. Scope 3 disclosed (5 pts max — transparency credit)
  if (env.scope3Emissions != null) {
    components.push({ name: 'Scope 3 disclosure', score: 100, weight: 5 });
    breakdown.scope3 = { value: env.scope3Emissions, unit: 'tCO₂e', score: 100 };
  }

  if (components.length === 0) return { score: 0, completeness: 0, breakdown };
  const maxWeight = 30 + 25 + 15 + 15 + 10 + 5;
  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  const weightedScore = components.reduce((s, c) => s + c.score * c.weight, 0) / totalWeight;
  return {
    score: Math.round(weightedScore),
    completeness: Math.round((totalWeight / maxWeight) * 100),
    breakdown,
  };
}

/**
 * Social score from live metric data.
 * GCC-specific: UAE Emiratisation and KSA Saudisation are primary compliance drivers.
 */
function computeSocialScore(social = {}) {
  const components = [];
  const breakdown = {};

  // 1. Nationalisation compliance: UAE Emiratisation or KSA Saudisation (25 pts max)
  if (social.emiratizationPct != null) {
    // UAE private sector target: 2% annually; financial sector 10% by 2026
    const target = social.emiratizationTarget || 2;
    const ratio = Math.min(social.emiratizationPct / target, 1.5); // cap at 150%
    const s = ratio >= 1 ? 100 : ratio >= 0.8 ? 80 : ratio >= 0.6 ? 60 : ratio >= 0.4 ? 40 : 20;
    components.push({ name: 'Emiratisation', score: s, weight: 25 });
    breakdown.emiratization = { value: social.emiratizationPct, unit: '%', target, score: s };
  } else if (social.saudizationPct != null) {
    const target = social.saudizationTarget || 30;
    const ratio = Math.min(social.saudizationPct / target, 1.5);
    const s = ratio >= 1 ? 100 : ratio >= 0.8 ? 80 : ratio >= 0.6 ? 60 : ratio >= 0.4 ? 40 : 20;
    components.push({ name: 'Saudisation', score: s, weight: 25 });
    breakdown.saudization = { value: social.saudizationPct, unit: '%', target, score: s };
  }

  // 2. Gender diversity — % female employees (20 pts max)
  if (social.genderDiversityPct != null) {
    const pct = social.genderDiversityPct;
    const s = pct >= 40 ? 100 : pct >= 30 ? 82 : pct >= 20 ? 62 : pct >= 10 ? 42 : 20;
    components.push({ name: 'Gender diversity', score: s, weight: 20 });
    breakdown.genderDiversity = { value: pct, unit: '% female', score: s };
  }

  // 3. Training hours per employee per year (15 pts max)
  if (social.trainingHoursPerEmployee != null) {
    const h = social.trainingHoursPerEmployee;
    const s = h >= 40 ? 100 : h >= 30 ? 82 : h >= 20 ? 62 : h >= 10 ? 42 : 20;
    components.push({ name: 'Training hours', score: s, weight: 15 });
    breakdown.training = { value: h, unit: 'hrs/FTE/yr', score: s };
  }

  // 4. Workplace safety — LTIR (Lost Time Incident Rate per million hours) (20 pts max)
  if (social.ltir != null) {
    const s = social.ltir === 0 ? 100 : social.ltir < 0.5 ? 85 : social.ltir < 1.0 ? 68 : social.ltir < 2.0 ? 48 : 20;
    components.push({ name: 'Workplace safety', score: s, weight: 20 });
    breakdown.safety = { value: social.ltir, unit: 'LTIR', score: s };
  }

  // 5. Community investment as % of net revenue (10 pts max)
  if (social.communityInvestmentRevenuePct != null) {
    const pct = social.communityInvestmentRevenuePct;
    const s = pct >= 1 ? 100 : pct >= 0.5 ? 75 : pct >= 0.1 ? 50 : pct > 0 ? 25 : 0;
    components.push({ name: 'Community investment', score: s, weight: 10 });
    breakdown.community = { value: pct, unit: '% revenue', score: s };
  }

  // 6. Employee satisfaction score (10 pts max)
  if (social.employeeSatisfactionScore != null) {
    const s = Math.min(100, Math.max(0, social.employeeSatisfactionScore));
    components.push({ name: 'Employee satisfaction', score: s, weight: 10 });
    breakdown.satisfaction = { value: s, unit: '/100', score: s };
  }

  if (components.length === 0) return { score: 0, completeness: 0, breakdown };
  const maxWeight = 25 + 20 + 15 + 20 + 10 + 10;
  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  const weightedScore = components.reduce((s, c) => s + c.score * c.weight, 0) / totalWeight;
  return {
    score: Math.round(weightedScore),
    completeness: Math.round((totalWeight / maxWeight) * 100),
    breakdown,
  };
}

/**
 * Governance score from live metric data.
 */
function computeGovScore(gov = {}) {
  const components = [];
  const breakdown = {};

  // 1. Board independence % (25 pts max)
  if (gov.independentDirectorsPct != null) {
    const pct = gov.independentDirectorsPct;
    const s = pct >= 75 ? 100 : pct >= 50 ? 82 : pct >= 33 ? 62 : pct >= 25 ? 42 : 20;
    components.push({ name: 'Board independence', score: s, weight: 25 });
    breakdown.boardIndependence = { value: pct, unit: '% independent', score: s };
  }

  // 2. Female board members % (15 pts max)
  if (gov.femaleBoardMembersPct != null) {
    const pct = gov.femaleBoardMembersPct;
    const s = pct >= 30 ? 100 : pct >= 20 ? 78 : pct >= 10 ? 55 : pct > 0 ? 30 : 10;
    components.push({ name: 'Board diversity', score: s, weight: 15 });
    breakdown.boardDiversity = { value: pct, unit: '% female', score: s };
  }

  // 3. Policy adoption: 10 pts each — anti-corruption, whistleblower, data privacy (30 pts max)
  const policyFields = [
    { key: 'antiCorruptionPolicy', label: 'Anti-corruption policy' },
    { key: 'whistleblowerMechanism', label: 'Whistleblower mechanism' },
    { key: 'dataPrivacyCertification', label: 'Data privacy certification' },
  ];
  const policyDefined = policyFields.filter(f => gov[f.key] != null);
  if (policyDefined.length > 0) {
    const adopted = policyDefined.filter(f => gov[f.key]).length;
    const s = Math.round((adopted / 3) * 100);
    components.push({ name: 'Policy adoption', score: s, weight: 30 });
    breakdown.policies = {
      score: s,
      items: policyFields.map(f => ({ label: f.label, value: gov[f.key] ?? null })),
    };
  }

  // 4. Transparency: ESG report published + third-party audit (30 pts max, 15 each)
  const transparencyDefined = [gov.esgReportPublished, gov.thirdPartyAudit].filter(v => v != null);
  if (transparencyDefined.length > 0) {
    const points = ((gov.esgReportPublished ? 15 : 0) + (gov.thirdPartyAudit ? 15 : 0));
    const s = Math.round((points / 30) * 100);
    components.push({ name: 'Transparency', score: s, weight: 30 });
    breakdown.transparency = { score: s, esgReportPublished: gov.esgReportPublished, thirdPartyAudit: gov.thirdPartyAudit };
  }

  if (components.length === 0) return { score: 0, completeness: 0, breakdown };
  const maxWeight = 25 + 15 + 30 + 30;
  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  const weightedScore = components.reduce((s, c) => s + c.score * c.weight, 0) / totalWeight;
  return {
    score: Math.round(weightedScore),
    completeness: Math.round((totalWeight / maxWeight) * 100),
    breakdown,
  };
}

function computeOverallScore(envScore, socialScore, govScore, weights = { e: 33, s: 33, g: 34 }) {
  const total = weights.e + weights.s + weights.g;
  return Math.round((envScore * weights.e + socialScore * weights.s + govScore * weights.g) / total);
}

function getEsgRating(score) {
  if (score >= 71) return 'Leading';
  if (score >= 51) return 'Progressing';
  if (score >= 31) return 'Developing';
  return 'Nascent';
}

function computeScoresForRecord(record) {
  const env = computeEnvScore(record.environmental || {});
  const social = computeSocialScore(record.social || {});
  const gov = computeGovScore(record.governance || {});
  const overall = computeOverallScore(env.score, social.score, gov.score);
  const completeness = Math.round((env.completeness + social.completeness + gov.completeness) / 3);
  return {
    env: { score: env.score, completeness: env.completeness, breakdown: env.breakdown },
    social: { score: social.score, completeness: social.completeness, breakdown: social.breakdown },
    gov: { score: gov.score, completeness: gov.completeness, breakdown: gov.breakdown },
    overall,
    rating: getEsgRating(overall),
    completeness,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTER
// ─────────────────────────────────────────────────────────────────────────────
export const esgRouter = Router();

// GET /api/esg/metrics
esgRouter.get('/metrics', async (req, res) => {
  try {
    const { parent, opco, period } = req.query;
    const data = await readData();
    let entries = Object.entries(data.metrics || {});
    if (parent) entries = entries.filter(([k]) => k.startsWith(`${parent}::`));
    if (opco) entries = entries.filter(([k]) => { const [, o] = k.split('::'); return o === opco; });
    if (period) entries = entries.filter(([k]) => k.endsWith(`::${period}`));
    const result = entries.map(([key, record]) => {
      const [p, o, per] = key.split('::');
      return { key, parent: p, opco: o, period: per, ...record, computed: computeScoresForRecord(record) };
    });
    res.json({ metrics: result, total: result.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/esg/metrics
esgRouter.post('/metrics', async (req, res) => {
  try {
    const { parent, opco, period, environmental = {}, social = {}, governance = {}, targets = {} } = req.body || {};
    if (!parent || !opco || !period) return res.status(400).json({ error: 'parent, opco, and period are required' });
    const data = await readData();
    const key = metricsKey(parent, opco, period);
    const existing = data.metrics[key] || {};
    data.metrics[key] = {
      ...existing,
      parent, opco, period,
      environmental: { ...(existing.environmental || {}), ...environmental },
      social: { ...(existing.social || {}), ...social },
      governance: { ...(existing.governance || {}), ...governance },
      targets: { ...(existing.targets || {}), ...targets },
      updatedAt: new Date().toISOString(),
    };
    await writeData(data);
    const computed = computeScoresForRecord(data.metrics[key]);
    res.json({ key, ...data.metrics[key], computed });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/esg/scores?parent=X&period=Y
esgRouter.get('/scores', async (req, res) => {
  try {
    const { parent, period } = req.query;
    const data = await readData();
    const allEntries = Object.entries(data.metrics || {});
    const relevant = allEntries.filter(([k]) => {
      if (parent && !k.startsWith(`${parent}::`)) return false;
      if (period && !k.endsWith(`::${period}`)) return false;
      return true;
    });

    const byOpco = {};
    for (const [key, record] of relevant) {
      const [p, o, per] = key.split('::');
      if (!byOpco[o]) byOpco[o] = [];
      byOpco[o].push({ key, parent: p, period: per, ...record, computed: computeScoresForRecord(record) });
    }

    // Sort each opco's records by period desc
    for (const o of Object.keys(byOpco)) {
      byOpco[o].sort((a, b) => b.period.localeCompare(a.period));
    }

    // Group summary for the parent
    const latestPerOpco = Object.values(byOpco).map(records => records[0]).filter(Boolean);
    const groupEnv = latestPerOpco.length ? Math.round(latestPerOpco.reduce((s, r) => s + r.computed.env.score, 0) / latestPerOpco.length) : 0;
    const groupSocial = latestPerOpco.length ? Math.round(latestPerOpco.reduce((s, r) => s + r.computed.social.score, 0) / latestPerOpco.length) : 0;
    const groupGov = latestPerOpco.length ? Math.round(latestPerOpco.reduce((s, r) => s + r.computed.gov.score, 0) / latestPerOpco.length) : 0;
    const groupOverall = computeOverallScore(groupEnv, groupSocial, groupGov);

    res.json({
      byOpco,
      group: { env: groupEnv, social: groupSocial, gov: groupGov, overall: groupOverall, rating: getEsgRating(groupOverall), opcoCount: latestPerOpco.length },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/esg/periods?parent=X
esgRouter.get('/periods', async (req, res) => {
  try {
    const { parent } = req.query;
    const data = await readData();
    const periods = new Set();
    for (const key of Object.keys(data.metrics || {})) {
      if (parent && !key.startsWith(`${parent}::`)) continue;
      const [, , period] = key.split('::');
      if (period) periods.add(period);
    }
    res.json({ periods: Array.from(periods).sort().reverse() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/esg/framework-status?parent=X
esgRouter.get('/framework-status', async (req, res) => {
  try {
    const { parent } = req.query;
    const data = await readData();
    const allStatus = data.frameworkStatus || {};
    const result = parent
      ? Object.fromEntries(Object.entries(allStatus).filter(([k]) => k.startsWith(`${parent}::`)))
      : allStatus;
    res.json({ frameworkStatus: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/esg/framework-status
esgRouter.post('/framework-status', async (req, res) => {
  try {
    const { parent, framework, status, notes, disclosureYear, lastReviewDate } = req.body || {};
    if (!parent || !framework) return res.status(400).json({ error: 'parent and framework are required' });
    const validStatuses = ['not-started', 'in-progress', 'completed', 'not-applicable'];
    if (status && !validStatuses.includes(status)) return res.status(400).json({ error: 'invalid status' });
    const data = await readData();
    const key = `${parent}::${framework}`;
    data.frameworkStatus[key] = {
      parent, framework,
      status: status || 'not-started',
      notes: notes || '',
      disclosureYear: disclosureYear || '',
      lastReviewDate: lastReviewDate || new Date().toISOString().slice(0, 10),
    };
    await writeData(data);
    res.json(data.frameworkStatus[key]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/esg/summary?parent=X  (for M&A and other dashboards)
esgRouter.get('/summary', async (req, res) => {
  try {
    const { parent } = req.query;
    const data = await readData();
    const allEntries = Object.entries(data.metrics || {});
    const relevant = parent ? allEntries.filter(([k]) => k.startsWith(`${parent}::`)) : allEntries;

    // Get latest record per opco
    const latestByOpco = {};
    for (const [key, record] of relevant) {
      const [, o, per] = key.split('::');
      if (!latestByOpco[o] || per > latestByOpco[o].period) {
        latestByOpco[o] = { ...record, period: per, computed: computeScoresForRecord(record) };
      }
    }

    const opcoSummaries = Object.entries(latestByOpco).map(([opco, r]) => ({
      opco,
      period: r.period,
      env: r.computed.env.score,
      social: r.computed.social.score,
      gov: r.computed.gov.score,
      overall: r.computed.overall,
      rating: r.computed.rating,
      completeness: r.computed.completeness,
    }));

    const frameStatus = parent
      ? Object.values(data.frameworkStatus || {}).filter(f => f.parent === parent)
      : Object.values(data.frameworkStatus || {});

    res.json({ parent: parent || '', opcoSummaries, frameworkStatus: frameStatus });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
