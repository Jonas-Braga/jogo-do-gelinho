// Fase especial do Reino dos doces (fase 40): morros de sorvete com calda escorrendo,
// árvores de algodão-doce e pirulitos ao fundo, chão de bolo coberto de glacê e
// granulado, rio de chocolate com biscoitos waffle boiando no lugar das placas
// (acesos = cobertura de glacê rosa com granulado), casa de biscoito de gengibre no
// lugar do iglu (porta de chocolate), abelhas, minhocas de goma e balas de goma
// pulando no lugar dos bichos, rosquinhas no lugar dos peixes, o personagem de
// confeiteiro e um homem-biscoito gigante no lugar do urso. Só o visual muda (e o
// ritmo, como toda especial).
import { W, IGLOO, SHORE_Y, SHORE_TOP, WATER_TOP, RULES } from './config.js';
import { doorArt, addLight } from './art.js';

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

// Cores do rio de chocolate (o renderer usa no lugar da água gelada)
export const CANDY = {
  water: ['#9A6038', '#62361C', '#2E1608'],
  ripple: [236, 196, 160],
  bank: 'rgba(60, 24, 10, 0.35)',
  halo: [255, 140, 200],   // brilho rosa dos biscoitos acesos
  sand: '#FFF1E2',         // açúcar (pouso na costa, encaixe das peças da casa)
  chip: '#D8A060',         // farelo de biscoito ao pousar
  spark: '#FF9AD0',        // brilhos da fileira acesa (granulado)
};
// Granulado colorido (usado em vários doces)
export const SPRINKLES = ['#FF5A8A', '#FFD23A', '#5AC8FA', '#7ADB6A', '#B57AF0', '#FFFFFF'];
export const ICING = '#FFFFFF';
export const PINK_ICING = '#FF9ACB';
export const WAFFLE = '#E2A65A';
export const CHOCOLATE = '#5A2E16';

// ---------------------------------------------------------------- Fundo
// Morros de sorvete (morango, menta e baunilha) com calda de chocolate escorrendo,
// árvores de algodão-doce e pirulitos em espiral, o chão de bolo coberto de glacê
// com granulado e o barranco em fatia de bolo (massa, recheio e geleia) descendo
// para o rio de chocolate. O céu é o mesmo das fases normais, desenhado por baixo.
export const SCOOPS = [
  { x: 120, r: 120, base: 236, color: '#FFB0C8', dark: '#E07A9E' },
  { x: 380, r: 150, base: 240, color: '#B8EED0', dark: '#78C69E' },
  { x: 660, r: 128, base: 236, color: '#FFF0C8', dark: '#E0C27A' },
  { x: 930, r: 160, base: 242, color: '#FFB0C8', dark: '#E07A9E' },
  { x: 1210, r: 130, base: 238, color: '#C8D8FF', dark: '#8EA2E0' },
];
export const COTTON_TREES = [
  { x: 250, h: 74, color: '#FFB6E0' },
  { x: 520, h: 64, color: '#B6E2FF' },
  { x: 790, h: 80, color: '#FFB6E0' },
];

export function makeCandyBackground() {
  const h = WATER_TOP + 12;
  const { c, g } = offscreen(W, h);
  const rnd = seeded(41);

  // Morros de sorvete: bolas redondas com a borda escorrendo e a calda por cima
  for (const s of SCOOPS) {
    const cy = s.base;
    const grd = g.createRadialGradient(s.x - s.r * 0.35, cy - s.r * 0.75, s.r * 0.1, s.x, cy - s.r * 0.4, s.r * 1.1);
    grd.addColorStop(0, '#FFFFFF');
    grd.addColorStop(0.25, s.color);
    grd.addColorStop(1, s.dark);
    g.fillStyle = grd;
    g.beginPath();
    g.ellipse(s.x, cy, s.r, s.r * 0.72, 0, Math.PI, TAU);
    // Barrinha ondulada embaixo (onde o sorvete derrete)
    for (let k = 0; k <= 10; k++) {
      const xx = s.x + s.r - (k / 10) * s.r * 2;
      g.lineTo(xx, cy + 4 + Math.sin(k * 1.7) * 4);
    }
    g.fill();
    // Calda de chocolate no topo, escorrendo em gotas
    g.fillStyle = '#6A3A1C';
    g.beginPath();
    const top = cy - s.r * 0.72;
    g.moveTo(s.x - s.r * 0.55, top + s.r * 0.22);
    g.quadraticCurveTo(s.x, top - 6, s.x + s.r * 0.55, top + s.r * 0.22);
    for (let k = 0; k <= 6; k++) {
      const xx = s.x + s.r * 0.55 - (k / 6) * s.r * 1.1;
      const drip = k % 2 ? s.r * (0.12 + rnd() * 0.18) : 4;
      g.lineTo(xx, top + s.r * 0.22 + drip);
    }
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255, 255, 255, 0.35)';
    g.beginPath();
    g.ellipse(s.x - s.r * 0.2, top + 8, s.r * 0.2, 4, -0.1, 0, TAU);
    g.fill();
    // Cereja no maior
    if (s.r >= 150) {
      g.fillStyle = '#D8202E';
      g.beginPath();
      g.arc(s.x + 4, top - 10, 10, 0, TAU);
      g.fill();
      g.strokeStyle = '#4A7A2A';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(s.x + 6, top - 19);
      g.quadraticCurveTo(s.x + 12, top - 34, s.x + 22, top - 36);
      g.stroke();
    }
  }

  // Árvores de algodão-doce (palito e nuvem fofa) e pirulitos em espiral ao fundo
  for (const tr of COTTON_TREES) {
    const by = SHORE_TOP + 4;
    g.strokeStyle = '#F4E6D0';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(tr.x, by);
    g.lineTo(tr.x, by - tr.h * 0.6);
    g.stroke();
    g.fillStyle = tr.color;
    for (const [dx, dy, r] of [[0, -0.8, 0.28], [-0.2, -0.66, 0.22], [0.2, -0.66, 0.22], [0, -0.58, 0.24]]) {
      g.beginPath();
      g.arc(tr.x + dx * tr.h, by + dy * tr.h, r * tr.h, 0, TAU);
      g.fill();
    }
    g.fillStyle = 'rgba(255, 255, 255, 0.4)';
    g.beginPath();
    g.arc(tr.x - tr.h * 0.08, by - tr.h * 0.86, tr.h * 0.1, 0, TAU);
    g.fill();
  }

  // Chão de bolo coberto de glacê branco com granulado
  let grd = g.createLinearGradient(0, SHORE_TOP, 0, WATER_TOP);
  grd.addColorStop(0, '#FFFFFF');
  grd.addColorStop(1, '#F6E4EE');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(0, WATER_TOP);
  for (let xx = 0; xx <= W; xx += 16) g.lineTo(xx, SHORE_TOP + Math.sin(xx * 0.02) * 2.5);
  g.lineTo(W, WATER_TOP);
  g.fill();
  for (let i = 0; i < 260; i++) {
    const px = rnd() * W;
    const py = SHORE_TOP + 6 + rnd() * (WATER_TOP - SHORE_TOP - 22);
    g.save();
    g.translate(px, py);
    g.rotate(rnd() * Math.PI);
    g.fillStyle = SPRINKLES[i % SPRINKLES.length];
    g.fillRect(-2.2, -0.8, 4.4, 1.6);
    g.restore();
  }

  // Barranco em fatia de bolo: glacê escorrendo, massa, recheio, geleia e massa
  const edgeTop = WATER_TOP - 14;
  const layers = [
    ['#F2D0A0', 4], ['#FFFFFF', 3], ['#D8506A', 3], ['#E8B878', 5], ['#5A2E16', 12],
  ];
  let y = edgeTop;
  for (const [col, hh] of layers) {
    g.fillStyle = col;
    g.fillRect(0, y, W, hh + 0.5);
    y += hh;
  }
  // Glacê escorrendo por cima da fatia
  g.fillStyle = '#FFFFFF';
  g.beginPath();
  g.moveTo(0, edgeTop - 2);
  for (let xx = 0; xx <= W; xx += 18) {
    const drip = (xx / 18) % 3 === 0 ? 6 + rnd() * 6 : 1.5;
    g.lineTo(xx, edgeTop + drip);
    g.lineTo(xx + 9, edgeTop + 1);
  }
  g.lineTo(W, edgeTop - 2);
  g.fill();
  g.fillStyle = 'rgba(0, 0, 0, 0.1)';
  for (let i = 0; i < 60; i++) g.fillRect(rnd() * W, edgeTop + 5 + rnd() * 8, 1.4, 1.4);

  return { canvas: c, w: W, h };
}

// ---------------------------------------------------------------- Enfeites
// Pirulito gigante em espiral, bengala doce listrada e um montinho de balas de goma
// fincados no glacê (tudo longe da casa de biscoito).
export const LOLLIPOP = { x: 110, y: 246 };
export const CANE = { x: 300, y: 244 };
export const GUMDROPS = { x: 490, y: 248 };
export const GUMDROP_COLORS = ['#FF4A6A', '#FFC83A', '#4AC86A', '#5A9AFF', '#B060E0'];
// Gancho do visual 3D (src/model3d.js): pirulito, bengala e balas em 3D
export const candyArt = { on: false, lollipop: null, cane: null, gumdrops: null };

export function drawCandyDecor(ctx, t) {
  drawLollipop(ctx, t);
  drawCane(ctx);
  drawGumdrops(ctx);
}

function shadow(ctx, x, y, rx) {
  ctx.fillStyle = 'rgba(120, 60, 90, 0.22)';
  ctx.beginPath();
  ctx.ellipse(x + 3, y + 1, rx, 5, 0, 0, TAU);
  ctx.fill();
}

function drawLollipop(ctx, t) {
  const { x, y } = LOLLIPOP;
  ctx.save();
  ctx.translate(x, y);
  shadow(ctx, 0, 0, 22);
  if (candyArt.on && candyArt.lollipop?.(ctx, t)) {
    ctx.restore();
    return;
  }
  ctx.fillStyle = '#F6EEE0';
  ctx.fillRect(-2.5, -70, 5, 70);
  // Disco com espiral colorida
  ctx.save();
  ctx.translate(0, -92);
  ctx.rotate(Math.sin(t * 0.8) * 0.05);
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  const cols = ['#FF4A8A', '#5AC8FA', '#FFD23A'];
  for (let k = 0; k < 3; k++) {
    ctx.strokeStyle = cols[k];
    ctx.beginPath();
    for (let a = 0; a < TAU * 2.2; a += 0.2) {
      const r = (a / (TAU * 2.2)) * 23;
      const px = Math.cos(a + k * 2.1) * r;
      const py = Math.sin(a + k * 2.1) * r;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.beginPath();
  ctx.ellipse(-9, -10, 8, 4, -0.6, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawCane(ctx) {
  const { x, y } = CANE;
  ctx.save();
  ctx.translate(x, y);
  shadow(ctx, 0, 0, 16);
  if (candyArt.on && candyArt.cane?.(ctx)) {
    ctx.restore();
    return;
  }
  // Bengala listrada de branco e vermelho com o gancho virado
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -70);
    ctx.arc(14, -70, 14, Math.PI, 0);
    ctx.lineTo(28, -60);
  };
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 10;
  path();
  ctx.stroke();
  ctx.strokeStyle = '#E0283A';
  ctx.setLineDash([7, 7]);
  ctx.lineWidth = 10;
  path();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawGumdrops(ctx) {
  const { x, y } = GUMDROPS;
  ctx.save();
  ctx.translate(x, y);
  shadow(ctx, 0, 0, 30);
  if (candyArt.on && candyArt.gumdrops?.(ctx)) {
    ctx.restore();
    return;
  }
  const drops = [[-20, 0, 0], [0, 0, 1], [20, 0, 2], [-10, -15, 3], [10, -15, 4]];
  for (const [dx, dy, ci] of drops) {
    ctx.fillStyle = GUMDROP_COLORS[ci];
    ctx.beginPath();
    ctx.moveTo(dx - 11, dy);
    ctx.quadraticCurveTo(dx - 11, dy - 18, dx, dy - 19);
    ctx.quadraticCurveTo(dx + 11, dy - 18, dx + 11, dy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    for (let i = 0; i < 5; i++) ctx.fillRect(dx - 6 + i * 3, dy - 12 + (i % 2) * 5, 1.4, 1.4);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- Biscoitos no rio
// Biscoitos waffle boiando no chocolate, um atrás do outro, topo onde se pisa em y = 0.
// Acesos: cobertura de glacê rosa escorrendo com granulado. Funciona com pedaços curtos.
const COOKIE_PAD = 12;
const COOKIE_TOP = 26;
const COOKIE_H = 62;
export const COOKIE = { PAD: COOKIE_PAD, TOP: COOKIE_TOP, H: COOKIE_H };

export function cookieSprite(piece, active) {
  const key = active ? 'cookieOn' : 'cookieOff';
  if (piece.sprites[key]) return piece.sprites[key];
  const w = piece.w;
  const { c, g } = offscreen(w + COOKIE_PAD * 2, COOKIE_H);
  g.translate(COOKIE_PAD, COOKIE_TOP);
  const rnd = seeded(piece.seed + 83);
  // Sombra no chocolate
  g.fillStyle = 'rgba(30, 10, 0, 0.35)';
  g.beginPath();
  g.ellipse(w / 2, 15, w / 2 + 4, 5, 0, 0, TAU);
  g.fill();
  // Quantos waffles cabem (cada um com ~40 de comprimento)
  const n = Math.max(1, Math.round(w / 40));
  const bw = w / n;
  for (let i = 0; i < n; i++) {
    const x0 = i * bw + 1;
    const x1 = (i + 1) * bw - 1;
    // Lateral (espessura) e o topo quadriculado
    g.fillStyle = '#B4743A';
    g.beginPath();
    g.roundRect(x0, 2, x1 - x0, 11, 3);
    g.fill();
    const grd = g.createLinearGradient(0, -2, 0, 6);
    grd.addColorStop(0, '#F2C07A');
    grd.addColorStop(1, WAFFLE);
    g.fillStyle = grd;
    g.beginPath();
    g.roundRect(x0, -2, x1 - x0, 7, 3);
    g.fill();
    g.strokeStyle = 'rgba(140, 80, 30, 0.6)';
    g.lineWidth = 0.9;
    for (let xx = x0 + 5; xx < x1 - 2; xx += 5) {
      g.beginPath();
      g.moveTo(xx, -1.5);
      g.lineTo(xx, 4.5);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(x0 + 1, 1.5);
    g.lineTo(x1 - 1, 1.5);
    g.stroke();
    if (active) {
      // Glacê rosa por cima, escorrendo pela lateral, com granulado
      g.fillStyle = PINK_ICING;
      g.beginPath();
      g.moveTo(x0 + 1, -2);
      g.lineTo(x1 - 1, -2);
      for (let k = 0; k <= 4; k++) {
        const xx = x1 - 1 - (k / 4) * (x1 - x0 - 2);
        g.lineTo(xx, 3 + (k % 2 ? 5 : 1));
      }
      g.closePath();
      g.fill();
      for (let k = 0; k < 6; k++) {
        g.fillStyle = SPRINKLES[(k + i) % SPRINKLES.length];
        g.fillRect(x0 + 3 + rnd() * (x1 - x0 - 8), -1.5 + rnd() * 3, 2.4, 1.1);
      }
    }
  }
  // Chocolate encostando nos biscoitos
  g.strokeStyle = 'rgba(236, 196, 160, 0.6)';
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(-3, 13);
  g.lineTo(w + 3, 13);
  g.stroke();
  const sprite = { canvas: c, ox: COOKIE_PAD, oy: COOKIE_TOP, w: w + COOKIE_PAD * 2, h: COOKIE_H };
  piece.sprites[key] = sprite;
  return sprite;
}

// ---------------------------------------------------------------- Bichos
// Abelha de mel voando baixo sobre a fileira (tamanho do ganso): listras amarelas e
// pretas, asas transparentes batendo rápido e o ferrão
export const BEE = { body: '#FFC82A', stripe: '#2A1E10', wing: 'rgba(220, 240, 255, 0.75)' };
export function drawBee(ctx, c, y, t) {
  const flap = Math.sin(t * 40 + c.ph * 3);
  const by = y - 32 + Math.sin(t * 4 + c.ph) * 5;
  ctx.fillStyle = 'rgba(40, 10, 0, 0.25)';
  ctx.beginPath();
  ctx.ellipse(c.x, y + 14, 12, 3, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(c.x, by);
  ctx.scale(c.dir, 1);
  const wing = (back) => {
    ctx.fillStyle = BEE.wing;
    ctx.beginPath();
    ctx.ellipse(-2 + (back ? -4 : 0), -10 - flap * 2, 6, 10, (back ? -0.6 : -0.3) + flap * 0.3, 0, TAU);
    ctx.fill();
  };
  wing(true);
  // Ferrão e corpo listrado
  ctx.fillStyle = BEE.stripe;
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  ctx.lineTo(-20, 1.5);
  ctx.lineTo(-14, 3);
  ctx.fill();
  ctx.fillStyle = BEE.body;
  ctx.beginPath();
  ctx.ellipse(-3, 1, 12, 8.5, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(-3, 1, 12, 8.5, 0, 0, TAU);
  ctx.clip();
  ctx.fillStyle = BEE.stripe;
  for (const sx of [-10, -4, 2]) ctx.fillRect(sx, -8, 3, 18);
  ctx.restore();
  // Cabeça, olho e antenas
  ctx.fillStyle = BEE.stripe;
  ctx.beginPath();
  ctx.arc(10, -1, 6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(12, -2.5, 2.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(12.8, -2.5, 1.1, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = BEE.stripe;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(11, -6);
  ctx.quadraticCurveTo(14, -12, 18, -12);
  ctx.moveTo(9, -6);
  ctx.quadraticCurveTo(10, -13, 14, -15);
  ctx.stroke();
  wing(false);
  ctx.restore();
}

// Minhoca de goma listrada nadando no chocolate em arcos (tamanho do caranguejo)
export const WORM = { colors: ['#FF4A6A', '#FFC83A', '#4AC86A'], sugar: 'rgba(255, 255, 255, 0.7)' };
export function drawWorm(ctx, c, y, t) {
  const ph = t * 6 + c.ph;
  ctx.save();
  ctx.translate(c.x, y + 8);
  ctx.scale(c.dir, 1);
  ctx.lineCap = 'round';
  // Corpo em arco saindo e voltando para o chocolate, em 3 cores
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const k = i / 12;
    pts.push([-22 + k * 44, -Math.sin(k * Math.PI) * (16 + Math.sin(ph) * 4) + Math.sin(ph + k * 6) * 1.5]);
  }
  for (let s = 0; s < 3; s++) {
    ctx.strokeStyle = WORM.colors[s];
    ctx.lineWidth = 8;
    ctx.beginPath();
    for (let i = s * 4; i <= Math.min(12, s * 4 + 4); i++) {
      const [px, py] = pts[i];
      if (i === s * 4) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  // Açúcar cristal
  ctx.fillStyle = WORM.sugar;
  for (let i = 1; i < 12; i += 2) ctx.fillRect(pts[i][0] - 1, pts[i][1] - 3, 1.4, 1.4);
  // Cara na ponta da frente
  const [hx, hy] = pts[12];
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(hx - 1, hy - 8, 2.4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1A1010';
  ctx.beginPath();
  ctx.arc(hx - 0.4, hy - 8, 1.2, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(236, 196, 160, 0.55)';
  ctx.lineWidth = 1.4;
  for (const dx of [-22, 22]) {
    ctx.beginPath();
    ctx.ellipse(c.x + dx * c.dir, y + 9, 7, 2, 0, 0, TAU);
    ctx.stroke();
  }
}

// Bala de goma pulando no chocolate (tamanho do molusco): gota translúcida com açúcar
export const GUMMY = { colors: ['#FF4A6A', '#5AC8FA', '#7ADB6A', '#FFC83A'], sugar: 'rgba(255, 255, 255, 0.75)' };
export function gummyColor(c) {
  return GUMMY.colors[Math.abs(Math.floor((c.ph || 0) * 7)) % GUMMY.colors.length];
}
export function drawGummy(ctx, c, y, t) {
  const hop = Math.abs(Math.sin(t * 4 + c.ph)) * 14;
  const squash = hop < 2 ? 1.2 : 1;
  ctx.save();
  ctx.translate(c.x, y + 8 - hop);
  ctx.scale(c.dir * squash, 1 / squash);
  ctx.fillStyle = gummyColor(c);
  ctx.globalAlpha = 0.92;
  ctx.beginPath();
  ctx.moveTo(-13, 0);
  ctx.quadraticCurveTo(-13, -22, 0, -23);
  ctx.quadraticCurveTo(13, -22, 13, 0);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = GUMMY.sugar;
  for (let i = 0; i < 7; i++) ctx.fillRect(-8 + (i * 5) % 16, -18 + ((i * 7) % 14), 1.5, 1.5);
  // Olhinhos e boca
  ctx.fillStyle = '#1A1010';
  for (const ex of [-1, 6]) {
    ctx.beginPath();
    ctx.arc(ex, -11, 1.6, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = '#1A1010';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(2.5, -8, 2.4, 0.2, Math.PI - 0.2);
  ctx.stroke();
  ctx.restore();
  if (hop < 4) {
    ctx.strokeStyle = 'rgba(236, 196, 160, 0.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(c.x, y + 9, 15, 3, 0, 0, TAU);
    ctx.stroke();
  }
}

// Rosquinha com cobertura e granulado boiando (no lugar do peixe: mesmos pontos)
export const DONUT = { dough: '#E0A060', icing: '#FF8AC0', hole: '#5A2E16' };
export function drawDonut(ctx, c, y, t) {
  const bob = Math.sin(t * 3 + c.ph) * 2;
  ctx.save();
  ctx.translate(c.x, y + 4 + bob);
  ctx.rotate(Math.sin(t * 2 + c.ph) * 0.12);
  const gl = ctx.createRadialGradient(0, -2, 2, 0, -2, 22);
  gl.addColorStop(0, 'rgba(255, 220, 240, 0.35)');
  gl.addColorStop(1, 'rgba(255, 220, 240, 0)');
  ctx.fillStyle = gl;
  ctx.fillRect(-22, -24, 44, 44);
  ctx.fillStyle = DONUT.dough;
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 7, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = DONUT.icing;
  ctx.beginPath();
  ctx.ellipse(0, -2, 12.5, 5.6, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = DONUT.hole;
  ctx.beginPath();
  ctx.ellipse(0, -2, 4, 1.8, 0, 0, TAU);
  ctx.fill();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    ctx.fillStyle = SPRINKLES[i % SPRINKLES.length];
    ctx.fillRect(Math.cos(a) * 8.5 - 1, -2 + Math.sin(a) * 3.6 - 0.5, 2.2, 1);
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(236, 196, 160, 0.55)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(c.x, y + 9, 16, 3, 0, 0, TAU);
  ctx.stroke();
}

// ---------------------------------------------------------------- Homem-biscoito
// No lugar do urso: biscoito de gengibre gigante de pé, correndo em duas pernas, com
// o contorno de glacê branco, botões de bala de goma, sobrancelhas de glacê e a boca
// de sorriso. Perseguindo, vai de braços para a frente e boca aberta, bravo.
export const GINGER = {
  dough: ['#D88A44', '#B86A2C', '#8A4A1A'], icing: '#FFFFFF', buttons: ['#FF4A6A', '#4AC86A', '#5A9AFF'],
  mouth: '#6A1A14', cheek: '#FF8A9A', eye: '#2A1408',
};
export function drawGingerman(ctx, b, t) {
  const R = GINGER;
  const run = b.chasing;
  const ph = b.walk * 3;
  const bob = -Math.abs(Math.sin(ph)) * 4;
  ctx.fillStyle = 'rgba(120, 60, 90, 0.28)';
  ctx.beginPath();
  ctx.ellipse(b.x, b.y + 3, 44, 7, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.scale(b.dir, 1);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Membro grosso (perna ou braço) com a linha de glacê na ponta
  const limb = (x0, y0, ang, len, back) => {
    ctx.save();
    ctx.translate(x0, y0);
    ctx.rotate(ang);
    ctx.fillStyle = back ? R.dough[2] : R.dough[1];
    ctx.beginPath();
    ctx.roundRect(-9, -4, 18, len + 4, 9);
    ctx.fill();
    ctx.strokeStyle = R.icing;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const yy = len - 10 + i * 3;
      ctx.moveTo(-6, yy - 2);
      ctx.quadraticCurveTo(0, yy + 2, 6, yy - 2);
    }
    ctx.stroke();
    ctx.restore();
  };
  const sw = Math.sin(ph);
  // Pernas (a de trás mais escura)
  limb(-10, -40 + bob, sw * 0.6, 38, true);
  // Braço de trás: perseguindo, esticado para a frente
  const armA = run ? -1.9 + Math.sin(t * 12) * 0.15 : -0.5 - sw * 0.5;
  limb(-16, -86 + bob, run ? armA - 0.2 : -armA * 0.6 + 0.4, 34, true);
  ctx.translate(0, bob);
  // Corpo e cabeça (contorno de glacê ondulado)
  const grd = ctx.createLinearGradient(-30, -130, 30, -30);
  grd.addColorStop(0, R.dough[0]);
  grd.addColorStop(0.6, R.dough[1]);
  grd.addColorStop(1, R.dough[2]);
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.roundRect(-24, -96, 48, 62, 22);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(2, -116, 26, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = R.icing;
  ctx.lineWidth = 2.4;
  ctx.setLineDash([5, 3]);
  ctx.beginPath();
  ctx.arc(2, -116, 22, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(-20, -92, 40, 54, 18);
  ctx.stroke();
  ctx.setLineDash([]);
  // Botões de bala de goma
  R.buttons.forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(0, -82 + i * 15, 4.6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillRect(-2, -84 + i * 15, 1.6, 1.6);
  });
  // Rosto: olhos de glacê com pupila, bochechas, sobrancelhas e a boca
  const mad = run ? 1 : 0;
  for (const ex of [-6, 10]) {
    ctx.fillStyle = R.icing;
    ctx.beginPath();
    ctx.arc(ex, -122, 4.6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = R.eye;
    ctx.beginPath();
    ctx.arc(ex + 1.5, -121.5, 2.4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = R.icing;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(ex - 5, -130 - (ex < 0 ? -mad * 2 : mad * 1));
    ctx.lineTo(ex + 4, -130 + (ex < 0 ? mad * 2 : -mad * 1) + mad * 2);
    ctx.stroke();
  }
  ctx.fillStyle = R.cheek;
  for (const cx of [-12, 18]) {
    ctx.beginPath();
    ctx.arc(cx, -110, 3.4, 0, TAU);
    ctx.fill();
  }
  if (run) {
    const open = 6 + Math.abs(Math.sin(t * 10)) * 3;
    ctx.fillStyle = R.mouth;
    ctx.beginPath();
    ctx.ellipse(4, -105, 8, open / 2, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = R.icing;
    ctx.fillRect(-2, -105 - open / 2, 12, 2);
  } else {
    ctx.strokeStyle = R.icing;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(3, -110, 7, 0.3, Math.PI - 0.3);
    ctx.stroke();
  }
  ctx.translate(0, -bob);
  // Perna e braço da frente
  limb(10, -40 + bob, -sw * 0.6, 38, false);
  limb(18, -86 + bob, run ? armA : armA * -0.6 - 0.4, 34, false);
  ctx.restore();
}

// ---------------------------------------------------------------- Casa de biscoito
// Mesmo lugar e mesma porta do iglu, 16 peças: 6 painéis de biscoito de gengibre
// (duas fileiras), as 2 águas do telhado de biscoito, a cobertura de glacê escorrendo
// com as balinhas, 2 janelas de bala transparente, a janela redonda de hortelã no
// alto da empena, a chaminé de bombom (de onde sai a fumaça de algodão-doce), as 2
// bengalas doces nos cantos e por último a porta de chocolate.
const HW = 88;
const WALL_H = 76;
const ROW_H = WALL_H / 2;
const ROOF_TOP = -150;
const ROOF_OVER = 14;
const WINDOWS = [{ x: -52, y: -46 }, { x: 52, y: -46 }];
const PEPPERMINT = { x: 0, y: -108 };
const CHIMNEY = { x: 46, w: 20, top: -150, base: -112 };
const CANES = [-HW - 2, HW + 2];

export const GINGER_DOOR = { x: IGLOO.x, bottom: SHORE_Y + 1, w: IGLOO.doorRx, h: IGLOO.doorH };
// Medidas da casa (para o modelo 3D em src/m3d/candy.js)
export const GINGER_HOUSE = { HW, WALL_H, ROW_H, ROOF_TOP, ROOF_OVER, WINDOWS, PEPPERMINT, CHIMNEY, CANES };

const third = (HW * 2) / 3;
export const GINGER_PIECES = [
  ...Array.from({ length: 6 }, (_, i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    return { kind: 'wall', row, col, cx: -HW + third * (col + 0.5), cy: -ROW_H / 2 - row * ROW_H };
  }),
  { kind: 'roof', side: -1, cx: -HW / 2, cy: (ROOF_TOP - WALL_H) / 2 },
  { kind: 'roof', side: 1, cx: HW / 2, cy: (ROOF_TOP - WALL_H) / 2 },
  { kind: 'icing', cx: 0, cy: (ROOF_TOP - WALL_H) / 2 - 4 },
  { kind: 'window', side: -1, cx: WINDOWS[0].x, cy: WINDOWS[0].y },
  { kind: 'window', side: 1, cx: WINDOWS[1].x, cy: WINDOWS[1].y },
  { kind: 'peppermint', cx: PEPPERMINT.x, cy: PEPPERMINT.y },
  { kind: 'chimney', cx: CHIMNEY.x, cy: (CHIMNEY.top + CHIMNEY.base) / 2 },
  { kind: 'cane', side: -1, cx: CANES[0], cy: -WALL_H / 2 },
  { kind: 'cane', side: 1, cx: CANES[1], cy: -WALL_H / 2 },
  { kind: 'door', cx: 0, cy: -IGLOO.doorH / 2 },
];

// Topo da chaminé de bombom (de onde sai a fumaça)
export const GINGER_VENT = { x: IGLOO.x + CHIMNEY.x, y: IGLOO.baseY + CHIMNEY.top - 6 };

const easeOutBack = (k) => 1 + 2.9 * (k - 1) ** 3 + 1.9 * (k - 1) ** 2;

// Painel de biscoito de gengibre com a borda de glacê
function gingerPanel(ctx, x, y, w, h, seed) {
  const rnd = seeded(seed);
  const grd = ctx.createLinearGradient(x, y, x, y + h);
  grd.addColorStop(0, '#D8904A');
  grd.addColorStop(1, '#A8662C');
  ctx.fillStyle = grd;
  ctx.fillRect(x, y, w, h);
  // Furinhos do biscoito
  ctx.fillStyle = 'rgba(90, 40, 10, 0.4)';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(x + 4 + rnd() * (w - 8), y + 4 + rnd() * (h - 8), 1, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(80, 36, 10, 0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

// Glacê em ondinhas (bordas, telhado)
function icingWave(ctx, x0, y0, x1, y1, amp = 3, step = 8) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(2, Math.round(len / step));
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const x = x0 + (x1 - x0) * k;
    const y = y0 + (y1 - y0) * k + (i % 2 ? amp : 0);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawRoofSlab(ctx, side) {
  const x0 = side * (HW + ROOF_OVER);
  ctx.fillStyle = '#B87038';
  ctx.beginPath();
  ctx.moveTo(0, ROOF_TOP);
  ctx.lineTo(x0, -WALL_H + 4);
  ctx.lineTo(x0 - side * 10, -WALL_H + 12);
  ctx.lineTo(0, ROOF_TOP + 12);
  ctx.closePath();
  ctx.fill();
  // Telhas de biscoito (escamas)
  ctx.strokeStyle = 'rgba(80, 36, 10, 0.45)';
  ctx.lineWidth = 1;
  for (let k = 0.2; k < 1; k += 0.2) {
    ctx.beginPath();
    ctx.moveTo(x0 * k, ROOF_TOP + (-WALL_H + 4 - ROOF_TOP) * k);
    ctx.lineTo(x0 * k - side * 9, ROOF_TOP + 12 + (-WALL_H + 4 - ROOF_TOP) * k);
    ctx.stroke();
  }
}

function drawRoofIcing(ctx) {
  // Glacê branco escorrendo pela beira do telhado, com balinhas coloridas
  ctx.strokeStyle = ICING;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) icingWave(ctx, 0, ROOF_TOP - 1, side * (HW + ROOF_OVER), -WALL_H + 3, 3, 9);
  ctx.fillStyle = ICING;
  for (const side of [-1, 1]) {
    for (let k = 0.15; k < 1; k += 0.17) {
      const x = side * (HW + ROOF_OVER) * k;
      const y = ROOF_TOP + (-WALL_H + 4 - ROOF_TOP) * k;
      ctx.beginPath();
      ctx.ellipse(x, y + 5, 2.2, 4.5, 0, 0, TAU);
      ctx.fill();
    }
  }
  GUMDROP_COLORS.forEach((col, i) => {
    for (const side of [-1, 1]) {
      const k = 0.18 + i * 0.17;
      const x = side * (HW + ROOF_OVER) * k;
      const y = ROOF_TOP + (-WALL_H + 4 - ROOF_TOP) * k;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y - 3, 3.6, Math.PI, TAU);
      ctx.fill();
    }
  });
}

function drawCandyWindow(ctx, w, lit) {
  const { x, y } = w;
  ctx.fillStyle = lit ? '#FFD080' : '#7AD0E8';
  ctx.beginPath();
  ctx.roundRect(x - 12, y - 12, 24, 24, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.fillRect(x - 9, y - 9, 6, 6);
  // Caixilho de glacê em cruz
  ctx.strokeStyle = ICING;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x - 12, y - 12, 24, 24, 4);
  ctx.moveTo(x, y - 12);
  ctx.lineTo(x, y + 12);
  ctx.moveTo(x - 12, y);
  ctx.lineTo(x + 12, y);
  ctx.stroke();
}

function drawPeppermint(ctx, t) {
  const { x, y } = PEPPERMINT;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 0.2);
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#E0283A';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 12, (i / 6) * TAU, (i / 6) * TAU + 0.5);
    ctx.fill();
  }
  ctx.restore();
}

function drawChimney(ctx) {
  const { x, w, top, base } = CHIMNEY;
  // Bombom de chocolate: torre marrom com a tampa redonda e um confeito
  const grd = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  grd.addColorStop(0, '#7A4022');
  grd.addColorStop(1, '#4A2410');
  ctx.fillStyle = grd;
  ctx.fillRect(x - w / 2, top + 6, w, base - top - 6);
  ctx.beginPath();
  ctx.ellipse(x, top + 6, w / 2 + 3, 6, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 220, 180, 0.4)';
  ctx.lineWidth = 1.4;
  icingWave(ctx, x - w / 2, top + 16, x + w / 2, top + 16, 2, 4);
  ctx.fillStyle = '#FF4A6A';
  ctx.beginPath();
  ctx.arc(x, top + 2, 3.4, 0, TAU);
  ctx.fill();
}

function drawHouseCane(ctx, side) {
  const x = CANES[side < 0 ? 0 : 1];
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, -WALL_H - 4);
    ctx.arc(x - side * 7, -WALL_H - 4, 7, side < 0 ? 0 : Math.PI, side < 0 ? Math.PI : TAU, side < 0);
  };
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 7;
  path();
  ctx.stroke();
  ctx.strokeStyle = '#E0283A';
  ctx.setLineDash([5, 5]);
  path();
  ctx.stroke();
  ctx.setLineDash([]);
}

// Luz quente saindo das janelas (também por cima da casa 3D)
export function drawGingerLights(ctx, t, lit) {
  if (!lit) return;
  for (const w of WINDOWS) {
    if (addLight(ctx, 'glow', { x: w.x, y: w.y, r: 26, color: [255, 200, 120], a: 0.55 + Math.sin(t * 5 + w.x) * 0.06 })) continue;
    const gl = ctx.createRadialGradient(w.x, w.y, 2, w.x, w.y, 26);
    gl.addColorStop(0, 'rgba(255, 200, 120, 0.45)');
    gl.addColorStop(1, 'rgba(255, 200, 120, 0)');
    ctx.fillStyle = gl;
    ctx.fillRect(w.x - 26, w.y - 26, 52, 52);
  }
}

function doorRect() {
  const d = GINGER_DOOR;
  return { x: d.x - d.w, y: d.bottom - d.h, w: d.w * 2, h: d.h };
}

// Contorno da porta (arco redondo em cima)
function doorPath(ctx) {
  const r = doorRect();
  ctx.beginPath();
  ctx.moveTo(r.x, r.y + r.h);
  ctx.lineTo(r.x, r.y + r.w / 2);
  ctx.arc(r.x + r.w / 2, r.y + r.w / 2, r.w / 2, Math.PI, 0);
  ctx.lineTo(r.x + r.w, r.y + r.h);
  ctx.closePath();
}

// Batente de glacê em arco
function drawDoorFrame(ctx, igloo, t) {
  if (doorArt.draw?.(ctx, 'ginger', 'frame', igloo, t)) return;
  const r = doorRect();
  ctx.strokeStyle = ICING;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(r.x - 3, r.y + r.h);
  ctx.lineTo(r.x - 3, r.y + r.w / 2);
  ctx.arc(r.x + r.w / 2, r.y + r.w / 2, r.w / 2 + 3, Math.PI, 0);
  ctx.lineTo(r.x + r.w + 3, r.y + r.h);
  ctx.stroke();
}

// Porta de barra de chocolate (gomos), que fecha girando: k = 0 aberta, 1 fechada
function drawDoorLeaf(ctx, k, igloo, t) {
  if (k <= 0) return;
  if (doorArt.draw?.(ctx, 'ginger', 'leaf', igloo, t)) return;
  const r = doorRect();
  const w = r.w * k;
  ctx.save();
  doorPath(ctx);
  ctx.clip();
  ctx.fillStyle = CHOCOLATE;
  ctx.fillRect(r.x, r.y, w, r.h);
  // Gomos da barra de chocolate
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.lineWidth = 1.4;
  for (let yy = r.y + 14; yy < r.y + r.h; yy += 14) {
    ctx.beginPath();
    ctx.moveTo(r.x, yy);
    ctx.lineTo(r.x + w, yy);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(r.x + w / 2, r.y);
  ctx.lineTo(r.x + w / 2, r.y + r.h);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 220, 180, 0.18)';
  for (let yy = r.y + 2; yy < r.y + r.h; yy += 14) ctx.fillRect(r.x + 2, yy, w - 4, 2);
  ctx.restore();
  if (k > 0.8) {
    ctx.fillStyle = '#FFC83A';
    ctx.beginPath();
    ctx.arc(r.x + w - 8, r.y + r.h * 0.56, 3, 0, TAU);
    ctx.fill();
  }
}

// Desenha a casa com as peças já construídas (igloo = estado da construção)
export function drawGingerHouse(ctx, igloo, t) {
  const n = igloo.count;
  ctx.save();
  ctx.translate(IGLOO.x, IGLOO.baseY);
  ctx.fillStyle = 'rgba(120, 60, 90, 0.3)';
  ctx.beginPath();
  ctx.ellipse(6, 3, HW + 30, 9, 0, 0, TAU);
  ctx.fill();
  if (n < RULES.iglooPieces) {
    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = 'rgba(150, 80, 60, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-HW, -WALL_H, HW * 2, WALL_H);
    ctx.beginPath();
    ctx.moveTo(-HW - ROOF_OVER, -WALL_H);
    ctx.lineTo(0, ROOF_TOP);
    ctx.lineTo(HW + ROOF_OVER, -WALL_H);
    ctx.stroke();
    ctx.restore();
  }
  // Ordem de desenho: chaminé atrás, empena, paredes, telhado, glacê, janelas, bengalas
  const order = [12, 0, 1, 2, 3, 4, 5, 6, 7, 11, 8, 9, 10, 13, 14];
  for (const i of order) {
    if (i >= n) continue;
    const a = igloo.anim[i];
    ctx.save();
    ctx.globalAlpha = Math.min(1, a * 3);
    ctx.translate(0, -(1 - easeOutBack(a)) * 46);
    const p = GINGER_PIECES[i];
    if (p.kind === 'wall') {
      const x0 = -HW + third * p.col;
      const y1 = -p.row * ROW_H;
      gingerPanel(ctx, x0, y1 - ROW_H, third + 0.5, ROW_H + 0.5, 37 + i);
      if (p.row === 1) {
        // Empena de biscoito acima da fileira de cima
        ctx.fillStyle = '#C47C3E';
        ctx.beginPath();
        const xa = x0;
        const xb = x0 + third;
        const ya = -WALL_H + ((ROOF_TOP - -WALL_H) * (HW - Math.abs(xa))) / HW;
        const yb = -WALL_H + ((ROOF_TOP - -WALL_H) * (HW - Math.abs(xb))) / HW;
        ctx.moveTo(xa, -WALL_H + 0.5);
        ctx.lineTo(xa, Math.min(-WALL_H, ya));
        if (xa < 0 && xb > 0) ctx.lineTo(0, ROOF_TOP);
        ctx.lineTo(xb, Math.min(-WALL_H, yb));
        ctx.lineTo(xb, -WALL_H + 0.5);
        ctx.closePath();
        ctx.fill();
      }
    } else if (p.kind === 'roof') drawRoofSlab(ctx, p.side);
    else if (p.kind === 'icing') drawRoofIcing(ctx);
    else if (p.kind === 'window') drawCandyWindow(ctx, WINDOWS[p.side < 0 ? 0 : 1], igloo.lit);
    else if (p.kind === 'peppermint') drawPeppermint(ctx, t);
    else if (p.kind === 'chimney') drawChimney(ctx);
    else if (p.kind === 'cane') drawHouseCane(ctx, p.side);
    ctx.restore();
  }
  if (n >= RULES.iglooPieces) drawGingerLights(ctx, t, igloo.lit);
  ctx.restore();
  drawGingerDoor(ctx, igloo, t);
}

// Porta (peça 16): abertura escura, luz quando acesa, a porta e o batente (ou o
// contorno tracejado enquanto não está pronta). Também usada pela casa 3D
export function drawGingerDoor(ctx, igloo, t) {
  const n = igloo.count;
  const r = doorRect();
  if (n < RULES.iglooPieces) {
    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = 'rgba(150, 80, 60, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(r.x - 4, r.y - 4, r.w + 8, r.h + 4);
    ctx.restore();
    return;
  }
  const a = igloo.anim[RULES.iglooPieces - 1];
  ctx.save();
  ctx.globalAlpha = Math.min(1, a * 3);
  ctx.translate(0, -(1 - easeOutBack(a)) * 30);
  const in3d = !!doorArt.draw?.(ctx, 'ginger', 'inside', igloo, t);
  ctx.save();
  doorPath(ctx);
  if (!in3d) {
    const dg = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    dg.addColorStop(0, '#1A0C06');
    dg.addColorStop(1, '#3A1C0E');
    ctx.fillStyle = dg;
    ctx.fill();
  }
  if (igloo.lit && !(in3d && addLight(ctx, 'glow', { x: r.x + r.w / 2, y: r.y + r.h * 0.5, r: r.w, color: [255, 190, 120], a: 0.55 + Math.sin(t * 5) * 0.08 }))) {
    ctx.fillStyle = `rgba(255, 195, 125, ${in3d ? 0.16 + Math.sin(t * 5) * 0.16 : 0.5 + Math.sin(t * 5) * 0.08})`;
    ctx.fill();
  }
  ctx.restore();
  drawDoorLeaf(ctx, igloo.curtain, igloo, t);
  drawDoorFrame(ctx, igloo, t);
  ctx.restore();
}

// Desenhado POR CIMA do personagem enquanto ele entra
export function drawGingerDoorFront(ctx, igloo, t) {
  if (igloo.count < RULES.iglooPieces) return;
  const r = doorRect();
  ctx.save();
  if (igloo.shade > 0) {
    ctx.save();
    doorPath(ctx);
    ctx.clip();
    ctx.fillStyle = `rgba(20, 8, 4, ${0.45 * igloo.shade})`;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  }
  drawDoorLeaf(ctx, igloo.curtain, igloo, t);
  drawDoorFrame(ctx, igloo, t);
  ctx.restore();
}
