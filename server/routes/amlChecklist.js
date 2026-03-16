import { Router } from 'express';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { createChatCompletion, isLlmConfigured } from '../services/llm.js';
import { extractTextFromBuffer } from '../services/text-extract.js';
import { AML_CFT_DOMAINS, AML_CFT_ALL_ITEMS } from '../../client/src/data/amlCftChecklistData.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, '../data/amlChecklist.json');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const allowed =
      /\.(pdf|doc|docx|txt)$/i.test(file.originalname) ||
      [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
      ].includes(file.mimetype);
    cb(null, allowed || false);
  },
});

export const amlChecklistRouter = Router();

async function loadStore() {
  try {
    const raw = await readFile(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveStore(data) {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/** GET /api/aml-checklist/:opco — load saved state for an entity */
amlChecklistRouter.get('/:opco', async (req, res) => {
  const store = await loadStore();
  const key = req.params.opco || 'global';
  res.json({ state: store[key] || {} });
});

/** POST /api/aml-checklist/:opco — persist state for an entity */
amlChecklistRouter.post('/:opco', async (req, res) => {
  const key = req.params.opco || 'global';
  const { state } = req.body;
  if (!state || typeof state !== 'object') {
    return res.status(400).json({ error: 'state object required' });
  }
  const store = await loadStore();
  store[key] = { ...(store[key] || {}), ...state };
  await saveStore(store);
  res.json({ ok: true });
});

/** POST /api/aml-checklist/:opco/auto-check — upload an audit doc and auto-suggest states */
amlChecklistRouter.post('/:opco/auto-check', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (!isLlmConfigured()) return res.status(503).json({ error: 'LLM not configured' });

  let docText;
  try {
    docText = await extractTextFromBuffer(req.file.buffer, req.file.originalname);
  } catch (e) {
    return res.status(422).json({ error: 'Could not extract text from document: ' + e.message });
  }

  // Truncate to ~12 000 chars to stay within token budget
  const truncated = docText.length > 12000 ? docText.slice(0, 12000) + '\n[...truncated]' : docText;

  // Build compact item list for the prompt
  const itemLines = AML_CFT_ALL_ITEMS.map(
    (it) => `${it.id}: ${it.control}`
  ).join('\n');

  const systemPrompt = `You are an expert UAE AML/CFT compliance auditor.
You will review a compliance document and assess whether each listed control requirement is evidenced.
Respond ONLY with a valid JSON object mapping each item ID to one of: "yes", "no", or "na".
"yes"  = the document clearly evidences or describes compliance with this control.
"no"   = the document is silent or indicates non-compliance with this control.
"na"   = this control is explicitly not applicable based on the entity type or document context.
Do not include explanations. Return only the JSON object.`;

  const userPrompt = `DOCUMENT TEXT:\n${truncated}\n\nCOMPLIANCE ITEMS TO ASSESS:\n${itemLines}\n\nReturn only a JSON object like: {"GOV-001":"yes","GOV-002":"no",...}`;

  let suggestions;
  try {
    const completion = await createChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: 2000,
      responseFormat: 'text',
    });
    const raw = completion.choices?.[0]?.message?.content?.trim() || '';
    // Extract JSON from response
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON found in LLM response');
    suggestions = JSON.parse(match[0]);
  } catch (e) {
    return res.status(500).json({ error: 'Auto-check failed: ' + e.message });
  }

  // Validate and sanitise values
  const VALID = new Set(['yes', 'no', 'na']);
  const cleaned = {};
  for (const [k, v] of Object.entries(suggestions)) {
    if (VALID.has(v)) cleaned[k] = v;
  }

  res.json({ suggestions: cleaned });
});
