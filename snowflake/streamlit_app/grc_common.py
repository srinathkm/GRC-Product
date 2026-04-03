"""
Shared helpers for the GRC Streamlit in Snowflake app.
Runs inside Snowflake only (uses get_active_session).
"""
from __future__ import annotations

import re

import streamlit as st

DATABASE = "GRC_DEMO_DB"
SCHEMA_ANALYTICS = f"{DATABASE}.ANALYTICS"
SCHEMA_CURATED = f"{DATABASE}.CURATED"
SCHEMA_ML = f"{DATABASE}.ML"


def get_session():
    from snowflake.snowpark.context import get_active_session
    return get_active_session()


def sql_to_pandas(session, query: str):
    return session.sql(query).to_pandas()


def init_session_filters():
    if "parent_holding_id" not in st.session_state:
        st.session_state.parent_holding_id = None
    if "opco_id" not in st.session_state:
        st.session_state.opco_id = None
    if "period_days" not in st.session_state:
        st.session_state.period_days = 30


def render_scope_sidebar(session):
    init_session_filters()
    st.sidebar.header("Scope")
    try:
        parents = sql_to_pandas(
            session,
            f"SELECT parent_holding_id, name FROM {SCHEMA_CURATED}.DIM_PARENT_HOLDING ORDER BY name",
        )
    except Exception as e:
        st.sidebar.error(f"Could not load parents: {e}")
        return
    if parents.empty:
        st.sidebar.warning("No rows in DIM_PARENT_HOLDING. Run Phase 2 seed or merge.")
        return
    name_to_id = dict(zip(parents["NAME"], parents["PARENT_HOLDING_ID"]))
    names = list(name_to_id.keys())
    default_parent_name = names[0]
    if st.session_state.parent_holding_id:
        match = parents[parents["PARENT_HOLDING_ID"] == st.session_state.parent_holding_id]
        if not match.empty:
            default_parent_name = match.iloc[0]["NAME"]
    sel_name = st.sidebar.selectbox("Parent holding", names, index=names.index(default_parent_name))
    st.session_state.parent_holding_id = name_to_id[sel_name]
    pid = st.session_state.parent_holding_id
    pid_sql = pid.replace("'", "''") if pid else ""
    try:
        opcos = sql_to_pandas(
            session,
            f"""
            SELECT opco_id, name
            FROM {SCHEMA_CURATED}.DIM_OPCO
            WHERE parent_holding_id = '{pid_sql}'
            ORDER BY name
            """,
        )
    except Exception as e:
        st.sidebar.error(f"Could not load OpCos: {e}")
        return
    if opcos.empty:
        st.sidebar.selectbox("OpCo", ["— No OpCos —"], disabled=True)
        st.session_state.opco_id = None
    else:
        o_name_to_id = dict(zip(opcos["NAME"], opcos["OPCO_ID"]))
        o_names = list(o_name_to_id.keys())
        default_o = o_names[0]
        if st.session_state.opco_id:
            m = opcos[opcos["OPCO_ID"] == st.session_state.opco_id]
            if not m.empty:
                default_o = m.iloc[0]["NAME"]
        sel_o = st.sidebar.selectbox("OpCo", o_names, index=o_names.index(default_o))
        st.session_state.opco_id = o_name_to_id[sel_o]
    opts = [30, 180, 365]
    idx = opts.index(st.session_state.period_days) if st.session_state.period_days in opts else 0
    st.session_state.period_days = st.sidebar.selectbox("Period (days)", opts, index=idx)


def esc_sql(s: str | None) -> str:
    if s is None:
        return ""
    return str(s).replace("'", "''")


def safe_uuid(uuid_str: str | None) -> bool:
    if not uuid_str:
        return False
    return bool(re.match(r"^[a-fA-F0-9\-]{32,36}$", uuid_str))
