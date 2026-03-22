import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AML_CFT_DOMAINS } from '../data/amlCftChecklistData.js';
import './AmlCftChecklist.css';

const API = import.meta.env.VITE_API_URL || '';

/**
 * AmlCftChecklist
 * ================
 * UAE AML/CFT compliance checklist across 17 regulatory domains.
 * Supports manual checking and AI-assisted auto-checking from an uploaded audit document.
 *
 * Props:
 *   opco      – entity identifier used to persist state per organisation (optional)
 *   language  – locale string (reserved for i18n, unused for now)
 */
export default function AmlCftChecklist({ opco, language }) {
  const entityKey = opco || 'global';

  // ── section open/closed ──────────────────────────────────────────────────
  const [sectionOpen, setSectionOpen] = useState(false);

  // ── per-item state: { [itemId]: { status: 'yes'|'no'|'na'|'', evidenceNote: '' } } ──
  const [itemState, setItemState] = useState({});
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  // ── domain accordion ──────────────────────────────────────────────────────
  const [expandedDomains, setExpandedDomains] = useState({});

  // ── auto-check ────────────────────────────────────────────────────────────
  const [autoChecking, setAutoChecking] = useState(false);
  const [autoMsg, setAutoMsg] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState({});
  const fileInputRef = useRef(null);

  // ── load saved state ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!sectionOpen) return;
    fetch(`${API}/api/aml-checklist/${encodeURIComponent(entityKey)}`)
      .then((r) => r.json())
      .then((data) => setItemState(data.state || {}))
      .catch((e) => setLoadError(e.message));
  }, [sectionOpen, entityKey]);

  // ── helpers ───────────────────────────────────────────────────────────────
  const setStatus = useCallback((id, status) => {
    setItemState((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), status, updatedAt: new Date().toISOString() },
    }));
  }, []);

  const setNote = useCallback((id, evidenceNote) => {
    setItemState((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), evidenceNote, updatedAt: new Date().toISOString() },
    }));
  }, []);

  const toggleDomain = useCallback((domainId) => {
    setExpandedDomains((prev) => ({ ...prev, [domainId]: !prev[domainId] }));
  }, []);

  // ── overall progress ──────────────────────────────────────────────────────
  const totalItems = AML_CFT_DOMAINS.reduce((s, d) => s + d.items.length, 0);
  const answeredItems = Object.values(itemState).filter((v) => v && v.status).length;
  const compliantItems = Object.values(itemState).filter((v) => v && v.status === 'yes').length;
  const pct = totalItems > 0 ? Math.round((answeredItems / totalItems) * 100) : 0;

  // ── save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const r = await fetch(`${API}/api/aml-checklist/${encodeURIComponent(entityKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: itemState }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || r.statusText);
      setSaveMsg({ type: 'success', text: 'Checklist saved.' });
    } catch (e) {
      setSaveMsg({ type: 'error', text: 'Save failed: ' + e.message });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  };

  // ── auto-check ────────────────────────────────────────────────────────────
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setAutoChecking(true);
    setAutoMsg(null);
    const form = new FormData();
    form.append('file', file);
    try {
      const r = await fetch(
        `${API}/api/aml-checklist/${encodeURIComponent(entityKey)}/auto-check`,
        { method: 'POST', body: form }
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || r.statusText);
      const { suggestions } = data;
      setAiSuggestions(suggestions || {});
      // Apply suggestions to state (won't overwrite manually-set items)
      setItemState((prev) => {
        const next = { ...prev };
        for (const [id, status] of Object.entries(suggestions || {})) {
          if (!next[id]?.status) {
            next[id] = { ...(next[id] || {}), status, updatedAt: new Date().toISOString() };
          }
        }
        return next;
      });
      const count = Object.keys(suggestions || {}).length;
      setAutoMsg({ type: 'success', text: `Auto-checked: ${count} items assessed from document.` });
    } catch (e) {
      setAutoMsg({ type: 'error', text: 'Auto-check failed: ' + e.message });
    } finally {
      setAutoChecking(false);
    }
  };

  return (
    <div className="aml-checklist">
      {/* ── collapsible section toggle ── */}
      <button
        className="aml-checklist-toggle"
        onClick={() => setSectionOpen((o) => !o)}
        aria-expanded={sectionOpen}
      >
        <span className="aml-checklist-toggle-icon">🛡️</span>
        <span>UAE AML/CFT Compliance Checklist</span>
        <span style={{ fontSize: '0.77rem', color: '#6b7280', fontWeight: 400, marginLeft: '0.5rem' }}>
          17 domains · {totalItems} controls
        </span>
        <span className={`aml-checklist-toggle-chevron ${sectionOpen ? 'open' : ''}`}>▼</span>
      </button>

      {sectionOpen && (
        <>
          {/* ── progress bar ── */}
          <div className="aml-checklist-progress-bar-wrap">
            <div className="aml-checklist-progress-label">
              <span>{answeredItems} / {totalItems} assessed · {compliantItems} compliant</span>
              <span>{pct}%</span>
            </div>
            <div className="aml-checklist-progress-bar">
              <div className="aml-checklist-progress-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* ── toolbar ── */}
          <div className="aml-checklist-toolbar">
            <span className="aml-checklist-toolbar-label">Auto-check from audit document:</span>
            <button
              className="aml-checklist-upload-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={autoChecking}
            >
              {autoChecking ? '⏳ Analysing…' : '📎 Upload Audit File'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            {autoMsg && (
              <span className={`aml-checklist-auto-msg ${autoMsg.type}`}>{autoMsg.text}</span>
            )}
            <button
              className="aml-checklist-save-btn"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save Checklist'}
            </button>
            {saveMsg && (
              <span className={`aml-checklist-auto-msg ${saveMsg.type}`}>{saveMsg.text}</span>
            )}
          </div>

          {loadError && (
            <p style={{ padding: '0.75rem 1.25rem', color: '#dc2626', fontSize: '0.82rem' }}>
              Could not load saved state: {loadError}
            </p>
          )}

          {/* ── domain accordion list ── */}
          <div className="aml-domains-list">
            {AML_CFT_DOMAINS.map((domain) => {
              const domainItems = domain.items;
              const yes = domainItems.filter((it) => itemState[it.id]?.status === 'yes').length;
              const answered = domainItems.filter((it) => itemState[it.id]?.status).length;
              const isOpen = !!expandedDomains[domain.id];

              return (
                <div key={domain.id} className="aml-domain">
                  <button
                    className="aml-domain-header"
                    onClick={() => toggleDomain(domain.id)}
                    aria-expanded={isOpen}
                  >
                    <span className="aml-domain-id">{domain.id}</span>
                    <span className="aml-domain-name">{domain.domain}</span>
                    <span className="aml-domain-progress">
                      {answered}/{domainItems.length}
                      {answered > 0 && ` · ${yes} ✓`}
                    </span>
                    <span className={`aml-domain-chevron ${isOpen ? 'open' : ''}`}>▼</span>
                  </button>

                  {isOpen && (
                    <div className="aml-items-list">
                      {domainItems.map((item) => {
                        const state = itemState[item.id] || {};
                        const status = state.status || '';
                        const isSuggested = !!(aiSuggestions[item.id] && !state.status);

                        return (
                          <div key={item.id} className="aml-item">
                            <div className="aml-item-left">
                              <div className="aml-item-control-row">
                                <span className="aml-item-id">{item.id}</span>
                                <span className="aml-item-control">{item.control}</span>
                                {item.critical && (
                                  <span className="aml-critical-badge">CRITICAL</span>
                                )}
                              </div>

                              <div className="aml-item-meta">
                                <div className="aml-item-meta-field">
                                  <span className="aml-item-meta-label">Evidence Required</span>
                                  <span className="aml-item-meta-value">{item.evidence}</span>
                                </div>
                                <div className="aml-item-meta-field">
                                  <span className="aml-item-meta-label">Regulatory Ref</span>
                                  <span className="aml-item-meta-value">{item.regulatoryRef}</span>
                                </div>
                                <div className="aml-item-meta-field">
                                  <span className="aml-item-meta-label">Review Frequency</span>
                                  <span className="aml-item-meta-value">{item.reviewFrequency}</span>
                                </div>
                              </div>

                              <div className="aml-item-evidence-note">
                                <textarea
                                  placeholder="Evidence / notes…"
                                  value={state.evidenceNote || ''}
                                  rows={2}
                                  onChange={(e) => setNote(item.id, e.target.value)}
                                />
                              </div>
                            </div>

                            <div className="aml-item-right">
                              <div className="aml-status-group" role="group" aria-label={`Status for ${item.id}`}>
                                {['yes', 'no', 'na'].map((s) => (
                                  <button
                                    key={s}
                                    className={`aml-status-btn ${status === s ? `active-${s}` : ''}`}
                                    onClick={() => setStatus(item.id, s)}
                                    aria-pressed={status === s}
                                  >
                                    {s === 'yes' ? 'Yes' : s === 'no' ? 'No' : 'N/A'}
                                  </button>
                                ))}
                              </div>
                              {isSuggested && (
                                <span className="aml-ai-suggestion">
                                  ✨ AI: {aiSuggestions[item.id]}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
