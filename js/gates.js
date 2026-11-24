// Gate definitions, default stop-rule thresholds, and time boxes.
// All functions are pure: they return a new idea and never mutate their input.

export const GATES = [
  {
    id: 'g0',
    key: 'screen',
    name: 'Screen',
    purpose: 'Check the idea has a clear problem, a payer, a strategy fit, and a lawful path before anyone spends real time on it.',
    stopRules: [
      'Stop if there is no clear problem statement or no named payer.',
      'Stop if the idea does not fit the strategy.',
      'Stop if the AI use case is prohibited, or high-risk with no compliance path.',
    ],
  },
  {
    id: 'g1',
    key: 'problem',
    name: 'Problem',
    purpose: 'Prove the pain is frequent or severe, and shared by enough clients to justify a product rather than a one-off.',
    stopRules: [
      'Stop if fewer than the minimum number of clients share the pain.',
      'Stop if the pain is neither frequent nor severe.',
    ],
  },
  {
    id: 'g2',
    key: 'data',
    name: 'Data and legal',
    purpose: 'Confirm the rights to use the data for every user type, that clients stay isolated from each other, and that privacy and country rules allow it.',
    stopRules: [
      'Stop if any user type lacks the rights to the data it needs.',
      'Stop if one client could see another client’s detail.',
      'Stop if privacy rules or a country block rule it out.',
    ],
  },
  {
    id: 'g3',
    key: 'value',
    name: 'Value and AI quality',
    purpose: 'Show the AI beats today’s baseline on a golden dataset, runs fast enough at scale, and that people want it.',
    stopRules: [
      'Stop if the evals do not beat the baseline.',
      'Stop if the tech spike misses the latency or scale target.',
      'Stop if the fake-door or smoke test converts below the threshold.',
    ],
  },
  {
    id: 'g4',
    key: 'economics',
    name: 'Economics',
    purpose: 'Show the market is big enough, people will pay, each use makes money, the product beats a bespoke build, and CLV comfortably covers CAC.',
    stopRules: [
      'Stop if the margin per use is negative.',
      'Stop if a bespoke build costs less per client.',
      'Stop if the SOM is below the minimum.',
      'Stop if CLV:CAC is below the minimum. Below the target means test first.',
    ],
  },
];

export const GATE_IDS = GATES.map((g) => g.id);

export function gateById(id) {
  return GATES.find((g) => g.id === id) || null;
}

// Effort should match the cost of being wrong.
export const TIMEBOX_DAYS = {
  low: { g0: 1, g1: 3, g2: 3, g3: 5, g4: 3 },
  medium: { g0: 2, g1: 5, g2: 5, g3: 10, g4: 5 },
  high: { g0: 3, g1: 10, g2: 10, g3: 20, g4: 10 },
};

export const DEFAULT_RULES = {
  minClients: 3,
  latencyTargetMs: 10000,
  smokeThresholdPct: 10,
  minSom: 1000000,
  clvCacMin: 1,
  clvCacTarget: 2,
  paybackMaxMonths: 18,
};

// Which gate owns each rule. A rule locks when its gate starts.
export const RULE_GATE = {
  minClients: 'g1',
  latencyTargetMs: 'g3',
  smokeThresholdPct: 'g3',
  minSom: 'g4',
  clvCacMin: 'g4',
  clvCacTarget: 'g4',
  paybackMaxMonths: 'g4',
};

const clone = (v) => JSON.parse(JSON.stringify(v));

export function defaultTimeboxes(costOfWrong) {
  return { ...(TIMEBOX_DAYS[costOfWrong] || TIMEBOX_DAYS.medium) };
}

const allFalse = () => Object.fromEntries(GATE_IDS.map((id) => [id, false]));

export function createIdea(overrides = {}) {
  return {
    id: `idea-${Date.now().toString(36)}`,
    title: '',
    summary: '',
    costOfWrong: 'medium',
    timeboxes: defaultTimeboxes('medium'),
    rules: { ...DEFAULT_RULES },
    locked: allFalse(),
    started: {},
    spent: {},
    screen: {
      problem: '', payer: '', strategyFit: '', dataNeeded: '',
      domains: [], riskTier: '', approvalNeeded: '', compliancePath: '', markets: '', costPerDay: null,
    },
    problem: { frequency: '', severity: null, clientsSharing: null, interviews: null, proxyUsage: '' },
    data: { userTypes: [], privacyOk: '', countries: '', countryBlock: '' },
    value: {
      goldenSetSize: null, evalScore: null, baselineScore: null,
      latencyP95Ms: null, scaleOk: '', smokeConversionPct: null,
    },
    economics: {},
    decision: { decider: '', date: '', revisitTrigger: '', notes: '' },
    ...clone(overrides),
  };
}

export function startGate(idea, gateId, date) {
  const next = clone(idea);
  next.locked = { ...allFalse(), ...next.locked, [gateId]: true };
  next.started = { ...next.started, [gateId]: date };
  return next;
}

export function setTimebox(idea, gateId, days) {
  if (idea.locked && idea.locked[gateId]) return clone(idea);
  const next = clone(idea);
  next.timeboxes[gateId] = Number(days);
  return next;
}

export function setRule(idea, key, value) {
  const gateId = RULE_GATE[key];
  if (gateId && idea.locked && idea.locked[gateId]) return clone(idea);
  const next = clone(idea);
  next.rules[key] = Number(value);
  return next;
}

export function setCostOfWrong(idea, level) {
  const next = clone(idea);
  next.costOfWrong = TIMEBOX_DAYS[level] ? level : 'medium';
  const boxes = defaultTimeboxes(next.costOfWrong);
  for (const id of GATE_IDS) {
    if (!(next.locked && next.locked[id])) next.timeboxes[id] = boxes[id];
  }
  return next;
}

export function timeboxStatus(idea, gateId) {
  const box = Number(idea.timeboxes[gateId]) || 0;
  const spent = Number((idea.spent || {})[gateId]) || 0;
  return { box, spent, overrun: spent > box };
}
