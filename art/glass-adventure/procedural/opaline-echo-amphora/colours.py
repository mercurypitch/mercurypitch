"""The amphora's vertex colours, without Blender: the opal's patches and the jade foot's tint.

`build.py` paints COLOR_0 from `corner_colour` (and the wave band's ground from
`opal_colour`); `glb_recolour.py` repaints a built file from them to try a palette in
the game without a rebuild, e.g. `--set OPAL_PUSH=1.8`. Points are Blender Z-up world
metres; anything with .x .y .z will do.
"""

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', '.claude', 'skills',
                                'blender-modeler', 'scripts'))
from bkit import colour  # noqa: E402

OPAL_PATCHES = (  # sRGB colour, share bias. The concept's opal is milky with mint, yellow-green,
    # lavender, cream and a little cyan round a pearl average (Lab a* -6, b* +1; chroma spread 11).
    # The game pulls every green toward cyan, so the greens sit greener than their target: this
    # set measured 47% mint, 18% cyan-blue, 11% yellow-green in the game, the concept 48, 16, 18.
    ((0.90, 0.93, 0.89), 0.20),   # milky, near neutral
    ((0.72, 0.93, 0.76), 0.27),   # mint-green, hue 131
    ((0.71, 0.88, 0.95), -0.45),  # aqua, hue 195
    ((0.84, 0.77, 0.95), 0.32),   # lavender, hue 265
    ((0.97, 0.91, 0.78), 0.18),   # cream, hue 40
    ((0.95, 0.83, 0.91), -0.05),  # rose, hue 325
    ((0.85, 0.95, 0.75), 0.05),   # yellow-green mint, hue 90
)
OPAL_CENTRE = (0.89, 0.91, 0.86)  # the pearl the patches play round, warm: the game's cyan rim cools it
OPAL_PUSH = 1.5  # set in the game, belly against the concept at the same pixel size: Lab spread 12.4
# against 11.7, a* -9.1 against -7.0, b* +3.1 against +2.2. Pushed 3x it read 20.8, -15.1, +5.9: the
# room's probe light saturates pale tints, so three_preview's museum HDR under-reads them.
OPAL_LIFT = 0.0  # L* added to every patch (a probe knob: the round 7 critic read the body darker than its wall)
OPAL_LIGHTNESS = 7.0  # L* play on top, in its own drifting field: the game read L* spread 3 against the concept's 7


def corner_colour(p, material):
    """COLOR_0 for every tinted face: the opal's patches on the glass, a darker, yellower jade on
    the foot. The foot faces the hemisphere light's teal ground: grey 0.75 read L 40, hue 148 in
    the game, (0.92, 0.95, 0.74) L 53, hue 116; the concept's foot is L 47, hue 130."""
    if material == 'jade_stone':
        return (0.85, 0.86, 0.74) if p.z < 0.16 else (1.0, 1.0, 1.0)
    return opal_colour(p)


def opal_colour(p):
    """The concept's opal fire as distinct soft patches (sRGB): a soft-max over drifting
    fields, so each corner leans to one patch colour instead of all averaging to a flat
    tint, about a dozen patches round the body; then pushed OPAL_PUSH times further in
    chroma from the pearl centre, lightness kept (`colour.push_chroma`), and given OPAL_LIGHTNESS
    of L* play in a field of its own (`colour.shift_lightness`)."""
    theta = math.atan2(p.y, p.x) + 2.1

    def drift(seed):
        return sum(math.sin(f * theta + g * p.z + seed * (1.7 + 0.9 * k)) / (1 + 0.35 * k)
                   for k, (f, g) in enumerate(((2, 5.0), (3, -8.0), (5, 11.0), (7, -4.0))))

    weights = [math.exp(6.0 * (drift(1.3 * i + 0.4) / 2.6 + bias)) for i, (_, bias) in enumerate(OPAL_PATCHES)]
    total = sum(weights)
    rgb = [sum(w * c[j] for w, (c, _) in zip(weights, OPAL_PATCHES)) / total for j in range(3)]
    rgb = colour.push_chroma(rgb, OPAL_CENTRE, OPAL_PUSH)
    return colour.shift_lightness(rgb, OPAL_LIFT + OPAL_LIGHTNESS * drift(9.1) / 2.2)
