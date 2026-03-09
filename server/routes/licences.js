import { Router } from 'express';
import { readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '../data/licences.json');

async function loadLicences() {
  try {
    const raw = await readFile(DATA_PATH, 'utf-8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function saveLicences(list) {
  await writeFile(DATA_PATH, JSON.stringify(list, null, 2), 'utf-8');
}

export const licencesRouter = Router();

// GET /api/licences?parent=&opco=
licencesRouter.get('/', async (req, res) => {
  try {
    const all = await loadLicences();
    const parent = typeof req.query.parent === 'string' ? req.query.parent.trim() : '';
    const opco = typeof req.query.opco === 'string' ? req.query.opco.trim() : '';
    const filtered = all.filter((r) => {
      if (parent && r.parent !== parent) return false;
      if (opco && r.opco !== opco) return false;
      return true;
    });
    res.json(filtered);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to load licence records' });
  }
});

// POST /api/licences  (create or update)
licencesRouter.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const parent = (body.parent || '').trim();
    const licenceType = (body.licenceType || '').trim();
    const jurisdiction = (body.jurisdiction || '').trim();
    if (!parent || !licenceType || !jurisdiction) {
      return res.status(400).json({ error: 'parent, licenceType and jurisdiction are required' });
    }
    const nowIso = new Date().toISOString();
    const all = await loadLicences();
    let updated;
    if (body.id) {
      updated = all.map((r) =>
        r.id === body.id
          ? {
              ...r,
              ...body,
              parent,
              licenceType,
              jurisdiction,
              updatedAt: nowIso,
            }
          : r
      );
    } else {
      const rec = {
        id: `lic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: nowIso,
        updatedAt: nowIso,
        ...body,
        parent,
        licenceType,
        jurisdiction,
      };
      updated = [rec, ...all];
    }
    await saveLicences(updated);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to save licence record' });
  }
});

