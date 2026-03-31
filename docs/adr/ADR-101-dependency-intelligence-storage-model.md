# ADR-101: Dependency Intelligence Storage Model

Status: Accepted

## Context
The dashboard needs deterministic, explainable dependency clusters across legal operations, compliance frameworks, data sovereignty signals, and litigation obligations. Existing storage is JSON-file based.

## Options
- A) Introduce graph database immediately
- B) Keep deterministic graph projection in service layer from existing JSON sources
- C) Hybrid relational + graph store now

## Decision
Choose **B** for Sprint 1.

## Rationale
- Fastest integration with current runtime data sources
- Supports explainable, deterministic rule trace now
- Avoids migration risk before API/UI contracts stabilize

## Consequences
- Runtime recomputation cost increases with dataset size
- Future persistence migration still required for scale

## Review Trigger
- Cluster compute exceeds 500ms p95 or data volume grows >50k dependency edges
