// Efeitos sonoros sintetizados com Web Audio API (nenhum arquivo de áudio).
// Sem AudioContext (ex.: Node nos testes) tudo vira no-op, mas o histórico
// de sons tocados continua sendo registrado.

import { readItem, writeItem } from './storage.js';

const VOLUME = 0.55;

const loadMuted = () => readItem('muted') === '1';
const saveMuted = (m) => writeItem('muted', m ? '1' : '0');

const NOTE = (n) => 440 * 2 ** ((n - 69) / 12); // número MIDI → Hz

// Cada som recebe o Sfx (com helpers tone/noise) e opções.
export const SOUNDS = {
  jump(s) {
    s.tone({ type: 'triangle', f0: 320, f1: 640, dur: 0.13, vol: 0.18 });
  },
  step(s) {
    // Passo na neve: estalo curto e abafado
    s.noise({ dur: 0.07, vol: 0.06, filter: 'bandpass', f0: 1800 + Math.random() * 600, q: 1.5 });
  },
  land(s) {
    s.tone({ type: 'sine', f0: 170, f1: 70, dur: 0.09, vol: 0.22 });
    s.noise({ dur: 0.05, vol: 0.08, filter: 'highpass', f0: 3000 });
  },
  floe(s) {
    // Gelo "acendendo": dois sinos cristalinos
    s.tone({ type: 'triangle', f0: NOTE(84), dur: 0.25, vol: 0.12 });
    s.tone({ type: 'sine', f0: NOTE(91), dur: 0.3, vol: 0.09, t: 0.05 });
  },
  block(s) {
    // Bloco de neve compactada encaixando
    s.noise({ dur: 0.12, vol: 0.25, filter: 'lowpass', f0: 900, f1: 200 });
    s.tone({ type: 'sine', f0: 210, f1: 110, dur: 0.12, vol: 0.2 });
  },
  door(s) {
    [60, 64, 67, 72].forEach((n, i) => s.tone({ type: 'triangle', f0: NOTE(n), dur: 0.4, vol: 0.1, t: i * 0.02 }));
  },
  curtain(s) {
    // Pele de foca caindo e batendo na porta: "fuff" abafado
    s.noise({ dur: 0.35, vol: 0.2, filter: 'lowpass', f0: 900, f1: 250 });
    s.tone({ type: 'sine', f0: 140, f1: 80, dur: 0.15, vol: 0.12, t: 0.28 });
  },
  unblock(s) {
    s.noise({ dur: 0.18, vol: 0.18, filter: 'bandpass', f0: 600, f1: 1800, q: 2 });
  },
  reverse(s) {
    s.noise({ dur: 0.3, vol: 0.22, filter: 'bandpass', f0: 2400, f1: 400, q: 3 });
    s.tone({ type: 'sine', f0: 500, f1: 250, dur: 0.25, vol: 0.08 });
  },
  splash(s) {
    s.noise({ dur: 0.6, vol: 0.45, filter: 'lowpass', f0: 3500, f1: 250 });
    s.tone({ type: 'sine', f0: 220, f1: 55, dur: 0.35, vol: 0.25 });
    s.noise({ dur: 0.25, vol: 0.12, filter: 'highpass', f0: 4000, t: 0.08 });
  },
  glub(s) {
    // Últimas bolhas: "glub-glub" abafado
    [520, 430, 360].forEach((f, i) => s.tone({ type: 'sine', f0: f, f1: f * 1.4, dur: 0.07, vol: 0.12, t: i * 0.09 }));
  },
  fish(s) {
    [76, 81, 88].forEach((n, i) => s.tone({ type: 'sine', f0: NOTE(n), dur: 0.1, vol: 0.15, t: i * 0.06 }));
  },
  freeze(s) {
    s.tone({ type: 'triangle', f0: 1400, f1: 300, dur: 0.9, vol: 0.14 });
    s.noise({ dur: 1.0, vol: 0.1, filter: 'highpass', f0: 6000 });
    [96, 91, 88, 84].forEach((n, i) => s.tone({ type: 'sine', f0: NOTE(n), dur: 0.15, vol: 0.06, t: 0.1 + i * 0.15 }));
  },
  growl(s) {
    s.tone({ type: 'sawtooth', f0: 110, f1: 60, dur: 0.55, vol: 0.22, filter: 500 });
    s.noise({ dur: 0.5, vol: 0.15, filter: 'lowpass', f0: 400 });
  },
  scared(s) {
    // "Aaah!" agudo que sobe e despenca
    s.tone({ type: 'sawtooth', f0: 650, f1: 1050, dur: 0.16, vol: 0.09, filter: 2600, t: 0.05 });
    s.tone({ type: 'sawtooth', f0: 1050, f1: 480, dur: 0.45, vol: 0.09, filter: 2600, t: 0.21 });
  },
  bump(s, o = {}) {
    if (o.kind === 'goose') {
      // Grasnado
      s.tone({ type: 'square', f0: 460, f1: 380, dur: 0.12, vol: 0.09, filter: 1600 });
      s.tone({ type: 'square', f0: 440, f1: 360, dur: 0.12, vol: 0.09, t: 0.14, filter: 1600 });
    } else if (o.kind === 'bat') {
      // Guinchos agudos de morcego
      s.tone({ type: 'square', f0: 2400, f1: 3000, dur: 0.05, vol: 0.05, filter: 5000 });
      s.tone({ type: 'square', f0: 2600, f1: 3200, dur: 0.05, vol: 0.05, t: 0.08, filter: 5000 });
    } else if (o.kind === 'snake') {
      // Chiado de cobra
      s.noise({ dur: 0.35, vol: 0.12, filter: 'highpass', f0: 3500 });
    } else if (o.kind === 'piranha') {
      // Mordida: dois estalos rápidos
      s.noise({ dur: 0.04, vol: 0.25, filter: 'bandpass', f0: 2200, q: 5 });
      s.noise({ dur: 0.04, vol: 0.25, filter: 'bandpass', f0: 2000, q: 5, t: 0.07 });
    } else {
      // Batida seca (caranguejo, molusco)
      s.noise({ dur: 0.06, vol: 0.25, filter: 'bandpass', f0: 1200, q: 4 });
      s.tone({ type: 'square', f0: 180, f1: 120, dur: 0.06, vol: 0.08 });
    }
  },
  life(s) {
    [72, 76, 79, 84, 88].forEach((n, i) => s.tone({ type: 'square', f0: NOTE(n), dur: 0.09, vol: 0.07, t: i * 0.07, filter: 3000 }));
  },
  tick(s) {
    s.tone({ type: 'square', f0: 1100, dur: 0.03, vol: 0.05, filter: 4000 });
  },
  fanfare(s) {
    [[60, 0], [64, 0.12], [67, 0.24], [72, 0.36], [67, 0.52], [72, 0.64]].forEach(([n, t]) =>
      s.tone({ type: 'triangle', f0: NOTE(n), dur: t > 0.6 ? 0.5 : 0.14, vol: 0.14, t }));
  },
  cold(s) {
    s.tone({ type: 'sine', f0: 1500, dur: 0.05, vol: 0.06 });
  },
  gameover(s) {
    [[67, 0], [63, 0.25], [60, 0.5], [55, 0.75]].forEach(([n, t]) =>
      s.tone({ type: 'triangle', f0: NOTE(n), dur: t > 0.7 ? 0.8 : 0.24, vol: 0.14, t }));
  },
  pause(s) {
    s.tone({ type: 'sine', f0: 660, dur: 0.06, vol: 0.08 });
  },
  sleigh(s) {
    // Trenó passando ao fundo: guizos chacoalhando, crescendo e sumindo
    for (let i = 0; i < 10; i++) {
      const k = Math.sin((i / 9) * Math.PI);
      sleighShake(s, i * 0.11, 0.025 + k * 0.05);
    }
  },
};

export const SOUND_NAMES = Object.keys(SOUNDS);

// ---------------------------------------------------------------- Trilhas de fundo
// Sino: fundamental + parcial inarmônico curto (timbre de sino) + corpo suave.
function bell(s, n, t, vol = 0.05) {
  const f = NOTE(n + 12);
  s.tone({ type: 'sine', f0: f, dur: 1.1, vol, t });
  s.tone({ type: 'sine', f0: f * 2.76, dur: 0.3, vol: vol * 0.3, t });
  s.tone({ type: 'triangle', f0: NOTE(n), dur: 0.5, vol: vol * 0.35, t });
}

// Guizos de trenó: chiado agudo + tilintar de dois guizinhos
function sleighShake(s, t, vol) {
  s.noise({ dur: 0.08, vol, filter: 'highpass', f0: 6500, t });
  s.tone({ type: 'sine', f0: 4200 + Math.random() * 1600, dur: 0.06, vol: vol * 0.2, t });
  s.tone({ type: 'sine', f0: 5200 + Math.random() * 1600, dur: 0.05, vol: vol * 0.15, t: t + 0.02 });
}

// Notas como [MIDI, duração em batidas], tocadas em sequência.
const phrase = (notes, start = 0) => {
  let b = start;
  return notes.map(([n, d]) => {
    const ev = { beat: b, note: n, len: d };
    b += d;
    return ev;
  });
};
// Melodia de sinos tradicional de Natal (domínio público), em dó maior
const VERSE = [
  [64, 1], [64, 1], [64, 2], [64, 1], [64, 1], [64, 2], [64, 1], [67, 1], [60, 1.5], [62, 0.5], [64, 4],
  [65, 1], [65, 1], [65, 1.5], [65, 0.5], [65, 1], [64, 1], [64, 1], [64, 0.5], [64, 0.5],
];
const END_1 = [[64, 1], [62, 1], [62, 1], [64, 1], [62, 2], [67, 2]];
const END_2 = [[67, 1], [67, 1], [65, 1], [62, 1], [60, 4]];
const NATAL_MELODY = phrase([...VERSE, ...END_1, ...VERSE, ...END_2]); // 64 batidas

function buildTrack({ beat, length, melody }) {
  const events = [];
  for (const m of melody) events.push({ beat: m.beat, play: (s, t) => bell(s, m.note, t) });
  // Guizos o tempo todo, a cada meia batida, mais fortes no tempo
  for (let b = 0; b < length; b += 0.5) {
    const vol = b % 1 === 0 ? 0.03 : 0.016;
    events.push({ beat: b, play: (s, t) => sleighShake(s, t, vol) });
  }
  events.sort((a, b) => a.beat - b.beat);
  return { beat, length, events };
}

// ---- Floresta: modinha de fogueira original, em sol maior.
// Violão dedilhado (baixo + arpejo do acorde), flauta de madeira na melodia,
// bloco de madeira marcando o tempo e passarinhos de vez em quando.

// Corda dedilhada: ataque brilhante que escurece rápido
function pluck(s, n, t, vol = 0.05) {
  s.tone({ type: 'triangle', f0: NOTE(n), dur: 0.55, vol, t, filter: 1800 });
  s.tone({ type: 'sine', f0: NOTE(n + 12), dur: 0.12, vol: vol * 0.35, t });
}

// Flauta de madeira: seno com um sopro de ruído no começo
function flute(s, n, t, dur, vol = 0.045) {
  s.tone({ type: 'sine', f0: NOTE(n), dur, vol, t });
  s.tone({ type: 'triangle', f0: NOTE(n), dur: dur * 0.8, vol: vol * 0.25, t, filter: 2400 });
  s.noise({ dur: 0.07, vol: vol * 0.5, filter: 'bandpass', f0: NOTE(n) * 2, q: 3, t });
}

function woodblock(s, t, vol = 0.05) {
  s.noise({ dur: 0.03, vol, filter: 'bandpass', f0: 1700, q: 9, t });
}

// Passarinho: dois piados subindo
function chirp(s, t) {
  s.tone({ type: 'sine', f0: 2600, f1: 3700, dur: 0.07, vol: 0.022, t });
  s.tone({ type: 'sine', f0: 2900, f1: 4100, dur: 0.06, vol: 0.018, t: t + 0.11 });
}

// Acordes de cada compasso (4 batidas): baixo e notas do arpejo
const CHORDS = {
  G: { bass: 43, arp: [59, 62, 67] },
  C: { bass: 48, arp: [60, 64, 67] },
  D: { bass: 50, arp: [57, 62, 66] },
  Em: { bass: 40, arp: [59, 64, 67] },
};
const FOREST_BARS = ['G', 'G', 'C', 'G', 'Em', 'C', 'D', 'D', 'G', 'G', 'C', 'G', 'Em', 'D', 'G', 'G'];
// Melodia original da flauta, um compasso por linha (nota 0 = pausa)
const FOREST_TUNE = [
  [67, 1], [71, 1], [74, 1.5], [72, 0.5],
  [71, 1], [69, 1], [67, 2],
  [72, 1], [76, 1], [74, 1], [72, 1],
  [71, 3], [0, 1],
  [71, 1], [74, 1], [76, 1.5], [74, 0.5],
  [72, 1], [71, 1], [69, 2],
  [66, 1], [69, 1], [74, 1], [72, 1],
  [69, 3], [0, 1],
  [67, 1], [71, 1], [74, 1.5], [76, 0.5],
  [79, 1], [76, 1], [74, 2],
  [76, 1], [72, 1], [74, 1], [76, 1],
  [74, 2], [71, 2],
  [71, 1], [74, 1], [76, 1], [79, 1],
  [78, 1], [76, 1], [74, 2],
  [71, 1], [69, 1], [67, 1], [69, 1],
  [67, 3], [0, 1],
];

function buildForestTrack({ beat }) {
  const events = [];
  const add = (b, play) => events.push({ beat: b, play });
  FOREST_BARS.forEach((name, bar) => {
    const c = CHORDS[name];
    const b0 = bar * 4;
    // Baixo nos tempos 1 e 3; arpejo nos contratempos
    add(b0, (s, t) => pluck(s, c.bass, t, 0.06));
    add(b0 + 2, (s, t) => pluck(s, c.bass + 7, t, 0.045));
    [0.5, 1, 1.5, 2.5, 3, 3.5].forEach((o, i) => add(b0 + o, (s, t) => pluck(s, c.arp[i % 3], t, 0.03)));
    // Bloco de madeira nos tempos 2 e 4
    add(b0 + 1, (s, t) => woodblock(s, t));
    add(b0 + 3, (s, t) => woodblock(s, t));
    // Passarinhos no fim de alguns compassos
    if (bar % 4 === 3) add(b0 + 3.25, (s, t) => chirp(s, t));
  });
  for (const m of phrase(FOREST_TUNE)) {
    if (m.note) add(m.beat, (s, t) => flute(s, m.note, t, Math.min(1.2, m.len * beat * 0.95)));
  }
  events.sort((a, b) => a.beat - b.beat);
  return { beat, length: FOREST_BARS.length * 4, events };
}

// Trilhas disponíveis (as fases especiais escolhem a sua em specials.js)
export const MUSIC = {
  // 64 batidas de melodia + 8 só de guizos, antes de recomeçar
  natal: buildTrack({ beat: 0.44, length: 72, melody: NATAL_MELODY }),
  // 16 compassos (64 batidas), cerca de 24 s por volta
  floresta: buildForestTrack({ beat: 0.38 }),
};
const LOOKAHEAD = 0.12; // agenda as notas um pouco antes da hora

export class Sfx {
  constructor() {
    this.muted = loadMuted();
    this.ctx = null;
    this.history = [];
    this.track = null;
    this.musicNotes = 0; // notas da trilha já tocadas (mesmo sem áudio; usado nos testes)
  }

  // Liga uma trilha de fundo em loop (ou desliga com null). Recomeça do início.
  setMusic(name) {
    this.track = name && MUSIC[name] ? name : null;
    this.musicT = 0;
    this.musicIdx = 0;
    this.musicLoop = 0;
  }

  // Avança a trilha (chamado pelo passo do jogo: em pausa ela para junto).
  updateMusic(dt) {
    const m = MUSIC[this.track];
    if (!m) return;
    this.musicT += dt;
    const loopLen = m.length * m.beat;
    for (;;) {
      const ev = m.events[this.musicIdx];
      const at = this.musicLoop * loopLen + ev.beat * m.beat;
      if (at > this.musicT + LOOKAHEAD) break;
      this.musicNotes++;
      if (this.ctx && !this.muted) ev.play(this, Math.max(0, at - this.musicT));
      if (++this.musicIdx >= m.events.length) {
        this.musicIdx = 0;
        this.musicLoop++;
      }
    }
  }

  // O navegador só libera áudio após um gesto do usuário; chamado no 1º toque/tecla.
  unlock(AudioCtor = globalThis.AudioContext || globalThis.webkitAudioContext) {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume?.();
      return;
    }
    if (!AudioCtor) return;
    const ctx = new AudioCtor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : VOLUME;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp);
    comp.connect(ctx.destination);
    // Ruído branco reaproveitado por todos os sons de ruído
    const len = Math.floor(ctx.sampleRate * 1.2);
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  setMuted(m) {
    this.muted = m;
    saveMuted(m);
    if (this.master) this.master.gain.value = m ? 0 : VOLUME;
  }

  toggleMute() {
    this.setMuted(!this.muted);
    if (!this.muted) this.play('pause');
  }

  play(name, opts) {
    this.history.push(name);
    if (this.history.length > 100) this.history.shift();
    if (!this.ctx || this.muted) return;
    const fn = SOUNDS[name];
    if (fn) fn(this, opts);
  }

  envelope(gain, start, dur, vol, attack = 0.005) {
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(vol, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  }

  tone({ type = 'sine', f0, f1, dur, vol = 0.1, t = 0, filter }) {
    const ctx = this.ctx;
    const start = ctx.currentTime + t;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, start);
    if (f1) osc.frequency.exponentialRampToValueAtTime(f1, start + dur);
    const gain = ctx.createGain();
    this.envelope(gain, start, dur, vol);
    let node = osc;
    if (filter) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = filter;
      osc.connect(lp);
      node = lp;
    }
    node.connect(gain);
    gain.connect(this.master);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  noise({ dur, vol = 0.1, t = 0, filter = 'lowpass', f0 = 1000, f1, q = 1 }) {
    const ctx = this.ctx;
    const start = ctx.currentTime + t;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bq = ctx.createBiquadFilter();
    bq.type = filter;
    bq.Q.value = q;
    bq.frequency.setValueAtTime(f0, start);
    if (f1) bq.frequency.exponentialRampToValueAtTime(f1, start + dur);
    const gain = ctx.createGain();
    this.envelope(gain, start, dur, vol, 0.004);
    src.connect(bq);
    bq.connect(gain);
    gain.connect(this.master);
    src.start(start);
    src.stop(start + dur + 0.05);
  }
}
