// Efeitos sonoros (Web Audio API) e botão de mudo.
import { suite, test, expect } from '../harness.js';
import { isNode } from '../env.js';
import { makeGame, step, stepUntil, placeOnFloe, aimAtRow0, jump, press, enterIgloo } from '../helpers.js';
import { Sfx, SOUND_NAMES } from '../../src/audio.js';
import { MAP } from '../../src/input.js';
import { MUTE_BUTTON } from '../../src/hud.js';
import { W, H, STEP } from '../../src/config.js';

// ---- Web Audio simulado: valida o uso da API sem tocar som de verdade
class FakeParam {
  constructor() {
    this.value = 0;
  }
  setValueAtTime(v) {
    if (!Number.isFinite(v)) throw new Error(`valor inválido: ${v}`);
  }
  linearRampToValueAtTime(v) {
    if (!Number.isFinite(v)) throw new Error(`rampa inválida: ${v}`);
  }
  exponentialRampToValueAtTime(v) {
    if (!(v > 0)) throw new Error(`rampa exponencial precisa de valor > 0 (recebeu ${v})`);
  }
  setTargetAtTime(v) {
    if (!Number.isFinite(v)) throw new Error(`alvo inválido: ${v}`);
    this.target = v;
  }
}
class FakeNode {
  connect(n) {
    if (!n) throw new Error('connect sem destino');
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
    return Object.assign(new FakeNode(), {
      frequency: new FakeParam(), type: 'sine', start: () => this.voices++, stop() {},
    });
  }
  createBiquadFilter() {
    return Object.assign(new FakeNode(), { frequency: new FakeParam(), Q: new FakeParam(), type: 'lowpass' });
  }
  createDynamicsCompressor() {
    return new FakeNode();
  }
  createBuffer(_ch, len) {
    const d = new Float32Array(len);
    return { getChannelData: () => d };
  }
  createStereoPanner() {
    return Object.assign(new FakeNode(), { pan: new FakeParam() });
  }
  createBufferSource() {
    return Object.assign(new FakeNode(), { start: () => this.voices++, stop() {} });
  }
  resume() {}
}

const played = (g) => g.sfx.history;

suite('Áudio · efeitos sonoros e mudo', () => {
  test('módulo de áudio existe e não quebra o jogo sem Web Audio', async () => {
    if (isNode) {
      const fs = await import('node:fs');
      expect(fs.existsSync(new URL('../../src/audio.js', import.meta.url))).toBe(true);
    }
    const s = new Sfx();
    s.play('jump'); // sem AudioContext: só registra
    expect(s.history).toEqual(['jump']);
  });

  test('todos os sons são sintetizados sem erro (Web Audio simulado)', () => {
    const s = new Sfx();
    s.setMuted(false);
    s.unlock(FakeAudioContext);
    for (const name of SOUND_NAMES) {
      const before = s.ctx.voices;
      s.play(name, { kind: name === 'bump' ? 'goose' : undefined });
      expect(s.ctx.voices, `som "${name}"`).toBeGreaterThan(before);
    }
    const before = s.ctx.voices;
    s.play('bump', { kind: 'crab' });
    expect(s.ctx.voices).toBeGreaterThan(before);
  });

  test('sons essenciais da especificação existem: pulo, coleta, splash e bloco', () => {
    for (const n of ['jump', 'fish', 'splash', 'block']) expect(SOUND_NAMES).toContain(n);
  });

  test('mudo silencia: volume zero e nenhuma voz criada', () => {
    const s = new Sfx();
    s.unlock(FakeAudioContext);
    s.setMuted(true);
    expect(s.master.gain.value).toBe(0);
    const before = s.ctx.voices;
    s.play('splash');
    expect(s.ctx.voices).toBe(before);
    s.setMuted(false);
    expect(s.master.gain.value).toBeGreaterThan(0);
  });

  test('M alterna o mudo e a preferência fica salva', () => {
    expect(MAP.KeyM).toBe('mute');
    const g = makeGame();
    g.sfx.setMuted(false);
    press(g, 'mute');
    expect(g.sfx.muted).toBe(true);
    expect(new Sfx().muted, 'lido do armazenamento').toBe(true);
    press(g, 'mute');
    expect(g.sfx.muted).toBe(false);
    expect(new Sfx().muted).toBe(false);
  });

  test('botão de mudo fica dentro da tela', () => {
    const b = MUTE_BUTTON;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x + b.w).toBeLessThanOrEqual(W);
    expect(b.y + b.h).toBeLessThanOrEqual(H);
  });

  test('pulo, pouso e placa nova tocam sons', () => {
    const g = makeGame();
    aimAtRow0(g);
    jump(g, 'down');
    expect(played(g)).toContain('jump');
    expect(played(g)).toContain('land');
    expect(played(g)).toContain('floe');
  });

  test('bloco encaixando no iglu toca som', () => {
    const g = makeGame();
    g.onLand(0);
    step(g, 0.6);
    expect(played(g)).toContain('block');
  });

  test('cair na água toca splash', () => {
    const g = makeGame();
    g.player.fall();
    expect(played(g)).toContain('splash');
  });

  test('pegar peixe toca som de coleta', () => {
    const g = makeGame();
    g.rows[0].speed = 0;
    placeOnFloe(g, 0);
    g.critters.list.push({ kind: 'fish', row: 0, x: g.player.x, dir: 1, vx: 50, w: 30, ph: 0 });
    step(g, STEP * 2);
    expect(played(g)).toContain('fish');
  });

  test('inverter fileira toca som e o bloco removido também', () => {
    const g = makeGame();
    g.igloo.add();
    placeOnFloe(g, 1);
    press(g, 'action');
    expect(played(g)).toContain('reverse');
    expect(played(g)).toContain('unblock');
  });

  test('congelar toca som', () => {
    const g = makeGame();
    g.temp = 1;
    g.tempAcc = 0;
    step(g, 1.05);
    expect(played(g)).toContain('freeze');
  });

  test('alerta de frio a cada grau abaixo de 10°', () => {
    const g = makeGame();
    g.temp = 13;
    g.tempAcc = 0;
    step(g, 5.02);
    // 13° → 8° em 5 s: alerta em 10°, 9° e 8° (não em 12° e 11°)
    expect(played(g).filter((n) => n === 'cold').length).toBe(3);
  });

  test('urso alcançando o jogador toca rugido e grito de susto', () => {
    const g = makeGame({ level: 4 });
    g.bear.active = true;
    g.player.invuln = 0;
    g.bear.x = g.player.x + 50;
    step(g, 0.3);
    expect(played(g)).toContain('growl');
    expect(played(g)).toContain('scared');
  });

  test('empurrão de inimigo toca uma única vez por inimigo', () => {
    const g = makeGame();
    g.rows[0].speed = 0;
    placeOnFloe(g, 0);
    g.critters.list.push({ kind: 'goose', row: 0, x: g.player.x + 60, dir: -1, vx: -100, w: 44, ph: 0 });
    step(g, 0.9);
    expect(played(g).filter((n) => n === 'bump').length).toBe(1);
  });

  test('vida extra toca som', () => {
    const g = makeGame();
    g.addScore(5000);
    expect(played(g)).toContain('life');
  });

  test('entrar no iglu, contagem do bônus e fanfarra tocam sons', () => {
    const g = makeGame();
    while (!g.igloo.complete) g.igloo.add();
    g.temp = 5;
    g.player.x = g.igloo.doorX;
    enterIgloo(g); // ↑ em frente à porta (regra nova, pedida pelo usuário)
    stepUntil(g, () => g.level === 2, 10);
    expect(played(g)).toContain('door');
    expect(played(g).filter((n) => n === 'tick').length).toBe(5);
    expect(played(g)).toContain('fanfare');
  });

  test('fim de jogo toca som', () => {
    const g = makeGame();
    g.lives = 1;
    g.player.fall();
    step(g, 2);
    expect(played(g)).toContain('gameover');
  });
});

suite('Áudio · motor do jet ski na Praia', () => {
  test('o som segue o jet ski: lado da tela, mais alto perto do meio, mudo fora da tela, mais agudo chegando que indo embora', async () => {
    const { engineSound, BOATS } = await import('../../src/beach.js');
    expect(engineSound({ list: [] })).toBe(null);
    expect(engineSound({ list: [{ kind: 'sail', dir: 1, x: 640, t: 0 }] })).toBe(null);
    const at = (x, dir = 1, t = 0.3) => engineSound({ list: [{ kind: 'jetski', dir, x, t }] });
    // Entrando pela esquerda: começa sem som (fora da tela) e cresce
    expect(at(-BOATS.margin).vol).toBe(0);
    expect(at(100).vol).toBeGreaterThan(at(0).vol);
    expect(at(W / 2).vol).toBeGreaterThan(at(150).vol);
    // Lado: esquerda negativo, direita positivo
    expect(at(200).pan).toBeLessThan(0);
    expect(at(1100).pan).toBeGreaterThan(0);
    // Doppler: chegando (antes do meio) mais agudo que indo embora (depois do meio)
    expect(at(400, 1).pitch).toBeGreaterThan(at(880, 1).pitch);
    expect(at(880, -1).pitch).toBeGreaterThan(at(400, -1).pitch);
  });

  test('na fase 20 o motor liga quando o jet ski passa e desliga quando ele some; nas outras fases nunca; no fim de jogo e na pausa fica mudo', () => {
    const g = makeGame({ level: 20 });
    stepUntil(g, () => g.boats.list.some((v) => v.kind === 'jetski'), 200);
    step(g, 1);
    expect(g.sfx.engine).not.toBe(null);
    expect(g.sfx.history).toContain('jetski');
    stepUntil(g, () => !g.boats.list.some((v) => v.kind === 'jetski'), 30);
    step(g, 0.05);
    expect(g.sfx.engine).toBe(null);
    g.state = 'gameOver';
    g.boats.list.push({ kind: 'jetski', dir: 1, x: 600, y: 179, t: 0 });
    step(g, 0.05);
    expect(g.sfx.engine).toBe(null);
    const o = makeGame({ level: 15 });
    step(o, 60);
    expect(o.sfx.engine).toBe(null);
    expect(o.sfx.history.includes('jetski')).toBe(false);
  });

  test('voz contínua no Web Audio simulado: liga uma vez só, acompanha o volume e silencia com null', () => {
    const s = new Sfx();
    s.setMuted(false);
    s.unlock(FakeAudioContext);
    const st = { pan: -0.5, vol: 0.8, pitch: 1.05 };
    s.setEngine(st);
    const voices = s.ctx.voices;
    expect(voices).toBeGreaterThan(0);
    s.ctx.currentTime = 1;
    s.setEngine({ pan: 0.3, vol: 0.5, pitch: 0.95 });
    expect(s.ctx.voices).toBe(voices); // não cria vozes novas a cada passo
    expect(s.engineVoice.out.gain.target).toBeGreaterThan(0);
    expect(s.engineVoice.pan.pan.target).toBe(0.3);
    s.setEngine(null);
    expect(s.engineVoice.out.gain.target).toBe(0);
  });
});
