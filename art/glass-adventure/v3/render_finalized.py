"""Render actual finalized Meshy geometry and its expanded fracture assembly."""
import argparse
import json
from pathlib import Path
import sys

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--name', required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
directory = HERE / 'donors' / args.name
manifest = json.loads((directory / 'finalization.json').read_text())
bpy.ops.wm.open_mainfile(filepath=str(directory / 'finalized.blend'))
intact = bpy.data.objects[manifest['intact']]
shards = [bpy.data.objects[name] for name in manifest['shards']]
for shard in shards:
    shard.hide_render = True
intact.hide_render = False
bounds = manifest['meshes'][0]['bounds']
height = bounds['max'][1] - bounds['min'][1]
width = max(bounds['max'][0]-bounds['min'][0], bounds['max'][2]-bounds['min'][2])
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.cycles.transmission_bounces = 16
scene.render.resolution_x = 1000
scene.render.resolution_y = 1200
scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new('finalization_review_world')
scene.world.use_nodes = True
background = scene.world.node_tree.nodes.get('Background')
background.inputs[0].default_value = (.032, .043, .049, 1)
background.inputs[1].default_value = .5
for name, position, power, color in [('key', (-2, -3, 4), 400, (1, .89, .72)),
                                      ('fill', (3, -1, 2), 260, (.70, .90, 1)),
                                      ('rim', (0, 3, 3), 600, (1, .95, .84))]:
    light = bpy.data.lights.new(name, 'AREA')
    light.energy = power * height * height
    light.shape = 'RECTANGLE'
    light.size = height * 2
    light.size_y = height * .3
    light.color = color
    obj = bpy.data.objects.new(name, light)
    scene.collection.objects.link(obj)
    obj.location = Vector(position) * height
    obj.rotation_euler = (Vector((0, 0, height*.5)) - obj.location).to_track_quat('-Z', 'Y').to_euler()
bpy.ops.mesh.primitive_plane_add(size=height*200, location=(0, 0, -.01*height))
floor = bpy.context.object
material = bpy.data.materials.new('review_floor')
material.use_nodes = True
shader = material.node_tree.nodes.get('Principled BSDF')
shader.inputs['Base Color'].default_value = (.035, .046, .054, 1)
shader.inputs['Roughness'].default_value = .34
floor.data.materials.append(material)
bpy.ops.object.camera_add(location=(height*1.5, -height*3, height*1.2))
camera = bpy.context.object
camera.rotation_euler = (Vector((0, 0, height*.5)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = max(height*1.3, width*1.5)
scene.camera = camera
scene.view_settings.view_transform = 'AgX'
scene.render.filepath = str(directory / 'finalized-intact.png')
bpy.ops.render.render(write_still=True)
intact.hide_render = True
for shard in shards:
    shard.hide_render = False
    centre = sum((shard.matrix_world @ vertex.co for vertex in shard.data.vertices), Vector()) / len(shard.data.vertices)
    shard.location += Vector((centre.x*.4, centre.y*.4, (centre.z-height*.45)*.18))
camera.data.ortho_scale *= 1.14
scene.render.filepath = str(directory / 'finalized-fracture.png')
bpy.ops.render.render(write_still=True)
print('MESHY_DONOR_RENDERED=' + args.name)
