# Streamlit notes (legacy stub)

The **runnable Streamlit in Snowflake application** lives in **[`../streamlit_app/`](../streamlit_app/)** (`app.py`, `grc_common.py`, `pages/*.py`).

- **Deploy steps:** [`../docs/QUICKSTART.md`](../docs/QUICKSTART.md) Phase 3  
- **Bundle README:** [`../streamlit_app/README.md`](../streamlit_app/README.md)  
- **E2E architecture diagram:** [`../docs/ARCHITECTURE_STREAMLIT_E2E.md`](../docs/ARCHITECTURE_STREAMLIT_E2E.md)

## RBAC (optional)

Use `GRC_DEMO_DB.APP.STREAMLIT_ROLE_PAGE` and `SELECT CURRENT_ROLE()` to show or hide pages.

## Session state

Mirror the old React globals: `parent_holding_id`, `opco_id`, `period_days` (implemented in `grc_common.render_scope_sidebar`).
