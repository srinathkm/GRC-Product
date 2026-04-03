# QA and Release Gate

## Functional Test Matrix
- Delta event from system source auto-creates action.
- Delta event from manual verification auto-creates action.
- Duplicate event (same fingerprint) updates existing action, no duplicate action row.
- Delta row shows `Action Created` and opens details.
- Routing follows severity-first then module mapping.
- SLA due date matches policy by severity.

## Notification Verification
- In-app notification created with valid deep link.
- Email notification sent to expected distribution and assignee.
- Teams/Slack webhook posts structured summary message.
- Channel failure does not block action creation and is logged.

## State Transition Tests
- Valid transitions succeed and are audited.
- Invalid transitions are rejected with clear message.
- Reassign flow preserves timeline and updated ownership.

## UX Acceptance Checks
- Users can identify owner team, urgency, and next action quickly.
- Action details explain why action exists without opening other screens.
- CTA labels are clear, concise, and role-appropriate.
- Filters preserve context and return users to prior list state.

## Performance and Reliability
- Burst delta ingestion remains idempotent and stable.
- Notification retries respect backoff and cap policy.
- No orphan deltas without action linkage in normal flow.

## Release Gate Criteria
- 100 percent pass on must-pass cases:
  - idempotency
  - routing correctness
  - SLA assignment
  - notification fanout
  - delta status visibility and details drill-through
- Product signoff from compliance workflow owner and UX reviewer.
