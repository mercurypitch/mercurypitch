"""Applied trims that hug a lathed body: beads, flat bands, rings.

Pass the body's OUTER wall outline (bottom to top), not the closed profile: the
trim reads the radius and slope there. Every trim is a closed shell sunk
slightly into the wall, so it never floats and never shows a gap, and its
exposed edges are rounded (craft rule 1).
"""

import math

from mathutils import Vector

from . import lathe as lathe_mod
from . import profile as prof


def _frame(outer, z):
    r = prof.radius_at(outer, z)
    if r is None:
        raise ValueError(f'outline never reaches z={z:.4f}')
    t = prof.tangent_at(outer, z)
    n_out = Vector((t.y, -t.x))
    if n_out.x < 0:
        n_out = -n_out
    return Vector((r, z)), t, n_out


def bead(name, outer, z, height, proud, *, sink=None, steps=8, segments=48, material=None, coll=None):
    """Half-round bead centred at height z: `height` tall, standing `proud` off the wall."""
    base, t, n = _frame(outer, z)
    sink = height * 0.3 if sink is None else sink
    pts = []
    for k in range(steps + 1):
        a = -math.pi / 2 + math.pi * k / steps
        pts.append(base + t * (math.sin(a) * height / 2) + n * (math.cos(a) * proud))
    pts += [base + t * (height / 2) - n * sink, base - t * (height / 2) - n * sink]
    return lathe_mod.lathe(name, pts, segments, closed=True, material=material, coll=coll)


def band(name, outer, z0, z1, proud, *, corner=None, sink=None, samples=10, segments=48, material=None, coll=None):
    """Flat band following the wall from z0 to z1, standing `proud` off it, rounded edges.

    The face follows the body's curvature (sampled `samples` times), so a band on a
    swelling belly bulges with it instead of reading as a straight cylinder.
    """
    corner = min(proud * 0.9, (z1 - z0) * 0.3) if corner is None else corner
    sink = proud * 1.5 if sink is None else sink
    face = []
    for k in range(samples + 1):
        z = z0 + (z1 - z0) * k / samples
        base, _, n = _frame(outer, z)
        face.append((base, n))
    pts = []
    # bottom edge rounded from the wall out to the face
    b0, t0, n0 = _frame(outer, z0)
    for k in range(4):
        a = math.pi / 2 * k / 3
        pts.append(b0 + n0 * (proud - corner + corner * math.sin(a)) + t0 * (corner - corner * math.cos(a)))
    for base, n in face[1:-1]:
        pts.append(base + n * proud)
    b1, t1, n1 = _frame(outer, z1)
    for k in range(4):
        a = math.pi / 2 * k / 3
        pts.append(b1 + n1 * (proud - corner + corner * math.cos(a)) - t1 * (corner - corner * math.sin(a)))
    pts += [b1 - n1 * sink, b0 - n0 * sink]
    return lathe_mod.lathe(name, pts, segments, closed=True, material=material, coll=coll)


def ring(name, radius, z, minor, *, aspect=1.0, steps=12, segments=48, material=None, coll=None):
    """Free-standing torus ring (a collar on a stem, a base ring)."""
    pts = [Vector((radius + minor * math.cos(2 * math.pi * k / steps),
                   z + minor * aspect * math.sin(2 * math.pi * k / steps))) for k in range(steps)]
    return lathe_mod.lathe(name, pts, segments, closed=True, material=material, coll=coll)
