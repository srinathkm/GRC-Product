# Test Case Library — Reusable Patterns

Use these test case patterns across any application. Adapt the specifics to the system under test.

## Authentication Test Cases

QA-AUTH-001: Login with valid credentials
QA-AUTH-002: Login with wrong password → error message does NOT reveal if email exists
QA-AUTH-003: Login with non-existent email → same error message as wrong password
QA-AUTH-004: Login with empty email → 400 validation error
QA-AUTH-005: Login with empty password → 400 validation error
QA-AUTH-006: Login with SQL injection in email field → 400, not 500
QA-AUTH-007: Login 20 times with wrong password → rate limited or account locked
QA-AUTH-008: Use valid token → access granted
QA-AUTH-009: Use expired token → 401
QA-AUTH-010: Use revoked token (after logout) → 401
QA-AUTH-011: Use token with tampered payload → 401
QA-AUTH-012: Use token from User A to access User B resource → 403
QA-AUTH-013: Access protected endpoint with no token → 401
QA-AUTH-014: Access protected endpoint with malformed token → 401
QA-AUTH-015: Token refresh with valid refresh token → new access token issued
QA-AUTH-016: Token refresh with expired refresh token → 401
QA-AUTH-017: Token refresh after logout → 401

## CRUD Test Cases (Per Entity)

QA-CRUD-001: Create with all required fields → 201, resource returned with ID
QA-CRUD-002: Create with missing required field → 400, field-level error
QA-CRUD-003: Create with extra unknown fields → ignored or 400 (by design)
QA-CRUD-004: Create duplicate (unique constraint) → 409
QA-CRUD-005: Read existing resource → 200, all fields correct
QA-CRUD-006: Read non-existent resource → 404
QA-CRUD-007: Read soft-deleted resource → 404 (or 410 Gone)
QA-CRUD-008: Read another user's resource → 403 (not 404, to avoid enumeration)
QA-CRUD-009: Update with valid data → 200, updated fields reflected
QA-CRUD-010: Update with invalid data → 400, original data unchanged
QA-CRUD-011: Update non-existent resource → 404
QA-CRUD-012: Update another user's resource → 403
QA-CRUD-013: Update with stale version/ETag → 409 conflict
QA-CRUD-014: Delete existing resource → 200 or 204
QA-CRUD-015: Delete non-existent resource → 404
QA-CRUD-016: Delete another user's resource → 403
QA-CRUD-017: Delete resource with active children → 409 or cascade (by design)
QA-CRUD-018: List with no records → 200, empty array (not null, not 404)
QA-CRUD-019: List with pagination → correct page size, total count, next/prev links
QA-CRUD-020: List page beyond total → 200, empty array

## Input Validation Test Cases (Per Field)

QA-VAL-001: Null value → rejected for required fields
QA-VAL-002: Empty string → rejected or accepted (by design)
QA-VAL-003: Max length exactly → accepted
QA-VAL-004: Max length + 1 → rejected
QA-VAL-005: Min length exactly → accepted
QA-VAL-006: Min length - 1 → rejected
QA-VAL-007: Special characters: !@#$%^&*()_+-=[]{}|;':\",./<>?
QA-VAL-008: Unicode: emoji (😀), CJK (中文), Arabic (عربي), Cyrillic (Кириллица)
QA-VAL-009: HTML tags: <b>bold</b> → escaped in output, not executed
QA-VAL-010: SQL injection: ' OR '1'='1'; DROP TABLE users;--
QA-VAL-011: Script injection: <script>alert(document.cookie)</script>
QA-VAL-012: Very long string: 10,000 characters → rejected or handled
QA-VAL-013: Numeric string where number expected: "abc" for age → 400
QA-VAL-014: Negative number where positive required: -1 for quantity → 400
QA-VAL-015: Zero where positive required: 0 for price → accepted or rejected (by design)
QA-VAL-016: Decimal precision: 10.999 for a 2-decimal field → rounded or rejected
QA-VAL-017: Boolean as string: "true", "false", "yes", "no", "1", "0"
QA-VAL-018: Date edge: 2026-02-29 (not a leap year) → rejected
QA-VAL-019: Date edge: 2026-12-31T23:59:59Z → accepted
QA-VAL-020: Whitespace only: "   " → rejected for required fields
QA-VAL-021: Leading/trailing whitespace: " value " → trimmed or preserved (by design)
QA-VAL-022: Null byte: "value\x00injected" → rejected

## Error Response Validation

QA-ERR-001: 400 response includes field-level error details
QA-ERR-002: 401 response does NOT include stack trace
QA-ERR-003: 403 response does NOT reveal whether resource exists
QA-ERR-004: 404 response uses consistent error format
QA-ERR-005: 500 response includes request ID but NOT stack trace
QA-ERR-006: 500 response does NOT expose database connection string
QA-ERR-007: 500 response does NOT expose file system paths
QA-ERR-008: All error responses use same JSON structure
QA-ERR-009: Error messages are human-readable (not "NullReferenceException")
QA-ERR-010: Error messages do NOT leak enum values or internal constants

## File Upload Test Cases (If Applicable)

QA-FILE-001: Upload valid file type → accepted
QA-FILE-002: Upload disallowed file type (.exe, .sh) → rejected
QA-FILE-003: Upload file with spoofed extension (.exe renamed to .jpg) → rejected
QA-FILE-004: Upload file at max size limit → accepted
QA-FILE-005: Upload file exceeding max size → 413 with clear message
QA-FILE-006: Upload zero-byte file → rejected or accepted (by design)
QA-FILE-007: Upload file with path traversal name: ../../../etc/passwd → rejected
QA-FILE-008: Upload file with special characters in name: file (copy).txt → handled
QA-FILE-009: Upload same file twice → both stored or duplicate detected (by design)
QA-FILE-010: Download uploaded file → content matches exactly
