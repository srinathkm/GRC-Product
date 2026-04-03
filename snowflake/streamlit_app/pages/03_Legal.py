"""Legal registers: curated facts."""
import streamlit as st
from grc_common import get_session, render_scope_sidebar, sql_to_pandas, SCHEMA_CURATED, esc_sql

st.set_page_config(page_title="Legal", layout="wide")
st.header("Legal registers")
session = get_session()
render_scope_sidebar(session)

oid = st.session_state.get("opco_id")
if not oid:
    st.info("Select an OpCo in the sidebar.")
    st.stop()

oid_s = esc_sql(oid)
tabs = st.tabs(["POA", "Licences", "Contracts", "IP", "Litigation"])

with tabs[0]:
    try:
        df = sql_to_pandas(session, f"SELECT * FROM {SCHEMA_CURATED}.FACT_POA WHERE opco_id = '{oid_s}' LIMIT 500")
        st.dataframe(df, use_container_width=True, hide_index=True)
    except Exception as e:
        st.warning(e)
with tabs[1]:
    try:
        df = sql_to_pandas(session, f"SELECT * FROM {SCHEMA_CURATED}.FACT_LICENCE WHERE opco_id = '{oid_s}' LIMIT 500")
        st.dataframe(df, use_container_width=True, hide_index=True)
    except Exception as e:
        st.warning(e)
with tabs[2]:
    try:
        df = sql_to_pandas(session, f"SELECT * FROM {SCHEMA_CURATED}.FACT_CONTRACT WHERE opco_id = '{oid_s}' LIMIT 500")
        st.dataframe(df, use_container_width=True, hide_index=True)
    except Exception as e:
        st.warning(e)
with tabs[3]:
    try:
        df = sql_to_pandas(session, f"SELECT * FROM {SCHEMA_CURATED}.FACT_IP WHERE opco_id = '{oid_s}' LIMIT 500")
        st.dataframe(df, use_container_width=True, hide_index=True)
    except Exception as e:
        st.warning(e)
with tabs[4]:
    try:
        df = sql_to_pandas(session, f"SELECT * FROM {SCHEMA_CURATED}.FACT_LITIGATION WHERE opco_id = '{oid_s}' LIMIT 500")
        st.dataframe(df, use_container_width=True, hide_index=True)
    except Exception as e:
        st.warning(e)
