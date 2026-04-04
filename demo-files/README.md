# ADQ demo artifacts

This folder holds **demo materials** for end-to-end testing of the regulation-changes-dashboard using **public information** about [ADQ](https://www.adq.ae/) and a **representative subset** of portfolio companies (8–12 entities across ADQ’s published clusters).

## Principles

- **Sources:** Only authorized public sources (ADQ.ae, each company’s official site, and where applicable exchange filings and annual reports). Each dossier PDF should cite **URL + access date** per factual block.
- **UBO / shareholding:** Include **only** what is publicly disclosed. Where homepages do not state ownership, document **“not found in reviewed sources”**—do not fabricate registers.
- **Extractor tests:** If a public table is insufficient for UBO or ownership-graph extraction, use a **separate** PDF clearly labeled **synthetic / smoke-test only**, not as official ADQ data.

## Generated PDFs (regenerate)

From the `server` directory:

```bash
node scripts/generate-adq-demo-pdfs.mjs
```

| Path | Contents |
|------|----------|
| [`sourcing-matrix.md`](sourcing-matrix.md) | Company × cluster × URLs × gaps |
| `pdfs/dossiers/` | 10 portfolio dossiers (public-source narrative; not full cap tables) |
| `pdfs/annexes/` | `annex-synthetic-ubo-smoke-test.pdf`, `annex-ownership-graph-synthetic-narrative.pdf` (labeled synthetic — for extractor tests only) |
| `pdfs/contracts/` | `CON-ADQDEMO-001` … `004` demo contracts |

## Related product paths

- UBO and ownership graph: [`server/routes/ubo.js`](../server/routes/ubo.js), [`server/services/ownershipGraphExtract.js`](../server/services/ownershipGraphExtract.js)
- Contract samples generator: [`server/scripts/generate-contract-samples.js`](../server/scripts/generate-contract-samples.js)
- Seed data: [`server/data/`](../server/data/)

## Disclaimer

This pack is a **third-party demo compilation** for product testing. It is not an official disclosure by ADQ or any portfolio company.
