// Fase especial dos Dinossauros (fase 30): céu pré-histórico com um sol enorme e
// pterossauros ao longe, vulcões soltando fumaça e cuspindo lava, morros de mata
// com cicas e samambaias gigantes, chão de terra vulcânica, rio de lava borbulhando
// com pedras de basalto boiando no lugar das placas (acesas = cobertas de âmbar),
// caverna de pedra no lugar do iglu (a porta é uma pedra redonda que rola),
// pterossauros, raptorzinhos e amonites no lugar dos bichos, ovos de dinossauro no
// lugar dos peixes, homem das cavernas e um T-rex no lugar do urso. Brasas sobem
// do rio no lugar da neve. Só o visual muda (e o ritmo, como toda especial).
import { W, H, IGLOO, SHORE_Y, SHORE_TOP, WATER_TOP, RULES } from './config.js';

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

// Cores do rio de lava e dos efeitos (o renderer usa no lugar da água gelada)
export const LAVA = {
  water: ['#FF8A1E', '#D2380E', '#5A0C06'],
  ripple: [255, 226, 130],
  bank: 'rgba(30, 8, 4, 0.55)',
  halo: [255, 200, 60],     // brilho do âmbar das pedras acesas
  ash: '#A89A90',           // cinza vulcânica (pouso na costa, encaixe das pedras)
  chip: '#4A3E3A',          // lasquinhas de basalto ao pousar
  spark: '#FFD25A',         // brilhos da fileira acesa
  sky: [255, 150, 80],      // reflexo do céu na lava
  // Respingo, anel e bolhas ao cair na lava (no lugar da água clarinha)
  liquid: { splash: '#FFB040', ripple: [255, 190, 90], bubble: 'rgba(255, 210, 120, 0.9)' },
};
export const AMBER = '#FFB627';
export const BASALT = '#4E4440';

// ---------------------------------------------------------------- Céu
export const SKY_TOP = '#2B1838';
export const SUN = { x: 300, r: 40, color: '#FFB24A' };

// O sol enorme desce devagar conforme a temperatura cai (como nas outras fases)
export function sunPos(skyF) {
  return { x: SUN.x, y: 70 + (1 - skyF) * 80 };
}

export function drawDinoSky(ctx, t, skyF) {
  const g = ctx.createLinearGradient(0, 0, 0, SHORE_TOP);
  g.addColorStop(0, SKY_TOP);
  g.addColorStop(0.45, '#8A3A4A');
  g.addColorStop(0.8, '#E8724A');
  g.addColorStop(1, '#FFB070');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, SHORE_TOP + 30);
  // Sol enorme e avermelhado, com halo
  const s = sunPos(skyF);
  const halo = ctx.createRadialGradient(s.x, s.y, SUN.r * 0.8, s.x, s.y, SUN.r * 3.4);
  halo.addColorStop(0, 'rgba(255, 190, 90, 0.45)');
  halo.addColorStop(1, 'rgba(255, 190, 90, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(s.x - SUN.r * 3.4, s.y - SUN.r * 3.4, SUN.r * 6.8, SUN.r * 6.8);
  const sg = ctx.createRadialGradient(s.x - 8, s.y - 10, 4, s.x, s.y, SUN.r);
  sg.addColorStop(0, '#FFF0B0');
  sg.addColorStop(1, SUN.color);
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.arc(s.x, s.y, SUN.r, 0, TAU);
  ctx.fill();
  // Faixas de névoa quente passando na frente do sol
  ctx.fillStyle = 'rgba(120, 40, 50, 0.28)';
  for (let i = 0; i < 3; i++) {
    const cx = ((t * (6 + i * 3) + i * 470) % (W + 500)) - 250;
    const cy = 64 + i * 30;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 160, 6 + i * 2, 0, 0, TAU);
    ctx.fill();
  }
  drawSkyPteros(ctx, t, s);
}

// Bando de pterossauros em silhueta cruzando o céu de vez em quando
function drawSkyPteros(ctx, t, s) {
  const cycle = 19;
  const k = (t % cycle) / 9; // 9 s atravessando, 10 s de céu vazio
  if (k > 1) return;
  ctx.fillStyle = '#3A1A26';
  for (let i = 0; i < 4; i++) {
    const x = W + 60 - k * (W + 160) + i * 46;
    const y = s.y - 30 + (i % 2) * 18 + Math.sin(k * 6 + i) * 8;
    const f = Math.sin(t * 5 + i * 1.3);
    const sz = 11 - i;
    ctx.beginPath();
    // Asas em "M" com o bico e a crista
    ctx.moveTo(x - sz * 1.8, y - f * sz * 0.5);
    ctx.quadraticCurveTo(x - sz * 0.8, y - sz * 0.5 - f * sz * 0.3, x, y);
    ctx.quadraticCurveTo(x + sz * 0.8, y - sz * 0.5 - f * sz * 0.3, x + sz * 1.8, y - f * sz * 0.5);
    ctx.quadraticCurveTo(x + sz * 0.8, y + 1, x, y + 2);
    ctx.quadraticCurveTo(x - sz * 0.8, y + 1, x - sz * 1.8, y - f * sz * 0.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 2, y);
    ctx.lineTo(x - sz * 0.9, y + 1.5);
    ctx.lineTo(x - 1, y + 2.5);
    ctx.lineTo(x + sz * 0.5, y - 1);
    ctx.fill();
  }
}

// ---------------------------------------------------------------- Fundo
// Vulcões ao longe, morros de mata com cicas, chão de terra vulcânica com musgo e
// pedrinhas, e o barranco de basalto com rachaduras brilhando na beira da lava.
export const VOLCANOES = [
  { x: 560, h: 150, w: 230 },
  { x: 880, h: 104, w: 170 },
];

export function makeDinoBackground() {
  const h = WATER_TOP + 12;
  const { c, g } = offscreen(W, h);
  const rnd = seeded(43);

  // Vulcões: cone escuro, lado iluminado, cratera e escorridos de lava
  for (const v of VOLCANOES) {
    const base = SHORE_TOP + 6;
    const top = base - v.h;
    const crater = v.w * 0.12;
    const vg = g.createLinearGradient(v.x - v.w / 2, 0, v.x + v.w / 2, 0);
    vg.addColorStop(0, '#6A3A40');
    vg.addColorStop(0.5, '#4A2A32');
    vg.addColorStop(1, '#2E1A22');
    g.fillStyle = vg;
    g.beginPath();
    g.moveTo(v.x - v.w / 2, base);
    g.quadraticCurveTo(v.x - v.w * 0.2, top + v.h * 0.35, v.x - crater, top);
    g.lineTo(v.x + crater, top);
    g.quadraticCurveTo(v.x + v.w * 0.2, top + v.h * 0.35, v.x + v.w / 2, base);
    g.fill();
    g.fillStyle = '#FF7A2A';
    g.beginPath();
    g.ellipse(v.x, top + 1, crater, 3.5, 0, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(255, 110, 40, 0.75)';
    g.lineCap = 'round';
    g.lineWidth = 2.4;
    for (const [dx, len, bend] of [[-0.5, 0.55, -10], [0.3, 0.4, 8], [0.8, 0.3, 6]]) {
      g.beginPath();
      g.moveTo(v.x + dx * crater, top + 2);
      g.quadraticCurveTo(v.x + dx * crater + bend, top + v.h * len * 0.5, v.x + dx * crater * 2 + bend * 1.5, top + v.h * len);
      g.stroke();
    }
  }

  // Morros de mata com cicas e samambaias em silhueta
  g.fillStyle = '#2E3A26';
  g.beginPath();
  g.moveTo(0, SHORE_TOP + 4);
  for (let x = 0; x <= W; x += 20) g.lineTo(x, SHORE_TOP - 22 - Math.sin(x * 0.008 + 1) * 14 - Math.sin(x * 0.023) * 6);
  g.lineTo(W, SHORE_TOP + 4);
  g.fill();
  g.strokeStyle = '#1E2A1A';
  g.fillStyle = '#1E2A1A';
  g.lineCap = 'round';
  for (const [x, s] of [[90, 0.7], [330, 0.6], [470, 0.8], [720, 0.55], [990, 0.7], [1210, 0.65]]) {
    const y = SHORE_TOP - 18;
    g.lineWidth = 4 * s;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 2, y - 46 * s);
    g.stroke();
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI + (i * Math.PI) / 6;
      g.lineWidth = 2.5 * s;
      g.beginPath();
      g.moveTo(x + 2, y - 46 * s);
      g.quadraticCurveTo(x + 2 + Math.cos(a) * 16 * s, y - 52 * s + Math.sin(a) * 10 * s,
        x + 2 + Math.cos(a) * 30 * s, y - 40 * s + Math.sin(a) * 6 * s + 10 * s);
      g.stroke();
    }
  }

  // Chão de terra vulcânica
  let grd = g.createLinearGradient(0, SHORE_TOP, 0, WATER_TOP);
  grd.addColorStop(0, '#6E5A3A');
  grd.addColorStop(1, '#4A3A26');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(0, WATER_TOP);
  for (let x = 0; x <= W; x += 20) g.lineTo(x, SHORE_TOP + Math.sin(x * 0.013) * 3);
  g.lineTo(W, WATER_TOP);
  g.fill();
  // Musgo, pedrinhas e brotos de samambaia
  for (let i = 0; i < 180; i++) {
    const x = rnd() * W;
    const y = SHORE_TOP + 8 + rnd() * 62;
    const r = rnd();
    if (r < 0.45) {
      g.fillStyle = 'rgba(110, 150, 60, 0.45)';
      g.beginPath();
      g.ellipse(x, y, 4 + rnd() * 5, 1.6, 0, 0, TAU);
      g.fill();
    } else if (r < 0.8) {
      g.fillStyle = ['#3A302A', '#5A4C40', '#2A2420'][i % 3];
      g.beginPath();
      g.ellipse(x, y, 1.8 + rnd() * 2, 1.2 + rnd(), 0, 0, TAU);
      g.fill();
    } else {
      g.strokeStyle = 'rgba(90, 140, 50, 0.7)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x - 1, y - 6, x + 2, y - 7);
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 3, y - 4, x + 5, y - 4);
      g.stroke();
    }
  }

  // Barranco de basalto na beira da lava, com rachaduras brilhando
  const edgeTop = WATER_TOP - 12;
  grd = g.createLinearGradient(0, edgeTop, 0, WATER_TOP + 12);
  grd.addColorStop(0, '#3A3030');
  grd.addColorStop(1, '#161010');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(0, edgeTop + 2);
  for (let x = 0; x <= W; x += 14) g.lineTo(x, edgeTop + Math.sin(x * 0.11) * 2);
  g.lineTo(W, WATER_TOP + 12);
  g.lineTo(0, WATER_TOP + 12);
  g.fill();
  g.strokeStyle = 'rgba(255, 120, 40, 0.6)';
  g.lineWidth = 1.2;
  for (let i = 0; i < 26; i++) {
    const x = rnd() * W;
    g.beginPath();
    g.moveTo(x, WATER_TOP + 10);
    g.lineTo(x + (rnd() - 0.5) * 8, WATER_TOP + 2);
    g.lineTo(x + (rnd() - 0.5) * 12, edgeTop + 6 + rnd() * 4);
    g.stroke();
  }

  return { canvas: c, w: W, h };
}

// ---------------------------------------------------------------- Enfeites
// Fumaça saindo dos vulcões (com lava espirrando do maior), samambaias gigantes
// balançando e um ninho com três ovos na costa (tudo longe da caverna).
export const TREE_FERNS = [{ x: 54, base: 248, s: 1.1 }, { x: 640, base: 244, s: 0.8 }];
export const NEST = { x: 250, y: 248 };
export const FERN_GREEN = '#4E8A2E';
export const EGG_SHELL = '#F4EBD0';
export const EGG_SPOT = '#7BBF4A';
// Gancho do visual 3D (src/model3d.js): samambaias, ninho e as presas da caverna em 3D
export const dinoArt = { on: false, fern: null, nest: null, tusks: null };

export function drawDinoDecor(ctx, t) {
  drawVolcanoSmoke(ctx, t);
  for (const [i, f] of TREE_FERNS.entries()) drawTreeFern(ctx, f.x, f.base, f.s, t + i * 1.7);
  drawNest(ctx, t);
}

function drawVolcanoSmoke(ctx, t) {
  ctx.save();
  for (const [vi, v] of VOLCANOES.entries()) {
    const top = SHORE_TOP + 6 - v.h;
    // Brilho da cratera pulsando
    const k = 0.35 + Math.sin(t * 2 + vi) * 0.12;
    const cg = ctx.createRadialGradient(v.x, top, 2, v.x, top, 40);
    cg.addColorStop(0, `rgba(255, 130, 50, ${k})`);
    cg.addColorStop(1, 'rgba(255, 130, 50, 0)');
    ctx.fillStyle = cg;
    ctx.fillRect(v.x - 40, top - 40, 80, 80);
    // Rolos de fumaça subindo e se espalhando com o vento
    for (let i = 0; i < 7; i++) {
      const life = 6 + vi * 2;
      const a = ((t + i * (life / 7)) % life) / life;
      const x = v.x + a * 70 + Math.sin(t * 0.7 + i) * 6;
      const y = top - 6 - a * 110;
      const r = (8 + a * 30) * (vi ? 0.75 : 1);
      ctx.globalAlpha = 0.5 * (1 - a) * Math.min(1, a * 6);
      ctx.fillStyle = i % 2 ? '#5A4A50' : '#6E5E62';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // O vulcão maior cospe gotas de lava de vez em quando
  const v = VOLCANOES[0];
  const top = SHORE_TOP + 6 - v.h;
  const k = (t % 7) / 1.6;
  if (k < 1) {
    ctx.fillStyle = '#FF8A2A';
    for (let i = 0; i < 6; i++) {
      const vx = (i - 2.5) * 16;
      const x = v.x + vx * k * 1.6;
      const y = top - 70 * k + 90 * k * k;
      ctx.globalAlpha = 1 - k * 0.6;
      ctx.beginPath();
      ctx.arc(x, y, 2.6 - k, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// Samambaia gigante: tronco fibroso e folhas compridas em leque, balançando
function drawTreeFern(ctx, x, base, s, t) {
  ctx.save();
  ctx.translate(x, base);
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(20, 10, 5, 0.35)';
  ctx.beginPath();
  ctx.ellipse(4, 2, 36, 5, 0, 0, TAU);
  ctx.fill();
  if (dinoArt.on && dinoArt.fern?.(ctx, Math.sin(t * 1.3) * 0.08)) {
    ctx.restore();
    return;
  }
  // Tronco com escamas
  ctx.fillStyle = '#5A3E26';
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.quadraticCurveTo(-4, -60, -2, -112);
  ctx.lineTo(6, -112);
  ctx.quadraticCurveTo(6, -60, 7, 0);
  ctx.fill();
  ctx.strokeStyle = 'rgba(30, 18, 8, 0.6)';
  ctx.lineWidth = 1.2;
  for (let y = -8; y > -108; y -= 9) {
    ctx.beginPath();
    ctx.moveTo(-5, y);
    ctx.quadraticCurveTo(1, y - 4, 6, y);
    ctx.stroke();
  }
  // Folhas em leque, cada uma com folíolos
  const sway = Math.sin(t * 1.3) * 0.08;
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + (i - 3.5) * 0.42 + sway;
    const len = 62 + (i % 3) * 8;
    ctx.save();
    ctx.translate(2, -112);
    ctx.rotate(a + Math.PI / 2);
    ctx.strokeStyle = i % 2 ? FERN_GREEN : '#3E7426';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.1, -len * 0.5, len * 0.35, -len);
    ctx.stroke();
    ctx.fillStyle = i % 2 ? FERN_GREEN : '#3E7426';
    for (let k = 0.15; k < 0.95; k += 0.1) {
      const px = len * 0.35 * k * k + len * 0.1 * k;
      const py = -len * k;
      const l = 11 * (1 - k * 0.7);
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(px + side * l * 0.5, py + 2, l * 0.55, 2, side * 0.5, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }
  ctx.restore();
}

// Ninho de gravetos com três ovos (um deles balançando, quase chocando)
function drawNest(ctx, t) {
  const { x, y } = NEST;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(20, 10, 5, 0.35)';
  ctx.beginPath();
  ctx.ellipse(2, 1, 30, 5, 0, 0, TAU);
  ctx.fill();
  if (dinoArt.on && dinoArt.nest?.(ctx, Math.max(0, Math.sin(t * 2.4)) ** 4 * Math.sin(t * 30) * 0.25)) {
    ctx.restore();
    return;
  }
  for (const [ex, tilt] of [[-11, -0.2], [11, 0.25], [0, 0]]) {
    const wob = ex === 0 ? Math.max(0, Math.sin(t * 2.4)) ** 4 * Math.sin(t * 30) * 0.25 : 0;
    drawEgg(ctx, ex, -6, 8.5, tilt + wob);
  }
  // Gravetos do ninho na frente dos ovos
  ctx.strokeStyle = '#7A5A30';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const a = (i / 8) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(-26 + i * 6, -2 + Math.sin(a) * 2);
    ctx.lineTo(-18 + i * 6, -8 + Math.cos(a * 2) * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#6A4A26';
  ctx.beginPath();
  ctx.ellipse(0, -2, 26, 6, 0, 0, Math.PI);
  ctx.fill();
  ctx.restore();
}

// Ovo de dinossauro (creme com pintas verdes), base em (x, y + r)
function drawEgg(ctx, x, y, r, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.6, 1, 0, 0, r * 1.4);
  g.addColorStop(0, '#FFFFFF');
  g.addColorStop(0.5, EGG_SHELL);
  g.addColorStop(1, '#C8B890');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.3);
  ctx.bezierCurveTo(r * 0.9, -r * 1.25, r * 1.05, r * 0.6, 0, r);
  ctx.bezierCurveTo(-r * 1.05, r * 0.6, -r * 0.9, -r * 1.25, 0, -r * 1.3);
  ctx.fill();
  ctx.fillStyle = EGG_SPOT;
  for (const [sx, sy, sr] of [[-0.35, -0.5, 0.2], [0.3, -0.1, 0.24], [-0.2, 0.4, 0.17], [0.4, 0.55, 0.12], [0.05, -0.9, 0.12]]) {
    ctx.beginPath();
    ctx.ellipse(sx * r, sy * r, sr * r, sr * r * 0.8, 0.4, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// Bolhas de lava inchando e estourando na superfície do rio (entre as fileiras)
export function drawLavaBubbles(ctx, t) {
  ctx.save();
  for (let i = 0; i < 16; i++) {
    const period = 2.2 + (i % 5) * 0.4;
    const k = ((t + i * 0.73) % period) / period;
    if (k > 0.5) continue;
    const slot = Math.floor((t + i * 0.73) / period);
    const x = ((i * 211 + slot * 397) % (W - 40)) + 20;
    const y = WATER_TOP + 40 + ((i * 53 + slot * 31) % (H - WATER_TOP - 60));
    const u = k / 0.5;
    if (u < 0.8) {
      const r = 2 + u * 6;
      ctx.fillStyle = 'rgba(255, 200, 90, 0.8)';
      ctx.beginPath();
      ctx.arc(x, y - r * 0.4, r, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 245, 190, 0.8)';
      ctx.fillRect(x - r * 0.4, y - r * 1.1, 2, 1.2);
    } else {
      // Estourou: anel e respingos
      const p = (u - 0.8) / 0.2;
      ctx.strokeStyle = `rgba(255, 220, 120, ${1 - p})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(x, y, 8 + p * 8, 2 + p * 2, 0, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 170, 60, ${1 - p})`;
      for (const s of [-1, 1]) ctx.fillRect(x + s * (4 + p * 8), y - 6 - p * 6 + p * p * 8, 2, 2);
    }
  }
  ctx.restore();
}

// Brasas subindo do rio de lava (no lugar da neve caindo)
export const EMBER = '#FF9A3A';
export function drawEmbers(ctx, flakes, t) {
  ctx.save();
  for (const [i, s] of flakes.entries()) {
    const y = H - s.y; // a neve cai; as brasas sobem
    const fl = 0.5 + 0.5 * Math.sin(t * 7 + i * 2.3);
    ctx.globalAlpha = 0.3 + 0.6 * fl;
    ctx.fillStyle = i % 3 ? EMBER : '#FFD25A';
    const r = 0.6 + s.r * 0.5;
    ctx.beginPath();
    ctx.arc(s.x + Math.sin(t * 1.5 + i) * 4, y, r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- Pedras no rio
// Pedras de basalto boiando na lava, topo achatado onde se pisa (y = 0). Acesas:
// cobertas de âmbar dourado. Funciona com pedaços curtos (fases pares).
const ROCK_PAD = 12;
const ROCK_TOP = 26;
const ROCK_H = 62;

export function rockSprite(piece, active) {
  const key = active ? 'rockOn' : 'rockOff';
  if (piece.sprites[key]) return piece.sprites[key];
  const w = piece.w;
  const { c, g } = offscreen(w + ROCK_PAD * 2, ROCK_H);
  g.translate(ROCK_PAD, ROCK_TOP);
  const rnd = seeded(piece.seed + 31);
  // Brilho da lava em volta (reflexo)
  g.fillStyle = active ? 'rgba(255, 200, 60, 0.3)' : 'rgba(255, 120, 30, 0.35)';
  g.beginPath();
  g.ellipse(w / 2, 15, w / 2 + 6, 5, 0, 0, TAU);
  g.fill();
  // Silhueta da pedra: topo quase reto, lados irregulares descendo até a lava
  const top = [];
  const n = Math.max(3, Math.round(w / 12));
  for (let i = 0; i <= n; i++) top.push([(w * i) / n, -1 + (rnd() - 0.5) * 2.4]);
  const path = () => {
    g.beginPath();
    g.moveTo(-3, 13);
    g.lineTo(-4 + rnd() * 2, 6);
    g.lineTo(0, 1);
    for (const [x, y] of top) g.lineTo(x, y);
    g.lineTo(w, 1);
    g.lineTo(w + 3 - rnd() * 2, 6);
    g.lineTo(w + 3, 13);
    g.closePath();
  };
  const rg = g.createLinearGradient(0, -2, 0, 14);
  if (active) {
    rg.addColorStop(0, '#C89A5A');
    rg.addColorStop(1, '#6A4A26');
  } else {
    rg.addColorStop(0, '#6A5E58');
    rg.addColorStop(0.4, BASALT);
    rg.addColorStop(1, '#241C1A');
  }
  g.fillStyle = rg;
  path();
  g.fill();
  // Facetas e rachaduras
  g.save();
  path();
  g.clip();
  g.strokeStyle = 'rgba(20, 12, 10, 0.55)';
  g.lineWidth = 1;
  for (let i = 0; i < Math.max(1, Math.round(w / 26)); i++) {
    const x = 6 + rnd() * (w - 12);
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + (rnd() - 0.5) * 6, 5);
    g.lineTo(x + (rnd() - 0.5) * 10, 12);
    g.stroke();
  }
  // Pontinhos de vesícula do basalto
  g.fillStyle = 'rgba(15, 10, 8, 0.45)';
  for (let i = 0; i < w / 6; i++) g.fillRect(rnd() * w, 2 + rnd() * 9, 1.3, 1.1);
  if (active) {
    // Crosta de âmbar dourado cobrindo o topo
    const cg = g.createLinearGradient(0, -2, 0, 6);
    cg.addColorStop(0, '#FFE27A');
    cg.addColorStop(1, 'rgba(255, 182, 39, 0)');
    g.fillStyle = cg;
    g.fillRect(-4, -3, w + 8, 9);
  }
  g.restore();
  if (active) {
    // Cristais de âmbar no topo, com brilho
    const k = Math.max(1, Math.round(w / 30));
    for (let i = 0; i < k; i++) {
      const cx = ((i + 0.5) * w) / k + (rnd() - 0.5) * 4;
      const r = Math.min(9, w / (k * 2.6));
      const ag = g.createRadialGradient(cx - r * 0.3, -r * 0.2, 1, cx, 1, r * 1.2);
      ag.addColorStop(0, '#FFF0A0');
      ag.addColorStop(0.5, AMBER);
      ag.addColorStop(1, '#C06A10');
      g.fillStyle = ag;
      g.beginPath();
      g.moveTo(cx - r, 3);
      g.lineTo(cx - r * 0.6, -r * 0.5);
      g.lineTo(cx, -r * 0.8);
      g.lineTo(cx + r * 0.7, -r * 0.4);
      g.lineTo(cx + r, 3);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(255, 255, 230, 0.8)';
      g.fillRect(cx - r * 0.35, -r * 0.4, 1.6, 2.6);
    }
    g.fillStyle = 'rgba(255, 230, 150, 0.65)';
    g.fillRect(3, -1.5, w - 6, 1.2);
  } else {
    g.fillStyle = 'rgba(200, 190, 180, 0.3)';
    g.fillRect(3, -1, w - 6, 1.2);
  }
  // Borda incandescente onde a pedra encosta na lava
  g.strokeStyle = 'rgba(255, 170, 60, 0.85)';
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(-3, 13);
  g.lineTo(w + 3, 13);
  g.stroke();
  const sprite = { canvas: c, ox: ROCK_PAD, oy: ROCK_TOP, w: w + ROCK_PAD * 2, h: ROCK_H };
  piece.sprites[key] = sprite;
  return sprite;
}

// ---------------------------------------------------------------- Bichos
// Pterossauro voando baixo sobre a fileira (tamanho do ganso): crista, bico
// comprido e asas de pele batendo
export const PTERO = { body: '#B5543A', wing: '#E08A5A', crest: '#7A2A1E' };
export function drawPtero(ctx, c, y, t) {
  const flap = Math.sin(t * 9 + c.ph * 3);
  const by = y - 36 + Math.sin(t * 3 + c.ph) * 4 - flap * 2;
  ctx.fillStyle = 'rgba(30, 10, 5, 0.3)';
  ctx.beginPath();
  ctx.ellipse(c.x, y + 13, 18, 3, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(c.x, by);
  ctx.scale(c.dir, 1);
  // Asa de trás (mais escura)
  const wing = (back) => {
    const lift = (back ? 0.7 : 1) * flap;
    ctx.fillStyle = back ? '#A0583A' : PTERO.wing;
    ctx.beginPath();
    ctx.moveTo(-4, -2);
    ctx.quadraticCurveTo(-14, -18 - lift * 12, -30, -10 - lift * 16);
    ctx.lineTo(-22, -2 - lift * 6);
    ctx.quadraticCurveTo(-14, 2, -6, 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = PTERO.crest;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-4, -2);
    ctx.quadraticCurveTo(-14, -18 - lift * 12, -30, -10 - lift * 16);
    ctx.stroke();
  };
  ctx.save();
  ctx.scale(-1, 1);
  ctx.translate(4, 0);
  wing(true);
  ctx.restore();
  // Corpo e perninhas penduradas
  ctx.fillStyle = PTERO.body;
  ctx.beginPath();
  ctx.ellipse(0, 1, 11, 6, -0.1, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = PTERO.crest;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-4, 6);
  ctx.lineTo(-7, 12);
  ctx.moveTo(1, 6);
  ctx.lineTo(-1, 12);
  ctx.stroke();
  wing(false);
  // Pescoço, cabeça com crista para trás e bico comprido
  ctx.fillStyle = PTERO.body;
  ctx.beginPath();
  ctx.ellipse(12, -4, 6, 5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = PTERO.crest;
  ctx.beginPath();
  ctx.moveTo(10, -7);
  ctx.lineTo(-2, -14);
  ctx.lineTo(13, -9);
  ctx.fill();
  ctx.fillStyle = '#E8C070';
  ctx.beginPath();
  ctx.moveTo(16, -6);
  ctx.lineTo(32, -2);
  ctx.lineTo(16, -1);
  ctx.fill();
  ctx.fillStyle = '#1D1410';
  ctx.beginPath();
  ctx.arc(13.5, -5, 1.4, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// Raptorzinho verde listrado correndo sobre as pedras (tamanho do caranguejo)
export const RAPTOR_GREEN = '#5FA83A';
export function drawRaptor(ctx, c, y, t) {
  const run = Math.sin(t * 18 + c.ph);
  const bob = Math.abs(run) * -2;
  ctx.fillStyle = 'rgba(30, 10, 5, 0.3)';
  ctx.beginPath();
  ctx.ellipse(c.x, y + 2, 20, 3, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(c.x, y);
  ctx.scale(c.dir, 1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Pernas correndo (a de trás mais escura)
  const leg = (k, back) => {
    ctx.strokeStyle = back ? '#3E7426' : '#4E8A2E';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(-2, -14 + bob);
    ctx.lineTo(-1 + k * 6, -7 + bob);
    ctx.lineTo(-4 + k * 9, 0);
    ctx.lineTo(1 + k * 9, 0);
    ctx.stroke();
  };
  leg(-run, true);
  ctx.translate(0, bob);
  // Rabo comprido esticado para trás
  ctx.fillStyle = '#4E8A2E';
  ctx.beginPath();
  ctx.moveTo(-6, -20);
  ctx.quadraticCurveTo(-20, -22 + run * 2, -30, -24 + run * 3);
  ctx.quadraticCurveTo(-20, -15, -6, -12);
  ctx.fill();
  // Corpo e barriga
  const g = ctx.createLinearGradient(0, -24, 0, -10);
  g.addColorStop(0, '#7CC24A');
  g.addColorStop(1, RAPTOR_GREEN);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, -17, 10, 6.5, -0.15, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#D8E8A0';
  ctx.beginPath();
  ctx.ellipse(2, -13.5, 6, 2.6, -0.1, 0, TAU);
  ctx.fill();
  // Listras nas costas
  ctx.fillStyle = '#2E5A1E';
  for (const x of [-6, -1, 4]) {
    ctx.beginPath();
    ctx.moveTo(x, -23);
    ctx.lineTo(x + 2.5, -23);
    ctx.lineTo(x + 0.5, -18);
    ctx.fill();
  }
  // Bracinho
  ctx.strokeStyle = '#4E8A2E';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(7, -15);
  ctx.lineTo(11, -12 + run);
  ctx.stroke();
  // Pescoço e cabeça com boquinha dentada
  ctx.fillStyle = RAPTOR_GREEN;
  ctx.beginPath();
  ctx.moveTo(6, -21);
  ctx.quadraticCurveTo(12, -30, 16, -30);
  ctx.lineTo(13, -20);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(17, -30, 7, 4.2, 0.1, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(17, -32, 2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1D1410';
  ctx.beginPath();
  ctx.arc(17.6, -32, 1, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#2E5A1E';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(18, -28);
  ctx.lineTo(23.5, -28.6);
  ctx.stroke();
  leg(run, false);
  ctx.restore();
}

// Amonite boiando na lava: concha em espiral listrada com tentáculos na frente
// (tamanho do molusco)
export const AMMONITE_SHELL = '#E8D0A0';
export function drawAmmonite(ctx, c, y, t) {
  const bob = Math.sin(t * 3 + c.ph) * 2;
  ctx.save();
  ctx.translate(c.x, y + 2 + bob);
  ctx.scale(c.dir, 1);
  // Tentáculos balançando (na frente, para onde anda)
  ctx.strokeStyle = '#D07A5A';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const w = Math.sin(t * 6 + i + c.ph) * 2;
    ctx.beginPath();
    ctx.moveTo(8, -4 + i * 1.5);
    ctx.quadraticCurveTo(14, -6 + i * 2 + w, 18, -2 + i * 2.5 - w);
    ctx.stroke();
  }
  // Concha em espiral, girando devagar
  ctx.save();
  ctx.translate(-2, -8);
  ctx.rotate(Math.sin(t * 1.5 + c.ph) * 0.15);
  const g = ctx.createRadialGradient(-3, -4, 1, 0, 0, 13);
  g.addColorStop(0, '#FFF4D8');
  g.addColorStop(1, AMMONITE_SHELL);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#9A6A3A';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let a = 0; a < TAU * 2.4; a += 0.2) {
    const r = 11 * (1 - a / (TAU * 2.6));
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (a === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  // Costelas da concha
  ctx.strokeStyle = 'rgba(150, 100, 50, 0.5)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
    ctx.lineTo(Math.cos(a) * 12, Math.sin(a) * 12);
    ctx.stroke();
  }
  ctx.restore();
  // Olho
  ctx.fillStyle = '#1D1410';
  ctx.beginPath();
  ctx.arc(9, -8, 1.8, 0, TAU);
  ctx.fill();
  ctx.restore();
  // Anel na lava
  ctx.strokeStyle = 'rgba(255, 220, 120, 0.55)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(c.x, y + 8, 16, 3, 0, 0, TAU);
  ctx.stroke();
}

// Ovo de dinossauro pulando para fora da lava (vale os pontos do peixe)
export function drawDinoEgg(ctx, c, y, t) {
  const hop = Math.max(0, Math.sin(t * 3 + c.ph)) * 14;
  ctx.save();
  ctx.translate(c.x, y - 4 - hop);
  ctx.rotate(Math.sin(t * 6 + c.ph) * 0.3 * c.dir);
  // Brilho para chamar a atenção
  const gl = ctx.createRadialGradient(0, 0, 2, 0, 0, 18);
  gl.addColorStop(0, 'rgba(255, 250, 200, 0.35)');
  gl.addColorStop(1, 'rgba(255, 250, 200, 0)');
  ctx.fillStyle = gl;
  ctx.fillRect(-18, -18, 36, 36);
  drawEgg(ctx, 0, 0, 8);
  ctx.restore();
  if (hop < 3) {
    ctx.strokeStyle = 'rgba(255, 220, 120, 0.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(c.x, y + 9, 14, 3, 0, 0, TAU);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- T-rex
// No lugar do urso: corpo inteiro numa silhueta só (rabo, costas, pescoço e
// barriga), com volume, escamas e listras; coxas musculosas com joelho de verdade
// (a perna se dobra para o pé ficar no chão), pés de três dedos com garras,
// bracinhos curtos e uma cabeçorra com crista sobre o olho, narina, mandíbula
// articulada e dentes irregulares. Parado, respira e ruge de vez em quando (ergue a
// cabeça e abre a boca); correndo atrás do jogador, vai inclinado e de boca aberta.
export const TREX = {
  skin: ['#8CBF58', '#5E8C38', '#3E6424'], belly: '#D2D89A', stripe: '#2E4A1E',
  eye: '#FFC21A', mouth: '#7A1E22', teeth: '#FFF8E6', claw: '#E8DFC4', tongue: '#C8505A',
};
const TREX_LINE = 'rgba(26, 44, 16, 0.8)';
const TREX_SCALE = 0.86;

// Membro afunilado de p1 a p2 (larguras w1 e w2), com as pontas arredondadas
function limb(ctx, p1, p2, w1, w2) {
  const a = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  const nx = -Math.sin(a);
  const ny = Math.cos(a);
  ctx.beginPath();
  ctx.moveTo(p1.x + nx * w1 / 2, p1.y + ny * w1 / 2);
  ctx.lineTo(p2.x + nx * w2 / 2, p2.y + ny * w2 / 2);
  ctx.arc(p2.x, p2.y, w2 / 2, a + Math.PI / 2, a - Math.PI / 2, true);
  ctx.lineTo(p1.x - nx * w1 / 2, p1.y - ny * w1 / 2);
  ctx.arc(p1.x, p1.y, w1 / 2, a - Math.PI / 2, a + Math.PI / 2, true);
  ctx.closePath();
}

// Joelho por cinemática inversa: quadril H, tornozelo A, ossos L1 e L2 (joelho à frente)
function knee(H, A, L1, L2) {
  const d = Math.min(Math.hypot(A.x - H.x, A.y - H.y), L1 + L2 - 0.5);
  const a = Math.atan2(A.y - H.y, A.x - H.x);
  const b = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
  return { x: H.x + Math.cos(a - b) * L1, y: H.y + Math.sin(a - b) * L1 };
}

export function drawTrex(ctx, b, t) {
  const R = TREX;
  const run = b.chasing;
  const ph = b.walk * (run ? 5 : 3.5);
  // Rugido: de tempos em tempos, quando não está perseguindo (0..1)
  const roar = run ? 0 : Math.min(1, Math.max(0, Math.sin(t * 0.8) - 0.7) * 3.3);
  const jaw = run ? 0.3 + Math.abs(Math.sin(t * 8)) * 0.12 : 0.04 + roar * 0.5;
  const bob = run ? -Math.abs(Math.sin(ph)) * 3 : Math.sin(t * 2) * 0.8;
  const tailSway = Math.sin(run ? ph : t * 1.4) * (run ? 5 : 3);
  const moving = Math.abs(Math.sin(ph)) > 0.001 || run;

  ctx.fillStyle = 'rgba(30, 10, 5, 0.35)';
  ctx.beginPath();
  ctx.ellipse(b.x, b.y + 3, 60, 7, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.scale(b.dir * TREX_SCALE, TREX_SCALE);
  ctx.translate(-8, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // ---- Pernas (a de trás mais escura, desenhada antes do corpo)
  const leg = (hip, p, far) => {
    const stride = run ? 18 : moving ? 9 : 0;
    const lift = Math.max(0, -Math.cos(p)) * (run ? 10 : moving ? 4 : 0);
    const H = { x: hip.x, y: hip.y + bob };
    const A = { x: hip.x + 8 + Math.sin(p) * stride, y: -9 - lift };
    const K = knee(H, A, 30, 28);
    const dark = far ? R.skin[2] : R.skin[1];
    // Coxa musculosa
    const tg = ctx.createRadialGradient(H.x - 6, H.y - 8, 3, H.x, H.y + 6, 30);
    tg.addColorStop(0, far ? R.skin[1] : R.skin[0]);
    tg.addColorStop(1, dark);
    ctx.fillStyle = tg;
    ctx.strokeStyle = TREX_LINE;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    const ma = Math.atan2(K.y - H.y, K.x - H.x);
    ctx.ellipse(H.x + (K.x - H.x) * 0.38, H.y + (K.y - H.y) * 0.38, 25, 18, ma, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // Canela e pé (metatarso), afunilando
    ctx.fillStyle = dark;
    limb(ctx, K, A, 15, 9);
    ctx.fill();
    ctx.stroke();
    // Pé com três dedos e garras
    const toes = [[17, 0], [14, -2.5], [10, 1.5]];
    for (const [i, [dx, dy]] of toes.entries()) {
      const tip = { x: A.x + dx, y: Math.min(0, A.y + 9 + dy * 0.3) };
      ctx.fillStyle = i === 1 && !far ? R.skin[2] : dark;
      limb(ctx, { x: A.x + 1, y: A.y + 3 }, tip, 7, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = R.claw;
      ctx.beginPath();
      ctx.moveTo(tip.x - 1, tip.y - 2.2);
      ctx.quadraticCurveTo(tip.x + 4, tip.y - 2, tip.x + 5, tip.y + 0.6);
      ctx.lineTo(tip.x, tip.y + 1.4);
      ctx.fill();
    }
    // Esporão de trás
    ctx.fillStyle = dark;
    limb(ctx, { x: A.x - 1, y: A.y + 4 }, { x: A.x - 7, y: Math.min(0, A.y + 8) }, 5, 3);
    ctx.fill();
  };
  leg({ x: -4, y: -58 }, ph + Math.PI, true);

  // ---- Corpo (gira em torno do quadril: inclina na corrida, empina ao rugir)
  ctx.save();
  ctx.translate(0, bob);
  ctx.translate(-8, -60);
  ctx.rotate(run ? 0.1 : -roar * 0.06);
  ctx.translate(8, 60);

  const arm = (dx, far) => {
    const w = Math.sin(t * (run ? 14 : 5)) * (run ? 3 : 1.5);
    const S = { x: 30 + dx, y: -66 };
    const E = { x: 38 + dx, y: -58 + w * 0.3 };
    const Hd = { x: 45 + dx, y: -60 + w };
    ctx.fillStyle = far ? R.skin[2] : R.skin[1];
    ctx.strokeStyle = TREX_LINE;
    ctx.lineWidth = 1.5;
    limb(ctx, S, E, 7, 5.5);
    ctx.fill();
    ctx.stroke();
    limb(ctx, E, Hd, 5.5, 4);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = R.claw;
    ctx.lineWidth = 1.4;
    for (const k of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(Hd.x + 1, Hd.y + k * 1.2);
      ctx.quadraticCurveTo(Hd.x + 5, Hd.y + k * 1.5, Hd.x + 6, Hd.y + 2.5 + k);
      ctx.stroke();
    }
  };
  arm(-5, true);

  // Silhueta única: ponta do rabo → costas → pescoço → garganta → barriga → rabo
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(-96, -64 + tailSway);
    ctx.bezierCurveTo(-74, -72 + tailSway * 0.6, -48, -84, -24, -86);
    ctx.bezierCurveTo(-6, -92, 14, -93, 26, -88);
    ctx.bezierCurveTo(32, -96, 38, -104, 44, -108);
    ctx.lineTo(60, -92);
    ctx.bezierCurveTo(54, -80, 46, -70, 40, -62);
    ctx.bezierCurveTo(34, -46, 12, -40, -6, -44);
    ctx.bezierCurveTo(-22, -46, -34, -54, -48, -58);
    ctx.bezierCurveTo(-66, -61, -82, -61, -96, -61 + tailSway);
    ctx.closePath();
  };
  const bg = ctx.createLinearGradient(0, -100, 0, -42);
  bg.addColorStop(0, R.skin[0]);
  bg.addColorStop(0.55, R.skin[1]);
  bg.addColorStop(1, R.skin[2]);
  ctx.fillStyle = bg;
  body();
  ctx.fill();
  ctx.save();
  body();
  ctx.clip();
  // Barriga e garganta claras
  ctx.fillStyle = R.belly;
  ctx.beginPath();
  ctx.ellipse(16, -44, 34, 13, -0.35, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(48, -72, 7, 16, 0.5, 0, TAU);
  ctx.fill();
  // Dobras da barriga
  ctx.strokeStyle = 'rgba(120, 130, 70, 0.45)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const x = -2 + i * 7;
    ctx.beginPath();
    ctx.moveTo(x, -54 + i * 1.5);
    ctx.quadraticCurveTo(x + 3, -48 + i, x + 1, -41 + i * 0.6);
    ctx.stroke();
  }
  // Listras escuras atravessando as costas e o rabo
  ctx.fillStyle = R.stripe;
  ctx.globalAlpha = 0.75;
  for (const [x, len] of [[-78, 10], [-62, 13], [-46, 16], [-30, 18], [-14, 19], [2, 18], [17, 15]]) {
    ctx.beginPath();
    ctx.moveTo(x - 3, -100);
    ctx.quadraticCurveTo(x + 2, -90, x + 1, -100 + len + 10);
    ctx.quadraticCurveTo(x + 6, -90, x + 5, -100);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Escamas
  ctx.strokeStyle = 'rgba(25, 50, 15, 0.22)';
  ctx.lineWidth = 0.9;
  for (let y = -94, r = 0; y < -46; y += 5.5, r++) {
    for (let x = -94 + (r % 2) * 3.5; x < 56; x += 7) {
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }
  }
  // Volume: luz em cima, sombra embaixo
  const sh = ctx.createLinearGradient(0, -100, 0, -40);
  sh.addColorStop(0, 'rgba(255, 255, 210, 0.22)');
  sh.addColorStop(0.35, 'rgba(255, 255, 210, 0)');
  sh.addColorStop(0.7, 'rgba(20, 40, 10, 0)');
  sh.addColorStop(1, 'rgba(20, 40, 10, 0.4)');
  ctx.fillStyle = sh;
  ctx.fillRect(-100, -110, 170, 75);
  ctx.restore();
  ctx.strokeStyle = TREX_LINE;
  ctx.lineWidth = 2;
  body();
  ctx.stroke();
  // Escamas grossas (escudos) em fila sobre a linha das costas
  const bez = (p0, p1, p2, p3, u) => (1 - u) ** 3 * p0 + 3 * (1 - u) ** 2 * u * p1 + 3 * (1 - u) * u * u * p2 + u ** 3 * p3;
  ctx.fillStyle = R.skin[2];
  for (let i = 1; i < 8; i++) {
    const u = i / 8;
    const seg = u < 0.55 ? [[-96, -74, -48, -24], [-64 + tailSway, -72 + tailSway * 0.6, -84, -86]] : [[-24, -6, 14, 26], [-86, -92, -93, -88]];
    const k = u < 0.55 ? u / 0.55 : (u - 0.55) / 0.45;
    const x = bez(...seg[0], k);
    const y = bez(...seg[1], k);
    ctx.beginPath();
    ctx.ellipse(x, y + 0.5, 3.2, 2, 0, Math.PI, 0);
    ctx.fill();
  }

  // ---- Cabeçorra (ergue ao rugir, baixa um pouco na corrida)
  ctx.save();
  ctx.translate(51, -97);
  ctx.rotate(-roar * 0.4 + (run ? 0.1 + Math.sin(ph * 2) * 0.03 : Math.sin(t * 2) * 0.02));
  const hinge = { x: -2, y: 4 };
  // Boca por dentro (atrás da mandíbula e do crânio)
  const jx = (x, y) => hinge.x + (x - hinge.x) * Math.cos(jaw) - (y - hinge.y) * Math.sin(jaw);
  const jy = (x, y) => hinge.y + (x - hinge.x) * Math.sin(jaw) + (y - hinge.y) * Math.cos(jaw);
  ctx.fillStyle = R.mouth;
  ctx.beginPath();
  ctx.moveTo(hinge.x, hinge.y);
  ctx.lineTo(42, 4);
  ctx.lineTo(jx(40, 5), jy(40, 5));
  ctx.closePath();
  ctx.fill();
  if (jaw > 0.15) {
    ctx.fillStyle = R.tongue;
    ctx.beginPath();
    ctx.ellipse(jx(18, 6), jy(18, 6) - 1.5, 13, 3.2, jaw * 0.6, 0, TAU);
    ctx.fill();
  }
  // Mandíbula de baixo
  ctx.save();
  ctx.translate(hinge.x, hinge.y);
  ctx.rotate(jaw);
  ctx.translate(-hinge.x, -hinge.y);
  ctx.fillStyle = R.teeth;
  for (let x = 10, i = 0; x < 38; x += 5, i++) {
    ctx.beginPath();
    ctx.moveTo(x, 5);
    ctx.lineTo(x + 1.8, 5 - (i % 2 ? 3.5 : 5));
    ctx.lineTo(x + 3.6, 5);
    ctx.fill();
  }
  const jg = ctx.createLinearGradient(0, 4, 0, 16);
  jg.addColorStop(0, R.skin[1]);
  jg.addColorStop(1, R.belly);
  ctx.fillStyle = jg;
  ctx.beginPath();
  ctx.moveTo(-10, 4);
  ctx.lineTo(42, 5);
  ctx.bezierCurveTo(44, 8, 42, 12, 36, 13);
  ctx.bezierCurveTo(20, 16, 4, 16, -8, 12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = TREX_LINE;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.restore();

  // Crânio de cima com o focinho comprido
  const skull = () => {
    ctx.beginPath();
    ctx.moveTo(-12, 6);
    ctx.bezierCurveTo(-16, -8, -8, -22, 8, -22);
    ctx.bezierCurveTo(18, -23, 22, -17, 30, -14);
    ctx.bezierCurveTo(40, -12, 47, -8, 47, -1);
    ctx.bezierCurveTo(47, 3, 45, 5, 41, 5);
    ctx.lineTo(0, 6);
    ctx.closePath();
  };
  const hg = ctx.createLinearGradient(0, -22, 0, 6);
  hg.addColorStop(0, R.skin[0]);
  hg.addColorStop(1, R.skin[1]);
  ctx.fillStyle = hg;
  skull();
  ctx.fill();
  ctx.save();
  skull();
  ctx.clip();
  // Faixa escura no focinho, escamas e bochecha enrugada
  ctx.fillStyle = 'rgba(46, 74, 30, 0.45)';
  ctx.beginPath();
  ctx.ellipse(26, -16, 20, 4, 0.18, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(25, 50, 15, 0.25)';
  for (const [x, y] of [[20, -6], [26, -4], [32, -6], [24, 0], [30, 1], [36, -2], [-4, -6], [-6, 0]]) {
    ctx.beginPath();
    ctx.arc(x, y, 1.1, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(25, 50, 15, 0.4)';
  ctx.lineWidth = 1;
  for (const k of [0, 1, 2]) {
    ctx.beginPath();
    ctx.moveTo(-6 + k * 3, -4 + k);
    ctx.quadraticCurveTo(-3 + k * 3, 1, -6 + k * 3, 5);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255, 255, 210, 0.25)';
  ctx.beginPath();
  ctx.ellipse(18, -18, 14, 2.5, 0.1, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = TREX_LINE;
  ctx.lineWidth = 2;
  skull();
  ctx.stroke();
  // Dentes de cima, irregulares, aparecendo mesmo de boca fechada
  ctx.fillStyle = R.teeth;
  ctx.strokeStyle = 'rgba(120, 100, 70, 0.5)';
  ctx.lineWidth = 0.6;
  for (let x = 5, i = 0; x < 41; x += 4.6, i++) {
    const len = [5, 3.6, 6, 4, 5.4, 3.4, 4.6, 3][i % 8];
    ctx.beginPath();
    ctx.moveTo(x, 5);
    ctx.lineTo(x + 1.4, 5 + len);
    ctx.lineTo(x + 3.2, 5);
    ctx.fill();
    ctx.stroke();
  }
  // Narina
  ctx.fillStyle = '#22361A';
  ctx.beginPath();
  ctx.ellipse(41, -6, 2.4, 1.3, 0.4, 0, TAU);
  ctx.fill();
  // Olho fundo, com crista óssea brava por cima
  ctx.fillStyle = 'rgba(25, 45, 15, 0.45)';
  ctx.beginPath();
  ctx.ellipse(12, -11, 6, 4.5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = R.eye;
  ctx.beginPath();
  ctx.ellipse(12.5, -11, 3.8, 3.2, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1D1410';
  ctx.beginPath();
  ctx.ellipse(13.2, -11, 1, 2.8, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(11.6, -12.4, 0.9, 0, TAU);
  ctx.fill();
  ctx.fillStyle = R.skin[2];
  ctx.beginPath();
  ctx.moveTo(4, run || roar > 0.2 ? -17 : -16);
  ctx.quadraticCurveTo(12, run ? -18 : -20, 19, -14);
  ctx.lineTo(18, -12.5);
  ctx.quadraticCurveTo(12, run ? -15 : -16, 5, -13.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  arm(0, false);
  ctx.restore();

  leg({ x: -12, y: -56 }, ph, false);
  ctx.restore();
}

// ---------------------------------------------------------------- Caverna de pedra
// Mesmo lugar e mesma porta do iglu, 16 peças: 6 pedras da parede (duas fileiras),
// 4 pedras do topo, 2 presas de osso em volta da entrada, o respiro no alto (de onde
// sai a fumaça), o crânio de tricerátops em cima da porta, a tocha acesa e por
// último a porta: uma pedra redonda que rola e tampa a entrada.
const HW = 96;
const ROW_H = [44, 40];
const ROWS = [{ y1: 0, hw: HW }, { y1: -44, hw: 78 }];
const SLABS = [{ x: -52, y: -96, r: 22 }, { x: -18, y: -110, r: 24 }, { x: 18, y: -110, r: 24 }, { x: 52, y: -96, r: 22 }];
const VENT = { x: 0, y: -132 };
const SKULL = { x: 0, y: -80 };
const TORCH = { x: -126, y: 0 };

export const CAVE_DOOR = { x: IGLOO.x, bottom: SHORE_Y + 1, w: IGLOO.doorRx, h: IGLOO.doorH };
// Medidas da caverna (para o modelo 3D em src/m3d/dino.js)
export const CAVE = { HW, ROWS, ROW_H, SLABS, VENT, SKULL, TORCH };
const STONE_R = IGLOO.doorH / 2 + 5;

export const CAVE_PIECES = [
  ...Array.from({ length: 6 }, (_, i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const R = ROWS[row];
    const cw = (R.hw * 2) / 3;
    return { kind: 'wall', row, col, cx: -R.hw + cw * (col + 0.5), cy: R.y1 - ROW_H[row] / 2 };
  }),
  ...SLABS.map((s, i) => ({ kind: 'roof', i, cx: s.x, cy: s.y })),
  { kind: 'tusk', side: -1, cx: -34, cy: -36 },
  { kind: 'tusk', side: 1, cx: 34, cy: -36 },
  { kind: 'vent', cx: VENT.x, cy: VENT.y },
  { kind: 'skull', cx: SKULL.x, cy: SKULL.y },
  { kind: 'torch', cx: TORCH.x, cy: -40 },
  { kind: 'door', cx: 0, cy: -IGLOO.doorH / 2 },
];

// Respiro no alto da caverna (de onde sai a fumaça)
export const CAVE_VENT = { x: IGLOO.x + VENT.x, y: IGLOO.baseY + VENT.y - 6 };
export const BONE = '#EFE4C8';
export const CAVE_STONE = '#7A6E64';

const easeOutBack = (k) => 1 + 2.9 * (k - 1) ** 3 + 1.9 * (k - 1) ** 2;

// Pedra arredondada e irregular (seed fixa = mesmo formato sempre)
function boulder(ctx, cx, cy, rx, ry, seed, tone = 0) {
  const rnd = seeded(seed);
  const pts = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * TAU;
    const k = 0.86 + rnd() * 0.18;
    return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
  });
  const g = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
  g.addColorStop(0, tone ? '#9A8C80' : '#A89A8C');
  g.addColorStop(0.55, CAVE_STONE);
  g.addColorStop(1, '#4A4038');
  ctx.fillStyle = g;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(40, 30, 24, 0.6)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  // Musgo no alto e uma rachadura
  ctx.fillStyle = 'rgba(100, 150, 60, 0.55)';
  ctx.beginPath();
  ctx.ellipse(cx - rx * 0.2, cy - ry * 0.7, rx * 0.4, ry * 0.18, -0.2, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40, 30, 24, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx + rx * 0.1, cy - ry * 0.3);
  ctx.lineTo(cx + rx * 0.25, cy + ry * 0.1);
  ctx.lineTo(cx + rx * 0.15, cy + ry * 0.4);
  ctx.stroke();
}

function drawCaveWall(ctx, row, col) {
  const R = ROWS[row];
  const cw = (R.hw * 2) / 3;
  const cx = -R.hw + cw * (col + 0.5);
  const cy = R.y1 - ROW_H[row] / 2;
  boulder(ctx, cx, cy, cw / 2 + 3, ROW_H[row] / 2 + 3, 11 + row * 3 + col, (row + col) % 2);
}

function drawVent(ctx, t) {
  const { x, y } = VENT;
  ctx.fillStyle = '#5A4E46';
  ctx.beginPath();
  ctx.ellipse(x, y + 2, 14, 7, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1A120E';
  ctx.beginPath();
  ctx.ellipse(x, y, 9, 4, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = `rgba(255, 150, 60, ${0.35 + Math.sin(t * 6) * 0.1})`;
  ctx.beginPath();
  ctx.ellipse(x, y + 0.5, 6, 2.4, 0, 0, TAU);
  ctx.fill();
}

// Presa de osso curvada em volta da entrada
function drawTusk(ctx, side) {
  const d = CAVE_DOOR;
  const x0 = side * (d.w + 7);
  const by = d.bottom - IGLOO.baseY;
  ctx.save();
  ctx.fillStyle = BONE;
  ctx.strokeStyle = 'rgba(120, 100, 70, 0.7)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x0 - 4, by);
  ctx.quadraticCurveTo(x0 + side * 6, by - 50, x0 - side * 10, by - 78);
  ctx.quadraticCurveTo(x0 + side * 2, by - 52, x0 + 4, by);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(160, 140, 100, 0.6)';
  for (const k of [0.25, 0.5]) {
    ctx.beginPath();
    ctx.moveTo(x0 - 4 + side * k * 4, by - 72 * k);
    ctx.lineTo(x0 + 4 + side * k * 6, by - 72 * k - 2);
    ctx.stroke();
  }
  ctx.restore();
}

// Crânio de tricerátops com o babado e os três chifres, em cima da porta
function drawSkull(ctx) {
  const { x, y } = SKULL;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#D8CCAE';
  ctx.beginPath();
  ctx.ellipse(0, -2, 22, 12, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = 'rgba(120, 100, 70, 0.6)';
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.arc(i * 8, -10 + Math.abs(i) * 2, 2, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = BONE;
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 9, 0, 0, TAU);
  ctx.fill();
  // Chifres
  for (const [hx, tipX, tipY] of [[-6, -14, -20], [6, 14, -20], [0, 0, 12]]) {
    ctx.beginPath();
    ctx.moveTo(hx - 3, hx ? -3 : 5);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(hx + 3, hx ? -3 : 5);
    ctx.fill();
  }
  // Olhos vazios
  ctx.fillStyle = '#2A1E18';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * 4.5, -1, 2.4, 3, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// Tocha de madeira fincada no chão, com chama dançando e luz em volta
function drawTorch(ctx, t) {
  const { x } = TORCH;
  ctx.save();
  ctx.translate(x, 0);
  ctx.strokeStyle = '#6A4426';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(2, -52);
  ctx.stroke();
  ctx.fillStyle = '#4A3020';
  ctx.fillRect(-3, -58, 10, 8);
  torchFlame(ctx, t);
  ctx.restore();
}

// Chama da tocha com a luz em volta (também na caverna 3D)
export function drawCaveTorchFlame(ctx, t) {
  ctx.save();
  ctx.translate(TORCH.x, 0);
  torchFlame(ctx, t);
  ctx.restore();
}

function torchFlame(ctx, t) {
  const gl = ctx.createRadialGradient(2, -66, 2, 2, -66, 40);
  gl.addColorStop(0, `rgba(255, 190, 80, ${0.45 + Math.sin(t * 9) * 0.07})`);
  gl.addColorStop(1, 'rgba(255, 190, 80, 0)');
  ctx.fillStyle = gl;
  ctx.fillRect(-38, -106, 80, 80);
  const f = Math.sin(t * 14) * 2;
  ctx.fillStyle = '#FF7A1A';
  ctx.beginPath();
  ctx.moveTo(-4, -58);
  ctx.quadraticCurveTo(-6 + f, -70, 2 + f, -82);
  ctx.quadraticCurveTo(10, -70, 8, -58);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#FFE070';
  ctx.beginPath();
  ctx.moveTo(-1, -58);
  ctx.quadraticCurveTo(-1 + f * 0.5, -66, 2 + f * 0.6, -73);
  ctx.quadraticCurveTo(6, -66, 5, -58);
  ctx.closePath();
  ctx.fill();
}

function doorRect() {
  const d = CAVE_DOOR;
  return { x: d.x - d.w, y: d.bottom - d.h, w: d.w * 2, h: d.h };
}

// Contorno da entrada da caverna (arco arredondado)
function mouthPath(ctx) {
  const r = doorRect();
  ctx.beginPath();
  ctx.moveTo(r.x, r.y + r.h);
  ctx.lineTo(r.x, r.y + r.w / 2);
  ctx.arc(r.x + r.w / 2, r.y + r.w / 2, r.w / 2, Math.PI, 0);
  ctx.lineTo(r.x + r.w, r.y + r.h);
  ctx.closePath();
}

// Pedra redonda que rola da direita e tampa a entrada: k = 0 aberta, 1 fechada
export function doorStone(k) {
  const d = CAVE_DOOR;
  const travel = d.w + STONE_R + 14;
  const x = d.x + (1 - k) * travel;
  return { x, y: d.bottom - STONE_R + 2, r: STONE_R, angle: -(1 - k) * travel / STONE_R };
}

function drawDoorStone(ctx, k) {
  const s = doorStone(k);
  ctx.save();
  ctx.fillStyle = 'rgba(20, 10, 5, 0.35)';
  ctx.beginPath();
  ctx.ellipse(s.x + 3, s.y + s.r - 1, s.r * 0.9, 5, 0, 0, TAU);
  ctx.fill();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.angle);
  const g = ctx.createRadialGradient(-s.r * 0.35, -s.r * 0.4, 3, 0, 0, s.r * 1.1);
  g.addColorStop(0, '#B0A294');
  g.addColorStop(0.6, '#7E7064');
  g.addColorStop(1, '#4A4038');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, s.r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40, 30, 24, 0.7)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Marcas na pedra (mostram que ela gira) e uma pintura rupestre de mãozinha
  ctx.strokeStyle = 'rgba(40, 30, 24, 0.45)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-s.r * 0.6, -s.r * 0.2);
  ctx.lineTo(-s.r * 0.1, s.r * 0.1);
  ctx.lineTo(s.r * 0.2, s.r * 0.6);
  ctx.moveTo(s.r * 0.3, -s.r * 0.7);
  ctx.lineTo(s.r * 0.5, -s.r * 0.2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(190, 70, 40, 0.7)';
  ctx.beginPath();
  ctx.ellipse(s.r * 0.15, -s.r * 0.15, 5, 6, 0, 0, TAU);
  ctx.fill();
  for (let i = 0; i < 4; i++) ctx.fillRect(s.r * 0.15 - 5 + i * 3, -s.r * 0.15 - 13, 2, 7);
  ctx.restore();
}

// Desenha a caverna com as peças já construídas (igloo = estado da construção)
export function drawCave(ctx, igloo, t) {
  const n = igloo.count;
  ctx.save();
  ctx.translate(IGLOO.x, IGLOO.baseY);
  ctx.fillStyle = 'rgba(20, 10, 5, 0.4)';
  ctx.beginPath();
  ctx.ellipse(6, 3, HW + 30, 9, 0, 0, TAU);
  ctx.fill();
  if (n < RULES.iglooPieces) {
    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = 'rgba(255, 220, 170, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, HW + 4, 136, 0, Math.PI, 0);
    ctx.stroke();
    ctx.restore();
  }
  // Ordem de desenho: respiro atrás das pedras do topo, paredes, topo, presas,
  // crânio e tocha
  const order = [12, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14];
  for (const i of order) {
    if (i >= n) continue;
    const a = igloo.anim[i];
    ctx.save();
    ctx.globalAlpha = Math.min(1, a * 3);
    ctx.translate(0, -(1 - easeOutBack(a)) * 46);
    const p = CAVE_PIECES[i];
    if (p.kind === 'wall') drawCaveWall(ctx, p.row, p.col);
    else if (p.kind === 'roof') {
      const s = SLABS[p.i];
      boulder(ctx, s.x, s.y, s.r + 4, s.r, 31 + p.i, p.i % 2);
    } else if (p.kind === 'vent') drawVent(ctx, t);
    else if (p.kind === 'tusk' && n < RULES.iglooPieces) drawTusk(ctx, p.side); // pronta: vão por cima da pedra
    else if (p.kind === 'skull') drawSkull(ctx);
    else if (p.kind === 'torch') drawTorch(ctx, t);
    ctx.restore();
  }
  ctx.restore();
  if (!drawCaveDoor(ctx, igloo, t)) return;
  // Presas de osso por cima da pedra, emoldurando a entrada
  ctx.save();
  ctx.translate(IGLOO.x, IGLOO.baseY);
  drawTusk(ctx, -1);
  drawTusk(ctx, 1);
  ctx.restore();
}

// Porta (peça 16): entrada escura, luz da fogueira quando acesa e a pedra (ou o
// contorno tracejado enquanto não está pronta; devolve false nesse caso). Também
// usada pela caverna 3D
export function drawCaveDoor(ctx, igloo, t) {
  const n = igloo.count;
  const r = doorRect();
  if (n < RULES.iglooPieces) {
    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = 'rgba(255, 220, 170, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(r.x - 4, r.y - 4, r.w + 8, r.h + 4);
    ctx.restore();
    return false;
  }
  const a = igloo.anim[RULES.iglooPieces - 1];
  ctx.save();
  ctx.globalAlpha = Math.min(1, a * 3);
  ctx.translate(0, -(1 - easeOutBack(a)) * 30);
  mouthPath(ctx);
  const dg = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  dg.addColorStop(0, '#0E0806');
  dg.addColorStop(1, '#2A1A10');
  ctx.fillStyle = dg;
  ctx.fill();
  if (igloo.lit) {
    ctx.fillStyle = `rgba(255, 170, 70, ${0.5 + Math.sin(t * 6) * 0.1})`;
    ctx.fill();
  }
  drawDoorStone(ctx, igloo.curtain);
  ctx.restore();
  return true;
}

// Desenhado POR CIMA do personagem enquanto ele entra
export function drawCaveDoorFront(ctx, igloo, t) {
  if (igloo.count < RULES.iglooPieces) return;
  const r = doorRect();
  ctx.save();
  if (igloo.shade > 0) {
    ctx.save();
    mouthPath(ctx);
    ctx.clip();
    ctx.fillStyle = `rgba(14, 8, 4, ${0.45 * igloo.shade})`;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  }
  drawDoorStone(ctx, igloo.curtain);
  ctx.translate(IGLOO.x, IGLOO.baseY);
  if (!(dinoArt.on && dinoArt.tusks?.(ctx))) {
    drawTusk(ctx, -1);
    drawTusk(ctx, 1);
  }
  ctx.restore();
}
