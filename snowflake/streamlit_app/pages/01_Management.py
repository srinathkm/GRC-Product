"""Management dashboard: KPIs, dependency exposure, legal expiries."""
import streamlit as st
from grc_common import (
    get_session,
    render_scope_sidebar,
    sql_to_pandas,
    SCHEMA_ANALYTICS,
    esc_sql,
)

st.set_page_config(page_title="Management", layout="wide")
st.header("Management dashboard")
session = get_session()
render_scope_sidebar(session)

pid = st.session_state.get("parent_holding_id")
pid_s = esc_sql(pid)

try:
    kpi = sql_to_pandas(
        session,
        f"""
        SELECT * FROM {SCHEMA_ANALYTICS}.VW_MGMT_DASHBOARD_KPI
        WHERE parent_holding_id = '{pid_s}'
        """,
    )
    st.subheader("KPIs (selected parent)")
    st.dataframe(kpi, use_container_width=True, hide_index=True)
except Exception as e:
    st.warning(f"KPI: {e}")

try:
    dep = sql_to_pandas(
        session,
        f"""
        SELECT * FROM {SCHEMA_ANALYTICS}.VW_DEPENDENCY_EXPOSURE_SUMMARY
        WHERE parent_holding_id = '{pid_s}'
        """,
    )
    st.subheader("Dependency exposure")
    st.dataframe(dep, use_container_width=True, hide_index=True)
except Exception as e:
    st.warning(f"Dependency: {e}")

try:
    cl = sql_to_pandas(
        session,
        f"""
        SELECT * FROM {SCHEMA_ANALYTICS}.VW_DEPENDENCY_CLUSTER
        WHERE parent_holding_id = '{pid_s}'
        ORDER BY severity NULLS LAST
        """,
    )
    st.subheader("Dependency clusters")
    st.dataframe(cl, use_container_width=True, hide_index=True)
except Exception as e:
    st.warning(f"Clusters: {e}")

oid = st.session_state.get("opco_id")
if oid:
    oid_s = esc_sql(oid)
    try:
        le = sql_to_pandas(
            session,
            f"""
            SELECT * FROM {SCHEMA_ANALYTICS}.VW_LEGAL_EXPIRY_UPCOMING
            WHERE opco_id = '{oid_s}'
            ORDER BY expiry_date NULLS LAST
            LIMIT 200
            """,
        )
        st.subheader("Legal expiries (selected OpCo)")
        st.dataframe(le, use_container_width=True, hide_index=True)
    except Exception as e:
        st.warning(f"Legal expiries: {e}")
else:
    st.info("Select an OpCo in the sidebar for legal expiry list.")
