/**
 * auditService.js
 *
 * Append-only audit trail.  Every mutation that touches compliance-relevant
 * data should call `logAudit()` so there is a permanent, ordered record of
 * who changed what and when.
 *
 * Storage: server/data/audit.json  (array, newest entries appended)
 * Cap    : 10 000 entries (oldest removed when cap reached)
 */

import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUDIT_PATH = join(__dirname, '../data/audit.json');
const MAX_ENTRIES = 10_000;

let _cache = null;      // in-memory array
let _dirty  = false;    // needs flush?
let _flushTimer = null;

async function load() {
  if (_cache) return _cache;
  try {
    const raw = await readFile(AUDIT_PATH, 'utf-8');
    _cache = JSON.parse(raw);
    if (!Array.isArray(_cache)) _cache = [];
  } catch {
    _cache = [];
  }
  return _cache;
}

async function flush() {
  if (!_dirty || !_cache) return;
  _dirty = false;
  try {
    await writeFile(AUDIT_PATH, JSON.stringify(_cache, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Audit] flush error:', e.message);
  }
}

function scheduledFlush() {
  if (_flushTimer) return;
  _flushTimer = setTimeout(async () => {
    _flushTimer = null;
    await flush();
  }, 500);
}

/**
 * Log an audit entry.
 *
 * @param {object} opts
 * @param {string}  opts.action     - e.g. 'create', 'update', 'delete', 'upload', 'login'
 * @param {string}  opts.module     - e.g. 'poa-management', 'onboarding', 'contracts'
 * @param {string}  [opts.entityId] - ID of the affected record
 * @param {string}  [opts.entityName] - Human-readable name of the entity
 * @param {string}  [opts.user]     - Username / email (from session)
 * @param {string}  [opts.role]     - User role
 * @param {object}  [opts.before]   - Snapshot before the change (optional)
 * @param {object}  [opts.after]    - Snapshot after the change (optional)
 * @param {string}  [opts.detail]   - Free-text description
 * @param {string}  [opts.ip]       - Requester IP
 */
export async function logAudit({
  action,
  module: mod,
  entityId,
  entityName,
  user,
  role,
  before,
  after,
  detail,
  ip,
}) {
  const arr = await load();
  const entry = {
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    action: action || 'unknown',
    module: mod || 'unknown',
    ...(entityId   !== undefined && { entityId }),
    ...(entityName !== undefined && { entityName }),
    ...(user       !== undefined && { user }),
    ...(role       !== undefined && { role }),
    ...(before     !== undefined && { before }),
    ...(after      !== undefined && { after }),
    ...(detail     !== undefined && { detail }),
    ...(ip         !== undefined && { ip }),
  };
  arr.push(entry);
  // Cap
  if (arr.length > MAX_ENTRIES) arr.splice(0, arr.length - MAX_ENTRIES);
  _dirty = true;
  scheduledFlush();
  return entry;
}

/**
 * Read audit entries with optional filtering.
 *
 * @param {object} [opts]
 * @param {string}  [opts.module]   - filter by module
 * @param {string}  [opts.action]   - filter by action
 * @param {string}  [opts.user]     - filter by user
 * @param {string}  [opts.entityId] - filter by entityId
 * @param {number}  [opts.limit]    - max entries (default 100)
 * @param {number}  [opts.offset]   - skip first N (default 0)
 * @returns {{ entries: object[], total: number }}
 */
export async function getAuditLog({ module: mod, action, user, entityId, limit = 100, offset = 0 } = {}) {
  const arr = await load();
  let filtered = arr.slice().reverse(); // newest first
  if (mod)      filtered = filtered.filter((e) => e.module === mod);
  if (action)   filtered = filtered.filter((e) => e.action === action);
  if (user)     filtered = filtered.filter((e) => e.user === user);
  if (entityId) filtered = filtered.filter((e) => e.entityId === entityId);
  const total = filtered.length;
  const entries = filtered.slice(offset, offset + limit);
  return { entries, total };
}
