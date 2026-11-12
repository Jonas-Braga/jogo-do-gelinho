// Fase especial de Halloween (fase 25): noite de lua cheia com nuvens e morcegos,
// cemitério com lápides e cerca na costa, árvore seca com lanterna, abóboras de
// rosto aceso, neblina rasteira, rio escuro arroxeado com abóboras boiando no lugar
// das placas (acesas = abóboras entalhadas com vela dentro), casa assombrada no
// lugar do iglu, fantasminhas, aranhas e olhos boiando, balas de Halloween no lugar
// dos peixes e um lobisomem no lugar do urso. Só o visual muda (e o ritmo).
import { W, IGLOO, SHORE_Y, SHORE_TOP, WATER_TOP, RULES } from './config.js';

const SS = 2;
const TAU = Math.PI * 2;

function seeded(seed) {
  let s = (seed * 9301 + 49297) % 233280;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}

function offscreen(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * SS);
  c.height = Math.ceil(h * SS);
  const g = c.getContext('2d');
  g.scale(SS, SS);
  return { c, g };
}

// Cores do rio e efeitos (o renderer usa no lugar da água gelada)
export const HAUNT = {
  water: ['#4A3466', '#261A42', '#0E0A1E'],
  ripple: [205, 180, 255],
  bank: 'rgba(15, 8, 25, 0.45)',
  halo: [255, 150, 40],   // brilho laranja das abóboras acesas
  mist: '#C9BEE0',        // neblina (pouso na costa, encaixe das peças da casa)
  chip: '#E8862A',        // lasquinhas de abóbora ao pousar
  spark: '#FFC15A',       // brilhos da fileira acesa
  sky: [96, 58, 128],     // reflexo do céu no rio
};
export const JACK_ORANGE = '#F28C28';
export const CANDLE = '#FFE27A';

// ---------------------------------------------------------------- Céu
const STARS = (() => {
  const r = seeded(7);
  return Array.from({ length: 70 }, () => ({ x: r() * W, y: r() * 150, s: 0.8 + r() * 1.6, sp: 1 + r() * 3, ph: r() * 6 }));
})();
export const MOON = { x: 300, r: 46, color: '#FFF3C4' };

// A lua cheia desce devagar conforme a temperatura cai (como o sol das outras fases)
export function moonPos(skyF) {
  return { x: MOON.x, y: 78 + (1 - skyF) * 70 };
}

export function drawHalloweenSky(ctx, t, skyF) {
  const g = ctx.createLinearGradient(0, 0, 0, SHORE_TOP);
  g.addColorStop(0, '#0B0620');
  g.addColorStop(0.6, '#24123E');
  g.addColorStop(1, '#4E2A5E');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, SHORE_TOP + 30);
  // Estrelas piscando
  ctx.fillStyle = '#FFFFFF';
  for (const s of STARS) {
    ctx.globalAlpha = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph));
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }
  ctx.globalAlpha = 1;
  // Lua cheia com halo e manchas
  const m = moonPos(skyF);
  const halo = ctx.createRadialGradient(m.x, m.y, MOON.r * 0.8, m.x, m.y, MOON.r * 3.2);
  halo.addColorStop(0, 'rgba(255, 236, 170, 0.35)');
  halo.addColorStop(1, 'rgba(255, 236, 170, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(m.x - MOON.r * 3.2, m.y - MOON.r * 3.2, MOON.r * 6.4, MOON.r * 6.4);
  const mg = ctx.createRadialGradient(m.x - 12, m.y - 14, 6, m.x, m.y, MOON.r);
  mg.addColorStop(0, '#FFFBE6');
  mg.addColorStop(1, '#F2DE98');
  ctx.fillStyle = mg;
  ctx.beginPath();
  ctx.arc(m.x, m.y, MOON.r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(200, 170, 100, 0.3)';
  for (const [dx, dy, r] of [[-14, -8, 9], [12, 10, 7], [16, -16, 5], [-6, 18, 6]]) {
    ctx.beginPath();
    ctx.arc(m.x + dx, m.y + dy, r, 0, TAU);
    ctx.fill();
  }
  // Nuvens finas passando na frente da lua
  ctx.fillStyle = 'rgba(40, 22, 60, 0.55)';
  for (let i = 0; i < 3; i++) {
    const cx = ((t * (9 + i * 4) + i * 520) % (W + 400)) - 200;
    const cy = 60 + i * 34;
    for (const [dx, dy, rx, ry] of [[0, 0, 70, 11], [40, -6, 46, 10], [-46, 3, 40, 8]]) {
      ctx.beginPath();
      ctx.ellipse(cx + dx, cy + dy, rx, ry, 0, 0, TAU);
      ctx.fill();
    }
  }
  drawSkyBats(ctx, t, m);
}

// Revoada de morcegos cruzando o céu de vez em quando (passa pela lua)
function drawSkyBats(ctx, t, m) {
  const cycle = 16;
  const k = (t % cycle) / 7; // 7 s atravessando, 9 s sem morcegos
  if (k > 1) return;
  ctx.fillStyle = '#120A1C';
  for (let i = 0; i < 6; i++) {
    const x = -60 + k * (W + 120) - i * 34;
    const y = m.y - 20 + Math.sin(k * 9 + i * 1.7) * 18 + (i % 3) * 14;
    const f = Math.sin(t * 16 + i * 2);
    const s = 7 + (i % 2) * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - s * 0.6, y - s * 0.4 - f * s * 0.6, x - s * 1.4, y - f * s * 0.5);
    ctx.quadraticCurveTo(x - s * 0.8, y + s * 0.1, x, y + s * 0.3);
    ctx.quadraticCurveTo(x + s * 0.8, y + s * 0.1, x + s * 1.4, y - f * s * 0.5);
    ctx.quadraticCurveTo(x + s * 0.6, y - s * 0.4 - f * s * 0.6, x, y);
    ctx.fill();
  }
}

// ---------------------------------------------------------------- Fundo
// Morros escuros com árvores secas e um casarão ao longe, gramado do cemitério
// com cerca e lápides, e o barranco de terra na beira do rio. O céu (com a lua)
// é desenhado por baixo, a cada quadro.
export const GRAVES = [
  { x: 120, y: 226, w: 26, h: 34, cross: false },
  { x: 205, y: 232, w: 22, h: 28, cross: true },
  { x: 410, y: 222, w: 28, h: 36, cross: false },
  { x: 520, y: 230, w: 22, h: 26, cross: true },
  { x: 640, y: 224, w: 26, h: 32, cross: false },
];

export function makeHalloweenBackground() {
  const h = WATER_TOP + 12;
  const { c, g } = offscreen(W, h);
  const rnd = seeded(31);

  // Morros ao longe
  g.fillStyle = '#2A1838';
  g.beginPath();
  g.moveTo(0, SHORE_TOP + 4);
  for (let x = 0; x <= W; x += 20) g.lineTo(x, SHORE_TOP - 34 - Math.sin(x * 0.006) * 22 - Math.sin(x * 0.019) * 8);
  g.lineTo(W, SHORE_TOP + 4);
  g.fill();
  // Casarão ao longe com uma janelinha acesa
  g.fillStyle = '#1A0F26';
  g.fillRect(770, SHORE_TOP - 76, 70, 50);
  g.fillRect(820, SHORE_TOP - 104, 22, 40);
  g.beginPath();
  g.moveTo(764, SHORE_TOP - 76);
  g.lineTo(805, SHORE_TOP - 102);
  g.lineTo(846, SHORE_TOP - 76);
  g.fill();
  g.beginPath();
  g.moveTo(817, SHORE_TOP - 104);
  g.lineTo(831, SHORE_TOP - 122);
  g.lineTo(845, SHORE_TOP - 104);
  g.fill();
  g.fillStyle = '#FFD86A';
  g.fillRect(790, SHORE_TOP - 64, 7, 8);
  g.fillRect(827, SHORE_TOP - 96, 6, 7);
  // Árvores secas em silhueta nos morros
  g.strokeStyle = '#1A0F26';
  g.lineCap = 'round';
  for (const [x, s] of [[560, 0.7], [690, 0.5], [930, 0.6], [1220, 0.8]]) {
    const y = SHORE_TOP - 30;
    g.lineWidth = 4 * s;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 2, y - 60 * s);
    for (const [a, l] of [[-0.9, 28], [0.7, 24], [-0.4, 18], [1.1, 16]]) {
      const by = y - (30 + l) * s;
      g.moveTo(x + 1, by);
      g.lineTo(x + 1 + Math.sin(a) * l * s, by - Math.cos(a) * l * s);
    }
    g.stroke();
  }

  // Gramado escuro do cemitério
  let grd = g.createLinearGradient(0, SHORE_TOP, 0, WATER_TOP);
  grd.addColorStop(0, '#34413A');
  grd.addColorStop(1, '#1F2A24');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(0, WATER_TOP);
  for (let x = 0; x <= W; x += 20) g.lineTo(x, SHORE_TOP + Math.sin(x * 0.015) * 3);
  g.lineTo(W, WATER_TOP);
  g.fill();
  // Tufos de grama e folhas secas
  for (let i = 0; i < 160; i++) {
    const x = rnd() * W;
    const y = SHORE_TOP + 8 + rnd() * 62;
    if (rnd() < 0.6) {
      g.strokeStyle = 'rgba(80, 110, 80, 0.5)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - 1.5, y - 5);
      g.moveTo(x + 2, y);
      g.lineTo(x + 3, y - 4);
      g.stroke();
    } else {
      g.fillStyle = ['#A0522D', '#C8742A', '#7A4A2A'][i % 3];
      g.beginPath();
      g.ellipse(x, y, 2.6, 1.4, rnd() * 3, 0, TAU);
      g.fill();
    }
  }
  // Cerca de ferro atrás das lápides
  g.strokeStyle = '#141018';
  g.fillStyle = '#141018';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(60, SHORE_TOP - 6);
  g.lineTo(700, SHORE_TOP - 6);
  g.moveTo(60, SHORE_TOP + 8);
  g.lineTo(700, SHORE_TOP + 8);
  g.stroke();
  for (let x = 64; x <= 700; x += 14) {
    g.fillRect(x - 1, SHORE_TOP - 18, 2, 30);
    g.beginPath();
    g.moveTo(x - 3, SHORE_TOP - 17);
    g.lineTo(x, SHORE_TOP - 24);
    g.lineTo(x + 3, SHORE_TOP - 17);
    g.fill();
  }
  // Lápides
  for (const gr of GRAVES) {
    g.fillStyle = 'rgba(10, 6, 16, 0.4)';
    g.beginPath();
    g.ellipse(gr.x + 4, gr.y + 2, gr.w * 0.7, 4, 0, 0, TAU);
    g.fill();
    if (gr.cross) {
      g.fillStyle = '#8E8AA0';
      g.fillRect(gr.x - 3, gr.y - gr.h, 6, gr.h);
      g.fillRect(gr.x - 10, gr.y - gr.h + 7, 20, 6);
      continue;
    }
    const lg = g.createLinearGradient(gr.x - gr.w / 2, 0, gr.x + gr.w / 2, 0);
    lg.addColorStop(0, '#A5A1B6');
    lg.addColorStop(1, '#6C6880');
    g.fillStyle = lg;
    g.beginPath();
    g.moveTo(gr.x - gr.w / 2, gr.y);
    g.lineTo(gr.x - gr.w / 2, gr.y - gr.h + gr.w / 2);
    g.arc(gr.x, gr.y - gr.h + gr.w / 2, gr.w / 2, Math.PI, 0);
    g.lineTo(gr.x + gr.w / 2, gr.y);
    g.fill();
    g.fillStyle = 'rgba(40, 36, 56, 0.7)';
    g.font = '700 8px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText('RIP', gr.x, gr.y - gr.h + gr.w / 2 + 4);
    g.fillRect(gr.x - 6, gr.y - gr.h / 2 + 6, 12, 1.2);
    g.fillStyle = 'rgba(70, 110, 70, 0.5)';
    g.fillRect(gr.x - gr.w / 2, gr.y - 3, gr.w, 3);
  }

  // Barranco de terra na beira do rio
  const edgeTop = WATER_TOP - 12;
  grd = g.createLinearGradient(0, edgeTop, 0, WATER_TOP + 12);
  grd.addColorStop(0, '#3A2C26');
  grd.addColorStop(1, '#1A1218');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(0, edgeTop + 2);
  for (let x = 0; x <= W; x += 14) g.lineTo(x, edgeTop + Math.sin(x * 0.09) * 2);
  g.lineTo(W, WATER_TOP + 12);
  g.lineTo(0, WATER_TOP + 12);
  g.fill();
  g.fillStyle = 'rgba(120, 90, 70, 0.35)';
  for (let i = 0; i < 60; i++) g.fillRect(rnd() * W, edgeTop + 4 + rnd() * 14, 3, 2);

  return { canvas: c, w: W, h };
}

// ---------------------------------------------------------------- Enfeites
// Árvore seca com lanterna balançando e abóboras de rosto aceso na costa
// (tudo à esquerda, longe da casa); neblina rasteira passando.
export const DEAD_TREE = { x: 40, base: 246 };
export const SHORE_PUMPKINS = [{ x: 168, y: 246, s: 1 }, { x: 300, y: 240, s: 0.8 }, { x: 590, y: 244, s: 0.9 }];
export const TREE_BARK = '#2B1E22';

export function drawHalloweenDecor(ctx, t) {
  drawDeadTree(ctx, t);
  for (const [i, p] of SHORE_PUMPKINS.entries()) drawJack(ctx, p.x, p.y, 15 * p.s, t + i * 1.3, true);
  // Neblina rasteira
  ctx.save();
  for (let i = 0; i < 7; i++) {
    const x = ((t * (12 + (i % 3) * 5) + i * 230) % (W + 300)) - 150;
    const y = SHORE_TOP + 30 + (i % 3) * 16;
    const fg = ctx.createRadialGradient(x, y, 4, x, y, 90);
    fg.addColorStop(0, 'rgba(201, 190, 224, 0.16)');
    fg.addColorStop(1, 'rgba(201, 190, 224, 0)');
    ctx.fillStyle = fg;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.3);
    ctx.translate(-x, -y);
    ctx.fillRect(x - 90, y - 90, 180, 180);
    ctx.restore();
  }
  ctx.restore();
}

function drawDeadTree(ctx, t) {
  const { x, base } = DEAD_TREE;
  ctx.save();
  ctx.translate(x, base);
  ctx.fillStyle = 'rgba(10, 6, 16, 0.4)';
  ctx.beginPath();
  ctx.ellipse(10, 2, 34, 5, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = TREE_BARK;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(6, -60, -2, -120);
  ctx.stroke();
  // Galhos retorcidos
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(2, -78);
  ctx.quadraticCurveTo(30, -92, 58, -88);
  ctx.moveTo(-1, -104);
  ctx.quadraticCurveTo(-18, -130, -14, -150);
  ctx.moveTo(-2, -118);
  ctx.quadraticCurveTo(18, -138, 34, -140);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(40, -90);
  ctx.lineTo(50, -104);
  ctx.moveTo(24, -132);
  ctx.lineTo(28, -150);
  ctx.moveTo(-12, -138);
  ctx.lineTo(-26, -146);
  ctx.stroke();
  // Buraco no tronco
  ctx.fillStyle = '#0E0810';
  ctx.beginPath();
  ctx.ellipse(1, -46, 4, 7, 0, 0, TAU);
  ctx.fill();
  // Lanterna pendurada no galho, balançando
  const sw = Math.sin(t * 1.8) * 0.25;
  ctx.save();
  ctx.translate(52, -89);
  ctx.rotate(sw);
  ctx.strokeStyle = '#1A1216';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 18);
  ctx.stroke();
  const lg = ctx.createRadialGradient(0, 28, 2, 0, 28, 26);
  lg.addColorStop(0, `rgba(255, 210, 110, ${0.45 + Math.sin(t * 9) * 0.06})`);
  lg.addColorStop(1, 'rgba(255, 210, 110, 0)');
  ctx.fillStyle = lg;
  ctx.fillRect(-26, 2, 52, 52);
  ctx.fillStyle = '#2A2028';
  ctx.fillRect(-6, 18, 12, 3);
  ctx.fillRect(-5, 36, 10, 3);
  ctx.fillStyle = CANDLE;
  ctx.fillRect(-4.5, 21, 9, 15);
  ctx.strokeStyle = '#2A2028';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(-4.5, 21, 9, 15);
  ctx.restore();
  ctx.restore();
}

// Abóbora com rosto entalhado (lit = vela acesa dentro). Base em (x, y).
export function drawJack(ctx, x, y, r, t, lit) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(10, 6, 16, 0.35)';
  ctx.beginPath();
  ctx.ellipse(2, 1, r * 1.1, r * 0.25, 0, 0, TAU);
  ctx.fill();
  if (lit) {
    const gl = ctx.createRadialGradient(0, -r * 0.7, 2, 0, -r * 0.7, r * 2.6);
    gl.addColorStop(0, `rgba(255, 170, 60, ${0.28 + Math.sin(t * 11) * 0.05})`);
    gl.addColorStop(1, 'rgba(255, 170, 60, 0)');
    ctx.fillStyle = gl;
    ctx.fillRect(-r * 2.6, -r * 3.3, r * 5.2, r * 5.2);
  }
  pumpkinBody(ctx, 0, -r * 0.82, r * 1.12, r * 0.82, lit ? JACK_ORANGE : '#C8641E');
  if (lit) carvedFace(ctx, 0, -r * 0.82, r, t);
  ctx.restore();
}

// Corpo da abóbora com gomos e cabinho, centrado em (cx, cy)
function pumpkinBody(ctx, cx, cy, rx, ry, color) {
  const g = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.4, 1, cx, cy, rx * 1.1);
  g.addColorStop(0, '#FFB45A');
  g.addColorStop(0.45, color);
  g.addColorStop(1, '#8A3A0E');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  ctx.fill();
  // Gomos
  ctx.strokeStyle = 'rgba(110, 40, 8, 0.55)';
  ctx.lineWidth = Math.max(1, rx * 0.06);
  for (const k of [-0.55, 0, 0.55]) {
    ctx.beginPath();
    ctx.ellipse(cx + k * rx * 0.5, cy, rx * (0.5 - Math.abs(k) * 0.3), ry * 0.96, 0, 0, TAU);
    ctx.stroke();
  }
  // Cabinho
  ctx.fillStyle = '#4E6B2A';
  ctx.beginPath();
  ctx.moveTo(cx - rx * 0.1, cy - ry * 0.88);
  ctx.quadraticCurveTo(cx - rx * 0.05, cy - ry * 1.4, cx + rx * 0.2, cy - ry * 1.45);
  ctx.lineTo(cx + rx * 0.12, cy - ry * 0.88);
  ctx.fill();
}

// Rosto entalhado iluminado por dentro: olhos triangulares, nariz e boca dentada
function carvedFace(ctx, cx, cy, r, t) {
  const flick = 0.85 + Math.sin(t * 13) * 0.1 + Math.sin(t * 29) * 0.05;
  ctx.fillStyle = `rgba(255, 226, 122, ${flick})`;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + s * r * 0.18, cy - r * 0.08);
    ctx.lineTo(cx + s * r * 0.52, cy - r * 0.08);
    ctx.lineTo(cx + s * r * 0.35, cy - r * 0.42);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.08, cy + r * 0.08);
  ctx.lineTo(cx + r * 0.08, cy + r * 0.08);
  ctx.lineTo(cx, cy - r * 0.06);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.6, cy + r * 0.2);
  const teeth = 5;
  for (let i = 0; i <= teeth; i++) {
    const x = cx - r * 0.6 + (i * r * 1.2) / teeth;
    ctx.lineTo(x, cy + r * (i % 2 ? 0.3 : 0.2));
  }
  ctx.quadraticCurveTo(cx, cy + r * 0.75, cx - r * 0.6, cy + r * 0.2);
  ctx.fill();
}

// ---------------------------------------------------------------- Abóboras no rio
// Uma fileira de abóboras boiando, encostadas, ligadas pela rama. Os pés pisam em
// y = 0 (topo das abóboras). Acesas: rosto entalhado com vela dentro.
const PUMP_PAD = 12;
const PUMP_TOP = 26;
const PUMP_H = 62;

export function pumpkinSprite(piece, active) {
  const key = active ? 'pumpkinOn' : 'pumpkinOff';
  if (piece.sprites[key]) return piece.sprites[key];
  const w = piece.w;
  const { c, g } = offscreen(w + PUMP_PAD * 2, PUMP_H);
  g.translate(PUMP_PAD, PUMP_TOP);
  const rnd = seeded(piece.seed + 23);
  // Reflexo laranja na água
  g.fillStyle = active ? 'rgba(255, 150, 40, 0.25)' : 'rgba(30, 10, 40, 0.35)';
  g.beginPath();
  g.ellipse(w / 2, 15, w / 2 + 5, 5, 0, 0, TAU);
  g.fill();
  const n = Math.max(1, Math.round(w / 40));
  const pw = w / n;
  // Rama verde ligando as abóboras
  g.strokeStyle = '#3E5A22';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(2, 2);
  for (let i = 0; i < n; i++) g.quadraticCurveTo(i * pw + pw / 2, -6, (i + 1) * pw - 2, 2);
  g.stroke();
  for (let i = 0; i < n; i++) {
    const cx = i * pw + pw / 2;
    const rx = pw / 2 + 1.5;
    const ry = 11 + rnd() * 1.5;
    pumpkinBody(g, cx, 4, rx, ry, active ? JACK_ORANGE : '#B85A1C');
    if (active) {
      carvedFace(g, cx, 4, Math.min(rx, 15), 0.3 + i);
    } else {
      // Folha da rama
      g.fillStyle = '#4C6E2A';
      g.beginPath();
      g.ellipse(cx + rx * 0.5, -6, 4, 2.2, -0.5, 0, TAU);
      g.fill();
    }
  }
  // Brilho no topo onde se pisa
  g.fillStyle = active ? 'rgba(255, 230, 160, 0.6)' : 'rgba(255, 210, 160, 0.25)';
  g.fillRect(4, -6, w - 8, 1.2);
  // Anel de água em volta
  g.fillStyle = 'rgba(205, 180, 255, 0.35)';
  g.fillRect(-3, 14, w + 7, 1.4);
  const sprite = { canvas: c, ox: PUMP_PAD, oy: PUMP_TOP, w: w + PUMP_PAD * 2, h: PUMP_H };
  piece.sprites[key] = sprite;
  return sprite;
}

// ---------------------------------------------------------------- Bichos
// Fantasminha flutuando sobre a fileira (tamanho do ganso)
export const GHOST_WHITE = '#F4F1FF';
export function drawGhost(ctx, c, y, t) {
  const by = y - 34 + Math.sin(t * 3 + c.ph) * 5;
  ctx.fillStyle = 'rgba(20, 10, 40, 0.25)';
  ctx.beginPath();
  ctx.ellipse(c.x, y + 14, 14, 3, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(c.x, by);
  ctx.scale(c.dir, 1);
  ctx.rotate(-0.08);
  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 30);
  glow.addColorStop(0, 'rgba(220, 210, 255, 0.35)');
  glow.addColorStop(1, 'rgba(220, 210, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-30, -30, 60, 60);
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = GHOST_WHITE;
  ctx.beginPath();
  ctx.moveTo(-15, 14);
  ctx.lineTo(-15, -4);
  ctx.quadraticCurveTo(-15, -22, 0, -22);
  ctx.quadraticCurveTo(15, -22, 15, -4);
  ctx.lineTo(15, 14);
  // Barra ondulada (anda tremulando)
  for (let i = 0; i < 4; i++) {
    const x0 = 15 - i * 7.5;
    ctx.quadraticCurveTo(x0 - 3.75, 9 + Math.sin(t * 8 + i + c.ph) * 3, x0 - 7.5, 14);
  }
  ctx.closePath();
  ctx.fill();
  // Bracinho para a frente
  ctx.beginPath();
  ctx.ellipse(14, 2, 6, 3.5, -0.4, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  // Olhos e boca de "buu"
  ctx.fillStyle = '#2A2040';
  ctx.beginPath();
  ctx.ellipse(2, -9, 2.4, 3.4, 0, 0, TAU);
  ctx.ellipse(9, -9, 2.4, 3.4, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(6, -1, 2.6, 3 + Math.abs(Math.sin(t * 4 + c.ph)) * 1.4, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 150, 190, 0.5)';
  ctx.beginPath();
  ctx.arc(-1, -3, 2, 0, TAU);
  ctx.arc(12, -3, 2, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// Aranha roxa andando sobre as abóboras, pendurada num fio que some no alto
export const SPIDER_PURPLE = '#4A2A6A';
export function drawSpider(ctx, c, y, t) {
  const walk = Math.sin(t * 16 + c.ph);
  const by = y - 8;
  ctx.fillStyle = 'rgba(20, 10, 40, 0.3)';
  ctx.beginPath();
  ctx.ellipse(c.x, y + 2, 18, 3, 0, 0, TAU);
  ctx.fill();
  // Fio de teia
  ctx.strokeStyle = 'rgba(230, 230, 255, 0.35)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(c.x - c.dir * 6, by - 10);
  ctx.lineTo(c.x - c.dir * 22, by - 60);
  ctx.stroke();
  ctx.save();
  ctx.translate(c.x, by);
  ctx.scale(c.dir, 1);
  // Oito patas articuladas
  ctx.strokeStyle = '#2A1840';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < 4; i++) {
    const k = (i % 2 ? walk : -walk) * 2.5;
    for (const s of [-1, 1]) {
      const hx = -4 + i * 3;
      ctx.beginPath();
      ctx.moveTo(hx, -4);
      ctx.lineTo(hx + s * (8 + i * 2), -14 + Math.abs(k));
      ctx.lineTo(hx + s * (13 + i * 3) + k, 8);
      ctx.stroke();
    }
  }
  // Abdômen com a marca laranja e cabeça
  const g = ctx.createRadialGradient(-6, -8, 1, -4, -4, 12);
  g.addColorStop(0, '#7A4AA0');
  g.addColorStop(1, SPIDER_PURPLE);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(-5, -5, 11, 9, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = JACK_ORANGE;
  ctx.beginPath();
  ctx.moveTo(-8, -9);
  ctx.lineTo(-4, -5);
  ctx.lineTo(-8, -1);
  ctx.lineTo(-12, -5);
  ctx.fill();
  ctx.fillStyle = '#3A2052';
  ctx.beginPath();
  ctx.arc(7, -4, 6, 0, TAU);
  ctx.fill();
  // Olhinhos brilhando e presas
  ctx.fillStyle = '#FFE27A';
  for (const [ex, ey] of [[8, -7], [11, -6], [8.5, -3.5], [11.5, -3]]) {
    ctx.beginPath();
    ctx.arc(ex, ey, 1.2, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#F4F1FF';
  ctx.fillRect(10, 0, 1.2, 2.5);
  ctx.fillRect(12.5, 0, 1.2, 2.5);
  ctx.restore();
}

// Olho boiando no rio, piscando e olhando para os lados (tamanho do molusco)
export const EYE_IRIS = '#3FBF6A';
export function drawEyeball(ctx, c, y, t) {
  const bob = Math.sin(t * 3 + c.ph) * 2;
  ctx.save();
  ctx.translate(c.x, y + 3 + bob);
  // Bolinha branca com veinhas
  const g = ctx.createRadialGradient(-4, -9, 1, 0, -4, 14);
  g.addColorStop(0, '#FFFFFF');
  g.addColorStop(1, '#D8D0E2');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, -4, 12, Math.PI * 1.02, Math.PI * 1.98);
  ctx.quadraticCurveTo(12, 4, 0, 5);
  ctx.quadraticCurveTo(-12, 4, -11.9, -4.5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(210, 60, 80, 0.6)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-11, -2);
  ctx.quadraticCurveTo(-8, -6, -6, -4);
  ctx.moveTo(10, -1);
  ctx.quadraticCurveTo(8, -7, 5, -6);
  ctx.stroke();
  // Íris olhando para onde anda (e piscando de vez em quando)
  const blink = Math.sin(t * 1.3 + c.ph * 2) > 0.96;
  const look = c.dir * 3 + Math.sin(t * 0.9 + c.ph) * 1.5;
  if (blink) {
    ctx.fillStyle = '#A898C0';
    ctx.fillRect(-11, -6, 22, 2.5);
  } else {
    ctx.fillStyle = EYE_IRIS;
    ctx.beginPath();
    ctx.arc(look, -5, 5.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#10151A';
    ctx.beginPath();
    ctx.arc(look + c.dir * 0.6, -5, 2.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(look - 1.6, -7, 1.2, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  // Anel na água
  ctx.strokeStyle = 'rgba(205, 180, 255, 0.45)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(c.x, y + 8, 16, 3, 0, 0, TAU);
  ctx.stroke();
}

// Bala de Halloween embrulhada (vale os pontos do peixe): pula para fora d'água
export const CANDY_PINK = '#FF5FA2';
export function drawCandy(ctx, c, y, t) {
  const hop = Math.max(0, Math.sin(t * 3 + c.ph)) * 14;
  ctx.save();
  ctx.translate(c.x, y + 2 - hop);
  ctx.rotate(t * 3 * c.dir + c.ph);
  // Pontas do papel torcidas
  ctx.fillStyle = '#FFD23F';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 7, 0);
    ctx.lineTo(s * 15, -6);
    ctx.lineTo(s * 13, 0);
    ctx.lineTo(s * 15, 6);
    ctx.closePath();
    ctx.fill();
  }
  // Bala listrada
  ctx.fillStyle = CANDY_PINK;
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 7, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#FFFFFF';
  for (let x = -12; x < 12; x += 6) {
    ctx.beginPath();
    ctx.moveTo(x, -8);
    ctx.lineTo(x + 3, -8);
    ctx.lineTo(x + 7, 8);
    ctx.lineTo(x + 4, 8);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.beginPath();
  ctx.ellipse(-3, -3, 3, 1.6, -0.4, 0, TAU);
  ctx.fill();
  ctx.restore();
  if (hop < 3) {
    ctx.strokeStyle = 'rgba(205, 180, 255, 0.5)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(c.x, y + 9, 14, 3, 0, 0, TAU);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- Lobisomem
// No lugar do urso: corcunda, de pé nas patas de trás, pelo cinza-azulado
// desgrenhado, orelhas pontudas, focinho comprido, olhos amarelos brilhando,
// garras e a calça roxa rasgada. Parado, uiva para a lua de vez em quando.
export const WEREWOLF = {
  fur: ['#7A7488', '#5A5468', '#3A3448'], belly: '#9C94A8', eye: '#FFE14A', pants: ['#5A2E7A', '#3E1E58'], claw: '#F1EADA',
};

export function drawWerewolf(ctx, b, t) {
  const Wf = WEREWOLF;
  const run = b.chasing;
  const ph = b.walk * (run ? 5 : 3.5);
  const sw = Math.sin(ph);
  const breath = Math.sin(t * 2) * 1;
  // Uivo: de tempos em tempos, quando não está perseguindo
  const howl = run ? 0 : Math.max(0, Math.sin(t * 0.7) - 0.75) * 4;
  ctx.fillStyle = 'rgba(10, 6, 16, 0.35)';
  ctx.beginPath();
  ctx.ellipse(b.x, b.y + 3, 52, 7, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.scale(b.dir, 1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Cauda peluda
  ctx.fillStyle = Wf.fur[2];
  ctx.beginPath();
  ctx.moveTo(-26, -46);
  ctx.quadraticCurveTo(-56, -40 + sw * 4, -60, -20 + sw * 6);
  ctx.quadraticCurveTo(-46, -30, -22, -36);
  ctx.fill();

  // Pernas (de trás mais escura), com joelho dobrado e patas
  const leg = (s, back) => {
    const k = (back ? -sw : sw) * (run ? 1 : 0.5);
    ctx.strokeStyle = back ? Wf.fur[2] : Wf.fur[1];
    ctx.lineWidth = back ? 13 : 14;
    ctx.beginPath();
    ctx.moveTo(-8 + s, -40);
    ctx.lineTo(-2 + s + k * 10, -20);
    ctx.lineTo(-12 + s + k * 16, -4);
    ctx.stroke();
    ctx.fillStyle = back ? Wf.fur[2] : Wf.fur[1];
    ctx.beginPath();
    ctx.ellipse(-8 + s + k * 16, -3, 11, 5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = Wf.claw;
    for (let i = 0; i < 3; i++) ctx.fillRect(-1 + s + k * 16 + i * 3, -3, 2, 3);
  };
  leg(6, true);
  // Calça roxa rasgada (até o joelho)
  ctx.fillStyle = Wf.pants[1];
  ctx.beginPath();
  ctx.moveTo(-22, -50);
  ctx.lineTo(16, -50);
  ctx.lineTo(14, -30);
  ctx.lineTo(8, -26);
  ctx.lineTo(4, -32);
  ctx.lineTo(-2, -25);
  ctx.lineTo(-8, -31);
  ctx.lineTo(-16, -27);
  ctx.closePath();
  ctx.fill();
  leg(-2, false);

  // Tronco corcunda (inclinado para frente)
  ctx.save();
  ctx.translate(0, breath);
  ctx.rotate(run ? 0.35 : 0.18 - howl * 0.08);
  const g = ctx.createLinearGradient(0, -100, 0, -40);
  g.addColorStop(0, Wf.fur[0]);
  g.addColorStop(1, Wf.fur[1]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-24, -46);
  ctx.quadraticCurveTo(-34, -84, -8, -98);
  ctx.quadraticCurveTo(22, -102, 26, -80);
  ctx.quadraticCurveTo(28, -58, 16, -46);
  ctx.closePath();
  ctx.fill();
  // Peito claro e tufos de pelo desgrenhado
  ctx.fillStyle = Wf.belly;
  ctx.beginPath();
  ctx.ellipse(12, -66, 10, 16, 0.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = Wf.fur[0];
  for (let i = 0; i < 6; i++) {
    const a = -2.6 + i * 0.35;
    ctx.beginPath();
    ctx.moveTo(-6 + Math.cos(a) * 26, -74 + Math.sin(a) * 26);
    ctx.lineTo(-6 + Math.cos(a) * 34, -74 + Math.sin(a) * 34 + 2);
    ctx.lineTo(-6 + Math.cos(a + 0.18) * 26, -74 + Math.sin(a + 0.18) * 26);
    ctx.fill();
  }
  // Braço de trás
  const arm = (back) => {
    const k = (back ? sw : -sw) * (run ? 1 : 0.4);
    ctx.strokeStyle = back ? Wf.fur[2] : Wf.fur[1];
    ctx.lineWidth = back ? 9 : 10;
    ctx.beginPath();
    ctx.moveTo(10, -82);
    const hx = run ? 34 + k * 8 : 22 + k * 6 + howl * 4;
    const hy = run ? -66 - k * 6 : -46 - howl * 20;
    ctx.lineTo((10 + hx) / 2 + 4, (-82 + hy) / 2 + 6);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    // Mão com garras
    ctx.fillStyle = back ? Wf.fur[2] : Wf.fur[1];
    ctx.beginPath();
    ctx.arc(hx, hy, 6, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = Wf.claw;
    ctx.lineWidth = 1.6;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(hx + 4, hy + i * 3);
      ctx.lineTo(hx + 9, hy + i * 3 + 2);
      ctx.stroke();
    }
  };
  arm(true);

  // Cabeça de lobo (ergue o focinho quando uiva)
  ctx.save();
  ctx.translate(18, -98);
  ctx.rotate(-howl * 0.5 + (run ? -0.25 : 0));
  ctx.fillStyle = Wf.fur[1];
  // Orelhas pontudas
  for (const [ex, lean] of [[-8, -0.2], [2, 0.1]]) {
    ctx.beginPath();
    ctx.moveTo(ex - 5, -6);
    ctx.lineTo(ex + Math.sin(lean) * 6, -26);
    ctx.lineTo(ex + 6, -8);
    ctx.fill();
  }
  ctx.fillStyle = '#C49AA8';
  ctx.beginPath();
  ctx.moveTo(-1, -8);
  ctx.lineTo(2, -20);
  ctx.lineTo(5, -8);
  ctx.fill();
  const hg = ctx.createRadialGradient(-2, -6, 2, 0, -2, 18);
  hg.addColorStop(0, Wf.fur[0]);
  hg.addColorStop(1, Wf.fur[1]);
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.ellipse(0, -2, 15, 13, 0, 0, TAU);
  ctx.fill();
  // Focinho comprido com o nariz preto
  ctx.fillStyle = Wf.belly;
  ctx.beginPath();
  ctx.moveTo(6, -6);
  ctx.quadraticCurveTo(28, -6, 31, 1);
  ctx.quadraticCurveTo(26, 8, 6, 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1A141E';
  ctx.beginPath();
  ctx.ellipse(30, -1, 3.5, 2.6, 0, 0, TAU);
  ctx.fill();
  // Boca: aberta mostrando os dentes (perseguindo ou uivando)
  if (run || howl > 0.2) {
    ctx.fillStyle = '#5A1A2A';
    ctx.beginPath();
    ctx.moveTo(10, 4);
    ctx.lineTo(28, 3);
    ctx.lineTo(24, 10 + Math.abs(Math.sin(t * 14)) * 3);
    ctx.lineTo(10, 10);
    ctx.fill();
    ctx.fillStyle = Wf.claw;
    for (let x = 12; x < 26; x += 4) {
      ctx.beginPath();
      ctx.moveTo(x, 3.6);
      ctx.lineTo(x + 1.5, 6.5);
      ctx.lineTo(x + 3, 3.6);
      ctx.fill();
    }
  } else {
    ctx.strokeStyle = '#2A1E2A';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(10, 5);
    ctx.lineTo(26, 4);
    ctx.stroke();
  }
  // Olho amarelo brilhando, com sobrancelha brava
  const eg = ctx.createRadialGradient(6, -6, 0.5, 6, -6, 9);
  eg.addColorStop(0, 'rgba(255, 225, 74, 0.6)');
  eg.addColorStop(1, 'rgba(255, 225, 74, 0)');
  ctx.fillStyle = eg;
  ctx.fillRect(-3, -15, 18, 18);
  ctx.fillStyle = Wf.eye;
  ctx.beginPath();
  ctx.ellipse(6, -6, 3.6, 2.6, -0.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1A141E';
  ctx.fillRect(6, -8, 1.6, 4);
  ctx.strokeStyle = '#2A2434';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, run ? -12 : -11);
  ctx.lineTo(11, run ? -8 : -10);
  ctx.stroke();
  ctx.restore();

  arm(false);
  ctx.restore();
  ctx.restore();
}

// ---------------------------------------------------------------- Casa assombrada
// Mesmo lugar e mesma porta do iglu, 16 peças: 6 painéis de tábuas, 3 faixas do
// telhado, 2 janelas com venezianas tortas, a janela redonda do sótão, a chaminé
// torta (de onde sai a fumaça), a lanterna ao lado da porta, o cata-vento de
// morcego no topo e por último a porta, que se fecha atrás do personagem.
const HW = 90;
const WALL_H = 78;
const ROOF = { eave: 116, base: -78, peak: -146 };
const CHIMNEY = { x: 58, top: -140, w: 18 };

export const HAUNTED_DOOR = { x: IGLOO.x, bottom: SHORE_Y + 1, w: IGLOO.doorRx, h: IGLOO.doorH };

const third = (HW * 2) / 3;
const band = (ROOF.base - ROOF.peak) / 3;
export const HAUNTED_PIECES = [
  ...Array.from({ length: 6 }, (_, i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    return { kind: 'wall', row, col, cx: -HW + third * (col + 0.5), cy: -WALL_H / 4 - row * (WALL_H / 2) };
  }),
  ...Array.from({ length: 3 }, (_, i) => ({ kind: 'roof', i, cx: 0, cy: ROOF.base - band * (i + 0.5) })),
  { kind: 'window', side: -1, cx: -58, cy: -46 },
  { kind: 'window', side: 1, cx: 58, cy: -46 },
  { kind: 'attic', cx: 0, cy: -106 },
  { kind: 'chimney', cx: CHIMNEY.x, cy: CHIMNEY.top + 18 },
  { kind: 'lantern', cx: 40, cy: -60 },
  { kind: 'vane', cx: 0, cy: ROOF.peak - 14 },
  { kind: 'door', cx: 0, cy: -IGLOO.doorH / 2 },
];

// Topo da chaminé (de onde sai a fumaça)
export const HAUNTED_VENT = { x: IGLOO.x + CHIMNEY.x, y: IGLOO.baseY + CHIMNEY.top - 6 };
export const WINDOW_GLOW = '#FFD86A';
export const HOUSE_WOOD = '#4A3A5C';

const easeOutBack = (k) => 1 + 2.9 * (k - 1) ** 3 + 1.9 * (k - 1) ** 2;
const roofHalf = (y) => ROOF.eave * (y - ROOF.peak) / (ROOF.base - ROOF.peak);

function drawWall(ctx, row, col) {
  const x0 = -HW + third * col;
  const y1 = -row * (WALL_H / 2);
  const y0 = y1 - WALL_H / 2;
  // Tábuas horizontais sobrepostas, uma meio solta
  const n = 4;
  const bh = (y1 - y0) / n;
  for (let i = 0; i < n; i++) {
    const y = y0 + i * bh;
    const g = ctx.createLinearGradient(0, y, 0, y + bh);
    g.addColorStop(0, '#5E4C72');
    g.addColorStop(1, '#3A2C4A');
    ctx.fillStyle = g;
    const tilt = (row * 3 + col + i) % 5 === 0 ? 0.04 : 0;
    ctx.save();
    ctx.translate(x0, y);
    ctx.rotate(tilt);
    ctx.fillRect(0, 0, third + 0.6, bh + 0.4);
    ctx.fillStyle = 'rgba(15, 8, 25, 0.5)';
    ctx.fillRect(0, bh - 1.2, third, 1.2);
    ctx.restore();
  }
  // Pregos e veios
  ctx.fillStyle = 'rgba(200, 190, 220, 0.25)';
  ctx.fillRect(x0 + 3, y0 + 4, 1.5, 1.5);
  ctx.fillRect(x0 + third - 5, y0 + 4, 1.5, 1.5);
}

function drawRoof(ctx, i) {
  const yb = ROOF.base - band * i;
  const yt = yb - band;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-ROOF.eave, ROOF.base);
  ctx.lineTo(0, ROOF.peak);
  ctx.lineTo(ROOF.eave, ROOF.base);
  ctx.closePath();
  ctx.clip();
  const g = ctx.createLinearGradient(0, yt, 0, yb);
  g.addColorStop(0, '#2C2238');
  g.addColorStop(1, '#1A1424');
  ctx.fillStyle = g;
  ctx.fillRect(-ROOF.eave, yt - 0.5, ROOF.eave * 2, band + 1);
  // Telhas de ardósia em escama
  ctx.fillStyle = 'rgba(120, 100, 150, 0.35)';
  for (let y = yt + 6; y < yb; y += 9) {
    const hw = roofHalf(y);
    for (let x = -hw + ((y / 9) % 2) * 5; x < hw; x += 10) {
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI);
      ctx.fill();
    }
  }
  ctx.restore();
  // Beiral (só na faixa de baixo)
  if (i === 0) {
    ctx.fillStyle = '#120C1A';
    ctx.fillRect(-ROOF.eave - 4, ROOF.base - 2, ROOF.eave * 2 + 8, 5);
  }
}

function drawHouseWindow(ctx, side, lit, t) {
  const x = side * 58 - 13;
  const y = -60;
  const w = 26;
  const h = 30;
  const flick = 0.82 + Math.sin(t * 7 + side) * 0.08 + Math.sin(t * 23) * 0.05;
  ctx.fillStyle = lit ? `rgba(255, 200, 100, ${flick})` : `rgba(255, 216, 106, ${flick * 0.7})`;
  ctx.fillRect(x, y, w, h);
  // Silhueta assustadora na janela (só na da direita, de vez em quando)
  if (side > 0 && Math.sin(t * 0.5) > 0.6) {
    ctx.fillStyle = 'rgba(40, 20, 50, 0.55)';
    ctx.beginPath();
    ctx.arc(x + 13, y + 14, 6, 0, TAU);
    ctx.fillRect(x + 6, y + 18, 14, 12);
    ctx.fill();
  }
  // Caixilho em cruz e moldura
  ctx.fillStyle = '#1A1224';
  ctx.fillRect(x + w / 2 - 1.2, y, 2.4, h);
  ctx.fillRect(x, y + h / 2 - 1.2, w, 2.4);
  ctx.strokeStyle = '#1A1224';
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  // Veneziana torta, pendurada de um lado
  ctx.save();
  ctx.translate(side < 0 ? x - 2 : x + w + 2, y);
  ctx.rotate(side * 0.18);
  ctx.fillStyle = '#2E2240';
  ctx.fillRect(side < 0 ? -11 : 0, 0, 11, h);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  for (let k = 4; k < h; k += 5) ctx.fillRect(side < 0 ? -11 : 0, k, 11, 1.2);
  ctx.restore();
  // Brilho saindo da janela
  const gl = ctx.createRadialGradient(x + w / 2, y + h / 2, 4, x + w / 2, y + h / 2, 34);
  gl.addColorStop(0, 'rgba(255, 210, 110, 0.22)');
  gl.addColorStop(1, 'rgba(255, 210, 110, 0)');
  ctx.fillStyle = gl;
  ctx.fillRect(x - 24, y - 20, w + 48, h + 40);
}

function drawAttic(ctx, t) {
  ctx.fillStyle = '#1A1224';
  ctx.beginPath();
  ctx.arc(0, -106, 12, 0, TAU);
  ctx.fill();
  ctx.fillStyle = `rgba(160, 255, 140, ${0.55 + Math.sin(t * 2.2) * 0.25})`;
  ctx.beginPath();
  ctx.arc(0, -106, 8.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1A1224';
  ctx.fillRect(-1, -115, 2, 18);
  ctx.fillRect(-9, -107, 18, 2);
}

function drawChimney(ctx) {
  const { x, top, w } = CHIMNEY;
  ctx.save();
  ctx.translate(x, top);
  ctx.rotate(0.08); // torta
  ctx.fillStyle = '#3A2A30';
  ctx.fillRect(-w / 2, 0, w, 48);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  for (let y = 6; y < 48; y += 8) ctx.fillRect(-w / 2, y, w, 1.2);
  ctx.fillStyle = '#2A1E24';
  ctx.fillRect(-w / 2 - 3, -4, w + 6, 6);
  ctx.restore();
}

function drawLantern(ctx, t) {
  ctx.save();
  ctx.translate(40, -66);
  ctx.fillStyle = '#1A1224';
  ctx.fillRect(-7, -6, 14, 3);
  ctx.fillRect(-1, -10, 2, 5);
  const gl = ctx.createRadialGradient(0, 6, 2, 0, 6, 26);
  gl.addColorStop(0, `rgba(255, 210, 110, ${0.45 + Math.sin(t * 9) * 0.07})`);
  gl.addColorStop(1, 'rgba(255, 210, 110, 0)');
  ctx.fillStyle = gl;
  ctx.fillRect(-26, -20, 52, 52);
  ctx.fillStyle = CANDLE;
  ctx.fillRect(-5, -3, 10, 15);
  ctx.strokeStyle = '#1A1224';
  ctx.lineWidth = 1.4;
  ctx.strokeRect(-5, -3, 10, 15);
  ctx.fillRect(-6, 12, 12, 3);
  ctx.restore();
}

function drawVane(ctx, t) {
  ctx.save();
  ctx.translate(0, ROOF.peak);
  ctx.strokeStyle = '#120C1A';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(0, -14);
  ctx.stroke();
  // Morcego girando devagar com o vento
  ctx.translate(0, -16);
  ctx.scale(Math.cos(t * 0.8), 1);
  ctx.fillStyle = '#120C1A';
  ctx.beginPath();
  ctx.moveTo(0, -3);
  ctx.quadraticCurveTo(-6, -8, -13, -4);
  ctx.quadraticCurveTo(-9, 0, -6, 3);
  ctx.quadraticCurveTo(0, 0, 6, 3);
  ctx.quadraticCurveTo(9, 0, 13, -4);
  ctx.quadraticCurveTo(6, -8, 0, -3);
  ctx.fill();
  ctx.restore();
}

function doorRect() {
  const d = HAUNTED_DOOR;
  return { x: d.x - d.w, y: d.bottom - d.h, w: d.w * 2, h: d.h };
}

// Batente em arco pontudo (gótico) em volta da porta
function drawDoorFrame(ctx) {
  const r = doorRect();
  ctx.strokeStyle = '#1A1224';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(r.x - 2, r.y + r.h);
  ctx.lineTo(r.x - 2, r.y + 8);
  ctx.quadraticCurveTo(r.x - 2, r.y - 10, r.x + r.w / 2, r.y - 16);
  ctx.quadraticCurveTo(r.x + r.w + 2, r.y - 10, r.x + r.w + 2, r.y + 8);
  ctx.lineTo(r.x + r.w + 2, r.y + r.h);
  ctx.stroke();
  // Degrau de pedra
  ctx.fillStyle = '#5A5468';
  ctx.fillRect(r.x - 10, r.y + r.h - 3, r.w + 20, 5);
}

// Porta de tábuas que fecha girando na dobradiça: k = 0 aberta, 1 fechada
function drawDoorLeaf(ctx, k) {
  if (k <= 0) return;
  const r = doorRect();
  const w = r.w * k;
  const g = ctx.createLinearGradient(r.x, 0, r.x + w, 0);
  g.addColorStop(0, '#3A2416');
  g.addColorStop(1, '#5A3A22');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(r.x, r.y + r.h);
  ctx.lineTo(r.x, r.y + 8);
  ctx.quadraticCurveTo(r.x, r.y - 6, r.x + Math.min(w, r.w / 2), r.y - 12 + (w < r.w / 2 ? 6 * (1 - w / (r.w / 2)) : 0));
  if (w > r.w / 2) ctx.quadraticCurveTo(r.x + w, r.y - 6, r.x + w, r.y + 8);
  ctx.lineTo(r.x + w, r.y + r.h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  for (let x = r.x + 8; x < r.x + w; x += 9) ctx.fillRect(x, r.y - 4, 1.2, r.h + 4);
  if (k > 0.8) {
    ctx.fillStyle = '#C9A44A';
    ctx.beginPath();
    ctx.arc(r.x + w - 8, r.y + r.h * 0.55, 2.4, 0, TAU);
    ctx.fill();
  }
}

// Desenha a casa com as peças já construídas (igloo = estado da construção)
export function drawHaunted(ctx, igloo, t) {
  const n = igloo.count;
  ctx.save();
  ctx.translate(IGLOO.x, IGLOO.baseY);
  ctx.fillStyle = 'rgba(10, 6, 16, 0.4)';
  ctx.beginPath();
  ctx.ellipse(6, 3, HW + 32, 9, 0, 0, TAU);
  ctx.fill();
  if (n < RULES.iglooPieces) {
    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = 'rgba(201, 190, 224, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-HW, -WALL_H, HW * 2, WALL_H);
    ctx.beginPath();
    ctx.moveTo(-ROOF.eave, ROOF.base);
    ctx.lineTo(0, ROOF.peak);
    ctx.lineTo(ROOF.eave, ROOF.base);
    ctx.stroke();
    ctx.restore();
  }
  // Ordem de desenho: chaminé atrás do telhado, paredes, janelas, telhado, sótão,
  // lanterna e cata-vento
  const order = [12, 0, 1, 2, 3, 4, 5, 9, 10, 6, 7, 8, 11, 13, 14];
  for (const i of order) {
    if (i >= n) continue;
    const a = igloo.anim[i];
    ctx.save();
    ctx.globalAlpha = Math.min(1, a * 3);
    ctx.translate(0, -(1 - easeOutBack(a)) * 46);
    const p = HAUNTED_PIECES[i];
    if (p.kind === 'wall') drawWall(ctx, p.row, p.col);
    else if (p.kind === 'roof') drawRoof(ctx, p.i);
    else if (p.kind === 'window') drawHouseWindow(ctx, p.side, igloo.lit, t);
    else if (p.kind === 'attic') drawAttic(ctx, t);
    else if (p.kind === 'chimney') drawChimney(ctx);
    else if (p.kind === 'lantern') drawLantern(ctx, t);
    else if (p.kind === 'vane') drawVane(ctx, t);
    ctx.restore();
  }
  ctx.restore();

  // Porta (peça 16): abertura escura, luz quando acesa, porta de tábuas e batente
  const r = doorRect();
  if (n < RULES.iglooPieces) {
    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = 'rgba(201, 190, 224, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(r.x - 4, r.y - 14, r.w + 8, r.h + 14);
    ctx.restore();
    return;
  }
  const a = igloo.anim[RULES.iglooPieces - 1];
  ctx.save();
  ctx.globalAlpha = Math.min(1, a * 3);
  ctx.translate(0, -(1 - easeOutBack(a)) * 30);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(r.x, r.y + r.h);
  ctx.lineTo(r.x, r.y + 8);
  ctx.quadraticCurveTo(r.x, r.y - 8, r.x + r.w / 2, r.y - 14);
  ctx.quadraticCurveTo(r.x + r.w, r.y - 8, r.x + r.w, r.y + 8);
  ctx.lineTo(r.x + r.w, r.y + r.h);
  ctx.closePath();
  const dg = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  dg.addColorStop(0, '#0E0814');
  dg.addColorStop(1, '#22182E');
  ctx.fillStyle = dg;
  ctx.fill();
  if (igloo.lit) {
    ctx.fillStyle = `rgba(255, 190, 100, ${0.5 + Math.sin(t * 5) * 0.08})`;
    ctx.fill();
  }
  ctx.restore();
  drawDoorLeaf(ctx, igloo.curtain);
  drawDoorFrame(ctx);
  ctx.restore();
}

// Desenhado POR CIMA do personagem enquanto ele entra
export function drawHauntedDoorFront(ctx, igloo, t) {
  if (igloo.count < RULES.iglooPieces) return;
  const r = doorRect();
  ctx.save();
  if (igloo.shade > 0) {
    ctx.fillStyle = `rgba(14, 8, 20, ${0.45 * igloo.shade})`;
    ctx.fillRect(r.x, r.y - 8, r.w, r.h + 8);
  }
  drawDoorLeaf(ctx, igloo.curtain);
  drawDoorFrame(ctx);
  ctx.restore();
}
