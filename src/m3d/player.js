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
    case 'jump': {
      // De frente para a câmera pulando para a frente (para a fileira de baixo), de
      // costas voltando (para cima); com ← ou → apertado, virado na diagonal do pulo
      if (p.from == null || p.to == null || p.to === p.from) return { key: `jump${facing}`, anim: 'jump' };
      const side = p.moving ? facing : '';
      return { key: `jump${p.to > p.from ? 'F' : 'B'}${side}`, anim: 'jump' };
    }
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
    out.push({ key: `jump${f}`, facing: f, ...JUMP });
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
  // Pulo entre as fileiras: de frente (F, para a câmera) ou de costas (B), reto ou na
  // diagonal para o lado em que ele vai (R/L). yaw: para onde a frente do corpo aponta
  // Os braços abrem para os lados e para cima (de frente, erguidos para a frente cobririam o rosto)
  for (const [k, yaw] of Object.entries(JUMP_YAW)) {
    out.push({ key: `jump${k}`, facing: k.length > 1 ? k[1] : 'R', yaw, ...JUMP, arms: null, spread: [2.1, 2.3], face: k[0] === 'B' ? 'none' : 'calm' });
  }
  // De costas (entrando no iglu)
  out.push({ key: 'backIdle', facing: 'B', arms: [0.15, 0.15], face: 'none' });
  for (let i = 0; i < n; i++) out.push({ key: `back${i}`, ...walk(i, 'B'), face: 'none' });
  return out;
}

// Pose do pulo (pernas encolhidas, braços erguidos) e a direção do corpo em cada pulo
const JUMP = { legs: [0.5, 0.9], knees: [0.8, 1.3], arms: [-2.0, -2.3], elbows: [0.45, 0.35], face: 'calm' };
export const JUMP_DIAGONAL = 0.6;
export const JUMP_YAW = {
  F: 0, FR: JUMP_DIAGONAL, FL: -JUMP_DIAGONAL,
  B: Math.PI, BR: Math.PI - JUMP_DIAGONAL, BL: Math.PI + JUMP_DIAGONAL,
};

// Perfil torneado do casaco: [raio, altura]
const COAT = [[0, 13], [17, 13], [16.2, 18], [14, 28], [12, 38], [10, 45], [7, 48.5], [0, 49]];

// Roupas: a parka da fase normal e o suéter natalino (Natal)
const KNIT_RED = '#C62F2F';
const KNIT_WHITE = '#F7F2E8';
const KNIT_GREEN = '#1F7A45';

// Textura de tricô do suéter, na mesma posição da estampa 2D (faixa branca com
// zigue-zague verde no peito, pontinhos de neve e o floco na barriga). No torneado,
// u dá a volta (u = 0 é a frente) e v vai de ponto em ponto do perfil, de baixo para cima.
function knitTexture(THREE) {
  const W = 512;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  // altura (unidades do mundo) → v (pelo índice dos pontos do perfil) → y da textura
  const vOf = (h) => {
    for (let i = 0; i < COAT.length - 1; i++) {
      const [, a] = COAT[i];
      const [, b] = COAT[i + 1];
      if (h >= a && h <= b && b > a) return (i + (h - a) / (b - a)) / (COAT.length - 1);
    }
    return h < COAT[0][1] ? 0 : 1;
  };
  const yOf = (h) => (1 - vOf(h)) * H;
  g.fillStyle = KNIT_RED;
  g.fillRect(0, 0, W, H);
  // Pontos de tricô (textura leve)
  g.fillStyle = 'rgba(0, 0, 0, 0.08)';
  for (let y = 0; y < H; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < W; x += 4) g.fillRect(x, y, 2, 2);
  // Faixa branca (alturas 29 a 38) com zigue-zague verde embaixo
  const y38 = yOf(38);
  const y29 = yOf(29);
  g.fillStyle = KNIT_WHITE;
  g.fillRect(0, y38, W, y29 - y38);
  g.fillStyle = KNIT_GREEN;
  const zig = (y29 - y38) * 0.55;
  g.beginPath();
  g.moveTo(0, y29);
  for (let x = 0; x <= W; x += 24) {
    g.lineTo(x, y29 - zig);
    g.lineTo(x + 12, y29 - zig * 0.35);
  }
  g.lineTo(W, y29);
  g.closePath();
  g.fill();
  // Pontinhos de neve acima e abaixo da faixa
  g.fillStyle = KNIT_WHITE;
  for (let x = 8; x < W; x += 28) {
    g.fillRect(x, yOf(43) - 3, 6, 6);
    g.fillRect(x + 14, yOf(24) - 3, 6, 6);
  }
  // Floco de neve na barriga (na frente, um pouco para o lado em que ele anda)
  g.strokeStyle = KNIT_WHITE;
  g.lineWidth = 3;
  const fx = W * 0.06;
  const fy = yOf(21);
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3;
    g.beginPath();
    g.moveTo(fx + Math.cos(a) * 14, fy + Math.sin(a) * 9);
    g.lineTo(fx - Math.cos(a) * 14, fy - Math.sin(a) * 9);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Flanela xadrez do lenhador (camisa e mangas): vermelho com faixas escuras cruzadas
// e fios claros, como a estampa 2D
function plaidTexture(THREE) {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#B42E26';
  g.fillRect(0, 0, S, S);
  g.fillStyle = 'rgba(30, 10, 10, 0.5)';
  for (let x = 0; x < S; x += 32) g.fillRect(x, 0, 13, S);
  for (let y = 0; y < S; y += 32) g.fillRect(0, y, S, 13);
  g.fillStyle = 'rgba(255, 220, 200, 0.22)';
  for (let x = 18; x < S; x += 32) g.fillRect(x, 0, 3, S);
  for (let y = 18; y < S; y += 32) g.fillRect(0, y, S, 3);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  return tex;
}

// ---- Surfista (Praia): estampa florida da camisa (verde-água com hibiscos rosa e
// brancos e folhinhas), cabeça sem capuz com cabelo loiro bagunçado e os óculos
function floralTexture(THREE) {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#1FB5B0';
  g.fillRect(0, 0, S, S);
  let seed = 41;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = 'rgba(30, 120, 60, 0.75)';
  for (let i = 0; i < 30; i++) {
    g.beginPath();
    g.ellipse(rnd() * S, rnd() * S, 9, 4, rnd() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 22; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    g.fillStyle = i % 2 ? '#FFFFFF' : '#FF6FA8';
    for (let k = 0; k < 5; k++) {
      const a = (k * Math.PI * 2) / 5 + i;
      g.beginPath();
      g.arc(x + Math.cos(a) * 7, y + Math.sin(a) * 7, 5.5, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#FFD23F';
    g.beginPath();
    g.arc(x, y, 3.4, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  return tex;
}

function buildSurfHead(kit, head, skin) {
  const { THREE, mat, mesh, group, sphere } = kit;
  const hair = mat('#F2C94C', 0.75);
  const hairDark = mat('#D9A830', 0.8);
  // Cabeça numa peça só (o rosto faz parte do crânio, sem emenda de máscara)
  head.add(faceSkull(kit, skin));
  for (const s of [-1, 1]) head.add(sphere(2.8, skin, s * 12, -0.5, 2, 12));
  // Cabelo: calota na nuca e no alto e tufos espetados para todo lado
  const back = sphere(12.8, hair, 0, 1.5, -2, 24);
  back.scale.set(1, 0.95, 0.92);
  head.add(back);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(13, 28, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), hair);
  cap.position.set(0, 1.2, 0.8);
  cap.castShadow = cap.receiveShadow = true;
  head.add(cap);
  const tufts = [[-8, 11, 4, -0.5, 0.4], [-3, 13, 6, -0.2, 0.1], [3, 13, 5, 0.25, -0.1], [8, 11, 3, 0.55, -0.3],
    [-6, 12, -4, -0.4, -0.5], [0, 13.5, -1, 0, -0.3], [6, 12, -5, 0.4, -0.6], [0, 8, -10, 0, -1.2], [-9, 7, -7, -0.7, -0.9], [9, 7, -7, 0.7, -0.9]];
  for (const [i, [x, y, z, rz, rx]] of tufts.entries()) {
    const t = mesh(new THREE.ConeGeometry(3.2, 9, 8), i % 3 ? hair : hairDark, x, y, z);
    t.rotation.set(rx, 0, -rz);
    head.add(t);
  }
  // Franja caindo na testa (de lado)
  const fringe = sphere(5.5, hair, 4, 8.6, 9.5, 14);
  fringe.scale.set(1.4, 0.55, 0.6);
  fringe.rotation.z = -0.35;
  head.add(fringe);
  // Óculos escuros (posição ajustada em apply: nos olhos ou na testa)
  const glasses = group(0, 3.4, 15.2);
  head.add(glasses);
  const lens = mat('#1D2A33', 0.1, { metalness: 0.3 });
  for (const s of [-1, 1]) {
    const l = sphere(2.9, lens, s * 3.3, 0, 0, 14);
    l.scale.set(1.15, 0.8, 0.35);
    glasses.add(l);
    const shine = sphere(0.8, mat('#FFFFFF', 0.1, { emissive: '#FFFFFF', emissiveIntensity: 0.4 }), s * 3.3 - 1, 0.8, 0.9, 8);
    shine.castShadow = false;
    glasses.add(shine);
    const arm = kit.bone(0.45, [s * 6.4, 0.3, -0.5], [s * 11.6, 0.6, -9], mat('#FF6FA8', 0.5));
    glasses.add(arm);
  }
  glasses.add(kit.bone(0.45, [-1.2, 0.4, 0.4], [1.2, 0.4, 0.4], mat('#FF6FA8', 0.5)));
  return glasses;
}

// ---- Homem das cavernas (Dinossauros): túnica de pele de onça presa num ombro só,
// barra em pontas de pele e cinto de cipó, braços e canelas de fora, pés enrolados
// em pele e a cabeleira desgrenhada com um ossinho espetado
function leopardTexture(THREE) {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#E09A3A';
  g.fillRect(0, 0, S, S);
  let seed = 61;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 40; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    g.fillStyle = '#5A3410';
    g.beginPath();
    g.ellipse(x, y, 7 + rnd() * 3, 5 + rnd() * 2, rnd() * 3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#F7C070';
    g.beginPath();
    g.ellipse(x + 0.5, y, 3, 2.2, 0, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  return tex;
}

function buildTunic(kit, body, skin, leopard) {
  const { THREE, mat, mesh, sphere } = kit;
  // Ombro direito de fora (pele por cima da túnica nesse lado)
  const bare = sphere(7.4, skin, 7.2, 46, 0.6, 16);
  bare.scale.set(1, 0.7, 1.05);
  body.add(bare);
  // Alça da túnica passando pelo ombro esquerdo
  const strap = kit.bone(2.8, [-8, 49, 6], [-8.5, 49, -6], leopard);
  body.add(strap);
  // Barra em pontas de pele e cinto de cipó com nó
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const tip = mesh(new THREE.ConeGeometry(3.4, 6, 4), mat('#9A5A18', 0.95), Math.cos(a) * 16.6, 12, Math.sin(a) * 13.6);
    tip.rotation.x = Math.PI;
    body.add(tip);
  }
  const belt = mesh(new THREE.TorusGeometry(14.2, 1.3, 8, 36), mat('#5A7A2A', 0.8), 0, 27, 0);
  belt.rotation.x = Math.PI / 2;
  belt.scale.set(1, 0.84, 1);
  body.add(belt);
  body.add(sphere(2.2, mat('#4A6A22', 0.8), 4, 27, 11.4, 10));
}

function buildCaveHead(kit, head, skin) {
  const { THREE, mat, mesh, group, sphere } = kit;
  head.add(faceSkull(kit, skin));
  for (const s of [-1, 1]) {
    const ear = sphere(2.4, skin, s * 11.9, 0, 1.6, 12);
    ear.scale.set(0.5, 1, 0.8);
    head.add(ear);
  }
  const hairM = mat('#3A2414', 0.9, { side: THREE.DoubleSide });
  // Cabeleira: calota no alto e atrás (até as orelhas), mechas caindo na nuca e a
  // franja grossa na testa; os tufos de cima ficam num grupo que se ergue no susto
  const cap = new THREE.Mesh(new THREE.SphereGeometry(13, 32, 16, Math.PI + 0.15, Math.PI - 0.3, 0, 0.62 * Math.PI), hairM);
  cap.position.set(0, -0.5, 1.3);
  cap.castShadow = cap.receiveShadow = true;
  head.add(cap);
  const top = new THREE.Mesh(new THREE.SphereGeometry(13, 32, 10, 0, Math.PI * 2, 0, 0.28 * Math.PI), hairM);
  top.position.set(0, -0.5, 1.3);
  top.castShadow = true;
  head.add(top);
  for (let i = 0; i < 12; i++) {
    const a = Math.PI * (1.08 + (i / 11) * 0.84);
    const tuft = mesh(new THREE.ConeGeometry(2.6, 8, 6), hairM, -Math.cos(a) * 12.6, -6 - (i % 3), Math.sin(a) * 12.6 + 1.3);
    tuft.rotation.set(Math.PI - Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
    head.add(tuft);
  }
  // Franja grossa caindo de lado na testa
  const fringe = sphere(6, hairM, 2.5, 9.8, 10.2, 14);
  fringe.scale.set(1.5, 0.55, 0.55);
  fringe.rotation.z = -0.25;
  head.add(fringe);
  const spikes = group();
  head.add(spikes);
  const tufts = [[-8, 10, 2, 0.5, 0.2], [-3, 12.5, 4, 0.15, 0.4], [2, 13, 1, -0.1, 0.1], [7, 11, 3, -0.5, 0.25], [-5, 11, -5, 0.35, -0.4], [4, 11.5, -6, -0.3, -0.45], [0, 9, -10, 0, -0.9]];
  for (const [i, [x, y, z, rz, rx]] of tufts.entries()) {
    const t = mesh(new THREE.ConeGeometry(3.4, 10, 6), i % 2 ? hairM : mat('#2A180C', 0.9), x, y, z);
    t.rotation.set(rx, 0, rz);
    spikes.add(t);
  }
  // Ossinho espetado no cabelo
  const bone = group(-2, 14, 0);
  bone.rotation.z = 0.5;
  spikes.add(bone);
  const boneM = mat('#F2E8D0', 0.5);
  bone.add(kit.bone(1.4, [-6, 0, 0], [6, 0, 0], boneM));
  for (const s of [-1, 1]) for (const k of [-1, 1]) bone.add(sphere(2, boneM, s * 7, k * 1.4, 0, 10));
  return spikes;
}

// ---- Bruxinho (Halloween): manto roxo com estrelinhas e luas douradas, meias
// listradas de laranja e preto, chapéu pontudo de aba larga com a ponta dobrada
function robeTexture(THREE) {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#6A3FA0';
  g.fillRect(0, 0, S, S);
  let seed = 23;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    g.fillStyle = '#FFD86A';
    if (i % 3 === 0) {
      g.beginPath();
      g.arc(x, y, 8, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#6A3FA0';
      g.beginPath();
      g.arc(x + 4, y - 2.5, 7, 0, Math.PI * 2);
      g.fill();
    } else {
      g.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (k * Math.PI) / 5;
        const d = k % 2 ? 3 : 7.5;
        g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
      }
      g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  return tex;
}

function stripeTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 64;
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#F28C28' : '#1C1626';
    g.fillRect(0, i * 8, 16, 8);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Crânio com o rosto modelado: esfera cuja frente se estufa suavemente até onde ficava
// a esfera do rosto (olhos, nariz e bochechas continuam nos mesmos lugares)
function faceSkull(kit, skin) {
  const { THREE } = kit;
  const geo = new THREE.SphereGeometry(12.2, 40, 28);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = v.clone().normalize();
    // Estufa a frente (bochechas e testa) e afina um pouco o queixo
    const front = Math.max(0, n.z) ** 2.2;
    const chin = n.y < -0.4 ? (n.y + 0.4) * 0.12 : 0;
    v.multiplyScalar(1 + front * 0.17 + chin * front);
    pos.setXYZ(i, v.x, v.y * 1.03, v.z);
  }
  geo.computeVertexNormals();
  const o = new THREE.Mesh(geo, skin);
  o.position.set(0, -0.3, 1.5);
  o.castShadow = o.receiveShadow = true;
  return o;
}

function buildWizardHead(kit, head, skin) {
  const { THREE, mat, mesh, group, sphere } = kit;
  // Cabeça numa peça só: o rosto é um volume suave da própria cabeça (sem a esfera
  // do rosto por cima, que sem capuz em volta aparecia como uma máscara)
  head.add(faceSkull(kit, skin));
  // Orelhas pequenas e achatadas
  for (const s of [-1, 1]) {
    const ear = sphere(2.4, skin, s * 11.9, 0, 1.6, 12);
    ear.scale.set(0.5, 1, 0.8);
    head.add(ear);
  }
  // Cabelo castanho: calota só na parte de trás (de uma orelha à outra, por trás),
  // e mechas saindo por baixo da aba e na nuca
  const hairM = mat('#5A3A26', 0.85, { side: THREE.DoubleSide });
  const cap = new THREE.Mesh(new THREE.SphereGeometry(12.75, 32, 16, Math.PI + 0.15, Math.PI - 0.3, 0.12 * Math.PI, 0.5 * Math.PI), hairM);
  cap.position.set(0, -0.5, 1.3);
  cap.castShadow = cap.receiveShadow = true;
  head.add(cap);
  // Topo da cabeça (fica sob o chapéu; aparece despenteado quando o chapéu pula no susto)
  const top = new THREE.Mesh(new THREE.SphereGeometry(12.75, 32, 10, 0, Math.PI * 2, 0, 0.3 * Math.PI), hairM);
  top.position.set(0, -0.5, 1.3);
  top.castShadow = top.receiveShadow = true;
  head.add(top);
  for (const [x, z, rz, rx] of [[-5, 4, 0.5, 0.3], [0, 6, 0, 0.5], [5, 3, -0.5, 0.25], [-3, -3, 0.3, -0.3], [4, -4, -0.35, -0.35]]) {
    const tuft = mesh(new THREE.ConeGeometry(2.4, 6.5, 6), hairM, x, 12.2, z);
    tuft.rotation.set(rx, 0, rz);
    head.add(tuft);
  }
  for (let i = 0; i < 11; i++) {
    const a = Math.PI * (1.1 + (i / 10) * 0.8); // de uma orelha à outra, por trás
    const x = -Math.cos(a) * 12.4;
    const z = Math.sin(a) * 12.4 + 1.3;
    const tuft = mesh(new THREE.ConeGeometry(2.2, 6, 6), hairM, x, -4.4 - (i % 2) * 0.8, z);
    tuft.rotation.set(Math.PI - Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
    head.add(tuft);
  }
  // Chapéu (posição ajustada em apply: na cabeça ou pulando no susto)
  const hat = group(0, 9.5, 0);
  head.add(hat);
  const felt = mat('#4A2878', 0.85, { side: THREE.DoubleSide });
  const brim = mesh(new THREE.CylinderGeometry(20, 20.5, 1.4, 40), mat('#3A1E60', 0.85), 0, 0, 0);
  hat.add(brim);
  // Cone com a ponta dobrada para trás: três segmentos que vão afinando e entortando
  const seg = (r0, r1, h, y, z, rx, parent) => {
    const g = group(0, y, z);
    g.rotation.x = rx;
    parent.add(g);
    g.add(mesh(new THREE.CylinderGeometry(r1, r0, h, 24, 1, true), felt, 0, h / 2, 0));
    return g;
  };
  const s1 = seg(12, 8.4, 13, 0.6, 0, -0.08, hat);
  const s2 = seg(8.4, 4.6, 11, 13, 0, -0.35, s1);
  const s3 = seg(4.6, 0.4, 10, 11, 0, -0.75, s2);
  s3.add(sphere(1.8, mat('#FFD86A', 0.3, { emissive: '#FFB020', emissiveIntensity: 0.6 }), 0, 10, 0, 10));
  // Faixa laranja e a fivela dourada
  const band = mesh(new THREE.CylinderGeometry(11.6, 12.1, 3.6, 32, 1, true), mat('#F28C28', 0.6, { side: THREE.DoubleSide }), 0, 3, 0);
  hat.add(band);
  const buckle = mesh(new THREE.TorusGeometry(2, 0.55, 6, 4), mat('#FFD86A', 0.3, { metalness: 0.5 }), 2, 3, 11.9);
  buckle.rotation.z = Math.PI / 4;
  hat.add(buckle);
  return hat;
}

// ---- Traje de astronauta (Espaço): cinto com fivela azul, painel de controle no
// peito com três botões e a mochila de oxigênio nas costas (grade e luzinha verde)
function buildSuit(kit, body, trim) {
  const { THREE, mat, mesh, group } = kit;
  const belt = mesh(new THREE.TorusGeometry(16.4, 2.3, 8, 40), trim, 0, 14.6, 0);
  belt.rotation.x = Math.PI / 2;
  belt.scale.set(1, 0.84, 1);
  body.add(belt);
  body.add(mesh(new THREE.BoxGeometry(6, 4.4, 1.6), mat('#5B8BD9', 0.4), 0, 14.6, 14));
  // Painel no peito (inclinado como o casaco)
  const panel = group(2.5, 33.5, 10.6);
  panel.rotation.x = -0.2;
  body.add(panel);
  panel.add(mesh(new THREE.BoxGeometry(14, 9.5, 2), mat('#C3CAD6', 0.45), 0, 0, 0));
  ['#E5484D', '#5AF0A0', '#5B8BD9'].forEach((c, i) => {
    panel.add(mesh(new THREE.BoxGeometry(2.8, 2.8, 1), mat(c, 0.3, { emissive: c, emissiveIntensity: 0.35 }), -4.2 + i * 4.2, 1.2, 1.3));
  });
  panel.add(mesh(new THREE.BoxGeometry(10, 1, 0.6), mat('#7C8294', 0.5), 0, -2.6, 1.1));
  // Mochila de oxigênio: caixa de cantos arredondados com dois cilindros e a grade
  const pack = group(0, 35, -14);
  body.add(pack);
  const s = new THREE.Shape();
  s.moveTo(-10, -12);
  s.lineTo(10, -12);
  s.quadraticCurveTo(13, -12, 13, -9);
  s.lineTo(13, 10);
  s.quadraticCurveTo(13, 14, 9, 14);
  s.lineTo(-9, 14);
  s.quadraticCurveTo(-13, 14, -13, 10);
  s.lineTo(-13, -9);
  s.quadraticCurveTo(-13, -12, -10, -12);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 6, bevelEnabled: true, bevelThickness: 1.6, bevelSize: 1.6, bevelSegments: 3 });
  geo.translate(0, 0, -6);
  pack.add(mesh(geo, mat('#CDD3DD', 0.5)));
  for (const x of [-7, 7]) {
    const tank = mesh(new THREE.CapsuleGeometry(3.4, 18, 6, 14), mat('#E8ECF2', 0.4), x, 1, -9.5);
    pack.add(tank);
  }
  for (let i = 0; i < 5; i++) pack.add(mesh(new THREE.BoxGeometry(12, 1.2, 1), mat('#6A7080', 0.6), 0, 7 - i * 3.6, -13.4));
  pack.add(mesh(new THREE.BoxGeometry(2.6, 2.6, 1), mat('#5AF0A0', 0.3, { emissive: '#5AF0A0', emissiveIntensity: 0.8 }), 7, -9, -13.4));
}

// Capacete: casco branco com a abertura do visor na frente (o rosto aparece por
// dentro), vidro azulado com brilho, aro, luzinha verde na lateral e anel do pescoço.
// Ponto da esfera do Three.js: x = −r·cos φ·sen θ, y = r·cos θ, z = r·sen φ·sen θ
// (φ = π/2 é a frente).
const HELMET = { r: 16, y: 1.5, z: 1.6, phi: 0.9, top: 0.8, bottom: 2.05 };
function buildHelmet(kit, head) {
  const { THREE, mat, mesh } = kit;
  const { r, phi, top, bottom } = HELMET;
  const shellM = mat('#F6F8FB', 0.35, { side: THREE.DoubleSide });
  const front = Math.PI / 2;
  const part = (p0, pl, t0, tl, m, rr = r) => {
    const o = mesh(new THREE.SphereGeometry(rr, 40, 26, p0, pl, t0, tl), m, 0, HELMET.y, HELMET.z);
    head.add(o);
    return o;
  };
  part(front + phi, Math.PI * 2 - phi * 2, 0, Math.PI, shellM);
  part(front - phi, phi * 2, 0, top, shellM);
  part(front - phi, phi * 2, bottom, Math.PI - bottom, shellM);
  // Vidro do visor (um pouco maior que a abertura)
  const glass = part(front - phi - 0.04, phi * 2 + 0.08, top - 0.04, bottom - top + 0.08,
    mat('#8CC8FF', 0.05, { transparent: true, opacity: 0.22, depthWrite: false, metalness: 0.2 }), r + 0.3);
  glass.castShadow = false;
  // Aro do visor seguindo a borda da abertura
  const at = (p, t, rr = r + 0.4) => new THREE.Vector3(-rr * Math.cos(p) * Math.sin(t), HELMET.y + rr * Math.cos(t), HELMET.z + rr * Math.sin(p) * Math.sin(t));
  const pts = [];
  const N = 12;
  for (let i = 0; i < N; i++) pts.push(at(front - phi + (phi * 2 * i) / N, top));
  for (let i = 0; i < N; i++) pts.push(at(front + phi, top + ((bottom - top) * i) / N));
  for (let i = 0; i < N; i++) pts.push(at(front + phi - (phi * 2 * i) / N, bottom));
  for (let i = 0; i < N; i++) pts.push(at(front - phi, bottom - ((bottom - top) * i) / N));
  const rim = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 96, 0.9, 8, true), mat('#9AA4B6', 0.35));
  head.add(rim);
  // Brilho no vidro (arco no alto à esquerda, do lado da luz)
  const hl = [];
  for (let i = 0; i <= 8; i++) hl.push(at(front - phi * 0.75 + i * 0.07, top + 0.18 + i * 0.03, r + 0.6));
  const shine = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hl), 16, 0.55, 6), mat('#FFFFFF', 0.1, { emissive: '#FFFFFF', emissiveIntensity: 0.6, transparent: true, opacity: 0.8 }));
  shine.castShadow = false;
  head.add(shine);
  // Luzinhas verdes nas laterais e o anel do pescoço
  for (const s of [-1, 1]) {
    const l = at(front + s * (phi + 0.5), 1.05, r + 0.3);
    head.add(mesh(new THREE.SphereGeometry(1.3, 10, 8), mat('#5AF0A0', 0.3, { emissive: '#5AF0A0', emissiveIntensity: 0.9 }), l.x, l.y, l.z));
  }
  const neck = mesh(new THREE.TorusGeometry(10.5, 2.4, 10, 32), mat('#8E95A6', 0.4), 0, -12.4, 0);
  neck.rotation.x = Math.PI / 2;
  head.add(neck);
}

export function build(kit, outfit = 'parka') {
  const { THREE, mat, mesh, group, capsule, sphere, furRing, lathe } = kit;
  const sweater = outfit === 'sweater';
  const lumber = outfit === 'lumberjack';
  const astro = outfit === 'astronaut';
  const surf = outfit === 'surfer';
  const wiz = outfit === 'wizard';
  const cave = outfit === 'caveman';
  const leopard = cave ? new THREE.MeshStandardMaterial({ map: leopardTexture(THREE), roughness: 0.9, metalness: 0 }) : null;
  const robe = wiz ? new THREE.MeshStandardMaterial({ map: robeTexture(THREE), roughness: 0.8, metalness: 0 }) : null;
  const stockings = wiz ? new THREE.MeshStandardMaterial({ map: stripeTexture(THREE), roughness: 0.85, metalness: 0 }) : null;
  const floral = surf ? new THREE.MeshStandardMaterial({ map: floralTexture(THREE), roughness: 0.8, metalness: 0 }) : null;
  const plaid = lumber ? new THREE.MeshStandardMaterial({ map: plaidTexture(THREE), roughness: 0.95, metalness: 0 }) : null;
  const leather = mat('#3A2614', 0.7);
  // Traje de astronauta: branco com sombra cinza-azulada, botas e luvas cinza
  const parka = astro ? mat('#F4F6F9', 0.55) : mat(C.parka, 0.8);
  const parkaDark = astro ? mat('#D5DAE3', 0.6) : mat(C.parkaShade, 0.85);
  const suitTrim = mat('#AEB6C4', 0.5);
  const fur = mat(C.fur, 1);
  const furShade = mat(C.furShade, 1);
  const skin = mat('#E3A87E', 0.7);
  // Surfista: pés descalços (de chinelo), bermuda laranja e mãos de fora
  const boots = surf ? skin : mat(astro ? '#8A90A0' : wiz ? '#1E1A24' : cave ? '#8A5A2E' : C.boots, wiz ? 0.4 : cave ? 1 : 0.6);
  const pants = wiz ? stockings : cave ? leopard : mat(lumber ? '#33507A' : astro ? '#E1E6EE' : surf ? '#FF8A3D' : C.pants, astro ? 0.6 : 0.9);
  const mitten = surf || wiz || cave ? skin : mat(astro ? '#7C8294' : '#5A3E2A', astro ? 0.6 : 0.9);
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
    if (cave) {
      // Pé enrolado em pele, amarrado com cipó, e a canela de fora
      const fur2 = furRing(5.4, 2.1, 10, mat('#B07A44', 1), mat('#8A5A2E', 1));
      fur2.position.y = -2;
      knee.add(fur2);
      knee.add(capsule(3.6, 3, skin, 0, -1.5, 0));
      const tie = mesh(new THREE.TorusGeometry(5.2, 0.6, 6, 18), mat('#5A7A2A', 0.8), 0, -5.5, 1);
      tie.rotation.x = Math.PI / 2;
      knee.add(tie);
    } else if (wiz) {
      // Sapato preto de bico curvado e o punho roxo da meia
      const toe = mesh(new THREE.ConeGeometry(2.4, 7, 10), boots, 0, -6.2, 9.5);
      toe.rotation.x = Math.PI / 2 + 0.5;
      knee.add(toe);
      const trim = mesh(new THREE.TorusGeometry(4.8, 1.2, 8, 18), mat('#3A2E4A', 0.7), 0, -1.5, 0.4);
      trim.rotation.x = Math.PI / 2;
      knee.add(trim);
    } else if (surf) {
      // Chinelo: sola azul e a tira entre os dedos; barra da bermuda na coxa
      knee.add(mesh(new THREE.BoxGeometry(9, 1.6, 13.5), mat('#2FB5E8', 0.6), 0, -12, 2.4));
      const strap = mesh(new THREE.TorusGeometry(3.6, 0.8, 6, 14, Math.PI), mat('#1F8FC0', 0.6), 0, -10.8, 4.6);
      strap.rotation.x = -0.5;
      knee.add(strap);
      const cuff = mesh(new THREE.TorusGeometry(4.6, 1.2, 8, 18), mat('#D96A22', 0.85), 0, -7.6, 0);
      cuff.rotation.x = Math.PI / 2;
      hip.add(cuff);
    } else if (astro) {
      // Bota do traje: anel cinza (sem pelo)
      const trim = mesh(new THREE.TorusGeometry(5, 1.4, 8, 18), suitTrim, 0, -1.5, 0.4);
      trim.rotation.x = Math.PI / 2;
      knee.add(trim);
    } else if (lumber) {
      // Botina de trabalho: borda de couro (sem pelo)
      const trim = mesh(new THREE.TorusGeometry(4.8, 1.3, 8, 18), leather, 0, -1.5, 0.4);
      trim.rotation.x = Math.PI / 2;
      knee.add(trim);
    } else {
      const trim = furRing(5.2, 2, 10, fur, furShade);
      trim.position.y = -1.5;
      knee.add(trim);
    }
    hip.add(knee);
    body.add(hip);
    legs.push({ hip, knee });
  }

  // Corpo em A (torneado): parka com bolso e barra de pelo, ou suéter de tricô com
  // barra canelada verde
  const knit = sweater ? new THREE.MeshStandardMaterial({ map: knitTexture(THREE), roughness: 0.95, metalness: 0 }) : null;
  const knitGreen = mat(KNIT_GREEN, 0.95);
  const knitWhite = mat(KNIT_WHITE, 0.95);
  const coat = lathe(COAT, sweater ? knit : lumber ? plaid : surf ? floral : wiz ? robe : cave ? leopard : parka, 48);
  coat.scale.set(1, 1, 0.82);
  body.add(coat);
  if (sweater) {
    const rib = mesh(new THREE.TorusGeometry(16.4, 2.8, 8, 40), knitGreen, 0, 14.5, 0);
    rib.rotation.x = Math.PI / 2;
    rib.scale.set(1, 0.84, 1.15);
    body.add(rib);
  } else if (astro) {
    buildSuit(kit, body, suitTrim);
  } else if (cave) {
    buildTunic(kit, body, skin, leopard);
  } else if (wiz) {
    // Barra laranja do manto e o fecho no peito
    const hem = mesh(new THREE.TorusGeometry(16.6, 2.4, 8, 40), mat('#F28C28', 0.6), 0, 14.4, 0);
    hem.rotation.x = Math.PI / 2;
    hem.scale.set(1, 0.84, 1);
    body.add(hem);
    body.add(sphere(2, mat('#F28C28', 0.4, { metalness: 0.3 }), 2, 44.5, 7.6, 10));
  } else if (surf) {
    // Cós da bermuda com cordão branco, botões da camisa e a gola aberta
    const band = mesh(new THREE.TorusGeometry(16.4, 2.4, 8, 40), mat('#D96A22', 0.85), 0, 14.4, 0);
    band.rotation.x = Math.PI / 2;
    band.scale.set(1, 0.84, 1);
    body.add(band);
    for (const x of [-1.4, 1.4]) body.add(kit.bone(0.45, [x, 14, 14.2], [x * 1.8, 9.5, 14.4], mat('#FFFFFF', 0.6)));
    for (const [y, z] of [[36, 11.4], [28, 12.6], [20, 13.6]]) body.add(sphere(0.9, mat('#FFFFFF', 0.4), 1.5, y, z, 8));
    for (const sd of [-1, 1]) {
      const lapel = mesh(new THREE.BoxGeometry(5, 7, 0.8), floral, sd * 3.5, 45, 7.6);
      lapel.rotation.set(-0.6, 0, sd * 0.5);
      body.add(lapel);
    }
  } else if (lumber) {
    // Cinto de couro com fivela dourada e suspensórios azuis (cruzados nas costas)
    const belt = mesh(new THREE.TorusGeometry(16.4, 2.2, 8, 40), mat('#4A2E18', 0.6), 0, 14.6, 0);
    belt.rotation.x = Math.PI / 2;
    belt.scale.set(1, 0.84, 1);
    body.add(belt);
    body.add(mesh(new THREE.BoxGeometry(5, 4.4, 1.6), mat('#D9B048', 0.3, { metalness: 0.4 }), 2.5, 14.6, 14));
    const strap = mat('#2E4A6B', 0.7);
    for (const s of [-1, 1]) {
      body.add(kit.bone(1.5, [s * 6.5, 47.5, 7.6], [s * 7.5, 30, 12.6], strap));
      body.add(kit.bone(1.5, [s * 7.5, 30, 12.6], [s * 8.5, 16.5, 14.6], strap));
      body.add(kit.bone(1.5, [s * 6.5, 47.5, -7.6], [-s * 7, 16.5, -13.5], strap));
      body.add(mesh(new THREE.BoxGeometry(3, 2.5, 1.2), mat('#E8C36A', 0.3, { metalness: 0.4 }), s * 8.6, 22.5, 14.2));
    }
  } else {
    const pocket = mesh(new THREE.TorusGeometry(9, 0.45, 6, 24, Math.PI * 0.7), parkaDark);
    pocket.rotation.set(-0.25, 0, Math.PI * 1.15);
    pocket.position.set(0, 33, 11.2);
    body.add(pocket);
    const hem = furRing(16.6, 3.3, 22, fur, furShade, 1, 0.84);
    hem.position.y = 13.5;
    body.add(hem);
  }

  // Braços (ombro em y = 42): manga do braço, cotovelo, antebraço, punho de pelo e luva
  const arm = (side) => {
    const m = sweater ? mat(side < 0 ? '#E0403F' : '#A52528', 0.95) : lumber ? plaid : surf || cave ? skin : wiz ? robe : side < 0 ? parka : parkaDark;
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
    if (sweater) {
      // Listra branca na manga e punho de tricô verde com filete branco
      const stripe = mesh(new THREE.TorusGeometry(4.3, 0.7, 6, 18), knitWhite, 0, -2.4, 0);
      stripe.rotation.x = Math.PI / 2;
      elbow.add(stripe);
      const cuff = mesh(new THREE.TorusGeometry(4.3, 1.6, 8, 18), knitGreen, 0, -7, 0);
      cuff.rotation.x = Math.PI / 2;
      elbow.add(cuff);
      const line = mesh(new THREE.TorusGeometry(4.6, 0.45, 6, 18), knitWhite, 0, -7, 0);
      line.rotation.x = Math.PI / 2;
      elbow.add(line);
    } else if (cave) {
      // Braço de fora; só no ombro da alça a pele da onça cobre o alto do braço
      if (side < 0) {
        const cap = sphere(5.6, leopard, 0, 0.4, 0, 14);
        cap.scale.set(1.05, 0.9, 1.05);
        sh.add(cap);
      }
    } else if (wiz) {
      // Manga larga com a barra laranja
      const cuff = mesh(new THREE.CylinderGeometry(5.6, 6.6, 3.4, 18, 1, true), mat('#F28C28', 0.6, { side: THREE.DoubleSide }), 0, -7.2, 0);
      elbow.add(cuff);
    } else if (surf) {
      // Manga curta florida cobrindo só o alto do braço
      const sleeve = mesh(new THREE.CylinderGeometry(5.4, 5.9, 7, 18, 1, true), floral, 0, -2.6, 0);
      sleeve.material = new THREE.MeshStandardMaterial({ map: floral.map, roughness: 0.8, side: THREE.DoubleSide });
      sh.add(sleeve);
      sh.add(sphere(5.5, floral, 0, 0.6, 0, 14));
    } else if (astro) {
      // Punho do traje (anel cinza) e o emblema da bandeirinha no ombro
      const cuff = mesh(new THREE.TorusGeometry(4.4, 1.3, 8, 18), suitTrim, 0, -7.2, 0);
      cuff.rotation.x = Math.PI / 2;
      elbow.add(cuff);
      const patch = mesh(new THREE.BoxGeometry(1, 4.4, 5.6), mat('#2C6FD6', 0.5), side * 4.6, -2.5, 0);
      patch.add(mesh(new THREE.BoxGeometry(1, 1.6, 1.6), mat('#FFD84A', 0.4), side * 0.2, 0, 0));
      sh.add(patch);
    } else if (lumber) {
      // Punho da camisa abotoado
      const cuff = mesh(new THREE.TorusGeometry(4.2, 1.4, 8, 18), mat('#8E211C', 0.9), 0, -7.2, 0);
      cuff.rotation.x = Math.PI / 2;
      elbow.add(cuff);
    } else {
      const cuff = furRing(4.6, 1.8, 9, fur, furShade);
      cuff.position.y = -7;
      elbow.add(cuff);
    }
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
  let glasses = null;
  let hat = null;
  let caveHair = null;
  if (cave) {
    caveHair = buildCaveHead(kit, head, skin);
  } else if (surf) {
    glasses = buildSurfHead(kit, head, skin);
  } else if (wiz) {
    hat = buildWizardHead(kit, head, skin);
  } else if (astro) {
    // Touca de comunicação escura atrás do rosto; o capacete vem depois do rosto
    const capM = mat('#2A3550', 0.7);
    const cap = sphere(12.4, capM, 0, 0.5, -0.8, 24);
    cap.scale.set(1, 1.02, 0.95);
    head.add(cap);
  } else if (lumber) {
    // Sem capuz: cabeça, cabelo na nuca, orelhas, gorro de lã e barba curta
    const hair = mat('#6B4524', 0.9);
    // Cabeça numa peça só (o rosto faz parte do crânio, sem emenda de máscara)
    head.add(faceSkull(kit, skin));
    // Cabelo em calota só atrás (de uma orelha à outra), sem a borda redonda do lado
    const back = new THREE.Mesh(new THREE.SphereGeometry(12.75, 32, 16, Math.PI + 0.15, Math.PI - 0.3, 0.12 * Math.PI, 0.5 * Math.PI), mat('#6B4524', 0.9, { side: THREE.DoubleSide }));
    back.position.set(0, -0.5, 1.3);
    back.castShadow = back.receiveShadow = true;
    head.add(back);
    for (const s of [-1, 1]) head.add(sphere(2.8, skin, s * 12, -0.5, 2, 12));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(13.6, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat('#3F6E3A', 0.95));
    cap.position.y = 3.5;
    cap.scale.set(1, 0.92, 1);
    cap.castShadow = cap.receiveShadow = true;
    head.add(cap);
    const fold = mesh(new THREE.CylinderGeometry(14, 14.1, 6, 32, 1, true), mat('#2A4A26', 0.95), 0, 4.2, 0);
    fold.material = mat('#2A4A26', 0.95, { side: THREE.DoubleSide });
    head.add(fold);
    head.add(sphere(4, mat('#E8E1CF', 1), 0, 17.4, 0, 14));
    const beard = sphere(7.6, hair, 0, -7.6, 10.6, 20);
    beard.scale.set(1.12, 0.62, 0.66);
    head.add(beard);
  } else {
    const hood = sphere(14, parka, 0, 0, 0, 28);
    hood.scale.set(1, 1.02, 0.95);
    head.add(hood);
    const ring = furRing(10.2, 3.7, 18, fur, furShade);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 1.5, 10.2);
    head.add(ring);
  }
  // Rosto em esfera separada só onde há capuz ou capacete em volta (parka, suéter,
  // astronauta); nas cabeças de fora ele já faz parte do crânio (faceSkull)
  if (!wiz && !lumber && !surf && !cave) {
    const face = sphere(8, skin, 0, 1.5, 10.6, 24);
    face.scale.set(1, 1.05, 0.62);
    head.add(face);
  }
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
  if (astro) buildHelmet(kit, head);

  return { root, body, legs, arms, head, glasses, hat, caveHair, faces: { calm, cold, scared } };
}

export function apply(rig, p) {
  const yaw = p.yaw ?? (p.facing === 'B' ? Math.PI : (p.facing === 'L' ? -1 : 1) * M.yaw);
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
    if (p.spread) {
      // Abertos para os lados e para cima, cotovelos um pouco dobrados
      a.rotation.set(-0.2, 0, side * val(p.spread, i));
      a.scale.set(1, 1, 1);
      elbow.rotation.set(-0.45, 0, 0);
    } else if (p.up) {
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
  // Óculos escuros nos olhos; no susto sobem para a testa (como no desenho 2D)
  if (rig.glasses) {
    const up = p.face === 'scared';
    rig.glasses.position.set(0, up ? 8.6 : 3.4, up ? 12.6 : 15.2);
    rig.glasses.rotation.x = up ? -0.55 : 0;
  }
  // Cabeleira do homem das cavernas: no susto fica em pé (os tufos e o ossinho sobem)
  if (rig.caveHair) {
    const up = p.face === 'scared';
    rig.caveHair.position.y = up ? 3 : 0;
    rig.caveHair.scale.y = up ? 1.35 : 1;
  }
  // Chapéu do bruxinho: no susto pula da cabeça (sobe e entorta), como no 2D
  if (rig.hat) {
    const up = p.face === 'scared';
    rig.hat.position.set(0, up ? 17 : 9.5, 0);
    rig.hat.rotation.set(up ? -0.2 : -0.08, 0, up ? 0.18 : 0);
  }
}

// Modelo do personagem com uma roupa ('parka' ou 'sweater')
const outfits = new Map();
export const OUTFITS_3D = ['parka', 'sweater', 'lumberjack', 'astronaut', 'surfer', 'wizard', 'caveman'];
export function withOutfit(outfit = 'parka') {
  if (!outfits.has(outfit)) outfits.set(outfit, { box, poses, apply, playerPose, build: (kit) => build(kit, outfit) });
  return outfits.get(outfit);
}
