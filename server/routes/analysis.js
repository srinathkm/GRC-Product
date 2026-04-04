import { Router } from 'express';
import multer from 'multer';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createChatCompletion, isLlmConfigured } from '../services/llm.js';
import { runMaAssessment, loadCoefficients } from '../services/maAssessmentEngine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const changesPath = join(__dirname, '../data/changes.json');
const companiesPath = join(__dirname, '../data/companies.json');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ok = /\.(json|csv)$/i.test(file.originalname) ||
      ['application/json', 'text/csv', 'text/plain'].includes(file.mimetype);
    cb(null, !!ok);
  },
});

const uploadDoc = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ok = /\.(pdf|doc|docx|txt)$/i.test(file.originalname) ||
      ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'].includes(file.mimetype);
    cb(null, !!ok);
  },
});

const maReportStore = new Map();

/** Strip characters that break pdf-lib StandardFonts. */
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

/** Split by newlines then wrap each paragraph for PDF. */
function wrapParagraphs(text, maxWidth, font, size) {
  const safe = sanitizePdfText(text);
  const paragraphs = safe.split(/\n+/).filter((p) => p.trim());
  const lines = [];
  for (const p of paragraphs) {
    lines.push(...wrapText(p, maxWidth, font, size));
    lines.push(''); // blank line between paragraphs
  }
  return lines.filter((l, i) => l !== '' || (i > 0 && lines[i - 1] !== ''));
}

const BULLET = '  \u2022 ';

/** Build a C-level ready PDF for the M&A assessment. */
async function buildMaAssessmentPdf({
  parentGroup,
  target,
  summary,
  complianceDetail,
  financialCommercial,
  sections,
  governanceFrameworkSummary = [],
  multiJurisdictionMatrix = [],
  uboSummary = '',
  esgSummary = '',
  dataSovereigntySummary = '',
  dataSecuritySummary = '',
  uboData = null,
  esgData = null,
  heatMapRow = null,
  applicableFrameworksByJurisdiction = [],
  keyProcessesByFramework = [],
  dataSovereigntyAssessmentStatus = null,
  securityPostureAssessmentStatus = null,
  financialModelling = null,
  systemIntegrations = [],
  timeModel = null,
  complianceTimelines = [],
}) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const size = 11;
  const margin = 50;
  const maxWidth = 495;
  const pageWidth = 595;
  const pageHeight = 842;
  const contentYStart = 780;
  const footerY = 40;
  let y = contentYStart;
  const lineHeight = size * 1.3;
  const headingSize = 12;
  const titleSize = 16;
  const bulletIndent = margin + font.widthOfTextAtSize(BULLET, size);

  const addPage = () => doc.addPage([pageWidth, pageHeight]);
  let page = addPage();

  function needPage(minY = 80) {
    if (y < minY) {
      page = addPage();
      y = contentYStart;
      return true;
    }
    return false;
  }

  function drawLines(lines, opts = {}) {
    const f = opts.bold ? bold : font;
    const s = opts.size ?? size;
    const lh = s * 1.3;
    for (const line of lines) {
      needPage();
      page.drawText(sanitizePdfText(line), { x: margin, y, font: f, size: s, color: rgb(0.15, 0.15, 0.2) });
      y -= lh;
    }
  }

  function drawBulletList(items, opts = {}) {
    const s = opts.size ?? size;
    const lh = s * 1.3;
    const textWidth = maxWidth - (bulletIndent - margin);
    for (const item of items) {
      if (item == null || String(item).trim() === '') continue;
      const lines = wrapText(sanitizePdfText(String(item)), textWidth, font, s);
      for (let i = 0; i < lines.length; i++) {
        needPage();
        if (i === 0) {
          page.drawText(BULLET, { x: margin, y, font, size: s, color: rgb(0.15, 0.15, 0.2) });
          page.drawText(sanitizePdfText(lines[i]), { x: bulletIndent, y, font, size: s, color: rgb(0.15, 0.15, 0.2) });
        } else {
          page.drawText(sanitizePdfText(lines[i]), { x: bulletIndent, y, font, size: s, color: rgb(0.15, 0.15, 0.2) });
        }
        y -= lh;
      }
    }
  }

  function drawSectionTitle(title) {
    needPage(100);
    y -= lineHeight * 0.5;
    page.drawText(sanitizePdfText(title), { x: margin, y, font: bold, size: headingSize, color: rgb(0.15, 0.25, 0.45) });
    y -= lineHeight;
    page.drawLine({ start: { x: margin, y }, end: { x: margin + maxWidth, y }, thickness: 0.5, color: rgb(0.2, 0.3, 0.5) });
    y -= lineHeight * 0.8;
  }

  // Header
  page.drawText('Confidential – C-level review', { x: pageWidth - margin - bold.widthOfTextAtSize('Confidential – C-level review', 9), y: pageHeight - 28, font: bold, size: 9, color: rgb(0.4, 0.4, 0.4) });
  page.drawText(`Generated: ${new Date().toISOString().slice(0, 19)}Z`, { x: margin, y: pageHeight - 28, font, size: 9, color: rgb(0.4, 0.4, 0.4) });
  y -= lineHeight;

  // Title
  page.drawText('M&A Framework Assessment Report', { x: margin, y, font: bold, size: titleSize, color: rgb(0.1, 0.2, 0.4) });
  y -= lineHeight * 1.2;
  page.drawText(sanitizePdfText(`Parent Group: ${parentGroup || '—'}`), { x: margin, y, font, size: 10, color: rgb(0.2, 0.2, 0.3) });
  y -= lineHeight;
  page.drawText(sanitizePdfText(`Target: ${target || '—'}`), { x: margin, y, font, size: 10, color: rgb(0.2, 0.2, 0.3) });
  y -= lineHeight * 1.2;

  // Summary
  drawSectionTitle('Summary');
  drawLines(wrapParagraphs(summary || 'No summary.', maxWidth, font, size));

  // Compliance & risk heat map (target OpCo)
  drawSectionTitle('Compliance & risk heat map (target OpCo)');
  if (heatMapRow && (heatMapRow.opco || target)) {
    const riskScore = heatMapRow.riskScore != null ? Number(heatMapRow.riskScore) : null;
    const bullets = [
      `OpCo: ${heatMapRow.opco || target}`,
      `Risk score (0-100): ${riskScore != null ? riskScore : '—'} ${riskScore != null ? (riskScore >= 60 ? '(High)' : riskScore >= 30 ? '(Medium)' : '(Low)') : ''}`,
      `Regulatory deadlines affecting this OpCo: ${heatMapRow.deadlineCount != null ? heatMapRow.deadlineCount : '—'}`,
      `Historical on-time compliance: ${heatMapRow.historicalOnTimeRate != null ? `${heatMapRow.historicalOnTimeRate}%` : '—'}`,
      `Predicted to meet compliance on time: ${heatMapRow.predictedOnTime ? 'Yes' : 'No'}`,
    ];
    drawBulletList(bullets);
    if (riskScore != null) {
      needPage();
      y -= lineHeight * 0.5;
      const barWidth = Math.min(maxWidth, Math.max(0, (riskScore / 100) * 300));
      const barY = y - 4;
      const barH = 14;
      page.drawRectangle({ x: margin, y: barY - barH, width: 300, height: barH, borderColor: rgb(0.5, 0.5, 0.5), borderWidth: 0.5 });
      const fillColor = riskScore >= 60 ? rgb(0.93, 0.27, 0.27) : riskScore >= 30 ? rgb(0.92, 0.7, 0.03) : rgb(0.13, 0.77, 0.37);
      page.drawRectangle({ x: margin, y: barY - barH, width: barWidth, height: barH, color: fillColor });
      page.drawText('0', { x: margin, y: barY - barH - 4, font, size: 8, color: rgb(0.4, 0.4, 0.4) });
      page.drawText('100', { x: margin + 300 - font.widthOfTextAtSize('100', 8), y: barY - barH - 4, font, size: 8, color: rgb(0.4, 0.4, 0.4) });
      y = barY - barH - lineHeight;
    }
  } else {
    drawBulletList([`No heat map data for target "${target || '—'}". Run Risk Prediction for the parent holding, then generate this assessment to include risk score and deadlines.`]);
  }

  // Governance Framework Summary (recent regulatory changes for target)
  drawSectionTitle('Governance Framework Summary');
  if (governanceFrameworkSummary.length > 0) {
    for (const c of governanceFrameworkSummary) {
      const titleLine = `${c.framework} | ${c.date}: ${sanitizePdfText(c.title || '')}`;
      drawBulletList([titleLine]);
      if (c.snippet) drawBulletList([sanitizePdfText(c.snippet).slice(0, 300)]);
    }
  } else {
    drawBulletList(['No recent regulatory changes for target frameworks. Run Governance Framework Summary for the parent to populate.']);
  }

  // Compliance detail / Governance framework
  if (complianceDetail) {
    drawSectionTitle('Governance framework & compliance detail');
    const fwList = (complianceDetail.frameworks || []).map((f) => (f && f.name) || f).filter(Boolean);
    if (fwList.length) drawBulletList(fwList.map((name) => `Applicable framework: ${name}`));
    (complianceDetail.obligations || []).forEach((o) => drawBulletList([o]));
    (complianceDetail.gaps || []).forEach((g) => {
      const line = (g && (g.control || g.description)) ? `${g.control || g}: ${g.description || ''}${g.remediation ? ` (Remediation: ${g.remediation})` : ''}` : String(g);
      drawBulletList([line]);
    });
  }

  // Multi Jurisdiction Matrix
  drawSectionTitle('Multi Jurisdiction Matrix');
  if (multiJurisdictionMatrix.length > 0) {
    drawBulletList(multiJurisdictionMatrix.map((row) => `${row.framework}: ${row.zone} (${row.location})`));
    if (financialCommercial && financialCommercial.crossJurisdictionalMapping) {
      y -= lineHeight * 0.3;
      drawBulletList([financialCommercial.crossJurisdictionalMapping]);
    }
  } else if (financialCommercial && financialCommercial.crossJurisdictionalMapping) {
    drawBulletList([financialCommercial.crossJurisdictionalMapping]);
  } else {
    drawBulletList([`Target "${target || '—'}": confirm applicable free zones and frameworks in Multi Jurisdiction Matrix.`]);
  }

  // Ultimate Beneficial Owner (UBO) – target OpCo
  drawSectionTitle('Ultimate Beneficial Owner (UBO) – target OpCo');
  if (uboData && typeof uboData === 'object') {
    const bullets = [];
    if (uboData.status) bullets.push(`UBO register status: ${uboData.status}`);
    if (uboData.percentage != null) bullets.push(`Holding by parent: ${uboData.percentage}%`);
    if (uboData.lastUpdated) bullets.push(`Last updated: ${uboData.lastUpdated}`);
    if (uboData.notes) bullets.push(`Notes: ${uboData.notes}`);
    bullets.push(`Mandatory documents: ${uboData.documentsCompleted ?? 0}/${uboData.totalDocuments ?? 7} completed`);
    const d = uboData.details || {};
    if (d.fullName) bullets.push(`UBO name: ${d.fullName}`);
    if (d.nationality) bullets.push(`Nationality: ${d.nationality}`);
    if (d.idNumber) bullets.push(`ID number: ${d.idNumber}`);
    if (d.countryOfResidence) bullets.push(`Country of residence: ${d.countryOfResidence}`);
    if (bullets.length) drawBulletList(bullets); else drawBulletList(['No UBO data recorded for this target OpCo.']);
  } else if (uboSummary) {
    drawBulletList(uboSummary.split(/\.\s+/).filter(Boolean).map((s) => s.trim() + (s.endsWith('.') ? '' : '.')));
  } else {
    drawBulletList([`No UBO lookup data for target "${target || '—'}". Complete UBO register for Parent::Target to include in this report.`]);
  }

  // ESG Summary – target OpCo
  drawSectionTitle('ESG Summary – target OpCo');
  if (esgData && typeof esgData === 'object') {
    const bullets = [
      `Entity: ${esgData.entity || '—'}`,
      `Jurisdiction: ${esgData.jurisdiction || '—'}`,
      `Reporting year: ${esgData.year ?? '—'}`,
      `Environmental score: ${esgData.env ?? '—'}/100`,
      `Social score: ${esgData.social ?? '—'}/100`,
      `Governance score: ${esgData.gov ?? '—'}/100`,
      `Overall ESG score: ${esgData.overall ?? '—'}/100`,
    ];
    drawBulletList(bullets);
  } else if (esgSummary) {
    drawBulletList(esgSummary.split(/[.;]\s+/).filter(Boolean).map((s) => s.trim()));
  } else {
    const esgFw = (complianceDetail?.frameworks || []).map((f) => (f && f.name) || f).filter((n) => /ESG/i.test(String(n || '')));
    if (esgFw.length > 0) {
      drawBulletList([`ESG-related frameworks: ${esgFw.join(', ')}.`, 'No ESG score data for this target; run ESG Summary for the entity to include scores.']);
    } else {
      drawBulletList(['No ESG data for this target OpCo. Run ESG Summary for the selected entity to include in this report.']);
    }
  }

  // Data Sovereignty
  drawSectionTitle('Data Sovereignty');
  if (dataSovereigntySummary) {
    drawBulletList(dataSovereigntySummary.split(/[.;]\s+/).filter(Boolean).map((s) => s.trim()));
  } else {
    drawBulletList([
      'UAE PDPL / KSA PDPL alignment and cross-border transfer mechanisms.',
      'Map where personal and client data for the target OpCo is stored and processed.',
      'Ensure local data residency or data export requirements are met in each jurisdiction.',
    ]);
  }

  // Data Security Compliance
  drawSectionTitle('Data Security Compliance');
  if (dataSecuritySummary) {
    drawBulletList(dataSecuritySummary.split(/[.;]\s+/).filter(Boolean).map((s) => s.trim()));
  } else {
    drawBulletList([
      'Information security controls vs group standards and regulatory requirements (AML/CFT, cyber, operational resilience).',
      'Access controls, logging, incident response, and third-party arrangements aligned with group security policies.',
    ]);
  }

  // Applicable frameworks by jurisdiction (target OpCo market)
  if (applicableFrameworksByJurisdiction && applicableFrameworksByJurisdiction.length > 0) {
    drawSectionTitle('Applicable frameworks by target OpCo jurisdiction');
    for (const { jurisdiction, location, frameworks } of applicableFrameworksByJurisdiction) {
      drawBulletList([`${jurisdiction} (${location}): ${(frameworks || []).join(', ')}`]);
    }
  }

  // Key processes by framework
  if (keyProcessesByFramework && keyProcessesByFramework.length > 0) {
    drawSectionTitle('Key processes to complete (by governance framework)');
    for (const { framework, processes } of keyProcessesByFramework) {
      drawBulletList([`${framework}:`]);
      (processes || []).forEach((p) => drawBulletList([`  ${p}`]));
    }
  }

  // Data sovereignty & security posture status
  if (dataSovereigntyAssessmentStatus) {
    drawSectionTitle('Data sovereignty assessment status');
    drawBulletList([`Status: ${dataSovereigntyAssessmentStatus.status}`, (dataSovereigntyAssessmentStatus.summary || '').slice(0, 400)]);
  }
  if (securityPostureAssessmentStatus) {
    drawSectionTitle('Security posture assessment status');
    drawBulletList([`Status: ${securityPostureAssessmentStatus.status}`, (securityPostureAssessmentStatus.summary || '').slice(0, 400)]);
  }

  // Financial and commercial
  if (financialCommercial) {
    drawSectionTitle('Financial and commercial impact');
    const bullets = [];
    if (financialCommercial.manpowerFte) bullets.push(`Manpower (FTE): ${financialCommercial.manpowerFte}`);
    if (financialCommercial.manpowerCost) bullets.push(`Est. cost: ${financialCommercial.manpowerCost}`);
    if (financialCommercial.additionalCosts) bullets.push(financialCommercial.additionalCosts);
    if (bullets.length) drawBulletList(bullets);
  }

  // Financial modelling (cost to comply)
  if (financialModelling) {
    drawSectionTitle('Financial modelling – cost to comply (AED)');
    drawBulletList([
      `One-time total: ${(financialModelling.totalOneTimeAED || 0).toLocaleString()} AED`,
      `Annual ongoing: ${(financialModelling.totalAnnualAED || 0).toLocaleString()} AED`,
    ]);
    (financialModelling.breakdown || []).forEach((b) => {
      drawBulletList([`${b.item}: ${(b.amountAED || 0).toLocaleString()} AED (${b.type || 'one-time'})`]);
    });
  }

  // System integrations for merger
  if (systemIntegrations && systemIntegrations.length > 0) {
    drawSectionTitle('System integrations for merger');
    systemIntegrations.forEach((s) => drawBulletList([`[${s.priority || 'Medium'}] ${s.system}: ${s.description || ''}`]));
  }

  // Time model
  if (timeModel) {
    drawSectionTitle('Time model to complete integration');
    drawBulletList([
      `Total: ${timeModel.totalWeeks || 0} weeks (${timeModel.totalMonths || 0} months)`,
      ...(timeModel.phases || []).map((p) => `${p.name}: ${p.weeks} weeks`),
    ]);
  }

  // Compliance timelines (days post-signing)
  if (complianceTimelines && complianceTimelines.length > 0) {
    drawSectionTitle('Compliance timelines (days post-signing)');
    complianceTimelines.forEach((t) => drawBulletList([`${t.compliance} (${t.framework}): ${t.daysPostSigning} days`]));
  }

  // Detailed outcome
  drawSectionTitle('Detailed outcome by theme');
  for (const sec of sections || []) {
    const title = (sec && sec.title) ? String(sec.title) : 'Section';
    const content = (sec && sec.content) ? String(sec.content) : '';
    needPage(100);
    drawBulletList([`${title}: ${content}`]);
  }

  const pdfBytes = await doc.save();
  return pdfBytes;
}

/** Parse optional historical file. Expected JSON: { records: [ { opco, year, deadlineMet, changeId? } ] } or CSV: opco,year,deadlineMet,changeId */
function parseHistorical(buffer, mimetype, filename) {
  const text = buffer.toString('utf-8').trim();
  if (!text) return null;
  if (/\.json$/i.test(filename || '') || mimetype === 'application/json') {
    try {
      const data = JSON.parse(text);
      return Array.isArray(data.records) ? data.records : Array.isArray(data) ? data : null;
    } catch (_) {
      return null;
    }
  }
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return null;
  const headers = lines[0].toLowerCase().split(',').map((h) => h.trim());
  const opcoIdx = headers.findIndex((h) => /opco|entity|company/.test(h));
  const yearIdx = headers.findIndex((h) => /year|date/.test(h));
  const metIdx = headers.findIndex((h) => /met|on.?time|complian/.test(h));
  if (opcoIdx < 0 || metIdx < 0) return null;
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    const opco = cols[opcoIdx];
    const year = yearIdx >= 0 ? cols[yearIdx] : new Date().getFullYear();
    const deadlineMet = String(cols[metIdx] || '').toLowerCase();
    records.push({
      opco,
      year: String(year),
      deadlineMet: /^(1|yes|true|y|met|on.?time)$/.test(deadlineMet),
    });
  }
  return records;
}

/** Build company -> parent map from companies.json */
async function loadCompanyToParent() {
  try {
    const raw = await readFile(companiesPath, 'utf-8');
    const data = JSON.parse(raw);
    const map = {};
    for (const [framework, entries] of Object.entries(data)) {
      if (!Array.isArray(entries)) continue;
      for (const { parent, companies } of entries) {
        for (const co of companies || []) {
          if (co) map[co] = parent;
        }
      }
    }
    return map;
  } catch (_) {
    return {};
  }
}

/** Get OpCos for a parent from companies.json */
async function getOpcosForParent(parent) {
  try {
    const raw = await readFile(companiesPath, 'utf-8');
    const data = JSON.parse(raw);
    const set = new Set();
    for (const entries of Object.values(data)) {
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (entry.parent !== parent) continue;
        for (const name of entry.companies || []) {
          if (name) set.add(name);
        }
      }
    }
    return Array.from(set);
  } catch (_) {
    return [];
  }
}

/** Compute risk score 0–100 (higher = more risk) for an OpCo based on changes affecting it and optional historical on-time rate. */
function computeOpcoRisk(deadlines, historicalRate) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let overdue = 0;
  let critical = 0;
  let medium = 0;
  let total = deadlines.length;
  let sumDaysLeft = 0;
  for (const d of deadlines) {
    if (!d.deadline) continue;
    const end = new Date(d.deadline);
    end.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((end - now) / (24 * 60 * 60 * 1000));
    sumDaysLeft += daysLeft;
    if (daysLeft < 0) overdue++;
    else if (daysLeft <= 30) critical++;
    else if (daysLeft <= 90) medium++;
  }
  if (total === 0) {
    return { riskScore: 0, predictedOnTime: true, label: 'Low', factor: 'No upcoming deadlines' };
  }
  const avgDaysLeft = sumDaysLeft / total;
  let riskScore = 0;
  riskScore += Math.min(overdue * 25, 40);
  riskScore += Math.min(critical * 8, 30);
  riskScore += Math.min(medium * 2, 15);
  if (avgDaysLeft < 30 && overdue === 0) riskScore += 10;
  if (historicalRate !== null && historicalRate !== undefined) {
    const historyFactor = (1 - historicalRate) * 20;
    riskScore += historyFactor;
  }
  riskScore = Math.min(100, Math.round(riskScore));
  let label = 'Low';
  if (riskScore >= 60) label = 'High';
  else if (riskScore >= 30) label = 'Medium';
  const predictedOnTime = riskScore < 50 && overdue === 0;
  let factor = '';
  if (overdue > 0) factor = `${overdue} overdue deadline(s)`;
  else if (critical > 0) factor = `${critical} deadline(s) in next 30 days`;
  else if (medium > 0) factor = `${medium} deadline(s) in 30–90 days`;
  else factor = 'Comfortable timeline';
  return { riskScore, predictedOnTime, label, factor };
}

/** Generate detailed explanation using AI if available, else template */
async function buildExplanation(summary, byOpCo, chartData, historicalCount) {
  if (isLlmConfigured()) {
    try {
      const prompt = `You are a compliance risk analyst. Based on the following risk prediction summary, write a short detailed explanation (2–4 paragraphs) for management. Cover: overall likelihood of meeting compliance in time, which OpCos or deadlines are most at risk, and what drives the prediction. Use the data provided; do not invent numbers.

Summary: ${JSON.stringify(summary)}
By OpCo: ${JSON.stringify(byOpCo)}
Historical records used: ${historicalCount}
Write in clear, professional English.`;

      const completion = await createChatCompletion({
        messages: [
          { role: 'system', content: 'You write concise compliance risk summaries for senior management.' },
          { role: 'user', content: prompt },
        ],
        maxTokens: 600,
        responseFormat: 'text',
      });
      const text = completion.choices?.[0]?.message?.content?.trim();
      if (text) return text;
    } catch (e) {
      console.error('Analysis explanation error (LLM):', e.message);
    }
  }
  const { overallRiskLevel, probabilityMeetOnTime, totalOpcos, atRiskOpcos } = summary;
  let explanation = `The predictive risk analysis considers all regulatory change deadlines affecting the selected parent's OpCos`;
  if (historicalCount > 0) {
    explanation += `, together with ${historicalCount} historical compliance records from the uploaded file`;
  }
  explanation += `. The overall risk level is **${overallRiskLevel}**, with an estimated ${probabilityMeetOnTime}% probability that compliance will be met in time across the portfolio. `;
  explanation += `Of ${totalOpcos} OpCos analysed, ${atRiskOpcos} are currently assessed as at risk (medium or high). `;
  explanation += `Factors include the number of overdue or near-term deadlines per entity and, where provided, historical on-time compliance rates. We recommend prioritising OpCos with the highest risk scores and addressing any overdue items first.`;
  return explanation;
}

export const analysisRouter = Router();

/**
 * POST /api/analysis/overview-summary
 * Body: {
 *   parent: string,
 *   opcos: [{
 *     opcoName: string,
 *     jurisdiction: string,
 *     governanceScore: number,
 *     policyScore: number,
 *     dataSovereigntyScore: number,
 *     status: string,
 *     isMultiJurisdiction: boolean,
 *     uboDocs?: { completed: number, total: number } | null
 *   }],
 *   overdueChanges?: [{
 *     framework: string,
 *     title: string,
 *     deadline: string,
 *     affectedOpcos: string[]
 *   }]
 * }
 *
 * Returns a JSON summary built by the LLM (when configured) or a heuristic fallback:
 * {
 *   overallSummary: string,
 *   documentScoreSummary: string,
 *   frameworkComplianceSummary: string,
 *   multiJurisdictionRiskSummary: string,
 *   keyActions: string[]
 * }
 */
analysisRouter.post('/overview-summary', async (req, res) => {
  try {
    const { parent, opcos, overdueChanges } = req.body || {};
    const parentName = typeof parent === 'string' ? parent.trim() : '';
    const opcoList = Array.isArray(opcos) ? opcos : [];
    const overdueList = Array.isArray(overdueChanges) ? overdueChanges : [];

    if (!parentName || opcoList.length === 0) {
      return res.status(400).json({ error: 'Parent and at least one OpCo row are required' });
    }

    // Compute simple metrics to support the LLM and fallback.
    let totalDocCompleted = 0;
    let totalDocPossible = 0;
    let opcosWithDocs = 0;
    let multiJurisdictionCount = 0;
    let nonCompliantCount = 0;
    let atRiskCount = 0;
    let compliantCount = 0;

    for (const row of opcoList) {
      const docs = row && row.uboDocs;
      if (docs && typeof docs.completed === 'number' && typeof docs.total === 'number' && docs.total > 0) {
        totalDocCompleted += docs.completed;
        totalDocPossible += docs.total;
        opcosWithDocs += 1;
      }
      if (row && row.isMultiJurisdiction) multiJurisdictionCount += 1;
      const status = (row && row.status) || '';
      if (/non[-\s]?compliant/i.test(status)) nonCompliantCount += 1;
      else if (/at\s*risk/i.test(status)) atRiskCount += 1;
      else if (/compliant/i.test(status)) compliantCount += 1;
    }

    const overallDocCompletionPct =
      totalDocPossible > 0 ? Math.round((totalDocCompleted / totalDocPossible) * 100) : null;

    const frameworkIssuesByOpco = {};
    for (const c of overdueList) {
      const affected = Array.isArray(c.affectedOpcos) ? c.affectedOpcos : [];
      for (const name of affected) {
        const key = typeof name === 'string' ? name.trim() : '';
        if (!key) continue;
        if (!frameworkIssuesByOpco[key]) frameworkIssuesByOpco[key] = [];
        frameworkIssuesByOpco[key].push({
          framework: c.framework || '',
          title: c.title || '',
          deadline: c.deadline || '',
        });
      }
    }

    const payloadForModel = {
      parent: parentName,
      opcos: opcoList,
      overdueChanges: overdueList,
      metrics: {
        overallDocCompletionPct,
        opcosWithDocs,
        multiJurisdictionCount,
        nonCompliantCount,
        atRiskCount,
        compliantCount,
        totalOpcos: opcoList.length,
      },
      frameworkIssuesByOpco,
    };

    if (isLlmConfigured()) {
      try {
        const systemPrompt =
          'You are a senior compliance officer. Given structured data about a parent holding and its OpCos, write a concise, evidence-backed compliance overview and clear, outcome-based remediation steps.';
        const userPrompt = `Data (JSON):\n${JSON.stringify(payloadForModel)}\n\nRequirements:\n1) Assess the overall compliance posture for the parent group and its OpCos using ONLY the numbers and names provided.\n2) Cover:\n   - Mandatory UBO/compliance document completion per OpCo (uploaded vs total) and an overall score.\n   - Framework or regulatory changes that are overdue or near their deadline, and which OpCos they affect.\n   - Multi-jurisdiction risks where the same OpCo operates in multiple jurisdictions or frameworks.\n3) Provide:\n   - "overallSummary": 2–3 sentences on the situation.\n   - "documentScoreSummary": quantitative summary (include percentages and counts where possible).\n   - "frameworkComplianceSummary": which OpCos/frameworks are driving risk (overdue or near deadlines).\n   - "multiJurisdictionRiskSummary": risks that arise specifically from multi-jurisdiction operations.\n   - "keyActions": 4–8 short, outcome-based steps (each a single sentence starting with a verb).\n\nRespond ONLY with a valid JSON object of the form:\n{\n  "overallSummary": string,\n  "documentScoreSummary": string,\n  "frameworkComplianceSummary": string,\n  "multiJurisdictionRiskSummary": string,\n  "keyActions": string[]\n}`;

        const completion = await createChatCompletion({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          maxTokens: 800,
          responseFormat: 'json',
        });

        const raw = completion.choices?.[0]?.message?.content?.trim() || '{}';
        const jsonStr = raw.replace(/^```json?\s*|\s*```$/g, '').trim();
        const parsed = JSON.parse(jsonStr);
        const summary = {
          overallSummary: typeof parsed.overallSummary === 'string' ? parsed.overallSummary : '',
          documentScoreSummary:
            typeof parsed.documentScoreSummary === 'string'
              ? parsed.documentScoreSummary
              : '',
          frameworkComplianceSummary:
            typeof parsed.frameworkComplianceSummary === 'string'
              ? parsed.frameworkComplianceSummary
              : '',
          multiJurisdictionRiskSummary:
            typeof parsed.multiJurisdictionRiskSummary === 'string'
              ? parsed.multiJurisdictionRiskSummary
              : '',
          keyActions: Array.isArray(parsed.keyActions)
            ? parsed.keyActions.filter((x) => typeof x === 'string' && x.trim())
            : [],
          metrics: payloadForModel.metrics,
        };
        return res.json(summary);
      } catch (e) {
        console.warn('overview-summary LLM error:', e.message || e);
      }
    }

    // Fallback when LLM is not configured or fails.
    const docSummaryPieces = [];
    if (overallDocCompletionPct != null) {
      docSummaryPieces.push(
        `Across ${opcosWithDocs} OpCo(s) with UBO/mandatory document tracking, approximately ${overallDocCompletionPct}% of required documents are marked as uploaded.`,
      );
    } else {
      docSummaryPieces.push(
        'No UBO or mandatory document tracking data was provided for this parent; document completeness cannot be scored.',
      );
    }
    const documentScoreSummary = docSummaryPieces.join(' ');

    const frameworkSummaryPieces = [];
    const totalOverdue = overdueList.length;
    if (totalOverdue > 0) {
      frameworkSummaryPieces.push(
        `${totalOverdue} change(s) with deadlines affect this parent, concentrated in ${Object.keys(
          frameworkIssuesByOpco,
        ).length} OpCo(s).`,
      );
    } else {
      frameworkSummaryPieces.push('No overdue or near-term framework deadlines were provided for this parent.');
    }
    const frameworkComplianceSummary = frameworkSummaryPieces.join(' ');

    const multiSummaryPieces = [];
    if (multiJurisdictionCount > 0) {
      multiSummaryPieces.push(
        `${multiJurisdictionCount} OpCo(s) operate across multiple jurisdictions or frameworks, which increases the coordination needed for timely compliance and consistent control design.`,
      );
    } else {
      multiSummaryPieces.push(
        'No multi-jurisdiction OpCos were identified from the provided data; jurisdictional risk appears limited in this snapshot.',
      );
    }
    const multiJurisdictionRiskSummary = multiSummaryPieces.join(' ');

    const overallSummary = `For parent "${parentName}", ${opcoList.length} OpCo(s) were analysed with a mix of compliant, at-risk, and non-compliant statuses. Document completeness, regulatory deadlines, and multi-jurisdiction exposure should be used together to prioritise where the compliance team intervenes first.`;

    const keyActions = [
      'Identify OpCos with the lowest UBO/mandatory document completion percentages and assign owners to close document gaps within 30–60 days.',
      'For each OpCo with overdue or near-term framework deadlines, create a mini remediation plan covering policy updates, evidence gathering, and regulator submissions.',
      'Prioritise multi-jurisdiction OpCos for a cross-framework mapping exercise so that overlapping obligations are clearly documented and owned.',
      'Use the governance framework view to confirm which frameworks are in scope for each OpCo and ensure they are reflected in local compliance plans.',
      'Run a focused UBO review for high-risk OpCos (those marked At Risk or Non-Compliant) to confirm beneficial ownership records and supporting documents.',
      'Align board and senior management reporting so that these document scores, deadline exposures, and multi-jurisdiction risks are tracked over time.',
    ];

    return res.json({
      overallSummary,
      documentScoreSummary,
      frameworkComplianceSummary,
      multiJurisdictionRiskSummary,
      keyActions,
      metrics: payloadForModel.metrics,
    });
  } catch (e) {
    console.error('overview-summary error:', e);
    res.status(500).json({ error: e.message || 'Overview summary failed' });
  }
});

analysisRouter.post('/risk-prediction', upload.single('historical'), async (req, res) => {
  try {
    const parent = (req.body && req.body.parent) ? String(req.body.parent).trim() : null;
    if (!parent) {
      return res.status(400).json({ error: 'Parent holding is required' });
    }

    let historicalRecords = null;
    if (req.file && req.file.buffer) {
      historicalRecords = parseHistorical(
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname
      );
    }

    const [changesRaw, opcos] = await Promise.all([
      readFile(changesPath, 'utf-8').then(JSON.parse).catch(() => []),
      getOpcosForParent(parent),
    ]);

    const companyToParent = await loadCompanyToParent();
    const now = new Date();
    const changes = Array.isArray(changesRaw) ? changesRaw : [];

    const opcoDeadlines = {};
    for (const opco of opcos) {
      opcoDeadlines[opco] = [];
    }
    for (const c of changes) {
      const companies = c.affectedCompanies || [];
      const deadline = c.deadline || c.date;
      for (const co of companies) {
        const p = companyToParent[co];
        if (p !== parent) continue;
        if (!opcoDeadlines[co]) opcoDeadlines[co] = [];
        opcoDeadlines[co].push({
          changeId: c.id,
          title: c.title,
          framework: c.framework,
          category: c.category || 'General',
          deadline,
        });
      }
    }

    const historicalByOpco = {};
    if (Array.isArray(historicalRecords)) {
      for (const r of historicalRecords) {
        const key = (r.opco || '').trim();
        if (!key) continue;
        if (!historicalByOpco[key]) historicalByOpco[key] = { met: 0, total: 0 };
        historicalByOpco[key].total++;
        if (r.deadlineMet) historicalByOpco[key].met++;
      }
    }

    const byOpCo = [];
    const chartData = { labels: [], riskScores: [], colors: [] };
    let totalRisk = 0;
    let atRiskCount = 0;

    for (const opco of opcos) {
      const deadlines = opcoDeadlines[opco] || [];
      const hist = historicalByOpco[opco];
      const historicalRate = hist && hist.total > 0 ? hist.met / hist.total : null;
      const result = computeOpcoRisk(deadlines, historicalRate);
      totalRisk += result.riskScore;
      if (result.label === 'Medium' || result.label === 'High') atRiskCount++;
      byOpCo.push({
        opco,
        riskScore: result.riskScore,
        riskLevel: result.label,
        predictedOnTime: result.predictedOnTime,
        factor: result.factor,
        deadlineCount: deadlines.length,
        historicalOnTimeRate: historicalRate != null ? Math.round(historicalRate * 100) : null,
      });
      chartData.labels.push(opco.length > 20 ? opco.slice(0, 18) + '…' : opco);
      chartData.riskScores.push(result.riskScore);
      chartData.colors.push(result.riskScore >= 60 ? '#ef4444' : result.riskScore >= 30 ? '#eab308' : '#22c55e');
    }

    const numOpcos = byOpCo.length;
    const overallRiskScore = numOpcos > 0 ? Math.round(totalRisk / numOpcos) : 0;
    let overallRiskLevel = 'Low';
    if (overallRiskScore >= 60) overallRiskLevel = 'High';
    else if (overallRiskScore >= 30) overallRiskLevel = 'Medium';
    const probabilityMeetOnTime = Math.max(0, 100 - overallRiskScore);

    const summary = {
      overallRiskLevel,
      overallRiskScore,
      probabilityMeetOnTime,
      totalOpcos: numOpcos,
      atRiskOpcos: atRiskCount,
      historicalRecordsUsed: Array.isArray(historicalRecords) ? historicalRecords.length : 0,
    };

    const explanation = await buildExplanation(summary, byOpCo, chartData, summary.historicalRecordsUsed);

    const upcomingDeadlines = byOpCo
      .flatMap((o) => (opcoDeadlines[o.opco] || []).map((d) => ({ ...d, opco: o.opco, riskLevel: o.riskLevel })))
      .filter((d) => d.deadline)
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    const nowDate = new Date();
    nowDate.setHours(0, 0, 0, 0);

    /** Base penalty multipliers by framework tier (USD equivalent for illustration). */
    const penaltyTier = (fw) => {
      if (!fw) return 1;
      if (/\b(DFSA|SAMA|CMA|CBUAE|QFCRA|CBB)\b/i.test(fw)) return 1.5;
      return 1;
    };

    const financialPenaltiesByOpCo = [];
    let parentPenaltyTotal = 0;
    const BASE_PENALTY_OVERDUE = 50000;
    const BASE_PENALTY_AT_RISK = 10000;

    const complianceGaps = [];
    const capitalByOpCo = [];
    let parentCapitalTotal = 0;
    const BASE_COST_PER_GAP = 25000;
    for (const opco of opcos) {
      const deadlines = opcoDeadlines[opco] || [];
      let opcoPenalty = 0;
      const opcoGaps = [];
      for (const d of deadlines) {
        const end = new Date(d.deadline);
        end.setHours(0, 0, 0, 0);
        const daysLeft = Math.ceil((end - nowDate) / (24 * 60 * 60 * 1000));
        const isOverdue = daysLeft < 0;
        const isAtRisk = !isOverdue && daysLeft <= 30;
        const status = isOverdue ? 'Overdue' : isAtRisk ? 'At risk' : 'Upcoming';
        const module = `${d.framework} – ${d.category}`;
        let missingDetails = '';
        let actionsToMeetCompliance = '';
        if (isOverdue) {
          missingDetails = 'Deadline passed; corrective action and submission required. Possible late filing or remediation report.';
          actionsToMeetCompliance = 'Update policies and procedures to align with the regulation; complete required documentation and evidence; submit late filing or remediation report to the regulator; implement any process or control changes; retain records for audit. Escalate to compliance and legal for formal response.';
          opcoPenalty += BASE_PENALTY_OVERDUE * penaltyTier(d.framework);
        } else if (isAtRisk) {
          missingDetails = 'Action required before deadline: policy update, documentation, and submission as per regulation.';
          actionsToMeetCompliance = 'Review and update policies, procedures, and controls per the change; prepare and collate documentation (e.g. board minutes, training records, risk assessments); obtain internal sign-off and legal/regulatory review; submit by the deadline. Assign owner and track to closure.';
          opcoPenalty += BASE_PENALTY_AT_RISK * penaltyTier(d.framework);
        } else {
          missingDetails = 'Planned actions: align policies, prepare documentation, and submit by deadline.';
          actionsToMeetCompliance = 'Align policies and procedures with the new requirement; draft and finalise documentation; schedule training and awareness; set up controls and monitoring; plan submission and filing before the deadline.';
        }
        opcoGaps.push({
          opco,
          framework: d.framework,
          module,
          changeId: d.changeId,
          changeTitle: d.title,
          deadline: d.deadline,
          status,
          missingDetails,
          actionsToMeetCompliance,
        });
      }
      const opcoPenaltyRounded = Math.round(opcoPenalty);
      const gapCount = opcoGaps.length;
      const opcoCapital = gapCount > 0 ? Math.round(BASE_COST_PER_GAP * gapCount) : 0;
      /* Breakdown: FTE (personnel) + Administrative costs; sum = total investment. */
      const FTE_SHARE = 0.55;
      const COST_PER_FTE_YEAR = 120000;
      const fteCost = opcoCapital > 0 ? Math.round(opcoCapital * FTE_SHARE) : 0;
      const adminCost = opcoCapital > 0 ? opcoCapital - fteCost : 0;
      const fteRequired = fteCost > 0 ? Math.round((fteCost / COST_PER_FTE_YEAR) * 10) / 10 : 0;
      const breakdown = opcoCapital > 0
        ? [
            { item: 'FTE (personnel to complete process)', cost: fteCost, fteRequired },
            { item: 'Administrative costs', cost: adminCost },
          ]
        : [];

      complianceGaps.push(...opcoGaps);

      /* Financial penalty: only OpCos with actual penalty exposure (overdue or at-risk). */
      if (opcoPenaltyRounded > 0) {
        parentPenaltyTotal += opcoPenaltyRounded;
        financialPenaltiesByOpCo.push({
          opco,
          estimatedPenalty: opcoPenaltyRounded,
          currency: 'USD',
          gapCount,
        });
      }

      /* Capital investment: only OpCos missing compliance and needing corrective measures (have gaps). */
      if (gapCount > 0) {
        parentCapitalTotal += opcoCapital;
        capitalByOpCo.push({
          opco,
          estimatedCost: opcoCapital,
          currency: 'USD',
          gapCount,
          breakdown,
        });
      }
    }

    const financialPenalties = {
      byOpCo: financialPenaltiesByOpCo,
      parentTotal: parentPenaltyTotal,
      currency: 'USD',
    };

    const capitalInvestment = {
      byOpCo: capitalByOpCo,
      parentTotal: parentCapitalTotal,
      currency: 'USD',
    };

    const businessImpactList = [];
    if (atRiskCount > 0 || parentPenaltyTotal > 0) {
      if (parentPenaltyTotal > 0) {
        businessImpactList.push({
          type: 'Financial penalty',
          severity: parentPenaltyTotal > 200000 ? 'High' : parentPenaltyTotal > 50000 ? 'Medium' : 'Low',
          description: `Estimated regulatory and late-filing penalties of ${parentPenaltyTotal.toLocaleString()} USD across the group if compliance is not met. May include fines, late submission fees, and supervisory measures.`,
        });
      }
      if (complianceGaps.some((g) => g.status === 'Overdue')) {
        businessImpactList.push({
          type: 'Regulatory sanction',
          severity: 'High',
          description: 'Overdue submissions increase risk of regulatory findings, enforcement action, and reputational damage. Regulators may require remedial plans or impose restrictions.',
        });
      }
      businessImpactList.push({
        type: 'Reputational risk',
        severity: atRiskCount > 3 ? 'High' : 'Medium',
        description: 'Non-compliance or repeated delays can affect stakeholder trust, investor relations, and counterparty confidence in the group.',
      });
      businessImpactList.push({
        type: 'License and authorisation',
        severity: overallRiskLevel === 'High' ? 'High' : 'Medium',
        description: 'Persistent non-compliance may be considered in licence renewal or scope of authorisation. Some jurisdictions require disclosure of material compliance failures.',
      });
      businessImpactList.push({
        type: 'Board and governance',
        severity: 'Medium',
        description: 'Board and audit committees require clear reporting on compliance status. Gaps may trigger escalation, internal audit focus, and governance reviews.',
      });
    } else {
      businessImpactList.push({
        type: 'Current status',
        severity: 'Low',
        description: 'No material compliance gaps identified in this analysis. Continue to monitor deadlines and maintain controls.',
      });
    }

    const businessImpact = {
      summary: businessImpactList.length > 0
        ? `Failure to meet compliance obligations may result in ${businessImpactList.filter((i) => i.severity === 'High').length} high-severity and ${businessImpactList.filter((i) => i.severity === 'Medium').length} medium-severity business impacts, including financial penalties, regulatory action, and reputational risk.`
        : 'No significant business impact identified for the current risk level.',
      impacts: businessImpactList,
    };

    res.json({
      summary,
      byOpCo,
      chartData,
      explanation,
      upcomingDeadlines: upcomingDeadlines.slice(0, 20),
      financialPenalties,
      capitalInvestment,
      complianceGaps,
      businessImpact,
    });
  } catch (e) {
    console.error('Risk prediction error:', e);
    res.status(500).json({ error: e.message || 'Risk prediction failed' });
  }
});

analysisRouter.post('/ma-simulator', uploadDoc.single('document'), async (req, res) => {
  try {
    const parentGroup = (req.body && req.body.parentGroup) ? String(req.body.parentGroup).trim() : '';
    const target = (req.body && req.body.target) ? String(req.body.target).trim() : '';
    const file = req.file;
    const uboSummary = (req.body && req.body.uboSummary) ? String(req.body.uboSummary).trim() : '';
    const esgSummary = (req.body && req.body.esgSummary) ? String(req.body.esgSummary).trim() : '';
    const dataSovereigntySummary = (req.body && req.body.dataSovereigntySummary) ? String(req.body.dataSovereigntySummary).trim() : '';
    const dataSecuritySummary = (req.body && req.body.dataSecuritySummary) ? String(req.body.dataSecuritySummary).trim() : '';
    let uboData = null;
    let esgData = null;
    let heatMapRow = null;
    try {
      if (req.body.uboData && typeof req.body.uboData === 'string') uboData = JSON.parse(req.body.uboData);
      if (req.body.esgData && typeof req.body.esgData === 'string') esgData = JSON.parse(req.body.esgData);
      if (req.body.heatMapRow && typeof req.body.heatMapRow === 'string') heatMapRow = JSON.parse(req.body.heatMapRow);
    } catch (_) {}
    const reportId = `ma-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    let extractedSummary = '';
    let sections = [];

    let complianceDetail = null;
    let financialCommercial = null;
    let governanceFrameworkSummary = [];
    let multiJurisdictionMatrix = [];
    let frameworkList = [];
    let applicableFrameworksByJurisdiction = [];
    let keyProcessesByFramework = [];
    let complianceTimelines = [];
    let systemIntegrations = [];
    let timeModel = null;
    let financialModelling = null;

    let schemaVersion;
    let coefficientVersion;
    let methodologyNote;
    let riskRegister = [];
    let regulatoryMatrix = [];
    let valueBridge;
    let executiveSummary;
    let lineage = [];
    let csvExport = '';

    if (parentGroup && target) {
      const companiesData = await readFile(companiesPath, 'utf-8').then(JSON.parse).catch(() => ({}));
      const allChanges = await readFile(changesPath, 'utf-8').then(JSON.parse).catch(() => []);
      const synergyRaw = req.body?.synergyAnnualAed;
      let synergyAnnualAed;
      if (synergyRaw !== undefined && synergyRaw !== null && String(synergyRaw).trim() !== '') {
        const n = Number(synergyRaw);
        synergyAnnualAed = Number.isFinite(n) ? n : undefined;
      }
      const dealStructure = req.body?.dealStructure ? String(req.body.dealStructure).trim() : '';
      const regulatedTarget = req.body?.regulatedTarget === 'true' || req.body?.regulatedTarget === true;

      const assessment = await runMaAssessment({
        parentGroup,
        target,
        companiesData,
        changesData: Array.isArray(allChanges) ? allChanges : [],
        options: {
          synergyAnnualAed,
          dealStructure: dealStructure || undefined,
          regulatedTarget,
          heatMapRow,
        },
      });

      frameworkList = assessment.frameworkList;
      governanceFrameworkSummary = assessment.governanceFrameworkSummary;
      multiJurisdictionMatrix = assessment.multiJurisdictionMatrix;
      complianceDetail = assessment.complianceDetail;
      financialCommercial = assessment.financialCommercial;
      applicableFrameworksByJurisdiction = assessment.applicableFrameworksByJurisdiction;
      keyProcessesByFramework = assessment.keyProcessesByFramework;
      complianceTimelines = assessment.complianceTimelines;
      systemIntegrations = assessment.systemIntegrations;
      timeModel = assessment.timeModel;
      financialModelling = assessment.financialModelling;
      extractedSummary = assessment.extractedSummary;
      schemaVersion = assessment.schemaVersion;
      coefficientVersion = assessment.coefficientVersion;
      methodologyNote = assessment.methodologyNote;
      riskRegister = assessment.riskRegister;
      regulatoryMatrix = assessment.regulatoryMatrix;
      valueBridge = assessment.valueBridge;
      executiveSummary = assessment.executiveSummary;
      lineage = assessment.lineage;
      csvExport = assessment.csvExport || '';
    }

    const dataSovereigntyAssessmentStatus = dataSovereigntySummary
      ? { status: dataSovereigntySummary.length > 50 ? 'Complete' : 'In progress', summary: dataSovereigntySummary }
      : { status: 'Not started', summary: 'Data sovereignty assessment pending for target OpCo.' };
    const securityPostureAssessmentStatus = dataSecuritySummary
      ? { status: dataSecuritySummary.length > 50 ? 'Complete' : 'In progress', summary: dataSecuritySummary }
      : { status: 'Not started', summary: 'Security posture assessment pending for target OpCo.' };

    if (file && file.buffer) {
      const text = file.buffer.toString('utf-8', 0, Math.min(file.buffer.length, 50000));
      const hasContent = text.replace(/\s/g, '').length > 20;
      const docSummary = hasContent
        ? `Document "${file.originalname}" (${(file.size / 1024).toFixed(1)} KB) received and extracted. `
        : `Document "${file.originalname}" received. `;
      extractedSummary = (extractedSummary ? extractedSummary + ' ' : '') + docSummary;
      sections = [
        { title: 'Applicable frameworks', content: (complianceDetail && complianceDetail.frameworks.length) ? complianceDetail.frameworks.map((f) => `${f.name}: ${f.scope}`).join('; ') : 'UAE Federal Laws, CBUAE, DFSA, SAMA, CMA, SDAIA, ADGM, NESA as applicable to target.' },
        { title: 'Key obligations', content: (complianceDetail && complianceDetail.obligations.length) ? complianceDetail.obligations.join(' ') : 'Registration, AML/CFT, data protection, ongoing reporting and governance.' },
        { title: 'Gaps and recommendations', content: (complianceDetail && complianceDetail.gaps.length) ? complianceDetail.gaps.map((g) => (g.control || g) + ': ' + (g.description || g.remediation || '')).join(' ') : 'See compliance detail above. Full report available for download.' },
      ];
    } else if (!complianceDetail) {
      extractedSummary = extractedSummary || 'Select Parent Group and Target, then click Generate assessment. Optionally upload a document for extraction.';
      sections = [{ title: 'No selection', content: 'Please select both Parent Group and Target to generate the compliance and financial assessment.' }];
    }

    const summary = extractedSummary;
    const detailedOutcome = { sections };
    const reportLines = [
      'M&A Framework Assessment Report',
      'Generated: ' + new Date().toISOString(),
      'Parent Group: ' + parentGroup,
      'Target: ' + target,
      '',
      'Summary',
      summary,
    ];
    if (complianceDetail) {
      reportLines.push('', 'Compliance detail', 'Frameworks: ' + (complianceDetail.frameworks || []).map((f) => f.name).join(', '));
      reportLines.push('Obligations: ' + (complianceDetail.obligations || []).join(' | '));
      reportLines.push('Gaps: ' + (complianceDetail.gaps || []).map((g) => (g.control || g) + ' - ' + (g.description || g.remediation || '')).join('; '));
    }
    if (financialCommercial) {
      reportLines.push('', 'Financial and commercial', 'Manpower: ' + (financialCommercial.manpowerFte || '') + ' ' + (financialCommercial.manpowerCost || ''));
      reportLines.push('Cross-jurisdictional mapping: ' + (financialCommercial.crossJurisdictionalMapping || ''));
      reportLines.push('Additional costs: ' + (financialCommercial.additionalCosts || ''));
    }
    reportLines.push('', 'Detailed outcome', ...sections.map((s) => `${s.title}\n${s.content}`));
    const reportBody = reportLines.join('\n\n');

    const pdfFilename = `M&A-Framework-Assessment-${reportId}.pdf`;
    const pdfBytes = await buildMaAssessmentPdf({
      parentGroup,
      target,
      summary,
      complianceDetail,
      financialCommercial,
      sections,
      governanceFrameworkSummary,
      multiJurisdictionMatrix,
      uboSummary,
      esgSummary,
      dataSovereigntySummary,
      dataSecuritySummary,
      uboData,
      esgData,
      heatMapRow,
      applicableFrameworksByJurisdiction,
      keyProcessesByFramework,
      dataSovereigntyAssessmentStatus,
      securityPostureAssessmentStatus,
      financialModelling,
      systemIntegrations,
      timeModel,
      complianceTimelines,
    });

    const csvFilename = `M&A-Framework-Assessment-${reportId}.csv`;
    maReportStore.set(reportId, {
      body: reportBody,
      pdfBytes: Buffer.from(pdfBytes),
      filename: pdfFilename,
      csvText: csvExport || '',
      csvFilename,
    });
    setTimeout(() => maReportStore.delete(reportId), 60 * 60 * 1000);

    res.json({
      reportId,
      summary,
      detailedOutcome,
      complianceDetail: complianceDetail || undefined,
      financialCommercial: financialCommercial || undefined,
      applicableFrameworksByJurisdiction,
      keyProcessesByFramework,
      dataSovereigntyAssessmentStatus,
      securityPostureAssessmentStatus,
      financialModelling: financialModelling || undefined,
      systemIntegrations,
      timeModel: timeModel || undefined,
      complianceTimelines,
      downloadFilename: pdfFilename,
      csvDownloadFilename: csvFilename,
      schemaVersion,
      coefficientVersion,
      methodologyNote,
      riskRegister,
      regulatoryMatrix,
      valueBridge,
      executiveSummary,
      lineage,
    });
  } catch (e) {
    console.error('M&A simulator error:', e);
    res.status(500).json({ error: e.message || 'M&A simulator failed' });
  }
});

analysisRouter.get('/ma-simulator/report', (req, res) => {
  const reportId = req.query.reportId;
  if (!reportId) {
    return res.status(400).send('reportId required');
  }
  const stored = maReportStore.get(reportId);
  if (!stored) {
    return res.status(404).send('Report not found or expired');
  }
  const filename = stored.filename || 'M&A-Framework-Assessment.pdf';
  if (stored.pdfBytes) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(stored.pdfBytes);
  } else {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/\.pdf$/i, '.txt')}"`);
    res.send(stored.body);
  }
});

analysisRouter.get('/ma-simulator/csv', (req, res) => {
  const reportId = req.query.reportId;
  if (!reportId) {
    return res.status(400).send('reportId required');
  }
  const stored = maReportStore.get(reportId);
  if (!stored) {
    return res.status(404).send('Report not found or expired');
  }
  const filename = stored.csvFilename || 'M&A-Framework-Assessment.csv';
  const text = stored.csvText != null ? String(stored.csvText) : '';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(text || 'section,key,value\n');
});

analysisRouter.get('/ma-coefficients', async (req, res) => {
  try {
    const c = await loadCoefficients();
    res.json({
      version: c.version,
      methodologyNote: c.methodologyNote,
      rates: c.rates,
      timeModel: c.timeModel,
      defaultComplianceDays: c.defaultComplianceDays,
    });
  } catch (e) {
    console.error('ma-coefficients error:', e);
    res.status(500).json({ error: e.message || 'Failed to load coefficients' });
  }
});
