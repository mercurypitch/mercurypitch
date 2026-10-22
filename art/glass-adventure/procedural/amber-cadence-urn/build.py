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
  body           amber glass in eight cushion lobes, hollow, an even 10 mm wall
                 down to a thick floor; the lobes fade out under both bands
  shoulder band  gold fillets round a laurel frieze lying on the shoulder, a
                 jade cabochon in a gold bezel at the front
  neck           cream marble, concave, flaring to a rolled lip
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
SEGMENTS = 36  # the plain lathes: 1.1 mm of polygon on the foot, within budget
FRONT = -math.pi / 2  # the cabochon and the bead face -Y
WALL = 0.010
LAUREL_TILE = 0.09  # one repeat of the frieze: two leaf pairs, 4.5 cm apart as in the concept

# Outer outlines bottom to top (r, z), read off reference/concept-profile.json.
# The foot: a 3.5 cm round on its bottom edge, widest 4 to 7 cm up, rounding in to the band at 12 cm
# (reference/concept-profile.json, checked against the gate's rows).
FOOT = [(0.0, 0.0), (0.2250, 0.0), (0.2440, 0.0025), (0.2580, 0.0080), (0.2665, 0.0140), (0.2760, 0.0200),
        (0.2840, 0.0260), (0.2895, 0.0340), (0.2925, 0.0460), (0.2930, 0.0600), (0.2925, 0.0720),
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
LOBE_DEPTH = 0.10  # of the radius at a crease, at the widest
LOBE_SPAN = (0.1720, 0.5560)  # the lobes fade to nothing at both bands


def palette(laurel_maps, shoulder_maps):
    marble_veins = textures.marbled('marble_veins', '#ede4d3', '#c19a66', dark='#d9ccb3', size=256, veins=2,
                                    turbulence=2.4, softness=0.18, seed=9)
    return {
        'marble': textures.attach_color(
            materials.principled('marble_cream', '#ede4d3', roughness=0.30, coat=0.35, coat_roughness=0.10),
            marble_veins, scale=1 / 4),
        # Amber at the concept's midtone (hue 31, value 0.67): its colour in the base and in the
        # volume, transmission 0.55 so it keeps its own colour and hides the foot inside.
        # The concept's amber darkens into every crease: COLOR_0, painted by amber_colour.
        'amber': materials.vertex_tint(
            materials.principled('amber_glass', '#cc8a2a', roughness=0.04, transmission=0.55, ior=1.52)),
        # Warmer than the amphora's: this concept's gold midtone is hue 33, saturation 0.59.
        'gold': materials.gold('gold_polished', '#e6b46a', roughness=0.22, metallic=0.75),
        'laurel': textures.attach_inlay(materials.principled('laurel_frieze', '#ffffff', roughness=0.5),
                                        laurel_maps, strength=1.0),
        # The shoulder's frieze is a 13 cm slope, not a 4 cm band: its own map, leaves to suit.
        'laurel_high': textures.attach_inlay(materials.principled('laurel_shoulder', '#ffffff', roughness=0.5),
                                             shoulder_maps, strength=1.0),
        'jade': materials.principled('jade_stone', '#2f5e3d', roughness=0.12, transmission=0.10, ior=1.61,
                                     coat=0.6, coat_roughness=0.05),
        'amber_cut': materials.principled('amber_cut', '#e8a64a', roughness=0.22, transmission=0.70, ior=1.52),
    }


def lobe_depth(theta, z):
    """Metres a point moves toward the axis: a cusp at every crease, nothing on a lobe's crown,
    fading out toward both bands."""
    lo, hi = LOBE_SPAN
    if z <= lo or z >= hi:
        return 0.0
    fade = math.sin(math.pi * (z - lo) / (hi - lo)) ** 0.5
    period = 2 * math.pi / LOBES
    phi = ((theta - FRONT + period / 2) % period) - period / 2  # 0 on a lobe's crown, the front lobe centred
    r = profile.radius_at(BODY_LINE, z) or 0.0
    return r * LOBE_DEPTH * fade * abs(phi / (period / 2)) ** 2.4


BODY_LINE = profile.spline([V(r, z) for r, z in BODY], samples=8)


def amber_colour(p):
    """sRGB multiplier for the amber: clear on a lobe's crown, deeper and redder into each crease."""
    lo, hi = LOBE_SPAN
    if p.z <= lo or p.z >= hi:
        return (1.0, 1.0, 1.0)
    fade = math.sin(math.pi * (p.z - lo) / (hi - lo)) ** 0.5
    period = 2 * math.pi / LOBES
    phi = ((math.atan2(p.y, p.x) - FRONT + period / 2) % period) - period / 2
    crease = abs(phi / (period / 2)) ** 3 * fade
    deep = (0.58, 0.44, 0.36)  # the concept's creases fall to value 0.43
    return tuple(1.0 + (d - 1.0) * crease for d in deep)


def foot(m):
    pts = profile.resample(profile.spline([V(r, z) for r, z in FOOT[1:-1]], samples=6), 12, curvature_bias=0.6)
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


def shoulder_band(m):
    """The upper band lies on the shoulder's slope, 1.5 mm off it, between two rolled gold fillets."""
    z0, z1 = SHOULDER_BAND
    face = profile.resample(profile.between(BODY_LINE, z0, z1), 9, curvature_bias=0.3)
    normals = [-profile.normal_in(face, i) for i in range(len(face))]
    out = [p + n * 0.0015 for p, n in zip(face, normals)]
    back = [face[0] - normals[0] * 0.008, face[-1] - normals[-1] * 0.008]  # hidden in the body: two rings
    roll = 0.0030  # fillet radius

    def fillet(p, n, along):  # a half round standing proud of the face at p
        return [p + n * (roll * math.sin(math.pi * k / 4)) + along * (roll * (1 - math.cos(math.pi * k / 4)))
                for k in range(1, 4)]

    up = (out[-1] - out[0]).normalized()
    gold, laurel = 0, 1
    front = ([out[0]] + fillet(out[0], normals[0], up) + [out[0] + up * 2 * roll] + out[2:-2]
             + [out[-1] - up * 2 * roll] + fillet(out[-1] - up * 2 * roll, normals[-1], up) + [out[-1]])
    k0, k1 = 4, len(front) - 5  # the frieze runs between the fillets
    pts = list(reversed(back)) + front
    slots = [gold] * len(back) + [laurel if k0 <= i < k1 else gold for i in range(len(front) - 1)] + [gold]
    obj = lathe.lathe('shoulder_band', pts, SEGMENTS, closed=True, material=[m['gold'], m['laurel_high']],
                      span_materials=slots, sharp_degrees=50, uv=TILE)
    return obj, laurel, front[k0:k1 + 1]


def body(m):
    """Amber glass: outer wall, a shoulder that turns in to the bore, inner wall 10 mm in, floor."""
    outer = profile.resample(BODY_LINE, 25, curvature_bias=0.5)
    top = V(BORE, outer[-1].y)
    inner_line = profile.offset(BODY_LINE, WALL)
    inner = [p for p in reversed(inner_line) if 0.205 < p.y < outer[-1].y - WALL and p.x > BORE]
    inner = profile.resample(inner, 9, curvature_bias=0.4)  # seen only down the neck and in shards
    floor_z = 0.2050
    inner = [V(BORE, outer[-1].y - WALL)] + inner + [V(inner[-1].x * 0.6, floor_z + 0.002), V(0.0, floor_z)]
    pts = [V(0.0, BODY[0][1])] + outer + [top] + inner

    def modulate(theta, z, i):  # both walls move toward the axis together, so the wall stays even
        return -lobe_depth(theta, z)

    obj = lathe.lathe('body', pts, BODY_SEGMENTS, modulate=modulate, material=m['amber'], sharp_degrees=40, uv=TILE)
    return obj


def neck(m):
    """Cream marble: concave, flaring to a rolled lip; its bore runs down into the body."""
    outer = profile.resample(profile.spline([V(r, z) for r, z in NECK], samples=6), 9, curvature_bias=0.5)
    inner_top = V(LIP_INNER, outer[-1].y)
    lift = (TOP - outer[-1].y) / ((outer[-1] - inner_top).length / 2)  # the lip's crown lands on TOP
    lip = profile.rolled_lip(outer[-1], inner_top, steps=5, lift=lift)
    inner = [V(LIP_INNER - 0.004, 0.7000), V(0.1900, 0.6800), V(0.1720, 0.6500), V(BORE, 0.6200), V(BORE, NECK[0][1])]
    pts = outer + lip + [inner_top] + inner
    return lathe.lathe('neck', pts, SEGMENTS, closed=True, material=m['marble'], sharp_degrees=60, uv=TILE)


def front_point(r, z, out=0.0):
    return Vector(((r + out) * math.cos(FRONT), (r + out) * math.sin(FRONT), z))


def bead(m, z, r):
    """The gold bead at the front of the lower band, sunk a third into it."""
    radius = 0.019
    pts = [V(radius * math.sin(math.pi * k / 10), -radius * math.cos(math.pi * k / 10)) for k in range(11)]
    obj = lathe.lathe('bead', [V(0.0, p.y) if i in (0, 10) else p for i, p in enumerate(pts)], 14,
                      material=m['gold'], uv=TILE)
    obj.rotation_euler = (math.pi / 2, 0, 0)  # its axis along -Y, out of the band
    obj.location = front_point(r, z, radius * 0.55)
    scene.apply_transform(obj)
    return obj


def cabochon(m, z, r, normal):
    """A domed oval jade stone in a gold bezel, facing out of the shoulder band.

    Built round +Z, then turned so +Z points along the band's outward normal at the
    front and stretched up the band into an oval."""
    w, h, dome = 0.034, 0.042, 0.019  # half width, half height, crown height: the concept's 7 x 9 cm stone
    arc = [V(w * math.cos(math.pi / 2 * k / 6), dome * math.sin(math.pi / 2 * k / 6)) for k in range(7)]
    gem = lathe.lathe('cabochon', [V(0.0, -0.004), V(w, -0.004)] + arc[:-1] + [V(0.0, dome)], 24,
                      material=m['jade'], uv=TILE)
    bezel = lathe.lathe('bezel', [V(w - 0.002, -0.007), V(w + 0.005, -0.007), V(w + 0.006, 0.002),
                                  V(w + 0.003, 0.0055), V(w - 0.001, 0.0045)], 24, closed=True,
                        material=m['gold'], uv=TILE)
    tilt = math.atan2(normal.x, normal.y)  # from +Z toward the outward radius (-Y at the front)
    for obj in (gem, bezel):
        obj.scale = (1.0, h / w, 1.0)
        obj.rotation_euler = (tilt, 0.0, 0.0)
        obj.location = front_point(r, z)
        scene.apply_transform(obj)
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
    slope = profile.length(profile.between(BODY_LINE, *SHOULDER_BAND)) - 0.016  # less the fillets
    shoulder_maps = textures.laurel('laurel_shoulder', 0.11, slope, pairs=3, cols=384, rows=256,
                                    leaf=(0.062, 0.025), angle=34, relief=0.0028, stem=0.0022, ground='#33200d',
                                    leaf_colour='#e0ad62')
    m = palette(maps, shoulder_maps)
    lower, lower_slot = band_ring('lower_band', m, z0, z1, fillet_r, frieze_r, 0.2300)
    laurel_uvs(lower, lower_slot, LAUREL_TILE, z0=z0 + 0.009, z1=z1 - 0.009)
    upper, upper_slot, frieze = shoulder_band(m)
    laurel_uvs(upper, upper_slot, 0.11, across=frieze)
    u0, u1 = frieze[0], frieze[-1]
    mid = (u0 + u1) / 2
    face_dir = (u1 - u0).normalized()
    normal = Vector((face_dir.y, -face_dir.x))  # outward off the shoulder
    gem, bezel = cabochon(m, mid.y + 0.004 * normal.y, mid.x + 0.004 * normal.x, normal)
    parts = [foot(m), lower, body(m), upper, neck(m), bead(m, (z0 + z1) / 2, frieze_r), gem, bezel]

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
        cut = {'foot': m['marble'], 'neck': m['marble'], 'body': m['amber_cut'], 'lower_band': m['gold'],
               'shoulder_band': m['gold'], 'bead': m['gold'], 'bezel': m['gold'], 'cabochon': m['jade']}
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
