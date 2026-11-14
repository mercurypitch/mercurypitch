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


def resample_by_turn(poly, degrees=12.0, max_length=None):
    """The fewest of poly's own points that keep every ring's turn within `degrees`.

    Each span ends before any piece of the outline it covers points more than half of
    `degrees` away from its chord, so two chords meeting at a ring differ by at most
    `degrees` (plus the turn between two of poly's samples: pass it densely sampled, a
    spline at 20 or more samples a span). A span also ends before its chord passes
    `max_length` metres. The urn's neck resampled by count spent its rings evenly and
    turned 22-31 degrees a ring through its waist.
    """
    half = math.radians(degrees) / 2
    out, a = [poly[0].copy()], 0
    for b in range(2, len(poly)):
        chord = poly[b] - poly[a]
        ok = chord.length > 1e-12 and (max_length is None or chord.length <= max_length)
        ok = ok and all((poly[k + 1] - poly[k]).angle(chord, 0.0) <= half
                        for k in range(a, b) if (poly[k + 1] - poly[k]).length > 1e-12)
        if not ok:
            out.append(poly[b - 1].copy())
            a = b - 1
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


END = 1e-6  # metres: points are float32, so a height read off an end point can sit just past it


def radius_at(poly, z):
    """Largest radius where the outline crosses height z (None if it never does)."""
    best = None
    for a, b in zip(poly, poly[1:]):
        lo, hi = sorted((a.y, b.y))
        if lo - END <= z <= hi + END and hi > lo:
            r = a.x + (b.x - a.x) * (z - a.y) / (b.y - a.y)
            best = r if best is None else max(best, r)
    return best


def tangent_at(poly, z):
    """Unit tangent (walking upward) of the outline segment that crosses height z."""
    for a, b in zip(poly, poly[1:]):
        lo, hi = sorted((a.y, b.y))
        if lo - END <= z <= hi + END and hi > lo:
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


def chain(*parts, tolerance=1e-6):
    """Join outline pieces that each carry a material slot into one profile.

    parts: (slot, points) pairs, every piece walked bottom to top. Returns
    (points, span_slots) for `lathe.lathe(..., span_materials=span_slots)`.
    A piece that starts where the previous one ended shares that point. Every
    span inside a piece takes the piece's slot, and so does the span that
    bridges from the previous piece, so a raised band lists its own step faces:
    start it on the wall, step out, run the face, step back, end on the wall.
    """
    pts, slots = [], []
    for slot, piece in parts:
        piece = [V(*p) for p in piece]
        if pts and (piece[0] - pts[-1]).length < tolerance:
            piece = piece[1:]
        slots += [slot] * (len(piece) if pts else len(piece) - 1)
        pts += piece
    return pts, slots


def raised(outline, z0, z1, proud, *, corner=None, corner_steps=1, samples=2):
    """Points of a band standing `proud` off `outline` between heights z0 and z1.

    Starts and ends on the wall (shared with the neighbouring pieces), steps out
    along the wall normal into a rounded corner of radius `corner` (corner_steps
    points per corner; one reads as a soft chamfer at band scale), and follows the
    wall's curvature across its face with `samples` spans. Use it as one piece of
    `chain`, so the band is part of the same closed shell instead of a separate
    floating ring. Every point is a full ring of the lathe, so keep counts low.
    """
    corner = min(proud * 0.8, (z1 - z0) * 0.25) if corner is None else corner

    def frame(z):
        r = radius_at(outline, z)
        if r is None:
            raise ValueError(f'outline never reaches z={z:.4f}')
        t = tangent_at(outline, z)
        n = V(t.y, -t.x)
        return V(r, z), t, (n if n.x >= 0 else -n)

    b0, t0, n0 = frame(z0)
    b1, t1, n1 = frame(z1)
    arc = [math.pi / 2 * k / (corner_steps + 1) for k in range(1, corner_steps + 1)]
    pts = [b0]
    for a in arc:
        pts.append(b0 + n0 * (proud - corner + corner * math.sin(a)) + t0 * (corner - corner * math.cos(a)))
    for k in range(samples + 1):
        z = z0 + corner + (z1 - z0 - 2 * corner) * k / samples
        base, _, n = frame(z)
        pts.append(base + n * proud)
    for a in reversed(arc):
        pts.append(b1 + n1 * (proud - corner + corner * math.sin(a)) - t1 * (corner - corner * math.cos(a)))
    pts.append(b1)
    return pts


def between(outline, z0, z1, eps=1e-6):
    """The part of an outline (walked bottom to top) from height z0 to z1, ends interpolated.

    The end points equal what `radius_at` gives at z0 and z1 on a wall that rises
    monotonically, so the pieces next to a `raised` band share its end points.
    Heights within `eps` of the outline's ends count as on it: vectors are single
    precision, so 0.15 stored is not <= 0.15 typed.
    """
    out = []
    for a, b in zip(outline, outline[1:]):
        if b.y <= a.y:
            continue
        if not out and a.y - eps <= z0 <= b.y:
            out.append(a.lerp(b, max(0.0, (z0 - a.y) / (b.y - a.y))))
        if out and z0 < b.y < z1 - eps:
            out.append(b.copy())
        if out and a.y < z1 <= b.y + eps:
            out.append(a.lerp(b, min(1.0, (z1 - a.y) / (b.y - a.y))))
            break
    return out


def wall(outer, inner, z0=None, z1=None):
    """Wall thickness at each outer outline point between heights z0 and z1: its
    distance to the inner outline. Lists (z, metres); trims standing proud of the
    wall read thicker, so measure the glass between them."""
    def to_poly(p):
        best = 1e9
        for a, b in zip(inner, inner[1:]):
            ab = b - a
            t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-12)))
            best = min(best, (p - (a + ab * t)).length)
        return best
    return [(p.y, to_poly(p)) for p in outer if (z0 is None or p.y >= z0) and (z1 is None or p.y <= z1)]
