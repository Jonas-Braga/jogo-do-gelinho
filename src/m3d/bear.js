// Urso polar da fase normal em 3D: corpo com corcova, quatro patas articuladas
// (coxa, joelho, canela e pata, posicionadas por cinemática inversa), cabeça com
// focinho e mandíbula que abre para rugir na perseguição.
//
// O passo é o de um quadrúpede de verdade: cada pata fica apoiada no chão uns 60%
// do ciclo (o corpo passa por cima dela, a pata desliza para trás) e no resto sobe
// dobrando o joelho e avança em arco. As patas se alternam em sequência: traseira
// de um lado, dianteira do mesmo lado, traseira do outro, dianteira do outro.
import { TAU } from './kit.js';
import { fetchGLB, instantiate } from './glb.js';

export const FRAMES = 12;
// Pés em (0, 0); a cabeça fica do lado para onde ele anda
export const box = { left: -100, right: 100, top: 128, bottom: -24 };
export const res = 2;

// Pelagem com volume: a superfície do corpo é empurrada para fora em tufos (ruído pela
// posição, então as costuras andam juntas) e, onde a superfície vira para baixo (barriga,
// atrás das pernas), em franja mais comprida, como o pelo pendurado das referências.
// Depois junta as normais de vértices na mesma posição (sem costura na luz).
const hash3 = (x, y, z) => {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
};
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const s = (t) => t * t * (3 - 2 * t);
  const u = s(xf), v = s(yf), w = s(zf);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
export function shag(mesh, { amount = 1.4, under = 3, seed = 0 } = {}) {
  const g = mesh.geometry;
  const pos = g.getAttribute('position');
  const nrm = g.getAttribute('normal');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = nrm.getX(i), ny = nrm.getY(i), nz = nrm.getZ(i);
    const clump = vnoise(x * 0.3 + seed, y * 0.13, z * 0.3);
    const fine = vnoise(x * 0.9 + seed, y * 0.45 + 7, z * 0.9);
    let d = (clump * 0.65 + fine * 0.35 - 0.35) * amount;
    if (ny < -0.15) d += -ny * under * (0.45 + fine * 0.9) * (0.6 + clump * 0.6);
    pos.setXYZ(i, x + nx * d, y + ny * d - (ny < -0.15 ? -ny * under * 0.25 * fine : 0), z + nz * d);
  }
  g.computeVertexNormals();
  mergeNormals(g);
  return mesh;
}
function mergeNormals(g) {
  const pos = g.getAttribute('position');
  const nrm = g.getAttribute('normal');
  const map = new Map();
  const key = (i) => `${Math.round(pos.getX(i) * 50)},${Math.round(pos.getY(i) * 50)},${Math.round(pos.getZ(i) * 50)}`;
  for (let i = 0; i < pos.count; i++) {
    const k = key(i);
    const a = map.get(k);
    if (a) a.push(i);
    else map.set(k, [i]);
  }
  for (const ids of map.values()) {
    if (ids.length < 2) continue;
    let x = 0, y = 0, z = 0;
    for (const i of ids) { x += nrm.getX(i); y += nrm.getY(i); z += nrm.getZ(i); }
    const l = Math.hypot(x, y, z) || 1;
    for (const i of ids) nrm.setXYZ(i, x / l, y / l, z / l);
  }
  nrm.needsUpdate = true;
}

const frameOf = (phase, n) => ((Math.floor((phase / TAU) * n) % n) + n) % n;

// Qual foto usar (o passo vem de b.walk, como no desenho 2D; boca aberta ao perseguir)
export function bearPose(b, t) {
  const f = frameOf(b.walk * 3, FRAMES);
  const m = b.chasing ? (Math.abs(Math.sin(t * 12)) > 0.5 ? 2 : 1) : 0;
  return `walk${f}${b.dir < 0 ? 'L' : 'R'}${m}`;
}

export function poses() {
  const out = [];
  for (const f of ['R', 'L']) {
    for (let i = 0; i < FRAMES; i++) {
      const u = (i + 0.5) / FRAMES;
      for (let m = 0; m < 3; m++) out.push({ key: `walk${i}${f}${m}`, facing: f, u, mouth: [0, 0.32, 0.55][m] });
    }
  }
  return out;
}

// Modelo procedural antigo (Three.js puro): só se o modelo do Blender não carregar
export function buildProcedural(kit, variant = 'polar') {
  // Urso no estilo das referências do usuário (urso de animação): corpão redondo e alto,
  // cabeça grande e redonda com focinho curto e claro, nariz preto arredondado, boquinha
  // sorrindo, olhos grandes com íris castanha e brilho, sobrancelhas, orelhas redondas,
  // pernas grossas com garras escuras e o rabinho redondo. Pelagem fofa.
  const { THREE, mat, group, sphere, sweep, furMaterial } = kit;
  const brown = variant === 'brown';
  const furOpts = brown
    ? { base: '#8A4A26', light: '#A8623A', dark: '#5E2E14', seed: 7 }
    : { base: '#ECE6D8', light: '#FFFFFF', dark: '#CFC6B2', seed: 3 };
  const fur = furMaterial({ ...furOpts, repeat: [6, 5], len: 10, strands: 1500, bump: 0.8 });
  const furShade = furMaterial({ ...furOpts, base: brown ? '#7A3E1E' : '#E2DACA', repeat: [4, 4], seed: furOpts.seed + 1, len: 10, strands: 1400, bump: 0.8 });
  const furHead = furMaterial({ ...furOpts, repeat: [4, 3], len: 6, strands: 1100, bump: 0.6 });
  const muzzleM = furMaterial(brown
    ? { base: '#C8955E', light: '#DDB07A', dark: '#A87444', seed: 11, repeat: [2, 2], len: 4, strands: 700, bump: 0.4 }
    : { base: '#D9D3C8', light: '#EEEAE2', dark: '#BDB6A8', seed: 11, repeat: [2, 2], len: 4, strands: 700, bump: 0.4 });
  const black = mat('#141416', 0.22);
  const claw = mat('#1C1A1A', 0.3);
  const mouthIn = mat('#5A1E22', 0.7);
  const tooth = mat('#FFFFFF', 0.4);
  const sclera = mat('#F7F4EE', 0.3);
  const iris = mat(brown ? '#6A3A14' : '#5A3A1E', 0.3);
  const shine = mat('#FFFFFF', 0.1, { emissive: '#FFFFFF', emissiveIntensity: 0.6 });
  const browM = mat(brown ? '#3E1C0C' : '#5E5850', 0.9);
  const earIn = mat(brown ? '#5A2C14' : '#BDB3A0', 0.9);

  const root = group();
  root.rotation.order = 'YXZ';
  const body = group();
  root.add(body);
  // Tronco e pescoço numa peça só: um "feijão" fundo, dorso alto no meio, garupa
  // redonda descendo para trás e o pescoço grosso que desce para a cabeça
  body.add(shag(sweep(bearSpine(variant), fur, { radial: 36, cap: 0.85, steps: 80 }), { amount: 0.9, under: 2.4, seed: 1 }));
  for (const s of [-1, 1]) {
    // Ancas grandes e redondas fundidas na garupa (a coxa de trás das referências)
    const h = kit.mesh(new THREE.SphereGeometry(1, 30, 22), s < 0 ? fur : furShade);
    h.geometry.scale(13, 21, 17);
    h.geometry.translate(s * 11, 54, -34);
    h.geometry.computeVertexNormals();
    body.add(shag(h, { amount: 0.8, under: 2, seed: 20 + s }));
    // Ombro redondo sobre a pata da frente
    const sh = kit.mesh(new THREE.SphereGeometry(1, 26, 20), s < 0 ? fur : furShade);
    sh.geometry.scale(11, 18, 14);
    sh.geometry.translate(s * 13, 58, 20);
    sh.geometry.computeVertexNormals();
    body.add(shag(sh, { amount: 0.7, under: 1.8, seed: 30 + s }));
  }
  // Rabinho redondo e fofo no alto da garupa
  body.add(shag(sphere(5, furShade, 0, 68, -55, 16), { amount: 0.7, under: 0.8, seed: 5 }));

  // Patas: peça contínua do quadril ao tornozelo (refeita a cada pose) e a pata
  // larga com almofada escura embaixo e 4 garras escuras na frente
  const legs = [];
  for (const [lx, front, phase] of LEGS) {
    const x = lx * 1.1;
    const m = x < 0 ? fur : furShade;
    const limb = sweep(legSpine(front, [x, 56, 0], [x, 31, 0], [x, 10, 0]), m, { radial: 22, cap: 0.6 });
    const foot = group();
    const sole = sphere(9.6, m, 0, 2, 1.5, 20);
    sole.scale.set(1, 0.66, 1.2);
    foot.add(sole);
    const padM = sphere(8, mat('#2A2624', 0.7), 0, -2.8, 1.6, 14);
    padM.scale.set(0.95, 0.2, 1.1);
    foot.add(padM);
    for (const cx of [-5.6, -1.9, 1.9, 5.6]) {
      const c = kit.mesh(new THREE.ConeGeometry(1.1, 3.8, 8), claw, cx, -0.8, 12.6 - Math.abs(cx) * 0.3);
      c.rotation.x = Math.PI / 2 + 0.85;
      c.scale.set(1, 1, 0.7);
      foot.add(c);
    }
    root.add(limb, foot);
    legs.push({
      x, front, phase, near: x < 0, L1: 27, L2: 24, limb, foot,
      hip: { y: front ? 57 : 56, z: front ? 20 : -32 },
    });
  }

  // Cabeça baixa e para a frente, na ponta do pescoço grosso (como nas referências):
  // crânio redondo e focinho comprido e claro afinando até o nariz
  const head = group(0, 74, 57);
  head.scale.setScalar(1.13);
  body.add(head);
  const skull = sphere(16, furHead, 0, 0, 0, 36);
  skull.scale.set(1, 0.95, 1);
  head.add(shag(skull, { amount: 0.6, under: 1.4, seed: 4 }));
  // Bochechas fofas atrás dos cantos da boca
  for (const s of [-1, 1]) {
    const cheek = sphere(7, furHead, s * 8.5, -5.5, 6, 18);
    cheek.scale.set(0.9, 0.8, 0.95);
    head.add(shag(cheek, { amount: 0.6, under: 1, seed: 8 + s }));
  }
  // Focinho: peça contínua que sai do crânio e afina para a frente, um pouco para baixo
  head.add(sweep([
    { p: [0, -2, 4], w: 11.5, h: 10, hb: 11 },
    { p: [0, -3, 12], w: 9.5, h: 7.5, hb: 8.5 },
    { p: [0, -3.6, 19], w: 7.4, h: 6, hb: 6.6 },
    { p: [0, -3.8, 26], w: 5.6, h: 4.8, hb: 5.2 },
  ], muzzleM, { radial: 24, cap: 0.9, steps: 30 }));
  // Ponte do focinho com o pelo da cabeça (o claro fica nos lados e embaixo)
  head.add(sweep([
    { p: [0, 4, 6], w: 8.5, h: 5, hb: 6 },
    { p: [0, 1.4, 13], w: 6.4, h: 4, hb: 5 },
    { p: [0, -0.6, 19], w: 4.4, h: 3, hb: 4 },
  ], furHead, { radial: 20, cap: 0.8, steps: 20 }));
  // Nariz preto arredondado na ponta, com brilho
  const nose = sphere(3.8, black, 0, -2.6, 30.2, 18);
  nose.scale.set(1.4, 0.95, 0.9);
  head.add(nose);
  head.add(sphere(0.85, shine, -1.1, -1, 33, 8));
  // Boquinha sorrindo: o risquinho debaixo do nariz e a linha que sobe para a bochecha
  const philtrum = kit.mesh(new THREE.CapsuleGeometry(0.35, 2.6, 4, 6), black, 0, -5.4, 30.4);
  philtrum.rotation.x = -0.3;
  head.add(philtrum);
  const smile = kit.mesh(new THREE.TorusGeometry(6.6, 0.42, 6, 24, Math.PI * 0.7), black, 0, -3.4, 25);
  smile.rotation.set(Math.PI / 2 + 0.5, 0, Math.PI * 0.15);
  smile.scale.set(1, 1.25, 1);
  head.add(smile);
  // Olhos grandes no alto do crânio, acima do começo do focinho: branco, íris
  // castanha, pupila e brilho; pálpebra de pelo e a sobrancelha escura
  const brows = [];
  for (const s of [-1, 1]) {
    const eye = group(s * 6.4, 5.2, 13.4);
    eye.rotation.set(-0.2, s * 0.42, 0);
    head.add(eye);
    eye.scale.setScalar(1.15);
    const white = sphere(3.4, sclera, 0, 0, 0, 18);
    white.scale.set(1, 1.12, 0.6);
    eye.add(white);
    eye.add(sphere(2.05, iris, 0, -0.3, 1.5, 14));
    eye.add(sphere(1.15, black, 0, -0.3, 2.35, 10));
    eye.add(sphere(0.6, shine, s * -0.7, 0.8, 2.85, 8));
    const lid = sphere(3.7, furHead, 0, 3.4, -1.2, 14);
    lid.scale.set(1.05, 0.34, 0.66);
    eye.add(lid);
    const brow = kit.mesh(new THREE.CapsuleGeometry(0.6, 3.4, 4, 8), browM, s * 0.2, 4.6, 0);
    brow.rotation.z = Math.PI / 2 + s * 0.15;
    brow.scale.set(1, 1, 0.55);
    eye.add(brow);
    brows.push({ brow, s });
    // Orelhinhas redondas no alto e atrás, com o miolo mais escuro
    const ear = sphere(5, furShade, s * 10.5, 12.5, -3, 16);
    ear.scale.set(1, 1, 0.55);
    head.add(ear);
    const inner = sphere(3, earIn, s * 10.5, 12.2, -0.6, 12);
    inner.scale.set(1, 1, 0.35);
    head.add(inner);
  }
  // Mandíbula (abre para rugir na perseguição), com a boca escura e os dentinhos
  const jaw = group(0, -8, 6);
  const lower = sphere(1, muzzleM, 0, 0, 8, 18);
  lower.scale.set(6.2, 3, 10);
  jaw.add(lower);
  const inside = sphere(1, mouthIn, 0, 1.8, 10, 14);
  inside.scale.set(5, 2.2, 8.6);
  jaw.add(inside);
  jaw.userData.inside = inside;
  for (const s of [-1, 1]) inside.add(kit.mesh(new THREE.ConeGeometry(0.75 / 5, 2.4 / 2.2, 8), tooth, (s * 3) / 5, 0.4, 0.8));
  head.add(jaw);
  const lip = sphere(1, mouthIn, 0, -8, 23, 14);
  lip.scale.set(4.6, 1.6, 5);
  head.add(lip);
  const fangs = [];
  for (const s of [-1, 1]) {
    const fang = kit.mesh(new THREE.ConeGeometry(0.75, 2.4, 8), tooth, s * 2.8, -8.6, 26.6);
    fang.rotation.x = Math.PI;
    head.add(fang);
    fangs.push(fang);
  }

  // Gorro de Papai Noel (Natal): copa vermelha, barra de pelo, ponta articulada
  // que cai para trás e balança com o passo, e o pompom
  let hatTip = null;
  if (variant === 'santa') {
    const red = mat('#C8242B', 0.8);
    const white = mat('#FFFFFF', 0.95);
    const hat = group(0, 13.5, -2.5);
    hat.rotation.x = -0.3;
    hat.scale.setScalar(1.35);
    head.add(hat);
    hat.add(kit.mesh(new THREE.ConeGeometry(10.5, 14, 20, 1, true), red, 0, 6, 0));
    const rim = kit.mesh(new THREE.TorusGeometry(10.5, 3, 10, 24), white, 0, -0.5, 0);
    rim.rotation.x = Math.PI / 2;
    hat.add(rim);
    hatTip = group(0, 12, 0);
    hat.add(hatTip);
    const tip = kit.mesh(new THREE.ConeGeometry(4.2, 12, 14), red, 0, 0, -5);
    tip.rotation.x = -Math.PI / 2 - 0.4;
    hatTip.add(tip);
    hatTip.add(sphere(3.4, white, 0, -3.2, -10.5, 12));
  }
  return { root, body, legs, head, jaw, lip, fangs, brows, hatTip, kit, THREE };
}

// Tronco e pescoço numa peça só (frente do urso = +z): garupa, barriga que pende um
// pouco, ombros e o pescoço que entra na cabeça (em z = 40). O polar tem a garupa mais
// alta e o pescoço comprido; o marrom, a corcova no ombro.
export function bearSpine(variant = 'polar') {
  // "Feijão" fundo das referências: garupa redonda e mais baixa atrás, dorso mais alto
  // no meio (no marrom, a corcova sobre o ombro), barriga funda e o pescoço grosso
  // descendo para a cabeça, que fica na frente, na altura do peito
  const brown = variant === 'brown';
  return [
    { p: [0, 58, -46], w: 14, h: 15, hb: 17 },
    { p: [0, 61, -33], w: 23, h: brown ? 25 : 28, hb: 26 },
    { p: [0, 62, -16], w: 26, h: 29, hb: 30 },
    { p: [0, 62, 1], w: 27, h: brown ? 29 : 30, hb: 31 },
    { p: [0, brown ? 65 : 63, 17], w: 26, h: brown ? 29 : 25, hb: 32 },
    { p: [0, 65, 32], w: 22, h: 22, hb: 29 },
    { p: [0, 70, 46], w: 17, h: 16, hb: 18 },
  ];
}

// Modelo do urso com uma variante ('polar' ou 'santa', com o gorro do Natal)
const variants = new Map();
export function withVariant(v = 'polar') {
  if (!variants.has(v)) variants.set(v, { box, res, poses, apply, bearPose, build: (kit) => build(kit, v), prepare: () => prepare(v) });
  return variants.get(v);
}

// Coloca uma cápsula (eixo y) entre os pontos a e b
function place(THREE, o, a, b) {
  o.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
}

// Onde fica a pata no momento u (0 a 1) do ciclo dela: apoio no chão deslizando
// para trás, depois sobe em arco e avança
export const STANCE = 0.6;
// [x, dianteira?, fase no ciclo]: traseira de perto, dianteira de perto, traseira de
// longe, dianteira de longe (de perto da câmera = lado −x)
export const LEGS = [[-11, false, 0], [-11, true, 0.25], [11, false, 0.5], [11, true, 0.75]];
export function footAt(leg, u) {
  // Passada casada com a velocidade: o urso anda ~35 px por ciclo (walk += v·dt·0,06 e o
  // ciclo é walk·3), a pata de apoio desliza para trás na mesma velocidade (sem patinar);
  // 0,91 é o quanto o perfil aparece na tela, virado 24° para a câmera
  const stride = ((TAU / 3 / 0.06) * STANCE) / Math.sin(Math.PI / 2 - 0.42);
  const ground = 4.2;
  const z0 = leg.hip.z + (leg.front ? 3 : 1);
  if (u < STANCE) return { y: ground, z: z0 + stride * (0.5 - u / STANCE), lift: 0 };
  const s = (u - STANCE) / (1 - STANCE);
  const e = s * s * (3 - 2 * s); // acelera e freia
  const lift = Math.sin(Math.PI * s);
  return { y: ground + lift * (leg.front ? 15 : 9), z: z0 + stride * (-0.5 + e), lift };
}

// Cinemática inversa de dois ossos no plano (z, y). A dianteira dobra para trás
// (cotovelo/pulso), a traseira dobra para a frente (joelho)
export function legIK(leg, u, hy, hz) {
  const f = footAt(leg, u);
  // O tornozelo fica um pouco acima da pata
  const ay = f.y + 4;
  const az = f.z - (leg.front ? 1.5 : 2.5);
  let dz = az - hz;
  let dy = ay - hy;
  let d = Math.hypot(dz, dy);
  const max = leg.L1 + leg.L2 - 0.5;
  if (d > max) {
    dz *= max / d;
    dy *= max / d;
    d = max;
  }
  const cosA = (leg.L1 * leg.L1 + d * d - leg.L2 * leg.L2) / (2 * leg.L1 * d);
  const A = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const base = Math.atan2(dy, dz);
  const bend = leg.front ? -1 : 1; // para onde o joelho aponta
  const ang = base + bend * A;
  const kz = hz + Math.cos(ang) * leg.L1;
  const ky = hy + Math.sin(ang) * leg.L1;
  return { f, hip: [leg.x, hy, hz], knee: [leg.x, ky, kz], ankle: [leg.x, hy + dy, hz + dz] };
}

export function solveLeg(rig, leg, u, bob) {
  const { THREE } = rig;
  const { f, hip, knee, ankle } = legIK(leg, u, leg.hip.y + bob, leg.hip.z);
  if (leg.limb) {
    rig.kit.resweep(leg.limb, (leg.spine || legSpine)(leg.front, hip, knee, ankle), { radial: leg.spine ? 16 : 18, cap: 0.6 });
    // Pelo despenteado nas pernas do urso (franja atrás das pernas)
    if (!leg.spine) shag(leg.limb, { amount: 1.1, under: 1.6, seed: leg.x });
  }
  else {
    place(THREE, leg.upper, hip, knee);
    place(THREE, leg.lower, knee, ankle);
    leg.knee.position.set(...knee);
  }
  leg.foot.position.set(leg.x, ankle[1] - 3.2, ankle[2] + 3);
  // Na passada a pata se inclina (dedos para baixo) e no chão fica plana
  leg.foot.rotation.set(f.lift * (leg.front ? 0.9 : 0.6), 0, 0);
}

// Coluna de uma pata: começa dentro do corpo (acima do quadril), coxa grossa que
// afina no joelho, canela e o tornozelo peludo logo acima da pata
export function legSpine(front, hip, knee, ankle) {
  const [x, hy, hz] = hip;
  const top = [x * 0.6, hy + 6, hz + (front ? 1 : -3)];
  const mid = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  return [
    { p: top, w: front ? 12.5 : 14, h: front ? 12 : 13 },
    { p: hip, w: front ? 12.5 : 13.5, h: front ? 13 : 15 },
    { p: mid(hip, knee, 0.6), w: front ? 11 : 11.5, h: front ? 11 : 11.5 },
    { p: knee, w: front ? 10 : 10, h: front ? 10 : 10 },
    { p: mid(knee, ankle, 0.55), w: front ? 9.4 : 9.2, h: front ? 9.4 : 9.2 },
    { p: ankle, w: front ? 9.6 : 9.4, h: front ? 9.6 : 9.4 },
  ];
}

function applyProcedural(rig, p) {
  // De perfil, um pouco virado para a câmera
  rig.root.rotation.y = (p.facing === 'L' ? -1 : 1) * (Math.PI / 2 - 0.42);
  const u = p.u;
  // O corpo sobe e desce duas vezes por ciclo (a cada par de patas que apoia) e
  // balança um pouco de lado; a cabeça acompanha o passo das dianteiras
  const bob = Math.cos(u * TAU * 2) * 1.3;
  rig.body.position.y = bob;
  rig.body.rotation.z = Math.sin(u * TAU) * 0.03;
  for (const l of rig.legs) solveLeg(rig, l, (u + l.phase) % 1, bob);
  rig.head.rotation.x = Math.sin(u * TAU * 2 + 0.6) * 0.05;
  // Cara virada três quartos para quem olha (como nas referências)
  rig.head.rotation.y = (p.facing === 'L' ? 1 : -1) * 0.3;
  rig.jaw.rotation.x = p.mouth;
  // Ponta do gorro balançando (mais forte rugindo, quando ele corre)
  if (rig.hatTip) rig.hatTip.rotation.set(Math.sin(u * TAU * 2) * 0.18 - p.mouth * 0.4, 0, Math.sin(u * TAU) * 0.25);
  rig.lip.visible = p.mouth > 0;
  if (rig.jaw.userData.inside) rig.jaw.userData.inside.visible = p.mouth > 0;
  // Perseguindo (boca abrindo): sobrancelhas franzidas para o meio
  for (const b of rig.brows || []) b.brow.rotation.z = Math.PI / 2 + b.s * (p.mouth > 0 ? -0.45 : 0.12);
  for (const f of rig.fangs) f.visible = p.mouth > 0;
}

// ---------------------------------------------------------------- Modelo do Blender
// O urso é modelado no Blender (blender/build_bear.py: corpo, pelagem, rosto e esqueleto
// com pele) e exportado em assets/models/bear-{polar,brown}.glb. Aqui ele é carregado
// na escala do jogo (1 unidade do Blender = 100 do jogo) e as poses giram os ossos:
// pernas pela mesma cinemática inversa do passo sem patinar, corpo que sobe e balança,
// cabeça virada três quartos para a câmera, mandíbula que abre e sobrancelhas que franzem.
const GLB_FILE = { polar: 'bear-polar', santa: 'bear-polar', brown: 'bear-brown' };
export const glbUrl = (variant = 'polar') => new URL(`../../assets/models/${GLB_FILE[variant] || 'bear-polar'}.glb`, import.meta.url).href;
const glbData = {};

// Baixa o modelo da variante (o estúdio espera isso antes de fotografar)
export function prepare(variant = 'polar') {
  const file = GLB_FILE[variant] || 'bear-polar';
  return fetchGLB(glbUrl(variant)).then((g) => {
    glbData[file] = g;
    return g;
  });
}

export function build(kit, variant = 'polar') {
  const g = glbData[GLB_FILE[variant] || 'bear-polar'];
  return g ? buildGLB(kit, variant, g) : buildProcedural(kit, variant);
}

export function apply(rig, p) {
  return rig.glb ? applyGLB(rig, p) : applyProcedural(rig, p);
}

function glbMaterial(kit, name, m) {
  const { THREE } = kit;
  const f = m.pbrMetallicRoughness || {};
  const c = f.baseColorFactor || [1, 1, 1, 1];
  // A cor do glTF é linear (o espaço de trabalho do Three.js)
  const color = new THREE.Color().setRGB(c[0], c[1], c[2]);
  if (name === 'M_Fur') return new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.95, metalness: 0 });
  if (name === 'M_Shine') return new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.1, metalness: 0 });
  return new THREE.MeshStandardMaterial({ color, roughness: f.roughnessFactor ?? 0.85, metalness: 0 });
}

// Lado de cada pata de LEGS no esqueleto do Blender (L = −x, perto da câmera)
const GLB_LEGS = { '-11,false': 'BL', '-11,true': 'FL', '11,false': 'BR', '11,true': 'FR' };
const HEAD_CENTER = [0, 87, 50];
export const BROW_FROWN = 0.4;
// A mandíbula do modelo do Blender gira no canto da boca: abre mais que a do procedural
export const JAW_OPEN = 1.5;

function buildGLB(kit, variant, gltf) {
  const { THREE, group } = kit;
  const { root: scene, nodes } = instantiate(THREE, gltf, (name, m) => glbMaterial(kit, name, m));
  const root = group();
  root.rotation.order = 'YXZ';
  const model = group();
  model.scale.setScalar(100);
  root.add(model);
  model.add(scene);
  root.updateMatrixWorld(true);
  const wq = (o) => o.getWorldQuaternion(new THREE.Quaternion());
  const wp = (o) => o.getWorldPosition(new THREE.Vector3());
  const rest = new Map();
  const bone = (n) => {
    const o = nodes[n];
    if (!o) throw new Error(`urso do Blender sem o osso "${n}"`);
    rest.set(o, wq(o));
    return o;
  };
  const body = bone('body');
  const rig = {
    glb: true, kit, THREE, root, model, rest, cur: new Map(), nodes,
    body, neck: bone('neck'), head: bone('head'), jaw: bone('jaw'), tail: bone('tail'),
    parentQ: wq(body.parent), bodyPos: body.position.clone(), bodyRest: wp(body),
    legs: [], brows: [], hatTip: null,
  };
  for (const [lx, front, phase] of LEGS) {
    const key = GLB_LEGS[`${lx},${front}`];
    const up = bone(`up_${key}`);
    const low = bone(`low_${key}`);
    const foot = bone(`foot_${key}`);
    const h = wp(up);
    const k = wp(low);
    const a = wp(foot);
    rig.legs.push({
      key, x: h.x, front, phase, near: h.x < 0, up, low, foot, hipRest: h,
      hip: { y: h.y, z: h.z }, L1: h.distanceTo(k), L2: k.distanceTo(a),
    });
  }
  // Sobrancelhas: franzem girando em volta do próprio meio, no plano da cara
  const hc = new THREE.Vector3(...HEAD_CENTER);
  for (const [n, s] of [['BrowL', -1], ['BrowR', 1]]) {
    const o = nodes[n];
    const m = o?.children.find((c) => c.isMesh);
    if (!m) continue;
    m.geometry.computeBoundingBox();
    const c = m.geometry.boundingBox.getCenter(new THREE.Vector3());
    const cw = o.localToWorld(c.clone());
    const axis = cw.clone().sub(hc).normalize().applyQuaternion(wq(o).invert());
    rig.brows.push({ node: o, s, c, axis, m0: o.matrix.clone() });
  }
  rig.mouthParts = ['Fang1', 'Fang-1', 'ToothLow1', 'ToothLow-1'].map((n) => nodes[n]).filter(Boolean);

  // Gorro de Papai Noel (Natal): copa vermelha, barra de pelo, ponta articulada
  // que cai para trás e balança com o passo, e o pompom; preso ao osso da cabeça
  if (variant === 'santa') {
    const { mat, mesh, sphere } = kit;
    const red = mat('#C8242B', 0.8);
    const white = mat('#FFFFFF', 0.95);
    const hat = group(0, 101, 45);
    hat.rotation.x = -0.32;
    hat.scale.setScalar(1.45);
    hat.add(mesh(new THREE.ConeGeometry(10.5, 14, 20, 1, true), red, 0, 6, 0));
    const rim = mesh(new THREE.TorusGeometry(10.5, 3, 10, 24), white, 0, -0.5, 0);
    rim.rotation.x = Math.PI / 2;
    hat.add(rim);
    const tipG = group(0, 12, 0);
    hat.add(tipG);
    const tip = mesh(new THREE.ConeGeometry(4.2, 12, 14), red, 0, 0, -5);
    tip.rotation.x = -Math.PI / 2 - 0.4;
    tipG.add(tip);
    tipG.add(sphere(3.4, white, 0, -3.2, -10.5, 12));
    root.add(hat);
    root.updateMatrixWorld(true);
    rig.head.attach(hat);
    rig.hatTip = tipG;
  }
  return rig;
}

function applyGLB(rig, p) {
  const { THREE } = rig;
  const X = new THREE.Vector3(1, 0, 0);
  const Y = new THREE.Vector3(0, 1, 0);
  const Z = new THREE.Vector3(0, 0, 1);
  const DOWN = new THREE.Vector3(0, -1, 0);
  const Q = (axis, a) => new THREE.Quaternion().setFromAxisAngle(axis, a);
  // Gira o osso para a orientação W (no espaço do modelo); o pai já foi posto antes
  const set = (o, W) => {
    const parent = rig.cur.get(o.parent) || rig.parentQ;
    o.quaternion.copy(parent.clone().invert().multiply(W));
    rig.cur.set(o, W);
  };
  const R = (o) => rig.rest.get(o);
  rig.root.rotation.y = (p.facing === 'L' ? -1 : 1) * (Math.PI / 2 - 0.42);
  const u = p.u;
  // O corpo sobe e desce duas vezes por ciclo e balança um pouco de lado
  const bob = Math.cos(u * TAU * 2) * 1.3;
  const qRoll = Q(Z, Math.sin(u * TAU) * 0.03);
  set(rig.body, qRoll.clone().multiply(R(rig.body)));
  rig.body.position.copy(rig.bodyPos);
  rig.body.position.y += bob / 100;
  set(rig.neck, qRoll.clone().multiply(R(rig.neck)));
  // Cara virada três quartos para quem olha; a cabeça acompanha o passo
  const turn = (p.facing === 'L' ? 1 : -1) * 0.3;
  const nod = Math.sin(u * TAU * 2 + 0.6) * 0.05;
  const qHead = qRoll.clone().multiply(Q(Y, turn)).multiply(Q(X, nod));
  set(rig.head, qHead.clone().multiply(R(rig.head)));
  set(rig.jaw, qHead.clone().multiply(Q(X, p.mouth * JAW_OPEN)).multiply(R(rig.jaw)));
  set(rig.tail, qRoll.clone().multiply(Q(X, Math.sin(u * TAU * 2) * 0.15)).multiply(R(rig.tail)));
  // Pernas: quadril preso ao corpo (com o balanço), joelho e tornozelo pela cinemática inversa
  const bodyNow = rig.bodyRest.clone().add(new THREE.Vector3(0, bob, 0));
  for (const leg of rig.legs) {
    const hip = leg.hipRest.clone().sub(rig.bodyRest).applyQuaternion(qRoll).add(bodyNow);
    const ik = legIK(leg, (u + leg.phase) % 1, hip.y, hip.z);
    const h = new THREE.Vector3(...ik.hip);
    const k = new THREE.Vector3(...ik.knee);
    const a = new THREE.Vector3(...ik.ankle);
    set(leg.up, new THREE.Quaternion().setFromUnitVectors(DOWN, k.clone().sub(h).normalize()).multiply(R(leg.up)));
    set(leg.low, new THREE.Quaternion().setFromUnitVectors(DOWN, a.clone().sub(k).normalize()).multiply(R(leg.low)));
    // Na passada a pata se inclina (dedos para baixo) e no chão fica plana
    set(leg.foot, Q(X, ik.f.lift * (leg.front ? 0.9 : 0.6)).multiply(R(leg.foot)));
  }
  // Boca aberta (perseguindo): o miolo escuro e as presas aparecem
  for (const o of rig.mouthParts) o.visible = p.mouth > 0;
  // Perseguindo: sobrancelhas franzidas para o meio
  for (const b of rig.brows) {
    const a = p.mouth > 0 ? b.s * BROW_FROWN : 0;
    const m = b.m0.clone()
      .multiply(new THREE.Matrix4().makeTranslation(b.c.x, b.c.y, b.c.z))
      .multiply(new THREE.Matrix4().makeRotationAxis(b.axis, a))
      .multiply(new THREE.Matrix4().makeTranslation(-b.c.x, -b.c.y, -b.c.z));
    m.decompose(b.node.position, b.node.quaternion, b.node.scale);
  }
  if (rig.hatTip) rig.hatTip.rotation.set(Math.sin(u * TAU * 2) * 0.18 - p.mouth * 0.4, 0, Math.sin(u * TAU) * 0.25);
}
