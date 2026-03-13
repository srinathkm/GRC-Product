# Raqib – Compliance Intelligence Platform
## Application Review Report

**Date:** 13 March 2026
**Branch:** `claude/app-review-documentation-EhmkD`
**Reviewers:** Multi-persona analysis (Product Manager · Domain Expert · Solutions Architect · End User)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Manager Perspective](#2-product-manager-perspective)
3. [Domain Expert Perspective (GRC / RegTech)](#3-domain-expert-perspective-grc--regtech)
4. [Solutions Architect Perspective](#4-solutions-architect-perspective)
5. [End User Perspective](#5-end-user-perspective)
6. [UI/UX Capability Analysis](#6-uiux-capability-analysis)
7. [Design Strengths](#7-design-strengths)
8. [Areas Requiring Tightening](#8-areas-requiring-tightening)
9. [Implemented Improvements (This Review Cycle)](#9-implemented-improvements-this-review-cycle)
10. [Recommended Next Steps](#10-recommended-next-steps)

---

## 1. Executive Summary

**Raqib** is a Governance, Risk & Compliance (GRC) intelligence platform built specifically for multi-entity corporate groups operating across GCC jurisdictions (UAE, KSA, Qatar, Bahrain, Oman, Kuwait). It automates regulatory monitoring, entity onboarding, legal operations management, ownership disclosure (UBO), ESG tracking, data sovereignty compliance, contract lifecycle management, and AI-driven risk analysis.

**Platform Maturity: Early Production / Advanced MVP**

The product demonstrates strong domain understanding, a coherent UX concept, and impressive breadth — covering 22 GCC regulatory frameworks across 8 functional modules. However, several architectural decisions appropriate for MVP development (flat-file JSON storage, frontend-only RBAC, static regulatory data) now constrain the path to enterprise scale and must be addressed in the next product phase.

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Domain Coverage | ★★★★☆ | 22 GCC frameworks; some jurisdictions thin |
| UI/UX Design | ★★★★☆ | Consistent dark theme; large CSS file |
| Architecture | ★★★☆☆ | Clean patterns; flat-file storage limits scale |
| Code Quality | ★★★☆☆ | Well-structured; some monolithic components |
| Security | ★★☆☆☆ | Frontend-only RBAC; no rate limiting |
| Scalability | ★★☆☆☆ | Single node; no database |

---

## 2. Product Manager Perspective

### 2.1 Product Vision & Market Fit

Raqib occupies a well-defined niche: **GCC-specific multi-entity compliance intelligence**. The combination of:
- 22 regulatory frameworks from DFSA, SAMA, CBUAE, CMA, ADGM, QFCRA, CBB, and others
- Multi-jurisdiction entity management (parent holdings → OpCo hierarchies)
- AI-assisted document extraction (UBO, POA, contracts)
- Arabic language + RTL support

…positions it as a credible alternative to generic global GRC tools for regional financial services groups. This niche is underserved by Tier-1 platforms (MetricStream, ServiceNow GRC, Archer) which lack GCC regulatory depth.

### 2.2 Feature Completeness

| Module | Status | Completeness |
|--------|--------|-------------|
| Onboarding / Entity Management | ✅ Live | ~75% — no bulk import |
| Governance Framework Summary | ✅ Live | ~80% — LLM lookup works |
| UBO Register | ✅ Live | ~70% — no BO threshold validation |
| Multi-Jurisdiction Matrix | ✅ Live | ~85% |
| ESG Maturity Assessment | ✅ Live | ~60% — self-reported only |
| Legal Ops (POA, IP, Licences, Litigations) | ✅ Live | ~80% |
| Contract Lifecycle Management | ✅ Live | ~75% |
| Data Sovereignty | ✅ Live (now dynamic) | ~75% |
| Microsoft Defender Integration | ✅ Live | ~65% |
| Risk Predictor / M&A Simulator | ✅ Live | ~70% |
| Management Dashboard | ✅ Live (newly added) | ~80% |

### 2.3 Feature Gaps (Product Roadmap Priorities)

**P0 – Revenue Blockers:**
- No **persistent audit trail** — compliance teams need an immutable log of who changed what and when. Without this, the product cannot be used in regulated environments.
- No **task/action tracking** — regulatory changes need to be assigned to owners with due dates and status tracking. Currently, changes are informational only.
- **RBAC is frontend-only** — any technical user can call the API directly and bypass role restrictions. This is a security liability.

**P1 – Competitive Gaps:**
- No **real-time regulatory feeds** — changes currently come from static JSON or on-demand LLM lookup. The newly implemented 24h feed cron (see §9) is a first step, but live webhook/RSS feeds from regulators would be a key differentiator.
- No **workflow approvals** — POA, contract, and UBO changes should trigger an approval workflow before going live.
- No **multi-tenancy** — all data is shared in the same store. Enterprise clients require data isolation.

**P2 – Product Polish:**
- No global **search** across modules (search for an entity name and see all POAs, contracts, licences, litigations in one place)
- No **in-app notifications** for approaching deadlines (email alerts exist for reports; push/in-app alerts are missing)
- **Onboarding wizard** is 1,870 lines — needs to be broken into a guided multi-step flow with progress indicators

### 2.4 Analytics & Reporting

The newly added **Management Dashboard** addresses the cross-portfolio KPI gap. Remaining analytics needs:
- Export to Excel/CSV for all modules (currently only PDF/XBRL for governance changes)
- Scheduled report delivery (weekly digest emails to C-level and Board)
- Board pack generation (single-click multi-module PDF combining dashboard + key metrics)

---

## 3. Domain Expert Perspective (GRC / RegTech)

### 3.1 Regulatory Coverage Strengths

The platform shows genuine GCC regulatory expertise:

| Jurisdiction | Frameworks | Depth |
|-------------|-----------|-------|
| UAE (mainland) | UAE Federal Laws, CBUAE, UAE AML/CFT | ★★★★★ |
| UAE (free zones) | DFSA, ADGM FSRA, ADGM Companies, JAFZA, DMCC (×2) | ★★★★☆ |
| UAE (sector) | ADHICS, DHA HDPR | ★★★☆☆ |
| KSA | SAMA, CMA, Saudi 2030, SDAIA | ★★★★☆ |
| Qatar | QFCRA, Qatar AML | ★★★☆☆ |
| Bahrain | CBB, BHB ESG | ★★★☆☆ |
| Oman | Oman CMA, Oman AML | ★★☆☆☆ |
| Kuwait | Kuwait CMA, Kuwait AML | ★★☆☆☆ |

### 3.2 Coverage Gaps

Critical frameworks missing from the current product:
- **FATF** (Financial Action Task Force) — the global AML/CTF standard that underpins all GCC AML frameworks
- **PCI-DSS** — mandatory for any entity processing card payments; affects most financial OpCos
- **ISO 27001 / NESA (UAE)** — cybersecurity baseline; referenced in many CBUAE and ADGM requirements
- **IFRS 17** — insurance contracts; relevant for insurance OpCos in CBUAE-regulated groups
- **DIFC Employment Law** — critical for DIFC entities' HR compliance

### 3.3 Compliance Process Gaps

**Regulatory Change Monitoring:**
- The LLM-based change lookup (`lookupChangesForFramework`) is creative but has epistemic limitations: GPT models have knowledge cutoffs and may hallucinate change dates or references.
- **Recommended:** Supplement with scraping of official gazette URLs (CBUAE rulebook, DFSA RM, SAMA website) and flag LLM-generated changes as "AI-inferred" pending verification.

**UBO Handling:**
- AI extraction of beneficial ownership is impressive and correctly handles PDF and image documents.
- **Gap:** No BO threshold validation (≥25% is the GCC standard, with some jurisdictions at ≥10% for financial entities). The platform accepts any percentage without flagging ownership structures that should trigger BO disclosure.
- **Gap:** No chain-of-ownership calculation through intermediate holding structures.

**Data Sovereignty:**
- The newly implemented LLM-driven dynamic checks (§9) improve currency.
- **Gap:** Self-assessment only — no evidence collection or testing against actual data flows.
- The `OPCO_COMPLIANCE_MOCK` data in `DataSovereignty.jsx` (lines 120–166) is hardcoded against specific named entities; onboarded OpCos use default assumptions.

**ESG Module:**
- Maturity assessment is self-reported with no third-party verification.
- The 8-capability model is reasonable but does not align with any specific GCC ESG reporting standard (Abu Dhabi Framework, Tadawul ESG Disclosure Guidelines, DFM ESG Reporting Guide).
- **Recommended:** Map the maturity dimensions explicitly to Tadawul/DFM/ADX/BHB disclosure requirements.

**Audit & Attestation:**
- No immutable audit trail exists. All data files (`changes.json`, `poa.json`, etc.) are mutable JSON with no version history or tamper detection.
- For regulated use, all data mutations must be logged with: timestamp, user identity, old value, new value, IP address.

### 3.4 Risk Scoring

The Security Posture Score (SPS) formula in `server/services/defenderScoringService.js` is a reasonable weighted composite. However:
- The penalty model (financial penalty per finding) uses hardcoded AED amounts not grounded in specific regulatory penalty schedules.
- The M&A simulator produces compliance impact scores but these are not validated against regulatory merger filing requirements (e.g., CBUAE merger approval, ADGM market conduct rules).

---

## 4. Solutions Architect Perspective

### 4.1 Architecture Overview

```
┌─────────────────────────────────────────┐
│         React 18 SPA (Vite)             │
│  39 components · Pure CSS · Recharts    │
└──────────────────┬──────────────────────┘
                   │ /api/* (HTTP/JSON)
┌──────────────────▼──────────────────────┐
│         Express 4 / Node.js             │
│  15 route files · 9 service files       │
│  OpenAI-compatible LLM via fetch()      │
└──────────────────┬──────────────────────┘
                   │ fs/promises read/write
┌──────────────────▼──────────────────────┐
│         JSON flat files (server/data/)  │
│  changes.json · companies.json · poa   │
│  licences · contracts · ip · litigations│
└─────────────────────────────────────────┘
```

### 4.2 Architecture Strengths

| Strength | Detail |
|----------|--------|
| Clean route → service → data layering | Each domain has its own route file with business logic delegated to service files |
| LLM abstraction | `services/llm.js` is a thin, swappable wrapper over any OpenAI-compatible API |
| Docker single-image deploy | Client is built and served from Express static; simple ops story |
| Environment-based config | All secrets via `.env`; no hardcoded credentials in code |
| LLM guardrails | `services/guardrails.js` prevents out-of-scope queries in the chat panel |
| i18n architecture | `i18n.js` handles EN/AR with RTL switching cleanly |

### 4.3 Critical Architectural Risks

#### Risk 1: Flat-file JSON Storage (Severity: CRITICAL)
**Problem:** All application data is stored in JSON files with no database. This means:
- No ACID guarantees — concurrent writes can corrupt files
- No query capability — all filtering is in-memory (works at demo scale, breaks at 10k+ records)
- No backup/recovery mechanism
- No schema validation on write

**Recommendation:** Migrate to SQLite (minimal ops overhead, no server needed) or PostgreSQL. The service pattern (`readFile` → `JSON.parse` → filter → `writeFile`) can be adapted with minimal disruption.

#### Risk 2: Frontend-Only RBAC (Severity: CRITICAL)
**Problem:** Role restrictions are enforced only in `App.jsx` via `ROLE_MODULE_IDS`. All API endpoints are publicly accessible regardless of the logged-in role.

**Example:** A `board` user (who should only see org-overview and analysis) can call `POST /api/poa` directly to read or modify any POA record.

**Recommendation:** Add middleware in `server/index.js` that reads the session role and validates API endpoint access:
```javascript
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const role = req.session?.user?.role;
    if (!role || (!allowedRoles.includes(role) && role !== 'c-level')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
```

#### Risk 3: In-Memory Session Store (Severity: HIGH)
**Problem:** `server/routes/auth.js` stores sessions in a `Map` object in memory. These sessions are lost on server restart and cannot support horizontal scaling.

**Recommendation:** Switch to `express-session` with a file or Redis store.

#### Risk 4: LocalStorage for UBO Data (Severity: HIGH)
**Problem:** UBO register data is persisted in `localStorage` (`ubo_register` key), meaning it is siloed per browser, never backed up to the server, and invisible to other users.

**Recommendation:** Persist UBO data via `POST /api/ubo` to `server/data/ubo.json` (the UBO API route already exists for document extraction — extend it for register persistence).

#### Risk 5: No Input Sanitisation (Severity: MEDIUM)
**Problem:** API endpoints accept free-form JSON without sanitising against XSS, injection, or oversized payloads beyond `multer` file size limits.

**Recommendation:** Add `express-validator` for API input validation and `DOMPurify` on the frontend for any rendered HTML.

#### Risk 6: Dependency Vulnerabilities
| Package | Risk | Action |
|---------|------|--------|
| `xlsx` 0.18.5 | Known CVEs (prototype pollution) | Upgrade to `exceljs` or pin to patched fork |
| `pdf-parse` 2.x | Unverified fork (original abandoned) | Switch to `pdfjs-dist` |
| `openai` 4.73.0 | Pinned; monitor for security advisories | Set up Dependabot |

### 4.4 Observability Gap

The application has no structured logging, no metrics endpoint, and no error aggregation. In production:
- All errors go to `console.error` with no correlation IDs
- No request tracing between frontend and backend
- The health endpoint (`GET /api/health`) only checks server liveness, not data integrity

**Recommendation:** Add `pino` for structured logging and expose a `GET /api/health/full` endpoint that checks file system access, LLM connectivity, and memory usage.

---

## 5. End User Perspective

### 5.1 First Impressions (New User)

**Positive:**
- The dark theme is visually professional and appropriate for a compliance dashboard
- The role selector in the header immediately orientates the user to their context
- The Management Dashboard (newly added) now gives first-time users a clear overview without needing to understand the full navigation structure

**Negative:**
- Without the Management Dashboard, the first screen was the Onboarding module — a complex, multi-step form that is overwhelming without context
- There are no tooltips or contextual help on key fields (e.g., what is a "parent holding" vs an "OpCo"?)
- The two-level navigation (module tabs → section buttons) is clean but provides no breadcrumbs — users lose their context when navigating between modules

### 5.2 Navigation & Information Architecture

| Issue | Severity | Detail |
|-------|---------|--------|
| No breadcrumbs | Medium | After clicking through 3 levels, users don't know where they are |
| No back button | Medium | Navigating back requires remembering the module structure |
| Module tab active state | Low | Active module tab is styled correctly but the selected section could be more prominent |
| No global search | High | Cannot search across all entities, POAs, contracts, etc. |

### 5.3 Form UX

| Issue | Severity | Detail |
|-------|---------|--------|
| No autosave | High | Refreshing the browser loses all unsaved form data |
| No inline help | Medium | Complex fields (UBO ownership %, POA scope) have no contextual help |
| Validation timing | Low | Some fields only validate on submit rather than on blur |
| File upload feedback | Medium | Large file uploads have a spinner but no progress percentage |
| Arabic form labels | Low | RTL rendering is correct but some form labels are not translated |

### 5.4 AI Feature UX

The AI-assisted features (document extraction, chat, risk prediction) are the product's biggest differentiators. However:
- Long AI calls (30–60+ seconds for document extraction) show a basic spinner with no progress indication or cancellation option
- The Chat panel has no conversation history persistence — closing the panel loses all context
- AI extraction errors show raw server messages rather than user-friendly guidance

### 5.5 Data Display

| Issue | Severity | Detail |
|-------|---------|--------|
| Wide tables on mobile | Medium | Contracts, POA, and licence tables break on screens <768px |
| Empty state messages | Low | Most empty states are generic "No data" text; could guide the user to the next action |
| Date formatting | Low | Dates displayed in `YYYY-MM-DD` format; should respect locale |
| Number formatting | Low | Arabic numerals applied in AR mode but currency symbols are English |

---

## 6. UI/UX Capability Analysis

### 6.1 Design System

The application uses a hand-crafted CSS design system built on CSS custom properties:

```css
:root {
  --bg: #0f1419;       /* Dark background */
  --surface: #1a2332;  /* Card surfaces */
  --accent: #3b82f6;   /* Primary blue */
  --success: #22c55e;
  --warning: #eab308;
  --font: 'DM Sans', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}
```

**Strengths:**
- Consistent colour palette applied across all 39 components
- CSS variable system allows theme-wide changes from a single file
- Sensible typography scale (DM Sans for UI, JetBrains Mono for data)
- Smooth transitions (0.15s–0.8s) create a polished feel

**Weaknesses:**
- The global CSS file (`client/src/styles/index.css`) is **25,000+ lines** — this is technically unmanageable. Finding and modifying a specific component style requires search rather than navigation.
- No CSS modules or CSS-in-JS — all class names are global and risk collision
- No Storybook or documented component catalogue — new developers have no reference for UI patterns

### 6.2 Data Visualisation

| Component | Library | Strengths | Weaknesses |
|-----------|---------|-----------|-----------|
| Governance trend lines | Recharts (ComposedChart) | Responsive, accessible | Mock data mixed with real data |
| Score gauges | Custom SVG | Lightweight, no dependencies | Not reusable between components |
| Issue severity bar | Custom CSS | Clear visual hierarchy | Not accessible (no ARIA labels on segments) |
| Framework bars (new) | Custom CSS | Lightweight | Not true Recharts — consider unifying |

### 6.3 Accessibility

| Check | Status | Notes |
|-------|--------|-------|
| ARIA labels on buttons | ✅ Mostly present | Some icon-only buttons missing `aria-label` |
| Semantic HTML structure | ✅ Good | `section`, `nav`, `main`, `aside` used correctly |
| Keyboard navigation | ⚠️ Partial | Tab focus visible; click-outside detection traps keyboard |
| Colour contrast (WCAG AA) | ⚠️ Not audited | `--text-muted: #8b9cb8` on `--bg: #0f1419` may fail at small sizes |
| Screen reader compatibility | ❌ Not tested | No automated a11y test suite |
| RTL layout | ✅ Complete | Arabic RTL fully implemented in all components |

---

## 7. Design Strengths

The following are genuine design strengths that should be maintained and built upon:

1. **GCC Regulatory Depth** — 22 frameworks with accurate authority names, URLs, and descriptions is a rare differentiator. The `FRAMEWORK_REFERENCES` constant is exceptionally well-curated.

2. **LLM Integration Pattern** — The `services/llm.js` abstraction is clean. Switching from OpenAI to any other provider (Mistral, Anthropic, Azure OpenAI) requires only `.env` changes. The prompt engineering in `lookupChangesForFramework` is well-structured.

3. **Route → Service → Data Separation** — Each domain (POA, IP, licences, etc.) has a dedicated route file and the business logic is kept in service files. This makes the backend highly maintainable.

4. **Arabic Bilingual Support** — RTL layout, Arabic numerals, and complete translation coverage (`i18n.js`, 274 lines) is production-grade and genuinely rare in enterprise GRC tools targeting GCC markets.

5. **Role-Based Module Visibility** — The `ROLE_MODULE_IDS` / `ROLE_VIEW_IDS` RBAC model is well-conceived. The five roles (legal-team, governance-team, data-security-team, c-level, board) map directly to real organisational structures in GCC holding companies.

6. **AI Guardrails** — `services/guardrails.js` prevents the chat assistant from answering out-of-scope questions. The topic whitelist is well-defined.

7. **Component Breadth** — 8 full functional modules in a single application without requiring external tools is a strong value proposition for mid-market GCC groups.

8. **Management Dashboard (New)** — Cross-portfolio KPI aggregation with one-click navigation to modules addresses the #1 usability gap.

9. **XBRL Export (New)** — Regulatory-format data export alongside PDF positions the product for regulatory submission readiness.

10. **Dynamic Data Sovereignty (New)** — LLM-driven check updates with 24h caching removes manual maintenance burden and keeps the product current with regulatory changes.

---

## 8. Areas Requiring Tightening

### P0 — Critical (Must Fix Before Enterprise Sales)

| # | Issue | Impact | File / Location |
|---|-------|--------|----------------|
| P0-1 | Backend RBAC enforcement absent — API endpoints unprotected | Security breach risk | `server/index.js`, all route files |
| P0-2 | No immutable audit trail for data mutations | Compliance violation | New service needed |
| P0-3 | Flat-file JSON storage — no ACID, corruption risk under concurrent writes | Data loss | All `server/data/*.json` usage |
| P0-4 | In-memory session store — lost on restart | Authentication failure | `server/routes/auth.js` |

### P1 — High (Fix in Next Sprint)

| # | Issue | Impact | File / Location |
|---|-------|--------|----------------|
| P1-1 | UBO data in `localStorage` — not persisted to server | Data loss for users | `client/src/components/UltimateBeneficiaryOwner.jsx` |
| P1-2 | `xlsx` 0.18.5 known CVEs | Security vulnerability | `server/package.json` |
| P1-3 | No task/action tracking for regulatory changes | Workflow gap | New module needed |
| P1-4 | No autosave on forms | User data loss | All CRUD form components |
| P1-5 | AI document extraction — no progress indicator for long calls | UX regression | `Onboarding.jsx`, `PoaManagement.jsx` |
| P1-6 | No global search across modules | Usability gap | New API endpoint + component |
| P1-7 | Chat panel loses history on close | UX regression | `ChatPanel.jsx` |
| P1-8 | UBO BO threshold not validated (≥25% rule) | Compliance gap | `UltimateBeneficiaryOwner.jsx` |

### P2 — Medium (Backlog)

| # | Issue | Impact | File / Location |
|---|-------|--------|----------------|
| P2-1 | 25,000-line CSS file — no component scoping | Maintainability | `client/src/styles/index.css` |
| P2-2 | Onboarding (1,870 lines) — needs decomposition | Maintainability | `client/src/components/Onboarding.jsx` |
| P2-3 | UBO component (1,737 lines) — needs decomposition | Maintainability | `client/src/components/UltimateBeneficiaryOwner.jsx` |
| P2-4 | WCAG AA contrast audit needed | Accessibility | `client/src/styles/index.css` |
| P2-5 | Mobile table layout breaks at <768px | Usability | Multiple table components |
| P2-6 | No breadcrumbs or back navigation | Usability | `MainNav.jsx` |
| P2-7 | OPCO_COMPLIANCE_MOCK hardcoded against named entities | Data quality | `DataSovereignty.jsx` |
| P2-8 | ESG module not mapped to specific GCC exchange standards | Domain gap | `EsgSummary.jsx` |
| P2-9 | LLM-sourced regulatory changes not flagged as "AI-inferred" | Trust/transparency | `Dashboard.jsx`, `changes.json` |
| P2-10 | No scheduled digest email delivery | Feature gap | `email.js` route |

---

## 9. Implemented Improvements (This Review Cycle)

The following features were implemented as part of this review:

### 9.1 Live Regulatory Feed Scheduler

**Files:** `server/services/regulatoryFeed.js` (new) · `server/routes/changes.js` (updated) · `server/index.js` (updated)

A 24-hour background scheduler now automatically calls `lookupChangesForFramework` for all 22 frameworks and merges new changes into `changes.json`. A `POST /api/changes/refresh` endpoint allows manual triggering, and `GET /api/changes/feed-meta` returns the last run timestamp and statistics.

The scheduler starts 15 seconds after server boot to allow initialisation to complete, then runs every 24 hours. Feed interval is configurable via `FEED_INTERVAL_MS` environment variable.

### 9.2 LLM-Driven Dynamic Data Sovereignty Checks

**Files:** `server/routes/dataSovereignty.js` (new) · `client/src/components/DataSovereignty.jsx` (updated) · `server/index.js` (updated)

A new `GET /api/data-sovereignty/checks` endpoint uses the LLM to generate current, jurisdiction-specific data sovereignty compliance checks for UAE, KSA, Qatar, Bahrain, Oman, Kuwait, and GCC-wide requirements. Results are cached in `server/data/data-sovereignty-checks.json` for 24 hours.

The `DataSovereignty.jsx` component now loads checks from the API on mount (falling back to the hardcoded static list if the API is unavailable). A "Refresh Checks" button triggers a force-refresh. A green "AI-updated" badge shows when dynamic checks are active and displays the last refresh date.

A `POST /api/data-sovereignty/checks/refresh` endpoint force-invalidates the cache and regenerates from the LLM.

### 9.3 Rich PDF Layout + XBRL Export

**Files:** `server/routes/pdf.js` (updated)

The PDF export (`POST /api/pdf`) was significantly enhanced:
- **Cover page** with branded header strip, report title, period, and a summary statistics box (total changes, frameworks covered, critical deadlines, generation date)
- **Framework references** listed on the cover page with authority names and official URLs
- **Per-change cards** with coloured left accent bars (colour-coded by category: Banking, Cybersecurity, AML, ESG, Governance, Disclosure, General), category badge, separator lines, and source URL
- **Header and footer** on every page with Raqib branding, generation date, confidentiality notice, and page numbers

A new **XBRL export** endpoint (`POST /api/pdf/xbrl`) generates an XBRL instance document using the `raqib` namespace taxonomy. The document includes:
- Report-level context with start/end dates and entity identifier
- Per-change contexts with instant dates
- Report facts: title, period, generated date, total counts, critical count
- Per-change facts: id, framework, title, category, date, deadline, summary, source URL

An "Export XBRL" button was added to the Governance Framework Summary dashboard alongside the existing "Download as PDF" button.

### 9.4 Management KPI Dashboard

**Files:** `server/routes/dashboard.js` (new) · `client/src/components/ManagementDashboard.jsx` (new) · `client/src/components/ManagementDashboard.css` (new) · `client/src/App.jsx` (updated) · `client/src/components/MainNav.jsx` (updated) · `client/src/i18n.js` (updated) · `server/index.js` (updated)

A new cross-portfolio Management Dashboard provides senior stakeholders with a single view of compliance health across all entities.

**Structure:**

```
┌─ Header ──────────────────────────────────────────────┐
│  Management Dashboard  [Period ▼] [Refresh]           │
│  Feed: 13 Mar · Updated 09:41:22                      │
├─ KPI Row (5 tiles) ────────────────────────────────────┤
│  Health Score │ Reg Changes │ Critical │ Expiring │ Entities │
├─ Legal Ops KPI Row (5 tiles) ──────────────────────────┤
│  POAs │ Licences │ Contracts │ Litigations │ IP Assets │
├─ Middle Row (2 panels) ────────────────────────────────┤
│  Framework Activity Bar Chart  │  OpCo Heat Map       │
├─ Bottom Row ──────────────────────────────────────────┤
│  Upcoming Expirations Table    │  Quick Navigation     │
└───────────────────────────────────────────────────────┘
```

**Key features:**
- **Compliance Health Score** — SVG semicircle gauge (0–100) calculated from critical change rate, expiry risk, and overdue items. Colour-coded: green (≥80), blue (≥65), yellow (≥40), red (<40).
- **KPI tiles** — clickable; each tile navigates to the relevant module
- **Framework Activity Chart** — horizontal bar chart of change volume per framework (last N days); click to navigate to Governance Framework Summary
- **OpCo Heat Map** — grid of OpCo cells colour-coded by regulatory change exposure (red = high, green = low); click to navigate to Organisation Dashboard
- **Expiry Tracker** — table of soonest-expiring POAs, Licences, and Contracts (within 60 days) with day-count chips and click-to-navigate per row
- **Quick Navigation** — 8 action tiles for direct access to all key modules
- The dashboard aggregates data from a single `GET /api/dashboard/summary` endpoint (parallel reads from all data sources) with configurable time period (30d / 6m / 1y)
- The Management Dashboard is now the **default landing view** for all roles; the previous default (Onboarding) is still accessible via the Governance Module tab

---

## 10. Recommended Next Steps

### Sprint 1 (Security & Data Integrity)

1. **Implement backend RBAC middleware** — protect API routes with role checks extracted from session
2. **Replace localStorage UBO storage** with server-side persistence via `POST /api/ubo/register`
3. **Add write-locking to JSON files** — use `proper-lockfile` or migrate to SQLite for atomic writes
4. **Upgrade `xlsx`** → `exceljs` (no known CVEs, actively maintained)
5. **Implement audit log** — append-only `server/data/audit.json` recording all mutations with user, timestamp, entity, before/after

### Sprint 2 (Workflow & UX)

6. **Add task/action tracking module** — link each regulatory change to an assigned owner, due date, and completion status
7. **Implement autosave** for all CRUD forms using debounced `PATCH` to the server
8. **Add AI call progress indicators** — stream extraction status updates via Server-Sent Events
9. **Global entity search** — new `GET /api/search?q=` endpoint covering all data sources
10. **Persist chat history** — store conversation in sessionStorage with server-side context management

### Sprint 3 (Scale & Analytics)

11. **PostgreSQL migration** — replace JSON flat files; use Prisma or Drizzle ORM
12. **Scheduled digest emails** — weekly compliance summary delivered to role-specific recipients
13. **Board pack PDF** — single-click generation of a multi-section board report combining dashboard KPIs, framework changes, and expiry tracker
14. **FATF and PCI-DSS frameworks** — add to the 22 existing frameworks
15. **ESG mapping to GCC exchange standards** — align maturity dimensions with Tadawul/DFM/ADX/BHB requirements

---

*Report generated by Claude Code (claude-sonnet-4-6) · Raqib Compliance Intelligence Platform · GRC Product Review*
