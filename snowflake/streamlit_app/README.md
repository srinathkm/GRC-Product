# GRC Streamlit in Snowflake — application bundle

Pre-built multipage app that replaces the React UI for Snowflake-only demos. It reads **`GRC_DEMO_DB.ANALYTICS.VW_*`** and **`GRC_DEMO_DB.CURATED.FACT_*`** and writes optional Cortex logs to **`GRC_DEMO_DB.ML.ML_CORTEX_RUN_LOG`**.

## Layout

| File | Role |
|------|------|
| `app.py` | Home page; set as **Main file** in Snowflake |
| `grc_common.py` | Session, SQL helpers, sidebar Parent/OpCo/period |
| `pages/01_Management.py` | KPIs, dependency, legal expiries |
| `pages/02_Governance.py` | Regulatory changes |
| `pages/03_Legal.py` | POA, licences, contracts, IP, litigation |
| `pages/04_Data_Compliance.py` | Sovereignty + Defender |
| `pages/05_Tasks.py` | Task queue |
| `pages/06_Intelligence.py` | Context, ML predictions, Cortex + log |

## Snowflake prerequisites

- Phases 1–2 complete ([QUICKSTART.md](../docs/QUICKSTART.md)).
- Warehouse available (e.g. `GRC_WH`).
- App owner role with `SELECT` on `ANALYTICS`, `CURATED`, `ML` (see [scripts/07_streamlit_grants.sql](../scripts/07_streamlit_grants.sql)).

## Deploy in Snowsight (typical)

1. **Projects » Streamlit** (or **Apps** » **Streamlit** — UI label varies by edition).
2. **+ Streamlit app** → name e.g. `GRC_INTELLIGENCE_APP`.
3. **Warehouse:** `GRC_WH` (or your demo warehouse).
4. **Database / schema:** where the app object is stored (e.g. `GRC_DEMO_DB.APP`).
5. **Root file:** `app.py`.
6. **Add files:** create `app.py`, `grc_common.py`, and under folder `pages/` add each `01_`…`06_` file (copy-paste from this repo or git-connected project).
7. **Run** — top-right **Run** / save triggers execution.

If your account supports **Git integration**, point the app at this repo path `snowflake/streamlit_app/`.

## Local run (optional)

Not required for Snowflake. For local debugging only:

```bash
pip install snowflake-snowpark-python streamlit pandas
# Requires Snowflake connection config; SiS normally runs only inside Snowflake.
```

## Cortex

Page **Intelligence** calls `SNOWFLAKE.CORTEX.COMPLETE`. If it fails, confirm Cortex is enabled and change **Cortex model id** to one your account supports.

