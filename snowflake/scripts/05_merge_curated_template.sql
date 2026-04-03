-- =============================================================================
-- MERGE RAW VARIANT → CURATED (GRC legacy JSON)
-- =============================================================================
-- Run in Snowflake SQL worksheet after:
--   • Schemas deployed (00–03, bridges in 02_curated_dimensions.sql)
--   • RAW loaded (scripts/08_copy_into_all_json.sql or equivalent COPY)
--
-- Idempotent MERGEs on natural keys. Adjust VARIANT paths if payloads differ.
-- Re-runnable: uses QUALIFY / latest ingest_ts where duplicates may exist.
-- =============================================================================

USE DATABASE GRC_DEMO_DB;
USE SCHEMA CURATED;

-- -----------------------------------------------------------------------------
-- 1) Frameworks: changes.json + companies.json top-level keys
-- -----------------------------------------------------------------------------
MERGE INTO DIM_FRAMEWORK t
USING (
  SELECT DISTINCT payload:framework::STRING AS name
  FROM RAW.CHANGES_RAW
  WHERE payload:framework IS NOT NULL
  UNION
  SELECT DISTINCT f.key::STRING AS name
  FROM RAW.COMPANIES_RAW c,
  LATERAL FLATTEN(input => c.payload) f
  WHERE f.key IS NOT NULL
) s
ON t.name = s.name
WHEN NOT MATCHED THEN
  INSERT (framework_id, name, jurisdiction)
  VALUES (UUID_STRING(), s.name, NULL);

-- -----------------------------------------------------------------------------
-- 2) Parent holdings
-- -----------------------------------------------------------------------------
MERGE INTO DIM_PARENT_HOLDING t
USING (
  SELECT DISTINCT grp.value:parent::STRING AS name
  FROM RAW.COMPANIES_RAW c,
  LATERAL FLATTEN(input => c.payload) fw,
  LATERAL FLATTEN(input => fw.value) grp
  WHERE COALESCE(grp.value:parent::STRING, '') <> ''
) s
ON t.source_system_id = MD5_HEX(LOWER(TRIM(s.name)))
WHEN NOT MATCHED THEN
  INSERT (parent_holding_id, name, source_system_id)
  VALUES (UUID_STRING(), s.name, MD5_HEX(LOWER(TRIM(s.name))));

MERGE INTO DIM_PARENT_HOLDING t
USING (
  SELECT DISTINCT parent_name
  FROM (
    SELECT payload:parent::STRING AS parent_name FROM RAW.ONBOARDING_OPCOS_RAW
    UNION ALL SELECT payload:parent::STRING FROM RAW.POA_RAW
    UNION ALL SELECT payload:parent::STRING FROM RAW.LICENCES_RAW
    UNION ALL SELECT payload:parent::STRING FROM RAW.CONTRACTS_RAW
    UNION ALL SELECT payload:parent::STRING FROM RAW.IP_RAW
    UNION ALL SELECT payload:parent::STRING FROM RAW.LITIGATIONS_RAW
    UNION ALL SELECT payload:parent::STRING FROM RAW.TASKS_RAW
    UNION ALL SELECT payload:parent::STRING FROM RAW.DEFENDER_UPLOADS_RAW
  ) x
  WHERE COALESCE(parent_name, '') <> ''
) s
ON t.source_system_id = MD5_HEX(LOWER(TRIM(s.parent_name)))
WHEN NOT MATCHED THEN
  INSERT (parent_holding_id, name, source_system_id)
  VALUES (UUID_STRING(), s.parent_name, MD5_HEX(LOWER(TRIM(s.parent_name))));

-- -----------------------------------------------------------------------------
-- 3) OpCos (companies.json + onboarding)
-- -----------------------------------------------------------------------------
MERGE INTO DIM_OPCO t
USING (
  WITH expanded AS (
    SELECT
      grp.value:parent::STRING AS parent_name,
      co.value::STRING AS opco_name
    FROM RAW.COMPANIES_RAW c,
    LATERAL FLATTEN(input => c.payload) fw,
    LATERAL FLATTEN(input => fw.value) grp,
    LATERAL FLATTEN(input => grp.value:companies) co
    WHERE COALESCE(co.value::STRING, '') <> ''
  )
  SELECT DISTINCT
    ph.parent_holding_id,
    e.opco_name AS name,
    MD5_HEX(LOWER(TRIM(CONCAT(COALESCE(e.parent_name, ''), '|', e.opco_name)))) AS src_key
  FROM expanded e
  JOIN DIM_PARENT_HOLDING ph
    ON ph.source_system_id = MD5_HEX(LOWER(TRIM(e.parent_name)))
) s
ON t.source_system_id = s.src_key
WHEN NOT MATCHED THEN
  INSERT (opco_id, parent_holding_id, name, source_system_id)
  VALUES (UUID_STRING(), s.parent_holding_id, s.name, s.src_key);

MERGE INTO DIM_OPCO t
USING (
  SELECT DISTINCT
    ph.parent_holding_id,
    TRIM(r.payload:opco::STRING) AS name,
    MD5_HEX(LOWER(TRIM(CONCAT(COALESCE(r.payload:parent::STRING, ''), '|', r.payload:opco::STRING)))) AS src_key
  FROM RAW.ONBOARDING_OPCOS_RAW r
  JOIN DIM_PARENT_HOLDING ph
    ON ph.source_system_id = MD5_HEX(LOWER(TRIM(r.payload:parent::STRING)))
  WHERE COALESCE(r.payload:opco::STRING, '') <> ''
) s
ON t.source_system_id = s.src_key
WHEN NOT MATCHED THEN
  INSERT (opco_id, parent_holding_id, name, source_system_id, raw_profile)
  VALUES (UUID_STRING(), s.parent_holding_id, s.name, s.src_key, OBJECT_CONSTRUCT('onboarding', TRUE));

-- -----------------------------------------------------------------------------
-- 4) Bridge OpCo ↔ framework
-- -----------------------------------------------------------------------------
MERGE INTO BRIDGE_OPCO_FRAMEWORK t
USING (
  WITH from_companies AS (
    SELECT DISTINCT o.opco_id, f.framework_id
    FROM RAW.COMPANIES_RAW c,
    LATERAL FLATTEN(input => c.payload) fw,
    LATERAL FLATTEN(input => fw.value) grp,
    LATERAL FLATTEN(input => grp.value:companies) co
    JOIN DIM_FRAMEWORK f ON f.name = fw.key::STRING
    JOIN DIM_OPCO o
      ON o.source_system_id = MD5_HEX(LOWER(TRIM(CONCAT(grp.value:parent::STRING, '|', co.value::STRING))))
    WHERE COALESCE(co.value::STRING, '') <> ''
  ),
  from_onboarding AS (
    SELECT DISTINCT o.opco_id, f.framework_id
    FROM RAW.ONBOARDING_OPCOS_RAW r,
    LATERAL FLATTEN(input => r.payload:applicableFrameworks) af
    JOIN DIM_FRAMEWORK f ON f.name = af.value::STRING
    JOIN DIM_OPCO o
      ON o.source_system_id = MD5_HEX(LOWER(TRIM(CONCAT(r.payload:parent::STRING, '|', r.payload:opco::STRING))))
    WHERE COALESCE(af.value::STRING, '') <> ''
  ),
  from_onboarding_loc AS (
    SELECT DISTINCT o.opco_id, f.framework_id
    FROM RAW.ONBOARDING_OPCOS_RAW r,
    LATERAL FLATTEN(input => r.payload:applicableFrameworksByLocation) row
    JOIN DIM_FRAMEWORK f ON f.name = row.value:framework::STRING
    JOIN DIM_OPCO o
      ON o.source_system_id = MD5_HEX(LOWER(TRIM(CONCAT(r.payload:parent::STRING, '|', r.payload:opco::STRING))))
    WHERE COALESCE(row.value:framework::STRING, '') <> ''
  )
  SELECT * FROM from_companies
  UNION
  SELECT * FROM from_onboarding
  UNION
  SELECT * FROM from_onboarding_loc
) s
ON t.opco_id = s.opco_id AND t.framework_id = s.framework_id
WHEN NOT MATCHED THEN
  INSERT (opco_id, framework_id, source)
  VALUES (s.opco_id, s.framework_id, 'merge_05');

-- -----------------------------------------------------------------------------
-- 5) FACT_REGULATORY_CHANGE + affected OpCos
-- -----------------------------------------------------------------------------
MERGE INTO FACT_REGULATORY_CHANGE t
USING (
  SELECT
    r.payload:id::STRING AS legacy_key,
    f.framework_id,
    r.payload:title::STRING AS title,
    r.payload:snippet::STRING AS snippet,
    r.payload:fullText::STRING AS full_text,
    TRY_TO_DATE(r.payload:date::STRING) AS change_date,
    r.payload:sourceUrl::STRING AS source_url,
    r.payload:category::STRING AS category,
    TRY_TO_DATE(r.payload:deadline::STRING) AS deadline,
    r.payload AS raw_variant
  FROM RAW.CHANGES_RAW r
  LEFT JOIN DIM_FRAMEWORK f ON f.name = r.payload:framework::STRING
  QUALIFY ROW_NUMBER() OVER (PARTITION BY r.payload:id::STRING ORDER BY r.ingest_ts DESC) = 1
) s
ON t.legacy_key = s.legacy_key
WHEN MATCHED THEN UPDATE SET
  framework_id = s.framework_id,
  title = s.title,
  snippet = s.snippet,
  full_text = s.full_text,
  change_date = s.change_date,
  source_url = s.source_url,
  category = s.category,
  deadline = s.deadline,
  raw_variant = s.raw_variant
WHEN NOT MATCHED THEN
  INSERT (change_id, framework_id, legacy_key, title, snippet, full_text, change_date, source_url, category, deadline, raw_variant)
  VALUES (UUID_STRING(), s.framework_id, s.legacy_key, s.title, s.snippet, s.full_text, s.change_date, s.source_url, s.category, s.deadline, s.raw_variant);

MERGE INTO BRIDGE_CHANGE_AFFECTED_OPCO t
USING (
  SELECT DISTINCT fc.change_id, o.opco_id
  FROM FACT_REGULATORY_CHANGE fc
  JOIN RAW.CHANGES_RAW r ON r.payload:id::STRING = fc.legacy_key,
  LATERAL FLATTEN(input => r.payload:affectedCompanies) ac
  JOIN DIM_OPCO o ON LOWER(TRIM(o.name)) = LOWER(TRIM(ac.value::STRING))
  WHERE COALESCE(ac.value::STRING, '') <> ''
  QUALIFY ROW_NUMBER() OVER (PARTITION BY fc.change_id, o.opco_id ORDER BY r.ingest_ts DESC) = 1
) s
ON t.change_id = s.change_id AND t.opco_id = s.opco_id
WHEN NOT MATCHED THEN
  INSERT (change_id, opco_id)
  VALUES (s.change_id, s.opco_id);

-- -----------------------------------------------------------------------------
-- 6) Feed run (feed-meta.json — single object row)
-- -----------------------------------------------------------------------------
INSERT INTO FACT_REGULATORY_FEED_RUN (run_id, last_run_ts, message, raw_variant)
SELECT
  UUID_STRING(),
  TRY_TO_TIMESTAMP_TZ(payload:lastRun::STRING),
  CONCAT(
    'added=', COALESCE(payload:added::STRING, '0'),
    ' errors=', COALESCE(payload:errors::STRING, '0'),
    ' total=', COALESCE(payload:total::STRING, '0')
  ),
  payload
FROM RAW.FEED_META_RAW
QUALIFY ROW_NUMBER() OVER (ORDER BY ingest_ts DESC) = 1;

-- -----------------------------------------------------------------------------
-- 7) Onboarding submissions (skip if identical payload already stored)
-- -----------------------------------------------------------------------------
INSERT INTO FACT_ONBOARDING_SUBMISSION (
  submission_id, parent_holding_id, opco_id, organization_name, business_activities, sector, framework_tag, payload_variant
)
SELECT
  UUID_STRING(),
  ph.parent_holding_id,
  o.opco_id,
  r.payload:opco::STRING,
  r.payload:businessActivities::STRING,
  r.payload:sector::STRING,
  COALESCE(r.payload:framework::STRING, 'Onboarded'),
  r.payload
FROM RAW.ONBOARDING_OPCOS_RAW r
LEFT JOIN DIM_PARENT_HOLDING ph ON ph.source_system_id = MD5_HEX(LOWER(TRIM(r.payload:parent::STRING)))
LEFT JOIN DIM_OPCO o ON o.source_system_id = MD5_HEX(LOWER(TRIM(CONCAT(r.payload:parent::STRING, '|', r.payload:opco::STRING))))
WHERE NOT EXISTS (
  SELECT 1 FROM FACT_ONBOARDING_SUBMISSION f WHERE f.payload_variant = r.payload
);

-- -----------------------------------------------------------------------------
-- 8) Multi-shareholder bridge
-- -----------------------------------------------------------------------------
MERGE INTO BRIDGE_OPCO_MULTI_SHAREHOLDER t
USING (
  SELECT DISTINCT
    o.opco_id,
    ph.parent_holding_id,
    sh.value:percentage::NUMBER(5,2) AS pct
  FROM RAW.OPCO_MULTI_SHAREHOLDERS_RAW r,
  LATERAL FLATTEN(input => r.payload:shareholders) sh
  JOIN DIM_OPCO o ON LOWER(TRIM(o.name)) = LOWER(TRIM(r.payload:opco::STRING))
  JOIN DIM_PARENT_HOLDING ph ON ph.name = sh.value:parent::STRING
  WHERE sh.value:parent IS NOT NULL
) s
ON t.opco_id = s.opco_id AND t.parent_holding_id = s.parent_holding_id AND t.percentage = s.pct
WHEN NOT MATCHED THEN
  INSERT (bridge_id, opco_id, parent_holding_id, percentage)
  VALUES (UUID_STRING(), s.opco_id, s.parent_holding_id, s.pct);

-- -----------------------------------------------------------------------------
-- 9) Legal & ops facts (merge on JSON id in raw_variant)
-- -----------------------------------------------------------------------------
MERGE INTO FACT_POA t
USING (
  SELECT
    r.payload:id::STRING AS ext_id,
    o.opco_id,
    ph.parent_holding_id,
    r.payload:fileId::STRING AS reference_code,
    r.payload:poaType::STRING AS poa_type,
    CASE WHEN COALESCE(r.payload:revoked::BOOLEAN, FALSE) THEN 'revoked' ELSE COALESCE(r.payload:status::STRING, 'active') END AS status,
    TRY_TO_DATE(r.payload:validFrom::STRING) AS valid_from,
    TRY_TO_DATE(r.payload:validUntil::STRING) AS valid_until,
    r.payload AS raw_variant
  FROM RAW.POA_RAW r
  LEFT JOIN DIM_PARENT_HOLDING ph ON ph.source_system_id = MD5_HEX(LOWER(TRIM(r.payload:parent::STRING)))
  LEFT JOIN DIM_OPCO o ON o.source_system_id = MD5_HEX(LOWER(TRIM(CONCAT(r.payload:parent::STRING, '|', r.payload:opco::STRING))))
  QUALIFY ROW_NUMBER() OVER (PARTITION BY r.payload:id::STRING ORDER BY r.ingest_ts DESC) = 1
) s
ON t.raw_variant:id::STRING = s.ext_id
WHEN MATCHED THEN UPDATE SET
  opco_id = s.opco_id,
  parent_holding_id = s.parent_holding_id,
  reference_code = s.reference_code,
  poa_type = s.poa_type,
  status = s.status,
  valid_from = s.valid_from,
  valid_until = s.valid_until,
  raw_variant = s.raw_variant
WHEN NOT MATCHED THEN
  INSERT (poa_id, opco_id, parent_holding_id, reference_code, poa_type, status, valid_from, valid_until, raw_variant)
  VALUES (UUID_STRING(), s.opco_id, s.parent_holding_id, s.reference_code, s.poa_type, s.status, s.valid_from, s.valid_until, s.raw_variant);

MERGE INTO FACT_LICENCE t
USING (
  SELECT
    r.payload:id::STRING AS ext_id,
    o.opco_id,
    ph.parent_holding_id,
    r.payload:licenceType::STRING AS licence_type,
    r.payload:status::STRING AS st,
    TRY_TO_DATE(r.payload:issueDate::STRING) AS issue_date,
    TRY_TO_DATE(r.payload:expiryDate::STRING) AS expiry_date,
    r.payload AS raw_variant
  FROM RAW.LICENCES_RAW r
  LEFT JOIN DIM_PARENT_HOLDING ph ON ph.source_system_id = MD5_HEX(LOWER(TRIM(r.payload:parent::STRING)))
  LEFT JOIN DIM_OPCO o ON o.source_system_id = MD5_HEX(LOWER(TRIM(CONCAT(r.payload:parent::STRING, '|', r.payload:opco::STRING))))
  QUALIFY ROW_NUMBER() OVER (PARTITION BY r.payload:id::STRING ORDER BY r.ingest_ts DESC) = 1
) s
ON t.raw_variant:id::STRING = s.ext_id
WHEN MATCHED THEN UPDATE SET
  opco_id = s.opco_id,
  parent_holding_id = s.parent_holding_id,
  licence_type = s.licence_type,
  status = s.st,
  issue_date = s.issue_date,
  expiry_date = s.expiry_date,
  raw_variant = s.raw_variant
WHEN NOT MATCHED THEN
  INSERT (licence_id, opco_id, parent_holding_id, licence_type, status, issue_date, expiry_date, raw_variant)
  VALUES (UUID_STRING(), s.opco_id, s.parent_holding_id, s.licence_type, s.st, s.issue_date, s.expiry_date, s.raw_variant);

MERGE INTO FACT_CONTRACT t
USING (
  SELECT
    r.payload:id::STRING AS ext_id,
    o.opco_id,
    ph.parent_holding_id,
    r.payload:contractId::STRING AS contract_id_external,
    r.payload:contractType::STRING AS contract_type,
    r.payload:status::STRING AS st,
    TRY_TO_DATE(r.payload:effectiveDate::STRING) AS effective_date,
    TRY_TO_DATE(r.payload:expiryDate::STRING) AS end_date,
    TRY_TO_NUMBER(NULLIF(TRIM(r.payload:totalAmount::STRING), ''), 38, 2) AS value_amount,
    r.payload AS raw_variant
  FROM RAW.CONTRACTS_RAW r
  LEFT JOIN DIM_PARENT_HOLDING ph ON ph.source_system_id = MD5_HEX(LOWER(TRIM(r.payload:parent::STRING)))
  LEFT JOIN DIM_OPCO o ON o.source_system_id = MD5_HEX(LOWER(TRIM(CONCAT(r.payload:parent::STRING, '|', r.payload:opco::STRING))))
  QUALIFY ROW_NUMBER() OVER (PARTITION BY r.payload:id::STRING ORDER BY r.ingest_ts DESC) = 1
) s
ON t.raw_variant:id::STRING = s.ext_id
WHEN MATCHED THEN UPDATE SET
  opco_id = s.opco_id,
  parent_holding_id = s.parent_holding_id,
  contract_id_external = s.contract_id_external,
  contract_type = s.contract_type,
  status = s.st,
  effective_date = s.effective_date,
  end_date = s.end_date,
  value_amount = s.value_amount,
  raw_variant = s.raw_variant
WHEN NOT MATCHED THEN
  INSERT (contract_id, opco_id, parent_holding_id, contract_id_external, contract_type, status, effective_date, end_date, value_amount, raw_variant)
  VALUES (UUID_STRING(), s.opco_id, s.parent_holding_id, s.contract_id_external, s.contract_type, s.st, s.effective_date, s.end_date, s.value_amount, s.raw_variant);

MERGE INTO FACT_IP t
USING (
  SELECT
    r.payload:id::STRING AS ext_id,
    o.opco_id,
    ph.parent_holding_id,
    r.payload:ipType::STRING AS ip_type,
    COALESCE(r.payload:referenceCode::STRING, r.payload:mark::STRING) AS reference_code,
    r.payload:status::STRING AS st,
    TRY_TO_DATE(r.payload:filingDate::STRING) AS filing_date,
    TRY_TO_DATE(r.payload:grantDate::STRING) AS grant_date,
    TRY_TO_DATE(r.payload:expiryDate::STRING) AS expiry_date,
    r.payload AS raw_variant
  FROM RAW.IP_RAW r
  LEFT JOIN DIM_PARENT_HOLDING ph ON ph.source_system_id = MD5_HEX(LOWER(TRIM(r.payload:parent::STRING)))
  LEFT JOIN DIM_OPCO o ON o.source_system_id = MD5_HEX(LOWER(TRIM(CONCAT(r.payload:parent::STRING, '|', r.payload:opco::STRING))))
  QUALIFY ROW_NUMBER() OVER (PARTITION BY r.payload:id::STRING ORDER BY r.ingest_ts DESC) = 1
) s
ON t.raw_variant:id::STRING = s.ext_id
WHEN MATCHED THEN UPDATE SET
  opco_id = s.opco_id,
  parent_holding_id = s.parent_holding_id,
  ip_type = s.ip_type,
  reference_code = s.reference_code,
  status = s.st,
  filing_date = s.filing_date,
  grant_date = s.grant_date,
  expiry_date = s.expiry_date,
  raw_variant = s.raw_variant
WHEN NOT MATCHED THEN
  INSERT (ip_id, opco_id, parent_holding_id, ip_type, reference_code, status, filing_date, grant_date, expiry_date, raw_variant)
  VALUES (UUID_STRING(), s.opco_id, s.parent_holding_id, s.ip_type, s.reference_code, s.st, s.filing_date, s.grant_date, s.expiry_date, s.raw_variant);

MERGE INTO FACT_LITIGATION t
USING (
  SELECT
    r.payload:id::STRING AS ext_id,
    o.opco_id,
    ph.parent_holding_id,
    r.payload:caseId::STRING AS case_reference,
    r.payload:status::STRING AS st,
    TRY_TO_NUMBER(NULLIF(TRIM(r.payload:claimAmount::STRING), ''), 38, 2) AS claim_amount,
    r.payload:currency::STRING AS currency,
    r.payload AS raw_variant
  FROM RAW.LITIGATIONS_RAW r
  LEFT JOIN DIM_PARENT_HOLDING ph ON ph.source_system_id = MD5_HEX(LOWER(TRIM(r.payload:parent::STRING)))
  LEFT JOIN DIM_OPCO o ON o.source_system_id = MD5_HEX(LOWER(TRIM(CONCAT(r.payload:parent::STRING, '|', r.payload:opco::STRING))))
  QUALIFY ROW_NUMBER() OVER (PARTITION BY r.payload:id::STRING ORDER BY r.ingest_ts DESC) = 1
) s
ON t.raw_variant:id::STRING = s.ext_id
WHEN MATCHED THEN UPDATE SET
  opco_id = s.opco_id,
  parent_holding_id = s.parent_holding_id,
  case_reference = s.case_reference,
  status = s.st,
  claim_amount = s.claim_amount,
  currency = s.currency,
  raw_variant = s.raw_variant
WHEN NOT MATCHED THEN
  INSERT (litigation_id, opco_id, parent_holding_id, case_reference, status, claim_amount, currency, raw_variant)
  VALUES (UUID_STRING(), s.opco_id, s.parent_holding_id, s.case_reference, s.st, s.claim_amount, s.currency, s.raw_variant);

MERGE INTO FACT_TASK t
USING (
  SELECT
    r.payload:id::STRING AS ext_id,
    o.opco_id,
    ph.parent_holding_id,
    r.payload:title::STRING AS title,
    r.payload:status::STRING AS st,
    r.payload:assignee::STRING AS assignee_role,
    TRY_TO_DATE(r.payload:dueDate::STRING) AS due_date,
    r.payload:module::STRING AS related_entity_type,
    r.payload:entityId::STRING AS related_entity_id,
    r.payload AS raw_variant
  FROM RAW.TASKS_RAW r
  LEFT JOIN DIM_PARENT_HOLDING ph ON ph.source_system_id = MD5_HEX(LOWER(TRIM(r.payload:parent::STRING)))
  LEFT JOIN DIM_OPCO o ON o.source_system_id = MD5_HEX(LOWER(TRIM(CONCAT(r.payload:parent::STRING, '|', r.payload:opco::STRING))))
  QUALIFY ROW_NUMBER() OVER (PARTITION BY r.payload:id::STRING ORDER BY r.ingest_ts DESC) = 1
) s
ON t.raw_variant:id::STRING = s.ext_id
WHEN MATCHED THEN UPDATE SET
  opco_id = s.opco_id,
  parent_holding_id = s.parent_holding_id,
  title = s.title,
  status = s.st,
  assignee_role = s.assignee_role,
  due_date = s.due_date,
  related_entity_type = s.related_entity_type,
  related_entity_id = s.related_entity_id,
  raw_variant = s.raw_variant
WHEN NOT MATCHED THEN
  INSERT (task_id, opco_id, parent_holding_id, title, status, assignee_role, due_date, related_entity_type, related_entity_id, raw_variant)
  VALUES (UUID_STRING(), s.opco_id, s.parent_holding_id, s.title, s.st, s.assignee_role, s.due_date, s.related_entity_type, s.related_entity_id, s.raw_variant);

INSERT INTO FACT_AUDIT_EVENT (audit_id, actor, action, entity_type, entity_id, outcome, before_variant, after_variant)
SELECT
  UUID_STRING(),
  COALESCE(r.payload:user::STRING, r.payload:actor::STRING),
  r.payload:action::STRING,
  r.payload:module::STRING,
  COALESCE(r.payload:entityId::STRING, r.payload:entity_id::STRING),
  COALESCE(r.payload:detail::STRING, r.payload:outcome::STRING),
  r.payload:before::VARIANT,
  r.payload:after::VARIANT
FROM RAW.AUDIT_RAW r
WHERE NOT EXISTS (
  SELECT 1 FROM FACT_AUDIT_EVENT e WHERE e.entity_id = r.payload:entityId::STRING AND e.action = r.payload:action::STRING
);

-- -----------------------------------------------------------------------------
-- 10) Data sovereignty checks
--     Supports { "checks": [ ... ] } or one check per RAW row.
--     If no OpCo on a check, uses MIN(opco_id) from DIM_OPCO (run seed / merge 3 first).
-- -----------------------------------------------------------------------------
MERGE INTO FACT_DATA_SOVEREIGNTY_CHECK t
USING (
  WITH chk AS (
    SELECT f.value AS chk, r.ingest_ts
    FROM RAW.DATA_SOVEREIGNTY_RAW r,
    LATERAL FLATTEN(input => r.payload:checks) f
    WHERE r.payload:checks IS NOT NULL
    UNION ALL
    SELECT r.payload AS chk, r.ingest_ts
    FROM RAW.DATA_SOVEREIGNTY_RAW r
    WHERE r.payload:checks IS NULL
  )
  SELECT
    COALESCE(o.opco_id, (SELECT MIN(opco_id) FROM CURATED.DIM_OPCO)) AS opco_id,
    ph.parent_holding_id,
    COALESCE(c.chk:regulation::STRING, c.chk:name::STRING, c.chk:title::STRING) AS regulation,
    c.chk:severity::STRING AS severity,
    c.chk:section::STRING AS section,
    c.chk AS raw_variant
  FROM chk c
  LEFT JOIN DIM_OPCO o ON LOWER(TRIM(o.name)) = LOWER(TRIM(c.chk:opco::STRING))
  LEFT JOIN DIM_PARENT_HOLDING ph ON ph.source_system_id = MD5_HEX(LOWER(TRIM(c.chk:parent::STRING)))
  QUALIFY ROW_NUMBER() OVER (PARTITION BY TO_JSON(c.chk) ORDER BY c.ingest_ts DESC) = 1
) s
ON t.raw_variant = s.raw_variant
WHEN NOT MATCHED THEN
  INSERT (check_id, opco_id, parent_holding_id, regulation, severity, section, raw_variant)
  VALUES (UUID_STRING(), s.opco_id, s.parent_holding_id, s.regulation, s.severity, s.section, s.raw_variant);

-- -----------------------------------------------------------------------------
-- 11) Defender uploads, snapshots, findings, scores, summaries
-- -----------------------------------------------------------------------------
MERGE INTO FACT_DEFENDER_UPLOAD t
USING (
  SELECT
    r.payload:id::STRING AS ext_id,
    o.opco_id,
    ph.parent_holding_id,
    r.payload:filename::STRING AS filename,
    r.payload:mimeType::STRING AS mime_type,
    r.payload:reportType::STRING AS report_type,
    r.payload:stagePath::STRING AS stage_path,
    r.payload:status::STRING AS status,
    r.payload:errorMessage::STRING AS error_message,
    TRY_TO_TIMESTAMP_TZ(r.payload:createdAt::STRING) AS uploaded_at,
    r.payload AS raw_variant
  FROM RAW.DEFENDER_UPLOADS_RAW r
  LEFT JOIN DIM_PARENT_HOLDING ph ON ph.source_system_id = MD5_HEX(LOWER(TRIM(r.payload:parent::STRING)))
  LEFT JOIN DIM_OPCO o ON LOWER(TRIM(o.name)) = LOWER(TRIM(r.payload:opcoName::STRING))
  QUALIFY ROW_NUMBER() OVER (PARTITION BY r.payload:id::STRING ORDER BY r.ingest_ts DESC) = 1
) s
ON t.raw_variant:id::STRING = s.ext_id
WHEN MATCHED THEN UPDATE SET
  opco_id = s.opco_id,
  parent_holding_id = s.parent_holding_id,
  filename = s.filename,
  mime_type = s.mime_type,
  report_type = s.report_type,
  stage_path = s.stage_path,
  status = s.status,
  error_message = s.error_message,
  raw_variant = s.raw_variant
WHEN NOT MATCHED THEN
  INSERT (upload_id, opco_id, parent_holding_id, filename, mime_type, report_type, stage_path, status, error_message, uploaded_at, raw_variant)
  VALUES (UUID_STRING(), s.opco_id, s.parent_holding_id, s.filename, s.mime_type, s.report_type, s.stage_path, s.status, s.error_message, COALESCE(s.uploaded_at, CURRENT_TIMESTAMP()), s.raw_variant);

MERGE INTO FACT_DEFENDER_SNAPSHOT t
USING (
  SELECT
    r.payload:id::STRING AS ext_id,
    o.opco_id,
    ph.parent_holding_id,
    r.payload:uploadId::STRING AS upload_id,
    r.payload:reportType::STRING AS metric_type,
    TRY_TO_NUMBER(r.payload:value::STRING, 38, 4) AS value,
    r.payload:valueType::STRING AS value_type,
    TRY_TO_TIMESTAMP_TZ(COALESCE(r.payload:reportDate::STRING, r.payload:createdAt::STRING)) AS effective_at,
    r.payload AS raw_variant
  FROM RAW.DEFENDER_SNAPSHOTS_RAW r
  LEFT JOIN DIM_PARENT_HOLDING ph ON ph.source_system_id = MD5_HEX(LOWER(TRIM(r.payload:parent::STRING)))
  LEFT JOIN DIM_OPCO o ON LOWER(TRIM(o.name)) = LOWER(TRIM(r.payload:opcoName::STRING))
  QUALIFY ROW_NUMBER() OVER (PARTITION BY r.payload:id::STRING ORDER BY r.ingest_ts DESC) = 1
) s
ON t.raw_variant:id::STRING = s.ext_id
WHEN MATCHED THEN UPDATE SET
  opco_id = s.opco_id,
  parent_holding_id = s.parent_holding_id,
  upload_id = s.upload_id,
  metric_type = s.metric_type,
  value = s.value,
  value_type = s.value_type,
  effective_at = s.effective_at,
  raw_variant = s.raw_variant
WHEN NOT MATCHED THEN
  INSERT (snapshot_id, opco_id, parent_holding_id, upload_id, metric_type, value, value_type, effective_at, raw_variant)
  VALUES (UUID_STRING(), s.opco_id, s.parent_holding_id, s.upload_id, s.metric_type, s.value, s.value_type, s.effective_at, s.raw_variant);

MERGE INTO FACT_DEFENDER_FINDING t
USING (
  SELECT
    r.payload:id::STRING AS ext_id,
    o.opco_id,
    r.payload:uploadId::STRING AS upload_id,
    r.payload:title::STRING AS title,
    r.payload:severity::STRING AS severity,
    r.payload:status::STRING AS status,
    r.payload:source::STRING AS source,
    r.payload AS raw_variant
  FROM RAW.DEFENDER_FINDINGS_RAW r
  LEFT JOIN DIM_OPCO o ON LOWER(TRIM(o.name)) = LOWER(TRIM(r.payload:opcoName::STRING))
  QUALIFY ROW_NUMBER() OVER (PARTITION BY r.payload:id::STRING ORDER BY r.ingest_ts DESC) = 1
) s
ON t.raw_variant:id::STRING = s.ext_id
WHEN MATCHED THEN UPDATE SET
  opco_id = s.opco_id,
  upload_id = s.upload_id,
  title = s.title,
  severity = s.severity,
  status = s.status,
  source = s.source,
  raw_variant = s.raw_variant
WHEN NOT MATCHED THEN
  INSERT (finding_id, opco_id, upload_id, title, severity, status, source, raw_variant)
  VALUES (UUID_STRING(), s.opco_id, s.upload_id, s.title, s.severity, s.status, s.source, s.raw_variant);

MERGE INTO FACT_DEFENDER_SCORE t
USING (
  SELECT
    o.opco_id,
    ph.parent_holding_id,
    TRY_TO_NUMBER(r.payload:score::STRING, 38, 2) AS score,
    r.payload:band::STRING AS band,
    r.payload:bandColor::STRING AS band_color,
    TRY_TO_NUMBER(r.payload:evidence:frameworkCoverage::STRING, 38, 2) AS framework_cov_pct,
    TRY_TO_NUMBER(r.payload:evidence:secureScore::STRING, 38, 2) AS secure_score_pct,
    TRY_TO_NUMBER(r.payload:evidence:openCritical::STRING, 38, 0) AS open_critical,
    TRY_TO_NUMBER(r.payload:evidence:openHigh::STRING, 38, 0) AS open_high,
    TRY_TO_NUMBER(r.payload:evidence:penalty::STRING, 38, 2) AS penalty,
    r.payload:evidence AS evidence_variant,
    COALESCE(TRY_TO_TIMESTAMP_TZ(r.payload:computedAt::STRING), r.ingest_ts) AS computed_at
  FROM RAW.DEFENDER_SCORES_RAW r
  LEFT JOIN DIM_PARENT_HOLDING ph ON ph.source_system_id = MD5_HEX(LOWER(TRIM(r.payload:parent::STRING)))
  INNER JOIN DIM_OPCO o ON LOWER(TRIM(o.name)) = LOWER(TRIM(r.payload:opcoName::STRING))
  WHERE r.payload:opcoName IS NOT NULL
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY o.opco_id, COALESCE(TRY_TO_TIMESTAMP_TZ(r.payload:computedAt::STRING), r.ingest_ts)
    ORDER BY r.ingest_ts DESC
  ) = 1
) s
ON t.opco_id = s.opco_id AND t.computed_at = s.computed_at
WHEN MATCHED THEN UPDATE SET
  parent_holding_id = s.parent_holding_id,
  score = s.score,
  band = s.band,
  band_color = s.band_color,
  framework_cov_pct = s.framework_cov_pct,
  secure_score_pct = s.secure_score_pct,
  open_critical = s.open_critical,
  open_high = s.open_high,
  penalty = s.penalty,
  evidence_variant = s.evidence_variant
WHEN NOT MATCHED THEN
  INSERT (score_id, opco_id, parent_holding_id, score, band, band_color, framework_cov_pct, secure_score_pct, open_critical, open_high, penalty, evidence_variant, computed_at)
  VALUES (UUID_STRING(), s.opco_id, s.parent_holding_id, s.score, s.band, s.band_color, s.framework_cov_pct, s.secure_score_pct, s.open_critical, s.open_high, s.penalty, s.evidence_variant, s.computed_at);

MERGE INTO FACT_DEFENDER_SUMMARY t
USING (
  SELECT
    o.opco_id,
    r.payload:summary::STRING AS summary_text,
    r.payload:modelId::STRING AS model_id,
    r.payload:promptHash::STRING AS prompt_hash,
    TRY_TO_TIMESTAMP_TZ(r.payload:updatedAt::STRING) AS updated_at,
    r.payload AS raw_variant
  FROM RAW.DEFENDER_SUMMARIES_RAW r
  JOIN DIM_OPCO o ON LOWER(TRIM(o.name)) = LOWER(TRIM(r.payload:opcoName::STRING))
  QUALIFY ROW_NUMBER() OVER (PARTITION BY o.opco_id ORDER BY r.ingest_ts DESC) = 1
) s
ON t.opco_id = s.opco_id
WHEN MATCHED THEN UPDATE SET
  summary_text = s.summary_text,
  model_id = s.model_id,
  prompt_hash = s.prompt_hash,
  updated_at = s.updated_at,
  raw_variant = s.raw_variant
WHEN NOT MATCHED THEN
  INSERT (opco_id, summary_text, model_id, prompt_hash, updated_at, raw_variant)
  VALUES (s.opco_id, s.summary_text, s.model_id, s.prompt_hash, s.updated_at, s.raw_variant);

-- -----------------------------------------------------------------------------
-- 12) AI model usage (optional file)
-- -----------------------------------------------------------------------------
MERGE INTO FACT_AI_MODEL_USAGE t
USING (
  SELECT
    o.opco_id,
    ph.parent_holding_id,
    r.payload:model::STRING AS model_name,
    r.payload:useCase::STRING AS use_case,
    r.payload:crossBorder::STRING AS cross_border,
    r.payload AS raw_variant
  FROM RAW.AI_MODEL_USAGE_RAW r
  LEFT JOIN DIM_PARENT_HOLDING ph ON ph.source_system_id = MD5_HEX(LOWER(TRIM(r.payload:parent::STRING)))
  LEFT JOIN DIM_OPCO o ON o.source_system_id = MD5_HEX(LOWER(TRIM(CONCAT(r.payload:parent::STRING, '|', r.payload:opco::STRING))))
  QUALIFY ROW_NUMBER() OVER (PARTITION BY TO_JSON(r.payload) ORDER BY r.ingest_ts DESC) = 1
) s
ON t.raw_variant = s.raw_variant
WHEN NOT MATCHED THEN
  INSERT (usage_id, opco_id, parent_holding_id, model_name, use_case, cross_border, raw_variant)
  VALUES (UUID_STRING(), s.opco_id, s.parent_holding_id, s.model_name, s.use_case, s.cross_border, s.raw_variant);

-- -----------------------------------------------------------------------------
-- 13) ESG metrics (payload.metrics object — FLATTEN key/value pairs)
-- -----------------------------------------------------------------------------
MERGE INTO FACT_ESG_METRIC t
USING (
  SELECT
    o.opco_id,
    ph.parent_holding_id,
    kv.key::STRING AS metric_key,
    TRY_TO_NUMBER(kv.value::STRING, 38, 6) AS metric_value,
    OBJECT_INSERT(r.payload, 'metric_key', kv.key::STRING) AS raw_variant
  FROM RAW.ESG_METRICS_RAW r,
  LATERAL FLATTEN(input => r.payload:metrics) kv
  LEFT JOIN DIM_PARENT_HOLDING ph ON ph.source_system_id = MD5_HEX(LOWER(TRIM(r.payload:parent::STRING)))
  LEFT JOIN DIM_OPCO o ON o.source_system_id = MD5_HEX(LOWER(TRIM(CONCAT(r.payload:parent::STRING, '|', r.payload:opco::STRING))))
  WHERE r.payload:metrics IS NOT NULL
  QUALIFY ROW_NUMBER() OVER (PARTITION BY o.opco_id, kv.key::STRING ORDER BY r.ingest_ts DESC) = 1
) s
ON t.opco_id = s.opco_id AND t.metric_key = s.metric_key
WHEN MATCHED THEN UPDATE SET
  parent_holding_id = s.parent_holding_id,
  metric_value = s.metric_value,
  raw_variant = s.raw_variant
WHEN NOT MATCHED THEN
  INSERT (metric_id, opco_id, parent_holding_id, metric_key, metric_value, raw_variant)
  VALUES (UUID_STRING(), s.opco_id, s.parent_holding_id, s.metric_key, s.metric_value, s.raw_variant);
