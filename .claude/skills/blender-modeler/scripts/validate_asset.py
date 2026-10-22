"""Contract and mesh gates for an exported GLB. Exit code 1 when any gate fails.

blender -b --factory-startup --python-exit-code 1 --python validate_asset.py -- IN.glb CONTRACT.json [--out REPORT.json]

CONTRACT.json (every key optional except "intact"):
{
  "root": "breakable_l2_opaline_echo_amphora",
  "intact": "breakable_l2_opaline_echo_amphora_intact",
  "shard_prefix": "breakable_l2_opaline_echo_amphora_shard_", "shard_count": 18,
  "collider": "COLLIDER_breakable_l2_opaline_echo_amphora",
  "height_m": 0.92, "height_tolerance_m": 0.003, "base_m": 0.0,
  "max_tris_intact": 8000, "max_tris_shards_total": 12800,
  "extras": {"root": {...}, "intact": {...}, "shard": {...}, "collider": {...}},
  "volume_tolerance": 0.03
}
Heights are glTF +Y (Blender +Z after import). Shells inside one object may
cross each other (a band sunk into a wall); a shell crossing itself fails.
"""

import json
import sys
import os

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from bkit import scene, validate  # noqa: E402

# glTF splits a vertex at every UV seam, hard edge and material change; weld before topology checks.
WELD = 1e-6
argv = sys.argv[sys.argv.index('--') + 1:]
src, contract_path = argv[0], argv[1]
out_path = argv[argv.index('--out') + 1] if '--out' in argv else None
with open(contract_path) as handle:
    contract = json.load(handle)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
objects = {o.name: o for o in bpy.context.scene.objects}
problems = []
facts = {}


def need(name, kind):
    obj = objects.get(name)
    if obj is None:
        problems.append(f'missing {kind} node {name!r}')
    return obj


def extras_match(obj, expected, kind):
    for key, value in (expected or {}).items():
        if obj.get(key) != value:
            problems.append(f'{kind} {obj.name}: extras[{key!r}] is {obj.get(key)!r}, expected {value!r}')


root = need(contract['root'], 'root') if 'root' in contract else None
if root is not None:
    if root.type != 'EMPTY':
        problems.append(f'root {root.name} is a {root.type}, expected an empty')
    if (root.matrix_world.translation.length > 1e-6 or any(abs(s - 1) > 1e-6 for s in root.matrix_world.to_scale())):
        problems.append(f'root {root.name} carries a transform')
    extras_match(root, contract.get('extras', {}).get('root'), 'root')

intact = need(contract['intact'], 'intact')
intact_volume = 0.0
if intact is not None:
    rep = validate.report(intact, within_shell=True, weld=WELD)
    facts['intact'] = rep
    problems += validate.failures(rep, max_tris=contract.get('max_tris_intact'))
    if root is not None and intact.parent != root:
        problems.append(f'intact {intact.name} is not a child of {root.name}')
    extras_match(intact, contract.get('extras', {}).get('intact'), 'intact')
    if 'height_m' in contract:
        height = rep['max_m'][2] - rep['min_m'][2]
        tol = contract.get('height_tolerance_m', 0.003)
        if abs(height - contract['height_m']) > tol:
            problems.append(f'intact height {height:.4f} m, expected {contract["height_m"]} +- {tol}')
        if abs(rep['min_m'][2] - contract.get('base_m', 0.0)) > tol:
            problems.append(f'intact base at {rep["min_m"][2]:.4f} m, expected {contract.get("base_m", 0.0)}')
    intact_volume = rep['volume_m3'] or 0.0

if 'shard_prefix' in contract:
    prefix = contract['shard_prefix']
    shards = sorted((o for n, o in objects.items() if n.startswith(prefix)), key=lambda o: o.name)
    expected = [f'{prefix}{i:03d}' for i in range(contract.get('shard_count', len(shards)))]
    if [s.name for s in shards] != expected:
        problems.append(f'shards are {[s.name for s in shards][:4]}... ({len(shards)}), expected {len(expected)} named {expected[0]}..')
    total_tris = 0
    shard_volume = 0.0
    facts['shards'] = []
    for shard in shards:
        rep = validate.report(shard, within_shell=True, weld=WELD)
        facts['shards'].append({k: rep[k] for k in ('name', 'tris', 'components', 'volume_m3', 'self_intersections')})
        total_tris += rep['tris']
        shard_volume += rep['volume_m3'] or 0.0
        problems += validate.failures(rep)
        extras_match(shard, contract.get('extras', {}).get('shard'), 'shard')
        if root is not None and shard.parent != root:
            problems.append(f'shard {shard.name} is not a child of {root.name}')
        centre = scene.centroid(shard)
        if (centre - shard.matrix_world.translation).length > 0.003:
            problems.append(f'shard {shard.name}: origin {tuple(round(x, 4) for x in shard.matrix_world.translation)} '
                            f'is not at its centroid {tuple(round(x, 4) for x in centre)}')
    facts['shard_tris_total'] = total_tris
    if contract.get('max_tris_shards_total') and total_tris > contract['max_tris_shards_total']:
        problems.append(f'shards total {total_tris} tris, budget {contract["max_tris_shards_total"]}')
    if intact_volume > 0:
        ratio = shard_volume / intact_volume
        facts['shard_volume_ratio'] = round(ratio, 4)
        if abs(ratio - 1) > contract.get('volume_tolerance', 0.03):
            problems.append(f'shards hold {ratio:.3f} of the intact volume')

if 'collider' in contract:
    collider = need(contract['collider'], 'collider')
    if collider is not None:
        extras_match(collider, contract.get('extras', {}).get('collider'), 'collider')
        rep = validate.report(collider, intersections=False, weld=WELD)
        problems += [p for p in validate.failures(rep, uv=False)]
        facts['collider_size_m'] = rep['size_m']

result = {'source': src, 'pass': not problems, 'problems': problems, 'facts': facts}
if out_path:
    with open(out_path, 'w') as handle:
        json.dump(result, handle, indent=1, default=str)
for problem in problems:
    print('FAIL', problem)
print('VALIDATE', 'PASS' if not problems else f'FAIL ({len(problems)})')
if problems:
    raise SystemExit(1)
