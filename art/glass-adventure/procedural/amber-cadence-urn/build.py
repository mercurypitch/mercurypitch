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
from bkit import export, fracture, lathe, materials, profile, scene, textures, validate  # noqa: E402

V = profile.V
ROOT = 'breakable_l2_low_amber_urn'
ASSET_ID = 'amber-cadence-urn'
TILE = 0.06
TOP = 0.720
SHARDS = 16
LOBES = 8
BODY_SEGMENTS = 64  # eight per lobe, so every crease falls on a vertex column
SEGMENTS = 32  # the plain lathes: 1.4 mm of polygon on the foot, within budget
FRONT = -math.pi / 2  # the cabochon and the bead face -Y
WALL = 0.010
LAUREL_TILE = 0.09  # one repeat of the frieze: two leaf pairs, 4.5 cm apart as in the concept

# Outer outlines bottom to top (r, z), read off reference/concept-profile.json.
# The foot: a 3.5 cm round on its bottom edge, widest 4 to 7 cm up, rounding in to the band at 12 cm
# (reference/concept-profile.json, checked against the gate's rows).
FOOT = [(0.0, 0.0), (0.2150, 0.0), (0.2360, 0.0030), (0.2510, 0.0085), (0.2625, 0.0145), (0.2735, 0.0205),
        (0.2830, 0.0270), (0.2895, 0.0350), (0.2925, 0.0460), (0.2930, 0.0600), (0.2925, 0.0720),
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
LOWER_BAND = (0.1190, 0.1740, 0.2575, 0.2535)  # z0, z1, fillet r, frieze r
SHOULDER_BAND = (0.5480, 0.6060)  # z0, z1 along the shoulder, up to the neck's foot
LOBE_DEPTH = 0.13  # of the radius at a crease: the concept's creases read 12% of it or more
LOBE_TOP = 0.552  # the creases run up under the shoulder band's lower fillet
CUP = (0.168, 0.190, 0.220)  # the marble cup: sunk in the lower band; its top edge under a lobe, at a crease
TUCK = 0.006  # the glass under and just above the cup's edge, set in so the cup's rim stands proud of the lobes
BAND_INSET = 0.0025  # the shoulder band's face inside the outline, so its fillets stand on it
GLASS_INSET = 0.0085  # the glass under the shoulder band, inside the outline: the band's 6 mm of gold on it


def palette(laurel_maps, shoulder_maps):
    # Warm cream marble with bold tan veins: the room's light cools and greys marble, and round
    # 1's #ede4d3 read saturation 0.07 to 0.10 in the game against the concept's 0.31 to 0.44.
    marble_veins = textures.marbled('marble_veins', '#e9c99a', '#a8743f', dark='#d6b07c', size=256, veins=3,
                                    turbulence=2.4, softness=0.12, seed=9)
    return {
        'marble': textures.attach_color(
            materials.principled('marble_cream', '#e9c99a', roughness=0.30, coat=0.35, coat_roughness=0.10),
            marble_veins, scale=1 / 4),
        # Amber set in the game's renderer. Mostly diffuse: at transmission 0.85 to 0.95 it reads as
        # glass but shows the gallery wall's black skirting through the lobes (median luminance 73
        # to 86 against the concept's 110). Its contrast is painted instead: COLOR_0 (amber_colour)
        # lightest on each lobe's crown, darker to its sides, darkest in the crease; a clear coat
        # for the highlights.
        'amber': materials.vertex_tint(
            materials.principled('amber_glass', '#f8b448', roughness=0.04, transmission=0.35, ior=1.52,
                                 coat=1.0, coat_roughness=0.03)),
        # Warmer than the amphora's: this concept's gold midtone is hue 33, saturation 0.59.
        'gold': materials.gold('gold_polished', '#e6b46a', roughness=0.22, metallic=0.75),
        'laurel': textures.attach_inlay(materials.principled('laurel_frieze', '#ffffff', roughness=0.5),
                                        laurel_maps, strength=1.0),
        # The shoulder's frieze is a 13 cm slope, not a 4 cm band: its own map, leaves to suit.
        'laurel_high': textures.attach_inlay(materials.principled('laurel_shoulder', '#ffffff', roughness=0.5),
                                             shoulder_maps, strength=1.0),
        # Olive, as the concept's stone (hue 89; round 1's read teal, hue 136): aimed yellower than
        # the target, because the room pulls greens toward cyan.
        'jade': materials.principled('jade_stone', '#48551e', roughness=0.12, transmission=0.10, ior=1.61,
                                     coat=0.6, coat_roughness=0.05),
        'amber_cut': materials.principled('amber_cut', '#e8a64a', roughness=0.22, transmission=0.70, ior=1.52),
    }


def _smooth(t):
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
    """The share of the full crease depth at phase u and height z: none inside the cup, growing
    out of its edge over 3 cm, held up the body, eased out over 1.2 cm under the shoulder band."""
    return _smooth((z - cup_top(u)) / 0.030) * _smooth((LOBE_TOP - z) / 0.012)


def lobe_depth(theta, z):
    """Metres a point moves toward the axis: nothing on a lobe's crown, deepest in a crease."""
    u = lobe_phase(theta)
    r = profile.radius_at(BODY_LINE, z) or 0.0
    return r * LOBE_DEPTH * u ** 2.2 * lobe_envelope(u, z)


def tuck_depth(theta, z):
    """The outer wall only: TUCK inside the cup, easing out over 3 cm above its edge, so the
    lobes round into the cup and its rim stands proud of them. The glass there is the solid
    floor or a wall the cup covers; moving the inner wall and floor too crossed them. It starts
    above the bottom corner (hidden in the lower band), whose diagonal push folded the floor."""
    return TUCK * _smooth((z - 0.140) / 0.020) * (1.0 - _smooth((z - cup_top(lobe_phase(theta))) / 0.030))


BODY_LINE = profile.spline([V(r, z) for r, z in BODY], samples=8)


def amber_colour(p):
    """sRGB multiplier for the amber, the concept's light through each lobe: brightest on the
    crown, deeper toward its sides and darkest, redder, in the crease (luminance p5 48, p95 200
    at game size against round 1's 63 and 129)."""
    u = lobe_phase(math.atan2(p.y, p.x))
    e = lobe_envelope(u, p.z)
    side = (0.82, 0.68, 0.55)
    deep = (0.36, 0.22, 0.14)
    t_side = u ** 1.5 * e
    t_deep = u ** 6 * e
    return tuple((1.0 + (s_ - 1.0) * t_side) * (1.0 + (d / s_ - 1.0) * t_deep) for s_, d in zip(side, deep))


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

    Rings go where they show: three inside the lower band, four through the cup (fewer let the
    concave foot's chords out through the cup's 1.5 mm), seventeen up the lobes, three under the
    shoulder band."""
    glass = glass_line()
    cup_lo, cup_hi, high = CUP[0] - 0.006, CUP[2] + 0.006, SHOULDER_BAND[0]
    top_z = glass[-1].y
    outer = (profile.resample(profile.between(glass, BODY[0][1], cup_lo), 3, curvature_bias=0.3)
             + profile.resample(profile.between(glass, cup_lo, cup_hi), 4, curvature_bias=0.0)[1:]
             + profile.resample(profile.between(glass, cup_hi, high), 17, curvature_bias=0.5)[1:]
             + profile.resample(profile.between(glass, high, top_z), 3, curvature_bias=0.3)[1:])
    top = V(BORE, top_z)
    inner_line = profile.offset(glass, WALL)
    inner = [p for p in reversed(inner_line) if 0.205 < p.y < top_z - WALL and p.x > BORE]
    inner = profile.resample(inner, 7, curvature_bias=0.4)  # seen only down the neck and in shards
    floor_z = 0.2050
    inner = [V(BORE, top_z - WALL)] + inner + [V(inner[-1].x * 0.6, floor_z + 0.002), V(0.0, floor_z)]
    pts = [V(0.0, BODY[0][1])] + outer + [top] + inner

    n_outer = len(outer)

    def modulate(theta, z, i):  # both walls move toward the axis together, so the wall stays even
        return -lobe_depth(theta, z) - (tuck_depth(theta, z) if 1 <= i <= n_outer else 0.0)

    # Creases shade smooth, as the concept's rounded valleys do: at eight columns a lobe a 10 mm
    # round cannot be modelled, and a sharp edge there read as a V.
    return lathe.lathe('body', pts, BODY_SEGMENTS, modulate=modulate, material=m['amber'], sharp_degrees=85,
                       uv=TILE)


def cup(m):
    """Cream marble round the lobes' feet: a thin shell on the unlobed glass whose top edge is
    low under each lobe's crown and rises to a cusp in each crease (cup_top), where the lobes
    start (lobe_envelope). Lathed at the body's 64 columns, then each column stretched up to
    its own edge, the radius following the outline."""
    z0, base, _ = CUP
    on = lambda z, off: V(profile.radius_at(BODY_LINE, z) + off, z)  # noqa: E731
    pts = [on(z0, 0.0015), on((z0 + base) / 2, 0.0015), on(base, 0.0015), on(base + 0.0025, -0.0025),
           on(base, -0.0090), on(z0, -0.0090)]  # its inside within the glass wall, below the tuck
    obj = lathe.lathe('cup', pts, BODY_SEGMENTS, closed=True, material=m['marble'], sharp_degrees=60, uv=TILE)
    for v in obj.data.vertices:
        theta = math.atan2(v.co.y, v.co.x)
        r = math.hypot(v.co.x, v.co.y)
        offset = r - profile.radius_at(BODY_LINE, v.co.z)
        top = cup_top(lobe_phase(theta))
        z = top + (v.co.z - base) if v.co.z > base + 1e-6 else z0 + (v.co.z - z0) * (top - z0) / (base - z0)
        r = profile.radius_at(BODY_LINE, z) + offset
        v.co = Vector((r * math.cos(theta), r * math.sin(theta), z))
    obj.data.update()
    return obj


def shoulder_band(m):
    """The upper band lies on the shoulder's slope with its fillets on the concept's outline and
    its face BAND_INSET inside it, a 4 mm torus along the lower edge over the lobes' tops, a
    3 mm one along the top; its back is sunk 6 mm into the glass, following the slope's curve
    (two back rings made a chord that cut into the cavity)."""
    z0, z1 = SHOULDER_BAND
    face = profile.resample(profile.between(BODY_LINE, z0, z1), 5, curvature_bias=0.3)
    normals = [-profile.normal_in(face, i) for i in range(len(face))]
    out = [p - n * BAND_INSET for p, n in zip(face, normals)]
    mid = len(face) // 2
    back = [face[0] - normals[0] * 0.0060, face[mid] - normals[mid] * (GLASS_INSET + 0.0050),
            face[-1] - normals[-1] * (GLASS_INSET + 0.0050)]

    def fillet(p, n, along, roll):  # a half round standing proud of the face at p
        return [p + n * (roll * math.sin(math.pi * k / 4)) + along * (roll * (1 - math.cos(math.pi * k / 4)))
                for k in range(1, 4)]

    up = (out[-1] - out[0]).normalized()
    lo, hi = 0.0040, 0.0025
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
    outer = profile.resample(profile.spline(line, samples=6), 7, curvature_bias=0.5)
    inner_top = V(LIP_INNER, outer[-1].y)
    lift = (TOP - outer[-1].y) / ((outer[-1] - inner_top).length / 2)  # the lip's crown lands on TOP
    lip = profile.rolled_lip(outer[-1], inner_top, steps=4, lift=lift)
    inner = [V(LIP_INNER - 0.004, 0.7000), V(0.1900, 0.6800), V(0.1720, 0.6500), V(BORE, 0.6200),
             V(BORE, line[0].y)]
    pts, slots = profile.chain((marble, outer + lip + [inner_top]), (amber, inner))
    slots = slots + [marble]  # the closing span across the foot
    return lathe.lathe('neck', pts, SEGMENTS, closed=True, material=[m['marble'], m['amber']],
                       span_materials=slots, sharp_degrees=60, uv=TILE)


def front_point(r, z, out=0.0, theta=FRONT):
    return Vector(((r + out) * math.cos(theta), (r + out) * math.sin(theta), z))


def bead(m, name, r, z, radius, *, theta=FRONT, sink=0.45, segments=14, rings=10):
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
    gem = lathe.lathe('cabochon', [V(0.0, -0.004), V(w, -0.004)] + arc[:-1] + [V(0.0, dome)], 24,
                      material=m['jade'], uv=TILE)
    bezel = lathe.lathe('bezel', [V(w - 0.004, -0.080), V(w + 0.006, -0.080), V(w + 0.006, 0.002),
                                  V(w + 0.003, 0.0055), V(w - 0.001, 0.0045), V(w - 0.004, -0.004)], 24,
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
    # Leaves dense enough that gold covers most of the frieze, as in the concept (85% gold).
    maps = textures.laurel('laurel', LAUREL_TILE, frieze_h, pairs=3, cols=384, rows=96, leaf=(0.040, 0.018),
                           angle=36, relief=0.0022, stem=0.0016, ground='#33200d', leaf_colour='#e0ad62')
    slope = profile.length(profile.between(BODY_LINE, *SHOULDER_BAND)) - 0.013  # less the fillets
    # Drawn for the camera: the 21 degree slope shows a frieze at under half its height from the
    # front, so leaves 71 mm long at 48 degrees read as the concept's 53 mm at 27, and fill 86%
    # of the band (round 1's filled the middle half and the band read dark).
    shoulder_maps = textures.laurel('laurel_shoulder', 0.11, slope, pairs=2, cols=384, rows=256,
                                    leaf=(0.071, 0.032), angle=48, relief=0.0028, stem=0.0022, ground='#4a3519',
                                    leaf_colour='#e8b86a')
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
