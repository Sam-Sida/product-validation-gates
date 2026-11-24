import { test, assert } from './runner.js';
import { passingIdea } from './fixtures.js';
import { evaluate, evaluateGate } from '../js/decision.js';

const codes = (gate) => gate.reasons.map((r) => r.code);
const gateOf = (ev, id) => ev.gates.find((g) => g.id === id);

function withPatch(section, patch) {
  const idea = passingIdea();
  Object.assign(idea[section], patch);
  return idea;
}

test('an idea that passes every gate on evidence gets Build', () => {
  const ev = evaluate(passingIdea());
  assert.equal(ev.recommendation, 'build');
  assert.equal(ev.decidingGate, null);
  assert.ok(ev.gates.every((g) => g.status === 'pass'));
});

// Screen
test('no clear payer stops the idea at Screen', () => {
  const ev = evaluate(withPatch('screen', { payer: '  ' }));
  assert.equal(ev.recommendation, 'stop');
  assert.equal(ev.decidingGate, 'g0');
  assert.ok(codes(gateOf(ev, 'g0')).includes('no-payer'));
});

test('no clear problem stops the idea at Screen', () => {
  const ev = evaluate(withPatch('screen', { problem: '' }));
  assert.equal(ev.decidingGate, 'g0');
  assert.ok(codes(gateOf(ev, 'g0')).includes('no-problem'));
});

test('gates after a stop are not reached', () => {
  const ev = evaluate(withPatch('screen', { payer: '' }));
  assert.ok(ev.gates.slice(1).every((g) => g.status === 'not-reached'));
});

test('a prohibited AI use case stops at Screen', () => {
  const ev = evaluate(withPatch('screen', { riskTier: 'prohibited' }));
  assert.equal(ev.recommendation, 'stop');
  assert.ok(codes(gateOf(ev, 'g0')).includes('prohibited'));
});

test('a high-risk use case with no compliance path stops at Screen', () => {
  const ev = evaluate(withPatch('screen', { riskTier: 'high', compliancePath: 'no' }));
  assert.equal(ev.recommendation, 'stop');
  assert.ok(codes(gateOf(ev, 'g0')).includes('high-risk-no-path'));
});

test('a high-risk use case with a compliance path passes Screen', () => {
  assert.equal(evaluateGate('g0', withPatch('screen', { riskTier: 'high', compliancePath: 'yes' })).status, 'pass');
});

test('an unknown regulator approval means Test first, with a compliance check next', () => {
  const ev = evaluate(withPatch('screen', { approvalNeeded: 'unknown' }));
  assert.equal(ev.recommendation, 'test');
  assert.equal(ev.decidingGate, 'g0');
  assert.ok(/compliance/i.test(ev.nextTest), ev.nextTest);
});

test('a regulated domain with an unknown compliance path means Test first', () => {
  const ev = evaluate(withPatch('screen', { domains: ['health'], compliancePath: 'unknown' }));
  assert.equal(ev.recommendation, 'test');
});

test('no strategy fit stops the idea at Screen', () => {
  assert.equal(evaluateGate('g0', withPatch('screen', { strategyFit: 'no' })).status, 'stop');
});

// Problem
test('fewer than 3 clients sharing the pain stops at Problem', () => {
  const ev = evaluate(withPatch('problem', { clientsSharing: 2 }));
  assert.equal(ev.decidingGate, 'g1');
  assert.ok(codes(gateOf(ev, 'g1')).includes('too-few-clients'));
});

test('the minimum client count follows the rule set before the gate', () => {
  const idea = withPatch('problem', { clientsSharing: 2 });
  idea.rules.minClients = 2;
  assert.equal(evaluateGate('g1', idea).status, 'pass');
});

test('pain that is neither frequent nor severe stops at Problem', () => {
  const g = evaluateGate('g1', withPatch('problem', { frequency: 'monthly', severity: 2 }));
  assert.equal(g.status, 'stop');
  assert.ok(codes(g).includes('not-frequent-or-severe'));
});

test('severe but infrequent pain passes Problem', () => {
  assert.equal(evaluateGate('g1', withPatch('problem', { frequency: 'monthly', severity: 4 })).status, 'pass');
});

test('a stop beats an earlier unknown', () => {
  const idea = withPatch('screen', { approvalNeeded: 'unknown' });
  idea.problem.clientsSharing = 1;
  const ev = evaluate(idea);
  assert.equal(ev.recommendation, 'stop');
  assert.equal(ev.decidingGate, 'g1');
});

// Data and legal
test('a user type without data rights stops at Data and legal', () => {
  const idea = passingIdea();
  idea.data.userTypes.push({ name: 'Retailer', source: 'first-party', rights: 'no', isolation: 'yes' });
  const g = evaluateGate('g2', idea);
  assert.equal(g.status, 'stop');
  assert.ok(codes(g).includes('no-data-rights'));
});

test('a cross-client leakage risk stops at Data and legal', () => {
  const idea = passingIdea();
  idea.data.userTypes[0].isolation = 'no';
  assert.ok(codes(evaluateGate('g2', idea)).includes('leakage-risk'));
});

test('a country block stops at Data and legal', () => {
  assert.ok(codes(evaluateGate('g2', withPatch('data', { countryBlock: 'yes' }))).includes('country-block'));
});

test('unknown data rights mean Test first', () => {
  const idea = passingIdea();
  idea.data.userTypes[0].rights = 'unknown';
  assert.equal(evaluateGate('g2', idea).status, 'unknown');
});

// Value and AI quality
test('evals that only match the baseline stop at Value', () => {
  const g = evaluateGate('g3', withPatch('value', { evalScore: 0.6 }));
  assert.equal(g.status, 'stop');
  assert.ok(codes(g).includes('misses-baseline'));
});

test('latency over target stops at Value', () => {
  assert.ok(codes(evaluateGate('g3', withPatch('value', { latencyP95Ms: 12000 }))).includes('too-slow'));
});

test('a smoke test below threshold stops at Value', () => {
  assert.ok(codes(evaluateGate('g3', withPatch('value', { smokeConversionPct: 5 }))).includes('weak-demand'));
});

test('an untested scale spike means Test first', () => {
  const ev = evaluate(withPatch('value', { scaleOk: 'unknown' }));
  assert.equal(ev.recommendation, 'test');
  assert.equal(ev.decidingGate, 'g3');
});

// Economics
test('CLV:CAC below 1 stops at Economics', () => {
  const ev = evaluate(withPatch('economics', { acquisitionSpend: 600000 }));
  assert.equal(ev.recommendation, 'stop');
  assert.ok(codes(gateOf(ev, 'g4')).includes('clv-cac-below-min'));
});

test('CLV:CAC between 1 and 2 is weak and means Test first', () => {
  const ev = evaluate(withPatch('economics', { acquisitionSpend: 372320 })); // ratio 1.5
  assert.equal(ev.recommendation, 'test');
  assert.equal(gateOf(ev, 'g4').status, 'weak');
  assert.ok(codes(gateOf(ev, 'g4')).includes('clv-cac-below-target'));
});

test('a CLV:CAC of exactly 2 misses the target, which is above 2', () => {
  const g = evaluateGate('g4', withPatch('economics', { acquisitionSpend: 279240 }));
  assert.equal(g.status, 'weak');
});

test('payback over 18 months is weak even with a strong ratio', () => {
  const g = evaluateGate('g4', withPatch('economics', { lifetimeYears: 10, acquisitionSpend: 240000 }));
  assert.equal(g.status, 'weak');
  assert.ok(codes(g).includes('slow-payback'));
});

test('a negative margin per use stops at Economics', () => {
  const g = evaluateGate('g4', withPatch('economics', { annualRevenue: 50 }));
  assert.equal(g.status, 'stop');
  assert.ok(codes(g).includes('negative-margin'));
});

test('a cheaper bespoke build stops at Economics', () => {
  assert.ok(codes(evaluateGate('g4', withPatch('economics', { bespokeCostPerClient: 10000 }))).includes('bespoke-cheaper'));
});

test('a SOM below the minimum stops at Economics', () => {
  assert.ok(codes(evaluateGate('g4', withPatch('economics', { somPct: 1 }))).includes('som-too-small'));
});

test('missing economics inputs mean Test first', () => {
  const idea = passingIdea();
  idea.economics = {};
  assert.equal(evaluateGate('g4', idea).status, 'unknown');
  assert.equal(evaluate(idea).recommendation, 'test');
});

test('every non-pass reason carries a next test', () => {
  const idea = withPatch('value', { scaleOk: 'unknown' });
  const g = evaluateGate('g3', idea);
  assert.ok(g.reasons.every((r) => r.test && r.test.length > 5));
});
