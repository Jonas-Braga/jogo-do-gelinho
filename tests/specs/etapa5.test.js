// Etapa 5: telas, recorde, controles de toque, polimento e ajuste de dificuldade.
import { suite, test, expect } from '../harness.js';
import { fakeCanvas, isNode } from '../env.js';
import { makeGame, step, stepUntil, press } from '../helpers.js';
import { Game } from '../../src/game.js';
import { TOUCH_BUTTONS } from '../../src/input.js';
import { MUTE_BUTTON } from '../../src/hud.js';
import { levelParams, levelIntro } from '../../src/levels.js';
import { loadHighScore, saveHighScore, removeItem, STORE } from '../../src/storage.js';
import { W, H, PLAYER, RULES } from '../../src/config.js';

const titleGame = () => new Game(isNode ? fakeCanvas() : document.createElement('canvas'), { title: true });
const loseAll = (g) => {
  g.lives = 1;
  g.player.fall();
  stepUntil(g, () => g.state === 'gameOver', 3);
};

suite('Etapa 5 · telas, recorde, toque e dificuldade', () => {
  // ---- Tela inicial
  test('o jogo abre na tela inicial', () => {
    const g = titleGame();
    expect(g.state).toBe('title');
    g.renderer.draw(g);
  });

  test('tela inicial: cenário vivo, mas sem temperatura, bichos nem perigo', () => {
    const g = titleGame();
    const off = g.rows[0].offset;
    step(g, 5);
    expect(g.rows[0].offset, 'placas se movem').not.toBe(off);
    expect(g.temp).toBe(RULES.tempStart);
    expect(g.critters.list.length).toBe(0);
    expect(g.lives).toBe(RULES.startLives);
    expect(g.player.state).toBe('stand');
    expect(g.particles.fx.some((f) => f.kind === 'smoke'), 'iglu soltando fumaça').toBe(true);
  });

  test('Enter, Espaço ou toque começam a partida na fase 1', () => {
    for (const action of ['start', 'action']) {
      const g = titleGame();
      press(g, action);
      expect(g.state, action).toBe('play');
      expect(g.level).toBe(1);
      expect(g.score).toBe(0);
      expect(g.igloo.count, 'iglu vazio na partida').toBe(0);
    }
  });

  test('na tela inicial a pausa não funciona', () => {
    const g = titleGame();
    press(g, 'pause');
    expect(g.paused).toBe(false);
  });

  // ---- Recorde
  test('recorde salvo e lido do localStorage', () => {
    removeItem('highscore');
    expect(loadHighScore()).toBe(0);
    saveHighScore(1234);
    expect(loadHighScore()).toBe(1234);
    expect(titleGame().highScore).toBe(1234);
    removeItem('highscore');
  });

  test('fim de jogo com pontuação maior vira novo recorde e é salvo', () => {
    removeItem('highscore');
    const g = makeGame();
    g.score = 870;
    loseAll(g);
    expect(g.highScore).toBe(870);
    expect(g.newRecord).toBe(true);
    expect(loadHighScore()).toBe(870);
    removeItem('highscore');
  });

  test('pontuação menor não apaga o recorde', () => {
    removeItem('highscore');
    saveHighScore(5000);
    const g = makeGame();
    g.score = 300;
    loseAll(g);
    expect(g.highScore).toBe(5000);
    expect(g.newRecord).toBe(false);
    expect(loadHighScore()).toBe(5000);
    removeItem('highscore');
  });

  test('recorde também é salvo ao concluir uma fase', () => {
    removeItem('highscore');
    const g = makeGame();
    while (!g.igloo.complete) g.igloo.add();
    g.score = 400;
    g.player.x = g.igloo.doorX;
    g.input.held.add('up');
    stepUntil(g, () => g.state !== 'play', 0.3);
    g.input.held.delete('up');
    stepUntil(g, () => g.bonusDone, 10);
    expect(loadHighScore()).toBeGreaterThan(400);
    removeItem('highscore');
  });

  test('sem localStorage (bloqueado) o jogo continua funcionando', () => {
    const real = globalThis.localStorage;
    const broken = {
      getItem() { throw new Error('bloqueado'); },
      setItem() { throw new Error('bloqueado'); },
      removeItem() { throw new Error('bloqueado'); },
    };
    try {
      Object.defineProperty(globalThis, 'localStorage', { value: broken, configurable: true });
      expect(loadHighScore()).toBe(0);
      expect(saveHighScore(10)).toBe(false);
      const g = makeGame();
      g.score = 50;
      loseAll(g);
      expect(g.highScore).toBe(50);
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { value: real, configurable: true });
    }
  });

  test('testes usam um prefixo próprio no armazenamento (não tocam no recorde real)', () => {
    expect(STORE.prefix).toBe('gelinho.test.');
  });

  test('tela de fim de jogo mostra pontuação e recorde', () => {
    removeItem('highscore');
    const g = makeGame();
    g.score = 120;
    loseAll(g);
    g.renderer.draw(g);
    expect(g.state).toBe('gameOver');
    expect(g.highScore).toBe(120);
    removeItem('highscore');
  });

  // ---- Aviso de fase
  test('aviso no início de cada fase, que some sozinho', () => {
    const g = makeGame();
    expect(g.banner.title).toBe('FASE 1');
    step(g, 3);
    expect(g.banner).toBe(null);
    expect(levelIntro(2).sub).toContain('fragmentadas');
    expect(levelIntro(4).sub).toContain('urso');
    expect(levelIntro(RULES.auroraFrom).sub).toContain('aurora');
  });

  // ---- Toque
  test('botões de toque ficam dentro da tela e não se sobrepõem (nem ao mudo)', () => {
    const all = [...TOUCH_BUTTONS, { id: 'mute', ...MUTE_BUTTON }];
    for (const b of all) {
      expect(b.x, b.id).toBeGreaterThanOrEqual(0);
      expect(b.y, b.id).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w, b.id).toBeLessThanOrEqual(W);
      expect(b.y + b.h, b.id).toBeLessThanOrEqual(H);
    }
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap, `${a.id} × ${b.id}`).toBe(false);
      }
    }
  });

  test('segurar o direcional de toque move o personagem; soltar para', () => {
    const g = makeGame();
    const right = TOUCH_BUTTONS.find((b) => b.id === 'right');
    const x0 = g.player.x;
    expect(g.input.pointerDown(1, right.x + 10, right.y + 10)).toBe('right');
    expect(g.input.touchMode).toBe(true);
    step(g, 0.5);
    expect(g.player.x).toBeGreaterThan(x0 + 50);
    g.input.pointerUp(1);
    const x1 = g.player.x;
    step(g, 0.3);
    expect(g.player.x).toBe(x1);
  });

  test('arrastar o dedo no direcional troca de direção', () => {
    const g = makeGame();
    const left = TOUCH_BUTTONS.find((b) => b.id === 'left');
    const right = TOUCH_BUTTONS.find((b) => b.id === 'right');
    g.input.pointerDown(7, left.x + 5, left.y + 5);
    expect(g.input.axisX()).toBe(-1);
    g.input.pointerMove(7, right.x + 5, right.y + 5);
    expect(g.input.axisX()).toBe(1);
    g.input.pointerMove(7, W / 2, 100); // saiu dos botões
    expect(g.input.axisX()).toBe(0);
  });

  test('toque e teclado ao mesmo tempo não se atrapalham', () => {
    const g = makeGame();
    const left = TOUCH_BUTTONS.find((b) => b.id === 'left');
    g.input.held.add('left');
    g.input.pointerDown(3, left.x + 5, left.y + 5);
    g.input.pointerUp(3);
    expect(g.input.isDown('left'), 'tecla continua segurada').toBe(true);
    g.input.held.delete('left');
  });

  test('botões de toque de inverter e pausar funcionam', () => {
    const g = makeGame();
    const action = TOUCH_BUTTONS.find((b) => b.id === 'action');
    const pause = TOUCH_BUTTONS.find((b) => b.id === 'pause');
    g.igloo.add();
    g.player.state = 'stand';
    g.player.row = 1;
    g.player.y = g.rows[1].y;
    const dir = g.rows[1].dir;
    g.input.pointerDown(2, action.x + action.w / 2, action.y + action.h / 2);
    expect(g.rows[1].dir).toBe(-dir);
    g.input.pointerDown(4, pause.x + 5, pause.y + 5);
    expect(g.paused).toBe(true);
  });

  test('toque fora dos botões não aciona nada', () => {
    const g = makeGame();
    expect(g.input.pointerDown(9, W / 2, H / 2)).toBe(null);
    expect(g.input.axisX()).toBe(0);
    expect(g.input.axisY()).toBe(0);
  });

  test('HUD com botões de toque renderiza sem erro', () => {
    const g = makeGame();
    g.input.pointerDown(1, 20, 20);
    g.renderer.draw(g);
    g.paused = true;
    g.renderer.draw(g);
  });

  // ---- Dificuldade
  test('inimigos e urso nunca ficam mais rápidos que o jogador andando', () => {
    for (let l = 1; l <= 40; l++) {
      const p = levelParams(l);
      expect(p.enemySpeed, `fase ${l}`).toBeLessThan(PLAYER.walkSpeed);
      expect(p.bearSpeed, `fase ${l}`).toBeLessThan(PLAYER.walkSpeed);
    }
  });

  test('dificuldade cresce aos poucos e tem teto', () => {
    const a = levelParams(1);
    const b = levelParams(6);
    expect(b.enemySpeed).toBeGreaterThan(a.enemySpeed);
    expect(b.spawnMax).toBeLessThan(a.spawnMax);
    expect(a.maxGroup).toBe(1);
    for (let l = 1; l <= 60; l++) {
      const p = levelParams(l);
      expect(p.spawnMin, `fase ${l}`).toBeGreaterThanOrEqual(1.8);
      expect(p.spawnMax).toBeGreaterThan(p.spawnMin);
      expect(p.speed).toBeLessThanOrEqual(170);
      expect(p.maxGroup).toBeLessThanOrEqual(3);
    }
  });

  test('fase 1 é jogável: em 20 s parado na costa nada acontece de ruim', () => {
    const g = makeGame({ quiet: false });
    g.temp = 99; // isola o teste do frio
    step(g, 20);
    expect(g.lives).toBe(RULES.startLives);
    expect(g.state).toBe('play');
  });
});
