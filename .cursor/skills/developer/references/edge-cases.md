# Edge Case and Boundary Analysis Template

Complete this for every function, endpoint, and workflow before considering the component done.

## Input Boundaries

- Empty string, null, undefined, missing field entirely
- Maximum allowed length + 1
- Minimum valid input (single character, zero, empty array)
- Type coercion traps: string "0", string "false", empty object {}, empty array []
- Unicode: multi-byte characters, zero-width joiners, RTL markers, emoji sequences
- Timezone: UTC midnight, DST transition hours, date-only vs datetime, far-future dates
- Numeric: MAX_SAFE_INTEGER + 1, negative zero, NaN, Infinity, currency with 3+ decimals
- Injection vectors: SQL, NoSQL, LDAP, XSS, command injection, template injection
- Encoded inputs: double-encoding, null bytes, path traversal sequences

## State Boundaries

- First use: no prior data exists, no cache populated, no defaults set
- Concurrent modification: two users submit conflicting changes simultaneously
- Stale data: cached value differs from database, ETags, optimistic locking failures
- Partial failure: multi-step operation where step 3 of 5 fails — what is the state?
- Idempotency: exact same request sent twice within 1 second — is the outcome correct?
- State machine: can every action happen in every state? What about invalid transitions?
- Race conditions: two requests create the same unique resource simultaneously
- Long-running operations: what if the user navigates away, session expires, server restarts?

## External Dependency Boundaries

- Dependency returns HTTP 500
- Dependency returns HTTP 200 but with unexpected/changed payload schema
- Dependency times out (distinguish between connection timeout and read timeout)
- Dependency returns stale or incorrect data with a 200
- Dependency is DNS-unreachable
- Dependency returns very slowly (not timeout, but 10x expected latency)
- Dependency rate-limits your requests (HTTP 429)
- Dependency certificate expires or changes

## Business Logic Boundaries

- Permission edge cases: user has read but not write, user has access to parent but not child
- Workflow edges: cancellation mid-process, re-submission after rejection, approval after expiry
- Temporal: expired tokens used for one more request, scheduled job runs during maintenance, timezone-dependent business rules at day boundaries
- Multi-tenant: can any code path leak data between tenants? Include search, export, logs, error messages
- Financial: rounding errors in currency calculations, negative amounts, zero-amount transactions
- Capacity: what happens at 100% storage, queue full, connection pool exhausted?
