"""Data sovereignty and Defender posture."""
import streamlit as st
from grc_common import get_session, render_scope_sidebar, sql_to_pandas, SCHEMA_ANALYTICS, esc_sql

st.set_page_config(page_title="Data & Defender", layout="wide")
st.header("Data compliance & Defender posture")
session = get_session()
render_scope_sidebar(session)

oid = st.session_state.get("opco_id")
if not oid:
    st.info("Select an OpCo in the sidebar.")
    st.stop()
oid_s = esc_sql(oid)

c1, c2 = st.columns(2)
with c1:
    st.subheader("Data sovereignty")
    try:
        df = sql_to_pandas(
            session,
            f"SELECT * FROM {SCHEMA_ANALYTICS}.VW_DATA_SOVEREIGNTY_BY_OPCO WHERE opco_id = '{oid_s}'",
        )
        st.dataframe(df, use_container_width=True, hide_index=True)
    except Exception as e:
        st.warning(e)
with c2:
    st.subheader("Defender posture")
    try:
        df = sql_to_pandas(
            session,
            f"SELECT * FROM {SCHEMA_ANALYTICS}.VW_DEFENDER_POSTURE_BY_OPCO WHERE opco_id = '{oid_s}'",
        )
        st.dataframe(df, use_container_width=True, hide_index=True)
    except Exception as e:
        st.warning(e)
