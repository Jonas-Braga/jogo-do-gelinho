// Checkpoints: cada troféu de fase especial é um checkpoint. Depois do fim de jogo,
// quem tem troféus escolhe de onde recomeçar (fase especial com 1 vida) ou
// "Começar do zero" (fase 1 com 3 vidas, os checkpoints continuam salvos).
import { suite, test, expect } from '../harness.js';
import { fakeCanvas, isNode } from '../env.js';
import { makeGame, step, stepUntil, hold, release, press } from '../helpers.js';
import { Game, PRELOAD_MAX } from '../../src/game.js';
import { RULES } from '../../src/config.js';
import { SPECIALS, TROPHY_LEVELS } from '../../src/specials.js';
import { checkpointCards, checkpointAt, drawCheckpoint } from '../../src/screens.js';
import { MemoryBackend } from '../../src/backend.js';
import { GAMEPAD } from '../../src/input.js';
import { shelfSlots, shelfAt } from '../../src/trophies.js';

const canvas = () => (isNode ? fakeCanvas() : document.createElement('canvas'));

function loseAll(g) {
  g.lives = 1;
  g.player.fall();
  stepUntil(g, () => g.state === 'gameOver', 3);
}

// Jogo sem troféus salvos (não depende do localStorage) que acabou de perder tudo
function overWith(trophies) {
  const g = makeGame();
  g.trophies = [...trophies];
  loseAll(g);
  return g;
}

function tap(g, dir) {
  hold(g, dir);
  step(g, 0.05);
  release(g, dir);
  step(g, 0.05);
}

suite('Checkpoints: recomeçar de uma fase especial', () => {
  test('sem troféus, o fim de jogo recomeça do zero como antes (fase 1, 3 vidas)', () => {
    const g = overWith([]);
    expect(g.state).toBe('gameOver');
    press(g, 'start');
    expect(g.state).toBe('play');
    expect(g.level).toBe(1);
    expect(g.lives).toBe(RULES.startLives);
  });

  test('com troféus, o fim de jogo abre a escolha do checkpoint, já no mais adiantado', () => {
    const g = overWith([5, 10]);
    press(g, 'start');
    expect(g.state).toBe('checkpoint');
    expect(g.checkpoint.options, '"do zero" + todas as fases especiais').toEqual([1, ...TROPHY_LEVELS]);
    expect(g.checkpoint.sel).toBe(10);
    expect(g.checkpoints).toEqual([5, 10]);
  });

  test('← → escolhem, pulando as fases especiais sem troféu, e param nas pontas', () => {
    const g = overWith([5, 15]);
    press(g, 'start');
    expect(g.checkpoint.sel).toBe(15);
    tap(g, 'left');
    expect(g.checkpoint.sel, 'pula a fase 10, sem troféu').toBe(5);
    tap(g, 'left');
    expect(g.checkpoint.sel).toBe(1);
    tap(g, 'left');
    expect(g.checkpoint.sel).toBe(1);
    tap(g, 'right');
    tap(g, 'right');
    tap(g, 'right');
    expect(g.checkpoint.sel).toBe(15);
  });

  test('segurar a seta anda uma opção só', () => {
    const g = overWith([5, 10, 15]);
    press(g, 'start');
    hold(g, 'left');
    step(g, 1);
    release(g, 'left');
    expect(g.checkpoint.sel).toBe(10);
  });

  test('começar de um checkpoint: a fase especial dele, com 1 vida e pontuação zerada', () => {
    const g = overWith([5, 15]);
    g.score = 1234;
    press(g, 'start');
    press(g, 'start');
    expect(g.state).toBe('play');
    expect(g.level).toBe(15);
    expect(g.lives).toBe(1);
    expect(RULES.checkpointLives).toBe(1);
    expect(g.score).toBe(0);
    expect(g.special).toBe(SPECIALS[15]);
    expect(g.trophies, 'os troféus continuam').toEqual([5, 15]);
  });

  test('"Começar do zero": fase 1 com 3 vidas, e os checkpoints continuam para a próxima vez', () => {
    const g = overWith([5]);
    press(g, 'start');
    tap(g, 'left');
    expect(g.checkpoint.sel).toBe(1);
    press(g, 'action');
    expect(g.state).toBe('play');
    expect(g.level).toBe(1);
    expect(g.lives).toBe(RULES.startLives);
    loseAll(g);
    press(g, 'start');
    expect(g.state).toBe('checkpoint');
    expect(g.checkpoint.sel).toBe(5);
  });

  test('perdendo a única vida do checkpoint, volta ao fim de jogo e à escolha', () => {
    const g = overWith([10]);
    press(g, 'start');
    press(g, 'start');
    expect(g.level).toBe(10);
    g.critters.list = [];
    g.bear.active = false;
    g.player.fall();
    stepUntil(g, () => g.state === 'gameOver', 4);
    expect(g.state).toBe('gameOver');
    press(g, 'start');
    expect(g.state).toBe('checkpoint');
  });

  test('não dá para começar de uma fase especial sem o troféu dela', () => {
    const g = overWith([5]);
    press(g, 'start');
    g.confirmCheckpoint(10);
    expect(g.state).toBe('checkpoint');
    g.newGame(10);
    expect(g.level, 'newGame com fase sem troféu começa do zero').toBe(1);
  });

  test('toque/clique num cartão começa dali; nos bloqueados, nada', () => {
    const g = overWith([5, 20]);
    press(g, 'start');
    const cards = checkpointCards(g.checkpoint.options);
    expect(cards.length).toBe(TROPHY_LEVELS.length + 1);
    for (const r of cards) {
      expect(r.x >= 0 && r.x + r.w <= 1280, `cartão ${r.level} dentro da tela`).toBe(true);
    }
    const at = (lv) => cards.find((r) => r.level === lv);
    const locked = at(10);
    expect(checkpointAt(g, locked.x + 5, locked.y + 5).level).toBe(10);
    g.confirmCheckpoint(10);
    expect(g.state).toBe('checkpoint');
    const c = at(20);
    const hit = checkpointAt(g, c.x + c.w / 2, c.y + c.h / 2);
    g.confirmCheckpoint(hit.level);
    expect(g.state).toBe('play');
    expect(g.level).toBe(20);
  });

  test('pausa não abre na escolha; a tela desenha sem erros', () => {
    const g = overWith([5, 10]);
    press(g, 'start');
    press(g, 'pause');
    expect(g.paused).toBe(false);
    g.input.touchMode = true;
    g.renderer.draw(g);
    drawCheckpoint(g.ctx, g);
    tap(g, 'left');
    tap(g, 'left');
    g.renderer.draw(g);
  });

  test('joystick: direcional escolhe e A começa', () => {
    const g = overWith([5, 10]);
    const pad = (o = {}) => ({ connected: true, mapping: 'standard', axes: o.axes || [0, 0], buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: (o.down || []).includes(i), value: 0 })) });
    g.input.pollGamepads([pad()]);
    g.input.pollGamepads([pad({ down: [0] })]);
    expect(g.state).toBe('checkpoint');
    g.input.pollGamepads([pad({ axes: [-1, 0] })]);
    step(g, 0.05);
    g.input.pollGamepads([pad()]);
    step(g, 0.05);
    expect(g.checkpoint.sel).toBe(5);
    g.input.pollGamepads([pad({ down: [GAMEPAD.menu] })]);
    expect(g.state).toBe('play');
    expect(g.level).toBe(5);
  });

  test('a fase espera as fotos 3D dela (no máximo PRELOAD_MAX s) e começa sozinha', () => {
    const g = overWith([15]);
    const asked = [];
    let ready = false;
    g.preload = { request: (lv) => asked.push(lv), ready: () => ready };
    press(g, 'start');
    expect(asked).toContain(15);
    press(g, 'start');
    expect(g.state).toBe('checkpoint');
    expect(g.checkpoint.pending).toBe(true);
    step(g, 0.5);
    expect(g.state).toBe('checkpoint');
    ready = true;
    step(g, 0.05);
    expect(g.state).toBe('play');
    expect(g.level).toBe(15);
    // Sem as fotos nunca prontas, segue depois da espera máxima
    loseAll(g);
    ready = false;
    press(g, 'start');
    press(g, 'start');
    step(g, PRELOAD_MAX + 0.5);
    expect(g.state).toBe('play');
  });

  test('com conta: os troféus da conta são os checkpoints', async () => {
    const b = new MemoryBackend();
    b.seed({ email: 'ana@b.com', nickname: 'Ana', best: 100, trophies: [5, 25] });
    await b.signIn('ana@b.com', 'senha123');
    const g = new Game(canvas(), { title: true, backend: b });
    b.onChange((s) => g.setAccount(s));
    expect(g.trophies).toEqual([5, 25]);
    g.newGame();
    g.critters.list = [];
    g.bear.active = false;
    loseAll(g);
    press(g, 'start');
    expect(g.state).toBe('checkpoint');
    expect(g.checkpoint.sel).toBe(25);
    press(g, 'start');
    expect(g.level).toBe(25);
    expect(g.lives).toBe(1);
  });
});

// Jogo na tela inicial com estes troféus
function titleWith(trophies) {
  const g = new Game(canvas(), { title: true });
  g.trophies = [...trophies];
  return g;
}

suite('Checkpoints na tela inicial: escolher pela prateleira de troféus', () => {
  test('clicar/tocar num troféu ganho da prateleira começa da fase dele com 1 vida', () => {
    const g = titleWith([5, 20]);
    const slot = shelfSlots().find((s) => s.level === 20);
    const hit = shelfAt(slot.x, slot.y - slot.size / 2);
    expect(hit && hit.level).toBe(20);
    expect(g.startFromTitle(hit.level)).toBe(true);
    expect(g.state).toBe('play');
    expect(g.level).toBe(20);
    expect(g.lives).toBe(RULES.checkpointLives);
    expect(g.score).toBe(0);
  });

  test('troféu ainda não ganho: o clique não começa nada', () => {
    const g = titleWith([5]);
    const slot = shelfSlots().find((s) => s.level === 10);
    expect(shelfAt(slot.x, slot.y - 10).level).toBe(10);
    expect(g.startFromTitle(10)).toBe(false);
    expect(g.state).toBe('title');
  });

  test('clicar fora dos troféus não acerta nenhum; cada troféu tem a sua área', () => {
    expect(shelfAt(640, 600)).toBe(null);
    const slots = shelfSlots();
    expect(slots.map((s) => s.level)).toEqual(TROPHY_LEVELS);
    for (const s of slots) expect(shelfAt(s.x, s.y - s.size / 2).level).toBe(s.level);
  });

  test('← → destacam um troféu ganho; Enter começa dali (sem destaque, do zero)', () => {
    const g = titleWith([5, 15]);
    expect(g.titleSel).toBe(1);
    tap(g, 'right');
    expect(g.titleSel).toBe(5);
    tap(g, 'right');
    expect(g.titleSel, 'pula a fase 10, sem troféu').toBe(15);
    tap(g, 'right');
    expect(g.titleSel).toBe(15);
    tap(g, 'left');
    expect(g.titleSel).toBe(5);
    press(g, 'start');
    expect(g.state).toBe('play');
    expect(g.level).toBe(5);
    expect(g.lives).toBe(1);
    const z = titleWith([5]);
    press(z, 'start');
    expect(z.level).toBe(1);
    expect(z.lives).toBe(RULES.startLives);
  });

  test('a tela inicial ensina a escolher o troféu e mostra a fase escolhida', () => {
    const g = titleWith([5, 15]);
    const texts = [];
    const ctx = g.ctx;
    const orig = ctx.fillText?.bind(ctx);
    ctx.fillText = (txt, ...rest) => {
      texts.push(String(txt));
      return orig?.(txt, ...rest);
    };
    g.renderer.draw(g);
    expect(texts.some((x) => x.includes('clique num troféu'))).toBe(true);
    tap(g, 'right');
    texts.length = 0;
    g.renderer.draw(g);
    expect(texts.some((x) => x.includes('na fase 5 (1 vida)'))).toBe(true);
  });

  test('começando de um checkpoint na tela inicial, espera as fotos 3D da fase dele', () => {
    const g = titleWith([25]);
    let ready = false;
    const asked = [];
    g.preload = { request: (lv) => asked.push(lv), ready: (lv) => lv === 1 || ready };
    g.startFromTitle(25);
    expect(g.state).toBe('title');
    expect(g.startPending).toBe(true);
    expect(asked).toContain(25);
    step(g, 0.5);
    expect(g.state).toBe('title');
    ready = true;
    step(g, 0.05);
    expect(g.state).toBe('play');
    expect(g.level).toBe(25);
    expect(g.lives).toBe(1);
  });
});
