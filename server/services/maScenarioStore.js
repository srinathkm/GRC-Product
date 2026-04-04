/**
 * File-backed persistence for M&A deal scenarios (Phase B).
 * Storage: server/data/ma-scenarios/scenarios.json
 * Access control: callers must supply matching parentGroup for every read/write (IDOR mitigation).
 */

import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const USE_CUSTOM = process.env.MA_SCENARIOS_PATH;
const DATA_DIR = USE_CUSTOM ? dirname(USE_CUSTOM) : join(__dirname, '../data/ma-scenarios');
const DATA_FILE = USE_CUSTOM || join(DATA_DIR, 'scenarios.json');

const DEFAULT_DB = { version: 1, scenarios: [] };

/** Serialize write operations (single-process). */
let _writeQueue = Promise.resolve();

function enqueueWrite(fn) {
  const run = _writeQueue.then(() => fn());
  _writeQueue = run.catch(() => {});
  return run;
}

async function ensureStore() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await readFile(DATA_FILE, 'utf-8');
  } catch {
    await writeFile(DATA_FILE, JSON.stringify(DEFAULT_DB, null, 2), 'utf-8');
  }
}

export async function readDb() {
  await ensureStore();
  const raw = await readFile(DATA_FILE, 'utf-8');
  const db = JSON.parse(raw);
  if (!Array.isArray(db.scenarios)) db.scenarios = [];
  if (typeof db.version !== 'number') db.version = 1;
  return db;
}

async function writeDb(db) {
  await writeFile(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

function newScenarioId() {
  return `ma-scn-${Date.now()}-${randomBytes(4).toString('hex')}`;
}

function trimStr(s, max) {
  if (s == null) return '';
  const t = String(s).trim();
  return t.length > max ? t.slice(0, max) : t;
}

/**
 * Strip non-JSON-safe or oversized fields from assessment payload before storage.
 */
export function sanitizeAssessmentSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return {};
  const o = { ...snapshot };
  delete o.pdfBytes;
  if (typeof o.csvExport === 'string' && o.csvExport.length > 500_000) {
    o.csvExport = o.csvExport.slice(0, 500_000) + '\n…(truncated)';
  }
  return o;
}

/**
 * List scenarios for a parent group (excludes soft-deleted).
 */
export async function listScenarios(parentGroup) {
  const pg = trimStr(parentGroup, 500);
  if (!pg) return [];
  const db = await readDb();
  return db.scenarios
    .filter((s) => s.parentGroup === pg && !s.deletedAt)
    .map((s) => ({
      id: s.id,
      name: s.name,
      parentGroup: s.parentGroup,
      target: s.target,
      dealStructure: s.dealStructure ?? null,
      coefficientVersion: s.coefficientVersion ?? null,
      schemaVersion: s.schemaVersion ?? null,
      reportId: s.reportId ?? null,
      updatedAt: s.audit?.updatedAt ?? s.audit?.createdAt,
      createdAt: s.audit?.createdAt,
      version: s.audit?.version ?? 1,
      /** Summary metrics from last snapshot for list/compare pickers */
      totalOneTimeAED: s.assessmentSnapshot?.financialModelling?.totalOneTimeAED ?? null,
      totalAnnualAED: s.assessmentSnapshot?.financialModelling?.totalAnnualAED ?? null,
      totalWeeks: s.assessmentSnapshot?.timeModel?.totalWeeks ?? null,
    }))
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

/**
 * Get one scenario; returns null if parent mismatch or missing.
 */
export async function getScenario(parentGroup, scenarioId) {
  const pg = trimStr(parentGroup, 500);
  const id = trimStr(scenarioId, 120);
  if (!pg || !id) return null;
  const db = await readDb();
  const s = db.scenarios.find((x) => x.id === id && !x.deletedAt);
  if (!s || s.parentGroup !== pg) return null;
  return s;
}

/**
 * Create scenario with assessment snapshot + audit metadata.
 */
export async function createScenario({
  parentGroup,
  name,
  target,
  dealStructure,
  synergyAnnualAed,
  regulatedTarget,
  reportId,
  assessmentSnapshot,
  actor,
}) {
  const pg = trimStr(parentGroup, 500);
  const nm = trimStr(name, 200);
  const tg = trimStr(target, 500);
  if (!pg || !nm || !tg) {
    const err = new Error('parentGroup, name, and target are required');
    err.statusCode = 400;
    throw err;
  }
  const now = new Date().toISOString();
  const snap = sanitizeAssessmentSnapshot(assessmentSnapshot);
  const record = {
    id: newScenarioId(),
    name: nm,
    parentGroup: pg,
    target: tg,
    dealStructure: dealStructure != null ? trimStr(dealStructure, 80) : null,
    synergyAnnualAed: synergyAnnualAed != null && Number.isFinite(Number(synergyAnnualAed)) ? Number(synergyAnnualAed) : null,
    regulatedTarget: regulatedTarget === true,
    reportId: reportId ? trimStr(reportId, 120) : null,
    assessmentSnapshot: snap,
    audit: {
      createdAt: now,
      updatedAt: now,
      createdBy: trimStr(actor, 200) || 'anonymous',
      updatedBy: trimStr(actor, 200) || 'anonymous',
      version: 1,
    },
  };
  if (snap.coefficientVersion) record.coefficientVersion = snap.coefficientVersion;
  if (snap.schemaVersion) record.schemaVersion = snap.schemaVersion;

  await enqueueWrite(async () => {
    const db = await readDb();
    db.scenarios.push(record);
    await writeDb(db);
  });
  return record;
}

/**
 * Update name or replace assessment snapshot (new version).
 */
export async function updateScenario(parentGroup, scenarioId, { name, assessmentSnapshot, reportId, actor }) {
  const pg = trimStr(parentGroup, 500);
  const id = trimStr(scenarioId, 120);
  if (!pg || !id) {
    const err = new Error('parentGroup and scenarioId are required');
    err.statusCode = 400;
    throw err;
  }
  const now = new Date().toISOString();
  await enqueueWrite(async () => {
    const db = await readDb();
    const idx = db.scenarios.findIndex((x) => x.id === id && !x.deletedAt);
    if (idx < 0) {
      const err = new Error('Scenario not found');
      err.statusCode = 404;
      throw err;
    }
    const s = db.scenarios[idx];
    if (s.parentGroup !== pg) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }
    if (name != null) s.name = trimStr(name, 200);
    if (assessmentSnapshot != null) {
      s.assessmentSnapshot = sanitizeAssessmentSnapshot(assessmentSnapshot);
      if (s.assessmentSnapshot.coefficientVersion) s.coefficientVersion = s.assessmentSnapshot.coefficientVersion;
      if (s.assessmentSnapshot.schemaVersion) s.schemaVersion = s.assessmentSnapshot.schemaVersion;
    }
    if (reportId != null) s.reportId = trimStr(reportId, 120) || null;
    s.audit = s.audit || {};
    s.audit.updatedAt = now;
    s.audit.updatedBy = trimStr(actor, 200) || 'anonymous';
    s.audit.version = (s.audit.version || 1) + 1;
    db.scenarios[idx] = s;
    await writeDb(db);
  });
  return await getScenario(pg, id);
}

/**
 * Soft-delete scenario.
 */
export async function deleteScenario(parentGroup, scenarioId, actor) {
  const pg = trimStr(parentGroup, 500);
  const id = trimStr(scenarioId, 120);
  if (!pg || !id) {
    const err = new Error('parentGroup and scenarioId are required');
    err.statusCode = 400;
    throw err;
  }
  const now = new Date().toISOString();
  await enqueueWrite(async () => {
    const db = await readDb();
    const idx = db.scenarios.findIndex((x) => x.id === id && !x.deletedAt);
    if (idx < 0) {
      const err = new Error('Scenario not found');
      err.statusCode = 404;
      throw err;
    }
    const s = db.scenarios[idx];
    if (s.parentGroup !== pg) {
      const err = new Error('Forbidden');
      err.statusCode = 403;
      throw err;
    }
    s.deletedAt = now;
    s.deletedBy = trimStr(actor, 200) || 'anonymous';
    await writeDb(db);
  });
  return { ok: true };
}

/**
 * Diff two assessment snapshots for compare view.
 */
export function diffAssessments(snapshotA, snapshotB) {
  const a = snapshotA || {};
  const b = snapshotB || {};
  const fwA = new Set(a.frameworkList || []);
  const fwB = new Set(b.frameworkList || []);
  const onlyInA = [...fwA].filter((x) => !fwB.has(x));
  const onlyInB = [...fwB].filter((x) => !fwA.has(x));

  const oneA = a.financialModelling?.totalOneTimeAED;
  const oneB = b.financialModelling?.totalOneTimeAED;
  const annA = a.financialModelling?.totalAnnualAED;
  const annB = b.financialModelling?.totalAnnualAED;
  const wA = a.timeModel?.totalWeeks;
  const wB = b.timeModel?.totalWeeks;

  return {
    financial: {
      totalOneTimeAED_A: oneA ?? null,
      totalOneTimeAED_B: oneB ?? null,
      totalOneTimeDelta: (Number(oneA) || 0) - (Number(oneB) || 0),
      totalAnnualAED_A: annA ?? null,
      totalAnnualAED_B: annB ?? null,
      totalAnnualDelta: (Number(annA) || 0) - (Number(annB) || 0),
    },
    timeline: {
      totalWeeks_A: wA ?? null,
      totalWeeks_B: wB ?? null,
      weeksDelta: (Number(wA) || 0) - (Number(wB) || 0),
    },
    frameworks: {
      onlyInA,
      onlyInB,
      countA: fwA.size,
      countB: fwB.size,
    },
    risks: {
      countA: (a.riskRegister || []).length,
      countB: (b.riskRegister || []).length,
    },
    schema: {
      schemaVersion_A: a.schemaVersion ?? null,
      schemaVersion_B: b.schemaVersion ?? null,
      coefficientVersion_A: a.coefficientVersion ?? null,
      coefficientVersion_B: b.coefficientVersion ?? null,
    },
  };
}

export async function compareStoredScenarios(parentGroup, idA, idB) {
  const a = await getScenario(parentGroup, idA);
  const b = await getScenario(parentGroup, idB);
  if (!a || !b) {
    const err = new Error('One or both scenarios not found');
    err.statusCode = 404;
    throw err;
  }
  return {
    scenarioA: {
      id: a.id,
      name: a.name,
      target: a.target,
      updatedAt: a.audit?.updatedAt,
    },
    scenarioB: {
      id: b.id,
      name: b.name,
      target: b.target,
      updatedAt: b.audit?.updatedAt,
    },
    diff: diffAssessments(a.assessmentSnapshot, b.assessmentSnapshot),
  };
}
