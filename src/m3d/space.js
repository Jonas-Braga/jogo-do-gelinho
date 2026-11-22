// Espaço em 3D (fase 15): alienígena de quatro patas articuladas, disco voador com
// tripulante, bichinho lunar de seis patas, cometa bravo, estrelinha dourada,
// asteroides no lugar das placas, base lunar montada peça por peça, módulo de pouso
// e bandeira. Mesmos pontos de apoio do desenho 2D (src/space.js); y para cima.
import { TAU } from './kit.js';
import { LEGS, solveLeg, bearPose, poses as bearPoses, box as bearBox } from './bear.js';
import { BASE, BASE_PIECES } from '../space.js';

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

// ---------------------------------------------------------------- Alienígena
// No lugar do urso: corpo de lesma verde com pintas roxas, espinhos brilhando nas
// costas, rabinho em espiral, pescoço, cabeção com três olhos, antenas luminosas
// (duas partes cada) e boca que abre na perseguição. As patas têm coxa, joelho,
// canela e ventosa, com o mesmo passo do urso (cinemática inversa de src/m3d/bear.js),
// então usam as mesmas fotos: walk{quadro}{lado}{boca}.
export const alien = {
  box: bearBox,
  res: 2,
  poses: bearPoses,
  pose: bearPose,
  build(kit) {
    const { THREE, mat, group, sphere, mesh, bone } = kit;
    // Pele para o corpo contínuo: u dá a volta (dorso em u = 0,25, barriga em u = 0,75),
    // v corre ao longo; dorso claro com pintas roxas, lados verdes, barriga verde-clara
    const skinTex = canvasTex(THREE, 256, 256, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, w, 0);
      grd.addColorStop(0, '#6CC13E');
      grd.addColorStop(0.25, '#B4EE72');
      grd.addColorStop(0.5, '#4E9A2E');
      grd.addColorStop(0.75, '#A8E86A');
      grd.addColorStop(1, '#6CC13E');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
      const rnd = rng(77);
      for (let i = 0; i < 34; i++) {
        g.fillStyle = `rgba(123, 75, 200, ${0.55 + rnd() * 0.3})`;
        g.beginPath();
        g.ellipse(w * (0.04 + rnd() * 0.42), rnd() * h, 3 + rnd() * 5, 5 + rnd() * 8, 0, 0, TAU);
        g.fill();
      }
      for (let i = 0; i < 500; i++) {
        g.fillStyle = rnd() < 0.5 ? 'rgba(20, 60, 10, 0.18)' : 'rgba(255, 255, 220, 0.14)';
        g.beginPath();
        g.arc(rnd() * w, rnd() * h, 0.8 + rnd() * 1.2, 0, TAU);
        g.fill();
      }
    });
    skinTex.wrapS = skinTex.wrapT = THREE.RepeatWrapping;
    const headTex = canvasTex(THREE, 256, 128, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, '#C4F57E');
      grd.addColorStop(0.45, '#6CC13E');
      grd.addColorStop(1, '#2F6E22');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
      const rnd = rng(78);
      for (let i = 0; i < 16; i++) {
        g.fillStyle = `rgba(123, 75, 200, ${0.55 + rnd() * 0.3})`;
        g.beginPath();
        g.ellipse(rnd() * w, h * (0.18 + rnd() * 0.4), 4 + rnd() * 6, 3 + rnd() * 4, 0, 0, TAU);
        g.fill();
      }
    });
    const headSkin = new THREE.MeshStandardMaterial({ map: headTex, roughness: 0.45, metalness: 0 });
    const skin = new THREE.MeshStandardMaterial({ map: skinTex, roughness: 0.45, metalness: 0 });
    skinTex.repeat.set(1, 2);
    const green = mat('#6CC13E', 0.45);
    const dark = mat('#2F6E22', 0.5);
    const legNear = mat('#5BAE36', 0.5);
    const legFar = mat('#3F8A2A', 0.5);
    const cup = mat('#2C6620', 0.6);
    const white = mat('#FFFFFF', 0.25);
    const ink = mat('#1B0F2E', 0.2);
    const red = mat('#D0202A', 0.2, { emissive: '#7A0A10', emissiveIntensity: 0.5 });
    const glow = mat('#FFE45C', 0.3, { emissive: '#FFD02A', emissiveIntensity: 1.3 });
    const mouthIn = mat('#3A0E2E', 0.7);
    const tooth = mat('#FFFFFF', 0.35);

    const root = group();
    root.rotation.order = 'YXZ';
    const body = group();
    root.add(body);
    // Corpo de lesma, pescoço e o começo da cabeça numa peça só (frente = +z)
    body.add(kit.sweep([
      { p: [0, 43, -52], w: 9, h: 9 },
      { p: [0, 41, -40], w: 16, h: 17, hb: 15 },
      { p: [0, 40, -18], w: 17.5, h: 18, hb: 16 },
      { p: [0, 41, 2], w: 15, h: 16, hb: 14 },
      { p: [0, 45, 18], w: 9.5, h: 9.5 },
      { p: [0, 52, 32], w: 7.5, h: 7.5 },
      { p: [0, 56, 42], w: 8, h: 8 },
    ], skin, { radial: 24, cap: 0.7 }));
    // Espinhos nas costas (o brilho pulsa conforme o passo)
    const spines = [];
    for (let i = 0; i < 5; i++) {
      const z = -44 + i * 12;
      const h = 12 + Math.sin(i * 1.3) * 3;
      const m = new THREE.MeshStandardMaterial({ color: '#C878FF', roughness: 0.3, emissive: '#A040FF', emissiveIntensity: 0.6 });
      const sp = mesh(new THREE.ConeGeometry(3.6, h, 12), m, 0, 56 + h / 2 - Math.abs(z + 16) * 0.12, z);
      sp.rotation.x = -0.25;
      body.add(sp);
      spines.push({ m, i });
    }
    // Rabinho em espiral (bolinhas cada vez menores)
    const tail = group(0, 42, -52);
    body.add(tail);
    const tailCurl = kit.sweep(alienTail(0), green, { radial: 12, cap: 0.8 });
    tail.add(tailCurl);
    // Cabeça
    const head = group(0, 57, 44);
    head.scale.setScalar(1.15);
    body.add(head);
    const skull = sphere(15, headSkin, 0, 0, 0, 28);
    skull.scale.set(0.95, 0.85, 1.15);
    head.add(skull);
    // Três olhos em fila no alto da cabeça, de trás para a frente (o do meio é o maior);
    // pupilas olhando para a frente, vermelhas na perseguição
    const pupils = [];
    for (const [ang, r] of [[1.15, 4.8], [0.75, 6.4], [0.32, 4.4]]) {
      const ey = Math.sin(ang) * 13.2;
      const ez = Math.cos(ang) * 16.6;
      head.add(sphere(r, white, 0, ey, ez, 16));
      const pu = sphere(r * 0.52, ink, 0, ey + r * 0.15, ez + r * 0.72, 12);
      head.add(pu);
      pupils.push(pu);
    }
    // Antenas: duas partes (a ponta balança) e bolinha luminosa
    const antennas = [];
    for (const s of [-1, 1]) {
      const a = group(s * 5, 10, 4);
      head.add(a);
      a.add(bone(1.2, [0, 0, 0], [s * 2, 9, -2], dark));
      const tip = group(s * 2, 9, -2);
      a.add(tip);
      tip.add(bone(1, [0, 0, 0], [s * 3, 9, 1], dark));
      tip.add(sphere(3, glow, s * 3, 9.6, 1, 12));
      antennas.push({ a, tip, s });
    }
    // Boca: sorrisinho fechado ou bocão com dentinhos (mandíbula articulada)
    const smile = mesh(new THREE.TorusGeometry(5, 0.8, 6, 16, Math.PI * 0.8), dark, 0, -5, 16.4);
    smile.rotation.z = Math.PI * 1.1;
    head.add(smile);
    const jaw = group(0, -4, 8);
    head.add(jaw);
    const lower = sphere(9, green, 0, -2.5, 6, 18);
    lower.scale.set(0.9, 0.42, 1);
    jaw.add(lower);
    const inside = sphere(7, mouthIn, 0, 0.6, 7.5, 14);
    inside.scale.set(0.85, 0.4, 1);
    jaw.add(inside);
    // Dentinhos de cima (só aparecem com a boca aberta)
    const fangs = group();
    head.add(fangs);
    for (const x of [-4.5, -1.5, 1.5, 4.5]) {
      const tb = mesh(new THREE.ConeGeometry(0.9, 2.6, 6), tooth, x, -6.4, 15.6 - Math.abs(x) * 0.45);
      tb.rotation.z = Math.PI;
      fangs.add(tb);
    }
    // Patas com joelho e ventosa (de perto da câmera = lado −x)
    const legs = [];
    for (const [x0, front, phase] of LEGS) {
      const x = Math.sign(x0) * 10;
      const m = x < 0 ? legNear : legFar;
      const L1 = front ? 14 : 15;
      const L2 = front ? 13 : 12;
      const limb = kit.sweep(alienLeg(front, [x, 40, 0], [x, 25, 0], [x, 10, 0]), m, { radial: 14, cap: 0.6 });
      const foot = sphere(7, cup, 0, 0, 0, 16);
      foot.scale.set(1.1, 0.38, 1.3);
      root.add(limb, foot);
      legs.push({ x, front, phase, near: x < 0, L1, L2, limb, spine: alienLeg, foot, hip: { y: front ? 32 : 31, z: front ? 8 : -36 } });
    }
    return { root, body, legs, head, jaw, fangs, smile, pupils, spines, tailCurl, antennas, ink, red, kit, THREE };
  },
  apply(rig, p) {
    rig.root.rotation.y = (p.facing === 'L' ? -1 : 1) * (Math.PI / 2 - 0.42);
    const u = p.u;
    const bob = Math.cos(u * TAU * 2) * 1.3;
    rig.body.position.y = bob;
    rig.body.rotation.z = Math.sin(u * TAU) * 0.03;
    for (const l of rig.legs) solveLeg(rig, l, (u + l.phase) % 1, bob);
    rig.head.rotation.x = Math.sin(u * TAU * 2 + 0.6) * 0.06;
    // Rabinho enrolando para cima e balançando
    rig.kit.resweep(rig.tailCurl, alienTail(Math.sin(u * TAU) * 0.5), { radial: 12, cap: 0.8 });
    for (const s of rig.spines) s.m.emissiveIntensity = 0.45 + 0.4 * (0.5 + 0.5 * Math.sin(u * TAU * 2 + s.i));
    for (const a of rig.antennas) {
      a.a.rotation.z = Math.sin(u * TAU * 2 + a.s) * 0.12;
      a.tip.rotation.z = Math.sin(u * TAU * 2 + a.s - 0.8) * 0.3;
    }
    const open = p.mouth > 0;
    rig.jaw.visible = open;
    rig.fangs.visible = open;
    rig.smile.visible = !open;
    rig.jaw.rotation.x = p.mouth * 0.9;
    for (const pu of rig.pupils) pu.material = open ? rig.red : rig.ink;
  },
};

// Rabinho em espiral: sai para trás e vai enrolando para cima, afinando na ponta
export function alienTail(sw) {
  return [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
    const a = i * 0.5 + sw * (i / 16);
    const r = 9 - i * 0.55;
    const t = 4.4 - i * 0.36;
    return { p: [Math.sin(sw) * i * 0.5, r - Math.cos(a) * r, -Math.sin(a) * r], w: t, h: t };
  });
}

// Pata do alienígena: sai de dentro do corpo, coxa, joelho, canela até a ventosa
export function alienLeg(front, hip, knee, ankle) {
  const [x, hy, hz] = hip;
  const mid = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const r = front ? 5.6 : 6.4;
  return [
    { p: [x * 0.6, hy + 8, hz], w: r + 1, h: r + 2 },
    { p: hip, w: r, h: r + 0.5 },
    { p: knee, w: 4.6, h: 4.8 },
    { p: mid(knee, ankle, 0.5), w: 4, h: 4.2 },
    { p: ankle, w: 4.4, h: 4.4 },
  ];
}

// ---------------------------------------------------------------- Disco voador
// Apoio: centro do disco (c.x, by). Cúpula de vidro com o tripulante (de perfil,
// olhando para onde vai) e as luzes girando na borda (o padrão se repete a cada meia volta)
const UFO_FRAMES = 8;
export const ufo = {
  box: { left: -30, right: 30, top: 22, bottom: -12 },
  res: 2.8,
  elevation: 0.3,
  pose: (c, t) => `${frameOf((t * 4 + c.ph) * 2, UFO_FRAMES)}${c.dir < 0 ? 'L' : 'R'}`,
  poses() {
    const out = [];
    for (const f of ['R', 'L']) for (let i = 0; i < UFO_FRAMES; i++) out.push({ key: `${i}${f}`, f, a: ((i + 0.5) / UFO_FRAMES) * Math.PI });
    return out;
  },
  build({ THREE, mat, group, sphere, mesh, lathe }) {
    const root = group();
    const metal = mat('#C9CED8', 0.3, { metalness: 0.35 });
    const metalDark = mat('#6A7084', 0.4, { metalness: 0.3 });
    root.add(lathe([[0, -4.5], [7, -5.5], [15, -3.6], [22, -0.4], [21, 1], [14, 3.2], [9, 4.6], [0, 5]], metal, 48));
    root.add(lathe([[0, -5.4], [6, -5.6], [8, -4.4], [0, -4]], metalDark, 24));
    const glowM = mat('#A0FFC8', 0.3, { emissive: '#7CFFB0', emissiveIntensity: 1 });
    root.add(mesh(new THREE.CylinderGeometry(4.2, 4.2, 1, 20), glowM, 0, -5.6, 0));
    // Tripulante: cabecinha verde com um olho, de perfil para +x
    const pilot = group(1, 6, 0);
    root.add(pilot);
    pilot.add(sphere(4.2, mat('#7ED957', 0.45), 0, 0, 0, 16));
    const eye = sphere(1.9, mat('#111111', 0.2), 3.1, 0.4, 1.4, 10);
    eye.scale.set(0.6, 1.25, 0.9);
    pilot.add(eye);
    pilot.add(bone3(THREE, mat('#3F8A2A', 0.5), [0, 3.5, 0], [-1, 7, 0]));
    pilot.add(sphere(1, mat('#FFE45C', 0.3, { emissive: '#FFD02A', emissiveIntensity: 1 }), -1, 7.4, 0, 8));
    const dome = new THREE.Mesh(new THREE.SphereGeometry(10, 28, 14, 0, TAU, 0, Math.PI / 2),
      mat('#96DCFF', 0.05, { transparent: true, opacity: 0.4, depthWrite: false, metalness: 0.1 }));
    dome.scale.set(1, 0.95, 1);
    dome.position.y = 4;
    root.add(dome);
    // Luzes na borda (6, em três cores)
    const lights = group();
    root.add(lights);
    ['#FF5A6A', '#FFE45C', '#5AF0FF', '#FF5A6A', '#FFE45C', '#5AF0FF'].forEach((c, i) => {
      const a = (i * TAU) / 6;
      lights.add(sphere(2.4, mat(c, 0.3, { emissive: c, emissiveIntensity: 1.6 }), Math.cos(a) * 19.5, 0.6, Math.sin(a) * 19.5, 10));
    });
    return { root, pilot, lights };
  },
  apply(rig, p) {
    // Um pouco virado para a câmera; o tripulante olha para onde o disco vai
    rig.root.rotation.y = 0;
    rig.pilot.rotation.y = p.f === 'L' ? Math.PI + 0.5 : -0.5;
    rig.lights.rotation.y = -p.a;
  },
};

function bone3(THREE, m, a, b) {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 6), m);
  placeBetween(THREE, o, a, b);
  return o;
}

function placeBetween(THREE, o, a, b) {
  o.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  o.scale.set(1, d.length(), 1);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
}

// ---------------------------------------------------------------- Bichinho lunar
// Apoio: (c.x, y − 2). Corpo roxo com pintas, seis patinhas com joelho (andando em
// trípode: três de um lado e de outro se alternam), antena em duas partes com o olho
// na ponta e a boquinha
const CRAWL_FRAMES = 8;
export const crawler = {
  box: { left: -30, right: 30, top: 40, bottom: -6 },
  res: 2.8,
  elevation: 0.35,
  pose: (c, t) => `${frameOf(t * 16 + c.ph, CRAWL_FRAMES)}${c.dir < 0 ? 'L' : 'R'}`,
  poses() {
    const out = [];
    for (const f of ['R', 'L']) for (let i = 0; i < CRAWL_FRAMES; i++) out.push({ key: `${i}${f}`, f, ph: ((i + 0.5) / CRAWL_FRAMES) * TAU });
    return out;
  },
  build({ THREE, mat, group, sphere, bone, mesh }) {
    const root = group();
    root.rotation.order = 'YXZ';
    const purpleTex = canvasTex(THREE, 128, 64, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, '#D7A6FF');
      grd.addColorStop(0.5, '#A466E8');
      grd.addColorStop(1, '#5B2E8C');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
    });
    const bodyM = new THREE.MeshStandardMaterial({ map: purpleTex, roughness: 0.4 });
    const legM = mat('#5B2E8C', 0.5);
    const body = sphere(10, bodyM, 0, 10, 0, 24);
    body.scale.set(1.7, 0.9, 1.15);
    root.add(body);
    for (const [x, z] of [[-8, 4], [-1, 6.5], [6, 4.4], [-4, -5], [3, -6]]) {
      const sp = sphere(1.8, mat('#FFE45C', 0.4, { emissive: '#B89A20', emissiveIntensity: 0.3 }), x, 17.2 - Math.abs(z) * 0.25, z, 10);
      sp.scale.y = 0.5;
      root.add(sp);
    }
    // Patas: quadril no corpo, joelho alto, canela até o chão
    const legs = [];
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const hip = group(-10 + i * 10, 7, s * 7);
        root.add(hip);
        const thigh = mesh(new THREE.CylinderGeometry(1.1, 1.1, 1, 8), legM);
        hip.add(thigh);
        const kneeBall = sphere(1.4, legM, 0, 0, 0, 8);
        hip.add(kneeBall);
        const shin = mesh(new THREE.CylinderGeometry(1, 0.8, 1, 8), legM);
        hip.add(shin);
        legs.push({ hip, thigh, kneeBall, shin, s, i });
      }
    }
    // Antena com o olho, em duas partes
    const ant = group(11, 15, 0);
    root.add(ant);
    ant.add(bone(1, [0, 0, 0], [3, 7, 0], legM));
    const antTip = group(3, 7, 0);
    ant.add(antTip);
    antTip.add(bone(0.9, [0, 0, 0], [0, 6, 0], legM));
    antTip.add(sphere(4.5, mat('#FFFFFF', 0.25), 0, 10, 0, 16));
    antTip.add(sphere(2, mat('#1B0F2E', 0.2), 3.4, 10, 1.5, 10));
    const mouth = mesh(new THREE.TorusGeometry(3, 0.5, 6, 12, Math.PI - 0.8), mat('#3A1666', 0.5), 15.6, 8, 3);
    mouth.rotation.set(0, Math.PI / 2 - 0.4, Math.PI + 0.2);
    root.add(mouth);
    return { root, legs, ant, antTip, THREE };
  },
  apply(rig, p) {
    const { THREE } = rig;
    // De perfil para onde anda, um pouco virado para a câmera
    rig.root.rotation.y = p.f === 'L' ? Math.PI + 0.4 : -0.4;
    for (const l of rig.legs) {
      // Trípode: pata 0 e 2 de um lado andam com a pata 1 do outro
      const k = Math.sin(p.ph + ((l.i + (l.s > 0 ? 1 : 0)) % 2) * Math.PI);
      const swing = k * 3;
      const lift = Math.max(0, -Math.cos(p.ph + ((l.i + (l.s > 0 ? 1 : 0)) % 2) * Math.PI)) * 2.5;
      const kx = swing * 0.4;
      const knee = [kx, 4 + lift, l.s * 6];
      const footP = [swing, -7 + lift * 0.6, l.s * 10];
      placeBetween(THREE, l.thigh, [0, 0, 0], knee);
      placeBetween(THREE, l.shin, knee, footP);
      l.kneeBall.position.set(...knee);
    }
    rig.ant.rotation.z = Math.sin(p.ph * 0.5) * 0.12;
    rig.antTip.rotation.z = Math.sin(p.ph * 0.5 - 0.7) * 0.25;
  },
};

// ---------------------------------------------------------------- Cometa
// Apoio: centro do núcleo. Núcleo de gelo e rocha cheio de calombos e com a carinha
// brava virada para onde ele vai; a cauda brilhante e a poeira continuam 2D
export const comet = {
  box: { left: -14, right: 14, top: 14, bottom: -14 },
  res: 3.2,
  elevation: 0.2,
  pose: (c) => (c.dir < 0 ? 'L' : 'R'),
  poses: () => [{ key: 'R', f: 'R' }, { key: 'L', f: 'L' }],
  build({ THREE, mat, group, sphere, mesh }) {
    const root = group();
    root.rotation.order = 'YXZ';
    const geo = new THREE.SphereGeometry(9, 36, 24);
    const pos = geo.attributes.position;
    const rnd = rng(9);
    const bumps = Array.from({ length: 7 }, () => [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1, 0.5 + rnd()]);
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i).normalize();
      let k = 1;
      for (const [x, y, z, a] of bumps) k += 0.06 * a * Math.max(0, v.dot(new THREE.Vector3(x, y, z).normalize())) ** 6;
      k -= 0.05 * Math.sin(v.x * 9) * Math.sin(v.y * 7);
      pos.setXYZ(i, v.x * 9 * k, v.y * 9 * k, v.z * 9 * k);
    }
    geo.computeVertexNormals();
    const iceTex = canvasTex(THREE, 128, 64, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, '#FFFFFF');
      grd.addColorStop(0.5, '#BFE6FF');
      grd.addColorStop(1, '#5B7FB0');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
      const r2 = rng(5);
      for (let i = 0; i < 18; i++) {
        g.fillStyle = `rgba(60, 80, 120, ${0.25 + r2() * 0.25})`;
        g.beginPath();
        g.arc(r2() * w, h * (0.2 + r2() * 0.7), 1.5 + r2() * 3, 0, TAU);
        g.fill();
      }
    });
    root.add(mesh(geo, new THREE.MeshStandardMaterial({ map: iceTex, roughness: 0.35, emissive: '#4A78C0', emissiveIntensity: 0.25 })));
    const ink = mat('#1A2440', 0.3);
    // Carinha (frente = +x): olhos, sobrancelhas bravas e a boca reta
    for (const z of [-2.6, 2.6]) {
      root.add(sphere(1.5, ink, 8.3, 1.8, z, 10));
      const brow = mesh(new THREE.CapsuleGeometry(0.5, 3, 4, 8), ink, 8.4, 4.4, z * 1.1);
      brow.rotation.set(Math.PI / 2, 0, 0);
      brow.rotation.y = 0;
      brow.rotation.x = Math.PI / 2 + (z > 0 ? -0.45 : 0.45);
      root.add(brow);
    }
    const mouth = mesh(new THREE.CapsuleGeometry(0.45, 3.4, 4, 8), ink, 8.6, -2.6, 0);
    mouth.rotation.x = Math.PI / 2;
    root.add(mouth);
    return { root };
  },
  apply(rig, p) {
    rig.root.rotation.y = p.f === 'L' ? Math.PI + 0.55 : -0.55;
  },
};

// ---------------------------------------------------------------- Estrelinha
// No lugar do peixe: estrela dourada estufada (com chanfro) balançando de um lado
// para o outro (7 inclinações); o brilho em volta continua 2D
const STAR_STEPS = 7;
export const star = {
  box: { left: -16, right: 16, top: 16, bottom: -16 },
  res: 3.2,
  elevation: 0.1,
  pose: (c, t) => `s${Math.round((Math.sin(t * 3 + c.ph) + 1) * ((STAR_STEPS - 1) / 2))}`,
  poses() {
    return Array.from({ length: STAR_STEPS }, (_, k) => ({ key: `s${k}`, a: ((k / (STAR_STEPS - 1)) * 2 - 1) * 0.95 }));
  },
  build({ THREE, mat, group, mesh }) {
    const root = group();
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 4.6 : 10.6;
      if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 1.6, bevelEnabled: true, bevelThickness: 2.4, bevelSize: 1.4, bevelSegments: 4 });
    geo.translate(0, 0, -0.8);
    const gold = mat('#FFD84A', 0.25, { metalness: 0.3, emissive: '#A06A00', emissiveIntensity: 0.5 });
    root.add(mesh(geo, gold));
    return { root };
  },
  apply(rig, p) {
    rig.root.rotation.y = p.a;
  },
};

// ---------------------------------------------------------------- Asteroides
// Mesmas medidas do sprite 2D (asteroidSprite): pés na linha y = 0, 22 abaixo do topo
// da foto, altura 66. Rocha achatada de calombos com o topo quase plano para pisar e
// crateras; acesa, a rocha fica azulada com veios e cristais ciano brilhando. Em volta
// da parte de baixo, o brilho roxo da poeira estelar.
export const ROCK = { PAD: 12, TOP: 22, H: 66, VARIANTS: 3 };
// Aparência das rochas do espaço (as pedras de basalto dos Dinossauros usam o mesmo
// modelo com outra aparência: basaltSubject em src/m3d/dino.js)
export const SPACE_ROCK = {
  dims: ROCK, top: 0.9, bot: -15, ringY: -12.5,
  off: ['#A9A5BA', '#7A7690', '#35304E'], on: ['#C9F6FF', '#8A92B8', '#3E3A62'], onGlow: '#1A5A80',
  crystal: ['#7FF0FF', '#3FD8F0'], vein: ['#78F5FF', '#50E8FF'], ring: ['#B496FF', '#7A50E0', 0.22],
  pebble: ['#6E6A84', '#7E86AC'],
};
const rocks = new Map();
export function rockSubject(w) {
  if (!rocks.has(w)) rocks.set(w, makeRockSubject(w, SPACE_ROCK));
  return rocks.get(w);
}

export function makeRockSubject(w, look) {
  const ROCK = look.dims;
  return {
    box: { left: -ROCK.PAD, right: w + ROCK.PAD, top: ROCK.TOP, bottom: ROCK.TOP - ROCK.H },
    res: 2.2,
    elevation: 0.55,
    poses() {
      const out = [];
      for (let v = 0; v < ROCK.VARIANTS; v++) for (const on of [0, 1]) out.push({ key: `${v}${on}`, v, on });
      return out;
    },
    build(kit) {
      return buildRocks(kit, w, look);
    },
    apply(rig, p) {
      rig.variants.forEach((g, i) => (g.visible = i === p.v));
      for (const o of rig.offs) o.visible = !p.on;
      for (const o of rig.ons) o.visible = !!p.on;
    },
  };
}

function buildRocks(kit, w, look) {
  const ROCK = look.dims;
  const { THREE, group, mat, mesh } = kit;
  const root = group();
  const variants = [];
  const offs = [];
  const ons = [];
  const D = 10;    // meia profundidade
  const top = look.top; // altura do topo (bate com a linha de cima do sprite 2D)
  const bot = look.bot;
  const rockM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
  const rockOnM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0, emissive: look.onGlow, emissiveIntensity: 0.35 });
  const crystal = mat(look.crystal[0], 0.15, { emissive: look.crystal[1], emissiveIntensity: 1, transparent: true, opacity: 0.92 });
  const vein = mat(look.vein[0], 0.2, { emissive: look.vein[1], emissiveIntensity: 1.2 });
  const dust = mat(look.ring[0], 0.9, { transparent: true, opacity: look.ring[2], depthWrite: false, emissive: look.ring[1], emissiveIntensity: look.ring[3] ?? 0.4 });
  const COLORS = {
    off: look.off,
    on: look.on,
  };
  const lerp = (a, b, k) => a.clone().lerp(b, k);
  for (let v = 0; v < ROCK.VARIANTS; v++) {
    const rnd = rng((v + 2) * 5711 + w);
    const g = group();
    const sx = Math.max(8, Math.round(w / 3));
    const geo = new THREE.BoxGeometry(w + 6, top - bot, D * 2, sx, 6, 8);
    geo.translate(w / 2, (top + bot) / 2, 0);
    const pos = geo.attributes.position;
    const hx = w / 2 + 3;
    const cx = w / 2;
    const cy = (top + bot) / 2;
    const hy = (top - bot) / 2;
    // Crateras no topo
    const craters = Array.from({ length: Math.max(2, Math.round(w / 26)) }, () => ({ x: 6 + rnd() * (w - 12), z: (rnd() - 0.5) * D, r: 3 + rnd() * 3.5 }));
    const bumps = Array.from({ length: 6 }, () => ({ a: rnd() * TAU }));
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);
      const ux = (x - cx) / hx;
      const uy = (y - cy) / hy;
      // Pontas arredondadas (pedra rolada): perto das pontas, achata para o meio
      const e = Math.max(0, (Math.abs(ux) - 0.55) / 0.45);
      const k = 1 - e * e * 0.6;
      y = cy + (y - cy) * k + (uy > 0 ? -e * e * 3 : 0);
      z *= k;
      // As pontas também são irregulares (uma mais curta, outra mais pontuda)
      x += Math.sign(ux) * e * (Math.sin(y * 0.4 + z * 0.3 + bumps[0].a) * 2.5 - 2);
      // Lados estufados no meio da altura
      z *= 1 + 0.18 * (1 - uy * uy);
      // Mais estreita embaixo
      z *= 1 - 0.38 * Math.max(0, -uy) ** 1.5;
      // Calombos nos lados e embaixo; o topo fica quase plano (com as crateras)
      let n = 0;
      for (const b of bumps) n += Math.sin(x * 0.21 + b.a) * Math.cos(y * 0.3 + b.a * 2) * 0.35;
      if (uy < 0.98) {
        z *= 1 + n * 0.22;
        y += n * 1.6 * (1 - Math.max(0, uy));
        if (uy < -0.9) y -= rnd() * 2.5;
      } else {
        y += (rnd() - 0.5) * 0.5;
        for (const c of craters) {
          const d = Math.hypot(x - c.x, (z - c.z) * 1.3);
          if (d < c.r) y -= 2.2 * (1 - (d / c.r) ** 2);
          else if (d < c.r * 1.35) y += 0.6;
        }
      }
      pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    const makeColors = (cols) => {
      const [c0, c1, c2] = cols.map((c) => new THREE.Color(c));
      const arr = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const k = (top - y) / (top - bot);
        const c = k < 0.35 ? lerp(c0, c1, k / 0.35) : lerp(c1, c2, (k - 0.35) / 0.65);
        const j = 0.94 + Math.sin(i * 12.9898) * 0.06;
        arr.set([c.r * j, c.g * j, c.b * j], i * 3);
      }
      return arr;
    };
    const gOff = geo;
    gOff.setAttribute('color', new THREE.BufferAttribute(makeColors(COLORS.off), 3));
    const gOn = geo.clone();
    gOn.setAttribute('color', new THREE.BufferAttribute(makeColors(COLORS.on), 3));
    const off = mesh(gOff, rockM);
    const on = mesh(gOn, rockOnM);
    g.add(off, on);
    offs.push(off);
    ons.push(on);
    // Pedras grudadas nos lados e embaixo (quebram a silhueta reta)
    for (let k = 0; k < 2 + Math.round(w / 30); k++) {
      const r = 3 + rnd() * 3.5;
      const x = w * (0.1 + rnd() * 0.8);
      const geoB = new THREE.SphereGeometry(r, 10, 8);
      const p = [x, bot + 3 + rnd() * 6, (rnd() < 0.5 ? -1 : 1) * (D * 0.75)];
      const b0 = mesh(geoB, mat(look.pebble[0], 0.9), ...p);
      const b1 = mesh(geoB, mat(look.pebble[1], 0.7, { emissive: look.onGlow, emissiveIntensity: 0.3 }), ...p);
      for (const b of [b0, b1]) b.scale.set(1.3, 0.8, 1);
      g.add(b0, b1);
      offs.push(b0);
      ons.push(b1);
    }
    // Aceso: cristais pontudos saindo do topo e veios descendo pela frente
    const lit = group();
    g.add(lit);
    ons.push(lit);
    for (const fx of [0.22, 0.7, 0.46]) {
      const h = fx === 0.46 ? 5 : 8;
      const cr = mesh(new THREE.ConeGeometry(fx === 0.46 ? 1.6 : 2.4, h, 6), crystal, w * fx, top + h / 2 - 0.8, (rnd() - 0.5) * 6);
      cr.rotation.z = (rnd() - 0.5) * 0.5;
      cr.rotation.x = (rnd() - 0.5) * 0.4;
      lit.add(cr);
    }
    for (let k = 0; k < Math.max(2, Math.round(w / 30)); k++) {
      let x = 4 + rnd() * (w - 8);
      let y = top;
      for (let j = 0; j < 4; j++) {
        const nx = x + (rnd() - 0.5) * 8;
        const ny = y - 3 - rnd() * 1.5;
        lit.add(kit.bone(0.45, [x, y, D + 0.4], [nx, ny, D * (0.96 - j * 0.04) + 0.4], vein));
        x = nx;
        y = ny;
      }
    }
    // Brilho roxo da poeira em volta da parte de baixo
    const ring = mesh(new THREE.CircleGeometry(1, 40), dust, w / 2, look.ringY ?? -12.5, 0);
    ring.rotation.x = -Math.PI / 2;
    ring.scale.set(w / 2 + 8, D + 7, 1);
    ring.castShadow = false;
    ring.receiveShadow = false;
    g.add(ring);
    root.add(g);
    variants.push(g);
  }
  return { root, variants, offs, ons };
}

// ---------------------------------------------------------------- Base lunar
// Mesmo lugar, mesmas 16 peças e mesma porta da base 2D (src/space.js): 6 painéis do
// módulo (placas de metal com rebites e a faixa laranja embaixo), 4 gomos da
// cúpula-estufa de vidro com a armação geodésica e plantinhas dentro, 2 painéis
// solares nos postes, escotilha, antena parabólica e respiro. A porta (peça 16)
// continua 2D. A frente do módulo fica em z = 0 (no plano da porta 2D).
// Fotos: "n1".."n15" (peças assentadas), "lit" (as 15 com a luz de dentro acesa) e
// "b0".."b14" (cada peça sozinha, caindo).
export const BASE_DEPTH = 64;
export const BASE_ANTENNA = { x: -30, y: 146, z: -BASE_DEPTH / 2 };

export const base = {
  box: { left: -170, right: 170, top: 168, bottom: -20 },
  res: 1.5,
  elevation: 0.2,
  poses() {
    const out = [];
    for (let n = 1; n < BASE_PIECES.length; n++) out.push({ key: `n${n}`, upto: n });
    out.push({ key: 'lit', upto: BASE_PIECES.length - 1, lit: true });
    for (let i = 0; i < BASE_PIECES.length - 1; i++) out.push({ key: `b${i}`, only: i });
    return out;
  },
  build(kit) {
    const { THREE, mat, group, mesh, sphere } = kit;
    const { MW, MH, DOME, VENT, SOLAR } = BASE;
    const BD = BASE_DEPTH;
    const zc = -BD / 2;
    const hull = mat('#E8EBF1', 0.45, { metalness: 0.1 });
    const hullSide = mat('#C9CED8', 0.5, { metalness: 0.1 });
    const rivet = mat('#7C8294', 0.4);
    const orange = mat('#F08A2C', 0.5);
    const greyM = mat('#8A8FA0', 0.4, { metalness: 0.3 });
    const silver = mat('#B9BDCA', 0.35, { metalness: 0.4 });
    const glass = mat('#A8DCFF', 0.05, { transparent: true, opacity: 0.5, depthWrite: false, metalness: 0.1 });
    const glassLit = mat('#FFD49A', 0.1, { transparent: true, opacity: 0.75, depthWrite: false, emissive: '#FFA040', emissiveIntensity: 0.9 });
    const frameM = mat('#E8EBF2', 0.35, { metalness: 0.2 });
    const plant = mat('#3FA34D', 0.7);
    const portDark = mat('#1C2440', 0.15);
    const portLit = mat('#FFC46E', 0.2, { emissive: '#FF9A30', emissiveIntensity: 1.1 });
    const navOff = mat('#2A5A3A', 0.4);
    const navOn = mat('#7CFFB0', 0.3, { emissive: '#7CFFB0', emissiveIntensity: 1.2 });
    const third = (MW * 2) / 3;
    const root = group();
    const pieces = [];
    const litSwap = []; // [mesh, materialApagado, materialAceso]

    const roundRect = (x0, y0, x1, y1, r) => {
      // r = [inferior esquerdo, inferior direito, superior direito, superior esquerdo]
      const s = new THREE.Shape();
      s.moveTo(x0 + r[0], y0);
      s.lineTo(x1 - r[1], y0);
      if (r[1]) s.quadraticCurveTo(x1, y0, x1, y0 + r[1]);
      s.lineTo(x1, y1 - r[2]);
      if (r[2]) s.absarc(x1 - r[2], y1 - r[2], r[2], 0, Math.PI / 2, false);
      s.lineTo(x0 + r[3], y1);
      if (r[3]) s.absarc(x0 + r[3], y1 - r[3], r[3], Math.PI / 2, Math.PI, false);
      s.lineTo(x0, y0 + r[0]);
      if (r[0]) s.quadraticCurveTo(x0, y0, x0 + r[0], y0);
      return s;
    };
    // Ponto do elipsoide da cúpula (centro no topo do módulo, no meio da profundidade)
    const DZ = BD / 2 - 4;
    const domePt = (phi, theta, k = 1) => new THREE.Vector3(
      -DOME.rx * k * Math.cos(phi) * Math.sin(theta), MH + DOME.ry * k * Math.cos(theta), zc + DZ * k * Math.sin(phi) * Math.sin(theta),
    );
    const tube = (pts, r, m) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 3, r, 6), m);
    const arc = (fn, n = 14) => Array.from({ length: n + 1 }, (_, i) => fn(i / n));

    for (const p of BASE_PIECES.slice(0, -1)) {
      const g = group();
      if (p.kind === 'panel') {
        const x0 = -MW + third * p.col + 0.9;
        const x1 = x0 + third - 1.8;
        const y0 = p.row * (MH / 2) + 0.9;
        const y1 = y0 + MH / 2 - 1.8;
        const top = p.row === 1;
        const r = [
          !top && p.col === 0 ? 4 : 0, !top && p.col === 2 ? 4 : 0,
          top && p.col === 2 ? 23 : 0, top && p.col === 0 ? 23 : 0,
        ];
        const geo = new THREE.ExtrudeGeometry(roundRect(x0, y0, x1, y1, r), {
          depth: BD - 2, bevelEnabled: true, bevelThickness: 1, bevelSize: 0.9, bevelSegments: 2, curveSegments: 10,
        });
        geo.translate(0, 0, -BD + 1);
        g.add(mesh(geo, [hull, hullSide]));
        // Rebites nos cantos da face da frente
        for (const [rx, ry] of [[x0 + 5, y0 + 5], [x1 - 5, y0 + 5], [x0 + 5, y1 - 5], [x1 - 5, y1 - 5]]) {
          if (top && ((p.col === 0 && rx < x0 + 10 && ry > y1 - 10) || (p.col === 2 && rx > x1 - 10 && ry > y1 - 10))) continue;
          g.add(sphere(1.2, rivet, rx, ry, 1.1, 8));
        }
        if (!top) g.add(mesh(new THREE.BoxGeometry(x1 - x0, 4, 1), orange, (x0 + x1) / 2, y1 - 8, 1));
        else {
          const nav = mesh(new THREE.BoxGeometry(6, 2, 1), navOff, (x0 + x1) / 2, y1 - 9, 1);
          litSwap.push([nav, navOff, navOn]);
          g.add(nav);
        }
      } else if (p.kind === 'dome') {
        // Gomo: um pedaço da frente e o pedaço de trás correspondente
        const a = (p.i * Math.PI) / 4;
        const b = ((p.i + 1) * Math.PI) / 4;
        for (const [p0, p1] of [[a, b], [TAU - b, TAU - a]]) {
          const geo = new THREE.SphereGeometry(1, 16, 14, p0, p1 - p0, 0, Math.PI / 2);
          const o = mesh(geo, glass, 0, MH, zc);
          o.scale.set(DOME.rx, DOME.ry, DZ);
          o.castShadow = false;
          litSwap.push([o, glass, glassLit]);
          g.add(o);
          // Armação: meridiano no começo do gomo e pedaços do anel do meio e da base
          g.add(tube(arc((k) => domePt(p0, (k * Math.PI) / 2, 1.005)), 0.8, frameM));
          g.add(tube(arc((k) => domePt(p0 + (p1 - p0) * k, 0.95, 1.005), 6), 0.7, frameM));
          g.add(tube(arc((k) => domePt(p0 + (p1 - p0) * k, Math.PI / 2, 1.01), 6), 1.2, silver));
          if (p.i === 3) g.add(tube(arc((k) => domePt(p1, (k * Math.PI) / 2, 1.005)), 0.8, frameM));
        }
        // Plantinhas da estufa
        const x0 = -DOME.rx + (DOME.rx / 2) * p.i;
        for (let k = 0; k < 3; k++) {
          const pl = sphere(4, plant, x0 + 5 + k * 10, MH + 6, zc + 6 - k * 4, 10);
          pl.scale.set(1, 1.75, 1);
          pl.rotation.z = (k - 1) * 0.3;
          g.add(pl);
        }
      } else if (p.kind === 'solar') {
        const s = p.side;
        const px = s * SOLAR.pole;
        g.add(mesh(new THREE.CylinderGeometry(2, 2.4, -SOLAR.y1, 10), greyM, px, -SOLAR.y1 / 2, zc));
        const armLen = Math.abs(SOLAR.pole - MW);
        const arm = mesh(new THREE.BoxGeometry(armLen, 3, 3), greyM, s * (MW + armLen / 2), 39, zc);
        g.add(arm);
        const tex = canvasTex(THREE, 128, 112, (c, w, h) => {
          c.fillStyle = '#1C2E6E';
          c.fillRect(0, 0, w, h);
          c.strokeStyle = 'rgba(120, 170, 255, 0.6)';
          c.lineWidth = 2;
          for (let i = 1; i < 4; i++) {
            c.beginPath();
            c.moveTo((w * i) / 4, 0);
            c.lineTo((w * i) / 4, h);
            c.moveTo(0, (h * i) / 4);
            c.lineTo(w, (h * i) / 4);
            c.stroke();
          }
          c.fillStyle = 'rgba(160, 200, 255, 0.25)';
          c.beginPath();
          c.moveTo(10, h - 10);
          c.lineTo(w * 0.4, 10);
          c.lineTo(w * 0.55, 10);
          c.lineTo(w * 0.15, h - 10);
          c.fill();
        });
        const pw = SOLAR.x1 - SOLAR.x0;
        const ph = SOLAR.y1 - SOLAR.y0;
        const panel = group(s * (SOLAR.x0 + SOLAR.x1) / 2, -(SOLAR.y0 + SOLAR.y1) / 2, zc);
        panel.rotation.x = -0.35;
        g.add(panel);
        panel.add(mesh(new THREE.BoxGeometry(pw + 3, ph + 3, 2.4), silver));
        const face = mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25, metalness: 0.3 }), 0, 0, 1.25);
        panel.add(face);
      } else if (p.kind === 'porthole') {
        const ring = mesh(new THREE.TorusGeometry(12, 2.4, 10, 28), greyM, p.cx, -p.cy, 1.6);
        g.add(ring);
        const win = mesh(new THREE.CircleGeometry(10.2, 28), portDark, p.cx, -p.cy, 1.4);
        litSwap.push([win, portDark, portLit]);
        g.add(win);
        g.add(sphere(3, mat('#B4D2FF', 0.1, { transparent: true, opacity: 0.4 }), p.cx - 3, -p.cy + 3, 1.2, 10));
        for (let i = 0; i < 8; i++) {
          const a = (i * TAU) / 8;
          g.add(sphere(0.9, mat('#D9DCE5', 0.3), p.cx + Math.cos(a) * 12, -p.cy + Math.sin(a) * 12, 3.8, 6));
        }
      } else if (p.kind === 'antenna') {
        const { x, y, z } = BASE_ANTENNA;
        const baseY = MH + DOME.ry * Math.sqrt(Math.max(0, 1 - (x / DOME.rx) ** 2)) - 2;
        g.add(kit.bone(1.3, [x + 4, baseY, z], [x, y - 10, z], silver));
        // Prato parabólico virado para o céu (para a esquerda)
        const dish = group(x, y - 10, z);
        dish.rotation.set(0.25, 0, 0.5);
        g.add(dish);
        const pts = Array.from({ length: 9 }, (_, i) => new THREE.Vector2(0.01 + i * 1.9, ((i * 1.9) ** 2) / 40));
        const dm = mesh(new THREE.LatheGeometry(pts, 28), mat('#E6E9F0', 0.35, { side: THREE.DoubleSide, metalness: 0.2 }));
        dish.add(dm);
        dish.add(kit.bone(0.6, [0, 0, 0], [0, 11, 0], greyM));
        dish.add(sphere(2, mat('#7A2A24', 0.4), 0, 12, 0, 10));
      } else if (p.kind === 'vent') {
        const { x0, x1, top } = VENT;
        const h = -top - (MH - 6);
        g.add(mesh(new THREE.CylinderGeometry((x1 - x0) / 2, (x1 - x0) / 2 + 0.6, h, 14), hullSide, (x0 + x1) / 2, MH - 6 + h / 2, zc - 12));
        g.add(mesh(new THREE.CylinderGeometry((x1 - x0) / 2 + 3.5, (x1 - x0) / 2 + 3.5, 4, 14), mat('#6A6F82', 0.5), (x0 + x1) / 2, -top + 1, zc - 12));
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

// ---------------------------------------------------------------- Módulo de pouso e bandeira
// Base em (0, 0), como o 2D (src/space.js: drawSpaceDecor). O módulo tem o estágio de
// descida de folha dourada amassada, a cabine branca com janela triangular, a antena
// (a luzinha piscando é 2D) e quatro pernas articuladas: suporte principal com joelho,
// escora e sapata.
export const LANDER_LIGHT = { x: 14, y: -97 };
export const lander = {
  box: { left: -64, right: 64, top: 104, bottom: -12 },
  res: 2,
  elevation: 0.15,
  poses: () => [{ key: 'l' }],
  build({ THREE, mat, group, mesh, sphere, bone }) {
    const root = group();
    const foil = canvasTex(THREE, 256, 64, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, w, 0);
      grd.addColorStop(0, '#F4D06A');
      grd.addColorStop(0.5, '#D9A23A');
      grd.addColorStop(1, '#B07A24');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
      const rnd = rng(31);
      for (let i = 0; i < 70; i++) {
        g.fillStyle = rnd() < 0.5 ? `rgba(255, 240, 180, ${0.2 + rnd() * 0.3})` : `rgba(110, 70, 15, ${0.2 + rnd() * 0.3})`;
        g.beginPath();
        const x = rnd() * w;
        const y = rnd() * h;
        g.moveTo(x, y);
        for (let k = 0; k < 3; k++) g.lineTo(x + (rnd() - 0.5) * 22, y + (rnd() - 0.5) * 16);
        g.fill();
      }
    });
    const foilM = new THREE.MeshStandardMaterial({ map: foil, roughness: 0.3, metalness: 0.45, emissive: '#3A2400', emissiveIntensity: 0.3 });
    const white = mat('#DADDE6', 0.45);
    const band = mat('#9EA2B0', 0.4, { metalness: 0.3 });
    const strut = mat('#B9BCC6', 0.35, { metalness: 0.4 });
    // Estágio de descida (octogonal) e cabine
    const stage = mesh(new THREE.CylinderGeometry(29, 26, 26, 8), foilM, 0, 35, 0);
    stage.rotation.y = Math.PI / 8;
    root.add(stage);
    root.add(mesh(new THREE.CylinderGeometry(25, 25, 4, 8), band, 0, 50, 0));
    const cabin = mesh(new THREE.CylinderGeometry(17, 24, 28, 6), white, 0, 66, 0);
    cabin.rotation.y = Math.PI / 6;
    root.add(cabin);
    root.add(mesh(new THREE.CylinderGeometry(9, 12, 5, 6), band, 0, 82, -2));
    // Janela triangular na frente
    const tri = new THREE.Shape();
    tri.moveTo(-6, 0);
    tri.lineTo(0, 12);
    tri.lineTo(6, 0);
    tri.closePath();
    const win = mesh(new THREE.ExtrudeGeometry(tri, { depth: 1.5, bevelEnabled: false }), mat('#1E2A4A', 0.1, { metalness: 0.3 }), -4, 60, 20.2);
    win.rotation.x = -0.22;
    root.add(win);
    // Antena (a luzinha da ponta pisca no 2D)
    root.add(bone(0.8, [10, 80, 0], [14, 96, 0], strut));
    root.add(sphere(2, mat('#7A2A24', 0.4), 14, 97, 0, 10));
    // Pernas: suporte principal (com joelho), escora e sapata
    for (let k = 0; k < 4; k++) {
      const a = 0.35 + (k * Math.PI) / 2;
      const dx = Math.cos(a);
      const dz = Math.sin(a) * 0.7;
      const P = (r, y) => [dx * r, y, dz * r];
      const top = P(24, 40);
      const knee = P(38, 18);
      const foot = P(46, 3);
      root.add(bone(1.5, top, knee, strut));
      root.add(sphere(2.2, strut, ...knee, 10));
      root.add(bone(1.3, knee, foot, strut));
      root.add(bone(1, P(20, 26), P(36, 16), strut));
      const pad = mesh(new THREE.CylinderGeometry(7, 8, 2.5, 18), mat('#C9CCD6', 0.4, { metalness: 0.3 }), foot[0], 1.4, foot[2]);
      root.add(pad);
    }
    return { root };
  },
  apply() {},
};

export const flag = {
  box: { left: -6, right: 42, top: 70, bottom: -4 },
  res: 3,
  elevation: 0.15,
  poses: () => [{ key: 'f' }],
  build({ THREE, mat, group, mesh, bone }) {
    const root = group();
    const pole = mat('#D8DBE4', 0.3, { metalness: 0.4 });
    root.add(bone(1, [0, 0, 0], [0, 65, 0], pole));
    root.add(bone(0.7, [0, 64, 0], [34, 64, 0], pole));
    const tex = canvasTex(THREE, 128, 80, (g, w, h) => {
      g.fillStyle = '#2C6FD6';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#FFD84A';
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 ? 11 : 25;
        g.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r);
      }
      g.closePath();
      g.fill();
    });
    // Pano esticado pela haste, com ondinhas paradas (não há vento)
    const geo = new THREE.PlaneGeometry(33, 21, 16, 4);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getX(i) + 16.5) * 0.35) * 1.4 * ((pos.getX(i) + 16.5) / 33));
    geo.computeVertexNormals();
    const cloth = mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, side: THREE.DoubleSide }), 17.5, 53, 0);
    root.add(cloth);
    return { root };
  },
  apply() {},
};
