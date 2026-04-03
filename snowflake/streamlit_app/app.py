"""GRC Compliance Intelligence — Streamlit in Snowflake home page."""
import streamlit as st
from grc_common import get_session, render_scope_sidebar, sql_to_pandas, SCHEMA_ANALYTICS

st.set_page_config(page_title="GRC Intelligence", layout="wide", initial_sidebar_state="expanded")
st.title("GRC Compliance Intelligence")
st.caption("Snowflake-native UI — GRC_DEMO_DB.ANALYTICS / CURATED.")

session = get_session()
render_scope_sidebar(session)

st.markdown("""
**Pages** (left nav): Management, Governance, Legal, Data & Defender, Tasks, Intelligence.
Use the sidebar for Parent / OpCo / period.
""")
try:
    df = sql_to_pandas(
        session,
        f"SELECT * FROM {SCHEMA_ANALYTICS}.VW_MGMT_DASHBOARD_KPI ORDER BY parent_name LIMIT 50",
    )
    st.subheader("Management KPI preview")
    st.dataframe(df, use_container_width=True, hide_index=True)
except Exception as e:
    st.info(f"KPI preview unavailable until data is loaded: {e}")
