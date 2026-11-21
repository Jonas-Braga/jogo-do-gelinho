// Itens de poder em 3D: boia de patinho (anel de borracha com cabeça de pato) e
// chuteira dourada. As fotos são usadas pelo desenho de src/powers.js (gancho
// powerArt): o item boiando na fileira e o efeito no personagem (boia na cintura,
// em metade de trás e metade da frente, e a chuteira no pé).

// ---------------------------------------------------------------- Boia
// Ponto de apoio = centro do anel. Visto um pouco de cima, como o anel 2D (17 × 7)
export const duck = {
  box: { left: -40, right: 40, top: 34, bottom: -20 },
  res: 2.4,
  elevation: 0.45,
  poses() {
    const out = [];
    for (const f of ['R', 'L']) for (const part of ['item', 'back', 'front']) out.push({ key: `${part}${f}`, f, part });
    return out;
  },
  build({ THREE, mat, group, sphere, mesh, bone }) {
    const yellow = mat('#FFD43B', 0.35);
    const orange = mat('#F28C28', 0.4);
    const ink = mat('#1D2A33', 0.2);
    const white = mat('#FFFFFF', 0.2);
    const root = group();
    // Metades do anel (na horizontal): de trás (z < 0) e da frente (z > 0)
    const half = (sign) => {
      const o = mesh(new THREE.TorusGeometry(17, 4.6, 14, 28, Math.PI), yellow);
      o.rotation.x = sign * Math.PI / 2;
      return o;
    };
    const back = half(-1);
    const front = half(1);
    root.add(back, front);
    // Rabinho (atrás) e cabeça com bico (na frente, do lado para onde vai)
    const tail = mesh(new THREE.ConeGeometry(3.4, 9, 10), yellow);
    root.add(tail);
    const head = group();
    head.add(bone(4, [0, 0, 0], [1.5, 7, 0], yellow));
    head.add(sphere(5.6, yellow, 2.5, 11, 0, 16));
    const beak = mesh(new THREE.ConeGeometry(2.2, 6, 10), orange, 8.5, 10, 0);
    beak.rotation.z = -Math.PI / 2;
    beak.scale.set(1, 1, 0.6);
    head.add(beak);
    for (const s of [-1, 1]) {
      head.add(sphere(1.5, white, 4.8, 12.6, s * 3.6, 10));
      head.add(sphere(0.8, ink, 5.6, 12.8, s * 3.9, 8));
    }
    root.add(head);
    return { root, back, front, tail, head };
  },
  apply(rig, p) {
    const s = p.f === 'L' ? -1 : 1;
    rig.back.visible = p.part !== 'front';
    rig.front.visible = p.part !== 'back';
    rig.head.visible = p.part !== 'back';
    rig.tail.visible = p.part !== 'front';
    // Cabeça na frente-lado (como no 2D: x = 15), virada para onde ele anda
    rig.head.position.set(s * 14, 1, 9);
    rig.head.rotation.set(0, s > 0 ? 0 : Math.PI, 0);
    rig.tail.position.set(-s * 18.5, 3, -4);
    rig.tail.rotation.set(0, 0, s * 1.1);
  },
};

// ---------------------------------------------------------------- Chuteira
// Ponto de apoio = sola, no meio. O contorno é o mesmo do desenho 2D (bico para +x)
function bootOutline(THREE) {
  const s = new THREE.Shape();
  s.moveTo(-14, 22);
  s.lineTo(-4, 22);
  s.quadraticCurveTo(-2, 13, 6, 11);   // peito do pé
  s.quadraticCurveTo(17, 9, 18, 3);    // bico
  s.lineTo(18, 2);
  s.lineTo(-15, 2);
  s.quadraticCurveTo(-17, 12, -14, 22); // calcanhar
  return s;
}
export const boot = {
  box: { left: -26, right: 26, top: 32, bottom: -10 },
  res: 3,
  elevation: 0.25,
  poses: () => [{ key: 'R', f: 'R' }, { key: 'L', f: 'L' }],
  build({ THREE, mat, group, mesh, bone }) {
    const gold = mat('#FFC933', 0.25, { metalness: 0.3, emissive: '#7A5200', emissiveIntensity: 0.35 });
    const sole = mat('#5A3A06', 0.6);
    const white = mat('#FFFFFF', 0.4);
    const root = group();
    const shoe = group();
    root.add(shoe);
    // Corpo: contorno lateral extrudado com quinas arredondadas
    const body = mesh(new THREE.ExtrudeGeometry(bootOutline(THREE), { depth: 6, bevelEnabled: true, bevelThickness: 3, bevelSize: 2.4, bevelSegments: 5, curveSegments: 10 }), gold, 0, 0, -3);
    shoe.add(body);
    // Sola e travas
    const s = new THREE.Shape();
    s.moveTo(-16, 0);
    s.lineTo(19, 0);
    s.lineTo(19, 3.5);
    s.lineTo(-16, 3.5);
    s.closePath();
    shoe.add(mesh(new THREE.ExtrudeGeometry(s, { depth: 11, bevelEnabled: true, bevelThickness: 1, bevelSize: 1, bevelSegments: 2 }), sole, 0, -1, -5.5));
    for (const x of [-12, -5, 4, 12]) {
      for (const z of [-3, 3]) shoe.add(mesh(new THREE.CylinderGeometry(1.3, 1.6, 3, 8), sole, x, -2.5, z));
    }
    // Cadarço (por cima do peito do pé) e a faixa branca do lado
    for (const [x, y] of [[-1.5, 17.6], [1.6, 15.4], [4.6, 14]]) shoe.add(bone(0.75, [x, y, -4.2], [x + 1.6, y - 0.4, 4.2], white));
    const stripe = new THREE.Shape();
    stripe.moveTo(-9, 9);
    stripe.lineTo(-3, 9);
    stripe.lineTo(-7, 3.5);
    stripe.lineTo(-13, 3.5);
    stripe.closePath();
    shoe.add(mesh(new THREE.ShapeGeometry(stripe), white, 0, 0, 6.8));
    return { root, shoe };
  },
  apply(rig, p) {
    // Para a esquerda: o mesmo pé virado (o lado de fora continua para a câmera)
    rig.root.rotation.y = p.f === 'L' ? Math.PI - 0.35 : 0.35;
  },
};
