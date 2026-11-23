// Fotos 3D da fase seguinte tiradas antes de ela começar (pedido do usuário: no
// começo de algumas fases o desenho 2D aparecia por um instante antes do 3D, porque
// cada foto só era pedida quando o modelo aparecia na tela).
import { suite, test, expect } from '../harness.js';
import { makeGame, stepUntil, step, press, enterIgloo } from '../helpers.js';
import { levelModels, levelReady, SUBJECTS } from '../../src/model3d.js';
import { PRELOAD_MAX } from '../../src/game.js';
import { removeItem } from '../../src/storage.js';

// Fase com o jogo "tirando fotos": `ready` responde o que o teste mandar
function preloadGame(level) {
  const g = makeGame({ level });
  const calls = [];
  const state = { ready: false };
  g.preload = { request: (lv) => calls.push(lv), ready: () => state.ready };
  return { g, calls, state };
}

function finishLevel(g) {
  while (!g.igloo.complete) g.igloo.add();
  g.player.x = g.igloo.doorX;
  enterIgloo(g);
  stepUntil(g, () => g.state === 'levelEnd', 5);
}

suite('Fotos 3D da fase seguinte prontas antes de ela começar', () => {
  test('cada fase lista os modelos 3D que usa (fundo, placas, casa, personagem, enfeites, urso, bichos, itens)', () => {
    const has = (lv, names) => {
      const list = levelModels(lv);
      for (const n of names) expect(list, `fase ${lv}: ${n}`).toContain(n);
      for (const n of list) expect(n.startsWith('floe') || SUBJECTS[n] || /^(log|rock|board|pumpkin|basalt)\d+$/.test(n), `fase ${lv}: ${n}`).toBeTruthy();
    };
    has(1, ['bg-ice', 'floe82', 'igloo', 'porch', 'player', 'goose', 'fish']);
    expect(levelModels(1).includes('bear')).toBe(false);
    has(2, ['floe36', 'crab']);
    has(4, ['bear']);
    has(5, ['bg-ice', 'player-sweater', 'bear-santa', 'xtree', 'sleigh', 'bag', 'heart']);
    has(10, ['bg-forest', 'log36', 'cabin', 'player-lumberjack', 'bear-brown', 'snake', 'bat', 'piranha', 'pine']);
    has(12, ['duck', 'boot', 'cocoa']);
    has(15, ['bg-space', 'base', 'player-astronaut', 'alien', 'star', 'lander', 'flag']);
    has(20, ['bg-beach', 'hut', 'player-surfer', 'giantCrab', 'tfish', 'parasol', 'jetski', 'palm0']);
    has(25, ['bg-halloween', 'haunted', 'player-wizard', 'werewolf', 'candy', 'jack']);
    has(30, ['bg-dino', 'cave', 'caveTusks', 'player-caveman', 'trex', 'egg', 'fern', 'nest']);
    // O fundo vem primeiro (é o que mais aparece)
    expect(levelModels(20)[0]).toBe('bg-beach');
  });

  test('o jogo de verdade (src/main.js) importa e liga o gancho das fotos', async () => {
    if (typeof process === 'undefined' || !process.versions?.node) return; // leitura de arquivo só no Node
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
    expect(/import\s*\{[^}]*\bprefetchLevel\b[^}]*\blevelReady\b[^}]*\}\s*from\s*'\.\/model3d\.js'/.test(src)).toBe(true);
    expect(src).toContain('game.preload = { request: prefetchLevel, ready: levelReady }');
  });

  test('sem 3D (Node) não há o que esperar', () => {
    expect(levelReady(1)).toBe(true);
    expect(levelReady(30)).toBe(true);
  });

  test('ao entrar no iglu, o jogo pede as fotos da fase seguinte', () => {
    const { g, calls } = preloadGame(3);
    finishLevel(g);
    expect(calls).toEqual([4]);
  });

  test('com as fotos ainda sendo tiradas, a fase seguinte espera (com o aviso "Preparando a próxima fase…")', () => {
    const { g, state } = preloadGame(3);
    finishLevel(g);
    stepUntil(g, () => g.bonusDone, 60);
    step(g, 5);
    expect(g.level, 'esperando as fotos').toBe(3);
    expect(g.state).toBe('levelEnd');
    expect(g.loadingNext).toBe(true);
    state.ready = true;
    stepUntil(g, () => g.level === 4, 1);
    expect(g.level).toBe(4);
    expect(g.state).toBe('play');
  });

  test(`se as fotos demorarem demais (${PRELOAD_MAX} s), a fase começa assim mesmo`, () => {
    const { g } = preloadGame(3);
    finishLevel(g);
    stepUntil(g, () => g.bonusDone, 60);
    const waited = stepUntil(g, () => g.level === 4, PRELOAD_MAX + 5);
    expect(g.level).toBe(4);
    expect(waited).toBeGreaterThan(PRELOAD_MAX - 2);
  });

  test('na comemoração do troféu, a tecla espera as fotos e a fase segue sozinha quando ficam prontas', () => {
    removeItem('trophies');
    const { g, state } = preloadGame(5);
    finishLevel(g);
    stepUntil(g, () => g.state === 'trophy', 10);
    step(g, 3);
    press(g, 'start');
    expect(g.state, 'esperando as fotos').toBe('trophy');
    expect(g.advancePending).toBe(true);
    step(g, 1);
    expect(g.state).toBe('trophy');
    state.ready = true;
    step(g, 0.1);
    expect(g.state).toBe('play');
    expect(g.level).toBe(6);
    removeItem('trophies');
  });
});
