"""Render isolated Blender proofs for the map kit and four-island assembly."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import bpy
from mathutils import Vector


HERE = Path(__file__).resolve().parent
ART = HERE.parent
MANIFEST = ART / "exports/floating-museum-map-kit-v1.json"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def point_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def setup_render(scene: bpy.types.Scene, exposure: float) -> None:
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 800
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = exposure
    world = scene.world or bpy.data.worlds.new("map_proof_world")
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.14, 0.11, 0.085, 1.0)
    background.inputs["Strength"].default_value = 0.48


def light(
    scene: bpy.types.Scene,
    name: str,
    location: tuple[float, float, float],
    energy: float,
    size: float,
    color: tuple[float, float, float],
    target: Vector,
) -> None:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = location
    point_at(obj, target)


def camera(
    scene: bpy.types.Scene,
    name: str,
    location: tuple[float, float, float],
    target: Vector,
    lens: float,
) -> None:
    data = bpy.data.cameras.new(name)
    data.lens = lens
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = location
    point_at(obj, target)
    scene.camera = obj


def render_assembly() -> Path:
    bpy.ops.wm.open_mainfile(filepath=str(ART / "sources/floating-museum-four-island-proof-v1.blend"))
    scene = bpy.context.scene
    setup_render(scene, -0.05)
    target = Vector((0.1, 0.35, -0.25))
    light(scene, "map_key", (-8.0, -10.0, 16.0), 2150.0, 8.0, (1.0, 0.82, 0.66), target)
    light(scene, "map_fill", (11.0, -2.0, 10.0), 1650.0, 9.0, (0.76, 0.86, 1.0), target)
    light(scene, "map_rim", (1.0, 12.0, 13.0), 1450.0, 7.0, (0.82, 1.0, 0.90), target)
    camera(scene, "map_camera", (14.5, -19.5, 13.0), target, 56.0)
    output = ART / "proofs/floating-museum-four-island-proof-v1.png"
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    return output


def render_kit() -> Path:
    bpy.ops.wm.open_mainfile(filepath=str(ART / "sources/floating-museum-map-kit-v1.blend"))
    scene = bpy.context.scene
    layout = {
        "map_canopy": (-4.8, -1.8, 0.0),
        "map_column": (-1.8, -1.8, 0.0),
        "map_planter": (0.6, -1.8, 0.0),
        "map_frame": (3.0, -1.8, 0.0),
        "map_platform": (-3.7, 2.3, 0.0),
        "map_bridge": (0.0, 2.3, 0.0),
        "map_island_root": (3.8, 2.3, 0.0),
    }
    for name, position in layout.items():
        bpy.data.objects[name].location = position
    bpy.context.view_layer.update()
    setup_render(scene, 0.0)
    target = Vector((-0.2, 0.2, -0.15))
    light(scene, "kit_key", (-7.0, -9.0, 14.0), 2050.0, 8.0, (1.0, 0.84, 0.69), target)
    light(scene, "kit_fill", (10.0, -1.0, 10.0), 1450.0, 9.0, (0.78, 0.87, 1.0), target)
    light(scene, "kit_rim", (0.0, 10.0, 12.0), 1250.0, 7.0, (0.82, 1.0, 0.90), target)
    camera(scene, "kit_camera", (13.5, -20.5, 11.5), target, 58.0)
    output = ART / "proofs/floating-museum-map-kit-lineup-v1.png"
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    return output


def record_proofs(paths: tuple[Path, ...]) -> None:
    manifest = json.loads(MANIFEST.read_text())
    manifest["status"] = "structurally validated reusable map-scale kit; isolated visual proofs generated"
    manifest["proofs"] = [
        {
            "file": str(path.relative_to(ART)),
            "bytes": path.stat().st_size,
            "sha256": digest(path),
        }
        for path in paths
    ]
    manifest["proofRender"] = {
        "workingDirectory": "repository root",
        "command": "rtk proxy blender -b --factory-startup --python art/glass-adventure/journey-map/v2/production/render_map_proofs.py",
        "blender": bpy.app.version_string,
        "lighting": "Warm sky fill with amber key, neutral-blue fill, and pale celadon rim; isolated EEVEE proof only.",
    }
    manifest["validation"]["visualProof"] = "generated-awaiting-human-review"
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")


def main() -> None:
    assembly = render_assembly()
    kit = render_kit()
    record_proofs((assembly, kit))
    print(f"FLOATING_MUSEUM_PROOFS={assembly},{kit}", flush=True)
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
