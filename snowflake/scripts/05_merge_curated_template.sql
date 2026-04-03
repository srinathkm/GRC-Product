-- Template: MERGE RAW VARIANT into CURATED tables.
-- Replace JSON path expressions after inspecting actual payload shapes in RAW.CHANGES_RAW.

USE DATABASE GRC_DEMO_DB;

-- Example pattern (pseudocode — validate keys against your JSON):
/*
INSERT INTO CURATED.FACT_REGULATORY_CHANGE (framework_id, legacy_key, title, change_date, deadline, raw_variant)
SELECT
  (SELECT framework_id FROM CURATED.DIM_FRAMEWORK WHERE name = payload:framework::STRING LIMIT 1),
  payload:id::STRING,
  payload:title::STRING,
  TRY_TO_DATE(payload:date::STRING),
  TRY_TO_DATE(payload:deadline::STRING),
  payload
FROM RAW.CHANGES_RAW, LATERAL FLATTEN(input => payload) f;
*/

-- Prefer a single Snowpark Python stored procedure for complex nested JSON.
