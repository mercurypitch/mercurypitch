"""The urn's lobe layout and the amber's vertex colour, without Blender.

`build.py` shapes the body and paints COLOR_0 from these; `glb_recolour.py` repaints a
built file from them to try a palette in the game without a rebuild (`--set SIDE=...`).
Points are Blender Z-up world metres; anything with .x .y .z will do.
"""

import math

LOBES = 8
FRONT = -math.pi / 2  # the cabochon and the bead face -Y; a lobe is centred there
LOBE_TOP = 0.552  # the creases run up under the shoulder band's lower fillet
CUP = (0.168, 0.190, 0.220)  # the marble cup: sunk in the lower band; its top edge under a lobe, at a crease
LOBE_RAMP = 0.025  # a crease grows to full depth inside the cup, over this much under its edge

# The amber leaning toward its thicker glass's colour where the lobes fold (sRGB multipliers of
# the base): SIDE toward a lobe's edges, DEEP in the valley. Mild on purpose (craft rule 11):
# round 2 painted the valleys down to 5% and read as glazed pottery; the geometry and the
# translucency shade the rest.
SIDE = (0.95, 0.88, 0.80)
DEEP = (0.82, 0.66, 0.50)


def smooth(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def lobe_phase(theta):
    """0 on a lobe's crown, 1 at a crease; the front lobe centred on FRONT."""
    period = 2 * math.pi / LOBES
    phi = ((theta - FRONT + period / 2) % period) - period / 2
    return abs(phi / (period / 2))


def cup_top(u):
    """Height of the cup's top edge: low under a lobe's crown, rising to a cusp in each crease."""
    _, base, cusp = CUP
    return base + (cusp - base) * u * u


def lobe_envelope(u, z):
    """The share of the full crease depth at phase u and height z: grown inside the cup over
    the LOBE_RAMP under its edge, so a crease leaves the cup at full depth, as the concept's
    lobes stay distinct down to the cup's cusps (grown out of the cup's edge instead, rounds 2-4
    read as soft bumps at 128 px and their ends as closed eyes in zebra); eased out over 2 cm
    under the shoulder band."""
    return smooth((z - cup_top(u) + LOBE_RAMP) / LOBE_RAMP) * smooth((LOBE_TOP - z) / 0.020)


def amber_colour(p):
    """sRGB multiplier for the amber at point p: 1 on a lobe's crown, SIDE toward its edges,
    DEEP in the crease, all fading out where the lobes do."""
    u = lobe_phase(math.atan2(p.y, p.x))
    e = lobe_envelope(u, p.z)
    t_side = u ** 1.5 * e
    t_deep = u ** 6 * e
    return tuple((1.0 + (s - 1.0) * t_side) * (1.0 + (d / s - 1.0) * t_deep) for s, d in zip(SIDE, DEEP))
