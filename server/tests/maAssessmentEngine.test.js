import test from 'node:test';
import assert from 'node:assert/strict';
import {
  runMaAssessment,
  resolveFrameworkListForTarget,
  MA_SCHEMA_VERSION,
  assessmentToCsv,
  buildRiskRegister,
  buildRegulatoryMatrix,
  loadCoefficients,
} from '../services/maAssessmentEngine.js';

const companiesFixture = {
  'UAE Federal Laws': [{ parent: 'TargetOpCo', companies: [] }],
  'CBUAE Rulebook': [{ parent: 'OtherParent', companies: ['TargetOpCo'] }],
  SAMA: [{ parent: 'TargetOpCo', companies: ['Child1'] }],
};

const changesFixture = [
  { framework: 'CBUAE Rulebook', title: 'Circular update', date: '2024-01-15', snippet: 'Test' },
  { framework: 'SAMA', title: 'Old', date: '2020-01-01', snippet: 'X' },
];

test('resolveFrameworkListForTarget collects frameworks for parent or member', () => {
  const list = resolveFrameworkListForTarget(companiesFixture, 'TargetOpCo');
  assert.ok(list.includes('UAE Federal Laws'));
  assert.ok(list.includes('SAMA'));
  assert.ok(list.includes('CBUAE Rulebook'));
});

test('resolveFrameworkListForTarget empty for missing target', () => {
  assert.deepEqual(resolveFrameworkListForTarget(companiesFixture, ''), []);
  assert.deepEqual(resolveFrameworkListForTarget(null, 'TargetOpCo'), []);
});

test('runMaAssessment returns schemaVersion, coefficientVersion, and core arrays', async () => {
  const out = await runMaAssessment({
    parentGroup: 'ParentA',
    target: 'TargetOpCo',
    companiesData: companiesFixture,
    changesData: changesFixture,
    options: { dealStructure: 'share' },
  });
  assert.equal(out.schemaVersion, MA_SCHEMA_VERSION);
  assert.match(out.coefficientVersion, /^\d+\.\d+\.\d+$/);
  assert.ok(Array.isArray(out.frameworkList));
  assert.ok(out.frameworkList.length >= 3);
  assert.ok(Array.isArray(out.riskRegister));
  assert.ok(out.riskRegister.length >= 5);
  assert.ok(Array.isArray(out.regulatoryMatrix));
  assert.equal(out.regulatoryMatrix.length, out.frameworkList.length);
  assert.ok(out.valueBridge && typeof out.valueBridge.integrationOneTimeAed === 'number');
  assert.ok(out.executiveSummary && out.executiveSummary.headline);
  assert.ok(Array.isArray(out.lineage));
  assert.ok(typeof out.csvExport === 'string');
  assert.ok(out.csvExport.includes('schemaVersion'));
});

test('runMaAssessment applies synergy to value bridge', async () => {
  const out = await runMaAssessment({
    parentGroup: 'P',
    target: 'TargetOpCo',
    companiesData: companiesFixture,
    changesData: changesFixture,
    options: { synergyAnnualAed: 2_000_000 },
  });
  assert.equal(out.valueBridge.synergyAnnualAed, 2_000_000);
  assert.ok(typeof out.valueBridge.netAnnualAfterSynergyBand === 'string');
});

test('assessmentToCsv escapes commas and newlines', () => {
  const csv = assessmentToCsv({
    schemaVersion: '1.0.0',
    coefficientVersion: '1.0.0',
    parentGroup: 'A, B',
    target: 'T',
    frameworkList: ['FW1'],
    financialModelling: { breakdown: [{ item: 'x,y', amountAED: 1 }] },
    riskRegister: [{ id: 'R1', severity: 'High', description: 'a,b' }],
    regulatoryMatrix: [],
  });
  assert.ok(csv.includes('"A, B"'));
});

test('buildRiskRegister includes AML row when AML framework present', () => {
  const fm = { totalOneTimeAED: 1, totalAnnualAED: 2 };
  const tm = { totalWeeks: 30 };
  const risks = buildRiskRegister({
    frameworkList: ['UAE AML/CFT'],
    parentGroup: 'P',
    target: 'T',
    financialModelling: fm,
    timeModel: tm,
    heatMapRow: null,
  });
  assert.ok(risks.some((r) => r.category === 'AML/CFT'));
});

test('buildRegulatoryMatrix rows align with frameworks', () => {
  const m = buildRegulatoryMatrix(['DFSA Rulebook', 'SAMA'], { amlCft: 90, reporting: 90, dataProtection: 120 });
  assert.equal(m.length, 2);
  assert.equal(m[0].framework, 'DFSA Rulebook');
  assert.ok(m[0].authority.length > 0);
});

test('loadCoefficients returns version and rates', async () => {
  const c = await loadCoefficients();
  assert.ok(c.version);
  assert.ok(c.rates && typeof c.rates.oneTimeLegalAed === 'number');
});
