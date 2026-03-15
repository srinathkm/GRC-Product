/**
 * extract.js  –  /api/extract
 * ============================
 * Universal document-intelligence API.
 *
 * POST /api/extract
 *   Single-file extraction for any module.
 *   Body: multipart/form-data
 *     file    – document file (PDF, DOCX, DOC, image)
 *     module  – one of: poa | contracts | ip | licences | litigations | ubo
 *     only    – (optional) comma-separated list of field names to extract
 *   Response: { module, filename, fields: { name: {value, confidence, label} }, learningCount }
 *
 * POST /api/extract/batch
 *   Batch extraction — up to 50 files in one request.
 *   Body: multipart/form-data
 *     files[]  – array of document files
 *     module   – module type (same for all files in the batch)
 *   Response: { module, results: [ { filename, fields, error? }, … ] }
 *   Designed for bulk onboarding of 100s of documents.
 *
 * POST /api/extract/feedback
 *   Record user corrections as high-confidence learning signal.
 *   Body: JSON { module, corrections: { fieldName: correctedValue } }
 *   Response: { ok: true, learningCount }
 *
 * GET /api/extract/schema/:module
 *   Returns the field schema for a module so the UI knows what to expect.
 *
 * GET /api/extract/learning-stats
 *   Returns per-module extraction counts and fields learned.
 */

import { Router }  from 'express';
import multer      from 'multer';
import { extractTextFromBuffer } from '../services/text-extract.js';
import { extractDocumentFields, getModuleSchema, listModules } from '../services/documentIntelligence.js';
import { recordExtraction, recordFeedback, getLearningStats, getModuleMappings } from '../services/fieldLearningService.js';
import { isLlmConfigured } from '../services/llm.js';

const MAX_FILE_SIZE   = 25 * 1024 * 1024; // 25 MB per file
const MAX_BATCH_FILES = 50;

const ALLOWED_MIMETYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg', 'image/png', 'image/tiff', 'image/jpg', 'image/gif', 'image/webp',
  'text/plain',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_, file, cb) => {
    const ok =
      ALLOWED_MIMETYPES.has(file.mimetype) ||
      /\.(pdf|doc|docx|jpg|jpeg|png|tiff|tif|txt)$/i.test(file.originalname);
    cb(ok ? null : new Error('Unsupported file type'), ok);
  },
});

export const extractRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function validateModule(module, res) {
  const valid = listModules();
  if (!module || !valid.includes(module)) {
    res.status(400).json({ error: `Invalid module. Must be one of: ${valid.join(', ')}` });
    return false;
  }
  return true;
}

async function processFile(file, moduleType, only) {
  const text = await extractTextFromBuffer(file.buffer, file.mimetype);
  const { fields, rawResponse, error } = await extractDocumentFields(
    text, moduleType, { filename: file.originalname, only }
  );

  if (error) return { filename: file.originalname, fields: {}, error };

  // Record into learning store (fire-and-forget — don't block response)
  recordExtraction(moduleType, fields).catch(() => {});

  return { filename: file.originalname, fields };
}

// ── POST /api/extract  (single file) ─────────────────────────────────────────
extractRouter.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!isLlmConfigured()) {
      return res.status(503).json({ error: 'LLM is not configured on this server. Set LLM_API_KEY.' });
    }

    const moduleType = (req.body?.module || '').trim().toLowerCase();
    if (!validateModule(moduleType, res)) return;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Send file as multipart field "file".' });
    }

    const only = req.body?.only
      ? String(req.body.only).split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;

    const result = await processFile(req.file, moduleType, only);

    const moduleMappings = await getModuleMappings(moduleType);
    result.module       = moduleType;
    result.learningCount = moduleMappings._count || 0;

    if (result.error) return res.status(422).json(result);
    return res.json(result);

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Extraction failed' });
  }
});

// ── POST /api/extract/batch  (multiple files) ─────────────────────────────────
extractRouter.post('/batch', upload.array('files', MAX_BATCH_FILES), async (req, res) => {
  try {
    if (!isLlmConfigured()) {
      return res.status(503).json({ error: 'LLM is not configured on this server.' });
    }

    const moduleType = (req.body?.module || '').trim().toLowerCase();
    if (!validateModule(moduleType, res)) return;

    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded. Send files as multipart field "files[]".' });
    }

    const only = req.body?.only
      ? String(req.body.only).split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;

    // Process files concurrently (cap at 8 parallel to avoid LLM rate limits)
    const CONCURRENCY = 8;
    const results = [];
    for (let i = 0; i < files.length; i += CONCURRENCY) {
      const chunk = files.slice(i, i + CONCURRENCY);
      const chunkResults = await Promise.all(
        chunk.map((f) => processFile(f, moduleType, only))
      );
      results.push(...chunkResults);
    }

    const moduleMappings = await getModuleMappings(moduleType);

    return res.json({
      module:        moduleType,
      total:         files.length,
      succeeded:     results.filter((r) => !r.error).length,
      failed:        results.filter((r) =>  r.error).length,
      learningCount: moduleMappings._count || 0,
      results,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Batch extraction failed' });
  }
});

// ── POST /api/extract/feedback  (user corrections → learning) ─────────────────
extractRouter.post('/feedback', async (req, res) => {
  try {
    const { module: moduleType, corrections } = req.body || {};

    if (!moduleType || typeof corrections !== 'object') {
      return res.status(400).json({ error: 'module and corrections object are required' });
    }
    if (!listModules().includes(moduleType)) {
      return res.status(400).json({ error: `Unknown module: ${moduleType}` });
    }

    await recordFeedback(moduleType, corrections);

    const moduleMappings = await getModuleMappings(moduleType);
    return res.json({ ok: true, learningCount: moduleMappings._count || 0 });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/extract/schema/:module ──────────────────────────────────────────
extractRouter.get('/schema/:module', (req, res) => {
  const schema = getModuleSchema(req.params.module);
  if (!schema) {
    return res.status(404).json({ error: `No schema for module: ${req.params.module}` });
  }
  return res.json({ module: req.params.module, fields: schema });
});

// ── GET /api/extract/learning-stats ──────────────────────────────────────────
extractRouter.get('/learning-stats', async (req, res) => {
  try {
    const stats = await getLearningStats();
    return res.json({ stats });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
