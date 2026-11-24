// Minimal zero-dependency test runner for the browser.
// Each test file registers tests with test(); run() imports each file and runs its tests.

const registry = [];
let currentFile = '';

export function test(name, fn) {
  registry.push({ file: currentFile, name, fn });
}

function fmt(v) {
  try { return JSON.stringify(v); } catch { return String(v); }
}

export const assert = {
  ok(value, msg = 'expected a truthy value') {
    if (!value) throw new Error(msg);
  },
  equal(actual, expected, msg = '') {
    if (actual !== expected) throw new Error(`${msg} expected ${fmt(expected)}, got ${fmt(actual)}`.trim());
  },
  close(actual, expected, tolerance = 1e-6, msg = '') {
    if (typeof actual !== 'number' || Number.isNaN(actual) || Math.abs(actual - expected) > tolerance) {
      throw new Error(`${msg} expected ~${expected} (±${tolerance}), got ${fmt(actual)}`.trim());
    }
  },
  deepEqual(actual, expected, msg = '') {
    if (fmt(actual) !== fmt(expected)) throw new Error(`${msg} expected ${fmt(expected)}, got ${fmt(actual)}`.trim());
  },
  includes(haystack, needle, msg = '') {
    if (typeof haystack !== 'string' || !haystack.includes(needle)) {
      throw new Error(`${msg} expected text to include ${fmt(needle)}`.trim());
    }
  },
  notIncludes(haystack, needle, msg = '') {
    if (typeof haystack === 'string' && haystack.includes(needle)) {
      throw new Error(`${msg} expected text not to include ${fmt(needle)}`.trim());
    }
  },
};

export async function run(files) {
  const results = [];
  for (const file of files) {
    currentFile = file;
    try {
      await import(file);
    } catch (err) {
      results.push({ file, name: '(module load)', ok: false, error: err.message });
      continue;
    }
    for (const t of registry.filter((r) => r.file === file)) {
      try {
        await t.fn();
        results.push({ file, name: t.name, ok: true });
      } catch (err) {
        results.push({ file, name: t.name, ok: false, error: err.message });
      }
    }
  }
  return results;
}
