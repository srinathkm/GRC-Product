/**
 * One-off script to generate 5 sample PDFs for DummyFactory LLC Defender compliance demos.
 * Run from server: node scripts/generate-dummyfactory-pdfs.mjs
 */
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = join(__dirname, '..', 'data', 'samples');

const PDFS = [
  {
    filename: 'DummyFactory_Microsoft_Cloud_Security_Benchmark_Compliance_Report_High.pdf',
    body: `Microsoft Cloud Security Benchmark
Compliance Report – DummyFactory LLC

Compliance score: 94%
Secure score: 92%

Summary: 94% of controls passed. Secure score 92%.`,
  },
  {
    filename: 'DummyFactory_Compliance_Report_Low.pdf',
    body: `Regulatory Compliance Report
DummyFactory LLC

Compliance: 28%
Controls passed: 28%`,
  },
  {
    filename: 'DummyFactory_Microsoft_Cloud_Security_Benchmark_Scenario3.pdf',
    body: `Microsoft cloud security benchmark
Compliance Report – DummyFactory LLC

18 of 20 controls passed.`,
  },
  {
    filename: 'DummyFactory_Defender_Secure_Score_Report.pdf',
    body: `Microsoft cloud security benchmark
Defender for Cloud – DummyFactory LLC

Secure score: 76%`,
  },
  {
    filename: 'DummyFactory_Compliance_Score_Report_Moderate.pdf',
    body: `DummyFactory LLC – Security Compliance Summary

Overall compliance score: 65%
Secure score: 62%

Control compliance: 65%
62% compliant.`,
  },
];

function sanitize(str) {
  if (str == null || typeof str !== 'string') return '';
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').replace(/[^\x20-\x7E\n]/g, ' ');
}

async function createPdfWithText(body) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const size = 12;
  const margin = 50;
  const lineHeight = size * 1.4;
  const maxWidth = 495;
  const pageHeight = 842;
  let page = doc.addPage([595, pageHeight]);
  let y = pageHeight - margin;

  const lines = sanitize(body).split(/\r?\n/);
  for (const line of lines) {
    if (y < margin + lineHeight) {
      page = doc.addPage([595, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawText(line.trim() || ' ', {
      x: margin,
      y,
      size,
      font,
    });
    y -= lineHeight;
  }

  return await doc.save();
}

mkdirSync(SAMPLES_DIR, { recursive: true });

for (const { filename, body } of PDFS) {
  const bytes = await createPdfWithText(body);
  const path = join(SAMPLES_DIR, filename);
  writeFileSync(path, bytes);
  console.log('Written:', path);
}

console.log('Done. 5 PDFs created in', SAMPLES_DIR);
