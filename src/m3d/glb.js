// Leitor mínimo de .glb (glTF binário) para os modelos feitos no Blender (blender/*.py).
// Lê só o que os nossos scripts exportam: nós com translação/rotação/escala, malhas
// (posição, normal, UV, cor de vértice, índices), pele (ossos e pesos), o nome e a cor
// de cada material e as texturas embutidas (cor e normais). Sem animações, Draco ou extensões.
//
// Não usa o GLTFLoader do Three.js de propósito: ele importa "three" por nome, o que
// exigiria um import map, e o jogo carrega o Three.js por URL (DEPTH.model3d.url).

const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const ARRAY = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };

// ArrayBuffer -> { json, bin }
export function parseGLB(buf) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('não é um arquivo .glb');
  let json = null;
  let bin = null;
  for (let o = 12; o < dv.byteLength;) {
    const len = dv.getUint32(o, true);
    const type = dv.getUint32(o + 4, true);
    if (type === CHUNK_JSON) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, o + 8, len)));
    else if (type === CHUNK_BIN) bin = buf.slice(o + 8, o + 8 + len);
    o += 8 + len;
  }
  if (!json) throw new Error('.glb sem JSON');
  return { json, bin };
}

// Dados de um "accessor" (cópia alinhada, como o tipo certo)
export function readAccessor(gltf, i) {
  const a = gltf.json.accessors[i];
  const bv = gltf.json.bufferViews[a.bufferView];
  const n = SIZE[a.type];
  const C = ARRAY[a.componentType];
  const start = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const stride = bv.byteStride || 0;
  const el = n * C.BYTES_PER_ELEMENT;
  if (!stride || stride === el) return { array: new C(gltf.bin.slice(start, start + a.count * el)), itemSize: n, normalized: !!a.normalized };
  // Intercalado: copia elemento por elemento
  const out = new C(a.count * n);
  for (let k = 0; k < a.count; k++) out.set(new C(gltf.bin.slice(start + k * stride, start + k * stride + el)), k * n);
  return { array: out, itemSize: n, normalized: !!a.normalized };
}

// Decodifica as imagens embutidas (texturas). Sem createImageBitmap (Node), fica sem elas
export async function decodeImages(gltf) {
  const imgs = gltf.json.images || [];
  gltf.bitmaps = [];
  if (!imgs.length || typeof createImageBitmap !== 'function') return gltf;
  gltf.bitmaps = await Promise.all(imgs.map((im) => {
    if (im.bufferView == null) return null;
    const bv = gltf.json.bufferViews[im.bufferView];
    const start = bv.byteOffset || 0;
    const blob = new Blob([gltf.bin.slice(start, start + bv.byteLength)], { type: im.mimeType || 'image/png' });
    return createImageBitmap(blob).catch(() => null);
  }));
  return gltf;
}

const cache = new Map();
// Baixa e lê um .glb (uma vez por URL)
export function fetchGLB(url) {
  if (!cache.has(url)) {
    cache.set(url, fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url}: ${r.status}`);
      return r.arrayBuffer();
    }).then(parseGLB).then(decodeImages));
  }
  return cache.get(url);
}

// Monta a cena: devolve { root, nodes (por nome), meshes }. `materialFor(nome, gltfMat, tex)`
// cria o material de cada peça (o modelo decide cor, brilho e cor de vértice); `tex(info)`
// devolve a textura de um { index } do material (ou null), já pronta para o Three.js.
export function instantiate(THREE, gltf, materialFor) {
  const { json } = gltf;
  const joints = new Set((json.skins || []).flatMap((s) => s.joints));
  const objs = json.nodes.map((n, i) => {
    const o = joints.has(i) ? new THREE.Bone() : new THREE.Group();
    o.name = n.name || `node${i}`;
    if (n.translation) o.position.fromArray(n.translation);
    if (n.rotation) o.quaternion.fromArray(n.rotation);
    if (n.scale) o.scale.fromArray(n.scale);
    if (n.matrix) new THREE.Matrix4().fromArray(n.matrix).decompose(o.position, o.quaternion, o.scale);
    return o;
  });
  json.nodes.forEach((n, i) => {
    for (const c of n.children || []) objs[i].add(objs[c]);
  });
  const texs = new Map();
  const tex = (info, srgb = false) => {
    if (!info || info.index == null) return null;
    const src = json.textures?.[info.index]?.source;
    const bmp = gltf.bitmaps?.[src];
    if (!bmp) return null;
    const key = `${src},${srgb}`;
    if (!texs.has(key)) {
      const t = new THREE.Texture(bmp);
      t.flipY = false; // UV do glTF: origem no alto
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      t.needsUpdate = true;
      texs.set(key, t);
    }
    return texs.get(key);
  };
  const mats = new Map();
  const matOf = (k) => {
    if (k == null) k = -1;
    if (!mats.has(k)) mats.set(k, materialFor(json.materials?.[k]?.name || '', json.materials?.[k] || {}, tex));
    return mats.get(k);
  };
  const meshes = [];
  const skinned = [];
  json.nodes.forEach((n, i) => {
    if (n.mesh == null) return;
    for (const prim of json.meshes[n.mesh].primitives) {
      const g = new THREE.BufferGeometry();
      const attr = (key, name) => {
        if (prim.attributes[key] == null) return;
        const a = readAccessor(gltf, prim.attributes[key]);
        g.setAttribute(name, new THREE.BufferAttribute(a.array, a.itemSize, a.normalized));
      };
      attr('POSITION', 'position');
      attr('NORMAL', 'normal');
      attr('TEXCOORD_0', 'uv');
      attr('COLOR_0', 'color');
      attr('JOINTS_0', 'skinIndex');
      attr('WEIGHTS_0', 'skinWeight');
      if (prim.indices != null) g.setIndex(new THREE.BufferAttribute(readAccessor(gltf, prim.indices).array, 1));
      if (!g.getAttribute('normal')) g.computeVertexNormals();
      const m = matOf(prim.material);
      const isSkin = n.skin != null && g.getAttribute('skinIndex');
      const mesh = isSkin ? new THREE.SkinnedMesh(g, m) : new THREE.Mesh(g, m);
      mesh.name = n.name || '';
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // Peças presas aos ossos não podem sumir pelo recorte da câmera (a caixa delas é a do repouso)
      mesh.frustumCulled = false;
      objs[i].add(mesh);
      meshes.push(mesh);
      if (isSkin) skinned.push([mesh, json.skins[n.skin]]);
    }
  });
  const root = new THREE.Group();
  for (const k of json.scenes[json.scene || 0].nodes) root.add(objs[k]);
  root.updateMatrixWorld(true);
  for (const [mesh, skin] of skinned) {
    const bones = skin.joints.map((j) => objs[j]);
    const inv = [];
    if (skin.inverseBindMatrices != null) {
      const a = readAccessor(gltf, skin.inverseBindMatrices).array;
      for (let k = 0; k < bones.length; k++) inv.push(new THREE.Matrix4().fromArray(a, k * 16));
    }
    mesh.bind(new THREE.Skeleton(bones, inv.length ? inv : undefined), mesh.matrixWorld);
  }
  const nodes = {};
  for (const o of objs) nodes[o.name] = o;
  return { root, nodes, meshes };
}
