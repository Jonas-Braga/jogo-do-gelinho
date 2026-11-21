// Profundidade 2.5D: tudo o que é desenhado no "mundo" passa por aqui.
//
// - Perspectiva: cada coisa é desenhada numa escala que depende da distância
//   (linha dos pés). A fileira da frente fica em escala 1; as de trás, e a costa,
//   encolhem em direção ao ponto de fuga no centro. A simulação NÃO muda: as
//   coordenadas do jogo continuam as mesmas, só o desenho é projetado.
// - Volume: personagens e bichos ganham luz da esquerda/alto (sol), luz de borda
//   no lado iluminado e sombra própria do lado oposto (rim light).
// - Sombras de contato, névoa atmosférica no horizonte, raio de sol na água,
//   vinheta e flocos desfocados na frente da câmera.
import { W, H, SHORE_Y, SHORE_TOP, WATER_TOP, ROW_Y, DEPTH } from './config.js';

const NEAR_Y = ROW_Y[ROW_Y.length - 1];
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// Escala de perspectiva para algo cujos pés estão na linha y
export function depthScale(y) {
  const k = clamp01((NEAR_Y - y) / (NEAR_Y - SHORE_Y));
  return 1 - (1 - DEPTH.farScale) * k;
}

// Inclinação do chão: vistas de cima, as placas do fundo mostram o topo achatado
// e as da frente, o topo mais aberto (escala só na vertical, em volta da linha dos pés)
export function floeTilt(y) {
  const k = clamp01((y - ROW_Y[0]) / (NEAR_Y - ROW_Y[0]));
  return DEPTH.tilt[0] + (DEPTH.tilt[1] - DEPTH.tilt[0]) * k;
}

// Posição na tela de um ponto do mundo (x) na profundidade y
export const projectX = (x, y) => DEPTH.vanishX + (x - DEPTH.vanishX) * depthScale(y);

// Intervalo do mundo (x) que aparece na tela numa profundidade (para descartar o que está fora)
export function visibleRange(y, pad = 20) {
  const s = depthScale(y);
  return [DEPTH.vanishX + (-pad - DEPTH.vanishX) / s, DEPTH.vanishX + (W + pad - DEPTH.vanishX) / s];
}

// Desenha fn() projetado na profundidade y (escala em volta do ponto de fuga, na linha y)
export function atDepth(ctx, y, fn) {
  const s = depthScale(y);
  if (s === 1) return fn();
  ctx.save();
  ctx.translate(DEPTH.vanishX, y);
  ctx.scale(s, s);
  ctx.translate(-DEPTH.vanishX, -y);
  const r = fn();
  ctx.restore();
  return r;
}

// ---------------------------------------------------------------- Volume
// O desenho vai para um buffer do tamanho da caixa do personagem (em pixels do
// dispositivo), recebe luz e sombra só onde há tinta (source-atop) e volta para a tela.
const pool = {};
function buffer(name, w, h) {
  let b = pool[name];
  if (!b) {
    const c = document.createElement('canvas');
    b = pool[name] = { c, g: c.getContext('2d') };
  }
  if (b.c.width < w || b.c.height < h) {
    b.c.width = Math.max(b.c.width, w);
    b.c.height = Math.max(b.c.height, h);
  }
  return b;
}

export const volume = { enabled: DEPTH.volume };

// box = [x0, y0, x1, y1] em coordenadas do mundo (antes da transformação atual)
export function withVolume(ctx, box, fn, light = DEPTH.light) {
  const m = volume.enabled && ctx.getTransform ? ctx.getTransform() : null;
  // Contexto falso (testes) ou desligado: desenha direto
  if (!m || typeof m.a !== 'number' || typeof document === 'undefined') return fn(ctx);
  const [x0, y0, x1, y1] = box;
  const dx0 = Math.floor(m.a * x0 + m.c * y0 + m.e);
  const dy0 = Math.floor(m.b * x0 + m.d * y0 + m.f);
  const dw = Math.ceil(m.a * (x1 - x0)) + 2;
  const dh = Math.ceil(m.d * (y1 - y0)) + 2;
  if (!(dw > 0 && dh > 0) || dw > 1400 || dh > 1400) return fn(ctx);

  const A = buffer('a', dw, dh);
  const B = buffer('b', dw, dh);
  const g = A.g;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, dw, dh);
  g.setTransform(m.a, m.b, m.c, m.d, m.e - dx0, m.f - dy0);
  g.save();
  fn(g);
  g.restore();
  g.setTransform(1, 0, 0, 1, 0, 0);

  const k = m.a; // pixels do dispositivo por unidade do mundo
  const d = Math.max(1, 2.6 * k);
  // Borda: silhueta menos a própria silhueta deslocada (para longe da luz = borda iluminada)
  const edge = (ox, oy, color, alpha, op) => {
    const h = B.g;
    h.setTransform(1, 0, 0, 1, 0, 0);
    h.globalCompositeOperation = 'source-over';
    h.globalAlpha = 1;
    h.clearRect(0, 0, dw, dh);
    h.drawImage(A.c, 0, 0, dw, dh, 0, 0, dw, dh);
    h.globalCompositeOperation = 'source-in';
    h.fillStyle = color;
    h.fillRect(0, 0, dw, dh);
    h.globalCompositeOperation = 'destination-out';
    h.drawImage(A.c, 0, 0, dw, dh, ox, oy, dw, dh);
    g.globalCompositeOperation = op;
    g.globalAlpha = alpha;
    g.drawImage(B.c, 0, 0, dw, dh, 0, 0, dw, dh);
  };

  // Sombreamento de corpo: claro do lado da luz, escuro do lado oposto
  const lx = light.x;
  const ly = light.y;
  const grd = g.createLinearGradient(dw * (0.5 - lx * 0.5), dh * (0.5 - ly * 0.5), dw * (0.5 + lx * 0.5), dh * (0.5 + ly * 0.5));
  grd.addColorStop(0, light.warm);
  grd.addColorStop(0.45, 'rgba(0,0,0,0)');
  grd.addColorStop(1, light.shade);
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = 1;
  g.fillStyle = grd;
  g.fillRect(0, 0, dw, dh);
  // Sombra própria nas bordas viradas para longe da luz e luz de borda no lado do sol
  edge(-d * lx * 1.8, -d * ly * 1.8, light.core, 0.5, 'source-atop');
  edge(d * lx, d * ly, light.rim, 0.9, 'source-atop');

  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(A.c, 0, 0, dw, dh, dx0, dy0, dw, dh);
  ctx.restore();
  return undefined;
}

// Sombra de contato no chão: encolhe e clareia com a altura
export function contactShadow(ctx, x, groundY, w, height = 0, alpha = 0.28) {
  const s = 1 - Math.min(height / 140, 0.65);
  const g = ctx.createRadialGradient(x, groundY, 0, x, groundY, w * s);
  g.addColorStop(0, `rgba(4, 18, 30, ${alpha * s})`);
  g.addColorStop(0.6, `rgba(4, 18, 30, ${alpha * s * 0.55})`);
  g.addColorStop(1, 'rgba(4, 18, 30, 0)');
  ctx.save();
  ctx.translate(x + DEPTH.shadowSkew * height * 0.25, groundY);
  ctx.scale(1, 0.24);
  ctx.translate(-x, -groundY);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, groundY, w * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- Atmosfera
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// Névoa do horizonte por cima do cenário distante (montanhas, morros)
export function drawHaze(ctx, hor, strength = 1) {
  if (strength <= 0) return;
  const g = ctx.createLinearGradient(0, 40, 0, SHORE_TOP + 30);
  g.addColorStop(0, rgba(hor, 0));
  g.addColorStop(0.6, rgba(hor, 0.07 * strength));
  g.addColorStop(0.92, rgba(hor, 0.16 * strength));
  g.addColorStop(1, rgba(hor, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 40, W, SHORE_TOP - 10);
}

// Água com profundidade: brilho do horizonte ao fundo e escurecimento na frente
export function drawWaterDepth(ctx, hor, glow = 1) {
  const top = WATER_TOP + 10;
  let g = ctx.createLinearGradient(0, top, 0, top + 70);
  g.addColorStop(0, rgba(hor, 0.28 * glow));
  g.addColorStop(1, rgba(hor, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, top, W, 70);
  g = ctx.createLinearGradient(0, H - 200, 0, H);
  g.addColorStop(0, 'rgba(0, 8, 18, 0)');
  g.addColorStop(1, 'rgba(0, 8, 18, 0.32)');
  ctx.fillStyle = g;
  ctx.fillRect(0, H - 200, W, 200);
}

// Caminho de luz do sol (ou da lua) na água: estreito ao fundo, largo na frente
export function drawSunPath(ctx, t, sx, color, strength = 1) {
  const top = WATER_TOP + 12;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 46; i++) {
    const k = i / 45;                    // 0 = horizonte, 1 = frente
    const y = top + k * k * (H - top);
    const s = depthScale(Math.min(NEAR_Y, y));
    const spread = 14 + k * 150;
    const x = sx + (DEPTH.vanishX - sx) * (1 - s) * 0.4 + Math.sin(i * 12.9898 + t * 1.8) * spread * 0.6;
    const len = (10 + k * 46) * (0.6 + 0.4 * Math.sin(i * 7.3 + t * 2.3));
    const a = strength * (0.5 - k * 0.32) * (0.55 + 0.45 * Math.sin(t * 3 + i * 1.7));
    if (a <= 0.02) continue;
    ctx.fillStyle = rgba(color, a);
    ctx.fillRect(x - len / 2, y, len, 1 + k * 1.6);
  }
  ctx.restore();
}

// Luz global: banho quente do lado do sol e sombra fria no lado oposto
export function drawLighting(ctx, lightX, warm, strength = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  const g = ctx.createRadialGradient(lightX, 40, 30, lightX, 40, W * 1.05);
  g.addColorStop(0, rgba(warm, 0.55 * strength));
  g.addColorStop(0.5, rgba(warm, 0.12 * strength));
  g.addColorStop(1, `rgba(10, 20, 50, ${0.45 * strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(-20, -20, W + 40, H + 40);
  ctx.restore();
}

export function drawVignette(ctx, strength = 1) {
  const g = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.42, W / 2, H * 0.5, W * 0.75);
  g.addColorStop(0, 'rgba(0, 6, 16, 0)');
  g.addColorStop(1, `rgba(0, 6, 16, ${0.5 * strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(-20, -20, W + 40, H + 40);
}

// Flocos (ou brasas) grandes e desfocados bem perto da câmera: passam mais rápido
export class Bokeh {
  constructor(n = 9) {
    this.items = Array.from({ length: n }, () => this.spawn(true));
  }

  spawn(anywhere) {
    return {
      x: Math.random() * W,
      y: anywhere ? Math.random() * H : -40,
      r: 7 + Math.random() * 12,
      vy: 70 + Math.random() * 60,
      vx: -18 + Math.random() * 10,
      ph: Math.random() * 6,
    };
  }

  update(dt, rising = false) {
    for (let i = 0; i < this.items.length; i++) {
      const b = this.items[i];
      b.ph += dt;
      b.x += (b.vx + Math.sin(b.ph * 0.9) * 22) * dt;
      b.y += (rising ? -0.6 : 1) * b.vy * dt;
      if (b.y > H + 40 || b.y < -50 || b.x < -50 || b.x > W + 50) {
        const n = this.spawn(false);
        if (rising) n.y = H + 40;
        n.x = Math.random() * (W + 80);
        this.items[i] = n;
      }
    }
  }

  draw(ctx, color, alpha = 0.22) {
    ctx.save();
    for (const b of this.items) {
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, rgba(color, alpha));
      g.addColorStop(0.55, rgba(color, alpha * 0.6));
      g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
    }
    ctx.restore();
  }
}
