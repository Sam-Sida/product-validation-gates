// Economics calculators: inference cost, market size, Van Westendorp,
// margin, CLV, CAC, payback, and a three-year mini business case. All pure.

const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const has = (...vals) => vals.every((v) => num(v) !== null);

export function inferenceCostPerUse({ tokensIn, tokensOut, priceInPerM, priceOutPerM, callsPerUse = 1 }) {
  if (!has(tokensIn, tokensOut, priceInPerM, priceOutPerM)) return null;
  const calls = num(callsPerUse) ?? 1;
  return ((num(tokensIn) * num(priceInPerM) + num(tokensOut) * num(priceOutPerM)) / 1e6) * calls;
}

export function marketSizes({ tam, samPct, somPct }) {
  const t = num(tam);
  const sam = t !== null && num(samPct) !== null ? (t * num(samPct)) / 100 : null;
  const som = sam !== null && num(somPct) !== null ? (sam * num(somPct)) / 100 : null;
  return { tam: t, sam, som };
}

// One respondent per line: too cheap, cheap, expensive, too expensive.
export function parseResponses(text) {
  if (!text) return [];
  const rows = [];
  for (const line of String(text).split(/\r?\n/)) {
    const parts = line.split(/[,;\t]/).map((p) => p.replace(/[$\s]/g, '')).filter((p) => p !== '');
    if (parts.length !== 4) continue;
    const n = parts.map(Number);
    if (n.some((x) => Number.isNaN(x))) continue;
    rows.push({ tooCheap: n[0], cheap: n[1], expensive: n[2], tooExpensive: n[3] });
  }
  return rows;
}

// First price where (a - b) reaches zero or changes sign, with linear interpolation.
// When the curves meet over a flat stretch, return the middle of that stretch.
function crossing(prices, a, b) {
  let prev = null;
  for (let i = 0; i < prices.length; i += 1) {
    const p = prices[i];
    const d = a(p) - b(p);
    if (Math.abs(d) < 1e-12) {
      let j = i;
      while (j + 1 < prices.length && Math.abs(a(prices[j + 1]) - b(prices[j + 1])) < 1e-12) j += 1;
      return (p + prices[j]) / 2;
    }
    if (prev && Math.sign(d) !== Math.sign(prev.d)) {
      return prev.p + ((p - prev.p) * prev.d) / (prev.d - d);
    }
    prev = { p, d };
  }
  return null;
}

export function vanWestendorp(responses) {
  if (!responses || responses.length === 0) return null;
  const n = responses.length;
  const share = (pred) => responses.filter(pred).length / n;
  const tooCheap = (p) => share((r) => r.tooCheap >= p);
  const cheap = (p) => share((r) => r.cheap >= p);
  const notCheap = (p) => share((r) => r.cheap < p);
  const expensive = (p) => share((r) => r.expensive <= p);
  const notExpensive = (p) => share((r) => r.expensive > p);
  const tooExpensive = (p) => share((r) => r.tooExpensive <= p);
  const prices = [...new Set(responses.flatMap((r) => [r.tooCheap, r.cheap, r.expensive, r.tooExpensive]))].sort((x, y) => x - y);
  return {
    pmc: crossing(prices, tooCheap, notCheap), // point of marginal cheapness
    opp: crossing(prices, tooCheap, tooExpensive), // optimal price point
    ipp: crossing(prices, cheap, expensive), // indifference price point
    pme: crossing(prices, notExpensive, tooExpensive), // point of marginal expensiveness
    respondents: n,
  };
}

export function clv({ annualRevenue, grossMarginPct, lifetimeYears, churnPct }) {
  if (!has(annualRevenue, grossMarginPct)) return null;
  let life = num(lifetimeYears);
  if (life === null && num(churnPct) > 0) life = 100 / num(churnPct);
  if (life === null) return null;
  return num(annualRevenue) * (num(grossMarginPct) / 100) * life;
}

export function cac({ acquisitionSpend, newClientsWon }) {
  if (!has(acquisitionSpend) || !(num(newClientsWon) > 0)) return null;
  return num(acquisitionSpend) / num(newClientsWon);
}

export function paybackMonths({ cac: c, annualRevenue, grossMarginPct }) {
  if (!has(c, annualRevenue, grossMarginPct)) return null;
  const monthlyProfit = (num(annualRevenue) * num(grossMarginPct)) / 100 / 12;
  return monthlyProfit > 0 ? num(c) / monthlyProfit : null;
}

// Build cost lands at month 0; each year's net cash spreads evenly over its months.
export function threeYearCase({ buildCost, newClientsByYear, annualRevenue, grossMarginPct, cac: c, churnPct }) {
  const churn = (num(churnPct) || 0) / 100;
  const rev = num(annualRevenue) || 0;
  const gm = (num(grossMarginPct) || 0) / 100;
  const acqPerClient = num(c) || 0;
  let active = 0;
  let cumulative = -(num(buildCost) || 0);
  let breakEvenMonth = cumulative >= 0 ? 0 : null;
  const years = newClientsByYear.map((raw, i) => {
    const newClients = num(raw) || 0;
    active = active * (1 - churn) + newClients;
    const revenue = active * rev;
    const grossProfit = revenue * gm;
    const acquisition = newClients * acqPerClient;
    const net = grossProfit - acquisition;
    const start = cumulative;
    cumulative += net;
    if (breakEvenMonth === null && cumulative >= 0 && net > 0) {
      breakEvenMonth = i * 12 + Math.max(1, Math.ceil((-start / net) * 12));
    }
    return { year: i + 1, newClients, activeClients: active, revenue, grossProfit, acquisition, net, cumulative };
  });
  return { years, breakEvenMonth };
}

export function summarise(e = {}) {
  const costPerUse = (() => {
    const inf = inferenceCostPerUse(e);
    return inf === null ? null : inf + (num(e.otherCostPerUse) || 0);
  })();
  const sizes = marketSizes(e);
  const vw = vanWestendorp(parseResponses(e.responses));

  let annualRevenue = num(e.annualRevenue);
  let revenueSource = annualRevenue !== null ? 'entered' : null;
  if (annualRevenue === null && vw && vw.opp !== null) {
    annualRevenue = vw.opp;
    revenueSource = 'Van Westendorp optimal price';
  }

  const uses = num(e.usesPerClientYear);
  const support = num(e.supportCostPerClientYear) || 0;
  const revenuePerUse = annualRevenue !== null && uses > 0 ? annualRevenue / uses : null;
  const marginPerUse = revenuePerUse !== null && costPerUse !== null ? revenuePerUse - costPerUse : null;
  const runCostPerClient = costPerUse !== null && uses !== null ? costPerUse * uses + support : null;
  const grossMarginPct = annualRevenue > 0 && runCostPerClient !== null
    ? ((annualRevenue - runCostPerClient) / annualRevenue) * 100 : null;

  const newClientsByYear = [e.newClientsY1, e.newClientsY2, e.newClientsY3].map((v) => num(v) || 0);
  const totalClients = newClientsByYear.reduce((a, b) => a + b, 0);
  const productCostPerClient = has(e.buildCost) && totalClients > 0 && runCostPerClient !== null
    ? num(e.buildCost) / totalClients + runCostPerClient : null;
  const bespokeCostPerClient = num(e.bespokeCostPerClient);
  const cheaperThanBespoke = productCostPerClient !== null && bespokeCostPerClient !== null
    ? productCostPerClient < bespokeCostPerClient : null;

  const clvValue = clv({ annualRevenue, grossMarginPct, lifetimeYears: e.lifetimeYears, churnPct: e.churnPct });
  const cacValue = cac(e);
  const clvCacRatio = clvValue !== null && cacValue > 0 ? clvValue / cacValue : null;
  const payback = paybackMonths({ cac: cacValue, annualRevenue, grossMarginPct });

  const clientCapacity = sizes.som !== null && annualRevenue > 0 ? sizes.som / annualRevenue : null;
  const exceedsSom = clientCapacity !== null && totalClients > 0 ? totalClients > clientCapacity : false;

  const businessCase = annualRevenue !== null && grossMarginPct !== null && totalClients > 0
    ? threeYearCase({ buildCost: e.buildCost, newClientsByYear, annualRevenue, grossMarginPct, cac: cacValue, churnPct: e.churnPct })
    : null;

  return {
    costPerUse, revenuePerUse, marginPerUse, runCostPerClient, grossMarginPct,
    tam: sizes.tam, sam: sizes.sam, som: sizes.som, vw,
    annualRevenue, revenueSource,
    totalClients, productCostPerClient, bespokeCostPerClient, cheaperThanBespoke,
    clv: clvValue, cac: cacValue, clvCacRatio, paybackMonths: payback,
    clientCapacity, exceedsSom, businessCase,
  };
}
