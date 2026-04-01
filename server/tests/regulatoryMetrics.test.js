import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRegulatoryChangeDatesForDemo,
  changeMatchesOpcoFilter,
  filterChangesByOpco,
} from '../services/regulatoryMetrics.js';

test('normalizeRegulatoryChangeDatesForDemo: empty returns empty', () => {
  assert.deepEqual(normalizeRegulatoryChangeDatesForDemo([]), []);
  assert.deepEqual(normalizeRegulatoryChangeDatesForDemo(null), null);
});

test('filterChangesByOpco: empty filter returns all', () => {
  const rows = [{ id: 1, affectedCompanies: ['A'] }];
  assert.deepEqual(filterChangesByOpco(rows, ''), rows);
  assert.deepEqual(filterChangesByOpco(rows, '   '), rows);
});

test('filterChangesByOpco: matches case-insensitively', () => {
  const rows = [
    { id: 1, affectedCompanies: ['Emirates NBD'] },
    { id: 2, affectedCompanies: ['Other'] },
  ];
  const out = filterChangesByOpco(rows, 'emirates nbd');
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 1);
});

test('changeMatchesOpcoFilter: false when no companies', () => {
  assert.equal(changeMatchesOpcoFilter({ affectedCompanies: [] }, 'X'), false);
});
