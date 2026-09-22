"""Render CPU-only isolated beauty proofs from the exported V7 connector candidate."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import bpy
from mathutils import Vector


HERE = Path(__file__).resolve().parent
ART = HERE.parent
GLB = ART / "exports" / "floating-museum-twin-connector-candidate-v7.glb"
MANIFEST = ART / "exports" / "floating-museum-twin-connector-candidate-v7.json"
FRONT = ART / "proofs" / "floating-museum-twin-connector-front-v7.png"
ANGLE = ART / "proofs" / "floating-museum-twin-connector-angle-v7.png"
CLOSE = ART / "proofs" / "floating-museum-twin-connector-close-v7.png"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def material(name: str, color: tuple[float, float, float]) -> bpy.types.Material:
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Roughness"].default_value = 0.76
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
    bpy.ops.import_scene.gltf(filepath=str(GLB))
    if bpy.data.objects.get("map_museum_polish_kit_root") is None:
        raise ValueError("Exported candidate lost its stable root")
    if bpy.data.objects.get("map_twin_connector") is None:
        raise ValueError("Exported candidate lost its stable connector node")

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 20
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    world = bpy.data.worlds.new("museum proof world")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.10, 0.15, 0.22, 1.0)
    background.inputs["Strength"].default_value = 0.46
    scene.world = world

    bpy.ops.mesh.primitive_plane_add(size=16.0, location=(0.0, 0.0, -0.015))
    ground = bpy.context.object
    ground.name = "proof ground"
    ground.data.materials.append(material("proof warm stone", (0.21, 0.22, 0.22)))
    add_area("warm key", (-4.0, -5.0, 7.0), 1550.0, 4.8, (1.0, 0.75, 0.52), (0.0, 0.0, 1.45))
    add_area("cream fill", (4.5, -2.8, 6.0), 1100.0, 4.0, (0.72, 0.87, 1.0), (0.0, 0.0, 1.5))
    add_area("celadon rim", (0.0, 4.5, 6.5), 1350.0, 3.8, (0.58, 1.0, 0.82), (0.0, 0.0, 1.55))

    camera_data = bpy.data.cameras.new("proof camera")
    camera_data.lens = 58.0
    camera = bpy.data.objects.new("proof camera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    FRONT.parent.mkdir(parents=True, exist_ok=True)
    camera.location = (0.0, -6.3, 3.2)
    point_camera(camera, Vector((0.0, 0.0, 1.40)))
    render(scene, camera, FRONT)
    camera.location = (3.2, -5.9, 3.9)
    point_camera(camera, Vector((0.0, 0.0, 1.45)))
    render(scene, camera, ANGLE)
    camera.data.lens = 72.0
    camera.location = (0.75, -4.5, 3.4)
    point_camera(camera, Vector((0.05, 0.0, 2.13)))
    render(scene, camera, CLOSE)

    manifest = json.loads(MANIFEST.read_text())
    if manifest.get("glb", {}).get("sha256") != digest(GLB):
        raise ValueError("Proof input differs from the validated connector export")
    manifest["proofs"] = [
        {
            "file": str(path.relative_to(ART)),
            "bytes": path.stat().st_size,
            "sha256": digest(path),
            "sourceGlbSha256": digest(GLB),
        }
        for path in (FRONT, ANGLE, CLOSE)
    ]
    manifest["proofRender"] = {
        "renderEngine": "CYCLES CPU",
        "samples": scene.cycles.samples,
        "blender": bpy.app.version_string,
        "command": (
            "rtk proxy env ALSOFT_DRIVERS=null blender -b --factory-startup "
            "--python-exit-code 1 --python "
            "art/glass-adventure/journey-map/v7/production/render_connector_candidate.py"
        ),
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(
        "MUSEUM_CONNECTOR_CANDIDATE_PROOFS="
        + json.dumps({"proofs": manifest["proofs"]}),
        flush=True,
    )
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
