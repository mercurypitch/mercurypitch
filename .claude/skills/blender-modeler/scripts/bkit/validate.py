"""Numeric mesh gates. These decide acceptance; a critic's opinion never overrides them.

`report(obj)` measures the evaluated mesh in world space: manifoldness, open
edges, slivers, n-gons, self-intersections (BVH), connected parts, volume,
UVs and size. `failures(report, ...)` turns it into a list of named problems.
"""

import math

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def _bm(obj, evaluated=True):
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


def self_intersections(bm, limit=2000):
    """Face pairs that cross each other, ignoring neighbours that share a vertex."""
    bm.faces.ensure_lookup_table()
    tree = BVHTree.FromBMesh(bm, epsilon=0.0)
    count = 0
    for i, j in tree.overlap(tree):
        if i >= j:
            continue
        fa, fb = bm.faces[i], bm.faces[j]
        if {v.index for v in fa.verts} & {v.index for v in fb.verts}:
            continue
        count += 1
        if count >= limit:
            break
    return count


def report(obj, evaluated=True, intersections=True):
    bm = _bm(obj, evaluated)
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
        'closed': non_manifold == 0 and boundary == 0,
        'volume_m3': None,
        'self_intersections': self_intersections(bm) if intersections else None,
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
