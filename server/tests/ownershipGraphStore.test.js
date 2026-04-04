import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeContextId } from '../services/ownershipGraphStore.js';

test('sanitizeContextId allows parent::opco shape', () => {
  assert.equal(sanitizeContextId('HoldCo::OpCo_A'), 'HoldCo::OpCo_A');
});

test('sanitizeContextId rejects unsafe characters', () => {
  assert.equal(sanitizeContextId('foo bar'), '');
  assert.equal(sanitizeContextId('a/b'), '');
});

test('sanitizeContextId truncates length', () => {
  const long = `${'a'.repeat(300)}`;
  assert.equal(sanitizeContextId(long).length, 256);
});
