import { Router } from 'express';
import multer from 'multer';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as store from '../services/defenderStore.js';
import { processUpload } from '../services/defenderParserService.js';
import { computeSecurityPostureScore } from '../services/defenderScoringService.js';
import { generateDefenderSummary } from '../services/defenderSummaryService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dirname, '../data/companies.json');
const onboardingPath = join(__dirname, '../data/onboarding-opcos.json');

async function getOpcoNamesByParent(parentName) {
  const opcos = [];
  try {
    const raw = await readFile(dataPath, 'utf-8');
    const data = JSON.parse(raw);
    for (const [framework, entries] of Object.entries(data)) {
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (entry.parent !== parentName) continue;
        for (const name of entry.companies || []) {
          if (name) opcos.push(name);
        }
      }
    }
    const onb = await readFile(onboardingPath, 'utf-8').catch(() => '[]');
    const onboarding = JSON.parse(onb);
    for (const row of Array.isArray(onboarding) ? onboarding : []) {
      if (row.parent === parentName && row.opco) opcos.push(row.opco);
    }
  } catch (_) {}
  return [...new Set(opcos)];
}

/** Applicable frameworks per OpCo (mirrors client getFrameworksForOpco). Returns [{ id, label }]. */
const KSA_OPCO_NAMES = ['Saudi National Bank (SNB)', 'Al Rajhi Bank', 'Riyad Bank', 'STC Pay', 'Saudi Aramco', 'SABIC', 'Ma\'aden', 'Mada', 'Saudi Payments', 'NEOM', 'Red Sea Global', 'ROSHN', 'Saudi National Bank'];
const FRAMEWORK_LIST = [
  { id: 'SAMA CSF', label: 'SAMA CSF' },
  { id: 'SDAIA', label: 'SDAIA' },
  { id: 'CBUAE Cyber', label: 'CBUAE Cyber' },
  { id: 'NESA', label: 'NESA' },
  { id: 'QCERT', label: 'QCERT' },
];
function getApplicableFrameworksForOpco(opcoName) {
  const ksa = KSA_OPCO_NAMES.some((n) => opcoName === n || (opcoName && opcoName.includes(n)));
  if (ksa) return FRAMEWORK_LIST.filter((f) => f.id === 'SAMA CSF' || f.id === 'SDAIA');
  if (opcoName && /qatar|qcert/i.test(opcoName)) return FRAMEWORK_LIST.filter((f) => f.id === 'QCERT');
  return FRAMEWORK_LIST.filter((f) => f.id === 'CBUAE Cyber' || f.id === 'NESA');
}

function buildFrameworkCoverageFromEvidence(opcoName, scoreRecord, findings) {
  const frameworks = getApplicableFrameworksForOpco(opcoName);
  const coveragePct = Math.round(Number(scoreRecord?.evidence?.frameworkCoverage ?? scoreRecord?.score ?? 0));
  const gaps = (findings || [])
    .filter((f) => f.status !== 'resolved')
    .slice(0, 15)
    .map((f) => ({
      controlId: (f.id || '').slice(0, 20),
      controlName: (f.title || f.severity || 'Finding').slice(0, 80),
      description: (f.title || 'No description').slice(0, 300),
      remediationDeadline: f.remediationDeadline || null,
    }));
  return frameworks.map((f) => ({
    frameworkId: f.id,
    frameworkLabel: f.label,
    coveragePct,
    gaps,
  }));
}

const defenderRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

/** POST /api/defender/upload — multipart: file, opcoName, parentName?, reportDate?, reportType? */
defenderRouter.post('/upload', upload.single('file'), (req, res) => {
  try {
    const file = req.file;
    const opcoName = req.body?.opcoName || req.body?.opco;
    const parentName = req.body?.parentName || req.body?.parent;
    const reportDate = req.body?.reportDate || null;
    if (!file || !opcoName) {
      return res.status(400).json({ error: 'Missing file or opcoName' });
    }
    const record = store.addUpload({
      opcoName,
      parentName: parentName || null,
      filename: file.originalname,
      reportDate,
      status: 'processing',
    });
    setImmediate(async () => {
      try {
        const result = await processUpload(file.buffer, file.originalname, opcoName, parentName, reportDate);
        const scoreRecord = computeSecurityPostureScore(opcoName);
        store.updateUpload(record.id, {
          status: 'completed',
          reportType: result.reportType,
          secureScorePct: result.secureScorePct,
          compliancePct: result.compliancePct,
          findingsCount: result.findingsCount,
          snapshotCount: result.snapshotCount,
        });
        const findings = store.getFindingsByOpco(opcoName);
        const summaryText = await generateDefenderSummary(opcoName, {
          score: scoreRecord?.score,
          band: scoreRecord?.band,
          evidence: scoreRecord?.evidence,
          findings,
          reportType: result.reportType,
        });
        if (summaryText) store.setSummary(opcoName, summaryText);
      } catch (err) {
        store.updateUpload(record.id, { status: 'failed', error: err.message });
      }
    });
    res.status(202).json({ uploadId: record.id, status: 'processing' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** GET /api/defender/upload/:uploadId/status */
defenderRouter.get('/upload/:uploadId/status', (req, res) => {
  try {
    const u = store.getUploadById(req.params.uploadId);
    if (!u) return res.status(404).json({ error: 'Upload not found' });
    res.json({
      uploadId: u.id,
      status: u.status,
      opcoName: u.opcoName,
      reportType: u.reportType,
      secureScorePct: u.secureScorePct,
      compliancePct: u.compliancePct,
      findingsCount: u.findingsCount,
      error: u.error,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** GET /api/defender/score/:opcoName — current score and history (opcoName can be query or param) */
defenderRouter.get('/score/:opcoName', (req, res) => {
  try {
    const opcoName = decodeURIComponent(req.params.opcoName || '');
    if (!opcoName) return res.status(400).json({ error: 'opcoName required' });
    const latest = store.getLatestScore(opcoName);
    const history = store.getScoresByOpco(opcoName).sort(
      (a, b) => new Date(b.computedAt) - new Date(a.computedAt)
    );
    res.json({
      opcoName,
      current: latest,
      history: history.slice(0, 30),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** GET /api/defender/group-summary/:parentId — parentId = parent name; returns opcos with scores */
defenderRouter.get('/group-summary/:parentId', async (req, res) => {
  try {
    const parentName = decodeURIComponent(req.params.parentId || '');
    if (!parentName) return res.status(400).json({ error: 'parentId (parent name) required' });
    const opcoNames = await getOpcoNamesByParent(parentName);
    const summary = opcoNames.map((name) => {
      const score = store.getLatestScore(name);
      const summaryEntry = store.getSummary(name);
      let frameworkCoverage = null;
      if (score != null) {
        const findings = store.getFindingsByOpco(name);
        frameworkCoverage = buildFrameworkCoverageFromEvidence(name, score, findings);
      }
      return {
        opcoName: name,
        score: score?.score ?? null,
        band: score?.band ?? null,
        bandColor: score?.bandColor ?? null,
        computedAt: score?.computedAt ?? null,
        summary: summaryEntry?.summary ?? null,
        frameworkCoverage,
      };
    });
    res.json({ parentName, opcos: summary });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** GET /api/defender/findings/:opcoName */
defenderRouter.get('/findings/:opcoName', (req, res) => {
  try {
    const opcoName = decodeURIComponent(req.params.opcoName || '');
    const list = store.getFindingsByOpco(opcoName);
    res.json({ opcoName, findings: list });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** PATCH /api/defender/findings/:id/status — body: { status: 'resolved' | 'open' } */
defenderRouter.patch('/findings/:id/status', (req, res) => {
  try {
    const status = req.body?.status;
    if (!status) return res.status(400).json({ error: 'status required' });
    const updated = store.updateFindingStatus(req.params.id, status);
    if (!updated) return res.status(404).json({ error: 'Finding not found' });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** GET /api/defender/uploads/:opcoName */
defenderRouter.get('/uploads/:opcoName', (req, res) => {
  try {
    const opcoName = decodeURIComponent(req.params.opcoName || '');
    const list = store.getUploads().filter((u) => u.opcoName === opcoName);
    res.json({ opcoName, uploads: list });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export const defenderIntegrationRouter = defenderRouter;
