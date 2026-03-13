/**
 * dataSovereignty.js
 *
 * Dynamic data-sovereignty checks powered by the LLM.
 *
 * GET  /api/data-sovereignty/checks          → returns checks (from cache or LLM)
 * POST /api/data-sovereignty/checks/refresh  → force-refreshes the LLM cache
 */

import { Router } from 'express';
import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createChatCompletion, isLlmConfigured } from '../services/llm.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cachePath = join(__dirname, '../data/data-sovereignty-checks.json');

/** Cache TTL: 24 hours */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** GCC jurisdictions we generate checks for */
const JURISDICTIONS = ['UAE', 'KSA', 'Qatar', 'Bahrain', 'Oman', 'Kuwait', 'GCC'];

/**
 * Fallback static checks used when LLM is not configured or fails.
 * These match the existing hardcoded constants in DataSovereignty.jsx.
 */
const STATIC_CHECKS = [
  {
    id: 'uae-pdpl-residency',
    name: 'UAE PDPL – Data localisation',
    regulation: 'UAE Federal Decree-Law 45/2021 (PDPL)',
    description: 'Personal data processed in UAE must be stored and processed within UAE unless transfer is permitted.',
    severity: 'Critical',
    jurisdiction: 'UAE',
    lastUpdated: '2024-01-01',
  },
  {
    id: 'ksa-pdpl-residency',
    name: 'KSA PDPL – Data localisation',
    regulation: 'Saudi PDPL (Royal Decree M/19)',
    description: 'Critical personal data must be stored and processed in KSA; cross-border transfer subject to NDMO approval.',
    severity: 'Critical',
    jurisdiction: 'KSA',
    lastUpdated: '2024-01-01',
  },
  {
    id: 'cbuae-data-local',
    name: 'CBUAE – Financial data in UAE',
    regulation: 'CBUAE Rulebook & circulars',
    description: 'Regulated financial institutions must maintain core systems and customer data within UAE or approved jurisdictions.',
    severity: 'Critical',
    jurisdiction: 'UAE',
    lastUpdated: '2024-01-01',
  },
  {
    id: 'sama-data-local',
    name: 'SAMA – Financial data in KSA',
    regulation: 'SAMA regulations',
    description: 'Banking and insurance data must reside in KSA; cloud and outsourcing subject to SAMA approval.',
    severity: 'Critical',
    jurisdiction: 'KSA',
    lastUpdated: '2024-01-01',
  },
  {
    id: 'cross-border-transfer',
    name: 'Cross-border transfer mechanisms',
    regulation: 'UAE PDPL / KSA PDPL',
    description: 'Adequate transfer mechanisms (adequacy, SCCs, binding corporate rules) in place for permitted transfers.',
    severity: 'Critical',
    jurisdiction: 'GCC',
    lastUpdated: '2024-01-01',
  },
  {
    id: 'dpa-registration',
    name: 'Data Protection Authority registration',
    regulation: 'UAE PDPL / Executive regulations',
    description: 'Registration with UAE DPA where required for controllers/processors.',
    severity: 'Medium',
    jurisdiction: 'UAE',
    lastUpdated: '2024-01-01',
  },
  {
    id: 'data-retention',
    name: 'Retention limits aligned with law',
    regulation: 'UAE PDPL / KSA PDPL / sector rules',
    description: 'Retention periods defined and aligned with minimum/maximum under applicable law.',
    severity: 'Medium',
    jurisdiction: 'GCC',
    lastUpdated: '2024-01-01',
  },
  {
    id: 'consent-records',
    name: 'Consent and lawful basis records',
    regulation: 'UAE PDPL / KSA PDPL',
    description: 'Documented lawful basis and consent where required for processing.',
    severity: 'Medium',
    jurisdiction: 'GCC',
    lastUpdated: '2024-01-01',
  },
  {
    id: 'dpias',
    name: 'Data Protection Impact Assessments',
    regulation: 'UAE PDPL / KSA PDPL',
    description: 'DPIAs conducted for high-risk processing and filed with regulator where required.',
    severity: 'Medium',
    jurisdiction: 'GCC',
    lastUpdated: '2024-01-01',
  },
  {
    id: 'breach-notification',
    name: 'Breach notification readiness',
    regulation: 'UAE PDPL / KSA PDPL',
    description: 'Process to notify regulator and data subjects within required timelines.',
    severity: 'Medium',
    jurisdiction: 'GCC',
    lastUpdated: '2024-01-01',
  },
  {
    id: 'processor-binding',
    name: 'Processor binding agreements',
    regulation: 'UAE PDPL / KSA PDPL',
    description: 'Contracts with processors imposing data protection and sovereignty obligations.',
    severity: 'Low',
    jurisdiction: 'GCC',
    lastUpdated: '2024-01-01',
  },
  {
    id: 'cloud-sovereignty',
    name: 'Cloud and sovereign cloud use',
    regulation: 'UAE / KSA government and sector guidance',
    description: 'Use of in-country or approved sovereign cloud for sensitive/critical data.',
    severity: 'Medium',
    jurisdiction: 'GCC',
    lastUpdated: '2024-01-01',
  },
  {
    id: 'adgm-data',
    name: 'ADGM – Data in ADGM / UAE',
    regulation: 'ADGM data protection regime',
    description: "ADGM entities' data handling consistent with onshore UAE and ADGM rules.",
    severity: 'Medium',
    jurisdiction: 'UAE',
    lastUpdated: '2024-01-01',
  },
  {
    id: 'dfsa-data',
    name: 'DFSA – DIFC data handling',
    regulation: 'DFSA rulebook',
    description: "DIFC firms' data residency and processing in line with DFSA and UAE requirements.",
    severity: 'Medium',
    jurisdiction: 'UAE',
    lastUpdated: '2024-01-01',
  },
  {
    id: 'free-zone-local',
    name: 'Free zone data localisation',
    regulation: 'JAFZA / DMCC / other zone rules',
    description: 'Free zone entity data stored and processed in line with UAE and zone requirements.',
    severity: 'Low',
    jurisdiction: 'UAE',
    lastUpdated: '2024-01-01',
  },
];

async function readCache() {
  try {
    const raw = await readFile(cachePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeCache(data) {
  try {
    await writeFile(cachePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch { /* best-effort */ }
}

const VALID_SEVERITIES = new Set(['Critical', 'Medium', 'Low']);

function normalizeCheck(item, jurisdiction, index) {
  return {
    id: item.id || `check-${jurisdiction.toLowerCase()}-${index}`,
    name: String(item.name || 'Compliance check').slice(0, 120),
    regulation: String(item.regulation || ''),
    description: String(item.description || ''),
    severity: VALID_SEVERITIES.has(item.severity) ? item.severity : 'Medium',
    jurisdiction: String(item.jurisdiction || jurisdiction),
    lastUpdated: item.lastUpdated || new Date().toISOString().slice(0, 10),
  };
}

async function fetchChecksForJurisdiction(jurisdiction) {
  const prompt = `You are a data sovereignty and data protection compliance expert for the GCC region.

Return a JSON array of current, actionable data sovereignty compliance checks specifically for the "${jurisdiction}" jurisdiction.

Each item must have exactly these fields:
- "id"           : unique kebab-case string (e.g. "uae-pdpl-data-localisation")
- "name"         : concise check name, max 80 characters
- "regulation"   : the specific law or regulation (e.g. "UAE Federal Decree-Law 45/2021")
- "description"  : 1-2 sentences explaining the requirement and what non-compliance means
- "severity"     : one of "Critical", "Medium", "Low"
- "jurisdiction" : "${jurisdiction}"
- "lastUpdated"  : YYYY-MM-DD date when the regulation was last meaningfully amended

Focus on:
1. Data localisation and residency mandates
2. Cross-border transfer restrictions and mechanisms
3. Consent and lawful basis requirements
4. Breach notification timelines
5. Data Protection Impact Assessments (DPIAs)
6. Processor/third-party binding agreements
7. Regulatory registration requirements
8. Sovereign / in-country cloud requirements
9. Sector-specific rules (financial services, health, government data)

Return 5–12 items. Use only real, current regulations for ${jurisdiction}.
Reply with only the JSON array — no markdown, no explanation.`;

  const completion = await createChatCompletion({
    messages: [
      { role: 'system', content: 'You respond only with a valid JSON array. No markdown fences, no extra text.' },
      { role: 'user', content: prompt },
    ],
    maxTokens: 3000,
    responseFormat: 'json',
  });

  const raw = completion.choices?.[0]?.message?.content?.trim() || '[]';
  const jsonStr = raw.replace(/^```json?\s*|\s*```$/g, '').trim();
  const arr = JSON.parse(jsonStr);
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 15).map((item, i) => normalizeCheck(item, jurisdiction, i));
}

async function buildFreshChecks() {
  const all = [];
  const seen = new Set();
  for (const jurisdiction of JURISDICTIONS) {
    try {
      const items = await fetchChecksForJurisdiction(jurisdiction);
      for (const item of items) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          all.push(item);
        }
      }
    } catch (e) {
      console.warn(`[DataSovereignty] LLM error for ${jurisdiction}:`, e.message);
    }
  }
  return all.length > 0 ? all : STATIC_CHECKS;
}

export const dataSovereigntyRouter = Router();

/**
 * GET /api/data-sovereignty/checks
 * Query params:
 *   jurisdiction  – filter by jurisdiction (UAE, KSA, Qatar, Bahrain, Oman, Kuwait, GCC) — defaults to all
 *   force         – "1" forces LLM refresh ignoring cache TTL
 */
dataSovereigntyRouter.get('/checks', async (req, res) => {
  const jurisdiction = typeof req.query.jurisdiction === 'string' ? req.query.jurisdiction.trim() : '';
  const force = req.query.force === '1' || req.query.force === 'true';

  // Try the cache first (unless force=1)
  if (!force) {
    const cached = await readCache();
    const cacheAge = cached?.fetchedAt ? Date.now() - cached.fetchedAt : Infinity;
    if (cached?.checks && Array.isArray(cached.checks) && cacheAge < CACHE_TTL_MS) {
      const checks = jurisdiction
        ? cached.checks.filter((c) => c.jurisdiction === jurisdiction || c.jurisdiction === 'GCC')
        : cached.checks;
      return res.json({
        checks,
        dynamic: true,
        fromCache: true,
        fetchedAt: new Date(cached.fetchedAt).toISOString(),
        totalChecks: cached.checks.length,
      });
    }
  }

  // No valid cache — try LLM
  if (!isLlmConfigured()) {
    const checks = jurisdiction
      ? STATIC_CHECKS.filter((c) => c.jurisdiction === jurisdiction || c.jurisdiction === 'GCC')
      : STATIC_CHECKS;
    return res.json({ checks, dynamic: false, fromCache: false, reason: 'LLM not configured' });
  }

  try {
    const allChecks = await buildFreshChecks();
    await writeCache({ checks: allChecks, fetchedAt: Date.now() });
    const checks = jurisdiction
      ? allChecks.filter((c) => c.jurisdiction === jurisdiction || c.jurisdiction === 'GCC')
      : allChecks;
    return res.json({
      checks,
      dynamic: true,
      fromCache: false,
      fetchedAt: new Date().toISOString(),
      totalChecks: allChecks.length,
    });
  } catch (e) {
    console.error('[DataSovereignty] Error generating LLM checks:', e.message);
    const checks = jurisdiction
      ? STATIC_CHECKS.filter((c) => c.jurisdiction === jurisdiction || c.jurisdiction === 'GCC')
      : STATIC_CHECKS;
    return res.json({ checks, dynamic: false, fromCache: false, error: e.message });
  }
});

/**
 * POST /api/data-sovereignty/checks/refresh
 * Force-refreshes the LLM-generated checks cache.
 */
dataSovereigntyRouter.post('/checks/refresh', async (req, res) => {
  if (!isLlmConfigured()) {
    return res.status(400).json({ error: 'LLM not configured. Set LLM_BASE_URL and LLM_API_KEY.' });
  }
  try {
    const allChecks = await buildFreshChecks();
    await writeCache({ checks: allChecks, fetchedAt: Date.now() });
    return res.json({ ok: true, count: allChecks.length, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});
