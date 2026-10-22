"""Voronoi pre-fracture of closed shells into a fixed number of physically connected shards.

Each part (body, handles, trims) is intersected with the same convex Voronoi
cells using Blender's exact boolean, so shard i is every part's piece of cell i.
Cut faces take the material you pass per part (glass gets a rougher cut glass,
gold stays gold). A cell whose pieces do not touch would fly apart as one shard,
so an attempt is rejected when any shard is not one connected group, and the
seeds are drawn again. Volumes are checked against the intact parts at the end.

Inputs must be closed manifolds (the boolean solvers only guarantee results
then), which is why this runs on procedural shells, never on raw generator
output.
"""

import random

import bmesh
import bpy
from mathutils import Vector

from . import scene, validate


def surface_samples(objects, count, rng):
    tris = []
    for obj in objects:
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bm.transform(obj.matrix_world)
        bmesh.ops.triangulate(bm, faces=bm.faces)
        for f in bm.faces:
            a, b, c = (v.co.copy() for v in f.verts)
            tris.append((f.calc_area(), a, b, c))
        bm.free()
    total = sum(t[0] for t in tris)
    cumulative = []
    acc = 0.0
    for t in tris:
        acc += t[0]
        cumulative.append(acc)
    import bisect

    out = []
    for _ in range(count):
        _, a, b, c = tris[min(bisect.bisect_left(cumulative, rng.random() * total), len(tris) - 1)]
        u, v = rng.random(), rng.random()
        if u + v > 1:
            u, v = 1 - u, 1 - v
        out.append(a + (b - a) * u + (c - a) * v)
    return out


def spread(points, k, rng):
    """Farthest-point selection: k well-spread seeds from dense samples."""
    chosen = [points[rng.randrange(len(points))]]
    dist = [(p - chosen[0]).length_squared for p in points]
    while len(chosen) < k:
        i = max(range(len(points)), key=dist.__getitem__)
        chosen.append(points[i])
        for j, p in enumerate(points):
            d = (p - points[i]).length_squared
            if d < dist[j]:
                dist[j] = d
    return chosen


def cell(seed, others, lo, hi, name):
    """Convex Voronoi cell of `seed` clipped to the box lo..hi, as a closed mesh object."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    centre = (lo + hi) / 2
    size = hi - lo
    for v in bm.verts:
        v.co = Vector((centre.x + v.co.x * size.x, centre.y + v.co.y * size.y, centre.z + v.co.z * size.z))
    for other in others:
        normal = (other - seed).normalized()
        mid = (other + seed) / 2
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        result = bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-7, plane_co=mid, plane_no=normal,
                                        clear_outer=True, clear_inner=False)
        cut = [e for e in result['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
        if cut:
            bmesh.ops.holes_fill(bm, edges=cut, sides=0)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = scene.from_bmesh(name, bm, smooth=False)
    bm.free()
    return obj


def _intersect(part, cutter, cut_material):
    """part ∩ cutter as a new object (None when empty); cut faces get `cut_material`."""
    cutter.data.materials.clear()
    cutter.data.materials.append(cut_material)
    probe = part.copy()
    probe.data = part.data.copy()
    scene.link(probe)
    mod = probe.modifiers.new('cell', 'BOOLEAN')
    mod.operation = 'INTERSECT'
    mod.solver = 'EXACT'
    mod.material_mode = 'TRANSFER'
    mod.object = cutter
    scene.bake_modifiers(probe)
    scene.clean(probe)
    if len(probe.data.polygons) == 0:
        bpy.data.objects.remove(probe)
        return None
    return probe


def _face_islands(bm):
    """Lists of face indices, one per edge-connected island."""
    bm.faces.ensure_lookup_table()
    seen, islands = set(), []
    for start in bm.faces:
        if start.index in seen:
            continue
        stack, island = [start], []
        seen.add(start.index)
        while stack:
            face = stack.pop()
            island.append(face.index)
            for edge in face.edges:
                for other in edge.link_faces:
                    if other.index not in seen:
                        seen.add(other.index)
                        stack.append(other)
        islands.append(island)
    return islands


def _split_loose(obj):
    """One object per connected island of obj (UVs and materials kept); obj is reused for the first."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    islands = _face_islands(bm)
    bm.free()
    if len(islands) <= 1:
        return [obj]
    source = obj.data.copy()
    out = []
    for k, island in enumerate(islands):
        keep = set(island)
        bm = bmesh.new()
        bm.from_mesh(source)
        bm.faces.ensure_lookup_table()
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index not in keep], context='FACES')
        target = obj if k == 0 else obj.copy()
        if k > 0:
            target.data = source.copy()
            scene.link(target)
        bm.to_mesh(target.data)
        bm.free()
        out.append(target)
    bpy.data.meshes.remove(source)
    return out


def _groups(pieces):
    """Connected groups of pieces (pieces touch when their surfaces cross or meet)."""
    parent = list(range(len(pieces)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i in range(len(pieces)):
        for j in range(i + 1, len(pieces)):
            if find(i) != find(j) and validate.overlap(pieces[i], pieces[j]):
                parent[find(i)] = find(j)
    groups = {}
    for i, piece in enumerate(pieces):
        groups.setdefault(find(i), []).append(piece)
    return list(groups.values())


def _bbox_overlaps(obj, lo, hi):
    a, b = scene.bounds([obj])
    return all(a[k] <= hi[k] and b[k] >= lo[k] for k in range(3))


def fracture(parts, count, *, cut_materials, seed=1, attempts=24, seed_on=None, prefix='shard_',
             min_piece_fraction=0.002, log=print):
    """Fracture `parts` into exactly `count` shards; returns the shard objects.

    cut_materials: {part_name: material} for the new cut faces of each part.
    seed_on: objects whose surfaces seed the cells (default: the largest part).
    Pieces smaller than `min_piece_fraction` of their own part's volume are dropped
    as slivers before grouping (invisible chips that only cost triangles). The
    fraction is per part, so a thin gold inlay keeps its pieces on every shard
    instead of vanishing next to a heavy body.
    """
    seed_on = seed_on or [max(parts, key=lambda o: validate.report(o, intersections=False)['volume_m3'] or 0)]
    lo, hi = scene.bounds(parts)
    pad = (hi - lo) * 0.1
    lo, hi = lo - pad, hi + pad
    volumes = {p.name: validate.report(p, intersections=False)['volume_m3'] for p in parts}
    total_volume = sum(v for v in volumes.values() if v)
    for attempt in range(attempts):
        rng = random.Random(seed + attempt)
        seeds = spread(surface_samples(seed_on, 3000, rng), count, rng)
        created, shards, ok = [], [], True
        for i, s in enumerate(seeds):
            cutter = cell(s, [o for j, o in enumerate(seeds) if j != i], lo, hi, f'_cell_{i:03d}')
            created.append(cutter)
            clo, chi = scene.bounds([cutter])
            pieces = []
            for part in parts:
                if not _bbox_overlaps(part, clo, chi):
                    continue
                piece = _intersect(part, cutter, cut_materials[part.name])
                if piece is None:
                    continue
                for loose in _split_loose(piece):
                    vol = validate.report(loose, intersections=False)['volume_m3'] or 0.0
                    if vol < min_piece_fraction * (volumes[part.name] or total_volume):
                        bpy.data.objects.remove(loose)
                        continue
                    pieces.append(loose)
            created.extend(pieces)
            groups = _groups(pieces) if pieces else []
            if len(groups) != 1:
                log(f'attempt {attempt}: cell {i} gives {len(groups)} separate groups, reseeding')
                ok = False
                break
            shards.append(pieces)
        if not ok:
            for obj in created:
                if obj.name in bpy.data.objects:
                    bpy.data.objects.remove(obj)
            continue
        for obj in created:
            if obj.name.startswith('_cell_'):
                bpy.data.objects.remove(obj)
        result = []
        for i, pieces in enumerate(shards):
            shard = scene.join(pieces, f'{prefix}{i:03d}')
            scene.clean(shard, triangulate=True)
            scene.set_origin(shard, scene.centroid(shard))
            result.append(shard)
        recovered = sum(validate.report(s, intersections=False)['volume_m3'] or 0.0 for s in result)
        log(f'fracture: attempt {attempt}, {len(result)} shards, volume {recovered / total_volume:.4f} of intact')
        return result
    raise RuntimeError(f'no seed set gave {count} connected shards in {attempts} attempts')
