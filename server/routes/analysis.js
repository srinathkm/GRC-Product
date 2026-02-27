import { Router } from 'express';
import multer from 'multer';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createChatCompletion, isLlmConfigured } from '../services/llm.js';

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

const FRAMEWORK_SCOPES = {
  'DFSA Rulebook': 'DIFC financial services, conduct of business, prudential, AML/CFT',
  'SAMA': 'KSA banking, insurance, AML/CFT',
  'CMA': 'KSA capital markets, listing, corporate governance',
  'Dubai 2040': 'Dubai urban planning, sustainability',
  'Saudi 2030': 'Vision 2030, local content, sector strategy',
  'SDAIA': 'KSA data governance, AI ethics',
  'ADGM FSRA Rulebook': 'ADGM financial services, AML/CFT',
  'ADGM Companies Regulations': 'ADGM company registration',
  'CBUAE Rulebook': 'UAE federal banking, insurance, AML/CFT',
  'UAE AML/CFT': 'UAE federal AML/CFT',
  'UAE Federal Laws': 'UAE federal commercial, labour, sector laws',
  'JAFZA Operating Regulations': 'JAFZA licensing, customs',
  'DMCC Company Regulations': 'DMCC company formation',
  'DMCC Compliance & AML': 'DMCC AML/CFT',
  'QFCRA Rules': 'Qatar Financial Centre',
  'Qatar AML Law': 'Qatar AML/CFT',
  'CBB Rulebook': 'Bahrain banking, AML',
  'BHB Sustainability ESG': 'Bahrain Bourse ESG disclosure',
  'Oman CMA Regulations': 'Oman securities, governance',
  'Oman AML Law': 'Oman AML/CFT',
  'Kuwait CMA Regulations': 'Kuwait securities, listing',
  'Kuwait AML Law': 'Kuwait AML/CFT',
};

/** Framework -> zone/location for Multi Jurisdiction Matrix (aligned with client). */
const FRAMEWORK_TO_ZONE = {
  'DFSA Rulebook': { zone: 'DIFC', location: 'DIFC, Dubai, UAE' },
  'Dubai 2040': { zone: 'Dubai Mainland', location: 'Dubai, UAE' },
  SAMA: { zone: 'KSA Onshore', location: 'Saudi Arabia (KSA)' },
  CMA: { zone: 'KSA Onshore', location: 'Saudi Arabia (KSA)' },
  'Saudi 2030': { zone: 'KSA Onshore', location: 'Saudi Arabia (KSA)' },
  SDAIA: { zone: 'KSA Onshore', location: 'Saudi Arabia (KSA)' },
  'ADGM FSRA Rulebook': { zone: 'ADGM', location: 'Abu Dhabi Global Market, UAE' },
  'ADGM Companies Regulations': { zone: 'ADGM', location: 'Abu Dhabi Global Market, UAE' },
  'CBUAE Rulebook': { zone: 'Abu Dhabi Mainland', location: 'Abu Dhabi, UAE' },
  'UAE AML/CFT': { zone: 'UAE Federal', location: 'UAE' },
  'UAE Federal Laws': { zone: 'UAE Federal', location: 'UAE' },
  'JAFZA Operating Regulations': { zone: 'JAFZA', location: 'Dubai, UAE' },
  'DMCC Company Regulations': { zone: 'DMCC', location: 'Dubai, UAE' },
  'DMCC Compliance & AML': { zone: 'DMCC', location: 'Dubai, UAE' },
  'QFCRA Rules': { zone: 'Qatar QFC', location: 'Qatar' },
  'Qatar AML Law': { zone: 'Qatar', location: 'Qatar' },
  'CBB Rulebook': { zone: 'Bahrain', location: 'Bahrain' },
  'BHB Sustainability ESG': { zone: 'Bahrain', location: 'Bahrain' },
  'Oman CMA Regulations': { zone: 'Oman', location: 'Oman' },
  'Oman AML Law': { zone: 'Oman', location: 'Oman' },
  'Kuwait CMA Regulations': { zone: 'Kuwait', location: 'Kuwait' },
  'Kuwait AML Law': { zone: 'Kuwait', location: 'Kuwait' },
};

/** Key processes to complete per framework (governance / jurisdiction). */
const KEY_PROCESSES_BY_FRAMEWORK = {
  'DFSA Rulebook': ['Licence variation / notification to DFSA', 'AML/CFT policies and MLRO appointment', 'Conduct of business and client asset reporting', 'Prudential returns and capital adequacy'],
  'SAMA': ['SAMA registration / licence update', 'AML/CFT and sanctions compliance', 'Capital adequacy and liquidity reporting', 'Conduct and disclosure standards'],
  'CMA': ['CMA notification of change of control', 'Listing rules and disclosure', 'Corporate governance and board composition', 'Continuous disclosure obligations'],
  'CBUAE Rulebook': ['CBUAE notification / licence', 'AML/CFT and CDD alignment', 'Regulatory reporting and capital', 'Outsourcing and group policies'],
  'UAE AML/CFT': ['UBO and beneficial ownership register', 'AML/CFT policies and MLRO', 'STR reporting and record-keeping', 'Sanctions screening'],
  'UAE Federal Laws': ['Commercial licence and registration', 'Labour and immigration', 'Data protection (UAE PDPL)', 'Sector-specific authorisations'],
  'SDAIA': ['Data governance and classification', 'AI ethics and assurance', 'Cross-border data transfer', 'Localisation where required'],
  'ADGM FSRA Rulebook': ['ADGM registration / notification', 'AML/CFT and conduct', 'Prudential and reporting', 'Client assets and custody'],
  'ADGM Companies Regulations': ['Company registration and filings', 'Directors and shareholders', 'Annual returns'],
  'DMCC Company Regulations': ['DMCC company update', 'Licence and compliance', 'AML/CFT (DMCC)'],
  'DMCC Compliance & AML': ['AML/CFT policies', 'MLRO and reporting', 'Record-keeping'],
  'QFCRA Rules': ['QFC notification', 'AML/CFT', 'Regulatory reporting'],
  'Qatar AML Law': ['AML/CFT policies', 'UBO and CDD', 'STR and record-keeping'],
  'CBB Rulebook': ['CBB notification', 'AML and prudential', 'Reporting and governance'],
  'Oman CMA Regulations': ['CMA notification', 'Disclosure and governance'],
  'Oman AML Law': ['AML/CFT and UBO', 'Reporting'],
  'Kuwait CMA Regulations': ['CMA notification', 'Listing and disclosure'],
  'Kuwait AML Law': ['AML/CFT and UBO', 'Reporting'],
  'JAFZA Operating Regulations': ['JAFZA licence update', 'Customs and compliance'],
  'BHB Sustainability ESG': ['ESG disclosure and reporting', 'Governance alignment'],
  'Dubai 2040': ['Sustainability and urban compliance', 'Reporting as required'],
  'Saudi 2030': ['Local content and Vision 2030 alignment', 'Sector strategy compliance'],
};

/** Default timeline (days post-signing) for compliance types. */
const DEFAULT_COMPLIANCE_DAYS = {
  registration: 60,
  amlCft: 90,
  dataProtection: 120,
  reporting: 90,
  crossJurisdictional: 180,
  licence: 60,
  governance: 90,
};

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

    if (parentGroup && target) {
      const data = await readFile(companiesPath, 'utf-8').then(JSON.parse).catch(() => ({}));
      const frameworksForTarget = new Set();
      for (const [fw, entries] of Object.entries(data)) {
        if (!Array.isArray(entries)) continue;
        for (const entry of entries) {
          const companies = entry.companies || [];
          const parent = entry.parent || '';
          if (parent === target || companies.includes(target)) {
            frameworksForTarget.add(fw);
          }
        }
      }
      frameworkList = Array.from(frameworksForTarget);

      const allChanges = await readFile(changesPath, 'utf-8').then(JSON.parse).catch(() => []);
      const changesForTarget = (Array.isArray(allChanges) ? allChanges : [])
        .filter((c) => c.framework && frameworkList.includes(c.framework))
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
        .slice(0, 20)
        .map((c) => ({
          framework: c.framework,
          title: c.title || '',
          date: c.date || '',
          snippet: c.snippet || c.fullText?.slice(0, 200) || '',
        }));
      governanceFrameworkSummary = changesForTarget;

      multiJurisdictionMatrix = frameworkList.map((fw) => {
        const z = FRAMEWORK_TO_ZONE[fw];
        return { framework: fw, zone: z?.zone || '—', location: z?.location || '—' };
      });

      complianceDetail = {
        frameworks: frameworkList.length > 0
          ? frameworkList.map((name) => ({ name, scope: FRAMEWORK_SCOPES[name] || 'Sector-specific regulation', description: FRAMEWORK_SCOPES[name] }))
          : [
              { name: 'UAE Federal Laws', scope: 'UAE federal commercial, labour', description: 'Default for UAE entities' },
              { name: 'CBUAE Rulebook', scope: 'If financial', description: 'Banking and financial' },
              { name: 'SAMA', scope: 'If KSA financial', description: 'KSA banking' },
              { name: 'DFSA Rulebook', scope: 'If DIFC', description: 'DIFC financial' },
            ],
        obligations: [
          'Pre-incorporation: company registration, licensing, and any sector-specific authorisations in the target jurisdiction(s).',
          'AML/CFT: beneficial ownership, CDD, record-keeping, and reporting as per applicable framework(s).',
          'Data protection: UAE PDPL / KSA PDPL alignment for personal data; cross-border transfer mechanisms where relevant.',
          'Ongoing reporting and governance: capital adequacy, conduct of business, and disclosure as per regulator.',
          'Cross-jurisdictional: where target operates in multiple jurisdictions, ensure each jurisdiction\'s requirements are mapped and met.',
        ],
        gaps: [
          { control: 'Licence and registration', description: 'Confirm target\'s current licences and any new filings required post-acquisition', remediation: 'Legal and compliance review' },
          { control: 'AML/CFT and sanctions', description: 'Integrate target into group AML/sanctions policies and systems', remediation: 'Within 90 days of close' },
          { control: 'Data and IT systems', description: 'Map data flows and systems across jurisdictions; align to group standards', remediation: 'System mapping and integration plan' },
        ],
      };
      const fteEstimate = Math.min(10, Math.max(2, frameworkList.length + 1));
      const oneTimeLegal = 400000;
      const oneTimeCompliance = 350000;
      const oneTimeIT = 500000;
      const annualFte = fteEstimate * 440000;
      const annualAuditFees = 150000 + frameworkList.length * 25000;
      financialCommercial = {
        manpowerFte: `${fteEstimate} FTE (est. for compliance integration)`,
        manpowerCost: `${(fteEstimate * 440000).toLocaleString()} AED/year (blended rate)`,
        crossJurisdictionalMapping: `Target "${target}" under Parent Group "${parentGroup}" may span ${frameworkList.length || 2} jurisdiction(s). Map systems for: (1) Regulatory reporting per framework, (2) Data residency and localisation, (3) Shared services and outsourcing limits, (4) Licence and capital requirements per entity. Recommend a cross-jurisdictional system inventory and integration roadmap within 60 days of signing.`,
        additionalCosts: 'Estimated one-time integration: AED 550,000–1,500,000 (legal, compliance, and IT alignment). Annual ongoing: FTE above plus audit and regulatory fees (AED).',
      };

      const jurisdictionGroups = {};
      for (const fw of frameworkList) {
        const z = FRAMEWORK_TO_ZONE[fw];
        const jurisdiction = z?.zone || 'Other';
        if (!jurisdictionGroups[jurisdiction]) jurisdictionGroups[jurisdiction] = [];
        jurisdictionGroups[jurisdiction].push({ framework: fw, location: z?.location || '—' });
      }
      applicableFrameworksByJurisdiction = Object.entries(jurisdictionGroups).map(([jurisdiction, list]) => ({
        jurisdiction,
        location: list[0]?.location || '—',
        frameworks: list.map((x) => x.framework),
      }));

      keyProcessesByFramework = frameworkList.map((fw) => ({
        framework: fw,
        processes: KEY_PROCESSES_BY_FRAMEWORK[fw] || [
          'Licence/registration update',
          'AML/CFT and beneficial ownership',
          'Regulatory reporting alignment',
          'Data protection and governance',
        ],
      }));

      complianceTimelines = [
        { compliance: 'Company registration / licence update', framework: 'All', daysPostSigning: DEFAULT_COMPLIANCE_DAYS.registration },
        { compliance: 'AML/CFT and UBO integration', framework: 'AML/CFT frameworks', daysPostSigning: DEFAULT_COMPLIANCE_DAYS.amlCft },
        { compliance: 'Data protection and PDPL alignment', framework: 'Data governance', daysPostSigning: DEFAULT_COMPLIANCE_DAYS.dataProtection },
        { compliance: 'Regulatory reporting (first submissions)', framework: 'Sector regulators', daysPostSigning: DEFAULT_COMPLIANCE_DAYS.reporting },
        { compliance: 'Cross-jurisdictional system mapping', framework: 'Group compliance', daysPostSigning: DEFAULT_COMPLIANCE_DAYS.crossJurisdictional },
        { compliance: 'Governance and board alignment', framework: 'Governance frameworks', daysPostSigning: DEFAULT_COMPLIANCE_DAYS.governance },
      ];
      frameworkList.forEach((fw) => {
        const processes = KEY_PROCESSES_BY_FRAMEWORK[fw];
        if (processes && processes.length) {
          const days = fw.includes('AML') ? 90 : fw.includes('Data') || fw.includes('SDAIA') ? 120 : 90;
          processes.slice(0, 2).forEach((p, i) => {
            complianceTimelines.push({ compliance: p, framework: fw, daysPostSigning: days + i * 30 });
          });
        }
      });

      systemIntegrations = [
        { system: 'Core banking / finance', description: 'General ledger, regulatory reporting feeds', priority: 'High' },
        { system: 'AML/CFT and sanctions screening', description: 'CDD, transaction monitoring, sanctions lists', priority: 'High' },
        { system: 'HR and payroll', description: 'Employee data, payroll for group reporting', priority: 'Medium' },
        { system: 'Data warehouse and BI', description: 'Group reporting and dashboards', priority: 'Medium' },
        { system: 'Document and records management', description: 'Compliance records, retention', priority: 'Medium' },
        { system: 'Identity and access (IAM)', description: 'Single sign-on, role-based access', priority: 'High' },
      ];

      const totalWeeks = 26 + Math.min(frameworkList.length * 2, 12);
      timeModel = {
        totalWeeks,
        totalMonths: Math.round((totalWeeks / 4) * 10) / 10,
        phases: [
          { name: 'Due diligence and planning', weeks: 4 },
          { name: 'Licence and registration', weeks: 8 },
          { name: 'AML/CFT and data protection', weeks: 12 },
          { name: 'System integration and go-live', weeks: Math.max(8, totalWeeks - 24) },
        ],
      };

      financialModelling = {
        totalOneTimeAED: oneTimeLegal + oneTimeCompliance + oneTimeIT,
        totalAnnualAED: annualFte + annualAuditFees,
        breakdown: [
          { item: 'Legal and regulatory (one-time)', amountAED: oneTimeLegal, type: 'one-time' },
          { item: 'Compliance and policy (one-time)', amountAED: oneTimeCompliance, type: 'one-time' },
          { item: 'IT and system integration (one-time)', amountAED: oneTimeIT, type: 'one-time' },
          { item: 'Compliance FTE (annual)', amountAED: annualFte, type: 'annual' },
          { item: 'Audit and regulatory fees (annual)', amountAED: annualAuditFees, type: 'annual' },
        ],
      };

      extractedSummary = `Assessment for Parent Group "${parentGroup}" and Target "${target}". ${frameworkList.length || 4} framework(s) identified. Compliance detail and financial/commercial aspects below.`;
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

    maReportStore.set(reportId, {
      body: reportBody,
      pdfBytes: Buffer.from(pdfBytes),
      filename: pdfFilename,
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
