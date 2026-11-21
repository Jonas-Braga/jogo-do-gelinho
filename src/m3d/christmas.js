// Natal em 3D: trenó do Papai Noel com duas renas galopando e as árvores de Natal
// da costa. Mesmas coordenadas do desenho 2D (src/christmas.js), com y para cima:
// o ponto (x, y) do 2D é (x, −y) aqui. O pisca-pisca e o brilho da estrela continuam
// sendo luzes 2D por cima das fotos (piscam em sequência).
import { TAU } from './kit.js';

const frameOf = (phase, n) => ((Math.floor((phase / TAU) * n) % n) + n) % n;

// ---------------------------------------------------------------- Trenó
export const GALLOP_FRAMES = 8;
export const sleigh = {
  box: { left: -52, right: 170, top: 66, bottom: -16 },
  res: 1.8,
  elevation: 0.12,
  pose: (s) => `${frameOf(s.t * 9, GALLOP_FRAMES)}${s.dir < 0 ? 'L' : 'R'}`,
  poses() {
    const out = [];
    for (const f of ['R', 'L']) {
      for (let i = 0; i < GALLOP_FRAMES; i++) out.push({ key: `${i}${f}`, f, g: ((i + 0.5) / GALLOP_FRAMES) * TAU });
    }
    return out;
  },
  build(kit) {
    const { THREE, mat, group, mesh, sphere, bone, capsule } = kit;
    const red = mat('#D22D33', 0.45);
    const darkRed = mat('#8E1418', 0.5);
    const gold = mat('#F4C542', 0.3, { metalness: 0.4, emissive: '#5A4000', emissiveIntensity: 0.3 });
    const white = mat('#FFFFFF', 0.9);
    const skin = mat('#F2C3A0', 0.7);
    const black = mat('#1F1F1F', 0.5);
    const brown = mat('#7A4E2A', 0.9);
    const leather = mat('#8A5A2B', 0.7);
    const root = group();
    root.rotation.order = 'YXZ';

    // Caixa do trenó: o perfil 2D extrudado, com friso dourado
    const prof = new THREE.Shape();
    prof.moveTo(-44, 26);
    prof.quadraticCurveTo(-46, 4, -30, 4);
    prof.lineTo(16, 4);
    prof.quadraticCurveTo(30, 6, 30, 20);
    prof.quadraticCurveTo(22, 14, 12, 16);
    prof.lineTo(-30, 16);
    prof.quadraticCurveTo(-36, 20, -44, 26);
    const box = mesh(new THREE.ExtrudeGeometry(prof, { depth: 18, bevelEnabled: true, bevelThickness: 1.6, bevelSize: 1.4, bevelSegments: 3, curveSegments: 10 }), red, 0, 0, -9);
    root.add(box);
    const seat = mesh(new THREE.BoxGeometry(44, 4, 18), darkRed, -10, 15, 0);
    root.add(seat);
    const trim = mesh(new THREE.BoxGeometry(58, 1.8, 21.5), gold, -11, 10, 0);
    root.add(trim);
    // Patins curvos com os suportes
    for (const z of [-7, 7]) {
      const path = new THREE.CatmullRomCurve3([[-36, -4], [0, -4], [26, -4], [35, -2], [38, 5], [33, 8]].map(([x, y]) => new THREE.Vector3(x, y, z)));
      root.add(mesh(new THREE.TubeGeometry(path, 40, 1.3, 8, false), gold));
      for (const x of [-24, 10]) root.add(bone(1, [x, -4, z], [x, 5, z], gold));
    }

    // Saco de presentes com um presente saindo
    const sack = sphere(14, brown, -26, 25, 0, 18);
    sack.scale.set(1, 1.05, 0.85);
    sack.rotation.z = 0.3;
    root.add(sack);
    root.add(mesh(new THREE.BoxGeometry(9, 9, 9), mat('#2E9E5B', 0.6), -31.5, 40, 2));
    root.add(mesh(new THREE.BoxGeometry(2, 9.4, 9.4), gold, -31.5, 40, 2));

    // Papai Noel sentado: corpo, cinto, braço com cotovelo segurando a rédea, cabeça
    const santa = group(-4, 12, 0);
    root.add(santa);
    const torso = capsule(9, 8, red, 0, 12, 0);
    torso.scale.set(1, 1, 0.9);
    santa.add(torso);
    const belt = mesh(new THREE.TorusGeometry(9, 1.6, 8, 20), black, 0, 6, 0);
    belt.rotation.x = Math.PI / 2;
    santa.add(belt);
    const shoulder = group(4, 18, 6);
    santa.add(shoulder);
    shoulder.add(bone(3, [0, 0, 0], [6, -4, 0], red));
    const elbow = group(6, -4, 0);
    shoulder.add(elbow);
    elbow.add(bone(2.8, [0, 0, 0], [8, 2, 0], red));
    elbow.add(sphere(3, black, 9, 2, 0, 10));
    const head = group(1, 31, 0);
    santa.add(head);
    head.add(sphere(6.5, skin, 0, 0, 0, 18));
    const beard = sphere(7.2, white, 1, -5, 2, 16);
    beard.scale.set(1, 0.85, 0.85);
    head.add(beard);
    head.add(sphere(1.4, mat('#E59A86', 0.6), 6, 0.5, 2, 8));
    head.add(sphere(0.9, black, 5.2, 2.2, 3.5, 8));
    head.add(sphere(0.9, black, 5.2, 2.2, -1.5, 8));
    // Gorro: copa, barra de pelo e a ponta articulada caindo para trás com o pompom
    const hat = group(0, 4.5, 0);
    head.add(hat);
    const crown = mesh(new THREE.ConeGeometry(6.8, 9, 16, 1, true), red, 0, 4, 0);
    hat.add(crown);
    const rim = mesh(new THREE.TorusGeometry(6.8, 1.9, 8, 18), white, 0, 0, 0);
    rim.rotation.x = Math.PI / 2;
    hat.add(rim);
    const hatTip = group(0, 8, 0);
    hat.add(hatTip);
    hatTip.add(bone(2.2, [0, 0, 0], [-8, -3, 0], red));
    hatTip.add(sphere(2.6, white, -9, -4, 0, 10));

    // Rédeas: da mão do Papai Noel até as renas
    const reins = new THREE.CatmullRomCurve3([[19, 29, 6], [40, 18, 5], [62, 22, 4], [92, 26, 4], [122, 30, 4]].map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    root.add(mesh(new THREE.TubeGeometry(reins, 40, 0.6, 6, false), leather));

    // Renas (a da frente um pouco mais alta)
    const deer = [reindeer(kit, 128, 22), reindeer(kit, 68, 14)];
    for (const d of deer) root.add(d.root);
    return { root, deer, hatTip, sleighBob: root };
  },
  apply(rig, p) {
    rig.root.rotation.y = p.f === 'L' ? Math.PI + 0.3 : -0.3;
    rig.deer.forEach((d, k) => poseDeer(d, p.g + (k ? 0 : 1.2)));
    rig.hatTip.rotation.z = Math.sin(p.g) * 0.25;
  },
};

// Rena: corpo, pescoço, cabeça com galhada, rabinho, arreio com sininho e quatro pernas
// articuladas (coxa, joelho e canela) no galope
function reindeer(kit, x, y) {
  const { THREE, mat, group, mesh, sphere, bone } = kit;
  const fur = mat('#8B5A33', 0.9);
  const furDark = mat('#6E4426', 0.9);
  const belly = mat('#E9D8BE', 0.9);
  const hoof = mat('#3B2414', 0.6);
  const antler = mat('#D8C29A', 0.7);
  const red = mat('#B3262C', 0.6);
  const gold = mat('#F4C542', 0.3, { metalness: 0.4, emissive: '#5A4000', emissiveIntensity: 0.3 });
  const root = group(x, y, 0);
  const body = group();
  root.add(body);
  const trunk = sphere(8, fur, 0, 0, 0, 20);
  trunk.scale.set(2.35, 1, 0.9);
  body.add(trunk);
  body.add(sphere(3, belly, -18, 3, 0, 10)); // rabinho
  // Arreio vermelho com sininho dourado
  const harness = mesh(new THREE.TorusGeometry(7.6, 1.3, 8, 20), red, 11, 0, 0);
  harness.rotation.y = Math.PI / 2;
  harness.scale.set(1, 1.05, 1);
  body.add(harness);
  body.add(sphere(2.2, gold, 11, -7.5, 0, 10));
  // Pescoço e cabeça (balançam com o galope)
  const neck = group(12, 4, 0);
  body.add(neck);
  neck.add(bone(4, [0, 0, 0], [8, 11, 0], fur));
  const head = group(9, 13, 0);
  neck.add(head);
  const skull = sphere(5, fur, 4, 0, 0, 16);
  skull.scale.set(1.45, 0.9, 0.9);
  head.add(skull);
  head.add(sphere(2, hoof, 11.5, 1, 0, 10)); // focinho
  head.add(sphere(1.1, hoof, 6.5, 2.4, 3.6, 8));
  head.add(sphere(1.1, hoof, 6.5, 2.4, -3.6, 8));
  for (const z of [-2.6, 2.6]) {
    const ear = sphere(1.8, furDark, 0, 4, z * 1.4, 8);
    ear.scale.set(1.6, 0.6, 0.8);
    head.add(ear);
    // Galhada (ramificada)
    head.add(bone(0.8, [1, 4, z], [-3, 14, z * 1.3], antler));
    head.add(bone(0.7, [-1, 9, z * 1.15], [-7, 11, z * 1.3], antler));
    head.add(bone(0.7, [-2.4, 12, z * 1.25], [1, 17, z * 1.4], antler));
  }
  // Pernas: quadril/ombro, coxa, joelho, canela e casco
  const legs = [];
  for (const [lx, ph] of [[-12, 0], [-7, 1.8], [8, 3.1], [13, 4.6]]) {
    for (const z of [lx === -12 || lx === 8 ? 3.5 : -3.5]) {
      const hip = group(lx, -2, z);
      body.add(hip);
      hip.add(bone(2.2, [0, 0, 0], [0, -7, 0], lx < 0 ? furDark : fur));
      const knee = group(0, -7, 0);
      hip.add(knee);
      knee.add(bone(1.4, [0, 0, 0], [0, -6.5, 0], furDark));
      knee.add(sphere(1.7, hoof, 0, -7, 0.4, 8));
      legs.push({ hip, knee, ph, front: lx > 0 });
    }
  }
  return { root, body, neck, legs };
}

function poseDeer(d, g) {
  for (const l of d.legs) {
    // Mesmo balanço do 2D (±0,7 rad); a canela dobra para trás quando a perna avança
    const a = Math.sin(g + l.ph) * 0.7;
    l.hip.rotation.z = a;
    l.knee.rotation.z = -Math.max(0, Math.cos(g + l.ph)) * (l.front ? 1.3 : 0.9);
  }
  d.body.position.y = Math.sin(g * 2) * 1.2;
  d.body.rotation.z = Math.sin(g) * 0.06;
  d.neck.rotation.z = -Math.sin(g) * 0.12;
}

// ---------------------------------------------------------------- Árvores
// Árvore de 104 de altura (a menor é a mesma foto em escala), vista bem de frente
// para o pisca-pisca 2D cair no lugar certo. Ponto de apoio = base do tronco.
export const TREE_H = 104;
export const tree = {
  box: { left: -42, right: 42, top: 118, bottom: -8 },
  res: 2.2,
  elevation: 0,
  poses: () => [{ key: 'tree' }],
  build(kit) {
    const { THREE, mat, group, mesh } = kit;
    const green = mat('#24774A', 0.85);
    const greenDark = mat('#185C36', 0.9);
    const snow = mat('#F5FAFC', 0.9);
    const trunkM = mat('#5B3A22', 0.9);
    const gold = mat('#FFD54A', 0.25, { metalness: 0.3, emissive: '#B8860B', emissiveIntensity: 0.6 });
    const root = group();
    const h = TREE_H;
    const w = h * 0.62;
    root.add(mesh(new THREE.CylinderGeometry(5, 5.5, 13, 12), trunkM, 0, 5.5, 0));
    for (let i = 0; i < 3; i++) {
      const yb = 10 + i * h * 0.24;
      const th = h * 0.42;
      const hw = (w / 2) * (1 - i * 0.24);
      // Copa em cone com a borda de baixo recortada em galhos
      const geo = new THREE.ConeGeometry(hw, th, 18, 3, true);
      const pos = geo.attributes.position;
      for (let v = 0; v < pos.count; v++) {
        const y = pos.getY(v);
        if (y < -th / 2 + 0.01) {
          const a = Math.atan2(pos.getZ(v), pos.getX(v));
          pos.setY(v, y - 2.2 * Math.abs(Math.sin(a * 4.5)));
        }
      }
      geo.computeVertexNormals();
      root.add(mesh(geo, i % 2 ? greenDark : green, 0, yb + th / 2, 0));
      // Neve acumulada nas pontas dos galhos (segue a borda recortada da copa)
      for (let a = 0; a < Math.PI * 2; a += 0.3) {
        const lump = kit.sphere(2.4 + (i ? 0 : 0.5), snow, Math.cos(a) * hw * 0.94, yb + 1 - 2.2 * Math.abs(Math.sin(a * 4.5)), Math.sin(a) * hw * 0.94, 10);
        lump.scale.set(1.5, 0.6, 1.2);
        lump.rotation.y = -a;
        root.add(lump);
      }
    }
    // Estrela dourada no topo
    const top = 10 + 2 * h * 0.24 + h * 0.42;
    const st = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 3.2 : 7;
      if (i) st.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      else st.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    st.closePath();
    root.add(mesh(new THREE.ExtrudeGeometry(st, { depth: 1.6, bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.6, bevelSegments: 2 }), gold, 0, top, -0.8));
    return { root };
  },
  apply() {},
};
