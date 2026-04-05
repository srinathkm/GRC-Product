# Execution plan — Portfolio intelligence (P0/P1 slice)

## Reviewer gate (pre-code)

**Scope:** Deterministic joins only (no ML/LLM). Evidence-first APIs and a single governance-area screen.

| Item | Result |
|------|--------|
| Business outcome | Users see where an owner or entity appears across uploaded ownership graphs, and see litigation-linked IP/contracts for a case with explainable rules. |
| Out of scope this iteration | LLM summaries, calibrated forecasts, entity-resolution UI merges, audit log of model versions. |
| Data sources | `ownership-graphs/graphs.json`, `litigations.json`, `ip.json`, `contracts.json` (same as existing legal registers). |
| API contract | Versioned under `/api/portfolio-intelligence/*`; errors as JSON `{ error: string }`. |
| Security | Read-only; no new secrets; same CORS/session as rest of app. |

**Reviewer verdict:** **CONDITIONAL APPROVE** — proceed with implementation; follow-up: add pagination if graph count grows.

**Signed-off criteria for “done”:**

1. Unit tests for rule logic (impact tier, name match).
2. Integration-style test or manual checklist: sample data returns non-empty cross-holdings for “Faisal” and impact for `lit-1774879300629-8qa8az`.
3. UI copy is product/legal tone (no chatbot filler; no “AI-generated” labels).

---

## Developer implementation checklist

- [ ] `server/services/portfolioIntelligence.js` — pure functions + file loaders
- [ ] `server/routes/portfolioIntelligence.js` — GET cross-holdings, GET litigation impact
- [ ] `server/index.js` — mount router
- [ ] `server/tests/portfolioIntelligence.test.js`
- [ ] `client/src/components/PortfolioIntelligence.jsx` + CSS
- [ ] `MainNav` + `App.jsx` + `ROLE_VIEW_IDS` + i18n keys

---

## ADR-001 (lightweight)

**Title:** Deterministic portfolio intelligence before ML  
**Decision:** Ship rule-based joins and explainability first.  
**Rationale:** Aligns with sprint vision P0/P1; avoids un-auditable outputs.
