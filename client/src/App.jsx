import { useState, useEffect } from 'react';
import { t } from './i18n';
import { MainNav } from './components/MainNav';
import { Dashboard } from './components/Dashboard';
import { ChatPanel } from './components/ChatPanel';
import { ParentHoldingOverview } from './components/ParentHoldingOverview';
import { EsgSummary } from './components/EsgSummary';
import { MultiJurisdictionMatrix } from './components/MultiJurisdictionMatrix';
import { UltimateBeneficiaryOwner } from './components/UltimateBeneficiaryOwner';
import { Analysis } from './components/Analysis';
import { DataSovereignty } from './components/DataSovereignty';
import { DataSecurityCompliance } from './components/DataSecurityCompliance';
import { Onboarding } from './components/Onboarding';
import { OrganizationOverview } from './components/OrganizationOverview';
import { OrganizationDashboard } from './components/OrganizationDashboard';
import { PlaceholderView } from './components/PlaceholderView';
import { PoaManagement } from './components/PoaManagement';
import { IpManagement } from './components/IpManagement';
import { LicenceManagement } from './components/LicenceManagement';
import { LitigationsManagement } from './components/LitigationsManagement';
import { ContractsManagement } from './components/ContractsManagement';
import { Help } from './components/Help';
import { ManagementDashboard } from './components/ManagementDashboard';
import { TaskTracker } from './components/TaskTracker';
import { LegalOnboarding } from './components/LegalOnboarding';
import GlobalAssistant from './components/GlobalAssistant';

const FRAMEWORKS = [
  'DFSA Rulebook',
  'SAMA',
  'CMA',
  'Dubai 2040',
  'Saudi 2030',
  'SDAIA',
  'ADGM FSRA Rulebook',
  'ADGM Companies Regulations',
  'CBUAE Rulebook',
  'UAE AML/CFT',
  'UAE Federal Laws',
  'JAFZA Operating Regulations',
  'DMCC Company Regulations',
  'DMCC Compliance & AML',
  'QFCRA Rules',
  'Qatar AML Law',
  'CBB Rulebook',
  'BHB Sustainability ESG',
  'Oman CMA Regulations',
  'Oman AML Law',
  'Kuwait CMA Regulations',
  'Kuwait AML Law',
];

const PERIOD_OPTIONS = [
  { value: 30, label: '30 days' },
  { value: 180, label: '6 months' },
  { value: 365, label: '1 year' },
];

const PLACEHOLDER_VIEWS = {};

// Role-based module visibility: which top-level module ids each role can see.
const ROLE_MODULE_IDS = {
  'legal-team': ['org-overview-module', 'legal-module', 'contracts-module'],
  'governance-team': ['org-overview-module', 'governance-module', 'ownership-module'],
  'data-security-team': ['org-overview-module', 'data-module'],
  'c-level': null, // null = all modules
  board: ['org-overview-module', 'analysis-module'],
};

// Views accessible per role (for redirect when switching roles)
const ROLE_VIEW_IDS = {
  'legal-team': ['mgmt-dashboard', 'task-tracker', 'org-overview', 'org-dashboard', 'legal-onboarding', 'poa-management', 'ip-management', 'licence-management', 'litigations-management', 'contracts-management', 'contracts-upload'],
  'governance-team': ['mgmt-dashboard', 'task-tracker', 'onboarding', 'org-overview', 'org-dashboard', 'parent-overview', 'governance-framework', 'multi-jurisdiction', 'ubo'],
  'data-security-team': ['mgmt-dashboard', 'task-tracker', 'org-overview', 'org-dashboard', 'data-sovereignty', 'data-security'],
  board: ['mgmt-dashboard', 'task-tracker', 'org-overview', 'org-dashboard', 'analysis', 'ma-simulator'],
};

const ROLE_OPTIONS = [
  { value: 'legal-team', labelKey: 'roleLegalTeam' },
  { value: 'governance-team', labelKey: 'roleGovernanceTeam' },
  { value: 'data-security-team', labelKey: 'roleDataSecurityTeam' },
  { value: 'c-level', labelKey: 'roleCLevel' },
  { value: 'board', labelKey: 'roleBoard' },
];

// First view to show when switching to this role (if current view is not allowed).
const ROLE_FIRST_VIEW = {
  'legal-team': 'mgmt-dashboard',
  'governance-team': 'mgmt-dashboard',
  'data-security-team': 'mgmt-dashboard',
  'c-level': 'mgmt-dashboard',
  board: 'mgmt-dashboard',
};

const GOVERNANCE_FRAMEWORKS_STORAGE_KEY = 'governance_applicable_frameworks';

function loadApplicableFrameworksFromStorage() {
  try {
    const s = localStorage.getItem(GOVERNANCE_FRAMEWORKS_STORAGE_KEY);
    if (s == null) return null;
    const arr = JSON.parse(s);
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [language, setLanguage] = useState('en');
  const [selectedRole, setSelectedRole] = useState('c-level');
  const [currentView, setCurrentView] = useState('mgmt-dashboard');
  const [framework, setFramework] = useState('');
  const [selectedDays, setSelectedDays] = useState(30);
  const [frameworkReferences, setFrameworkReferences] = useState({});
  const [parentHoldingList, setParentHoldingList] = useState([]);
  const [selectedParentHolding, setSelectedParentHolding] = useState('');
  const [companiesRefreshKey, setCompaniesRefreshKey] = useState(0);
  const [applicableFrameworksForGovernance, setApplicableFrameworksForGovernance] = useState(loadApplicableFrameworksFromStorage);
  const [frameworksForParent, setFrameworksForParent] = useState([]);

  const setApplicableFrameworksLoaded = (list) => {
    const arr = Array.isArray(list) ? list : null;
    setApplicableFrameworksForGovernance(arr);
    try {
      if (arr) localStorage.setItem(GOVERNANCE_FRAMEWORKS_STORAGE_KEY, JSON.stringify(arr));
      else localStorage.removeItem(GOVERNANCE_FRAMEWORKS_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetch('/api/frameworks')
      .then((r) => r.json())
      .then((data) => setFrameworkReferences(data.references || {}))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/companies/roles')
      .then((r) => r.json())
      .then((data) => setParentHoldingList(data.parents || []))
      .catch(() => {});
  }, []);

  const refreshCompanies = () => {
    fetch('/api/companies/roles')
      .then((r) => r.json())
      .then((data) => setParentHoldingList(data.parents || []))
      .catch(() => {});
    setCompaniesRefreshKey((k) => k + 1);
  };

  const isGovernanceFramework = currentView === 'governance-framework';

  // Frameworks to show in Governance view: based on the selected Parent Holding's OpCos,
  // optionally intersected with the global "applicable frameworks" from onboarding.
  useEffect(() => {
    if (!selectedParentHolding) {
      setFrameworksForParent([]);
      return;
    }
    fetch(`/api/companies/by-parent?parent=${encodeURIComponent(selectedParentHolding)}`)
      .then((r) => r.json())
      .then((data) => {
        const opcos = Array.isArray(data.opcos) ? data.opcos : [];
        const set = new Set();
        for (const item of opcos) {
          if (item && item.framework) set.add(item.framework);
          if (Array.isArray(item?.applicableFrameworks)) {
            item.applicableFrameworks.forEach((fw) => {
              if (fw) set.add(fw);
            });
          }
          if (Array.isArray(item?.applicableFrameworksByLocation)) {
            item.applicableFrameworksByLocation.forEach((p) => {
              if (p && p.framework) set.add(p.framework);
            });
          }
        }
        let frameworks = Array.from(set);
        const gate = Array.isArray(applicableFrameworksForGovernance)
          ? applicableFrameworksForGovernance
          : null;
        if (gate && gate.length > 0) {
          frameworks = frameworks.filter((fw) => gate.includes(fw));
        }
        frameworks.sort();
        setFrameworksForParent(frameworks);
      })
      .catch(() => {
        setFrameworksForParent([]);
      });
  }, [selectedParentHolding, companiesRefreshKey, applicableFrameworksForGovernance]);

  const gatedFrameworks = selectedParentHolding ? frameworksForParent : [];

  const allowedModuleIds = ROLE_MODULE_IDS[selectedRole] || null;

  useEffect(() => {
    if (selectedRole === 'c-level') return;
    const allowed = ROLE_MODULE_IDS[selectedRole];
    if (!allowed) return;
    const ids = ROLE_VIEW_IDS[selectedRole];
    if (ids && !ids.includes(currentView)) {
      setCurrentView(ROLE_FIRST_VIEW[selectedRole] || ids[0]);
    }
  }, [selectedRole]);

  const isRtl = language === 'ar';

  return (
    <div className="app" dir={isRtl ? 'rtl' : 'ltr'} lang={isRtl ? 'ar' : 'en'}>
      <header className="header">
        <h1>{t(language, 'appTitle')}</h1>
        <div className="header-actions">
          <Help language={language} />
          <div className="header-roles">
            <label htmlFor="roles-select" className="header-roles-label">{t(language, 'roles')}</label>
            <select
              id="roles-select"
              className="header-roles-select"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              aria-label={t(language, 'roles')}
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{t(language, opt.labelKey)}</option>
              ))}
            </select>
          </div>
          <div className="header-lang">
            <label htmlFor="language-select" className="header-lang-label">{t(language, 'language')}</label>
            <select
              id="language-select"
              className="header-lang-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              aria-label={t(language, 'language')}
            >
              <option value="en">{t(language, 'languageEnglish')}</option>
              <option value="ar">{t(language, 'languageArabic')}</option>
            </select>
          </div>
        </div>
      </header>
      <div className="app-body">
        <MainNav language={language} currentView={currentView} onSelect={setCurrentView} allowedModuleIds={allowedModuleIds} />
        <div className="app-content">
          {currentView === 'mgmt-dashboard' && (
            <ManagementDashboard onNavigateToView={setCurrentView} />
          )}
          {currentView === 'onboarding' && (
            <Onboarding
              language={language}
              onOpcoAdded={refreshCompanies}
              onApplicableFrameworksLoaded={setApplicableFrameworksLoaded}
            />
          )}
          {currentView === 'org-overview' && (
            <OrganizationOverview language={language} onNavigateToView={setCurrentView} selectedRole={selectedRole} />
          )}
          {currentView === 'org-dashboard' && (
            <OrganizationDashboard
              language={language}
              parents={parentHoldingList}
              selectedParentHolding={selectedParentHolding}
              onParentHoldingChange={setSelectedParentHolding}
              onNavigateToView={setCurrentView}
              selectedRole={selectedRole}
            />
          )}
          {currentView === 'parent-overview' && (
            <ParentHoldingOverview
              language={language}
              parents={parentHoldingList}
              selectedParentHolding={selectedParentHolding}
              onParentHoldingChange={setSelectedParentHolding}
              onNavigateToView={setCurrentView}
              companiesRefreshKey={companiesRefreshKey}
            />
          )}
          {currentView === 'legal-onboarding' && (
            <LegalOnboarding
              language={language}
              parents={parentHoldingList}
            />
          )}
          {currentView === 'poa-management' && (
            <PoaManagement
              language={language}
              parents={parentHoldingList}
              selectedParentHolding={selectedParentHolding}
              onParentHoldingChange={setSelectedParentHolding}
            />
          )}
          {currentView === 'ip-management' && (
            <IpManagement
              language={language}
              parents={parentHoldingList}
              selectedParentHolding={selectedParentHolding}
              onParentHoldingChange={setSelectedParentHolding}
            />
          )}
          {currentView === 'licence-management' && (
            <LicenceManagement
              language={language}
              parents={parentHoldingList}
              selectedParentHolding={selectedParentHolding}
              onParentHoldingChange={setSelectedParentHolding}
            />
          )}
          {currentView === 'litigations-management' && (
            <LitigationsManagement
              language={language}
              parents={parentHoldingList}
              selectedParentHolding={selectedParentHolding}
              onParentHoldingChange={setSelectedParentHolding}
            />
          )}
          {(currentView === 'contracts-management' || currentView === 'contracts-upload') && (
            <ContractsManagement
              language={language}
              parents={parentHoldingList}
              selectedParentHolding={selectedParentHolding}
              onParentHoldingChange={setSelectedParentHolding}
              currentView={currentView}
            />
          )}
          {currentView === 'esg' && (
            <EsgSummary language={language} selectedParentHolding={selectedParentHolding} companiesRefreshKey={companiesRefreshKey} />
          )}
          {currentView === 'multi-jurisdiction' && (
            <MultiJurisdictionMatrix language={language} selectedParentHolding={selectedParentHolding} companiesRefreshKey={companiesRefreshKey} />
          )}
          {currentView === 'ubo' && (
            <UltimateBeneficiaryOwner language={language} selectedParentHolding={selectedParentHolding} companiesRefreshKey={companiesRefreshKey} />
          )}
          {(currentView === 'analysis' || currentView === 'ma-simulator') && (
            <Analysis language={language} selectedParentHolding={selectedParentHolding} onParentHoldingChange={setSelectedParentHolding} parents={parentHoldingList} companiesRefreshKey={companiesRefreshKey} activeView={currentView} />
          )}
          {currentView === 'data-sovereignty' && (
            <DataSovereignty language={language} selectedParentHolding={selectedParentHolding} companiesRefreshKey={companiesRefreshKey} />
          )}
          {currentView === 'data-security' && (
            <DataSecurityCompliance language={language} selectedParentHolding={selectedParentHolding} companiesRefreshKey={companiesRefreshKey} />
          )}
          <div
            className="governance-layout"
            style={{ display: isGovernanceFramework ? undefined : 'none' }}
            aria-hidden={!isGovernanceFramework}
          >
            <main className="dashboard-area">
              <Dashboard
                language={language}
                frameworkReferences={frameworkReferences}
                frameworks={gatedFrameworks}
                periodOptions={PERIOD_OPTIONS}
                selectedFramework={framework}
                selectedDays={selectedDays}
                onFrameworkChange={setFramework}
                onPeriodChange={setSelectedDays}
                selectedParentHolding={selectedParentHolding}
                onParentHoldingChange={setSelectedParentHolding}
              />
            </main>
            <aside className="chat-area">
              <ChatPanel />
            </aside>
          </div>
          {currentView === 'task-tracker' && <TaskTracker />}
          {PLACEHOLDER_VIEWS[currentView] && (
            <PlaceholderView
              language={language}
              title={PLACEHOLDER_VIEWS[currentView].title}
              description={PLACEHOLDER_VIEWS[currentView].description}
            />
          )}
        </div>
      </div>
    </div>
    <GlobalAssistant
      currentView={currentView}
      selectedRole={selectedRole}
      selectedParentHolding={selectedParentHolding}
    />
  );
}
