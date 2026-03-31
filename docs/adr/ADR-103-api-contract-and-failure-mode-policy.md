# ADR-103: Dependency API Contract and Failure Mode Policy

Status: Accepted

## Context
Dependency intelligence powers leadership dashboards and must degrade safely under partial data and AI failures.

## Options
- A) Fail hard when one source is unavailable
- B) Return partial deterministic result with explicit status
- C) Silence source failures

## Decision
Choose **B**.

## Rationale
- Leadership sees best-available deterministic view
- Avoids operational blind spots from complete endpoint failure
- Preserves trust with explicit status metadata

## Consequences
- Clients must display partial result state
- QA must test degraded modes

## Review Trigger
- Incident where degraded mode causes incorrect executive action
