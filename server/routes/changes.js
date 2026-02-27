import { Router } from 'express';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { FRAMEWORKS } from '../constants.js';
import { lookupChangesForFramework } from '../services/ai.js';
import { isLlmConfigured } from '../services/llm.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dirname, '../data/changes.json');
const companiesPath = join(__dirname, '../data/companies.json');

/** Build company name -> parent name for a framework from companies.json structure. */
function buildCompanyToParent(companiesByFramework) {
  const byFramework = {};
  for (const [framework, parents] of Object.entries(companiesByFramework || {})) {
    const map = {};
    for (const { parent, companies } of parents || []) {
      for (const co of companies || []) {
        map[co] = parent;
      }
    }
    byFramework[framework] = map;
  }
  return byFramework;
}

/** Enrich each change with affectedParents: [{ parent, opcosCount, companies }] using company→parent map. */
function enrichChangesWithAffectedParents(data, companyToParentByFramework) {
  return data.map((c) => {
    const map = companyToParentByFramework[c.framework] || {};
    const byParent = {};
    for (const co of c.affectedCompanies || []) {
      const parent = map[co];
      if (parent) {
        if (!byParent[parent]) byParent[parent] = [];
        byParent[parent].push(co);
      }
    }
    const affectedParents = Object.entries(byParent).map(([parent, companies]) => ({
      parent,
      opcosCount: companies.length,
      companies,
    }));
    return { ...c, affectedParents };
  });
}

/** Shift mock data so all dates fall within the last 365 days (so period filter returns results). */
function normalizeDatesForDemo(data) {
  if (!Array.isArray(data) || data.length === 0) return data;
  const now = new Date();
  const latest = new Date(Math.max(...data.map((c) => new Date(c.date).getTime())));
  const oneDayMs = 24 * 60 * 60 * 1000;
  const daysAgo = (now.getTime() - latest.getTime()) / oneDayMs;
  if (daysAgo <= 1) return data;
  const shiftDays = Math.min(Math.floor(daysAgo) - 1, 365);
  return data.map((c) => {
    const d = new Date(c.date);
    d.setDate(d.getDate() + shiftDays);
    return { ...c, date: d.toISOString().slice(0, 10) };
  });
}

function parseQueryDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

const DEFAULT_DAYS = 30;
const ALLOWED_DAYS = [30, 180, 365];

function parseDays(value) {
  const n = parseInt(value, 10);
  return ALLOWED_DAYS.includes(n) ? n : DEFAULT_DAYS;
}

function isWithinLastNDays(dateStr, days) {
  const d = new Date(dateStr);
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  return d >= from && d <= now;
}

export const changesRouter = Router();

changesRouter.get('/', async (req, res) => {
  try {
    const raw = await readFile(dataPath, 'utf-8');
    let data = normalizeDatesForDemo(JSON.parse(raw));
    const framework = req.query.framework;
    const days = parseDays(req.query.days);
    const useLookup = req.query.lookup === '1' || req.query.lookup === 'true';
    const from = parseQueryDate(req.query.from);
    const to = parseQueryDate(req.query.to);

    if (framework && FRAMEWORKS.includes(framework)) {
      data = data.filter((c) => c.framework === framework);
    } else if (framework && !FRAMEWORKS.includes(framework)) {
      return res.json([]);
    }

    data = data.filter((c) => isWithinLastNDays(c.date, days));

    if (from) data = data.filter((c) => new Date(c.date) >= from);
    if (to) data = data.filter((c) => new Date(c.date) <= to);

    if (useLookup && framework && FRAMEWORKS.includes(framework) && isLlmConfigured()) {
      const lookedUp = await lookupChangesForFramework(framework, days);
      const existingIds = new Set(data.map((c) => c.id));
      const newOnes = lookedUp.filter((c) => !existingIds.has(c.id));
      data = [...data, ...newOnes];
    }

    if (useLookup && (!framework || framework === '') && isLlmConfigured()) {
      const allFrameworks = FRAMEWORKS;
      for (const fw of allFrameworks) {
        const lookedUp = await lookupChangesForFramework(fw, days);
        const existingIds = new Set(data.map((c) => c.id));
        for (const c of lookedUp) {
          if (!existingIds.has(c.id)) {
            data.push(c);
            existingIds.add(c.id);
          }
        }
      }
    }

    data.sort((a, b) => new Date(b.date) - new Date(a.date));

    let companiesByFramework = {};
    try {
      const companiesRaw = await readFile(companiesPath, 'utf-8');
      companiesByFramework = JSON.parse(companiesRaw);
    } catch (_) {}
    const companyToParentByFramework = buildCompanyToParent(companiesByFramework);
    data = enrichChangesWithAffectedParents(data, companyToParentByFramework);

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

changesRouter.get('/:id', async (req, res) => {
  try {
    const raw = await readFile(dataPath, 'utf-8');
    const data = JSON.parse(raw);
    const item = data.find((c) => c.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Change not found' });
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
