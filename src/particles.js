import { W, H, PALETTE, DEPTH } from './config.js';
import { depthScale, projectX, swayAt } from './depth.js';

// Gancho das chamas 3D (src/m3d/particles3d.js): as tochas chamam fireArt.draw(ctx, x,
// base, altura, largura, semente, t) e, se ele desenhou, pulam a chama 2D
export const fireArt = { draw: null };

// Pegadas na costa: uma a cada `step` px andados, alternando os pés; ficam inteiras um
// instante e depois somem, a mais antiga primeiro
export const PRINTS = { step: 22, life: 2.6, hold: 0.35, spread: 3.5 };
// Cor das pegadas por cenário (a marca afundada no chão)
export const PRINT_COLORS = {
  ice: [112, 146, 172], forest: [44, 62, 30], space: [84, 82, 98], beach: [152, 118, 74], halloween: [26, 32, 28], dino: [62, 40, 26],
};
// Peixes que saltam da água (frequência do salto, a mesma do desenho): espirram água ao
// sair e, mais forte, ao voltar
export const FISH_HOP = { fish: 4, tfish: 3, piranha: 3.2 };
// Opacidade de uma pegada com idade t
export const printAlpha = (t) => (t < PRINTS.hold * PRINTS.life ? 1 : Math.max(0, 1 - (t - PRINTS.hold * PRINTS.life) / ((1 - PRINTS.hold) * PRINTS.life)));

// Cada partícula é desenhada na perspectiva da linha onde está (como placas e bichos)
function enterDepth(ctx, y) {
  ctx.save();
  const s = depthScale(y);
  const o = swayAt(y);
  if (s === 1 && !o) return;
  ctx.translate(DEPTH.vanishX + o, y);
  ctx.scale(s, s);
  ctx.translate(-DEPTH.vanishX, -y);
}

export class Particles {
  constructor() {
    this.drops = [];
    this.ripples = [];
    this.puffs = [];
    this.texts = [];
    this.fx = [];
    this.prints = [];
    this.leaves = false;   // fase da floresta: folhas caindo no lugar da neve
    this.stardust = false; // fase do espaço: poeira estelar no lugar da neve
    this.calm = false;     // fase sem nada caindo do céu (praia)
    this.embers = false;   // fase dos dinossauros: brasas subindo no lugar da neve
    // Cores do líquido (respingo, anel e bolhas); null = água clarinha
    this.liquid = null;
    // Neve ambiente
    this.snow = Array.from({ length: 140 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 0.8 + Math.random() * 2.2,
      vy: 18 + Math.random() * 40,
      sway: Math.random() * Math.PI * 2,
    }));
  }

  splash(x, y) {
    for (let i = 0; i < 26; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const s = 120 + Math.random() * 220;
      this.drops.push({
        x, y,
        vx: Math.cos(a) * s * 0.6,
        vy: Math.sin(a) * s,
        r: 1.5 + Math.random() * 2.5,
        life: 0.6 + Math.random() * 0.4,
        t: 0,
        floor: y + 4,
      });
    }
    this.ripples.push({ x, y, t: 0 }, { x, y, t: -0.15 });
  }

  // Respingo pequeno de peixe saindo (out) ou voltando para a água: gotinhas e um anel
  fishSplash(x, y, back = true) {
    const n = back ? 12 : 6;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
      const s = (back ? 70 : 50) + Math.random() * (back ? 110 : 70);
      this.drops.push({
        x, y,
        vx: Math.cos(a) * s * 0.55,
        vy: Math.sin(a) * s,
        r: 0.9 + Math.random() * 1.4,
        life: 0.45 + Math.random() * 0.3,
        t: 0,
        floor: y + 3,
      });
    }
    this.ripples.push({ x, y, t: 0, s: back ? 0.45 : 0.3 });
  }

  // Pegada (side: 0 pé esquerdo, 1 pé direito; dir: para onde anda)
  footprint(x, y, dir, side) {
    this.prints.push({ x, y: y + (side ? PRINTS.spread : -PRINTS.spread) * 0.5, dir, side, t: 0 });
  }

  // Nuvenzinha de neve (encaixe de bloco, bloco removido)
  puff(x, y, n = 10, color = '#FFFFFF') {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 20 + Math.random() * 60;
      this.puffs.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s * 0.5 - 15,
        r: 3 + Math.random() * 4,
        t: 0,
        life: 0.5 + Math.random() * 0.4,
        color,
      });
    }
  }

  text(x, y, str, color = '#FFFFFF') {
    this.texts.push({ x, y, str, color, t: 0 });
  }

  // ---- Efeitos da Etapa 4 (lista única `fx`, cada um com seu tipo)

  // Lascas de gelo ao pousar numa placa
  chips(x, y, n = 7, color = '#E8F7FC') {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const s = 60 + Math.random() * 90;
      this.fx.push({
        kind: 'chip', x: x + (Math.random() - 0.5) * 16, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s, floor: y + 3,
        r: 1 + Math.random() * 1.6, rot: Math.random() * 6, t: 0, life: 0.55, color,
      });
    }
  }

  // Brilhos subindo (fileira ativada)
  sparkle(x, y, n = 3, color = '#DFF7FF') {
    for (let i = 0; i < n; i++) {
      this.fx.push({
        kind: 'spark', x: x + (Math.random() - 0.5) * 60, y: y - Math.random() * 10,
        vx: (Math.random() - 0.5) * 12, vy: -30 - Math.random() * 40,
        r: 2 + Math.random() * 2.5, t: -Math.random() * 0.25, life: 0.7 + Math.random() * 0.4,
        color, ph: Math.random() * 6,
      });
    }
  }

  // Bolhas subindo de quem está afundando
  bubble(x, y, surface) {
    this.fx.push({
      kind: 'bubble', x: x + (Math.random() - 0.5) * 14, y,
      vx: 0, vy: -28 - Math.random() * 18, surface,
      r: 1.5 + Math.random() * 2.5, t: 0, life: 1.6, ph: Math.random() * 6,
    });
  }

  // Vapor da respiração no frio
  breath(x, y, dir) {
    for (let i = 0; i < 3; i++) {
      this.fx.push({
        kind: 'vapor', x: x + dir * i * 2, y: y - i,
        vx: dir * (16 + Math.random() * 10), vy: -6 - Math.random() * 6,
        r: 2.5 + i, t: -i * 0.05, life: 1.1,
      });
    }
  }

  // Fumaça subindo do iglu (fim de fase)
  smoke(x, y) {
    this.fx.push({
      kind: 'smoke', x: x + (Math.random() - 0.5) * 6, y,
      vx: 6 + Math.random() * 8, vy: -24 - Math.random() * 10,
      r: 5, t: 0, life: 2.4,
    });
  }

  updateFx(dt) {
    for (const f of this.fx) {
      f.t += dt;
      if (f.t < 0) continue;
      if (f.kind === 'chip') {
        f.vy += 600 * dt;
        f.rot += dt * 12;
      } else if (f.kind === 'bubble') {
        f.x += Math.sin(f.t * 9 + f.ph) * 10 * dt;
      } else if (f.kind === 'vapor') {
        f.vx *= 1 - 1.5 * dt;
      }
      f.x += f.vx * dt;
      f.y += f.vy * dt;
    }
    this.fx = this.fx.filter((f) =>
      f.t < f.life &&
      !(f.kind === 'chip' && f.y > f.floor) &&
      !(f.kind === 'bubble' && f.y < f.surface));
  }

  // skip: tipos que não são desenhados aqui (no modo só 3D, fumaça e vapor são 3D)
  drawFx(ctx, skip = null) {
    ctx.save();
    for (const f of this.fx) {
      if (f.t < 0 || skip?.has(f.kind)) continue;
      const k = f.t / f.life;
      enterDepth(ctx, f.y);
      switch (f.kind) {
        case 'chip':
          ctx.globalAlpha = 1 - k;
          ctx.fillStyle = f.color || '#E8F7FC';
          ctx.save();
          ctx.translate(f.x, f.y);
          ctx.rotate(f.rot);
          ctx.fillRect(-f.r, -f.r * 0.6, f.r * 2, f.r * 1.2);
          ctx.restore();
          break;
        case 'spark': {
          const tw = 0.6 + 0.4 * Math.sin(f.t * 25 + f.ph);
          ctx.globalAlpha = (1 - k) * tw;
          ctx.fillStyle = f.color;
          const r = f.r * (1 - k * 0.5);
          ctx.beginPath();
          ctx.moveTo(f.x, f.y - r * 2);
          ctx.lineTo(f.x + r * 0.45, f.y - r * 0.45);
          ctx.lineTo(f.x + r * 2, f.y);
          ctx.lineTo(f.x + r * 0.45, f.y + r * 0.45);
          ctx.lineTo(f.x, f.y + r * 2);
          ctx.lineTo(f.x - r * 0.45, f.y + r * 0.45);
          ctx.lineTo(f.x - r * 2, f.y);
          ctx.lineTo(f.x - r * 0.45, f.y - r * 0.45);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'bubble':
          ctx.globalAlpha = 0.8;
          ctx.strokeStyle = this.liquid?.bubble || 'rgba(220, 245, 255, 0.9)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.fillRect(f.x - f.r * 0.4, f.y - f.r * 0.5, 1, 1);
          break;
        case 'vapor':
          ctx.globalAlpha = 0.4 * (1 - k);
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r * (1 + k * 1.8), 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'smoke':
          ctx.globalAlpha = 0.6 * (1 - k) * Math.min(1, f.t * 4);
          ctx.fillStyle = '#9AAAB5';
          ctx.beginPath();
          ctx.arc(f.x + Math.sin(f.t * 2.5) * 4, f.y, f.r * (1 + k * 2.5), 0, Math.PI * 2);
          ctx.fill();
          break;
        default:
          break;
      }
      ctx.restore();
    }
    ctx.restore();
  }

  update(dt) {
    for (const d of this.drops) {
      d.t += dt;
      d.vy += 700 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
    }
    this.drops = this.drops.filter((d) => d.t < d.life && d.y < d.floor + 2);
    for (const p of this.puffs) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 3 * dt;
      p.vy *= 1 - 3 * dt;
    }
    this.puffs = this.puffs.filter((p) => p.t < p.life);
    for (const s of this.texts) {
      s.t += dt;
      s.y -= 40 * dt;
    }
    this.texts = this.texts.filter((s) => s.t < 1.1);
    for (const r of this.ripples) r.t += dt;
    this.ripples = this.ripples.filter((r) => r.t < 1);
    for (const p of this.prints) p.t += dt;
    this.prints = this.prints.filter((p) => p.t < PRINTS.life);
    this.updateFx(dt);
    for (const s of this.snow) {
      s.sway += dt;
      s.y += s.vy * dt;
      s.x += Math.sin(s.sway) * 12 * dt;
      if (s.y > H + 4) { s.y = -4; s.x = Math.random() * W; }
    }
  }

  drawRipples(ctx) {
    ctx.save();
    for (const r of this.ripples) {
      if (r.t < 0) continue;
      const k = r.t;
      ctx.strokeStyle = `rgba(${(this.liquid?.ripple || [207, 239, 250]).join(', ')}, ${0.7 * (1 - k)})`;
      ctx.lineWidth = 2;
      enterDepth(ctx, r.y);
      const sc = r.s || 1;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, (10 + k * 60) * sc, (3 + k * 12) * sc, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // Pegadas (desenho 2D, sem o modo só 3D): marquinhas escuras na linha da costa
  drawPrints(ctx, color = PRINT_COLORS.ice) {
    if (!this.prints.length) return;
    ctx.save();
    ctx.fillStyle = `rgb(${color.join(',')})`;
    for (const p of this.prints) {
      ctx.globalAlpha = 0.55 * printAlpha(p.t);
      const s = depthScale(p.y);
      ctx.beginPath();
      ctx.ellipse(projectX(p.x, p.y), p.y, 4.5 * s, 1.8 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawDrops(ctx) {
    ctx.save();
    ctx.fillStyle = this.liquid?.splash || PALETTE.splash;
    for (const d of this.drops) {
      ctx.globalAlpha = 1 - d.t / d.life;
      const s = depthScale(d.floor ?? d.y);
      ctx.beginPath();
      ctx.arc(projectX(d.x, d.floor ?? d.y), d.y, d.r * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawPuffs(ctx) {
    ctx.save();
    for (const p of this.puffs) {
      const k = p.t / p.life;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.85 * (1 - k);
      ctx.beginPath();
      ctx.arc(projectX(p.x, p.y), p.y, p.r * (1 + k) * depthScale(p.y), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawTexts(ctx) {
    ctx.save();
    ctx.font = '800 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(6, 30, 45, 0.6)';
    for (const s of this.texts) {
      const k = s.t / 1.1;
      ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      const sc = s.t < 0.12 ? 0.6 + (s.t / 0.12) * 0.4 : 1;
      ctx.save();
      ctx.translate(projectX(s.x, s.y), s.y);
      ctx.scale(sc, sc);
      ctx.strokeText(s.str, 0, 0);
      ctx.fillStyle = s.color;
      ctx.fillText(s.str, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  drawSnow(ctx) {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    for (const s of this.snow) {
      ctx.globalAlpha = 0.35 + s.r * 0.18;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
