/**
 * EXEC-08: Management Dashboard embeds dependencyIntelligence summary; standalone route must match
 * for the same days/opco/includeAi=false (contract for executive consistency).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { dashboardRouter } from '../routes/dashboard.js';
import { dependencyIntelligenceRouter } from '../routes/dependencyIntelligence.js';

function createTestApp() {
  const app = express();
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/dependency-intelligence', dependencyIntelligenceRouter);
  return app;
}

async function listen(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
}

test('dashboard dependencyIntelligence matches /dependency-intelligence/summary (portfolio, 30d, no AI)', async () => {
  const app = createTestApp();
  const server = await listen(app);
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    const [dashRes, depRes] = await Promise.all([
      fetch(`${base}/api/dashboard/summary?days=30`),
      fetch(`${base}/api/dependency-intelligence/summary?days=30`),
    ]);
    assert.equal(dashRes.ok, true, `dashboard ${dashRes.status}`);
    assert.equal(depRes.ok, true, `dependency ${depRes.status}`);
    const dash = await dashRes.json();
    const dep = await depRes.json();
    const a = dash.dependencyIntelligence;
    assert.ok(a && typeof a === 'object', 'dashboard has dependencyIntelligence');
    const keys = ['totalClusters', 'criticalClusters', 'highClusters', 'totalExposureAed'];
    for (const k of keys) {
      assert.equal(
        a[k],
        dep[k],
        `mismatch on ${k}: dashboard=${a[k]} dependency=${dep[k]}`,
      );
    }
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('dashboard dependencyIntelligence matches standalone when opco scoped', async () => {
  const app = createTestApp();
  const server = await listen(app);
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  const opco = 'NonexistentOpcoXYZ';
  try {
    const [dashRes, depRes] = await Promise.all([
      fetch(`${base}/api/dashboard/summary?days=30&opco=${encodeURIComponent(opco)}`),
      fetch(`${base}/api/dependency-intelligence/summary?days=30&opco=${encodeURIComponent(opco)}`),
    ]);
    const dash = await dashRes.json();
    const dep = await depRes.json();
    const a = dash.dependencyIntelligence;
    assert.equal(a.totalClusters, dep.totalClusters);
    assert.equal(a.totalExposureAed, dep.totalExposureAed);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
