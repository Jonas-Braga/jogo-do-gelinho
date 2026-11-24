// Fase especial dos Piratas (fase 35): enseada ao entardecer com o mar até o horizonte,
// a ilha da caveira e um galeão ancorado ao longe, praia de areia com baú do tesouro,
// canhão e âncora; barris boiando no lugar das placas (acesos = aros dourados),
// forte pirata de pedra no lugar do iglu (porta de madeira reforçada), papagaios,
// polvos e tubarões no lugar dos bichos, garrafas com mensagem no lugar dos peixes,
// o personagem de pirata (chapéu de três pontas e tapa-olho) e um crocodilo pirata
// (bandana e tapa-olho) no lugar do urso. Só o visual muda (e o ritmo, como toda especial).
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

// Cores do mar da enseada (o renderer usa no lugar da água gelada)
export const COVE = {
  water: ['#2FB0BE', '#13718C', '#062F48'],
  ripple: [225, 250, 250],
  bank: 'rgba(60, 40, 20, 0.3)',
  halo: [255, 210, 80],   // brilho dourado dos barris acesos
  sand: '#EAD3A0',        // areia (pouso na costa, encaixe das pedras do forte)
  chip: '#9A6A3A',        // lasquinhas de madeira ao pousar num barril
  spark: '#FFE27A',       // brilhos da fileira acesa (moedinhas)
};
export const GOLD = '#FFC83A';
export const BARREL_WOOD = '#9A6234';

// ---------------------------------------------------------------- Fundo
// Mar até o horizonte com a ilha da caveira e o galeão ancorado, praia de areia com
// pedrinhas e conchas, e a beira de pedras molhadas descendo para a água.
// O céu (com o sol) é o mesmo das fases normais, desenhado por baixo.
export const HORIZON = 150;
export const SKULL_ISLE = { x: 760, w: 170, h: 30 };
export const GALLEON = { x: 360, y: HORIZON + 6, s: 1 };

export function makePirateBackground() {
  const h = WATER_TOP + 12;
  const { c, g } = offscreen(W, h);
  const rnd = seeded(53);

  // Mar até o horizonte
  let grd = g.createLinearGradient(0, HORIZON, 0, SHORE_TOP + 10);
  grd.addColorStop(0, '#2A7FA6');
  grd.addColorStop(1, '#3BB4C2');
  g.fillStyle = grd;
  g.fillRect(0, HORIZON, W, SHORE_TOP + 20 - HORIZON);
  // Ilha da caveira: rochedo com a cara de caveira e coqueirinhos
  const { x, w, h: ih } = SKULL_ISLE;
  g.fillStyle = '#6E6A60';
  g.beginPath();
  g.moveTo(x - w / 2, HORIZON + 2);
  g.quadraticCurveTo(x - w * 0.3, HORIZON - ih * 1.2, x, HORIZON - ih * 1.3);
  g.quadraticCurveTo(x + w * 0.3, HORIZON - ih * 1.2, x + w / 2, HORIZON + 2);
  g.fill();
  g.fillStyle = '#2A2622';
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(x + s * 13, HORIZON - ih * 0.75, 8, 6, 0, 0, TAU);
    g.fill();
  }
  g.beginPath();
  g.moveTo(x - 4, HORIZON - ih * 0.45);
  g.lineTo(x + 4, HORIZON - ih * 0.45);
  g.lineTo(x, HORIZON - ih * 0.62);
  g.fill();
  g.fillStyle = '#3E8C5A';
  g.beginPath();
  g.ellipse(x + w * 0.42, HORIZON, 34, 8, 0, Math.PI, TAU);
  g.fill();
  // Galeão ancorado: casco escuro, três mastros e velas recolhidas
  const gx = GALLEON.x;
  const gy = GALLEON.y;
  g.fillStyle = '#4A2E1C';
  g.beginPath();
  g.moveTo(gx - 46, gy - 12);
  g.lineTo(gx + 40, gy - 12);
  g.lineTo(gx + 52, gy - 20);
  g.lineTo(gx + 34, gy);
  g.lineTo(gx - 36, gy);
  g.lineTo(gx - 50, gy - 18);
  g.closePath();
  g.fill();
  g.strokeStyle = '#2A1A10';
  g.lineWidth = 1.6;
  for (const [mx, mh] of [[-24, 46], [4, 58], [30, 40]]) {
    g.beginPath();
    g.moveTo(gx + mx, gy - 12);
    g.lineTo(gx + mx, gy - 12 - mh);
    g.stroke();
    g.fillStyle = '#E8DCC0';
    g.fillRect(gx + mx - 10, gy - 12 - mh * 0.8, 20, mh * 0.35);
  }
  g.fillStyle = '#1A1410';
  g.fillRect(gx + 2, gy - 72, 12, 7);

  // Praia de areia
  grd = g.createLinearGradient(0, SHORE_TOP, 0, WATER_TOP);
  grd.addColorStop(0, '#F2DCA8');
  grd.addColorStop(1, '#D8B878');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(0, WATER_TOP);
  for (let xx = 0; xx <= W; xx += 20) g.lineTo(xx, SHORE_TOP + Math.sin(xx * 0.012) * 3);
  g.lineTo(W, WATER_TOP);
  g.fill();
  // Espuma da onda na beira de trás
  g.fillStyle = 'rgba(255, 255, 255, 0.8)';
  for (let xx = 0; xx < W; xx += 6 + rnd() * 8) {
    g.beginPath();
    g.arc(xx, SHORE_TOP + 1 + rnd() * 2, 1.2 + rnd() * 1.6, 0, TAU);
    g.fill();
  }
  // Pedrinhas e conchas
  for (let i = 0; i < 120; i++) {
    const px = rnd() * W;
    const py = SHORE_TOP + 10 + rnd() * 60;
    g.fillStyle = ['#B8986A', '#F7D8C0', '#8A7A66'][i % 3];
    g.beginPath();
    g.ellipse(px, py, 1.4 + rnd() * 2, 1 + rnd(), 0, 0, TAU);
    g.fill();
  }

  // Beira de pedras molhadas descendo para a água
  const edgeTop = WATER_TOP - 12;
  grd = g.createLinearGradient(0, edgeTop, 0, WATER_TOP + 12);
  grd.addColorStop(0, '#6A5E50');
  grd.addColorStop(1, '#2A2620');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(0, edgeTop + 2);
  for (let xx = 0; xx <= W; xx += 14) g.lineTo(xx, edgeTop + Math.sin(xx * 0.13) * 2.4);
  g.lineTo(W, WATER_TOP + 12);
  g.lineTo(0, WATER_TOP + 12);
  g.fill();
  g.fillStyle = 'rgba(80, 140, 70, 0.5)';
  for (let i = 0; i < 40; i++) g.fillRect(rnd() * W, edgeTop + 4 + rnd() * 10, 4 + rnd() * 6, 1.4);

  return { canvas: c, w: W, h };
}

// ---------------------------------------------------------------- Enfeites
// Baú do tesouro aberto cheio de moedas, canhão com a pilha de balas e uma âncora
// fincada na areia (tudo longe do forte).
export const CHEST = { x: 250, y: 248 };
export const CANNON = { x: 470, y: 244 };
export const ANCHOR = { x: 70, y: 246 };
// Gancho do visual 3D (src/model3d.js): baú, canhão e âncora em 3D
export const pirateArt = { on: false, chest: null, cannon: null, anchor: null };

export function drawPirateDecor(ctx, t) {
  drawAnchor(ctx);
  drawCannon(ctx);
  drawChest(ctx, t);
}

function shadow(ctx, x, y, rx) {
  ctx.fillStyle = 'rgba(60, 40, 10, 0.3)';
  ctx.beginPath();
  ctx.ellipse(x + 3, y + 1, rx, 5, 0, 0, TAU);
  ctx.fill();
}

function drawChest(ctx, t) {
  const { x, y } = CHEST;
  ctx.save();
  ctx.translate(x, y);
  shadow(ctx, 0, 0, 30);
  if (pirateArt.on && pirateArt.chest?.(ctx, t)) {
    ctx.restore();
    return;
  }
  // Caixa de madeira com cantoneiras de ferro
  ctx.fillStyle = '#7A4A26';
  ctx.fillRect(-24, -26, 48, 26);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  for (let i = 1; i < 4; i++) ctx.fillRect(-24, -26 + i * 6.5, 48, 1);
  ctx.fillStyle = '#3A3028';
  for (const sx of [-24, 20]) ctx.fillRect(sx, -26, 4, 26);
  // Moedas transbordando e a tampa aberta para trás
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.ellipse(0, -27, 23, 7, 0, Math.PI, TAU);
  ctx.fill();
  ctx.fillStyle = '#5A3418';
  ctx.beginPath();
  ctx.moveTo(-24, -27);
  ctx.quadraticCurveTo(0, -46, 24, -27);
  ctx.lineTo(24, -31);
  ctx.quadraticCurveTo(0, -52, -24, -31);
  ctx.fill();
  ctx.fillStyle = '#D8A030';
  ctx.fillRect(-3, -14, 6, 7);
  // Brilho das moedas
  const k = 0.5 + 0.5 * Math.sin(t * 3);
  ctx.fillStyle = `rgba(255, 250, 200, ${0.4 + k * 0.5})`;
  ctx.fillRect(-8 + k * 10, -33, 2, 2);
  ctx.restore();
}

function drawCannon(ctx) {
  const { x, y } = CANNON;
  ctx.save();
  ctx.translate(x, y);
  shadow(ctx, 0, 0, 34);
  if (pirateArt.on && pirateArt.cannon?.(ctx)) {
    ctx.restore();
    return;
  }
  // Carreta de madeira, rodas e o cano de ferro apontando para o mar
  ctx.fillStyle = '#6A4426';
  ctx.fillRect(-22, -14, 34, 9);
  ctx.fillStyle = '#2A2420';
  ctx.save();
  ctx.translate(-2, -18);
  ctx.rotate(-0.18);
  ctx.beginPath();
  ctx.roundRect(-22, -6, 46, 12, 5);
  ctx.fill();
  ctx.fillRect(22, -7.5, 5, 15);
  ctx.restore();
  ctx.fillStyle = '#4A3020';
  for (const wx of [-14, 6]) {
    ctx.beginPath();
    ctx.arc(wx, -5, 6, 0, TAU);
    ctx.fill();
  }
  // Pilha de balas
  ctx.fillStyle = '#1E1A18';
  for (const [bx, by] of [[22, -4], [30, -4], [26, -10]]) {
    ctx.beginPath();
    ctx.arc(bx, by, 4, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawAnchor(ctx) {
  const { x, y } = ANCHOR;
  ctx.save();
  ctx.translate(x, y);
  shadow(ctx, 0, 0, 22);
  if (pirateArt.on && pirateArt.anchor?.(ctx)) {
    ctx.restore();
    return;
  }
  ctx.rotate(0.22);
  ctx.strokeStyle = '#3A3A40';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.lineTo(0, -58);
  ctx.moveTo(-12, -50);
  ctx.lineTo(12, -50);
  ctx.moveTo(-18, -12);
  ctx.quadraticCurveTo(0, 4, 18, -12);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, -63, 5, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- Barris no rio
// Barris de madeira deitados boiando, um atrás do outro, topo onde se pisa em y = 0.
// Acesos: aros dourados e um brilho de moedas. Funciona com pedaços curtos.
const BARREL_PAD = 12;
const BARREL_TOP = 26;
const BARREL_H = 62;
export const BARREL = { PAD: BARREL_PAD, TOP: BARREL_TOP, H: BARREL_H };

export function barrelSprite(piece, active) {
  const key = active ? 'barrelOn' : 'barrelOff';
  if (piece.sprites[key]) return piece.sprites[key];
  const w = piece.w;
  const { c, g } = offscreen(w + BARREL_PAD * 2, BARREL_H);
  g.translate(BARREL_PAD, BARREL_TOP);
  const rnd = seeded(piece.seed + 61);
  // Sombra na água
  g.fillStyle = 'rgba(4, 50, 70, 0.32)';
  g.beginPath();
  g.ellipse(w / 2, 15, w / 2 + 4, 5, 0, 0, TAU);
  g.fill();
  // Quantos barris cabem (cada um com ~40 de comprimento)
  const n = Math.max(1, Math.round(w / 40));
  const bw = w / n;
  for (let i = 0; i < n; i++) {
    const x0 = i * bw + 1;
    const x1 = (i + 1) * bw - 1;
    const cx = (x0 + x1) / 2;
    const r = 9;
    // Corpo estufado (mais largo no meio)
    const grd = g.createLinearGradient(0, -2, 0, 16);
    grd.addColorStop(0, active ? '#D89A5A' : '#B27A44');
    grd.addColorStop(0.5, BARREL_WOOD);
    grd.addColorStop(1, '#4A2C14');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(x0, 1);
    g.quadraticCurveTo(cx, -4, x1, 1);
    g.lineTo(x1, 12);
    g.quadraticCurveTo(cx, 17, x0, 12);
    g.closePath();
    g.fill();
    // Aduelas
    g.strokeStyle = 'rgba(40, 20, 8, 0.45)';
    g.lineWidth = 0.8;
    for (const k of [0.33, 0.66]) {
      g.beginPath();
      g.moveTo(x0 + 1, k * 13 - 1);
      g.quadraticCurveTo(cx, k * 13 - 3 + (k - 0.5) * 4, x1 - 1, k * 13 - 1);
      g.stroke();
    }
    // Aros de ferro (dourados quando aceso)
    g.fillStyle = active ? GOLD : '#3A3430';
    for (const k of [0.16, 0.84]) {
      const hx = x0 + (x1 - x0) * k;
      g.fillRect(hx - 1.4, -1 + Math.abs(k - 0.5) * 2, 2.8, 14);
    }
    // Tampa da ponta (vista de lado: um filete)
    g.fillStyle = '#6A4020';
    g.fillRect(x1 - 1.6, 1, 1.6, 11);
    if (active) {
      g.fillStyle = 'rgba(255, 245, 190, 0.9)';
      g.fillRect(cx - 4 + rnd() * 8, -2.5, 1.8, 1.8);
    }
  }
  // Borda da água encostando nos barris
  g.strokeStyle = 'rgba(220, 250, 250, 0.7)';
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(-3, 13);
  g.lineTo(w + 3, 13);
  g.stroke();
  const sprite = { canvas: c, ox: BARREL_PAD, oy: BARREL_TOP, w: w + BARREL_PAD * 2, h: BARREL_H };
  piece.sprites[key] = sprite;
  return sprite;
}

// ---------------------------------------------------------------- Bichos
// Papagaio voando baixo sobre a fileira (tamanho do ganso): vermelho, asas azuis e
// amarelas batendo e o bico curvo
export const PARROT = { body: '#E0322A', wing: '#2A6AD8', tip: '#F2C230', beak: '#F2E8C8' };
export function drawParrot(ctx, c, y, t) {
  const flap = Math.sin(t * 10 + c.ph * 3);
  const by = y - 34 + Math.sin(t * 3 + c.ph) * 4;
  ctx.fillStyle = 'rgba(4, 50, 70, 0.25)';
  ctx.beginPath();
  ctx.ellipse(c.x, y + 14, 16, 3, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(c.x, by);
  ctx.scale(c.dir, 1);
  const wing = (back) => {
    const lift = (back ? 0.7 : 1) * flap;
    ctx.fillStyle = back ? '#1E4EA8' : PARROT.wing;
    ctx.beginPath();
    ctx.moveTo(-2, -2);
    ctx.quadraticCurveTo(-10, -16 - lift * 10, -22, -10 - lift * 14);
    ctx.lineTo(-14, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PARROT.tip;
    ctx.beginPath();
    ctx.moveTo(-14, -6 - lift * 8);
    ctx.lineTo(-22, -10 - lift * 14);
    ctx.lineTo(-15, -2 - lift * 3);
    ctx.fill();
  };
  ctx.save();
  ctx.scale(-1, 1);
  wing(true);
  ctx.restore();
  // Rabo comprido
  ctx.fillStyle = PARROT.wing;
  ctx.beginPath();
  ctx.moveTo(-8, 0);
  ctx.lineTo(-24, 6);
  ctx.lineTo(-22, 9);
  ctx.lineTo(-6, 4);
  ctx.fill();
  ctx.fillStyle = PARROT.body;
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 6.5, -0.2, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(10, -5, 6, 0, TAU);
  ctx.fill();
  wing(false);
  // Rosto branco, olho e bico curvo
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.ellipse(12, -5, 3, 3.4, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1A1410';
  ctx.beginPath();
  ctx.arc(12.6, -5.6, 1.3, 0, TAU);
  ctx.fill();
  ctx.fillStyle = PARROT.beak;
  ctx.beginPath();
  ctx.moveTo(15, -6);
  ctx.quadraticCurveTo(21, -6, 19, 0);
  ctx.lineTo(15, -2);
  ctx.fill();
  ctx.restore();
}

// Polvo com a cabeça para fora d'água e os tentáculos ondulando (tamanho do caranguejo)
export const OCTOPUS = { skin: '#B04AA8', dark: '#7A2A78', spot: '#E89AE0' };
export function drawOctopus(ctx, c, y, t) {
  const bob = Math.sin(t * 3 + c.ph) * 1.5;
  ctx.save();
  ctx.translate(c.x, y + 4 + bob);
  ctx.scale(c.dir, 1);
  // Tentáculos saindo da água em volta
  ctx.strokeStyle = OCTOPUS.dark;
  ctx.lineCap = 'round';
  ctx.lineWidth = 3.2;
  for (let i = 0; i < 4; i++) {
    const a = (i - 1.5) * 9;
    const w = Math.sin(t * 5 + i * 1.4 + c.ph) * 4;
    ctx.beginPath();
    ctx.moveTo(a, 2);
    ctx.quadraticCurveTo(a + w, -8, a * 1.4 + w * 1.6, -12);
    ctx.stroke();
  }
  // Cabeça (manto) com pintas
  const grd = ctx.createRadialGradient(-3, -22, 2, 0, -16, 16);
  grd.addColorStop(0, '#D27ACA');
  grd.addColorStop(1, OCTOPUS.skin);
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.ellipse(0, -15, 12, 15, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = OCTOPUS.spot;
  for (const [sx, sy] of [[-5, -24], [4, -26], [-7, -15], [6, -17]]) {
    ctx.beginPath();
    ctx.arc(sx, sy, 1.6, 0, TAU);
    ctx.fill();
  }
  // Olhos olhando para a frente
  for (const ex of [2, 8]) {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(ex, -10, 2.8, 3.4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1A1020';
    ctx.beginPath();
    ctx.arc(ex + 1, -10, 1.4, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// Tubarão: barbatana e dorso cinza cortando a água (tamanho do molusco)
export const SHARK = { back: '#6A7A88', belly: '#D8E0E6', fin: '#55646F' };
export function drawShark(ctx, c, y, t) {
  const bob = Math.sin(t * 2.4 + c.ph) * 1.2;
  ctx.save();
  ctx.translate(c.x, y + 8 + bob);
  ctx.scale(c.dir, 1);
  // Dorso aparecendo
  ctx.fillStyle = SHARK.back;
  ctx.beginPath();
  ctx.ellipse(-2, 0, 22, 4, 0, Math.PI, TAU);
  ctx.fill();
  // Barbatana
  ctx.fillStyle = SHARK.fin;
  ctx.beginPath();
  ctx.moveTo(-8, -2);
  ctx.quadraticCurveTo(-4, -16, 4, -24);
  ctx.quadraticCurveTo(2, -10, 8, -2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.beginPath();
  ctx.moveTo(-6, -3);
  ctx.quadraticCurveTo(-2, -14, 3, -21);
  ctx.lineTo(0, -6);
  ctx.fill();
  // Espuma na frente
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(14 + i * 2.5, -1 - (i % 2), 1.6, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(225, 250, 250, 0.55)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(c.x, y + 9, 20, 3, 0, 0, TAU);
  ctx.stroke();
}

// Garrafa com mensagem boiando (no lugar do peixe: mesmos pontos)
export const BOTTLE = { glass: '#5FBF8A', cork: '#B07A44', paper: '#F4E6C0' };
export function drawBottle(ctx, c, y, t) {
  const hop = Math.max(0, Math.sin(t * 3 + c.ph)) * 10;
  ctx.save();
  ctx.translate(c.x, y + 2 - hop);
  ctx.rotate(-0.5 * c.dir + Math.sin(t * 4 + c.ph) * 0.2);
  const gl = ctx.createRadialGradient(0, 0, 2, 0, 0, 18);
  gl.addColorStop(0, 'rgba(255, 250, 210, 0.35)');
  gl.addColorStop(1, 'rgba(255, 250, 210, 0)');
  ctx.fillStyle = gl;
  ctx.fillRect(-18, -18, 36, 36);
  ctx.fillStyle = 'rgba(95, 191, 138, 0.85)';
  ctx.beginPath();
  ctx.roundRect(-11, -5, 16, 10, 4);
  ctx.fill();
  ctx.fillRect(4, -2.4, 7, 4.8);
  ctx.fillStyle = BOTTLE.cork;
  ctx.fillRect(10, -2.2, 3, 4.4);
  ctx.fillStyle = BOTTLE.paper;
  ctx.fillRect(-8, -2.5, 10, 5);
  ctx.strokeStyle = '#C0392B';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-3, -2.5);
  ctx.lineTo(-3, 2.5);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillRect(-9, -4, 10, 1.2);
  ctx.restore();
  if (hop < 3) {
    ctx.strokeStyle = 'rgba(225, 250, 250, 0.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(c.x, y + 9, 14, 3, 0, 0, TAU);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- Crocodilo pirata
// No lugar do urso: corpo comprido e baixo, quatro patas curtas andando, rabo
// serrilhado, focinho enorme com dentes, bandana vermelha de bolinhas e tapa-olho.
// Perseguindo, vai de boca escancarada.
export const CROC = {
  skin: ['#7FB24A', '#5A8E32', '#3A6420'], belly: '#D8DC9A', bandana: '#D0322A', patch: '#141014',
  teeth: '#FFF8E6', mouth: '#8A2A2A', eye: '#FFD23A',
};
export function drawCroc(ctx, b, t) {
  const R = CROC;
  const run = b.chasing;
  const ph = b.walk * 3;
  const jaw = run ? 0.32 + Math.abs(Math.sin(t * 9)) * 0.12 : 0.03 + Math.max(0, Math.sin(t * 1.3) - 0.85) * 1.6;
  const bob = Math.abs(Math.sin(ph)) * -1.5;
  ctx.fillStyle = 'rgba(40, 30, 10, 0.3)';
  ctx.beginPath();
  ctx.ellipse(b.x, b.y + 3, 70, 7, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.scale(b.dir, 1);
  ctx.lineJoin = 'round';
  const leg = (x, k, back) => {
    const a = Math.sin(ph + k) * 0.45;
    ctx.save();
    ctx.translate(x, -14 + bob);
    ctx.rotate(a);
    ctx.fillStyle = back ? R.skin[2] : R.skin[1];
    ctx.beginPath();
    ctx.roundRect(-4.5, -2, 9, 15, 4);
    ctx.fill();
    ctx.fillStyle = R.teeth;
    for (let i = 0; i < 3; i++) ctx.fillRect(1 + i * 2.6, 12, 1.6, 3);
    ctx.restore();
  };
  leg(-24, Math.PI, true);
  leg(22, 0, true);
  ctx.translate(0, bob);
  // Rabo comprido e serrilhado
  ctx.fillStyle = R.skin[1];
  ctx.beginPath();
  ctx.moveTo(-28, -26);
  ctx.quadraticCurveTo(-60, -22 + Math.sin(ph) * 3, -88, -10 + Math.sin(ph) * 5);
  ctx.quadraticCurveTo(-60, -10, -28, -10);
  ctx.fill();
  ctx.fillStyle = R.skin[2];
  for (let i = 0; i < 6; i++) {
    const x = -34 - i * 9;
    const yy = -24 + i * 2 + Math.sin(ph) * (i / 6) * 3;
    ctx.beginPath();
    ctx.moveTo(x - 4, yy + 1);
    ctx.lineTo(x, yy - 5);
    ctx.lineTo(x + 4, yy + 1);
    ctx.fill();
  }
  // Corpo comprido com a barriga clara e as escamas do dorso
  const grd = ctx.createLinearGradient(0, -36, 0, -8);
  grd.addColorStop(0, R.skin[0]);
  grd.addColorStop(0.6, R.skin[1]);
  grd.addColorStop(1, R.skin[2]);
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.ellipse(0, -21, 36, 14, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = R.belly;
  ctx.beginPath();
  ctx.ellipse(2, -11, 30, 4.5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = R.skin[2];
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.arc(-26 + i * 8.5, -33 + Math.abs(i - 3) * 0.6, 2.6, 0, TAU);
    ctx.fill();
  }
  // Cabeça: crânio, focinho comprido de cima e a mandíbula embaixo
  ctx.save();
  ctx.translate(32, -24);
  ctx.save();
  ctx.rotate(jaw * 0.5);
  ctx.fillStyle = R.mouth;
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(44, 4);
  ctx.lineTo(44, 7);
  ctx.lineTo(0, 9);
  ctx.fill();
  ctx.fillStyle = R.skin[1];
  ctx.beginPath();
  ctx.roundRect(-2, 6, 46, 7, 3);
  ctx.fill();
  ctx.fillStyle = R.teeth;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(6 + i * 5, 6);
    ctx.lineTo(8 + i * 5, 2);
    ctx.lineTo(10 + i * 5, 6);
    ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.rotate(-jaw * 0.5);
  ctx.fillStyle = R.skin[0];
  ctx.beginPath();
  ctx.moveTo(-4, -10);
  ctx.quadraticCurveTo(10, -16, 20, -6);
  ctx.lineTo(48, -1);
  ctx.quadraticCurveTo(51, 3, 47, 5);
  ctx.lineTo(-2, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = R.teeth;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(8 + i * 5, 5);
    ctx.lineTo(10 + i * 5, 9);
    ctx.lineTo(12 + i * 5, 5);
    ctx.fill();
  }
  // Narinas na ponta
  ctx.fillStyle = R.skin[2];
  ctx.beginPath();
  ctx.arc(46, -1, 1.6, 0, TAU);
  ctx.fill();
  // Olho amarelo (o de perto) e o tapa-olho com a tira
  ctx.fillStyle = R.eye;
  ctx.beginPath();
  ctx.arc(10, -11, 3.6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1A1006';
  ctx.fillRect(10, -13.5, 1.6, 5);
  ctx.fillStyle = R.patch;
  ctx.beginPath();
  ctx.ellipse(3, -13, 3.6, 3, 0.2, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = R.patch;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-2, -16);
  ctx.lineTo(16, -9);
  ctx.stroke();
  // Bandana vermelha de bolinhas, com o nó e as pontas balançando
  ctx.fillStyle = R.bandana;
  ctx.beginPath();
  ctx.moveTo(-8, -6);
  ctx.quadraticCurveTo(-4, -20, 8, -17);
  ctx.lineTo(6, -12);
  ctx.quadraticCurveTo(-2, -13, -4, -4);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-8, -8);
  ctx.lineTo(-18, -4 + Math.sin(t * 6) * 2);
  ctx.lineTo(-16, 0 + Math.sin(t * 6) * 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  for (const [dx, dy] of [[-4, -12], [1, -16], [-6, -7]]) ctx.fillRect(dx, dy, 1.6, 1.6);
  ctx.restore();
  ctx.restore();
  leg(-20, 0, false);
  leg(26, Math.PI, false);
  ctx.restore();
}

// ---------------------------------------------------------------- Forte pirata
// Mesmo lugar e mesma porta do iglu, 16 peças: 6 blocos da muralha de pedra (duas
// fileiras), 3 ameias no alto, a torre de vigia (com o braseiro de onde sai a
// fumaça), a bandeira de caveira, 2 canhões nas seteiras, a lanterna ao lado da
// porta, a janela gradeada da torre e por último a porta de madeira reforçada.
const HW = 96;
const WALL_H = 80;
const ROW_H = WALL_H / 2;
const MERLONS = [-80, -50, -20];
const TOWER = { x: 62, w: 52, top: -146 };
const FLAG = { x: 62, y: -150 };
const CANNONS = [{ x: -58, y: -52 }, { x: 34, y: -52 }];
const LANTERN = { x: -38, y: -66 };
const WINDOW = { x: 62, y: -112 };

export const FORT_DOOR = { x: IGLOO.x, bottom: SHORE_Y + 1, w: IGLOO.doorRx, h: IGLOO.doorH };
// Medidas do forte (para o modelo 3D em src/m3d/pirate.js)
export const FORT = { HW, WALL_H, ROW_H, MERLONS, TOWER, FLAG, CANNONS, LANTERN, WINDOW };

const third = (HW * 2) / 3;
export const FORT_PIECES = [
  ...Array.from({ length: 6 }, (_, i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    return { kind: 'wall', row, col, cx: -HW + third * (col + 0.5), cy: -ROW_H / 2 - row * ROW_H };
  }),
  ...MERLONS.map((x, i) => ({ kind: 'merlon', i, cx: x, cy: -WALL_H - 8 })),
  { kind: 'tower', cx: TOWER.x, cy: (-WALL_H + TOWER.top) / 2 },
  { kind: 'flag', cx: FLAG.x + 12, cy: FLAG.y - 22 },
  { kind: 'cannon', side: -1, cx: CANNONS[0].x, cy: CANNONS[0].y },
  { kind: 'cannon', side: 1, cx: CANNONS[1].x, cy: CANNONS[1].y },
  { kind: 'lantern', cx: LANTERN.x, cy: LANTERN.y },
  { kind: 'window', cx: WINDOW.x, cy: WINDOW.y },
  { kind: 'door', cx: 0, cy: -IGLOO.doorH / 2 },
];

// Braseiro no alto da torre (de onde sai a fumaça)
export const FORT_VENT = { x: IGLOO.x + TOWER.x, y: IGLOO.baseY + TOWER.top - 10 };
export const FORT_STONE = '#9A8E7E';
export const JOLLY = '#1A1A1E';

const easeOutBack = (k) => 1 + 2.9 * (k - 1) ** 3 + 1.9 * (k - 1) ** 2;

function stoneBlock(ctx, x, y, w, h, seed) {
  const rnd = seeded(seed);
  const grd = ctx.createLinearGradient(x, y, x, y + h);
  grd.addColorStop(0, '#B4A894');
  grd.addColorStop(1, '#7A6E60');
  ctx.fillStyle = grd;
  ctx.fillRect(x, y, w, h);
  // Pedras aparelhadas com juntas
  ctx.strokeStyle = 'rgba(50, 40, 30, 0.55)';
  ctx.lineWidth = 1.2;
  const rows = 3;
  for (let r = 0; r < rows; r++) {
    const yy = y + (r * h) / rows;
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + w, yy);
    ctx.stroke();
    for (let xx = x + ((r % 2) * w) / 6; xx < x + w; xx += w / 3) {
      ctx.beginPath();
      ctx.moveTo(xx, yy);
      ctx.lineTo(xx, yy + h / rows);
      ctx.stroke();
    }
  }
  ctx.fillStyle = 'rgba(90, 130, 60, 0.4)';
  ctx.fillRect(x + rnd() * w * 0.6, y + h - 4, 10 + rnd() * 8, 3);
}

function drawTower(ctx) {
  const { x, w, top } = TOWER;
  stoneBlock(ctx, x - w / 2, top + 8, w, -WALL_H - top - 8, 71);
  // Ameias da torre
  ctx.fillStyle = '#A89C88';
  for (let i = 0; i < 3; i++) ctx.fillRect(x - w / 2 + i * (w / 2.5), top, w / 5, 10);
  ctx.fillStyle = '#5A5048';
  ctx.fillRect(x - w / 2 - 3, top + 8, w + 6, 4);
}

function drawBrazier(ctx, t) {
  const { x, top } = TOWER;
  ctx.fillStyle = '#2A2420';
  ctx.fillRect(x - 7, top - 2, 14, 5);
  if (addLight(ctx, 'glow', { x, y: top - 4, r: 18, color: [255, 160, 60], a: 0.7 + Math.sin(t * 8) * 0.1 })) return;
  ctx.fillStyle = `rgba(255, 150, 50, ${0.6 + Math.sin(t * 9) * 0.15})`;
  ctx.beginPath();
  ctx.ellipse(x, top - 4, 6, 4, 0, 0, TAU);
  ctx.fill();
}

function drawFlag(ctx, t) {
  const { x, y } = FLAG;
  ctx.strokeStyle = '#3A2A1C';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + 6);
  ctx.lineTo(x, y - 40);
  ctx.stroke();
  const wave = Math.sin(t * 4) * 2;
  ctx.fillStyle = JOLLY;
  ctx.beginPath();
  ctx.moveTo(x, y - 40);
  ctx.quadraticCurveTo(x + 14, y - 40 + wave, x + 28, y - 38);
  ctx.lineTo(x + 28, y - 20);
  ctx.quadraticCurveTo(x + 14, y - 22 - wave, x, y - 22);
  ctx.closePath();
  ctx.fill();
  // Caveira e ossos cruzados
  ctx.fillStyle = '#F2F0E6';
  ctx.beginPath();
  ctx.arc(x + 14, y - 33, 4.2, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#F2F0E6';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x + 8, y - 28);
  ctx.lineTo(x + 20, y - 24);
  ctx.moveTo(x + 20, y - 28);
  ctx.lineTo(x + 8, y - 24);
  ctx.stroke();
  ctx.fillStyle = JOLLY;
  ctx.fillRect(x + 12, y - 34, 1.4, 1.4);
  ctx.fillRect(x + 15, y - 34, 1.4, 1.4);
}

function drawFortCannon(ctx, c) {
  ctx.fillStyle = '#2A2420';
  ctx.fillRect(c.x - 9, c.y - 7, 18, 14);
  ctx.fillStyle = '#1A1614';
  ctx.beginPath();
  ctx.arc(c.x, c.y, 6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#4A4440';
  ctx.beginPath();
  ctx.arc(c.x, c.y, 3.4, 0, TAU);
  ctx.fill();
}

function drawFortLantern(ctx, t) {
  const { x, y } = LANTERN;
  ctx.fillStyle = '#2A2420';
  ctx.fillRect(x - 6, y - 6, 12, 3);
  ctx.fillRect(x - 1, y - 10, 2, 5);
  fortLanternGlow(ctx, t);
  ctx.fillStyle = '#FFE27A';
  ctx.fillRect(x - 4.5, y - 3, 9, 13);
  ctx.strokeStyle = '#2A2420';
  ctx.lineWidth = 1.4;
  ctx.strokeRect(x - 4.5, y - 3, 9, 13);
}

function fortLanternGlow(ctx, t) {
  const { x, y } = LANTERN;
  if (addLight(ctx, 'glow', { x, y: y + 4, r: 24, color: [255, 210, 110], a: 0.6 + Math.sin(t * 9) * 0.08 })) return;
  const gl = ctx.createRadialGradient(x, y + 4, 2, x, y + 4, 24);
  gl.addColorStop(0, `rgba(255, 210, 110, ${0.45 + Math.sin(t * 9) * 0.07})`);
  gl.addColorStop(1, 'rgba(255, 210, 110, 0)');
  ctx.fillStyle = gl;
  ctx.fillRect(x - 24, y - 20, 48, 48);
}

// Brilho da lanterna e do braseiro (também por cima do forte 3D)
export function drawFortLights(ctx, t, { lantern = true, brazier = true } = {}) {
  if (lantern) fortLanternGlow(ctx, t);
  if (brazier) {
    const { x, top } = TOWER;
    if (!addLight(ctx, 'glow', { x, y: top - 4, r: 18, color: [255, 160, 60], a: 0.7 + Math.sin(t * 8) * 0.1 })) {
      ctx.fillStyle = `rgba(255, 150, 50, ${0.35 + Math.sin(t * 9) * 0.1})`;
      ctx.beginPath();
      ctx.ellipse(x, top - 4, 9, 5, 0, 0, TAU);
      ctx.fill();
    }
  }
}

function drawFortWindow(ctx, lit) {
  const { x, y } = WINDOW;
  ctx.fillStyle = lit ? '#FFC870' : '#1A1614';
  ctx.beginPath();
  ctx.roundRect(x - 7, y - 10, 14, 20, [7, 7, 1, 1]);
  ctx.fill();
  ctx.fillStyle = '#2A2420';
  for (const dx of [-3, 0.5, 4]) ctx.fillRect(x + dx - 0.8, y - 9, 1.6, 19);
}

function doorRect() {
  const d = FORT_DOOR;
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

// Batente de pedra em arco
function drawDoorFrame(ctx, igloo, t) {
  if (doorArt.draw?.(ctx, 'fort', 'frame', igloo, t)) return;
  const r = doorRect();
  ctx.strokeStyle = '#6A5E50';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(r.x - 3, r.y + r.h);
  ctx.lineTo(r.x - 3, r.y + r.w / 2);
  ctx.arc(r.x + r.w / 2, r.y + r.w / 2, r.w / 2 + 3, Math.PI, 0);
  ctx.lineTo(r.x + r.w + 3, r.y + r.h);
  ctx.stroke();
}

// Porta de tábuas grossas com faixas de ferro, que fecha girando: k = 0 aberta, 1 fechada
function drawDoorLeaf(ctx, k, igloo, t) {
  if (k <= 0) return;
  if (doorArt.draw?.(ctx, 'fort', 'leaf', igloo, t)) return;
  const r = doorRect();
  const w = r.w * k;
  ctx.save();
  doorPath(ctx);
  ctx.clip();
  const g = ctx.createLinearGradient(r.x, 0, r.x + w, 0);
  g.addColorStop(0, '#4A2C16');
  g.addColorStop(1, '#6E4424');
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, w, r.h);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  for (let x = r.x + 8; x < r.x + w; x += 9) ctx.fillRect(x, r.y, 1.2, r.h);
  ctx.fillStyle = '#2A2420';
  for (const y of [r.y + 18, r.y + r.h - 14]) ctx.fillRect(r.x, y, w, 4);
  ctx.restore();
  if (k > 0.8) {
    ctx.strokeStyle = '#C9A44A';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(r.x + w - 9, r.y + r.h * 0.56, 3.4, 0, TAU);
    ctx.stroke();
  }
}

// Desenha o forte com as peças já construídas (igloo = estado da construção)
export function drawFort(ctx, igloo, t) {
  const n = igloo.count;
  ctx.save();
  ctx.translate(IGLOO.x, IGLOO.baseY);
  ctx.fillStyle = 'rgba(60, 40, 10, 0.35)';
  ctx.beginPath();
  ctx.ellipse(6, 3, HW + 30, 9, 0, 0, TAU);
  ctx.fill();
  if (n < RULES.iglooPieces) {
    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = 'rgba(90, 60, 30, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-HW, -WALL_H, HW * 2, WALL_H);
    ctx.strokeRect(TOWER.x - TOWER.w / 2, TOWER.top, TOWER.w, -WALL_H - TOWER.top);
    ctx.restore();
  }
  // Ordem de desenho: torre e bandeira atrás, muralha, ameias, canhões, lanterna, janela
  const order = [10, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13, 14];
  for (const i of order) {
    if (i >= n) continue;
    const a = igloo.anim[i];
    ctx.save();
    ctx.globalAlpha = Math.min(1, a * 3);
    ctx.translate(0, -(1 - easeOutBack(a)) * 46);
    const p = FORT_PIECES[i];
    if (p.kind === 'wall') {
      const x0 = -HW + third * p.col;
      const y1 = -p.row * ROW_H;
      stoneBlock(ctx, x0, y1 - ROW_H, third + 0.5, ROW_H + 0.5, 31 + i);
    } else if (p.kind === 'merlon') {
      stoneBlock(ctx, p.cx - 11, -WALL_H - 16, 22, 16, 51 + p.i);
    } else if (p.kind === 'tower') {
      drawTower(ctx);
      drawBrazier(ctx, t);
    } else if (p.kind === 'flag') drawFlag(ctx, t);
    else if (p.kind === 'cannon') drawFortCannon(ctx, CANNONS[p.side < 0 ? 0 : 1]);
    else if (p.kind === 'lantern') drawFortLantern(ctx, t);
    else if (p.kind === 'window') drawFortWindow(ctx, igloo.lit);
    ctx.restore();
  }
  ctx.restore();
  drawFortDoor(ctx, igloo, t);
}

// Porta (peça 16): abertura escura, luz quando acesa, a porta e o batente (ou o
// contorno tracejado enquanto não está pronta). Também usada pelo forte 3D
export function drawFortDoor(ctx, igloo, t) {
  const n = igloo.count;
  const r = doorRect();
  if (n < RULES.iglooPieces) {
    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = 'rgba(90, 60, 30, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(r.x - 4, r.y - 4, r.w + 8, r.h + 4);
    ctx.restore();
    return;
  }
  const a = igloo.anim[RULES.iglooPieces - 1];
  ctx.save();
  ctx.globalAlpha = Math.min(1, a * 3);
  ctx.translate(0, -(1 - easeOutBack(a)) * 30);
  const in3d = !!doorArt.draw?.(ctx, 'fort', 'inside', igloo, t);
  ctx.save();
  doorPath(ctx);
  if (!in3d) {
    const dg = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    dg.addColorStop(0, '#120C08');
    dg.addColorStop(1, '#2A1C10');
    ctx.fillStyle = dg;
    ctx.fill();
  }
  if (igloo.lit && !(in3d && addLight(ctx, 'glow', { x: r.x + r.w / 2, y: r.y + r.h * 0.5, r: r.w, color: [255, 180, 90], a: 0.55 + Math.sin(t * 5) * 0.08 }))) {
    ctx.fillStyle = `rgba(255, 185, 95, ${in3d ? 0.16 + Math.sin(t * 5) * 0.16 : 0.5 + Math.sin(t * 5) * 0.08})`;
    ctx.fill();
  }
  ctx.restore();
  drawDoorLeaf(ctx, igloo.curtain, igloo, t);
  drawDoorFrame(ctx, igloo, t);
  ctx.restore();
}

// Desenhado POR CIMA do personagem enquanto ele entra
export function drawFortDoorFront(ctx, igloo, t) {
  if (igloo.count < RULES.iglooPieces) return;
  const r = doorRect();
  ctx.save();
  if (igloo.shade > 0) {
    ctx.save();
    doorPath(ctx);
    ctx.clip();
    ctx.fillStyle = `rgba(14, 8, 4, ${0.45 * igloo.shade})`;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  }
  drawDoorLeaf(ctx, igloo.curtain, igloo, t);
  drawDoorFrame(ctx, igloo, t);
  ctx.restore();
}
