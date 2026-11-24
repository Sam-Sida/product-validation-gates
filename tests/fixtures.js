// Shared test fixtures. passingIdea() passes every gate on evidence.
import { createIdea } from '../js/gates.js';

export function passingIdea() {
  const idea = createIdea({ title: 'Passing idea' });
  idea.screen = {
    problem: 'Analysts rebuild the same report every month.',
    payer: 'Insights team budget owner',
    strategyFit: 'yes',
    dataNeeded: 'Weekly sales by product',
    domains: [],
    riskTier: 'minimal',
    approvalNeeded: 'no',
    compliancePath: 'yes',
    markets: 'AU',
    costPerDay: 1500,
  };
  idea.problem = {
    frequency: 'weekly',
    severity: 4,
    clientsSharing: 5,
    interviews: 8,
    proxyUsage: 'A similar module is opened monthly by 40 of 60 accounts.',
  };
  idea.data = {
    userTypes: [{ name: 'Brand', source: 'supplier', rights: 'yes', isolation: 'yes' }],
    privacyOk: 'yes',
    countries: 'AU',
    countryBlock: 'no',
  };
  idea.value = {
    goldenSetSize: 100,
    evalScore: 0.8,
    baselineScore: 0.6,
    latencyP95Ms: 4000,
    scaleOk: 'yes',
    smokeConversionPct: 15,
  };
  idea.economics = {
    tam: 100000000,
    samPct: 20,
    somPct: 10,
    responses: '',
    tokensIn: 10000,
    tokensOut: 1000,
    priceInPerM: 3,
    priceOutPerM: 15,
    callsPerUse: 1,
    otherCostPerUse: 0.05,
    usesPerClientYear: 1000,
    supportCostPerClientYear: 5000,
    annualRevenue: 40000,
    bespokeCostPerClient: 50000,
    buildCost: 200000,
    newClientsY1: 4,
    newClientsY2: 6,
    newClientsY3: 8,
    lifetimeYears: 4,
    churnPct: null,
    acquisitionSpend: 100000,
    newClientsWon: 4,
  };
  return idea;
}

// Five respondents with hand-computable Van Westendorp points:
// PMC 5, OPP 6, IPP 6, PME 7.
export const VW_TEXT = [
  'too cheap, cheap, expensive, too expensive',
  '2, 3, 5, 6',
  '3, 4, 6, 7',
  '4, 5, 7, 8',
  '5, 6, 8, 9',
  '6, 7, 9, 10',
].join('\n');
