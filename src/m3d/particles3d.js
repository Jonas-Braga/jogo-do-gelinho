// Partículas 3D ao vivo (etapa 3 da cena toda em 3D): neve, folhas, poeira estelar,
// brasas, flocos desfocados perto da câmera, fumaça (chaminé, vulcão, respiração e a
// poeira do encaixe dos blocos), vagalumes e as chamas das tochas. Tudo desenhado a cada
// quadro por um shader do Three.js numa camada WebGL própria (quadradinhos instanciados,
// um por partícula), colada no canvas do jogo no lugar do desenho 2D:
// - floco de neve: esfera com luz do sol de um lado e sombra do outro, brilho; perto da
//   câmera fica grande e desfocado (o "bokeh" de antes, agora com a mesma luz)
// - folha: lâmina que gira no ar e vira de lado (encurta, mostra o verso mais claro),
//   com a dobra da nervura, luz do sol e a luz passando por ela em contraluz
// - fumaça: bolota de volume com turbulência que se mexe, iluminada pelo sol do lado
//   dele (no vulcão, acesa por baixo pela lava)
// - brasa e poeira estelar: brilho que soma luz (núcleo quente, cintilando)
// - chama: fogo de ruído subindo e se torcendo, núcleo amarelo, bordas laranja e halo
// Quem decide o que desenhar são as funções puras daqui (`weatherItems`, `smokeItems`,
// `volcanoItems`, `fireflyItems`): elas recebem `push` e funcionam também no Node.
import { W, H, SHORE_TOP, WATER_TOP, DEPTH } from '../config.js';
import { depthScale, swayAt, camera } from '../depth.js';
import { PRINT_COLORS, printAlpha } from '../particles.js';

export const PARTICLES3D = {
  pad: 64,          // a camada passa um pouco das bordas (a câmera balança)
  maxWidth: 1700,
  quality: 0.75,
  max: 900,         // partículas por passada
  flameCell: [64, 128], // célula de cada chama no atlas (px de verdade)
  flameSlots: 4,    // chamas diferentes por quadro (cada tocha usa uma)
};

// Tipos (o shader escolhe o desenho por eles)
export const P3 = { snow: 0, leaf: 1, ember: 2, dust: 3, smoke: 4, glow: 5, flame: 6, ring: 7, shard: 8, bubble: 9, text: 10, print: 11, beam: 12, cord: 13, cone: 14, ice: 15 };

// Cores (as mesmas do 2D)
export const LEAF_COLORS = ['#D9822B', '#C4462A', '#E3B23C', '#7FA33A', '#A65A2A'];
export const DUST_COLORS = ['#FFFFFF', '#CFC2FF', '#9FF3FF', '#FFE6A0'];
export const EMBER_COLORS = ['#FFD25A', '#FF9A3A'];
// Fumaça da chaminé de cada casa (vapor branco na base lunar)
export const SMOKE_COLORS = {
  igloo: '#9AAAB5', cabin: '#8E8A86', base: '#E8EEF5', hut: '#A49C92', haunted: '#7A6E86', cave: '#6A5E5A',
};
// Vulcões (os mesmos do 2D, em src/dino.js; repetidos aqui para o módulo não depender
// do desenho 2D)
const VOLCANOES = [{ x: 560, h: 150 }, { x: 880, h: 104 }];

export function rgba01(c, a = 1) {
  if (Array.isArray(c)) return [c[0] / 255, c[1] / 255, c[2] / 255, a];
  const n = parseInt(String(c).replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a];
}

// Posição na tela de quem está na linha y (mesma perspectiva das placas e bichos)
function project(x, y) {
  const s = depthScale(y);
  return { x: DEPTH.vanishX + swayAt(y) + (x - DEPTH.vanishX) * s, s };
}

// ---------------------------------------------------------------- O que desenhar
// push(kind, x, y, meiaLargura, meiaAltura, giro, [r, g, b, a], fase, desfoque, extra)

// Clima: neve, folhas, poeira estelar ou brasas (as partículas simuladas do jogo, em
// coordenadas da tela) e os flocos/brasas grandes desfocados perto da câmera
export function weatherItems(push, parts, bokeh, t) {
  if (!parts || parts.calm) return;
  const flakes = parts.snow || [];
  if (parts.leaves) {
    flakes.forEach((s, i) => {
      const len = (1.6 + s.r * 1.3) * 1.35;
      // Gira no plano e vira de lado (o verso aparece quando flip < 0)
      const flip = Math.sin(t * 2.2 + i * 1.3);
      const hh = len * 0.62 * Math.max(0.14, Math.abs(flip));
      push(P3.leaf, s.x, s.y, len, hh, s.sway * 1.7 + i, rgba01(LEAF_COLORS[i % LEAF_COLORS.length], 0.92), i, 0, flip);
    });
    return;
  }
  if (parts.stardust) {
    flakes.forEach((s, i) => {
      const r = (0.5 + s.r * 0.55) * 3.2;
      push(P3.dust, s.x, s.y, r, r, 0, rgba01(DUST_COLORS[i % DUST_COLORS.length], 0.9), i * 1.7, 0, 0);
    });
    return;
  }
  if (parts.embers) {
    flakes.forEach((s, i) => {
      const r = 0.6 + s.r * 0.5;
      const x = s.x + Math.sin(t * 1.5 + i) * 4;
      // Riscadinho na direção em que sobe (de pé, balançando de leve)
      push(P3.ember, x, H - s.y, r * 1.6, r * 3.6, Math.cos(t * 1.5 + i) * 0.25, rgba01(EMBER_COLORS[i % 3 ? 1 : 0], 0.95), i * 2.3, 0, 0);
    });
  } else {
    flakes.forEach((s, i) => {
      const r = s.r * 1.25;
      // Os maiores estão mais perto da câmera: um pouco desfocados
      const blur = Math.max(0, Math.min(1, (s.r - 2.2) / 1.2)) * 0.45;
      push(P3.snow, s.x, s.y, r, r, 0, [1, 1, 1, Math.min(1, 0.55 + s.r * 0.16)], i, blur, 0);
    });
  }
  for (const b of bokeh || []) {
    if (parts.embers) push(P3.ember, b.x, b.y, b.r * 0.9, b.r * 1.3, 0, rgba01('#FF9A3C', 0.32), b.ph, 1, 0);
    else push(P3.snow, b.x, b.y, b.r, b.r, 0, [1, 1, 1, 0.3], b.ph, 1, 0);
  }
}

// Fumaça e vapor (chaminé, respiração) e a nuvenzinha do encaixe dos blocos, na
// perspectiva da linha onde estão (como no 2D)
export function smokeItems(push, parts, t, color = SMOKE_COLORS.igloo) {
  if (!parts) return;
  const smoke = rgba01(color);
  for (const f of parts.fx || []) {
    if (f.t < 0) continue;
    const k = f.t / f.life;
    if (f.kind === 'smoke') {
      const p = project(f.x + Math.sin(f.t * 2.5) * 4, f.y);
      const r = f.r * (1 + k * 2.5) * p.s * 1.6;
      const a = 0.75 * (1 - k) * Math.min(1, f.t * 4);
      push(P3.smoke, p.x, f.y, r, r, f.t * 0.3, [smoke[0], smoke[1], smoke[2], a], f.x * 0.37 + f.life * 3.1, 0, 0);
    } else if (f.kind === 'vapor') {
      const p = project(f.x, f.y);
      const r = f.r * (1 + k * 1.8) * p.s * 1.5;
      push(P3.smoke, p.x, f.y, r, r, 0, [1, 1, 1, 0.5 * (1 - k)], f.x * 0.21 + f.y * 0.13, 0, 0);
    }
  }
  for (const pf of parts.puffs || []) {
    const k = pf.t / pf.life;
    const p = project(pf.x, pf.y);
    const r = pf.r * (1 + k) * p.s * 1.7;
    const c = rgba01(pf.color || '#FFFFFF');
    push(P3.smoke, p.x, pf.y, r, r, 0, [c[0], c[1], c[2], 0.9 * (1 - k)], pf.vx * 0.05 + pf.life * 7, 0, 0);
  }
}

// Vulcões: brilho da cratera, rolos de fumaça acesos por baixo pela lava e as gotas de
// lava que o maior cospe (mesmos tempos e caminhos do 2D)
export function volcanoItems(push, t) {
  for (const [vi, v] of VOLCANOES.entries()) {
    const top = SHORE_TOP + 6 - v.h;
    const k = 0.35 + Math.sin(t * 2 + vi) * 0.12;
    push(P3.glow, v.x, top, 40, 40, 0, rgba01([255, 130, 50], k), vi, 0, 1);
    const n = 12;
    const life = 6 + vi * 2;
    for (let i = 0; i < n; i++) {
      const a = ((t + i * (life / n)) % life) / life;
      const x = v.x + a * 70 + Math.sin(t * 0.7 + i) * 6;
      const y = top - 6 - a * 110;
      const r = (8 + a * 30) * (vi ? 0.75 : 1) * 1.6;
      const alpha = 0.85 * (1 - a) * Math.min(1, a * 6);
      const c = rgba01(i % 2 ? '#5A4A50' : '#6E5E62', alpha);
      push(P3.smoke, x, y, r, r, a * 1.5 + i, c, i * 1.31 + vi * 5, 0, Math.max(0, 1 - a * 2.2));
    }
  }
  const v = VOLCANOES[0];
  const top = SHORE_TOP + 6 - v.h;
  const k = (t % 7) / 1.6;
  if (k < 1) {
    for (let i = 0; i < 6; i++) {
      const vx = (i - 2.5) * 16;
      const x = v.x + vx * k * 1.6;
      const y = top - 70 * k + 90 * k * k;
      const r = 2.6 - k;
      // Riscadinho na direção em que voa
      const ang = Math.atan2(vx * 1.6, -(-70 + 180 * k));
      push(P3.ember, x, y, r * 1.5, r * 3, -ang, rgba01('#FF8A2A', 1 - k * 0.6), i, 0, 0);
    }
  }
}

// Vagalumes piscando perto da mata quando o céu escurece (mesmo caminho do 2D)
export function fireflyItems(push, t, dusk) {
  if (dusk < 0.25) return;
  for (let i = 0; i < 14; i++) {
    const x = (i * 97 + Math.sin(t * 0.4 + i) * 40 + W) % W;
    const y = SHORE_TOP - 20 + Math.sin(t * 0.7 + i * 2) * 18 + (i % 4) * 8;
    const a = Math.max(0, Math.sin(t * 2 + i * 1.7)) * Math.min(1, (dusk - 0.25) * 2);
    if (a < 0.05) continue;
    push(P3.glow, x, y, 9, 9, 0, rgba01([230, 255, 140], a), i, 0, 1);
  }
}

// Efeitos pequenos no chão e na água (atrás dos personagens): pegadas na costa, anéis na
// água e, na lava, as bolhas que incham e estouram (mesmos tempos e lugares do 2D)
export function groundItems(push, parts, t, scenery = 'ice') {
  if (!parts) return;
  const pc = PRINT_COLORS[scenery] || PRINT_COLORS.ice;
  const printC = [pc[0] / 255, pc[1] / 255, pc[2] / 255];
  for (const pr of parts.prints || []) {
    const p = project(pr.x, pr.y);
    push(P3.print, p.x, pr.y, 7 * p.s, 2.8 * p.s, 0, [printC[0], printC[1], printC[2], printAlpha(pr.t)], pr.side, 0, pr.dir);
  }
  const rc = parts.liquid?.ripple || [207, 239, 250];
  for (const r of parts.ripples || []) {
    if (r.t < 0) continue;
    const k = r.t;
    const sc = r.s || 1;
    const p = project(r.x, r.y);
    push(P3.ring, p.x, r.y, (10 + k * 60) * sc * p.s, (3 + k * 12) * sc * p.s, 0, rgba01(rc, 0.75 * (1 - k)), k, 0, 0);
  }
  if (parts.liquid && scenery === 'dino') lavaBubbleItems(push, t);
}

// Bolhas de lava inchando e estourando (as mesmas de drawLavaBubbles, src/dino.js),
// na camada da água
export function lavaBubbleItems(push, t) {
  const shift = -(camera.x || 0) * ((DEPTH.sway.shore + 1) / 2);
  for (let i = 0; i < 16; i++) {
    const period = 2.2 + (i % 5) * 0.4;
    const k = ((t + i * 0.73) % period) / period;
    if (k > 0.5) continue;
    const slot = Math.floor((t + i * 0.73) / period);
    const x = ((i * 211 + slot * 397) % (W - 40)) + 20 + shift;
    const y = WATER_TOP + 40 + ((i * 53 + slot * 31) % (H - WATER_TOP - 60));
    const u = k / 0.5;
    if (u < 0.8) {
      const r = 2 + u * 6;
      // Cúpula de lava acesa (meia esfera saindo da superfície)
      push(P3.snow, x, y - r * 0.4, r, r, 0, rgba01([255, 170, 70], 0.95), i, 0, 0.8);
    } else {
      const pp = (u - 0.8) / 0.2;
      push(P3.ring, x, y, 8 + pp * 8, 2 + pp * 2, 0, rgba01([255, 210, 110], 1 - pp), pp, 0, 0);
      for (const sd of [-1, 1]) push(P3.snow, x + sd * (4 + pp * 8), y - 6 - pp * 6 + pp * pp * 8, 1.4, 1.4, 0, rgba01([255, 170, 60], 1 - pp), i, 0, 0.9);
    }
  }
}

// Efeitos por cima dos personagens: lascas de gelo, brilhos da fileira, bolhas de quem
// afunda e as gotas dos respingos (cada um na perspectiva da linha onde está)
export function fxItems(push, parts) {
  if (!parts) return;
  const bub = parts.liquid?.bubble;
  for (const f of parts.fx || []) {
    if (f.t < 0) continue;
    const k = f.t / f.life;
    if (f.kind === 'chip') {
      const p = project(f.x, f.y);
      push(P3.shard, p.x, f.y, f.r * 1.6 * p.s, f.r * 1.1 * p.s, f.rot, rgba01(f.color || '#E8F7FC', 1 - k), f.rot, 0, 0);
    } else if (f.kind === 'spark') {
      const p = project(f.x, f.y);
      const tw = 0.6 + 0.4 * Math.sin(f.t * 25 + f.ph);
      const r = f.r * (1 - k * 0.5) * 2.6 * p.s;
      push(P3.dust, p.x, f.y, r, r, 0, rgba01(f.color, (1 - k) * tw), f.ph, 0, 0);
    } else if (f.kind === 'bubble') {
      const p = project(f.x, f.y);
      push(P3.bubble, p.x, f.y, f.r * 1.2 * p.s, f.r * 1.2 * p.s, 0, bub ? [1, 0.7, 0.35, 0.85] : [0.86, 0.96, 1, 0.85], f.ph, 0, 0);
    }
  }
  const dc = rgba01(parts.liquid?.splash || '#CFEFFA');
  for (const d of parts.drops || []) {
    const fl = d.floor ?? d.y;
    const p = project(d.x, fl);
    const r = d.r * p.s * 1.15;
    push(P3.snow, p.x, d.y, r, r, 0, [dc[0], dc[1], dc[2], 1 - d.t / d.life], 0, 0, parts.liquid ? 0.6 : 0.15);
  }
}

// Textos de pontos ("+200", "+1 VIDA"...) em relevo: glyph(str) devolve o retângulo do
// texto no atlas da camada ({ uv: [u0, v0, u1, v1], w, h } em px do atlas)
export const TEXT = { atlasFont: 34, screenFont: 22 };
export function textItems(push, parts, glyph) {
  if (!parts || !glyph) return;
  for (const tx of parts.texts || []) {
    const k = tx.t / 1.1;
    const a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    const sc = (tx.t < 0.12 ? 0.6 + (tx.t / 0.12) * 0.4 : 1) * (TEXT.screenFont / TEXT.atlasFont);
    const g = glyph(tx.str);
    if (!g) continue;
    const p = project(tx.x, tx.y);
    push(P3.text, p.x, tx.y - g.h * sc * 0.3, (g.w * sc) / 2, (g.h * sc) / 2, 0, rgba01(tx.color || '#FFFFFF', a), 0, 0, 0, g.uv);
  }
}

// Luzes registradas pelos desenhos (lightArt de src/art.js, já em coordenadas da tela):
// brilhos, lâmpadas, filetes de luz, fios, anéis na água, facho em cone e neblina
export function lightItems(push, items) {
  const c01 = (c, a) => [c[0] / 255, c[1] / 255, c[2] / 255, a];
  for (const it of items || []) {
    const col = it.color || [255, 220, 150];
    if (it.kind === 'glow') {
      push(P3.glow, it.x, it.y, it.r, it.r, 0, c01(col, Math.min(1, it.a)), 0, 0, 0.6);
    } else if (it.kind === 'bulb') {
      // Lâmpada de vidro (acesa por dentro) e o halo quando acesa
      if (it.on) push(P3.glow, it.x, it.y, it.r * 4.5, it.r * 4.5, 0, c01(col, 0.75), 0, 0, 0.4);
      push(P3.snow, it.x, it.y, it.r, it.r, 0, c01(it.on ? col : col.map((v) => v * 0.45), 1), 0, 0, it.on ? 0.9 : 0);
    } else if (it.kind === 'beam' || it.kind === 'cord') {
      const dx = it.x1 - it.x0;
      const dy = it.y1 - it.y0;
      const len = Math.hypot(dx, dy) / 2;
      const kind = it.kind === 'beam' ? P3.beam : P3.cord;
      // Passa meia largura de cada ponta e some em rampa ali: pedaços emendados
      // somam luz igual na emenda (sem "contas")
      const hw = len + it.w * 0.5;
      push(kind, (it.x0 + it.x1) / 2, (it.y0 + it.y1) / 2, hw, it.w, Math.atan2(dy, dx), c01(col, it.a ?? 1), 0, it.w / hw, it.taper || 0);
    } else if (it.kind === 'drop') {
      push(P3.snow, it.x, it.y, it.r, it.r, 0, c01(col, it.a ?? 1), 0, 0, 0);
    } else if (it.kind === 'ice') {
      push(P3.ice, it.x, it.y, it.rx, it.ry, it.rot || 0, [1, 1, 1, Math.min(1, it.a)], 0, 0, 0);
    } else if (it.kind === 'ring') {
      push(P3.ring, it.x, it.y, it.rx / 0.86, it.ry / 0.86, 0, c01(col, it.a), 0, 0, 0);
    } else if (it.kind === 'fog') {
      push(P3.smoke, it.x, it.y, it.rx, it.ry, 0, c01(col, it.a), it.x * 0.01, 0, 0);
    } else if (it.kind === 'cone') {
      const len = Math.hypot(it.x1 - it.x0, it.y1 - it.y0) / 2;
      const rot = Math.atan2(it.y1 - it.y0, it.x1 - it.x0) - Math.PI / 2;
      push(P3.cone, (it.x0 + it.x1) / 2, (it.y0 + it.y1) / 2, it.w1, len, rot, c01(col, it.a), 0, 0, it.w0 / Math.max(1, it.w1));
    }
  }
}

// ---------------------------------------------------------------- Shader
const VERT = `
attribute vec3 aPos;   // x, y, giro
attribute vec2 aSize;  // meia largura, meia altura
attribute vec4 aCol;
attribute vec4 aInfo;  // tipo, fase, desfoque, extra
attribute vec4 aUvr;   // retângulo no atlas de textos (u0, v0, u1, v1)
uniform vec4 uView;    // x0, y0, x1, y1 da camada
varying vec2 vUv;
varying vec4 vCol;
varying vec4 vInfo;
varying vec4 vUvr;
varying float vRot;
void main() {
  vec2 q = position.xy * 2.0;
  vec2 l = vec2(q.x, -q.y) * aSize;
  float c = cos(aPos.z), s = sin(aPos.z);
  vec2 p = aPos.xy + vec2(c * l.x - s * l.y, s * l.x + c * l.y);
  gl_Position = vec4((p.x - uView.x) / (uView.z - uView.x) * 2.0 - 1.0,
                     1.0 - (p.y - uView.y) / (uView.w - uView.y) * 2.0, 0.0, 1.0);
  vUv = vec2(q.x, -q.y);  // y para baixo, como na tela
  vCol = aCol;
  vInfo = aInfo;
  vUvr = aUvr;
  vRot = aPos.z;
}`;

const FRAG = `
precision highp float;
varying vec2 vUv;
varying vec4 vCol;
varying vec4 vInfo;
varying vec4 vUvr;
varying float vRot;
uniform float uTime;
uniform sampler2D uText;
uniform vec2 uTexel;
uniform vec3 uLight;  // direção da luz (x para a direita, y para cima, z para a câmera)
uniform vec3 uSun, uAmb;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + 11.3; a *= 0.5; }
  return s;
}

void main() {
  float kind = vInfo.x, ph = vInfo.y, blur = vInfo.z, ex = vInfo.w;
  vec2 q = vUv;
  float r = length(q);
  vec4 o = vec4(0.0);
  if (kind < 0.5) {
    // ---- Floco de neve: esfera iluminada; desfocado perto da câmera
    if (r > 1.0) discard;
    vec3 n = vec3(q.x, -q.y, sqrt(max(0.0, 1.0 - r * r)));
    float dif = max(dot(n, uLight), 0.0);
    float spec = pow(max(dot(reflect(-uLight, n), vec3(0.0, 0.0, 1.0)), 0.0), 14.0);
    vec3 lit = vCol.rgb * (uAmb + uSun * dif * 0.85) + uSun * spec * 0.45;
    vec3 flat_ = vCol.rgb * (uAmb + uSun * 0.55);
    vec3 c = mix(lit, flat_, blur);
    // Lava (ex > 0): acesa por dentro
    c += vCol.rgb * ex * (0.6 + 0.4 * n.z);
    float edge = 1.0 - smoothstep(1.0 - (0.22 + 0.75 * blur), 1.0, r);
    edge *= 1.0 + blur * 0.4 * smoothstep(0.45, 0.9, r);
    float a = vCol.a * edge;
    o = vec4(c * a, a);
  } else if (kind < 1.5) {
    // ---- Folha: lâmina que vira de lado (ex = cosseno da virada; < 0 = verso)
    float wdt = 0.6 * (1.0 - q.x * q.x) * (1.0 - 0.25 * q.x);
    float leaf = 1.0 - smoothstep(-0.05, 0.05, abs(q.y) - wdt);
    float stem = (1.0 - smoothstep(0.04, 0.09, abs(q.y))) * step(0.75, q.x);
    float a0 = max(leaf, stem);
    if (a0 < 0.01) discard;
    float fl = ex;
    float sideS = sqrt(max(0.0, 1.0 - fl * fl));
    // Normal no plano da folha (vista de frente ou de costas) + a dobra da nervura
    vec3 n = normalize(vec3(0.0, sideS * sign(fl + 1e-4) + sign(q.y) * 0.35 * abs(fl), abs(fl)));
    // Luz trazida para o plano da folha (que está girada na tela)
    float c = cos(vRot), s = sin(vRot);
    vec3 L = vec3(c * uLight.x - s * uLight.y, s * uLight.x + c * uLight.y, uLight.z);
    float d = dot(n, L);
    vec3 base = fl < 0.0 ? mix(vCol.rgb, vCol.rgb * 1.2 + 0.08, 0.55) : vCol.rgb;
    vec3 col = base * (uAmb * 0.9 + uSun * max(d, 0.0));
    // Contraluz: a luz atravessa a folha
    col += vCol.rgb * uSun * max(-d, 0.0) * 0.35;
    // Nervura e borda mais escuras
    float vein = (1.0 - smoothstep(0.0, 0.05, abs(q.y))) * step(q.x, 0.8) * step(-0.85, q.x);
    col *= 1.0 - 0.3 * vein;
    col *= 0.85 + 0.15 * smoothstep(0.0, 0.25, wdt - abs(q.y));
    float a = vCol.a * a0;
    o = vec4(col * a, a);
  } else if (kind < 2.5) {
    // ---- Brasa: núcleo quente e brilho que soma luz
    float g = exp(-r * r * 4.0);
    float core = exp(-r * r * 22.0);
    float flick = 0.6 + 0.4 * sin(uTime * 9.0 + ph * 7.0);
    if (blur > 0.5) { flick = 1.0; core *= 0.3; }
    vec3 c = mix(vCol.rgb, vec3(1.0, 0.95, 0.72), core);
    float v = vCol.a * flick;
    o = vec4(c * (g * 0.75 + core) * v, core * v * 0.6);
  } else if (kind < 3.5) {
    // ---- Poeira estelar: estrelinha de 4 pontas cintilando
    float tw = 0.5 + 0.5 * sin(uTime * 4.0 + ph);
    float rays = exp(-abs(q.x) * 14.0) * exp(-abs(q.y) * 2.6) + exp(-abs(q.y) * 14.0) * exp(-abs(q.x) * 2.6);
    float core = exp(-r * r * 16.0);
    float v = (rays * 0.8 + core) * (0.3 + 0.7 * tw) * vCol.a;
    o = vec4(mix(vCol.rgb, vec3(1.0), core * 0.5) * v, v * 0.35);
  } else if (kind < 4.5) {
    // ---- Fumaça: volume com turbulência, iluminado pelo sol (e pela lava, ex)
    if (r > 1.0) discard;
    vec2 drift = vec2(ph * 3.1, ph * 1.7 - uTime * 0.18);
    float f = fbm(q * 1.7 + drift);
    float den = clamp((f + 0.08 - r * 0.6) * 2.4, 0.0, 1.0) * (1.0 - smoothstep(0.75, 1.0, r));
    if (den < 0.005) discard;
    vec2 toL = vec2(uLight.x, -uLight.y) * 0.22;
    float f2 = fbm((q + toL) * 1.7 + drift);
    vec3 n = vec3(q.x, -q.y, sqrt(max(0.0, 1.0 - r * r)));
    float lit = clamp(0.5 + (f - f2) * 3.2 + dot(n, uLight) * 0.35, 0.0, 1.0);
    vec3 col = vCol.rgb * (uAmb * 0.85 + uSun * lit * 0.75);
    // Lava acesa por baixo
    col += vec3(1.0, 0.42, 0.12) * ex * smoothstep(-0.3, 1.0, q.y) * 0.9;
    float a = den * vCol.a;
    o = vec4(col * a, a);
  } else if (kind < 5.5) {
    // ---- Brilho (vagalume, cratera): soma luz
    float g = exp(-r * r * 4.5);
    float core = exp(-r * r * 40.0);
    float v = (g * 0.7 + core * ex) * vCol.a * (1.0 - smoothstep(0.85, 1.0, r));
    o = vec4(mix(vCol.rgb, vec3(1.0), core * 0.5) * v, 0.0);
  } else if (kind > 6.5 && kind < 7.5) {
    // ---- Anel na água: a crista da onda, mais clara do lado de cima (pega o céu)
    float rr = length(q);
    float band = 1.0 - smoothstep(0.0, 0.14, abs(rr - 0.86));
    if (band < 0.01) discard;
    float lit = 0.65 + 0.45 * smoothstep(0.3, -0.9, q.y) + 0.25 * max(0.0, -q.x * uLight.x);
    float a = vCol.a * band;
    o = vec4(vCol.rgb * lit * a, a);
  } else if (kind > 7.5 && kind < 8.5) {
    // ---- Lasca de gelo: losango facetado (4 faces com luz diferente) e brilho
    float d = abs(q.x) + abs(q.y);
    if (d > 1.0) discard;
    vec2 f = sign(q + 1e-4);
    vec3 n = normalize(vec3(f.x * 0.55, -f.y * 0.55, 1.0));
    float c = cos(vRot), s = sin(vRot);
    vec3 L = vec3(c * uLight.x - s * uLight.y, s * uLight.x + c * uLight.y, uLight.z);
    float dif = max(dot(n, L), 0.0);
    vec3 col = vCol.rgb * (uAmb * 0.8 + uSun * dif) + uSun * pow(dif, 12.0) * 0.6;
    float a = vCol.a * (1.0 - smoothstep(0.85, 1.0, d));
    o = vec4(col * a, a);
  } else if (kind > 8.5 && kind < 9.5) {
    // ---- Bolha: esfera transparente (borda mais visível) com o reflexo da luz
    if (r > 1.0) discard;
    float rim = smoothstep(0.55, 1.0, r) * (1.0 - smoothstep(0.92, 1.0, r));
    vec2 hp = q - vec2(-0.35, -0.38);
    float hi = exp(-dot(hp, hp) * 30.0);
    float a = vCol.a * (0.12 + rim * 0.8 + hi);
    vec3 col = mix(vCol.rgb, vec3(1.0), hi);
    o = vec4(col * a, a);
  } else if (kind > 9.5 && kind < 10.5) {
    // ---- Texto em relevo: a letra do atlas com chanfro iluminado e contorno escuro
    vec2 uv = mix(vUvr.xy, vUvr.zw, q * 0.5 + 0.5);
    float a0 = texture2D(uText, uv).a;
    float ex2 = 1.6;
    float ax = texture2D(uText, uv + vec2(uTexel.x * ex2, 0.0)).a - texture2D(uText, uv - vec2(uTexel.x * ex2, 0.0)).a;
    float ay = texture2D(uText, uv + vec2(0.0, uTexel.y * ex2)).a - texture2D(uText, uv - vec2(0.0, uTexel.y * ex2)).a;
    float ol = 0.0;
    for (int i = 0; i < 8; i++) {
      float ang = float(i) * 0.7854;
      ol = max(ol, texture2D(uText, uv + vec2(cos(ang), sin(ang)) * uTexel * 3.2).a);
    }
    vec3 n = normalize(vec3(-ax * 1.8, ay * 1.8, 1.0));
    float dif = max(dot(n, uLight), 0.0);
    float spec = pow(max(dot(reflect(-uLight, n), vec3(0.0, 0.0, 1.0)), 0.0), 18.0);
    vec3 face = vCol.rgb * (0.5 + 0.75 * dif) + vec3(1.0) * spec * 0.5;
    vec3 col = mix(vec3(0.02, 0.1, 0.16), face, a0);
    float a = max(a0, ol * 0.7) * vCol.a;
    o = vec4(col * a, a);
  } else if (kind > 10.5 && kind < 11.5) {
    // ---- Pegada: marca afundada (calcanhar e planta do pé), mais escura do lado da luz
    // (a parede do buraco faz sombra) e a borda de lá um pouco mais clara
    vec2 pq = vec2(q.x * sign(ex + 1e-4), q.y);
    float heel = length((pq - vec2(-0.46, 0.0)) / vec2(0.5, 0.82));
    float sole = length((pq - vec2(0.26, 0.0)) / vec2(0.7, 1.0));
    float d = min(heel, sole);
    if (d > 1.0) discard;
    float inner = 1.0 - smoothstep(0.55, 1.0, d);
    float side = clamp(0.5 - q.x * uLight.x * 0.6 + q.y * 0.4, 0.0, 1.0);
    vec3 col = vCol.rgb * (0.55 + 0.45 * side);
    col = mix(col * 1.25, col, inner);
    float a = vCol.a * (0.35 + 0.4 * inner) * (1.0 - smoothstep(0.85, 1.0, d));
    o = vec4(col * a, a);
  } else if (kind > 11.5 && kind < 12.5) {
    // ---- Filete de luz (fresta de porta, cauda de cometa): soma luz; ex = afinar na ponta
    float u = (q.x + 1.0) * 0.5;
    float wf = max(0.06, 1.0 - ex * u);
    float across = abs(q.y) / wf;
    float ends = ex > 0.0 ? (1.0 - u * 0.85) : clamp((1.0 - abs(q.x)) / max(blur, 0.01), 0.0, 1.0);
    float v = exp(-across * across * 3.0) * ends * vCol.a;
    o = vec4(vCol.rgb * v, 0.0);
  } else if (kind > 12.5 && kind < 13.5) {
    // ---- Fio (pisca-pisca, corrente, teia): cilindro fino, mais claro em cima
    float v = 1.0 - smoothstep(0.55, 1.0, abs(q.y));
    float ends = 1.0 - smoothstep(0.92, 1.0, abs(q.x));
    vec3 col = vCol.rgb * (0.7 + 0.6 * clamp(-q.y, 0.0, 1.0)) * (uAmb + uSun * 0.5);
    float a = v * ends * vCol.a;
    o = vec4(col * a, a);
  } else if (kind > 14.5 && kind < 15.5) {
    // ---- Bloco de gelo em volta de quem congelou: facetas com luz diferente,
    // translúcido no meio, mais branco nas bordas e brilho do sol
    vec2 a2 = abs(q);
    float box = max(a2.x * 1.05, a2.y * 0.95 + a2.x * 0.12);
    if (box > 1.0) discard;
    vec2 cell = floor((q + 1.0) * vec2(1.6, 2.6));
    float hc = hash(cell);
    vec3 n = normalize(vec3((hc - 0.5) * 0.9 + q.x * 0.5, (hash(cell + 3.1) - 0.5) * 0.9 - q.y * 0.3, 1.0));
    float dif = max(dot(n, uLight), 0.0);
    float fres = smoothstep(0.55, 1.0, box);
    vec3 col = mix(vec3(0.5, 0.78, 0.92), vec3(0.93, 0.98, 1.0), dif) + uSun * pow(dif, 18.0) * 0.6;
    float crack = 1.0 - smoothstep(0.0, 0.04, abs(fract((q.x + q.y * 0.6) * 1.6 + hc) - 0.5));
    col = mix(col, vec3(1.0), crack * 0.5);
    float a = vCol.a * (0.4 + 0.45 * fres) * (1.0 - smoothstep(0.93, 1.0, box));
    o = vec4(col * a, a);
  } else if (kind > 13.5 && kind < 14.5) {
    // ---- Facho em cone (disco voador): estreito em cima, largo e sumindo embaixo
    float u = (q.y + 1.0) * 0.5;
    float wdt = mix(ex, 1.0, u);
    float inside = 1.0 - smoothstep(wdt * 0.75, wdt, abs(q.x));
    float v = inside * (1.0 - u) * (0.85 + 0.15 * sin(uTime * 7.0 + q.y * 9.0)) * vCol.a;
    o = vec4(vCol.rgb * v, 0.0);
  } else {
    // ---- Chama: fogo subindo e se torcendo
    float h = (0.8 - q.y) / 1.7;   // 0 na base, 1 na ponta
    float x = q.x * 1.6;
    float n1 = fbm(vec2(x * 1.5 + ph * 5.0, h * 2.6 - uTime * 3.4));
    float n2 = noise(vec2(x * 4.0 - ph * 3.0, h * 6.0 - uTime * 7.0));
    float dx = x + (n1 - 0.5) * 0.9 * h + (n2 - 0.5) * 0.25 * h;
    float base = sqrt(smoothstep(-0.06, 0.16, h));
    float wdt = 0.62 * pow(max(1.0 - h, 0.0), 0.75) * (0.85 + 0.3 * n1) * base;
    float body = 1.0 - smoothstep(wdt * 0.5, wdt + 0.02, abs(dx));
    body *= 1.0 - smoothstep(0.5 + 0.35 * n1, 1.0, h);
    float inner = (1.0 - smoothstep(wdt * 0.12, wdt * 0.6, abs(dx))) * (1.0 - smoothstep(0.1, 0.5 + 0.2 * n2, h)) * base;
    vec3 col = mix(vec3(0.9, 0.2, 0.03), vec3(1.0, 0.58, 0.12), body);
    col = mix(col, vec3(1.0, 0.95, 0.65), inner);
    vec2 hq = vec2(q.x, (h - 0.3) * 1.7);
    float halo = exp(-dot(hq, hq) * 3.5) * (0.3 + 0.05 * sin(uTime * 9.0 + ph));
    vec3 c = col * (body + inner * 0.4) + vec3(1.0, 0.62, 0.25) * halo;
    o = vec4(c * vCol.a, body * 0.9 * vCol.a);
  }
  gl_FragColor = o;
}`;

// Lote de partículas: quadradinhos instanciados com os atributos de cada uma
class Batch {
  constructor(THREE, max) {
    this.max = max;
    const g = new THREE.InstancedBufferGeometry();
    const plane = new THREE.PlaneGeometry(1, 1);
    g.index = plane.index;
    g.setAttribute('position', plane.getAttribute('position'));
    g.setAttribute('uv', plane.getAttribute('uv'));
    const attr = (name, n) => {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(max * n), n);
      a.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute(name, a);
      return a;
    };
    this.pos = attr('aPos', 3);
    this.size = attr('aSize', 2);
    this.col = attr('aCol', 4);
    this.info = attr('aInfo', 4);
    this.uvr = attr('aUvr', 4);
    g.instanceCount = 0;
    this.geometry = g;
    this.n = 0;
    this.push = (kind, x, y, hw, hh, rot, c, ph = 0, blur = 0, ex = 0, uv = null) => {
      if (this.n >= this.max) return;
      const i = this.n++;
      this.pos.array.set([x, y, rot || 0], i * 3);
      this.size.array.set([hw, hh], i * 2);
      this.col.array.set([c[0], c[1], c[2], c[3] ?? 1], i * 4);
      this.info.array.set([kind, ph, blur, ex], i * 4);
      this.uvr.array.set(uv || [0, 0, 0, 0], i * 4);
    };
  }

  begin() { this.n = 0; }

  upload() {
    for (const a of [this.pos, this.size, this.col, this.info, this.uvr]) a.needsUpdate = true;
    this.geometry.instanceCount = this.n;
  }
}

export class Particles3D {
  constructor(THREE) {
    this.THREE = THREE;
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: false }));
    r.setPixelRatio(1);
    r.setClearColor(0x000000, 0);
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping;
    this.canvas = r.domElement;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.uniforms = {
      uTime: { value: 0 },
      uView: { value: new THREE.Vector4(0, 0, W, H) },
      uLight: { value: new THREE.Vector3(-0.5, 0.6, 0.6).normalize() },
      uSun: { value: new THREE.Vector3(1, 0.95, 0.85) },
      uAmb: { value: new THREE.Vector3(0.55, 0.62, 0.72) },
      uText: { value: null },
      uTexel: { value: new THREE.Vector2(1 / 1024, 1 / 256) },
    };
    // Atlas dos textos de pontos (cada texto novo é escrito numa linha livre)
    this.textCanvas = document.createElement('canvas');
    this.textCanvas.width = 1024;
    this.textCanvas.height = 256;
    this.textTex = new THREE.CanvasTexture(this.textCanvas);
    this.textTex.flipY = false;
    this.textTex.colorSpace = THREE.NoColorSpace;
    this.textTex.minFilter = THREE.LinearFilter;
    this.textTex.generateMipmaps = false;
    this.uniforms.uText.value = this.textTex;
    this.glyphs = new Map();
    this.cursor = { x: 4, y: 4 };
    this.glyph = (str) => this.textGlyph(str);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms,
      transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    this.batch = new Batch(THREE, PARTICLES3D.max);
    const mesh = new THREE.Mesh(this.batch.geometry, this.material);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.size = [0, 0];
    this.holds = null; // o que está no canvas agora: 'atlas' (chamas) ou uma passada
    this.renderer.setSize(Math.max(256, PARTICLES3D.flameCell[0] * PARTICLES3D.flameSlots), PARTICLES3D.flameCell[1], false);
    this.size = [this.canvas.width, this.canvas.height];
    // Uma partícula de cada tipo para compilar o shader antes do jogo
    this.batch.begin();
    for (let k = 0; k <= 6; k++) this.batch.push(k, 10 + k * 20, 20, 8, 8, 0, [1, 1, 1, 1]);
    this.batch.upload();
    this.renderer.compile(this.scene, this.camera);
    this.renderer.render(this.scene, this.camera);
  }

  // Retângulo de um texto no atlas (escreve se ainda não estiver lá)
  textGlyph(str) {
    const key = String(str);
    let gl = this.glyphs.get(key);
    if (gl) return gl;
    const c = this.textCanvas;
    const g = c.getContext('2d');
    const fs = TEXT.atlasFont;
    g.font = `800 ${fs}px system-ui, sans-serif`;
    const w = Math.ceil(g.measureText(key).width) + 12;
    const h = fs + 14;
    if (this.cursor.x + w > c.width) {
      this.cursor.x = 4;
      this.cursor.y += h;
    }
    if (this.cursor.y + h > c.height) {
      // Atlas cheio: recomeça do zero
      g.clearRect(0, 0, c.width, c.height);
      this.glyphs.clear();
      this.cursor = { x: 4, y: 4 };
    }
    const { x, y } = this.cursor;
    g.fillStyle = '#FFFFFF';
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.fillText(key, x + 6, y + h / 2);
    this.cursor.x += w + 4;
    this.textTex.needsUpdate = true;
    gl = { uv: [x / c.width, y / c.height, (x + w) / c.width, (y + h) / c.height], w, h };
    this.glyphs.set(key, gl);
    return gl;
  }

  setLight(light) {
    if (!light) return;
    const u = this.uniforms;
    if (light.dir) u.uLight.value.set(...light.dir).normalize();
    if (light.sun) u.uSun.value.set(...light.sun);
    if (light.amb) u.uAmb.value.set(...light.amb);
  }

  // Tamanho da camada pela escala do canvas do jogo
  fit(ctx) {
    if (!(ctx?.canvas?.width > 0) || typeof ctx.getTransform !== 'function') return null;
    const m = ctx.getTransform();
    if (typeof m?.a !== 'number' || !(m.d > 0)) return null;
    const pad = PARTICLES3D.pad;
    const devW = Math.abs(m.a) * (W + pad * 2);
    const devH = Math.abs(m.d) * H;
    const q = Math.min(PARTICLES3D.quality, PARTICLES3D.maxWidth / Math.max(1, devW));
    const [cw, ch] = PARTICLES3D.flameCell;
    // Nunca menor que o atlas das chamas (que usa o mesmo canvas)
    const w = Math.max(cw * PARTICLES3D.flameSlots, Math.round(devW * q));
    const h = Math.max(ch, Math.round(devH * q));
    if (w !== this.size[0] || h !== this.size[1]) {
      this.renderer.setSize(w, h, false);
      this.size = [w, h];
    }
    return this.size;
  }

  // Uma passada: fill(push) diz o que desenhar (coordenadas lógicas do contexto atual).
  // Sem nada a desenhar, não gasta nada.
  draw(ctx, t, light, fill) {
    if (!this.fit(ctx)) return false;
    const b = this.batch;
    b.begin();
    fill(b.push);
    if (!b.n) return true;
    b.upload();
    const pad = PARTICLES3D.pad;
    this.setLight(light);
    this.uniforms.uTime.value = t;
    this.uniforms.uView.value.set(-pad, 0, W + pad, H);
    this.renderer.render(this.scene, this.camera);
    this.holds = 'pass';
    ctx.drawImage(this.canvas, -pad, 0, W + pad * 2, H);
    return true;
  }

  // Chama de tocha: base em (x, base), altura h e largura w da chama (o halo fica em
  // volta). As chamas do quadro saem de um atlas com algumas chamas diferentes,
  // desenhado uma vez por quadro no canto do mesmo canvas.
  flame(ctx, t, x, base, h, w, seed = 0) {
    if (!this.fit(ctx)) return false;
    const [cw, ch] = PARTICLES3D.flameCell;
    const slots = PARTICLES3D.flameSlots;
    if (this.holds !== 'atlas' || this.atlasT !== t) {
      const b = this.batch;
      b.begin();
      for (let i = 0; i < slots; i++) b.push(P3.flame, cw * (i + 0.5), ch / 2, cw / 2, ch / 2, 0, [1, 1, 1, 1], i * 1.37, 0, 0);
      b.upload();
      this.uniforms.uTime.value = t;
      this.uniforms.uView.value.set(0, 0, this.size[0], this.size[1]);
      this.renderer.render(this.scene, this.camera);
      this.holds = 'atlas';
      this.atlasT = t;
    }
    const slot = ((Math.round(seed) % slots) + slots) % slots;
    // A chama ocupa 85% da altura da célula, a partir de 10% acima da base
    const dh = h / 0.85;
    const dw = w * 2.6;
    ctx.drawImage(this.canvas, slot * cw, 0, cw, ch, x - dw / 2, base + dh * 0.1 - dh, dw, dh);
    return true;
  }
}
