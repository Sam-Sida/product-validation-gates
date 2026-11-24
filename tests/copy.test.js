import { test, assert } from './runner.js';

// Every file that holds user-facing copy.
const COPY_FILES = [
  '../index.html', '../README.md',
  '../js/gates.js', '../js/decision.js', '../js/economics.js', '../js/pack.js',
  '../js/portfolio.js', '../js/storage.js', '../js/example.js', '../js/app.js',
];

// Words kept out of the copy, built from parts so this file doesn't trip its own scan.
const BANNED = ['del' + 've', 'land' + 'scape', 'syn' + 'ergy', 'lever' + 'age', 'rob' + 'ust',
  'stream' + 'line', 'cutting' + '-edge', 'quan' + 'tium', 'job-search' + '-os'];

// US spellings to avoid in favour of Australian spelling.
const US_SPELLING = /\b(analyz|prioritiz|organiz|optimiz|productiz|recogniz|summariz|behavior|favor|center\b|catalog\b)/i;

async function load(path) {
  const res = await fetch(new URL(path, import.meta.url));
  if (!res.ok) throw new Error(`${path} not found`);
  return res.text();
}

test('copy avoids banned words and private references', async () => {
  for (const f of COPY_FILES) {
    const text = (await load(f)).toLowerCase();
    for (const w of BANNED) assert.ok(!text.includes(w), `${f} contains "${w}"`);
  }
});

test('copy uses Australian spelling', async () => {
  for (const f of COPY_FILES) {
    // Ignore CSS-in-JS and code identifiers by scanning only string and text content loosely.
    const m = (await load(f)).match(US_SPELLING);
    assert.ok(!m, `${f} uses US spelling "${m && m[0]}"`);
  }
});
