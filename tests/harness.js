// Mini framework de testes sem dependências (roda no Node e no navegador).

export const tests = [];
let currentSuite = '';

export function suite(name, fn) {
  currentSuite = name;
  fn();
  currentSuite = '';
}

export function test(name, fn) {
  tests.push({ id: `${currentSuite} › ${name}`, suite: currentSuite, name, fn });
}

// Funcionalidade prevista na especificação, ainda não implementada.
test.todo = (name) => {
  tests.push({ id: `${currentSuite} › ${name}`, suite: currentSuite, name, todo: true });
};

class AssertionError extends Error {}

const fmt = (v) => {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

export function expect(actual, label = '') {
  const fail = (msg) => {
    throw new AssertionError(`${label ? label + ': ' : ''}${msg}`);
  };
  return {
    toBe(v) {
      if (!Object.is(actual, v)) fail(`esperado ${fmt(v)}, recebido ${fmt(actual)}`);
    },
    not: {
      toBe(v) {
        if (Object.is(actual, v)) fail(`não deveria ser ${fmt(v)}`);
      },
    },
    toEqual(v) {
      if (fmt(actual) !== fmt(v)) fail(`esperado ${fmt(v)}, recebido ${fmt(actual)}`);
    },
    toBeCloseTo(v, tol = 1e-6) {
      if (!(Math.abs(actual - v) <= tol)) fail(`esperado ${v} ± ${tol}, recebido ${actual}`);
    },
    toBeGreaterThan(v) {
      if (!(actual > v)) fail(`esperado > ${v}, recebido ${actual}`);
    },
    toBeGreaterThanOrEqual(v) {
      if (!(actual >= v)) fail(`esperado >= ${v}, recebido ${actual}`);
    },
    toBeLessThan(v) {
      if (!(actual < v)) fail(`esperado < ${v}, recebido ${actual}`);
    },
    toBeLessThanOrEqual(v) {
      if (!(actual <= v)) fail(`esperado <= ${v}, recebido ${actual}`);
    },
    toBeTruthy() {
      if (!actual) fail(`esperado verdadeiro, recebido ${fmt(actual)}`);
    },
    toBeFalsy() {
      if (actual) fail(`esperado falso, recebido ${fmt(actual)}`);
    },
    toContain(v) {
      if (!actual.includes(v)) fail(`esperado conter ${fmt(v)}, recebido ${fmt(actual)}`);
    },
    toBeOneOf(list) {
      if (!list.includes(actual)) fail(`esperado um de ${fmt(list)}, recebido ${fmt(actual)}`);
    },
  };
}

// PRNG determinístico (mulberry32) para que cada teste seja reprodutível.
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Cada teste começa com o localStorage de teste (prefixo STORE.prefix) como estava
// antes dele: um teste que ganha troféus ou salva recorde não muda os seguintes.
// Os do jogador (sem o prefixo de teste) nunca são tocados.
async function prefixed() {
  const { STORE } = await import('../src/storage.js');
  const ls = globalThis.localStorage;
  const keys = [];
  try {
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (k?.startsWith(STORE.prefix)) keys.push(k);
    }
  } catch {
    /* indisponível */
  }
  return { ls, prefix: STORE.prefix, saved: new Map(keys.map((k) => [k, ls.getItem(k)])) };
}

function restore({ ls, prefix, saved }) {
  try {
    const now = [];
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (k?.startsWith(prefix)) now.push(k);
    }
    for (const k of now) if (!saved.has(k)) ls.removeItem(k);
    for (const [k, v] of saved) ls.setItem(k, v);
  } catch {
    /* indisponível */
  }
}

// onProgress(feitos, total, teste): chamado antes de cada teste (a página mostra o andamento)
export async function runAll({ filter, onProgress } = {}) {
  const realRandom = Math.random;
  const results = [];
  const todo = tests.filter((t) => !filter || t.id.toLowerCase().includes(filter.toLowerCase()));
  for (const t of tests) {
    if (filter && !t.id.toLowerCase().includes(filter.toLowerCase())) continue;
    onProgress?.(results.length, todo.length, t);
    if (t.todo) {
      results.push({ ...t, status: 'todo' });
      continue;
    }
    Math.random = mulberry32(12345);
    const store = await prefixed();
    const start = Date.now();
    try {
      await t.fn();
      results.push({ ...t, status: 'pass', ms: Date.now() - start });
    } catch (e) {
      results.push({ ...t, status: 'fail', error: e instanceof AssertionError ? e.message : e.stack || String(e) });
    } finally {
      Math.random = realRandom;
      restore(store);
    }
  }
  return results;
}

// Compara com a baseline: testes que existiam e sumiram = regressão na suíte.
export function compareBaseline(results, baseline) {
  const ids = new Set(results.filter((r) => r.status !== 'todo').map((r) => r.id));
  const base = new Set(baseline);
  return {
    missing: baseline.filter((id) => !ids.has(id)),
    progressive: [...ids].filter((id) => !base.has(id)),
  };
}
