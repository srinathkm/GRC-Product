/**
 * regulatoryFeed.js
 *
 * Background scheduler that uses the LLM to look up fresh regulatory changes
 * for every framework every 24 hours and merges them into changes.json.
 *
 * It also exports `runFeed()` so that the /api/changes/refresh endpoint can
 * trigger a manual refresh on demand.
 */

import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { lookupChangesForFramework } from './ai.js';
import { isLlmConfigured } from './llm.js';
import { FRAMEWORKS } from '../constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const changesPath = join(__dirname, '../data/changes.json');
const feedMetaPath = join(__dirname, '../data/feed-meta.json');

/** How often (ms) the scheduler runs automatically. Default: every 24 h. */
const FEED_INTERVAL_MS = Number(process.env.FEED_INTERVAL_MS) || 24 * 60 * 60 * 1000;

/** How many days of changes to ask the LLM about on each pass. */
const LOOKUP_DAYS = 30;

async function safeReadJson(path, fallback) {
  try {
    const raw = await readFile(path, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

async function safeWriteJson(path, data) {
  try {
    await writeFile(path, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('[RegulatoryFeed] Failed to write', path, e.message);
  }
}

/**
 * Perform one full feed pass: query the LLM for all 22 frameworks and
 * merge newly discovered changes into changes.json.
 *
 * @returns {{ added: number, frameworks: number, total: number, skipped?: boolean, reason?: string }}
 */
export async function runFeed() {
  if (!isLlmConfigured()) {
    console.log('[RegulatoryFeed] LLM not configured — feed skipped.');
    return { added: 0, frameworks: 0, total: 0, skipped: true, reason: 'LLM not configured' };
  }

  console.log('[RegulatoryFeed] Starting feed refresh …');
  const startedAt = new Date().toISOString();

  let existing = await safeReadJson(changesPath, []);
  if (!Array.isArray(existing)) existing = [];

  const existingIds = new Set(existing.map((c) => c.id));
  let added = 0;
  let errors = 0;

  for (const fw of FRAMEWORKS) {
    try {
      const items = await lookupChangesForFramework(fw, LOOKUP_DAYS);
      for (const item of items) {
        if (!existingIds.has(item.id)) {
          existing.push(item);
          existingIds.add(item.id);
          added++;
        }
      }
    } catch (e) {
      console.warn(`[RegulatoryFeed] Error fetching "${fw}":`, e.message);
      errors++;
    }
  }

  // Keep newest first, cap at 2000 items to avoid unbounded file growth.
  existing.sort((a, b) => new Date(b.date) - new Date(a.date));
  if (existing.length > 2000) existing = existing.slice(0, 2000);

  await safeWriteJson(changesPath, existing);
  await safeWriteJson(feedMetaPath, {
    lastRun: startedAt,
    completedAt: new Date().toISOString(),
    added,
    errors,
    total: existing.length,
    frameworks: FRAMEWORKS.length,
  });

  console.log(
    `[RegulatoryFeed] Done. Added ${added} new items across ${FRAMEWORKS.length} frameworks` +
      (errors ? ` (${errors} framework(s) had errors)` : '') +
      `. Total in store: ${existing.length}.`,
  );

  return { added, frameworks: FRAMEWORKS.length, total: existing.length, errors };
}

/**
 * Read the metadata written by the last feed run without triggering a new one.
 */
export async function getFeedMeta() {
  return safeReadJson(feedMetaPath, null);
}

/**
 * Start the background scheduler.
 * - First run: 15 seconds after server start (gives the server time to boot).
 * - Subsequent runs: every FEED_INTERVAL_MS (default 24 h).
 */
export function startFeedScheduler() {
  if (!isLlmConfigured()) {
    console.log('[RegulatoryFeed] LLM not configured — scheduler inactive.');
    return;
  }

  console.log(
    `[RegulatoryFeed] Scheduler started. First run in 15 s, then every ${Math.round(FEED_INTERVAL_MS / 3_600_000)} h.`,
  );

  setTimeout(
    () => runFeed().catch((e) => console.error('[RegulatoryFeed] Startup run failed:', e.message)),
    15_000,
  );

  setInterval(
    () => runFeed().catch((e) => console.error('[RegulatoryFeed] Scheduled run failed:', e.message)),
    FEED_INTERVAL_MS,
  );
}
