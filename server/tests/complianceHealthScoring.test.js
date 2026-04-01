import test from 'node:test';
import assert from 'node:assert/strict';
import { computeComplianceHealth } from '../services/complianceHealthScoring.js';

const baseSignals = {
  regulatory: { total: 50, critical: 6, overdue: 3 },
  legal: { totalActive: 30, expiringSoon: 4, expired: 2 },
  dependency: { totalClusters: 8, criticalClusters: 2, highClusters: 3, totalExposureAed: 1800000 },
  dataComplianceInsights: [{ severity: 'High' }, { severity: 'Critical' }],
  litigation: { total: 4, highRisk: 2 },
  litigationObligationInsights: [{ financialExposure: 900000 }],
  documentationGaps: [{ criticality: 'High' }, { criticality: 'Critical' }],
  tasks: { open: 10, overdue: 3, dueSoon: 2 },
  freshness: { ageDays: 2 },
  coverage: {
    regulatory: true,
    legal: true,
    dependency: true,
    dataCompliance: true,
    litigation: true,
    documentation: true,
    tasks: true,
    feed: true,
  },
};

test('returns bounded score and detail object', async () => {
  const out = await computeComplianceHealth(baseSignals, { context: { scope: 'portfolio', sector: 'banking' } });
  assert.equal(typeof out.complianceHealthScore, 'number');
  assert.ok(out.complianceHealthScore >= 0 && out.complianceHealthScore <= 100);
  assert.equal(typeof out.complianceHealthDetail, 'object');
  assert.ok(Array.isArray(out.complianceHealthDetail.drivers));
  assert.ok(out.complianceHealthDetail.drivers.length >= 5);
});

test('higher overdue/expired pressure lowers score', async () => {
  const lowRisk = await computeComplianceHealth({
    ...baseSignals,
    legal: { totalActive: 30, expiringSoon: 1, expired: 0 },
    tasks: { open: 10, overdue: 0, dueSoon: 1 },
  }, { context: { scope: 'portfolio', sector: 'banking' } });

  const highRisk = await computeComplianceHealth({
    ...baseSignals,
    legal: { totalActive: 30, expiringSoon: 8, expired: 5 },
    tasks: { open: 10, overdue: 6, dueSoon: 4 },
  }, { context: { scope: 'portfolio', sector: 'banking' } });

  assert.ok(highRisk.complianceHealthScore < lowRisk.complianceHealthScore);
});

test('data freshness penalty reduces confidence and score', async () => {
  const fresh = await computeComplianceHealth({
    ...baseSignals,
    freshness: { ageDays: 1 },
  }, { context: { scope: 'portfolio', sector: 'banking' } });

  const stale = await computeComplianceHealth({
    ...baseSignals,
    freshness: { ageDays: 30 },
  }, { context: { scope: 'portfolio', sector: 'banking' } });

  assert.ok(stale.complianceHealthDetail.confidence < fresh.complianceHealthDetail.confidence);
  assert.ok(stale.complianceHealthScore <= fresh.complianceHealthScore);
});

test('deterministic output for identical inputs', async () => {
  const a = await computeComplianceHealth(baseSignals, { context: { scope: 'opco', sector: 'fintech' } });
  const b = await computeComplianceHealth(baseSignals, { context: { scope: 'opco', sector: 'fintech' } });
  assert.equal(a.complianceHealthScore, b.complianceHealthScore);
  assert.equal(a.complianceHealthDetail.band, b.complianceHealthDetail.band);
});

test('AI attribution is additive and safe when unavailable', async () => {
  const deterministic = await computeComplianceHealth(baseSignals, { context: { scope: 'portfolio', sector: 'banking' } });
  const withAi = await computeComplianceHealth(baseSignals, { context: { scope: 'portfolio', sector: 'banking' }, includeAiAttribution: true });
  assert.equal(withAi.complianceHealthScore, deterministic.complianceHealthScore);
  assert.equal(typeof withAi.complianceHealthDetail.aiAttribution.status, 'string');
});

