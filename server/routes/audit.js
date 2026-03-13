/**
 * audit.js
 *
 * GET /api/audit  — paginated audit log
 * Query params: module, action, user, entityId, limit (default 100), offset (default 0)
 */

import { Router } from 'express';
import { getAuditLog } from '../services/auditService.js';

export const auditRouter = Router();

auditRouter.get('/', async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit,  10) || 100, 500);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0,   0);
    const { entries, total } = await getAuditLog({
      module:   req.query.module   || undefined,
      action:   req.query.action   || undefined,
      user:     req.query.user     || undefined,
      entityId: req.query.entityId || undefined,
      limit,
      offset,
    });
    res.json({ entries, total, limit, offset });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
