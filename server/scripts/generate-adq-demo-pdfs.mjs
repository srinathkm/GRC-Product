/**
 * Generate ADQ-themed demo PDFs into demo-files/pdfs/
 * Run: node server/scripts/generate-adq-demo-pdfs.mjs
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const OUT = {
  dossiers: join(ROOT, 'demo-files/pdfs/dossiers'),
  annexes: join(ROOT, 'demo-files/pdfs/annexes'),
  contracts: join(ROOT, 'demo-files/pdfs/contracts'),
};
const D = '2026-04-03';

function san(s) {
  return String(s || '').replace(/[^\x20-\x7E\n]/g, ' ');
}
function wrap(font, t, sz, mw) {
  const lines = [];
  let line = '';
  for (const w of san(t).trim().split(/\s+/)) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, sz) > mw && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}
function draw(doc, pg, font, text, x, y, sz, mw, minY) {
  let p = pg;
  let cy = y;
  for (const para of san(text).split('\n').map((q) => q.trim()).filter(Boolean)) {
    for (const ln of wrap(font, para, sz, mw)) {
      if (cy < minY) {
        p = doc.addPage([595, 842]);
        cy = 800;
      }
      p.drawText(ln, { x, y: cy, size: sz, font, color: rgb(0.12, 0.12, 0.14) });
      cy -= sz * 1.25;
    }
    cy -= sz * 0.35;
  }
  return { page: p, y: cy };
}

const DOSSIERS = [
  { f: 'AD-Ports-Group-PJSC-dossier.pdf', t: 'AD Ports Group PJSC', c: 'Transport & Logistics', b: `DEMO DOSSIER - public sources only. ${D}.\n\nIdentity: AD Ports Group PJSC, HQ Abu Dhabi.\nRegions: global ports/logistics - see https://www.adports.ae/ (${D}).\nADQ context: https://www.adq.ae/\nOwnership: use ADX annual report / issuer filings for shareholding - not reproduced here.\nReferences: adports.ae, adq.ae, ADX.` },
  { f: 'Etihad-Airways-dossier.pdf', t: 'Etihad Airways', c: 'Transport & Logistics', b: `DEMO DOSSIER - public sources only. ${D}.\n\nIdentity: Etihad Airways UAE.\nRegions: international - https://www.etihad.com/ (${D}).\nADQ: https://www.adq.ae/\nOwnership: not on homepage - see official filings if published.\nReferences: etihad.com, adq.ae.` },
  { f: 'Aramex-PJSC-dossier.pdf', t: 'Aramex PJSC', c: 'Transport & Logistics', b: `DEMO DOSSIER - public sources only. ${D}.\n\nhttps://www.aramex.com/ (${D}). Listed - DFM disclosures for shareholders.\nReferences: aramex.com.` },
  { f: 'Abu-Dhabi-Airports-dossier.pdf', t: 'Abu Dhabi Airports', c: 'Transport & Logistics', b: `DEMO DOSSIER - public sources only. ${D}.\n\nhttps://www.abudhabiairports.ae/ (${D}). ADQ portfolio context: adq.ae.` },
  { f: 'Etihad-Rail-dossier.pdf', t: 'Etihad Rail', c: 'Transport & Logistics', b: `DEMO DOSSIER - public sources only. ${D}.\n\nhttps://www.etihadrail.ae/ (${D}). adq.ae transport cluster.` },
  { f: 'ADNEC-dossier.pdf', t: 'ADNEC', c: 'Real Estate / Venues', b: `DEMO DOSSIER - public sources only. ${D}.\n\nhttps://www.adnec.ae/ (${D}). adq.ae.` },
  { f: 'Daman-dossier.pdf', t: 'Daman', c: 'Healthcare', b: `DEMO DOSSIER - public sources only. ${D}.\n\nhttps://www.daman.ae/ (${D}). adq.ae healthcare.` },
  { f: 'Silal-dossier.pdf', t: 'Silal', c: 'Food & Agriculture', b: `DEMO DOSSIER - public sources only. ${D}.\n\nADQ Food & Agriculture cluster https://www.adq.ae/ (${D}).` },
  { f: 'ENEC-dossier.pdf', t: 'ENEC', c: 'Energy', b: `DEMO DOSSIER - public sources only. ${D}.\n\nhttps://www.enec.gov.ae/ (${D}). adq.ae energy cluster.` },
  { f: 'SEHA-dossier.pdf', t: 'SEHA', c: 'Healthcare', b: `DEMO DOSSIER - public sources only. ${D}.\n\nhttps://www.seha.ae/ (${D}). adq.ae.` },
];

const UBO = `SYNTHETIC SMOKE TEST ONLY - NOT REAL ADQ DATA\n\nFull Name | Nationality | Shareholding %\nJ. Smith | United Kingdom | 35\nDemo Holding Ltd | Cayman Islands | 40\nRetail Nominee | UAE | 25\n\nEntity | Jurisdiction | Registered Address\nDemo Holding Ltd | Cayman Islands | PO Box 100`;

const OG = `SYNTHETIC OWNERSHIP NARRATIVE FOR EXTRACTOR TEST\n\nAbu Dhabi Developmental Holding Company PJSC owns 100% of Intermediate HoldCo LLC.\nIntermediate HoldCo LLC owns 60% of Demo Opco Ltd.\nGlobal Strategic Partner Inc owns 40% of Demo Opco Ltd.`;

const CON = [
  { f: 'CON-ADQDEMO-001-ADQ-MSA.pdf', x: `CONTRACT ID: CON-ADQDEMO-001-ADQ-MSA\n\nMSA (DEMO) ADQ and AD Ports Group PJSC. UAE law. Effective 1 Jan 2026. Demo only.` },
  { f: 'CON-ADQDEMO-002-NDA.pdf', x: `CONTRACT ID: CON-ADQDEMO-002-NDA\n\nNDA (DEMO) Etihad and Daman. UAE. Demo only.` },
  { f: 'CON-ADQDEMO-003-SUPPLY.pdf', x: `CONTRACT ID: CON-ADQDEMO-003-SUPPLY\n\nSupply (DEMO) Silal to SEHA. UAE. Demo only.` },
  { f: 'CON-ADQDEMO-004-SERVICE.pdf', x: `CONTRACT ID: CON-ADQDEMO-004-SERVICE\n\nService (DEMO) ENEC and Demo Compliance Analytics LLC. UAE. Demo only.` },
];

async function oneDossier(s) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let page = doc.addPage([595, 842]);
  let y = 800;
  const m = 48;
  page.drawText('ADQ PORTFOLIO DEMO DOSSIER', { x: m, y, size: 14, font, color: rgb(0.15, 0.25, 0.45) });
  y -= 26;
  page.drawText(s.t, { x: m, y, size: 12, font });
  y -= 16;
  page.drawText(`Cluster: ${s.c}`, { x: m, y, size: 10, font });
  y -= 20;
  draw(doc, page, font, s.b, m, y, 9, 500, 52);
  await writeFile(join(OUT.dossiers, s.f), await doc.save());
  console.log('dossier', s.f);
}

async function simple(path, title, body) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let page = doc.addPage([595, 842]);
  page.drawText(title, { x: 48, y: 800, size: 11, font, color: rgb(0.6, 0.1, 0.1) });
  draw(doc, page, font, body, 48, 770, 9, 500, 52);
  await writeFile(path, await doc.save());
}

async function contract(spec) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let page = doc.addPage([595, 842]);
  page.drawText('CONTRACT DEMO', { x: 48, y: 800, size: 12, font, color: rgb(0.2, 0.35, 0.55) });
  draw(doc, page, font, spec.x, 48, 772, 9, 500, 52);
  await writeFile(join(OUT.contracts, spec.f), await doc.save());
  console.log('contract', spec.f);
}

async function main() {
  await mkdir(OUT.dossiers, { recursive: true });
  await mkdir(OUT.annexes, { recursive: true });
  await mkdir(OUT.contracts, { recursive: true });
  for (const s of DOSSIERS) await oneDossier(s);
  await simple(join(OUT.annexes, 'annex-synthetic-ubo-smoke-test.pdf'), 'SYNTHETIC UBO - SMOKE TEST', UBO);
  await simple(join(OUT.annexes, 'annex-ownership-graph-synthetic-narrative.pdf'), 'SYNTHETIC OWNERSHIP GRAPH', OG);
  for (const c of CON) await contract(c);
  console.log('done demo-files/pdfs');
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
