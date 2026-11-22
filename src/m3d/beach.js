// Praia em 3D (fase 20): caranguejo gigante de patas e pinças articuladas, gaivota,
// siri, água-viva, peixinho tropical, pranchas de surfe e boias, cabana de palha
// montada peça por peça, coqueiros e o guarda-sol com cadeira e castelo de areia.
// Mesmos pontos de apoio do desenho 2D (src/beach.js); y para cima.
import { TAU } from './kit.js';
import { poses as bearPoses, bearPose, box as bearBox } from './bear.js';
import { HUT, HUT_PIECES, PALMS } from '../beach.js';

const frameOf = (phase, n) => ((Math.floor((phase / TAU) * n) % n) + n) % n;

function canvasTex(THREE, w, h, paint) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function placeBetween(THREE, o, a, b) {
  o.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  o.scale.set(1, d.length(), 1);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
}

// Cilindro de raio r entre dois pontos, reposicionável a cada pose (placeBetween)
function rod(THREE, r, m, r2 = r) {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, 1, 10), m);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

// ---------------------------------------------------------------- Caranguejo gigante
// No lugar do urso. Carapaça larga com pintas, quatro patas de cada lado (coxa,
// joelho alto e ponta fina, andando em ondas alternadas), olhos em hastes, boca e
// duas pinças enormes com ombro, cotovelo e o dedo de cima que abre e estala.
// Usa as mesmas fotos do urso: walk{quadro}{lado}{boca}; boca > 0 = perseguindo.
export const giantCrab = {
  box: bearBox,
  res: 2,
  poses: bearPoses,
  pose: bearPose,
  build(kit) {
    const { THREE, mat, group, sphere, mesh } = kit;
    const shellTex = canvasTex(THREE, 256, 128, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, '#FF9A6A');
      grd.addColorStop(0.45, '#E2532E');
      grd.addColorStop(1, '#9E2E18');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
      const rnd = rng(13);
      for (let i = 0; i < 30; i++) {
        g.fillStyle = `rgba(255, 220, 180, ${0.25 + rnd() * 0.2})`;
        g.beginPath();
        g.arc(rnd() * w, h * (0.1 + rnd() * 0.4), 2 + rnd() * 5, 0, TAU);
        g.fill();
      }
    });
    const shell = new THREE.MeshStandardMaterial({ map: shellTex, roughness: 0.4 });
    const leg = mat('#C8452A', 0.45);
    const legFar = mat('#9E3420', 0.5);
    const claw = mat('#F06A40', 0.4);
    const tip = mat('#FFE2C8', 0.4);
    const white = mat('#FFFFFF', 0.25);
    const ink = mat('#111111', 0.2);
    const dark = mat('#5A1A0E', 0.6);

    const root = group();
    root.rotation.order = 'YXZ';
    const body = group();
    root.add(body);
    // Carapaça (frente = +z), barriga clara e a borda serrilhada
    const cara = sphere(30, shell, 0, 44, 0, 36);
    cara.scale.set(1, 0.66, 1.55);
    body.add(cara);
    const belly = sphere(26, mat('#F2B894', 0.6), 0, 36, 0, 24);
    belly.scale.set(0.98, 0.4, 1.5);
    body.add(belly);
    for (let i = 0; i < 7; i++) {
      for (const s of [-1, 1]) {
        const a = (i / 6 - 0.5) * 1.6;
        const sp = mesh(new THREE.ConeGeometry(2.6, 7, 8), shell, s * Math.cos(a) * 28, 44, Math.sin(a) * 45);
        sp.rotation.z = -s * Math.PI / 2;
        sp.rotation.y = -s * a;
        body.add(sp);
      }
    }
    // Olhos nas hastes e sobrancelhas bravas (só perseguindo)
    const brows = group();
    body.add(brows);
    const eyes = [];
    for (const s of [-1, 1]) {
      body.add(kit.bone(2, [s * 8, 56, 32], [s * 10, 74, 38], leg));
      body.add(sphere(5.2, white, s * 10, 78, 39, 16));
      const pu = sphere(2.4, ink, s * 10.6, 78.4, 43.6, 10);
      body.add(pu);
      eyes.push(pu);
      const brow = mesh(new THREE.CapsuleGeometry(0.9, 6, 4, 8), dark, s * 10, 85, 40);
      brow.rotation.z = Math.PI / 2 - s * 0.5;
      brows.add(brow);
    }
    // Boca: sorrisinho ou aberta (perseguindo)
    const smile = mesh(new THREE.TorusGeometry(5, 0.9, 6, 16, Math.PI * 0.8), dark, 0, 42, 47.5);
    smile.rotation.z = Math.PI * 1.1;
    body.add(smile);
    const mouth = sphere(7, dark, 0, 41, 46.5, 16);
    mouth.scale.set(1, 0.45, 0.35);
    body.add(mouth);
    // Patas: quatro de cada lado; de perto da câmera = lado −x. Cada pata é uma peça
    // contínua achatada (coxa, joelho alto, segunda dobra e a ponta escura), refeita a cada pose
    const legs = [];
    const tipM = mat('#5A1A0E', 0.4);
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const m = s < 0 ? leg : legFar;
        const o = { s, i, hip: [s * 22, 36, -24 + i * 14], limb: kit.sweep(crabLeg([0, 0, 0], [1, 1, 0], [2, 0, 0], [3, -1, 0]), m, { radial: 14, cap: 0.5 }) };
        o.tip = mesh(new THREE.ConeGeometry(2, 7, 8), tipM);
        o.rings = [0, 1].map(() => sphere(4, m, 0, 0, 0, 10));
        root.add(o.limb, o.tip, ...o.rings);
        legs.push(o);
      }
    }
    // Pinças: ombro, braço, cotovelo, antebraço e a mão grande (palma estufada, dedo de
    // baixo fixo e o de cima, que abre na articulação, com dentes por dentro)
    const claws = [];
    for (const s of [-1, 1]) {
      const m = s < 0 ? claw : mat('#D85A34', 0.45);
      const sh = group(s * 20, 44, 36);
      body.add(sh);
      sh.add(kit.sweep([
        { p: [0, 0, -2], w: 5.4, h: 5.4 },
        { p: [s * 5, 4, 7], w: 5, h: 5.6 },
        { p: [s * 10, 8, 14], w: 4.6, h: 5 },
        { p: [s * 8, 10, 22], w: 4.8, h: 5.4 },
        { p: [s * 6, 12, 30], w: 5.4, h: 6 },
      ], m, { radial: 16, cap: 0.6 }));
      const hand = group(s * 6, 12, 30);
      sh.add(hand);
      hand.add(kit.sweep([
        { p: [0, 0, -2], w: 6, h: 7 },
        { p: [0, 0.5, 6], w: 8.4, h: 11 },
        { p: [0, -0.5, 13], w: 7.4, h: 9.4 },
        { p: [0, -2, 17], w: 5, h: 6 },
      ], m, { radial: 22, cap: 0.6 }));
      // Dedo de baixo (fixo), curvo, com dentinhos e a ponta clara
      hand.add(kit.sweep([
        { p: [0, -4, 15], w: 3.6, h: 4.4 },
        { p: [0, -4.6, 22], w: 2.8, h: 3.2 },
        { p: [0, -3.4, 28], w: 1.8, h: 2 },
        { p: [0, -1.4, 31], w: 0.9, h: 0.9 },
      ], m, { radial: 12, cap: 0.6 }));
      hand.add(sphere(1.4, tip, 0, -1.2, 31.6, 8));
      for (let k = 0; k < 3; k++) hand.add(sphere(1.1, tip, 0, -1.4 - k * 0.3, 19 + k * 3.6, 6));
      const finger = group(0, 3, 13);
      hand.add(finger);
      finger.add(kit.sweep([
        { p: [0, 0, 0], w: 3.4, h: 4 },
        { p: [0, 1.6, 7], w: 2.8, h: 3.4 },
        { p: [0, 0.8, 14], w: 1.8, h: 2 },
        { p: [0, -1.8, 18], w: 0.9, h: 0.9 },
      ], m, { radial: 12, cap: 0.6 }));
      finger.add(sphere(1.4, tip, 0, -2, 18.6, 8));
      for (let k = 0; k < 3; k++) finger.add(sphere(1, tip, 0, -1.8 + k * 0.2, 5 + k * 3.6, 6));
      claws.push({ sh, hand, finger, s });
    }
    return { root, body, legs, claws, brows, smile, mouth, kit, THREE };
  },
  apply(rig, p) {
    const { THREE } = rig;
    rig.root.rotation.y = (p.facing === 'L' ? -1 : 1) * (Math.PI / 2 - 0.42);
    const u = p.u;
    // Corpo baixo, perto do chão, com as patas dobradas para os lados
    const bob = Math.cos(u * TAU * 2) * 1.2 - 8;
    rig.body.position.y = bob;
    rig.body.rotation.z = Math.sin(u * TAU * 2) * 0.03;
    // Patas em onda: cada uma meio ciclo atrás da vizinha, lados alternados
    for (const l of rig.legs) {
      const ph = u * TAU + l.i * 1.4 + (l.s > 0 ? Math.PI : 0);
      const swing = Math.sin(ph) * 7;
      const lift = Math.max(0, -Math.cos(ph)) * 7;
      const hip = [l.hip[0], l.hip[1] + bob, l.hip[2]];
      // Em leque: as da frente apontam para a frente e as de trás para trás
      const knee = [l.s * 38, 50 + bob + lift * 0.5, l.hip[2] * 1.45 + swing * 0.5];
      const wrist = [l.s * 48, 24 + lift * 0.8, l.hip[2] * 1.85 + swing * 0.8];
      const foot = [l.s * 51, 4 + lift, l.hip[2] * 2.1 + swing];
      rig.kit.resweep(l.limb, crabLeg(hip, knee, wrist, foot), { radial: 14, cap: 0.5 });
      // Ponta escura e afiada, apontando para o chão
      const d = new THREE.Vector3(foot[0] - wrist[0], foot[1] - wrist[1], foot[2] - wrist[2]).normalize();
      l.tip.position.set(foot[0] + d.x * 3, foot[1] + d.y * 3, foot[2] + d.z * 3);
      l.tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
      l.rings[0].position.set(...knee);
      l.rings[1].position.set(...wrist);
      l.rings[1].scale.setScalar(0.75);
    }
    const chasing = p.mouth > 0;
    // Estala as pinças perseguindo (as duas bocas da foto = dois momentos da pinça)
    const snap = chasing ? (p.mouth > 0.4 ? 0.75 : 0.1) : 0.3;
    for (const c of rig.claws) {
      c.sh.rotation.x = -Math.sin(u * TAU * 2 + (c.s > 0 ? 1 : 0)) * 0.08 - (chasing ? 0.15 : 0);
      c.finger.rotation.x = -snap * 0.7;
    }
    rig.brows.visible = chasing;
    rig.smile.visible = !chasing;
    rig.mouth.visible = chasing;
    rig.mouth.scale.y = p.mouth > 0.4 ? 0.65 : 0.4;
  },
};

// Pata do caranguejo: achatada (mais alta que grossa), da coxa ao joelho alto, a
// segunda dobra e a ponta fina
export function crabLeg(hip, knee, wrist, foot) {
  const mid = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  return [
    { p: mid(knee, hip, 1.15), w: 4.4, h: 5.6 },
    { p: hip, w: 4.4, h: 6 },
    { p: mid(hip, knee, 0.5), w: 4.2, h: 6.6 },
    { p: knee, w: 3.6, h: 4.6 },
    { p: mid(knee, wrist, 0.5), w: 3.4, h: 5.2 },
    { p: wrist, w: 2.8, h: 3.6 },
    { p: mid(wrist, foot, 0.6), w: 2.4, h: 3.4 },
    { p: foot, w: 1.8, h: 2.2 },
  ];
}

// ---------------------------------------------------------------- Gaivota
// Apoio: centro do corpo (c.x, y − 32 + balanço). Corpo branco, asas cinza em duas
// partes (a ponta preta vem atrasada), bico amarelo com a pintinha vermelha
const GULL_FRAMES = 8;
export const gull = {
  box: { left: -46, right: 46, top: 40, bottom: -30 },
  res: 2.4,
  elevation: 0.25,
  pose: (c, t) => `${frameOf(t * 9 + c.ph * 3 + Math.PI / 2, GULL_FRAMES)}${c.dir < 0 ? 'L' : 'R'}`,
  poses() {
    const out = [];
    for (const f of ['R', 'L']) {
      for (let i = 0; i < GULL_FRAMES; i++) {
        const ph = ((i + 0.5) / GULL_FRAMES) * TAU - Math.PI / 2;
        out.push({ key: `${i}${f}`, f, flap: Math.sin(ph), lag: Math.sin(ph - 0.9) });
      }
    }
    return out;
  },
  build({ mat, group, sphere, mesh, THREE }) {
    const white = mat('#FFFFFF', 0.7);
    const grey = mat('#C5CED6', 0.7);
    const greyDark = mat('#9AA6B0', 0.75);
    const black = mat('#22262C', 0.6);
    const yellow = mat('#F6C23A', 0.4);
    const ink = mat('#1D2A33', 0.2);
    const root = group();
    root.rotation.order = 'YXZ';
    const body = sphere(7, white, 0, 0, 0, 22);
    body.scale.set(0.95, 0.9, 2);
    root.add(body);
    const tail = mesh(new THREE.ConeGeometry(4, 9, 10), grey, 0, 1, -16);
    tail.rotation.x = -Math.PI / 2;
    tail.scale.set(1, 1, 0.4);
    root.add(tail);
    const head = group(0, 4, 13);
    root.add(head);
    head.add(sphere(5, white, 0, 1, 1, 16));
    const beak = mesh(new THREE.ConeGeometry(1.6, 8, 10), yellow, 0, 0, 8.5);
    beak.rotation.x = Math.PI / 2;
    head.add(beak);
    head.add(sphere(0.9, mat('#D9302A', 0.4), 0, -0.6, 9, 6));
    for (const s of [-1, 1]) head.add(sphere(1, ink, s * 3.4, 2.4, 3.6, 8));
    const wings = [];
    for (const s of [-1, 1]) {
      const hinge = group(s * 4, 3, 2);
      const w = sphere(7, s < 0 ? grey : greyDark, s * 7.5, 0, -1, 16);
      w.scale.set(1.25, 0.18, 0.8);
      hinge.add(w);
      const elbow = group(s * 15, 0, -1);
      hinge.add(elbow);
      const hand = sphere(7, s < 0 ? grey : greyDark, s * 7, 0, -2.5, 16);
      hand.scale.set(1.3, 0.16, 0.6);
      elbow.add(hand);
      const tipM = sphere(4.4, black, s * 14, 0, -4, 10);
      tipM.scale.set(1.2, 0.2, 0.5);
      elbow.add(tipM);
      root.add(hinge);
      wings.push({ hinge, elbow, s });
    }
    return { root, wings, head };
  },
  apply(rig, p) {
    rig.root.rotation.y = (p.f === 'L' ? -1 : 1) * (Math.PI / 2 - 0.4);
    rig.root.rotation.x = 0.2;
    for (const w of rig.wings) {
      w.hinge.rotation.z = w.s * (0.15 + p.flap * 0.7);
      w.elbow.rotation.z = w.s * (0.1 - p.lag * 0.5);
    }
    rig.head.rotation.x = p.flap * 0.1;
  },
};

// ---------------------------------------------------------------- Siri
// Apoio: (c.x, y − 2), em pé na prancha. Carapaça azul larga com pontas dos lados,
// seis patinhas com joelho, os remos de trás, pinças de ponta vermelha que abrem e
// os olhinhos nas hastes
const SIRI_FRAMES = 6;
export const siri = {
  box: { left: -34, right: 34, top: 36, bottom: -6 },
  res: 2.6,
  elevation: 0.4,
  pose: (c, t) => `${frameOf(t * 18 + c.ph, SIRI_FRAMES)}${Math.min(2, Math.floor(Math.abs(Math.sin(t * 7 + c.ph)) * 2.99))}`,
  poses() {
    const out = [];
    for (let i = 0; i < SIRI_FRAMES; i++) {
      for (let o = 0; o < 3; o++) out.push({ key: `${i}${o}`, ph: ((i + 0.5) / SIRI_FRAMES) * TAU, open: [0.1, 0.35, 0.6][o] });
    }
    return out;
  },
  build({ THREE, mat, group, sphere, bone, mesh }) {
    const blue = mat('#3C7FD0', 0.4);
    const light = mat('#6FA8EE', 0.4);
    const legM = mat('#2C5E9E', 0.5);
    const red = mat('#E2543A', 0.4);
    const root = group();
    const cara = sphere(15, blue, 0, 12, 0, 26);
    cara.scale.set(1.15, 0.45, 0.75);
    root.add(cara);
    const top = sphere(12, light, 0, 14, 1, 20);
    top.scale.set(1.1, 0.35, 0.65);
    root.add(top);
    for (const s of [-1, 1]) {
      const sp = mesh(new THREE.ConeGeometry(2, 7, 8), blue, s * 18.5, 12.5, 0);
      sp.rotation.z = -s * Math.PI / 2;
      root.add(sp);
    }
    const legs = [];
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const o = { s, i, thigh: rod(THREE, 1.2, legM, 1), shin: rod(THREE, 1, legM, 0.6), knee: sphere(1.3, legM, 0, 0, 0, 8) };
        for (const k of [o.thigh, o.shin, o.knee]) root.add(k);
        legs.push(o);
      }
      // Remo de trás (pata de nadar)
      const pad = sphere(3.6, light, s * 20, 6, -6, 10);
      pad.scale.set(1.2, 0.35, 0.7);
      root.add(pad);
    }
    const claws = [];
    for (const s of [-1, 1]) {
      root.add(bone(1.6, [s * 9, 12, 6], [s * 17, 19, 8], legM));
      const hand = group(s * 18, 21, 9);
      hand.rotation.y = s * 0.5;
      root.add(hand);
      const palm = sphere(4, mat('#4A86D6', 0.4), 0, 0, 0, 12);
      palm.scale.set(0.8, 0.75, 1.1);
      hand.add(palm);
      const low = sphere(2.6, red, 0, -1.4, 5, 10);
      low.scale.set(0.6, 0.5, 1.4);
      hand.add(low);
      const finger = group(0, 1, 3);
      hand.add(finger);
      const up = sphere(2.6, red, 0, 0.6, 3, 10);
      up.scale.set(0.6, 0.5, 1.4);
      finger.add(up);
      claws.push(finger);
      root.add(bone(0.7, [s * 4, 16, 8], [s * 4.5, 23, 9], legM));
      root.add(sphere(1.9, mat('#111111', 0.2), s * 4.5, 24, 9.5, 8));
    }
    return { root, legs, claws, THREE };
  },
  apply(rig, p) {
    const { THREE } = rig;
    // Visto de frente (anda de lado, como os siris), um pouco de cima
    rig.root.rotation.y = 0;
    for (const l of rig.legs) {
      const k = Math.sin(p.ph + (l.i % 2 ? Math.PI : 0));
      const lift = Math.max(0, k) * 3;
      const hip = [l.s * (8 + l.i * 3), 9, -4 + l.i * 3];
      const knee = [l.s * (15 + l.i * 3), 14 + lift, -4 + l.i * 3];
      const foot = [l.s * (20 + l.i * 3) + k * 2, lift * 0.5, -4 + l.i * 3];
      placeBetween(THREE, l.thigh, hip, knee);
      placeBetween(THREE, l.shin, knee, foot);
      l.knee.position.set(...knee);
    }
    for (const f of rig.claws) f.rotation.x = -p.open;
  },
};

// ---------------------------------------------------------------- Água-viva
// Apoio: (c.x, y + 2 − pulso). Sino rosa translúcido que pulsa (achata e estica),
// carinha, brilho por dentro e tentáculos em cadeia ondulando
const JELLY_FRAMES = 8;
export const jellyfish = {
  box: { left: -26, right: 26, top: 26, bottom: -22 },
  res: 2.8,
  elevation: 0.3,
  pose: (c, t) => `${frameOf(t * 4 + c.ph, JELLY_FRAMES)}`,
  poses() {
    return Array.from({ length: JELLY_FRAMES }, (_, i) => ({ key: `${i}`, ph: ((i + 0.5) / JELLY_FRAMES) * TAU }));
  },
  build({ THREE, mat, group, sphere }) {
    const root = group();
    const bellM = mat('#F48FC8', 0.15, { transparent: true, opacity: 0.72, emissive: '#C04A90', emissiveIntensity: 0.35, side: THREE.DoubleSide });
    const bell = new THREE.Mesh(new THREE.SphereGeometry(16, 32, 14, 0, TAU, 0, Math.PI / 2), bellM);
    bell.castShadow = true;
    root.add(bell);
    const core = sphere(8, mat('#FFD0EA', 0.2, { emissive: '#FF9AD0', emissiveIntensity: 0.6, transparent: true, opacity: 0.8 }), 0, 4, 0, 16);
    core.scale.set(1, 0.6, 1);
    root.add(core);
    for (const s of [-1, 1]) root.add(sphere(1.5, mat('#7A1E5A', 0.3), s * 4, 7, 13.5, 8));
    const shine = sphere(3, mat('#FFFFFF', 0.1, { transparent: true, opacity: 0.6 }), -6, 11, 9, 10);
    shine.scale.set(1, 0.5, 0.4);
    root.add(shine);
    const tentM = mat('#F7A6D4', 0.3, { transparent: true, opacity: 0.85 });
    const tentacles = [];
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU;
      const segs = [];
      for (let j = 0; j < 4; j++) {
        const r = rod(THREE, 1.1 - j * 0.2, tentM, 1 - j * 0.2);
        root.add(r);
        segs.push(r);
      }
      tentacles.push({ a, segs });
    }
    return { root, bell, core, tentacles, THREE };
  },
  apply(rig, p) {
    const { THREE } = rig;
    const pulse = Math.sin(p.ph);
    rig.bell.scale.set(1 + pulse * 0.12, 1 - pulse * 0.18, 1 + pulse * 0.12);
    for (const tt of rig.tentacles) {
      let x = Math.cos(tt.a) * 11 * (1 + pulse * 0.12);
      let z = Math.sin(tt.a) * 7;
      let y = 0;
      tt.segs.forEach((sg, j) => {
        const nx = x + Math.sin(p.ph * 1.0 + tt.a * 3 + j) * 2.2;
        const ny = y - 4.5;
        const nz = z + Math.cos(p.ph + tt.a + j) * 1.2;
        placeBetween(THREE, sg, [x, y, z], [nx, ny, nz]);
        x = nx;
        y = ny;
        z = nz;
      });
    }
  },
};

// ---------------------------------------------------------------- Peixinho tropical
// No lugar do peixe: corpo alto amarelo com listras azuis, barbatana laranja, cauda
// azul em duas partes. Apoio: centro do corpo, pulando como o 2D
const TFISH_FRAMES = 6;
export const tfish = {
  box: { left: -30, right: 30, top: 24, bottom: -20 },
  res: 2.6,
  elevation: 0.2,
  pose: (c, t) => `${frameOf(t * 16 + c.ph, TFISH_FRAMES)}${c.dir < 0 ? 'L' : 'R'}`,
  poses() {
    const out = [];
    for (const f of ['R', 'L']) for (let i = 0; i < TFISH_FRAMES; i++) out.push({ key: `${i}${f}`, f, wig: Math.sin(((i + 0.5) / TFISH_FRAMES) * TAU) * 0.35 });
    return out;
  },
  build({ THREE, mat, group, sphere, mesh }) {
    const tex = canvasTex(THREE, 128, 64, (g, w, h) => {
      g.fillStyle = '#FFD23F';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#2B6FD6';
      // Listras verticais (atravessam o corpo de cima a baixo)
      for (const x of [0.3, 0.45, 0.8, 0.95]) g.fillRect(w * x - 4, 0, 7, h);
    });
    const yellow = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35 });
    const blue = mat('#2B6FD6', 0.4, { side: THREE.DoubleSide });
    const orange = mat('#FF8A3D', 0.4, { side: THREE.DoubleSide });
    const root = group();
    root.rotation.order = 'YXZ';
    const body = sphere(9, yellow, 0, 0, 0, 26);
    body.scale.set(0.55, 1, 1.35);
    root.add(body);
    const shape = (pts) => {
      const s = new THREE.Shape();
      pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
      return new THREE.ShapeGeometry(s);
    };
    const dorsal = mesh(shape([[-5, 7], [1, 14], [5, 7]]), orange);
    dorsal.rotation.y = -Math.PI / 2;
    root.add(dorsal);
    const tail = group(0, 0, -11);
    root.add(tail);
    const ped = sphere(3.2, yellow, 0, 0, -1.5, 12);
    ped.scale.set(0.55, 0.9, 1.2);
    tail.add(ped);
    const fin = group(0, 0, -4);
    tail.add(fin);
    const tf = mesh(shape([[0, 0], [-9, 7], [-7, 0], [-9, -7]]), blue);
    tf.rotation.y = -Math.PI / 2;
    fin.add(tf);
    for (const s of [-1, 1]) {
      root.add(sphere(2.6, mat('#FFFFFF', 0.2), s * 4.2, 2, 8, 12));
      root.add(sphere(1.3, mat('#111111', 0.2), s * 5.2, 2, 9, 8));
      const pec = mesh(shape([[0, 0], [-5, 2], [-4, -2]]), orange, s * 4.6, -2, 3);
      pec.rotation.y = s * 0.4 - Math.PI / 2;
      root.add(pec);
    }
    return { root, tail, fin };
  },
  apply(rig, p) {
    rig.root.rotation.y = (p.f === 'L' ? -1 : 1) * (Math.PI / 2 - 0.35);
    rig.tail.rotation.y = p.wig * 0.6;
    rig.fin.rotation.y = p.wig * 0.9;
  },
};

// ---------------------------------------------------------------- Pranchas e boias
// Mesmas medidas do sprite 2D (boardSprite): pés em y = 0, 22 abaixo do topo da foto,
// altura 62. Prancha de surfe com o bico e a rabeta arredondados, borda, faixa no
// meio, logotipo de onda e quilha; nos pedaços curtos das fases pares, boia
// salva-vidas (anel vermelho com faixas brancas). Acesa: cores vivas e brilho do sol.
export const BOARD = { PAD: 12, TOP: 22, H: 62 };
export const BOARD_SCHEMES = [['#FF8A3D', '#FFD45C'], ['#2FB5E8', '#FFFFFF'], ['#F25C8A', '#FFE08A'], ['#4CC77A', '#FFF3C2']];
const boards = new Map();
export function boardSubject(w) {
  if (boards.has(w)) return boards.get(w);
  const S = {
    box: { left: -BOARD.PAD, right: w + BOARD.PAD, top: BOARD.TOP, bottom: BOARD.TOP - BOARD.H },
    res: 2.2,
    elevation: 0.5,
    poses() {
      const out = [];
      for (let v = 0; v < BOARD_SCHEMES.length; v++) for (const on of [0, 1]) out.push({ key: `${v}${on}`, v, on });
      if (w < 50) for (const on of [0, 1]) out.push({ key: `b${on}`, v: 'b', on });
      return out;
    },
    build(kit) {
      return buildBoards(kit, w);
    },
    apply(rig, p) {
      for (const [k, g] of Object.entries(rig.variants)) g.visible = k === String(p.v);
      for (const [m, off, on] of rig.swaps) m.material = p.on ? on : off;
    },
  };
  boards.set(w, S);
  return S;
}

function buildBoards(kit, w) {
  const { THREE, group, mat, mesh } = kit;
  const root = group();
  const variants = {};
  const swaps = [];
  const deckY = 1.5;
  const foam = mat('#FFFFFF', 0.6, { transparent: true, opacity: 0.55, depthWrite: false });
  const ringFoam = (rx, rz) => {
    const r = mesh(new THREE.RingGeometry(0.92, 1, 40), foam, w / 2, -4.5, 0);
    r.rotation.x = -Math.PI / 2;
    r.scale.set(rx, rz, 1);
    r.castShadow = false;
    return r;
  };
  BOARD_SCHEMES.forEach(([base, stripe], v) => {
    const g = group();
    // Contorno visto de cima: bico (direita) mais fino, rabeta (esquerda) mais larga
    const half = (x) => {
      const u = x / w;
      return 7.5 * Math.sin(Math.PI * Math.min(1, Math.max(0, u * 0.92 + 0.04))) ** 0.6 * (1 - 0.25 * u);
    };
    const shape = new THREE.Shape();
    const N = 30;
    for (let i = 0; i <= N; i++) {
      const x = -2 + ((w + 4) * i) / N;
      if (i) shape.lineTo(x, half(x));
      else shape.moveTo(x, half(x));
    }
    for (let i = N; i >= 0; i--) {
      const x = -2 + ((w + 4) * i) / N;
      shape.lineTo(x, -half(x));
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 2.4, bevelEnabled: true, bevelThickness: 1.3, bevelSize: 1.2, bevelSegments: 3, curveSegments: 4 });
    // Deitada (o contorno fica no plano xz) e com o bico levantado (rocker)
    geo.rotateX(Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) / w;
      pos.setY(i, pos.getY(i) + Math.max(0, u - 0.75) ** 2 * 40);
    }
    geo.computeVertexNormals();
    const tex = canvasTex(THREE, 256, 64, (c, cw, ch) => {
      c.fillStyle = base;
      c.fillRect(0, 0, cw, ch);
      c.fillStyle = stripe;
      c.fillRect(0, ch / 2 - 4, cw, 8);
      c.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(cw * 0.62, ch * 0.3, 7, Math.PI, Math.PI * 2.2);
      c.stroke();
    });
    // As coordenadas de textura do Extrude vêm de x e y do contorno (unidades do mundo)
    tex.repeat.set(1 / (w + 8), 1 / 20);
    tex.offset.set(2 / (w + 8), 0.5);
    // Apagada: cores um pouco foscas; acesa: cores vivas e lustrosas (brilho do sol)
    const off = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, color: '#D8D0C4' });
    const on = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.12, emissive: base, emissiveIntensity: 0.18 });
    const rail = mat(stripe, 0.55);
    const railOn = mat(stripe, 0.2, { emissive: stripe, emissiveIntensity: 0.15 });
    const board = mesh(geo, [off, rail]);
    board.position.y = deckY;
    swaps.push([board, [off, rail], [on, railOn]]);
    g.add(board);
    // Quilha embaixo da rabeta
    const finS = new THREE.Shape();
    finS.moveTo(0, 0);
    finS.lineTo(6, -6);
    finS.lineTo(9, 0);
    const fin = mesh(new THREE.ExtrudeGeometry(finS, { depth: 0.8, bevelEnabled: false }), mat('#3A3A44', 0.5), 7, deckY - 2.5, -0.4);
    g.add(fin);
    g.add(ringFoam(w / 2 + 6, 11));
    root.add(g);
    variants[v] = g;
  });
  if (w < 50) {
    // Boia salva-vidas
    const g = group();
    const r = w / 2 + 4;
    const tex = canvasTex(THREE, 256, 32, (c, cw, ch) => {
      c.fillStyle = '#C9372F';
      c.fillRect(0, 0, cw, ch);
      c.fillStyle = '#FFFFFF';
      for (let i = 0; i < 4; i++) c.fillRect((cw * i) / 4 + cw * 0.06, 0, cw * 0.1, ch);
    });
    const off = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 });
    const on = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3, color: '#FFD0C8', emissive: '#FF4A3A', emissiveIntensity: 0.35 });
    const ring = mesh(new THREE.TorusGeometry(r * 0.74, r * 0.22, 16, 40), off, w / 2, -1, 0);
    ring.rotation.x = -Math.PI / 2;
    ring.scale.set(1, 0.85, 0.75);
    swaps.push([ring, off, on]);
    g.add(ring);
    g.add(ringFoam(r + 4, r * 0.8));
    root.add(g);
    variants.b = g;
  }
  return { root, variants, swaps };
}

// ---------------------------------------------------------------- Cabana de palha
// Mesmo lugar, mesmas 16 peças e mesma porta da cabana 2D (src/beach.js): 6 painéis
// de bambu (frente, fundo e laterais), 5 camadas de palha do telhado em pirâmide
// com franja, janela com moldura de bambu e cortininha, 2 tochas e o arremate do
// topo. A porta continua 2D, e as chamas das tochas também (com o brilho que tremula).
// Frente das paredes em z = 0 (no plano da porta 2D). Fotos: "n1".."n15", "lit" e "b0".."b14".
export const HUT_DEPTH = 64;
export const hut = {
  box: { left: -150, right: 150, top: 184, bottom: -20 },
  res: 1.5,
  elevation: 0.2,
  poses() {
    const out = [];
    for (let n = 1; n < HUT_PIECES.length; n++) out.push({ key: `n${n}`, upto: n });
    out.push({ key: 'lit', upto: HUT_PIECES.length - 1, lit: true });
    for (let i = 0; i < HUT_PIECES.length - 1; i++) out.push({ key: `b${i}`, only: i });
    return out;
  },
  build(kit) {
    const { THREE, mat, group, mesh, sphere } = kit;
    const { HW, WALL_H, ROOF, TORCH_X } = HUT;
    const D = HUT_DEPTH;
    const zc = -D / 2;
    const third = (HW * 2) / 3;
    const bambooTex = canvasTex(THREE, 32, 128, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, w, 0);
      grd.addColorStop(0, '#E8C77E');
      grd.addColorStop(0.5, '#D2A75C');
      grd.addColorStop(1, '#B08844');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(120, 85, 30, 0.35)';
      for (let y = 0; y < h; y += 9) g.fillRect(0, y, w, 1);
    });
    const bamboo = new THREE.MeshStandardMaterial({ map: bambooTex, roughness: 0.6 });
    const node = mat('#9C7342', 0.6);
    const vine = mat('#6B4A22', 0.8);
    const strawTex = canvasTex(THREE, 256, 64, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, '#E2C068');
      grd.addColorStop(1, '#B98E3C');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
      const rnd = rng(7);
      for (let i = 0; i < 260; i++) {
        g.strokeStyle = rnd() < 0.5 ? 'rgba(120, 85, 30, 0.45)' : 'rgba(255, 235, 170, 0.35)';
        g.lineWidth = 1;
        const x = rnd() * w;
        g.beginPath();
        g.moveTo(x, rnd() * h * 0.3);
        g.lineTo(x + 1.5, h);
        g.stroke();
      }
    });
    strawTex.wrapS = THREE.RepeatWrapping;
    strawTex.repeat.set(4, 1);
    const straw = new THREE.MeshStandardMaterial({ map: strawTex, roughness: 0.9, side: THREE.DoubleSide });
    const fringeM = mat('#C99E48', 0.9);
    const root = group();
    const pieces = [];
    const litSwap = [];
    // Bambu vertical com nós
    const pole = (g, x, y0, y1, z, r = 2.3) => {
      g.add(mesh(new THREE.CylinderGeometry(r, r, y1 - y0, 10), bamboo, x, (y0 + y1) / 2, z));
      for (let y = y0 + 7 + (((x * 7) % 9) + 9) % 9; y < y1 - 3; y += 13) {
        const ring = mesh(new THREE.TorusGeometry(r, 0.5, 5, 10), node, x, y, z);
        ring.rotation.x = Math.PI / 2;
        g.add(ring);
      }
    };
    // Telhado: pirâmide de base quadrada (achatada na profundidade) cortada em 5 faixas
    const band = (ROOF.base - ROOF.peak) / 5;
    const roofHalf = (y) => (ROOF.eave * (y - -ROOF.peak)) / (-ROOF.base - -ROOF.peak);
    const RZ = 0.5; // profundidade do telhado em relação à largura

    for (const p of HUT_PIECES.slice(0, -1)) {
      const g = group();
      if (p.kind === 'wall') {
        const x0 = -HW + third * p.col;
        const y0 = p.row * (WALL_H / 2);
        const y1 = y0 + WALL_H / 2;
        const n = 6;
        const cw = third / n;
        // Bambus encostados uns nos outros (sem frestas) e, atrás deles, a esteira
        // trançada que fecha a parede (a cabana nunca fica vazada)
        const r = cw / 2;
        for (let i = 0; i < n; i++) {
          const x = x0 + cw * (i + 0.5);
          pole(g, x, y0, y1, -r, r);
          pole(g, x, y0, y1, -D + r, r);
        }
        g.add(mesh(new THREE.BoxGeometry(third, y1 - y0, 1.5), mat('#8A6A30', 0.9), x0 + third / 2, (y0 + y1) / 2, -r - 1));
        // Laterais (nas colunas das pontas)
        if (p.col !== 1) {
          const sx = p.col === 0 ? -HW + r : HW - r;
          const k0 = Math.ceil((D - 4 * r) / (2 * r));
          for (let k = 0; k <= k0; k++) pole(g, sx, y0, y1, -2 * r - k * ((D - 4 * r) / k0), r);
          g.add(mesh(new THREE.BoxGeometry(1.5, y1 - y0, D - 2 * r), mat('#8A6A30', 0.9), sx - Math.sign(sx) * (r + 1), (y0 + y1) / 2, -D / 2));
        }
        // Amarração de cipó
        const tie = mesh(new THREE.BoxGeometry(third, 2, 1.2), vine, x0 + third / 2, y1 - 6, 0.6);
        g.add(tie);
      } else if (p.kind === 'thatch') {
        const yb = -(ROOF.base - band * p.i);
        const yt = yb + band;
        const hb = roofHalf(yb) + 4;
        const ht = Math.max(0.5, roofHalf(yt) + 2);
        const geo = new THREE.CylinderGeometry(ht * Math.SQRT2, hb * Math.SQRT2, yt - yb + 3, 4, 1, true);
        geo.rotateY(Math.PI / 4);
        const o = mesh(geo, straw, 0, (yb + yt) / 2 - 1.5, zc);
        o.scale.z = RZ;
        g.add(o);
        // Franja pendurada na borda de baixo (fios de palha)
        const per = [];
        for (let k = 0; k < 40; k++) {
          const u = k / 40;
          // Volta no retângulo da borda: frente, lado direito, fundo, lado esquerdo
          const side = Math.floor(u * 4);
          const f = u * 4 - side;
          const ex = [-hb + 2 * hb * f, hb, hb - 2 * hb * f, -hb][side];
          const ez = [hb, hb - 2 * hb * f, -hb, -hb + 2 * hb * f][side] * RZ;
          per.push([ex, ez]);
        }
        for (const [ex, ez] of per) {
          const strand = mesh(new THREE.ConeGeometry(2.6, 8, 4), fringeM, ex, yb - 3.5, zc + ez);
          strand.rotation.x = Math.PI;
          g.add(strand);
        }
      } else if (p.kind === 'window') {
        const x = -57;
        const y = 42;
        const pane = mesh(new THREE.BoxGeometry(30, 24, 1), mat('#3A2C1C', 0.8), x, y, 0.4);
        litSwap.push([pane, pane.material, mat('#FFC46E', 0.3, { emissive: '#FF9A30', emissiveIntensity: 1 })]);
        g.add(pane);
        for (const [dx, dy, w, h] of [[0, 13.5, 36, 3.5], [0, -13.5, 36, 3.5], [-16.5, 0, 3.5, 24], [16.5, 0, 3.5, 24]]) {
          const o = mesh(new THREE.CylinderGeometry(1.8, 1.8, Math.max(w, h), 8), bamboo, x + dx, y + dy, 1.6);
          if (w > h) o.rotation.z = Math.PI / 2;
          g.add(o);
        }
        // Cortininha vermelha amarrada de lado
        const cs = new THREE.Shape();
        cs.moveTo(0, 0);
        cs.lineTo(9, 0);
        cs.quadraticCurveTo(4, -9, 2, -22);
        cs.lineTo(0, -22);
        const curtain = mesh(new THREE.ShapeGeometry(cs), mat('#E5484D', 0.8, { side: THREE.DoubleSide }), x - 15, y + 11, 1.2);
        g.add(curtain);
      } else if (p.kind === 'torch') {
        const x = p.side * TORCH_X;
        pole(g, x, 0, 64, zc + 18, 2.4);
        const cup = mesh(new THREE.CylinderGeometry(5.5, 3.5, 8, 12), mat('#6B4A22', 0.8), x, 66, zc + 18);
        g.add(cup);
        // Brasa no topo (a chama e o brilho são 2D por cima)
        g.add(sphere(3.4, mat('#FF8A2A', 0.4, { emissive: '#FF6A00', emissiveIntensity: 1.2 }), x, 70, zc + 18, 10));
      } else if (p.kind === 'peak') {
        const top = -ROOF.peak;
        const bundle = mesh(new THREE.ConeGeometry(9, 22, 10), fringeM, 0, top + 6, zc);
        g.add(bundle);
        const tie = mesh(new THREE.TorusGeometry(5.2, 1.4, 6, 14), vine, 0, top + 1.5, zc);
        tie.rotation.x = Math.PI / 2;
        g.add(tie);
      }
      root.add(g);
      pieces.push(g);
    }
    return { root, pieces, litSwap };
  },
  apply(rig, p) {
    rig.pieces.forEach((g, i) => (g.visible = p.only != null ? i === p.only : i < p.upto));
    for (const [m, off, on] of rig.litSwap) m.material = p.lit ? on : off;
  },
};

// ---------------------------------------------------------------- Coqueiros e guarda-sol
// Coqueiro: uma foto por coqueiro (altura e inclinação próprias), base em (0, 0).
// Tronco curvo em gomos, cocos e folhas arqueadas com folíolos. O balanço do vento
// é um giro da foto no desenho.
export const palms = PALMS.map((P, k) => ({
  box: { left: -110, right: 110, top: P.h + 70, bottom: -10 },
  res: 1.8,
  elevation: 0.15,
  poses: () => [{ key: 'p' }],
  build({ THREE, mat, group, mesh, sphere }) {
    const root = group();
    const tx = Math.sin(P.lean) * P.h;
    const top = [tx, P.h, 0];
    const ctrl = [tx * 0.2, P.h * 0.55, 0];
    const at = (u) => [2 * (1 - u) * u * ctrl[0] + u * u * top[0], 2 * (1 - u) * u * ctrl[1] + u * u * top[1], 0];
    const barkA = mat('#B88A52', 0.85);
    const barkB = mat('#9C7342', 0.9);
    for (let i = 0; i < 14; i++) {
      const u = i / 14;
      const p = at(u);
      const q = at((i + 1) / 14);
      const r = 7 - u * 2.4;
      const seg = rod(THREE, r, i % 2 ? barkB : barkA, r * 0.86);
      placeBetween(THREE, seg, p, q);
      root.add(seg);
      const ring = mesh(new THREE.TorusGeometry(r * 0.95, 1, 6, 16), barkB, ...p);
      ring.quaternion.copy(seg.quaternion);
      ring.rotateX(Math.PI / 2);
      root.add(ring);
    }
    for (const [dx, dz, dy] of [[-4, 3, -4], [4, 2, -5], [0, -3, -9], [1, 5, -9]]) root.add(sphere(4.6, mat('#6B4A22', 0.6), tx + dx, P.h + dy, dz, 12));
    // Folhas: talo arqueado e folíolos em espinha de peixe dos dois lados
    const leafA = mat('#2F9E4A', 0.6, { side: THREE.DoubleSide });
    const leafB = mat('#3DB35A', 0.6, { side: THREE.DoubleSide });
    const stem = mat('#4A7A2A', 0.7);
    for (let i = 0; i < 9; i++) {
      const yaw = (i / 9) * TAU + k;
      const len = 58 + (i % 2) * 12;
      const dir = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw) * 0.8);
      const pts = [];
      for (let j = 0; j <= 8; j++) {
        const s = j / 8;
        pts.push(new THREE.Vector3(tx + dir.x * len * s, P.h + 6 + Math.sin(s * Math.PI * 0.8) * 16 - s * s * 34, dir.z * len * s));
      }
      root.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.9, 5), stem));
      const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
      for (let j = 1; j < 8; j++) {
        const a = pts[j];
        const b = pts[j + 1];
        const fl = 14 * Math.sin((j / 8) * Math.PI) + 4;
        for (const s of [-1, 1]) {
          const tipP = a.clone().addScaledVector(side, s * fl).add(new THREE.Vector3(0, -6, 0)).addScaledVector(dir, 4);
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.Float32BufferAttribute([...a.toArray(), ...b.toArray(), ...tipP.toArray()], 3));
          geo.computeVertexNormals();
          const leaf = new THREE.Mesh(geo, (i + j) % 2 ? leafA : leafB);
          leaf.castShadow = true;
          root.add(leaf);
        }
      }
    }
    return { root };
  },
  apply() {},
}));

// Guarda-sol listrado, cadeira de praia e castelo de areia com bandeirinha (base do
// guarda-sol em (0, 0), como no 2D)
export const parasol = {
  box: { left: -70, right: 60, top: 100, bottom: -12 },
  res: 2,
  elevation: 0.2,
  poses: () => [{ key: 'u' }],
  build({ THREE, mat, group, mesh, sphere, bone }) {
    const root = group();
    root.add(bone(1.3, [0, 0, 0], [-6, 78, 0], mat('#E8E2D2', 0.5)));
    // Copa em gomos vermelhos e brancos, inclinada
    const canopy = group(-6, 78, 0);
    canopy.rotation.z = 0.12;
    canopy.rotation.x = 0.15;
    root.add(canopy);
    for (let i = 0; i < 8; i++) {
      const geo = new THREE.SphereGeometry(48, 6, 6, (i * TAU) / 8, TAU / 8, 0, 0.75);
      const o = mesh(geo, mat(i % 2 ? '#FFFFFF' : '#E5484D', 0.6, { side: THREE.DoubleSide }), 0, -38, 0);
      o.scale.set(1, 0.75, 1);
      canopy.add(o);
    }
    canopy.add(sphere(2.2, mat('#E8E2D2', 0.5), 0, 0.6, 0, 8));
    // Cadeira: armação de madeira e lona azul
    const wood = mat('#8A6A3E', 0.7);
    for (const z of [-7, 7]) {
      root.add(bone(1, [-34, 0, z], [-20, 14, z], wood));
      root.add(bone(1, [-14, 0, z], [-28, 18, z], wood));
      root.add(bone(1, [-38, 30, z], [-24, 14, z], wood));
    }
    const seat = mesh(new THREE.PlaneGeometry(16, 20), mat('#3FA9D9', 0.7, { side: THREE.DoubleSide }), -30, 22, 0);
    seat.rotation.set(0, Math.PI / 2, 1.05);
    root.add(seat);
    // Castelo de areia: muralha, duas torres com ameias, portinha e a bandeirinha
    const sand = mat('#E8C98A', 0.95);
    const g = group(29, 0, 6);
    root.add(g);
    g.add(mesh(new THREE.BoxGeometry(22, 12, 12), sand, 0, 6, 0));
    for (const [x, h] of [[-6, 20], [6, 22]]) {
      g.add(mesh(new THREE.CylinderGeometry(3.6, 4.2, h, 12), sand, x, h / 2, 0));
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * TAU;
        g.add(mesh(new THREE.BoxGeometry(2, 2.4, 2), sand, x + Math.cos(a) * 3, h + 1.2, Math.sin(a) * 3));
      }
    }
    g.add(mesh(new THREE.BoxGeometry(4, 6, 1), mat('#C9A866', 0.95), 0, 3, 6.1));
    g.add(bone(0.4, [6, 22, 0], [6, 32, 0], wood));
    const flagS = new THREE.Shape();
    flagS.moveTo(0, 0);
    flagS.lineTo(7, -3);
    flagS.lineTo(0, -6);
    g.add(mesh(new THREE.ShapeGeometry(flagS), mat('#E5484D', 0.6, { side: THREE.DoubleSide }), 6, 32, 0));
    return { root };
  },
  apply() {},
};
