#!/usr/bin/env node
/**
 * Posts a short verification comment to GitHub issues #31–#38 (EXEC-01…EXEC-08).
 * Requires: export GITHUB_TOKEN=... (repo scope: issues write)
 */
const REPO = 'srinathkm/GRC-Product';
const ISSUES = [
  {
    n: 31,
    body: `**EXEC-01 verification (post-implementation)**\n\n- Removed duplicate \`DependencyIntelligence\` mount in \`App.jsx\`.\n- **Tests:** \`client/npm run build\` OK.\n- **Manual:** Dependency Intelligence loads once; one \`summary\` + one \`clusters\` fetch on load.`,
  },
  {
    n: 32,
    body: `**EXEC-02 verification**\n\n- Management Dashboard is controlled by App state: \`selectedDays\`, \`selectedOpco\`, \`selectedParentHolding\`.\n- \`navigateWithContext\` updates \`selectedDays\` when passed in context.\n- **Tests:** \`npm test\` + \`client npm run build\`.`,
  },
  {
    n: 33,
    body: `**EXEC-03 verification**\n\n- All drill-throughs merge executive context (OpCo, period, parent). Heat map and expiry table pass targeted OpCo/parent.\n- Task Tracker and Data Security receive executive context from App.\n- **Tests:** \`npm test\` + \`client npm run build\`. **Manual:** drill from filtered Management Dashboard.`,
  },
  {
    n: 34,
    body: `**EXEC-04 verification**\n\n- Dependency Intelligence requests include \`days\` and \`opco\` aligned with App; scope line when AI differs from dashboard card.\n- **Automated:** \`server/tests/dashboardDependencyParity.test.js\` asserts \`dependencyIntelligence\` snapshot matches \`GET /api/dependency-intelligence/summary\` for same params.`,
  },
  {
    n: 35,
    body: `**EXEC-05 verification**\n\n- Optional \`opco\` on \`GET /api/changes\` and \`GET /api/changes/summary\`; Governance \`Dashboard\` passes \`regulatoryOpcoFilter\` and shows scope banner.\n- **Tests:** \`npm test\` + manual governance check with OpCo selected.`,
  },
  {
    n: 36,
    body: `**EXEC-06 verification**\n\n- Shared \`server/services/regulatoryMetrics.js\`: demo date normalisation + OpCo filter helpers.\n- Used from \`changes.js\` and \`dashboard.js\`.\n- **Automated:** \`server/tests/regulatoryMetrics.test.js\`.`,
  },
  {
    n: 37,
    body: `**EXEC-07 verification**\n\n- Data Security: provenance banner (deterministic \`dataComplianceDetail\` vs Defender + in-app mocks); \`executiveOpco\` highlights list row.\n- **Tests:** \`client npm run build\`. **Manual:** open module from Management Dashboard with OpCo filter.`,
  },
  {
    n: 38,
    body: `**EXEC-08 verification**\n\n- **Automated:** \`dashboardDependencyParity.test.js\` — compares \`dependencyIntelligence\` fields from \`/api/dashboard/summary\` vs \`/api/dependency-intelligence/summary\` (\`totalClusters\`, \`criticalClusters\`, \`highClusters\`, \`totalExposureAed\`) for portfolio and scoped OpCo.\n- **Suite:** \`cd server && npm test\` → 17 passed.`,
  },
];

const token = process.env.GITHUB_TOKEN?.trim();
if (!token) {
  console.error('Set GITHUB_TOKEN');
  process.exit(1);
}

for (const { n, body } of ISSUES) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/issues/${n}/comments`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`#${n} failed:`, data.message || res.status);
    process.exitCode = 1;
  } else {
    console.log(`Commented #${n} -> ${data.html_url}`);
  }
}
