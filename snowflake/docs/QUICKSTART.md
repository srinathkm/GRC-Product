# Quickstart: phased checklist (Snowflake GRC demo — Streamlit UI)

This checklist assumes the **Streamlit in Snowflake** path (`streamlit_app/`) as the primary front end (replacing React for Snowflake-only demos). Paths are relative to the repo **`snowflake/`** folder.

**Architecture (diagram + layers):** [ARCHITECTURE_STREAMLIT_E2E.md](ARCHITECTURE_STREAMLIT_E2E.md)

---

## Phase 0 — Before Snowflake

| Step | Action |
|------|--------|
| P0.1 | Read [ARCHITECTURE_END_TO_END.md](ARCHITECTURE_END_TO_END.md) and [ARCHITECTURE_STREAMLIT_E2E.md](ARCHITECTURE_STREAMLIT_E2E.md). |
| P0.2 | Clone the repo; locate JSON under [`server/data/`](../server/data/) (or [`server/data/_backups/`](../server/data/_backups/) if empty). |
| P0.3 | Decide the **Snowflake role** that will **own** the Streamlit app (e.g. `GRC_STREAMLIT_APP` or a named user role). |

---

## Phase 1 — Snowflake platform + DDL (run in order)

Use **Snowsight Worksheets** or **SnowSQL**. Use a role that can create warehouse/database (often `ACCOUNTADMIN` for P1.1 only).

| Step | Run | Purpose |
|------|-----|--------|
| P1.1 | [scripts/01_roles_warehouse_grants.sql](../scripts/01_roles_warehouse_grants.sql) | Warehouse `GRC_WH`, roles. Uncomment **GRANT** block after DB exists. |
| P1.2 | [schemas/00_database_and_schemas.sql](../schemas/00_database_and_schemas.sql) | Database `GRC_DEMO_DB`, schemas `RAW`, `CURATED`, `ANALYTICS`, `ML`, `APP`. |
| P1.3 | [scripts/02_stages_and_file_formats.sql](../scripts/02_stages_and_file_formats.sql) | File formats + `@GRC_DEMO_DB.RAW.INTERNAL_GRC_STAGE`. |

Switch to **`GRC_DEVELOPER`** or **`GRC_ADMIN`**, then:

| Step | Run |
|------|-----|
| P1.4 | [schemas/01_raw_landing.sql](../schemas/01_raw_landing.sql) |
| P1.5 | [schemas/02_curated_dimensions.sql](../schemas/02_curated_dimensions.sql) |
| P1.6 | [schemas/03_curated_facts.sql](../schemas/03_curated_facts.sql) |
| P1.7 | [schemas/04_analytics_views.sql](../schemas/04_analytics_views.sql) |
| P1.8 | [schemas/05_ml_and_intelligence.sql](../schemas/05_ml_and_intelligence.sql) |
| P1.9 | [schemas/06_app_config.sql](../schemas/06_app_config.sql) |

**Verify:** `SHOW TABLES IN SCHEMA GRC_DEMO_DB.CURATED;` and `SHOW VIEWS IN SCHEMA GRC_DEMO_DB.ANALYTICS;`

---

## Phase 2 — Data (RAW → CURATED)

| Step | Action |
|------|--------|
| P2.1 | **PUT** JSON files to `@GRC_DEMO_DB.RAW.INTERNAL_GRC_STAGE/legacy_json/` (see [MIGRATION_RUNBOOK.md](MIGRATION_RUNBOOK.md)). |
| P2.2 | **COPY** into `RAW.*_RAW`: run [scripts/08_copy_into_all_json.sql](../scripts/08_copy_into_all_json.sql) for **all** mappings from [JSON_TO_TABLE_MAP.md](JSON_TO_TABLE_MAP.md) (after PUT). For ad-hoc examples see [scripts/03_load_demo_put_copy.sql](../scripts/03_load_demo_put_copy.sql). |
| P2.3 | Use [JSON_TO_TABLE_MAP.md](JSON_TO_TABLE_MAP.md) so each file targets the correct `*_RAW` table. |
| P2.4 | **Merge** `VARIANT` → `CURATED` (SQL or Snowpark). Start from [scripts/05_merge_curated_template.sql](../scripts/05_merge_curated_template.sql). |

**No source JSON yet:** run [scripts/04_seed_minimal_demo.sql](../scripts/04_seed_minimal_demo.sql).

| Step | Action |
|------|--------|
| P2.5 | Run [scripts/validate_row_counts.sql](../scripts/validate_row_counts.sql) and spot-check [MIGRATION_RUNBOOK.md](MIGRATION_RUNBOOK.md) queries. |

---

## Phase 3 — Streamlit app (exact steps + pre-built Python)

**Prerequisites:** P1 and P2 complete; at least seed data so `DIM_PARENT_HOLDING` / `DIM_OPCO` are non-empty.

### P3.A — Grants for the app owner role

| Step | Action |
|------|--------|
| P3.1 | Edit [scripts/07_streamlit_grants.sql](../scripts/07_streamlit_grants.sql): set the role name to the role that **owns** the Streamlit app. |
| P3.2 | Run the script as `SECURITYADMIN` / `ACCOUNTADMIN` (or your governance equivalent). |

This grants `SELECT` on `ANALYTICS` views, `CURATED` tables, `ML` tables, and `INSERT` on `ML.ML_CORTEX_RUN_LOG`.

### P3.B — Create the Streamlit app in Snowsight

| Step | Action |
|------|--------|
| P3.3 | Open **Snowsight** → **Streamlit** (or **Apps** → **Streamlit**, depending on edition). |
| P3.4 | **Create** / **+ Streamlit app**. Name e.g. `GRC_INTELLIGENCE_APP`. |
| P3.5 | **Warehouse:** `GRC_WH` (or your demo warehouse). |
| P3.6 | **Database / schema:** e.g. `GRC_DEMO_DB.APP` (app object storage location). |
| P3.7 | Set **Main file / Root file** to **`app.py`**. |

### P3.C — Upload application files (must match repo layout)

Copy the contents of **[`streamlit_app/`](../streamlit_app/)** into the Snowflake editor (or connect Git to this repo path `snowflake/streamlit_app/`).

| Order | File | Purpose |
|-------|------|--------|
| 1 | `app.py` | Home + KPI preview |
| 2 | `grc_common.py` | Snowpark session, sidebar Parent/OpCo/period |
| 3 | `pages/01_Management.py` | Management dashboard |
| 4 | `pages/02_Governance.py` | Regulatory changes |
| 5 | `pages/03_Legal.py` | Legal registers |
| 6 | `pages/04_Data_Compliance.py` | Sovereignty + Defender |
| 7 | `pages/05_Tasks.py` | Tasks |
| 8 | `pages/06_Intelligence.py` | ML + Cortex + run log |

Details: [streamlit_app/README.md](../streamlit_app/README.md).

| Step | Action |
|------|--------|
| P3.8 | **Save** all files, then **Run** the app. |
| P3.9 | In the sidebar, select **Parent** and **OpCo**; open each **page** from the left nav and confirm tables load. |

### P3.D — Intelligence page (Cortex)

| Step | Action |
|------|--------|
| P3.10 | Open **Intelligence**. If **Generate summary** errors, confirm Cortex is enabled and adjust **Cortex model id** (account-specific). |
| P3.11 | Confirm new rows appear in `GRC_DEMO_DB.ML.ML_CORTEX_RUN_LOG` after a successful run. |

### P3.E — Optional RBAC for pages

| Step | Action |
|------|--------|
| P3.12 | Populate `GRC_DEMO_DB.APP.STREAMLIT_ROLE_PAGE` and gate `st.sidebar` / pages using `SELECT CURRENT_ROLE()` (pattern in [streamlit/README.md](../streamlit/README.md)). |

---

## Phase 4 — Intelligence jobs (batch / tasks)

| Step | Action |
|------|--------|
| P4.1 | Read [INTELLIGENCE_AI_ML.md](INTELLIGENCE_AI_ML.md). |
| P4.2 | Schedule refresh of `ML.ML_FEATURE_REGULATORY_OPCO` (Task or procedure). |
| P4.3 | Register models in `ML.ML_MODEL_REGISTRY`; write `ML.ML_PREDICTION_RISK_SCORE`. |
| P4.4 | Streamlit **Intelligence** page reads predictions; Cortex remains on-demand from the UI. |

---

## Phase 5 — Legacy React + Node (optional)

Only if you must keep the existing SPA: point Express at `ANALYTICS.VW_*` instead of JSON files ([VIEW_TO_UI_MAP.md](VIEW_TO_UI_MAP.md)). The Streamlit app can coexist for demos.

---

## Single-line order

`01_roles` → `00_database` → `02_stages` → schemas `01`–`06` → **data** (PUT/COPY/merge) or **seed** → **`07_streamlit_grants`** → **create SiS app** → upload **`streamlit_app/*`** → **Run** → optional **Phase 4** tasks.

Extended narrative: [MIGRATION_RUNBOOK.md](MIGRATION_RUNBOOK.md).
