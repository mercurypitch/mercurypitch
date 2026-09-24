"""Render CPU-only same-camera textured comparisons of V6 and the V7 provider candidate."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


HERE = Path(__file__).resolve().parent
ART = HERE.parent
V6 = ART.parent / "v6" / "meshy" / "twin-connector-final.glb"
V7 = ART / "meshy" / "twin-connector-remesh-100k-retexture-pbr.glb"
FRONT = ART / "proofs" / "twin-connector-textured-comparison-front-v7.png"
ANGLE = ART / "proofs" / "twin-connector-textured-comparison-angle-v7.png"
CLOSE = ART / "proofs" / "twin-connector-textured-comparison-close-v7.png"
MANIFEST = ART / "proofs" / "twin-connector-textured-comparison-v7.json"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points = [
        obj.matrix_world @ vertex.co
        for obj in objects
        for vertex in obj.data.vertices
    ]
    return (
        Vector(min(point[axis] for point in points) for axis in range(3)),
        Vector(max(point[axis] for point in points) for axis in range(3)),
    )


def import_normalized(name: str, path: Path, offset_x: float) -> dict[str, object]:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    meshes = [obj for obj in imported if obj.type == "MESH"]
    if not meshes:
        raise ValueError(f"{path.name} has no mesh")
    low, high = bounds(meshes)
    scale = 2.80 / (high.z - low.z)
    center_x = (low.x + high.x) * 0.5
    center_y = (low.y + high.y) * 0.5
    triangles = 0
    for obj in meshes:
        world = obj.matrix_world.copy()
        obj.parent = None
        obj.data = obj.data.copy()
        obj.data.transform(world)
        obj.matrix_world = Matrix.Identity(4)
        for vertex in obj.data.vertices:
            vertex.co.x = (vertex.co.x - center_x) * scale + offset_x
            vertex.co.y = (vertex.co.y - center_y) * scale
            vertex.co.z = (vertex.co.z - low.z) * scale
        obj.name = name
        obj.data.name = name + "_mesh"
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        obj.data.update()
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
    for obj in imported:
        if obj not in meshes:
            bpy.data.objects.remove(obj, do_unlink=True)
    return {
        "name": name,
        "file": str(path.relative_to(ART.parent.parent.parent)),
        "bytes": path.stat().st_size,
        "sha256": digest(path),
        "triangles": triangles,
        "displayHeightMetres": 2.8,
        "displayX": offset_x,
    }


def material(name: str, color: tuple[float, float, float]) -> bpy.types.Material:
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Roughness"].default_value = 0.74
    return result


def add_area(
    name: str,
    location: tuple[float, float, float],
    energy: float,
    size: float,
    color: tuple[float, float, float],
    target: tuple[float, float, float],
) -> None:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def point_camera(camera: bpy.types.Object, target: Vector) -> None:
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()


def render(scene: bpy.types.Scene, camera: bpy.types.Object, path: Path) -> None:
    scene.camera = camera
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 16
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    world = bpy.data.worlds.new("comparison world")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.10, 0.15, 0.22, 1.0)
    background.inputs["Strength"].default_value = 0.48
    scene.world = world

    rows = [
        import_normalized("v6-textured-final", V6, -1.18),
        import_normalized("v7-100k-pbr", V7, 1.18),
    ]
    bpy.ops.mesh.primitive_plane_add(size=18.0, location=(0.0, 0.0, -0.015))
    ground = bpy.context.object
    ground.name = "proof ground"
    ground.data.materials.append(material("proof stone", (0.19, 0.21, 0.23)))
    add_area("warm key", (-5.0, -6.0, 7.5), 1500.0, 5.0, (1.0, 0.76, 0.54), (0.0, 0.0, 1.45))
    add_area("cool fill", (5.0, -3.0, 6.0), 1050.0, 4.2, (0.70, 0.86, 1.0), (0.0, 0.0, 1.45))
    add_area("celadon rim", (0.0, 5.0, 7.0), 1300.0, 4.0, (0.58, 1.0, 0.82), (0.0, 0.0, 1.55))

    camera_data = bpy.data.cameras.new("comparison camera")
    camera_data.lens = 58.0
    camera = bpy.data.objects.new("comparison camera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    FRONT.parent.mkdir(parents=True, exist_ok=True)
    camera.location = (0.0, -8.8, 3.4)
    point_camera(camera, Vector((0.0, 0.0, 1.4)))
    render(scene, camera, FRONT)
    camera.location = (3.8, -8.2, 4.1)
    point_camera(camera, Vector((0.0, 0.0, 1.45)))
    render(scene, camera, ANGLE)
    camera.data.lens = 72.0
    camera.location = (0.9, -6.2, 3.45)
    point_camera(camera, Vector((0.25, 0.0, 2.15)))
    render(scene, camera, CLOSE)

    result = {
        "schema": 1,
        "purpose": "Same-scale, same-lighting provider-texture comparison; review-only.",
        "order": ["V6 18k textured final", "V7 102.6k Meshy 6 PBR candidate"],
        "assets": rows,
        "proofs": [
            {"file": str(path.relative_to(ART)), "bytes": path.stat().st_size, "sha256": digest(path)}
            for path in (FRONT, ANGLE, CLOSE)
        ],
        "renderEngine": "CYCLES CPU",
        "blender": bpy.app.version_string,
        "command": (
            "rtk proxy env ALSOFT_DRIVERS=null blender -b --factory-startup "
            "--python-exit-code 1 --python "
            "art/glass-adventure/journey-map/v7/production/render_textured_comparison.py"
        ),
    }
    MANIFEST.write_text(json.dumps(result, indent=2) + "\n")
    print("MUSEUM_CONNECTOR_TEXTURED_PROOF=" + json.dumps(result), flush=True)
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
