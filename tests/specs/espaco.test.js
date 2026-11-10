// Fase especial 15: espaço (lua com crateras, rio de poeira estelar com asteroides,
// base lunar, discos voadores, bichinhos lunares e cometas, estrelinhas douradas,
// astronauta e alienígena). Só o visual muda.
import { suite, test, expect } from '../harness.js';
import { makeGame, step, stepUntil, enterIgloo } from '../helpers.js';
import { specialFor } from '../../src/specials.js';
import { levelParams, levelIntro } from '../../src/levels.js';
import { SIZE } from '../../src/enemies.js';
import {
  BASE_PIECES, BASE_VENT, SPACE_DECOR, ALIEN, STAR_GOLD, EARTH_OCEAN, DUST,
  drawUfo, drawCrawler, drawComet, drawStarBonus, drawAlien, asteroidSprite, earthPos,
} from '../../src/space.js';
import { drawPlayer, drawBear, BEAR_FUR, ASTRO_WHITE } from '../../src/sprites.js';
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

const SPACE_ENEMIES = ['ufo', 'crawler', 'comet'];

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

function audibleSfx() {
  const s = new Sfx();
  s.setMuted(false);
  s.unlock(FakeAudioContext);
  return s;
}

suite('Fases especiais · Espaço (fase 15)', () => {
  test('fase 15 é a especial do espaço; 14 e 16 são normais', () => {
    expect(specialFor(15).id).toBe('espaco');
    expect(levelParams(15).special.id).toBe('espaco');
    expect(levelParams(14).special).toBe(null);
    expect(levelParams(16).special).toBe(null);
  });

  test('aviso de início anuncia o espaço, os asteroides e a base lunar', () => {
    const intro = levelIntro(15);
    expect(intro.title).toContain('ESPAÇO');
    expect(intro.sub).toContain('asteroides');
    expect(intro.sub).toContain('base lunar');
  });

  test('o espaço é mais lento: asteroides, bichos e alienígena a 80%; o resto igual', () => {
    const p = levelParams(15);
    const before = levelParams(14);
    const after = levelParams(16);
    expect(specialFor(15).pace).toBe(0.8);
    // Fases 14 e 16 estão no teto; a 15 fica a 80% dele
    expect(p.speed).toBeCloseTo(before.speed * 0.8);
    expect(p.enemySpeed).toBeCloseTo(before.enemySpeed * 0.8);
    expect(p.bearSpeed).toBeCloseTo(before.bearSpeed * 0.8);
    expect(after.speed).toBe(before.speed);
    expect(p.fragmented, 'fase ímpar: asteroides inteiros').toBe(false);
    expect(p.bear).toBe(true);
    expect(p.maxGroup).toBe(before.maxGroup);
    expect(p.fishChance).toBe(before.fishChance);
    expect(p.spawnMin).toBe(before.spawnMin);
    // As fileiras de verdade andam mais devagar
    const g = makeGame({ level: 15 });
    for (const r of g.rows) expect(r.speed).toBeCloseTo(p.speed);
  });

  test('inimigos são discos voadores, bichinhos lunares e cometas (os três aparecem)', () => {
    const g = makeGame({ level: 15, quiet: false });
    const seen = new Set();
    for (let i = 0; i < 300; i++) {
      g.critters.list = [];
      g.critters.spawn(i % 4);
      for (const c of g.critters.list) if (c.kind !== 'fish') seen.add(c.kind);
    }
    expect([...seen].sort()).toEqual([...SPACE_ENEMIES].sort());
  });

  test('fora do espaço não aparecem os bichos espaciais', () => {
    for (const level of [10, 14, 16]) {
      const g = makeGame({ level, quiet: false });
      for (let i = 0; i < 60; i++) g.critters.spawn(i % 4);
      for (const c of g.critters.list) expect(SPACE_ENEMIES.includes(c.kind), `fase ${level}`).toBe(false);
    }
  });

  test('bichos espaciais têm o tamanho de colisão dos que substituem', () => {
    expect(SIZE.ufo).toBe(SIZE.goose);
    expect(SIZE.crawler).toBe(SIZE.crab);
    expect(SIZE.comet).toBe(SIZE.clam);
  });

  test('discos, bichinhos e cometas empurram o jogador como os outros bichos', () => {
    for (const kind of SPACE_ENEMIES) {
      const g = makeGame({ level: 15 });
      const p = g.player;
      p.state = 'stand';
      p.row = 1;
      p.x = 600;
      g.critters.list = [{ kind, row: 1, dir: -g.rows[1].dir, vx: 0, x: 0, w: SIZE[kind], ph: 0 }];
      const c = g.critters.list[0];
      c.x = p.x - c.dir * 10;
      const x0 = p.x;
      g.critters.update(1 / 120);
      expect(p.x, kind).not.toBe(x0);
    }
  });

  test('estrelinha dourada no lugar do peixe: mesmos pontos, desenho próprio', () => {
    const g = makeGame({ level: 15 });
    const p = g.player;
    p.state = 'stand';
    p.row = 2;
    p.x = 600;
    g.critters.list = [{ kind: 'fish', row: 2, dir: 1, vx: 0, x: 600, w: SIZE.fish, ph: 0 }];
    // Desenhada como estrela (e não como peixe) enquanto está na tela
    expect(drawn(g).colors.has(STAR_GOLD)).toBe(true);
    const before = g.score;
    g.critters.update(1 / 120);
    expect(g.score - before).toBe(g.params.fishPoints);
    // Nas fases normais o peixe continua peixe
    const n = makeGame({ level: 14 });
    n.critters.list = [{ kind: 'fish', row: 2, dir: 1, vx: 0, x: 600, w: SIZE.fish, ph: 0 }];
    expect(drawn(n).colors.has(STAR_GOLD)).toBe(false);
  });

  test('cada asteroide pulado acrescenta uma peça da base lunar', () => {
    const g = makeGame({ level: 15 });
    expect(g.igloo.style).toBe('base');
    g.onLand(0);
    g.onLand(3);
    expect(g.igloo.count).toBe(2);
    g.onLand(3);
    expect(g.igloo.count).toBe(2);
  });

  test('a base tem 16 peças, com a porta por último e o respiro soltando o vapor', () => {
    expect(BASE_PIECES.length).toBe(RULES.iglooPieces);
    expect(BASE_PIECES[RULES.iglooPieces - 1].kind).toBe('door');
    expect(BASE_PIECES.filter((p) => p.kind === 'panel').length).toBe(6);
    expect(BASE_PIECES.filter((p) => p.kind === 'dome').length).toBe(4);
    expect(BASE_PIECES.filter((p) => p.kind === 'solar').length).toBe(2);
    const g = makeGame({ level: 15 });
    expect(g.igloo.ventPos).toEqual(BASE_VENT);
    expect(g.igloo.dustColor).toBe(DUST.regolith);
    for (let i = 0; i < RULES.iglooPieces; i++) {
      const w = g.igloo.pieceWorld(i);
      expect(Math.abs(w.x - IGLOO.x), `peça ${i}`).toBeLessThan(170);
      expect(w.x, `peça ${i} dentro da tela`).toBeLessThan(W);
      expect(w.y, `peça ${i}`).toBeLessThan(IGLOO.baseY + 1);
    }
  });

  test('a base aparece só no espaço; iglu nas outras fases e na tela inicial', () => {
    const g = makeGame({ level: 15 });
    g.level = 16;
    g.startLevel();
    expect(g.igloo.style).toBe('igloo');
    const t = new Game(fakeCanvas(), { title: true });
    expect(t.igloo.style).toBe('igloo');
    expect(t.particles.stardust).toBe(false);
  });

  test('HUD conta as peças da base e fala em asteroide', () => {
    const g = makeGame({ level: 15 });
    g.onLand(0);
    const texts = drawn(g).texts;
    expect(texts).toContain('base 1/16');
    expect(texts.some((s) => s.includes('inverter asteroide'))).toBe(true);
    const n = makeGame({ level: 14 });
    expect(drawn(n).texts).toContain('iglu 0/16');
  });

  test('tela de pausa fala em asteroides e base lunar (e no iglu nas fases normais)', () => {
    const g = makeGame({ level: 15 });
    g.paused = true;
    const texts = drawn(g).texts;
    expect(texts).toContain('pular entre a costa e os asteroides');
    expect(texts).toContain('entrar na base lunar pronta');
    const n = makeGame({ level: 14 });
    n.paused = true;
    expect(drawn(n).texts).toContain('entrar no iglu pronto');
  });

  test('base pronta: o astronauta entra pela câmara de ar e a fase termina', () => {
    const g = makeGame({ level: 15 });
    while (!g.igloo.complete) g.igloo.add();
    step(g, 1);
    drawn(g); // base completa desenhada (antena piscando, porta)
    g.player.x = g.igloo.doorX;
    step(g, 0.1);
    enterIgloo(g);
    expect(g.state).toBe('entering');
    for (let i = 0; i < 40 && g.state === 'entering'; i++) {
      step(g, 0.1);
      drawn(g); // a porta de correr fecha por cima dele enquanto entra
    }
    expect(g.state).toBe('levelEnd');
    expect(g.igloo.lit).toBe(true);
    drawn(g);
    stepUntil(g, () => g.particles.fx.some((f) => f.kind === 'smoke'), 2);
    const smoke = g.particles.fx.find((f) => f.kind === 'smoke');
    expect(Math.abs(smoke.x - BASE_VENT.x)).toBeLessThan(10);
  });

  test('asteroides no lugar das placas de gelo (acesos com cristais)', () => {
    const kinds = (g) => new Set(g.rows.flatMap((r) => r.pieces.flatMap((pc) => Object.keys(pc.sprites))));
    const s = makeGame({ level: 15 });
    s.rows[2].active = true;
    drawn(s);
    expect([...kinds(s)].sort()).toEqual(['rockOff', 'rockOn']);
    const n = makeGame({ level: 14 });
    drawn(n);
    expect(kinds(n).has('rockOff')).toBe(false);
    // Asteroide curto (pedaço de fase par) também é desenhado
    const short = { w: 36, seed: 5, sprites: {} };
    expect(asteroidSprite(short, false).w).toBeGreaterThan(36);
  });

  test('céu estrelado com a Terra, que desce conforme a temperatura cai', () => {
    expect(drawn(makeGame({ level: 15 })).colors.has(EARTH_OCEAN)).toBe(true);
    expect(drawn(makeGame({ level: 14 })).colors.has(EARTH_OCEAN)).toBe(false);
    expect(earthPos(0).y).toBeGreaterThan(earthPos(1).y);
  });

  test('módulo de pouso e bandeira ficam longe da base', () => {
    expect(SPACE_DECOR.lander.x).toBeLessThan(W / 3);
    expect(SPACE_DECOR.flag.x).toBeLessThan(W / 3);
  });

  test('personagem vestido de astronauta só no espaço', () => {
    expect(drawn(makeGame({ level: 15 })).colors.has(ASTRO_WHITE)).toBe(true);
    expect(drawn(makeGame({ level: 14 })).colors.has(ASTRO_WHITE)).toBe(false);
  });

  test('traje de astronauta em todas as poses (de costas, fugindo, pulando, afundando, congelando)', () => {
    const g = makeGame({ level: 15 });
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
      drawPlayer(rec.ctx, p, 1, 0, 0, 'astronaut');
      expect(rec.colors.has(ASTRO_WHITE), `pose ${i}`).toBe(true);
    }
  });

  test('alienígena no lugar do urso; urso polar nas outras fases', () => {
    const g = makeGame({ level: 15, quiet: false });
    expect(g.bear.active).toBe(true);
    const c = drawn(g).colors;
    expect(c.has(ALIEN.legFront)).toBe(true);
    expect(c.has(BEAR_FUR.polar.legFront)).toBe(false);
    const n = drawn(makeGame({ level: 14, quiet: false })).colors;
    expect(n.has(ALIEN.legFront)).toBe(false);
    expect(n.has(BEAR_FUR.polar.legFront)).toBe(true);
  });

  test('alienígena desenhado nos dois sentidos, parado e correndo atrás', () => {
    for (const chasing of [false, true]) {
      for (const dir of [1, -1]) {
        const rec = recordingCtx();
        drawBear(rec.ctx, { x: 400, y: 250, dir, walk: 0.7, chasing }, 1.2, 'alien');
        expect(rec.colors.has(ALIEN.glow), 'antenas acesas').toBe(true);
        expect(rec.colors.has(BEAR_FUR.polar.legFront), 'nada do urso polar').toBe(false);
      }
    }
    const rec = recordingCtx();
    drawAlien(rec.ctx, { x: 0, y: 250, dir: 1, walk: 0, chasing: true }, 0.5);
    expect(rec.colors.has('#D0202A'), 'olhos vermelhos na perseguição').toBe(true);
  });

  test('alcançado pelo alienígena, o astronauta foge (mesma regra do urso)', () => {
    const g = makeGame({ level: 15 });
    g.bear.active = true;
    g.bear.x = 600;
    g.bear.dir = 1;
    g.player.x = 620;
    g.player.invuln = 0;
    step(g, 0.1);
    expect(g.player.state).toBe('flee');
    expect(g.bear.chasing).toBe(true);
  });

  test('poeira estelar no lugar da neve, sem aurora e sem vapor fora do capacete', () => {
    const g = makeGame({ level: 15 });
    expect(g.particles.stardust).toBe(true);
    expect(g.particles.leaves).toBe(false);
    drawn(g);
    expect(g.renderer.aurora).toBe(0);
    g.temp = 15;
    g.breathT = 0;
    step(g, 1.5);
    expect(g.particles.fx.some((f) => f.kind === 'vapor')).toBe(false);
    g.level = 16;
    g.startLevel();
    expect(g.particles.stardust).toBe(false);
    drawn(g);
    expect(g.renderer.aurora).toBeGreaterThan(0);
  });

  test('pousos levantam poeira lunar e lascas de rocha', () => {
    const g = makeGame({ level: 15 });
    g.onLand(-1);
    expect(g.particles.puffs.some((p) => p.color === DUST.regolith)).toBe(true);
    g.onLand(1);
    expect(g.particles.fx.some((f) => f.kind === 'chip' && f.color === DUST.rock)).toBe(true);
  });

  test('disco voador, bichinho lunar, cometa e estrelinha são desenhados nos dois sentidos', () => {
    for (const draw of [drawUfo, drawCrawler, drawComet, drawStarBonus]) {
      for (const dir of [1, -1]) {
        const rec = recordingCtx();
        draw(rec.ctx, { x: 300, dir, ph: 1 }, 450, 2.3);
        expect(rec.colors.size).toBeGreaterThan(2);
      }
    }
  });

  test('cada bicho espacial tem o seu som ao empurrar, e o alienígena grita diferente', () => {
    const s = audibleSfx();
    for (const kind of SPACE_ENEMIES) {
      const before = s.ctx.voices;
      s.play('bump', { kind });
      expect(s.ctx.voices, kind).toBeGreaterThan(before);
    }
    const before = s.ctx.voices;
    s.play('growl', { kind: 'alien' });
    expect(s.ctx.voices).toBeGreaterThan(before);
    const g = makeGame({ level: 15 });
    g.player.invuln = 0;
    g.player.flee(1);
    expect(g.sfx.history).toContain('growl');
  });

  test('o espaço toca a sua própria trilha (e não tem trenó)', () => {
    const g = makeGame({ level: 15 });
    expect(g.sfx.track).toBe('espaco');
    for (let i = 0; i < 30 * 120; i++) g.update(1 / 120);
    expect(g.sleigh.active).toBe(false);
    expect(g.sfx.musicNotes).toBeGreaterThan(100);
    g.level = 16;
    g.startLevel();
    expect(g.sfx.track).toBe(null);
  });

  test('trilha do espaço: 16 compassos com colchão, arpejo, baixo, teremim e bipes', () => {
    const m = MUSIC.espaco;
    expect(m.length).toBe(64);
    expect(m.length * m.beat).toBeGreaterThan(20);
    const last = m.events[m.events.length - 1];
    expect(last.beat).toBeLessThan(m.length);
    expect(m.events.length).toBeGreaterThan(64 * 3);
  });

  test('trilha do espaço é sintetizada sem erro, respeita o mudo e para no fim de jogo', () => {
    const s = audibleSfx();
    s.setMusic('espaco');
    s.updateMusic(30);
    expect(s.ctx.voices).toBeGreaterThan(0);
    expect(s.musicLoop).toBeGreaterThan(0);

    const m = new Sfx();
    m.setMuted(true);
    m.unlock(FakeAudioContext);
    m.setMusic('espaco');
    m.updateMusic(5);
    expect(m.ctx.voices).toBe(0);
    m.setMuted(false);

    const g = makeGame({ level: 15 });
    g.lives = 1;
    g.onPlayerLost();
    expect(g.sfx.track).toBe(null);
  });

  test('temperatura, vidas e regras continuam as mesmas no espaço', () => {
    const g = makeGame({ level: 15 });
    expect(g.temp).toBe(RULES.tempStart);
    expect(g.lives).toBe(RULES.startLives);
    step(g, 3.5);
    expect(g.temp).toBe(RULES.tempStart - 3);
  });
});
