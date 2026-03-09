import { Router } from 'express';
import { readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '../data/ip.json');

async function loadIp() {
  try {
    const raw = await readFile(DATA_PATH, 'utf-8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function saveIp(list) {
  await writeFile(DATA_PATH, JSON.stringify(list, null, 2), 'utf-8');
}

export const ipRouter = Router();

// GET /api/ip?parent=&opco=
ipRouter.get('/', async (req, res) => {
  try {
    const all = await loadIp();
    const parent = typeof req.query.parent === 'string' ? req.query.parent.trim() : '';
    const opco = typeof req.query.opco === 'string' ? req.query.opco.trim() : '';
    const filtered = all.filter((r) => {
      if (parent && r.parent !== parent) return false;
      if (opco && r.opco !== opco) return false;
      return true;
    });
    res.json(filtered);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to load IP records' });
  }
});

// POST /api/ip  (create or update)
ipRouter.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const parent = (body.parent || '').trim();
    const mark = (body.mark || '').trim();
    const jurisdiction = (body.jurisdiction || '').trim();
    if (!parent || !mark || !jurisdiction) {
      return res.status(400).json({ error: 'parent, mark and jurisdiction are required' });
    }
    const nowIso = new Date().toISOString();
    const all = await loadIp();
    let updated;
    if (body.id) {
      updated = all.map((r) =>
        r.id === body.id
          ? {
              ...r,
              ...body,
              parent,
              mark,
              jurisdiction,
              updatedAt: nowIso,
            }
          : r
      );
    } else {
      const rec = {
        id: `ip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: nowIso,
        updatedAt: nowIso,
        ...body,
        parent,
        mark,
        jurisdiction,
      };
      updated = [rec, ...all];
    }
    await saveIp(updated);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to save IP record' });
  }
});

