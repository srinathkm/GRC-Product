/**
 * fieldLearningService.js
 * =======================
 * Persistent learning layer for the document intelligence system.
 *
 * After every successful AI extraction the system records:
 *   - Which document labels (headers / keywords) mapped to which fields
 *   - Observed example values
 *   - Rolling confidence and extraction count
 *
 * On every new extraction these accumulated patterns are fed back into the
 * LLM prompt as few-shot context, so accuracy improves continuously.
 *
 * Storage:  server/data/fieldMappings.json
 *
 * Schema (fieldMappings.json):
 * {
 *   "_v": 2,
 *   "_updatedAt": "ISO-8601",
 *   "<module>": {
 *     "_count": 42,          // total extractions recorded
 *     "<fieldName>": {
 *       "count": 42,
 *       "labels": ["ATTORNEY-IN-FACT", "Grantee", …],   // up to 20 unique labels
 *       "valueExamples": [                               // up to 10 examples
 *         { "label": "ATTORNEY-IN-FACT", "value": "Sara Mohammed Al-Mahmoud" }
 *       ],
 *       "avgConfidence": 0.94
 *     }
 *   }
 * }
 */

import { readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MAPPINGS_PATH = join(__dirname, '../data/fieldMappings.json');

const MAX_LABELS   = 30;   // unique labels to keep per field
const MAX_EXAMPLES = 15;   // value examples to keep per field

// ── I/O helpers ───────────────────────────────────────────────────────────────
async function load() {
  try {
    const raw = await readFile(MAPPINGS_PATH, 'utf-8');
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj;
  } catch { /* file absent or not yet migrated */ }
  return { _v: 2, _updatedAt: new Date().toISOString() };
}

async function save(data) {
  data._updatedAt = new Date().toISOString();
  await writeFile(MAPPINGS_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Return the raw module-level mapping object (or an empty one).
 */
export async function getModuleMappings(moduleType) {
  const data = await load();
  return data[moduleType] || { _count: 0 };
}

/**
 * Build a compact natural-language string that is injected into the LLM
 * system prompt as "learning context" before the extraction request.
 *
 * Example output (trimmed):
 *   ## Learned field patterns (from 42 prior documents)
 *   - holderName  [seen 42×, avg confidence 0.96]
 *     Labels: "ATTORNEY-IN-FACT", "Grantee", "Name of Attorney"
 *     Example values: "Sara Mohammed Al-Mahmoud", "Ahmed Khalid"
 *   …
 */
export async function buildLearningContext(moduleType) {
  const module = await getModuleMappings(moduleType);
  const count  = module._count || 0;
  if (count === 0) return '';

  const lines = [
    `## Learned field patterns from ${count} prior ${moduleType} document(s) — use these to improve accuracy:`,
  ];

  for (const [field, info] of Object.entries(module)) {
    if (field.startsWith('_')) continue;
    const labels   = (info.labels   || []).slice(0, 8).map((l) => `"${l}"`).join(', ');
    const examples = (info.valueExamples || []).slice(0, 5).map((e) => `"${e.value}"`).join(', ');
    const conf     = info.avgConfidence ? ` (avg confidence ${(info.avgConfidence * 100).toFixed(0)}%)` : '';
    lines.push(`- ${field}${conf}`);
    if (labels)   lines.push(`  Document labels: ${labels}`);
    if (examples) lines.push(`  Example values: ${examples}`);
  }

  return lines.join('\n');
}

/**
 * Record a completed extraction into the learning store.
 *
 * @param {string} moduleType  - e.g. 'poa', 'contracts', 'ip'
 * @param {Object} fields      - { fieldName: { value, confidence, label } }
 *                               `label` is the document heading/key the LLM found it under
 */
export async function recordExtraction(moduleType, fields) {
  if (!moduleType || !fields || typeof fields !== 'object') return;

  const data   = await load();
  const module = data[moduleType] || { _count: 0 };
  module._count = (module._count || 0) + 1;

  for (const [fieldName, result] of Object.entries(fields)) {
    if (!result || result.value == null || result.value === '') continue;

    const existing = module[fieldName] || { count: 0, labels: [], valueExamples: [], avgConfidence: 0 };
    existing.count = (existing.count || 0) + 1;

    // Update rolling average confidence
    const conf = typeof result.confidence === 'number' ? result.confidence : 0.5;
    existing.avgConfidence = (
      (existing.avgConfidence * (existing.count - 1) + conf) / existing.count
    );

    // Record the label (document heading) the value was found under
    if (result.label && typeof result.label === 'string') {
      const cleanLabel = result.label.trim();
      if (cleanLabel && !existing.labels.includes(cleanLabel)) {
        existing.labels = [cleanLabel, ...existing.labels].slice(0, MAX_LABELS);
      }
    }

    // Record a value example (avoid duplicates and empty)
    const valueStr = String(result.value).trim().slice(0, 120);
    const alreadyHave = existing.valueExamples.some((e) => e.value === valueStr);
    if (!alreadyHave && valueStr) {
      existing.valueExamples = [
        { label: result.label || '', value: valueStr },
        ...existing.valueExamples,
      ].slice(0, MAX_EXAMPLES);
    }

    module[fieldName] = existing;
  }

  data[moduleType] = module;
  await save(data);
}

/**
 * Record user corrections as high-confidence learning signal.
 * Corrections carry extra weight compared to auto-extracted values.
 *
 * @param {string} moduleType   - e.g. 'poa'
 * @param {Object} corrections  - { fieldName: correctedValue }
 */
export async function recordFeedback(moduleType, corrections) {
  if (!moduleType || !corrections) return;

  // Treat each corrected field as a high-confidence extraction
  const syntheticFields = {};
  for (const [field, value] of Object.entries(corrections)) {
    if (value != null && value !== '') {
      // Record twice: user correction is a strong signal
      syntheticFields[field] = { value, confidence: 1.0, label: '(user-corrected)' };
    }
  }

  // Two passes to give corrections double weight
  await recordExtraction(moduleType, syntheticFields);
  await recordExtraction(moduleType, syntheticFields);
}

/**
 * Return a summary of learning progress across all modules.
 */
export async function getLearningStats() {
  const data = await load();
  const stats = {};
  for (const [key, val] of Object.entries(data)) {
    if (key.startsWith('_')) continue;
    const fieldCount = Object.keys(val).filter((k) => !k.startsWith('_')).length;
    stats[key] = { extractions: val._count || 0, fieldsLearned: fieldCount };
  }
  return stats;
}
