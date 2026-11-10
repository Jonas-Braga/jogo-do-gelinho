// Fase especial da floresta (fase 10): cenário de mata com rio, troncos no lugar
// das placas de gelo, cabana de madeira no lugar do iglu, cobras, morcegos e
// piranhas, folhas caindo no lugar da neve. Só o visual muda: as regras, a
// colisão e a dificuldade são as mesmas da fase normal.
import { W, IGLOO, SHORE_Y, SHORE_TOP, WATER_TOP, RULES } from './config.js';

const SS = 2;

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

// Cores do rio (o renderer usa no lugar da água gelada)
export const RIVER = {
  water: ['#3F7F63', '#24563F', '#0F2F22'],
  ripple: [205, 235, 200],
  bank: 'rgba(30, 25, 10, 0.4)',
  halo: [255, 196, 90],  // brilho dos troncos "acesos"
  sawdust: '#D8B784',    // serragem (encaixe das peças da cabana)
};

// ---------------------------------------------------------------- Fundo
// Morros com pinheiros ao longe, mata mais perto, clareira de grama na costa e
// barranco de terra com pedras entrando no rio.
export function makeForestBackground() {
  const h = WATER_TOP + 12;
  const { c, g } = offscreen(W, h);
  const rnd = seeded(11);

  // Morros distantes, azulados pela distância
  const hills = (baseY, amp, color) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(-20, SHORE_TOP + 20);
    for (let x = -20; x <= W + 20; x += 20) {
      g.lineTo(x, baseY - amp * (0.55 + 0.45 * Math.sin(x * 0.006 + baseY)) - Math.sin(x * 0.021) * amp * 0.15);
    }
    g.lineTo(W + 20, SHORE_TOP + 20);
    g.fill();
  };
  hills(140, 40, '#7FA8A0');
  hills(160, 30, '#5E8C7A');

  // Fileiras de pinheiros: as de trás menores e mais apagadas
  const pine = (x, base, ht, color, dark) => {
    const w = ht * 0.42;
    g.fillStyle = dark;
    g.fillRect(x - 1.5, base - ht * 0.12, 3, ht * 0.14);
    g.fillStyle = color;
    for (let i = 0; i < 4; i++) {
      const yb = base - ht * 0.1 - i * ht * 0.2;
      const hw = (w / 2) * (1 - i * 0.2);
      g.beginPath();
      g.moveTo(x - hw, yb);
      g.lineTo(x, yb - ht * 0.36);
      g.lineTo(x + hw, yb);
      g.closePath();
      g.fill();
    }
  };
  for (let x = -10; x < W + 20; x += 14 + rnd() * 16) pine(x, 168 + rnd() * 8, 34 + rnd() * 22, '#3E6F5A', '#2E4A3A');
  for (let x = -10; x < W + 20; x += 20 + rnd() * 22) pine(x, 186 + rnd() * 6, 48 + rnd() * 30, '#2C5B41', '#3A2A1C');

  // Névoa leve entre a mata e a clareira
  let grd = g.createLinearGradient(0, SHORE_TOP - 24, 0, SHORE_TOP + 6);
  grd.addColorStop(0, 'rgba(210, 230, 210, 0)');
  grd.addColorStop(1, 'rgba(210, 230, 210, 0.45)');
  g.fillStyle = grd;
  g.fillRect(0, SHORE_TOP - 24, W, 32);

  // Clareira de grama
  grd = g.createLinearGradient(0, SHORE_TOP, 0, WATER_TOP);
  grd.addColorStop(0, '#8DB65A');
  grd.addColorStop(0.6, '#6E9B44');
  grd.addColorStop(1, '#557C33');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(0, WATER_TOP);
  for (let x = 0; x <= W; x += 20) g.lineTo(x, SHORE_TOP + Math.sin(x * 0.013) * 4 + Math.sin(x * 0.051) * 1.5);
  g.lineTo(W, WATER_TOP);
  g.fill();
  // Manchas de terra batida e tufos de capim
  for (let i = 0; i < 14; i++) {
    g.fillStyle = 'rgba(120, 95, 55, 0.22)';
    g.beginPath();
    g.ellipse(rnd() * W, SHORE_TOP + 20 + rnd() * 40, 20 + rnd() * 40, 3 + rnd() * 3, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.lineWidth = 1.2;
  for (let i = 0; i < 260; i++) {
    const x = rnd() * W;
    const y = SHORE_TOP + 8 + rnd() * 66;
    g.strokeStyle = rnd() < 0.5 ? 'rgba(170, 210, 110, 0.8)' : 'rgba(60, 100, 40, 0.6)';
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (rnd() - 0.5) * 4, y - 3 - rnd() * 4);
    g.stroke();
  }
  // Florzinhas
  for (let i = 0; i < 40; i++) {
    g.fillStyle = ['#FFF4C2', '#F7D25C', '#E9A6D8'][i % 3];
    g.beginPath();
    g.arc(rnd() * W, SHORE_TOP + 12 + rnd() * 58, 1.4, 0, Math.PI * 2);
    g.fill();
  }

  // Barranco de terra entrando no rio
  const edgeTop = WATER_TOP - 14;
  grd = g.createLinearGradient(0, edgeTop, 0, WATER_TOP + 12);
  grd.addColorStop(0, '#7A5A36');
  grd.addColorStop(0.45, '#5C4126');
  grd.addColorStop(1, '#2F2414');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(0, edgeTop + 2);
  for (let x = 0; x <= W; x += 16) g.lineTo(x, edgeTop + Math.sin(x * 0.09) * 1.5);
  g.lineTo(W, WATER_TOP + 12);
  g.lineTo(0, WATER_TOP + 12);
  g.fill();
  // Pedras e raízes no barranco
  for (let x = 0; x < W; x += 18 + rnd() * 40) {
    g.fillStyle = rnd() < 0.5 ? '#8C8A7E' : '#6E6C62';
    g.beginPath();
    g.ellipse(x, edgeTop + 8 + rnd() * 12, 4 + rnd() * 6, 3 + rnd() * 3, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = 'rgba(60, 40, 20, 0.7)';
  for (let i = 0; i < 18; i++) {
    const x = rnd() * W;
    g.beginPath();
    g.moveTo(x, edgeTop + 1);
    g.quadraticCurveTo(x + 6, edgeTop + 10, x + (rnd() - 0.5) * 14, WATER_TOP + 6);
    g.stroke();
  }
  // Borda de grama por cima do barranco
  g.fillStyle = '#6E9B44';
  g.fillRect(0, edgeTop - 2, W, 3);

  return { canvas: c, w: W, h };
}

// Pinheiros grandes e arbustos na costa (atrás do personagem), longe da cabana
export const FOREST_TREES = [
  { x: 44, base: 240, h: 128 },
  { x: 130, base: 234, h: 92 },
  { x: 214, base: 238, h: 62 },
];

export function drawForestDecor(ctx, t) {
  FOREST_TREES.forEach((tr, k) => drawPine(ctx, tr, t, k));
  // Cogumelos ao pé das árvores
  for (const [x, y, s] of [[92, 246, 1], [176, 244, 0.8], [250, 247, 0.9]]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = '#F2E8D2';
    ctx.fillRect(-2, -7, 4, 7);
    ctx.fillStyle = '#C93A2E';
    ctx.beginPath();
    ctx.ellipse(0, -7, 7, 4.5, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-3.5, -9.5, 1.6, 1.6);
    ctx.fillRect(1.5, -10, 1.6, 1.6);
    ctx.restore();
  }
}

function drawPine(ctx, { x, base, h }, t, k) {
  ctx.save();
  ctx.translate(x, base);
  const w = h * 0.6;
  ctx.fillStyle = 'rgba(30, 50, 20, 0.28)';
  ctx.beginPath();
  ctx.ellipse(4, 2, w * 0.55, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5B3A22';
  ctx.fillRect(-5, -14, 10, 15);
  // O topo balança de leve com o vento
  const sway = Math.sin(t * 1.3 + k * 2) * 0.02;
  for (let i = 0; i < 4; i++) {
    const yb = -12 - i * h * 0.2;
    const yt = yb - h * 0.34;
    const hw = (w / 2) * (1 - i * 0.2);
    ctx.save();
    ctx.rotate(sway * (i + 1));
    const g = ctx.createLinearGradient(-hw, 0, hw, 0);
    g.addColorStop(0, '#3E8A4E');
    g.addColorStop(0.6, '#2A6638');
    g.addColorStop(1, '#1A4526');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-hw, yb);
    ctx.quadraticCurveTo(-hw * 0.4, yb - 4, 0, yt);
    ctx.quadraticCurveTo(hw * 0.4, yb - 4, hw, yb);
    ctx.quadraticCurveTo(0, yb + 5, -hw, yb);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- Troncos
// Tronco boiando no rio, visto um pouco de cima. Os pés pisam na linha FLOE_TOP.
// Aceso (fileira pisada): madeira descascada, cor de mel, com brilho quente.
const LOG_PAD = 12;
const LOG_TOP = 22;
const LOG_H = 64;

export function logSprite(piece, active) {
  const key = active ? 'logOn' : 'logOff';
  if (piece.sprites[key]) return piece.sprites[key];
  const w = piece.w;
  const { c, g } = offscreen(w + LOG_PAD * 2, LOG_H);
  g.translate(LOG_PAD, LOG_TOP);
  const rnd = seeded(piece.seed + 7);
  const top = -9;      // topo do tronco
  const bottom = 15;   // base (parte de baixo some na água)
  const r = (bottom - top) / 2;
  const cy = top + r;
  const bark = active ? ['#F6D58E', '#D9A24E', '#9C6A2A'] : ['#8A6340', '#5E3F24', '#3A2614'];

  // Reflexo escuro da parte submersa
  g.fillStyle = 'rgba(15, 35, 25, 0.35)';
  g.beginPath();
  g.ellipse(w / 2, bottom + 4, w / 2 + 4, 5, 0, 0, Math.PI * 2);
  g.fill();

  // Corpo cilíndrico
  let grd = g.createLinearGradient(0, top, 0, bottom);
  grd.addColorStop(0, bark[0]);
  grd.addColorStop(0.45, bark[1]);
  grd.addColorStop(1, bark[2]);
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(0, top);
  g.lineTo(w, top);
  g.ellipse(w, cy, r * 0.42, r, 0, -Math.PI / 2, Math.PI / 2);
  g.lineTo(0, bottom);
  g.closePath();
  g.fill();

  // Textura: estrias da casca (ou veios da madeira descascada) e nós
  g.save();
  g.beginPath();
  g.rect(0, top, w + r, bottom - top);
  g.clip();
  g.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const y = top + 3 + i * 3.6 + (rnd() - 0.5);
    g.strokeStyle = active ? 'rgba(150, 95, 35, 0.35)' : 'rgba(25, 15, 6, 0.45)';
    g.beginPath();
    g.moveTo(rnd() * 6, y);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x * 0.3 + i) * 0.8);
    g.stroke();
  }
  for (let i = 0; i < Math.max(1, Math.round(w / 40)); i++) {
    const kx = 8 + rnd() * (w - 16);
    const ky = top + 4 + rnd() * 10;
    g.fillStyle = active ? 'rgba(140, 85, 30, 0.6)' : 'rgba(30, 18, 8, 0.7)';
    g.beginPath();
    g.ellipse(kx, ky, 3, 1.8, 0, 0, Math.PI * 2);
    g.fill();
  }
  // Musgo na casca (só o tronco escuro)
  if (!active) {
    for (let i = 0; i < w / 10; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(110, 150, 60, 0.55)' : 'rgba(80, 120, 45, 0.5)';
      g.beginPath();
      g.arc(rnd() * w, top + 1 + rnd() * 3, 1.2 + rnd() * 1.6, 0, Math.PI * 2);
      g.fill();
    }
  }
  // Brilho no topo arredondado
  g.fillStyle = active ? 'rgba(255, 240, 200, 0.55)' : 'rgba(200, 160, 110, 0.25)';
  g.fillRect(1, top + 1.5, w - 2, 1.6);
  g.restore();

  // Ponta cortada da esquerda (anéis), voltada para quem olha
  g.save();
  g.translate(0, cy);
  grd = g.createRadialGradient(0, 0, 1, 0, 0, r);
  grd.addColorStop(0, active ? '#FFE7B0' : '#E2C08A');
  grd.addColorStop(1, active ? '#E2B062' : '#B88E58');
  g.fillStyle = grd;
  g.beginPath();
  g.ellipse(0, 0, r * 0.42, r, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(120, 80, 40, 0.55)';
  g.lineWidth = 0.7;
  for (let k = 1; k <= 3; k++) {
    g.beginPath();
    g.ellipse(0, 0, (r * 0.42 * k) / 4, (r * k) / 4, 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.strokeStyle = active ? '#B07A34' : '#4A3019';
  g.lineWidth = 1.4;
  g.beginPath();
  g.ellipse(0, 0, r * 0.42, r, 0, 0, Math.PI * 2);
  g.stroke();
  g.restore();

  // Linha d'água
  g.fillStyle = 'rgba(220, 240, 220, 0.4)';
  g.fillRect(-2, bottom - 4, w + 6, 1.4);

  const sprite = { canvas: c, ox: LOG_PAD, oy: LOG_TOP, w: w + LOG_PAD * 2, h: LOG_H };
  piece.sprites[key] = sprite;
  return sprite;
}

// ---------------------------------------------------------------- Bichos
// Desenhados em relação à linha da fileira (y = onde os pés do jogador pisam).

// Cobra deslizando por cima dos troncos, com a cabeça erguida e a língua bifurcada
export function drawSnake(ctx, c, y, t) {
  const by = y - 3;
  ctx.save();
  ctx.translate(c.x, by);
  ctx.scale(c.dir, 1);
  ctx.fillStyle = 'rgba(15, 35, 25, 0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 22, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // Corpo ondulando (de trás para a frente)
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const x = -22 + i * 3.4;
    pts.push([x, Math.sin(t * 9 + c.ph * 3 - i * 0.8) * 3 * (i < 10 ? 1 : 0.4)]);
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const body = (width, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    pts.forEach(([x, yy], i) => (i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy)));
    ctx.stroke();
  };
  body(8, '#2F5F1E');
  body(5.5, '#6BA33A');
  // Losangos amarelos nas costas
  ctx.fillStyle = '#E6C94A';
  for (let i = 2; i < 11; i += 2) {
    const [x, yy] = pts[i];
    ctx.beginPath();
    ctx.moveTo(x - 2, yy);
    ctx.lineTo(x, yy - 1.8);
    ctx.lineTo(x + 2, yy);
    ctx.lineTo(x, yy + 1.8);
    ctx.fill();
  }
  // Cabeça erguida
  const [hx, hy] = pts[12];
  const lift = -8 + Math.sin(t * 4 + c.ph) * 1.5;
  ctx.strokeStyle = '#4E8A2C';
  ctx.lineWidth = 5.5;
  ctx.beginPath();
  ctx.moveTo(hx - 3, hy);
  ctx.quadraticCurveTo(hx + 2, hy - 2, hx + 4, hy + lift + 2);
  ctx.stroke();
  ctx.fillStyle = '#5D9A34';
  ctx.beginPath();
  ctx.ellipse(hx + 7, hy + lift, 7, 4.6, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#F7E36A';
  ctx.beginPath();
  ctx.arc(hx + 9, hy + lift - 2, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.fillRect(hx + 9, hy + lift - 3.2, 0.9, 2.6);
  // Língua
  if (Math.sin(t * 7 + c.ph) > 0.2) {
    ctx.strokeStyle = '#D6303A';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(hx + 13, hy + lift + 1);
    ctx.lineTo(hx + 18, hy + lift + 1);
    ctx.lineTo(hx + 20, hy + lift - 1);
    ctx.moveTo(hx + 18, hy + lift + 1);
    ctx.lineTo(hx + 20, hy + lift + 3);
    ctx.stroke();
  }
  ctx.restore();
}

// Morcego voando baixo sobre a fileira, batendo as asas
export function drawBat(ctx, c, y, t) {
  const flap = Math.sin(t * 16 + c.ph * 3);
  const by = y - 32 + Math.sin(t * 4 + c.ph) * 5;
  ctx.fillStyle = 'rgba(15, 35, 25, 0.25)';
  ctx.beginPath();
  ctx.ellipse(c.x, y + 16, 16, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(c.x, by);
  ctx.scale(c.dir, 1);
  const wing = (s) => {
    const tip = -4 - flap * 14;
    ctx.fillStyle = s < 0 ? '#3A2D45' : '#4F3D5E';
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.quadraticCurveTo(s * 10, tip - 6, s * 22, tip);
    ctx.quadraticCurveTo(s * 18, tip + 6, s * 15, tip + 3);
    ctx.quadraticCurveTo(s * 12, tip + 9, s * 8, tip + 5);
    ctx.quadraticCurveTo(s * 5, 5, 0, 4);
    ctx.closePath();
    ctx.fill();
    // Dedos da asa
    ctx.strokeStyle = 'rgba(20, 12, 28, 0.6)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(s * 15, tip + 3);
    ctx.moveTo(0, 1);
    ctx.lineTo(s * 8, tip + 5);
    ctx.stroke();
  };
  wing(-1);
  // Corpo peludo
  ctx.fillStyle = '#5A4632';
  ctx.beginPath();
  ctx.ellipse(0, 1, 6.5, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Cabeça com orelhas pontudas
  ctx.fillStyle = '#6A543C';
  ctx.beginPath();
  ctx.arc(4, -7, 5, 0, Math.PI * 2);
  ctx.moveTo(1, -10);
  ctx.lineTo(0, -17);
  ctx.lineTo(4, -11);
  ctx.moveTo(5, -11);
  ctx.lineTo(8, -17);
  ctx.lineTo(8.5, -9);
  ctx.fill();
  // Olhos vermelhos e presinhas
  ctx.fillStyle = '#FF5A4A';
  ctx.beginPath();
  ctx.arc(5.5, -8, 1.3, 0, Math.PI * 2);
  ctx.arc(8.3, -7.5, 1.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(6.5, -4.5, 1, 1.8);
  ctx.fillRect(8.4, -4.7, 1, 1.8);
  wing(1);
  ctx.restore();
}

// Piranha: nada na superfície mostrando o dorso e dá botes para fora d'água
export function drawPiranha(ctx, c, y, t) {
  const s = Math.sin(t * 3.2 + c.ph);
  const hop = Math.max(0, s) * 14;
  const tilt = Math.cos(t * 3.2 + c.ph) * (s > 0 ? -0.4 : 0);
  const wl = y + 9; // linha d'água
  ctx.save();
  ctx.beginPath();
  ctx.rect(c.x - 70, wl - 120, 140, 120);
  ctx.clip();
  ctx.translate(c.x, y + 6 - hop);
  ctx.scale(c.dir, 1);
  ctx.rotate(tilt);
  const chomp = Math.abs(Math.sin(t * 10 + c.ph)) * 0.5;
  // Cauda
  ctx.fillStyle = '#4C5A63';
  ctx.beginPath();
  ctx.moveTo(-12, 0);
  ctx.lineTo(-21, -7);
  ctx.lineTo(-18, 0);
  ctx.lineTo(-21, 7);
  ctx.closePath();
  ctx.fill();
  // Corpo alto e arredondado: dorso cinza-azulado, barriga vermelha
  const g = ctx.createLinearGradient(0, -10, 0, 9);
  g.addColorStop(0, '#5E6E78');
  g.addColorStop(0.45, '#9AA7AE');
  g.addColorStop(0.62, '#E0563A');
  g.addColorStop(1, '#B8321E');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // Barbatana dorsal
  ctx.fillStyle = '#4C5A63';
  ctx.beginPath();
  ctx.moveTo(-6, -8);
  ctx.lineTo(0, -15);
  ctx.lineTo(4, -9);
  ctx.fill();
  // Boca aberta com dentes
  ctx.fillStyle = '#4A0E0E';
  ctx.beginPath();
  ctx.moveTo(14, -1);
  ctx.lineTo(7, 1 + chomp);
  ctx.lineTo(14, 3 + chomp * 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(9 + i * 1.8, 0.3);
    ctx.lineTo(9.9 + i * 1.8, 2);
    ctx.lineTo(10.8 + i * 1.8, 0.2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(9 + i * 1.8, 3 + chomp * 5);
    ctx.lineTo(9.9 + i * 1.8, 1.4 + chomp * 5);
    ctx.lineTo(10.8 + i * 1.8, 3 + chomp * 5);
    ctx.fill();
  }
  // Olho bravo
  ctx.fillStyle = '#F2D33C';
  ctx.beginPath();
  ctx.arc(7, -4, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(7.6, -4, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2E3A40';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(4, -8);
  ctx.lineTo(10, -6);
  ctx.stroke();
  ctx.restore();
  // Contorno da água em volta (ou respingos no bote)
  if (hop < 5) {
    ctx.strokeStyle = 'rgba(210, 240, 220, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(c.x, wl, 16, 3, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(210, 240, 220, 0.7)';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(c.x - c.dir * (10 + i * 6), wl - (hop - 5) * 0.3 * (i + 1) / 3, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ---------------------------------------------------------------- Cabana
// Mesmo lugar e mesma porta do iglu (o personagem entra igualzinho), 16 peças:
// 6 toras de parede, 3 faixas da empena, 4 tábuas do telhado, janela, chaminé
// e por último a porta.
const CW = 96;        // meia largura das paredes
const WALL_H = 72;    // altura das paredes (6 toras de 12)
const LOG = WALL_H / 6;
const PEAK = 58;      // altura da empena acima das paredes
const EAVE = 16;      // beiral do telhado além das paredes
const ROOF_T = 11;    // espessura das tábuas do telhado

export const CABIN_DOOR = {
  x: IGLOO.x,
  bottom: SHORE_Y + 1,
  w: IGLOO.doorRx,     // meia largura da abertura (igual à do iglu)
  h: IGLOO.doorH,
};
const CHIMNEY = { x0: 44, x1: 62, top: -WALL_H - PEAK - 6 };

// Peças em coordenadas locais (origem no centro da base, y para cima negativo).
// Cada peça tem um retângulo de referência (para a fumacinha de serragem).
export const CABIN_PIECES = [
  ...Array.from({ length: 6 }, (_, i) => ({ kind: 'log', i, cx: 0, cy: -LOG * i - LOG / 2 })),
  ...Array.from({ length: 3 }, (_, i) => ({ kind: 'gable', i, cx: 0, cy: -WALL_H - (PEAK / 3) * (i + 0.5) })),
  { kind: 'roof', side: -1, part: 0, cx: -70, cy: -WALL_H - 12 },
  { kind: 'roof', side: 1, part: 0, cx: 70, cy: -WALL_H - 12 },
  { kind: 'roof', side: -1, part: 1, cx: -28, cy: -WALL_H - 44 },
  { kind: 'roof', side: 1, part: 1, cx: 28, cy: -WALL_H - 44 },
  { kind: 'window', cx: -56, cy: -42 },
  { kind: 'chimney', cx: (CHIMNEY.x0 + CHIMNEY.x1) / 2, cy: CHIMNEY.top + 10 },
  { kind: 'door', cx: 0, cy: -IGLOO.doorH / 2 },
];

// Topo da chaminé (de onde sai a fumaça)
export const CABIN_VENT = { x: IGLOO.x + (CHIMNEY.x0 + CHIMNEY.x1) / 2, y: IGLOO.baseY + CHIMNEY.top - 2 };

const easeOutBack = (k) => 1 + 2.9 * (k - 1) ** 3 + 1.9 * (k - 1) ** 2;

// Linha do telhado: altura y (local) do topo das tábuas para um x
const roofY = (x) => -WALL_H - PEAK + Math.abs(x) * (PEAK / (CW + EAVE * 0.2));

function drawWallLog(ctx, i) {
  const y1 = -LOG * i;
  const y0 = y1 - LOG;
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#B07A45');
  g.addColorStop(0.5, '#8A5A30');
  g.addColorStop(1, '#5E3B1C');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(-CW - 6, y0 + 0.5, CW * 2 + 12, LOG - 1, LOG / 2);
  ctx.fill();
  // Veios
  ctx.strokeStyle = 'rgba(60, 35, 15, 0.35)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-CW + 4, y0 + LOG * 0.45);
  ctx.lineTo(CW - 4, y0 + LOG * 0.5);
  ctx.stroke();
  // Pontas das toras cruzando nos cantos (anéis)
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#D9B47C';
    ctx.beginPath();
    ctx.arc(s * (CW + 6), y0 + LOG / 2, LOG / 2 - 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 80, 40, 0.6)';
    ctx.beginPath();
    ctx.arc(s * (CW + 6), y0 + LOG / 2, LOG / 4, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawGableBand(ctx, i) {
  // Faixa i (de baixo para cima) do triângulo de tábuas verticais
  const yb = -WALL_H - (PEAK / 3) * i;
  const yt = yb - PEAK / 3;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-CW, -WALL_H);
  ctx.lineTo(0, -WALL_H - PEAK);
  ctx.lineTo(CW, -WALL_H);
  ctx.closePath();
  ctx.clip();
  const g = ctx.createLinearGradient(0, yt, 0, yb);
  g.addColorStop(0, '#9C6B3C');
  g.addColorStop(1, '#7A5130');
  ctx.fillStyle = g;
  ctx.fillRect(-CW, yt - 0.5, CW * 2, yb - yt + 1);
  ctx.strokeStyle = 'rgba(50, 30, 12, 0.45)';
  ctx.lineWidth = 1;
  for (let x = -CW + 12; x < CW; x += 12) {
    ctx.beginPath();
    ctx.moveTo(x, yt);
    ctx.lineTo(x, yb);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRoofBoard(ctx, side, part) {
  // Tábua inclinada do beiral (part 0) ou da cumeeira (part 1)
  const xa = side * (part === 0 ? CW + EAVE : (CW + EAVE) / 2);
  const xb = side * (part === 0 ? (CW + EAVE) / 2 : 0);
  const ya = roofY(xa);
  const yb = roofY(xb);
  const g = ctx.createLinearGradient(0, Math.min(ya, yb), 0, Math.max(ya, yb) + ROOF_T);
  g.addColorStop(0, '#6E4426');
  g.addColorStop(1, '#4A2C16');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(xa, ya);
  ctx.lineTo(xb, yb);
  ctx.lineTo(xb, yb + ROOF_T);
  ctx.lineTo(xa, ya + ROOF_T);
  ctx.closePath();
  ctx.fill();
  // Telhas de madeira (riscos) e borda iluminada
  ctx.strokeStyle = 'rgba(30, 15, 5, 0.5)';
  ctx.lineWidth = 0.9;
  const n = 6;
  for (let k = 1; k < n; k++) {
    const x = xa + ((xb - xa) * k) / n;
    const y = ya + ((yb - ya) * k) / n;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + ROOF_T);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(200, 150, 100, 0.6)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(xa, ya);
  ctx.lineTo(xb, yb);
  ctx.stroke();
}

function drawWindow(ctx, lit, t) {
  const x = -70;
  const y = -56;
  const w = 28;
  const h = 26;
  ctx.fillStyle = '#4A2C16';
  ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  if (lit) {
    const k = 0.85 + Math.sin(t * 5) * 0.08;
    ctx.fillStyle = `rgba(255, 196, 110, ${k})`;
  } else {
    ctx.fillStyle = '#26323A';
  }
  ctx.fillRect(x, y, w, h);
  if (!lit) {
    ctx.fillStyle = 'rgba(180, 210, 230, 0.35)';
    ctx.beginPath();
    ctx.moveTo(x + 3, y + h - 3);
    ctx.lineTo(x + 12, y + 3);
    ctx.lineTo(x + 16, y + 3);
    ctx.lineTo(x + 7, y + h - 3);
    ctx.fill();
  }
  ctx.fillStyle = '#4A2C16';
  ctx.fillRect(x + w / 2 - 1.5, y, 3, h);
  ctx.fillRect(x, y + h / 2 - 1.5, w, 3);
  // Floreira com flores
  ctx.fillStyle = '#6E4426';
  ctx.fillRect(x - 4, y + h + 3, w + 8, 5);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = ['#E5484D', '#F7D25C', '#E9A6D8'][i % 3];
    ctx.beginPath();
    ctx.arc(x + 2 + i * 6, y + h + 2, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawChimney(ctx) {
  const { x0, x1, top } = CHIMNEY;
  const bottom = roofY(x0) + 4;
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, '#9A8F84');
  g.addColorStop(1, '#6C635B');
  ctx.fillStyle = g;
  ctx.fillRect(x0, top, x1 - x0, bottom - top);
  ctx.strokeStyle = 'rgba(40, 35, 30, 0.45)';
  ctx.lineWidth = 0.9;
  for (let y = top + 6; y < bottom; y += 6) {
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
  }
  ctx.fillStyle = '#5A524B';
  ctx.fillRect(x0 - 2, top - 3, x1 - x0 + 4, 4);
}

// Abertura e batente da porta (coordenadas do mundo)
function doorRect() {
  const d = CABIN_DOOR;
  return { x: d.x - d.w, y: d.bottom - d.h, w: d.w * 2, h: d.h };
}

function drawDoorFrame(ctx) {
  const r = doorRect();
  ctx.fillStyle = '#4A2C16';
  ctx.fillRect(r.x - 6, r.y - 7, 6, r.h + 7);
  ctx.fillRect(r.x + r.w, r.y - 7, 6, r.h + 7);
  ctx.fillRect(r.x - 9, r.y - 9, r.w + 18, 7);
  ctx.fillStyle = 'rgba(200, 150, 100, 0.5)';
  ctx.fillRect(r.x - 9, r.y - 9, r.w + 18, 1.5);
}

// Porta de tábuas: k = 0 aberta (encostada na parede), 1 fechada
function drawDoorLeaf(ctx, k) {
  if (k <= 0) return;
  const r = doorRect();
  const w = r.w * k;
  ctx.save();
  const g = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
  g.addColorStop(0, '#8A5A30');
  g.addColorStop(1, '#6A4122');
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, w, r.h);
  ctx.strokeStyle = 'rgba(40, 22, 8, 0.55)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(r.x + (w * i) / 4, r.y);
    ctx.lineTo(r.x + (w * i) / 4, r.y + r.h);
    ctx.stroke();
  }
  // Travessas em Z e maçaneta
  ctx.fillStyle = '#5A361A';
  ctx.fillRect(r.x, r.y + 10, w, 5);
  ctx.fillRect(r.x, r.y + r.h - 16, w, 5);
  if (k > 0.8) {
    ctx.fillStyle = '#D9B048';
    ctx.beginPath();
    ctx.arc(r.x + w - 7, r.y + r.h / 2 + 4, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Desenha a cabana com as peças já construídas (igloo = estado da construção)
export function drawCabin(ctx, igloo, t) {
  const n = igloo.count;
  ctx.save();
  ctx.translate(IGLOO.x, IGLOO.baseY);
  // Sombra no chão
  ctx.fillStyle = 'rgba(30, 50, 20, 0.28)';
  ctx.beginPath();
  ctx.ellipse(6, 3, CW + 22, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  // Contorno-guia do que falta construir
  if (n < RULES.iglooPieces) {
    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = 'rgba(60, 40, 20, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-CW, 0);
    ctx.lineTo(-CW, -WALL_H);
    ctx.lineTo(-CW - EAVE, roofY(-CW - EAVE) + ROOF_T);
    ctx.lineTo(0, -WALL_H - PEAK);
    ctx.lineTo(CW + EAVE, roofY(CW + EAVE) + ROOF_T);
    ctx.lineTo(CW, -WALL_H);
    ctx.lineTo(CW, 0);
    ctx.stroke();
    ctx.restore();
  }
  // Ordem de desenho: chaminé atrás do telhado; janela por cima das toras
  const chimney = CABIN_PIECES.findIndex((p) => p.kind === 'chimney');
  const order = [chimney, ...CABIN_PIECES.map((_, i) => i).filter((i) => i !== chimney && CABIN_PIECES[i].kind !== 'door')];
  for (const i of order) {
    if (i >= n) continue;
    const a = igloo.anim[i];
    ctx.save();
    ctx.globalAlpha = Math.min(1, a * 3);
    ctx.translate(0, -(1 - easeOutBack(a)) * 46);
    const p = CABIN_PIECES[i];
    if (p.kind === 'log') drawWallLog(ctx, p.i);
    else if (p.kind === 'gable') drawGableBand(ctx, p.i);
    else if (p.kind === 'roof') drawRoofBoard(ctx, p.side, p.part);
    else if (p.kind === 'window') drawWindow(ctx, igloo.lit, t);
    else if (p.kind === 'chimney') drawChimney(ctx);
    ctx.restore();
  }
  ctx.restore();

  // Porta (peça 16): abertura escura, luz quando acesa, folha e batente
  const r = doorRect();
  if (n < RULES.iglooPieces) {
    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = 'rgba(60, 40, 20, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(r.x - 6, r.y - 9, r.w + 12, r.h + 9);
    ctx.restore();
    return;
  }
  const a = igloo.anim[RULES.iglooPieces - 1];
  ctx.save();
  ctx.globalAlpha = Math.min(1, a * 3);
  ctx.translate(0, -(1 - easeOutBack(a)) * 30);
  const dg = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  dg.addColorStop(0, '#1A120B');
  dg.addColorStop(1, '#33261A');
  ctx.fillStyle = dg;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  if (igloo.lit) {
    const k = 0.55 + Math.sin(t * 5) * 0.08;
    ctx.fillStyle = `rgba(255, 200, 120, ${k})`;
    ctx.fillRect(r.x + 2, r.y + 2, r.w - 4, r.h - 2);
  }
  drawDoorLeaf(ctx, igloo.curtain);
  if (igloo.lit && igloo.curtain >= 1) {
    // Luz quente escapando pelas frestas da porta fechada
    ctx.save();
    ctx.shadowColor = 'rgba(255, 190, 100, 0.9)';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = `rgba(255, 200, 120, ${0.6 + Math.sin(t * 5) * 0.12})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 1);
    ctx.restore();
  }
  drawDoorFrame(ctx);
  ctx.restore();
}

// Desenhado POR CIMA do personagem enquanto ele entra: sombra do interior,
// a porta fechando e o batente.
export function drawCabinDoorFront(ctx, igloo, t) {
  if (igloo.count < RULES.iglooPieces) return;
  const r = doorRect();
  ctx.save();
  if (igloo.shade > 0) {
    ctx.fillStyle = `rgba(20, 12, 6, ${0.4 * igloo.shade})`;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  drawDoorLeaf(ctx, igloo.curtain);
  drawDoorFrame(ctx);
  ctx.restore();
}

// ---------------------------------------------------------------- Folhas caindo
const LEAF_COLORS = ['#D9822B', '#C4462A', '#E3B23C', '#7FA33A', '#A65A2A'];

export function drawLeaves(ctx, flakes, t) {
  ctx.save();
  for (const [i, s] of flakes.entries()) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.sway * 1.7 + i);
    ctx.scale(1, 0.55 + 0.45 * Math.sin(t * 3 + i));
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = LEAF_COLORS[i % LEAF_COLORS.length];
    const r = 1.6 + s.r * 1.3;
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.quadraticCurveTo(0, -r * 0.9, r, 0);
    ctx.quadraticCurveTo(0, r * 0.9, -r, 0);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// Vagalumes piscando perto da mata quando o céu escurece
export function drawFireflies(ctx, t, dusk) {
  if (dusk < 0.25) return;
  ctx.save();
  for (let i = 0; i < 14; i++) {
    const x = (i * 97 + Math.sin(t * 0.4 + i) * 40 + W) % W;
    const y = SHORE_TOP - 20 + Math.sin(t * 0.7 + i * 2) * 18 + (i % 4) * 8;
    const a = Math.max(0, Math.sin(t * 2 + i * 1.7)) * Math.min(1, (dusk - 0.25) * 2);
    if (a < 0.05) continue;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 7);
    g.addColorStop(0, `rgba(230, 255, 140, ${a})`);
    g.addColorStop(1, 'rgba(230, 255, 140, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 7, y - 7, 14, 14);
  }
  ctx.restore();
}
