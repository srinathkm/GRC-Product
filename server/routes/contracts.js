import { Router } from 'express';
import multer from 'multer';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { isLlmConfigured } from '../services/llm.js';
import { extractTextFromBuffer } from '../services/text-extract.js';
import { extractDocumentFields } from '../services/documentIntelligence.js';
import { recordExtraction } from '../services/fieldLearningService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '../data/contracts.json');
const UPLOADS_DIR = join(__dirname, '../data/contract-uploads');

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const contractUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_, file, cb) => {
    const allowed =
      /\.(pdf|doc|docx|jpg|jpeg|png|tiff|tif)$/i.test(file.originalname) ||
      [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
        'image/tiff',
        'image/jpg',
      ].includes(file.mimetype);
    if (allowed) cb(null, true);
    else cb(new Error('Only PDF, DOC, DOCX, JPG, PNG, TIFF are allowed (max 25MB)'), false);
  },
});

async function ensureUploadsDir() {
  try {
    await mkdir(UPLOADS_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

async function loadContracts() {
  try {
    const raw = await readFile(DATA_PATH, 'utf-8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function saveContracts(list) {
  await writeFile(DATA_PATH, JSON.stringify(list, null, 2), 'utf-8');
}

export const contractsRouter = Router();

/**
 * Extract contract fields from document text using the universal documentIntelligence
 * engine. This gives contracts the same two-pass strategy, learning-context injection,
 * and continuous improvement as all other modules.
 */
async function extractContractFieldsFromText(text) {
  if (!text || !isLlmConfigured()) return null;

  const { fields, error } = await extractDocumentFields(text, 'contracts');
  if (error || !fields || Object.keys(fields).length === 0) return null;

  // Flatten {value, confidence, label} → plain values
  const flat = {};
  for (const [k, v] of Object.entries(fields)) {
    flat[k] = v?.value ?? null;
  }

  // Apply fixed 12-month renewal business rule:
  // renewal window start = expiryDate + 12 months
  // renewal window end   = renewal window start + 12 months
  let renewalStart = flat.renewalWindowStart ?? null;
  let renewalEnd   = flat.renewalWindowEnd   ?? null;
  if (flat.expiryDate) {
    const base = new Date(flat.expiryDate);
    if (!Number.isNaN(base.getTime())) {
      const toIsoDate = (dt) => dt.toISOString().slice(0, 10);
      const start = new Date(base.getTime());
      start.setMonth(start.getMonth() + 12);
      const end = new Date(start.getTime());
      end.setMonth(end.getMonth() + 12);
      renewalStart = toIsoDate(start);
      renewalEnd   = toIsoDate(end);
    }
  }

  return {
    title:        flat.title        ?? null,
    vatAmount:    flat.vatAmount    ?? null,
    taxAmount:    flat.taxAmount    ?? null,
    netAmount:    flat.netAmount    ?? null,
    totalAmount:  flat.totalAmount  ?? null,
    effectiveDate: flat.effectiveDate ?? null,
    expiryDate:   flat.expiryDate   ?? null,
    renewalStart,   // backward-compat names used by ContractsManagement.jsx
    renewalEnd,
    counterparty: flat.counterparty ?? null,
    contractType: flat.contractType ?? null,
    riskLevel:    flat.riskLevel    ?? null,
    parent:       flat.parent       ?? null,
    opco:         flat.opco         ?? null,
  };
}

async function extractContractFieldsFromBuffer(buffer, mimetype) {
  try {
    const text = await extractTextFromBuffer(buffer, mimetype || 'application/octet-stream');
    if (!text) return null;
    return await extractContractFieldsFromText(text);
  } catch (e) {
    console.error('Contract text extract error:', e.message);
    return null;
  }
}

// Generate a human-readable Contract ID (key for lookup)
function generateContractId() {
  const t = Date.now().toString(36).slice(-6).toUpperCase();
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CON-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${t}-${r}`;
}

// GET /api/contracts?parent=&opco=&contractId= — contractId optional for lookup
contractsRouter.get('/', async (req, res) => {
  try {
    const all = await loadContracts();
    const parent = typeof req.query.parent === 'string' ? req.query.parent.trim() : '';
    const opco = typeof req.query.opco === 'string' ? req.query.opco.trim() : '';
    const contractId = typeof req.query.contractId === 'string' ? req.query.contractId.trim() : '';
    const filtered = all.filter((r) => {
      if (contractId) {
        const key = (r.contractId || r.documentLink || '').toString().toLowerCase();
        if (key !== contractId.toLowerCase()) return false;
      }
      if (parent && r.parent !== parent) return false;
      if (opco && String(r.opco || '').trim() !== opco) return false;
      return true;
    });
    res.json(filtered);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to load contract records' });
  }
});

// GET /api/contracts/file/:fileId — serve uploaded contract file
contractsRouter.get('/file/:fileId', async (req, res) => {
  try {
    const fileId = (req.params.fileId || '').trim();
    if (!fileId || /[^a-zA-Z0-9_.-]/.test(fileId)) {
      return res.status(400).json({ error: 'Invalid file id' });
    }
    if (fileId.includes('..')) return res.status(400).json({ error: 'Invalid file id' });
    const path = join(UPLOADS_DIR, fileId);
    const raw = await readFile(path);
    const ext = fileId.split('.').pop()?.toLowerCase();
    const mime = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', tiff: 'image/tiff', tif: 'image/tiff' }[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.send(raw);
  } catch (e) {
    if (e.code === 'ENOENT') return res.status(404).json({ error: 'File not found' });
    res.status(500).json({ error: e.message || 'Failed to serve file' });
  }
});

// POST /api/contracts — create or update
contractsRouter.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const parent = (body.parent || '').trim();
    const opco = (body.opco || '').trim();
    const contractType = (body.contractType || '').trim();
    const title = (body.title || '').trim();
    if (!contractType) {
      return res.status(400).json({ error: 'contractType is required' });
    }
    const nowIso = new Date().toISOString();
    const all = await loadContracts();
    let updated;
    if (body.id) {
      updated = all.map((r) =>
        r.id === body.id
          ? {
              ...r,
              ...body,
              parent,
              opco: opco || r.opco,
              contractType,
              title: title || r.title,
              updatedAt: nowIso,
            }
          : r
      );
    } else {
      const rec = {
        id: `con-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: nowIso,
        updatedAt: nowIso,
        ...body,
        parent,
        opco: opco || '',
        contractType,
        title: title || '',
      };
      updated = [rec, ...all];
    }
    await saveContracts(updated);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to save contract record' });
  }
});

// PATCH /api/contracts/:id — workflow (status, pendingApprovalFrom, reviewDueBy, assignedTo)
contractsRouter.patch('/:id', async (req, res) => {
  try {
    const id = (req.params.id || '').trim();
    const body = req.body || {};
    const all = await loadContracts();
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Contract not found' });
    const allowed = ['status', 'pendingApprovalFrom', 'reviewDueBy', 'assignedTo'];
    const updates = {};
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key];
    }
    const nowIso = new Date().toISOString();
    all[idx] = { ...all[idx], ...updates, updatedAt: nowIso };
    await saveContracts(all);
    res.json({ ok: true, contract: all[idx] });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to update workflow' });
  }
});

// POST /api/contracts/upload — multipart "files" (multiple); stores each, returns fileId + contractId per file
// When LLM is configured, also extracts VAT/tax, net/total, dates and counterparty for each document.
contractsRouter.post('/upload', contractUpload.array('files', 20), async (req, res) => {
  try {
    const files = req.files && Array.isArray(req.files) ? req.files : [];
    if (files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    await ensureUploadsDir();
    const results = [];
    const baseTime = Date.now();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = (file.originalname || '').split('.').pop()?.toLowerCase() || 'bin';
      const safeExt = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'tiff', 'tif'].includes(ext) ? ext : 'bin';
      const fileId = `contract-${baseTime}-${i}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
      const contractId = generateContractId();
      const path = join(UPLOADS_DIR, fileId);
      await writeFile(path, file.buffer);
      const extracted = await extractContractFieldsFromBuffer(file.buffer, file.mimetype || 'application/octet-stream');
      if (extracted) {
        const learningFields = Object.fromEntries(
          Object.entries(extracted).filter(([, v]) => v !== '' && v != null)
            .map(([k, v]) => [k, { value: v, confidence: 0.8, label: '' }])
        );
        recordExtraction('contracts', learningFields).catch(() => {});
      }
      results.push({
        fileId,
        contractId,
        originalName: file.originalname || 'document',
        extracted: extracted || null,
      });
    }
    res.json({ ok: true, results });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Upload failed' });
  }
});
