# Contract sample PDFs for testing

These PDFs are for testing the **Contracts Module** (Upload Document Contract and Contract Lifecycle Management).

## How to use

1. Go to **Contracts Module** → **Upload Document Contract** and upload one or more of these files (multi-select supported).
2. After upload, each file gets a **Contract ID** (and File ID) from the server. You can also use the **Contract ID** printed inside each PDF (see below) when adding a contract in **Contract Lifecycle Management** so the record matches the document.
3. In **Contract Lifecycle Management**, use the **Contract ID / File ID** filter and click **Lookup** to find contracts by that key.

## Contract IDs embedded in the sample files

| File | Contract ID (in document) | Type |
|------|---------------------------|------|
| CON-20250223-001-VENDOR.pdf | CON-20250223-001-VENDOR | Vendor – IT Infrastructure MSA |
| CON-20250223-002-NDA.pdf | CON-20250223-002-NDA | NDA – Mutual NDA |
| CON-20250223-003-LEASE.pdf | CON-20250223-003-LEASE | Lease – Office DIFC |
| CON-20250223-004-EMPLOYMENT.pdf | CON-20250223-004-EMPLOYMENT | Employment |
| CON-20250223-005-SERVICE.pdf | CON-20250223-005-SERVICE | Service – Regulatory monitoring |
| CON-20250223-006-PARTNERSHIP.pdf | CON-20250223-006-PARTNERSHIP | Partnership – Distribution |
| CON-20250223-007-VENDOR.pdf | CON-20250223-007-VENDOR | Vendor – Legal retainer |
| CON-20250223-008-SERVICE.pdf | CON-20250223-008-SERVICE | Service – Audit |
| CON-20250223-009-NDA.pdf | CON-20250223-009-NDA | NDA – Unilateral |
| CON-20250223-010-LEASE.pdf | CON-20250223-010-LEASE | Lease – Equipment |

When creating a contract record from an uploaded file, set **Contract ID** to the value above (or to the Contract ID returned by the upload) so that lookup by Contract ID finds the correct record.

## Regenerating samples

From the `server` directory:

```bash
node scripts/generate-contract-samples.js
```
