// Personagem da fase normal (parka) em 3D: modelo, poses e qual foto usar em cada momento.
import { DEPTH, PALETTE as C } from '../config.js';
import { POWERS } from '../powers.js';
import { TAU } from './kit.js';

const M = DEPTH.model3d;
const frameOf = (phase, n) => ((Math.floor((phase / TAU) * n) % n) + n) % n;

// Caixa da foto em unidades do mundo (a mesma do volume do jogador): pés em (0, 0)
export const box = { left: -64, right: 64, top: 150, bottom: -26 };

// Qual foto usar para o jogador agora (ou null = desenho 2D). Função pura (testável).
// Agachar (entrando no iglu) e tremer de frio são feitos na hora, por cima da foto.
export function playerPose(p, t) {
  const facing = p.facing < 0 ? 'L' : 'R';
  if (p.back) {
    if (p.moving) return { key: `back${frameOf(t * 13, M.runFrames)}`, anim: 'run' };
    return { key: 'backIdle', anim: 'idle' };
  }
  switch (p.state) {
    case 'stand':
      if (p.kickT > 0) {
        const k = Math.sin((1 - p.kickT / POWERS.kickTime) * Math.PI);
        return { key: `kick${Math.min(3, Math.floor(Math.max(0, k) * 4))}${facing}`, anim: 'kick' };
      }
      if (p.moving) return { key: `run${frameOf(t * 13, M.runFrames)}${facing}`, anim: 'run' };
      return { key: `idle${facing}`, anim: 'idle' };
    case 'enter':
      return { key: p.moving ? `run${frameOf(t * 13, M.runFrames)}${facing}` : `idle${facing}`, anim: p.moving ? 'run' : 'idle' };
    case 'freeze':
      return { key: `cold${facing}`, anim: 'freeze' };
    case 'jump':
      return { key: `jump${facing}`, anim: 'jump' };
    case 'swim':
      return { key: `swim${frameOf(t * 6, 4)}${facing}`, anim: 'swim' };
    case 'drown':
      return { key: `scared${frameOf(t * 30, 2)}${facing}`, anim: 'drown' };
    case 'flee':
      if (p.moving) return { key: `flee${frameOf(t * 24, M.runFrames)}${facing}`, anim: 'flee' };
      return { key: `scared${frameOf(t * 30, 2)}${facing}`, anim: 'scared' };
    default:
      return null;
  }
}

// Todas as fotos e a pose de cada uma. Braços e pernas em [perto da câmera, longe];
// ângulos de braço como no desenho 2D (positivo = para trás, −2 = erguido à frente).
export function poses() {
  const out = [];
  const n = M.runFrames;
  const walk = (i, f, extra = {}) => {
    const ph = ((i + 0.5) / n) * TAU;
    const s = Math.sin(ph);
    return { facing: f, legs: [s * 0.55, -s * 0.55], knees: [Math.max(0, -s) * 0.7, Math.max(0, s) * 0.7], arms: [-s * 0.6, s * 0.6], bob: Math.abs(Math.cos(ph)) * 1.5, face: 'calm', ...extra };
  };
  for (const f of ['R', 'L']) {
    out.push({ key: `idle${f}`, facing: f, arms: [0.2, 0.15], face: 'calm' });
    out.push({ key: `cold${f}`, facing: f, arms: [-0.45, -0.3], hug: true, face: 'cold' });
    out.push({ key: `jump${f}`, facing: f, legs: [0.5, 0.9], knees: [0.8, 1.3], arms: [-2.0, -2.3], elbows: [0.45, 0.35], face: 'calm' });
    for (let i = 0; i < n; i++) {
      out.push({ key: `run${i}${f}`, ...walk(i, f) });
      const w = walk(i, f);
      const fl = (i % 2 ? 1 : -1) * 0.35;
      out.push({ key: `flee${i}${f}`, ...w, legs: w.legs.map((v) => v * 1.35), knees: w.knees.map((v) => v * 1.3), arms: null, up: [fl, -fl], bob: w.bob * 1.2, face: 'scared' });
    }
    for (let i = 0; i < 2; i++) {
      const fl = (i ? 1 : -1) * 0.35;
      out.push({ key: `scared${i}${f}`, facing: f, legs: [0.3, 0.5], knees: [0.5, 0.9], up: [fl, -fl], face: 'scared' });
    }
    // Chute: a perna da frente sobe esticada (4 alturas)
    for (let i = 0; i < 4; i++) {
      const k = (i + 0.5) / 4;
      out.push({ key: `kick${i}${f}`, facing: f, legs: [1.55 * k, -0.15], arms: [0.5 * k, -0.6 * k], face: 'calm' });
    }
    // Boiando: braços remando à frente (4 quadros)
    for (let i = 0; i < 4; i++) {
      const s = Math.sin(((i + 0.5) / 4) * TAU);
      out.push({ key: `swim${i}${f}`, facing: f, legs: [0.4, -0.2], arms: [-1.4 - s * 0.5, -1.4 + s * 0.5], elbows: [0.5 + s * 0.4, 0.5 - s * 0.4], face: 'calm' });
    }
  }
  // De costas (entrando no iglu)
  out.push({ key: 'backIdle', facing: 'B', arms: [0.15, 0.15], face: 'none' });
  for (let i = 0; i < n; i++) out.push({ key: `back${i}`, ...walk(i, 'B'), face: 'none' });
  return out;
}

export function build(kit) {
  const { THREE, mat, mesh, group, capsule, sphere, furRing, lathe } = kit;
  const parka = mat(C.parka, 0.8);
  const parkaDark = mat(C.parkaShade, 0.85);
  const fur = mat(C.fur, 1);
  const furShade = mat(C.furShade, 1);
  const boots = mat(C.boots, 0.6);
  const pants = mat(C.pants, 0.9);
  const mitten = mat('#5A3E2A', 0.9);
  const skin = mat('#E3A87E', 0.7);
  const ink = mat(C.ink, 0.3);
  const white = mat('#FFFFFF', 0.3);
  const cheek = mat('#E07A68', 0.8, { transparent: true, opacity: 0.55 });
  const coldCheek = mat('#7FA6E6', 0.8, { transparent: true, opacity: 0.55 });
  const mouthM = mat('#5A1E1A', 0.6);
  const browM = mat('#5A3A26', 0.8);

  const root = group();
  root.rotation.order = 'YXZ';
  const body = group();
  root.add(body);

  // Pernas (quadril em y = 20): calça, bota e barra de pelo; joelho dobra a canela
  const legs = [];
  for (const side of [-1, 1]) {
    const hip = group(side * 5, 20, 0);
    const thigh = capsule(4.2, 4, pants);
    thigh.position.y = -4;
    hip.add(thigh);
    const knee = group(0, -8, 0);
    const boot = capsule(5, 4, boots);
    boot.rotation.x = Math.PI / 2;
    boot.position.set(0, -6.5, 1.8);
    boot.scale.set(1, 1.15, 0.95);
    knee.add(boot);
    const trim = furRing(5.2, 2, 10, fur, furShade);
    trim.position.y = -1.5;
    knee.add(trim);
    hip.add(knee);
    body.add(hip);
    legs.push({ hip, knee });
  }

  // Parka em A (torneada), com bolso e barra de pelo
  const coat = lathe([[0, 13], [17, 13], [16.2, 18], [14, 28], [12, 38], [10, 45], [7, 48.5], [0, 49]], parka);
  coat.scale.set(1, 1, 0.82);
  body.add(coat);
  const pocket = mesh(new THREE.TorusGeometry(9, 0.45, 6, 24, Math.PI * 0.7), parkaDark);
  pocket.rotation.set(-0.25, 0, Math.PI * 1.15);
  pocket.position.set(0, 33, 11.2);
  body.add(pocket);
  const hem = furRing(16.6, 3.3, 22, fur, furShade, 1, 0.84);
  hem.position.y = 13.5;
  body.add(hem);

  // Braços (ombro em y = 42): manga do braço, cotovelo, antebraço, punho de pelo e luva
  const arm = (side) => {
    const m = side < 0 ? parka : parkaDark;
    const sh = group(side * 11, 42, 0);
    const upper = capsule(4.5, 4.5, m);
    upper.position.y = -4.6;
    sh.add(upper);
    const elbow = group(0, -9.2, 0);
    sh.add(elbow);
    elbow.add(sphere(4.3, m, 0, 0, 0, 12));
    const fore = capsule(4.2, 4, m);
    fore.position.y = -4.4;
    elbow.add(fore);
    const cuff = furRing(4.6, 1.8, 9, fur, furShade);
    cuff.position.y = -7;
    elbow.add(cuff);
    elbow.add(sphere(4.8, mitten, 0, -10.8, 0, 16));
    body.add(sh);
    sh.userData.elbow = elbow;
    return sh;
  };
  const arms = [arm(-1), arm(1)];

  // Cabeça (um pouco maior que o corpo pede, como no desenho 2D): capuz, pelo, rosto
  const head = group(0, 59, 0);
  head.scale.setScalar(1.12);
  body.add(head);
  const hood = sphere(14, parka, 0, 0, 0, 28);
  hood.scale.set(1, 1.02, 0.95);
  head.add(hood);
  const ring = furRing(10.2, 3.7, 18, fur, furShade);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 1.5, 10.2);
  head.add(ring);
  const face = sphere(8, skin, 0, 1.5, 10.6, 24);
  face.scale.set(1, 1.05, 0.62);
  head.add(face);
  head.add(sphere(1.45, mat('#C98A66', 0.6), 0, 0.8, 15.8, 10));

  // Expressões: calma, com frio (bochechas azuladas) e de susto
  const calm = group();
  const cold = group();
  for (const s of [-1, 1]) {
    for (const g of [calm, cold]) {
      const eye = capsule(1.15, 1.6, ink, s * 2.9, 3.3, 15.1);
      g.add(eye);
      const ck = sphere(2, g === calm ? cheek : coldCheek, s * 4.7, -0.8, 14.3, 10);
      ck.scale.z = 0.4;
      g.add(ck);
    }
  }
  const smile = mesh(new THREE.TorusGeometry(1.9, 0.45, 6, 12, Math.PI * 0.8), mouthM);
  smile.rotation.z = Math.PI * 1.1;
  smile.position.set(0, -2.2, 15.4);
  calm.add(smile);
  const chatter = capsule(0.45, 2.6, mouthM, 0, -2.6, 15.4);
  chatter.rotation.z = Math.PI / 2;
  cold.add(chatter);
  const scared = group();
  for (const s of [-1, 1]) {
    const ew = sphere(2.7, white, s * 3, 3.3, 14.9, 12);
    ew.scale.z = 0.5;
    scared.add(ew);
    scared.add(sphere(1.25, ink, s * 3, 3.3, 16.2, 10));
    const brow = capsule(0.45, 2.8, browM, s * 3.1, 7, 15);
    brow.rotation.z = Math.PI / 2 + s * 0.3;
    scared.add(brow);
  }
  const oh = sphere(1.9, mouthM, 0, -3.2, 15.3, 12);
  oh.scale.set(1, 1.35, 0.5);
  scared.add(oh);
  for (const g of [calm, cold, scared]) head.add(g);

  return { root, body, legs, arms, head, faces: { calm, cold, scared } };
}

export function apply(rig, p) {
  const yaw = p.facing === 'B' ? Math.PI : (p.facing === 'L' ? -1 : 1) * M.yaw;
  rig.root.rotation.y = yaw;
  rig.body.position.y = p.bob || 0;
  // Qual lado do modelo fica perto da câmera: virado para a direita é o lado −x
  const near = p.facing === 'L' ? [1, 0] : [0, 1];
  const val = (arr, i) => (arr ? arr[near.indexOf(i)] || 0 : 0);
  // Frente do modelo = +z. Perna para frente: gira em x com ângulo negativo;
  // o joelho dobra jogando o pé para trás.
  rig.legs.forEach((l, i) => {
    l.hip.rotation.set(-val(p.legs, i), 0, 0);
    l.knee.rotation.set(val(p.knees, i), 0, 0);
  });
  rig.arms.forEach((a, i) => {
    const side = i ? 1 : -1;
    const elbow = a.userData.elbow;
    if (p.up) {
      // Erguidos em "V" acima da cabeça, sacudindo (esticados, como no desenho 2D)
      a.rotation.set(-0.35, 0, side * (Math.PI - 0.32 + val(p.up, i) * 0.6));
      a.scale.set(1, 1.4, 1);
      elbow.rotation.set(-0.25 - Math.abs(val(p.up, i)) * 0.4, 0, 0);
    } else {
      // Com frio, os braços se fecham na frente do corpo (cotovelos bem dobrados)
      const ang = val(p.arms, i);
      a.rotation.set(ang, p.hug ? -side * 0.5 : 0, side * (p.hug ? -0.25 : 0.12));
      a.scale.set(1, 1, 1);
      // O antebraço dobra mais quando o braço vai para a frente (como ao correr)
      const bend = p.hug ? 1.7 : p.elbows ? val(p.elbows, i) : 0.3 + Math.max(0, -ang) * 0.75;
      elbow.rotation.set(-Math.min(2.2, bend), 0, 0);
    }
  });
  for (const [k, g] of Object.entries(rig.faces)) g.visible = p.face === k;
}
