// Evidence pack: a one-page Markdown summary of the decision, plus a small
// Markdown-to-HTML renderer for the formats this pack uses.
import { GATES } from './gates.js';
import { RECOMMENDATION_LABEL, STATUS_LABEL } from './decision.js';

export const aud = (n) => (n === null || n === undefined || Number.isNaN(n) ? 'n/a'
  : `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-AU')}`);
const audCents = (n) => (n === null || n === undefined ? 'n/a' : `$${Number(n).toFixed(n < 1 ? 3 : 2)}`);
const pct = (n) => (n === null || n === undefined ? 'n/a' : `${Number(n).toFixed(1)}%`);
const dec = (n, d = 1) => (n === null || n === undefined ? 'n/a' : Number(n).toFixed(d));
const days = (n) => (n === null || n === undefined || n === '' ? '-' : `${n} ${Number(n) === 1 ? 'day' : 'days'}`);
const cell = (s) => String(s ?? '').replace(/\|/g, '/').replace(/\n+/g, ' ').trim();

export function generatePack(idea, evaluation, s, { today } = {}) {
  const gateName = (id) => (GATES.find((g) => g.id === id) || {}).name || 'n/a';
  const rec = RECOMMENDATION_LABEL[evaluation.recommendation];
  const d = idea.decision || {};
  const lines = [];

  lines.push(`# Evidence pack: ${idea.title || 'Untitled idea'}`, '');
  if (idea.summary) lines.push(idea.summary, '');
  lines.push(`**Recommendation:** ${rec}`, '');
  if (evaluation.decidingGate) lines.push(`**Deciding gate:** ${gateName(evaluation.decidingGate)}`, '');
  lines.push(`**Why:** ${evaluation.reason}`, '');
  if (evaluation.nextTest) lines.push(`**Next test:** ${evaluation.nextTest}`, '');
  lines.push(`**Cost of being wrong:** ${idea.costOfWrong}`, '');

  lines.push('## Gates', '');
  lines.push('| Gate | Result | Time box | Spent |', '|---|---|---|---|');
  for (const g of evaluation.gates) {
    lines.push(`| ${g.name} | ${STATUS_LABEL[g.status]} | ${days(idea.timeboxes[g.id])} | ${days((idea.spent || {})[g.id])} |`);
  }
  lines.push('');

  const open = evaluation.gates.filter((g) => g.reasons.length);
  if (open.length) {
    lines.push('## Findings and open risks', '');
    for (const g of open) for (const r of g.reasons) lines.push(`- **${g.name}:** ${r.text} Next: ${r.test}`);
    lines.push('');
  }

  lines.push('## Key numbers', '');
  lines.push('| Measure | Value |', '|---|---|');
  lines.push(`| TAM / SAM / SOM | ${aud(s.tam)} / ${aud(s.sam)} / ${aud(s.som)} |`);
  if (s.vw) lines.push(`| Van Westendorp acceptable range (${s.vw.respondents} respondents) | ${aud(s.vw.pmc)} to ${aud(s.vw.pme)}, optimal ${aud(s.vw.opp)} |`);
  lines.push(`| Cost per use (inference and run) | ${audCents(s.costPerUse)} |`);
  lines.push(`| Margin per use | ${audCents(s.marginPerUse)} |`);
  lines.push(`| Product cost per client vs bespoke | ${aud(s.productCostPerClient)} vs ${aud(s.bespokeCostPerClient)} |`);
  if (idea.value && idea.value.evalScore !== null && idea.value.evalScore !== undefined) {
    lines.push(`| Evals vs baseline | ${idea.value.evalScore} vs ${idea.value.baselineScore} |`);
  }
  lines.push('');

  lines.push('## Mini business case', '');
  lines.push('| Measure | Value |', '|---|---|');
  lines.push(`| Annual revenue per client | ${aud(s.annualRevenue)} |`);
  lines.push(`| Gross margin | ${pct(s.grossMarginPct)} |`);
  lines.push(`| CLV | ${aud(s.clv)} |`);
  lines.push(`| CAC | ${aud(s.cac)} |`);
  lines.push(`| CLV:CAC | ${dec(s.clvCacRatio)} (target above ${idea.rules.clvCacTarget}, stop below ${idea.rules.clvCacMin}) |`);
  lines.push(`| CAC payback | ${s.paybackMonths === null ? 'n/a' : `${dec(s.paybackMonths)} months`} (limit ${idea.rules.paybackMaxMonths}) |`);
  const be = s.businessCase && s.businessCase.breakEvenMonth;
  lines.push(`| Break-even | ${be ? `month ${be}` : 'not within 3 years'} |`);
  lines.push('');
  if (s.businessCase) {
    lines.push('| Year | New clients | Active clients | Gross profit | Acquisition | Cumulative cash |', '|---|---|---|---|---|---|');
    for (const y of s.businessCase.years) {
      lines.push(`| ${y.year} | ${dec(y.newClients, 0)} | ${dec(y.activeClients, 1)} | ${aud(y.grossProfit)} | ${aud(y.acquisition)} | ${aud(y.cumulative)} |`);
    }
    lines.push('');
  }

  const e = idea.economics || {};
  lines.push('## Assumptions', '');
  lines.push(`- Revenue per client: ${s.revenueSource === 'entered' ? 'entered directly' : s.revenueSource || 'not set'}.`);
  lines.push(`- Lifetime: ${e.lifetimeYears ? `${e.lifetimeYears} years` : e.churnPct ? `1 / ${e.churnPct}% annual churn` : 'not set'}.`);
  lines.push(`- CAC: ${aud(e.acquisitionSpend)} acquisition spend across ${e.newClientsWon || 'n/a'} clients won.`);
  lines.push(`- Build cost of ${aud(e.buildCost)} lands up front and is spread across the three-year client plan.`);
  lines.push('- Stop rules and time boxes were set before each gate started.');
  lines.push('');

  lines.push('## Decision log', '');
  lines.push('| Date | Decider | Decision | Revisit when |', '|---|---|---|---|');
  lines.push(`| ${cell(d.date || today || '')} | ${cell(d.decider)} | ${rec} | ${cell(d.revisitTrigger)} |`);
  if (d.notes) lines.push('', d.notes);
  lines.push('');
  return lines.join('\n');
}

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = (s) => escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

export function markdownToHtml(md) {
  const out = [];
  const lines = String(md).split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^#{1,3} /.test(line)) {
      const level = line.match(/^#+/)[0].length;
      out.push(`<h${level}>${inline(line.slice(level + 1))}</h${level}>`);
      i += 1;
    } else if (line.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
      const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const body = rows.filter((r, idx) => !(idx === 1 && /^\|[\s|:-]+\|$/.test(r)));
      const [head, ...rest] = body;
      out.push('<table><thead><tr>' + cells(head).map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>'
        + rest.map((r) => '<tr>' + cells(r).map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('')
        + '</tbody></table>');
    } else if (line.startsWith('- ')) {
      const items = [];
      while (i < lines.length && lines[i].startsWith('- ')) items.push(lines[i++].slice(2));
      out.push('<ul>' + items.map((it) => `<li>${inline(it)}</li>`).join('') + '</ul>');
    } else if (line.trim() === '') {
      i += 1;
    } else {
      out.push(`<p>${inline(line)}</p>`);
      i += 1;
    }
  }
  return out.join('\n');
}

export function packFileName(idea) {
  const slug = String(idea.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled-idea';
  return `evidence-pack-${slug}.md`;
}
