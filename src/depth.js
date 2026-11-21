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

// ---------------------------------------------------------------- Câmera (parallax)
// A câmera acompanha o jogador de leve (camera.x, em px da frente). Cada camada anda
// conforme a distância: a fileira da frente anda tudo, a costa menos e o céu quase nada.
export const camera = { x: 0 };

// Quanto uma camada com escala de perspectiva s acompanha a câmera (0 a 1)
export function swayFactor(s) {
  const far = DEPTH.farScale;
  const k = clamp01((s - far) / (1 - far));
  return DEPTH.sway.shore + (1 - DEPTH.sway.shore) * k;
}

// Deslocamento na tela de quem tem os pés na linha y
export const swayAt = (y) => (camera.x ? -camera.x * swayFactor(depthScale(y)) : 0);

// Maior deslocamento possível (jogador encostado na borda)
export const maxSway = () => (W / 2) * DEPTH.sway.amount;

// Segue o jogador suavemente
export function followCamera(targetX, dt) {
  const target = (targetX - W / 2) * DEPTH.sway.amount;
  camera.x += (target - camera.x) * Math.min(1, dt * DEPTH.sway.ease);
  if (Math.abs(camera.x) < 0.01) camera.x = 0;
}

// Camada de fundo que anda f × câmera; esticada um pouco na horizontal para as bordas
// nunca aparecerem vazias
export function swayLayer(ctx, f, fn) {
  if (!camera.x) return fn();
  const pad = maxSway() * f + 2;
  ctx.save();
  ctx.translate(W / 2 - camera.x * f, 0);
  ctx.scale(1 + (2 * pad) / W, 1);
  ctx.translate(-W / 2, 0);
  const r = fn();
  ctx.restore();
  return r;
}

// Posição na tela de um ponto do mundo (x) na profundidade y
export const projectX = (x, y) => DEPTH.vanishX + (x - DEPTH.vanishX) * depthScale(y) + swayAt(y);

// Intervalo do mundo (x) que aparece na tela numa profundidade (para descartar o que está fora)
export function visibleRange(y, pad = 20) {
  const s = depthScale(y);
  const o = swayAt(y);
  return [DEPTH.vanishX + (-pad - o - DEPTH.vanishX) / s, DEPTH.vanishX + (W + pad - o - DEPTH.vanishX) / s];
}

// Desenha fn() projetado na profundidade y (escala em volta do ponto de fuga, na linha y)
export function atDepth(ctx, y, fn) {
  const s = depthScale(y);
  const o = swayAt(y);
  if (s === 1 && !o) return fn();
  ctx.save();
  ctx.translate(DEPTH.vanishX + o, y);
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

// relief: o relevo pode ser desligado sozinho (fps baixo) sem desligar o resto do volume
export const volume = { enabled: DEPTH.volume, relief: true };

// Cor (r, g, b) da luz da cena: o renderizador troca conforme o cenário (sol, lua, lava...)
export const sceneLight = { key: [255, 244, 226], shade: [60, 80, 130], strength: 1 };

function reset(b, w, h, fill) {
  const x = b.g;
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalAlpha = 1;
  x.globalCompositeOperation = 'source-over';
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  if (fill) {
    x.fillStyle = fill;
    x.fillRect(0, 0, w + 2, h + 2);
  } else x.clearRect(0, 0, w + 2, h + 2);
  return x;
}

// Inclinação para um lado: max(0, H(p − o) − H(p)), só com modos de mistura do canvas
// (branco − H deslocado, + H, e inverte), com o contraste aumentado em seguida.
function slope(b, H, w, h, ox, oy, gain) {
  const x = reset(b, w, h, '#fff');
  x.globalCompositeOperation = 'difference';
  x.drawImage(H.c, 0, 0, w, h, ox, oy, w, h);
  x.globalCompositeOperation = 'lighter';
  x.drawImage(H.c, 0, 0, w, h, 0, 0, w, h);
  x.globalCompositeOperation = 'difference';
  x.fillStyle = '#fff';
  x.fillRect(0, 0, w, h);
  x.globalCompositeOperation = 'lighter';
  for (let i = 1; i < gain; i++) x.drawImage(b.c, 0, 0, w, h, 0, 0, w, h);
  return x;
}

// Desenha a imagem src desfocada (raio r em px): filtro do canvas quando existe,
// senão reduz e amplia de volta (Safari antigo)
const canFilter = typeof document !== 'undefined'
  && typeof document.createElement('canvas').getContext('2d')?.filter === 'string';
function blurInto(x, src, w, h, r) {
  if (canFilter) {
    x.filter = `blur(${r.toFixed(1)}px)`;
    x.drawImage(src.c, 0, 0, w, h, 0, 0, w, h);
    x.filter = 'none';
    return;
  }
  const f = Math.max(2, r);
  const sw = Math.max(2, Math.ceil(w / f));
  const sh = Math.max(2, Math.ceil(h / f));
  const T = buffer('t', sw + 2, sh + 2);
  reset(T, sw, sh).drawImage(src.c, 0, 0, w, h, 0, 0, sw, sh);
  x.drawImage(T.c, 0, 0, sw, sh, 0, 0, w, h);
}

// Ilumina o sprite do buffer A como se fosse um modelo 3D renderizado: a silhueta
// desfocada é o mapa de altura; o lado que sobe em direção à luz acende (com brilho
// especular no miolo) e o oposto escurece. Os mapas são suaves: ficam em resolução
// reduzida (DEPTH.relief.res), guardados por personagem (key) e refeitos só a cada
// DEPTH.relief.every quadros; aplicar custa 4 operações por quadro.
const reliefCache = new WeakMap();

function makeMap(w, h) {
  const c = document.createElement('canvas');
  c.width = w + 2;
  c.height = h + 2;
  return { c, g: c.getContext('2d') };
}

function buildRelief(ent, A, w, h, k, light) {
  const R = DEPTH.relief;
  const L = sceneLight;
  const q = R.res;
  const { lw, lh } = ent;
  // Silhueta branca (reduzida)
  const S = buffer('s', lw + 2, lh + 2);
  const s = reset(S, lw, lh);
  s.drawImage(A.c, 0, 0, w, h, 0, 0, lw, lh);
  s.globalCompositeOperation = 'source-in';
  s.fillStyle = '#fff';
  s.fillRect(0, 0, lw, lh);
  // Altura = média da silhueta desfocada em várias escalas (detalhes e corpo)
  const H = buffer('h', lw + 2, lh + 2);
  const hg = reset(H, lw, lh, '#000');
  hg.globalCompositeOperation = 'lighter';
  hg.globalAlpha = 1 / R.blur.length;
  for (const b of R.blur) blurInto(hg, S, lw, lh, Math.max(0.8, b * k * q));
  hg.globalAlpha = 1;

  const d = R.shift * k * q;
  const dx = light.x * d;
  const dy = light.y * d;
  // Lado virado para a luz: a altura cresce no sentido em que a luz viaja
  const lit = slope(ent.P, H, lw, lh, -dx, -dy, R.gain);
  const shade = slope(ent.D, H, lw, lh, dx, dy, R.gain);

  // Brilho especular: a luz elevada ao cubo (só o miolo do lado aceso)
  const Q = buffer('q', lw + 2, lh + 2);
  const sq = reset(Q, lw, lh);
  sq.drawImage(ent.P.c, 0, 0, lw, lh, 0, 0, lw, lh);
  sq.globalCompositeOperation = 'multiply';
  sq.drawImage(ent.P.c, 0, 0, lw, lh, 0, 0, lw, lh);
  sq.drawImage(ent.P.c, 0, 0, lw, lh, 0, 0, lw, lh);

  // Luz = difusa na cor da luz da cena + especular (já com as forças)
  lit.globalCompositeOperation = 'multiply';
  lit.fillStyle = `rgb(${L.key.map((v) => Math.round(v * Math.min(1, R.light * L.strength))).join(',')})`;
  lit.fillRect(0, 0, lw, lh);
  lit.globalCompositeOperation = 'lighter';
  lit.globalAlpha = Math.min(1, R.spec * L.strength);
  lit.drawImage(Q.c, 0, 0, lw, lh, 0, 0, lw, lh);
  lit.globalAlpha = 1;

  // Sombra: 1 − força × inclinação × (1 − cor da sombra)
  shade.globalCompositeOperation = 'multiply';
  shade.fillStyle = `rgb(${255 - L.shade[0]},${255 - L.shade[1]},${255 - L.shade[2]})`;
  shade.fillRect(0, 0, lw, lh);
  shade.globalCompositeOperation = 'difference';
  shade.fillStyle = '#fff';
  shade.fillRect(0, 0, lw, lh);
  shade.globalCompositeOperation = 'source-over';
  shade.globalAlpha = 1 - Math.min(1, R.shade * L.strength);
  shade.fillRect(0, 0, lw, lh);
  shade.globalAlpha = 1;
}

function relief(A, B, w, h, k, light, key) {
  const R = DEPTH.relief;
  const lw = Math.max(2, Math.ceil(w * R.res));
  const lh = Math.max(2, Math.ceil(h * R.res));
  let ent = key ? reliefCache.get(key) : null;
  if (!ent || ent.lw !== lw || ent.lh !== lh) {
    ent = { lw, lh, P: makeMap(lw, lh), D: makeMap(lw, lh), age: Infinity };
    if (key) reliefCache.set(key, ent);
  }
  // Refaz os mapas de tempos em tempos (cada personagem num quadro diferente)
  if (ent.age >= R.every) {
    buildRelief(ent, A, w, h, k, light);
    ent.age = 1;
  } else ent.age++;

  // Guarda a silhueta original, aplica sombra e luz e recorta de volta pela silhueta
  const b = reset(B, w, h);
  b.drawImage(A.c, 0, 0, w, h, 0, 0, w, h);
  const g = A.g;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.imageSmoothingEnabled = true;
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'multiply';
  g.drawImage(ent.D.c, 0, 0, lw, lh, 0, 0, w, h);
  g.globalCompositeOperation = 'lighter';
  g.drawImage(ent.P.c, 0, 0, lw, lh, 0, 0, w, h);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(B.c, 0, 0, w, h, 0, 0, w, h);
  g.globalCompositeOperation = 'source-over';
}

// opts.relief = false: sem o relevo (construções, que já têm sombreamento próprio)
export function withVolume(ctx, box, fn, light = DEPTH.light, opts = {}) {
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

  // Relevo: luz difusa, brilho especular e sombra pela inclinação da superfície
  if (DEPTH.relief && volume.relief && opts.relief !== false) relief(A, B, dw, dh, k, light, opts.key);

  // Sombreamento de corpo: claro do lado da luz, escuro do lado oposto
  const lx = light.x;
  const ly = light.y;
  const grd = g.createLinearGradient(dw * (0.5 - lx * 0.5), dh * (0.5 - ly * 0.5), dw * (0.5 + lx * 0.5), dh * (0.5 + ly * 0.5));
  grd.addColorStop(0, light.warm);
  grd.addColorStop(0.45, 'rgba(0,0,0,0)');
  grd.addColorStop(1, light.shade);
  g.globalCompositeOperation = 'source-atop';
  const rel = DEPTH.relief && volume.relief && opts.relief !== false;
  g.globalAlpha = 1;
  g.fillStyle = grd;
  g.fillRect(0, 0, dw, dh);
  // Sombra própria nas bordas viradas para longe da luz e luz de borda no lado do sol
  edge(-d * lx * 1.8, -d * ly * 1.8, light.core, rel ? 0.45 : 0.5, 'source-atop');
  edge(d * lx, d * ly, light.rim, rel ? 0.7 : 0.9, 'source-atop');

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

// ---------------------------------------------------------------- Primeiro plano
// Faixa desfocada bem perto da câmera, na beira de baixo da tela (montinhos de neve,
// capim, samambaias, pedras...). Anda mais que a fileira da frente quando a câmera
// se move (parallax) e fica baixa para não esconder as placas.
const FG_BLUR = 3.5;  // desfoque (px)
const FG_H = 96;      // altura da faixa (px da tela)
const FG_KINDS = {
  ice: { base: [196, 226, 240], tip: [236, 248, 255], shape: 'mound' },
  forest: { base: [22, 52, 26], tip: [58, 98, 40], shape: 'blades' },
  beach: { base: [214, 184, 128], tip: [40, 110, 60], shape: 'fronds' },
  halloween: { base: [26, 16, 38], tip: [52, 34, 66], shape: 'blades' },
  dino: { base: [34, 44, 20], tip: [70, 96, 34], shape: 'fronds' },
  space: { base: [70, 66, 84], tip: [120, 116, 136], shape: 'rocks' },
};

export function foregroundKind(scenery) {
  return FG_KINDS[scenery] ? scenery : 'ice';
}

function buildForeground(kind) {
  const spec = FG_KINDS[kind];
  const pad = maxSway() * DEPTH.sway.fore + 8;
  const w = Math.ceil(W + pad * 2);
  const h = FG_H;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const col = (a, k = 1) => `rgba(${a.map((v) => Math.round(v * k)).join(',')},1)`;
  const W2 = W + pad * 2;
  // Altura da faixa: só nas pontas ela sobe (o meio fica quase livre)
  const tall = (x) => {
    const e = Math.min(x, W2 - x) / W2;
    return e < 0.16 ? 1 - e / 0.16 : 0;
  };
  for (let x = -20; x < W2 + 20; x += 14 + rnd() * 22) {
    const k = tall(x);
    const top = FG_H - 10 - k * 52 - rnd() * 10;
    const shade = 0.75 + rnd() * 0.35;
    if (spec.shape === 'mound' || spec.shape === 'rocks') {
      const r = 16 + k * 30 + rnd() * 14;
      const gr = g.createLinearGradient(0, top, 0, FG_H);
      gr.addColorStop(0, col(spec.tip, shade));
      gr.addColorStop(1, col(spec.base, shade * 0.8));
      g.fillStyle = gr;
      g.beginPath();
      if (spec.shape === 'rocks') {
        g.moveTo(x - r, FG_H + 4);
        g.lineTo(x - r * 0.7, top + r * 0.4);
        g.lineTo(x - r * 0.1, top);
        g.lineTo(x + r * 0.6, top + r * 0.3);
        g.lineTo(x + r, FG_H + 4);
      } else g.ellipse(x, top + r, r * 1.5, r, 0, Math.PI, 0);
      g.fill();
      if (spec.shape === 'mound') g.fillRect(x - r * 1.5, top + r - 1, r * 3, FG_H);
    } else {
      // Folhas/capim: lâminas curvas saindo de baixo
      const n = 2 + Math.round(k * 4);
      for (let i = 0; i < n; i++) {
        const bx = x + (rnd() - 0.5) * 20;
        const len = 18 + k * 56 + rnd() * 14;
        const lean = (rnd() - 0.5) * 2 * (spec.shape === 'fronds' ? 50 : 22);
        g.strokeStyle = col(i % 2 ? spec.tip : spec.base, shade);
        g.lineWidth = spec.shape === 'fronds' ? 7 : 4;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(bx, FG_H + 4);
        g.quadraticCurveTo(bx + lean * 0.2, FG_H - len * 0.7, bx + lean, FG_H - len);
        g.stroke();
      }
      if (spec.shape === 'fronds') {
        g.fillStyle = col(spec.base, shade * 0.9);
        g.fillRect(x - 12, FG_H - 8, 30, 12);
      }
    }
  }
  return { canvas: blurred(c, w, h), pad };
}

// Desfoque: filtro do canvas quando existe; senão reduz e amplia em dois passos
function blurred(src, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (typeof g.filter === 'string') {
    g.filter = `blur(${FG_BLUR}px)`;
    g.drawImage(src, 0, 0);
    if (g.filter !== 'none') return c;
    g.clearRect(0, 0, w, h);
  }
  const m = document.createElement('canvas');
  m.width = Math.ceil(w / 2);
  m.height = Math.ceil(h / 2);
  const s = document.createElement('canvas');
  s.width = Math.ceil(w / 4);
  s.height = Math.ceil(h / 4);
  m.getContext('2d').drawImage(src, 0, 0, m.width, m.height);
  s.getContext('2d').drawImage(m, 0, 0, s.width, s.height);
  m.getContext('2d').clearRect(0, 0, m.width, m.height);
  m.getContext('2d').drawImage(s, 0, 0, m.width, m.height);
  g.drawImage(m, 0, 0, w, h);
  return c;
}

export class Foreground {
  constructor() {
    this.cache = {};
  }

  draw(ctx, kind, alpha = 1) {
    if (typeof document === 'undefined') return;
    const fg = (this.cache[kind] ||= buildForeground(kind));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(fg.canvas, -fg.pad - camera.x * DEPTH.sway.fore, H - FG_H, W + fg.pad * 2, FG_H);
    ctx.restore();
  }
}
