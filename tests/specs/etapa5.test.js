// Etapa 5: telas, recorde, controles de toque, polimento e ajuste de dificuldade.
import { suite, test, expect } from '../harness.js';
import { fakeCanvas, isNode } from '../env.js';
import { makeGame, step, stepUntil, press, placeOnFloe } from '../helpers.js';
import { Game } from '../../src/game.js';
import { TOUCH_BUTTONS, WALK_PAD, walkDirection } from '../../src/input.js';
import { MUTE_BUTTON } from '../../src/hud.js';
import { controlsFor } from '../../src/screens.js';
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

  // Pontos de toque: meio de ◀, meio de ▶ e meio de um botão pelo id
  const padY = WALK_PAD.y + WALK_PAD.h / 2;
  const padMid = WALK_PAD.x + WALK_PAD.w / 2;
  const LEFT = [WALK_PAD.x + WALK_PAD.w * 0.25, padY];
  const RIGHT = [WALK_PAD.x + WALK_PAD.w * 0.75, padY];
  const mid = (id) => {
    const b = TOUCH_BUTTONS.find((t) => t.id === id);
    return [b.x + b.w / 2, b.y + b.h / 2];
  };

  // (Adaptados aos botões ◀ ▶ / ▲ ▼ de dois polegares, que substituíram o
  // direcional analógico a pedido do usuário: mesmos nomes e verificações)
  test('segurar o direcional de toque move o personagem; soltar para', () => {
    const g = makeGame();
    const x0 = g.player.x;
    expect(g.input.pointerDown(1, ...RIGHT)).toBe('walk');
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
    g.input.pointerDown(7, ...LEFT);
    expect(g.input.axisX()).toBe(-1);
    g.input.pointerMove(7, ...RIGHT);
    expect(g.input.axisX()).toBe(1);
    g.input.pointerMove(7, padMid + 2, padY + 1); // voltou ao centro (zona morta)
    expect(g.input.axisX()).toBe(0);
  });

  test('toque e teclado ao mesmo tempo não se atrapalham', () => {
    const g = makeGame();
    g.input.held.add('left');
    g.input.pointerDown(3, ...LEFT);
    g.input.pointerUp(3);
    expect(g.input.isDown('left'), 'tecla continua segurada').toBe(true);
    g.input.held.delete('left');
  });

  // ---- 8 direções: ◀ ▶ num polegar, ▲ ▼ no outro
  test('direcional reconhece as 8 direções, incluindo as diagonais', () => {
    const g = makeGame();
    const cases = [
      [1, 0, ['right']], [1, 1, ['down', 'right']], [0, 1, ['down']], [-1, 1, ['down', 'left']],
      [-1, 0, ['left']], [-1, -1, ['up', 'left']], [0, -1, ['up']], [1, -1, ['up', 'right']],
    ];
    for (const [dx, dy, want] of cases) {
      if (dx) g.input.pointerDown(5, ...(dx > 0 ? RIGHT : LEFT));
      if (dy) g.input.pointerDown(6, ...mid(dy > 0 ? 'down' : 'up'));
      for (const a of ['up', 'down', 'left', 'right']) {
        expect(g.input.isDown(a), `(${dx},${dy}) ${a}`).toBe(want.includes(a));
      }
      g.input.pointerUp(5);
      g.input.pointerUp(6);
    }
  });

  test('pular na diagonal: sobe uma fileira já andando para o lado', () => {
    const g = makeGame();
    for (const row of g.rows) row.speed = 0;
    placeOnFloe(g, 1);
    const x0 = g.player.x;
    g.input.pointerDown(2, ...RIGHT);       // um polegar anda
    g.input.pointerDown(3, ...mid('up'));   // o outro pula
    stepUntil(g, () => g.player.state === 'jump', 0.3);
    expect(g.player.state).toBe('jump');
    expect(g.player.to, 'subindo').toBe(0);
    step(g, 0.2);
    g.input.pointerUp(2);
    g.input.pointerUp(3);
    expect(g.player.x, 'andando para a direita no ar').toBeGreaterThan(x0 + 20);
  });

  test('toque leve no centro (zona morta) não move', () => {
    const g = makeGame();
    g.input.pointerDown(4, padMid + 8, padY - 6);
    expect(g.input.axisX()).toBe(0);
    expect(g.input.axisY()).toBe(0);
  });

  test('dá para usar o direcional e o botão de inverter ao mesmo tempo (multitoque)', () => {
    const g = makeGame();
    g.igloo.add();
    for (const row of g.rows) row.speed = 0;
    placeOnFloe(g, 1);
    const dir = g.rows[1].dir;
    g.input.pointerDown(1, ...RIGHT);
    g.input.pointerDown(2, ...mid('action'));
    expect(g.rows[1].dir).toBe(-dir);
    expect(g.input.isDown('right'), 'direcional continua segurado').toBe(true);
  });

  test('direcional fica dentro da tela e longe dos outros botões', () => {
    const { x, y, w, h, grab } = WALK_PAD;
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y + h).toBeLessThanOrEqual(H);
    for (const b of [...TOUCH_BUTTONS, { id: 'mute', ...MUTE_BUTTON }]) {
      // distância entre o retângulo do botão e o dos botões de andar
      const gapX = Math.max(0, b.x - (x + w), x - (b.x + b.w));
      const gapY = Math.max(0, b.y - (y + h), y - (b.y + b.h));
      expect(Math.hypot(gapX, gapY), b.id).toBeGreaterThan(grab);
    }
  });

  // ---- Controle de dois polegares (substituiu o direcional analógico, que no
  // celular era pequeno e sensível demais: o personagem pulava sem querer)
  test('andar com o dedo torto nunca faz pular: ◀ ▶ só mexem para os lados', () => {
    const g = makeGame();
    for (const row of g.rows) row.speed = 0;
    placeOnFloe(g, 1);
    const { x, y, w, h, grab } = WALK_PAD;
    g.input.pointerDown(1, ...RIGHT);
    // o dedo sobe, desce e sai dos botões enquanto anda
    for (const [px, py] of [[x + w, y - grab], [x + w, y + h + grab], [x + w + 200, y - 300], [x + w * 0.8, H]]) {
      g.input.pointerMove(1, px, py);
      expect(g.input.axisX(), `(${px},${py})`).toBe(1);
      expect(g.input.axisY(), `(${px},${py})`).toBe(0);
      step(g, 0.02);
      expect(g.player.state, 'não pulou').not.toBe('jump');
      expect(g.player.row).toBe(1);
    }
  });

  test('dedo pode sair dos botões de andar sem perder o controle; soltar para', () => {
    const g = makeGame();
    g.input.pointerDown(6, ...RIGHT);
    g.input.pointerMove(6, WALK_PAD.x + WALK_PAD.w + 400, padY - 200); // muito além dos botões
    expect(g.input.isDown('right')).toBe(true);
    g.input.pointerMove(6, 0, padY); // atravessou para o outro lado
    expect(g.input.isDown('left')).toBe(true);
    expect(g.input.isDown('right')).toBe(false);
    g.input.pointerUp(6);
    expect(g.input.axisX()).toBe(0);
    expect(g.input.walk.pointerId).toBe(null);
  });

  test('os botões de andar pegam o toque com folga em volta, mas não o resto da tela', () => {
    const g = makeGame();
    const { x, y, w, h, grab } = WALK_PAD;
    expect(g.input.pointerDown(1, x + w + grab - 1, y - grab + 1)).toBe('walk');
    expect(g.input.axisX()).toBe(1);
    g.input.pointerUp(1);
    expect(g.input.pointerDown(1, x + w + grab + 5, y + h / 2)).toBe(null);
    expect(walkDirection(x)).toBe(-1);
    expect(walkDirection(x + w)).toBe(1);
    expect(walkDirection(x + w / 2)).toBe(0);
  });

  test('▲ e ▼ pulam uma fileira por toque; soltar para de pular', () => {
    const g = makeGame();
    for (const row of g.rows) row.speed = 0;
    placeOnFloe(g, 1);
    expect(g.input.pointerDown(1, ...mid('down'))).toBe('down');
    expect(g.input.axisY()).toBe(1);
    stepUntil(g, () => g.player.state === 'jump', 0.3);
    expect(g.player.to, 'descendo').toBe(2);
    g.input.pointerUp(1);
    expect(g.input.axisY()).toBe(0);
    g.input.pointerDown(1, ...mid('up'));
    expect(g.input.axisY()).toBe(-1);
    g.input.pointerUp(1);
  });

  test('deslizar o dedo de ▲ para ▼ troca o pulo; sair do botão solta', () => {
    const g = makeGame();
    g.input.pointerDown(1, ...mid('up'));
    g.input.pointerMove(1, ...mid('down'));
    expect(g.input.axisY()).toBe(1);
    g.input.pointerMove(1, W / 2, H / 2);
    expect(g.input.axisY()).toBe(0);
  });

  test('▲ em frente à porta do iglu completo faz o personagem entrar', () => {
    const g = makeGame();
    while (!g.igloo.complete) g.igloo.add();
    g.igloo.update(5);
    g.player.x = g.igloo.doorX;
    expect(g.atDoor).toBe(true);
    g.input.pointerDown(1, ...mid('up'));
    step(g, 0.05);
    expect(g.state).toBe('entering');
  });

  test('botões de andar e de pular são grandes (fáceis de acertar com o polegar)', () => {
    const side = WALK_PAD.w / 2 - WALK_PAD.dead;
    expect(side, 'largura de ◀ e de ▶').toBeGreaterThanOrEqual(110);
    expect(WALK_PAD.h).toBeGreaterThanOrEqual(110);
    for (const id of ['up', 'down']) {
      const b = TOUCH_BUTTONS.find((t) => t.id === id);
      expect(b.w, id).toBeGreaterThanOrEqual(110);
      expect(b.h, id).toBeGreaterThanOrEqual(110);
      expect(b.hold, id).toBe(true);
    }
    // andar à esquerda da tela, pular à direita: um polegar de cada lado
    expect(WALK_PAD.x + WALK_PAD.w).toBeLessThan(W / 2);
    expect(TOUCH_BUTTONS.find((t) => t.id === 'up').x).toBeGreaterThan(W / 2);
  });

  test('pausa no toque mostra os botões da tela, não as teclas', () => {
    const touch = controlsFor('igloo', true).map(([k]) => k).join(' ');
    expect(touch.includes('◀ ▶')).toBe(true);
    expect(touch.includes('▲ ▼')).toBe(true);
    expect(touch.includes('⇄')).toBe(true);
    expect(touch.includes('Espaço')).toBe(false);
    expect(controlsFor('igloo').map(([k]) => k).join(' ').includes('Espaço')).toBe(true);
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
