// Prêmios das fases especiais: sacos de dinheiro (pontos) e corações (vidas).
// Passam pelas fileiras como os peixes, um de cada vez, e são pegos do mesmo
// jeito (estando de pé na fileira quando o prêmio passa). Mesmo desenho em todas
// as fases especiais, para o jogador reconhecer de cara.
export const BONUS = {
  bags: 3,          // sacos de dinheiro por fase especial
  hearts: 2,        // corações por fase especial
  bagPoints: 1500,  // pontos de cada saco
  first: 3,         // segundos até o primeiro prêmio
  gapMin: 4,        // intervalo entre um prêmio e o próximo (s)
  gapMax: 6,
  speed: 1,         // mesma velocidade dos bichos da fase (não os alcança)
  clearance: 260,   // distância livre exigida na entrada da fileira (px)
  size: 32,         // largura de colisão
};
export const BONUS_KINDS = ['bag', 'heart'];

export const BAG_GOLD = '#E8B73A';
export const HEART_RED = '#F2384A';

const TAU = Math.PI * 2;

// Brilho dourado/rosado em volta do prêmio (aparece em qualquer cenário)
function glow(ctx, x, y, r, rgb, t) {
  const g = ctx.createRadialGradient(x, y, 2, x, y, r);
  g.addColorStop(0, `rgba(${rgb}, ${0.45 + Math.sin(t * 6) * 0.1})`);
  g.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function ring(ctx, x, y) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(x, y + 9, 16, 3, 0, 0, TAU);
  ctx.stroke();
}

// Brilhinhos em cruz girando em volta
function twinkles(ctx, x, y, t, color) {
  ctx.fillStyle = color;
  for (let i = 0; i < 3; i++) {
    const a = t * 2 + (i * TAU) / 3;
    const k = 0.5 + 0.5 * Math.sin(t * 7 + i * 2);
    const sx = x + Math.cos(a) * 24;
    const sy = y + Math.sin(a) * 14;
    ctx.globalAlpha = k;
    ctx.fillRect(sx - 3, sy - 0.6, 6, 1.2);
    ctx.fillRect(sx - 0.6, sy - 3, 1.2, 6);
  }
  ctx.globalAlpha = 1;
}

// Saco de dinheiro boiando: dourado, amarrado com cordão, com o "$" na frente
export function drawMoneyBag(ctx, c, y, t) {
  const bob = Math.sin(t * 3 + c.ph) * 3;
  const by = y - 4 + bob;
  glow(ctx, c.x, by - 12, 34, '255, 215, 90', t);
  ctx.save();
  ctx.translate(c.x, by);
  ctx.rotate(Math.sin(t * 2 + c.ph) * 0.08);
  // Corpo do saco
  const g = ctx.createRadialGradient(-5, -16, 2, 0, -10, 18);
  g.addColorStop(0, '#FFE9A0');
  g.addColorStop(0.5, BAG_GOLD);
  g.addColorStop(1, '#A8761A');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-6, -22);
  ctx.quadraticCurveTo(-18, -16, -16, -4);
  ctx.quadraticCurveTo(-14, 4, 0, 4);
  ctx.quadraticCurveTo(14, 4, 16, -4);
  ctx.quadraticCurveTo(18, -16, 6, -22);
  ctx.closePath();
  ctx.fill();
  // Boca franzida e cordão
  ctx.fillStyle = '#C9922A';
  ctx.beginPath();
  ctx.moveTo(-6, -22);
  ctx.lineTo(-9, -30);
  ctx.lineTo(-3, -27);
  ctx.lineTo(0, -31);
  ctx.lineTo(3, -27);
  ctx.lineTo(9, -30);
  ctx.lineTo(6, -22);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#7A4A10';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-7, -22);
  ctx.lineTo(7, -22);
  ctx.stroke();
  // "$"
  ctx.fillStyle = '#7A4A10';
  ctx.font = '900 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', 0, -8);
  // Reflexo
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.beginPath();
  ctx.ellipse(-8, -12, 2.5, 5, 0.3, 0, TAU);
  ctx.fill();
  ctx.restore();
  twinkles(ctx, c.x, by - 12, t, '#FFF4C0');
  ring(ctx, c.x, y);
}

// Coração vermelho batendo, boiando sobre a fileira
export function drawHeart(ctx, c, y, t) {
  const bob = Math.sin(t * 3 + c.ph) * 3;
  const by = y - 16 + bob;
  const beat = 1 + Math.max(0, Math.sin(t * 8)) * 0.12;
  glow(ctx, c.x, by, 34, '255, 90, 120', t);
  ctx.save();
  ctx.translate(c.x, by);
  ctx.scale(beat, beat);
  const g = ctx.createRadialGradient(-5, -6, 1, 0, 0, 16);
  g.addColorStop(0, '#FF8A98');
  g.addColorStop(0.5, HEART_RED);
  g.addColorStop(1, '#A8122A');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 12);
  ctx.bezierCurveTo(-16, 2, -16, -12, -8, -12);
  ctx.bezierCurveTo(-3, -12, 0, -8, 0, -5);
  ctx.bezierCurveTo(0, -8, 3, -12, 8, -12);
  ctx.bezierCurveTo(16, -12, 16, 2, 0, 12);
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.beginPath();
  ctx.ellipse(-7, -6, 2.4, 3.6, 0.5, 0, TAU);
  ctx.fill();
  ctx.restore();
  twinkles(ctx, c.x, by, t, '#FFE0E6');
  ring(ctx, c.x, y);
}
