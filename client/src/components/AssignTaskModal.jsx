/**
 * AssignTaskModal
 *
 * Pre-fills task details from a regulatory change and lets the user assign
 * it to a team member. Optionally pushes the task to an external workflow
 * engine (MS Power Automate webhook, Zapier, or any HTTP endpoint) so the
 * assignee receives it in MS-Tasks / MS Planner / Teams.
 *
 * The webhook URL is stored in localStorage so it persists across sessions.
 */
import { useState, useEffect } from 'react';
import './AssignTaskModal.css';

const WEBHOOK_STORAGE_KEY = 'grc_task_webhook_url';
const PRIORITY_MAP = { critical: 'critical', high: 'high', medium: 'medium', low: 'low' };

function computePriority(deadline) {
  if (!deadline) return 'medium';
  const days = Math.ceil((new Date(deadline) - new Date()) / 86400000);
  if (days < 30) return 'critical';
  if (days < 90) return 'high';
  if (days <= 180) return 'medium';
  return 'low';
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (_) { return dateStr; }
}

export function AssignTaskModal({ change, parent, extraContext = {}, onClose, onCreated }) {
  const { deadline, companies = [], changeTitle } = extraContext;

  const defaultComment = [
    `Regulatory Change: ${changeTitle || change?.title || ''}`,
    change?.framework ? `Framework: ${change.framework}` : '',
    parent ? `Assigned for: ${parent}` : '',
    companies.length ? `Affected OpCos: ${companies.join(', ')}` : '',
    deadline ? `Compliance Deadline: ${formatDate(deadline)}` : '',
    '',
    change?.snippet || change?.fullText || '',
  ].filter(Boolean).join('\n');

  const [assignee, setAssignee] = useState('');
  const [priority, setPriority] = useState(computePriority(deadline));
  const [dueDate, setDueDate] = useState(deadline || '');
  const [comment, setComment] = useState(defaultComment);
  const [sendWebhook, setSendWebhook] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState(() => localStorage.getItem(WEBHOOK_STORAGE_KEY) || '');
  const [showWebhookConfig, setShowWebhookConfig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (webhookUrl) localStorage.setItem(WEBHOOK_STORAGE_KEY, webhookUrl);
  }, [webhookUrl]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!assignee.trim()) { setError('Assignee is required.'); return; }
    setSaving(true);
    setError('');

    const taskPayload = {
      title: `[${change?.framework || 'Regulatory'}] ${changeTitle || change?.title || 'Compliance Action'}`,
      description: comment,
      module: 'regulatory-changes',
      entityId: change?.id || '',
      entityName: parent || '',
      priority: PRIORITY_MAP[priority] || 'medium',
      assignee: assignee.trim(),
      dueDate: dueDate || null,
      tags: [change?.framework, change?.category, parent].filter(Boolean),
    };

    try {
      // 1. Create internal task
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskPayload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }
      const createdTask = await res.json();

      // 2. Optionally push to external workflow engine (MS Power Automate, Zapier, etc.)
      if (sendWebhook && webhookUrl.trim()) {
        const webhookPayload = {
          taskId: createdTask.id,
          title: taskPayload.title,
          assignedTo: assignee.trim(),
          priority: taskPayload.priority,
          dueDate: taskPayload.dueDate,
          module: taskPayload.module,
          framework: change?.framework || '',
          parent,
          affectedOpcos: companies,
          deadline: deadline || null,
          comments: comment,
          sourceUrl: change?.sourceUrl || '',
          createdAt: createdTask.createdAt,
          appUrl: window.location.origin,
        };
        try {
          await fetch(webhookUrl.trim(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookPayload),
          });
        } catch (_) {
          // Webhook failure is non-fatal — task was already saved internally
          console.warn('Webhook delivery failed; task saved internally.');
        }
      }

      onCreated?.(createdTask);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create task.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="atm-overlay" onClick={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <div className="atm-modal">
        <div className="atm-header">
          <h3 className="atm-title">Assign Compliance Task</h3>
          <button type="button" className="atm-close" onClick={onClose} disabled={saving}>✕</button>
        </div>

        {/* Change context banner */}
        <div className="atm-context-banner">
          <div className="atm-context-row">
            <span className="atm-context-label">Framework</span>
            <span className="atm-context-value">{change?.framework || '—'}</span>
          </div>
          <div className="atm-context-row">
            <span className="atm-context-label">Change</span>
            <span className="atm-context-value">{changeTitle || change?.title || '—'}</span>
          </div>
          {parent && (
            <div className="atm-context-row">
              <span className="atm-context-label">Parent Holding</span>
              <span className="atm-context-value">{parent}</span>
            </div>
          )}
          {companies.length > 0 && (
            <div className="atm-context-row">
              <span className="atm-context-label">Affected OpCos</span>
              <span className="atm-context-value">{companies.join(', ')}</span>
            </div>
          )}
          {deadline && (
            <div className="atm-context-row">
              <span className="atm-context-label">Compliance Deadline</span>
              <span className="atm-context-value atm-deadline">{formatDate(deadline)}</span>
            </div>
          )}
        </div>

        <form className="atm-form" onSubmit={handleSubmit}>
          <div className="atm-form-grid">
            <div className="atm-field atm-field-full">
              <label className="atm-label">Assign to (name or email) *</label>
              <input
                type="text"
                className="atm-input"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="e.g. John Smith or john.smith@example.com"
                required
                maxLength={120}
              />
            </div>

            <div className="atm-field">
              <label className="atm-label">Priority</label>
              <select className="atm-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div className="atm-field">
              <label className="atm-label">Due date</label>
              <input
                type="date"
                className="atm-input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="atm-field atm-field-full">
              <label className="atm-label">Task context / comments for assignee</label>
              <textarea
                className="atm-textarea"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={6}
                maxLength={2000}
                placeholder="Details the assignee needs to review and action…"
              />
              <span className="atm-hint">This text will appear as the task description and in MS-Tasks comments when the workflow integration is enabled.</span>
            </div>
          </div>

          {/* Workflow integration */}
          <div className="atm-workflow-section">
            <div className="atm-workflow-header">
              <label className="atm-workflow-toggle-label">
                <input
                  type="checkbox"
                  checked={sendWebhook}
                  onChange={(e) => setSendWebhook(e.target.checked)}
                  className="atm-checkbox"
                />
                Send to external workflow (MS-Tasks / MS Planner / Teams)
              </label>
              <button
                type="button"
                className="atm-workflow-config-btn"
                onClick={() => setShowWebhookConfig((v) => !v)}
              >
                {showWebhookConfig ? 'Hide config' : 'Configure'}
              </button>
            </div>

            {(sendWebhook || showWebhookConfig) && (
              <div className="atm-workflow-config">
                <label className="atm-label">Webhook URL (MS Power Automate / Zapier / custom)</label>
                <input
                  type="url"
                  className="atm-input"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://prod-xx.westus.logic.azure.com/…"
                />
                <p className="atm-hint">
                  Paste your MS Power Automate HTTP trigger URL. The task details (assignee, priority, deadline, framework, OpCos, comments) will be sent as JSON. In Power Automate, use the "When an HTTP request is received" trigger and connect to "Microsoft To-Do → Add a task" or "Microsoft Planner → Create a task".
                </p>
                {webhookUrl && (
                  <div className="atm-webhook-preview">
                    <span className="atm-webhook-preview-label">Payload fields sent:</span>
                    <code>taskId, title, assignedTo, priority, dueDate, framework, parent, affectedOpcos, deadline, comments, sourceUrl, createdAt</code>
                  </div>
                )}
              </div>
            )}
          </div>

          {error && <div className="atm-error">{error}</div>}

          <div className="atm-actions">
            <button type="button" className="atm-btn atm-btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="atm-btn atm-btn-primary" disabled={saving}>
              {saving ? 'Assigning…' : sendWebhook && webhookUrl ? 'Assign & Send to Workflow' : 'Assign Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
