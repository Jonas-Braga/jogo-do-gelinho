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
