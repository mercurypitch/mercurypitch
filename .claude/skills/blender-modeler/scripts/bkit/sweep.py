"""Tubes and straps swept along a 3D Catmull-Rom path with rotation-minimising frames.

Handles, rails, scrolls and ribs. Frames come from the double-reflection method
(Wang et al. 2008), so the section never twists the way a fixed up-vector frame
does where the path turns toward that vector.
"""

import math

import bmesh
from mathutils import Vector

from . import scene


def path(points, samples=40, curvature_bias=0.0):
    """Centripetal Catmull-Rom through 3D control points, resampled.

    curvature_bias 0 spaces the samples evenly; above 0 it spends that share of
    them where the path turns (`profile.resample`), so a tight crown is as smooth
    as a straight run for the same triangle count.
    """
    pts = [Vector(p) for p in points]
    ext = [pts[0] * 2 - pts[1]] + pts + [pts[-1] * 2 - pts[-2]]
    dense = []
    for i in range(1, len(ext) - 2):
        dense += _centripetal(ext[i - 1], ext[i], ext[i + 1], ext[i + 2], 24)
    dense.append(pts[-1].copy())
    if curvature_bias > 0:
        from . import profile
        return profile._resample_run(dense, profile._segment_weights(dense, curvature_bias), samples)
    lengths = [0.0]
    for a, b in zip(dense, dense[1:]):
        lengths.append(lengths[-1] + (b - a).length)
    total = lengths[-1]
    out, j = [], 0
    for i in range(samples):
        target = total * i / (samples - 1)
        while j < len(dense) - 2 and lengths[j + 1] < target:
            j += 1
        seg = lengths[j + 1] - lengths[j]
        f = 0.0 if seg <= 0 else (target - lengths[j]) / seg
        out.append(dense[j].lerp(dense[j + 1], f))
    return out


def _centripetal(p0, p1, p2, p3, n):
    def knot(t, a, b):
        return t + max((b - a).length, 1e-9) ** 0.5

    t0 = 0.0
    t1 = knot(t0, p0, p1)
    t2 = knot(t1, p1, p2)
    t3 = knot(t2, p2, p3)
    out = []
    for k in range(n):
        t = t1 + (t2 - t1) * k / n
        a1 = p0 * ((t1 - t) / (t1 - t0)) + p1 * ((t - t0) / (t1 - t0))
        a2 = p1 * ((t2 - t) / (t2 - t1)) + p2 * ((t - t1) / (t2 - t1))
        a3 = p2 * ((t3 - t) / (t3 - t2)) + p3 * ((t - t2) / (t3 - t2))
        b1 = a1 * ((t2 - t) / (t2 - t0)) + a2 * ((t - t0) / (t2 - t0))
        b2 = a2 * ((t3 - t) / (t3 - t1)) + a3 * ((t - t1) / (t3 - t1))
        out.append(b1 * ((t2 - t) / (t2 - t1)) + b2 * ((t - t1) / (t2 - t1)))
    return out


def frames(points, first_normal):
    """Rotation-minimising (tangent, normal, binormal) frames by double reflection."""
    tangents = []
    for i in range(len(points)):
        a = points[max(i - 1, 0)]
        b = points[min(i + 1, len(points) - 1)]
        tangents.append((b - a).normalized())
    t0 = tangents[0]
    r = (Vector(first_normal) - t0 * Vector(first_normal).dot(t0)).normalized()
    out = [(t0, r, t0.cross(r))]
    for i in range(len(points) - 1):
        v1 = points[i + 1] - points[i]
        c1 = v1.dot(v1)
        if c1 < 1e-18:
            out.append(out[-1])
            continue
        r_l = r - v1 * (2 / c1 * v1.dot(r))
        t_l = tangents[i] - v1 * (2 / c1 * v1.dot(tangents[i]))
        v2 = tangents[i + 1] - t_l
        c2 = v2.dot(v2)
        r = r_l if c2 < 1e-18 else r_l - v2 * (2 / c2 * v2.dot(r_l))
        r.normalize()
        out.append((tangents[i + 1], r, tangents[i + 1].cross(r)))
    return out


def tube(name, control_points, radius, *, ring=12, aspect=1.0, samples=40, first_normal=(0, 0, 1),
         caps=True, resample=True, section=None, material=None, face_material=None, seat=(None, None),
         clear=(None, None, 0), smooth=True, uv=True, coll=None):
    """Closed tube (caps on) along the path; `radius` is metres or f(u) -> metres, u in 0..1.

    aspect: section width over height. 1 is round; under 1 is a strap, flatter across
        the binormal. Side k = 0 points along the frame normal, which starts as
        `first_normal` and, on a planar path, stays on the same side of the curve.
    resample: False takes control_points as the finished path (a spiral sampled by
        angle, say), so dense regions stay dense.
    section: optional f(u, a) -> (along_normal, along_binormal) in metres for the
        section point at angle a (radians, 0 on the normal side); it replaces
        radius and aspect. A strap that lies on a curved wall needs one: a lens or
        D shape whose flat side sits just under the surface, so its edges are sunk
        while its crown stands proud (an ellipse centred above the wall leaves its
        edges floating; one centred on the wall dives through it).
    material / face_material: one material, or a list of slots and
        face_material(i, k) -> slot for the face between path points i and i + 1 on
        section side k (a gold cuff over the first spans, a gold lining on the inner
        sides). Caps take the slot of their neighbouring span's side 0.
    seat: (start, end) callables mapping a vertex position to where it should sit,
        applied to the first and last ring, e.g. `seat_on_lathe(outline, sink)` so a
        handle end lies inside a curved wall instead of a flat cap standing off it.
    clear: (start, end, rings) callables applied to the `rings` rings after the start
        ring and before the end ring, e.g. `clear_of_lathe(outline, gap)`. Where a
        wall flares across an end (a neck widening into its rim), the next rings
        would otherwise sit inside the wall, behind the seated ring, and the first
        span folds back through itself.
    uv: True for UVs as fractions (u along, v around), or a tile size in metres:
        u = path length / tile, v = distance around the section / tile.
    """
    pts = path(control_points, samples) if resample else [Vector(p) for p in control_points]
    fr = frames(pts, first_normal)
    rad = radius if callable(radius) else (lambda u: radius)
    slot = face_material or (lambda i, k: 0)
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new('UVMap')
    rings = []
    for i, (p, (_, n, b)) in enumerate(zip(pts, fr)):
        u = i / (len(pts) - 1)
        if section is not None:
            offsets = [section(u, 2 * math.pi * k / ring) for k in range(ring)]
        else:
            r = rad(u)
            offsets = [(math.cos(2 * math.pi * k / ring) * r, math.sin(2 * math.pi * k / ring) * r * aspect)
                       for k in range(ring)]
        coords = [p + n * dn + b * db for dn, db in offsets]
        last = len(pts) - 1
        fit = seat[0] if i == 0 else seat[1] if i == last else None
        if fit is None and 0 < i <= clear[2]:
            fit = clear[0]
        elif fit is None and last - clear[2] <= i < last:
            fit = clear[1]
        if fit is not None:
            coords = [fit(c) for c in coords]
        rings.append([bm.verts.new(c) for c in coords])
    along = [0.0]
    for a, b in zip(pts, pts[1:]):
        along.append(along[-1] + (b - a).length)
    around = []  # cumulative distance around each ring, closing back to its first vertex
    for verts in rings:
        acc = [0.0]
        for k in range(ring):
            acc.append(acc[-1] + (verts[(k + 1) % ring].co - verts[k].co).length)
        around.append(acc)
    for i in range(len(rings) - 1):
        for k in range(ring):
            k2 = (k + 1) % ring
            face = bm.faces.new((rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]))
            face.material_index = slot(i, k)
            if uv is True:
                u0, u1 = i / (len(rings) - 1), (i + 1) / (len(rings) - 1)
                v0, v1 = k / ring, (k + 1) / ring
            else:
                u0, u1 = along[i] / uv, along[i + 1] / uv
                v0 = (around[i][k] + around[i + 1][k]) / 2 / uv
                v1 = (around[i][k + 1] + around[i + 1][k + 1]) / 2 / uv
            for loop, coord in zip(face.loops, ((u0, v0), (u0, v1), (u1, v1), (u1, v0))):
                loop[uv_layer].uv = coord
    if caps:
        for ringverts, span in ((rings[0], 0), (rings[-1], len(rings) - 2)):
            centre = sum((v.co for v in ringverts), Vector()) / ring
            hub = bm.verts.new(centre)
            for k in range(ring):
                face = bm.faces.new((ringverts[k], ringverts[(k + 1) % ring], hub))
                face.material_index = slot(span, 0)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = scene.from_bmesh(name, bm, coll=coll, smooth=smooth, material=material)
    bm.free()
    return obj


def seat_on_lathe(outline, sink):
    """Seat callable for `tube`: move a vertex radially to `sink` metres inside a wall.

    outline is the outer wall (r, z) of a body of revolution about +Z, walked bottom
    to top. Each vertex keeps its angle and height, so an end ring becomes a curve
    lying in the wall and the joint has no gap however the wall bends. Keep sink
    under the wall thickness, or the end shows inside the vessel.
    """
    from . import profile as prof

    def fit(co):
        r = prof.radius_at(outline, co.z)
        rho = math.hypot(co.x, co.y)
        if r is None or rho < 1e-9:
            return co
        k = (r - sink) / rho
        return Vector((co.x * k, co.y * k, co.z))

    return fit


def clear_of_lathe(outline, gap):
    """Clear callable for `tube`: push a vertex that lies inside a wall out to `gap` above it."""
    from . import profile as prof

    def fit(co):
        r = prof.radius_at(outline, co.z)
        rho = math.hypot(co.x, co.y)
        if r is None or rho < 1e-9 or rho >= r + gap:
            return co
        k = (r + gap) / rho
        return Vector((co.x * k, co.y * k, co.z))

    return fit


def flare(u, base, ends, width=0.12):
    """Radius profile for a handle: `base` in the middle, swelling to `ends` at both joins."""
    w = math.exp(-((u / width) ** 2)) + math.exp(-(((1 - u) / width) ** 2))
    return base + (ends - base) * min(w, 1.0)
