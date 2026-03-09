import { Router } from 'express';
import { readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '../data/litigations.json');

async function loadLitigations() {
  try {
    const raw = await readFile(DATA_PATH, 'utf-8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function saveLitigations(list) {
  await writeFile(DATA_PATH, JSON.stringify(list, null, 2), 'utf-8');
}

export const litigationsRouter = Router();

// GET /api/litigations?parent=&opco=
litigationsRouter.get('/', async (req, res) => {
  try {
    const all = await loadLitigations();
    const parent = typeof req.query.parent === 'string' ? req.query.parent.trim() : '';
    const opco = typeof req.query.opco === 'string' ? req.query.opco.trim() : '';
    const filtered = all.filter((r) => {
      if (parent && r.parent !== parent) return false;
      if (opco && r.opco !== opco) return false;
      return true;
    });
    res.json(filtered);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to load litigation records' });
  }
});

// POST /api/litigations  (create or update)
litigationsRouter.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const parent = (body.parent || '').trim();
    const caseId = (body.caseId || '').trim();
    const court = (body.court || '').trim();
    if (!parent || !caseId || !court) {
      return res.status(400).json({ error: 'parent, caseId and court are required' });
    }
    const nowIso = new Date().toISOString();
    const all = await loadLitigations();
    let updated;
    if (body.id) {
      updated = all.map((r) =>
        r.id === body.id
          ? {
              ...r,
              ...body,
              parent,
              caseId,
              court,
              updatedAt: nowIso,
            }
          : r
      );
    } else {
      const rec = {
        id: `lit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: nowIso,
        updatedAt: nowIso,
        ...body,
        parent,
        caseId,
        court,
      };
      updated = [rec, ...all];
    }
    await saveLitigations(updated);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to save litigation record' });
  }
});

