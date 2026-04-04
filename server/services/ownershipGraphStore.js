/**
 * Persists ownership graph payloads per context (e.g. parent holding + OpCo scope).
 * Storage: server/data/ownership-graphs/graphs.json
 */
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../data/ownership-graphs');
const STORE_FILE = join(DATA_DIR, 'graphs.json');

/** Allowed: letters, digits, dot, underscore, hyphen, colon (for parent::opco keys). */
export function sanitizeContextId(raw) {
  if (typeof raw !== 'string') return '';
  const s = raw.trim().slice(0, 256);
  if (!s) return '';
  if (!/^[a-zA-Z0-9._\-:]+$/.test(s)) return '';
  return s;
}

async function ensureDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

export async function loadStore() {
  await ensureDir();
  try {
    const raw = await readFile(STORE_FILE, 'utf-8');
    const db = JSON.parse(raw);
    if (!db || typeof db !== 'object') return { version: 1, graphs: {} };
    if (!db.graphs || typeof db.graphs !== 'object') db.graphs = {};
    return db;
  } catch {
    return { version: 1, graphs: {} };
  }
}

async function persist(db) {
  await ensureDir();
  await writeFile(STORE_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

/**
 * @param {string} contextId
 * @param {{ graph: object, warnings?: string[], extractionMeta?: object, fileName?: string }} payload
 */
export async function saveGraphRecord(contextId, payload) {
  const id = sanitizeContextId(contextId);
  if (!id) throw new Error('Invalid or missing contextId');
  if (!payload?.graph || typeof payload.graph !== 'object') throw new Error('graph is required');

  const db = await loadStore();
  const updatedAt = new Date().toISOString();
  db.graphs[id] = {
    graph: payload.graph,
    warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
    extractionMeta: payload.extractionMeta && typeof payload.extractionMeta === 'object' ? payload.extractionMeta : {},
    fileName: typeof payload.fileName === 'string' ? payload.fileName.slice(0, 500) : '',
    updatedAt,
  };
  await persist(db);
  return { contextId: id, savedAt: updatedAt };
}

export async function getGraphRecord(contextId) {
  const id = sanitizeContextId(contextId);
  if (!id) return null;
  const db = await loadStore();
  return db.graphs[id] || null;
}
