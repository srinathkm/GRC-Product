# Requirements and ADRs

## Requirement Clarification Log
- Business outcome: reduce compliance response latency and missed ownership handoffs.
- Primary users: compliance ops, risk owners, module teams, management reviewers.
- Scale target (initial): low to medium event throughput with deterministic idempotency.
- Criticality: operational workflow, not advisory-only.
- Integration baseline: existing task tracker + audit log + webhook/email channels.
- Data sensitivity: operational compliance metadata; no new sensitive class introduced.

## In-Scope Requirements
- Auto-trigger on compliance delta from both manual and system sources.
- Create or update action with idempotent dedupe using delta fingerprint.
- Route to correct team automatically using severity-first policy.
- Set SLA due date from severity default policy.
- Notify via in-app, email, and Teams/Slack.
- Update delta row to show `Action Created` and deep-link to details view.

## Out-of-Scope (Sprint)
- Full external ticket lifecycle as source-of-truth.
- New org directory/HR system integration for people lookup.
- Cross-tenant policy variants.

## ADR-001: Workflow Pattern
Status: Accepted

- Context: Current tracker supports manual task CRUD but no automatic orchestration.
- Options:
  - A) Manual only
  - B) External ticketing first
  - C) Hybrid internal orchestrator with external mirror-ready hooks
- Decision: C
- Rationale: immediate automation with low coupling and future extensibility.
- Consequences: internal state machine must remain clear and auditable.
- Review trigger: if external system becomes mandatory source-of-truth.

## ADR-002: Team Routing Policy
Status: Accepted

- Context: Deltas must reach the right team without manual triage.
- Options:
  - A) Module mapping only
  - B) Severity-first then module mapping
  - C) Manual triage queue first
- Decision: B
- Rationale: ensures urgent risk is prioritized consistently.
- Consequences: requires maintained module ownership map and fallback queue.
- Review trigger: if misrouting > agreed threshold in UAT.

## ADR-003: Notification Strategy
Status: Accepted

- Context: Need fast awareness with action traceability.
- Options:
  - A) Dashboard only
  - B) Email only
  - C) In-app + email + Teams/Slack
- Decision: C
- Rationale: balances immediate visibility and persistent audit channels.
- Consequences: retries and delivery-state tracking required.
- Review trigger: if channel reliability issues exceed tolerance.
