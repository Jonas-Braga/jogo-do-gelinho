// Fase especial 25: Halloween (lua cheia, cemitério, rio escuro com abóboras,
// casa assombrada, fantasminhas, aranhas e olhos, balas no lugar dos peixes,
// bruxinho e lobisomem). Só o visual muda (e o ritmo, como toda especial).
import { suite, test, expect } from '../harness.js';
import { makeGame, step, stepUntil, enterIgloo } from '../helpers.js';
import { specialFor, trophyFor } from '../../src/specials.js';
import { levelParams, levelIntro } from '../../src/levels.js';
import { SIZE } from '../../src/enemies.js';
import {
  HAUNTED_PIECES, HAUNTED_VENT, HAUNT, WEREWOLF, CANDY_PINK, JACK_ORANGE, WINDOW_GLOW, TREE_BARK,
  DEAD_TREE, SHORE_PUMPKINS, GRAVES, MOON, moonPos,
  drawGhost, drawSpider, drawEyeball, drawCandy, drawWerewolf, pumpkinSprite, drawJack,
} from '../../src/halloween.js';
import { TROPHY_EMBLEMS } from '../../src/trophies.js';
import { drawPlayer, drawBear, BEAR_FUR, WIZARD_ROBE } from '../../src/sprites.js';
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

const HALLOWEEN_ENEMIES = ['ghost', 'spider', 'eyeball'];

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

suite('Fases especiais · Halloween (fase 25)', () => {
  test('fase 25 é a especial de Halloween; 24 e 26 são normais', () => {
    expect(specialFor(25).id).toBe('halloween');
    expect(levelParams(25).special.id).toBe('halloween');
    expect(levelParams(24).special).toBe(null);
    expect(levelParams(26).special).toBe(null);
  });

  test('aviso de início anuncia o Halloween, as abóboras e a casa assombrada', () => {
    const intro = levelIntro(25);
    expect(intro.title).toContain('HALLOWEEN');
    expect(intro.sub).toContain('abóboras');
    expect(intro.sub).toContain('casa assombrada');
  });

  test('o Halloween é mais lento (80%) e o resto da dificuldade igual', () => {
    const p = levelParams(25);
    const before = levelParams(24);
    expect(specialFor(25).pace).toBe(0.8);
    expect(p.speed).toBeCloseTo(Math.min(62 + 24 * 9, 170) * 0.8);
    expect(p.enemySpeed).toBeCloseTo(before.enemySpeed * 0.8);
    expect(p.bearSpeed).toBeCloseTo(before.bearSpeed * 0.8);
    expect(p.fragmented, 'fase ímpar: placas inteiras').toBe(false);
    expect(p.bear).toBe(true);
    expect(p.maxGroup).toBe(before.maxGroup);
    expect(p.fishChance).toBe(before.fishChance);
  });

  test('inimigos são fantasminhas, aranhas e olhos (os três aparecem)', () => {
    const g = makeGame({ level: 25, quiet: false });
    const seen = new Set();
    for (let i = 0; i < 300; i++) {
      g.critters.list = [];
      g.critters.spawn(i % 4);
      for (const c of g.critters.list) if (c.kind !== 'fish') seen.add(c.kind);
    }
    expect([...seen].sort()).toEqual([...HALLOWEEN_ENEMIES].sort());
  });

  test('fora do Halloween não aparecem os bichos do Halloween', () => {
    for (const level of [20, 24, 26]) {
      const g = makeGame({ level, quiet: false });
      for (let i = 0; i < 60; i++) g.critters.spawn(i % 4);
      for (const c of g.critters.list) expect(HALLOWEEN_ENEMIES.includes(c.kind), `fase ${level}`).toBe(false);
    }
  });

  test('bichos do Halloween têm o tamanho de colisão dos que substituem', () => {
    expect(SIZE.ghost).toBe(SIZE.goose);
    expect(SIZE.spider).toBe(SIZE.crab);
    expect(SIZE.eyeball).toBe(SIZE.clam);
  });

  test('fantasminhas, aranhas e olhos empurram o jogador como os outros bichos', () => {
    for (const kind of HALLOWEEN_ENEMIES) {
      const g = makeGame({ level: 25 });
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

  test('bala de Halloween no lugar do peixe: mesmos pontos, desenho próprio', () => {
    const g = makeGame({ level: 25 });
    const p = g.player;
    p.state = 'stand';
    p.row = 2;
    p.x = 600;
    g.critters.list = [{ kind: 'fish', row: 2, dir: 1, vx: 0, x: 600, w: SIZE.fish, ph: 0 }];
    expect(drawn(g).colors.has(CANDY_PINK)).toBe(true);
    const before = g.score;
    g.critters.update(1 / 120);
    expect(g.score - before).toBe(g.params.fishPoints);
    const n = makeGame({ level: 24 });
    n.critters.list = [{ kind: 'fish', row: 2, dir: 1, vx: 0, x: 600, w: SIZE.fish, ph: 0 }];
    expect(drawn(n).colors.has(CANDY_PINK)).toBe(false);
  });

  test('cada fileira de abóboras acrescenta uma peça da casa assombrada', () => {
    const g = makeGame({ level: 25 });
    expect(g.igloo.style).toBe('haunted');
    g.onLand(1);
    g.onLand(2);
    expect(g.igloo.count).toBe(2);
    g.onLand(2);
    expect(g.igloo.count).toBe(2);
  });

  test('a casa assombrada tem 16 peças, com a porta por último e a fumaça na chaminé', () => {
    expect(HAUNTED_PIECES.length).toBe(RULES.iglooPieces);
    expect(HAUNTED_PIECES[RULES.iglooPieces - 1].kind).toBe('door');
    expect(HAUNTED_PIECES.filter((p) => p.kind === 'wall').length).toBe(6);
    expect(HAUNTED_PIECES.filter((p) => p.kind === 'roof').length).toBe(3);
    expect(HAUNTED_PIECES.filter((p) => p.kind === 'window').length).toBe(2);
    for (const k of ['attic', 'chimney', 'lantern', 'vane']) {
      expect(HAUNTED_PIECES.filter((p) => p.kind === k).length, k).toBe(1);
    }
    const g = makeGame({ level: 25 });
    expect(g.igloo.ventPos).toEqual(HAUNTED_VENT);
    expect(g.igloo.dustColor).toBe(HAUNT.mist);
    for (let i = 0; i < RULES.iglooPieces; i++) {
      const w = g.igloo.pieceWorld(i);
      expect(Math.abs(w.x - IGLOO.x), `peça ${i}`).toBeLessThan(170);
      expect(w.x, `peça ${i} dentro da tela`).toBeLessThan(W);
      expect(w.y, `peça ${i}`).toBeLessThan(IGLOO.baseY + 1);
    }
  });

  test('a casa assombrada aparece só no Halloween; iglu nas outras fases e na tela inicial', () => {
    const g = makeGame({ level: 25 });
    g.level = 26;
    g.startLevel();
    expect(g.igloo.style).toBe('igloo');
    const t = new Game(fakeCanvas(), { title: true });
    expect(t.igloo.style).toBe('igloo');
    expect(t.particles.leaves).toBe(false);
  });

  test('HUD conta as peças da casa e fala em abóbora; a pausa também', () => {
    const g = makeGame({ level: 25 });
    g.onLand(0);
    let texts = drawn(g).texts;
    expect(texts).toContain('casa 1/16');
    expect(texts.some((s) => s.includes('inverter abóbora'))).toBe(true);
    g.paused = true;
    texts = drawn(g).texts;
    expect(texts).toContain('pular entre a costa e as abóboras');
    expect(texts).toContain('entrar na casa assombrada pronta');
  });

  test('casa pronta: o bruxinho entra, a porta de tábuas fecha e a fase termina', () => {
    const g = makeGame({ level: 25 });
    while (!g.igloo.complete) g.igloo.add();
    step(g, 1);
    expect(drawn(g).colors.has('#1A1224'), 'janelas com caixilho').toBe(true);
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
    expect(Math.abs(smoke.x - HAUNTED_VENT.x)).toBeLessThan(10);
  });

  test('abóboras boiando no lugar das placas: entalhadas e acesas quando a fileira acende', () => {
    const kinds = (g) => new Set(g.rows.flatMap((r) => r.pieces.flatMap((pc) => Object.keys(pc.sprites))));
    const h = makeGame({ level: 25 });
    h.rows[0].active = true;
    drawn(h);
    expect([...kinds(h)].sort()).toEqual(['pumpkinOff', 'pumpkinOn']);
    const n = makeGame({ level: 24 });
    drawn(n);
    expect(kinds(n).has('pumpkinOff')).toBe(false);
    // Pedaço curto (fases pares, caso o tema mude de fase) também é desenhado
    const short = { w: 40, k: 0, seed: 3, sprites: {} };
    expect(pumpkinSprite(short, true).w).toBeGreaterThan(40);
    const rec = recordingCtx();
    rec.ctx.drawImage = () => {};
    drawJack(rec.ctx, 0, 0, 15, 1, true);
    expect(rec.colors.has(JACK_ORANGE)).toBe(true);
  });

  test('cemitério, árvore seca e abóboras na costa, longe da casa', () => {
    expect(drawn(makeGame({ level: 25 })).colors.has(TREE_BARK)).toBe(true);
    expect(drawn(makeGame({ level: 24 })).colors.has(TREE_BARK)).toBe(false);
    expect(DEAD_TREE.x).toBeLessThan(W / 3);
    for (const p of SHORE_PUMPKINS) expect(IGLOO.x - p.x, 'abóbora longe da casa').toBeGreaterThan(300);
    for (const gr of GRAVES) expect(IGLOO.x - gr.x, 'lápide longe da casa').toBeGreaterThan(300);
  });

  test('céu de lua cheia que desce conforme esfria; sem sol', () => {
    const warm = moonPos(1);
    const cold = moonPos(0);
    expect(cold.y).toBeGreaterThan(warm.y);
    expect(warm.x).toBe(MOON.x);
    expect(drawn(makeGame({ level: 25 })).colors.has('#0B0620')).toBe(true);
    expect(drawn(makeGame({ level: 24 })).colors.has('#0B0620')).toBe(false);
  });

  test('personagem fantasiado de bruxinho só no Halloween', () => {
    expect(drawn(makeGame({ level: 25 })).colors.has(WIZARD_ROBE)).toBe(true);
    expect(drawn(makeGame({ level: 24 })).colors.has(WIZARD_ROBE)).toBe(false);
  });

  test('fantasia de bruxinho em todas as poses (de costas, fugindo, pulando, afundando, congelando)', () => {
    const g = makeGame({ level: 25 });
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
      drawPlayer(rec.ctx, p, 1, 0, 0, 'wizard');
      expect(rec.colors.has(WIZARD_ROBE) || rec.colors.has('#432470'), `pose ${i}: manto`).toBe(true);
      expect(rec.colors.has('#3A1E60'), `pose ${i}: chapéu`).toBe(true);
    }
  });

  test('lobisomem no lugar do urso; urso polar nas outras fases', () => {
    const g = makeGame({ level: 25, quiet: false });
    expect(g.bear.active).toBe(true);
    const c = drawn(g).colors;
    expect(c.has(WEREWOLF.eye)).toBe(true);
    expect(c.has(BEAR_FUR.polar.legFront)).toBe(false);
    const n = drawn(makeGame({ level: 24, quiet: false })).colors;
    expect(n.has(WEREWOLF.eye)).toBe(false);
    expect(n.has(BEAR_FUR.polar.legFront)).toBe(true);
  });

  test('lobisomem desenhado nos dois sentidos, parado (uivando) e correndo atrás', () => {
    for (const chasing of [false, true]) {
      for (const dir of [1, -1]) {
        for (const t of [0.2, 2.2]) {
          const rec = recordingCtx();
          drawBear(rec.ctx, { x: 400, y: 250, dir, walk: 0.7, chasing }, t, 'werewolf');
          expect(rec.colors.has(WEREWOLF.pants[1]), 'calça rasgada').toBe(true);
          expect(rec.colors.has(BEAR_FUR.polar.legFront), 'nada do urso polar').toBe(false);
        }
      }
    }
    const rec = recordingCtx();
    drawWerewolf(rec.ctx, { x: 0, y: 250, dir: 1, walk: 0, chasing: true }, 0.5);
    expect(rec.colors.has('#5A1A2A'), 'boca aberta na perseguição').toBe(true);
  });

  test('alcançado pelo lobisomem, o bruxinho foge (mesma regra do urso)', () => {
    const g = makeGame({ level: 25 });
    g.bear.active = true;
    g.bear.x = 600;
    g.bear.dir = 1;
    g.player.x = 620;
    g.player.invuln = 0;
    step(g, 0.1);
    expect(g.player.state).toBe('flee');
    expect(g.bear.chasing).toBe(true);
  });

  test('folhas secas caindo no lugar da neve, sem aurora', () => {
    const g = makeGame({ level: 25 });
    expect(g.particles.leaves).toBe(true);
    expect(g.particles.calm).toBe(false);
    drawn(g);
    expect(g.renderer.aurora).toBe(0);
    g.level = 26;
    g.startLevel();
    expect(g.particles.leaves).toBe(false);
    drawn(g);
    expect(g.renderer.aurora).toBeGreaterThan(0);
  });

  test('pousos levantam neblina na costa e lasquinhas de abóbora no rio', () => {
    const g = makeGame({ level: 25 });
    g.onLand(-1);
    expect(g.particles.puffs.some((p) => p.color === HAUNT.mist)).toBe(true);
    g.onLand(1);
    expect(g.particles.fx.some((f) => f.kind === 'chip' && f.color === HAUNT.chip)).toBe(true);
  });

  test('fantasminha, aranha, olho e bala são desenhados nos dois sentidos', () => {
    for (const draw of [drawGhost, drawSpider, drawEyeball, drawCandy]) {
      for (const dir of [1, -1]) {
        const rec = recordingCtx();
        draw(rec.ctx, { x: 300, dir, ph: 1 }, 450, 2.3);
        expect(rec.colors.size).toBeGreaterThan(2);
      }
    }
  });

  test('cada bicho do Halloween tem o seu som ao empurrar, e o lobisomem uiva', () => {
    const s = audibleSfx();
    for (const kind of HALLOWEEN_ENEMIES) {
      const before = s.ctx.voices;
      s.play('bump', { kind });
      expect(s.ctx.voices, kind).toBeGreaterThan(before);
    }
    const before = s.ctx.voices;
    s.play('growl', { kind: 'werewolf' });
    expect(s.ctx.voices - before).toBeGreaterThan(3);
  });

  test('o Halloween toca a sua própria trilha (e não tem trenó)', () => {
    const g = makeGame({ level: 25 });
    expect(g.sfx.track).toBe('halloween');
    for (let i = 0; i < 30 * 120; i++) g.update(1 / 120);
    expect(g.sleigh.active).toBe(false);
    expect(g.sfx.musicNotes).toBeGreaterThan(100);
    g.level = 26;
    g.startLevel();
    expect(g.sfx.track).toBe(null);
  });

  test('trilha do Halloween: 16 compassos com caixinha de música, órgão, pizzicato, sino e fantasma', () => {
    const m = MUSIC.halloween;
    expect(m.length).toBe(64);
    expect(m.length * m.beat).toBeGreaterThan(20);
    const last = m.events[m.events.length - 1];
    expect(last.beat).toBeLessThan(m.length);
    expect(m.events.length).toBeGreaterThan(64 * 1.5);
  });

  test('trilha do Halloween é sintetizada sem erro, respeita o mudo e para no fim de jogo', () => {
    const s = audibleSfx();
    s.setMusic('halloween');
    s.updateMusic(30);
    expect(s.ctx.voices).toBeGreaterThan(0);
    expect(s.musicLoop).toBeGreaterThan(0);

    const m = new Sfx();
    m.setMuted(true);
    m.unlock(FakeAudioContext);
    m.setMusic('halloween');
    m.updateMusic(5);
    expect(m.ctx.voices).toBe(0);
    m.setMuted(false);

    const g = makeGame({ level: 25 });
    g.lives = 1;
    g.onPlayerLost();
    expect(g.sfx.track).toBe(null);
  });

  test('troféu do Halloween: nome, fita laranja e emblema de abóbora', () => {
    const tr = trophyFor(25);
    expect(tr.name).toBe('Troféu do Halloween');
    expect(tr.ribbon).toBe('#F07A1A');
    const rec = recordingCtx();
    TROPHY_EMBLEMS.halloween(rec.ctx);
    expect(rec.colors.has('#F28C28')).toBe(true);
  });

  test('temperatura, vidas e regras continuam as mesmas no Halloween', () => {
    const g = makeGame({ level: 25 });
    expect(g.temp).toBe(RULES.tempStart);
    expect(g.lives).toBe(RULES.startLives);
    step(g, 3.5);
    expect(g.temp).toBe(RULES.tempStart - 3);
  });

  test('janelas da casa brilham amarelas e a cor fica exportada para o desenho', () => {
    expect(WINDOW_GLOW).toBe('#FFD86A');
  });
});
