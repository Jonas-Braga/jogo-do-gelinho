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
  return { THREE, mat, mesh, group, sphere, capsule, bone, furRing, lathe };
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
    const cam = new THREE.OrthographicCamera(b.left, b.right, b.top, b.bottom, 1, 2000);
    const el = subject.elevation ?? DEPTH.model3d.elevation;
    cam.position.set(0, Math.sin(el) * 600, Math.cos(el) * 600);
    cam.lookAt(0, 0, 0);
    const rig = subject.build(this.kit);
    this.scene.add(rig.root);
    const out = {};
    let n = 0;
    try {
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
    }
    return out;
  }
}
