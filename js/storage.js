// Browser-only storage. Every call is wrapped in try/catch so private mode,
// blocked storage, or a full quota never breaks the app.

const KEYS = { draft: 'pvg:draft', log: 'pvg:log', settings: 'pvg:settings' };

export function defaultBackend() {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function createStore(backend) {
  const read = (key, fallback) => {
    try {
      if (!backend) return fallback;
      const raw = backend.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  };
  const write = (key, value) => {
    try {
      if (!backend) return false;
      backend.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  };
  return {
    loadDraft: () => read(KEYS.draft, null),
    saveDraft: (idea) => write(KEYS.draft, idea),
    loadLog: () => {
      const log = read(KEYS.log, []);
      return Array.isArray(log) ? log : [];
    },
    saveLog: (log) => write(KEYS.log, log),
    loadSettings: () => read(KEYS.settings, {}) || {},
    saveSettings: (s) => write(KEYS.settings, s),
    clearAll: () => {
      try {
        if (!backend) return false;
        Object.values(KEYS).forEach((k) => backend.removeItem(k));
        return true;
      } catch {
        return false;
      }
    },
  };
}
