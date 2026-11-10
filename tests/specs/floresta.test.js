// Fase especial 10: floresta (troncos no rio, cabana de madeira, cobras, morcegos e
// piranhas, lenhador, urso marrom e folhas caindo). Só o visual muda.
import { suite, test, expect } from '../harness.js';
import { makeGame, step, stepUntil, enterIgloo } from '../helpers.js';
import { specialFor } from '../../src/specials.js';
import { levelParams, levelIntro } from '../../src/levels.js';
import { SIZE } from '../../src/enemies.js';
import {
  CABIN_PIECES, CABIN_VENT, FOREST_TREES, drawSnake, drawBat, drawPiranha, logSprite,
} from '../../src/forest.js';
import { drawPlayer, drawBear, BEAR_FUR, PLAID_RED } from '../../src/sprites.js';
import { Sfx, MUSIC } from '../../src/audio.js';
import { W, RULES, IGLOO } from '../../src/config.js';
import { Game } from '../../src/game.js';
import { fakeCanvas } from '../env.js';

// Contexto 2D que registra as cores usadas e os textos escritos
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

function drawn(g) {
  const rec = recordingCtx();
  g.renderer.ctx = rec.ctx;
  g.renderer.draw(g);
  return rec;
}

const FOREST_ENEMIES = ['snake', 'bat', 'piranha'];

class FakeParam {
  setValueAtTime() {}
  linearRampToValueAtTime() {}
  exponentialRampToValueAtTime(v) {
    if (!(v > 0)) throw new Error('rampa exponencial precisa de valor > 0');
  }
}
class FakeNode {
  connect(n) {
    return n;
  }
}
class FakeAudioContext {
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 8000;
    this.state = 'running';
    this.destination = new FakeNode();
    this.voices = 0;
  }
  createGain() {
    return Object.assign(new FakeNode(), { gain: new FakeParam() });
  }
  createOscillator() {
    return Object.assign(new FakeNode(), { frequency: new FakeParam(), start: () => this.voices++, stop() {} });
  }
  createBiquadFilter() {
    return Object.assign(new FakeNode(), { frequency: new FakeParam(), Q: new FakeParam() });
  }
  createDynamicsCompressor() {
    return new FakeNode();
  }
  createBuffer(_c, len) {
    const d = new Float32Array(len);
    return { getChannelData: () => d };
  }
  createBufferSource() {
    return Object.assign(new FakeNode(), { start: () => this.voices++, stop() {} });
  }
}

suite('Fases especiais · Floresta (fase 10)', () => {
  test('fase 10 é a especial da floresta; 9 e 11 são normais', () => {
    expect(specialFor(10).id).toBe('floresta');
    expect(levelParams(10).special.id).toBe('floresta');
    expect(levelParams(9).special).toBe(null);
    expect(levelParams(11).special).toBe(null);
  });

  test('aviso de início anuncia a floresta e a cabana', () => {
    const intro = levelIntro(10);
    expect(intro.title).toContain('FLORESTA');
    expect(intro.sub).toContain('troncos');
    expect(intro.sub).toContain('cabana');
  });

  test('a floresta não muda a dificuldade da fase', () => {
    const p = levelParams(10);
    const before = levelParams(9);
    const after = levelParams(11);
    expect(p.speed).toBeGreaterThan(before.speed);
    expect(p.speed).toBeLessThan(after.speed);
    expect(p.fragmented, 'fase par: troncos em pedaços').toBe(true);
    expect(p.bear).toBe(true);
    expect(p.enemySpeed).toBeGreaterThanOrEqual(before.enemySpeed);
    expect(p.enemySpeed).toBeLessThanOrEqual(after.enemySpeed);
    expect(p.maxGroup).toBe(before.maxGroup);
    expect(p.fishChance).toBe(before.fishChance);
  });

  test('inimigos são cobras, morcegos e piranhas (os três aparecem)', () => {
    const g = makeGame({ level: 10, quiet: false });
    const seen = new Set();
    for (let i = 0; i < 300; i++) {
      g.critters.list = [];
      g.critters.spawn(i % 4);
      for (const c of g.critters.list) if (c.kind !== 'fish') seen.add(c.kind);
    }
    expect([...seen].sort()).toEqual([...FOREST_ENEMIES].sort());
  });

  test('fora da floresta continuam os bichos de sempre', () => {
    for (const level of [9, 11]) {
      const g = makeGame({ level, quiet: false });
      for (let i = 0; i < 60; i++) g.critters.spawn(i % 4);
      for (const c of g.critters.list) expect(FOREST_ENEMIES.includes(c.kind), `fase ${level}`).toBe(false);
    }
  });

  test('bichos da floresta têm o tamanho de colisão dos que substituem', () => {
    expect(SIZE.bat).toBe(SIZE.goose);
    expect(SIZE.snake).toBe(SIZE.crab);
    expect(SIZE.piranha).toBe(SIZE.clam);
  });

  test('cobras, morcegos e piranhas empurram o jogador como os outros bichos', () => {
    for (const kind of FOREST_ENEMIES) {
      const g = makeGame({ level: 10 });
      const p = g.player;
      p.state = 'stand';
      p.row = 1;
      p.x = 600;
      g.critters.list = [{ kind, row: 1, dir: -g.rows[1].dir, vx: 0, x: 0, w: SIZE[kind], ph: 0 }];
      const c = g.critters.list[0];
      c.x = p.x - c.dir * 10; // o bicho chega por trás do jogador, no sentido em que anda
      const x0 = p.x;
      g.critters.update(1 / 120);
      expect(p.x, kind).not.toBe(x0);
    }
  });

  test('cada tronco pulado acrescenta uma peça da cabana', () => {
    const g = makeGame({ level: 10 });
    expect(g.igloo.style).toBe('cabin');
    g.onLand(0);
    g.onLand(2);
    expect(g.igloo.count).toBe(2);
    g.onLand(2); // a mesma fileira já acesa não conta de novo
    expect(g.igloo.count).toBe(2);
  });

  test('a cabana tem 16 peças, com a porta por último e a chaminé soltando a fumaça', () => {
    expect(CABIN_PIECES.length).toBe(RULES.iglooPieces);
    expect(CABIN_PIECES[RULES.iglooPieces - 1].kind).toBe('door');
    expect(CABIN_PIECES.filter((p) => p.kind === 'log').length).toBe(6);
    expect(CABIN_PIECES.some((p) => p.kind === 'chimney')).toBe(true);
    const g = makeGame({ level: 10 });
    expect(g.igloo.ventPos).toEqual(CABIN_VENT);
    // As peças ficam na área da cabana, na costa
    for (let i = 0; i < RULES.iglooPieces; i++) {
      const w = g.igloo.pieceWorld(i);
      expect(Math.abs(w.x - IGLOO.x), `peça ${i}`).toBeLessThan(130);
      expect(w.y, `peça ${i}`).toBeLessThan(IGLOO.baseY + 1);
    }
  });

  test('a cabana aparece só na floresta; iglu nas outras fases e na tela inicial', () => {
    const g = makeGame({ level: 10 });
    g.level = 11;
    g.startLevel();
    expect(g.igloo.style).toBe('igloo');
    const t = new Game(fakeCanvas(), { title: true });
    expect(t.igloo.style).toBe('igloo');
  });

  test('HUD conta as peças da cabana na floresta', () => {
    const g = makeGame({ level: 10 });
    g.onLand(0);
    expect(drawn(g).texts).toContain('cabana 1/16');
    const n = makeGame({ level: 9 });
    expect(drawn(n).texts).toContain('iglu 0/16');
  });

  test('cabana pronta: o lenhador entra pela porta e a fase termina', () => {
    const g = makeGame({ level: 10 });
    while (!g.igloo.complete) g.igloo.add();
    step(g, 1);
    g.player.x = g.igloo.doorX;
    step(g, 0.1);
    enterIgloo(g);
    expect(g.state).toBe('entering');
    for (let i = 0; i < 40 && g.state === 'entering'; i++) {
      step(g, 0.1);
      drawn(g); // desenha a porta por cima dele enquanto entra
    }
    expect(g.state).toBe('levelEnd');
    expect(g.igloo.lit).toBe(true);
    stepUntil(g, () => g.particles.fx.some((f) => f.kind === 'smoke'), 2);
    const smoke = g.particles.fx.find((f) => f.kind === 'smoke');
    expect(Math.abs(smoke.x - CABIN_VENT.x)).toBeLessThan(10);
  });

  test('troncos no lugar das placas de gelo (e acesos na cor de mel)', () => {
    // Os sprites ficam em cache na própria peça: 'logOff'/'logOn' = tronco, 'off'/'on' = gelo
    const kinds = (g) => new Set(g.rows.flatMap((r) => r.pieces.flatMap((pc) => Object.keys(pc.sprites))));
    const f = makeGame({ level: 10 });
    f.rows[1].active = true;
    drawn(f);
    expect([...kinds(f)].sort()).toEqual(['logOff', 'logOn']);
    const n = makeGame({ level: 9 });
    drawn(n);
    expect(kinds(n).has('logOff')).toBe(false);
    // Tronco curto (fase par, em pedaços) também é desenhado
    const short = { w: 36, seed: 3, sprites: {} };
    expect(logSprite(short, true).w).toBeGreaterThan(36);
  });

  test('personagem vestido de lenhador só na floresta', () => {
    expect(drawn(makeGame({ level: 10 })).colors.has(PLAID_RED)).toBe(true);
    expect(drawn(makeGame({ level: 9 })).colors.has(PLAID_RED)).toBe(false);
  });

  test('roupa de lenhador em todas as poses (de costas, fugindo, pulando, afundando)', () => {
    const g = makeGame({ level: 10 });
    const p = g.player;
    const poses = [
      () => { p.back = true; },
      () => { p.back = false; p.state = 'flee'; p.moving = true; },
      () => { p.state = 'jump'; },
      () => { p.state = 'drown'; p.sinkLine = 400; },
      () => { p.state = 'freeze'; p.t = 0.5; },
    ];
    for (const [i, pose] of poses.entries()) {
      pose();
      const rec = recordingCtx();
      drawPlayer(rec.ctx, p, 1, 0, 0, 'lumberjack');
      expect(rec.colors.has(PLAID_RED) || rec.colors.has('#8E211C'), `pose ${i}`).toBe(true);
    }
  });

  test('urso marrom na floresta; polar nas outras fases', () => {
    const g = makeGame({ level: 10, quiet: false });
    expect(g.bear.active).toBe(true);
    expect(drawn(g).colors.has(BEAR_FUR.brown.legFront)).toBe(true);
    const n = makeGame({ level: 9, quiet: false });
    const c = drawn(n).colors;
    expect(c.has(BEAR_FUR.brown.legFront)).toBe(false);
    expect(c.has(BEAR_FUR.polar.legFront)).toBe(true);
  });

  test('folhas caindo no lugar da neve e sem aurora boreal', () => {
    const g = makeGame({ level: 10 });
    expect(g.particles.leaves).toBe(true);
    drawn(g);
    expect(g.renderer.aurora).toBe(0);
    g.level = 11;
    g.startLevel();
    expect(g.particles.leaves).toBe(false);
    drawn(g);
    expect(g.renderer.aurora).toBeGreaterThan(0);
  });

  test('pinheiros da costa ficam longe da cabana', () => {
    for (const tr of FOREST_TREES) expect(tr.x).toBeLessThan(W / 3);
  });

  test('cobra, morcego e piranha são desenhados nos dois sentidos', () => {
    for (const draw of [drawSnake, drawBat, drawPiranha]) {
      for (const dir of [1, -1]) {
        const rec = recordingCtx();
        draw(rec.ctx, { x: 300, dir, ph: 1 }, 450, 2.3);
        expect(rec.colors.size).toBeGreaterThan(3);
      }
    }
  });

  test('cada bicho da floresta tem o seu som ao empurrar', () => {
    const s = new Sfx();
    s.setMuted(false);
    s.unlock(FakeAudioContext);
    for (const kind of FOREST_ENEMIES) {
      const before = s.ctx.voices;
      s.play('bump', { kind });
      expect(s.ctx.voices, kind).toBeGreaterThan(before);
    }
  });

  test('a floresta toca a sua própria trilha (e não tem trenó)', () => {
    const g = makeGame({ level: 10 });
    expect(g.sfx.track).toBe('floresta');
    for (let i = 0; i < 30 * 120; i++) g.update(1 / 120);
    expect(g.sleigh.active).toBe(false);
    expect(g.sfx.musicNotes).toBeGreaterThan(100);
    g.level = 11;
    g.startLevel();
    expect(g.sfx.track).toBe(null);
  });

  test('trilha da floresta: 16 compassos com violão, flauta, bloco de madeira e passarinhos', () => {
    const m = MUSIC.floresta;
    expect(m.length).toBe(64);
    expect(m.length * m.beat).toBeGreaterThan(20); // volta longa, não cansa
    // A melodia cabe exatamente nos 16 compassos
    const last = m.events[m.events.length - 1];
    expect(last.beat).toBeLessThan(m.length);
    expect(m.events.length).toBeGreaterThan(64 * 2);
  });

  test('trilha da floresta é sintetizada sem erro, respeita o mudo e para no fim de jogo', () => {
    const s = new Sfx();
    s.setMuted(false);
    s.unlock(FakeAudioContext);
    s.setMusic('floresta');
    s.updateMusic(30); // mais de uma volta
    expect(s.ctx.voices).toBeGreaterThan(0);
    expect(s.musicLoop).toBeGreaterThan(0);

    const m = new Sfx();
    m.setMuted(true);
    m.unlock(FakeAudioContext);
    m.setMusic('floresta');
    m.updateMusic(5);
    expect(m.ctx.voices).toBe(0);
    m.setMuted(false);

    const g = makeGame({ level: 10 });
    g.lives = 1;
    g.onPlayerLost();
    expect(g.sfx.track).toBe(null);
  });

  test('urso marrom inteiro numa silhueta só, com garras, parado e rugindo', () => {
    for (const chasing of [false, true]) {
      for (const dir of [1, -1]) {
        const rec = recordingCtx();
        drawBear(rec.ctx, { x: 400, y: 250, dir, walk: 0.7, chasing }, 1.2, 'brown');
        expect(rec.colors.has('#E8DCC0'), 'garras').toBe(true);
        expect(rec.colors.has(BEAR_FUR.polar.legFront), 'nada do urso polar').toBe(false);
      }
    }
  });

  test('temperatura, vidas e regras continuam as mesmas na floresta', () => {
    const g = makeGame({ level: 10 });
    expect(g.temp).toBe(RULES.tempStart);
    expect(g.lives).toBe(RULES.startLives);
    step(g, 3.5);
    expect(g.temp).toBe(RULES.tempStart - 3);
  });
});
