// Portfolio metrics: how good the process is at saying no early and cheaply,
// and whether its yeses beat past productisations.

const EARLY = ['g0', 'g1', 'g2'];
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function portfolioMetrics(log, { baselineHitRatePct = null } = {}) {
  const total = log.length;
  const stopped = log.filter((e) => e.recommendation === 'stop');
  const builds = log.filter((e) => e.recommendation === 'build');
  const early = stopped.filter((e) => EARLY.includes(e.decidingGate));
  const late = stopped.filter((e) => !EARLY.includes(e.decidingGate));
  const stopsByGate = { g0: 0, g1: 0, g2: 0, g3: 0, g4: 0 };
  for (const e of stopped) if (e.decidingGate in stopsByGate) stopsByGate[e.decidingGate] += 1;

  const withOutcome = builds.filter((e) => e.outcome === 'success' || e.outcome === 'fail');
  const hitRatePct = withOutcome.length
    ? (withOutcome.filter((e) => e.outcome === 'success').length / withOutcome.length) * 100 : null;
  const baseline = baselineHitRatePct === null || baselineHitRatePct === '' ? null : Number(baselineHitRatePct);

  return {
    total,
    stops: stopped.length,
    builds: builds.length,
    tests: log.filter((e) => e.recommendation === 'test').length,
    stopsByGate,
    earlyStopSharePct: total ? (early.length / total) * 100 : null,
    avgDays: avg(log.map((e) => Number(e.days) || 0)),
    avgCost: avg(log.map((e) => Number(e.cost) || 0)),
    avgCostEarlyStop: avg(early.map((e) => Number(e.cost) || 0)),
    avgCostLateStop: avg(late.map((e) => Number(e.cost) || 0)),
    buildsWithOutcome: withOutcome.length,
    hitRatePct,
    baselineHitRatePct: baseline,
    hitRateDeltaPts: hitRatePct !== null && baseline !== null ? hitRatePct - baseline : null,
  };
}

export function quarterOf(dateStr) {
  const [y, m] = String(dateStr).split('-').map(Number);
  return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
}

// Small seeded PRNG so a quarter's audit sample is repeatable.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function auditSample(log, quarter, n, seed = 1) {
  const pool = log.filter((e) => e.recommendation === 'stop' && quarterOf(e.decidedAt) === quarter);
  const rand = mulberry32(seed);
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(n, pool.length));
}
