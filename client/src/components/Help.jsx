import { useState, useEffect, useRef } from 'react';
import {
  GCC_FRAMEWORKS_ZONES,
  ESG_MENA_FRAMEWORKS,
  DATA_COMPLIANCE_FRAMEWORKS,
  DATA_SECURITY_FRAMEWORKS,
  SUPPORTED_COUNTRIES,
} from '../data/helpReferenceData.js';
import './Help.css';

const API = '/api';

export function Help({ language = 'en' }) {
  const [open, setOpen] = useState(false);
  const [governanceFrameworks, setGovernanceFrameworks] = useState([]);
  const panelRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/frameworks`)
      .then((r) => r.json())
      .then((data) => setGovernanceFrameworks(Array.isArray(data.frameworks) ? data.frameworks : []))
      .catch(() => setGovernanceFrameworks([]));
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="help-wrap" ref={panelRef}>
      <button
        type="button"
        className="help-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        Help
      </button>
      {open && (
        <div className="help-panel">
          <h2 className="help-panel-title">Help</h2>
          <div className="help-sections">
            <section className="help-section">
              <h3 className="help-section-title">Governance frameworks supported</h3>
              <ul className="help-list">
                {governanceFrameworks.map((fw) => (
                  <li key={fw}>{fw}</li>
                ))}
              </ul>
            </section>
            <section className="help-section">
              <h3 className="help-section-title">Countries supported for frameworks</h3>
              <ul className="help-list">
                {SUPPORTED_COUNTRIES.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </section>
            <section className="help-section">
              <h3 className="help-section-title">GCC frameworks</h3>
              <p className="help-section-desc">Free zones and jurisdictions in the GCC with applicable regulations.</p>
              {GCC_FRAMEWORKS_ZONES.map((zone) => (
                <div key={zone.id} className="help-gcc-zone">
                  <div className="help-gcc-zone-header">
                    <span className="help-gcc-zone-name">{zone.name}</span>
                    <span className="help-gcc-zone-meta">{zone.type} · {zone.location}</span>
                  </div>
                  <p className="help-gcc-zone-desc">{zone.description}</p>
                  <p className="help-gcc-regs-title">Applicable regulations:</p>
                  <ul className="help-gcc-regs">
                    {zone.regulations.map((reg, i) => (
                      <li key={i}><strong>{reg.name}</strong> — {reg.category}: {reg.scope}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
            <section className="help-section">
              <h3 className="help-section-title">ESG frameworks for MENA and the Middle East</h3>
              <p className="help-section-desc">Frameworks and standards applicable to ESG reporting and disclosure in the MENA region.</p>
              <ul className="help-esg-list">
                {ESG_MENA_FRAMEWORKS.map((fw, i) => (
                  <li key={i}>
                    <strong>{fw.name}</strong> ({fw.region}) — {fw.focus}
                  </li>
                ))}
              </ul>
            </section>
            <section className="help-section">
              <h3 className="help-section-title">Data compliance frameworks supported</h3>
              <p className="help-section-desc">Data sovereignty and data security frameworks.</p>
              <h4 className="help-subtitle">Data sovereignty by jurisdiction</h4>
              <ul className="help-list">
                {DATA_COMPLIANCE_FRAMEWORKS.map((row, i) => (
                  <li key={i}><strong>{row.jurisdiction}</strong>: {row.framework}</li>
                ))}
              </ul>
              <h4 className="help-subtitle">Data security &amp; cyber frameworks</h4>
              <ul className="help-list">
                {DATA_SECURITY_FRAMEWORKS.map((fw, i) => (
                  <li key={i}><strong>{fw.label}</strong> — {fw.description}</li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
