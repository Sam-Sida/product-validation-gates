import { test, assert } from './runner.js';
import {
  GATES, DEFAULT_RULES, defaultTimeboxes, createIdea, startGate,
  setTimebox, setRule, setCostOfWrong, timeboxStatus,
} from '../js/gates.js';

test('there are five gates in order, with Screen first', () => {
  assert.deepEqual(GATES.map((g) => g.name),
    ['Screen', 'Problem', 'Data and legal', 'Value and AI quality', 'Economics']);
  assert.deepEqual(GATES.map((g) => g.id), ['g0', 'g1', 'g2', 'g3', 'g4']);
});

test('every gate has a purpose and at least one stop rule', () => {
  for (const g of GATES) {
    assert.ok(g.purpose && g.purpose.length > 10, `${g.id} purpose`);
    assert.ok(Array.isArray(g.stopRules) && g.stopRules.length > 0, `${g.id} stop rules`);
  }
});

test('the Screen gate covers regulatory compliance', () => {
  assert.ok(GATES[0].stopRules.some((r) => /prohibited|compliance/i.test(r)));
});

test('time boxes grow with the cost of being wrong', () => {
  const low = defaultTimeboxes('low');
  const high = defaultTimeboxes('high');
  for (const g of GATES) assert.ok(high[g.id] > low[g.id], g.id);
  assert.equal(defaultTimeboxes('medium').g1, 5);
});

test('an unknown cost of being wrong falls back to medium time boxes', () => {
  assert.deepEqual(defaultTimeboxes('nonsense'), defaultTimeboxes('medium'));
});

test('a new idea starts with default rules, including a CLV:CAC target above 2', () => {
  const idea = createIdea();
  assert.equal(idea.costOfWrong, 'medium');
  assert.equal(idea.rules.minClients, 3);
  assert.equal(idea.rules.clvCacMin, 1);
  assert.equal(idea.rules.clvCacTarget, 2);
  assert.equal(idea.rules.paybackMaxMonths, 18);
  assert.deepEqual(idea.timeboxes, defaultTimeboxes('medium'));
  assert.deepEqual(DEFAULT_RULES.clvCacTarget, 2);
});

test('a time box can change before its gate starts', () => {
  const idea = setTimebox(createIdea(), 'g1', 8);
  assert.equal(idea.timeboxes.g1, 8);
});

test('starting a gate locks its time box', () => {
  const started = startGate(createIdea(), 'g1', '2026-11-24');
  assert.equal(started.started.g1, '2026-11-24');
  assert.equal(started.locked.g1, true);
  assert.equal(setTimebox(started, 'g1', 99).timeboxes.g1, 5);
});

test('starting a gate locks the stop rules that belong to it', () => {
  const started = startGate(createIdea(), 'g4', '2026-11-24');
  assert.equal(setRule(started, 'clvCacTarget', 1.5).rules.clvCacTarget, 2);
  assert.equal(setRule(createIdea(), 'clvCacTarget', 3).rules.clvCacTarget, 3);
  // A rule from another gate stays editable.
  assert.equal(setRule(started, 'minClients', 4).rules.minClients, 4);
});

test('changing the cost of being wrong only resets unlocked time boxes', () => {
  let idea = startGate(createIdea(), 'g0', '2026-11-24');
  idea = setCostOfWrong(idea, 'high');
  assert.equal(idea.costOfWrong, 'high');
  assert.equal(idea.timeboxes.g0, defaultTimeboxes('medium').g0);
  assert.equal(idea.timeboxes.g3, defaultTimeboxes('high').g3);
});

test('time box status flags an overrun', () => {
  const idea = createIdea();
  idea.spent.g1 = 7;
  const s = timeboxStatus(idea, 'g1');
  assert.equal(s.box, 5);
  assert.equal(s.spent, 7);
  assert.equal(s.overrun, true);
  assert.equal(timeboxStatus(createIdea(), 'g1').overrun, false);
});

test('gate functions do not mutate their input', () => {
  const idea = createIdea();
  setTimebox(idea, 'g1', 9);
  startGate(idea, 'g2', '2026-11-24');
  setRule(idea, 'minClients', 7);
  assert.equal(idea.timeboxes.g1, 5);
  assert.equal(idea.locked.g2, false);
  assert.equal(idea.rules.minClients, 3);
});
