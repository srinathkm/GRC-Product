/**
 * generate-test-document-pdfs.mjs
 * ================================
 * Reads every .txt in docs/test-data/SKM_LLC_Test_Documents.zip,
 * converts each to a properly-formatted PDF (preserving layout),
 * and outputs a new docs/test-data/SKM_LLC_Test_Documents.zip
 * containing the same folder structure with .pdf files.
 *
 * Usage: node server/scripts/generate-test-document-pdfs.mjs
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createWriteStream, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { dirname, join, relative, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const ZIP_IN    = join(REPO_ROOT, 'docs', 'test-data', 'SKM_LLC_Test_Documents.zip');
const WORK_DIR  = join(REPO_ROOT, 'docs', 'test-data', '_pdf_build');
const OUT_DIR   = join(WORK_DIR, 'SKM_LLC_Test_Documents');  // matches zip root folder
const ZIP_OUT   = join(REPO_ROOT, 'docs', 'test-data', 'SKM_LLC_Test_Documents.zip');

// ── PDF layout constants (A4 portrait) ────────────────────────────────────────
const PAGE_W   = 595;
const PAGE_H   = 842;
const MARGIN   = 45;
const FONT_SZ  = 8.5;          // Courier at this size → ~98 chars/line
const LINE_H   = FONT_SZ * 1.45;
const MAX_W    = PAGE_W - MARGIN * 2;

// ── Sanitise text: strip non-latin-1 chars pdf-lib can't embed ───────────────
function sanitize(str) {
  return str
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Replace fancy Unicode dashes / bullets with ASCII equivalents
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u2022/g, '*')
    .replace(/\u2019/g, "'")
    .replace(/[^\x20-\x7E\n\t]/g, ' ');
}

// ── Wrap a single logical line to fit MAX_W at current font/size ──────────────
function wrapLine(text, font, size, maxWidth) {
  const width = (s) => font.widthOfTextAtSize(s, size);
  if (width(text) <= maxWidth) return [text];

  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const word of words) {
    const candidate = cur ? `${cur} ${word}` : word;
    if (width(candidate) <= maxWidth) {
      cur = candidate;
    } else {
      if (cur) lines.push(cur);
      // If the single word is too long, hard-split it
      if (width(word) > maxWidth) {
        let chunk = '';
        for (const ch of word) {
          if (width(chunk + ch) > maxWidth) { lines.push(chunk); chunk = ch; }
          else chunk += ch;
        }
        cur = chunk;
      } else {
        cur = word;
      }
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ── Detect whether a raw line is a "heading" (ALL-CAPS short line, or === line)
function isHeading(raw) {
  const t = raw.trim();
  if (!t) return false;
  if (/^[=\-─]+$/.test(t)) return false;  // separator lines are not headings
  if (/^ARTICLE\s+\d+/i.test(t)) return true;
  if (/^SCHEDULE\s+/i.test(t)) return true;
  if (/^SECTION\s+/i.test(t)) return true;
  return false;
}

// ── Build a PDF from plain text content ──────────────────────────────────────
async function txtToPdf(content, docTitle) {
  const doc      = await PDFDocument.create();
  const font     = await doc.embedFont(StandardFonts.Courier);
  const fontBold = await doc.embedFont(StandardFonts.CourierBold);

  doc.setTitle(docTitle);
  doc.setCreator('SKM LLC – GRC Test Document Pack');
  doc.setProducer('pdf-lib / GRC Platform');

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y    = PAGE_H - MARGIN;
  let pageNum = 1;

  function addPage() {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y    = PAGE_H - MARGIN;
    pageNum++;
  }

  function ensureSpace(needed) {
    if (y - needed < MARGIN) addPage();
  }

  // Draw a subtle watermark on each page after creation
  function drawWatermark(pg) {
    pg.drawText('SPECIMEN – TEST DATA ONLY', {
      x: 90, y: 30,
      size: 7,
      font,
      color: rgb(0.7, 0.7, 0.7),
    });
  }

  const rawLines = sanitize(content).split('\n');

  for (const raw of rawLines) {
    const isBlank     = raw.trim() === '';
    const isSeparator = /^[=\-─*]{4,}/.test(raw.trim());
    const heading     = isHeading(raw);

    if (isBlank) {
      y -= LINE_H * 0.5;
      if (y < MARGIN) addPage();
      continue;
    }

    if (isSeparator) {
      ensureSpace(LINE_H);
      // Draw as a thin rule
      page.drawLine({
        start: { x: MARGIN, y: y - 2 },
        end:   { x: PAGE_W - MARGIN, y: y - 2 },
        thickness: 0.5,
        color: rgb(0.5, 0.5, 0.5),
      });
      y -= LINE_H * 0.7;
      continue;
    }

    const useFont = heading ? fontBold : font;
    const size    = heading ? FONT_SZ + 0.5 : FONT_SZ;
    const wrapped = wrapLine(raw, useFont, size, MAX_W);

    for (const wl of wrapped) {
      ensureSpace(LINE_H);
      page.drawText(wl, {
        x: MARGIN,
        y,
        size,
        font: useFont,
        color: rgb(0.05, 0.05, 0.05),
      });
      y -= LINE_H;
    }
  }

  // Stamp watermark on every page
  for (const pg of doc.getPages()) drawWatermark(pg);

  return await doc.save();
}

// ── Recursively gather all files under a directory ────────────────────────────
function walk(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) results.push(...walk(full));
    else results.push(full);
  }
  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n  Generating PDFs from SKM LLC test document pack...\n');

  // Clean + create work dir
  rmSync(WORK_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  // Extract source zip
  const TXT_SRC = join(WORK_DIR, '_txt');
  mkdirSync(TXT_SRC, { recursive: true });
  execSync(`unzip -q "${ZIP_IN}" -d "${TXT_SRC}"`, { stdio: 'inherit' });

  // Find all files (txt + README)
  const allFiles = walk(TXT_SRC);
  const txtFiles = allFiles.filter(f => f.endsWith('.txt') && !basename(f).startsWith('.'));

  for (const src of txtFiles) {
    // Determine relative path under the zip root folder
    const rel       = relative(join(TXT_SRC, 'SKM_LLC_Test_Documents'), src);
    const pdfRel    = rel.replace(/\.txt$/, '.pdf');
    const destPath  = join(OUT_DIR, pdfRel);
    const destDir   = dirname(destPath);
    const docTitle  = basename(pdfRel, '.pdf').replace(/_/g, ' ');

    mkdirSync(destDir, { recursive: true });

    const content  = readFileSync(src, 'utf8');
    const pdfBytes = await txtToPdf(content, docTitle);
    writeFileSync(destPath, pdfBytes);

    const kb = (pdfBytes.length / 1024).toFixed(1);
    console.log(`  ✓  ${pdfRel}  (${kb} KB)`);
  }

  // Repack as zip (from inside WORK_DIR so paths inside zip match)
  const zipTmp = join(WORK_DIR, 'out.zip');
  execSync(`cd "${WORK_DIR}" && zip -r "${zipTmp}" "SKM_LLC_Test_Documents"`, { stdio: 'inherit' });

  // Overwrite the original zip
  execSync(`cp "${zipTmp}" "${ZIP_OUT}"`);

  // Cleanup
  rmSync(WORK_DIR, { recursive: true, force: true });

  console.log(`\n  Done — ${txtFiles.length} PDFs written to ${ZIP_OUT}\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
