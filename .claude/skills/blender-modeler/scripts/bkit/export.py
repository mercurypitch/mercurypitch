"""glTF export with settings that do not silently drop work, plus GLB inspection.

The Blender 5.2 exporter defaults `export_apply` to False, which drops every
modifier (bevels, weighted normals, solidify) from the file. This module always
sets it, exports custom properties as node extras (the game reads roles and
collider flags from them), and never exports cameras or lights.
"""

import json
import os
import struct

import bpy


def glb(path, objects, *, tangents=False):
    """Export exactly `objects` (and their parents' hierarchy) to a binary glTF."""
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    for obj in bpy.context.scene.objects:
        obj.select_set(obj in objects)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_extras=True,
        export_texcoords=True,
        export_normals=True,
        export_tangents=tangents,
        export_materials='EXPORT',
        export_cameras=False,
        export_lights=False,
        export_animations=False,
    )
    return path


def read_json(path):
    """The JSON chunk of a .glb file."""
    with open(path, 'rb') as handle:
        data = handle.read()
    if data[:4] != b'glTF':
        raise ValueError(f'{path} is not a GLB (a Git LFS pointer reads like this)')
    length = struct.unpack('<I', data[12:16])[0]
    return json.loads(data[20:20 + length])


def summary(path):
    doc = read_json(path)
    meshes = doc.get('meshes', [])
    accessors = doc.get('accessors', [])

    def tris(mesh):
        total = 0
        for prim in mesh['primitives']:
            if 'indices' in prim:
                total += accessors[prim['indices']]['count'] // 3
            else:
                total += accessors[prim['attributes']['POSITION']]['count'] // 3
        return total

    nodes = []
    for node in doc.get('nodes', []):
        entry = {'name': node.get('name'), 'extras': node.get('extras')}
        if 'mesh' in node:
            entry['tris'] = tris(meshes[node['mesh']])
        if 'translation' in node:
            entry['translation'] = node['translation']
        nodes.append(entry)
    return {
        'bytes': os.path.getsize(path),
        'extensionsUsed': doc.get('extensionsUsed', []),
        'materials': [m.get('name') for m in doc.get('materials', [])],
        'nodes': nodes,
    }
