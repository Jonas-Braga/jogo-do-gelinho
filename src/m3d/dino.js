// Dinossauros em 3D (fase 30): T-rex com pernas de joelho e calcanhar alto, rabo
// comprido, bracinhos e cabeçorra de mandíbula articulada (e o rugido); pterossauro
// de asas de pele, raptorzinho correndo, amonite com tentáculos, ovo de dinossauro,
// pedras de basalto no lugar das placas (acesas = âmbar), caverna de pedras montada
// peça por peça, samambaias gigantes e o ninho com ovos.
// Mesmos pontos de apoio do desenho 2D (src/dino.js); y para cima.
import { TAU } from './kit.js';
import { makeRockSubject } from './space.js';
import { CAVE, CAVE_PIECES, CAVE_DOOR } from '../dino.js';
import { IGLOO } from '../config.js';

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

function rod(THREE, r0, r1, m) {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 1, 12), m);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

// Joelho por cinemática inversa no plano (z, y); bend = −1 dobra para a frente
function ik2(a, c, L1, L2, bend) {
  let dz = c[2] - a[2];
  let dy = c[1] - a[1];
  let d = Math.hypot(dz, dy);
  const max = L1 + L2 - 0.3;
  if (d > max) {
    dz *= max / d;
    dy *= max / d;
    d = max;
  }
  const A = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
  const ang = Math.atan2(dy, dz) - bend * A;
  return [a[0], a[1] + Math.sin(ang) * L1, a[2] + Math.cos(ang) * L1];
}

// Tubo afunilado ao longo de uma curva (rabos, galhos, presas)
function taper(kit, root, pts, r0, r1, m, n = 12) {
  const { THREE, sphere } = kit;
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const parts = [];
  for (let i = 0; i < n; i++) {
    const a = curve.getPoint(i / n);
    const b = curve.getPoint((i + 1) / n);
    const ra = r0 + (r1 - r0) * (i / n);
    const o = rod(THREE, ra, r0 + (r1 - r0) * ((i + 1) / n), m);
    placeBetween(THREE, o, a.toArray(), b.toArray());
    root.add(o);
    const j = sphere(ra * 0.98, m, a.x, a.y, a.z, 10);
    root.add(j);
    parts.push(o, j);
  }
  return parts;
}

// Pele de dinossauro: gradiente com listras escuras e escamas
function scaleTexture(THREE, colors, stripe, seed) {
  return canvasTex(THREE, 256, 128, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, colors[0]);
    grd.addColorStop(0.5, colors[1]);
    grd.addColorStop(1, colors[2]);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    const rnd = rng(seed);
    if (stripe) {
      g.fillStyle = stripe;
      for (let x = 0; x < w; x += 22) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x + 9, 0);
        g.lineTo(x + 4, h * 0.38);
        g.fill();
      }
    }
    for (let i = 0; i < 500; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(20, 40, 10, 0.25)' : 'rgba(255, 255, 220, 0.12)';
      g.beginPath();
      g.arc(rnd() * w, rnd() * h, 1 + rnd() * 1.6, 0, TAU);
      g.fill();
    }
  });
}

// ---------------------------------------------------------------- T-rex
// No lugar do urso. Fotos: walk{quadro}{lado}{boca} (anda; perseguindo, corre
// inclinado de boca aberta) e roar{lado} (parado, ergue a cabeça e ruge)
export const TREX_FRAMES = 12;
export const trex = {
  box: { left: -112, right: 112, top: 130, bottom: -24 },
  res: 1.8,
  pose(b, t) {
    const d = b.dir < 0 ? 'L' : 'R';
    const roar = b.chasing ? 0 : Math.min(1, Math.max(0, Math.sin(t * 0.8) - 0.7) * 3.3);
    if (roar > 0.35) return `roar${d}`;
    const f = frameOf(b.walk * (b.chasing ? 5 : 3.5), TREX_FRAMES);
    const m = b.chasing ? (Math.abs(Math.sin(t * 8)) > 0.5 ? 2 : 1) : 0;
    return `walk${f}${d}${m}`;
  },
  poses() {
    const out = [];
    for (const f of ['R', 'L']) {
      for (let i = 0; i < TREX_FRAMES; i++) {
        for (let m = 0; m < 3; m++) out.push({ key: `walk${i}${f}${m}`, f, u: (i + 0.5) / TREX_FRAMES, run: m > 0, jaw: [0.05, 0.32, 0.45][m] });
      }
      out.push({ key: `roar${f}`, f, u: 0.25, roar: true, jaw: 0.6 });
    }
    return out;
  },
  build(kit) {
    const { THREE, mat, group, sphere, mesh } = kit;
    const skin = new THREE.MeshStandardMaterial({ map: scaleTexture(THREE, ['#8CBF58', '#5E8C38', '#3E6424'], 'rgba(46, 74, 30, 0.7)', 3), roughness: 0.7 });
    const skinDark = new THREE.MeshStandardMaterial({ map: scaleTexture(THREE, ['#6E9E44', '#4A7A2C', '#30521C'], null, 7), roughness: 0.75 });
    const belly = mat('#D2D89A', 0.7);
    const claw = mat('#E8DFC4', 0.35);
    const mouthM = mat('#7A1E22', 0.6);
    const tooth = mat('#FFF8E6', 0.3);
    const root = group();
    root.rotation.order = 'YXZ';
    const body = group();
    root.add(body);
    // Tronco (frente = +z), barriga clara
    const torso = sphere(1, skin, 0, 66, 2, 30);
    torso.scale.set(17, 19, 34);
    body.add(torso);
    const tummy = sphere(1, belly, 0, 58, 6, 24);
    tummy.scale.set(14, 12, 28);
    body.add(tummy);
    // Rabo em cadeia (reposicionado a cada pose)
    const tail = [];
    for (let i = 0; i < 10; i++) {
      const r = 14 - i * 1.25;
      const s = sphere(r, i % 2 ? skin : skinDark, 0, 0, 0, 16);
      s.scale.set(0.9, 0.85, 1.4);
      body.add(s);
      tail.push(s);
    }
    // Pescoço grosso e a cabeça (gira no pescoço; a mandíbula, na articulação)
    const neck = group(0, 74, 28);
    body.add(neck);
    const neckM = sphere(1, skin, 0, 6, 6, 20);
    neckM.scale.set(11, 13, 13);
    neck.add(neckM);
    const head = group(0, 14, 15);
    head.scale.setScalar(1.22);
    neck.add(head);
    const skull = sphere(1, skin, 0, 2, 14, 26);
    skull.scale.set(10, 10, 22);
    head.add(skull);
    const snoutTop = sphere(1, skin, 0, 1, 26, 20);
    snoutTop.scale.set(8, 6.5, 12);
    head.add(snoutTop);
    for (const s of [-1, 1]) {
      // Olho amarelo com a pupila e a crista óssea por cima
      head.add(sphere(2.6, mat('#FFC21A', 0.2, { emissive: '#A07000', emissiveIntensity: 0.4 }), s * 8, 6, 9, 12));
      head.add(sphere(1.3, mat('#1A1006', 0.2), s * 9.3, 6, 10.5, 8));
      const crest = mesh(new THREE.ConeGeometry(2.6, 7, 8), skinDark, s * 7.5, 10.5, 7);
      crest.rotation.set(-0.6, 0, -s * 0.3);
      head.add(crest);
      head.add(sphere(0.9, mat('#1A1006', 0.3), s * 3.6, 4, 36, 8));
    }
    // Dentes de cima
    for (let i = 0; i < 7; i++) {
      for (const s of [-1, 1]) {
        const tb = mesh(new THREE.ConeGeometry(0.9, 3.4 + (i % 2) * 1.2, 6), tooth, s * (6.4 - i * 0.35), -4.6, 12 + i * 3.6);
        tb.rotation.x = Math.PI;
        head.add(tb);
      }
    }
    // Mandíbula
    const jaw = group(0, -3, 4);
    head.add(jaw);
    const lower = sphere(1, skin, 0, -4, 16, 20);
    lower.scale.set(8.5, 4.2, 18);
    jaw.add(lower);
    const inside = sphere(1, mouthM, 0, -1, 17, 16);
    inside.scale.set(6.5, 2.4, 15);
    jaw.add(inside);
    const tongue = sphere(1, mat('#C8505A', 0.5), 0, -0.4, 14, 12);
    tongue.scale.set(4, 1.4, 10);
    jaw.add(tongue);
    for (let i = 0; i < 6; i++) {
      for (const s of [-1, 1]) jaw.add(mesh(new THREE.ConeGeometry(0.8, 3 + (i % 2), 6), tooth, s * (6 - i * 0.4), 0.6, 13 + i * 3.6));
    }
    // Bracinhos curtos (ombro, cotovelo, mão com duas garras)
    const arms = [-1, 1].map((s) => {
      const sh = group(s * 11, 60, 26);
      body.add(sh);
      sh.add(kit.bone(3.2, [0, 0, 0], [0, -5, 6], s < 0 ? skin : skinDark));
      const el = group(0, -5, 6);
      sh.add(el);
      el.add(kit.bone(2.6, [0, 0, 0], [0, 2, 7], s < 0 ? skin : skinDark));
      for (const k of [-1, 1]) {
        const c = mesh(new THREE.ConeGeometry(0.7, 3.4, 6), claw, k * 1.2, 2, 9);
        c.rotation.x = Math.PI / 2 + 0.6;
        el.add(c);
      }
      return { sh, el, s };
    });
    // Pernas: coxa grossa, joelho, canela, metatarso e pé de três dedos
    const legs = [-1, 1].map((s) => {
      const m = s < 0 ? skin : skinDark;
      const o = {
        s, thighBulk: sphere(1, m, 0, 0, 0, 20), thigh: rod(THREE, 10, 7, m), shin: rod(THREE, 6.5, 4.5, m),
        meta: rod(THREE, 4.5, 3.6, m), knee: sphere(7, m, 0, 0, 0, 14), ankle: sphere(4.4, m, 0, 0, 0, 12),
        toes: [0, 1, 2].map(() => ({ t: rod(THREE, 2.6, 1.6, m), c: mesh(new THREE.ConeGeometry(1.4, 4, 6), claw) })),
      };
      o.thighBulk.scale.set(10, 15, 13);
      root.add(o.thighBulk, o.thigh, o.shin, o.meta, o.knee, o.ankle);
      for (const tt of o.toes) root.add(tt.t, tt.c);
      return o;
    });
    return { root, body, torso, neck, head, jaw, tail, arms, legs, THREE };
  },
  apply(rig, p) {
    const { THREE } = rig;
    rig.root.rotation.y = side(p.f) * (Math.PI / 2 - 0.42);
    const ph = p.u * TAU;
    const stride = p.run ? 18 : 10;
    const bob = p.roar ? 0 : -Math.abs(Math.sin(ph)) * (p.run ? 3 : 1.5);
    rig.body.position.y = bob;
    // Correndo vai inclinado para a frente; rugindo, ergue o peito e a cabeça
    rig.body.rotation.x = p.run ? 0.12 : p.roar ? -0.12 : 0;
    rig.neck.rotation.x = p.roar ? -0.45 : p.run ? 0.15 : 0;
    rig.head.rotation.x = p.roar ? -0.3 : 0;
    rig.jaw.rotation.x = p.jaw;
    // Rabo esticado para trás, balançando de lado
    const sway = Math.sin(p.run ? ph : ph * 0.5) * (p.run ? 5 : 3);
    rig.tail.forEach((s, i) => {
      const k = i / 9;
      s.position.set(Math.sin(k * 2.2) * sway * k, 64 - i * 1.6 - k * k * 4, -26 - i * 7.4);
    });
    for (const a of rig.arms) {
      const w = Math.sin(ph * 2 + (a.s > 0 ? 1 : 0)) * (p.run ? 0.35 : 0.15);
      a.sh.rotation.x = w - (p.roar ? 0.4 : 0);
      a.el.rotation.x = -w * 0.6;
    }
    for (const l of rig.legs) {
      const lph = ph + (l.s > 0 ? Math.PI : 0);
      const lift = p.roar ? 0 : Math.max(0, -Math.cos(lph)) * (p.run ? 10 : 5);
      const hip = [l.s * 11, 56 + bob, -4];
      const toe = [l.s * 12, 1.5 + lift, (p.roar ? l.s * 4 : Math.sin(lph) * stride) + 10];
      const ankle = [toe[0], toe[1] + 9, toe[2] - 10];
      const knee = ik2(hip, ankle, 26, 25, -1);
      knee[0] = l.s * 12;
      // Coxa musculosa entre o quadril e o joelho
      l.thighBulk.position.set((hip[0] + knee[0]) / 2, hip[1] * 0.6 + knee[1] * 0.4, hip[2] * 0.6 + knee[2] * 0.4);
      l.thighBulk.rotation.x = Math.atan2(knee[2] - hip[2], hip[1] - knee[1]);
      placeBetween(THREE, l.thigh, hip, knee);
      placeBetween(THREE, l.shin, knee, ankle);
      placeBetween(THREE, l.meta, ankle, [toe[0], toe[1] + 1.5, toe[2] - 3]);
      l.knee.position.set(...knee);
      l.ankle.position.set(...ankle);
      l.toes.forEach((tt, i) => {
        const a = (i - 1) * 0.45;
        const base = [toe[0], toe[1] + 1, toe[2] - 3];
        const tip = [toe[0] + Math.sin(a) * 9, 0.8 + lift * 0.3, toe[2] - 3 + Math.cos(a) * 9];
        placeBetween(THREE, tt.t, base, tip);
        tt.c.position.set(tip[0] + Math.sin(a) * 1.5, tip[1], tip[2] + Math.cos(a) * 1.5);
        tt.c.rotation.set(Math.PI / 2, 0, -a);
      });
    }
  },
};

// ---------------------------------------------------------------- Pterossauro
// Apoio: centro do corpo (c.x, by). Asas de pele presas no braço comprido (ombro,
// cotovelo e o dedo longo) batendo, crista para trás, bico comprido e as perninhas
const PTERO_FRAMES = 8;
export const ptero = {
  box: { left: -46, right: 46, top: 36, bottom: -24 },
  res: 2.4,
  elevation: 0.3,
  pose: (c, t) => `${frameOf(t * 9 + c.ph * 3 + Math.PI / 2, PTERO_FRAMES)}${c.dir < 0 ? 'L' : 'R'}`,
  poses() {
    const out = [];
    for (const f of ['R', 'L']) {
      for (let i = 0; i < PTERO_FRAMES; i++) out.push({ key: `${i}${f}`, f, flap: Math.sin(((i + 0.5) / PTERO_FRAMES) * TAU - Math.PI / 2) });
    }
    return out;
  },
  build({ THREE, mat, group, sphere, mesh }) {
    const bodyM = mat('#B5543A', 0.6);
    const crestM = mat('#7A2A1E', 0.6);
    const root = group();
    root.rotation.order = 'YXZ';
    const body = sphere(6, bodyM, 0, 0, 0, 18);
    body.scale.set(0.9, 0.8, 1.7);
    root.add(body);
    const head = group(0, 3, 12);
    root.add(head);
    head.add(sphere(4.4, bodyM, 0, 0, 0, 14));
    const beak = mesh(new THREE.ConeGeometry(2, 16, 10), mat('#E8C070', 0.4), 0, -0.5, 9);
    beak.rotation.x = Math.PI / 2;
    head.add(beak);
    const crest = mesh(new THREE.ConeGeometry(1.8, 13, 8), crestM, 0, 3.5, -5.5);
    crest.rotation.x = -Math.PI / 2 - 0.45;
    head.add(crest);
    for (const s of [-1, 1]) head.add(sphere(1, mat('#1D1410', 0.2), s * 3.4, 1, 2, 8));
    for (const s of [-1, 1]) root.add(kit3Leg(THREE, crestM, s));
    const wings = [-1, 1].map((s) => {
      const g = group();
      root.add(g);
      return { s, g, m: mat(s < 0 ? '#E08A5A' : '#A0583A', 0.6, { side: THREE.DoubleSide }) };
    });
    return { root, wings, head, boneM: crestM, THREE };
  },
  apply(rig, p) {
    const { THREE } = rig;
    rig.root.rotation.y = side(p.f) * (Math.PI / 2 - 0.45);
    rig.root.rotation.x = 0.15;
    const f = p.flap;
    for (const w of rig.wings) {
      for (const o of [...w.g.children]) {
        w.g.remove(o);
        o.geometry.dispose();
      }
      const s = w.s;
      const P = (x, y, z) => [s * x, y, z];
      const S = P(3, 2, 4);
      const E = P(13, 3 + f * 8, 2);
      const Wr = P(22, 4 + f * 13, 0);
      const T = P(36, f * 16 + 1, -4);
      const Bk = P(4, 0, -8);
      const tri = [S, E, Bk, E, Wr, Bk, Wr, T, Bk];
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(tri.flat(), 3));
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, w.m);
      m.castShadow = true;
      w.g.add(m);
      for (const [a, b] of [[S, E], [E, Wr], [Wr, T]]) {
        const bo = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1, 6), rig.boneM);
        placeBetween(THREE, bo, a, b);
        w.g.add(bo);
      }
    }
    rig.head.rotation.x = -f * 0.08;
  },
};

function kit3Leg(THREE, m, s) {
  const g = new THREE.Group();
  const a = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1, 6), m);
  placeBetween(THREE, a, [s * 2.5, -3, -4], [s * 3, -9, -7]);
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.5, 1, 6), m);
  placeBetween(THREE, b, [s * 3, -9, -7], [s * 3, -12, -10]);
  g.add(a, b);
  return g;
}

// ---------------------------------------------------------------- Raptorzinho
// Apoio: pés na fileira (c.x, y). Verde listrado, correndo: pernas com joelho e
// calcanhar alto, rabo esticado, bracinho e a cabeça com boquinha dentada
const RAPTOR_FRAMES = 8;
export const raptor = {
  box: { left: -40, right: 40, top: 44, bottom: -6 },
  res: 2.6,
  elevation: 0.3,
  pose: (c, t) => `${frameOf(t * 18 + c.ph, RAPTOR_FRAMES)}${c.dir < 0 ? 'L' : 'R'}`,
  poses() {
    const out = [];
    for (const f of ['R', 'L']) for (let i = 0; i < RAPTOR_FRAMES; i++) out.push({ key: `${i}${f}`, f, ph: ((i + 0.5) / RAPTOR_FRAMES) * TAU });
    return out;
  },
  build(kit) {
    const { THREE, mat, group, sphere, mesh } = kit;
    const skin = new THREE.MeshStandardMaterial({ map: scaleTexture(THREE, ['#7CC24A', '#5FA83A', '#3E7426'], 'rgba(46, 90, 30, 0.85)', 11), roughness: 0.6 });
    const dark = mat('#3E7426', 0.6);
    const root = group();
    root.rotation.order = 'YXZ';
    const body = group();
    root.add(body);
    const torso = sphere(1, skin, 0, 17, 0, 20);
    torso.scale.set(6, 6.5, 11);
    torso.rotation.x = 0.15;
    body.add(torso);
    const tummy = sphere(1, mat('#D8E8A0', 0.6), 0, 14, 2, 16);
    tummy.scale.set(4.6, 3.4, 8);
    body.add(tummy);
    const tail = taper(kit, body, [[0, 19, -8], [0, 21, -18], [0, 23, -28], [0, 25, -36]], 4.2, 0.8, skin, 8);
    const neck = group(0, 21, 9);
    body.add(neck);
    neck.add(kit.bone(3, [0, 0, 0], [0, 8, 5], skin));
    const head = group(0, 10, 7);
    neck.add(head);
    const skull = sphere(1, skin, 0, 0, 3, 18);
    skull.scale.set(4.2, 4.2, 7.5);
    head.add(skull);
    for (const s of [-1, 1]) {
      head.add(sphere(1.8, mat('#FFFFFF', 0.25), s * 3.2, 1.6, 3, 10));
      head.add(sphere(0.9, mat('#1D1410', 0.2), s * 3.9, 1.6, 4, 8));
    }
    for (let i = 0; i < 4; i++) {
      for (const s of [-1, 1]) {
        const tt = mesh(new THREE.ConeGeometry(0.4, 1.3, 5), mat('#FFF8E6', 0.3), s * 1.8, -1.8, 5 + i * 1.5);
        tt.rotation.x = Math.PI;
        head.add(tt);
      }
    }
    const arms = [-1, 1].map((s) => {
      const a = group(s * 4.5, 15, 7);
      body.add(a);
      a.add(kit.bone(1.1, [0, 0, 0], [0, -3, 3], dark));
      a.add(kit.bone(0.9, [0, -3, 3], [0, -2, 6], dark));
      return a;
    });
    const legs = [-1, 1].map((s) => {
      const m = s < 0 ? skin : dark;
      const o = { s, thigh: rod(THREE, 3.2, 2.2, m), shin: rod(THREE, 2, 1.4, m), meta: rod(THREE, 1.4, 1.1, m), knee: sphere(2.2, m, 0, 0, 0, 10), foot: sphere(1.6, m, 0, 0, 0, 8) };
      root.add(o.thigh, o.shin, o.meta, o.knee, o.foot);
      return o;
    });
    return { root, body, neck, tail, arms, legs, THREE };
  },
  apply(rig, p) {
    const { THREE } = rig;
    rig.root.rotation.y = side(p.f) * (Math.PI / 2 - 0.45);
    const bob = -Math.abs(Math.sin(p.ph)) * 2;
    rig.body.position.y = bob;
    rig.body.rotation.x = 0.08;
    rig.neck.rotation.x = Math.sin(p.ph * 2) * 0.06;
    rig.arms.forEach((a, i) => (a.rotation.x = Math.sin(p.ph + i * Math.PI) * 0.4));
    for (const l of rig.legs) {
      const lph = p.ph + (l.s > 0 ? Math.PI : 0);
      const lift = Math.max(0, -Math.cos(lph)) * 6;
      const hip = [l.s * 3.5, 15 + bob, -2];
      const toe = [l.s * 4, 0.8 + lift, Math.sin(lph) * 9 + 3];
      const ankle = [toe[0], toe[1] + 5, toe[2] - 4];
      const knee = ik2(hip, ankle, 8, 7, -1);
      knee[0] = l.s * 4;
      placeBetween(THREE, l.thigh, hip, knee);
      placeBetween(THREE, l.shin, knee, ankle);
      placeBetween(THREE, l.meta, ankle, [toe[0], toe[1], toe[2] + 3]);
      l.knee.position.set(...knee);
      l.foot.position.set(toe[0], toe[1], toe[2] + 3);
      l.foot.scale.set(1, 0.6, 2.2);
    }
  },
};

// ---------------------------------------------------------------- Amonite
// Apoio: (c.x, y + 2 + balanço). Concha em espiral (enrolada, afinando para o centro)
// com costelas, o olho e os tentáculos na frente ondulando; o anel na lava é 2D
const AMMO_FRAMES = 6;
export const ammonite = {
  box: { left: -26, right: 30, top: 26, bottom: -8 },
  res: 2.8,
  elevation: 0.2,
  pose: (c, t) => `${frameOf(t * 6 + c.ph, AMMO_FRAMES)}${c.dir < 0 ? 'L' : 'R'}`,
  poses() {
    const out = [];
    for (const f of ['R', 'L']) for (let i = 0; i < AMMO_FRAMES; i++) out.push({ key: `${i}${f}`, f, ph: ((i + 0.5) / AMMO_FRAMES) * TAU });
    return out;
  },
  build(kit) {
    const { THREE, mat, group, sphere } = kit;
    const root = group();
    root.rotation.order = 'YXZ';
    const shellTex = canvasTex(THREE, 256, 32, (g, w, h) => {
      g.fillStyle = '#E8D0A0';
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(150, 100, 50, 0.55)';
      for (let x = 0; x < w; x += 9) g.fillRect(x, 0, 2.5, h);
    });
    shellTex.wrapS = THREE.RepeatWrapping;
    shellTex.repeat.set(4, 1);
    const shellM = new THREE.MeshStandardMaterial({ map: shellTex, roughness: 0.4 });
    // Espiral: o tubo fica mais fino a cada volta, enrolado no plano da frente (xy)
    const shell = group(-2, 8, 0);
    root.add(shell);
    const N = 60;
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * TAU * 2.3;
      const a1 = ((i + 1) / N) * TAU * 2.3;
      const R = (a) => 11 * Math.exp(-a * 0.2);
      const p0 = [Math.cos(a0) * R(a0), Math.sin(a0) * R(a0), 0];
      const p1 = [Math.cos(a1) * R(a1), Math.sin(a1) * R(a1), 0];
      const r = R(a0) * 0.42;
      const seg = rod(THREE, r, R(a1) * 0.42, shellM);
      placeBetween(THREE, seg, p0, p1);
      shell.add(seg);
      shell.add(sphere(r, shellM, ...p0, 10));
    }
    // Abertura da concha com o corpo, o olho e os tentáculos
    const face = group(9, 6, 0);
    root.add(face);
    const flesh = mat('#D07A5A', 0.5);
    face.add(sphere(4.4, flesh, 0, 0, 0, 14));
    for (const z of [-2.4, 2.4]) face.add(sphere(1.2, mat('#1D1410', 0.2), 1.5, 2.6, z, 8));
    const tentacles = [];
    for (let i = 0; i < 4; i++) {
      const segs = [0, 1, 2].map(() => {
        const r = rod(THREE, 1, 0.6, flesh);
        face.add(r);
        return r;
      });
      tentacles.push({ i, segs });
    }
    return { root, shell, tentacles, THREE };
  },
  apply(rig, p) {
    const { THREE } = rig;
    // De perfil (a concha de frente para a câmera), virado para onde vai
    rig.root.rotation.y = p.f === 'L' ? Math.PI : 0;
    rig.shell.rotation.z = Math.sin(p.ph) * 0.08;
    for (const tt of rig.tentacles) {
      let pt = [2, -1.5 + tt.i * 1, (tt.i - 1.5) * 1.6];
      tt.segs.forEach((sg, j) => {
        const n = [pt[0] + 3.4, pt[1] + Math.sin(p.ph + tt.i + j) * 1.4 - 0.4, pt[2] + (tt.i - 1.5) * 0.6];
        placeBetween(THREE, sg, pt, n);
        pt = n;
      });
    }
  },
};

// ---------------------------------------------------------------- Ovo de dinossauro
// No lugar do peixe (e no ninho da costa): creme com pintas verdes. Apoio: centro.
// Uma foto só: o balanço é a rotação da foto (como no 2D)
export const egg = {
  box: { left: -12, right: 12, top: 14, bottom: -11 },
  res: 3.4,
  elevation: 0.15,
  pose: () => 'e',
  poses: () => [{ key: 'e' }],
  build({ THREE, group, mesh }) {
    const root = group();
    const tex = canvasTex(THREE, 128, 64, (g, w, h) => {
      g.fillStyle = '#F4EBD0';
      g.fillRect(0, 0, w, h);
      const rnd = rng(5);
      g.fillStyle = '#7BBF4A';
      for (let i = 0; i < 18; i++) {
        g.beginPath();
        g.ellipse(rnd() * w, rnd() * h, 3 + rnd() * 4, 2 + rnd() * 3, rnd() * 3, 0, TAU);
        g.fill();
      }
    });
    const r = 8;
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const a = (i / 20) * Math.PI;
      const y = -Math.cos(a) * r * 1.15;
      const rr = Math.sin(a) * r * (y > 0 ? 0.82 + 0.18 * (1 - y / (r * 1.15)) : 1);
      pts.push(new THREE.Vector2(Math.max(0.01, rr), y));
    }
    const o = mesh(new THREE.LatheGeometry(pts, 32), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 }));
    o.position.y = 1;
    root.add(o);
    return { root };
  },
  apply() {},
};

// ---------------------------------------------------------------- Pedras de basalto
// Mesmas medidas do sprite 2D (rockSprite): pés em y = 0, 26 abaixo do topo da foto,
// altura 62. O mesmo modelo de rocha do espaço, em basalto escuro com a borda
// incandescente da lava em volta; acesas, cobertas de âmbar com cristais dourados.
export const BASALT = {
  dims: { PAD: 12, TOP: 26, H: 62, VARIANTS: 3 }, top: 0.9, bot: -11, ringY: -9.5,
  off: ['#6A5E58', '#4E4440', '#241C1A'], on: ['#FFD27A', '#C89A5A', '#6A4A26'], onGlow: '#8A4A00',
  crystal: ['#FFB627', '#FF8A00'], vein: ['#FFE27A', '#FFB020'], ring: ['#FF7A20', '#FF5A00', 0.6, 1.4],
  pebble: ['#3A302C', '#A87A3A'],
};
const basalts = new Map();
export function basaltSubject(w) {
  if (!basalts.has(w)) basalts.set(w, makeRockSubject(w, BASALT));
  return basalts.get(w);
}

// ---------------------------------------------------------------- Caverna
// Mesmo lugar, mesmas 16 peças e mesma porta da caverna 2D (src/dino.js): 6 pedras da
// parede em duas fileiras (com pedras de trás dando volume), 4 pedras do topo, 2
// presas de osso em volta da entrada, o respiro com brasa, o crânio de tricerátops e a
// tocha (a chama é 2D). A entrada escura e a pedra redonda que rola continuam 2D; as
// presas, quando a caverna fica pronta, são desenhadas de novo por cima da pedra
// (foto "caveTusks"). Frente das pedras perto de z = 0. Fotos: "n1".."n15", "b0".."b14".
function boulderGeo(THREE, rx, ry, rz, seed) {
  const geo = new THREE.SphereGeometry(1, 28, 20);
  const pos = geo.attributes.position;
  const rnd = rng(seed);
  const bumps = Array.from({ length: 6 }, () => [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1, rnd()]);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    let k = 1;
    for (const [x, y, z, a] of bumps) k += 0.1 * a * Math.max(0, v.dot(new THREE.Vector3(x, y, z).normalize())) ** 3;
    k -= 0.04 * Math.sin(v.x * 7 + seed) * Math.sin(v.y * 5);
    pos.setXYZ(i, v.x * rx * k, v.y * ry * k, v.z * rz * k);
  }
  geo.computeVertexNormals();
  return geo;
}

function stoneMaterial(THREE, tone, seed) {
  const tex = canvasTex(THREE, 128, 64, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, tone ? '#9A8C80' : '#A89A8C');
    grd.addColorStop(0.55, '#7A6E64');
    grd.addColorStop(1, '#4A4038');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    const rnd = rng(seed);
    for (let i = 0; i < 60; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(40, 30, 24, 0.35)' : 'rgba(220, 210, 190, 0.18)';
      g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 3, 1 + rnd() * 2);
    }
    // Musgo no alto
    g.fillStyle = 'rgba(100, 150, 60, 0.55)';
    for (let i = 0; i < 26; i++) {
      g.beginPath();
      g.arc(rnd() * w, h * (0.05 + rnd() * 0.18), 2 + rnd() * 3, 0, TAU);
      g.fill();
    }
  });
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 });
}

// Presa de osso curvada em volta da entrada (lado s), em coordenadas da caverna
function addTusk(kit, g, s) {
  const { mat } = kit;
  const x0 = s * (CAVE_DOOR.w + 7);
  const by = -(CAVE_DOOR.bottom - IGLOO.baseY);
  taper(kit, g, [[x0, by, 8], [x0 + s * 4, by + 30, 10], [x0 + s * 2, by + 56, 11], [x0 - s * 10, by + 78, 12]], 4.6, 1.2, mat('#EFE4C8', 0.45), 12);
}

export const cave = {
  box: { left: -170, right: 160, top: 170, bottom: -20 },
  res: 1.5,
  elevation: 0.2,
  poses() {
    const out = [];
    for (let n = 1; n < CAVE_PIECES.length; n++) out.push({ key: `n${n}`, upto: n });
    for (let i = 0; i < CAVE_PIECES.length - 1; i++) out.push({ key: `b${i}`, only: i });
    return out;
  },
  build(kit) {
    const { THREE, mat, group, mesh, sphere } = kit;
    const { ROWS, ROW_H, SLABS, VENT, SKULL, TORCH } = CAVE;
    const stones = [stoneMaterial(THREE, 0, 3), stoneMaterial(THREE, 1, 7)];
    const root = group();
    const pieces = [];
    for (const [pi, p] of CAVE_PIECES.slice(0, -1).entries()) {
      const g = group();
      if (p.kind === 'wall') {
        const R = ROWS[p.row];
        const cw = (R.hw * 2) / 3;
        const cx = -R.hw + cw * (p.col + 0.5);
        const cy = -(R.y1 - ROW_H[p.row] / 2);
        const rx = cw / 2 + 3;
        const ry = ROW_H[p.row] / 2 + 3;
        g.add(mesh(boulderGeo(THREE, rx, ry, 20, 11 + pi), stones[(p.row + p.col) % 2], cx, cy, -16));
        g.add(mesh(boulderGeo(THREE, rx * 0.95, ry, 22, 41 + pi), stones[(p.row + p.col + 1) % 2], cx * 0.9, cy + 4, -50));
      } else if (p.kind === 'roof') {
        const s = SLABS[p.i];
        g.add(mesh(boulderGeo(THREE, s.r + 4, s.r, 26, 31 + p.i), stones[p.i % 2], s.x, -s.y, -28));
      } else if (p.kind === 'tusk') {
        addTusk(kit, g, p.side);
      } else if (p.kind === 'vent') {
        const ring = mesh(new THREE.TorusGeometry(11, 4, 10, 24), mat('#5A4E46', 0.9), VENT.x, -VENT.y, -26);
        ring.rotation.x = Math.PI / 2;
        g.add(ring);
        const glow = mesh(new THREE.CircleGeometry(8, 20), mat('#FF9A3C', 0.4, { emissive: '#FF6A10', emissiveIntensity: 1.1 }), VENT.x, -VENT.y + 0.5, -26);
        glow.rotation.x = -Math.PI / 2;
        g.add(glow);
      } else if (p.kind === 'skull') {
        // Crânio de tricerátops: babado, rosto, três chifres e os olhos vazios
        const sk = group(SKULL.x, -SKULL.y, 8);
        g.add(sk);
        const bone = mat('#EFE4C8', 0.5);
        const frill = mesh(new THREE.CircleGeometry(22, 28, 0, Math.PI), mat('#D8CCAE', 0.6, { side: THREE.DoubleSide }), 0, 2, -3);
        frill.scale.y = 0.6;
        sk.add(frill);
        for (let i = -2; i <= 2; i++) sk.add(sphere(2.2, mat('#B8A884', 0.6), i * 8, 10 - Math.abs(i) * 2, -2.4, 8));
        const face = sphere(1, bone, 0, 0, 0, 18);
        face.scale.set(11, 9, 7);
        sk.add(face);
        for (const [hx, hy, tx, ty] of [[-6, 3, -14, 20], [6, 3, 14, 20], [0, -5, 0, -12]]) {
          const h = mesh(new THREE.ConeGeometry(3, 1, 10), bone);
          placeBetween(THREE, h, [hx, hy, 4], [tx, ty, 7]);
          sk.add(h);
        }
        for (const s of [-1, 1]) {
          const e = sphere(2.6, mat('#2A1E18', 0.9), s * 4.5, 1, 6, 10);
          e.scale.set(1, 1.2, 0.5);
          sk.add(e);
        }
      } else if (p.kind === 'torch') {
        g.add(kit.bone(2.4, [TORCH.x, 0, -6], [TORCH.x + 2, 52, -6], mat('#6A4426', 0.8)));
        g.add(mesh(new THREE.CylinderGeometry(5.5, 4, 8, 10), mat('#4A3020', 0.8), TORCH.x + 2, 54, -6));
        g.add(sphere(3.6, mat('#FF8A2A', 0.4, { emissive: '#FF6A00', emissiveIntensity: 1.2 }), TORCH.x + 2, 58, -6, 10));
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

// As duas presas sozinhas (por cima da pedra da porta quando a caverna fica pronta)
export const caveTusks = {
  box: cave.box,
  res: 1.5,
  elevation: 0.2,
  poses: () => [{ key: 't' }],
  build(kit) {
    const root = kit.group();
    addTusk(kit, root, -1);
    addTusk(kit, root, 1);
    return { root };
  },
  apply() {},
};

// ---------------------------------------------------------------- Samambaia e ninho
// Samambaia gigante (escala 1; as outras são a mesma foto em escala), base em (0, 0):
// tronco fibroso com escamas e folhas compridas em leque com folíolos
export const fern = {
  box: { left: -80, right: 80, top: 170, bottom: -8 },
  res: 1.8,
  elevation: 0.12,
  poses: () => [{ key: 'f' }],
  build(kit) {
    const { THREE, mat, group, mesh } = kit;
    const root = group();
    const bark = canvasTex(THREE, 64, 128, (g, w, h) => {
      g.fillStyle = '#5A3E26';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(30, 18, 8, 0.7)';
      g.lineWidth = 3;
      for (let y = 4; y < h; y += 10) {
        g.beginPath();
        g.moveTo(0, y);
        g.quadraticCurveTo(w / 2, y - 6, w, y);
        g.stroke();
      }
    });
    bark.wrapS = bark.wrapT = THREE.RepeatWrapping;
    bark.repeat.set(2, 4);
    taper(kit, root, [[0, 0, 0], [-2, 40, 0], [-1, 80, 0], [2, 112, 0]], 7, 4.5, new THREE.MeshStandardMaterial({ map: bark, roughness: 0.95 }), 10);
    const leafA = mat('#4E8A2E', 0.6, { side: THREE.DoubleSide });
    const leafB = mat('#3E7426', 0.6, { side: THREE.DoubleSide });
    for (let i = 0; i < 10; i++) {
      const yaw = (i / 10) * TAU + 0.3;
      const len = 62 + (i % 3) * 8;
      const dir = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw) * 0.75);
      const pts = [];
      for (let j = 0; j <= 8; j++) {
        const s = j / 8;
        pts.push(new THREE.Vector3(2 + dir.x * len * s, 112 + Math.sin(s * Math.PI * 0.7) * 26 - s * s * 34, dir.z * len * s));
      }
      root.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.8, 5), leafB));
      const sideV = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
      for (let j = 1; j < 8; j++) {
        const a = pts[j];
        const b = pts[j + 1];
        const fl = 11 * (1 - j / 10);
        for (const s of [-1, 1]) {
          const tipP = a.clone().addScaledVector(sideV, s * fl).add(new THREE.Vector3(0, -3, 0)).addScaledVector(dir, 3);
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
};

// Ninho de gravetos com os dois ovos dos lados (o do meio, que balança quase
// chocando, é a foto do ovo desenhada por cima). Base em (0, 0)
export const nest = {
  box: { left: -36, right: 36, top: 26, bottom: -8 },
  res: 2.6,
  elevation: 0.25,
  poses: () => [{ key: 'n' }],
  build(kit) {
    const { THREE, mat, group, mesh } = kit;
    const root = group();
    const twig = mat('#7A5A30', 0.85);
    const dark = mat('#6A4A26', 0.9);
    const bowl = mesh(new THREE.TorusGeometry(19, 6, 10, 28), dark, 0, 3, 0);
    bowl.rotation.x = Math.PI / 2;
    bowl.scale.set(1, 0.7, 1);
    root.add(bowl);
    const rnd = rng(9);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * TAU;
      const r = 18 + rnd() * 5;
      const p0 = [Math.cos(a) * r, 2 + rnd() * 5, Math.sin(a) * r * 0.7];
      const p1 = [Math.cos(a + 0.6) * (r + 3), 3 + rnd() * 5, Math.sin(a + 0.6) * (r + 3) * 0.7];
      root.add(kit.bone(0.9, p0, p1, twig));
    }
    // Ovos dos lados (o do meio é desenhado à parte, balançando)
    const eggM = egg.build(kit);
    for (const [x, tilt] of [[-11, 0.2], [11, -0.25]]) {
      const e = eggM.root.clone();
      e.position.set(x, 5, -2);
      e.rotation.z = tilt;
      root.add(e);
    }
    return { root };
  },
  apply() {},
};
