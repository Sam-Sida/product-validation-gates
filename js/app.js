// UI wiring. All logic lives in the pure modules; this file reads inputs,
// updates the idea, and re-renders statuses, numbers, and the evidence pack.
import { GATES, createIdea, startGate, setTimebox, setRule, setCostOfWrong, timeboxStatus } from './gates.js';
import { evaluate, REGULATED_DOMAINS, RECOMMENDATION_LABEL, STATUS_LABEL } from './decision.js';
import { summarise } from './economics.js';
import { generatePack, markdownToHtml, packFileName, aud } from './pack.js';
import { portfolioMetrics, quarterOf, auditSample } from './portfolio.js';
import { createStore, defaultBackend } from './storage.js';
import { workedExample, samplePortfolio } from './example.js';

const store = createStore(defaultBackend());
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const RULE_META = {
  g1: [{ key: 'minClients', label: 'Minimum clients sharing the pain' }],
  g3: [
    { key: 'latencyTargetMs', label: 'Latency target, p95 (ms)' },
    { key: 'smokeThresholdPct', label: 'Smoke test threshold (%)' },
  ],
  g4: [
    { key: 'minSom', label: 'Minimum SOM (AUD)' },
    { key: 'clvCacMin', label: 'Stop if CLV:CAC is below' },
    { key: 'clvCacTarget', label: 'Target CLV:CAC (above)' },
    { key: 'paybackMaxMonths', label: 'Maximum CAC payback (months)' },
  ],
};

let idea;
let log;
let settings;
let current = 'g0';
let saveTimer = null;

// ---------- helpers ----------
const today = () => new Date().toLocaleDateString('en-CA');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const audSmall = (n) => (n === null || n === undefined ? 'n/a' : `$${Number(n).toFixed(n < 1 ? 3 : 2)}`);
const fixed = (n, d = 1) => (n === null || n === undefined ? 'n/a' : Number(n).toFixed(d));
const toNum = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  keys.slice(0, -1).forEach((k) => { if (o[k] == null || typeof o[k] !== 'object') o[k] = {}; o = o[k]; });
  o[keys[keys.length - 1]] = value;
}

// ---------- persistence ----------
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const ok = store.saveDraft(idea);
    $('#save-status').textContent = ok
      ? `Draft saved in this browser at ${new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}. Nothing leaves your device.`
      : 'This browser blocks storage, so drafts won’t persist. Download the pack to keep your work.';
  }, 400);
}

// ---------- static rendering ----------
function renderStatic() {
  for (const g of GATES) $(`[data-purpose="${g.id}"]`).textContent = g.purpose;
  $('#domains').innerHTML = '<p class="checks-label">Regulated domains it touches</p>' + REGULATED_DOMAINS.map((d) => `
    <label class="check"><input type="checkbox" data-domain="${d.id}"> ${esc(d.label)}</label>`).join('');
  const steps = [...GATES.map((g, i) => ({ id: g.id, num: `Gate ${i}`, name: g.name })), { id: 'decision', num: 'Result', name: 'Decision' }];
  $('#stepper').innerHTML = steps.map((s) => `
    <li><button type="button" class="step" data-step="${s.id}">
      <span class="step-dot" aria-hidden="true"></span>
      <span class="step-text"><span class="step-num">${s.num}</span><span class="step-name">${esc(s.name)}</span></span>
      <span class="step-status"></span>
    </button></li>`).join('');
}

function renderRules(gateId) {
  const g = GATES.find((x) => x.id === gateId);
  const locked = !!(idea.locked && idea.locked[gateId]);
  const t = timeboxStatus(idea, gateId);
  const rules = (RULE_META[gateId] || []).map((r) => `
    <label class="field compact">${esc(r.label)}
      <input type="number" step="any" data-rule="${r.key}" value="${esc(idea.rules[r.key])}" ${locked ? 'disabled' : ''}>
    </label>`).join('');
  $(`[data-rules-for="${gateId}"]`).innerHTML = `
    <div class="rules-head">
      <h3>Stop rules, set before the work</h3>
      ${locked
        ? `<span class="lock">Started ${esc(idea.started[gateId] || '')}. Rules and time box locked.</span>`
        : `<button type="button" class="btn btn-small" data-start="${gateId}">Start gate and lock rules</button>`}
    </div>
    <ul class="stop-rules">${g.stopRules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
    <div class="rules-inputs">
      ${rules}
      <label class="field compact">Time box (days)
        <input type="number" min="0" data-timebox="${gateId}" value="${esc(t.box)}" ${locked ? 'disabled' : ''}>
      </label>
      <label class="field compact">Days spent so far
        <input type="number" min="0" step="0.5" data-spent="${gateId}" value="${esc((idea.spent || {})[gateId] ?? '')}">
      </label>
    </div>
    <p class="overrun" data-overrun="${gateId}" ${t.overrun ? '' : 'hidden'}>Over the time box. Decide with the evidence you have, or record why the box grew.</p>`;
}

function renderUserTypes() {
  const types = idea.data.userTypes || [];
  const opt = (v, cur, label) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${label}</option>`;
  const yn = (cur) => opt('', cur, 'Not checked') + opt('yes', cur, 'Yes') + opt('no', cur, 'No') + opt('unknown', cur, 'Unknown');
  $('#user-types').innerHTML = types.length ? types.map((t, i) => `
    <div class="ut-row">
      <label class="field">User type<input type="text" data-ut="${i}" data-ut-field="name" value="${esc(t.name)}"></label>
      <label class="field">Source
        <select data-ut="${i}" data-ut-field="source">${opt('first-party', t.source, 'First-party')}${opt('supplier', t.source, 'Supplier')}</select>
      </label>
      <label class="field">Rights to the data?<select data-ut="${i}" data-ut-field="rights">${yn(t.rights)}</select></label>
      <label class="field">Isolated from other clients?<select data-ut="${i}" data-ut-field="isolation">${yn(t.isolation)}</select></label>
      <button type="button" class="link-btn danger" data-ut-remove="${i}" aria-label="Remove ${esc(t.name || 'user type')}">Remove</button>
    </div>`).join('') : '<p class="hint">No user types yet. Add each kind of user and the data they would see.</p>';
}

function fillInputs() {
  for (const el of $$('[data-path]')) {
    const v = getPath(idea, el.dataset.path);
    el.value = v === null || v === undefined ? '' : v;
  }
  for (const el of $$('[data-domain]')) el.checked = (idea.screen.domains || []).includes(el.dataset.domain);
  $('#cost-of-wrong').value = idea.costOfWrong;
  GATES.forEach((g) => renderRules(g.id));
  renderUserTypes();
}

// ---------- computed rendering ----------
function renderComputed() {
  const ev = evaluate(idea);
  const s = summarise(idea.economics || {});

  for (const g of ev.gates) {
    const btn = $(`[data-step="${g.id}"]`);
    btn.dataset.status = g.status;
    $('.step-status', btn).textContent = STATUS_LABEL[g.status];
    const box = $(`[data-status-for="${g.id}"]`);
    const reasons = g.reasons.map((r) => `<li>${esc(r.text)} <span class="next">Next step: ${esc(r.test)}</span></li>`).join('');
    box.dataset.status = g.status;
    box.innerHTML = `<p class="chip chip-${g.status}">${STATUS_LABEL[g.status]}</p>`
      + (g.status === 'not-reached' ? '<p class="hint">An earlier gate stopped this idea, so this gate isn’t needed.</p>' : '')
      + (g.status === 'pass' ? '<p class="hint">Passes on the evidence entered.</p>' : '')
      + (reasons ? `<ul class="reasons">${reasons}</ul>` : '');
    const t = timeboxStatus(idea, g.id);
    const over = $(`[data-overrun="${g.id}"]`);
    if (over) over.hidden = !t.overrun;
  }
  const dec = $('[data-step="decision"]');
  dec.dataset.status = ev.recommendation;
  $('.step-status', dec).textContent = RECOMMENDATION_LABEL[ev.recommendation];
  for (const b of $$('.step')) b.setAttribute('aria-current', b.dataset.step === current ? 'step' : 'false');

  renderDerived(s);
  const md = generatePack(idea, ev, s, { today: today() });
  $('#pack').innerHTML = markdownToHtml(md)
    .replace('<p><strong>Recommendation:</strong>', `<p class="rec rec-${ev.recommendation}"><strong>Recommendation:</strong>`);
}

function renderDerived(s) {
  const r = idea.rules;
  const ratio = s.clvCacRatio;
  const scale = 4;
  const ratioClass = ratio === null ? 'unknown' : ratio < r.clvCacMin ? 'stop' : ratio <= r.clvCacTarget ? 'weak' : 'pass';
  const tile = (label, value, note = '') => `<div class="tile"><p class="tile-label">${esc(label)}</p><p class="tile-value">${value}</p>${note ? `<p class="tile-note">${note}</p>` : ''}</div>`;
  const vw = s.vw;
  const be = s.businessCase && s.businessCase.breakEvenMonth;
  $('#derived').innerHTML = `
    <h3>Calculated</h3>
    <div class="tiles">
      ${tile('SAM / SOM', `${aud(s.sam)} / ${aud(s.som)}`, s.clientCapacity !== null ? `SOM holds about ${fixed(s.clientCapacity, 0)} clients` : '')}
      ${tile('Acceptable price range', vw ? `${aud(vw.pmc)} to ${aud(vw.pme)}` : 'n/a', vw ? `Optimal ${aud(vw.opp)} from ${vw.respondents} respondents` : 'Add survey responses')}
      ${tile('Cost per use', audSmall(s.costPerUse), `Margin per use ${audSmall(s.marginPerUse)}`)}
      ${tile('Gross margin', s.grossMarginPct === null ? 'n/a' : `${fixed(s.grossMarginPct)}%`, `Revenue: ${esc(s.revenueSource || 'not set')}`)}
      ${tile('Product vs bespoke, per client', `${aud(s.productCostPerClient)} vs ${aud(s.bespokeCostPerClient)}`, s.cheaperThanBespoke === null ? '' : s.cheaperThanBespoke ? 'Product is cheaper' : 'Bespoke is cheaper')}
      ${tile('CLV / CAC', `${aud(s.clv)} / ${aud(s.cac)}`, `Payback ${s.paybackMonths === null ? 'n/a' : `${fixed(s.paybackMonths)} months`}`)}
    </div>
    <div class="ratio ratio-${ratioClass}">
      <p class="ratio-head"><strong>CLV:CAC ${fixed(ratio)}</strong> <span>Stop below ${esc(r.clvCacMin)}, target above ${esc(r.clvCacTarget)}</span></p>
      <div class="meter" role="img" aria-label="CLV to CAC ratio ${fixed(ratio)} against a target above ${esc(r.clvCacTarget)}">
        <span class="meter-fill" style="width:${ratio === null ? 0 : Math.min(ratio / scale, 1) * 100}%"></span>
        <span class="meter-mark" style="left:${(r.clvCacMin / scale) * 100}%"></span>
        <span class="meter-mark target" style="left:${(r.clvCacTarget / scale) * 100}%"></span>
      </div>
    </div>
    ${s.businessCase ? `
    <div class="table-wrap"><table class="case">
      <caption>Three-year view. Break-even: ${be ? `month ${be}` : 'not within 3 years'}.</caption>
      <thead><tr><th>Year</th><th>New clients</th><th>Active</th><th>Gross profit</th><th>Acquisition</th><th>Cumulative cash</th></tr></thead>
      <tbody>${s.businessCase.years.map((y) => `<tr><td>${y.year}</td><td>${fixed(y.newClients, 0)}</td><td>${fixed(y.activeClients)}</td><td>${aud(y.grossProfit)}</td><td>${aud(y.acquisition)}</td><td class="${y.cumulative < 0 ? 'neg' : ''}">${aud(y.cumulative)}</td></tr>`).join('')}</tbody>
    </table></div>` : ''}`;
}

// ---------- portfolio ----------
function renderPortfolio() {
  const m = portfolioMetrics(log, { baselineHitRatePct: settings.baselineHitRatePct ?? null });
  $('#baseline-hit-rate').value = settings.baselineHitRatePct ?? '';
  const tile = (label, value, note = '') => `<div class="tile"><p class="tile-label">${esc(label)}</p><p class="tile-value">${value}</p>${note ? `<p class="tile-note">${note}</p>` : ''}</div>`;
  $('#tiles').innerHTML = [
    tile('Decisions logged', m.total, `${m.stops} stop, ${m.tests} test first, ${m.builds} build`),
    tile('Stopped at Gates 0 to 2', m.earlyStopSharePct === null ? 'n/a' : `${fixed(m.earlyStopSharePct, 0)}%`, 'Early, cheap stops are the goal'),
    tile('Time per decision', m.avgDays === null ? 'n/a' : `${fixed(m.avgDays)} days`),
    tile('Cost per decision', aud(m.avgCost), `Early stop ${aud(m.avgCostEarlyStop)} vs late stop ${aud(m.avgCostLateStop)}`),
    tile('Hit rate of yeses', m.hitRatePct === null ? 'n/a' : `${fixed(m.hitRatePct, 0)}%`,
      m.hitRateDeltaPts === null ? `${m.buildsWithOutcome} build(s) with a known outcome` : `${m.hitRateDeltaPts >= 0 ? '+' : ''}${fixed(m.hitRateDeltaPts, 0)} pts vs past productisations`),
  ].join('');

  const maxStops = Math.max(1, ...Object.values(m.stopsByGate));
  $('#stop-bars').innerHTML = GATES.map((g) => `
    <div class="bar-row"><span class="bar-label">${esc(g.name)}</span>
      <span class="bar"><span class="bar-fill ${['g0', 'g1', 'g2'].includes(g.id) ? 'early' : 'late'}" style="width:${(m.stopsByGate[g.id] / maxStops) * 100}%"></span></span>
      <span class="bar-value">${m.stopsByGate[g.id]}</span></div>`).join('');

  const quarters = [...new Set([quarterOf(today()), ...log.map((e) => quarterOf(e.decidedAt))])].sort().reverse();
  const sel = $('#audit-quarter');
  const prev = sel.value;
  sel.innerHTML = quarters.map((q) => `<option value="${q}">${q}</option>`).join('');
  if (quarters.includes(prev)) sel.value = prev;

  const gateName = (id) => (GATES.find((g) => g.id === id) || {}).name || '-';
  $('#log-table').innerHTML = log.length ? `
    <thead><tr><th>Date</th><th>Idea</th><th>Decision</th><th>Deciding gate</th><th>Days</th><th>Cost</th><th>Outcome</th><th></th></tr></thead>
    <tbody>${[...log].sort((a, b) => (a.decidedAt < b.decidedAt ? 1 : -1)).map((e) => `
      <tr>
        <td>${esc(e.decidedAt)}</td><td>${esc(e.title)}</td>
        <td><span class="chip chip-${e.recommendation === 'test' ? 'weak' : e.recommendation === 'build' ? 'pass' : 'stop'}">${RECOMMENDATION_LABEL[e.recommendation]}</span></td>
        <td>${esc(gateName(e.decidingGate))}</td><td>${fixed(e.days, 0)}</td><td>${aud(e.cost)}</td>
        <td>${e.recommendation === 'build' ? `<select data-outcome="${esc(e.id)}" aria-label="Outcome for ${esc(e.title)}">
          <option value="" ${!e.outcome ? 'selected' : ''}>Pending</option>
          <option value="success" ${e.outcome === 'success' ? 'selected' : ''}>Hit</option>
          <option value="fail" ${e.outcome === 'fail' ? 'selected' : ''}>Miss</option></select>` : '-'}</td>
        <td><button type="button" class="link-btn danger" data-log-remove="${esc(e.id)}">Remove</button></td>
      </tr>`).join('')}</tbody>` : '<tbody><tr><td>No decisions logged yet. Add one from the Decision screen, or load the sample portfolio.</td></tr></tbody>';
}

// ---------- navigation ----------
function show(step) {
  current = step;
  for (const sec of $$('#view-gates .gate')) sec.hidden = sec.dataset.gate !== step;
  for (const b of $$('.step')) b.setAttribute('aria-current', b.dataset.step === step ? 'step' : 'false');
  // Keep the active step visible in the horizontally scrolling stepper on phones.
  const active = $(`[data-step="${step}"]`);
  const strip = $('#stepper');
  if (active) strip.scrollLeft = active.parentElement.offsetLeft - strip.offsetLeft - 8;
  window.scrollTo({ top: strip.offsetTop - 8 });
}

function setView(portfolio) {
  $('#view-gates').hidden = portfolio;
  $('#view-portfolio').hidden = !portfolio;
  const btn = $('#btn-view');
  btn.setAttribute('aria-pressed', String(portfolio));
  btn.textContent = portfolio ? 'Back to the gates' : 'Portfolio metrics';
  if (portfolio) renderPortfolio();
}

function loadIdea(next) {
  idea = next;
  fillInputs();
  renderComputed();
  saveSoon();
  show('g0');
}

function changed() {
  renderComputed();
  saveSoon();
}

// ---------- events ----------
function onInput(e) {
  const el = e.target;
  if (el.dataset.path) {
    const isNum = el.dataset.type === 'number';
    setPath(idea, el.dataset.path, isNum ? toNum(el.value) : el.value);
    return changed();
  }
  if (el.dataset.rule) { idea = setRule(idea, el.dataset.rule, el.value); return changed(); }
  if (el.dataset.timebox) { idea = setTimebox(idea, el.dataset.timebox, el.value); return changed(); }
  if (el.dataset.spent) { idea.spent = { ...idea.spent, [el.dataset.spent]: toNum(el.value) }; return changed(); }
  if (el.dataset.domain) {
    const set = new Set(idea.screen.domains || []);
    if (el.checked) set.add(el.dataset.domain); else set.delete(el.dataset.domain);
    idea.screen.domains = [...set];
    return changed();
  }
  if (el.dataset.ut !== undefined) {
    idea.data.userTypes[Number(el.dataset.ut)][el.dataset.utField] = el.value;
    return changed();
  }
  if (el.id === 'cost-of-wrong') {
    idea = setCostOfWrong(idea, el.value);
    GATES.forEach((g) => renderRules(g.id));
    return changed();
  }
  if (el.id === 'baseline-hit-rate') {
    settings = { ...settings, baselineHitRatePct: toNum(el.value) };
    store.saveSettings(settings);
    return renderPortfolio();
  }
  if (el.dataset.outcome) {
    log = log.map((x) => (x.id === el.dataset.outcome ? { ...x, outcome: el.value || null } : x));
    store.saveLog(log);
    return renderPortfolio();
  }
  return undefined;
}

function download(name, text) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function onClick(e) {
  const el = e.target.closest('button');
  if (!el) return;
  if (el.dataset.step) return show(el.dataset.step);
  if (el.dataset.go) return show(el.dataset.go);
  if (el.dataset.start) {
    idea = startGate(idea, el.dataset.start, today());
    renderRules(el.dataset.start);
    return changed();
  }
  if (el.dataset.utRemove !== undefined) {
    idea.data.userTypes.splice(Number(el.dataset.utRemove), 1);
    renderUserTypes();
    return changed();
  }
  if (el.dataset.logRemove) {
    log = log.filter((x) => x.id !== el.dataset.logRemove);
    store.saveLog(log);
    return renderPortfolio();
  }
  switch (el.id) {
    case 'btn-example':
      if (window.confirm('Replace the current draft with the worked example?')) { setView(false); loadIdea(workedExample()); }
      break;
    case 'btn-new':
      if (window.confirm('Start a new idea? The current draft will be replaced.')) { setView(false); loadIdea(createIdea()); }
      break;
    case 'btn-view':
      setView($('#view-portfolio').hidden);
      break;
    case 'btn-add-user-type':
      idea.data.userTypes = [...(idea.data.userTypes || []), { name: '', source: 'first-party', rights: '', isolation: '' }];
      renderUserTypes();
      changed();
      break;
    case 'btn-use-vw': {
      const s = summarise(idea.economics);
      if (s.vw && s.vw.opp !== null) {
        idea.economics.annualRevenue = Math.round(s.vw.opp);
        $('[data-path="economics.annualRevenue"]').value = idea.economics.annualRevenue;
        changed();
      }
      break;
    }
    case 'btn-download': {
      const ev = evaluate(idea);
      download(packFileName(idea), generatePack(idea, ev, summarise(idea.economics), { today: today() }));
      break;
    }
    case 'btn-print':
      window.print();
      break;
    case 'btn-log': {
      const ev = evaluate(idea);
      const daysSpent = Object.values(idea.spent || {}).reduce((a, b) => a + (Number(b) || 0), 0);
      const entry = {
        id: idea.id,
        title: idea.title || 'Untitled idea',
        recommendation: ev.recommendation,
        decidingGate: ev.decidingGate,
        days: daysSpent,
        cost: daysSpent * (Number(idea.screen.costPerDay) || 0),
        decidedAt: idea.decision.date || today(),
        outcome: null,
      };
      const existing = log.find((x) => x.id === entry.id);
      log = existing ? log.map((x) => (x.id === entry.id ? { ...entry, outcome: x.outcome } : x)) : [...log, entry];
      const ok = store.saveLog(log);
      el.textContent = ok ? (existing ? 'Decision log updated' : 'Added to decision log') : 'Couldn’t save the log';
      setTimeout(() => { el.textContent = 'Add to decision log'; }, 2500);
      break;
    }
    case 'btn-sample-log': {
      const ids = new Set(log.map((x) => x.id));
      log = [...log, ...samplePortfolio().filter((x) => !ids.has(x.id))];
      if (settings.baselineHitRatePct == null) settings = { ...settings, baselineHitRatePct: 35 };
      store.saveLog(log);
      store.saveSettings(settings);
      renderPortfolio();
      break;
    }
    case 'btn-audit': {
      const sample = auditSample(log, $('#audit-quarter').value, 3, Math.floor(Math.random() * 1e9));
      $('#audit-list').innerHTML = sample.length
        ? sample.map((x) => `<li><strong>${esc(x.title)}</strong>, stopped at ${esc((GATES.find((g) => g.id === x.decidingGate) || {}).name || '-')} on ${esc(x.decidedAt)}. Would today's evidence still say no?</li>`).join('')
        : '<li>No stopped ideas in this quarter.</li>';
      break;
    }
    case 'btn-clear':
      if (window.confirm('Clear every draft, setting, and log entry saved in this browser? This cannot be undone.')) {
        store.clearAll();
        log = [];
        settings = {};
        $('#audit-list').innerHTML = '';
        renderPortfolio();
        idea = workedExample();
        fillInputs();
        renderComputed();
      }
      break;
    default:
  }
  return undefined;
}

// ---------- start ----------
function init() {
  const draft = store.loadDraft();
  idea = draft && draft.screen ? { ...createIdea(), ...draft } : workedExample();
  log = store.loadLog();
  settings = store.loadSettings();
  renderStatic();
  fillInputs();
  renderComputed();
  show('g0');
  window.scrollTo({ top: 0 });
  document.addEventListener('input', onInput);
  document.addEventListener('change', (e) => { if (e.target.matches('select, input[type="checkbox"], input[type="date"]')) onInput(e); });
  document.addEventListener('click', onClick);
}

init();
