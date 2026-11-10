// Fase especial do espaço (fase 15): superfície da lua com crateras, céu
// estrelado com a Terra, rio de poeira estelar com asteroides no lugar das placas,
// base lunar no lugar do iglu, discos voadores, bichinhos lunares e cometas,
// estrelinhas douradas no lugar dos peixes e um alienígena no lugar do urso.
// Só o visual muda: as regras, a colisão e a dificuldade são as mesmas.
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

// Cores do rio de poeira estelar (o renderer usa no lugar da água gelada)
export const DUST = {
  water: ['#4A3488', '#251A55', '#0B0822'],
  ripple: [215, 195, 255],
  bank: 'rgba(8, 4, 24, 0.5)',
  halo: [110, 240, 255],  // brilho dos asteroides "acesos"
  regolith: '#C4C1CF',    // poeira lunar (encaixe das peças da base, pouso na costa)
  rock: '#9A96A8',        // lascas de rocha ao pousar num asteroide
  spark: '#9FF3FF',       // brilhos da fileira acesa
};

// ---------------------------------------------------------------- Céu
// Estrelas fixas (posição, tamanho e fase do pisca-pisca)
const STARS = (() => {
  const rnd = seeded(23);
  return Array.from({ length: 150 }, () => ({
    x: rnd() * W, y: rnd() * (SHORE_TOP - 10), r: 0.5 + rnd() * 1.3, ph: rnd() * TAU, sp: 0.8 + rnd() * 2.5,
  }));
})();

// Posição da Terra no céu: desce devagar conforme a temperatura cai (como o sol)
export function earthPos(skyF) {
  return { x: 300, y: 64 + (1 - Math.max(0, Math.min(1, skyF))) * 100, r: 26 };
}

export const EARTH_OCEAN = '#2F7BD8';

export function drawSpaceSky(ctx, t, skyF) {
  const g = ctx.createLinearGradient(0, 0, 0, SHORE_TOP);
  g.addColorStop(0, '#03021A');
  g.addColorStop(0.7, '#130D3A');
  g.addColorStop(1, '#2A1E5C');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, SHORE_TOP + 30);

  // Nebulosas (manchas suaves de cor)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [x, y, r, c] of [[860, 70, 190, '150, 70, 200'], [1040, 40, 140, '40, 150, 200'], [560, 120, 120, '200, 80, 150']]) {
    const n = ctx.createRadialGradient(x, y, 4, x, y, r);
    n.addColorStop(0, `rgba(${c}, 0.22)`);
    n.addColorStop(1, `rgba(${c}, 0)`);
    ctx.fillStyle = n;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();

  // Estrelas piscando
  ctx.fillStyle = '#FFFFFF';
  for (const s of STARS) {
    ctx.globalAlpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph));
    ctx.fillRect(s.x - s.r / 2, s.y - s.r / 2, s.r, s.r);
  }
  ctx.globalAlpha = 1;

  drawShootingStar(ctx, t);
  drawEarth(ctx, t, earthPos(skyF));
}

// Estrela cadente cruzando o céu a cada poucos segundos (sem estado: depende só do tempo)
function drawShootingStar(ctx, t) {
  const period = 5.5;
  const n = Math.floor(t / period);
  const k = (t - n * period) / 0.9; // dura 0,9 s
  if (k > 1) return;
  const rnd = seeded(n + 3);
  const x0 = 500 + rnd() * 700;
  const y0 = 10 + rnd() * 60;
  const x = x0 - k * 260;
  const y = y0 + k * 90;
  const a = Math.sin(k * Math.PI);
  const g = ctx.createLinearGradient(x, y, x + 70, y - 24);
  g.addColorStop(0, `rgba(255, 255, 255, ${a})`);
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.strokeStyle = g;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 70, y - 24);
  ctx.stroke();
}

function drawEarth(ctx, t, { x, y, r }) {
  // Halo azul da atmosfera
  const halo = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 2.2);
  halo.addColorStop(0, 'rgba(110, 180, 255, 0.4)');
  halo.addColorStop(1, 'rgba(110, 180, 255, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.clip();
  ctx.fillStyle = EARTH_OCEAN;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  // Continentes girando devagar
  ctx.fillStyle = '#4FA35A';
  const rot = (t * 3) % (r * 4);
  for (const [cx, cy, rx, ry] of [[-14, -8, 10, 7], [6, 6, 8, 11], [20, -12, 7, 5], [-30, 10, 9, 6]]) {
    for (const off of [0, r * 4]) {
      ctx.beginPath();
      ctx.ellipse(x + cx + rot - off, y + cy, rx, ry, 0.3, 0, TAU);
      ctx.fill();
    }
  }
  // Nuvens
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  for (const [cx, cy, l] of [[-10, -18, 16], [4, -2, 20], [-18, 14, 14]]) {
    ctx.beginPath();
    ctx.moveTo(x + cx, y + cy);
    ctx.lineTo(x + cx + l, y + cy - 2);
    ctx.stroke();
  }
  // Lado da noite
  const sh = ctx.createLinearGradient(x - r, 0, x + r, 0);
  sh.addColorStop(0, 'rgba(2, 4, 20, 0)');
  sh.addColorStop(0.55, 'rgba(2, 4, 20, 0.1)');
  sh.addColorStop(1, 'rgba(2, 4, 20, 0.75)');
  ctx.fillStyle = sh;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

// ---------------------------------------------------------------- Fundo
// Montanhas lunares ao longe, chão cinza com crateras e o barranco de rocha
// entrando no rio de poeira estelar. O céu é desenhado por baixo a cada quadro.
export function makeSpaceBackground() {
  const h = WATER_TOP + 12;
  const { c, g } = offscreen(W, h);
  const rnd = seeded(31);

  // Cordilheiras lunares recortadas
  const ridge = (baseY, amp, step, color, lit) => {
    const pts = [];
    for (let x = -40; x <= W + 40; x += step * (0.5 + rnd())) pts.push([x, baseY - rnd() * amp]);
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(-40, SHORE_TOP + 20);
    for (const [x, y] of pts) g.lineTo(x, y);
    g.lineTo(W + 40, SHORE_TOP + 20);
    g.fill();
    // Face iluminada de cada pico (luz vindo da esquerda)
    g.fillStyle = lit;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      if (y1 > y0) continue;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.lineTo(x1 - 4, SHORE_TOP + 20);
      g.lineTo(x0 + (x1 - x0) * 0.3, SHORE_TOP + 20);
      g.fill();
    }
  };
  ridge(150, 46, 70, '#4B4862', 'rgba(150, 145, 175, 0.35)');
  ridge(176, 34, 55, '#6E6A84', 'rgba(190, 185, 210, 0.35)');

  // Chão lunar
  let grd = g.createLinearGradient(0, SHORE_TOP, 0, WATER_TOP);
  grd.addColorStop(0, '#B9B6C6');
  grd.addColorStop(0.6, '#A29FB2');
  grd.addColorStop(1, '#8A8799');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(0, WATER_TOP);
  for (let x = 0; x <= W; x += 20) g.lineTo(x, SHORE_TOP + Math.sin(x * 0.011) * 4 + Math.sin(x * 0.047) * 1.5);
  g.lineTo(W, WATER_TOP);
  g.fill();

  // Crateras: borda clara em cima, sombra dentro
  for (let i = 0; i < 18; i++) {
    const x = rnd() * W;
    if (Math.abs(x - IGLOO.x) < 170) continue; // não ficam embaixo da base
    const y = SHORE_TOP + 16 + rnd() * 48;
    const rx = 10 + rnd() * 26;
    const ry = rx * 0.28;
    g.fillStyle = 'rgba(70, 66, 88, 0.5)';
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(120, 116, 138, 0.8)';
    g.beginPath();
    g.ellipse(x + rx * 0.12, y + ry * 0.2, rx * 0.8, ry * 0.7, 0, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(235, 232, 245, 0.7)';
    g.lineWidth = 1.4;
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, Math.PI, TAU);
    g.stroke();
  }
  // Pedrinhas e pegadas de poeira
  for (let i = 0; i < 220; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(235, 232, 245, 0.6)' : 'rgba(70, 66, 88, 0.45)';
    g.fillRect(rnd() * W, SHORE_TOP + 6 + rnd() * 66, 1.4, 1.2);
  }

  // Barranco de rocha entrando no rio
  const edgeTop = WATER_TOP - 14;
  grd = g.createLinearGradient(0, edgeTop, 0, WATER_TOP + 12);
  grd.addColorStop(0, '#9D9AAE');
  grd.addColorStop(0.45, '#625E78');
  grd.addColorStop(1, '#2A2442');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(0, edgeTop + 2);
  for (let x = 0; x <= W; x += 14) g.lineTo(x, edgeTop + Math.sin(x * 0.11) * 1.8);
  g.lineTo(W, WATER_TOP + 12);
  g.lineTo(0, WATER_TOP + 12);
  g.fill();
  for (let x = 0; x < W; x += 16 + rnd() * 36) {
    g.fillStyle = rnd() < 0.5 ? '#7C7892' : '#57536C';
    g.beginPath();
    g.ellipse(x, edgeTop + 8 + rnd() * 12, 4 + rnd() * 6, 3 + rnd() * 3, 0, 0, TAU);
    g.fill();
  }
  g.fillStyle = 'rgba(225, 222, 238, 0.85)';
  g.fillRect(0, edgeTop - 1, W, 2);

  return { canvas: c, w: W, h };
}

// ---------------------------------------------------------------- Enfeites da costa
// Módulo de pouso e bandeira à esquerda, longe da base
export const SPACE_DECOR = { lander: { x: 110, base: 240 }, flag: { x: 214, base: 244 } };

export function drawSpaceDecor(ctx, t) {
  const { lander, flag } = SPACE_DECOR;
  ctx.save();
  ctx.translate(lander.x, lander.base);
  ctx.fillStyle = 'rgba(30, 25, 50, 0.3)';
  ctx.beginPath();
  ctx.ellipse(4, 2, 58, 6, 0, 0, TAU);
  ctx.fill();
  // Pernas com sapatas
  ctx.strokeStyle = '#B9BCC6';
  ctx.lineWidth = 3;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 24, -34);
    ctx.lineTo(s * 46, -2);
    ctx.moveTo(s * 18, -26);
    ctx.lineTo(s * 40, -12);
    ctx.stroke();
    ctx.fillStyle = '#C9CCD6';
    ctx.beginPath();
    ctx.ellipse(s * 46, -1, 8, 2.5, 0, 0, TAU);
    ctx.fill();
  }
  // Estágio de descida com folha dourada
  const gold = ctx.createLinearGradient(-30, 0, 30, 0);
  gold.addColorStop(0, '#F4D06A');
  gold.addColorStop(0.5, '#D9A23A');
  gold.addColorStop(1, '#94661E');
  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.moveTo(-30, -48);
  ctx.lineTo(30, -48);
  ctx.lineTo(26, -22);
  ctx.lineTo(-26, -22);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(120, 80, 20, 0.5)';
  ctx.lineWidth = 0.8;
  for (const [x0, y0, x1, y1] of [[-18, -46, -14, -24], [4, -47, 8, -23], [18, -46, 15, -30]]) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  // Cabine branca com janela triangular e antena
  ctx.fillStyle = '#DADDE6';
  ctx.beginPath();
  ctx.moveTo(-24, -48);
  ctx.lineTo(-18, -78);
  ctx.lineTo(16, -80);
  ctx.lineTo(24, -48);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#9EA2B0';
  ctx.fillRect(-24, -52, 48, 4);
  ctx.fillStyle = '#1E2A4A';
  ctx.beginPath();
  ctx.moveTo(-10, -60);
  ctx.lineTo(-4, -72);
  ctx.lineTo(4, -60);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#B9BCC6';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(10, -80);
  ctx.lineTo(14, -96);
  ctx.stroke();
  ctx.fillStyle = Math.sin(t * 4) > 0 ? '#FF5A4A' : '#7A2A24';
  ctx.beginPath();
  ctx.arc(14, -97, 2.4, 0, TAU);
  ctx.fill();
  ctx.restore();

  // Bandeira com uma estrela (pano esticado por uma haste, já que não há vento)
  ctx.save();
  ctx.translate(flag.x, flag.base);
  ctx.strokeStyle = '#D8DBE4';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -64);
  ctx.lineTo(34, -64);
  ctx.stroke();
  ctx.fillStyle = '#2C6FD6';
  ctx.beginPath();
  ctx.moveTo(1, -63);
  ctx.lineTo(34, -63);
  ctx.quadraticCurveTo(30, -52, 34, -42);
  ctx.lineTo(1, -42);
  ctx.closePath();
  ctx.fill();
  starPath(ctx, 17, -52.5, 6.5, 2.8);
  ctx.fillStyle = '#FFD84A';
  ctx.fill();
  ctx.restore();
}

function starPath(ctx, x, y, R, r, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot - Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r : R;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
}

// ---------------------------------------------------------------- Asteroides
// Rocha boiando na poeira estelar. Os pés pisam na linha y = 0 do sprite.
// Aceso (fileira pisada): veios de cristal azul-ciano brilhando.
const ROCK_PAD = 12;
const ROCK_TOP = 22;
const ROCK_H = 66;

export function asteroidSprite(piece, active) {
  const key = active ? 'rockOn' : 'rockOff';
  if (piece.sprites[key]) return piece.sprites[key];
  const w = piece.w;
  const { c, g } = offscreen(w + ROCK_PAD * 2, ROCK_H);
  g.translate(ROCK_PAD, ROCK_TOP);
  const rnd = seeded(piece.seed + 13);
  const top = -6;
  const bottom = 18;

  // Brilho da poeira em volta da parte submersa
  g.fillStyle = 'rgba(180, 150, 255, 0.25)';
  g.beginPath();
  g.ellipse(w / 2, bottom + 2, w / 2 + 6, 6, 0, 0, TAU);
  g.fill();

  // Contorno irregular: topo quase plano (para pisar), lados e base em calombos
  const outline = [];
  const n = Math.max(6, Math.round(w / 10));
  for (let i = 0; i <= n; i++) outline.push([(w * i) / n, top + (i === 0 || i === n ? 3 : rnd() * 2)]);
  outline.push([w + 4, top + 9 + rnd() * 3]);
  outline.push([w + 2, bottom - 2]);
  for (let i = n; i >= 0; i--) outline.push([(w * i) / n + (rnd() - 0.5) * 4, bottom + rnd() * 4]);
  outline.push([-2, bottom - 3]);
  outline.push([-4, top + 8 + rnd() * 3]);
  const shape = () => {
    g.beginPath();
    outline.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
  };
  let grd = g.createLinearGradient(0, top, 0, bottom + 4);
  if (active) {
    grd.addColorStop(0, '#C9F6FF');
    grd.addColorStop(0.35, '#8A92B8');
    grd.addColorStop(1, '#3E3A62');
  } else {
    grd.addColorStop(0, '#A9A5BA');
    grd.addColorStop(0.35, '#7A7690');
    grd.addColorStop(1, '#35304E');
  }
  g.fillStyle = grd;
  shape();
  g.fill();

  g.save();
  shape();
  g.clip();
  // Crateras na rocha
  for (let i = 0; i < Math.max(2, Math.round(w / 26)); i++) {
    const cx = 6 + rnd() * (w - 12);
    const cy = top + 6 + rnd() * 9;
    const r = 2.5 + rnd() * 3.5;
    g.fillStyle = 'rgba(40, 34, 64, 0.45)';
    g.beginPath();
    g.ellipse(cx, cy, r, r * 0.6, 0, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(230, 228, 245, 0.45)';
    g.lineWidth = 0.8;
    g.beginPath();
    g.ellipse(cx, cy, r, r * 0.6, 0, Math.PI, TAU);
    g.stroke();
  }
  if (active) {
    // Veios de cristal brilhando
    g.strokeStyle = 'rgba(120, 245, 255, 0.85)';
    g.lineWidth = 1.4;
    for (let i = 0; i < Math.max(2, Math.round(w / 30)); i++) {
      let x = 4 + rnd() * (w - 8);
      let y = top + 2;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += (rnd() - 0.5) * 10;
        y += 4 + rnd() * 2;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  }
  // Borda de cima iluminada
  g.fillStyle = active ? 'rgba(220, 255, 255, 0.8)' : 'rgba(235, 232, 250, 0.45)';
  g.fillRect(0, top + 1.5, w, 1.6);
  g.restore();

  // Linha da poeira estelar
  g.fillStyle = 'rgba(225, 210, 255, 0.45)';
  g.fillRect(-3, bottom - 5, w + 7, 1.4);
  // Cristais pontudos saindo do topo (acesos)
  if (active) {
    for (const fx of [0.22, 0.7]) {
      const x = w * fx;
      g.fillStyle = '#7FF0FF';
      g.beginPath();
      g.moveTo(x - 3, top + 2);
      g.lineTo(x, top - 6);
      g.lineTo(x + 3, top + 2);
      g.closePath();
      g.fill();
    }
  }

  const sprite = { canvas: c, ox: ROCK_PAD, oy: ROCK_TOP, w: w + ROCK_PAD * 2, h: ROCK_H };
  piece.sprites[key] = sprite;
  return sprite;
}

// ---------------------------------------------------------------- Bichos
// Desenhados em relação à linha da fileira (y = onde os pés do jogador pisam).

// Disco voador baixinho, com um tripulante na cúpula e luzes girando
export function drawUfo(ctx, c, y, t) {
  const by = y - 30 + Math.sin(t * 3 + c.ph) * 4;
  // Facho de luz até a fileira
  const beam = ctx.createLinearGradient(0, by, 0, y + 14);
  beam.addColorStop(0, 'rgba(160, 255, 200, 0.28)');
  beam.addColorStop(1, 'rgba(160, 255, 200, 0)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(c.x - 8, by + 4);
  ctx.lineTo(c.x + 8, by + 4);
  ctx.lineTo(c.x + 20, y + 14);
  ctx.lineTo(c.x - 20, y + 14);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.translate(c.x, by);
  ctx.scale(c.dir, 1);
  ctx.rotate(Math.sin(t * 2 + c.ph) * 0.06);
  // Cúpula de vidro com o tripulante
  ctx.fillStyle = 'rgba(150, 220, 255, 0.55)';
  ctx.beginPath();
  ctx.ellipse(0, -5, 10, 9, 0, Math.PI, TAU);
  ctx.fill();
  ctx.fillStyle = '#7ED957';
  ctx.beginPath();
  ctx.arc(1, -6, 4.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.ellipse(3, -6.5, 1.3, 1.8, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(-6, -11, 3, 1.5);
  // Disco metálico
  const g = ctx.createLinearGradient(0, -6, 0, 6);
  g.addColorStop(0, '#E6E9F0');
  g.addColorStop(0.5, '#9AA0B2');
  g.addColorStop(1, '#5C6176');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 22, 6.5, 0, 0, TAU);
  ctx.fill();
  // Luzes girando na borda
  for (let i = 0; i < 6; i++) {
    const a = t * 4 + c.ph + (i * TAU) / 6;
    if (Math.sin(a) < 0) continue;
    ctx.fillStyle = ['#FF5A6A', '#FFE45C', '#5AF0FF'][i % 3];
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 17, 1.5 + Math.sin(a) * 2, 1.8, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// Bichinho lunar: corpo roxo de seis patinhas, um olho na antena
export function drawCrawler(ctx, c, y, t) {
  const by = y - 2;
  const walk = Math.sin(t * 16 + c.ph);
  ctx.fillStyle = 'rgba(10, 5, 30, 0.3)';
  ctx.beginPath();
  ctx.ellipse(c.x, y + 2, 18, 3, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(c.x, by);
  ctx.scale(c.dir, 1);
  // Patinhas
  ctx.strokeStyle = '#5B2E8C';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const lx = -10 + i * 10;
    const k = (i % 2 ? walk : -walk) * 3;
    ctx.beginPath();
    ctx.moveTo(lx, -6);
    ctx.lineTo(lx - 4 + k, 0);
    ctx.moveTo(lx + 2, -6);
    ctx.lineTo(lx + 6 - k, 0);
    ctx.stroke();
  }
  // Corpo com pintas
  const g = ctx.createLinearGradient(0, -20, 0, -4);
  g.addColorStop(0, '#C58BFF');
  g.addColorStop(1, '#7A3FC0');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, -10, 17, 9, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 228, 92, 0.85)';
  for (const [sx, sy] of [[-8, -13], [-1, -16], [6, -12]]) {
    ctx.beginPath();
    ctx.arc(sx, sy, 1.8, 0, TAU);
    ctx.fill();
  }
  // Antena com o olho, balançando
  const sway = Math.sin(t * 5 + c.ph) * 2;
  ctx.strokeStyle = '#7A3FC0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(11, -15);
  ctx.quadraticCurveTo(15, -22, 14 + sway, -28);
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(14 + sway, -29, 4.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1B0F2E';
  ctx.beginPath();
  ctx.arc(15.5 + sway, -29, 2, 0, TAU);
  ctx.fill();
  // Boquinha
  ctx.strokeStyle = '#3A1666';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(13, -8, 3, 0.2, Math.PI - 0.6);
  ctx.stroke();
  ctx.restore();
}

// Cometinha deslizando rente à poeira, com a cauda brilhante para trás
export function drawComet(ctx, c, y, t) {
  const hop = Math.max(0, Math.sin(t * 3 + c.ph)) * 10;
  const cy = y + 2 - hop;
  ctx.save();
  ctx.translate(c.x, cy);
  ctx.scale(c.dir, 1);
  ctx.globalCompositeOperation = 'lighter';
  // Cauda em camadas tremulando
  for (const [len, wd, col] of [[46, 9, '120, 200, 255'], [32, 6, '200, 240, 255']]) {
    const L = len + Math.sin(t * 12 + c.ph) * 4;
    const g = ctx.createLinearGradient(0, 0, -L, 0);
    g.addColorStop(0, `rgba(${col}, 0.75)`);
    g.addColorStop(1, `rgba(${col}, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(2, -wd);
    ctx.quadraticCurveTo(-L * 0.5, -wd * 0.6, -L, 0);
    ctx.quadraticCurveTo(-L * 0.5, wd * 0.6, 2, wd);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  // Núcleo de gelo e rocha
  const g = ctx.createRadialGradient(-2, -3, 1, 0, 0, 10);
  g.addColorStop(0, '#FFFFFF');
  g.addColorStop(0.5, '#BFE6FF');
  g.addColorStop(1, '#5B7FB0');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, TAU);
  ctx.fill();
  // Carinha brava
  ctx.fillStyle = '#1A2440';
  ctx.beginPath();
  ctx.arc(3, -2, 1.5, 0, TAU);
  ctx.arc(7, -1.5, 1.3, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#1A2440';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(1, -5);
  ctx.lineTo(4.5, -4);
  ctx.moveTo(8.5, -4.5);
  ctx.lineTo(6, -3.6);
  ctx.moveTo(3, 3);
  ctx.lineTo(7, 2.6);
  ctx.stroke();
  ctx.restore();
  // Poeira levantada
  if (hop < 3) {
    ctx.fillStyle = 'rgba(225, 210, 255, 0.6)';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(c.x - c.dir * (10 + i * 7), y + 8 - i, 1.6, 0, TAU);
      ctx.fill();
    }
  }
}

// Estrelinha dourada boiando (vale os pontos do peixe)
export const STAR_GOLD = '#FFD84A';
export function drawStarBonus(ctx, c, y, t) {
  const by = y - 8 + Math.sin(t * 4 + c.ph) * 3;
  const glow = ctx.createRadialGradient(c.x, by, 2, c.x, by, 22);
  glow.addColorStop(0, 'rgba(255, 220, 90, 0.55)');
  glow.addColorStop(1, 'rgba(255, 220, 90, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(c.x - 22, by - 22, 44, 44);
  ctx.save();
  ctx.translate(c.x, by);
  ctx.scale(Math.cos(t * 3 + c.ph) * 0.35 + 0.75, 1); // girando
  starPath(ctx, 0, 0, 12, 5.2);
  ctx.fillStyle = STAR_GOLD;
  ctx.fill();
  ctx.strokeStyle = '#C98A10';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.beginPath();
  ctx.arc(-3, -4, 2, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- Alienígena
// Bichão verde de quatro patas no lugar do urso: corpo de lesma com espinhos
// brilhando nas costas, cabeça grande com três olhos e antenas luminosas.
export const ALIEN = {
  body: ['#B4F06A', '#6CC13E', '#2F6E22'],
  legBack: '#3F8A2A', legFront: '#5BAE36', spot: '#7B4BC8', glow: '#FFE45C',
};

export function drawAlien(ctx, b, t) {
  const A = ALIEN;
  const sw = Math.sin(b.walk * 3);
  const br = Math.sin(t * 2) * 1;
  const hy = Math.sin(b.walk * 6) * 1.5;
  ctx.fillStyle = 'rgba(20, 10, 40, 0.3)';
  ctx.beginPath();
  ctx.ellipse(b.x, b.y + 3, 58, 7, 0, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.scale(b.dir, 1);
  ctx.translate(-16, 0);

  const leg = (lx, phase, back) => {
    ctx.save();
    ctx.translate(lx, -26);
    ctx.rotate(phase * 0.4);
    ctx.fillStyle = back ? A.legBack : A.legFront;
    ctx.beginPath();
    ctx.roundRect(-6, 0, 12, 24, 6);
    ctx.fill();
    // Pé de ventosa
    ctx.fillStyle = back ? '#2C6620' : '#3F8A2A';
    ctx.beginPath();
    ctx.ellipse(1, 25, 10, 4, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  };
  leg(-30, -sw, true);
  leg(24, sw, true);

  // Espinhos brilhando nas costas
  for (let i = 0; i < 5; i++) {
    const x = -34 + i * 14;
    const top = -66 - Math.sin(i * 1.3) * 4 + br;
    const pulse = 0.6 + 0.4 * Math.sin(t * 5 + i);
    ctx.fillStyle = `rgba(200, 120, 255, ${pulse})`;
    ctx.beginPath();
    ctx.moveTo(x - 5, -54 + br);
    ctx.lineTo(x, top);
    ctx.lineTo(x + 5, -54 + br);
    ctx.closePath();
    ctx.fill();
  }

  // Corpo
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(-48, -26);
    ctx.quadraticCurveTo(-52, -58, -24, -60 + br);
    ctx.quadraticCurveTo(10, -64 + br, 32, -54);
    ctx.quadraticCurveTo(44, -46, 42, -26);
    ctx.quadraticCurveTo(0, -12, -40, -16);
    ctx.closePath();
  };
  let g = ctx.createLinearGradient(0, -64, 0, -12);
  g.addColorStop(0, A.body[0]);
  g.addColorStop(0.55, A.body[1]);
  g.addColorStop(1, A.body[2]);
  ctx.fillStyle = g;
  body();
  ctx.fill();
  ctx.save();
  body();
  ctx.clip();
  ctx.fillStyle = A.spot;
  for (const [sx, sy, r] of [[-30, -44, 5], [-12, -50, 4], [8, -42, 6], [-20, -30, 3.5], [24, -46, 3.5]]) {
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255, 255, 220, 0.25)';
  ctx.beginPath();
  ctx.ellipse(-4, -18, 40, 6, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  // Rabinho em espiral
  ctx.strokeStyle = A.body[1];
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-46, -36);
  ctx.quadraticCurveTo(-60, -40, -58, -50 + Math.sin(t * 3) * 3);
  ctx.stroke();

  // Pescoço e cabeça grande
  ctx.fillStyle = A.body[1];
  ctx.beginPath();
  ctx.moveTo(26, -54);
  ctx.quadraticCurveTo(44, -60 + hy, 52, -48 + hy);
  ctx.lineTo(46, -30);
  ctx.quadraticCurveTo(36, -28, 30, -32);
  ctx.closePath();
  ctx.fill();
  g = ctx.createRadialGradient(54, -54 + hy, 3, 58, -46 + hy, 20);
  g.addColorStop(0, A.body[0]);
  g.addColorStop(1, A.body[1]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(58, -46 + hy, 18, 15, 0.1, 0, TAU);
  ctx.fill();

  // Antenas com bolinhas luminosas
  const wob = Math.sin(t * 6) * 2;
  ctx.strokeStyle = A.body[2];
  ctx.lineWidth = 2;
  for (const [x0, x1] of [[52, 44], [60, 66]]) {
    ctx.beginPath();
    ctx.moveTo(x0, -58 + hy);
    ctx.quadraticCurveTo(x0, -72 + hy, x1 + wob, -78 + hy);
    ctx.stroke();
    const glow = ctx.createRadialGradient(x1 + wob, -79 + hy, 0, x1 + wob, -79 + hy, 8);
    glow.addColorStop(0, 'rgba(255, 228, 92, 0.9)');
    glow.addColorStop(1, 'rgba(255, 228, 92, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x1 + wob - 8, -87 + hy, 16, 16);
    ctx.fillStyle = A.glow;
    ctx.beginPath();
    ctx.arc(x1 + wob, -79 + hy, 3, 0, TAU);
    ctx.fill();
  }

  // Três olhos (o do meio maior)
  for (const [ex, ey, r] of [[56, -52, 4], [64, -54, 5.5], [72, -50, 3.6]]) {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(ex, ey + hy, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = b.chasing ? '#D0202A' : '#1B0F2E';
    ctx.beginPath();
    ctx.arc(ex + r * 0.3, ey + hy, r * 0.5, 0, TAU);
    ctx.fill();
  }
  if (b.chasing) {
    // Bocão aberto com dentinhos
    ctx.fillStyle = '#3A0E2E';
    ctx.beginPath();
    ctx.ellipse(66, -38 + hy, 9, 4 + Math.abs(Math.sin(t * 12)) * 2.5, 0.1, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    for (const tx of [60, 64, 68, 72]) {
      ctx.beginPath();
      ctx.moveTo(tx, -41.5 + hy);
      ctx.lineTo(tx + 1, -39 + hy);
      ctx.lineTo(tx + 2, -41.5 + hy);
      ctx.fill();
    }
  } else {
    ctx.strokeStyle = A.body[2];
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(66, -42 + hy, 6, 0.3, Math.PI - 0.3);
    ctx.stroke();
  }

  leg(-22, sw, false);
  leg(32, -sw, false);
  ctx.restore();
}

// ---------------------------------------------------------------- Base lunar
// Mesmo lugar e mesma porta do iglu (o personagem entra igualzinho), 16 peças:
// 6 painéis do módulo, 4 gomos da cúpula de vidro (estufa), 2 painéis solares,
// escotilha, antena parabólica, respiro e por último a porta da câmara de ar.
const MW = 92;   // meia largura do módulo
const MH = 76;   // altura do módulo (2 fileiras de painéis)
const DOME = { rx: 62, ry: 46 };
const VENT = { x0: 74, x1: 82, top: -MH - 26 };
const SOLAR = { x0: 108, x1: 156, y0: -92, y1: -50, pole: 132 };

export const BASE_DOOR = { x: IGLOO.x, bottom: SHORE_Y + 1, w: IGLOO.doorRx, h: IGLOO.doorH };

const third = (MW * 2) / 3;
export const BASE_PIECES = [
  ...Array.from({ length: 6 }, (_, i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    return { kind: 'panel', row, col, cx: -MW + third * (col + 0.5), cy: -MH / 4 - row * (MH / 2) };
  }),
  ...Array.from({ length: 4 }, (_, i) => ({ kind: 'dome', i, cx: -DOME.rx + (DOME.rx / 2) * (i + 0.5), cy: -MH - DOME.ry / 2 })),
  { kind: 'solar', side: -1, cx: -(SOLAR.x0 + SOLAR.x1) / 2, cy: (SOLAR.y0 + SOLAR.y1) / 2 },
  { kind: 'solar', side: 1, cx: (SOLAR.x0 + SOLAR.x1) / 2, cy: (SOLAR.y0 + SOLAR.y1) / 2 },
  { kind: 'porthole', cx: -58, cy: -44 },
  { kind: 'antenna', cx: -26, cy: -MH - DOME.ry - 18 },
  { kind: 'vent', cx: (VENT.x0 + VENT.x1) / 2, cy: VENT.top + 10 },
  { kind: 'door', cx: 0, cy: -IGLOO.doorH / 2 },
];

// Topo do respiro (de onde sai o vapor quando há alguém lá dentro)
export const BASE_VENT = { x: IGLOO.x + (VENT.x0 + VENT.x1) / 2, y: IGLOO.baseY + VENT.top - 2 };

const easeOutBack = (k) => 1 + 2.9 * (k - 1) ** 3 + 1.9 * (k - 1) ** 2;

const moduleShape = (ctx) => {
  ctx.beginPath();
  ctx.roundRect(-MW, -MH, MW * 2, MH, [24, 24, 4, 4]);
};

function drawPanel(ctx, row, col, lit) {
  const x0 = -MW + third * col;
  const y1 = -row * (MH / 2);
  const y0 = y1 - MH / 2;
  ctx.save();
  moduleShape(ctx);
  ctx.clip();
  const g = ctx.createLinearGradient(-MW, 0, MW, 0);
  g.addColorStop(0, '#F2F4F8');
  g.addColorStop(0.6, '#D3D7E0');
  g.addColorStop(1, '#9EA3B4');
  ctx.fillStyle = g;
  ctx.fillRect(x0, y0, third, MH / 2);
  ctx.strokeStyle = 'rgba(90, 96, 120, 0.7)';
  ctx.lineWidth = 1.4;
  ctx.strokeRect(x0 + 0.7, y0 + 0.7, third - 1.4, MH / 2 - 1.4);
  // Rebites nos cantos
  ctx.fillStyle = 'rgba(90, 96, 120, 0.8)';
  for (const [rx, ry] of [[x0 + 5, y0 + 5], [x0 + third - 5, y0 + 5], [x0 + 5, y1 - 5], [x0 + third - 5, y1 - 5]]) {
    ctx.beginPath();
    ctx.arc(rx, ry, 1.2, 0, TAU);
    ctx.fill();
  }
  // Faixa laranja na fileira de baixo; luzinhas de posição na de cima
  if (row === 0) {
    ctx.fillStyle = '#F08A2C';
    ctx.fillRect(x0, y0 + 6, third, 4);
  } else if (lit) {
    ctx.fillStyle = '#7CFFB0';
    ctx.fillRect(x0 + third / 2 - 3, y0 + 8, 6, 2);
  }
  ctx.restore();
}

function drawDomePiece(ctx, i, lit, t) {
  const x0 = -DOME.rx + (DOME.rx / 2) * i;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, -MH, DOME.rx, DOME.ry, 0, Math.PI, TAU);
  ctx.closePath();
  ctx.clip();
  ctx.beginPath();
  ctx.rect(x0, -MH - DOME.ry - 1, DOME.rx / 2, DOME.ry + 2);
  ctx.clip();
  // Vidro (com luz quente quando há alguém lá dentro)
  const g = ctx.createLinearGradient(0, -MH - DOME.ry, 0, -MH);
  if (lit) {
    const k = 0.75 + Math.sin(t * 5) * 0.06;
    g.addColorStop(0, `rgba(255, 220, 150, ${k})`);
    g.addColorStop(1, `rgba(255, 170, 90, ${k})`);
  } else {
    g.addColorStop(0, 'rgba(170, 225, 255, 0.75)');
    g.addColorStop(1, 'rgba(70, 120, 180, 0.8)');
  }
  ctx.fillStyle = g;
  ctx.fillRect(x0, -MH - DOME.ry - 1, DOME.rx / 2, DOME.ry + 2);
  // Plantinhas da estufa
  ctx.fillStyle = '#3FA34D';
  for (let k = 0; k < 3; k++) {
    const px = x0 + 5 + k * 10;
    ctx.beginPath();
    ctx.ellipse(px, -MH - 6, 4, 7, (k - 1) * 0.3, 0, TAU);
    ctx.fill();
  }
  // Armação geodésica
  ctx.strokeStyle = '#E8EBF2';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(0, -MH, DOME.rx * 0.55, DOME.ry * 0.55, 0, Math.PI, TAU);
  ctx.moveTo(x0, -MH);
  ctx.lineTo(x0 + DOME.rx / 4, -MH - DOME.ry);
  ctx.moveTo(x0 + DOME.rx / 2, -MH);
  ctx.lineTo(x0 + DOME.rx / 4, -MH - DOME.ry);
  ctx.stroke();
  // Reflexo no vidro
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.fillRect(x0 + 3, -MH - DOME.ry * 0.75, 3, DOME.ry * 0.4);
  ctx.restore();
  // Borda da cúpula
  ctx.strokeStyle = '#C9CDD8';
  ctx.lineWidth = 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, -MH - DOME.ry - 2, DOME.rx / 2, DOME.ry + 4);
  ctx.clip();
  ctx.beginPath();
  ctx.ellipse(0, -MH, DOME.rx, DOME.ry, 0, Math.PI, TAU);
  ctx.stroke();
  ctx.restore();
}

function drawSolar(ctx, side) {
  const x0 = side * SOLAR.x0;
  const x1 = side * SOLAR.x1;
  const left = Math.min(x0, x1);
  // Poste e braço até o módulo
  ctx.fillStyle = '#8A8FA0';
  ctx.fillRect(side * SOLAR.pole - 2, SOLAR.y1, 4, -SOLAR.y1);
  ctx.fillRect(Math.min(side * MW, side * SOLAR.pole), -40, Math.abs(SOLAR.pole - MW), 3);
  // Painel com células
  ctx.fillStyle = '#1C2E6E';
  ctx.fillRect(left, SOLAR.y0, SOLAR.x1 - SOLAR.x0, SOLAR.y1 - SOLAR.y0);
  ctx.strokeStyle = 'rgba(120, 170, 255, 0.6)';
  ctx.lineWidth = 0.8;
  const w = SOLAR.x1 - SOLAR.x0;
  const h = SOLAR.y1 - SOLAR.y0;
  ctx.beginPath();
  for (let i = 1; i < 4; i++) {
    ctx.moveTo(left + (w * i) / 4, SOLAR.y0);
    ctx.lineTo(left + (w * i) / 4, SOLAR.y1);
  }
  for (let i = 1; i < 4; i++) {
    ctx.moveTo(left, SOLAR.y0 + (h * i) / 4);
    ctx.lineTo(left + w, SOLAR.y0 + (h * i) / 4);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(160, 200, 255, 0.3)';
  ctx.beginPath();
  ctx.moveTo(left + 4, SOLAR.y1 - 4);
  ctx.lineTo(left + w * 0.4, SOLAR.y0 + 4);
  ctx.lineTo(left + w * 0.55, SOLAR.y0 + 4);
  ctx.lineTo(left + w * 0.15, SOLAR.y1 - 4);
  ctx.fill();
  ctx.strokeStyle = '#B9BDCA';
  ctx.lineWidth = 2;
  ctx.strokeRect(left, SOLAR.y0, w, h);
}

function drawPorthole(ctx, lit, t) {
  const x = -58;
  const y = -44;
  ctx.fillStyle = '#7C8194';
  ctx.beginPath();
  ctx.arc(x, y, 14, 0, TAU);
  ctx.fill();
  if (lit) {
    const k = 0.85 + Math.sin(t * 5) * 0.08;
    ctx.fillStyle = `rgba(255, 196, 110, ${k})`;
  } else {
    ctx.fillStyle = '#1C2440';
  }
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, TAU);
  ctx.fill();
  if (!lit) {
    ctx.fillStyle = 'rgba(180, 210, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(x - 3, y - 3, 3.5, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#D9DCE5';
  for (let i = 0; i < 8; i++) {
    const a = (i * TAU) / 8;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * 12, y + Math.sin(a) * 12, 1, 0, TAU);
    ctx.fill();
  }
}

function drawAntenna(ctx, on, t) {
  const bx = -26;
  const by = -MH - DOME.ry + 6;
  ctx.strokeStyle = '#B9BDCA';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(bx, by + 6);
  ctx.lineTo(bx - 4, by - 20);
  ctx.stroke();
  // Prato parabólico virado para o céu
  ctx.save();
  ctx.translate(bx - 4, by - 22);
  ctx.rotate(-0.5);
  ctx.fillStyle = '#E6E9F0';
  ctx.beginPath();
  ctx.ellipse(0, 0, 15, 6, 0, 0, Math.PI);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#8A8FA0';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(0, -10);
  ctx.stroke();
  ctx.fillStyle = on && Math.sin(t * 5) > 0 ? '#FF4A4A' : '#7A2A24';
  ctx.beginPath();
  ctx.arc(0, -11, 2.2, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawVent(ctx) {
  const { x0, x1, top } = VENT;
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, '#C9CDD8');
  g.addColorStop(1, '#7C8194');
  ctx.fillStyle = g;
  ctx.fillRect(x0, top, x1 - x0, -MH + 4 - top);
  ctx.fillStyle = '#6A6F82';
  ctx.fillRect(x0 - 3, top - 3, x1 - x0 + 6, 5);
}

function doorRect() {
  const d = BASE_DOOR;
  return { x: d.x - d.w, y: d.bottom - d.h, w: d.w * 2, h: d.h };
}

const doorPath = (ctx, r, inset = 0) => {
  ctx.beginPath();
  ctx.roundRect(r.x + inset, r.y + inset, r.w - inset * 2, r.h - inset, [14, 14, 0, 0]);
};

// Batente de metal com faixa de aviso amarela e preta
function drawDoorFrame(ctx, lit, t) {
  const r = doorRect();
  ctx.save();
  ctx.strokeStyle = '#6A6F82';
  ctx.lineWidth = 6;
  doorPath(ctx, { x: r.x - 3, y: r.y - 3, w: r.w + 6, h: r.h + 3 });
  ctx.stroke();
  // Faixa de aviso logo acima do batente (abaixo da cúpula)
  const sy = r.y - 9;
  ctx.fillStyle = '#F2C230';
  ctx.fillRect(r.x - 8, sy, r.w + 16, 5);
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x - 8, sy, r.w + 16, 5);
  ctx.clip();
  ctx.fillStyle = '#1E1E24';
  for (let x = r.x - 14; x < r.x + r.w + 10; x += 7) {
    ctx.beginPath();
    ctx.moveTo(x, sy + 5);
    ctx.lineTo(x + 3.5, sy + 5);
    ctx.lineTo(x + 7, sy);
    ctx.lineTo(x + 3.5, sy);
    ctx.fill();
  }
  ctx.restore();
  // Luz da câmara de ar: vermelha fechada vazia, verde com alguém lá dentro
  ctx.fillStyle = lit ? `rgba(110, 255, 150, ${0.75 + Math.sin(t * 4) * 0.2})` : '#C0392B';
  ctx.beginPath();
  ctx.arc(r.x + r.w + 10, r.y + 8, 3, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// Porta de correr em duas folhas: k = 0 aberta, 1 fechada
function drawDoorLeaves(ctx, k) {
  if (k <= 0) return;
  const r = doorRect();
  const half = (r.w / 2) * k;
  ctx.save();
  doorPath(ctx, r);
  ctx.clip();
  for (const s of [-1, 1]) {
    const x = s < 0 ? r.x : r.x + r.w - half;
    const g = ctx.createLinearGradient(x, 0, x + half, 0);
    g.addColorStop(0, '#D3D7E0');
    g.addColorStop(1, '#A4A9B8');
    ctx.fillStyle = g;
    ctx.fillRect(x, r.y, half, r.h);
    ctx.fillStyle = 'rgba(70, 76, 98, 0.6)';
    ctx.fillRect(x, r.y + r.h * 0.45, half, 2);
  }
  if (k >= 1) {
    ctx.strokeStyle = 'rgba(50, 56, 78, 0.8)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(r.x + r.w / 2, r.y);
    ctx.lineTo(r.x + r.w / 2, r.y + r.h);
    ctx.stroke();
  }
  ctx.restore();
}

// Desenha a base com as peças já construídas (igloo = estado da construção)
export function drawBase(ctx, igloo, t) {
  const n = igloo.count;
  ctx.save();
  ctx.translate(IGLOO.x, IGLOO.baseY);
  ctx.fillStyle = 'rgba(20, 15, 40, 0.3)';
  ctx.beginPath();
  ctx.ellipse(6, 3, MW + 30, 9, 0, 0, TAU);
  ctx.fill();
  // Contorno-guia do que falta construir
  if (n < RULES.iglooPieces) {
    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = 'rgba(230, 230, 255, 0.4)';
    ctx.lineWidth = 1.5;
    moduleShape(ctx);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, -MH, DOME.rx, DOME.ry, 0, Math.PI, TAU);
    ctx.stroke();
    ctx.restore();
  }
  // Ordem de desenho: painéis solares e respiro atrás; escotilha por cima dos painéis
  const order = [10, 11, 14, 0, 1, 2, 3, 4, 5, 12, 6, 7, 8, 9, 13];
  for (const i of order) {
    if (i >= n) continue;
    const a = igloo.anim[i];
    ctx.save();
    ctx.globalAlpha = Math.min(1, a * 3);
    ctx.translate(0, -(1 - easeOutBack(a)) * 46);
    const p = BASE_PIECES[i];
    if (p.kind === 'panel') drawPanel(ctx, p.row, p.col, igloo.lit);
    else if (p.kind === 'dome') drawDomePiece(ctx, p.i, igloo.lit, t);
    else if (p.kind === 'solar') drawSolar(ctx, p.side);
    else if (p.kind === 'porthole') drawPorthole(ctx, igloo.lit, t);
    else if (p.kind === 'antenna') drawAntenna(ctx, igloo.complete, t);
    else if (p.kind === 'vent') drawVent(ctx);
    ctx.restore();
  }
  ctx.restore();

  // Porta (peça 16): abertura escura, luz quando acesa, folhas e batente
  const r = doorRect();
  if (n < RULES.iglooPieces) {
    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = 'rgba(230, 230, 255, 0.4)';
    ctx.lineWidth = 1.5;
    doorPath(ctx, { x: r.x - 6, y: r.y - 6, w: r.w + 12, h: r.h + 6 });
    ctx.stroke();
    ctx.restore();
    return;
  }
  const a = igloo.anim[RULES.iglooPieces - 1];
  ctx.save();
  ctx.globalAlpha = Math.min(1, a * 3);
  ctx.translate(0, -(1 - easeOutBack(a)) * 30);
  const dg = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  dg.addColorStop(0, '#0E1024');
  dg.addColorStop(1, '#262A44');
  ctx.fillStyle = dg;
  doorPath(ctx, r);
  ctx.fill();
  if (igloo.lit) {
    ctx.fillStyle = `rgba(255, 200, 120, ${0.55 + Math.sin(t * 5) * 0.08})`;
    doorPath(ctx, r, 2);
    ctx.fill();
  }
  drawDoorLeaves(ctx, igloo.curtain);
  if (igloo.lit && igloo.curtain >= 1) {
    // Luz quente escapando pela fresta do meio
    ctx.save();
    ctx.shadowColor = 'rgba(255, 190, 100, 0.9)';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = `rgba(255, 200, 120, ${0.6 + Math.sin(t * 5) * 0.12})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(r.x + r.w / 2, r.y + 2);
    ctx.lineTo(r.x + r.w / 2, r.y + r.h);
    ctx.stroke();
    ctx.restore();
  }
  drawDoorFrame(ctx, igloo.lit, t);
  ctx.restore();
}

// Desenhado POR CIMA do personagem enquanto ele entra: sombra do interior,
// as folhas da porta fechando e o batente.
export function drawBaseDoorFront(ctx, igloo, t) {
  if (igloo.count < RULES.iglooPieces) return;
  const r = doorRect();
  ctx.save();
  if (igloo.shade > 0) {
    ctx.save();
    doorPath(ctx, r);
    ctx.clip();
    ctx.fillStyle = `rgba(8, 8, 24, ${0.4 * igloo.shade})`;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  }
  drawDoorLeaves(ctx, igloo.curtain);
  drawDoorFrame(ctx, igloo.lit, t);
  ctx.restore();
}

// ---------------------------------------------------------------- Poeira estelar
// No lugar da neve: grãozinhos brilhantes descendo devagar e cintilando
const DUST_COLORS = ['#FFFFFF', '#CFC2FF', '#9FF3FF', '#FFE6A0'];

export function drawStardust(ctx, flakes, t) {
  ctx.save();
  for (const [i, s] of flakes.entries()) {
    const tw = 0.5 + 0.5 * Math.sin(t * 4 + i * 1.7);
    ctx.globalAlpha = 0.25 + 0.55 * tw;
    ctx.fillStyle = DUST_COLORS[i % DUST_COLORS.length];
    const r = 0.5 + s.r * 0.55;
    ctx.fillRect(s.x - r, s.y - r * 0.3, r * 2, r * 0.6);
    ctx.fillRect(s.x - r * 0.3, s.y - r, r * 0.6, r * 2);
  }
  ctx.restore();
}
