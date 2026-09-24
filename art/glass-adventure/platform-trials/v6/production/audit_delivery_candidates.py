#!/usr/bin/env python3
"""Audit V6 delivery GLBs against their 4K master exports without changing topology."""

from __future__ import annotations

import gzip
import hashlib
import io
import json
import math
import struct
from pathlib import Path
from typing import Any

import bpy
import numpy as np
from PIL import Image


HERE = Path(__file__).resolve().parent
V6 = HERE.parent
REPO = HERE.parents[4]
EXPORTS = V6 / "exports"
DELIVERY = EXPORTS / "delivery"
REPORT = V6 / "proofs" / "diagnostics" / "delivery-candidate-audit.json"

ASSETS: dict[str, dict[str, Any]] = {
    "frost": {
        "root": "Cloudway_Frost",
        "triangles": 634_512,
        "donorTriangles": 632_256,
    },
    "glide": {
        "root": "Cloudway_Glide",
        "triangles": 147_250,
        "donorTriangles": 145_370,
    },
}

EXPECTED_EXTENSIONS = {
    "EXT_texture_webp",
    "KHR_materials_clearcoat",
    "KHR_materials_ior",
    "KHR_materials_transmission",
    "KHR_materials_volume",
    "KHR_mesh_quantization",
}
FORBIDDEN_DECODER_EXTENSIONS = {
    "EXT_meshopt_compression",
    "KHR_draco_mesh_compression",
    "KHR_meshopt_compression",
    "KHR_texture_basisu",
}


def relative(path: Path) -> str:
    return str(path.relative_to(REPO))


def digest_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def vector(value: np.ndarray) -> list[float]:
    return [round(float(component), 9) for component in value]


def parse_glb(path: Path) -> tuple[dict[str, Any], bytes, bytes]:
    blob = path.read_bytes()
    if len(blob) < 20:
        raise ValueError(f"{path} is too short to be a GLB")
    magic, version, declared_length = struct.unpack_from("<III", blob, 0)
    if magic != 0x46546C67 or version != 2 or declared_length != len(blob):
        raise ValueError(f"{path} has an invalid GLB header")
    json_chunk: bytes | None = None
    binary_chunk = b""
    cursor = 12
    while cursor < len(blob):
        chunk_length, chunk_type = struct.unpack_from("<II", blob, cursor)
        cursor += 8
        chunk = blob[cursor : cursor + chunk_length]
        cursor += chunk_length
        if chunk_type == 0x4E4F534A:
            json_chunk = chunk
        elif chunk_type == 0x004E4942:
            binary_chunk = chunk
    if json_chunk is None:
        raise ValueError(f"{path} has no JSON chunk")
    return json.loads(json_chunk.rstrip(b" \t\r\n\x00")), binary_chunk, blob


def buffer_view(document: dict[str, Any], binary: bytes, index: int) -> bytes:
    view = document["bufferViews"][index]
    start = int(view.get("byteOffset", 0))
    end = start + int(view["byteLength"])
    return binary[start:end]


def embedded_images(document: dict[str, Any], binary: bytes) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for index, image in enumerate(document.get("images", [])):
        if "bufferView" not in image:
            raise ValueError(f"Image {index} is not embedded")
        payload = buffer_view(document, binary, int(image["bufferView"]))
        with Image.open(io.BytesIO(payload)) as opened:
            opened.load()
            dimensions = list(opened.size)
            mode = opened.mode
        name = image.get("name") or f"image-{index}"
        result[name] = {
            "name": name,
            "mimeType": image.get("mimeType"),
            "bytes": len(payload),
            "sha256": digest_bytes(payload),
            "dimensions": dimensions,
            "mode": mode,
            "payload": payload,
        }
    return result


def texture_quality(
    master_images: dict[str, dict[str, Any]],
    delivery_images: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    if set(master_images) != set(delivery_images):
        raise ValueError("Master and delivery texture names differ")
    rows: list[dict[str, Any]] = []
    for name in sorted(master_images):
        master = master_images[name]
        delivery = delivery_images[name]
        with Image.open(io.BytesIO(master["payload"])) as opened:
            reference_image = opened.convert("RGBA")
            if reference_image.size != tuple(delivery["dimensions"]):
                reference_image = reference_image.resize(
                    tuple(delivery["dimensions"]), Image.Resampling.LANCZOS
                )
            reference = np.asarray(reference_image, dtype=np.float32)
        with Image.open(io.BytesIO(delivery["payload"])) as opened:
            candidate = np.asarray(opened.convert("RGBA"), dtype=np.float32)
        difference = candidate - reference
        mse = float(np.mean(np.square(difference, dtype=np.float64)))
        psnr = math.inf if mse == 0.0 else 20.0 * math.log10(255.0 / math.sqrt(mse))
        rows.append(
            {
                "name": name,
                "masterDimensions": master["dimensions"],
                "deliveryDimensions": delivery["dimensions"],
                "deliveryMimeType": delivery["mimeType"],
                "deliveryBytes": delivery["bytes"],
                "meanAbsoluteChannelError8Bit": round(float(np.mean(np.abs(difference))), 6),
                "maxAbsoluteChannelError8Bit": int(np.max(np.abs(difference))),
                "psnrDbAgainstLanczosMatchedMaster": (
                    "lossless" if math.isinf(psnr) else round(psnr, 4)
                ),
            }
        )
    return rows


def component_bytes(component_type: int) -> int:
    return {
        5120: 1,
        5121: 1,
        5122: 2,
        5123: 2,
        5125: 4,
        5126: 4,
    }[component_type]


def component_count(accessor_type: str) -> int:
    return {
        "SCALAR": 1,
        "VEC2": 2,
        "VEC3": 3,
        "VEC4": 4,
        "MAT2": 4,
        "MAT3": 9,
        "MAT4": 16,
    }[accessor_type]


def geometry_accessor_bytes(document: dict[str, Any]) -> int:
    referenced: set[int] = set()
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            if "indices" in primitive:
                referenced.add(int(primitive["indices"]))
            referenced.update(int(index) for index in primitive.get("attributes", {}).values())
    total = 0
    for index in referenced:
        accessor = document["accessors"][index]
        total += (
            int(accessor["count"])
            * component_bytes(int(accessor["componentType"]))
            * component_count(accessor["type"])
        )
    return total


def mipmapped_rgba_bytes(images: dict[str, dict[str, Any]]) -> int:
    total = 0
    for image in images.values():
        width, height = image["dimensions"]
        while True:
            total += width * height * 4
            if width == 1 and height == 1:
                break
            width = max(1, width // 2)
            height = max(1, height // 2)
    return total


def descendants(root: bpy.types.Object) -> list[bpy.types.Object]:
    result: list[bpy.types.Object] = []
    pending = list(root.children)
    while pending:
        current = pending.pop()
        result.append(current)
        pending.extend(current.children)
    return result


def imported_snapshot(path: Path, root_name: str) -> dict[str, Any]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    roots = [obj for obj in bpy.data.objects if obj.name == root_name]
    if len(roots) != 1:
        raise ValueError(f"Expected one {root_name} in {path}, found {len(roots)}")
    root = roots[0]
    bpy.context.view_layer.update()
    meshes = sorted(
        (obj for obj in descendants(root) if obj.type == "MESH"), key=lambda obj: obj.name
    )
    result: dict[str, Any] = {"root": root.name, "meshes": {}, "triangles": 0}
    for obj in meshes:
        mesh = obj.data
        mesh.calc_loop_triangles()
        coordinates = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
        mesh.vertices.foreach_get("co", coordinates)
        coordinates = coordinates.reshape((-1, 3)).astype(np.float64)
        matrix = np.asarray(obj.matrix_world, dtype=np.float64)
        world_positions = coordinates @ matrix[:3, :3].T + matrix[:3, 3]

        indices = np.empty(len(mesh.loop_triangles) * 3, dtype=np.int32)
        mesh.loop_triangles.foreach_get("vertices", indices)
        indices = indices.reshape((-1, 3))

        corner_normals = np.empty(len(mesh.corner_normals) * 3, dtype=np.float32)
        mesh.corner_normals.foreach_get("vector", corner_normals)
        corner_normals = corner_normals.reshape((-1, 3)).astype(np.float64)
        normal_matrix = np.linalg.inv(matrix[:3, :3]).T
        world_normals = corner_normals @ normal_matrix.T
        normal_lengths = np.linalg.norm(world_normals, axis=1)
        normal_valid = normal_lengths > 1e-12
        world_normals /= np.maximum(normal_lengths[:, None], 1e-30)

        if not mesh.uv_layers.active:
            raise ValueError(f"{obj.name} has no active UV layer")
        uv_values = np.empty(len(mesh.uv_layers.active.data) * 2, dtype=np.float32)
        mesh.uv_layers.active.data.foreach_get("uv", uv_values)
        uv_values = uv_values.reshape((-1, 2)).astype(np.float64)

        result["meshes"][obj.name] = {
            "positions": world_positions,
            "indices": indices,
            "normals": world_normals,
            "normalValid": normal_valid,
            "uv": uv_values,
            "boundsMin": world_positions.min(axis=0),
            "boundsMax": world_positions.max(axis=0),
        }
        result["triangles"] += len(indices)
    return result


def compare_snapshots(master: dict[str, Any], delivery: dict[str, Any]) -> dict[str, Any]:
    if master["root"] != delivery["root"]:
        raise ValueError("Delivery root name changed")
    if set(master["meshes"]) != set(delivery["meshes"]):
        raise ValueError("Delivery mesh-object inventory changed")
    rows: list[dict[str, Any]] = []
    all_position_squared = 0.0
    position_values = 0
    all_normal_angle_squared = 0.0
    normal_values = 0
    all_uv_squared = 0.0
    uv_values = 0
    global_max_position = 0.0
    global_max_normal_angle = 0.0
    global_max_uv = 0.0
    total_normal_validity_changes = 0
    total_normal_validity_losses = 0
    total_normal_validity_gains = 0
    for name in sorted(master["meshes"]):
        reference = master["meshes"][name]
        candidate = delivery["meshes"][name]
        for key in ("positions", "indices", "normals", "uv"):
            if reference[key].shape != candidate[key].shape:
                raise ValueError(f"{name} {key} shape changed")
        if not np.array_equal(reference["indices"], candidate["indices"]):
            raise ValueError(f"{name} triangle indices changed")

        position_delta = candidate["positions"] - reference["positions"]
        position_distance = np.linalg.norm(position_delta, axis=1)
        jointly_valid_normals = reference["normalValid"] & candidate["normalValid"]
        normal_validity_changed = int(
            np.count_nonzero(reference["normalValid"] != candidate["normalValid"])
        )
        normal_validity_lost = int(
            np.count_nonzero(reference["normalValid"] & ~candidate["normalValid"])
        )
        normal_validity_gained = int(
            np.count_nonzero(~reference["normalValid"] & candidate["normalValid"])
        )
        normal_dot = np.sum(
            reference["normals"][jointly_valid_normals]
            * candidate["normals"][jointly_valid_normals],
            axis=1,
        )
        normal_angle = np.degrees(np.arccos(np.clip(normal_dot, -1.0, 1.0)))
        uv_delta = np.abs(candidate["uv"] - reference["uv"])
        max_position = float(position_distance.max(initial=0.0))
        max_normal_angle = float(normal_angle.max(initial=0.0))
        max_uv = float(uv_delta.max(initial=0.0))
        global_max_position = max(global_max_position, max_position)
        global_max_normal_angle = max(global_max_normal_angle, max_normal_angle)
        global_max_uv = max(global_max_uv, max_uv)
        total_normal_validity_changes += normal_validity_changed
        total_normal_validity_losses += normal_validity_lost
        total_normal_validity_gains += normal_validity_gained
        all_position_squared += float(np.sum(np.square(position_distance, dtype=np.float64)))
        position_values += len(position_distance)
        all_normal_angle_squared += float(np.sum(np.square(normal_angle, dtype=np.float64)))
        normal_values += len(normal_angle)
        all_uv_squared += float(np.sum(np.square(uv_delta, dtype=np.float64)))
        uv_values += uv_delta.size
        rows.append(
            {
                "object": name,
                "vertices": len(reference["positions"]),
                "triangles": len(reference["indices"]),
                "triangleIndicesInt32Sha256": digest_bytes(
                    reference["indices"].astype(np.int32, copy=False).tobytes()
                ),
                "maxWorldPositionDeltaMetres": round(max_position, 9),
                "rmsWorldPositionDeltaMetres": round(
                    float(math.sqrt(np.mean(np.square(position_distance, dtype=np.float64)))), 9
                ),
                "maxCornerNormalDeltaDegrees": round(max_normal_angle, 6),
                "rmsCornerNormalDeltaDegrees": round(
                    float(math.sqrt(np.mean(np.square(normal_angle, dtype=np.float64)))), 6
                ),
                "maxUvDelta": round(max_uv, 9),
                "rmsUvDelta": round(
                    float(math.sqrt(np.mean(np.square(uv_delta, dtype=np.float64)))), 9
                ),
                "masterInvalidCornerNormals": int(
                    np.count_nonzero(~reference["normalValid"])
                ),
                "deliveryInvalidCornerNormals": int(
                    np.count_nonzero(~candidate["normalValid"])
                ),
                "normalValidityChanged": normal_validity_changed,
                "normalValidityLost": normal_validity_lost,
                "normalValidityGained": normal_validity_gained,
                "masterBoundsBlenderZUpMetres": {
                    "min": vector(reference["boundsMin"]),
                    "max": vector(reference["boundsMax"]),
                },
                "deliveryBoundsBlenderZUpMetres": {
                    "min": vector(candidate["boundsMin"]),
                    "max": vector(candidate["boundsMax"]),
                },
            }
        )

    boundary = [
        row for row in rows if "_outer_gold_" in row["object"]
    ]
    landing = [
        row for row in rows if "_landing_" in row["object"]
    ]
    boundary_low = np.min(
        [delivery["meshes"][row["object"]]["boundsMin"] for row in boundary], axis=0
    )
    boundary_high = np.max(
        [delivery["meshes"][row["object"]]["boundsMax"] for row in boundary], axis=0
    )
    landing_low = np.min(
        [delivery["meshes"][row["object"]]["boundsMin"] for row in landing], axis=0
    )
    landing_high = np.max(
        [delivery["meshes"][row["object"]]["boundsMax"] for row in landing], axis=0
    )
    return {
        "meshObjects": len(rows),
        "triangles": master["triangles"],
        "triangleIndicesExactlyPreserved": True,
        "maxWorldPositionDeltaMetres": round(global_max_position, 9),
        "rmsWorldPositionDeltaMetres": round(
            math.sqrt(all_position_squared / max(position_values, 1)), 9
        ),
        "maxCornerNormalDeltaDegrees": round(global_max_normal_angle, 6),
        "rmsCornerNormalDeltaDegrees": round(
            math.sqrt(all_normal_angle_squared / max(normal_values, 1)), 6
        ),
        "maxUvDelta": round(global_max_uv, 9),
        "rmsUvDelta": round(math.sqrt(all_uv_squared / max(uv_values, 1)), 9),
        "normalValidityChanges": total_normal_validity_changes,
        "normalValidityLosses": total_normal_validity_losses,
        "normalValidityGains": total_normal_validity_gains,
        "deliveryBoundaryBoundsBlenderZUpMetres": {
            "min": vector(boundary_low),
            "max": vector(boundary_high),
        },
        "deliveryLandingExtensionBoundsBlenderZUpMetres": {
            "min": vector(landing_low),
            "max": vector(landing_high),
        },
        "objects": rows,
    }


def audit_asset(asset: str, expected: dict[str, Any]) -> dict[str, Any]:
    master_path = EXPORTS / f"cloudway-{asset}-v6-derivative.glb"
    delivery_path = DELIVERY / f"cloudway-{asset}-v6-delivery-2k.glb"
    validator_path = DELIVERY / f"cloudway-{asset}-v6-delivery-2k-validator.txt"
    master_json, master_binary, master_blob = parse_glb(master_path)
    delivery_json, delivery_binary, delivery_blob = parse_glb(delivery_path)
    master_images = embedded_images(master_json, master_binary)
    delivery_images = embedded_images(delivery_json, delivery_binary)
    texture_rows = texture_quality(master_images, delivery_images)
    master_snapshot = imported_snapshot(master_path, expected["root"])
    delivery_snapshot = imported_snapshot(delivery_path, expected["root"])
    geometry = compare_snapshots(master_snapshot, delivery_snapshot)
    print(
        f"{asset} geometry deltas: position={geometry['maxWorldPositionDeltaMetres']} "
        f"normal={geometry['maxCornerNormalDeltaDegrees']} uv={geometry['maxUvDelta']} "
        f"normalValidityChanges={geometry['normalValidityChanges']}",
        flush=True,
    )
    for row in geometry["objects"]:
        if row["maxCornerNormalDeltaDegrees"] > 1.0 or row["normalValidityChanged"]:
            print(
                f"{asset} normal outlier: {row['object']} "
                f"max={row['maxCornerNormalDeltaDegrees']} "
                f"rms={row['rmsCornerNormalDeltaDegrees']} "
                f"masterInvalid={row['masterInvalidCornerNormals']} "
                f"deliveryInvalid={row['deliveryInvalidCornerNormals']} "
                f"validityChanged={row['normalValidityChanged']}",
                flush=True,
            )

    extensions_used = set(delivery_json.get("extensionsUsed", []))
    extensions_required = set(delivery_json.get("extensionsRequired", []))
    validator = validator_path.read_text()
    if geometry["triangles"] != expected["triangles"]:
        raise ValueError(f"{asset} triangle count changed")
    donor_row = next(
        row for row in geometry["objects"] if row["object"] == f"{asset}_dense_donor"
    )
    if donor_row["triangles"] != expected["donorTriangles"]:
        raise ValueError(f"{asset} donor triangle count changed")
    if geometry["maxWorldPositionDeltaMetres"] > 0.00005:
        raise ValueError(f"{asset} 16-bit position quantization exceeded 0.05 mm")
    if geometry["maxCornerNormalDeltaDegrees"] > 1.0:
        raise ValueError(f"{asset} normal quantization exceeded 1 degree")
    if geometry["normalValidityLosses"]:
        raise ValueError(f"{asset} delivery introduced invalid corner normals")
    if geometry["maxUvDelta"] > 0.00005:
        raise ValueError(f"{asset} UV quantization exceeded tolerance")
    boundary = geometry["deliveryBoundaryBoundsBlenderZUpMetres"]
    expected_low = (-0.85, -0.65)
    expected_high = (0.85, 0.65)
    for actual, wanted in zip(boundary["min"][:2], expected_low):
        if abs(actual - wanted) > 0.00005:
            raise ValueError(f"{asset} delivery boundary minimum changed")
    for actual, wanted in zip(boundary["max"][:2], expected_high):
        if abs(actual - wanted) > 0.00005:
            raise ValueError(f"{asset} delivery boundary maximum changed")
    landing = geometry["deliveryLandingExtensionBoundsBlenderZUpMetres"]
    if abs(landing["max"][2]) > 0.00005:
        raise ValueError(f"{asset} delivery landing top moved from Z=0")
    if not EXPECTED_EXTENSIONS.issubset(extensions_used):
        raise ValueError(f"{asset} delivery lost required material or packaging extensions")
    if extensions_used.intersection(FORBIDDEN_DECODER_EXTENSIONS):
        raise ValueError(f"{asset} delivery requires an unconfigured runtime decoder")
    if not {"EXT_texture_webp", "KHR_mesh_quantization"}.issubset(extensions_required):
        raise ValueError(f"{asset} delivery extension requirements are incomplete")
    if any(row["deliveryMimeType"] != "image/webp" for row in texture_rows):
        raise ValueError(f"{asset} delivery contains a non-WebP texture")
    if any(max(row["deliveryDimensions"]) > 2048 for row in texture_rows):
        raise ValueError(f"{asset} delivery contains a texture above 2K")
    numeric_psnr = [
        float(row["psnrDbAgainstLanczosMatchedMaster"])
        for row in texture_rows
        if row["psnrDbAgainstLanczosMatchedMaster"] != "lossless"
    ]
    if numeric_psnr and min(numeric_psnr) < 40.0:
        raise ValueError(f"{asset} texture packaging fell below 40 dB PSNR")
    if "No errors found" not in validator or "No warnings found" not in validator:
        raise ValueError(f"{asset} validator did not pass cleanly")

    return {
        "asset": asset,
        "status": "passed",
        "master": {
            "file": relative(master_path),
            "bytes": len(master_blob),
            "gzipBytes": len(gzip.compress(master_blob, compresslevel=9, mtime=0)),
            "sha256": digest(master_path),
            "geometryAccessorBytes": geometry_accessor_bytes(master_json),
            "estimatedMipmappedRgbaTextureBytes": mipmapped_rgba_bytes(master_images),
        },
        "delivery": {
            "file": relative(delivery_path),
            "bytes": len(delivery_blob),
            "gzipBytes": len(gzip.compress(delivery_blob, compresslevel=9, mtime=0)),
            "sha256": digest(delivery_path),
            "sizeReductionPercent": round(
                (1.0 - len(delivery_blob) / len(master_blob)) * 100.0, 2
            ),
            "geometryAccessorBytes": geometry_accessor_bytes(delivery_json),
            "estimatedMipmappedRgbaTextureBytes": mipmapped_rgba_bytes(delivery_images),
            "extensionsUsed": sorted(extensions_used),
            "extensionsRequired": sorted(extensions_required),
            "unconfiguredDecoderExtensions": sorted(
                extensions_used.intersection(FORBIDDEN_DECODER_EXTENSIONS)
            ),
        },
        "geometry": geometry,
        "textures": texture_rows,
        "validator": {
            "file": relative(validator_path),
            "errors": 0,
            "warnings": 0,
            "infoOnly": True,
        },
    }


def main() -> None:
    rows = [audit_asset(asset, expected) for asset, expected in ASSETS.items()]
    report = {
        "schema": 1,
        "purpose": (
            "Measure source-preserving 2K/WebP/KHR_mesh_quantization delivery "
            "candidates against the 4K audition masters."
        ),
        "status": "passed",
        "policy": {
            "masterUse": "Dev audition and archival authoring reference",
            "deliveryUse": "Candidate for root runtime integration after visual acceptance",
            "topologyReduction": False,
            "wholeMeshDecimation": False,
            "configuredRuntimeDecodersRequired": False,
        },
        "assets": rows,
        "combined": {
            "masterBytes": sum(row["master"]["bytes"] for row in rows),
            "deliveryBytes": sum(row["delivery"]["bytes"] for row in rows),
            "deliveryReductionPercent": round(
                (
                    1.0
                    - sum(row["delivery"]["bytes"] for row in rows)
                    / sum(row["master"]["bytes"] for row in rows)
                )
                * 100.0,
                2,
            ),
            "estimatedDeliveryMipmappedRgbaTextureBytes": sum(
                row["delivery"]["estimatedMipmappedRgbaTextureBytes"] for row in rows
            ),
            "deliveryGeometryAccessorBytes": sum(
                row["delivery"]["geometryAccessorBytes"] for row in rows
            ),
        },
        "thresholds": {
            "maxWorldPositionDeltaMetres": 0.00005,
            "maxCornerNormalDeltaDegrees": 1.0,
            "maxUvDelta": 0.00005,
            "minimumTexturePsnrDb": 40.0,
            "maxTextureDimension": 2048,
        },
        "tool": {"blender": bpy.app.version_string},
        "command": (
            "rtk proxy timeout 1800 env ALSOFT_DRIVERS=null blender -b --factory-startup "
            "--python-exit-code 1 --python art/glass-adventure/platform-trials/v6/production/"
            "audit_delivery_candidates.py"
        ),
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print("V6_DELIVERY_AUDIT=" + json.dumps(report), flush=True)
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
