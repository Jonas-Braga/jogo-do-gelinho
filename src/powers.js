// Poderes do personagem (só nas fases normais, a partir da fase 6): itens que
// passam pelas fileiras UMA vez por fase e são pegos como os peixes.
// - Boia de patinho (fases 6 em diante): por 5 s, cair na água não afunda; ele
//   boia, nada devagar e pula de volta para o gelo. Se o tempo acabar na água, afunda.
// - Chuteira dourada (fase 11 em diante): por 5 s, fica imune; quem encosta nele
//   leva um chute e voa longe (o urso é jogado para longe e fica tonto).
export const POWERS = {
  from: 6,          // primeira fase com a boia
  bootFrom: 11,     // primeira fase com a chuteira
  duration: 5,      // segundos de cada poder
  warn: 1.5,        // nos últimos segundos o poder pisca e apita
  firstMin: 8,      // o primeiro item passa entre 8 e 25 s de fase
  firstMax: 25,
  gapMin: 8,        // intervalo até o segundo item (nunca passam juntos)
  gapMax: 14,
  size: 32,         // largura de colisão
  swimSpeed: 110,   // nadando com a boia (px/s)
  swimDepth: 24,    // quanto do corpo fica dentro d'água (px)
  kickPoints: 50,   // pontos por bicho chutado (× fase)
  kickTime: 0.3,    // duração do movimento de chute (s)
  kickVx: 900,      // o bicho chutado voa nesta velocidade...
  kickVy: -520,     // ...subindo assim (px/s)...
  kickGravity: 900, // ...e cai de volta na água lá longe
  bearStun: 2,      // segundos que o urso fica tonto
  bearKnock: 560,   // velocidade inicial do urso jogado para longe (px/s)
};
export const POWER_KINDS = ['duck', 'boot'];
export const POWER_NAMES = { duck: 'BOIA', boot: 'CHUTEIRA' };

export const DUCK_YELLOW = '#FFD21F';
export const BOOT_GOLD = '#F2B01E';

// Itens de poder de uma fase (fases especiais não têm)
export function powersFor(level, special = null) {
  if (special || level < POWERS.from) return [];
  return level >= POWERS.bootFrom ? ['duck', 'boot'] : ['duck'];
}

const TAU = Math.PI * 2;

function glow(ctx, x, y, r, rgb, a) {
  const g = ctx.createRadialGradient(x, y, 2, x, y, r);
  g.addColorStop(0, `rgba(${rgb}, ${a})`);
  g.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function twinkles(ctx, x, y, t, color, rx = 24, ry = 14, n = 3) {
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const a = t * 2 + (i * TAU) / n;
    const k = 0.5 + 0.5 * Math.sin(t * 7 + i * 2);
    const sx = x + Math.cos(a) * rx;
    const sy = y + Math.sin(a) * ry;
    ctx.globalAlpha = k;
    ctx.fillRect(sx - 3, sy - 0.6, 6, 1.2);
    ctx.fillRect(sx - 0.6, sy - 3, 1.2, 6);
  }
  ctx.globalAlpha = 1;
}

// Cabeça do patinho (na frente da boia), virada para +x
function duckHead(ctx, x, y, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // Pescoço
  ctx.fillStyle = DUCK_YELLOW;
  ctx.beginPath();
  ctx.roundRect(-5, -8, 10, 12, 4);
  ctx.fill();
  // Cabeça
  const g = ctx.createRadialGradient(-2, -15, 1, 0, -13, 9);
  g.addColorStop(0, '#FFF2A0');
  g.addColorStop(1, DUCK_YELLOW);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, -13, 8, 0, TAU);
  ctx.fill();
  // Bico laranja
  ctx.fillStyle = '#FF8A1F';
  ctx.beginPath();
  ctx.moveTo(6, -14);
  ctx.quadraticCurveTo(15, -13, 14, -10);
  ctx.quadraticCurveTo(10, -8, 6, -10);
  ctx.closePath();
  ctx.fill();
  // Olho
  ctx.fillStyle = '#1D2A33';
  ctx.beginPath();
  ctx.arc(2.5, -15, 1.7, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(3, -15.6, 0.6, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// Metade da boia (anel amarelo visto de cima, achatado). half: 'back' = a parte
// de trás (desenhada antes do corpo), 'front' = a da frente, por cima do corpo.
function ringHalf(ctx, rx, ry, thick, half) {
  const a0 = half === 'back' ? Math.PI : 0;
  ctx.lineCap = 'butt';
  ctx.strokeStyle = '#C99A00';
  ctx.lineWidth = thick + 2.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, a0, a0 + Math.PI);
  ctx.stroke();
  ctx.strokeStyle = DUCK_YELLOW;
  ctx.lineWidth = thick;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, a0, a0 + Math.PI);
  ctx.stroke();
  // Brilho
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (half === 'back') ctx.ellipse(0, -1.5, rx, ry, 0, Math.PI * 1.15, Math.PI * 1.5);
  else ctx.ellipse(0, -2, rx, ry, 0, Math.PI * 0.55, Math.PI * 0.85);
  ctx.stroke();
}

// Item: boia de patinho amarela boiando sobre a fileira
export function drawDuckFloat(ctx, c, y, t) {
  const bob = Math.sin(t * 3 + c.ph) * 3;
  const by = y - 6 + bob;
  glow(ctx, c.x, by - 6, 38, '255, 225, 90', 0.45 + Math.sin(t * 6) * 0.1);
  ctx.save();
  ctx.translate(c.x, by);
  ctx.rotate(Math.sin(t * 2 + c.ph) * 0.07);
  ctx.scale(c.dir < 0 ? -1 : 1, 1);
  ringHalf(ctx, 17, 7, 9, 'back');
  // Furo do meio (água aparecendo)
  ctx.fillStyle = 'rgba(8, 60, 84, 0.55)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 3, 0, 0, TAU);
  ctx.fill();
  ringHalf(ctx, 17, 7, 9, 'front');
  // Rabinho e cabeça
  ctx.fillStyle = DUCK_YELLOW;
  ctx.beginPath();
  ctx.moveTo(-17, -3);
  ctx.quadraticCurveTo(-27, -12, -19, -9);
  ctx.quadraticCurveTo(-16, -6, -13, -4);
  ctx.closePath();
  ctx.fill();
  duckHead(ctx, 15, -2);
  ctx.restore();
  twinkles(ctx, c.x, by - 8, t, '#FFF7C0', 28, 16);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(c.x, y + 9, 24, 3.5, 0, 0, TAU);
  ctx.stroke();
}

// Item: chuteira dourada boiando sobre a fileira
export function drawGoldenBoot(ctx, c, y, t) {
  const bob = Math.sin(t * 3 + c.ph) * 3;
  const by = y - 8 + bob;
  glow(ctx, c.x, by - 8, 38, '255, 200, 70', 0.45 + Math.sin(t * 6) * 0.1);
  ctx.save();
  ctx.translate(c.x, by);
  ctx.rotate(-0.18 + Math.sin(t * 2 + c.ph) * 0.1);
  ctx.scale(c.dir < 0 ? -1.25 : 1.25, 1.25);
  bootShape(ctx);
  ctx.restore();
  twinkles(ctx, c.x, by - 8, t, '#FFF4C0', 28, 16);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(c.x, y + 9, 18, 3, 0, 0, TAU);
  ctx.stroke();
}

// Chuteira (bico para +x), com a sola em y = 0
function bootShape(ctx) {
  const g = ctx.createLinearGradient(0, -22, 0, 0);
  g.addColorStop(0, '#FFE98A');
  g.addColorStop(0.55, BOOT_GOLD);
  g.addColorStop(1, '#A8700C');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-14, -22);          // boca do cano (atrás)
  ctx.lineTo(-4, -22);
  ctx.quadraticCurveTo(-2, -13, 6, -11); // peito do pé
  ctx.quadraticCurveTo(17, -9, 18, -3);  // bico
  ctx.lineTo(18, -2);
  ctx.lineTo(-15, -2);
  ctx.quadraticCurveTo(-17, -12, -14, -22);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#8A5A08';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // Sola e travas
  ctx.fillStyle = '#5A3A06';
  ctx.beginPath();
  ctx.roundRect(-16, -3, 35, 3.5, 1.5);
  ctx.fill();
  for (const sx of [-12, -5, 4, 12]) ctx.fillRect(sx - 1.5, 0, 3, 3.5);
  // Cadarço e faixa
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (const k of [0, 1, 2]) {
    ctx.moveTo(-3 + k * 3.2, -17 + k * 2.6);
    ctx.lineTo(2 + k * 3.2, -13.5 + k * 1.6);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.beginPath();
  ctx.moveTo(-9, -9);
  ctx.lineTo(-3, -9);
  ctx.lineTo(-7, -3);
  ctx.lineTo(-13, -3);
  ctx.closePath();
  ctx.fill();
  // Reflexo
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.beginPath();
  ctx.ellipse(9, -7.5, 4, 1.4, 0.25, 0, TAU);
  ctx.fill();
}

// Nos últimos segundos o efeito pisca
function blink(p, t) {
  return p.powerEnding && Math.sin(t * 28) > 0 ? 0.3 : 1;
}

// Altura (em relação aos pés) em que a boia fica: na cintura; nadando, na linha d'água
function floatY(p) {
  return p.state === 'swim' ? p.y + 3 : p.y - 21;
}

// Efeito do poder atrás do personagem: metade de trás da boia ou o brilho da chuteira
export function drawPowerBack(ctx, p, t) {
  if (!p.power || p.state === 'gone') return;
  ctx.save();
  ctx.globalAlpha = blink(p, t);
  if (p.power === 'duck') {
    ctx.translate(p.x, floatY(p));
    ctx.scale(p.facing, 1);
    ringHalf(ctx, 22, 7.5, 10, 'back');
  } else {
    glow(ctx, p.x, p.y - 34, 62, '255, 205, 80', 0.5 + Math.sin(t * 9) * 0.12);
  }
  ctx.restore();
}

// Efeito do poder na frente do personagem: metade da frente da boia com a cabeça
// do patinho, ou as estrelinhas e a chuteira dourada no pé
export function drawPowerFront(ctx, p, t) {
  if (!p.power || p.state === 'gone') return;
  ctx.save();
  ctx.globalAlpha = blink(p, t);
  if (p.power === 'duck') {
    ctx.translate(p.x, floatY(p));
    ctx.scale(p.facing, 1);
    ringHalf(ctx, 22, 7.5, 10, 'front');
    duckHead(ctx, 23, -1, 0.85);
  } else {
    const a = ctx.globalAlpha;
    twinkles(ctx, p.x, p.y - 36, t * 1.6, '#FFE9A0', 30, 34, 5);
    ctx.globalAlpha = a;
    // Chuteira no pé da frente (acompanha o chute)
    const k = p.kickT > 0 ? Math.sin((1 - p.kickT / POWERS.kickTime) * Math.PI) : 0;
    ctx.translate(p.x + p.facing * (5 + k * 20), p.y - k * 16);
    ctx.scale(p.facing * 0.55, 0.55);
    ctx.rotate(-k * 0.9);
    bootShape(ctx);
  }
  ctx.restore();
}

// Urso tonto depois do chute: estrelinhas girando em volta da cabeça
export function drawDizzy(ctx, x, y, t) {
  ctx.save();
  ctx.fillStyle = '#FFE066';
  ctx.strokeStyle = '#B8860B';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 4; i++) {
    const a = t * 6 + (i * TAU) / 4;
    const sx = x + Math.cos(a) * 26;
    const sy = y + Math.sin(a) * 7;
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? 2.4 : 5.5;
      const b = (k * Math.PI) / 5 - Math.PI / 2 + t * 3;
      ctx.lineTo(sx + Math.cos(b) * r, sy + Math.sin(b) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

// Ícone pequeno do poder (HUD)
export function drawPowerIcon(ctx, kind, x, y) {
  ctx.save();
  ctx.translate(x, y);
  if (kind === 'duck') {
    ctx.scale(0.6, 0.6);
    ringHalf(ctx, 15, 6, 8, 'back');
    ringHalf(ctx, 15, 6, 8, 'front');
    duckHead(ctx, 13, -2, 0.9);
  } else {
    ctx.translate(0, 7);
    ctx.scale(0.6, 0.6);
    bootShape(ctx);
  }
  ctx.restore();
}
