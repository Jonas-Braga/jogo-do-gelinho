// Arte procedural. Tudo que é estático é pré-renderizado em canvases offscreen
// com 2x de resolução para ficar nítido quando a tela é escalada.
import { W, SHORE_TOP, WATER_TOP, PALETTE as C, CROUCH_SCALE } from './config.js';

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

// ---------------------------------------------------------------- Fundo
// Montanhas de gelo + costa nevada (o céu é desenhado por baixo, muda com a temperatura).
export function makeBackground() {
  const h = WATER_TOP + 12;
  const { c, g } = offscreen(W, h);
  const rnd = seeded(7);

  // Cordilheira distante (mais azulada) e próxima (mais clara)
  const ridge = (baseY, amp, step, color, shade) => {
    const pts = [];
    for (let x = -60; x <= W + 60; x += step * (0.6 + rnd() * 0.8)) pts.push([x, baseY - rnd() * amp]);
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(-60, SHORE_TOP + 20);
    for (const [x, y] of pts) g.lineTo(x, y);
    g.lineTo(W + 60, SHORE_TOP + 20);
    g.fill();
    // Face sombreada de cada pico
    g.fillStyle = shade;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      if (y1 < y0) continue;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.lineTo(x1 - (x1 - x0) * 0.2, SHORE_TOP + 20);
      g.lineTo(x0 + 6, SHORE_TOP + 20);
      g.fill();
    }
  };
  ridge(150, 50, 90, '#BFDDE8', 'rgba(120, 165, 190, 0.35)');
  ridge(178, 40, 70, '#E4F1F5', 'rgba(150, 190, 208, 0.40)');

  // Névoa na base das montanhas
  let grd = g.createLinearGradient(0, SHORE_TOP - 30, 0, SHORE_TOP + 5);
  grd.addColorStop(0, 'rgba(240, 248, 250, 0)');
  grd.addColorStop(1, 'rgba(240, 248, 250, 0.85)');
  g.fillStyle = grd;
  g.fillRect(0, SHORE_TOP - 30, W, 40);

  // Campo de neve
  grd = g.createLinearGradient(0, SHORE_TOP, 0, WATER_TOP);
  grd.addColorStop(0, '#FBFCFA');
  grd.addColorStop(0.7, C.snow);
  grd.addColorStop(1, '#E2EAEA');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(0, WATER_TOP);
  for (let x = 0; x <= W; x += 20) g.lineTo(x, SHORE_TOP + Math.sin(x * 0.013) * 4 + Math.sin(x * 0.051) * 1.5);
  g.lineTo(W, WATER_TOP);
  g.fill();

  // Ondulações suaves de neve soprada
  g.strokeStyle = 'rgba(170, 195, 205, 0.35)';
  g.lineWidth = 1.2;
  for (let i = 0; i < 26; i++) {
    const x = rnd() * W;
    const y = SHORE_TOP + 14 + rnd() * 40;
    const w = 30 + rnd() * 70;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + w / 2, y - 3, x + w, y);
    g.stroke();
  }
  // Brilhos da neve
  for (let i = 0; i < 160; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.9)' : 'rgba(160, 190, 205, 0.35)';
    g.fillRect(rnd() * W, SHORE_TOP + 6 + rnd() * 70, 1.2, 1.2);
  }

  // Paredão de gelo da costa entrando na água
  const edgeTop = WATER_TOP - 14;
  grd = g.createLinearGradient(0, edgeTop, 0, WATER_TOP + 12);
  grd.addColorStop(0, '#EAF3F4');
  grd.addColorStop(0.35, '#BFD8DF');
  grd.addColorStop(1, '#5F93A6');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(0, edgeTop + 2);
  for (let x = 0; x <= W; x += 16) g.lineTo(x, edgeTop + Math.sin(x * 0.09) * 1.5);
  g.lineTo(W, WATER_TOP + 12);
  g.lineTo(0, WATER_TOP + 12);
  g.fill();
  // Estrias verticais no gelo
  for (let x = 0; x < W; x += 7 + rnd() * 14) {
    g.strokeStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(70, 120, 140, 0.25)';
    g.beginPath();
    g.moveTo(x, edgeTop + 4);
    g.lineTo(x + (rnd() - 0.5) * 3, WATER_TOP + 10);
    g.stroke();
  }
  // Borda de neve por cima do paredão
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.fillRect(0, edgeTop - 1, W, 2);

  return { canvas: c, w: W, h };
}

// ---------------------------------------------------------------- Placas de gelo
const FLOE_PAD = 10;
const FLOE_TOP = 22; // linha onde os pés pisam, dentro do sprite
const FLOE_H = 70;

export function floeSprite(piece, active) {
  const key = active ? 'on' : 'off';
  if (piece.sprites[key]) return piece.sprites[key];
  const w = piece.w;
  const { c, g } = offscreen(w + FLOE_PAD * 2, FLOE_H);
  g.translate(FLOE_PAD, FLOE_TOP);
  const s = piece.shape;
  const rnd = seeded(piece.seed);

  // Massa submersa, visível pela água
  let grd = g.createLinearGradient(0, 14, 0, 46);
  grd.addColorStop(0, active ? 'rgba(120, 215, 250, 0.40)' : 'rgba(175, 225, 240, 0.32)');
  grd.addColorStop(1, 'rgba(120, 200, 230, 0)');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(-5, 15);
  g.lineTo(w + 5, 15);
  g.lineTo(w - 1 + s[3], 42);
  g.lineTo(3 + s[6], 46);
  g.closePath();
  g.fill();

  // Lateral
  grd = g.createLinearGradient(0, 4, 0, 20);
  grd.addColorStop(0, active ? '#A5E2F6' : '#E4EFF1');
  grd.addColorStop(0.5, active ? '#5DB6DB' : '#B3CFD7');
  grd.addColorStop(1, active ? '#2E83AE' : '#7EA6B4');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(1, 6);
  g.lineTo(w - 1, 6);
  g.lineTo(w - 3, 19 + s[2] * 0.3);
  for (let i = 4; i >= 0; i--) g.lineTo((w * (i + 0.5)) / 5, 19 + s[i + 5] * 0.4);
  g.lineTo(3, 19 + s[1] * 0.3);
  g.closePath();
  g.fill();
  // Estrias na lateral
  g.lineWidth = 0.8;
  for (let x = 4; x < w - 3; x += 5 + rnd() * 8) {
    g.strokeStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(40, 90, 120, 0.2)';
    g.beginPath();
    g.moveTo(x, 9);
    g.lineTo(x + (rnd() - 0.5) * 2, 18);
    g.stroke();
  }
  // Linha d'água
  g.fillStyle = 'rgba(255,255,255,0.45)';
  g.fillRect(2, 18, w - 4, 1.4);

  // Topo
  const topPath = () => {
    g.beginPath();
    g.moveTo(0, -5);
    for (let i = 0; i < 5; i++) g.lineTo((w * (i + 0.5)) / 5, -13 + s[i]);
    g.lineTo(w, -5);
    g.lineTo(w - 1, 8);
    for (let i = 4; i >= 0; i--) g.lineTo((w * (i + 0.5)) / 5, 9 + s[i + 5] * 0.5);
    g.lineTo(1, 8);
    g.closePath();
  };
  grd = g.createLinearGradient(0, -15, 0, 10);
  grd.addColorStop(0, active ? '#D8F6FF' : '#FFFFFF');
  grd.addColorStop(1, active ? '#7CCBEA' : '#DCE8EC');
  g.fillStyle = grd;
  topPath();
  g.fill();

  g.save();
  topPath();
  g.clip();
  // Textura: neve granulada e manchas de gelo liso
  for (let i = 0; i < 40; i++) {
    g.fillStyle = rnd() < 0.55
      ? 'rgba(255,255,255,0.8)'
      : active ? 'rgba(40, 130, 180, 0.22)' : 'rgba(130, 170, 185, 0.22)';
    g.beginPath();
    g.arc(rnd() * w, -12 + rnd() * 20, 0.5 + rnd() * 1.3, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = active ? 'rgba(170, 235, 255, 0.35)' : 'rgba(200, 225, 235, 0.45)';
  g.beginPath();
  g.ellipse(w * (0.3 + rnd() * 0.4), -1, w * 0.18, 3, 0, 0, Math.PI * 2);
  g.fill();
  // Rachaduras
  g.strokeStyle = active ? 'rgba(30, 110, 160, 0.4)' : 'rgba(110, 150, 165, 0.45)';
  g.lineWidth = 0.8;
  for (let k = 0; k < 2; k++) {
    let x = rnd() * w;
    let y = -12 + rnd() * 4;
    g.beginPath();
    g.moveTo(x, y);
    for (let j = 0; j < 4; j++) {
      x += (rnd() - 0.5) * 14;
      y += 3 + rnd() * 3;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // Brilho interno do estado ativado
  if (active) {
    grd = g.createRadialGradient(w / 2, -2, 2, w / 2, -2, w * 0.6);
    grd.addColorStop(0, 'rgba(230, 250, 255, 0.55)');
    grd.addColorStop(1, 'rgba(230, 250, 255, 0)');
    g.fillStyle = grd;
    g.fillRect(-2, -16, w + 4, 28);
  }
  g.restore();

  // Aresta iluminada entre topo e lateral
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(1, 8);
  for (let i = 0; i < 5; i++) g.lineTo((w * (i + 0.5)) / 5, 9 + s[i + 5] * 0.5);
  g.lineTo(w - 1, 8);
  g.stroke();

  const sprite = { canvas: c, ox: FLOE_PAD, oy: FLOE_TOP, w: w + FLOE_PAD * 2, h: FLOE_H };
  piece.sprites[key] = sprite;
  return sprite;
}

// ---------------------------------------------------------------- Personagem
// Desenhado com os pés em (0,0), olhando para a direita.
// `ride` = deslocamento vertical da placa em que está (balanço/afundada).
// Roupas do personagem: parka (padrão) ou suéter natalino (fase especial de Natal).
const OUTFITS = {
  parka: {
    body: ['#E8B95A', C.parka, C.parkaShade], armBack: C.parkaShade, armFront: ['#E8B95A', C.parkaShade],
    seam: 'rgba(120, 80, 25, 0.55)', sweater: false,
  },
  sweater: {
    body: ['#E5474A', '#C62F2F', '#8C1D1F'], armBack: '#9E2224', armFront: ['#E0403F', '#A52528'],
    seam: 'rgba(90, 15, 15, 0.45)', sweater: true,
  },
};
const KNIT_WHITE = '#F7F2E8';
const KNIT_GREEN = '#1F7A45';

// Punho do suéter: tricô verde com listra branca (no lugar do punho de pelo)
function knitCuff(ctx, x, y, w) {
  ctx.fillStyle = KNIT_GREEN;
  ctx.fillRect(x, y, w, 3.5);
  ctx.fillStyle = KNIT_WHITE;
  ctx.fillRect(x, y + 1.3, w, 0.9);
}

// Estampa de tricô natalino sobre o corpo (já recortado pelo contorno do corpo)
function sweaterPattern(ctx, back) {
  // Faixa branca com zigue-zague verde no peito
  ctx.fillStyle = KNIT_WHITE;
  ctx.fillRect(-18, -38, 36, 9);
  ctx.fillStyle = KNIT_GREEN;
  ctx.beginPath();
  ctx.moveTo(-18, -29);
  for (let x = -18; x <= 18; x += 6) {
    ctx.lineTo(x, -35);
    ctx.lineTo(x + 3, -31);
  }
  ctx.lineTo(18, -29);
  ctx.closePath();
  ctx.fill();
  // Pontinhos de "neve" no tricô
  ctx.fillStyle = KNIT_WHITE;
  for (let x = -14; x <= 14; x += 7) {
    ctx.fillRect(x, -43, 1.6, 1.6);
    ctx.fillRect(x + 3.5, -24, 1.6, 1.6);
  }
  // Floco de neve na barriga (só de frente)
  if (!back) {
    ctx.strokeStyle = KNIT_WHITE;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3;
      ctx.moveTo(7 + Math.cos(a) * 3.6, -21 + Math.sin(a) * 3.6);
      ctx.lineTo(7 - Math.cos(a) * 3.6, -21 - Math.sin(a) * 3.6);
    }
    ctx.stroke();
  }
}

// Barra do suéter: tricô verde canelado (no lugar da barra de pelo)
function sweaterHem(ctx) {
  ctx.fillStyle = KNIT_GREEN;
  ctx.beginPath();
  ctx.roundRect(-18, -17, 36, 6, 2.5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(10, 50, 25, 0.6)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let x = -16; x <= 16; x += 2.6) {
    ctx.moveTo(x, -16);
    ctx.lineTo(x, -12);
  }
  ctx.stroke();
}

export function drawPlayer(ctx, p, t, cold, ride = 0, outfit = 'parka') {
  const O = OUTFITS[outfit] || OUTFITS.parka;
  ctx.save();
  if (p.state === 'drown' && p.sinkLine != null) {
    ctx.beginPath();
    ctx.rect(0, 0, W, p.sinkLine);
    ctx.clip();
  }
  ctx.globalAlpha = p.alpha;

  let x = p.x;
  const freezing = p.state === 'freeze' ? Math.min(p.t / 1.0, 1) : 0;
  const shiver = p.state === 'freeze' ? 1 - freezing : cold;
  if (shiver > 0 && p.state !== 'jump') x += Math.sin(t * 70) * 1.3 * shiver;

  // Sombra no chão
  if (p.state === 'stand' || p.state === 'freeze' || p.state === 'enter' || p.state === 'flee') {
    ctx.fillStyle = 'rgba(20, 50, 70, 0.22)';
    ctx.beginPath();
    ctx.ellipse(x, p.y + 1 + ride, 17, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.translate(x, p.y + ride);
  const sq = p.squash;
  const sc = p.scale ?? 1;
  let sx = 1 + 0.12 * sq;
  let sy = 1 - 0.14 * sq;
  const anim = p.anim;
  if (anim === 'idle') {
    // Respiração: o corpo sobe e desce levemente
    sy *= 1 + Math.sin(t * 2.4) * 0.018;
  } else if (anim === 'jump') {
    // Estica no meio do pulo
    const k = Math.sin(Math.min(p.t, 1) * Math.PI);
    sy *= 1 + 0.1 * k;
    sx *= 1 - 0.06 * k;
  }
  if (p.crouch > 0) {
    // Agachado para caber no túnel do iglu, inclinado para frente
    sy *= 1 - (1 - CROUCH_SCALE) * p.crouch;
    ctx.rotate(0.2 * p.crouch * p.facing);
  }
  ctx.scale(sx * p.facing * sc, sy * sc);

  const fleeing = p.state === 'flee';
  // Em pânico (fugindo do urso ou afundando): braços erguidos e cara de susto.
  // Ao afundar, as mãos erguidas são a última coisa a sumir na água.
  const panicking = fleeing || p.state === 'drown';
  const walking = (p.state === 'stand' || p.state === 'enter' || fleeing) && p.moving;
  const air = p.state === 'jump' || (fleeing && !p.moving); // susto: pulinho
  const phase = t * (fleeing ? 24 : 13);
  const step = walking ? Math.sin(phase) * (fleeing ? 1.4 : 1) : 0;
  const flail = Math.sin(t * 30) * 0.35; // braços sacudindo de desespero
  const bob = walking ? Math.abs(Math.cos(phase)) * -1.5 : 0;

  // De costas (entrando no iglu): desenho próprio, sem rosto
  if (p.back) {
    drawPlayerBack(ctx, t, walking, step, bob, O);
    ctx.restore();
    return;
  }

  // Pernas e botas
  const leg = (lx, lift, back) => {
    ctx.fillStyle = back ? '#2E2218' : C.pants;
    ctx.fillRect(lx - 4, -20 - lift, 8, 12);
    ctx.fillStyle = back ? '#4A3220' : C.boots;
    ctx.beginPath();
    ctx.roundRect(lx - 5, -10 - lift, 12, 10, 3);
    ctx.fill();
    ctx.fillStyle = back ? C.furShade : C.fur;
    ctx.beginPath();
    ctx.roundRect(lx - 6, -12 - lift, 12, 4, 2);
    ctx.fill();
  };
  if (air) {
    leg(-5, 6, true);
    leg(5, 3, false);
  } else {
    leg(-4 - step * 5, Math.max(0, step) * 3, true);
    leg(4 + step * 5, Math.max(0, -step) * 3, false);
  }

  ctx.translate(0, bob);

  // Braço de trás (na fuga, os braços são desenhados erguidos depois da cabeça)
  if (!panicking) {
  ctx.save();
  ctx.translate(-4, -41);
  ctx.rotate(fleeing ? 2.8 + flail : air ? -2.3 : walking ? -step * 0.6 : 0.15);
  ctx.fillStyle = O.armBack;
  ctx.beginPath();
  ctx.roundRect(-4, 0, 8, 18, 4);
  ctx.fill();
  ctx.fillStyle = '#4A3423';
  ctx.beginPath();
  ctx.arc(0, 20, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  }

  // Corpo (parka em A)
  let grd = ctx.createLinearGradient(-16, 0, 16, 0);
  grd.addColorStop(0, O.body[0]);
  grd.addColorStop(0.55, O.body[1]);
  grd.addColorStop(1, O.body[2]);
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.moveTo(-10, -46);
  ctx.quadraticCurveTo(0, -50, 10, -46);
  ctx.quadraticCurveTo(15, -30, 17, -15);
  ctx.quadraticCurveTo(0, -11, -17, -15);
  ctx.quadraticCurveTo(-15, -30, -10, -46);
  ctx.fill();
  if (O.sweater) {
    ctx.save();
    ctx.clip();
    sweaterPattern(ctx, false);
    // Sombra lateral por cima da estampa (volume)
    const sh = ctx.createLinearGradient(-16, 0, 16, 0);
    sh.addColorStop(0.5, 'rgba(60, 0, 0, 0)');
    sh.addColorStop(1, 'rgba(60, 0, 0, 0.35)');
    ctx.fillStyle = sh;
    ctx.fillRect(-18, -50, 36, 40);
    ctx.restore();
    sweaterHem(ctx);
  } else {
    // Costura e bolso
    ctx.strokeStyle = O.seam;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(3, -45);
    ctx.lineTo(4, -15);
    ctx.moveTo(-10, -27);
    ctx.quadraticCurveTo(0, -24, 13, -27);
    ctx.stroke();
    // Barra de pelo
    for (let i = -17; i <= 17; i += 3.4) {
      ctx.fillStyle = i > 6 ? C.furShade : C.fur;
      ctx.beginPath();
      ctx.arc(i, -14 + Math.sin(i * 1.7) * 0.8, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Capuz
  ctx.fillStyle = C.parkaShade;
  ctx.beginPath();
  ctx.arc(-1, -57, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.parka;
  ctx.beginPath();
  ctx.arc(0, -58, 13.5, 0, Math.PI * 2);
  ctx.fill();
  // Pelo em volta do rosto
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
    ctx.fillStyle = Math.cos(a) > 0.3 ? C.furShade : C.fur;
    ctx.beginPath();
    ctx.arc(5 + Math.cos(a) * 9.5, -56 + Math.sin(a) * 10, 3.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Rosto
  grd = ctx.createRadialGradient(4, -58, 1, 5, -56, 9);
  grd.addColorStop(0, '#F0C29C');
  grd.addColorStop(1, '#C98B62');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.ellipse(5, -56, 7.2, 7.8, 0, 0, Math.PI * 2);
  ctx.fill();
  if (panicking) {
    // Cara de susto: olhos arregalados, sobrancelhas altas, boca em "O"
    for (const ex of [5.2, 9.8]) {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(ex, -58, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.ink;
      ctx.beginPath();
      ctx.arc(ex + 0.6, -58, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#5A3A26';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(3, -62.5);
    ctx.lineTo(7, -63.5);
    ctx.moveTo(8.5, -63.5);
    ctx.lineTo(12, -62.5);
    ctx.stroke();
    ctx.fillStyle = '#5A1E1A';
    ctx.beginPath();
    ctx.ellipse(8, -52, 2.2, 2.8 + Math.abs(Math.sin(t * 18)) * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = cold > 0.3 ? 'rgba(120, 160, 230, 0.4)' : 'rgba(225, 95, 80, 0.38)';
    ctx.beginPath();
    ctx.arc(9, -53, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.ink;
    const blink = Math.sin(t * 0.9 + 1) > 0.985 ? 0.6 : 2.4;
    ctx.fillRect(4.5, -59, 1.8, blink);
    ctx.fillRect(9, -59, 1.8, blink);
    ctx.fillStyle = '#B87652';
    ctx.beginPath();
    ctx.arc(11, -55.5, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7A4632';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const chatter = cold > 0.3 ? Math.sin(t * 50) * 0.8 : 0;
    ctx.moveTo(6, -51.5 + chatter);
    ctx.lineTo(9.5, -51.5);
    ctx.stroke();
  }

  // Na fuga: os dois braços erguidos em "V" acima da cabeça, sacudindo
  if (panicking) {
    const raised = (sx, angle, back) => {
      ctx.save();
      ctx.translate(sx, -44);
      ctx.rotate(angle);
      ctx.fillStyle = back ? O.armBack : O.body[1];
      ctx.beginPath();
      ctx.roundRect(-4.5, 0, 9, 25, 4);
      ctx.fill();
      if (O.sweater) knitCuff(ctx, -5, 21, 10);
      else {
        ctx.fillStyle = C.fur;
        ctx.fillRect(-5, 21, 10, 3.5);
      }
      ctx.fillStyle = back ? '#4A3423' : '#5A3E2A';
      ctx.beginPath();
      ctx.arc(0, 28, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    raised(-8, Math.PI - 0.7 + flail, true);   // braço de trás: para cima e para trás
    raised(9, -(Math.PI - 0.6) - flail, false); // braço da frente: para cima e para frente
  }

  // Braço da frente
  if (!panicking) {
  ctx.save();
  ctx.translate(4, -41);
  ctx.rotate(air ? -2.0 : walking ? step * 0.6 : 0.2 + (shiver > 0 ? -0.6 : 0));
  grd = ctx.createLinearGradient(-4, 0, 4, 0);
  grd.addColorStop(0, O.armFront[0]);
  grd.addColorStop(1, O.armFront[1]);
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.roundRect(-4.5, 0, 9, 18, 4);
  ctx.fill();
  if (O.sweater) {
    ctx.fillStyle = KNIT_WHITE;
    ctx.fillRect(-4.5, 6, 9, 1.6); // listra na manga
    knitCuff(ctx, -5, 15, 10);
  } else {
    ctx.fillStyle = C.fur;
    ctx.fillRect(-5, 15, 10, 3.5);
  }
  ctx.fillStyle = '#5A3E2A';
  ctx.beginPath();
  ctx.arc(0, 21, 4.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  }

  // "!" de susto e gotas de suor voando
  if (fleeing) {
    const bounce = Math.abs(Math.sin(t * 9)) * 4;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(0, -100 - bounce, 8, 15, 3);
    ctx.arc(4, -79 - bounce, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#E5484D';
    ctx.beginPath();
    ctx.roundRect(1.8, -98 - bounce, 4.4, 11, 2);
    ctx.arc(4, -79 - bounce, 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(150, 215, 245, 0.9)';
    for (let i = 0; i < 2; i++) {
      const k = (t * 2.5 + i * 0.5) % 1;
      ctx.beginPath();
      ctx.arc(-12 - k * 14, -66 - i * 6 + k * 8, 2.2 * (1 - k * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Camada de gelo ao congelar
  if (freezing > 0) {
    ctx.globalAlpha = p.alpha * freezing * 0.75;
    grd = ctx.createLinearGradient(-18, -74, 18, 0);
    grd.addColorStop(0, 'rgba(230, 248, 255, 0.95)');
    grd.addColorStop(0.5, 'rgba(150, 215, 240, 0.8)');
    grd.addColorStop(1, 'rgba(90, 170, 210, 0.85)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(-19, 0);
    ctx.lineTo(-21, -40);
    ctx.lineTo(-14, -70);
    ctx.lineTo(4, -76);
    ctx.lineTo(19, -66);
    ctx.lineTo(22, -30);
    ctx.lineTo(19, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-12, -62);
    ctx.lineTo(-15, -30);
    ctx.moveTo(10, -68);
    ctx.lineTo(14, -50);
    ctx.stroke();
  }
  ctx.restore();
}

// Personagem visto de costas (pés em 0,0). Simétrico: costas da parka com
// costura central, capuz por trás com o pelo aparecendo nas bordas.
function drawPlayerBack(ctx, t, walking, step, bob, O = OUTFITS.parka) {
  // Pernas e botas, alternando a passada
  for (const [lx, lift] of [[-5, Math.max(0, step) * 3], [5, Math.max(0, -step) * 3]]) {
    ctx.fillStyle = C.pants;
    ctx.fillRect(lx - 4, -20 - lift, 8, 12);
    ctx.fillStyle = C.boots;
    ctx.beginPath();
    ctx.roundRect(lx - 5, -10 - lift, 10, 10, 3);
    ctx.fill();
    ctx.fillStyle = C.fur;
    ctx.beginPath();
    ctx.roundRect(lx - 6, -12 - lift, 12, 4, 2);
    ctx.fill();
  }
  ctx.translate(0, bob);

  // Braços pendendo dos lados, balançando com o passo
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(s * 13, -43);
    ctx.rotate(s * 0.18 + (walking ? s * step * 0.25 : 0));
    ctx.fillStyle = O.armBack;
    ctx.beginPath();
    ctx.roundRect(-4.5, 0, 9, 19, 4);
    ctx.fill();
    if (O.sweater) knitCuff(ctx, -5, 16, 10);
    else {
      ctx.fillStyle = C.fur;
      ctx.fillRect(-5, 16, 10, 3.5);
    }
    ctx.fillStyle = '#4A3423';
    ctx.beginPath();
    ctx.arc(0, 22, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Costas da parka (em A)
  const g = ctx.createLinearGradient(-16, 0, 16, 0);
  g.addColorStop(0, O.body[2]);
  g.addColorStop(0.5, O.body[1]);
  g.addColorStop(1, O.body[2]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-11, -46);
  ctx.quadraticCurveTo(0, -50, 11, -46);
  ctx.quadraticCurveTo(15, -30, 17, -15);
  ctx.quadraticCurveTo(0, -11, -17, -15);
  ctx.quadraticCurveTo(-15, -30, -11, -46);
  ctx.fill();
  if (O.sweater) {
    ctx.save();
    ctx.clip();
    sweaterPattern(ctx, true);
    ctx.restore();
    sweaterHem(ctx);
  } else {
    ctx.strokeStyle = O.seam;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -46);
    ctx.lineTo(0, -14);
    ctx.moveTo(-12, -29);
    ctx.quadraticCurveTo(0, -27, 12, -29);
    ctx.stroke();
    for (let i = -17; i <= 17; i += 3.4) {
      ctx.fillStyle = Math.abs(i) > 10 ? C.furShade : C.fur;
      ctx.beginPath();
      ctx.arc(i, -14 + Math.sin(i * 1.7) * 0.8, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Capuz por trás: pelo do contorno do rosto aparece nas bordas
  for (const s of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = k % 2 ? C.furShade : C.fur;
      ctx.beginPath();
      ctx.arc(s * (12 + Math.sin(k) * 1.5), -64 + k * 5, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const hg = ctx.createRadialGradient(-4, -62, 2, 0, -57, 16);
  hg.addColorStop(0, '#E8B95A');
  hg.addColorStop(1, C.parkaShade);
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(0, -57, 14.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120, 80, 25, 0.5)';
  ctx.beginPath();
  ctx.moveTo(0, -71);
  ctx.quadraticCurveTo(1.5, -58, 0, -45);
  ctx.stroke();
}

// Ícone de vida (cabeça encapuzada) para o HUD
export function drawLifeIcon(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = C.parka;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.fur;
  ctx.beginPath();
  ctx.arc(1.5, 0.5, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.skin;
  ctx.beginPath();
  ctx.arc(1.5, 0.5, 4.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- Bichos das fileiras
// Todos desenhados em relação à linha da fileira (y = onde os pés do jogador pisam).

// A parte abaixo da linha d'água é recortada (clip), em vez de coberta com um
// retângulo, para não "pintar água" por cima das placas de gelo vizinhas.
function submerge(ctx, x, waterline) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 70, waterline - 120, 140, 120);
  ctx.clip();
}

function waterCover(ctx, x, y, w) {
  ctx.restore(); // fecha o clip aberto por submerge()
  ctx.strokeStyle = 'rgba(220, 245, 255, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(x, y, w / 2 - 4, 3, 0, 0, Math.PI * 2);
  ctx.stroke();
}

export function drawGoose(ctx, c, y, t) {
  const flap = Math.sin(t * 11 + c.ph * 3);
  const by = y - 30 + Math.sin(t * 3 + c.ph) * 3;
  ctx.fillStyle = 'rgba(2, 28, 46, 0.25)';
  ctx.beginPath();
  ctx.ellipse(c.x, y + 18, 18, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(c.x, by);
  ctx.scale(c.dir, 1);
  const wing = (tipY, shade) => {
    ctx.fillStyle = shade ? '#C5D0D6' : '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(5, -4);
    ctx.quadraticCurveTo(2, tipY * 0.7, -15, tipY);
    ctx.lineTo(-9, -1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#20262B';
    ctx.beginPath();
    ctx.ellipse(-14, tipY + 1, 4.5, 2.5, -0.4, 0, Math.PI * 2);
    ctx.fill();
  };
  wing(-6 - flap * 16, true); // asa de trás
  // Corpo
  const g = ctx.createLinearGradient(0, -9, 0, 9);
  g.addColorStop(0, '#FFFFFF');
  g.addColorStop(1, '#BCC8CF');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 17, 8.5, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-14, -2);
  ctx.lineTo(-23, -5);
  ctx.lineTo(-15, 3);
  ctx.fill();
  // Pescoço e cabeça
  ctx.strokeStyle = '#F4F7F8';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(11, -3);
  ctx.quadraticCurveTo(18, -6, 20, -12);
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(21, -13, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#F08A3C';
  ctx.beginPath();
  ctx.moveTo(25, -15);
  ctx.lineTo(32, -12);
  ctx.lineTo(25, -10);
  ctx.fill();
  ctx.fillStyle = '#1D2A33';
  ctx.beginPath();
  ctx.arc(22.5, -14.5, 1.2, 0, Math.PI * 2);
  ctx.fill();
  wing(-6 - flap * 20, false); // asa da frente
  ctx.restore();
}

export function drawCrab(ctx, c, y, t) {
  const cy = y + 4;
  const scuttle = Math.sin(t * 16 + c.ph);
  submerge(ctx, c.x, cy + 4);
  ctx.save();
  ctx.translate(c.x, cy);
  // Patas
  ctx.strokeStyle = '#A8391B';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  for (let s = -1; s <= 1; s += 2) {
    for (let i = 0; i < 3; i++) {
      const lx = s * (8 + i * 4);
      const sw = (i % 2 ? scuttle : -scuttle) * 2;
      ctx.beginPath();
      ctx.moveTo(lx * 0.8, 2);
      ctx.lineTo(lx + s * 6, -2 + sw);
      ctx.lineTo(lx + s * 9, 8 + sw);
      ctx.stroke();
    }
  }
  // Garras
  const open = 0.25 + 0.25 * Math.sin(t * 6 + c.ph);
  for (let s = -1; s <= 1; s += 2) {
    ctx.strokeStyle = '#B8401F';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(s * 10, -4);
    ctx.lineTo(s * 16, -13);
    ctx.stroke();
    ctx.fillStyle = '#E2602F';
    ctx.save();
    ctx.translate(s * 17, -16);
    ctx.rotate(s * -0.3);
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0F5670';
    ctx.beginPath();
    ctx.moveTo(s * 1, -1);
    ctx.lineTo(s * 7, -3 - open * 8);
    ctx.lineTo(s * 7, -1 + open * 2);
    ctx.fill();
    ctx.restore();
  }
  // Carapaça
  const g = ctx.createLinearGradient(0, -12, 0, 8);
  g.addColorStop(0, '#F5864F');
  g.addColorStop(1, '#A9381A');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, -1, 16, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 220, 190, 0.35)';
  ctx.beginPath();
  ctx.ellipse(-4, -6, 7, 2.5, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // Olhos
  for (let s = -1; s <= 1; s += 2) {
    ctx.strokeStyle = '#A9381A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s * 4, -9);
    ctx.lineTo(s * 5, -15);
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(s * 5, -16, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1D2A33';
    ctx.beginPath();
    ctx.arc(s * 5 + c.dir, -16, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  waterCover(ctx, c.x, cy + 4, 48);
}

export function drawClam(ctx, c, y, t) {
  const cy = y + 6;
  const open = Math.max(0, Math.sin(t * 2.6 + c.ph)) * 0.65;
  submerge(ctx, c.x, cy + 5);
  ctx.save();
  ctx.translate(c.x, cy);
  ctx.scale(c.dir, 1);
  const hinge = -15;
  // Concha de baixo
  let g = ctx.createLinearGradient(0, -2, 0, 10);
  g.addColorStop(0, '#B795C4');
  g.addColorStop(1, '#6D4F80');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 9, 0, 0, Math.PI);
  ctx.closePath();
  ctx.fill();
  // Interior e pérola
  if (open > 0.05) {
    ctx.fillStyle = '#F1C6CF';
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 3 + open * 6, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(2, -2, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Concha de cima, girando na dobradiça
  ctx.save();
  ctx.translate(hinge, 0);
  ctx.rotate(-open);
  ctx.translate(-hinge, 0);
  g = ctx.createLinearGradient(0, -12, 0, 0);
  g.addColorStop(0, '#D9BEE0');
  g.addColorStop(1, '#8E6FA0');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 11, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(90, 60, 110, 0.5)';
  ctx.lineWidth = 1;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(i * 4.6, -10 + Math.abs(i) * 0.9);
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
  waterCover(ctx, c.x, cy + 5, 40);
}

export function drawFish(ctx, c, y, t) {
  // Saltos em arco para fora da água
  const s = Math.sin(t * 4 + c.ph);
  const hop = Math.max(0, s) * 18;
  const tilt = Math.cos(t * 4 + c.ph) * (s > 0 ? -0.45 : 0);
  const fy = y + 8 - hop;
  submerge(ctx, c.x, y + 9);
  ctx.save();
  ctx.translate(c.x, fy);
  ctx.scale(c.dir, 1);
  ctx.rotate(tilt);
  const wig = Math.sin(t * 18 + c.ph) * 0.35;
  // Cauda
  ctx.fillStyle = '#E0702A';
  ctx.save();
  ctx.translate(-13, 0);
  ctx.rotate(wig);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-9, -7);
  ctx.lineTo(-7, 0);
  ctx.lineTo(-9, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Corpo
  const g = ctx.createLinearGradient(0, -7, 0, 7);
  g.addColorStop(0, '#E8732C');
  g.addColorStop(0.5, '#FFB347');
  g.addColorStop(1, '#FFE2B0');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 15, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#E0702A';
  ctx.beginPath();
  ctx.moveTo(-3, -5);
  ctx.lineTo(3, -10);
  ctx.lineTo(6, -5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillRect(-6, -3, 12, 1.2);
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(9, -1.5, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1D2A33';
  ctx.beginPath();
  ctx.arc(9.6, -1.5, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (hop < 6) {
    waterCover(ctx, c.x, y + 9, 40);
  } else {
    ctx.restore(); // fecha o clip de submerge()
    // Respingos ao sair da água
    ctx.fillStyle = 'rgba(207, 239, 250, 0.7)';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(c.x - c.dir * (12 + i * 6), y + 9 - (hop - 6) * 0.3 * (i + 1) / 3, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ---------------------------------------------------------------- Urso
// Gorro de Papai Noel na cabeça do urso (coordenadas locais do urso, olhando
// para a direita). A ponta cai para trás e o pompom balança com o passo.
function drawSantaHat(ctx, b, hy, t) {
  const swing = Math.sin(b.walk * 6) * 2.5 + (b.chasing ? Math.sin(t * 14) * 3 : 0);
  ctx.save();
  ctx.translate(53, -51 + hy);
  ctx.rotate(-0.15);
  // Cone vermelho caindo para trás
  const g = ctx.createLinearGradient(0, -22, 0, 2);
  g.addColorStop(0, '#E2353B');
  g.addColorStop(1, '#A3191F');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-13, 0);
  ctx.quadraticCurveTo(-10, -16, 2, -20);
  ctx.quadraticCurveTo(-10, -24, -21 + swing * 0.4, -11 + swing);
  ctx.quadraticCurveTo(-14, -10, -8, -9);
  ctx.quadraticCurveTo(6, -14, 13, 0);
  ctx.closePath();
  ctx.fill();
  // Barra de pelo branca
  ctx.fillStyle = '#F8F6F0';
  ctx.beginPath();
  ctx.roundRect(-15, -4, 30, 7, 3.5);
  ctx.fill();
  ctx.fillStyle = 'rgba(170, 185, 200, 0.6)';
  ctx.fillRect(-13, 1, 26, 1.5);
  // Pompom
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(-22 + swing * 0.4, -10 + swing, 4.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawBear(ctx, b, t, outfit = null) {
  const sw = Math.sin(b.walk * 3);
  const breath = Math.sin(t * 2) * 0.8;
  ctx.fillStyle = 'rgba(70, 105, 125, 0.25)';
  ctx.beginPath();
  ctx.ellipse(b.x, b.y + 3, 58, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.scale(b.dir, 1);
  ctx.translate(-16, 0); // centraliza o corpo (a cabeça fica à frente)

  const leg = (lx, phase, back) => {
    ctx.save();
    ctx.translate(lx, -26);
    ctx.rotate(phase * 0.35);
    ctx.fillStyle = back ? '#C9C0AA' : '#ECE6D6';
    ctx.beginPath();
    ctx.roundRect(-7, 0, 15, 26, 6);
    ctx.fill();
    ctx.fillStyle = back ? '#B4AB95' : '#D9D1BD';
    ctx.beginPath();
    ctx.roundRect(-8, 20, 18, 7, 3);
    ctx.fill();
    ctx.restore();
  };
  leg(-30, -sw, true);
  leg(24, sw, true);

  // Corpo
  const g = ctx.createLinearGradient(0, -62, 0, -10);
  g.addColorStop(0, '#FBF8EF');
  g.addColorStop(0.6, '#ECE6D6');
  g.addColorStop(1, '#BDB39C');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-46, -30);
  ctx.quadraticCurveTo(-48, -56, -22, -58 + breath);
  ctx.quadraticCurveTo(10, -62 + breath, 30, -52);
  ctx.quadraticCurveTo(44, -44, 42, -26);
  ctx.quadraticCurveTo(0, -14, -40, -18);
  ctx.closePath();
  ctx.fill();
  // Cauda
  ctx.beginPath();
  ctx.arc(-46, -40, 5, 0, Math.PI * 2);
  ctx.fill();

  // Pescoço e cabeça (balança com o passo)
  const hy = Math.sin(b.walk * 6) * 1.5;
  ctx.fillStyle = '#F3EEE2';
  ctx.beginPath();
  ctx.moveTo(26, -54);
  ctx.quadraticCurveTo(46, -54 + hy, 52, -44 + hy);
  ctx.lineTo(48, -30);
  ctx.quadraticCurveTo(36, -28, 30, -32);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(54, -42 + hy, 13, 11, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(66, -38 + hy, 9, 6.5, 0.2, 0, Math.PI * 2);
  ctx.fill();
  // Orelha
  ctx.fillStyle = '#E1D9C6';
  ctx.beginPath();
  ctx.arc(47, -53 + hy, 4.5, 0, Math.PI * 2);
  ctx.fill();
  // Focinho, olho, boca
  ctx.fillStyle = '#26282B';
  ctx.beginPath();
  ctx.ellipse(73.5, -40 + hy, 3.5, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(58, -46 + hy, 1.8, 0, Math.PI * 2);
  ctx.fill();
  if (b.chasing) {
    // Rugindo de boca aberta
    ctx.fillStyle = '#6B2A2A';
    ctx.beginPath();
    ctx.ellipse(66, -32 + hy, 6, 3.5 + Math.abs(Math.sin(t * 12)) * 1.5, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(62, -35 + hy, 1.6, 2);
    ctx.fillRect(68, -34 + hy, 1.6, 2);
  } else {
    ctx.strokeStyle = '#6E665A';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(70, -34 + hy);
    ctx.quadraticCurveTo(66, -32 + hy, 62, -34 + hy);
    ctx.stroke();
  }

  if (outfit === 'santaHat') drawSantaHat(ctx, b, hy, t);

  leg(-22, sw, false);
  leg(32, -sw, false);
  ctx.restore();
}
