"""Measure the Meshy donor's proportions: body radius by height and the handle centreline.

blender -b --factory-startup --python measure_donor.py -- DONOR.glb OUT.json
The donor followed the concept's proportions well (silhouette IoU 0.945) but its
surface is lumpy, so it is used only as a measured reference: radius is taken
across the depth axis (Y), where the handles at +-X do not reach, and the
numbers are smoothed before any control point is fitted to them.
"""
import json
import sys

import bmesh
import bpy

argv = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=argv[0])
intact = next(o for o in bpy.context.scene.objects if o.name.endswith('_intact'))
bm = bmesh.new()
bm.from_mesh(intact.data)
bm.transform(intact.matrix_world)
bmesh.ops.triangulate(bm, faces=bm.faces)
tris = [[v.co.copy() for v in f.verts] for f in bm.faces]
zmin = min(v.co.z for v in bm.verts)
zmax = max(v.co.z for v in bm.verts)


def crossings(z):
    pts = []
    for tri in tris:
        for a, b in ((tri[0], tri[1]), (tri[1], tri[2]), (tri[2], tri[0])):
            if (a.z - z) * (b.z - z) < 0:
                t = (z - a.z) / (b.z - a.z)
                pts.append(a.lerp(b, t))
    return pts


body = []
handle = []
for k in range(1, 120):
    z = zmin + (zmax - zmin) * k / 120
    pts = crossings(z)
    if not pts:
        continue
    r_body = max(abs(p.y) for p in pts)
    near_plane = [p for p in pts if abs(p.y) < 0.012]
    right = sorted(p.x for p in near_plane if p.x > r_body + 0.004)
    entry = {'z': round(z, 4), 'r': round(r_body, 4)}
    body.append(entry)
    if right:
        handle.append({'z': round(z, 4), 'x_in': round(right[0], 4), 'x_out': round(right[-1], 4)})
json.dump({'zmin': zmin, 'zmax': zmax, 'body': body, 'handle_right': handle}, open(argv[1], 'w'), indent=1)
print('DONOR', round(zmin, 4), round(zmax, 4), len(body), len(handle))
