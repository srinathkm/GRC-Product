import { Router } from 'express';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { FRAMEWORKS } from '../constants.js';
import { lookupChangesForFramework } from '../services/ai.js';
import { createChatCompletion, isLlmConfigured } from '../services/llm.js';
import { runFeed, getFeedMeta } from '../services/regulatoryFeed.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dirname, '../data/changes.json');
const companiesPath = join(__dirname, '../data/companies.json');
const onboardingPath = join(__dirname, '../data/onboarding-opcos.json');

/** Build company name -> parent name for a framework from companies.json + onboarding. Onboarding entries are applied to every framework so Impact can show onboarded OpCos for any selected framework. */
function buildCompanyToParent(companiesByFramework, onboardingOpcos = []) {
  const byFramework = {};
  for (const fw of FRAMEWORKS) {
    const map = {};
    const parents = companiesByFramework[fw];
    if (Array.isArray(parents)) {
      for (const { parent, companies } of parents) {
        for (const co of companies || []) {
          if (co) map[co] = parent;
        }
      }
    }
    for (const { parent, opco } of onboardingOpcos) {
      if (parent && opco) {
        const name = typeof opco === 'string' ? opco.trim() : '';
        if (name) map[name] = parent;
      }
    }
    byFramework[fw] = map;
  }
  return byFramework;
}

/** Get all OpCo names from companies.json and onboarding (so LLM can return onboarded OpCos). */
function getAllOpcoNames(companiesByFramework, onboardingOpcos = []) {
  const set = new Set();
  for (const entries of Object.values(companiesByFramework || {})) {
    if (!Array.isArray(entries)) continue;
    for (const { companies } of entries) {
      for (const name of companies || []) {
        if (name) set.add(name);
      }
    }
  }
  for (const { opco } of onboardingOpcos) {
    const name = typeof opco === 'string' ? opco.trim() : '';
    if (name) set.add(name);
  }
  return Array.from(set).sort();
}

/** Resolve parent from map with case-insensitive opco match. */
function getParentForOpco(map, opcoName) {
  if (!opcoName || !map) return undefined;
  const key = typeof opcoName === 'string' ? opcoName.trim() : '';
  if (map[key]) return map[key];
  const lower = key.toLowerCase();
  const found = Object.keys(map).find((k) => k.toLowerCase() === lower);
  return found ? map[found] : undefined;
}

/**
 * Build per-framework list of onboarded (opco, parent) where the onboarding record has that framework
 * in applicableFrameworks or applicableFrameworksByLocation. Used so Impact shows onboarded OpCos
 * for frameworks that have no companies.json entry (e.g. BHB Sustainability ESG).
 */
function buildOnboardingOpcosByFramework(onboardingOpcos = []) {
  const byFramework = {};
  for (const entry of onboardingOpcos) {
    const parent = entry.parent && typeof entry.parent === 'string' ? entry.parent.trim() : '';
    const opco = entry.opco && typeof entry.opco === 'string' ? entry.opco.trim() : '';
    if (!parent || !opco) continue;
    const frameworks = new Set();
    if (entry.framework && entry.framework !== 'Onboarded') frameworks.add(entry.framework);
    const applic = entry.applicableFrameworks;
    if (Array.isArray(applic)) applic.forEach((f) => f && frameworks.add(f));
    const byLoc = entry.applicableFrameworksByLocation;
    if (Array.isArray(byLoc)) {
      for (const p of byLoc) {
        const f = p && typeof p === 'object' && p.framework ? p.framework : null;
        if (f) frameworks.add(f);
      }
    }
    for (const fw of frameworks) {
      if (!byFramework[fw]) byFramework[fw] = [];
      byFramework[fw].push({ parent, opco });
    }
  }
  return byFramework;
}

/**
 * Use LLM to infer which OpCos (from the given list) are affected by each change that has no affectedCompanies.
 * Returns a Map of changeId -> string[] (OpCo names). Only includes names that are in opcoNamesList.
 */
async function inferAffectedOpcosWithLlm(changesNeedingInference, opcoNamesList) {
  if (!isLlmConfigured() || changesNeedingInference.length === 0 || opcoNamesList.length === 0) {
    return new Map();
  }
  const opcoListStr = opcoNamesList.slice(0, 300).map((n) => `"${n}"`).join(', ');
  const changesPayload = changesNeedingInference
    .map((c) => `ID: ${c.id}\nTitle: ${c.title}\nFramework: ${c.framework}\nSummary: ${(c.snippet || c.fullText || '').slice(0, 400)}`)
    .join('\n---\n');
  const prompt = `You are a compliance analyst. For each regulatory change below, identify which organisations (OpCos) from the given list are likely to be affected by that change. Use only the exact names from the list.

List of OpCo names (use only these exact strings):\n${opcoListStr}

Regulatory changes:\n${changesPayload}

Return a JSON object where each key is the change ID and each value is an array of OpCo names from the list that are affected by that change. Example: {"change-id-1": ["OpCo A", "OpCo B"], "change-id-2": []}. If no OpCos are clearly affected, use an empty array for that ID. Reply with only the JSON object.`;

  try {
    const completion = await createChatCompletion({
      messages: [
        { role: 'system', content: 'You respond only with a valid JSON object. No markdown, no explanation.' },
        { role: 'user', content: prompt },
      ],
      maxTokens: 2000,
      responseFormat: 'json',
    });
    const text = completion.choices?.[0]?.message?.content?.trim() || '{}';
    const jsonStr = text.replace(/^```json?\s*|\s*```$/g, '').trim();
    const obj = JSON.parse(jsonStr);
    const opcoLowerToCanonical = new Map();
    for (const n of opcoNamesList) {
      if (n && typeof n === 'string') opcoLowerToCanonical.set(n.toLowerCase().trim(), n);
    }
    const map = new Map();
    for (const [changeId, arr] of Object.entries(obj)) {
      if (!Array.isArray(arr)) continue;
      const valid = [];
      for (const name of arr) {
        const key = typeof name === 'string' ? name.trim().toLowerCase() : '';
        const canonical = key ? opcoLowerToCanonical.get(key) : undefined;
        if (canonical && !valid.includes(canonical)) valid.push(canonical);
      }
      map.set(changeId, valid);
    }
    return map;
  } catch (e) {
    console.warn('inferAffectedOpcosWithLlm:', e.message || e);
    return new Map();
  }
}

/** Enrich each change with affectedParents: [{ parent, opcosCount, companies }] using company→parent map and onboarding-by-framework so onboarded OpCos (e.g. BHB ESG) show in Impact. */
function enrichChangesWithAffectedParents(data, companyToParentByFramework, onboardingOpcosByFramework = {}) {
  return data.map((c) => {
    const map = companyToParentByFramework[c.framework] || {};
    const byParent = {};
    for (const co of c.affectedCompanies || []) {
      const parent = getParentForOpco(map, co);
      if (parent) {
        if (!byParent[parent]) byParent[parent] = [];
        byParent[parent].push(co);
      }
    }
    // Include onboarded OpCos that have this change's framework in their applicable list (so e.g. BHB ESG shows DummyFactory LLC).
    const onboardingForFw = onboardingOpcosByFramework[c.framework];
    if (Array.isArray(onboardingForFw)) {
      for (const { parent, opco } of onboardingForFw) {
        if (!byParent[parent]) byParent[parent] = [];
        const already = byParent[parent].some(
          (name) => String(name).toLowerCase().trim() === String(opco).toLowerCase().trim()
        );
        if (!already) byParent[parent].push(opco);
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

  // Always enforce primary time-period filter on the base dataset.
    data = data.filter((c) => isWithinLastNDays(c.date, days));

    if (from) data = data.filter((c) => new Date(c.date) >= from);
    if (to) data = data.filter((c) => new Date(c.date) <= to);

    // Use app LLM to look up changes for the selected framework and time period when lookup=1
    if (useLookup && framework && FRAMEWORKS.includes(framework) && isLlmConfigured()) {
      const lookedUp = await lookupChangesForFramework(framework, days);
    // Enforce strict time-period filter on LLM results as well.
    const timeFiltered = lookedUp.filter((c) => isWithinLastNDays(c.date, days));
    const existingIds = new Set(data.map((c) => c.id));
    const newOnes = timeFiltered.filter((c) => !existingIds.has(c.id));
    data = [...data, ...newOnes];
    }

    if (useLookup && (!framework || framework === '') && isLlmConfigured()) {
      const allFrameworks = FRAMEWORKS;
      for (const fw of allFrameworks) {
        const lookedUp = await lookupChangesForFramework(fw, days);
      // Enforce strict time-period filter on LLM results per framework.
      const timeFiltered = lookedUp.filter((c) => isWithinLastNDays(c.date, days));
      const existingIds = new Set(data.map((c) => c.id));
      for (const c of timeFiltered) {
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

    let onboardingOpcos = [];
    try {
      const onboardingRaw = await readFile(onboardingPath, 'utf-8');
      const parsed = JSON.parse(onboardingRaw);
      onboardingOpcos = Array.isArray(parsed) ? parsed : [];
    } catch (_) {}

    const companyToParentByFramework = buildCompanyToParent(companiesByFramework, onboardingOpcos);
    const onboardingOpcosByFramework = buildOnboardingOpcosByFramework(onboardingOpcos);

    const allOpcoNames = getAllOpcoNames(companiesByFramework, onboardingOpcos);
    const changesNeedingInference = data.filter(
      (c) => !c.affectedCompanies || c.affectedCompanies.length === 0
    );
    if (changesNeedingInference.length > 0 && allOpcoNames.length > 0) {
      const inferredMap = await inferAffectedOpcosWithLlm(changesNeedingInference, allOpcoNames);
      for (const c of data) {
        const inferred = inferredMap.get(c.id);
        if (
          inferred != null &&
          (!c.affectedCompanies || c.affectedCompanies.length === 0)
        ) {
          c.affectedCompanies = inferred;
        }
      }
    }

    data = enrichChangesWithAffectedParents(data, companyToParentByFramework, onboardingOpcosByFramework);

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** GET /api/changes/opco-alerts?days=30&lookup=1
 * Returns, for each OpCo, the frameworks that have recent changes and the list of those changes.
 * Uses the same date normalisation and optional LLM lookup/inference logic as the main /api/changes route,
 * but aggregates results by OpCo instead of returning individual change rows.
 */
changesRouter.get('/opco-alerts', async (req, res) => {
  try {
    const raw = await readFile(dataPath, 'utf-8');
    let data = normalizeDatesForDemo(JSON.parse(raw));
    const days = parseDays(req.query.days);
    const useLookup = req.query.lookup === '1' || req.query.lookup === 'true';

    // Filter to last N days
    data = data.filter((c) => isWithinLastNDays(c.date, days));

    // Optionally ask the app LLM to look up additional changes per framework (same as /api/changes with lookup=1, but across all frameworks).
    if (useLookup && isLlmConfigured()) {
      const existingIds = new Set(data.map((c) => c.id));
      for (const fw of FRAMEWORKS) {
        const lookedUp = await lookupChangesForFramework(fw, days);
      // Enforce strict time-period filter for LLM results here as well.
      const timeFiltered = lookedUp.filter((c) => isWithinLastNDays(c.date, days));
      for (const c of timeFiltered) {
          if (!existingIds.has(c.id)) {
            data.push(c);
            existingIds.add(c.id);
          }
        }
      }
    }

    // Newest first
    data.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Load company/opco universe so the LLM can infer affected OpCos where missing.
    let companiesByFramework = {};
    try {
      const companiesRaw = await readFile(companiesPath, 'utf-8');
      companiesByFramework = JSON.parse(companiesRaw);
    } catch (_) {}

    let onboardingOpcos = [];
    try {
      const onboardingRaw = await readFile(onboardingPath, 'utf-8');
      const parsed = JSON.parse(onboardingRaw);
      onboardingOpcos = Array.isArray(parsed) ? parsed : [];
    } catch (_) {}

    const allOpcoNames = getAllOpcoNames(companiesByFramework, onboardingOpcos);
    const changesNeedingInference = data.filter(
      (c) => !c.affectedCompanies || c.affectedCompanies.length === 0,
    );
    if (changesNeedingInference.length > 0 && allOpcoNames.length > 0) {
      const inferredMap = await inferAffectedOpcosWithLlm(
        changesNeedingInference,
        allOpcoNames,
      );
      for (const c of data) {
        const inferred = inferredMap.get(c.id);
        if (
          inferred != null &&
          (!c.affectedCompanies || c.affectedCompanies.length === 0)
        ) {
          c.affectedCompanies = inferred;
        }
      }
    }

    // Build { opco -> { frameworks: { framework -> [changes] } } }.
    const alertsByOpco = new Map();
    for (const c of data) {
      const fw = c.framework || 'Unknown framework';
      const companies = Array.isArray(c.affectedCompanies)
        ? c.affectedCompanies
        : [];
      if (!companies.length) continue;
      const changeSummary = {
        id: c.id,
        title: c.title,
        date: c.date,
        category: c.category || '',
        deadline: c.deadline || '',
        framework: fw,
      };
      for (const rawName of companies) {
        const name =
          typeof rawName === 'string' ? rawName.trim() : String(rawName || '');
        if (!name) continue;
        let opcoEntry = alertsByOpco.get(name);
        if (!opcoEntry) {
          opcoEntry = {
            opco: name,
            frameworks: {},
          };
          alertsByOpco.set(name, opcoEntry);
        }
        if (!opcoEntry.frameworks[fw]) {
          opcoEntry.frameworks[fw] = { framework: fw, changes: [] };
        }
        opcoEntry.frameworks[fw].changes.push(changeSummary);
      }
    }

    const result = Array.from(alertsByOpco.values()).map((entry) => {
      const frameworks = Object.values(entry.frameworks).map((fw) => ({
        framework: fw.framework,
        changesCount: fw.changes.length,
        changes: fw.changes,
      }));
      const totalChanges = frameworks.reduce(
        (sum, fw) => sum + fw.changes.length,
        0,
      );
      return {
        opco: entry.opco,
        frameworks,
        totalFrameworks: frameworks.length,
        totalChanges,
      };
    });

    // Optional filters by OpCo name (case-insensitive, tolerant of minor label differences).
    const filterOpco =
      typeof req.query.opco === 'string' ? req.query.opco.trim() : '';
    let filtered = result;
    if (filterOpco) {
      const wanted = filterOpco.toLowerCase();
      filtered = result.filter((row) => {
        const name = String(row.opco || '').trim().toLowerCase();
        if (!name) return false;
        return (
          name === wanted ||
          name.includes(wanted) ||
          wanted.includes(name)
        );
      });
    }

    res.json(filtered);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** GET /summary?days=30 — summary of changes per framework in the last N days (for Governance Framework Summary cards).
 * Returns: { [framework]: { count: number, criticalCount: number, hasCritical: boolean } }
 * "critical" means the change has a deadline within the next 90 days (including overdue items).
 */
changesRouter.get('/summary', async (req, res) => {
  try {
    const raw = await readFile(dataPath, 'utf-8');
    let data = normalizeDatesForDemo(JSON.parse(raw));
    const days = parseDays(req.query.days) || 30;
    data = data.filter((c) => isWithinLastNDays(c.date, days));
    const summary = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const c of data) {
      const fw = c.framework || 'Other';
      if (!summary[fw]) {
        summary[fw] = { count: 0, criticalCount: 0, hasCritical: false };
      }
      summary[fw].count += 1;
      if (c.deadline) {
        const d = new Date(c.deadline);
        if (!Number.isNaN(d.getTime())) {
          d.setHours(0, 0, 0, 0);
          const daysLeft = Math.ceil((d - today) / (24 * 60 * 60 * 1000));
          if (daysLeft <= 90) {
            summary[fw].criticalCount += 1;
            summary[fw].hasCritical = true;
          }
        }
      }
    }
    res.json(summary);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/changes/refresh — manually trigger a regulatory feed refresh. */
changesRouter.post('/refresh', async (req, res) => {
  try {
    const result = await runFeed();
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** GET /api/changes/feed-meta — metadata about the last scheduled feed run. */
changesRouter.get('/feed-meta', async (req, res) => {
  try {
    const meta = await getFeedMeta();
    res.json(meta || { lastRun: null, message: 'No feed run recorded yet.' });
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
