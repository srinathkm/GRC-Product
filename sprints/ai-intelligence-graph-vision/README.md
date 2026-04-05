# Sprint: AI intelligence & portfolio graph vision

This folder holds the **vision artifact** for predictive and graph-style intelligence on top of Raqib’s existing registers (UBO, ownership graphs, litigations, IP, contracts).

## Contents

| Item | Purpose |
|------|---------|
| [AI_INTELLIGENCE_AND_GRAPH_VISION.md](./AI_INTELLIGENCE_AND_GRAPH_VISION.md) | Full narrative: use cases, architecture Mermaid diagrams, phased delivery, Obsidian positioning |
| [EXECUTION_PLAN_P1.md](./EXECUTION_PLAN_P1.md) | P1 implementation scope and reviewer pre-code gate |
| [REVIEW_REPORT_P1.md](./REVIEW_REPORT_P1.md) | Post-build technical + functional review |
| [assets/cross-holdings-ui-mockup.svg](./assets/cross-holdings-ui-mockup.svg) | UI wireframe: **cross-holdings** (“where else does this owner appear?”) |
| [assets/litigation-ip-impact-mockup.svg](./assets/litigation-ip-impact-mockup.svg) | UI wireframe: **litigation → IP → business** impact strip |

## Implemented in product (P1)

Reference for engineers and reviewers—what shipped and where it lives.

### APIs

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/portfolio-intelligence/cross-holdings?q=…` | Search person/entity name (min 2 chars) against labels in stored ownership graphs; returns holdings rows, `graphContexts` (first graph used for SVG preview), and `explain` metadata. |
| GET | `/api/portfolio-intelligence/litigations/:id/impact` | Load litigation by id; join IP and contracts with same OpCo (and parent when present); returns `impactTier` (`high` / `medium` / `low`), `linkedIp`, `linkedContracts`, `explainability` (rules version, ISO timestamp, human-readable reasons). Errors: `400` missing id, `404` unknown litigation, `500` server error—all JSON `{ error: string }` where applicable. |

Router: [`server/routes/portfolioIntelligence.js`](../../server/routes/portfolioIntelligence.js). Mounted in [`server/index.js`](../../server/index.js) at `/api/portfolio-intelligence`.

### Backend service

| File | Role |
|------|------|
| [`server/services/portfolioIntelligence.js`](../../server/services/portfolioIntelligence.js) | `normalizeLabel`, `labelMatchesQuery`, `computeCrossHoldings` (reads [`ownershipGraphStore`](../../server/services/ownershipGraphStore.js)), `computeLitigationImpact` (reads `server/data/litigations.json`, `ip.json`, `contracts.json`). Deterministic rules only—no ML/LLM. |

### Tests

| File | Notes |
|------|------|
| [`server/tests/portfolioIntelligence.test.js`](../../server/tests/portfolioIntelligence.test.js) | Normalization, query match, cross-holdings fixture (“Faisal”), litigation impact for sample IP dispute id, 404 for unknown id. Run: `node --test server/tests/portfolioIntelligence.test.js`. |

### Client UI

| File | Notes |
|------|------|
| [`client/src/components/PortfolioIntelligence.jsx`](../../client/src/components/PortfolioIntelligence.jsx) | Screen: cross-holdings search + table + optional structure preview SVG; litigation dropdown + impact tier + linked IP/contracts + explainability list. |
| [`client/src/components/PortfolioIntelligence.css`](../../client/src/components/PortfolioIntelligence.css) | Layout aligned with Dependency Intelligence surfaces. |
| [`client/src/App.jsx`](../../client/src/App.jsx) | Renders `PortfolioIntelligence` when `currentView === 'portfolio-intelligence'`; `ROLE_VIEW_IDS` includes `portfolio-intelligence` for applicable roles. |
| [`client/src/components/MainNav.jsx`](../../client/src/components/MainNav.jsx) | Nav label **Portfolio connections** (`navPortfolioIntelligence`) under **Organization Overview** module (so Board/Legal/Governance users with org overview can access it—not only Governance). |
| [`client/src/i18n.js`](../../client/src/i18n.js) | English + Arabic strings for `navPortfolioIntelligence`, `portfolioIntel*` keys; copy is fixed product text, not generated. |

### Product behavior (summary)

- **Cross-holdings:** Matches query against ownership graph node labels; lists each incident edge (subject, counterparty, kind, %). **Evidence** is stored graph edges; UBO rows in browser `localStorage` are not merged in P1.
- **Litigation impact:** Tier from rules (e.g. open + IP-related claim + IP rows in scope → higher tier). **Not** legal advice; explainability lists rule-based reasons.
- **UI:** No chatbot shell; intro states rule-based/citation posture. SVG preview is a deterministic circular layout sketch, not an ML graph layout.

### Related sprint docs

| Doc | Purpose |
|-----|---------|
| [EXECUTION_PLAN_P1.md](./EXECUTION_PLAN_P1.md) | Pre-code scope and reviewer gate |
| [REVIEW_REPORT_P1.md](./REVIEW_REPORT_P1.md) | Post-build review, scorecard, follow-ups |

## How to view

- Open the Markdown file in any Mermaid-capable viewer (GitHub, VS Code with Mermaid extension) for rendered diagrams.
- Open SVGs in a browser or IDE preview.

## Status

Vision doc remains roadmap; P1 above is implemented and rule-based (no LLM output in UI).
