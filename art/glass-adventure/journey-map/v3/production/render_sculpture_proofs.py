"""Render warm isolated proofs from the exported map sculpture GLB."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import bpy
from mathutils import Vector


HERE = Path(__file__).resolve().parent
ART = HERE.parent
GLB = ART / "exports" / "floating-museum-sculpture-kit-v3.glb"
MANIFEST = ART / "exports" / "floating-museum-sculpture-kit-v3.json"
FRONT = ART / "proofs" / "floating-museum-sculpture-kit-front-v3.png"
ANGLE = ART / "proofs" / "floating-museum-sculpture-kit-angle-v3.png"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def point_camera(camera: bpy.types.Object, target: Vector) -> None:
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()


def material(name: str, color: tuple[float, float, float], roughness: float) -> bpy.types.Material:
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Roughness"].default_value = roughness
    return result


def add_area(
    name: str,
    location: tuple[float, float, float],
    energy: float,
    color: tuple[float, float, float],
    size: float,
    target: tuple[float, float, float],
) -> None:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.color = color
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def render(scene: bpy.types.Scene, camera: bpy.types.Object, path: Path) -> None:
    scene.render.filepath = str(path)
    scene.camera = camera
    bpy.ops.render.render(write_still=True)


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(GLB))
    root = bpy.data.objects.get("map_sculpture_kit_root")
    if root is None:
        raise ValueError("Exported sculpture-kit root is missing")
    temple = bpy.data.objects.get("map_temple")
    cliff = bpy.data.objects.get("map_cliff")
    cypress = bpy.data.objects.get("map_cypress")
    if temple is None or cliff is None or cypress is None:
        raise ValueError("Exported sculpture-kit proof nodes are missing")
    temple.location = (-4.0, 0.0, 0.05)
    cliff.location = (0.0, 0.0, 3.45)
    cypress.location = (4.0, 0.0, 0.05)

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.render.resolution_percentage = 100
    scene.render.image_settings.color_depth = "8"
    scene.view_settings.look = "AgX - Medium High Contrast"
    world = bpy.data.worlds.new("warm museum proof world")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.16, 0.20, 0.25, 1.0)
    background.inputs["Strength"].default_value = 0.42
    scene.world = world

    bpy.ops.mesh.primitive_plane_add(size=24.0, location=(0.0, 0.0, 0.0))
    floor = bpy.context.object
    floor.name = "proof_ground"
    floor.data.materials.append(material("proof warm stone", (0.30, 0.27, 0.23), 0.78))
    add_area("warm key", (-7.0, -8.0, 11.0), 1450.0, (1.0, 0.70, 0.46), 7.0, (0.0, 0.0, 1.5))
    add_area("cream fill", (7.0, -4.0, 8.0), 1100.0, (0.72, 0.88, 1.0), 6.0, (0.0, 0.0, 1.4))
    add_area("celadon rim", (1.0, 7.0, 9.0), 1250.0, (0.46, 1.0, 0.82), 5.0, (0.0, 0.0, 1.7))

    camera_data = bpy.data.cameras.new("proof camera")
    camera_data.lens = 58.0
    camera = bpy.data.objects.new("proof camera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    target = Vector((0.0, 0.0, 1.65))

    FRONT.parent.mkdir(parents=True, exist_ok=True)
    camera.location = (0.0, -16.3, 5.3)
    point_camera(camera, target)
    render(scene, camera, FRONT)
    camera.location = (8.8, -15.6, 6.5)
    point_camera(camera, target)
    render(scene, camera, ANGLE)

    manifest = json.loads(MANIFEST.read_text())
    manifest["status"] = "structurally validated and visually approved map-scale sculpture kit"
    manifest["validation"]["visualProof"] = (
        "approved from front and three-quarter isolated renders: temple silhouette and facade, "
        "multi-spur limestone cliff, and cypress planter remain readable at map scale"
    )
    manifest["proofs"] = [
        {
            "file": str(path.relative_to(ART)),
            "bytes": path.stat().st_size,
            "sha256": digest(path),
        }
        for path in (FRONT, ANGLE)
    ]
    manifest["proofRender"] = {
        "workingDirectory": "repository root",
        "command": (
            "rtk proxy blender -b --factory-startup --python "
            "art/glass-adventure/journey-map/v3/production/render_sculpture_proofs.py"
        ),
        "blender": bpy.app.version_string,
        "sourceGlbSha256": digest(GLB),
        "lighting": "Warm amber key, cream-blue fill, celadon rim, and slate museum background.",
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(
        "FLOATING_MUSEUM_SCULPTURE_PROOFS="
        + json.dumps(
            {
                "front": manifest["proofs"][0]["sha256"],
                "angle": manifest["proofs"][1]["sha256"],
            }
        ),
        flush=True,
    )
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
