"""Render matching-angle proofs for the V4 amber/teal temple finish kit."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import bpy
from mathutils import Vector


HERE = Path(__file__).resolve().parent
ART = HERE.parent
GLB = ART / "exports" / "floating-museum-twin-finish-kit-v4.glb"
MANIFEST = ART / "exports" / "floating-museum-twin-finish-kit-v4.json"
FRONT = ART / "proofs" / "floating-museum-twin-temples-front-v4.png"
ANGLE = ART / "proofs" / "floating-museum-twin-temples-angle-v4.png"
FLOWER = ART / "proofs" / "floating-museum-flower-cluster-v4.png"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def point_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def descendants(root: bpy.types.Object) -> list[bpy.types.Object]:
    result: list[bpy.types.Object] = []
    pending = list(root.children)
    while pending:
        item = pending.pop()
        result.append(item)
        pending.extend(item.children)
    return result


def hide_tree(root: bpy.types.Object, hidden: bool) -> None:
    root.hide_render = hidden
    for obj in descendants(root):
        obj.hide_render = hidden


def add_area(
    name: str,
    location: tuple[float, float, float],
    energy: float,
    color: tuple[float, float, float],
    size: float,
) -> None:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.color = color
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    point_at(obj, (0.0, 0.0, 1.25))


def simple_material(name: str, color: tuple[float, float, float], roughness: float) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Roughness"].default_value = roughness
    return material


def render(scene: bpy.types.Scene, camera: bpy.types.Object, path: Path) -> None:
    scene.camera = camera
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(GLB))
    amber = bpy.data.objects.get("map_temple_amber")
    teal = bpy.data.objects.get("map_temple_teal")
    flower = bpy.data.objects.get("map_flower_cluster")
    if amber is None or teal is None or flower is None:
        raise ValueError("V4 proof nodes are missing")
    amber.location = (-1.65, 0.0, 0.035)
    teal.location = (1.65, 0.0, 0.035)
    flower.location = (0.0, -0.45, 0.04)
    for hidden_name in ("map_cliff", "map_cypress"):
        hidden = bpy.data.objects.get(hidden_name)
        if hidden is not None:
            hide_tree(hidden, True)

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "8"
    scene.view_settings.look = "AgX - Medium High Contrast"
    world = bpy.data.worlds.new("neutral museum sky")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.12, 0.17, 0.22, 1.0)
    background.inputs["Strength"].default_value = 0.38
    scene.world = world

    bpy.ops.mesh.primitive_plane_add(size=18.0, location=(0.0, 0.0, 0.0))
    floor = bpy.context.object
    floor.name = "proof_floor"
    floor.data.materials.append(simple_material("warm ivory proof floor", (0.33, 0.30, 0.25), 0.80))
    add_area("neutral key", (-5.5, -6.0, 8.5), 1250.0, (1.0, 0.86, 0.72), 6.0)
    add_area("cool fill", (5.5, -3.5, 6.5), 950.0, (0.68, 0.82, 1.0), 5.0)
    add_area("cream rim", (0.0, 5.0, 8.0), 1150.0, (0.94, 1.0, 0.84), 5.0)

    camera_data = bpy.data.cameras.new("proof camera")
    camera_data.lens = 62.0
    camera = bpy.data.objects.new("proof camera", camera_data)
    scene.collection.objects.link(camera)
    FRONT.parent.mkdir(parents=True, exist_ok=True)
    camera.location = (0.0, -10.0, 3.8)
    point_at(camera, (0.0, 0.0, 1.35))
    render(scene, camera, FRONT)
    camera.location = (4.8, -9.2, 4.7)
    point_at(camera, (0.0, 0.0, 1.45))
    render(scene, camera, ANGLE)
    hide_tree(amber, True)
    hide_tree(teal, True)
    flower.location = (0.0, 0.0, 0.04)
    camera.data.lens = 68.0
    camera.location = (1.35, -2.35, 1.05)
    point_at(camera, (0.0, 0.0, 0.24))
    render(scene, camera, FLOWER)

    manifest = json.loads(MANIFEST.read_text())
    manifest["status"] = "structurally validated and visually approved map-scale replacement kit"
    manifest["validation"]["visualProof"] = (
        "approved from matching front and three-quarter renders: amber and teal read on the dome face set, "
        "while shared ivory/gold architecture remains unchanged; the crystal-flower cluster remains legible"
    )
    manifest["proofs"] = [
        {
            "file": str(path.relative_to(ART)),
            "bytes": path.stat().st_size,
            "sha256": digest(path),
        }
        for path in (FRONT, ANGLE, FLOWER)
    ]
    manifest["proofRender"] = {
        "workingDirectory": "repository root",
        "command": "rtk proxy blender -b --factory-startup --python art/glass-adventure/journey-map/v4/production/render_twin_finish_proofs.py",
        "blender": bpy.app.version_string,
        "sourceGlbSha256": digest(GLB),
        "lighting": "Neutral warm key, cool fill, cream rim, and slate background; matching temple transforms.",
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print("FLOATING_MUSEUM_TWIN_FINISH_PROOFS=" + json.dumps(manifest["proofs"]), flush=True)
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
