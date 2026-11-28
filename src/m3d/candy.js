// Reino dos doces em 3D (fase 40): homem-biscoito de gengibre de pé (biscoito grosso
// com a borda fofa, glacê branco em relevo, botões de bala de goma, braços com
// cotovelo e pernas com joelho, correndo de braços para a frente e boca aberta na
// perseguição), abelha de mel com asas transparentes e patinhas articuladas, minhoca
// de goma listrada em arco saindo do chocolate, bala de goma pulando, rosquinha com
// cobertura e granulado, biscoitos waffle boiando no lugar das placas (acesos =
// glacê rosa escorrendo com granulado), a casa de biscoito montada peça por peça e os
// enfeites da costa (pirulito, bengala e balas de goma).
// Mesmos pontos de apoio do desenho 2D (src/candy.js); y para cima.
import { TAU } from './kit.js';
import { box as bearBox } from './bear.js';
import { GINGER_HOUSE, GINGER_PIECES, COOKIE, GUMDROP_COLORS, SPRINKLES, GUMMY } from '../candy.js';

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

// Massa de biscoito de gengibre: dourada com furinhos e manchas de forno
function doughTexture(THREE, seed = 3, base = '#C9823E') {
  const t = canvasTex(THREE, 256, 256, (g, w, h) => {
    const rnd = rng(seed);
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(120, 60, 20, 0.18)' : 'rgba(250, 200, 140, 0.16)';
      g.beginPath();
      g.arc(rnd() * w, rnd() * h, 2 + rnd() * 9, 0, TAU);
      g.fill();
    }
    g.fillStyle = 'rgba(80, 36, 10, 0.55)';
    for (let i = 0; i < 70; i++) {
      g.beginPath();
      g.arc(rnd() * w, rnd() * h, 0.8 + rnd() * 1.4, 0, TAU);
      g.fill();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function doughMaterial(THREE, seed, repeat = 1 / 60, base) {
  const map = doughTexture(THREE, seed, base);
  map.repeat.set(repeat, repeat);
  return new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 0.8, roughness: 0.82, metalness: 0 });
}

// Tubo de glacê por uma lista de pontos
function icingTube(kit, pts, r, m, closed = false) {
  const { THREE, mesh } = kit;
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), closed);
  return mesh(new THREE.TubeGeometry(curve, Math.max(24, pts.length * 6), r, 8, closed), m);
}

// Glacê em zigue-zague atravessando a ponta de um membro (coordenadas locais: x de
// lado, y ao longo do membro, z para fora)
function zigzag(kit, width, m) {
  const pts = [];
  for (let i = 0; i <= 6; i++) pts.push([-width / 2 + (i / 6) * width, i % 2 ? 2.2 : 0, 0]);
  return icingTube(kit, pts, 0.9, m);
}

// ---------------------------------------------------------------- Homem-biscoito
// No lugar do urso. Biscoito grosso de borda arredondada (cabeça e corpo), de frente
// para a câmera e um pouco virado para onde corre; os braços e as pernas balançam no
// plano do biscoito, com cotovelo e joelho. Fotos: walk{quadro}{lado}{boca} (andando
// sorridente; perseguindo, corre inclinado com os braços esticados e a boca aberta)
export const GINGER_FRAMES = 12;
const HEAD = { y: 118, r: 26 };
const TORSO = { y0: 34, y1: 96, hw: 24 };
const HIP = { x: 11, y: 40, len: 38 };
const SHOULDER = { x: 19, y: 86, len: 34 };
const COOKIE_DEPTH = 9;
const COOKIE_BEVEL = 3.5;
const FRONT = COOKIE_DEPTH / 2 + COOKIE_BEVEL + 0.3;
export const GINGERMAN = { HEAD, TORSO, HIP, SHOULDER, FRONT };

export const gingerman = {
  box: { left: -96, right: 96, top: 172, bottom: bearBox.bottom },
  res: 2,
  elevation: 0.12,
  pose(b, t) {
    const d = b.dir < 0 ? 'L' : 'R';
    const f = frameOf(b.walk * (b.chasing ? 5 : 3.5), GINGER_FRAMES);
    const m = b.chasing ? (Math.abs(Math.sin(t * 12)) > 0.5 ? 2 : 1) : 0;
    return `walk${f}${d}${m}`;
  },
  poses() {
    const out = [];
    for (const f of ['R', 'L']) {
      for (let i = 0; i < GINGER_FRAMES; i++) {
        for (let m = 0; m < 3; m++) out.push({ key: `walk${i}${f}${m}`, f, u: (i + 0.5) / GINGER_FRAMES, run: m > 0, mouth: [0, 0.6, 1][m] });
      }
    }
    return out;
  },
  build(kit) {
    const { THREE, mat, group, sphere, mesh, sweep } = kit;
    const dough = doughMaterial(THREE, 7);
    const doughLimb = doughMaterial(THREE, 11, 1 / 40);
    const icing = mat('#FFFFFF', 0.45);
    const ink = mat('#2A1408', 0.3);
    const mouthM = mat('#6A1A14', 0.6);
    const cheekM = mat('#FF8A9A', 0.7, { transparent: true, opacity: 0.8 });
    const root = group();
    root.rotation.order = 'YXZ';
    const body = group();
    root.add(body);
    // Corpo e cabeça: duas peças de biscoito extrudadas com a borda bem arredondada
    const ext = { depth: COOKIE_DEPTH, bevelEnabled: true, bevelThickness: COOKIE_BEVEL, bevelSize: 3.4, bevelSegments: 4, curveSegments: 24 };
    const torsoShape = new THREE.Shape();
    {
      const { y0, y1, hw } = TORSO;
      const r = 16;
      torsoShape.moveTo(-hw + r, y0);
      torsoShape.lineTo(hw - r, y0);
      torsoShape.quadraticCurveTo(hw, y0, hw, y0 + r);
      torsoShape.lineTo(hw, y1 - r);
      torsoShape.quadraticCurveTo(hw, y1, hw - r, y1);
      torsoShape.lineTo(-hw + r, y1);
      torsoShape.quadraticCurveTo(-hw, y1, -hw, y1 - r);
      torsoShape.lineTo(-hw, y0 + r);
      torsoShape.quadraticCurveTo(-hw, y0, -hw + r, y0);
    }
    const torsoGeo = new THREE.ExtrudeGeometry(torsoShape, ext);
    torsoGeo.translate(0, 0, -COOKIE_DEPTH / 2);
    body.add(mesh(torsoGeo, dough));
    const headShape = new THREE.Shape();
    headShape.absarc(0, HEAD.y, HEAD.r - 3, 0, TAU, false);
    const headGeo = new THREE.ExtrudeGeometry(headShape, ext);
    headGeo.translate(0, 0, -COOKIE_DEPTH / 2);
    const head = group();
    body.add(head);
    head.add(mesh(headGeo, dough));
    // Pescoço (une a cabeça ao corpo, por dentro)
    body.add(mesh(new THREE.BoxGeometry(22, 14, COOKIE_DEPTH + 4), dough, 0, 96, 0));
    // Glacê ondulado em volta da cabeça e do corpo, na frente
    const ring = [];
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * TAU;
      const rr = HEAD.r - 7 + Math.sin(a * 16) * 0.9;
      ring.push([Math.cos(a) * rr, HEAD.y + Math.sin(a) * rr, FRONT]);
    }
    head.add(icingTube(kit, ring, 1.1, icing, true));
    // Olhos de glacê com a pupila, bochechas
    const faces = { calm: group(), mad: group() };
    for (const s of [-1, 1]) {
      const ew = sphere(4.4, icing, s * 8, HEAD.y + 4, FRONT, 16);
      ew.scale.set(1, 1.1, 0.45);
      head.add(ew);
      const pu = sphere(2.3, ink, s * 8 + 1, HEAD.y + 3.5, FRONT + 1.6, 12);
      pu.scale.z = 0.5;
      head.add(pu);
      const ck = sphere(3.6, cheekM, s * 15, HEAD.y - 7, FRONT - 0.4, 12);
      ck.scale.z = 0.3;
      head.add(ck);
      // Sobrancelhas: retas e calmas, ou franzidas na perseguição
      for (const [k, g] of Object.entries(faces)) {
        const br = kit.capsule(1.1, 6, icing, s * 8, HEAD.y + 12.5, FRONT + 0.4);
        br.rotation.z = Math.PI / 2 + (k === 'mad' ? s * 0.45 : -s * 0.12);
        g.add(br);
      }
    }
    // Boca: sorriso de glacê (calmo) ou boca aberta com a borda de glacê (bravo)
    const smile = [];
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI + 0.45 + (i / 12) * (Math.PI - 0.9);
      smile.push([Math.cos(a) * 9, HEAD.y - 6 + Math.sin(a) * 6, FRONT + 0.2]);
    }
    faces.calm.add(icingTube(kit, smile, 1.1, icing));
    const mouth = group(0, HEAD.y - 9, FRONT);
    faces.mad.add(mouth);
    const hole = sphere(7, mouthM, 0, 0, -0.6, 18);
    hole.scale.set(1, 0.7, 0.3);
    mouth.add(hole);
    const lip = [];
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * TAU;
      lip.push([Math.cos(a) * 7.4, Math.sin(a) * 5.2, 0.4]);
    }
    mouth.add(icingTube(kit, lip, 0.9, icing, true));
    mouth.add(mesh(new THREE.BoxGeometry(9, 2, 1), icing, 0, 3.4, 0.4));
    for (const g of Object.values(faces)) head.add(g);
    // Glacê em volta do corpo e os botões de bala de goma
    const edge = [];
    {
      const { y0, y1, hw } = TORSO;
      const x0 = -hw + 5;
      const x1 = hw - 5;
      const ya = y0 + 5;
      const yb = y1 - 5;
      const r = 11;
      const corners = [[x1 - r, ya + r, -Math.PI / 2], [x1 - r, yb - r, 0], [x0 + r, yb - r, Math.PI / 2], [x0 + r, ya + r, Math.PI]];
      for (const [cx, cy, a0] of corners) {
        for (let i = 0; i <= 6; i++) {
          const a = a0 + (i / 6) * (Math.PI / 2);
          edge.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, FRONT]);
        }
      }
    }
    body.add(icingTube(kit, edge.map((p, i) => [p[0], p[1] + (i % 2) * 0.6, p[2]]), 1, icing, true));
    GINGER_BUTTONS.forEach((col, i) => {
      const b = sphere(4.6, mat(col, 0.25, { emissive: col, emissiveIntensity: 0.12 }), 0, 82 - i * 15, FRONT + 0.6, 14);
      b.scale.set(1, 0.9, 0.6);
      body.add(b);
      body.add(sphere(1.2, mat('#FFFFFF', 0.2), -1.6, 83.6 - i * 15, FRONT + 3, 8));
    });
    // Braços e pernas: peças achatadas de biscoito (largas no plano do biscoito) que
    // dobram no cotovelo e no joelho, com o zigue-zague de glacê na ponta
    const limb = (len) => sweep(limbSpine([0, 0, 0], [0, -len / 2, 0], [0, -len, 0], 8.6, 5.6), doughLimb, { radial: 18, cap: 0.95, up: [0, 0, 1] });
    const legs = [-1, 1].map((s) => {
      const l = { s, mesh: limb(HIP.len), zig: zigzag(kit, 14, icing) };
      root.add(l.mesh, l.zig);
      return l;
    });
    const arms = [-1, 1].map((s) => {
      const a = { s, mesh: limb(SHOULDER.len), zig: zigzag(kit, 12, icing) };
      root.add(a.mesh, a.zig);
      return a;
    });
    return { root, body, head, faces, legs, arms, kit, THREE };
  },
  apply(rig, p) {
    const dir = side(p.f);
    // De frente para a câmera e virado um pouco para onde corre
    rig.root.rotation.y = dir * 0.5;
    const ph = p.u * TAU;
    const bob = Math.abs(Math.cos(ph)) * (p.run ? 5 : 3);
    rig.body.position.y = bob;
    // Inclinado para a frente correndo (o topo vai na direção da corrida)
    const lean = p.run ? 0.16 : 0.05;
    rig.body.rotation.z = -dir * lean;
    rig.faces.calm.visible = p.mouth === 0;
    rig.faces.mad.visible = p.mouth > 0;
    if (p.mouth > 0) {
      const mouth = rig.faces.mad.children.find((c) => c.isGroup);
      if (mouth) mouth.scale.set(1, 0.8 + p.mouth * 0.45, 1);
    }
    rig.body.updateMatrixWorld(true);
    const { THREE, kit } = rig;
    const v = new THREE.Vector3();
    const toBody = (x, y) => {
      v.set(x, y, 0).applyMatrix4(rig.body.matrix);
      return [v.x, v.y, v.z];
    };
    // Pernas: passo no plano do biscoito; a que vai à frente dobra o joelho
    for (const l of rig.legs) {
      const lph = ph + (l.s > 0 ? Math.PI : 0);
      const swing = Math.sin(lph) * (p.run ? 0.62 : 0.42);
      const lift = Math.max(0, Math.cos(lph)) * (p.run ? 10 : 6);
      const hip = toBody(l.s * HIP.x, HIP.y);
      const foot = [hip[0] + dir * Math.sin(swing) * HIP.len, Math.max(4, hip[1] - Math.cos(swing) * HIP.len + lift), hip[2]];
      const bend = Math.max(0, Math.cos(lph)) * 6;
      const knee = [(hip[0] + foot[0]) / 2 + dir * bend, (hip[1] + foot[1]) / 2, hip[2] + 1];
      kit.resweep(l.mesh, limbSpine(hip, knee, foot, 8.6, 5.6), { radial: 18, cap: 0.95, up: [0, 0, 1] });
      placeZig(THREE, l.zig, knee, foot, 7);
    }
    // Braços: balançam ao contrário das pernas; perseguindo, esticados para a frente e
    // para cima, sacudindo
    for (const a of rig.arms) {
      const aph = ph + (a.s > 0 ? 0 : Math.PI);
      const sh = toBody(a.s * SHOULDER.x, SHOULDER.y);
      let ang;
      if (p.run) ang = 1.75 + Math.sin(aph * 2) * 0.18 + (a.s > 0 ? 0.12 : -0.08);
      else ang = Math.sin(aph) * 0.55 + 0.25;
      // Ângulo a partir de "para baixo", girando para a frente (dir) e para fora (s)
      const out = a.s * dir < 0 ? 0.35 : 0.25;
      const hand = [
        sh[0] + dir * Math.sin(ang) * SHOULDER.len + a.s * Math.cos(ang) * out * 12,
        sh[1] - Math.cos(ang) * SHOULDER.len,
        sh[2] + 1.5,
      ];
      const elbow = [(sh[0] + hand[0]) / 2 - dir * 3, (sh[1] + hand[1]) / 2 - 3, sh[2] + 1.5];
      kit.resweep(a.mesh, limbSpine(sh, elbow, hand, 7.6, 5.2), { radial: 18, cap: 0.95, up: [0, 0, 1] });
      placeZig(THREE, a.zig, elbow, hand, 6);
    }
  },
};
export const GINGER_BUTTONS = ['#FF4A6A', '#4AC86A', '#5A9AFF'];

// Membro de biscoito: ombro/quadril → cotovelo/joelho → ponta arredondada
function limbSpine(a, m, b, w, h) {
  const lerp = (p, q, t) => p.map((x, i) => x + (q[i] - x) * t);
  return [
    { p: lerp(m, a, 1.2), w: w * 1.05, h },
    { p: a, w, h },
    { p: m, w: w * 0.95, h: h * 0.95 },
    { p: lerp(m, b, 0.6), w: w * 0.95, h: h * 0.95 },
    { p: b, w: w * 0.92, h: h * 0.9 },
  ];
}

// Glacê na ponta do membro: perpendicular ao membro, na frente do biscoito
function placeZig(THREE, zig, m, b, back) {
  const d = new THREE.Vector3(b[0] - m[0], b[1] - m[1], 0).normalize();
  zig.position.set(b[0] - d.x * back, b[1] - d.y * back, b[2] + 5.4);
  zig.rotation.set(0, 0, Math.atan2(d.y, d.x) + Math.PI / 2);
}

// ---------------------------------------------------------------- Abelha
// Apoio: centro do corpo (c.x, by). Corpo listrado de amarelo e preto, cabeça preta com
// os olhões, antenas em duas partes, ferrão, dois pares de asas transparentes batendo
// e as seis patinhas com joelho
const BEE_FRAMES = 6;
export const bee = {
  box: { left: -36, right: 36, top: 34, bottom: -26 },
  res: 2.6,
  elevation: 0.25,
  pose: (c, t) => `${frameOf(t * 40 + c.ph * 3, BEE_FRAMES)}${c.dir < 0 ? 'L' : 'R'}`,
  poses() {
    const out = [];
    for (const f of ['R', 'L']) {
      for (let i = 0; i < BEE_FRAMES; i++) {
        const ph = ((i + 0.5) / BEE_FRAMES) * TAU;
        out.push({ key: `${i}${f}`, f, flap: Math.sin(ph), ph });
      }
    }
    return out;
  },
  build(kit) {
    const { THREE, mat, group, sphere, mesh } = kit;
    const stripes = canvasTex(THREE, 64, 128, (g, w, h) => {
      g.fillStyle = '#FFC82A';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#2A1E10';
      for (const y of [0.3, 0.5, 0.7]) g.fillRect(0, y * h - 7, w, 13);
      g.fillStyle = 'rgba(255, 255, 255, 0.12)';
      g.fillRect(0, 0, w, h * 0.2);
    });
    const black = mat('#2A1E10', 0.5);
    const root = group();
    root.rotation.order = 'YXZ';
    // Abdômen listrado deitado ao longo de z (frente = +z)
    const abd = mesh(new THREE.SphereGeometry(9, 26, 20), new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.5 }), 0, 0, -3);
    abd.rotation.x = Math.PI / 2;
    abd.scale.set(1, 1.35, 0.92);
    root.add(abd);
    // Tórax peludinho e a cabeça
    root.add(sphere(5.6, mat('#3A2A14', 0.95), 0, 1, 9, 16));
    const head = group(0, 1.5, 14.5);
    root.add(head);
    head.add(sphere(5, black, 0, 0, 0, 16));
    for (const s of [-1, 1]) {
      const eye = sphere(2.6, mat('#FFFFFF', 0.25), s * 2.8, 1.2, 3.2, 12);
      eye.scale.set(1, 1.2, 0.7);
      head.add(eye);
      head.add(sphere(1.3, mat('#0A0A0A', 0.2), s * 3, 1.2, 4.9, 10));
      // Antena em duas partes com a bolinha na ponta
      head.add(kit.bone(0.45, [s * 1.6, 4, 2], [s * 3.4, 9, 4], black));
      head.add(kit.bone(0.4, [s * 3.4, 9, 4], [s * 5.4, 11, 8], black));
      head.add(sphere(0.9, black, s * 5.4, 11, 8, 8));
    }
    const smile = mesh(new THREE.TorusGeometry(1.4, 0.35, 6, 12, Math.PI * 0.8), mat('#FFFFFF', 0.4), 0, -1.6, 4.7);
    smile.rotation.z = Math.PI * 1.1;
    head.add(smile);
    // Ferrão
    const sting = mesh(new THREE.ConeGeometry(1.3, 5, 10), black, 0, -0.5, -16.5);
    sting.rotation.x = -Math.PI / 2;
    root.add(sting);
    // Asas: pares de lâminas transparentes que batem (dianteira maior)
    const wingM = mat('#DCEFFF', 0.1, { transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false });
    const veinM = mat('#8AA8C8', 0.4, { transparent: true, opacity: 0.6 });
    const wings = [];
    for (const s of [-1, 1]) {
      for (const [z, len, wid] of [[8, 15, 6.4], [3, 11, 5]]) {
        const hinge = group(s * 3, 5.5, z);
        const shape = new THREE.Shape();
        shape.absellipse(s * len / 2, 0, len / 2, wid / 2, 0, TAU, false);
        const blade = mesh(new THREE.ShapeGeometry(shape, 20), wingM);
        blade.rotation.x = -Math.PI / 2;
        blade.castShadow = false;
        hinge.add(blade);
        hinge.add(kit.bone(0.2, [0, 0.1, 0], [s * len * 0.9, 0.1, -0.5], veinM));
        root.add(hinge);
        wings.push({ hinge, s, back: z < 5 });
      }
    }
    // Patinhas: três de cada lado, com coxa e canela (joelho dobrado)
    const legs = [];
    for (const s of [-1, 1]) {
      for (const z of [10, 7, 4]) {
        const hip = [s * 3.5, -3, z];
        const knee = [s * 7, -6.5, z - 1];
        const foot = [s * 6.4, -11, z + 0.5];
        const up = kit.bone(0.55, hip, knee, black);
        const low = kit.bone(0.45, knee, foot, black);
        root.add(up, low);
        legs.push({ up, low, s, z });
      }
    }
    return { root, wings, legs, head };
  },
  apply(rig, p) {
    rig.root.rotation.y = side(p.f) * (Math.PI / 2 - 0.45);
    rig.root.rotation.x = 0.12;
    for (const w of rig.wings) {
      w.hinge.rotation.z = w.s * (0.2 + p.flap * 0.65 + (w.back ? -0.15 : 0));
      w.hinge.rotation.y = w.s * (w.back ? 0.35 : 0.1);
    }
    rig.head.rotation.x = Math.sin(p.ph) * 0.06;
  },
};

// ---------------------------------------------------------------- Minhoca de goma
// Apoio: (c.x, y + 8), meio dentro do chocolate (só aparece o que fica acima). Corpo
// de goma em três cores, coberto de açúcar cristal, em arco saindo e voltando para o
// chocolate; a cabeça com os olhinhos vai na frente
const WORM_FRAMES = 8;
export const worm = {
  box: { left: -40, right: 40, top: 34, bottom: -10 },
  res: 2.6,
  elevation: 0.3,
  pose: (c, t) => `${frameOf(t * 6 + c.ph, WORM_FRAMES)}${c.dir < 0 ? 'L' : 'R'}`,
  poses() {
    const out = [];
    for (const f of ['R', 'L']) for (let i = 0; i < WORM_FRAMES; i++) out.push({ key: `${i}${f}`, f, ph: ((i + 0.5) / WORM_FRAMES) * TAU });
    return out;
  },
  build(kit) {
    const { THREE, mat, group, sphere } = kit;
    const tex = canvasTex(THREE, 64, 192, (g, w, h) => {
      const cols = ['#FF4A6A', '#FFC83A', '#4AC86A'];
      cols.forEach((c, i) => {
        g.fillStyle = c;
        g.fillRect(0, (i * h) / 3, w, h / 3 + 1);
      });
      const rnd = rng(17);
      for (let i = 0; i < 240; i++) {
        g.fillStyle = `rgba(255, 255, 255, ${0.4 + rnd() * 0.5})`;
        g.fillRect(rnd() * w, rnd() * h, 1.6, 1.6);
      }
    });
    const skin = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, emissive: '#3A0A10', emissiveIntensity: 0.15 });
    const root = group();
    root.rotation.order = 'YXZ';
    const body = kit.sweep(wormSpine(0), skin, { radial: 16, cap: 0.9 });
    root.add(body);
    const eyes = [];
    for (const s of [-1, 1]) {
      const e = sphere(1.8, mat('#FFFFFF', 0.25), 0, 0, 0, 10);
      const pu = sphere(0.9, mat('#1A1010', 0.2), 0, 0, 0, 8);
      root.add(e, pu);
      eyes.push({ e, pu, s });
    }
    return { root, body, eyes, kit };
  },
  apply(rig, p) {
    rig.root.rotation.y = side(p.f) * (Math.PI / 2 - 0.45);
    const sp = wormSpine(p.ph);
    rig.kit.resweep(rig.body, sp, { radial: 16, cap: 0.9 });
    const h = sp[sp.length - 1].p;
    for (const e of rig.eyes) {
      e.e.position.set(e.s * 2.2, h[1] + 3, h[2] + 1.4);
      e.pu.position.set(e.s * 2.4, h[1] + 3, h[2] + 2.8);
    }
  },
};

// Arco da minhoca, da cauda (dentro do chocolate, atrás) à cabeça (na frente)
export function wormSpine(ph) {
  const pts = [];
  const hgt = 18 + Math.sin(ph) * 4;
  for (let i = 0; i <= 10; i++) {
    const k = i / 10;
    pts.push({
      p: [Math.sin(ph + k * 6) * 1.2, -4 + Math.sin(k * Math.PI) * hgt + (k > 0.85 ? (k - 0.85) * 20 : 0), -22 + k * 44],
      w: 4.2, h: 4.2,
    });
  }
  return pts;
}

// ---------------------------------------------------------------- Bala de goma
// Gota de goma translúcida com açúcar cristal, olhinhos e um sorriso. Uma foto por cor
// e lado; o pulo é a posição da foto. Apoio: base da bala
export const gummy = {
  box: { left: -18, right: 18, top: 30, bottom: -6 },
  res: 3,
  elevation: 0.25,
  pose: (c) => `${GUMMY.colors.indexOf(gummyTone(c))}${c.dir < 0 ? 'L' : 'R'}`,
  poses() {
    const out = [];
    for (const f of ['R', 'L']) GUMMY.colors.forEach((col, i) => out.push({ key: `${i}${f}`, f, i }));
    return out;
  },
  build(kit) {
    const { THREE, mat, group, mesh, sphere } = kit;
    const root = group();
    const prof = [[0.01, 0], [12, 0], [13, 2], [12.4, 8], [10, 15], [6, 20], [0.01, 21.5]];
    const bodies = GUMMY.colors.map((col) => {
      const m = mat(col, 0.2, { transparent: true, opacity: 0.88, emissive: col, emissiveIntensity: 0.25 });
      const b = kit.lathe(prof, m, 36);
      root.add(b);
      return b;
    });
    // Açúcar cristal grudado na superfície
    const sugar = mat('#FFFFFF', 0.3);
    const rnd = rng(23);
    for (let i = 0; i < 70; i++) {
      const a = rnd() * TAU;
      const y = 1 + rnd() * 19;
      const r = y < 8 ? 12.6 : y < 15 ? 12.4 - (y - 8) * 0.34 : 10 - (y - 15) * 0.8;
      const c = mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), sugar, Math.cos(a) * r, y, Math.sin(a) * r);
      c.rotation.set(rnd() * 3, rnd() * 3, 0);
      root.add(c);
    }
    const face = group();
    root.add(face);
    for (const s of [-1, 1]) face.add(sphere(1.4, mat('#1A1010', 0.2), s * 3.2, 11, 11.2, 10));
    const smile = mesh(new THREE.TorusGeometry(2.2, 0.45, 6, 12, Math.PI * 0.8), mat('#1A1010', 0.3), 0, 8, 11.6);
    smile.rotation.z = Math.PI * 1.1;
    face.add(smile);
    return { root, bodies, face };
  },
  apply(rig, p) {
    rig.bodies.forEach((b, i) => (b.visible = i === p.i));
    rig.root.rotation.y = side(p.f) * 0.45;
  },
};
// Cor de cada bala (a mesma do desenho 2D)
function gummyTone(c) {
  return GUMMY.colors[Math.abs(Math.floor((c.ph || 0) * 7)) % GUMMY.colors.length];
}

// ---------------------------------------------------------------- Rosquinha
// No lugar do peixe. Massa dourada com a cobertura rosa escorrendo e o granulado
// colorido; o balanço é a rotação da foto. Apoio: centro
export const donut = {
  box: { left: -20, right: 20, top: 16, bottom: -10 },
  res: 3,
  elevation: 0.55,
  pose: () => 'd',
  poses: () => [{ key: 'd' }],
  build({ THREE, mat, group, mesh }) {
    const root = group();
    const dough = mesh(new THREE.TorusGeometry(9.5, 5, 18, 36), mat('#E0A060', 0.7), 0, 0, 0);
    dough.rotation.x = Math.PI / 2;
    root.add(dough);
    // Cobertura: metade de cima do toro, um pouco maior, com gotas escorrendo
    const icingGeo = new THREE.TorusGeometry(9.5, 5.4, 14, 36, TAU);
    const pos = icingGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      // Achata a parte de baixo para dentro do biscoito (só a de cima aparece)
      if (pos.getZ(i) < 0) pos.setZ(i, pos.getZ(i) * 0.15);
    }
    icingGeo.computeVertexNormals();
    const icing = mesh(icingGeo, mat('#FF8AC0', 0.3), 0, 0.6, 0);
    icing.rotation.x = -Math.PI / 2;
    root.add(icing);
    const rnd = rng(29);
    for (let i = 0; i < 26; i++) {
      const a = rnd() * TAU;
      const r = 9.5 + (rnd() - 0.5) * 6;
      const s = mesh(new THREE.CapsuleGeometry(0.45, 1.6, 3, 6), mat(SPRINKLES[i % SPRINKLES.length], 0.4), Math.cos(a) * r, 5.6, Math.sin(a) * r);
      s.rotation.set(Math.PI / 2, 0, rnd() * TAU);
      root.add(s);
    }
    return { root };
  },
  apply() {},
};

// ---------------------------------------------------------------- Biscoitos waffle
// Mesmas medidas do sprite 2D (cookieSprite): pés em y = 0, 26 abaixo do topo da foto,
// altura 62. Biscoitos waffle (quadriculados em relevo) boiando um atrás do outro
// (cada um com ~40 de comprimento); acesos, com o glacê rosa escorrendo pelas bordas e
// o granulado colorido por cima.
export const COOKIE_3D = { ...COOKIE, VARIANTS: 3 };
const cookies = new Map();
export function cookieSubject(w) {
  if (cookies.has(w)) return cookies.get(w);
  const S = {
    box: { left: -COOKIE.PAD, right: w + COOKIE.PAD, top: COOKIE.TOP, bottom: COOKIE.TOP - COOKIE.H },
    res: 2.2,
    elevation: 0.3,
    poses() {
      const out = [];
      for (let v = 0; v < COOKIE_3D.VARIANTS; v++) for (const on of [0, 1]) out.push({ key: `${v}${on}`, v, on });
      return out;
    },
    build(kit) {
      return buildCookies(kit, w);
    },
    apply(rig, p) {
      rig.variants.forEach((g, i) => (g.visible = i === p.v));
      for (const m of rig.icing) m.visible = !!p.on;
    },
  };
  cookies.set(w, S);
  return S;
}

// Quadriculado do waffle (topo), com relevo
function waffleTexture(THREE) {
  const t = canvasTex(THREE, 128, 128, (g, w, h) => {
    g.fillStyle = '#F2C27A';
    g.fillRect(0, 0, w, h);
    const n = 4;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const x = (i * w) / n;
        const y = (j * h) / n;
        const grd = g.createLinearGradient(x, y, x + w / n, y + h / n);
        grd.addColorStop(0, '#B8742E');
        grd.addColorStop(1, '#D8964A');
        g.fillStyle = grd;
        g.fillRect(x + 6, y + 6, w / n - 12, h / n - 12);
      }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function buildCookies(kit, w) {
  const { THREE, group, mat, mesh, sphere } = kit;
  const root = group();
  const variants = [];
  const icingMeshes = [];
  const n = Math.max(1, Math.round(w / 40));
  const bw = w / n;
  const waffle = waffleTexture(THREE);
  const side = mat('#D09050', 0.75);
  const pink = mat('#FF9ACB', 0.35);
  for (let v = 0; v < COOKIE_3D.VARIANTS; v++) {
    const g = group();
    const rnd = rng((v + 3) * 977);
    for (let i = 0; i < n; i++) {
      const len = bw - 3;
      const cx = i * bw + bw / 2;
      const top = waffle.clone();
      top.needsUpdate = true;
      top.repeat.set(1 / 18, 1 / 18);
      const topM = new THREE.MeshStandardMaterial({ map: top, bumpMap: top, bumpScale: 1.6, roughness: 0.7 });
      // Biscoito: placa grossa de cantos arredondados e borda fofa (topo quadriculado,
      // lados lisos), um pouco torta
      const shape = new THREE.Shape();
      const hx = len / 2 - 1.5;
      const hz = 10.5;
      const rr = 4;
      shape.moveTo(-hx + rr, -hz);
      shape.lineTo(hx - rr, -hz);
      shape.quadraticCurveTo(hx, -hz, hx, -hz + rr);
      shape.lineTo(hx, hz - rr);
      shape.quadraticCurveTo(hx, hz, hx - rr, hz);
      shape.lineTo(-hx + rr, hz);
      shape.quadraticCurveTo(-hx, hz, -hx, hz - rr);
      shape.lineTo(-hx, -hz + rr);
      shape.quadraticCurveTo(-hx, -hz, -hx + rr, -hz);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 9, bevelEnabled: true, bevelThickness: 1.8, bevelSize: 1.6, bevelSegments: 3, curveSegments: 6 });
      // A placa extrudada em z vira de pé em y (topo em y ≈ 1,5)
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, -8.7, 0);
      const b = new THREE.Mesh(geo, [topM, side]);
      b.position.set(cx, 0, 0);
      b.rotation.set((rnd() - 0.5) * 0.08, (rnd() - 0.5) * 0.12, (rnd() - 0.5) * 0.05);
      b.castShadow = b.receiveShadow = true;
      g.add(b);
      // Glacê rosa por cima, escorrendo pela borda da frente, e o granulado
      const ic = group(cx, 1.4, 0);
      ic.rotation.copy(b.rotation);
      ic.add(mesh(new THREE.BoxGeometry(len - 5, 1.6, 19), pink, 0, 1.2, 0));
      for (let k = 0; k < 4; k++) {
        // Gota escorrendo da beira do glacê pela frente do biscoito (presa na cobertura)
        const d = sphere(1.7, pink, -len / 2 + 4 + k * ((len - 8) / 3), -0.4 - (k % 2) * 1.2, 11.2, 8);
        d.scale.set(1, 2.2 + (k % 2) * 0.5, 0.8);
        ic.add(d);
      }
      for (let k = 0; k < 10; k++) {
        const s = mesh(new THREE.CapsuleGeometry(0.4, 1.4, 3, 6), mat(SPRINKLES[(k + i + v) % SPRINKLES.length], 0.4), -len / 2 + 3 + rnd() * (len - 6), 2.2, -7 + rnd() * 14);
        s.rotation.set(Math.PI / 2, 0, rnd() * TAU);
        ic.add(s);
      }
      g.add(ic);
      icingMeshes.push(ic);
    }
    root.add(g);
    variants.push(g);
  }
  return { root, variants, icing: icingMeshes };
}

// ---------------------------------------------------------------- Casa de biscoito
// Mesmo lugar, mesmas 16 peças e mesma porta da casa 2D (src/candy.js): 6 painéis de
// biscoito de gengibre (os dos cantos com a parede do lado, os de cima com a empena),
// as 2 águas do telhado de biscoito em escamas, o glacê escorrendo pela beira com as
// balinhas de goma, 2 janelas de bala transparente (acesas quando há alguém dentro),
// a janela redonda de hortelã, a chaminé de bombom e as 2 bengalas doces nos cantos.
// A porta é o modelo à parte (src/m3d/doors.js). Frente das paredes em z = 0.
// Fotos: "n1".."n15", "lit" (pronta com as janelas acesas) e "b0".."b14".
const HOUSE_D = 64;

// Telhado de biscoito em escamas (meias-luas com a borda escura), com relevo
function roofMaterial(THREE) {
  const t = canvasTex(THREE, 128, 128, (g, w, h) => {
    g.fillStyle = '#9A5A28';
    g.fillRect(0, 0, w, h);
    const r = w / 4;
    for (let row = 0; row < 5; row++) {
      const off = (row % 2) * r;
      for (let c = -1; c < 3; c++) {
        const cx = c * 2 * r + r + off;
        const cy = row * (h / 4) - 4;
        const grd = g.createRadialGradient(cx, cy, 2, cx, cy, r);
        grd.addColorStop(0, '#D89050');
        grd.addColorStop(0.85, '#B8703A');
        grd.addColorStop(1, '#6A3A16');
        g.fillStyle = grd;
        g.beginPath();
        g.arc(cx, cy, r, 0, Math.PI);
        g.fill();
      }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 5);
  return new THREE.MeshStandardMaterial({ map: t, bumpMap: t, bumpScale: 1.2, roughness: 0.8 });
}

function peppermintTexture(THREE) {
  return canvasTex(THREE, 128, 128, (g, w, h) => {
    g.fillStyle = '#FFFFFF';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#E0283A';
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.moveTo(w / 2, h / 2);
      g.arc(w / 2, h / 2, w / 2, (i / 6) * TAU, (i / 6) * TAU + 0.5);
      g.fill();
    }
  });
}

function caneTexture(THREE) {
  // Listras vermelhas em diagonal ao longo do tubo (u = ao longo, v = em volta)
  const t = canvasTex(THREE, 64, 64, (g, w, h) => {
    g.fillStyle = '#FFFFFF';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#E0283A';
    for (const x0 of [-w, 0, w]) {
      g.beginPath();
      g.moveTo(x0, 0);
      g.lineTo(x0 + w * 0.45, 0);
      g.lineTo(x0 + w * 0.45 + w, h);
      g.lineTo(x0 + w, h);
      g.closePath();
      g.fill();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Bengala doce (tubo listrado) com o gancho: base em 0, altura h, gancho para o lado s
function candyCane(kit, h, r, s) {
  const { THREE, mesh } = kit;
  const pts = [];
  for (let i = 0; i <= 8; i++) pts.push(new THREE.Vector3(0, (i / 8) * h, 0));
  const R = r * 2.6;
  for (let i = 1; i <= 10; i++) {
    const a = Math.PI - (i / 10) * Math.PI;
    pts.push(new THREE.Vector3(s * (R + Math.cos(a) * R), h + Math.sin(a) * R, 0));
  }
  pts.push(new THREE.Vector3(s * R * 2, h - R * 0.5, 0));
  const curve = new THREE.CatmullRomCurve3(pts);
  const tex = caneTexture(THREE);
  tex.repeat.set((h + R * 4) / 16, 1);
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3 });
  const g = new THREE.Group();
  g.add(mesh(new THREE.TubeGeometry(curve, 80, r, 14, false), m));
  // Pontas arredondadas (o tubo é aberto)
  for (const p of [pts[0], pts[pts.length - 1]]) g.add(kit.sphere(r, kit.mat('#FFFFFF', 0.3), p.x, p.y, p.z, 12));
  return g;
}

// Balinha de goma (gota com açúcar)
function gumdrop(kit, r, color) {
  const prof = [[0.01, 0], [r, 0], [r * 1.05, r * 0.2], [r * 0.95, r * 0.7], [r * 0.6, r * 1.2], [0.01, r * 1.35]];
  return kit.lathe(prof, kit.mat(color, 0.25, { emissive: color, emissiveIntensity: 0.15 }), 24);
}

export const gingerHouse = {
  box: { left: -140, right: 140, top: 200, bottom: -20 },
  res: 1.5,
  elevation: 0.2,
  poses() {
    const out = [];
    for (let n = 1; n < GINGER_PIECES.length; n++) out.push({ key: `n${n}`, upto: n });
    out.push({ key: 'lit', upto: GINGER_PIECES.length - 1, lit: true });
    for (let i = 0; i < GINGER_PIECES.length - 1; i++) out.push({ key: `b${i}`, only: i });
    return out;
  },
  build(kit) {
    const { THREE, mat, group, mesh, sphere } = kit;
    const { HW, WALL_H, ROW_H, ROOF_TOP, ROOF_OVER, WINDOWS, PEPPERMINT, CHIMNEY, CANES } = GINGER_HOUSE;
    const top = -ROOF_TOP;
    const panels = [0, 1, 2].map((k) => doughMaterial(THREE, 31 + k * 5, 1 / 50, '#C47C3E'));
    const roofM = roofMaterial(THREE);
    const icing = mat('#FFFFFF', 0.45);
    const third = (HW * 2) / 3;
    const T = 10;
    const root = group();
    const pieces = [];
    let winOn = null;
    let winOff = null;
    const panes = [];
    const roofY = (x) => WALL_H + ((top - WALL_H) * (HW - Math.abs(x))) / HW;
    for (const p of GINGER_PIECES.slice(0, -1)) {
      const g = group();
      if (p.kind === 'wall') {
        const x0 = -HW + third * p.col;
        const y0 = p.row * ROW_H;
        const panel = mesh(new THREE.BoxGeometry(third - 0.8, ROW_H - 0.8, T), panels[(p.row + p.col) % 3], x0 + third / 2, y0 + ROW_H / 2, -T / 2);
        g.add(panel);
        // Fio de glacê na junta de baixo de cada painel
        g.add(icingTube(kit, Array.from({ length: 9 }, (_, i) => [x0 + 2 + (i / 8) * (third - 4), y0 + 1.5 + (i % 2) * 1.2, 0.6]), 0.9, icing));
        // Paredes do lado (os painéis dos cantos) e de trás
        if (p.col !== 1) {
          const sx = p.col === 0 ? -HW + T / 2 : HW - T / 2;
          g.add(mesh(new THREE.BoxGeometry(T, ROW_H - 0.8, HOUSE_D - T), panels[(p.row + 1) % 3], sx, y0 + ROW_H / 2, -T - (HOUSE_D - T) / 2));
        }
        g.add(mesh(new THREE.BoxGeometry(third - 0.8, ROW_H - 0.8, T), panels[p.col % 3], x0 + third / 2, y0 + ROW_H / 2, -HOUSE_D + T / 2));
        if (p.row === 1) {
          // Fatia da empena (frente e trás) acima deste painel
          const xa = x0;
          const xb = x0 + third;
          const poly = [[xa, WALL_H], [xa, roofY(xa)]];
          if (xa < 0 && xb > 0) poly.push([0, top]);
          poly.push([xb, roofY(xb)], [xb, WALL_H]);
          const shape = new THREE.Shape();
          poly.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
          shape.closePath();
          const geo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false });
          for (const z of [-T, -HOUSE_D]) g.add(mesh(geo, panels[2], 0, 0, z));
        }
      } else if (p.kind === 'roof') {
        // Uma água do telhado: placa de biscoito em escamas, da cumeeira até o beiral
        const x1 = p.side * (HW + ROOF_OVER);
        const y1 = WALL_H - 6;
        const len = Math.hypot(x1, top - y1) + 6;
        const slab = mesh(new THREE.BoxGeometry(len, 7, HOUSE_D + 18), roofM, x1 / 2, (top + y1) / 2 + 3, -HOUSE_D / 2);
        slab.rotation.z = Math.atan2(top - y1, -x1);
        if (p.side < 0) slab.rotation.z += Math.PI;
        g.add(slab);
      } else if (p.kind === 'icing') {
        // Glacê escorrendo pela beira do telhado (frente) e a cumeeira, com as balinhas
        for (const sd of [-1, 1]) {
          const x1 = sd * (HW + ROOF_OVER + 2);
          const y1 = WALL_H - 3;
          const pts = [];
          for (let i = 0; i <= 18; i++) {
            const f = i / 18;
            pts.push([x1 * f, top + 6 + (y1 - top) * f + (i % 2) * 1.6, 9]);
          }
          g.add(icingTube(kit, pts, 2.6, icing));
          for (let i = 1; i < 9; i++) {
            const f = i / 9;
            const d = sphere(2.2, icing, x1 * f, top + 2 + (y1 - top) * f - (i % 2 ? 4 : 2), 9.4, 10);
            d.scale.set(0.9, 1.7, 0.9);
            g.add(d);
          }
          GUMDROP_COLORS.forEach((col, i) => {
            const f = 0.16 + i * 0.17;
            const gd = gumdrop(kit, 3.2, col);
            gd.position.set(x1 * f, top + 9 + (y1 - top) * f, 10);
            gd.rotation.z = -sd * 0.6;
            g.add(gd);
          });
        }
        g.add(icingTube(kit, Array.from({ length: 12 }, (_, i) => [0, top + 8 + (i % 2), 10 - (i / 11) * (HOUSE_D + 20)]), 3, icing));
      } else if (p.kind === 'window') {
        const w = WINDOWS[p.side < 0 ? 0 : 1];
        const W2 = group(w.x, -w.y, 0);
        g.add(W2);
        winOff = winOff || mat('#7AD0E8', 0.1, { transparent: true, opacity: 0.85, emissive: '#2A6A80', emissiveIntensity: 0.2 });
        winOn = winOn || mat('#FFD080', 0.2, { emissive: '#FFA040', emissiveIntensity: 1.1 });
        const pane = mesh(new THREE.BoxGeometry(24, 24, 1.4), winOff, 0, 0, 0.4);
        W2.add(pane);
        panes.push(pane);
        // Caixilho de glacê em cruz e a moldura
        const frame = [];
        for (const [a, b] of [[[-12, -12], [12, -12]], [[12, -12], [12, 12]], [[12, 12], [-12, 12]], [[-12, 12], [-12, -12]], [[0, -12], [0, 12]], [[-12, 0], [12, 0]]]) {
          W2.add(kit.bone(1.4, [a[0], a[1], 1.6], [b[0], b[1], 1.6], icing));
          frame.push(a);
        }
      } else if (p.kind === 'peppermint') {
        const disc = mesh(new THREE.CylinderGeometry(12, 12, 3, 32), [mat('#FFFFFF', 0.3), new THREE.MeshStandardMaterial({ map: peppermintTexture(THREE), roughness: 0.25 }), mat('#FFFFFF', 0.3)], PEPPERMINT.x, -PEPPERMINT.y, 1.4);
        disc.rotation.x = Math.PI / 2;
        g.add(disc);
      } else if (p.kind === 'chimney') {
        // Bombom de chocolate: torre com a tampa redonda e o confeito vermelho
        const ch = mat('#5A2E16', 0.3);
        const cx = CHIMNEY.x;
        const h = -CHIMNEY.top + CHIMNEY.base;
        const z = -HOUSE_D * 0.45;
        g.add(mesh(new THREE.CylinderGeometry(CHIMNEY.w / 2, CHIMNEY.w / 2 + 1, h + 30, 20), ch, cx, -CHIMNEY.base + (h - 30) / 2 + 10, z));
        const lid = sphere(CHIMNEY.w / 2 + 3, ch, cx, -CHIMNEY.top + 6, z, 18);
        lid.scale.set(1, 0.45, 1);
        g.add(lid);
        g.add(icingTube(kit, Array.from({ length: 25 }, (_, i) => {
          const a = (i / 24) * TAU;
          return [cx + Math.cos(a) * (CHIMNEY.w / 2 + 0.8), -CHIMNEY.top - 6 + (i % 2) * 1.4, z + Math.sin(a) * (CHIMNEY.w / 2 + 0.8)];
        }), 0.9, mat('#E8C49A', 0.4)));
        g.add(sphere(3.4, mat('#FF4A6A', 0.25), cx, -CHIMNEY.top + 10, z, 12));
      } else if (p.kind === 'cane') {
        const cn = candyCane(kit, WALL_H + 4, 3.4, -p.side);
        cn.position.set(CANES[p.side < 0 ? 0 : 1], 0, 4);
        g.add(cn);
      }
      root.add(g);
      pieces.push(g);
    }
    return { root, pieces, panes, winOn, winOff };
  },
  apply(rig, p) {
    rig.pieces.forEach((g, i) => (g.visible = p.only != null ? i === p.only : i < p.upto));
    for (const pane of rig.panes) pane.material = p.lit ? rig.winOn : rig.winOff;
  },
};

// ---------------------------------------------------------------- Enfeites da costa
// Pirulito gigante em espiral fincado no glacê (base em 0, 0)
export const lollipop = {
  box: { left: -34, right: 34, top: 124, bottom: -10 },
  res: 2.4,
  elevation: 0.15,
  poses: () => [{ key: 'l' }],
  build({ THREE, mat, group, mesh }) {
    const root = group();
    root.add(mesh(new THREE.CylinderGeometry(2.4, 2.4, 72, 12), mat('#F6EEE0', 0.6), 0, 36, 0));
    const swirl = canvasTex(THREE, 256, 256, (g, w, h) => {
      g.fillStyle = '#FFFFFF';
      g.fillRect(0, 0, w, h);
      g.lineWidth = 22;
      g.lineCap = 'round';
      ['#FF4A8A', '#5AC8FA', '#FFD23A'].forEach((col, k) => {
        g.strokeStyle = col;
        g.beginPath();
        for (let a = 0; a < TAU * 2.2; a += 0.1) {
          const r = (a / (TAU * 2.2)) * 120;
          const x = w / 2 + Math.cos(a + k * 2.1) * r;
          const y = h / 2 + Math.sin(a + k * 2.1) * r;
          if (a === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
      });
    });
    const faceM = new THREE.MeshStandardMaterial({ map: swirl, roughness: 0.2 });
    const disc = mesh(new THREE.CylinderGeometry(26, 26, 7, 48), [mat('#FFE0F0', 0.25), faceM, faceM], 0, 92, 0);
    disc.rotation.x = Math.PI / 2;
    root.add(disc);
    // Laço de fita no palito
    const bow = mat('#FF4A8A', 0.6);
    for (const s of [-1, 1]) {
      const b = kit_sphere(THREE, 4, bow, s * 4.5, 62, 1.5);
      b.scale.set(1.3, 0.8, 0.5);
      root.add(b);
    }
    return { root };
  },
  apply() {},
};
function kit_sphere(THREE, r, m, x, y, z) {
  const o = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m);
  o.position.set(x, y, z);
  o.castShadow = true;
  return o;
}

// Bengala doce listrada fincada no glacê
export const cane = {
  box: { left: -20, right: 44, top: 100, bottom: -10 },
  res: 2.4,
  elevation: 0.15,
  poses: () => [{ key: 'c' }],
  build(kit) {
    const root = kit.group();
    root.add(candyCane(kit, 70, 5, 1));
    return { root };
  },
  apply() {},
};

// Montinho de balas de goma com açúcar
export const gumdrops = {
  box: { left: -36, right: 36, top: 40, bottom: -10 },
  res: 2.4,
  elevation: 0.25,
  poses: () => [{ key: 'g' }],
  build(kit) {
    const root = kit.group();
    const spots = [[-20, 0, 2, 0], [0, 0, 4, 1], [20, 0, 2, 2], [-10, 9, -6, 3], [10, 9, -6, 4]];
    for (const [x, y, z, ci] of spots) {
      const g = gumdrop(kit, 10, GUMDROP_COLORS[ci]);
      g.position.set(x, y > 0 ? 3 : 0, z);
      root.add(g);
    }
    return { root };
  },
  apply() {},
};
