# Intelligence, AI, and ML (implementation essentials)

This section expands the architecture doc with **mandatory** implementation details for a Snowflake-centric intelligence outcome.

## 1. Separation of concerns

| Concern | Schema / object | Responsibility |
|---------|-----------------|----------------|
| Curated truth | `CURATED.*` | Business entities and transactions |
| Analytics | `ANALYTICS.VW_*` | Stable contracts for UI and APIs |
| Features | `ML.ML_FEATURE_REGULATORY_OPCO`, other `ML_FEATURE_*` | Training and inference inputs |
| LLM runs | `ML.ML_CORTEX_RUN_LOG`, `ML.ML_PROMPT_TEMPLATE` | Audit, replay, cost |
| Tabular ML | `ML.MODEL_REGISTRY`, `ML.PREDICTION_RISK_SCORE` | Versioned models and outputs |
| Documents | `ML.DOCUMENT_CHUNK`, `ML.DOCUMENT_EMBEDDING` (optional) | RAG |

Do **not** mix LLM outputs into curated facts without a clear `source = cortex` and `run_id` foreign key.

## 2. Cortex (LLM) pattern

1. Build `ANALYTICS.VW_OPCO_INTELLIGENCE_CONTEXT` (SQL) assembling:
   - open task counts, overdue legal items, Defender band, recent regulatory change count, data sovereignty severities.
2. Application or task calls Cortex with **frozen prompt template** from `ML.ML_PROMPT_TEMPLATE`.
3. Insert result into `ML.ML_CORTEX_RUN_LOG` with:
   - `input_context_hash`, `output_text`, `template_id`, `latency_ms`, `opco_id`, `parent_holding_id`.
4. Optional: copy **approved** summary to `FACT_DEFENDER_SUMMARY` or a new `FACT_OPCO_EXEC_SUMMARY` for fast reads.

**Account note:** Enablement and function names differ by region and edition. Use Snowflake documentation for `SNOWFLAKE.CORTEX.*` availability.

## 3. RAG (regulatory and legal text)

1. Chunk text into `ML.DOCUMENT_CHUNK` (`chunk_id`, `source_type`, `source_id`, `chunk_index`, `content`).
2. Generate embeddings via Snowflake or external pipeline into `ML.DOCUMENT_EMBEDDING` (`chunk_id`, `embedding_variant` or VECTOR type if available).
3. Cortex Search or vector search scoped by `framework_id` / `opco_id` metadata on chunks.
4. Log retrieval + generation in `ML.ML_CORTEX_RUN_LOG.retrieval_variant` (doc ids, scores).

## 4. Tabular ML and predictions

1. Build `ML.ML_FEATURE_REGULATORY_OPCO` on a schedule (daily).
2. Register model in `ML.MODEL_REGISTRY` after each training run.
3. Write predictions to `ML.ML_PREDICTION_RISK_SCORE` with `model_version` and `explanation_variant` (table name in DDL: `GRC_DEMO_DB.ML.ML_PREDICTION_RISK_SCORE`).
4. Expose `ANALYTICS.VW_OPCO_RISK_FOR_UI` joining OpCo, latest prediction, and key drivers.

**Rules-based v1:** A SQL view can populate `ML_PREDICTION_RISK_SCORE` with `model_name = 'RULE_BASED_V1'` so UI and API contracts work before ML training.

## 5. Observability and governance

- **Lineage:** Tag tables and document upstream RAW files in table `COMMENT`.
- **PII:** Tag columns with privacy category; apply masking policies.
- **Cost:** Track Cortex calls in `ML.ML_CORTEX_RUN_LOG`; aggregate by day for demo dashboards.

## 6. Testing before demo

- Row counts: RAW vs CURATED reconciliation.
- **Golden queries:** saved in `scripts/validate_row_counts.sql`.
- **Insight smoke:** one Cortex call and one prediction row per OpCo in seed data (`scripts/04_seed_minimal_demo.sql`).
