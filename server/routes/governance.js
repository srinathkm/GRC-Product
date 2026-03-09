import { Router } from 'express';
import { FRAMEWORKS, FRAMEWORK_CATEGORIES } from '../constants.js';
import { createChatCompletion, isLlmConfigured } from '../services/llm.js';

const VALID_CATEGORIES = new Set(['Financial', 'Governance', 'AML', 'Other']);

export const governanceRouter = Router();

/**
 * Heuristic fallback when LLM is not configured: map sector and licencing authority
 * keywords to likely frameworks (subset of FRAMEWORKS).
 */
function heuristicApplicableFrameworks(sectorOfOperations = [], licencingAuthorities = []) {
  const sectors = sectorOfOperations.map((s) => (s || '').toLowerCase());
  const authorities = licencingAuthorities.map((a) => (a || '').toLowerCase());
  const out = new Set();

  if (authorities.some((a) => a.includes('dfsa') || a.includes('dubai financial'))) {
    out.add('DFSA Rulebook');
    out.add('Dubai 2040');
  }
  if (authorities.some((a) => a.includes('adgm') || a.includes('fsra'))) {
    out.add('ADGM FSRA Rulebook');
    out.add('ADGM Companies Regulations');
  }
  if (authorities.some((a) => a.includes('cbuae') || a.includes('central bank uae'))) {
    out.add('CBUAE Rulebook');
    out.add('UAE AML/CFT');
    out.add('UAE Federal Laws');
  }
  if (authorities.some((a) => a.includes('jafza'))) {
    out.add('JAFZA Operating Regulations');
  }
  if (authorities.some((a) => a.includes('dmcc'))) {
    out.add('DMCC Company Regulations');
    out.add('DMCC Compliance & AML');
  }
  if (authorities.some((a) => a.includes('sama') || a.includes('saudi central'))) {
    out.add('SAMA');
    out.add('Saudi 2030');
    out.add('SDAIA');
  }
  if (authorities.some((a) => a.includes('cma saudi') || a.includes('capital market'))) {
    out.add('CMA');
    out.add('Saudi 2030');
  }
  if (authorities.some((a) => a.includes('qfcra') || a.includes('qatar financial'))) {
    out.add('QFCRA Rules');
    out.add('Qatar AML Law');
  }
  if (authorities.some((a) => a.includes('cbb') || a.includes('bahrain'))) {
    out.add('CBB Rulebook');
    out.add('BHB Sustainability ESG');
  }
  if (authorities.some((a) => a.includes('oman cma'))) {
    out.add('Oman CMA Regulations');
    out.add('Oman AML Law');
  }
  if (authorities.some((a) => a.includes('kuwait cma'))) {
    out.add('Kuwait CMA Regulations');
    out.add('Kuwait AML Law');
  }

  // Sector-driven heuristics (when LLM is off or as baseline for sectors without clear authorities).
  if (sectors.some((s) => s.includes('healthcare'))) {
    out.add('UAE Federal Laws');
    out.add('UAE AML/CFT');
    out.add('ADHICS');
    out.add('DHA Health Data Protection Regulation');
  }
  if (sectors.some((s) => s.includes('banking') || s.includes('financial'))) {
    out.add('CBUAE Rulebook');
    out.add('DFSA Rulebook');
    out.add('ADGM FSRA Rulebook');
    out.add('SAMA');
    out.add('CMA');
  }
  if (sectors.some((s) => s.includes('telecom') || s.includes('technology'))) {
    out.add('SDAIA');
    out.add('UAE Federal Laws');
  }
  if (sectors.some((s) => s.includes('government'))) {
    out.add('UAE Federal Laws');
    out.add('Saudi 2030');
    out.add('Dubai 2040');
  }

  return [...out].filter((f) => FRAMEWORKS.includes(f));
}

/**
 * POST /api/governance/applicable-frameworks
 * Body: { sectorOfOperations: string[], licencingAuthorities: string[] }
 * Returns: { frameworks: string[] } — subset of FRAMEWORKS applicable to the combination.
 */
governanceRouter.post('/applicable-frameworks', async (req, res) => {
  try {
    const sectors = Array.isArray(req.body.sectorOfOperations) ? req.body.sectorOfOperations : [];
    const authorities = Array.isArray(req.body.licencingAuthorities) ? req.body.licencingAuthorities : [];

    if (!isLlmConfigured()) {
      const frameworks = heuristicApplicableFrameworks(sectors, authorities);
      return res.json({ frameworks });
    }

    const frameworkList = FRAMEWORKS.map((f) => `"${f}"`).join(', ');
    const sectorList = sectors.length ? sectors.join(', ') : 'Not specified';
    const authorityList = authorities.length ? authorities.join(', ') : 'Not specified';

    const completion = await createChatCompletion({
      responseFormat: 'json',
      maxTokens: 800,
      messages: [
        {
          role: 'system',
          content: `You are a compliance expert. Given an organization's Sector of Operations and Licencing Authorities, you must select which governance/regulatory frameworks from a fixed list apply to that organization. Reply only with a JSON object containing a single key "frameworks" whose value is an array of framework names. Use only the exact framework names from the list provided. Do not add or invent framework names.`,
        },
        {
          role: 'user',
          content: `Sector of Operations: ${sectorList}\nLicencing Authorities: ${authorityList}\n\nList of possible frameworks (use only these exact names):\n${frameworkList}\n\nReturn a JSON object with key "frameworks" and value an array of every framework name from the list above that applies to this combination of sector and licencing authorities. Combine all applicable frameworks: if multiple sectors or authorities are given, include frameworks that apply to any of them.`,
        },
      ],
    });

    let parsed = { frameworks: [] };
    const text = completion.choices?.[0]?.message?.content?.trim() || '';
    if (text) {
      try {
        const jsonStr = text.replace(/^```json?\s*|\s*```$/g, '').trim();
        const json = JSON.parse(jsonStr);
        if (Array.isArray(json.frameworks)) {
          parsed.frameworks = json.frameworks.filter((f) => typeof f === 'string' && FRAMEWORKS.includes(f));
        }
      } catch {
        // keep parsed.frameworks = []
      }
    }

    if (parsed.frameworks.length === 0) {
      parsed.frameworks = heuristicApplicableFrameworks(sectors, authorities);
    }

    res.json({ frameworks: parsed.frameworks });
  } catch (e) {
    console.warn('Governance applicable-frameworks error:', e.message || e);
    const sectors = Array.isArray(req.body?.sectorOfOperations) ? req.body.sectorOfOperations : [];
    const authorities = Array.isArray(req.body?.licencingAuthorities) ? req.body.licencingAuthorities : [];
    const frameworks = heuristicApplicableFrameworks(sectors, authorities);
    res.json({ frameworks });
  }
});

/**
 * Heuristic: for a single location string, return framework names that match that location (subset of FRAMEWORKS). Used to build framework–location pairs when LLM is off.
 */
function heuristicFrameworksForOneLocation(locationStr) {
  const l = String(locationStr || '').toLowerCase();
  const out = new Set();
  if (l.includes('dubai') || l.includes('difc')) {
    out.add('DFSA Rulebook');
    out.add('Dubai 2040');
  }
  if (l.includes('adgm') || l.includes('abu dhabi')) {
    out.add('ADGM FSRA Rulebook');
    out.add('ADGM Companies Regulations');
  }
  if (l.includes('jafza') || l.includes('jebel ali')) out.add('JAFZA Operating Regulations');
  if (l.includes('dmcc')) {
    out.add('DMCC Company Regulations');
    out.add('DMCC Compliance & AML');
  }
  if (l.includes('uae') || l.includes('federal')) {
    out.add('CBUAE Rulebook');
    out.add('UAE AML/CFT');
    out.add('UAE Federal Laws');
  }
  if (l.includes('saudi') || l.includes('ksa') || l.includes('sama')) {
    out.add('SAMA');
    out.add('Saudi 2030');
    out.add('SDAIA');
  }
  if (l.includes('cma') && l.includes('saudi')) out.add('CMA');
  if (l.includes('qatar') || l.includes('qfc')) {
    out.add('QFCRA Rules');
    out.add('Qatar AML Law');
  }
  if (l.includes('bahrain')) {
    out.add('CBB Rulebook');
    out.add('BHB Sustainability ESG');
  }
  if (l.includes('oman')) {
    out.add('Oman CMA Regulations');
    out.add('Oman AML Law');
  }
  if (l.includes('kuwait')) {
    out.add('Kuwait CMA Regulations');
    out.add('Kuwait AML Law');
  }
  return [...out].filter((f) => FRAMEWORKS.includes(f));
}

/**
 * Normalize and validate category string from LLM (e.g. "Financial, Governance" or "Governance"). Returns comma-separated string of valid categories.
 */
function normalizeCategory(category) {
  if (category == null || typeof category !== 'string') return 'Other';
  const parts = category.split(',').map((s) => s.trim()).filter(Boolean);
  const valid = parts.filter((p) => VALID_CATEGORIES.has(p));
  return valid.length ? valid.join(', ') : 'Other';
}

/**
 * Resolve applicable frameworks for a sector + locations combination (e.g. from Regional Branch Commercial Licence).
 * Returns an array of { framework, location, category } so each framework is paired with the location where it applies and the governance category (LLM-evaluated).
 */
export async function getFrameworksBySectorAndLocation(sectorOfOperations, locations) {
  const sectors = Array.isArray(sectorOfOperations) ? sectorOfOperations : [];
  const locs = Array.isArray(locations) ? locations : [];

  if (!isLlmConfigured()) {
    const pairs = [];
    // Location-based heuristics
    for (const loc of locs) {
      const locLabel = typeof loc === 'string' ? loc.trim() : String(loc);
      if (!locLabel) continue;
      const frameworks = heuristicFrameworksForOneLocation(locLabel);
      for (const fw of frameworks) {
        const cats = FRAMEWORK_CATEGORIES[fw] || ['Other'];
        pairs.push({ framework: fw, location: locLabel, category: cats.join(', ') });
      }
    }
    // Sector-based heuristics (for cases where locations are empty or too generic).
    if (sectors.length > 0) {
      const sectorFrameworks = heuristicApplicableFrameworks(sectors, []);
      for (const fw of sectorFrameworks) {
        // Avoid duplicating frameworks already paired to a specific location.
        const already = pairs.some((p) => p.framework === fw);
        if (already) continue;
        const cats = FRAMEWORK_CATEGORIES[fw] || ['Other'];
        pairs.push({
          framework: fw,
          location: 'GCC (sector-based)',
          category: cats.join(', '),
        });
      }
    }
    return pairs;
  }

  const frameworkList = FRAMEWORKS.map((f) => `"${f}"`).join(', ');
  const sectorList = sectors.length ? sectors.join(', ') : 'Not specified';
  const locationList = locs.length ? locs.join(', ') : 'Not specified';

  try {
    const completion = await createChatCompletion({
      responseFormat: 'json',
      maxTokens: 1200,
      messages: [
        {
          role: 'system',
          content: 'You are a compliance expert. Given an organization\'s Sector of Operations and the Locations where it operates (e.g. from a Regional Branch Commercial Licence), for each applicable framework you must specify: (1) exactly one location from the provided locations list where that framework applies, (2) the governance category that this compliance framework applies to. Use only these categories: Financial, Governance, AML, Other. Reply only with a JSON object with key "frameworkLocationPairs" and value an array of objects, each with "framework" (exact name from the list), "location" (exact string from the provided locations list), and "category" (one or more of: Financial, Governance, AML, Other; use comma-separated if multiple, e.g. "Financial, Governance").',
        },
        {
          role: 'user',
          content: `Sector of Operations: ${sectorList}\nLocations of operation (use these exact strings for "location"): ${locationList}\n\nList of possible frameworks (use only these exact names for "framework"):\n${frameworkList}\n\nGovernance categories (use only these for "category"): Financial, Governance, AML, Other.\n\nReturn a JSON object with key "frameworkLocationPairs" and value an array of objects: { "framework": "<name from list>", "location": "<one of the locations listed above>", "category": "<e.g. Financial, AML or Governance>" } for every framework that applies to this sector and location combination. If a framework applies in multiple locations, include one object per location. For each row, set "category" to the governance category that the compliance framework applies to.`,
        },
      ],
    });
    const text = completion.choices?.[0]?.message?.content?.trim() || '';
    if (text) {
      const jsonStr = text.replace(/^```json?\s*|\s*```$/g, '').trim();
      const json = JSON.parse(jsonStr);
      const list = Array.isArray(json.frameworkLocationPairs) ? json.frameworkLocationPairs : [];
      const locSet = new Set(locs.map((l) => (typeof l === 'string' ? l.trim() : String(l))));
      let pairs = list
        .filter((p) => p && typeof p.framework === 'string' && typeof p.location === 'string' && FRAMEWORKS.includes(p.framework))
        .map((p) => ({
          framework: p.framework,
          location: p.location.trim(),
          category: normalizeCategory(p.category),
        }));
      // When specific locations are provided, keep only pairs for those locations.
      // When no locations are provided, accept all applicable frameworks (location is informational).
      if (locSet.size > 0) {
        pairs = pairs.filter((p) => locSet.has(p.location));
      }
      return pairs;
    }
  } catch (e) {
    console.warn('getFrameworksBySectorAndLocation:', e.message || e);
  }
  return [];
}

/**
 * POST /api/governance/frameworks-by-sector-and-location
 * Body: { sectorOfOperations: string[], locations: string[] }
 * Returns: { frameworkLocationPairs: { framework, location, category }[], frameworks: string[] } — one-to-one mapping with LLM-evaluated category and deduplicated framework list.
 */
governanceRouter.post('/frameworks-by-sector-and-location', async (req, res) => {
  try {
    const sectors = Array.isArray(req.body.sectorOfOperations) ? req.body.sectorOfOperations : [];
    const locations = Array.isArray(req.body.locations) ? req.body.locations : [];
    const frameworkLocationPairs = await getFrameworksBySectorAndLocation(sectors, locations);
    const frameworks = [...new Set(frameworkLocationPairs.map((p) => p.framework))];
    res.json({ frameworkLocationPairs, frameworks });
  } catch (e) {
    console.warn('Governance frameworks-by-sector-and-location error:', e.message || e);
    res.json({ frameworkLocationPairs: [], frameworks: [] });
  }
});
