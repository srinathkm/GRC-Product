-- =============================================================================
-- COPY INTO: all JSON files from JSON_TO_TABLE_MAP.md → RAW.*_RAW tables
-- =============================================================================
-- Prerequisites:
--   1. Run schemas/01_raw_landing.sql (RAW tables exist).
--   2. Run scripts/02_stages_and_file_formats.sql (INTERNAL_GRC_STAGE exists).
--   3. PUT local files from server/data/ onto the stage, e.g.:
--        PUT file:///path/to/regulation-changes-dashboard/server/data/*.json
--        @GRC_DEMO_DB.RAW.INTERNAL_GRC_STAGE/legacy_json/
--        AUTO_COMPRESS=FALSE OVERWRITE=TRUE;
--
-- Stage prefix (edit if you used a different path):
--   @GRC_DEMO_DB.RAW.INTERNAL_GRC_STAGE/legacy_json/
--
-- STRIP_OUTER_ARRAY:
--   TRUE  = root is a JSON array [...] — one row per array element.
--   FALSE = root is a single JSON object {...} — one row for the whole file.
-- =============================================================================
--
-- File shape vs STRIP_OUTER_ARRAY (matches typical server/data samples):
--   FALSE — companies.json, feed-meta.json, fieldMappings.json (root object)
--   TRUE  — all other mapped files (root JSON array)
--
-- Reload: Snowflake may skip already-loaded files; TRUNCATE RAW, adjust load history,
--   PUT to a new prefix, or use FORCE on COPY per Snowflake docs.
--
-- Missing ai-model-usage.json: comment out that COPY block to avoid failure.
--

USE DATABASE GRC_DEMO_DB;
USE SCHEMA RAW;

/*
TRUNCATE TABLE IF EXISTS COMPANIES_RAW;
TRUNCATE TABLE IF EXISTS ONBOARDING_OPCOS_RAW;
TRUNCATE TABLE IF EXISTS OPCO_MULTI_SHAREHOLDERS_RAW;
TRUNCATE TABLE IF EXISTS CHANGES_RAW;
TRUNCATE TABLE IF EXISTS FEED_META_RAW;
TRUNCATE TABLE IF EXISTS TASKS_RAW;
TRUNCATE TABLE IF EXISTS AUDIT_RAW;
TRUNCATE TABLE IF EXISTS POA_RAW;
TRUNCATE TABLE IF EXISTS LICENCES_RAW;
TRUNCATE TABLE IF EXISTS CONTRACTS_RAW;
TRUNCATE TABLE IF EXISTS IP_RAW;
TRUNCATE TABLE IF EXISTS LITIGATIONS_RAW;
TRUNCATE TABLE IF EXISTS DATA_SOVEREIGNTY_RAW;
TRUNCATE TABLE IF EXISTS ESG_METRICS_RAW;
TRUNCATE TABLE IF EXISTS FIELD_MAPPINGS_RAW;
TRUNCATE TABLE IF EXISTS DEFENDER_UPLOADS_RAW;
TRUNCATE TABLE IF EXISTS DEFENDER_SNAPSHOTS_RAW;
TRUNCATE TABLE IF EXISTS DEFENDER_FINDINGS_RAW;
TRUNCATE TABLE IF EXISTS DEFENDER_SCORES_RAW;
TRUNCATE TABLE IF EXISTS DEFENDER_SUMMARIES_RAW;
TRUNCATE TABLE IF EXISTS AI_MODEL_USAGE_RAW;
*/

-- -----------------------------------------------------------------------------
-- companies.json → COMPANIES_RAW
-- -----------------------------------------------------------------------------
COPY INTO COMPANIES_RAW (source_file, payload)
FROM (
  SELECT
    REGEXP_SUBSTR(METADATA$FILENAME, '[^/]+$') AS source_file,
    $1 AS payload
  FROM @GRC_DEMO_DB.RAW.INTERNAL_GRC_STAGE/legacy_json/
)
FILES = ('companies.json')
FILE_FORMAT = (TYPE = JSON STRIP_OUTER_ARRAY = FALSE)
ON_ERROR = 'ABORT_STATEMENT';

-- -----------------------------------------------------------------------------
-- onboarding-opcos.json → ONBOARDING_OPCOS_RAW
-- -----------------------------------------------------------------------------
COPY INTO ONBOARDING_OPCOS_RAW (source_file, payload)
FROM (
  SELECT
    REGEXP_SUBSTR(METADATA$FILENAME, '[^/]+$') AS source_file,
    $1 AS payload
  FROM @GRC_DEMO_DB.RAW.INTERNAL_GRC_STAGE/legacy_json/
)
FILES = ('onboarding-opcos.json')
FILE_FORMAT = (TYPE = JSON STRIP_OUTER_ARRAY = TRUE)
ON_ERROR = 'ABORT_STATEMENT';

-- -----------------------------------------------------------------------------
-- opco-multi-shareholders.json → OPCO_MULTI_SHAREHOLDERS_RAW
-- -----------------------------------------------------------------------------
COPY INTO OPCO_MULTI_SHAREHOLDERS_RAW (source_file, payload)
FROM (
  SELECT
    REGEXP_SUBSTR(METADATA$FILENAME, '[^/]+$') AS source_file,
    $1 AS payload
  FROM @GRC_DEMO_DB.RAW.INTERNAL_GRC_STAGE/legacy_json/
)
FILES = ('opco-multi-shareholders.json')
FILE_FORMAT = (TYPE = JSON STRIP_OUTER_ARRAY = TRUE)
ON_ERROR = 'ABORT_STATEMENT';

-- -----------------------------------------------------------------------------
-- changes.json → CHANGES_RAW
-- -----------------------------------------------------------------------------
COPY INTO CHANGES_RAW (source_file, payload)
FROM (
  SELECT
    REGEXP_SUBSTR(METADATA$FILENAME, '[^/]+$') AS source_file,
    $1 AS payload
  FROM @GRC_DEMO_DB.RAW.INTERNAL_GRC_STAGE/legacy_json/
)
FILES = ('changes.json')
FILE_FORMAT = (TYPE = JSON STRIP_OUTER_ARRAY = TRUE)
ON_ERROR = 'ABORT_STATEMENT';

-- -----------------------------------------------------------------------------
-- feed-meta.json → FEED_META_RAW
-- -----------------------------------------------------------------------------
COPY INTO FEED_META_RAW (source_file, payload)
FROM (
  SELECT
    REGEXP_SUBSTR(METADATA$FILENAME, '[^/]+$') AS source_file,
    $1 AS payload
  FROM @GRC_DEMO_DB.RAW.INTERNAL_GRC_STAGE/legacy_json/
)
FILES = ('feed-meta.json')
FILE_FORMAT = (TYPE = JSON STRIP_OUTER_ARRAY = FALSE)
ON_ERROR = 'ABORT_STATEMENT';

-- -----------------------------------------------------------------------------
-- tasks.json → TASKS_RAW
-- -----------------------------------------------------------------------------
COPY INTO TASKS_RAW (source_file, payload)
FROM (
  SELECT
    REGEXP_SUBSTR(METADATA$FILENAME, '[^/]+$') AS source_file,
    $1 AS payload
  FROM @GRC_DEMO_DB.RAW.INTERNAL_GRC_STAGE/legacy_json/
)
FILES = ('tasks.json')
FILE_FORMAT = (TYPE = JSON STRIP_OUTER_ARRAY = TRUE)
ON_ERROR = 'ABORT_STATEMENT';

-- -----------------------------------------------------------------------------
-- audit.json → AUDIT_RAW
-- -----------------------------------------------------------------------------
COPY INTO AUDIT_RAW (source_file, payload)
FROM (
  SELECT
    REGEXP_SUBSTR(METADATA$FILENAME, '[^/]+$') AS source_file,
    $1 AS payload
  FROM @GRC_DEMO_DB.RAW.INTERNAL_GRC_STAGE/legacy_json/
)
FILES = ('audit.json')
FILE_FORMAT = (TYPE = JSON STRIP_OUTER_ARRAY = TRUE)
ON_ERROR = 'ABORT_STATEMENT';

-- -----------------------------------------------------------------------------
-- poa.json → POA_RAW
-- -----------------------------------------------------------------------------
COPY INTO POA_RAW (source_file, payload)
FROM (
  SELECT
    REGEXP_SUBSTR(METADATA$FILENAME, '[^/]+$') AS source_file,
    $1 AS payload
  FROM @GRC_DEMO_DB.RAW.INTERNAL_GRC_STAGE/legacy_json/
)
FILES = ('poa.json')
FILE_FORMAT = (TYPE = JSON STRIP_OUTER_ARRAY = TRUE)
ON_ERROR = 'ABORT_STATEMENT';

-- -----------------------------------------------------------------------------
-- licences.json → LICENCES_RAW
-- -----------------------------------------------------------------------------
COPY INTO LICENCES_RAW (source_file, payload)
FROM (
  SELECT
    REGEXP_SUBSTR(METADATA$FILENAME, '[^/]+$') AS source_file,
    $1 AS payload
  FROM @GRC_DEMO_DB.RAW.INTERNAL_GRC_STAGE/legacy_json/
)
FILES = ('licences.json')
FILE_FORMAT = (TYPE = JSON STRIP_OUTER_ARRAY = TRUE)
ON_ERROR = 'ABORT_STATEMENT';

-- -----------------------------------------------------------------------------
-- contracts.json → CONTRACTS_RAW
-- -----------------------------------------------------------------------------
COPY INTO CONTRACTS_RAW (source_file, payload)
FROM (
  SELECT
    REGEXP_SUBSTR(METADATA$FILENAME, '[^/]+$') AS source_file,
    $1 AS payload
  FROM @GRC_DEMO_DB.RAW.INTERNAL_GRC_STAGE/legacy_json/
)
FILES = ('contracts.json')
FILE_FORMAT = (TYPE = JSON STRIP_OUTER_ARRAY = TRUE)
ON_ERROR = 'ABORT_STATEMENT';

-- -----------------------------------------------------------------------------
-- ip.json → IP_RAW
-- -----------------------------------------------------------------------------
COPY INTO IP_RAW (source_file, payload)
FROM (
  SELECT
    REGEXP_SUBSTR(METADATA$FILENAME, '[^/]+$') AS source_file,
    $1 AS payload
  FROM @GRC_DEMO_DB.RAW.INTERNAL_GRC_STAGE/legacy_json/
)
FILES = ('ip.json')
FILE_FORMAT = (TYPE = JSON STRIP_OUTER_ARRAY = TRUE)
ON_ERROR = 'ABORT_STATEMENT';

-- -----------------------------------------------------------------------------
-- litigations.json → LITIGATIONS_RAW
-- -----------------------------------------------------------------------------
COPY INTO LITIGATIONS_RAW (source_file, payload)
FROM (
  SELECT
    REGEXP_SUBSTR(METADATA$FILENAME, '[^/]+$') AS source_file,
    $1 AS payload
  FROM @GRC_DEMO_DB.RAW.INTERNAL_GRC_STAGE/legacy_json/
)
FILES = ('litigations.json')
FILE_FORMAT = (TYPE = JSON STRIP_OUTER_ARRAY = TRUE)
ON_ERROR = 'ABORT_STATEMENT';

-- -----------------------------------------------------------------------------
-- data-sovereignty-checks.json → DATA_SOVEREIGNTY_RAW
-- -----------------------------------------------------------------------------
COPY INTO DATA_SOVEREIGNTY_RAW (source_file, payload)
FROM (
  SELECT
    REGEXP_SUBSTR(METADATA$FILENAME, '[^/]+$') AS source_file,
    $1 AS payload
  FROM @GRC_DEMO_DB.RAW.INTERNAL_GRC_STAGE/legacy_json/
)
FILES = ('data-sovereignty-checks.json')
FILE_FORMAT = (TYPE = JSON STRIP_OUTER_ARRAY = TRUE)
ON_ERROR = 'ABORT_STATEMENT';

-- -----------------------------------------------------------------------------
-- esg-metrics.json → ESG_METRICS_RAW
-- -----------------------------------------------------------------------------
COPY INTO ESG_METRICS_RAW (source_file, payload)
FROM (
  SELECT
    REGEXP_SUBSTR(METADATA$FILENAME, '[^/]+$') AS source_file,
    $1 AS payload
  FROM @GRC_DEMO_DB.RAW.INTERNAL_GRC_STAGE/legacy_json/
)
FILES = ('esg-metrics.json')
FILE_FORMAT = (TYPE = JSON STRIP_OUTER_ARRAY = TRUE)
ON_ERROR = 'ABORT_STATEMENT';

-- -----------------------------------------------------------------------------
-- fieldMappings.json → FIELD_MAPPINGS_RAW
-- -----------------------------------------------------------------------------
COPY INTO FIELD_MAPPINGS_RAW (source_file, payload)
FROM (
  SELECT
    REGEXP_SUBSTR(METADATA$FILENAME, '[^/]+$') AS source_file,
    $1 AS payload
  FROM @GRC_DEMO_DB.RAW.INTERNAL_GRC_STAGE/legacy_json/
)
FILES = ('fieldMappings.json')
FILE_FORMAT = (TYPE = JSON STRIP_OUTER_ARRAY = FALSE)
ON_ERROR = 'ABORT_STATEMENT';

-- -----------------------------------------------------------------------------
-- defender-uploads.json → DEFENDER_UPLOADS_RAW
-- -----------------------------------------------------------------------------
COPY INTO DEFENDER_UPLOADS_RAW (source_file, payload)
FROM (
  SELECT
    REGEXP_SUBSTR(METADATA$FILENAME, '[^/]+$') AS source_file,
    $1 AS payload
  FROM @GRC_DEMO_DB.RAW.INTERNAL_GRC_STAGE/legacy_json/
)
FILES = ('defender-uploads.json')
FILE_FORMAT = (TYPE = JSON STRIP_OUTER_ARRAY = TRUE)
ON_ERROR = 'ABORT_STATEMENT';

-- -----------------------------------------------------------------------------
-- defender-snapshots.json → DEFENDER_SNAPSHOTS_RAW
-- -----------------------------------------------------------------------------
COPY INTO DEFENDER_SNAPSHOTS_RAW (source_file, payload)
FROM (
  SELECT
    REGEXP_SUBSTR(METADATA$FILENAME, '[^/]+$') AS source_file,
    $1 AS payload
  FROM @GRC_DEMO_DB.RAW.INTERNAL_GRC_STAGE/legacy_json/
)
FILES = ('defender-snapshots.json')
FILE_FORMAT = (TYPE = JSON STRIP_OUTER_ARRAY = TRUE)
ON_ERROR = 'ABORT_STATEMENT';

-- -----------------------------------------------------------------------------
-- defender-findings.json → DEFENDER_FINDINGS_RAW
-- -----------------------------------------------------------------------------
COPY INTO DEFENDER_FINDINGS_RAW (source_file, payload)
FROM (
  SELECT
    REGEXP_SUBSTR(METADATA$FILENAME, '[^/]+$') AS source_file,
    $1 AS payload
  FROM @GRC_DEMO_DB.RAW.INTERNAL_GRC_STAGE/legacy_json/
)
FILES = ('defender-findings.json')
FILE_FORMAT = (TYPE = JSON STRIP_OUTER_ARRAY = TRUE)
ON_ERROR = 'ABORT_STATEMENT';

-- -----------------------------------------------------------------------------
-- defender-scores.json → DEFENDER_SCORES_RAW
-- -----------------------------------------------------------------------------
COPY INTO DEFENDER_SCORES_RAW (source_file, payload)
FROM (
  SELECT
    REGEXP_SUBSTR(METADATA$FILENAME, '[^/]+$') AS source_file,
    $1 AS payload
  FROM @GRC_DEMO_DB.RAW.INTERNAL_GRC_STAGE/legacy_json/
)
FILES = ('defender-scores.json')
FILE_FORMAT = (TYPE = JSON STRIP_OUTER_ARRAY = TRUE)
ON_ERROR = 'ABORT_STATEMENT';

-- -----------------------------------------------------------------------------
-- defender-summaries.json → DEFENDER_SUMMARIES_RAW
-- -----------------------------------------------------------------------------
COPY INTO DEFENDER_SUMMARIES_RAW (source_file, payload)
FROM (
  SELECT
    REGEXP_SUBSTR(METADATA$FILENAME, '[^/]+$') AS source_file,
    $1 AS payload
  FROM @GRC_DEMO_DB.RAW.INTERNAL_GRC_STAGE/legacy_json/
)
FILES = ('defender-summaries.json')
FILE_FORMAT = (TYPE = JSON STRIP_OUTER_ARRAY = TRUE)
ON_ERROR = 'ABORT_STATEMENT';

-- -----------------------------------------------------------------------------
-- ai-model-usage.json → AI_MODEL_USAGE_RAW
-- -----------------------------------------------------------------------------
COPY INTO AI_MODEL_USAGE_RAW (source_file, payload)
FROM (
  SELECT
    REGEXP_SUBSTR(METADATA$FILENAME, '[^/]+$') AS source_file,
    $1 AS payload
  FROM @GRC_DEMO_DB.RAW.INTERNAL_GRC_STAGE/legacy_json/
)
FILES = ('ai-model-usage.json')
FILE_FORMAT = (TYPE = JSON STRIP_OUTER_ARRAY = TRUE)
ON_ERROR = 'ABORT_STATEMENT';

-- =============================================================================
-- Post-check: row counts per RAW table
-- =============================================================================
SELECT 'COMPANIES_RAW' AS tbl, COUNT(*) AS c FROM COMPANIES_RAW
UNION ALL SELECT 'ONBOARDING_OPCOS_RAW', COUNT(*) FROM ONBOARDING_OPCOS_RAW
UNION ALL SELECT 'OPCO_MULTI_SHAREHOLDERS_RAW', COUNT(*) FROM OPCO_MULTI_SHAREHOLDERS_RAW
UNION ALL SELECT 'CHANGES_RAW', COUNT(*) FROM CHANGES_RAW
UNION ALL SELECT 'FEED_META_RAW', COUNT(*) FROM FEED_META_RAW
UNION ALL SELECT 'TASKS_RAW', COUNT(*) FROM TASKS_RAW
UNION ALL SELECT 'AUDIT_RAW', COUNT(*) FROM AUDIT_RAW
UNION ALL SELECT 'POA_RAW', COUNT(*) FROM POA_RAW
UNION ALL SELECT 'LICENCES_RAW', COUNT(*) FROM LICENCES_RAW
UNION ALL SELECT 'CONTRACTS_RAW', COUNT(*) FROM CONTRACTS_RAW
UNION ALL SELECT 'IP_RAW', COUNT(*) FROM IP_RAW
UNION ALL SELECT 'LITIGATIONS_RAW', COUNT(*) FROM LITIGATIONS_RAW
UNION ALL SELECT 'DATA_SOVEREIGNTY_RAW', COUNT(*) FROM DATA_SOVEREIGNTY_RAW
UNION ALL SELECT 'ESG_METRICS_RAW', COUNT(*) FROM ESG_METRICS_RAW
UNION ALL SELECT 'FIELD_MAPPINGS_RAW', COUNT(*) FROM FIELD_MAPPINGS_RAW
UNION ALL SELECT 'DEFENDER_UPLOADS_RAW', COUNT(*) FROM DEFENDER_UPLOADS_RAW
UNION ALL SELECT 'DEFENDER_SNAPSHOTS_RAW', COUNT(*) FROM DEFENDER_SNAPSHOTS_RAW
UNION ALL SELECT 'DEFENDER_FINDINGS_RAW', COUNT(*) FROM DEFENDER_FINDINGS_RAW
UNION ALL SELECT 'DEFENDER_SCORES_RAW', COUNT(*) FROM DEFENDER_SCORES_RAW
UNION ALL SELECT 'DEFENDER_SUMMARIES_RAW', COUNT(*) FROM DEFENDER_SUMMARIES_RAW
UNION ALL SELECT 'AI_MODEL_USAGE_RAW', COUNT(*) FROM AI_MODEL_USAGE_RAW
ORDER BY 1;
