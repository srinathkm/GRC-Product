import { useState, useEffect, useCallback } from 'react';
import './TaskTracker.css';

const PRIORITY_COLORS = {
  critical: '#ef4444',
  high:     '#eab308',
  medium:   '#60a5fa',
  low:      '#94a3b8',
};

const MODULES = [
  '', 'regulatory-changes', 'poa-management', 'licence-management',
  'contracts-management', 'litigation-management', 'ip-management',
  'data-sovereignty', 'governance', 'onboarding', 'other',
];

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

const STALE_DAYS = 10;

/** A task is "stale" if it's open/in-progress and updatedAt is more than STALE_DAYS days ago. */
function isStale(task) {
  if (task.status === 'done' || task.status === 'cancelled') return false;
  if (!task.updatedAt) return false;
  const daysSinceUpdate = (Date.now() - new Date(task.updatedAt).getTime()) / 86400000;
  return daysSinceUpdate > STALE_DAYS;
}

const PRIORITY_LEVELS = ['low', 'medium', 'high', 'critical'];

function nextPriority(current) {
  const idx = PRIORITY_LEVELS.indexOf(current);
  return PRIORITY_LEVELS[Math.min(idx + 1, PRIORITY_LEVELS.length - 1)];
}

function DueBadge({ dueDate }) {
  const du = daysUntil(dueDate);
  if (du === null) return null;
  let cls = 'task-card-due';
  let label = `Due ${formatDate(dueDate)}`;
  if (du < 0) { cls += ' overdue'; label = `Overdue ${Math.abs(du)}d`; }
  else if (du <= 7) { cls += ' soon'; label = `Due in ${du}d`; }
  return <span className={cls}>{label}</span>;
}

function StatusIcon({ status }) {
  if (status === 'done')        return <div className="task-card-check checked">✓</div>;
  if (status === 'in-progress') return <div className="task-card-check in-progress">…</div>;
  if (status === 'cancelled')   return <div className="task-card-check" style={{ opacity: 0.4 }}>✕</div>;
  return <div className="task-card-check" />;
}

function StatTile({ label, value, color }) {
  return (
    <div className="task-stat-tile" style={{ '--stat-color': color }}>
      <div className="task-stat-value">{value}</div>
      <div className="task-stat-label">{label}</div>
    </div>
  );
}

function TaskCard({ task, onClick }) {
  const pc = PRIORITY_COLORS[task.priority] || 'var(--border)';
  const stale = isStale(task);
  return (
    <div
      className={`task-card status-${task.status}${stale ? ' task-card-stale' : ''}`}
      style={{ '--priority-color': pc }}
      onClick={() => onClick(task)}
    >
      <StatusIcon status={task.status} />
      <div className="task-card-body">
        <div className="task-card-title">{task.title}</div>
        <div className="task-card-meta">
          <span className={`task-badge badge-${task.priority}`}>{task.priority}</span>
          <span className={`task-badge badge-${task.status}`}>{task.status}</span>
          {task.module && <span className="task-card-module">{task.module}</span>}
          <DueBadge dueDate={task.dueDate} />
          {stale && <span className="task-badge badge-stale" title={`No activity for more than ${STALE_DAYS} days`}>Not Actioned</span>}
          {task.escalationLevel > 0 && <span className="task-badge badge-escalated">Escalated ×{task.escalationLevel}</span>}
        </div>
      </div>
      <div className="task-card-right">
        {task.assignee && <span className="task-card-assignee">{task.assignee}</span>}
      </div>
    </div>
  );
}

/* ── New / edit task modal ── */
function TaskModal({ task, onClose, onSave }) {
  const isEdit = !!task?.id;
  const [form, setForm] = useState({
    title:       task?.title       || '',
    description: task?.description || '',
    priority:    task?.priority    || 'medium',
    status:      task?.status      || 'open',
    module:      task?.module      || '',
    assignee:    task?.assignee    || '',
    dueDate:     task?.dueDate     || '',
    comment:     '',
  });

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    const payload = { ...form };
    if (!payload.comment) delete payload.comment;
    if (!payload.dueDate) payload.dueDate = null;
    await onSave(payload);
  }

  return (
    <div className="task-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="task-modal">
        <div className="task-modal-header">
          <span className="task-modal-title">{isEdit ? 'Edit Task' : 'New Task'}</span>
          <button className="task-modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="task-form-grid">
            <div className="task-form-field full">
              <label className="task-form-label">Title *</label>
              <input value={form.title} onChange={(e) => set('title', e.target.value)} required maxLength={300} placeholder="Describe the action item…" />
            </div>
            <div className="task-form-field full">
              <label className="task-form-label">Description</label>
              <textarea value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={2000} placeholder="Additional details, context, or steps…" />
            </div>
            <div className="task-form-field">
              <label className="task-form-label">Priority</label>
              <select value={form.priority} onChange={(e) => set('priority', e.target.value)}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            {isEdit && (
              <div className="task-form-field">
                <label className="task-form-label">Status</label>
                <select value={form.status} onChange={(e) => set('status', e.target.value)}>
                  <option value="open">Open</option>
                  <option value="in-progress">In Progress</option>
                  <option value="done">Done</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            )}
            <div className="task-form-field">
              <label className="task-form-label">Module</label>
              <select value={form.module} onChange={(e) => set('module', e.target.value)}>
                {MODULES.map((m) => <option key={m} value={m}>{m || '— General —'}</option>)}
              </select>
            </div>
            <div className="task-form-field">
              <label className="task-form-label">Due Date</label>
              <input type="date" value={form.dueDate || ''} onChange={(e) => set('dueDate', e.target.value)} />
            </div>
            <div className="task-form-field full">
              <label className="task-form-label">Assignee</label>
              <input value={form.assignee} onChange={(e) => set('assignee', e.target.value)} maxLength={120} placeholder="Name or email…" />
            </div>
            {isEdit && (
              <div className="task-form-field full">
                <label className="task-form-label">Add Comment</label>
                <textarea value={form.comment} onChange={(e) => set('comment', e.target.value)} maxLength={1000} placeholder="Add a note or update…" rows={2} />
              </div>
            )}
          </div>
          <div className="task-modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">{isEdit ? 'Save Changes' : 'Create Task'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Detail / comment view ── */
function TaskDetail({ task, onClose, onUpdate, onDelete, onEscalate, auditLog }) {
  const [tab, setTab] = useState('details');
  const [editing, setEditing] = useState(false);
  const stale = isStale(task);

  if (editing) return <TaskModal task={task} onClose={() => setEditing(false)} onSave={async (payload) => { await onUpdate(task.id, payload); setEditing(false); }} />;

  return (
    <div className="task-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="task-modal">
        <div className="task-modal-header">
          <span className="task-modal-title" style={{ color: PRIORITY_COLORS[task.priority] }}>[{task.priority.toUpperCase()}] {task.title}</span>
          <button className="task-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="task-tabs">
          {['details', 'comments', 'audit'].map((t) => (
            <button key={t} className={`task-tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'details' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {stale && (
              <div className="task-stale-banner">
                <span className="task-stale-icon">⚠</span>
                <span>
                  <strong>Not actioned by assigned user</strong> — no activity for more than {STALE_DAYS} days.
                  {task.assignee ? ` Assigned to: ${task.assignee}.` : ''} Escalate to raise priority and notify next level.
                </span>
              </div>
            )}
            {task.escalationLevel > 0 && (
              <div className="task-escalated-banner">
                <span>Escalated ×{task.escalationLevel}</span>
                {task.escalatedAt && <span style={{ marginLeft: '0.5rem', opacity: 0.75, fontSize: '0.75rem' }}>Last escalated: {formatDate(task.escalatedAt)}</span>}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Status:</span> <span className={`task-badge badge-${task.status}`}>{task.status}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Priority:</span> <span className={`task-badge badge-${task.priority}`}>{task.priority}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Module:</span> <span style={{ color: 'var(--text)' }}>{task.module || '—'}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Assignee:</span> <span style={{ color: 'var(--text)' }}>{task.assignee || '—'}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Due:</span> <span style={{ color: 'var(--text)' }}><DueBadge dueDate={task.dueDate} /></span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Created:</span> <span style={{ color: 'var(--text)' }}>{formatDate(task.createdAt)}</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Last updated:</span> <span style={{ color: stale ? '#f59e0b' : 'var(--text)' }}>{formatDate(task.updatedAt)}</span></div>
            </div>
            {task.description && (
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.3rem' }}>Description</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{task.description}</div>
              </div>
            )}
            <div className="task-modal-actions" style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
              <button className="btn-danger-sm" onClick={() => { if (window.confirm('Delete this task?')) onDelete(task.id); }}>Delete</button>
              {(stale || task.escalationLevel > 0) && task.priority !== 'critical' && (
                <button
                  className="btn-escalate"
                  onClick={() => onEscalate(task.id)}
                  title={`Escalate priority from ${task.priority} to ${nextPriority(task.priority)}`}
                >
                  ↑ Escalate
                </button>
              )}
              <button className="btn-secondary" onClick={() => onUpdate(task.id, { status: task.status === 'done' ? 'open' : 'done' })}>{task.status === 'done' ? 'Reopen' : 'Mark Done'}</button>
              <button className="btn-primary" onClick={() => setEditing(true)}>Edit</button>
            </div>
          </div>
        )}

        {tab === 'comments' && (
          <div>
            <div className="task-detail-comments">
              {(task.comments || []).length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No comments yet.</div>}
              {(task.comments || []).map((c) => (
                <div key={c.id} className="task-detail-comment">
                  <span className="task-detail-comment-author">{c.author}</span>
                  <span className="task-detail-comment-time">{formatDate(c.createdAt)}</span>
                  <div className="task-detail-comment-text">{c.text}</div>
                </div>
              ))}
            </div>
            <form style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}
              onSubmit={async (e) => { e.preventDefault(); const t = e.target.comment; if (!t.value.trim()) return; await onUpdate(task.id, { comment: t.value }); t.value = ''; }}>
              <input name="comment" placeholder="Add a comment…" style={{ flex: 1, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: '0.8rem' }} />
              <button type="submit" className="btn-primary" style={{ flexShrink: 0 }}>Add</button>
            </form>
          </div>
        )}

        {tab === 'audit' && (
          <div className="task-audit-list">
            {auditLog.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No audit entries yet.</div>}
            {auditLog.map((e) => (
              <div key={e.id} className="task-audit-row">
                <span className="task-audit-ts">{new Date(e.timestamp).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</span>
                <span className="task-audit-action">{e.action}</span>
                <span className="task-audit-detail">{e.user || 'system'} — {e.detail || task.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main component ── */
export function TaskTracker() {
  const [tasks, setTasks]         = useState([]);
  const [auditEntries, setAudit]  = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filterStatus, setFS]     = useState('');
  const [filterPriority, setFP]   = useState('');
  const [filterModule, setFM]     = useState('');
  const [filterStale, setFilterStale] = useState(false);
  const [search, setSearch]       = useState('');
  const [showNew, setShowNew]     = useState(false);
  const [selected, setSelected]   = useState(null);
  const [selectedAudit, setSelAudit] = useState([]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus)   params.set('status',   filterStatus);
      if (filterPriority) params.set('priority',  filterPriority);
      if (filterModule)   params.set('module',    filterModule);
      const r = await fetch(`/api/tasks?${params}`);
      const d = await r.json();
      setTasks(d.tasks || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterPriority, filterModule]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  async function fetchAuditForTask(taskId) {
    try {
      const r = await fetch(`/api/audit?module=tasks&entityId=${encodeURIComponent(taskId)}&limit=50`);
      const d = await r.json();
      setSelAudit(d.entries || []);
    } catch { setSelAudit([]); }
  }

  async function handleCreate(payload) {
    await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setShowNew(false);
    fetchTasks();
  }

  async function handleUpdate(id, payload) {
    const r = await fetch(`/api/tasks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const updated = await r.json();
    setTasks((prev) => prev.map((t) => t.id === id ? updated : t));
    if (selected?.id === id) {
      setSelected(updated);
      await fetchAuditForTask(id);
    }
  }

  async function handleEscalate(id) {
    const r = await fetch(`/api/tasks/${id}/escalate`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' } });
    if (!r.ok) return;
    const updated = await r.json();
    setTasks((prev) => prev.map((t) => t.id === id ? updated : t));
    if (selected?.id === id) {
      setSelected(updated);
      await fetchAuditForTask(id);
    }
  }

  async function handleDelete(id) {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    setSelected(null);
    fetchTasks();
  }

  async function openTask(task) {
    setSelected(task);
    await fetchAuditForTask(task.id);
  }

  const displayed = tasks.filter((t) => {
    if (filterStale && !isStale(t)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (t.title + t.description + t.assignee + t.module).toLowerCase().includes(q);
  });

  const stats = {
    open:        tasks.filter((t) => t.status === 'open').length,
    inProgress:  tasks.filter((t) => t.status === 'in-progress').length,
    overdue:     tasks.filter((t) => t.dueDate && daysUntil(t.dueDate) < 0 && t.status !== 'done' && t.status !== 'cancelled').length,
    done:        tasks.filter((t) => t.status === 'done').length,
    notActioned: tasks.filter(isStale).length,
  };

  return (
    <div className="task-tracker">
      {/* Header */}
      <div className="task-header">
        <div>
          <h2 className="task-title">Action Tracker</h2>
          <div className="task-subtitle">Compliance tasks, remediation items, and follow-up actions</div>
        </div>
        <div className="task-header-actions">
          <button className="btn-primary" onClick={() => setShowNew(true)}>+ New Task</button>
        </div>
      </div>

      {/* Stats */}
      <div className="task-stats-row">
        <StatTile label="Open"         value={stats.open}        color="#60a5fa" />
        <StatTile label="In Progress"  value={stats.inProgress}  color="#eab308" />
        <StatTile label="Overdue"      value={stats.overdue}     color="#ef4444" />
        <StatTile label="Completed"    value={stats.done}        color="#22c55e" />
        <StatTile label="Not Actioned" value={stats.notActioned} color="#f97316" />
      </div>

      {/* Filters */}
      <div className="task-filter-bar">
        <input type="text" placeholder="Search tasks…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={filterStatus} onChange={(e) => setFS(e.target.value)}>
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in-progress">In Progress</option>
          <option value="done">Done</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={filterPriority} onChange={(e) => setFP(e.target.value)}>
          <option value="">All priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={filterModule} onChange={(e) => setFM(e.target.value)}>
          {MODULES.map((m) => <option key={m} value={m}>{m || 'All modules'}</option>)}
        </select>
        <button
          className={`btn-secondary task-filter-stale-btn${filterStale ? ' active' : ''}`}
          onClick={() => setFilterStale((v) => !v)}
          title="Show only tasks with no activity for more than 10 days"
        >
          {filterStale ? '⚠ Not Actioned' : 'Not Actioned'}
        </button>
        <button className="btn-secondary" style={{ marginLeft: 'auto' }} onClick={() => { setFS(''); setFP(''); setFM(''); setSearch(''); setFilterStale(false); }}>Clear</button>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Loading…</div>
      ) : displayed.length === 0 ? (
        <div className="task-empty">
          {tasks.length === 0 ? 'No tasks yet. Create one to track compliance actions.' : 'No tasks match the current filters.'}
        </div>
      ) : (
        <div className="task-list">
          {displayed.map((t) => <TaskCard key={t.id} task={t} onClick={openTask} />)}
        </div>
      )}

      {/* Modals */}
      {showNew && <TaskModal onClose={() => setShowNew(false)} onSave={handleCreate} />}
      {selected && (
        <TaskDetail
          task={selected}
          auditLog={selectedAudit}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onEscalate={handleEscalate}
        />
      )}
    </div>
  );
}
