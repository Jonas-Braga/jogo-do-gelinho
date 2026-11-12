// Prêmios das fases especiais: em toda fase especial passam, um de cada vez e em
// ordem sorteada, 3 sacos de dinheiro (1.500 pontos cada) e 2 corações (+1 vida
// cada). Pegam-se como os peixes. O título das fases não muda.
import { suite, test, expect } from '../harness.js';
import { makeGame, step } from '../helpers.js';
import { SPECIALS } from '../../src/specials.js';
import { levelIntro } from '../../src/levels.js';
import { SIZE } from '../../src/enemies.js';
import { BONUS, BONUS_KINDS, BAG_GOLD, HEART_RED, drawMoneyBag, drawHeart } from '../../src/bonus.js';
import { RULES, W } from '../../src/config.js';

const LEVELS = Object.keys(SPECIALS).map(Number);

function recordingCtx() {
  const colors = new Set();
  const texts = [];
  const gradient = { addColorStop: (_o, c) => colors.add(String(c)) };
  const store = {
    measureText: (s) => ({ width: String(s).length * 7 }),
    fillText: (s) => texts.push(String(s)),
  };
  const ctx = new Proxy(store, {
    get(t, k) {
      return k in t ? t[k] : () => gradient;
    },
    set(t, k, v) {
      if (k === 'fillStyle' || k === 'strokeStyle') colors.add(String(v));
      t[k] = v;
      return true;
    },
  });
  return { ctx, colors, texts };
}

// Fase com os prêmios ligados, mas sem bichos nem urso
function bonusGame(level) {
  const g = makeGame({ level, quiet: false });
  g.critters.list = [];
  g.critters.timers = g.critters.timers.map(() => Infinity);
  g.bear.active = false;
  return g;
}

// Registra cada prêmio solto (tipo e instante)
function watchSpawns(g) {
  const log = [];
  const orig = g.critters.spawnBonus.bind(g.critters);
  g.critters.spawnBonus = () => {
    const ok = orig();
    if (ok) log.push({ kind: g.critters.list[g.critters.list.length - 1].kind, t: g.time });
    return ok;
  };
  return log;
}

// Coloca o jogador de pé na fileira e um prêmio encostando nele
function touch(g, kind) {
  const p = g.player;
  p.state = 'stand';
  p.row = 2;
  p.x = 600;
  g.critters.list = [{ kind, row: 2, dir: 1, vx: 0, x: 600, w: SIZE[kind], ph: 0, bonus: true }];
  g.critters.update(1 / 120);
}

suite('Fases especiais · prêmios (sacos de dinheiro e corações)', () => {
  test('regra: 3 sacos de 1.500 pontos e 2 corações por fase especial', () => {
    expect(BONUS.bags).toBe(3);
    expect(BONUS.hearts).toBe(2);
    expect(BONUS.bagPoints).toBe(1500);
  });

  test('toda fase especial prepara os 5 prêmios; fases normais, nenhum', () => {
    for (const lv of LEVELS) {
      const q = makeGame({ level: lv, quiet: false }).critters.bonusQueue;
      expect(q.length, `fase ${lv}`).toBe(5);
      expect(q.filter((k) => k === 'bag').length).toBe(3);
      expect(q.filter((k) => k === 'heart').length).toBe(2);
    }
    for (const lv of [1, 4, 6, 24]) {
      expect(makeGame({ level: lv, quiet: false }).critters.bonusQueue.length, `fase ${lv}`).toBe(0);
    }
  });

  test('passam todos, um de cada vez, com intervalo entre eles', () => {
    const g = bonusGame(5);
    const log = watchSpawns(g);
    step(g, BONUS.first + 5 * BONUS.gapMax + 2);
    expect(log.length).toBe(5);
    expect(log.filter((e) => e.kind === 'bag').length).toBe(3);
    expect(log.filter((e) => e.kind === 'heart').length).toBe(2);
    expect(log[0].t).toBeGreaterThanOrEqual(BONUS.first - 0.01);
    for (let i = 1; i < log.length; i++) {
      expect(log[i].t - log[i - 1].t, `prêmio ${i}`).toBeGreaterThanOrEqual(BONUS.gapMin - 0.01);
    }
  });

  test('a ordem dos prêmios é sorteada', () => {
    const orders = new Set();
    for (let i = 0; i < 30; i++) orders.add(makeGame({ level: 5, quiet: false }).critters.bonusQueue.join());
    expect(orders.size).toBeGreaterThan(1);
  });

  test('o prêmio entra numa fileira com a entrada livre, contra o fluxo, na velocidade dos bichos', () => {
    const g = bonusGame(10);
    // Fileira 0: bicho esperando na entrada; fileira 1: bicho já lá na frente
    const entry = (r) => (-g.rows[r].dir > 0 ? -60 : W + 60);
    const ahead = (r) => (-g.rows[r].dir > 0 ? W - 100 : 100);
    const enemies = [
      { kind: 'snake', row: 0, dir: -g.rows[0].dir, vx: 0, x: entry(0), w: 40, ph: 0 },
      { kind: 'snake', row: 1, dir: -g.rows[1].dir, vx: 0, x: ahead(1), w: 40, ph: 0 },
    ];
    const rows = new Set();
    for (let i = 0; i < 40; i++) {
      g.critters.list = [...enemies];
      g.critters.bonusQueue = ['bag'];
      expect(g.critters.spawnBonus()).toBe(true);
      const b = g.critters.list.find((c) => c.bonus);
      rows.add(b.row);
      expect(b.row, 'nunca com bicho na entrada').not.toBe(0);
      expect(b.dir).toBe(-g.rows[b.row].dir);
      expect(Math.abs(b.vx)).toBeCloseTo(g.params.enemySpeed * BONUS.speed);
      expect(b.x < 0 || b.x > W).toBe(true);
    }
    expect(rows.has(1), 'pode dividir a fileira com bichos lá na frente').toBe(true);
    // Com todas as entradas ocupadas, espera e tenta de novo
    g.critters.list = [0, 1, 2, 3].map((r) => ({ kind: 'snake', row: r, dir: -g.rows[r].dir, vx: 0, x: entry(r), w: 40, ph: 0 }));
    g.critters.bonusQueue = ['bag'];
    expect(g.critters.spawnBonus()).toBe(false);
    expect(g.critters.bonusQueue).toEqual(['bag']);
  });

  test('com os bichos passando de verdade, os 5 prêmios aparecem em até 35 s', () => {
    for (const lv of [5, 10, 15, 20, 25]) {
      for (let run = 0; run < 4; run++) {
        const g = makeGame({ level: lv, quiet: false });
        g.bear.active = false;
        const log = watchSpawns(g);
        for (let i = 0; i < 35 * 120; i++) {
          g.update(1 / 120);
          g.temp = RULES.tempStart; // o jogador fica parado na costa: não deixa congelar
        }
        expect(log.length, `fase ${lv}, rodada ${run}`).toBe(5);
      }
    }
  });

  test('pegar o saco de dinheiro: +1.500 pontos, "+1500" e som de moedas', () => {
    const g = bonusGame(5);
    const before = g.score;
    touch(g, 'bag');
    expect(g.score - before).toBe(1500);
    expect(g.critters.list[0].dead).toBe(true);
    expect(g.particles.texts.some((x) => x.str === '+1500')).toBe(true);
    expect(g.sfx.history).toContain('coins');
  });

  test('pegar o coração: +1 vida, "+1 VIDA" e som de vida', () => {
    const g = bonusGame(15);
    const lives = g.lives;
    const score = g.score;
    touch(g, 'heart');
    expect(g.lives).toBe(lives + 1);
    expect(g.score).toBe(score);
    expect(g.particles.texts.some((x) => x.str === '+1 VIDA')).toBe(true);
    expect(g.sfx.history).toContain('life');
  });

  test('os sacos também contam para a vida extra a cada 5.000 pontos', () => {
    const g = bonusGame(20);
    g.score = RULES.extraLifeEvery - 100;
    g.nextLife = RULES.extraLifeEvery;
    const lives = g.lives;
    touch(g, 'bag');
    expect(g.lives).toBe(lives + 1);
  });

  test('prêmio não empurra o jogador', () => {
    const g = bonusGame(5);
    const p = g.player;
    p.state = 'stand';
    p.row = 1;
    p.x = 600;
    g.critters.list = [{ kind: 'bag', row: 1, dir: 1, vx: 0, x: 590, w: SIZE.bag, ph: 0, bonus: true }];
    g.critters.update(1 / 120);
    expect(p.x).toBe(600);
  });

  test('só pega quem está de pé na fileira (na costa ou pulando, o prêmio passa)', () => {
    const g = bonusGame(5);
    const p = g.player;
    for (const setup of [() => { p.row = -1; p.state = 'stand'; }, () => { p.row = 2; p.state = 'jump'; }]) {
      setup();
      p.x = 600;
      g.critters.list = [{ kind: 'bag', row: 2, dir: 1, vx: 0, x: 600, w: SIZE.bag, ph: 0, bonus: true }];
      const before = g.score;
      g.critters.update(1 / 120);
      expect(g.score).toBe(before);
      expect(g.critters.list[0].dead).toBe(undefined);
    }
  });

  test('prêmio que ninguém pega vai embora e não volta', () => {
    const g = bonusGame(25);
    const log = watchSpawns(g);
    step(g, 60);
    expect(log.length).toBe(5);
    expect(g.critters.bonusQueue.length).toBe(0);
    expect(g.critters.list.some((c) => c.bonus)).toBe(false);
  });

  test('o título das fases especiais não muda', () => {
    expect(levelIntro(5).title).toBe('FASE 5 · ESPECIAL DE NATAL');
    expect(levelIntro(25).title).toBe('FASE 25 · ESPECIAL DE HALLOWEEN');
    for (const lv of LEVELS) expect(levelIntro(lv).title.includes('BÔNUS'), `fase ${lv}`).toBe(false);
  });

  test('saco e coração desenhados nos dois sentidos, com as suas cores', () => {
    for (const [draw, color] of [[drawMoneyBag, BAG_GOLD], [drawHeart, HEART_RED]]) {
      for (const dir of [1, -1]) {
        const rec = recordingCtx();
        draw(rec.ctx, { x: 300, dir, ph: 1 }, 450, 2.3);
        expect(rec.colors.has(color)).toBe(true);
      }
    }
    const rec = recordingCtx();
    drawMoneyBag(rec.ctx, { x: 0, dir: 1, ph: 0 }, 400, 1);
    expect(rec.texts).toContain('$');
  });

  test('os prêmios aparecem no desenho de todas as fases especiais', () => {
    for (const lv of LEVELS) {
      const g = bonusGame(lv);
      g.critters.list = BONUS_KINDS.map((kind, i) => ({ kind, row: i, dir: 1, vx: 0, x: 500, w: SIZE[kind], ph: 0, bonus: true }));
      const rec = recordingCtx();
      g.renderer.ctx = rec.ctx;
      g.renderer.draw(g);
      expect(rec.colors.has(BAG_GOLD), `saco na fase ${lv}`).toBe(true);
      expect(rec.colors.has(HEART_RED), `coração na fase ${lv}`).toBe(true);
    }
  });

  test('há um som de moedas', () => {
    const g = makeGame();
    g.sfx.play('coins');
    expect(g.sfx.history).toContain('coins');
  });
});
