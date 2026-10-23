"""Amber Cadence Urn, built procedurally to replace the Meshy donor in adventure-v6.

blender -b --factory-startup --python-exit-code 1 --python build.py -- \
    --out OUT.glb [--blend OUT.blend] [--intact-only] [--seed 5]

Dimensions come from reference/concept-profile.json (the concept's side
silhouette at its 4 degree camera, in true metres at the contract's 0.72 m) and
the runtime contract of the shipped GLB (node names, 16 shards, the 16-sided
collider); BRIEF.md holds both. The silhouette gate checks the outline again.

Parts, each a closed shell:
  foot           cream marble disc with rounded edges
  lower band     gold fillets round a dark laurel frieze, a gold bead at the front
  cup            cream marble round the lobes' feet, its top edge rising to a cusp
                 in every crease, so the lobes sit in it
  body           amber glass in eight cushion lobes, hollow, an even 10 mm wall
                 down to a thick floor; the creases run from the cup to the
                 shoulder band, and the glass is set in under the band
  shoulder band  gold fillets round a laurel frieze lying on the shoulder, its
                 fillets on the concept's outline, a torus along its lower edge
  cabochon       an olive jade stone in a gold setting standing up off the band,
                 a small gold bead either side
  neck           cream marble, concave, flaring to a rolled lip; amber inside
"""

import argparse
import json
import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(REPO, '.claude', 'skills', 'blender-modeler', 'scripts'))
sys.path.insert(0, HERE)
from bkit import export, fracture, lathe, materials, profile, scene, textures, validate  # noqa: E402
from colours import CUP, FRONT, amber_colour, cup_top, lobe_envelope, lobe_phase  # noqa: E402
from colours import smooth as _smooth  # noqa: E402

V = profile.V
ROOT = 'breakable_l2_low_amber_urn'
ASSET_ID = 'amber-cadence-urn'
TILE = 0.06
TOP = 0.720
SHARDS = 16
BODY_SEGMENTS = 64  # eight per lobe, so every crease falls on a vertex column
SEGMENTS = 32  # the plain lathes: 1.2 mm of polygon on the foot (28 read polygonal); a column on the front
FILLET_LO, FILLET_HI = 0.0060, 0.0045  # the shoulder band's half rounds, standing proud of its face
WALL = 0.010
LAUREL_TILE = 0.09  # one repeat of the frieze: two leaf pairs, 4.5 cm apart as in the concept

# Outer outlines bottom to top (r, z), read off reference/concept-profile.json.
# The foot: a 3.5 cm round on its bottom edge, widest 4 to 7 cm up, rounding in to the band at 12 cm
# (reference/concept-profile.json, checked against the gate's rows).
# Its bottom 3.5 cm refitted to the gate's rows in round 3 (they were 8-23 mm wide per side: the
# concept's foot rounds in harder underneath), the bottom ring itself kept: it is the silhouette's
# lowest point, and moving it 1.5 mm in raised the mask 1 mm, which the gate's height
# normalisation read as the flaring cup 5 mm wider per side.
FOOT = [(0.0, 0.0), (0.2150, 0.0), (0.2265, 0.0030), (0.2415, 0.0085), (0.2565, 0.0145), (0.2705, 0.0205),
        (0.2785, 0.0270), (0.2875, 0.0350), (0.2890, 0.0460), (0.2930, 0.0600), (0.2925, 0.0720),
        (0.2905, 0.0830), (0.2870, 0.0940), (0.2800, 0.1050), (0.2690, 0.1140), (0.2560, 0.1210), (0.0, 0.1210)]
BODY = [(0.2450, 0.1120), (0.2500, 0.1500), (0.2495, 0.1660), (0.2517, 0.1700), (0.2596, 0.1740),
        (0.2753, 0.1790), (0.2888, 0.1840), (0.3124, 0.1950), (0.3311, 0.2060), (0.3465, 0.2180),
        (0.3599, 0.2290), (0.3758, 0.2450), (0.3908, 0.2640), (0.4035, 0.2820), (0.4133, 0.3010),
        (0.4215, 0.3190), (0.4285, 0.3380), (0.4334, 0.3560), (0.4378, 0.3740), (0.4389, 0.3930),
        (0.4403, 0.4110), (0.4385, 0.4290), (0.4348, 0.4480), (0.4292, 0.4660), (0.4208, 0.4850),
        (0.4094, 0.5030), (0.3925, 0.5210), (0.3663, 0.5400), (0.3322, 0.5580), (0.2864, 0.5770),
        (0.2382, 0.5950), (0.2050, 0.6070)]
NECK = [(0.2050, 0.5980), (0.1960, 0.6080), (0.1885, 0.6130), (0.1808, 0.6320), (0.1831, 0.6500),
        (0.1946, 0.6690), (0.2198, 0.6870), (0.2298, 0.7050)]
LIP_INNER = 0.2070  # the opening's half width, read off the rim ellipse
BORE = 0.1650  # the neck's bore, which is also the body's opening
LOWER_BAND = (0.1190, 0.1740, 0.2575, 0.2525)  # z0, z1, fillet r, frieze r: fillets 5 mm proud
SHOULDER_BAND = (0.5480, 0.6060)  # z0, z1 along the shoulder, up to the neck's foot
CUP_RINGS = (0.178, 0.192, 0.204, 0.214, 0.224)  # where the creases grow, inside the cup
LOBE_RINGS = (0.240, 0.265, 0.295, 0.335, 0.375, 0.415, 0.455, 0.490, 0.516, 0.532, 0.548)  # to SHOULDER_BAND[0]
LOBE_DEPTH = 0.13  # of the radius at a crease: the concept's creases read 12% of it or more
TUCK = 0.005  # the glass under the cup's edge set in, so the cup holds the lobes' bottoms with a rim 5 mm proud
FLOOR_Z = 0.240  # the cavity's floor: solid amber below, so the tuck never thins a wall (the concept's thick base)
BAND_INSET = 0.0025  # the shoulder band's face inside the outline, so its fillets stand on it
GLASS_INSET = 0.0085  # the glass under the shoulder band, inside the outline: the band's 6 mm of gold on it


def palette(laurel_maps, shoulder_maps):
    # Warm cream marble with bold tan veins: the room's light cools and greys marble, and round
    # 1's #ede4d3 read saturation 0.07 to 0.10 in the game against the concept's 0.31 to 0.44.
    # Soft tan veins 3-6 mm wide: round 2's hairlines read as crackle glaze and vanished in the game.
    # Lighter and warmer in round 5: #e9c189 read hue 41 and L* 64 on the foot against 32 and 77.
    marble_veins = textures.marbled('marble_veins', '#fbd6ab', '#96693c', dark='#d9a46a', size=256, veins=2,
                                    turbulence=2.0, softness=0.35, seed=9)
    return {
        'marble': textures.attach_color(
            materials.principled('marble_cream', '#fbd6ab', roughness=0.30, coat=0.35, coat_roughness=0.10),
            marble_veins, scale=1 / 4),
        # Amber glass, set in the game from 25 probes (`glb_patch.py`). Transmission 0.9 reads as glass
        # (0.35-0.5 read as milky pottery to two critics), but sharp it showed the gallery's black
        # wainscot through the lower lobes as a brown band, and the cup's far edge with it. At
        # roughness 0.4 under a clear coat of 0.5 the room behind blurs away and the highlights stay
        # sharp; a yellower base and volume colour (#ffcc4d, #fbe08a over 6 cm, optics.json) bring
        # the hue to the concept's: lower lobe L*a*b* 41/14/33, hue 30, against 48/23/48, hue 30
        # (round 4: 28/8/17, hue 26). COLOR_0 only leans the valleys toward the thicker glass's
        # colour (colours.py, rule 11). The game ignores emission on it.
        'amber': materials.vertex_tint(
            materials.principled('amber_glass', '#ffcc4d', roughness=0.40, transmission=0.90, ior=1.52,
                                 coat=0.5, coat_roughness=0.03)),
        # Warmer than the amphora's: this concept's gold midtone is hue 33, saturation 0.59. Full metal
        # here: the warm gallery's probe has no dark ground to mirror (the amphora's museum HDR did).
        'gold': materials.gold('gold_polished', '#e6b46a', roughness=0.22, metallic=1.0),
        'laurel': textures.attach_inlay(materials.principled('laurel_frieze', '#ffffff', roughness=0.5),
                                        laurel_maps, strength=1.0),
        # The shoulder's frieze is a 13 cm slope, not a 4 cm band: its own map, leaves to suit.
        'laurel_high': textures.attach_inlay(materials.principled('laurel_shoulder', '#ffffff', roughness=0.5),
                                             shoulder_maps, strength=1.0),
        # Olive, as the concept's stone (hue 89; round 1's read teal, hue 136): aimed yellower than
        # the target, because the room pulls greens toward cyan.
        'jade': materials.principled('jade_stone', '#48551e', roughness=0.12, transmission=0.10, ior=1.61,
                                     coat=0.6, coat_roughness=0.05),
        'amber_cut': materials.principled('amber_cut', '#ffcc4d', roughness=0.40, transmission=0.90, ior=1.52),
    }


def lobe_depth(theta, z):
    """Metres a point moves toward the axis: nothing on a lobe's crown, deepest in a crease."""
    u = lobe_phase(theta)
    r = profile.radius_at(BODY_LINE, z) or 0.0
    return r * LOBE_DEPTH * u ** 2.2 * lobe_envelope(u, z)


def tuck_depth(theta, z):
    """The outer wall only: TUCK inside the cup, easing out over 2 cm above its edge, so the
    lobes round into the cup and its rim stands proud of them. The glass there is the solid
    floor or a wall the cup covers. It starts above the bottom corner, hidden in the lower band.
    Round 4's 10 mm along the normal came to 17-25 mm across on the shelf above the cup: the
    silhouette 8 mm narrow at 0.20-0.21 m."""
    return TUCK * _smooth((z - 0.140) / 0.020) * (1.0 - _smooth((z - cup_top(lobe_phase(theta))) / 0.020))


BODY_LINE = profile.spline([V(r, z) for r, z in BODY], samples=8)


def foot(m):
    pts = profile.resample(profile.spline([V(r, z) for r, z in FOOT[1:-1]], samples=6), 10, curvature_bias=0.6)
    return lathe.lathe('foot', [V(*FOOT[0])] + pts + [V(*FOOT[-1])], SEGMENTS, material=m['marble'],
                       sharp_degrees=60, uv=TILE)


def band_ring(name, m, z0, z1, fillet_r, frieze_r, inner_r):
    """A solid ring: rounded gold fillets top and bottom, the laurel frieze recessed between."""
    gold, laurel = 0, 1
    f = 0.0090  # fillet height
    pts, slots = profile.chain(
        (gold, [V(inner_r, z0), V(fillet_r - 0.002, z0), V(fillet_r, z0 + f / 2), V(fillet_r - 0.002, z0 + f),
                V(frieze_r, z0 + f)]),
        (laurel, [V(frieze_r, z0 + f), V(frieze_r, z1 - f)]),
        (gold, [V(frieze_r, z1 - f), V(fillet_r - 0.002, z1 - f), V(fillet_r, z1 - f / 2), V(fillet_r - 0.002, z1),
                V(inner_r, z1)]),
    )
    obj = lathe.lathe(name, pts, SEGMENTS, closed=True, material=[m['gold'], m['laurel']], span_materials=slots,
                      sharp_degrees=50, uv=TILE)
    return obj, laurel


def outward(line, z):
    """The outline's outward unit normal at height z."""
    t = profile.tangent_at(line, z)
    n = V(t.y, -t.x)
    return n if n.x >= 0 else -n


def glass_line():
    """The glass's outer outline: the concept's, set GLASS_INSET in under the shoulder band. The
    band stands on it with its fillets on the outline; proud of a 21 degree shoulder, 4.5 mm of
    band and fillet read 12 to 22 mm wide in the silhouette."""
    z0 = SHOULDER_BAND[0]
    pts = [V(r, z) for r, z in BODY if z <= z0 - 0.008]
    pts += [V(r, z) - outward(BODY_LINE, z) * GLASS_INSET for r, z in BODY if z >= z0]
    return profile.spline(pts, samples=8)


def body(m):
    """Amber glass: outer wall, a shoulder that turns in to the bore, inner wall 10 mm in, floor.

    Rings go where they show: two inside the lower band, five through the cup where the creases
    grow to full depth, eleven up the lobes, three under the shoulder band."""
    glass = glass_line()
    high = SHOULDER_BAND[0]
    top_z = glass[-1].y
    outer = ([V(profile.radius_at(glass, z), z) for z in (BODY[0][1], CUP[0] - 0.006) + CUP_RINGS + LOBE_RINGS]
             + profile.resample(profile.between(glass, high, top_z), 3, curvature_bias=0.3)[1:])
    top = V(BORE, top_z)
    inner_line = profile.offset(glass, WALL)
    inner = [p for p in reversed(inner_line) if FLOOR_Z < p.y < top_z - WALL and p.x > BORE]
    inner = profile.resample(inner, 5, curvature_bias=0.4)  # seen only down the neck and in shards
    inner = [V(BORE, top_z - WALL)] + inner + [V(inner[-1].x * 0.6, FLOOR_Z + 0.002), V(0.0, FLOOR_Z)]
    pts = [V(0.0, BODY[0][1])] + outer + [top] + inner

    # Lobes and tuck move the glass straight in, both walls by the same amount at a height, so the
    # wall stays even and the cup, offset across too, stays seated on it. A crease leaves the cup at
    # full depth and rises along its own valley, concave all the way (radius 0.30, 0.33, 0.36, 0.38
    # m at 0.22, 0.25, 0.30, 0.41 m). Round 4 pushed along each ring's normal: on the shelf above
    # the cup that lifts a deep crease 4 cm up the body, and faded out above the cup so its valley
    # would not turn back in, the creases read as soft bumps at 128 px.
    corner = len(pts) - 3  # the inner wall's foot, on the floor
    n_outer = len(outer)

    def modulate(theta, z, i):
        if i > corner:
            return 0.0  # the floor stays flat
        tuck = tuck_depth(theta, z) if 1 <= i <= n_outer else 0.0  # the inner wall is never tucked
        return (-(lobe_depth(theta, z) + tuck), 0.0)

    # Creases shade smooth, as the concept's rounded valleys do: at eight columns a lobe a 10 mm
    # round cannot be modelled, and a sharp edge there read as a V.
    return lathe.lathe('body', pts, BODY_SEGMENTS, modulate=modulate, material=m['amber'], sharp_degrees=85,
                       uv=TILE)


def cup(m):
    """Cream marble round the lobes' feet, holding them as the concept's does: its outside on the
    outline, its top edge low under each lobe's crown and rising to a cusp in each crease
    (cup_top), its inside 5 mm into the glass wherever the glass goes, so in a crease it fills the
    V up to the cusp. Lathed at the body's 64 columns, each column's rim lifted whole to its own
    edge and the skirt below stretched to meet it."""
    z0, base, _ = CUP
    rim = base - 0.006  # the rim's lowest point

    def glass_r(theta, z):  # the glass under the cup, as body() pushes it: straight in
        return profile.radius_at(BODY_LINE, z) - lobe_depth(theta, z) - tuck_depth(theta, z)

    # (height on a crown, metres out from the outline, or from the glass when `inside`). Its
    # outside 0.5 mm proud of the outline, a rim rounded over 8 mm to an inner edge in the glass,
    # its inside 5 mm in, which covers the chords of the body's rings where a crease grows. Offset
    # across from the outline while the glass moved along its normal (rounds 3 and 4), the cup
    # stood off the glass and the fracture split it from the body. The faces inside the glass are
    # amber: cream there showed through the lobes as a scalloped line.
    section = [(z0, 0.0005, False), (rim, 0.0005, False), (base - 0.0025, 0.0, False),
               (base + 0.0005, -0.0025, False), (base + 0.0025, -0.0055, False),
               (base + 0.0015, -0.0040, True), (rim, -0.0050, True), (z0, -0.0050, True)]
    pts = [V(profile.radius_at(BODY_LINE, z) + off, z) for z, off, _ in section]

    def place(theta, _z, i):
        top = cup_top(lobe_phase(theta))
        z, off, inside = section[i]
        z = z + top - base if z >= rim - 1e-9 else z0 + (z - z0) * (rim + top - base - z0) / (rim - z0)
        r = (glass_r(theta, z) if inside else profile.radius_at(BODY_LINE, z)) + off
        return (r - pts[i].x, z - pts[i].y)

    marble, amber = 0, 1
    slots = [marble] * 5 + [amber] * 3  # outside and rim; then into the glass, the inner face, the bottom
    return lathe.lathe('cup', pts, BODY_SEGMENTS, closed=True, modulate=place, material=[m['marble'], m['amber']],
                       span_materials=slots, sharp_degrees=60, uv=TILE)


def shoulder_band(m):
    """The upper band lies on the shoulder's slope with its fillets on the concept's outline and
    its face BAND_INSET inside it, a 6 mm half round along the lower edge over the lobes' tops,
    a 4.5 mm one along the top (4 and 2.5 mm read as a flat band); its back is sunk 6 mm into
    the glass, following the slope's curve (two back rings made a chord that cut into the
    cavity)."""
    z0, z1 = SHOULDER_BAND
    face = profile.resample(profile.between(BODY_LINE, z0, z1), 4, curvature_bias=0.3)
    normals = [-profile.normal_in(face, i) for i in range(len(face))]
    out = [p - n * BAND_INSET for p, n in zip(face, normals)]
    mid = len(face) // 2
    back = [face[0] - normals[0] * 0.0060, face[mid] - normals[mid] * (GLASS_INSET + 0.0050),
            face[-1] - normals[-1] * (GLASS_INSET + 0.0050)]

    def fillet(p, n, along, roll):  # a half round standing proud of the face at p
        return [p + n * (roll * math.sin(math.pi * k / 4)) + along * (roll * (1 - math.cos(math.pi * k / 4)))
                for k in range(1, 4)]

    up = (out[-1] - out[0]).normalized()
    lo, hi = FILLET_LO, FILLET_HI
    gold, laurel = 0, 1
    front = ([out[0]] + fillet(out[0], normals[0], up, lo) + [out[0] + up * 2 * lo] + out[2:-2]
             + [out[-1] - up * 2 * hi] + fillet(out[-1] - up * 2 * hi, normals[-1], up, hi) + [out[-1]])
    k0, k1 = 4, len(front) - 5  # the frieze runs between the fillets
    pts = list(reversed(back)) + front
    slots = [gold] * len(back) + [laurel if k0 <= i < k1 else gold for i in range(len(front) - 1)] + [gold]
    obj = lathe.lathe('shoulder_band', pts, SEGMENTS, closed=True, material=[m['gold'], m['laurel_high']],
                      span_materials=slots, sharp_degrees=50, uv=TILE)
    return obj, laurel, front[k0:k1 + 1]


def neck(m, seat):
    """Cream marble: concave, flaring to a rolled lip; amber inside the mouth, as the concept
    shows it, its bore running down into the body. Its foot is sunk 4 mm into the glass's top."""
    marble, amber = 0, 1
    line = [V(r, z) for r, z in NECK]
    line[0] = V(line[0].x, seat - 0.004)
    # At most 12 degrees a ring (round 3: ten rings by count turned 19-30 through the waist); the
    # sunk foot a plain corner under the band's top torus, where six rings would have turned it
    outer = [line[0]] + profile.resample_by_turn(profile.spline(line[1:], samples=24), 12.0)
    inner_top = V(LIP_INNER, outer[-1].y)
    lift = (TOP - outer[-1].y) / ((outer[-1] - inner_top).length / 2)  # the lip's crown lands on TOP
    lip = profile.rolled_lip(outer[-1], inner_top, steps=7, lift=lift)
    inner = [V(LIP_INNER - 0.004, 0.7000), V(0.1900, 0.6800), V(0.1720, 0.6500), V(BORE, 0.6200),
             V(BORE, line[0].y)]
    pts, slots = profile.chain((marble, outer + lip + [inner_top]), (amber, inner))
    slots = slots + [marble]  # the closing span across the foot
    return lathe.lathe('neck', pts, SEGMENTS, closed=True, material=[m['marble'], m['amber']],
                       span_materials=slots, sharp_degrees=60, uv=TILE)


def front_point(r, z, out=0.0, theta=FRONT):
    return Vector(((r + out) * math.cos(theta), (r + out) * math.sin(theta), z))


def bead(m, name, r, z, radius, *, theta=FRONT, sink=0.45, segments=12, rings=6):
    """A gold bead on a band at angle theta, `sink` of its radius set into it."""
    pts = [V(radius * math.sin(math.pi * k / rings), -radius * math.cos(math.pi * k / rings)) for k in range(rings + 1)]
    obj = lathe.lathe(name, [V(0.0, p.y) if i in (0, rings) else p for i, p in enumerate(pts)], segments,
                      material=m['gold'], uv=TILE)
    obj.rotation_euler = (math.pi / 2, 0, theta + math.pi / 2)  # its axis along the outward radius
    obj.location = front_point(r, z, radius * (1 - sink), theta)
    scene.apply_transform(obj)
    return obj


def cabochon(m, mid, n_band):
    """An oval olive jade stone in a gold setting at the front of the shoulder band.

    The concept draws the stone upright (8 x 9 px at 128 px); laid on the 21 degree shoulder it
    read 8 x 3. It leans 35 degrees back from vertical, stood off the band so the lower edge of
    its bezel meets the band's face, and the setting's back wall runs down to the band, cut to
    its slope and sunk 4 mm (a wedge, deepest under the stone's top edge)."""
    w, h, dome = 0.032, 0.040, 0.018  # half width, half height, crown height
    lean = math.radians(35)
    axis = V(math.cos(lean), math.sin(lean))  # (r, z): out and up
    up = V(-math.sin(lean), math.cos(lean))
    centre = mid + n_band * (0.0015 + (h + 0.006) * up.dot(n_band))
    arc = [V(w * math.cos(math.pi / 2 * k / 6), dome * math.sin(math.pi / 2 * k / 6)) for k in range(7)]
    gem = lathe.lathe('cabochon', [V(0.0, -0.004), V(w, -0.004)] + arc[:-1] + [V(0.0, dome)], 16,
                      material=m['jade'], uv=TILE)
    bezel = lathe.lathe('bezel', [V(w - 0.004, -0.080), V(w + 0.006, -0.080), V(w + 0.006, 0.002),
                                  V(w + 0.003, 0.0055), V(w - 0.001, 0.0045), V(w - 0.004, -0.004)], 16,
                        closed=True, material=m['gold'], uv=TILE)
    tilt = math.atan2(axis.x, axis.y)  # from +Z toward the outward radius (-Y at the front)
    for obj in (gem, bezel):
        obj.scale = (1.0, h / w, 1.0)
        obj.rotation_euler = (tilt, 0.0, 0.0)
        obj.location = front_point(centre.x, centre.y)
        scene.apply_transform(obj)
    # Cut the setting's back to the band: slide each back corner along the stone's axis to 4 mm
    # under the band's face (a plane at the front; the cone falls away 3 mm at the bezel's sides).
    a3 = Vector((0.0, -axis.x, axis.y))
    n3 = Vector((0.0, -n_band.x, n_band.y))
    m3 = front_point(mid.x, mid.y)
    for v in bezel.data.vertices:
        if (v.co - m3).dot(n3) < -0.010:  # the back ring, well behind the band's face
            t = ((v.co - m3).dot(n3) + 0.004) / a3.dot(n3)
            v.co = v.co - a3 * t
    bezel.data.update()
    return gem, bezel


def laurel_uvs(obj, slot, along_tile, *, z0=None, z1=None, across=None):
    """UVs for a frieze: u counts tiles along the band from the front, mirrored, so the leaves
    run out both ways from the front; v rises 0..1 across the frieze, by height (z0, z1) on an
    upright band or by distance along `across`, the frieze's outline, on a sloping one."""
    me = obj.data
    layer = me.uv_layers.active.data
    if across is not None:
        runs = [0.0]
        for a, b in zip(across, across[1:]):
            runs.append(runs[-1] + (b - a).length)

        def v_of(r, z):
            p, best = V(r, z), (1e9, 0.0)
            for i, (a, b) in enumerate(zip(across, across[1:])):
                ab = b - a
                t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-12)))
                d = (p - (a + ab * t)).length
                if d < best[0]:
                    best = (d, (runs[i] + t * ab.length) / runs[-1])
            return best[1]
    else:
        def v_of(r, z):
            return (z - z0) / (z1 - z0)
    for poly in me.polygons:
        if poly.material_index != slot:
            continue
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            angle = math.atan2(co.y, co.x) - FRONT
            angle = abs((angle + math.pi) % (2 * math.pi) - math.pi)  # 0 at the front, pi at the back
            r = math.hypot(co.x, co.y)
            layer[li].uv = (angle * r / along_tile, v_of(r, co.z))


def collider():
    """The shipped proxy, exactly: 16-gon at phase 0, r 0.372619, 0 to 0.504 m, flat, no material."""
    import bmesh

    bm = bmesh.new()
    r, h = 0.372619, 0.504
    rings = [[bm.verts.new((r * math.cos(math.pi * k / 8), r * math.sin(math.pi * k / 8), z)) for k in range(16)]
             for z in (-h / 2, h / 2)]
    for k in range(16):
        bm.faces.new((rings[0][k], rings[0][(k + 1) % 16], rings[1][(k + 1) % 16], rings[1][k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[1])
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = scene.from_bmesh(f'COLLIDER_{ROOT}', bm, smooth=False)
    bm.free()
    obj.location.z = h / 2
    obj['collision_proxy'] = True
    obj['collision_shape'] = '16-sided-cylinder'
    return obj


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('--blend')
    ap.add_argument('--intact-only', action='store_true')
    ap.add_argument('--seed', type=int, default=5)
    args = ap.parse_args(argv)

    scene.reset()
    z0, z1, fillet_r, frieze_r = LOWER_BAND
    frieze_h = (z1 - z0) - 2 * 0.009
    # One row of 32 mm leaves running out from the bead along the stem, as the concept draws it;
    # two rows of small ones at 36 degrees read as a thin dark strip at 128 px.
    # Both friezes' leaves at metallic 0.6, roughness 0.4, set in the game from probes: at 1.0 and
    # 0.25 (rounds 3 and 4 asked for it) the shoulder band, facing the ceiling, mirrors it dark,
    # median luminance 86-96 against the concept's 154 (0.6 and 0.4: 120-128). The leaves warmer
    # (hue 34, a* up from 4.7 toward the concept's 10) and the recesses near black, as drawn.
    maps = textures.laurel('laurel', LAUREL_TILE, frieze_h, pairs=3, cols=384, rows=96, leaf=(0.040, 0.014),
                           angle=20, relief=0.0022, stem=0.0016, ground='#231709', leaf_colour='#e8a855',
                           ground_trm=(0.0, 0.85, 0.20), leaf_trm=(0.0, 0.40, 0.60))
    slope = profile.length(profile.between(BODY_LINE, *SHOULDER_BAND)) - 2 * (FILLET_LO + FILLET_HI)
    # Drawn for the camera: the 21 degree slope shows a frieze at under half its height from the
    # front, so leaves 71 mm long at 48 degrees read as the concept's 53 mm at 27, and fill 86%
    # of the band (round 1's filled the middle half and the band read dark).
    shoulder_maps = textures.laurel('laurel_shoulder', 0.11, slope, pairs=2, cols=384, rows=256,
                                    leaf=(0.071, 0.036), angle=48, relief=0.0028, stem=0.0022, ground='#3c2610',
                                    leaf_colour='#fcb758', ground_trm=(0.0, 0.85, 0.20),
                                    leaf_trm=(0.0, 0.40, 0.60))
    m = palette(maps, shoulder_maps)
    lower, lower_slot = band_ring('lower_band', m, z0, z1, fillet_r, frieze_r, 0.2300)
    laurel_uvs(lower, lower_slot, LAUREL_TILE, z0=z0 + 0.009, z1=z1 - 0.009)
    upper, upper_slot, frieze = shoulder_band(m)
    laurel_uvs(upper, upper_slot, 0.11, across=frieze)
    u0, u1 = frieze[0], frieze[-1]
    mid = (u0 + u1) / 2
    face_dir = (u1 - u0).normalized()
    normal = V(face_dir.y, -face_dir.x)  # outward off the shoulder
    gem, bezel = cabochon(m, mid, normal)
    # The concept's small gold beads either side of the stone, sat on the frieze's centre line.
    flank = 0.032 + 0.022
    beads = [bead(m, f'bead_{side}', mid.x, mid.y, 0.009, theta=FRONT + sign * flank / mid.x, sink=0.4,
                  segments=10, rings=6) for side, sign in (('l', -1), ('r', 1))]
    seat = glass_line()[-1].y
    parts = ([foot(m), lower, cup(m), body(m), upper, neck(m, seat), bead(m, 'bead', frieze_r, (z0 + z1) / 2, 0.019),
              gem, bezel] + beads)

    facts = {'parts': {}}
    for part in parts:
        rep = validate.report(part, within_shell=True)
        problems = validate.failures(rep)
        facts['parts'][part.name] = {k: rep[k] for k in ('tris', 'components', 'volume_m3', 'self_intersections')}
        if problems:
            raise SystemExit(f'part {part.name} fails its gates: {problems}')
    # No part may reach into the hollow: separate shells pass every other gate while doing it.
    shell = next(p for p in parts if p.name == 'body')
    hollow = validate.cavity_intrusions(shell, [p for p in parts if p is not shell], z_min=FLOOR_Z + 0.003,
                                        z_max=seat - 0.011)
    facts['cavity_intrusions'] = {name: count for name, (count, _) in hollow.items()}
    inside = {name: f'{count} vertices, {deep * 1000:.1f} mm' for name, (count, deep) in hollow.items() if count}
    if inside:
        raise SystemExit(f'parts inside the cavity: {inside}')

    root = scene.empty(ROOT)
    root['asset_id'] = ASSET_ID
    root['units'] = 'metres'
    shards = []
    if not args.intact_only:
        cut = {'foot': m['marble'], 'neck': m['marble'], 'cup': m['marble'], 'body': m['amber_cut'],
               'lower_band': m['gold'], 'shoulder_band': m['gold'], 'bead': m['gold'], 'bead_l': m['gold'],
               'bead_r': m['gold'], 'bezel': m['gold'], 'cabochon': m['jade']}
        shards = fracture.fracture(parts, SHARDS, cut_materials=cut, seed=args.seed, seed_on=parts,
                                   prefix=f'{ROOT}_shard_')
        for shard in shards:
            problems = validate.failures(validate.report(shard, within_shell=True, weld=1e-6))
            if problems:
                raise SystemExit(f'shard {shard.name} fails its gates: {problems}')
            materials.paint_corners(shard, amber_colour, only=('amber_glass',))
            shard['role'] = 'shard'
            shard.parent = root
    copies = []
    for part in parts:
        dup = part.copy()
        dup.data = part.data.copy()
        scene.link(dup)
        copies.append(dup)
    intact = scene.join(copies, f'{ROOT}_intact')
    materials.paint_corners(intact, amber_colour, only=('amber_glass',))
    intact['role'] = 'intact'
    intact['asset_id'] = ASSET_ID
    intact.parent = root
    for part in parts:
        bpy.data.objects.remove(part)
    proxy = collider()
    proxy.parent = root

    rep = validate.report(intact, within_shell=True)
    facts['intact'] = {k: rep[k] for k in ('tris', 'size_m', 'min_m', 'max_m', 'materials', 'self_intersections')}
    if args.blend:
        os.makedirs(os.path.dirname(os.path.abspath(args.blend)), exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args.blend))
    export.glb(args.out, [root, intact, proxy] + shards, tangents=True)  # the laurel is normal-mapped
    facts['glb'] = export.summary(args.out)
    print('BUILD', json.dumps(facts, default=str))


if __name__ == '__main__':  # importable for measurement scripts
    main()
