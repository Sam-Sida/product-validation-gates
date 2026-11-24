// Gate evaluation and the overall recommendation: Build, Stop, or Test first.
// Each reason carries a code, a plain-language explanation, and the cheapest next test.
import { GATES } from './gates.js';
import { summarise } from './economics.js';

const blank = (v) => v === null || v === undefined || String(v).trim() === '';
const num = (v) => (blank(v) || Number.isNaN(Number(v)) ? null : Number(v));
const fmt = (n, d = 1) => Number(n).toFixed(d);

export const REGULATED_DOMAINS = [
  { id: 'financial', label: 'Financial advice or credit' },
  { id: 'health', label: 'Health' },
  { id: 'employment', label: 'Employment decisions' },
  { id: 'children', label: 'Children' },
  { id: 'consumer-claims', label: 'Consumer claims (misleading conduct)' },
];

function result(stops, weaks, unknowns) {
  if (stops.length) return { status: 'stop', reasons: stops };
  if (weaks.length) return { status: 'weak', reasons: [...weaks, ...unknowns] };
  if (unknowns.length) return { status: 'unknown', reasons: unknowns };
  return { status: 'pass', reasons: [] };
}

function screen(idea) {
  const s = idea.screen || {};
  const stops = [];
  const unknowns = [];
  if (blank(s.problem)) stops.push({ code: 'no-problem', text: 'No clear problem statement.', test: 'Write the problem in one sentence and confirm it with two clients.' });
  if (blank(s.payer)) stops.push({ code: 'no-payer', text: 'No named payer or budget owner.', test: 'Name the budget owner and ask them whether they would fund it.' });
  if (s.strategyFit === 'no') stops.push({ code: 'no-strategy-fit', text: 'The idea does not fit the strategy.', test: 'Check the strategy fit with the portfolio owner.' });
  if (s.riskTier === 'prohibited') stops.push({ code: 'prohibited', text: 'The AI use case falls in a prohibited category.', test: 'Reframe the use case outside the prohibited category, or drop it.' });
  if (s.riskTier === 'high' && s.compliancePath === 'no') stops.push({ code: 'high-risk-no-path', text: 'High-risk AI use case with no compliance path.', test: 'Get a compliance view on what a lawful path would need.' });

  const complianceTest = 'Confirm the compliance position with legal or the regulator before more work.';
  if (blank(s.riskTier)) unknowns.push({ code: 'risk-tier-unknown', text: 'The AI risk tier is not assessed.', test: complianceTest });
  if (s.approvalNeeded === 'unknown' || blank(s.approvalNeeded)) unknowns.push({ code: 'approval-unknown', text: 'Unknown whether a sector or regulator approval is needed.', test: complianceTest });
  const needsPath = s.riskTier === 'high' || (s.domains || []).length > 0 || s.approvalNeeded === 'yes';
  if (needsPath && s.compliancePath !== 'yes' && s.compliancePath !== 'no') {
    unknowns.push({ code: 'compliance-path-unknown', text: 'The idea touches regulated ground and the compliance path is unconfirmed.', test: complianceTest });
  }
  if (blank(s.strategyFit)) unknowns.push({ code: 'strategy-fit-unknown', text: 'Strategy fit is not assessed.', test: 'Check the strategy fit with the portfolio owner.' });
  if (blank(s.dataNeeded)) unknowns.push({ code: 'data-needed-unknown', text: 'The data needed is not described.', test: 'List the data sources the idea needs.' });
  return result(stops, [], unknowns);
}

function problem(idea) {
  const p = idea.problem || {};
  const min = idea.rules.minClients;
  const stops = [];
  const unknowns = [];
  const clients = num(p.clientsSharing);
  const severity = num(p.severity);
  if (clients !== null && clients < min) stops.push({ code: 'too-few-clients', text: `Only ${clients} client(s) share the pain, below the minimum of ${min}.`, test: `Interview more clients until ${min} confirm the pain, or stop.` });
  const frequent = ['daily', 'weekly'].includes(p.frequency);
  const severe = severity !== null && severity >= 4;
  if (!blank(p.frequency) && severity !== null && !frequent && !severe) {
    stops.push({ code: 'not-frequent-or-severe', text: 'The pain is neither frequent nor severe.', test: 'Look for a segment where the pain is weekly or severe.' });
  }
  if (clients === null) unknowns.push({ code: 'clients-unknown', text: 'The number of clients sharing the pain is unknown.', test: `Run short interviews until ${min} clients confirm or deny the pain.` });
  if (blank(p.frequency) || severity === null) unknowns.push({ code: 'pain-unknown', text: 'Frequency or severity is not measured.', test: 'Check usage of similar existing modules as a proxy for frequency.' });
  if (num(p.interviews) === null) unknowns.push({ code: 'no-interviews', text: 'No interviews are logged.', test: 'Run five problem interviews with target clients.' });
  return result(stops, [], unknowns);
}

function data(idea) {
  const d = idea.data || {};
  const types = d.userTypes || [];
  const stops = [];
  const unknowns = [];
  const noRights = types.filter((t) => t.rights === 'no');
  if (noRights.length) stops.push({ code: 'no-data-rights', text: `No data rights for: ${noRights.map((t) => t.name || 'unnamed user type').join(', ')}.`, test: 'Negotiate data rights, or narrow the idea to user types with rights.' });
  if (types.some((t) => t.isolation === 'no')) stops.push({ code: 'leakage-risk', text: 'One client could see another client’s detail.', test: 'Design row-level isolation, then retest with a supplier user.' });
  if (d.privacyOk === 'no') stops.push({ code: 'privacy-blocked', text: 'Privacy requirements cannot be met.', test: 'Run a privacy impact assessment on a narrower data set.' });
  if (d.countryBlock === 'yes') stops.push({ code: 'country-block', text: 'A country rule blocks the data.', test: 'Limit the launch to countries where the data can be used.' });
  if (types.length === 0) unknowns.push({ code: 'user-types-unknown', text: 'No user types are mapped to data rights.', test: 'Map every user type to the data it sees and the rights behind it.' });
  if (types.some((t) => t.rights !== 'yes' && t.rights !== 'no')) unknowns.push({ code: 'rights-unknown', text: 'Data rights are unconfirmed for at least one user type.', test: 'Check contracts and data licences for each user type.' });
  if (types.some((t) => t.isolation !== 'yes' && t.isolation !== 'no')) unknowns.push({ code: 'isolation-unknown', text: 'Client isolation is unconfirmed.', test: 'Test whether one brand can see a competitor’s detail.' });
  if (d.privacyOk !== 'yes' && d.privacyOk !== 'no') unknowns.push({ code: 'privacy-unknown', text: 'Privacy position is unconfirmed.', test: 'Run a privacy impact assessment.' });
  if (d.countryBlock !== 'yes' && d.countryBlock !== 'no') unknowns.push({ code: 'country-unknown', text: 'Country rules are unchecked.', test: 'Check data residency rules for each market.' });
  return result(stops, [], unknowns);
}

function value(idea) {
  const v = idea.value || {};
  const r = idea.rules;
  const stops = [];
  const unknowns = [];
  const evalScore = num(v.evalScore);
  const baseline = num(v.baselineScore);
  const latency = num(v.latencyP95Ms);
  const smoke = num(v.smokeConversionPct);
  if (evalScore !== null && baseline !== null && evalScore <= baseline) stops.push({ code: 'misses-baseline', text: `Evals score ${evalScore} against a baseline of ${baseline}; the AI must beat it.`, test: 'Improve retrieval or prompts and rerun the golden set, or stop.' });
  if (latency !== null && latency > r.latencyTargetMs) stops.push({ code: 'too-slow', text: `p95 latency of ${latency} ms misses the ${r.latencyTargetMs} ms target.`, test: 'Try a smaller model or caching in a one-day spike.' });
  if (v.scaleOk === 'no') stops.push({ code: 'fails-scale', text: 'The tech spike failed the scale target.', test: 'Rework the architecture and rerun the spike.' });
  if (smoke !== null && smoke < r.smokeThresholdPct) stops.push({ code: 'weak-demand', text: `The smoke test converted at ${smoke}%, below the ${r.smokeThresholdPct}% threshold.`, test: 'Retest the message with a different segment, or stop.' });
  if (num(v.goldenSetSize) === null) unknowns.push({ code: 'no-golden-set', text: 'No golden dataset exists.', test: 'Build a golden set of 50 to 100 real questions with expert answers.' });
  if (evalScore === null || baseline === null) unknowns.push({ code: 'no-evals', text: 'Evals against the baseline have not run.', test: 'Score the AI and today’s baseline on the golden set.' });
  if (latency === null || (v.scaleOk !== 'yes' && v.scaleOk !== 'no')) unknowns.push({ code: 'no-spike', text: 'The latency and scale spike has not run.', test: 'Run a two-day tech spike at expected peak load.' });
  if (smoke === null) unknowns.push({ code: 'no-smoke-test', text: 'No fake-door or smoke test has run.', test: 'Add a fake-door entry point and measure click-through for two weeks.' });
  return result(stops, [], unknowns);
}

function economics(idea) {
  const r = idea.rules;
  const s = summarise(idea.economics || {});
  const stops = [];
  const weaks = [];
  const unknowns = [];
  if (s.marginPerUse !== null && s.marginPerUse < 0) stops.push({ code: 'negative-margin', text: 'Each use loses money after inference and run costs.', test: 'Cut tokens per use or reprice, then recheck the margin.' });
  if (s.cheaperThanBespoke === false) stops.push({ code: 'bespoke-cheaper', text: 'A bespoke build costs less per client than the product.', test: 'Keep it bespoke until more clients share the need.' });
  if (s.som !== null && s.som < r.minSom) stops.push({ code: 'som-too-small', text: `SOM of $${Math.round(s.som).toLocaleString('en-AU')} is below the $${r.minSom.toLocaleString('en-AU')} minimum.`, test: 'Look for adjacent segments that widen the SOM.' });
  if (s.clvCacRatio !== null && s.clvCacRatio < r.clvCacMin) {
    stops.push({ code: 'clv-cac-below-min', text: `CLV:CAC of ${fmt(s.clvCacRatio)} is below ${r.clvCacMin}; each client costs more to win than it returns.`, test: 'Find a cheaper sales motion or a higher price before going further.' });
  } else if (s.clvCacRatio !== null && s.clvCacRatio <= r.clvCacTarget + 1e-9) {
    // The target is strictly above; the small tolerance absorbs floating-point noise.
    weaks.push({ code: 'clv-cac-below-target', text: `CLV:CAC of ${fmt(s.clvCacRatio)} misses the target of above ${r.clvCacTarget}.`, test: 'Test a higher price point or a lower-cost sales motion with two prospects.' });
  }
  if (s.paybackMonths !== null && s.paybackMonths > r.paybackMaxMonths) weaks.push({ code: 'slow-payback', text: `CAC payback of ${fmt(s.paybackMonths)} months exceeds ${r.paybackMaxMonths} months.`, test: 'Test annual upfront billing or a lighter onboarding.' });
  if (s.exceedsSom) weaks.push({ code: 'exceeds-som', text: 'The client plan needs more clients than the SOM holds.', test: 'Recheck the SOM or lower the client plan.' });

  if (s.som === null) unknowns.push({ code: 'market-unknown', text: 'TAM, SAM, and SOM are not sized.', test: 'Size the market bottom-up from target accounts.' });
  if (s.annualRevenue === null) unknowns.push({ code: 'price-unknown', text: 'No price or willingness-to-pay data.', test: 'Run a Van Westendorp survey with 15 to 30 buyers.' });
  if (s.costPerUse === null) unknowns.push({ code: 'cost-unknown', text: 'Inference cost per use is unknown.', test: 'Log tokens in and out for 20 real uses in the spike.' });
  if (s.cheaperThanBespoke === null) unknowns.push({ code: 'bespoke-unknown', text: 'No comparison with a bespoke build.', test: 'Cost the last three bespoke builds per client.' });
  if (s.clvCacRatio === null) unknowns.push({ code: 'clv-cac-unknown', text: 'CLV or CAC is missing.', test: 'Estimate CAC from the last few comparable sales and lifetime from renewals.' });
  return result(stops, weaks, unknowns);
}

const EVALUATORS = { g0: screen, g1: problem, g2: data, g3: value, g4: economics };

export function evaluateGate(gateId, idea) {
  return EVALUATORS[gateId](idea);
}

export function evaluate(idea) {
  const gates = [];
  let stoppedAt = null;
  for (const g of GATES) {
    if (stoppedAt) {
      gates.push({ id: g.id, name: g.name, status: 'not-reached', reasons: [] });
      continue;
    }
    const r = evaluateGate(g.id, idea);
    gates.push({ id: g.id, name: g.name, ...r });
    if (r.status === 'stop') stoppedAt = g.id;
  }

  if (stoppedAt) {
    const gate = gates.find((g) => g.id === stoppedAt);
    return { recommendation: 'stop', decidingGate: stoppedAt, gates, reason: gate.reasons[0].text, nextTest: null };
  }
  const open = gates.find((g) => g.status !== 'pass');
  if (open) {
    return { recommendation: 'test', decidingGate: open.id, gates, reason: open.reasons[0].text, nextTest: open.reasons[0].test };
  }
  return { recommendation: 'build', decidingGate: null, gates, reason: 'Every gate passed on evidence.', nextTest: null };
}

export const RECOMMENDATION_LABEL = { build: 'Build', stop: 'Stop', test: 'Test first' };
export const STATUS_LABEL = { pass: 'Pass', stop: 'Stop', weak: 'Weak', unknown: 'Unknown', 'not-reached': 'Not reached' };
