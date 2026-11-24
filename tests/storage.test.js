import { test, assert } from './runner.js';
import { createStore } from '../js/storage.js';

function memoryBackend() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    raw: m,
  };
}

const throwing = {
  getItem() { throw new Error('blocked'); },
  setItem() { throw new Error('quota'); },
  removeItem() { throw new Error('blocked'); },
};

test('a draft round-trips through storage', () => {
  const store = createStore(memoryBackend());
  assert.equal(store.saveDraft({ title: 'X' }), true);
  assert.deepEqual(store.loadDraft(), { title: 'X' });
});

test('the decision log round-trips and defaults to an empty list', () => {
  const store = createStore(memoryBackend());
  assert.deepEqual(store.loadLog(), []);
  store.saveLog([{ id: 'a' }]);
  assert.deepEqual(store.loadLog(), [{ id: 'a' }]);
});

test('a storage error never throws', () => {
  const store = createStore(throwing);
  assert.equal(store.saveDraft({ title: 'X' }), false);
  assert.equal(store.loadDraft(), null);
  assert.deepEqual(store.loadLog(), []);
  assert.equal(store.clearAll(), false);
});

test('corrupt JSON loads as nothing', () => {
  const backend = memoryBackend();
  backend.setItem('pvg:draft', '{not json');
  assert.equal(createStore(backend).loadDraft(), null);
});

test('missing storage is handled', () => {
  const store = createStore(null);
  assert.equal(store.saveDraft({}), false);
  assert.equal(store.loadDraft(), null);
});

test('clearing removes drafts, the log, and settings', () => {
  const backend = memoryBackend();
  const store = createStore(backend);
  store.saveDraft({ a: 1 });
  store.saveLog([{ id: 'a' }]);
  store.saveSettings({ baselineHitRatePct: 30 });
  assert.equal(store.clearAll(), true);
  assert.equal(backend.raw.size, 0);
});
