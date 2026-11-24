import { test, assert } from './runner.js';
import { passingIdea } from './fixtures.js';
import { evaluate } from '../js/decision.js';
import { summarise } from '../js/economics.js';
import { generatePack, markdownToHtml, packFileName, aud } from '../js/pack.js';

function packFor(idea) {
  idea.decision = { decider: 'Product lead', date: '2026-11-24', revisitTrigger: 'Two more clients ask for it', notes: '' };
  return generatePack(idea, evaluate(idea), summarise(idea.economics));
}

test('the pack opens with the idea title and recommendation', () => {
  const md = packFor(passingIdea());
  assert.includes(md, '# Evidence pack: Passing idea');
  assert.includes(md, '**Recommendation:** Build');
});

test('a stopped idea names the deciding gate and marks later gates as not reached', () => {
  const idea = passingIdea();
  idea.screen.payer = '';
  const md = packFor(idea);
  assert.includes(md, '**Recommendation:** Stop');
  assert.includes(md, '**Deciding gate:** Screen');
  assert.includes(md, 'Not reached');
});

test('a Test first pack names the next test', () => {
  const idea = passingIdea();
  idea.value.scaleOk = 'unknown';
  const md = packFor(idea);
  assert.includes(md, '**Recommendation:** Test first');
  assert.includes(md, '**Next test:**');
});

test('the pack lists every gate with its time box and time spent', () => {
  const idea = passingIdea();
  idea.spent = { g0: 1, g1: 4 };
  const md = packFor(idea);
  for (const name of ['Screen', 'Problem', 'Data and legal', 'Value and AI quality', 'Economics']) assert.includes(md, `| ${name} |`);
  assert.includes(md, '| Gate | Result | Time box | Spent |');
  assert.includes(md, '| Problem | Pass | 5 days | 4 days |');
});

test('the pack shows the mini business case against the CLV:CAC target', () => {
  const md = packFor(passingIdea());
  assert.includes(md, '## Mini business case');
  assert.includes(md, 'CLV');
  assert.includes(md, 'CAC');
  assert.includes(md, 'CLV:CAC');
  assert.includes(md, '5.6');
  assert.includes(md, 'target above 2');
  assert.includes(md, 'Break-even');
});

test('the pack lists its assumptions', () => {
  const md = packFor(passingIdea());
  assert.includes(md, '## Assumptions');
});

test('the pack ends with a decision log entry', () => {
  const md = packFor(passingIdea());
  assert.includes(md, '## Decision log');
  assert.includes(md, 'Product lead');
  assert.includes(md, 'Two more clients ask for it');
});

test('Markdown renders headings, bold text, lists, and tables to HTML', () => {
  const html = markdownToHtml('# Title\n\n**Bold** text\n\n- one\n- two\n\n| A | B |\n|---|---|\n| 1 | 2 |');
  assert.includes(html, '<h1>Title</h1>');
  assert.includes(html, '<strong>Bold</strong>');
  assert.includes(html, '<li>one</li>');
  assert.includes(html, '<table>');
  assert.includes(html, '<td>2</td>');
  assert.includes(html, '<th>A</th>');
});

test('Markdown rendering escapes HTML', () => {
  const html = markdownToHtml('Hello <script>alert(1)</script>');
  assert.notIncludes(html, '<script>');
  assert.includes(html, '&lt;script&gt;');
});

test('currency puts the minus sign before the dollar sign', () => {
  assert.equal(aud(-319386), '-$319,386');
  assert.equal(aud(1500000), '$1,500,000');
  assert.equal(aud(null), 'n/a');
});

test('the pack file name is a slug of the title', () => {
  assert.equal(packFileName({ title: 'Category Trend Explainer!' }), 'evidence-pack-category-trend-explainer.md');
  assert.equal(packFileName({ title: '' }), 'evidence-pack-untitled-idea.md');
});
