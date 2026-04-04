import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'path';
import os from 'os';
import { unlink } from 'fs/promises';

const tmpFile = join(os.tmpdir(), `ma-sc-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
process.env.MA_SCENARIOS_PATH = tmpFile;

const {
  diffAssessments,
  createScenario,
  listScenarios,
  getScenario,
  deleteScenario,
  compareStoredScenarios,
} = await import('../services/maScenarioStore.js');

test.after(async () => {
  await unlink(tmpFile).catch(() => {});
});

test('diffAssessments computes financial and framework deltas', () => {
  const a = {
    frameworkList: ['SAMA', 'DFSA Rulebook'],
    financialModelling: { totalOneTimeAED: 1_500_000, totalAnnualAED: 2_000_000 },
    timeModel: { totalWeeks: 40 },
    riskRegister: [{ id: '1' }],
    schemaVersion: '1.0.0',
    coefficientVersion: '1.0.0',
  };
  const b = {
    frameworkList: ['SAMA'],
    financialModelling: { totalOneTimeAED: 1_000_000, totalAnnualAED: 1_500_000 },
    timeModel: { totalWeeks: 30 },
    riskRegister: [],
  };
  const d = diffAssessments(a, b);
  assert.equal(d.financial.totalOneTimeDelta, 500_000);
  assert.equal(d.financial.totalAnnualDelta, 500_000);
  assert.equal(d.timeline.weeksDelta, 10);
  assert.deepEqual(d.frameworks.onlyInA, ['DFSA Rulebook']);
  assert.deepEqual(d.frameworks.onlyInB, []);
  assert.equal(d.risks.countA, 1);
  assert.equal(d.risks.countB, 0);
});

test('create list get delete scenario respects parentGroup scope', async () => {
  const snap = {
    schemaVersion: '1.0.0',
    coefficientVersion: '1.0.0',
    frameworkList: ['SAMA'],
    financialModelling: { totalOneTimeAED: 100, totalAnnualAED: 200 },
    timeModel: { totalWeeks: 10 },
    riskRegister: [],
  };
  const rec = await createScenario({
    parentGroup: 'ParentX',
    name: 'Test scenario',
    target: 'TargetY',
    assessmentSnapshot: snap,
    actor: 'test-user',
  });
  assert.ok(rec.id);
  assert.equal(rec.parentGroup, 'ParentX');

  const list = await listScenarios('ParentX');
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Test scenario');

  const loaded = await getScenario('ParentX', rec.id);
  assert.ok(loaded.assessmentSnapshot);
  assert.equal(loaded.assessmentSnapshot.frameworkList[0], 'SAMA');

  const wrongParent = await getScenario('OtherParent', rec.id);
  assert.equal(wrongParent, null);

  await deleteScenario('ParentX', rec.id, 'test-user');
  const after = await listScenarios('ParentX');
  assert.equal(after.length, 0);
});

test('compareStoredScenarios returns diff for two saved scenarios', async () => {
  const s1 = {
    financialModelling: { totalOneTimeAED: 100, totalAnnualAED: 50 },
    timeModel: { totalWeeks: 20 },
    frameworkList: ['A'],
    riskRegister: [],
  };
  const s2 = {
    financialModelling: { totalOneTimeAED: 200, totalAnnualAED: 60 },
    timeModel: { totalWeeks: 25 },
    frameworkList: ['B'],
    riskRegister: [{ id: 'r' }],
  };
  const a = await createScenario({
    parentGroup: 'PCompare',
    name: 'A',
    target: 'T',
    assessmentSnapshot: s1,
    actor: 't',
  });
  const b = await createScenario({
    parentGroup: 'PCompare',
    name: 'B',
    target: 'T',
    assessmentSnapshot: s2,
    actor: 't',
  });
  const cmp = await compareStoredScenarios('PCompare', a.id, b.id);
  assert.equal(cmp.diff.financial.totalOneTimeDelta, -100);
  assert.equal(cmp.diff.timeline.weeksDelta, -5);
  await deleteScenario('PCompare', a.id, 't');
  await deleteScenario('PCompare', b.id, 't');
});
