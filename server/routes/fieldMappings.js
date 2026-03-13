import { Router } from 'express';
import multer from 'multer';
import { readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '../data/fieldMappings.json');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

async function loadMappings() {
  try {
    const raw = await readFile(DATA_PATH, 'utf-8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function saveMappings(list) {
  await writeFile(DATA_PATH, JSON.stringify(list, null, 2), 'utf-8');
}

export const fieldMappingsRouter = Router();

// GET /api/field-mappings?module=poa
fieldMappingsRouter.get('/', async (req, res) => {
  try {
    const all = await loadMappings();
    const module = typeof req.query.module === 'string' ? req.query.module.trim() : '';
    const filtered = module ? all.filter((m) => m.module === module) : all;
    res.json(filtered);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/field-mappings — create or update (match by name + module)
fieldMappingsRouter.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const { name, module, fieldMap, sourceFields } = body;
    if (!name || !module || !fieldMap || typeof fieldMap !== 'object') {
      return res.status(400).json({ error: 'name, module and fieldMap (object) are required' });
    }
    const now = new Date().toISOString();
    const all = await loadMappings();
    const existingIdx = all.findIndex((m) => m.name === name && m.module === module);
    let record;
    if (existingIdx >= 0) {
      record = { ...all[existingIdx], name, module, fieldMap, sourceFields: sourceFields || [], updatedAt: now };
      all[existingIdx] = record;
    } else {
      record = {
        id: `fm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        module,
        fieldMap,
        sourceFields: sourceFields || [],
        createdAt: now,
        updatedAt: now,
      };
      all.unshift(record);
    }
    await saveMappings(all);
    res.json({ ok: true, mapping: record });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/field-mappings/:id
fieldMappingsRouter.delete('/:id', async (req, res) => {
  try {
    const all = await loadMappings();
    const filtered = all.filter((m) => m.id !== req.params.id);
    if (filtered.length === all.length) return res.status(404).json({ error: 'Not found' });
    await saveMappings(filtered);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/field-mappings/preview-headers
 * Accepts a CSV or Excel file and returns its column headers.
 * Used by the client to check field conformance before saving.
 */
fieldMappingsRouter.post('/preview-headers', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { buffer, originalname } = req.file;
    const lower = (originalname || '').toLowerCase();
    let headers = [];

    if (lower.endsWith('.csv')) {
      // Parse first non-empty line as CSV headers
      const text = buffer.toString('utf-8');
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length > 0) {
        headers = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim());
      }
    } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const worksheet = workbook.worksheets[0];
      if (worksheet) {
        worksheet.getRow(1).eachCell({ includeEmpty: false }, (cell) => {
          headers.push(String(cell.value ?? '').trim());
        });
      }
    } else {
      return res.status(400).json({ error: 'Only CSV, XLS, XLSX files are supported for header preview' });
    }

    res.json({ ok: true, headers: headers.filter(Boolean) });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Header preview failed' });
  }
});
