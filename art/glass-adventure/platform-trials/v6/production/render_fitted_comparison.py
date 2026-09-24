#!/usr/bin/env python3
"""Render matched V5-donor and V6-derivative clay/PBR review evidence."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
from typing import Any

import bpy
from mathutils import Matrix, Vector
from PIL import Image


HERE = Path(__file__).resolve().parent
V6 = HERE.parent
TRIALS = V6.parent
V5 = TRIALS / "v5"
REPO = HERE.parents[4]
PROOFS = V6 / "proofs" / "comparisons"
REPORTS = V6 / "proofs" / "diagnostics"
DISPLAY_CENTRES = (-1.12, 1.12)
VISUAL_WIDTH = 1.80

ASSETS: dict[str, dict[str, Any]] = {
    "frost": {
        "sourceTriangles": 632_256,
        "derivativeTriangles": 634_512,
        "root": "Cloudway_Frost",
        "floorZ": -0.53,
        "targetZ": -0.17,
        "visualReview": (
            "Accepted: the fitted derivative retains the donor snowflake, bubbles, "
            "crystalline apron, gold corner cages, and silhouette. The cyan glass "
            "extension and gold boundary form a deliberate flush landing frame."
        ),
    },
    "glide": {
        "sourceTriangles": 145_370,
        "derivativeTriangles": 147_250,
        "root": "Cloudway_Glide",
        "floorZ": -0.38,
        "targetZ": -0.10,
        "visualReview": (
            "Accepted: the fitted derivative retains the donor lunar inlay, water "
            "veining, crystalline underside, gold hardware, and silhouette. The "
            "emerald glass extension and gold boundary form a deliberate flush "
            "landing frame."
        ),
    },
}


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ValueError(f"Could not load helper {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


BUILD = load_module("v6_build_fitted_derivative", HERE / "build_fitted_derivative.py")
V4_RENDER = load_module(
    "v4_platform_comparison",
    TRIALS / "v4" / "production" / "render_ultra4k_v3_comparison.py",
)


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def relative(path: Path) -> str:
    return str(path.relative_to(REPO))


def vector(value: Vector) -> list[float]:
    return [round(float(component), 9) for component in value]


def descendants(root: bpy.types.Object) -> list[bpy.types.Object]:
    result: list[bpy.types.Object] = []
    pending = list(root.children)
    while pending:
        current = pending.pop()
        result.append(current)
        pending.extend(current.children)
    return result


def bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points: list[Vector] = []
    for obj in objects:
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    return (
        Vector(min(point[axis] for point in points) for axis in range(3)),
        Vector(max(point[axis] for point in points) for axis in range(3)),
    )


def triangle_count(objects: list[bpy.types.Object]) -> int:
    total = 0
    for obj in objects:
        obj.data.calc_loop_triangles()
        total += len(obj.data.loop_triangles)
    return total


def import_source(asset: str, offset_x: float) -> tuple[list[bpy.types.Object], dict[str, Any]]:
    path = V5 / "meshy" / f"{asset}-ultra4k" / "dense-donor.glb"
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    meshes = [obj for obj in imported if obj.type == "MESH"]
    if len(meshes) != 1:
        raise ValueError(f"{asset} source comparison expected one mesh")
    obj = meshes[0]
    obj.data = obj.data.copy()
    world = obj.matrix_world.copy()
    obj.parent = None
    obj.data.transform(world)
    obj.matrix_world = Matrix.Identity(4)
    low, high = BUILD.mesh_bounds(obj)
    landing, _bin_size = BUILD.dominant_landing(obj)
    scale = VISUAL_WIDTH / float(high.x - low.x)
    centre_x = (low.x + high.x) * 0.5
    centre_y = (low.y + high.y) * 0.5
    for vertex in obj.data.vertices:
        vertex.co.x = (vertex.co.x - centre_x) * scale + offset_x
        vertex.co.y = (vertex.co.y - centre_y) * scale
        vertex.co.z = (vertex.co.z - landing) * scale
    obj.data.update()
    obj.name = f"{asset}_v5_dense_source"
    for extra in imported:
        if extra is not obj:
            bpy.data.objects.remove(extra, do_unlink=True)
    bpy.context.view_layer.update()
    normalized_low, normalized_high = BUILD.mesh_bounds(obj)
    world_low, world_high = bounds([obj])
    if (world_low - normalized_low).length > 1e-6 or (world_high - normalized_high).length > 1e-6:
        raise ValueError(f"{asset} source display retained an unexpected object transform")
    return [obj], {
        "label": "V5 accepted dense donor",
        "file": relative(path),
        "uniformWidthMetres": VISUAL_WIDTH,
        "displayCentreXMetres": offset_x,
        "landingBlenderZMetres": 0.0,
        "triangles": triangle_count([obj]),
        "boundsBlenderZUpMetres": {
            "min": vector(normalized_low),
            "max": vector(normalized_high),
        },
        "dimensionsBlenderZUpMetres": vector(normalized_high - normalized_low),
    }


def import_derivative(
    asset: str, root_name: str, offset_x: float
) -> tuple[list[bpy.types.Object], dict[str, Any]]:
    path = V6 / "exports" / f"cloudway-{asset}-v6-derivative.glb"
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    roots = [obj for obj in imported if obj.name == root_name]
    if len(roots) != 1:
        raise ValueError(f"{asset} comparison expected one {root_name}")
    root = roots[0]
    root.location.x += offset_x
    bpy.context.view_layer.update()
    meshes = [obj for obj in descendants(root) if obj.type == "MESH"]
    low, high = bounds(meshes)
    return meshes, {
        "label": "V6 fitted derivative",
        "file": relative(path),
        "uniformWidthMetres": VISUAL_WIDTH,
        "displayCentreXMetres": offset_x,
        "landingBlenderZMetres": 0.0,
        "triangles": triangle_count(meshes),
        "boundsBlenderZUpMetres": {"min": vector(low), "max": vector(high)},
        "dimensionsBlenderZUpMetres": vector(high - low),
    }


def clay_material() -> bpy.types.Material:
    material = bpy.data.materials.new("matched comparison clay")
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (0.57, 0.62, 0.67, 1.0)
    shader.inputs["Roughness"].default_value = 0.57
    shader.inputs["Metallic"].default_value = 0.0
    return material


def assign_clay(objects: list[bpy.types.Object], material: bpy.types.Material) -> None:
    for obj in objects:
        obj.data.materials.clear()
        obj.data.materials.append(material)
        for polygon in obj.data.polygons:
            polygon.material_index = 0


def setup_scene(config: dict[str, Any]) -> tuple[bpy.types.Scene, bpy.types.Object]:
    scene, camera = V4_RENDER.setup_scene()
    scene.cycles.samples = 18
    scene.cycles.seed = 61
    scene.render.resolution_x = 1800
    scene.render.resolution_y = 1000
    world_background = scene.world.node_tree.nodes.get("Background")
    world_background.inputs["Color"].default_value = (0.075, 0.095, 0.12, 1.0)
    world_background.inputs["Strength"].default_value = 0.52
    floors = [obj for obj in scene.objects if obj.type == "MESH"]
    if len(floors) != 1:
        raise ValueError(f"Expected one comparison floor before imports, found {len(floors)}")
    floors[0].location.z = float(config["floorZ"])
    floor_shader = floors[0].data.materials[0].node_tree.nodes.get("Principled BSDF")
    floor_shader.inputs["Base Color"].default_value = (0.095, 0.115, 0.14, 1.0)
    floor_shader.inputs["Roughness"].default_value = 0.66
    return scene, camera


def proof_record(path: Path) -> dict[str, Any]:
    with Image.open(path) as image:
        image.load()
        dimensions = list(image.size)
    return {
        "file": relative(path),
        "bytes": path.stat().st_size,
        "sha256": digest(path),
        "dimensions": dimensions,
    }


def render_mode(asset: str, mode: str, config: dict[str, Any]) -> tuple[list[dict[str, Any]], list[Path]]:
    scene, camera = setup_scene(config)
    source_meshes, source_row = import_source(asset, DISPLAY_CENTRES[0])
    derivative_meshes, derivative_row = import_derivative(asset, config["root"], DISPLAY_CENTRES[1])
    if source_row["triangles"] != config["sourceTriangles"]:
        raise ValueError(f"{asset} comparison source triangle count changed")
    if derivative_row["triangles"] != config["derivativeTriangles"]:
        raise ValueError(f"{asset} comparison derivative triangle count changed")
    if mode == "clay":
        neutral = clay_material()
        assign_clay(source_meshes + derivative_meshes, neutral)
    PROOFS.mkdir(parents=True, exist_ok=True)
    front = PROOFS / f"{asset}-v5-v6-{mode}-front.png"
    angle = PROOFS / f"{asset}-v5-v6-{mode}-three-quarter.png"
    target = Vector((0.0, 0.0, float(config["targetZ"])))
    camera.data.ortho_scale = 2.78
    V4_RENDER.render(scene, camera, target, (0.0, -6.4, 1.68), front)
    camera.data.ortho_scale = 3.00
    V4_RENDER.render(scene, camera, target, (4.8, -6.6, 2.25), angle)
    return [source_row, derivative_row], [front, angle]


def render_asset(asset: str) -> dict[str, Any]:
    config = ASSETS[asset]
    groups: list[dict[str, Any]] = []
    authoritative_rows: list[dict[str, Any]] | None = None
    for mode in ("clay", "pbr"):
        rows, paths = render_mode(asset, mode, config)
        if authoritative_rows is None:
            authoritative_rows = rows
        else:
            reduced = [{key: value for key, value in row.items() if key != "boundsBlenderZUpMetres"} for row in rows]
            authority_reduced = [
                {key: value for key, value in row.items() if key != "boundsBlenderZUpMetres"}
                for row in authoritative_rows
            ]
            if reduced != authority_reduced:
                raise ValueError(f"{asset} clay/PBR normalization diverged")
        groups.append(
            {
                "mode": mode,
                "order": ["V5 accepted dense donor", "V6 fitted derivative"],
                "sameScale": True,
                "sameCameraAndLighting": True,
                "proofs": [proof_record(path) for path in paths],
            }
        )
    if authoritative_rows is None:
        raise ValueError("No comparison rows produced")
    report = {
        "schema": 1,
        "asset": asset,
        "purpose": "Matched review evidence for source-detail preservation, deliberate landing fit, and physical material response.",
        "decision": "accepted",
        "visualReview": config["visualReview"],
        "comparisonOrder": ["V5 accepted dense donor", "V6 fitted derivative"],
        "normalization": {
            "method": "Both displays preserve a uniform 1.80m visual width and align the sampled landing plane to Blender Z=0.",
            "sameScale": True,
            "sameCamera": True,
            "sameLighting": True,
        },
        "sourceMeasurements": authoritative_rows,
        "groups": groups,
        "render": {
            "engine": "Cycles CPU",
            "samples": 18,
            "seed": 61,
            "resolution": [1800, 1000],
            "camera": "orthographic",
            "blender": bpy.app.version_string,
        },
        "command": (
            "rtk proxy timeout 3600 env ALSOFT_DRIVERS=null blender -b --factory-startup "
            "--python-exit-code 1 --python art/glass-adventure/platform-trials/v6/production/"
            f"render_fitted_comparison.py -- --asset {asset}"
        ),
    }
    REPORTS.mkdir(parents=True, exist_ok=True)
    report_path = REPORTS / f"{asset}-v6-comparison.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n")
    print("V6_COMPARISON=" + json.dumps(report), flush=True)
    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", choices=sorted(ASSETS), required=True)
    import sys

    arguments = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    render_asset(arguments.asset)
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
