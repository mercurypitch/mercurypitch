"""Smoke render for preflight.sh: one Workbench and one Cycles frame must contain a lit object.

blender -b --factory-startup --python smoke_render.py -- OUT_DIR
Prints `SMOKE OK <engine> <seconds>` per engine and `SMOKE OK` when both pass.
"""
import math
import os
import sys
import time

import bpy

out = sys.argv[sys.argv.index('--') + 1]
assert bpy.app.version[:2] == (5, 2), f'expected Blender 5.2, got {bpy.app.version_string}'

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.mesh.primitive_monkey_add()
light = bpy.data.objects.new('key', bpy.data.lights.new('key', 'SUN'))
light.rotation_euler = (0.8, 0.2, 0.6)
scene.collection.objects.link(light)
camera = bpy.data.objects.new('camera', bpy.data.cameras.new('camera'))
camera.location = (0, -4, 1)
camera.rotation_euler = (math.radians(76), 0, 0)
scene.collection.objects.link(camera)
scene.camera = camera
scene.render.resolution_x = scene.render.resolution_y = 96
scene.world = bpy.data.worlds.new('world')

ok = True
for engine in ('BLENDER_WORKBENCH', 'CYCLES'):
    scene.render.engine = engine
    if engine == 'CYCLES':
        scene.cycles.device = 'CPU'
        scene.cycles.samples = 4
    path = os.path.join(out, f'{engine}.png')
    scene.render.filepath = path
    started = time.time()
    try:
        bpy.ops.render.render(write_still=True)
        pixels = list(bpy.data.images.load(path).pixels)
        lums = [sum(pixels[i:i + 3]) / 3 for i in range(0, len(pixels), 4)]
        spread = max(lums) - min(lums)
        if spread < 0.05:
            raise RuntimeError(f'flat image (spread {spread:.3f})')
        print(f'SMOKE OK {engine} {time.time() - started:.1f}s')
    except Exception as error:  # report, keep checking the other engine
        ok = False
        print(f'SMOKE FAIL {engine} {error}')
if ok:
    print('SMOKE OK')
