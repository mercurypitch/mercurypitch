"""Opaline Echo Amphora, built procedurally to replace the Meshy donor in adventure-v6.

blender -b --factory-startup --python-exit-code 1 --python build.py -- \
    --out OUT.glb [--blend OUT.blend] [--intact-only] [--seed 7]

Every dimension comes from a measurement, not a guess:
reference/concept-measurements.json and BRIEF.md hold the concept's silhouette,
read at its 8 degree camera and corrected to true metres, and the runtime
contract of the shipped GLB (node names, 0.92 m height, 18 shards, the
16-sided collider). The silhouette gate checks the result against the concept
again, so a number that is wrong here fails there.

Parts, each a closed shell (craft rule: nothing floats, nothing is open):
  base ring   gold, hammered band the vessel stands on
  foot        jade, convex skirt rising out of the base ring
  stem ring   gold, a ring and bead the body sits in
  body        one lathed shell: opal glass with the two gold bands, the gold
              collar and the gold rim raised out of the same profile, a rolled
              lip, and an inner wall at an even thickness down to a filleted floor
  handles     jade straps with a gold inner lining and a gold leaf tail, their
              roots seated in the neck, each in a proud gold sleeve that runs on
              as a gold strap down the neck to the collar
  waves       six gold strokes curling into spirals over a rolling relief: an
              inlay material on the band between the two gold bands, not geometry
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
from bkit import export, fracture, lathe, materials, profile, scene, sweep, textures, validate  # noqa: E402
from colours import corner_colour, opal_colour  # noqa: E402

V = profile.V
ROOT = 'breakable_l2_opaline_echo_amphora'
ASSET_ID = 'opaline-echo-amphora'
SEGMENTS = 30  # five per wave period; the two saved rings' worth pays for the heel and shoulder
FOOT_SEGMENTS = 28  # the rings below the body: 1 mm of polygon at their size, 208 triangles saved
TILE = 0.06  # UVs in tiles of 6 cm, so the hammered gold has one dent size on every part
TOP = 0.920
SHARDS = 18

# Outer wall of the glass, bottom to top (r, z) in metres. The first point sits
# inside the stem ring; the last meets the collar.
BODY = [(0.0880, 0.1580), (0.0950, 0.1640), (0.1010, 0.1670), (0.1180, 0.1750), (0.1427, 0.2000),
        (0.1768, 0.2300), (0.2024, 0.2600), (0.2276, 0.3000), (0.2479, 0.3400), (0.2628, 0.3800),
        (0.2730, 0.4200), (0.2800, 0.4500), (0.2827, 0.4800), (0.2806, 0.5225), (0.2725, 0.5645),
        (0.2567, 0.6065), (0.2280, 0.6440), (0.1950, 0.6680), (0.1620, 0.6830), (0.1450, 0.6905)]
COLLAR = [(0.1450, 0.6905), (0.1482, 0.6950), (0.1490, 0.7080), (0.1478, 0.7210), (0.1440, 0.7250),
          (0.1330, 0.7260)]
NECK = [(0.1330, 0.7260), (0.1302, 0.7320), (0.1252, 0.7420), (0.1198, 0.7560), (0.1145, 0.7760), (0.1160, 0.8000),
        (0.1220, 0.8250), (0.1340, 0.8550), (0.1490, 0.8850), (0.1590, 0.9000), (0.1625, 0.9150),
        (0.1640, 0.9250)]  # runs past the lip so the rim can be measured off it
# The surface under the collar, which the inner wall follows instead of the collar. It
# must pass inside the corner where the collar's foot meets the shoulder, or the
# inner wall comes out through the outer one there.
CORE_SHOULDER = [(0.1440, 0.6875), (0.1390, 0.6980), (0.1340, 0.7110), (0.1305, 0.7260)]

LOWER_BAND = (0.2450, 0.2615, 0.0028)  # z0, z1, proud
WAIST_BAND = (0.4205, 0.4425, 0.0030)
RIM_BAND = (0.8985, 0.0055)  # z0, proud; it runs up into the lip
# The neck is concave, so chords of its inner wall sit outward and thin it by about 1 mm:
# offset 8.8 mm to keep 8.
WALL_NECK, WALL_BODY = 0.0088, 0.0100

WAVES = 6
WAVE_PHASE = math.radians(-79.0)  # a curl just right of the front, as in the concept
WAVE_CENTRE_Z = 0.350
WAVE_LINE = 0.00375  # half width of the gold line: a 7.5 mm ribbon


CRACKLE = dict(keep=0.6, line=0.03, tint=0.04, ground=0.95, warp=0.35, seed=11)  # the opal's crackle, 6 cm cells


def crackled(material):
    maps = textures.crackle('opal_crackle', size=512, cells=5, tile=TILE * 5, **CRACKLE)
    textures.attach_color(material, maps['color'], scale=1 / 5)
    return textures.attach_normal(material, maps['normal'], strength=1.0, scale=1 / 5)


def palette(waves_maps):
    def opal_glass(name, sheen=0.4):
        # Milky, not clear: most light scatters in the glass (transmission 0.35, roughness 0.2),
        # so the body keeps its own colour against any background. Its colour play is in the
        # vertex colours; a clear coat at roughness 0.05 adds the concept's glints without
        # costing it (chroma spread 10.1 with the coat, 10.4 without). The sheen is a warm
        # neutral: a lavender one cooled the body in the game.
        return materials.principled(name, '#ffffff', roughness=0.20, transmission=0.35, ior=1.47,
                                    coat=0.6, coat_roughness=0.05, thin_film_nm=420.0, thin_film_ior=1.55,
                                    sheen=sheen, sheen_tint='#efe6d8', sheen_roughness=0.35)

    return {
        # The colour: large patches in the corners (opal_colour, COLOR_0) times the concept's crackle,
        # sparse pale hairlines that catch the light as grooves, one 30 cm image over five tiles.
        'opal': materials.vertex_tint(crackled(opal_glass('glass_shell'))),
        # The wave register: the same glass, thin film included (optics.json), with the gold line
        # and its relief as an inlay. Less sheen, so the line keeps its colour at grazing angles.
        'waves': textures.attach_inlay(opal_glass('glass_waves', sheen=0.2), waves_maps),
        # The concept's gold is hand-hammered everywhere: shallow dents, no triangles.
        # Metallic 0.75, not 1: pure metal mirrors the museum HDR's dark ground on every surface
        # that faces the floor and goes copper (measured in three_preview against the concept).
        # Hammered on the bands, collar, rim and base ring, as the concept draws them.
        'gold': textures.attach_normal(materials.gold('gold_trim', '#ebcb88', roughness=0.30, metallic=0.75),
                                       textures.hammered_normal('hammered_gold', size=128, cells=5, depth=0.45,
                                                                stretch=1.0),
                                       strength=0.5),
        # Polished where the concept polishes: the sleeves, the handles' linings and tails, the neck
        # straps and the stem ring.
        'gold_polished': materials.gold('gold_polished', '#ebcb88', roughness=0.20, metallic=0.75),
        # Jade at the concept's lit midtone (hue 129, saturation 0.27): fine pale veins, six to an
        # image over two tiles (round 6 read the broad clouds as camouflage), lighter clouds over a
        # quarter of it (the concept has 18-28% of its handle above luminance 170).
        'jade': materials.vertex_tint(textures.attach_color(
            materials.principled('jade_stone', '#3f6a4b', roughness=0.26, transmission=0.08, ior=1.61,
                                 coat=0.3, coat_roughness=0.08),
            textures.marbled('jade_veins', '#52875c', '#86bd90', dark='#305736', light='#b8e3bf', light_share=0.26,
                             size=256, veins=6, turbulence=1.6, softness=0.3), scale=1 / 2)),
        'cut': materials.principled('glass_cut', '#dcefe7', roughness=0.25, transmission=0.45, ior=1.47),
    }


def wall_thickness(z):
    t = min(max((z - 0.66) / 0.06, 0.0), 1.0)
    return WALL_BODY + (WALL_NECK - WALL_BODY) * t


def outlines():
    """Dense outer outlines (body, neck) and the smooth core the inner wall follows."""
    body = profile.spline(BODY, samples=10)
    neck = profile.spline(NECK, samples=10)
    core = profile.spline(BODY[:-1] + CORE_SHOULDER + NECK[1:], samples=10)
    return body, neck, core


def base_ring(m):
    # Its side runs straight from 1.6 to 6.4 cm: a ring between was 0.4 mm off the line.
    pts = [V(0, 0), V(0.1680, 0), V(0.1745, 0.0060), V(0.1758, 0.0160),
           V(0.1752, 0.0640), V(0.1730, 0.0700), V(0.1680, 0.0720), V(0, 0.0720)]
    return lathe.lathe('base_ring', pts, FOOT_SEGMENTS, material=m['gold'], sharp_degrees=50, uv=TILE)


def foot(m):
    skirt = profile.resample(profile.spline([(0.1645, 0.0700), (0.1645, 0.0745), (0.1600, 0.0850), (0.1510, 0.0950),
                                             (0.1380, 0.1050), (0.1200, 0.1130), (0.1050, 0.1195), (0.0990, 0.1240)],
                                            samples=6), 7, curvature_bias=0.5)
    # The underside runs straight to the skirt: a 1 mm ring there (hidden in the base ring) was 56 slivers.
    pts = [V(0, 0.0690)] + skirt + [V(0.0965, 0.1300), V(0, 0.1300)]
    return lathe.lathe('foot', pts, FOOT_SEGMENTS, material=m['jade'], sharp_degrees=50, uv=TILE)


def stem_ring(m):
    pts = [V(0, 0.1240), V(0.0960, 0.1240), V(0.1012, 0.1275), V(0.1015, 0.1440), V(0.0990, 0.1465),
           V(0.1012, 0.1490), V(0.0975, 0.1650), V(0, 0.1665)]
    return lathe.lathe('stem_ring', pts, FOOT_SEGMENTS, material=m['gold_polished'], sharp_degrees=50, uv=TILE)


def body(m, body_line, neck_line, core):
    """One shell: opal wall, raised gold bands, gold collar and rim, rolled lip, inner wall, floor."""
    opal, gold, waves = 0, 1, 2
    z0, z1, proud = LOWER_BAND
    w0, w1, wproud = WAIST_BAND
    rim0, rproud = RIM_BAND
    inner = profile.offset(core, wall_thickness)
    # The lip is a half round across the wall; place it so its crown lands on TOP.
    probe_outer = profile.radius_at(neck_line, TOP - 0.006) + rproud
    probe_inner = profile.radius_at(inner, TOP - 0.006)
    lip_base = TOP - (probe_outer - probe_inner) / 2
    rim_face = profile.raised(neck_line, rim0, lip_base + 0.0024, rproud, corner=0.0024)[:-2]
    outer_top = rim_face[-1]
    inner_top = V(profile.radius_at(inner, outer_top.y), outer_top.y)
    lip = profile.rolled_lip(outer_top, inner_top, steps=5)
    inner_gold = profile.resample(list(reversed(profile.between(inner, 0.9055, inner_top.y))), 3, curvature_bias=0)
    # Sampled in two runs so the visible neck keeps its curve; a long chord across the
    # neck's flare would cut out through its 8 mm wall.
    # Dense enough that no chord across the convex belly sags more than about 1 mm into the wall.
    cavity = (profile.resample(list(reversed(profile.between(inner, 0.7000, 0.9055))), 8, curvature_bias=0.3)
              + profile.resample(list(reversed(profile.between(inner, 0.1900, 0.7000))), 12, curvature_bias=0.3)[1:])
    cavity = [p for i, p in enumerate(cavity) if i == 0 or (p - cavity[i - 1]).length > 0.0005]
    low = cavity[-1]
    floor = [V(low.x * 0.5, low.y - 0.0060), V(low.x * 0.2, low.y - 0.0075), V(0, low.y - 0.0080)]
    pts, slots = profile.chain(
        (opal, [V(0, BODY[0][1])]),
        (opal, profile.resample(profile.between(body_line, BODY[0][1], z0), 9, curvature_bias=0.65)),
        (gold, profile.raised(body_line, z0, z1, proud, corner_steps=0, samples=1)),
        (waves, profile.resample(profile.between(body_line, z1, w0), 5, curvature_bias=0.3)),
        (gold, profile.raised(body_line, w0, w1, wproud, corner_steps=0, samples=1)),
        (opal, profile.resample(profile.between(body_line, w1, BODY[-1][1]), 11, curvature_bias=0.55)),
        (gold, [V(*p) for p in COLLAR]),
        (opal, profile.resample(profile.between(neck_line, NECK[0][1], rim0), 10, curvature_bias=0.6)),
        (gold, rim_face + lip + [inner_top] + inner_gold[1:]),
        (opal, cavity + profile.blend(cavity, floor, samples=3) + floor),
    )
    obj = lathe.lathe('body', pts, SEGMENTS, material=[m['opal'], m['gold'], m['waves']], span_materials=slots,
                      sharp_degrees=50, uv=TILE)
    wave_uvs(obj, waves)
    crown = max(range(len(pts)), key=lambda i: pts[i].y)
    glass = [p for p, slot in zip(pts[:crown], slots) if slot != gold]  # the bands stand proud by design
    walls = {name: [t for _, t in profile.wall(glass, pts[crown:], lo, hi)]
             for name, lo, hi in (('body', 0.17, 0.69), ('neck', 0.73, 0.89))}
    obj['wall_mm'] = {k: [round(min(v) * 1000, 1), round(max(v) * 1000, 1)] for k, v in walls.items()}
    return obj, inner


def wave_maps(body_line):
    """The wave register as inlay maps: one period of the running scroll, repeated six times round.

    Each stroke leaves the previous curl, dips, rises to a crest and curls clockwise
    into a spiral; the gold line rides a rolling relief on its lower side (inside
    the curl), with two glass ridges following it there as the concept's water
    layers, and the relief's shading baked into the ground so it reads at
    gameplay size. Drawn in (arc length at the curl height, height above the lower
    band), so `wave_uvs` maps the band with u = angle / period and v = height.
    """
    r_ref = profile.radius_at(body_line, WAVE_CENTRE_Z)
    period = 2 * math.pi * r_ref / WAVES
    z1, w0 = LOWER_BAND[1], WAIST_BAND[0]
    turns, rho0, decay = 1.35, 0.048, 0.74  # spiral: outer radius, shrink per half turn

    def spiral(t):  # t in turns from the crest; clockwise in (arc, z)
        a = math.pi / 2 - 2 * math.pi * t
        rho = rho0 * decay ** (2 * t)
        return V(rho * math.cos(a), WAVE_CENTRE_Z + rho * math.sin(a))

    start = spiral(0.5)
    back = profile.spline([V(start.x - period, start.y), V(-period + 0.075, WAVE_CENTRE_Z - 0.040),
                           V(-period + 0.150, WAVE_CENTRE_Z - 0.010), V(-0.055, WAVE_CENTRE_Z + 0.034),
                           spiral(0.0)], samples=24)
    curl = [spiral(turns * j / 160) for j in range(1, 161)]
    line = [(p.x + period, p.y - z1) for p in back + curl]  # into the tile: s in [0, period), z above the band
    n = len(line)
    half = [WAVE_LINE * (0.65 + 0.35 * min(i / (n * 0.06), 1)) * (1 - 0.6 * max(0.0, (i - n * 0.72) / (n * 0.28)))
            for i in range(n)]

    def layer(offset, start, end, half_width, rise):
        # A glass ridge following the line at `offset` on its right hand (under the crest, inside
        # the curl): the concept's water layers. Fades in over its first fifth, out over its last
        # third. start and end index the line.
        run = []
        for i in range(start, end):
            (s0, z0), (s2, z2) = line[max(i - 1, 0)], line[min(i + 1, n - 1)]
            ts, tz = s2 - s0, z2 - z0
            norm = math.hypot(ts, tz) or 1.0
            run.append((line[i][0] + offset * tz / norm, line[i][1] - offset * ts / norm))
        m = len(run)
        rises = [rise * min(1.0, j / (0.2 * m), (m - 1 - j) / (0.33 * m)) for j in range(m)]
        return run, [half_width] * m, rises

    curl_at = len(back)  # index of the crest; the curl turns `turns` over the next 160 points
    layers = [layer(0.0095, int(curl_at * 0.30), curl_at + int(160 * 0.5 / turns), 0.0042, 0.0016),
              layer(0.0185, int(curl_at * 0.50), curl_at + int(160 * 0.28 / turns), 0.0038, 0.0012)]
    # The band's glass carries the body's patches (the critic measured it grey beside them): the
    # opal's colours over one period, sampled coarsely and smoothed up to the map.
    import numpy as np

    coarse = np.array([[opal_colour(Vector((r_ref * math.cos(s / r_ref), r_ref * math.sin(s / r_ref), z1 + zz)))
                        for s in np.linspace(0, period, 64, endpoint=False)]
                       for zz in np.linspace(0, w0 - z1, 36)])
    rows_i = np.linspace(0, 35, 288)
    cols_i = np.linspace(0, 64, 512, endpoint=False)
    r0, c0 = np.floor(rows_i).astype(int), np.floor(cols_i).astype(int)
    fr, fc = (rows_i - r0)[:, None, None], (cols_i - c0)[None, :, None]
    r1, c1 = np.minimum(r0 + 1, 35), (c0 + 1) % 64  # the period wraps
    c0 %= 64
    field = ((coarse[r0][:, c0] * (1 - fc) + coarse[r0][:, c1] * fc) * (1 - fr)
             + (coarse[r1][:, c0] * (1 - fc) + coarse[r1][:, c1] * fc) * fr)
    maps = textures.inlay('waves', [(line, half)], period, w0 - z1, cols=512, rows=288, ground=field,
                          line='#eec674', ground_trm=(0.35, 0.20, 0.0), line_trm=(0.0, 0.30, 0.6),
                          ridge=0.0012, relief=0.0020, reach=0.024, side=-1, ridges=layers,
                          ground_low='#7aaea4', light=0.12, crackle=dict(CRACKLE, cell=TILE, depth=0.0004),
                          body_colour='#86c3b8')  # the band is the body's pearl, the wave bodies teal
    return maps, period


def wave_uvs(obj, slot):
    """UVs for the wave band's faces: u counts periods round the vessel, v rises 0..1 across the band."""
    z1, w0 = LOWER_BAND[1], WAIST_BAND[0]
    me = obj.data
    layer = me.uv_layers.active.data
    for poly in me.polygons:
        if poly.material_index != slot:
            continue
        first = None
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            u = (math.atan2(co.y, co.x) - WAVE_PHASE) / (2 * math.pi) * WAVES
            if first is None:
                first = u
            u += WAVES * round((first - u) / WAVES)  # keep a face crossing the seam in one piece
            layer[li].uv = (u, (co.z - z1) / (w0 - z1))


def handle(m, side, body_line, neck_line):
    """Jade strap from under the rim, over a round arc, down onto the shoulder, ending in a gold leaf.

    The centre line is the concept's outer edge stepped in by the strap's half
    width at each height (BRIEF.md), so the arc is round, its crown 0.876 m high,
    and the strap widens from 62 mm over the arc to 80 mm where it lands at 0.635.
    Below the landing the concept keeps the outer edge nearly plumb (x 0.286 to
    0.291) while the belly swells into it, and the strap ends in a broad gold leaf
    lying on the glass: the centre line runs 3 mm under the wall, the crown stands
    out to that plumb edge, the side facing the vessel is cut flat no more than
    6 mm into the 10 mm wall, and the leaf keeps its width while it thins, coming
    to a point inside the wall at the widest belly.

    Returns the strap, its gold sleeve at the neck, and the gold strap that runs
    from the sleeve down the neck into the collar.
    """
    arc = [(0.124, 0.833), (0.155, 0.842), (0.192, 0.846), (0.230, 0.837), (0.2465, 0.8220), (0.2582, 0.8067),
           (0.2668, 0.7905), (0.2715, 0.7700), (0.2740, 0.7480), (0.2750, 0.7200), (0.2727, 0.6984),
           (0.2659, 0.6788), (0.2560, 0.6532), (0.2520, 0.6350)]
    for z in (0.612, 0.590, 0.565, 0.540, 0.515, 0.500, 0.488):
        arc.append((max(0.2520, profile.radius_at(body_line, z) - 0.003), z))
    controls = [(x, 0.0, z) for x, z in arc]
    path = sweep.path(controls, samples=34, curvature_bias=0.45)  # worst turn 11 degrees, not 19 at the crown
    # The landing's bend was tighter than the strap is wide, so the sections on its inside (the
    # outer face) zig-zagged, 108 to 147 degrees between rings: round the centre line there,
    # which only moves it out of the wall. Then ring the landing evenly every 7 mm, where the
    # strap's inner face turns down onto the shoulder (23 degrees a ring at 7 to 14 mm).
    for _ in range(6):
        path = [path[0]] + [(a + b * 2 + c) / 4 if 0.575 < b.z < 0.675 else b
                            for a, b, c in zip(path, path[1:], path[2:])] + [path[-1]]
    zone = [i for i, p in enumerate(path) if 0.585 < p.z < 0.675]
    i0, i1 = zone[0] - 1, zone[-1] + 1
    run = [0.0]
    for a, b in zip(path[i0:i1], path[i0 + 1:i1 + 1]):
        run.append(run[-1] + (b - a).length)
    count = max(2, round(run[-1] / 0.007))
    even = []
    for k in range(1, count):
        target = run[-1] * k / count
        j = max(j for j in range(len(run)) if run[j] <= target)
        t = (target - run[j]) / max(run[j + 1] - run[j], 1e-9)
        even.append(path[i0 + j].lerp(path[i0 + j + 1], t))
    path = path[:i0 + 1] + even + path[i1:]
    lengths = [0.0]
    for a, b in zip(path, path[1:]):
        lengths.append(lengths[-1] + (b - a).length)
    landing, tail_top, edge, tip = 0.640, 0.595, 0.2905, 0.488

    def rho_at(z):  # half width in the arc's plane: 31 mm over the arc, 37 mm upright, 40 mm landing
        if z >= 0.80:
            return 0.031
        if z >= 0.74:
            return 0.031 + 0.006 * (0.80 - z) / 0.06
        return min(0.040, 0.037 + 0.003 * (0.74 - z) / 0.085)

    def soft_min(a, b, k=0.008):  # min with its corner rounded over about k: a hard min creased the face
        return (a + b - math.sqrt((a - b) ** 2 + k * k)) / 2

    def strap(i):
        """(outer, inner, half width) of the section at path point i, in metres. Above the
        landing the arc's round section; below it the section clamped to the plumb edge and the
        wall; between z landing - 0.045 and landing + 0.025 a blend of the two over six rings
        (a switch, then a blend over two rings, left a 34-40 degree crease)."""
        p = path[i]
        rho = rho_at(p.z) if lengths[i] > 0.045 else 0.031
        arc_section = (rho, rho, rho * 0.78)
        if p.z >= landing + 0.025:
            return arc_section
        plumb = edge - 0.007 * min(max((0.550 - p.z) / 0.062, 0.0), 1.0)  # meets the widest belly
        wall = profile.radius_at(body_line, p.z)
        outer = max(0.0012, soft_min(rho, plumb - p.x))
        inner = max(0.0030, soft_min(rho, p.x - (wall - 0.006)))
        leaf = min(max((p.z - tip) / (0.600 - tip), 0.0), 1.0) ** 0.5
        clamped = (outer, inner, max(0.0005, rho * 0.78 * leaf))
        t = min(max((p.z - (landing - 0.045)) / 0.070, 0.0), 1.0)
        t = t * t * (3 - 2 * t)
        return tuple(c + (a - c) * t for a, c in zip(arc_section, clamped))

    shape = [strap(i) for i in range(len(path))]

    def section(u, a):
        outer, inner, half = shape[round(u * (len(shape) - 1))]
        c = math.cos(a)
        return (outer if c >= 0 else inner) * c, half * math.sin(a)

    def slot(i, k):  # sides 4 and 5, the inward 72 degrees: the concept's thin lining on the loop's inner edge
        return 1 if path[i].z < tail_top or k in (4, 5) else 0

    name = 'r' if side > 0 else 'l'
    mirror = lambda pts: [Vector((p.x * side, p.y, p.z)) for p in pts]  # noqa: E731
    neck_seat = sweep.seat_on_lathe(neck_line, 0.0030)
    clear = (sweep.clear_of_lathe(neck_line, 0.0015), None, 3)
    obj = sweep.tube(f'handle_{name}', mirror(path), None, ring=10, resample=False, section=section,
                     first_normal=(0, 0, 1), material=[m['jade'], m['gold_polished']], face_material=slot,
                     seat=(neck_seat, None), clear=clear, uv=TILE)

    # The sleeve: 3.5 mm proud of the strap over its first 5.5 cm, its far edge rolled in.
    dense = sweep.path(controls, samples=240)
    run = [0.0]
    for a, b in zip(dense, dense[1:]):
        run.append(run[-1] + (b - a).length)
    reach = 0.055
    picks = [min(range(len(run)), key=lambda j: abs(run[j] - reach * t / 7)) for t in range(8)]
    sleeve_path = [dense[j] for j in picks]
    lift = [0.0035] * 6 + [0.0026, 0.0010]  # metres off the strap; the last two rings roll the edge

    def sleeve_section(u, a):
        i = round(u * 7)
        rho = 0.031 + lift[i]
        return rho * math.cos(a), (0.031 * 0.78 + lift[i]) * math.sin(a)

    sleeve = sweep.tube(f'sleeve_{name}', mirror(sleeve_path), None, ring=16, resample=False,
                        section=sleeve_section, first_normal=(0, 0, 1), material=m['gold_polished'],
                        seat=(neck_seat, None), clear=(clear[0], None, 2), uv=TILE)

    # The neck strap: from under the sleeve down the neck and into the collar, 15 mm wide,
    # its centre 1.5 mm under the neck's surface so the edges are sunk and the crown stands 2 mm.
    points = []
    for z in (0.838, 0.820, 0.800, 0.780, 0.760, 0.745, 0.735, 0.727):
        points.append(Vector((profile.radius_at(neck_line, z) - 0.0015, 0.0, z)))
    points.append(Vector((0.1305, 0.0, 0.718)))  # buried in the collar

    def strap_section(u, a):
        c = math.cos(a)
        return (0.0035 if c >= 0 else 0.0030) * c, 0.0090 * math.sin(a)  # 15 mm across where it shows

    neck_strap = sweep.tube(f'neck_strap_{name}', mirror(points), None, ring=6, resample=False,
                            section=strap_section, first_normal=(side, 0, 0), material=m['gold_polished'], uv=TILE)
    return obj, sleeve, neck_strap, lengths[-1]


def collider():
    """The shipped proxy, exactly: 16-gon at phase 0, r 0.227244, 0 to 0.644 m, flat, no material."""
    import bmesh

    bm = bmesh.new()
    r, h = 0.227244, 0.644
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
    ap.add_argument('--seed', type=int, default=7)
    args = ap.parse_args(argv)

    scene.reset()
    body_line, neck_line, core = outlines()
    maps, period = wave_maps(body_line)
    m = palette(maps)
    parts = [base_ring(m), foot(m), stem_ring(m)]
    shell, inner = body(m, body_line, neck_line, core)
    shell_walls = dict(shell.pop('wall_mm'))  # a fact for the log, not an export extra
    parts.append(shell)
    handles = [handle(m, side, body_line, neck_line) for side in (1, -1)]
    for strap_obj, sleeve, neck_strap, _ in handles:
        parts += [strap_obj, sleeve, neck_strap]

    facts = {'parts': {}}
    for part in parts:
        rep = validate.report(part, within_shell=True)
        problems = validate.failures(rep)
        facts['parts'][part.name] = {k: rep[k] for k in ('tris', 'components', 'volume_m3', 'self_intersections')}
        if problems:
            raise SystemExit(f'part {part.name} fails its gates: {problems}')
    # No part may reach into the hollow: separate shells pass every other gate while doing it.
    hollow = validate.cavity_intrusions(shell, [p for p in parts if p is not shell], z_min=0.20, z_max=TOP)
    facts['cavity_intrusions'] = {name: count for name, (count, _) in hollow.items()}
    inside = {name: f'{count} vertices, {deep * 1000:.1f} mm' for name, (count, deep) in hollow.items() if count}
    if inside:
        raise SystemExit(f'parts inside the cavity: {inside}')

    root = scene.empty(ROOT)
    root['asset_id'] = ASSET_ID
    root['units'] = 'metres'
    shards = []
    if not args.intact_only:
        cut = {p.name: m['cut'] for p in parts}
        cut.update({'base_ring': m['gold'], 'stem_ring': m['gold_polished'], 'foot': m['jade'],
                    'handle_r': m['jade'], 'handle_l': m['jade'],
                    'sleeve_r': m['gold_polished'], 'sleeve_l': m['gold_polished'],
                    'neck_strap_r': m['gold_polished'], 'neck_strap_l': m['gold_polished']})
        shards = fracture.fracture(parts, SHARDS, cut_materials=cut, seed=args.seed, seed_on=parts,
                                   prefix=f'{ROOT}_shard_')
        for shard in shards:
            problems = validate.failures(validate.report(shard, within_shell=True, weld=1e-6))
            if problems:
                raise SystemExit(f'shard {shard.name} fails its gates: {problems}')
            materials.paint_corners(shard, corner_colour, only=('glass_shell', 'jade_stone'))
            shard['role'] = 'shard'
            shard.parent = root
    copies = []
    for part in parts:
        dup = part.copy()
        dup.data = part.data.copy()
        scene.link(dup)
        copies.append(dup)
    intact = scene.join(copies, f'{ROOT}_intact')
    materials.paint_corners(intact, corner_colour, only=('glass_shell', 'jade_stone'))
    intact['role'] = 'intact'
    intact['asset_id'] = ASSET_ID
    intact.parent = root
    for part in parts:
        bpy.data.objects.remove(part)
    proxy = collider()
    proxy.parent = root

    rep = validate.report(intact, within_shell=True)
    facts['intact'] = {k: rep[k] for k in ('tris', 'size_m', 'min_m', 'max_m', 'materials', 'self_intersections')}
    facts['wall_mm'] = shell_walls
    facts['handle_length_m'] = round(handles[0][3], 4)
    facts['wave_period_m'] = round(period, 4)
    if args.blend:
        os.makedirs(os.path.dirname(os.path.abspath(args.blend)), exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args.blend))
    # Uncompressed: meshopt halves the file but its lossy position filter makes one shard cross itself.
    export.glb(args.out, [root, intact, proxy] + shards, tangents=True)  # the gold is normal-mapped
    facts['glb'] = export.summary(args.out)
    print('BUILD', json.dumps(facts, default=str))


if __name__ == '__main__':  # importable for measurement scripts
    main()
