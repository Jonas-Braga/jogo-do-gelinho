import { IGLOO, RULES, SHORE_Y } from './config.js';
import { CABIN_PIECES, CABIN_VENT, RIVER } from './forest.js';
import { BASE_PIECES, BASE_VENT, DUST } from './space.js';

// Construções das fases especiais: peças (para a poeira do encaixe), de onde sai
// a fumaça e a cor da poeira. O iglu usa o próprio layout de blocos.
const HOUSES = {
  cabin: { pieces: CABIN_PIECES, vent: CABIN_VENT, dust: RIVER.sawdust },
  base: { pieces: BASE_PIECES, vent: BASE_VENT, dust: DUST.regolith },
};

const LAYERS = [5, 4, 3, 2, 1]; // 15 blocos em 5 camadas; a peça 16 é a porta (pórtico)

// Porta na frente da cúpula (coordenadas do mundo). A base fica na linha dos pés.
export const DOOR = {
  x: IGLOO.x,
  bottom: SHORE_Y + 1,
  rx: IGLOO.doorRx,
  h: IGLOO.doorH,
  porchRx: IGLOO.porchRx,
  porchRy: IGLOO.porchRy,
};
const DROP_TIME = 0.45;

// Layout em coordenadas locais (origem no centro da base do iglu).
function buildLayout() {
  const { rx, ry } = IGLOO;
  const lh = ry / LAYERS.length;
  const blocks = [];
  LAYERS.forEach((n, k) => {
    const yBottom = -k * lh;
    const yTop = yBottom - lh;
    const hw = rx * Math.sqrt(Math.max(0, 1 - (k * lh / ry) ** 2));
    const bw = (hw * 2) / n;
    for (let i = 0; i < n; i++) {
      const x0 = -hw + i * bw;
      blocks.push({ x0, x1: x0 + bw, y0: yTop, y1: yBottom, cx: x0 + bw / 2, cy: (yTop + yBottom) / 2 });
    }
  });
  return blocks;
}

const easeOutBack = (k) => {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2;
};

export class Igloo {
  constructor(particles, sfx = null) {
    this.particles = particles;
    this.sfx = sfx;
    this.layout = buildLayout();
    // 'igloo', 'cabin' (floresta) ou 'base' (espaço): só muda o desenho e de onde saem
    // a serragem e a fumaça; as regras de construção são as mesmas
    this.style = 'igloo';
    this.reset();
  }

  reset() {
    this.count = 0;
    this.anim = new Array(RULES.iglooPieces).fill(1);
    this.landed = new Array(RULES.iglooPieces).fill(true);
    this.lit = false;   // luz acesa lá dentro (depois que o jogador entra)
    this.curtain = 0;   // cortina de pele da porta: 0 aberta, 1 fechada
    this.shade = 0;     // sombra do interior sobre quem está entrando (0..1)
  }

  get complete() {
    return this.count >= RULES.iglooPieces;
  }

  get doorX() {
    return DOOR.x;
  }

  get doorHeight() {
    return DOOR.h;
  }

  get doorWidth() {
    return DOOR.rx * 2;
  }

  // Topo da cúpula (de onde sai a fumaça)
  get ventPos() {
    const h = HOUSES[this.style];
    if (h) return { ...h.vent };
    return { x: IGLOO.x + 6, y: IGLOO.baseY - IGLOO.ry + 4 };
  }

  // Poeira do encaixe: neve no iglu, serragem na cabana, poeira lunar na base
  get dustColor() {
    return HOUSES[this.style]?.dust || '#FFFFFF';
  }

  pieceWorld(i) {
    const h = HOUSES[this.style];
    if (h) {
      const c = h.pieces[Math.min(i, h.pieces.length - 1)];
      return { x: IGLOO.x + c.cx, y: IGLOO.baseY + c.cy };
    }
    if (i >= this.layout.length) return { x: DOOR.x, y: DOOR.bottom - DOOR.porchRy + 20 };
    const b = this.layout[i];
    return { x: IGLOO.x + b.cx, y: IGLOO.baseY + b.cy };
  }

  add() {
    if (this.complete) return false;
    const i = this.count++;
    this.anim[i] = 0;
    this.landed[i] = false;
    return true;
  }

  remove() {
    if (this.count <= 0) return false;
    this.count--;
    const p = this.pieceWorld(this.count);
    this.particles.puff(p.x, p.y, 14, this.dustColor);
    this.sfx?.play('unblock');
    return true;
  }

  update(dt) {
    for (let i = 0; i < this.count; i++) {
      if (this.anim[i] < 1) this.anim[i] = Math.min(1, this.anim[i] + dt / DROP_TIME);
      if (!this.landed[i] && this.anim[i] > 0.55) {
        this.landed[i] = true;
        const p = this.pieceWorld(i);
        this.particles.puff(p.x, p.y + 6, 8, this.dustColor);
        this.sfx?.play('block');
      }
    }
  }

  dome(ctx) {
    ctx.beginPath();
    ctx.ellipse(0, 0, IGLOO.rx, IGLOO.ry, 0, Math.PI, 0);
    ctx.closePath();
  }

  draw(ctx, t) {
    const { rx, ry } = IGLOO;
    ctx.save();
    ctx.translate(IGLOO.x, IGLOO.baseY);

    // Sombra no chão
    ctx.fillStyle = 'rgba(70, 105, 125, 0.22)';
    ctx.beginPath();
    ctx.ellipse(6, 3, rx + 12, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Contorno-guia do que falta construir
    if (!this.complete) {
      ctx.save();
      ctx.setLineDash([5, 6]);
      ctx.strokeStyle = 'rgba(120, 160, 180, 0.45)';
      ctx.lineWidth = 1.5;
      this.dome(ctx);
      ctx.stroke();
      ctx.restore();
    }

    const grd = ctx.createLinearGradient(-rx, -ry, rx, 0);
    grd.addColorStop(0, '#FFFFFF');
    grd.addColorStop(0.5, '#E6EEF0');
    grd.addColorStop(1, '#AFC6CE');

    const blocks = Math.min(this.count, this.layout.length);
    for (let i = 0; i < blocks; i++) {
      const b = this.layout[i];
      const a = this.anim[i];
      const off = -(1 - easeOutBack(a)) * 46;
      ctx.save();
      ctx.globalAlpha = Math.min(1, a * 3);
      ctx.translate(0, off);
      this.dome(ctx);
      ctx.clip();
      ctx.fillStyle = grd;
      ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      // Juntas entre blocos
      ctx.strokeStyle = 'rgba(120, 155, 170, 0.75)';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(b.x0 + 0.8, b.y0 + 0.8, b.x1 - b.x0 - 1.6, b.y1 - b.y0 - 1.6);
      // Aresta superior iluminada e textura de neve compactada
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(b.x0 + 2, b.y0 + 2, b.x1 - b.x0 - 4, 1.5);
      ctx.fillStyle = 'rgba(140, 170, 185, 0.25)';
      for (let k = 0; k < 6; k++) {
        const fx = b.x0 + 4 + ((i * 37 + k * 53) % 100) / 100 * (b.x1 - b.x0 - 8);
        const fy = b.y0 + 4 + ((i * 17 + k * 29) % 100) / 100 * (b.y1 - b.y0 - 8);
        ctx.fillRect(fx, fy, 2, 1);
      }
      ctx.restore();
    }

    // Sombreamento geral da cúpula (luz vindo da esquerda)
    if (blocks > 0) {
      ctx.save();
      this.dome(ctx);
      ctx.clip();
      const sh = ctx.createRadialGradient(-rx * 0.35, -ry * 0.7, 8, 0, -ry * 0.3, rx * 1.2);
      sh.addColorStop(0, 'rgba(255,255,255,0)');
      sh.addColorStop(1, 'rgba(60, 100, 125, 0.25)');
      ctx.fillStyle = sh;
      const topY = this.layout[blocks - 1].y0;
      ctx.fillRect(-rx, topY, rx * 2, -topY);
      ctx.restore();
    }

    ctx.restore();

    // Contorno-guia da porta enquanto não está pronta
    if (!this.complete) {
      ctx.save();
      ctx.setLineDash([5, 6]);
      ctx.strokeStyle = 'rgba(120, 160, 180, 0.45)';
      ctx.lineWidth = 1.5;
      this.archPath(ctx, DOOR.porchRx, DOOR.porchRy);
      ctx.stroke();
      ctx.restore();
    }
    this.drawPorch(ctx, t);
  }

  // Arco (meia-elipse) apoiado na base da porta
  archPath(ctx, rx, h, dy = 0) {
    ctx.beginPath();
    ctx.ellipse(DOOR.x, DOOR.bottom + dy, rx, h, 0, Math.PI, 0);
    ctx.closePath();
  }

  doorOffset() {
    const a = this.anim[RULES.iglooPieces - 1];
    return { alpha: Math.min(1, a * 3), dy: -(1 - easeOutBack(a)) * 30 };
  }

  // Pórtico de neve na frente da cúpula, com a abertura escura no meio
  drawPorch(ctx, t) {
    if (this.count < RULES.iglooPieces) return;
    const { alpha, dy } = this.doorOffset();
    const top = DOOR.bottom - DOOR.porchRy;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(0, dy);

    // Sombra no chão
    ctx.fillStyle = 'rgba(70, 105, 125, 0.22)';
    ctx.beginPath();
    ctx.ellipse(DOOR.x + 4, DOOR.bottom + 1, DOOR.porchRx + 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Abertura escura (interior)
    const dg = ctx.createLinearGradient(0, DOOR.bottom - DOOR.h, 0, DOOR.bottom);
    dg.addColorStop(0, '#0B1E28');
    dg.addColorStop(1, '#22404D');
    ctx.fillStyle = dg;
    this.archPath(ctx, DOOR.rx, DOOR.h);
    ctx.fill();
    if (this.lit) this.drawGlow(ctx, t);

    this.drawCurtain(ctx, t);
    if (this.lit && this.curtain >= 1) {
      // Filete de luz quente escapando pelas bordas da cortina
      const k = 0.65 + Math.sin(t * 5) * 0.12;
      ctx.save();
      ctx.shadowColor = 'rgba(255, 190, 100, 0.9)';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = `rgba(255, 200, 120, ${k})`;
      ctx.lineWidth = 2.5;
      this.archPath(ctx, DOOR.rx - 1.5, DOOR.h - 1.5);
      ctx.stroke();
      ctx.restore();
    }
    this.drawFrame(ctx, top);
    ctx.restore();
  }

  // Moldura do pórtico (arco externo menos a abertura), em blocos de neve.
  // Também é desenhada por cima do personagem enquanto ele entra.
  drawFrame(ctx, top = DOOR.bottom - DOOR.porchRy) {
    const ring = () => {
      ctx.beginPath();
      ctx.ellipse(DOOR.x, DOOR.bottom, DOOR.porchRx, DOOR.porchRy, 0, Math.PI, 0);
      ctx.closePath();
      ctx.ellipse(DOOR.x, DOOR.bottom, DOOR.rx, DOOR.h, 0, 0, Math.PI, true);
      ctx.closePath();
    };
    const g = ctx.createLinearGradient(DOOR.x - DOOR.porchRx, top, DOOR.x + DOOR.porchRx, DOOR.bottom);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(0.55, '#E6EEF0');
    g.addColorStop(1, '#B3C8CF');
    ctx.fillStyle = g;
    ring();
    ctx.fill('evenodd');

    // Juntas dos blocos: arcos concêntricos e divisões radiais
    ctx.save();
    ring();
    ctx.clip('evenodd');
    ctx.strokeStyle = 'rgba(120, 155, 170, 0.7)';
    ctx.lineWidth = 1.5;
    const midRx = (DOOR.porchRx + DOOR.rx) / 2;
    const midRy = (DOOR.porchRy + DOOR.h) / 2;
    ctx.beginPath();
    ctx.ellipse(DOOR.x, DOOR.bottom, midRx, midRy, 0, Math.PI, 0);
    ctx.stroke();
    for (let i = 1; i < 6; i++) {
      const a = Math.PI + (Math.PI * i) / 6;
      ctx.beginPath();
      ctx.moveTo(DOOR.x + Math.cos(a) * DOOR.rx, DOOR.bottom + Math.sin(a) * DOOR.h);
      ctx.lineTo(DOOR.x + Math.cos(a) * DOOR.porchRx, DOOR.bottom + Math.sin(a) * DOOR.porchRy);
      ctx.stroke();
    }
    ctx.restore();
    // Borda iluminada do arco interno e contorno externo
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(DOOR.x, DOOR.bottom, DOOR.rx, DOOR.h, 0, Math.PI, Math.PI * 1.5);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(110, 145, 160, 0.75)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(DOOR.x, DOOR.bottom, DOOR.porchRx, DOOR.porchRy, 0, Math.PI, 0);
    ctx.stroke();
  }

  // Cortina de pele que desce e fecha a porta depois que o jogador entra
  drawCurtain(ctx, t) {
    const k = this.curtain;
    if (k <= 0) return;
    const top = DOOR.bottom - DOOR.h;
    const h = DOOR.h * k + 2;
    ctx.save();
    this.archPath(ctx, DOOR.rx, DOOR.h);
    ctx.clip();
    const g = ctx.createLinearGradient(DOOR.x - DOOR.rx, 0, DOOR.x + DOOR.rx, 0);
    g.addColorStop(0, '#5A3E26');
    g.addColorStop(0.45, '#8A6440');
    g.addColorStop(1, '#4E351F');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(DOOR.x - DOOR.rx, top - 2);
    ctx.lineTo(DOOR.x + DOOR.rx, top - 2);
    // borda de baixo ondulada, balançando um pouco enquanto desce
    const sway = k < 1 ? Math.sin(t * 14) * 2 : Math.sin(t * 2) * 0.6;
    for (let i = 8; i >= 0; i--) {
      const x = DOOR.x - DOOR.rx + (DOOR.rx * 2 * i) / 8;
      ctx.lineTo(x, top + h + Math.sin(i * 1.3 + t * 3) * 1.5 + sway * (i % 2 ? 1 : -1));
    }
    ctx.closePath();
    ctx.fill();
    // Costuras e textura de pelo
    ctx.strokeStyle = 'rgba(40, 25, 12, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(DOOR.x - 6, top);
    ctx.lineTo(DOOR.x - 5, top + h - 3);
    ctx.moveTo(DOOR.x + 8, top);
    ctx.lineTo(DOOR.x + 9, top + h - 3);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255, 230, 190, 0.18)';
    ctx.fillRect(DOOR.x - DOOR.rx, top + h - 4, DOOR.rx * 2, 2);
    ctx.restore();
  }

  // Luz quente vazando pelas frestas da cortina
  drawGlow(ctx, t) {
    const k = 0.5 + Math.sin(t * 5) * 0.08;
    const cy = DOOR.bottom - DOOR.h * 0.4;
    const lg = ctx.createRadialGradient(DOOR.x, cy, 4, DOOR.x, cy, 70);
    lg.addColorStop(0, `rgba(255, 196, 110, ${k})`);
    lg.addColorStop(1, 'rgba(255, 196, 110, 0)');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.arc(DOOR.x, cy, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 205, 130, ${k + 0.25})`;
    this.archPath(ctx, DOOR.rx - 2, DOOR.h - 2);
    ctx.fill();
  }

  // Desenhado POR CIMA do personagem enquanto ele entra: sombra do interior
  // sobre ele (só dentro da abertura), a cortina descendo e a moldura do arco.
  drawDoorFront(ctx, t) {
    if (this.count < RULES.iglooPieces) return;
    const { alpha, dy } = this.doorOffset();
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(0, dy);
    if (this.shade > 0) {
      ctx.save();
      this.archPath(ctx, DOOR.rx, DOOR.h);
      ctx.clip();
      ctx.fillStyle = `rgba(8, 26, 36, ${0.35 * this.shade})`;
      ctx.fillRect(DOOR.x - DOOR.rx, DOOR.bottom - DOOR.h, DOOR.rx * 2, DOOR.h);
      ctx.restore();
    }
    this.drawCurtain(ctx, t);
    this.drawFrame(ctx);
    ctx.restore();
  }
}
