"""Rebake the accepted remesh from its dense donor with a short, bounded cage.

Both sources receive the exact same transform. The game mesh is triangulated
before baking; its corner-normal basis and original UV atlas are then frozen.
Provider remesh textures are retained in sources for comparison, never reused.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--output", type=Path, required=True)
arguments = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = parser.parse_args(arguments).output.resolve()
if OUT == (ROOT / "baked").resolve():
    raise ValueError("Rebake into a new candidate directory; preserve the reviewed master.")
accepted = json.loads((ROOT / "production/accepted-inputs.json").read_text())
donor_receipts = {}
for name in ("dense", "quad60k"):
    relative = f"sources/camellia-crescent-{name}.glb"
    digest = hashlib.sha256((ROOT / relative).read_bytes()).hexdigest()
    if digest != accepted["files"][relative]["sha256"]:
        raise ValueError(f"Reviewed donor changed: {relative}")
    donor_receipts[relative] = digest
OUT.mkdir(parents=True, exist_ok=False)
bpy.ops.wm.read_factory_settings(use_empty=True)


def load(label):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / "sources" / f"camellia-crescent-{label}.glb"))
    objects = [obj for obj in bpy.data.objects if obj not in before]
    meshes = [obj for obj in objects if obj.type == "MESH"]
    assert len(meshes) == 1, "This production recipe expects one provider mesh."
    mesh = meshes[0]
    world = mesh.matrix_world.copy()
    mesh.parent = None
    mesh.data.transform(world)
    mesh.matrix_world.identity()
    for obj in objects:
        if obj != mesh:
            bpy.data.objects.remove(obj, do_unlink=True)
    mesh.name = label
    return mesh


high = load("dense")
low = load("quad60k")
minimum = Vector([min(v.co[i] for v in high.data.vertices) for i in range(3)])
maximum = Vector([max(v.co[i] for v in high.data.vertices) for i in range(3)])
scale = 1 / (maximum.x - minimum.x)
offset = Vector(((maximum.x + minimum.x) / 2, (maximum.y + minimum.y) / 2, minimum.z))
transform = Matrix.Scale(scale, 4) @ Matrix.Translation(-offset)
for obj in (high, low):
    obj.data.transform(transform)
    obj.data.update()

bpy.context.view_layer.objects.active = low
low.select_set(True)
high.select_set(False)
tri = low.modifiers.new("Frozen export triangles", "TRIANGULATE")
tri.keep_custom_normals = True
bpy.ops.object.modifier_apply(modifier=tri.name)
low.data.calc_loop_triangles()
low.data.calc_tangents(uvmap=low.data.uv_layers.active.name)

target = bpy.data.materials.new("Camellia ivory jade marble")
target.use_nodes = True
low.data.materials.clear()
low.data.materials.append(target)
for polygon in low.data.polygons:
    polygon.material_index = 0
nodes = target.node_tree.nodes
bsdf = nodes.get("Principled BSDF")
bsdf.inputs["Roughness"].default_value = .5
image_node = nodes.new("ShaderNodeTexImage")
nodes.active = image_node

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 8
scene.render.bake.use_selected_to_active = True
scene.render.bake.cage_extrusion = .0025
scene.render.bake.max_ray_distance = .008
scene.render.bake.margin = 16
scene.render.bake.use_clear = True
scene.render.bake.normal_space = "TANGENT"
high.select_set(True)
low.select_set(True)
bpy.context.view_layer.objects.active = low

source = high.data.materials[0]
source_nodes = source.node_tree.nodes
source_links = source.node_tree.links
source_output = next(n for n in source_nodes if n.type == "OUTPUT_MATERIAL")
source_bsdf = next(n for n in source_nodes if n.type == "BSDF_PRINCIPLED")
emission = source_nodes.new("ShaderNodeEmission")
emission.inputs["Strength"].default_value = 1
orm = source_nodes.new("ShaderNodeCombineColor")
orm.mode = "RGB"
orm.inputs[0].default_value = 1
for channel, slot in ((1, "Roughness"), (2, "Metallic")):
    socket = source_bsdf.inputs[slot]
    if socket.is_linked:
        source_links.new(socket.links[0].from_socket, orm.inputs[channel])
    else:
        orm.inputs[channel].default_value = socket.default_value

images = {}
for kind in ("base", "orm", "normal"):
    image = bpy.data.images.new(f"camellia-{kind}-2k", width=2048, height=2048, alpha=False)
    image.colorspace_settings.name = "sRGB" if kind == "base" else "Non-Color"
    image_node.image = image
    nodes.active = image_node
    if kind == "normal":
        source_links.new(source_bsdf.outputs["BSDF"], source_output.inputs["Surface"])
        bpy.ops.object.bake(type="NORMAL")
    else:
        source_links.new(emission.outputs[0], source_output.inputs["Surface"])
        if kind == "base":
            socket = source_bsdf.inputs["Base Color"]
            assert socket.is_linked
            source_links.new(socket.links[0].from_socket, emission.inputs["Color"])
        else:
            source_links.new(orm.outputs[0], emission.inputs["Color"])
        bpy.ops.object.bake(type="EMIT")
    image.filepath_raw = str(OUT / f"camellia-{kind}-2k.png")
    image.file_format = "PNG"
    image.save()
    image.pack()
    images[kind] = image
    print(f"BAKED {kind}", flush=True)

source_links.new(source_bsdf.outputs["BSDF"], source_output.inputs["Surface"])
target.node_tree.nodes.remove(image_node)
for kind, image in images.items():
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = image
    if kind == "base":
        target.node_tree.links.new(texture.outputs["Color"], bsdf.inputs["Base Color"])
    elif kind == "orm":
        separate = nodes.new("ShaderNodeSeparateColor")
        separate.mode = "RGB"
        target.node_tree.links.new(texture.outputs["Color"], separate.inputs[0])
        target.node_tree.links.new(separate.outputs[1], bsdf.inputs["Roughness"])
        target.node_tree.links.new(separate.outputs[2], bsdf.inputs["Metallic"])
    else:
        normal = nodes.new("ShaderNodeNormalMap")
        target.node_tree.links.new(texture.outputs["Color"], normal.inputs["Color"])
        target.node_tree.links.new(normal.outputs["Normal"], bsdf.inputs["Normal"])

# Keep donor and original maps in the packed authoring file, hidden from export.
high.hide_render = True
high.hide_set(True)
low.name = "Museum_Camellia_Planter"
low.select_set(True)
high.select_set(False)
bpy.context.view_layer.objects.active = low
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "camellia-crescent-rebaked.blend"))
bpy.ops.export_scene.gltf(filepath=str(OUT / "camellia-crescent-rebaked.glb"), export_format="GLB",
    use_selection=True, export_texcoords=True, export_normals=True, export_tangents=True,
    export_yup=True, export_animations=False)
report = dict(sourceTriangles=len(high.data.polygons), deliveryTriangles=len(low.data.loop_triangles),
    cageExtrusionMetres=.0025, maxRayDistanceMetres=.008, atlas=2048, margin=16,
    transform=[list(row) for row in transform], blender=bpy.app.version_string,
    sourceSha256=donor_receipts, scriptSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    outputSha256={path.name: hashlib.sha256(path.read_bytes()).hexdigest()
                  for path in OUT.iterdir() if path.is_file()})
(OUT / "bake-report.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report), flush=True)
