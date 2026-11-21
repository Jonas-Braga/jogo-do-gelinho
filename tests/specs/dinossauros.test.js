// Fase especial 30: Dinossauros (vulcões, rio de lava com pedras de basalto,
// caverna de pedra, pterossauros, raptorzinhos e amonites, ovos no lugar dos
// peixes, homem das cavernas e T-rex). Só o visual muda (e o ritmo, como toda especial).
import { suite, test, expect } from '../harness.js';
import { makeGame, step, stepUntil, enterIgloo } from '../helpers.js';
import { specialFor, trophyFor } from '../../src/specials.js';
import { levelParams, levelIntro } from '../../src/levels.js';
import { SIZE } from '../../src/enemies.js';
import {
  CAVE_PIECES, CAVE_VENT, CAVE_DOOR, LAVA, TREX, SKY_TOP, SUN, sunPos, AMBER, BASALT, BONE, EGG_SPOT,
  FERN_GREEN, TREE_FERNS, NEST, VOLCANOES, EMBER, doorStone,
  drawPtero, drawRaptor, drawAmmonite, drawDinoEgg, drawTrex, rockSprite,
} from '../../src/dino.js';
import { TROPHY_EMBLEMS } from '../../src/trophies.js';
import { drawPlayer, drawBear, BEAR_FUR, CAVE_FUR, CAVE_HAIR } from '../../src/sprites.js';
import { Sfx, MUSIC } from '../../src/audio.js';
import { W, RULES, IGLOO, PALETTE } from '../../src/config.js';
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

const DINO_ENEMIES = ['ptero', 'raptor', 'ammonite'];

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

suite('Fases especiais · Dinossauros (fase 30)', () => {
  test('fase 30 é a especial dos Dinossauros; 29 e 31 são normais', () => {
    expect(specialFor(30).id).toBe('dinossauros');
    expect(levelParams(30).special.id).toBe('dinossauros');
    expect(levelParams(29).special).toBe(null);
    expect(levelParams(31).special).toBe(null);
  });

  test('aviso de início anuncia os dinossauros, as pedras do rio de lava e a caverna', () => {
    const intro = levelIntro(30);
    expect(intro.title).toContain('DINOSSAUROS');
    expect(intro.sub).toContain('pedras');
    expect(intro.sub).toContain('lava');
    expect(intro.sub).toContain('caverna');
  });

  test('os Dinossauros são mais lentos (80%) e o resto da dificuldade igual', () => {
    const p = levelParams(30);
    const before = levelParams(29);
    expect(specialFor(30).pace).toBe(0.8);
    expect(p.speed).toBeCloseTo(Math.min(62 + 29 * 9, 170) * 0.8);
    expect(p.enemySpeed).toBeCloseTo(before.enemySpeed * 0.8);
    expect(p.bearSpeed).toBeCloseTo(before.bearSpeed * 0.8);
    expect(p.fragmented, 'fase par: pedras em pedaços').toBe(true);
    expect(p.bear).toBe(true);
    expect(p.maxGroup).toBe(before.maxGroup);
    expect(p.fishChance).toBe(before.fishChance);
    expect(p.powers, 'fase especial não tem poderes').toEqual([]);
  });

  test('inimigos são pterossauros, raptorzinhos e amonites (os três aparecem)', () => {
    const g = makeGame({ level: 30, quiet: false });
    const seen = new Set();
    for (let i = 0; i < 300; i++) {
      g.critters.list = [];
      g.critters.spawn(i % 4);
      for (const c of g.critters.list) if (c.kind !== 'fish') seen.add(c.kind);
    }
    expect([...seen].sort()).toEqual([...DINO_ENEMIES].sort());
  });

  test('fora dos Dinossauros não aparecem os bichos pré-históricos', () => {
    for (const level of [25, 29, 31]) {
      const g = makeGame({ level, quiet: false });
      for (let i = 0; i < 60; i++) g.critters.spawn(i % 4);
      for (const c of g.critters.list) expect(DINO_ENEMIES.includes(c.kind), `fase ${level}`).toBe(false);
    }
  });

  test('bichos pré-históricos têm o tamanho de colisão dos que substituem', () => {
    expect(SIZE.ptero).toBe(SIZE.goose);
    expect(SIZE.raptor).toBe(SIZE.crab);
    expect(SIZE.ammonite).toBe(SIZE.clam);
  });

  test('pterossauros, raptorzinhos e amonites empurram o jogador como os outros bichos', () => {
    for (const kind of DINO_ENEMIES) {
      const g = makeGame({ level: 30 });
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

  test('ovo de dinossauro no lugar do peixe: mesmos pontos, desenho próprio', () => {
    const g = makeGame({ level: 30 });
    const p = g.player;
    p.state = 'stand';
    p.row = 2;
    p.x = 600;
    g.critters.list = [{ kind: 'fish', row: 2, dir: 1, vx: 0, x: 600, w: SIZE.fish, ph: 0 }];
    expect(drawn(g).colors.has(EGG_SPOT)).toBe(true);
    const before = g.score;
    g.critters.update(1 / 120);
    expect(g.score - before).toBe(g.params.fishPoints);
    const n = makeGame({ level: 29 });
    n.critters.list = [{ kind: 'fish', row: 2, dir: 1, vx: 0, x: 600, w: SIZE.fish, ph: 0 }];
    expect(drawn(n).colors.has(EGG_SPOT)).toBe(false);
  });

  test('cada fileira de pedras acrescenta uma peça da caverna', () => {
    const g = makeGame({ level: 30 });
    expect(g.igloo.style).toBe('cave');
    g.onLand(1);
    g.onLand(2);
    expect(g.igloo.count).toBe(2);
    g.onLand(2);
    expect(g.igloo.count).toBe(2);
  });

  test('a caverna tem 16 peças, com a porta por último e a fumaça saindo do respiro', () => {
    expect(CAVE_PIECES.length).toBe(RULES.iglooPieces);
    expect(CAVE_PIECES[RULES.iglooPieces - 1].kind).toBe('door');
    expect(CAVE_PIECES.filter((p) => p.kind === 'wall').length).toBe(6);
    expect(CAVE_PIECES.filter((p) => p.kind === 'roof').length).toBe(4);
    expect(CAVE_PIECES.filter((p) => p.kind === 'tusk').length).toBe(2);
    for (const k of ['vent', 'skull', 'torch']) {
      expect(CAVE_PIECES.filter((p) => p.kind === k).length, k).toBe(1);
    }
    const g = makeGame({ level: 30 });
    expect(g.igloo.ventPos).toEqual(CAVE_VENT);
    expect(g.igloo.dustColor).toBe(LAVA.ash);
    for (let i = 0; i < RULES.iglooPieces; i++) {
      const w = g.igloo.pieceWorld(i);
      expect(Math.abs(w.x - IGLOO.x), `peça ${i}`).toBeLessThan(170);
      expect(w.x, `peça ${i} dentro da tela`).toBeLessThan(W);
      expect(w.y, `peça ${i}`).toBeLessThan(IGLOO.baseY + 1);
    }
  });

  test('a caverna aparece só nos Dinossauros; iglu nas outras fases e na tela inicial', () => {
    const g = makeGame({ level: 30 });
    g.level = 31;
    g.startLevel();
    expect(g.igloo.style).toBe('igloo');
    const t = new Game(fakeCanvas(), { title: true });
    expect(t.igloo.style).toBe('igloo');
    expect(t.particles.embers).toBe(false);
    expect(t.particles.liquid).toBe(null);
  });

  test('HUD conta as peças da caverna e fala em pedra; a pausa também', () => {
    const g = makeGame({ level: 30 });
    g.onLand(0);
    let texts = drawn(g).texts;
    expect(texts).toContain('caverna 1/16');
    expect(texts.some((s) => s.includes('inverter pedra'))).toBe(true);
    g.paused = true;
    texts = drawn(g).texts;
    expect(texts).toContain('pular entre a costa e as pedras');
    expect(texts).toContain('entrar na caverna pronta');
  });

  test('caverna pronta: o homem das cavernas entra, a pedra rola tampando a porta e a fase termina', () => {
    const g = makeGame({ level: 30 });
    while (!g.igloo.complete) g.igloo.add();
    step(g, 1);
    const c = drawn(g).colors;
    expect(c.has(BONE), 'presas de osso em volta da entrada').toBe(true);
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
    expect(g.igloo.curtain).toBe(1);
    drawn(g);
    stepUntil(g, () => g.particles.fx.some((f) => f.kind === 'smoke'), 2);
    const smoke = g.particles.fx.find((f) => f.kind === 'smoke');
    expect(Math.abs(smoke.x - CAVE_VENT.x)).toBeLessThan(10);
  });

  test('a porta é uma pedra redonda que rola da direita até tampar a entrada', () => {
    const open = doorStone(0);
    const half = doorStone(0.5);
    const shut = doorStone(1);
    expect(shut.x).toBe(CAVE_DOOR.x);
    expect(open.x - open.r, 'aberta: fora da entrada').toBeGreaterThan(CAVE_DOOR.x + CAVE_DOOR.w - 1);
    expect(half.x).toBeLessThan(open.x);
    expect(half.x).toBeGreaterThan(shut.x);
    expect(shut.r * 2, 'cobre a entrada inteira').toBeGreaterThan(CAVE_DOOR.w * 2);
    expect(open.angle, 'gira enquanto rola').not.toBe(shut.angle);
  });

  test('pedras de basalto boiando no lugar das placas: cobertas de âmbar quando a fileira acende', () => {
    const kinds = (g) => new Set(g.rows.flatMap((r) => r.pieces.flatMap((pc) => Object.keys(pc.sprites))));
    const d = makeGame({ level: 30 });
    d.rows[0].active = true;
    drawn(d);
    expect([...kinds(d)].sort()).toEqual(['rockOff', 'rockOn']);
    const n = makeGame({ level: 29 });
    drawn(n);
    expect(kinds(n).has('rockOff')).toBe(false);
    // Pedaço curto (fase par) e pedaço inteiro, apagado e aceso
    for (const w of [36, 82]) {
      const piece = { w, k: 0, seed: 3, sprites: {} };
      expect(rockSprite(piece, false).w).toBeGreaterThan(w);
      expect(rockSprite(piece, true).w).toBeGreaterThan(w);
    }
    expect(AMBER).toBe('#FFB627');
    expect(BASALT).toBe('#4E4440');
  });

  test('vulcões, samambaias gigantes e o ninho com ovos na costa, longe da caverna', () => {
    expect(drawn(makeGame({ level: 30 })).colors.has(FERN_GREEN)).toBe(true);
    expect(drawn(makeGame({ level: 29 })).colors.has(FERN_GREEN)).toBe(false);
    expect(VOLCANOES.length).toBeGreaterThan(1);
    for (const f of TREE_FERNS) expect(IGLOO.x - f.x, 'samambaia longe da caverna').toBeGreaterThan(300);
    expect(IGLOO.x - NEST.x, 'ninho longe da caverna').toBeGreaterThan(300);
  });

  test('céu pré-histórico com um sol enorme que desce conforme esfria', () => {
    const warm = sunPos(1);
    const cold = sunPos(0);
    expect(cold.y).toBeGreaterThan(warm.y);
    expect(warm.x).toBe(SUN.x);
    expect(drawn(makeGame({ level: 30 })).colors.has(SKY_TOP)).toBe(true);
    expect(drawn(makeGame({ level: 29 })).colors.has(SKY_TOP)).toBe(false);
  });

  test('rio de lava: cair levanta respingos e anéis cor de lava (e água clarinha nas outras fases)', () => {
    const g = makeGame({ level: 30 });
    expect(g.particles.liquid).toEqual(LAVA.liquid);
    g.particles.splash(600, 400);
    expect(drawn(g).colors.has(LAVA.liquid.splash)).toBe(true);
    const n = makeGame({ level: 29 });
    expect(n.particles.liquid).toBe(null);
    n.particles.splash(600, 400);
    const c = drawn(n).colors;
    expect(c.has(LAVA.liquid.splash)).toBe(false);
    expect(c.has(PALETTE.splash)).toBe(true);
  });

  test('personagem vestido de homem das cavernas só nos Dinossauros', () => {
    expect(drawn(makeGame({ level: 30 })).colors.has(CAVE_FUR)).toBe(true);
    expect(drawn(makeGame({ level: 29 })).colors.has(CAVE_FUR)).toBe(false);
  });

  test('homem das cavernas em todas as poses (de costas, fugindo, pulando, afundando, congelando)', () => {
    const g = makeGame({ level: 30 });
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
      drawPlayer(rec.ctx, p, 1, 0, 0, 'caveman');
      expect(rec.colors.has(CAVE_FUR) || rec.colors.has('#9A5A18'), `pose ${i}: túnica`).toBe(true);
      expect(rec.colors.has(CAVE_HAIR), `pose ${i}: cabeleira`).toBe(true);
    }
  });

  test('T-rex no lugar do urso; urso polar nas outras fases', () => {
    const g = makeGame({ level: 30, quiet: false });
    expect(g.bear.active).toBe(true);
    const c = drawn(g).colors;
    expect(c.has(TREX.eye)).toBe(true);
    expect(c.has(BEAR_FUR.polar.legFront)).toBe(false);
    const n = drawn(makeGame({ level: 29, quiet: false })).colors;
    expect(n.has(TREX.eye)).toBe(false);
    expect(n.has(BEAR_FUR.polar.legFront)).toBe(true);
  });

  test('T-rex desenhado nos dois sentidos, parado (rugindo) e correndo atrás de boca aberta', () => {
    for (const chasing of [false, true]) {
      for (const dir of [1, -1]) {
        for (const t of [0.2, 2.2]) {
          const rec = recordingCtx();
          drawBear(rec.ctx, { x: 400, y: 250, dir, walk: 0.7, chasing }, t, 'trex');
          expect(rec.colors.has(TREX.teeth), 'dentes').toBe(true);
          expect(rec.colors.has(TREX.stripe), 'listras').toBe(true);
          expect(rec.colors.has(BEAR_FUR.polar.legFront), 'nada do urso polar').toBe(false);
        }
      }
    }
    const rec = recordingCtx();
    drawTrex(rec.ctx, { x: 0, y: 250, dir: 1, walk: 0, chasing: true }, 0.5);
    expect(rec.colors.has(TREX.mouth), 'boca aberta na perseguição').toBe(true);
  });

  test('alcançado pelo T-rex, o homem das cavernas foge (mesma regra do urso)', () => {
    const g = makeGame({ level: 30 });
    g.bear.active = true;
    g.bear.x = 600;
    g.bear.dir = 1;
    g.player.x = 620;
    g.player.invuln = 0;
    step(g, 0.1);
    expect(g.player.state).toBe('flee');
    expect(g.bear.chasing).toBe(true);
  });

  test('brasas subindo no lugar da neve, sem aurora e sem vapor da respiração', () => {
    const g = makeGame({ level: 30 });
    expect(g.particles.embers).toBe(true);
    expect(g.particles.leaves).toBe(false);
    expect(g.particles.calm).toBe(false);
    expect(drawn(g).colors.has(EMBER)).toBe(true);
    expect(g.renderer.aurora).toBe(0);
    g.temp = RULES.breathBelow - 5;
    g.player.state = 'stand';
    step(g, 3);
    expect(g.particles.fx.some((f) => f.kind === 'vapor'), 'calor: sem vapor').toBe(false);
    g.level = 31;
    g.startLevel();
    expect(g.particles.embers).toBe(false);
    drawn(g);
    expect(g.renderer.aurora).toBeGreaterThan(0);
  });

  test('pousos levantam cinza na costa e lasquinhas de basalto no rio', () => {
    const g = makeGame({ level: 30 });
    g.onLand(-1);
    expect(g.particles.puffs.some((p) => p.color === LAVA.ash)).toBe(true);
    g.onLand(1);
    expect(g.particles.fx.some((f) => f.kind === 'chip' && f.color === LAVA.chip)).toBe(true);
  });

  test('pterossauro, raptor, amonite e ovo são desenhados nos dois sentidos', () => {
    for (const draw of [drawPtero, drawRaptor, drawAmmonite, drawDinoEgg]) {
      for (const dir of [1, -1]) {
        const rec = recordingCtx();
        draw(rec.ctx, { x: 300, dir, ph: 1 }, 450, 2.3);
        expect(rec.colors.size).toBeGreaterThan(2);
      }
    }
  });

  test('cada bicho pré-histórico tem o seu som ao empurrar, e o T-rex ruge', () => {
    const s = audibleSfx();
    for (const kind of DINO_ENEMIES) {
      const before = s.ctx.voices;
      s.play('bump', { kind });
      expect(s.ctx.voices, kind).toBeGreaterThan(before);
    }
    const before = s.ctx.voices;
    s.play('growl', { kind: 'trex' });
    expect(s.ctx.voices - before).toBeGreaterThan(3);
  });

  test('os Dinossauros tocam a sua própria trilha (e não têm trenó)', () => {
    const g = makeGame({ level: 30 });
    expect(g.sfx.track).toBe('dino');
    for (let i = 0; i < 30 * 120; i++) g.update(1 / 120);
    expect(g.sleigh.active).toBe(false);
    expect(g.sfx.musicNotes).toBeGreaterThan(100);
    g.level = 31;
    g.startLevel();
    expect(g.sfx.track).toBe(null);
  });

  test('trilha dos Dinossauros: 16 compassos com tambores, marimba, flauta de osso e zumbido', () => {
    const m = MUSIC.dino;
    expect(m.length).toBe(64);
    expect(m.length * m.beat).toBeGreaterThan(20);
    const last = m.events[m.events.length - 1];
    expect(last.beat).toBeLessThan(m.length);
    expect(m.events.length).toBeGreaterThan(64 * 1.5);
  });

  test('trilha dos Dinossauros é sintetizada sem erro, respeita o mudo e para no fim de jogo', () => {
    const s = audibleSfx();
    s.setMusic('dino');
    s.updateMusic(30);
    expect(s.ctx.voices).toBeGreaterThan(0);
    expect(s.musicLoop).toBeGreaterThan(0);

    const m = new Sfx();
    m.setMuted(true);
    m.unlock(FakeAudioContext);
    m.setMusic('dino');
    m.updateMusic(5);
    expect(m.ctx.voices).toBe(0);
    m.setMuted(false);

    const g = makeGame({ level: 30 });
    g.lives = 1;
    g.onPlayerLost();
    expect(g.sfx.track).toBe(null);
  });

  test('troféu dos Dinossauros: nome, fita verde-oliva e emblema de pegada com vulcão', () => {
    const tr = trophyFor(30);
    expect(tr.name).toBe('Troféu dos Dinossauros');
    expect(tr.ribbon).toBe('#6B8E23');
    const rec = recordingCtx();
    TROPHY_EMBLEMS.dinossauros(rec.ctx);
    expect(rec.colors.has('#5FA83A'), 'pegada verde').toBe(true);
    expect(rec.colors.has('#4A2A32'), 'vulcão').toBe(true);
  });

  test('temperatura, vidas e regras continuam as mesmas nos Dinossauros', () => {
    const g = makeGame({ level: 30 });
    expect(g.temp).toBe(RULES.tempStart);
    expect(g.lives).toBe(RULES.startLives);
    step(g, 3.5);
    expect(g.temp).toBe(RULES.tempStart - 3);
  });
});
