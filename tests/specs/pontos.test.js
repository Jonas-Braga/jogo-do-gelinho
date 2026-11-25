// Sistema de pontos revisto (pedido do usuário, para as vidas extras não sobrarem
// nas fases avançadas): placa vale 10..100 e recomeça em 10 a cada 10 fases; o
// chute da chuteira vale metade do peixe; e, da fase 11 em diante (fora as
// especiais), passam até 2 canecas de chocolate quente que esquentam 10°.
import { suite, test, expect } from '../harness.js';
import { makeGame, stepUntil } from '../helpers.js';
import { SPECIALS } from '../../src/specials.js';
import { levelParams, floePoints, FLOE_POINTS_MAX } from '../../src/levels.js';
import { SIZE } from '../../src/enemies.js';
import { POWERS } from '../../src/powers.js';
import { HEAT, HEAT_KINDS, heatFor, drawCocoa } from '../../src/heat.js';
import { SOUNDS } from '../../src/audio.js';
import { RULES, W } from '../../src/config.js';

const SPECIAL_LEVELS = Object.keys(SPECIALS).map(Number);

// Fase com os itens ligados, sem bichos nem urso
function itemGame(level) {
  const g = makeGame({ level, quiet: false });
  g.critters.list = [];
  g.critters.timers = g.critters.timers.map(() => Infinity);
  g.critters.powerQueue = [];
  g.bear.active = false;
  return g;
}

function watchHeat(g) {
  const log = [];
  const orig = g.critters.spawnHeat.bind(g.critters);
  g.critters.spawnHeat = () => {
    const ok = orig();
    if (ok) log.push({ t: g.time, c: g.critters.list[g.critters.list.length - 1] });
    return ok;
  };
  return log;
}

function touch(g, kind) {
  const p = g.player;
  p.state = 'stand';
  p.row = 2;
  p.x = 600;
  const c = { kind, row: 2, dir: 1, vx: 0, x: 600, w: SIZE[kind], ph: 0 };
  g.critters.list = [c];
  g.critters.update(1 / 120);
  return c;
}

suite('Pontos: placa e grau de 10 a 100, recomeçando a cada 10 fases', () => {
  test('a placa vale 10 × fase até a fase 10 e depois recomeça em 10', () => {
    const expected = { 1: 10, 2: 20, 9: 90, 10: 100, 11: 10, 12: 20, 19: 90, 20: 100, 21: 10, 29: 90, 30: 100, 31: 10, 47: 70, 100: 100, 101: 10 };
    for (const [lv, pts] of Object.entries(expected)) {
      expect(levelParams(Number(lv)).floePoints, `fase ${lv}`).toBe(pts);
    }
  });

  test('nunca passa de 100 e sempre é múltiplo de 10', () => {
    expect(FLOE_POINTS_MAX).toBe(100);
    for (let lv = 1; lv <= 200; lv++) {
      const p = floePoints(lv);
      expect(p, `fase ${lv}`).toBeGreaterThanOrEqual(10);
      expect(p, `fase ${lv}`).toBeLessThanOrEqual(100);
      expect(p % 10, `fase ${lv}`).toBe(0);
      // depois de 100, a fase seguinte volta a 10
      if (p === 100) expect(floePoints(lv + 1), `fase ${lv + 1}`).toBe(10);
    }
  });

  test('o grau de bônus segue o mesmo ciclo de 10 a 100', () => {
    for (const [lv, pts] of [[1, 10], [10, 100], [11, 10], [25, 50], [30, 100], [31, 10]]) {
      expect(levelParams(lv).degreePoints, `fase ${lv}`).toBe(pts);
    }
  });

  test('acender uma fileira numa fase avançada dá os pontos do ciclo', () => {
    for (const [lv, pts] of [[13, 30], [27, 70], [40, 100]]) {
      const g = makeGame({ level: lv });
      g.onLand(1);
      expect(g.score, `fase ${lv}`).toBe(pts);
      expect(g.particles.texts.some((x) => x.str === `+${pts}`), `fase ${lv}`).toBe(true);
    }
  });
});

suite('Pontos: chute da chuteira vale metade do peixe', () => {
  test('o chute vale 50% do peixe em qualquer fase (não cresce com a fase)', () => {
    expect(POWERS.kickShare).toBe(0.5);
    for (const lv of [11, 24, 57]) {
      const g = makeGame({ level: lv });
      g.player.givePower('boot');
      touch(g, 'crab');
      expect(g.score, `fase ${lv}`).toBe(levelParams(lv).fishPoints / 2);
      expect(g.score, `fase ${lv}`).toBe(50);
    }
  });
});

suite('Chocolate quente: +10° (fases normais a partir da 11)', () => {
  test('passa da fase 11 em diante, até 2 por fase; antes da 11 e nas especiais não', () => {
    expect(HEAT.from).toBe(11);
    expect(HEAT.count).toBe(2);
    for (const lv of [1, 6, 10]) expect(levelParams(lv).heat, `fase ${lv}`).toBe(0);
    for (const lv of [11, 12, 19, 21, 47]) expect(levelParams(lv).heat, `fase ${lv}`).toBe(2);
    for (const lv of SPECIAL_LEVELS) {
      expect(levelParams(lv).heat, `fase ${lv}`).toBe(0);
      expect(makeGame({ level: lv, quiet: false }).critters.heatQueue.length, `fase ${lv}`).toBe(0);
    }
    expect(heatFor(40, { id: 'qualquer' })).toBe(0);
  });

  test('passam exatamente 2 canecas por fase, separadas, e não voltam', () => {
    for (let i = 0; i < 4; i++) {
      const g = itemGame(14);
      const log = watchHeat(g);
      for (let k = 0; k < 90 * 120; k++) {
        g.update(1 / 120);
        g.temp = RULES.tempStart;
      }
      expect(log.length).toBe(2);
      expect(log[0].t).toBeGreaterThanOrEqual(HEAT.firstMin - 0.01);
      expect(log[0].t).toBeLessThan(HEAT.firstMax + 1);
      expect(log[1].t - log[0].t).toBeGreaterThanOrEqual(HEAT.gapMin - 0.01);
      for (const { c } of log) {
        expect(c.kind).toBe('cocoa');
        expect(c.dir).toBe(-g.rows[c.row].dir);
        expect(c.x < 0 || c.x > W).toBe(true);
      }
    }
  });

  test('com os bichos passando de verdade, as 2 canecas aparecem', () => {
    for (const lv of [11, 16]) {
      const g = makeGame({ level: lv, quiet: false });
      g.bear.active = false;
      const log = watchHeat(g);
      for (let k = 0; k < 90 * 120; k++) {
        g.update(1 / 120);
        g.temp = RULES.tempStart;
      }
      expect(log.length, `fase ${lv}`).toBe(2);
    }
  });

  test('pegar a caneca esquenta 10°, com aviso "+10°" e som', () => {
    const g = itemGame(12);
    g.temp = 20;
    const c = touch(g, 'cocoa');
    expect(HEAT_KINDS).toContain('cocoa');
    expect(c.dead).toBe(true);
    expect(g.temp).toBe(30);
    expect(g.particles.texts.some((x) => x.str === '+10°')).toBe(true);
    expect(g.sfx.history).toContain('heat');
    expect(g.player.state).toBe('stand'); // não empurra
  });

  test('não passa da temperatura inicial (45°)', () => {
    const g = itemGame(12);
    g.temp = 41;
    touch(g, 'cocoa');
    expect(g.temp).toBe(RULES.tempStart);
    expect(g.particles.texts.some((x) => x.str === '+4°')).toBe(true);
  });

  test('os graus ganhos viram bônus de temperatura no fim da fase', () => {
    const g = itemGame(12);
    g.temp = 15;
    touch(g, 'cocoa');
    expect(g.temp).toBe(25);
    const before = g.score;
    g.player.state = 'gone'; // já dentro do iglu (senão a fileira o leva para a água)
    g.state = 'levelEnd';
    g.bonusTimer = 0;
    g.bonusTotal = 0;
    g.bonusDone = false;
    stepUntil(g, () => g.bonusDone, 30);
    expect(g.bonusTotal).toBe(25 * levelParams(12).degreePoints);
    expect(g.score - before).toBe(25 * levelParams(12).degreePoints);
  });

  test('existe o som e o desenho da caneca (2D) funciona virada para os dois lados', () => {
    expect(typeof SOUNDS.heat).toBe('function');
    const calls = [];
    const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (...a) => { calls.push(k); return { addColorStop() {} }; }), set: (t, k, v) => { t[k] = v; return true; } });
    for (const dir of [1, -1]) drawCocoa(ctx, { x: 300, dir, ph: 0 }, 400, 1.2);
    expect(calls.includes('fill')).toBe(true);
  });
});
