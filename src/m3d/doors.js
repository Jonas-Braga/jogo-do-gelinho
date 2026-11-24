// Portas e cortinas 3D (etapa 4 da cena toda em 3D): o interior escuro em relevo de cada
// casa (aceso depois que o personagem entra), a folha que fecha (cortina de pele do
// iglu, porta de tábuas da cabana girando na dobradiça, folhas de metal de correr da
// base lunar, cortina de folhas de coqueiro da cabana de palha, porta gótica da casa
// assombrada) e o batente. Na caverna, a pedra redonda que rola e tampa a entrada.
//
// Fotos de cada modelo (origem no meio da base da porta, y para cima):
//   "in0"/"in1"  interior apagado/aceso (atrás de quem entra)
//   "k0".."k12"  a folha com a porta 0/12 .. 12/12 fechada
//   "frame"      o batente (por cima de quem entra); na base, "frame0"/"frame1" com a
//                luz da câmara de ar vermelha (vazia) ou verde (alguém lá dentro)
// A pedra da caverna é um modelo à parte ("door-stone", origem no centro dela) com
// fotos "r0".."r23" girada de 15 em 15 graus; o resto do giro é feito em 2D.
// Brilho da luz de dentro, luz vazando pelas frestas e a sombra sobre quem entra
// continuam como luz 2D por cima (src/igloo.js e os arquivos de cada tema).
import { IGLOO } from '../config.js';

const DW = IGLOO.doorRx;     // meia largura da abertura (25)
const DH = IGLOO.doorH;      // altura da abertura (68)
export const LEAF_STEPS = 12;
export const STONE_STEPS = 24;
export const STONE_R = IGLOO.doorH / 2 + 5; // o mesmo raio da pedra 2D (src/dino.js)
const ELEVATION = 0.1;
const DEEP = 26;             // profundidade do interior

// ---------------------------------------------------------------- Contornos
// Contorno da abertura de cada casa (polígono, y para cima, base em 0)
function arc(cx, cy, rx, ry, a0, a1, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}
function quad(p0, c, p1, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]);
  }
  return out;
}
export const OUTLINES = {
  igloo: () => [[DW, 0], ...arc(0, 0, DW, DH, 0, Math.PI, 24).slice(1), [-DW, 0]],
  cabin: () => [[-DW, 0], [DW, 0], [DW, DH], [-DW, DH]],
  hut: () => [[-DW, 0], [DW, 0], [DW, DH], [-DW, DH]],
  base: () => [[-DW, 0], [DW, 0], ...arc(DW - 14, DH - 14, 14, 14, 0, Math.PI / 2, 6), ...arc(-DW + 14, DH - 14, 14, 14, Math.PI / 2, Math.PI, 6), [-DW, 0]],
  haunted: () => [[-DW, 0], [DW, 0], [DW, DH - 8], ...quad([DW, DH - 8], [DW, DH + 8], [0, DH + 14], 8).slice(1), ...quad([0, DH + 14], [-DW, DH + 8], [-DW, DH - 8], 8).slice(1)],
  cave: () => [[-DW, 0], [DW, 0], ...arc(0, DH - DW, DW, DW, 0, Math.PI, 16), [-DW, 0]],
};

// Recorta um polígono pelo semiplano a·x + b·y ≥ c (Sutherland–Hodgman)
function clip(poly, a, b, c) {
  const out = [];
  const inside = (p) => a * p[0] + b * p[1] >= c - 1e-9;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const ip = inside(p);
    const iq = inside(q);
    if (ip) out.push(p);
    if (ip !== iq) {
      const dp = a * p[0] + b * p[1] - c;
      const dq = a * q[0] + b * q[1] - c;
      const t = dp / (dp - dq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}
export const clipPoly = clip;

function shapeOf(THREE, poly) {
  const s = new THREE.Shape();
  poly.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}

// ---------------------------------------------------------------- Texturas
function canvasTex(THREE, w, h, paint, repeat = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  return t;
}
const seeded = (seed) => {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
};

// Tábuas verticais (porta da cabana e da casa assombrada); UV = unidades do mundo
function planksTex(THREE, base, dark, plank, seed) {
  return canvasTex(THREE, 128, 128, (g) => {
    const rnd = seeded(seed);
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 128);
    const n = 4;
    for (let i = 0; i < n; i++) {
      const x = (i * 128) / n;
      g.fillStyle = `rgba(0,0,0,${0.06 + rnd() * 0.1})`;
      g.fillRect(x, 0, 128 / n, 128);
      g.fillStyle = dark;
      for (let j = 0; j < 9; j++) g.fillRect(x + 3 + rnd() * 24, 0, 0.8 + rnd(), 128);
      g.fillStyle = 'rgba(0,0,0,0.65)';
      g.fillRect(x, 0, 2, 128);
      // Nó da madeira
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.beginPath();
      g.ellipse(x + 8 + rnd() * 16, rnd() * 128, 2.5, 4, 0, 0, Math.PI * 2);
      g.fill();
    }
  }, [1 / (plank * 4), 1 / 128]);
}

// Pele da cortina do iglu: pelo com as costuras verticais
function hideTex(THREE) {
  return canvasTex(THREE, 128, 128, (g) => {
    const rnd = seeded(7);
    const gr = g.createLinearGradient(0, 0, 128, 0);
    gr.addColorStop(0, '#5A3E26');
    gr.addColorStop(0.45, '#8A6440');
    gr.addColorStop(1, '#4E351F');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    g.lineCap = 'round';
    for (let i = 0; i < 900; i++) {
      const x = rnd() * 128;
      const y = rnd() * 128;
      g.strokeStyle = rnd() < 0.5 ? 'rgba(180,140,90,0.35)' : 'rgba(40,25,12,0.35)';
      g.lineWidth = 1 + rnd();
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rnd() - 0.5) * 3, y + 4 + rnd() * 5);
      g.stroke();
    }
    g.strokeStyle = 'rgba(40,25,12,0.7)';
    g.setLineDash([5, 5]);
    g.lineWidth = 1.6;
    for (const x of [50, 82]) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + 2, 128);
      g.stroke();
    }
  }, [1 / (DW * 2), 1 / DH]);
}

// Faixa de aviso amarela e preta do batente da base
function hazardTex(THREE) {
  return canvasTex(THREE, 128, 16, (g) => {
    g.fillStyle = '#F2C230';
    g.fillRect(0, 0, 128, 16);
    g.fillStyle = '#1E1E24';
    for (let x = -16; x < 144; x += 16) {
      g.beginPath();
      g.moveTo(x, 16);
      g.lineTo(x + 8, 16);
      g.lineTo(x + 16, 0);
      g.lineTo(x + 8, 0);
      g.fill();
    }
  }, [1, 1]);
}

// Pedra da caverna com a mãozinha pintada
function stoneTex(THREE) {
  return canvasTex(THREE, 256, 128, (g) => {
    const rnd = seeded(11);
    g.fillStyle = '#8A7C70';
    g.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(60,48,40,0.25)' : 'rgba(200,190,175,0.2)';
      g.fillRect(rnd() * 256, rnd() * 128, 1 + rnd() * 4, 1 + rnd() * 3);
    }
    g.strokeStyle = 'rgba(40,30,24,0.5)';
    g.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      let x = rnd() * 256;
      let y = rnd() * 128;
      g.moveTo(x, y);
      for (let j = 0; j < 4; j++) g.lineTo((x += (rnd() - 0.5) * 30), (y += (rnd() - 0.5) * 20));
      g.stroke();
    }
    // Mãozinha rupestre (de frente quando a pedra fecha a entrada)
    g.fillStyle = 'rgba(180,62,36,0.85)';
    g.beginPath();
    g.ellipse(64, 70, 8, 10, 0, 0, Math.PI * 2);
    g.fill();
    for (let i = 0; i < 4; i++) g.fillRect(56 + i * 5, 46, 3.4, 16);
    g.save();
    g.translate(72, 72);
    g.rotate(-0.8);
    g.fillRect(0, -2, 12, 4);
    g.restore();
  }, [1, 1]);
}

// ---------------------------------------------------------------- Peças comuns
// Interior: a abertura cavada para dentro (paredes e fundo vistos por dentro)
// O fundo é menor que a boca (como visto em perspectiva), então as paredes de dentro
// aparecem mesmo com a câmera quase de frente: o lado da luz mais claro, o teto escuro
function interior(kit, poly, colors) {
  const { THREE, group } = kit;
  const g = group();
  const back = poly.map(([x, y]) => [x * 0.66, y * 0.8]);
  const pos = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const c = back[(i + 1) % n];
    const d = back[i];
    pos.push(a[0], a[1], -0.5, b[0], b[1], -0.5, c[0], c[1], -DEEP, a[0], a[1], -0.5, c[0], c[1], -DEEP, d[0], d[1], -DEEP);
  }
  const walls = new THREE.BufferGeometry();
  walls.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  walls.computeVertexNormals();
  const fundo = new THREE.ShapeGeometry(shapeOf(THREE, back), 4);
  fundo.translate(0, 0, -DEEP);
  const mk = (color, emissive, ei) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, side: THREE.DoubleSide, emissive, emissiveIntensity: ei });
  const build = (wallM, backM) => {
    const o = group();
    const w = new THREE.Mesh(walls, wallM);
    const f = new THREE.Mesh(fundo, backM);
    w.receiveShadow = f.receiveShadow = true;
    o.add(w, f);
    return o;
  };
  const off = build(mk(colors.dark, '#000000', 0), mk(colors.dark, '#000000', 0));
  const on = build(mk(colors.lit, colors.glow, 0.18), mk(colors.lit, colors.glow, 0.5));
  // Fogo/lamparina lá dentro, um pouco à direita do fundo
  const light = new THREE.PointLight(colors.glow, 1400, 90, 2);
  light.position.set(6, DH * 0.3, -DEEP + 8);
  on.add(light);
  g.add(off, on);
  return { group: g, off, on };
}

// Folha que gira na dobradiça da esquerda (cabana e casa assombrada): vista de cima, ela
// gira para dentro da casa (de lado, quase some)
function hingedLeaf(kit, poly, mat, extras) {
  const { THREE, group, mesh } = kit;
  const pivot = group(-DW, 0, -1.5);
  const geo = new THREE.ExtrudeGeometry(shapeOf(THREE, poly.map(([x, y]) => [x + DW - 0.6, y])), {
    depth: 3, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.6, bevelSegments: 1, curveSegments: 4,
  });
  geo.translate(0, 0, -1.5);
  pivot.add(mesh(geo, mat));
  extras?.(pivot);
  return pivot;
}

const leafPoses = () => Array.from({ length: LEAF_STEPS + 1 }, (_, i) => ({ key: `k${i}`, k: i / LEAF_STEPS }));
const basePoses = (frames = ['frame']) => [{ key: 'in0' }, { key: 'in1', lit: true }, ...frames.map((f) => ({ key: f, frame: f })), ...leafPoses()];

// Mostra só a parte da pose (interior, folha ou batente)
function show(rig, p) {
  rig.inside.group.visible = p.key === 'in0' || p.key === 'in1';
  rig.inside.off.visible = p.key === 'in0';
  rig.inside.on.visible = p.key === 'in1';
  rig.leaf.visible = p.k != null && p.k > 0;
  if (rig.frame) rig.frame.visible = !!p.frame;
}

const BOX = { left: -62, right: 62, top: DH + 32, bottom: -12 };

// ---------------------------------------------------------------- Iglu
// Cortina de pele que desce do alto do arco, com dobras e a barra pesada embaixo
export const iglooDoor = {
  box: BOX, res: 2, elevation: ELEVATION,
  poses: () => basePoses([]),
  build(kit) {
    const { THREE, group } = kit;
    const root = group();
    const inside = interior(kit, OUTLINES.igloo(), { dark: '#2A4A58', lit: '#D89A60', glow: '#FF9A40' });
    const mat = new THREE.MeshStandardMaterial({ map: hideTex(THREE), roughness: 0.95, side: THREE.DoubleSide });
    const leaf = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    leaf.castShadow = leaf.receiveShadow = true;
    root.add(inside.group, leaf);
    return { root, inside, leaf, mat };
  },
  apply(rig, p, kit) {
    show(rig, p);
    if (!(p.k > 0)) return;
    const { THREE } = kit;
    const y0 = DH - (DH * p.k + 2);
    const poly = clip(OUTLINES.igloo().map(([x, y]) => [x * 0.98, y]), 0, 1, y0);
    const geo = new THREE.ShapeGeometry(shapeOf(THREE, poly), 6);
    // Dobras: a pele ondula para a frente e para trás; a barra de baixo é mais funda
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      pos.setZ(i, 1.2 + Math.sin(x * 0.42 + 0.8) * 1.6 + Math.max(0, 6 - (y - y0)) * 0.25);
    }
    geo.computeVertexNormals();
    rig.leaf.geometry.dispose();
    rig.leaf.geometry = geo;
  },
};

// ---------------------------------------------------------------- Cabana
export const cabinDoor = {
  box: BOX, res: 2, elevation: ELEVATION,
  poses: () => basePoses(),
  build(kit) {
    const { THREE, group, mesh, mat } = kit;
    const root = group();
    const inside = interior(kit, OUTLINES.cabin(), { dark: '#3A2A1C', lit: '#C88A50', glow: '#FF9A40' });
    const wood = new THREE.MeshStandardMaterial({ map: planksTex(THREE, '#7E5230', 'rgba(50,28,10,0.35)', DW * 0.5, 5), roughness: 0.85 });
    const brace = mat('#5A361A', 0.85);
    const leaf = hingedLeaf(kit, OUTLINES.cabin(), wood, (pv) => {
      // Travessas em Z e maçaneta
      pv.add(mesh(new THREE.BoxGeometry(DW * 2 - 3, 5, 2), brace, DW, DH - 12, 2.2));
      pv.add(mesh(new THREE.BoxGeometry(DW * 2 - 3, 5, 2), brace, DW, 13, 2.2));
      const diag = mesh(new THREE.BoxGeometry(Math.hypot(DW * 2 - 8, DH - 30), 4, 1.6), brace, DW, DH / 2, 2.2);
      diag.rotation.z = Math.atan2(DH - 30, DW * 2 - 8);
      pv.add(diag);
      pv.add(mesh(new THREE.SphereGeometry(2.4, 12, 8), mat('#D9B048', 0.35, { metalness: 0.6 }), DW * 2 - 7, DH / 2 - 4, 3.4));
    });
    // Batente: dois postes e a verga (madeira escura com quina clara)
    const frame = group();
    const dark = mat('#5E3A1E', 0.8);
    frame.add(mesh(new THREE.BoxGeometry(6, DH + 7, 8), dark, -DW - 3, (DH + 7) / 2, 0));
    frame.add(mesh(new THREE.BoxGeometry(6, DH + 7, 8), dark, DW + 3, (DH + 7) / 2, 0));
    frame.add(mesh(new THREE.BoxGeometry(DW * 2 + 18, 7, 10), dark, 0, DH + 5.5, 0.5));
    root.add(inside.group, leaf, frame);
    return { root, inside, leaf, frame };
  },
  apply(rig, p) {
    show(rig, p);
    if (p.k != null) rig.leaf.rotation.y = (1 - p.k) * 1.7;
  },
};

// ---------------------------------------------------------------- Base lunar
export const baseDoor = {
  box: BOX, res: 2, elevation: ELEVATION,
  poses: () => basePoses(['frame0', 'frame1']),
  build(kit) {
    const { THREE, group, mesh, mat } = kit;
    const root = group();
    const inside = interior(kit, OUTLINES.base(), { dark: '#2A2E48', lit: '#C89068', glow: '#FF9A40' });
    const leaf = group();
    const metal = mat('#D3D7E0', 0.45, { metalness: 0.2 });
    const groove = mat('#5A6078', 0.6, { metalness: 0.4 });
    leaf.userData = { metal, groove };
    // Batente: tubo de metal em volta, faixa de aviso e a luz da câmara de ar
    const frame = group();
    const outline = OUTLINES.base().slice(1, -1);
    const curve = new THREE.CatmullRomCurve3([[DW + 3, -1], ...outline.map(([x, y]) => [x * 1.12, y * 1.04]), [-DW - 3, -1]].map(([x, y]) => new THREE.Vector3(x, y, 0)));
    frame.add(mesh(new THREE.TubeGeometry(curve, 60, 3.2, 8, false), mat('#6A6F82', 0.45, { metalness: 0.6 })));
    const stripe = new THREE.MeshStandardMaterial({ map: hazardTex(THREE), roughness: 0.6 });
    frame.add(mesh(new THREE.BoxGeometry(DW * 2 + 16, 5, 3), stripe, 0, DH + 8.5, 1));
    const lamp = { red: mat('#C0392B', 0.3, { emissive: '#7A1A10', emissiveIntensity: 0.6 }), green: mat('#6EFF96', 0.3, { emissive: '#3AFF70', emissiveIntensity: 1.2 }) };
    const bulb = mesh(new THREE.SphereGeometry(3, 14, 10), lamp.red, DW + 10, DH - 8, 2);
    frame.add(bulb);
    root.add(inside.group, leaf, frame);
    return { root, inside, leaf, frame, bulb, lamp };
  },
  apply(rig, p, kit) {
    show(rig, p);
    rig.bulb.material = p.frame === 'frame1' ? rig.lamp.green : rig.lamp.red;
    if (!(p.k > 0)) return;
    const { THREE, mesh } = kit;
    for (const c of [...rig.leaf.children]) {
      rig.leaf.remove(c);
      c.geometry.dispose();
    }
    const { metal, groove } = rig.leaf.userData;
    const half = DW * p.k;
    // Duas folhas: cada uma sai de um lado com a largura que já correu
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? -DW : DW - half;
      const poly = clip(clip(OUTLINES.base(), 1, 0, x0 + 0.4), -1, 0, -(x0 + half - 0.4));
      if (poly.length < 3) continue;
      const geo = new THREE.ExtrudeGeometry(shapeOf(THREE, poly), { depth: 2.4, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.5, bevelSegments: 1 });
      geo.translate(0, 0, -1.5);
      rig.leaf.add(mesh(geo, metal));
      // Friso no meio da altura e a borda de vedação na beira que corre
      rig.leaf.add(mesh(new THREE.BoxGeometry(half, 2, 0.8), groove, x0 + half / 2, DH * 0.55, 1.5));
      const edge = s < 0 ? x0 + half - 1 : x0 + 1;
      rig.leaf.add(mesh(new THREE.BoxGeometry(1.6, DH - 6, 1.2), groove, edge, (DH - 6) / 2, 1.3));
    }
  },
};

// ---------------------------------------------------------------- Cabana de palha
// Cortina de folhas de coqueiro: 7 folhas penduradas que descem e balançam
export const hutDoor = {
  box: BOX, res: 2, elevation: ELEVATION,
  poses: () => basePoses(),
  build(kit) {
    const { THREE, group, mesh, mat } = kit;
    const root = group();
    const inside = interior(kit, OUTLINES.hut(), { dark: '#4A3820', lit: '#C88A50', glow: '#FF9A40' });
    const leaf = group();
    leaf.userData = { greens: [mat('#3DB35A', 0.7), mat('#2F9E4A', 0.7)], rib: mat('#C9D86A', 0.7) };
    // Batente de bambu: dois postes com os nós e a verga
    const frame = group();
    const bamboo = mat('#B08A40', 0.6);
    const node = mat('#7A5A24', 0.6);
    for (const s of [-1, 1]) {
      frame.add(mesh(new THREE.CylinderGeometry(2.8, 2.8, DH + 6, 10), bamboo, s * (DW + 2.5), (DH + 6) / 2, 0));
      for (let y = 8; y < DH; y += 12) {
        const ring = mesh(new THREE.TorusGeometry(2.9, 0.6, 6, 12), node, s * (DW + 2.5), y, 0);
        ring.rotation.x = Math.PI / 2;
        frame.add(ring);
      }
    }
    const lintel = mesh(new THREE.CylinderGeometry(3, 3, DW * 2 + 16, 10), bamboo, 0, DH + 6.5, 0.5);
    lintel.rotation.z = Math.PI / 2;
    frame.add(lintel);
    root.add(inside.group, leaf, frame);
    return { root, inside, leaf, frame };
  },
  apply(rig, p, kit) {
    show(rig, p);
    if (!(p.k > 0)) return;
    const { THREE, mesh } = kit;
    for (const c of [...rig.leaf.children]) {
      rig.leaf.remove(c);
      c.geometry.dispose();
    }
    const { greens, rib } = rig.leaf.userData;
    const h = DH * p.k;
    for (let i = 0; i < 7; i++) {
      const x = -DW + 3 + (i * (DW * 2 - 6)) / 6;
      const sway = (i % 2 ? 1 : -1) * (1 - p.k) * 3;
      // Folha: fita que afina na ponta, curva para a frente
      const pts = [];
      for (let j = 0; j <= 8; j++) {
        const u = j / 8;
        pts.push(new THREE.Vector3(x + sway * u * u, DH - u * h, 1 + Math.sin(u * Math.PI) * 2.5 + (i % 2) * 0.8));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const tube = new THREE.TubeGeometry(curve, 12, 4.6, 6, false);
      // Achatada como folha (mais larga que funda)
      const pos = tube.attributes.position;
      for (let v = 0; v < pos.count; v++) {
        const u = Math.min(1, Math.max(0, (DH - pos.getY(v)) / Math.max(1, h)));
        const cx = x + sway * u * u;
        const taper = 1 - u * 0.3;
        pos.setX(v, cx + (pos.getX(v) - cx) * taper);
        pos.setZ(v, 1 + (pos.getZ(v) - 1) * 0.35);
      }
      tube.computeVertexNormals();
      rig.leaf.add(mesh(tube, greens[i % 2]));
      rig.leaf.add(mesh(new THREE.TubeGeometry(curve, 12, 0.5, 4, false), rib));
    }
  },
};

// ---------------------------------------------------------------- Casa assombrada
export const hauntedDoor = {
  box: BOX, res: 2, elevation: ELEVATION,
  poses: () => basePoses(),
  build(kit) {
    const { THREE, group, mesh, mat } = kit;
    const root = group();
    const inside = interior(kit, OUTLINES.haunted(), { dark: '#2A1E36', lit: '#B87A50', glow: '#FF9040' });
    const wood = new THREE.MeshStandardMaterial({ map: planksTex(THREE, '#5E3C24', 'rgba(0,0,0,0.35)', DW * 0.5, 13), roughness: 0.9 });
    const iron = mat('#2A2630', 0.5, { metalness: 0.5 });
    const leafPoly = OUTLINES.haunted().map(([x, y]) => [x * 0.98, y - 1]);
    const leaf = hingedLeaf(kit, leafPoly, wood, (pv) => {
      // Dobradiças de ferro compridas e a argola
      for (const y of [14, DH - 10]) pv.add(mesh(new THREE.BoxGeometry(DW * 1.3, 3.4, 1.4), iron, DW * 0.65, y, 2.2));
      const ring = mesh(new THREE.TorusGeometry(3.6, 0.8, 8, 16), mat('#C9A44A', 0.35, { metalness: 0.7 }), DW * 2 - 9, DH * 0.5, 2.6);
      pv.add(ring);
      pv.add(mesh(new THREE.SphereGeometry(1.6, 10, 8), iron, DW * 2 - 9, DH * 0.5 + 4, 2.4));
    });
    // Batente em arco gótico e o degrau de pedra
    const frame = group();
    const outline = OUTLINES.haunted().slice(2);
    const curve = new THREE.CatmullRomCurve3([[DW + 2, 0], ...outline.map(([x, y]) => [x * 1.08, y + 1.5]), [-DW - 2, 0]].map(([x, y]) => new THREE.Vector3(x, y, 0)));
    frame.add(mesh(new THREE.TubeGeometry(curve, 50, 3.2, 8, false), mat('#1A1224', 0.85)));
    frame.add(mesh(new THREE.BoxGeometry(DW * 2 + 20, 5, 12), mat('#5A5468', 0.95), 0, -0.5, 3));
    root.add(inside.group, leaf, frame);
    return { root, inside, leaf, frame };
  },
  apply(rig, p) {
    show(rig, p);
    if (p.k != null) rig.leaf.rotation.y = (1 - p.k) * 1.7;
  },
};

// ---------------------------------------------------------------- Caverna
// Só o interior (a boca escura em relevo); a pedra é o modelo abaixo
export const caveDoor = {
  box: BOX, res: 2, elevation: ELEVATION,
  poses: () => [{ key: 'in0' }, { key: 'in1', lit: true }],
  build(kit) {
    const root = kit.group();
    const inside = interior(kit, OUTLINES.cave(), { dark: '#3A2618', lit: '#C07A40', glow: '#FF8A30' });
    root.add(inside.group);
    return { root, inside, leaf: kit.group() };
  },
  apply(rig, p) { show(rig, p); },
};

// Pedra redonda de rolar: calombos, lascas e a mãozinha pintada; girada no plano da
// tela (ela rola da direita para a esquerda ao fechar)
export const doorStone = {
  box: { left: -STONE_R - 8, right: STONE_R + 8, top: STONE_R + 8, bottom: -STONE_R - 8 },
  res: 2,
  elevation: ELEVATION,
  poses: () => Array.from({ length: STONE_STEPS }, (_, i) => ({ key: `r${i}`, angle: (i / STONE_STEPS) * Math.PI * 2 })),
  build(kit) {
    const { THREE, group, mesh } = kit;
    const root = group();
    const spin = group();
    const geo = new THREE.SphereGeometry(STONE_R, 40, 28);
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const n = v.clone().normalize();
      const bump = 1 + 0.05 * Math.sin(n.x * 7 + n.y * 3) * Math.cos(n.y * 6 - n.z * 4) + 0.025 * Math.sin(n.x * 19 + n.z * 13);
      // Achatada na frente e atrás (uma roda de pedra, não uma bola)
      v.set(n.x * STONE_R * bump, n.y * STONE_R * bump, n.z * STONE_R * 0.55 * bump);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    const stone = new THREE.MeshStandardMaterial({ map: stoneTex(THREE), roughness: 0.95 });
    spin.add(mesh(geo, stone));
    root.add(spin);
    return { root, spin };
  },
  apply(rig, p) {
    rig.spin.rotation.z = p.angle;
  },
};

// Qual foto da pedra usar para o ângulo da pedra 2D (giro no sentido da tela) e o que
// falta girar em 2D
export function stonePose(angle) {
  const step = (Math.PI * 2) / STONE_STEPS;
  // O canvas gira no sentido horário com ângulo positivo; o modelo, no anti-horário
  const a = ((-angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const i = Math.round(a / step) % STONE_STEPS;
  return { key: `r${i}`, rest: -(a - i * step) };
}

// Modelo da porta de cada estilo de casa
export const DOOR_MODELS = {
  igloo: 'door-igloo', cabin: 'door-cabin', base: 'door-base', hut: 'door-hut', haunted: 'door-haunted', cave: 'door-cave',
};
export const DOOR_SUBJECTS = {
  'door-igloo': iglooDoor, 'door-cabin': cabinDoor, 'door-base': baseDoor, 'door-hut': hutDoor,
  'door-haunted': hauntedDoor, 'door-cave': caveDoor, 'door-stone': doorStone,
};
