"""Headless tests for bkit. Run:

    blender -b --factory-startup --python-exit-code 1 --python scripts/tests/test_bkit.py

Each test resets the scene. Exit code 1 on any failure.
"""

import math
import os
import sys
import tempfile
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from mathutils import Vector  # noqa: E402

from bkit import export, fracture, lathe, materials, profile, scene, sweep, trims, validate  # noqa: E402

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
