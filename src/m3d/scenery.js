// Cenários de fundo em 3D (etapa 3). Cada cenário é UMA foto do tamanho do fundo 2D
// (1280 × 284, em 2× de resolução), tirada com a câmera ortográfica inclinada de forma
// que x da cena = x da tela e um ponto do chão em profundidade z aparece em
// y_tela = z·sen(e) − y·cos(e). Assim a beira da costa, a linha onde o jogador pisa e a
// água caem exatamente onde o jogo espera, e o resto ganha relevo, luz e sombra de verdade.
import { W, SHORE_TOP, WATER_TOP } from '../config.js';
import { TAU } from './kit.js';

export const BG_H = WATER_TOP + 12; // mesma altura do fundo 2D
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
