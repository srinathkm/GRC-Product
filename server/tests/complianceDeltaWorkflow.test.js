import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDeltaFingerprint,
  computeSlaDueAt,
  deriveRoutingTeam,
  normalizeSeverity,
} from '../services/complianceDeltaWorkflow.js';

test('normalizeSeverity defaults safely', () => {
  assert.equal(normalizeSeverity('CRITICAL'), 'critical');
  assert.equal(normalizeSeverity('unknown'), 'medium');
});

test('routing policy is severity-first', () => {
  assert.equal(deriveRoutingTeam('critical', 'governance'), 'Central Risk Response Team');
  assert.equal(deriveRoutingTeam('high', 'governance'), 'Compliance Governance team');
  assert.equal(deriveRoutingTeam('low', 'not-mapped'), 'Compliance Operations triage');
});

test('SLA policy matches configured default windows', () => {
  const base = new Date('2026-04-05T00:00:00.000Z');
  const d1 = new Date(computeSlaDueAt('critical', base));
  const d2 = new Date(computeSlaDueAt('high', base));
  const d3 = new Date(computeSlaDueAt('medium', base));
  const d4 = new Date(computeSlaDueAt('low', base));
  assert.equal((d1 - base) / 86400000, 1);
  assert.equal((d2 - base) / 86400000, 2);
  assert.equal((d3 - base) / 86400000, 5);
  assert.equal((d4 - base) / 86400000, 10);
});

test('delta fingerprint is deterministic for same payload', () => {
  const payload = {
    sourceType: 'system_delta',
    module: 'data-sovereignty',
    framework: 'SDAIA',
    opco: 'OpCo A',
    parent: 'Parent A',
    summary: 'Cross-border data transfer requirement changed',
    beforeValue: { status: 'ok' },
    afterValue: { status: 'breach' },
  };
  const a = buildDeltaFingerprint(payload);
  const b = buildDeltaFingerprint(payload);
  assert.equal(a, b);
});
