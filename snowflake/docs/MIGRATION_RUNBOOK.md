# Migration runbook: GRC demo on Snowflake

## Prerequisites

- Snowflake account with ability to create database, warehouse, roles, stages, tasks (tasks optional for demo).
- Snowflake CLI or Web Worksheets.
- Local clone of this repo with `server/data/*.json` (use `_backups` if live files are empty).

## 1. Create warehouse and roles

Run [scripts/01_roles_warehouse_grants.sql](../scripts/01_roles_warehouse_grants.sql) as `ACCOUNTADMIN` (or adapt to your governance model).

Edit placeholders:

- `GRC_WH` size (e.g. `XSMALL` for demo).
- Role names if your naming standard differs.

## 2. File formats and stage

Run [scripts/02_stages_and_file_formats.sql](../scripts/02_stages_and_file_formats.sql).

## 3. Apply DDL (order matters)

Use role `GRC_DEVELOPER` or `GRC_ADMIN`:

1. [schemas/00_database_and_schemas.sql](../schemas/00_database_and_schemas.sql)
2. [schemas/01_raw_landing.sql](../schemas/01_raw_landing.sql)
3. [schemas/02_curated_dimensions.sql](../schemas/02_curated_dimensions.sql)
4. [schemas/03_curated_facts.sql](../schemas/03_curated_facts.sql)
5. [schemas/04_analytics_views.sql](../schemas/04_analytics_views.sql)
6. [schemas/05_ml_and_intelligence.sql](../schemas/05_ml_and_intelligence.sql)
7. [schemas/06_app_config.sql](../schemas/06_app_config.sql)

## 4. Upload JSON to internal stage

From your machine (SnowSQL or CLI):

```bash
# Example: put all server/data JSON at stage prefix legacy_json/
snowsql -q "PUT file://path/to/regulation-changes-dashboard/server/data/*.json @GRC_DEMO_DB.RAW.INTERNAL_GRC_STAGE/legacy_json/"
```

Or use Snowsight **Data** → **Load** into `RAW` tables.

## 5. Load into RAW

Run statements in [scripts/03_load_demo_put_copy.sql](../scripts/03_load_demo_put_copy.sql).

Adjust:

- `PATTERN` to match your file names.
- `STRIP_OUTER_ARRAY` depending on whether each file is a JSON array or NDJSON.

## 6. Transform RAW → CURATED

**Implementation choice:**

- **SQL only:** write `MERGE` statements from `payload` VARIANT paths into curated tables (one-time migration scripts).
- **Snowpark Python stored procedure:** recommended if JSON shapes vary; procedure reads RAW rows and upserts CURATED.

This repo includes **table contracts**; use [scripts/05_merge_curated_template.sql](../scripts/05_merge_curated_template.sql) as a starting point for `MERGE`/`INSERT` from `VARIANT` paths once JSON shapes are validated.

## 7. Optional minimal seed

If you have no JSON yet, run [scripts/04_seed_minimal_demo.sql](../scripts/04_seed_minimal_demo.sql) to validate views and Streamlit connectivity.

## 8. Verification queries

```sql
USE DATABASE GRC_DEMO_DB;
USE SCHEMA CURATED;
SELECT COUNT(*) FROM DIM_PARENT_HOLDING;
SELECT COUNT(*) FROM DIM_OPCO;
SELECT COUNT(*) FROM FACT_REGULATORY_CHANGE;

USE SCHEMA ANALYTICS;
SELECT * FROM VW_REGULATORY_CHANGES_SUMMARY LIMIT 20;
```

## 9. Streamlit in Snowflake

Follow [streamlit/README.md](../streamlit/README.md). Grant `GRC_STREAMLIT_APP` usage on `ANALYTICS` and `APP` schemas.

## 10. Cutover from Node (optional)

- Replace file reads in Express routes with `SELECT` from `ANALYTICS.VW_*`.
- Keep response JSON shapes stable for the React app.

## Rollback

- `DROP DATABASE GRC_DEMO_DB` in dev only.
- In shared accounts, prefer clone-before-migrate: `CREATE DATABASE GRC_DEMO_DB_CLONE CLONE GRC_DEMO_DB`.
