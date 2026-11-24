import { test, assert } from './runner.js';
import { portfolioMetrics, quarterOf, auditSample } from '../js/portfolio.js';

const LOG = [
  { id: 'a', recommendation: 'stop', decidingGate: 'g0', days: 1, cost: 1000, decidedAt: '2026-10-02', outcome: null },
  { id: 'b', recommendation: 'stop', decidingGate: 'g0', days: 1, cost: 1000, decidedAt: '2026-10-09', outcome: null },
  { id: 'c', recommendation: 'stop', decidingGate: 'g1', days: 3, cost: 3000, decidedAt: '2026-10-20', outcome: null },
  { id: 'd', recommendation: 'stop', decidingGate: 'g1', days: 3, cost: 3000, decidedAt: '2026-11-03', outcome: null },
  { id: 'e', recommendation: 'stop', decidingGate: 'g2', days: 4, cost: 4000, decidedAt: '2026-11-10', outcome: null },
  { id: 'f', recommendation: 'stop', decidingGate: 'g3', days: 12, cost: 12000, decidedAt: '2026-11-15', outcome: null },
  { id: 'g', recommendation: 'stop', decidingGate: 'g4', days: 16, cost: 16000, decidedAt: '2026-07-15', outcome: null },
  { id: 'h', recommendation: 'build', decidingGate: null, days: 20, cost: 20000, decidedAt: '2026-05-01', outcome: 'success' },
  { id: 'i', recommendation: 'build', decidingGate: null, days: 20, cost: 20000, decidedAt: '2026-06-01', outcome: 'fail' },
  { id: 'j', recommendation: 'test', decidingGate: 'g3', days: 10, cost: 10000, decidedAt: '2026-11-20', outcome: null },
];

test('the share of ideas stopped at Gates 0 to 2 counts all decisions', () => {
  const m = portfolioMetrics(LOG);
  assert.equal(m.total, 10);
  assert.equal(m.stops, 7);
  assert.close(m.earlyStopSharePct, 50);
  assert.deepEqual(m.stopsByGate, { g0: 2, g1: 2, g2: 1, g3: 1, g4: 1 });
});

test('time and cost per decision are averages across the log', () => {
  const m = portfolioMetrics(LOG);
  assert.close(m.avgDays, 9);
  assert.close(m.avgCost, 9000);
});

test('early stops cost less than late stops', () => {
  const m = portfolioMetrics(LOG);
  assert.close(m.avgCostEarlyStop, 2400);
  assert.close(m.avgCostLateStop, 14000);
});

test('the hit rate of yeses compares with past productisations', () => {
  const m = portfolioMetrics(LOG, { baselineHitRatePct: 30 });
  assert.equal(m.buildsWithOutcome, 2);
  assert.close(m.hitRatePct, 50);
  assert.close(m.hitRateDeltaPts, 20);
});

test('the hit rate is null until a build has an outcome', () => {
  const m = portfolioMetrics(LOG.filter((e) => e.recommendation !== 'build'));
  assert.equal(m.hitRatePct, null);
  assert.equal(m.hitRateDeltaPts, null);
});

test('an empty log returns zeros and nulls, not errors', () => {
  const m = portfolioMetrics([]);
  assert.equal(m.total, 0);
  assert.equal(m.earlyStopSharePct, null);
  assert.equal(m.avgCost, null);
});

test('quarterOf labels dates by calendar quarter', () => {
  assert.equal(quarterOf('2026-11-24'), '2026-Q4');
  assert.equal(quarterOf('2026-01-01'), '2026-Q1');
  assert.equal(quarterOf('2026-06-30'), '2026-Q2');
});

test('the quarterly audit samples only stopped ideas from that quarter', () => {
  const sample = auditSample(LOG, '2026-Q4', 3, 42);
  assert.equal(sample.length, 3);
  assert.ok(sample.every((e) => e.recommendation === 'stop' && quarterOf(e.decidedAt) === '2026-Q4'));
  assert.equal(new Set(sample.map((e) => e.id)).size, 3);
});

test('the audit sample is repeatable for the same seed', () => {
  assert.deepEqual(auditSample(LOG, '2026-Q4', 3, 7).map((e) => e.id), auditSample(LOG, '2026-Q4', 3, 7).map((e) => e.id));
});

test('the audit sample never exceeds the stopped ideas available', () => {
  assert.equal(auditSample(LOG, '2026-Q4', 50, 1).length, 6);
  assert.equal(auditSample(LOG, '2025-Q1', 3, 1).length, 0);
});
