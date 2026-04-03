"""ML risk + optional Cortex summary (logs to ML_CORTEX_RUN_LOG when run)."""
import hashlib
import streamlit as st
from grc_common import (
    get_session,
    render_scope_sidebar,
    sql_to_pandas,
    SCHEMA_ANALYTICS,
    SCHEMA_ML,
    esc_sql,
)

st.set_page_config(page_title="Intelligence", layout="wide")
st.header("Intelligence — ML & AI")
session = get_session()
render_scope_sidebar(session)

oid = st.session_state.get("opco_id")
pid = st.session_state.get("parent_holding_id")
if not oid or not pid:
    st.info("Select Parent and OpCo in the sidebar.")
    st.stop()

oid_s = esc_sql(oid)
pid_s = esc_sql(pid)

if "cortex_model" not in st.session_state:
    st.session_state.cortex_model = "mistral-large2"
st.session_state.cortex_model = st.text_input("Cortex model id", value=st.session_state.cortex_model)

st.subheader("Intelligence context")
try:
    ctx = sql_to_pandas(
        session,
        f"""
        SELECT * FROM {SCHEMA_ANALYTICS}.VW_OPCO_INTELLIGENCE_CONTEXT
        WHERE opco_id = '{oid_s}'
        """,
    )
    st.dataframe(ctx, use_container_width=True, hide_index=True)
except Exception as e:
    st.warning(f"Context: {e}")
    ctx = None

st.subheader("Risk prediction (latest)")
try:
    pred = sql_to_pandas(
        session,
        f"""
        SELECT * FROM {SCHEMA_ML}.ML_PREDICTION_RISK_SCORE
        WHERE opco_id = '{oid_s}'
        ORDER BY as_of_date DESC, created_at DESC
        LIMIT 5
        """,
    )
    st.dataframe(pred, use_container_width=True, hide_index=True)
except Exception as e:
    st.warning(f"Predictions: {e}")

st.subheader("Cortex executive summary")
st.caption("Requires Cortex on your account. Result is appended to ML.ML_CORTEX_RUN_LOG.")

if st.button("Generate summary (Cortex)"):
    try:
        if ctx is not None and not ctx.empty:
            r = ctx.iloc[0]
            cols = {c.upper(): c for c in r.index}
            def gv(key, default="unknown"):
                k = cols.get(key)
                return r[k] if k is not None else default
            name = str(gv("OPCO_NAME", "OpCo"))
            band = str(gv("DEFENDER_BAND", "unknown"))
            tasks = int(gv("OPEN_TASKS", 0) or 0)
        else:
            name, band, tasks = "OpCo", "unknown", 0
        prompt = (
            f"Give exactly 3 short bullet points for an executive on compliance posture for '{name}'. "
            f"Defender band: {band}. Open tasks (non-done): {tasks}. Be factual; no legal advice."
        )
        p_esc = prompt.replace("'", "''")
        m_esc = st.session_state.cortex_model.replace("'", "''")
        q = f"SELECT SNOWFLAKE.CORTEX.COMPLETE('{m_esc}', '{p_esc}') AS summary_text"
        rows = session.sql(q).collect()
        text = rows[0][0] if rows else None
        st.success(text or "(empty)")

        h = hashlib.sha256(prompt.encode()).hexdigest()[:32]
        log_esc = str(text).replace("'", "''")[:8000]
        try:
            session.sql(
                f"""
                INSERT INTO {SCHEMA_ML}.ML_CORTEX_RUN_LOG (
                  opco_id, parent_holding_id, template_id, input_context_hash, output_text
                )
                SELECT '{oid_s}', '{pid_s}', 'EXEC_SUMMARY_V1', '{h}', '{log_esc}'
                """
            ).collect()
            st.caption("Logged to ML.ML_CORTEX_RUN_LOG")
        except Exception as log_e:
            st.warning(f"Could not log run: {log_e}")
    except Exception as e:
        st.error(f"Cortex not available or failed: {e}")

st.subheader("Recent Cortex runs")
try:
    runs = sql_to_pandas(
        session,
        f"""
        SELECT run_id, template_id, input_context_hash, created_at,
               LEFT(output_text, 400) AS output_preview
        FROM {SCHEMA_ML}.ML_CORTEX_RUN_LOG
        WHERE opco_id = '{oid_s}'
        ORDER BY created_at DESC
        LIMIT 20
        """,
    )
    st.dataframe(runs, use_container_width=True, hide_index=True)
except Exception as e:
    st.caption(f"No runs or table empty: {e}")
