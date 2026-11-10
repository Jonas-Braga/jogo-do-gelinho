// Fases especiais (a cada 5 fases). Fase 5: Natal.
import { suite, test, expect } from '../harness.js';
import { makeGame, step, stepUntil } from '../helpers.js';
import { SPECIAL_EVERY, SPECIALS, specialFor } from '../../src/specials.js';
import { levelParams, levelIntro } from '../../src/levels.js';
import { Sleigh, SLEIGH, TREES } from '../../src/christmas.js';
import { Sfx, MUSIC, SOUND_NAMES } from '../../src/audio.js';
import { drawPlayer, drawBear } from '../../src/sprites.js';
import { W, RULES, STEP } from '../../src/config.js';
import { Game } from '../../src/game.js';
import { fakeCanvas } from '../env.js';

// Contexto 2D que registra todas as cores usadas (fillStyle, strokeStyle e
// paradas de gradiente), para saber o que foi desenhado.
function recordingCtx() {
  const colors = new Set();
  const gradient = { addColorStop: (_o, c) => colors.add(String(c)) };
  const store = { measureText: (s) => ({ width: String(s).length * 7 }) };
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
  return { ctx, colors };
}

// Web Audio simulado mínimo (conta vozes criadas)
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

const SWEATER_RED = '#C62F2F';
const HAT_FUR = '#F8F6F0';

suite('Fases especiais · registro', () => {
  test('fases especiais acontecem a cada 5 fases', () => {
    expect(SPECIAL_EVERY).toBe(5);
    for (const l of Object.keys(SPECIALS)) expect(Number(l) % 5, `fase ${l}`).toBe(0);
  });

  test('fases que não são múltiplas de 5 nunca são especiais', () => {
    for (let l = 1; l <= 30; l++) {
      if (l % 5 !== 0) expect(specialFor(l), `fase ${l}`).toBe(null);
    }
  });

  test('fase 5 é a especial de Natal', () => {
    expect(specialFor(5).id).toBe('natal');
    expect(levelParams(5).special.id).toBe('natal');
    expect(levelParams(4).special).toBe(null);
    expect(levelParams(6).special).toBe(null);
  });

  test('múltiplo de 5 ainda sem tema criado é uma fase normal', () => {
    expect(specialFor(1000)).toBe(null);
    expect(levelIntro(1000).title).toBe('FASE 1000');
  });

  // Regra mudada com aprovação do usuário: fases especiais são mais lentas (pace 0.8)
  // para o jogador apreciar o cenário; o resto da dificuldade não muda.
  test('fase especial de Natal é mais lenta (80%) e o resto da dificuldade igual', () => {
    const p = levelParams(5);
    const before = levelParams(4);
    const after = levelParams(6);
    expect(specialFor(5).pace).toBe(0.8);
    expect(p.bear).toBe(true);
    expect(p.speed).toBeCloseTo((before.speed + after.speed) / 2 * 0.8);
    expect(p.speed).toBeLessThan(before.speed);
    expect(p.maxGroup).toBe(before.maxGroup);
    expect(p.fragmented).toBe(false);
  });

  test('toda fase especial criada tem ritmo próprio mais lento', () => {
    for (const [level, sp] of Object.entries(SPECIALS)) {
      expect(sp.pace, `fase ${level}`).toBeLessThan(1);
      expect(sp.pace, `fase ${level}`).toBeGreaterThan(0.5);
    }
  });
});

suite('Fases especiais · Natal (fase 5)', () => {
  test('o jogo entra no tema de Natal na fase 5 e sai dele na fase 6', () => {
    const g = makeGame({ level: 4 });
    expect(g.special).toBe(null);
    g.level = 5;
    g.startLevel();
    expect(g.special.id).toBe('natal');
    g.level = 6;
    g.startLevel();
    expect(g.special).toBe(null);
  });

  test('aviso de início anuncia a fase especial de Natal (e mantém a aurora)', () => {
    const g = makeGame({ level: 5 });
    expect(g.banner.title).toContain('NATAL');
    expect(g.banner.sub).toContain('Natal');
    expect(g.banner.sub).toContain('aurora');
    expect(g.banner.life).toBeGreaterThan(2.6);
    g.renderer.draw(g);
  });

  test('personagem usa suéter natalino só na fase de Natal', () => {
    const g = makeGame({ level: 5 });
    const rec = recordingCtx();
    g.renderer.ctx = rec.ctx;
    g.renderer.draw(g);
    expect(rec.colors.has(SWEATER_RED)).toBe(true);

    const n = makeGame({ level: 4 });
    const rec2 = recordingCtx();
    n.renderer.ctx = rec2.ctx;
    n.renderer.draw(n);
    expect(rec2.colors.has(SWEATER_RED)).toBe(false);
  });

  test('suéter aparece em todas as poses (de costas, fugindo, pulando, afundando)', () => {
    const g = makeGame({ level: 5 });
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
      drawPlayer(rec.ctx, p, 1, 0, 0, 'sweater');
      expect(rec.colors.has(SWEATER_RED) || rec.colors.has('#9E2224'), `pose ${i}`).toBe(true);
    }
  });

  test('urso usa gorro de Papai Noel só na fase de Natal', () => {
    const g = makeGame({ level: 5, quiet: false });
    expect(g.bear.active).toBe(true);
    const rec = recordingCtx();
    g.renderer.ctx = rec.ctx;
    g.renderer.draw(g);
    expect(rec.colors.has(HAT_FUR)).toBe(true);

    const n = makeGame({ level: 4, quiet: false });
    const rec2 = recordingCtx();
    n.renderer.ctx = rec2.ctx;
    n.renderer.draw(n);
    expect(rec2.colors.has(HAT_FUR)).toBe(false);
  });

  test('gorro acompanha o urso rugindo na perseguição', () => {
    const g = makeGame({ level: 5, quiet: false });
    g.bear.chasing = true;
    const rec = recordingCtx();
    drawBear(rec.ctx, g.bear, 2, 'santaHat');
    expect(rec.colors.has(HAT_FUR)).toBe(true);
  });

  test('árvores de Natal na costa, longe do iglu', () => {
    expect(TREES.length).toBeGreaterThan(0);
    for (const tr of TREES) {
      expect(tr.x).toBeGreaterThanOrEqual(0);
      expect(tr.x).toBeLessThan(W / 3);
    }
  });

  test('pisca-pisca no iglu só depois de completo', () => {
    const g = makeGame({ level: 5 });
    const bulbs = (game) => {
      const rec = recordingCtx();
      game.renderer.ctx = rec.ctx;
      game.renderer.draw(game);
      return rec.colors;
    };
    // Árvores usam o pisca-pisca também; o iglu completo acrescenta o fio verde-escuro
    expect(bulbs(g).has('rgba(40, 70, 50, 0.85)')).toBe(false);
    while (!g.igloo.complete) g.igloo.add();
    expect(bulbs(g).has('rgba(40, 70, 50, 0.85)')).toBe(true);
  });
});

suite('Fases especiais · trenó do Papai Noel', () => {
  test('o trenó passa de vez em quando, atravessando o céu inteiro', () => {
    const s = new Sleigh(() => 0.2); // da esquerda para a direita
    let started = 0;
    let t = 0;
    while (!s.active && t < 30) {
      if (s.update(STEP)) started++;
      t += STEP;
    }
    expect(started).toBe(1);
    expect(t).toBeGreaterThanOrEqual(SLEIGH.firstDelay - STEP);
    expect(s.dir).toBe(1);
    expect(s.x).toBeLessThan(0);
    expect(s.y).toBeGreaterThanOrEqual(SLEIGH.yMin);
    expect(s.y).toBeLessThanOrEqual(SLEIGH.yMax);
    while (s.active) s.update(STEP);
    expect(s.x).toBeGreaterThan(W);
    // Depois espera um intervalo antes de passar de novo
    expect(s.timer).toBeGreaterThanOrEqual(SLEIGH.minGap);
    expect(s.timer).toBeLessThanOrEqual(SLEIGH.maxGap);
  });

  test('o trenó também passa da direita para a esquerda', () => {
    const s = new Sleigh(() => 0.8);
    while (!s.active) s.update(STEP);
    expect(s.dir).toBe(-1);
    expect(s.x).toBeGreaterThan(W);
    while (s.active) s.update(STEP);
    expect(s.x).toBeLessThan(0);
  });

  test('o trenó fica no céu, acima da costa', () => {
    expect(SLEIGH.yMax).toBeLessThan(150);
    expect(SLEIGH.yMin - 44).toBeGreaterThan(76); // galhadas (38 px) + balanço (6 px) abaixo dos painéis do HUD
    expect(SLEIGH.yMin).toBeGreaterThan(30);
  });

  test('na fase de Natal o trenó passa várias vezes com som de guizos', () => {
    const g = makeGame({ level: 5 });
    g.temp = 999; // não congelar durante o teste
    step(g, SLEIGH.firstDelay + 0.1);
    expect(g.sleigh.active).toBe(true);
    expect(g.sfx.history).toContain('sleigh');
    g.renderer.draw(g);
    const passes = g.sleigh.passes;
    stepUntil(g, () => g.sleigh.passes > passes, SLEIGH.maxGap + 20);
    expect(g.sleigh.passes).toBe(passes + 1);
  });

  test('fora da fase de Natal o trenó nunca aparece', () => {
    const g = makeGame({ level: 4 });
    g.temp = 999;
    step(g, 30);
    expect(g.sleigh.active).toBe(false);
    expect(g.sleigh.passes).toBe(0);
    expect(g.sfx.history.includes('sleigh')).toBe(false);
  });
});

suite('Fases especiais · sinos de Natal (som de fundo)', () => {
  test('fase de Natal toca a trilha de sinos; as outras fases não', () => {
    const g = makeGame({ level: 5 });
    expect(g.sfx.track).toBe('natal');
    const before = g.sfx.musicNotes;
    step(g, 3);
    expect(g.sfx.musicNotes).toBeGreaterThan(before);

    const n = makeGame({ level: 6 });
    expect(n.sfx.track).toBe(null);
    step(n, 3);
    expect(n.sfx.musicNotes).toBe(0);
  });

  test('a trilha toca em loop', () => {
    const s = new Sfx();
    s.setMusic('natal');
    const m = MUSIC.natal;
    const loop = m.length * m.beat;
    for (let t = 0; t < loop * 2 + 1; t += STEP) s.updateMusic(STEP);
    expect(s.musicLoop).toBe(2);
    expect(s.musicNotes).toBeGreaterThan(m.events.length * 2);
  });

  test('a trilha tem melodia de sinos e guizos', () => {
    const m = MUSIC.natal;
    expect(m.events.length).toBeGreaterThan(m.length * 2); // guizos a cada meia batida + melodia
    expect(m.length * m.beat).toBeGreaterThan(20);           // loop longo, não repetitivo demais
  });

  test('sinos são sintetizados sem erro e respeitam o mudo', () => {
    const s = new Sfx();
    s.setMuted(false);
    s.unlock(FakeAudioContext);
    s.setMusic('natal');
    s.updateMusic(2);
    expect(s.ctx.voices).toBeGreaterThan(0);
    expect(SOUND_NAMES).toContain('sleigh');

    const m = new Sfx();
    m.setMuted(true);
    m.unlock(FakeAudioContext);
    m.setMusic('natal');
    m.updateMusic(2);
    expect(m.ctx.voices).toBe(0);
    expect(m.musicNotes).toBeGreaterThan(0); // a trilha segue no tempo, só sem som
    m.setMuted(false);
  });

  test('os sinos param no fim de jogo e na tela inicial', () => {
    const g = makeGame({ level: 5 });
    g.lives = 1;
    g.onPlayerLost();
    expect(g.state).toBe('gameOver');
    expect(g.sfx.track).toBe(null);

    const t = new Game(fakeCanvas(), { title: true });
    expect(t.sfx.track).toBe(null);
    expect(t.special).toBe(null);
  });

  test('a trilha recomeça do início ao recomeçar a fase de Natal e para ao avançar', () => {
    const g = makeGame({ level: 5 });
    step(g, 2);
    g.startLevel();
    expect(g.sfx.musicT).toBe(0);
    g.level = 6;
    g.startLevel();
    expect(g.sfx.track).toBe(null);
  });

  test('temperatura e regras continuam as mesmas na fase especial', () => {
    const g = makeGame({ level: 5 });
    expect(g.temp).toBe(RULES.tempStart);
    expect(g.lives).toBe(RULES.startLives);
  });
});
