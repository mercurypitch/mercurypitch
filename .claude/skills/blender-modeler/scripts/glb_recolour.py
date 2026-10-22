"""Recompute the vertex colours (COLOR_0) of some materials in a GLB without Blender.

    python3 -I glb_recolour.py IN.glb OUT.glb --material glass_shell \\
        --colour art/glass-adventure/procedural/opaline-echo-amphora/colours.py:opal_colour \\
        [--set OPAL_PUSH=1.8 --set OPAL_LIGHTNESS=5]

The colour function is the asset's own, the one `materials.paint_corners` painted
with: called with a point that has .x .y .z in Blender's Z-up world metres (and the
material's name too, if it takes two arguments), it returns sRGB 0..1. Its module
must import without Blender; keep an asset's colour functions in a `colours.py`
beside `build.py` (the pure colour maths is in `bkit.colour`). --set overrides a
module constant before painting, so one function serves a whole sweep.

Shards are painted at their place in the vessel (node transforms applied), as
`build.py` paints them. Vertex colours are per vertex here and per face corner in
Blender, so a recoloured file differs from a rebuilt one by a rounding (0.004 on the
urn). Serve the result with `runtime_proof.mjs`; settle the winner in the module.
"""

import argparse
import ast
import importlib.util
import inspect
import json
import math
import os
import struct
import sys
from types import SimpleNamespace

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
COMPONENTS = {5126: np.float32, 5121: np.uint8, 5123: np.uint16}


def load_function(spec, overrides):
    path, name = spec.rsplit(':', 1)
    sys.path[:0] = [HERE, os.path.dirname(os.path.abspath(path))]
    module_spec = importlib.util.spec_from_file_location(os.path.splitext(os.path.basename(path))[0], path)
    module = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(module)
    for item in overrides:
        key, value = item.split('=', 1)
        if not hasattr(module, key):
            raise SystemExit(f'{path} has no constant {key}')
        setattr(module, key, ast.literal_eval(value))  # numbers, tuples, strings: never code
    return getattr(module, name)


def node_matrices(gltf):
    """World matrix of every node, parents applied."""
    def local(node):
        if 'matrix' in node:
            return np.array(node['matrix'], dtype=float).reshape(4, 4).T
        t = np.eye(4)
        t[:3, 3] = node.get('translation', [0.0, 0.0, 0.0])
        x, y, z, w = node.get('rotation', [0.0, 0.0, 0.0, 1.0])
        r = np.eye(4)
        r[:3, :3] = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]
        s = np.diag(node.get('scale', [1.0, 1.0, 1.0]) + [1.0])
        return t @ r @ s
    world = {}

    def visit(i, parent):
        world[i] = parent @ local(gltf['nodes'][i])
        for child in gltf['nodes'][i].get('children', []):
            visit(child, world[i])
    children = {c for n in gltf['nodes'] for c in n.get('children', [])}
    for i in range(len(gltf['nodes'])):
        if i not in children:
            visit(i, np.eye(4))
    return world


def recolour(src, dst, materials, colour_at):
    data = bytearray(open(src, 'rb').read())
    length = struct.unpack('<I', data[12:16])[0]
    gltf = json.loads(data[20:20 + length])
    base = 28 + length
    takes_material = len(inspect.signature(colour_at).parameters) >= 2

    def view(index):
        a = gltf['accessors'][index]
        bv = gltf['bufferViews'][a['bufferView']]
        width = {'VEC3': 3, 'VEC4': 4}[a['type']]
        dtype = COMPONENTS[a['componentType']]
        assert bv.get('byteStride', 0) in (0, width * np.dtype(dtype).itemsize), 'interleaved buffers'
        offset = base + bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        return np.frombuffer(data, dtype, a['count'] * width, offset).reshape(a['count'], width)

    world, painted = node_matrices(gltf), 0
    for i, node in enumerate(gltf['nodes']):
        if 'mesh' not in node:
            continue
        for prim in gltf['meshes'][node['mesh']]['primitives']:
            name = gltf['materials'][prim['material']]['name'] if 'material' in prim else None
            if name not in materials or 'COLOR_0' not in prim['attributes']:
                continue
            pos = view(prim['attributes']['POSITION']).astype(float)
            pos = (np.c_[pos, np.ones(len(pos))] @ world[i].T)[:, :3]
            colours = view(prim['attributes']['COLOR_0'])
            out = []
            for x, y, z in pos:  # glTF Y-up to Blender Z-up
                p = SimpleNamespace(x=x, y=-z, z=y)
                out.append(colour_at(p, name) if takes_material else colour_at(p))
            out = np.clip(np.array(out, dtype=float), 0.0, 1.0)
            lin = np.where(out <= 0.04045, out / 12.92, ((out + 0.055) / 1.055) ** 2.4)
            if colours.dtype == np.float32:
                colours[:, :3] = lin
            else:
                colours[:, :3] = np.round(lin * np.iinfo(colours.dtype).max)
            painted += 1
    if not painted:
        raise SystemExit(f'no primitive of {sorted(materials)} carries COLOR_0 in {src}')
    open(dst, 'wb').write(data)
    return painted


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--material', action='append', required=True, help='material to repaint (repeatable)')
    ap.add_argument('--colour', required=True, help='path/to/module.py:function')
    ap.add_argument('--set', action='append', default=[], help='NAME=value: override a module constant')
    args = ap.parse_args()
    colour_at = load_function(args.colour, args.set)
    count = recolour(args.src, args.dst, set(args.material), colour_at)
    print(f'{args.dst}: repainted {count} primitives of {", ".join(args.material)}')


if __name__ == '__main__':
    main()
