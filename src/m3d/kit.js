// Kit dos modelos 3D: materiais, formas prontas e o "estúdio" que fotografa as poses.
// Cada modelo (src/m3d/*.js) descreve: caixa da foto (em unidades do mundo, com o
// ponto de apoio em 0,0), como se monta (build), a lista de poses e como posar.
import { DEPTH } from '../config.js';

export const TAU = Math.PI * 2;

export function makeKit(THREE) {
  const cache = new Map();
  const mat = (color, rough = 0.85, extra = {}) => {
    const k = `${color}|${rough}|${JSON.stringify(extra)}`;
    if (!cache.has(k)) cache.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra }));
    return cache.get(k);
  };
  const mesh = (geo, m, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    return o;
  };
  const group = (x = 0, y = 0, z = 0) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    return g;
  };
  const sphere = (r, m, x, y, z, seg = 18) => mesh(new THREE.SphereGeometry(r, seg, Math.max(8, Math.round(seg * 0.7))), m, x, y, z);
  const capsule = (r, len, m, x, y, z) => mesh(new THREE.CapsuleGeometry(r, len, 6, 14), m, x, y, z);
  // Cápsula entre dois pontos (membros, pescoços)
  const bone = (r, a, b, m) => {
    const A = new THREE.Vector3(...a);
    const B = new THREE.Vector3(...b);
    const len = A.distanceTo(B);
    const o = mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, len), 6, 12), m);
    o.position.copy(A).add(B).multiplyScalar(0.5);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    return o;
  };
  // Pelo fofo: anel de bolinhas (no plano xz)
  const furRing = (radius, ball, count, m1, m2, sx = 1, sz = 1) => {
    const g = new THREE.Group();
    const geo = new THREE.IcosahedronGeometry(ball, 1);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU;
      const r = radius * (1 + Math.sin(i * 2.7) * 0.04);
      g.add(mesh(geo, i % 3 ? m1 : m2, Math.cos(a) * r * sx, 0, Math.sin(a) * r * sz));
    }
    return g;
  };
  // Forma torneada a partir de [raio, altura]
  const lathe = (pts, m, seg = 32) => mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), m);
  // Corpo contínuo ao longo de uma coluna (sem as emendas de esferas encostadas)
  const sweep = (spine, m, opts) => mesh(sweepGeometry(THREE, spine, opts), m);
  // Refaz a forma de um corpo contínuo (membros que dobram a cada pose)
  const resweep = (o, spine, opts) => {
    o.geometry.dispose();
    o.geometry = sweepGeometry(THREE, spine, opts);
  };
  return { THREE, mat, mesh, group, sphere, capsule, bone, furRing, lathe, sweep, resweep, furMaterial: (o) => furMaterial(THREE, o) };
}

// ---------------------------------------------------------------- Corpo contínuo
// spine: pontos { p: [x, y, z], w, h, hb? } ao longo da coluna; w = meia largura,
// h = meia altura para cima e hb para baixo (barriga mais funda ou mais rasa que o
// dorso). A coluna passa suave pelos pontos (Catmull-Rom), a seção é uma elipse e as
// pontas fecham arredondadas. "Para cima" segue `up` transportado ao longo da curva.
// UV: u em volta, v ao longo (o pelo da textura corre ao longo do corpo).
export function sweepGeometry(THREE, spine, opts = {}) {
  const { steps = Math.max(16, spine.length * 10), radial = 20, cap = 0.9, up = [0, 1, 0] } = opts;
  const n = spine.length;
  const curve = new THREE.CatmullRomCurve3(spine.map((s) => new THREE.Vector3(...s.p)), false, 'centripetal');
  // Raios interpolados com a mesma suavidade (Catmull-Rom uniforme em 1D, sem passar do limite)
  const lerp1 = (key, t) => {
    const f = t * (n - 1);
    const i = Math.min(n - 2, Math.floor(f));
    const u = f - i;
    const v = (k) => {
      const s = spine[Math.max(0, Math.min(n - 1, k))];
      return s[key] ?? (key === 'hb' ? s.h : s.w);
    };
    const p0 = v(i - 1), p1 = v(i), p2 = v(i + 1), p3 = v(i + 2);
    const r = 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
    return Math.max(0.05, Math.min(Math.max(p1, p2) * 1.08, r));
  };
  // Anéis: tampa de trás, corpo, tampa da frente
  const rings = [];
  const CAP = 5;
  const T0 = curve.getTangent(0);
  const T1 = curve.getTangent(1);
  const capR = (t) => (lerp1('w', t) + lerp1('h', t)) / 2;
  for (let k = CAP; k >= 1; k--) {
    const a = (k / (CAP + 1)) * (Math.PI / 2);
    rings.push({ t: 0, back: Math.sin(a) * capR(0) * cap, s: Math.cos(a), v: 0 });
  }
  for (let i = 0; i <= steps; i++) rings.push({ t: i / steps, back: 0, s: 1, v: i / steps });
  for (let k = 1; k <= CAP; k++) {
    const a = (k / (CAP + 1)) * (Math.PI / 2);
    rings.push({ t: 1, back: -Math.sin(a) * capR(1) * cap, s: Math.cos(a), v: 1 });
  }
  // Moldura transportada ao longo da curva (não gira de repente quando a coluna sobe)
  const pos = [];
  const uv = [];
  let N = new THREE.Vector3(...up);
  let prevT = null;
  const q = new THREE.Quaternion();
  const C = new THREE.Vector3();
  const S = new THREE.Vector3();
  const centers = [];
  for (const r of rings) {
    const T = curve.getTangent(r.t);
    if (prevT) {
      q.setFromUnitVectors(prevT, T);
      N.applyQuaternion(q);
    } else {
      N.sub(T.clone().multiplyScalar(N.dot(T)));
      if (N.lengthSq() < 1e-4) N.set(0, 0, 1).sub(T.clone().multiplyScalar(T.z));
    }
    N.normalize();
    prevT = T;
    S.crossVectors(T, N).normalize();
    curve.getPoint(r.t, C);
    if (r.back) C.addScaledVector(r.t === 0 ? T0 : T1, -r.back);
    centers.push(C.clone());
    const w = lerp1('w', r.t) * r.s;
    const h = lerp1('h', r.t) * r.s;
    const hb = lerp1('hb', r.t) * r.s;
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const hh = sn >= 0 ? h : hb;
      pos.push(C.x + S.x * w * c + N.x * hh * sn, C.y + S.y * w * c + N.y * hh * sn, C.z + S.z * w * c + N.z * hh * sn);
      uv.push(j / radial, r.v);
    }
  }
  // Pontas fechadas num ponto
  const tipBack = curve.getPoint(0).addScaledVector(T0, -capR(0) * cap);
  const tipFront = curve.getPoint(1).addScaledVector(T1, capR(1) * cap);
  const iBack = pos.length / 3;
  pos.push(tipBack.x, tipBack.y, tipBack.z);
  uv.push(0.5, 0);
  const iFront = iBack + 1;
  pos.push(tipFront.x, tipFront.y, tipFront.z);
  uv.push(0.5, 1);
  const idx = [];
  const W = radial + 1;
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * W + j, b = a + 1, c = a + W, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const last = (rings.length - 1) * W;
  for (let j = 0; j < radial; j++) {
    idx.push(iBack, j, j + 1);
    idx.push(iFront, last + j + 1, last + j);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Garante as faces viradas para fora (depende do sentido da moldura)
  const nrm = g.getAttribute('normal');
  const mid = Math.floor(rings.length / 2);
  const vi = mid * W;
  const out = new THREE.Vector3(pos[vi * 3], pos[vi * 3 + 1], pos[vi * 3 + 2]).sub(centers[mid]);
  if (out.dot(new THREE.Vector3(nrm.getX(vi), nrm.getY(vi), nrm.getZ(vi))) < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  // A costura (j = 0 e j = radial) tem a mesma posição: junta as normais dos dois lados
  const nn = g.getAttribute('normal');
  for (let i = 0; i < rings.length; i++) {
    const a = i * W, b = a + radial;
    const x = nn.getX(a) + nn.getX(b), y = nn.getY(a) + nn.getY(b), z = nn.getZ(a) + nn.getZ(b);
    const l = Math.hypot(x, y, z) || 1;
    nn.setXYZ(a, x / l, y / l, z / l);
    nn.setXYZ(b, x / l, y / l, z / l);
  }
  return g;
}

// ---------------------------------------------------------------- Pelo
// Material de pelo: textura de fios (cor) e o mesmo desenho como relevo (bumpMap),
// então a luz pega nas mechas. Fios correm ao longo de v (ao longo do corpo).
const furCache = new Map();
export function furMaterial(THREE, { base, light, dark, seed = 1, repeat = [3, 3], strands = 900, len = 9, bump = 0.6 }) {
  const k = [base, light, dark, seed, repeat, strands, len, bump].join('|');
  if (furCache.has(k)) return furCache.get(k);
  const W = 256, H = 256;
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const paint = (colorful) => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = colorful ? base : '#808080';
    g.fillRect(0, 0, W, H);
    s = seed;
    g.lineCap = 'round';
    for (let i = 0; i < strands; i++) {
      const x = rnd() * W, y = rnd() * H;
      const l = len * (0.6 + rnd() * 0.8);
      const bendX = (rnd() - 0.5) * 4;
      const tone = rnd();
      g.strokeStyle = colorful ? (tone < 0.5 ? light : dark) : tone < 0.5 ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
      g.globalAlpha = colorful ? 0.35 : 0.8;
      g.lineWidth = 1 + rnd() * 1.4;
      // Desenha de novo nas bordas para a textura emendar sem costura
      for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) {
        if (x + ox < -20 || x + ox > W + 20 || y + oy < -20 || y + oy > H + 20) continue;
        g.beginPath();
        g.moveTo(x + ox, y + oy);
        g.quadraticCurveTo(x + ox + bendX, y + oy + l * 0.5, x + ox + bendX * 1.5, y + oy + l);
        g.stroke();
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
    if (colorful) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const m = new THREE.MeshStandardMaterial({ map: paint(true), bumpMap: paint(false), bumpScale: bump, roughness: 0.95, metalness: 0 });
  furCache.set(k, m);
  return m;
}

// ---------------------------------------------------------------- Estúdio
// Um renderizador WebGL só, reaproveitado por todos os modelos. Luz principal do alto
// à esquerda (onde fica o sol), luz do céu, luz de borda e sombra própria.
export class Studio {
  constructor(THREE) {
    this.THREE = THREE;
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }));
    r.setPixelRatio(1);
    r.setClearColor(0x000000, 0);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    const key = (this.key = new THREE.DirectionalLight('#FFF1DC', 2.6));
    key.position.set(-160, 200, 170);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -160, right: 160, top: 160, bottom: -160, near: 1, far: 900 });
    key.shadow.bias = -0.002;
    key.shadow.radius = 3;
    this.scene.add(key);
    this.sky = new THREE.HemisphereLight('#CFE6FF', '#8C7A66', 1.1);
    this.scene.add(this.sky);
    this.rim = new THREE.DirectionalLight('#DDEBFF', 1.6);
    this.rim.position.set(180, 80, -160);
    this.scene.add(this.rim);
    this.kit = makeKit(THREE);
  }

  // Monta o modelo e devolve um gerador que fotografa `chunk` poses por vez
  *shoot(subject, chunk = 6) {
    const THREE = this.THREE;
    const S = subject.res ?? DEPTH.model3d.resolution;
    const b = subject.box;
    const w = Math.round((b.right - b.left) * S);
    const h = Math.round((b.top - b.bottom) * S);
    this.renderer.setSize(w, h, false);
    // Distância da câmera: cenários grandes precisam dela mais longe (só desloca ao longo
    // da direção de visão; na câmera ortográfica a foto não muda)
    const dist = subject.distance ?? 600;
    const cam = new THREE.OrthographicCamera(b.left, b.right, b.top, b.bottom, 1, dist * 2 + 1400);
    const el = subject.elevation ?? DEPTH.model3d.elevation;
    cam.position.set(0, Math.sin(el) * dist, Math.cos(el) * dist);
    cam.lookAt(0, 0, 0);
    const rig = subject.build(this.kit);
    this.scene.add(rig.root);
    // Luz e névoa próprias do modelo (cenários); desfeitas no fim
    const restore = subject.stage?.(this);
    const out = {};
    let n = 0;
    try {
      // Cenários (cena grande): montar e fotografar em passos separados, sem travar de uma vez
      if (subject.distance) yield null;
      for (const p of subject.poses()) {
        subject.apply(rig, p, this.kit);
        rig.root.updateMatrixWorld(true);
        this.renderer.render(this.scene, cam);
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.getContext('2d').drawImage(this.renderer.domElement, 0, 0);
        out[p.key] = c;
        if (++n % chunk === 0) yield null;
      }
    } finally {
      this.scene.remove(rig.root);
      restore?.();
    }
    return out;
  }

  // Luz de cenário: a luz principal cobre uma área grande (sombra em alta resolução),
  // com névoa atmosférica. Devolve a função que volta tudo ao normal.
  stageScenery({ target, size, mapSize = 2048, fog = null, sky = null, ground = null, keyIntensity = null, sun = null, exposure = null }) {
    const { key, scene } = this;
    const was = {
      pos: key.position.clone(), tgt: key.target.position.clone(), cam: (({ left, right, top, bottom, near, far }) => ({ left, right, top, bottom, near, far }))(key.shadow.camera), map: key.shadow.mapSize.clone(),
      fog: scene.fog, sky: this.sky.intensity, ground: this.sky.groundColor.clone(), ki: key.intensity, bias: key.shadow.bias, exp: this.renderer.toneMappingExposure,
    };
    const resetMap = () => {
      key.shadow.map?.dispose();
      key.shadow.map = null;
    };
    // Direção do sol: a dos personagens (do alto à esquerda, um pouco de frente) ou a do cenário
    const dir = (sun ? new this.THREE.Vector3(...sun) : was.pos.clone()).normalize();
    key.target.position.set(...target);
    key.position.set(target[0] + dir.x * 1500, target[1] + dir.y * 1500, target[2] + dir.z * 1500);
    scene.add(key.target);
    Object.assign(key.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 1, far: 4000 });
    key.shadow.camera.updateProjectionMatrix();
    key.shadow.mapSize.set(mapSize, mapSize);
    key.shadow.bias = -0.0006;
    resetMap();
    if (fog) scene.fog = new this.THREE.Fog(fog.color, fog.near, fog.far);
    if (sky != null) this.sky.intensity = sky;
    if (ground) this.sky.groundColor.set(ground);
    if (keyIntensity != null) key.intensity = keyIntensity;
    if (exposure != null) this.renderer.toneMappingExposure = exposure;
    return () => {
      this.renderer.toneMappingExposure = was.exp;
      key.position.copy(was.pos);
      key.target.position.copy(was.tgt);
      scene.remove(key.target);
      Object.assign(key.shadow.camera, was.cam);
      key.shadow.camera.updateProjectionMatrix();
      key.shadow.mapSize.copy(was.map);
      key.shadow.bias = was.bias;
      resetMap();
      scene.fog = was.fog;
      this.sky.intensity = was.sky;
      this.sky.groundColor.copy(was.ground);
      key.intensity = was.ki;
    };
  }
}
