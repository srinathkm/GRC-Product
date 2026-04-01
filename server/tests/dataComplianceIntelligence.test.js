import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { computeDataComplianceDetail } from '../services/dataComplianceIntelligence.js';
import { computeDependencyIntelligence } from '../services/dependencyIntelligence.js';
import {
  createGovernanceRecord,
  governanceSummary,
  updateGovernanceStatus,
} from '../services/dataComplianceGovernance.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, '../../docs/contracts/data-compliance-detail-schema.json');

function assertScoreBounds(detail) {
  assert.ok(detail);
  assert.ok(detail.overallScore >= 0 && detail.overallScore <= 100);
  assert.ok(detail.confidence >= 0 && detail.confidence <= 100);
  assert.ok(Array.isArray(detail.riskDrivers));
  assert.ok(Array.isArray(detail.aiTransferRisks));
  assert.ok(Array.isArray(detail.remediationQueue));
}

test('computeDataComplianceDetail: unconfigured inventory produces explicit untrusted posture', () => {
  const detail = computeDataComplianceDetail({
    onboardingRows: [
      { opco: 'OpCo A', parent: 'Parent', locations: ['Kuwait'], sectorOfOperations: ['Financial'] },
    ],
    aiModelUsage: [],
    sovereigntyChecks: [{ jurisdiction: 'GCC', name: 'Cross-border transfer mechanisms', severity: 'Critical', regulation: 'GCC' }],
    tasks: [],
    selectedOpco: '',
  });

  assertScoreBounds(detail);
  assert.equal(detail.sourceCoverage.systems.modelInventory, 'unconfigured');
  assert.equal(detail.sourceCoverage.trusted, false);
  assert.ok(detail.aiTransferRisks.some((r) => String(r.inventoryStatus || '').includes('unconfigured')));
});

test('computeDataComplianceDetail: configured inventory produces egress rows', () => {
  const detail = computeDataComplianceDetail({
    onboardingRows: [
      { opco: 'OpCo A', parent: 'Parent', locations: ['Kuwait'], sectorOfOperations: ['Financial'] },
    ],
    aiModelUsage: [
      { model: 'Vendor X', app: 'App', hostRegion: 'US', dataLeavesJurisdiction: true },
    ],
    sovereigntyChecks: [{ jurisdiction: 'GCC', name: 'Cross-border transfer mechanisms', severity: 'Critical', regulation: 'GCC' }],
    tasks: [],
    selectedOpco: '',
  });

  assertScoreBounds(detail);
  assert.equal(detail.sourceCoverage.systems.modelInventory, 'configured');
  assert.ok(detail.aiTransferRisks.length > 0);
});

test('computeDataComplianceDetail: deterministic for identical inputs', () => {
  const payload = {
    onboardingRows: [{ opco: 'OpCo A', parent: 'Parent', locations: ['UAE'], sectorOfOperations: ['Tech'] }],
    aiModelUsage: [],
    sovereigntyChecks: [],
    tasks: [],
    selectedOpco: '',
  };
  const a = computeDataComplianceDetail(payload);
  const b = computeDataComplianceDetail(payload);
  assert.deepEqual(
    {
      overallScore: a.overallScore,
      confidence: a.confidence,
      reliability: a.reliability,
      band: a.band,
      riskDrivers: a.riskDrivers,
      aiTransferRisks: a.aiTransferRisks,
      remediationQueue: a.remediationQueue,
      sourceCoverage: a.sourceCoverage,
    },
    {
      overallScore: b.overallScore,
      confidence: b.confidence,
      reliability: b.reliability,
      band: b.band,
      riskDrivers: b.riskDrivers,
      aiTransferRisks: b.aiTransferRisks,
      remediationQueue: b.remediationQueue,
      sourceCoverage: b.sourceCoverage,
    },
  );
});

test('computeDependencyIntelligence: no default model catalog when inventory missing', async () => {
  const opco = 'SKM LLC (SKM Life Sciences & Technology)';
  const { clusters } = await computeDependencyIntelligence({ days: 30, selectedOpco: opco, includeAi: false });
  const cluster = clusters.find((c) => norm(c.opco) === norm(opco));
  assert.ok(cluster);
  const unconfigured = cluster.dependencies.some((d) => d.type === 'DataCompliance' && String(d.title).includes('unconfigured'));
  assert.equal(unconfigured, true);
});

test('data compliance governance: status transitions validate', async () => {
  const record = await createGovernanceRecord(
    { opco: 'OpCo A', severity: 'Critical', dueDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10) },
    'test-actor',
  );
  const bad = await updateGovernanceStatus(record.id, { status: 'not-a-real-status' }, 'test-actor');
  assert.equal(bad.error, 'INVALID_STATUS');

  const ok = await updateGovernanceStatus(record.id, { status: 'resolved' }, 'test-actor');
  assert.ok(ok.record);
  assert.equal(ok.record.status, 'resolved');

  const summary = await governanceSummary();
  assert.ok(typeof summary.total === 'number');
});

test('dataComplianceDetail matches JSON schema contract (static file)', async () => {
  const schemaRaw = await readFile(schemaPath, 'utf-8');
  const schema = JSON.parse(schemaRaw);
  const detail = computeDataComplianceDetail({
    onboardingRows: [{ opco: 'OpCo A', parent: 'Parent', locations: ['UAE'] }],
    aiModelUsage: [],
    sovereigntyChecks: [],
    tasks: [],
    selectedOpco: '',
  });

  const required = schema.required || [];
  for (const key of required) {
    assert.ok(Object.prototype.hasOwnProperty.call(detail, key), `missing required field: ${key}`);
  }
});

function norm(v) {
  return String(v || '').trim().toLowerCase();
}
