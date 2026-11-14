// Poderes do personagem (fases normais a partir da 6): a boia de patinho deixa
// pular na água e voltar para o gelo por 5 s; a chuteira dourada (fase 11 em
// diante) deixa imune por 5 s e chuta para longe quem encostar. Cada item passa
// uma única vez por fase. Fases especiais não têm poderes.
import { suite, test, expect } from '../harness.js';
import { makeGame, step, stepUntil, hold, release, placeOnFloe, centerRow, centralRect } from '../helpers.js';
import { SPECIALS } from '../../src/specials.js';
import { levelParams, levelIntro } from '../../src/levels.js';
import { SIZE } from '../../src/enemies.js';
import {
  POWERS, POWER_KINDS, powersFor, DUCK_YELLOW, BOOT_GOLD, drawDuckFloat, drawGoldenBoot,
} from '../../src/powers.js';
import { RULES, W, SHORE_Y, ROW_Y, PLAYER } from '../../src/config.js';

const SPECIAL_LEVELS = Object.keys(SPECIALS).map(Number);

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

// Fase com os itens de poder ligados, mas sem bichos nem urso
function powerGame(level) {
  const g = makeGame({ level, quiet: false });
  g.critters.list = [];
  g.critters.timers = g.critters.timers.map(() => Infinity);
  g.bear.active = false;
  return g;
}

function watchSpawns(g) {
  const log = [];
  const orig = g.critters.spawnPower.bind(g.critters);
  g.critters.spawnPower = () => {
    const ok = orig();
    if (ok) log.push({ kind: g.critters.list[g.critters.list.length - 1].kind, t: g.time });
    return ok;
  };
  return log;
}

// Coloca o jogador de pé na fileira 2 com um bicho/item encostando nele
function touch(g, kind, dx = 0) {
  const p = g.player;
  p.state = 'stand';
  p.row = 2;
  p.x = 600;
  const c = { kind, row: 2, dir: 1, vx: 0, x: 600 + dx, w: SIZE[kind], ph: 0 };
  g.critters.list = [c];
  g.critters.update(1 / 120);
  return c;
}

// Meio do maior vão sem placa da fileira, dentro da tela
function waterGap(g, row) {
  centerRow(g, row);
  const rects = [...g.rows[row].rects()].sort((a, b) => a.x - b.x);
  // meio do maior vão entre placas dentro da tela
  let best = null;
  for (let i = 0; i + 1 < rects.length; i++) {
    const a = rects[i].x + rects[i].w;
    const b = rects[i + 1].x;
    const mid = (a + b) / 2;
    if (mid > 100 && mid < W - 100 && (!best || b - a > best.gap)) best = { gap: b - a, mid };
  }
  return best.mid;
}

// Jogador boiando com a boia num trecho de água sem placa da fileira
function floatInWater(g, row = 1) {
  const p = g.player;
  p.givePower('duck');
  p.state = 'stand';
  p.row = row;
  p.y = ROW_Y[row];
  p.x = waterGap(g, row);
  p.support = null;
  p.fall();
}

suite('Poderes · boia de patinho e chuteira dourada', () => {
  test('regra: os poderes duram 5 s, a boia começa na fase 6 e a chuteira na fase 11', () => {
    expect(POWERS.duration).toBe(5);
    expect(POWERS.from).toBe(6);
    expect(POWERS.bootFrom).toBe(11);
    expect(POWER_KINDS).toEqual(['duck', 'boot']);
  });

  test('fases 1 a 5 não têm poderes; fases 6 a 9 têm só a boia', () => {
    for (const lv of [1, 2, 3, 4, 5]) expect(levelParams(lv).powers, `fase ${lv}`).toEqual([]);
    for (const lv of [6, 7, 8, 9]) expect(levelParams(lv).powers, `fase ${lv}`).toEqual(['duck']);
  });

  test('da fase 11 em diante (fora as especiais) há uma boia e uma chuteira', () => {
    for (const lv of [11, 12, 13, 14, 16, 19, 21, 24, 26, 29, 31, 47]) {
      expect([...levelParams(lv).powers].sort(), `fase ${lv}`).toEqual(['boot', 'duck']);
    }
  });

  test('fases especiais nunca têm poderes', () => {
    for (const lv of SPECIAL_LEVELS) {
      expect(levelParams(lv).powers, `fase ${lv}`).toEqual([]);
      expect(makeGame({ level: lv, quiet: false }).critters.powerQueue.length, `fase ${lv}`).toBe(0);
    }
    expect(powersFor(30, { id: 'qualquer' })).toEqual([]);
  });

  test('cada item passa uma única vez por fase', () => {
    const g = powerGame(7);
    const log = watchSpawns(g);
    step(g, 90);
    expect(log.map((e) => e.kind)).toEqual(['duck']);
    expect(g.critters.powerQueue.length).toBe(0);
    const g2 = powerGame(12);
    const log2 = watchSpawns(g2);
    step(g2, 90);
    expect(log2.map((e) => e.kind).sort()).toEqual(['boot', 'duck']);
  });

  test('o primeiro item aparece entre 8 e 25 s; o segundo vem depois, nunca junto', () => {
    for (let i = 0; i < 6; i++) {
      const g = powerGame(11);
      const log = watchSpawns(g);
      step(g, 60);
      expect(log.length).toBe(2);
      expect(log[0].t).toBeGreaterThanOrEqual(POWERS.firstMin - 0.01);
      expect(log[0].t).toBeLessThan(POWERS.firstMax + 1);
      expect(log[1].t - log[0].t).toBeGreaterThanOrEqual(POWERS.gapMin - 0.01);
    }
  });

  test('na fase 11 em diante a ordem dos itens é sorteada', () => {
    const orders = new Set();
    for (let i = 0; i < 40; i++) orders.add(makeGame({ level: 11, quiet: false }).critters.powerQueue.join());
    expect(orders.size).toBe(2);
  });

  test('o item entra contra o fluxo, na velocidade dos bichos, numa fileira com a entrada livre', () => {
    const g = powerGame(8);
    const entry = (r) => (-g.rows[r].dir > 0 ? -60 : W + 60);
    for (let i = 0; i < 30; i++) {
      g.critters.list = [{ kind: 'crab', row: 0, dir: -g.rows[0].dir, vx: 0, x: entry(0), w: 40, ph: 0 }];
      g.critters.powerQueue = ['duck'];
      expect(g.critters.spawnPower()).toBe(true);
      const b = g.critters.list.find((c) => c.power);
      expect(b.row).not.toBe(0);
      expect(b.dir).toBe(-g.rows[b.row].dir);
      expect(Math.abs(b.vx)).toBeCloseTo(g.params.enemySpeed);
      expect(b.x < 0 || b.x > W).toBe(true);
    }
  });

  test('com os bichos passando de verdade, os itens aparecem em até 60 s', () => {
    for (const lv of [6, 9, 11, 14]) {
      for (let run = 0; run < 3; run++) {
        const g = makeGame({ level: lv, quiet: false });
        g.bear.active = false;
        const log = watchSpawns(g);
        for (let i = 0; i < 60 * 120; i++) {
          g.update(1 / 120);
          g.temp = RULES.tempStart;
        }
        expect(log.length, `fase ${lv}, rodada ${run}`).toBe(levelParams(lv).powers.length);
      }
    }
  });

  test('item que ninguém pega vai embora; perder uma vida não traz o item de volta', () => {
    const g = powerGame(6);
    const log = watchSpawns(g);
    step(g, 50);
    expect(log.length).toBe(1);
    expect(g.critters.list.some((c) => c.power)).toBe(false);
    g.onPlayerLost();
    for (let i = 0; i < 40 * 120; i++) {
      g.update(1 / 120);
      g.temp = RULES.tempStart;
    }
    expect(log.length).toBe(1);
  });

  test('pegar a boia: poder por 5 s, aviso "BOIA! 5 s" e som', () => {
    const g = powerGame(6);
    const c = touch(g, 'duck');
    expect(c.dead).toBe(true);
    expect(g.player.power).toBe('duck');
    expect(g.player.powerT).toBeCloseTo(5);
    expect(g.particles.texts.some((x) => x.str === 'BOIA! 5 s')).toBe(true);
    expect(g.sfx.history).toContain('power');
  });

  test('só pega o item quem está de pé na fileira; o item não empurra', () => {
    const g = powerGame(6);
    const p = g.player;
    for (const setup of [() => { p.row = -1; p.state = 'stand'; }, () => { p.row = 2; p.state = 'jump'; }]) {
      setup();
      p.x = 600;
      g.critters.list = [{ kind: 'duck', row: 2, dir: 1, vx: 0, x: 600, w: SIZE.duck, ph: 0, power: true }];
      g.critters.update(1 / 120);
      expect(p.power).toBe(null);
    }
    p.state = 'stand';
    p.row = 2;
    g.critters.list = [{ kind: 'duck', row: 2, dir: 1, vx: 0, x: 590, w: SIZE.duck, ph: 0, power: true }];
    g.critters.update(1 / 120);
    expect(p.x).toBe(600);
  });

  test('sem a boia, cair na água continua custando uma vida', () => {
    const g = makeGame({ level: 6 });
    const lives = g.lives;
    placeOnFloe(g, 1);
    g.player.fall();
    expect(g.player.state).toBe('drown');
    stepUntil(g, () => g.lives < lives, 3);
    expect(g.lives).toBe(lives - 1);
  });

  test('com a boia, cair na água não afunda: ele boia (estado swim) com som próprio', () => {
    const g = makeGame({ level: 6 });
    const lives = g.lives;
    floatInWater(g);
    expect(g.player.state).toBe('swim');
    expect(g.player.anim).toBe('swim');
    expect(g.player.alive).toBe(true);
    expect(g.sfx.history).toContain('quack');
    step(g, 1);
    expect(g.player.state).toBe('swim');
    expect(g.lives).toBe(lives);
  });

  test('com a boia, pular da costa direto na água também não afunda', () => {
    const g = makeGame({ level: 6 });
    const p = g.player;
    p.givePower('duck');
    // mira num vão da fileira 0 parada
    g.rows[0].speed = 0;
    p.x = waterGap(g, 0);
    hold(g, 'down');
    stepUntil(g, () => p.state === 'jump', 0.3);
    release(g, 'down');
    stepUntil(g, () => p.state !== 'jump', PLAYER.jumpTime + 0.1);
    expect(p.state).toBe('swim');
    expect(p.row).toBe(0);
  });

  test('boiando ele não é levado pela correnteza e nada devagar para os lados', () => {
    const g = makeGame({ level: 6 });
    const p = g.player;
    floatInWater(g);
    for (const r of g.rows) r.speed = 0; // nenhuma placa chega até ele
    const x0 = p.x;
    step(g, 0.5);
    expect(p.x).toBe(x0);
    hold(g, 'left');
    step(g, 0.2);
    release(g, 'left');
    expect(Math.round(x0 - p.x)).toBe(Math.round(POWERS.swimSpeed * 0.2));
    expect(POWERS.swimSpeed).toBeLessThan(PLAYER.walkSpeed);
  });

  test('da água ele pula para o gelo, e o pouso acende a fileira', () => {
    const g = makeGame({ level: 6 });
    const p = g.player;
    floatInWater(g, 1);
    for (const r of g.rows) r.speed = 0;
    // alinha uma placa da fileira 2 embaixo dele
    centerRow(g, 2);
    const r2 = centralRect(g, 2, p.x);
    g.rows[2].offset += p.x - (r2.x + r2.w / 2);
    const count = g.igloo.count;
    hold(g, 'down');
    stepUntil(g, () => p.state === 'jump', 0.3);
    release(g, 'down');
    stepUntil(g, () => p.state !== 'jump', PLAYER.jumpTime + 0.1);
    expect(p.state).toBe('stand');
    expect(p.row).toBe(2);
    expect(g.rows[2].active).toBe(true);
    expect(g.igloo.count).toBe(count + 1);
  });

  test('da água da primeira fileira ele pula de volta para a costa', () => {
    const g = makeGame({ level: 6 });
    const p = g.player;
    floatInWater(g, 0);
    for (const r of g.rows) r.speed = 0;
    hold(g, 'up');
    stepUntil(g, () => p.state === 'jump', 0.3);
    release(g, 'up');
    stepUntil(g, () => p.state !== 'jump', PLAYER.jumpTime + 0.1);
    expect(p.state).toBe('stand');
    expect(p.row).toBe(-1);
    expect(p.y).toBe(SHORE_Y);
  });

  test('placa que passa por ele na água: ele sobe nela', () => {
    const g = makeGame({ level: 6 });
    const p = g.player;
    floatInWater(g, 1);
    stepUntil(g, () => p.state !== 'swim', 4.5);
    expect(p.state).toBe('stand');
    expect(p.row).toBe(1);
    expect(g.rows[1].active).toBe(true);
  });

  test('o tempo da boia acaba com ele na água: afunda e perde a vida', () => {
    const g = makeGame({ level: 6 });
    const p = g.player;
    const lives = g.lives;
    floatInWater(g);
    for (const r of g.rows) r.speed = 0;
    step(g, POWERS.duration - 0.2);
    expect(p.state).toBe('swim');
    step(g, 0.3);
    expect(p.state).toBe('drown');
    expect(p.power).toBe(null);
    stepUntil(g, () => g.lives < lives, 3);
    expect(g.lives).toBe(lives - 1);
  });

  test('nos últimos 1,5 s o poder avisa que está acabando (pisca e apita)', () => {
    const g = makeGame({ level: 6 });
    const p = g.player;
    p.givePower('duck');
    step(g, POWERS.duration - POWERS.warn - 0.2);
    expect(p.powerEnding).toBe(false);
    expect(g.sfx.history.includes('warn')).toBe(false);
    step(g, 0.4);
    expect(p.powerEnding).toBe(true);
    expect(g.sfx.history).toContain('warn');
    step(g, POWERS.warn);
    expect(p.power).toBe(null);
  });

  test('a temperatura continua caindo com a boia; congelar boiando afunda', () => {
    const g = makeGame({ level: 6 });
    floatInWater(g);
    for (const r of g.rows) r.speed = 0;
    const t0 = g.temp;
    step(g, 2.1);
    expect(g.temp).toBe(t0 - 2);
    g.temp = 0;
    step(g, 0.05);
    expect(g.player.state).toBe('drown');
  });

  test('boiando, os bichos não empurram o personagem', () => {
    const g = makeGame({ level: 6 });
    const p = g.player;
    floatInWater(g, 1);
    for (const r of g.rows) r.speed = 0;
    const x0 = p.x;
    g.critters.list = [{ kind: 'crab', row: 1, dir: 1, vx: 0, x: x0 - 10, w: SIZE.crab, ph: 0 }];
    g.critters.update(1 / 120);
    expect(p.x).toBe(x0);
  });

  test('pegar a chuteira: poder por 5 s, aviso "CHUTEIRA! 5 s"', () => {
    const g = powerGame(11);
    touch(g, 'boot');
    expect(g.player.power).toBe('boot');
    expect(g.player.powerT).toBeCloseTo(5);
    expect(g.particles.texts.some((x) => x.str === 'CHUTEIRA! 5 s')).toBe(true);
  });

  test('com a chuteira, o bicho que encosta leva um chute: não empurra e voa longe', () => {
    const g = makeGame({ level: 11 });
    const p = g.player;
    p.givePower('boot');
    const c = touch(g, 'crab', -20);
    expect(p.x).toBe(600);
    expect(c.kicked).toBe(true);
    expect(c.vx).toBeLessThan(0); // para longe do jogador
    expect(p.facing).toBe(-1);    // vira para o bicho
    expect(p.anim).toBe('kick');
    expect(g.sfx.history).toContain('kick');
    const x0 = c.x;
    for (let i = 0; i < 30; i++) g.critters.update(1 / 120);
    expect(x0 - c.x).toBeGreaterThan(150);
    expect(c.fly).toBeLessThan(-40); // subiu
    step(g, 2);
    expect(g.critters.list.includes(c)).toBe(false);
  });

  test('cada bicho chutado vale 50 × fase, uma vez só', () => {
    const g = makeGame({ level: 12 });
    g.player.givePower('boot');
    const before = g.score;
    touch(g, 'goose', 15);
    expect(g.score - before).toBe(POWERS.kickPoints * 12);
    g.critters.update(1 / 120);
    g.critters.update(1 / 120);
    expect(g.score - before).toBe(600);
    expect(g.particles.texts.some((x) => x.str === '+600')).toBe(true);
  });

  test('sem a chuteira os bichos continuam empurrando; a chuteira não chuta peixe', () => {
    const g = makeGame({ level: 11 });
    const p = g.player;
    p.state = 'stand';
    p.row = 2;
    p.x = 600;
    const dir = -g.rows[2].dir; // os bichos andam contra o fluxo da fileira
    g.critters.list = [{ kind: 'crab', row: 2, dir, vx: 0, x: 600 - dir * 10, w: SIZE.crab, ph: 0 }];
    g.critters.update(1 / 120);
    expect((p.x - 600) * dir).toBeGreaterThan(0);
    expect(g.critters.list[0].kicked).toBe(undefined);
    p.givePower('boot');
    const before = g.score;
    const fish = touch(g, 'fish');
    expect(fish.kicked).toBe(undefined);
    expect(g.score - before).toBe(g.params.fishPoints);
  });

  test('com a chuteira, o urso não assusta: é jogado para longe e fica tonto por 2 s', () => {
    const g = makeGame({ level: 11 });
    const p = g.player;
    const lives = g.lives;
    p.invuln = 0;
    p.givePower('boot');
    g.bear.active = true;
    g.bear.x = p.x - 30;
    g.bear.dir = 1;
    step(g, 0.05);
    expect(p.state).toBe('stand');
    expect(g.bear.chasing).toBe(false);
    expect(g.bear.stun).toBeGreaterThan(1.8);
    expect(p.anim).toBe('kick');
    const d0 = Math.abs(g.bear.x - p.x);
    step(g, 1);
    expect(Math.abs(g.bear.x - p.x)).toBeGreaterThan(d0 + 80);
    expect(g.bear.x).toBeGreaterThan(0);
    expect(g.lives).toBe(lives);
    // Depois de tonto, volta ao normal
    p.endPower();
    p.row = 0; // fora do alcance do urso
    step(g, POWERS.bearStun);
    expect(g.bear.stun <= 0).toBe(true);
  });

  test('sem a chuteira o urso continua assustando o jogador', () => {
    const g = makeGame({ level: 11 });
    const p = g.player;
    p.invuln = 0;
    g.bear.active = true;
    g.bear.x = p.x - 30;
    step(g, 0.05);
    expect(p.state).toBe('flee');
  });

  test('a chuteira não salva da água', () => {
    const g = makeGame({ level: 11 });
    placeOnFloe(g, 1);
    g.player.givePower('boot');
    g.player.fall();
    expect(g.player.state).toBe('drown');
  });

  test('o poder acaba depois de 5 s, ao perder a vida, ao entrar no iglu e na fase seguinte', () => {
    const g = makeGame({ level: 11 });
    g.player.givePower('boot');
    step(g, POWERS.duration + 0.1);
    expect(g.player.power).toBe(null);
    g.player.givePower('duck');
    g.onPlayerLost();
    expect(g.player.power).toBe(null);
    g.player.givePower('boot');
    g.player.enter(g.igloo.doorX);
    expect(g.player.power).toBe(null);
    g.player.givePower('duck');
    g.level++;
    g.startLevel();
    expect(g.player.power).toBe(null);
  });

  test('pegar um poder com outro em uso troca o poder e recomeça os 5 s', () => {
    const g = powerGame(11);
    g.player.givePower('duck');
    step(g, 3);
    touch(g, 'boot');
    expect(g.player.power).toBe('boot');
    expect(g.player.powerT).toBeCloseTo(5);
  });

  test('o aviso das fases 6 e 11 apresenta a novidade', () => {
    expect(levelIntro(6).sub).toContain('boia');
    expect(levelIntro(11).sub).toContain('chuteira');
    expect(levelIntro(6).title).toBe('FASE 6');
  });

  test('boia e chuteira desenhadas nos dois sentidos, com as suas cores', () => {
    for (const [draw, color] of [[drawDuckFloat, DUCK_YELLOW], [drawGoldenBoot, BOOT_GOLD]]) {
      for (const dir of [1, -1]) {
        const rec = recordingCtx();
        draw(rec.ctx, { x: 300, dir, ph: 1 }, 450, 2.3);
        expect(rec.colors.has(color)).toBe(true);
      }
    }
  });

  test('o jogo desenha os itens, o personagem com cada poder, o bicho voando e o urso tonto', () => {
    const g = makeGame({ level: 11 });
    const p = g.player;
    g.critters.list = [
      { kind: 'duck', row: 0, dir: 1, vx: 0, x: 500, w: SIZE.duck, ph: 0, power: true },
      { kind: 'boot', row: 1, dir: -1, vx: 0, x: 500, w: SIZE.boot, ph: 0, power: true },
      { kind: 'crab', row: 2, dir: 1, vx: -900, vy: -300, fly: -60, spin: 2, kicked: true, x: 400, w: 40, ph: 0 },
    ];
    g.bear.active = true;
    g.bear.stun = 1;
    let rec = recordingCtx();
    g.renderer.ctx = rec.ctx;
    g.renderer.draw(g);
    expect(rec.colors.has(DUCK_YELLOW)).toBe(true);
    expect(rec.colors.has(BOOT_GOLD)).toBe(true);
    // Personagem com a boia (de pé, pulando e na água) e com a chuteira (chutando)
    g.critters.list = [];
    for (const setup of [
      () => { p.givePower('duck'); },
      () => { floatInWater(g); },
      () => { p.state = 'stand'; p.row = -1; p.y = SHORE_Y; p.givePower('boot'); p.kick(1); },
    ]) {
      setup();
      rec = recordingCtx();
      g.renderer.ctx = rec.ctx;
      g.renderer.draw(g);
      expect(rec.colors.has(p.power === 'duck' ? DUCK_YELLOW : BOOT_GOLD), p.power).toBe(true);
    }
  });

  test('o HUD mostra o poder em uso', () => {
    const g = makeGame({ level: 6 });
    let rec = recordingCtx();
    g.renderer.ctx = rec.ctx;
    g.renderer.draw(g);
    expect(rec.texts.includes('BOIA')).toBe(false);
    g.player.givePower('duck');
    rec = recordingCtx();
    g.renderer.ctx = rec.ctx;
    g.renderer.draw(g);
    expect(rec.texts).toContain('BOIA');
    g.player.givePower('boot');
    rec = recordingCtx();
    g.renderer.ctx = rec.ctx;
    g.renderer.draw(g);
    expect(rec.texts).toContain('CHUTEIRA');
  });

  test('há sons para pegar o poder, boiar, chutar e para o aviso do fim', () => {
    const g = makeGame();
    for (const n of ['power', 'quack', 'kick', 'warn']) {
      g.sfx.play(n);
      expect(g.sfx.history).toContain(n);
    }
  });
});
