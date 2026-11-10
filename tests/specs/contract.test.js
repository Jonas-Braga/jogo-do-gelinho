// Contrato com a GAME_SPEC.md: valores e regras que não podem mudar sem
// aprovação explícita. Se um destes falhar, alguém mudou uma regra do jogo.
import { suite, test, expect } from '../harness.js';
import { isNode } from '../env.js';
import { W, H, ROW_Y, SHORE_Y, WATER_TOP, RULES } from '../../src/config.js';
import { MAP } from '../../src/input.js';
import { levelParams } from '../../src/levels.js';

suite('Contrato da especificação', () => {
  test('resolução lógica fixa de 1280x720', () => {
    expect(W).toBe(1280);
    expect(H).toBe(720);
  });

  test('costa no topo e 4 fileiras de gelo na água, de cima para baixo', () => {
    expect(ROW_Y.length).toBe(4);
    expect(SHORE_Y).toBeLessThan(WATER_TOP);
    for (let i = 0; i < ROW_Y.length; i++) {
      expect(ROW_Y[i], `fileira ${i}`).toBeGreaterThan(WATER_TOP);
      if (i > 0) expect(ROW_Y[i], `ordem da fileira ${i}`).toBeGreaterThan(ROW_Y[i - 1]);
    }
  });

  test('temperatura começa em 45° e cai 1° por segundo', () => {
    expect(RULES.tempStart).toBe(45);
    expect(RULES.tempTick).toBe(1);
  });

  test('começa com 3 vidas e ganha vida extra a cada 5.000 pontos', () => {
    expect(RULES.startLives).toBe(3);
    expect(RULES.extraLifeEvery).toBe(5000);
  });

  test('iglu tem 15 blocos + porta (16 peças)', () => {
    expect(RULES.iglooPieces).toBe(16);
  });

  test('controles: setas e WASD movem, Espaço inverte, P pausa, Enter inicia', () => {
    expect(MAP.ArrowLeft).toBe('left');
    expect(MAP.ArrowRight).toBe('right');
    expect(MAP.ArrowUp).toBe('up');
    expect(MAP.ArrowDown).toBe('down');
    expect(MAP.KeyA).toBe('left');
    expect(MAP.KeyD).toBe('right');
    expect(MAP.KeyW).toBe('up');
    expect(MAP.KeyS).toBe('down');
    expect(MAP.Space).toBe('action');
    expect(MAP.KeyP).toBe('pause');
    expect(MAP.Enter).toBe('start');
  });

  test('inimigos e peixes andam contra a direção das placas da sua fileira', async () => {
    const { makeGame } = await import('../helpers.js');
    const g = makeGame();
    g.critters.params = { ...g.params, fishChance: 0.5 };
    for (let row = 0; row < 4; row++) {
      g.critters.list = [];
      g.critters.spawn(row);
      for (const c of g.critters.list) expect(c.dir, `fileira ${row}`).toBe(-g.rows[row].dir);
    }
  });

  test('urso alcança o jogador: ele foge assustado e o urso corre atrás até sumirem', async () => {
    const { makeGame, stepUntil } = await import('../helpers.js');
    const g = makeGame({ level: 4 });
    g.bear.active = true;
    g.player.invuln = 0;
    g.bear.x = g.player.x - 60;
    stepUntil(g, () => g.player.state !== 'stand', 1);
    expect(g.player.state).toBe('flee');
    expect(g.bear.chasing).toBe(true);
    stepUntil(g, () => g.lives < 3, 10);
    expect(g.lives).toBe(2);
  });

  test('entrar no iglu: só com ↑ em frente à porta do iglu completo', async () => {
    const { makeGame, step, enterIgloo } = await import('../helpers.js');
    const g = makeGame();
    while (!g.igloo.complete) g.igloo.add();
    g.player.x = g.igloo.doorX;
    step(g, 1);
    expect(g.state, 'sem ↑ não entra').toBe('play');
    enterIgloo(g);
    expect(g.state).toBe('entering');
  });

  test('áudio com botão de mudo (tecla M)', () => {
    expect(MAP.KeyM).toBe('mute');
  });

  test('velocidade das placas aumenta a cada fase (até um teto)', () => {
    expect(levelParams(2).speed).toBeGreaterThan(levelParams(1).speed);
    // Exceção aprovada pelo usuário: uma fase especial pode ter ritmo próprio
    // (`pace` no tema, ex.: espaço a 80%). A velocidade base (sem o ritmo) continua crescendo.
    const base = (l) => levelParams(l).speed / (levelParams(l).special?.pace ?? 1);
    for (let l = 2; l <= 30; l++) {
      expect(base(l), `fase ${l}`).toBeGreaterThanOrEqual(base(l - 1) - 1e-9);
      // Fora das fases com ritmo próprio, a velocidade real é a base
      if (!levelParams(l).special?.pace) expect(levelParams(l).speed, `fase ${l}`).toBe(base(l));
    }
  });

  test('placas fragmentadas em fases alternadas', () => {
    for (let l = 1; l <= 10; l++) {
      expect(levelParams(l).fragmented, `fase ${l}`).toBe(l % 2 === 0);
    }
  });

  test('urso só a partir da fase 4', () => {
    expect(levelParams(1).bear).toBe(false);
    expect(levelParams(3).bear).toBe(false);
    expect(levelParams(4).bear).toBe(true);
    expect(levelParams(9).bear).toBe(true);
  });

  test('pontuação: placa e grau de bônus valem 10 × fase; peixe vale 200', () => {
    for (const l of [1, 2, 5]) {
      expect(levelParams(l).floePoints).toBe(10 * l);
      expect(levelParams(l).degreePoints).toBe(10 * l);
    }
    expect(levelParams(1).fishPoints).toBe(200);
  });

  test('estrutura de módulos em src/ continua existindo', async () => {
    if (!isNode) return; // verificação de arquivos só no Node
    const fs = await import('node:fs');
    const required = ['main', 'game', 'config', 'input', 'player', 'floes', 'enemies', 'bear',
      'igloo', 'renderer', 'sprites', 'particles', 'hud', 'levels'];
    for (const m of required) {
      expect(fs.existsSync(new URL(`../../src/${m}.js`, import.meta.url)), `src/${m}.js`).toBe(true);
    }
    expect(fs.existsSync(new URL('../../index.html', import.meta.url)), 'index.html').toBe(true);
  });
});
