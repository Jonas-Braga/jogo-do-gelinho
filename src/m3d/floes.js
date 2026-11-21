// Placas de gelo da fase normal em 3D: bloco de contorno irregular com quinas
// arredondadas, topo de neve, lateral azulada, rachaduras e a massa submersa
// translúcida. A foto tem as MESMAS medidas do sprite 2D (src/sprites.js:
// floeSprite), para ser desenhada no lugar dele sem mudar nada no resto.
// Medidas do sprite 2D (pés na linha y = 0, que fica FLOE_TOP abaixo do topo da foto)
export const PAD = 10;
export const TOP = 22;
export const H = 70;
export const VARIANTS = 4;
// Visto bem de cima (o topo da placa ocupa ~22 px na foto, como no 2D)
const ELEVATION = 0.7;
const DEPTH = 34;

export const variantOf = (piece) => piece.seed % VARIANTS;

const subjects = new Map();
export function floeSubject(w) {
  if (subjects.has(w)) return subjects.get(w);
  const subject = {
    box: { left: -PAD, right: w + PAD, top: TOP, bottom: TOP - H },
    res: 2.2,
    elevation: ELEVATION,
    poses() {
      const out = [];
      for (let v = 0; v < VARIANTS; v++) for (const on of [0, 1]) out.push({ key: `${v}${on}`, v, on });
      return out;
    },
    build(kit) {
      return buildFloe(kit, w);
    },
    apply(rig, p) {
      rig.variants.forEach((g, i) => (g.visible = i === p.v));
      for (const m of rig.meshes) {
        m.top.material = p.on ? rig.mats.topOn : rig.mats.top;
        m.side.material = p.on ? rig.mats.sideOn : rig.mats.side;
      }
      for (const l of rig.lumps) l.material = p.on ? rig.mats.snowOn : rig.mats.snow;
    },
  };
  subjects.set(w, subject);
  return subject;
}

function buildFloe(kit, w) {
  const { THREE, mat, group, mesh, bone } = kit;
  const mats = {
    top: mat('#FFFFFF', 0.6, { emissive: '#E8F4FA', emissiveIntensity: 0.12 }),
    side: mat('#A8D4E4', 0.15),
    topOn: mat('#C9F1FF', 0.4, { emissive: '#3FB2E0', emissiveIntensity: 0.3 }),
    sideOn: mat('#4FAFD9', 0.15, { emissive: '#1D6F99', emissiveIntensity: 0.25 }),
    under: mat('#9ED8EE', 0.2, { transparent: true, opacity: 0.16, depthWrite: false }),
    crack: mat('#A7C4CF', 0.6),
    snow: mat('#FFFFFF', 0.9, { emissive: '#FFFFFF', emissiveIntensity: 0.08 }),
    snowOn: mat('#E2F8FF', 0.6, { emissive: '#7FD3F0', emissiveIntensity: 0.25 }),
  };
  // Alturas (ver o cálculo: a foto bate com o sprite 2D)
  const top = 2.7;
  const water = -9.1;
  const bev = 3.4;
  const root = group();
  const variants = [];
  const meshes = [];
  const lumps = [];
  for (let v = 0; v < VARIANTS; v++) {
    let seed = (v + 1) * 7919;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const g = group();
    // Contorno de bloco de gelo (visto de cima): retângulo de cantos bem arredondados,
    // com o raio variando um pouco em cada ponto
    const hx = w / 2 - bev;
    const hz = DEPTH / 2 - bev;
    const shape = new THREE.Shape();
    const N = 22;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const k = 1 - rnd() * 0.12;
      const x = w / 2 + hx * Math.sign(c) * Math.abs(c) ** 0.35 * k;
      const z = hz * Math.sign(sn) * Math.abs(sn) ** 0.35 * (1 - rnd() * 0.16);
      if (i) shape.lineTo(x, z);
      else shape.moveTo(x, z);
    }
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: top - water - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 4, curveSegments: 6,
    });
    // ExtrudeGeometry tem 2 grupos: tampas (topo/fundo) e laterais
    const block = new THREE.Mesh(geo, [mats.top, mats.side]);
    block.castShadow = true;
    block.receiveShadow = true;
    block.rotation.x = -Math.PI / 2;
    block.position.y = water + bev;
    const top3 = { get material() { return block.material[0]; }, set material(m) { block.material[0] = m; } };
    const side3 = { get material() { return block.material[1]; }, set material(m) { block.material[1] = m; } };
    meshes.push({ top: top3, side: side3 });
    g.add(block);
    // Massa submersa (translúcida): o mesmo contorno, um pouco menor, afundando
    const ug = new THREE.ExtrudeGeometry(shape, { depth: 24, bevelEnabled: false, curveSegments: 6 });
    const under = mesh(ug, mats.under, w * 0.08, water - 0.5, 0);
    under.rotation.x = Math.PI / 2;
    under.scale.set(0.84, 1, 1);
    under.castShadow = false;
    under.receiveShadow = false;
    g.add(under);
    // Montinhos de neve no topo
    const nl = 2 + Math.round(rnd() * 2) + Math.round(w / 60);
    for (let i = 0; i < nl; i++) {
      const r = 3 + rnd() * Math.min(7, w * 0.09);
      const lp = kit.sphere(r, mats.snow, w * (0.15 + rnd() * 0.7), top + 0.4, (rnd() - 0.5) * hz * 1.2, 14);
      lp.scale.set(1.3, 0.28, 1);
      g.add(lp);
      lumps.push(lp);
    }
    // Rachaduras finas no topo
    for (let k = 0; k < 2; k++) {
      let x = w * (0.2 + rnd() * 0.6);
      let z = -hz * 0.7;
      for (let j = 0; j < 3; j++) {
        const nx = Math.max(4, Math.min(w - 4, x + (rnd() - 0.5) * 12));
        const nz = z + 6 + rnd() * 5;
        const c = bone(0.3, [x, top + 0.2, z], [nx, top + 0.2, nz], mats.crack);
        c.castShadow = false;
        g.add(c);
        x = nx;
        z = nz;
      }
    }
    root.add(g);
    variants.push(g);
  }
  return { root, variants, meshes, mats, lumps };
}
