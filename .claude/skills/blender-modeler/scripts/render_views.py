"""Render the panels of a contact sheet for a GLB or .blend.

blender -b --factory-startup --python render_views.py -- IN OUT_DIR [options]
  --modes clay,zebra,wire,material,ids,matids,game   (default clay,zebra,wire,material)
  --views three_quarter,front,side,top,low     (default three_quarter,front,top)
  --res 400 --samples 32 --hide REGEX --show-shards

Modes: clay = Workbench studio light with cavity (form); zebra = horizontal
reflection-stripe matcap (broken or wobbling stripes mean dents or broken
curvature); wire = Cycles wireframe override (topology); material = Cycles with
the asset's materials under a gradient studio world; ids = one flat colour per
part, Raw view transform, no anti-aliasing (joins and detached parts); matids =
the same flat look with one colour per material, legend in meta.json (is every
band, cuff and lining the material it should be, and nothing else); game = a
material render at 128 px, enlarged without smoothing (what a phone shows).
Collision proxies (COLLIDER_* or extras.collision_proxy) are always hidden.
Writes OUT_DIR/<mode>_<view>.png and OUT_DIR/meta.json for compose_sheet.py.
"""

import colorsys
import json
import math
import os
import re
import sys
import time

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
src, out_dir = argv[0], argv[1]


def opt(flag, default):
    return argv[argv.index(flag) + 1] if flag in argv else default


res = int(opt('--res', 400))
samples = int(opt('--samples', 32))
modes = opt('--modes', 'clay,zebra,wire,material').split(',')
views = opt('--views', 'three_quarter,front,top').split(',')
hide_re = re.compile(opt('--hide', r'(?!x)x'), re.I)
show_shards = '--show-shards' in argv
os.makedirs(out_dir, exist_ok=True)

if src.endswith('.blend'):
    bpy.ops.wm.open_mainfile(filepath=src)
else:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
scene = bpy.context.scene
scene.view_settings.view_transform = 'Standard'

meshes = [o for o in scene.objects if o.type == 'MESH']
proxies = [o for o in meshes if o.name.upper().startswith('COLLIDER') or o.get('collision_proxy')]
shards = [o for o in meshes if '_shard_' in o.name.lower()]
others = [o for o in meshes if o not in proxies and o not in shards]
hidden = set(proxies) | {o for o in meshes if hide_re.search(o.name)}
if others and not show_shards:
    hidden |= set(shards)
for o in scene.objects:
    if o.type in {'LIGHT', 'CAMERA'}:
        hidden.add(o)
for o in hidden:
    o.hide_render = True
visible = [o for o in meshes if o not in hidden]

lo = Vector((1e9,) * 3)
hi = Vector((-1e9,) * 3)
tris = 0
for o in visible:
    for corner in o.bound_box:
        world = o.matrix_world @ Vector(corner)
        lo = Vector(map(min, lo, world))
        hi = Vector(map(max, hi, world))
    tris += sum(len(p.vertices) - 2 for p in o.data.polygons)
center = (lo + hi) / 2
dims = hi - lo
diag = dims.length

scene.render.resolution_x = scene.render.resolution_y = res
scene.render.resolution_percentage = 100
scene.render.film_transparent = False
world = bpy.data.worlds.new('sheet_world')
scene.world = world
world.color = (0.30, 0.33, 0.36)
cam_data = bpy.data.cameras.new('sheet_cam')
cam = bpy.data.objects.new('sheet_cam', cam_data)
scene.collection.objects.link(cam)
scene.camera = cam


def place_camera(view):
    far = diag * 4 + 1
    cam_data.clip_start = max(diag * 0.001, 1e-4)
    cam_data.clip_end = far * 4
    if view in ('three_quarter', 'low'):
        cam_data.type = 'PERSP'
        cam_data.lens = 40
        cam_data.sensor_width = 36
        fov = 2 * math.atan(18 / 40)
        distance = (0.5 * diag) / math.sin(fov / 2) * 1.02
        direction = Vector((1.0, -1.3, 0.8 if view == 'three_quarter' else 0.12)).normalized()
        cam.location = center + direction * distance
        cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()
        return distance
    cam_data.type = 'ORTHO'
    if view == 'front':
        cam.location = center + Vector((0, -far, 0))
        cam.rotation_euler = (math.pi / 2, 0, 0)
        cam_data.ortho_scale = max(dims.x, dims.z) * 1.12
    elif view == 'side':
        cam.location = center + Vector((far, 0, 0))
        cam.rotation_euler = (math.pi / 2, 0, math.pi / 2)
        cam_data.ortho_scale = max(dims.y, dims.z) * 1.12
    elif view == 'top':
        cam.location = center + Vector((0, 0, far))
        cam.rotation_euler = (0, 0, 0)
        cam_data.ortho_scale = max(dims.x, dims.y) * 1.12
    return diag * 1.6


legend = {}


def workbench(mode):
    flat = mode in ('ids', 'matids')
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.view_settings.view_transform = 'Raw' if flat else 'Standard'
    shading = scene.display.shading
    shading.show_object_outline = False
    shading.show_specular_highlight = not flat
    shading.show_shadows = False
    if mode == 'clay':
        shading.light = 'STUDIO'
        shading.color_type = 'SINGLE'
        shading.single_color = (0.78, 0.78, 0.78)
        shading.show_cavity = True
        shading.cavity_type = 'BOTH'
        shading.cavity_ridge_factor = shading.cavity_valley_factor = 1.0
        shading.curvature_ridge_factor = shading.curvature_valley_factor = 1.0
    elif mode == 'zebra':
        shading.light = 'MATCAP'
        shading.color_type = 'SINGLE'
        shading.show_cavity = False
        shading.studio_light = 'check_reflection_horizontal.exr'
    elif mode == 'ids':
        shading.light = 'FLAT'
        shading.color_type = 'OBJECT'
        shading.show_cavity = False
        for k, o in enumerate(sorted(visible, key=lambda x: x.name)):
            r, g, b = colorsys.hsv_to_rgb((k * 0.61803) % 1.0, 0.75, 0.95)
            o.color = (r, g, b, 1)
    else:  # matids: flat colour per material slot; viewport colours only, Cycles is unaffected
        shading.light = 'FLAT'
        shading.color_type = 'MATERIAL'
        shading.show_cavity = False
        used = sorted({slot.material.name for o in visible for slot in o.material_slots if slot.material})
        for k, name in enumerate(used):
            r, g, b = colorsys.hsv_to_rgb((0.08 + k * 0.61803) % 1.0, 0.8, 0.95)
            bpy.data.materials[name].diffuse_color = (r, g, b, 1)
            legend[name] = '#%02x%02x%02x' % tuple(round(c * 255) for c in (r, g, b))
    scene.display.render_aa = 'OFF' if flat else '8'
    scene.view_layers[0].material_override = None


def gradient_world():
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    output = nt.nodes.new('ShaderNodeOutputWorld')
    background = nt.nodes.new('ShaderNodeBackground')
    coords = nt.nodes.new('ShaderNodeTexCoord')
    split = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    nt.links.new(coords.outputs['Generated'], split.inputs['Vector'])
    nt.links.new(split.outputs['Z'], ramp.inputs['Fac'])
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[0].color = (0.05, 0.05, 0.06, 1)
    ramp.color_ramp.elements.new(0.5).color = (0.95, 0.93, 0.9, 1)
    ramp.color_ramp.elements[-1].position = 0.9
    ramp.color_ramp.elements[-1].color = (0.32, 0.42, 0.55, 1)
    nt.links.new(ramp.outputs['Color'], background.inputs['Color'])
    nt.links.new(background.outputs['Background'], output.inputs['Surface'])


wire_material = None
key_light = None


def cycles(mode, distance):
    global wire_material, key_light
    scene.render.engine = 'CYCLES'
    scene.view_settings.view_transform = 'Standard'
    c = scene.cycles
    c.device = 'CPU'
    c.samples = samples if mode in ('material', 'game') else max(12, samples // 2)
    c.use_denoising = True
    c.use_adaptive_sampling = True
    c.max_bounces = 12
    c.transmission_bounces = 12
    c.transparent_max_bounces = 16
    c.glossy_bounces = 6
    gradient_world()
    if key_light is None:
        key_light = bpy.data.objects.new('sheet_key', bpy.data.lights.new('sheet_key', 'AREA'))
        scene.collection.objects.link(key_light)
    key_light.data.size = max(diag, 0.2)
    direction = Vector((-0.7, -1.0, 1.3)).normalized()
    key_light.location = center + direction * distance * 1.1
    key_light.rotation_euler = (center - key_light.location).to_track_quat('-Z', 'Y').to_euler()
    key_light.data.energy = 60.0 * (distance * 1.1) ** 2
    if mode == 'wire':
        if wire_material is None:
            wire_material = bpy.data.materials.new('sheet_wire')
            nt = wire_material.node_tree
            nt.nodes.clear()
            output = nt.nodes.new('ShaderNodeOutputMaterial')
            wire = nt.nodes.new('ShaderNodeWireframe')
            wire.use_pixel_size = True
            wire.inputs['Size'].default_value = 1.0
            diffuse = nt.nodes.new('ShaderNodeBsdfDiffuse')
            diffuse.inputs['Color'].default_value = (0.75, 0.75, 0.75, 1)
            line = nt.nodes.new('ShaderNodeEmission')
            line.inputs['Color'].default_value = (0.02, 0.05, 0.09, 1)
            mix = nt.nodes.new('ShaderNodeMixShader')
            nt.links.new(wire.outputs['Fac'], mix.inputs['Fac'])
            nt.links.new(diffuse.outputs['BSDF'], mix.inputs[1])
            nt.links.new(line.outputs['Emission'], mix.inputs[2])
            nt.links.new(mix.outputs['Shader'], output.inputs['Surface'])
        scene.view_layers[0].material_override = wire_material
    else:
        scene.view_layers[0].material_override = None


panels = []
started = time.time()
for view in views:
    distance = place_camera(view)
    for mode in modes:
        if mode in ('clay', 'zebra', 'ids', 'matids'):
            workbench(mode)
        else:
            cycles(mode, distance if view in ('three_quarter', 'low') else diag * 1.6)
        path = os.path.join(out_dir, f'{mode}_{view}.png')
        scene.render.filepath = path
        if mode == 'game':
            scene.render.resolution_x = scene.render.resolution_y = 128
        t = time.time()
        bpy.ops.render.render(write_still=True)
        scene.render.resolution_x = scene.render.resolution_y = res
        panels.append({'mode': mode, 'view': view, 'path': path, 'seconds': round(time.time() - t, 2)})

meta = {'source': src, 'visibleObjects': len(visible), 'hiddenShards': len([o for o in hidden if o in shards]),
        'hiddenProxies': len(proxies), 'tris': tris, 'dims_m': [round(x, 3) for x in dims], 'panels': panels,
        'materialColours': legend,
        'seconds': round(time.time() - started, 1)}
with open(os.path.join(out_dir, 'meta.json'), 'w') as handle:
    json.dump(meta, handle, indent=1)
print('RENDER_VIEWS_DONE', out_dir, meta['seconds'])
