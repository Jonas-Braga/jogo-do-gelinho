import { W, H, PALETTE } from './config.js';

export class Particles {
  constructor() {
    this.drops = [];
    this.ripples = [];
    this.puffs = [];
    this.texts = [];
    this.fx = [];
    this.leaves = false;   // fase da floresta: folhas caindo no lugar da neve
    this.stardust = false; // fase do espaço: poeira estelar no lugar da neve
    this.calm = false;     // fase sem nada caindo do céu (praia)
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

  drawFx(ctx) {
    ctx.save();
    for (const f of this.fx) {
      if (f.t < 0) continue;
      const k = f.t / f.life;
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
          ctx.strokeStyle = 'rgba(220, 245, 255, 0.9)';
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
      ctx.strokeStyle = `rgba(207, 239, 250, ${0.7 * (1 - k)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, 10 + k * 60, 3 + k * 12, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawDrops(ctx) {
    ctx.save();
    ctx.fillStyle = PALETTE.splash;
    for (const d of this.drops) {
      ctx.globalAlpha = 1 - d.t / d.life;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
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
      ctx.arc(p.x, p.y, p.r * (1 + k), 0, Math.PI * 2);
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
      ctx.translate(s.x, s.y);
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
