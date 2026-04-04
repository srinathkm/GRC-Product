# ADR-303: LLM extraction for ownership structure

Status: Accepted

## Context
Documents describe ownership in tables and prose; deterministic parsers alone miss multi-hop chains.

## Options
- A) Rules-only extraction
- B) Structured JSON from LLM + **deterministic validation** and normalization
- C) Full vision-only pipeline

## Decision
Choose **B**.

## Rationale
- LLM captures multi-hop relations from text; post-processing enforces referential integrity, merges duplicates, and flags cycles
- Aligns with ADR-103: return partial or empty graph with explicit `warnings` when LLM output is malformed

## Consequences
- Requires `LLM_API_KEY` for best results; empty or heuristic fallback when LLM unavailable

## Review Trigger
Regulation requires provable-only extraction (no model inference).
