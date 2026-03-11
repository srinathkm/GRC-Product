## GRC Dashboard – Production Readiness Report

This report summarises the current state of the GRC Dashboard against three production‑readiness phases. It is based on the existing codebase (React + Express, file‑backed data with Defender integration) and the target system design in `docs/SYSTEM_DESIGN.md`.

---

## Phase 1: Foundation

### 1. Architecture review

- **Current architecture**
  - Front end: React 18 (Vite) SPA under `client/`, with views for Parent Overview, Governance Framework Summary, UBO, ESG, Multi‑Jurisdiction, Analysis, Data Sovereignty, and Data Security Compliance (Defender).
  - Backend: Node.js 20 + Express in `server/`, exposing `/api/*` routes for companies, changes, frameworks, UBO, PDFs, analysis, and Defender (`/api/defender/*`).
  - AI layer: `server/services/llm.js` + higher‑level helpers (e.g. `services/ai.js`, `defenderSummaryService.js`) using an OpenAI‑compatible chat API via `LLM_BASE_URL` / `LLM_API_KEY`.
  - Data: JSON files in `server/data/` for changes, companies, onboarding OpCos, and Defender evidence (uploads, snapshots, findings, scores, summaries).
- **Alignment with target design**
  - Target DB schema (PostgreSQL with Organizations, OpCos, Frameworks, Regulatory_Changes, UBO, Onboarding_Submissions, Defender_* tables) is defined in `SYSTEM_DESIGN.md`.
  - Front‑end view model largely matches target entities (Parent, OpCos, frameworks, evidence).
  - Defender integration (upload → parse → score → LLM summary → UI) is implemented end‑to‑end, currently file‑backed but cleanly isolated in `server/routes/defenderIntegration.js` and `server/services/defender*`.
- **Gaps / actions**
  - Migrate JSON‑backed data (companies, changes, Defender evidence) into a relational DB.
  - Introduce a proper domain/service layer between Express routes and persistence (to reduce coupling).
  - Formalise DTOs / OpenAPI spec for `/api/*` to support external integrations and typed clients.

### 2. Code quality assessment

- **Positives**
  - Modern ES modules (`type: module`) and consistent import style.
  - Route files are reasonably cohesive (e.g. `routes/defenderIntegration.js`, `routes/companies.js`, `routes/ubo.js`).
  - LLM usage is centralised through `services/llm.js` and higher‑level helpers, avoiding provider lock‑in.
  - React components are structured by feature (e.g. `DataSecurityCompliance.jsx` + `defender/*` components).
- **Risks**
  - File‑backed stores (`readFileSync`/`writeFileSync`) lack transactional guarantees and are not safe under concurrent write load.
  - Limited formal typing (no TypeScript); type errors are only caught at runtime.
  - Some components (e.g. `DataSecurityCompliance.jsx`, `UltimateBeneficiaryOwner.jsx`, `ubo.js`) are large and would benefit from refactoring into smaller pieces or hooks.
  - Tests are not yet present as a separate suite (no Jest/Vitest or API contract tests).
- **Recommendations**
  - Add automated linting (`eslint`, `prettier`) and formatting to CI, and clean up any outstanding issues.
  - Introduce a test harness (unit tests for services, integration tests for core routes, component tests where appropriate).
  - Gradually extract shared React logic (e.g. parent/OpCo fetching, Defender summaries) into hooks or context.

### 3. Security & privacy audit

- **Current safeguards**
  - Environment variables for LLM keys and SMTP; no keys are hard‑coded in the repo.
  - Defender evidence (CSV/PDF) is processed in‑memory and stored as summarised JSON; raw files are not persisted by default.
  - `.gitignore` excludes `node_modules`, `.env`, and Defender JSON stores and samples.
- **Areas requiring hardening**
  - **Authentication & authorisation:** The app currently assumes a trusted user; there is no RBAC or per‑user auth for the web UI or API.
  - **Data classification:** PII/financial data handled via UBO and Defender findings needs clear classification and retention rules.
  - **Input validation:** File uploads and JSON payloads require stricter validation (size limits, type whitelists, content checks).
  - **Transport security:** TLS is assumed to be provided by the reverse proxy; must be enforced in production.
  - **Logging:** Ensure no sensitive content (e.g. evidence, PII) is logged from AI calls or parsing errors.
- **Actions**
  - Integrate an auth layer (e.g. OIDC / SSO) and enforce per‑route access controls.
  - Add validation middleware (e.g. zod/joi) for all request bodies and query parameters.
  - Complete a DPIA / threat model covering UBO and Defender data handling; define retention windows and anonymisation where possible.

---

## Phase 2: Production Essentials

### 4. Performance & load testing

- **Current state**
  - No formal load tests (e.g. k6, JMeter) are present in the repo.
  - Most endpoints are read‑heavy; file‑based writes (especially Defender stores) are not optimised for high concurrency.
- **Risks**
  - JSON file writes can become a bottleneck and a point of contention under concurrent upload traffic.
  - Large uploads (big CSV/PDF) may cause high memory usage; there is no explicit streaming persistence of files yet.
- **Planned actions**
  - After DB migration, design load tests for:
    - `/api/companies/*` and `/api/changes` (typical dashboard usage).
    - `/api/defender/upload`, `/api/defender/group-summary/:parentId`, `/api/defender/score/:opcoName` (evidence workflows).
  - Run load tests against a staging environment and size App Service / ECS tasks or AKS/EKS nodes accordingly.

### 5. Monitoring & observability

- **Current state**
  - Basic health endpoint: `GET /api/health`.
  - Logging: mostly console logging; no centralised structured logging or metrics export configured in code.
- **Target**
  - Structured JSON logging with correlation IDs.
  - Metrics (latency, error rate, throughput) per route and per key dependency (DB, LLM provider).
  - Traces for complex flows (evidence upload → parsing → scoring → summary generation).
- **Cloud‑specific notes**
  - On Azure: wire logs/metrics to **Application Insights**; use dependency tracking for DB and external LLM calls.
  - On AWS: send logs to **CloudWatch Logs** and metrics to **CloudWatch Metrics**; optionally integrate **X‑Ray** for traces.

### 6. Backup & disaster recovery

- **Database**
  - Target: managed PostgreSQL (Azure Database for PostgreSQL or Amazon RDS/Aurora).
  - Requirements:
    - Automated daily backups and point‑in‑time recovery.
    - Defined RPO/RTO per environment (e.g. 15‑minute RPO, 1‑hour RTO for production).
- **Object storage**
  - Defender evidence and UBO/onboarding documents should be stored in S3/Blob with:
    - Versioning enabled for key buckets/containers.
    - Lifecycle policies for archiving or deletion after retention windows.
- **Configuration & secrets**
  - Use Key Vault / Secrets Manager to store config; back up configuration state as part of infra code (IaC).

### 7. Legal & licensing compliance

- **Open‑source dependencies**
  - Node packages (client + server) use standard OSS licences (MIT, Apache‑2.0, etc.); a full SBOM and licence scan should be part of CI.
- **Data & cloud**
  - Confirm that use of LLM providers (OpenAI/Azure OpenAI) and object storage is compatible with applicable data protection regulations (PDPL, GDPR where applicable).
- **Product documentation**
  - System design, usage guide, and Defender integration behaviour are documented (`SYSTEM_DESIGN.md`, `APPLICATION_USAGE_GUIDE.md`, `README.md`).

---

## Phase 3: Launch Readiness

### 8. Testing & CI/CD

- **Testing**
  - Unit tests, integration tests, and UI tests are not yet present; these are required before production launch:
    - Services (e.g. Defender parsing/scoring, AI wrappers).
    - API contracts (e.g. `/api/companies`, `/api/defender/*`).
    - Critical React views (smoke tests and basic interactions).
- **CI/CD**
  - Recommended pipeline (GitHub Actions / Azure DevOps / CodePipeline):
    - On PR: lint, test, build client and server.
    - On main merge: build docker images (if containerised), run migrations, deploy to staging.
    - Manual or gated promotion from staging to production.

### 9. Internationalization (Arabic for UAE)

- **Current**
  - `client/src/i18n.js` provides a basis for EN/AR, but not all new copy (especially Defender integration, onboarding flows) is wired into the i18n system.
- **Requirements**
  - All user‑facing strings must be externalised and translated.
  - RTL support (CSS logical properties, layout checks) must be verified across:
    - Data Security Compliance (including Defender dashboards).
    - Governance Framework Summary and AI chat.
    - UBO, ESG, Data Sovereignty, and Analysis views.

### 10. DevOps & deployment

- **Azure path**
  - Front end on **Static Web Apps** or **Storage + Front Door/CDN**.
  - Backend on **App Service** or **AKS**, connected to **Azure Database for PostgreSQL** and **Blob Storage**.
  - Secrets via **Key Vault**; monitoring via **Application Insights**.
- **AWS path**
  - Front end on **S3 + CloudFront**.
  - Backend on **ECS Fargate** or **EKS**, connected to **RDS/Aurora PostgreSQL** and **S3**.
  - Secrets via **Secrets Manager / SSM**; monitoring via **CloudWatch** and optional **X‑Ray**.
- **Operational runbook**
  - Define SOPs for:
    - Deployments and rollbacks.
    - Incident response (alerts, escalation paths).
    - Defender evidence ingestion issues (e.g. failed parses, LLM errors).

---

### Summary

- **Phase 1 (Foundation):** Overall architecture is solid for a React + Express application with LLM integration. The main gaps are DB migration, test coverage, and security hardening.
- **Phase 2 (Production Essentials):** Requires load testing, observability wiring, DB + object storage backups, and formal OSS/licensing checks.
- **Phase 3 (Launch Readiness):** Needs full CI/CD, automated testing, complete internationalisation (including Defender views), and cloud‑specific deployment hardening on Azure or AWS.

