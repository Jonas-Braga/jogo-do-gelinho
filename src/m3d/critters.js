// Bichos da fase normal em 3D: ganso (voando), caranguejo, molusco e peixe.
// Cada um tem a caixa da foto com o ponto de apoio em (0, 0) igual ao do desenho 2D
// (ganso: centro do corpo; caranguejo/molusco: linha d'água; peixe: centro do corpo).
import { TAU } from './kit.js';

const frameOf = (phase, n) => ((Math.floor((phase / TAU) * n) % n) + n) % n;
const side = (f) => (f === 'L' ? -1 : 1);

// ---------------------------------------------------------------- Ganso
const GOOSE_FRAMES = 8;
export const goose = {
  box: { left: -44, right: 44, top: 44, bottom: -34 },
  res: 2.4,
  pose: (c, t) => `${frameOf(t * 11 + c.ph * 3 + Math.PI / 2, GOOSE_FRAMES)}${c.dir < 0 ? 'L' : 'R'}`,
  poses() {
    const out = [];
    for (const f of ['R', 'L']) {
      for (let i = 0; i < GOOSE_FRAMES; i++) {
        const ph = ((i + 0.5) / GOOSE_FRAMES) * TAU - Math.PI / 2;
        out.push({ key: `${i}${f}`, f, flap: Math.sin(ph), lag: Math.sin(ph - 0.9) });
      }
    }
    return out;
  },
  build({ mat, group, sphere, bone, mesh, THREE }) {
    const white = mat('#FFFFFF', 0.9);
    const grey = mat('#D5DEE3', 0.95);
    const black = mat('#20262B', 0.6);
    const orange = mat('#F08A3C', 0.5);
    const ink = mat('#1D2A33', 0.3);
    const root = group();
    root.rotation.order = 'YXZ';
    const body = sphere(9, white, 0, 0, 0, 22);
    body.scale.set(1, 0.95, 2);
    root.add(body);
    const tail = sphere(5, grey, 0, 2, -18, 12);
    tail.scale.set(1, 0.6, 1.4);
    root.add(tail);
    // Pescoço em duas partes (base e meio) e cabeça: balançam com o bater das asas
    const neck = group(0, 3, 13);
    root.add(neck);
    neck.add(bone(3.2, [0, 0, 0], [0, 7, 6], white));
    const neck2 = group(0, 7, 6);
    neck.add(neck2);
    neck2.add(bone(3, [0, 0, 0], [0, 4, 2], white));
    neck2.add(sphere(5, white, 0, 5, 3, 16));
    const beak = mesh(new THREE.ConeGeometry(2.2, 8, 10), orange, 0, 4, 10);
    beak.rotation.x = Math.PI / 2;
    neck2.add(beak);
    for (const s of [-1, 1]) neck2.add(sphere(1, ink, s * 3.6, 6.5, 5.5, 8));
    // Asa em duas partes: braço (do ombro ao cotovelo) e mão com as penas pretas da ponta
    const wings = [];
    for (const s of [-1, 1]) {
      const hinge = group(s * 5, 7, 2);
      const w = sphere(6, s < 0 ? white : grey, s * 6.5, 0, -1, 16);
      w.scale.set(1.25, 0.24, 1.05);
      hinge.add(w);
      const elbow = group(s * 13, 0, -1);
      hinge.add(elbow);
      const hand = sphere(6.5, s < 0 ? white : grey, s * 6.5, 0, -2, 16);
      hand.scale.set(1.3, 0.2, 0.85);
      elbow.add(hand);
      const tip = sphere(4.2, black, s * 13, 0, -4, 10);
      tip.scale.set(1.2, 0.25, 0.6);
      elbow.add(tip);
      root.add(hinge);
      wings.push({ hinge, elbow, s });
    }
    return { root, wings, neck, neck2 };
  },
  apply(rig, p) {
    rig.root.rotation.y = side(p.f) * (Math.PI / 2 - 0.4);
    // Asas batendo mais para cima que para baixo (não atravessam o corpo); a ponta
    // vem atrasada: dobra para baixo na subida e se estica na descida
    for (const w of rig.wings) {
      w.hinge.rotation.z = w.s * (0.2 + p.flap * 0.75);
      w.elbow.rotation.z = w.s * (0.15 - p.lag * 0.45);
    }
    // O pescoço compensa o sobe e desce do corpo (cabeça mais estável)
    rig.neck.rotation.x = p.flap * 0.12;
    rig.neck2.rotation.x = -p.flap * 0.18;
  },
};

// ---------------------------------------------------------------- Caranguejo
const CRAB_FRAMES = 6;
export const crab = {
  box: { left: -42, right: 42, top: 40, bottom: -18 },
  res: 2.4,
  pose: (c, t) => `${frameOf(t * 16 + c.ph, CRAB_FRAMES)}c${Math.min(2, Math.floor((0.25 + 0.25 * Math.sin(t * 6 + c.ph)) / 0.17))}`,
  poses() {
    const out = [];
    for (let i = 0; i < CRAB_FRAMES; i++) {
      for (let o = 0; o < 3; o++) out.push({ key: `${i}c${o}`, sc: Math.sin(((i + 0.5) / CRAB_FRAMES) * TAU), open: [0.1, 0.3, 0.5][o] });
    }
    return out;
  },
  build({ mat, group, sphere, bone }) {
    const shell = mat('#E8693A', 0.55);
    const dark = mat('#A9381A', 0.6);
    const claw = mat('#E2602F', 0.5);
    const white = mat('#FFFFFF', 0.3);
    const ink = mat('#1D2A33', 0.3);
    const root = group(0, 0, 0);
    // Carapaça achatada (o apoio é a linha d'água: ele fica meio submerso)
    const cara = sphere(16, shell, 0, -1, 0, 26);
    cara.scale.set(1, 0.58, 0.72);
    root.add(cara);
    const legs = [];
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        // Pata: coxa, joelho e canela apontando para o chão
        const g = group(s * (9 + i * 3), -1, -4 + i * 3);
        g.add(bone(1.6, [0, 0, 0], [s * 8, 4, 0], dark));
        const knee = group(s * 8, 4, 0);
        knee.add(sphere(1.7, dark, 0, 0, 0, 8));
        knee.add(bone(1.4, [0, 0, 0], [s * 4, -11, 1], dark));
        g.add(knee);
        root.add(g);
        legs.push({ g, knee, s, i });
      }
      // Braço e garra (duas pinças)
      root.add(bone(2.2, [s * 10, -2, 6], [s * 16, 9, 8], dark));
      const c = group(s * 17, 12, 9);
      const palm = sphere(5.5, claw, 0, 0, 0, 14);
      palm.scale.set(1, 0.8, 0.8);
      c.add(palm);
      const pinch = group(s * 2, 2, 1);
      const fing = sphere(3.6, claw, s * 3, 3, 0, 10);
      fing.scale.set(0.6, 1.3, 0.6);
      pinch.add(fing);
      c.add(pinch);
      root.add(c);
      legs.push({ pinch, s });
      // Olhos no talo
      root.add(bone(0.9, [s * 4, 4, 7], [s * 5, 13, 8], dark));
      root.add(sphere(2.6, white, s * 5, 14, 8.5, 12));
      root.add(sphere(1.3, ink, s * 5, 14, 10.8, 8));
    }
    return { root, legs };
  },
  apply(rig, p) {
    rig.root.rotation.y = 0;
    for (const l of rig.legs) {
      if (l.pinch) l.pinch.rotation.z = -l.s * p.open * 1.4;
      else {
        // Patas alternadas: a que vai para a frente sobe dobrando o joelho
        const k = l.i % 2 ? p.sc : -p.sc;
        l.g.rotation.x = k * 0.35;
        l.g.rotation.z = l.s * Math.max(0, k) * 0.25;
        l.knee.rotation.z = -l.s * Math.max(0, k) * 0.45;
      }
    }
  },
};

// ---------------------------------------------------------------- Molusco
const CLAM_OPEN = 6;
export const clam = {
  box: { left: -32, right: 32, top: 34, bottom: -16 },
  res: 2.4,
  pose: (c, t) => `${Math.round(Math.max(0, Math.sin(t * 2.6 + c.ph)) * (CLAM_OPEN - 1))}${c.dir < 0 ? 'L' : 'R'}`,
  poses() {
    const out = [];
    for (const f of ['R', 'L']) for (let i = 0; i < CLAM_OPEN; i++) out.push({ key: `${i}${f}`, f, open: (i / (CLAM_OPEN - 1)) * 0.65 });
    return out;
  },
  build({ mat, group, sphere, mesh, THREE }) {
    const outer = mat('#9A72AE', 0.45);
    const top = mat('#B48DC6', 0.45);
    const inner = mat('#F1C6CF', 0.6);
    const pearl = mat('#FFFFFF', 0.15);
    const root = group();
    root.rotation.order = 'YXZ';
    // Concha de baixo (meia esfera achatada)
    const shellGeo = new THREE.SphereGeometry(16, 28, 14, 0, TAU, Math.PI / 2, Math.PI / 2);
    const bottom = mesh(shellGeo, outer);
    bottom.scale.set(1, 0.55, 0.8);
    root.add(bottom);
    const flesh = sphere(13, inner, 0, 0, 0, 20);
    flesh.scale.set(1, 0.12, 0.7);
    root.add(flesh);
    root.add(sphere(3, pearl, 2, 1.5, 2, 14));
    // Concha de cima, girando na dobradiça (atrás, em z = −12)
    const hinge = group(0, 0, -12);
    const upper = mesh(new THREE.SphereGeometry(16, 28, 14, 0, TAU, 0, Math.PI / 2), top, 0, 0, 12);
    upper.scale.set(1, 0.62, 0.8);
    hinge.add(upper);
    root.add(hinge);
    return { root, hinge };
  },
  apply(rig, p) {
    // A dobradiça fica do lado de trás; abre para o lado em que ele anda
    rig.root.rotation.y = side(p.f) * 0.35;
    rig.root.rotation.x = 0.25;
    rig.hinge.rotation.x = -p.open;
  },
};

// ---------------------------------------------------------------- Peixe
const FISH_FRAMES = 6;
export const fish = {
  box: { left: -38, right: 38, top: 26, bottom: -26 },
  res: 2.4,
  pose: (c, t) => `${frameOf(t * 18 + c.ph, FISH_FRAMES)}${c.dir < 0 ? 'L' : 'R'}`,
  poses() {
    const out = [];
    for (const f of ['R', 'L']) for (let i = 0; i < FISH_FRAMES; i++) out.push({ key: `${i}${f}`, f, wig: Math.sin(((i + 0.5) / FISH_FRAMES) * TAU) * 0.35 });
    return out;
  },
  build({ mat, group, sphere, mesh, THREE }) {
    const orange = mat('#F28A35', 0.4);
    const belly = mat('#FFE2B0', 0.5);
    const fin = mat('#E0702A', 0.5, { side: THREE.DoubleSide });
    const white = mat('#FFFFFF', 0.2);
    const ink = mat('#1D2A33', 0.2);
    const root = group();
    root.rotation.order = 'YXZ';
    const body = sphere(8, orange, 0, 0, 0, 24);
    body.scale.set(0.7, 1, 1.8);
    root.add(body);
    const under = sphere(7, belly, 0, -2.5, 1, 18);
    under.scale.set(0.62, 0.65, 1.6);
    root.add(under);
    const finShape = (pts) => {
      const s = new THREE.Shape();
      s.moveTo(pts[0][0], pts[0][1]);
      for (const [x, y] of pts.slice(1)) s.lineTo(x, y);
      return new THREE.ShapeGeometry(s);
    };
    // Cauda em duas partes: o pedúnculo (fim do corpo) e a nadadeira, que balança mais
    const tail = group(0, 0, -8);
    const ped = sphere(4.2, orange, 0, 0, -3, 14);
    ped.scale.set(0.6, 0.9, 1.3);
    tail.add(ped);
    const finJoint = group(0, 0, -7);
    const tf = mesh(finShape([[0, 0], [-9, 8], [-6, 0], [-9, -8]]), fin);
    tf.rotation.y = -Math.PI / 2;
    finJoint.add(tf);
    tail.add(finJoint);
    root.add(tail);
    const dorsal = mesh(finShape([[-6, 0], [4, 0], [-3, 6]]), fin, 0, 7, 0);
    dorsal.rotation.y = -Math.PI / 2;
    root.add(dorsal);
    for (const s of [-1, 1]) {
      root.add(sphere(2.4, white, s * 4.4, 2, 9, 12));
      root.add(sphere(1.2, ink, s * 5.4, 2, 10, 8));
    }
    return { root, tail, finJoint };
  },
  apply(rig, p) {
    rig.root.rotation.y = side(p.f) * (Math.PI / 2 - 0.35);
    rig.tail.rotation.y = p.wig * 0.6;
    rig.finJoint.rotation.y = p.wig * 0.9;
  },
};
