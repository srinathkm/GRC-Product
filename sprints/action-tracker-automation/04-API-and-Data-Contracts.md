# API and Data Contracts

## Action Model Extensions
- `sourceType`: `manual_verification | system_delta`
- `deltaId`: string
- `deltaFingerprint`: string
- `workflowStatus`: `detected | action_created | assigned | in_progress | resolved | closed`
- `routingTeam`: string
- `severity`: `critical | high | medium | low`
- `slaDueAt`: ISO timestamp
- `notificationState`: object per channel
- `originContext`: module/framework/opco/parent/policy detail

## Delta API
- `POST /api/compliance-deltas/events`
  - Purpose: system/manual emitter for normalized delta events
  - Behavior: idempotent create-or-update action
- `GET /api/compliance-deltas`
  - Includes action linkage fields:
    - `actionId`
    - `actionStatusLabel`
    - `actionDeepLink`

## Action API
- `GET /api/actions/:id/details`
  - Returns timeline, routing, SLA, notifications, and origin context
- `PATCH /api/actions/:id/state`
  - Controlled state transitions with transition validation

## Backward Compatibility
- Keep existing `/api/tasks` contract operational.
- Introduce compatibility mapper so legacy UI remains stable during rollout.

## Notification Payload Contracts
- In-app:
  - `eventType`, `title`, `body`, `actionId`, `isRead`
- Email:
  - recipient group, severity label, action summary, deep link, SLA
- Teams/Slack:
  - concise card message with severity, owner team, status, SLA, deep link

## Error Taxonomy
- `409` duplicate transition or invalid state movement
- `422` malformed delta payload
- `503` external notification channel unavailable (non-blocking for action creation)
