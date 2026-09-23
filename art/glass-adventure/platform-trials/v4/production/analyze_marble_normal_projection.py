"""Measure V4 normal-bake failures against the fitted dense source geometry."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import sys

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import numpy as np
from PIL import Image as PILImage


HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import marble_runtime_common as COMMON  # noqa: E402


SOURCE_BLEND = COMMON.V4 / "sources" / "cloudway-platform-kit-v4.blend"
NORMAL = COMMON.V4 / "proofs" / "diagnostics" / "marble-normal-geometry-only-2k.png"
REPORT = COMMON.V4 / "proofs" / "diagnostics" / "marble-normal-projection-analysis.json"
LOW_NAME = "Cloudway_Marble__DonorShell"
HIGH_NAME = "Cloudway_Marble__DenseBakeSource"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def percentile(values: list[float], levels: tuple[int, ...] = (0, 25, 50, 75, 90, 95, 99, 100)) -> dict[str, float]:
    if not values:
        return {}
    return {
        f"p{level}": round(float(np.percentile(np.asarray(values), level)), 8)
        for level in levels
    }


def main() -> None:
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE_BLEND), load_ui=False)
    low = bpy.data.objects.get(LOW_NAME)
    high = bpy.data.objects.get(HIGH_NAME)
    if low is None or high is None:
        raise ValueError("Packed source lost low or high diagnostic mesh")
    if low.matrix_world != high.matrix_world:
        raise ValueError("Low and high diagnostic meshes no longer share object space")

    with PILImage.open(NORMAL) as opened:
        pixels = np.asarray(opened.convert("RGB"), dtype=np.uint8)
    height, width = pixels.shape[:2]
    uv = low.data.uv_layers.active
    if uv is None:
        raise ValueError("Runtime low mesh has no active UV0")
    corner_normals = low.data.corner_normals
    tree = BVHTree.FromObject(high, bpy.context.evaluated_depsgraph_get(), epsilon=0.0)

    groups: dict[str, dict[str, list[float] | int]] = {
        "negative": {"nearestDistance": [], "nearestNormalDot": [], "productionRayNormalDot": [], "productionRayDistance": [], "productionRayMisses": 0},
        "positive": {"nearestDistance": [], "nearestNormalDot": [], "productionRayNormalDot": [], "productionRayDistance": [], "productionRayMisses": 0},
    }
    region_counts = {
        "negativeTotal": 0,
        "negativeGeometricUp": 0,
        "negativeExactContact": 0,
        "negativeFrontFacing": 0,
    }
    most_reversed = []
    for polygon in low.data.polygons:
        uv_centroid = sum((uv.data[index].uv for index in polygon.loop_indices), Vector((0.0, 0.0))) / len(polygon.loop_indices)
        x = min(width - 1, max(0, round((uv_centroid.x % 1.0) * (width - 1))))
        y = min(height - 1, max(0, round((1.0 - (uv_centroid.y % 1.0)) * (height - 1))))
        tangent_z = float(pixels[y, x, 2]) / 127.5 - 1.0
        group_name = "negative" if tangent_z < 0.0 else "positive"
        group = groups[group_name]
        center = polygon.center.copy()
        split_normal = Vector((0.0, 0.0, 0.0))
        for index in polygon.loop_indices:
            split_normal += corner_normals[index].vector
        if split_normal.length_squared <= 1e-16:
            split_normal = polygon.normal.copy()
        split_normal.normalize()

        nearest = tree.find_nearest(center)
        if nearest[0] is not None:
            group["nearestDistance"].append(float(nearest[3]))
            nearest_dot = float(split_normal.dot(nearest[1]))
            group["nearestNormalDot"].append(nearest_dot)
            if group_name == "negative" and len(most_reversed) < 200:
                most_reversed.append(
                    {
                        "polygon": polygon.index,
                        "tangentZ": tangent_z,
                        "center": [round(value, 7) for value in center],
                        "lowSplitNormal": [round(value, 7) for value in split_normal],
                        "nearestDistance": round(float(nearest[3]), 8),
                        "nearestNormalDot": round(nearest_dot, 8),
                        "nearestDensePolygon": int(nearest[2]),
                    }
                )

        origin = center + split_normal * 0.018
        hit = tree.ray_cast(origin, -split_normal, 0.093)
        if hit[0] is None:
            group["productionRayMisses"] += 1
        else:
            group["productionRayDistance"].append(float(hit[3]))
            group["productionRayNormalDot"].append(float(split_normal.dot(hit[1])))

        if group_name == "negative":
            region_counts["negativeTotal"] += 1
            if polygon.normal.z > 0.72:
                region_counts["negativeGeometricUp"] += 1
            if (
                polygon.normal.z > 0.72
                and abs(center.z) <= 0.011
                and abs(center.x) <= 0.86
                and abs(center.y) <= 0.66
            ):
                region_counts["negativeExactContact"] += 1
            if polygon.normal.y < -0.3:
                region_counts["negativeFrontFacing"] += 1

    output_groups = {}
    for name, group in groups.items():
        nearest_dots = list(group["nearestNormalDot"])
        ray_dots = list(group["productionRayNormalDot"])
        output_groups[name] = {
            "polygonCount": len(group["nearestDistance"]),
            "nearestDistanceMetres": percentile(list(group["nearestDistance"])),
            "nearestNormalDot": percentile(nearest_dots),
            "nearestOppositeOrientationCount": sum(value < 0.0 for value in nearest_dots),
            "productionRayMisses": int(group["productionRayMisses"]),
            "productionRayDistanceMetres": percentile(list(group["productionRayDistance"])),
            "productionRayNormalDot": percentile(ray_dots),
            "productionRayOppositeOrientationCount": sum(value < 0.0 for value in ray_dots),
        }
    report = {
        "schema": 1,
        "asset": "cloudway-marble-ultra-v4",
        "inputs": {
            "sourceBlend": {"file": COMMON.relative(SOURCE_BLEND), "sha256": digest(SOURCE_BLEND)},
            "normal": {"file": COMMON.relative(NORMAL), "sha256": digest(NORMAL)},
        },
        "method": (
            "Sample every low polygon at its UV centroid, compare its averaged exported split "
            "normal with the nearest dense face, and reproduce the production automatic-cage "
            "ray as an 18mm outward origin casting 93mm inward."
        ),
        "regions": region_counts,
        "groups": output_groups,
        "negativeExamples": most_reversed,
        "blender": bpy.app.version_string,
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print("CLOUDWAY_MARBLE_NORMAL_PROJECTION_ANALYSIS=" + json.dumps({
        "regions": region_counts,
        "groups": output_groups,
        "report": COMMON.relative(REPORT),
    }), flush=True)


if __name__ == "__main__":
    main()
