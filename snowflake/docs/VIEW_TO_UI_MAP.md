# View / page mapping (React and Streamlit)

Maps current **view IDs** in [client/src/App.jsx](../../client/src/App.jsx) to recommended **ANALYTICS** views. Create additional views as needed when JSON shapes are finalized.

| View ID | Primary Snowflake views / tables |
|---------|-----------------------------------|
| `mgmt-dashboard` | `VW_MGMT_DASHBOARD_KPI`, `VW_LEGAL_EXPIRY_UPCOMING`, `VW_DEPENDENCY_EXPOSURE_SUMMARY`, `VW_COMPLIANCE_HEALTH_INPUTS` |
| `dependency-intelligence` | `VW_DEPENDENCY_CLUSTER`, `VW_DEPENDENCY_EXPOSURE_SUMMARY` + curated facts |
| `onboarding` | `FACT_ONBOARDING_SUBMISSION`, `DIM_OPCO`, `DIM_PARENT_HOLDING` |
| `org-overview` / `org-dashboard` | `DIM_PARENT_HOLDING`, `DIM_OPCO`, `BRIDGE_OPCO_FRAMEWORK`, KPI aggregates |
| `parent-overview` | Same + `FACT_REGULATORY_CHANGE` counts by OpCo |
| `governance-framework` | `VW_REGULATORY_CHANGES_SUMMARY`, `FACT_REGULATORY_CHANGE`, `DIM_FRAMEWORK` |
| `multi-jurisdiction` | `DIM_LOCATION`, `BRIDGE_OPCO_FRAMEWORK` |
| `ubo` | `FACT_UBO_REGISTER` (add in curated extension if not in initial DDL) |
| `esg` | `FACT_ESG_METRIC` |
| `data-sovereignty` | `VW_DATA_SOVEREIGNTY_BY_OPCO` |
| `data-security` | `VW_DEFENDER_POSTURE_BY_OPCO`, `FACT_DEFENDER_FINDING`, `FACT_DEFENDER_SUMMARY` |
| `analysis` / `ma-simulator` | `ML.ML_PREDICTION_RISK_SCORE`, `ML.ML_FEATURE_REGULATORY_OPCO` |
| `task-tracker` | `VW_TASK_QUEUE` |
| `poa-management` | `FACT_POA` |
| `ip-management` | `FACT_IP` |
| `licence-management` | `FACT_LICENCE` |
| `litigations-management` | `FACT_LITIGATION` |
| `contracts-management` / `contracts-upload` | `FACT_CONTRACT`, `DIM_LEGAL_DOCUMENT` |
| `legal-onboarding` | `FACT_ONBOARDING_SUBMISSION`, legal `DIM_LEGAL_DOCUMENT` |

**Streamlit:** One page per module group; use `st.session_state` for `parent_holding_id` and `opco_id` to mirror React globals.
