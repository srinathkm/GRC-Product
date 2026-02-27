# GRC Dashboard – Product Features & Functionality (Deep Dive)

This document provides a complete overview of all features and functionalities in the **GRC Dashboard** product for deep-dive review. The product is a web application focused on GCC and Middle East regulatory frameworks, group company structure (Parent Holdings and OpCos), regulatory change tracking, UBO compliance, ESG, and multi-jurisdiction visibility.

---

## 1. Product Overview

- **Name:** GRC Dashboard  
- **Purpose:** Centralised view of regulatory and framework changes across GCC and Middle East; management of Parent Holdings, Operating Companies (OpCos), Ultimate Beneficial Owner (UBO) register, ESG, and multi-jurisdiction compliance.  
- **Scope:** UAE (DIFC, ADGM, CBUAE, free zones), Saudi Arabia (SAMA, CMA, Vision 2030, SDAIA), Qatar, Bahrain, Oman, Kuwait.  
- **Tech stack:** React (Vite) front end; Express (Node.js) back end; localStorage for UBO register; optional OpenAI for chat, change lookup, and UBO document extraction.

---

## 2. Navigation & Application Structure

### 2.1 Main navigation (sections)

The application has a single top-level navigation with the following sections:

| Section | Route ID | Description |
|--------|----------|-------------|
| **Parent Holding Overview** | `parent-overview` | Default landing view; list of parent holdings, selection of one parent, and OpCo table with jurisdiction and compliance. |
| **Ultimate Beneficiary Owner** | `ubo` | UBO register management: enter/update UBO details, document upload with extraction, holding structure, mandatory documents. |
| **ESG Summary** | `esg` | ESG capabilities, MENA frameworks, pillar weights, score calculator, and entity comparison. |
| **Governance Framework Summary** | `governance-framework` | Regulation changes dashboard with framework/period filters, change list, impact tree, PDF, email, and AI chat. |
| **Multi Jurisdiction Matrix** | `multi-jurisdiction` | OpCos by parent with free zones/jurisdictions and applicable frameworks. |
| **Analysis** | `analysis` | AI Risk Prediction: predictive compliance risk from current and historical data; graphs and detailed explanation. |
| **Native Arabic Support** | `arabic` | Placeholder view (not implemented). |
| **Data Sovereignty** | `data-sovereignty` | Per-OpCo regulation checks (data localisation, cross-border, DPA, DPIAs, etc.) with Critical/Medium/Low severity; OpCos filtered by selected Parent Holding; selectable severity cards and dropdown. |

### 2.2 Global app state

- **Selected Parent Holding:** Single selected parent; used by Parent Holding Overview, UBO, ESG, Multi Jurisdiction Matrix, and Governance Dashboard (RBAC/filtering).  
- **Framework list:** 22 frameworks (see Section 4). Loaded in the app and used in Governance Framework Summary.  
- **Framework references:** Fetched from `GET /api/frameworks` (URL + description per framework).  
- **Parent list:** Fetched from `GET /api/companies/roles` for dropdowns and overview.

---

## 3. Parent Holding Overview

### 3.1 Functionality

- **Parent selector:** Dropdown of all parent holdings (from `/api/companies/roles`).  
- **Summary stats (when a parent is selected):**  
  - Governance compliance score (aggregate).  
  - Policy compliance score (aggregate).  
  - Operating companies count (number of unique OpCos under the selected parent).  
- **Overdue changes:** Count of regulatory changes with past deadlines (from changes API, last 365 days).  
- **OpCo table (per selected parent):**  
  - OpCos loaded via `GET /api/companies/by-parent?parent=...`.  
  - Columns: OpCo name, Jurisdiction (derived from framework: UAE, KSA, Qatar, Bahrain, Oman, Kuwait), Governance score, Policy score, Compliance status (Compliant / At Risk).  
  - Jurisdiction mapping covers all 22 frameworks (UAE, KSA, Qatar, Bahrain, Oman, Kuwait).  
  - Compliance scores and status come from a built-in lookup (by OpCo name); defaults used when not found.

### 3.2 Data sources

- Companies: `server/data/companies.json` (by-parent and roles APIs).  
- Changes: `GET /api/changes?days=365` for overdue count.

---

## 4. Governance Framework Summary (Regulation Changes)

This is the main “regulation changes” experience, with a dashboard plus an optional AI chat sidebar.

### 4.1 Frameworks supported (22 total)

- **UAE / DIFC:** DFSA Rulebook  
- **UAE / Dubai:** Dubai 2040  
- **KSA:** SAMA, CMA, Saudi 2030, SDAIA  
- **UAE (additional):** ADGM FSRA Rulebook, ADGM Companies Regulations, CBUAE Rulebook, UAE AML/CFT, UAE Federal Laws, JAFZA Operating Regulations, DMCC Company Regulations, DMCC Compliance & AML  
- **Qatar:** QFCRA Rules, Qatar AML Law  
- **Bahrain:** CBB Rulebook, BHB Sustainability ESG  
- **Oman:** Oman CMA Regulations, Oman AML Law  
- **Kuwait:** Kuwait CMA Regulations, Kuwait AML Law  

Each framework has an official URL and short description in server constants; these are exposed via `GET /api/frameworks` and shown in the UI (e.g. “Official rulebook” link when a framework is selected).

### 4.2 Dashboard features

- **Framework selector:** Dropdown “All frameworks” or one of the 22 frameworks.  
- **Time period:** 30 days, 6 months, 1 year.  
- **“Show changes” button:** Calls `GET /api/changes?framework=...&days=...&lookup=1`.  
  - Returns changes from static data (`server/data/changes.json`) filtered by framework and date.  
  - If `lookup=1` and `OPENAI_API_KEY` is set, the server can augment results with AI-looked-up changes for the selected framework(s).  
- **RBAC / filter selectors:**  
  - **Parent Holding:** Filter impact tree and context by parent.  
  - **OpCo:** Filter to show only changes affecting the selected OpCo (OpCo-focused list in the impact tree).  
  - Options come from `GET /api/companies/roles`.  
- **Official rulebook line:** When a framework is selected, shows the framework reference URL and description.  
- **Impact: Framework → Change → Parent Holding company:** The **ChangesTree** (impact tree) is placed **directly under** the Official rulebook ribbon. It shows Framework → Change → Parent cards (with OpCo counts, deadlines, View Details, Assign Tasks) or OpCo-focused list when an OpCo is selected.  
- **Changes to the framework:** After the Impact section, the **change list** is shown: loading/error/empty state, then **snippets list** (expandable change cards with full detail, affected OpCos, official link).  
- **Companies by framework:** When a framework is selected, “Companies & entities under [framework]” shows **only OpCos for the selected Parent Holding** (from Parent Holding Overview). If no parent is selected, a message prompts the user to select one. Data from `GET /api/companies?framework=...` filtered by `selectedParentHolding`.  
- **Download as PDF:**  
  - `POST /api/pdf` with `{ days, framework?, lookup? }`.  
  - Builds a PDF (pdf-lib) of changes in the period (and optionally runs AI lookup).  
  - Returns PDF download with a filename including framework and date.  
- **Send changes by email:**  
  - Form: recipient email, then Send.  
  - `POST /api/email` with `{ to, days, framework? }`.  
  - Sends an HTML email of the same changes (nodemailer).  
  - SMTP config via env: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.  

### 4.3 Change list (snippets)

- After “Show changes”, a list of **change cards** is shown.  
- Each card: framework (with link to rulebook if available), date, category, title, snippet.  
- **Expandable:** Click to expand and show **ChangeDetail**: full text, affected OpCos under selected parent (if any), links to official rulebook and source URL.  
- **View details from tree:** When “View Details” is used from the impact tree, the corresponding snippet is expanded and detail context (parent + companies) is passed in.

### 4.4 Impact tree (ChangesTree)

- **Structure:** Framework → Change → Parent Holding.  
- **When a Parent is selected:** Under each change, “parent cards” show: Parent name, number of affected OpCos, deadline, days left, priority badge (Critical / Medium / Low by deadline), “View Details” (expand list of affected OpCos), “Assign Tasks” (placeholder).  
- **When an OpCo is selected (and no parent):** Shows a flat list of changes that affect that OpCo, with title, framework, date, deadline, days left, snippet.  
- **Data:** Uses `affectedParents` on each change (enriched by the changes API from `companies.json`).

### 4.5 AI Chat panel (sidebar)

- **Location:** Shown next to the dashboard when the view is “Governance Framework Summary”.  
- **Behaviour:** User sends a message → `POST /api/chat` with `{ message }`.  
- **Guardrails:** If the message is off-topic (guardrails service checks against allowed topics/frameworks), the server returns a fixed guardrail message and `guarded: true`; no AI call.  
- **On-topic:** Server loads last 30 days of changes from `changes.json`, passes them as context to the AI service (`answerWithContext`), and returns the model’s answer.  
- **Display:** Conversation history (user + assistant), with “Thinking…” while loading; guarded messages can be styled differently.

---

## 5. Regulatory Changes – Back End

### 5.1 GET /api/changes

- **Query:** `framework`, `days` (30 | 180 | 365), `lookup` (1 | true), optional `from`, `to`.  
- **Behaviour:**  
  - Reads `server/data/changes.json`, normalises dates for demo (shift so latest is within last year).  
  - Filters by framework (if provided and valid).  
  - Filters by last N days (and optional date range).  
  - If `lookup=1` and `OPENAI_API_KEY`: can call `lookupChangesForFramework` for the selected framework (or all frameworks if none selected) and merge new changes.  
  - Enriches each change with `affectedParents` (parent name, opcosCount, companies) using `companies.json`.  
- **Response:** Array of change objects (id, framework, title, snippet, fullText, date, sourceUrl, category, affectedCompanies, deadline, affectedParents).

### 5.2 GET /api/changes/:id

- Returns a single change by id from `changes.json`; 404 if not found.

### 5.3 AI services (optional)

- **answerWithContext(userMessage, changesJson):** Builds context from changes and calls OpenAI to answer using only that context.  
- **lookupChangesForFramework(framework, days):** Asks the model for recent regulatory changes for that framework in the given period; returns an array of change-like objects (with generated id). Used by changes API and PDF route when lookup is requested.

---

## 6. Ultimate Beneficiary Owner (UBO)

### 6.1 Purpose

Support UBO register compliance for the Middle East: enter/update UBO details (mandatory fields), upload documents with optional auto-extraction, view holding structure, and track mandatory documents.

### 6.2 Tabs

1. **UBO Register**  
2. **Holding Structure**  
3. **Mandatory Documents**  
4. **UAE Trade Registry**  

### 6.3 UBO Register tab

- **Context:** Requires a selected Parent Holding; OpCos loaded from `GET /api/companies/by-parent?parent=...`.  
- **Summary cards:** Counts of “Register updated”, “Pending”, “Not updated”, and total OpCos.  
- **Status filter:** All / Updated / Pending / Not updated.  
- **Actions:** “Mark all as updated”, “Export to CSV” (OpCo, Parent, % holding, status, last updated, notes, and selected UBO detail fields).  
- **Table:** OpCo, % holding by parent, UBO register status, last updated, actions (View details, Enter/Update UBO, **Download UBO doc**, Mark updated).  
- **View Changes:** Button opens a modal listing recent UBO and mandatory-document changes (stored in `localStorage` under `ubo_changes_log`).  
- **OpCos with multiple shareholders (≥25%):** When the selected parent has more than 10 OpCos, a subsection lists OpCos that have multiple shareholders each holding ≥25%, with a tree showing each parent holding and UBO register status (mock data in `server/data/opco-multi-shareholders.json`).  
- **Persistence:** All UBO data is in `localStorage` under key `ubo_register`. Keys are `parent::opco`; values include percentage, status, lastUpdated, notes, details (mandatory fields), documents (list with uploaded/fileName/uploadedAt).

### 6.4 Enter / Update UBO (modal)

- **Mandatory UBO fields (aligned with ME register):**  
  Full name, nationality, date of birth, place of birth; ID type, ID number, country of issuance, ID expiry; address, country of residence; percentage ownership, nature of control, date became beneficial owner.  
- **Upload document to auto-fill:**  
  - File input (PDF or images: PNG, JPG, GIF, WebP), max 10 MB.  
  - On upload, `POST /api/ubo/extract` (multipart, field `file`).  
  - Server: if image and `OPENAI_API_KEY` set, uses vision API to extract text and returns structured UBO fields; otherwise returns default empty fields and a message.  
  - Client merges extracted fields into the form.  
- **Holding & status:** % holding by parent, UBO register status, last updated date.  
- **Mandatory documents (checklist):** List of six document types with “Uploaded” checkbox and optional filename; stored in the same UBO record.  
- **Notes:** Free text.  
- **Save:** Updates the `parent::opco` record in `ubo_register` (localStorage).

### 6.5 Mandatory documents (definition and tab)

- Passport or National ID (copy), Proof of address, Ownership structure document, Board resolution / authorization, Register of Beneficiaries, UBO declaration form, Company extract / trade license.  
- **Mandatory Documents tab:** Per-OpCo blocks in **collapsible** format. Each OpCo has a header (name, “X / 7 completed” badge); expand to see document rows with **Upload** (file) and **Mark completed** (checkbox). Changes sync to the UBO register and are recorded in **View Changes**.  
- The Enter/Update UBO modal uses the same list for the per-OpCo checklist.

### 6.6 Holding Structure tab

- **Data:** Aligned with the UBO register: parent as root (100%), then each OpCo with % and UBO status. OpCos with **multiple UBOs** (multiple parents holding ≥25%) show all parent holdings with % and status (from `opco-multi-shareholders.json` and UBO register).  
- **Display:** **Graphical visualization**: root node, then selectable OpCo nodes. Each OpCo is **collapsible**; expand to see parent-holding details (name, %, status). Clicking an OpCo highlights it and its parent(s).  
- **Selection card and dropdown:** Two cards – “All OpCos” (count) and “OpCos with multiple UBOs” (count). Selecting a card updates the **Show** dropdown (“All OpCos” / “OpCos with multiple UBOs only”); the list filters accordingly.  
- **Purpose:** Show holding structure matching the register, including multi-UBO cases, with selectable/collapsible detail.

### 6.7 Download UBO registration document

- **Action:** “Download UBO doc” (from register table or View details modal).  
- **API:** `POST /api/pdf/ubo-registration` with `{ parent, opco, details }`.  
- **Output:** PDF with pre-filled UBO fields and a signature block; user signs and can upload via the UAE Trade Registry section.

### 6.8 UAE Trade Registry tab

- Links to UAE Trade Registry (traderegistry.ae). Per module (e.g. Ownership Structure Chart, Register of Beneficiaries, UBO Declaration): Look up, Download, **Add record** (OpCo, summary, file name, “Apply to UBO”). Records can be applied to the UBO register and mandatory documents for the chosen OpCo.

### 6.9 Modals and View Changes

- **View details / Enter/Update UBO / Add record (Registry):** Each modal has a **close (×)** button in the top-right.  
- **View Changes:** Modal listing recent changes (UBO details updated, document marked completed/uploaded) with timestamp, message, and OpCo; data from `ubo_changes_log` in localStorage.

### 6.10 API: POST /api/ubo/extract

- **Input:** Multipart form with `file` (PDF or image).  
- **Validation:** Allowed types PDF, PNG, JPG, GIF, WebP; max 10 MB (multer memory storage).  
- **Processing:** If file is image and `OPENAI_API_KEY` is set, calls OpenAI vision to extract UBO fields; returns `{ extracted: { ...fields }, fromDocument, message }`.  
- **Response:** Always returns an `extracted` object (defaults for missing/unsupported); `fromDocument` indicates whether extraction ran; `message` for user feedback.

---

## 7. Multi Jurisdiction Matrix

### 7.1 Functionality

- **Context:** Selected Parent Holding; OpCos from `GET /api/companies/by-parent`. Only OpCos whose framework is in the matrix’s framework set (all 22) are shown.  
- **Per OpCo:**  
  - Locations of operations (from framework meta).  
  - **Free zones & jurisdictions:** For each zone where the OpCo operates, zone name, type, location, description, and list of applicable regulations (name, category, scope).  
  - **Applicable frameworks table:** Rows: zone/jurisdiction, location, category, framework/regulation name, scope/description.  
- **Reference block:** List of all free zones and jurisdictions (DIFC, ADGM, JAFZA, DMCC, Dubai/AD/Sharjah/RAK mainland, KSA onshore, KSA giga, Qatar, Bahrain, Oman, Kuwait) with descriptions and applicable regulations.  
- **Legend:** Categories (Financial, Governance, AML, Other) explained.

### 7.2 Data model

- **FREE_ZONES_AND_JURISDICTIONS:** Static list of zones with id, name, location, type, description, regulations[].  
- **FRAMEWORK_META:** For each of the 22 frameworks: zoneId, location, locationShort, categories[], name, description.  
- **FRAMEWORK_TO_ZONE_ID:** Maps framework key to zone id.  
- OpCos are mapped to zones via their framework; each OpCo can appear in multiple frameworks (multiple rows).

---

## 8. Analysis (AI Risk Prediction)

### 8.1 Purpose

The **Analysis** section provides **AI Risk Prediction**: a predictive risk analysis model that uses current OpCo and regulatory data, plus optional uploaded historical compliance data, to estimate whether compliance will be met in time. Results are shown in graph/visual form and as a detailed written explanation.

### 8.2 Functionality

- **Parent Holding selector:** Choose the parent holding to analyse; list comes from Parent Holding Overview (same global selection).  
- **Auto-run when parent selected from Parent Overview:** When the user selects a parent in **Parent Holding Overview** and opens the **Analysis** view, **Run risk prediction** runs automatically for that parent so that summary, gauge, heat map, tables, deadlines, financial penalties, capital investment, compliance gaps, business impact, and explanation are generated without clicking the button.  
- **Historical data upload (optional):**  
  - **CSV:** Headers such as `opco`, `year`, `deadlineMet` (values e.g. yes/no, 1/0). Each row = one past compliance outcome.  
  - **JSON:** `{ "records": [ { "opco", "year", "deadlineMet" } ] }`.  
  - Uploaded records are used to compute a historical on-time rate per OpCo, which is factored into the risk score.
- **Run risk prediction:** Triggers `POST /api/analysis/risk-prediction` with the selected parent and optional file. The server combines:
  - **Current system data:** `companies.json` (parent–OpCo), `changes.json` (changes, deadlines, affected companies).
  - **Historical data:** Parsed from the uploaded file, if provided.
- **Results – visual / graph:**
  - **Summary cards:** Overall risk level (Low/Medium/High), probability of meeting compliance in time (%), OpCos at risk count, and (if used) number of historical records.
  - **Compliance risk gauge:** Horizontal bar (0–100) for overall risk score with colour (green/amber/red).
  - **Risk by OpCo (bar chart):** One bar per OpCo showing risk score (0–100), with colour by level.
- **Results – table:**  
  **Risk by entity:** OpCo, risk level, risk score, predicted on time (yes/no), deadline count, main factor, and (if available) historical on-time %.
- **Upcoming deadlines (at risk):** List of nearest deadlines tied to the analysed OpCos, with risk level, for prioritisation.
- **Detailed explanation:**  
  - If `OPENAI_API_KEY` is set, the server can generate a 2–4 paragraph narrative from the summary and by-OpCo data.  
  - Otherwise a template explanation is returned, referencing overall risk, probability, at-risk OpCos, and recommendation to prioritise high-risk entities and overdue items.

### 8.3 Risk model (server)

- For each OpCo, the server collects all regulatory change deadlines that affect it (from `changes.json` and `companies.json`).
- **Risk score (0–100)** is derived from: overdue count, deadlines in next 30 days (critical), 30–90 days (medium), and (if provided) historical on-time rate. Higher score = higher risk.
- **Predicted on time:** Yes if risk score &lt; 50 and no overdue deadlines.
- **Overall risk level:** From average of OpCo risk scores (Low / Medium / High).
- **Probability of meeting compliance in time:** `100 − overallRiskScore` (approximate).

### 8.4 API

- **POST /api/analysis/risk-prediction**  
  - **Body:** `multipart/form-data`: `parent` (required), `historical` (optional file: CSV or JSON).  
  - **Response:**  
    `summary` (overallRiskLevel, overallRiskScore, probabilityMeetOnTime, totalOpcos, atRiskOpcos, historicalRecordsUsed),  
    `byOpCo` (opco, riskScore, riskLevel, predictedOnTime, factor, deadlineCount, historicalOnTimeRate),  
    `chartData` (labels, riskScores, colors),  
    `explanation` (string),  
    `upcomingDeadlines` (array of { opco, title, framework, deadline, riskLevel }).

---

## 9. ESG Summary

### 9.1 Functionality

- **Operational capabilities:** Eight capability blocks (data collection, metrics definition, reporting & disclosure, assurance & audit, governance structure, stakeholder engagement, scenario & climate analysis, systems & integration) with titles and descriptions.  
- **MENA ESG frameworks table:** List of frameworks (e.g. GRI, SASB, TCFD, UN SDGs, CDP, CBUAE, UAE Sustainable Finance, Tadawul, CMA, DFM/ADX, Bahrain BHB) with region and focus.  
- **ESG score calculator:**  
  - Pillar scores E/S/G (0–100) and weights (E/S/G).  
  - Weight presets: Equal, Financials (materiality), Energy/Industrials, Custom.  
  - Overall score = weighted average; validation that weights sum to 100.  
- **Entity comparison (when parent selected):** Bar chart comparing Environmental, Social, Governance scores across “entities” (derived from OpCos or placeholders); supports multiple entities and weight presets.  
- **Key issue / question assessment:** Short description of scoring at question level using frameworks (data availability, quality, relevance, performance).  
- **ESG frameworks for MENA:** Section title and table of MENA frameworks (same list as above).

### 9.2 Data

- No dedicated ESG API; entities and scores are derived in the client (e.g. from selected parent and OpCos or mock data).

---

## 10. Companies & Roles APIs

### 10.1 GET /api/companies/roles

- **Response:** `{ parents: string[], opcos: string[] }`.  
- **Logic:** Reads `companies.json`; parents = unique parent names; opcos = unique company names that are not parents.  
- **Use:** Parent dropdown (Overview, RBAC), OpCo dropdown (RBAC), and initial parent list in the app.

### 10.2 GET /api/companies/by-parent?parent=...

- **Response:** `{ parent, opcos: { name, framework }[] }`.  
- **Logic:** For the given parent, collects all (name, framework) pairs from every framework key in `companies.json`.  
- **Use:** Parent Holding Overview OpCo list, UBO OpCo list, Multi Jurisdiction Matrix OpCo list.

### 10.3 GET /api/companies?framework=...

- **Response:** `{ framework, parents: { parent, companies: string[] }[] }`.  
- **Logic:** Returns the array of { parent, companies } for that framework from `companies.json`.  
- **Use:** “Companies & entities under [framework]” in the Governance Dashboard; client filters to the **selected Parent Holding** so only that parent’s OpCos are shown.

### 10.4 GET /api/companies/parent-opco-counts

- **Response:** `{ parents: { parent, opcoCount }[] }`.  
- **Logic:** For each parent, counts unique OpCos across all frameworks in `companies.json`.  
- **Use:** UBO section to show “OpCos with multiple UBOs” only when parent has >10 OpCos.

### 10.5 GET /api/companies/multi-shareholder-opcos?parent=...

- **Response:** `{ opcos: { opco, shareholders: { parent, percentage }[] }[] }`.  
- **Logic:** Reads `server/data/opco-multi-shareholders.json`; returns entries with 2+ shareholders each ≥25%; optional `parent` filter.  
- **Use:** UBO Holding Structure and register subsection for multi-UBO OpCos.

---

## 11. Frameworks API

### GET /api/frameworks

- **Response:** `{ frameworks: string[], references: Record<string, { url, description }> }`.  
- **Source:** Server constants (FRAMEWORKS, FRAMEWORK_REFERENCES).  
- **Use:** Framework references in the UI; framework list can be used by the client (currently the client also has a copy of the list).

---

## 12. Data Sovereignty (implemented)

- **Context:** OpCos are loaded for the **selected Parent Holding** only (`GET /api/companies/by-parent?parent=...`). If no parent is selected, a message asks the user to select one in Parent Holding Overview.  
- **Regulation checks:** A fixed set of checks (e.g. UAE PDPL data localisation, KSA PDPL, CBUAE/SAMA financial data, cross-border transfer, DPA registration, DPIAs, breach notification, processor agreements, sovereign cloud, ADGM/DFSA/free zone rules) with **met** / **not met** and, when not met, **severity: Critical / Medium / Low**.  
- **Summary cards:** Four selectable cards showing counts for Critical, Medium, Low, and Met. Clicking a card sets the **Show** dropdown to that criterion and lists OpCos that match.  
- **Dropdown:** “Show” filter: All checks / Critical only / Medium only / Low only / Met only.  
- **List:** For non-met checks, each OpCo is shown with its non-compliant items (check name, regulation, description, severity). For “Met only”, OpCos with all checks met are listed.  
- **Data:** Mock per-OpCo compliance in the client (OPCO_COMPLIANCE_MOCK); parent list excluded from the OpCo list so only OpCos are shown.

## 13. Placeholder Views

- **Native Arabic Support:** Placeholder text only. No implementation beyond the placeholder component.

---

## 14. PDF APIs

- **POST /api/pdf** – Regulation changes report (existing).  
- **POST /api/pdf/ubo-registration** – UBO registration document: body `{ parent, opco, details }`; returns PDF with pre-filled UBO fields and signature block for signing and upload via UAE Trade Registry.

---

## 15. Configuration & Environment

### 15.1 Server (.env)

- **PORT:** Server port (default 3001).  
- **OPENAI_API_KEY:** Enables AI chat answers, change lookup (e.g. “Show changes” with lookup), and UBO document extraction (images).  
- **SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM:** Email sending for “Send changes by email”.

### 15.2 Client

- Uses relative `/api` for all requests (assumed same origin or proxy to server).

### 15.3 Data files (server)

- **server/data/companies.json:** Structure `{ [framework]: [ { parent, companies: string[] } ] }`. Defines parent–OpCo relationships per framework.  
- **server/data/changes.json:** Array of change objects (id, framework, title, snippet, fullText, date, sourceUrl, category, affectedCompanies?, deadline?). Enriched at runtime with `affectedParents` by the changes API.  
- **server/data/opco-multi-shareholders.json:** Array of `{ opco, shareholders: { parent, percentage }[] }` for OpCos with 2+ shareholders each ≥25% (e.g. Etihad Airways, AD Ports Group, Aramex, Saudi Aramco, Saudi Electricity).

---

## 16. Security & Guardrails

- **Chat:** Guardrails service checks user message against allowed topics (frameworks, regulation, compliance, etc.); off-topic returns a fixed message and no AI call.  
- **UBO extract:** File type and size limited (PDF/images, 10 MB).  
- **CORS:** Server uses `cors({ origin: true })`.  
- **No authentication:** No login or user roles in the current codebase; RBAC selectors are for filtering only.

---

## 17. Summary Table of Features

| Area | Feature | Status |
|------|---------|--------|
| Navigation | Parent Holding Overview, UBO, ESG, Governance Framework, Multi Jurisdiction, placeholders | Implemented |
| Parent / OpCo | Parent selector, OpCo list by parent, roles API, jurisdiction mapping | Implemented |
| Regulation changes | 22 frameworks, filter by framework & period, static + optional AI lookup | Implemented |
| Changes UI | Snippets, expand to detail, official link, affected OpCos | Implemented |
| Impact tree | Framework → Change → Parent cards, deadlines, OpCo filter | Implemented |
| PDF | Download changes report (pdf-lib), optional lookup | Implemented |
| Email | Send changes report (nodemailer) | Implemented |
| Chat | AI assistant with guardrails, context from last 30 days changes | Implemented |
| UBO | Register table, enter/update modal, mandatory fields, document upload + extract | Implemented |
| UBO | Holding structure: graphical, collapsible; multi-UBO; card + dropdown filter | Implemented |
| UBO | Mandatory documents: per-OpCo upload & mark completed; collapsible OpCos; View Changes | Implemented |
| UBO | Download UBO registration document (PDF with signature block) | Implemented |
| UBO | UAE Trade Registry tab; Add record and apply to UBO | Implemented |
| UBO | View Changes modal; modals have close (×) top-right | Implemented |
| Data Sovereignty | Per-OpCo regulation checks; Critical/Medium/Low; selectable cards; parent filter | Implemented |
| Multi Jurisdiction | OpCos by parent, zones, regulations, framework meta for 22 frameworks | Implemented |
| ESG | Capabilities, MENA frameworks, score calculator, entity comparison | Implemented |
| Analysis | AI Risk Prediction: auto-run when parent selected from Overview; gauge, heat map, table, explanation | Implemented |
| Companies | by-parent, roles, by framework, parent-opco-counts, multi-shareholder-opcos | Implemented |
| Governance | Impact tree under Official rulebook; changes list after Impact; Companies by framework filtered by parent | Implemented |
| APIs | /api/health, /api/frameworks, /api/changes, /api/companies, /api/chat, /api/pdf, /api/pdf/ubo-registration, /api/email, /api/ubo/extract, /api/analysis/risk-prediction | Implemented |

---

## 18. Document Control

- **Version:** 1.0  
- **Last updated:** February 2025  
- **Scope:** GRC Dashboard codebase as of the date above; intended for deep-dive product and feature review.
