# ADR-104: AI Merge Policy with Deterministic Precedence

Status: Accepted

## Context
The platform uses LLM enrichment but must keep deterministic legal/compliance evidence authoritative.

## Options
- A) Allow AI to overwrite deterministic severity and score
- B) Keep deterministic precedence; AI additive only with confidence threshold
- C) Disable AI fully

## Decision
Choose **B**.

## Rationale
- Maintains auditability and regulator trust
- Enables insights where deterministic evidence is incomplete
- Supports explicit AI unavailable mode

## Consequences
- AI outputs can be present but ignored by threshold gates
- Additional trace metadata required for confidence and status

## Review Trigger
- AI false-positive incident or confidence policy update
