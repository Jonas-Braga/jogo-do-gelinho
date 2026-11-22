// Halloween em 3D (fase 25): lobisomem de pé com pernas de lobo (coxa, joelho,
// jarrete alto e pata), braços com cotovelo e garras, focinho com mandíbula que abre e
// o uivo para a lua; fantasminha, aranha de oito patas articuladas, olho boiando,
// bala embrulhada, abóboras boiando no lugar das placas, casa assombrada montada
// peça por peça, árvore seca e as abóboras de rosto aceso da costa.
// Mesmos pontos de apoio do desenho 2D (src/halloween.js); y para cima.
import { TAU } from './kit.js';
import { box as bearBox } from './bear.js';
import { HAUNTED, HAUNTED_PIECES } from '../halloween.js';

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

// Membro reposicionável: cilindro afunilado de raio r0 (em a) a r1 (em b)
function rod(THREE, r0, r1, m) {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 1, 12), m);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

// Cinemática inversa de dois ossos no plano (z, y): devolve o joelho. bend = +1 dobra
// o joelho para a frente (+z), −1 para trás
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

// ---------------------------------------------------------------- Lobisomem
// No lugar do urso. Fotos: walk{quadro}{lado}{boca} (anda; perseguindo, corre com os
// braços esticados e a boca abrindo) e howl{lado} (parado, uivando para a lua)
export const WOLF_FRAMES = 12;
// Tamanho do lobisomem (o 2D é grandalhão; modelado em 1 ele ficava pequeno na fase):
// altura × WOLF_SCALE e o corpo ainda mais largo e fundo (WOLF_BULK), encorpado como o 2D
export const WOLF_SCALE = 1.25;
export const WOLF_BULK = 1.15;
export const werewolf = {
  box: { left: -120, right: 120, top: 200, bottom: bearBox.bottom },
  res: 2,
  pose(b, t) {
    const d = b.dir < 0 ? 'L' : 'R';
    const howl = b.chasing ? 0 : Math.max(0, Math.sin(t * 0.7) - 0.75) * 4;
    if (howl > 0.35) return `howl${d}`;
    const f = frameOf(b.walk * (b.chasing ? 5 : 3.5), WOLF_FRAMES);
    const m = b.chasing ? (Math.abs(Math.sin(t * 12)) > 0.5 ? 2 : 1) : 0;
    return `walk${f}${d}${m}`;
  },
  poses() {
    const out = [];
    for (const f of ['R', 'L']) {
      for (let i = 0; i < WOLF_FRAMES; i++) {
        for (let m = 0; m < 3; m++) out.push({ key: `walk${i}${f}${m}`, f, u: (i + 0.5) / WOLF_FRAMES, run: m > 0, mouth: [0, 0.35, 0.7][m] });
      }
      out.push({ key: `howl${f}`, f, u: 0.25, howl: true, mouth: 0.75 });
    }
    return out;
  },
  build(kit) {
    const { THREE, mat, group, sphere, mesh, sweep, furMaterial } = kit;
    const furOpts = { base: '#7A7490', light: '#ABA4C4', dark: '#45405A', seed: 5, len: 11, strands: 1000 };
    const furM = furMaterial({ ...furOpts, repeat: [3, 2] });
    const furDark = furMaterial({ ...furOpts, base: '#5E5874', seed: 9, repeat: [3, 2] });
    const furLimb = furMaterial({ ...furOpts, repeat: [2, 2] });
    const furLimbDark = furMaterial({ ...furOpts, base: '#5E5874', seed: 9, repeat: [2, 2] });
    const furHead = furMaterial({ ...furOpts, len: 7, repeat: [2, 1.5] });
    const belly = furMaterial({ base: '#A69EB4', light: '#C8C0D6', dark: '#7E7690', seed: 13, len: 8, repeat: [1, 1] });
    const pants = mat('#6A3A8C', 0.85);
    const pantsDark = mat('#3E1E58', 0.85);
    const claw = mat('#F1EADA', 0.35);
    const black = mat('#1A1622', 0.4);
    const mouthM = mat('#5A1A2A', 0.7);
    const tooth = mat('#FFFFFF', 0.3);
    const eyeM = mat('#FFE14A', 0.2, { emissive: '#FFD020', emissiveIntensity: 1.4 });
    const root = group();
    root.rotation.order = 'YXZ';
    root.scale.set(WOLF_SCALE * WOLF_BULK, WOLF_SCALE, WOLF_SCALE * WOLF_BULK);
    const body = group();
    root.add(body);
    // Tronco em V (cintura fina, peito e ombros largos), curvado para a frente
    // (corcunda); a coluna sobe e o "para cima" da seção aponta para a frente (+z)
    const torso = group(0, 64, -2);
    body.add(torso);
    torso.add(sweep([
      { p: [0, -16, -2], w: 12.5, h: 10, hb: 11 },
      { p: [0, -2, 0], w: 13.5, h: 11, hb: 11 },
      { p: [0, 12, 1], w: 17.5, h: 13, hb: 13 },
      { p: [0, 24, 0], w: 19, h: 11, hb: 14 },
      { p: [0, 33, 5], w: 10, h: 9, hb: 9 },
    ], furM, { up: [0, 0, 1], radial: 24, cap: 0.5 }));
    // Peito e barriga claros
    const tummy = sphere(12, belly, 0, 6, 7.5, 22);
    tummy.scale.set(0.95, 1.5, 0.55);
    torso.add(tummy);
    // Tufos nas costas (corcunda) e a juba em volta do pescoço
    for (let i = 0; i < 9; i++) {
      const a = -0.3 + i * 0.22;
      const tf = mesh(new THREE.ConeGeometry(3, 10, 6), furDark, 0, 12 + Math.sin(a) * 20, Math.cos(a) * -13);
      tf.rotation.x = -Math.PI / 2 - a + 0.5;
      torso.add(tf);
    }
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      const tf = mesh(new THREE.ConeGeometry(3, 10, 6), i % 2 ? furM : furDark, Math.cos(a) * 11, 30, 3 + Math.sin(a) * 9);
      tf.rotation.set(Math.sin(a) * 1.25, 0, -Math.cos(a) * 1.25);
      torso.add(tf);
    }
    // Calça roxa rasgada no quadril (com franjas)
    body.add(sweep([
      { p: [0, 57, -3], w: 13.5, h: 11, hb: 12 },
      { p: [0, 48, -4], w: 15.5, h: 12, hb: 13.5 },
      { p: [0, 41, -4], w: 15, h: 11, hb: 12.5 },
    ], pants, { up: [0, 0, 1], radial: 22, cap: 0.4 }));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const fr = mesh(new THREE.ConeGeometry(2.6, 7, 4), i % 2 ? pants : pantsDark, Math.cos(a) * 14.5, 38, -4 + Math.sin(a) * 12);
      fr.rotation.x = Math.PI;
      body.add(fr);
    }
    // Rabo peludo (refeito a cada pose: sai de trás do quadril, desce e balança)
    const tail = sweep(wolfTail(0), furDark, { radial: 14, cap: 0.7 });
    body.add(tail);
    // Pescoço e cabeça: crânio largo e focinho comprido numa peça só
    const neck = group(0, 34, 12);
    torso.add(neck);
    neck.add(sweep([
      { p: [0, -6, -8], w: 10, h: 9 },
      { p: [0, 1, -1], w: 8.5, h: 8 },
      { p: [0, 6, 5], w: 8, h: 8 },
    ], furM, { radial: 18, cap: 0.6 }));
    const head = group(0, 6, 6);
    neck.add(head);
    head.add(sweep([
      { p: [0, 0, -7], w: 8, h: 8 },
      { p: [0, 1.5, 0], w: 11, h: 10, hb: 9 },
      { p: [0, 0.5, 7], w: 8.6, h: 7, hb: 7 },
      { p: [0, -1.4, 14], w: 5.6, h: 4.8, hb: 5 },
      { p: [0, -2, 20], w: 4.4, h: 3.8, hb: 4 },
    ], furHead, { radial: 22, cap: 0.5 }));
    const nose = sphere(2.8, black, 0, -0.6, 21.5, 12);
    nose.scale.set(1.2, 0.85, 0.9);
    head.add(nose);
    for (const s of [-1, 1]) {
      head.add(sphere(2.2, eyeM, s * 5.6, 3.6, 7.4, 12));
      head.add(sphere(0.9, black, s * 6.3, 3.6, 8.9, 8));
      const brow = mesh(new THREE.CapsuleGeometry(1.1, 5, 4, 8), furDark, s * 5.4, 6.8, 7.6);
      brow.rotation.z = Math.PI / 2 + s * 0.45;
      head.add(brow);
      // Orelhas pontudas com o miolo escuro
      const ear = mesh(new THREE.ConeGeometry(3.8, 11, 4), furDark, s * 7, 12, -3);
      ear.rotation.set(-0.3, Math.PI / 4, -s * 0.35);
      head.add(ear);
    }
    // Dentes de cima e a mandíbula (gira para baixo)
    for (const x of [-3, -1, 1, 3]) {
      const tb = mesh(new THREE.ConeGeometry(0.7, Math.abs(x) > 2 ? 3.6 : 2.4, 6), tooth, x * 0.9, -5.4, 16 + (Math.abs(x) < 2 ? 1 : 0));
      tb.rotation.x = Math.PI;
      head.add(tb);
    }
    const jaw = group(0, -4.5, 4);
    head.add(jaw);
    jaw.add(sweep([
      { p: [0, -1, -1], w: 6, h: 3.2 },
      { p: [0, -1.8, 8], w: 4.8, h: 2.8 },
      { p: [0, -1.6, 15], w: 3.6, h: 2.2 },
    ], furHead, { radial: 16, cap: 0.6 }));
    const inside = sphere(4, mouthM, 0, 0.6, 8, 12);
    inside.scale.set(0.8, 0.4, 1.5);
    jaw.add(inside);
    for (const x of [-2.4, 2.4]) {
      const tl = mesh(new THREE.ConeGeometry(0.7, 3, 6), tooth, x, 1, 13);
      jaw.add(tl);
    }
    // Braços e pernas: peças contínuas refeitas a cada pose, mãos e patas com garras
    const arms = [-1, 1].map((s) => {
      const a = {
        s, limb: sweep(wolfArm([s * 15, 90, 4], [s * 18, 75, 4], [s * 18, 60, 8]), s < 0 ? furLimb : furLimbDark, { radial: 16, cap: 0.6 }),
        hand: sphere(4.6, s < 0 ? furLimb : furLimbDark, 0, 0, 0, 14),
        claws: [0, 1, 2].map(() => {
          const c = mesh(new THREE.ConeGeometry(0.9, 5, 6), claw, 0, 0, 0);
          root.add(c);
          return c;
        }),
      };
      a.hand.scale.set(0.9, 1.1, 1);
      root.add(a.limb, a.hand);
      return a;
    });
    const legs = [-1, 1].map((s) => {
      const l = {
        s,
        pantLeg: sweep(pantSpine([s * 8, 46, -4], [s * 9, 30, 4]), s < 0 ? pants : pantsDark, { radial: 16, cap: 0.4 }),
        lower: sweep(wolfShin([s * 9, 30, 4], [s * 9, 14, -2], [s * 9, 2, 6]), s < 0 ? furLimb : furLimbDark, { radial: 14, cap: 0.6 }),
        toes: sphere(4.4, s < 0 ? furLimb : furLimbDark, 0, 0, 0, 14),
        claws: [0, 1, 2].map(() => {
          const c = mesh(new THREE.ConeGeometry(0.8, 4, 6), claw, 0, 0, 0);
          root.add(c);
          return c;
        }),
      };
      root.add(l.pantLeg, l.lower, l.toes);
      return l;
    });
    return { root, body, torso, neck, head, jaw, tail, arms, legs, kit, THREE };
  },
  apply(rig, p) {
    const { THREE, kit } = rig;
    // De perfil, um pouco virado para a câmera (frente = +z)
    rig.root.rotation.y = side(p.f) * (Math.PI / 2 - 0.42);
    const ph = p.u * TAU;
    const stride = p.run ? 13 : 9;
    const bob = p.howl ? 0 : Math.abs(Math.cos(ph)) * (p.run ? 3 : 2);
    rig.body.position.y = bob;
    // Corcunda: inclinado para a frente (mais ainda correndo); no uivo, ereto e cabeça para cima
    rig.torso.rotation.x = p.howl ? 0.05 : p.run ? 0.45 : 0.3;
    rig.neck.rotation.x = p.howl ? -0.55 : p.run ? -0.35 : -0.2;
    rig.head.rotation.x = p.howl ? -0.75 : 0;
    rig.jaw.rotation.x = p.mouth * 0.75;
    rig.torso.updateMatrixWorld(true);
    // Pernas de lobo: quadril → joelho (para a frente) → jarrete (alto, para trás) → pata
    for (const l of rig.legs) {
      const lph = ph + (l.s > 0 ? Math.PI : 0);
      const fz = p.howl ? l.s * 3 : Math.sin(lph) * stride;
      const lift = p.howl ? 0 : Math.max(0, Math.cos(lph)) * (p.run ? 9 : 6);
      const hip = [l.s * 8, 46 + bob, -4];
      const toe = [l.s * 9, 2 + lift, fz + 6];
      const hock = [toe[0], toe[1] + 12, toe[2] - 8];
      const knee = ik2(hip, hock, 21, 19, -1);
      knee[0] = l.s * 9;
      kit.resweep(l.pantLeg, pantSpine(hip, knee), { radial: 16, cap: 0.4 });
      kit.resweep(l.lower, wolfShin(knee, hock, toe), { radial: 14, cap: 0.6 });
      l.toes.position.set(toe[0], toe[1] - 0.5, toe[2] + 1.5);
      l.toes.scale.set(1, 0.6, 1.3);
      l.claws.forEach((c, i) => {
        c.position.set(toe[0] + (i - 1) * 2.4, toe[1] - 1.5, toe[2] + 6.5);
        c.rotation.x = Math.PI / 2;
      });
    }
    // Braços: balançam ao contrário das pernas; correndo, esticados para a frente com as
    // garras; uivando, caídos ao lado do corpo
    const sh = new THREE.Vector3();
    for (const a of rig.arms) {
      const aph = ph + (a.s > 0 ? 0 : Math.PI);
      const swing = Math.sin(aph);
      sh.set(a.s * 15, 27, 2).applyMatrix4(rig.torso.matrix);
      const S = [sh.x, sh.y + bob, sh.z];
      let E;
      let H;
      if (p.howl) {
        E = [S[0] + a.s * 4, S[1] - 18, S[2] - 4];
        H = [S[0] + a.s * 5, S[1] - 34, S[2] - 2];
      } else if (p.run) {
        E = [S[0] + a.s * 3, S[1] - 6 + swing * 3, S[2] + 16];
        H = [S[0] + a.s * 2, S[1] - 4 + swing * 5, S[2] + 32];
      } else {
        E = [S[0] + a.s * 4, S[1] - 17, S[2] + swing * 9];
        H = [S[0] + a.s * 4, S[1] - 31, S[2] + swing * 15 + 6];
      }
      kit.resweep(a.limb, wolfArm(S, E, H), { radial: 16, cap: 0.6 });
      a.hand.position.set(...H);
      const dir = new THREE.Vector3(H[0] - E[0], H[1] - E[1], H[2] - E[2]).normalize();
      a.claws.forEach((c, i) => {
        const off = (i - 1) * 2.2;
        c.position.set(H[0] + dir.x * 5 + off, H[1] + dir.y * 5, H[2] + dir.z * 5);
        c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      });
    }
    // Rabo: sai de trás do quadril, desce e balança
    kit.resweep(rig.tail, wolfTail(ph), { radial: 14, cap: 0.7 });
  },
};

const lerp3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
// Braço do lobisomem: ombro musculoso (começa dentro do tronco), cotovelo, antebraço
export function wolfArm(S, E, H) {
  return [
    { p: lerp3(E, S, 1.25), w: 6.5, h: 7.5 },
    { p: S, w: 6.6, h: 7.2 },
    { p: lerp3(S, E, 0.5), w: 5.4, h: 5.8 },
    { p: E, w: 4.6, h: 4.8 },
    { p: lerp3(E, H, 0.45), w: 4.6, h: 5 },
    { p: H, w: 3.8, h: 4 },
  ];
}
// Perna da calça, do quadril a um pouco abaixo do joelho (barra larga)
export function pantSpine(hip, knee) {
  return [
    { p: [hip[0] * 0.6, hip[1] + 6, hip[2]], w: 8.5, h: 9 },
    { p: hip, w: 8.6, h: 9 },
    { p: lerp3(hip, knee, 0.6), w: 7.4, h: 7.6 },
    { p: lerp3(hip, knee, 1.12), w: 6.6, h: 6.8 },
  ];
}
// Canela de lobo: joelho → jarrete alto → pata
export function wolfShin(knee, hock, toe) {
  return [
    { p: knee, w: 4.8, h: 5 },
    { p: lerp3(knee, hock, 0.5), w: 4.2, h: 4.4 },
    { p: hock, w: 3.6, h: 3.8 },
    { p: lerp3(hock, toe, 0.85), w: 3.2, h: 3.2 },
  ];
}
// Rabo: grosso e peludo no meio, afina na ponta; balança de lado com o passo
export function wolfTail(ph) {
  return [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const k = i / 6;
    const r = [5, 6.5, 7.2, 7, 6.2, 4.8, 2.6][i];
    return { p: [Math.sin(ph + i * 0.5) * 3 * k, 46 - i * 2.6 + Math.sin(k * 2) * 4, -14 - i * 4.2], w: r * 0.9, h: r * 0.85 };
  });
}

// ---------------------------------------------------------------- Fantasminha
// Apoio: centro do corpo (c.x, by). Lençol translúcido com a barra ondulando, dois
// bracinhos, olhos e a boca de "buu" que abre e fecha; o brilho em volta é 2D
const GHOST_FRAMES = 8;
export const ghost = {
  box: { left: -32, right: 32, top: 34, bottom: -24 },
  res: 2.8,
  elevation: 0.2,
  pose: (c, t) => `${frameOf(t * 8 + c.ph, GHOST_FRAMES)}${c.dir < 0 ? 'L' : 'R'}`,
  poses() {
    const out = [];
    for (const f of ['R', 'L']) for (let i = 0; i < GHOST_FRAMES; i++) out.push({ key: `${i}${f}`, f, ph: ((i + 0.5) / GHOST_FRAMES) * TAU });
    return out;
  },
  build({ THREE, mat, group, sphere, mesh }) {
    const root = group();
    root.rotation.order = 'YXZ';
    const sheet = mat('#F4F1FF', 0.4, { transparent: true, opacity: 0.9, emissive: '#C8C0F0', emissiveIntensity: 0.35, side: THREE.DoubleSide });
    // Lençol: cúpula + saia; a barra de baixo ondula a cada pose
    const pts = [[0, 22], [6, 21.2], [11, 18], [14, 12], [15, 4], [15, -6], [15.4, -14]].map(([r, y]) => new THREE.Vector2(r, y));
    const geo = new THREE.LatheGeometry(pts, 48);
    const base = geo.attributes.position.array.slice();
    const body = mesh(geo, sheet);
    body.scale.set(1, 1, 0.85);
    root.add(body);
    for (const s of [-1, 1]) {
      const arm = sphere(4, sheet, s * 13, 2, 7, 12);
      arm.scale.set(0.8, 0.55, 1.4);
      arm.rotation.x = -0.4;
      root.add(arm);
    }
    const ink = mat('#2A2040', 0.3);
    for (const s of [-1, 1]) {
      const e = sphere(2.4, ink, s * 4, 10, 12.4, 12);
      e.scale.set(0.8, 1.3, 0.5);
      root.add(e);
      const blush = sphere(1.9, mat('#FF96BE', 0.6, { transparent: true, opacity: 0.6 }), s * 8, 5, 11.6, 10);
      blush.scale.z = 0.4;
      root.add(blush);
    }
    const mouth = sphere(2.6, ink, 0, 2, 12.6, 12);
    mouth.scale.z = 0.5;
    root.add(mouth);
    return { root, geo, base, mouth };
  },
  apply(rig, p) {
    rig.root.rotation.y = side(p.f) * 0.6;
    rig.root.rotation.z = -side(p.f) * 0.08;
    const pos = rig.geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y0 = rig.base[i * 3 + 1];
      if (y0 > -13) continue;
      const a = Math.atan2(rig.base[i * 3 + 2], rig.base[i * 3]);
      pos.setY(i, y0 + Math.sin(a * 4 + p.ph * 1.0) * 3);
    }
    pos.needsUpdate = true;
    rig.geo.computeVertexNormals();
    rig.mouth.scale.y = 1 + Math.abs(Math.sin(p.ph / 2)) * 0.5;
  },
};

// ---------------------------------------------------------------- Aranha
// Apoio: (c.x, y − 8). Oito patas com joelho alto, abdômen com a marca laranja,
// cabeça com quatro olhinhos brilhando e as presas; o fio de teia é 2D
const SPIDER_FRAMES = 8;
export const spider = {
  box: { left: -34, right: 34, top: 28, bottom: -14 },
  res: 2.8,
  elevation: 0.35,
  pose: (c, t) => `${frameOf(t * 16 + c.ph, SPIDER_FRAMES)}${c.dir < 0 ? 'L' : 'R'}`,
  poses() {
    const out = [];
    for (const f of ['R', 'L']) for (let i = 0; i < SPIDER_FRAMES; i++) out.push({ key: `${i}${f}`, f, ph: ((i + 0.5) / SPIDER_FRAMES) * TAU });
    return out;
  },
  build({ THREE, mat, group, sphere, mesh }) {
    const root = group();
    root.rotation.order = 'YXZ';
    const purple = mat('#4A2A6A', 0.4);
    const legM = mat('#2A1840', 0.5);
    const abdomen = sphere(10, mat('#5E3A84', 0.35), 0, 5, -7, 22);
    abdomen.scale.set(1, 0.85, 1.15);
    root.add(abdomen);
    const mark = mesh(new THREE.OctahedronGeometry(3.4), mat('#F28C28', 0.4, { emissive: '#A04A00', emissiveIntensity: 0.4 }), 0, 13.2, -7);
    mark.scale.set(0.8, 0.3, 1.2);
    root.add(mark);
    root.add(sphere(6, purple, 0, 4, 6, 18));
    const eyeM = mat('#FFE27A', 0.2, { emissive: '#FFD040', emissiveIntensity: 1.1 });
    for (const [x, y] of [[-1.8, 6.5], [1.8, 6.5], [-3, 4.4], [3, 4.4]]) root.add(sphere(1.1, eyeM, x, y, 11.3, 8));
    for (const s of [-1, 1]) {
      const fang = mesh(new THREE.ConeGeometry(0.7, 3, 6), mat('#F4F1FF', 0.3), s * 1.6, 0.8, 11);
      fang.rotation.x = Math.PI - 0.3;
      root.add(fang);
    }
    const legs = [];
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const o = { s, i, a: rod(THREE, 1.2, 1, legM), b: rod(THREE, 1, 0.5, legM), k: sphere(1.3, legM, 0, 0, 0, 8) };
        root.add(o.a, o.b, o.k);
        legs.push(o);
      }
    }
    return { root, legs, THREE };
  },
  apply(rig, p) {
    const { THREE } = rig;
    rig.root.rotation.y = side(p.f) * (Math.PI / 2 - 0.5);
    for (const l of rig.legs) {
      const k = Math.sin(p.ph + (l.i % 2 ? Math.PI : 0) + (l.s > 0 ? Math.PI : 0));
      const lift = Math.max(0, k) * 3;
      const z0 = 7 - l.i * 3.6;
      const hip = [l.s * 4, 4, z0];
      const knee = [l.s * (12 + l.i), 13 + lift, z0 + (1.5 - l.i) * 3];
      const foot = [l.s * (18 + l.i * 1.5), -7 + lift * 0.5, z0 + (1.5 - l.i) * 7 + k * 2];
      placeBetween(THREE, l.a, hip, knee);
      placeBetween(THREE, l.b, knee, foot);
      l.k.position.set(...knee);
    }
  },
};

// ---------------------------------------------------------------- Olho
// Apoio: (c.x, y + 3 + balanço), meio dentro d'água. Bola branca com veinhas, íris
// verde olhando para onde anda e a pálpebra que pisca; o anel na água é 2D
export const eyeball = {
  box: { left: -18, right: 18, top: 22, bottom: -8 },
  res: 3,
  elevation: 0.25,
  pose: (c, t) => `${c.dir < 0 ? 'L' : 'R'}${Math.sin(t * 1.3 + c.ph * 2) > 0.96 ? 1 : 0}`,
  poses() {
    const out = [];
    for (const f of ['R', 'L']) for (const b of [0, 1]) out.push({ key: `${f}${b}`, f, blink: b });
    return out;
  },
  build({ THREE, mat, group, sphere }) {
    const root = group();
    const white = canvasTex(THREE, 256, 128, (g, w, h) => {
      g.fillStyle = '#F4F0F8';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(210, 60, 80, 0.7)';
      g.lineWidth = 1.6;
      const rnd = rng(3);
      for (let i = 0; i < 14; i++) {
        let x = rnd() * w;
        let y = h * (0.35 + rnd() * 0.3);
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 4; k++) {
          x += (rnd() - 0.5) * 18;
          y += (rnd() - 0.5) * 14;
          g.lineTo(x, y);
        }
        g.stroke();
      }
    });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(12, 32, 24), new THREE.MeshStandardMaterial({ map: white, roughness: 0.2 }));
    ball.position.y = 7;
    ball.castShadow = true;
    root.add(ball);
    // Íris, pupila e brilho num grupo que gira para onde ele olha
    const look = group(0, 7, 0);
    root.add(look);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(12.15, 32, 16, 0, TAU, 0, 0.45), mat('#3FBF6A', 0.25));
    iris.rotation.x = Math.PI / 2;
    look.add(iris);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(12.25, 24, 8, 0, TAU, 0, 0.2), mat('#10151A', 0.2));
    pupil.rotation.x = Math.PI / 2;
    look.add(pupil);
    look.add(sphere(1.4, mat('#FFFFFF', 0.1, { emissive: '#FFFFFF', emissiveIntensity: 0.6 }), -2.4, 2.6, 11.6, 8));
    // Pálpebra (só piscando)
    const lid = new THREE.Mesh(new THREE.SphereGeometry(12.6, 32, 16, 0, TAU, 0, Math.PI * 0.55), mat('#A898C0', 0.6));
    lid.position.y = 7;
    lid.rotation.x = 0.5;
    root.add(lid);
    return { root, look, lid };
  },
  apply(rig, p) {
    rig.look.rotation.set(-0.15, side(p.f) * 0.55, 0);
    rig.lid.visible = !!p.blink;
  },
};

// ---------------------------------------------------------------- Bala
// No lugar do peixe: bala embrulhada listrada de rosa e branco, com as pontas do
// papel torcidas. Uma foto só: o giro é a rotação da foto no desenho (como no 2D)
export const candy = {
  box: { left: -18, right: 18, top: 12, bottom: -12 },
  res: 3,
  elevation: 0.1,
  pose: () => 'c',
  poses: () => [{ key: 'c' }],
  build({ THREE, mat, group, mesh }) {
    const root = group();
    const tex = canvasTex(THREE, 128, 64, (g, w, h) => {
      g.fillStyle = '#FF5FA2';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#FFFFFF';
      for (let x = -40; x < w + 40; x += 24) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x + 10, 0);
        g.lineTo(x + 34, h);
        g.lineTo(x + 24, h);
        g.fill();
      }
    });
    const body = new THREE.Mesh(new THREE.SphereGeometry(8, 28, 18), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.15 }));
    body.rotation.z = Math.PI / 2;
    body.scale.set(0.85, 1.1, 0.85);
    body.castShadow = true;
    root.add(body);
    const paper = mat('#FFD23F', 0.35, { side: THREE.DoubleSide });
    for (const s of [-1, 1]) {
      const twist = mesh(new THREE.ConeGeometry(1.6, 3, 8), paper, s * 8.6, 0, 0);
      twist.rotation.z = s * Math.PI / 2;
      root.add(twist);
      const fan = mesh(new THREE.ConeGeometry(5, 6, 8, 1, true), paper, s * 12.6, 0, 0);
      fan.rotation.z = s * Math.PI / 2;
      root.add(fan);
    }
    return { root };
  },
  apply() {},
};

// ---------------------------------------------------------------- Abóboras no rio
// Mesmas medidas do sprite 2D (pumpkinSprite): pés em y = 0 (no alto das abóboras),
// 26 abaixo do topo da foto, altura 62. Uma fileira de abóboras encostadas, ligadas
// pela rama com folhas e gavinhas; a parte de baixo fica dentro d'água (escurecida)
// com um anel d'água em volta. Acesas: rosto entalhado com a vela brilhando dentro.
export const PUMP = { PAD: 12, TOP: 26, H: 62, VARIANTS: 3 };
const pumps = new Map();

// Corpo de abóbora (esfera com gomos, achatada, com covinha em cima)
function pumpkinGeometry(THREE, rx, ry, rz) {
  const geo = new THREE.SphereGeometry(1, 40, 24);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const k = 1 - 0.08 * Math.abs(Math.sin(a * 5)) ** 0.6;
    const dimple = y > 0.85 ? (y - 0.85) * 1.4 : 0;
    pos.setXYZ(i, x * rx * k, (y - dimple) * ry * (0.92 + 0.08 * k), z * rz * k);
  }
  geo.computeVertexNormals();
  return geo;
}

// Textura da abóbora: cor com as linhas dos gomos; e a do rosto entalhado (emissiva),
// centrada na frente (u = 0,25 na esfera do Three.js)
function pumpkinTextures(THREE, color) {
  const map = canvasTex(THREE, 256, 128, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, color);
    grd.addColorStop(1, '#6A2A08');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(90, 30, 0, 0.35)';
    g.lineWidth = 3;
    for (let i = 0; i < 10; i++) {
      g.beginPath();
      g.moveTo((w * i) / 10, 0);
      g.lineTo((w * i) / 10, h);
      g.stroke();
    }
  });
  const face = (fill, bg) => canvasTex(THREE, 256, 128, (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    const cx = w * 0.25;
    const cy = h * 0.52;
    g.fillStyle = fill;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx + s * 6, cy - 6);
      g.lineTo(cx + s * 22, cy - 6);
      g.lineTo(cx + s * 14, cy - 22);
      g.closePath();
      g.fill();
    }
    g.beginPath();
    g.moveTo(cx - 4, cy + 3);
    g.lineTo(cx + 4, cy + 3);
    g.lineTo(cx, cy - 3);
    g.fill();
    g.beginPath();
    g.moveTo(cx - 26, cy + 8);
    for (let i = 0; i <= 6; i++) g.lineTo(cx - 26 + (i * 52) / 6, cy + (i % 2 ? 13 : 8));
    g.quadraticCurveTo(cx, cy + 34, cx - 26, cy + 8);
    g.fill();
  });
  return { map, glow: face('#FFE27A', '#000000'), carved: face('#3A1400', '#FFFFFF') };
}

export function pumpkinSubject(w) {
  if (pumps.has(w)) return pumps.get(w);
  const S = {
    box: { left: -PUMP.PAD, right: w + PUMP.PAD, top: PUMP.TOP, bottom: PUMP.TOP - PUMP.H },
    res: 2.2,
    elevation: 0.45,
    poses() {
      const out = [];
      for (let v = 0; v < PUMP.VARIANTS; v++) for (const on of [0, 1]) out.push({ key: `${v}${on}`, v, on });
      return out;
    },
    build(kit) {
      return buildPumpkins(kit, w);
    },
    apply(rig, p) {
      rig.variants.forEach((g, i) => (g.visible = i === p.v));
      for (const [m, off, on] of rig.swaps) m.material = p.on ? on : off;
      for (const o of rig.leaves) o.visible = !p.on;
    },
  };
  pumps.set(w, S);
  return S;
}

function buildPumpkins(kit, w) {
  const { THREE, group, mat, mesh } = kit;
  const root = group();
  const variants = [];
  const swaps = [];
  const leaves = [];
  const n = Math.max(1, Math.round(w / 40));
  const pw = w / n;
  const off = pumpkinTextures(THREE, '#B85A1C');
  const on = pumpkinTextures(THREE, '#F28C28');
  const offM = new THREE.MeshStandardMaterial({ map: off.map, roughness: 0.5, vertexColors: true });
  const onM = new THREE.MeshStandardMaterial({
    map: on.map, roughness: 0.45, vertexColors: true, emissive: '#FFFFFF', emissiveMap: on.glow, emissiveIntensity: 1.1,
  });
  const vine = mat('#2E4618', 0.8);
  const leafM = mat('#4C6E2A', 0.7, { side: THREE.DoubleSide });
  const stemM = mat('#5A7A2E', 0.7);
  const ringM = mat('#CDB4FF', 0.3, { transparent: true, opacity: 0.4, depthWrite: false });
  const WL = -10;
  for (let v = 0; v < PUMP.VARIANTS; v++) {
    const rnd = rng((v + 3) * 7717 + w);
    const g = group();
    for (let i = 0; i < n; i++) {
      const cx = i * pw + pw / 2 + (rnd() - 0.5) * 2;
      const rx = pw / 2 + 1.5;
      const ry = 11 + rnd() * 1.5;
      const cy = -4 - (rnd() - 0.5) * 1.6;
      const geo = pumpkinGeometry(THREE, rx, ry, Math.min(rx, 16) * 0.95);
      // Parte de baixo dentro d'água: escurecida e arroxeada pela cor do rio
      const pos = geo.attributes.position;
      const col = new Float32Array(pos.count * 3);
      for (let k = 0; k < pos.count; k++) {
        const y = pos.getY(k) + cy;
        const d = Math.max(0, Math.min(1, (WL + 3 - y) / 10));
        col.set([1 - d * 0.65, 1 - d * 0.75, 1 - d * 0.45], k * 3);
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const p = mesh(geo, offM, cx, cy, 0);
      p.rotation.y = (rnd() - 0.5) * 0.3;
      swaps.push([p, offM, onM]);
      g.add(p);
      // Cabinho torcido
      const stem = kit.bone(1.4, [cx, cy + ry - 1.5, 0], [cx + 2, cy + ry + 4, -1], stemM);
      g.add(stem);
      // Anel d'água em volta
      const ring = mesh(new THREE.TorusGeometry(1, 0.035, 6, 40), ringM, cx, WL + 0.5, 0);
      ring.rotation.x = Math.PI / 2;
      ring.scale.set(rx * 0.92, Math.min(rx, 16) * 0.88, 1);
      ring.castShadow = false;
      g.add(ring);
      // Folha da rama em cima (só nas apagadas)
      const leaf = mesh(new THREE.CircleGeometry(4.5, 10), leafM, cx + rx * 0.45, cy + ry - 0.5, -3);
      leaf.rotation.set(-Math.PI / 2 + 0.4, 0, -0.5);
      leaf.scale.set(1, 0.55, 1);
      g.add(leaf);
      leaves.push(leaf);
    }
    // Rama ligando as abóboras por trás, com gavinhas
    const pts = [];
    for (let i = 0; i <= n * 4; i++) {
      const x = 2 + ((w - 4) * i) / (n * 4);
      pts.push(new THREE.Vector3(x, 2 + Math.sin((x / pw) * Math.PI) * 4, -8));
    }
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 12, 1.2, 6), vine));
    for (let i = 1; i < n; i++) {
      const tp = [];
      for (let k = 0; k <= 10; k++) tp.push(new THREE.Vector3(i * pw + Math.cos(k * 0.9) * 2.4, 4 + k * 0.5, -8 + Math.sin(k * 0.9) * 2.4));
      g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tp), 20, 0.45, 4), vine));
    }
    root.add(g);
    variants.push(g);
  }
  return { root, variants, swaps, leaves };
}

// Abóbora de rosto aceso da costa (raio 15; as outras são a mesma foto em escala).
// Base em (0, 0); o brilho em volta é 2D
export const JACK_R = 15;
export const jack = {
  box: { left: -26, right: 26, top: 34, bottom: -6 },
  res: 3,
  elevation: 0.15,
  poses: () => [{ key: 'j' }],
  build({ THREE, group, mesh, bone, mat }) {
    const root = group();
    const tx = pumpkinTextures(THREE, '#F28C28');
    const m = new THREE.MeshStandardMaterial({ map: tx.map, roughness: 0.45, emissive: '#FFFFFF', emissiveMap: tx.glow, emissiveIntensity: 1.2 });
    const r = JACK_R;
    root.add(mesh(pumpkinGeometry(THREE, r * 1.12, r * 0.82, r * 1.0), m, 0, r * 0.82, 0));
    root.add(bone(1.6, [0, r * 1.55, 0], [2.5, r * 1.95, -1], mat('#5A7A2E', 0.7)));
    return { root };
  },
  apply() {},
};

// ---------------------------------------------------------------- Árvore seca
// Base em (0, 0), como o 2D: tronco torto, galhos retorcidos afinando e o buraco no
// tronco. A lanterna pendurada continua 2D (balança e brilha)
export const deadTree = {
  box: { left: -50, right: 80, top: 160, bottom: -8 },
  res: 2,
  elevation: 0.12,
  poses: () => [{ key: 't' }],
  build({ THREE, mat, group, mesh, sphere }) {
    const root = group();
    const bark = canvasTex(THREE, 64, 256, (g, w, h) => {
      g.fillStyle = '#3A2A30';
      g.fillRect(0, 0, w, h);
      const rnd = rng(11);
      for (let i = 0; i < 40; i++) {
        g.fillStyle = rnd() < 0.5 ? 'rgba(15, 8, 14, 0.6)' : 'rgba(110, 90, 110, 0.25)';
        g.fillRect(rnd() * w, 0, 1 + rnd() * 2, h);
      }
    });
    const barkM = new THREE.MeshStandardMaterial({ map: bark, roughness: 0.95 });
    // Galho afinando ao longo de uma curva (anéis de cilindros)
    const branch = (pts, r0, r1) => {
      const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
      const N = 12;
      for (let i = 0; i < N; i++) {
        const a = curve.getPoint(i / N);
        const b = curve.getPoint((i + 1) / N);
        const r = r0 + (r1 - r0) * (i / N);
        const o = rod(THREE, r, r0 + (r1 - r0) * ((i + 1) / N), barkM);
        placeBetween(THREE, o, a.toArray(), b.toArray());
        root.add(o);
        root.add(sphere(r * 0.98, barkM, a.x, a.y, a.z, 8));
      }
    };
    branch([[0, 0, 0], [4, 40, 2], [5, 80, 0], [-2, 120, -2]], 8, 3.2);
    branch([[2, 78, 0], [24, 90, 4], [44, 90, 3], [58, 88, 2]], 3.6, 1.2);
    branch([[-1, 104, 0], [-14, 124, 2], [-16, 140, 0], [-14, 150, 0]], 2.8, 0.8);
    branch([[-2, 118, 0], [12, 134, -2], [26, 140, -3], [34, 140, -3]], 2.6, 0.8);
    branch([[40, 90, 3], [46, 98, 4], [50, 104, 5]], 1.4, 0.5);
    branch([[24, 132, -2], [27, 142, -2], [28, 150, -2]], 1.3, 0.5);
    branch([[-12, 138, 1], [-20, 143, 2], [-26, 146, 2]], 1.2, 0.4);
    // Raízes saindo do chão
    for (const [x, z] of [[-10, 4], [9, 5], [2, -8]]) branch([[0, 8, 0], [x * 0.6, 2, z * 0.6], [x, -1, z]], 4, 1.5);
    // Buraco no tronco
    const hole = sphere(4.4, mat('#0E0810', 0.9), 2.5, 46, 6.6, 12);
    hole.scale.set(0.9, 1.6, 0.4);
    root.add(hole);
    return { root };
  },
  apply() {},
};

// ---------------------------------------------------------------- Casa assombrada
// Mesmo lugar, mesmas 16 peças e mesma porta da casa 2D (src/halloween.js): 6 painéis
// de tábuas sobrepostas (frente, fundo e laterais, algumas tortas), 3 faixas do
// telhado de ardósia em escamas, 2 janelas com caixilho em cruz e veneziana torta,
// janela redonda do sótão, chaminé torta, lanterna ao lado da porta e o cata-vento
// de morcego. A porta (peça 16) continua 2D, e os brilhos das janelas e da lanterna
// também. Frente das paredes em z = 0. Fotos: "n1".."n15", "lit" e "b0".."b14".
export const HAUNTED_DEPTH = 70;
export const haunted = {
  box: { left: -150, right: 150, top: 186, bottom: -20 },
  res: 1.5,
  elevation: 0.2,
  poses() {
    const out = [];
    for (let n = 1; n < HAUNTED_PIECES.length; n++) out.push({ key: `n${n}`, upto: n });
    out.push({ key: 'lit', upto: HAUNTED_PIECES.length - 1, lit: true });
    for (let i = 0; i < HAUNTED_PIECES.length - 1; i++) out.push({ key: `b${i}`, only: i });
    return out;
  },
  build(kit) {
    const { THREE, mat, group, mesh, sphere } = kit;
    const { HW, WALL_H, ROOF, CHIMNEY } = HAUNTED;
    const D = HAUNTED_DEPTH;
    const zc = -D / 2;
    const third = (HW * 2) / 3;
    const plank = canvasTex(THREE, 128, 32, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, '#5E4C72');
      grd.addColorStop(1, '#3A2C4A');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
      const rnd = rng(17);
      for (let i = 0; i < 8; i++) {
        g.fillStyle = 'rgba(20, 10, 30, 0.35)';
        g.fillRect(0, rnd() * h, w, 1);
      }
      g.fillStyle = 'rgba(200, 190, 220, 0.35)';
      g.fillRect(4, 6, 2, 2);
      g.fillRect(w - 6, 6, 2, 2);
    });
    const wood = new THREE.MeshStandardMaterial({ map: plank, roughness: 0.85 });
    const dark = mat('#1A1224', 0.7);
    const slate = canvasTex(THREE, 256, 64, (g, w, h) => {
      g.fillStyle = '#2C2238';
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(120, 100, 150, 0.4)';
      for (let y = 6; y < h + 8; y += 9) {
        for (let x = ((y / 9) % 2) * 6; x < w; x += 12) {
          g.beginPath();
          g.arc(x, y, 5.5, 0, Math.PI);
          g.fill();
        }
      }
    });
    slate.wrapS = THREE.RepeatWrapping;
    slate.repeat.set(4, 1);
    const roofM = new THREE.MeshStandardMaterial({ map: slate, roughness: 0.6, side: THREE.DoubleSide });
    const glass = mat('#FFD86A', 0.3, { emissive: '#FFB84A', emissiveIntensity: 0.6 });
    const glassLit = mat('#FFE0A0', 0.3, { emissive: '#FFC060', emissiveIntensity: 1.3 });
    const attic = mat('#A0FF8C', 0.3, { emissive: '#60E050', emissiveIntensity: 0.9 });
    const root = group();
    const pieces = [];
    const litSwap = [];
    const band = (ROOF.base - ROOF.peak) / 3;
    const roofHalf = (y) => (ROOF.eave * (-ROOF.peak - y)) / (-ROOF.peak - -ROOF.base);
    const RZ = 0.55;
    // Tábuas horizontais de uma faixa da parede (a frente ou o fundo), com uma torta
    const boards = (g, x0, x1, y0, y1, z, seed) => {
      const n = 4;
      const bh = (y1 - y0) / n;
      for (let i = 0; i < n; i++) {
        const o = mesh(new THREE.BoxGeometry(x1 - x0 + 0.6, bh + 0.8, 2.4), wood, (x0 + x1) / 2, y0 + bh * (i + 0.5), z);
        o.rotation.x = -0.08; // sobrepostas (a de cima encobre a de baixo)
        if ((seed + i) % 5 === 0) o.rotation.z = 0.04;
        g.add(o);
      }
    };
    for (const p of HAUNTED_PIECES.slice(0, -1)) {
      const g = group();
      if (p.kind === 'wall') {
        const x0 = -HW + third * p.col;
        const y0 = p.row * (WALL_H / 2);
        const y1 = y0 + WALL_H / 2;
        boards(g, x0, x0 + third, y0, y1, -1.2, p.row * 3 + p.col);
        boards(g, x0, x0 + third, y0, y1, -D + 1.2, p.row * 3 + p.col + 2);
        if (p.col !== 1) {
          const s = p.col === 0 ? -1 : 1;
          const sg = group(s * (HW - 1.2), 0, zc);
          sg.rotation.y = Math.PI / 2;
          boards(sg, -D / 2, D / 2, y0, y1, 0, p.row + 1);
          g.add(sg);
        }
      } else if (p.kind === 'roof') {
        const yb = -(ROOF.base - band * p.i);
        const yt = yb + band;
        const hb = roofHalf(yb) + 3;
        const ht = Math.max(0.5, roofHalf(yt) + 1.5);
        const geo = new THREE.CylinderGeometry(ht * Math.SQRT2, hb * Math.SQRT2, yt - yb + 2, 4, 1, true);
        geo.rotateY(Math.PI / 4);
        const o = mesh(geo, roofM, 0, (yb + yt) / 2 - 1, zc);
        o.scale.z = RZ;
        g.add(o);
        // Beiral escuro na faixa de baixo
        if (p.i === 0) {
          const eave = mesh(new THREE.BoxGeometry(hb * 2 + 8, 4, hb * 2 * RZ + 8), dark, 0, yb - 1, zc);
          g.add(eave);
        }
      } else if (p.kind === 'window') {
        const x = p.side * 58;
        const y = 45;
        const pane = mesh(new THREE.BoxGeometry(26, 30, 1), glass, x, y, 0.6);
        litSwap.push([pane, glass, glassLit]);
        g.add(pane);
        for (const [dx, dy, w, h] of [[0, 0, 2.4, 30], [0, 0, 26, 2.4], [0, 16, 30, 3], [0, -16, 30, 3], [-14, 0, 3, 30], [14, 0, 3, 30]]) {
          g.add(mesh(new THREE.BoxGeometry(w, h, 2), dark, x + dx, y + dy, 1.4));
        }
        // Veneziana torta pendurada de um lado
        const sh = group(p.side < 0 ? x - 15 : x + 15, y + 15, 1.6);
        sh.rotation.z = -p.side * 0.18;
        sh.rotation.y = p.side * 0.35;
        g.add(sh);
        sh.add(mesh(new THREE.BoxGeometry(11, 30, 1.4), mat('#2E2240', 0.8), p.side * 5.5, -15, 0));
        for (let k = 0; k < 5; k++) sh.add(mesh(new THREE.BoxGeometry(11, 1.2, 1.8), mat('#1A1224', 0.8), p.side * 5.5, -4 - k * 5.5, 0.2));
      } else if (p.kind === 'attic') {
        // Janela redonda no telhado da frente, inclinada como ele
        const y = 106;
        const zf = zc + roofHalf(y) * RZ + 1.5;
        const w = group(0, y, zf);
        w.rotation.x = -Math.atan((ROOF.eave * RZ) / (-ROOF.peak - -ROOF.base));
        g.add(w);
        w.add(mesh(new THREE.TorusGeometry(10.5, 2.2, 8, 24), dark));
        w.add(mesh(new THREE.CircleGeometry(9, 24), attic, 0, 0, -0.4));
        w.add(mesh(new THREE.BoxGeometry(2, 18, 1.4), dark, 0, 0, 0.4));
        w.add(mesh(new THREE.BoxGeometry(18, 2, 1.4), dark, 0, 0, 0.4));
      } else if (p.kind === 'chimney') {
        const { x, top, w } = CHIMNEY;
        const cg = group(x, -top, zc - 8);
        cg.rotation.z = -0.08;
        g.add(cg);
        const brick = canvasTex(THREE, 32, 64, (c, cw, ch) => {
          c.fillStyle = '#3A2A30';
          c.fillRect(0, 0, cw, ch);
          c.fillStyle = 'rgba(0, 0, 0, 0.35)';
          for (let yy = 4; yy < ch; yy += 8) c.fillRect(0, yy, cw, 1.4);
        });
        cg.add(mesh(new THREE.BoxGeometry(w, 52, w), new THREE.MeshStandardMaterial({ map: brick, roughness: 0.9 }), 0, -26, 0));
        cg.add(mesh(new THREE.BoxGeometry(w + 6, 5, w + 6), mat('#2A1E24', 0.8), 0, 0.5, 0));
      } else if (p.kind === 'lantern') {
        const lg = group(40, 66, 3);
        g.add(lg);
        lg.add(mesh(new THREE.BoxGeometry(2, 8, 2), dark, 0, 8, -2));
        lg.add(mesh(new THREE.BoxGeometry(14, 3, 10), dark, 0, 4, 0));
        lg.add(mesh(new THREE.BoxGeometry(10, 14, 7), mat('#FFE27A', 0.3, { emissive: '#FFC040', emissiveIntensity: 1.2 }), 0, -5, 0));
        for (const sx of [-5, 5]) lg.add(mesh(new THREE.BoxGeometry(1.4, 14, 7.6), dark, sx, -5, 0));
        lg.add(mesh(new THREE.BoxGeometry(12, 3, 9), dark, 0, -13, 0));
      } else if (p.kind === 'vane') {
        const top = -ROOF.peak;
        g.add(kit.bone(0.9, [0, top - 2, zc], [0, top + 16, zc], dark));
        const bat = new THREE.Shape();
        bat.moveTo(0, 3);
        bat.quadraticCurveTo(-6, 8, -13, 4);
        bat.quadraticCurveTo(-9, 0, -6, -3);
        bat.quadraticCurveTo(0, 0, 6, -3);
        bat.quadraticCurveTo(9, 0, 13, 4);
        bat.quadraticCurveTo(6, 8, 0, 3);
        const b = mesh(new THREE.ExtrudeGeometry(bat, { depth: 1, bevelEnabled: false }), dark, 0, top + 16, zc);
        b.rotation.y = 0.5;
        g.add(b);
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
