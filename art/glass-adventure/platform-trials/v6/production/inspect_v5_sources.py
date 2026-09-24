#!/usr/bin/env python3
"""Measure immutable V5 Frost/Glide donors before V6 derivative authoring."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Any

import bpy
from mathutils import Matrix, Vector
import numpy as np
from PIL import Image, ImageFilter


HERE = Path(__file__).resolve().parent
V6 = HERE.parent
TRIALS = V6.parent
V5 = TRIALS / "v5"
REPO = HERE.parents[4]
REPORT = V6 / "proofs" / "diagnostics" / "v5-source-inspection.json"
VISUAL_WIDTH = 1.80

ASSETS: dict[str, dict[str, Any]] = {
    "frost": {
        "taskId": "01a0d008-eb11-7661-bca6-4fb4f1986fff",
        "sha256": "5f1c6fe3ebafc293283841527392ffe0972b28b50bdaaba293bfaaeaa0bec67c",
        "bytes": 46_738_536,
        "triangles": 632_256,
    },
    "glide": {
        "taskId": "01a0d009-7173-7142-8f57-0c4c8be24adf",
        "sha256": "394507ad969b53c88bf007edca9d4cc013adf3bab377c10dc3867a606276e36f",
        "bytes": 30_284_496,
        "triangles": 145_370,
    },
}


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


def bounds(obj: bpy.types.Object) -> tuple[Vector, Vector]:
    points = [vertex.co for vertex in obj.data.vertices]
    return (
        Vector(min(point[axis] for point in points) for axis in range(3)),
        Vector(max(point[axis] for point in points) for axis in range(3)),
    )


def dominant_landing(obj: bpy.types.Object) -> tuple[float, float, list[dict[str, float]]]:
    low, high = bounds(obj)
    size = high - low
    bin_size = max(size.z / 200.0, 1e-7)
    area_by_bin: dict[int, float] = {}
    count_by_bin: dict[int, int] = {}
    for polygon in obj.data.polygons:
        center = polygon.center
        if polygon.normal.z < 0.88:
            continue
        if not (low.x + size.x * 0.10 <= center.x <= high.x - size.x * 0.10):
            continue
        if not (low.y + size.y * 0.10 <= center.y <= high.y - size.y * 0.10):
            continue
        if center.z < low.z + size.z * 0.42:
            continue
        key = round((center.z - low.z) / bin_size)
        area_by_bin[key] = area_by_bin.get(key, 0.0) + float(polygon.area)
        count_by_bin[key] = count_by_bin.get(key, 0) + 1
    if not area_by_bin:
        raise ValueError(f"No landing plane found for {obj.name}")
    winners = sorted(area_by_bin, key=area_by_bin.get, reverse=True)[:8]
    rows = [
        {
            "height": round(float(low.z + key * bin_size), 9),
            "area": round(area_by_bin[key], 9),
            "polygons": count_by_bin[key],
        }
        for key in winners
    ]
    return float(low.z + winners[0] * bin_size), bin_size, rows


def landing_patch_bounds(
    obj: bpy.types.Object, landing: float, tolerance: float
) -> dict[str, Any]:
    selected: set[int] = set()
    area = 0.0
    polygons = 0
    for polygon in obj.data.polygons:
        if polygon.normal.z < 0.82:
            continue
        heights = [float(obj.data.vertices[index].co.z) for index in polygon.vertices]
        if abs(float(polygon.center.z) - landing) > tolerance:
            continue
        if max(abs(height - landing) for height in heights) > tolerance * 2.0:
            continue
        selected.update(polygon.vertices)
        area += float(polygon.area)
        polygons += 1
    if not selected:
        raise ValueError(f"No landing patch vertices found for {obj.name}")
    points = [obj.data.vertices[index].co for index in selected]
    low = Vector(min(point[axis] for point in points) for axis in range(3))
    high = Vector(max(point[axis] for point in points) for axis in range(3))
    return {
        "toleranceRawUnits": round(tolerance, 9),
        "polygons": polygons,
        "vertices": len(selected),
        "areaRawSquareUnits": round(area, 9),
        "boundsRaw": {"min": vector(low), "max": vector(high)},
        "dimensionsRaw": vector(high - low),
    }


def texture_mask_diagnostic(asset: str) -> dict[str, Any]:
    texture_dir = V5 / "meshy" / f"{asset}-ultra4k" / "textures"
    base_path = texture_dir / "set-0-base_color.png"
    metallic_path = texture_dir / "set-0-metallic.png"
    with Image.open(base_path) as opened:
        base = opened.convert("RGB").resize((2048, 2048), Image.Resampling.LANCZOS)
    with Image.open(metallic_path) as opened:
        metallic = opened.convert("L")
    rgb = np.asarray(base, dtype=np.float32) / 255.0
    metal = np.asarray(metallic, dtype=np.float32) / 255.0
    maximum = rgb.max(axis=2)
    minimum = rgb.min(axis=2)
    saturation = (maximum - minimum) / np.maximum(maximum, 1e-6)
    red, green, blue = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    warm = (
        (red > green * 1.035)
        & (green > blue * 1.12)
        & (red > blue * 1.24)
        & (saturation > 0.16)
        & (maximum > 0.20)
    )
    provider_metal = metal > 0.38
    gold = warm & provider_metal
    raw_mask = Image.fromarray(np.where(gold, 255, 0).astype(np.uint8), mode="L")
    # A one-texel equivalent expansion at 2K closes resampling pinholes without
    # swallowing narrow glass gaps. The final build records this exact operation.
    closed = raw_mask.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    output = V6 / "proofs" / "diagnostics" / f"{asset}-gold-mask-candidate.png"
    output.parent.mkdir(parents=True, exist_ok=True)
    closed.save(output, optimize=True)
    closed_values = np.asarray(closed, dtype=np.uint8) > 127
    return {
        "baseColor": {
            "file": relative(base_path),
            "bytes": base_path.stat().st_size,
            "sha256": digest(base_path),
            "dimensions": [4096, 4096],
        },
        "providerMetallic": {
            "file": relative(metallic_path),
            "bytes": metallic_path.stat().st_size,
            "sha256": digest(metallic_path),
            "dimensions": [2048, 2048],
            "fractionAbove038": round(float(provider_metal.mean()), 9),
        },
        "candidateGoldMask": {
            "file": relative(output),
            "bytes": output.stat().st_size,
            "sha256": digest(output),
            "dimensions": [2048, 2048],
            "fractionWarmAndMetallic": round(float(gold.mean()), 9),
            "fractionAfterOneTexelClose": round(float(closed_values.mean()), 9),
            "threshold": {
                "providerMetallicGreaterThan": 0.38,
                "redGreenRatioGreaterThan": 1.035,
                "greenBlueRatioGreaterThan": 1.12,
                "redBlueRatioGreaterThan": 1.24,
                "saturationGreaterThan": 0.16,
                "valueGreaterThan": 0.20,
            },
        },
    }


def inspect_asset(asset: str, expected: dict[str, Any]) -> dict[str, Any]:
    source = V5 / "meshy" / f"{asset}-ultra4k" / "dense-donor.glb"
    receipt_path = source.parent / "receipt.json"
    receipt = json.loads(receipt_path.read_text())
    if receipt.get("state") != "archived" or receipt.get("taskId") != expected["taskId"]:
        raise ValueError(f"{asset} is not the accepted archived V5 task")
    if source.stat().st_size != expected["bytes"] or digest(source) != expected["sha256"]:
        raise ValueError(f"{asset} source differs from its immutable V5 record")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(source))
    meshes = [obj for obj in bpy.data.objects if obj not in before and obj.type == "MESH"]
    if len(meshes) != 1:
        raise ValueError(f"{asset} expected one mesh, found {len(meshes)}")
    obj = meshes[0]
    obj.data.transform(obj.matrix_world)
    obj.matrix_world = Matrix.Identity(4)
    obj.data.update()
    obj.data.calc_loop_triangles()
    triangles = len(obj.data.loop_triangles)
    if triangles != expected["triangles"]:
        raise ValueError(f"{asset} triangle count changed: {triangles}")

    low, high = bounds(obj)
    dimensions = high - low
    landing, bin_size, landing_bins = dominant_landing(obj)
    patch = landing_patch_bounds(obj, landing, bin_size * 2.5)
    uniform_scale = VISUAL_WIDTH / float(dimensions.x)
    fitted_dimensions = dimensions * uniform_scale
    patch_dimensions = Vector(patch["dimensionsRaw"]) * uniform_scale
    uv_layers = []
    for layer in obj.data.uv_layers:
        finite = all(math.isfinite(value) for item in layer.data for value in item.uv)
        uv_layers.append({"name": layer.name, "loops": len(layer.data), "finite": finite})
    degenerate = sum(1 for triangle in obj.data.loop_triangles if triangle.area <= 1e-12)
    referenced = {index for triangle in obj.data.loop_triangles for index in triangle.vertices}
    nonfinite_positions = sum(
        1
        for vertex in obj.data.vertices
        if not all(math.isfinite(float(value)) for value in vertex.co)
    )
    return {
        "asset": asset,
        "source": {
            "file": relative(source),
            "bytes": source.stat().st_size,
            "sha256": digest(source),
            "receipt": relative(receipt_path),
            "receiptSha256": digest(receipt_path),
            "taskId": expected["taskId"],
        },
        "mesh": {
            "objects": 1,
            "vertices": len(obj.data.vertices),
            "referencedVertices": len(referenced),
            "unusedVertices": len(obj.data.vertices) - len(referenced),
            "triangles": triangles,
            "degenerateTriangles": degenerate,
            "nonfinitePositions": nonfinite_positions,
            "uvLayers": uv_layers,
        },
        "rawBoundsBlenderZUp": {"min": vector(low), "max": vector(high)},
        "rawDimensionsBlenderZUp": vector(dimensions),
        "uniformVisualFit": {
            "method": "uniform scale to the established 1.80m V3 decorative width; centre X/Y; translate sampled source landing to Z=0",
            "scale": round(uniform_scale, 9),
            "dimensionsMetres": vector(fitted_dimensions),
            "axisWiseStretching": False,
            "landingRawZ": round(landing, 9),
            "landingBlenderZ": 0.0,
            "landingBins": landing_bins,
            "landingPatch": {
                **patch,
                "dimensionsAfterUniformFitMetres": vector(patch_dimensions),
            },
        },
        "materialMaskDiagnostic": texture_mask_diagnostic(asset),
    }


def main() -> None:
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    result = {
        "schema": 1,
        "purpose": "Immutable V5 donor measurements and provider-map gold-mask preflight before V6 authoring",
        "constraints": {
            "landingMetres": [1.70, 1.30],
            "landingTopBlenderZ": 0.0,
            "visualEnvelopeMetres": [1.80, 1.40],
            "sourceTopologyMutation": False,
            "wholeShellDecimation": False,
            "contactFlattening": False,
        },
        "assets": [inspect_asset(asset, expected) for asset, expected in ASSETS.items()],
        "tool": {"blender": bpy.app.version_string, "numpy": np.__version__},
        "command": (
            "rtk proxy timeout 900 env ALSOFT_DRIVERS=null blender -b --factory-startup "
            "--python-exit-code 1 --python art/glass-adventure/platform-trials/v6/production/inspect_v5_sources.py"
        ),
    }
    REPORT.write_text(json.dumps(result, indent=2) + "\n")
    print("V6_SOURCE_INSPECTION=" + json.dumps(result), flush=True)
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
