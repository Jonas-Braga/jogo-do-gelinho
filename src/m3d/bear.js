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

export function build(kit) {
  const { mat, group, sphere, bone, capsule } = kit;
  const fur = mat('#F2EDE1', 1);
  const furShade = mat('#DCD3BF', 1);
  const furLight = mat('#FBF8EF', 1);
  const paw = mat('#CFC6B0', 0.95);
  const black = mat('#26282B', 0.35);
  const mouthIn = mat('#6B2A2A', 0.7);
  const tooth = mat('#FFFFFF', 0.4);

  const root = group();
  root.rotation.order = 'YXZ';
  const body = group();
  root.add(body);
  // Tronco: barriga longa, corcova no ombro e garupa (frente do urso = +z)
  const trunk = sphere(22, fur, 0, 40, -2, 28);
  trunk.scale.set(0.82, 0.9, 1.75);
  body.add(trunk);
  const hump = sphere(19, furLight, 0, 47, 18, 24);
  hump.scale.set(0.95, 0.95, 1.1);
  body.add(hump);
  const rump = sphere(19, fur, 0, 43, -26, 24);
  body.add(rump);
  body.add(sphere(5, furShade, 0, 46, -45, 12)); // cauda
  // Tufos de pelo no dorso
  for (let i = 0; i < 14; i++) {
    const z = -34 + i * 4.6;
    const y = 51 + Math.sin((i / 13) * Math.PI) * 7;
    const t = sphere(3 + (i % 3) * 0.6, i % 2 ? furLight : fur, (i % 2 ? 1 : -1) * 4, y, z, 10);
    body.add(t);
  }

  // Patas: coxa grossa (ombro/quadril), canela mais fina e pata achatada.
  // Ficam fora do corpo (no root) porque o pé se apoia no chão enquanto o corpo sobe e desce.
  // Fase de cada pata no ciclo: traseira de perto, dianteira de perto, traseira de longe,
  // dianteira de longe (de perto da câmera = lado −x)
  const legs = [];
  for (const [x, front, phase] of [[-11, false, 0], [-11, true, 0.25], [11, false, 0.5], [11, true, 0.75]]) {
    const m = x < 0 ? fur : furShade;
    const L1 = front ? 17 : 18;
    const L2 = front ? 15 : 14;
    const upper = capsule(front ? 8.6 : 10, L1, m);
    const lower = capsule(front ? 6.4 : 6.8, L2, m);
    const foot = sphere(7.6, paw, 0, 0, 0, 14);
    foot.scale.set(1, 0.48, 1.3);
    // Pelo do joelho (deixa a articulação arredondada)
    const knee = sphere(front ? 6.8 : 7.6, m, 0, 0, 0, 12);
    for (const o of [upper, lower, foot, knee]) root.add(o);
    legs.push({
      x, front, phase, near: x < 0, L1, L2, upper, lower, foot, knee,
      hip: { y: front ? 41 : 42, z: front ? 22 : -25 },
    });
  }

  // Pescoço e cabeça
  const head = group(0, 46, 40);
  body.add(head);
  head.add(bone(12, [0, 0, -8], [0, -1, 8], fur));
  const skull = sphere(13, furLight, 0, 0, 14, 22);
  skull.scale.set(0.95, 0.92, 1.1);
  head.add(skull);
  for (const s of [-1, 1]) {
    head.add(sphere(4.2, furShade, s * 8, 10, 10, 12)); // orelhas
    head.add(sphere(1.9, black, s * 6.2, 4, 24.2, 10)); // olhos
  }
  // Focinho e nariz
  const snout = capsule(7.2, 9, furLight);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, -3, 28);
  head.add(snout);
  const nose = sphere(3.6, black, 0, -0.5, 37.5, 12);
  nose.scale.set(1.2, 0.85, 0.8);
  head.add(nose);
  // Mandíbula (gira para baixo ao rugir), com boca escura e dentinhos
  const jaw = group(0, -7, 18);
  const lower = capsule(5.4, 10, fur);
  lower.rotation.x = Math.PI / 2;
  lower.position.set(0, -1.5, 10);
  jaw.add(lower);
  const inside = sphere(5.2, mouthIn, 0, 1.6, 12, 12);
  inside.scale.set(0.9, 0.5, 1.6);
  jaw.add(inside);
  for (const s of [-1, 1]) jaw.add(sphere(1.1, tooth, s * 3.2, 3.2, 19, 8));
  head.add(jaw);
  const lip = sphere(5, mouthIn, 0, -6.2, 26, 12);
  lip.scale.set(0.85, 0.35, 1.3);
  head.add(lip);

  return { root, body, legs, head, jaw, lip, THREE: kit.THREE };
}

// Coloca uma cápsula (eixo y) entre os pontos a e b
function place(THREE, o, a, b) {
  o.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
}

// Onde fica a pata no momento u (0 a 1) do ciclo dela: apoio no chão deslizando
// para trás, depois sobe em arco e avança
const STANCE = 0.6;
function footAt(leg, u) {
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
function solveLeg(rig, leg, u, bob) {
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
  place(THREE, leg.upper, hip, knee);
  place(THREE, leg.lower, knee, ankle);
  leg.knee.position.set(...knee);
  leg.foot.position.set(leg.x, ankle[1] - 3.2, ankle[2] + 3);
  // Na passada a pata se inclina (dedos para baixo) e no chão fica plana
  leg.foot.rotation.set(f.lift * 0.7, 0, 0);
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
  rig.lip.visible = p.mouth > 0;
}
