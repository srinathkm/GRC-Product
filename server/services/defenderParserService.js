import * as XLSX from 'xlsx';
import { parse } from 'csv-parse/sync';
import { extractTextFromBuffer } from './text-extract.js';
import * as store from './defenderStore.js';

function isPdfFilename(filename) {
  return (filename || '').toLowerCase().endsWith('.pdf');
}

const REPORT_TYPE_TABLE = {
  secure_score: ['secure score', 'secure score report', 'score'],
  recommendations: ['recommendations', 'recommendation'],
  regulatory_compliance: ['regulatory', 'compliance', 'compliance score'],
  vulnerability_assessment: ['vulnerability', 'va ', 'assessment'],
  alert_incident: ['alert', 'incident'],
};

function detectReportType(filename, headers) {
  const lower = (filename || '').toLowerCase() + ' ' + (headers || []).join(' ').toLowerCase();
  for (const [type, keywords] of Object.entries(REPORT_TYPE_TABLE)) {
    if (keywords.some((k) => lower.includes(k))) return type;
  }
  return 'secure_score';
}

function parseCsv(buffer) {
  const text = buffer.toString('utf8');
  return parse(text, { columns: true, skip_empty_lines: true, trim: true });
}

function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const first = workbook.SheetNames[0];
  const sheet = workbook.Sheets[first];
  return XLSX.utils.sheet_to_json(sheet);
}

function parseRows(buffer, filename) {
  const lower = (filename || '').toLowerCase();
  if (lower.endsWith('.csv')) return parseCsv(buffer);
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return parseExcel(buffer);
  return parseCsv(buffer);
}

function extractSecureScorePercentFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const patterns = [
    /secure\s*score\s*[:\s]*(\d+(?:\.\d+)?)\s*%?/i,
    /(?:score|secure\s*score)\s*[:\s]*(\d+(?:\.\d+)?)\s*%/i,
    /(\d+(?:\.\d+)?)\s*%\s*(?:secure|score)/i,
    /(?:microsoft\s*cloud\s*security\s*benchmark|defender\s*for\s*cloud)[\s\S]{0,200}?score\s*[:\s]*(\d+(?:\.\d+)?)\s*%?/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const n = parseFloat(m[1]);
      if (!Number.isNaN(n) && n >= 0 && n <= 100) return n;
    }
  }
  const anyPct = text.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
  if (anyPct) {
    const n = parseFloat(anyPct[1]);
    if (!Number.isNaN(n) && n >= 0 && n <= 100) return n;
  }
  return null;
}

function extractCompliancePercentFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const patterns = [
    /compliance\s*[:\s]*(\d+(?:\.\d+)?)\s*%?/i,
    /(?:passed|controls?\s*passed)\s*[:\s]*(\d+(?:\.\d+)?)\s*%?/i,
    /regulatory\s*compliance\s*[:\s]*(\d+(?:\.\d+)?)\s*%?/i,
    /(?:overall\s*)?compliance\s*score\s*[:\s]*(\d+(?:\.\d+)?)\s*%?/i,
    /(?:microsoft\s*cloud\s*security\s*benchmark)[\s\S]{0,300}?compliance\s*[:\s]*(\d+(?:\.\d+)?)\s*%?/i,
    /(?:microsoft\s*cloud\s*security\s*benchmark)[\s\S]{0,300}?(\d+(?:\.\d+)?)\s*%\s*(?:compliant|compliance|passed)/i,
    /control\s*compliance\s*[:\s]*(\d+(?:\.\d+)?)\s*%?/i,
    /(\d+)\s*of\s*(\d+)\s*controls?\s*passed/i,
    /(\d+(?:\.\d+)?)\s*%\s*(?:compliant|compliance|passed)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      let n;
      if (m[2] != null) {
        const num = parseInt(m[1], 10);
        const den = parseInt(m[2], 10);
        if (!Number.isNaN(num) && !Number.isNaN(den) && den > 0) n = Math.round((num / den) * 100);
      } else {
        n = parseFloat(m[1]);
      }
      if (n != null && !Number.isNaN(n) && n >= 0 && n <= 100) return n;
    }
  }
  const anyPct = text.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
  if (anyPct) {
    const n = parseFloat(anyPct[1]);
    if (!Number.isNaN(n) && n >= 0 && n <= 100) return n;
  }
  return null;
}

function extractFindingsFromText(text, reportType, opcoName, reportDate) {
  if (!text || typeof text !== 'string') return [];
  const findings = [];
  const idPrefix = 'fin-' + Date.now();
  const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const severityOrder = ['Critical', 'High', 'Medium', 'Low'];
  let idx = 0;
  for (const line of lines) {
    if (idx >= 30) break;
    let severity = 'Medium';
    for (const sev of severityOrder) {
      if (line.toLowerCase().startsWith(sev.toLowerCase() + ':') || line.toLowerCase().includes('-' + sev.toLowerCase() + '-')) {
        severity = sev;
        break;
      }
    }
    const title = line.replace(/^(Critical|High|Medium|Low)\s*[:\-]\s*/i, '').slice(0, 500);
    if (title.length < 10) continue;
    findings.push({
      id: idPrefix + '-' + idx,
      opcoName,
      reportType,
      reportDate,
      title,
      severity,
      status: 'open',
      source: 'defender_upload',
      createdAt: new Date().toISOString(),
    });
    idx += 1;
  }
  return findings;
}

/** Canonical column name lookup: common Defender/export headers → one key per purpose. */
const CSV_COLUMN_ALIASES = {
  secureScore: ['Secure Score %', 'Score %', 'secure_score', 'SecureScore', 'Current Score', 'CurrentScore', 'Score'],
  maxScore: ['Max Score', 'MaxScore', 'Total Score'],
  compliance: ['Compliance %', 'Passed %', 'Compliance', 'Passed', 'ComplianceScore'],
  state: ['State', 'Status', 'Recommendation State', 'AssessmentResult'],
  severity: ['Severity', 'Risk', 'Priority', 'RiskLevel'],
  recommendation: ['Recommendation', 'Title', 'Control', 'Finding', 'Name', 'DisplayName', 'RecommendationName'],
};
function getColumnValueFromAlias(row, aliasGroup) {
  const keys = CSV_COLUMN_ALIASES[aliasGroup];
  if (!keys) return null;
  for (const key of keys) {
    const v = row[key];
    if (v != null && String(v).trim() !== '') return v;
  }
  const rowKeys = Object.keys(row || {});
  const lowerKeys = keys.map((k) => k.toLowerCase());
  for (const rk of rowKeys) {
    if (lowerKeys.includes(rk.toLowerCase())) return row[rk];
  }
  return null;
}

function extractSecureScorePercent(rows) {
  for (const row of rows) {
    const raw = getColumnValueFromAlias(row, 'secureScore');
    if (raw != null) {
      const num = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
      if (!Number.isNaN(num) && num >= 0 && num <= 100) return num;
    }
    const current = getColumnValueFromAlias(row, 'secureScore');
    const max = getColumnValueFromAlias(row, 'maxScore');
    if (current != null && max != null) {
      const c = parseFloat(String(current).replace(/[^0-9.]/g, ''));
      const m = parseFloat(String(max).replace(/[^0-9.]/g, ''));
      if (!Number.isNaN(c) && !Number.isNaN(m) && m > 0) {
        const pct = Math.min(100, Math.round((c / m) * 100));
        return pct;
      }
    }
    for (const v of Object.values(row)) {
      const n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
      if (!Number.isNaN(n) && n >= 0 && n <= 100 && String(v).includes('%')) return n;
    }
  }
  return null;
}

function extractCompliancePercent(rows) {
  for (const row of rows) {
    const raw = getColumnValueFromAlias(row, 'compliance');
    if (raw != null) {
      const num = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
      if (!Number.isNaN(num) && num >= 0 && num <= 100) return num;
    }
  }
  return null;
}

/**
 * For Defender Recommendations CSV: compute compliance % from State (Healthy/Unhealthy)
 * and/or secure score from severity counts (100 - penalties) or from Current/Max score.
 */
function computeRecommendationsScores(rows) {
  if (!rows || rows.length === 0) return { secureScorePct: null, compliancePct: null };
  const stateCol = CSV_COLUMN_ALIASES.state;
  const severityCol = CSV_COLUMN_ALIASES.severity;
  let healthy = 0;
  let total = 0;
  const severityCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  for (const row of rows) {
    const state = getColumnValueFromAlias(row, 'state');
    const sev = getColumnValueFromAlias(row, 'severity');
    if (state != null) {
      total += 1;
      const s = String(state).toLowerCase();
      if (s === 'healthy' || s === 'succeeded' || s === 'pass' || s === 'passed') healthy += 1;
    }
    if (sev != null) {
      const s = String(sev).trim();
      if (severityCounts[s] !== undefined) severityCounts[s] += 1;
      else if (/critical/i.test(s)) severityCounts.Critical += 1;
      else if (/high/i.test(s)) severityCounts.High += 1;
      else if (/medium/i.test(s)) severityCounts.Medium += 1;
      else if (/low/i.test(s)) severityCounts.Low += 1;
    }
  }
  let compliancePct = null;
  if (total > 0) {
    compliancePct = Math.round((healthy / total) * 100);
  }
  const hasSeverity = Object.values(severityCounts).some((n) => n > 0);
  let secureScorePct = null;
  if (hasSeverity) {
    const penalty = severityCounts.Critical * 12 + severityCounts.High * 6 + severityCounts.Medium * 2 + severityCounts.Low * 0.5;
    secureScorePct = Math.max(0, Math.min(100, Math.round(100 - penalty)));
  }
  return { secureScorePct, compliancePct };
}

function extractFindings(rows, reportType, opcoName, reportDate) {
  const findings = [];
  const idPrefix = 'fin-' + Date.now();
  rows.slice(0, 50).forEach((row, i) => {
    const title = getColumnValueFromAlias(row, 'recommendation') ?? '';
    const severityRaw = getColumnValueFromAlias(row, 'severity');
    let severity = severityRaw != null ? String(severityRaw).trim() : 'Medium';
    if (!['Critical', 'High', 'Medium', 'Low'].includes(severity)) {
      if (/critical/i.test(severity)) severity = 'Critical';
      else if (/high/i.test(severity)) severity = 'High';
      else if (/medium/i.test(severity)) severity = 'Medium';
      else if (/low/i.test(severity)) severity = 'Low';
      else severity = 'Medium';
    }
    if (!title) return;
    findings.push({
      id: idPrefix + '-' + i,
      opcoName,
      reportType,
      reportDate,
      title: String(title).slice(0, 500),
      severity,
      status: 'open',
      source: 'defender_upload',
      createdAt: new Date().toISOString(),
    });
  });
  return findings;
}

async function processUploadPdf(buffer, filename, opcoName, parentName, reportDate) {
  const text = await extractTextFromBuffer(buffer, 'application/pdf');
  const reportType = detectReportType(filename, []);
  const secureScorePct = extractSecureScorePercentFromText(text);
  const compliancePct = extractCompliancePercentFromText(text);

  const snapshotRecords = [];
  const reportDateIso = reportDate || new Date().toISOString().slice(0, 10);
  if (secureScorePct != null) {
    snapshotRecords.push({
      opcoName,
      parentName: parentName || null,
      reportType: 'secure_score',
      reportDate: reportDateIso,
      value: secureScorePct,
      valueType: 'percentage',
      createdAt: new Date().toISOString(),
    });
  }
  if (compliancePct != null) {
    snapshotRecords.push({
      opcoName,
      parentName: parentName || null,
      reportType: 'regulatory_compliance',
      reportDate: reportDateIso,
      value: compliancePct,
      valueType: 'percentage',
      createdAt: new Date().toISOString(),
    });
  }
  if (snapshotRecords.length === 0) {
    const fallback = extractSecureScorePercentFromText(text) ?? extractCompliancePercentFromText(text);
    if (fallback != null) {
      snapshotRecords.push({
        opcoName,
        parentName: parentName || null,
        reportType,
        reportDate: reportDateIso,
        value: fallback,
        valueType: 'percentage',
        createdAt: new Date().toISOString(),
      });
    }
  }

  store.addSnapshots(snapshotRecords);
  const findings = extractFindingsFromText(text, reportType, opcoName, reportDateIso);
  if (findings.length) store.addFindings(findings);

  return {
    reportType,
    secureScorePct: secureScorePct ?? null,
    compliancePct: compliancePct ?? null,
    findingsCount: findings.length,
    snapshotCount: snapshotRecords.length,
  };
}

export async function processUpload(buffer, filename, opcoName, parentName, reportDate) {
  if (isPdfFilename(filename)) {
    return processUploadPdf(buffer, filename, opcoName, parentName, reportDate);
  }

  const rows = parseRows(buffer, filename);
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const reportType = detectReportType(filename, headers);

  let secureScorePct = extractSecureScorePercent(rows);
  let compliancePct = extractCompliancePercent(rows);
  if (reportType === 'recommendations') {
    const derived = computeRecommendationsScores(rows);
    if (secureScorePct == null && derived.secureScorePct != null) secureScorePct = derived.secureScorePct;
    if (compliancePct == null && derived.compliancePct != null) compliancePct = derived.compliancePct;
  }

  const snapshotRecords = [];
  const reportDateIso = reportDate || new Date().toISOString().slice(0, 10);
  if (secureScorePct != null) {
    snapshotRecords.push({
      opcoName,
      parentName: parentName || null,
      reportType: 'secure_score',
      reportDate: reportDateIso,
      value: secureScorePct,
      valueType: 'percentage',
      createdAt: new Date().toISOString(),
    });
  }
  if (compliancePct != null) {
    snapshotRecords.push({
      opcoName,
      parentName: parentName || null,
      reportType: 'regulatory_compliance',
      reportDate: reportDateIso,
      value: compliancePct,
      valueType: 'percentage',
      createdAt: new Date().toISOString(),
    });
  }
  if (snapshotRecords.length === 0 && rows.length > 0) {
    snapshotRecords.push({
      opcoName,
      parentName: parentName || null,
      reportType,
      reportDate: reportDateIso,
      value: compliancePct ?? secureScorePct ?? 0,
      valueType: 'percentage',
      createdAt: new Date().toISOString(),
    });
  }

  store.addSnapshots(snapshotRecords);

  const findings = extractFindings(rows, reportType, opcoName, reportDateIso);
  if (findings.length) store.addFindings(findings);

  return {
    reportType,
    secureScorePct: secureScorePct ?? null,
    compliancePct: compliancePct ?? null,
    findingsCount: findings.length,
    snapshotCount: snapshotRecords.length,
  };
}
