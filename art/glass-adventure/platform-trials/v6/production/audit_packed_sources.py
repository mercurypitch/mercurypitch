#!/usr/bin/env python3
"""Reopen and structurally audit the packed V6 Frost and Glide Blender projects."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import math
from pathlib import Path
from typing import Any

import bpy
from mathutils import Vector


HERE = Path(__file__).resolve().parent
V6 = HERE.parent
REPO = HERE.parents[4]
REPORT = V6 / "proofs" / "diagnostics" / "packed-source-audit.json"

ASSETS: dict[str, dict[str, Any]] = {
    "frost": {
        "root": "Cloudway_Frost",
        "donor": "frost_dense_donor",
        "donorVertices": 339_884,
        "donorTriangles": 632_256,
        "totalTriangles": 634_512,
        "meshObjects": 13,
    },
    "glide": {
        "root": "Cloudway_Glide",
        "donor": "glide_dense_donor",
        "donorVertices": 82_069,
        "donorTriangles": 145_370,
        "totalTriangles": 147_250,
        "meshObjects": 11,
    },
}


def load_build_helper() -> Any:
    path = HERE / "build_fitted_derivative.py"
    spec = importlib.util.spec_from_file_location("v6_build_audit_helper", path)
    if spec is None or spec.loader is None:
        raise ValueError(f"Could not load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


BUILD = load_build_helper()


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


def audit_asset(asset: str, expected: dict[str, Any]) -> dict[str, Any]:
    path = V6 / "sources" / f"{asset}-v6-derivative.blend"
    before_hash = digest(path)
    before_bytes = path.stat().st_size
    bpy.ops.wm.open_mainfile(filepath=str(path), load_ui=False)
    roots = [obj for obj in bpy.data.objects if obj.name == expected["root"]]
    if len(roots) != 1:
        raise ValueError(f"{asset} packed source expected one root, found {len(roots)}")
    root = roots[0]
    owned = descendants(root)
    meshes = [obj for obj in owned if obj.type == "MESH"]
    if len(meshes) != expected["meshObjects"]:
        raise ValueError(f"{asset} packed source mesh count changed: {len(meshes)}")
    donor = bpy.data.objects.get(expected["donor"])
    if donor is None or donor not in owned or donor.type != "MESH":
        raise ValueError(f"{asset} packed source lost its dense donor")
    donor.data.calc_loop_triangles()
    if len(donor.data.vertices) != expected["donorVertices"]:
        raise ValueError(f"{asset} packed donor vertex count changed")
    if len(donor.data.loop_triangles) != expected["donorTriangles"]:
        raise ValueError(f"{asset} packed donor triangle count changed")
    total_triangles = 0
    nonfinite_positions = 0
    for obj in meshes:
        obj.data.calc_loop_triangles()
        total_triangles += len(obj.data.loop_triangles)
        nonfinite_positions += sum(
            1
            for vertex in obj.data.vertices
            if not all(math.isfinite(float(value)) for value in vertex.co)
        )
    if total_triangles != expected["totalTriangles"] or nonfinite_positions:
        raise ValueError(
            f"{asset} packed topology invalid: {total_triangles} triangles, "
            f"{nonfinite_positions} nonfinite positions"
        )

    file_images = [image for image in bpy.data.images if image.type == "IMAGE"]
    unpacked = [image.name for image in file_images if image.packed_file is None]
    if unpacked:
        raise ValueError(f"{asset} packed source has unpacked images: {unpacked}")
    expected_materials = {
        f"{asset}_glass_ice_gold",
        f"{asset}_landing_glass",
        f"{asset}_opaque_gold_boundary",
    }
    actual_materials = {material.name for material in bpy.data.materials}
    if expected_materials.difference(actual_materials):
        raise ValueError(f"{asset} packed source lost materials: {expected_materials - actual_materials}")

    landing = [obj for obj in meshes if obj.get("role") == "landing-extension"]
    boundary = [obj for obj in meshes if obj.get("role") == "landing-boundary"]
    seams = [obj for obj in meshes if obj.get("role") == "donor-frame-seam"]
    if not landing or len(boundary) != 4 or len(seams) not in (2, 4):
        raise ValueError(
            f"{asset} authored role inventory changed: "
            f"landing={len(landing)} boundary={len(boundary)} seams={len(seams)}"
        )
    landing_low, landing_high = bounds(landing)
    boundary_low, boundary_high = bounds(boundary)
    full_low, full_high = bounds(meshes)
    if abs(boundary_low.x + 0.85) > 1e-6 or abs(boundary_high.x - 0.85) > 1e-6:
        raise ValueError(f"{asset} boundary no longer marks the exact 1.70m width")
    if abs(boundary_low.y + 0.65) > 1e-6 or abs(boundary_high.y - 0.65) > 1e-6:
        raise ValueError(f"{asset} boundary no longer marks the exact 1.30m depth")
    if abs(landing_high.z) > 1e-6:
        raise ValueError(f"{asset} landing extension top is not Blender Z=0")

    after_hash = digest(path)
    after_bytes = path.stat().st_size
    if before_hash != after_hash or before_bytes != after_bytes:
        raise ValueError(f"Opening {asset} packed source mutated it")
    return {
        "asset": asset,
        "file": relative(path),
        "bytes": before_bytes,
        "sha256": before_hash,
        "root": root.name,
        "ownedMeshObjects": len(meshes),
        "topology": {
            "donorVertices": len(donor.data.vertices),
            "donorTriangles": len(donor.data.loop_triangles),
            "donorHashes": BUILD.mesh_hashes(donor.data),
            "totalTriangles": total_triangles,
            "nonfinitePositions": nonfinite_positions,
        },
        "packedImages": [
            {
                "name": image.name,
                "dimensions": [int(image.size[0]), int(image.size[1])],
                "packed": image.packed_file is not None,
            }
            for image in sorted(file_images, key=lambda item: item.name)
        ],
        "materials": sorted(actual_materials),
        "authoredGeometry": {
            "landingExtensionObjects": len(landing),
            "landingBoundsBlenderZUpMetres": {
                "min": vector(landing_low),
                "max": vector(landing_high),
            },
            "boundaryObjects": len(boundary),
            "boundaryBoundsBlenderZUpMetres": {
                "min": vector(boundary_low),
                "max": vector(boundary_high),
            },
            "seamObjects": len(seams),
        },
        "fullBoundsBlenderZUpMetres": {"min": vector(full_low), "max": vector(full_high)},
        "reopenMutatedFile": False,
    }


def main() -> None:
    rows = [audit_asset(asset, expected) for asset, expected in ASSETS.items()]
    report = {
        "schema": 1,
        "purpose": "Fresh reopen audit of packed V6 authoring projects",
        "status": "passed",
        "assets": rows,
        "tool": {"blender": bpy.app.version_string},
        "command": (
            "rtk proxy timeout 1800 env ALSOFT_DRIVERS=null blender -b --factory-startup "
            "--python-exit-code 1 --python art/glass-adventure/platform-trials/v6/production/"
            "audit_packed_sources.py"
        ),
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print("V6_PACKED_AUDIT=" + json.dumps(report), flush=True)
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
