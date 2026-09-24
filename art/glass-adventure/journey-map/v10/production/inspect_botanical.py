"""Fresh-import matched clay/PBR review; packed source preserves provider geometry and maps."""
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
variant = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "dense"
source = ROOT / ("baked" if variant == "rebaked" else "sources") / f"camellia-crescent-{variant}.glb"
proofs = ROOT / "proofs"
proofs.mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
coords = [obj.matrix_world @ Vector(v) for obj in meshes for v in obj.bound_box]
minimum = Vector([min(v[i] for v in coords) for i in range(3)])
maximum = Vector([max(v[i] for v in coords) for i in range(3)])
scale = 1 / (maximum.x - minimum.x)
offset = Vector(((minimum.x + maximum.x)/2, (minimum.y + maximum.y)/2, minimum.z))
root = bpy.data.objects.new("Museum_Camellia_Planter", None)
bpy.context.scene.collection.objects.link(root)
for obj in meshes:
    matrix = obj.matrix_world.copy()
    obj.parent = None
    for vertex in obj.data.vertices:
        vertex.co = (matrix @ vertex.co - offset) * scale
    obj.matrix_world.identity()
    obj.parent = root
    obj.name = "Camellia_Leaves_Flowers_Marble"
    obj.data.calc_loop_triangles()
saved_materials = {obj.name: list(obj.data.materials) for obj in meshes}
report = dict(variant=variant, source=str(source.relative_to(ROOT)), widthMetres=1,
    originalBounds=[list(minimum),list(maximum)], meshes=len(meshes),
    triangles=sum(len(obj.data.loop_triangles) for obj in meshes),
    vertices=sum(len(obj.data.vertices) for obj in meshes),
    textureImages=[dict(name=i.name,size=list(i.size),colorSpace=i.colorspace_settings.name) for i in bpy.data.images],
    blender=bpy.app.version_string)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "sources" / f"camellia-crescent-{variant}.blend"))
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.resolution_x = 1000
scene.render.resolution_y = 850
scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new("Botanical studio")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs[0].default_value = (.12,.16,.16,1)
scene.world.node_tree.nodes["Background"].inputs[1].default_value = .45
scene.view_settings.view_transform = "AgX"
bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,-.001))
floor = bpy.context.object
floor.name = "Studio floor"
mat = bpy.data.materials.new("Studio matte ivory");mat.diffuse_color = (.42,.47,.43,1)
floor.data.materials.append(mat)
for at,power,size in [((1,-2,3),240,2),((-2,-.4,1.5),120,2),((0,2,3),300,1.5)]:
    bpy.ops.object.light_add(type="AREA",location=at)
    light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size
    light.rotation_euler=(Vector((0,0,.25))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add()
camera=bpy.context.object;scene.camera=camera;camera.data.type="ORTHO";camera.data.ortho_scale=1.42
clay=bpy.data.materials.new("Neutral clay");clay.use_nodes=True
bsdf=clay.node_tree.nodes.get("Principled BSDF");bsdf.inputs["Base Color"].default_value=(.48,.48,.48,1);bsdf.inputs["Roughness"].default_value=.72
for look in ["pbr","clay"]:
    for obj in meshes:
        obj.data.materials.clear()
        for material in saved_materials[obj.name] if look=="pbr" else [clay]:obj.data.materials.append(material)
    for view,position in [("front",(0,-2,.9)),("angle",(1.2,-1.8,1.6))]:
        camera.location=position;camera.rotation_euler=(Vector((0,0,.20))-camera.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(proofs/f"{variant}-{look}-{view}.png")
        bpy.ops.render.render(write_still=True)
(ROOT/"production"/f"{variant}-inspection.json").write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report),flush=True)
