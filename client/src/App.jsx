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
import { PlaceholderView } from './components/PlaceholderView';

const ALL_FRAMEWORKS_VALUE = '__ALL__';

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

export default function App() {
  const [language, setLanguage] = useState('en');
  const [currentView, setCurrentView] = useState('onboarding');
  const [framework, setFramework] = useState('');
  const [selectedDays, setSelectedDays] = useState(30);
  const [frameworkReferences, setFrameworkReferences] = useState({});
  const [parentHoldingList, setParentHoldingList] = useState([]);
  const [selectedParentHolding, setSelectedParentHolding] = useState('');
  const [companiesRefreshKey, setCompaniesRefreshKey] = useState(0);

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

  const isRtl = language === 'ar';

  return (
    <div className="app" dir={isRtl ? 'rtl' : 'ltr'} lang={isRtl ? 'ar' : 'en'}>
      <header className="header">
        <h1>{t(language, 'appTitle')}</h1>
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
      </header>
      <div className="app-body">
        <MainNav language={language} currentView={currentView} onSelect={setCurrentView} />
        <div className="app-content">
          {currentView === 'onboarding' && (
            <Onboarding language={language} onOpcoAdded={refreshCompanies} />
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
          {currentView === 'esg' && (
            <EsgSummary language={language} selectedParentHolding={selectedParentHolding} companiesRefreshKey={companiesRefreshKey} />
          )}
          {currentView === 'multi-jurisdiction' && (
            <MultiJurisdictionMatrix language={language} selectedParentHolding={selectedParentHolding} companiesRefreshKey={companiesRefreshKey} />
          )}
          {currentView === 'ubo' && (
            <UltimateBeneficiaryOwner language={language} selectedParentHolding={selectedParentHolding} companiesRefreshKey={companiesRefreshKey} />
          )}
          {currentView === 'analysis' && (
            <Analysis language={language} selectedParentHolding={selectedParentHolding} onParentHoldingChange={setSelectedParentHolding} parents={parentHoldingList} companiesRefreshKey={companiesRefreshKey} />
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
                allFrameworksValue={ALL_FRAMEWORKS_VALUE}
                frameworkReferences={frameworkReferences}
                frameworks={FRAMEWORKS}
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
  );
}
