"""Urso do Jogo do Gelinho modelado no Blender, no estilo das referências do usuário
(pasta "referencia de urso": urso de animação, polar e marrom).

Uso (Blender 5.x, em background):
  blender -b --factory-startup --python-exit-code 1 --python blender/build_bear.py -- [--variant polar|brown|all]

Saídas:
  assets/models/bear-polar.glb, assets/models/bear-brown.glb  (carregados pelo jogo, src/m3d/bear.js)
  blender/bear-polar.blend, blender/bear-brown.blend           (para abrir e ajustar à mão)

Medidas em "unidades do jogo" (o urso tem ~100 de altura) convertidas para o Blender
com 1 unidade = 1 cm (0,01 m). Eixos do jogo: x para o lado, y para cima, z para a
frente do urso. No Blender: X = x, Y = -z (frente do urso = -Y), Z = y. O glTF volta
para y para cima, então o Three.js recebe as mesmas coordenadas do jogo (× 0,01).

Esqueleto (nomes usados pelo jogo): body, neck, head, jaw, tail e, para cada pata
(FL, FR, BL, BR = dianteira/traseira, esquerda/direita), up_XX (quadril → joelho),
low_XX (joelho → tornozelo) e foot_XX (pata). As pernas ficam retas no repouso; o jogo
dobra por cinemática inversa a cada pose.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector, noise

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = 0.01


def G(x, y, z):
    """Ponto do jogo -> ponto do Blender."""
    return Vector((x * S, -z * S, y * S))


argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
VARIANT = argv[argv.index("--variant") + 1] if "--variant" in argv else "all"

# Pernas: x, z do quadril, altura do quadril (o jogo usa as mesmas medidas, lidas do esqueleto)
LEG_X = 12.5
LEGS = {
    "FL": (-LEG_X, 20, 57), "FR": (LEG_X, 20, 57),
    "BL": (-LEG_X, -29, 56), "BR": (LEG_X, -29, 56),
}
KNEE_Y = 31
ANKLE_Y = 8

PALETTE = {
    "polar": {
        "M_Fur": (0.93, 0.90, 0.84), "M_Muzzle": (0.72, 0.70, 0.67), "M_Nose": (0.05, 0.05, 0.055),
        "M_Claw": (0.09, 0.08, 0.08), "M_Pad": (0.18, 0.16, 0.15), "M_EyeWhite": (0.97, 0.96, 0.93),
        "M_Iris": (0.36, 0.22, 0.11), "M_Pupil": (0.03, 0.03, 0.03), "M_Shine": (1, 1, 1),
        "M_Brow": (0.30, 0.28, 0.26), "M_EarIn": (0.70, 0.65, 0.58), "M_MouthIn": (0.35, 0.10, 0.12),
        "M_Tooth": (1, 1, 1), "M_Line": (0.08, 0.07, 0.07),
    },
    "brown": {
        "M_Fur": (0.55, 0.28, 0.15), "M_Muzzle": (0.80, 0.60, 0.38), "M_Nose": (0.05, 0.05, 0.055),
        "M_Claw": (0.09, 0.08, 0.08), "M_Pad": (0.20, 0.12, 0.08), "M_EyeWhite": (0.97, 0.96, 0.93),
        "M_Iris": (0.30, 0.16, 0.06), "M_Pupil": (0.03, 0.03, 0.03), "M_Shine": (1, 1, 1),
        "M_Brow": (0.25, 0.11, 0.05), "M_EarIn": (0.36, 0.17, 0.08), "M_MouthIn": (0.35, 0.10, 0.12),
        "M_Tooth": (1, 1, 1), "M_Line": (0.10, 0.05, 0.03),
    },
}


# ------------------------------------------------------------------ utilidades
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob


def lin(c):
    """Cor sRGB (como nas paletas) -> linear (como o Blender e o glTF guardam)."""
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def material(name, color, rough=0.8, emit=0.0):
    color = lin(color)
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = (*color, 1)
        b.inputs["Emission Strength"].default_value = emit
    m.diffuse_color = (*color, 1)
    return m


def select_only(ob):
    for o in bpy.context.scene.objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob


def meta_family(name, elems, resolution=0.012):
    """Metaball: elems = [(centro, raios)] em unidades do jogo; raios (x, y, z) do jogo."""
    mb = bpy.data.metaballs.new(name)
    mb.resolution = resolution
    mb.render_resolution = resolution
    ob = link(bpy.data.objects.new(name, mb))
    for c, r, *rest in elems:
        stiff = rest[0] if rest else 2.0
        rx, ry, rz = r
        # Blender: X = x, Y = z (comprimento), Z = y (altura)
        big = max(rx, ry, rz)
        e = mb.elements.new()
        e.type = "ELLIPSOID"
        e.co = G(*c)
        e.radius = big * S / 0.575
        e.size_x, e.size_y, e.size_z = rx / big, rz / big, ry / big
        e.stiffness = stiff
    select_only(ob)
    bpy.ops.object.convert(target="MESH")
    ob = bpy.context.active_object
    ob.name = name
    return ob


def join(obs, name):
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.join()
    ob = bpy.context.active_object
    ob.name = name
    return ob


def apply_mod(ob, mod):
    select_only(ob)
    bpy.ops.object.modifier_apply(modifier=mod.name)


def ellipsoid(name, c, r, mat, seg=20, rings=14, rot=None):
    """Esfera achatada (raios do jogo) como malha separada."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    bmesh.ops.scale(bm, vec=(r[0] * S, r[2] * S, r[1] * S), verts=bm.verts)
    if rot:
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=rot)
    bmesh.ops.translate(bm, vec=G(*c), verts=bm.verts)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = link(bpy.data.objects.new(name, me))
    me.materials.append(mat)
    return ob


def tube(name, pts, radius, mat, seg=8):
    """Tubo arredondado por uma curva (pontos do jogo)."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius * S
    cu.bevel_resolution = 3
    cu.use_fill_caps = True
    sp = cu.splines.new("NURBS")
    sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (*G(*p), 1)
    sp.use_endpoint_u = True
    sp.order_u = 3
    sp.resolution_u = seg
    ob = link(bpy.data.objects.new(name, cu))
    select_only(ob)
    bpy.ops.object.convert(target="MESH")
    ob = bpy.context.active_object
    ob.data.materials.clear()
    ob.data.materials.append(mat)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def cone(name, base, tip, r, mat, seg=10):
    """Garra/dente: cone curvo da base até a ponta."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    a, b = G(*base), G(*tip)
    d = b - a
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r * S, radius2=0.08 * r * S, depth=d.length)
    rot = d.to_track_quat("Z", "Y").to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation((a + b) / 2) @ rot, verts=bm.verts)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = link(bpy.data.objects.new(name, me))
    me.materials.append(mat)
    return ob


# ------------------------------------------------------------------ corpo
def body_elements(variant):
    brown = variant == "brown"
    E = [
        # Tronco em "feijão": garupa redonda, barriga funda, peito e ombros altos
        ((0, 68, -26), (24, 28, 22)),
        ((0, 70, -6), (25, 30, 22)),
        ((0, 70, 14), (25, 29, 20)),
        ((0, 62, -2), (21, 22, 28)),           # barriga
        ((0, 72, 28), (19, 21, 14)),           # peito / base do pescoço
        # Ancas e ombros redondos
        ((-11, 62, -30), (13, 20, 15)), ((11, 62, -30), (13, 20, 15)),
        ((-12, 63, 20), (12, 19, 13)), ((12, 63, 20), (12, 19, 13)),
        # Pescoço grosso descendo para a cabeça
        ((0, 78, 38), (16, 16, 13)),
        # Cabeça grande e redonda, baixa e para a frente
        ((0, 87, 50), (18.5, 18, 16)),
        ((-9.5, 80, 57), (9, 9, 9)), ((9.5, 80, 57), (9, 9, 9)),     # bochechas
        # Focinho comprido afinando até o nariz
        ((0, 81, 64), (11, 10, 9)),
        ((0, 80, 71), (9.4, 8.6, 7)),
        ((0, 79.6, 77.5), (8.0, 7.4, 5.5)),
        ((0, 79.6, 81.5), (6.6, 6.4, 3.8)),
        # Queixo embaixo do focinho (a mandíbula que abre tem corpo)
        ((0, 73.2, 78.5), (6.4, 4.6, 7.0)),
        # Rabinho redondo
        ((0, 76, -48), (6, 6, 6)),
    ]
    if brown:
        E.append(((0, 90, 14), (17, 9, 16)))   # corcova sobre o ombro
    else:
        E.append(((0, 86, -18), (15, 7, 16)))  # garupa um pouco mais alta
    return E


def leg_elements(x, z, hy, front):
    E = []
    top = 15 if not front else 13
    # Coxa grossa (sobe para dentro do corpo) afinando até o joelho e a canela
    for t in range(0, 11):
        y = hy + 8 - t * (hy + 8 - ANKLE_Y) / 10
        k = t / 10
        r = top - (top - 9.6) * min(1, k * 1.4) + (0.6 if k > 0.85 else 0)
        E.append(((x, y, z + (-1.5 if not front else 0) * (1 - k)), (r, 5.5, r * 1.05)))
    # Pata redonda e larga
    E.append(((x, 4.2, z + 4), (10, 4.6, 12.5)))
    return E


def fur(ob, variant, amount=1.0):
    """Pelagem: tufos compridos penteados para baixo e para trás (ruído esticado na
    direção do pelo), franja mais comprida na barriga e atrás das pernas."""
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.normal_update()
    seed = Vector((3.1, 7.7, 1.3)) if variant == "polar" else Vector((9.4, 2.2, 5.6))
    disp = []
    for v in bm.verts:
        p = v.co / S  # unidades do jogo (Blender: X, Y = -z, Z = y)
        n = v.normal
        # direção do pelo: para baixo e um pouco para trás (+Y no Blender)
        q = Vector((p.x * 0.30, p.y * 0.22, p.z * 0.09)) + seed
        clump = noise.noise(q * 1.0)
        fine = noise.noise(Vector((p.x * 0.9, p.y * 0.7, p.z * 0.25)) + seed * 2)
        d = 0.35 + 0.45 * clump + fine * 0.25
        down = max(0.0, -n.z)
        d += down * (0.6 + 1.2 * max(0.0, clump + 0.2))
        # pelo curto na cabeça e quase nenhum no focinho
        if -p.y > 40 and p.z > 70:
            d *= 0.5
        if -p.y > 62 and p.z < 84:
            d *= 0.3
        # sola da pata lisa (o urso pisa no chão, sem franja abaixo dele)
        if p.z < 8:
            d *= max(0.0, (p.z - 2) / 6)
            down = 0.0
        disp.append((v, n * d * amount * S + Vector((0, 0, -down * 0.6 * max(0, fine + 0.3) * S))))
    for v, dv in disp:
        v.co += dv
    bm.to_mesh(me)
    bm.free()


def muzzle_mask(x, y, z):
    """0 no pelo, 1 no focinho claro (frente, abaixo da linha dos olhos); suave na borda."""
    sm = lambda t: 0.0 if t <= 0 else 1.0 if t >= 1 else t * t * (3 - 2 * t)
    top = 83.5 - (z - 64) * 0.16
    return sm((z - 63) / 5) * sm((top - y) / 2.5) * sm((12 - abs(x)) / 3)


def shade_vertices(ob, variant):
    """Cor de vértice: miolo dos tufos claro, vãos e a parte de baixo mais escuros."""
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.normal_update()
    tone = {}
    for v in bm.verts:
        nb = [e.other_vert(v).co for e in v.link_edges]
        if not nb:
            tone[v.index] = 1.0
            continue
        avg = sum(nb, Vector()) / len(nb)
        conv = (v.co - avg).dot(v.normal) / S  # >0 saliente, <0 vão
        t = 0.93 + max(-0.16, min(0.07, conv * 0.5))
        t *= 1.0 - 0.12 * max(0.0, -v.normal.z)
        tone[v.index] = max(0.72, min(1.0, t))
    bm.free()
    attr = me.color_attributes.new("Col", "BYTE_COLOR", "POINT")
    furc = Vector(PALETTE[variant]["M_Fur"])
    muz = Vector(PALETTE[variant]["M_Muzzle"])
    for i, d in enumerate(attr.data):
        t = tone[i]
        c = me.vertices[i].co / S
        m = muzzle_mask(c.x, c.z, -c.y)
        col = furc.lerp(muz, m) * t
        d.color_srgb = (col.x, col.y, col.z, 1)
    me.color_attributes.active_color = attr


def build_mesh(variant, mats):
    parts = [meta_family("Body", body_elements(variant))]
    for key, (x, z, hy) in LEGS.items():
        parts.append(meta_family("Leg" + key, leg_elements(x, z, hy, key[0] == "F")))
    ob = join(parts, "SM_Bear")
    # Une tudo num volume só (sem faces internas) e suaviza a emenda das pernas
    rm = ob.modifiers.new("Remesh", "REMESH")
    rm.mode = "VOXEL"
    rm.voxel_size = 0.0085
    apply_mod(ob, rm)
    sm = ob.modifiers.new("Smooth", "SMOOTH")
    sm.factor = 0.8
    sm.iterations = 6
    apply_mod(ob, sm)
    fur(ob, variant, 1.35)
    sm = ob.modifiers.new("Smooth", "SMOOTH")
    sm.factor = 0.5
    sm.iterations = 2
    apply_mod(ob, sm)
    dc = ob.modifiers.new("Decimate", "DECIMATE")
    dc.ratio = 0.3
    apply_mod(ob, dc)
    for p in ob.data.polygons:
        p.use_smooth = True
    ob.data.materials.append(mats["M_Fur"])
    shade_vertices(ob, variant)
    return ob


# ------------------------------------------------------------------ boca
# A boca é uma fenda de verdade na malha do focinho, na linha do sorriso: um plano que
# sai de logo abaixo do nariz e sobe um pouco para trás até o canto da boca. A metade
# de baixo do focinho (lábio e queixo) segue o osso da mandíbula; dentro fica o miolo
# escuro (MouthBag), preso em cima à cabeça e embaixo à mandíbula, que estica quando
# a boca abre (e some na fenda fechada), com a língua e os dentes.
NOSE_TIP = [0.0]          # z da ponta do focinho (medido na malha)
MOUTH_SLOPE = 0.28        # quanto a linha da boca sobe para trás
MOUTH_BACK = 11.0         # canto da boca: tantas unidades atrás da ponta do focinho


def mouth_y(z, tz):
    """Altura da linha da boca (jogo) na profundidade z."""
    return 73.8 + (tz - 1.0 - z) * MOUTH_SLOPE


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def measure_nose(body):
    # De bem à frente do focinho (frente do urso = −Y no Blender) para trás (+Y)
    ok, loc, _, _ = body.ray_cast(G(0, 79.5, 140), Vector((0, 1, 0)))
    assert ok
    NOSE_TIP[0] = -loc.y / S


def cut_mouth(body):
    tz = NOSE_TIP[0]
    me = body.data
    bm = bmesh.new()
    bm.from_mesh(me)
    gz = lambda v: -v.co.y / S
    gy = lambda v: v.co.z / S
    gx = lambda v: v.co.x / S
    region = [f for f in bm.faces
              if all(gz(v) > tz - MOUTH_BACK - 2.5 and abs(gx(v)) < 14 and abs(gy(v) - mouth_y(gz(v), tz)) < 4 for v in f.verts)]
    geom = list(set(region) | {e for f in region for e in f.edges} | {v for f in region for v in f.verts})
    no = Vector((0, -MOUTH_SLOPE, 1)).normalized()  # (jogo: 0, 1, 0,28)
    ret = bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-6, plane_co=G(0, mouth_y(tz - 1, tz), tz - 1), plane_no=no)
    cut = [e for e in ret["geom_cut"] if isinstance(e, bmesh.types.BMEdge)
           and all(gz(v) > tz - MOUTH_BACK for v in e.verts)]
    bmesh.ops.split_edges(bm, edges=cut)
    bm.to_mesh(me)
    bm.free()
    print(f"[urso] boca: fenda com {len(cut)} arestas")


def jaw_weights(mesh):
    """Metade de baixo do focinho segue a mandíbula (aos poucos perto do canto)."""
    tz = NOSE_TIP[0]
    vg = mesh.vertex_groups
    if "jaw" in vg:
        vg.remove(vg["jaw"])
    jaw = vg.new(name="jaw")
    me = mesh.data
    below = {}
    for p in me.polygons:
        c = p.center / S
        b = c.z < mouth_y(-c.y, tz)
        for i in p.vertices:
            below.setdefault(i, []).append(b)
    names = {g.index: g for g in vg}
    for v in me.vertices:
        x, y, z = v.co.x / S, v.co.z / S, -v.co.y / S
        if abs(x) > 14 or z < tz - 18 or y < 60:
            continue
        sides = below.get(v.index, [])
        if not sides or sum(sides) * 2 < len(sides):
            continue
        w = smooth((z - (tz - MOUTH_BACK - 4)) / 4.5) * smooth((y - 63) / 3)
        if w <= 0:
            continue
        for g in v.groups:
            if g.group != jaw.index:
                names[g.group].add([v.index], g.weight * (1 - w), "REPLACE")
        jaw.add([v.index], w, "REPLACE")


def mouth_bag(rig, mats, body):
    """Miolo escuro da boca: em cima preso à cabeça, embaixo à mandíbula."""
    tz = NOSE_TIP[0]
    zc = tz - 6.8
    yc = mouth_y(zc, tz)
    ob = ellipsoid("MouthBag", (0, yc - 0.8, zc), (8.0, 6.0, 7.4), mats["M_MouthIn"], seg=32, rings=36)
    # Preenche o focinho por dentro (o queixo e o lábio são casca): cada ponto fica
    # um pouco para dentro da pele, medido por raycast a partir do centro
    c = G(0, yc - 0.8, zc)
    for v in ob.data.vertices:
        d = v.co - c
        n = d.normalized()
        ok, loc, _, _ = body.ray_cast(c, n)
        if ok:
            lim = (loc - c).length - 0.6 * S
            if d.length > lim:
                v.co = c + n * max(lim, 0.5 * S)
    ob.data.update()
    head, jaw = ob.vertex_groups.new(name="head"), ob.vertex_groups.new(name="jaw")
    # Faixa larga em volta da linha da boca que estica ao abrir (o fundo curvo da boca)
    for v in ob.data.vertices:
        y = v.co.z / S
        z = -v.co.y / S
        t = smooth((mouth_y(z, tz) + 1.2 - y) / 2.4)
        head.add([v.index], 1 - t, "REPLACE")
        jaw.add([v.index], t, "REPLACE")
    # Língua: a parte de baixo da faixa, no meio, vira o chão rosado da boca aberta
    ob.data.materials.append(mats["M_Tongue"])
    for p in ob.data.polygons:
        c = p.center / S
        x, y, z = c.x, c.z, -c.y
        if abs(x) < 3.6 and z > tz - 10 and mouth_y(z, tz) - 1.8 < y < mouth_y(z, tz) - 0.1:
            p.material_index = 1
    ob.parent = rig
    mod = ob.modifiers.new("Armature", "ARMATURE")
    mod.object = rig
    return ob


# ------------------------------------------------------------------ esqueleto
def build_armature():
    arm = bpy.data.armatures.new("Armature")
    ob = link(bpy.data.objects.new("RIG_Bear", arm))
    select_only(ob)
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm.edit_bones

    def bone(name, a, b, parent=None, deform=True):
        bn = eb.new(name)
        bn.head = G(*a)
        bn.tail = G(*b)
        bn.roll = 0
        if parent:
            bn.parent = eb[parent]
            bn.use_connect = False
        bn.use_deform = deform
        return bn

    bone("body", (0, 64, -30), (0, 66, 26))
    bone("neck", (0, 70, 28), (0, 77, 44), "body")
    bone("head", (0, 79, 46), (0, 79, 70), "neck")
    tz = NOSE_TIP[0]
    bone("jaw", (0, mouth_y(tz - 12.5, tz) + 0.5, tz - 12.5), (0, mouth_y(tz, tz) - 1, tz), "head")
    bone("tail", (0, 72, -48), (0, 74, -58), "body")
    for key, (x, z, hy) in LEGS.items():
        bone("up_" + key, (x, hy, z), (x, KNEE_Y, z), "body")
        bone("low_" + key, (x, KNEE_Y, z), (x, ANKLE_Y, z), "up_" + key)
        bone("foot_" + key, (x, ANKLE_Y, z), (x, ANKLE_Y, z + 14), "low_" + key)
    bpy.ops.object.mode_set(mode="OBJECT")
    return ob


def bind(mesh, rig):
    for o in bpy.context.scene.objects:
        o.select_set(False)
    mesh.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    jaw_weights(mesh)
    # Patas: a pata inteira segue o osso foot_ (as garras e a almofada também estão
    # nele); acima do tornozelo passa aos poucos para a canela
    vg = mesh.vertex_groups
    for key, (lx, lz, hy) in LEGS.items():
        foot, low = vg["foot_" + key], vg["low_" + key]
        others = [g for g in vg if g.name not in (foot.name, low.name)]
        for v in mesh.data.vertices:
            x, y, z = v.co.x / S, v.co.z / S, -v.co.y / S
            if abs(x - lx) > 14 or abs(z - lz - 3) > 17 or y > 15:
                continue
            t = 1.0 if y <= 9 else max(0.0, 1 - (y - 9) / 6)
            for g in others:
                g.remove([v.index])
            foot.add([v.index], t, "REPLACE")
            if t < 1:
                low.add([v.index], 1 - t, "REPLACE")
            else:
                low.remove([v.index])
    # Vértices que o cálculo automático deixou sem peso vão para o osso mais próximo
    # (ex.: a ponta do focinho tem que virar junto com a cabeça, não ficar no corpo)
    from mathutils.geometry import intersect_point_line
    bones = [(b.name, b.head_local, b.tail_local) for b in rig.data.bones if b.use_deform and b.name != "jaw"]

    def nearest(co):
        best, bd = None, 1e9
        for name, h, t in bones:
            p, f = intersect_point_line(co, h, t)
            p = h if f < 0 else t if f > 1 else p
            d = (co - p).length
            if d < bd:
                best, bd = name, d
        return best

    empty = [v for v in mesh.data.vertices if not v.groups]
    if empty:
        print(f"[urso] {len(empty)} vértices sem peso: indo para o osso mais próximo")
        tz = NOSE_TIP[0]
        for v in empty:
            name = nearest(v.co)
            # Ponta do focinho abaixo da boca: mandíbula
            if name == "head" and v.co.z / S < mouth_y(-v.co.y / S, tz) and -v.co.y / S > tz - MOUTH_BACK:
                name = "jaw"
            vg[name].add([v.index], 1.0, "REPLACE")


def attach(ob, rig, bone_name):
    """Peça rígida presa a um osso (vira filha do osso no glTF)."""
    mw = ob.matrix_world.copy()
    ob.parent = rig
    ob.parent_type = "BONE"
    ob.parent_bone = bone_name
    ob.matrix_world = mw


# ------------------------------------------------------------------ rosto e detalhes
def build_details(rig, mats, body):
    out = []

    def add(ob, bone_name):
        attach(ob, rig, bone_name)
        out.append(ob)
        return ob

    def gdir(v):
        return Vector((v[0], -v[2], v[1])).normalized()

    def surf(center, direction, reach=60):
        """Ponto da superfície do corpo na direção dada a partir de um centro (jogo).
        Devolve (ponto do jogo, normal no Blender)."""
        d = gdir(direction)
        origin = G(*center) + d * reach * S
        ok, loc, nrm, _ = body.ray_cast(origin, -d)
        assert ok, (center, direction)
        return Vector((loc.x / S, loc.z / S, -loc.y / S)), nrm

    def to_game(b):
        return (b.x / S, b.z / S, -b.y / S)

    def frame(nrm, up=Vector((0, 0, 1))):
        """Rotação (Blender) cuja frente local (-Y) aponta para a normal."""
        return nrm.to_track_quat("-Y", "Z").to_matrix()

    HEAD = (0, 86, 52)
    # Nariz preto arredondado com brilho, na ponta do focinho
    tip, n = surf((0, 79.5, 76), (0, 0.08, 1))
    nose_c = G(*tip) + n * 0.8 * S
    add(ellipsoid("Nose", to_game(nose_c + Vector((0, 0, 1.2)) * S), (5.4, 4.0, 3.6), mats["M_Nose"]), "head")
    add(ellipsoid("NoseShine", to_game(nose_c + Vector((-1.6, -3.2, 2.8)) * S), (1.2, 0.6, 0.6), mats["M_Shine"]), "head")

    # Boquinha sorrindo: risquinho debaixo do nariz e a linha que volta pelo lado do
    # focinho subindo para a bochecha (cada ponto projetado na superfície)
    tz = tip.z

    def line_on(pts, lift=0.35):
        res = []
        for k in range(len(pts) - 1):
            a, b = Vector(pts[k]), Vector(pts[k + 1])
            for j in range(4):
                q = a.lerp(b, j / 4)
                ax = Vector((0, 76.5, q.z))
                d = q - ax
                if d.length < 1e-3:
                    d = Vector((0, -1, 0))
                hit, nn = surf(tuple(ax), tuple(d))
                res.append(to_game(G(*hit) + nn * lift * S))
        hit, nn = surf((0, 76.5, pts[-1][2]), tuple(Vector(pts[-1]) - Vector((0, 76.5, pts[-1][2]))))
        res.append(to_game(G(*hit) + nn * lift * S))
        return res

    # O sorriso fica no lábio de cima, logo acima da fenda da boca, e sobe no canto
    tz = NOSE_TIP[0]
    my = lambda z, up=0.35: mouth_y(z, tz) + up
    for s in (-1, 1):
        add(tube(f"Smile{s}", line_on([(s * 1.2, my(tz - 2.4), tz - 2.4), (s * 3.6, my(tz - 3.6), tz - 3.6), (s * 6.0, my(tz - 7.0), tz - 7.0),
                                       (s * 7.2, my(tz - MOUTH_BACK), tz - MOUTH_BACK), (s * 7.8, my(tz - MOUTH_BACK - 1.6, 2.4), tz - MOUTH_BACK - 1.6)]), 0.42, mats["M_Line"]), "head")

    # Olhos grandes: branco, íris castanha, pupila, brilho; pálpebra e sobrancelha
    for s, side in ((-1, "L"), (1, "R")):
        hit, n = surf(HEAD, (s * 0.56, 0.20, 0.80))
        rot = frame(n)
        fwd = rot @ Vector((0, -1, 0))
        upv = rot @ Vector((0, 0, 1))
        rgt = rot @ Vector((1, 0, 0))
        base = G(*hit) - fwd * 1.0 * S

        def at(d, up=0.0, sd=0.0):
            return to_game(base + (fwd * d + upv * up + rgt * sd) * S)

        add(ellipsoid(f"EyeWhite{side}", at(0), (3.9, 4.6, 2.4), mats["M_EyeWhite"], rot=rot), "head")
        # olhando um pouco para a frente (para o lado do focinho)
        look = -s * 0.9
        add(ellipsoid(f"Iris{side}", at(1.5, -0.2, look), (2.5, 2.8, 1.1), mats["M_Iris"], rot=rot), "head")
        add(ellipsoid(f"Pupil{side}", at(2.25, -0.2, look), (1.35, 1.6, 0.6), mats["M_Pupil"], rot=rot), "head")
        add(ellipsoid(f"EyeShine{side}", at(2.7, 1.0, look + 0.8), (0.65, 0.65, 0.3), mats["M_Shine"], rot=rot), "head")
        add(ellipsoid(f"Lid{side}", at(0.0, 3.4), (4.3, 1.5, 2.6), mats["M_FurSolid"], rot=rot), "head")
        add(tube(f"Brow{side}", [at(0.4, 5.4, s * 3.2), at(1.0, 6.3, 0.0), at(0.7, 6.0, -s * 3.2)], 0.9, mats["M_Brow"]), "head")
        # Orelhas redondas no alto e atrás, com o miolo mais escuro
        ehit, en = surf(HEAD, (s * 0.62, 0.74, -0.25))
        erot = gdir((s * 0.35, 0.1, 1.0)).to_track_quat("-Y", "Z").to_matrix()
        ec = G(*ehit) + en * 2.6 * S
        add(ellipsoid(f"Ear{side}", to_game(ec), (6.2, 6.0, 3.0), mats["M_FurSolid"], rot=erot), "head")
        add(ellipsoid(f"EarIn{side}", to_game(ec + (erot @ Vector((0, -1, 0))) * 2.1 * S + Vector((0, 0, -0.3 * S))), (3.8, 3.8, 1.2), mats["M_EarIn"], rot=erot), "head")

    # Dentro da boca (só aparece aberta): presas de cima no lábio de cima e dentinhos
    # de baixo no lábio de baixo (a língua é pintada no miolo da boca, MouthBag)
    for s in (-1, 1):
        z = tz - 3.2
        add(cone(f"Fang{s}", (s * 2.9, mouth_y(z, tz) + 1.6, z), (s * 2.9, mouth_y(z, tz) - 1.6, z + 0.2), 0.75, mats["M_Tooth"]), "head")
        z = tz - 4.0
        add(cone(f"ToothLow{s}", (s * 2.4, mouth_y(z, tz) - 1.8, z), (s * 2.4, mouth_y(z, tz) + 0.4, z + 0.1), 0.6, mats["M_Tooth"]), "jaw")
    # Patas: almofada escura embaixo e 4 garras escuras na frente
    for key, (x, z, hy) in LEGS.items():
        fb = "foot_" + key
        add(ellipsoid(f"Pad{key}", (x, 0.5, z + 4), (8.0, 1.0, 9.5), mats["M_Pad"]), fb)
        for cx in (-6.0, -2.1, 2.1, 6.0):
            toe, tn = surf((x + cx * 0.8, 4, z + 4), (cx * 0.04, 0.0, 1), reach=20)
            bz = toe.z - 1.0
            add(cone(f"Claw{key}{cx}", (x + cx, 2.2, bz), (x + cx * 1.05, 0.2, bz + 3.8), 1.2, mats["M_Claw"]), fb)
    return out


# ------------------------------------------------------------------ montagem
def build(variant):
    reset()
    mats = {k: material(k, c, 0.25 if k in ("M_Nose", "M_Pupil", "M_Claw") else 0.85) for k, c in PALETTE[variant].items()}
    mats["M_Shine"] = material("M_Shine", (1, 1, 1), 0.1, emit=0.6)
    mats["M_FurSolid"] = material("M_FurSolid", PALETTE[variant]["M_Fur"], 0.9)
    # O corpo leva a cor nos vértices (pelo, focinho claro e sombra dos tufos)
    fm = material("M_Fur", (1, 1, 1), 0.9)
    nt = fm.node_tree
    ca = nt.nodes.new("ShaderNodeVertexColor")
    ca.layer_name = "Col"
    nt.links.new(ca.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Base Color"])
    mats["M_Fur"] = fm
    mats["M_Tongue"] = material("M_Tongue", (0.86, 0.42, 0.45), 0.5)
    body = build_mesh(variant, mats)
    measure_nose(body)
    cut_mouth(body)
    rig = build_armature()
    bind(body, rig)
    mouth_bag(rig, mats, body)
    build_details(rig, mats, body)
    os.makedirs(os.path.join(ROOT, "assets", "models"), exist_ok=True)
    blend = os.path.join(ROOT, "blender", f"bear-{variant}.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend)
    glb = os.path.join(ROOT, "assets", "models", f"bear-{variant}.glb")
    bpy.ops.export_scene.gltf(
        filepath=glb, export_format="GLB", export_yup=True, export_apply=True,
        export_skins=True, export_animations=False, export_def_bones=False,
        export_vertex_color="ACTIVE", export_all_vertex_colors=False,
        export_materials="EXPORT", export_texcoords=False, export_normals=True,
    )
    tris = sum(len(p.vertices) - 2 for o in bpy.context.scene.objects if o.type == "MESH" for p in o.data.polygons)
    print(f"[urso] {variant}: {tris} triângulos -> {glb} ({os.path.getsize(glb) // 1024} KB)")


for v in (["polar", "brown"] if VARIANT == "all" else [VARIANT]):
    build(v)
