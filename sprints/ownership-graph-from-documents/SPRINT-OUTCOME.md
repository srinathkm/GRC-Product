# Sprint outcome — Ownership graph from documents

Date: 2026-04-03  
Scope: Implementation aligned with [`ownership-graph-from-documents-plan.md`](./ownership-graph-from-documents-plan.md).

## Summary

End-to-end ownership graph extraction (LLM → validated `OwnershipGraphV1`), `POST /api/ubo/ownership-graph/extract`, optional `includeOwnershipGraph` on `POST /api/ubo/extract-org-from-file`, and a new **Ownership graph** tab in UBO with React Flow + dagre layout, minimap, search, focal subject, path highlighting, loading/empty/error handling, reduced-motion support, and human-readable copy.

---

## Ticket-style log (design → build → test → review)

### OG-1 — ADR-301..303 and API alignment

| Field | Detail |
| --- | --- |
| **Status** | Done |
| **Design** | [`docs/adr/ADR-301-ownership-graph-canonical-model.md`](../../docs/adr/ADR-301-ownership-graph-canonical-model.md), [`ADR-302`](../../docs/adr/ADR-302-react-flow-visualization.md), [`ADR-303`](../../docs/adr/ADR-303-llm-ownership-extraction.md) |
| **Implementation** | Canonical model and validation in `server/services/ownershipGraphModel.js`; errors follow existing JSON `{ error }` patterns; partial/degraded results use explicit `warnings[]` per ADR-103 spirit |
| **Tests** | N/A (docs); server tests cover model |
| **Reviewer notes** | Full “formal” ADR-103 taxonomy (400/422/503) is not duplicated on every UBO route today; new route returns **200** with `warnings` when LLM is off or extraction is empty to match degraded-mode policy. Optional follow-up: normalize error codes across UBO |

### OG-2 — OwnershipGraphV1 + extraction service

| Field | Detail |
| --- | --- |
| **Status** | Done |
| **Design** | Nodes (person/corporate/trust/fund/unknown), edges (`owns`/`controls`/`votes`), citations, cycle flags, `subjectNodeId` |
| **Implementation** | `server/services/ownershipGraphExtract.js` + `ownershipGraphModel.js` (normalize, validate, Tarjan-style SCC for cycles) |
| **Tests** | `server/tests/ownershipGraphModel.test.js` — validate, cycle detection, normalize, merge edges, subject hint fallback |
| **Reviewer notes** | **HIGH (product)**: Graph remains decision-support; disclaimers in UI footer and panel copy. **MEDIUM**: Fuzzy merge of entity aliases deferred (per plan Phase 3) |

### OG-3 — API: POST extract (+ optional bundle on extract-org-from-file)

| Field | Detail |
| --- | --- |
| **Status** | Done |
| **Endpoints** | `POST /api/ubo/ownership-graph/extract` (multipart `file`, optional `subjectHint`); `POST /api/ubo/extract-org-from-file` accepts `includeOwnershipGraph` to add `ownershipGraph`, `ownershipGraphWarnings`, `ownershipGraphMeta` |
| **Tests** | Covered indirectly via model tests; manual smoke: upload + response shape |
| **Reviewer notes** | **LOW**: `422` on text-extract failure for ownership route only — client handles `graph` + `warnings` in body |

### OG-4 — OwnershipGraphView (React Flow + dagre + pane)

| Field | Detail |
| --- | --- |
| **Status** | Done |
| **Implementation** | `client/src/components/ownership/OwnershipGraphView.jsx`, `OwnershipGraph.css`; lazy chunk `OwnershipGraphPanel.jsx` |
| **UX coverage** | Focal subject styling, Focus subject (fit view), layout direction + `localStorage`, search (dim non-matches), path dropdown + edge highlight, minimap, cycle / partial banners, detail pane hierarchy, `aria-live` on pane, reduced motion for fit |
| **Tests** | `npm run build` (client); no Playwright in repo — **acceptance tests** remain manual per plan |
| **Reviewer notes** | **MEDIUM**: “Open in UBO register” cross-link not wired (P2 in plan). **LOW**: Edge-click pane (v1.1) not implemented. **OBSERVATION**: Coach marks listed as optional — not added |

### OG-5 — UBO integration

| Field | Detail |
| --- | --- |
| **Status** | Done |
| **Implementation** | New tab in `UltimateBeneficiaryOwner.jsx`; `subjectHint` from parent holding name when available |
| **Tests** | Build + lint clean |
| **Reviewer notes** | Regression risk low: new tab only; existing flows untouched |

---

## Test matrix (executed)

| Check | Result |
| --- | --- |
| `server`: `node --test` (full suite) | **38 passed** (includes 6 new ownership graph model tests) |
| `client`: `npm run build` | **OK** |
| Lint (edited files) | **No issues** |

---

## Independent review (reviewer skill — condensed)

**Context assembled:** Sprint plan (incl. UX deep dive), ADRs, code, tests, no separate Figma file in repo (per plan placeholder).

**Verdict:** **CONDITIONAL PASS** for production — no CRITICAL security findings for this slice; UBO routes remain unauthenticated like the rest of the app (pre-existing). **Deploy with:** user education on LLM limits + verify citations in real runs.

**Findings register (abbreviated)**

| ID | Severity | Title | Mitigation |
| --- | --- | --- | --- |
| REV-OG-001 | MEDIUM | LLM may hallucinate edges | Disclaimers + citations field + warnings; future: human confirmation step |
| REV-OG-002 | RESOLVED | E2E for graph tab | `e2e/ubo-ownership-graph.spec.js` + `npm run test:e2e` (Playwright, mocked APIs) |
| REV-OG-003 | OBSERVATION | Document text may hit 80k char cap | `extractionMeta.truncated` possible extension |

**Destructive / edge scenarios (sample)** — DTC-style coverage for QA: no file; corrupt PDF; LLM off; empty text; 200+ nodes; cycle in graph; rapid double upload; XSS in labels (output is React text nodes — safe); path dropdown with no path.

**Questions for closure (short answers required in next iteration)**

1. Should `extract-org-from-file` default `includeOwnershipGraph` to off permanently to control cost? **Yes — opt-in only (current).**  
2. Is server-side retention of graphs required in Q2? **Implemented (workspace JSON store):** `server/services/ownershipGraphStore.js`, `GET/POST /api/ubo/ownership-graph/...`, keyed by parent + OpCo scope.

---

## Phase 2 backlog (2026-04-04)

| Item | Implementation |
| --- | --- |
| Figma asset in repo | `sprints/ownership-graph-from-documents/assets/` — README + `ownership-graph-desktop.svg` |
| GET persistence | `GET /api/ubo/ownership-graph/:contextId`, `POST /api/ubo/ownership-graph/save`, `server/data/ownership-graphs/graphs.json` |
| Open in UBO register | `OwnershipGraphView` node pane → `registerOpcoNames` match → switches to register tab + `setViewingOpco` |
| Edge-click pane | `onEdgeClick` + relationship section in `DetailPane` |
| Coach marks | `OwnershipCoachMarks.jsx`, dismiss → `localStorage` |
| Automated E2E | `@playwright/test`, `playwright.config.cjs`, `e2e/ubo-ownership-graph.spec.js` |

---

## Files touched (reference)

- Server: `server/services/ownershipGraphModel.js`, `server/services/ownershipGraphExtract.js`, `server/services/ownershipGraphStore.js`, `server/routes/ubo.js`, `server/tests/ownershipGraphModel.test.js`, `server/tests/ownershipGraphStore.test.js`, `server/data/ownership-graphs/graphs.json`
- Client: `client/src/components/ownership/*`, `client/src/components/UltimateBeneficiaryOwner.jsx`, `client/src/components/OrganizationDashboard.jsx`, `client/src/components/MainNav.jsx`, `client/package.json`
- E2E: `e2e/ubo-ownership-graph.spec.js`, `playwright.config.cjs`, root `package.json`
- Docs: `docs/adr/ADR-301*.md` … `ADR-303*.md`, sprint `assets/`
- This file: sprint outcomes and review record
