# Security Attack Vector Matrix

Use this during Phase R2.2 to systematically test every attack surface.

## Authentication Attack Vectors

### Token Manipulation
- Missing token: request with no Authorization header
- Empty token: Authorization: Bearer (empty string)
- Malformed token: Authorization: Bearer not.a.real.jwt
- Expired token: valid structure but exp claim in the past
- Future-dated token: iat claim in the future
- Wrong issuer: valid JWT signed by a different key
- Algorithm confusion: change alg from RS256 to HS256 and sign with public key
- Token reuse after logout: use a token that was revoked/blacklisted

### Session Attacks
- Session fixation: set a known session ID before authentication
- Session hijacking: reuse a session from a different IP/user-agent
- Concurrent sessions: log in from two browsers, log out of one — is the other still valid?
- Session timeout: leave a session idle for the configured timeout + 1 minute

### Credential Attacks
- Brute force: 50 rapid login attempts with wrong password — is account locked?
- Credential stuffing: known email from a breach + common passwords
- Password reset: does the reset token expire? Can it be reused? Does it invalidate previous tokens?
- Enumeration: do login and registration error messages reveal whether an email exists?

## Authorization Attack Vectors

### Horizontal Privilege Escalation
- Change resource ID in URL: /users/123/profile → /users/124/profile
- Change resource ID in request body: {"userId": 124} when authenticated as user 123
- List endpoints: does /admin/users return data for a non-admin?
- Search/filter: can a search query return resources from another tenant/user?
- Export: does a CSV/PDF export include records from other users?

### Vertical Privilege Escalation
- Role manipulation: send {"role": "admin"} in a profile update request
- Hidden endpoints: try /admin, /internal, /debug, /api/admin
- Method override: if GET works, does PUT/DELETE also work without extra auth?
- GraphQL introspection: can an unprivileged user discover admin mutations?

### Multi-Tenant Isolation
- Tenant header manipulation: change X-Tenant-ID header to another tenant
- Cross-tenant API calls: use tenant A token on tenant B endpoints
- Shared resources: does a shared table (e.g., lookup data) leak tenant-specific entries?
- Background jobs: do async jobs process data with tenant context, or globally?
- Logs and errors: do error messages from tenant A leak into tenant B responses?

## Injection Attack Vectors

### SQL Injection
- String fields: ' OR '1'='1
- Numeric fields: 1; DROP TABLE users;--
- LIKE clauses: %' OR '%'='%
- ORDER BY: inject into sort parameters: name; (SELECT 1)--
- Batch operations: inject into IN clauses

### NoSQL Injection
- MongoDB operators: {"$gt": ""}, {"$ne": null}, {"$regex": ".*"}
- JSON property pollution: {"__proto__": {"admin": true}}

### Cross-Site Scripting (XSS)
- Script tags: <script>alert(1)</script>
- Event handlers: <img onerror=alert(1) src=x>
- SVG injection: <svg onload=alert(1)>
- CSS injection: style="background:url('javascript:alert(1)')"
- Template injection: {{7*7}}, ${7*7}, #{7*7}

### Command Injection
- File names: file.txt; rm -rf /
- URL parameters: ; cat /etc/passwd
- Header values: \r\nX-Injected: true

### Path Traversal
- File uploads: ../../../etc/passwd
- API paths: /api/files/..%2F..%2F..%2Fetc%2Fpasswd
- Null byte: file.txt%00.jpg

## Data Exposure Vectors

- Verbose error responses: do 500 errors include stack traces?
- API over-fetching: do responses include internal fields (createdBy, internalNotes)?
- Sensitive headers: are server version, framework, or debug headers exposed?
- Source maps: are JavaScript source maps deployed to production?
- Backup files: do .bak, .old, .sql files exist in the web root?
- Git exposure: is /.git/HEAD accessible?
- Environment variables: is /env, /config, /.env accessible?

## Infrastructure Attack Vectors

- SSRF: submit http://169.254.169.254/latest/meta-data/ in any URL field
- Open redirects: /redirect?url=https://evil.com
- CORS: does the API respond to requests from any origin?
- Clickjacking: is X-Frame-Options set? Can the page be iframed?
- DNS rebinding: can a crafted domain resolve to internal IPs?
