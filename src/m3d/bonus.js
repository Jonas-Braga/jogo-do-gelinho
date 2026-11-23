// Prêmios das fases especiais em 3D: saco de dinheiro dourado com "$" e coração
// vermelho estufado. Mesmos pontos de apoio do desenho 2D (src/bonus.js); o balanço,
// o brilho, as estrelinhas e o anel d'água continuam 2D por cima/por baixo.

// Saco: apoio no centro da base do desenho 2D (fundo do saco em y = −4, boca em 22..31)
export const bag = {
  box: { left: -26, right: 26, top: 36, bottom: -10 },
  res: 3,
  elevation: 0.15,
  poses: () => [{ key: 'bag' }],
  build({ THREE, mat, group, mesh, lathe }) {
    const gold = mat('#F0B83A', 0.35, { metalness: 0.25, emissive: '#5A3A00', emissiveIntensity: 0.25 });
    const goldDark = mat('#C9922A', 0.5);
    const cord = mat('#7A4A10', 0.7);
    const root = group();
    // Corpo torneado: barriga larga embaixo, pescoço franzido e a boca abrindo em babado
    const body = lathe([[0, -4], [9, -3.4], [14.5, 0], [16.2, 6], [15, 12.5], [10.5, 18.5], [6.2, 21.5], [5.4, 22.6]], gold, 40);
    body.scale.set(1, 1, 0.82);
    root.add(body);
    const ruffle = new THREE.LatheGeometry(
      [[5.4, 22.4], [7.5, 25], [9.2, 29]].map(([r, y]) => new THREE.Vector2(r, y)), 40,
    );
    // Babado: a borda de cima ondula
    const pos = ruffle.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      if (pos.getY(v) > 28) {
        const a = Math.atan2(pos.getZ(v), pos.getX(v));
        pos.setY(v, pos.getY(v) + 1.6 * Math.sin(a * 7));
      }
    }
    ruffle.computeVertexNormals();
    const rf = mesh(ruffle, goldDark);
    rf.material = mat('#C9922A', 0.5, { side: THREE.DoubleSide });
    rf.scale.set(1, 1, 0.82);
    root.add(rf);
    const tie = mesh(new THREE.TorusGeometry(6, 1.1, 8, 24), cord, 0, 22.4, 0);
    tie.rotation.x = Math.PI / 2;
    tie.scale.set(1, 0.82, 1);
    root.add(tie);
    // "$" estampado na frente
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#7A4A10';
    g.font = '900 52px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('$', 32, 36);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sign = mesh(new THREE.PlaneGeometry(13, 13), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.6 }), 0, 7, 13.4);
    sign.castShadow = false;
    root.add(sign);
    return { root };
  },
  apply() {},
};

// Coração: apoio no centro (ponta de baixo em y = −12, lóbulos em +12)
export const heart = {
  box: { left: -24, right: 24, top: 22, bottom: -20 },
  res: 3,
  elevation: 0.15,
  poses: () => [{ key: 'heart' }],
  build({ THREE, mat, group, mesh }) {
    const red = mat('#E8304A', 0.25, { emissive: '#4A0010', emissiveIntensity: 0.3 });
    const root = group();
    const s = new THREE.Shape();
    s.moveTo(0, -12);
    s.bezierCurveTo(-16, -2, -16, 12, -8, 12);
    s.bezierCurveTo(-3, 12, 0, 8, 0, 5);
    s.bezierCurveTo(0, 8, 3, 12, 8, 12);
    s.bezierCurveTo(16, 12, 16, -2, 0, -12);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 3, bevelEnabled: true, bevelThickness: 4, bevelSize: 2.6, bevelSegments: 8, curveSegments: 16 });
    geo.translate(0, 0, -1.5);
    root.add(mesh(geo, red));
    return { root };
  },
  apply() {},
};

// Caneca de chocolate quente (fases normais a partir da 11; src/heat.js): apoio no
// centro do fundo, boca em y = 22, alça do lado direito como no 2D. A fumaça, o
// brilho e o anel d'água continuam 2D por cima/por baixo.
export const cocoa = {
  box: { left: -26, right: 26, top: 32, bottom: -8 },
  res: 3,
  elevation: 0.3,
  poses: () => [{ key: 'cocoa' }],
  build({ THREE, mat, group, mesh, lathe }) {
    const red = mat('#D8443A', 0.3, { emissive: '#3A0A06', emissiveIntensity: 0.25 });
    const white = mat('#FFFFFF', 0.4);
    const choc = mat('#6A3A1E', 0.35);
    const foam = mat('#FFF4E6', 0.8);
    const root = group();
    // Corpo torneado: paredes com espessura (fora, borda arredondada, dentro) e fundo
    const body = lathe([[0, 0], [9.6, 0], [10.6, 1.2], [11, 20], [11.2, 21.6], [10.4, 22.4], [9.4, 21.4], [9.2, 3], [0, 3]], red, 40);
    root.add(body);
    // Faixa branca em volta
    root.add(lathe([[11.06, 8.2], [11.12, 11.6]], white, 40));
    const band = root.children[root.children.length - 1];
    band.material = mat('#FFFFFF', 0.4, { side: THREE.DoubleSide });
    // Chocolate quase na boca, com bolhinhas de espuma
    const top = mesh(new THREE.CircleGeometry(9.25, 32), choc, 0, 19.5, 0);
    top.rotation.x = -Math.PI / 2;
    root.add(top);
    for (const [x, z, r] of [[-3, 1, 2], [1.5, -1.5, 2.4], [4.5, 2.2, 1.6], [-1, -4, 1.5], [0.5, 3.5, 1.8]]) {
      const b = mesh(new THREE.SphereGeometry(r, 12, 8), foam, x, 19.6, z);
      b.scale.set(1, 0.45, 1);
      root.add(b);
    }
    // Alça: meio anel do lado direito
    const handle = mesh(new THREE.TorusGeometry(6, 1.7, 10, 20, Math.PI), red, 11, 11, 0);
    handle.rotation.z = -Math.PI / 2;
    root.add(handle);
    // Virada um pouco para mostrar a alça e a frente
    root.rotation.y = -0.35;
    return { root };
  },
  apply() {},
};
