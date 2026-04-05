import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeLabel,
  labelMatchesQuery,
  computeCrossHoldings,
  computeLitigationImpact,
} from '../services/portfolioIntelligence.js';

describe('portfolioIntelligence', () => {
  it('normalizeLabel strips punctuation and lowercases', () => {
    assert.equal(normalizeLabel('  Hello—World  '), 'hello world');
  });

  it('labelMatchesQuery requires min length 2', () => {
    assert.equal(labelMatchesQuery('Faisal Al-Tamimi', 'Fa'), true);
    assert.equal(labelMatchesQuery('Faisal Al-Tamimi', 'x'), false);
  });

  it('computeCrossHoldings finds Faisal in sample graphs', async () => {
    const r = await computeCrossHoldings('Faisal');
    assert.ok(Array.isArray(r.holdings));
    assert.ok(r.holdings.length >= 1 || r.graphContexts.length >= 1);
  });

  it('computeLitigationImpact returns tier for IP dispute sample', async () => {
    const r = await computeLitigationImpact('lit-1774879300629-8qa8az');
    if (r.error) {
      assert.fail(r.error);
    }
    assert.equal(r.litigation.caseId, 'TEST-LIT-PAT-0001-2024-001');
    assert.ok(['high', 'medium', 'low'].includes(r.impactTier));
    assert.ok(Array.isArray(r.linkedIp));
    assert.ok(Array.isArray(r.explainability.reasons));
  });

  it('computeLitigationImpact 404 for unknown id', async () => {
    const r = await computeLitigationImpact('does-not-exist');
    assert.equal(r.error, 'Litigation not found');
  });
});
