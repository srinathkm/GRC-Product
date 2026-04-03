# Snowflake migration and intelligence pack

This folder implements the blueprint from the Cursor plan **Snowflake migration blueprint** (`snowflake_migration_blueprint_c2f0c035.plan.md`): database layers, analytics views, ML/intelligence tables, operational scripts, and Streamlit guidance for an end-to-end Snowflake-native demo.

## Contents

| Path | Purpose |
|------|---------|
| [docs/ARCHITECTURE_END_TO_END.md](docs/ARCHITECTURE_END_TO_END.md) | **Master document**: segregated sections for DB, Streamlit UI, intelligence orchestration, AI/ML, predictions |
| [docs/QUICKSTART.md](docs/QUICKSTART.md) | **Phased checklist** — what to run first, then data, Streamlit, AI/ML |
| [docs/MIGRATION_RUNBOOK.md](docs/MIGRATION_RUNBOOK.md) | Step-by-step provisioning (warehouse, roles, DDL order, load, verify) |
| [docs/JSON_TO_TABLE_MAP.md](docs/JSON_TO_TABLE_MAP.md) | Every `server/data/*.json` file mapped to RAW and CURATED objects |
| [docs/ERD.md](docs/ERD.md) | Entity relationship overview (Mermaid) |
| [docs/INTELLIGENCE_AI_ML.md](docs/INTELLIGENCE_AI_ML.md) | Cortex, RAG, Snowflake ML, prediction outputs, audit logging |
| [docs/VIEW_TO_UI_MAP.md](docs/VIEW_TO_UI_MAP.md) | React view IDs to Snowflake views / Streamlit pages |
| [docs/ARCHITECTURE_STREAMLIT_E2E.md](docs/ARCHITECTURE_STREAMLIT_E2E.md) | **E2E architecture** (Mermaid): Streamlit, analytics, curated, RAW, ML/Cortex |
| [schemas/](schemas/) | Ordered DDL: database, RAW, CURATED, ANALYTICS views, ML |
| [scripts/](scripts/) | Roles, stages, PUT/COPY, seed, **Streamlit grants** (`07`) |
| [streamlit_app/](streamlit_app/) | **Pre-built Streamlit in Snowflake app** (`app.py`, `grc_common.py`, `pages/`) |
| [streamlit/](streamlit/) | Short notes; see `streamlit_app/` for the runnable bundle |

## Execution order (DDL)

1. `scripts/01_roles_warehouse_grants.sql` (adjust role names to your org)
2. `scripts/02_stages_and_file_formats.sql`
3. `schemas/00_database_and_schemas.sql`
4. `schemas/01_raw_landing.sql`
5. `schemas/02_curated_dimensions.sql`
6. `schemas/03_curated_facts.sql`
7. `schemas/04_analytics_views.sql`
8. `schemas/05_ml_and_intelligence.sql`
9. `schemas/06_app_config.sql`
10. `scripts/03_load_demo_put_copy.sql` (after uploading JSON to stage)
11. `scripts/04_seed_minimal_demo.sql` (optional empty-demo smoke)
12. `scripts/05_merge_curated_template.sql` (implement team-specific `MERGE` from RAW)
13. `scripts/validate_row_counts.sql` (smoke validation)
14. `scripts/07_streamlit_grants.sql` (before deploying Streamlit; edit app owner role)
15. Deploy **[`streamlit_app/`](streamlit_app/)** per [`docs/QUICKSTART.md`](docs/QUICKSTART.md) Phase 3

## Security

Do **not** commit Snowflake passwords, private keys, or GitHub PATs. Use Snowflake secrets, key-pair auth, or CI OIDC.

## Related repo docs

- [docs/SYSTEM_DESIGN.md](../docs/SYSTEM_DESIGN.md) — logical relational model this Snowflake design extends
- Server JSON sources: [server/data/](../server/data/)
