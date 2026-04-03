USE DATABASE GRC_DEMO_DB;
USE SCHEMA ML;

CREATE OR REPLACE TABLE ML_PROMPT_TEMPLATE (
  template_id VARCHAR(36) DEFAULT UUID_STRING(),
  name VARCHAR(256) NOT NULL,
  version VARCHAR(32) NOT NULL,
  body VARCHAR(16777216) NOT NULL,
  created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE TABLE ML_CORTEX_RUN_LOG (
  run_id VARCHAR(36) DEFAULT UUID_STRING(),
  opco_id VARCHAR(36),
  parent_holding_id VARCHAR(36),
  template_id VARCHAR(36),
  input_context_hash VARCHAR(64),
  input_variant VARIANT,
  output_text VARCHAR(16777216),
  retrieval_variant VARIANT,
  latency_ms INTEGER,
  created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE TABLE ML_MODEL_REGISTRY (
  model_id VARCHAR(36) DEFAULT UUID_STRING(),
  model_name VARCHAR(256) NOT NULL,
  model_version VARCHAR(64) NOT NULL,
  training_start_ts TIMESTAMP_LTZ,
  training_end_ts TIMESTAMP_LTZ,
  metrics_variant VARIANT,
  artifact_stage_path VARCHAR(2048),
  created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE TABLE ML_FEATURE_REGULATORY_OPCO (
  feature_id VARCHAR(36) DEFAULT UUID_STRING(),
  as_of_date DATE NOT NULL,
  opco_id VARCHAR(36) NOT NULL,
  parent_holding_id VARCHAR(36),
  change_count_30d INTEGER,
  overdue_change_count INTEGER,
  open_task_count INTEGER,
  open_critical_findings INTEGER,
  days_to_nearest_legal_expiry INTEGER,
  feature_variant VARIANT,
  created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE TABLE ML_PREDICTION_RISK_SCORE (
  prediction_id VARCHAR(36) DEFAULT UUID_STRING(),
  as_of_date DATE NOT NULL,
  opco_id VARCHAR(36) NOT NULL,
  model_name VARCHAR(256) NOT NULL,
  model_version VARCHAR(64) NOT NULL,
  score NUMBER(5,2),
  band VARCHAR(32),
  explanation_variant VARIANT,
  created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE TABLE ML_DOCUMENT_CHUNK (
  chunk_id VARCHAR(36) DEFAULT UUID_STRING(),
  source_type VARCHAR(64),
  source_id VARCHAR(256),
  framework_id VARCHAR(36),
  opco_id VARCHAR(36),
  chunk_index INTEGER,
  content VARCHAR(16777216),
  created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

-- Example Cortex call (enable per account; comment out if not available):
-- SELECT SNOWFLAKE.CORTEX.COMPLETE('mistral-large2', 'Summarize: ' || (SELECT LISTAGG(content, ' ') FROM ML_DOCUMENT_CHUNK WHERE opco_id = ?));
