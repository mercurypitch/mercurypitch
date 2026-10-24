"""Render a model's flat silhouette mask from the reference camera angle.

blender -b --factory-startup --python silhouette_render.py -- IN OUT.png [--elevation 8] [--azimuth 0]
        [--res 1024] [--hide REGEX]

Orthographic, white object on black, looking along +Y (the front view) and
tilted down by --elevation degrees to match a concept shot from slightly above.
Measure the elevation from the reference: a horizontal circle of radius r that
appears as an ellipse with half-height b was seen from asin(b / r) degrees.
Collision proxies and shards are hidden, as in render_views.py.
"""

import math
import re
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
src, out = argv[0], argv[1]


def opt(flag, default):
    return argv[argv.index(flag) + 1] if flag in argv else default


elevation = math.radians(float(opt('--elevation', 0)))
azimuth = math.radians(float(opt('--azimuth', 0)))
res = int(opt('--res', 1024))
hide_re = re.compile(opt('--hide', r'(?!x)x'), re.I)

if src.endswith('.blend'):
    bpy.ops.wm.open_mainfile(filepath=src)
else:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
scene = bpy.context.scene
meshes = [o for o in scene.objects if o.type == 'MESH']
shards = [o for o in meshes if '_shard_' in o.name.lower()]
keep_shards = len(shards) == len([o for o in meshes if not o.name.upper().startswith('COLLIDER')])
visible = []
for o in scene.objects:
    hide = (o.type != 'MESH' or o.name.upper().startswith('COLLIDER') or o.get('collision_proxy')
            or (o in shards and not keep_shards) or hide_re.search(o.name))
    o.hide_render = bool(hide)
    if not hide:
        visible.append(o)

lo = Vector((1e9,) * 3)
hi = Vector((-1e9,) * 3)
for o in visible:
    for corner in o.bound_box:
        world = o.matrix_world @ Vector(corner)
        lo = Vector(map(min, lo, world))
        hi = Vector(map(max, hi, world))
centre = (lo + hi) / 2
size = (hi - lo).length

scene.render.engine = 'BLENDER_WORKBENCH'
scene.view_settings.view_transform = 'Standard'
shading = scene.display.shading
shading.light = 'FLAT'
shading.color_type = 'SINGLE'
shading.single_color = (1, 1, 1)
shading.show_cavity = False
shading.show_shadows = False
shading.show_specular_highlight = False
scene.display.render_aa = '8'
scene.world = bpy.data.worlds.new('mask_world')
scene.world.color = (0, 0, 0)
scene.render.resolution_x = scene.render.resolution_y = res
scene.render.film_transparent = False

cam = bpy.data.objects.new('mask_cam', bpy.data.cameras.new('mask_cam'))
scene.collection.objects.link(cam)
scene.camera = cam
cam.data.type = 'ORTHO'
cam.data.ortho_scale = size * 1.05
direction = Vector((math.sin(azimuth) * math.cos(elevation), -math.cos(azimuth) * math.cos(elevation), math.sin(elevation)))
cam.location = centre + direction * size * 4
cam.rotation_euler = (centre - cam.location).to_track_quat('-Z', 'Y').to_euler()
cam.data.clip_end = size * 10
scene.render.filepath = out
bpy.ops.render.render(write_still=True)
print('SILHOUETTE_DONE', out)
