"""Triangle quality of a GLB, per node kind and material, without Blender.

    python3 -I glb_triangles.py asset.glb [--angle 2] [--where]

For the intact node, the shards and anything else (colliders are skipped), prints
the triangle count, the slivers (smallest angle under --angle degrees) and the
zero-area triangles, each per material. --where lists where the slivers sit
(height and radius, Blender Z-up, rounded), which is how the amphora's 182 slivers
turned out to be two 2 mm corner rings on a gold band and a hidden 1 mm foot ring
(`lessons.md`): a ring much thinner than its segment is wide is always a sliver.
"""

import argparse
import json
import struct
from collections import Counter, defaultdict

import numpy as np

COMPONENTS = {5126: np.float32, 5121: np.uint8, 5123: np.uint16, 5125: np.uint32}
WIDTH = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


def load(path):
    data = open(path, 'rb').read()
    length = struct.unpack('<I', data[12:16])[0]
    return json.loads(data[20:20 + length]), data, 28 + length


def accessor(gltf, data, base, index):
    a = gltf['accessors'][index]
    view = gltf['bufferViews'][a['bufferView']]
    width = WIDTH[a['type']]
    offset = base + view.get('byteOffset', 0) + a.get('byteOffset', 0)
    values = np.frombuffer(data, COMPONENTS[a['componentType']], a['count'] * width, offset)
    return values.reshape(a['count'], width) if width > 1 else values


def smallest_angles(tris):
    def angle(a, b, c):
        u, v = b - a, c - a
        cos = (u * v).sum(1) / (np.linalg.norm(u, axis=1) * np.linalg.norm(v, axis=1) + 1e-30)
        return np.degrees(np.arccos(np.clip(cos, -1, 1)))
    a, b, c = tris[:, 0], tris[:, 1], tris[:, 2]
    return np.minimum(np.minimum(angle(a, b, c), angle(b, c, a)), angle(c, a, b))


def report(path, limit=2.0, where=False):
    gltf, data, base = load(path)
    totals, slivers, zero = Counter(), defaultdict(Counter), defaultdict(Counter)
    spots = defaultdict(Counter)
    for node in gltf['nodes']:
        if 'mesh' not in node or node.get('name', '').startswith('COLLIDER'):
            continue
        name = node.get('name', '')
        kind = 'intact' if name.endswith('_intact') else 'shard' if '_shard_' in name else name or 'mesh'
        offset = np.array(node.get('translation', [0.0, 0.0, 0.0]))
        for prim in gltf['meshes'][node['mesh']]['primitives']:
            pos = accessor(gltf, data, base, prim['attributes']['POSITION']).astype(float) + offset
            idx = accessor(gltf, data, base, prim['indices']).reshape(-1, 3)
            tris = pos[idx]
            material = gltf['materials'][prim['material']]['name'] if 'material' in prim else '-'
            small = smallest_angles(tris)
            area = 0.5 * np.linalg.norm(np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0]), axis=1)
            totals[kind] += len(tris)
            slivers[kind][material] += int((small < limit).sum())
            zero[kind][material] += int((area < 1e-10).sum())
            if where:
                for c in tris[small < limit].mean(1):  # glTF Y-up: height is y, radius in x-z
                    spots[(kind, material)][(round(float(c[1]), 3), round(float(np.hypot(c[0], c[2])), 2))] += 1
    for kind in totals:
        s, z = sum(slivers[kind].values()), sum(zero[kind].values())
        print(f'{kind}: {totals[kind]} triangles, {s} under {limit:g} degrees, {z} zero-area')
        for material in sorted(set(slivers[kind]) | set(zero[kind])):
            if slivers[kind][material] or zero[kind][material]:
                print(f'   {material:18s} slivers {slivers[kind][material]:5d}   zero-area {zero[kind][material]}')
    if where:
        for (kind, material), places in sorted(spots.items()):
            print(f'{kind} {material}:', ', '.join(f'z {z} r {r} x{n}' for (z, r), n in places.most_common(8)))
    return totals, slivers, zero


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('glb')
    ap.add_argument('--angle', type=float, default=2.0)
    ap.add_argument('--where', action='store_true')
    args = ap.parse_args()
    report(args.glb, args.angle, args.where)


if __name__ == '__main__':
    main()
