// Troféus das fases especiais: a taça dourada (mesma forma para todos, para formar
// uma coleção) com a fita e o emblema do tema, a prateleira da tela inicial, os
// ícones do ranking e a comemoração ao ganhar um troféu novo.
import { W, H } from './config.js';
import { FONT } from './ui.js';
import { TROPHY_LEVELS, trophyFor } from './specials.js';

const GOLD = { light: '#FFF2B8', mid: '#FFD36B', dark: '#D9962A', deep: '#8E5A12' };

// ---------------------------------------------------------------- Emblemas
// Desenhados no medalhão da taça, em coordenadas locais (raio útil ~13)
function star(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.fill();
}

export const TROPHY_EMBLEMS = {
  // Árvore de Natal com bolinhas e estrela no topo
  natal(ctx) {
    ctx.fillStyle = '#6B3A1E';
    ctx.fillRect(-2, 6, 4, 5);
    ctx.fillStyle = '#2FA552';
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(7, -2);
    ctx.lineTo(4, -2);
    ctx.lineTo(10, 7);
    ctx.lineTo(-10, 7);
    ctx.lineTo(-4, -2);
    ctx.lineTo(-7, -2);
    ctx.closePath();
    ctx.fill();
    for (const [x, y, c] of [[-3, 0, '#FFD36B'], [3, 3, '#FFFFFF'], [-5, 5, '#FFFFFF'], [5, -3, '#FFD36B'], [0, 4, '#FFD36B']]) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x, y, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
    star(ctx, 0, -11, 4.2, '#FFE066');
  },
  // Folha de outono com nervuras sobre um pinheiro ao fundo
  floresta(ctx) {
    ctx.fillStyle = '#1D5A28';
    ctx.beginPath();
    ctx.moveTo(-6, -11);
    ctx.lineTo(-1, 2);
    ctx.lineTo(-11, 2);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.translate(2, 1);
    ctx.rotate(-0.6);
    ctx.fillStyle = '#F29A2E';
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.bezierCurveTo(8, -6, 8, 5, 0, 10);
    ctx.bezierCurveTo(-8, 5, -8, -6, 0, -11);
    ctx.fill();
    ctx.strokeStyle = '#8A4A12';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(0, 13);
    for (const y of [-4, 0, 4]) {
      ctx.moveTo(0, y);
      ctx.lineTo(4.5, y - 3);
      ctx.moveTo(0, y);
      ctx.lineTo(-4.5, y - 3);
    }
    ctx.stroke();
    ctx.restore();
  },
  // Planeta com anel e estrelinhas
  espaco(ctx) {
    for (const [x, y, r] of [[-9, -8, 1.2], [8, -10, 1], [10, 7, 1.1], [-10, 8, 0.9]]) {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.rotate(-0.4);
    ctx.strokeStyle = '#FFE7A8';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 3.6, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    const g = ctx.createRadialGradient(-2, -2, 1, 0, 0, 7);
    g.addColorStop(0, '#FFE2A0');
    g.addColorStop(1, '#E08A3A');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 3.6, 0, 0, Math.PI);
    ctx.stroke();
    ctx.restore();
  },
  // Coqueiro numa ilhota com o sol ao fundo
  praia(ctx) {
    ctx.fillStyle = '#FFE066';
    ctx.beginPath();
    ctx.arc(6, -5, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F3D9A0';
    ctx.beginPath();
    ctx.ellipse(0, 11, 13, 4, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8A5A2A';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-3, 9);
    ctx.quadraticCurveTo(-5, 0, -1, -6);
    ctx.stroke();
    ctx.strokeStyle = '#3FBF5A';
    ctx.lineWidth = 2.2;
    for (const [dx, dy] of [[-10, -3], [-8, -10], [0, -12], [8, -9], [9, -2]]) {
      ctx.beginPath();
      ctx.moveTo(-1, -6);
      ctx.quadraticCurveTo(-1 + dx * 0.5, -6 + dy * 0.9 - 3, -1 + dx, -6 + dy * 0.5 + 2);
      ctx.stroke();
    }
  },
};

// ---------------------------------------------------------------- Taça
// Contorno do bojo (unidades: a taça tem 100 de altura, base em y = 0)
function bowlPath(ctx) {
  ctx.beginPath();
  ctx.moveTo(-32, -96);
  ctx.lineTo(32, -96);
  ctx.bezierCurveTo(32, -60, 20, -42, 6, -38);
  ctx.lineTo(-6, -38);
  ctx.bezierCurveTo(-20, -42, -32, -60, -32, -96);
  ctx.closePath();
}

function handles(ctx, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  for (const s of [1, -1]) {
    ctx.beginPath();
    ctx.moveTo(s * 30, -88);
    ctx.bezierCurveTo(s * 52, -90, s * 50, -58, s * 20, -52);
    ctx.stroke();
  }
}

function stemPath(ctx) {
  ctx.beginPath();
  ctx.moveTo(-6, -39);
  ctx.lineTo(6, -39);
  ctx.lineTo(4, -26);
  ctx.lineTo(15, -18);
  ctx.lineTo(-15, -18);
  ctx.lineTo(-4, -26);
  ctx.closePath();
}

// Silhueta de um troféu ainda não descoberto (com "?")
function drawLocked(ctx) {
  ctx.fillStyle = 'rgba(190, 225, 240, 0.13)';
  ctx.strokeStyle = 'rgba(190, 225, 240, 0.35)';
  ctx.lineWidth = 2;
  handles(ctx, 'rgba(190, 225, 240, 0.22)', 6);
  for (const path of [bowlPath, stemPath]) {
    path(ctx);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.roundRect(-26, -18, 52, 18, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = `900 30px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 0, -66);
}

// Desenha o troféu da fase com a base centrada em (x, y) e altura `size`.
// `locked` = silhueta; `spin` (−1..1) achata na horizontal para o efeito de giro;
// `shine` (0..1) passa um brilho diagonal pela taça.
export function drawTrophy(ctx, level, x, y, size, { locked = false, spin = 1, shine = null, detail = true } = {}) {
  const tr = trophyFor(level);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((size / 100) * spin, size / 100);
  if (locked || !tr) {
    drawLocked(ctx);
    ctx.restore();
    return;
  }
  // Base de madeira escura com a fita do tema
  const pg = ctx.createLinearGradient(0, -18, 0, 0);
  pg.addColorStop(0, '#5A3A22');
  pg.addColorStop(1, '#2E1C10');
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.roundRect(-26, -18, 52, 18, 3);
  ctx.fill();
  ctx.fillStyle = tr.ribbon;
  ctx.fillRect(-26, -12, 52, 6);
  if (detail) {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(-26, -12, 52, 1.5);
  }

  // Alças e haste
  handles(ctx, GOLD.deep, 7);
  handles(ctx, GOLD.mid, 4);
  const sg = ctx.createLinearGradient(-15, 0, 15, 0);
  sg.addColorStop(0, GOLD.deep);
  sg.addColorStop(0.4, GOLD.light);
  sg.addColorStop(1, GOLD.dark);
  ctx.fillStyle = sg;
  stemPath(ctx);
  ctx.fill();

  // Bojo dourado com reflexo
  const bg = ctx.createLinearGradient(-32, 0, 32, 0);
  bg.addColorStop(0, GOLD.dark);
  bg.addColorStop(0.28, GOLD.light);
  bg.addColorStop(0.55, GOLD.mid);
  bg.addColorStop(1, GOLD.deep);
  ctx.fillStyle = bg;
  bowlPath(ctx);
  ctx.fill();
  if (detail) {
    ctx.strokeStyle = 'rgba(110, 66, 10, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Borda: elipse clara com o fundo escuro da boca
  ctx.fillStyle = GOLD.light;
  ctx.beginPath();
  ctx.ellipse(0, -96, 32, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = GOLD.deep;
  ctx.beginPath();
  ctx.ellipse(0, -96, 27, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Medalhão com o emblema da fase
  ctx.fillStyle = tr.ribbon;
  ctx.beginPath();
  ctx.arc(0, -68, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = GOLD.light;
  ctx.lineWidth = 2.6;
  ctx.stroke();
  const emblem = TROPHY_EMBLEMS[tr.id];
  if (emblem && detail) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, -68, 15.5, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(0, -68);
    emblem(ctx);
    ctx.restore();
  } else if (emblem) {
    // Ícone pequeno (ranking): só o emblema simplificado num ponto claro
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(0, -68, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Brilho passando pela taça
  if (shine !== null && shine >= 0 && shine <= 1) {
    ctx.save();
    bowlPath(ctx);
    ctx.clip();
    const sx = -60 + shine * 120;
    const g = ctx.createLinearGradient(sx - 14, 0, sx + 14, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.transform(1, 0, -0.35, 1, 0, 0);
    ctx.fillRect(sx - 60, -110, 120, 80);
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- Ranking
export const RANK_TROPHY = { size: 30, gap: 27, max: 5 };

// Ícones dos troféus de um jogador, alinhados à direita em `right`.
// Com mais de RANK_TROPHY.max troféus, mostra um só ícone com "×N".
// Retorna a largura ocupada.
export function drawTrophyIcons(ctx, trophies, right, baseY) {
  const list = trophies || [];
  if (!list.length) return 0;
  const { size, gap, max } = RANK_TROPHY;
  ctx.save();
  if (list.length > max) {
    ctx.font = `800 15px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FFD36B';
    const label = `×${list.length}`;
    const lw = ctx.measureText(label).width;
    ctx.fillText(label, right, baseY - 4);
    drawTrophy(ctx, list[list.length - 1], right - lw - 13, baseY, size);
    ctx.restore();
    return lw + 26;
  }
  list.forEach((lv, i) => {
    drawTrophy(ctx, lv, right - (list.length - 1 - i) * gap - size * 0.25, baseY, size);
  });
  ctx.restore();
  return (list.length - 1) * gap + size * 0.6;
}

// ---------------------------------------------------------------- Prateleira
// Coleção na tela inicial: troféus ganhos e silhuetas com "?" para os que faltam
export const SHELF = { y: 276, size: 84, gap: 118, maxW: 1060 };

export function drawTrophyShelf(ctx, trophies, t = 0) {
  const have = new Set(trophies || []);
  const n = TROPHY_LEVELS.length;
  if (!n) return;
  // Com muitas fases especiais, os troféus encolhem para a prateleira caber na tela
  const k = Math.min(1, SHELF.maxW / ((n - 1) * SHELF.gap + SHELF.size * 1.7));
  const { y } = SHELF;
  const size = SHELF.size * k;
  const gap = SHELF.gap * k;
  const w = Math.max(260, (n - 1) * gap + size * 1.7);
  const x0 = W / 2 - ((n - 1) * gap) / 2;
  ctx.save();
  // Tábua da prateleira
  const g = ctx.createLinearGradient(0, y, 0, y + 10);
  g.addColorStop(0, '#B98A5A');
  g.addColorStop(1, '#6A4628');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(W / 2 - w / 2, y, w, 9, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(W / 2 - w / 2 + 6, y + 9, w - 12, 3);
  TROPHY_LEVELS.forEach((lv, i) => {
    const x = x0 + i * gap;
    const got = have.has(lv);
    // Brilho passando de vez em quando, um troféu de cada vez
    const sh = got ? ((t * 0.5 + i * 0.37) % 2.2) - 0.6 : null;
    drawTrophy(ctx, lv, x, y, size, { locked: !got, shine: sh });
  });
  ctx.textAlign = 'center';
  ctx.font = `800 14px ${FONT}`;
  ctx.fillStyle = '#FFD36B';
  ctx.fillText(`COLEÇÃO DE TROFÉUS  ${have.size}/${n}`, W / 2, y + 30);
  ctx.restore();
}

// ---------------------------------------------------------------- Comemoração
export const CELEBRATION = {
  minTime: 1.4,   // segundos antes de aceitar a tecla para continuar
  confetti: 110,
  center: { x: W / 2, y: 440 }, // base do troféu
  size: 210,
};

// Confete e fogos nas cores do tema enquanto o troféu novo aparece girando
export class Celebration {
  constructor(level, rand = Math.random) {
    this.level = level;
    this.trophy = trophyFor(level);
    this.t = 0;
    this.rand = rand;
    this.colors = [this.trophy?.ribbon || '#FFD36B', '#FFD36B', '#FFFFFF', '#FFF2B8', '#7FD8F2'];
    this.confetti = Array.from({ length: CELEBRATION.confetti }, () => this.piece(true));
    this.bursts = [];
    this.burstT = 0.25;
  }

  pick(list) {
    return list[Math.floor(this.rand() * list.length) % list.length];
  }

  piece(initial) {
    const r = this.rand;
    return {
      x: r() * W,
      y: initial ? -20 - r() * H * 0.9 : -20,
      vx: (r() - 0.5) * 70,
      vy: 90 + r() * 130,
      rot: r() * Math.PI * 2,
      vr: (r() - 0.5) * 9,
      w: 6 + r() * 7,
      h: 3 + r() * 4,
      phase: r() * 6.3,
      color: this.pick(this.colors),
    };
  }

  get ready() {
    return this.t >= CELEBRATION.minTime;
  }

  update(dt) {
    this.t += dt;
    for (let i = 0; i < this.confetti.length; i++) {
      const c = this.confetti[i];
      c.x += (c.vx + Math.sin(this.t * 3 + c.phase) * 30) * dt;
      c.y += c.vy * dt;
      c.rot += c.vr * dt;
      if (c.y > H + 20) this.confetti[i] = this.piece(false);
    }
    this.burstT -= dt;
    if (this.burstT <= 0) {
      this.burstT = 0.55 + this.rand() * 0.6;
      const left = this.rand() < 0.5;
      this.bursts.push({
        x: left ? 120 + this.rand() * 300 : W - 120 - this.rand() * 300,
        y: 110 + this.rand() * 220,
        t: 0,
        color: this.pick(this.colors),
        n: 26,
      });
    }
    for (const b of this.bursts) b.t += dt;
    this.bursts = this.bursts.filter((b) => b.t < 1.4);
  }
}

const easeOutBack = (k) => 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2;

export function drawCelebration(ctx, game) {
  const c = game.celebration;
  if (!c) return;
  const t = c.t;
  const { x: cx, y: cy } = CELEBRATION.center;
  const ribbon = c.trophy?.ribbon || '#FFD36B';
  ctx.save();
  ctx.fillStyle = `rgba(4, 16, 28, ${Math.min(0.78, t * 2)})`;
  ctx.fillRect(0, 0, W, H);

  // Fogos ao fundo
  for (const b of c.bursts) {
    const k = b.t / 1.4;
    const rad = 110 * (1 - Math.exp(-3.2 * b.t));
    ctx.globalAlpha = Math.max(0, 1 - k);
    ctx.fillStyle = b.color;
    for (let i = 0; i < b.n; i++) {
      const a = (i / b.n) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(b.x + Math.cos(a) * rad, b.y + Math.sin(a) * rad + 40 * b.t * b.t, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // Raios de luz girando atrás do troféu
  const appear = Math.min(1, t / 0.8);
  const ty = cy - CELEBRATION.size * 0.55;
  ctx.save();
  ctx.translate(cx, ty);
  ctx.rotate(t * 0.35);
  ctx.globalAlpha = 0.22 * appear;
  ctx.fillStyle = ribbon;
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 420, (i * Math.PI) / 6, (i * Math.PI) / 6 + Math.PI / 14);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  const glow = ctx.createRadialGradient(cx, ty, 10, cx, ty, 190);
  glow.addColorStop(0, `rgba(255, 230, 150, ${0.45 * appear})`);
  glow.addColorStop(1, 'rgba(255, 230, 150, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - 200, ty - 200, 400, 400);

  // Troféu: surge crescendo e girando, depois fica brilhando
  const grow = easeOutBack(appear);
  const spinK = Math.min(1, t / 1.3);
  const spin = Math.cos((1 - (1 - (1 - spinK) ** 3)) * Math.PI * 4);
  const bob = Math.sin(t * 2.2) * 4 * spinK;
  const shine = t > 1.3 ? ((t - 1.3) * 0.6) % 1.6 : null;
  drawTrophy(ctx, c.level, cx, cy + bob, CELEBRATION.size * Math.max(0.01, grow), { spin, shine });

  // Textos
  ctx.textAlign = 'center';
  const head = Math.min(1, t / 0.4);
  ctx.globalAlpha = head;
  ctx.font = `900 50px ${FONT}`;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#5A3A00';
  ctx.lineWidth = 8;
  ctx.strokeText('NOVO TROFÉU!', cx, 118);
  ctx.fillStyle = '#FFD36B';
  ctx.fillText('NOVO TROFÉU!', cx, 118);
  ctx.globalAlpha = Math.min(1, Math.max(0, (t - 0.6) / 0.4));
  ctx.font = `900 34px ${FONT}`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(c.trophy?.name || 'Troféu', cx, cy + 46);
  const have = game.trophies?.length || 1;
  ctx.font = `600 17px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(`Você concluiu a fase especial ${c.level}  ·  coleção ${have}/${TROPHY_LEVELS.length}`, cx, cy + 76);
  ctx.fillText('Ele vai aparecer ao lado do seu nome no ranking!', cx, cy + 100);

  // Minicoleção: o troféu novo pulsa
  const own = new Set(game.trophies || []);
  const gap = 46;
  const x0 = cx - ((TROPHY_LEVELS.length - 1) * gap) / 2;
  TROPHY_LEVELS.forEach((lv, i) => {
    const s = lv === c.level ? 34 * (1 + Math.sin(t * 6) * 0.08) : 30;
    drawTrophy(ctx, lv, x0 + i * gap, cy + 160, s, { locked: !own.has(lv) });
  });

  if (c.ready) {
    ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(t * 2.2));
    ctx.font = `800 20px ${FONT}`;
    ctx.fillStyle = '#FFFFFF';
    const msg = game.input?.touchMode ? 'Toque para continuar' : 'Enter ou Espaço para continuar';
    ctx.fillText(msg, cx, H - 56);
  }
  ctx.globalAlpha = 1;

  // Confete por cima de tudo
  for (const p of c.confetti) {
    if (p.y < -10) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.scale(1, Math.cos(p.rot * 1.7));
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  }
  ctx.restore();
}
