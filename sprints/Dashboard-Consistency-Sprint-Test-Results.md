# Dashboard–Module Consistency Sprint — verification

**Branch / commit:** (fill on merge)  
**Date:** 2026-04-01

## Automated test run

From `server/`:

```bash
npm test
```

**Result:** 17 passed, 0 failed (includes new `regulatoryMetrics.test.js` and `dashboardDependencyParity.test.js`).

From `client/`:

```bash
npm run build
```

**Result:** Vite production build succeeded.

## Mapping: ticket → tests / checks

| Ticket | Verification |
|--------|----------------|
| **EXEC-01** | Duplicate `DependencyIntelligence` mount removed in `App.jsx`. **Manual:** open Dependency Intelligence once; Network tab shows a single pair of `summary` + `clusters` requests on load. |
| **EXEC-02** | Management Dashboard uses App `selectedDays` / `selectedOpco` / `selectedParentHolding` props; `navigateWithContext` accepts `selectedDays`. **Integration:** change period on Management Dashboard → open Governance Framework → period selector matches. |
| **EXEC-03** | Drill-through passes merged context (`selectedOpco`, `selectedDays`, `selectedParentHolding`); heat map sets OpCo; expiry rows pass OpCo/parent; data compliance / task links pass context. **Manual:** filter OpCo on Management Dashboard → navigate via links → header/banners reflect scope. |
| **EXEC-04** | `DependencyIntelligence` sends `days` + `opco` on summary, clusters, and detail requests; scope line in UI. **Automated:** `dashboardDependencyParity.test.js` (with and without `opco`). |
| **EXEC-05** | `GET /api/changes` and `GET /api/changes/summary` accept optional `opco`; `Dashboard.jsx` passes `regulatoryOpcoFilter` and shows scope banner. **Manual:** OpCo selected → Governance Framework shows banner and filtered counts. |
| **EXEC-06** | `server/services/regulatoryMetrics.js` shared by `dashboard.js` and `changes.js`. **Automated:** `regulatoryMetrics.test.js`. |
| **EXEC-07** | `DataSecurityCompliance`: provenance banner + executive OpCo highlight. **Manual:** open Data Security from Management Dashboard with OpCo selected. |
| **EXEC-08** | Contract parity dashboard vs dependency API. **Automated:** `dashboardDependencyParity.test.js`. |

## Posting results to GitHub issues

If `GITHUB_TOKEN` has `issues:write` on `srinathkm/GRC-Product`:

```bash
export GITHUB_TOKEN=...
node scripts/post-dashboard-consistency-issue-comments.mjs
```

Or paste the per-issue notes from this file into issues [#31](https://github.com/srinathkm/GRC-Product/issues/31)–[#38](https://github.com/srinathkm/GRC-Product/issues/38).
