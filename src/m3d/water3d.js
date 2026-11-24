// Água 3D ao vivo (etapa 1 da cena toda em 3D): um shader do Three.js desenha a
// superfície do líquido a cada quadro numa camada WebGL própria, que é colada no canvas
// do jogo no lugar da água 2D. A superfície é um plano de verdade visto em perspectiva
// (ondas menores e mais achatadas ao fundo), com normais calculadas das ondas, Fresnel
// (reflete mais ao fundo, mostra o fundo escuro perto), o reflexo REAL do cenário que já
// foi desenhado acima da linha d'água (céu, montanhas, costa), distorcido pelas ondas, o
// brilho do sol/lua saindo da própria luz (o caminho de luz aparece sozinho) e o fundo
// mais escuro perto da câmera. Na lava: placas de crosta com relevo, andando devagar, e
// fendas incandescentes que pulsam (sem reflexo).
// Só no navegador com WebGL; o Three.js vem do mesmo endereço dos modelos 3D.
import { W, H, WATER_TOP, SHORE_Y, ROW_Y, DEPTH } from '../config.js';

export const WATER3D = {
  pad: 64,          // a camada passa um pouco das bordas (a câmera balança para os lados)
  maxWidth: 1700,   // resolução máxima da camada (px de verdade); o navegador amplia o resto
  quality: 0.8,     // fração da resolução do canvas usada pela camada
  reflectRes: 0.5,  // resolução da cópia do cenário usada no reflexo
  spacing: 140,     // distância entre as cristas das marolas (mundo; o cenário pode trocar)
  // Por cenário: tipo, ondas (força das normais), detalhe fino, deriva (px/s), força do
  // reflexo, brilho do sol e escurecimento da frente
  kinds: {
    ice: { lava: 0, waves: 1, detail: 1, drift: 6, reflect: 0.85, spec: 1, front: 0.35 },
    forest: { lava: 0, waves: 0.8, detail: 0.9, drift: 10, reflect: 0.8, spec: 0.6, front: 0.4 },
    space: { lava: 0, waves: 0.9, detail: 1.1, drift: 4, reflect: 0.75, spec: 0.8, front: 0.4 },
    beach: { lava: 0, waves: 1.1, detail: 1, drift: 7, reflect: 0.7, spec: 1.1, front: 0.3 },
    pirate: { lava: 0, waves: 1.05, detail: 1, drift: 6, reflect: 0.75, spec: 1.05, front: 0.35 },
    halloween: { lava: 0, waves: 0.85, detail: 0.9, drift: 4, reflect: 0.8, spec: 0.7, front: 0.45 },
    dino: { lava: 1, waves: 1, detail: 1, drift: 3, reflect: 0, spec: 0.4, front: 0.3 },
  },
};

const NEAR_Y = ROW_Y[ROW_Y.length - 1];

const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uTime, uTop, uH, uX0, uX1, uVx;
uniform vec3 uC0, uC1, uC2, uHor, uSunCol;
uniform vec2 uSun;
uniform float uSunStr, uReflect, uWaves, uSwell, uDetail, uDrift, uLava, uSpec, uFront, uHasRefl;
uniform sampler2D uRefl;
uniform vec4 uMap;     // logical → pixel do canvas: a, e (x) e d, f (y)
uniform vec2 uCanvas;  // largura do canvas e altura da faixa copiada (px de verdade)

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
// Ruído das ondas com o domínio girado a cada oitava (o ruído de valor alinhado à grade
// deixava a água quadriculada)
float fbmR(vec2 p) {
  float s = 0.0, a = 0.5;
  mat2 R = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 4; i++) { s += a * noise(p); p = R * p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
// Altura das ondas (mundo), como nas referências de mar calmo: marolas longas e bem
// espaçadas com as cristas quase paralelas à linha d'água (ondas que se cruzam em
// ângulo formavam um xadrez) + ondulação irregular em faixas compridas na horizontal,
// que quebra o reflexo em tiras
float waveH(vec2 q, float t, float lod) {
  float h = 0.0;
  h += 1.00 * sin(q.y * uSwell + q.x * 0.0015 - t * 0.85);
  h += 0.50 * sin(q.y * uSwell * 1.61 - q.x * 0.0022 - t * 1.10 + 1.7);
  h *= uWaves;
  vec2 w = q * vec2(0.010, 0.070);
  vec2 warp = vec2(fbmR(w * 0.6 + vec2(t * 0.04, 0.0)), fbmR(w * 0.6 + vec2(5.2, t * 0.06)));
  h += (fbmR(w + warp * 1.6 + vec2(t * 0.05, -t * 0.20)) - 0.5) * 1.8 * uDetail;
  h += (fbmR(w * 2.4 + warp + vec2(-t * 0.08, -t * 0.42)) - 0.5) * 0.7 * uDetail * lod;
  return h;
}
// Células da lava (distância às duas sementes mais próximas)
vec2 cells(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = vec2(hash(i + g), hash(i + g + 9.7));
    o = 0.5 + 0.42 * sin(uTime * 0.25 + 6.2831 * o);
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return vec2(d1, d2);
}

void main() {
  float x = mix(uX0, uX1, vUv.x);
  float y = mix(uH, uTop, vUv.y);
  float k = clamp((y - uTop) / (uH - uTop), 0.0, 1.0);    // 0 = fundo, 1 = frente
  // Perspectiva do plano: escala linear na vertical da tela (achatada ao fundo)
  float s = mix(0.3, 1.05, k);
  float Z0 = 300.0;
  vec3 P = vec3((x - uVx) / s, 0.0, Z0 / s);
  vec2 q = vec2(P.x + uTime * uDrift, P.z);
  float lod = smoothstep(0.3, 0.75, s);                  // sem detalhe fino lá no fundo (sem cintilar)
  vec3 cam = vec3(0.0, 160.0, 0.0);
  vec3 V = normalize(cam - P);

  vec3 col;
  if (uLava > 0.5) {
    // Lava: rio derretido correndo devagar, com ilhas de crosta escura em placas
    // grandes (fendas acesas entre elas) e áreas abertas de lava
    vec2 lp = vec2(P.x * 0.0075 + uTime * 0.012, P.z * 0.012);
    vec2 c = cells(lp);
    float edge = c.y - c.x;
    float seam = 1.0 - smoothstep(0.0, 0.05 + 0.06 * (1.0 - lod), edge);
    // Onde há crosta (manchas grandes e irregulares) e onde a lava corre aberta
    float cover = smoothstep(0.42, 0.62, fbm(vec2(P.x * 0.0035 + uTime * 0.01, P.z * 0.006) + 3.1));
    float e = 0.02;
    vec2 gp = lp * 2.5;
    float hx = fbm(gp + vec2(e, 0.0)) - fbm(gp - vec2(e, 0.0));
    float hz = fbm(gp + vec2(0.0, e)) - fbm(gp - vec2(0.0, e));
    vec3 N = normalize(vec3(-hx * 14.0, 1.0, -hz * 14.0));
    vec3 L = normalize(vec3(-0.5, 0.8, 0.3));
    float crustLight = 0.5 + 0.7 * max(0.0, dot(N, L));
    float grain = fbm(lp * 12.0);
    vec3 crust = mix(vec3(0.07, 0.035, 0.03), vec3(0.18, 0.09, 0.06), grain) * crustLight;
    // Lava aberta: laranja escuro com veios mais claros que correm
    float flow = fbm(vec2(P.x * 0.02 + uTime * 0.25, P.z * 0.05) + fbm(vec2(P.x * 0.01, P.z * 0.02 - uTime * 0.05)) * 2.0);
    float pulse = 0.88 + 0.12 * sin(uTime * 1.6 + c.x * 9.0);
    vec3 molten = mix(uC0 * 0.55, mix(uC0, vec3(1.0, 0.72, 0.3), 0.4), smoothstep(0.5, 0.8, flow)) * pulse;
    // Crosta fina perto da borda das placas: avermelhada pelo calor de baixo
    float heat = smoothstep(0.25, 0.0, edge);
    crust += uC0 * heat * 0.22;
    vec3 plate = mix(crust, mix(uC0, vec3(1.0, 0.8, 0.4), 0.5) * pulse, seam);
    col = mix(molten, plate, cover);
    // Brilho quente do lado de lá (horizonte) e fundo mais escuro na frente
    col += uHor * pow(1.0 - k, 3.0) * 0.15;
    col *= 1.0 - uFront * k * k;
  } else {
    // Normal das ondas por diferenças (mundo)
    float e = 0.8;
    float h0 = waveH(q, uTime, lod);
    float hx = waveH(q + vec2(e, 0.0), uTime, lod) - h0;
    float hz = waveH(q + vec2(0.0, e), uTime, lod) - h0;
    // Mais calma perto da câmera (lá as ondas ficam grandes na tela)
    float slope = mix(1.6, 0.9, k);
    vec3 N = normalize(vec3(-hx / e * slope, 1.0, -hz / e * slope));
    float ndv = max(0.0, dot(N, V));
    float F = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
    // Cor do corpo d'água: do degradê do tema, mais escura na frente
    vec3 body = k < 0.4 ? mix(uC0, uC1, k / 0.4) : mix(uC1, uC2, (k - 0.4) / 0.6);
    body *= 1.0 - uFront * k * k;
    // Luz atravessando a crista das ondas (um pouco mais clara)
    body += uC0 * clamp(h0 * 0.06, 0.0, 0.12);
    // Reflexo do cenário: o ponto espelhado na linha d'água, distorcido pelas ondas
    vec3 sky = uHor;
    if (uHasRefl > 0.5) {
      float yr = uTop - (y - uTop) * 1.25;
      float xr = x + N.x * 45.0 * s;
      yr += N.z * 60.0 * s - 2.0;
      vec2 dev = vec2(uMap.x * xr + uMap.y, uMap.z * yr + uMap.w);
      vec2 tc = vec2(dev.x / uCanvas.x, 1.0 - dev.y / uCanvas.y);
      // Acima da cópia: o alto do céu (a primeira linha dela)
      sky = texture2D(uRefl, clamp(tc, 0.002, 0.998)).rgb;
    }
    float refl = clamp(F * 1.3 + 0.03, 0.0, 1.0) * uReflect;
    col = mix(body, sky, refl);
    // Sol (ou lua): reflexo especular de verdade → caminho de luz e pontinhos de brilho
    // Na mesma direção do sol do céu: o caminho de luz cai bem embaixo dele (x da tela)
    vec3 sunP = vec3((uSun.x - uVx) * 2600.0 / Z0, 900.0 - uSun.y * 2.0, 2600.0);
    vec3 Ls = normalize(sunP - P);
    vec3 Hh = normalize(Ls + V);
    float sp = pow(max(0.0, dot(N, Hh)), 380.0) * 5.0 + pow(max(0.0, dot(N, Hh)), 40.0) * 0.12;
    col += uSunCol * sp * uSunStr * uSpec;
    // Névoa clara junto do horizonte (a água some na cor do céu lá no fundo)
    col = mix(col, uHor, pow(1.0 - k, 6.0) * 0.35);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

function srgb(THREE, c) {
  // Cores do tema em sRGB, usadas direto no shader (sem gestão de cor)
  if (Array.isArray(c)) return new THREE.Vector3(c[0] / 255, c[1] / 255, c[2] / 255);
  const n = parseInt(String(c).replace('#', ''), 16);
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export class Water3D {
  constructor(THREE) {
    this.THREE = THREE;
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, preserveDrawingBuffer: false }));
    r.setPixelRatio(1);
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping;
    this.canvas = r.domElement;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    // Cópia do cenário acima da linha d'água (fonte do reflexo)
    this.reflCanvas = document.createElement('canvas');
    this.reflCanvas.width = 4;
    this.reflCanvas.height = 4;
    this.reflTex = new THREE.CanvasTexture(this.reflCanvas);
    this.reflTex.colorSpace = THREE.NoColorSpace;
    this.reflTex.minFilter = THREE.LinearFilter;
    this.reflTex.generateMipmaps = false;
    const v3 = () => new THREE.Vector3();
    this.uniforms = {
      uTime: { value: 0 }, uTop: { value: WATER_TOP + 10 }, uH: { value: H },
      uX0: { value: -WATER3D.pad }, uX1: { value: W + WATER3D.pad }, uVx: { value: DEPTH.vanishX },
      uC0: { value: v3() }, uC1: { value: v3() }, uC2: { value: v3() }, uHor: { value: v3() }, uSunCol: { value: v3() },
      uSun: { value: new THREE.Vector2(300, 80) }, uSunStr: { value: 1 },
      uReflect: { value: 0.8 }, uWaves: { value: 1 }, uSwell: { value: 0.05 }, uDetail: { value: 1 }, uDrift: { value: 5 }, uLava: { value: 0 },
      uSpec: { value: 1 }, uFront: { value: 0.35 }, uHasRefl: { value: 0 },
      uRefl: { value: this.reflTex }, uMap: { value: new THREE.Vector4(1, 0, 1, 0) }, uCanvas: { value: new THREE.Vector2(1, 1) },
    };
    this.material = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms, depthTest: false, depthWrite: false });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
    this.size = [0, 0];
    // Compila já (a primeira imagem não trava a fase)
    this.renderer.setSize(8, 8, false);
    this.renderer.compile(this.scene, this.camera);
    this.renderer.render(this.scene, this.camera);
  }

  // Copia o que já está desenhado acima da linha d'água (px de verdade) para o reflexo
  captureReflection(ctx, m, top) {
    const src = ctx.canvas;
    const rh = Math.max(1, Math.min(src.height, Math.round(m.d * top + m.f)));
    const k = WATER3D.reflectRes;
    const w = Math.max(1, Math.round(src.width * k));
    const h = Math.max(1, Math.round(rh * k));
    const c = this.reflCanvas;
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
      this.reflTex.dispose();
    }
    c.getContext('2d').drawImage(src, 0, 0, src.width, rh, 0, 0, w, h);
    this.reflTex.needsUpdate = true;
    return [src.width, rh];
  }

  // Desenha a água no canvas do jogo (coordenadas lógicas, com a transformação atual)
  draw(ctx, t, o) {
    const cfg = WATER3D.kinds[o.kind] || WATER3D.kinds.ice;
    const u = this.uniforms;
    const top = WATER_TOP + 10;
    // Só num canvas de verdade (um contexto falso de teste não desenha nada)
    if (!(ctx?.canvas?.width > 0) || typeof ctx.getTransform !== 'function') return false;
    const m = ctx.getTransform();
    if (typeof m?.a !== 'number' || !(m.d > 0)) return false;
    const pad = WATER3D.pad;
    // Tamanho da camada: a área da água em px de verdade (com teto)
    const devW = Math.abs(m.a) * (W + pad * 2);
    const devH = Math.abs(m.d) * (H - top);
    const q = Math.min(WATER3D.quality * (o.quality ?? 1), WATER3D.maxWidth / Math.max(1, devW));
    const w = Math.max(16, Math.round(devW * q));
    const h = Math.max(16, Math.round(devH * q));
    if (w !== this.size[0] || h !== this.size[1]) {
      this.renderer.setSize(w, h, false);
      this.size = [w, h];
    }
    const pal = o.pal.water;
    u.uTime.value = t;
    u.uC0.value.copy(srgb(this.THREE, pal[0]));
    u.uC1.value.copy(srgb(this.THREE, pal[1]));
    u.uC2.value.copy(srgb(this.THREE, pal[2]));
    u.uHor.value.copy(srgb(this.THREE, o.horizon));
    u.uSunCol.value.copy(srgb(this.THREE, o.sunColor));
    u.uSun.value.set(o.sunX, o.sunY);
    u.uSunStr.value = o.sunStrength ?? 1;
    u.uReflect.value = cfg.reflect;
    u.uWaves.value = cfg.waves;
    u.uSwell.value = (Math.PI * 2) / (cfg.spacing || WATER3D.spacing);
    u.uDetail.value = cfg.detail;
    u.uDrift.value = cfg.drift;
    u.uLava.value = cfg.lava;
    u.uSpec.value = cfg.spec;
    u.uFront.value = cfg.front;
    u.uHasRefl.value = cfg.reflect > 0 ? 1 : 0;
    if (cfg.reflect > 0) {
      const [cw, rh] = this.captureReflection(ctx, m, top);
      u.uMap.value.set(m.a, m.e, m.d, m.f);
      u.uCanvas.value.set(cw, rh);
    }
    this.renderer.render(this.scene, this.camera);
    ctx.drawImage(this.canvas, -pad, top, W + pad * 2, H - top);
    return true;
  }
}
