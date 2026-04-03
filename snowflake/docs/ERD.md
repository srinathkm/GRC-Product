# Curated schema ERD (high level)

```mermaid
erDiagram
  DIM_PARENT_HOLDING ||--o{ DIM_OPCO : owns
  DIM_OPCO ||--o{ BRIDGE_OPCO_FRAMEWORK : applicable
  DIM_FRAMEWORK ||--o{ BRIDGE_OPCO_FRAMEWORK : applies
  DIM_FRAMEWORK ||--o{ FACT_REGULATORY_CHANGE : publishes
  DIM_OPCO ||--o{ FACT_REGULATORY_CHANGE : affects_optional
  DIM_OPCO ||--o{ FACT_POA : registers
  DIM_OPCO ||--o{ FACT_LICENCE : registers
  DIM_OPCO ||--o{ FACT_CONTRACT : registers
  DIM_OPCO ||--o{ FACT_IP : registers
  DIM_OPCO ||--o{ FACT_LITIGATION : registers
  DIM_OPCO ||--o{ FACT_TASK : tracks
  DIM_OPCO ||--o{ FACT_DATA_SOVEREIGNTY_CHECK : checks
  DIM_OPCO ||--o{ FACT_DEFENDER_SCORE : scores
  DIM_OPCO ||--o{ ML_FEATURE_REGULATORY_OPCO : features
  DIM_OPCO ||--o{ ML_PREDICTION_RISK_SCORE : predicts
  DIM_LEGAL_DOCUMENT ||--o{ FACT_CONTRACT : evidence
```

**Bridges (not all shown):** `BRIDGE_OPCO_LICENSING_AUTHORITY`, `BRIDGE_CHANGE_AFFECTED_OPCO`, `BRIDGE_OPCO_MULTI_SHAREHOLDER`.

**RAW layer:** One table per file with `payload VARIANT` — see [JSON_TO_TABLE_MAP.md](JSON_TO_TABLE_MAP.md).
