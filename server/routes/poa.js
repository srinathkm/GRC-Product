import { Router } from 'express';
import multer from 'multer';
import { readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createChatCompletion, isLlmConfigured } from '../services/llm.js';
import { extractTextFromBuffer } from '../services/text-extract.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '../data/poa.json');

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const poaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_, file, cb) => {
    const allowed =
      /\.(pdf|jpg|jpeg|png|tiff|tif)$/i.test(file.originalname) ||
      [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/tiff',
        'image/jpg',
      ].includes(file.mimetype);
    if (allowed) cb(null, true);
    else cb(new Error('Only PDF, JPG, PNG, TIFF are allowed (max 25MB)'), false);
  },
});

async function loadPoa() {
  try {
    const raw = await readFile(DATA_PATH, 'utf-8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function savePoa(list) {
  await writeFile(DATA_PATH, JSON.stringify(list, null, 2), 'utf-8');
}

export const poaRouter = Router();

// GET /api/poa?parent=&opco=&fileId=
poaRouter.get('/', async (req, res) => {
  try {
    const all = await loadPoa();
    const parent = typeof req.query.parent === 'string' ? req.query.parent.trim() : '';
    const opco = typeof req.query.opco === 'string' ? req.query.opco.trim() : '';
    const fileId = typeof req.query.fileId === 'string' ? req.query.fileId.trim() : '';
    const filtered = all.filter((r) => {
      if (fileId && r.fileId !== fileId) return false;
      if (parent && r.parent !== parent) return false;
      if (opco) {
        const wanted = opco.toLowerCase();
        const name = String(r.opco || '').trim().toLowerCase();
        if (!name) return false;
        if (!(name === wanted || name.includes(wanted) || wanted.includes(name))) {
          return false;
        }
      }
      return true;
    });
    res.json(filtered);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to load POA records' });
  }
});

// POST /api/poa  (create or update by id or by fileId)
poaRouter.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const parent = (body.parent || '').trim();
    const holderName = (body.holderName || '').trim();
    const scope = (body.scope || '').trim();
    const fileId = (body.fileId || '').trim();
    if (!parent || !holderName || !scope) {
      return res.status(400).json({ error: 'parent, holderName and scope are required' });
    }
    const nowIso = new Date().toISOString();
    const all = await loadPoa();
    let updated;
    const existingByFileId = fileId ? all.find((r) => r.fileId === fileId) : null;
    if (body.id) {
      // Update existing by id
      updated = all.map((r) =>
        r.id === body.id
          ? {
              ...r,
              ...body,
              parent,
              holderName,
              scope,
              fileId: fileId || r.fileId,
              updatedAt: nowIso,
            }
          : r
      );
    } else if (existingByFileId) {
      // Update existing by fileId (unique key)
      updated = all.map((r) =>
        r.fileId === fileId
          ? {
              ...r,
              ...body,
              parent,
              holderName,
              scope,
              fileId,
              updatedAt: nowIso,
            }
          : r
      );
    } else {
      const rec = {
        id: `poa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: nowIso,
        updatedAt: nowIso,
        ...body,
        parent,
        holderName,
        scope,
        fileId: fileId || undefined,
      };
      updated = [rec, ...all];
    }
    await savePoa(updated);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to save POA record' });
  }
});

/** Default POA extraction shape returned to client for review. */
const DEFAULT_POA_EXTRACT = {
  fileId: '',
  parent: '',
  opco: '',
  holderName: '',
  holderRole: '',
  poaType: '',
  scope: '',
  jurisdiction: '',
  issuingAuthority: '',
  signedOn: '',
  validFrom: '',
  validUntil: '',
  notarised: false,
  mofaStamp: false,
  embassyStamp: false,
  notes: '',
};

/** Strip "Holding Group" (and common variants) from parent holding company name. */
function stripHoldingGroup(name) {
  if (!name || typeof name !== 'string') return '';
  const s = name.trim();
  return s
    .replace(/\s*Holding\s+Group\s*$/i, '')
    .replace(/\s*Holding\s+Company\s*$/i, '')
    .trim() || s;
}

function normalizePoaExtract(obj) {
  const out = { ...DEFAULT_POA_EXTRACT };
  if (!obj || typeof obj !== 'object') return out;
  const str = (v) => (v != null && v !== '' ? String(v).trim() : '');
  const dateStr = (v) => {
    const s = str(v);
    if (!s) return '';
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
  };
  const bool = (v) => v === true || v === 'true' || v === 'yes' || v === '1';
  out.fileId = str(obj.fileId != null ? obj.fileId : obj.notarisationReferenceNo);
  out.parent = stripHoldingGroup(obj.parent != null ? obj.parent : obj.parentHolding);
  out.opco = str(obj.opco != null ? obj.opco : obj.legalEntityName);
  out.holderName = str(obj.holderName);
  out.holderRole = str(obj.holderRole);
  out.poaType = str(obj.poaType);
  out.scope = str(obj.scope);
  out.jurisdiction = str(obj.jurisdiction);
  out.issuingAuthority = str(obj.issuingAuthority);
  out.signedOn = dateStr(obj.signedOn);
  out.validFrom = dateStr(obj.validFrom);
  out.validUntil = dateStr(obj.validUntil);
  out.notarised = bool(obj.notarised);
  out.mofaStamp = bool(obj.mofaStamp);
  out.embassyStamp = bool(obj.embassyStamp);
  out.notes = str(obj.notes);
  return out;
}

const POA_EXTRACT_SYSTEM = `You extract Power of Attorney (POA) data from documents. The document may be in English, Arabic, or both. Map fields exactly as specified. Reply only with valid JSON.`;

const POA_EXTRACT_MAPPING = `Extract and map the following to a JSON object. Use empty string "" for missing text; for dates use YYYY-MM-DD (convert Hijri/other formats if possible).

Mapping (document → JSON key):
- "Notarisation Reference No" (or "Notarisation Reference Number") → "fileId" (unique key; maps to File ID on UI; use exactly as in document)
- Legal Entity Name → "opco" (the legal entity / company name; maps to OpCo/Entity on UI)
- Parent Holding Company → "parent" (strip off any trailing "Holding Group" or "Holding Company" text; maps to Parent Holding)
- Part 2 - field "Full Name (as per passport)" → "holderName" (Attorney/Holder name)
- Part 2 - field "Designation / Role" → "holderRole" (Role/Position)
- Part 4 - field "Jurisdiction" → "jurisdiction" (extract ONLY the place/city, e.g. from "Dubai, UAE" use "Dubai"; from "Riyadh, KSA" use "Riyadh")
- Part 4 - field "Governing Law" → "issuingAuthority"
- Part 4 - field "Issue Date" → "signedOn" and "validFrom" (same date for both, YYYY-MM-DD)
- Part 4 - field "Expiry Date" → "validUntil" (YYYY-MM-DD)
- Part 3 - all point-wise header sections and limitations → "scope" (format as: first list "Numbered points:" then each point as "1. ..." "2. ..."; then "Limitations:" and list limitations. All in one text block, preserve original language.)

JSON keys to return: fileId, parent, opco, holderName, holderRole, jurisdiction, issuingAuthority, signedOn, validFrom, validUntil, scope. You may include notes if relevant.`;

/**
 * Extract POA fields from document text using LLM.
 * Uses document structure: Legal Entity Name, Parent Holding, Part 2, Part 3, Part 4.
 * Handles English, Arabic, or bilingual documents.
 */
async function extractPoaFromText(text) {
  if (!isLlmConfigured() || !text || !String(text).trim()) return null;
  try {
    const completion = await createChatCompletion({
      messages: [
        { role: 'system', content: POA_EXTRACT_SYSTEM },
        { role: 'user', content: `${POA_EXTRACT_MAPPING}\n\nDocument text:\n${String(text).slice(0, 12000)}` },
      ],
      maxTokens: 1500,
      responseFormat: 'json',
    });
    const raw = completion.choices?.[0]?.message?.content?.trim() || '{}';
    const jsonStr = raw.replace(/^```json?\s*|\s*```$/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('POA extract from text:', e.message);
    return null;
  }
}

/**
 * Extract POA fields from an image buffer using LLM vision.
 * Uses same document structure (Legal Entity, Parent Holding, Part 2, Part 3, Part 4).
 * Handles English, Arabic, or bilingual documents.
 */
async function extractPoaFromImage(buffer, mimetype) {
  if (!isLlmConfigured()) return null;
  const base64 = buffer.toString('base64');
  const dataUrl = `data:${mimetype};base64,${base64}`;
  try {
    const completion = await createChatCompletion({
      messages: [
        { role: 'system', content: POA_EXTRACT_SYSTEM },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Extract from this POA document image. ${POA_EXTRACT_MAPPING}` },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      maxTokens: 1500,
      responseFormat: 'json',
    });
    const raw = completion.choices?.[0]?.message?.content?.trim() || '{}';
    const jsonStr = raw.replace(/^```json?\s*|\s*```$/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('POA extract from image:', e.message);
    return null;
  }
}

/**
 * Single-file POA extraction. PDF: text extract + LLM; image: LLM vision.
 */
async function runPoaExtract(buffer, mimetype) {
  const mime = (mimetype || '').toLowerCase();
  const isImage = /^image\/(jpeg|png|tiff|jpg)/.test(mime);
  if (isImage) {
    const extracted = await extractPoaFromImage(buffer, mimetype);
    return normalizePoaExtract(extracted);
  }
  const text = await extractTextFromBuffer(buffer, mime);
  const extracted = text ? await extractPoaFromText(text) : null;
  return normalizePoaExtract(extracted);
}

// POST /api/poa/extract — single file
poaRouter.post('/extract', poaUpload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const { buffer, mimetype, originalname } = req.file;
    const extracted = await runPoaExtract(buffer, mimetype);
    res.json({
      ok: true,
      filename: originalname || 'document',
      extracted,
      fromDocument: !!extracted && (extracted.holderName || extracted.scope || extracted.parent || extracted.opco || extracted.fileId),
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Extraction failed' });
  }
});

// POST /api/poa/extract-batch — multiple files
poaRouter.post('/extract-batch', poaUpload.array('files', 20), async (req, res) => {
  try {
    const files = req.files && Array.isArray(req.files) ? req.files : [];
    if (files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    const results = [];
    for (const file of files) {
      const extracted = await runPoaExtract(file.buffer, file.mimetype);
      results.push({
        filename: file.originalname || 'document',
        extracted,
        fromDocument: !!extracted && (extracted.holderName || extracted.scope || extracted.parent || extracted.opco || extracted.fileId),
      });
    }
    res.json({ ok: true, results });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Batch extraction failed' });
  }
});

