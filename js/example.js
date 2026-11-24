// Worked example and a sample portfolio for the metrics view.
// The figures are illustrative, not real client data.
import { createIdea } from './gates.js';

const RESPONSES = [
  'too cheap, cheap, expensive, too expensive (annual subscription, AUD)',
  '12000, 22000, 42000, 60000',
  '15000, 25000, 45000, 65000',
  '10000, 20000, 38000, 55000',
  '18000, 28000, 48000, 70000',
  '14000, 24000, 40000, 58000',
  '16000, 26000, 44000, 62000',
  '20000, 30000, 50000, 75000',
  '12000, 24000, 42000, 60000',
  '15000, 27000, 46000, 66000',
  '11000, 21000, 36000, 52000',
  '17000, 29000, 47000, 68000',
  '13000, 23000, 41000, 59000',
].join('\n');

export function workedExample() {
  return createIdea({
    id: 'example-category-trend-explainer',
    title: 'Category trend explainer',
    summary: 'A consultant-built GenAI tool that analyses a retail category, such as chocolate bars, shows which brands are trending, and explains why. The question: should it become a product that brand teams use themselves?',
    costOfWrong: 'medium',
    timeboxes: { g0: 2, g1: 5, g2: 5, g3: 10, g4: 5 },
    locked: { g0: true, g1: true, g2: true, g3: true, g4: true },
    started: { g0: '2026-10-05', g1: '2026-10-07', g2: '2026-10-14', g3: '2026-10-21', g4: '2026-10-21' },
    spent: { g0: 1, g1: 4, g2: 3, g3: 6, g4: 4 },
    screen: {
      problem: 'Category managers spend two to three days a month pulling sales, price, and promotion data to explain why brands in a category such as chocolate bars rise or fall. Consultants rebuild the same analysis for each client.',
      payer: 'Category and insights teams at mid-to-large consumer goods suppliers. Budget owner: Head of Category or Head of Insights.',
      strategyFit: 'yes',
      dataNeeded: 'Weekly retail sales by product and store cluster, price and promotion calendars, distribution, and public search trend signals for chocolate bars and adjacent snacks.',
      domains: ['consumer-claims'],
      riskTier: 'limited',
      approvalNeeded: 'no',
      compliancePath: 'yes',
      markets: 'Australia and New Zealand',
      costPerDay: 1600,
    },
    problem: {
      frequency: 'weekly',
      severity: 4,
      clientsSharing: 6,
      interviews: 9,
      proxyUsage: 'An existing category dashboard is opened monthly by 41 of 60 client accounts, and "why did this brand move?" questions make up about a third of analyst support requests.',
    },
    data: {
      userTypes: [
        { name: 'Brand supplier user', source: 'supplier', rights: 'yes', isolation: 'yes' },
        { name: 'Retailer category team', source: 'first-party', rights: 'yes', isolation: 'yes' },
        { name: 'Internal consultant', source: 'first-party', rights: 'yes', isolation: 'yes' },
      ],
      privacyOk: 'yes',
      countries: 'Australia and New Zealand. Data stays in-region.',
      countryBlock: 'no',
    },
    value: {
      goldenSetSize: 120,
      evalScore: 0.82,
      baselineScore: 0.64,
      latencyP95Ms: 6500,
      scaleOk: 'unknown',
      smokeConversionPct: 14,
    },
    economics: {
      tam: 120000000,
      samPct: 25,
      somPct: 5,
      responses: RESPONSES,
      tokensIn: 40000,
      tokensOut: 1500,
      priceInPerM: 3,
      priceOutPerM: 15,
      callsPerUse: 3,
      otherCostPerUse: 0.15,
      usesPerClientYear: 600,
      supportCostPerClientYear: 8000,
      annualRevenue: 36000,
      bespokeCostPerClient: 45000,
      buildCost: 250000,
      newClientsY1: 4,
      newClientsY2: 8,
      newClientsY3: 10,
      lifetimeYears: 3,
      churnPct: null,
      acquisitionSpend: 180000,
      newClientsWon: 4,
    },
    decision: {
      decider: 'Product lead, Applied AI',
      date: '2026-11-04',
      revisitTrigger: 'The scale spike passes at 50 concurrent users, and two pilot clients accept a higher price or a lighter sales motion.',
      notes: '',
    },
  });
}

export function samplePortfolio() {
  const e = (id, title, recommendation, decidingGate, days, decidedAt, outcome = null) => ({
    id, title, recommendation, decidingGate, days, cost: days * 1600, decidedAt, outcome,
  });
  return [
    e('p1', 'Promotion uplift forecaster', 'build', null, 22, '2026-03-12', 'success'),
    e('p2', 'Shelf gap detector', 'stop', 'g1', 3, '2026-04-02'),
    e('p3', 'Store manager chat assistant', 'stop', 'g0', 1, '2026-04-20'),
    e('p4', 'Supplier contract summariser', 'stop', 'g2', 4, '2026-05-14'),
    e('p5', 'Loyalty churn explainer', 'build', null, 25, '2026-06-03', 'fail'),
    e('p6', 'Range review copilot', 'test', 'g3', 9, '2026-07-08'),
    e('p7', 'Price elasticity explainer', 'stop', 'g4', 15, '2026-08-19'),
    e('p8', 'Recipe-based basket builder', 'stop', 'g0', 1, '2026-09-02'),
    e('p9', 'Media audience matcher', 'build', null, 24, '2026-09-23', 'success'),
    e('p10', 'Out-of-stock alert writer', 'stop', 'g1', 2, '2026-10-06'),
    e('p11', 'Competitor price tracker', 'stop', 'g2', 3, '2026-10-21'),
    e('p12', 'Planogram compliance checker', 'test', 'g3', 14, '2026-11-04'),
    e('p13', 'Store layout image checker', 'stop', 'g3', 11, '2026-11-12'),
    e('p14', 'Weekly trading summary bot', 'stop', 'g0', 1, '2026-11-18'),
  ];
}
