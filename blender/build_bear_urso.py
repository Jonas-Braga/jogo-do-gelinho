"""Ursos do Jogo do Gelinho a partir dos modelos lisos prontos do usuário
(urso_marrom_liso.glb e urso_polar_liso.glb, na raiz do projeto e fora do repositório:
malha única com textura, sem esqueleto).

Uso (Blender 5.x, em background):
  blender -b --factory-startup --python-exit-code 1 --python blender/build_bear_urso.py -- [--tris 40000] [--analisar]

O que faz, para cada urso:
  1. importa o modelo, solda os vértices duplicados nas emendas da textura e põe na escala e
     na posição do urso antigo (blender/build_bear.py: 1 cm do Blender = 1 unidade do jogo,
     frente = −Y, chão em z = 0);
  2. acha no rosto (pela cor da textura) o nariz, a linha do sorriso e os olhos;
  3. reduz a malha, abre a fenda da boca na linha do sorriso e refaz a textura sobre a malha
     reduzida (bake); dá espessura aos lábios;
  4. acha as 4 patas pela malha e monta o MESMO esqueleto do urso antigo (body, neck, head,
     jaw, tail, up_/low_/foot_ de cada pata), mais as sobrancelhas (brow_L, brow_R), com
     pesos calculados pela geometria (mandíbula por pesos harmônicos); o miolo da boca, a
     língua e as presas;
  5. exporta assets/models/bear-liso-{brown,polar}.glb e blender/bear-liso-*.blend.
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SET = "liso"
SOURCES = {"brown": "urso_marrom_liso.glb", "polar": "urso_polar_liso.glb"}
CONF = {"tris": 40000, "ankle": 0.05, "heel": 0.45}
TRIS = int(argv[argv.index("--tris") + 1]) if "--tris" in argv else CONF["tris"]
# Tornozelo: baixo e atrás do meio da pata (onde fica num urso de verdade); no meio da pata
# e alto, a parte de trás da pata não acompanhava a canela e sobrava um calombo atrás
ANKLE = CONF["ankle"]
HEEL = CONF["heel"]

# Comprimento do focinho ao traseiro do urso antigo (m no Blender = 100 unidades do jogo)
LENGTH = 1.62
# Alturas das articulações do urso antigo (proporção da altura da cernelha, ~1,0)
HIP_K, KNEE_K = 0.56, 0.31
TEX = 2048     # lado da textura de cor exportada
# Raio da coluna de cada pata: dentro = toda da pata; fora = toda do corpo
LEG_R = (0.10, 0.18)


def log(*a):
    print("[urso]", *a, flush=True)


# ------------------------------------------------------------------ importa e ajeita
def load(src):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, src))
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    ob = meshes[0]
    # Tira o objeto de qualquer pai/vazio e aplica as transformações
    mw = ob.matrix_world.copy()
    ob.parent = None
    ob.matrix_world = mw
    for o in list(bpy.context.scene.objects):
        if o is not ob:
            bpy.data.objects.remove(o, do_unlink=True)
    ob.data.transform(ob.matrix_world)
    ob.matrix_world.identity()
    ob.name = ob.data.name = "SM_Bear"
    # O glTF vem com os vértices separados nas emendas da textura (dois pontos no mesmo
    # lugar): solda, senão cada lado da emenda ganha um peso diferente e ela abre ao dobrar
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    n0 = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    log("vértices soldados nas emendas:", n0 - len(bm.verts))
    bm.to_mesh(ob.data)
    bm.free()
    return ob


def bounds(ob):
    co = np.empty(len(ob.data.vertices) * 3, dtype=np.float32)
    ob.data.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    return co, co.min(0), co.max(0)


def normalize(ob):
    co, mn, mx = bounds(ob)
    s = LENGTH / (mx[1] - mn[1])
    # x centrado, focinho e traseiro no lugar do antigo (centro em y = −0,19), chão em z = 0
    off = Vector((-(mn[0] + mx[0]) / 2, -(mn[1] + mx[1]) / 2, -mn[2]))
    ob.data.transform(Matrix.Diagonal((s, s, s, 1)) @ Matrix.Translation(off))
    ob.data.transform(Matrix.Translation((0, -0.19, 0)))
    co, mn, mx = bounds(ob)
    log("medidas", [round(float(v), 3) for v in mn], [round(float(v), 3) for v in mx])
    return co


def decimate(ob):
    n = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    ratio = min(1.0, TRIS / n)
    log("triângulos", n, "→", TRIS, "razão", round(ratio, 4))
    m = ob.modifiers.new("dec", "DECIMATE")
    m.decimate_type = "COLLAPSE"
    m.ratio = ratio
    m.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=m.name)
    with bpy.context.temp_override(object=ob, active_object=ob, selected_editable_objects=[ob]):
        bpy.ops.object.shade_smooth()
    log("triângulos depois", sum(len(p.vertices) - 2 for p in ob.data.polygons))


# ------------------------------------------------------------------ rosto (boca, olhos, sobrancelhas)
def texel_colors(ob):
    """Cor da textura original em cada vértice (pela UV do primeiro canto que o usa)."""
    me = ob.data
    mat = me.materials[0]
    img = next(n.image for n in mat.node_tree.nodes if n.type == "TEX_IMAGE" and n.image and n.image.size[0] > 0
               and any(l.to_socket.name == "Base Color" for l in n.outputs["Color"].links))
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    uv = np.empty(len(me.loops) * 2, dtype=np.float32)
    me.uv_layers.active.data.foreach_get("uv", uv)
    uv = uv.reshape(-1, 2)
    vi = np.empty(len(me.loops), dtype=np.int64)
    me.loops.foreach_get("vertex_index", vi)
    vuv = np.zeros((len(me.vertices), 2), dtype=np.float32)
    vuv[vi] = uv
    xs = np.clip((vuv[:, 0] % 1) * (w - 1), 0, w - 1).astype(int)
    ys = np.clip((vuv[:, 1] % 1) * (h - 1), 0, h - 1).astype(int)
    return px[ys, xs, :3]


def analyze_face(ob):
    """Acha no modelo (pela cor da textura) o focinho, a linha da boca, os olhos e as
    sobrancelhas. Tudo em metros do Blender (frente = −y, alto = z)."""
    co, _, _ = bounds(ob)
    col = texel_colors(ob)
    lum = col @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    mx, mn = col.max(1), col.min(1)
    sat = np.where(mx > 1e-4, (mx - mn) / np.maximum(mx, 1e-4), 0)
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    nose_y = float(y.min())
    face = y < nose_y + 0.32
    # Nariz: o bloco escuro na ponta
    tip = face & (y < nose_y + 0.06) & (lum < 0.05)
    nose = co[tip].mean(0) if tip.any() else co[np.argmin(y)]
    # Linha da boca: escuro, abaixo do nariz, perto do meio, mais para trás que a ponta
    line = face & (lum < 0.06) & (z < nose[2] - 0.015) & (y > nose_y + 0.015) & (np.abs(x) < 0.12)
    # Olhos: pelas pupilas (o pelo do polar é branco como o branco do olho): escuro, acima
    # do nariz, na frente da cara
    pupil = (y < nose_y + 0.2) & (lum < 0.05) & (z > nose[2] + 0.05) & (np.abs(x) > 0.03)
    eyes = {}
    for side, sx in (("L", -1), ("R", 1)):
        e = co[pupil & (np.sign(x) == sx)]
        eyes[side] = e.mean(0) if len(e) else None
    L = co[line]
    mid = L[np.abs(L[:, 0]) < 0.015]
    center = mid[np.argmin(mid[:, 2])] if len(mid) else np.array([0, nose_y + 0.02, nose[2] - 0.05])
    far = L[np.abs(L[:, 0]) > np.abs(L[:, 0]).max() - 0.012]
    corner = np.array([float(np.abs(far[:, 0]).mean()), float(far[:, 1].mean()), float(far[:, 2].mean())])
    log("nariz", np.round(nose, 3), "boca: centro", np.round(center, 3), "canto", np.round(corner, 3))
    for k, e in eyes.items():
        log("olho", k, None if e is None else np.round(e, 3))
    return {"nose": nose, "center": center, "corner": corner, "eyes": eyes, "nose_y": nose_y}


BROW_W = 0.04      # meia largura da sobrancelha
BROW_UP = 0.05     # altura da sobrancelha acima do centro do olho


def mouth_plane(face):
    """Plano da boca: passa pelo centro do sorriso e pelos dois cantos (não depende de x)."""
    c, k = face["center"], face["corner"]
    n = Vector((0, -(k[2] - c[2]), k[1] - c[1])).normalized()
    return Vector((0, c[1], c[2])), n


def cut_mouth(ob, face):
    """Abre a fenda da boca na malha, na linha do sorriso, do centro até os cantos."""
    c, n = mouth_plane(face)
    k = face["corner"]
    bm = bmesh.new()
    bm.from_mesh(ob.data)

    def near(v):
        return v.co.y < k[1] + 0.012 and abs(v.co.x) < k[0] + 0.02 and abs((v.co - c).dot(n)) < 0.025

    region = [f for f in bm.faces if all(near(v) for v in f.verts)]
    geom = list(set(region) | {e for f in region for e in f.edges} | {v for f in region for v in f.verts})
    bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-6, plane_co=c, plane_no=n)
    # Separa toda aresta entre uma face de cima e uma de baixo da linha da boca (o plano
    # sozinho deixava triângulos atravessando a fenda, que viravam lascas ao abrir)
    below = {f: (f.calc_center_median() - c).dot(n) < 0 for f in bm.faces}

    def inside(e):
        m = (e.verts[0].co + e.verts[1].co) / 2
        return m.y < k[1] - 0.002 and abs(m.x) < k[0] + 0.004 and abs((m - c).dot(n)) < 0.04

    cut = [e for e in bm.edges if len(e.link_faces) == 2 and below[e.link_faces[0]] != below[e.link_faces[1]] and inside(e)]
    bmesh.ops.split_edges(bm, edges=cut)
    # Triângulos pequenos da dobra do lábio podem ter o centro do outro lado e ficar presos
    # ao lábio oposto na beira da fenda: em todo ponto da borda da fenda, separa também as
    # arestas que ainda ligam faces dos dois lados (até não sobrar nenhuma)
    for _ in range(6):
        edge_pts = {v for e in bm.edges if e.is_boundary and inside(e) for v in e.verts}
        more = [e for e in bm.edges if len(e.link_faces) == 2 and below[e.link_faces[0]] != below[e.link_faces[1]]
                and any(v in edge_pts for v in e.verts)]
        if not more:
            break
        bmesh.ops.split_edges(bm, edges=more)
        cut += more
    bm.to_mesh(ob.data)
    bm.free()
    log("boca: fenda com", len(cut), "arestas")


LIP_DEPTH = 0.01    # espessura do lábio (a borda da fenda dobra para dentro)


def lip_rims(ob, face):
    """Dá espessura à fenda: as bordas da boca são dobradas para dentro do focinho, numa
    cor escura de boca (senão a casca fina da pele aparece esfarrapada com a boca aberta).
    Cada vértice novo guarda de qual borda saiu (atributo rim_src), para ganhar os mesmos
    pesos."""
    c, n = mouth_plane(face)
    k = face["corner"]
    me = ob.data
    lip = flat_material("M_Lip", (0.20, 0.045, 0.055), 0.9)
    me.materials.append(lip)
    slot = len(me.materials) - 1
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    edges = [e for e in bm.edges if e.is_boundary and all(v.co.y < k[1] + 0.002 and abs(v.co.x) < k[0] + 0.004
                                                         and abs((v.co - c).dot(n)) < 0.03 for v in e.verts)]
    lay = bm.verts.layers.int.new("rim_src")
    for v in bm.verts:
        v[lay] = -1
    old = {v for e in edges for v in e.verts}
    ret = bmesh.ops.extrude_edge_only(bm, edges=edges)
    new_verts = [g for g in ret["geom"] if isinstance(g, bmesh.types.BMVert)]
    new_faces = [g for g in ret["geom"] if isinstance(g, bmesh.types.BMFace)]
    # Cada vértice novo nasce em cima do original e fica ligado a ele pela aresta da dobra
    # (pela posição não dá: na fenda os lábios de cima e de baixo têm pontos no mesmo lugar)
    # A dobra entra pela normal de cada ponto; depois os pontos da dobra são alinhados com
    # os vizinhos (pela normal pura ela saía em blocos)
    for v in new_verts:
        src = next(e.other_vert(v) for e in v.link_edges if e.other_vert(v) in old)
        v[lay] = src.index
        v.co = src.co - src.normal * LIP_DEPTH
    for _ in range(4):
        bmesh.ops.smooth_vert(bm, verts=new_verts, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    for f in new_faces:
        f.material_index = slot
        f.smooth = True
    bm.to_mesh(me)
    bm.free()
    log("lábio:", len(edges), "arestas de borda")


def rim_sources(ob):
    a = ob.data.attributes.get("rim_src")
    if a is None:
        return None
    v = np.empty(len(ob.data.vertices), dtype=np.int64)
    a.data.foreach_get("value", v)
    return v


def face_weights(ob, co, face):
    """Pesos da mandíbula (lábio de baixo e queixo: o lado de baixo da fenda, até o canto)
    e das sobrancelhas (mancha acima de cada olho, na frente da cara)."""
    c, n = mouth_plane(face)
    k = face["corner"]
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    me = ob.data
    # Peso da mandíbula harmônico: fixo em 1 no queixo e no lábio de baixo, em 0 na cara
    # acima da boca e longe dela; no resto, a média dos vizinhos ligados por aresta. Como
    # a fenda não tem arestas atravessando, o peso só salta ali; no resto varia suave
    d = (co - np.array(c)) @ np.array(n)
    front = (y < k[1] - 0.008) & (np.abs(x) < k[0] - 0.004)
    one = front & (d < -0.012) & (z > c[2] - 0.11)
    zero = (d > 0.012) | (y > k[1] + 0.05) | (z < c[2] - 0.15) | (np.abs(x) > k[0] + 0.08) | (y > face["nose_y"] + 0.24)
    zero &= ~one
    e = np.empty(len(me.edges) * 2, dtype=np.int64)
    me.edges.foreach_get("vertices", e)
    e = e.reshape(-1, 2)
    deg = np.bincount(e.ravel(), minlength=len(co)).astype(np.float32)
    jaw = np.where(one, 1.0, 0.0).astype(np.float32)
    free = ~(one | zero) & (deg > 0)
    for _ in range(600):
        acc = np.zeros(len(co), dtype=np.float32)
        np.add.at(acc, e[:, 0], jaw[e[:, 1]])
        np.add.at(acc, e[:, 1], jaw[e[:, 0]])
        jaw[free] = acc[free] / deg[free]
    log("boca: pontos fixos na mandíbula", int(one.sum()), "| livres", int(free.sum()))
    out = {"jaw": jaw.astype(np.float32)}
    for sd in face["eyes"]:
        bx, by, bz = face["brow"][sd]
        # Só o lado dela (nunca cruza o meio da testa, senão as duas puxam a pele para lados
        # opostos e ela rasga) e passagem suave para trás
        d = np.sqrt(((x - bx) / (BROW_W * 1.35)) ** 2 + ((z - bz) / 0.034) ** 2)
        front = smooth(by + 0.05, by + 0.015, y)
        side_ok = smooth(0.004, 0.02, x * np.sign(bx))
        out[f"brow_{sd}"] = (smooth(1.0, 0.55, d) * front * side_ok).astype(np.float32)
    log("boca/sobrancelhas:", {kk: int((w > 0.5).sum()) for kk, w in out.items()})
    return out


def cone(name, base, tip, r, mat, seg=10):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    a, b = Vector(base), Vector(tip)
    d = b - a
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=0.1 * r, depth=d.length)
    rot = d.to_track_quat("Z", "Y").to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation((a + b) / 2) @ rot, verts=bm.verts)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    me.materials.append(mat)
    return ob


def srgb_lin(c):
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def flat_material(name, rgb, rough=0.7):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*srgb_lin(rgb), 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = 0.0
    return m


def attach(ob, rig, bone_name):
    mw = ob.matrix_world.copy()
    ob.parent = rig
    ob.parent_type = "BONE"
    ob.parent_bone = bone_name
    ob.matrix_world = mw


def mouth_parts(rig, body, face):
    """Miolo escuro da boca (em cima preso à cabeça, embaixo à mandíbula; estica ao abrir,
    com a língua no chão) e as presas (de cima na cabeça, de baixo na mandíbula)."""
    c, n = mouth_plane(face)
    k = face["corner"]
    mc = Vector((0, (c.y + k[1]) / 2 + 0.012, (c.z + k[2]) / 2 - 0.012))
    me = bpy.data.meshes.new("MouthBag")
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=24, radius=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * k[0] * 0.95, v.co.y * 0.055, v.co.z * 0.04)) + mc
    bm.to_mesh(me)
    bm.free()
    bag = bpy.data.objects.new("MouthBag", me)
    bpy.context.scene.collection.objects.link(bag)
    # Fica dentro do focinho: cada ponto recua até um pouco antes da pele
    for v in me.vertices:
        d = v.co - mc
        if d.length < 1e-6:
            continue
        ok, loc, _, _ = body.ray_cast(mc, d.normalized())
        if ok:
            lim = (loc - mc).length - 0.004
            if d.length > lim:
                v.co = mc + d.normalized() * max(lim, 0.004)
    # Alisa o miolo depois de encostá-lo na pele (senão fica cheio de facetas) e tira a
    # parede da frente: fechado, ele escondia a língua e as presas atrás dela
    bm = bmesh.new()
    bm.from_mesh(me)
    for _ in range(4):
        bmesh.ops.smooth_vert(bm, verts=bm.verts, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    front = [f for f in bm.faces if f.calc_center_median().y < mc.y - 0.012]
    bmesh.ops.delete(bm, geom=front, context="FACES")
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(flat_material("M_MouthIn", (0.30, 0.06, 0.08), 0.6))
    hg, jg = bag.vertex_groups.new(name="head"), bag.vertex_groups.new(name="jaw")
    for v in me.vertices:
        t = float(smooth(0.006, -0.008, (v.co - c).dot(n)))
        hg.add([v.index], 1 - t, "REPLACE")
        jg.add([v.index], t, "REPLACE")
    bag.parent = rig
    mod = bag.modifiers.new("Armature", "ARMATURE")
    mod.object = rig
    # Língua: peça lisa e arredondada deitada no chão da boca, presa à mandíbula
    tme = bpy.data.meshes.new("Tongue")
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=16, radius=1.0)
    # (recuada e baixa o bastante para não escapar pelos lábios com a boca fechada)
    tc = Vector((0, c.y + (k[1] - c.y) * 0.6, 0))
    tc.z = c.z + (tc.y - c.y) * (k[2] - c.z) / (k[1] - c.y) - 0.012
    for v in bm.verts:
        v.co = Vector((v.co.x * k[0] * 0.55, v.co.y * 0.03, v.co.z * 0.008)) + tc
    bm.to_mesh(tme)
    bm.free()
    for p in tme.polygons:
        p.use_smooth = True
    tme.materials.append(flat_material("M_Tongue", (0.85, 0.40, 0.45), 0.45))
    tongue = bpy.data.objects.new("Tongue", tme)
    bpy.context.scene.collection.objects.link(tongue)
    attach(tongue, rig, "jaw")
    # Presas: as de cima saem da borda do lábio de cima, as de baixo da de baixo
    tooth = flat_material("M_Tooth", (1, 1, 0.97), 0.3)
    for sx in (1, -1):
        x = sx * k[0] * 0.42
        ty = c.y + (k[1] - c.y) * 0.32 + 0.008
        tz = c.z + (ty - c.y) * (k[2] - c.z) / (k[1] - c.y)
        up = cone(f"Fang{sx}", (x, ty - 0.004, tz + 0.012), (x, ty - 0.008, tz - 0.02), 0.0065, tooth)
        attach(up, rig, "head")
        lo = cone(f"ToothLow{sx}", (x * 0.75, ty + 0.002, tz - 0.008), (x * 0.75, ty, tz + 0.004), 0.0045, tooth)
        attach(lo, rig, "jaw")


# ------------------------------------------------------------------ textura refeita (bake)
# Ao reduzir a malha, os pontos nas bordas das ilhas da textura se deslocam e passam a
# pegar a cor de fora delas (riscos claros e escuros nas pernas). A cor do modelo original
# é então "fotografada" sobre a malha reduzida, numa textura nova com UVs próprias.
BAKE_SIZE = 2048


def bake_color(low, hi):
    # O modelo veio "metálico" (metallicFactor 1): a cor difusa de metal sai preta no bake
    for m in hi.data.materials:
        b = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if not b:
            continue
        for link in list(m.node_tree.links):
            if link.to_node == b and link.to_socket.name == "Metallic":
                m.node_tree.links.remove(link)
        b.inputs["Metallic"].default_value = 0.0
    me = low.data
    old = [uv.name for uv in me.uv_layers]
    uv = me.uv_layers.new(name="bake")
    me.uv_layers.active = uv
    bpy.context.view_layer.objects.active = low
    for o in bpy.context.scene.objects:
        o.select_set(o is low)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.004)
    bpy.ops.object.mode_set(mode="OBJECT")
    img = bpy.data.images.new("BearBaked", BAKE_SIZE, BAKE_SIZE)
    mat = bpy.data.materials.new("M_Bear")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    nt.nodes.active = tex
    me.materials.clear()
    me.materials.append(mat)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 1
    sc.cycles.device = "CPU"
    bake = sc.render.bake
    bake.use_selected_to_active = True
    bake.cage_extrusion = 0.02
    bake.max_ray_distance = 0.05
    bake.margin = 8
    bake.use_pass_direct = False
    bake.use_pass_indirect = False
    bake.use_pass_color = True
    hi.select_set(True)
    low.select_set(True)
    bpy.context.view_layer.objects.active = low
    bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"}, use_selected_to_active=True)
    # Só a UV nova fica (a do glTF exportado é a primeira)
    for name in old:
        me.uv_layers.remove(me.uv_layers[name])
    bpy.data.objects.remove(hi, do_unlink=True)
    img.pack()
    log("textura refeita", BAKE_SIZE)


HEELS = {}
TOES = {}


def ankle_y(key, y):
    return y + HEEL * (HEELS[key] - y) if HEEL else y


def find_legs(co):
    """As 4 patas: os pontos perto do chão, separados por lado (x) e frente/trás (y)."""
    low = co[co[:, 2] < 0.06]
    legs = {}
    ymid = (low[:, 1].min() + low[:, 1].max()) / 2
    for key, sx, front in (("FL", -1, True), ("FR", 1, True), ("BL", -1, False), ("BR", 1, False)):
        sel = low[(np.sign(low[:, 0]) == sx) & ((low[:, 1] < ymid) == front)]
        c = sel.mean(0)
        legs[key] = (float(c[0]) * 0.92, float(c[1]) + 0.03)
        # Calcanhar: o ponto mais atrás da sola (+y é para trás)
        HEELS[key] = float(np.percentile(sel[:, 1], 97))
        TOES[key] = float(np.percentile(sel[:, 1], 3))
        log("pata", key, [round(float(v), 3) for v in c], "calcanhar", round(HEELS[key], 3), "pontos", len(sel))
    return legs


def withers(co, legs):
    """Altura do lombo (topo do corpo entre as patas da frente e de trás)."""
    yf = (legs["FL"][1] + legs["FR"][1]) / 2
    yb = (legs["BL"][1] + legs["BR"][1]) / 2
    mid = co[(co[:, 1] > min(yf, yb)) & (co[:, 1] < max(yf, yb)) & (np.abs(co[:, 0]) < 0.08)]
    return float(mid[:, 2].max()), yf, yb


def head_info(co):
    front = co[co[:, 1] < co[:, 1].min() + 0.45]
    return float(co[:, 1].min()), float(front[:, 2].max())


def armature(obs, co, legs, face=None):
    top, yf, yb = withers(co, legs)
    nose_y, head_top = head_info(co)
    k = top / 1.0
    hip, knee = HIP_K * k, KNEE_K * k
    log("lombo", round(top, 3), "topo da cabeça", round(head_top, 3), "focinho", round(nose_y, 3))
    arm = bpy.data.armatures.new("BearRig")
    rig = bpy.data.objects.new("BearRig", arm)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm.edit_bones

    def bone(name, h, t, parent=None, deform=True):
        b = eb.new(name)
        b.head, b.tail = Vector(h), Vector(t)
        if parent:
            b.parent = eb[parent]
        b.use_deform = deform
        return b

    # Corpo do traseiro ao peito; pescoço e cabeça para a frente (−y); mandíbula não deforma
    # (a boca do modelo é fechada); rabinho atrás
    rear = float(co[:, 1].max())
    hz = top * 0.64
    bone("body", (0, yb, hz), (0, yf, hz))
    neck0 = yf - 0.08
    head0 = nose_y + 0.42
    bone("neck", (0, neck0, hz + 0.06), (0, head0, head_top - 0.2), "body")
    bone("head", (0, head0, head_top - 0.2), (0, nose_y + 0.12, head_top - 0.24), "neck")
    if face:
        # Mandíbula gira no canto da boca; sobrancelhas presas no canto de fora (a ponta de
        # dentro desce ao franzir)
        c, k = face["center"], face["corner"]
        bone("jaw", (0, k[1] + 0.025, k[2] - 0.005), (0, c[1], c[2] - 0.03), "head")
        for side in face["eyes"]:
            sx = -1 if side == "L" else 1
            bx, by, bz = face["brow"][side]
            bone(f"brow_{side}", (bx + sx * BROW_W, by + 0.01, bz), (bx - sx * BROW_W, by, bz), "head")
    else:
        bone("jaw", (0, nose_y + 0.2, head_top - 0.3), (0, nose_y + 0.02, head_top - 0.36), "head", deform=False)
    bone("tail", (0, rear - 0.12, hz + 0.08), (0, rear, hz + 0.1), "body")
    for key, (x, y) in legs.items():
        front = key[0] == "F"
        h = top * (0.57 if front else 0.56)
        bone(f"up_{key}", (x, y, h), (x, y, knee), "body")
        # Tornozelo entre o meio da pata e o calcanhar, baixo (no calcanhar mesmo a canela
        # inclina demais nas traseiras, de sola comprida, e forma pontas)
        ay_ = ankle_y(key, y)
        bone(f"low_{key}", (x, y, knee), (x, ay_, ANKLE), f"up_{key}")
        bone(f"foot_{key}", (x, ay_, ANKLE), (x, ay_ - 0.2, ANKLE), f"low_{key}")
    # Âncora do gorro do Natal: em cima da cabeça
    bpy.ops.object.mode_set(mode="OBJECT")
    hat = bpy.data.objects.new("hat", None)
    bpy.context.scene.collection.objects.link(hat)
    hat.location = (0, nose_y + 0.3, head_top - 0.02)
    hat.parent = rig
    hat.parent_type = "BONE"
    hat.parent_bone = "head"
    hat.matrix_world = Matrix.Translation(hat.location)
    # Pele: pesos calculados pela geometria (o peso automático do Blender falha nesta
    # malha, que é cheia de pedaços soltos)
    for ob in obs:
        ob.parent = rig
        mod = ob.modifiers.new("Armature", "ARMATURE")
        mod.object = rig
        skin_weights(ob, legs, dict(top=top, knee=knee, rear=rear, neck0=neck0, head0=head0), face if ob is obs[0] else None)
    if face:
        mouth_parts(rig, obs[0], face)
    return rig


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


LEG_SLICES = (0.04, 0.12, 0.22, 0.32, 0.42, 0.52)


def leg_axis(co, lx, ly):
    """Eixo e grossura reais da pata: em fatias de altura, o centro e o raio (percentil 90)
    dos pontos do lado e do quarto dela. Devolve (alturas, centros x, centros y, raios)."""
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    zs, cx, cy, rr = [], [], [], []
    for h in LEG_SLICES:
        sel = (np.abs(z - h) < 0.04) & (np.sign(x) == np.sign(lx)) & (np.abs(y - ly) < 0.22)
        p = co[sel]
        if len(p) < 30:
            continue
        c = np.median(p[:, :2], 0)
        r = np.percentile(np.hypot(p[:, 0] - c[0], p[:, 1] - c[1]), 90)
        zs.append(h); cx.append(c[0]); cy.append(c[1]); rr.append(r)
    return np.array(zs), np.array(cx), np.array(cy), np.array(rr)


def skin_weights(ob, legs, m, face=None):
    """Cada pata pega a coluna de malha dela, seguindo o eixo e a grossura medidos em cada
    altura, até um pouco acima do quadril (passagem longa para o corpo), dividida entre
    coxa, canela e pata pela altura; o resto se divide ao longo do comprimento entre rabo,
    corpo, pescoço e cabeça. No fim os pesos são suavizados pela malha."""
    co, _, _ = bounds(ob)
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    W = {}
    used = np.zeros(len(co), dtype=np.float32)
    for key, (lx, ly) in legs.items():
        front = key[0] == "F"
        hip = m["top"] * (0.57 if front else 0.56)
        zs, cx, cy, rr = leg_axis(co, lx, ly)
        log("eixo", key, "raios", [round(float(r), 3) for r in rr])
        ax = np.interp(z, zs, cx)
        ay = np.interp(z, zs, cy)
        # A grossura vem das fatias baixas (em cima a fatia pega a barriga junto)
        r = float(min(rr[1:3]))
        d = np.hypot(x - ax, y - ay)
        # Na altura da pata, a distância é até a sola inteira (dos dedos ao calcanhar): o
        # calcanhar das traseiras fica bem atrás da coluna da perna e, fora da área dela,
        # ficava preso ao corpo e esticava numa ponta quando a pata ia para a frente
        dsole = np.hypot(x - ax, np.maximum(0, np.maximum(TOES[key] - y, y - HEELS[key])))
        low_k = smooth(ANKLE + 0.1, ANKLE + 0.03, z)
        d = d * (1 - low_k) + np.minimum(d, dsole) * low_k
        radial = smooth(r * 1.6, r * 1.1, d) * (np.sign(x) == np.sign(lx))
        vertical = smooth(hip + 0.1, hip - 0.12, z)
        f = radial * vertical
        # A pata fica com o osso da pata (plana no chão); atrás do tornozelo ela passa aos
        # poucos para a canela, para o calcanhar não formar bloco nem ponta
        # (nas traseiras, de sola comprida, o calcanhar fica inteiro com a sola)
        ty = ankle_y(key, ly)
        heel_fade = smooth(ty + 0.06, ty + 0.01, y) if front else 1.0
        foot = smooth(ANKLE + 0.025, ANKLE - 0.015, z) * heel_fade
        low = smooth(m["knee"] + 0.1, m["knee"] - 0.08, z) * (1 - foot)
        up = 1 - foot - low
        W[f"foot_{key}"] = f * foot
        W[f"low_{key}"] = f * low
        W[f"up_{key}"] = f * up
        used += f
    over = np.maximum(used, 1)
    for k in list(W):
        W[k] = W[k] / over
    rest = np.clip(1 - used, 0, 1)
    tail = smooth(m["rear"] - 0.16, m["rear"] - 0.06, y)
    head = smooth(m["head0"] + 0.06, m["head0"] - 0.06, y)
    neck = smooth(m["neck0"] + 0.08, m["neck0"] - 0.06, y) * (1 - head)
    body = 1 - tail - head - neck
    for name, w in (("tail", tail), ("head", head), ("neck", neck), ("body", body)):
        W[name] = rest * w
    # Suaviza pela malha (tira degraus entre o pelo de fora e o de dentro) e normaliza
    e = np.empty(len(ob.data.edges) * 2, dtype=np.int64)
    ob.data.edges.foreach_get("vertices", e)
    e = e.reshape(-1, 2)
    deg = np.bincount(e.ravel(), minlength=len(co)).astype(np.float32)
    names = list(W)
    M = np.stack([W[k] for k in names], 1).astype(np.float32)
    for _ in range(8):
        acc = np.zeros_like(M)
        np.add.at(acc, e[:, 0], M[e[:, 1]])
        np.add.at(acc, e[:, 1], M[e[:, 0]])
        has = deg > 0
        M[has] = 0.5 * M[has] + 0.5 * acc[has] / deg[has, None]
    M /= np.maximum(M.sum(1, keepdims=True), 1e-6)
    if face:
        # Boca e sobrancelhas depois da suavização: o peso depende só da posição, então
        # peças sobrepostas (sobrancelha sobre a testa) se movem juntas; tiram o peso da cabeça
        hi_ = names.index("head")
        for name, w in face_weights(ob, co, face).items():
            take = np.minimum(w, M[:, hi_])
            M[:, hi_] -= take
            names.append(name)
            M = np.concatenate([M, take[:, None]], 1)
        # A espessura do lábio (borda dobrada para dentro) vai junto com a borda de onde saiu
        src = rim_sources(ob)
        if src is not None:
            ok = src >= 0
            M[ok] = M[src[ok]]
    for j, name in enumerate(names):
        W[name] = M[:, j]
        g = ob.vertex_groups.new(name=name)
        w = M[:, j]
        for i in np.nonzero(w > 1e-3)[0]:
            g.add([int(i)], float(w[i]), "REPLACE")
    log("pesos:", {k: int((w > 0.5).sum()) for k, w in W.items()})


# ------------------------------------------------------------------ texturas
def material_images(ob):
    mat = ob.data.materials[0]
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    base = normal = None
    for link in nt.links:
        if link.to_node == bsdf and link.to_socket.name == "Base Color" and link.from_node.type == "TEX_IMAGE":
            base = link.from_node
        if link.to_node.type == "NORMAL_MAP" and link.from_node.type == "TEX_IMAGE":
            normal = link.from_node
    # Pelo não brilha como metal: tira o mapa de metal/rugosidade (vira valor fixo)
    for link in list(nt.links):
        if link.to_node == bsdf and link.to_socket.name in ("Metallic", "Roughness"):
            nt.links.remove(link)
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = 0.9
    # Sem o mapa de relevo (nos ursos lisos ele foi feito para a malha original e, na malha
    # reduzida e dobrada, vira riscos claros e escuros nas pernas)
    if normal:
        for link in list(nt.links):
            if link.to_node == bsdf and link.to_socket.name == "Normal":
                nt.links.remove(link)
        nt.nodes.remove(normal)
        normal = None
    mat.name = "M_Bear"
    return mat, base, normal


def shrink(img, size, fmt):
    if img.size[0] > size:
        img.scale(size, size)
    img.file_format = fmt
    img.pack()  # embute a imagem reduzida (senão o exportador usa a original)
    return img


# ------------------------------------------------------------------ exporta
def export(name):
    path = os.path.join(ROOT, "assets", "models", f"{name}.glb")
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", export_yup=True, export_apply=True,
        export_skins=True, export_animations=False, export_morph=False,
        export_image_format="JPEG", export_jpeg_quality=88, export_texcoords=True, export_normals=True,
        export_tangents=False, export_materials="EXPORT", export_cameras=False, export_lights=False,
    )
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, "blender", f"{name}.blend"))
    log("exportado", path, round(os.path.getsize(path) / 1e6, 2), "MB")


def build(variant, src):
    """Um urso: importa, ajeita, reduz, abre a boca, refaz a textura, monta o esqueleto e exporta."""
    ob = load(src)
    normalize(ob)
    face = analyze_face(ob)
    face["brow"] = {kk: (float(e[0]), float(e[1]), float(e[2]) + BROW_UP) for kk, e in face["eyes"].items()}
    hi = ob.copy()
    hi.data = ob.data.copy()
    bpy.context.scene.collection.objects.link(hi)
    decimate(ob)
    cut_mouth(ob, face)
    bake_color(ob, hi)
    lip_rims(ob, face)
    co, _, _ = bounds(ob)
    legs = find_legs(co)
    armature([ob], co, legs, face)
    mat, base, normal = material_images(ob)
    shrink(base.image, TEX, "JPEG")
    export(f"bear-{SET}-{variant}")


def main():
    if "--analisar" in argv:
        for v, src in SOURCES.items():
            ob = load(src)
            normalize(ob)
            analyze_face(ob)
        return
    for v, src in SOURCES.items():
        build(v, src)


main()
