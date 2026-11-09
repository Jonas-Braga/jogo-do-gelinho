import { W, H, SHORE_TOP, WATER_TOP, RULES, IGLOO } from './config.js';
import {
  makeBackground, floeSprite, drawPlayer, drawGoose, drawCrab, drawClam, drawFish, drawBear,
} from './sprites.js';
import { floeOffset } from './floes.js';
import { drawSleigh, drawChristmasTrees, drawIglooLights } from './christmas.js';
import { drawHud } from './hud.js';

const CRITTER_DRAW = { goose: drawGoose, crab: drawCrab, clam: drawClam, fish: drawFish };

// Intensidade da aurora boreal (0 = nenhuma). Aparece nas fases avançadas,
// cresce com a fase e fica mais forte quando o céu escurece.
export function auroraStrength(level, skyF) {
  if (level < RULES.auroraFrom) return 0;
  const byLevel = Math.min(1, 0.45 + (level - RULES.auroraFrom) * 0.18);
  return byLevel * (0.35 + 0.65 * (1 - clamp01(skyF)));
}

const AURORA = [
  { base: 42, h: 80, freq: 0.0055, speed: 0.25, top: [160, 110, 255], bottom: [80, 255, 170], ph: 0 },
  { base: 70, h: 64, freq: 0.0075, speed: -0.18, top: [90, 200, 255], bottom: [120, 255, 160], ph: 2.1 },
  { base: 26, h: 54, freq: 0.004, speed: 0.12, top: [255, 120, 210], bottom: [110, 240, 200], ph: 4.2 },
];

const mod = (a, n) => ((a % n) + n) % n;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

function hexToRgb(h) {
  return h.match(/\w\w/g).map((v) => parseInt(v, 16));
}
function mix(a, b, k) {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  return pa.map((v, i) => Math.round(v + (pb[i] - v) * k));
}
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// Céu em três momentos: dia (temperatura cheia), entardecer, quase noite (0°).
const SKY = [
  { top: '1B2350', hor: 'C0607A', sun: 'FF8A5C' },
  { top: '3D6FA6', hor: 'F3B983', sun: 'FFC27A' },
  { top: '2A9CC0', hor: 'B4E0EC', sun: 'FFF6D8' },
];
function skyAt(f) {
  const k = clamp01(f) * 2;
  const i = Math.min(1, Math.floor(k));
  const a = SKY[i];
  const b = SKY[i + 1];
  const u = k - i;
  return { top: mix(a.top, b.top, u), hor: mix(a.hor, b.hor, u), sun: mix(a.sun, b.sun, u) };
}

export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.bg = makeBackground();
    this.skyF = 1;
    this.glints = Array.from({ length: 70 }, () => ({
      x: Math.random() * W,
      y: WATER_TOP + 20 + Math.random() * (H - WATER_TOP - 20),
      ph: Math.random() * Math.PI * 2,
      sp: 1.5 + Math.random() * 2.5,
    }));
  }

  draw(game) {
    const ctx = this.ctx;
    const t = game.time;
    if (game.state !== 'levelEnd') {
      this.skyF += (game.temp / RULES.tempStart - this.skyF) * 0.05;
    }
    const sky = skyAt(this.skyF);

    ctx.save();
    if (game.shake > 0) {
      const s = game.shake * 12;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }
    ctx.fillStyle = '#04192a';
    ctx.fillRect(-20, -20, W + 40, H + 40);

    this.drawSky(ctx, sky);
    this.aurora = auroraStrength(game.level, this.skyF);
    if (this.aurora > 0) this.drawAurora(ctx, t, this.aurora);
    ctx.drawImage(this.bg.canvas, 0, 0, this.bg.w, this.bg.h);
    const sp = game.special;
    if (sp?.sleigh) drawSleigh(ctx, game.sleigh, t);
    if (sp?.decor === 'natal') drawChristmasTrees(ctx, t);
    this.drawWater(ctx, t, sky);
    game.particles.drawRipples(ctx);
    this.drawEntities(ctx, game, t);
    game.particles.drawPuffs(ctx);
    game.particles.drawFx(ctx);
    game.particles.drawDrops(ctx);

    // Escurecimento do entardecer
    const dusk = 1 - this.skyF;
    if (dusk > 0.01) {
      ctx.fillStyle = `rgba(25, 30, 85, ${dusk * 0.3})`;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }
    game.particles.drawTexts(ctx);
    game.particles.drawSnow(ctx);
    ctx.restore();

    drawHud(ctx, game);
  }

  drawSky(ctx, sky) {
    const g = ctx.createLinearGradient(0, 0, 0, SHORE_TOP);
    g.addColorStop(0, rgb(sky.top));
    g.addColorStop(1, rgb(sky.hor));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, SHORE_TOP + 30);

    // Sol baixo, descendo conforme a temperatura cai
    const sy = 60 + (1 - this.skyF) * 110;
    const sx = 300;
    const halo = ctx.createRadialGradient(sx, sy, 4, sx, sy, 120);
    halo.addColorStop(0, rgb(sky.sun, 0.55));
    halo.addColorStop(1, rgb(sky.sun, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(sx - 120, sy - 120, 240, 240);
    ctx.fillStyle = rgb(sky.sun, 0.95);
    ctx.beginPath();
    ctx.arc(sx, sy, 22, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dica "↑ entrar" flutuando sobre a porta quando o jogador está em frente a ela
  drawDoorHint(ctx, game, t) {
    const x = game.igloo.doorX;
    const y = IGLOO.baseY - IGLOO.ry - 28 + Math.sin(t * 5) * 3;
    ctx.save();
    ctx.font = '700 15px system-ui, sans-serif';
    const label = '↑ entrar';
    const w = ctx.measureText(label).width + 22;
    ctx.fillStyle = 'rgba(6, 30, 45, 0.7)';
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - 16, w, 26, 13);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 6, y + 10);
    ctx.lineTo(x + 6, y + 10);
    ctx.lineTo(x, y + 17);
    ctx.fill();
    ctx.fillStyle = '#FFD36B';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y + 2);
    ctx.restore();
  }

  // Cortinas de luz ondulando: faixas verticais com gradiente, somadas com 'lighter'.
  drawAurora(ctx, t, strength) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const stripW = 6;
    for (const a of AURORA) {
      const g = ctx.createLinearGradient(0, 0, 0, a.h);
      g.addColorStop(0, `rgba(${a.top.join(',')}, 0)`);
      g.addColorStop(0.35, `rgba(${a.top.join(',')}, 0.16)`);
      g.addColorStop(0.8, `rgba(${a.bottom.join(',')}, 0.3)`);
      g.addColorStop(1, `rgba(${a.bottom.join(',')}, 0)`);
      ctx.fillStyle = g;
      for (let x = -10; x < W + 10; x += stripW) {
        const y = a.base + Math.sin(x * a.freq + t * a.speed + a.ph) * 22 + Math.sin(x * a.freq * 3.1 - t * a.speed * 2) * 7;
        // Brilho que corre ao longo da cortina
        const shimmer = 0.55 + 0.45 * Math.sin(x * 0.03 - t * 1.4 + a.ph);
        ctx.globalAlpha = strength * shimmer;
        ctx.save();
        ctx.translate(x, y);
        ctx.fillRect(0, 0, stripW + 1, a.h);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  drawWater(ctx, t, sky) {
    const top = WATER_TOP + 10;
    const g = ctx.createLinearGradient(0, top, 0, H);
    g.addColorStop(0, '#1C7E99');
    g.addColorStop(0.4, '#0E5670');
    g.addColorStop(1, '#052A40');
    ctx.fillStyle = g;
    ctx.fillRect(0, top, W, H - top);

    // Reflexo do céu perto da superfície
    const r = ctx.createLinearGradient(0, top, 0, top + 140);
    r.addColorStop(0, rgb(sky.hor, 0.35));
    r.addColorStop(1, rgb(sky.hor, 0));
    ctx.fillStyle = r;
    ctx.fillRect(0, top, W, 140);
    // Sombra do paredão de gelo na água
    ctx.fillStyle = 'rgba(3, 30, 48, 0.35)';
    ctx.fillRect(0, top, W, 6);

    // Ondulação
    ctx.save();
    ctx.lineCap = 'round';
    for (let j = 0, y = top + 10; y < H; j++, y += 12 + j * 0.9) {
      const depth = (y - top) / (H - top);
      ctx.strokeStyle = `rgba(190, 235, 250, ${0.2 * (1 - depth) + 0.04})`;
      ctx.lineWidth = 1.4;
      const dir = j % 2 ? 1 : -1;
      const len = 16 + (j % 3) * 12;
      ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        const x = mod(i * 167 + j * 61 + dir * t * (14 + j), W + 120) - 60;
        const yy = y + Math.sin(t * 1.6 + i + j) * 1.5;
        ctx.moveTo(x, yy);
        ctx.quadraticCurveTo(x + len / 2, yy - 1.5, x + len, yy);
      }
      ctx.stroke();
    }
    // Brilhos especulares
    ctx.fillStyle = '#FFFFFF';
    for (const s of this.glints) {
      const a = Math.max(0, Math.sin(t * s.sp + s.ph)) ** 6;
      if (a < 0.05) continue;
      ctx.globalAlpha = a * 0.8;
      ctx.fillRect(s.x - 3, s.y, 6, 1);
      ctx.fillRect(s.x - 0.5, s.y - 1.5, 1, 4);
    }
    ctx.restore();
  }

  drawEntities(ctx, game, t) {
    const p = game.player;
    const cold = p.alive ? clamp01((12 - game.temp) / 12) : 0;
    // De pé numa placa, o personagem sobe e desce junto com ela
    const ride = (p.state === 'stand' || p.state === 'freeze') && p.row >= 0 && p.support
      ? floeOffset(p.support, t) : 0;
    const outfits = game.special?.outfits || {};
    const drawP = () => drawPlayer(ctx, p, t, cold, ride, outfits.player);
    // O jogador é desenhado depois da última fileira que está "atrás" dele.
    let bucket = -1;
    game.rows.forEach((r, i) => { if (r.y <= p.y + 16) bucket = i; });
    if ((p.state === 'drown' || p.state === 'freeze') && p.row >= 0) bucket = Math.max(bucket, p.row);

    game.igloo.draw(ctx, t);
    if (game.special?.decor === 'natal' && game.igloo.complete) drawIglooLights(ctx, t);
    if (game.bear.active) drawBear(ctx, game.bear, t, outfits.bear);
    if (p.state !== 'gone' && bucket === -1) {
      drawP();
      // Passando pela porta: moldura do arco, sombra do interior e cortina por cima dele
      if (p.inDoorway) game.igloo.drawDoorFront(ctx, t);
    }
    if (game.atDoor) this.drawDoorHint(ctx, game, t);
    game.rows.forEach((row, i) => {
      this.drawRow(ctx, row, t);
      for (const c of game.critters.inRow(i)) {
        if (c.x > -60 && c.x < W + 60) CRITTER_DRAW[c.kind](ctx, c, row.y, t);
      }
      if (p.state !== 'gone' && bucket === i) drawP();
    });
  }

  drawRow(ctx, row, t) {
    const items = [];
    for (const r of row.rects()) {
      if (r.x > W + 20 || r.x + r.w < -20) continue;
      const y = row.y + floeOffset(r.piece, t);
      items.push({ x: r.x, y, w: r.w, s: floeSprite(r.piece, row.active) });
    }
    // Sombras, reflexos e brilho primeiro, para não cobrirem as placas vizinhas
    for (const it of items) {
      ctx.fillStyle = 'rgba(2, 28, 46, 0.32)';
      ctx.beginPath();
      ctx.ellipse(it.x + it.w / 2 + 4, it.y + 28, it.w / 2 + 6, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.globalAlpha = 0.14;
      ctx.translate(it.x - it.s.ox, it.y + 19);
      ctx.scale(1, -0.5);
      ctx.drawImage(it.s.canvas, 0, -(it.s.oy + 19), it.s.w, it.s.h);
      ctx.restore();
      if (row.active) {
        // Halo elíptico (gradiente radial achatado, sem bordas cortadas)
        const R = it.w * 0.8;
        ctx.save();
        ctx.translate(it.x + it.w / 2, it.y + 6);
        ctx.scale(1, 0.45);
        const g = ctx.createRadialGradient(0, 0, 4, 0, 0, R);
        g.addColorStop(0, `rgba(79, 195, 247, ${0.32 + Math.sin(t * 4) * 0.06})`);
        g.addColorStop(1, 'rgba(79, 195, 247, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, R, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    for (const it of items) ctx.drawImage(it.s.canvas, it.x - it.s.ox, it.y - it.s.oy, it.s.w, it.s.h);
  }
}
