// Floresta em 3D: cobra, morcego e piranha (articulados), troncos boiando no rio,
// pinheiros e cogumelos da costa. Mesmos pontos de apoio do desenho 2D (src/forest.js);
// y para cima (o y do 2D com o sinal trocado).
import { TAU } from './kit.js';
import { CABIN, CABIN_PIECES } from '../forest.js';

const frameOf = (phase, n) => ((Math.floor((phase / TAU) * n) % n) + n) % n;
const side = (f) => (f === 'L' ? -1 : 1);

// Posiciona uma cápsula (eixo y) entre dois pontos
function place(THREE, o, a, b) {
  o.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = d.length();
  o.scale.set(1, len, 1);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
}

// ---------------------------------------------------------------- Cobra
// Apoio: (c.x, y − 3). Corpo em cadeia de segmentos ondulando de lado (serpenteando),
// cabeça erguida no pescoço e a língua bifurcada que entra e sai
const SNAKE_FRAMES = 8;
const SNAKE_SEGS = 16;
export const snake = {
  box: { left: -34, right: 34, top: 26, bottom: -12 },
  res: 2.6,
  elevation: 0.4,
  pose: (c, t) => `${frameOf(t * 9 + c.ph * 3, SNAKE_FRAMES)}${Math.sin(t * 7 + c.ph) > 0.2 ? 1 : 0}${c.dir < 0 ? 'L' : 'R'}`,
  poses() {
    const out = [];
    for (const f of ['R', 'L']) {
      for (let i = 0; i < SNAKE_FRAMES; i++) {
        for (const tongue of [0, 1]) out.push({ key: `${i}${tongue}${f}`, f, ph: ((i + 0.5) / SNAKE_FRAMES) * TAU, tongue });
      }
    }
    return out;
  },
  build({ THREE, mat, group, sphere, mesh }) {
    const green = mat('#5F9C34', 0.45);
    const dark = mat('#2F5F1E', 0.5);
    const yellow = mat('#E6C94A', 0.4);
    const root = group();
    root.rotation.order = 'YXZ';
    const segs = [];
    for (let i = 0; i < SNAKE_SEGS; i++) {
      const r = 1.6 + 2.2 * Math.min(1, i / 9) - (i > 13 ? 0.4 : 0);
      const s = sphere(r, i % 2 ? green : dark, 0, 0, 0, 12);
      s.scale.set(1.25, 0.85, 1);
      root.add(s);
      // Losango amarelo no dorso
      const d = i > 2 && i % 2 === 0 ? sphere(r * 0.55, yellow, 0, 0, 0, 8) : null;
      if (d) {
        d.scale.set(1.3, 0.35, 0.8);
        root.add(d);
      }
      segs.push({ s, d, r });
    }
    const head = group();
    root.add(head);
    const skull = sphere(4.4, green, 0, 0, 0, 16);
    skull.scale.set(1.55, 0.8, 1.05);
    head.add(skull);
    for (const z of [-2.4, 2.4]) {
      head.add(sphere(1.6, mat('#F7E36A', 0.2), 3, 2, z, 10));
      const pupil = sphere(0.9, mat('#111111', 0.2), 3.9, 2.1, z * 1.12, 8);
      pupil.scale.set(0.4, 1.6, 0.4);
      head.add(pupil);
    }
    // Língua bifurcada
    const tongue = group(6.6, -0.6, 0);
    const red = mat('#D6303A', 0.5);
    const base = mesh(new THREE.CylinderGeometry(0.35, 0.35, 1, 6), red);
    place(THREE, base, [0, 0, 0], [5, 0, 0]);
    tongue.add(base);
    for (const z of [-1.2, 1.2]) {
      const fork = mesh(new THREE.CylinderGeometry(0.3, 0.3, 1, 6), red);
      place(THREE, fork, [5, 0, 0], [7.4, 0.3, z]);
      tongue.add(fork);
    }
    head.add(tongue);
    return { root, segs, head, tongue };
  },
  apply(rig, p) {
    rig.root.rotation.y = p.f === 'L' ? Math.PI : 0;
    // Corpo serpenteando de lado (no chão) da cauda até o pescoço
    let hx = 0;
    let hz = 0;
    rig.segs.forEach((g, i) => {
      const x = -24 + i * 2.9;
      const z = Math.sin(p.ph - i * 0.75) * 4 * (i < 12 ? 1 : 0.4);
      const y = i > 12 ? (i - 12) * 2.2 : 0;
      g.s.position.set(x, g.r * 0.6 + y, z);
      if (g.d) g.d.position.set(x, g.r * 1.15 + y, z);
      hx = x;
      hz = z;
    });
    // Cabeça erguida, balançando de leve
    rig.head.position.set(hx + 4, 10 + Math.sin(p.ph * 0.5) * 1.2, hz * 0.5);
    rig.head.rotation.z = -0.15;
    rig.tongue.visible = !!p.tongue;
  },
};

// ---------------------------------------------------------------- Morcego
// Apoio: centro do corpo (c.x, y − 32 + balanço). Asa de membrana com braço,
// antebraço e três dedos; a membrana é refeita a cada pose seguindo os ossos
const BAT_FRAMES = 8;
export const bat = {
  box: { left: -34, right: 34, top: 30, bottom: -22 },
  res: 2.6,
  elevation: 0.2,
  pose: (c, t) => `${frameOf(t * 16 + c.ph * 3 + Math.PI / 2, BAT_FRAMES)}${c.dir < 0 ? 'L' : 'R'}`,
  poses() {
    const out = [];
    for (const f of ['R', 'L']) {
      for (let i = 0; i < BAT_FRAMES; i++) out.push({ key: `${i}${f}`, f, flap: Math.sin(((i + 0.5) / BAT_FRAMES) * TAU - Math.PI / 2) });
    }
    return out;
  },
  build({ THREE, mat, group, sphere, mesh }) {
    const fur = mat('#5A4632', 0.95);
    const furHead = mat('#6A543C', 0.95);
    const membrane = mat('#6A5482', 0.6, { side: THREE.DoubleSide });
    const membraneNear = mat('#58466E', 0.6, { side: THREE.DoubleSide });
    const boneM = mat('#2A1F33', 0.6);
    const root = group();
    root.rotation.order = 'YXZ';
    const body = sphere(6.5, fur, 0, 0, 0, 18);
    body.scale.set(0.9, 1.2, 0.85);
    root.add(body);
    const head = group(3, 8, 0);
    root.add(head);
    head.add(sphere(5, furHead, 0, 0, 0, 16));
    for (const z of [-2.6, 2.6]) {
      const ear = mesh(new THREE.ConeGeometry(2, 7, 8), furHead, -0.5, 5.5, z);
      ear.rotation.x = z * 0.06;
      head.add(ear);
      head.add(sphere(1.2, mat('#FF5A4A', 0.2, { emissive: '#AA1A10', emissiveIntensity: 0.5 }), 3.8, 0.8, z * 0.75, 8));
      const fang = mesh(new THREE.ConeGeometry(0.45, 1.8, 6), mat('#FFFFFF', 0.3), 4.2, -2.6, z * 0.4);
      fang.rotation.z = Math.PI;
      head.add(fang);
    }
    const wings = [-1, 1].map((s) => {
      const g = group();
      root.add(g);
      return { s, g, mat: s > 0 ? membraneNear : membrane };
    });
    return { root, wings, boneM, THREE };
  },
  apply(rig, p) {
    const { THREE } = rig;
    // Visto de frente, como no 2D (asas abertas para os lados), virado um pouco para
    // onde voa: a frente do modelo (+x) aponta para a câmera
    rig.root.rotation.y = -(Math.PI / 2) + (p.f === 'L' ? -0.5 : 0.5);
    const f = p.flap;
    for (const w of rig.wings) {
      // As asas abrem para os lados (z): s = +1 perto da câmera
      const s = w.s;
      for (const o of [...w.g.children]) {
        w.g.remove(o);
        o.geometry.dispose();
      }
      const P = (x, y, z) => [x, y, s * z];
      const S = P(0, 2, 2);
      const E = P(1, 3 + f * 7, 9);
      const Wr = P(2, 4 + f * 11, 14);
      const F1 = P(-1, 4 + f * 14, 23);
      const F2 = P(-5, f * 12 - 3, 19);
      const F3 = P(-6, f * 8 - 6, 12);
      const B = P(-3, -5, 1.5);
      const tri = [S, E, B, E, F3, B, E, Wr, F3, Wr, F2, F3, Wr, F1, F2];
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(tri.flat(), 3));
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, w.mat);
      m.castShadow = true;
      w.g.add(m);
      // Ossos da asa (braço, antebraço e dedos) por cima da membrana
      for (const [a, b] of [[S, E], [E, Wr], [Wr, F1], [Wr, F2], [Wr, F3]]) {
        const bo = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1, 6), rig.boneM);
        place(THREE, bo, a, b);
        w.g.add(bo);
      }
    }
  },
};

// ---------------------------------------------------------------- Piranha
// Apoio: (c.x, y + 6 − salto), como o 2D; dorso cinza-azulado, barriga vermelha,
// mandíbula que morde, cauda em duas partes, dentes
const PIR_WIG = 4;
export const piranha = {
  box: { left: -30, right: 30, top: 24, bottom: -20 },
  res: 2.6,
  elevation: 0.2,
  pose: (c, t) => `${frameOf(t * 12 + c.ph, PIR_WIG)}${Math.min(2, Math.round((Math.abs(Math.sin(t * 10 + c.ph)) * 0.5) / 0.25))}${c.dir < 0 ? 'L' : 'R'}`,
  poses() {
    const out = [];
    for (const f of ['R', 'L']) {
      for (let i = 0; i < PIR_WIG; i++) {
        for (let m = 0; m < 3; m++) out.push({ key: `${i}${m}${f}`, f, wig: Math.sin(((i + 0.5) / PIR_WIG) * TAU) * 0.35, chomp: m * 0.25 });
      }
    }
    return out;
  },
  build({ THREE, mat, group, sphere, mesh }) {
    const back = mat('#7D8C95', 0.35);
    const belly = mat('#E0563A', 0.4);
    const fin = mat('#4C5A63', 0.5, { side: THREE.DoubleSide });
    const mouth = mat('#4A0E0E', 0.6);
    const tooth = mat('#FFFFFF', 0.3);
    const root = group();
    root.rotation.order = 'YXZ';
    const top = sphere(10, back, 0, 0.6, 0, 22);
    top.scale.set(1.35, 0.98, 0.6);
    root.add(top);
    const low = sphere(9.6, belly, 0.6, -3.4, 0, 20);
    low.scale.set(1.32, 0.78, 0.66);
    root.add(low);
    const finShape = (pts) => {
      const s = new THREE.Shape();
      pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
      return new THREE.ShapeGeometry(s);
    };
    root.add(mesh(finShape([[-6, 8], [0, 15], [4, 9]]), fin));
    // Cauda: pedúnculo e nadadeira
    const tail = group(-12, 0, 0);
    root.add(tail);
    const ped = sphere(3.6, back, -2, 0, 0, 12);
    ped.scale.set(1.3, 1, 0.6);
    tail.add(ped);
    const finJ = group(-4.5, 0, 0);
    tail.add(finJ);
    finJ.add(mesh(finShape([[0, 0], [-8, 7], [-6, 0], [-8, -7]]), fin));
    // Mandíbula de baixo (gira na articulação), com dentes em cima e embaixo
    const jaw = group(6, -1, 0);
    root.add(jaw);
    const lower = sphere(5, belly, 3.5, -1.5, 0, 14);
    lower.scale.set(1.2, 0.55, 0.85);
    jaw.add(lower);
    jaw.add(sphere(3.6, mouth, 4, 0, 0, 10));
    for (let i = 0; i < 3; i++) {
      for (const z of [-1.6, 1.6]) {
        const tb = mesh(new THREE.ConeGeometry(0.6, 1.8, 6), tooth, 3 + i * 1.8, 0.9, z * (1 - i * 0.15));
        jaw.add(tb);
        const tt = mesh(new THREE.ConeGeometry(0.6, 1.8, 6), tooth, 9 + i * 1.8, -0.4, z * (1 - i * 0.15));
        tt.rotation.z = Math.PI;
        root.add(tt);
      }
    }
    // Olho bravo com a sobrancelha
    for (const z of [-4.8, 4.8]) {
      root.add(sphere(2.4, mat('#F2D33C', 0.2), 7, 3.6, z, 12));
      root.add(sphere(1.2, mat('#111111', 0.2), 8.4, 3.6, z * 1.12, 8));
      const brow = kit3Brow(THREE, mat('#2E3A40', 0.6));
      brow.position.set(7, 7, z * 1.05);
      brow.rotation.z = -0.35;
      root.add(brow);
    }
    return { root, tail, finJ, jaw };
  },
  apply(rig, p) {
    rig.root.rotation.y = p.f === 'L' ? Math.PI - 0.3 : 0.3;
    rig.tail.rotation.y = p.wig * 0.6;
    rig.finJ.rotation.y = p.wig;
    rig.jaw.rotation.z = -p.chomp * 0.9;
  },
};

function kit3Brow(THREE, m) {
  const o = new THREE.Mesh(new THREE.CapsuleGeometry(0.6, 4, 4, 8), m);
  o.rotation.z = Math.PI / 2;
  const g = new THREE.Group();
  g.add(o);
  return g;
}

// ---------------------------------------------------------------- Troncos
// Mesmas medidas do sprite 2D (logSprite): pés na linha y = 0, 22 abaixo do topo da
// foto, altura 64. Tronco deitado ao longo de x, com casca (ou madeira descascada cor
// de mel quando aceso), nós, musgo e a ponta cortada com os anéis
export const LOG = { PAD: 12, TOP: 22, H: 64, VARIANTS: 3 };
const logs = new Map();
export function logSubject(w) {
  if (logs.has(w)) return logs.get(w);
  const S = {
    box: { left: -LOG.PAD, right: w + LOG.PAD, top: LOG.TOP, bottom: LOG.TOP - LOG.H },
    res: 2.2,
    elevation: 0.3,
    poses() {
      const out = [];
      for (let v = 0; v < LOG.VARIANTS; v++) for (const on of [0, 1]) out.push({ key: `${v}${on}`, v, on });
      return out;
    },
    build(kit) {
      return buildLogs(kit, w);
    },
    apply(rig, p) {
      rig.variants.forEach((g, i) => (g.visible = i === p.v));
      for (const m of rig.meshes) m.material = p.on ? m.userData.on : m.userData.off;
    },
  };
  logs.set(w, S);
  return S;
}

// Casca do tronco. No cilindro, u dá a volta no tronco (u = 0,25 é o lado de cima,
// depois de deitado) e v corre ao longo dele: as estrias são linhas de u constante
// (correm ao longo do tronco) e o musgo fica numa faixa em volta de u = 0,25
function barkTexture(THREE, on, seed) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.fillStyle = on ? '#E3B067' : '#6A4A2C';
  g.fillRect(0, 0, 256, 128);
  // Estrias ao longo do tronco (verticais na textura)
  for (let i = 0; i < 40; i++) {
    g.fillStyle = on ? `rgba(150, 95, 35, ${0.2 + rnd() * 0.2})` : `rgba(25, 15, 6, ${0.3 + rnd() * 0.3})`;
    const x = rnd() * 256;
    g.fillRect(x, 0, 1 + rnd() * 2.5, 128);
  }
  // Nós
  for (let i = 0; i < 4; i++) {
    g.fillStyle = on ? 'rgba(140, 85, 30, 0.6)' : 'rgba(30, 18, 8, 0.75)';
    g.beginPath();
    g.ellipse(rnd() * 256, rnd() * 128, 3, 6, 0, 0, TAU);
    g.fill();
  }
  // Musgo no lado de cima (só a casca escura), em manchas espalhadas
  if (!on) {
    for (let i = 0; i < 60; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(110, 150, 60, 0.65)' : 'rgba(80, 120, 45, 0.6)';
      g.beginPath();
      g.arc(256 * (0.18 + rnd() * 0.14), rnd() * 128, 1.2 + rnd() * 2, 0, TAU);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function ringsTexture(THREE, on) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grd.addColorStop(0, on ? '#FFE7B0' : '#E2C08A');
  grd.addColorStop(1, on ? '#E2B062' : '#B88E58');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = 'rgba(120, 80, 40, 0.55)';
  g.lineWidth = 1.5;
  for (let k = 1; k <= 4; k++) {
    g.beginPath();
    g.arc(32, 32, k * 6.5, 0, TAU);
    g.stroke();
  }
  g.strokeStyle = on ? '#B07A34' : '#4A3019';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(32, 32, 30, 0, TAU);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildLogs(kit, w) {
  const { THREE, group } = kit;
  const std = (map, extra = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.9, metalness: 0, ...extra });
  const root = group();
  const variants = [];
  const meshes = [];
  const R = 12;
  for (let v = 0; v < LOG.VARIANTS; v++) {
    const g = group();
    const seed = (v + 3) * 4111;
    const mats = {
      off: [std(barkTexture(THREE, false, seed)), std(ringsTexture(THREE, false)), std(ringsTexture(THREE, false))],
      on: [
        std(barkTexture(THREE, true, seed), { emissive: '#7A4A10', emissiveIntensity: 0.35 }),
        std(ringsTexture(THREE, true), { emissive: '#7A4A10', emissiveIntensity: 0.3 }),
        std(ringsTexture(THREE, true), { emissive: '#7A4A10', emissiveIntensity: 0.3 }),
      ],
    };
    // Cilindro levemente irregular (o raio varia ao longo do tronco)
    const geo = new THREE.CylinderGeometry(R * (0.96 + v * 0.02), R, w, 20, 6);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const k = 1 + 0.04 * Math.sin(y * 0.3 + v * 2);
      pos.setX(i, pos.getX(i) * k);
      pos.setZ(i, pos.getZ(i) * k);
    }
    geo.computeVertexNormals();
    const log = new THREE.Mesh(geo, mats.off);
    log.userData = mats;
    log.rotation.z = Math.PI / 2;
    log.rotation.y = 0.12; // a ponta cortada da esquerda aparece um pouco
    log.position.set(w / 2, -3, 0);
    log.castShadow = true;
    log.receiveShadow = true;
    g.add(log);
    meshes.push(log);
    // Galhinho quebrado saindo do tronco (nos troncos compridos)
    if (w > 50) {
      const twig = kit.bone(1.6, [w * (0.3 + v * 0.2), 6, 4], [w * (0.3 + v * 0.2) + 6, 13, 8], kit.mat('#4A3019', 0.9));
      g.add(twig);
    }
    root.add(g);
    variants.push(g);
  }
  return { root, variants, meshes };
}

// ---------------------------------------------------------------- Pinheiro e cogumelo
// Pinheiro de 128 de altura (os menores são a mesma foto em escala); base = (0, 0)
export const PINE_H = 128;
export const pine = {
  box: { left: -46, right: 46, top: 140, bottom: -8 },
  res: 2,
  elevation: 0.05,
  poses: () => [{ key: 'pine' }],
  build({ THREE, mat, group, mesh }) {
    const root = group();
    const h = PINE_H;
    const w = h * 0.6;
    root.add(mesh(new THREE.CylinderGeometry(5, 6, 15, 12), mat('#5B3A22', 0.9), 0, 6.5, 0));
    for (let i = 0; i < 4; i++) {
      const yb = 12 + i * h * 0.2;
      const th = h * 0.34;
      const hw = (w / 2) * (1 - i * 0.2);
      const geo = new THREE.ConeGeometry(hw, th, 16, 3, true);
      const pos = geo.attributes.position;
      for (let v = 0; v < pos.count; v++) {
        const y = pos.getY(v);
        if (y < -th / 2 + 0.01) {
          const a = Math.atan2(pos.getZ(v), pos.getX(v));
          pos.setY(v, y - 2.5 * Math.abs(Math.sin(a * 4)));
        }
      }
      geo.computeVertexNormals();
      root.add(mesh(geo, mat(i % 2 ? '#2A6638' : '#3A8248', 0.9, { side: THREE.DoubleSide }), 0, yb + th / 2, 0));
    }
    return { root };
  },
  apply() {},
};

export const mushroom = {
  box: { left: -10, right: 10, top: 14, bottom: -3 },
  res: 4,
  elevation: 0.3,
  poses: () => [{ key: 'm' }],
  build({ THREE, mat, group, mesh, sphere }) {
    const root = group();
    root.add(mesh(new THREE.CylinderGeometry(1.8, 2.3, 7, 10), mat('#F2E8D2', 0.8), 0, 3.5, 0));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(7, 20, 10, 0, TAU, 0, Math.PI / 2), mat('#C93A2E', 0.5));
    cap.scale.set(1, 0.65, 1);
    cap.position.y = 6.5;
    cap.castShadow = true;
    root.add(cap);
    for (const [x, z] of [[-3, 3], [2.5, 4], [0, -1], [4, -2]]) root.add(sphere(1, mat('#FFFFFF', 0.6), x, 9.6 - Math.hypot(x, z) * 0.25, z, 8));
    return { root };
  },
  apply() {},
};

// ---------------------------------------------------------------- Cabana
// Mesmo lugar, mesmas 16 peças e mesma porta da cabana 2D (src/forest.js): 6 camadas
// de toras roliças (nos quatro lados, cruzando nos cantos), 3 faixas da empena de
// tábuas (frente e fundo), 4 tábuas do telhado de duas águas, janela com floreira e
// chaminé de pedra. A porta (peça 16) continua 2D, como a do iglu.
// Fotos: "n1".."n15" (peças assentadas) e "b0".."b14" (cada peça sozinha, caindo).
const CAB_D = 35;          // meia profundidade (a frente fica em z = +35)

function woodTexture(THREE, base, lines, vertical = false) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 64);
  g.fillStyle = lines;
  let s = 99;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 14; i++) {
    const p = rnd() * (vertical ? 128 : 64);
    if (vertical) g.fillRect(p, 0, 1 + rnd() * 1.5, 64);
    else g.fillRect(0, p, 128, 1 + rnd() * 1.5);
  }
  if (vertical) for (let x = 0; x < 128; x += 16) g.fillRect(x, 0, 2, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export const cabin = {
  box: { left: -130, right: 130, top: 148, bottom: -16 },
  res: 1.5,
  elevation: 0.2,
  poses() {
    const out = [];
    for (let n = 1; n < CABIN_PIECES.length; n++) out.push({ key: `n${n}`, upto: n });
    for (let i = 0; i < CABIN_PIECES.length - 1; i++) out.push({ key: `b${i}`, only: i });
    return out;
  },
  build(kit) {
    const { THREE, mat, group, mesh, sphere } = kit;
    const { CW, LOG, WALL_H, PEAK, EAVE, CHIMNEY } = CABIN;
    const std = (map, extra = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.9, metalness: 0, ...extra });
    const logM = std(woodTexture(THREE, '#8A5A30', 'rgba(50, 28, 10, 0.4)'));
    const ends = std(ringsTexture(THREE, false));
    const gableM = std(woodTexture(THREE, '#8C5E36', 'rgba(50, 30, 12, 0.5)', true));
    const roofTex = woodTexture(THREE, '#6E4426', 'rgba(30, 15, 5, 0.55)', true);
    roofTex.repeat.set(1, 2);
    const roofM = std(roofTex);
    const dark = mat('#4A2C16', 0.8);
    const stone = std(woodTexture(THREE, '#8F857A', 'rgba(40, 35, 30, 0.45)'));
    const roofY = (x) => WALL_H + PEAK - Math.abs(x) * (PEAK / (CW + EAVE * 0.2));
    const r = LOG / 2;
    const root = group();
    const pieces = [];
    const logAlong = (len, axis) => {
      const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 16), [logM, ends, ends]);
      if (axis === 'x') o.rotation.z = Math.PI / 2;
      else o.rotation.x = Math.PI / 2;
      o.castShadow = o.receiveShadow = true;
      return o;
    };
    for (const p of CABIN_PIECES) {
      const g = group();
      if (p.kind === 'log') {
        const y = LOG * p.i + r;
        for (const z of [CAB_D, -CAB_D]) {
          const o = logAlong(CW * 2 + 16, 'x');
          o.position.set(0, y, z);
          g.add(o);
        }
        for (const x of [-CW, CW]) {
          const o = logAlong(CAB_D * 2 + 16, 'z');
          o.position.set(x, y + 0.6, 0);
          g.add(o);
        }
      } else if (p.kind === 'gable') {
        const y0 = WALL_H + (PEAK / 3) * p.i;
        const y1 = y0 + PEAK / 3;
        const hw = (y) => CW * (1 - (y - WALL_H) / PEAK);
        const s = new THREE.Shape();
        s.moveTo(-hw(y0), y0);
        s.lineTo(hw(y0), y0);
        s.lineTo(hw(y1), y1);
        s.lineTo(-hw(y1), y1);
        s.closePath();
        for (const z of [CAB_D - 4, -CAB_D]) {
          const o = mesh(new THREE.ExtrudeGeometry(s, { depth: 4, bevelEnabled: false }), gableM, 0, 0, z);
          g.add(o);
        }
      } else if (p.kind === 'roof') {
        const xa = p.side * (p.part === 0 ? CW + EAVE : (CW + EAVE) / 2);
        const xb = p.side * (p.part === 0 ? (CW + EAVE) / 2 : 0);
        const ya = roofY(xa);
        const yb = roofY(xb);
        const len = Math.hypot(xb - xa, yb - ya) + 2;
        const o = mesh(new THREE.BoxGeometry(len, 5, CAB_D * 2 + 26), roofM);
        o.rotation.z = Math.atan2(yb - ya, xb - xa) + (p.side > 0 ? Math.PI : 0);
        // A face de cima fica na linha do telhado
        const ang = Math.atan2(yb - ya, xb - xa);
        o.position.set((xa + xb) / 2 + Math.sin(ang) * 2.5 * (p.side > 0 ? -1 : 1), (ya + yb) / 2 - 2.5, 0);
        g.add(o);
      } else if (p.kind === 'window') {
        const zf = CAB_D + r + 0.5;
        g.add(mesh(new THREE.BoxGeometry(34, 32, 3), dark, -56, 43, zf));
        g.add(mesh(new THREE.BoxGeometry(28, 26, 1), mat('#26323A', 0.15), -56, 43, zf + 1.6));
        g.add(mesh(new THREE.BoxGeometry(3, 26, 1.6), dark, -56, 43, zf + 2));
        g.add(mesh(new THREE.BoxGeometry(28, 3, 1.6), dark, -56, 43, zf + 2));
        // Reflexo no vidro
        const gl = mesh(new THREE.PlaneGeometry(4, 22), mat('#B4D2E6', 0.1, { transparent: true, opacity: 0.35 }), -62, 43, zf + 2.2);
        gl.rotation.z = -0.4;
        g.add(gl);
        // Floreira com flores
        g.add(mesh(new THREE.BoxGeometry(36, 5, 7), mat('#6E4426', 0.8), -56, 24.5, zf + 3));
        ['#E5484D', '#F7D25C', '#E9A6D8', '#E5484D', '#F7D25C'].forEach((c, i) => {
          g.add(sphere(2.4, mat(c, 0.6), -70 + i * 6.5, 28.6, zf + 3.5, 10));
          g.add(sphere(1.6, mat('#4C7A2A', 0.8), -67 + i * 6.5, 27.6, zf + 2.5, 8));
        });
      } else if (p.kind === 'chimney') {
        const { x0, x1 } = CHIMNEY;
        const top = WALL_H + PEAK + 6;
        const bottom = roofY(x0) - 6;
        g.add(mesh(new THREE.BoxGeometry(x1 - x0, top - bottom, 16), stone, (x0 + x1) / 2, (top + bottom) / 2, -6));
        g.add(mesh(new THREE.BoxGeometry(x1 - x0 + 4, 4, 20), mat('#5A524B', 0.9), (x0 + x1) / 2, top + 1, -6));
      }
      root.add(g);
      pieces.push(g);
    }
    return { root, pieces };
  },
  apply(rig, p) {
    rig.pieces.forEach((g, i) => (g.visible = p.only != null ? i === p.only : i < p.upto));
  },
};
