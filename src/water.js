// Superfície do líquido em todas as fases (água, rio, mar, poeira estelar, rio
// assombrado e lava). Uma textura pequena e repetível é calculada uma vez por tipo, em
// vários quadros que fecham um ciclo: ondas sobrepostas (frequências inteiras, então a
// textura emenda nas bordas e o tempo dá a volta), iluminadas como água de verdade:
// faces viradas para a câmera mostram o fundo (escuras), faces inclinadas refletem o
// céu (claras, Fresnel) e as cristas viradas para o sol brilham. Ela é desenhada em
// faixas horizontais com perspectiva (ondas achatadas e pequenas ao fundo, grandes na
// frente) em dois passos: o relevo em "overlay" sobre o degradê do tema (as cores e o
// reflexo do céu do tema continuam valendo) e os brilhos somados por cima ("lighter").
// A lava usa outra receita: placas de crosta escura que andam devagar com as fendas
// incandescentes entre elas (o relevo dela escurece multiplicando: "overlay" não
// consegue escurecer o laranja da lava). A textura de cada cenário é gerada antes de a
// fase começar (`prepareSurface`, chamada pelo pré-carregamento das fases), então a água
// já nasce com a superfície. Sem canvas de verdade (testes no Node) não faz nada e fica
// só o degradê do tema (não há mais a ondulação antiga de traços).
import { W, H, WATER_TOP, DEPTH } from './config.js';

export const SURFACE = {
  tile: 128,
  frames: 48,
  bands: 34,
  // Por cenário: tipo, tempo do ciclo, escala da textura na frente, força do relevo,
  // cor e força dos brilhos, deriva (px/s na tela)
  // stretch: a textura é esticada na horizontal (ondas em faixas longas e finas);
  // reflect: força do reflexo do cenário na água (0 = sem reflexo, como na lava)
  kinds: {
    ice: { recipe: 'water', loop: 5, scale: 2, stretch: 3, relief: 0.5, glint: [255, 255, 255], spec: 0.35, drift: 5, reflect: 0.65 },
    forest: { recipe: 'water', loop: 5, scale: 2, stretch: 3, relief: 0.45, glint: [225, 245, 215], spec: 0.2, drift: 9, reflect: 0.6 },
    space: { recipe: 'water', loop: 6, scale: 2, stretch: 3, relief: 0.5, glint: [225, 205, 255], spec: 0.35, drift: 4, reflect: 0.55 },
    beach: { recipe: 'water', loop: 5, scale: 2, stretch: 3, relief: 0.5, glint: [255, 255, 245], spec: 0.4, drift: 6, reflect: 0.55 },
    halloween: { recipe: 'water', loop: 6, scale: 2, stretch: 3, relief: 0.5, glint: [215, 200, 255], spec: 0.25, drift: 4, reflect: 0.6 },
    dino: { recipe: 'lava', loop: 10, scale: 3.4, stretch: 1, relief: 1, glint: [255, 200, 100], spec: 0.35, drift: 3, reflect: 0 },
  },
  // Reflexo do cenário: comprimento (px abaixo da linha d'água) e achatamento do espelho
  mirror: { len: 220, squash: 0.7 },
};

// Ondas: [kx, ky, amplitude, ciclos por volta]. kx quase zero: cristas compridas e
// horizontais (água calma vista de longe); a textura ainda é esticada na horizontal
const WATER_WAVES = [
  [0, 3, 1, 1], [1, 4, 0.8, 1], [-1, 5, 0.6, 1], [1, 7, 0.45, 2], [-1, 9, 0.32, 2],
  [2, 11, 0.24, 2], [-2, 14, 0.16, 3], [1, 18, 0.1, 3], [-3, 23, 0.07, 4],
];
const LAVA_WAVES = [
  [1, 1, 1, 1], [-2, 1, 0.8, 1], [1, -3, 0.6, 1], [3, 2, 0.5, 1], [-3, 4, 0.35, 2], [5, -3, 0.25, 2], [-6, 5, 0.15, 2],
];

const hash = (i) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// Calcula os quadros (relevo e brilhos) de um tipo; devolve um gerador que faz um
// quadro por vez (para não travar o jogo)
function* bake(kind) {
  const N = SURFACE.tile;
  const F = SURFACE.frames;
  const cfg = SURFACE.kinds[kind];
  const lava = cfg.recipe === 'lava';
  const waves = lava ? LAVA_WAVES : WATER_WAVES;
  const n = N * N;
  // Fase espacial de cada onda em cada pixel (seno e cosseno), calculada uma vez
  const sinA = waves.map(() => new Float32Array(n));
  const cosA = waves.map(() => new Float32Array(n));
  waves.forEach(([kx, ky], w) => {
    const ph = hash(w + (lava ? 50 : 0)) * Math.PI * 2;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const a = (2 * Math.PI * (kx * x + ky * y)) / N + ph;
        sinA[w][y * N + x] = Math.sin(a);
        cosA[w][y * N + x] = Math.cos(a);
      }
    }
  });
  const sumAmp = waves.reduce((s, w) => s + w[2], 0);
  // Luz: câmera na frente e acima; sol baixo lá no fundo (brilho nas cristas)
  const el = 0.42;
  const V = [0, Math.sin(el), Math.cos(el)];
  const L = norm([-0.25, 0.35, -0.9]);
  const S = 5.5; // exagero das inclinações (as ondas são suaves em pixels)
  const fres = (c) => 0.02 + 0.98 * (1 - Math.max(0, c)) ** 5;
  const flat = fres(V[1]);
  const frames = [];
  for (let f = 0; f < F; f++) {
    const relief = new ImageData(N, N);
    const glow = new ImageData(N, N);
    const rd = relief.data;
    const gd = glow.data;
    const ct = waves.map((w) => Math.cos((2 * Math.PI * w[3] * f) / F));
    const st = waves.map((w) => Math.sin((2 * Math.PI * w[3] * f) / F));
    for (let i = 0; i < n; i++) {
      let h = 0;
      let hx = 0;
      let hy = 0;
      for (let w = 0; w < waves.length; w++) {
        // sen(A − ωt) e cos(A − ωt) com A pré-calculado
        const s = sinA[w][i] * ct[w] - cosA[w][i] * st[w];
        const c = cosA[w][i] * ct[w] + sinA[w][i] * st[w];
        const [kx, ky, a] = waves[w];
        h += a * s;
        hx += a * c * kx;
        hy += a * c * ky;
      }
      const k = i * 4;
      if (lava) {
        // Crosta: placas onde |h| é grande; fendas acesas onde h cruza o zero
        const r = Math.abs(h) / sumAmp;
        const seam = Math.max(0, 1 - r * 16) ** 1.5;
        const crust = Math.min(1, r * 6);
        // Relevo das placas (luz de cima à esquerda) para parecerem grossas
        const shade = (-hx * 0.6 - hy * 0.25) * 0.05;
        const g = Math.max(0, Math.min(255, 255 - crust * 175 + seam * 60 + shade * 200 * crust + (fbmLike(i) - 0.5) * 40 * crust));
        rd[k] = rd[k + 1] = rd[k + 2] = g;
        rd[k + 3] = 255;
        [gd[k], gd[k + 1], gd[k + 2]] = cfg.glint;
        // Brilho só no miolo das fendas (halo estreito: a lava não fica brilhando demais)
        gd[k + 3] = Math.min(255, seam ** 2.5 * 255);
      } else {
        const nx = (-hx * S * 2 * Math.PI) / N;
        const nz = (-hy * S * 2 * Math.PI) / N;
        const inv = 1 / Math.hypot(nx, 1, nz);
        const nv = [nx * inv, inv, nz * inv];
        const ndv = nv[0] * V[0] + nv[1] * V[1] + nv[2] * V[2];
        const F0 = fres(ndv);
        // Reflexo: quanto mais o raio refletido sobe para o céu, mais claro
        const R = [2 * ndv * nv[0] - V[0], 2 * ndv * nv[1] - V[1], 2 * ndv * nv[2] - V[2]];
        const up = Math.max(0, R[1]);
        const spec = Math.max(0, R[0] * L[0] + R[1] * L[1] + R[2] * L[2]) ** 220;
        const crest = h / sumAmp;
        // Suave: nada de estourar no preto ou no branco (senão vira mancha de borda dura)
        const g = 128 + Math.tanh(((F0 - flat) * 260 + (up - V[1]) * 30 + crest * 16) / 70) * 70;
        rd[k] = rd[k + 1] = rd[k + 2] = g;
        rd[k + 3] = 255;
        [gd[k], gd[k + 1], gd[k + 2]] = cfg.glint;
        gd[k + 3] = Math.min(255, spec * 320 + Math.max(0, crest - 0.5) * 220);
      }
    }
    frames.push({ relief: toCanvas(relief), glow: toCanvas(glow) });
    yield null;
  }
  return frames;
}

// Granulado da crosta (repetível: depende só do pixel da textura)
function fbmLike(i) {
  return (hash(i) + hash(i + 7919) + hash((i >> 2) + 31)) / 3;
}

function norm(v) {
  const l = Math.hypot(...v);
  return v.map((c) => c / l);
}

function toCanvas(img) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

// Estado de cada tipo: gerando (gen) ou pronto (frames + padrões)
const surfaces = {};
export const surfaceState = (kind) => (surfaces[kind]?.canvases ? 'ready' : surfaces[kind] ? 'baking' : 'none');

const canBake = () => typeof document !== 'undefined' && typeof DOMMatrix !== 'undefined';

// Gera alguns quadros da textura (até `ms` milissegundos); true quando está pronta
function bakeSome(kind, ms) {
  let s = surfaces[kind];
  if (!s) s = surfaces[kind] = { gen: bake(kind) };
  const t0 = performance.now();
  while (!s.canvases && performance.now() - t0 < ms) {
    const r = s.gen.next();
    if (r.done) s.canvases = r.value;
  }
  return !!s.canvases;
}

// Gera a textura de um cenário em segundo plano (aos poucos, sem travar o jogo)
export function prepareSurface(kind) {
  if (!canBake() || !SURFACE.kinds[kind] || surfaces[kind]?.canvases || surfaces[kind]?.timer) return;
  const step = () => {
    if (bakeSome(kind, 8)) {
      surfaces[kind].timer = null;
      return;
    }
    surfaces[kind].timer = setTimeout(step, 0);
  };
  surfaces[kind] = surfaces[kind] || { gen: bake(kind) };
  surfaces[kind].timer = setTimeout(step, 0);
}

// A textura do cenário está pronta? (sem canvas de verdade não há o que esperar)
export const surfaceReady = (kind) => !canBake() || !SURFACE.kinds[kind] || !!surfaces[kind]?.canvases;

function surfaceFor(ctx, kind) {
  // Só num canvas de verdade (um contexto falso de teste nunca gera nem guarda nada)
  if (!canBake() || !SURFACE.kinds[kind]) return null;
  if (!(ctx?.canvas?.width > 0) || typeof ctx.createPattern !== 'function') return null;
  // Se ainda não ficou pronta (fase aberta direto, sem pré-carregamento), termina aqui
  if (!bakeSome(kind, 6)) return null;
  const s = surfaces[kind];
  // Os padrões são criados para cada canvas que desenha (a textura fica guardada)
  s.patterns ||= new WeakMap();
  let frames = s.patterns.get(ctx);
  if (!frames) {
    frames = s.canvases.map((f) => ({ relief: ctx.createPattern(f.relief, 'repeat'), glow: ctx.createPattern(f.glow, 'repeat') }));
    if (!frames[0].relief?.setTransform) return null; // navegador sem padrão transformável
    s.patterns.set(ctx, frames);
  }
  return frames;
}

// Faixas da tela (do fundo para a frente), mais finas ao fundo
function bandsOf(top) {
  const n = SURFACE.bands;
  const out = [];
  for (let i = 0; i < n; i++) out.push(top + (H - top) * (i / n) ** 1.45);
  out.push(H);
  return out;
}

// Desenha a superfície; false se ainda não está pronta (ou sem canvas de verdade)
export function drawLiquidSurface(ctx, t, kind) {
  const frames = surfaceFor(ctx, kind);
  if (!frames) return false;
  const cfg = SURFACE.kinds[kind];
  const top = WATER_TOP + 10;
  const F = frames.length;
  const pos = ((t % cfg.loop) / cfg.loop) * F;
  const f0 = Math.floor(pos) % F;
  const f1 = (f0 + 1) % F;
  const mix = pos - Math.floor(pos);
  const ys = bandsOf(top);
  const N = SURFACE.tile;
  const vx = DEPTH.vanishX;
  ctx.save();
  let v = 0; // coordenada vertical da textura acumulada (perspectiva contínua)
  const layer = (pat, y0, y1, sx, sy, v0) => {
    pat.setTransform(new DOMMatrix().translateSelf(vx, y0).scaleSelf(sx, sy).translateSelf(-t * cfg.drift / sx, -v0));
    ctx.fillStyle = pat;
    ctx.fillRect(0, y0, W, y1 - y0);
  };
  for (let i = 0; i < ys.length - 1; i++) {
    const y0 = ys[i];
    const y1 = ys[i + 1];
    const k = ((y0 + y1) / 2 - top) / (H - top);
    // Perspectiva só na vertical (a superfície bem achatada ao fundo): a escala na
    // horizontal é a mesma em todas as faixas, então não há emendas entre elas
    const sx = cfg.scale * cfg.stretch;
    const sy = cfg.scale * (0.22 + 0.42 * k * k + 0.08 * k);
    // Overlay do relevo (com a passagem suave de um quadro para o outro)
    ctx.globalCompositeOperation = cfg.recipe === 'lava' ? 'multiply' : 'overlay';
    ctx.globalAlpha = cfg.relief * (0.75 + 0.25 * k);
    layer(frames[f0].relief, y0, y1, sx, sy, v);
    ctx.globalAlpha = cfg.relief * (0.75 + 0.25 * k) * mix;
    layer(frames[f1].relief, y0, y1, sx, sy, v);
    // Brilhos do sol: pontinhos raros, iguais do fundo à frente
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = cfg.spec;
    layer(frames[mix < 0.5 ? f0 : f1].glow, y0, y1, sx, sy, v);
    v += (y1 - y0) / sy;
    v %= N;
  }
  ctx.restore();
  return true;
}

// Reflexo do cenário na água: o que já está desenhado acima da linha d'água (céu,
// montanhas, a costa e o barranco) é copiado de cabeça para baixo logo abaixo dela,
// achatado, em tiras de 2 px deslocadas de lado por ondinhas (o reflexo "treme") e
// sumindo com a distância. Feito no próprio canvas (cópia dele mesmo). Sem canvas de
// verdade não faz nada.
// O cenário tem reflexo na água? (a lava não reflete)
export const reflects = (kind) => !!(typeof document !== 'undefined' && SURFACE.kinds[kind]?.reflect);

export function drawReflection(ctx, t, kind) {
  const cfg = SURFACE.kinds[kind];
  const c = ctx.canvas;
  if (!cfg?.reflect || !(c?.width > 0) || typeof document === 'undefined' || !ctx.getTransform) return false;
  const m = ctx.getTransform();
  if (!(m?.d > 0)) return false;
  const s = m.d;
  const line = (WATER_TOP + 10) * s + m.f; // linha d'água no canvas (pixels de verdade)
  const { len, squash } = SURFACE.mirror;
  const total = len * s;
  const step = Math.max(2, Math.round(s * 1.5));
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (let dy = 0; dy < total; dy += step) {
    const k = dy / total;
    const src = line - (dy + step) / squash;
    if (src < 0) break;
    const y = dy / s;
    // Ondinhas: o reflexo treme de lado, mais longe da linha mais solto
    const off = (Math.sin(y * 0.55 + t * 2.2) * (0.6 + k * 3) + Math.sin(y * 0.17 - t * 1.3) * k * 4) * s;
    // Tiras alternadas mais fracas: o reflexo aparece cortado pelas ondas
    const stripe = 0.7 + 0.3 * Math.sin(y * 1.9 + t * 3);
    ctx.globalAlpha = cfg.reflect * (1 - k) ** 1.6 * stripe;
    ctx.drawImage(c, 0, src, c.width, step / squash, off, line + dy, c.width, step);
  }
  ctx.restore();
  return true;
}
