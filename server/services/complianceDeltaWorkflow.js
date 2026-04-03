import crypto from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import nodemailer from 'nodemailer';
import { logAudit } from './auditService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tasksPath = join(__dirname, '../data/tasks.json');
const deltasPath = join(__dirname, '../data/runtime/compliance-deltas.json');
const notificationsPath = join(__dirname, '../data/runtime/action-notifications.json');

const ROUTING_BY_MODULE = {
  'data-sovereignty': 'Data Security team',
  governance: 'Compliance Governance team',
  onboarding: 'Onboarding Compliance team',
  'regulatory-changes': 'Regulatory Compliance Ops',
  'poa-management': 'Legal Operations team',
  'licence-management': 'Licensing Compliance team',
  'contracts-management': 'Contracts Governance team',
  'litigation-management': 'Legal Risk team',
  'ip-management': 'IP Legal team',
  other: 'Compliance Operations triage',
};

export function normalizeSeverity(value) {
  const s = String(value || '').trim().toLowerCase();
  if (['critical', 'high', 'medium', 'low'].includes(s)) return s;
  return 'medium';
}

export function deriveRoutingTeam(severity, moduleName) {
  if (severity === 'critical') return 'Central Risk Response Team';
  const mod = String(moduleName || '').trim().toLowerCase();
  return ROUTING_BY_MODULE[mod] || 'Compliance Operations triage';
}

export function computeSlaDueAt(severity, now = new Date()) {
  const due = new Date(now);
  if (severity === 'critical') due.setDate(due.getDate() + 1);
  else if (severity === 'high') due.setDate(due.getDate() + 2);
  else if (severity === 'medium') due.setDate(due.getDate() + 5);
  else due.setDate(due.getDate() + 10);
  return due.toISOString();
}

export function buildDeltaFingerprint(payload) {
  const base = {
    sourceType: String(payload.sourceType || 'system_delta').trim().toLowerCase(),
    module: String(payload.module || 'other').trim().toLowerCase(),
    framework: String(payload.framework || '').trim().toLowerCase(),
    opco: String(payload.opco || '').trim().toLowerCase(),
    parent: String(payload.parent || '').trim().toLowerCase(),
    summary: String(payload.summary || payload.deltaSummary || '').trim().toLowerCase(),
    beforeValue: payload.beforeValue ?? null,
    afterValue: payload.afterValue ?? null,
  };
  return crypto.createHash('sha256').update(JSON.stringify(base)).digest('hex').slice(0, 24);
}

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

async function sendEmailNotification(action, delta) {
  const to = String(process.env.ACTION_TRACKER_EMAIL_TO || '').trim();
  if (!to) return { ok: false, skipped: true, reason: 'ACTION_TRACKER_EMAIL_TO not configured' };
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM || '"GRC Action Tracker" <noreply@example.com>',
    to,
    subject: `[${String(action.priority || 'medium').toUpperCase()}] Action created: ${action.title}`,
    text: [
      `Action ID: ${action.id}`,
      'Status: Action Created',
      `Team: ${action.routingTeam || 'Unassigned'}`,
      `SLA due: ${action.slaDueAt || 'N/A'}`,
      `Source: ${delta.sourceType}`,
      `Summary: ${delta.summary}`,
    ].join('\n'),
  });
  return { ok: true };
}

async function sendTeamsNotification(action, delta) {
  const webhook = String(process.env.ACTION_TRACKER_TEAMS_WEBHOOK_URL || '').trim();
  if (!webhook) return { ok: false, skipped: true, reason: 'ACTION_TRACKER_TEAMS_WEBHOOK_URL not configured' };
  const body = {
    text: `Action Created | ${action.title}`,
    actionId: action.id,
    severity: action.priority,
    team: action.routingTeam,
    status: 'Action Created',
    slaDueAt: action.slaDueAt,
    sourceType: delta.sourceType,
  };
  const resp = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Webhook failed with ${resp.status}: ${text}`.slice(0, 220));
  }
  return { ok: true };
}

function validatePayload(payload) {
  const summary = String(payload.summary || payload.deltaSummary || '').trim();
  if (!summary) return { ok: false, error: 'summary is required' };
  return { ok: true };
}

export async function listComplianceDeltas() {
  const rows = await safeRead(deltasPath, []);
  return rows.sort((a, b) => new Date(b.detectedAt) - new Date(a.detectedAt));
}

export async function listActionNotifications() {
  const rows = await safeRead(notificationsPath, []);
  return rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function triggerComplianceDeltaEvent(payload = {}, actor = 'system') {
  const valid = validatePayload(payload);
  if (!valid.ok) return { error: 'VALIDATION_ERROR', message: valid.error };

  const now = nowIso();
  const sourceType = String(payload.sourceType || 'system_delta').trim().toLowerCase();
  const severity = normalizeSeverity(payload.severity);
  const moduleName = String(payload.module || 'other').trim().toLowerCase() || 'other';
  const fingerprint = buildDeltaFingerprint(payload);
  const summary = String(payload.summary || payload.deltaSummary || '').trim();
  const routingTeam = deriveRoutingTeam(severity, moduleName);
  const slaDueAt = computeSlaDueAt(severity, new Date(now));

  const [tasks, deltas, notifications] = await Promise.all([
    safeRead(tasksPath, []),
    safeRead(deltasPath, []),
    safeRead(notificationsPath, []),
  ]);

  const existing = deltas.find((d) => d.deltaFingerprint === fingerprint && !['resolved', 'closed'].includes(String(d.workflowStatus || '').toLowerCase()));
  if (existing?.actionId) {
    const task = tasks.find((t) => t.id === existing.actionId);
    if (task) {
      task.updatedAt = now;
      task.comments = task.comments || [];
      task.comments.push({
        id: `cmt-${Date.now()}`,
        text: `Additional delta signal captured automatically at ${new Date(now).toLocaleString('en-GB')}. Summary: ${summary}`,
        author: actor || 'system',
        createdAt: now,
      });
      existing.updatedAt = now;
      existing.occurrences = (existing.occurrences || 1) + 1;
      existing.timeline = existing.timeline || [];
      existing.timeline.push({ at: now, action: 'delta_reobserved', actor });
      await Promise.all([safeWrite(tasksPath, tasks), safeWrite(deltasPath, deltas)]);
      await logAudit({
        action: 'delta_reobserved',
        module: 'tasks',
        entityId: task.id,
        entityName: task.title,
        user: actor,
        detail: `Duplicate fingerprint observed (${fingerprint})`,
      });
      return { delta: existing, task, reused: true };
    }
  }

  const actionId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const actionTitle = payload.actionTitle || `Delta response: ${summary.slice(0, 180)}`;
  const task = {
    id: actionId,
    title: String(actionTitle).slice(0, 300),
    description: String(payload.description || summary).slice(0, 2000),
    module: moduleName,
    entityId: String(payload.entityId || '').slice(0, 120),
    entityName: String(payload.entityName || payload.opco || '').slice(0, 200),
    priority: severity,
    status: 'open',
    assignee: String(payload.assignee || ''),
    dueDate: slaDueAt.slice(0, 10),
    tags: Array.isArray(payload.tags) ? payload.tags.slice(0, 10) : ['auto-triggered', sourceType],
    createdBy: actor,
    createdAt: now,
    updatedAt: now,
    comments: [],
    sourceType,
    deltaFingerprint: fingerprint,
    deltaSummary: summary,
    routingTeam,
    workflowStatus: 'action_created',
    slaDueAt,
    originContext: {
      framework: payload.framework || null,
      opco: payload.opco || null,
      parent: payload.parent || null,
      beforeValue: payload.beforeValue ?? null,
      afterValue: payload.afterValue ?? null,
    },
    notificationState: { inApp: 'pending', email: 'pending', teams: 'pending' },
  };
  tasks.push(task);

  const delta = {
    id: `delta-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    detectedAt: now,
    updatedAt: now,
    sourceType,
    module: moduleName,
    framework: payload.framework || '',
    severity,
    opco: payload.opco || '',
    parent: payload.parent || '',
    summary,
    beforeValue: payload.beforeValue ?? null,
    afterValue: payload.afterValue ?? null,
    deltaFingerprint: fingerprint,
    workflowStatus: 'action_created',
    actionId,
    actionStatusLabel: 'Action Created',
    routingTeam,
    slaDueAt,
    occurrences: 1,
    timeline: [{ at: now, action: 'action_created', actor }],
  };
  deltas.push(delta);

  notifications.push({
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: now,
    type: 'action_created',
    actionId,
    title: task.title,
    body: `${task.priority.toUpperCase()} action created and routed to ${routingTeam}.`,
    isRead: false,
    channels: { inApp: 'delivered', email: 'pending', teams: 'pending' },
  });

  try {
    const emailState = await sendEmailNotification(task, delta);
    task.notificationState.email = emailState.ok ? 'delivered' : (emailState.skipped ? 'skipped' : 'failed');
    notifications[notifications.length - 1].channels.email = task.notificationState.email;
  } catch (err) {
    task.notificationState.email = 'failed';
    notifications[notifications.length - 1].channels.email = 'failed';
    notifications[notifications.length - 1].emailError = String(err.message || err).slice(0, 220);
  }

  try {
    const teamsState = await sendTeamsNotification(task, delta);
    task.notificationState.teams = teamsState.ok ? 'delivered' : (teamsState.skipped ? 'skipped' : 'failed');
    notifications[notifications.length - 1].channels.teams = task.notificationState.teams;
  } catch (err) {
    task.notificationState.teams = 'failed';
    notifications[notifications.length - 1].channels.teams = 'failed';
    notifications[notifications.length - 1].teamsError = String(err.message || err).slice(0, 220);
  }

  task.notificationState.inApp = 'delivered';
  await Promise.all([safeWrite(tasksPath, tasks), safeWrite(deltasPath, deltas), safeWrite(notificationsPath, notifications)]);
  await logAudit({
    action: 'auto_create_from_delta',
    module: 'tasks',
    entityId: actionId,
    entityName: task.title,
    user: actor,
    after: { deltaId: delta.id, severity, routingTeam, slaDueAt },
    detail: `Automated action created from ${sourceType} delta`,
  });
  return { delta, task, reused: false };
}
