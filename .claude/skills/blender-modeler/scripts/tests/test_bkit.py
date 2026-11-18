"""Headless tests for bkit. Run:

    blender -b --factory-startup --python-exit-code 1 --python scripts/tests/test_bkit.py

Each test resets the scene. Exit code 1 on any failure.
"""

import json
import math
import os
import subprocess
import sys
import tempfile
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from bkit import export, fracture, lathe, materials, profile, scene, sweep, textures, trims, validate  # noqa: E402

V = profile.V


def closed_jar():
    """A small hollow jar: outer wall, rolled lip, inner wall offset along the normal, rounded floor."""
    curve = profile.spline([(0, 0), (0.05, 0), (0.06, 0.04), (0.05, 0.10), (0.03, 0.14), (0.035, 0.16)],
                           samples=8, corners=(1,))
    outer = profile.resample(curve, 40, keep=(8,))
    wall = profile.offset([p for p in outer if p.y >= 0.03], 0.004)
    lip = profile.rolled_lip(outer[-1], wall[-1])
    down = list(reversed(wall))
    # the inner floor meets the wall in a fillet, as blown glass does
    floor = [V(wall[0].x * 0.45, wall[0].y - 0.009), V(wall[0].x * 0.2, wall[0].y - 0.0098), V(0, wall[0].y - 0.01)]
    return outer, outer + lip + down + profile.blend(down, floor) + floor


def test_spline_passes_control_points_and_keeps_corners():
    ctrl = [(0, 0), (1, 0), (1, 1), (0, 2)]
    curve = profile.spline(ctrl, samples=6, corners=(1,))
    for c in ctrl:
        assert min((p - V(*c)).length for p in curve) < 1e-9, c
    resampled = profile.resample(curve, 30, keep=(6,))
    assert (resampled[0] - V(0, 0)).length < 1e-9 and (resampled[-1] - V(0, 2)).length < 1e-9


def test_resample_by_turn_keeps_each_ring_within_the_limit():
    arc = [V(math.cos(math.pi / 2 * k / 400), math.sin(math.pi / 2 * k / 400)) for k in range(401)]
    line = [V(1.0, -1.0 + k / 10) for k in range(10)] + arc  # a straight run into a quarter turn
    out = profile.resample_by_turn(line, 12.0)
    assert (out[0] - line[0]).length < 1e-9 and (out[-1] - line[-1]).length < 1e-9
    turns = [math.degrees((b - a).angle(c - b)) for a, b, c in zip(out, out[1:], out[2:])]
    assert max(turns) <= 12.0 + 0.3, max(turns)  # plus one sample's turn, 0.225 degrees here
    assert len(out) <= 12, len(out)  # 90 degrees at 12 a ring is 8 spans; the straight run needs one more
    assert len(profile.resample_by_turn(line, 12.0, max_length=0.25)) > len(out)


def test_offset_keeps_wall_thickness_on_slopes():
    slope = [V(0.1 + 0.1 * k / 20, 0.2 * k / 20) for k in range(21)]  # 45-degree-ish wall
    inner = profile.offset(slope, 0.005)
    for a, b in zip(slope[2:-2], inner[2:-2]):
        assert abs((a - b).length - 0.005) < 1e-6
        assert b.x < a.x  # inward


def test_lathe_closed_profile_is_watertight_with_expected_volume():
    scene.reset()
    r, h = 0.1, 0.2
    pts = [V(0, 0), V(r, 0), V(r, h), V(0, h)]
    obj = lathe.lathe('cyl', pts, 64)
    rep = validate.report(obj)
    assert validate.failures(rep) == [], validate.failures(rep)
    expected = math.pi * r * r * h * (64 / (2 * math.pi)) * math.sin(2 * math.pi / 64)  # inscribed 64-gon
    assert abs(rep['volume_m3'] - expected) / expected < 1e-3, (rep['volume_m3'], expected)


def test_hollow_jar_is_one_closed_part_without_self_intersections():
    scene.reset()
    _, closed = closed_jar()
    obj = lathe.lathe('jar', closed, 48)
    rep = validate.report(obj)
    assert validate.failures(rep, single_part=True) == [], validate.failures(rep, single_part=True)
    assert rep['sharp_edges_over_30deg'] <= 48, rep['sharp_edges_over_30deg']  # only the designed foot corner


def test_modulation_moves_only_the_band():
    scene.reset()
    pts = profile.resample([V(0, 0), V(0.1, 0), V(0.1, 0.1), V(0.1, 0.2), V(0, 0.2)], 40, curvature_bias=0.0)
    plain = lathe.lathe('plain', pts, 32)
    lobed = lathe.lathe('lobed', pts, 32,
                        modulate=lambda t, z, i: 0.01 * lathe.band(z, 0.08, 0.12, 0.02) * math.cos(4 * t))
    moved = [a.co.z for a, b in zip(plain.data.vertices, lobed.data.vertices) if (a.co - b.co).length > 1e-7]
    assert moved and all(0.06 - 1e-6 <= z <= 0.14 + 1e-6 for z in moved), (min(moved), max(moved))


def test_modulation_can_push_in_a_fixed_direction():
    scene.reset()
    # A cup walked up its outside and down to a flat floor: the floor's corner normal is diagonal.
    pts = [V(0, 0), V(0.1, 0), V(0.1, 0.1), V(0.09, 0.1), V(0.09, 0.01), V(0, 0.01)]
    corner = 4
    along = lathe.lathe('along', pts, 16, modulate=lambda t, z, i: -0.005 if i == corner else 0.0)
    straight = lathe.lathe('straight', pts, 16, modulate=lambda t, z, i: (-0.005, 0.0) if i == corner else 0.0)
    ring = lambda obj: [v.co for v in obj.data.vertices if 0.08 < math.hypot(v.co.x, v.co.y) < 0.0895]  # noqa: E731
    assert len(ring(along)) == 16 and all(c.z > 0.013 for c in ring(along)), 'a normal push lifts the corner'
    assert len(ring(straight)) == 16
    for c in ring(straight):
        assert abs(c.z - 0.01) < 1e-6 and abs(math.hypot(c.x, c.y) - 0.085) < 1e-6, c


def test_chain_and_raised_band_give_one_multi_material_shell():
    scene.reset()
    outer = profile.resample(profile.spline([(0.04, 0.0), (0.06, 0.05), (0.05, 0.12)], samples=12), 30)
    body0 = profile.between(outer, 0.0, 0.05)
    band = profile.raised(outer, 0.05, 0.065, 0.002)
    body1 = profile.between(outer, 0.065, 0.12)
    # mathutils vectors are single precision: equal means within a micron here
    assert (band[0] - body0[-1]).length < 1e-6 and (band[-1] - body1[0]).length < 1e-6
    pts, slots = profile.chain((0, [V(0, 0.0)]), (0, body0), (1, band), (0, body1), (0, [V(0, 0.12)]))
    assert len(slots) == len(pts) - 1 and slots.count(1) == len(band) - 1, (len(pts), slots)
    face = [p for p in band[1:-1]]
    proud = min(p.x - profile.radius_at(outer, p.y) for p in face[1:-1])
    assert proud > 0.0018, proud
    glass, gold = materials.clear_glass(), materials.gold()
    obj = lathe.lathe('banded', pts, 32, material=[glass, gold], span_materials=slots, flat_spans=(len(slots) - 1,))
    rep = validate.report(obj)
    assert validate.failures(rep, single_part=True) == [], validate.failures(rep, single_part=True)
    counts = [sum(1 for p in obj.data.polygons if p.material_index == m) for m in (0, 1)]
    assert counts[1] == 32 * (len(band) - 1), counts
    assert any(not p.use_smooth for p in obj.data.polygons) and any(p.use_smooth for p in obj.data.polygons)


def test_tube_exact_path_slots_and_seat_on_wall():
    scene.reset()
    wall = [V(0.10, 0.0), V(0.10, 0.3)]
    arc = [(0.10 + 0.08 * math.sin(math.pi * k / 16), 0.0, 0.05 + 0.2 * k / 16) for k in range(17)]
    seat = sweep.seat_on_lathe(wall, 0.003)
    jade, gold = materials.jade(), materials.gold()
    obj = sweep.tube('handle', arc, 0.012, ring=8, resample=False, material=[jade, gold],
                     face_material=lambda i, k: 1 if i < 2 or k in (3, 4) else 0, seat=(seat, seat))
    assert len(obj.data.vertices) == 17 * 8 + 2  # exact path kept, two cap hubs
    rep = validate.report(obj)
    assert validate.failures(rep, single_part=True) == [], validate.failures(rep, single_part=True)
    ends = [v.co for v in obj.data.vertices[:8]] + [v.co for v in obj.data.vertices[16 * 8:17 * 8]]
    assert all(abs(math.hypot(c.x, c.y) - 0.097) < 1e-6 for c in ends), 'end rings sit 3 mm inside the wall'
    golds = sum(1 for p in obj.data.polygons if p.material_index == 1)
    assert golds == 2 * 8 + 14 * 2 + 8, golds  # cuff spans, lining sides, start cap


def test_tiled_uvs_keep_texture_size_across_parts():
    scene.reset()
    tile = 0.05
    wide = lathe.lathe('wide', [V(0, 0), V(0.2, 0), V(0.2, 0.1), V(0, 0.1)], 32, uv=tile)
    thin = lathe.lathe('thin', [V(0, 0), V(0.05, 0), V(0.05, 0.1), V(0, 0.1)], 32, uv=tile)

    def side_span(obj):  # u extent around the outer wall, in tiles
        layer = obj.data.uv_layers.active.data
        us = [layer[i].uv.x for p in obj.data.polygons for i in p.loop_indices
              if abs(obj.data.vertices[obj.data.loops[i].vertex_index].co.z - 0.05) < 0.051
              and p.normal.z == 0]
        return max(us) - min(us)

    # a whole number of tiles round each part, so the texture meets itself at angle 0
    assert abs(side_span(wide) - round(2 * math.pi * 0.2 / tile)) < 1e-6, side_span(wide)
    assert abs(side_span(thin) - round(2 * math.pi * 0.05 / tile)) < 1e-6, side_span(thin)
    # and one scale for every ring of a run, so a narrowing wall does not shear it into a spiral
    cone = lathe.lathe('cone', [V(0, 0), V(0.2, 0), V(0.1, 0.2), V(0, 0.2)], 16, uv=tile)
    layer = cone.data.uv_layers.active.data
    by_angle = {}
    for poly in cone.data.polygons:
        for i in poly.loop_indices:
            co = cone.data.vertices[cone.data.loops[i].vertex_index].co
            if 0.0 < co.z < 0.2 and math.hypot(co.x, co.y) > 1e-6:
                angle = round(math.degrees(math.atan2(co.y, co.x))) % 360
                if angle:
                    by_angle.setdefault(angle, set()).add(round(layer[i].uv.x, 6))
    assert all(len(us) == 1 for us in by_angle.values()), 'u differs between rings at one angle'
    tube = sweep.tube('rod', [(0, 0, 0), (0, 0, 0.1), (0, 0, 0.2)], 0.01, ring=8, uv=tile)
    us = [d.uv.x for d in tube.data.uv_layers.active.data]
    assert abs(max(us) - 0.2 / tile) < 1e-3, max(us)
    image = textures.hammered_normal('hammer_test', size=32, cells=4)
    assert image.size[0] == 32 and image.colorspace_settings.name == 'Non-Color' and image.packed_file
    pixels = list(image.pixels)
    assert all(pixels[i + 2] > 0.5 for i in range(0, len(pixels), 4)), 'normals point out of the surface'
    gold = textures.attach_normal(materials.gold(), image, strength=0.8)
    assert any(n.type == 'NORMAL_MAP' for n in gold.node_tree.nodes)
    veins = textures.marbled('veins_test', '#2f7d57', '#86c6a0', size=64, veins=2)
    px = list(veins.pixels)
    row = 64 * 4
    left = [px[y * row + c] for y in range(64) for c in range(3)]
    right = [px[y * row + 63 * 4 + c] for y in range(64) for c in range(3)]
    assert max(abs(a - b) for a, b in zip(left, right)) < 0.25, 'tile edges must meet'
    jade = textures.attach_color(materials.jade(), veins, scale=1 / 3)
    assert any(n.type == 'MAPPING' for n in jade.node_tree.nodes)


def test_inlay_draws_metal_line_glass_ridge_and_baked_shading():
    scene.reset()
    width, height, cols, rows = 0.10, 0.05, 100, 50  # 1 mm texels
    line = ([(0.0, 0.035), (0.10, 0.035)], [0.002, 0.002])
    ridge = ([(0.0, 0.020), (0.10, 0.020)], [0.006, 0.006], [0.002, 0.002])
    maps = textures.inlay('inlay_test', [line], width, height, cols=cols, rows=rows, ground='#808080',
                          line='#e0b65e', ground_trm=(0.35, 0.2, 0.0), line_trm=(0.0, 0.3, 0.6),
                          ridges=[ridge], ground_low='#204030', light=0.2)

    def pixel(image, z, s=0.05):
        px = image.pixels
        r, c = int(z / height * rows), int(s / width * cols)
        i = (r * cols + c) * 4
        return px[i], px[i + 1], px[i + 2]

    gold, trm = pixel(maps['color'], 0.035), pixel(maps['trm'], 0.035)
    assert gold[0] > gold[1] > gold[2] and gold[0] > 0.8, ('line is gold', gold)
    assert abs(trm[2] - 0.6) < 0.02 and trm[0] < 0.02, ('line is metal, not glass', trm)
    flat, below, above = (pixel(maps['color'], z) for z in (0.005, 0.0165, 0.0235))
    assert max(abs(c - flat[0]) for c in flat) < 0.01, ('ground far from the relief is unshaded', flat)
    assert below[1] > below[0] and below[0] < flat[0] - 0.1, ('the down-facing flank moves to ground_low', below)
    assert above[0] > flat[0] + 0.02, ('the up-facing flank is lit', above)
    assert pixel(maps['trm'], 0.0165)[0] > 0.3, 'the ridge is glass'
    n_up, n_down = pixel(maps['normal'], 0.0235), pixel(maps['normal'], 0.0165)
    assert n_up[1] > 0.55 and n_down[1] < 0.45, ('the ridge tilts its normals up and down', n_up, n_down)
    first, last = pixel(maps['normal'], 0.0165, 0.0005), pixel(maps['normal'], 0.0165, 0.0995)
    assert max(abs(a - b) for a, b in zip(first, last)) < 0.02, 'the tile wraps'


def test_crackle_tiles_and_keeps_cells_pale_with_white_cracks():
    scene.reset()
    maps = textures.crackle('crackle_test', size=64, cells=4, tile=0.2, tint=0.04, ground=0.95, keep=1.0)
    px, n = maps['color'].pixels, 64
    values = [max(px[i:i + 3]) for i in range(0, len(px), 4)]
    assert min(values) > 0.9, ('cells stay pale', min(values))
    assert max(values) > 0.99, 'cracks are white'
    normal = maps['normal'].pixels
    left = [normal[(r * n) * 4 + c] for r in range(n) for c in range(3)]
    right = [normal[(r * n + n - 1) * 4 + c] for r in range(n) for c in range(3)]
    assert max(abs(a - b) for a, b in zip(left, right)) < 0.2, 'the tile wraps'
    glass = textures.attach_normal(textures.attach_color(materials.principled('crackle_glass', '#ffffff'),
                                                         maps['color'], scale=0.2), maps['normal'], scale=0.2)
    tinted = materials.vertex_tint(glass)
    mix = next(node for node in tinted.node_tree.nodes if node.type == 'MIX')
    assert mix.inputs[6].links and mix.inputs[6].links[0].from_node.type == 'TEX_IMAGE', 'the tint keeps the texture'


def test_laurel_has_gold_leaves_on_a_dark_ground_and_tiles():
    scene.reset()
    tile, height, cols, rows = 0.06, 0.03, 120, 60
    maps = textures.laurel('laurel_test', tile, height, pairs=2, cols=cols, rows=rows)
    px, trm = maps['color'].pixels, maps['trm'].pixels
    corner = px[0:3]  # bottom-left texel: ground
    assert max(corner) < 0.5, ('the ground is dark', corner)
    metals = [trm[i + 2] for i in range(0, len(trm), 4)]
    assert max(metals) > 0.7 and min(metals) < 0.4, 'leaves are gold, the ground is not'
    stem = [px[((rows // 2) * cols + c) * 4] for c in range(cols)]
    assert min(stem) > 0.5, 'the stem runs the whole tile'
    normal = maps['normal'].pixels
    left = [normal[(r * cols) * 4 + c] for r in range(rows) for c in range(3)]
    right = [normal[(r * cols + cols - 1) * 4 + c] for r in range(rows) for c in range(3)]
    assert max(abs(a - b) for a, b in zip(left, right)) < 0.25, 'the tile wraps'


def test_inlay_relief_has_no_cliffs_between_turns_or_past_an_end():
    scene.reset()
    width, height, n = 0.10, 0.06, 100  # 1 mm texels
    # a clockwise curl round (0.05, 0.03), one and a quarter turns, shrinking inward, ending inside
    points = [(0.05 + (0.022 - 0.010 * j / 60) * math.cos(math.pi / 2 - 2.5 * math.pi * j / 60),
               0.03 + (0.022 - 0.010 * j / 60) * math.sin(math.pi / 2 - 2.5 * math.pi * j / 60)) for j in range(61)]
    half = [0.0015] * len(points)
    maps = textures.inlay('relief_test', [(points, half)], width, height, cols=n, rows=int(height * 1000),
                          relief=0.0015, reach=0.02, side=-1, period_shifts=(0,))
    px = maps['normal'].pixels
    rows = int(height * 1000)
    worst = 1.0
    for r in range(rows):
        for c in range(n):
            s, z = (c + 0.5) / 1000, (r + 0.5) / 1000
            if min(math.hypot(s - x, z - y) for x, y in points) < 0.0045:
                continue  # the line's own crown is steep on purpose
            worst = min(worst, 2 * px[(r * n + c) * 4 + 2] - 1)
    assert worst > 0.93, ('a cliff in the relief tilts a normal to', worst)  # 0.97 smooth, 0.79 with cliffs


def test_sweep_tube_is_closed_and_frames_are_orthonormal():
    scene.reset()
    pts = sweep.path([(0, 0, 0), (0.1, 0, 0.1), (0.15, 0, 0.25), (0.05, 0, 0.35)], 30)
    for t, n, b in sweep.frames(pts, (0, 1, 0)):
        assert abs(t.dot(n)) < 1e-6 and abs(t.dot(b)) < 1e-6 and abs(n.length - 1) < 1e-6
    obj = sweep.tube('handle', [(0, 0, 0), (0.1, 0, 0.1), (0.15, 0, 0.25), (0.05, 0, 0.35)],
                     lambda u: sweep.flare(u, 0.01, 0.016), ring=10, aspect=0.7)
    rep = validate.report(obj)
    assert validate.failures(rep, single_part=True) == [], validate.failures(rep, single_part=True)


def test_trims_are_closed_shells_sunk_into_the_wall():
    scene.reset()
    outer, closed = closed_jar()
    body = lathe.lathe('jar', closed, 48)
    for obj in (trims.bead('bead', outer, 0.09, 0.006, 0.002),
                trims.band('band', outer, 0.05, 0.07, 0.0015),
                trims.ring('ring', 0.05, 0.0, 0.003)):
        rep = validate.report(obj)
        assert validate.failures(rep, single_part=True) == [], (obj.name, validate.failures(rep))
    assert validate.overlap(body, bpy_obj('bead')), 'bead must sink into the wall'


def bpy_obj(name):
    import bpy

    return bpy.data.objects[name]


def test_validate_catches_self_intersection():
    scene.reset()
    a = lathe.lathe('a', [V(0, 0), V(0.1, 0), V(0.1, 0.1), V(0, 0.1)], 16)
    b = lathe.lathe('b', [V(0, 0.05), V(0.1, 0.05), V(0.1, 0.15), V(0, 0.15)], 16)
    b.location.x = 0.05
    merged = scene.join([a, b], 'merged')
    assert validate.report(merged)['self_intersections'] > 0


def test_apply_transform_bakes_a_transform_set_just_before():
    scene.reset()
    obj = lathe.lathe('moved', [V(0, 0), V(0.1, 0), V(0.1, 0.1), V(0, 0.1)], 8)
    obj.location = (1.0, 2.0, 3.0)
    obj.rotation_euler = (math.pi / 2, 0.0, 0.0)
    scene.apply_transform(obj)
    zs = [v.co.z for v in obj.data.vertices]
    ys = [v.co.y for v in obj.data.vertices]
    assert abs(min(zs) - 2.9) < 1e-5 and abs(max(zs) - 3.1) < 1e-5, (min(zs), max(zs))
    assert abs(min(ys) - 1.9) < 1e-5 and abs(max(ys) - 2.0) < 1e-5, (min(ys), max(ys))


def test_push_chroma_spreads_colour_and_keeps_lightness():
    about = (0.85, 0.90, 0.92)
    mint = (0.78, 0.90, 0.86)
    pushed = materials.push_chroma(mint, about, 2.0)  # inside the gamut: exactly twice as far
    L0, a0, b0 = materials._lab(mint)
    L1, a1, b1 = materials._lab(pushed)
    _, ac, bc = materials._lab(about)
    assert abs(L1 - L0) < 0.3, ('lightness kept', L0, L1)
    assert abs((a1 - ac) - 2 * (a0 - ac)) < 0.3 and abs((b1 - bc) - 2 * (b0 - bc)) < 0.3, (a0, a1, b0, b1)
    far = materials.push_chroma((0.84, 0.77, 0.95), about, 6.0)  # outside: as far as sRGB holds, same L
    assert abs(materials._lab(far)[0] - materials._lab((0.84, 0.77, 0.95))[0]) < 0.3, 'clipped by chroma, not L'
    assert max(abs(x - y) for x, y in zip(materials.push_chroma(about, about, 3.0), about)) < 1e-3, 'the centre stays'


def test_shift_lightness_keeps_hue_and_stays_in_gamut():
    mint = (0.78, 0.90, 0.86)
    L0, a0, b0 = materials._lab(mint)
    darker = materials.shift_lightness(mint, -8.0)  # inside the gamut: L moves, a and b stay
    L1, a1, b1 = materials._lab(darker)
    assert abs(L1 - (L0 - 8.0)) < 0.3 and abs(a1 - a0) < 0.3 and abs(b1 - b0) < 0.3, (L0, L1, a0, a1, b0, b1)
    pale = materials.shift_lightness((0.84, 0.77, 0.95), 12.0)  # out of the gamut: chroma gives way, not hue
    L2, a2, b2 = materials._lab(pale)
    La, aa, ba = materials._lab((0.84, 0.77, 0.95))
    assert abs(L2 - (La + 12.0)) < 0.3, ('lightness moved', La, L2)
    assert all(0.0 <= c <= 1.0 for c in pale), pale
    assert abs(math.atan2(b2, a2) - math.atan2(ba, aa)) < 0.02, 'hue kept'


def test_cavity_intrusions_find_a_part_inside_the_hollow():
    scene.reset()
    cup = lathe.lathe('cup', [V(0, 0), V(0.10, 0), V(0.10, 0.20), V(0.09, 0.20), V(0.09, 0.02), V(0, 0.02)], 32)
    inside = lathe.lathe('inside', [V(0, 0.08), V(0.03, 0.08), V(0.03, 0.12), V(0, 0.12)], 8)
    inside.location = (0.05, 0.0, 0.0)  # floats in the hollow, 1 cm from the wall
    outside = lathe.lathe('outside', [V(0, 0.08), V(0.02, 0.08), V(0.02, 0.12), V(0, 0.12)], 8)
    outside.location = (0.13, 0.0, 0.0)  # beside the wall, out in the air
    scene.apply_transform(inside)
    scene.apply_transform(outside)
    found = validate.cavity_intrusions(cup, [inside, outside], z_min=0.03, z_max=0.19)
    assert found['inside'][0] > 0 and found['inside'][1] > 0.05, found
    assert found['outside'] == (0, 0.0), found


def test_touching_counts_a_part_sunk_in_another_without_crossing():
    scene.reset()
    wall = lathe.lathe('wall', [V(0, 0), V(0.1, 0), V(0.1, 0.1), V(0, 0.1)], 16)
    sunk = lathe.lathe('sunk', [V(0, 0.03), V(0.0995, 0.03), V(0.0995, 0.07), V(0, 0.07)], 16)
    far = lathe.lathe('far', [V(0, 0.3), V(0.1, 0.3), V(0.1, 0.4), V(0, 0.4)], 16)
    assert not validate.overlap(wall, sunk), 'no surfaces cross'
    assert validate.touching(wall, sunk), 'half a millimetre inside the surface touches'
    assert not validate.touching(wall, far)


def test_show_through_finds_a_part_poking_out_of_its_cover():
    scene.reset()
    cup = lathe.lathe('cup', [V(0, 0), V(0.10, 0), V(0.10, 0.05), V(0, 0.05)], 32)
    inside = lathe.lathe('inside', [V(0, 0.01), V(0.095, 0.01), V(0.095, 0.04), V(0, 0.04)], 32)
    poking = lathe.lathe('poking', [V(0, 0.01), V(0.095, 0.01), V(0.095, 0.02), V(0.11, 0.025),
                                    V(0.095, 0.03), V(0.095, 0.04), V(0, 0.04)], 32)
    assert validate.show_through(cup, inside, z_min=0.005, z_max=0.045)[0] == 0
    count, rays = validate.show_through(cup, poking, z_min=0.005, z_max=0.045)
    assert count > 0 and rays > count, (count, rays)


def test_validate_counts_pieces_that_float_free():
    scene.reset()
    square = [V(0, 0), V(0.1, 0), V(0.1, 0.1), V(0, 0.1)]
    resting = scene.join([lathe.lathe('a', square, 16), lathe.lathe('b', profile.translate(square, dz=0.1), 16)],
                         'resting')
    rep = validate.report(resting)
    assert rep['components'] == 2 and rep['loose_pieces'] == 0, rep
    apart = lathe.lathe('c', square, 16)
    far = lathe.lathe('d', square, 16)
    far.location.z = 0.2
    floating = scene.join([apart, far], 'floating')
    rep = validate.report(floating)
    assert rep['loose_pieces'] == 1, rep
    assert any('float free' in p for p in validate.failures(rep, uv=False)), validate.failures(rep, uv=False)


def test_fracture_turns_an_inside_out_piece_the_right_way():
    scene.reset()
    obj = lathe.lathe('piece', [V(0, 0), V(0.1, 0), V(0.1, 0.1), V(0, 0.1)], 16)
    volume = validate.report(obj, intersections=False)['volume_m3']
    fracture._reverse(obj)
    assert validate.report(obj, intersections=False)['volume_m3'] < 0
    fracture._reverse(obj)
    assert abs(validate.report(obj, intersections=False)['volume_m3'] - volume) < 1e-9


def test_fracture_gives_exact_count_of_closed_connected_shards_and_keeps_volume():
    scene.reset()
    outer, closed = closed_jar()
    glass = materials.clear_glass()
    cut = materials.cut_glass()
    body = lathe.lathe('jar', closed, 40, material=glass)
    gold = materials.gold()
    ring = trims.band('collar', outer, 0.11, 0.125, 0.0015, material=gold)
    intact_volume = validate.report(body)['volume_m3'] + validate.report(ring)['volume_m3']
    shards = fracture.fracture([body, ring], 6, cut_materials={'jar': cut, 'collar': gold}, seed=3, log=lambda *_: None)
    assert len(shards) == 6
    total = 0.0
    for shard in shards:
        rep = validate.report(shard, intersections=False)
        # a shard may hold several closed shells (glass piece plus its sunk trim piece)
        assert rep['boundary_edges'] == 0 and rep['non_manifold_edges'] == 0, (shard.name, rep)
        assert 'glass_cut' in rep['materials'], rep['materials']
        total += rep['volume_m3']
    assert abs(total - intact_volume) / intact_volume < 0.02, (total, intact_volume)


def test_export_keeps_names_extras_and_glass_extensions():
    scene.reset()
    root = scene.empty('asset_root')
    root['units'] = 'metres'
    body = lathe.lathe('asset_intact', [V(0, 0), V(0.1, 0), V(0.1, 0.2), V(0, 0.2)], 24, material=materials.opal_glass())
    body['role'] = 'intact'
    body.parent = root
    path = os.path.join(tempfile.mkdtemp(), 'asset.glb')
    export.glb(path, [root, body])
    info = export.summary(path)
    names = {n['name']: n for n in info['nodes']}
    assert names['asset_intact']['extras'] == {'role': 'intact'}, names
    assert names['asset_root']['extras'] == {'units': 'metres'}, names
    assert 'KHR_materials_transmission' in info['extensionsUsed'] and 'KHR_materials_ior' in info['extensionsUsed'], info


def test_thickness_map_exports_on_a_second_uv_set():
    scene.reset()
    glass = materials.principled('thick_glass', '#ffcc4d', roughness=0.4, transmission=0.9)
    textures.attach_thickness(glass, textures.thickness_map('thick', lambda f: f), 'LobeUV')
    body = lathe.lathe('asset_intact', [V(0, 0), V(0.1, 0), V(0.1, 0.2), V(0, 0.2)], 24, material=glass)
    body.data.uv_layers.new(name='LobeUV')
    folder = tempfile.mkdtemp()
    path, finished, optics = (os.path.join(folder, name) for name in ('raw.glb', 'asset.glb', 'optics.json'))
    export.glb(path, [body])
    assert 'thicknessTexture' in export.read_json(path)['materials'][0]['extensions']['KHR_materials_volume']
    with open(optics, 'w') as handle:  # the exporter loses the UV set; gltf_finish puts it back
        json.dump({'thick_glass': {'thicknessFactor': 0.15, 'thicknessTexCoord': 1}}, handle)
    subprocess.run(['python3', '-I', os.path.join(os.path.dirname(HERE), 'gltf_finish.py'), path, finished,
                    '--optics', optics], check=True, capture_output=True)  # plain Python, as the pipeline runs it
    volume = export.read_json(finished)['materials'][0]['extensions']['KHR_materials_volume']
    assert volume['thicknessTexture'].get('texCoord') == 1 and volume['thicknessFactor'] == 0.15, volume


def main():
    tests = [(name, fn) for name, fn in sorted(globals().items()) if name.startswith('test_') and callable(fn)]
    failed = []
    for name, fn in tests:
        try:
            fn()
            print(f'PASS {name}')
        except Exception:  # report every failure, then fail the run
            failed.append(name)
            print(f'FAIL {name}')
            traceback.print_exc()
    print(f'{len(tests) - len(failed)}/{len(tests)} passed')
    if failed:
        raise SystemExit(1)


main()
