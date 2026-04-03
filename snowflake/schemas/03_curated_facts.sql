USE DATABASE GRC_DEMO_DB;
USE SCHEMA CURATED;

-- Regulatory changes (from changes.json + framework reference)
CREATE OR REPLACE TABLE FACT_REGULATORY_CHANGE (
  change_id VARCHAR(36) DEFAULT UUID_STRING(),
  framework_id VARCHAR(36),
  legacy_key VARCHAR(256),
  title VARCHAR(1024),
  snippet VARCHAR(16777216),
  full_text VARCHAR(16777216),
  change_date DATE,
  source_url VARCHAR(2048),
  category VARCHAR(256),
  deadline DATE,
  raw_variant VARIANT,
  created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE TABLE BRIDGE_CHANGE_AFFECTED_OPCO (
  change_id VARCHAR(36) NOT NULL,
  opco_id VARCHAR(36) NOT NULL,
  PRIMARY KEY (change_id, opco_id)
);

CREATE OR REPLACE TABLE FACT_REGULATORY_FEED_RUN (
  run_id VARCHAR(36) DEFAULT UUID_STRING(),
  last_run_ts TIMESTAMP_LTZ,
  message VARCHAR(16777216),
  raw_variant VARIANT,
  created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

-- Onboarding
CREATE OR REPLACE TABLE FACT_ONBOARDING_SUBMISSION (
  submission_id VARCHAR(36) DEFAULT UUID_STRING(),
  parent_holding_id VARCHAR(36),
  opco_id VARCHAR(36),
  organization_name VARCHAR(255),
  business_activities VARCHAR(16777216),
  sector VARCHAR(128),
  framework_tag VARCHAR(64),
  payload_variant VARIANT,
  added_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

-- UBO (extend app; localStorage today — persist for Snowflake demo)
CREATE OR REPLACE TABLE FACT_UBO_REGISTER (
  ubo_id VARCHAR(36) DEFAULT UUID_STRING(),
  opco_id VARCHAR(36) NOT NULL,
  parent_holding_id VARCHAR(36),
  full_name VARCHAR(255),
  nationality VARCHAR(128),
  date_of_birth DATE,
  id_type VARCHAR(64),
  id_number VARCHAR(128),
  percentage_ownership NUMBER(5,2),
  nature_of_control VARCHAR(16777216),
  document_extract_variant VARIANT,
  created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

-- Tasks and audit
CREATE OR REPLACE TABLE FACT_TASK (
  task_id VARCHAR(36) DEFAULT UUID_STRING(),
  opco_id VARCHAR(36),
  parent_holding_id VARCHAR(36),
  title VARCHAR(1024),
  status VARCHAR(64),
  assignee_role VARCHAR(128),
  due_date DATE,
  related_entity_type VARCHAR(64),
  related_entity_id VARCHAR(36),
  raw_variant VARIANT,
  created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE TABLE FACT_AUDIT_EVENT (
  audit_id VARCHAR(36) DEFAULT UUID_STRING(),
  actor VARCHAR(256),
  action VARCHAR(128),
  entity_type VARCHAR(128),
  entity_id VARCHAR(256),
  outcome VARCHAR(64),
  before_variant VARIANT,
  after_variant VARIANT,
  created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

-- Legal registers
CREATE OR REPLACE TABLE FACT_POA (
  poa_id VARCHAR(36) DEFAULT UUID_STRING(),
  opco_id VARCHAR(36),
  parent_holding_id VARCHAR(36),
  document_id VARCHAR(36),
  reference_code VARCHAR(256),
  poa_type VARCHAR(128),
  status VARCHAR(64),
  valid_from DATE,
  valid_until DATE,
  raw_variant VARIANT,
  created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE TABLE FACT_LICENCE (
  licence_id VARCHAR(36) DEFAULT UUID_STRING(),
  opco_id VARCHAR(36),
  parent_holding_id VARCHAR(36),
  document_id VARCHAR(36),
  licence_type VARCHAR(128),
  status VARCHAR(64),
  issue_date DATE,
  expiry_date DATE,
  raw_variant VARIANT,
  created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE TABLE FACT_CONTRACT (
  contract_id VARCHAR(36) DEFAULT UUID_STRING(),
  opco_id VARCHAR(36),
  parent_holding_id VARCHAR(36),
  document_id VARCHAR(36),
  contract_id_external VARCHAR(256),
  contract_type VARCHAR(128),
  status VARCHAR(64),
  effective_date DATE,
  end_date DATE,
  value_amount NUMBER(18,2),
  currency VARCHAR(8),
  raw_variant VARIANT,
  created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE TABLE FACT_IP (
  ip_id VARCHAR(36) DEFAULT UUID_STRING(),
  opco_id VARCHAR(36),
  parent_holding_id VARCHAR(36),
  document_id VARCHAR(36),
  ip_type VARCHAR(64),
  reference_code VARCHAR(256),
  status VARCHAR(64),
  filing_date DATE,
  grant_date DATE,
  expiry_date DATE,
  raw_variant VARIANT,
  created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE TABLE FACT_LITIGATION (
  litigation_id VARCHAR(36) DEFAULT UUID_STRING(),
  opco_id VARCHAR(36),
  parent_holding_id VARCHAR(36),
  document_id VARCHAR(36),
  case_reference VARCHAR(256),
  status VARCHAR(64),
  claim_amount NUMBER(18,2),
  currency VARCHAR(8),
  raw_variant VARIANT,
  created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

-- Data sovereignty & AI usage
CREATE OR REPLACE TABLE FACT_DATA_SOVEREIGNTY_CHECK (
  check_id VARCHAR(36) DEFAULT UUID_STRING(),
  opco_id VARCHAR(36) NOT NULL,
  parent_holding_id VARCHAR(36),
  regulation VARCHAR(512),
  severity VARCHAR(32),
  section VARCHAR(512),
  raw_variant VARIANT,
  evaluated_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE TABLE FACT_AI_MODEL_USAGE (
  usage_id VARCHAR(36) DEFAULT UUID_STRING(),
  opco_id VARCHAR(36),
  parent_holding_id VARCHAR(36),
  model_name VARCHAR(256),
  use_case VARCHAR(256),
  cross_border VARCHAR(16),
  raw_variant VARIANT,
  recorded_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE TABLE FACT_ESG_METRIC (
  metric_id VARCHAR(36) DEFAULT UUID_STRING(),
  opco_id VARCHAR(36),
  parent_holding_id VARCHAR(36),
  metric_key VARCHAR(128),
  metric_value NUMBER(18,6),
  unit VARCHAR(32),
  period_start DATE,
  period_end DATE,
  raw_variant VARIANT,
  created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

-- Defender
CREATE OR REPLACE TABLE FACT_DEFENDER_UPLOAD (
  upload_id VARCHAR(36) DEFAULT UUID_STRING(),
  opco_id VARCHAR(36),
  parent_holding_id VARCHAR(36),
  filename VARCHAR(512),
  mime_type VARCHAR(128),
  report_type VARCHAR(64),
  stage_path VARCHAR(2048),
  status VARCHAR(32),
  error_message VARCHAR(16777216),
  uploaded_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
  raw_variant VARIANT
);

CREATE OR REPLACE TABLE FACT_DEFENDER_SNAPSHOT (
  snapshot_id VARCHAR(36) DEFAULT UUID_STRING(),
  opco_id VARCHAR(36),
  parent_holding_id VARCHAR(36),
  upload_id VARCHAR(36),
  metric_type VARCHAR(64),
  value NUMBER(18,4),
  value_type VARCHAR(32),
  effective_at TIMESTAMP_LTZ,
  created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
  raw_variant VARIANT
);

CREATE OR REPLACE TABLE FACT_DEFENDER_FINDING (
  finding_id VARCHAR(36) DEFAULT UUID_STRING(),
  opco_id VARCHAR(36),
  upload_id VARCHAR(36),
  title VARCHAR(1024),
  severity VARCHAR(16),
  status VARCHAR(32),
  source VARCHAR(64),
  raw_variant VARIANT,
  created_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE TABLE FACT_DEFENDER_SCORE (
  score_id VARCHAR(36) DEFAULT UUID_STRING(),
  opco_id VARCHAR(36) NOT NULL,
  parent_holding_id VARCHAR(36),
  score NUMBER(5,2),
  band VARCHAR(32),
  band_color VARCHAR(16),
  framework_cov_pct NUMBER(5,2),
  secure_score_pct NUMBER(5,2),
  open_critical INTEGER,
  open_high INTEGER,
  penalty NUMBER(6,2),
  evidence_variant VARIANT,
  computed_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE TABLE FACT_DEFENDER_SUMMARY (
  opco_id VARCHAR(36) NOT NULL,
  summary_text VARCHAR(16777216),
  model_id VARCHAR(128),
  prompt_hash VARCHAR(64),
  updated_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
  raw_variant VARIANT
);

-- Dependency / management dashboard materialized inputs (populate from Snowpark or merge from JSON-derived facts)
CREATE OR REPLACE TABLE FACT_DEPENDENCY_CLUSTER (
  cluster_id VARCHAR(36) DEFAULT UUID_STRING(),
  parent_holding_id VARCHAR(36),
  cluster_name VARCHAR(512),
  severity VARCHAR(32),
  unresolved_count INTEGER,
  exposure_aed NUMBER(18,2),
  raw_variant VARIANT,
  updated_at TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP()
);
