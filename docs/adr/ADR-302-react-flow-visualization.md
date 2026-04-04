# ADR-302: Ownership graph visualization stack

Status: Accepted

## Context
Analysts need pan/zoom, selection, minimap, and keyboard-accessible nodes for complex cap tables.

## Options
- A) D3-only tree
- B) `@xyflow/react` + **dagre** for layered layout
- C) ELK + React Flow

## Decision
Choose **B**.

## Rationale
- React Flow provides mature interaction APIs and minimap/controls
- Dagre is lightweight versus full ELK for modest DAG sizes; layout runs client-side after API returns normalized graph

## Consequences
- Very large graphs may need clustering or server-side simplification in a later phase

## Review Trigger
Graphs regularly exceeding ~200 nodes with poor frame rates.
