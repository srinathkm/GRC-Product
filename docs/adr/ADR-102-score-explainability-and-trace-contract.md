# ADR-102: Score Explainability and Trace Contract

Status: Accepted

## Context
Leadership and auditors need evidence-backed score reasoning and deterministic replay.

## Options
- A) Return only final score per cluster
- B) Return score + trace factors + evidence sources + rules
- C) Return score + opaque AI narrative

## Decision
Choose **B** with optional additive AI metadata.

## Rationale
- Provides auditability and deterministic replay
- Enables QA contract validation at API boundary
- Keeps AI output non-authoritative

## Consequences
- API payload size increases
- Trace schema must remain backward compatible

## Review Trigger
- Any breaking change to trace fields or scoring rules
