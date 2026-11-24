import { test, assert } from './runner.js';
import { passingIdea, VW_TEXT } from './fixtures.js';
import {
  inferenceCostPerUse, marketSizes, parseResponses, vanWestendorp,
  clv, cac, paybackMonths, threeYearCase, summarise,
} from '../js/economics.js';

test('inference cost per use counts tokens in and out across calls', () => {
  const cost = inferenceCostPerUse({ tokensIn: 40000, tokensOut: 1500, priceInPerM: 3, priceOutPerM: 15, callsPerUse: 3 });
  assert.close(cost, 0.4275);
});

test('inference cost defaults to one call per use', () => {
  assert.close(inferenceCostPerUse({ tokensIn: 1000000, tokensOut: 0, priceInPerM: 3, priceOutPerM: 15 }), 3);
});

test('market sizes derive SAM and SOM from TAM shares', () => {
  const m = marketSizes({ tam: 120000000, samPct: 25, somPct: 5 });
  assert.equal(m.sam, 30000000);
  assert.equal(m.som, 1500000);
});

test('survey responses parse from CSV, skipping headers and bad rows', () => {
  const rows = parseResponses('too cheap,cheap,expensive,too expensive\n10,20,40,60\nbad row\n$12; 22; 45; 70\n1\t2\t3\t4');
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[1], { tooCheap: 12, cheap: 22, expensive: 45, tooExpensive: 70 });
});

test('Van Westendorp finds the four price points', () => {
  const vw = vanWestendorp(parseResponses(VW_TEXT));
  assert.close(vw.pmc, 5);
  assert.close(vw.opp, 6);
  assert.close(vw.ipp, 6);
  assert.close(vw.pme, 7);
});

test('Van Westendorp interpolates between price points', () => {
  // Too cheap at 0 or 10, too expensive at 4 or 14: the curves cross between 4 and 10.
  const vw = vanWestendorp([
    { tooCheap: 0, cheap: 2, expensive: 4, tooExpensive: 4 },
    { tooCheap: 10, cheap: 12, expensive: 14, tooExpensive: 14 },
  ]);
  assert.ok(vw.opp >= 4 && vw.opp <= 10, `opp ${vw.opp}`);
});

test('Van Westendorp returns null without responses', () => {
  assert.equal(vanWestendorp([]), null);
});

test('CLV uses the expected lifetime in years', () => {
  assert.close(clv({ annualRevenue: 36000, grossMarginPct: 75, lifetimeYears: 3 }), 81000);
});

test('CLV derives lifetime from churn when no lifetime is given', () => {
  assert.close(clv({ annualRevenue: 36000, grossMarginPct: 75, lifetimeYears: null, churnPct: 25 }), 108000);
});

test('CLV prefers the lifetime over churn when both are given', () => {
  assert.close(clv({ annualRevenue: 36000, grossMarginPct: 75, lifetimeYears: 3, churnPct: 25 }), 81000);
});

test('CLV is null when lifetime and churn are both missing', () => {
  assert.equal(clv({ annualRevenue: 36000, grossMarginPct: 75 }), null);
});

test('CAC divides acquisition spend by new clients won', () => {
  assert.equal(cac({ acquisitionSpend: 180000, newClientsWon: 4 }), 45000);
  assert.equal(cac({ acquisitionSpend: 180000, newClientsWon: 0 }), null);
});

test('CAC payback is in months of gross profit', () => {
  assert.close(paybackMonths({ cac: 45000, annualRevenue: 36000, grossMarginPct: 75 }), 20);
});

test('the three-year case finds the break-even month', () => {
  const c = threeYearCase({
    buildCost: 100000, newClientsByYear: [2, 2, 2], annualRevenue: 50000,
    grossMarginPct: 80, cac: 10000, churnPct: 0,
  });
  assert.equal(c.years.length, 3);
  assert.equal(c.years[0].activeClients, 2);
  assert.close(c.years[0].grossProfit, 80000);
  assert.close(c.years[0].acquisition, 20000);
  assert.close(c.years[0].cumulative, -40000);
  assert.close(c.years[1].cumulative, 100000);
  assert.equal(c.breakEvenMonth, 16);
});

test('the three-year case applies churn to active clients', () => {
  const c = threeYearCase({
    buildCost: 0, newClientsByYear: [2, 2, 2], annualRevenue: 1000,
    grossMarginPct: 100, cac: 0, churnPct: 50,
  });
  assert.close(c.years[1].activeClients, 3);
});

test('the three-year case returns no break-even when cash never recovers', () => {
  const c = threeYearCase({
    buildCost: 10000000, newClientsByYear: [1, 1, 1], annualRevenue: 1000,
    grossMarginPct: 50, cac: 100, churnPct: 0,
  });
  assert.equal(c.breakEvenMonth, null);
});

test('summarise derives margin, CLV, CAC, ratio, and payback', () => {
  const s = summarise(passingIdea().economics);
  assert.close(s.costPerUse, 0.095);
  assert.close(s.revenuePerUse, 40);
  assert.close(s.grossMarginPct, 87.2625);
  assert.close(s.clv, 139620);
  assert.close(s.cac, 25000);
  assert.close(s.clvCacRatio, 5.5848);
  assert.close(s.paybackMonths, 25000 / (40000 * 0.872625 / 12));
  assert.close(s.productCostPerClient, 200000 / 18 + 95 + 5000, 1e-6);
  assert.equal(s.som, 2000000);
  assert.equal(s.cheaperThanBespoke, true);
  assert.equal(s.revenueSource, 'entered');
});

test('summarise falls back to the Van Westendorp optimal price for revenue', () => {
  const e = passingIdea().economics;
  e.annualRevenue = null;
  e.responses = VW_TEXT.split('\n').map((line, i) => (i === 0 ? line : line.split(',').map((n) => Number(n) * 1000).join(','))).join('\n');
  const s = summarise(e);
  assert.close(s.annualRevenue, 6000);
  assert.equal(s.revenueSource, 'Van Westendorp optimal price');
});

test('summarise flags clients beyond what the SOM can hold', () => {
  const e = passingIdea().economics;
  e.somPct = 0.1; // SOM of $20,000 holds half a client at $40,000
  assert.equal(summarise(e).exceedsSom, true);
  assert.equal(summarise(passingIdea().economics).exceedsSom, false);
});

test('summarise leaves figures null when inputs are missing', () => {
  const s = summarise({});
  assert.equal(s.clv, null);
  assert.equal(s.cac, null);
  assert.equal(s.clvCacRatio, null);
});
