#!/usr/bin/env python3
"""Audit the V7 source-preserved marble delivery against its raw 2K export."""

from __future__ import annotations

import gzip
import hashlib
import json
import math
from pathlib import Path
import struct
from typing import Any

import bpy
from mathutils import Vector
import numpy as np


HERE = Path(__file__).resolve().parent
V7 = HERE.parent
REPO = HERE.parents[4]
RAW = V7 / "exports" / "cloudway-marble-v7-dense-baseline-2k.glb"
DELIVERY = V7 / "exports" / "delivery" / "cloudway-marble-v7-dense-baseline-delivery-2k.glb"
VALIDATOR = V7 / "exports" / "delivery" / "cloudway-marble-v7-dense-baseline-delivery-2k-validator.txt"
REPORT = V7 / "proofs" / "diagnostics" / "dense-baseline-delivery-audit.json"
ROOT_NAME = "Cloudway_Marble"
EXPECTED_TRIANGLES = 1_256_556
EXPECTED_EXTENSIONS = {"EXT_texture_webp", "KHR_mesh_quantization"}


def digest_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def relative(path: Path) -> str:
    return str(path.relative_to(REPO))


def file_record(path: Path) -> dict[str, object]:
    data = path.read_bytes()
    return {
        "file": relative(path),
        "bytes": len(data),
        "gzipBytes": len(gzip.compress(data, compresslevel=9)),
        "sha256": digest_bytes(data),
    }


def read_glb(path: Path) -> tuple[dict[str, Any], bytes]:
    with path.open("rb") as handle:
        magic, version, _length = struct.unpack("<4sII", handle.read(12))
        if magic != b"glTF" or version != 2:
            raise ValueError(f"{path.name} is not glTF 2")
        json_length, json_type = struct.unpack("<I4s", handle.read(8))
        if json_type != b"JSON":
            raise ValueError(f"{path.name} has no JSON first chunk")
        document = json.loads(handle.read(json_length).decode("utf-8").rstrip(" \t\r\n\x00"))
        bin_length, bin_type = struct.unpack("<I4s", handle.read(8))
        if bin_type != b"BIN\x00":
            raise ValueError(f"{path.name} has no BIN chunk")
        binary = handle.read(bin_length)
    return document, binary


def component_bytes(component_type: int) -> int:
    result = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}.get(component_type)
    if result is None:
        raise ValueError(f"Unknown glTF component type {component_type}")
    return result


def component_count(accessor_type: str) -> int:
    result = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT2": 4, "MAT3": 9, "MAT4": 16}.get(accessor_type)
    if result is None:
        raise ValueError(f"Unknown glTF accessor type {accessor_type}")
    return result


def gltf_cost(document: dict[str, Any]) -> dict[str, object]:
    scene_index = int(document.get("scene", 0))
    scene = document["scenes"][scene_index]
    root_indices = scene["nodes"]
    root_names = [document["nodes"][index].get("name") for index in root_indices]
    if root_names != [ROOT_NAME]:
        raise ValueError(f"Expected direct scene root {ROOT_NAME}; got {root_names}")
    primitives = [primitive for mesh in document.get("meshes", []) for primitive in mesh["primitives"]]
    if len(primitives) != 1:
        raise ValueError(f"Expected one mesh primitive, found {len(primitives)}")
    primitive = primitives[0]
    accessor_indices = {int(primitive["indices"]), *(int(value) for value in primitive["attributes"].values())}
    rows = []
    geometry_bytes = 0
    for index in sorted(accessor_indices):
        accessor = document["accessors"][index]
        payload = int(accessor["count"]) * component_count(accessor["type"]) * component_bytes(int(accessor["componentType"]))
        geometry_bytes += payload
        semantic = "INDICES" if index == int(primitive["indices"]) else next(
            key for key, value in primitive["attributes"].items() if int(value) == index
        )
        rows.append(
            {
                "semantic": semantic,
                "count": int(accessor["count"]),
                "type": accessor["type"],
                "componentType": int(accessor["componentType"]),
                "normalized": bool(accessor.get("normalized", False)),
                "payloadBytes": payload,
            }
        )
    index_accessor = document["accessors"][int(primitive["indices"])]
    triangles = int(index_accessor["count"]) // 3
    position_accessor = document["accessors"][int(primitive["attributes"]["POSITION"])]
    images = []
    for image in document.get("images", []):
        view = document["bufferViews"][int(image["bufferView"])]
        images.append(
            {
                "name": image.get("name"),
                "mimeType": image.get("mimeType"),
                "encodedBytes": int(view["byteLength"]),
            }
        )
    decoded_base_bytes = len(images) * 2048 * 2048 * 4
    decoded_mipped_bytes = int(round(decoded_base_bytes * 4.0 / 3.0))
    return {
        "directSceneRoots": root_names,
        "meshes": len(document.get("meshes", [])),
        "primitives": len(primitives),
        "triangles": triangles,
        "renderVerticesPerPass": int(index_accessor["count"]),
        "uploadedVertices": int(position_accessor["count"]),
        "geometryPayloadBytes": geometry_bytes,
        "geometryPayloadMiB": geometry_bytes / (1024 * 1024),
        "accessors": rows,
        "images": images,
        "decodedTextureBaseBytes": decoded_base_bytes,
        "decodedTextureBaseMiB": decoded_base_bytes / (1024 * 1024),
        "decodedTextureWithMipmapsBytes": decoded_mipped_bytes,
        "decodedTextureWithMipmapsMiB": decoded_mipped_bytes / (1024 * 1024),
        "estimatedGeometryPlusMippedTexturesMiB": (geometry_bytes + decoded_mipped_bytes) / (1024 * 1024),
        "extensionsUsed": sorted(document.get("extensionsUsed", [])),
        "extensionsRequired": sorted(document.get("extensionsRequired", [])),
    }


def descendants(root: bpy.types.Object) -> list[bpy.types.Object]:
    result: list[bpy.types.Object] = []
    pending = list(root.children)
    while pending:
        current = pending.pop()
        result.append(current)
        pending.extend(current.children)
    return result


def imported_geometry(path: Path) -> dict[str, object]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    roots = [obj for obj in bpy.context.scene.objects if obj.name == ROOT_NAME]
    if len(roots) != 1:
        raise ValueError(f"Fresh import expected one {ROOT_NAME}, found {len(roots)}")
    root = roots[0]
    meshes = [obj for obj in descendants(root) if obj.type == "MESH"]
    if len(meshes) != 1:
        raise ValueError(f"Fresh import expected one owned mesh, found {len(meshes)}")
    obj = meshes[0]
    obj.data.calc_loop_triangles()
    triangles = len(obj.data.loop_triangles)
    if triangles != EXPECTED_TRIANGLES:
        raise ValueError(f"Triangle count changed: {triangles}")
    points = np.asarray(
        [tuple(obj.matrix_world @ vertex.co) for vertex in obj.data.vertices],
        dtype=np.float64,
    )
    indices = np.asarray(
        [vertex for triangle in obj.data.loop_triangles for vertex in triangle.vertices],
        dtype=np.int32,
    )
    low = points.min(axis=0)
    high = points.max(axis=0)
    extras: dict[str, object] = {}
    for key in root.keys():
        value = root[key]
        extras[key] = list(value) if hasattr(value, "to_list") else value
    images = [
        {
            "name": image.name,
            "width": int(image.size[0]),
            "height": int(image.size[1]),
            "fileFormat": image.file_format,
        }
        for image in bpy.data.images
        if image.type == "IMAGE"
    ]
    return {
        "positions": points,
        "indices": indices,
        "vertices": len(obj.data.vertices),
        "triangles": triangles,
        "triangleIndicesInt32Sha256": hashlib.sha256(indices.tobytes()).hexdigest(),
        "boundsBlenderZUpMetres": {
            "min": [float(value) for value in low],
            "max": [float(value) for value in high],
        },
        "rootExtras": extras,
        "materials": [material.name for material in obj.data.materials],
        "images": images,
    }


def serializable_geometry(value: dict[str, object]) -> dict[str, object]:
    return {key: item for key, item in value.items() if key not in {"positions", "indices"}}


def main() -> None:
    if not VALIDATOR.exists() or "no errors found" not in VALIDATOR.read_text().lower():
        raise ValueError("Khronos validator output is missing or does not report zero errors")
    raw_document, _ = read_glb(RAW)
    delivery_document, _ = read_glb(DELIVERY)
    raw_geometry = imported_geometry(RAW)
    delivery_geometry = imported_geometry(DELIVERY)
    if raw_geometry["positions"].shape != delivery_geometry["positions"].shape:
        raise ValueError("Quantized delivery changed imported vertex count")
    if raw_geometry["indices"].shape != delivery_geometry["indices"].shape:
        raise ValueError("Quantized delivery changed imported index count")
    if not np.array_equal(raw_geometry["indices"], delivery_geometry["indices"]):
        raise ValueError("Quantized delivery changed triangle indices or ordering")
    error = np.linalg.norm(raw_geometry["positions"] - delivery_geometry["positions"], axis=1)
    maximum_error = float(error.max())
    p95_error = float(np.percentile(error, 95))
    if maximum_error > 0.000040:
        raise ValueError(f"Quantization displaced a vertex by {maximum_error:.9f}m")
    bounds_error = max(
        abs(
            raw_geometry["boundsBlenderZUpMetres"][edge][axis]
            - delivery_geometry["boundsBlenderZUpMetres"][edge][axis]
        )
        for edge in ("min", "max")
        for axis in range(3)
    )
    if bounds_error > 0.000040:
        raise ValueError(f"Quantized delivery bounds drifted by {bounds_error:.9f}m")
    delivery_cost = gltf_cost(delivery_document)
    required = set(delivery_cost["extensionsRequired"])
    if required != EXPECTED_EXTENSIONS:
        raise ValueError(f"Unexpected required extensions: {sorted(required)}")
    if delivery_cost["triangles"] != EXPECTED_TRIANGLES:
        raise ValueError("Delivery GLB triangle count changed")
    if len(delivery_cost["images"]) != 3 or any(
        image["mimeType"] != "image/webp" for image in delivery_cost["images"]
    ):
        raise ValueError("Delivery must contain exactly three WebP images")
    if any(image["width"] != 2048 or image["height"] != 2048 for image in delivery_geometry["images"]):
        raise ValueError("Fresh import did not decode every texture at 2K")
    collider = delivery_geometry["rootExtras"].get("colliderSizeMetres")
    if collider != [1.7, 0.24, 1.3]:
        raise ValueError(f"Collider envelope changed: {collider}")
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    report = {
        "schema": 1,
        "status": "passed",
        "purpose": "Measure the source-preserved 2K quantized marble baseline before any semantic simplification.",
        "artifacts": {
            "raw": file_record(RAW),
            "delivery": file_record(DELIVERY),
            "validator": file_record(VALIDATOR),
        },
        "topology": {
            "expectedTriangles": EXPECTED_TRIANGLES,
            "rawFreshImport": serializable_geometry(raw_geometry),
            "deliveryFreshImport": serializable_geometry(delivery_geometry),
            "triangleIndexOrderingPreserved": True,
        },
        "quantization": {
            "method": "KHR_mesh_quantization; 16-bit position, normal, tangent, and UV attributes; per-mesh volume",
            "maximumWorldVertexErrorMetres": maximum_error,
            "p95WorldVertexErrorMetres": p95_error,
            "maximumBoundsErrorMetres": bounds_error,
        },
        "runtimeCost": delivery_cost,
        "runtimeContract": {
            "plainThreeGltfLoader": True,
            "decoderRequired": False,
            "requiredExtensions": sorted(EXPECTED_EXTENSIONS),
            "oneMeshPrototype": True,
            "topologyReduction": False,
        },
        "rawGlbCost": gltf_cost(raw_document),
        "command": (
            "rtk proxy timeout 900 env ALSOFT_DRIVERS=null blender -b --factory-startup "
            "--python-exit-code 1 --python art/glass-adventure/platform-trials/v7/production/"
            "audit_marble_dense_delivery.py"
        ),
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print("V7_MARBLE_DENSE_DELIVERY_AUDIT=" + json.dumps(report), flush=True)


if __name__ == "__main__":
    main()
