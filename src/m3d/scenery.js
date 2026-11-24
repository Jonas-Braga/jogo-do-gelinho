// Cenários de fundo em 3D (etapa 3). Cada cenário é UMA foto do tamanho do fundo 2D
// (1280 × 284, em 2× de resolução), tirada com a câmera ortográfica inclinada de forma
// que x da cena = x da tela e um ponto do chão em profundidade z aparece em
// y_tela = z·sen(e) − y·cos(e). Assim a beira da costa, a linha onde o jogador pisa e a
// água caem exatamente onde o jogo espera, e o resto ganha relevo, luz e sombra de verdade.
import { W, SHORE_TOP, WATER_TOP, IGLOO } from '../config.js';
import { TAU, sweepGeometry } from './kit.js';
import { GRAVES } from '../halloween.js';
import { VOLCANOES, NEST, TREE_FERNS } from '../dino.js';

export const BG_H = WATER_TOP + 12;
const IGLOO_X = IGLOO.x; // a casa de cada fase fica aqui (nada de pedras ou buracos embaixo dela) // mesma altura do fundo 2D
export const SCENE_EL = 0.35; // inclinação da câmera dos cenários
const S = Math.sin(SCENE_EL);
const C = Math.cos(SCENE_EL);
// Profundidade z do chão (y = 0) que aparece na linha y da tela
export const zAt = (screenY) => screenY / S;
// Altura y que um ponto na profundidade z precisa ter para aparecer na linha y da tela
export const yAt = (screenY, z) => (z * S - screenY) / C;
// Linha da tela onde aparece o ponto (y, z)
export const screenOf = (y, z) => z * S - y * C;

// Beira da costa: topo do paredão de gelo (igual ao 2D) e o fundo do campo de neve
export const EDGE_TOP = WATER_TOP - 14;
export const SNOW_BACK = SHORE_TOP - 4;

// ---------------------------------------------------------------- Ruído
function hash(i, j, seed) {
  let h = (i * 374761393 + j * 668265263 + seed * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const fade = (t) => t * t * (3 - 2 * t);
export function noise2(x, y, seed = 1) {
  const i = Math.floor(x), j = Math.floor(y);
  const u = fade(x - i), v = fade(y - j);
  const a = hash(i, j, seed), b = hash(i + 1, j, seed), c = hash(i, j + 1, seed), d = hash(i + 1, j + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, seed = 1, oct = 5) {
  let s = 0, amp = 0.5, f = 1, norm = 0;
  for (let o = 0; o < oct; o++) {
    s += noise2(x * f, y * f, seed + o * 17) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return s / norm;
}
// Ruído de cristas (picos pontudos, como cordilheira)
export function ridged(x, y, seed = 1, oct = 5) {
  let s = 0, amp = 0.5, f = 1, norm = 0, w = 1;
  for (let o = 0; o < oct; o++) {
    let n = 1 - Math.abs(noise2(x * f, y * f, seed + o * 31) * 2 - 1);
    n *= n * w;
    w = Math.min(1, n * 1.6);
    s += n * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2.1;
  }
  return s / norm;
}

// ---------------------------------------------------------------- Malha de altura
// Grade em x × z com altura y = h(x, z) e cor por vértice (colorAt recebe a normal)
function heightField(THREE, { x0, x1, z0, z1, dx, dz, h, colorAt }) {
  const nx = Math.ceil((x1 - x0) / dx) + 1;
  const nz = Math.ceil((z1 - z0) / dz) + 1;
  const pos = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) {
    const z = z0 + ((z1 - z0) * j) / (nz - 1);
    for (let i = 0; i < nx; i++) {
      const x = x0 + ((x1 - x0) * i) / (nx - 1);
      const k = (j * nx + i) * 3;
      pos[k] = x;
      pos[k + 1] = h(x, z);
      pos[k + 2] = z;
    }
  }
  const idx = [];
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const nrm = g.getAttribute('normal');
  const col = new Float32Array(nx * nz * 3);
  const tmp = new THREE.Color();
  for (let v = 0; v < nx * nz; v++) {
    colorAt(tmp, pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2], nrm.getY(v), nrm.getZ(v));
    col[v * 3] = tmp.r;
    col[v * 3 + 1] = tmp.g;
    col[v * 3 + 2] = tmp.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

// Textura de grãos de neve para o relevo fino (bumpMap) do campo de neve
function grainTexture(THREE, seed) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, 256, 256);
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.35)';
    g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 1.5, 1 + rnd());
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(24, 6);
  return t;
}

// ---------------------------------------------------------------- Fundo gelado
// Fase normal (e o Natal): duas cordilheiras de gelo (a distante mais azulada pela
// névoa), campo de neve com montinhos soprados pelo vento, blocos de gelo e o
// paredão de gelo da costa com colunas, a borda de neve por cima e a parte de baixo
// azul-escura entrando na água.
export const ICE_RIDGES = [
  // zc: profundidade, depth: espessura, peaks: picos entre essas linhas da tela (como o 2D)
  { zc: 150, depth: 150, peaks: [96, 150], base: 215, seed: 3, freq: 0.0052, tint: '#BCD7E4' },
  { zc: 330, depth: 130, peaks: [136, 178], base: 215, seed: 9, freq: 0.0068, tint: '#DDEEF4' },
];
// Blocos de gelo espalhados no fundo do campo de neve (longe do iglu, à direita)
export const ICE_BLOCKS = [
  [120, 203, 13], [470, 207, 16], [700, 201, 10], [860, 205, 12],
];
// Gelo de pressão: placas quebradas e inclinadas no fundo do campo de neve
export const PRESSURE = { from: -40, to: W + 40, line: SNOW_BACK + 4, step: 34 };

export const iceScenery = {
  box: { left: 0, right: W, top: 0, bottom: -BG_H },
  res: 2,
  elevation: SCENE_EL,
  distance: 1300,
  poses: () => [{ key: 'main' }],
  stage: (studio) => studio.stageScenery({ target: [640, 0, 480], size: 950, fog: { color: '#CFE4EE', near: 1000, far: 2300 }, sky: 0.95, ground: '#A9C6DA', keyIntensity: 3.4, sun: [-0.78, 0.5, -0.25], exposure: 0.95 }),
  build(kit) {
    const { THREE, group, mat } = kit;
    const root = group();
    const vcol = (extra = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, ...extra });
    const cSnow = new THREE.Color('#F6FAFB');
    const cRock = new THREE.Color('#4E6E82');
    const cIce = new THREE.Color('#9CC6D8');
    // Cordilheiras: perfil de cristas no x, seção em pirâmide no z, detalhe de ruído;
    // neve onde é plano, gelo azulado e rocha onde é íngreme
    for (const r of ICE_RIDGES) {
      const [pTop, pLow] = r.peaks;
      const tint = new THREE.Color(r.tint);
      const geo = heightField(THREE, {
        x0: -140, x1: W + 140, z0: r.zc - r.depth / 2, z1: r.zc + r.depth / 2, dx: 5, dz: 5,
        h: (x, z) => {
          const across = 1 - Math.abs(z - r.zc) / (r.depth / 2);
          const shape = Math.pow(Math.max(0, across), 1.15);
          const prof = ridged(x * r.freq, r.seed * 1.7, r.seed);
          const peakScreen = pLow - (pLow - pTop) * Math.min(1, prof * 1.25);
          const height = (r.base - peakScreen) / C;
          const detail = (fbm(x * 0.05, z * 0.05, r.seed + 5, 4) - 0.5) * 10 * shape;
          return yAt(r.base, z) + height * shape + detail;
        },
        colorAt: (c, x, y, z, ny) => {
          const steep = 1 - ny;
          const streak = fbm(x * 0.08, y * 0.04, r.seed + 11, 3);
          if (ny > 0.8 - streak * 0.15) c.copy(cSnow);
          else c.copy(cIce).lerp(cRock, Math.min(1, Math.max(0, (steep - 0.25) * 1.6 + (streak - 0.5))));
          c.lerp(tint, 0.25);
        },
      });
      root.add(kit.mesh(geo, vcol({ roughness: 0.75 })));
    }
    // Campo de neve: montinhos soprados, ondas do vento e a beira plana perto do paredão
    const zBack = zAt(SNOW_BACK);
    const zEdge = zAt(EDGE_TOP);
    const snowGeo = heightField(THREE, {
      x0: -40, x1: W + 40, z0: zBack, z1: zEdge, dx: 6, dz: 5,
      h: (x, z) => {
        const k = (z - zBack) / (zEdge - zBack);
        const nearEdge = Math.min(1, (1 - k) * 6); // achata junto da beira
        // Montinhos maiores no fundo e suaves na frente (onde o jogador anda)
        const drift = (fbm(x * 0.011, z * 0.028, 21, 4) - 0.45) * (14 - k * 8);
        const wind = Math.sin(x * 0.05 + z * 0.09 + fbm(x * 0.02, z * 0.02, 23, 2) * 6) * 1.1;
        const back = Math.max(0, 1 - k * 3) * (fbm(x * 0.006, 1, 29, 3) * 9); // montes no fundo
        return (drift + wind) * nearEdge + back;
      },
      colorAt: (c, x, y, z, ny) => {
        c.set('#FBFDFD').lerp(new THREE.Color('#C9DCE6'), Math.min(1, (1 - ny) * 3));
      },
    });
    root.add(kit.mesh(snowGeo, vcol({ roughness: 0.92, bumpMap: grainTexture(THREE, 5), bumpScale: 0.4 })));
    // Blocos de gelo no campo (meio enterrados na neve)
    const blockM = mat('#A8D8EA', 0.16, { transparent: true, opacity: 0.94, emissive: '#2B6F8C', emissiveIntensity: 0.35 });
    const capM = mat('#FBFDFD', 0.95);
    ICE_BLOCKS.forEach(([x, sy, r], i) => {
      const b = kit.mesh(new THREE.DodecahedronGeometry(r, 0), blockM, x, r * 0.15, zAt(sy));
      b.scale.set(1.35, 0.85 + (i % 3) * 0.2, 1);
      b.rotation.set(i * 0.7, i * 1.3, i * 0.4);
      root.add(b);
      const cap = kit.mesh(new THREE.SphereGeometry(r * 0.95, 14, 8, 0, TAU, 0, Math.PI / 2), capM, x - r * 0.1, r * 0.45, zAt(sy));
      cap.scale.set(1.25, 0.32, 0.95);
      root.add(cap);
    });
    // Gelo de pressão: uma faixa de placas quebradas, de pé e inclinadas em várias
    // direções (umas acendem no sol, outras ficam azuis), com neve acumulada por cima
    const slabM = mat('#E2F1F6', 0.35, { emissive: '#4F93AE', emissiveIntensity: 0.18 });
    const slabGeo = new THREE.BoxGeometry(1, 1, 1);
    const P = PRESSURE;
    let k = 0;
    for (let x = P.from; x <= P.to; x += P.step * (0.7 + hash(k, 1, 61) * 0.6), k++) {
      const big = hash(k, 2, 61);
      const w = 16 + big * 20;
      const h = 8 + big * 14;
      const z = zAt(P.line) + (hash(k, 3, 61) - 0.5) * 24;
      // Duas ou três placas encostadas umas nas outras
      const n = 2 + (big > 0.6 ? 1 : 0);
      for (let q = 0; q < n; q++) {
        const slab = kit.mesh(slabGeo, slabM, x + (q - (n - 1) / 2) * w * 0.45, h * 0.12, z + (hash(k, 8 + q, 61) - 0.5) * 8);
        slab.scale.set(w * (0.6 + hash(k, 12 + q, 61) * 0.4), h * (0.6 + hash(k, 16 + q, 61) * 0.5), 3 + hash(k, 4, 61) * 2);
        slab.rotation.set((hash(k, 5 + q, 61) - 0.5) * 0.8, (hash(k, 6 + q, 61) - 0.5) * 1.2, (q - (n - 1) / 2) * 0.5 + (hash(k, 7, 61) - 0.5) * 0.5);
        root.add(slab);
      }
      // Neve acumulada no pé (esconde a base das placas)
      const drift = kit.mesh(new THREE.SphereGeometry(1, 14, 6, 0, TAU, 0, Math.PI / 2), capM, x, -0.5, z + 2);
      drift.scale.set(w * 1.1, h * 0.38, 12);
      root.add(drift);
    }
    // Paredão de gelo da costa: colunas verticais irregulares, claro em cima e azul-escuro
    // embaixo (até abaixo da linha d'água)
    const wallBottom = -((BG_H - EDGE_TOP + 6) / C);
    const cTop = new THREE.Color('#F2FAFB');
    const cMid = new THREE.Color('#BFE0EA');
    const cLow = new THREE.Color('#5C9AB2');
    const nx = Math.ceil((W + 80) / 3) + 1;
    const ny = 12;
    const pos = [];
    const col = [];
    for (let j = 0; j < ny; j++) {
      const v = j / (ny - 1);
      const y = wallBottom * v;
      for (let i = 0; i < nx; i++) {
        const x = -40 + ((W + 80) * i) / (nx - 1);
        // Colunas facetadas: dente de serra em x (faces viradas para um lado e para o
        // outro, umas pegam o sol), com largura variando e um pouco de ruído
        const per = 11 + noise2(x * 0.02, 1, 45) * 9;
        const saw = Math.abs(((x / per) % 1 + 1) % 1 - 0.5) * 2;
        const column = saw * 4.5 + (noise2(x * 0.11, 0.5, 41) - 0.5) * 4 + (noise2(x * 0.45, v * 2, 43) - 0.5) * 1.6;
        const lip = Math.sin(x * 0.09) * 0.4;
        pos.push(x, y + (j === 0 ? lip : 0), zEdge + column + v * 1.5);
        const c = (v < 0.35 ? cTop.clone().lerp(cMid, v / 0.35) : cMid.clone().lerp(cLow, (v - 0.35) / 0.65));
        const str = noise2(x * 0.3, 7, 47);
        c.multiplyScalar(0.92 + str * 0.16);
        col.push(c.r, c.g, c.b);
      }
    }
    const idx = [];
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const wallGeo = new THREE.BufferGeometry();
    wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    wallGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    wallGeo.setIndex(idx);
    wallGeo.computeVertexNormals();
    // O gelo é translúcido: brilha azul por dentro mesmo do lado da sombra
    root.add(kit.mesh(wallGeo, vcol({ roughness: 0.22, emissive: '#3C8FB0', emissiveIntensity: 0.55 })));
    // Borda de neve arredondada por cima do paredão (um pouco para fora, ondulada)
    const lip = [];
    for (let x = -60; x <= W + 60; x += 32) {
      const k = noise2(x * 0.05, 3, 51);
      lip.push({ p: [x, 0.6 + k * 0.8, zEdge + 1.2], w: 2.6 + k * 1.4, h: 1.6 + k * 0.8 });
    }
    root.add(kit.sweep(lip, mat('#FDFEFE', 0.9, { emissive: '#A9CCDA', emissiveIntensity: 0.45 }), { radial: 12, cap: 0.5, steps: lip.length * 6 }));
    return { root };
  },
  apply() {},
};

// ---------------------------------------------------------------- Peças em lote
// Muitas cópias da mesma forma (pinheiros, tufos, pedras) num InstancedMesh só:
// items = [{ x, y, z, s (escala), sx/sy/sz?, rx/ry/rz?, color? }]
function instanced(THREE, geo, material, items, { shadow = true } = {}) {
  const m = new THREE.InstancedMesh(geo, material, items.length);
  const o = new THREE.Object3D();
  const c = new THREE.Color();
  items.forEach((it, i) => {
    o.position.set(it.x, it.y, it.z);
    o.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
    o.scale.set(it.s * (it.sx || 1), it.s * (it.sy || 1), it.s * (it.sz || 1));
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
    if (it.color) m.setColorAt(i, c.set(it.color));
  });
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

// Pinheiro em 4 partes (tronco e 3 saias de galhos), cada parte em lote. Altura ~1, pé em 0.
function pineParts(THREE) {
  const trunk = new THREE.CylinderGeometry(0.035, 0.05, 0.22, 6);
  trunk.translate(0, 0.11, 0);
  const tiers = [0, 1, 2].map((i) => {
    const r = 0.3 - i * 0.07;
    const h = 0.42 - i * 0.06;
    // Saia de galhos: cone com a borda franjada (raio irregular na borda de baixo)
    const g = new THREE.ConeGeometry(r, h, 9, 2);
    const p = g.getAttribute('position');
    for (let v = 0; v < p.count; v++) {
      const y = p.getY(v);
      if (y < -h / 2 + 0.001) {
        const a = Math.atan2(p.getZ(v), p.getX(v));
        const k = 1 + Math.sin(a * 9) * 0.12;
        p.setX(v, p.getX(v) * k);
        p.setZ(v, p.getZ(v) * k);
        p.setY(v, y - 0.03 * (1 - Math.cos(a * 9)) * 0.5);
      }
    }
    g.computeVertexNormals();
    g.translate(0, 0.18 + i * 0.22 + h / 2, 0);
    return g;
  });
  return { trunk, tiers };
}
function addPines(THREE, root, items, { leaf, bark }) {
  const P = pineParts(THREE);
  const barkM = new THREE.MeshStandardMaterial({ color: bark, roughness: 0.9 });
  const leafM = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.85 });
  root.add(instanced(THREE, P.trunk, barkM, items));
  // A cor de cada pinheiro varia; as saias de cima ficam um pouco mais claras
  const base = new THREE.Color(leaf);
  P.tiers.forEach((g, i) => {
    const tinted = items.map((it) => ({ ...it, color: base.clone().offsetHSL((it.hue || 0) * 0.04, 0, i * 0.03 + (it.light || 0) * 0.08) }));
    root.add(instanced(THREE, g, leafM, tinted));
  });
}

// Paredão/barranco da beira: grade em x × altura com ondulação e cor por vértice
function bankWall(THREE, { zEdge, step = 4, rows = 10, bulge, color }) {
  const wallBottom = -((BG_H - EDGE_TOP + 6) / C);
  const nx = Math.ceil((W + 80) / step) + 1;
  const pos = [];
  const col = [];
  const tmp = new THREE.Color();
  for (let j = 0; j < rows; j++) {
    const v = j / (rows - 1);
    for (let i = 0; i < nx; i++) {
      const x = -40 + ((W + 80) * i) / (nx - 1);
      pos.push(x, wallBottom * v, zEdge + bulge(x, v));
      color(tmp, x, v);
      col.push(tmp.r, tmp.g, tmp.b);
    }
  }
  const idx = [];
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return { geo: g, bottom: wallBottom };
}

// ---------------------------------------------------------------- Floresta
// Fase 10 (Floresta): morros ao longe cobertos de pinheiros (a névoa apaga os de
// trás), a mata fechada atrás da clareira, a clareira de grama ondulada com capim,
// florzinhas e manchas de terra, e o barranco de terra com pedras e raízes entrando no rio.
export const FOREST_HILLS = [
  { zc: 170, depth: 170, top: [88, 128], base: 205, seed: 5, freq: 0.004, tint: '#7FA8A0' },
  { zc: 360, depth: 120, top: [124, 152], base: 205, seed: 8, freq: 0.006, tint: '#5E8C7A' },
];
export const FOREST_EDGE = { line: SNOW_BACK + 2 };

function hillHeight(r, x, z) {
  const across = 1 - Math.abs(z - r.zc) / (r.depth / 2);
  const shape = Math.pow(Math.max(0, across), 0.8);
  const prof = fbm(x * r.freq, r.seed * 1.3, r.seed, 4);
  const topScreen = r.top[1] - (r.top[1] - r.top[0]) * Math.min(1, Math.max(0, (prof - 0.3) * 2.2));
  return yAt(r.base, z) + ((r.base - topScreen) / C) * shape;
}

// Altura da grama da clareira (a mesma para o chão e para os tufos em cima dele)
function meadow(x, z, zBack, zEdge) {
  const k = (z - zBack) / (zEdge - zBack);
  return (fbm(x * 0.009, z * 0.025, 71, 4) - 0.45) * (10 - k * 6) * Math.min(1, (1 - k) * 6);
}

export const forestScenery = {
  box: { left: 0, right: W, top: 0, bottom: -BG_H },
  res: 2,
  elevation: SCENE_EL,
  distance: 1300,
  poses: () => [{ key: 'main' }],
  stage: (studio) => studio.stageScenery({
    target: [640, 0, 480], size: 950, fog: { color: '#B9D3C8', near: 900, far: 1900 },
    sky: 0.9, ground: '#6E7C52', keyIntensity: 3.3, sun: [-0.78, 0.5, -0.25], exposure: 0.95,
  }),
  build(kit) {
    const { THREE, group, mat } = kit;
    const root = group();
    const vcol = (extra = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, ...extra });
    let seed = 1;
    const rnd = () => hash(seed++, 7, 101);
    // Morros e os pinheiros em cima deles (menores nos de trás)
    FOREST_HILLS.forEach((r, hi) => {
      const tint = new THREE.Color(r.tint);
      const geo = heightField(THREE, {
        x0: -140, x1: W + 140, z0: r.zc - r.depth / 2, z1: r.zc + r.depth / 2, dx: 8, dz: 6,
        h: (x, z) => hillHeight(r, x, z),
        colorAt: (c) => c.copy(tint).offsetHSL(0, 0, -0.08),
      });
      root.add(kit.mesh(geo, vcol()));
      const items = [];
      const n = hi === 0 ? 900 : 700;
      for (let i = 0; i < n; i++) {
        const x = -60 + rnd() * (W + 120);
        const z = r.zc - r.depth * 0.42 + rnd() * r.depth * 0.84;
        const y = hillHeight(r, x, z);
        if (y < yAt(r.base, z) + 2) continue; // só em cima do morro
        const s = (hi === 0 ? 16 : 24) * (0.7 + rnd() * 0.6);
        items.push({ x, y: y - 1, z, s, sy: 1.1 + rnd() * 0.4, ry: rnd() * TAU, hue: rnd() - 0.5, light: rnd() - 0.5 });
      }
      addPines(THREE, root, items, { leaf: hi === 0 ? '#4E7A66' : '#3E6F52', bark: '#3A2A1C' });
    });
    // Mata fechada atrás da clareira: três fileiras, as da frente maiores
    const edge = [];
    for (let row = 0; row < 3; row++) {
      const sy = FOREST_EDGE.line - row * 7;
      for (let x = -30; x < W + 30; x += (18 + row * 4) * (0.6 + rnd() * 0.8)) {
        const z = zAt(sy) - rnd() * 8;
        const s = (40 - row * 8) * (0.6 + rnd() * 0.7);
        edge.push({ x: x + (rnd() - 0.5) * 8, y: -2, z, s, sy: 1 + rnd() * 0.3, ry: rnd() * TAU, hue: rnd() - 0.5, light: rnd() - 0.2 - row * 0.2 });
      }
    }
    addPines(THREE, root, edge, { leaf: '#3A6E4E', bark: '#4A3424' });
    // Clareira: grama ondulada, mais clara no sol, manchas de terra batida
    const zBack = zAt(SNOW_BACK - 6);
    const zEdge = zAt(EDGE_TOP);
    const cG1 = new THREE.Color('#8DB65A');
    const cG2 = new THREE.Color('#5E8A38');
    const cDirt = new THREE.Color('#8A7046');
    const grass = heightField(THREE, {
      x0: -40, x1: W + 40, z0: zBack, z1: zEdge, dx: 6, dz: 5,
      h: (x, z) => meadow(x, z, zBack, zEdge),
      colorAt: (c, x, y, z) => {
        const n = fbm(x * 0.02, z * 0.05, 73, 3);
        c.copy(cG2).lerp(cG1, Math.min(1, n * 1.4));
        const dirt = fbm(x * 0.012, z * 0.06, 79, 3);
        if (dirt > 0.62) c.lerp(cDirt, Math.min(0.7, (dirt - 0.62) * 4));
      },
    });
    root.add(kit.mesh(grass, vcol({ bumpMap: grainTexture(THREE, 9), bumpScale: 0.6 })));
    // Tufos de capim (folhas em leque) e florzinhas espalhados na clareira
    const blade = new THREE.ConeGeometry(0.5, 4, 3);
    blade.translate(0, 2, 0);
    const tufts = [];
    const flowers = [];
    for (let i = 0; i < 1000; i++) {
      const x = -20 + rnd() * (W + 40);
      const z = zBack + 10 + rnd() * (zEdge - zBack - 14);
      const y = meadow(x, z, zBack, zEdge);
      for (let b = 0; b < 3; b++) {
        tufts.push({ x: x + (b - 1) * 0.8, y, z, s: 0.8 + rnd() * 0.7, rz: (b - 1) * 0.45, ry: rnd() * TAU, color: rnd() < 0.6 ? '#B2D872' : '#86B44E' });
      }
      if (i % 9 === 0) flowers.push({ x: x + 2, y: y + 2.2, z, s: 1, color: ['#FFF4C2', '#F7D25C', '#E9A6D8', '#FFFFFF'][i % 4] });
    }
    root.add(instanced(THREE, blade, new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.8 }), tufts, { shadow: false }));
    root.add(instanced(THREE, new THREE.SphereGeometry(1.1, 6, 4), new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.6 }), flowers, { shadow: false }));
    // Barranco de terra: mais escuro embaixo, entrando no rio
    // Cores mais claras que as do 2D: o barranco fica de costas para o sol
    const cTop = new THREE.Color('#D2A672');
    const cMid = new THREE.Color('#A87C4E');
    const cLow = new THREE.Color('#5E4428');
    const bank = bankWall(THREE, {
      zEdge,
      // Inclinado para trás (a base mais para a frente): pega a luz do céu
      bulge: (x, v) => (noise2(x * 0.06, v * 3, 81) - 0.5) * 5 + (noise2(x * 0.2, v * 6, 83) - 0.5) * 1.5 + v * 9,
      color: (c, x, v) => {
        if (v < 0.45) c.copy(cTop).lerp(cMid, v / 0.45);
        else c.copy(cMid).lerp(cLow, (v - 0.45) / 0.55);
        c.multiplyScalar(0.9 + noise2(x * 0.3, v * 8, 85) * 0.2);
      },
    });
    root.add(kit.mesh(bank.geo, vcol({ roughness: 0.95 })));
    // Pedras encravadas no barranco
    const stones = [];
    for (let x = -10; x < W + 10; x += 16 + rnd() * 34) {
      const v = 0.15 + rnd() * 0.55;
      stones.push({ x, y: bank.bottom * v, z: zEdge + 2 + v * 9, s: 4 + rnd() * 5, sy: 0.6 + rnd() * 0.3, sz: 0.7, ry: rnd() * TAU, rx: rnd(), color: rnd() < 0.5 ? '#8C8A7E' : '#6E6C62' });
    }
    root.add(instanced(THREE, new THREE.DodecahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.75, flatShading: true }), stones));
    // Raízes saindo do barranco (curvas que descem para a água)
    const rootM = mat('#4A3420', 0.9);
    for (let i = 0; i < 16; i++) {
      const x = hash(i, 3, 87) * W;
      const d = (hash(i, 4, 87) - 0.5) * 16;
      root.add(kit.sweep([
        { p: [x, 0, zEdge - 1], w: 1.4, h: 1.4 },
        { p: [x + d * 0.4, bank.bottom * 0.3, zEdge + 3.5], w: 1.1, h: 1.1 },
        { p: [x + d, bank.bottom * 0.75, zEdge + 2.5], w: 0.6, h: 0.6 },
      ], rootM, { radial: 8, cap: 0.6 }));
    }
    // Borda de grama por cima do barranco (um pouco para fora)
    const lip = [];
    for (let x = -60; x <= W + 60; x += 30) {
      const k = noise2(x * 0.05, 5, 89);
      lip.push({ p: [x, 0.4 + k * 0.8, zEdge + 1], w: 2.4 + k * 1.2, h: 1.5 + k * 0.6 });
    }
    root.add(kit.sweep(lip, mat('#6E9B44', 0.9), { radial: 10, cap: 0.5, steps: lip.length * 6 }));
    return { root };
  },
  apply() {},
};

// ---------------------------------------------------------------- Espaço (Lua)
// Fase 15 (Espaço): cordilheiras lunares recortadas, chão de regolito com crateras
// de verdade (bacia funda e borda elevada; com a câmera inclinada viram elipses,
// como no 2D), pedregulhos espalhados longe da base e o barranco de rocha entrando
// no rio de poeira estelar. Sem atmosfera: luz dura vinda da Terra (à esquerda),
// pouca luz de céu e sombras fortes; a névoa só escurece a cordilheira de trás.
export const MOON_RIDGES = [
  { zc: 150, depth: 150, peaks: [100, 150], base: 215, seed: 13, freq: 0.0062, tint: '#4B4862' },
  { zc: 330, depth: 130, peaks: [140, 178], base: 215, seed: 17, freq: 0.0078, tint: '#6E6A84' },
];
// Crateras do chão: [x, linha da tela, raio] (longe da base, que fica em IGLOO.x, e sem
// cruzar a linha onde o jogador anda)
export const CRATERS = [
  [60, 214, 30], [250, 228, 22], [395, 206, 34], [520, 234, 16], [640, 212, 26], [760, 226, 30], [865, 200, 16],
  [1245, 214, 20], [150, 236, 12], [300, 196, 12],
];
export const MOON_EDGE = { boulders: 14 };

// Altura de uma cratera no ponto (distância d em raios): bacia e borda
function craterAt(x, z, cx, cz, r, deep) {
  const d = Math.hypot(x - cx, z - cz) / r;
  if (d > 1.7) return 0;
  const bowl = d < 1 ? -deep * (1 - d * d) : 0;
  const rim = deep * 0.55 * Math.exp(-(((d - 1) / 0.22) ** 2));
  return bowl + rim;
}

export const spaceScenery = {
  box: { left: 0, right: W, top: 0, bottom: -BG_H },
  res: 2,
  elevation: SCENE_EL,
  distance: 1300,
  poses: () => [{ key: 'main' }],
  stage: (studio) => studio.stageScenery({
    target: [640, 0, 480], size: 950, fog: { color: '#2E2A48', near: 1000, far: 2300 },
    sky: 0.45, ground: '#4A4660', keyIntensity: 3.6, sun: [-0.8, 0.45, -0.2], exposure: 0.95,
  }),
  build(kit) {
    const { THREE, group, mat } = kit;
    const root = group();
    const vcol = (extra = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, ...extra });
    let seed = 1;
    const rnd = () => hash(seed++, 9, 131);
    // Cordilheiras lunares: cristas pontudas com faces em degraus, cinza-lilás
    for (const r of MOON_RIDGES) {
      const [pTop, pLow] = r.peaks;
      const tint = new THREE.Color(r.tint);
      const light = tint.clone().offsetHSL(0, 0, 0.18);
      const geo = heightField(THREE, {
        x0: -140, x1: W + 140, z0: r.zc - r.depth / 2, z1: r.zc + r.depth / 2, dx: 5, dz: 5,
        h: (x, z) => {
          const across = 1 - Math.abs(z - r.zc) / (r.depth / 2);
          const shape = Math.pow(Math.max(0, across), 1.05);
          const prof = ridged(x * r.freq, r.seed * 1.9, r.seed);
          const peakScreen = pLow - (pLow - pTop) * Math.min(1, prof * 1.3);
          const detail = (ridged(x * 0.03, z * 0.03, r.seed + 3, 3) - 0.4) * 9 * shape;
          return yAt(r.base, z) + ((r.base - peakScreen) / C) * shape + detail;
        },
        colorAt: (c, x, y, z, ny) => {
          c.copy(tint).lerp(light, Math.max(0, ny - 0.5) * 1.6);
          c.multiplyScalar(0.9 + fbm(x * 0.07, y * 0.07, r.seed + 7, 2) * 0.2);
        },
      });
      root.add(kit.mesh(geo, vcol()));
    }
    // Chão de regolito com crateras
    const zBack = zAt(SNOW_BACK);
    const zEdge = zAt(EDGE_TOP);
    const craters = CRATERS.map(([x, sy, r]) => ({ x, z: zAt(sy), r: r * 1.0, deep: r * 0.22 }));
    const cG = new THREE.Color('#B9B6C6');
    const cDark = new THREE.Color('#7E7A94');
    const cBright = new THREE.Color('#D6D3E2');
    const groundH = (x, z) => {
      const k = (z - zBack) / (zEdge - zBack);
      let y = (fbm(x * 0.01, z * 0.03, 141, 4) - 0.45) * (8 - k * 4) * Math.min(1, (1 - k) * 6);
      for (const c of craters) y += craterAt(x, z, c.x, c.z, c.r, c.deep);
      return y;
    };
    const ground = heightField(THREE, {
      x0: -40, x1: W + 40, z0: zBack, z1: zEdge, dx: 4, dz: 3,
      h: groundH,
      colorAt: (c, x, y, z, ny) => {
        c.copy(cG).lerp(cDark, Math.min(1, fbm(x * 0.015, z * 0.04, 143, 3) * 0.7));
        // Material claro jogado em volta das crateras (raios de ejeção)
        for (const cr of craters) {
          const d = Math.hypot(x - cr.x, z - cr.z) / cr.r;
          if (d > 1 && d < 2.4) c.lerp(cBright, (1 - (d - 1) / 1.4) * 0.35);
        }
        if (y < -1) c.multiplyScalar(0.92);
      },
    });
    root.add(kit.mesh(ground, vcol({ bumpMap: grainTexture(THREE, 13), bumpScale: 0.8 })));
    // Pedregulhos espalhados (longe da base) e pedrinhas
    const rocks = [];
    for (let i = 0; i < 70; i++) {
      const x = rnd() * W;
      if (Math.abs(x - IGLOO_X) < 190) continue;
      const z = zBack + 6 + rnd() * (zEdge - zBack - 12);
      const big = rnd() < 0.15;
      const s = big ? 5 + rnd() * 5 : 1.2 + rnd() * 2;
      rocks.push({ x, y: groundH(x, z) + s * 0.2, z, s, sy: 0.6 + rnd() * 0.4, rx: rnd() * 3, ry: rnd() * 3, color: rnd() < 0.5 ? '#9E9AB0' : '#837F98' });
    }
    root.add(instanced(THREE, new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.9, flatShading: true }), rocks));
    // Barranco de rocha: claro em cima, roxo-escuro embaixo, com blocos
    // Cores mais claras que as do 2D: o barranco fica de costas para a luz
    const cTop = new THREE.Color('#D8D4E8');
    const cMid = new THREE.Color('#A6A2BE');
    const cLow = new THREE.Color('#5A5478');
    const bank = bankWall(THREE, {
      zEdge, step: 4,
      bulge: (x, v) => (noise2(x * 0.08, v * 3, 151) - 0.5) * 6 + (noise2(x * 0.25, v * 6, 153) - 0.5) * 2 + v * 8,
      color: (c, x, v) => {
        if (v < 0.45) c.copy(cTop).lerp(cMid, v / 0.45);
        else c.copy(cMid).lerp(cLow, (v - 0.45) / 0.55);
        c.multiplyScalar(0.88 + noise2(x * 0.3, v * 8, 155) * 0.24);
      },
    });
    root.add(kit.mesh(bank.geo, vcol()));
    const blocks = [];
    for (let x = -10; x < W + 10; x += 14 + rnd() * 30) {
      const v = 0.1 + rnd() * 0.6;
      blocks.push({ x, y: bank.bottom * v, z: zEdge + 2 + v * 8, s: 4 + rnd() * 5, sy: 0.6 + rnd() * 0.4, sz: 0.7, rx: rnd() * 2, ry: rnd() * 3, color: rnd() < 0.5 ? '#B4B0C8' : '#9490AC' });
    }
    root.add(instanced(THREE, new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.85, flatShading: true }), blocks));
    // Borda clara de poeira por cima do barranco
    const lip = [];
    for (let x = -60; x <= W + 60; x += 30) {
      const k = noise2(x * 0.06, 7, 157);
      lip.push({ p: [x, 0.3 + k * 0.7, zEdge + 1], w: 2.2 + k * 1.2, h: 1.3 + k * 0.6 });
    }
    root.add(kit.sweep(lip, mat('#CFCCDC', 0.95), { radial: 10, cap: 0.5, steps: lip.length * 6 }));
    return { root };
  },
  apply() {},
};

// ---------------------------------------------------------------- Praia
// Fase 20 (Praia): mar aberto até o horizonte (superfície com ondulação, mais clara
// perto da areia), ilhas com relevo e coqueirinhos, a onda quebrando antes da areia
// (rolo de espuma), a areia com marcas do vento e montinhos, conchas espalhadas
// (longe da cabana) e a areia molhada e brilhante descendo para a água.
export const SEA_HORIZON = 150; // linha do horizonte (igual ao 2D)
export const ISLANDS = [
  // [x, largura, altura na tela] (como no 2D)
  [700, 120, 16], [880, 60, 9], [180, 80, 11],
];
export const BEACH_SAND_BACK = SHORE_TOP - 2; // onde a onda quebra e começa a areia
export const SHELLS = 26;

export const beachScenery = {
  box: { left: 0, right: W, top: 0, bottom: -BG_H },
  res: 2,
  elevation: SCENE_EL,
  distance: 1300,
  poses: () => [{ key: 'main' }],
  stage: (studio) => studio.stageScenery({
    target: [640, 0, 480], size: 950, fog: { color: '#CFEAF0', near: 1050, far: 2400 },
    sky: 1, ground: '#E8D6A8', keyIntensity: 3.2, sun: [-0.78, 0.5, -0.25], exposure: 0.95,
  }),
  build(kit) {
    const { THREE, group, mat } = kit;
    const root = group();
    const vcol = (extra = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, ...extra });
    let seed = 1;
    const rnd = () => hash(seed++, 11, 171);
    // Mar: do horizonte até debaixo da areia, ondulado, azul fundo ao longe e turquesa perto
    const zHor = zAt(SEA_HORIZON);
    const zSand = zAt(BEACH_SAND_BACK);
    const cFar = new THREE.Color('#2B8FB8');
    const cNear = new THREE.Color('#48C9D0');
    const sea = heightField(THREE, {
      x0: -40, x1: W + 40, z0: zHor, z1: zSand + 20, dx: 6, dz: 3,
      h: (x, z) => Math.sin(x * 0.05 + z * 0.4) * 0.35 + Math.sin(x * 0.11 - z * 0.25) * 0.25 + (fbm(x * 0.03, z * 0.08, 181, 3) - 0.5) * 0.8,
      colorAt: (c, x, y, z) => c.copy(cFar).lerp(cNear, Math.min(1, Math.max(0, (z - zHor) / (zSand - zHor)) ** 1.4)),
    });
    root.add(kit.mesh(sea, vcol({ roughness: 0.18, metalness: 0.1 })));
    // Ilhas: morrinhos verdes com faixa de areia e coqueirinhos
    const palmsT = [];
    const palmsL = [];
    ISLANDS.forEach(([x, w, hh], i) => {
      const z = zHor + 6 + i * 2;
      const isle = kit.mesh(new THREE.SphereGeometry(1, 28, 12, 0, TAU, 0, Math.PI / 2), mat('#3E8C6A', 0.85), x, 0, z);
      isle.scale.set(w / 2, hh / C, 14);
      root.add(isle);
      const sand = kit.mesh(new THREE.CylinderGeometry(1, 1.06, 1, 28), mat('#F2DFB0', 0.9), x, 0.3, z);
      sand.scale.set(w / 2 + 3, 1.2, 16);
      root.add(sand);
      // Coqueirinhos: tronco inclinado e copa de folhas
      for (let k = 0; k < Math.max(2, Math.round(w / 28)); k++) {
        const px = x + (rnd() - 0.5) * w * 0.6;
        const top = (hh / C) * (1 - ((px - x) / (w / 2)) ** 2);
        const ph = 10 + rnd() * 6;
        palmsT.push({ x: px, y: top * 0.8, z, s: 1, sy: ph, rz: (rnd() - 0.5) * 0.5 });
        palmsL.push({ x: px, y: top * 0.8 + ph * 0.95, z, s: 4 + rnd() * 1.5, sy: 0.35, ry: rnd() * TAU });
      }
    });
    const trunkG = new THREE.CylinderGeometry(0.4, 0.6, 1, 6);
    trunkG.translate(0, 0.5, 0);
    root.add(instanced(THREE, trunkG, mat('#7A5A3A', 0.9), palmsT));
    const crown = new THREE.ConeGeometry(1, 1, 7, 1, true);
    crown.rotateX(Math.PI);
    root.add(instanced(THREE, crown, new THREE.MeshStandardMaterial({ color: '#2F7E4A', roughness: 0.8, side: THREE.DoubleSide }), palmsL));
    // Onda quebrando: rolo de espuma ondulado na frente da areia e a água subindo nela
    const foam = [];
    for (let x = -60; x <= W + 60; x += 24) {
      const k = noise2(x * 0.03, 2, 183);
      foam.push({ p: [x, 0.8 + k * 0.8, zSand - 2 + Math.sin(x * 0.04) * 2], w: 1.6 + k, h: 1.2 + k * 0.6 });
    }
    root.add(kit.sweep(foam, mat('#FFFFFF', 0.6, { emissive: '#CFF4F4', emissiveIntensity: 0.35 }), { radial: 10, cap: 0.5, steps: foam.length * 6 }));
    // Areia: marcas do vento (ondinhas paralelas que o sol baixo realça) e montinhos
    const zEdge = zAt(EDGE_TOP);
    const cS1 = new THREE.Color('#FFE6B0');
    const cS2 = new THREE.Color('#F0C886');
    const sandH = (x, z) => {
      const k = (z - zSand) / (zEdge - zSand);
      const dune = (fbm(x * 0.008, z * 0.02, 187, 4) - 0.45) * (9 - k * 5) * Math.min(1, (1 - k) * 6);
      const ripples = Math.sin(x * 0.09 + z * 0.35 + fbm(x * 0.01, z * 0.02, 189, 2) * 8) * 0.45 * Math.min(1, (1 - k) * 4);
      return dune + ripples + Math.min(0, (k - 0.04) * 30) * 0.15;
    };
    const sandGeo = heightField(THREE, {
      x0: -40, x1: W + 40, z0: zSand, z1: zEdge, dx: 4, dz: 3,
      h: sandH,
      colorAt: (c, x, y, z) => c.copy(cS1).lerp(cS2, Math.min(1, fbm(x * 0.02, z * 0.05, 191, 3) * 0.9 + Math.max(0, (z - zSand) / (zEdge - zSand) - 0.6))),
    });
    root.add(kit.mesh(sandGeo, vcol({ bumpMap: grainTexture(THREE, 17), bumpScale: 0.5 })));
    // Conchas e estrelinhas-do-mar (longe da cabana)
    const shells = [];
    for (let i = 0; i < SHELLS; i++) {
      const x = rnd() * W;
      if (Math.abs(x - IGLOO_X) < 170) continue;
      const z = zSand + 20 + rnd() * (zEdge - zSand - 34);
      shells.push({ x, y: sandH(x, z) + 0.4, z, s: 2 + rnd() * 1.2, sy: 0.45, ry: rnd() * TAU, color: ['#F7B7A3', '#FFFFFF', '#F4D08A', '#F59A7A'][i % 4] });
    }
    root.add(instanced(THREE, new THREE.SphereGeometry(1, 10, 6), new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.4 }), shells));
    // Areia molhada descendo para a água (brilhante), com a cor do mar embaixo
    // Mais claras que as do 2D: a beira fica de costas para o sol
    const cTop = new THREE.Color('#FFF0C8');
    const cMid = new THREE.Color('#F0D29A');
    const cLow = new THREE.Color('#9EE2DE');
    const bank = bankWall(THREE, {
      zEdge, step: 6, rows: 8,
      bulge: (x, v) => (noise2(x * 0.04, v * 2, 193) - 0.5) * 3 + v * 30,
      color: (c, x, v) => {
        if (v < 0.5) c.copy(cTop).lerp(cMid, v / 0.5);
        else c.copy(cMid).lerp(cLow, (v - 0.5) / 0.5);
      },
    });
    root.add(kit.mesh(bank.geo, vcol({ roughness: 0.35 })));
    return { root };
  },
  apply() {},
};

// ---------------------------------------------------------------- Halloween
// Fase 25 (Halloween): noite de lua cheia. Morros escuros com relevo e árvores secas
// de galhos retorcidos, o casarão ao longe (torre, telhados e janelas acesas) no alto do
// morro, a cerca de ferro com lanças, lápides de pedra com "RIP" gravado e cruzes (as
// mesmas posições do 2D) com o montinho da cova, gramado escuro com folhas secas e o
// barranco de terra na beira do rio. Luar frio vindo da esquerda (onde fica a lua).
export const HAUNT_HILLS = [
  { zc: 230, depth: 200, top: [118, 150], base: 205, seed: 23, freq: 0.0055, tint: '#3A2A4C' },
  // Cordilheira do fundo: mais alta, mais clara e azulada pela névoa da noite
  { zc: 70, depth: 160, top: [80, 118], base: 190, seed: 31, freq: 0.0042, tint: '#4A4272' },
];
export const MANSION = { x: 805, base: SHORE_TOP - 26 };
export const DEAD_TREES_FAR = [[560, 0.7], [690, 0.5], [930, 0.6], [1220, 0.8]];
export const FENCE = { from: 60, to: 700, line: SHORE_TOP + 8, step: 14 };

// Árvore seca: tronco e galhos retorcidos em peças contínuas (altura ~60·s, pé em 0)
function deadTreeParts(kit, x, y, z, s, m, seed) {
  const g = kit.group(x, y, z);
  const H = 60 * s / C;
  g.add(kit.sweep([
    { p: [0, -2, 0], w: 3 * s, h: 3 * s },
    { p: [1 * s, H * 0.5, 0], w: 2 * s, h: 2 * s },
    { p: [2 * s, H, 0], w: 0.7 * s, h: 0.7 * s },
  ], m, { radial: 8, cap: 0.5 }));
  [[-0.9, 28], [0.7, 24], [-0.4, 18], [1.1, 16]].forEach(([a, l], i) => {
    const by = H * (0.45 + i * 0.13);
    const L = (l * s) / C;
    const tw = (hash(i, 1, seed) - 0.5) * 6 * s;
    g.add(kit.sweep([
      { p: [1 * s, by, 0], w: 1.3 * s, h: 1.3 * s },
      { p: [1 * s + Math.sin(a) * L * 0.55, by + Math.cos(a) * L * 0.5, tw], w: 0.9 * s, h: 0.9 * s },
      { p: [1 * s + Math.sin(a) * L, by + Math.cos(a) * L * 0.85 - L * 0.1, tw * 1.5], w: 0.35 * s, h: 0.35 * s },
    ], m, { radial: 6, cap: 0.5 }));
  });
  return g;
}

// Lápide arredondada com "RIP" e a linha gravados na frente (textura com relevo)
function graveTexture(THREE, w, H) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 96;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 64, 0);
  grd.addColorStop(0, '#B4B0C4');
  grd.addColorStop(1, '#8C889E');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 96);
  for (let i = 0; i < 160; i++) {
    g.fillStyle = i % 2 ? 'rgba(60, 56, 76, 0.25)' : 'rgba(255, 255, 255, 0.15)';
    g.fillRect(hash(i, 1, 5) * 64, hash(i, 2, 5) * 96, 2, 2);
  }
  g.fillStyle = 'rgba(40, 36, 56, 0.8)';
  g.font = '700 18px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText('RIP', 32, 30);
  g.fillRect(16, 46, 32, 3);
  g.fillRect(20, 56, 24, 2);
  // Musgo no pé
  g.fillStyle = 'rgba(70, 110, 70, 0.6)';
  g.fillRect(0, 86, 64, 10);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  // UV da frente da peça extrudada = coordenadas da forma (x de −w/2 a w/2, y de 0 a H)
  t.repeat.set(1 / w, 1 / H);
  t.offset.set(0.5, 0);
  return t;
}

export const halloweenScenery = {
  box: { left: 0, right: W, top: 0, bottom: -BG_H },
  res: 2,
  elevation: SCENE_EL,
  distance: 1300,
  poses: () => [{ key: 'main' }],
  stage: (studio) => studio.stageScenery({
    target: [640, 0, 480], size: 950, fog: { color: '#34284E', near: 950, far: 2100 },
    sky: 0.75, skyColor: '#8A7CC4', ground: '#262034', keyIntensity: 3.1, keyColor: '#D8D2FF',
    // Luar da esquerda e um pouco de frente: as lápides e o casarão aparecem (de costas
    // para a lua ficariam só silhuetas)
    sun: [-0.62, 0.6, 0.45], exposure: 1.2,
  }),
  build(kit) {
    const { THREE, group, mat } = kit;
    const root = group();
    const vcol = (extra = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, ...extra });
    let seed = 1;
    const rnd = () => hash(seed++, 13, 211);
    const bark = mat('#2A1E2C', 0.9);
    // Morros: o da frente e a cordilheira do fundo, com cristas de rocha (mais claras no
    // alto e no íngreme) e manchas de mato seco
    const rock = new THREE.Color('#6A6286');
    const scrub = new THREE.Color('#2A3428');
    HAUNT_HILLS.forEach((r, ri) => {
      const tint = new THREE.Color(r.tint);
      root.add(kit.mesh(heightField(THREE, {
        x0: -160, x1: W + 160, z0: r.zc - r.depth / 2, z1: r.zc + r.depth / 2, dx: 6, dz: 5,
        h: (x, z) => hillHeight(r, x, z) + (fbm(x * 0.06, z * 0.08, 241 + ri, 3) - 0.5) * 4,
        colorAt: (c, x, y, z) => {
          c.copy(tint).multiplyScalar(0.8 + fbm(x * 0.02, z * 0.03, 213 + ri, 3) * 0.35);
          const high = Math.min(1, Math.max(0, (y - yAt(r.base, z)) / ((r.base - r.top[0]) / C)));
          c.lerp(rock, Math.max(0, high - 0.45) * 0.9 * fbm(x * 0.05, z * 0.05, 243 + ri, 2));
          if (ri === 0) c.lerp(scrub, Math.max(0, fbm(x * 0.03, z * 0.04, 245, 3) - 0.5) * 1.2);
        },
      }), vcol({ bumpMap: grainTexture(THREE, 23 + ri), bumpScale: 0.8 })));
    });
    const r = HAUNT_HILLS[0];
    const far = HAUNT_HILLS[1];
    // Arvorezinhas secas na cordilheira do fundo
    for (let i = 0; i < 16; i++) {
      const x = 30 + i * 80 + rnd() * 40;
      const z = far.zc - 30 + rnd() * 40;
      root.add(deadTreeParts(kit, x, hillHeight(far, x, z) - 2, z, 0.45 + rnd() * 0.3, bark, 60 + i));
    }
    // Pedras nos morros
    const boulders = [];
    for (let i = 0; i < 70; i++) {
      const x = rnd() * W;
      const z = r.zc - r.depth * 0.35 + rnd() * r.depth * 0.7;
      boulders.push({ x, y: hillHeight(r, x, z) - 1, z, s: 3 + rnd() * 5, sy: 0.6 + rnd() * 0.4, ry: rnd() * TAU, color: rnd() < 0.5 ? '#5A5470' : '#463E58' });
    }
    root.add(instanced(THREE, new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.9 }), boulders));
    // Árvores secas em cima dos morros
    DEAD_TREES_FAR.forEach(([x, s], i) => {
      const z = r.zc + 20;
      root.add(deadTreeParts(kit, x, hillHeight(r, x, z) - 2, z, s * 1.1, bark, 30 + i));
    });
    // Casarão ao longe, no alto do morro: corpo, telhado de duas águas, torre com
    // pináculo e as janelas acesas
    const mz = r.zc + 30;
    const my = yAt(MANSION.base, mz);
    const house = group(MANSION.x, my, mz);
    root.add(house);
    const wall = mat('#2C2036', 0.85);
    const roofM = mat('#1A1222', 0.8);
    const lit = mat('#FFD86A', 0.4, { emissive: '#FFC040', emissiveIntensity: 1.6 });
    const hb = 50 / C;
    house.add(kit.mesh(new THREE.BoxGeometry(70, hb, 34), wall, -18, hb / 2, 0));
    const roofShape = new THREE.Shape([new THREE.Vector2(-40, 0), new THREE.Vector2(40, 0), new THREE.Vector2(0, 26 / C)]);
    const roof = kit.mesh(new THREE.ExtrudeGeometry(roofShape, { depth: 38, bevelEnabled: false }), roofM, -18, hb, -19);
    house.add(roof);
    const tb = 78 / C;
    house.add(kit.mesh(new THREE.BoxGeometry(22, tb, 22), wall, 26, tb / 2, 2));
    const spire = kit.mesh(new THREE.ConeGeometry(15, 22 / C, 4), roofM, 26, tb + 11 / C, 2);
    spire.rotation.y = Math.PI / 4;
    house.add(spire);
    for (const [x, y, w, h] of [[-15, 14, 7, 8], [-36, 14, 7, 8], [26, 52, 6, 7], [2, 14, 6, 8]]) {
      house.add(kit.mesh(new THREE.BoxGeometry(w, h / C, 0.6), y > 40 && x < 0 ? wall : lit, x, y / C, x > 20 ? 13.2 : 17.2));
    }
    // Molduras das janelas, janelas do andar de cima (uma acesa, outras escuras),
    // chaminé, varanda com colunas e degraus, e faixa de madeira entre os andares
    const trim = mat('#4A3A56', 0.8);
    const darkWin = mat('#120C18', 0.5);
    for (const [x, y, w, h, on] of [[-15, 14, 7, 8], [-36, 14, 7, 8], [2, 14, 6, 8], [-36, 34, 6, 7, 1], [-15, 34, 6, 7, 0], [2, 34, 6, 7, 0]]) {
      house.add(kit.mesh(new THREE.BoxGeometry(w + 2.4, (h + 2.4) / C, 0.8), trim, x, y / C, 17));
      if (on != null) house.add(kit.mesh(new THREE.BoxGeometry(w, h / C, 0.6), on ? lit : darkWin, x, y / C, 17.3));
    }
    house.add(kit.mesh(new THREE.BoxGeometry(72, 1.6 / C, 36), trim, -18, 25 / C, 0));
    house.add(kit.mesh(new THREE.BoxGeometry(8, 26 / C, 8), wall, -44, hb + 10 / C, -6));
    house.add(kit.mesh(new THREE.BoxGeometry(30, 2 / C, 10), roofM, -10, 20 / C, 22));
    for (const x of [-22, 2]) house.add(kit.mesh(new THREE.CylinderGeometry(0.9, 0.9, 19 / C, 6), trim, x, 9.5 / C, 25));
    for (let i = 0; i < 3; i++) house.add(kit.mesh(new THREE.BoxGeometry(14 + i * 4, 1.4 / C, 3), mat('#3A3446', 0.9), -10, (0.7 + i * 1.4) / C, 28 + (2 - i) * 2.5));
    // Gramado do cemitério: montinhos, mais escuro na frente
    const zBack = zAt(SNOW_BACK - 4);
    const zEdge = zAt(EDGE_TOP);
    const cG1 = new THREE.Color('#566A58');
    const cG2 = new THREE.Color('#34443A');
    const dirt = new THREE.Color('#5A4A44');
    const lawnH = (x, z) => {
      const k = (z - zBack) / (zEdge - zBack);
      let y = (fbm(x * 0.012, z * 0.03, 217, 4) - 0.45) * (8 - k * 5) * Math.min(1, (1 - k) * 6);
      // Montinho de terra de cada cova, na frente da lápide
      for (const gr of GRAVES) {
        const dz = (z - (zAt(gr.y) + 14)) / 11;
        const dx = (x - gr.x) / (gr.w * 0.75);
        const d = dx * dx + dz * dz;
        if (d < 1) y += (1 - d) * 3.2;
      }
      return y;
    };
    root.add(kit.mesh(heightField(THREE, {
      x0: -40, x1: W + 40, z0: zBack, z1: zEdge, dx: 5, dz: 4,
      h: lawnH,
      colorAt: (c, x, y, z) => {
        c.copy(cG1).lerp(cG2, Math.min(1, (z - zBack) / (zEdge - zBack) + fbm(x * 0.03, z * 0.06, 219, 2) * 0.4));
        // Trilha de terra batida e manchas de terra onde a grama não cresce
        const pathZ = zBack + (zEdge - zBack) * (0.45 + Math.sin(x * 0.006) * 0.12);
        const onPath = Math.max(0, 1 - Math.abs(z - pathZ) / 7) * (0.7 + fbm(x * 0.08, z * 0.1, 247, 2) * 0.5);
        c.lerp(dirt, Math.min(1, onPath + Math.max(0, fbm(x * 0.025, z * 0.05, 249, 3) - 0.62) * 2));
      },
    }), vcol({ bumpMap: grainTexture(THREE, 21), bumpScale: 0.9 })));
    // Capim em tufos (menos onde há trilha e covas), pedrinhas e moitas secas
    const blade = new THREE.ConeGeometry(0.45, 4.5, 3);
    blade.translate(0, 2.25, 0);
    const tufts = [];
    const pebbles = [];
    const shrubs = [];
    const nearGrave = (x, z) => GRAVES.some((gr) => Math.abs(x - gr.x) < gr.w * 0.8 && Math.abs(z - (zAt(gr.y) + 6)) < 14);
    for (let i = 0; i < 1100; i++) {
      const x = rnd() * W;
      const z = zBack + 6 + rnd() * (zEdge - zBack - 10);
      if (nearGrave(x, z)) continue;
      const y = lawnH(x, z);
      for (let b = 0; b < 3; b++) {
        tufts.push({ x: x + (b - 1) * 0.9, y, z, s: 0.7 + rnd() * 0.8, rz: (b - 1) * 0.5, ry: rnd() * TAU, color: rnd() < 0.5 ? '#6A7A5C' : '#4C5C44' });
      }
    }
    for (let i = 0; i < 220; i++) {
      const x = rnd() * W;
      const z = zBack + 6 + rnd() * (zEdge - zBack - 10);
      pebbles.push({ x, y: lawnH(x, z), z, s: 0.8 + rnd() * 1.6, sy: 0.6, ry: rnd() * TAU, color: rnd() < 0.5 ? '#8A849A' : '#6E6880' });
    }
    for (let i = 0; i < 26; i++) {
      const x = rnd() * W;
      const z = zBack + 4 + rnd() * 20;
      if (nearGrave(x, z) || Math.abs(x - IGLOO_X) < 160) continue;
      shrubs.push({ x, y: lawnH(x, z), z, s: 5 + rnd() * 5, sy: 0.7, ry: rnd() * TAU, color: rnd() < 0.5 ? '#3A2E2A' : '#4A3A30' });
    }
    root.add(instanced(THREE, blade, new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.85 }), tufts, { shadow: false }));
    root.add(instanced(THREE, new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.9 }), pebbles, { shadow: false }));
    const shrubGeo = new THREE.IcosahedronGeometry(1, 1);
    const sp = shrubGeo.getAttribute('position');
    for (let v = 0; v < sp.count; v++) {
      const k = 0.7 + hash(v, 7, 251) * 0.6;
      sp.setXYZ(v, sp.getX(v) * k, Math.max(0, sp.getY(v)) * k, sp.getZ(v) * k);
    }
    shrubGeo.computeVertexNormals();
    root.add(instanced(THREE, shrubGeo, new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.95 }), shrubs));
    // Cerca de ferro: postes com ponta de lança e duas travessas
    const iron = new THREE.MeshStandardMaterial({ color: '#141018', roughness: 0.45, metalness: 0.5 });
    const fz = zAt(FENCE.line);
    const postH = 30 / C;
    const posts = [];
    const tips = [];
    for (let x = FENCE.from + 4; x <= FENCE.to; x += FENCE.step) {
      const lean = (hash(x, 3, 223) - 0.5) * 0.08;
      posts.push({ x, y: postH / 2 - 1, z: fz, s: 1, sy: postH, rz: lean });
      tips.push({ x: x - lean * postH / 2, y: postH + 2, z: fz, s: 1, rz: lean });
    }
    root.add(instanced(THREE, new THREE.CylinderGeometry(0.9, 0.9, 1, 6), iron, posts));
    root.add(instanced(THREE, new THREE.ConeGeometry(2.2, 6, 4), iron, tips));
    for (const y of [postH * 0.2, postH * 0.75]) {
      const bar = kit.mesh(new THREE.BoxGeometry(FENCE.to - FENCE.from, 1.6, 1.2), iron, (FENCE.from + FENCE.to) / 2 + 4, y, fz);
      root.add(bar);
    }
    const pillar = mat('#6E6880', 0.92);
    for (const x of [FENCE.from - 2, FENCE.to + 10]) {
      root.add(kit.mesh(new THREE.BoxGeometry(9, postH + 6, 9), pillar, x, (postH + 6) / 2 - 1, fz));
      root.add(kit.mesh(new THREE.BoxGeometry(12, 2.4, 12), pillar, x, postH + 6, fz));
      root.add(kit.mesh(new THREE.SphereGeometry(3.4, 12, 8), pillar, x, postH + 9.5, fz));
    }
    // Lápides e cruzes (as mesmas do 2D), um pouco tortas
    const stoneSide = mat('#7C788E', 0.85);
    GRAVES.forEach((gr, i) => {
      const z = zAt(gr.y);
      const H = gr.h / C;
      const tilt = (hash(i, 5, 227) - 0.5) * 0.14;
      if (gr.cross) {
        const cm = mat('#9A96AC', 0.8);
        const cr = group(gr.x, 0, z);
        cr.rotation.z = tilt;
        cr.add(kit.mesh(new THREE.BoxGeometry(6, H, 5), cm, 0, H / 2 - 1, 0));
        cr.add(kit.mesh(new THREE.BoxGeometry(20, 6 / C, 5), cm, 0, H - 10 / C, 0));
        root.add(cr);
        return;
      }
      const w = gr.w;
      const sh = new THREE.Shape();
      sh.moveTo(-w / 2, 0);
      sh.lineTo(-w / 2, H - w / 2);
      sh.absarc(0, H - w / 2, w / 2, Math.PI, 0, true);
      sh.lineTo(w / 2, 0);
      sh.closePath();
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 6, bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.8, bevelSegments: 2, curveSegments: 16 });
      const face = new THREE.MeshStandardMaterial({ map: graveTexture(THREE, w, H), roughness: 0.85 });
      const slab = kit.mesh(geo, [face, stoneSide], gr.x, -1.5, z - 3);
      slab.rotation.z = tilt;
      slab.rotation.x = -tilt * 0.6;
      root.add(slab);
    });
    // Folhas secas espalhadas no gramado
    const leaves = [];
    for (let i = 0; i < 260; i++) {
      const x = rnd() * W;
      const z = zBack + 8 + rnd() * (zEdge - zBack - 14);
      leaves.push({ x, y: lawnH(x, z) + 0.3, z, s: 2.2 + rnd() * 1.2, sy: 0.25, sz: 0.55, ry: rnd() * TAU, color: ['#A0522D', '#C8742A', '#7A4A2A'][i % 3] });
    }
    root.add(instanced(THREE, new THREE.SphereGeometry(1, 8, 4), new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.8 }), leaves, { shadow: false }));
    // Barranco de terra escura na beira do rio
    const cTop = new THREE.Color('#8A6E5E');
    const cMid = new THREE.Color('#62504A');
    const cLow = new THREE.Color('#34262E');
    const bank = bankWall(THREE, {
      zEdge, step: 5,
      bulge: (x, v) => (noise2(x * 0.07, v * 3, 229) - 0.5) * 5 + v * 10,
      color: (c, x, v) => {
        if (v < 0.45) c.copy(cTop).lerp(cMid, v / 0.45);
        else c.copy(cMid).lerp(cLow, (v - 0.45) / 0.55);
        c.multiplyScalar(0.88 + noise2(x * 0.3, v * 8, 231) * 0.24);
      },
    });
    root.add(kit.mesh(bank.geo, vcol()));
    const lip = [];
    for (let x = -60; x <= W + 60; x += 30) {
      const k = noise2(x * 0.05, 9, 233);
      lip.push({ p: [x, 0.4 + k * 0.7, zEdge + 1], w: 2.2 + k, h: 1.4 + k * 0.5 });
    }
    root.add(kit.sweep(lip, mat('#2E3A32', 0.9), { radial: 10, cap: 0.5, steps: lip.length * 6 }));
    return { root };
  },
  apply() {},
};

// ---------------------------------------------------------------- Dinossauros
// Fase 30 (Dinossauros): os dois vulcões do 2D (cone de flancos côncavos com sulcos de
// erosão, cratera com lava brilhando e os escorridos de lava descendo pela frente; as
// crateras caem onde o 2D solta a fumaça), morros de mata com cicas e moitas, chão de
// terra vulcânica com musgo, pedrinhas e brotos de samambaia (longe do ninho, das
// samambaias gigantes e da caverna) e o barranco de colunas de basalto com rachaduras
// de lava acesas. Sol quente e baixo da esquerda (onde fica o sol do céu).
export const VOLCANO_BASE = SHORE_TOP + 6; // pé dos vulcões no 2D
export const VOLCANO_Z = [120, 180]; // profundidade de cada vulcão (o maior mais ao fundo)
export const VOLCANO_RIM = 0.24; // raio da cratera (fração do raio do cone), como no 2D
export const DINO_HILLS = [
  { zc: 330, depth: 150, top: [SHORE_TOP - 44, SHORE_TOP - 16], base: SHORE_TOP + 4, seed: 31, freq: 0.006, tint: '#3E5030' },
];
export const CYCADS_FAR = [[90, 0.7], [330, 0.6], [470, 0.8], [720, 0.55], [990, 0.7], [1210, 0.65]];
// Lugares da costa sem pedras nem brotos (ninho, samambaias gigantes e a caverna)
const DINO_CLEAR = [[NEST.x, 50], ...TREE_FERNS.map((f) => [f.x, 40]), [IGLOO_X, 190]];
export const dinoClear = (x) => DINO_CLEAR.every(([cx, r]) => Math.abs(x - cx) > r);

// Cone do vulcão v (i = índice): altura do terreno no ponto (x, z)
export function volcanoAt(v, i) {
  const zc = VOLCANO_Z[i];
  const R = v.w * 0.66;
  const Rz = R * 0.7;
  const yb = yAt(VOLCANO_BASE, zc);
  const yp = yAt(VOLCANO_BASE - v.h, zc);
  const dip = 7;
  const h = (x, z) => {
    const dx = (x - v.x) / R;
    const dz = (z - zc) / Rz;
    const d = Math.hypot(dx, dz);
    const a = Math.atan2(dz, dx);
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    // Borda da cratera irregular (dentes e quebras)
    const jag = (noise2(ca * 4 + i * 3, sa * 4, 61 + i) - 0.5) * 9;
    if (d < VOLCANO_RIM) return yp - dip * (1 - (d / VOLCANO_RIM) ** 2) + jag * (d / VOLCANO_RIM) ** 4;
    const t = (d - VOLCANO_RIM) / (1 - VOLCANO_RIM);
    if (t > 1) return yb - (t - 1) * 60;
    // Cristas e sulcos de erosão descendo da borda (ruído em volta, sem emenda no
    // ângulo; mais fundos no meio da encosta), calombos de lava velha e a borda quebrada
    const env = Math.min(1, t * 4) * Math.pow(1 - t, 0.6);
    const ridges = (ridged(ca * 9 + i * 7, sa * 9 + d * 2.2, 41 + i, 4) - 0.45) * 26 * env;
    const lumps = (fbm(x * 0.05, z * 0.05, 71 + i, 3) - 0.5) * 8 * (1 - t * 0.5);
    return yb + (yp - yb) * Math.pow(1 - t, 2.1) + ridges + lumps + jag * Math.max(0, 1 - t * 5);
  };
  return { h, zc, R, Rz, yp, dip };
}

// Folha de cica / samambaia: arqueada para fora e para baixo, comprimento 1, em +x
function frondGeometry(THREE) {
  return sweepGeometry(THREE, [
    { p: [0, 0, 0], w: 0.04, h: 0.012 },
    { p: [0.35, 0.22, 0], w: 0.11, h: 0.014 },
    { p: [0.7, 0.2, 0], w: 0.09, h: 0.012 },
    { p: [1, 0.02, 0], w: 0.02, h: 0.01 },
  ], { radial: 6, cap: 0.3, steps: 14 });
}

export const dinoScenery = {
  box: { left: 0, right: W, top: 0, bottom: -BG_H },
  res: 2,
  elevation: SCENE_EL,
  distance: 1300,
  poses: () => [{ key: 'main' }],
  stage: (studio) => studio.stageScenery({
    target: [640, 0, 480], size: 950, fog: { color: '#8A4A3A', near: 1300, far: 2900 },
    sky: 0.5, skyColor: '#E0A080', ground: '#3A2420', keyIntensity: 3.6, keyColor: '#FFD0A0',
    // Sol baixo bem de lado: um lado dos vulcões aceso e o outro na sombra
    sun: [-0.86, 0.42, 0.05], exposure: 1.0,
  }),
  build(kit) {
    const { THREE, group, mat } = kit;
    const root = group();
    const vcol = (extra = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, ...extra });
    let seed = 1;
    const rnd = () => hash(seed++, 17, 307);
    const rockTex = grainTexture(THREE, 47);
    rockTex.repeat.set(6, 6);
    const lava = new THREE.MeshStandardMaterial({ color: '#E8601C', emissive: '#FF4A08', emissiveIntensity: 1.3, roughness: 0.5 });
    // Vulcões
    VOLCANOES.forEach((v, i) => {
      const V = volcanoAt(v, i);
      const cRock = new THREE.Color('#6A4A44');
      const cDark = new THREE.Color('#2E2224');
      const cAsh = new THREE.Color('#9A8478');
      const cHot = new THREE.Color('#C0482A');
      root.add(kit.mesh(heightField(THREE, {
        x0: v.x - V.R * 1.5, x1: v.x + V.R * 1.5, z0: V.zc - V.Rz * 1.5, z1: V.zc + V.Rz * 1.5, dx: 2, dz: 2,
        h: V.h,
        colorAt: (c, x, y, z, ny) => {
          const d = Math.hypot((x - v.x) / V.R, (z - V.zc) / V.Rz);
          // Rocha escura nos sulcos e paredes íngremes, cinza de cinzas no alto das
          // cristas e na parte de cima do cone, brasa na boca
          c.copy(cRock).lerp(cDark, Math.min(1, Math.max(0, 0.85 - ny) * 2.2));
          c.lerp(cAsh, Math.min(0.7, Math.max(0, fbm(x * 0.05, z * 0.05, 51 + i, 3) - 0.5) * 1.6 + Math.max(0, 0.6 - d) * 0.6));
          if (d < VOLCANO_RIM * 1.5) c.lerp(cHot, Math.max(0, 1 - d / (VOLCANO_RIM * 1.5)) * 0.85);
        },
      }), vcol({ bumpMap: rockTex, bumpScale: 1.6 })));
      // Pedregulhos de lava velha nas encostas
      const boulders = [];
      for (let k = 0; k < 40; k++) {
        // Só na frente da encosta (atrás, apareceriam como bolotas no contorno)
        const a = 0.35 + rnd() * (Math.PI - 0.7);
        const d = VOLCANO_RIM + 0.15 + rnd() * 0.6;
        const x = v.x + Math.cos(a) * d * V.R;
        const z = V.zc + Math.sin(a) * d * V.Rz;
        const sz = 1.5 + rnd() * 2.5;
        boulders.push({ x, y: V.h(x, z), z, s: sz, sy: 0.7, rx: rnd() * 3, ry: rnd() * 3, color: rnd() < 0.5 ? '#3A2C2C' : '#56403A' });
      }
      root.add(instanced(THREE, new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.9, flatShading: true }), boulders));
      // Lava na cratera
      const pool = kit.mesh(new THREE.CircleGeometry(1, 24), lava, v.x, V.yp - V.dip * 0.55, V.zc);
      pool.rotation.x = -Math.PI / 2;
      pool.scale.set(V.R * VOLCANO_RIM * 0.85, V.Rz * VOLCANO_RIM * 0.85, 1);
      root.add(pool);
      // Escorridos de lava descendo pela frente (os mesmos 3 do 2D)
      for (const [dx, len, bend] of [[-0.5, 0.55, -10], [0.3, 0.4, 8], [0.8, 0.3, 6]]) {
        const pts = [];
        const d1 = VOLCANO_RIM + len * 0.6 * (1 - VOLCANO_RIM) * (i ? 0.8 : 1);
        for (let k = 0; k <= 8; k++) {
          const d = VOLCANO_RIM * 0.95 + (d1 - VOLCANO_RIM * 0.95) * (k / 8);
          const a = dx * 0.4 + bend * 0.018 * (k / 8) + Math.sin(k * 1.4 + dx * 5) * 0.05;
          const x = v.x + Math.sin(a) * d * V.R;
          const z = V.zc + Math.cos(a) * d * V.Rz;
          pts.push({ p: [x, V.h(x, z) + 0.4, z], w: 2.4 * (1 - (k / 8) * 0.75), h: 0.6 });
        }
        root.add(kit.sweep(pts, lava, { radial: 8, cap: 0.5 }));
      }
    });
    // Morros de mata
    const r = DINO_HILLS[0];
    const tint = new THREE.Color(r.tint);
    const dark = new THREE.Color('#26341E');
    root.add(kit.mesh(heightField(THREE, {
      x0: -140, x1: W + 140, z0: r.zc - r.depth / 2, z1: r.zc + r.depth / 2, dx: 6, dz: 5,
      h: (x, z) => hillHeight(r, x, z),
      colorAt: (c, x, y, z) => c.copy(tint).lerp(dark, fbm(x * 0.03, z * 0.04, 311, 3) * 0.8),
    }), vcol()));
    // Cicas (tronco e coroa de folhas) e moitas nos morros
    const cycads = CYCADS_FAR.map(([x, s]) => ({ x, s: s * 1.25 }));
    for (let i = 0; i < 46; i++) cycads.push({ x: rnd() * W, s: 0.35 + rnd() * 0.4 });
    const trunks = [];
    const crowns = [];
    for (const cy of cycads) {
      const z = r.zc + (rnd() - 0.3) * 40;
      const y = hillHeight(r, cy.x, z) - 1;
      const H = (46 * cy.s) / C;
      trunks.push({ x: cy.x, y: y + H / 2, z, s: 1, sx: 3.2 * cy.s, sy: H, sz: 3.2 * cy.s, rz: (rnd() - 0.5) * 0.12 });
      crowns.push({ x: cy.x + 1, y: y + H, z, s: 30 * cy.s, ry: rnd() * TAU, hue: rnd() });
    }
    root.add(instanced(THREE, new THREE.CylinderGeometry(0.4, 0.5, 1, 7), mat('#4A3A28', 0.9), trunks));
    const frond = frondGeometry(THREE);
    const leafM = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.8, side: THREE.DoubleSide });
    for (let k = 0; k < 9; k++) {
      root.add(instanced(THREE, frond, leafM, crowns.map((c) => ({
        ...c, ry: c.ry + (k / 9) * TAU, rz: k % 2 ? 0.25 : 0, color: new THREE.Color('#4E7A2E').offsetHSL((c.hue - 0.5) * 0.05, 0, (k % 3) * 0.03),
      }))));
    }
    const bushes = [];
    for (let i = 0; i < 160; i++) {
      const x = rnd() * (W + 200) - 100;
      const z = r.zc + (rnd() - 0.5) * r.depth * 0.6;
      const s = 5 + rnd() * 7;
      bushes.push({ x, y: hillHeight(r, x, z) + s * 0.2, z, s, sy: 0.7, color: rnd() < 0.5 ? '#3E5A2A' : '#2E4622' });
    }
    root.add(instanced(THREE, new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.9, flatShading: true }), bushes));
    // Chão de terra vulcânica com musgo
    const zBack = zAt(SNOW_BACK - 2);
    const zEdge = zAt(EDGE_TOP);
    const cSoil = new THREE.Color('#8A7048');
    const cSoilD = new THREE.Color('#5A4630');
    const cMoss = new THREE.Color('#5A7034');
    const soilH = (x, z) => {
      const k = (z - zBack) / (zEdge - zBack);
      return (fbm(x * 0.011, z * 0.03, 313, 4) - 0.45) * (9 - k * 6) * Math.min(1, (1 - k) * 6);
    };
    root.add(kit.mesh(heightField(THREE, {
      x0: -40, x1: W + 40, z0: zBack, z1: zEdge, dx: 5, dz: 4,
      h: soilH,
      colorAt: (c, x, y, z) => {
        c.copy(cSoil).lerp(cSoilD, Math.min(1, ((z - zBack) / (zEdge - zBack)) * 0.8 + fbm(x * 0.04, z * 0.08, 315, 2) * 0.3));
        const m = fbm(x * 0.02, z * 0.05, 317, 3);
        if (m > 0.58) c.lerp(cMoss, Math.min(0.5, (m - 0.58) * 3));
      },
    }), vcol({ bumpMap: grainTexture(THREE, 31), bumpScale: 0.7 })));
    // Pedrinhas, pedras de basalto e brotos de samambaia (longe do ninho e da caverna)
    const stones = [];
    const sprouts = [];
    for (let i = 0; i < 220; i++) {
      const x = rnd() * W;
      if (!dinoClear(x)) continue;
      const z = zBack + 6 + rnd() * (zEdge - zBack - 12);
      if (rnd() < 0.7) {
        const big = rnd() < 0.12;
        const s = big ? 4 + rnd() * 4 : 1 + rnd() * 1.8;
        stones.push({ x, y: soilH(x, z) + s * 0.2, z, s, sy: 0.6 + rnd() * 0.3, rx: rnd() * 3, ry: rnd() * 3, color: rnd() < 0.5 ? '#4E4440' : '#6A5A50' });
      } else {
        sprouts.push({ x, y: soilH(x, z), z, s: 7 + rnd() * 5, ry: rnd() * TAU });
      }
    }
    root.add(instanced(THREE, new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.85, flatShading: true }), stones));
    for (let k = 0; k < 5; k++) {
      root.add(instanced(THREE, frond, leafM, sprouts.map((sp) => ({ ...sp, ry: sp.ry + (k / 5) * TAU, rz: 0.35, color: k % 2 ? '#6E9A36' : '#5A8A2E' })), { shadow: false }));
    }
    // Barranco de colunas de basalto, com rachaduras de lava acesas
    const cTop = new THREE.Color('#7A6660');
    const cMid = new THREE.Color('#544644');
    const cLow = new THREE.Color('#2A2020');
    const col = (x) => Math.floor((x + 400) / 11);
    const bank = bankWall(THREE, {
      zEdge, step: 2.75,
      bulge: (x, v) => (hash(col(x), 1, 319) - 0.5) * 5 + (noise2(x * 0.05, v * 3, 321) - 0.5) * 3 + v * 9,
      color: (c, x, v) => {
        if (v < 0.4) c.copy(cTop).lerp(cMid, v / 0.4);
        else c.copy(cMid).lerp(cLow, (v - 0.4) / 0.6);
        c.multiplyScalar(0.82 + hash(col(x), 2, 323) * 0.3);
      },
    });
    root.add(kit.mesh(bank.geo, vcol({ flatShading: true })));
    const cracks = [];
    const depthB = -bank.bottom;
    for (let i = 0; i < 34; i++) {
      let x = rnd() * W;
      let v = 1;
      for (let k = 0; k < 3; k++) {
        const v2 = v - 0.2 - rnd() * 0.15;
        const x2 = x + (rnd() - 0.5) * 8;
        const len = Math.hypot(x2 - x, (v - v2) * depthB);
        const vm = (v + v2) / 2;
        cracks.push({ x: (x + x2) / 2, y: bank.bottom * vm, z: zEdge + vm * 9 + 0.8, s: 1, sx: 0.9, sy: len, sz: 0.6, rz: -Math.atan2(x2 - x, (v - v2) * depthB) });
        x = x2;
        v = v2;
      }
    }
    root.add(instanced(THREE, new THREE.BoxGeometry(1, 1, 1), lava, cracks, { shadow: false }));
    // Borda da terra por cima do barranco
    const lip = [];
    for (let x = -60; x <= W + 60; x += 30) {
      const k = noise2(x * 0.05, 11, 325);
      lip.push({ p: [x, 0.4 + k * 0.7, zEdge + 1], w: 2.2 + k, h: 1.4 + k * 0.5 });
    }
    root.add(kit.sweep(lip, mat('#5A4632', 0.9), { radial: 10, cap: 0.5, steps: lip.length * 6 }));
    return { root };
  },
  apply() {},
};
