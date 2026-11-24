import { test, assert } from './runner.js';
import { workedExample, samplePortfolio } from '../js/example.js';
import { evaluate } from '../js/decision.js';
import { summarise, vanWestendorp, parseResponses } from '../js/economics.js';

test('the worked example is the retail category trend tool', () => {
  const idea = workedExample();
  assert.ok(/chocolate/i.test(idea.screen.problem + idea.screen.dataNeeded + idea.title + (idea.summary || '')));
});

test('the worked example ends in Test first, deciding at Value and AI quality', () => {
  const ev = evaluate(workedExample());
  assert.equal(ev.recommendation, 'test');
  assert.equal(ev.decidingGate, 'g3');
  assert.ok(['pass', 'unknown', 'weak'].includes(ev.gates[4].status));
});

test('the worked example has a CLV:CAC between 1 and 2, below the target', () => {
  const s = summarise(workedExample().economics);
  assert.ok(s.clvCacRatio > 1 && s.clvCacRatio < 2, `ratio ${s.clvCacRatio}`);
  assert.equal(evaluate(workedExample()).gates[4].status, 'weak');
});

test('the worked example price sits inside the acceptable Van Westendorp range', () => {
  const e = workedExample().economics;
  const vw = vanWestendorp(parseResponses(e.responses));
  assert.ok(e.annualRevenue >= vw.pmc && e.annualRevenue <= vw.pme, `${vw.pmc}-${vw.pme}`);
});

test('the worked example returns a fresh copy each time', () => {
  const a = workedExample();
  a.title = 'changed';
  assert.ok(workedExample().title !== 'changed');
});

test('the sample portfolio has stops at early gates and builds with outcomes', () => {
  const log = samplePortfolio();
  assert.ok(log.length >= 10);
  assert.ok(log.some((e) => e.recommendation === 'stop' && ['g0', 'g1', 'g2'].includes(e.decidingGate)));
  assert.ok(log.some((e) => e.recommendation === 'build' && e.outcome));
});
