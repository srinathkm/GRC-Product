import { mkdir, readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Runtime governance store (local/dev). Not committed to git.
const governancePath = join(__dirname, '../data/runtime/data-compliance-governance.json');
const auditPath = join(__dirname, '../data/runtime/data-compliance-governance-audit.json');

const ALLOWED_STATUSES = new Set(['open', 'in_review', 'approved_exception', 'resolved', 'rejected']);

async function safeRead(path, fallback) {
  try {
    const raw = await readFile(path, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

async function safeWrite(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2), 'utf-8');
}

function nowIso() {
  return new Date().toISOString();
}

function createRecord(payload = {}) {
  return {
    id: `dcx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    opco: payload.opco || 'Unknown OpCo',
    controlFamily: payload.controlFamily || 'Data residency',
    severity: payload.severity || 'High',
    ownerRole: payload.ownerRole || 'Data Security team',
    accountableRole: payload.accountableRole || 'CISO',
    status: 'open',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    dueDate: payload.dueDate || null,
    escalationPolicy: payload.escalationPolicy || 'critical_overdue',
    exception: {
      enabled: false,
      expiresAt: null,
      compensatingControl: null,
      approvedBy: null,
    },
    notes: payload.notes || '',
  };
}

async function appendAudit(event) {
  const audit = await safeRead(auditPath, []);
  audit.push({
    at: nowIso(),
    ...event,
  });
  await safeWrite(auditPath, audit);
}

export async function listGovernanceRecords() {
  return safeRead(governancePath, []);
}

export async function createGovernanceRecord(payload = {}, actor = 'system') {
  const rows = await safeRead(governancePath, []);
  const record = createRecord(payload);
  rows.push(record);
  await safeWrite(governancePath, rows);
  await appendAudit({ actor, action: 'create', recordId: record.id, outcome: 'success' });
  return record;
}

export async function updateGovernanceStatus(recordId, payload = {}, actor = 'system') {
  const rows = await safeRead(governancePath, []);
  const idx = rows.findIndex((r) => r.id === recordId);
  if (idx < 0) {
    return { error: 'NOT_FOUND' };
  }

  const nextStatus = String(payload.status || '').trim().toLowerCase();
  if (!ALLOWED_STATUSES.has(nextStatus)) {
    return { error: 'INVALID_STATUS' };
  }

  const current = rows[idx];
  const updated = {
    ...current,
    status: nextStatus,
    updatedAt: nowIso(),
    notes: payload.notes ?? current.notes,
    exception: {
      ...current.exception,
      enabled: Boolean(payload.exception?.enabled ?? current.exception?.enabled),
      expiresAt: payload.exception?.expiresAt ?? current.exception?.expiresAt,
      compensatingControl: payload.exception?.compensatingControl ?? current.exception?.compensatingControl,
      approvedBy: payload.exception?.approvedBy ?? current.exception?.approvedBy,
    },
  };
  rows[idx] = updated;
  await safeWrite(governancePath, rows);
  await appendAudit({
    actor,
    action: 'status_update',
    recordId,
    outcome: 'success',
    previousStatus: current.status,
    nextStatus,
  });
  return { record: updated };
}

export async function governanceSummary() {
  const rows = await safeRead(governancePath, []);
  const now = new Date();
  const escalationRequired = rows.filter((r) => {
    if ((r.severity || '').toLowerCase() !== 'critical') return false;
    if (!r.dueDate) return false;
    return new Date(r.dueDate) < now && r.status !== 'resolved';
  }).length;

  return {
    total: rows.length,
    byStatus: rows.reduce((acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {}),
    escalationRequired,
    openExceptions: rows.filter((r) => r.exception?.enabled).length,
  };
}
