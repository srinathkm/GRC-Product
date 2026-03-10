## GRC Dashboard – Application Usage Guide

This guide explains **what the GRC Dashboard does** and **how to use each part of the application** as an end‑user (compliance, risk, legal, or operations).

For a deep technical and product breakdown, see `docs/PRODUCT_FEATURES_AND_FUNCTIONALITY.md`.

---

## 1. Getting started

### 1.1 Launching the app locally

From the project root:

```bash
npm run install:all   # install all dependencies
npm run dev           # start server (3001) + client (5173)
```

Then open the frontend in your browser:

- Frontend: `http://localhost:5173`
- API: `http://localhost:3001`

### 1.2 Optional configuration (AI, email, Defender summaries)

Copy `server/.env.example` to `server/.env` and set:

- `OPENAI_API_KEY` – enables:
  - AI chat in the Governance Framework Summary
  - UBO document extraction
  - M&A risk analysis narratives
- `LLM_BASE_URL`, `LLM_MODEL` – optional overrides for the LLM endpoint/model used by all server‑side summaries (including Defender “Failing areas and details”).
- SMTP variables – enable “Send by email” for regulation change PDFs.

---

## 2. Layout & navigation

The app uses a single‑page layout with a **left navigation** (or top tabs, depending on viewport) and a central content area.

Main sections:

- **Parent Holding Overview** – Starting point; select a Parent Holding and view its OpCos and high‑level compliance status.
- **Ultimate Beneficial Owner (UBO)** – Build and maintain the UBO register and mandatory document status.
- **ESG Summary** – ESG capabilities, scores, and comparisons.
- **Governance Framework Summary** – Regulation changes across GCC/MENA frameworks, with impact and AI explanation.
- **Multi Jurisdiction Matrix** – Matrix of OpCos vs. jurisdictions/frameworks for a selected parent.
- **Analysis** – AI Risk Prediction for a selected Parent Holding.
- **Data Sovereignty** – Data localisation and cross‑border compliance by OpCo.
- **Data Security Compliance** – Security posture and data security outcomes, including the **Defender integration**.

A **selected Parent Holding** is shared across views such as Parent Holding Overview, UBO, ESG, Multi Jurisdiction, Analysis, Data Sovereignty, and Data Security Compliance.

---

## 3. Parent Holding Overview

### What it shows

When you open the app, you land on **Parent Holding Overview**:

- A dropdown to select a **Parent Holding** (group).
- Summary cards:
  - Governance compliance score
  - Policy compliance score
  - Count of operating companies (OpCos)
  - Overdue regulatory changes
- An OpCo table for the selected parent:
  - OpCo name
  - Jurisdiction (derived from its primary framework)
  - Governance score, Policy score
  - Compliance status (Compliant / At Risk)

### How to use it

1. Choose a **Parent Holding** from the dropdown.
2. Review the summary metrics to see overall health.
3. Use the OpCo table to identify which entities are compliant versus at risk.
4. Click through to other sections (e.g. Governance Framework Summary, UBO, Data Sovereignty) to investigate specific issues.

---

## 4. Governance Framework Summary (Regulation Changes)

This section tracks regulatory changes across **22 frameworks** (DFSA, SAMA, CMA, Dubai 2040, Saudi 2030, SDAIA, ADGM, CBUAE, UAE AML, etc.).

### 4.1 Main elements

- Framework selector (left side)
- Period filter (last 30 days, 6 months, 1 year)
- Changes list:
  - Each change shows title, date, framework, impact summary, and status
- **Impact tree:** Framework → Change → Parent Holding (and OpCos)
- Change details panel:
  - Official rulebook link
  - Full text snippet
  - Impact and actions
- Actions:
  - **Download PDF** of selected changes
  - **Send by email** (if SMTP configured)
  - Optional **AI chat** assistant for “explain this change”, “how does this impact X?”, etc.

### 4.2 Typical usage

1. Choose a **framework** (e.g. DFSA Rulebook) and **period** (30 days).
2. Scan the **Changes** list for new or high‑impact items.
3. Click a change to see:
   - The **Impact tree** – which Parent Holdings and OpCos are affected.
   - The official rulebook reference.
   - The descriptive impact.
4. Optionally:
   - Generate a **PDF** for the change set and share with stakeholders.
   - Use the AI chat to summarise or compare changes.

---

## 5. Ultimate Beneficial Owner (UBO)

### 5.1 Register management

In the **UBO** section you can:

- Maintain a UBO register per Parent/OpCo:
  - Beneficial owner name, type (individual/corporate), % holding, residency, ID details, etc.
- See **holding structure**:
  - Visual tree of Parent → OpCo → UBOs.
  - Highlight “OpCos with multiple UBOs”.

### 5.2 Documents and workflows

- **Mandatory documents** tab:
  - For each OpCo, upload required documents (licences, IDs, trade registry docs).
  - Mark documents as **completed**; the status syncs to the register.
- **Document upload with AI extraction** (if OpenAI configured):
  - Upload documents (e.g. trade licences, UBO forms).
  - The AI extracts key fields into the register for review and confirmation.
- **Download pre‑filled UBO registration PDF**:
  - Generating an official‑style PDF with pre‑filled OpCo and owner details ready for signature and submission.

### 5.3 Using the UBO view

1. Select a **Parent Holding**.
2. Add or update **UBO entries** for each OpCo.
3. Upload and track **mandatory documents**, ensuring each OpCo is complete.
4. Generate pre‑filled registration forms for submission to the regulator or trade registry.

---

## 6. Data Sovereignty

The **Data Sovereignty** view focuses on whether data is stored and processed in line with local laws (e.g. PDPL, cross‑border rules).

### What you see

- Parent Holding context (selected parent).
- Cards for severity bands:
  - **Critical / Medium / Low** issues.
- A filtered list of OpCos:
  - Each OpCo shows key data sovereignty checks:
    - Data localisation
    - Cross‑border transfer regimes
    - DPA / DPIA requirements
    - Residency of key data sets

### How to use it

1. Select a **Parent Holding**.
2. Use the severity cards to filter by **Critical**, **Medium**, or **Low** issues.
3. For each OpCo, read the details to see where remediation is needed (e.g., cross‑border transfer documentation, data localisation gaps).

---

## 7. Multi Jurisdiction Matrix

This matrix shows how **OpCos map to jurisdictions and frameworks**.

### Features

- Parent selector at the top.
- Matrix of:
  - OpCos
  - Free zones / jurisdictions (DIFC, ADGM, onshore)
  - Applicable frameworks (DFSA, ADGM FSRA, CBUAE, SAMA, CMA, QFCRA, etc.)

### Usage

1. Select a **Parent Holding**.
2. Use the matrix to verify which frameworks apply to each OpCo.
3. Use this as a reference when planning regulatory projects (e.g. which OpCos are under SAMA vs. DFSA).

---

## 8. ESG Summary

The ESG Summary provides a one‑page view of **environmental, social, and governance capabilities**.

### Features

- ESG pillars and weights (E/S/G).
- MENA ESG frameworks (e.g. BHB ESG, Saudi ESG references).
- Score calculator:
  - Adjust pillar scores and see overall ESG readiness.
- Entity comparison:
  - Compare OpCos or groups within a selected Parent Holding.

### Usage

1. Select a **Parent Holding**.
2. Adjust ESG pillar scores or use defaults.
3. Review the ESG summary and identify entities that need ESG uplift or documentation.

---

## 9. Analysis – AI Risk Prediction

The **Analysis** section uses AI to predict compliance risk at Parent Holding level.

### Inputs

- Selected **Parent Holding**.
- Optionally: historical compliance data upload (CSV/JSON) for more accurate modelling.

### Outputs

- Risk gauge (e.g. Low / Medium / High risk).
- Heatmap and bar charts:
  - Risk by OpCo
  - Risk by framework or jurisdiction
- Narrative explanation:
  - Key risk drivers
  - Upcoming deadlines and likely hotspots
  - Suggested actions and remediation steps.

### How to use it

1. Navigate to **Analysis** and ensure a **Parent Holding** is selected.
2. Upload historical data (optional but recommended).
3. Run or refresh the analysis.
4. Use the charts and narrative to brief leadership and plan mitigation.

---

## 10. Data Security Compliance (Defender integration)

The **Data Security Compliance** section brings together:

- Azure Defender for Cloud evidence (Secure Score, recommendations, compliance reports).
- Jurisdictional frameworks (SAMA CSF, CBUAE Cyber, NESA, SDAIA, QCERT, PDPLs).
- A unified **Security Posture (Defender)** score and band per OpCo.

### 10.1 Tabs in Data Security Compliance

- **Summary**:
  - Cards for the selected Parent Holding:
    - **Compliant / Failing / Critical / High / Medium** number of OpCos.
  - OpCo list:
    - Shows **Security Posture (Defender)** score and band where evidence exists.
    - Overall status (Compliant / Failing) and severity (Critical / High / Medium).
    - **Failing areas and details:**
      - LLM‑generated summary when Defender evidence and scores are available.
      - Fallback to pillar‑based details otherwise.
  - **Framework‑Mapped Control Coverage**:
    - For each OpCo, coverage % per applicable framework (SAMA CSF, CBUAE Cyber, NESA, SDAIA, QCERT).
    - Gaps (controls / issues) and remediation deadlines:
      - When Defender evidence exists: derived from Defender findings.
      - Otherwise: mock baseline coverage data.

- **Security Posture (Defender)**:
  - Uses `/api/defender/group-summary/:parentId`:
    - SPS and band per OpCo with Defender evidence.
    - Colour‑coded by band; click an OpCo to see detail.
  - Detail panel uses `/api/defender/score/:opcoName`:
    - Current score and band.
    - Evidence breakdown:
      - Framework coverage %
      - Secure score %
      - Open Critical / High counts
      - Penalty applied in scoring
    - History of previous scores (snapshots).

- **Upload Evidence**:
  - Renders `DefenderUpload`:
    - Choose an **OpCo** under the selected Parent Holding.
    - Upload **CSV, Excel, or PDF** reports:
      - Defender Recommendations CSV exports.
      - Microsoft Cloud Security Benchmark compliance reports (PDF).
    - The backend parses, stores, and scores:
      - Secure Score / Compliance %.
      - Findings (title + severity).
      - Updates SPS and LLM summary.
    - The UI polls `/api/defender/upload/:uploadId/status` and refreshes the Defender tabs when processing is complete.

### 10.2 Typical Defender workflow

1. Go to **Data Security Compliance** and select a **Parent Holding**.
2. Switch to **Upload Evidence**:
   - Pick an OpCo (e.g. DummyFactory LLC).
   - Upload one or more Defender export files (CSV/Excel/PDF).
3. Wait for the upload status to show **completed**.
4. Switch to **Security Posture (Defender)**:
   - See updated SPS and band for each OpCo with evidence.
   - Click an OpCo to inspect history and evidence.
5. Return to **Summary**:
   - See updated **Compliant / Failing / Critical / High / Medium** counts driven by Defender.
   - For failing OpCos, read the **LLM “Failing areas and details”** summary.
   - Review the **Framework‑Mapped Control Coverage** tables updated from findings.

---

## 11. Help & supporting views

The app also includes:

- **Help** – static content explaining terminology and navigation.
- **Organisation / Entity overviews** – supplementary dashboards for grouping OpCos and drilling into their frameworks or ESG posture.

These are informational and support user onboarding but do not alter underlying data.

---

## 12. Where to go next

- For **feature‑by‑feature deep dive**, including data model and API details, read:  
  `docs/PRODUCT_FEATURES_AND_FUNCTIONALITY.md`.
- For **Defender integration implementation details** (parsing, scoring, LLM use), see:
  - `server/constants/defenderMapping.js`
  - `server/services/defenderParserService.js`
  - `server/services/defenderScoringService.js`
  - `server/services/defenderSummaryService.js`
  - `server/routes/defenderIntegration.js`
- For **deployment**, see `DEPLOY.md` and the Docker / compose files in the repo.

