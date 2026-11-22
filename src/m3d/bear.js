// Urso polar da fase normal em 3D: corpo com corcova, quatro patas articuladas
// (coxa, joelho, canela e pata, posicionadas por cinemática inversa), cabeça com
// focinho e mandíbula que abre para rugir na perseguição.
//
// O passo é o de um quadrúpede de verdade: cada pata fica apoiada no chão uns 60%
// do ciclo (o corpo passa por cima dela, a pata desliza para trás) e no resto sobe
// dobrando o joelho e avança em arco. As patas se alternam em sequência: traseira
// de um lado, dianteira do mesmo lado, traseira do outro, dianteira do outro.
import { TAU } from './kit.js';

export const FRAMES = 12;
// Pés em (0, 0); a cabeça fica do lado para onde ele anda
export const box = { left: -100, right: 100, top: 110, bottom: -24 };
export const res = 2;

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

export function build(kit, variant = 'polar') {
  const { mat, group, sphere, sweep, furMaterial } = kit;
  // Pelagem: urso polar (fase normal e Natal) ou urso marrom (Floresta)
  const brown = variant === 'brown';
  const furOpts = brown
    ? { base: '#7A4E2A', light: '#9A6A3E', dark: '#4E3018', seed: 7 }
    : { base: '#EFE9DC', light: '#FFFFFF', dark: '#C8BEA6', seed: 3 };
  const fur = furMaterial({ ...furOpts, repeat: [4, 3] });
  const furShade = furMaterial({ ...furOpts, base: brown ? '#5E3C20' : '#D9D0BC', repeat: [3, 2], seed: furOpts.seed + 1 });
  const furHead = furMaterial({ ...furOpts, repeat: [3, 1.5], len: 6, strands: 700 });
  const paw = mat(brown ? '#3E2616' : '#CFC6B0', 0.95);
  const pad = mat('#2E2A28', 0.7);
  const snoutM = brown ? furMaterial({ base: '#B88C60', light: '#D0A878', dark: '#8E6640', seed: 11, repeat: [2, 1], len: 5 }) : furHead;
  const claw = mat(brown ? '#E8DCC0' : '#3A3430', 0.4);
  const black = mat('#1E2023', 0.25);
  const mouthIn = mat('#6B2A2A', 0.7);
  const tooth = mat('#FFFFFF', 0.4);
  const eyeShine = mat('#FFFFFF', 0.1, { emissive: '#FFFFFF', emissiveIntensity: 0.5 });

  const root = group();
  root.rotation.order = 'YXZ';
  const body = group();
  root.add(body);
  // Tronco e pescoço numa peça só (bearSpine)
  const spine = bearSpine(variant);
  body.add(sweep(spine, fur, { radial: 24, cap: 0.8 }));
  // Cauda curtinha
  const tail = sphere(5, furShade, 0, 50, -50, 12);
  tail.scale.set(1, 0.9, 0.8);
  body.add(tail);

  // Patas: uma peça contínua do quadril (dentro do corpo) até o tornozelo, refeita a
  // cada pose (dobra no joelho sem emenda), e a pata achatada com almofada e garras.
  // Ficam fora do corpo (no root) porque o pé se apoia no chão enquanto o corpo sobe e desce.
  const legs = [];
  for (const [lx, front, phase] of LEGS) {
    // Um pouco para dentro: a coxa sai de dentro do corpo, sem sobrar pelos lados
    const x = lx * 0.7;
    const m = x < 0 ? fur : furShade;
    const L1 = front ? 17 : 18;
    const L2 = front ? 15 : 14;
    const limb = sweep(legSpine(front, [x, 40, 0], [x, 25, 0], [x, 10, 0]), m, { radial: 16, cap: 0.6 });
    const foot = group();
    const sole = sphere(8, x < 0 ? paw : furShade, 0, 0, 0, 16);
    sole.scale.set(1, 0.5, 1.35);
    foot.add(sole);
    const padM = sphere(6.4, pad, 0, -2.6, 0.6, 12);
    padM.scale.set(0.95, 0.3, 1.2);
    foot.add(padM);
    // Garras (quatro por pata), saindo da frente da pata
    for (const cx of [-4.5, -1.5, 1.5, 4.5]) {
      const c = kit.mesh(new kit.THREE.ConeGeometry(brown ? 1.1 : 0.8, brown ? 4.2 : 2.6, 8), claw, cx, -1.2, 9.6);
      c.rotation.x = Math.PI / 2 + 0.5;
      foot.add(c);
    }
    root.add(limb, foot);
    legs.push({
      x, front, phase, near: x < 0, L1, L2, limb, foot,
      hip: { y: front ? 41 : 42, z: front ? 22 : -25 },
    });
  }

  // Cabeça: crânio e focinho numa peça só (o polar tem o focinho comprido e reto)
  const head = group(0, 46, 40);
  body.add(head);
  const skull = brown
    ? [
        { p: [0, 1, 0], w: 9, h: 9 },
        { p: [0, 3, 9], w: 13, h: 12, hb: 11 },
        { p: [0, 2, 17], w: 11.5, h: 10, hb: 10 },
      ]
    : [
        { p: [0, 1, 0], w: 8.5, h: 8.5 },
        { p: [0, 2.5, 9], w: 11.5, h: 10.5, hb: 10 },
        { p: [0, 1.5, 18], w: 10, h: 8.8, hb: 9.5 },
      ];
  head.add(sweep(skull, furHead, { radial: 22, cap: 0.7 }));
  // Focinho: sai da testa e afina até o nariz (no marrom, mais curto e mais claro)
  const muzzle = brown
    ? [
        { p: [0, 0.5, 16], w: 8.8, h: 8, hb: 8.5 },
        { p: [0, -2, 25], w: 7.2, h: 6.2, hb: 6.5 },
        { p: [0, -3, 33], w: 6, h: 5.2, hb: 5.2 },
      ]
    : [
        { p: [0, 0.5, 16], w: 8.2, h: 7.6, hb: 8.2 },
        { p: [0, -1.5, 26], w: 6.6, h: 6.2, hb: 6.4 },
        { p: [0, -3, 34], w: 5.6, h: 5, hb: 5 },
      ];
  head.add(sweep(muzzle, snoutM, { radial: 20, cap: 0.6 }));
  for (const s of [-1, 1]) {
    // Orelhas: pequenas e redondas, com o miolo escuro
    const ear = sphere(brown ? 4.4 : 3.6, furShade, s * (brown ? 8.5 : 7.5), brown ? 12 : 10.5, brown ? 7 : 6, 12);
    ear.scale.set(1, 1, 0.6);
    head.add(ear);
    const earIn = sphere(brown ? 2.6 : 2, mat(brown ? '#3A2414' : '#B8AE98', 0.9), s * (brown ? 8.5 : 7.5), brown ? 12 : 10.5, (brown ? 7 : 6) + 1.6, 10);
    earIn.scale.set(1, 1, 0.4);
    head.add(earIn);
    // Olhos pequenos e brilhantes, de lado no rosto
    const ex = brown ? 9.9 : 8.3;
    head.add(sphere(2.1, black, s * ex, 5.5, 18.5, 12));
    head.add(sphere(0.6, eyeShine, s * (ex + 0.9), 6.4, 19.6, 6));
  }
  const nose = sphere(3.4, black, 0, -0.8, 36.6, 14);
  nose.scale.set(1.25, 0.85, 0.8);
  head.add(nose);
  head.add(sphere(0.9, eyeShine, -1.2, 0.6, 38.4, 6));
  // Mandíbula (gira para baixo ao rugir), com boca escura e dentinhos
  const jaw = group(0, -7, 18);
  const lower = sweep(
    [
      { p: [0, 0, 0], w: 6.5, h: 3.4 },
      { p: [0, -0.8, 9], w: 5.4, h: 3 },
      { p: [0, -1, 15], w: 4.2, h: 2.6 },
    ],
    brown ? snoutM : furHead,
    { radial: 16, cap: 0.6 }
  );
  jaw.add(lower);
  const inside = sphere(5.2, mouthIn, 0, 1.8, 10, 12);
  inside.scale.set(0.85, 0.45, 1.5);
  jaw.add(inside);
  for (const s of [-1, 1]) {
    const fang = kit.mesh(new kit.THREE.ConeGeometry(0.9, 3, 8), tooth, s * 3, 4, 15);
    jaw.add(fang);
  }
  head.add(jaw);
  const lip = sphere(5, mouthIn, 0, -6.2, 26, 12);
  lip.scale.set(0.85, 0.35, 1.3);
  head.add(lip);
  // Presas de cima: só aparecem com a boca aberta (junto com o céu da boca)
  const fangs = [];
  for (const s of [-1, 1]) {
    const fang = kit.mesh(new kit.THREE.ConeGeometry(0.9, 3, 8), tooth, s * 3, -7.4, 31);
    fang.rotation.x = Math.PI;
    head.add(fang);
    fangs.push(fang);
  }

  // Gorro de Papai Noel (Natal): copa vermelha, barra de pelo, ponta articulada
  // que cai para trás e balança com o passo, e o pompom
  let hatTip = null;
  if (variant === 'santa') {
    const { THREE, mesh } = kit;
    const red = mat('#C8242B', 0.8);
    const white = mat('#FFFFFF', 0.95);
    const hat = group(0, 9, 11);
    hat.rotation.x = -0.35;
    head.add(hat);
    const crown = mesh(new THREE.ConeGeometry(10.5, 14, 20, 1, true), red, 0, 6, 0);
    hat.add(crown);
    const rim = mesh(new THREE.TorusGeometry(10.5, 3, 10, 24), white, 0, -0.5, 0);
    rim.rotation.x = Math.PI / 2;
    hat.add(rim);
    hatTip = group(0, 12, 0);
    hat.add(hatTip);
    const tip = mesh(new THREE.ConeGeometry(4.2, 12, 14), red, 0, 0, -5);
    tip.rotation.x = -Math.PI / 2 - 0.4;
    hatTip.add(tip);
    hatTip.add(sphere(3.4, white, 0, -3.2, -10.5, 12));
  }
  return { root, body, legs, head, jaw, lip, fangs, hatTip, kit, THREE: kit.THREE };
}

// Tronco e pescoço numa peça só (frente do urso = +z): garupa, barriga que pende um
// pouco, ombros e o pescoço que entra na cabeça (em z = 40). O polar tem a garupa mais
// alta e o pescoço comprido; o marrom, a corcova no ombro.
export function bearSpine(variant = 'polar') {
  return variant === 'brown'
    ? [
        { p: [0, 45, -46], w: 9, h: 8 },
        { p: [0, 46, -32], w: 17, h: 17, hb: 19 },
        { p: [0, 43, -10], w: 18.5, h: 18, hb: 21 },
        { p: [0, 47, 12], w: 18, h: 23, hb: 19 },
        { p: [0, 47, 28], w: 13, h: 15, hb: 13 },
        { p: [0, 46, 42], w: 9.5, h: 10 },
      ]
    : [
        { p: [0, 47, -46], w: 9, h: 8 },
        { p: [0, 48, -32], w: 17, h: 18, hb: 19 },
        { p: [0, 44, -10], w: 18, h: 17, hb: 21 },
        { p: [0, 45, 12], w: 17, h: 19, hb: 19 },
        { p: [0, 46, 30], w: 11.5, h: 12.5, hb: 12 },
        { p: [0, 45, 44], w: 9, h: 9.5 },
      ];
}

// Modelo do urso com uma variante ('polar' ou 'santa', com o gorro do Natal)
const variants = new Map();
export function withVariant(v = 'polar') {
  if (!variants.has(v)) variants.set(v, { box, res, poses, apply, bearPose, build: (kit) => build(kit, v) });
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
  return { y: ground + lift * (leg.front ? 10 : 8), z: z0 + stride * (-0.5 + e), lift };
}

// Cinemática inversa de dois ossos no plano (z, y). A dianteira dobra para trás
// (cotovelo/pulso), a traseira dobra para a frente (joelho)
export function solveLeg(rig, leg, u, bob) {
  const { THREE } = rig;
  const hy = leg.hip.y + bob;
  const hz = leg.hip.z;
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
  const hip = [leg.x, hy, hz];
  const knee = [leg.x, ky, kz];
  const ankle = [leg.x, hy + dy, hz + dz];
  if (leg.limb) rig.kit.resweep(leg.limb, (leg.spine || legSpine)(leg.front, hip, knee, ankle), { radial: 16, cap: 0.6 });
  else {
    place(THREE, leg.upper, hip, knee);
    place(THREE, leg.lower, knee, ankle);
    leg.knee.position.set(...knee);
  }
  leg.foot.position.set(leg.x, ankle[1] - 3.2, ankle[2] + 3);
  // Na passada a pata se inclina (dedos para baixo) e no chão fica plana
  leg.foot.rotation.set(f.lift * 0.7, 0, 0);
}

// Coluna de uma pata: começa dentro do corpo (acima do quadril), coxa grossa que
// afina no joelho, canela e o tornozelo peludo logo acima da pata
export function legSpine(front, hip, knee, ankle) {
  const [x, hy, hz] = hip;
  const top = [x * 0.6, hy + 6, hz + (front ? 1 : -3)];
  const mid = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  return [
    { p: top, w: front ? 10 : 12, h: front ? 9 : 11 },
    { p: hip, w: front ? 10 : 11.5, h: front ? 11 : 13.5 },
    { p: mid(hip, knee, 0.6), w: front ? 8 : 9, h: front ? 8.5 : 9.5 },
    { p: knee, w: front ? 6.6 : 6.8, h: front ? 6.8 : 7 },
    { p: mid(knee, ankle, 0.55), w: front ? 6 : 5.8, h: front ? 6.2 : 6 },
    { p: ankle, w: front ? 6.4 : 6.2, h: front ? 6.4 : 6.2 },
  ];
}

export function apply(rig, p) {
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
  rig.jaw.rotation.x = p.mouth;
  // Ponta do gorro balançando (mais forte rugindo, quando ele corre)
  if (rig.hatTip) rig.hatTip.rotation.set(Math.sin(u * TAU * 2) * 0.18 - p.mouth * 0.4, 0, Math.sin(u * TAU) * 0.25);
  rig.lip.visible = p.mouth > 0;
  for (const f of rig.fangs) f.visible = p.mouth > 0;
}
