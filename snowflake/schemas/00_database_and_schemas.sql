-- GRC Demo: database and schemas
-- Run as role with CREATE DATABASE privilege.

CREATE DATABASE IF NOT EXISTS GRC_DEMO_DB
  COMMENT = 'GRC regulation dashboard demo - migrated from Node JSON stores';

CREATE SCHEMA IF NOT EXISTS GRC_DEMO_DB.RAW
  COMMENT = 'Landing zone: VARIANT payloads from JSON and APIs';

CREATE SCHEMA IF NOT EXISTS GRC_DEMO_DB.CURATED
  COMMENT = 'Normalized dimensions, bridges, facts';

CREATE SCHEMA IF NOT EXISTS GRC_DEMO_DB.ANALYTICS
  COMMENT = 'Views and presentation-layer objects for UI/API';

CREATE SCHEMA IF NOT EXISTS GRC_DEMO_DB.ML
  COMMENT = 'Features, model registry, predictions, Cortex audit';

CREATE SCHEMA IF NOT EXISTS GRC_DEMO_DB.APP
  COMMENT = 'Application config: RBAC mapping, feature flags';
