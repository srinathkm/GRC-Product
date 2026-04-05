# Review report — Portfolio intelligence P1 (post-implementation)

**Reviewer role:** Independent technical + functional pass (iteration 1 and 2).  
**Scope:** `server/services/portfolioIntelligence.js`, `server/routes/portfolioIntelligence.js`, `client/src/components/PortfolioIntelligence.*`, navigation wiring.

---

## Iteration 1 — Execution plan review (pre-code)

| Gate | Result |
|------|--------|
| Scope bounded (no LLM/ML) | Pass |
| Evidence-first rule | Pass |
| API error taxonomy | Pass (`400`/`404`/`500` + JSON) |
| Test plan | Pass (unit tests on rules + fixtures) |

**Verdict:** Conditional approve — proceed.

---

## Iteration 2 — Technical review (implementation)

### Findings

| ID | Severity | Title | Resolution |
|----|----------|-------|------------|
| REV-001 | MEDIUM | Board role could not see Governance-only nav | Moved **Portfolio connections** under **Organization Overview** module so all roles with org overview (including Board) reach the screen. |
| REV-002 | LOW | Cross-holdings rows duplicate when one edge touches two matched nodes | Accepted for v1; edge-key deduplication in graph preview only. |
| REV-003 | OBSERVATION | UBO register remains client localStorage | Out of scope; cross-holdings uses server-stored ownership graphs only (aligned with sprint P1). |

### Security checklist (targeted)

- [x] No secrets in source  
- [x] Read-only intelligence endpoints  
- [x] Input: `q` length enforced server-side; litigation id from path  

### Performance

- [x] In-memory scan of graphs — acceptable for current JSON size; revisit if graph store exceeds low thousands of contexts.

---

## Iteration 3 — Functional review

| Scenario | Expected | Result |
|----------|----------|--------|
| Search “Faisal” | Rows for edges involving matched nodes | Pass (fixture data) |
| Select IP dispute litigation | Tier high/medium with IP + contracts lists | Pass |
| Unknown litigation id | 404 JSON | Pass |
| Empty search &lt; 2 chars | Message + no crash | Pass |

---

## Review scorecard

| Dimension | Result |
|-----------|--------|
| Business alignment | PASS (P1 slice of sprint vision) |
| Functional completeness | PASS for agreed scope |
| Technical architecture | PASS |
| Security posture | PASS (read-only, bounded inputs) |
| Documentation | PASS (execution plan + this report) |
| Test coverage | PASS (service tests); optional future: HTTP contract tests |

**Overall:** **CONDITIONAL APPROVE** — ship P1; track pagination and UBO server sync as backlog.

---

## Action items (next iteration)

1. **AI-[001]:** Add optional `limit` query param for cross-holdings response size (REV-002 mitigation at scale).  
2. **AI-[002]:** Document rule version changelog in product docs when rules change.  
3. **AI-[003]:** If UBO is synced server-side later, extend cross-holdings to merge UBO rows with graph edges under ADR update.

---

## Questions resolved

- **Q:** Is UI free of “AI slop”? **A:** Copy is fixed product/legal strings in i18n; no generated narrative components.  
- **Q:** Explainability? **A:** Litigation panel lists deterministic rule reasons; cross-holdings cites graph scope and edge-derived rows.
