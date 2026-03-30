# Security Checklist

Run this checklist during Phase 1.3 (design) and Phase 3.2 (audit). Every item must be addressed.

## Authentication
- [ ] Auth mechanism selected with documented rationale (OAuth2+PKCE, OIDC, mTLS, API keys)
- [ ] Token lifecycle defined: issuance, expiry, refresh, revocation
- [ ] Session fixation prevention implemented
- [ ] Brute force protection: rate limiting on auth endpoints, progressive delays, account lockout
- [ ] Password policy enforced (if applicable): min length 12, complexity, breach database check
- [ ] MFA available for elevated operations
- [ ] All endpoints require authentication except explicitly documented public ones

## Authorization
- [ ] Model defined: RBAC, ABAC, or policy-based — per resource and operation
- [ ] Principle of least privilege at every layer (API, database, infrastructure)
- [ ] No IDOR: every object access checked against requesting user context
- [ ] Admin functions not accessible via parameter manipulation or URL guessing
- [ ] Multi-tenant isolation enforced at query layer, not just UI
- [ ] Horizontal privilege escalation tested (user A accessing user B resources)
- [ ] Vertical privilege escalation tested (regular user accessing admin functions)

## Data Protection
- [ ] Encryption at rest: AES-256 minimum, key management via KMS/HSM
- [ ] Encryption in transit: TLS 1.3, certificate pinning for mobile, HSTS enabled
- [ ] Secrets management: vault-based injection, no .env in repos, no hardcoded credentials
- [ ] PII classified and mapped: what fields, which tables, which services
- [ ] PII masked in logs, error messages, and non-production environments
- [ ] Data retention policy defined and enforced programmatically
- [ ] Right to deletion (GDPR Art 17) implementable if applicable

## Input Validation
- [ ] Every input validated at boundary: type, length, format, range, business rules
- [ ] Parameterised queries only — zero string concatenation for data store interactions
- [ ] Output encoding context-appropriate: HTML, URL, JavaScript, SQL, LDAP
- [ ] File upload validation: type whitelist, size limit, content inspection, stored outside webroot
- [ ] JSON/XML parsing with depth and size limits (prevent billion laughs, zip bombs)
- [ ] Rate limiting on all mutation endpoints

## HTTP Security Headers
- [ ] Content-Security-Policy (restrict script sources)
- [ ] X-Content-Type-Options: nosniff
- [ ] X-Frame-Options: DENY (or SAMEORIGIN if framing required)
- [ ] Strict-Transport-Security with max-age >= 31536000
- [ ] Referrer-Policy: strict-origin-when-cross-origin
- [ ] Permissions-Policy (restrict camera, microphone, geolocation)
- [ ] CORS: restrictive origin whitelist, not wildcard

## Infrastructure
- [ ] Network segmentation: public, private, data tiers separated
- [ ] Containers: non-root user, read-only filesystem, resource limits (CPU, memory)
- [ ] Dependency scanning: automated, blocking pipeline on critical/high CVEs
- [ ] Base image scanning and minimal base images (distroless/alpine)
- [ ] WAF configured with OWASP Core Rule Set
- [ ] DDoS mitigation at edge (CDN/cloud provider)
- [ ] SSH keys rotated, no password auth, bastion hosts for access

## Audit and Compliance
- [ ] Every state-changing operation logged: actor, timestamp, resource, action, outcome
- [ ] Audit logs stored immutably (append-only, separate storage)
- [ ] Log retention aligned to regulatory requirements (min 1 year typical)
- [ ] Access to audit logs restricted and itself logged
- [ ] Compliance requirements mapped: SOC2, ISO27001, GDPR, HIPAA, PCI-DSS as applicable
- [ ] Data processing agreements in place for all third-party processors
