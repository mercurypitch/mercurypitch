"""Solids and surfaces of revolution around +Z from an (r, z) profile.

The mesh is built explicitly (rings of `segments` vertices, one pole vertex where
the profile touches the axis) rather than with the Screw modifier, so UVs, poles
and the seam are exact and a closed profile always yields a closed manifold.
"""

import math

import bmesh

from . import scene

POLE_EPS = 1e-6


def lathe(name, profile, segments=48, *, closed=False, modulate=None, uv=True, smooth=True,
          sharp_degrees=None, material=None, span_materials=None, flat_spans=(), coll=None):
    """Revolve `profile` (list of Vector((r, z)) walked bottom to top) into a mesh object.

    closed: True when the profile is a loop (first point = last point implied), for
        beads and torus-like trims. An open profile that starts and ends on the axis
        (r = 0) already gives a closed solid: outer wall, lip, inner wall, floor.
    modulate: optional f(theta, z, i) -> metres, pushed along each point's outward
        profile normal. Use it for lobes and flutes, and confine it to a height band
        inside f; a modulation that also moves the lip and foot is what made v1 wobble.
    sharp_degrees: mark edges sharper than this as sharp (Smooth by Angle semantics).
    material / span_materials: one material, or a list of slots with
        span_materials[i] naming the slot of the faces between profile points i and
        i + 1 (profile.chain builds both from pieces). One shell then carries glass,
        gold bands and a stone foot; where a slot changes on a smooth join the
        normal stays shared, so the change is a clean colour line, not a seam.
    flat_spans: span indices shaded flat, for faceted metal or cut stone.
    uv: True for UVs as fractions (u around, v along the outline), or a tile size
        in metres for UVs in tiles: u = angle x radius / tile, v = arc length / tile,
        so a tiling texture keeps its size on every part (hammered gold on a wide
        base ring and a thin bead alike). The seam is at angle 0.
    """
    from .profile import normal_in

    pts = list(profile)
    n = len(pts)
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new('UVMap') if uv is not False else None
    angles = [2 * math.pi * j / segments for j in range(segments)]
    arc = [0.0]
    for a, b in zip(pts, pts[1:] + ([pts[0]] if closed else [])):
        arc.append(arc[-1] + (b - a).length)
    total = arc[-1] or 1.0

    rings = []
    for i, p in enumerate(pts):
        if p.x < POLE_EPS:
            rings.append(bm.verts.new((0.0, 0.0, p.y)))
            continue
        outward = -normal_in(pts, i)
        ring = []
        for theta in angles:
            r, z = p.x, p.y
            if modulate is not None:
                d = modulate(theta, p.y, i)
                r += outward.x * d
                z += outward.y * d
            ring.append(bm.verts.new((r * math.cos(theta), r * math.sin(theta), z)))
        rings.append(ring)

    spans = list(zip(range(n - 1), range(1, n)))
    if closed:
        spans.append((n - 1, 0))
    if span_materials is not None and len(span_materials) < len(spans):
        if not (closed and len(span_materials) == len(spans) - 1):
            raise ValueError(f'{name}: {len(span_materials)} span materials for {len(spans)} spans')
    flat = set(flat_spans)
    for si, (ia, ib) in enumerate(spans):
        ra, rb = rings[ia], rings[ib]
        slot = 0 if span_materials is None else span_materials[min(si, len(span_materials) - 1)]
        if isinstance(uv, bool):
            va = arc[ia] / total
            vb = (arc[ib] if ib != 0 else total) / total
            sa = sb = 1.0
        else:  # tiles: metres over the tile size
            va = arc[ia] / uv
            vb = (arc[ib] if ib != 0 else total) / uv
            sa = 2 * math.pi * pts[ia].x / uv
            sb = 2 * math.pi * pts[ib].x / uv
            sa, sb = (sa or sb), (sb or sa)  # a pole takes its neighbour's scale
        for j in range(segments):
            k = (j + 1) % segments
            ua, ub = j / segments, (j + 1) / segments
            if isinstance(ra, list) and isinstance(rb, list):
                verts = (ra[j], ra[k], rb[k], rb[j])
                uvs = ((ua * sa, va), (ub * sa, va), (ub * sb, vb), (ua * sb, vb))
            elif isinstance(ra, list):  # top pole
                verts = (ra[j], ra[k], rb)
                uvs = ((ua * sa, va), (ub * sa, va), ((ua + ub) / 2 * sb, vb))
            elif isinstance(rb, list):  # bottom pole
                verts = (ra, rb[k], rb[j])
                uvs = (((ua + ub) / 2 * sa, va), (ub * sb, vb), (ua * sb, vb))
            else:
                continue
            face = bm.faces.new(verts)
            face.material_index = slot
            face.smooth = smooth and si not in flat
            if uv_layer is not None:
                for loop, coord in zip(face.loops, uvs):
                    loop[uv_layer].uv = coord

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = scene.from_bmesh(name, bm, coll=coll, smooth=None, material=material)
    bm.free()
    if sharp_degrees is not None:
        scene.mark_sharp(obj, sharp_degrees)
    return obj


def band(z, z0, z1, feather):
    """Weight 1 inside [z0, z1], easing to 0 over `feather` metres outside it (smoothstep)."""
    if z0 <= z <= z1:
        return 1.0
    d = (z0 - z) if z < z0 else (z - z1)
    if d >= feather:
        return 0.0
    t = 1.0 - d / feather
    return t * t * (3 - 2 * t)
