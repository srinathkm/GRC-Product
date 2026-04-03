# Quickstart: phased checklist (Snowflake GRC demo)

Use this checklist with the [`snowflake/`](../README.md) pack. Filenames are relative to the repo `snowflake/` folder unless noted.

---

## Phase 0 — Before Snowflake

1. Read [`ARCHITECTURE_END_TO_END.md`](ARCHITECTURE_END_TO_END.md) once (DB, Streamlit, intelligence, AI/ML, predictions).
2. **Choose UI path:**
   - **Streamlit in Snowflake (SiS)** — fully Snowflake-hosted UI (typical for a pure Snowflake demo).
   - **Keep React + Node** — Snowflake is the database; Express reads views later (not scripted in this pack).
3. Locate app JSON under [`server/data/`](../../server/data/) in the repo; use [`server/data/_backups/`](../../server/data/_backups/) if live files are empty.

---

## Phase 1 — Run first in Snowflake (warehouse, DB, stage, DDL)

Use **Snowsight Worksheets** or **SnowSQL**. Step 1 often needs `ACCOUNTADMIN` (or equivalent).

| Step | Run | Purpose |
|------|-----|--------|
| 1 | [`scripts/01_roles_warehouse_grants.sql`](../scripts/01_roles_warehouse_grants.sql) | `GRC_WH`, roles (`GRC_ADMIN`, `GRC_DEVELOPER`, …). Edit warehouse size / names if needed. |
| 2 | [`schemas/00_database_and_schemas.sql`](../schemas/00_database_and_schemas.sql) | `GRC_DEMO_DB` + schemas `RAW`, `CURATED`, `ANALYTICS`, `ML`, `APP`. |
| 3 | [`scripts/02_stages_and_file_formats.sql`](../scripts/02_stages_and_file_formats.sql) | File formats + `@GRC_DEMO_DB.RAW.INTERNAL_GRC_STAGE` (**after** DB exists). |

Switch to **`GRC_DEVELOPER`** or **`GRC_ADMIN`**, then run **in order**:

| Step | Run |
|------|-----|
| 4 | [`schemas/01_raw_landing.sql`](../schemas/01_raw_landing.sql) |
| 5 | [`schemas/02_curated_dimensions.sql`](../schemas/02_curated_dimensions.sql) |
| 6 | [`schemas/03_curated_facts.sql`](../schemas/03_curated_facts.sql) |
| 7 | [`schemas/04_analytics_views.sql`](../schemas/04_analytics_views.sql) |
| 8 | [`schemas/05_ml_and_intelligence.sql`](../schemas/05_ml_and_intelligence.sql) |
| 9 | [`schemas/06_app_config.sql`](../schemas/06_app_config.sql) |

**Grants:** Uncomment and run the `GRANT` block in `01_roles_warehouse_grants.sql` so analysts / Streamlit roles can use the warehouse and read `ANALYTICS` (see [`MIGRATION_RUNBOOK.md`](MIGRATION_RUNBOOK.md)).

The same DDL order is listed in [`../README.md`](../README.md).

---

## Phase 2 — Data (RAW → CURATED)

| Step | Action |
|------|--------|
| 10 | **PUT** JSON from `server/data/*.json` onto the stage (example in [`MIGRATION_RUNBOOK.md`](MIGRATION_RUNBOOK.md)). |
| 11 | **COPY** into `RAW.*_RAW` tables; follow [`scripts/03_load_demo_put_copy.sql`](../scripts/03_load_demo_put_copy.sql). Adjust `FILE_FORMAT` and `STRIP_OUTER_ARRAY` per file (JSON array vs NDJSON). |
| 12 | Map each file to a RAW table using [`JSON_TO_TABLE_MAP.md`](JSON_TO_TABLE_MAP.md). |
| 13 | **Transform** RAW → CURATED: implement `MERGE`/`INSERT` from `payload` VARIANT (SQL and/or Snowpark). Start from [`scripts/05_merge_curated_template.sql`](../scripts/05_merge_curated_template.sql). |

**No JSON yet?** Run [`scripts/04_seed_minimal_demo.sql`](../scripts/04_seed_minimal_demo.sql) to smoke-test views and Streamlit.

| Step | Run |
|------|-----|
| 14 | [`scripts/validate_row_counts.sql`](../scripts/validate_row_counts.sql) + checks in [`MIGRATION_RUNBOOK.md`](MIGRATION_RUNBOOK.md). |

---

## Phase 3 — Front end (Streamlit in Snowflake)

**After** `ANALYTICS` views return rows (or after seed).

| Step | Action |
|------|--------|
| 15 | In Snowflake **Streamlit**, create an app with a role that can `SELECT` from `GRC_DEMO_DB.ANALYTICS` (and `CURATED` if needed). |
| 16 | Structure pages per [`../streamlit/README.md`](../streamlit/README.md) (e.g. `Home.py`, `pages/` for Governance, Legal, Data, Tasks, Intelligence). |
| 17 | Query **`GRC_DEMO_DB.ANALYTICS.VW_*`** from the UI; map screens using [`VIEW_TO_UI_MAP.md`](VIEW_TO_UI_MAP.md). |
| 18 | **Session state:** `parent_holding_id`, `opco_id`, `period_days`; dropdowns from `DIM_PARENT_HOLDING` / `DIM_OPCO` (see Streamlit README). |
| 19 | **RBAC:** `APP.STREAMLIT_ROLE_PAGE` + `CURRENT_ROLE()` (from [`06_app_config.sql`](../schemas/06_app_config.sql)). |

This pack does not ship generated `.py` files; implement the app in SiS or add Python to the repo later.

---

## Phase 4 — Intelligence / AI / ML

| Step | Action |
|------|--------|
| 20 | Read [`INTELLIGENCE_AI_ML.md`](INTELLIGENCE_AI_ML.md). |
| 21 | Build/refresh **`ML.ML_FEATURE_REGULATORY_OPCO`** (task or procedure). |
| 22 | Train/register models → **`ML.ML_PREDICTION_RISK_SCORE`** (seed shows rule-based pattern). |
| 23 | If Cortex is enabled: call from Snowpark in Streamlit; log to **`ML.ML_CORTEX_RUN_LOG`**; context from **`ANALYTICS.VW_OPCO_INTELLIGENCE_CONTEXT`**. |

---

## Phase 5 — Optional: keep React + Express

1. Complete Phase 1–2 (data in Snowflake).
2. Replace file reads in the Node server with queries to `ANALYTICS.VW_*` (shape JSON like current APIs).
3. Use [`VIEW_TO_UI_MAP.md`](VIEW_TO_UI_MAP.md) as the contract per screen.

---

## What to run first (one line)

**First:** [`scripts/01_roles_warehouse_grants.sql`](../scripts/01_roles_warehouse_grants.sql) → [`schemas/00_database_and_schemas.sql`](../schemas/00_database_and_schemas.sql) → [`scripts/02_stages_and_file_formats.sql`](../scripts/02_stages_and_file_formats.sql) → [`schemas/01`–`06`](../schemas/) in order → data (PUT/COPY + merge) or seed → Streamlit querying **`ANALYTICS.VW_*`**.

Longer narrative: [`MIGRATION_RUNBOOK.md`](MIGRATION_RUNBOOK.md).
