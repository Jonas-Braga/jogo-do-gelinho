// Fase especial 20: praia tropical (coqueiros, mar turquesa, pranchas de surfe e
// boias, cabana de palha, gaivotas, siris e águas-vivas, peixinhos tropicais,
// surfista e caranguejo gigante). Só o visual muda (e o ritmo, como toda especial).
import { suite, test, expect } from '../harness.js';
import { makeGame, step, stepUntil, enterIgloo } from '../helpers.js';
import { specialFor } from '../../src/specials.js';
import { levelParams, levelIntro } from '../../src/levels.js';
import { SIZE } from '../../src/enemies.js';
import {
  HUT_PIECES, HUT_VENT, PALMS, UMBRELLA, PALM_LEAF, GIANT_CRAB, SEA, TROPICAL_YELLOW, TORCH_FLAME,
  drawGull, drawSiri, drawJellyfish, drawTropicalFish, drawGiantCrab, boardSprite, isBuoy,
} from '../../src/beach.js';
import { drawPlayer, drawBear, BEAR_FUR, SURF_SHIRT } from '../../src/sprites.js';
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

const BEACH_ENEMIES = ['gull', 'siri', 'jellyfish'];

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

suite('Fases especiais · Praia (fase 20)', () => {
  test('fase 20 é a especial da praia; 19 e 21 são normais', () => {
    expect(specialFor(20).id).toBe('praia');
    expect(levelParams(20).special.id).toBe('praia');
    expect(levelParams(19).special).toBe(null);
    expect(levelParams(21).special).toBe(null);
  });

  test('aviso de início anuncia a praia, as pranchas e a cabana de palha', () => {
    const intro = levelIntro(20);
    expect(intro.title).toContain('PRAIA');
    expect(intro.sub).toContain('pranchas');
    expect(intro.sub).toContain('cabana de palha');
  });

  test('a praia é mais lenta (80%) e o resto da dificuldade igual', () => {
    const p = levelParams(20);
    const before = levelParams(19);
    expect(specialFor(20).pace).toBe(0.8);
    expect(p.speed).toBeCloseTo(before.speed * 0.8);
    expect(p.enemySpeed).toBeCloseTo(before.enemySpeed * 0.8);
    expect(p.bearSpeed).toBeCloseTo(before.bearSpeed * 0.8);
    expect(p.fragmented, 'fase par: pedaços curtos').toBe(true);
    expect(p.bear).toBe(true);
    expect(p.maxGroup).toBe(before.maxGroup);
    expect(p.fishChance).toBe(before.fishChance);
  });

  test('inimigos são gaivotas, siris e águas-vivas (os três aparecem)', () => {
    const g = makeGame({ level: 20, quiet: false });
    const seen = new Set();
    for (let i = 0; i < 300; i++) {
      g.critters.list = [];
      g.critters.spawn(i % 4);
      for (const c of g.critters.list) if (c.kind !== 'fish') seen.add(c.kind);
    }
    expect([...seen].sort()).toEqual([...BEACH_ENEMIES].sort());
  });

  test('fora da praia não aparecem os bichos da praia', () => {
    for (const level of [15, 19, 21]) {
      const g = makeGame({ level, quiet: false });
      for (let i = 0; i < 60; i++) g.critters.spawn(i % 4);
      for (const c of g.critters.list) expect(BEACH_ENEMIES.includes(c.kind), `fase ${level}`).toBe(false);
    }
  });

  test('bichos da praia têm o tamanho de colisão dos que substituem', () => {
    expect(SIZE.gull).toBe(SIZE.goose);
    expect(SIZE.siri).toBe(SIZE.crab);
    expect(SIZE.jellyfish).toBe(SIZE.clam);
  });

  test('gaivotas, siris e águas-vivas empurram o jogador como os outros bichos', () => {
    for (const kind of BEACH_ENEMIES) {
      const g = makeGame({ level: 20 });
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

  test('peixinho tropical no lugar do peixe: mesmos pontos, desenho próprio', () => {
    const g = makeGame({ level: 20 });
    const p = g.player;
    p.state = 'stand';
    p.row = 2;
    p.x = 600;
    g.critters.list = [{ kind: 'fish', row: 2, dir: 1, vx: 0, x: 600, w: SIZE.fish, ph: 0 }];
    expect(drawn(g).colors.has(TROPICAL_YELLOW)).toBe(true);
    const before = g.score;
    g.critters.update(1 / 120);
    expect(g.score - before).toBe(g.params.fishPoints);
    const n = makeGame({ level: 19 });
    n.critters.list = [{ kind: 'fish', row: 2, dir: 1, vx: 0, x: 600, w: SIZE.fish, ph: 0 }];
    expect(drawn(n).colors.has(TROPICAL_YELLOW)).toBe(false);
  });

  test('cada prancha pulada acrescenta uma peça da cabana de palha', () => {
    const g = makeGame({ level: 20 });
    expect(g.igloo.style).toBe('hut');
    g.onLand(1);
    g.onLand(2);
    expect(g.igloo.count).toBe(2);
    g.onLand(2);
    expect(g.igloo.count).toBe(2);
  });

  test('a cabana de palha tem 16 peças, com a porta por último e a fumaça no topo', () => {
    expect(HUT_PIECES.length).toBe(RULES.iglooPieces);
    expect(HUT_PIECES[RULES.iglooPieces - 1].kind).toBe('door');
    expect(HUT_PIECES.filter((p) => p.kind === 'wall').length).toBe(6);
    expect(HUT_PIECES.filter((p) => p.kind === 'thatch').length).toBe(5);
    expect(HUT_PIECES.filter((p) => p.kind === 'torch').length).toBe(2);
    const g = makeGame({ level: 20 });
    expect(g.igloo.ventPos).toEqual(HUT_VENT);
    expect(g.igloo.dustColor).toBe(SEA.sand);
    for (let i = 0; i < RULES.iglooPieces; i++) {
      const w = g.igloo.pieceWorld(i);
      expect(Math.abs(w.x - IGLOO.x), `peça ${i}`).toBeLessThan(170);
      expect(w.x, `peça ${i} dentro da tela`).toBeLessThan(W);
      expect(w.y, `peça ${i}`).toBeLessThan(IGLOO.baseY + 1);
    }
  });

  test('a cabana de palha aparece só na praia; iglu nas outras fases e na tela inicial', () => {
    const g = makeGame({ level: 20 });
    g.level = 21;
    g.startLevel();
    expect(g.igloo.style).toBe('igloo');
    const t = new Game(fakeCanvas(), { title: true });
    expect(t.igloo.style).toBe('igloo');
    expect(t.particles.calm).toBe(false);
  });

  test('HUD conta as peças da cabana e fala em prancha; a pausa também', () => {
    const g = makeGame({ level: 20 });
    g.onLand(0);
    let texts = drawn(g).texts;
    expect(texts).toContain('cabana 1/16');
    expect(texts.some((s) => s.includes('inverter prancha'))).toBe(true);
    g.paused = true;
    texts = drawn(g).texts;
    expect(texts).toContain('pular entre a costa e as pranchas');
    expect(texts).toContain('entrar na cabana de palha pronta');
  });

  test('cabana pronta: o surfista entra pela cortina de folhas e a fase termina', () => {
    const g = makeGame({ level: 20 });
    while (!g.igloo.complete) g.igloo.add();
    step(g, 1);
    expect(drawn(g).colors.has(TORCH_FLAME), 'tochas acesas').toBe(true);
    g.player.x = g.igloo.doorX;
    step(g, 0.1);
    enterIgloo(g);
    expect(g.state).toBe('entering');
    for (let i = 0; i < 40 && g.state === 'entering'; i++) {
      step(g, 0.1);
      drawn(g);
    }
    expect(g.state).toBe('levelEnd');
    expect(g.igloo.lit).toBe(true);
    drawn(g);
    stepUntil(g, () => g.particles.fx.some((f) => f.kind === 'smoke'), 2);
    const smoke = g.particles.fx.find((f) => f.kind === 'smoke');
    expect(Math.abs(smoke.x - HUT_VENT.x)).toBeLessThan(10);
  });

  test('pranchas de surfe e boias no lugar das placas de gelo', () => {
    const kinds = (g) => new Set(g.rows.flatMap((r) => r.pieces.flatMap((pc) => Object.keys(pc.sprites))));
    const b = makeGame({ level: 20 });
    b.rows[0].active = true;
    drawn(b);
    expect([...kinds(b)].sort()).toEqual(['boardOff', 'boardOn']);
    const n = makeGame({ level: 19 });
    drawn(n);
    expect(kinds(n).has('boardOff')).toBe(false);
    // Fase par: pedaços curtos alternam boia e pranchinha
    const pieces = b.rows[0].pieces;
    expect(pieces.some(isBuoy)).toBe(true);
    expect(pieces.some((pc) => !isBuoy(pc))).toBe(true);
    // Prancha comprida (fase ímpar) também é desenhada
    const long = { w: 82, k: 0, seed: 9, sprites: {} };
    expect(isBuoy(long)).toBe(false);
    expect(boardSprite(long, true).w).toBeGreaterThan(82);
  });

  test('coqueiros e guarda-sol na areia, longe da cabana', () => {
    expect(drawn(makeGame({ level: 20 })).colors.has(PALM_LEAF)).toBe(true);
    expect(drawn(makeGame({ level: 19 })).colors.has(PALM_LEAF)).toBe(false);
    for (const p of PALMS) expect(p.x).toBeLessThan(W / 3);
    expect(UMBRELLA.x).toBeLessThan(W / 3);
  });

  test('personagem vestido de surfista só na praia', () => {
    expect(drawn(makeGame({ level: 20 })).colors.has(SURF_SHIRT)).toBe(true);
    expect(drawn(makeGame({ level: 19 })).colors.has(SURF_SHIRT)).toBe(false);
  });

  test('roupa de surfista em todas as poses (de costas, fugindo, pulando, afundando, congelando)', () => {
    const g = makeGame({ level: 20 });
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
      drawPlayer(rec.ctx, p, 1, 0, 0, 'surfer');
      expect(rec.colors.has(SURF_SHIRT) || rec.colors.has('#13807C'), `pose ${i}`).toBe(true);
    }
  });

  test('caranguejo gigante no lugar do urso; urso polar nas outras fases', () => {
    const g = makeGame({ level: 20, quiet: false });
    expect(g.bear.active).toBe(true);
    const c = drawn(g).colors;
    expect(c.has(GIANT_CRAB.claw)).toBe(true);
    expect(c.has(BEAR_FUR.polar.legFront)).toBe(false);
    const n = drawn(makeGame({ level: 19, quiet: false })).colors;
    expect(n.has(GIANT_CRAB.claw)).toBe(false);
    expect(n.has(BEAR_FUR.polar.legFront)).toBe(true);
  });

  test('caranguejo gigante desenhado nos dois sentidos, parado e correndo atrás', () => {
    for (const chasing of [false, true]) {
      for (const dir of [1, -1]) {
        const rec = recordingCtx();
        drawBear(rec.ctx, { x: 400, y: 250, dir, walk: 0.7, chasing }, 1.2, 'giantCrab');
        expect(rec.colors.has(GIANT_CRAB.tip), 'pontas das pinças').toBe(true);
        expect(rec.colors.has(BEAR_FUR.polar.legFront), 'nada do urso polar').toBe(false);
      }
    }
    const rec = recordingCtx();
    drawGiantCrab(rec.ctx, { x: 0, y: 250, dir: 1, walk: 0, chasing: true }, 0.5);
    expect(rec.colors.has('#5A1A0E'), 'cara brava na perseguição').toBe(true);
  });

  test('alcançado pelo caranguejo gigante, o surfista foge (mesma regra do urso)', () => {
    const g = makeGame({ level: 20 });
    g.bear.active = true;
    g.bear.x = 600;
    g.bear.dir = 1;
    g.player.x = 620;
    g.player.invuln = 0;
    step(g, 0.1);
    expect(g.player.state).toBe('flee');
    expect(g.bear.chasing).toBe(true);
  });

  test('sem neve caindo, sem aurora e sem vapor da respiração (calor)', () => {
    const g = makeGame({ level: 20 });
    expect(g.particles.calm).toBe(true);
    expect(g.particles.leaves).toBe(false);
    expect(g.particles.stardust).toBe(false);
    drawn(g);
    expect(g.renderer.aurora).toBe(0);
    g.temp = 15;
    g.breathT = 0;
    step(g, 1.5);
    expect(g.particles.fx.some((f) => f.kind === 'vapor')).toBe(false);
    g.level = 21;
    g.startLevel();
    expect(g.particles.calm).toBe(false);
    drawn(g);
    expect(g.renderer.aurora).toBeGreaterThan(0);
  });

  test('pousos levantam areia na costa e borrifo nas pranchas', () => {
    const g = makeGame({ level: 20 });
    g.onLand(-1);
    expect(g.particles.puffs.some((p) => p.color === SEA.sand)).toBe(true);
    g.onLand(1);
    expect(g.particles.fx.some((f) => f.kind === 'chip' && f.color === SEA.spray)).toBe(true);
  });

  test('gaivota, siri, água-viva e peixinho tropical são desenhados nos dois sentidos', () => {
    for (const draw of [drawGull, drawSiri, drawJellyfish, drawTropicalFish]) {
      for (const dir of [1, -1]) {
        const rec = recordingCtx();
        draw(rec.ctx, { x: 300, dir, ph: 1 }, 450, 2.3);
        expect(rec.colors.size).toBeGreaterThan(2);
      }
    }
  });

  test('cada bicho da praia tem o seu som ao empurrar, e o caranguejo gigante estala as pinças', () => {
    const s = audibleSfx();
    for (const kind of BEACH_ENEMIES) {
      const before = s.ctx.voices;
      s.play('bump', { kind });
      expect(s.ctx.voices, kind).toBeGreaterThan(before);
    }
    const before = s.ctx.voices;
    s.play('growl', { kind: 'giantCrab' });
    expect(s.ctx.voices).toBeGreaterThan(before);
  });

  test('a praia toca a sua própria trilha (e não tem trenó)', () => {
    const g = makeGame({ level: 20 });
    expect(g.sfx.track).toBe('praia');
    for (let i = 0; i < 30 * 120; i++) g.update(1 / 120);
    expect(g.sleigh.active).toBe(false);
    expect(g.sfx.musicNotes).toBeGreaterThan(100);
    g.level = 21;
    g.startLevel();
    expect(g.sfx.track).toBe(null);
  });

  test('trilha da praia: 16 compassos com tambor de aço, cavaquinho, baixo, chocalho e ondas', () => {
    const m = MUSIC.praia;
    expect(m.length).toBe(64);
    expect(m.length * m.beat).toBeGreaterThan(20);
    const last = m.events[m.events.length - 1];
    expect(last.beat).toBeLessThan(m.length);
    expect(m.events.length).toBeGreaterThan(64 * 3);
  });

  test('trilha da praia é sintetizada sem erro, respeita o mudo e para no fim de jogo', () => {
    const s = audibleSfx();
    s.setMusic('praia');
    s.updateMusic(30);
    expect(s.ctx.voices).toBeGreaterThan(0);
    expect(s.musicLoop).toBeGreaterThan(0);

    const m = new Sfx();
    m.setMuted(true);
    m.unlock(FakeAudioContext);
    m.setMusic('praia');
    m.updateMusic(5);
    expect(m.ctx.voices).toBe(0);
    m.setMuted(false);

    const g = makeGame({ level: 20 });
    g.lives = 1;
    g.onPlayerLost();
    expect(g.sfx.track).toBe(null);
  });

  test('temperatura, vidas e regras continuam as mesmas na praia', () => {
    const g = makeGame({ level: 20 });
    expect(g.temp).toBe(RULES.tempStart);
    expect(g.lives).toBe(RULES.startLives);
    step(g, 3.5);
    expect(g.temp).toBe(RULES.tempStart - 3);
  });
});
