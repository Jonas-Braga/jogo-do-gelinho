// Fase especial 40: Reino dos doces (rio de chocolate, biscoitos waffle boiando, casa de
// biscoito de gengibre, abelhas, minhocas de goma e balas de goma, rosquinhas no lugar
// dos peixes, o confeiteiro de chapéu de chef e um homem-biscoito gigante no lugar do
// urso). Só o visual muda (e o ritmo, como toda especial).
import { suite, test, expect } from '../harness.js';
import { makeGame, step, stepUntil, enterIgloo } from '../helpers.js';
import { specialFor, trophyFor } from '../../src/specials.js';
import { levelParams, levelIntro } from '../../src/levels.js';
import { SIZE } from '../../src/enemies.js';
import {
  CANDY, WAFFLE, PINK_ICING, GINGER_PIECES, GINGER_VENT, GINGER, BEE, WORM, GUMMY, DONUT, LOLLIPOP, CANE, GUMDROPS,
  drawBee, drawWorm, drawGummy, drawDonut, drawGingerman, cookieSprite,
} from '../../src/candy.js';
import { TROPHY_EMBLEMS } from '../../src/trophies.js';
import { drawPlayer, drawBear, BEAR_FUR, BAKER_APRON, CHEF_HAT } from '../../src/sprites.js';
import { Sfx, MUSIC } from '../../src/audio.js';
import { W, RULES, IGLOO } from '../../src/config.js';
import { Game } from '../../src/game.js';
import { fakeCanvas, isNode } from '../env.js';
import {
  model, SUBJECTS, THEMES_3D, FISH_3D, CRITTERS_3D, SCENERY_3D, levelModels, cookieSprite3D, drawGinger3D,
} from '../../src/model3d.js';
import { DOOR_MODELS, DOOR_SUBJECTS } from '../../src/m3d/doors.js';
import { OUTFITS_3D } from '../../src/m3d/player.js';

function recordingCtx() {
  const colors = new Set();
  const texts = [];
  const calls = [];
  const gradient = { addColorStop: (_o, c) => colors.add(String(c)) };
  const store = {
    measureText: (s) => ({ width: String(s).length * 7 }),
    fillText: (s) => texts.push(String(s)),
  };
  const ctx = new Proxy(store, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a) => {
        calls.push([k, ...a]);
        return gradient;
      };
    },
    set(t, k, v) {
      if (k === 'fillStyle' || k === 'strokeStyle') colors.add(String(v));
      t[k] = v;
      return true;
    },
  });
  return { ctx, colors, texts, calls };
}

function drawn(g) {
  const rec = recordingCtx();
  g.renderer.ctx = rec.ctx;
  g.renderer.draw(g);
  return rec;
}

const CANDY_ENEMIES = ['bee', 'worm', 'gummy'];

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

suite('Fases especiais · Reino dos doces (fase 40)', () => {
  test('fase 40 é a especial do Reino dos doces; 39 e 41 são normais', () => {
    expect(specialFor(40).id).toBe('doces');
    expect(levelParams(40).special.id).toBe('doces');
    expect(levelParams(39).special).toBe(null);
    expect(levelParams(41).special).toBe(null);
  });

  test('aviso de início anuncia os doces, os biscoitos e a casa de biscoito', () => {
    const intro = levelIntro(40);
    expect(intro.title).toContain('DOCES');
    expect(intro.sub).toContain('biscoitos');
    expect(intro.sub).toContain('casa de biscoito');
  });

  test('o Reino dos doces é mais lento (80%) e o resto da dificuldade igual', () => {
    const p = levelParams(40);
    const before = levelParams(39);
    expect(specialFor(40).pace).toBe(0.8);
    expect(p.enemySpeed).toBeCloseTo(before.enemySpeed * 0.8);
    expect(p.bearSpeed).toBeCloseTo(before.bearSpeed * 0.8);
    expect(p.bear).toBe(true);
    expect(p.maxGroup).toBe(before.maxGroup);
    expect(p.fishChance).toBe(before.fishChance);
    expect(p.powers, 'fase especial não tem poderes').toEqual([]);
  });

  test('inimigos são abelhas, minhocas de goma e balas de goma (os três aparecem), com o tamanho dos que substituem', () => {
    const g = makeGame({ level: 40, quiet: false });
    const seen = new Set();
    for (let i = 0; i < 300; i++) {
      g.critters.list = [];
      g.critters.spawn(i % 4);
      for (const c of g.critters.list) if (c.kind !== 'fish') seen.add(c.kind);
    }
    expect([...seen].sort()).toEqual([...CANDY_ENEMIES].sort());
    expect(SIZE.bee).toBe(SIZE.goose);
    expect(SIZE.worm).toBe(SIZE.crab);
    expect(SIZE.gummy).toBe(SIZE.clam);
    for (const level of [35, 39, 41]) {
      const n = makeGame({ level, quiet: false });
      for (let i = 0; i < 60; i++) n.critters.spawn(i % 4);
      for (const c of n.critters.list) expect(CANDY_ENEMIES.includes(c.kind), `fase ${level}`).toBe(false);
    }
  });

  test('abelhas, minhocas e balas de goma empurram o jogador e têm som próprio; o homem-biscoito também', () => {
    for (const kind of CANDY_ENEMIES) {
      const g = makeGame({ level: 40 });
      const p = g.player;
      p.state = 'stand';
      p.row = 1;
      p.x = 600;
      g.critters.list = [{ kind, row: 1, dir: -g.rows[1].dir, vx: 0, x: 0, w: SIZE[kind], ph: 0 }];
      g.critters.list[0].x = p.x - g.critters.list[0].dir * 10;
      const x0 = p.x;
      g.critters.update(1 / 120);
      expect(p.x, kind).not.toBe(x0);
    }
    const s = audibleSfx();
    for (const kind of CANDY_ENEMIES) {
      const before = s.ctx.voices;
      s.play('bump', { kind });
      expect(s.ctx.voices, kind).toBeGreaterThan(before);
    }
    const before = s.ctx.voices;
    s.play('growl', { kind: 'gingerman' });
    expect(s.ctx.voices - before).toBeGreaterThan(3);
  });

  test('rosquinha no lugar do peixe: mesmos pontos, desenho próprio', () => {
    const g = makeGame({ level: 40 });
    const p = g.player;
    p.state = 'stand';
    p.row = 2;
    p.x = 600;
    g.critters.list = [{ kind: 'fish', row: 2, dir: 1, vx: 0, x: 600, w: SIZE.fish, ph: 0 }];
    expect(drawn(g).colors.has(DONUT.icing)).toBe(true);
    const before = g.score;
    g.critters.update(1 / 120);
    expect(g.score - before).toBe(g.params.fishPoints);
    const n = makeGame({ level: 39 });
    n.critters.list = [{ kind: 'fish', row: 2, dir: 1, vx: 0, x: 600, w: SIZE.fish, ph: 0 }];
    expect(drawn(n).colors.has(DONUT.icing)).toBe(false);
  });

  test('a casa de biscoito tem 16 peças, com a porta por último e a fumaça saindo da chaminé de bombom', () => {
    expect(GINGER_PIECES.length).toBe(RULES.iglooPieces);
    expect(GINGER_PIECES[RULES.iglooPieces - 1].kind).toBe('door');
    const count = (k) => GINGER_PIECES.filter((p) => p.kind === k).length;
    expect(count('wall')).toBe(6);
    expect(count('roof')).toBe(2);
    expect(count('window')).toBe(2);
    expect(count('cane')).toBe(2);
    for (const k of ['icing', 'peppermint', 'chimney']) expect(count(k), k).toBe(1);
    const g = makeGame({ level: 40 });
    expect(g.igloo.style).toBe('ginger');
    expect(g.igloo.ventPos).toEqual(GINGER_VENT);
    expect(g.igloo.dustColor).toBe(CANDY.sand);
    for (let i = 0; i < RULES.iglooPieces; i++) {
      const w = g.igloo.pieceWorld(i);
      expect(Math.abs(w.x - IGLOO.x), `peça ${i}`).toBeLessThan(170);
      expect(w.x, `peça ${i} dentro da tela`).toBeLessThan(W);
      expect(w.y, `peça ${i}`).toBeLessThan(IGLOO.baseY + 1);
    }
    g.onLand(1);
    g.onLand(2);
    expect(g.igloo.count).toBe(2);
    g.level = 41;
    g.startLevel();
    expect(g.igloo.style).toBe('igloo');
    expect(new Game(fakeCanvas(), { title: true }).igloo.style).toBe('igloo');
  });

  test('HUD conta as peças da casa e fala em biscoito; a pausa também', () => {
    const g = makeGame({ level: 40 });
    g.onLand(0);
    let texts = drawn(g).texts;
    expect(texts).toContain('casa 1/16');
    expect(texts.some((s) => s.includes('inverter biscoito'))).toBe(true);
    g.paused = true;
    texts = drawn(g).texts;
    expect(texts).toContain('pular entre a costa e os biscoitos');
    expect(texts).toContain('entrar na casa de biscoito pronta');
  });

  test('casa pronta: o confeiteiro entra, a porta de chocolate fecha e a fase termina com a fumaça saindo da chaminé', () => {
    const g = makeGame({ level: 40 });
    while (!g.igloo.complete) g.igloo.add();
    step(g, 1);
    expect(drawn(g).colors.has('#E0283A'), 'bengalas e a janela de hortelã').toBe(true);
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
    stepUntil(g, () => g.particles.fx.some((f) => f.kind === 'smoke'), 2);
    const smoke = g.particles.fx.find((f) => f.kind === 'smoke');
    expect(Math.abs(smoke.x - GINGER_VENT.x)).toBeLessThan(10);
  });

  test('biscoitos waffle boiando no lugar das placas: glacê rosa quando a fileira acende', () => {
    const kinds = (g) => new Set(g.rows.flatMap((r) => r.pieces.flatMap((pc) => Object.keys(pc.sprites))));
    const d = makeGame({ level: 40 });
    d.rows[0].active = true;
    drawn(d);
    expect([...kinds(d)].sort()).toEqual(['cookieOff', 'cookieOn']);
    for (const w of [36, 82]) {
      const piece = { w, k: 0, seed: 3, sprites: {} };
      expect(cookieSprite(piece, false).w).toBeGreaterThan(w);
      expect(cookieSprite(piece, true).w).toBeGreaterThan(w);
    }
    expect(WAFFLE).toBe('#E2A65A');
    expect(PINK_ICING).toBe('#FF9ACB');
  });

  test('pirulito, bengala e balas de goma na costa, longe da casa; açúcar caindo do céu, sem aurora e sem vapor', () => {
    for (const d of [LOLLIPOP, CANE, GUMDROPS]) expect(IGLOO.x - d.x).toBeGreaterThan(300);
    const g = makeGame({ level: 40 });
    // O açúcar de confeiteiro é a "neve" de sempre
    expect(g.particles.calm).toBe(false);
    expect(g.particles.leaves).toBe(false);
    expect(g.particles.embers).toBe(false);
    expect(g.particles.liquid).toBe(null);
    drawn(g);
    expect(g.renderer.aurora).toBe(0);
    g.temp = RULES.breathBelow - 5;
    g.player.state = 'stand';
    step(g, 3);
    expect(g.particles.fx.some((f) => f.kind === 'vapor'), 'reino quentinho: sem vapor').toBe(false);
  });

  test('confeiteiro (avental rosa, chapéu de chef) em todas as poses, só no Reino dos doces', () => {
    expect(drawn(makeGame({ level: 40 })).colors.has(BAKER_APRON)).toBe(true);
    expect(drawn(makeGame({ level: 39 })).colors.has(BAKER_APRON)).toBe(false);
    const g = makeGame({ level: 40 });
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
      drawPlayer(rec.ctx, p, 1, 0, 0, 'baker');
      expect(rec.colors.has(BAKER_APRON), `pose ${i}: avental`).toBe(true);
      expect(rec.colors.has(CHEF_HAT), `pose ${i}: chapéu`).toBe(true);
    }
  });

  test('homem-biscoito no lugar do urso, nos dois sentidos, de boca aberta perseguindo; e foge dele como do urso', () => {
    const c = drawn(makeGame({ level: 40, quiet: false })).colors;
    expect(c.has(GINGER.buttons[0])).toBe(true);
    expect(c.has(BEAR_FUR.polar.legFront)).toBe(false);
    for (const chasing of [false, true]) {
      for (const dir of [1, -1]) {
        const rec = recordingCtx();
        drawBear(rec.ctx, { x: 400, y: 250, dir, walk: 0.7, chasing }, 0.3, 'gingerman');
        expect(rec.colors.has(GINGER.icing), 'glacê').toBe(true);
        expect(rec.colors.has(GINGER.buttons[1]), 'botões de bala').toBe(true);
      }
    }
    const rec = recordingCtx();
    drawGingerman(rec.ctx, { x: 0, y: 250, dir: 1, walk: 0, chasing: true }, 0.5);
    expect(rec.colors.has(GINGER.mouth), 'boca aberta na perseguição').toBe(true);
    const g = makeGame({ level: 40 });
    g.bear.active = true;
    g.bear.x = 600;
    g.bear.dir = 1;
    g.player.x = 620;
    g.player.invuln = 0;
    step(g, 0.1);
    expect(g.player.state).toBe('flee');
    expect(g.bear.chasing).toBe(true);
  });

  test('abelha, minhoca, bala de goma e rosquinha são desenhadas nos dois sentidos', () => {
    for (const draw of [drawBee, drawWorm, drawGummy, drawDonut]) {
      for (const dir of [1, -1]) {
        const rec = recordingCtx();
        draw(rec.ctx, { x: 300, dir, ph: 1 }, 450, 2.3);
        expect(rec.colors.size).toBeGreaterThan(2);
      }
    }
    for (const col of [BEE.body, WORM.colors[0], GUMMY.colors[0]]) expect(typeof col).toBe('string');
  });

  test('o Reino dos doces toca a sua própria trilha: 16 compassos de celesta, caixinha de música e pizzicato', () => {
    const g = makeGame({ level: 40 });
    expect(g.sfx.track).toBe('doces');
    g.level = 41;
    g.startLevel();
    expect(g.sfx.track).toBe(null);
    const m = MUSIC.doces;
    expect(m.length).toBe(64);
    expect(m.length * m.beat).toBeGreaterThan(20);
    expect(m.events[m.events.length - 1].beat).toBeLessThan(m.length);
    expect(m.events.length).toBeGreaterThan(64 * 1.5);
    const s = audibleSfx();
    s.setMusic('doces');
    s.updateMusic(30);
    expect(s.ctx.voices).toBeGreaterThan(0);
  });

  test('troféu do Reino dos doces: nome, fita rosa e emblema do pirulito com o cupcake', () => {
    const tr = trophyFor(40);
    expect(tr.name).toBe('Troféu do Reino dos Doces');
    expect(tr.ribbon).toBe('#E8559A');
    const rec = recordingCtx();
    TROPHY_EMBLEMS.doces(rec.ctx);
    expect(rec.colors.has('#FF9ACB'), 'glacê rosa').toBe(true);
    expect(rec.colors.has('#D8202E'), 'cereja').toBe(true);
  });
});

suite('Reino dos doces em 3D', () => {
  const withFake = (fn) => {
    const was = { ...model };
    const asked = [];
    const img = { fake3d: true };
    try {
      model.state = 'ready';
      model.sprites = new Proxy({}, { get: (_, k) => (asked.push(String(k)), img) });
      fn(asked, img);
    } finally {
      Object.assign(model, was);
    }
  };

  test('o Reino dos doces é uma fase convertida: confeiteiro, homem-biscoito, biscoitos, casa, enfeites, bichos e rosquinha em 3D', () => {
    expect(THEMES_3D.has('doces')).toBe(true);
    expect(SCENERY_3D.candy).toBe('bg-candy');
    expect(DOOR_MODELS.ginger).toBe('door-ginger');
    expect(FISH_3D.candy).toBe('donut');
    expect(OUTFITS_3D).toContain('baker');
    for (const k of ['bee', 'worm', 'gummy', 'donut']) expect(CRITTERS_3D.has(k), k).toBe(true);
    withFake((asked) => {
      const g = makeGame({ level: 40, quiet: false });
      step(g, 6);
      Object.assign(g.bear, { active: true, x: 400, dir: 1, chasing: true });
      for (let i = 0; i < 8; i++) g.igloo.add();
      g.igloo.update(5);
      g.critters.list.length = 0;
      for (const [k, kind] of ['bee', 'worm', 'gummy', 'fish'].entries()) {
        g.critters.list.push({ kind, row: k, dir: 1, vx: 0, x: 300 + k * 200, w: 30, ph: 0 });
      }
      g.renderer.use3d = true;
      const { ctx } = recordingCtx();
      g.renderer.ctx = ctx;
      g.renderer.draw(g);
      const has = (pre) => asked.some((k) => k.startsWith(pre));
      for (const pre of ['player-baker:', 'gingerman:', 'cookie', 'ginger:', 'lollipop:', 'cane:', 'gumdrops:', 'bee:', 'worm:', 'gummy:', 'donut:', 'bg-candy:']) {
        expect(has(pre), pre).toBe(true);
      }
      expect(has('fish:')).toBe(false);
    });
    const list = levelModels(40);
    for (const n of ['bg-candy', 'ginger', 'door-ginger', 'player-baker', 'gingerman', 'lollipop', 'cane', 'gumdrops', 'donut', 'bee', 'worm', 'gummy']) expect(list, n).toContain(n);
  });

  test('toda foto pedida existe (bichos, rosquinha e o homem-biscoito andando e perseguindo)', () => {
    for (const kind of ['bee', 'worm', 'gummy', 'donut']) {
      const S = SUBJECTS[kind];
      const keys = new Set(S.poses().map((p) => p.key));
      for (const dir of [1, -1]) {
        for (const ph of [0, 0.3, 0.7, 1.9]) {
          for (let t = 0; t < 3; t += 0.011) expect(keys.has(S.pose({ dir, ph }, t)), kind).toBe(true);
        }
      }
    }
    const G = SUBJECTS.gingerman;
    const keys = new Set(G.poses().map((p) => p.key));
    for (const chasing of [false, true]) {
      for (const dir of [1, -1]) {
        for (let t = 0; t < 6; t += 0.05) expect(keys.has(G.pose({ walk: t * 3, dir, chasing }, t))).toBe(true);
      }
    }
  });

  test('a foto dos biscoitos tem as mesmas medidas do sprite 2D; a casa usa as fotos assentadas, a que cai e a acesa', () => {
    withFake((asked, img) => {
      for (const w of [36, 82]) {
        const s = cookieSprite3D({ w, seed: 8, sprites: {} }, true);
        expect(s.canvas).toBe(img);
        expect([s.ox, s.oy, s.w, s.h]).toEqual([12, 26, w + 24, 62]);
      }
      const keys = new Set(SUBJECTS.ginger.poses().map((p) => p.key));
      for (let n = 1; n < GINGER_PIECES.length; n++) expect(keys.has(`n${n}`)).toBe(true);
      for (let i = 0; i < GINGER_PIECES.length - 1; i++) expect(keys.has(`b${i}`)).toBe(true);
      expect(keys.has('lit')).toBe(true);
      const g = makeGame({ level: 40 });
      for (let i = 0; i < 5; i++) g.igloo.add();
      g.igloo.update(5);
      g.igloo.add();
      const { ctx } = recordingCtx();
      expect(drawGinger3D(ctx, g.igloo, 0)).toBe(true);
      expect(asked.includes('ginger:n5')).toBe(true);
      expect(asked.includes('ginger:b5')).toBe(true);
      while (!g.igloo.complete) g.igloo.add();
      g.igloo.update(5);
      g.igloo.lit = true;
      asked.length = 0;
      drawGinger3D(recordingCtx().ctx, g.igloo, 0);
      expect(asked.includes('ginger:lit')).toBe(true);
    });
    // Porta de chocolate: interior apagado/aceso, a folha em 13 passos e o batente
    const door = new Set(DOOR_SUBJECTS['door-ginger'].poses().map((p) => p.key));
    for (const k of ['in0', 'in1', 'frame', 'k0', 'k12']) expect(door.has(k), k).toBe(true);
  });

  test('no navegador: a foto do cenário dos doces fica pronta e tem os morros de sorvete e o chão de glacê', async () => {
    if (isNode) return;
    const { want, sprite, photosBusy } = await import('../../src/model3d.js');
    want('bg-candy');
    let img = null;
    for (let i = 0; i < 1200 && !img; i++) {
      await new Promise((r) => setTimeout(r, 100));
      img = sprite('bg-candy', 'main');
      if (model.state === 'failed') return;
    }
    expect(!!img, 'foto pronta em até 120 s').toBe(true);
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const kx = img.width / 1280;
    const ky = img.height / 284;
    // Chão de glacê claro na frente (perto da linha do jogador) e cenário opaco ao fundo
    const at = (x, y) => g.getImageData(Math.round(x * kx), Math.round(y * ky), 1, 1).data;
    const frost = at(700, 235);
    expect(frost[0] > 200 && frost[1] > 190 && frost[2] > 190, `glacê claro: ${frost}`).toBe(true);
    expect(at(380, 150)[3], 'morro de sorvete opaco').toBeGreaterThan(200);
    // Espera a fila de fotos acabar (os testes acima pedem as fotos da fase inteira):
    // com fotos sendo tiradas, os testes seguintes de fps e de pré-carregamento falhariam
    for (let i = 0; i < 3000 && photosBusy(); i++) await new Promise((r) => setTimeout(r, 100));
  });
});
