// Fase especial de Natal (fase 5): trenó do Papai Noel voando ao fundo,
// árvores de Natal na costa, pisca-pisca no iglu, gorro no urso e suéter no
// personagem (os dois últimos ficam em sprites.js).
import { W, IGLOO } from './config.js';

// ---------------------------------------------------------------- Trenó
export const SLEIGH = {
  firstDelay: 5,     // segundos até a primeira passagem na fase
  minGap: 13,        // intervalo entre passagens (s)
  maxGap: 22,
  speed: 175,        // px/s, bem no fundo do céu
  yMin: 122,     // abaixo dos painéis do HUD, na frente das montanhas
  yMax: 142,
  margin: 260,       // começa/termina fora da tela
  scale: 0.72,       // está longe: pequeno
};

// De vez em quando o trenó atravessa o céu, de um lado ou do outro.
export class Sleigh {
  constructor(rand = Math.random) {
    this.rand = rand;
    this.reset();
  }

  reset() {
    this.active = false;
    this.timer = SLEIGH.firstDelay;
    this.passes = 0;
    this.x = -SLEIGH.margin;
    this.y = SLEIGH.yMin;
    this.dir = 1;
    this.t = 0;
  }

  // Retorna true no instante em que uma passagem começa (para tocar o som).
  update(dt) {
    if (this.active) {
      this.t += dt;
      this.x += this.dir * SLEIGH.speed * dt;
      if (this.x < -SLEIGH.margin - 1 || this.x > W + SLEIGH.margin + 1) {
        this.active = false;
        this.timer = SLEIGH.minGap + this.rand() * (SLEIGH.maxGap - SLEIGH.minGap);
      }
      return false;
    }
    this.timer -= dt;
    if (this.timer > 0) return false;
    this.dir = this.rand() < 0.5 ? 1 : -1;
    this.x = this.dir > 0 ? -SLEIGH.margin : W + SLEIGH.margin;
    this.y = SLEIGH.yMin + this.rand() * (SLEIGH.yMax - SLEIGH.yMin);
    this.t = 0;
    this.active = true;
    this.passes++;
    return true;
  }
}

// Trenó com duas renas à frente, Papai Noel e o saco de presentes.
// Desenhado de frente para a direita; `dir` espelha.
export function drawSleigh(ctx, s, t) {
  if (!s.active) return;
  const bob = Math.sin(s.t * 3.2) * 6;
  ctx.save();
  ctx.translate(s.x, s.y + bob);

  // Rastro de brilhos dourados atrás do trenó
  for (let i = 0; i < 14; i++) {
    const back = 40 + i * 13;
    const tw = Math.max(0, Math.sin(t * 9 + i * 1.7));
    ctx.globalAlpha = (1 - i / 14) * (0.35 + 0.65 * tw);
    ctx.fillStyle = i % 3 ? '#FFE7A0' : '#FFFFFF';
    const px = -s.dir * back * SLEIGH.scale;
    const py = Math.sin(i * 0.9 - s.t * 3.2) * 5 + 4;
    const r = 1.2 + tw * 1.4;
    ctx.fillRect(px - r, py - 0.4, r * 2, 0.8);
    ctx.fillRect(px - 0.4, py - r, 0.8, r * 2);
  }
  ctx.globalAlpha = 1;

  ctx.scale(s.dir * SLEIGH.scale, SLEIGH.scale);

  // Renas (a da frente um pouco mais alta, galopando)
  const gallop = s.t * 9;
  drawReindeer(ctx, 128, -22, gallop + 1.2);
  drawReindeer(ctx, 68, -14, gallop);
  // Rédeas
  ctx.strokeStyle = '#8A5A2B';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(14, -18);
  ctx.quadraticCurveTo(40, -10, 62, -22);
  ctx.quadraticCurveTo(92, -26, 122, -30);
  ctx.stroke();

  // Saco de presentes
  ctx.fillStyle = '#7A4E2A';
  ctx.beginPath();
  ctx.ellipse(-26, -24, 14, 15, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5E3A1E';
  ctx.fillRect(-30, -41, 8, 5);
  // Presentes saindo do saco
  ctx.fillStyle = '#2E9E5B';
  ctx.fillRect(-36, -44, 9, 9);
  ctx.fillStyle = '#F4D35E';
  ctx.fillRect(-32.5, -44, 2, 9);

  // Papai Noel sentado
  ctx.fillStyle = '#C8242B';
  ctx.beginPath();
  ctx.roundRect(-14, -36, 20, 24, 6);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(-14, -16, 20, 4);
  // Braço segurando a rédea
  ctx.fillStyle = '#B01E25';
  ctx.beginPath();
  ctx.roundRect(0, -30, 14, 6, 3);
  ctx.fill();
  ctx.fillStyle = '#1F1F1F';
  ctx.beginPath();
  ctx.arc(14, -27, 3, 0, Math.PI * 2);
  ctx.fill();
  // Rosto, barba e gorro
  ctx.fillStyle = '#F2C3A0';
  ctx.beginPath();
  ctx.arc(-3, -43, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.ellipse(-2, -37, 7.5, 6, 0, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = '#C8242B';
  ctx.beginPath();
  ctx.moveTo(-10, -47);
  ctx.quadraticCurveTo(-4, -60, 4, -48);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-8, -52);
  ctx.quadraticCurveTo(-14, -58, -17, -50);
  ctx.lineTo(-10, -48);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(-11, -49, 16, 3.5);
  ctx.beginPath();
  ctx.arc(-17, -49, 2.6, 0, Math.PI * 2);
  ctx.fill();

  // Trenó: caixa vermelha com friso dourado e patins curvos
  const g = ctx.createLinearGradient(0, -22, 0, 0);
  g.addColorStop(0, '#E0353B');
  g.addColorStop(1, '#8E1418');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-44, -26);
  ctx.quadraticCurveTo(-46, -4, -30, -4);
  ctx.lineTo(16, -4);
  ctx.quadraticCurveTo(30, -6, 30, -20);
  ctx.quadraticCurveTo(22, -14, 12, -16);
  ctx.lineTo(-30, -16);
  ctx.quadraticCurveTo(-36, -20, -44, -26);
  ctx.fill();
  ctx.strokeStyle = '#F4C542';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-40, -10);
  ctx.lineTo(18, -10);
  ctx.stroke();
  // Patins
  ctx.strokeStyle = '#D9B04A';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-36, 4);
  ctx.lineTo(26, 4);
  ctx.quadraticCurveTo(40, 4, 38, -6);
  ctx.quadraticCurveTo(36, -12, 31, -8);
  ctx.moveTo(-24, -4);
  ctx.lineTo(-24, 4);
  ctx.moveTo(10, -4);
  ctx.lineTo(10, 4);
  ctx.stroke();
  ctx.restore();
}

function drawReindeer(ctx, x, y, gallop) {
  ctx.save();
  ctx.translate(x, y);
  const legs = [[-12, 0], [-7, 1.8], [8, 3.1], [13, 4.6]];
  ctx.strokeStyle = '#5A3A22';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  for (const [lx, ph] of legs) {
    const a = Math.sin(gallop + ph) * 0.7;
    ctx.beginPath();
    ctx.moveTo(lx, 2);
    ctx.lineTo(lx + Math.sin(a) * 12, 2 + Math.cos(a) * 12);
    ctx.stroke();
  }
  // Corpo, pescoço e cabeça
  ctx.fillStyle = '#8B5A33';
  ctx.beginPath();
  ctx.ellipse(0, 0, 19, 8, -0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#E9D8BE';
  ctx.beginPath();
  ctx.arc(-18, -3, 3, 0, Math.PI * 2); // rabinho
  ctx.fill();
  ctx.fillStyle = '#8B5A33';
  ctx.beginPath();
  ctx.moveTo(12, -4);
  ctx.lineTo(20, -16);
  ctx.lineTo(26, -14);
  ctx.lineTo(19, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(26, -17, 7, 4.5, 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3B2414';
  ctx.beginPath();
  ctx.arc(32.5, -15.5, 1.8, 0, Math.PI * 2);
  ctx.fill();
  // Galhada
  ctx.strokeStyle = '#D8C29A';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(23, -21);
  ctx.lineTo(19, -31);
  ctx.moveTo(21, -26);
  ctx.lineTo(15, -28);
  ctx.moveTo(25, -21);
  ctx.lineTo(27, -31);
  ctx.moveTo(26, -27);
  ctx.lineTo(31, -30);
  ctx.stroke();
  // Arreio com sininho dourado
  ctx.fillStyle = '#B3262C';
  ctx.fillRect(9, -6, 4, 11);
  ctx.fillStyle = '#F4C542';
  ctx.beginPath();
  ctx.arc(11, 6, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- Cenário
const BULBS = ['#FF4B4B', '#3DDC84', '#FFD54A', '#4FB3FF', '#FF7AD9'];

// Lâmpada do pisca-pisca: acende em sequência, com halo.
function bulb(ctx, x, y, i, t, r = 2.6) {
  const on = Math.sin(t * 3 + i * 1.3) > -0.2;
  const c = BULBS[i % BULBS.length];
  if (on) {
    const h = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
    h.addColorStop(0, c + 'AA');
    h.addColorStop(1, c + '00');
    ctx.fillStyle = h;
    ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
  }
  ctx.globalAlpha = on ? 1 : 0.45;
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// Árvores de Natal na costa (atrás do personagem e do urso).
export const TREES = [
  { x: 54, base: 238, h: 104 },
  { x: 138, base: 232, h: 72 },
];

export function drawChristmasTrees(ctx, t) {
  TREES.forEach((tr, k) => drawTree(ctx, tr, t, k));
}

function drawTree(ctx, { x, base, h }, t, k) {
  ctx.save();
  ctx.translate(x, base);
  const w = h * 0.62;
  // Sombra e tronco
  ctx.fillStyle = 'rgba(70, 105, 125, 0.25)';
  ctx.beginPath();
  ctx.ellipse(4, 2, w * 0.55, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5B3A22';
  ctx.fillRect(-5, -12, 10, 13);
  // Três camadas de galhos, com neve nas pontas
  const tiers = 3;
  for (let i = 0; i < tiers; i++) {
    const yb = -10 - i * h * 0.24;
    const yt = yb - h * 0.42;
    const hw = (w / 2) * (1 - i * 0.24);
    const g = ctx.createLinearGradient(-hw, 0, hw, 0);
    g.addColorStop(0, '#2F8F57');
    g.addColorStop(0.6, '#1F6B3F');
    g.addColorStop(1, '#134A2B');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, yt);
    ctx.lineTo(hw, yb);
    ctx.quadraticCurveTo(0, yb + 5, -hw, yb);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(245, 250, 252, 0.92)';
    ctx.beginPath();
    ctx.moveTo(-hw, yb);
    ctx.quadraticCurveTo(0, yb + 5, hw, yb);
    ctx.quadraticCurveTo(0, yb + 1, -hw, yb);
    ctx.fill();
    // Pisca-pisca em diagonal na camada
    for (let j = 0; j < 4; j++) {
      const u = (j + 0.5) / 4;
      const by = yt + (yb - yt) * (0.45 + u * 0.5);
      const bx = -hw * (0.75 - u * 1.4) * ((by - yt) / (yb - yt));
      bulb(ctx, bx, by, i * 4 + j + k * 7, t, h > 90 ? 2.6 : 2.1);
    }
  }
  // Estrela no topo, cintilando
  const top = -10 - (tiers - 1) * h * 0.24 - h * 0.42;
  const s = 7 * (h / 104) * (1 + Math.sin(t * 4 + k) * 0.1);
  const halo = ctx.createRadialGradient(0, top, 0, 0, top, s * 3);
  halo.addColorStop(0, 'rgba(255, 225, 120, 0.7)');
  halo.addColorStop(1, 'rgba(255, 225, 120, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(-s * 3, top - s * 3, s * 6, s * 6);
  ctx.fillStyle = '#FFD54A';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? s * 0.45 : s;
    ctx.lineTo(Math.cos(a) * r, top + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Pisca-pisca pendurado em guirlandas ao longo da cúpula do iglu pronto.
export function drawIglooLights(ctx, t) {
  const { rx, ry } = IGLOO;
  const anchors = [];
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + 0.32 + (i / n) * (Math.PI - 0.64);
    anchors.push([IGLOO.x + Math.cos(a) * rx * 0.97, IGLOO.baseY + Math.sin(a) * ry * 0.97]);
  }
  ctx.save();
  ctx.strokeStyle = 'rgba(40, 70, 50, 0.85)';
  ctx.lineWidth = 1.2;
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = anchors[i];
    const [x1, y1] = anchors[i + 1];
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2 + 9;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x1, y1);
    ctx.stroke();
    for (const u of [0.25, 0.5, 0.75]) {
      const bx = (1 - u) ** 2 * x0 + 2 * (1 - u) * u * cx + u * u * x1;
      const by = (1 - u) ** 2 * y0 + 2 * (1 - u) * u * cy + u * u * y1;
      bulb(ctx, bx, by + 2, idx++, t, 2.4);
    }
  }
  ctx.restore();
}
