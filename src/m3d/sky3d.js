// Céu 3D ao vivo (etapa 2 da cena toda em 3D): um shader do Three.js desenha o céu a
// cada quadro numa camada WebGL própria, colada no canvas do jogo no lugar do céu 2D.
// - dia (gelo, floresta, praia): atmosfera que entardece com a temperatura, espalhamento
//   da luz em volta do sol, nuvens num plano de verdade em perspectiva (achatadas perto
//   do horizonte) iluminadas pelo sol, e o sol como esfera com a borda escurecida;
//   aurora boreal em cortinas com raios verticais e dobras mais claras
// - espaço: estrelas cintilando, nebulosas, a Terra como esfera iluminada (continentes
//   girando, nuvens, lado da noite, atmosfera) e estrela cadente
// - Halloween: estrelas, lua cheia esférica com crateras e halo, nuvens escuras com a
//   borda acesa pela lua
// - Dinossauros: sol enorme com a superfície fervendo e faixas de névoa quente
// Só no navegador com WebGL; o Three.js vem do mesmo endereço dos modelos 3D.
import { W, SHORE_TOP, DEPTH } from '../config.js';

export const SKY_H = SHORE_TOP + 30;

export const SKY3D = {
  pad: 64,
  maxWidth: 1600,
  quality: 0.75,
  // kind: 0 dia, 1 espaço, 2 noite (Halloween), 3 pré-histórico (Dinossauros)
  // clouds: quantidade de nuvens (0 = nenhuma); body: raio do sol/lua/Terra
  kinds: {
    ice: { kind: 0, clouds: 0.35, body: 22 },
    forest: { kind: 0, clouds: 0.5, body: 22 },
    beach: { kind: 0, clouds: 0.45, body: 22 },
    pirate: { kind: 0, clouds: 0.5, body: 24 },
    candy: { kind: 0, clouds: 0.55, body: 24 },
    space: { kind: 1, clouds: 0, body: 26 },
    halloween: { kind: 2, clouds: 0.55, body: 46 },
    dino: { kind: 3, clouds: 0.6, body: 40 },
  },
  // Degradês dos céus fixos (o do dia vem da temperatura, como no 2D)
  gradients: {
    space: [['#03021A', 0], ['#130D3A', 0.7], ['#2A1E5C', 1], ['#2A1E5C', 1]],
    halloween: [['#0B0620', 0], ['#24123E', 0.6], ['#4E2A5E', 1], ['#4E2A5E', 1]],
    dino: [['#2B1838', 0], ['#8A3A4A', 0.45], ['#E8724A', 0.8], ['#FFB070', 1]],
  },
};

const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uTime, uX0, uX1, uH, uHorizon, uVx, uKind, uClouds, uBodyR, uAurora, uSkyF;
uniform vec3 uG0, uG1, uG2, uG3, uSunCol;
uniform vec4 uStops;
uniform vec2 uBody;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.02 + 13.7; a *= 0.5; }
  return s;
}
float noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n = i.x + i.y * 57.0 + i.z * 113.0;
  #define H3(o) fract(sin(n + o) * 43758.5453)
  return mix(mix(mix(H3(0.0), H3(1.0), u.x), mix(H3(57.0), H3(58.0), u.x), u.y),
             mix(mix(H3(113.0), H3(114.0), u.x), mix(H3(170.0), H3(171.0), u.x), u.y), u.z);
}
float fbm3(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * noise3(p); p = p * 2.03 + 7.1; a *= 0.5; }
  return s;
}

vec3 gradientAt(float k) {
  if (k < uStops.y) return mix(uG0, uG1, k / max(uStops.y, 1e-3));
  if (k < uStops.z) return mix(uG1, uG2, (k - uStops.y) / max(uStops.z - uStops.y, 1e-3));
  return mix(uG2, uG3, clamp((k - uStops.z) / max(uStops.w - uStops.z, 1e-3), 0.0, 1.0));
}

// Estrelas: uma por célula, posição e brilho sorteados, cintilando
float stars(vec2 p, float cell, float t) {
  vec2 id = floor(p / cell);
  vec2 f = fract(p / cell);
  float r = hash(id);
  if (r < 0.55) return 0.0;
  vec2 c = vec2(hash(id + 3.1), hash(id + 7.7)) * 0.8 + 0.1;
  float d = length((f - c) * cell);
  float tw = 0.55 + 0.45 * sin(t * (1.5 + 3.0 * hash(id + 1.3)) + r * 40.0);
  float size = 1.0 + 1.2 * hash(id + 5.5);
  return smoothstep(size, 0.0, d) * tw * (0.35 + (r - 0.55) * 3.0);
}

// Esfera (sol, lua ou Terra): normal no ponto da tela, ou z < 0 fora dela
vec3 sphereN(vec2 p, vec2 c, float r) {
  vec2 d = (p - c) / r;
  float q = dot(d, d);
  if (q > 1.0) return vec3(0.0, 0.0, -1.0);
  return vec3(d.x, -d.y, sqrt(1.0 - q));
}

void main() {
  float x = mix(uX0, uX1, vUv.x);
  float y = mix(uH, 0.0, vUv.y);
  vec2 p = vec2(x, y);
  float k = clamp(y / uHorizon, 0.0, 1.0);
  vec3 col = gradientAt(k);
  float dSun = length(p - uBody);
  // Elevação acima do horizonte (0 no horizonte) e direção da coluna (para as nuvens)
  float el = max(0.015, (uHorizon + 20.0 - y) / 300.0);
  float dirX = (x - uVx) / 700.0;

  if (uKind < 0.5) {
    // ---- Dia: espalhamento da luz em volta do sol e no horizonte
    col += uSunCol * (0.22 * exp(-max(0.0, dSun - uBodyR) / 30.0) + 0.2 * exp(-dSun / 220.0));
    col += uG3 * pow(k, 6.0) * 0.12;
  } else if (uKind < 1.5) {
    // ---- Espaço: nebulosas e estrelas
    float n1 = fbm(p * 0.006 + vec2(uTime * 0.004, 0.0));
    float n2 = fbm(p * 0.011 + 5.0);
    vec3 neb = vec3(0.59, 0.27, 0.78) * smoothstep(0.45, 0.85, n1) * exp(-length(p - vec2(860.0, 70.0)) / 260.0);
    neb += vec3(0.16, 0.59, 0.78) * smoothstep(0.5, 0.9, n2) * exp(-length(p - vec2(1040.0, 40.0)) / 200.0);
    neb += vec3(0.78, 0.31, 0.59) * smoothstep(0.5, 0.85, n1 * 0.6 + n2 * 0.4) * exp(-length(p - vec2(560.0, 120.0)) / 170.0);
    col += neb * 0.8;
    col += vec3(1.0) * (stars(p, 26.0, uTime) + stars(p + 400.0, 11.0, uTime * 1.3) * 0.6) * (1.0 - k * 0.6);
    // Estrela cadente: um risco brilhante a cada 5,5 s
    float per = 5.5;
    float n = floor(uTime / per);
    float sk = (uTime - n * per) / 0.9;
    if (sk < 1.0) {
      vec2 s0 = vec2(500.0 + hash(vec2(n, 3.0)) * 700.0, 10.0 + hash(vec2(n, 9.0)) * 60.0);
      vec2 dir = normalize(vec2(-260.0, 90.0));
      vec2 head = s0 + vec2(-260.0, 90.0) * sk;
      vec2 rel = p - head;
      float along = dot(rel, -dir);
      float across = abs(dot(rel, vec2(-dir.y, dir.x)));
      float trail = step(0.0, along) * exp(-along / 45.0) * smoothstep(1.6, 0.0, across);
      col += vec3(1.0) * trail * sin(sk * 3.14159) * 1.2;
    }
  } else if (uKind < 2.5) {
    // ---- Noite: estrelas e o halo da lua
    col += vec3(1.0) * stars(p, 22.0, uTime) * 0.8 * (1.0 - k * 0.7);
    col += vec3(1.0, 0.92, 0.67) * (0.28 * exp(-max(0.0, dSun - uBodyR) / 28.0) + 0.1 * exp(-dSun / 190.0));
  } else {
    // ---- Pré-histórico: brilho enorme do sol
    col += uSunCol * (0.25 * exp(-max(0.0, dSun - uBodyR) / 35.0) + 0.22 * exp(-dSun / 260.0));
  }

  // ---- Sol / lua / Terra como esfera iluminada
  vec3 N = sphereN(p, uBody, uBodyR);
  if (N.z >= 0.0) {
    vec3 body;
    float edge = smoothstep(uBodyR, uBodyR - 1.5, dSun);
    if (uKind < 0.5) {
      // Sol: borda escurecida (limb darkening)
      body = mix(uSunCol * 1.08, vec3(1.0, 1.0, 0.96), pow(N.z, 0.35));
    } else if (uKind < 1.5) {
      // Terra: continentes, nuvens, lado da noite e atmosfera
      float lon = atan(N.x, N.z) + uTime * 0.06;
      float lat = asin(clamp(N.y, -1.0, 1.0));
      vec3 sp = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
      float land = smoothstep(0.5, 0.54, fbm3(sp * 2.2 + 3.0));
      float cloud = smoothstep(0.52, 0.7, fbm3(sp * 3.5 + vec3(uTime * 0.03, 0.0, 0.0)));
      vec3 albedo = mix(vec3(0.18, 0.48, 0.85), mix(vec3(0.31, 0.64, 0.35), vec3(0.6, 0.55, 0.38), smoothstep(0.55, 0.7, fbm3(sp * 5.0))), land);
      albedo = mix(albedo, vec3(1.0), cloud * 0.85);
      vec3 L = normalize(vec3(-0.75, 0.35, 0.55));
      float lit = max(0.0, dot(N, L));
      body = albedo * (0.06 + 1.05 * lit);
      // Atmosfera na borda
      body += vec3(0.43, 0.7, 1.0) * pow(1.0 - N.z, 3.0) * (0.25 + 0.75 * lit);
    } else if (uKind < 2.5) {
      // Lua cheia: mares escuros e crateras, iluminada quase de frente
      vec3 sp = N;
      float mare = smoothstep(0.5, 0.64, fbm3(sp * 2.4 + 11.0));
      float crat = fbm3(sp * 9.0);
      vec3 albedo = mix(vec3(1.0, 0.98, 0.86), vec3(0.93, 0.83, 0.56), mare * 0.6);
      albedo *= 0.92 + 0.16 * crat;
      vec3 L = normalize(vec3(-0.25, 0.2, 0.95));
      body = albedo * (0.6 + 0.5 * max(0.0, dot(N, L)));
    } else {
      // Sol pré-histórico: superfície fervendo (granulação) e borda escurecida
      float g = fbm3(vec3(N.xy * 7.0, uTime * 0.25));
      vec3 hot = mix(vec3(0.95, 0.42, 0.14), vec3(1.0, 0.9, 0.6), pow(N.z, 0.8));
      body = hot * (0.72 + 0.5 * g) * (0.75 + 0.3 * pow(N.z, 0.5));
    }
    col = mix(col, body, edge);
  }

  // ---- Aurora boreal (dia/noite polar): cortinas com raios verticais
  if (uAurora > 0.0) {
    vec3 a = vec3(0.0);
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float base = fi == 0.0 ? 42.0 : (fi == 1.0 ? 70.0 : 26.0);
      float h = fi == 0.0 ? 80.0 : (fi == 1.0 ? 64.0 : 54.0);
      float freq = fi == 0.0 ? 0.0055 : (fi == 1.0 ? 0.0075 : 0.004);
      float spd = fi == 0.0 ? 0.25 : (fi == 1.0 ? -0.18 : 0.12);
      float ph = fi * 2.1;
      float wave = sin(x * freq + uTime * spd + ph);
      float bottom = base + h + wave * 22.0 + sin(x * freq * 3.1 - uTime * spd * 2.0) * 7.0;
      float up = bottom - y;
      if (up < 0.0 || up > h * 1.6) continue;
      // Raios verticais finos andando de lado
      float rays = fbm(vec2(x * 0.05 + uTime * 0.35 + fi * 10.0, fi)) ;
      rays = 0.35 + 0.9 * smoothstep(0.35, 0.75, rays);
      // Dobras: onde a cortinha vira de lado ela fica mais clara
      float slope = abs(cos(x * freq + uTime * spd + ph));
      float fold = 0.7 + 0.6 * (1.0 - slope);
      float body = exp(-up / (h * 0.45)) * smoothstep(0.0, 4.0, up);
      vec3 green = fi == 2.0 ? vec3(0.43, 0.94, 0.78) : vec3(0.31, 1.0, 0.63);
      vec3 top = fi == 0.0 ? vec3(0.63, 0.43, 1.0) : (fi == 1.0 ? vec3(0.35, 0.78, 1.0) : vec3(1.0, 0.47, 0.82));
      vec3 c = mix(green, top, smoothstep(0.0, h * 1.2, up));
      float shimmer = 0.7 + 0.3 * sin(x * 0.03 - uTime * 1.4 + ph);
      a += c * body * rays * fold * shimmer * 0.42;
    }
    col += a * uAurora;
  }

  // ---- Nuvens num plano em perspectiva, iluminadas pelo sol (ou lua)
  if (uClouds > 0.0) {
    float d = 1.0 / el;
    vec2 cp = vec2(dirX * d * 1.4, d * 0.9) + vec2(uTime * 0.012, 0.0);
    float cover = 0.78 - uClouds * 0.3;
    float den = fbm(cp * vec2(1.6, 3.2));
    float c = smoothstep(cover, cover + 0.22, den);
    // Luz: mais densidade na direção do sol = sombra
    vec2 toSun = normalize(uBody - p) * vec2(0.05, 0.08);
    float den2 = fbm((cp + toSun) * vec2(1.6, 3.2));
    float lit = clamp(0.5 + (den - den2) * 4.0, 0.0, 1.0);
    vec3 shade = uKind > 1.5 && uKind < 2.5 ? vec3(0.1, 0.05, 0.16) : (uKind > 2.5 ? vec3(0.32, 0.12, 0.16) : mix(uG1, uG0, 0.3) * 0.9);
    vec3 light = uKind > 1.5 && uKind < 2.5 ? vec3(0.55, 0.48, 0.62) : uSunCol * 1.05 + 0.1;
    vec3 cc = mix(shade, light, lit);
    // Borda iluminada perto do sol/lua (contraluz)
    cc += uSunCol * exp(-dSun / 90.0) * (1.0 - c) * 2.0 * c;
    // Some perto do horizonte (longe demais) e quase transparente na noite
    float fade = smoothstep(0.02, 0.12, el) * (uKind > 1.5 && uKind < 2.5 ? 0.8 : 0.85);
    col = mix(col, cc, c * fade);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

function rgb01(c) {
  if (Array.isArray(c)) return [c[0] / 255, c[1] / 255, c[2] / 255];
  const n = parseInt(String(c).replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export class Sky3D {
  constructor(THREE) {
    this.THREE = THREE;
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, preserveDrawingBuffer: false }));
    r.setPixelRatio(1);
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping;
    this.canvas = r.domElement;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const v3 = () => new THREE.Vector3();
    this.uniforms = {
      uTime: { value: 0 }, uX0: { value: -SKY3D.pad }, uX1: { value: W + SKY3D.pad }, uH: { value: SKY_H },
      uHorizon: { value: SHORE_TOP }, uVx: { value: DEPTH.vanishX }, uKind: { value: 0 }, uClouds: { value: 0 },
      uBodyR: { value: 22 }, uAurora: { value: 0 }, uSkyF: { value: 1 },
      uG0: { value: v3() }, uG1: { value: v3() }, uG2: { value: v3() }, uG3: { value: v3() }, uSunCol: { value: v3() },
      uStops: { value: new THREE.Vector4(0, 0.5, 1, 1) }, uBody: { value: new THREE.Vector2(300, 80) },
    };
    this.material = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms, depthTest: false, depthWrite: false });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
    this.size = [0, 0];
    this.renderer.setSize(8, 8, false);
    this.renderer.compile(this.scene, this.camera);
    this.renderer.render(this.scene, this.camera);
  }

  // o: { scenery, t, top, hor, sun (cores do dia), body {x, y}, aurora (0..1) }
  draw(ctx, t, o) {
    if (!(ctx?.canvas?.width > 0) || typeof ctx.getTransform !== 'function') return false;
    const m = ctx.getTransform();
    if (typeof m?.a !== 'number' || !(m.d > 0)) return false;
    const cfg = SKY3D.kinds[o.scenery] || SKY3D.kinds.ice;
    const u = this.uniforms;
    const pad = SKY3D.pad;
    const devW = Math.abs(m.a) * (W + pad * 2);
    const devH = Math.abs(m.d) * SKY_H;
    const q = Math.min(SKY3D.quality, SKY3D.maxWidth / Math.max(1, devW));
    const w = Math.max(16, Math.round(devW * q));
    const h = Math.max(16, Math.round(devH * q));
    if (w !== this.size[0] || h !== this.size[1]) {
      this.renderer.setSize(w, h, false);
      this.size = [w, h];
    }
    const grad = SKY3D.gradients[o.scenery] || [[o.top, 0], [o.top, 0], [o.hor, 1], [o.hor, 1]];
    [u.uG0, u.uG1, u.uG2, u.uG3].forEach((g, i) => g.value.set(...rgb01(grad[i][0])));
    u.uStops.value.set(grad[0][1], grad[1][1] || 0.0001, grad[2][1], grad[3][1]);
    u.uSunCol.value.set(...rgb01(o.sun));
    u.uBody.value.set(o.body.x, o.body.y);
    u.uBodyR.value = o.body.r || cfg.body;
    u.uKind.value = cfg.kind;
    u.uClouds.value = cfg.clouds;
    u.uAurora.value = o.aurora || 0;
    u.uTime.value = t;
    this.renderer.render(this.scene, this.camera);
    ctx.drawImage(this.canvas, -pad, 0, W + pad * 2, SKY_H);
    return true;
  }
}
