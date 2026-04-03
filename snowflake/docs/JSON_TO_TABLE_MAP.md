# JSON file to Snowflake table map

Source directory: [server/data/](../../server/data/). Each legacy file lands in **RAW** then normalizes to **CURATED**.

| JSON file | RAW table | CURATED target(s) | Notes |
|-----------|-----------|-------------------|--------|
| `companies.json` | `RAW.COMPANIES_RAW` | `DIM_PARENT_HOLDING`, `DIM_OPCO`, `BRIDGE_OPCO_FRAMEWORK`, `DIM_LOCATION`, `BRIDGE_OPCO_LICENSING_AUTHORITY` | Framework-keyed structure in app; flatten to bridges |
| `onboarding-opcos.json` | `RAW.ONBOARDING_OPCOS_RAW` | `FACT_ONBOARDING_SUBMISSION`, upsert `DIM_OPCO` | Full payload in `payload_variant` |
| `opco-multi-shareholders.json` | `RAW.OPCO_MULTI_SHAREHOLDERS_RAW` | `BRIDGE_OPCO_MULTI_SHAREHOLDER` | |
| `changes.json` | `RAW.CHANGES_RAW` | `FACT_REGULATORY_CHANGE`, `DIM_FRAMEWORK` (reference) | May need `FACT_REGULATORY_CHANGE_TEXT` for long body |
| `feed-meta.json` | `RAW.FEED_META_RAW` | `FACT_REGULATORY_FEED_RUN` | Feed run audit |
| `tasks.json` | `RAW.TASKS_RAW` | `FACT_TASK` | Links to change/legal entity optional |
| `audit.json` | `RAW.AUDIT_RAW` | `FACT_AUDIT_EVENT` | Append-only |
| `poa.json` | `RAW.POA_RAW` | `FACT_POA`, `DIM_LEGAL_DOCUMENT` | |
| `licences.json` | `RAW.LICENCES_RAW` | `FACT_LICENCE`, `DIM_LEGAL_DOCUMENT` | |
| `contracts.json` | `RAW.CONTRACTS_RAW` | `FACT_CONTRACT`, `DIM_LEGAL_DOCUMENT` | |
| `ip.json` | `RAW.IP_RAW` | `FACT_IP`, `DIM_LEGAL_DOCUMENT` | |
| `litigations.json` | `RAW.LITIGATIONS_RAW` | `FACT_LITIGATION`, `DIM_LEGAL_DOCUMENT` | |
| `data-sovereignty-checks.json` | `RAW.DATA_SOVEREIGNTY_RAW` | `FACT_DATA_SOVEREIGNTY_CHECK` | Per OpCo checks |
| `esg-metrics.json` | `RAW.ESG_METRICS_RAW` | `FACT_ESG_METRIC` | |
| `fieldMappings.json` | `RAW.FIELD_MAPPINGS_RAW` | `APP.FIELD_MAPPING` or `CURATED.REF_FIELD_MAPPING` | UI / extraction config |
| `defender-uploads.json` | `RAW.DEFENDER_UPLOADS_RAW` | `FACT_DEFENDER_UPLOAD` | |
| `defender-snapshots.json` | `RAW.DEFENDER_SNAPSHOTS_RAW` | `FACT_DEFENDER_SNAPSHOT` | |
| `defender-findings.json` | `RAW.DEFENDER_FINDINGS_RAW` | `FACT_DEFENDER_FINDING` | |
| `defender-scores.json` | `RAW.DEFENDER_SCORES_RAW` | `FACT_DEFENDER_SCORE` | |
| `defender-summaries.json` | `RAW.DEFENDER_SUMMARIES_RAW` | `FACT_DEFENDER_SUMMARY` | |
| `ai-model-usage.json` (if present) | `RAW.AI_MODEL_USAGE_RAW` | `FACT_AI_MODEL_USAGE` | Cross-border / AI governance |

**Server code references:** [server/routes/dashboard.js](../../server/routes/dashboard.js), [server/services/dependencyIntelligence.js](../../server/services/dependencyIntelligence.js), [server/services/ai.js](../../server/services/ai.js).

## COPY INTO (RAW load)

Ready-made `COPY INTO` for **every row in the table above** (stage path `legacy_json/`, `source_file` + `payload` columns):

- [scripts/08_copy_into_all_json.sql](../scripts/08_copy_into_all_json.sql)

After RAW load, implement `MERGE` from `VARIANT` → CURATED using [scripts/05_merge_curated_template.sql](../scripts/05_merge_curated_template.sql) (or Snowpark).
