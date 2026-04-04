import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateOwnershipGraphV1,
  normalizeOwnershipGraphV1,
  findNodeIdsInDirectedCycles,
  mergeDuplicateEdges,
} from '../services/ownershipGraphModel.js';

test('validateOwnershipGraphV1 accepts minimal valid graph', () => {
  const g = {
    schemaVersion: '1',
    subjectNodeId: 'a',
    nodes: [{ id: 'a', label: 'A', type: 'corporate' }],
    edges: [],
  };
  const v = validateOwnershipGraphV1(g);
  assert.equal(v.ok, true);
});

test('validateOwnershipGraphV1 rejects unknown edge endpoint', () => {
  const g = {
    schemaVersion: '1',
    nodes: [{ id: 'a', label: 'A', type: 'corporate' }],
    edges: [{ id: 'e1', source: 'x', target: 'a', kind: 'owns' }],
  };
  const v = validateOwnershipGraphV1(g);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => e.includes('unknown')));
});

test('findNodeIdsInDirectedCycles detects 3-cycle', () => {
  const nodes = [
    { id: 'a', label: 'A', type: 'corporate' },
    { id: 'b', label: 'B', type: 'corporate' },
    { id: 'c', label: 'C', type: 'corporate' },
  ];
  const edges = [
    { id: 'e1', source: 'a', target: 'b', kind: 'owns' },
    { id: 'e2', source: 'b', target: 'c', kind: 'owns' },
    { id: 'e3', source: 'c', target: 'a', kind: 'owns' },
  ];
  const cyc = findNodeIdsInDirectedCycles(nodes, edges);
  assert.ok(cyc.has('a') && cyc.has('b') && cyc.has('c'));
});

test('normalizeOwnershipGraphV1 parses LLM-style JSON string', () => {
  const raw = JSON.stringify({
    schemaVersion: '1',
    nodes: [
      { id: 'n1', label: 'HoldCo', type: 'corporate' },
      { id: 'n2', label: 'Target Ltd', type: 'corporate' },
    ],
    edges: [{ id: 'e1', source: 'n1', target: 'n2', kind: 'owns', percent: 100 }],
    subjectNodeId: 'n2',
  });
  const { graph, warnings } = normalizeOwnershipGraphV1(raw, { subjectHint: 'Target Ltd' });
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.edges.length, 1);
  assert.equal(graph.subjectNodeId, 'n2');
  assert.ok(Array.isArray(warnings));
});

test('mergeDuplicateEdges collapses parallel edges', () => {
  const merged = mergeDuplicateEdges([
    { id: 'a', source: 'x', target: 'y', kind: 'owns', percent: 50 },
    { id: 'b', source: 'x', target: 'y', kind: 'owns', percent: 50 },
  ]);
  assert.equal(merged.length, 1);
});

test('normalizeOwnershipGraphV1 uses subject hint for single-node fallback', () => {
  const { graph } = normalizeOwnershipGraphV1(
    { schemaVersion: '1', nodes: [], edges: [] },
    { subjectHint: 'Acme OpCo' },
  );
  assert.equal(graph.nodes.length, 1);
  assert.equal(graph.nodes[0].label, 'Acme OpCo');
  assert.ok(graph.subjectNodeId);
});
