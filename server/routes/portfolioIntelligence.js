import { Router } from 'express';
import { computeCrossHoldings, computeLitigationImpact } from '../services/portfolioIntelligence.js';

export const portfolioIntelligenceRouter = Router();

/** GET /api/portfolio-intelligence/cross-holdings?q=search */
portfolioIntelligenceRouter.get('/cross-holdings', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const result = await computeCrossHoldings(q);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message || 'cross-holdings failed' });
  }
});

/** GET /api/portfolio-intelligence/litigations/:id/impact */
portfolioIntelligenceRouter.get('/litigations/:id/impact', async (req, res) => {
  try {
    const result = await computeLitigationImpact(req.params.id);
    if (result.error === 'Litigation not found') {
      return res.status(404).json(result);
    }
    if (result.error === 'Missing litigation id') {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message || 'litigation impact failed' });
  }
});
