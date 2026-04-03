# Streamlit in Snowflake (GRC demo)

## Goal

Host the dashboard UI entirely inside Snowflake for sales / POC demos: **no separate React build server**.

## App structure (recommended)

```
streamlit_app/
  Home.py                 # Management KPIs + filters
  pages/
    1_Governance.py       # Regulatory changes
    2_Legal.py            # POA / IP / Licences / Litigation / Contracts
    3_Data.py             # Sovereignty + Defender
    4_Tasks.py
    5_Intelligence.py     # Cortex output + ML risk
```

## Session state

Mirror React globals:

- `parent_holding_id`, `opco_id`, `period_days`

Populate dropdowns from:

```sql
SELECT parent_holding_id, name FROM GRC_DEMO_DB.CURATED.DIM_PARENT_HOLDING ORDER BY name;
SELECT opco_id, name FROM GRC_DEMO_DB.CURATED.DIM_OPCO WHERE parent_holding_id = :p ORDER BY name;
```

## Queries

Use **only** `GRC_DEMO_DB.ANALYTICS.VW_*` in the UI layer where possible.

## RBAC

1. Create table `GRC_DEMO_DB.APP.STREAMLIT_ROLE_PAGE` (`snowflake_role`, `page_id`, `allowed`).
2. On each page, `SELECT CURRENT_ROLE()` and filter navigation.

## Uploads

`st.file_uploader` → Snowflake stage via Snowpark `session.file.put` → insert `CURATED.DIM_LEGAL_DOCUMENT` → TASK parses to `extracted_variant`.

## Cortex

Call from Snowpark Python in Streamlit (if enabled): build prompt from `ANALYTICS.VW_OPCO_INTELLIGENCE_CONTEXT`, log to `ML.ML_CORTEX_RUN_LOG`.

## Limitations vs React

- Pixel-perfect parity is not required for demo; prioritize KPIs, tables, and one “wow” insight (Cortex + risk score).
