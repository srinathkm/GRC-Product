import { t } from '../i18n';
import './MainNav.css';

const MENU_ITEMS = [
  { id: 'onboarding', labelKey: 'navOnboarding' },
  { id: 'parent-overview', labelKey: 'navParentOverview' },
  { id: 'governance-framework', labelKey: 'navGovernanceFramework' },
  { id: 'multi-jurisdiction', labelKey: 'navMultiJurisdiction' },
  { id: 'ubo', labelKey: 'navUbo' },
  { id: 'esg', labelKey: 'navEsg' },
  { id: 'data-sovereignty', labelKey: 'navDataSovereignty' },
  { id: 'data-security', labelKey: 'navDataSecurity' },
  { id: 'analysis', labelKey: 'navAnalysis' },
];

export function MainNav({ language = 'en', currentView, onSelect }) {
  return (
    <nav className="main-nav">
      <ul className="main-nav-list">
        {MENU_ITEMS.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={`main-nav-item ${currentView === item.id ? 'active' : ''}`}
              onClick={() => onSelect(item.id)}
            >
              {t(language, item.labelKey)}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
