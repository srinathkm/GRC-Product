# GRC Dashboard – Enterprise System Design

**Purpose:** Development specification for building the GRC (Governance, Risk, Compliance) Dashboard as an enterprise application. This document covers database design, front-end and back-end architecture, AI integration, infrastructure, and the document-driven onboarding flow.

**Current state:** React (Vite) + Express (Node.js) app with file-based JSON data; optional OpenAI for chat, change lookup, and UBO document extraction.

**Target state:** Persistent database, LLM-agnostic AI layer, document-driven onboarding with extraction and propagation of data into governance and framework applicability.

---

## 1. Database Design

### 1.1 Overview

Replace file-based storage (`companies.json`, `changes.json`, `onboarding-opcos.json`, `opco-multi-shareholders.json`) with a relational (or document) database. The following is a relational model; it can be implemented in PostgreSQL/MySQL or adapted to a document store.

### 1.2 Core Tables and Schemas

#### Organizations (Parent Holdings)

| Column      | Type         | Constraints / Notes           |
|-------------|--------------|-------------------------------|
| id          | UUID         | PK, default gen_random_uuid() |
| name        | VARCHAR(255) | UNIQUE NOT NULL               |
| created_at  | TIMESTAMPTZ  | DEFAULT now()                 |
| updated_at  | TIMESTAMPTZ  | DEFAULT now()                 |

#### Operating Companies (OpCos)

| Column             | Type         | Constraints / Notes                    |
|--------------------|--------------|----------------------------------------|
| id                 | UUID         | PK                                     |
| name               | VARCHAR(255) | NOT NULL                               |
| parent_id          | UUID         | FK → organizations(id)                 |
| sector             | VARCHAR(128) | Optional; from onboarding/extraction   |
| business_activities| TEXT         | Optional                               |
| created_at         | TIMESTAMPTZ  | DEFAULT now()                          |
| updated_at         | TIMESTAMPTZ  | DEFAULT now()                          |

#### OpCo–Framework Assignment

Replaces the framework-keyed structure in `companies.json`. Links each OpCo to the frameworks that apply to it (by location, sector, or licensing authority).

| Column       | Type        | Constraints / Notes                          |
|--------------|-------------|----------------------------------------------|
| id           | UUID        | PK                                          |
| opco_id      | UUID        | FK → opcos(id), UNIQUE(opco_id, framework_id) |
| framework_id | UUID        | FK → frameworks(id)                         |
| source       | VARCHAR(64) | e.g. 'seed', 'onboarding', 'derived'        |
| created_at   | TIMESTAMPTZ | DEFAULT now()                                |

#### Frameworks (Reference Data)

| Column         | Type         | Constraints / Notes              |
|----------------|--------------|----------------------------------|
| id             | UUID         | PK                               |
| name           | VARCHAR(255) | UNIQUE NOT NULL (e.g. DFSA Rulebook) |
| jurisdiction   | VARCHAR(64)  | UAE, KSA, Qatar, Bahrain, Oman, Kuwait |
| description    | TEXT         | Optional                         |
| reference_url  | VARCHAR(512) | Optional                         |

#### Locations / Registrations

Where each OpCo is registered (free zone, mainland, jurisdiction). Used to derive applicable frameworks.

| Column        | Type         | Constraints / Notes        |
|---------------|--------------|----------------------------|
| id            | UUID         | PK                         |
| opco_id       | UUID         | FK → opcos(id)             |
| location_type | VARCHAR(64)  | e.g. free_zone, mainland   |
| name          | VARCHAR(255) | e.g. DIFC, ADGM, JAFZA     |
| country_code  | CHAR(2)      | ISO 2-letter               |
| created_at    | TIMESTAMPTZ  | DEFAULT now()              |

#### Licensing Authorities

Many-to-many with OpCo (which authorities license each OpCo).

| Column   | Type         | Constraints / Notes     |
|----------|--------------|--------------------------|
| id       | UUID         | PK                       |
| name     | VARCHAR(255) | UNIQUE NOT NULL (e.g. DIFC, SAMA, CMA) |

#### OpCo_Licensing_Authorities (Junction)

| Column         | Type | Constraints / Notes                |
|----------------|------|------------------------------------|
| opco_id        | UUID | FK → opcos(id)                     |
| authority_id   | UUID | FK → licensing_authorities(id)     |
| PRIMARY KEY    |      | (opco_id, authority_id)             |

#### Regulatory Changes

| Column       | Type         | Constraints / Notes    |
|--------------|--------------|------------------------|
| id           | UUID         | PK                     |
| framework_id | UUID         | FK → frameworks(id)    |
| title        | VARCHAR(512) | NOT NULL               |
| snippet      | TEXT         | Optional               |
| full_text    | TEXT         | Optional               |
| date         | DATE         | NOT NULL               |
| source_url   | VARCHAR(512) | Optional               |
| category     | VARCHAR(128) | Optional               |
| deadline     | DATE         | Optional               |
| created_at   | TIMESTAMPTZ  | DEFAULT now()          |

#### Change_Affected_OpCos (Optional)

Explicit link between changes and affected OpCos; otherwise derive from framework + OpCo–framework assignments.

| Column    | Type | Constraints / Notes           |
|-----------|------|-------------------------------|
| change_id | UUID | FK → regulatory_changes(id)   |
| opco_id   | UUID | FK → opcos(id)                |
| PRIMARY KEY |    | (change_id, opco_id)          |

#### Onboarding Submissions

Audit trail for entities added via onboarding; stores full extracted and user-edited payload.

| Column              | Type         | Constraints / Notes      |
|---------------------|--------------|--------------------------|
| id                  | UUID         | PK                       |
| parent_id           | UUID         | FK → organizations(id)   |
| opco_id             | UUID         | FK → opcos(id)           |
| organization_name   | VARCHAR(255) | As submitted             |
| business_activities | TEXT         | Optional                 |
| sector              | VARCHAR(128) | Optional                |
| framework_tag       | VARCHAR(64)  | e.g. 'Onboarded'         |
| extracted_payload   | JSONB        | Full extracted + edited  |
| added_at            | TIMESTAMPTZ  | DEFAULT now()            |

#### UBO Register

Per OpCo / parent; stores UBO details and optional document-extraction payload.

| Column                 | Type         | Constraints / Notes |
|------------------------|--------------|---------------------|
| id                     | UUID         | PK                  |
| opco_id                | UUID         | FK → opcos(id)      |
| parent_id               | UUID         | FK → organizations(id) |
| full_name              | VARCHAR(255) | Optional            |
| nationality            | VARCHAR(128) | Optional            |
| date_of_birth          | DATE         | Optional            |
| id_type, id_number     | VARCHAR(128) | Optional            |
| percentage_ownership   | DECIMAL(5,2)| Optional            |
| nature_of_control      | TEXT         | Optional            |
| document_extract_payload | JSONB      | From AI extraction  |
| created_at, updated_at | TIMESTAMPTZ |                     |

#### Multi-Shareholder OpCos

OpCos with multiple parents above a threshold (e.g. 25%).

| Column     | Type         | Constraints / Notes |
|------------|--------------|---------------------|
| id         | UUID         | PK                  |
| opco_id    | UUID         | FK → opcos(id)      |
| parent_id  | UUID         | FK → organizations(id) |
| percentage | DECIMAL(5,2) | NOT NULL            |

### 1.3 Entity Relationships (ER Summary)

- **Organization** 1 → N **OpCo** (parent_id on OpCo).
- **OpCo** N → M **Framework** via **OpCo_Framework** (applicable frameworks by registration + sector).
- **OpCo** 1 → N **Location/Registration** (where registered).
- **OpCo** N → M **Licensing_Authority** via **OpCo_Licensing_Authorities**.
- **Framework** 1 → N **Regulatory_Change**.
- **Regulatory_Change** N → M **OpCo** (optional explicit **Change_Affected_OpCos**).
- **Onboarding_Submission** links to **Organization** and **OpCo**; stores extracted_payload.
- **UBO_Register** links to **OpCo** and **Organization**.

### 1.4 Framework Applicability Logic

- **Inputs:** OpCo’s **locations/registrations** (e.g. DIFC, ADGM, JAFZA, Mainland UAE, KSA) and **sector** (e.g. Banking, Insurance, Fintech).
- **Rule table (or config):** Map (jurisdiction + free_zone/mainland + sector) → list of **framework_id**.
- **Output:** List of applicable frameworks per OpCo for Governance Framework and “Companies by framework” views. Onboarding extraction populates locations and sector so this logic runs without manual framework selection first.

---

## 2. Front-End Design

### 2.1 Technology Stack

- **Framework:** React 18+ with Vite.
- **State:** Global app state for selected Parent Holding, framework, period; consider Context or a lightweight store for cross-view sync.
- **i18n:** Centralised `i18n.js` (EN/AR); extend for all new copy.
- **API base:** Configurable (e.g. `/api` or `VITE_API_BASE`).

### 2.2 Views / Pages

| View ID             | Component                 | Purpose |
|---------------------|---------------------------|---------|
| onboarding          | Onboarding.jsx            | Document upload (UBO, branch licence, commercial registration, branch licences), business details, Add → Review → Confirm → link OpCo to Parent; read-only “Added organizations” list. |
| parent-overview     | ParentHoldingOverview.jsx | Parent dropdown, summary KPIs, OpCo table with jurisdiction and compliance status. |
| governance-framework| Dashboard.jsx + ChangesTree + ChatPanel | Framework/period filter, changes list, impact tree (Framework → Change → Parent), PDF/email, AI chat. |
| multi-jurisdiction  | MultiJurisdictionMatrix.jsx | OpCos by parent with free zones/jurisdictions and applicable frameworks. |
| ubo                 | UltimateBeneficiaryOwner.jsx | UBO register, document upload with extraction, holding structure. |
| esg                 | EsgSummary.jsx           | ESG scores, pillars, entity comparison, simulation. |
| data-sovereignty    | DataSovereignty.jsx      | Per-OpCo data sovereignty compliance (severity, sections). |
| data-security      | DataSecurityCompliance.jsx | Per-OpCo data security compliance. |
| analysis            | Analysis.jsx             | Risk prediction (historical upload), M&A simulator; parent/OpCo selectors. |

### 2.3 Shared / Reusable Components

- **MainNav** – Navigation by view ID; active state; RTL-safe.
- **FrameworkSelector** – Single/multi framework + period; “Show changes” trigger.
- **RbacSelector** – Parent Holding and OpCo dropdowns (from `/api/companies/roles` and by-parent).
- **CompaniesByFramework** – List OpCos under selected parent for selected framework (or “all”).
- **MultiSelectDropdown** – Generic multi-select (sectors, licensing authorities).
- **ChatPanel** – Message input, history, “Thinking…”, guardrail styling; calls AI API with context.

### 2.4 Onboarding Flow (Target UX)

1. **Upload documents:** UBO certificate, regional branch licence, individual commercial registration (multi), branch office licences.
2. **Details:** Business activities (text), sector of operations (multi-select), licensing authorities (multi-select).
3. **Add:** Trigger extraction (see Backend + AI); open **Review** panel with:
   - Organization name (editable),
   - Business activities, sector, licensing authorities (editable),
   - Locations/registrations (editable, derived from docs + sector),
   - **Parent:** “Add to existing Parent” (dropdown) or “New Parent” (text).
4. **Confirm:** Persist OpCo + parent + locations + sector + licensing authorities; run **framework applicability** (locations + sector → frameworks); persist OpCo–framework links; show new row in read-only “Added organizations” and refresh Parent/OpCo dropdowns.

### 2.5 Design Requirements

- **Responsive:** Usable on desktop and tablet; tables scroll horizontally where needed.
- **Accessibility:** Labels, aria attributes, keyboard navigation; sufficient contrast (EN/AR).
- **RTL:** Support Arabic with `dir="rtl"` and logical CSS (e.g. margin-inline, inset-inline).
- **Theming:** CSS variables (e.g. `--text`, `--accent`, `--border`) for future light/dark or brand themes.

---

## 3. Backend Design and Requirements

### 3.1 Stack

- **Runtime:** Node.js 20+ (LTS).
- **Framework:** Express; JSON body parser; CORS configurable by origin.
- **Storage:** Replace all `readFile`/`writeFile` of JSON with a DB client (e.g. pg, sequelize, or MongoDB driver).

### 3.2 API Contract (Current and Extended)

#### Companies

| Method | Path | Description |
|--------|------|-------------|
| GET    | /api/companies/roles | `{ parents: string[], opcos: string[] }` (merged with onboarding). |
| GET    | /api/companies/by-parent?parent=&lt;name&gt; | `{ parent, opcos: { name, framework }[] }`. |
| GET    | /api/companies?framework=&lt;name&gt; | `{ framework, parents: { parent, companies }[] }`. |
| GET    | /api/companies/parent-opco-counts | `{ parents: { parent, opcoCount }[] }`. |
| GET    | /api/companies/all-parent-opcos | `{ parentOpcos: { [parent]: string[] } }`. |
| GET    | /api/companies/multi-shareholder-opcos?parent=... | `{ opcos: ... }`. |
| POST   | /api/companies/add-opco | Body `{ parentName, organizationName }` → persist, return `{ success, parent, opco }`. |
| GET    | /api/companies/onboarding-list | `{ list: { parent, opco, framework?, addedAt? }[] }`. |

#### New / Extended for Enterprise

| Method | Path | Description |
|--------|------|-------------|
| POST   | /api/onboarding/extract | Multipart documents; call LLM-agnostic extraction; return structured payload (organization name, business activities, sector, licensing authorities, locations). No persistence. |
| GET    | /api/companies/opco/:opcoId/applicable-frameworks | Return frameworks applicable to OpCo (locations + sector). |
| POST   | /api/onboarding/confirm (or extend add-opco) | Body: organization name, parent (existing or new), business activities, sector, licensing authorities, locations; create/update Organization, OpCo, locations, licensing links, OpCo–framework assignments. |

#### Changes

| Method | Path | Description |
|--------|------|-------------|
| GET    | /api/changes?framework=&days=&lookup=1&from=&to= | Array of changes (with affectedParents when applicable). |
| GET    | /api/changes/:id | Single change. |

#### Other

| Method | Path | Description |
|--------|------|-------------|
| GET    | /api/frameworks | `{ frameworks: string[], references: { [name]: { url, description } } }`. |
| POST   | /api/chat | Body `{ message }` → `{ answer, guarded?: boolean }`. |
| POST   | /api/pdf | Body `{ days, framework?, lookup? }` → PDF binary. |
| POST   | /api/email | Body `{ to, days, framework? }` → `{ success }`. |
| POST   | /api/ubo/extract | Multipart file → extracted UBO fields (and optionally persist). |
| POST   | /api/analysis/risk-prediction | Historical file + parent. |
| POST   | /api/analysis/ma-simulator | Document upload + parent/target. |
| GET    | /api/health | `{ status: 'ok' }`. |

### 3.3 Configuration

- All secrets and env-specific config via environment variables (no hardcoded keys): `PORT`, `NODE_ENV`, `DATABASE_URL`, `SMTP_*`, `LLM_*`.
- CORS: Configurable origins (e.g. front-end origin in production).

---

## 4. AI Backend – LLM-Agnostic Design

### 4.1 Requirement

The AI layer must be **agnostic to the specific LLM provider**. The provider is selected by **base URL** and **API key** (and optionally model/deployment name).

### 4.2 Configuration (Environment)

- **LLM_BASE_URL** – e.g. `https://api.openai.com/v1` or Azure OpenAI endpoint.
- **LLM_API_KEY** – API key or token for the chosen provider.
- **LLM_MODEL** (optional) – Model/deployment name (e.g. `gpt-4o-mini`, or Azure deployment name).
- If not set: all AI features return a clear “AI not configured” message and make no external calls.

### 4.3 Abstraction Layer

- **Single AI client factory:** `getLLMClient()` reads `LLM_BASE_URL` and `LLM_API_KEY` and returns a client that supports:
  - `chatCompletion({ messages, maxTokens, systemPrompt })` → `{ content: string }`.
  - Optional: `visionCompletion({ messages, imageParts, maxTokens })` for document extraction.
- **OpenAI-compatible API:** Use an HTTP client that calls the OpenAI-shaped API (same shape used by OpenAI and many Azure/other endpoints). The abstraction hides path differences (e.g. Azure deployment URL).
- **No provider-specific imports in routes:** Routes and services call only the abstraction (e.g. `answerWithContext(message, changes)` or `extractOnboardingDocuments(files)`).

### 4.4 AI Use Cases (Routed Through Abstraction)

1. **Chat (Governance):** Context = recent regulatory changes; user message → single completion. → `answerWithContext(userMessage, changesJson)`.
2. **Change lookup:** “List key regulatory changes for framework X in last N days.” → `lookupChangesForFramework(framework, days)`.
3. **UBO extraction:** Image/PDF → structured UBO fields. → `extractUboFromDocument(buffer, mimetype)`.
4. **Onboarding document extraction:** Multiple docs → single structured payload (organization name, business activities, sector, licensing authorities, locations). → `extractOnboardingPayload(files[])`.
5. **Analysis (risk prediction / M&A):** Refactor existing prompts to use the same LLM client built from URL + key.

---

## 5. Infrastructure Requirements

### 5.1 Runtime

- **Node.js:** 20.x LTS or later for the server.
- **Process manager:** PM2, systemd, or container orchestration for the API server.

### 5.2 Database

- **Primary store:** PostgreSQL 15+ (or MySQL 8+); or document DB with adapted schema.
- **Backups:** Automated daily backups; point-in-time recovery for production.
- **Migrations:** Versioned schema migrations (e.g. Flyway, Liquibase, node-pg-migrate).

### 5.3 File Storage (Optional)

- **Document storage:** If uploads are not stored as DB BLOBs, use object storage (e.g. S3, Azure Blob) with configurable bucket and region via env.

### 5.4 Security and Networking

- **TLS:** HTTPS only in production (termination at load balancer or reverse proxy).
- **Secrets:** DB URL, LLM key, SMTP from a secret manager or env; never in code or repo.
- **CORS:** Restrict to known front-end origins in production.

### 5.5 Front-End Hosting

- **Static build:** `npm run build` in client; serve via CDN or static host (e.g. S3 + CloudFront, Azure Static Web Apps, nginx).
- **API:** Same origin or subdomain; reverse proxy routes `/api/*` to the Node server.

### 5.6 Deployment Topology (Reference)

- **Single VM / container:** Nginx reverse proxy; static files from filesystem; `/api` proxied to Node; Node connects to managed DB.
- **Containers:** Front end from nginx image or served by backend; backend Node image with env injection; Kubernetes or ECS/Fargate.
- **Serverless:** API on Lambda/Azure Functions; managed RDS; static hosting for front end.

### 5.7 Observability

- **Health:** `GET /api/health` returns 200; optionally include DB connectivity check.
- **Logging:** Structured logs (JSON); configurable log level; no secrets in logs.
- **Metrics (optional):** Prometheus-compatible metrics for the API.

---

## 6. Document Upload → Extraction → Propagation Logic

### 6.1 Flow (Onboarding)

1. **User uploads** in Onboarding: UBO certificate, regional branch licence, individual commercial registration(s), branch office licences; optionally fills business activities, sector, licensing authorities.
2. **User clicks “Add”:** Client sends documents (and manual fields) to `POST /api/onboarding/extract`.
3. **Backend extraction (LLM-agnostic):** For each document (or combined), call the AI abstraction to extract:
   - From UBO cert: organization name, subsidiary/parent hints.
   - From licences/registrations: **locations** (DIFC, ADGM, JAFZA, Mainland UAE, KSA, etc.), **sector**, **licensing authority** names.
   - Merge into one payload: `organizationName`, `businessActivities`, `sectorOfOperations[]`, `licencingAuthorities[]`, `locationsOrRegistrations[]`.
4. **Review UI:** Show payload in editable fields; user chooses Existing Parent (dropdown) or New Parent (name); clicks **Confirm**.
5. **Confirm (backend):** Create or resolve **Organization** (parent); create **OpCo** with name, parent_id, business_activities, sector; persist **locations** and **OpCo–licensing authorities**; **compute applicable frameworks** from locations + sector (and optionally licensing authorities); insert **OpCo–Framework** rows; optionally insert **Onboarding_Submission**; return success.
6. **Governance and other views:** “Companies by framework” lists OpCos with an OpCo–Framework link to that framework (filtered by selected parent). Multi Jurisdiction Matrix and Changes/Impact tree use the same data.

### 6.2 Framework Applicability Rules (Reference)

- **Location/jurisdiction → frameworks:**  
  DIFC → DFSA Rulebook, UAE AML/CFT; ADGM → ADGM FSRA, ADGM Companies, UAE AML/CFT; JAFZA → JAFZA Operating Regulations; DMCC → DMCC Company Regulations, DMCC Compliance & AML; Mainland UAE → CBUAE, UAE AML/CFT, UAE Federal Laws; KSA → SAMA, CMA, Saudi 2030, SDAIA; Qatar → QFCRA, Qatar AML Law; Bahrain → CBB, BHB Sustainability ESG; Oman → Oman CMA, Oman AML Law; Kuwait → Kuwait CMA, Kuwait AML Law.
- **Sector:** Banking/Financial → add SAMA, CBUAE, DFSA, CBB, etc. by jurisdiction; Insurance and Capital markets → add sector-specific rules per jurisdiction.
- Store rules as config (e.g. JSON/DB table) so they can be updated without code changes.

---

## 7. Summary

| Area | Summary |
|------|---------|
| **Database** | Organizations, OpCos, Frameworks, Locations, Licensing Authorities, OpCo–Framework, Regulatory Changes, Onboarding Submissions, UBO Register, Multi-Shareholder; migrations and backups. |
| **Front end** | Views (onboarding, parent-overview, governance-framework, multi-jurisdiction, ubo, esg, data-sovereignty, data-security, analysis); shared components; i18n; RTL and theming. |
| **Back end** | Express; env-based config; API contract above; new onboarding/extract and applicable-frameworks endpoints; DB client instead of JSON files. |
| **AI** | LLM-agnostic: LLM_BASE_URL, LLM_API_KEY, LLM_MODEL; single abstraction for chat, change lookup, UBO extraction, onboarding extraction, analysis. |
| **Infrastructure** | Node 20+, PostgreSQL (or managed DB), optional object storage, TLS, secrets, health, logging, optional metrics. |
| **Document flow** | Upload → extract → review → confirm → persist OpCo/parent/locations/sector → compute frameworks → persist OpCo–framework links → Governance and other views read from DB. |

This document can be used as the single source of truth for implementing the enterprise GRC Dashboard and for generating deployment (e.g. Terraform) and migration artefacts.
