"""Task queue."""
import streamlit as st
from grc_common import get_session, render_scope_sidebar, sql_to_pandas, SCHEMA_ANALYTICS, esc_sql

st.set_page_config(page_title="Tasks", layout="wide")
st.header("Task tracker")
session = get_session()
render_scope_sidebar(session)

pid = st.session_state.get("parent_holding_id")
pid_s = esc_sql(pid)
oid = st.session_state.get("opco_id")
oid_s = esc_sql(oid) if oid else ""

try:
    if oid:
        q = f"""
        SELECT * FROM {SCHEMA_ANALYTICS}.VW_TASK_QUEUE
        WHERE parent_holding_id = '{pid_s}' AND opco_id = '{oid_s}'
        ORDER BY due_date NULLS LAST
        LIMIT 500
        """
    else:
        q = f"""
        SELECT * FROM {SCHEMA_ANALYTICS}.VW_TASK_QUEUE
        WHERE parent_holding_id = '{pid_s}'
        ORDER BY due_date NULLS LAST
        LIMIT 500
        """
    df = sql_to_pandas(session, q)
    st.dataframe(df, use_container_width=True, hide_index=True)
except Exception as e:
    st.error(f"Tasks: {e}")
