# Dependency Intelligence Hybrid AI Controls (FR-5)

## Objective
Apply AI enrichment without weakening deterministic, auditable compliance outcomes.

## Control Model
- Deterministic-first scoring is authoritative for severity, score, and status bands.
- AI output is additive only and cannot overwrite deterministic fields.
- AI enrichment is gated by confidence threshold (`>= 0.60`).

## Runtime Behaviour
- `includeAi=false`: deterministic-only response.
- `includeAi=true`:
  - if LLM unavailable -> `aiStatus=unavailable`
  - if response fails -> `aiStatus=failed`
  - if confidence low -> `aiStatus=low_confidence`
  - if confidence valid -> `aiStatus=enabled` with bounded insights

## Safety Constraints
- Input prompts include only cluster-level metadata (no raw PII fields).
- Insight count is capped to avoid payload bloat.
- Trace captures AI mode, status, reason, and confidence for auditability.

## Acceptance Checklist
- Deterministic scores remain unchanged when AI is toggled on.
- AI errors never break endpoint responses.
- AI status and trace are visible to clients for explainability.
