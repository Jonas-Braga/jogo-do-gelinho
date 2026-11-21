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
// Clareia (f > 0) ou escurece (f < 0) uma cor #RRGGBB
function tone(hex, f) {
  const c = hex.match(/\w\w/g).map((v) => parseInt(v, 16));
  const m = c.map((v) => Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)));
  return `rgb(${m[0]},${m[1]},${m[2]})`;
}

// Abóbora com volume: gomos arredondados (os de fora mais estreitos, como numa
// esfera), cada um com brilho próprio do lado do luar, luz de borda no alto à
// esquerda, brilho especular e cabinho torcido.
function pumpkinBody(ctx, cx, cy, rx, ry, color) {
  const lobes = [-1, 1, -0.5, 0.5, 0];
  for (const s of lobes) {
    const lx = cx + s * rx * 0.56;
    const lw = rx * (0.5 - Math.abs(s) * 0.1);
    const lh = ry * (1 - Math.abs(s) * 0.07);
    const dark = -0.15 - (s + 1) * 0.16;   // gomos à direita (longe da lua) mais escuros
    const g = ctx.createRadialGradient(lx - lw * 0.35, cy - lh * 0.45, 0.5, lx, cy, Math.max(lw, lh) * 1.1);
    g.addColorStop(0, tone(color, 0.38 - (s + 1) * 0.1));
    // O gomo do meio, de frente para a câmera, tem a cor própria da abóbora
    g.addColorStop(0.5, s === 0 ? color : tone(color, dark * 0.4));
    g.addColorStop(1, tone(color, dark - 0.25));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(lx, cy, lw, lh, 0, 0, TAU);
    ctx.fill();
  }
  // Brilho especular no gomo do meio e luz de borda do luar
  ctx.fillStyle = 'rgba(255, 240, 220, 0.35)';
  ctx.beginPath();
  ctx.ellipse(cx - rx * 0.22, cy - ry * 0.5, rx * 0.16, ry * 0.18, -0.5, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(225, 210, 255, 0.5)';
  ctx.lineWidth = Math.max(0.8, rx * 0.05);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.98, ry * 0.97, 0, Math.PI * 1.08, Math.PI * 1.5);
  ctx.stroke();
  // Cabinho torcido (com o topo cortado mais claro)
  const sg = ctx.createLinearGradient(cx - rx * 0.1, 0, cx + rx * 0.2, 0);
  sg.addColorStop(0, '#6E8A3C');
  sg.addColorStop(1, '#344A1A');
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.moveTo(cx - rx * 0.12, cy - ry * 0.86);
  ctx.quadraticCurveTo(cx - rx * 0.06, cy - ry * 1.4, cx + rx * 0.2, cy - ry * 1.48);
  ctx.lineTo(cx + rx * 0.22, cy - ry * 1.3);
  ctx.quadraticCurveTo(cx + rx * 0.1, cy - ry * 1.2, cx + rx * 0.12, cy - ry * 0.86);
  ctx.fill();
  ctx.fillStyle = '#9DB26A';
  ctx.beginPath();
  ctx.ellipse(cx + rx * 0.21, cy - ry * 1.39, rx * 0.05, ry * 0.08, 0.3, 0, TAU);
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
  const n = Math.max(1, Math.round(w / 40));
  const pw = w / n;
  const WL = 10; // linha d'água (os pés pisam em 0, no alto das abóboras)
  const color = active ? JACK_ORANGE : '#B85A1C';
  const pumps = Array.from({ length: n }, (_, i) => ({
    cx: i * pw + pw / 2 + (rnd() - 0.5) * 2,
    rx: pw / 2 + 1.5,
    ry: 11 + rnd() * 1.5,
    bob: (rnd() - 0.5) * 1.6,
  }));

  // Reflexo de cada abóbora na água escura (alongado e esmaecido para baixo)
  for (const p of pumps) {
    const rg = g.createLinearGradient(0, WL, 0, WL + 22);
    rg.addColorStop(0, active ? 'rgba(255, 150, 40, 0.38)' : 'rgba(184, 90, 28, 0.26)');
    rg.addColorStop(1, 'rgba(184, 90, 28, 0)');
    g.fillStyle = rg;
    g.beginPath();
    g.ellipse(p.cx, WL + 4, p.rx * 0.85, 16, 0, 0, Math.PI);
    g.fill();
  }

  // Rama verde ligando as abóboras por trás, com gavinhas enroladas
  g.lineCap = 'round';
  g.strokeStyle = '#2E4618';
  g.lineWidth = 2.6;
  g.beginPath();
  g.moveTo(2, -2);
  for (let i = 0; i < n; i++) g.quadraticCurveTo(i * pw + pw / 2, -9, (i + 1) * pw - 2, -2);
  g.stroke();
  g.strokeStyle = '#5A7A2E';
  g.lineWidth = 1;
  g.stroke();
  for (let i = 0; i < n; i++) {
    const x = (i + 1) * pw - 4;
    g.strokeStyle = '#4C6E2A';
    g.lineWidth = 0.9;
    g.beginPath();
    g.arc(x, -6, 2.4, Math.PI * 0.2, Math.PI * 1.7);
    g.stroke();
  }

  for (const [i, p] of pumps.entries()) {
    const cy = 4 + p.bob;
    pumpkinBody(g, p.cx, cy, p.rx, p.ry, color);
    // Parte de baixo dentro d'água: tingida pela cor do rio
    g.save();
    g.beginPath();
    g.ellipse(p.cx, cy, p.rx + 1, p.ry + 1, 0, 0, TAU);
    g.clip();
    const wg = g.createLinearGradient(0, WL - 4, 0, cy + p.ry);
    wg.addColorStop(0, 'rgba(46, 22, 74, 0)');
    wg.addColorStop(0.35, 'rgba(46, 22, 74, 0.45)');
    wg.addColorStop(1, 'rgba(26, 10, 46, 0.8)');
    g.fillStyle = wg;
    g.fillRect(p.cx - p.rx - 2, WL - 4, p.rx * 2 + 4, 30);
    g.restore();
    // Anel d'água em volta: só a metade da frente aparece clara (curva, não reta)
    g.strokeStyle = 'rgba(205, 180, 255, 0.38)';
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(p.cx, WL - 1, p.rx * 0.86, 2.4, 0, 0.35, 1.25);
    g.stroke();
    g.beginPath();
    g.ellipse(p.cx, WL - 1, p.rx * 0.86, 2.4, 0, 1.9, Math.PI - 0.35);
    g.stroke();
    if (active) {
      carvedFace(g, p.cx, cy, Math.min(p.rx, 15), 0.3 + i);
      // Luz da vela vazando pelo rosto
      const lg = g.createRadialGradient(p.cx, cy + 1, 1, p.cx, cy + 1, p.rx * 1.2);
      lg.addColorStop(0, 'rgba(255, 200, 90, 0.35)');
      lg.addColorStop(1, 'rgba(255, 160, 40, 0)');
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = lg;
      g.beginPath();
      g.arc(p.cx, cy + 1, p.rx * 1.2, 0, TAU);
      g.fill();
      g.restore();
    } else {
      // Folha da rama (com a nervura)
      g.fillStyle = '#4C6E2A';
      g.beginPath();
      g.ellipse(p.cx + p.rx * 0.5, cy - p.ry - 1, 4.5, 2.4, -0.5, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(160, 200, 110, 0.6)';
      g.lineWidth = 0.6;
      g.beginPath();
      g.moveTo(p.cx + p.rx * 0.5 - 3.5, cy - p.ry + 1);
      g.lineTo(p.cx + p.rx * 0.5 + 3.5, cy - p.ry - 3);
      g.stroke();
    }
  }
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
// No lugar do urso: corcunda, de pé nas patas de trás (pernas de lobo, com o
// calcanhar alto), pelo cinza-azulado desgrenhado, juba de pelo no pescoço,
// orelhas pontudas, focinho comprido com mandíbula que abre, olhos amarelos
// brilhando, mãos com garras e a calça roxa rasgada. Tudo em formas cheias com
// luz do luar (alto à esquerda): músculos arredondados, pelo em mechas e sombra
// própria do lado oposto. Parado, uiva para a lua de vez em quando.
export const WEREWOLF = {
  fur: ['#8C86A0', '#5E5874', '#3A344C'], belly: '#A69EB4', eye: '#FFE14A', pants: ['#6A3A8C', '#3E1E58'], claw: '#F1EADA',
};
const WOLF_DEEP = '#241E32';
const MOUTH = '#5A1A2A';

// Segmento de membro cheio (cápsula afunilada de A até B), sombreado na
// perpendicular: lado da luz mais claro, lado oposto mais escuro.
function limb(ctx, ax, ay, bx, by, ra, rb, light, colors) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len;
  let ny = dx / len;
  if (nx * light[0] + ny * light[1] > 0) { nx = -nx; ny = -ny; } // n aponta para longe da luz
  const ang = Math.atan2(dy, dx);
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const r = Math.max(ra, rb);
  const g = ctx.createLinearGradient(mx - nx * r, my - ny * r, mx + nx * r, my + ny * r);
  g.addColorStop(0, colors[0]);
  g.addColorStop(0.5, colors[1]);
  g.addColorStop(1, colors[2]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(ax, ay, ra, ang + Math.PI / 2, ang - Math.PI / 2);
  ctx.arc(bx, by, rb, ang - Math.PI / 2, ang + Math.PI / 2);
  ctx.closePath();
  ctx.fill();
}

// Tufo de pelo pontudo (para a borda das costas, cotovelos, juba)
function tuft(ctx, x, y, ang, len, w) {
  ctx.beginPath();
  ctx.moveTo(x - Math.sin(ang) * w, y + Math.cos(ang) * w);
  ctx.quadraticCurveTo(
    x + Math.cos(ang) * len * 0.6, y + Math.sin(ang) * len * 0.6 - 1,
    x + Math.cos(ang) * len, y + Math.sin(ang) * len,
  );
  ctx.lineTo(x + Math.sin(ang) * w, y - Math.cos(ang) * w);
  ctx.fill();
}

// Ponto e tangente numa curva de Bézier cúbica
function bez(p, k) {
  const u = 1 - k;
  const x = u * u * u * p[0] + 3 * u * u * k * p[2] + 3 * u * k * k * p[4] + k * k * k * p[6];
  const y = u * u * u * p[1] + 3 * u * u * k * p[3] + 3 * u * k * k * p[5] + k * k * k * p[7];
  const tx = 3 * u * u * (p[2] - p[0]) + 6 * u * k * (p[4] - p[2]) + 3 * k * k * (p[6] - p[4]);
  const ty = 3 * u * u * (p[3] - p[1]) + 6 * u * k * (p[5] - p[3]) + 3 * k * k * (p[7] - p[5]);
  return { x, y, a: Math.atan2(ty, tx) };
}

// Mechas de pelo (traços curtos claros e escuros) dentro do recorte atual
function furStrands(ctx, x0, y0, w, h, seed, ang, light, dark) {
  const rnd = seeded(seed);
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.1;
  for (let i = 0; i < 46; i++) {
    const x = x0 + rnd() * w;
    const y = y0 + rnd() * h;
    const l = 4 + rnd() * 6;
    const a = ang + (rnd() - 0.5) * 0.5;
    ctx.strokeStyle = i % 3 === 0 ? light : dark;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 1, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
}

export function drawWerewolf(ctx, b, t) {
  const Wf = WEREWOLF;
  const run = b.chasing;
  const ph = b.walk * (run ? 5 : 3.5);
  const sw = Math.sin(ph);
  const breath = Math.sin(t * 2) * 1;
  // Uivo: de tempos em tempos, quando não está perseguindo
  const howl = run ? 0 : Math.max(0, Math.sin(t * 0.7) - 0.75) * 4;
  // Luz do luar no sistema local (o desenho é espelhado quando anda para a esquerda)
  const L = [-0.7 * b.dir, -0.7];
  const furC = [Wf.fur[0], Wf.fur[1], Wf.fur[2]];
  const backC = [Wf.fur[1], Wf.fur[2], WOLF_DEEP];

  // Sombra no chão
  const sh = ctx.createRadialGradient(b.x, b.y + 2, 4, b.x, b.y + 2, 56);
  sh.addColorStop(0, 'rgba(8, 4, 14, 0.45)');
  sh.addColorStop(1, 'rgba(8, 4, 14, 0)');
  ctx.save();
  ctx.translate(b.x, b.y + 2);
  ctx.scale(1, 0.16);
  ctx.fillStyle = sh;
  ctx.beginPath();
  ctx.arc(0, 0, 56, 0, TAU);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.scale(b.dir, 1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Cauda peluda (atrás de tudo), balançando
  const tailTip = [-64, -22 + sw * 6];
  const tg = ctx.createLinearGradient(-20, -50, tailTip[0], tailTip[1]);
  tg.addColorStop(0, Wf.fur[1]);
  tg.addColorStop(1, Wf.fur[2]);
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.moveTo(-20, -52);
  ctx.bezierCurveTo(-44, -60, -60, -44 + sw * 3, tailTip[0], tailTip[1]);
  ctx.bezierCurveTo(-52, -26 + sw * 4, -40, -34, -18, -40);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = Wf.fur[2];
  for (let i = 0; i < 5; i++) {
    const k = 0.25 + i * 0.16;
    tuft(ctx, -20 + (tailTip[0] + 20) * k, -46 + (tailTip[1] + 46) * k + 4, 1.9 + k * 0.6, 8, 2.5);
  }
  ctx.fillStyle = Wf.fur[0];
  tuft(ctx, tailTip[0] + 3, tailTip[1] - 1, Math.PI + 0.4, 8, 2.4);

  // Pernas de lobo: coxa musculosa, canela, calcanhar alto e pata com garras
  const leg = (s, back) => {
    const k = (back ? -sw : sw) * (run ? 1 : 0.45);
    const C = back ? backC : furC;
    const hip = [-6 + s, -50];
    const knee = [8 + s + k * 8, -31];
    const hock = [-5 + s + k * 12, -14];
    const paw = [3 + s + k * 16, -4];
    limb(ctx, hock[0], hock[1], paw[0], paw[1], 4.6, 4, L, C);
    limb(ctx, knee[0], knee[1], hock[0], hock[1], 7, 4.8, L, C);
    limb(ctx, hip[0], hip[1], knee[0], knee[1], 13, 7.5, L, C);
    // Massa do músculo da coxa
    const mg = ctx.createRadialGradient(hip[0] + 2 - 4 * b.dir, hip[1] + 4, 1, hip[0] + 4, hip[1] + 8, 16);
    mg.addColorStop(0, C[0]);
    mg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.ellipse(hip[0] + 4, hip[1] + 9, 12, 9, 0.9, 0, TAU);
    ctx.fill();
    // Tufo no calcanhar
    ctx.fillStyle = C[1];
    tuft(ctx, hock[0] - 2, hock[1], Math.PI * 0.85, 7, 2.5);
    // Pata: almofada, dedos e garras
    const pg = ctx.createLinearGradient(0, paw[1] - 5, 0, paw[1] + 4);
    pg.addColorStop(0, C[0]);
    pg.addColorStop(1, C[2]);
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.ellipse(paw[0] + 5, paw[1] + 0.5, 11, 4.6, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = Wf.claw;
    for (let i = 0; i < 3; i++) {
      const cx = paw[0] + 10 + i * 3.2;
      ctx.beginPath();
      ctx.moveTo(cx - 1.4, paw[1] + 1);
      ctx.quadraticCurveTo(cx + 2.4, paw[1] + 1, cx + 3.2, paw[1] + 4.5);
      ctx.lineTo(cx + 0.6, paw[1] + 3.6);
      ctx.closePath();
      ctx.fill();
    }
  };
  leg(6, true);
  leg(-3, false);

  // Calça roxa rasgada por cima dos quadris (até a coxa), com buracos e costura
  const pgr = ctx.createLinearGradient(-26, -60, 20, -32);
  pgr.addColorStop(0, Wf.pants[0]);
  pgr.addColorStop(1, Wf.pants[1]);
  ctx.fillStyle = pgr;
  ctx.beginPath();
  ctx.moveTo(-26, -58);
  ctx.quadraticCurveTo(-4, -62, 18, -56);
  ctx.lineTo(17, -40);
  ctx.lineTo(12, -34);
  ctx.lineTo(8, -40);
  ctx.lineTo(3, -32);
  ctx.lineTo(-2, -39);
  ctx.lineTo(-9, -33);
  ctx.lineTo(-14, -40);
  ctx.lineTo(-21, -36);
  ctx.lineTo(-25, -44);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = Wf.pants[1];
  ctx.fillRect(-25, -57, 42, 3); // cós
  ctx.fillStyle = Wf.fur[1];
  ctx.beginPath();
  ctx.ellipse(-12, -47, 3.5, 2.2, 0.3, 0, TAU);
  ctx.ellipse(9, -45, 2.6, 1.8, -0.2, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 220, 255, 0.25)';
  ctx.lineWidth = 0.8;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(-3, -54);
  ctx.lineTo(-2, -40);
  ctx.stroke();
  ctx.setLineDash([]);

  // Tronco corcunda (inclinado para frente)
  ctx.save();
  ctx.translate(0, breath);
  ctx.rotate(run ? 0.35 : 0.18 - howl * 0.08);
  const back = [-22, -50, -38, -64, -36, -94, -12, -104];
  const torso = () => {
    ctx.beginPath();
    ctx.moveTo(-22, -50);
    ctx.bezierCurveTo(back[2], back[3], back[4], back[5], back[6], back[7]);
    ctx.quadraticCurveTo(6, -112, 20, -104);
    ctx.bezierCurveTo(34, -98, 36, -76, 25, -63);
    ctx.quadraticCurveTo(18, -54, 14, -50);
    ctx.closePath();
  };
  // Arrepiado nas costas (desenhado antes, para sair por trás da silhueta)
  const hr = seeded(41);
  for (let i = 0; i < 13; i++) {
    const p = bez(back, 0.1 + i * 0.068 + (hr() - 0.5) * 0.03);
    ctx.fillStyle = i % 3 === 0 ? Wf.fur[2] : Wf.fur[1];
    tuft(ctx, p.x, p.y, p.a - Math.PI / 2 - 0.75 + (hr() - 0.5) * 0.5, 5 + hr() * 6, 2.6 + hr() * 1.4);
  }
  const tgr = ctx.createRadialGradient(-12 - 6 * b.dir, -96, 4, 0, -76, 46);
  tgr.addColorStop(0, '#A8A2BC');
  tgr.addColorStop(0.45, Wf.fur[1]);
  tgr.addColorStop(1, Wf.fur[2]);
  ctx.fillStyle = tgr;
  torso();
  ctx.fill();
  ctx.save();
  torso();
  ctx.clip();
  // Peito claro e barriga com mechas
  const cg = ctx.createRadialGradient(16, -84, 2, 16, -76, 22);
  cg.addColorStop(0, '#C4BCD0');
  cg.addColorStop(1, 'rgba(166, 158, 180, 0)');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.ellipse(16, -78, 15, 24, 0.25, 0, TAU);
  ctx.fill();
  // Peitoral e costelas marcados
  ctx.strokeStyle = 'rgba(30, 24, 44, 0.45)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(6, -92);
  ctx.quadraticCurveTo(18, -82, 30, -86);
  ctx.moveTo(10, -72);
  ctx.quadraticCurveTo(16, -68, 24, -70);
  ctx.moveTo(10, -64);
  ctx.quadraticCurveTo(15, -60, 21, -62);
  ctx.stroke();
  furStrands(ctx, -34, -108, 66, 60, 7, 1.9, 'rgba(200, 194, 220, 0.45)', 'rgba(30, 24, 44, 0.4)');
  // Sombra própria embaixo da corcunda
  const sg = ctx.createLinearGradient(0, -70, 0, -48);
  sg.addColorStop(0, 'rgba(20, 14, 32, 0)');
  sg.addColorStop(1, 'rgba(20, 14, 32, 0.45)');
  ctx.fillStyle = sg;
  ctx.fillRect(-40, -70, 80, 24);
  ctx.restore();

  // Braços longos e musculosos com mãos de garras
  const arm = (isBack) => {
    const k = (isBack ? sw : -sw) * (run ? 1 : 0.4);
    const C = isBack ? backC : furC;
    const sx = isBack ? 4 : 10;
    const sy = -92;
    const hx = run ? 36 + k * 8 : 24 + k * 6 + howl * 4;
    const hy = run ? -64 - k * 6 : -44 - howl * 20;
    const ex = (sx + hx) / 2 + (run ? -2 : 6);
    const ey = (sy + hy) / 2 + 8;
    limb(ctx, ex, ey, hx, hy, 6, 4.6, L, C);
    limb(ctx, sx, sy, ex, ey, 10, 6.5, L, C);
    // Ombro arredondado e tufo no cotovelo
    const og = ctx.createRadialGradient(sx - 3 * b.dir, sy - 4, 1, sx, sy, 12);
    og.addColorStop(0, C[0]);
    og.addColorStop(1, C[1]);
    ctx.fillStyle = og;
    ctx.beginPath();
    ctx.ellipse(sx + 1, sy + 2, 8.5, 10, 0.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = C[1];
    tuft(ctx, ex - 2, ey + 2, Math.PI * 0.7, 7, 2.6);
    // Mão: palma e quatro dedos curvos com garras
    const a = Math.atan2(hy - ey, hx - ex);
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(a);
    ctx.fillStyle = C[1];
    ctx.beginPath();
    ctx.ellipse(2, 0, 6.5, 5.5, 0, 0, TAU);
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      const fy = -4.5 + i * 3;
      ctx.fillStyle = C[1];
      ctx.beginPath();
      ctx.ellipse(8, fy, 4, 1.7, 0.2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = Wf.claw;
      ctx.beginPath();
      ctx.moveTo(11, fy - 1.4);
      ctx.quadraticCurveTo(16, fy - 0.5, 16.5, fy + 2.6);
      ctx.lineTo(11, fy + 1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  };
  arm(true);

  // Cabeça de lobo (ergue o focinho quando uiva)
  ctx.save();
  ctx.translate(20, -102);
  ctx.rotate(-howl * 0.5 + (run ? -0.25 : 0));
  ctx.scale(1.18, 1.18);
  const open = run ? 0.18 + Math.abs(Math.sin(t * 14)) * 0.12 : howl > 0.2 ? 0.32 : 0.04;
  // Juba de pelo em volta do pescoço (atrás da cabeça)
  ctx.fillStyle = Wf.fur[1];
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * 0.45 + i * 0.2;
    tuft(ctx, -4 + Math.cos(a) * 10, 4 + Math.sin(a) * 10, a, 11, 3.4);
  }
  // Orelhas pontudas com o miolo rosado
  for (const [ex, lean, C] of [[-10, -0.25, Wf.fur[2]], [0, 0.05, Wf.fur[1]]]) {
    ctx.fillStyle = C;
    ctx.beginPath();
    ctx.moveTo(ex - 6, -6);
    ctx.quadraticCurveTo(ex - 3, -20, ex + Math.sin(lean) * 8, -30);
    ctx.quadraticCurveTo(ex + 6, -18, ex + 7, -7);
    ctx.fill();
  }
  ctx.fillStyle = '#B88A9C';
  ctx.beginPath();
  ctx.moveTo(-3, -9);
  ctx.quadraticCurveTo(-1, -19, 0.5, -25);
  ctx.quadraticCurveTo(4, -17, 4, -9);
  ctx.fill();
  // Crânio
  const hg = ctx.createRadialGradient(-4 - 3 * b.dir, -9, 2, 0, -2, 18);
  hg.addColorStop(0, '#ABA4C0');
  hg.addColorStop(0.55, Wf.fur[1]);
  hg.addColorStop(1, Wf.fur[2]);
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.ellipse(0, -2, 15, 13, 0, 0, TAU);
  ctx.fill();
  // Bochecha peluda para trás
  ctx.fillStyle = Wf.fur[0];
  tuft(ctx, -8, 4, Math.PI * 0.8, 9, 3);
  tuft(ctx, -6, 8, Math.PI * 0.65, 8, 2.6);
  // Mandíbula de baixo (abre girando no canto da boca), boca e dentes
  ctx.save();
  ctx.translate(8, 4);
  ctx.rotate(open);
  ctx.fillStyle = MOUTH;
  ctx.beginPath();
  ctx.moveTo(0, -3);
  ctx.lineTo(20, -2);
  ctx.lineTo(18, 1);
  ctx.lineTo(0, 1);
  ctx.fill();
  const jg = ctx.createLinearGradient(0, -2, 0, 7);
  jg.addColorStop(0, Wf.belly);
  jg.addColorStop(1, Wf.fur[2]);
  ctx.fillStyle = jg;
  ctx.beginPath();
  ctx.moveTo(-2, 0);
  ctx.lineTo(19, 0);
  ctx.quadraticCurveTo(18, 5, 12, 6);
  ctx.quadraticCurveTo(2, 7, -2, 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = Wf.claw;
  for (let x = 4; x < 18; x += 3.5) {
    ctx.beginPath();
    ctx.moveTo(x, 0.2);
    ctx.lineTo(x + 1.2, -2.6 - (x > 14 ? 1.4 : 0));
    ctx.lineTo(x + 2.4, 0.2);
    ctx.fill();
  }
  ctx.restore();
  // Focinho comprido (de cima), com sombra embaixo e a ponta brilhando
  const mz = ctx.createLinearGradient(0, -9, 0, 6);
  mz.addColorStop(0, '#C4BCD0');
  mz.addColorStop(0.5, Wf.belly);
  mz.addColorStop(1, Wf.fur[1]);
  ctx.fillStyle = mz;
  ctx.beginPath();
  ctx.moveTo(4, -9);
  ctx.quadraticCurveTo(22, -9, 32, -3);
  ctx.quadraticCurveTo(34, 2, 29, 4);
  ctx.lineTo(8, 5);
  ctx.closePath();
  ctx.fill();
  // Dentes de cima e as presas
  ctx.fillStyle = Wf.claw;
  for (let x = 10; x < 28; x += 3.5) {
    const fang = x < 11 || x > 24;
    ctx.beginPath();
    ctx.moveTo(x, 4.2);
    ctx.lineTo(x + 1.3, 7 + (fang ? 3 : 0) + open * 4);
    ctx.lineTo(x + 2.6, 4.2);
    ctx.fill();
  }
  // Nariz preto com brilho
  ctx.fillStyle = '#16101C';
  ctx.beginPath();
  ctx.ellipse(31.5, -2.5, 3.8, 2.8, 0.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.beginPath();
  ctx.ellipse(30.5, -3.8, 1.3, 0.7, 0.2, 0, TAU);
  ctx.fill();
  // Olho amarelo brilhando (pupila em fenda), com a sobrancelha brava
  const eg = ctx.createRadialGradient(7, -6, 0.5, 7, -6, 10);
  eg.addColorStop(0, 'rgba(255, 225, 74, 0.65)');
  eg.addColorStop(1, 'rgba(255, 225, 74, 0)');
  ctx.fillStyle = eg;
  ctx.beginPath();
  ctx.arc(7, -6, 10, 0, TAU);
  ctx.fill();
  ctx.fillStyle = Wf.eye;
  ctx.beginPath();
  ctx.moveTo(2.5, -6);
  ctx.quadraticCurveTo(7, -10, 11.5, -6.5);
  ctx.quadraticCurveTo(7, -3, 2.5, -6);
  ctx.fill();
  ctx.fillStyle = '#16101C';
  ctx.beginPath();
  ctx.ellipse(7.5, -6.4, 0.9, 2.4, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = WOLF_DEEP;
  ctx.beginPath();
  ctx.moveTo(0, run ? -12 : -11);
  ctx.quadraticCurveTo(7, run ? -12 : -12.5, 13, run ? -8 : -9.5);
  ctx.lineTo(12, -7.5);
  ctx.quadraticCurveTo(6, -10, 0, -9);
  ctx.fill();
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
