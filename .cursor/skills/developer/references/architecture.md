# Architecture Document Template

Use this template for every system architecture document produced in Phase 1.

## Table of Contents
1. High-Level Architecture
2. Technology Stack Decision Matrix
3. API Contract Specification
4. Data Architecture
5. Security Architecture
6. Scalability and Performance Architecture
7. Failure Architecture

---

## 1. High-Level Architecture

### System Context Diagram
Describe all actors and external systems that interact with this system.

### Container Diagram
Identify every major deployable unit:
- What is it? (web app, API, worker, database, cache, queue)
- What technology does it use?
- What is it responsible for?
- What does it communicate with, and how?

### Component Diagram
For each container, identify internal components:
- Business logic layers
- Data access layers
- Integration adapters
- Background processors

### Data Flow Diagram
Trace every data path:
- User input to storage
- Storage to output
- Inter-service communication
- External API data paths
- Mark every point where PII or sensitive data flows

---

## 2. Technology Stack Decision Matrix

For EACH layer, document:

| Layer | Technology | Rationale | Alternatives Rejected | Risk Assessment |
|-------|-----------|-----------|----------------------|-----------------|
| Frontend | ? | Why this choice | What else was considered and why not | Lock-in, maturity, community |
| Backend | ? | ... | ... | ... |
| Database | ? | ... | ... | ... |
| Cache | ? | ... | ... | ... |
| Message Queue | ? | ... | ... | ... |
| Authentication | ? | ... | ... | ... |
| Infrastructure | ? | ... | ... | ... |
| Monitoring | ? | ... | ... | ... |

---

## 3. API Contract Specification

For EVERY endpoint, define BEFORE implementation:

### Endpoint Template
    Method: GET|POST|PUT|PATCH|DELETE
    Path: /api/v1/resource
    Auth: Required|Public
    Rate Limit: X requests per Y seconds
    
    Request:
      Headers: [required headers]
      Body Schema: [JSON schema with types and validations]
      Example: [concrete example]
    
    Response 200:
      Schema: [JSON schema]
      Example: [concrete example]
    
    Error Responses:
      400: [validation error format]
      401: [authentication error format]
      403: [authorization error format]
      404: [not found format]
      409: [conflict format]
      429: [rate limit format]
      500: [internal error format — no stack traces]

### Error Response Standard
All errors use this format:
    {
      "error": {
        "code": "RESOURCE_NOT_FOUND",
        "message": "Human-readable message",
        "details": {},
        "requestId": "correlation-id"
      }
    }

### Versioning Strategy
- URL versioning (/api/v1/) vs header versioning
- Deprecation policy and sunset timelines
- Breaking vs non-breaking change definitions

---

## 4. Data Architecture

### Entity-Relationship Model
Define every entity, its attributes, types, constraints, and relationships.

### Data Lifecycle
For each entity:
- Creation: Who/what creates it, validation rules
- Mutation: Who can modify, what triggers changes, audit requirements
- Archival: When is data archived, retention period
- Deletion: Soft vs hard delete, cascading rules, regulatory constraints

### Indexing Strategy
Every index with justification:
- What query does this serve?
- What is the expected cardinality?
- What is the write overhead tradeoff?

### Migration Strategy
- Schema evolution approach (additive-only, blue-green, expand-contract)
- Rollback capability for each migration
- Data backfill procedures

### Backup and Recovery
- Backup frequency and method
- Point-in-time recovery capability
- Recovery testing schedule
- RTO and RPO targets

---

## 5. Security Architecture

See references/security-checklist.md for the complete checklist. This section documents the architectural decisions.

---

## 6. Scalability and Performance Architecture

### Load Profile
- Expected steady-state load
- Peak load (with timing patterns)
- Burst load (with trigger events)
- Growth projection (6mo, 1yr, 3yr)

### Scaling Strategy
For each component:
- Horizontal vs vertical scaling decision
- Auto-scaling trigger: metric, threshold, cooldown
- Maximum scale limit and cost implication

### Connection Management
- Database connection pool: min, max, timeout, idle eviction
- HTTP client pool: connections per host, total connections, keep-alive
- Redis/cache connection pool configuration

### Caching Architecture
- L1: Application-level cache (what, TTL, eviction)
- L2: Distributed cache (what, TTL, consistency model)
- CDN: Static assets, dynamic edge caching rules
- Cache invalidation strategy (event-driven, TTL, manual)

### Async Processing
- Which operations are synchronous vs asynchronous
- Queue technology and configuration
- Dead letter queue handling
- Retry and backoff configuration per operation
- Poison message detection and handling

---

## 7. Failure Architecture

### Single Points of Failure
Enumerate every SPOF and its mitigation:
| Component | SPOF? | Mitigation | Accepted Risk? |
|-----------|-------|------------|---------------|
| Database | Yes | Multi-AZ replica | No |
| Cache | Yes | Fallback to DB | Yes, with degradation |
| ... | ... | ... | ... |

### Circuit Breakers
For each external dependency:
- Failure threshold (e.g., 5 failures in 10 seconds)
- Open state duration
- Half-open probe strategy
- Fallback behaviour when open

### Retry Policies
Per operation:
- Max retries
- Backoff strategy (exponential with jitter)
- Base delay and max delay
- Which errors are retryable vs terminal

### Graceful Degradation
When component X is down:
- What still works?
- What is degraded (slower, fewer features)?
- What is unavailable?
- How is the user informed?

### Data Consistency
Per operation:
- Strong consistency required? (financial transactions, auth)
- Eventual consistency acceptable? (analytics, notifications)
- Conflict resolution strategy (last-write-wins, merge, manual)
