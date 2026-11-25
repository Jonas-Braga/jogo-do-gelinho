// Fase especial 35: Piratas (enseada ao entardecer, barris boiando, forte pirata,
// papagaios, polvos e tubarões, garrafas com mensagem no lugar dos peixes, o pirata de
// chapéu de três pontas e tapa-olho e um crocodilo pirata no lugar do urso).
// Só o visual muda (e o ritmo, como toda especial).
import { suite, test, expect } from '../harness.js';
import { makeGame, step, stepUntil, enterIgloo } from '../helpers.js';
import { specialFor, trophyFor } from '../../src/specials.js';
import { levelParams, levelIntro } from '../../src/levels.js';
import { SIZE } from '../../src/enemies.js';
import {
  COVE, GOLD, BARREL_WOOD, FORT_PIECES, FORT_VENT, CROC, PARROT, OCTOPUS, SHARK, BOTTLE, CHEST, CANNON, ANCHOR, JOLLY,
  drawParrot, drawOctopus, drawShark, drawBottle, drawCroc, barrelSprite,
} from '../../src/pirate.js';
import { TROPHY_EMBLEMS } from '../../src/trophies.js';
import { drawPlayer, drawBear, BEAR_FUR, PIRATE_STRIPE, PIRATE_HAT } from '../../src/sprites.js';
import { Sfx, MUSIC } from '../../src/audio.js';
import { W, RULES, IGLOO } from '../../src/config.js';
import { Game } from '../../src/game.js';
import { fakeCanvas } from '../env.js';
import {
  model, SUBJECTS, THEMES_3D, FISH_3D, CRITTERS_3D, SCENERY_3D, levelModels, barrelSprite3D, drawFort3D,
} from '../../src/model3d.js';
import { DOOR_MODELS } from '../../src/m3d/doors.js';

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

const PIRATE_ENEMIES = ['parrot', 'octopus', 'shark'];

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

suite('Fases especiais · Piratas (fase 35)', () => {
  test('fase 35 é a especial dos Piratas; 34 e 36 são normais', () => {
    expect(specialFor(35).id).toBe('piratas');
    expect(levelParams(35).special.id).toBe('piratas');
    expect(levelParams(34).special).toBe(null);
    expect(levelParams(36).special).toBe(null);
  });

  test('aviso de início anuncia os piratas, os barris e o forte', () => {
    const intro = levelIntro(35);
    expect(intro.title).toContain('PIRATAS');
    expect(intro.sub).toContain('barris');
    expect(intro.sub).toContain('forte');
  });

  test('os Piratas são mais lentos (80%) e o resto da dificuldade igual', () => {
    const p = levelParams(35);
    const before = levelParams(34);
    expect(specialFor(35).pace).toBe(0.8);
    expect(p.enemySpeed).toBeCloseTo(before.enemySpeed * 0.8);
    expect(p.bearSpeed).toBeCloseTo(before.bearSpeed * 0.8);
    expect(p.bear).toBe(true);
    expect(p.maxGroup).toBe(before.maxGroup);
    expect(p.fishChance).toBe(before.fishChance);
    expect(p.powers, 'fase especial não tem poderes').toEqual([]);
  });

  test('inimigos são papagaios, polvos e tubarões (os três aparecem), com o tamanho dos que substituem', () => {
    const g = makeGame({ level: 35, quiet: false });
    const seen = new Set();
    for (let i = 0; i < 300; i++) {
      g.critters.list = [];
      g.critters.spawn(i % 4);
      for (const c of g.critters.list) if (c.kind !== 'fish') seen.add(c.kind);
    }
    expect([...seen].sort()).toEqual([...PIRATE_ENEMIES].sort());
    expect(SIZE.parrot).toBe(SIZE.goose);
    expect(SIZE.octopus).toBe(SIZE.crab);
    expect(SIZE.shark).toBe(SIZE.clam);
    for (const level of [30, 34, 36]) {
      const n = makeGame({ level, quiet: false });
      for (let i = 0; i < 60; i++) n.critters.spawn(i % 4);
      for (const c of n.critters.list) expect(PIRATE_ENEMIES.includes(c.kind), `fase ${level}`).toBe(false);
    }
  });

  test('papagaios, polvos e tubarões empurram o jogador e têm som próprio', () => {
    for (const kind of PIRATE_ENEMIES) {
      const g = makeGame({ level: 35 });
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
    for (const kind of PIRATE_ENEMIES) {
      const before = s.ctx.voices;
      s.play('bump', { kind });
      expect(s.ctx.voices, kind).toBeGreaterThan(before);
    }
    const before = s.ctx.voices;
    s.play('growl', { kind: 'croc' });
    expect(s.ctx.voices - before).toBeGreaterThan(3);
  });

  test('garrafa com mensagem no lugar do peixe: mesmos pontos, desenho próprio', () => {
    const g = makeGame({ level: 35 });
    const p = g.player;
    p.state = 'stand';
    p.row = 2;
    p.x = 600;
    g.critters.list = [{ kind: 'fish', row: 2, dir: 1, vx: 0, x: 600, w: SIZE.fish, ph: 0 }];
    expect(drawn(g).colors.has(BOTTLE.paper)).toBe(true);
    const before = g.score;
    g.critters.update(1 / 120);
    expect(g.score - before).toBe(g.params.fishPoints);
    const n = makeGame({ level: 34 });
    n.critters.list = [{ kind: 'fish', row: 2, dir: 1, vx: 0, x: 600, w: SIZE.fish, ph: 0 }];
    expect(drawn(n).colors.has(BOTTLE.paper)).toBe(false);
  });

  test('o forte tem 16 peças, com a porta por último e a fumaça saindo do braseiro da torre', () => {
    expect(FORT_PIECES.length).toBe(RULES.iglooPieces);
    expect(FORT_PIECES[RULES.iglooPieces - 1].kind).toBe('door');
    const count = (k) => FORT_PIECES.filter((p) => p.kind === k).length;
    expect(count('wall')).toBe(6);
    expect(count('merlon')).toBe(3);
    expect(count('cannon')).toBe(2);
    for (const k of ['tower', 'flag', 'lantern', 'window']) expect(count(k), k).toBe(1);
    const g = makeGame({ level: 35 });
    expect(g.igloo.style).toBe('fort');
    expect(g.igloo.ventPos).toEqual(FORT_VENT);
    expect(g.igloo.dustColor).toBe(COVE.sand);
    for (let i = 0; i < RULES.iglooPieces; i++) {
      const w = g.igloo.pieceWorld(i);
      expect(Math.abs(w.x - IGLOO.x), `peça ${i}`).toBeLessThan(170);
      expect(w.x, `peça ${i} dentro da tela`).toBeLessThan(W);
      expect(w.y, `peça ${i}`).toBeLessThan(IGLOO.baseY + 1);
    }
    g.onLand(1);
    g.onLand(2);
    expect(g.igloo.count).toBe(2);
    g.level = 36;
    g.startLevel();
    expect(g.igloo.style).toBe('igloo');
    expect(new Game(fakeCanvas(), { title: true }).igloo.style).toBe('igloo');
  });

  test('HUD conta as peças do forte e fala em barril; a pausa também', () => {
    const g = makeGame({ level: 35 });
    g.onLand(0);
    let texts = drawn(g).texts;
    expect(texts).toContain('forte 1/16');
    expect(texts.some((s) => s.includes('inverter barril'))).toBe(true);
    g.paused = true;
    texts = drawn(g).texts;
    expect(texts).toContain('pular entre a costa e os barris');
    expect(texts).toContain('entrar no forte pronto');
  });

  test('forte pronto: o pirata entra, a porta fecha e a fase termina com a fumaça saindo do braseiro', () => {
    const g = makeGame({ level: 35 });
    while (!g.igloo.complete) g.igloo.add();
    step(g, 1);
    expect(drawn(g).colors.has(JOLLY), 'bandeira de caveira').toBe(true);
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
    expect(Math.abs(smoke.x - FORT_VENT.x)).toBeLessThan(10);
  });

  test('barris boiando no lugar das placas: aros dourados quando a fileira acende', () => {
    const kinds = (g) => new Set(g.rows.flatMap((r) => r.pieces.flatMap((pc) => Object.keys(pc.sprites))));
    const d = makeGame({ level: 35 });
    d.rows[0].active = true;
    drawn(d);
    expect([...kinds(d)].sort()).toEqual(['barrelOff', 'barrelOn']);
    for (const w of [36, 82]) {
      const piece = { w, k: 0, seed: 3, sprites: {} };
      expect(barrelSprite(piece, false).w).toBeGreaterThan(w);
      expect(barrelSprite(piece, true).w).toBeGreaterThan(w);
    }
    expect(GOLD).toBe('#FFC83A');
    expect(BARREL_WOOD).toBe('#9A6234');
  });

  test('baú do tesouro, canhão e âncora na praia, longe do forte; nada caindo do céu, sem aurora e sem vapor', () => {
    for (const d of [CHEST, CANNON, ANCHOR]) expect(IGLOO.x - d.x).toBeGreaterThan(300);
    const g = makeGame({ level: 35 });
    expect(g.particles.calm).toBe(true);
    expect(g.particles.liquid).toBe(null);
    drawn(g);
    expect(g.renderer.aurora).toBe(0);
    g.temp = RULES.breathBelow - 5;
    g.player.state = 'stand';
    step(g, 3);
    expect(g.particles.fx.some((f) => f.kind === 'vapor'), 'calor: sem vapor').toBe(false);
  });

  test('pirata (camisa listrada, chapéu de três pontas) em todas as poses, só nos Piratas', () => {
    expect(drawn(makeGame({ level: 35 })).colors.has(PIRATE_STRIPE)).toBe(true);
    expect(drawn(makeGame({ level: 34 })).colors.has(PIRATE_STRIPE)).toBe(false);
    const g = makeGame({ level: 35 });
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
      drawPlayer(rec.ctx, p, 1, 0, 0, 'pirate');
      expect(rec.colors.has(PIRATE_STRIPE), `pose ${i}: listras`).toBe(true);
      expect(rec.colors.has(PIRATE_HAT), `pose ${i}: chapéu`).toBe(true);
    }
  });

  test('crocodilo pirata no lugar do urso, nos dois sentidos, de boca aberta perseguindo; e foge dele como do urso', () => {
    const c = drawn(makeGame({ level: 35, quiet: false })).colors;
    expect(c.has(CROC.bandana)).toBe(true);
    expect(c.has(BEAR_FUR.polar.legFront)).toBe(false);
    for (const chasing of [false, true]) {
      for (const dir of [1, -1]) {
        const rec = recordingCtx();
        drawBear(rec.ctx, { x: 400, y: 250, dir, walk: 0.7, chasing }, 0.3, 'croc');
        expect(rec.colors.has(CROC.teeth), 'dentes').toBe(true);
        expect(rec.colors.has(CROC.patch), 'tapa-olho').toBe(true);
      }
    }
    const g = makeGame({ level: 35 });
    g.bear.active = true;
    g.bear.x = 600;
    g.bear.dir = 1;
    g.player.x = 620;
    g.player.invuln = 0;
    step(g, 0.1);
    expect(g.player.state).toBe('flee');
    expect(g.bear.chasing).toBe(true);
  });

  test('papagaio, polvo, tubarão e garrafa são desenhados nos dois sentidos', () => {
    for (const draw of [drawParrot, drawOctopus, drawShark, drawBottle]) {
      for (const dir of [1, -1]) {
        const rec = recordingCtx();
        draw(rec.ctx, { x: 300, dir, ph: 1 }, 450, 2.3);
        expect(rec.colors.size).toBeGreaterThan(2);
      }
    }
    for (const col of [PARROT.body, OCTOPUS.skin, SHARK.fin]) expect(typeof col).toBe('string');
    const rec = recordingCtx();
    drawCroc(rec.ctx, { x: 0, y: 250, dir: 1, walk: 0, chasing: true }, 0.5);
    expect(rec.colors.has(CROC.mouth), 'boca aberta na perseguição').toBe(true);
  });

  test('os Piratas tocam a sua própria trilha: 16 compassos de sanfona, um-pá e sino do navio', () => {
    const g = makeGame({ level: 35 });
    expect(g.sfx.track).toBe('pirata');
    g.level = 36;
    g.startLevel();
    expect(g.sfx.track).toBe(null);
    const m = MUSIC.pirata;
    expect(m.length).toBe(64);
    expect(m.length * m.beat).toBeGreaterThan(20);
    expect(m.events[m.events.length - 1].beat).toBeLessThan(m.length);
    expect(m.events.length).toBeGreaterThan(64 * 1.5);
    const s = audibleSfx();
    s.setMusic('pirata');
    s.updateMusic(30);
    expect(s.ctx.voices).toBeGreaterThan(0);
  });

  test('troféu dos Piratas: nome, fita azul-marinho e emblema da bandeira de caveira', () => {
    const tr = trophyFor(35);
    expect(tr.name).toBe('Troféu dos Piratas');
    expect(tr.ribbon).toBe('#1E3A6E');
    const rec = recordingCtx();
    TROPHY_EMBLEMS.piratas(rec.ctx);
    expect(rec.colors.has('#1A1A1E'), 'bandeira preta').toBe(true);
    expect(rec.colors.has('#F2F0E6'), 'caveira').toBe(true);
  });
});

suite('Piratas em 3D', () => {
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

  test('os Piratas são uma fase convertida: pirata, crocodilo, barris, forte, baú, canhão, âncora, bichos e garrafa em 3D', () => {
    expect(THEMES_3D.has('piratas')).toBe(true);
    expect(SCENERY_3D.pirate).toBe('bg-pirate');
    expect(DOOR_MODELS.fort).toBe('door-fort');
    expect(FISH_3D.pirate).toBe('bottle');
    for (const k of ['parrot', 'octopus', 'shark', 'bottle']) expect(CRITTERS_3D.has(k), k).toBe(true);
    withFake((asked) => {
      const g = makeGame({ level: 35, quiet: false });
      step(g, 6);
      Object.assign(g.bear, { active: true, x: 400, dir: 1, chasing: true });
      for (let i = 0; i < 8; i++) g.igloo.add();
      g.igloo.update(5);
      g.critters.list.length = 0;
      for (const [k, kind] of ['parrot', 'octopus', 'shark', 'fish'].entries()) {
        g.critters.list.push({ kind, row: k, dir: 1, vx: 0, x: 300 + k * 200, w: 30, ph: 0 });
      }
      g.renderer.use3d = true;
      const { ctx } = recordingCtx();
      g.renderer.ctx = ctx;
      g.renderer.draw(g);
      const has = (pre) => asked.some((k) => k.startsWith(pre));
      for (const pre of ['player-pirate:', 'croc:', 'barrel', 'fort:', 'chest:', 'cannon:', 'anchor:', 'parrot:', 'octopus:', 'shark:', 'bottle:', 'bg-pirate:']) {
        expect(has(pre), pre).toBe(true);
      }
      expect(has('fish:')).toBe(false);
    });
    const list = levelModels(35);
    for (const n of ['bg-pirate', 'fort', 'door-fort', 'player-pirate', 'croc', 'chest', 'cannon', 'anchor', 'bottle', 'parrot']) expect(list, n).toContain(n);
  });

  test('toda foto pedida existe (bichos, garrafa e o crocodilo andando e perseguindo)', () => {
    for (const kind of ['parrot', 'octopus', 'shark', 'bottle']) {
      const S = SUBJECTS[kind];
      const keys = new Set(S.poses().map((p) => p.key));
      for (const dir of [1, -1]) for (let t = 0; t < 3; t += 0.011) expect(keys.has(S.pose({ dir, ph: 0.7 }, t)), kind).toBe(true);
    }
    const C = SUBJECTS.croc;
    const keys = new Set(C.poses().map((p) => p.key));
    for (const chasing of [false, true]) {
      for (const dir of [1, -1]) {
        for (let t = 0; t < 6; t += 0.05) expect(keys.has(C.pose({ walk: t * 3, dir, chasing }, t))).toBe(true);
      }
    }
  });

  test('a foto dos barris tem as mesmas medidas do sprite 2D; o forte usa as fotos assentadas, a que cai e a acesa', () => {
    withFake((asked, img) => {
      for (const w of [36, 82]) {
        const s = barrelSprite3D({ w, seed: 8, sprites: {} }, true);
        expect(s.canvas).toBe(img);
        expect([s.ox, s.oy, s.w, s.h]).toEqual([12, 26, w + 24, 62]);
      }
      const keys = new Set(SUBJECTS.fort.poses().map((p) => p.key));
      for (let n = 1; n < FORT_PIECES.length; n++) expect(keys.has(`n${n}`)).toBe(true);
      for (let i = 0; i < FORT_PIECES.length - 1; i++) expect(keys.has(`b${i}`)).toBe(true);
      expect(keys.has('lit')).toBe(true);
      const g = makeGame({ level: 35 });
      for (let i = 0; i < 5; i++) g.igloo.add();
      g.igloo.update(5);
      g.igloo.add();
      const { ctx } = recordingCtx();
      expect(drawFort3D(ctx, g.igloo, 0)).toBe(true);
      expect(asked.includes('fort:n5')).toBe(true);
      expect(asked.includes('fort:b5')).toBe(true);
      while (!g.igloo.complete) g.igloo.add();
      g.igloo.update(5);
      g.igloo.lit = true;
      asked.length = 0;
      drawFort3D(recordingCtx().ctx, g.igloo, 0);
      expect(asked.includes('fort:lit')).toBe(true);
    });
  });
});

suite('Ajustes: mar 3D ao fundo, reflexo do sol ao se pôr, valores e matinho dos Piratas', () => {
  test('peixe vale 100, o chute 50 e o saco de dinheiro 1.000 (o jogo estava fácil demais)', async () => {
    const { BONUS } = await import('../../src/bonus.js');
    const { POWERS } = await import('../../src/powers.js');
    for (const lv of [1, 11, 35, 57]) expect(levelParams(lv).fishPoints, `fase ${lv}`).toBe(100);
    expect(Math.round(levelParams(12).fishPoints * POWERS.kickShare)).toBe(50);
    expect(BONUS.bagPoints).toBe(1000);
  });

  test('o reflexo do sol na água some quando o sol se põe atrás do horizonte', async () => {
    const { bodyAbove } = await import('../../src/renderer.js');
    expect(bodyAbove({ y: 60, r: 22 }, 150)).toBe(1);
    expect(bodyAbove({ y: 150, r: 22 }, 150)).toBeCloseTo(0.5);
    expect(bodyAbove({ y: 175, r: 22 }, 150)).toBe(0);
    expect(bodyAbove({ y: 175, r: 22 }, null), 'sem medida do horizonte, não muda').toBe(1);
  });

  test('Praia e Piratas: o mar ao fundo é uma camada 3D ao vivo, por trás da foto do cenário', async () => {
    const { SEA_BAND } = await import('../../src/model3d.js');
    for (const k of ['beach', 'pirate']) {
      const b = SEA_BAND[k];
      expect(b.top, k).toBe(150);
      expect(b.bottom).toBeGreaterThan(185);
      expect(b.s0).toBeLessThan(b.s1);
    }
    const was = { ...model };
    const img = { fake3d: true };
    try {
      model.state = 'ready';
      model.sprites = new Proxy({}, { get: () => img });
      for (const [lv, want] of [[35, true], [1, false]]) {
        const g = makeGame({ level: lv });
        g.renderer.use3d = true;
        g.renderer.only3d = true;
        const order = [];
        g.renderer.sea3d = () => ({ draw: () => (order.push('mar'), true) });
        // Camadas falsas: as de verdade (antes do Three.js carregar) ficariam marcadas como falhas
        g.renderer.water3d = () => null;
        g.renderer.sky3d = () => null;
        g.renderer.particles3d = () => null;
        const rec = recordingCtx();
        const draw = rec.ctx.drawImage;
        g.renderer.ctx = new Proxy(rec.ctx, { get: (o, k) => (k === 'drawImage' ? (...a) => { if (a[0] === img) order.push('foto'); return draw(...a); } : o[k]) });
        g.renderer.draw(g);
        if (want) expect(order.indexOf('mar'), `fase ${lv}`).toBeLessThan(order.indexOf('foto'));
        else expect(order.includes('mar'), `fase ${lv}`).toBe(false);
      }
    } finally {
      Object.assign(model, was);
    }
  });

  test('o matinho do primeiro plano dos Piratas cobre toda a borda de baixo (não só os cantos)', async () => {
    const { FG_KINDS } = await import('../../src/depth.js');
    expect(FG_KINDS.pirate.full).toBeGreaterThan(0.2);
    expect(FG_KINDS.pirate.blur).toBeLessThan(3.5);
    expect(FG_KINDS.beach.full ?? 0).toBe(0);
  });
});
