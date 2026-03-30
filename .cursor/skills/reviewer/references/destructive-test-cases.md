# Destructive Test Case Framework

Use this during Phase R3 to generate test cases designed to break the application.

## Category: Input Validation Destruction

DTC-INP-001: Maximum field length + 1 character in every text input
DTC-INP-002: Null byte injection in string fields (\x00)
DTC-INP-003: 10MB payload in a request body that expects 1KB
DTC-INP-004: Negative numbers where only positive are valid
DTC-INP-005: Date field set to 9999-12-31 (far future)
DTC-INP-006: Date field set to 0000-01-01 (far past)
DTC-INP-007: Email field with 500-character local part
DTC-INP-008: JSON request with 100 levels of nesting
DTC-INP-009: File upload with .exe renamed to .jpg (content-type mismatch)
DTC-INP-010: Request with duplicate keys in JSON body
DTC-INP-011: Unicode normalization attack (visually identical but different bytes)
DTC-INP-012: Right-to-left override character in display fields

## Category: State Machine Destruction

DTC-STM-001: Complete a workflow, then repeat step 3 — does it create duplicates?
DTC-STM-002: Start workflow A, abandon at step 2, start workflow B — leaked state?
DTC-STM-003: Submit final step of a workflow without completing prior steps
DTC-STM-004: Trigger a state transition that should be impossible (e.g., cancelled to approved)
DTC-STM-005: Delete a parent entity while a child workflow is in progress
DTC-STM-006: Archive an entity, then reference it from a new entity

## Category: Concurrency Destruction

DTC-CON-001: Double-submit a payment form within 100ms
DTC-CON-002: Two users approve the same pending item simultaneously
DTC-CON-003: User edits a record while a background job is also modifying it
DTC-CON-004: Create the same unique resource (e.g., username) from two sessions
DTC-CON-005: Process the same queue message twice (simulate at-least-once delivery)
DTC-CON-006: Bulk import 10,000 records while another user queries the same table

## Category: Performance Destruction

DTC-PRF-001: Request a list endpoint with no pagination and 1M records in the table
DTC-PRF-002: N+1 query detection: request 100 parent records with eager-loaded children
DTC-PRF-003: Hit the same endpoint 1000 times in 10 seconds from a single client
DTC-PRF-004: Request a complex aggregation report while the system is under normal load
DTC-PRF-005: Upload maximum file size and immediately request it back
DTC-PRF-006: Open 100 WebSocket connections simultaneously (if applicable)
DTC-PRF-007: Query with a wildcard search (%%) on an unindexed column
DTC-PRF-008: Cache stampede: invalidate a popular cache key and hit the endpoint 500 times

## Category: Data Integrity Destruction

DTC-DAT-001: Delete a record referenced as a foreign key in another table
DTC-DAT-002: Insert a record that violates a unique constraint — is the error graceful?
DTC-DAT-003: Update a record with a stale version/ETag — is it detected?
DTC-DAT-004: Partial transaction failure: step 3 of 5 fails — what state is the data in?
DTC-DAT-005: Change a parent record's status and verify cascade effects on children
DTC-DAT-006: Decimal precision: store 0.1 + 0.2 and verify it equals 0.3 (not 0.30000000000000004)
DTC-DAT-007: Timezone handling: create a record at 23:59 UTC, query it by date in UTC+5

## Category: Failure Recovery Destruction

DTC-FLR-001: Kill the database connection mid-transaction — is the connection pool corrupted?
DTC-FLR-002: Return 503 from an external API and verify the circuit breaker opens
DTC-FLR-003: Make the cache unavailable and verify the system falls back to the database
DTC-FLR-004: Simulate a deployment during active requests — are responses lost?
DTC-FLR-005: Fill disk to 100% and verify the system logs a meaningful error (not crash)
DTC-FLR-006: Set system clock forward 1 hour — do token expirations and scheduled jobs break?

## Category: Multi-Tenant Destruction (if applicable)

DTC-TNT-001: Authenticate as tenant A, query with tenant B's resource ID
DTC-TNT-002: Search/filter results — verify zero results from other tenants
DTC-TNT-003: Export functionality — verify export contains only the requesting tenant's data
DTC-TNT-004: Shared lookup tables — verify tenant-specific entries are isolated
DTC-TNT-005: Error messages — verify errors from tenant A processing never appear to tenant B

## How to Write New Destructive Test Cases

Every DTC answers one question: "What is the worst thing that can happen if this edge case is not handled?"

Template:
    ID: DTC-[CAT]-[NNN]
    Title: [What you are trying to break]
    Setup: [System state required before the test]
    Action: [Exact steps to execute, reproducible by anyone]
    Expected: [What should happen if the system is robust]
    Broken: [What you will observe if the system fails]
    Impact: [Business consequence: data loss, security breach, financial error, etc.]
    Severity: [Critical | High | Medium | Low]
