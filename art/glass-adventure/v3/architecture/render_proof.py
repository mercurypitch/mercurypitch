"""Render an actual donor/source with a repeatable studio rig; no replacement model."""
import argparse
from pathlib import Path
import sys
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--blend", "--source", dest="source", type=Path, required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--views", default="three-quarter,back,capital")
    parser.add_argument("--wide", action="store_true", help="Frame a complete architectural assembly in landscape")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    if not args.name.replace("-", "").isalnum(): raise ValueError("Use an alphanumeric output name")
    if args.source.suffix.lower() == ".glb":
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(args.source.resolve()))
    else:
        bpy.ops.wm.open_mainfile(filepath=str(args.source.resolve()))
    scene = bpy.context.scene
    meshes = [o for o in scene.objects if o.type == "MESH"]
    bounds = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    lo = Vector(tuple(min(p[i] for p in bounds) for i in range(3)))
    hi = Vector(tuple(max(p[i] for p in bounds) for i in range(3)))
    pivot = Vector(((lo.x + hi.x)/2, (lo.y + hi.y)/2, lo.z))
    scale = 3 / (hi.z - lo.z)
    # Uniform presentation normalization only; the source .blend is never saved here.
    for o in meshes:
        world = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = world
        o.location = (o.location - pivot) * scale
        o.scale *= scale
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 4
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "AgX"
    scene.world = bpy.data.worlds.new("Proof neutral world")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.19, 0.205, 0.22, 1)
    background.inputs["Strength"].default_value = 0.6
    for name, position, power, color, size in [
        ("Warm key", (-3,-4,6), 700, (1,.91,.8), 4),
        ("Cool fill", (3,-1,3), 450, (.76,.87,1), 3),
        ("Rim", (1,4,5), 700, (1,.93,.84), 3),
    ]:
        data = bpy.data.lights.new(name, "AREA"); data.energy = power; data.color = color; data.shape = "DISK"; data.size = size
        obj = bpy.data.objects.new(name, data); scene.collection.objects.link(obj); obj.location = position
        obj.rotation_euler = (Vector((0,0,1.5)) - obj.location).to_track_quat("-Z", "Y").to_euler()
    data = bpy.data.cameras.new("Proof camera"); data.type = "ORTHO"
    camera = bpy.data.objects.new("Proof camera", data); scene.collection.objects.link(camera); scene.camera = camera
    views = {
        "three-quarter": ((4,-6,3.4),(0,0,1.5),3.65,(768,1024)),
        "front": ((0,-7,1.5),(0,0,1.5),3.55,(768,1024)),
        "back": ((-4,6,3.4),(0,0,1.5),3.65,(768,1024)),
        "capital": ((3,-5,3.35),(0,0,2.68),1.13,(1024,768)),
    }
    if args.wide:
        span = max(5.9, (hi.x-lo.x)*scale*1.22)
        views.update({
            "three-quarter": ((3,-9,3.8),(0,0,1.5),span,(1280,800)),
            "front": ((0,-9,1.5),(0,0,1.5),span,(1280,800)),
            "back": ((-3,9,3.8),(0,0,1.5),span,(1280,800)),
            "top": ((0,-0.01,9),(0,0,1.3),span,(1024,1024)),
        })
    output = HERE / "proofs"; output.mkdir(parents=True, exist_ok=True)
    for name in args.views.split(","):
        position, target, size, resolution = views[name]
        camera.location = position
        camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z","Y").to_euler()
        data.ortho_scale = size
        scene.render.resolution_x, scene.render.resolution_y = resolution
        scene.render.filepath = str(output / f"{args.name}-{name}.png")
        bpy.ops.render.render(write_still=True)
        print("V3_ARCHITECTURE_PROOF " + scene.render.filepath)

if __name__ == "__main__": main()
