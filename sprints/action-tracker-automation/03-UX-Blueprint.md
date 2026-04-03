# UX Blueprint

## UX Goals
- Make action status and ownership obvious in under 3 seconds.
- Reduce clicks to understand why an action exists and what to do next.
- Keep language human and operational, avoiding technical noise.

## Delta List Behavior
- Each delta row shows:
  - `Severity` badge
  - `Source` (System Delta / Manual Verification)
  - `Action Status` chip (`Action Created`, `Assigned`, `In Progress`, `Resolved`)
  - `Team`
  - `SLA Due`
- Clicking the `Action Status` chip opens `Action Details`.

## Action Details Drawer
- Header:
  - Action title
  - Severity, status, assignee/team, SLA due
- Sections:
  - Why this action was created (delta before/after snapshot)
  - Workflow timeline (state transitions)
  - Comments and handoff notes
  - Notification delivery status by channel

## Primary UI Actions
- `View Action Details`
- `Acknowledge`
- `Start Work`
- `Reassign`
- `Mark Resolved`

Only one primary CTA is emphasized per state; secondary controls move to overflow menu.

## UX Copy (Human-Centered)
- `Action Created` (not `Record Inserted`)
- `Needs Attention` (for high risk, non-critical)
- `Due Soon` and `Overdue` with date context
- Empty state: `No open actions for current filters.`

## Usability Rules
- Color plus text labels for accessibility; never color-only meaning.
- Keep card metadata to one line with truncation and tooltip for long text.
- Surface urgency first: severity, due date, and assignee.
- Preserve context continuity when returning from details to list.
