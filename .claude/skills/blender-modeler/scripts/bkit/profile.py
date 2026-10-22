"""2D profiles (r, z) in metres for lathed and swept forms.

A profile is a list of mathutils.Vector((r, z)). Build it from a few measured
control points with `spline`, never type the final polyline by hand: an 8-point
polyline is exactly what made the v1 vessels look faceted.
"""

import math

from mathutils import Vector


def V(r, z):
    return Vector((float(r), float(z)))


def spline(points, samples=8, alpha=0.5, corners=()):
    """Centripetal Catmull-Rom through control points; indices in `corners` stay sharp.

    Centripetal (alpha 0.5) never overshoots into loops or cusps the way the uniform
    form does near unevenly spaced points. A corner splits the curve, so a foot ring
    or a deliberate shoulder keeps its edge while everything else flows.
    """
    pts = [V(*p) for p in points]
    cuts = sorted({0, len(pts) - 1, *corners})
    out = []
    for a, b in zip(cuts, cuts[1:]):
        run = pts[a:b + 1]
        if len(run) == 2:
            out += [run[0].lerp(run[1], k / samples) for k in range(samples)]
            continue
        ext = [run[0] * 2 - run[1]] + run + [run[-1] * 2 - run[-2]]
        for i in range(1, len(ext) - 2):
            out += _centripetal(ext[i - 1], ext[i], ext[i + 1], ext[i + 2], samples)
    out.append(pts[-1].copy())
    return out


def _centripetal(p0, p1, p2, p3, n):
    def knot(t, a, b):
        return t + max((b - a).length, 1e-9) ** 0.5

    t0 = 0.0
    t1 = knot(t0, p0, p1)
    t2 = knot(t1, p1, p2)
    t3 = knot(t2, p2, p3)
    result = []
    for k in range(n):
        t = t1 + (t2 - t1) * k / n
        a1 = p0 * ((t1 - t) / (t1 - t0)) + p1 * ((t - t0) / (t1 - t0))
        a2 = p1 * ((t2 - t) / (t2 - t1)) + p2 * ((t - t1) / (t2 - t1))
        a3 = p2 * ((t3 - t) / (t3 - t2)) + p3 * ((t - t2) / (t3 - t2))
        b1 = a1 * ((t2 - t) / (t2 - t0)) + a2 * ((t - t0) / (t2 - t0))
        b2 = a2 * ((t3 - t) / (t3 - t1)) + a3 * ((t - t1) / (t3 - t1))
        result.append(b1 * ((t2 - t) / (t2 - t1)) + b2 * ((t - t1) / (t2 - t1)))
    return result


def length(poly):
    return sum((b - a).length for a, b in zip(poly, poly[1:]))


def resample(poly, count, curvature_bias=0.4, keep=()):
    """Resample to `count` points, spending more of them where the outline bends.

    The weight per segment mixes arc length and turning angle; `curvature_bias`
    0 gives even spacing, 0.4 puts roughly 40% of the points where the curve
    turns. Indices in `keep` (for example spline corners) are preserved exactly.
    """
    if len(poly) < 3 or count < 3:
        return [p.copy() for p in poly]
    keep = sorted({0, len(poly) - 1, *keep})
    weights = _segment_weights(poly, curvature_bias)
    total = sum(weights)
    out = []
    for a, b in zip(keep, keep[1:]):
        span = sum(weights[a:b])
        n = max(2, round(count * span / total))
        out += _resample_run(poly[a:b + 1], weights[a:b], n)[:-1]
    out.append(poly[-1].copy())
    return out


def _segment_weights(poly, bias):
    lengths = [(b - a).length for a, b in zip(poly, poly[1:])]
    turns = [0.0] * len(lengths)
    for i in range(1, len(poly) - 1):
        d1 = poly[i] - poly[i - 1]
        d2 = poly[i + 1] - poly[i]
        if d1.length > 1e-12 and d2.length > 1e-12:
            turn = d1.angle(d2, 0.0)
            turns[i - 1] += turn / 2
            turns[i] += turn / 2
    total_length = sum(lengths) or 1.0
    total_turn = sum(turns) or 1.0
    return [(1 - bias) * l / total_length + bias * t / total_turn for l, t in zip(lengths, turns)]


def _resample_run(run, weights, n):
    cumulative = [0.0]
    for w in weights:
        cumulative.append(cumulative[-1] + w)
    total = cumulative[-1] or 1.0
    out, j = [], 0
    for i in range(n):
        target = total * i / (n - 1)
        while j < len(weights) - 1 and cumulative[j + 1] < target:
            j += 1
        seg = cumulative[j + 1] - cumulative[j]
        f = 0.0 if seg <= 0 else (target - cumulative[j]) / seg
        out.append(run[j].lerp(run[j + 1], min(max(f, 0.0), 1.0)))
    return out


def normal_in(poly, i):
    """Unit normal pointing toward the axis side of an outline walked bottom to top."""
    a = poly[max(i - 1, 0)]
    b = poly[min(i + 1, len(poly) - 1)]
    t = (b - a).normalized()
    n = V(-t.y, t.x)
    return n if n.x <= 0 else -n


def offset(poly, thickness):
    """Offset inward along each point's normal; `thickness` is metres or f(z) -> metres.

    Offsetting along the normal keeps the wall even on sloped shoulders. Offsetting
    horizontally (r - t) thins every slope and was one of the v1 vessel faults.
    """
    fn = thickness if callable(thickness) else (lambda z: thickness)
    return [p + normal_in(poly, i) * fn(p.y) for i, p in enumerate(poly)]


def rolled_lip(outer_top, inner_top, steps=8, lift=1.0):
    """Half-round rim from the outer wall's last point to the inner wall's first.

    Returns only the intermediate points. `lift` > 1 makes the roll taller than half
    the wall, which reads as a thicker, hand-finished rim.
    """
    mid = (outer_top + inner_top) / 2
    radius = (outer_top - inner_top).length / 2
    across = (outer_top - inner_top).normalized()
    up = V(-across.y, across.x)
    if up.y < 0:
        up = -up
    return [mid + across * (math.cos(math.pi * k / steps) * radius) + up * (math.sin(math.pi * k / steps) * radius * lift)
            for k in range(1, steps)]


def blend(tail, head, reach=0.35, samples=8):
    """Bridge from the end of `tail` to the start of `head`, tangent to both (a fillet).

    Returns only the intermediate points. Use it wherever two outline pieces meet
    (inner wall into floor, neck into lip): joining them with a straight step
    leaves a creased ring of sharp edges, a "perfectly cut edge" in glass.
    """
    a, b = tail[-1], head[0]
    ta = (tail[-1] - tail[-2]).normalized()
    tb = (head[1] - head[0]).normalized()
    d = (b - a).length * reach
    c0, c1, c2, c3 = a, a + ta * d, b - tb * d, b
    out = []
    for k in range(1, samples):
        t = k / samples
        s = 1 - t
        out.append(c0 * (s * s * s) + c1 * (3 * s * s * t) + c2 * (3 * s * t * t) + c3 * (t * t * t))
    return out


def radius_at(poly, z):
    """Largest radius where the outline crosses height z (None if it never does)."""
    best = None
    for a, b in zip(poly, poly[1:]):
        lo, hi = sorted((a.y, b.y))
        if lo <= z <= hi and hi > lo:
            r = a.x + (b.x - a.x) * (z - a.y) / (b.y - a.y)
            best = r if best is None else max(best, r)
    return best


def tangent_at(poly, z):
    """Unit tangent (walking upward) of the outline segment that crosses height z."""
    for a, b in zip(poly, poly[1:]):
        lo, hi = sorted((a.y, b.y))
        if lo <= z <= hi and hi > lo:
            t = (b - a).normalized()
            return t if t.y >= 0 else -t
    return V(0, 1)


def bounds(poly):
    rs = [p.x for p in poly]
    zs = [p.y for p in poly]
    return min(rs), max(rs), min(zs), max(zs)


def width_bands(poly, bands=10):
    """Diameter at the centre of each of `bands` equal height bands, bottom to top."""
    _, _, z0, z1 = bounds(poly)
    out = []
    for k in range(bands):
        z = z0 + (z1 - z0) * (k + 0.5) / bands
        r = radius_at(poly, z)
        out.append(0.0 if r is None else 2 * r)
    return out


def scale(poly, sr=1.0, sz=1.0):
    return [V(p.x * sr, p.y * sz) for p in poly]


def translate(poly, dr=0.0, dz=0.0):
    return [V(p.x + dr, p.y + dz) for p in poly]
