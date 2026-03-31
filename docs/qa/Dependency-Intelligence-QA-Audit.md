# Dependency Intelligence QA Audit (FR-6)

## Scope
- Endpoint contract checks:
  - `GET /api/dependency-intelligence/summary`
  - `GET /api/dependency-intelligence/clusters`
  - `GET /api/dependency-intelligence/:id`
- Dashboard integration checks:
  - `GET /api/dashboard/summary` includes `dependencyIntelligence` snapshot
  - Management dashboard snapshot cards and top-cluster drill-down
  - Dependency intelligence page list/filter/detail rendering

## Test Matrix

| Layer | Scenario | Expected |
|---|---|---|
| Unit | Deterministic score calculation with POA expiry | Score increases and severity escalates |
| Unit | Litigation + contract/IP linkage | Exposure and unresolved counts increment |
| Unit | Missing contract documentation | Documentation dependency created |
| Contract | Summary schema fields present | `totalClusters`, `criticalClusters`, `topClusters[]` present |
| Contract | Cluster detail trace schema | `traceVersion`, `factors`, `deterministicEvidence`, `aiEvidence` present |
| Integration | `includeAi=true` with no LLM config | Returns deterministic data with `aiStatus=unavailable|failed|low_confidence` |
| Integration | Severity filter (`critical`) | Only critical clusters returned |
| UI | Dashboard "Dependency Clusters" card | Navigates to `dependency-intelligence` view |
| UI | Detail drill-down from cluster list | Evidence and trace JSON visible |
| Resilience | Missing source JSON file | API degrades safely with fallback values |

## Security and Resilience Checks
- Input handling:
  - Query values normalized and bounded (`days` max-cap enforced).
  - String filters are compared safely without code evaluation.
- AI safety:
  - Deterministic score is never overwritten by AI.
  - AI output is additive and confidence-gated.
- Failure handling:
  - Per-endpoint `try/catch` with explicit error payload.
  - Source file failures fall back to empty arrays/objects.

## Release Gate Result
- Build validation: PASS (`vite build`)
- Syntax checks: PASS (`node --check` on modified server files)
- Lint diagnostics: PASS (no errors in edited files)

## Residual Risks
- Current graph is computed in-memory from file data; large datasets can impact latency.
- Trace JSON is visible in UI for auditability; for production this may need role-based masking.
