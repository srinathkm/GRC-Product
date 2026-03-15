/**
 * boardpack.js
 *
 * POST /api/board-pack
 *
 * Generates a Board Compliance Pack PDF — a concise, decision-focused document
 * written for Board members.  The pack covers:
 *   1. Executive Summary
 *   2. Compliance Health
 *   3. Risk Indicators
 *   4. Decisions Required  (upcoming expiry / renewal)
 *   5. Financial & Operational Exposure
 *   6. Regulatory Highlights  (key changes in period)
 *
 * All data is sourced from the same flat-file stores as the Management Dashboard.
 * When an `opco` is supplied the pack is scoped to that entity.
 */

import { Router } from 'express';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const paths = {
  changes:     join(__dirname, '../data/changes.json'),
  companies:   join(__dirname, '../data/companies.json'),
  onboarding:  join(__dirname, '../data/onboarding-opcos.json'),
  poa:         join(__dirname, '../data/poa.json'),
  ip:          join(__dirname, '../data/ip.json'),
  licences:    join(__dirname, '../data/licences.json'),
  litigations: join(__dirname, '../data/litigations.json'),
  contracts:   join(__dirname, '../data/contracts.json'),
  tasks:       join(__dirname, '../data/tasks.json'),
  esg:         join(__dirname, '../data/esg-metrics.json'),
};

async function safeRead(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf-8')) ?? fallback; }
  catch { return fallback; }
}

// ── date helpers ──────────────────────────────────────────────────────────────

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return Math.ceil((d - new Date()) / 86400000);
}

function isExpired(dateStr) {
  const du = daysUntil(dateStr);
  return du !== null && du < 0;
}

function isWithinDays(dateStr, days) {
  const d = new Date(dateStr);
  if (isNaN(d)) return false;
  const now = new Date();
  const from = new Date(now); from.setDate(from.getDate() - days);
  return d >= from && d <= now;
}

function isExpiringWithin(dateStr, days) {
  const du = daysUntil(dateStr);
  return du !== null && du >= 0 && du <= days;
}

function normalizeDates(data) {
  if (!Array.isArray(data) || data.length === 0) return data;
  const now = new Date();
  const latest = new Date(Math.max(...data.map(c => new Date(c.date || 0).getTime())));
  const daysAgo = (now - latest) / 86400000;
  if (daysAgo <= 1) return data;
  const shift = Math.min(Math.floor(daysAgo) - 1, 365);
  return data.map(c => {
    const d = new Date(c.date); d.setDate(d.getDate() + shift);
    return { ...c, date: d.toISOString().slice(0, 10) };
  });
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── PDF helpers ───────────────────────────────────────────────────────────────

/** Strip characters that break pdf-lib StandardFonts (keep ASCII printable). */
function s(str) {
  if (str == null) return '';
  return String(str)
    .replace(/[\r\n]+/g, ' ')
    .replace(/[^\x20-\x7E]/g, ' ')
    .trim();
}

function wrapText(text, maxWidth, font, size) {
  const words = s(text).split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line); line = w;
    } else { line = test; }
  }
  if (line) lines.push(line);
  return lines;
}

// ── palette ───────────────────────────────────────────────────────────────────

const C = {
  navy:    rgb(0.07, 0.13, 0.22),   // #121f38 deep board dark
  accent:  rgb(0.14, 0.36, 0.70),   // #234fb3 board blue
  white:   rgb(1, 1, 1),
  offWhite:rgb(0.97, 0.97, 0.98),
  text:    rgb(0.13, 0.14, 0.18),
  muted:   rgb(0.42, 0.45, 0.52),
  border:  rgb(0.82, 0.84, 0.88),
  red:     rgb(0.86, 0.21, 0.21),
  amber:   rgb(0.85, 0.54, 0.04),
  green:   rgb(0.10, 0.57, 0.32),
  lightBlue: rgb(0.92, 0.95, 1.0),
};

const PAGE_W = 595;
const PAGE_H = 842;
const M = 48;          // margin
const CW = PAGE_W - M * 2;
const HEADER_H = 52;
const FOOTER_H = 30;
const BODY_TOP = PAGE_H - HEADER_H - 18;
const BODY_BOT = FOOTER_H + 16;

// ── PDF document factory ──────────────────────────────────────────────────────

async function buildBoardPack(payload) {
  const {
    opco = '',
    parentHolding = '',
    periodDays = 30,
    reportTitle = 'Board Compliance Pack',
  } = payload;

  const opcoLower = opco ? opco.toLowerCase() : null;
  const today = new Date();
  const todayStr = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const periodLabel = periodDays === 30 ? '30 days' : periodDays === 180 ? '6 months' : '1 year';
  const entityLabel = opco || parentHolding || 'All Holdings';

  // ── load data ───────────────────────────────────────────────────────────────
  const [changesRaw, companies, onboarding, poaAll, ipAll, licAll, litAll, contractsAll, tasksAll] =
    await Promise.all([
      safeRead(paths.changes, []),
      safeRead(paths.companies, {}),
      safeRead(paths.onboarding, []),
      safeRead(paths.poa, []),
      safeRead(paths.ip, []),
      safeRead(paths.licences, []),
      safeRead(paths.litigations, []),
      safeRead(paths.contracts, []),
      safeRead(paths.tasks, []),
    ]);

  const allChanges = normalizeDates(changesRaw);

  // ── resolve opco frameworks ─────────────────────────────────────────────────
  let opcoFwSet = null;
  if (opcoLower) {
    opcoFwSet = new Set();
    for (const [fw, entries] of Object.entries(companies)) {
      if (!Array.isArray(entries)) continue;
      for (const e of entries) {
        if ((e.companies || []).some(c => c && c.toLowerCase() === opcoLower)) opcoFwSet.add(fw);
      }
    }
    for (const row of onboarding) {
      if (!row.opco || row.opco.toLowerCase() !== opcoLower) continue;
      for (const fw of row.applicableFrameworks || []) opcoFwSet.add(fw);
      for (const pair of row.applicableFrameworksByLocation || []) { if (pair.framework) opcoFwSet.add(pair.framework); }
    }
    opcoFwSet.delete('Onboarded');
  }

  // ── filter records by opco ──────────────────────────────────────────────────
  const changes   = opcoFwSet ? allChanges.filter(c => opcoFwSet.has(c.framework)) : allChanges;
  const filter    = r => !opcoLower || (r.opco && r.opco.toLowerCase() === opcoLower);
  const poa       = poaAll.filter(filter);
  const licences  = licAll.filter(filter);
  const lits      = litAll.filter(filter);
  const contracts = contractsAll.filter(filter);
  const tasks     = tasksAll.filter(filter);

  // ── compute KPIs ────────────────────────────────────────────────────────────
  const recent   = changes.filter(c => isWithinDays(c.date, periodDays));
  const critical = recent.filter(c => { const du = daysUntil(c.deadline); return du !== null && du <= 90; });
  const overdue  = recent.filter(c => isExpired(c.deadline));

  const activePoa       = poa.filter(p => !p.revoked);
  const activeLic       = licences.filter(l => !['Revoked','Cancelled'].includes(l.status));
  const activeCon       = contracts.filter(c => c.status === 'Active' || !c.status);
  const activeLit       = lits.filter(l => !['Closed','Settled','Dismissed'].includes(l.status));
  const highRiskLit     = activeLit.filter(l => l.riskLevel === 'High' || l.riskLevel === 'Critical');

  const expiringPoa = activePoa.filter(p => isExpiringWithin(p.validUntil, 90));
  const expiringLic = activeLic.filter(l => isExpiringWithin(l.expiryDate, 90));
  const expiringCon = activeCon.filter(c => isExpiringWithin(c.expiryDate, 90));

  const expiredPoa = activePoa.filter(p => isExpired(p.validUntil));
  const expiredLic = activeLic.filter(l => isExpired(l.expiryDate));

  const openTasks    = tasks.filter(t => t.status === 'open' || t.status === 'in-progress');
  const overdueTasks = openTasks.filter(t => isExpired(t.dueDate));

  // Compliance health (mirrors dashboard formula)
  const total       = recent.length || 1;
  const critPct     = critical.length / total;
  const expiryRisk  = expiringPoa.length + expiringLic.length + expiringCon.length;
  const expiryTotal = (activePoa.length + activeLic.length + activeCon.length) || 1;
  const expiryPct   = expiryRisk / expiryTotal;
  const healthScore = Math.max(0, Math.min(100, Math.round(100 - critPct * 40 - expiryPct * 30 - (overdue.length / total) * 30)));
  const healthLabel = healthScore >= 80 ? 'HEALTHY' : healthScore >= 65 ? 'COMPLIANT' : healthScore >= 40 ? 'DEVELOPING' : 'CRITICAL';
  const healthColor = healthScore >= 80 ? C.green : healthScore >= 65 ? C.accent : healthScore >= 40 ? C.amber : C.red;

  // Top 5 upcoming expiry items (for decisions section)
  const upcomingItems = [
    ...expiringPoa.map(p => ({ type: 'POA',      name: p.holderName || '—', opco: p.opco || '—', date: p.validUntil,  days: daysUntil(p.validUntil) })),
    ...expiringLic.map(l => ({ type: 'Licence',  name: l.licenceType || l.licenceName || '—', opco: l.opco || '—', date: l.expiryDate, days: daysUntil(l.expiryDate) })),
    ...expiringCon.map(c => ({ type: 'Contract', name: c.title || c.contractId || '—', opco: c.opco || '—', date: c.expiryDate, days: daysUntil(c.expiryDate) })),
  ].filter(x => x.days !== null).sort((a, b) => a.days - b.days).slice(0, 6);

  // Top regulatory highlights (most recent + critical first)
  const highlights = [...recent]
    .sort((a, b) => {
      const aScore = (a.deadline && daysUntil(a.deadline) !== null && daysUntil(a.deadline) <= 90) ? 2 : 0;
      const bScore = (b.deadline && daysUntil(b.deadline) !== null && daysUntil(b.deadline) <= 90) ? 2 : 0;
      return (bScore - aScore) || (new Date(b.date) - new Date(a.date));
    })
    .slice(0, 6);

  // Framework breakdown
  const fwCounts = {};
  recent.forEach(c => { fwCounts[c.framework || 'Other'] = (fwCounts[c.framework || 'Other'] || 0) + 1; });
  const topFws = Object.entries(fwCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);

  // ── build PDF ────────────────────────────────────────────────────────────────
  const doc  = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ital = await doc.embedFont(StandardFonts.HelveticaOblique);

  let pageCount = 0;

  function addPage() {
    const p = doc.addPage([PAGE_W, PAGE_H]);
    pageCount++;

    // Header bar
    p.drawRectangle({ x: 0, y: PAGE_H - HEADER_H, width: PAGE_W, height: HEADER_H, color: C.navy });
    p.drawRectangle({ x: 0, y: PAGE_H - HEADER_H - 2, width: PAGE_W, height: 2, color: C.accent });
    // Branding
    p.drawText('RAQIB', { x: M, y: PAGE_H - 32, font: bold, size: 14, color: C.accent });
    p.drawText('Compliance Intelligence', { x: M + 58, y: PAGE_H - 32, font, size: 8, color: rgb(0.7, 0.78, 0.9) });
    // Classification badge
    const cls = 'CONFIDENTIAL  |  BOARD ONLY';
    const clsW = font.widthOfTextAtSize(cls, 7);
    p.drawRectangle({ x: PAGE_W - M - clsW - 10, y: PAGE_H - HEADER_H + 8, width: clsW + 10, height: 16, color: rgb(0.85, 0.15, 0.15) });
    p.drawText(cls, { x: PAGE_W - M - clsW - 5, y: PAGE_H - HEADER_H + 14, font: bold, size: 7, color: C.white });

    // Footer
    p.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: FOOTER_H, color: C.navy });
    p.drawText('Prepared by Raqib · For Board use only · Not for external distribution', { x: M, y: 10, font: ital, size: 6.5, color: rgb(0.55, 0.62, 0.75) });
    const pg = `Page ${pageCount}`;
    p.drawText(pg, { x: PAGE_W - M - font.widthOfTextAtSize(pg, 7), y: 10, font, size: 7, color: rgb(0.55, 0.62, 0.75) });

    return p;
  }

  // Helper: draw a section heading bar
  function drawSectionHeading(page, y, title) {
    page.drawRectangle({ x: M, y: y - 14, width: CW, height: 22, color: C.navy });
    page.drawRectangle({ x: M, y: y - 14, width: 3, height: 22, color: C.accent });
    page.drawText(s(title).toUpperCase(), { x: M + 10, y: y - 5, font: bold, size: 8.5, color: C.white });
    return y - 28;
  }

  // Helper: draw a thin horizontal rule
  function drawRule(page, y, light = false) {
    page.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 0.4, color: light ? C.border : C.muted });
    return y - 8;
  }

  // Helper: draw a label + value row
  function drawRow(page, y, label, value, valueColor = C.text, labelWidth = 220) {
    page.drawText(s(label), { x: M, y, font, size: 8.5, color: C.muted });
    page.drawText(s(value), { x: M + labelWidth, y, font: bold, size: 8.5, color: valueColor });
    return y - 14;
  }

  // Helper: wrapping body text paragraph
  function drawParagraph(page, y, text, lineH = 12, fontSize = 8.5, color = C.text) {
    const lines = wrapText(text, CW, font, fontSize);
    for (const ln of lines) {
      if (y < BODY_BOT) return y;
      page.drawText(s(ln), { x: M, y, font, size: fontSize, color });
      y -= lineH;
    }
    return y;
  }

  // Helper: small stat box
  function drawStatBox(page, x, y, w, h, value, label, valueColor = C.accent) {
    page.drawRectangle({ x, y, width: w, height: h, color: C.lightBlue });
    page.drawRectangle({ x, y: y + h - 2, width: w, height: 2, color: valueColor });
    const vw = bold.widthOfTextAtSize(s(value), 18);
    const lw = font.widthOfTextAtSize(s(label), 7);
    page.drawText(s(value), { x: x + (w - vw) / 2, y: y + h - 26, font: bold, size: 18, color: valueColor });
    page.drawText(s(label), { x: x + (w - lw) / 2, y: y + 8, font, size: 7, color: C.muted });
  }

  // Helper: risk pill inline
  function drawRiskPill(page, x, y, level) {
    const colors = { High: C.red, Critical: C.red, Medium: C.amber, Low: C.green };
    const color = colors[level] || C.muted;
    const lbl = s(level || 'Unknown');
    const w = bold.widthOfTextAtSize(lbl, 6.5) + 8;
    page.drawRectangle({ x, y: y - 1, width: w, height: 12, color: rgb(color.red * 0.15 + 0.85, color.green * 0.15 + 0.85, color.blue * 0.15 + 0.85) });
    page.drawText(lbl, { x: x + 4, y: y + 2, font: bold, size: 6.5, color });
    return w + 4;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // COVER PAGE
  // ════════════════════════════════════════════════════════════════════════════
  let page = addPage();

  // Full-bleed cover graphic
  page.drawRectangle({ x: 0, y: 320, width: PAGE_W, height: 280, color: C.navy });
  page.drawRectangle({ x: 0, y: 596, width: PAGE_W, height: 4, color: C.accent });
  page.drawRectangle({ x: 0, y: 316, width: PAGE_W, height: 4, color: C.accent });

  // Decorative vertical stripe
  page.drawRectangle({ x: M - 12, y: 320, width: 4, height: 280, color: C.accent });

  // Document type label
  page.drawText('BOARD COMPLIANCE DOCUMENT', { x: M, y: 570, font, size: 8, color: rgb(0.6, 0.72, 0.9) });

  // Report title (large)
  const titleLines = wrapText(reportTitle, CW - 30, bold, 26);
  let tY = 546;
  for (const ln of titleLines) {
    page.drawText(s(ln), { x: M, y: tY, font: bold, size: 26, color: C.white });
    tY -= 32;
  }

  // Entity + period
  page.drawText(s(entityLabel), { x: M, y: tY - 4, font: bold, size: 13, color: C.accent });
  page.drawText(`Reporting Period: Last ${periodLabel}`, { x: M, y: tY - 22, font, size: 10, color: rgb(0.75, 0.82, 0.95) });
  page.drawText(`Date of Issue: ${todayStr}`, { x: M, y: tY - 38, font, size: 9, color: rgb(0.60, 0.68, 0.82) });

  // KPI summary strip on cover (4 boxes)
  const boxW = 120; const boxH = 66; const boxGap = 9;
  const boxStartX = M;
  const boxY = 230;

  const coverKpis = [
    { value: String(healthScore), label: 'Compliance Health Score', color: healthColor },
    { value: String(recent.length), label: `Regulatory Events (${periodLabel})`, color: C.accent },
    { value: String(critical.length + overdue.length), label: 'Items Needing Action', color: critical.length + overdue.length > 0 ? C.red : C.green },
    { value: String(expiringPoa.length + expiringLic.length + expiringCon.length), label: 'Expiring in 90 Days', color: expiryRisk > 0 ? C.amber : C.green },
  ];

  coverKpis.forEach((kpi, i) => {
    drawStatBox(page, boxStartX + i * (boxW + boxGap), boxY, boxW, boxH, kpi.value, kpi.label, kpi.color);
  });

  // Classification notice
  page.drawRectangle({ x: M, y: 170, width: CW, height: 36, color: rgb(0.86, 0.21, 0.21) });
  const classLine1 = 'CONFIDENTIAL — FOR BOARD MEMBERS ONLY';
  const classLine2 = 'This document contains material non-public information. Do not circulate outside of the Board.';
  const cl1W = bold.widthOfTextAtSize(classLine1, 9);
  page.drawText(classLine1, { x: M + (CW - cl1W) / 2, y: 196, font: bold, size: 9, color: C.white });
  const cl2Lines = wrapText(classLine2, CW - 20, font, 7);
  let cl2Y = 182;
  for (const ln of cl2Lines) {
    const lw = font.widthOfTextAtSize(ln, 7);
    page.drawText(s(ln), { x: M + (CW - lw) / 2, y: cl2Y, font, size: 7, color: rgb(1, 0.85, 0.85) });
    cl2Y -= 10;
  }

  // Table of contents
  const tocItems = [
    '1. Executive Summary',
    '2. Compliance Health Overview',
    '3. Risk Indicators',
    '4. Decisions Required',
    '5. Financial & Operational Exposure',
    '6. Regulatory Highlights',
  ];
  let tocY = 152;
  page.drawText('CONTENTS', { x: M, y: tocY, font: bold, size: 7.5, color: C.muted });
  tocY -= 12;
  page.drawLine({ start: { x: M, y: tocY }, end: { x: PAGE_W - M, y: tocY }, thickness: 0.3, color: C.border });
  tocY -= 12;
  tocItems.forEach(item => {
    page.drawText(s(item), { x: M, y: tocY, font, size: 8, color: C.text });
    tocY -= 12;
  });

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 2 — EXECUTIVE SUMMARY
  // ════════════════════════════════════════════════════════════════════════════
  page = addPage();
  let y = BODY_TOP;

  y = drawSectionHeading(page, y, '1. Executive Summary');
  y -= 6;

  // Board narrative — concise, value-focused paragraphs
  const narrative1 = `The compliance health score for ${entityLabel} stands at ${healthScore}/100 (${healthLabel}) for the period covering the last ${periodLabel} to ${todayStr}. During this period, ${recent.length} regulatory event${recent.length !== 1 ? 's were' : ' was'} recorded across ${topFws.length} active framework${topFws.length !== 1 ? 's' : ''}.`;
  y = drawParagraph(page, y, narrative1, 13, 9);
  y -= 8;

  const narrative2 = `${critical.length} event${critical.length !== 1 ? 's carry' : ' carries'} an upcoming compliance deadline within 90 days, and ${overdue.length} item${overdue.length !== 1 ? 's are' : ' is'} overdue — these represent the most time-sensitive obligations and require Board awareness. ${expiryRisk} legal instrument${expiryRisk !== 1 ? 's are' : ' is'} expiring within 90 days, including POAs, licences, and contracts.`;
  y = drawParagraph(page, y, narrative2, 13, 9);
  y -= 8;

  if (highRiskLit.length > 0) {
    const narrative3 = `The litigation portfolio contains ${activeLit.length} active matter${activeLit.length !== 1 ? 's' : ''}, of which ${highRiskLit.length} ${highRiskLit.length !== 1 ? 'are' : 'is'} rated High or Critical risk. The Board should note that these matters may carry financial exposure and reputational implications.`;
    y = drawParagraph(page, y, narrative3, 13, 9);
    y -= 8;
  }

  const boardNote = overdue.length > 0
    ? `Board Action: ${overdue.length} compliance deadline${overdue.length !== 1 ? 's have' : ' has'} passed without resolution. Management should present a remediation plan at the next Board meeting.`
    : `No compliance deadlines are currently overdue. The Board is encouraged to continue monitoring the ${critical.length} item${critical.length !== 1 ? 's' : ''} approaching deadline within 90 days.`;

  y -= 4;
  page.drawRectangle({ x: M, y: y - 18, width: CW, height: overdue.length > 0 ? 32 : 28, color: overdue.length > 0 ? rgb(0.98, 0.93, 0.93) : rgb(0.93, 0.98, 0.93) });
  page.drawRectangle({ x: M, y: y - 18, width: 3, height: overdue.length > 0 ? 32 : 28, color: overdue.length > 0 ? C.red : C.green });
  const noteLines = wrapText(boardNote, CW - 12, bold, 8.5);
  for (const ln of noteLines) {
    page.drawText(s(ln), { x: M + 8, y, font: bold, size: 8.5, color: overdue.length > 0 ? C.red : C.green });
    y -= 12;
  }
  y -= 16;

  // Key Metrics table
  y = drawSectionHeading(page, y, '2. Compliance Health Overview');
  y -= 8;

  const metricsData = [
    ['Compliance Health Score', `${healthScore} / 100 — ${healthLabel}`, healthColor],
    ['Regulatory Events This Period', `${recent.length} events across ${topFws.length} frameworks`, C.text],
    ['Critical Deadline Items (≤90d)', `${critical.length}`, critical.length > 0 ? C.red : C.green],
    ['Overdue Compliance Items', `${overdue.length}`, overdue.length > 0 ? C.red : C.green],
    ['Active POA Records', `${activePoa.length} (${expiredPoa.length} expired, ${expiringPoa.length} expiring ≤90d)`, expiringPoa.length + expiredPoa.length > 0 ? C.amber : C.text],
    ['Active Licences', `${activeLic.length} (${expiredLic.length} expired, ${expiringLic.length} expiring ≤90d)`, expiringLic.length + expiredLic.length > 0 ? C.amber : C.text],
    ['Active Contracts', `${activeCon.length} (${expiringCon.length} expiring ≤90d)`, expiringCon.length > 0 ? C.amber : C.text],
    ['Active Litigations', `${activeLit.length} (${highRiskLit.length} high/critical risk)`, highRiskLit.length > 0 ? C.red : C.text],
    ['Open Compliance Tasks', `${openTasks.length} (${overdueTasks.length} overdue)`, overdueTasks.length > 0 ? C.amber : C.text],
  ];

  for (let i = 0; i < metricsData.length; i++) {
    const [label, value, color] = metricsData[i];
    const rowBg = i % 2 === 0 ? C.offWhite : C.white;
    page.drawRectangle({ x: M, y: y - 10, width: CW, height: 18, color: rowBg });
    page.drawText(s(label), { x: M + 8, y: y - 2, font, size: 8, color: C.muted });
    page.drawText(s(value), { x: M + 240, y: y - 2, font: bold, size: 8, color });
    y -= 18;
  }

  // Framework activity bar (mini)
  if (topFws.length > 0) {
    y -= 14;
    if (y < BODY_BOT + 80) { page = addPage(); y = BODY_TOP; }
    page.drawText('FRAMEWORK ACTIVITY THIS PERIOD', { x: M, y, font: bold, size: 7.5, color: C.muted });
    y -= 14;
    const maxCount = Math.max(...topFws.map(([, n]) => n), 1);
    const barTrackW = CW - 140;
    for (const [fw, count] of topFws) {
      if (y < BODY_BOT) break;
      page.drawText(s(fw), { x: M, y, font, size: 7.5, color: C.text });
      const barW = Math.round((count / maxCount) * barTrackW);
      page.drawRectangle({ x: M + 140, y: y - 1, width: barTrackW, height: 10, color: rgb(0.92, 0.94, 0.97) });
      page.drawRectangle({ x: M + 140, y: y - 1, width: Math.max(barW, 4), height: 10, color: C.accent });
      page.drawText(String(count), { x: M + 140 + barW + 4, y, font: bold, size: 7.5, color: C.text });
      y -= 14;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 3 — RISK INDICATORS
  // ════════════════════════════════════════════════════════════════════════════
  page = addPage();
  y = BODY_TOP;
  y = drawSectionHeading(page, y, '3. Risk Indicators');
  y -= 6;

  const riskIntro = `The following indicators represent the most material compliance risks to ${entityLabel}. Items highlighted in red demand immediate management attention; amber items should be tracked through the next reporting cycle.`;
  y = drawParagraph(page, y, riskIntro, 13, 8.5, C.muted);
  y -= 12;

  // ── Overdue items ────────────────────────────────────────────────────────────
  page.drawText('OVERDUE REGULATORY OBLIGATIONS', { x: M, y, font: bold, size: 8, color: C.red });
  y -= 14;
  if (overdue.length === 0) {
    page.drawText('No overdue obligations identified in the current dataset.', { x: M, y, font: ital, size: 8, color: C.muted });
    y -= 16;
  } else {
    for (const c of overdue.slice(0, 5)) {
      if (y < BODY_BOT + 20) break;
      page.drawRectangle({ x: M, y: y - 10, width: CW, height: 20, color: rgb(0.99, 0.94, 0.94) });
      page.drawRectangle({ x: M, y: y - 10, width: 3, height: 20, color: C.red });
      const title = wrapText(c.title || 'Untitled', CW - 200, bold, 8)[0] || '';
      page.drawText(s(`${c.framework || '—'}: ${title}`), { x: M + 8, y, font: bold, size: 8, color: C.red });
      page.drawText(`Deadline passed: ${fmtDate(c.deadline)}`, { x: PAGE_W - M - 160, y, font, size: 7.5, color: C.red });
      y -= 24;
    }
  }
  y -= 6;

  // ── Critical upcoming deadlines ──────────────────────────────────────────────
  page.drawText('CRITICAL UPCOMING DEADLINES  (≤90 DAYS)', { x: M, y, font: bold, size: 8, color: C.amber });
  y -= 14;
  if (critical.length === 0) {
    page.drawText('No critical deadlines within 90 days.', { x: M, y, font: ital, size: 8, color: C.muted });
    y -= 16;
  } else {
    for (const c of critical.slice(0, 5)) {
      if (y < BODY_BOT + 20) break;
      const du = daysUntil(c.deadline);
      const rowColor = du <= 30 ? rgb(0.99, 0.96, 0.91) : rgb(0.97, 0.98, 1.0);
      page.drawRectangle({ x: M, y: y - 10, width: CW, height: 20, color: rowColor });
      page.drawRectangle({ x: M, y: y - 10, width: 3, height: 20, color: du <= 30 ? C.amber : C.accent });
      const title2 = wrapText(c.title || 'Untitled', CW - 200, bold, 8)[0] || '';
      page.drawText(s(`${c.framework || '—'}: ${title2}`), { x: M + 8, y, font: bold, size: 8, color: C.text });
      page.drawText(`Due: ${fmtDate(c.deadline)}  (${du}d)`, { x: PAGE_W - M - 150, y, font, size: 7.5, color: du <= 30 ? C.amber : C.muted });
      y -= 24;
    }
  }
  y -= 8;

  // ── Litigation risk ──────────────────────────────────────────────────────────
  y = drawRule(page, y);
  page.drawText('ACTIVE LITIGATION RISK', { x: M, y, font: bold, size: 8, color: C.text });
  y -= 14;
  if (activeLit.length === 0) {
    page.drawText('No active litigations on record.', { x: M, y, font: ital, size: 8, color: C.muted });
    y -= 16;
  } else {
    // Column headers
    page.drawText('Matter', { x: M, y, font: bold, size: 7.5, color: C.muted });
    page.drawText('OpCo', { x: M + 200, y, font: bold, size: 7.5, color: C.muted });
    page.drawText('Status', { x: M + 300, y, font: bold, size: 7.5, color: C.muted });
    page.drawText('Risk', { x: M + 380, y, font: bold, size: 7.5, color: C.muted });
    y -= 10;
    page.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 0.3, color: C.border });
    y -= 10;
    for (const l of activeLit.slice(0, 6)) {
      if (y < BODY_BOT + 16) break;
      const matter = wrapText(l.caseTitle || l.matter || 'Unnamed matter', 190, font, 7.5)[0] || '';
      page.drawText(s(matter), { x: M, y, font, size: 7.5, color: C.text });
      page.drawText(s(l.opco || '—'), { x: M + 200, y, font, size: 7.5, color: C.text });
      page.drawText(s(l.status || '—'), { x: M + 300, y, font, size: 7.5, color: C.text });
      drawRiskPill(page, M + 380, y, l.riskLevel);
      y -= 14;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 4 — DECISIONS REQUIRED
  // ════════════════════════════════════════════════════════════════════════════
  page = addPage();
  y = BODY_TOP;
  y = drawSectionHeading(page, y, '4. Decisions Required');
  y -= 6;

  const decisionIntro = `The following legal instruments are expiring within 90 days. Each item requires a Board-sanctioned renewal decision or a documented rationale for non-renewal. Management should table these items for resolution.`;
  y = drawParagraph(page, y, decisionIntro, 13, 8.5, C.muted);
  y -= 12;

  if (upcomingItems.length === 0) {
    page.drawText('No instruments expiring within 90 days.', { x: M, y, font: ital, size: 9, color: C.muted });
    y -= 20;
  } else {
    // Column headers
    page.drawRectangle({ x: M, y: y - 12, width: CW, height: 20, color: C.navy });
    page.drawText('Type', { x: M + 6, y: y - 3, font: bold, size: 7.5, color: C.white });
    page.drawText('Instrument / Party', { x: M + 70, y: y - 3, font: bold, size: 7.5, color: C.white });
    page.drawText('OpCo', { x: M + 270, y: y - 3, font: bold, size: 7.5, color: C.white });
    page.drawText('Expiry Date', { x: M + 380, y: y - 3, font: bold, size: 7.5, color: C.white });
    page.drawText('Days Left', { x: M + 460, y: y - 3, font: bold, size: 7.5, color: C.white });
    y -= 24;

    for (let i = 0; i < upcomingItems.length; i++) {
      const item = upcomingItems[i];
      if (y < BODY_BOT + 18) break;
      const rowBg = i % 2 === 0 ? C.offWhite : C.white;
      page.drawRectangle({ x: M, y: y - 10, width: CW, height: 18, color: rowBg });
      const urgColor = item.days <= 14 ? C.red : item.days <= 30 ? C.amber : C.text;
      const typeColors = { POA: C.accent, Licence: rgb(0.3, 0.6, 0.3), Contract: C.amber };
      page.drawText(s(item.type), { x: M + 6, y: y - 2, font: bold, size: 7.5, color: typeColors[item.type] || C.text });
      const nameStr = wrapText(item.name, 190, font, 7.5)[0] || '';
      page.drawText(s(nameStr), { x: M + 70, y: y - 2, font, size: 7.5, color: C.text });
      page.drawText(s(item.opco), { x: M + 270, y: y - 2, font, size: 7.5, color: C.text });
      page.drawText(fmtDate(item.date), { x: M + 380, y: y - 2, font, size: 7.5, color: urgColor });
      page.drawText(s(`${item.days}d`), { x: M + 460, y: y - 2, font: bold, size: 7.5, color: urgColor });
      y -= 18;
    }
    y -= 8;
  }

  // Decision guidance box
  y -= 8;
  if (y > BODY_BOT + 60) {
    page.drawRectangle({ x: M, y: y - 42, width: CW, height: 52, color: rgb(0.94, 0.97, 1.0) });
    page.drawRectangle({ x: M, y: y - 42, width: 3, height: 52, color: C.accent });
    page.drawText('BOARD GUIDANCE', { x: M + 10, y: y - 4, font: bold, size: 8, color: C.accent });
    const guidanceText = `Each expiring instrument requires a formal renewal resolution or a documented Board decision to allow expiry. Management should prepare the necessary legal advice and renewal paperwork for Board approval. Allowing critical instruments to lapse without formal resolution may create legal and regulatory exposure.`;
    const gLines = wrapText(guidanceText, CW - 20, font, 7.5);
    let gY = y - 17;
    for (const ln of gLines.slice(0, 3)) {
      page.drawText(s(ln), { x: M + 10, y: gY, font, size: 7.5, color: C.text });
      gY -= 11;
    }
    y -= 60;
  }

  // Open overdue tasks
  if (overdueTasks.length > 0 && y > BODY_BOT + 40) {
    y -= 10;
    page.drawText(`OVERDUE COMPLIANCE TASKS  (${overdueTasks.length})`, { x: M, y, font: bold, size: 8, color: C.amber });
    y -= 14;
    for (const t of overdueTasks.slice(0, 4)) {
      if (y < BODY_BOT + 16) break;
      page.drawText(s(`• ${t.title || 'Unnamed task'} — assigned: ${t.assignedTo || 'unassigned'}, due: ${fmtDate(t.dueDate)}`), { x: M, y, font, size: 7.5, color: C.text });
      y -= 12;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 5 — FINANCIAL & OPERATIONAL EXPOSURE
  // ════════════════════════════════════════════════════════════════════════════
  page = addPage();
  y = BODY_TOP;
  y = drawSectionHeading(page, y, '5. Financial & Operational Exposure');
  y -= 6;

  const expIntro = `This section summarises the known financial and operational risk exposures as at ${todayStr}. These figures reflect the current data in Raqib and should be supplemented by legal counsel estimates for material matters.`;
  y = drawParagraph(page, y, expIntro, 13, 8.5, C.muted);
  y -= 12;

  // Litigation exposure table
  page.drawText('LITIGATION EXPOSURE', { x: M, y, font: bold, size: 8, color: C.text });
  y -= 14;

  if (activeLit.length === 0) {
    page.drawText('No active litigation matters recorded.', { x: M, y, font: ital, size: 8, color: C.muted });
    y -= 16;
  } else {
    page.drawRectangle({ x: M, y: y - 12, width: CW, height: 20, color: C.navy });
    page.drawText('Matter', { x: M + 6, y: y - 3, font: bold, size: 7.5, color: C.white });
    page.drawText('Jurisdiction', { x: M + 200, y: y - 3, font: bold, size: 7.5, color: C.white });
    page.drawText('Stage', { x: M + 310, y: y - 3, font: bold, size: 7.5, color: C.white });
    page.drawText('Risk Level', { x: M + 410, y: y - 3, font: bold, size: 7.5, color: C.white });
    y -= 24;
    for (let i = 0; i < Math.min(activeLit.length, 8); i++) {
      if (y < BODY_BOT + 18) break;
      const l = activeLit[i];
      const rowBg = i % 2 === 0 ? C.offWhite : C.white;
      page.drawRectangle({ x: M, y: y - 10, width: CW, height: 18, color: rowBg });
      const matter = wrapText(l.caseTitle || l.matter || 'Unnamed', 186, font, 7.5)[0] || '';
      page.drawText(s(matter), { x: M + 6, y: y - 2, font, size: 7.5, color: C.text });
      page.drawText(s(l.jurisdiction || l.court || '—'), { x: M + 200, y: y - 2, font, size: 7.5, color: C.text });
      page.drawText(s(l.stage || l.status || '—'), { x: M + 310, y: y - 2, font, size: 7.5, color: C.text });
      drawRiskPill(page, M + 410, y - 2, l.riskLevel);
      y -= 18;
    }
    y -= 8;
  }

  // Contracts at risk
  y -= 6;
  page.drawText(`CONTRACTS REQUIRING ATTENTION  (${expiringCon.length} expiring, ${activeCon.length} active total)`, { x: M, y, font: bold, size: 8, color: C.text });
  y -= 14;
  if (expiringCon.length === 0) {
    page.drawText('No contracts expiring within 90 days.', { x: M, y, font: ital, size: 8, color: C.muted });
    y -= 16;
  } else {
    for (let i = 0; i < Math.min(expiringCon.length, 5); i++) {
      if (y < BODY_BOT + 16) break;
      const c = expiringCon[i];
      const du = daysUntil(c.expiryDate);
      const urgColor = du !== null && du <= 30 ? C.red : C.amber;
      const rowBg = i % 2 === 0 ? C.offWhite : C.white;
      page.drawRectangle({ x: M, y: y - 10, width: CW, height: 18, color: rowBg });
      const title3 = wrapText(c.title || c.contractId || 'Unnamed', 200, font, 7.5)[0] || '';
      page.drawText(s(title3), { x: M + 6, y: y - 2, font, size: 7.5, color: C.text });
      page.drawText(s(c.opco || '—'), { x: M + 220, y: y - 2, font, size: 7.5, color: C.muted });
      page.drawText(`Expires: ${fmtDate(c.expiryDate)}`, { x: M + 340, y: y - 2, font, size: 7.5, color: urgColor });
      if (du !== null) page.drawText(`${du}d`, { x: M + 460, y: y - 2, font: bold, size: 7.5, color: urgColor });
      y -= 18;
    }
    y -= 8;
  }

  // Exposure summary box
  if (y > BODY_BOT + 52) {
    y -= 6;
    const exposureItems = [
      `Active litigations: ${activeLit.length}  |  High/Critical risk: ${highRiskLit.length}`,
      `Active contracts: ${activeCon.length}  |  Expiring ≤90d: ${expiringCon.length}`,
      `Active licences: ${activeLic.length}  |  Expired: ${expiredLic.length}  |  Expiring ≤90d: ${expiringLic.length}`,
    ];
    page.drawRectangle({ x: M, y: y - 10 - (exposureItems.length * 14), width: CW, height: 20 + exposureItems.length * 14, color: C.offWhite });
    page.drawRectangle({ x: M, y: y - 10 - (exposureItems.length * 14), width: 3, height: 20 + exposureItems.length * 14, color: C.accent });
    page.drawText('EXPOSURE SUMMARY', { x: M + 10, y: y - 2, font: bold, size: 8, color: C.accent });
    let exY = y - 16;
    for (const item of exposureItems) {
      page.drawText(s(item), { x: M + 10, y: exY, font, size: 8, color: C.text });
      exY -= 14;
    }
    y = exY - 8;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 6 — REGULATORY HIGHLIGHTS
  // ════════════════════════════════════════════════════════════════════════════
  page = addPage();
  y = BODY_TOP;
  y = drawSectionHeading(page, y, '6. Regulatory Highlights');
  y -= 6;

  const regIntro = `The following regulatory events were recorded during the reporting period. Items marked with a deadline warrant Board awareness and management action. The Board is not required to approve individual compliance items, but should be satisfied that management has adequate processes in place to respond to each.`;
  y = drawParagraph(page, y, regIntro, 13, 8.5, C.muted);
  y -= 12;

  if (highlights.length === 0) {
    page.drawText('No regulatory events recorded in this period.', { x: M, y, font: ital, size: 9, color: C.muted });
  } else {
    for (let i = 0; i < highlights.length; i++) {
      if (y < BODY_BOT + 50) { page = addPage(); y = BODY_TOP; }
      const c = highlights[i];
      const du = daysUntil(c.deadline);
      const isCrit = du !== null && du <= 90 && du >= 0;
      const isOvd  = isExpired(c.deadline);
      const accentC = isOvd ? C.red : isCrit ? C.amber : C.accent;

      // Card border bar + background
      const cardH = 56;
      page.drawRectangle({ x: M, y: y - cardH + 4, width: CW, height: cardH, color: i % 2 === 0 ? C.offWhite : C.white });
      page.drawRectangle({ x: M, y: y - cardH + 4, width: 3, height: cardH, color: accentC });

      // Framework badge
      const fwLabel = s(c.framework || 'Unknown');
      const fwW = bold.widthOfTextAtSize(fwLabel, 6.5) + 8;
      page.drawRectangle({ x: M + 8, y: y - 2, width: fwW, height: 13, color: rgb(accentC.red * 0.1 + 0.9, accentC.green * 0.1 + 0.9, accentC.blue * 0.1 + 0.9) });
      page.drawText(fwLabel, { x: M + 12, y: y + 1, font: bold, size: 6.5, color: accentC });

      // Date
      page.drawText(fmtDate(c.date), { x: PAGE_W - M - 90, y: y + 1, font, size: 7, color: C.muted });

      // Title
      const titleLines2 = wrapText(c.title || 'Regulatory update', CW - 16, bold, 8.5);
      const titleLn = titleLines2[0] || '';
      page.drawText(s(titleLn), { x: M + 8, y: y - 14, font: bold, size: 8.5, color: C.text });

      // Snippet
      const snippet = c.snippet || c.fullText?.slice(0, 200) || '';
      const snipLines = wrapText(snippet, CW - 16, font, 7.5).slice(0, 2);
      let snipY = y - 28;
      for (const ln of snipLines) {
        page.drawText(s(ln), { x: M + 8, y: snipY, font, size: 7.5, color: C.muted });
        snipY -= 10;
      }

      // Deadline tag
      if (c.deadline) {
        const tag = isOvd ? `OVERDUE (was ${fmtDate(c.deadline)})` : isCrit ? `Deadline: ${fmtDate(c.deadline)} (${du}d)` : `Deadline: ${fmtDate(c.deadline)}`;
        const tagW = bold.widthOfTextAtSize(tag, 6.5) + 8;
        page.drawRectangle({ x: PAGE_W - M - tagW - 4, y: y - cardH + 10, width: tagW, height: 13, color: rgb(accentC.red * 0.12 + 0.88, accentC.green * 0.12 + 0.88, accentC.blue * 0.12 + 0.88) });
        page.drawText(s(tag), { x: PAGE_W - M - tagW, y: y - cardH + 14, font: bold, size: 6.5, color: accentC });
      }

      y -= cardH + 8;
    }
  }

  // ── Final page — sign-off ────────────────────────────────────────────────────
  if (y < BODY_BOT + 80) { page = addPage(); y = BODY_TOP; }
  y -= 20;
  page.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 0.5, color: C.border });
  y -= 16;
  page.drawText('IMPORTANT NOTICE', { x: M, y, font: bold, size: 8, color: C.muted });
  y -= 13;
  const disclaimer = 'This Board Compliance Pack has been automatically generated by Raqib, a compliance intelligence platform. The data within reflects records held in the Raqib system as at the date of generation. This document does not constitute legal advice. Board members should seek independent legal counsel on material matters before taking decisions. Any figures or counts are derived from the Raqib data store and should be verified against primary sources for material transactions.';
  y = drawParagraph(page, y, disclaimer, 12, 7.5, C.muted);
  y -= 12;
  page.drawText(`Generated by Raqib  |  ${todayStr}  |  ${entityLabel}  |  Reporting period: last ${periodLabel}`, { x: M, y, font, size: 7, color: C.muted });

  // ── Serialise ─────────────────────────────────────────────────────────────────
  return await doc.save();
}

// ── Route ─────────────────────────────────────────────────────────────────────

export const boardPackRouter = Router();

boardPackRouter.post('/', async (req, res) => {
  try {
    const { opco = '', parentHolding = '', periodDays, title } = req.body || {};
    const days = [30, 180, 365].includes(Number(periodDays)) ? Number(periodDays) : 30;
    const reportTitle = typeof title === 'string' && title.trim()
      ? title.trim()
      : 'Board Compliance Pack';

    const pdfBytes = await buildBoardPack({ opco, parentHolding, periodDays: days, reportTitle });

    const entity = (opco || parentHolding || 'Board').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
    const dateTag = new Date().toISOString().slice(0, 10);
    const filename = `Board_Pack_${entity}_${dateTag}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBytes.length,
    });
    res.end(Buffer.from(pdfBytes));
  } catch (e) {
    console.error('Board pack error:', e.message, e.stack);
    res.status(500).json({ error: e.message });
  }
});
