import { Router } from 'express';
import {
  listActionNotifications,
  listComplianceDeltas,
  triggerComplianceDeltaEvent,
} from '../services/complianceDeltaWorkflow.js';

export const complianceDeltasRouter = Router();

complianceDeltasRouter.get('/', async (_req, res) => {
  const records = await listComplianceDeltas();
  res.json({ records, total: records.length });
});

complianceDeltasRouter.get('/notifications', async (_req, res) => {
  const notifications = await listActionNotifications();
  res.json({ notifications, total: notifications.length });
});

complianceDeltasRouter.post('/events', async (req, res) => {
  const actor = req.headers['x-actor'] || req.session?.user?.email || 'system';
  const out = await triggerComplianceDeltaEvent(req.body || {}, actor);
  if (out?.error === 'VALIDATION_ERROR') {
    return res.status(400).json(out);
  }
  return res.status(out.reused ? 200 : 201).json(out);
});
