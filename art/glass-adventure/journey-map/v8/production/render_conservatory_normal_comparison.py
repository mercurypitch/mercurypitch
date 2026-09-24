"""Render same-scene CPU comparisons of the V8 Meshy and dense-bake normals."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import bpy
from mathutils import Vector


HERE = Path(__file__).resolve().parent
ART = HERE.parent
MANIFEST = ART / "exports" / "floating-museum-conservatory-candidate-v8.json"
MESHY = ART / "exports" / "floating-museum-conservatory-candidate-v8-meshy-normal.glb"
BAKED = ART / "exports" / "floating-museum-conservatory-candidate-v8-dense-bake-normal.glb"
FRONT = ART / "proofs" / "conservatory-normal-comparison-front-v8.png"
ANGLE = ART / "proofs" / "conservatory-normal-comparison-angle-v8.png"
CLOSE = ART / "proofs" / "conservatory-normal-comparison-close-v8.png"
REPORT = ART / "proofs" / "conservatory-normal-comparison-v8.json"
ROOT_NAME = "map_museum_polish_kit_root"
GROUP_NAME = "map_conservatory"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def import_variant(label: str, path: Path, offset_x: float) -> dict[str, object]:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    roots = [obj for obj in imported if obj.name.split(".")[0] == ROOT_NAME]
    groups = [obj for obj in imported if obj.name.split(".")[0] == GROUP_NAME]
    meshes = [obj for obj in imported if obj.type == "MESH"]
    if len(roots) != 1 or len(groups) != 1 or not meshes:
        raise ValueError(f"{path.name} lost the stable candidate hierarchy")
    roots[0].location.x = offset_x
    triangles = 0
    for obj in meshes:
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
    return {
        "label": label,
        "file": str(path.relative_to(ART)),
        "bytes": path.stat().st_size,
        "sha256": digest(path),
        "triangles": triangles,
        "displayX": offset_x,
    }


def material(name: str, color: tuple[float, float, float]) -> bpy.types.Material:
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Roughness"].default_value = 0.72
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


def point_camera(camera: bpy.types.Object, target: tuple[float, float, float]) -> None:
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()


def render(scene: bpy.types.Scene, camera: bpy.types.Object, path: Path) -> None:
    scene.camera = camera
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def main() -> None:
    candidate = json.loads(MANIFEST.read_text())
    expected = {
        "meshy": candidate.get("variants", {}).get("meshy", {}).get("sha256"),
        "dense-bake": candidate.get("variants", {}).get("dense-bake", {}).get("sha256"),
    }
    if expected["meshy"] != digest(MESHY) or expected["dense-bake"] != digest(BAKED):
        raise ValueError("Normal-comparison input differs from the finished candidate manifest")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 24
    scene.cycles.seed = 17
    scene.cycles.use_denoising = True
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 8
    scene.render.resolution_x = 1800
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    world = bpy.data.worlds.new("normal comparison world")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.08, 0.12, 0.17, 1.0)
    background.inputs["Strength"].default_value = 0.45
    scene.world = world

    rows = [
        import_variant("Meshy normal", MESHY, -1.35),
        import_variant("dense-donor normal bake", BAKED, 1.35),
    ]
    if rows[0]["triangles"] != rows[1]["triangles"]:
        raise ValueError("Normal variants differ in geometry")
    bpy.ops.mesh.primitive_plane_add(size=18.0, location=(0.0, 0.0, -0.015))
    ground = bpy.context.object
    ground.name = "proof ground"
    ground.data.materials.append(material("proof stone", (0.17, 0.19, 0.21)))
    add_area("warm key", (-5.0, -6.0, 7.5), 1500.0, 5.0, (1.0, 0.76, 0.54), (0.0, 0.0, 1.4))
    add_area("cool fill", (5.0, -3.0, 6.0), 1100.0, 4.2, (0.70, 0.86, 1.0), (0.0, 0.0, 1.4))
    add_area("celadon rim", (0.0, 5.0, 7.0), 1300.0, 4.0, (0.58, 1.0, 0.82), (0.0, 0.0, 1.55))

    camera_data = bpy.data.cameras.new("normal comparison camera")
    camera_data.lens = 60.0
    camera = bpy.data.objects.new("normal comparison camera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    FRONT.parent.mkdir(parents=True, exist_ok=True)
    camera.location = (0.0, -8.6, 3.5)
    point_camera(camera, (0.0, 0.0, 1.38))
    render(scene, camera, FRONT)
    camera.location = (3.8, -8.2, 4.15)
    point_camera(camera, (0.0, 0.0, 1.45))
    render(scene, camera, ANGLE)
    camera.data.lens = 76.0
    camera.location = (1.0, -6.1, 3.55)
    point_camera(camera, (0.20, 0.0, 2.05))
    render(scene, camera, CLOSE)

    report = {
        "schema": 1,
        "purpose": (
            "Same-geometry, same-camera comparison of the provider normal and dense-donor "
            "normal bake. Review-only; no automatic normal selection."
        ),
        "candidateManifest": {
            "file": str(MANIFEST.relative_to(ART)),
            "sha256": digest(MANIFEST),
        },
        "order": ["Meshy normal", "dense-donor normal bake"],
        "assets": rows,
        "proofs": [
            {
                "file": str(path.relative_to(ART)),
                "bytes": path.stat().st_size,
                "sha256": digest(path),
            }
            for path in (FRONT, ANGLE, CLOSE)
        ],
        "render": {
            "engine": "Cycles CPU",
            "samples": 24,
            "seed": 17,
            "cpuThreads": 8,
            "resolution": [1800, 1000],
            "blender": bpy.app.version_string,
        },
        "requiredReview": (
            "Inspect roof ribs, leaf clumps, fluting, arch trim, planters and base at equal zoom; "
            "also consult the projection audit for ray misses before selecting a normal."
        ),
        "command": (
            "rtk proxy timeout 1800 env ALSOFT_DRIVERS=null blender -b --factory-startup "
            "--python-exit-code 1 --python "
            "art/glass-adventure/journey-map/v8/production/render_conservatory_normal_comparison.py"
        ),
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print("CONSERVATORY_NORMAL_COMPARISON=" + json.dumps(report), flush=True)
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
