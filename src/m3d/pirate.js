// Piratas em 3D (fase 35): crocodilo pirata de quatro patas articuladas (bandana de
// bolinhas, tapa-olho e a bocarra que abre na perseguição), papagaio de asas em duas
// partes, polvo com os tentáculos ondulando, tubarão cortando a água, garrafa com
// mensagem, barris boiando no lugar das placas (acesos = aros dourados), o forte
// pirata montado peça por peça e os enfeites da praia (baú do tesouro, canhão e âncora).
// Mesmos pontos de apoio do desenho 2D (src/pirate.js); y para cima.
import { TAU } from './kit.js';
import { LEGS, solveLeg, bearPose, poses as bearPoses } from './bear.js';
import { FORT, FORT_PIECES, BARREL } from '../pirate.js';

const frameOf = (phase, n) => ((Math.floor((phase / TAU) * n) % n) + n) % n;
const side = (f) => (f === 'L' ? -1 : 1);

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

function rod(THREE, r0, r1, m, seg = 10) {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 1, seg), m);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

// ---------------------------------------------------------------- Crocodilo pirata
// No lugar do urso. Corpo, pescoço e rabo numa peça só (o rabo balança e é refeito a
// cada pose), escamas em fileira nas costas, cabeça de focinho comprido com os dentes
// para fora, a mandíbula articulada, olho amarelo de um lado e o tapa-olho do outro,
// bandana vermelha de bolinhas com o nó atrás. Patas curtas e abertas para os lados,
// com joelho, e pés de dedos com garras, no mesmo passo do urso (as mesmas fotos
// walk{quadro}{lado}{boca}).
export const CROC_BOX = { left: -112, right: 112, top: 74, bottom: -22 };
export const croc = {
  box: CROC_BOX,
  res: 2,
  poses: bearPoses,
  pose: bearPose,
  build(kit) {
    const { THREE, mat, group, sphere, mesh, sweep } = kit;
    const skin = new THREE.MeshStandardMaterial({ map: crocTexture(THREE, 5), roughness: 0.55 });
    skin.map.repeat.set(1, 4);
    const skinHead = new THREE.MeshStandardMaterial({ map: crocTexture(THREE, 9), roughness: 0.5 });
    const legNear = mat('#5E9234', 0.6);
    const legFar = mat('#466E26', 0.62);
    const scute = mat('#3E6420', 0.6);
    const claw = mat('#E8DFC4', 0.35);
    const tooth = mat('#FFF8E6', 0.3);
    const mouthM = mat('#8A2A2A', 0.6);
    const tongue = mat('#D0606A', 0.5);
    const bandanaM = new THREE.MeshStandardMaterial({ map: dotsTexture(THREE), roughness: 0.75, side: THREE.DoubleSide });
    const root = group();
    root.rotation.order = 'YXZ';
    const body = group();
    root.add(body);
    const trunk = sweep(crocSpine(0), skin, { radial: 24, cap: 0.7 });
    body.add(trunk);
    // Escamas em fileira dupla nas costas (no corpo; as do rabo vão com o rabo)
    for (let i = 0; i < 8; i++) {
      const z = -40 + i * 9;
      for (const s of [-1, 1]) {
        const c = mesh(new THREE.ConeGeometry(2.3, 4.2, 6), scute, s * 4.2, 33 - Math.abs(z + 5) * 0.03, z);
        c.rotation.x = -0.25;
        body.add(c);
      }
    }
    // Escamas da crista do rabo (acompanham o rabo, que balança)
    const tailScutes = [];
    for (let i = 0; i < 9; i++) {
      const c = mesh(new THREE.ConeGeometry(1.8 - i * 0.12, 3.6 - i * 0.2, 6), scute);
      body.add(c);
      tailScutes.push(c);
    }
    // Cabeça (gira no pescoço; a mandíbula, na articulação de trás)
    const head = group(0, 25, 38);
    body.add(head);
    head.add(sweep([
      { p: [0, 1, -6], w: 11, h: 9, hb: 4 },
      { p: [0, 2, 4], w: 10.5, h: 8, hb: 3.5 },
      { p: [0, 1.4, 16], w: 7.5, h: 5, hb: 3 },
      { p: [0, 1, 30], w: 6.6, h: 4, hb: 2.6 },
      { p: [0, 1.2, 40], w: 6.8, h: 4, hb: 2.6 },
    ], skinHead, { radial: 22, cap: 0.6 }));
    // Olhos no alto da cabeça: amarelo de um lado, tapa-olho do outro (com a tira)
    for (const s of [-1, 1]) {
      head.add(sphere(4, skinHead, s * 5.5, 7.6, 2, 14));
      if (s < 0) {
        head.add(sphere(2.9, mat('#FFD23A', 0.25, { emissive: '#8A6A00', emissiveIntensity: 0.4 }), s * 6.2, 8.4, 4.4, 12));
        const pupil = sphere(1, mat('#1A1006', 0.2), s * 6.6, 8.6, 7, 8);
        pupil.scale.set(0.6, 1.6, 0.6);
        head.add(pupil);
      } else {
        const patch = sphere(3.4, mat('#141014', 0.5), s * 6.4, 8.4, 4.6, 12);
        patch.scale.set(0.7, 1, 0.9);
        head.add(patch);
      }
      head.add(sphere(1, mat('#2A3A18', 0.4), s * 2.4, 3.6, 41.5, 8)); // narina
    }
    const strap = mesh(new THREE.TorusGeometry(9.4, 0.5, 6, 30), mat('#141014', 0.5), 0, 6, 1);
    strap.rotation.set(Math.PI / 2 - 0.5, 0, 0);
    head.add(strap);
    // Bandana: calota de pano sobre a nuca e o nó atrás com as duas pontas
    const cap = new THREE.Mesh(new THREE.SphereGeometry(11.6, 24, 12, 0, TAU, 0, Math.PI * 0.42), bandanaM);
    cap.position.set(0, 3.5, -4);
    cap.scale.set(1, 0.72, 1.1);
    cap.castShadow = true;
    head.add(cap);
    head.add(sphere(2.6, bandanaM, 0, 8, -15, 10));
    const tails = [];
    for (const s of [-1, 1]) {
      const tl = group(0, 8, -15);
      head.add(tl);
      const flap = mesh(new THREE.BoxGeometry(3.4, 0.8, 11), bandanaM, s * 2, 0, -5.5);
      tl.add(flap);
      tails.push({ tl, s });
    }
    // Dentes de cima saindo para fora do lábio
    for (let i = 0; i < 8; i++) {
      for (const s of [-1, 1]) {
        const tb = mesh(new THREE.ConeGeometry(0.9, 3.2 + (i % 2), 6), tooth, s * (6.6 - i * 0.12), -2.6, 8 + i * 4.2);
        tb.rotation.x = Math.PI;
        head.add(tb);
      }
    }
    // Mandíbula com a boca por dentro, a língua e os dentes de baixo
    const jaw = group(0, -1.6, -2);
    head.add(jaw);
    jaw.add(sweep([
      { p: [0, -2, -2], w: 9.6, h: 3, hb: 3.4 },
      { p: [0, -2.4, 14], w: 7, h: 2.4, hb: 2.6 },
      { p: [0, -2.2, 30], w: 6.2, h: 2, hb: 2.2 },
      { p: [0, -1.8, 41], w: 6.2, h: 2, hb: 2.2 },
    ], skinHead, { radial: 18, cap: 0.6 }));
    const inside = sphere(1, mouthM, 0, -0.6, 20, 14);
    inside.scale.set(5.6, 1.2, 19);
    jaw.add(inside);
    const tng = sphere(1, tongue, 0, -0.2, 12, 10);
    tng.scale.set(3.6, 0.9, 8);
    jaw.add(tng);
    for (let i = 0; i < 8; i++) {
      for (const s of [-1, 1]) jaw.add(mesh(new THREE.ConeGeometry(0.8, 2.8 + ((i + 1) % 2), 6), tooth, s * (5.8 - i * 0.1), 0.6, 10 + i * 4));
    }
    // Patas curtas e abertas (de perto da câmera = lado −x), mesmo passo do urso
    const legs = [];
    for (const [x0, front, phase] of LEGS) {
      const x = Math.sign(x0) * 15;
      const m = x < 0 ? legNear : legFar;
      const limb = sweep(crocLeg(front, [x, 22, 0], [x * 1.2, 14, 0], [x, 8, 0]), m, { radial: 14, cap: 0.6 });
      const foot = group();
      const pad = sphere(4.6, m, 0, 0, 1, 12);
      pad.scale.set(1.3, 0.5, 1.4);
      foot.add(pad);
      for (let k = -1; k <= 1; k++) {
        const c = mesh(new THREE.ConeGeometry(0.8, 3.2, 6), claw, k * 2.6, -0.6, 6.2);
        c.rotation.x = Math.PI / 2;
        foot.add(c);
      }
      root.add(limb, foot);
      legs.push({ x, front, phase, near: x < 0, L1: 11, L2: 10, limb, spine: crocLeg, foot, hip: { y: front ? 22 : 22, z: front ? 18 : -30 } });
    }
    return { root, body, trunk, head, jaw, tails, legs, tailScutes, kit, THREE };
  },
  apply(rig, p) {
    rig.root.rotation.y = (p.facing === 'L' ? -1 : 1) * (Math.PI / 2 - 0.42);
    const u = p.u;
    const bob = Math.cos(u * TAU * 2) * 0.8;
    rig.body.position.y = bob;
    rig.body.rotation.z = Math.sin(u * TAU) * 0.025;
    // O corpo serpenteia de leve e o rabo balança mais na ponta
    const spine = crocSpine(Math.sin(u * TAU) * 7);
    rig.kit.resweep(rig.trunk, spine, { radial: 24, cap: 0.7 });
    // Crista do rabo: escamas ao longo dos pontos do rabo, em cima
    rig.tailScutes.forEach((c, i) => {
      const f = 4.8 - (i / 9) * 4.6;
      const a = spine[Math.min(4, Math.floor(f))];
      const b = spine[Math.min(5, Math.floor(f) + 1)];
      const k = f - Math.floor(f);
      const lerp = (j) => a.p[j] + (b.p[j] - a.p[j]) * k;
      const h = a.h + (b.h - a.h) * k;
      c.position.set(lerp(0), lerp(1) + h * 0.92, lerp(2));
      c.rotation.set(-0.3, 0, 0);
    });
    for (const l of rig.legs) solveLeg(rig, l, (u + l.phase) % 1, bob);
    rig.head.rotation.y = Math.sin(u * TAU + 0.5) * 0.06;
    rig.head.rotation.x = -p.mouth * 0.35;
    rig.jaw.rotation.x = p.mouth * 0.95;
    for (const tl of rig.tails) tl.tl.rotation.set(-0.5 + Math.sin(u * TAU * 2 + tl.s) * 0.15, tl.s * 0.4, 0);
  },
};

// Coluna do crocodilo, da ponta do rabo ao pescoço; o rabo balança de lado (sway)
export function crocSpine(sway) {
  const tail = [10, 8, 6, 4, 2].map((i) => {
    const k = i / 10;
    const r = 15 - i * 1.25;
    return { p: [Math.sin(k * 2.4) * sway * k, 21 - k * 9, -38 - i * 6.6], w: Math.max(1.4, r * 0.85), h: Math.max(1.4, r * 0.62), hb: Math.max(1.2, r * 0.55) };
  });
  return [
    ...tail,
    { p: [0, 22, -30], w: 16, h: 11, hb: 9 },
    { p: [0, 23, -8], w: 19, h: 11.5, hb: 10 },
    { p: [0, 23, 14], w: 18, h: 11, hb: 10 },
    { p: [0, 24, 30], w: 13, h: 9, hb: 7 },
    { p: [0, 25, 38], w: 11, h: 8, hb: 6 },
  ];
}

// Pata do crocodilo: sai de dentro do corpo, cotovelo/joelho aberto para o lado
export function crocLeg(front, hip, knee, ankle) {
  const [x, hy, hz] = hip;
  const mid = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const kn = [knee[0] * 1.12, knee[1], knee[2]];
  return [
    { p: [x * 0.55, hy + 5, hz], w: 7.4, h: 7 },
    { p: hip, w: 6.4, h: 6.2 },
    { p: kn, w: 5, h: 5 },
    { p: mid(kn, ankle, 0.5), w: 4.2, h: 4.2 },
    { p: ankle, w: 4, h: 3.8 },
  ];
}

// Couro do crocodilo: u dá a volta (dorso em u = 0,25, barriga em u = 0,75), v corre ao
// longo. Dorso verde-escuro com placas, lados verdes e a barriga clara com escamas
function crocTexture(THREE, seed) {
  const t = canvasTex(THREE, 256, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, w, 0);
    grd.addColorStop(0, '#6E9E3E');
    grd.addColorStop(0.25, '#4E7E2C');
    grd.addColorStop(0.5, '#7FB24A');
    grd.addColorStop(0.62, '#D8DC9A');
    grd.addColorStop(0.88, '#D8DC9A');
    grd.addColorStop(1, '#6E9E3E');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    // Placas do dorso em grade e escamas da barriga em faixas
    g.strokeStyle = 'rgba(30, 50, 12, 0.45)';
    g.lineWidth = 1.4;
    for (let y = 0; y < h; y += 14) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w * 0.5, y);
      g.stroke();
    }
    for (let x = 0; x < w * 0.5; x += 16) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
    g.strokeStyle = 'rgba(150, 150, 90, 0.5)';
    for (let y = 0; y < h; y += 10) {
      g.beginPath();
      g.moveTo(w * 0.58, y);
      g.lineTo(w * 0.92, y);
      g.stroke();
    }
    const rnd = rng(seed);
    for (let i = 0; i < 700; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(20, 40, 10, 0.2)' : 'rgba(255, 255, 220, 0.12)';
      g.beginPath();
      g.arc(rnd() * w, rnd() * h, 0.8 + rnd() * 1.4, 0, TAU);
      g.fill();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Pano vermelho com bolinhas brancas (bandana)
function dotsTexture(THREE) {
  const t = canvasTex(THREE, 64, 64, (g, w, h) => {
    g.fillStyle = '#D0322A';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#FFFFFF';
    for (let y = 4; y < h; y += 12) {
      for (let x = (y / 12) % 2 ? 10 : 4; x < w; x += 12) {
        g.beginPath();
        g.arc(x, y, 2, 0, TAU);
        g.fill();
      }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 2);
  return t;
}

// ---------------------------------------------------------------- Papagaio
// Apoio: centro do corpo (c.x, by). Vermelho, asas azuis com a ponta amarela em duas
// partes (a ponta vem atrasada), rabo comprido, rosto branco e o bico curvo
const PARROT_FRAMES = 8;
export const parrot = {
  box: { left: -42, right: 42, top: 36, bottom: -26 },
  res: 2.4,
  elevation: 0.25,
  pose: (c, t) => `${frameOf(t * 10 + c.ph * 3 + Math.PI / 2, PARROT_FRAMES)}${c.dir < 0 ? 'L' : 'R'}`,
  poses() {
    const out = [];
    for (const f of ['R', 'L']) {
      for (let i = 0; i < PARROT_FRAMES; i++) {
        const ph = ((i + 0.5) / PARROT_FRAMES) * TAU - Math.PI / 2;
        out.push({ key: `${i}${f}`, f, flap: Math.sin(ph), lag: Math.sin(ph - 0.9) });
      }
    }
    return out;
  },
  build({ mat, group, sphere, mesh, THREE }) {
    const red = mat('#E0322A', 0.55);
    const blue = mat('#2A6AD8', 0.55);
    const blueDark = mat('#1E4EA8', 0.6);
    const yellow = mat('#F2C230', 0.5);
    const white = mat('#FFFFFF', 0.5);
    const beakM = mat('#F2E8C8', 0.35);
    const ink = mat('#1A1410', 0.2);
    const root = group();
    root.rotation.order = 'YXZ';
    const body = sphere(6.5, red, 0, 0, 0, 22);
    body.scale.set(0.9, 0.95, 1.7);
    root.add(body);
    // Rabo comprido (azul com a ponta amarela)
    const tail = mesh(new THREE.ConeGeometry(3.2, 20, 10), blue, 0, -1.6, -17);
    tail.rotation.x = -Math.PI / 2 - 0.25;
    tail.scale.set(1.2, 1, 0.55);
    root.add(tail);
    const tip = mesh(new THREE.ConeGeometry(1.4, 4, 8), yellow, 0, -4.2, -26.5);
    tip.rotation.x = -Math.PI / 2 - 0.25;
    root.add(tip);
    const head = group(0, 4, 10);
    root.add(head);
    head.add(sphere(5, red, 0, 1, 1, 16));
    for (const s of [-1, 1]) {
      const face = sphere(2.6, white, s * 3.4, 1.4, 3, 10);
      face.scale.set(0.5, 1, 1);
      head.add(face);
      head.add(sphere(1, ink, s * 3.9, 1.8, 3.6, 8));
    }
    // Bico curvo: parte de cima em gancho e a de baixo escura
    const upper = mesh(new THREE.TorusGeometry(2.8, 1.5, 8, 12, Math.PI * 0.9), beakM, 0, 0.6, 5.4);
    upper.rotation.set(0, Math.PI / 2, Math.PI * 0.05);
    head.add(upper);
    head.add(sphere(1.4, mat('#3A3430', 0.4), 0, -1.6, 6, 8));
    const wings = [];
    for (const s of [-1, 1]) {
      const hinge = group(s * 4, 3, 1);
      const w = sphere(6.5, s < 0 ? blue : blueDark, s * 7, 0, -1, 16);
      w.scale.set(1.2, 0.18, 0.8);
      hinge.add(w);
      const shoulder = sphere(3, red, s * 1.5, 0, 0, 10);
      shoulder.scale.set(1, 0.5, 1);
      hinge.add(shoulder);
      const elbow = group(s * 13.5, 0, -1);
      hinge.add(elbow);
      const hand = sphere(6.5, s < 0 ? blue : blueDark, s * 6.5, 0, -2.5, 16);
      hand.scale.set(1.25, 0.16, 0.6);
      elbow.add(hand);
      const tipM = sphere(4.2, yellow, s * 12.5, 0, -4, 10);
      tipM.scale.set(1.2, 0.2, 0.5);
      elbow.add(tipM);
      root.add(hinge);
      wings.push({ hinge, elbow, s });
    }
    // Perninhas recolhidas
    for (const s of [-1, 1]) root.add(kit3Leg(THREE, mat('#6A6A6A', 0.5), s));
    return { root, wings, head };
  },
  apply(rig, p) {
    rig.root.rotation.y = (p.f === 'L' ? -1 : 1) * (Math.PI / 2 - 0.4);
    rig.root.rotation.x = 0.15;
    for (const w of rig.wings) {
      w.hinge.rotation.z = w.s * (0.15 + p.flap * 0.75);
      w.elbow.rotation.z = w.s * (0.1 - p.lag * 0.5);
    }
    rig.head.rotation.x = p.flap * 0.1;
  },
};

function kit3Leg(THREE, m, s) {
  const g = new THREE.Group();
  const a = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1, 6), m);
  placeBetween(THREE, a, [s * 2.4, -4, -1], [s * 2.6, -8, -4]);
  const b = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 6), m);
  b.position.set(s * 2.6, -8, -4);
  g.add(a, b);
  return g;
}

// ---------------------------------------------------------------- Polvo
// Apoio: (c.x, y + 4), meio dentro d'água (só aparece o que fica acima dela). Manto
// roxo com pintas e os olhões, e quatro tentáculos de três partes saindo da água em
// volta, ondulando
const OCTO_FRAMES = 8;
export const octopus = {
  box: { left: -34, right: 34, top: 40, bottom: -10 },
  res: 2.6,
  elevation: 0.3,
  pose: (c, t) => `${frameOf(t * 5 + c.ph, OCTO_FRAMES)}${c.dir < 0 ? 'L' : 'R'}`,
  poses() {
    const out = [];
    for (const f of ['R', 'L']) for (let i = 0; i < OCTO_FRAMES; i++) out.push({ key: `${i}${f}`, f, ph: ((i + 0.5) / OCTO_FRAMES) * TAU });
    return out;
  },
  build(kit) {
    const { THREE, mat, group, sphere } = kit;
    const tex = canvasTex(THREE, 128, 64, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, '#D27ACA');
      grd.addColorStop(1, '#8A3A86');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
      const rnd = rng(31);
      g.fillStyle = '#F0B0E8';
      for (let i = 0; i < 22; i++) {
        g.beginPath();
        g.arc(rnd() * w, rnd() * h * 0.8, 1.5 + rnd() * 2.5, 0, TAU);
        g.fill();
      }
    });
    const skin = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 });
    const arm = mat('#9A3E96', 0.45);
    const sucker = mat('#F2C0E8', 0.5);
    const root = group();
    root.rotation.order = 'YXZ';
    const mantle = sphere(11, skin, 0, 14, -2, 24);
    mantle.scale.set(1, 1.3, 1);
    root.add(mantle);
    const eyes = [];
    for (const s of [-1, 1]) {
      const ew = sphere(3.2, mat('#FFFFFF', 0.25), s * 4.6, 9, 8.6, 12);
      ew.scale.set(1, 1.15, 0.7);
      root.add(ew);
      const pu = sphere(1.6, mat('#1A1020', 0.2), s * 4.8, 9, 10.6, 10);
      root.add(pu);
      eyes.push(pu);
    }
    // Tentáculos contínuos, grossos na água e finos na ponta, que ondulam e enrolam
    const arms = [];
    for (let i = 0; i < 5; i++) {
      const a = ((i + 0.5) / 5) * TAU + 0.3;
      const limb = kit.sweep(octoArm(a, i, 0), arm, { radial: 10, cap: 0.8 });
      root.add(limb);
      const dots = [0, 1, 2].map(() => {
        const d = sphere(0.75, sucker, 0, 0, 0, 6);
        root.add(d);
        return d;
      });
      arms.push({ a, i, limb, dots });
    }
    return { root, arms, kit };
  },
  apply(rig, p) {
    rig.root.rotation.y = side(p.f) * 0.5;
    for (const ar of rig.arms) {
      const sp = octoArm(ar.a, ar.i, p.ph);
      rig.kit.resweep(ar.limb, sp, { radial: 10, cap: 0.8 });
      // Ventosas claras na parte de dentro (virada para o corpo)
      ar.dots.forEach((d, j) => {
        const q = sp[j + 1].p;
        d.position.set(q[0] - Math.cos(ar.a) * 1.6, q[1], q[2] - Math.sin(ar.a) * 1.2);
      });
    }
  },
};

// Tentáculo do polvo: sai da água em volta do manto, sobe e enrola na ponta
function octoArm(a, i, ph) {
  const out = [Math.cos(a), Math.sin(a)];
  const pts = [];
  for (let j = 0; j < 6; j++) {
    const k = j / 5;
    const w = Math.sin(ph + i * 1.4 + k * 2.6) * (1 + k * 2.4);
    const curl = k * k * 4;
    pts.push({
      p: [out[0] * (10 + k * 8 + curl) + w * 0.9, -1 + k * 18 - curl * 0.6, out[1] * (7 + k * 5 + curl * 0.6) + w * 0.7],
      w: 2.8 - k * 2.1, h: 2.8 - k * 2.1,
    });
  }
  return pts;
}

// ---------------------------------------------------------------- Tubarão
// Apoio: (c.x, y + 8), só o que fica acima da água aparece: o dorso cinza e a
// barbatana cortando a água, com a cauda balançando
const SHARK_FRAMES = 6;
export const shark = {
  box: { left: -40, right: 40, top: 34, bottom: -12 },
  res: 2.6,
  elevation: 0.3,
  pose: (c, t) => `${frameOf(t * 4 + c.ph, SHARK_FRAMES)}${c.dir < 0 ? 'L' : 'R'}`,
  poses() {
    const out = [];
    for (const f of ['R', 'L']) for (let i = 0; i < SHARK_FRAMES; i++) out.push({ key: `${i}${f}`, f, ph: ((i + 0.5) / SHARK_FRAMES) * TAU });
    return out;
  },
  build(kit) {
    const { THREE, mat, group, mesh, sweep } = kit;
    const back = mat('#6A7A88', 0.35);
    const finM = mat('#55646F', 0.4, { side: THREE.DoubleSide });
    const root = group();
    root.rotation.order = 'YXZ';
    const body = sweep(sharkSpine(0), back, { radial: 20, cap: 0.6 });
    root.add(body);
    // Barbatana do dorso (perfil curvo extrudado bem fino)
    const s = new THREE.Shape();
    s.moveTo(-7, 0);
    s.quadraticCurveTo(-3, 13, 4, 21);
    s.quadraticCurveTo(3, 9, 8, 0);
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 1.6, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.5, bevelSegments: 1 });
    geo.translate(0, 0, -0.8);
    const fin = mesh(geo, finM, 0, 5, 0);
    fin.rotation.y = -Math.PI / 2;
    root.add(fin);
    return { root, body, kit };
  },
  apply(rig, p) {
    rig.root.rotation.y = side(p.f) * (Math.PI / 2 - 0.45);
    rig.kit.resweep(rig.body, sharkSpine(Math.sin(p.ph) * 3), { radial: 20, cap: 0.6 });
  },
};

export function sharkSpine(sway) {
  return [
    { p: [sway, 1, -28], w: 1.6, h: 1.6 },
    { p: [sway * 0.6, 2.5, -18], w: 4, h: 3.5 },
    { p: [0, 4, -4], w: 8, h: 5.5 },
    { p: [0, 4, 10], w: 8.5, h: 5.5 },
    { p: [0, 2.5, 22], w: 5, h: 3.6 },
    { p: [0, 1, 28], w: 2.4, h: 2 },
  ];
}

// ---------------------------------------------------------------- Garrafa com mensagem
// No lugar do peixe. Vidro verde transparente com o papel enrolado e a fita vermelha
// lá dentro, gargalo com a rolha. Apoio: centro; o balanço é a rotação da foto
export const bottle = {
  box: { left: -16, right: 16, top: 12, bottom: -10 },
  res: 3.4,
  elevation: 0.2,
  pose: () => 'b',
  poses: () => [{ key: 'b' }],
  build({ THREE, mat, group, mesh, sphere }) {
    const root = group();
    const glass = mat('#5FBF8A', 0.08, { transparent: true, opacity: 0.55, metalness: 0.1, depthWrite: false });
    const pts = [[0.01, -9], [4.6, -8.6], [5, -6], [5, 2], [4, 4.5], [1.9, 6], [1.8, 9], [2.1, 9.4], [0.01, 9.4]];
    const b = mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 24), glass);
    b.castShadow = false;
    const g = group();
    g.rotation.z = -Math.PI / 2;
    root.add(g);
    g.add(b);
    const paper = mesh(new THREE.CylinderGeometry(2.3, 2.3, 9, 14), mat('#F4E6C0', 0.8), 0, -2, 0);
    g.add(paper);
    g.add(mesh(new THREE.CylinderGeometry(2.5, 2.5, 1.2, 14), mat('#C0392B', 0.6), 0, -2, 0));
    g.add(mesh(new THREE.CylinderGeometry(1.7, 1.5, 3, 10), mat('#B07A44', 0.9), 0, 10, 0));
    g.add(sphere(0.9, mat('#FFFFFF', 0.1, { emissive: '#FFFFFF', emissiveIntensity: 0.5 }), -3, 2, 3.8, 6));
    return { root };
  },
  apply() {},
};

// ---------------------------------------------------------------- Barris
// Mesmas medidas do sprite 2D (barrelSprite): pés em y = 0, 26 abaixo do topo da foto,
// altura 62. Barris de aduelas deitados, um atrás do outro (cada um com ~40 de
// comprimento), com os aros de ferro e a tampa; acesos, os aros ficam dourados e a
// madeira mais clara e brilhante, com moedinhas em cima.
export const BARREL_3D = { ...BARREL, VARIANTS: 3 };
const barrels = new Map();
export function barrelSubject(w) {
  if (barrels.has(w)) return barrels.get(w);
  const S = {
    box: { left: -BARREL.PAD, right: w + BARREL.PAD, top: BARREL.TOP, bottom: BARREL.TOP - BARREL.H },
    res: 2.2,
    elevation: 0.3,
    poses() {
      const out = [];
      for (let v = 0; v < BARREL_3D.VARIANTS; v++) for (const on of [0, 1]) out.push({ key: `${v}${on}`, v, on });
      return out;
    },
    build(kit) {
      return buildBarrels(kit, w);
    },
    apply(rig, p) {
      rig.variants.forEach((g, i) => (g.visible = i === p.v));
      for (const m of rig.meshes) m.material = p.on ? m.userData.on : m.userData.off;
      for (const c of rig.coins) c.visible = !!p.on;
    },
  };
  barrels.set(w, S);
  return S;
}

// Aduelas do barril: faixas ao longo do comprimento (u dá a volta), com veios
function staveTexture(THREE, on, seed) {
  const t = canvasTex(THREE, 256, 128, (g, w, h) => {
    const rnd = rng(seed);
    g.fillStyle = on ? '#E8B070' : '#B87C48';
    g.fillRect(0, 0, w, h);
    const n = 16;
    for (let i = 0; i < n; i++) {
      const x = (i * w) / n;
      g.fillStyle = `rgba(${on ? '120,70,20' : '30,16,6'}, ${0.08 + rnd() * 0.18})`;
      g.fillRect(x, 0, w / n, h);
      g.fillStyle = on ? 'rgba(90, 50, 10, 0.6)' : 'rgba(20, 10, 4, 0.7)';
      g.fillRect(x, 0, 1.6, h);
      g.fillStyle = on ? 'rgba(150, 90, 30, 0.3)' : 'rgba(40, 22, 8, 0.35)';
      for (let k = 0; k < 3; k++) g.fillRect(x + 3 + rnd() * 10, 0, 0.8, h);
    }
  });
  return t;
}

function buildBarrels(kit, w) {
  const { THREE, group, mat } = kit;
  const root = group();
  const variants = [];
  const meshes = [];
  const coins = [];
  const n = Math.max(1, Math.round(w / 40));
  const bw = w / n;
  const R = 10.5;
  for (let v = 0; v < BARREL_3D.VARIANTS; v++) {
    const g = group();
    const seed = (v + 5) * 3511;
    const std = (map, extra = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.75, metalness: 0, ...extra });
    const wood = { off: std(staveTexture(THREE, false, seed)), on: std(staveTexture(THREE, true, seed), { emissive: '#6A3A08', emissiveIntensity: 0.3, roughness: 0.55 }) };
    const lid = { off: mat('#A06A3C', 0.8), on: mat('#E0A866', 0.6, { emissive: '#6A3A08', emissiveIntensity: 0.25 }) };
    const hoop = { off: mat('#5A544E', 0.35, { metalness: 0.6 }), on: mat('#FFC83A', 0.25, { metalness: 0.8, emissive: '#8A5A00', emissiveIntensity: 0.5 }) };
    for (let i = 0; i < n; i++) {
      const len = bw - 3;
      // Barril estufado: torneado (raio maior no meio), deitado ao longo de x
      const prof = [];
      for (let k = 0; k <= 12; k++) {
        const y = -len / 2 + (len * k) / 12;
        const b = 1 - ((y / (len / 2)) ** 2) * 0.22;
        prof.push(new THREE.Vector2(R * b * (0.98 + ((v + i) % 3) * 0.01), y));
      }
      const geo = new THREE.LatheGeometry(prof, 24);
      const body = new THREE.Mesh(geo, wood.off);
      body.userData = wood;
      body.rotation.z = Math.PI / 2;
      body.rotation.x = 0.2 * ((i + v) % 2 ? 1 : -1);
      const cx = i * bw + bw / 2;
      body.position.set(cx, -R + 1.5, 0);
      body.castShadow = body.receiveShadow = true;
      g.add(body);
      meshes.push(body);
      // Tampas (a da esquerda aparece um pouco)
      for (const s of [-1, 1]) {
        const cap = new THREE.Mesh(new THREE.CircleGeometry(R * 0.85, 22), lid.off);
        cap.userData = lid;
        cap.position.set(cx + s * (len / 2 - 0.2), -R + 1.5, 0);
        cap.rotation.y = s * Math.PI / 2;
        g.add(cap);
        meshes.push(cap);
      }
      // Aros de ferro
      for (const k of [-0.36, -0.12, 0.12, 0.36]) {
        const rr = R * (1 - (k * 2) ** 2 * 0.22) + 0.4;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.95, 6, 28), hoop.off);
        ring.userData = hoop;
        ring.rotation.y = Math.PI / 2;
        ring.position.set(cx + k * len, -R + 1.5, 0);
        ring.castShadow = true;
        g.add(ring);
        meshes.push(ring);
      }
      // Moedinhas em cima do barril aceso
      const coinM = mat('#FFD54A', 0.2, { metalness: 0.9, emissive: '#A07000', emissiveIntensity: 0.6 });
      for (let k = 0; k < 2; k++) {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 0.6, 14), coinM);
        c.position.set(cx - 4 + k * 7, 1.8, (k - 0.5) * 3);
        c.rotation.set(0.3, 0, (k - 0.5) * 0.6);
        g.add(c);
        coins.push(c);
      }
    }
    root.add(g);
    variants.push(g);
  }
  return { root, variants, meshes, coins };
}

// ---------------------------------------------------------------- Forte pirata
// Mesmo lugar, mesmas 16 peças e mesma porta do forte 2D (src/pirate.js): 6 blocos da
// muralha de pedras aparelhadas (com espessura), 3 ameias, a torre de vigia com o
// braseiro aceso, a bandeira de caveira tremulando, 2 canhões saindo das seteiras, a
// lanterna ao lado da porta e a janela gradeada da torre (acesa quando há alguém
// dentro). A porta é o modelo à parte (src/m3d/doors.js). Frente da muralha em z = 0.
// Fotos: "n1".."n15", "lit" (forte pronto com a janela acesa) e "b0".."b14".
const WALL_D = 26;

function masonryTexture(THREE, seed, rows = 3, cols = 3) {
  const t = canvasTex(THREE, 256, 256, (g, w, h) => {
    const rnd = rng(seed);
    g.fillStyle = '#5E5448';
    g.fillRect(0, 0, w, h);
    const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (w / cols / 2);
      for (let c = -1; c <= cols; c++) {
        const x = c * (w / cols) + off;
        const tone = 150 + rnd() * 40;
        g.fillStyle = `rgb(${tone + 14}, ${tone + 4}, ${tone - 14})`;
        g.fillRect(x + 3, r * rh + 3, w / cols - 6, rh - 6);
        // Manchas e musgo embaixo
        for (let k = 0; k < 8; k++) {
          g.fillStyle = rnd() < 0.5 ? 'rgba(60,50,40,0.25)' : 'rgba(230,220,200,0.18)';
          g.fillRect(x + 4 + rnd() * (w / cols - 12), r * rh + 4 + rnd() * (rh - 12), 3 + rnd() * 6, 2 + rnd() * 3);
        }
        if (rnd() < 0.35) {
          g.fillStyle = 'rgba(90, 130, 60, 0.45)';
          g.fillRect(x + 6 + rnd() * 20, r * rh + rh - 10, 14 + rnd() * 16, 5);
        }
      }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Bloco de pedra com quinas chanfradas (frente em z = 0)
function blockGeo(THREE, w, h, d) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(w, 0);
  s.lineTo(w, h);
  s.lineTo(0, h);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: d - 2, bevelEnabled: true, bevelThickness: 1, bevelSize: 1, bevelSegments: 1 });
  geo.translate(0, 0, -d + 1);
  // UV da frente: em unidades do bloco (a textura cobre o bloco inteiro)
  const uv = geo.attributes.uv;
  const pos = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / w, pos.getY(i) / h);
  return geo;
}

// Bandeira pirata: preta com a caveira e os ossos cruzados
function jollyTexture(THREE) {
  return canvasTex(THREE, 128, 80, (g, w, h) => {
    g.fillStyle = '#1A1A1E';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#F2F0E6';
    g.lineWidth = 7;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(42, 46);
    g.lineTo(86, 68);
    g.moveTo(86, 46);
    g.lineTo(42, 68);
    g.stroke();
    g.fillStyle = '#F2F0E6';
    g.beginPath();
    g.arc(64, 32, 17, 0, TAU);
    g.fill();
    g.fillRect(55, 40, 18, 12);
    g.fillStyle = '#1A1A1E';
    g.beginPath();
    g.arc(57, 31, 5, 0, TAU);
    g.arc(71, 31, 5, 0, TAU);
    g.fill();
    g.fillRect(62, 39, 4, 5);
  });
}

export const fort = {
  box: { left: -150, right: 150, top: 220, bottom: -20 },
  res: 1.5,
  elevation: 0.2,
  poses() {
    const out = [];
    for (let n = 1; n < FORT_PIECES.length; n++) out.push({ key: `n${n}`, upto: n });
    out.push({ key: 'lit', upto: FORT_PIECES.length - 1, lit: true });
    for (let i = 0; i < FORT_PIECES.length - 1; i++) out.push({ key: `b${i}`, only: i });
    return out;
  },
  build(kit) {
    const { THREE, mat, group, mesh, sphere } = kit;
    const { HW, WALL_H, ROW_H, TOWER, FLAG, CANNONS, LANTERN, WINDOW } = FORT;
    const stones = [0, 1, 2].map((k) => new THREE.MeshStandardMaterial({ map: masonryTexture(THREE, 11 + k * 7), roughness: 0.95 }));
    const iron = mat('#262220', 0.4, { metalness: 0.6 });
    const wood = mat('#6A4426', 0.85);
    const third = (HW * 2) / 3;
    const root = group();
    const pieces = [];
    let winOn = null;
    let winOff = null;
    for (const [pi, p] of FORT_PIECES.slice(0, -1).entries()) {
      const g = group();
      if (p.kind === 'wall') {
        const x0 = -HW + third * p.col;
        const y0 = p.row * ROW_H;
        g.add(mesh(blockGeo(THREE, third - 0.6, ROW_H - 0.6, WALL_D), stones[(p.row + p.col) % 3], x0 + 0.3, y0 + 0.3, 0));
      } else if (p.kind === 'merlon') {
        g.add(mesh(blockGeo(THREE, 22, 16, WALL_D * 0.7), stones[p.i % 3], p.cx - 11, WALL_H, -2));
      } else if (p.kind === 'tower') {
        const h = -TOWER.top - WALL_H;
        const tw = mesh(blockGeo(THREE, TOWER.w, h - 10, 40), stones[2], TOWER.x - TOWER.w / 2, WALL_H, -6);
        g.add(tw);
        // Cornija e as ameias da torre
        g.add(mesh(new THREE.BoxGeometry(TOWER.w + 6, 4, 44), mat('#7A6E60', 0.95), TOWER.x, WALL_H + h - 10, -26));
        for (const dx of [-18, 0, 18]) {
          for (const dz of [-6, -46]) g.add(mesh(new THREE.BoxGeometry(10, 10, 6), mat('#A89C88', 0.95), TOWER.x + dx, WALL_H + h - 3, dz));
        }
        // Braseiro aceso no alto (a fumaça sai dele)
        const bowl = mesh(new THREE.CylinderGeometry(7, 4.5, 5, 14), iron, TOWER.x, -TOWER.top + 2, -26);
        g.add(bowl);
        g.add(sphere(4.6, mat('#FF8A2A', 0.4, { emissive: '#FF6A00', emissiveIntensity: 1.3 }), TOWER.x, -TOWER.top + 5, -26, 10));
      } else if (p.kind === 'flag') {
        g.add(kit.bone(1.1, [FLAG.x, -FLAG.y - 6, -26], [FLAG.x, -FLAG.y + 42, -26], mat('#3A2A1C', 0.8)));
        g.add(sphere(2, mat('#C9A44A', 0.3, { metalness: 0.6 }), FLAG.x, -FLAG.y + 43, -26, 10));
        const geo = new THREE.PlaneGeometry(28, 18, 12, 4);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i) + 14;
          pos.setZ(i, Math.sin(x * 0.28) * 2.2 * (x / 28));
          pos.setY(i, pos.getY(i) - (x / 28) * 1.5);
        }
        geo.computeVertexNormals();
        const cloth = mesh(geo, new THREE.MeshStandardMaterial({ map: jollyTexture(THREE), roughness: 0.85, side: THREE.DoubleSide }), FLAG.x + 14.6, -FLAG.y + 31, -26);
        g.add(cloth);
      } else if (p.kind === 'cannon') {
        const c = CANNONS[p.side < 0 ? 0 : 1];
        // Seteira escura e o cano saindo dela, apontado para o mar
        g.add(mesh(new THREE.BoxGeometry(18, 14, 1), mat('#1A1614', 0.95), c.x, -c.y, 0.6));
        const barrel = mesh(new THREE.CylinderGeometry(4.2, 5.4, 22, 18), iron, c.x, -c.y, 4);
        barrel.rotation.x = Math.PI / 2 - 0.08;
        g.add(barrel);
        const muzzle = mesh(new THREE.TorusGeometry(4.4, 1.3, 8, 18), iron, c.x, -c.y + 0.6, 15);
        g.add(muzzle);
        g.add(mesh(new THREE.CircleGeometry(3.2, 14), mat('#050404', 1), c.x, -c.y + 0.6, 15.2));
      } else if (p.kind === 'lantern') {
        const L = group(LANTERN.x, -LANTERN.y, 6);
        g.add(L);
        g.add(kit.bone(0.8, [LANTERN.x, -LANTERN.y + 10, 0.5], [LANTERN.x, -LANTERN.y + 10, 6], iron));
        L.add(mesh(new THREE.CylinderGeometry(1, 4.5, 3, 4), iron, 0, 7.5, 0));
        L.add(mesh(new THREE.BoxGeometry(8, 11, 8), mat('#FFE08A', 0.2, { emissive: '#FFB040', emissiveIntensity: 1.2, transparent: true, opacity: 0.9 }), 0, 0, 0));
        for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) L.add(mesh(new THREE.BoxGeometry(1, 12, 1), iron, dx, 0, dz));
        L.add(mesh(new THREE.BoxGeometry(9, 1.6, 9), iron, 0, -6, 0));
      } else if (p.kind === 'window') {
        const W2 = group(WINDOW.x, -WINDOW.y, -5.5);
        g.add(W2);
        const shape = new THREE.Shape();
        shape.moveTo(-7, -10);
        shape.lineTo(7, -10);
        shape.lineTo(7, 3);
        shape.absarc(0, 3, 7, 0, Math.PI, false);
        shape.closePath();
        winOff = mat('#120E0C', 0.95);
        winOn = mat('#FFC870', 0.4, { emissive: '#FF9A30', emissiveIntensity: 1.1 });
        const pane = mesh(new THREE.ShapeGeometry(shape, 8), winOff, 0, 0, 0.4);
        W2.add(pane);
        W2.userData.pane = pane;
        for (const dx of [-3, 0.5, 4]) W2.add(mesh(new THREE.BoxGeometry(1.4, 19, 1.4), iron, dx, -0.5, 1.2));
        W2.add(mesh(new THREE.BoxGeometry(18, 2, 3), mat('#7A6E60', 0.95), 0, -11, 1));
      }
      root.add(g);
      pieces.push(g);
    }
    const pane = pieces[FORT_PIECES.findIndex((p) => p.kind === 'window')].children[0].userData.pane;
    return { root, pieces, pane, winOn, winOff };
  },
  apply(rig, p) {
    rig.pieces.forEach((g, i) => (g.visible = p.only != null ? i === p.only : i < p.upto));
    rig.pane.material = p.lit ? rig.winOn : rig.winOff;
  },
};

// ---------------------------------------------------------------- Enfeites da praia
// Baú do tesouro aberto com as moedas transbordando (base em 0, 0)
export const chest = {
  box: { left: -40, right: 40, top: 60, bottom: -10 },
  res: 2.4,
  elevation: 0.25,
  poses: () => [{ key: 'c' }],
  build({ THREE, mat, group, mesh, sphere }) {
    const root = group();
    const wood = new THREE.MeshStandardMaterial({ map: staveTexture(THREE, false, 77), roughness: 0.8 });
    const iron = mat('#2E2A26', 0.4, { metalness: 0.6 });
    const gold = mat('#FFC83A', 0.2, { metalness: 0.85, emissive: '#7A5000', emissiveIntensity: 0.35 });
    const body = mesh(new THREE.BoxGeometry(46, 24, 28), wood, 0, 12, 0);
    root.add(body);
    for (const x of [-22, 22]) root.add(mesh(new THREE.BoxGeometry(2.2, 25, 29), mat('#5A5048', 0.4, { metalness: 0.5 }), x, 12.5, 0));
    root.add(mesh(new THREE.BoxGeometry(47, 2.4, 29), iron, 0, 23.5, 0));
    root.add(mesh(new THREE.BoxGeometry(6, 7, 1.5), mat('#D8A030', 0.3, { metalness: 0.7 }), 0, 15, 14.6));
    // Tampa curva aberta para trás
    const lid = group(0, 24, -14);
    lid.rotation.x = -1.95;
    root.add(lid);
    const lidGeo = new THREE.CylinderGeometry(14, 14, 46, 18, 1, false, 0, Math.PI);
    const l = mesh(lidGeo, wood, 0, 0, 14);
    l.rotation.z = Math.PI / 2;
    l.rotation.y = Math.PI / 2;
    lid.add(l);
    // Moedas transbordando (monte) e algumas caídas na frente
    const pile = sphere(1, gold, 0, 24, 1, 20);
    pile.scale.set(21, 6, 12);
    root.add(pile);
    const rnd = rng(19);
    for (let i = 0; i < 14; i++) {
      const c = mesh(new THREE.CylinderGeometry(2, 2, 0.6, 12), gold, -18 + rnd() * 36, 26 + rnd() * 4, -8 + rnd() * 16);
      c.rotation.set(rnd() * 1.4, 0, rnd() * 1.4);
      root.add(c);
    }
    for (let i = 0; i < 5; i++) {
      const c = mesh(new THREE.CylinderGeometry(2, 2, 0.6, 12), gold, -14 + i * 8 + rnd() * 3, 0.4, 18 + rnd() * 6);
      root.add(c);
    }
    root.add(sphere(3, mat('#E0322A', 0.1, { metalness: 0.3, emissive: '#600000', emissiveIntensity: 0.4 }), 6, 30, 0, 10));
    return { root };
  },
  apply() {},
};

// Canhão de praia: carreta de madeira com rodas e o cano de ferro, e a pilha de balas
export const cannon = {
  box: { left: -46, right: 46, top: 40, bottom: -10 },
  res: 2.4,
  elevation: 0.25,
  poses: () => [{ key: 'c' }],
  build({ THREE, mat, group, mesh, sphere }) {
    const root = group();
    root.rotation.y = -0.5;
    const wood = mat('#6A4426', 0.85);
    const iron = mat('#262220', 0.35, { metalness: 0.65 });
    root.add(mesh(new THREE.BoxGeometry(14, 8, 34), wood, 0, 10, 0));
    for (const s of [-1, 1]) {
      for (const z of [-10, 10]) {
        const w = mesh(new THREE.CylinderGeometry(6, 6, 3, 16), wood, s * 8.5, 6, z);
        w.rotation.z = Math.PI / 2;
        root.add(w);
        const hub = mesh(new THREE.CylinderGeometry(1.6, 1.6, 3.6, 8), iron, s * 8.5, 6, z);
        hub.rotation.z = Math.PI / 2;
        root.add(hub);
      }
    }
    const barrel = mesh(new THREE.CylinderGeometry(4, 6, 36, 18), iron, 0, 18, 4);
    barrel.rotation.x = Math.PI / 2 - 0.18;
    root.add(barrel);
    root.add(mesh(new THREE.TorusGeometry(4.2, 1.2, 8, 18), iron, 0, 21.5, 22));
    root.add(sphere(4, iron, 0, 16, -15, 12));
    for (const [x, y, z] of [[22, 4, 14], [30, 4, 14], [26, 4, 22], [26, 10.5, 17]]) root.add(sphere(4, iron, x, y, z, 12));
    return { root };
  },
  apply() {},
};

// Âncora fincada na areia, inclinada, com a argola e um pedaço de corrente
export const anchor = {
  box: { left: -30, right: 30, top: 74, bottom: -10 },
  res: 2.4,
  elevation: 0.2,
  poses: () => [{ key: 'a' }],
  build({ THREE, mat, group, mesh }) {
    const root = group();
    const iron = mat('#3A3A40', 0.4, { metalness: 0.6 });
    const g = group();
    g.rotation.z = -0.22;
    root.add(g);
    g.add(mesh(new THREE.CylinderGeometry(2.2, 2.6, 58, 12), iron, 0, 30, 0));
    const stock = mesh(new THREE.CylinderGeometry(1.8, 1.8, 26, 10), iron, 0, 50, 0);
    stock.rotation.z = Math.PI / 2;
    g.add(stock);
    g.add(mesh(new THREE.TorusGeometry(5, 1.4, 8, 18), iron, 0, 64, 0));
    const arms = mesh(new THREE.TorusGeometry(16, 2.4, 8, 24, Math.PI), iron, 0, 18, 0);
    arms.rotation.z = Math.PI;
    g.add(arms);
    for (const s of [-1, 1]) {
      const fluke = mesh(new THREE.ConeGeometry(4, 8, 4), iron, s * 16, 20, 0);
      fluke.rotation.z = s * 0.4;
      g.add(fluke);
    }
    // Corrente caída na areia
    for (let i = 0; i < 5; i++) {
      const l = mesh(new THREE.TorusGeometry(2.4, 0.7, 6, 12), iron, 8 + i * 4.4, 1, 4 + i * 1.4);
      l.rotation.set(Math.PI / 2, i % 2 ? Math.PI / 2 : 0, 0.3);
      root.add(l);
    }
    return { root };
  },
  apply() {},
};
