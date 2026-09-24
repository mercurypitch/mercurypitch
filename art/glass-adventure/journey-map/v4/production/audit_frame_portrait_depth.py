"""Measure which V1 map-frame primitive occludes the earned portrait inset."""

from __future__ import annotations

import hashlib
import json
import math
import struct
from collections import Counter
from pathlib import Path
from typing import Any


REPO = Path(__file__).resolve().parents[5]
SOURCE_REL = Path(
    "art/glass-adventure/journey-map/v2/exports/"
    "floating-museum-map-kit-v1.glb"
)
OUTPUT_REL = Path(
    "art/glass-adventure/journey-map/v4/proofs/"
    "map-frame-portrait-depth.json"
)
FRAME_SCALE = 0.72
SURFACE_CLEARANCE_LOCAL_METRES = 0.003
GRID_COLUMNS = 81
GRID_ROWS = 101


def read_glb(path: Path) -> tuple[dict[str, Any], bytes]:
    with path.open("rb") as stream:
        magic, version, _total_length = struct.unpack("<4sII", stream.read(12))
        if magic != b"glTF" or version != 2:
            raise ValueError(f"Expected a glTF 2 binary: {path}")
        json_length, json_type = struct.unpack("<II", stream.read(8))
        if json_type != 0x4E4F534A:
            raise ValueError("The first GLB chunk is not JSON.")
        document = json.loads(stream.read(json_length))
        binary_length, binary_type = struct.unpack("<II", stream.read(8))
        if binary_type != 0x004E4942:
            raise ValueError("The second GLB chunk is not BIN.")
        binary = stream.read(binary_length)
    return document, binary


def read_accessor(
    document: dict[str, Any], binary: bytes, accessor_index: int
) -> list[Any]:
    accessor = document["accessors"][accessor_index]
    view = document["bufferViews"][accessor["bufferView"]]
    component_count = {
        "SCALAR": 1,
        "VEC2": 2,
        "VEC3": 3,
        "VEC4": 4,
    }[accessor["type"]]
    component_format = {
        5121: "B",
        5123: "H",
        5125: "I",
        5126: "f",
    }[accessor["componentType"]]
    value_format = "<" + component_format * component_count
    packed_size = struct.calcsize(value_format)
    stride = view.get("byteStride", packed_size)
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    values = []
    for index in range(accessor["count"]):
        value = struct.unpack_from(value_format, binary, start + index * stride)
        values.append(value if component_count > 1 else value[0])
    return values


def triangle_hit_z(
    x: float,
    y: float,
    triangle: tuple[tuple[float, ...], tuple[float, ...], tuple[float, ...]],
) -> float | None:
    first, second, third = triangle
    denominator = (second[1] - third[1]) * (first[0] - third[0]) + (
        third[0] - second[0]
    ) * (first[1] - third[1])
    if math.isclose(denominator, 0.0, abs_tol=1e-12):
        return None
    first_weight = (
        (second[1] - third[1]) * (x - third[0])
        + (third[0] - second[0]) * (y - third[1])
    ) / denominator
    second_weight = (
        (third[1] - first[1]) * (x - third[0])
        + (first[0] - third[0]) * (y - third[1])
    ) / denominator
    third_weight = 1.0 - first_weight - second_weight
    if min(first_weight, second_weight, third_weight) < -1e-8:
        return None
    return (
        first_weight * first[2]
        + second_weight * second[2]
        + third_weight * third[2]
    )


def primitive_record(
    document: dict[str, Any], binary: bytes, primitive: dict[str, Any]
) -> dict[str, Any]:
    positions = read_accessor(document, binary, primitive["attributes"]["POSITION"])
    normals = read_accessor(document, binary, primitive["attributes"]["NORMAL"])
    uvs = read_accessor(document, binary, primitive["attributes"]["TEXCOORD_0"])
    indices = read_accessor(document, binary, primitive["indices"])
    triangles = [
        (positions[indices[index]], positions[indices[index + 1]], positions[indices[index + 2]])
        for index in range(0, len(indices), 3)
    ]
    material = document["materials"][primitive["material"]]
    return {
        "material": material["name"],
        "triangles": triangles,
        "triangleCount": len(triangles),
        "vertexCount": len(positions),
        "positionBounds": {
            "min": [min(value[axis] for value in positions) for axis in range(3)],
            "max": [max(value[axis] for value in positions) for axis in range(3)],
        },
        "normalBounds": {
            "min": [min(value[axis] for value in normals) for axis in range(3)],
            "max": [max(value[axis] for value in normals) for axis in range(3)],
        },
        "uvBounds": {
            "min": [min(value[axis] for value in uvs) for axis in range(2)],
            "max": [max(value[axis] for value in uvs) for axis in range(2)],
        },
        "doubleSided": material.get("doubleSided", False),
    }


def hits_at(
    x: float, y: float, primitives: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    hits = []
    for primitive in primitives:
        for triangle_index, triangle in enumerate(primitive["triangles"]):
            z = triangle_hit_z(x, y, triangle)
            if z is not None:
                hits.append(
                    {
                        "z": z,
                        "material": primitive["material"],
                        "triangle": triangle_index,
                    }
                )
    return hits


def main() -> None:
    source = REPO / SOURCE_REL
    document, binary = read_glb(source)
    frame_node = next(node for node in document["nodes"] if node.get("name") == "map_frame")
    mesh = document["meshes"][frame_node["mesh"]]
    primitives = [
        primitive_record(document, binary, primitive)
        for primitive in mesh["primitives"]
    ]
    inset = next(
        primitive
        for primitive in primitives
        if primitive["material"] == "map_frame_atlas_00"
    )
    ornate = next(
        primitive
        for primitive in primitives
        if primitive["material"] == "map_frame_atlas_01"
    )

    inset_min = inset["positionBounds"]["min"]
    inset_max = inset["positionBounds"]["max"]
    sample_points = [
        (0.0, 0.3),
        (0.0, 0.6),
        (0.0, 0.9),
        (0.0, 1.2),
        (0.0, 1.45),
        (-0.25, 0.5),
        (0.25, 0.5),
        (-0.25, 1.1),
        (0.25, 1.1),
    ]
    samples = []
    for x, y in sample_points:
        hits = hits_at(x, y, primitives)
        samples.append(
            {
                "xy": [x, y],
                "rotatedFrameCameraFirst": min(hits, key=lambda hit: hit["z"]),
                "unrotatedFrameCameraFirst": max(hits, key=lambda hit: hit["z"]),
                "hitsByIncreasingLocalZ": sorted(hits, key=lambda hit: hit["z"]),
            }
        )

    rotated_counts: Counter[str] = Counter()
    unrotated_counts: Counter[str] = Counter()
    rotated_ornate_depths = []
    inset_grid_samples = 0
    for row in range(GRID_ROWS):
        y = inset_min[1] + (inset_max[1] - inset_min[1]) * (row + 0.5) / GRID_ROWS
        for column in range(GRID_COLUMNS):
            x = inset_min[0] + (inset_max[0] - inset_min[0]) * (
                column + 0.5
            ) / GRID_COLUMNS
            hits = hits_at(x, y, primitives)
            inset_hits = [
                hit for hit in hits if hit["material"] == inset["material"]
            ]
            if not inset_hits:
                continue
            inset_grid_samples += 1
            rotated_first = min(hits, key=lambda hit: hit["z"])
            unrotated_first = max(hits, key=lambda hit: hit["z"])
            rotated_counts[rotated_first["material"]] += 1
            unrotated_counts[unrotated_first["material"]] += 1
            ornate_hits = [
                hit for hit in hits if hit["material"] == ornate["material"]
            ]
            if ornate_hits:
                rotated_ornate_depths.append(min(hit["z"] for hit in ornate_hits))

    frontmost_local_z = min(
        primitive["positionBounds"]["min"][2] for primitive in primitives
    )
    inset_plane_local_z = inset_min[2]
    target_overlay_local_z = (
        frontmost_local_z - SURFACE_CLEARANCE_LOCAL_METRES
    )
    overlay_translation_z = target_overlay_local_z - inset_plane_local_z
    report = {
        "schema": 1,
        "source": {
            "file": str(SOURCE_REL),
            "bytes": source.stat().st_size,
            "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        },
        "frameNode": {
            "name": "map_frame",
            "rawGltfTransform": {
                key: frame_node[key]
                for key in ("matrix", "translation", "rotation", "scale")
                if key in frame_node
            },
            "generatedPrimitiveChildrenHaveIdentityTransform": True,
            "runtimeRotationYRadians": math.pi,
            "runtimeUniformScale": FRAME_SCALE,
            "cameraSide": "+Z in monument space",
            "cameraRayInDonorCoordinates": "-Z toward +Z after rotationY=PI",
        },
        "primitives": [
            {key: value for key, value in primitive.items() if key != "triangles"}
            for primitive in primitives
        ],
        "inset": {
            "material": inset["material"],
            "purpose": "exact arched portrait surface",
            "boundsDonorLocal": inset["positionBounds"],
            "boundsRuntimeMonument": {
                "min": [
                    -inset_max[0] * FRAME_SCALE,
                    inset_min[1] * FRAME_SCALE,
                    -inset_max[2] * FRAME_SCALE,
                ],
                "max": [
                    -inset_min[0] * FRAME_SCALE,
                    inset_max[1] * FRAME_SCALE,
                    -inset_min[2] * FRAME_SCALE,
                ],
            },
            "uvBounds": inset["uvBounds"],
            "authoredUvFitsTwoByThreePortrait": True,
        },
        "raycast": {
            "method": "Exact barycentric intersections against every indexed GLB triangle at fixed XY rays.",
            "samples": samples,
            "grid": {
                "columns": GRID_COLUMNS,
                "rows": GRID_ROWS,
                "pointsInsideArchedInset": inset_grid_samples,
                "cameraFirstWithRuntimeRotation": dict(rotated_counts),
                "cameraFirstWithoutRuntimeRotation": dict(unrotated_counts),
                "rotatedAtlas01CoverDepthLocalZ": {
                    "min": min(rotated_ornate_depths),
                    "max": max(rotated_ornate_depths),
                },
            },
            "finding": (
                "With rotationY=PI, map_frame_atlas_01 is a front slab over the "
                "nominal atlas00 inset from the overview camera side."
            ),
        },
        "earnedOverlayPlacement": {
            "geometry": "clone the exact 55-triangle map_frame_atlas_00 geometry",
            "runtimeAlgorithm": (
                "minimumFrameZ(frame, frame) - 0.003 - "
                "minimumFrameZ(frame, inset)"
            ),
            "frontmostAnyDonorVertexLocalZ": frontmost_local_z,
            "frontmostAnyDonorVertexRuntimeZ": -frontmost_local_z * FRAME_SCALE,
            "configuredClearanceLocalMetres": SURFACE_CLEARANCE_LOCAL_METRES,
            "targetOverlayTotalLocalZ": target_overlay_local_z,
            "overlayChildTranslationLocalZ": overlay_translation_z,
            "targetOverlayRuntimeZ": -target_overlay_local_z * FRAME_SCALE,
            "clearanceRuntimeMetres": (
                SURFACE_CLEARANCE_LOCAL_METRES * FRAME_SCALE
            ),
            "materialRequirements": [
                "DoubleSide because the runtime camera sees the rotated back face",
                "authored UV crop retained",
                "repeat.x=-1 and offset.x=1 for the rotationY=PI horizontal flip",
            ],
            "note": (
                "The arched inset outline, rather than a rectangle, keeps the earned "
                "surface inside the gilded rim when placed ahead of the donor slab."
            ),
        },
    }
    output = REPO / OUTPUT_REL
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n")
    print(output.relative_to(REPO))


if __name__ == "__main__":
    main()
