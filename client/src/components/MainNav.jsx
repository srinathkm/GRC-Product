import { t } from '../i18n';
import './MainNav.css';

// Top-level modules and their underlying sections/views.
const MODULES = [
  {
    id: 'org-overview-module',
    labelKey: 'navOrgOverview',
    sections: [
      { id: 'org-overview', labelKey: 'navOrgOverview' },
      { id: 'org-dashboard', labelKey: 'navOrgDashboard' },
    ],
  },
  {
    id: 'governance-module',
    labelKey: 'navModuleGovernance',
    sections: [
      { id: 'onboarding', labelKey: 'navOnboarding' },
      { id: 'parent-overview', labelKey: 'navParentOverview' },
      { id: 'governance-framework', labelKey: 'navGovernanceFramework' },
    ],
  },
  {
    id: 'ownership-module',
    labelKey: 'navModuleOwnership',
    sections: [
      { id: 'multi-jurisdiction', labelKey: 'navMultiJurisdiction' },
      { id: 'ubo', labelKey: 'navUbo' },
    ],
  },
  {
    id: 'esg-module',
    labelKey: 'navModuleEsg',
    sections: [{ id: 'esg', labelKey: 'navEsg' }],
  },
  {
    id: 'legal-module',
    labelKey: 'navModuleLegal',
    sections: [
      { id: 'poa-management', labelKey: 'navPoaManagement' },
      { id: 'ip-management', labelKey: 'navIpManagement' },
      { id: 'licence-management', labelKey: 'navLicenceManagement' },
      { id: 'litigations-management', labelKey: 'navLitigationsManagement' },
    ],
  },
  {
    id: 'data-module',
    labelKey: 'navModuleData',
    sections: [
      { id: 'data-sovereignty', labelKey: 'navDataSovereignty' },
      { id: 'data-security', labelKey: 'navDataSecurity' },
    ],
  },
  {
    id: 'analysis-module',
    labelKey: 'navModuleAnalysis',
    sections: [
      { id: 'analysis', labelKey: 'navAnalysis' },
      { id: 'ma-simulator', labelKey: 'navMaSimulator' },
    ],
  },
];

export function MainNav({ language = 'en', currentView, onSelect, allowedModuleIds = null }) {
  const visibleModules = allowedModuleIds == null
    ? MODULES
    : MODULES.filter((m) => allowedModuleIds.includes(m.id));
  const activeModule =
    visibleModules.find((m) => m.sections.some((s) => s.id === currentView)) || visibleModules[0] || { sections: [] };

  return (
    <nav className="main-nav">
      <div className="main-nav-modules">
        {visibleModules.map((module) => {
          const isActive = activeModule && module.id === activeModule.id;
          const defaultSection = module.sections[0];
          return (
            <button
              key={module.id}
              type="button"
              className={`main-nav-module-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelect(defaultSection.id)}
            >
              {t(language, module.labelKey)}
            </button>
          );
        })}
      </div>
      <div className="main-nav-sections">
        {activeModule.sections.map((section) => {
          const isActive = currentView === section.id;
          return (
            <button
              key={section.id}
              type="button"
              className={`main-nav-section-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelect(section.id)}
            >
              {t(language, section.labelKey)}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
