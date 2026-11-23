// Chocolate quente (fases normais a partir da 11): uma caneca fumegante que passa
// pelas fileiras no máximo 2 vezes por fase e é pega como os peixes (de pé na
// fileira). Esquenta o personagem em 10° (sem passar da temperatura inicial),
// dando mais tempo na fase; o que sobrar vira bônus de temperatura no fim.
import { RULES } from './config.js';
import { bonusArt } from './bonus.js';

export const HEAT = {
  from: 11,        // primeira fase com o chocolate quente
  count: 2,        // canecas por fase (no máximo)
  degrees: 10,     // graus que cada caneca devolve
  max: RULES.tempStart, // nunca passa da temperatura do começo da fase (45°)
  firstMin: 12,    // a primeira passa entre 12 e 30 s de fase
  firstMax: 30,
  gapMin: 14,      // intervalo até a segunda (nunca passam juntas)
  gapMax: 24,
  size: 32,        // largura de colisão
};
export const HEAT_KINDS = ['cocoa'];

// Canecas de uma fase (fases especiais não têm)
export function heatFor(level, special = null) {
  if (special || level < HEAT.from) return 0;
  return HEAT.count;
}

const TAU = Math.PI * 2;
export const MUG_RED = '#D8443A';

function glow(ctx, x, y, r, t) {
  const g = ctx.createRadialGradient(x, y, 2, x, y, r);
  g.addColorStop(0, `rgba(255, 150, 70, ${0.42 + Math.sin(t * 6) * 0.1})`);
  g.addColorStop(1, 'rgba(255, 150, 70, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// Fumacinha subindo em S da boca da caneca (por cima do 2D e do 3D)
export function drawSteam(ctx, x, y, t, scale = 1) {
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.7 + i / 3) % 1;
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.55 * Math.sin(k * Math.PI)})`;
    ctx.lineWidth = (3.2 - k * 1.6) * scale;
    const sx = x + (i - 1) * 5 * scale;
    const sy = y - k * 22 * scale;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.bezierCurveTo(sx + 4 * scale, sy - 4 * scale, sx - 4 * scale, sy - 8 * scale, sx, sy - 12 * scale);
    ctx.stroke();
  }
  ctx.restore();
}

function ring(ctx, x, y) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(x, y + 9, 16, 3, 0, 0, TAU);
  ctx.stroke();
}

// Caneca vermelha com faixa branca, chocolate com espuma e a fumaça
export function drawMug(ctx) {
  // Alça (atrás, do lado direito)
  ctx.strokeStyle = '#A82E26';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(11, -11, 6, 6.5, 0, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  // Corpo
  const g = ctx.createLinearGradient(-11, 0, 11, 0);
  g.addColorStop(0, '#FF8A70');
  g.addColorStop(0.35, MUG_RED);
  g.addColorStop(1, '#8E2620');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-11, -22);
  ctx.lineTo(11, -22);
  ctx.lineTo(10, -1);
  ctx.quadraticCurveTo(0, 2, -10, -1);
  ctx.closePath();
  ctx.fill();
  // Faixa branca com floquinho
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.fillRect(-10.7, -14, 21.2, 3.5);
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(0, -6.5, 1.6, 0, TAU);
  ctx.fill();
  // Boca: chocolate com espuma
  ctx.fillStyle = '#F4D2D0';
  ctx.beginPath();
  ctx.ellipse(0, -22, 11, 3.2, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#6A3A1E';
  ctx.beginPath();
  ctx.ellipse(0, -22, 9, 2.3, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#FFF4E6';
  for (const [x, r] of [[-3, 1.8], [1.5, 2.2], [4.5, 1.4]]) {
    ctx.beginPath();
    ctx.arc(x, -22.4, r, 0, TAU);
    ctx.fill();
  }
  // Reflexo
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.fillRect(-8, -19, 2.2, 13);
}

// Item boiando na fileira (mesmo balanço do saco de dinheiro e do coração)
export function drawCocoa(ctx, c, y, t) {
  const bob = Math.sin(t * 3 + c.ph) * 3;
  const by = y - 4 + bob;
  glow(ctx, c.x, by - 12, 36, t);
  ctx.save();
  ctx.translate(c.x, by);
  ctx.rotate(Math.sin(t * 2 + c.ph) * 0.07);
  if (!(bonusArt.on && bonusArt.draw?.(ctx, 'cocoa'))) drawMug(ctx);
  ctx.restore();
  drawSteam(ctx, c.x, by - 26, t + c.ph);
  ring(ctx, c.x, y);
}
