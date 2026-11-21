// Iglu da fase normal em 3D: cúpula de blocos de neve (as 15 peças, em 5 camadas como
// no desenho 2D) e o pórtico da porta (peça 16). Cada bloco é um pedaço curvo da
// cúpula, um pouco estufado, com frestas entre os blocos. Cada peça cobre o pedaço da
// frente e o de trás correspondente (a cúpula fecha por inteiro).
//
// Fotos: o iglu com 1..15 blocos assentados ("n1".."n15"), cada bloco sozinho, só a
// frente, para a animação de queda ("b0".."b14") e o arco do pórtico ("frame").
// O interior escuro, a luz, a cortina e a fumaça continuam do desenho 2D.
import { IGLOO } from '../config.js';

const LAYERS = [5, 4, 3, 2, 1];
const RZ = 70;            // profundidade da cúpula (a base da frente fica na linha da porta)
const ELEVATION = 0.1;
const GAP = 0.9;          // metade da junta entre blocos (unidades do mundo)

export const BLOCKS = LAYERS.reduce((a, b) => a + b, 0);

const THICK = 10;         // espessura da parede (tijolos de neve de verdade)

// Ponto da casca do iglu (elipsoide rx × ry × RZ) encolhida "inset" unidades para dentro
function shellPoint(phi, th, inset) {
  const dx = -Math.cos(phi) * Math.sin(th);
  const dy = Math.cos(th);
  const dz = Math.sin(phi) * Math.sin(th);
  return [dx * (IGLOO.rx - inset), dy * (IGLOO.ry - inset), dz * (RZ - inset)];
}

// Pedaço da casca sem espessura (a argamassa atrás das juntas)
function shellPatch(THREE, p0, p1, t0, t1, inset) {
  const NU = 8;
  const NV = 4;
  const pos = [];
  const idx = [];
  for (let j = 0; j <= NV; j++) {
    for (let i = 0; i <= NU; i++) pos.push(...shellPoint(p0 + ((p1 - p0) * i) / NU, t0 + ((t1 - t0) * j) / NV, inset));
  }
  for (let j = 0; j < NV; j++) {
    for (let i = 0; i < NU; i++) {
      const a = j * (NU + 1) + i;
      idx.push(a, a + NU + 1, a + 1, a + 1, a + NU + 1, a + NU + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Tijolo sólido: face de fora (estufada no meio, com as quinas arredondadas), face de
// dentro e as quatro laterais, com THICK de espessura
function blockGeometry(THREE, p0, p1, t0, t1) {
  const NU = 12;
  const NV = 7;
  const pos = [];
  const idx = [];
  const edge = (x) => Math.max(0, 1 - Math.min(x, 1 - x) / 0.2);
  const outerInset = (u, v) => -1.6 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v) + 2.6 * (edge(u) ** 2 + edge(v) ** 2);
  const grid = (insetFn) => {
    const base = pos.length / 3;
    for (let j = 0; j <= NV; j++) {
      for (let i = 0; i <= NU; i++) {
        const u = i / NU;
        const v = j / NV;
        pos.push(...shellPoint(p0 + (p1 - p0) * u, t0 + (t1 - t0) * v, insetFn(u, v)));
      }
    }
    for (let j = 0; j < NV; j++) {
      for (let i = 0; i < NU; i++) {
        const a = base + j * (NU + 1) + i;
        idx.push(a, a + NU + 1, a + 1, a + 1, a + NU + 1, a + NU + 2);
      }
    }
  };
  grid(outerInset);
  grid(() => THICK);
  // Laterais: liga a borda da face de fora à da face de dentro
  const side = (pts) => {
    const base = pos.length / 3;
    for (const [u, v] of pts) {
      pos.push(...shellPoint(p0 + (p1 - p0) * u, t0 + (t1 - t0) * v, outerInset(u, v)));
      pos.push(...shellPoint(p0 + (p1 - p0) * u, t0 + (t1 - t0) * v, THICK));
    }
    for (let q = 0; q < pts.length - 1; q++) {
      const a = base + q * 2;
      idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
    }
  };
  const line = (n, f) => Array.from({ length: n + 1 }, (_, q) => f(q / n));
  side(line(NU, (u) => [u, 0]));
  side(line(NU, (u) => [u, 1]));
  side(line(NV, (v) => [0, v]));
  side(line(NV, (v) => [1, v]));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Peças por camada, na mesma ordem do layout 2D (de baixo para cima, da esquerda para a direita)
function layout() {
  const out = [];
  LAYERS.forEach((n, k) => {
    for (let i = 0; i < n; i++) out.push({ k, i, n });
  });
  return out;
}

export const dome = {
  box: { left: -118, right: 118, top: 100, bottom: -16 },
  res: 1.6,
  elevation: ELEVATION,
  poses() {
    const out = [];
    for (let n = 1; n <= BLOCKS; n++) out.push({ key: `n${n}`, upto: n });
    for (let i = 0; i < BLOCKS; i++) out.push({ key: `b${i}`, only: i });
    return out;
  },
  build(kit) {
    const { THREE, mat, group } = kit;
    const snow = mat('#F3F7F9', 0.75, { side: THREE.DoubleSide });
    const snowShade = mat('#E4EDF1', 0.8, { side: THREE.DoubleSide });
    // Argamassa de neve atrás das juntas (as frestas viram sulcos, nunca furos)
    const mortar = mat('#BFD2DB', 0.95, { side: THREE.DoubleSide, emissive: '#7F9AA8', emissiveIntensity: 0.35 });
    const lh = IGLOO.ry / LAYERS.length;
    const root = group();
    const pieces = [];
    for (const [idx, b] of layout().entries()) {
      const { k, i, n } = b;
      // Faixa da camada em ângulo polar (a partir do topo): y = ry·cos θ
      const t0 = k === LAYERS.length - 1 ? 0 : Math.acos(Math.min(1, ((k + 1) * lh) / IGLOO.ry));
      const t1 = Math.acos((k * lh) / IGLOO.ry);
      const gT = GAP / IGLOO.ry;
      // Frente: φ de 0 (esquerda) a π (direita); atrás, o espelho
      const gP = GAP / (IGLOO.rx * Math.max(0.3, Math.sin((t0 + t1) / 2)));
      const f0 = (Math.PI * i) / n;
      const f1 = (Math.PI * (i + 1)) / n;
      const cut = (q0, q1) => [q0 + (n > 1 ? gP : 0), q1 - (n > 1 ? gP : 0)];
      const th = [k === LAYERS.length - 1 ? 0 : t0 + gT, t1 - (k ? gT : 0)];
      const block = (q0, q1, m) => {
        const o = new THREE.Mesh(blockGeometry(THREE, ...cut(q0, q1), ...th), m);
        o.castShadow = true;
        o.receiveShadow = true;
        return o;
      };
      const fill = (q0, q1) => {
        const o = new THREE.Mesh(shellPatch(THREE, q0, q1, t0, t1, THICK * 0.6), mortar);
        o.receiveShadow = true;
        return o;
      };
      const front = group();
      front.add(block(f0, f1, (idx + k) % 2 ? snow : snowShade), fill(f0, f1));
      const back = group();
      back.add(block(2 * Math.PI - f1, 2 * Math.PI - f0, snowShade), fill(2 * Math.PI - f1, 2 * Math.PI - f0));
      root.add(front, back);
      pieces.push({ front, back });
    }
    return { root, pieces };
  },
  apply(rig, p) {
    rig.pieces.forEach((pc, i) => {
      const on = p.only != null ? i === p.only : i < p.upto;
      pc.front.visible = on;
      pc.back.visible = p.only == null && on;
    });
  },
};

// Pórtico: arco de blocos de neve com espessura, na frente da cúpula.
// Ponto de apoio = base da porta (DOOR.x, DOOR.bottom)
export const porch = {
  box: { left: -54, right: 54, top: 92, bottom: -10 },
  res: 2,
  elevation: ELEVATION,
  poses: () => [{ key: 'frame' }],
  build(kit) {
    const { THREE, mat, group } = kit;
    const snow = mat('#F3F7F9', 0.75);
    const snowShade = mat('#E4EDF1', 0.8);
    const root = group();
    const { porchRx, porchRy, doorRx, doorH } = IGLOO;
    const midRx = (porchRx + doorRx) / 2;
    const midRy = (porchRy + doorH) / 2;
    const rings = [[doorRx, doorH, midRx, midRy], [midRx, midRy, porchRx, porchRy]];
    const segs = 6;
    const g = 0.022;
    rings.forEach(([ir, ih, or, oh], r) => {
      for (let s = 0; s < segs; s++) {
        const a0 = Math.PI - (Math.PI * s) / segs - (s ? g : 0);
        const a1 = Math.PI - (Math.PI * (s + 1)) / segs + (s < segs - 1 ? g : 0);
        const shape = new THREE.Shape();
        const steps = 6;
        for (let j = 0; j <= steps; j++) {
          const a = a0 + ((a1 - a0) * j) / steps;
          const x = Math.cos(a) * (or - 0.8);
          const y = Math.sin(a) * (oh - 0.8);
          if (j) shape.lineTo(x, y);
          else shape.moveTo(x, y);
        }
        for (let j = steps; j >= 0; j--) {
          const a = a0 + ((a1 - a0) * j) / steps;
          shape.lineTo(Math.cos(a) * (ir + 0.8), Math.sin(a) * (ih + 0.8));
        }
        shape.closePath();
        const geo = new THREE.ExtrudeGeometry(shape, {
          depth: 12 - r * 3, bevelEnabled: true, bevelThickness: 2, bevelSize: 1.6, bevelSegments: 3, curveSegments: 4,
        });
        const o = new THREE.Mesh(geo, (s + r) % 2 ? snow : snowShade);
        o.position.z = -4 + r * 2;
        o.castShadow = true;
        o.receiveShadow = true;
        root.add(o);
      }
    });
    return { root };
  },
  apply() {},
};
