/**
 * GlobalAssistant — GRC Intelligence Assistant
 *
 * A globally available AI assistant panel (floating trigger + slide-in drawer)
 * that routes questions to the correct GRC module context, renders rich structured
 * responses (metrics, charts, correlations, action approval cards), and maintains
 * a human-in-the-loop for any suggested operational actions.
 *
 * All sub-components are defined at module level for React Fast Refresh compatibility.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import './GlobalAssistant.css';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const PERSONAS = [
  { value: 'board',      label: 'Board',        icon: '🏛' },
  { value: 'c-level',   label: 'C-Level',       icon: '👔' },
  { value: 'legal',     label: 'Legal',         icon: '⚖️' },
  { value: 'governance',label: 'Governance',    icon: '📋' },
  { value: 'data',      label: 'Data & Security',icon: '🔐' },
  { value: 'operations',label: 'Operations',    icon: '⚙️' },
];

const MODULE_META = {
  governance: { label: 'Governance',      color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', icon: '📋' },
  legal:      { label: 'Legal',           color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', icon: '⚖️' },
  esg:        { label: 'ESG',             color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: '🌿' },
  data:       { label: 'Data & Security', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: '🔐' },
  ownership:  { label: 'Ownership',       color: '#6366f1', bg: 'rgba(99,102,241,0.12)', icon: '🏢' },
  analysis:   { label: 'Analysis',        color: '#ec4899', bg: 'rgba(236,72,153,0.12)', icon: '📊' },
  overview:   { label: 'Overview',        color: '#14b8a6', bg: 'rgba(20,184,166,0.12)', icon: '🏛' },
  tasks:      { label: 'Tasks',           color: '#f97316', bg: 'rgba(249,115,22,0.12)', icon: '✅' },
  cross:      { label: 'Cross-Module',    color: '#a855f7', bg: 'rgba(168,85,247,0.12)', icon: '🔗' },
};

const VIEW_TO_MODULE = {
  'mgmt-dashboard':        'overview',
  'org-overview':          'overview',
  'org-dashboard':         'overview',
  'parent-overview':       'overview',
  'onboarding':            'governance',
  'governance-framework':  'governance',
  'multi-jurisdiction':    'governance',
  'ubo':                   'ownership',
  'esg':                   'esg',
  'legal-onboarding':      'legal',
  'poa-management':        'legal',
  'ip-management':         'legal',
  'licence-management':    'legal',
  'litigations-management':'legal',
  'contracts-management':  'legal',
  'contracts-upload':      'legal',
  'data-sovereignty':      'data',
  'data-security':         'data',
  'analysis':              'analysis',
  'ma-simulator':          'analysis',
  'task-tracker':          'tasks',
};

const QUICK_PROMPTS = {
  'mgmt-dashboard':        ['What needs my immediate attention today?', 'Show overall compliance health', 'Which OpCos carry the highest risk?'],
  'governance-framework':  ['Which frameworks have upcoming deadlines?', 'What regulatory changes happened in the last 30 days?', 'Show overdue compliance items'],
  'esg':                   ['What is our overall ESG rating?', 'Which ESG pillar needs most improvement?', 'Show GCC regulatory compliance gaps'],
  'ubo':                   ['Are all UBO records complete?', 'Which entities have missing documents?', 'Show beneficial ownership risks'],
  'data-sovereignty':      ['Do we have cross-border data transfer risks?', 'Show data localisation gaps', 'PDPL compliance status?'],
  'data-security':         ['What is our security posture score?', 'Show critical security findings', 'Which controls have the most gaps?'],
  'analysis':              ['What is our M&A compliance risk profile?', 'Show financial penalty exposure', 'Which OpCos need pre-deal remediation?'],
  'poa-management':        ['Are any Power of Attorney records expiring?', 'Show POA jurisdiction coverage gaps', 'Which entities need POA renewal?'],
  'task-tracker':          ['What compliance tasks are overdue?', 'Show escalated or stale items', 'Who has the most open tasks?'],
  'ip-management':         ['Are any IP assets at risk of expiry?', 'Show trademark registration gaps', 'IP portfolio risk summary?'],
  'licence-management':    ['Which licences are expiring soon?', 'Show regulatory licence compliance', 'Prioritise licence renewals'],
  'litigations-management':['What is our active litigation exposure?', 'Show high-value or critical cases', 'Litigation summary by OpCo?'],
  'contracts-management':  ['Which contracts are expiring soon?', 'Show high-risk contract exposure', 'Contract compliance status?'],
  'org-overview':          ['Show group compliance summary for the board', 'Which OpCos need urgent attention?', 'Top 3 compliance risks?'],
  'org-dashboard':         ['Show compliance scorecard', 'Which frameworks are most critical?', 'What are the key gaps?'],
  'parent-overview':       ['Show group trend analysis', 'Compliance score breakdown by OpCo', 'Risk trajectory overview?'],
  default:                 ['What should I prioritise today?', 'Give me a compliance health overview', 'What are the top risks right now?'],
};

const SEVERITY_META = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  label: 'Critical' },
  high:     { color: '#f97316', bg: 'rgba(249,115,22,0.1)', label: 'High' },
  medium:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Medium' },
  low:      { color: '#10b981', bg: 'rgba(16,185,129,0.1)', label: 'Low' },
};

const RISK_META = {
  low:    { color: '#10b981', label: 'Low risk' },
  medium: { color: '#f59e0b', label: 'Medium risk' },
  high:   { color: '#ef4444', label: 'High risk' },
};

// ─────────────────────────────────────────────────────────────────────────────
// MARKDOWN RENDERER (no external deps)
// ─────────────────────────────────────────────────────────────────────────────

function renderInline(text) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  );
}

function renderMarkdown(text) {
  if (!text) return null;
  const paragraphs = text.split(/\n\n+/);
  return paragraphs.map((para, i) => {
    const lines = para.split('\n');
    if (lines.some(l => /^[-*]\s/.test(l.trim()))) {
      return (
        <ul key={i} className="ga-list">
          {lines.filter(l => l.trim()).map((l, j) => (
            <li key={j} className="ga-list-item">{renderInline(l.replace(/^[-*]\s+/, ''))}</li>
          ))}
        </ul>
      );
    }
    return <p key={i} className="ga-para">{renderInline(para)}</p>;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS (all at module level for Fast Refresh)
// ─────────────────────────────────────────────────────────────────────────────

function ModuleChip({ module }) {
  const meta = MODULE_META[module] || MODULE_META.cross;
  return (
    <span className="ga-module-chip" style={{ color: meta.color, background: meta.bg, borderColor: meta.color + '44' }}>
      {meta.icon} {meta.label}
    </span>
  );
}

function MetricCard({ label, value, trend, change, color }) {
  const clr = { green: '#10b981', red: '#ef4444', amber: '#f59e0b', blue: '#3b82f6', purple: '#a855f7' }[color] || '#3b82f6';
  const trendIcon = trend === 'up' ? '▲' : trend === 'down' ? '▼' : trend === 'flat' ? '→' : '';
  const trendColor = trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#888';
  return (
    <div className="ga-metric-card">
      <div className="ga-metric-value" style={{ color: clr }}>{value}</div>
      <div className="ga-metric-label">{label}</div>
      {(trendIcon || change) && (
        <div className="ga-metric-change" style={{ color: trendColor }}>
          {trendIcon} {change}
        </div>
      )}
    </div>
  );
}

function MiniBarChart({ data, title }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.value || 0), 1);
  return (
    <div className="ga-chart">
      {title && <div className="ga-chart-title">{title}</div>}
      <div className="ga-bar-chart">
        {data.slice(0, 8).map((item, i) => (
          <div key={i} className="ga-bar-col">
            <div className="ga-bar-track">
              <div
                className="ga-bar-fill"
                style={{ height: `${Math.round((item.value / max) * 100)}%`, background: item.color || '#3b82f6' }}
              />
            </div>
            <div className="ga-bar-val">{item.value}</div>
            <div className="ga-bar-label">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniRingChart({ data, title }) {
  if (!data || data.length === 0) return null;
  const item = data[0];
  const pct = Math.min(Math.max(item.value || 0, 0), 100);
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="ga-chart">
      {title && <div className="ga-chart-title">{title}</div>}
      <div className="ga-ring-chart">
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8"/>
          <circle
            cx="40" cy="40" r={r} fill="none"
            stroke={item.color || '#3b82f6'} strokeWidth="8"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeLinecap="round"
            transform="rotate(-90 40 40)"
          />
          <text x="40" y="44" textAnchor="middle" fill="#e8e8f0" fontSize="14" fontWeight="800">{pct}%</text>
        </svg>
        <div className="ga-ring-label">{item.label}</div>
      </div>
    </div>
  );
}

function CorrelationCard({ module, insight, severity }) {
  const sev = SEVERITY_META[severity] || SEVERITY_META.medium;
  const mod = MODULE_META[module] || MODULE_META.cross;
  return (
    <div className="ga-correlation-card" style={{ borderColor: sev.color + '55', background: sev.bg }}>
      <div className="ga-correlation-header">
        <span className="ga-correlation-mod" style={{ color: mod.color }}>{mod.icon} {mod.label}</span>
        <span className="ga-correlation-sev" style={{ color: sev.color }}>{sev.label}</span>
      </div>
      <div className="ga-correlation-insight">{insight}</div>
    </div>
  );
}

function ActionApprovalCard({ action, status, onApprove, onDismiss }) {
  const risk = RISK_META[action.risk] || RISK_META.low;
  const isDone = status === 'done';
  const isErr = status === 'error';
  const isExec = status === 'executing';
  const isDism = status === 'dismissed';

  return (
    <div className={`ga-action-card ${isDism ? 'dismissed' : ''} ${isDone ? 'done' : ''} ${isErr ? 'error' : ''}`}>
      <div className="ga-action-header">
        <span className="ga-action-icon">⚡</span>
        <span className="ga-action-label">{action.label}</span>
        <span className="ga-action-risk" style={{ color: risk.color }}>{risk.label}</span>
      </div>
      <div className="ga-action-desc">{action.description}</div>
      <div className="ga-action-reasoning">
        <span className="ga-action-reasoning-icon">🧠</span>
        <span className="ga-action-reasoning-text">{action.reasoning}</span>
      </div>
      {!isDone && !isDism && !isErr && (
        <div className="ga-action-controls">
          <span className="ga-action-approval-note">⚠ Awaiting your approval</span>
          <div className="ga-action-btns">
            <button className="ga-action-btn-dismiss" onClick={onDismiss} disabled={isExec}>Dismiss</button>
            <button className="ga-action-btn-approve" onClick={onApprove} disabled={isExec}>
              {isExec ? 'Executing…' : 'Approve & Execute'}
            </button>
          </div>
        </div>
      )}
      {isDone && <div className="ga-action-done">✓ Action completed successfully</div>}
      {isErr  && <div className="ga-action-error">✗ Action failed — please try manually</div>}
      {isDism && <div className="ga-action-dismissed-note">Dismissed</div>}
    </div>
  );
}

function ReasoningBlock({ steps, expanded, onToggle }) {
  if (!steps || steps.length === 0) return null;
  return (
    <div className="ga-reasoning">
      <button className="ga-reasoning-toggle" onClick={onToggle}>
        <span className="ga-reasoning-icon">🧠</span>
        <span>Reasoning</span>
        <span className="ga-reasoning-chevron">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <ol className="ga-reasoning-steps">
          {steps.map((step, i) => (
            <li key={i} className="ga-reasoning-step">{step}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

function FollowupChips({ suggestions, onSelect }) {
  if (!suggestions || suggestions.length === 0) return null;
  return (
    <div className="ga-followups">
      {suggestions.map((s, i) => (
        <button key={i} className="ga-followup-chip" onClick={() => onSelect(s)}>{s}</button>
      ))}
    </div>
  );
}

function AssistantMessage({ msg, expandedReasoning, onToggleReasoning, actionStates, onApprove, onDismiss }) {
  const r = msg.response;
  if (!r) return null;

  const chartEl = r.chart?.type === 'bar'
    ? <MiniBarChart data={r.chart.data} title={r.chart.title} />
    : r.chart?.type === 'ring'
      ? <MiniRingChart data={r.chart.data} title={r.chart.title} />
      : null;

  return (
    <div className="ga-msg ga-msg-assistant">
      {/* Module chip + summary */}
      <div className="ga-assistant-header">
        {r.module && <ModuleChip module={r.module} />}
      </div>
      <div className="ga-assistant-summary">{r.summary}</div>

      {/* Metrics row */}
      {r.metrics && r.metrics.length > 0 && (
        <div className="ga-metrics-row">
          {r.metrics.map((m, i) => (
            <MetricCard key={i} {...m} />
          ))}
        </div>
      )}

      {/* Chart */}
      {chartEl}

      {/* Narrative */}
      {r.narrative && (
        <div className="ga-narrative">{renderMarkdown(r.narrative)}</div>
      )}

      {/* Correlations */}
      {r.correlations && r.correlations.length > 0 && (
        <div className="ga-correlations">
          <div className="ga-correlations-title">🔗 Cross-Module Insights</div>
          {r.correlations.map((c, i) => (
            <CorrelationCard key={i} {...c} />
          ))}
        </div>
      )}

      {/* Action approval cards */}
      {r.actions && r.actions.length > 0 && (
        <div className="ga-actions">
          <div className="ga-actions-title">⚡ Suggested Actions</div>
          {r.actions.map((action) => (
            <ActionApprovalCard
              key={action.id}
              action={action}
              status={actionStates[`${msg.id}-${action.id}`] || 'pending'}
              onApprove={() => onApprove(msg.id, action)}
              onDismiss={() => onDismiss(msg.id, action.id)}
            />
          ))}
        </div>
      )}

      {/* Reasoning */}
      <ReasoningBlock
        steps={r.reasoning}
        expanded={expandedReasoning.has(msg.id)}
        onToggle={() => onToggleReasoning(msg.id)}
      />

      {/* Follow-ups */}
      {r.followups && r.followups.length > 0 && (
        <FollowupChips suggestions={r.followups} onSelect={msg.onFollowup} />
      )}
    </div>
  );
}

function UserMessage({ text }) {
  return (
    <div className="ga-msg ga-msg-user">
      <div className="ga-user-bubble">{text}</div>
    </div>
  );
}

function QuickPrompts({ currentView, onSelect }) {
  const prompts = QUICK_PROMPTS[currentView] || QUICK_PROMPTS.default;
  return (
    <div className="ga-quick-prompts">
      <div className="ga-quick-prompts-title">Suggested for this view</div>
      <div className="ga-quick-prompts-grid">
        {prompts.map((p, i) => (
          <button key={i} className="ga-quick-chip" onClick={() => onSelect(p)}>{p}</button>
        ))}
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="ga-msg ga-msg-assistant">
      <div className="ga-thinking">
        <span className="ga-dot" />
        <span className="ga-dot" />
        <span className="ga-dot" />
        <span className="ga-thinking-text">Analysing…</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSISTANT PANEL (main panel body — module level for Fast Refresh)
// ─────────────────────────────────────────────────────────────────────────────

function AssistantPanel({ currentView, selectedRole, selectedParentHolding, onClose }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [persona, setPersona] = useState(() => {
    const roleMap = { board: 'board', 'c-level': 'c-level', 'legal-team': 'legal', 'governance-team': 'governance', 'data-security-team': 'data' };
    return roleMap[selectedRole] || 'c-level';
  });
  const [expandedReasoning, setExpandedReasoning] = useState(new Set());
  const [actionStates, setActionStates] = useState({});
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const msgIdCounter = useRef(0);

  const currentModule = VIEW_TO_MODULE[currentView] || 'overview';

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, isLoading, scrollToBottom]);

  const sendMessage = useCallback(async (text) => {
    const trimmed = typeof text === 'string' ? text.trim() : inputText.trim();
    if (!trimmed || isLoading) return;
    setInputText('');

    const userMsgId = `u-${++msgIdCounter.current}`;
    const assistantMsgId = `a-${++msgIdCounter.current}`;

    // Build history from existing messages for context
    const history = messages.slice(-6).map(m => ({
      role: m.type === 'user' ? 'user' : 'assistant',
      content: m.type === 'user' ? m.text : (m.response?.summary || ''),
    }));

    setMessages(prev => [...prev, { id: userMsgId, type: 'user', text: trimmed }]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history,
          currentModule,
          persona,
          parentHolding: selectedParentHolding || '',
        }),
      });

      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();

      setMessages(prev => [...prev, {
        id: assistantMsgId,
        type: 'assistant',
        response: data,
        // Attach follow-up handler so chips can call sendMessage
        onFollowup: (q) => sendMessage(q),
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: assistantMsgId,
        type: 'assistant',
        response: {
          module: currentModule,
          summary: 'Failed to reach the assistant.',
          narrative: `I couldn't reach the server: **${err.message}**\n\nPlease check your connection and try again.`,
          reasoning: [],
          metrics: [],
          chart: { type: 'none', title: '', data: [] },
          correlations: [],
          actions: [],
          followups: ['Try again', 'Check server status', 'Reload the page'],
        },
        onFollowup: (q) => sendMessage(q),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [inputText, isLoading, messages, currentModule, persona, selectedParentHolding]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputText);
    }
  };

  const toggleReasoning = useCallback((msgId) => {
    setExpandedReasoning(prev => {
      const next = new Set(prev);
      next.has(msgId) ? next.delete(msgId) : next.add(msgId);
      return next;
    });
  }, []);

  const handleApprove = useCallback(async (msgId, action) => {
    const key = `${msgId}-${action.id}`;
    setActionStates(prev => ({ ...prev, [key]: 'executing' }));
    try {
      const res = await fetch(action.endpoint, {
        method: action.method || 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: action.method !== 'GET' ? JSON.stringify(action.payload || {}) : undefined,
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      setActionStates(prev => ({ ...prev, [key]: 'done' }));
    } catch {
      setActionStates(prev => ({ ...prev, [key]: 'error' }));
    }
  }, []);

  const handleDismiss = useCallback((msgId, actionId) => {
    setActionStates(prev => ({ ...prev, [`${msgId}-${actionId}`]: 'dismissed' }));
  }, []);

  const handleClear = () => {
    setMessages([]);
    setExpandedReasoning(new Set());
    setActionStates({});
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="ga-panel">
      {/* Header */}
      <div className="ga-panel-header">
        <div className="ga-panel-title">
          <span className="ga-panel-icon">✦</span>
          <span className="ga-panel-name">GRC Intelligence</span>
          <ModuleChip module={currentModule} />
        </div>
        <div className="ga-panel-controls">
          <select
            className="ga-persona-select"
            value={persona}
            onChange={e => setPersona(e.target.value)}
            title="Select your role for persona-adapted responses"
          >
            {PERSONAS.map(p => (
              <option key={p.value} value={p.value}>{p.icon} {p.label}</option>
            ))}
          </select>
          {hasMessages && (
            <button className="ga-ctrl-btn" onClick={handleClear} title="Clear conversation">↺</button>
          )}
          <button className="ga-ctrl-btn ga-ctrl-close" onClick={onClose} title="Close assistant">✕</button>
        </div>
      </div>

      {/* Persona banner */}
      <div className="ga-persona-banner">
        <span className="ga-persona-label">
          {PERSONAS.find(p => p.value === persona)?.icon} Responding as {PERSONAS.find(p => p.value === persona)?.label}
        </span>
        {selectedParentHolding && (
          <span className="ga-org-chip">{selectedParentHolding}</span>
        )}
      </div>

      {/* Messages + Quick Prompts */}
      <div className="ga-messages-area">
        {!hasMessages && (
          <>
            <div className="ga-welcome">
              <div className="ga-welcome-icon">✦</div>
              <div className="ga-welcome-title">GRC Intelligence Assistant</div>
              <div className="ga-welcome-sub">
                Ask me anything across Governance, Legal, ESG, Data, Ownership, and Analysis. I'll surface insights, flag correlations, and suggest actions — all with your approval.
              </div>
            </div>
            <QuickPrompts currentView={currentView} onSelect={(p) => sendMessage(p)} />
          </>
        )}

        {messages.map(msg =>
          msg.type === 'user'
            ? <UserMessage key={msg.id} text={msg.text} />
            : (
              <AssistantMessage
                key={msg.id}
                msg={msg}
                expandedReasoning={expandedReasoning}
                onToggleReasoning={toggleReasoning}
                actionStates={actionStates}
                onApprove={handleApprove}
                onDismiss={handleDismiss}
              />
            )
        )}

        {isLoading && <ThinkingBubble />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="ga-input-bar">
        <textarea
          ref={inputRef}
          className="ga-input"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about any module… (Enter to send, Shift+Enter for new line)"
          rows={1}
          disabled={isLoading}
        />
        <button
          className="ga-send-btn"
          onClick={() => sendMessage(inputText)}
          disabled={isLoading || !inputText.trim()}
          title="Send"
        >
          ➤
        </button>
      </div>
      <div className="ga-input-hint">Enter to send · Shift+Enter for new line · Actions require your approval</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT EXPORT — floating trigger + panel overlay
// ─────────────────────────────────────────────────────────────────────────────

export default function GlobalAssistant({ currentView, selectedRole, selectedParentHolding }) {
  const [isOpen, setIsOpen] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      {/* Backdrop */}
      {isOpen && <div className="ga-backdrop" onClick={() => setIsOpen(false)} />}

      {/* Slide-in panel */}
      <div className={`ga-panel-wrapper ${isOpen ? 'open' : ''}`}>
        {isOpen && (
          <AssistantPanel
            currentView={currentView}
            selectedRole={selectedRole}
            selectedParentHolding={selectedParentHolding}
            onClose={() => setIsOpen(false)}
          />
        )}
      </div>

      {/* Floating trigger button */}
      <button
        className={`ga-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(o => !o)}
        title="GRC Intelligence Assistant"
        aria-label="Open GRC Intelligence Assistant"
      >
        {isOpen ? <span className="ga-trigger-close">✕</span> : <span className="ga-trigger-icon">✦</span>}
        {!isOpen && <span className="ga-trigger-label">Ask AI</span>}
      </button>
    </>
  );
}
