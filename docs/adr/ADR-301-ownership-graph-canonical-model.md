# ADR-301: Ownership graph canonical model (OwnershipGraphV1)

Status: Accepted

## Context
UBO workflows need a stable, versioned JSON shape for multi-hop ownership so the UI and extraction pipeline agree on semantics.

## Options
- A) Ad-hoc objects per screen
- B) Versioned `OwnershipGraphV1` with nodes, edges, citations, and `subjectNodeId`
- C) Persist only in a graph database

## Decision
Choose **B**.

## Rationale
- Matches existing JSON-in-API patterns; no new infrastructure for v1
- `schemaVersion` allows migration without breaking clients
- Citations and confidence stay first-class for GRC audit narrative

## Consequences
- Breaking changes require bumping `schemaVersion` and coordinated client updates

## Review Trigger
Persisted graphs need cross-tenant isolation or a move to option C.
