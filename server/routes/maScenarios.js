/**
 * M&A deal scenarios API (Phase B): persist, list, compare; parentGroup scoping on every call.
 */

import { Router } from 'express';
import { logAudit } from '../services/auditService.js';
import {
  listScenarios,
  getScenario,
  createScenario,
  updateScenario,
  deleteScenario,
  compareStoredScenarios,
} from '../services/maScenarioStore.js';

export const maRouter = Router();

function actor(req) {
  const h = req.headers['x-user-id'] || req.headers['x-user'];
  if (h != null && String(h).trim()) return String(h).trim().slice(0, 200);
  return 'anonymous';
}

function clientIp(req) {
  const x = req.headers['x-forwarded-for'];
  if (typeof x === 'string' && x.split(',')[0]) return x.split(',')[0].trim();
  return req.socket?.remoteAddress || '';
}

/** Compare must be registered before /scenarios/:id */
maRouter.get('/scenarios/compare', async (req, res) => {
  try {
    const parentGroup = req.query.parentGroup;
    const id1 = req.query.id1;
    const id2 = req.query.id2;
    if (!parentGroup || !String(parentGroup).trim() || !id1 || !id2) {
      return res.status(400).json({ error: 'parentGroup, id1, and id2 query parameters are required' });
    }
    const result = await compareStoredScenarios(String(parentGroup).trim(), String(id1).trim(), String(id2).trim());
    res.json(result);
  } catch (e) {
    const code = e.statusCode || 500;
    res.status(code).json({ error: e.message || 'Compare failed' });
  }
});

maRouter.get('/scenarios', async (req, res) => {
  try {
    const parentGroup = req.query.parentGroup;
    if (!parentGroup || !String(parentGroup).trim()) {
      return res.status(400).json({ error: 'parentGroup query parameter is required' });
    }
    const scenarios = await listScenarios(String(parentGroup).trim());
    res.json({ scenarios });
  } catch (e) {
    console.error('ma scenarios list:', e);
    res.status(500).json({ error: 'List failed' });
  }
});

maRouter.post('/scenarios', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.assessmentSnapshot || typeof body.assessmentSnapshot !== 'object') {
      return res.status(400).json({ error: 'assessmentSnapshot object is required' });
    }
    const record = await createScenario({
      parentGroup: body.parentGroup,
      name: body.name,
      target: body.target,
      dealStructure: body.dealStructure,
      synergyAnnualAed: body.synergyAnnualAed,
      regulatedTarget: body.regulatedTarget,
      reportId: body.reportId,
      assessmentSnapshot: body.assessmentSnapshot,
      actor: actor(req),
    });
    await logAudit({
      action: 'create',
      module: 'ma-scenarios',
      entityId: record.id,
      entityName: record.name,
      user: actor(req),
      after: { parentGroup: record.parentGroup, target: record.target },
      detail: 'M&A deal scenario saved',
      ip: clientIp(req),
    });
    res.status(201).json(record);
  } catch (e) {
    const code = e.statusCode || 500;
    res.status(code).json({ error: e.message || 'Create failed' });
  }
});

maRouter.get('/scenarios/:scenarioId', async (req, res) => {
  try {
    const parentGroup = req.query.parentGroup;
    if (!parentGroup || !String(parentGroup).trim()) {
      return res.status(400).json({ error: 'parentGroup query parameter is required' });
    }
    const s = await getScenario(String(parentGroup).trim(), req.params.scenarioId);
    if (!s) return res.status(404).json({ error: 'Scenario not found' });
    res.json(s);
  } catch (e) {
    res.status(500).json({ error: 'Load failed' });
  }
});

maRouter.patch('/scenarios/:scenarioId', async (req, res) => {
  try {
    const parentGroup = req.query.parentGroup;
    if (!parentGroup || !String(parentGroup).trim()) {
      return res.status(400).json({ error: 'parentGroup query parameter is required' });
    }
    const body = req.body || {};
    const updated = await updateScenario(String(parentGroup).trim(), req.params.scenarioId, {
      name: body.name,
      assessmentSnapshot: body.assessmentSnapshot,
      reportId: body.reportId,
      actor: actor(req),
    });
    await logAudit({
      action: 'update',
      module: 'ma-scenarios',
      entityId: req.params.scenarioId,
      entityName: updated?.name,
      user: actor(req),
      detail: 'M&A deal scenario updated',
      ip: clientIp(req),
    });
    res.json(updated);
  } catch (e) {
    const code = e.statusCode || 500;
    res.status(code).json({ error: e.message || 'Update failed' });
  }
});

maRouter.delete('/scenarios/:scenarioId', async (req, res) => {
  try {
    const parentGroup = req.query.parentGroup;
    if (!parentGroup || !String(parentGroup).trim()) {
      return res.status(400).json({ error: 'parentGroup query parameter is required' });
    }
    await deleteScenario(String(parentGroup).trim(), req.params.scenarioId, actor(req));
    await logAudit({
      action: 'delete',
      module: 'ma-scenarios',
      entityId: req.params.scenarioId,
      user: actor(req),
      detail: 'M&A deal scenario deleted',
      ip: clientIp(req),
    });
    res.json({ ok: true });
  } catch (e) {
    const code = e.statusCode || 500;
    res.status(code).json({ error: e.message || 'Delete failed' });
  }
});
