// Acesso ao localStorage com tratamento de erro (modo privado, armazenamento
// bloqueado etc.). Todas as chaves usam um prefixo; os testes trocam o prefixo
// para não sobrescrever o recorde e as preferências do jogador.

export const STORE = { prefix: 'gelinho.' };

export function readItem(name) {
  try {
    return globalThis.localStorage?.getItem(STORE.prefix + name) ?? null;
  } catch {
    return null;
  }
}

export function writeItem(name, value) {
  try {
    globalThis.localStorage?.setItem(STORE.prefix + name, String(value));
    return true;
  } catch {
    return false;
  }
}

export function removeItem(name) {
  try {
    globalThis.localStorage?.removeItem(STORE.prefix + name);
  } catch {
    /* indisponível */
  }
}

export function loadHighScore() {
  const v = parseInt(readItem('highscore') ?? '0', 10);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

export function saveHighScore(v) {
  return writeItem('highscore', Math.max(0, Math.floor(v)));
}

// Troféus das fases especiais (só sem conta; com conta eles ficam no servidor)
export function loadTrophies() {
  try {
    const v = JSON.parse(readItem('trophies') ?? '[]');
    return Array.isArray(v) ? v.map(Number).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
}

export function saveTrophies(list) {
  return writeItem('trophies', JSON.stringify(list));
}
