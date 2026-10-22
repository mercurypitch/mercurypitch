"""Tubes and straps swept along a 3D Catmull-Rom path with rotation-minimising frames.

Handles, rails, scrolls and ribs. Frames come from the double-reflection method
(Wang et al. 2008), so the section never twists the way a fixed up-vector frame
does where the path turns toward that vector.
"""

import math

import bmesh
from mathutils import Vector

from . import scene


def path(points, samples=40):
    """Centripetal Catmull-Rom through 3D control points, resampled to even spacing."""
    pts = [Vector(p) for p in points]
    ext = [pts[0] * 2 - pts[1]] + pts + [pts[-1] * 2 - pts[-2]]
    dense = []
    for i in range(1, len(ext) - 2):
        dense += _centripetal(ext[i - 1], ext[i], ext[i + 1], ext[i + 2], 24)
    dense.append(pts[-1].copy())
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
         caps=True, material=None, coll=None):
    """Closed tube (caps on) along the path; `radius` is metres or f(u) -> metres, u in 0..1.

    aspect: section width over height. 1 is round; under 1 is a strap, flatter across
    the binormal. The binormal side faces `first_normal` x tangent at the start.
    """
    pts = path(control_points, samples)
    fr = frames(pts, first_normal)
    rad = radius if callable(radius) else (lambda u: radius)
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new('UVMap')
    rings = []
    for i, (p, (_, n, b)) in enumerate(zip(pts, fr)):
        u = i / (len(pts) - 1)
        r = rad(u)
        rings.append([bm.verts.new(p + n * (math.cos(2 * math.pi * k / ring) * r)
                                   + b * (math.sin(2 * math.pi * k / ring) * r * aspect))
                      for k in range(ring)])
    for i in range(len(rings) - 1):
        for k in range(ring):
            k2 = (k + 1) % ring
            face = bm.faces.new((rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]))
            u0, u1 = i / (len(rings) - 1), (i + 1) / (len(rings) - 1)
            v0, v1 = k / ring, (k + 1) / ring
            for loop, coord in zip(face.loops, ((u0, v0), (u0, v1), (u1, v1), (u1, v0))):
                loop[uv_layer].uv = coord
    if caps:
        for ringverts in (rings[0], rings[-1]):
            centre = sum((v.co for v in ringverts), Vector()) / ring
            hub = bm.verts.new(centre)
            for k in range(ring):
                bm.faces.new((ringverts[k], ringverts[(k + 1) % ring], hub))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = scene.from_bmesh(name, bm, coll=coll, material=material)
    bm.free()
    return obj


def flare(u, base, ends, width=0.12):
    """Radius profile for a handle: `base` in the middle, swelling to `ends` at both joins."""
    w = math.exp(-((u / width) ** 2)) + math.exp(-(((1 - u) / width) ** 2))
    return base + (ends - base) * min(w, 1.0)
