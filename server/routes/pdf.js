import { Router } from 'express';
import multer from 'multer';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mammoth from 'mammoth';
import { FRAMEWORK_REFERENCES, FRAMEWORKS } from '../constants.js';
import { lookupChangesForFramework } from '../services/ai.js';
import { isLlmConfigured } from '../services/llm.js';

const templateUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

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
    const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

    const PAGE_W = 595;
    const PAGE_H = 842;
    const MARGIN = 50;
    const CONTENT_W = PAGE_W - MARGIN * 2;
    const HEADER_H = 60;          // top coloured header strip height
    const FOOTER_H = 28;
    const BODY_Y_START = PAGE_H - HEADER_H - 24;
    const BODY_Y_END = FOOTER_H + 16;

    const BRAND_DARK   = rgb(0.10, 0.16, 0.26);  // #1a2942
    const BRAND_ACCENT = rgb(0.23, 0.51, 0.96);  // #3b82f6
    const BRAND_LIGHT  = rgb(0.90, 0.93, 0.97);
    const GRAY_MID     = rgb(0.45, 0.45, 0.50);
    const GRAY_LIGHT   = rgb(0.88, 0.90, 0.93);

    // Category badge colours
    const CAT_COLORS = {
      Banking:       rgb(0.13, 0.55, 0.91),
      Cybersecurity: rgb(0.60, 0.18, 0.80),
      Disclosure:    rgb(0.90, 0.45, 0.10),
      AML:           rgb(0.80, 0.20, 0.20),
      ESG:           rgb(0.12, 0.65, 0.35),
      Governance:    rgb(0.25, 0.50, 0.75),
      General:       rgb(0.40, 0.40, 0.50),
    };

    let pageNum = 0;
    const pages = [];

    const addPage = () => {
      const p = doc.addPage([PAGE_W, PAGE_H]);
      pageNum++;
      pages.push({ page: p, num: pageNum });

      // Header strip
      p.drawRectangle({ x: 0, y: PAGE_H - HEADER_H, width: PAGE_W, height: HEADER_H, color: BRAND_DARK });
      p.drawRectangle({ x: 0, y: PAGE_H - HEADER_H - 3, width: PAGE_W, height: 3, color: BRAND_ACCENT });
      p.drawText('RAQIB', { x: MARGIN, y: PAGE_H - 38, font: bold, size: 18, color: BRAND_ACCENT });
      p.drawText('Compliance Intelligence Platform', { x: MARGIN + 72, y: PAGE_H - 38, font, size: 9, color: BRAND_LIGHT });
      const dtStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const dtW = font.widthOfTextAtSize(dtStr, 8);
      p.drawText(dtStr, { x: PAGE_W - MARGIN - dtW, y: PAGE_H - 38, font, size: 8, color: BRAND_LIGHT });

      // Footer strip
      p.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: FOOTER_H, color: BRAND_DARK });
      p.drawText('Confidential – for authorised recipients only', { x: MARGIN, y: 10, font: italic, size: 7, color: BRAND_LIGHT });
      const pLabel = `Page ${pageNum}`;
      const pW = font.widthOfTextAtSize(pLabel, 7);
      p.drawText(pLabel, { x: PAGE_W - MARGIN - pW, y: 10, font, size: 7, color: BRAND_LIGHT });

      return p;
    };

    // ── COVER PAGE ────────────────────────────────────────────────────────────
    let page = addPage();
    // Big accent band
    page.drawRectangle({ x: 0, y: 280, width: PAGE_W, height: 220, color: BRAND_DARK });
    page.drawRectangle({ x: 0, y: 276, width: PAGE_W, height: 4, color: BRAND_ACCENT });
    page.drawRectangle({ x: 0, y: 500, width: PAGE_W, height: 4, color: BRAND_ACCENT });

    const coverTitle = sanitizePdfText(framework ? `${framework} Compliance Report` : 'Regulatory Changes Report');
    const coverTitleLines = wrapText(coverTitle, CONTENT_W - 20, bold, 22);
    let coverY = 480;
    for (const ln of coverTitleLines) {
      page.drawText(ln, { x: MARGIN + 10, y: coverY, font: bold, size: 22, color: rgb(1, 1, 1) });
      coverY -= 28;
    }

    const periodStr = sanitizePdfText(`Period: Last ${periodLabel(days)}`);
    page.drawText(periodStr, { x: MARGIN + 10, y: coverY - 6, font, size: 12, color: BRAND_LIGHT });

    // Summary stats box
    const criticalCount = changes.filter((c) => {
      if (!c.deadline) return false;
      const d = new Date(c.deadline);
      return !isNaN(d) && (d - new Date()) / (1000 * 60 * 60 * 24) <= 90;
    }).length;
    const frameworksInReport = [...new Set(changes.map((c) => c.framework))];

    const statsY = 240;
    page.drawRectangle({ x: MARGIN, y: statsY - 70, width: CONTENT_W, height: 100, color: rgb(0.95, 0.97, 1.0) });
    page.drawRectangle({ x: MARGIN, y: statsY - 70, width: 4, height: 100, color: BRAND_ACCENT });

    const statItems = [
      { label: 'Total Changes', value: String(changes.length) },
      { label: 'Frameworks Covered', value: String(frameworksInReport.length) },
      { label: 'Critical Deadlines (≤90d)', value: String(criticalCount) },
      { label: 'Generated', value: new Date().toISOString().slice(0, 10) },
    ];
    const colW = CONTENT_W / statItems.length;
    statItems.forEach((s, i) => {
      const sx = MARGIN + 12 + colW * i;
      page.drawText(s.value, { x: sx, y: statsY + 14, font: bold, size: 18, color: BRAND_DARK });
      page.drawText(s.label, { x: sx, y: statsY - 4, font, size: 8, color: GRAY_MID });
    });

    // Framework references on cover
    if (frameworksInReport.length > 0) {
      let refY = statsY - 90;
      page.drawText('Framework References', { x: MARGIN, y: refY, font: bold, size: 9, color: BRAND_DARK });
      refY -= 14;
      page.drawLine({ start: { x: MARGIN, y: refY }, end: { x: PAGE_W - MARGIN, y: refY }, thickness: 0.5, color: GRAY_LIGHT });
      refY -= 14;
      for (const fw of frameworksInReport) {
        if (refY < 60) break;
        const ref = FRAMEWORK_REFERENCES[fw];
        page.drawText(sanitizePdfText(`${fw}${ref ? ` – ${ref.authority}` : ''}`), { x: MARGIN, y: refY, font: bold, size: 8, color: BRAND_DARK });
        if (ref) {
          const urlW = font.widthOfTextAtSize(ref.url, 7.5);
          page.drawText(ref.url, { x: PAGE_W - MARGIN - urlW, y: refY, font, size: 7.5, color: BRAND_ACCENT });
        }
        refY -= 14;
      }
    }

    // ── CHANGES PAGES ─────────────────────────────────────────────────────────
    let y = BODY_Y_START;
    page = addPage();

    // Section heading
    page.drawText('Regulatory Changes', { x: MARGIN, y, font: bold, size: 14, color: BRAND_DARK });
    page.drawLine({ start: { x: MARGIN, y: y - 4 }, end: { x: PAGE_W - MARGIN, y: y - 4 }, thickness: 1, color: BRAND_ACCENT });
    y -= 22;

    for (let idx = 0; idx < changes.length; idx++) {
      const c = changes[idx];

      // Estimate height needed for this item (heading + meta + body)
      const bodyLines = wrapText(c.fullText || c.snippet || '', CONTENT_W - 8, font, 10);
      const itemHeight = 14 + 12 + 12 + bodyLines.length * 13 + 16;

      if (y - itemHeight < BODY_Y_END) {
        page = addPage();
        y = BODY_Y_START;
      }

      // Card background
      page.drawRectangle({ x: MARGIN - 2, y: y - itemHeight + 6, width: CONTENT_W + 4, height: itemHeight, color: rgb(0.97, 0.98, 1.0) });
      // Left accent bar — colour by category
      const catColor = CAT_COLORS[c.category] || CAT_COLORS.General;
      page.drawRectangle({ x: MARGIN - 2, y: y - itemHeight + 6, width: 3, height: itemHeight, color: catColor });

      // Change number + framework
      page.drawText(sanitizePdfText(`${idx + 1}. ${c.framework}`), { x: MARGIN + 6, y, font: bold, size: 11, color: BRAND_DARK });

      // Category badge (drawn as coloured box + white text simulation)
      const catLabel = sanitizePdfText(c.category || 'General');
      const badgeX = PAGE_W - MARGIN - font.widthOfTextAtSize(catLabel, 8) - 10;
      page.drawRectangle({ x: badgeX - 2, y: y - 10, width: font.widthOfTextAtSize(catLabel, 8) + 10, height: 14, color: catColor });
      page.drawText(catLabel, { x: badgeX + 2, y: y - 7, font: bold, size: 8, color: rgb(1, 1, 1) });

      y -= 14;

      // Title
      const titleLines = wrapText(c.title || '', CONTENT_W - 12, bold, 10);
      for (const tl of titleLines) {
        if (y < BODY_Y_END) { page = addPage(); y = BODY_Y_START; }
        page.drawText(sanitizePdfText(tl), { x: MARGIN + 6, y, font: bold, size: 10, color: BRAND_DARK });
        y -= 13;
      }

      // Meta: date + deadline
      const metaParts = [`Date: ${c.date || '—'}`];
      if (c.deadline) metaParts.push(`Deadline: ${c.deadline}`);
      page.drawText(sanitizePdfText(metaParts.join('   |   ')), { x: MARGIN + 6, y, font: italic, size: 8.5, color: GRAY_MID });
      y -= 12;

      // Separator line
      page.drawLine({ start: { x: MARGIN + 6, y }, end: { x: PAGE_W - MARGIN - 6, y }, thickness: 0.3, color: GRAY_LIGHT });
      y -= 10;

      // Body text
      for (const bl of bodyLines) {
        if (y < BODY_Y_END) { page = addPage(); y = BODY_Y_START; }
        page.drawText(sanitizePdfText(bl), { x: MARGIN + 6, y, font, size: 10, color: rgb(0.2, 0.2, 0.2) });
        y -= 13;
      }

      // Source URL if available
      if (c.sourceUrl) {
        if (y < BODY_Y_END) { page = addPage(); y = BODY_Y_START; }
        page.drawText(sanitizePdfText(`Source: ${c.sourceUrl}`), { x: MARGIN + 6, y, font: italic, size: 8, color: BRAND_ACCENT });
        y -= 12;
      }

      y -= 10; // gap between cards
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

/** UBO registration document: field labels for PDF – member (individual) mandatory details. */
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

/** Corporate parent: labels for opco drawer / PDF (corporateJurisdictionOfIncorporation → Jurisdiction of Incorporation, etc.). */
const UBO_CORPORATE_FIELD_LABELS = {
  corporateName: 'Entity Name',
  corporateJurisdictionOfIncorporation: 'Jurisdiction of Incorporation',
  corporateRegisteredAddress: 'Registered Address',
  corporateRegistrationNumber: 'Registration Number',
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
    const isCorporate = details.relationshipType === 'corporate';
    const fieldLabels = isCorporate ? UBO_CORPORATE_FIELD_LABELS : UBO_FIELD_LABELS;
    for (const [id, label] of Object.entries(fieldLabels)) {
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

// ─────────────────────────────────────────────────────────────────────────────
// XBRL Export
// POST /api/pdf/xbrl
// Generates an XBRL-compatible XML document from regulatory changes data.
// Uses a simplified Raqib namespace taxonomy.
// Body: { framework?, days?, ids?, lookup? } — same filters as PDF export.
// ─────────────────────────────────────────────────────────────────────────────

function escXml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

pdfRouter.post('/xbrl', async (req, res) => {
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
        const fws = framework ? [framework] : FRAMEWORKS;
        for (const fw of fws) {
          const lookedUp = await lookupChangesForFramework(fw, days);
          for (const c of lookedUp) {
            if (!existingIds.has(c.id)) { changes.push(c); existingIds.add(c.id); }
          }
        }
        changes.sort((a, b) => new Date(b.date) - new Date(a.date));
      } catch (_) { /* use static */ }
    }

    const reportDate = new Date().toISOString().slice(0, 10);
    const periodEnd = reportDate;
    const periodStart = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const frameworksInReport = [...new Set(changes.map((c) => c.framework))];
    const critCount = changes.filter((c) => {
      if (!c.deadline) return false;
      const d = new Date(c.deadline);
      return !isNaN(d) && (d - new Date()) / 86400000 <= 90;
    }).length;

    const lines = [];
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push('<xbrl');
    lines.push('  xmlns="http://www.xbrl.org/2003/instance"');
    lines.push('  xmlns:link="http://www.xbrl.org/2003/linkbase"');
    lines.push('  xmlns:xlink="http://www.w3.org/1999/xlink"');
    lines.push('  xmlns:xbrli="http://www.xbrl.org/2003/instance"');
    lines.push('  xmlns:raqib="http://raqib.com/xbrl/grc/2024"');
    lines.push('>');

    // Report-level context
    lines.push('  <context id="reportContext">');
    lines.push('    <entity><identifier scheme="http://raqib.com">RAQIB-GRC</identifier></entity>');
    lines.push('    <period>');
    lines.push(`      <startDate>${escXml(periodStart)}</startDate>`);
    lines.push(`      <endDate>${escXml(periodEnd)}</endDate>`);
    lines.push('    </period>');
    lines.push('  </context>');

    // Per-change contexts
    changes.forEach((c, i) => {
      lines.push(`  <context id="change-${i}">`);
      lines.push(`    <entity><identifier scheme="http://raqib.com">${escXml(c.id || `change-${i}`)}</identifier></entity>`);
      lines.push(`    <period><instant>${escXml(c.date || reportDate)}</instant></period>`);
      lines.push('  </context>');
    });

    // Report-level facts
    lines.push('  <raqib:reportTitle contextRef="reportContext">' + escXml(framework ? `${framework} Regulatory Changes` : 'All Frameworks Regulatory Changes') + '</raqib:reportTitle>');
    lines.push(`  <raqib:reportPeriodLabel contextRef="reportContext">${escXml(periodLabel(days))}</raqib:reportPeriodLabel>`);
    lines.push(`  <raqib:reportGeneratedDate contextRef="reportContext">${escXml(reportDate)}</raqib:reportGeneratedDate>`);
    lines.push(`  <raqib:totalChangesCount contextRef="reportContext" xbrli:decimals="0">${changes.length}</raqib:totalChangesCount>`);
    lines.push(`  <raqib:frameworksCount contextRef="reportContext" xbrli:decimals="0">${frameworksInReport.length}</raqib:frameworksCount>`);
    lines.push(`  <raqib:criticalDeadlineChangesCount contextRef="reportContext" xbrli:decimals="0">${critCount}</raqib:criticalDeadlineChangesCount>`);

    // Per-change facts
    changes.forEach((c, i) => {
      const ctx = `change-${i}`;
      lines.push(`  <raqib:changeId contextRef="${ctx}">${escXml(c.id || '')}</raqib:changeId>`);
      lines.push(`  <raqib:changeFramework contextRef="${ctx}">${escXml(c.framework || '')}</raqib:changeFramework>`);
      lines.push(`  <raqib:changeTitle contextRef="${ctx}">${escXml(c.title || '')}</raqib:changeTitle>`);
      lines.push(`  <raqib:changeCategory contextRef="${ctx}">${escXml(c.category || '')}</raqib:changeCategory>`);
      lines.push(`  <raqib:changeDate contextRef="${ctx}">${escXml(c.date || '')}</raqib:changeDate>`);
      if (c.deadline) lines.push(`  <raqib:changeDeadline contextRef="${ctx}">${escXml(c.deadline)}</raqib:changeDeadline>`);
      lines.push(`  <raqib:changeSummary contextRef="${ctx}">${escXml((c.snippet || c.fullText || '').slice(0, 800))}</raqib:changeSummary>`);
      if (c.sourceUrl) lines.push(`  <raqib:changeSourceUrl contextRef="${ctx}">${escXml(c.sourceUrl)}</raqib:changeSourceUrl>`);
    });

    lines.push('</xbrl>');

    const xbrlDate = reportDate;
    const baseNameXbrl = sanitizeFilename(framework || 'All_frameworks');
    const filenameXbrl = `${baseNameXbrl}_${xbrlDate}.xbrl`;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameXbrl}"`);
    res.send(lines.join('\n'));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// UBO Record with optional DOCX template
// POST /api/pdf/ubo-record
// Multipart form: template (optional DOCX file), parent, opco, ownersJson (JSON array of owner objects)
// If template provided: extracts text from DOCX, replaces {{placeholder}} for each owner, generates PDF.
// If no template: generates a structured standard multi-owner PDF.
// ─────────────────────────────────────────────────────────────────────────────
pdfRouter.post('/ubo-record', templateUpload.single('template'), async (req, res) => {
  try {
    const parent = (req.body?.parent || '').trim();
    const opco = (req.body?.opco || '').trim();
    let owners = [];
    try {
      owners = JSON.parse(req.body?.ownersJson || '[]');
    } catch (_) {
      owners = [];
    }
    if (!Array.isArray(owners) || owners.length === 0) {
      return res.status(400).json({ error: 'ownersJson must be a non-empty array of owner objects' });
    }

    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const MARGIN = 50;
    const PAGE_W = 595;
    const PAGE_H = 842;
    const MAX_W = PAGE_W - MARGIN * 2;
    const LINE = 12;

    let page = doc.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN;

    const ensurePage = (needed = 60) => {
      if (y < needed) {
        page = doc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN;
      }
    };

    const drawText = (text, opts = {}) => {
      ensurePage(opts.needed || 40);
      const lines = wrapText(sanitizePdfText(String(text || '')), opts.maxW || MAX_W, opts.useFont || font, opts.size || 10);
      for (const line of lines) {
        page.drawText(line, { x: opts.x || MARGIN, y, font: opts.useFont || font, size: opts.size || 10, color: opts.color || rgb(0.15, 0.15, 0.15) });
        y -= opts.lineH || LINE;
        ensurePage();
      }
    };

    if (req.file) {
      // Template-based: extract DOCX text, substitute placeholders per owner, render to PDF
      const { value: docxText } = await mammoth.extractRawText({ buffer: req.file.buffer });

      // Title
      drawText('UBO Record — Generated from Custom Template', { useFont: bold, size: 14, color: rgb(0.1, 0.25, 0.5), lineH: 18 });
      drawText(`Operating Company: ${opco || '—'}   |   Parent Holding: ${parent || '—'}`, { size: 10, color: rgb(0.3, 0.3, 0.3), lineH: 14 });
      drawText(`Generated: ${new Date().toISOString().slice(0, 10)}`, { size: 9, color: rgb(0.5, 0.5, 0.5), lineH: 14 });
      y -= 10;

      for (let i = 0; i < owners.length; i++) {
        const owner = owners[i];
        ensurePage(80);
        page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.8) });
        y -= 6;
        const isCorp = owner.relationshipType === 'corporate';
        const ownerName = isCorp ? (owner.corporateName || owner.parent || `Owner ${i + 1}`) : (owner.fullName || owner.parent || `Owner ${i + 1}`);
        drawText(`Beneficial Owner #${i + 1}: ${ownerName}`, { useFont: bold, size: 11, color: rgb(0.1, 0.25, 0.5), lineH: 15 });

        // Replace placeholders in template text for this owner
        const substituted = docxText.replace(/\{\{(\w+)\}\}/g, (_, key) => {
          if (key === 'opco') return opco || '—';
          if (key === 'parent') return owner.parent || parent || '—';
          const val = owner[key];
          return val != null && String(val).trim() ? String(val) : '—';
        });

        // Render filled template lines
        const templateLines = substituted.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 0);
        for (const tl of templateLines) {
          drawText(tl, { size: 9, lineH: 11, color: rgb(0.15, 0.15, 0.15) });
        }
        y -= 8;
      }
    } else {
      // Standard multi-owner PDF
      drawText('UBO Register Record', { useFont: bold, size: 16, color: rgb(0.1, 0.25, 0.5), lineH: 20 });
      drawText(`Operating Company (OpCo): ${opco || '—'}`, { useFont: bold, size: 11, color: rgb(0.2, 0.4, 0.6), lineH: 15 });
      drawText(`Parent Holding: ${parent || '—'}`, { useFont: bold, size: 11, color: rgb(0.2, 0.4, 0.6), lineH: 15 });
      drawText(`Date generated: ${new Date().toISOString().slice(0, 10)}`, { size: 9, color: rgb(0.5, 0.5, 0.5), lineH: 14 });
      drawText(`Total beneficial owners: ${owners.length}`, { size: 10, lineH: 14 });
      y -= 10;

      const MEMBER_LABELS = {
        fullName: 'Full Name (as per ID)',
        nationality: 'Nationality',
        dateOfBirth: 'Date of Birth',
        placeOfBirth: 'Place of Birth',
        idType: 'ID Type',
        idNumber: 'ID Number',
        idCountryOfIssue: 'Country of Issuance',
        idExpiry: 'ID Expiry Date',
        address: 'Residential Address',
        countryOfResidence: 'Country of Residence',
        natureOfControl: 'Nature of Control',
        dateBecameBeneficialOwner: 'Date Became Beneficial Owner',
      };
      const CORPORATE_LABELS = {
        corporateName: 'Entity Name',
        corporateJurisdictionOfIncorporation: 'Jurisdiction of Incorporation',
        corporateRegisteredAddress: 'Registered Address',
        corporateRegistrationNumber: 'Registration Number',
      };

      for (let i = 0; i < owners.length; i++) {
        const owner = owners[i];
        ensurePage(100);
        page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.8) });
        y -= 6;
        const isCorp = owner.relationshipType === 'corporate';
        const ownerName = isCorp ? (owner.corporateName || owner.parent || `Owner ${i + 1}`) : (owner.fullName || owner.parent || `Owner ${i + 1}`);
        const typeLabel = isCorp ? 'Corporate Entity' : 'Individual (Member)';
        drawText(`#${i + 1} — ${ownerName}  [${typeLabel}]`, { useFont: bold, size: 11, color: rgb(0.1, 0.25, 0.5), lineH: 15 });
        drawText(`Ownership: ${owner.percentage != null ? owner.percentage + '%' : '—'}   |   Status: ${owner.status || '—'}   |   Last updated: ${owner.lastUpdated || '—'}`, { size: 9, color: rgb(0.4, 0.4, 0.4), lineH: 12 });
        y -= 4;

        const labels = isCorp ? CORPORATE_LABELS : MEMBER_LABELS;
        for (const [key, label] of Object.entries(labels)) {
          const val = owner[key];
          if (!val && val !== 0) continue;
          ensurePage(30);
          page.drawText(sanitizePdfText(`${label}:`), { x: MARGIN + 4, y, font: bold, size: 8.5, color: rgb(0.25, 0.25, 0.25) });
          y -= 10;
          const valLines = wrapText(sanitizePdfText(String(val)), MAX_W - 10, font, 9);
          for (const vl of valLines) {
            ensurePage(20);
            page.drawText(vl, { x: MARGIN + 10, y, font, size: 9, color: rgb(0.15, 0.15, 0.15) });
            y -= 10;
          }
          y -= 2;
        }
        y -= 10;
      }

      // Signature block
      ensurePage(80);
      page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.8) });
      y -= 14;
      drawText('Signature Block', { useFont: bold, size: 10, color: rgb(0.2, 0.3, 0.5), lineH: 14 });
      drawText('Authorised signatory: ___________________________________    Date: _______________', { size: 10, lineH: 14 });
      drawText('After signing, upload this document via the UAE Trade Registry section.', { size: 8, color: rgb(0.4, 0.4, 0.4) });
    }

    const pdfBytes = await doc.save();
    const safeOpco = (opco || 'OpCo').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `UBO_Record_${safeOpco}_${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(pdfBytes));
  } catch (e) {
    res.status(500).json({ error: e.message || 'UBO record generation failed' });
  }
});
