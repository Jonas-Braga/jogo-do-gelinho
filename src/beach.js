// Fase especial da praia (fase 20): areia com coqueiros e guarda-sol, mar
// azul-turquesa com ilhas no horizonte, tábuas de surfe (e boias, nos pedaços
// curtos) no lugar das placas, cabana de palha no lugar do iglu, gaivotas, siris e
// águas-vivas, peixinhos tropicais no lugar dos peixes e um caranguejo gigante no
// lugar do urso. Só o visual muda (e o ritmo, como em toda fase especial).
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

// Cores do mar (o renderer usa no lugar da água gelada)
export const SEA = {
  water: ['#43D6D2', '#139CB4', '#06506E'],
  ripple: [235, 255, 252],
  bank: 'rgba(120, 90, 40, 0.25)',
  halo: [255, 236, 120],  // brilho das pranchas "acesas"
  sand: '#F2DFB0',        // areia (encaixe das peças da cabana, pouso na costa)
  spray: '#D8F8F6',       // borrifo ao pousar numa prancha
  spark: '#FFF4B0',       // brilhos da fileira acesa
};

// ---------------------------------------------------------------- Fundo
// Mar aberto até o horizonte com ilhas, praia de areia e a beira molhada.
// O céu (com o sol) é o mesmo das fases normais, desenhado por baixo.
export function makeBeachBackground() {
  const h = WATER_TOP + 12;
  const { c, g } = offscreen(W, h);
  const rnd = seeded(41);
  const horizon = 150;

  // Mar até o horizonte
  let grd = g.createLinearGradient(0, horizon, 0, SHORE_TOP + 10);
  grd.addColorStop(0, '#2B8FB8');
  grd.addColorStop(1, '#48C9D0');
  g.fillStyle = grd;
  g.fillRect(0, horizon, W, SHORE_TOP + 20 - horizon);
  // Ilhas no horizonte com coqueirinhos
  for (const [x, w, hh] of [[700, 120, 16], [880, 60, 9], [180, 80, 11]]) {
    g.fillStyle = '#3E8C6A';
    g.beginPath();
    g.ellipse(x, horizon + 1, w / 2, hh, 0, Math.PI, TAU);
    g.fill();
    g.fillStyle = '#2E6E52';
    g.beginPath();
    g.ellipse(x + w * 0.15, horizon + 1, w * 0.3, hh * 0.7, 0, Math.PI, TAU);
    g.fill();
  }
  // Brilhos do sol no mar
  for (let i = 0; i < 90; i++) {
    g.fillStyle = `rgba(255, 255, 240, ${0.3 + rnd() * 0.5})`;
    const y = horizon + 4 + rnd() * (SHORE_TOP - horizon);
    g.fillRect(rnd() * W, y, 4 + rnd() * 10, 1);
  }
  // Ondinha quebrando antes da areia
  g.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  g.lineWidth = 2;
  g.beginPath();
  for (let x = 0; x <= W; x += 10) g.lineTo(x, SHORE_TOP - 2 + Math.sin(x * 0.04) * 2);
  g.stroke();

  // Areia
  grd = g.createLinearGradient(0, SHORE_TOP, 0, WATER_TOP);
  grd.addColorStop(0, '#FBEBC2');
  grd.addColorStop(0.6, '#F2DCA6');
  grd.addColorStop(1, '#E2C58A');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(0, WATER_TOP);
  for (let x = 0; x <= W; x += 20) g.lineTo(x, SHORE_TOP + Math.sin(x * 0.012) * 4 + Math.sin(x * 0.05) * 1.5);
  g.lineTo(W, WATER_TOP);
  g.fill();
  // Ondulações de vento na areia, grãos e conchinhas
  g.strokeStyle = 'rgba(190, 150, 90, 0.35)';
  g.lineWidth = 1.2;
  for (let i = 0; i < 30; i++) {
    const x = rnd() * W;
    const y = SHORE_TOP + 12 + rnd() * 50;
    const w = 20 + rnd() * 50;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + w / 2, y - 3, x + w, y);
    g.stroke();
  }
  for (let i = 0; i < 200; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(255, 255, 245, 0.8)' : 'rgba(170, 130, 70, 0.4)';
    g.fillRect(rnd() * W, SHORE_TOP + 6 + rnd() * 68, 1.2, 1.2);
  }
  for (let i = 0; i < 14; i++) {
    const x = rnd() * W;
    if (Math.abs(x - IGLOO.x) < 160) continue;
    const y = SHORE_TOP + 20 + rnd() * 44;
    g.fillStyle = ['#F7B7A3', '#FFFFFF', '#F4D08A'][i % 3];
    g.beginPath();
    g.ellipse(x, y, 3.2, 2.2, rnd(), 0, TAU);
    g.fill();
  }

  // Areia molhada e espuma na beira do mar
  const edgeTop = WATER_TOP - 14;
  grd = g.createLinearGradient(0, edgeTop, 0, WATER_TOP + 12);
  grd.addColorStop(0, '#D9B97A');
  grd.addColorStop(0.5, '#B8955A');
  grd.addColorStop(1, '#5FA7A8');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(0, edgeTop + 2);
  for (let x = 0; x <= W; x += 16) g.lineTo(x, edgeTop + Math.sin(x * 0.07) * 1.5);
  g.lineTo(W, WATER_TOP + 12);
  g.lineTo(0, WATER_TOP + 12);
  g.fill();
  g.fillStyle = 'rgba(255, 255, 255, 0.85)';
  for (let x = 0; x < W; x += 8 + rnd() * 10) {
    g.beginPath();
    g.arc(x, WATER_TOP + 6 + rnd() * 4, 1.5 + rnd() * 2.5, 0, TAU);
    g.fill();
  }

  return { canvas: c, w: W, h };
}

// ---------------------------------------------------------------- Enfeites
// Coqueiros, guarda-sol com cadeira e castelo de areia, à esquerda (longe da cabana)
export const PALMS = [
  { x: 52, base: 244, h: 150, lean: -0.18 },
  { x: 150, base: 238, h: 118, lean: 0.12 },
];
export const UMBRELLA = { x: 250, base: 246 };
export const PALM_LEAF = '#2F9E4A';

export function drawBeachDecor(ctx, t) {
  PALMS.forEach((p, k) => drawPalm(ctx, p, t, k));
  // Guarda-sol listrado
  const { x, base } = UMBRELLA;
  ctx.save();
  ctx.translate(x, base);
  ctx.fillStyle = 'rgba(150, 110, 50, 0.3)';
  ctx.beginPath();
  ctx.ellipse(-8, 2, 44, 6, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#E8E2D2';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-6, -78);
  ctx.stroke();
  ctx.save();
  ctx.translate(-6, -78);
  ctx.rotate(-0.12);
  const colors = ['#E5484D', '#FFFFFF', '#E5484D', '#FFFFFF', '#E5484D', '#FFFFFF'];
  for (let i = 0; i < 6; i++) {
    const a0 = Math.PI + (i * Math.PI) / 6;
    const a1 = a0 + Math.PI / 6;
    ctx.fillStyle = colors[i];
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(Math.cos(a0) * 46, Math.sin(a0) * 14 + 10);
    ctx.quadraticCurveTo(Math.cos((a0 + a1) / 2) * 50, 16, Math.cos(a1) * 46, Math.sin(a1) * 14 + 10);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // Cadeira de praia
  ctx.strokeStyle = '#8A6A3E';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-34, 0);
  ctx.lineTo(-20, -14);
  ctx.moveTo(-14, 0);
  ctx.lineTo(-28, -18);
  ctx.stroke();
  ctx.fillStyle = '#3FA9D9';
  ctx.beginPath();
  ctx.moveTo(-36, -14);
  ctx.lineTo(-18, -12);
  ctx.lineTo(-24, -32);
  ctx.lineTo(-38, -30);
  ctx.closePath();
  ctx.fill();
  // Castelo de areia com bandeirinha
  ctx.fillStyle = '#E8C98A';
  ctx.fillRect(18, -12, 22, 12);
  ctx.fillRect(22, -20, 6, 8);
  ctx.fillRect(32, -22, 6, 10);
  ctx.fillStyle = '#C9A866';
  ctx.fillRect(26, -6, 4, 6);
  ctx.strokeStyle = '#8A6A3E';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(35, -22);
  ctx.lineTo(35, -32);
  ctx.stroke();
  ctx.fillStyle = '#E5484D';
  ctx.beginPath();
  ctx.moveTo(35, -32);
  ctx.lineTo(42 + Math.sin(t * 6) * 1.5, -29);
  ctx.lineTo(35, -26);
  ctx.fill();
  ctx.restore();
}

function drawPalm(ctx, { x, base, h, lean }, t, k) {
  ctx.save();
  ctx.translate(x, base);
  ctx.fillStyle = 'rgba(150, 110, 50, 0.3)';
  ctx.beginPath();
  ctx.ellipse(10, 2, 30, 5, 0, 0, TAU);
  ctx.fill();
  // Tronco curvo em gomos
  const sway = Math.sin(t * 1.1 + k * 2) * 3;
  const tx = Math.sin(lean) * h + sway;
  const ty = -h;
  const cx = tx * 0.2;
  const cy = -h * 0.55;
  for (let i = 0; i < 12; i++) {
    const u = i / 12;
    const px = 2 * (1 - u) * u * cx + u * u * tx;
    const py = 2 * (1 - u) * u * cy + u * u * ty;
    ctx.fillStyle = i % 2 ? '#9C7342' : '#B88A52';
    ctx.beginPath();
    ctx.ellipse(px, py, 7 - u * 2, 7, 0, 0, TAU);
    ctx.fill();
  }
  // Cocos
  ctx.fillStyle = '#6B4A22';
  for (const [dx, dy] of [[-4, 4], [4, 5], [0, 9]]) {
    ctx.beginPath();
    ctx.arc(tx + dx, ty + dy, 4.5, 0, TAU);
    ctx.fill();
  }
  // Folhas arqueadas balançando
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.48 + Math.sin(t * 1.6 + i + k) * 0.06;
    const len = 52 + (i % 2) * 10;
    const ex = tx + Math.cos(a) * len;
    const ey = ty + Math.sin(a) * len * 0.6 + 26;
    const mx = tx + Math.cos(a) * len * 0.5;
    const my = ty + Math.sin(a) * len * 0.5 - 8;
    ctx.strokeStyle = i % 2 ? PALM_LEAF : '#3DB35A';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(mx, my, ex, ey);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(20, 80, 30, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(mx, my, ex, ey);
    ctx.stroke();
  }
  ctx.restore();
}

// Gaivotinhas planando ao longe no céu (sem estado: dependem só do tempo)
export function drawSkyGulls(ctx, t) {
  ctx.save();
  ctx.strokeStyle = 'rgba(40, 50, 70, 0.6)';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const x = ((t * (14 + i * 4) + i * 330) % (W + 80)) - 40;
    const y = 50 + i * 18 + Math.sin(t * 0.8 + i) * 6;
    const f = Math.sin(t * 5 + i * 2) * 2.5;
    const s = 5 + (i % 2) * 2;
    ctx.beginPath();
    ctx.moveTo(x - s, y - f);
    ctx.quadraticCurveTo(x - s / 2, y - s * 0.5 - f, x, y);
    ctx.quadraticCurveTo(x + s / 2, y - s * 0.5 - f, x + s, y - f);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- Pranchas e boias
// Tábua de surfe boiando (vista de lado, um pouco de cima). Os pés pisam em y = 0.
// Pedaços curtos (fase par) viram boias. Acesa: cores mais vivas e brilho do sol.
const BOARD_PAD = 12;
const BOARD_TOP = 22;
const BOARD_H = 62;
const BOARD_COLORS = [
  ['#FF8A3D', '#FFD45C'], ['#2FB5E8', '#FFFFFF'], ['#F25C8A', '#FFE08A'], ['#4CC77A', '#FFF3C2'],
];
// Nos pedaços curtos (fases pares), boias e pranchinhas (bodyboard) se alternam
export const isBuoy = (piece) => piece.w < 50 && (piece.k ?? 0) % 2 === 0;

export function boardSprite(piece, active) {
  const key = active ? 'boardOn' : 'boardOff';
  if (piece.sprites[key]) return piece.sprites[key];
  const w = piece.w;
  const { c, g } = offscreen(w + BOARD_PAD * 2, BOARD_H);
  g.translate(BOARD_PAD, BOARD_TOP);
  const rnd = seeded(piece.seed + 17);
  const [base, stripe] = BOARD_COLORS[Math.floor(rnd() * BOARD_COLORS.length)];

  // Sombra e reflexo na água
  g.fillStyle = 'rgba(4, 70, 90, 0.3)';
  g.beginPath();
  g.ellipse(w / 2, 14, w / 2 + 4, 5, 0, 0, TAU);
  g.fill();

  if (isBuoy(piece)) {
    // Boia redonda (anel) vista meio de lado
    const r = w / 2 + 4;
    g.save();
    g.translate(w / 2, 4);
    g.scale(1, 0.42);
    g.fillStyle = active ? '#FF6A5C' : '#C9372F';
    g.beginPath();
    g.arc(0, 0, r, 0, TAU);
    g.arc(0, 0, r * 0.45, 0, TAU, true);
    g.fill('evenodd');
    // Faixas brancas
    g.fillStyle = '#FFFFFF';
    for (const a of [0.4, 2.0, 3.6, 5.2]) {
      g.beginPath();
      g.moveTo(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45);
      g.arc(0, 0, r, a, a + 0.5);
      g.lineTo(Math.cos(a + 0.5) * r * 0.45, Math.sin(a + 0.5) * r * 0.45);
      g.arc(0, 0, r * 0.45, a + 0.5, a, true);
      g.fill();
    }
    g.fillStyle = 'rgba(0, 60, 80, 0.55)';
    g.beginPath();
    g.arc(0, 0, r * 0.42, 0, TAU);
    g.fill();
    g.restore();
    if (active) {
      g.fillStyle = 'rgba(255, 255, 255, 0.7)';
      g.fillRect(w / 2 - r * 0.6, -3, r * 0.5, 1.4);
    }
  } else {
    // Prancha: bico arredondado nas duas pontas, borda e quilha
    const top = -4;
    const thick = 9;
    const shape = () => {
      g.beginPath();
      g.moveTo(10, top);
      g.lineTo(w - 14, top);
      g.quadraticCurveTo(w + 6, top + 1, w + 2, top + thick / 2);
      g.quadraticCurveTo(w - 4, top + thick, w - 14, top + thick);
      g.lineTo(10, top + thick);
      g.quadraticCurveTo(-4, top + thick, -3, top + thick / 2);
      g.quadraticCurveTo(-2, top, 10, top);
      g.closePath();
    };
    const grd = g.createLinearGradient(0, top, 0, top + thick);
    grd.addColorStop(0, active ? '#FFFFFF' : '#F4F0E6');
    grd.addColorStop(0.35, base);
    grd.addColorStop(1, active ? base : '#7A6A5A');
    g.fillStyle = grd;
    shape();
    g.fill();
    g.save();
    shape();
    g.clip();
    // Faixa central e logotipo de onda
    g.fillStyle = stripe;
    g.fillRect(0, top + thick * 0.35, w, 2.2);
    g.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    g.lineWidth = 1.2;
    const mx = w * 0.62;
    g.beginPath();
    g.arc(mx, top + 4, 3, Math.PI, Math.PI * 2.2);
    g.stroke();
    if (!active) {
      g.fillStyle = 'rgba(60, 40, 20, 0.12)';
      g.fillRect(0, top, w, thick);
    }
    g.restore();
    // Quilha
    g.fillStyle = '#3A3A44';
    g.beginPath();
    g.moveTo(10, top + thick);
    g.lineTo(16, top + thick + 6);
    g.lineTo(20, top + thick);
    g.fill();
    // Brilho do sol no topo
    g.fillStyle = active ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.4)';
    g.fillRect(8, top + 1, w - 22, 1.3);
  }
  // Espuma em volta
  g.fillStyle = 'rgba(255, 255, 255, 0.55)';
  g.fillRect(-3, 10, w + 7, 1.4);

  const sprite = { canvas: c, ox: BOARD_PAD, oy: BOARD_TOP, w: w + BOARD_PAD * 2, h: BOARD_H };
  piece.sprites[key] = sprite;
  return sprite;
}

// ---------------------------------------------------------------- Bichos
// Gaivota planando baixo sobre a fileira
export function drawGull(ctx, c, y, t) {
  const flap = Math.sin(t * 9 + c.ph * 3);
  const by = y - 32 + Math.sin(t * 3 + c.ph) * 4;
  ctx.fillStyle = 'rgba(4, 70, 90, 0.22)';
  ctx.beginPath();
  ctx.ellipse(c.x, y + 16, 16, 3.5, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(c.x, by);
  ctx.scale(c.dir, 1);
  const wing = (s, shade) => {
    const tip = -2 - flap * 12;
    ctx.fillStyle = shade ? '#9AA6B0' : '#C5CED6';
    ctx.beginPath();
    ctx.moveTo(-2, -2);
    ctx.quadraticCurveTo(-8, tip - 6, -22, tip + s);
    ctx.lineTo(-6, 2);
    ctx.closePath();
    ctx.fill();
    // Ponta preta
    ctx.fillStyle = '#22262C';
    ctx.beginPath();
    ctx.moveTo(-17, tip + s - 2);
    ctx.lineTo(-23, tip + s);
    ctx.lineTo(-18, tip + s + 3);
    ctx.fill();
  };
  wing(-2, true);
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 6.5, -0.05, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-12, -1);
  ctx.lineTo(-20, -3);
  ctx.lineTo(-13, 3);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(13, -4, 5, 0, TAU);
  ctx.fill();
  // Bico amarelo com pintinha vermelha
  ctx.fillStyle = '#F6C23A';
  ctx.beginPath();
  ctx.moveTo(17, -5);
  ctx.lineTo(25, -3);
  ctx.lineTo(17, -1.5);
  ctx.fill();
  ctx.fillStyle = '#D9302A';
  ctx.fillRect(21, -3, 1.6, 1.4);
  ctx.fillStyle = '#1D2A33';
  ctx.beginPath();
  ctx.arc(14.5, -5.5, 1.1, 0, TAU);
  ctx.fill();
  wing(2, false);
  ctx.restore();
}

// Siri azul andando de lado sobre a prancha, pinças erguidas
export const SIRI_BLUE = '#3C7FD0';
export function drawSiri(ctx, c, y, t) {
  const by = y - 2;
  const walk = Math.sin(t * 18 + c.ph);
  ctx.fillStyle = 'rgba(4, 70, 90, 0.25)';
  ctx.beginPath();
  ctx.ellipse(c.x, y + 2, 18, 3, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(c.x, by);
  ctx.scale(c.dir, 1);
  // Patinhas
  ctx.strokeStyle = '#2C5E9E';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const k = (i % 2 ? walk : -walk) * 2.5;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * (6 + i * 3), -7);
      ctx.lineTo(s * (12 + i * 4) + k, 0);
      ctx.stroke();
    }
  }
  // Remos de trás (patas de nadar do siri)
  ctx.fillStyle = '#5A9BE0';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * 19, -4, 4, 2, s * 0.4, 0, TAU);
    ctx.fill();
  }
  // Carapaça larga com pontas nas laterais
  const g = ctx.createLinearGradient(0, -18, 0, -4);
  g.addColorStop(0, '#6FA8EE');
  g.addColorStop(1, SIRI_BLUE);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-17, -10);
  ctx.quadraticCurveTo(-10, -20, 0, -19);
  ctx.quadraticCurveTo(10, -20, 17, -10);
  ctx.lineTo(13, -6);
  ctx.quadraticCurveTo(0, -2, -13, -6);
  ctx.closePath();
  ctx.fill();
  // Pinças (vermelhas na ponta) abrindo e fechando
  const snap = Math.abs(Math.sin(t * 7 + c.ph)) * 0.4;
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(s * 9 + 6, -16);
    ctx.fillStyle = '#4A86D6';
    ctx.beginPath();
    ctx.ellipse(s * 2, -5, 4, 3, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#E2543A';
    ctx.beginPath();
    ctx.moveTo(s * 4, -6);
    ctx.lineTo(s * 9, -10 - snap * 6);
    ctx.lineTo(s * 6, -5);
    ctx.lineTo(s * 9, -2 + snap * 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Olhinhos
  for (const ex of [3, 9]) {
    ctx.strokeStyle = '#2C5E9E';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(ex, -18);
    ctx.lineTo(ex, -22);
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(ex, -23, 1.8, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// Água-viva rosa pulsando na superfície, com tentáculos ondulando
export const JELLY_PINK = '#F48FC8';
export function drawJellyfish(ctx, c, y, t) {
  const pulse = Math.sin(t * 4 + c.ph);
  const by = y + 2 - Math.max(0, pulse) * 5;
  ctx.save();
  ctx.translate(c.x, by);
  // Tentáculos
  ctx.strokeStyle = 'rgba(244, 143, 200, 0.7)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 5; i++) {
    const x0 = -10 + i * 5;
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    for (let k = 1; k <= 4; k++) ctx.lineTo(x0 + Math.sin(t * 5 + i + k) * 2.5, k * 4);
    ctx.stroke();
  }
  // Sino translúcido
  const w = 16 + pulse * 2;
  const g = ctx.createRadialGradient(-3, -8, 1, 0, -4, 18);
  g.addColorStop(0, 'rgba(255, 220, 240, 0.95)');
  g.addColorStop(1, 'rgba(244, 143, 200, 0.75)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-w, 0);
  ctx.quadraticCurveTo(-w, -16 + pulse * 2, 0, -16 + pulse * 2);
  ctx.quadraticCurveTo(w, -16 + pulse * 2, w, 0);
  ctx.quadraticCurveTo(0, 4, -w, 0);
  ctx.fill();
  ctx.strokeStyle = JELLY_PINK;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // Carinha e pintas
  ctx.fillStyle = '#7A1E5A';
  ctx.beginPath();
  ctx.arc(-4, -6, 1.4, 0, TAU);
  ctx.arc(4, -6, 1.4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.beginPath();
  ctx.ellipse(-6, -11, 3, 1.6, -0.4, 0, TAU);
  ctx.fill();
  ctx.restore();
  // Anel na água
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(c.x, y + 9, 18, 3, 0, 0, TAU);
  ctx.stroke();
}

// Peixinho tropical (vale os pontos do peixe): amarelo com listras azuis
export const TROPICAL_YELLOW = '#FFD23F';
export function drawTropicalFish(ctx, c, y, t) {
  const hop = Math.max(0, Math.sin(t * 3 + c.ph)) * 12;
  ctx.save();
  ctx.beginPath();
  ctx.rect(c.x - 40, y - 80, 80, 89);
  ctx.clip();
  ctx.translate(c.x, y + 4 - hop);
  ctx.scale(c.dir, 1);
  ctx.rotate(hop > 2 ? -0.25 : 0);
  // Cauda
  ctx.fillStyle = '#2B6FD6';
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(-19, -7);
  ctx.lineTo(-19, 7);
  ctx.closePath();
  ctx.fill();
  // Corpo alto
  ctx.fillStyle = TROPICAL_YELLOW;
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 9, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 9, 0, 0, TAU);
  ctx.clip();
  ctx.fillStyle = '#2B6FD6';
  ctx.fillRect(-5, -10, 3.5, 20);
  ctx.fillRect(3, -10, 3, 20);
  ctx.restore();
  // Barbatana e olho
  ctx.fillStyle = '#FF8A3D';
  ctx.beginPath();
  ctx.moveTo(-4, -8);
  ctx.lineTo(2, -14);
  ctx.lineTo(5, -8);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(7, -2, 2.6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(7.6, -2, 1.3, 0, TAU);
  ctx.fill();
  ctx.restore();
  if (hop < 3) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(c.x, y + 9, 14, 3, 0, 0, TAU);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- Caranguejo gigante
// No lugar do urso: carapaça larga vermelho-alaranjada, oito patas, olhos na
// ponta de hastes e duas pinças enormes que estalam quando ele persegue.
export const GIANT_CRAB = {
  shell: ['#FF8A5C', '#E2532E', '#9E2E18'], leg: '#C8452A', legBack: '#9E3420', claw: '#F06A40', tip: '#FFE2C8',
};

export function drawGiantCrab(ctx, b, t) {
  const C = GIANT_CRAB;
  const walk = b.walk * 4;
  const br = Math.sin(t * 2) * 1;
  ctx.fillStyle = 'rgba(150, 110, 50, 0.32)';
  ctx.beginPath();
  ctx.ellipse(b.x, b.y + 3, 62, 7, 0, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.scale(b.dir, 1);

  // Patas: quatro de cada lado, alternando
  const legs = (back) => {
    ctx.strokeStyle = back ? C.legBack : C.leg;
    ctx.lineWidth = back ? 5 : 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < 4; i++) {
      const ph = Math.sin(walk + i * 1.4 + (back ? 0.7 : 0));
      const s = back ? 1 : -1; // patas de trás à direita, da frente à esquerda (profundidade)
      const hipX = -26 + i * 14 + (back ? 6 : 0);
      ctx.beginPath();
      ctx.moveTo(hipX, -30);
      ctx.lineTo(hipX + s * 6 + ph * 3, -42 + Math.max(0, ph) * -4);
      ctx.lineTo(hipX + s * 14 + ph * 5, -1 - Math.max(0, ph) * 5);
      ctx.stroke();
    }
  };
  legs(true);

  // Carapaça
  const g = ctx.createLinearGradient(0, -70, 0, -22);
  g.addColorStop(0, C.shell[0]);
  g.addColorStop(0.55, C.shell[1]);
  g.addColorStop(1, C.shell[2]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-48, -36);
  ctx.quadraticCurveTo(-46, -68 + br, 0, -70 + br);
  ctx.quadraticCurveTo(46, -68 + br, 50, -36);
  ctx.quadraticCurveTo(0, -18, -48, -36);
  ctx.closePath();
  ctx.fill();
  // Pintas e brilho
  ctx.fillStyle = 'rgba(255, 220, 180, 0.35)';
  for (const [sx, sy, r] of [[-22, -54, 4], [-6, -60, 3], [14, -56, 4.5], [30, -48, 3]]) {
    ctx.beginPath();
    ctx.arc(sx, sy + br, r, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255, 240, 220, 0.55)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-34, -56 + br);
  ctx.quadraticCurveTo(-10, -66 + br, 12, -64 + br);
  ctx.stroke();

  // Olhos nas hastes (piscando de vez em quando)
  for (const ex of [18, 30]) {
    ctx.strokeStyle = C.shell[1];
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ex, -64 + br);
    ctx.lineTo(ex + 2, -80 + br);
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(ex + 2, -82 + br, 5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#111';
    const blink = Math.sin(t * 0.8) > 0.97;
    if (blink) ctx.fillRect(ex - 2, -82.5 + br, 8, 1.5);
    else {
      ctx.beginPath();
      ctx.arc(ex + 3.5, -82 + br, 2.2, 0, TAU);
      ctx.fill();
    }
  }
  if (b.chasing) {
    // Sobrancelhas bravas e boca aberta
    ctx.strokeStyle = '#5A1A0E';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(15, -90 + br);
    ctx.lineTo(22, -87 + br);
    ctx.moveTo(35, -87 + br);
    ctx.lineTo(41, -90 + br);
    ctx.stroke();
    ctx.fillStyle = '#5A1A0E';
    ctx.beginPath();
    ctx.ellipse(30, -40, 7, 3 + Math.abs(Math.sin(t * 12)) * 2, 0, 0, TAU);
    ctx.fill();
  } else {
    ctx.strokeStyle = '#7A2412';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(30, -44, 5, 0.3, Math.PI - 0.3);
    ctx.stroke();
  }

  legs(false);

  // Pinças gigantes à frente
  const snap = b.chasing ? Math.abs(Math.sin(t * 10)) : 0.25 + Math.sin(t * 2) * 0.1;
  for (const [cx, cy, sc] of [[44, -50, 0.85], [58, -38, 1]]) {
    ctx.save();
    ctx.translate(cx, cy + br);
    ctx.scale(sc, sc);
    // Braço
    ctx.strokeStyle = C.leg;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-14, 10);
    ctx.lineTo(0, 0);
    ctx.stroke();
    // Mão
    ctx.fillStyle = C.claw;
    ctx.beginPath();
    ctx.ellipse(8, -4, 13, 10, -0.4, 0, TAU);
    ctx.fill();
    // Dedo de cima (abre) e de baixo (fixo), com pontas claras
    ctx.save();
    ctx.translate(16, -10);
    ctx.rotate(-0.3 - snap * 0.6);
    ctx.fillStyle = C.claw;
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.quadraticCurveTo(16, -10, 22, 0);
    ctx.quadraticCurveTo(12, -1, 0, 4);
    ctx.fill();
    ctx.fillStyle = C.tip;
    ctx.beginPath();
    ctx.arc(21, -1, 2.2, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = C.claw;
    ctx.beginPath();
    ctx.moveTo(16, -2);
    ctx.quadraticCurveTo(28, 0, 30, 6);
    ctx.quadraticCurveTo(22, 4, 14, 4);
    ctx.fill();
    ctx.fillStyle = C.tip;
    ctx.beginPath();
    ctx.arc(29, 5, 2.2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- Cabana de palha
// Mesmo lugar e mesma porta do iglu (o personagem entra igualzinho), 16 peças:
// 6 painéis de bambu, 5 camadas de palha do telhado, janela, 2 tochas,
// o arremate do topo (de onde sai a fumaça) e por último a porta.
const HW = 88;          // meia largura das paredes
const WALL_H = 70;
const ROOF = { eave: 124, base: -62, peak: -150 };
const TORCH_X = 134;

export const HUT_DOOR = { x: IGLOO.x, bottom: SHORE_Y + 1, w: IGLOO.doorRx, h: IGLOO.doorH };

const third = (HW * 2) / 3;
const band = (ROOF.base - ROOF.peak) / 5;
export const HUT_PIECES = [
  ...Array.from({ length: 6 }, (_, i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    return { kind: 'wall', row, col, cx: -HW + third * (col + 0.5), cy: -WALL_H / 4 - row * (WALL_H / 2) };
  }),
  ...Array.from({ length: 5 }, (_, i) => ({ kind: 'thatch', i, cx: 0, cy: ROOF.base - band * (i + 0.5) })),
  { kind: 'window', cx: -56, cy: -42 },
  { kind: 'torch', side: -1, cx: -TORCH_X, cy: -50 },
  { kind: 'torch', side: 1, cx: TORCH_X, cy: -50 },
  { kind: 'peak', cx: 0, cy: ROOF.peak - 6 },
  { kind: 'door', cx: 0, cy: -IGLOO.doorH / 2 },
];

// Topo da cabana (de onde sai a fumaça)
export const HUT_VENT = { x: IGLOO.x, y: IGLOO.baseY + ROOF.peak - 14 };

const easeOutBack = (k) => 1 + 2.9 * (k - 1) ** 3 + 1.9 * (k - 1) ** 2;

// Meia largura do telhado numa altura y
const roofHalf = (y) => ROOF.eave * (y - ROOF.peak) / (ROOF.base - ROOF.peak);

function drawWall(ctx, row, col) {
  const x0 = -HW + third * col;
  const y1 = -row * (WALL_H / 2);
  const y0 = y1 - WALL_H / 2;
  // Bambus verticais com nós
  const n = 6;
  const cw = third / n;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * cw;
    const g = ctx.createLinearGradient(x, 0, x + cw, 0);
    g.addColorStop(0, '#E8C77E');
    g.addColorStop(0.5, '#D2A75C');
    g.addColorStop(1, '#A8803E');
    ctx.fillStyle = g;
    ctx.fillRect(x + 0.4, y0, cw - 0.8, y1 - y0);
    ctx.fillStyle = 'rgba(110, 80, 30, 0.6)';
    ctx.fillRect(x + 0.4, y0 + ((i * 7 + row * 11) % 14) + 6, cw - 0.8, 1.6);
  }
  // Amarração de cipó
  ctx.strokeStyle = '#6B4A22';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, y0 + 6);
  ctx.lineTo(x0 + third, y0 + 6);
  ctx.stroke();
}

function drawThatch(ctx, i, t) {
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
  g.addColorStop(0, '#E2C068');
  g.addColorStop(1, '#B98E3C');
  ctx.fillStyle = g;
  ctx.fillRect(-ROOF.eave, yt - 0.5, ROOF.eave * 2, band + 1);
  // Fios de palha
  ctx.strokeStyle = 'rgba(120, 85, 30, 0.45)';
  ctx.lineWidth = 1;
  const hw = roofHalf(yb);
  ctx.beginPath();
  for (let x = -hw; x < hw; x += 5) {
    ctx.moveTo(x, yt + 2);
    ctx.lineTo(x + 1.5, yb);
  }
  ctx.stroke();
  ctx.restore();
  // Franja da camada pendurada para fora, balançando com a brisa
  const hw2 = roofHalf(yb);
  ctx.fillStyle = '#C99E48';
  ctx.beginPath();
  ctx.moveTo(-hw2, yb - 2);
  for (let x = -hw2; x <= hw2; x += 6) {
    ctx.lineTo(x + 3, yb + 5 + Math.sin(t * 2 + x * 0.3 + i) * 1);
    ctx.lineTo(x + 6, yb - 1);
  }
  ctx.closePath();
  ctx.fill();
}

function drawWindow(ctx, lit, t) {
  const x = -72;
  const y = -54;
  const w = 30;
  const h = 24;
  ctx.fillStyle = lit ? `rgba(255, 196, 110, ${0.85 + Math.sin(t * 5) * 0.08})` : '#3A2C1C';
  ctx.fillRect(x, y, w, h);
  // Moldura de bambu e cortininha
  ctx.fillStyle = '#8A6A30';
  ctx.fillRect(x - 3, y - 3, w + 6, 4);
  ctx.fillRect(x - 3, y + h - 1, w + 6, 4);
  ctx.fillRect(x - 3, y, 3, h);
  ctx.fillRect(x + w, y, 3, h);
  ctx.fillStyle = '#E5484D';
  ctx.beginPath();
  ctx.moveTo(x, y + 1);
  ctx.lineTo(x + 9, y + 1);
  ctx.quadraticCurveTo(x + 4, y + 10, x + 2, y + h - 2);
  ctx.lineTo(x, y + h - 2);
  ctx.fill();
}

export const TORCH_FLAME = '#FFB23F';
function drawTorch(ctx, side, t) {
  const x = side * TORCH_X;
  ctx.fillStyle = '#9C7342';
  ctx.fillRect(x - 2.5, -64, 5, 64);
  ctx.fillStyle = '#6B4A22';
  ctx.fillRect(x - 5, -70, 10, 8);
  // Chama
  const f = Math.sin(t * 13 + side) * 2;
  const glow = ctx.createRadialGradient(x, -78, 2, x, -78, 22);
  glow.addColorStop(0, 'rgba(255, 190, 80, 0.5)');
  glow.addColorStop(1, 'rgba(255, 190, 80, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 22, -100, 44, 44);
  ctx.fillStyle = TORCH_FLAME;
  ctx.beginPath();
  ctx.moveTo(x - 5, -70);
  ctx.quadraticCurveTo(x - 6, -80, x + f, -90);
  ctx.quadraticCurveTo(x + 6, -80, x + 5, -70);
  ctx.fill();
  ctx.fillStyle = '#FFF0A0';
  ctx.beginPath();
  ctx.moveTo(x - 2, -70);
  ctx.quadraticCurveTo(x - 2, -76, x + f * 0.5, -82);
  ctx.quadraticCurveTo(x + 2, -76, x + 2, -70);
  ctx.fill();
}

function drawPeak(ctx) {
  // Feixe de palha amarrado no topo
  ctx.fillStyle = '#C99E48';
  ctx.beginPath();
  ctx.moveTo(-10, ROOF.peak + 6);
  ctx.lineTo(0, ROOF.peak - 14);
  ctx.lineTo(10, ROOF.peak + 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#6B4A22';
  ctx.fillRect(-6, ROOF.peak - 2, 12, 3);
}

function doorRect() {
  const d = HUT_DOOR;
  return { x: d.x - d.w, y: d.bottom - d.h, w: d.w * 2, h: d.h };
}

function drawDoorFrame(ctx) {
  const r = doorRect();
  ctx.fillStyle = '#8A6A30';
  ctx.fillRect(r.x - 5, r.y - 6, 5, r.h + 6);
  ctx.fillRect(r.x + r.w, r.y - 6, 5, r.h + 6);
  ctx.fillRect(r.x - 8, r.y - 9, r.w + 16, 5);
  ctx.fillStyle = 'rgba(110, 80, 30, 0.7)';
  for (let y = r.y; y < r.y + r.h; y += 12) {
    ctx.fillRect(r.x - 5, y, 5, 1.4);
    ctx.fillRect(r.x + r.w, y, 5, 1.4);
  }
}

// Cortina de folhas de coqueiro que desce e fecha a porta: k = 0 aberta, 1 fechada
function drawLeafCurtain(ctx, k, t) {
  if (k <= 0) return;
  const r = doorRect();
  const h = r.h * k;
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  const sway = k < 1 ? Math.sin(t * 14) * 2 : Math.sin(t * 2) * 0.6;
  for (let i = 0; i < 7; i++) {
    const x = r.x + 2 + i * (r.w - 4) / 6;
    ctx.strokeStyle = i % 2 ? '#2F9E4A' : '#3DB35A';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, r.y);
    ctx.quadraticCurveTo(x + sway, r.y + h / 2, x + sway * (i % 2 ? 1 : -1), r.y + h);
    ctx.stroke();
  }
  ctx.restore();
}

// Desenha a cabana com as peças já construídas (igloo = estado da construção)
export function drawHut(ctx, igloo, t) {
  const n = igloo.count;
  ctx.save();
  ctx.translate(IGLOO.x, IGLOO.baseY);
  ctx.fillStyle = 'rgba(150, 110, 50, 0.3)';
  ctx.beginPath();
  ctx.ellipse(6, 3, HW + 30, 9, 0, 0, TAU);
  ctx.fill();
  if (n < RULES.iglooPieces) {
    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = 'rgba(120, 85, 30, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-HW, -WALL_H, HW * 2, WALL_H);
    ctx.beginPath();
    ctx.moveTo(-ROOF.eave, ROOF.base);
    ctx.lineTo(0, ROOF.peak);
    ctx.lineTo(ROOF.eave, ROOF.base);
    ctx.stroke();
    ctx.restore();
  }
  // Ordem de desenho: tochas e paredes, janela, telhado de baixo para cima, arremate
  const order = [12, 13, 0, 1, 2, 3, 4, 5, 11, 6, 7, 8, 9, 10, 14];
  for (const i of order) {
    if (i >= n) continue;
    const a = igloo.anim[i];
    ctx.save();
    ctx.globalAlpha = Math.min(1, a * 3);
    ctx.translate(0, -(1 - easeOutBack(a)) * 46);
    const p = HUT_PIECES[i];
    if (p.kind === 'wall') drawWall(ctx, p.row, p.col);
    else if (p.kind === 'thatch') drawThatch(ctx, p.i, t);
    else if (p.kind === 'window') drawWindow(ctx, igloo.lit, t);
    else if (p.kind === 'torch') drawTorch(ctx, p.side, t);
    else if (p.kind === 'peak') drawPeak(ctx);
    ctx.restore();
  }
  ctx.restore();

  // Porta (peça 16): abertura escura, luz quando acesa, cortina e batente
  const r = doorRect();
  if (n < RULES.iglooPieces) {
    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = 'rgba(120, 85, 30, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(r.x - 5, r.y - 9, r.w + 10, r.h + 9);
    ctx.restore();
    return;
  }
  const a = igloo.anim[RULES.iglooPieces - 1];
  ctx.save();
  ctx.globalAlpha = Math.min(1, a * 3);
  ctx.translate(0, -(1 - easeOutBack(a)) * 30);
  const dg = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  dg.addColorStop(0, '#2A1E10');
  dg.addColorStop(1, '#4A3820');
  ctx.fillStyle = dg;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  if (igloo.lit) {
    ctx.fillStyle = `rgba(255, 200, 120, ${0.55 + Math.sin(t * 5) * 0.08})`;
    ctx.fillRect(r.x + 2, r.y + 2, r.w - 4, r.h - 2);
  }
  drawLeafCurtain(ctx, igloo.curtain, t);
  drawDoorFrame(ctx);
  ctx.restore();
}

// Desenhado POR CIMA do personagem enquanto ele entra
export function drawHutDoorFront(ctx, igloo, t) {
  if (igloo.count < RULES.iglooPieces) return;
  const r = doorRect();
  ctx.save();
  if (igloo.shade > 0) {
    ctx.fillStyle = `rgba(30, 20, 8, ${0.4 * igloo.shade})`;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  drawLeafCurtain(ctx, igloo.curtain, t);
  drawDoorFrame(ctx);
  ctx.restore();
}
