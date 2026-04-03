# End-to-end architecture: Snowflake intelligence platform (GRC demo)

This document is the **single entry point** for implementers. Each layer is segregated so teams (data, app, ML, security) can work in parallel.

---

## 1. Database layer (Snowflake)

**Purpose:** System of record and analytics engine for all entities currently in `server/data/*.json` and computed dashboard outputs.

**Schemas (in `GRC_DEMO_DB`):**

| Schema | Role |
|--------|------|
| `RAW` | Land `VARIANT` payloads from JSON exports, document metadata, API dumps |
| `CURATED` | Normalized dimensions, bridges, facts (star/snowflake schema) |
| `ANALYTICS` | Views and later dynamic tables / materialized views for UI and APIs |
| `ML` | Feature tables, model registry, prediction outputs, run logs (Cortex + tabular ML) |
| `APP` | Optional app-specific config (RBAC mapping, feature flags for Streamlit) |

**Key capabilities (must not be skipped for implementation):**

- **Referential grain:** `DIM_PARENT_HOLDING`, `DIM_OPCO`, `DIM_FRAMEWORK`, bridges for OpCo–framework, OpCo–licensing authority, locations.
- **Regulatory:** `FACT_REGULATORY_CHANGE`, optional `BRIDGE_CHANGE_AFFECTED_OPCO`, separate row or VARIANT for long text / embeddings.
- **Legal registers:** POA, licences, contracts, IP, litigation linked to OpCo/parent and `DIM_LEGAL_DOCUMENT` (stage path + hash + extracted VARIANT).
- **Governance / ops:** `FACT_TASK`, `FACT_AUDIT_EVENT`, `FACT_ONBOARDING_SUBMISSION`, `BRIDGE_OPCO_MULTI_SHAREHOLDER`, ESG metrics.
- **Data compliance:** `FACT_DATA_SOVEREIGNTY_CHECK`, AI model usage / cross-border risk source data.
- **Defender / security posture:** uploads, snapshots, findings, scores, summaries (mirrors [docs/SYSTEM_DESIGN.md](../../docs/SYSTEM_DESIGN.md) section 1.5).
- **Operational metadata:** `feed-meta.json` equivalent for regulatory feed runs.

**Ingest pattern:** Internal stage → `COPY INTO RAW.*` (JSON) → SQL or Snowpark procedure → `CURATED.*` → task-driven refresh of `ANALYTICS.*`.

---

## 2. Frontend layer (Streamlit in Snowflake)

**Purpose:** Optional **fully Snowflake-hosted** UI for demos (no separate Node/React host).

**Capabilities to replicate from the React app (parity checklist):**

- Role-based navigation (map Snowflake role or `APP.USER_PAGE_ACCESS` to allowed pages).
- Parent holding / OpCo scoping (same mental model as [client/src/App.jsx](../../client/src/App.jsx)).
- Management dashboard KPIs (from `ANALYTICS.VW_*`).
- Governance: framework + period filters, change lists (from `FACT_REGULATORY_CHANGE` + bridges).
- Legal module: POA, IP, licences, litigations, contracts (CRUD or read-only for demo).
- Data: sovereignty matrix, Defender posture, summaries.
- Task tracker and dependency-style rollups (from curated + analytics views).

**Implementation notes:** See [streamlit/README.md](../streamlit/README.md). Use `session.sql()` against views, not wide joins in the UI layer.

---

## 3. Intelligence layer (orchestration)

**Purpose:** Define **how** insights are produced, scheduled, and exposed—not only which model is called.

**Components:**

- **Refresh orchestration:** Snowflake `TASK` trees: RAW load → curated merge → analytics view refresh → feature build → prediction insert.
- **Context assembly:** SQL views that build a single `VARIANT` or `VARCHAR` “context document” per OpCo (open tasks, overdue legal, critical findings, recent changes).
- **Human-in-the-loop:** Tables for `review_status`, `approved_summary`, `feedback` linked to `ML.CORTEX_RUN_LOG`.

**Essential for implementation:** Every production insight should be traceable to **inputs** (view version, row ids) and **outputs** (stored text/score).

---

## 4. AI layer (LLM / Cortex)

**Purpose:** Natural language Q&A, summarization, extraction—**Snowflake-native where possible**.

**Patterns:**

- **Cortex COMPLETE** (or equivalent): summarize Defender context, explain compliance health drivers, draft remediation text from `ANALYTICS.VW_OPCO_INTELLIGENCE_CONTEXT`.
- **Cortex Search / RAG:** Chunk `FACT_REGULATORY_CHANGE` text and legal documents into `ML.DOCUMENT_CHUNK` with embeddings; search scoped by framework and OpCo.
- **Document AI / parsers:** Upload PDF/CSV to stage; async task parses into `DIM_LEGAL_DOCUMENT.extracted_variant` and normalized columns.

**Guardrails:** Prompt templates versioned in `ML.PROMPT_TEMPLATE`; store template id + hash on each run in `ML.CORTEX_RUN_LOG`.

---

## 5. ML layer (tabular models)

**Purpose:** Predictive risk scores, classification (e.g. escalation likelihood), anomaly flags—**separate from LLM**.

**Artifacts:**

- `ML.FEATURE_REGULATORY_OPCO` (and related feature views): counts, velocities, days-to-deadline, overdue ratios.
- `ML.MODEL_REGISTRY`: model name, version, training window, metrics VARIANT.
- `ML.PREDICTION_RISK_SCORE`: entity grain, score, band, `explanation_variant` (SHAP-like summaries or top drivers as JSON).
- Training can be **Snowflake ML** or **Snowpark** jobs writing back to `ML.*`.

---

## 6. Prediction models and evaluation

**Purpose:** Formal lifecycle for demo and production readiness.

**Requirements:**

- **Baseline:** Transparent rules-based score in SQL (already approximates current Node logic) stored beside ML predictions for comparison.
- **Backtesting:** Historical snapshots table `ML.FEATURE_SNAPSHOT` keyed by `as_of_date` for reproducibility.
- **Drift / quality:** Optional `ML.MODEL_EVALUATION_RUN` with precision/recall or calibration metrics on held-out period.

---

## 7. Application integration (Express + React path)

If you **keep** the existing stack: replace file reads in [server/routes/dashboard.js](../../server/routes/dashboard.js) and related routes with queries to `ANALYTICS` views via `snowflake-sdk` or a small Snowpark Python service. Contract: **one view per API response shape** where possible to avoid duplicating business logic in Node.

---

## 8. Security and compliance

- Key-pair or OAuth for service users; separate roles for load, transform, app read, ML train.
- Row access policies on `CURATED.FACT_*` if multi-tenant demo (map login → allowed `parent_holding_id`).
- Masking on PII columns in UBO / legal extracts.
- No secrets in Git; use Snowflake `SECRET` and external token access where needed.

---

## 9. Deliverables checklist (implementation)

- [ ] All JSON sources mapped ([JSON_TO_TABLE_MAP.md](JSON_TO_TABLE_MAP.md))
- [ ] DDL applied in order ([../README.md](../README.md))
- [ ] Sample load executed; validation queries pass ([MIGRATION_RUNBOOK.md](MIGRATION_RUNBOOK.md))
- [ ] At least one analytics view per major UI area ([VIEW_TO_UI_MAP.md](VIEW_TO_UI_MAP.md))
- [ ] At least one Cortex or LLM pipeline logged in `ML.CORTEX_RUN_LOG`
- [ ] At least one tabular prediction in `ML.PREDICTION_RISK_SCORE` (even rule-based v1)
- [ ] Streamlit page skeleton or React wired to views
