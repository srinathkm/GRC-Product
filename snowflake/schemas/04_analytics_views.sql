USE DATABASE GRC_DEMO_DB;
USE SCHEMA ANALYTICS;

-- Summary for governance / changes list (adjust column names when merged from RAW)
CREATE OR REPLACE VIEW VW_REGULATORY_CHANGES_SUMMARY AS
SELECT
  c.change_id,
  f.name AS framework_name,
  c.title,
  c.change_date,
  c.deadline,
  c.category
FROM GRC_DEMO_DB.CURATED.FACT_REGULATORY_CHANGE c
LEFT JOIN GRC_DEMO_DB.CURATED.DIM_FRAMEWORK f ON f.framework_id = c.framework_id;

CREATE OR REPLACE VIEW VW_TASK_QUEUE AS
SELECT
  t.task_id,
  t.parent_holding_id,
  t.opco_id,
  o.name AS opco_name,
  p.name AS parent_name,
  t.title,
  t.status,
  t.assignee_role,
  t.due_date
FROM GRC_DEMO_DB.CURATED.FACT_TASK t
LEFT JOIN GRC_DEMO_DB.CURATED.DIM_OPCO o ON o.opco_id = t.opco_id
LEFT JOIN GRC_DEMO_DB.CURATED.DIM_PARENT_HOLDING p ON p.parent_holding_id = t.parent_holding_id;

CREATE OR REPLACE VIEW VW_DATA_SOVEREIGNTY_BY_OPCO AS
SELECT
  d.opco_id,
  o.name AS opco_name,
  d.severity,
  COUNT(*) AS check_count
FROM GRC_DEMO_DB.CURATED.FACT_DATA_SOVEREIGNTY_CHECK d
JOIN GRC_DEMO_DB.CURATED.DIM_OPCO o ON o.opco_id = d.opco_id
GROUP BY 1, 2, 3;

CREATE OR REPLACE VIEW VW_DEFENDER_POSTURE_BY_OPCO AS
SELECT
  s.opco_id,
  o.name AS opco_name,
  s.score,
  s.band,
  s.open_critical,
  s.open_high,
  s.computed_at
FROM GRC_DEMO_DB.CURATED.FACT_DEFENDER_SCORE s
JOIN GRC_DEMO_DB.CURATED.DIM_OPCO o ON o.opco_id = s.opco_id
QUALIFY ROW_NUMBER() OVER (PARTITION BY s.opco_id ORDER BY s.computed_at DESC) = 1;

CREATE OR REPLACE VIEW VW_LEGAL_EXPIRY_UPCOMING AS
SELECT 'POA' AS register_type, poa_id AS record_id, opco_id, valid_until AS expiry_date, reference_code AS ref
FROM GRC_DEMO_DB.CURATED.FACT_POA WHERE valid_until IS NOT NULL
UNION ALL
SELECT 'LICENCE', licence_id, opco_id, expiry_date, licence_type
FROM GRC_DEMO_DB.CURATED.FACT_LICENCE WHERE expiry_date IS NOT NULL
UNION ALL
SELECT 'CONTRACT', contract_id, opco_id, end_date, contract_id_external
FROM GRC_DEMO_DB.CURATED.FACT_CONTRACT WHERE end_date IS NOT NULL
UNION ALL
SELECT 'IP', ip_id, opco_id, expiry_date, reference_code
FROM GRC_DEMO_DB.CURATED.FACT_IP WHERE expiry_date IS NOT NULL;

CREATE OR REPLACE VIEW VW_DEPENDENCY_CLUSTER AS
SELECT * FROM GRC_DEMO_DB.CURATED.FACT_DEPENDENCY_CLUSTER;

CREATE OR REPLACE VIEW VW_DEPENDENCY_EXPOSURE_SUMMARY AS
SELECT
  parent_holding_id,
  SUM(exposure_aed) AS total_exposure_aed,
  COUNT(*) AS cluster_count,
  SUM(IFF(severity = 'critical', 1, 0)) AS critical_clusters
FROM GRC_DEMO_DB.CURATED.FACT_DEPENDENCY_CLUSTER
GROUP BY 1;

-- Placeholder KPI view: extend with health-score inputs when merge scripts exist
CREATE OR REPLACE VIEW VW_MGMT_DASHBOARD_KPI AS
SELECT
  p.parent_holding_id,
  p.name AS parent_name,
  COUNT(DISTINCT o.opco_id) AS opco_count,
  COUNT(DISTINCT IFF(c.deadline < CURRENT_DATE(), c.change_id, NULL)) AS overdue_change_count
FROM GRC_DEMO_DB.CURATED.DIM_PARENT_HOLDING p
LEFT JOIN GRC_DEMO_DB.CURATED.DIM_OPCO o ON o.parent_holding_id = p.parent_holding_id
LEFT JOIN GRC_DEMO_DB.CURATED.BRIDGE_OPCO_FRAMEWORK b ON b.opco_id = o.opco_id
LEFT JOIN GRC_DEMO_DB.CURATED.FACT_REGULATORY_CHANGE c ON c.framework_id = b.framework_id
GROUP BY 1, 2;

-- Context for Cortex / LLM (expand with task and legal subqueries)
CREATE OR REPLACE VIEW VW_OPCO_INTELLIGENCE_CONTEXT AS
SELECT
  o.opco_id,
  o.parent_holding_id,
  o.name AS opco_name,
  ds.band AS defender_band,
  ds.score AS defender_score,
  (SELECT COUNT(*) FROM GRC_DEMO_DB.CURATED.FACT_TASK t WHERE t.opco_id = o.opco_id AND t.status <> 'done') AS open_tasks
FROM GRC_DEMO_DB.CURATED.DIM_OPCO o
LEFT JOIN GRC_DEMO_DB.ANALYTICS.VW_DEFENDER_POSTURE_BY_OPCO ds ON ds.opco_id = o.opco_id;
