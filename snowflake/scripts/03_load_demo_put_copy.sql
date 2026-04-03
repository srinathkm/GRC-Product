-- 1) PUT files from local machine (SnowSQL), e.g.:
-- PUT file://.../server/data/changes.json @GRC_DEMO_DB.RAW.INTERNAL_GRC_STAGE/legacy_json/ AUTO_COMPRESS=FALSE;

USE DATABASE GRC_DEMO_DB;
USE SCHEMA RAW;

-- 2) Example COPY into CHANGES_RAW — adjust FILE_FORMAT and pattern per file shape.
/*
COPY INTO CHANGES_RAW (source_file, payload)
FROM (
  SELECT METADATA$FILENAME, $1
  FROM @INTERNAL_GRC_STAGE/legacy_json/
)
FILES = ('changes.json')
FILE_FORMAT = (TYPE = JSON STRIP_OUTER_ARRAY = TRUE);
*/

-- Repeat COPY for each JSON file into matching *_RAW table.
-- See docs/JSON_TO_TABLE_MAP.md.
