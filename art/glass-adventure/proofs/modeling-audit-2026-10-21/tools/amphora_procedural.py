"""Spike: a procedural glass amphora (lathe body with real wall, swept handles, trims, plinth).

blender -b --factory-startup --python amphora_procedural.py -- OUT.glb [OUT.blend]
Same envelope as adventure-v6/opaline-echo-amphora (0.92 m tall) for a side-by-side.
"""
import bpy, bmesh, math, sys
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:]
out_glb = argv[0]
out_blend = argv[1] if len(argv) > 1 else None

RADIAL = 36          # segments around the axis (silhouette still reads round at game distance)
bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene


# ---------- curve helpers (2D profile in r,z) ----------
def catmull_rom(points, samples_per_span=8, closed=False):
    pts = [Vector(p) for p in points]
    if closed:
        ext = [pts[-1]] + pts + [pts[0], pts[1]]
    else:
        ext = [pts[0] * 2 - pts[1]] + pts + [pts[-1] * 2 - pts[-2]]
    out = []
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        for s in range(samples_per_span):
            t = s / samples_per_span
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    if not closed:
        out.append(pts[-1].copy())
    return out


def resample(poly, count):
    """Even arc-length resample of a polyline."""
    lengths = [0.0]
    for a, b in zip(poly, poly[1:]):
        lengths.append(lengths[-1] + (b - a).length)
    total = lengths[-1]
    out, j = [], 0
    for i in range(count):
        d = total * i / (count - 1)
        while j < len(lengths) - 2 and lengths[j + 1] < d:
            j += 1
        seg = lengths[j + 1] - lengths[j]
        t = 0 if seg == 0 else (d - lengths[j]) / seg
        out.append(poly[j].lerp(poly[j + 1], t))
    return out


def resample_by_curvature(poly, count, bias=3.0):
    """Arc-length resample weighted by turning angle: points go where the silhouette bends."""
    w = [0.0]
    for i in range(1, len(poly)):
        a = poly[max(i - 2, 0)]; b = poly[i - 1]; c = poly[i]
        d1 = (b - a); d2 = (c - b)
        turn = d1.angle(d2, 0.0) if d1.length > 1e-9 and d2.length > 1e-9 else 0.0
        w.append(w[-1] + d2.length * (1.0 + bias * turn / max(d2.length, 1e-6) * 0.01))
    total = w[-1]; out = []; j = 0
    for i in range(count):
        t = total * i / (count - 1)
        while j < len(w) - 2 and w[j + 1] < t:
            j += 1
        seg = w[j + 1] - w[j]
        f = 0 if seg == 0 else (t - w[j]) / seg
        out.append(poly[j].lerp(poly[j + 1], f))
    return out


def offset_inward(poly, thickness_at):
    """Offset an outer r,z profile (walking upward) inward along its 2D normal."""
    out = []
    for i, p in enumerate(poly):
        a = poly[max(i - 1, 0)]; b = poly[min(i + 1, len(poly) - 1)]
        tangent = (b - a).normalized()
        normal_in = Vector((-tangent.y, tangent.x))  # left of upward walk = toward axis
        if normal_in.x > 0:
            normal_in = -normal_in
        out.append(p + normal_in * thickness_at(p.y))
    return out


def lathe(name, profile_rz, segments=RADIAL, smooth=True):
    """Revolve an r,z polyline (open, ends on the axis or not) into a mesh around Z."""
    bm = bmesh.new()
    verts = [bm.verts.new((p.x, 0.0, p.y)) for p in profile_rz]
    edges = [bm.edges.new((verts[i], verts[i + 1])) for i in range(len(verts) - 1)]
    bmesh.ops.spin(bm, geom=verts + edges, cent=(0, 0, 0), axis=(0, 0, 1),
                   angle=2 * math.pi, steps=segments, use_duplicate=False)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    ob = bpy.data.objects.new(name, me); scn.collection.objects.link(ob)
    return ob


def sweep_tube(name, path_pts, radius_at, ring=14, flatten=0.62, samples_per_span=10):
    """Sweep an elliptical section along a Catmull-Rom path with parallel-transport frames; capped."""
    path = catmull_rom(path_pts, samples_per_span)
    path = resample(path, 30)
    n = len(path)
    tangents = [(path[min(i + 1, n - 1)] - path[max(i - 1, 0)]).normalized() for i in range(n)]
    up = Vector((0, 1, 0))  # handles live in the XZ plane; Y is the flat side
    frames = []
    nrm = up.cross(tangents[0]).normalized()
    for i in range(n):
        t = tangents[i]
        nrm = (nrm - t * nrm.dot(t)).normalized()
        bin_ = t.cross(nrm).normalized()
        frames.append((nrm, bin_))
    bm = bmesh.new()
    rings = []
    for i, p in enumerate(path):
        u = i / (n - 1)
        r = radius_at(u)
        nrm, bin_ = frames[i]
        ringv = []
        for k in range(ring):
            a = 2 * math.pi * k / ring
            ringv.append(bm.verts.new(p + nrm * (math.cos(a) * r) + bin_ * (math.sin(a) * r * (1 / flatten))))
        rings.append(ringv)
    for i in range(n - 1):
        for k in range(ring):
            a, b = rings[i][k], rings[i][(k + 1) % ring]
            c, d = rings[i + 1][(k + 1) % ring], rings[i + 1][k]
            bm.faces.new((a, b, c, d))
    bm.faces.new(list(reversed(rings[0]))); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me); scn.collection.objects.link(ob)
    return ob


# ---------- body: one closed profile = outer wall, rounded lip, inner wall, thick base ----------
outer_ctrl = [(0.000, 0.016), (0.070, 0.012), (0.104, 0.002), (0.122, 0.006), (0.127, 0.020),
              (0.114, 0.040), (0.092, 0.058), (0.100, 0.085), (0.155, 0.150), (0.212, 0.250),
              (0.238, 0.360), (0.231, 0.455), (0.200, 0.545), (0.150, 0.620), (0.100, 0.680),
              (0.089, 0.740), (0.094, 0.800), (0.110, 0.858), (0.124, 0.893)]
outer = resample_by_curvature(catmull_rom(outer_ctrl, 12), 46)


def wall(z):
    return 0.016 if z < 0.12 else (0.009 if z < 0.66 else 0.0075)


body_wall = [p for p in outer if p.y >= 0.075]
inner = offset_inward(body_wall, wall)
inner = [inner[0]] + inner[1:-1:2] + [inner[-1]]
lip_o, lip_i = outer[-1], inner[-1]
mid = (lip_o + lip_i) / 2; rad = (lip_o - lip_i).length / 2
lip = []
for k in range(1, 6):  # rounded lip: half circle over the rim, never a cut edge
    a = math.pi * k / 6
    d = (lip_o - lip_i).normalized()
    lip.append(mid + d * math.cos(a) * rad + Vector((0, 1)) * math.sin(a) * rad * 1.15)
inner_down = list(reversed(inner))
floor_z = inner_down[-1].y
inner_floor = [Vector((inner_down[-1].x * (1 - f), floor_z - 0.004 * f * f)) for f in (0.33, 0.66, 1.0)]
profile = outer + lip + inner_down + inner_floor
body = lathe('amphora_body', profile)

# ---------- handles: tapered flattened straps that flare where they meet the glass ----------
handle_path = [(0.210, 0.0, 0.497), (0.236, 0.0, 0.508), (0.282, 0.0, 0.560), (0.302, 0.0, 0.665),
               (0.284, 0.0, 0.780), (0.224, 0.0, 0.838), (0.150, 0.0, 0.826), (0.112, 0.0, 0.806), (0.090, 0.0, 0.800)]


def handle_radius(u):
    flare = 0.010 * (math.exp(-((u - 0.0) / 0.09) ** 2) + math.exp(-((u - 1.0) / 0.09) ** 2))
    return 0.0145 + 0.002 * math.sin(math.pi * u) + flare


h1 = sweep_tube('amphora_handle_r', handle_path, handle_radius, ring=10, samples_per_span=4)
h2 = h1.copy(); h2.data = h1.data.copy(); h2.name = 'amphora_handle_l'; scn.collection.objects.link(h2)
h2.matrix_world = Matrix.Rotation(math.pi, 4, 'Z')


# ---------- gold trims: half-round beads that follow the body radius ----------
def radius_at_z(z):
    best = min(outer, key=lambda p: abs(p.y - z))
    return best.x


def bead(name, z, height=0.012, proud=0.004):
    r0 = radius_at_z(z) - 0.002
    pts = []
    for k in range(6):
        a = math.pi * (k / 5) - math.pi / 2
        pts.append(Vector((r0 + (proud + 0.002) * math.cos(a), z + height / 2 * math.sin(a))))
    pts = [Vector((r0 - 0.003, pts[0].y))] + pts + [Vector((r0 - 0.003, pts[-1].y))]
    return lathe(name, pts + [pts[0]], segments=RADIAL)


trims = [bead('amphora_trim_neck', 0.690), bead('amphora_trim_lip', 0.862, height=0.010), bead('amphora_trim_belly', 0.405, height=0.020, proud=0.003)]

# ---------- plinth: revolved mouldings, every edge rounded ----------
plinth_ctrl = [(0.0, -0.300), (0.215, -0.300), (0.222, -0.296), (0.224, -0.288), (0.224, -0.262),
               (0.218, -0.256), (0.200, -0.250), (0.196, -0.236), (0.178, -0.226), (0.172, -0.212),
               (0.172, -0.050), (0.178, -0.044), (0.196, -0.036), (0.204, -0.026), (0.205, -0.008),
               (0.200, -0.002), (0.192, 0.000), (0.0, 0.000)]
plinth_pts = [Vector(p) for p in plinth_ctrl]
plinth = lathe('amphora_plinth', resample_by_curvature(catmull_rom(plinth_pts, 6), 34), segments=40)
for p in plinth.data.polygons:
    p.use_smooth = True
plinth.data.set_sharp_from_angle(angle=math.radians(40))


# ---------- materials ----------
def principled(name, color, metallic=0.0, rough=0.1, transmission=0.0, ior=1.48, coat=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metallic
    b.inputs['Roughness'].default_value = rough
    b.inputs['Transmission Weight'].default_value = transmission
    b.inputs['IOR'].default_value = ior
    b.inputs['Coat Weight'].default_value = coat
    return m


glass = principled('glass_opal', (0.86, 0.95, 0.93), rough=0.06, transmission=0.92)
jade = principled('glass_jade', (0.30, 0.72, 0.52), rough=0.12, transmission=0.55)
gold = principled('gold_trim', (1.0, 0.77, 0.40), metallic=1.0, rough=0.22)
marble = principled('marble_ivory', (0.90, 0.88, 0.84), rough=0.35, coat=0.3)
body.data.materials.append(glass)
for h in (h1, h2):
    h.data.materials.append(jade)
for t in trims:
    t.data.materials.append(gold)
plinth.data.materials.append(marble)

# ---------- report + export ----------
tris = 0
for ob in [body, h1, h2, plinth] + trims:
    bm = bmesh.new(); bm.from_mesh(ob.data)
    t = sum(len(f.verts) - 2 for f in bm.faces)
    nm = sum(1 for e in bm.edges if not e.is_manifold)
    tris += t
    print(f'PART {ob.name:22} tris {t:6d} nonManifold {nm}')
    bm.free()
print('TOTAL_TRIS', tris)
bpy.ops.export_scene.gltf(filepath=out_glb, export_format='GLB', export_yup=True, export_apply=True)
if out_blend:
    bpy.ops.wm.save_as_mainfile(filepath=out_blend)
print('SPIKE_DONE', out_glb)
