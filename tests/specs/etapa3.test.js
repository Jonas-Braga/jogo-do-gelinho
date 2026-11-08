// Etapa 3: inimigos, peixes, urso e progressão de fases.
import { suite, test, expect } from '../harness.js';
import { makeGame, step, stepUntil, placeOnFloe, centerRow, centralRect } from '../helpers.js';
import { W, STEP } from '../../src/config.js';
import { levelParams } from '../../src/levels.js';

const critter = (kind, row, x, dir, speed = 100) =>
  ({ kind, row, x, dir, vx: dir * speed, w: { goose: 44, crab: 40, clam: 34, fish: 30 }[kind], ph: 0 });

suite('Etapa 3 · inimigos, peixes, urso e progressão', () => {
  test('fases ímpares têm placas inteiras; pares, fragmentadas', () => {
    const a = makeGame({ level: 1 });
    expect(a.rows[0].frag).toBe(false);
    expect(a.rows[0].pieces.length).toBe(6);
    const b = makeGame({ level: 2 });
    expect(b.rows[0].frag).toBe(true);
    expect(b.rows[0].pieces.length).toBe(12);
    expect(b.rows[0].pieces[0].w).toBeLessThan(a.rows[0].pieces[0].w);
  });

  test('placas fragmentadas se abrem e se fecham periodicamente', () => {
    const g = makeGame({ level: 2 });
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 12 / STEP; i++) {
      g.update(STEP);
      min = Math.min(min, g.rows[0].gap);
      max = Math.max(max, g.rows[0].gap);
    }
    expect(min).toBeLessThan(6);
    expect(max).toBeGreaterThan(20);
  });

  test('em placa fragmentada o jogador acompanha a peça em que está', () => {
    const g = makeGame({ level: 2 });
    centerRow(g, 1);
    const r = centralRect(g, 1, W / 2 - 60);
    placeOnFloe(g, 1, r);
    for (let i = 0; i < 4 / STEP; i++) {
      g.update(STEP);
      if (g.player.state !== 'stand') break;
    }
    expect(g.player.state).toBe('stand');
    expect(g.rows[1].pieceAt(g.player.x).piece).toBe(r.piece);
  });

  // Fileira 0 anda para a direita, então seus inimigos vêm da direita para a esquerda.
  test('inimigos e peixes andam contra a direção das placas da fileira', () => {
    const g = makeGame({ level: 1 });
    g.critters.params = { ...g.params, fishChance: 0.5 };
    for (let i = 0; i < 20; i++) {
      for (let row = 0; row < 4; row++) {
        g.critters.list = [];
        g.critters.spawn(row);
        for (const c of g.critters.list) {
          expect(c.dir, `fileira ${row}`).toBe(-g.rows[row].dir);
          expect(Math.sign(c.vx)).toBe(c.dir);
          // entra pelo lado de onde vem
          if (c.dir > 0) expect(c.x).toBeLessThan(0);
          else expect(c.x).toBeGreaterThan(W);
        }
      }
    }
  });

  test('ao inverter a fileira, os inimigos e peixes dela também invertem', () => {
    const g = makeGame();
    g.igloo.add();
    g.rows[1].speed = 0;
    placeOnFloe(g, 1);
    g.critters.list.push(critter('crab', 1, 200, -g.rows[1].dir));
    g.critters.list.push(critter('fish', 1, 1000, -g.rows[1].dir));
    g.critters.list.push(critter('goose', 2, 200, -g.rows[2].dir));
    g.input.emit('action');
    step(g, STEP);
    for (const c of g.critters.list.slice(0, 2)) {
      expect(c.dir, c.kind).toBe(-g.rows[1].dir);
      expect(Math.sign(c.vx), c.kind).toBe(-g.rows[1].dir);
    }
    expect(g.critters.list[2].dir, 'outra fileira não muda').toBe(-g.rows[2].dir);
  });

  test('peixes sempre nadam contra o fluxo das placas', () => {
    const g = makeGame();
    g.critters.params = { ...g.params, fishChance: 1 };
    for (let i = 0; i < 30; i++) {
      const row = i % 4;
      g.critters.list = [];
      g.critters.spawn(row);
      for (const c of g.critters.list) {
        expect(c.kind).toBe('fish');
        expect(c.dir, `fileira ${row}`).toBe(-g.rows[row].dir);
      }
    }
  });

  test('inimigo empurra o jogador na direção em que anda', () => {
    const g = makeGame();
    g.rows[0].speed = 0;
    placeOnFloe(g, 0);
    const x0 = g.player.x;
    g.critters.list.push(critter('goose', 0, x0 + 60, -1));
    step(g, 0.45);
    expect(g.player.x).toBeLessThan(x0 - 5);
  });

  test('inimigo pode empurrar o jogador para fora da placa', () => {
    const g = makeGame();
    g.rows[0].speed = 0;
    placeOnFloe(g, 0);
    g.critters.list.push(critter('crab', 0, g.player.x + 60, -1));
    // Empurrado pelas 3 placas do grupo até cair do outro lado
    step(g, 2.5);
    expect(g.player.state === 'drown' || g.lives === 2, 'caiu na água').toBe(true);
  });

  test('inimigo que se afasta não empurra', () => {
    const g = makeGame();
    g.rows[0].speed = 0;
    placeOnFloe(g, 0);
    const x0 = g.player.x;
    g.critters.list.push(critter('clam', 0, x0 - 20, -1));
    step(g, 0.3);
    expect(g.player.x).toBeCloseTo(x0, 0.01);
  });

  test('inimigo em outra fileira não afeta o jogador', () => {
    const g = makeGame();
    for (const r of g.rows) r.speed = 0;
    placeOnFloe(g, 0);
    const x0 = g.player.x;
    g.critters.list.push(critter('goose', 1, x0 - 30, -g.rows[1].dir));
    step(g, 0.5);
    expect(g.player.x).toBeCloseTo(x0, 0.01);
  });

  test('pegar um peixe dá 200 pontos e remove o peixe', () => {
    const g = makeGame();
    g.rows[0].speed = 0;
    placeOnFloe(g, 0);
    g.critters.list.push(critter('fish', 0, g.player.x + 5, -1, 60));
    step(g, STEP * 2);
    expect(g.score).toBe(200);
    expect(g.critters.list.length).toBe(0);
  });

  test('tipo de inimigo varia por fase (ganso → caranguejo → molusco)', () => {
    expect(levelParams(1).enemy).toBe('goose');
    expect(levelParams(2).enemy).toBe('crab');
    expect(levelParams(3).enemy).toBe('clam');
    expect(levelParams(4).enemy).toBe('goose');
    const g = makeGame({ level: 2, quiet: false });
    g.bear.active = false;
    g.critters.params = { ...g.params, fishChance: 0 };
    g.player.x = 60;
    step(g, 6);
    const kinds = new Set(g.critters.list.map((c) => c.kind));
    expect(kinds.size).toBe(1);
    expect(kinds.has('crab')).toBe(true);
  });

  test('inimigos surgem em grupos do tamanho permitido e somem ao sair da tela', () => {
    const g = makeGame({ level: 3 });
    const max = g.params.maxGroup;
    for (let i = 0; i < 40; i++) {
      g.critters.list = [];
      g.critters.spawn(i % 4);
      expect(g.critters.list.length).toBeLessThanOrEqual(Math.max(max, 3));
      if (g.critters.list[0].kind !== 'fish') expect(g.critters.list.length).toBeLessThanOrEqual(max);
    }
    g.player.row = -1;
    step(g, 25);
    expect(g.critters.list.length).toBe(0);
  });

  test('urso só existe a partir da fase 4', () => {
    for (const l of [1, 2, 3]) expect(makeGame({ level: l, quiet: false }).bear.active, `fase ${l}`).toBe(false);
    expect(makeGame({ level: 4, quiet: false }).bear.active).toBe(true);
  });

  // Prepara o urso encostando no jogador pela direita (jogador deve fugir para a esquerda)
  const bearCatch = () => {
    const g = makeGame({ level: 4 });
    g.bear.active = true;
    g.player.invuln = 0;
    g.player.x = 500;
    g.bear.x = g.player.x + 70;
    g.bear.dir = -1;
    stepUntil(g, () => g.player.state !== 'stand', 1);
    return g;
  };

  test('urso alcança o jogador: susto com braços para cima e fuga para longe do urso', () => {
    const g = bearCatch();
    expect(g.player.state).toBe('flee');
    expect(Math.sign(g.player.vx), 'foge para longe do urso').toBe(-1);
    expect(g.player.facing).toBe(-1);
    expect(g.bear.chasing).toBe(true);
    expect(g.bear.dir, 'urso corre na mesma direção').toBe(-1);
    // Susto: pulinho parado antes de correr
    const x0 = g.player.x;
    step(g, 0.15);
    expect(g.player.x).toBe(x0);
    expect(g.player.y).toBeLessThan(250);
    // Depois corre
    step(g, 0.5);
    expect(g.player.x).toBeLessThan(x0 - 50);
  });

  test('urso persegue o jogador (sempre atrás dele) até os dois saírem da tela', () => {
    const g = bearCatch();
    let prev = { px: g.player.x, bx: g.bear.x };
    let lostAt = null;
    for (let i = 0; i < 10 / STEP && lostAt === null; i++) {
      g.update(STEP);
      if (g.lives === 2) lostAt = prev;
      else {
        if (g.player.state === 'flee') {
          expect(g.bear.x, 'urso atrás do jogador').toBeGreaterThan(g.player.x);
        }
        prev = { px: g.player.x, bx: g.bear.x };
      }
    }
    expect(lostAt !== null, 'perdeu a vida').toBe(true);
    expect(lostAt.px, 'jogador fora da tela').toBeLessThan(-40);
    expect(lostAt.bx, 'urso fora da tela').toBeLessThan(-100);
  });

  test('durante a fuga o jogador não obedece aos controles e a temperatura para', () => {
    const g = bearCatch();
    const temp = g.temp;
    g.input.held.add('right');
    g.input.held.add('down');
    step(g, 1.5);
    g.input.held.clear();
    expect(g.player.state).toBe('flee');
    expect(Math.sign(g.player.vx)).toBe(-1);
    expect(g.player.row).toBe(-1);
    expect(g.temp).toBe(temp);
  });

  test('após a fuga o jogador renasce na costa e o urso volta para a tela', () => {
    const g = bearCatch();
    stepUntil(g, () => g.lives === 2, 10);
    expect(g.player.state).toBe('stand');
    expect(g.player.row).toBe(-1);
    expect(g.bear.chasing).toBe(false);
    expect(g.bear.x).toBeGreaterThanOrEqual(0);
    expect(g.bear.x).toBeLessThanOrEqual(W);
    expect(Math.abs(g.bear.x - g.player.x)).toBeGreaterThan(300);
  });

  test('fuga perdendo a última vida leva ao fim de jogo', () => {
    const g = bearCatch();
    g.lives = 1;
    stepUntil(g, () => g.state === 'gameOver', 10);
    expect(g.state).toBe('gameOver');
  });

  test('ao renascer há invulnerabilidade e o urso vai para o lado oposto', () => {
    const g = makeGame({ level: 4 });
    g.bear.active = true;
    g.onPlayerLost();
    expect(g.lives).toBe(2);
    expect(Math.abs(g.bear.x - g.player.x)).toBeGreaterThan(300);
    g.bear.x = g.player.x + 10;
    step(g, 0.5);
    expect(g.player.state).toBe('stand');
    expect(g.lives).toBe(2);
  });

  test('urso persegue o jogador na costa e não sai dela', () => {
    const g = makeGame({ level: 4 });
    g.bear.active = true;
    g.player.invuln = 999;
    g.bear.x = 300;
    g.bear.dir = -1;
    g.player.x = 500;
    step(g, 0.1);
    expect(g.bear.dir).toBe(1);
    for (const r of g.rows) r.speed = 0;
    placeOnFloe(g, 2);
    for (let i = 0; i < 30 / STEP; i++) {
      g.update(STEP);
      if (i % 60 === 0) {
        expect(g.bear.x).toBeGreaterThanOrEqual(70);
        expect(g.bear.x).toBeLessThanOrEqual(W - 70);
      }
    }
  });

  test('urso não ataca quem está nas placas', () => {
    const g = makeGame({ level: 4 });
    g.bear.active = true;
    for (const r of g.rows) r.speed = 0;
    placeOnFloe(g, 0);
    g.player.invuln = 0;
    g.bear.x = g.player.x;
    step(g, 1);
    expect(g.player.state).toBe('stand');
    expect(g.lives).toBe(3);
  });

  test('fase com inimigos, peixes e urso renderiza sem erros', () => {
    const g = makeGame({ level: 4 });
    g.bear.active = true;
    for (const [i, k] of ['goose', 'crab', 'clam', 'fish'].entries()) {
      g.critters.list.push(critter(k, i, 300 + i * 150, 1));
    }
    g.renderer.draw(g);
    step(g, 0.3);
    g.renderer.draw(g);
    // Susto e fuga com o urso correndo atrás
    g.player.invuln = 0;
    g.player.x = 600;
    g.bear.x = 650;
    step(g, 0.1);
    expect(g.player.state).toBe('flee');
    g.renderer.draw(g);
    step(g, 0.6);
    g.renderer.draw(g);
  });
});
