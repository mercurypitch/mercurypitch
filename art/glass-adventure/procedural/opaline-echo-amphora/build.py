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
  handles     jade straps with gold cuffs and a gold inner lining, their ends
              seated in the neck and shoulder walls
  waves       six gold wave strokes curling into spirals, inlaid in the body
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
from bkit import export, fracture, lathe, materials, profile, scene, sweep, textures, validate  # noqa: E402

V = profile.V
ROOT = 'breakable_l2_opaline_echo_amphora'
ASSET_ID = 'opaline-echo-amphora'
SEGMENTS = 32
TILE = 0.06  # UVs in tiles of 6 cm, so the hammered gold has one dent size on every part
TOP = 0.920
SHARDS = 18

# Outer wall of the glass, bottom to top (r, z) in metres. The first point sits
# inside the stem ring; the last meets the collar.
BODY = [(0.0880, 0.1580), (0.0900, 0.1680), (0.1000, 0.1715), (0.1177, 0.1750), (0.1427, 0.2000),
        (0.1768, 0.2300), (0.2024, 0.2600), (0.2276, 0.3000), (0.2479, 0.3400), (0.2628, 0.3800),
        (0.2730, 0.4200), (0.2800, 0.4500), (0.2827, 0.4800), (0.2806, 0.5225), (0.2725, 0.5645),
        (0.2567, 0.6065), (0.2280, 0.6440), (0.1950, 0.6680), (0.1620, 0.6830), (0.1450, 0.6905)]
COLLAR = [(0.1450, 0.6905), (0.1482, 0.6950), (0.1490, 0.7080), (0.1478, 0.7210), (0.1440, 0.7250),
          (0.1330, 0.7260)]
NECK = [(0.1330, 0.7260), (0.1255, 0.7330), (0.1180, 0.7550), (0.1145, 0.7760), (0.1160, 0.8000),
        (0.1220, 0.8250), (0.1340, 0.8550), (0.1490, 0.8850), (0.1590, 0.9000), (0.1625, 0.9150),
        (0.1640, 0.9250)]  # runs past the lip so the rim can be measured off it
# The surface under the collar, which the inner wall follows instead of the collar. It
# must pass inside the corner where the collar's foot meets the shoulder, or the
# inner wall comes out through the outer one there.
CORE_SHOULDER = [(0.1440, 0.6875), (0.1390, 0.6980), (0.1340, 0.7110), (0.1305, 0.7260)]

LOWER_BAND = (0.2450, 0.2615, 0.0028)  # z0, z1, proud
WAIST_BAND = (0.4205, 0.4425, 0.0030)
RIM_BAND = (0.8985, 0.0055)  # z0, proud; it runs up into the lip
WALL_NECK, WALL_BODY = 0.0080, 0.0100

WAVES = 6
WAVE_PHASE = math.radians(-79.0)  # a curl just right of the front, as in the concept
WAVE_CENTRE_Z = 0.350
WAVE_TUBE = 0.0034


def palette():
    return {
        # Milky, not clear: part of the light scatters in the glass. No coat: the thin film sits on
        # the base specular layer and a coat over it hides the colour play. Sheen is the pearl.
        'opal': materials.principled('glass_shell', '#d7efe6', roughness=0.10, transmission=0.62, ior=1.47,
                                     thin_film_nm=420.0, thin_film_ior=1.55, sheen=0.6, sheen_tint='#dccbf2',
                                     sheen_roughness=0.35),
        # The concept's gold is hand-hammered everywhere: shallow dents, no triangles.
        'gold': textures.attach_normal(materials.gold('gold_trim', '#e0b65e', roughness=0.30),
                                       textures.hammered_normal('hammered_gold', size=128, cells=5, depth=0.45),
                                       strength=1.0),
        # Cloudy jade: a mottled ground with soft lighter veins, one image over three tiles.
        'jade': textures.attach_color(
            materials.principled('jade_stone', '#2f7d57', roughness=0.24, transmission=0.08, ior=1.61,
                                 coat=0.6, coat_roughness=0.07),
            textures.marbled('jade_veins', '#2f7d57', '#86c6a0', dark='#1d5a3c', size=256, veins=2,
                             turbulence=2.6, softness=0.4), scale=1 / 3),
        'cut': materials.cut_glass('glass_cut', '#d3ece4'),
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
    pts = [V(0, 0), V(0.1650, 0), V(0.1712, 0.0020), V(0.1745, 0.0075), V(0.1758, 0.0160), V(0.1760, 0.0450),
           V(0.1752, 0.0640), V(0.1730, 0.0700), V(0.1680, 0.0720), V(0, 0.0720)]
    return lathe.lathe('base_ring', pts, SEGMENTS, material=m['gold'], sharp_degrees=50, uv=TILE)


def foot(m):
    skirt = profile.resample(profile.spline([(0.1645, 0.0700), (0.1645, 0.0745), (0.1600, 0.0850), (0.1510, 0.0950),
                                             (0.1380, 0.1050), (0.1200, 0.1130), (0.1050, 0.1195), (0.0990, 0.1240)],
                                            samples=6), 7, curvature_bias=0.5)
    pts = [V(0, 0.0690), V(0.1640, 0.0690)] + skirt + [V(0.0965, 0.1300), V(0, 0.1300)]
    return lathe.lathe('foot', pts, SEGMENTS, material=m['jade'], sharp_degrees=50, uv=TILE)


def stem_ring(m):
    pts = [V(0, 0.1240), V(0.0960, 0.1240), V(0.1005, 0.1255), V(0.1018, 0.1300), V(0.1015, 0.1440),
           V(0.0990, 0.1465), V(0.1012, 0.1490), V(0.1010, 0.1600), V(0.0985, 0.1640), V(0.0940, 0.1660),
           V(0, 0.1665)]
    return lathe.lathe('stem_ring', pts, SEGMENTS, material=m['gold'], sharp_degrees=50, uv=TILE)


def body(m, body_line, neck_line, core):
    """One shell: opal wall, raised gold bands, gold collar and rim, rolled lip, inner wall, floor."""
    opal, gold = 0, 1
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
    cavity = (profile.resample(list(reversed(profile.between(inner, 0.7000, 0.9055))), 6, curvature_bias=0.3)
              + profile.resample(list(reversed(profile.between(inner, 0.1900, 0.7000))), 6, curvature_bias=0.5)[1:])
    low = cavity[-1]
    floor = [V(low.x * 0.5, low.y - 0.0060), V(low.x * 0.2, low.y - 0.0075), V(0, low.y - 0.0080)]
    pts, slots = profile.chain(
        (opal, [V(0, BODY[0][1])]),
        (opal, profile.resample(profile.between(body_line, BODY[0][1], z0), 6, curvature_bias=0.5)),
        (gold, profile.raised(body_line, z0, z1, proud, samples=1)),
        (opal, profile.resample(profile.between(body_line, z1, w0), 5, curvature_bias=0.3)),
        (gold, profile.raised(body_line, w0, w1, wproud, samples=1)),
        (opal, profile.resample(profile.between(body_line, w1, BODY[-1][1]), 8, curvature_bias=0.5)),
        (gold, [V(*p) for p in COLLAR]),
        (opal, profile.resample(profile.between(neck_line, NECK[0][1], rim0), 7, curvature_bias=0.4)),
        (gold, rim_face + lip + [inner_top] + inner_gold[1:]),
        (opal, cavity + profile.blend(cavity, floor, samples=3) + floor),
    )
    obj = lathe.lathe('body', pts, SEGMENTS, material=[m['opal'], m['gold']], span_materials=slots,
                      sharp_degrees=50, uv=TILE)
    return obj, inner


def wave_strokes(m, body_line):
    """Six gold strokes: each leaves the previous curl, dips, rises to a crest and curls clockwise."""
    r_ref = profile.radius_at(body_line, WAVE_CENTRE_Z)
    period = 2 * math.pi * r_ref / WAVES  # arc length per wave at the curl height
    turns, rho0, decay = 1.35, 0.048, 0.74  # spiral: outer radius, shrink per half turn

    def spiral(t):  # t in turns from the crest; clockwise in (arc, z)
        a = math.pi / 2 - 2 * math.pi * t
        rho = rho0 * decay ** (2 * t)
        return V(rho * math.cos(a), WAVE_CENTRE_Z + rho * math.sin(a))

    def to_surface(s, z, k):
        theta = WAVE_PHASE + (k * period + s) / r_ref
        r = profile.radius_at(body_line, z) + 0.0008
        return Vector((r * math.cos(theta), r * math.sin(theta), z))

    strokes = []
    for k in range(WAVES):
        start = spiral(0.5)  # the previous curl's lowest point, buried in its tube
        start = V(start.x - period, start.y)
        top = spiral(0.0)
        back = profile.spline([start, V(-period + 0.075, WAVE_CENTRE_Z - 0.040),
                               V(-period + 0.150, WAVE_CENTRE_Z - 0.010),
                               V(-0.055, WAVE_CENTRE_Z + 0.034), top], samples=8)
        back = profile.resample(back, 8, curvature_bias=0.35)
        curl = [spiral(turns * j / 17) for j in range(1, 18)]
        line = back + curl
        pts = [to_surface(p.x, p.y, k) for p in line]
        n = len(pts)
        radius = [WAVE_TUBE * (0.7 + 0.3 * min(i / 3, 1)) * (1 - 0.55 * max(0, (i - n * 0.7) / (n * 0.3)))
                  for i in range(n)]
        normal = Vector((math.cos(WAVE_PHASE + (k * period + start.x) / r_ref),
                         math.sin(WAVE_PHASE + (k * period + start.x) / r_ref), 0))
        strokes.append(sweep.tube(f'wave_{k}', pts, lambda u, radius=radius: radius[round(u * (len(radius) - 1))],
                                  ring=3, resample=False, first_normal=normal, material=m['gold'], uv=TILE))
    return scene.join(strokes, 'waves')


def handle(m, side, body_line, neck_line):
    """Jade strap from under the rim, over a high arc, down onto the shoulder, ending in a gold leaf.

    The concept keeps the strap's outer edge nearly plumb (x 0.286-0.291) below the
    shoulder while the belly swells into it, and the strap's lower end is a broad
    gold leaf lying on the glass. So below the landing the centre line runs 3 mm
    under the wall, the crown stands out to that plumb edge, the side facing the
    vessel is cut flat at no more than 6 mm into the 10 mm wall, and the leaf keeps
    its width while it thins, coming to a point inside the wall at the widest belly.
    """
    arc = [(0.124, 0.836), (0.152, 0.848), (0.192, 0.852), (0.233, 0.842), (0.262, 0.816), (0.2775, 0.780),
           (0.2805, 0.738), (0.2765, 0.700), (0.2655, 0.668), (0.2575, 0.645), (0.2575, 0.622)]
    for z in (0.600, 0.570, 0.540, 0.515, 0.500, 0.488):
        arc.append((max(0.2575, profile.radius_at(body_line, z) - 0.003), z))
    path = sweep.path([(x, 0.0, z) for x, z in arc], samples=34)
    lengths = [0.0]
    for a, b in zip(path, path[1:]):
        lengths.append(lengths[-1] + (b - a).length)
    cuff_end, landing, tail_top, edge, tip = 0.060, 0.645, 0.595, 0.2905, 0.488

    def strap(i):
        """(outer, inner, half width) of the section at path point i, in metres."""
        s, p = lengths[i], path[i]
        if s < cuff_end:
            rho = 0.0365
        elif s < cuff_end + 0.012:
            rho = 0.0365 - 0.0035 * (s - cuff_end) / 0.012
        else:
            rho = 0.0330
        if p.z >= landing:
            return rho, rho, rho * 0.78
        plumb = edge - 0.007 * min(max((0.550 - p.z) / 0.062, 0.0), 1.0)  # meets the widest belly
        wall = profile.radius_at(body_line, p.z)
        outer = max(0.0012, min(rho, plumb - p.x))
        inner = max(0.0030, min(rho, p.x - (wall - 0.006)))
        leaf = min(max((p.z - tip) / (0.600 - tip), 0.0), 1.0) ** 0.5
        return outer, inner, max(0.0005, rho * 0.78 * leaf)

    shape = [strap(i) for i in range(len(path))]

    def section(u, a):
        outer, inner, half = shape[round(u * (len(shape) - 1))]
        c = math.cos(a)
        return (outer if c >= 0 else inner) * c, half * math.sin(a)

    def slot(i, k):  # sides 3-6 wrap the face toward the vessel: the gold lining, seen from the front
        if lengths[i] < cuff_end + 0.006 or path[i].z < tail_top or k in (3, 4, 5, 6):
            return 1
        return 0

    pts = [Vector((p.x * side, 0.0, p.z)) for p in path]
    obj = sweep.tube(f'handle_{"r" if side > 0 else "l"}', pts, None, ring=10, resample=False, section=section,
                     first_normal=(0, 0, 1), material=[m['jade'], m['gold']], face_material=slot,
                     seat=(sweep.seat_on_lathe(neck_line, 0.0035), None),
                     clear=(sweep.clear_of_lathe(neck_line, 0.0015), None, 3), uv=TILE)
    return obj, lengths[-1]


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
    m = palette()
    body_line, neck_line, core = outlines()
    parts = [base_ring(m), foot(m), stem_ring(m)]
    shell, inner = body(m, body_line, neck_line, core)
    parts.append(shell)
    handles = [handle(m, side, body_line, neck_line) for side in (1, -1)]
    parts += [h for h, _ in handles]
    parts.append(wave_strokes(m, body_line))

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
        cut = {p.name: m['cut'] for p in parts}
        cut.update({'base_ring': m['gold'], 'stem_ring': m['gold'], 'foot': m['jade'],
                    'handle_r': m['jade'], 'handle_l': m['jade'], 'waves': m['gold']})
        shards = fracture.fracture(parts, SHARDS, cut_materials=cut, seed=args.seed, seed_on=parts,
                                   prefix=f'{ROOT}_shard_')
        for shard in shards:
            problems = validate.failures(validate.report(shard, within_shell=True, weld=1e-6))
            if problems:
                raise SystemExit(f'shard {shard.name} fails its gates: {problems}')
            shard['role'] = 'shard'
            shard.parent = root
    copies = []
    for part in parts:
        dup = part.copy()
        dup.data = part.data.copy()
        scene.link(dup)
        copies.append(dup)
    intact = scene.join(copies, f'{ROOT}_intact')
    intact['role'] = 'intact'
    intact['asset_id'] = ASSET_ID
    intact.parent = root
    for part in parts:
        bpy.data.objects.remove(part)
    proxy = collider()
    proxy.parent = root

    rep = validate.report(intact, within_shell=True)
    facts['intact'] = {k: rep[k] for k in ('tris', 'size_m', 'min_m', 'max_m', 'materials', 'self_intersections')}
    facts['handle_length_m'] = round(handles[0][1], 4)
    if args.blend:
        os.makedirs(os.path.dirname(os.path.abspath(args.blend)), exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args.blend))
    export.glb(args.out, [root, intact, proxy] + shards, tangents=True)  # the gold is normal-mapped
    facts['glb'] = export.summary(args.out)
    print('BUILD', json.dumps(facts, default=str))


main()
