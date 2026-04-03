# Action Tracker Automation Sprint

## Objective
Design and implement a fully automated delta-to-action workflow so any compliance delta (manual verification or system-detected) triggers workflow creation, team routing, and notifications without manual intervention.

## Outcomes
- Every valid delta automatically creates or updates an Action Tracker record.
- Every action is routed by severity-first policy, then module ownership.
- Every action notifies stakeholders via in-app, email, and Teams/Slack.
- Delta rows clearly show `Action Created` and open a detailed action timeline on click.

## Decision Summary
- Workflow model: Hybrid (internal orchestration + external mirror-ready hooks).
- Routing model: Severity-first, then module mapping.
- Notification channels: In-app, email, Teams/Slack webhook.
- SLA defaults: Critical 1 day, High 2 days, Medium 5 days, Low 10 days.

## Artifacts
- [Requirements and ADRs](./action-tracker-automation/01-Requirements-and-ADR.md)
- [Workflow and Routing Design](./action-tracker-automation/02-Workflow-and-Routing-Design.md)
- [UX Blueprint](./action-tracker-automation/03-UX-Blueprint.md)
- [API and Data Contracts](./action-tracker-automation/04-API-and-Data-Contracts.md)
- [QA and Release Gate](./action-tracker-automation/05-QA-and-Release-Gate.md)

## Scope Tickets
- [AT-1: Canonical Delta Event Model and Action Schema Extension](https://github.com/srinathkm/GRC-Product/issues/46)
- [AT-2: Internal Workflow Orchestrator with Idempotent Trigger Handling](https://github.com/srinathkm/GRC-Product/issues/47)
- [AT-3: Severity-First Routing and SLA Policy Engine](https://github.com/srinathkm/GRC-Product/issues/48)
- [AT-4: Notification Fanout Adapters (In-App, Email, Teams/Slack)](https://github.com/srinathkm/GRC-Product/issues/49)
- [AT-5: UX Redesign for Delta Action Status and Detailed Drill-Through](https://github.com/srinathkm/GRC-Product/issues/50)
- [AT-6: Delta Ingestion APIs and Enriched Action Detail Endpoints](https://github.com/srinathkm/GRC-Product/issues/51)
- [AT-7: QA, UAT, Rollout, and Release Gate for Action Automation](https://github.com/srinathkm/GRC-Product/issues/52)

## Delivery Rule
No merge to main until end-to-end trigger automation, routing correctness, notification delivery, and UI traceability are verified through UAT checklist in artifact 05.
