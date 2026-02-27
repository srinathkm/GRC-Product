import { Router } from 'express';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { FRAMEWORK_REFERENCES, FRAMEWORKS } from '../constants.js';
import { lookupChangesForFramework } from '../services/ai.js';
import { isLlmConfigured } from '../services/llm.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dirname, '../data/changes.json');

const ALLOWED_DAYS = [30, 180, 365];
const DEFAULT_DAYS = 30;

function parseDays(value) {
  const n = parseInt(value, 10);
  return ALLOWED_DAYS.includes(n) ? n : DEFAULT_DAYS;
}

function periodLabel(days) {
  if (days === 30) return '30 days';
  if (days === 180) return '6 months';
  if (days === 365) return '1 year';
  return `${days} days`;
}

function sanitizeFilename(name) {
  return (name || 'All_frameworks').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function normalizeDatesForDemo(data) {
  if (!Array.isArray(data) || data.length === 0) return data;
  const now = new Date();
  const latest = new Date(Math.max(...data.map((c) => new Date(c.date).getTime())));
  const oneDayMs = 24 * 60 * 60 * 1000;
  const daysAgo = (now.getTime() - latest.getTime()) / oneDayMs;
  if (daysAgo <= 1) return data;
  const shiftDays = Math.min(Math.floor(daysAgo) - 1, 365);
  return data.map((c) => {
    const d = new Date(c.date);
    d.setDate(d.getDate() + shiftDays);
    return { ...c, date: d.toISOString().slice(0, 10) };
  });
}

/** Strip characters that break pdf-lib StandardFonts (keep ASCII printable + common Latin). */
function sanitizePdfText(str) {
  if (str == null || typeof str !== 'string') return '';
  return str
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[^\x20-\x7E\n]/g, ' ');
}

function wrapText(text, maxWidth, font, size) {
  const safe = sanitizePdfText(text);
  const words = safe.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    const width = font.widthOfTextAtSize(test, size);
    if (width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export const pdfRouter = Router();

pdfRouter.post('/', async (req, res) => {
  try {
    const raw = await readFile(dataPath, 'utf-8');
    const all = normalizeDatesForDemo(JSON.parse(raw));
    const { ids, framework, days: daysParam } = req.body || {};
    const days = parseDays(daysParam);
    let changes = all;

    if (ids && Array.isArray(ids) && ids.length > 0) {
      changes = all.filter((c) => ids.includes(c.id));
    } else if (framework) {
      changes = all.filter((c) => c.framework === framework);
    }

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    changes = changes.filter((c) => new Date(c.date) >= fromDate);

    const useLookup = req.body.lookup === true || req.body.lookup === '1';
    if (useLookup && isLlmConfigured()) {
      try {
        const existingIds = new Set(changes.map((c) => c.id));
        if (framework) {
          const lookedUp = await lookupChangesForFramework(framework, days);
          for (const c of lookedUp) {
            if (!existingIds.has(c.id)) {
              changes.push(c);
              existingIds.add(c.id);
            }
          }
        } else {
          for (const fw of FRAMEWORKS) {
            const lookedUp = await lookupChangesForFramework(fw, days);
            for (const c of lookedUp) {
              if (!existingIds.has(c.id)) {
                changes.push(c);
                existingIds.add(c.id);
              }
            }
          }
        }
        changes.sort((a, b) => new Date(b.date) - new Date(a.date));
      } catch (lookupErr) {
        console.error('PDF lookup failed, using static data only:', lookupErr.message);
      }
    }

    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const size = 11;
    const margin = 50;
    const maxWidth = 500;
    const pageWidth = 595;
    const pageHeight = 842;
    const contentYStart = 750;
    let y = contentYStart;
    const lineHeight = size * 1.3;

    const addPage = () => doc.addPage([pageWidth, pageHeight]);
    let page = addPage();

    const reportTitle = sanitizePdfText(`${framework || 'All frameworks'} changes for the last ${periodLabel(days)}`);
    page.drawText(reportTitle, { x: margin, y, font: bold, size: 14, color: rgb(0.2, 0.3, 0.5) });
    y -= lineHeight * 1.5;

    if (framework && FRAMEWORK_REFERENCES[framework]) {
      const ref = FRAMEWORK_REFERENCES[framework];
      page.drawText(sanitizePdfText('Official rulebook: ' + ref.url), { x: margin, y, font, size: 9, color: rgb(0.2, 0.4, 0.6) });
      y -= lineHeight;
      page.drawText(sanitizePdfText(ref.description), { x: margin, y, font, size: 8, color: rgb(0.35, 0.35, 0.35) });
      y -= lineHeight * 1.2;
    } else if (changes.length > 0) {
      const frameworksInReport = [...new Set(changes.map((c) => c.framework))];
      page.drawText('Framework references (in this report):', { x: margin, y, font: bold, size: 9, color: rgb(0.2, 0.3, 0.5) });
      y -= lineHeight;
      for (const fw of frameworksInReport) {
        if (FRAMEWORK_REFERENCES[fw]) {
          page.drawText(sanitizePdfText(fw + ': ' + FRAMEWORK_REFERENCES[fw].url), { x: margin, y, font, size: 8, color: rgb(0.2, 0.4, 0.6) });
          y -= lineHeight;
        }
      }
      y -= lineHeight * 0.5;
    }

    for (const c of changes) {
      if (y < 100) {
        page = addPage();
        y = contentYStart;
      }
      page.drawText(sanitizePdfText(c.framework), { x: margin, y, font: bold, size: 12, color: rgb(0.2, 0.3, 0.5) });
      y -= lineHeight;
      page.drawText(sanitizePdfText(c.title), { x: margin, y, font: bold, size });
      y -= lineHeight;
      page.drawText(sanitizePdfText(`Date: ${c.date || ''} | Category: ${c.category || ''}`), { x: margin, y, font, size: 9, color: rgb(0.4, 0.4, 0.4) });
      y -= lineHeight;
      const bodyLines = wrapText(c.fullText, maxWidth, font, size);
      for (const line of bodyLines) {
        if (y < 80) {
          page = addPage();
          y = contentYStart;
        }
        page.drawText(line, { x: margin, y, font, size });
        y -= lineHeight;
      }
      y -= lineHeight;
    }

    const pdfBytes = await doc.save();
    const downloadDate = new Date().toISOString().slice(0, 10);
    const baseName = sanitizeFilename(framework || 'All_frameworks');
    const filename = `${baseName}_${downloadDate}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(pdfBytes));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** UBO registration document: field labels for PDF (aligned with ME register). */
const UBO_FIELD_LABELS = {
  fullName: 'Full name (as per ID)',
  nationality: 'Nationality',
  dateOfBirth: 'Date of birth',
  placeOfBirth: 'Place of birth',
  idType: 'ID type (Passport / National ID)',
  idNumber: 'ID number',
  idCountryOfIssue: 'Country of issuance',
  idExpiry: 'ID expiry date',
  address: 'Residential address or address for notices',
  countryOfResidence: 'Country of residence',
  percentageOwnership: 'Percentage ownership / control',
  natureOfControl: 'Nature of control (ownership / voting / other means)',
  dateBecameBeneficialOwner: 'Date became beneficial owner',
};

/** POST /api/pdf/ubo-registration – generate pre-filled UBO registration document (signature to be added by signatory). */
pdfRouter.post('/ubo-registration', async (req, res) => {
  try {
    const { parent, opco, details = {} } = req.body || {};
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const size = 10;
    const margin = 50;
    const maxWidth = 495;
    const pageWidth = 595;
    const pageHeight = 842;
    let y = 800;
    const lineHeight = size * 1.25;

    const addPage = () => doc.addPage([pageWidth, pageHeight]);
    let page = addPage();

    page.drawText('UBO Registration Document', { x: margin, y, font: bold, size: 16, color: rgb(0.2, 0.3, 0.5) });
    y -= lineHeight * 1.5;
    page.drawText(sanitizePdfText(`Parent Holding: ${parent || '—'}`), { x: margin, y, font: bold, size: 11, color: rgb(0.2, 0.4, 0.6) });
    y -= lineHeight;
    page.drawText(sanitizePdfText(`Operating Company (OpCo): ${opco || '—'}`), { x: margin, y, font: bold, size: 11, color: rgb(0.2, 0.4, 0.6) });
    y -= lineHeight * 1.5;

    page.drawText('Pre-filled UBO details (as per UAE/GCC register requirements)', { x: margin, y, font: bold, size: 10, color: rgb(0.3, 0.3, 0.3) });
    y -= lineHeight;
    for (const [id, label] of Object.entries(UBO_FIELD_LABELS)) {
      if (y < 120) {
        page = addPage();
        y = 800;
      }
      const value = details[id];
      page.drawText(sanitizePdfText(`${label}:`), { x: margin, y, font: bold, size: 9, color: rgb(0.25, 0.25, 0.25) });
      y -= lineHeight * 0.85;
      const text = value != null && String(value).trim() ? String(value) : '—';
      const lines = wrapText(text, maxWidth, font, 9);
      for (const line of lines) {
        if (y < 80) {
          page = addPage();
          y = 800;
        }
        page.drawText(line, { x: margin + 5, y, font, size: 9, color: rgb(0.2, 0.2, 0.2) });
        y -= lineHeight * 0.85;
      }
      y -= lineHeight * 0.4;
    }

    if (y < 200) {
      page = addPage();
      y = 800;
    }
    y -= lineHeight;
    page.drawText('Signature block (to be completed by the relevant authorised signatory)', { x: margin, y, font: bold, size: 10, color: rgb(0.2, 0.3, 0.5) });
    y -= lineHeight * 1.5;
    page.drawText('Signature: _________________________________________   Date: _______________', { x: margin, y, font, size: 10, color: rgb(0.2, 0.2, 0.2) });
    y -= lineHeight * 1.5;
    page.drawText('After signing, upload this document via the UAE Trade Registry section.', { x: margin, y, font, size: 8, color: rgb(0.4, 0.4, 0.4) });

    const pdfBytes = await doc.save();
    const safeOpco = (opco || 'OpCo').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `UBO_Registration_${safeOpco}_${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(pdfBytes));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
