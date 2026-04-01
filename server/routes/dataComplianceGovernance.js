import { Router } from 'express';
import {
  createGovernanceRecord,
  governanceSummary,
  listGovernanceRecords,
  updateGovernanceStatus,
} from '../services/dataComplianceGovernance.js';

export const dataComplianceGovernanceRouter = Router();

dataComplianceGovernanceRouter.get('/summary', async (_req, res) => {
  const summary = await governanceSummary();
  res.json(summary);
});

dataComplianceGovernanceRouter.get('/records', async (_req, res) => {
  const records = await listGovernanceRecords();
  res.json({ records });
});

dataComplianceGovernanceRouter.post('/records', async (req, res) => {
  const actor = req.headers['x-actor'] || 'system';
  const record = await createGovernanceRecord(req.body || {}, actor);
  res.status(201).json({ record });
});

dataComplianceGovernanceRouter.patch('/records/:id/status', async (req, res) => {
  const actor = req.headers['x-actor'] || 'system';
  const updated = await updateGovernanceStatus(req.params.id, req.body || {}, actor);
  if (updated.error === 'NOT_FOUND') return res.status(404).json(updated);
  if (updated.error === 'INVALID_STATUS') return res.status(400).json(updated);
  return res.json(updated);
});
