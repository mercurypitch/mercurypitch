"""Numeric mesh gates. These decide acceptance; a critic's opinion never overrides them.

`report(obj)` measures the evaluated mesh in world space: manifoldness, open
edges, slivers, n-gons, self-intersections (BVH), connected parts and whether
they touch, volume, UVs and size. `failures(report, ...)` turns it into a list of named problems.
"""

import math

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def _bm(obj, evaluated=True, weld=None):
    bm = bmesh.new()
    if evaluated:
        depsgraph = bpy.context.evaluated_depsgraph_get()
        evaluated_obj = obj.evaluated_get(depsgraph)
        mesh = evaluated_obj.to_mesh()
        bm.from_mesh(mesh)
        evaluated_obj.to_mesh_clear()
    else:
        bm.from_mesh(obj.data)
    bm.transform(obj.matrix_world)
    if weld:
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=weld)
    return bm


def components(bm):
    parent = {v.index: v.index for v in bm.verts}

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for e in bm.edges:
        a, b = find(e.verts[0].index), find(e.verts[1].index)
        if a != b:
            parent[a] = b
    return len({find(v.index) for v in bm.verts})


def face_components(bm):
    """Component label per face index (edge-connected shells)."""
    bm.faces.ensure_lookup_table()
    label = [-1] * len(bm.faces)
    current = 0
    for start in bm.faces:
        if label[start.index] >= 0:
            continue
        stack = [start]
        label[start.index] = current
        while stack:
            face = stack.pop()
            for edge in face.edges:
                for other in edge.link_faces:
                    if label[other.index] < 0:
                        label[other.index] = current
                        stack.append(other)
        current += 1
    return label


def loose_pieces(bm, touch=0.0015):
    """Shells that do not touch, within `touch` metres, the cluster of touching shells with the
    most faces: a shard that would fly apart in the air, a part floating free of its assembly.
    A gold ring piece resting on a jade foot piece touches; a sliver across a gap does not."""
    labels = face_components(bm)
    count = max(labels) + 1 if labels else 0
    if count < 2:
        return 0
    bm.verts.ensure_lookup_table()
    trees, sizes, points = [], [], []
    for c in range(count):
        faces = [f for f in bm.faces if labels[f.index] == c]
        verts = sorted({v.index for f in faces for v in f.verts})
        remap = {v: k for k, v in enumerate(verts)}
        points.append([bm.verts[v].co.copy() for v in verts])
        trees.append(BVHTree.FromPolygons(points[-1], [[remap[v.index] for v in f.verts] for f in faces]))
        sizes.append(len(faces))

    def touching(i, j):  # crossing surfaces, or a vertex of either within `touch` of the other's surface
        if trees[i].overlap(trees[j]):
            return True
        return any(trees[j].find_nearest(co, touch)[0] is not None for co in points[i]) or \
            any(trees[i].find_nearest(co, touch)[0] is not None for co in points[j])

    parent = list(range(count))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i in range(count):
        for j in range(i + 1, count):
            if find(i) != find(j) and touching(i, j):
                parent[find(i)] = find(j)
    clusters = {}
    for c in range(count):
        clusters.setdefault(find(c), []).append(c)
    main = max(clusters.values(), key=lambda shells: sum(sizes[c] for c in shells))
    return count - len(main)


def self_intersections(bm, limit=2000, within_shell=False):
    """Face pairs that cross each other, ignoring neighbours that share a vertex.

    within_shell=True counts only crossings inside one connected shell: a gold band
    deliberately sunk into a glass wall is two shells of one object and is fine; a
    shell that folds through itself is not.
    """
    bm.faces.ensure_lookup_table()
    shell = face_components(bm) if within_shell else None
    tree = BVHTree.FromBMesh(bm, epsilon=0.0)
    count = 0
    for i, j in tree.overlap(tree):
        if i >= j:
            continue
        if shell is not None and shell[i] != shell[j]:
            continue
        fa, fb = bm.faces[i], bm.faces[j]
        if {v.index for v in fa.verts} & {v.index for v in fb.verts}:
            continue
        count += 1
        if count >= limit:
            break
    return count


def report(obj, evaluated=True, intersections=True, within_shell=False, weld=None):
    """Measure obj. weld (metres) merges coincident vertices first: glTF stores a vertex
    once per UV seam, hard edge and material, so an imported closed shell reads as
    open along every seam until it is welded. Use weld=1e-6 on anything imported."""
    bm = _bm(obj, evaluated, weld)
    bm.verts.ensure_lookup_table()
    bm.verts.index_update()
    lo = Vector((min(v.co.x for v in bm.verts), min(v.co.y for v in bm.verts), min(v.co.z for v in bm.verts)))
    hi = Vector((max(v.co.x for v in bm.verts), max(v.co.y for v in bm.verts), max(v.co.z for v in bm.verts)))
    non_manifold = sum(1 for e in bm.edges if not e.is_manifold)
    boundary = sum(1 for e in bm.edges if e.is_boundary)
    out = {
        'name': obj.name,
        'verts': len(bm.verts),
        'faces': len(bm.faces),
        'tris': sum(len(f.verts) - 2 for f in bm.faces),
        'non_manifold_edges': non_manifold,
        'boundary_edges': boundary,
        'wire_edges': sum(1 for e in bm.edges if e.is_wire),
        'loose_verts': sum(1 for v in bm.verts if not v.link_edges),
        'zero_area_faces': sum(1 for f in bm.faces if f.calc_area() < 1e-10),
        'ngons': sum(1 for f in bm.faces if len(f.verts) > 4),
        'components': components(bm),
        'loose_pieces': loose_pieces(bm),
        'closed': non_manifold == 0 and boundary == 0,
        'volume_m3': None,
        'self_intersections': self_intersections(bm, within_shell=within_shell) if intersections else None,
        'uv_layers': [layer.name for layer in obj.data.uv_layers],
        'materials': [slot.material.name if slot.material else None for slot in obj.material_slots],
        'size_m': [round(hi[k] - lo[k], 5) for k in range(3)],
        'min_m': [round(lo[k], 5) for k in range(3)],
        'max_m': [round(hi[k], 5) for k in range(3)],
        'sharp_edges_over_30deg': sum(1 for e in bm.edges if e.is_manifold and e.calc_face_angle(0.0) > math.radians(30)),
    }
    if out['closed']:
        out['volume_m3'] = bm.calc_volume(signed=True)
    bm.free()
    return out


def failures(rep, *, closed=True, single_part=False, max_tris=None, uv=True):
    problems = []
    if closed and not rep['closed']:
        problems.append(f"{rep['name']}: open or non-manifold ({rep['boundary_edges']} boundary, "
                        f"{rep['non_manifold_edges']} non-manifold edges)")
    if closed and rep['volume_m3'] is not None and rep['volume_m3'] <= 0:
        problems.append(f"{rep['name']}: inside-out (signed volume {rep['volume_m3']:.6f})")
    if rep['zero_area_faces']:
        problems.append(f"{rep['name']}: {rep['zero_area_faces']} zero-area faces")
    if rep['loose_verts'] or rep['wire_edges']:
        problems.append(f"{rep['name']}: loose geometry ({rep['loose_verts']} verts, {rep['wire_edges']} wire edges)")
    if rep['self_intersections']:
        problems.append(f"{rep['name']}: {rep['self_intersections']} self-intersecting face pairs")
    if rep.get('loose_pieces'):
        problems.append(f"{rep['name']}: {rep['loose_pieces']} pieces float free of the rest")
    if single_part and rep['components'] != 1:
        problems.append(f"{rep['name']}: {rep['components']} separate parts, expected 1")
    if max_tris is not None and rep['tris'] > max_tris:
        problems.append(f"{rep['name']}: {rep['tris']} tris over budget {max_tris}")
    if uv and not rep['uv_layers']:
        problems.append(f"{rep['name']}: no UV layer")
    return problems


def overlap(a, b):
    """True when two objects' surfaces cross or touch (BVH overlap in world space)."""
    bma, bmb = _bm(a), _bm(b)
    ta = BVHTree.FromBMesh(bma, epsilon=1e-6)
    tb = BVHTree.FromBMesh(bmb, epsilon=1e-6)
    hit = bool(ta.overlap(tb))
    bma.free()
    bmb.free()
    return hit


def cavity_intrusions(body, others, *, z_min, z_max, tolerance=1e-5):
    """Vertices of `others` inside the cavity of `body`, a hollow vessel lathed round Z.

    At each vertex's height and angle a ray runs out from the axis; the first wall it
    meets is the cavity's, so a vertex nearer the axis than that hit sits inside the
    vessel's hollow. z_min and z_max bound the cavity (above the floor, below the roof or
    mouth); vertices outside them are not asked. Returns {name: (count, deepest metres)}.
    A band's hidden back or a stone's setting cut into the cavity shows as a sawtooth on
    the inner glass once the vessel breaks (the urn's round 1: 0.8 mm, a quarter of the
    critic's samples), and no closure or self-intersection gate sees it: the parts are
    separate shells.
    """
    bm = _bm(body)
    tree = BVHTree.FromBMesh(bm)
    out = {}
    for obj in others:
        count, deepest = 0, 0.0
        for v in obj.data.vertices:
            p = obj.matrix_world @ v.co
            r = math.hypot(p.x, p.y)
            if not z_min < p.z < z_max or r < 1e-6:
                continue
            hit = tree.ray_cast(Vector((0.0, 0.0, p.z)), Vector((p.x / r, p.y / r, 0.0)), 10.0)
            if hit[0] is None:
                continue
            wall = math.hypot(hit[0].x, hit[0].y)
            if r < wall - tolerance:
                count += 1
                deepest = max(deepest, wall - r)
        out[obj.name] = (count, deepest)
    bm.free()
    return out
