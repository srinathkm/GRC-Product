import { Router } from 'express';
import { computeDependencyIntelligence } from '../services/dependencyIntelligence.js';

export const dependencyIntelligenceRouter = Router();

function parseDays(value, fallback = 30) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, 3650);
}

function includeAiFromQuery(v) {
  const s = String(v || '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}

dependencyIntelligenceRouter.get('/summary', async (req, res) => {
  try {
    const days = parseDays(req.query.days);
    const selectedOpco = String(req.query.opco || '').trim();
    const includeAi = includeAiFromQuery(req.query.includeAi);
    const out = await computeDependencyIntelligence({ days, selectedOpco, includeAi });
    res.json(out.summary);
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Failed to build dependency summary' });
  }
});

dependencyIntelligenceRouter.get('/clusters', async (req, res) => {
  try {
    const days = parseDays(req.query.days);
    const selectedOpco = String(req.query.opco || '').trim();
    const includeAi = includeAiFromQuery(req.query.includeAi);
    const severity = String(req.query.severity || '').trim().toLowerCase();
    const framework = String(req.query.framework || '').trim().toLowerCase();
    const action = String(req.query.action || '').trim().toLowerCase();

    const out = await computeDependencyIntelligence({ days, selectedOpco, includeAi });
    let clusters = out.clusters;

    if (severity) {
      clusters = clusters.filter((c) => String(c.severity || '').toLowerCase() === severity);
    }
    if (framework) {
      clusters = clusters.filter((c) =>
        (c.topFrameworks || []).some((f) => String(f.framework || '').toLowerCase().includes(framework))
      );
    }
    if (action) {
      clusters = clusters.filter((c) =>
        (c.pendingActions || []).some((a) => String(a.title || '').toLowerCase().includes(action))
      );
    }

    res.json({
      generatedAt: out.summary.generatedAt,
      count: clusters.length,
      items: clusters,
      summary: out.summary,
    });
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Failed to build dependency clusters' });
  }
});

dependencyIntelligenceRouter.get('/:id', async (req, res) => {
  try {
    const days = parseDays(req.query.days);
    const selectedOpco = String(req.query.opco || '').trim();
    const includeAi = includeAiFromQuery(req.query.includeAi);
    const out = await computeDependencyIntelligence({ days, selectedOpco, includeAi });
    const item = out.clusters.find((c) => c.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Dependency cluster not found' });
      return;
    }
    res.json({
      generatedAt: out.summary.generatedAt,
      item,
    });
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Failed to fetch dependency cluster detail' });
  }
});
