"""Governance: regulatory changes summary."""
import streamlit as st
from grc_common import get_session, render_scope_sidebar, sql_to_pandas, SCHEMA_ANALYTICS, SCHEMA_CURATED

st.set_page_config(page_title="Governance", layout="wide")
st.header("Governance — regulatory changes")
session = get_session()
render_scope_sidebar(session)

try:
    fw = sql_to_pandas(
        session,
        f"SELECT framework_id, name FROM {SCHEMA_CURATED}.DIM_FRAMEWORK ORDER BY name",
    )
    if fw.empty:
        sel = "All"
        st.selectbox("Framework filter", ["All"], disabled=True)
        q = f"SELECT * FROM {SCHEMA_ANALYTICS}.VW_REGULATORY_CHANGES_SUMMARY ORDER BY change_date DESC NULLS LAST LIMIT 500"
    else:
        names = ["All"] + list(fw["NAME"])
        sel = st.selectbox("Framework filter", names)
        if sel == "All":
            q = f"SELECT * FROM {SCHEMA_ANALYTICS}.VW_REGULATORY_CHANGES_SUMMARY ORDER BY change_date DESC NULLS LAST LIMIT 500"
        else:
            esc = sel.replace("'", "''")
            q = f"""
            SELECT * FROM {SCHEMA_ANALYTICS}.VW_REGULATORY_CHANGES_SUMMARY
            WHERE framework_name = '{esc}'
            ORDER BY change_date DESC NULLS LAST
            LIMIT 500
            """
    df = sql_to_pandas(session, q)
    st.dataframe(df, use_container_width=True, hide_index=True)
except Exception as e:
    st.error(f"Could not load changes: {e}")
