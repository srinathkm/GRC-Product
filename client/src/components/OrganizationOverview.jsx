import { useEffect, useMemo, useState } from 'react';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function computeStatus(record) {
  if (record.revoked) return 'Revoked';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (record.validUntil) {
    const end = new Date(record.validUntil);
    end.setHours(0, 0, 0, 0);
    if (Number.isNaN(end.getTime())) return 'Unknown';
    const diffDays = Math.ceil((end - today) / ONE_DAY_MS);
    if (diffDays < 0) return 'Expired';
    if (diffDays <= 30) return 'Expiring soon';
    return 'Active';
  }
  return 'Active';
}

function showCardForRole(role, card) {
  if (!role || role === 'c-level') return true;
  if (role === 'board') return true;
  if (role === 'legal-team') return card === 'legal';
  if (role === 'governance-team') return card === 'governance-overdue' || card === 'governance-due-soon';
  if (role === 'data-security-team') return card === 'data';
  return true;
}

export function OrganizationOverview({ language = 'en', onNavigateToView, selectedRole = '' }) {
  const handleNavigate = (viewId) => {
    if (typeof onNavigateToView === 'function') {
      onNavigateToView(viewId);
    }
  };

  const [allOpcos, setAllOpcos] = useState([]);
  const [selectedOpco, setSelectedOpco] = useState('');
  const [govLoading, setGovLoading] = useState(false);
  const [legalLoading, setLegalLoading] = useState(false);
  const [govData, setGovData] = useState(null);
  const [legalData, setLegalData] = useState([]);

  // Load all OpCos across all parents (no filter).
  useEffect(() => {
    fetch('/api/companies/roles')
      .then((r) => r.json())
      .then((data) => {
        const opcos = Array.isArray(data.opcos) ? data.opcos : [];
        setAllOpcos(opcos);
      })
      .catch(() => setAllOpcos([]));
  }, []);

  // Load governance and legal data when an OpCo is selected.
  useEffect(() => {
    if (!selectedOpco) {
      setGovData(null);
      setLegalData([]);
      return;
    }

    // Governance: changes and deadlines per framework for this OpCo.
    setGovLoading(true);
    fetch(`/api/changes/opco-alerts?days=365&opco=${encodeURIComponent(selectedOpco)}`)
      .then((r) => r.json())
      .then((data) => {
        const row = Array.isArray(data) ? data[0] : null;
        setGovData(row || null);
      })
      .catch(() => setGovData(null))
      .finally(() => setGovLoading(false));

    // Legal: POAs for this OpCo (across all parents).
    setLegalLoading(true);
    fetch(`/api/poa?opco=${encodeURIComponent(selectedOpco)}`)
      .then((r) => r.json())
      .then((data) => setLegalData(Array.isArray(data) ? data : []))
      .catch(() => setLegalData([]))
      .finally(() => setLegalLoading(false));
  }, [selectedOpco]);

  const governanceSummary = useMemo(() => {
    if (!govData || !Array.isArray(govData.frameworks) || govData.frameworks.length === 0) {
      return {
        overdueFrameworks: 0,
        dueSoonFrameworks: 0,
        overdueList: [],
        dueSoonList: [],
      };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdueFrameworks = new Set();
    const dueSoonFrameworks = new Set();
    const overdueList = [];
    const dueSoonList = [];

    for (const fw of govData.frameworks) {
      if (!fw || !Array.isArray(fw.changes)) continue;
      let hasOverdue = false;
      let hasDueSoon = false;
      for (const c of fw.changes) {
        if (!c || !c.deadline) continue;
        const d = new Date(c.deadline);
        if (Number.isNaN(d.getTime())) continue;
        d.setHours(0, 0, 0, 0);
        const daysLeft = Math.ceil((d - today) / ONE_DAY_MS);
        if (daysLeft < 0) {
          hasOverdue = true;
        } else if (daysLeft <= 30) {
          hasDueSoon = true;
        }
      }
      if (hasOverdue) {
        overdueFrameworks.add(fw.framework);
        overdueList.push(fw.framework);
      }
      if (hasDueSoon) {
        dueSoonFrameworks.add(fw.framework);
        dueSoonList.push(fw.framework);
      }
    }

    return {
      overdueFrameworks: overdueFrameworks.size,
      dueSoonFrameworks: dueSoonFrameworks.size,
      overdueList: Array.from(overdueFrameworks),
      dueSoonList: Array.from(dueSoonFrameworks),
    };
  }, [govData]);

  const legalSummary = useMemo(() => {
    if (!Array.isArray(legalData) || legalData.length === 0) {
      return {
        expiringSoonCount: 0,
        expiredCount: 0,
        expiringSoonFileIds: [],
        expiredFileIds: [],
      };
    }
    let expiringSoonCount = 0;
    let expiredCount = 0;
    const expiringSoonFileIds = [];
    const expiredFileIds = [];
    for (const r of legalData) {
      const status = computeStatus(r);
      if (status === 'Expiring soon') {
        expiringSoonCount += 1;
        if (r.fileId) expiringSoonFileIds.push(r.fileId);
      }
      if (status === 'Expired') {
        expiredCount += 1;
        if (r.fileId) expiredFileIds.push(r.fileId);
      }
    }
    return {
      expiringSoonCount,
      expiredCount,
      expiringSoonFileIds,
      expiredFileIds,
    };
  }, [legalData]);

  return (
    <div className="org-overview">
      <h2 className="org-overview-title">Organization Overview</h2>
      <p className="org-overview-intro">
        Select any Operating Company to see a consolidated view of its governance, legal, and data-related obligations.
      </p>

      <div className="org-overview-layout">
        <aside className="org-overview-sidebar">
          <h3 className="org-overview-sidebar-title">Operating Companies</h3>
          {allOpcos.length === 0 ? (
            <p className="org-overview-empty">No OpCos found. Use Onboarding to add entities.</p>
          ) : (
            <select
              className="org-overview-opco-select"
              value={selectedOpco}
              onChange={(e) => setSelectedOpco(e.target.value)}
            >
              <option value="">Select OpCo…</option>
              {allOpcos.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )}
        </aside>

        <section className="org-overview-cards">
          {showCardForRole(selectedRole, 'governance-overdue') && (
          <button
            type="button"
            className="org-overview-card org-overview-card-clickable"
            onClick={() => handleNavigate('governance-framework')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleNavigate('governance-framework');
              }
            }}
          >
            <h3 className="org-overview-card-title">Frameworks Overdue</h3>
            {!selectedOpco ? (
              <p className="org-overview-hint">Select an OpCo to see governance status.</p>
            ) : govLoading ? (
              <p className="org-overview-hint">Loading governance data…</p>
            ) : (
              <>
                <p className="org-overview-metric">
                  <span className="org-overview-metric-value">{governanceSummary.overdueFrameworks}</span>
                  <span className="org-overview-metric-label"> of the frameworks overdue</span>
                </p>
                {governanceSummary.overdueList.length > 0 && (
                  <p className="org-overview-metric-detail">
                    {governanceSummary.overdueList.join(', ')}
                  </p>
                )}
              </>
            )}
            <span className="org-overview-card-link" role="link" tabIndex={0} onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleNavigate('governance-framework'); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNavigate('governance-framework'); } }}>Go to Governance Framework →</span>
          </button>
          )}
          {showCardForRole(selectedRole, 'governance-due-soon') && (
          <button
            type="button"
            className="org-overview-card org-overview-card-clickable"
            onClick={() => handleNavigate('governance-framework')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleNavigate('governance-framework');
              }
            }}
          >
            <h3 className="org-overview-card-title">Frameworks Deadline ≤30 Days</h3>
            {!selectedOpco ? (
              <p className="org-overview-hint">Select an OpCo to see governance status.</p>
            ) : govLoading ? (
              <p className="org-overview-hint">Loading governance data…</p>
            ) : (
              <>
                <p className="org-overview-metric">
                  <span className="org-overview-metric-value">{governanceSummary.dueSoonFrameworks}</span>
                  <span className="org-overview-metric-label"> of frameworks whose deadlines in less than or equal to 30 days</span>
                </p>
                {governanceSummary.dueSoonList.length > 0 && (
                  <p className="org-overview-metric-detail">
                    {governanceSummary.dueSoonList.join(', ')}
                  </p>
                )}
              </>
            )}
            <span className="org-overview-card-link" role="link" tabIndex={0} onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleNavigate('governance-framework'); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNavigate('governance-framework'); } }}>Go to Governance Framework →</span>
          </button>
          )}
          {showCardForRole(selectedRole, 'legal') && (
          <button
            type="button"
            className="org-overview-card org-overview-card-clickable"
            onClick={() => handleNavigate('poa-management')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleNavigate('poa-management');
              }
            }}
          >
            <h3 className="org-overview-card-title">Legal Summary</h3>
            {!selectedOpco ? (
              <p className="org-overview-hint">Select an OpCo to see its POA status.</p>
            ) : legalLoading ? (
              <p className="org-overview-hint">Loading POA data…</p>
            ) : (
              <>
                <p className="org-overview-metric">
                  <span className="org-overview-metric-label">POAs expiring in ≤ 30 days:</span>
                  <span className="org-overview-metric-value">{legalSummary.expiringSoonCount}</span>
                </p>
                {legalSummary.expiringSoonFileIds.length > 0 && (
                  <p className="org-overview-metric-detail">
                    File IDs: {legalSummary.expiringSoonFileIds.join(', ')}
                  </p>
                )}
                <p className="org-overview-metric">
                  <span className="org-overview-metric-label">Expired POAs:</span>
                  <span className="org-overview-metric-value">{legalSummary.expiredCount}</span>
                </p>
                {legalSummary.expiredFileIds.length > 0 && (
                  <p className="org-overview-metric-detail">
                    File IDs: {legalSummary.expiredFileIds.join(', ')}
                  </p>
                )}
              </>
            )}
            <span className="org-overview-card-link" role="link" tabIndex={0} onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleNavigate('poa-management'); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNavigate('poa-management'); } }}>Go to POA Management →</span>
          </button>
          )}
          {showCardForRole(selectedRole, 'data') && (
          <button
            type="button"
            className="org-overview-card org-overview-card-clickable"
            onClick={() => handleNavigate('data-sovereignty')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleNavigate('data-sovereignty');
              }
            }}
          >
            <h3 className="org-overview-card-title">Data Summary</h3>
            <p className="org-overview-hint">
              This section will summarise data sovereignty and security obligations for the selected OpCo.
            </p>
            <span className="org-overview-card-link" role="link" tabIndex={0} onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleNavigate('data-sovereignty'); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNavigate('data-sovereignty'); } }}>Go to Data Sovereignty →</span>
          </button>
          )}
        </section>
      </div>
    </div>
  );
}

