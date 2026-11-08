// Ambiente mínimo para rodar o jogo sem navegador (Node). No navegador, só
// fornece fakeCanvas() para os testes que não precisam desenhar de verdade.

export const isNode = typeof window === 'undefined';

// Contexto 2D falso: aceita qualquer chamada e qualquer propriedade.
function fakeContext() {
  const gradient = { addColorStop() {} };
  const noop = () => gradient;
  const store = {
    measureText: (s) => ({ width: String(s).length * 7 }),
  };
  return new Proxy(store, {
    get(t, k) {
      return k in t ? t[k] : noop;
    },
    set(t, k, v) {
      t[k] = v;
      return true;
    },
  });
}

export function fakeCanvas() {
  return { width: 1280, height: 720, style: {}, getContext: () => fakeContext() };
}

if (isNode) {
  const listeners = {};
  globalThis.window = {
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    addEventListener(type, fn) {
      (listeners[type] ||= []).push(fn);
    },
  };
  globalThis.document = {
    hidden: false,
    addEventListener() {},
    createElement: () => fakeCanvas(),
  };
  globalThis.requestAnimationFrame = () => 0;
}

// Os testes usam um prefixo próprio no localStorage: rodando no navegador, na
// mesma origem do jogo, não sobrescrevem o recorde nem o mudo do jogador.
import { STORE } from '../src/storage.js';
STORE.prefix = 'gelinho.test.';

// localStorage em memória quando não existir (Node)
if (typeof globalThis.localStorage === 'undefined') {
  const mem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  };
}
