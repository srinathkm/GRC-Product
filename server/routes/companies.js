import { Router } from 'express';
import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { FRAMEWORKS } from '../constants.js';
import { getFrameworksBySectorAndLocation } from './governance.js';
import { logAudit } from '../services/auditService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dirname, '../data/companies.json');
const multiShareholdersPath = join(__dirname, '../data/opco-multi-shareholders.json');
const onboardingPath = join(__dirname, '../data/onboarding-opcos.json');

async function readOnboardingOpcos() {
  try {
    const raw = await readFile(onboardingPath, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export const companiesRouter = Router();

/** GET /api/companies/by-parent?parent=... – OpCos for a given parent (across all frameworks). Returns all (name, framework) pairs. Merges onboarding additions. */
companiesRouter.get('/by-parent', async (req, res) => {
  try {
    const parent = req.query.parent;
    if (!parent || typeof parent !== 'string') {
      return res.json({ parent: '', opcos: [] });
    }
    const raw = await readFile(dataPath, 'utf-8');
    const data = JSON.parse(raw);
    const opcos = [];
    for (const [framework, entries] of Object.entries(data)) {
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (entry.parent !== parent) continue;
        for (const name of entry.companies || []) {
          if (name) opcos.push({ name, framework });
        }
      }
    }
    const onboarding = await readOnboardingOpcos();
    for (const row of onboarding) {
      if (row.parent === parent && row.opco) {
        const item = { name: row.opco, framework: row.framework || 'Onboarded' };
        if (Array.isArray(row.locations) && row.locations.length > 0) item.locations = row.locations;
        if (Array.isArray(row.applicableFrameworks) && row.applicableFrameworks.length > 0) item.applicableFrameworks = row.applicableFrameworks;
        if (Array.isArray(row.applicableFrameworksByLocation) && row.applicableFrameworksByLocation.length > 0) item.applicableFrameworksByLocation = row.applicableFrameworksByLocation;
        opcos.push(item);
      }
    }
    res.json({ parent, opcos });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** GET /api/companies/roles – list of parent holdings and OpCos. Merges onboarding additions (new parents and OpCos). */
companiesRouter.get('/roles', async (req, res) => {
  try {
    const raw = await readFile(dataPath, 'utf-8');
    const data = JSON.parse(raw);
    const parentSet = new Set();
    const opcoSet = new Set();
    for (const framework of Object.keys(data)) {
      const entries = data[framework];
      if (!Array.isArray(entries)) continue;
      for (const { parent, companies } of entries) {
        if (parent) parentSet.add(parent);
        for (const co of companies || []) {
          if (co) opcoSet.add(co);
        }
      }
    }
    const onboarding = await readOnboardingOpcos();
    for (const row of onboarding) {
      if (row.parent) parentSet.add(row.parent);
      if (row.opco) opcoSet.add(row.opco);
    }
    const parents = Array.from(parentSet).sort();
    const opcos = Array.from(opcoSet).sort();
    res.json({ parents, opcos });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

companiesRouter.get('/', async (req, res) => {
  try {
    const framework = req.query.framework;
    if (!framework || !FRAMEWORKS.includes(framework)) {
      return res.status(400).json({ error: 'Valid framework name is required' });
    }
    const raw = await readFile(dataPath, 'utf-8');
    const data = JSON.parse(raw);
    const frameworkData = data[framework];
    const parents = Array.isArray(frameworkData)
      ? frameworkData
      : [];
    res.json({ framework, parents });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** GET /api/companies/parent-opco-counts – list each parent with its total OpCo count (across frameworks). Merges onboarding. */
companiesRouter.get('/parent-opco-counts', async (req, res) => {
  try {
    const raw = await readFile(dataPath, 'utf-8');
    const data = JSON.parse(raw);
    const parentToOpcos = new Map();
    for (const framework of Object.keys(data)) {
      const entries = data[framework];
      if (!Array.isArray(entries)) continue;
      for (const { parent, companies } of entries) {
        if (!parent) continue;
        const set = parentToOpcos.get(parent) || new Set();
        for (const name of companies || []) {
          if (name) set.add(name);
        }
        parentToOpcos.set(parent, set);
      }
    }
    const onboarding = await readOnboardingOpcos();
    for (const row of onboarding) {
      if (row.parent && row.opco) {
        const set = parentToOpcos.get(row.parent) || new Set();
        set.add(row.opco);
        parentToOpcos.set(row.parent, set);
      }
    }
    const parents = Array.from(parentToOpcos.entries())
      .map(([parent, set]) => ({ parent, opcoCount: set.size }))
      .sort((a, b) => b.opcoCount - a.opcoCount);
    res.json({ parents });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** GET /api/companies/all-parent-opcos – map each parent to its OpCos (across all frameworks). Merges onboarding. */
companiesRouter.get('/all-parent-opcos', async (req, res) => {
  try {
    const raw = await readFile(dataPath, 'utf-8');
    const data = JSON.parse(raw);
    const parentToOpcos = new Map();
    for (const framework of Object.keys(data)) {
      const entries = data[framework];
      if (!Array.isArray(entries)) continue;
      for (const { parent, companies } of entries) {
        if (!parent) continue;
        const set = parentToOpcos.get(parent) || new Set();
        for (const name of companies || []) {
          if (name) set.add(name);
        }
        parentToOpcos.set(parent, set);
      }
    }
    const onboarding = await readOnboardingOpcos();
    for (const row of onboarding) {
      if (row.parent && row.opco) {
        const set = parentToOpcos.get(row.parent) || new Set();
        set.add(row.opco);
        parentToOpcos.set(row.parent, set);
      }
    }
    const parentOpcos = {};
    for (const [parent, set] of parentToOpcos.entries()) {
      parentOpcos[parent] = Array.from(set).sort();
    }
    res.json({ parentOpcos });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** GET /api/companies/multi-shareholder-opcos?parent=... – OpCos with 2+ shareholders each ≥25%. Optional parent filter. */
companiesRouter.get('/multi-shareholder-opcos', async (req, res) => {
  try {
    const raw = await readFile(multiShareholdersPath, 'utf-8');
    const list = JSON.parse(raw);
    const filterParent = typeof req.query.parent === 'string' ? req.query.parent.trim() : null;
    const THRESHOLD = 25;
    const result = list.filter((item) => {
      const withEnough = (item.shareholders || []).filter((s) => s.percentage >= THRESHOLD);
      if (withEnough.length < 2) return false;
      if (filterParent) {
        return withEnough.some((s) => s.parent === filterParent);
      }
      return true;
    });
    res.json({ opcos: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/companies/add-opco – add an OpCo linked to a parent (from onboarding). Body: { parentName, organizationName, locations?: string[], sectorOfOperations?: string[], selectedFrameworks?: string[] }. When locations are provided, evaluates applicable frameworks by sector+location; if selectedFrameworks is provided, only those frameworks are stored for Governance Framework Summary and Multi Jurisdiction Matrix. */
companiesRouter.post('/add-opco', async (req, res) => {
  try {
    const { parentName, organizationName, locations: rawLocations, sectorOfOperations: rawSectors, selectedFrameworks: rawSelected } = req.body || {};
    const parent = typeof parentName === 'string' ? parentName.trim() : '';
    const opco = typeof organizationName === 'string' ? organizationName.trim() : '';
    if (!parent || !opco) {
      return res.status(400).json({ error: 'parentName and organizationName are required' });
    }
    const locations = Array.isArray(rawLocations) ? rawLocations.filter((l) => typeof l === 'string' && l.trim()) : [];
    const sectorOfOperations = Array.isArray(rawSectors) ? rawSectors.filter((s) => typeof s === 'string' && s.trim()) : [];
    const selectedFrameworks = Array.isArray(rawSelected) ? rawSelected.filter((s) => typeof s === 'string' && s.trim()) : [];

    let applicableFrameworksByLocation = [];
    if (locations.length > 0) {
      try {
        const pairs = await getFrameworksBySectorAndLocation(sectorOfOperations, locations);
        if (selectedFrameworks.length > 0) {
          const set = new Set(selectedFrameworks);
          applicableFrameworksByLocation = pairs.filter((p) => set.has(p.framework));
        } else {
          applicableFrameworksByLocation = pairs;
        }
      } catch (e) {
        console.warn('add-opco: getFrameworksBySectorAndLocation failed', e.message || e);
      }
    }

    const list = await readOnboardingOpcos();
    const existingIndex = list.findIndex((row) => row.parent === parent && row.opco === opco);
    const entry = {
      parent,
      opco,
      framework: 'Onboarded',
      addedAt: new Date().toISOString(),
      ...(locations.length > 0 && { locations }),
      ...(applicableFrameworksByLocation.length > 0 && { applicableFrameworksByLocation }),
    };
    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...entry };
    } else {
      list.push(entry);
    }
    await writeFile(onboardingPath, JSON.stringify(list, null, 2), 'utf-8');
    await logAudit({ action: existingIndex >= 0 ? 'update' : 'create', module: 'onboarding', entityName: opco, detail: `OpCo ${opco} linked to parent ${parent}` });
    res.json({ success: true, parent, opco, locations, applicableFrameworksByLocation });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/companies/compliance-scores?parent=X
 *
 * Returns data-driven compliance scores for every OpCo under a parent.
 *
 * Scoring methodology (100-point scale, starts at base 100):
 *  Governance Score  – penalise for regulatory changes with no acknowledged OpCo action
 *  Policy Score      – based on framework coverage completeness from onboarding data
 *  Data Sovereignty  – based on number of locations vs jurisdictions with restrictions
 *
 * Falls back to neutral score (75) when data is insufficient.
 */
companiesRouter.get('/compliance-scores', async (req, res) => {
  try {
    const parentFilter = req.query.parent ? String(req.query.parent).trim() : null;

    // 1. Load all companies
    let companies = {};
    try {
      const raw = await readFile(dataPath, 'utf-8');
      companies = JSON.parse(raw);
    } catch { companies = {}; }

    // 2. Load onboarding opcos
    const onboarding = await readOnboardingOpcos();

    // 3. Load regulatory changes (last 90 days)
    let changes = [];
    try {
      const changesPath = join(__dirname, '../data/changes.json');
      const raw = await readFile(changesPath, 'utf-8');
      const all = JSON.parse(raw);
      const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
      changes = Array.isArray(all) ? all.filter((c) => new Date(c.date).getTime() >= cutoff) : [];
    } catch { changes = []; }

    // Build opco universe from companies.json (keyed by framework)
    const opcoByName = {};
    for (const [framework, opcos] of Object.entries(companies)) {
      if (!Array.isArray(opcos)) continue;
      for (const opco of opcos) {
        const name = opco.name || opco;
        if (!opcoByName[name]) opcoByName[name] = { frameworks: [], parent: opco.parent || null, locations: [] };
        opcoByName[name].frameworks.push(framework);
        if (opco.parent) opcoByName[name].parent = opco.parent;
      }
    }
    // Enrich with onboarding data
    for (const row of onboarding) {
      if (!opcoByName[row.opco]) opcoByName[row.opco] = { frameworks: [], parent: row.parent, locations: [] };
      if (row.parent) opcoByName[row.opco].parent = row.parent;
      if (Array.isArray(row.locations)) opcoByName[row.opco].locations = row.locations;
      if (Array.isArray(row.applicableFrameworksByLocation)) {
        row.applicableFrameworksByLocation.forEach((p) => {
          if (p.framework && !opcoByName[row.opco].frameworks.includes(p.framework)) {
            opcoByName[row.opco].frameworks.push(p.framework);
          }
        });
      }
    }

    // Filter by parent if requested
    const opcoNames = Object.keys(opcoByName).filter((name) => {
      if (!parentFilter) return true;
      return opcoByName[name].parent === parentFilter;
    });

    // Build scores per opco
    const TOTAL_GCC_FRAMEWORKS = 22; // number of frameworks in the system
    const HIGH_RISK_JURISDICTIONS = ['Dubai International Financial Centre', 'Abu Dhabi Global Market', 'Qatar Financial Centre (QFC) & Mainland'];

    const scores = opcoNames.map((name) => {
      const meta = opcoByName[name];

      // --- Governance Score ---
      // Start at 100; each recent change that affects this opco's frameworks costs -2 points
      const opcoFrameworks = new Set(meta.frameworks);
      const relevantChanges = changes.filter((c) => c.framework && opcoFrameworks.has(c.framework));
      const criticalChanges = relevantChanges.filter((c) => c.category === 'critical' || c.severity === 'critical' || c.impact === 'High');
      const normalChanges = relevantChanges.filter((c) => !criticalChanges.includes(c));
      let governanceScore = 100 - (criticalChanges.length * 4) - (normalChanges.length * 1.5);
      governanceScore = Math.max(50, Math.min(100, Math.round(governanceScore)));

      // --- Policy Score ---
      // Based on framework coverage: (opco frameworks covered / reasonable benchmark)
      const frameworkCoverage = meta.frameworks.length;
      // Penalise if no frameworks at all (not yet onboarded properly)
      let policyScore;
      if (frameworkCoverage === 0) {
        policyScore = 65; // unverified
      } else if (frameworkCoverage >= 3) {
        policyScore = Math.min(100, 75 + frameworkCoverage * 2);
      } else {
        policyScore = 70 + frameworkCoverage * 3;
      }
      policyScore = Math.max(55, Math.min(100, policyScore));

      // --- Data Sovereignty Score ---
      // Penalise for high-risk jurisdictions without adequate framework coverage
      const locations = meta.locations || [];
      const highRiskCount = locations.filter((l) => HIGH_RISK_JURISDICTIONS.includes(l)).length;
      let dataSovereigntyScore = 85;
      if (locations.length === 0) {
        dataSovereigntyScore = 70; // unknown locations
      } else {
        dataSovereigntyScore = Math.max(55, Math.min(100, 90 - (highRiskCount * 3) + (frameworkCoverage)));
      }
      dataSovereigntyScore = Math.round(dataSovereigntyScore);

      const THRESHOLD = 75;
      const status = governanceScore >= THRESHOLD && policyScore >= THRESHOLD && dataSovereigntyScore >= THRESHOLD
        ? 'Compliant'
        : (governanceScore < 65 || policyScore < 65 || dataSovereigntyScore < 65 ? 'Non-Compliant' : 'At Risk');

      return { name, governanceScore, policyScore, dataSovereigntyScore, status, frameworkCount: meta.frameworks.length, locationCount: locations.length, recentChanges: relevantChanges.length };
    });

    res.json({ scores });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** GET /api/companies/onboarding-list – return all onboarding additions (for read-only display). */
companiesRouter.get('/onboarding-list', async (req, res) => {
  try {
    const list = await readOnboardingOpcos();
    res.json({ list });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
