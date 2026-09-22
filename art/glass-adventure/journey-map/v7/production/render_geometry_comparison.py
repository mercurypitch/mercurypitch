"""Render CPU-only clay comparisons of the archived, V6, and V7 connector meshes."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


HERE = Path(__file__).resolve().parent
ART = HERE.parent
FRONT = ART / "proofs" / "twin-connector-geometry-front-v7.png"
ANGLE = ART / "proofs" / "twin-connector-geometry-angle-v7.png"
MANIFEST = ART / "proofs" / "twin-connector-geometry-comparison-v7.json"
ASSETS = (
    (
        "archived-pre-remesh",
        ART / "meshy" / "raw" / "twin-connector-pre-remesh-v6.glb",
        -2.35,
        (0.74, 0.70, 0.62, 1.0),
    ),
    (
        "v6-textured-final-clay",
        ART.parent / "v6" / "meshy" / "twin-connector-final.glb",
        0.0,
        (0.78, 0.62, 0.42, 1.0),
    ),
    (
        "v7-remesh-100k",
        ART / "meshy" / "twin-connector-remesh-100k.glb",
        2.35,
        (0.52, 0.72, 0.64, 1.0),
    ),
)


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


def material(name: str, color: tuple[float, float, float, float]) -> bpy.types.Material:
    result = bpy.data.materials.new(name)
    result.diffuse_color = color
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Roughness"].default_value = 0.56
    shader.inputs["Metallic"].default_value = 0.0
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


def import_normalized(
    name: str,
    path: Path,
    offset_x: float,
    clay: bpy.types.Material,
) -> dict[str, object]:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    meshes = [obj for obj in imported if obj.type == "MESH"]
    if not meshes:
        raise ValueError(f"{path.name} has no mesh")
    low, high = bounds(meshes)
    height = high.z - low.z
    scale = 2.80 / height
    center_x = (low.x + high.x) * 0.5
    center_y = (low.y + high.y) * 0.5
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
        obj.data.materials.clear()
        obj.data.materials.append(clay)
        obj.name = name
        obj.data.name = name + "_mesh"
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        obj.data.update()
    for obj in imported:
        if obj not in meshes:
            bpy.data.objects.remove(obj, do_unlink=True)
    triangle_count = 0
    for mesh in meshes:
        mesh.data.calc_loop_triangles()
        triangle_count += len(mesh.data.loop_triangles)
    return {
        "name": name,
        "file": str(path.relative_to(ART.parent.parent.parent)),
        "sha256": digest(path),
        "triangles": triangle_count,
        "displayHeightMetres": 2.8,
        "displayX": offset_x,
    }


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 12
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1800
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
    background.inputs["Color"].default_value = (0.08, 0.11, 0.15, 1.0)
    background.inputs["Strength"].default_value = 0.40
    scene.world = world

    rows = []
    for name, path, offset_x, color in ASSETS:
        rows.append(import_normalized(name, path, offset_x, material(name + " clay", color)))

    bpy.ops.mesh.primitive_plane_add(size=20.0, location=(0.0, 0.0, -0.015))
    ground = bpy.context.object
    ground.name = "proof ground"
    ground.data.materials.append(material("proof ground", (0.11, 0.14, 0.18, 1.0)))
    add_area("warm key", (-5.0, -5.5, 7.0), 1250.0, 4.5, (1.0, 0.78, 0.58), (0.0, 0.0, 1.35))
    add_area("cool fill", (5.0, -2.5, 6.0), 950.0, 4.0, (0.68, 0.84, 1.0), (0.0, 0.0, 1.4))
    add_area("rim", (0.0, 4.0, 6.5), 1100.0, 3.5, (0.70, 1.0, 0.86), (0.0, 0.0, 1.5))

    camera_data = bpy.data.cameras.new("comparison camera")
    camera_data.lens = 62.0
    camera = bpy.data.objects.new("comparison camera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    target = Vector((0.0, 0.0, 1.40))
    FRONT.parent.mkdir(parents=True, exist_ok=True)
    camera.location = (0.0, -11.0, 3.4)
    point_camera(camera, target)
    render(scene, camera, FRONT)
    camera.location = (5.2, -10.8, 4.2)
    point_camera(camera, target)
    render(scene, camera, ANGLE)

    result = {
        "schema": 1,
        "purpose": "Same-scale clay silhouette comparison; review-only and not a runtime export.",
        "order": ["archived pre-remesh", "V6 textured final shown as clay", "V7 100k remesh"],
        "assets": rows,
        "proofs": [
            {"file": str(path.relative_to(ART)), "bytes": path.stat().st_size, "sha256": digest(path)}
            for path in (FRONT, ANGLE)
        ],
        "renderEngine": "CYCLES CPU",
        "blender": bpy.app.version_string,
        "command": (
            "rtk proxy env ALSOFT_DRIVERS=null blender -b --factory-startup "
            "--python-exit-code 1 --python "
            "art/glass-adventure/journey-map/v7/production/render_geometry_comparison.py"
        ),
    }
    MANIFEST.write_text(json.dumps(result, indent=2) + "\n")
    print("MUSEUM_CONNECTOR_GEOMETRY_PROOF=" + json.dumps(result), flush=True)
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
