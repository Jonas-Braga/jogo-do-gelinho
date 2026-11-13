// Alcance do pulo que cresce com a velocidade da fase, movimento no ar e
// joystick (Gamepad API) no celular e no PC.
import { suite, test, expect } from '../harness.js';
import { fakeCanvas, isNode } from '../env.js';
import { makeGame, step, stepUntil, hold, release, placeOnFloe } from '../helpers.js';
import { Game } from '../../src/game.js';
import { GAMEPAD, readGamepad } from '../../src/input.js';
import { controlsFor } from '../../src/screens.js';
import { levelParams } from '../../src/levels.js';
import { PLAYER } from '../../src/config.js';

// Joystick falso: alavanca (x, y), botões apertados e mapeamento
function fakePad({ x = 0, y = 0, down = [], mapping = 'standard', axes = null, connected = true } = {}) {
  const buttons = Array.from({ length: 17 }, (_, i) => ({ pressed: down.includes(i), value: down.includes(i) ? 1 : 0 }));
  return { connected, mapping, axes: axes || [x, y, 0, 0], buttons };
}

// Distância percorrida para o lado num pulo inteiro, segurando a direção
function jumpReach(level) {
  const g = makeGame({ level });
  g.player.x = 300;
  hold(g, 'right');
  hold(g, 'down');
  stepUntil(g, () => g.player.state === 'jump', 0.3);
  release(g, 'down');
  const x0 = g.player.x;
  stepUntil(g, () => g.player.state !== 'jump', PLAYER.jumpTime + 0.1);
  return g.player.x - x0;
}

suite('Pulo proporcional à fase e joystick', () => {
  // ---- Alcance do pulo
  test('fase 1: o pulo alcança o mesmo de sempre (75% da velocidade de andar)', () => {
    expect(levelParams(1).airSpeed).toBeCloseTo(PLAYER.walkSpeed * PLAYER.airControl, 1e-6);
    expect(jumpReach(1)).toBeCloseTo(PLAYER.walkSpeed * PLAYER.airControl * PLAYER.jumpTime, 4);
  });

  test('o alcance do pulo cresce na mesma proporção da velocidade das placas', () => {
    const base = levelParams(1);
    for (const lv of [2, 3, 7, 9, 13, 18]) {
      const p = levelParams(lv);
      expect(p.airSpeed / base.airSpeed, `fase ${lv}`).toBeCloseTo(p.speed / base.speed, 1e-6);
    }
    expect(jumpReach(9) / jumpReach(1), 'pulo de verdade na fase 9').toBeCloseTo(levelParams(9).speed / base.speed, 0.05);
  });

  test('quanto mais rápida a fase, mais longe o pulo vai (e nunca menos que na fase 1)', () => {
    let last = 0;
    for (let lv = 1; lv <= 30; lv++) {
      const p = levelParams(lv);
      expect(p.airSpeed, `fase ${lv}`).toBeGreaterThanOrEqual(levelParams(1).airSpeed);
      if (!p.special && !levelParams(Math.max(1, lv - 1)).special) {
        expect(p.airSpeed, `fase ${lv}`).toBeGreaterThanOrEqual(last);
      }
      last = p.airSpeed;
    }
    expect(jumpReach(13)).toBeGreaterThan(jumpReach(1) * 2);
  });

  test('andar no chão continua na mesma velocidade em qualquer fase', () => {
    for (const lv of [1, 13]) {
      const g = makeGame({ level: lv });
      g.player.x = 300;
      hold(g, 'right');
      step(g, 0.5);
      expect(g.player.x - 300, `fase ${lv}`).toBeCloseTo(PLAYER.walkSpeed * 0.5, 3);
    }
  });

  // ---- Movimento no ar
  test('dá para mover o personagem no ar: começar a andar e trocar de lado no meio do pulo', () => {
    const g = makeGame();
    for (const row of g.rows) row.speed = 0;
    placeOnFloe(g, 1);
    hold(g, 'up');
    stepUntil(g, () => g.player.state === 'jump', 0.3);
    release(g, 'up');
    const x0 = g.player.x;
    step(g, 0.05);
    expect(g.player.x, 'parado no ar sem apertar nada').toBeCloseTo(x0, 1e-6);
    hold(g, 'right');
    step(g, 0.12);
    release(g, 'right');
    const x1 = g.player.x;
    expect(x1, 'foi para a direita no ar').toBeGreaterThan(x0 + 15);
    expect(g.player.state).toBe('jump');
    hold(g, 'left');
    step(g, 0.12);
    release(g, 'left');
    expect(g.player.x, 'voltou para a esquerda no ar').toBeLessThan(x1 - 15);
    expect(g.player.facing).toBe(-1);
  });

  // ---- Joystick
  test('joystick: alavanca para o lado anda; soltar para', () => {
    const g = makeGame();
    const x0 = g.player.x;
    g.input.pollGamepads([fakePad({ x: 1 })]);
    step(g, 0.5);
    expect(g.player.x).toBeGreaterThan(x0 + 50);
    g.input.pollGamepads([fakePad()]);
    const x1 = g.player.x;
    step(g, 0.3);
    expect(g.player.x).toBe(x1);
    g.input.pollGamepads([fakePad({ x: -1 })]);
    step(g, 0.3);
    expect(g.player.x).toBeLessThan(x1 - 30);
  });

  test('joystick: direcional digital anda e pula', () => {
    const g = makeGame();
    const x0 = g.player.x;
    g.input.pollGamepads([fakePad({ down: [GAMEPAD.right] })]);
    step(g, 0.3);
    expect(g.player.x).toBeGreaterThan(x0 + 30);
    g.input.pollGamepads([fakePad({ down: [GAMEPAD.down] })]);
    stepUntil(g, () => g.player.state === 'jump', 0.3);
    expect(g.player.state).toBe('jump');
    expect(g.player.to).toBe(0);
  });

  test('joystick: alavanca para cima/baixo pula; pouco inclinada, só anda', () => {
    const g = makeGame();
    for (const row of g.rows) row.speed = 0;
    placeOnFloe(g, 1);
    // Entortou um pouco para cima enquanto anda: não pula
    g.input.pollGamepads([fakePad({ x: 0.9, y: -(GAMEPAD.jump - 0.1) })]);
    step(g, 0.1);
    expect(g.player.state, 'alavanca pouco inclinada').toBe('stand');
    g.input.pollGamepads([fakePad({ x: 0, y: -1 })]);
    stepUntil(g, () => g.player.state === 'jump', 0.3);
    expect(g.player.state).toBe('jump');
    expect(g.player.to, 'subindo').toBe(0);
  });

  test('joystick: pular na diagonal e mover no ar', () => {
    const g = makeGame();
    for (const row of g.rows) row.speed = 0;
    placeOnFloe(g, 1);
    const x0 = g.player.x;
    g.input.pollGamepads([fakePad({ x: 0.8, y: 0.8 })]);
    stepUntil(g, () => g.player.state === 'jump', 0.3);
    expect(g.player.to, 'descendo').toBe(2);
    step(g, 0.2);
    expect(g.player.x, 'andando para a direita no ar').toBeGreaterThan(x0 + 20);
  });

  test('joystick: alavanca em repouso com folga (zona morta) não move', () => {
    const g = makeGame();
    const x0 = g.player.x;
    g.input.pollGamepads([fakePad({ x: 0.2, y: -0.25 })]);
    step(g, 0.4);
    expect(g.player.x).toBe(x0);
    expect(g.player.state).toBe('stand');
    expect(g.input.padActive, 'folga da alavanca não conta como uso').toBe(false);
  });

  test('joystick: botão A inverte a fileira uma vez por aperto', () => {
    const g = makeGame();
    placeOnFloe(g, 1);
    g.igloo.add();
    g.igloo.add();
    const dir = g.rows[1].dir;
    const blocks = g.igloo.count;
    for (let i = 0; i < 5; i++) g.input.pollGamepads([fakePad({ down: [0] })]); // segurando
    expect(g.rows[1].dir).toBe(-dir);
    expect(g.igloo.count).toBe(blocks - 1);
    g.input.pollGamepads([fakePad()]);
    g.input.pollGamepads([fakePad({ down: [0] })]);
    expect(g.rows[1].dir, 'segundo aperto inverte de novo').toBe(dir);
  });

  test('joystick: Start pausa e continua; Select liga/desliga o som', () => {
    const g = makeGame();
    g.input.pollGamepads([fakePad({ down: [GAMEPAD.menu] })]);
    expect(g.paused).toBe(true);
    g.input.pollGamepads([fakePad({ down: [GAMEPAD.menu] })]);
    expect(g.paused, 'segurar não alterna').toBe(true);
    g.input.pollGamepads([fakePad()]);
    g.input.pollGamepads([fakePad({ down: [GAMEPAD.menu] })]);
    expect(g.paused).toBe(false);
    const muted = g.sfx.muted;
    g.input.pollGamepads([fakePad()]);
    g.input.pollGamepads([fakePad({ down: [GAMEPAD.mute] })]);
    expect(g.sfx.muted).toBe(!muted);
    g.input.pollGamepads([fakePad()]);
    g.input.pollGamepads([fakePad({ down: [GAMEPAD.mute] })]);
    expect(g.sfx.muted).toBe(muted);
  });

  test('joystick: A ou Start começam o jogo na tela inicial e depois do fim de jogo', () => {
    for (const b of [0, GAMEPAD.menu]) {
      const g = new Game(isNode ? fakeCanvas() : document.createElement('canvas'), { title: true });
      expect(g.state).toBe('title');
      g.input.pollGamepads([fakePad({ down: [b] })]);
      expect(g.state, `botão ${b}`).toBe('play');
      expect(g.paused).toBe(false);
      g.lives = 1;
      g.player.fall();
      stepUntil(g, () => g.state === 'gameOver', 3);
      g.input.pollGamepads([fakePad()]);
      g.input.pollGamepads([fakePad({ down: [b] })]);
      expect(g.state, `botão ${b} no fim de jogo`).toBe('play');
    }
  });

  test('joystick em uso: os botões de toque somem da tela', () => {
    const g = makeGame();
    g.input.pointerDown(1, 640, 300);
    g.input.pointerUp(1);
    expect(g.input.showTouch, 'celular sem joystick').toBe(true);
    g.input.pollGamepads([fakePad({ down: [0] })]);
    expect(g.input.padActive).toBe(true);
    expect(g.input.showTouch, 'joystick detectado').toBe(false);
    expect(g.input.style).toBe('pad');
    g.input.pollGamepads([fakePad()]);
    expect(g.input.showTouch, 'continua escondido com o joystick parado').toBe(false);
    g.renderer.draw(g);
    g.paused = true;
    g.renderer.draw(g);
  });

  test('joystick desconectado ou toque na tela: os botões de toque voltam', () => {
    const g = makeGame();
    g.input.pointerDown(1, 640, 300);
    g.input.pointerUp(1);
    g.input.pollGamepads([fakePad({ x: 1 })]);
    expect(g.input.showTouch).toBe(false);
    g.input.pollGamepads([null, fakePad({ connected: false })]);
    expect(g.input.showTouch, 'desconectou').toBe(true);
    expect(g.input.isDown('right'), 'direção não fica presa').toBe(false);
    g.input.pollGamepads([fakePad({ x: 1 })]);
    expect(g.input.showTouch).toBe(false);
    g.input.pollGamepads([fakePad()]);
    g.input.pointerDown(2, 640, 300);
    expect(g.input.showTouch, 'tocou na tela').toBe(true);
    g.input.pointerUp(2);
  });

  test('joystick só ligado, sem uso, não esconde nada; sem joystick nada muda', () => {
    const g = makeGame();
    g.input.pointerDown(1, 640, 300);
    g.input.pointerUp(1);
    g.input.pollGamepads([fakePad()]);
    expect(g.input.showTouch).toBe(true);
    g.input.pollGamepads([]);
    g.input.pollGamepads([null, null]);
    g.input.pollGamepads(); // navegador/Node sem joystick
    expect(g.input.padActive).toBe(false);
    expect(g.input.style).toBe('touch');
    expect(makeGame().input.style).toBe('keys');
  });

  test('joystick fora do padrão: direcional nos eixos 6 e 7', () => {
    const r = readGamepad(fakePad({ mapping: '', axes: [0, 0, 0, 0, 0, 0, -1, 1] }));
    expect(r.held.has('left')).toBe(true);
    expect(r.held.has('down')).toBe(true);
    expect(r.held.has('right')).toBe(false);
    // No padrão, esses eixos não são direcional
    const s = readGamepad(fakePad({ axes: [0, 0, 0, 0, 0, 0, -1, 1] }));
    expect(s.held.size).toBe(0);
  });

  test('teclado e joystick funcionam juntos', () => {
    const g = makeGame();
    const x0 = g.player.x;
    g.input.pollGamepads([fakePad()]);
    hold(g, 'right');
    step(g, 0.3);
    expect(g.player.x).toBeGreaterThan(x0 + 30);
    release(g, 'right');
  });

  test('a pausa ensina os botões do joystick quando ele está em uso', () => {
    const pad = controlsFor('igloo', 'pad').map(([k]) => k).join(' ');
    expect(pad.includes('Botão A')).toBe(true);
    expect(pad.includes('Start')).toBe(true);
    expect(pad.includes('Espaço')).toBe(false);
    expect(pad.includes('⇄')).toBe(false);
    expect(controlsFor('cabin', 'pad').length).toBe(controlsFor('cabin').length);
  });
});
