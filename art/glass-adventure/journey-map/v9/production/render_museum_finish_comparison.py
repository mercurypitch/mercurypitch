"""Render hash-bound V9 Meshy-normal and dense-bake finish comparisons."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import struct
import sys

import bpy
from mathutils import Vector


HERE = Path(__file__).resolve().parent
ART = HERE.parent

ASSETS = {
    "temple": {
        "stem": "floating-museum-temple-candidate-v9",
        "height": 3.10,
        "spacing": 3.45,
        "ortho": 4.75,
        "review": (
            "Inspect dome ribs and panels, finial, entablature, capitals, column fluting, "
            "stairs, statue, banners and carved trim at equal zoom."
        ),
    },
    "cypress": {
        "stem": "floating-museum-cypress-candidate-v9",
        "height": 3.10,
        "spacing": 1.35,
        "ortho": 4.20,
        "review": (
            "Inspect the tapered crown, branch and foliage clusters, trunk gaps, trailing "
            "ivy, planter rim, marble body and base at equal zoom."
        ),
    },
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require_file(path: Path, label: str) -> None:
    if not path.is_file() or path.stat().st_size <= 0:
        raise FileNotFoundError(f"{label} does not exist: {path}")


def relative(path: Path) -> str:
    return str(path.relative_to(ART))


def validate_record(record: object, path: Path, label: str) -> None:
    if not isinstance(record, dict):
        raise ValueError(f"{label} is absent from the candidate manifest")
    if record.get("file") != relative(path):
        raise ValueError(f"{label} manifest path differs from the expected finish output")
    if record.get("sha256") != digest(path):
        raise ValueError(f"{label} changed after the finish manifest was written")
    if "bytes" in record and int(record["bytes"]) != path.stat().st_size:
        raise ValueError(f"{label} byte count differs from the finish manifest")


def geometry_fingerprint(meshes: list[bpy.types.Object]) -> str:
    """Hash world-space positions and triangle indices, excluding material data."""
    fingerprint = hashlib.sha256()
    ordered = sorted(
        meshes,
        key=lambda obj: (
            len(obj.data.vertices),
            len(obj.data.polygons),
            obj.name.rsplit(".", 1)[0],
        ),
    )
    fingerprint.update(struct.pack("<I", len(ordered)))
    for obj in ordered:
        mesh = obj.data
        mesh.calc_loop_triangles()
        fingerprint.update(struct.pack("<II", len(mesh.vertices), len(mesh.loop_triangles)))
        for vertex in mesh.vertices:
            point = obj.matrix_world @ vertex.co
            fingerprint.update(
                struct.pack("<3d", *(round(float(value), 9) for value in point))
            )
        for triangle in mesh.loop_triangles:
            fingerprint.update(struct.pack("<3I", *triangle.vertices))
    return fingerprint.hexdigest()


def world_bounds(meshes: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points = [
        obj.matrix_world @ vertex.co
        for obj in meshes
        for vertex in obj.data.vertices
    ]
    if not points:
        raise ValueError("Imported finish contains no vertices")
    return (
        Vector(min(point[axis] for point in points) for axis in range(3)),
        Vector(max(point[axis] for point in points) for axis in range(3)),
    )


def import_variant(label: str, path: Path, offset_x: float) -> dict[str, object]:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    imported_set = set(imported)
    meshes = [obj for obj in imported if obj.type == "MESH"]
    roots = [obj for obj in imported if obj.parent not in imported_set]
    if not imported or not roots or not meshes:
        raise ValueError(f"{path.name} did not import as a visible mesh hierarchy")
    if any(not obj.data.materials for obj in meshes):
        raise ValueError(f"{path.name} has an unbound mesh material")
    images = {
        node.image
        for obj in meshes
        for slot in obj.material_slots
        if slot.material and slot.material.use_nodes
        for node in slot.material.node_tree.nodes
        if node.type == "TEX_IMAGE" and node.image
    }
    if not images:
        raise ValueError(f"{path.name} has no imported texture images")

    minimum, maximum = world_bounds(meshes)
    triangles = 0
    for obj in meshes:
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
    geometry_sha = geometry_fingerprint(meshes)

    display_root = bpy.data.objects.new(f"{label} display root", None)
    bpy.context.scene.collection.objects.link(display_root)
    for root in roots:
        root.parent = display_root
    display_root.location.x = offset_x
    return {
        "label": label,
        "file": relative(path),
        "bytes": path.stat().st_size,
        "sha256": digest(path),
        "triangles": triangles,
        "geometrySha256": geometry_sha,
        "dimensionsMetres": [round(float(value), 6) for value in maximum - minimum],
        "groundAnchorMetres": round(float(minimum.z), 6),
        "textureImages": len(images),
        "displayX": offset_x,
    }


def matte_material(name: str, color: tuple[float, float, float]) -> bpy.types.Material:
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
    target: Vector,
) -> None:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def render(
    scene: bpy.types.Scene,
    camera: bpy.types.Object,
    target: Vector,
    location: tuple[float, float, float],
    path: Path,
) -> None:
    camera.location = location
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", choices=sorted(ASSETS), required=True)
    script_args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(script_args)


def main() -> None:
    args = parse_args()
    config = ASSETS[args.asset]
    stem = str(config["stem"])
    manifest_path = ART / "exports" / f"{stem}.json"
    meshy_path = ART / "exports" / f"{stem}-meshy-normal.glb"
    baked_path = ART / "exports" / f"{stem}-dense-bake-normal.glb"
    for path, label in (
        (manifest_path, "Finished-candidate manifest"),
        (meshy_path, "Meshy-normal finish"),
        (baked_path, "Dense-bake-normal finish"),
    ):
        require_file(path, label)

    candidate = json.loads(manifest_path.read_text())
    if candidate.get("schema") != 1 or candidate.get("asset") != args.asset:
        raise ValueError("Finished-candidate manifest identifies the wrong asset or schema")
    variants = candidate.get("variants")
    if not isinstance(variants, dict):
        raise ValueError("Finished-candidate manifest has no normal variants")
    validate_record(variants.get("meshy"), meshy_path, "Meshy-normal finish")
    validate_record(variants.get("dense-bake"), baked_path, "Dense-bake-normal finish")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 24
    scene.cycles.seed = 23
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
    world = bpy.data.worlds.new(f"{args.asset} finish comparison world")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.065, 0.09, 0.13, 1.0)
    background.inputs["Strength"].default_value = 0.42
    scene.world = world

    spacing = float(config["spacing"])
    rows = [
        import_variant("Meshy normal", meshy_path, -0.5 * spacing),
        import_variant("dense-donor normal bake", baked_path, 0.5 * spacing),
    ]
    if rows[0]["geometrySha256"] != rows[1]["geometrySha256"]:
        raise ValueError("Normal variants do not contain identical geometry")
    if rows[0]["triangles"] != rows[1]["triangles"]:
        raise ValueError("Normal variants differ in triangle count")

    bpy.ops.mesh.primitive_plane_add(size=24.0, location=(0.0, 0.0, -0.015))
    ground = bpy.context.object
    ground.name = "finish comparison ground"
    ground.data.materials.append(matte_material("finish proof stone", (0.16, 0.18, 0.21)))
    height = float(config["height"])
    target = Vector((0.0, 0.0, height * 0.49))
    add_area("warm key", (-5.5, -6.5, 8.0), 1450.0, 5.0, (1.0, 0.77, 0.56), target)
    add_area("cool fill", (5.0, -3.0, 6.5), 1050.0, 4.3, (0.68, 0.84, 1.0), target)
    add_area("mint rim", (0.0, 5.0, 7.0), 1250.0, 4.0, (0.66, 1.0, 0.84), target)

    camera_data = bpy.data.cameras.new("finish comparison camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = float(config["ortho"])
    camera = bpy.data.objects.new("finish comparison camera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    scene.camera = camera
    proof_dir = ART / "proofs"
    proof_dir.mkdir(parents=True, exist_ok=True)
    front = proof_dir / f"{args.asset}-normal-comparison-front-v9.png"
    angle = proof_dir / f"{args.asset}-normal-comparison-angle-v9.png"
    render(scene, camera, target, (0.0, -11.5, height * 1.24), front)
    render(scene, camera, target, (6.0, -10.5, height * 1.48), angle)

    report = {
        "schema": 1,
        "asset": args.asset,
        "purpose": (
            "Same-geometry, same-camera comparison of the provider normal and dense-donor "
            "normal bake. Review-only; no automatic normal selection or runtime export."
        ),
        "candidateManifest": {
            "file": relative(manifest_path),
            "bytes": manifest_path.stat().st_size,
            "sha256": digest(manifest_path),
        },
        "order": ["Meshy normal", "dense-donor normal bake"],
        "assets": rows,
        "identicalGeometry": True,
        "proofs": [
            {
                "file": relative(path),
                "bytes": path.stat().st_size,
                "sha256": digest(path),
            }
            for path in (front, angle)
        ],
        "render": {
            "engine": "Cycles CPU",
            "samples": 24,
            "seed": 23,
            "cpuThreads": 8,
            "resolution": [1800, 1000],
            "camera": "orthographic",
            "orthoScale": config["ortho"],
            "blender": bpy.app.version_string,
        },
        "requiredReview": config["review"],
        "command": (
            "rtk proxy timeout 1800 env ALSOFT_DRIVERS=null blender -b --factory-startup "
            "--python-exit-code 1 --python "
            "art/glass-adventure/journey-map/v9/production/render_museum_finish_comparison.py "
            f"-- --asset {args.asset}"
        ),
    }
    report_path = proof_dir / f"{args.asset}-normal-comparison-v9.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n")
    print("MUSEUM_FINISH_COMPARISON=" + json.dumps(report), flush=True)
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
