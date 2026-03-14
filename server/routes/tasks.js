/**
 * tasks.js
 *
 * Full CRUD for compliance action items / tasks.
 *
 * GET    /api/tasks            – list (filters: status, module, assignee, priority)
 * POST   /api/tasks            – create
 * GET    /api/tasks/:id        – get one
 * PATCH  /api/tasks/:id        – update
 * DELETE /api/tasks/:id        – delete
 */

import { Router } from 'express';
import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { logAudit } from '../services/auditService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TASKS_PATH = join(__dirname, '../data/tasks.json');

async function readTasks() {
  try {
    const raw = await readFile(TASKS_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeTasks(tasks) {
  await writeFile(TASKS_PATH, JSON.stringify(tasks, null, 2), 'utf-8');
}

function getUser(req) {
  return req.session?.user?.email || req.session?.user?.displayName || 'system';
}

function getRole(req) {
  return req.session?.user?.role || '';
}

export const tasksRouter = Router();

// ── GET /api/tasks ──────────────────────────────────────────────────────────
tasksRouter.get('/', async (req, res) => {
  try {
    let tasks = await readTasks();
    if (req.query.status)   tasks = tasks.filter((t) => t.status   === req.query.status);
    if (req.query.module)   tasks = tasks.filter((t) => t.module   === req.query.module);
    if (req.query.assignee) tasks = tasks.filter((t) => t.assignee === req.query.assignee);
    if (req.query.priority) tasks = tasks.filter((t) => t.priority === req.query.priority);
    // Sort: open/in-progress first, then by dueDate asc, then createdAt desc
    tasks.sort((a, b) => {
      const statusOrder = { open: 0, 'in-progress': 1, done: 2, cancelled: 3 };
      const so = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
      if (so !== 0) return so;
      if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    res.json({ tasks, total: tasks.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/tasks ─────────────────────────────────────────────────────────
tasksRouter.post('/', async (req, res) => {
  try {
    const tasks = await readTasks();
    const now = new Date().toISOString();
    const task = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title:       String(req.body.title       || '').slice(0, 300),
      description: String(req.body.description || '').slice(0, 2000),
      module:      req.body.module    || '',
      entityId:    req.body.entityId  || '',
      entityName:  req.body.entityName|| '',
      priority:    ['critical', 'high', 'medium', 'low'].includes(req.body.priority) ? req.body.priority : 'medium',
      status:      'open',
      assignee:    req.body.assignee  || '',
      dueDate:     req.body.dueDate   || null,
      tags:        Array.isArray(req.body.tags) ? req.body.tags : [],
      createdBy:   getUser(req),
      createdAt:   now,
      updatedAt:   now,
      comments:    [],
    };
    if (!task.title) return res.status(400).json({ error: 'title is required' });
    tasks.push(task);
    await writeTasks(tasks);
    await logAudit({ action: 'create', module: 'tasks', entityId: task.id, entityName: task.title, user: getUser(req), role: getRole(req), after: task });
    res.status(201).json(task);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/tasks/:id ───────────────────────────────────────────────────────
tasksRouter.get('/:id', async (req, res) => {
  try {
    const tasks = await readTasks();
    const task = tasks.find((t) => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Not found' });
    res.json(task);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PATCH /api/tasks/:id ────────────────────────────────────────────────────
tasksRouter.patch('/:id', async (req, res) => {
  try {
    const tasks = await readTasks();
    const idx = tasks.findIndex((t) => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const before = { ...tasks[idx] };
    const allowedFields = ['title', 'description', 'module', 'entityId', 'entityName', 'priority', 'status', 'assignee', 'dueDate', 'tags'];
    const validStatuses = ['open', 'in-progress', 'done', 'cancelled'];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'status' && !validStatuses.includes(req.body[field])) continue;
        tasks[idx][field] = req.body[field];
      }
    }
    // Handle comment append
    if (req.body.comment) {
      tasks[idx].comments = tasks[idx].comments || [];
      tasks[idx].comments.push({
        id: `cmt-${Date.now()}`,
        text: String(req.body.comment).slice(0, 1000),
        author: getUser(req),
        createdAt: new Date().toISOString(),
      });
    }
    tasks[idx].updatedAt = new Date().toISOString();
    await writeTasks(tasks);
    await logAudit({ action: 'update', module: 'tasks', entityId: tasks[idx].id, entityName: tasks[idx].title, user: getUser(req), role: getRole(req), before, after: tasks[idx] });
    res.json(tasks[idx]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PATCH /api/tasks/:id/escalate ───────────────────────────────────────────
// Bumps priority one level (low → medium → high → critical), records escalation
// metadata, and adds an automatic audit comment so the assignee and managers
// can see the chain of escalation in the task history.
const PRIORITY_LEVELS = ['low', 'medium', 'high', 'critical'];
tasksRouter.patch('/:id/escalate', async (req, res) => {
  try {
    const tasks = await readTasks();
    const idx = tasks.findIndex((t) => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const before = { ...tasks[idx] };
    const task = tasks[idx];

    const prevPriority = task.priority;
    const prevIdx = PRIORITY_LEVELS.indexOf(prevPriority);
    const newPriority = PRIORITY_LEVELS[Math.min(prevIdx + 1, PRIORITY_LEVELS.length - 1)];

    task.priority = newPriority;
    task.escalatedAt = new Date().toISOString();
    task.escalationLevel = (task.escalationLevel || 0) + 1;

    const escalationComment = [
      `⬆ Escalated by ${getUser(req)} on ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}.`,
      `Priority raised from ${prevPriority} to ${newPriority} (escalation #${task.escalationLevel}).`,
      task.assignee ? `Assigned to: ${task.assignee}. Task has not been actioned for more than 10 days.` : 'Task has not been actioned for more than 10 days.',
      'Please action this item immediately or reassign to an available team member.',
    ].join(' ');

    task.comments = task.comments || [];
    task.comments.push({
      id: `cmt-${Date.now()}`,
      text: escalationComment,
      author: getUser(req),
      createdAt: task.escalatedAt,
    });
    task.updatedAt = task.escalatedAt;

    await writeTasks(tasks);
    await logAudit({
      action: 'escalate',
      module: 'tasks',
      entityId: task.id,
      entityName: task.title,
      user: getUser(req),
      role: getRole(req),
      before,
      after: task,
      detail: `Priority escalated from ${prevPriority} to ${newPriority}`,
    });
    res.json(task);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/tasks/:id ───────────────────────────────────────────────────
tasksRouter.delete('/:id', async (req, res) => {
  try {
    const tasks = await readTasks();
    const idx = tasks.findIndex((t) => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const [removed] = tasks.splice(idx, 1);
    await writeTasks(tasks);
    await logAudit({ action: 'delete', module: 'tasks', entityId: removed.id, entityName: removed.title, user: getUser(req), role: getRole(req) });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
