# GRC Dashboard

A web application for **Governance, Risk and Compliance** across GCC and Middle East regulatory frameworks. It provides a centralised view of regulatory changes, Parent Holding and OpCo structure, UBO register management, ESG summary, multi-jurisdiction visibility, data sovereignty compliance, and AI-driven risk prediction.

---

## Key capabilities

- **Parent Holding Overview** – Select a parent holding; view OpCos with jurisdiction, governance/policy scores, and compliance status. Overdue changes count and OpCo table driven by selected parent.
- **Regulation changes (Governance Framework)** – 22 frameworks (DFSA, SAMA, CMA, Dubai 2040, Saudi 2030, SDAIA, ADGM, CBUAE, UAE AML, QFCRA, CBB, Oman, Kuwait, etc.). Filter by framework and time period (30 days / 6 months / 1 year). **Impact: Framework → Change → Parent Holding** tree under the Official rulebook ribbon; change snippets and details after the impact section. PDF download, send by email, RBAC-style filters (Parent / OpCo). Optional AI chat assistant with guardrails.
- **Ultimate Beneficial Owner (UBO)** – UBO register per Parent/OpCo: mandatory fields, document upload with optional AI extraction, % holding and status. **Holding structure** aligned with the register: graphical, collapsible OpCo details; selection card and dropdown for “OpCos with multiple UBOs”; multi-parent ownership and UBO status per parent. **Mandatory documents** tab: per-OpCo upload and “mark completed” (synced to UBO register); collapsible OpCo blocks. **Download UBO registration document** (pre-filled PDF with signature block; sign and upload via UAE Trade Registry). **View Changes** log for UBO and document updates. UAE Trade Registry section to add records and apply to UBO.
- **Data Sovereignty** – Per-OpCo regulation checks (data localisation, cross-border transfer, DPA, DPIAs, etc.) with **Critical / Medium / Low** severity. OpCos filtered by **selected Parent Holding**. Selectable severity cards and dropdown to list OpCos by compliance status.
- **Data Security Compliance (Defender integration)** – Data Security Compliance view that combines mock baseline data with **Azure Defender for Cloud** evidence. Supports CSV / Excel / PDF uploads per OpCo, file-based parsing and scoring, **Security Posture (Defender)** dashboard, LLM-generated “Failing areas and details” summaries, and **Framework‑Mapped Control Coverage** updated from Defender findings.
- **Multi Jurisdiction Matrix** – OpCos by selected parent with free zones, jurisdictions, and applicable frameworks (22 frameworks; UAE, KSA, Qatar, Bahrain, Oman, Kuwait).
- **ESG Summary** – ESG capabilities, MENA frameworks, pillar weights (E/S/G), score calculator, and entity comparison when a parent is selected.
- **Analysis (AI Risk Prediction)** – Predictive compliance risk for the **selected Parent Holding**: runs automatically when a parent is chosen from Parent Holding Overview. Optional historical compliance upload (CSV/JSON). Summary cards, risk gauge, heat map and bar chart by OpCo, upcoming deadlines, financial penalty and capital investment estimates, compliance gaps, business impact, and detailed explanation.
- **Companies & entities by framework** – “Companies & entities under [framework]” shows **only OpCos for the selected Parent Holding** for the chosen framework.

---

## Quick start

1. **Install dependencies** (from project root). `node_modules` is not tracked in git; this installs root (Playwright, tooling), `client/`, and `server/` packages.

   ```bash
   npm run install:all
   ```

2. **Start backend and frontend**:

   ```bash
   npm run dev
   ```

   - Frontend: http://localhost:5173  
   - API: http://localhost:3001  

3. **Optional**: Copy `server/.env.example` to `server/.env` and set:
   - `OPENAI_API_KEY` – for AI chat, change lookup, and UBO document extraction.
   - `LLM_BASE_URL` / `LLM_MODEL` – optional override for the LLM endpoint and model used by server‑side summaries (including Defender summaries).
   - SMTP variables – for sending regulation changes by email.

---

## Docker deployment (static IP / container)

To deploy as a single Docker container for others to access (e.g. on a static IP):

1. Copy the project to the host (or create a tarball: `npm run docker:package`).
2. Run `./deploy.sh` (creates `.env` if needed, builds, and starts the container).
3. Access at **http://\<host-ip\>:3001**.

See **[DEPLOY.md](DEPLOY.md)** for full steps and packaging details.

---

## Data

- **Changes:** `server/data/changes.json` (regulation changes with deadlines and affected companies).
- **Companies:** `server/data/companies.json` (parent–OpCo per framework); `server/data/opco-multi-shareholders.json` (OpCos with multiple shareholders ≥25%).
- **UBO:** Stored in browser `localStorage` under `ubo_register`; change log under `ubo_changes_log`.
- **Defender evidence (file-based store):**
  - `server/data/defender-uploads.json` – metadata for uploaded Defender evidence files (per OpCo).
  - `server/data/defender-snapshots.json` – parsed snapshots (Secure Score %, Compliance %, etc.).
  - `server/data/defender-findings.json` – extracted findings from recommendations / compliance reports.
  - `server/data/defender-scores.json` – computed **Security Posture Score (Defender)** per OpCo (with band and evidence).
  - `server/data/defender-summaries.json` – cached LLM “Failing areas and details” summaries per OpCo.
  - `server/data/samples/` – sample CSV/PDF evidence for **DummyFactory LLC** used in demos.

---

## Project structure

- **client/** – Vite + React frontend (dashboard, UBO, Analysis, Data Sovereignty, ESG, Multi Jurisdiction, chat).
- **server/** – Express API: `/api/changes`, `/api/companies`, `/api/frameworks`, `/api/chat`, `/api/pdf`, `/api/email`, `/api/ubo/extract`, `/api/pdf/ubo-registration`, `/api/analysis/risk-prediction`, `/api/defender/*`, etc.
- **server/data/** – `changes.json`, `companies.json`, `opco-multi-shareholders.json`, Defender file‑based stores, and demo evidence.
- **docs/** – `PRODUCT_FEATURES_AND_FUNCTIONALITY.md` (detailed product and feature description).

---

## Defender‑based Data Security Compliance

The **Data Security Compliance** module surfaces Azure Defender for Cloud evidence alongside regulatory frameworks and OpCo‑level outcomes.

### Components (frontend)

- `DataSecurityCompliance.jsx`
  - Summary tab:
    - Lists OpCos under the selected Parent Holding.
    - Unified **Compliant / Failing / Critical / High / Medium** cards driven by **Security Posture (Defender)** when evidence exists, or by mock data otherwise.
    - For failing OpCos, shows a **“Failing areas and details”** section, prioritising the LLM summary when available.
  - **Security Posture (Defender)** tab:
    - Uses `/api/defender/group-summary/:parentId` to show current SPS and band per OpCo.
    - When an OpCo is selected, calls `/api/defender/score/:opcoName` for history and evidence breakdown (framework coverage, secure score, open Critical / High, penalty).
  - **Upload Evidence** tab:
    - Renders `DefenderUpload` for the selected parent and OpCo list.
- `defender/DefenderUpload.jsx`
  - Drag‑and‑drop or file picker for **CSV, Excel, or PDF** evidence.
  - Posts to `POST /api/defender/upload` with `opcoName`, optional `parentName` and `reportDate`.
  - Polls `/api/defender/upload/:uploadId/status` until processing completes, then triggers a refresh so scores and summaries update.
- `defender/SecurityPostureDashboard.jsx`
  - Reusable dashboard for SPS (Defender): cards per OpCo, drill‑down detail panel.

### Services and routes (backend)

- `server/constants/defenderMapping.js`
  - Static configuration for mapping Defender standards to GCC regulatory frameworks (SAMA CSF, CBUAE Cyber, NESA, SDAIA, QCERT, PDPL variants).
  - Weights for SPS calculation and human‑readable score bands (**Exemplary / Compliant / Developing / Deficient / Critical**).
- `server/services/defenderStore.js`
  - Lightweight JSON “store” for uploads, snapshots, findings, scores, and summaries.
  - Helper functions to upsert scores and fetch data by OpCo.
- `server/services/defenderParserService.js`
  - Parses CSV / Excel / PDF Defender exports:
    - Defender Recommendations CSV (State, Severity, Recommendation headers, plus optional score columns).
    - Microsoft Cloud Security Benchmark compliance reports (PDF – text extracted and parsed with regex).
  - Derives:
    - **Secure Score %** and **Compliance %** from explicit columns, Current / Max score, or recommendation state / severity heuristics.
    - Structured findings (title, severity, status) from CSV rows or from PDF text lines.
  - Writes parsed snapshots and findings into the file‑based store.
- `server/services/defenderScoringService.js`
  - Computes **Security Posture Score (Defender)** per OpCo:
    - Weighted mix of framework coverage, vulnerability, alert status, and secure score.
    - Applies penalties for open Critical / High findings.
  - Persists the score (with band, colour, and evidence) into `defender-scores.json`.
- `server/services/defenderSummaryService.js`
  - Uses the configured LLM (`createChatCompletion`) to generate a concise **“Failing areas and details”** summary per OpCo from:
    - SPS value and band.
    - Evidence (framework coverage, secure score, open Critical / High).
    - Top findings (title + severity).
  - Summaries are cached in `defender-summaries.json` and surfaced via the API.
- `server/routes/defenderIntegration.js`
  - `POST /api/defender/upload` – accepts multipart **file + opcoName + parentName? + reportDate?**:
    - Streams the file into the parser.
    - Recomputes SPS for that OpCo.
    - Generates / updates the LLM failing‑areas summary.
  - `GET /api/defender/upload/:uploadId/status` – polling endpoint for the upload UI.
  - `GET /api/defender/score/:opcoName` – current SPS and history with evidence for a single OpCo.
  - `GET /api/defender/group-summary/:parentId` – group‑level summary for a Parent Holding:
    - OpCo name, SPS, band, band colour, computedAt.
    - LLM failing‑areas summary (when available).
    - **Framework coverage** per applicable framework, derived from Defender evidence and findings.
  - `GET /api/defender/findings/:opcoName` – raw findings list for an OpCo.
  - `PATCH /api/defender/findings/:id/status` – mark findings as open / resolved.
  - `GET /api/defender/uploads/:opcoName` – upload history for an OpCo.

### How evidence influences the UI

- **Security Posture (Defender) score and band**
  - Every successful upload triggers a fresh SPS computation.
  - The **Security Posture (Defender)** tab always reflects the latest score and history.
  - The Summary tab uses Defender SPS bands (when available) to drive:
    - **Compliant / Failing / Critical / High / Medium** counts.
    - The badges and severity chips on the OpCo cards.
- **Failing areas and details (Summary)**
  - When a Defender LLM summary exists for an OpCo, the Summary view shows that text directly under “Failing areas and details”.
  - If no Defender summary exists, the UI falls back to the original pillar‑based view (Security Posture, Regulatory Compliance, Data and AI Security).
- **Framework‑Mapped Control Coverage**
  - For OpCos with Defender data, the Framework‑Mapped Control Coverage table is populated from Defender evidence:
    - Coverage % (per OpCo, per applicable framework) is derived from framework coverage / SPS.
    - Gaps are synthesised from open findings.
  - For OpCos without Defender evidence, the table uses the static mock coverage data.

Together, these pieces give a **single, consistent view** of Security Posture and Data Security Compliance, with Defender evidence feeding both the dedicated Security Posture (Defender) tab and the high‑level Summary view.
