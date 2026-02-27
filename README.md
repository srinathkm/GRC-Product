# GRC Dashboard

A web application for **Governance, Risk and Compliance** across GCC and Middle East regulatory frameworks. It provides a centralised view of regulatory changes, Parent Holding and OpCo structure, UBO register management, ESG summary, multi-jurisdiction visibility, data sovereignty compliance, and AI-driven risk prediction.

---

## Key capabilities

- **Parent Holding Overview** – Select a parent holding; view OpCos with jurisdiction, governance/policy scores, and compliance status. Overdue changes count and OpCo table driven by selected parent.
- **Regulation changes (Governance Framework)** – 22 frameworks (DFSA, SAMA, CMA, Dubai 2040, Saudi 2030, SDAIA, ADGM, CBUAE, UAE AML, QFCRA, CBB, Oman, Kuwait, etc.). Filter by framework and time period (30 days / 6 months / 1 year). **Impact: Framework → Change → Parent Holding** tree under the Official rulebook ribbon; change snippets and details after the impact section. PDF download, send by email, RBAC-style filters (Parent / OpCo). Optional AI chat assistant with guardrails.
- **Ultimate Beneficial Owner (UBO)** – UBO register per Parent/OpCo: mandatory fields, document upload with optional AI extraction, % holding and status. **Holding structure** aligned with the register: graphical, collapsible OpCo details; selection card and dropdown for “OpCos with multiple UBOs”; multi-parent ownership and UBO status per parent. **Mandatory documents** tab: per-OpCo upload and “mark completed” (synced to UBO register); collapsible OpCo blocks. **Download UBO registration document** (pre-filled PDF with signature block; sign and upload via UAE Trade Registry). **View Changes** log for UBO and document updates. UAE Trade Registry section to add records and apply to UBO.
- **Data Sovereignty** – Per-OpCo regulation checks (data localisation, cross-border transfer, DPA, DPIAs, etc.) with **Critical / Medium / Low** severity. OpCos filtered by **selected Parent Holding**. Selectable severity cards and dropdown to list OpCos by compliance status.
- **Multi Jurisdiction Matrix** – OpCos by selected parent with free zones, jurisdictions, and applicable frameworks (22 frameworks; UAE, KSA, Qatar, Bahrain, Oman, Kuwait).
- **ESG Summary** – ESG capabilities, MENA frameworks, pillar weights (E/S/G), score calculator, and entity comparison when a parent is selected.
- **Analysis (AI Risk Prediction)** – Predictive compliance risk for the **selected Parent Holding**: runs automatically when a parent is chosen from Parent Holding Overview. Optional historical compliance upload (CSV/JSON). Summary cards, risk gauge, heat map and bar chart by OpCo, upcoming deadlines, financial penalty and capital investment estimates, compliance gaps, business impact, and detailed explanation.
- **Companies & entities by framework** – “Companies & entities under [framework]” shows **only OpCos for the selected Parent Holding** for the chosen framework.

---

## Quick start

1. **Install dependencies** (from project root):

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
   - SMTP variables – for sending regulation changes by email.

---

## Data

- **Changes:** `server/data/changes.json` (regulation changes with deadlines and affected companies).
- **Companies:** `server/data/companies.json` (parent–OpCo per framework); `server/data/opco-multi-shareholders.json` (OpCos with multiple shareholders ≥25%).
- **UBO:** Stored in browser `localStorage` under `ubo_register`; change log under `ubo_changes_log`.

---

## Project structure

- **client/** – Vite + React frontend (dashboard, UBO, Analysis, Data Sovereignty, ESG, Multi Jurisdiction, chat).
- **server/** – Express API: `/api/changes`, `/api/companies`, `/api/frameworks`, `/api/chat`, `/api/pdf`, `/api/email`, `/api/ubo/extract`, `/api/pdf/ubo-registration`, `/api/analysis/risk-prediction`, etc.
- **server/data/** – `changes.json`, `companies.json`, `opco-multi-shareholders.json`.
- **docs/** – `PRODUCT_FEATURES_AND_FUNCTIONALITY.md` (detailed product and feature description).
