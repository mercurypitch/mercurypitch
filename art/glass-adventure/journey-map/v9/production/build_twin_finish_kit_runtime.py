"""Assemble the review-only V9 twin-finish kit from explicitly reviewed candidates.

The accepted V4 cliff and flower records stay at their stable logical indices and
their referenced payload bytes are copied exactly. Only the cypress and twin temple
are replaced. Both normal-map choices are required on the command line and must
match hash-pinned visual-selection receipts.
"""

from __future__ import annotations

import argparse
from copy import deepcopy
import hashlib
from io import BytesIO
import json
import math
from pathlib import Path
import struct
import sys
from typing import Iterable

import bpy
from mathutils import Vector
import numpy as np
from PIL import Image as PILImage


HERE = Path(__file__).resolve().parent
ART = HERE.parent
REPO = HERE.parents[4]
V4 = ART.parent / "v4"
V4_GLB = V4 / "exports" / "floating-museum-twin-finish-kit-v4.glb"
KIT_GLB = ART / "exports" / "floating-museum-twin-finish-kit-v9.glb"
KIT_BLEND = ART / "sources" / "floating-museum-twin-finish-kit-v9.blend"
MANIFEST = ART / "exports" / "floating-museum-twin-finish-kit-v9.json"

VARIANT_KEYS = ("meshy", "dense-bake")
ASSETS = {
    "temple": {
        "manifest": ART / "exports" / "floating-museum-temple-candidate-v9.json",
        "selection": ART / "proofs" / "temple-normal-selection-v9.json",
        "variants": {
            "meshy": ART
            / "exports"
            / "floating-museum-temple-candidate-v9-meshy-normal.glb",
            "dense-bake": ART
            / "exports"
            / "floating-museum-temple-candidate-v9-dense-bake-normal.glb",
        },
        "candidateRoot": "map_museum_v9_temple_candidate_root",
        "group": "map_temple",
        "geometry": "map_temple_geometry",
        "material": "map_temple_atlas",
        "triangles": (82_000, 98_000),
        "dimensions": (2.4, 2.667686939239502, 2.6624226570129395),
    },
    "cypress": {
        "manifest": ART / "exports" / "floating-museum-cypress-candidate-v9.json",
        "selection": ART / "proofs" / "cypress-normal-selection-v9.json",
        "variants": {
            "meshy": ART
            / "exports"
            / "floating-museum-cypress-candidate-v9-meshy-normal.glb",
            "dense-bake": ART
            / "exports"
            / "floating-museum-cypress-candidate-v9-dense-bake-normal.glb",
        },
        "candidateRoot": "map_museum_v9_cypress_candidate_root",
        "group": "map_cypress",
        "geometry": "map_cypress_geometry",
        "material": "map_cypress_atlas",
        "triangles": (17_000, 24_000),
        "dimensions": (0.38449329137802124, 1.8, 0.45893892645835876),
    },
}

ROOT_NAME = "map_twin_finish_kit_root"
ARTIFACT_ID = "floating-museum-twin-finish-kit-v9"
TEMPLE_DOME_Y = 1.65
CLIFF_NAME = "map_cliff"
CYPRESS_NAME = "map_cypress"
FLOWER_NAME = "map_flower_cluster"
TEMPLE_AMBER_NAME = "map_temple_amber"
TEMPLE_TEAL_NAME = "map_temple_teal"
CLIFF_TARGET_DIMENSIONS = (4.5, 2.0313870906829834, 2.4640555381774902)
# Blender 5.2.2's fresh import of the byte-identical V4 flower payload. The
# legacy V4 manifest reports a different rotated AABB; exact records and bytes
# remain the preservation authority.
FLOWER_TARGET_DIMENSIONS = (0.869657576084137, 0.4931323230266571, 0.575716108083725)
CLIFF_TRIANGLES = 7_975
FLOWER_STORED_TRIANGLES = 1_800
FLOWER_INSTANCE_COUNT = 3
RUNTIME_MAP_CYPRESS_INSTANCES = 13

PRESERVED_NODE_INDICES = (0, 1, 4, 5, 6, 7)
PRESERVED_MESH_INDICES = (0, 2)
PRESERVED_MATERIAL_INDICES = (0, 2)
PRESERVED_TEXTURE_INDICES = (*range(0, 4), *range(8, 12))
PRESERVED_IMAGE_INDICES = (*range(0, 4), *range(8, 12))
PRESERVED_ACCESSOR_INDICES = (*range(0, 4), *range(8, 12))
PRESERVED_VIEW_INDICES = (*range(0, 8), *range(16, 24))

BASE_COLOR_SIZE = (2048, 2048)
DATA_MAP_SIZE = (1024, 1024)
WEBP_QUALITY = 92
WEBP_METHOD = 6

COMPONENT_BYTES = {
    5120: 1,
    5121: 1,
    5122: 2,
    5123: 2,
    5125: 4,
    5126: 4,
}
TYPE_COMPONENTS = {
    "SCALAR": 1,
    "VEC2": 2,
    "VEC3": 3,
    "VEC4": 4,
    "MAT2": 4,
    "MAT3": 9,
    "MAT4": 16,
}


def parse_args() -> argparse.Namespace:
    script_args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(
        description="Build V9 only from two explicitly reviewed normal-map choices."
    )
    parser.add_argument(
        "--temple-normal-variant",
        choices=VARIANT_KEYS,
        required=True,
        help="Reviewed temple normal variant; there is intentionally no default.",
    )
    parser.add_argument(
        "--cypress-normal-variant",
        choices=VARIANT_KEYS,
        required=True,
        help="Reviewed cypress normal variant; there is intentionally no default.",
    )
    return parser.parse_args(script_args)


def digest_bytes(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def digest(path: Path) -> str:
    return digest_bytes(path.read_bytes())


def repo_path(path: Path) -> str:
    return str(path.relative_to(REPO))


def art_path(path: Path) -> str:
    return str(path.relative_to(ART))


def require_file(path: Path, label: str) -> None:
    if not path.is_file():
        raise FileNotFoundError(f"{label} is absent: {path}")


def read_glb(path: Path) -> tuple[dict[str, object], bytes, bytes]:
    require_file(path, "Required GLB")
    raw = path.read_bytes()
    if len(raw) < 28 or raw[:4] != b"glTF":
        raise ValueError(f"{path.name} is not a GLB")
    if struct.unpack_from("<I", raw, 8)[0] != len(raw):
        raise ValueError(f"{path.name} has an incomplete GLB payload")
    json_length, json_type = struct.unpack_from("<II", raw, 12)
    if json_type != 0x4E4F534A:
        raise ValueError(f"{path.name} has no JSON chunk")
    document = json.loads(raw[20 : 20 + json_length].decode("utf-8").rstrip(" \x00"))
    binary_header = 20 + json_length
    binary_length, binary_type = struct.unpack_from("<II", raw, binary_header)
    if binary_type != 0x004E4942:
        raise ValueError(f"{path.name} has no BIN chunk")
    binary = raw[binary_header + 8 : binary_header + 8 + binary_length]
    buffers = document.get("buffers", [])
    if len(buffers) != 1 or len(binary) != int(buffers[0]["byteLength"]):
        raise ValueError(f"{path.name} BIN length differs from its glTF declaration")
    return document, binary, raw


def write_glb(path: Path, document: dict[str, object], binary: bytes) -> None:
    payload = bytearray(binary)
    while len(payload) % 4:
        payload.append(0)
    document["buffers"] = [{"byteLength": len(payload)}]
    encoded = json.dumps(document, separators=(",", ":")).encode("utf-8")
    encoded += b" " * ((-len(encoded)) % 4)
    result = bytearray(struct.pack("<III", 0x46546C67, 2, 0))
    result.extend(struct.pack("<II", len(encoded), 0x4E4F534A))
    result.extend(encoded)
    result.extend(struct.pack("<II", len(payload), 0x004E4942))
    result.extend(payload)
    struct.pack_into("<I", result, 8, len(result))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(result)


def view_payload(document: dict[str, object], binary: bytes, index: int) -> bytes:
    view = document["bufferViews"][index]
    offset = int(view.get("byteOffset", 0))
    return binary[offset : offset + int(view["byteLength"])]


def accessor_payload(document: dict[str, object], binary: bytes, index: int) -> bytes:
    accessor = document["accessors"][index]
    if "sparse" in accessor or "bufferView" not in accessor:
        raise ValueError(f"Accessor {index} is sparse or has no buffer view")
    view = document["bufferViews"][int(accessor["bufferView"])]
    source = view_payload(document, binary, int(accessor["bufferView"]))
    component_size = COMPONENT_BYTES.get(int(accessor["componentType"]))
    component_count = TYPE_COMPONENTS.get(str(accessor["type"]))
    if component_size is None or component_count is None:
        raise ValueError(f"Accessor {index} uses an unsupported element type")
    element_size = component_size * component_count
    stride = int(view.get("byteStride", element_size))
    start = int(accessor.get("byteOffset", 0))
    count = int(accessor["count"])
    end = start + (count - 1) * stride + element_size if count else start
    if end > len(source):
        raise ValueError(f"Accessor {index} exceeds its buffer view")
    return b"".join(
        source[start + row * stride : start + row * stride + element_size]
        for row in range(count)
    )


def validate_tangent_accessor(
    document: dict[str, object], binary: bytes, index: int, expected_count: int
) -> None:
    accessor = document["accessors"][index]
    if int(accessor.get("componentType", -1)) != 5126 or accessor.get("type") != "VEC4":
        raise ValueError("V9 candidate TANGENT must be a FLOAT VEC4 accessor")
    if accessor.get("normalized"):
        raise ValueError("V9 candidate TANGENT must not set normalized")
    count = int(accessor.get("count", -1))
    if count != expected_count:
        raise ValueError(
            f"V9 candidate TANGENT count differs from POSITION: {count} != {expected_count}"
        )
    raw = accessor_payload(document, binary, index)
    invalid: list[tuple[int, tuple[float, float, float, float], float]] = []
    for vertex, tangent in enumerate(struct.iter_unpack("<4f", raw)):
        xyz_length = math.sqrt(sum(component * component for component in tangent[:3]))
        if (
            not all(math.isfinite(component) for component in tangent)
            or abs(xyz_length - 1.0) > 1e-3
            or abs(abs(tangent[3]) - 1.0) > 1e-4
        ):
            invalid.append((vertex, tangent, xyz_length))
            if len(invalid) == 4:
                break
    if invalid:
        raise ValueError(
            "V9 candidate TANGENT contains non-unit or non-finite values: "
            + "; ".join(
                f"vertex {vertex}={tuple(round(value, 7) for value in tangent)}, "
                f"xyzLength={length:.7f}"
                for vertex, tangent, length in invalid
            )
        )


def validate_normal_accessor(
    document: dict[str, object], binary: bytes, index: int, expected_count: int
) -> None:
    accessor = document["accessors"][index]
    if int(accessor.get("componentType", -1)) != 5126 or accessor.get("type") != "VEC3":
        raise ValueError("V9 candidate NORMAL must be a FLOAT VEC3 accessor")
    if accessor.get("normalized"):
        raise ValueError("V9 candidate NORMAL must not set normalized")
    count = int(accessor.get("count", -1))
    if count != expected_count:
        raise ValueError(f"V9 candidate NORMAL count differs from POSITION: {count}")
    raw = accessor_payload(document, binary, index)
    invalid = []
    for vertex, normal in enumerate(struct.iter_unpack("<3f", raw)):
        length = math.sqrt(sum(component * component for component in normal))
        if not all(math.isfinite(component) for component in normal) or abs(length - 1.0) > 1e-3:
            invalid.append((vertex, normal, length))
            if len(invalid) == 4:
                break
    if invalid:
        raise ValueError(
            "V9 candidate NORMAL contains non-unit or non-finite values: "
            + "; ".join(
                f"vertex {vertex}={tuple(round(value, 7) for value in normal)}, "
                f"length={length:.7f}"
                for vertex, normal, length in invalid
            )
        )


def scalar_indices(
    document: dict[str, object], binary: bytes, accessor_index: int
) -> list[int]:
    accessor = document["accessors"][accessor_index]
    component_type = int(accessor.get("componentType", -1))
    codes = {5121: "B", 5123: "H", 5125: "I"}
    if accessor.get("type") != "SCALAR" or component_type not in codes:
        raise ValueError("Triangle indices must be unsigned scalar values")
    payload = accessor_payload(document, binary, accessor_index)
    return [value[0] for value in struct.iter_unpack("<" + codes[component_type], payload)]


def texture_image_index(document: dict[str, object], texture_index: int) -> int:
    texture = document["textures"][texture_index]
    sources = []
    if "source" in texture:
        sources.append(int(texture["source"]))
    for extension in ("EXT_texture_webp", "KHR_texture_basisu"):
        source = texture.get("extensions", {}).get(extension, {}).get("source")
        if source is not None:
            sources.append(int(source))
    if len(sources) != 1:
        raise ValueError(f"Texture {texture_index} has ambiguous image sources: {sources}")
    return sources[0]


def image_payload(document: dict[str, object], binary: bytes, index: int) -> bytes:
    image = document["images"][index]
    if "bufferView" not in image:
        raise ValueError(f"Image {index} is not embedded")
    return view_payload(document, binary, int(image["bufferView"]))


def validate_file_record(
    record: dict[str, object], label: str, *, base: Path = ART
) -> Path:
    if not isinstance(record, dict):
        raise ValueError(f"{label} must be a file record")
    relative = record.get("file")
    expected_sha = record.get("sha256")
    if not isinstance(relative, str) or not isinstance(expected_sha, str):
        raise ValueError(f"{label} lacks file/sha256")
    path = base / relative
    require_file(path, label)
    actual_sha = digest(path)
    if actual_sha != expected_sha:
        raise ValueError(f"{label} hash changed: {actual_sha} != {expected_sha}")
    if "bytes" in record and path.stat().st_size != int(record["bytes"]):
        raise ValueError(f"{label} byte count changed")
    return path


def material_bindings(material: dict[str, object]) -> dict[str, dict[str, object]]:
    pbr = material.get("pbrMetallicRoughness", {})
    bindings = {
        "baseColor": pbr.get("baseColorTexture"),
        "normal": material.get("normalTexture"),
        "metallicRoughness": pbr.get("metallicRoughnessTexture"),
        "occlusion": material.get("occlusionTexture"),
    }
    if any(not isinstance(binding, dict) for binding in bindings.values()):
        raise ValueError(f"V9 candidate material lacks a required texture binding: {bindings}")
    return bindings


def validate_candidate(
    asset_name: str,
    path: Path,
    manifest: dict[str, object],
    manifest_key: str,
) -> tuple[dict[str, object], bytes, dict[str, object]]:
    config = ASSETS[asset_name]
    document, binary, raw = read_glb(path)
    if [node.get("name") for node in document.get("nodes", [])] != [
        config["geometry"],
        config["group"],
        config["candidateRoot"],
    ]:
        raise ValueError(f"V9 {asset_name} candidate lost its stable node hierarchy")
    if len(document.get("meshes", [])) != 1 or len(document.get("materials", [])) != 1:
        raise ValueError(f"V9 {asset_name} candidate must have one mesh and one material")
    mesh = document["meshes"][0]
    if mesh.get("name") != str(config["geometry"]) + "_mesh":
        raise ValueError(f"V9 {asset_name} candidate mesh name changed")
    primitives = mesh.get("primitives", [])
    if len(primitives) != 1:
        raise ValueError(f"V9 {asset_name} candidate must have one primitive")
    primitive = primitives[0]
    if int(primitive.get("mode", 4)) != 4:
        raise ValueError(f"V9 {asset_name} candidate must use triangle-list mode")
    required_attributes = {"POSITION", "NORMAL", "TANGENT", "TEXCOORD_0"}
    attributes = primitive.get("attributes", {})
    if missing := sorted(required_attributes - set(attributes)):
        raise ValueError(f"V9 {asset_name} candidate lost attributes: {missing}")
    position_count = int(document["accessors"][int(attributes["POSITION"])]["count"])
    validate_normal_accessor(document, binary, int(attributes["NORMAL"]), position_count)
    validate_tangent_accessor(
        document, binary, int(attributes["TANGENT"]), position_count
    )
    uv = document["accessors"][int(attributes["TEXCOORD_0"])]
    if (
        int(uv.get("componentType", -1)) != 5126
        or uv.get("type") != "VEC2"
        or int(uv.get("count", -1)) != position_count
    ):
        raise ValueError(f"V9 {asset_name} candidate has an invalid TEXCOORD_0 accessor")
    used_accessors = {int(primitive["indices"]), *(int(value) for value in attributes.values())}
    if used_accessors != set(range(len(document.get("accessors", [])))):
        raise ValueError(f"V9 {asset_name} candidate has unexpected unused accessors")
    index_accessor = document["accessors"][int(primitive["indices"])]
    if int(index_accessor["count"]) % 3:
        raise ValueError(f"V9 {asset_name} index count is not triangular")
    index_values = scalar_indices(document, binary, int(primitive["indices"]))
    if not index_values or min(index_values) < 0 or max(index_values) >= position_count:
        raise ValueError(f"V9 {asset_name} candidate has out-of-range indices")
    triangle_count = int(index_accessor["count"]) // 3
    minimum, maximum = config["triangles"]
    if not int(minimum) <= triangle_count <= int(maximum):
        raise ValueError(
            f"V9 {asset_name} triangle count is outside review bounds: {triangle_count}"
        )
    position = document["accessors"][int(attributes["POSITION"])]
    low = position.get("min")
    high = position.get("max")
    if not isinstance(low, list) or not isinstance(high, list):
        raise ValueError(f"V9 {asset_name} POSITION accessor has no bounds")
    dimensions = [high[axis] - low[axis] for axis in range(3)]
    if abs(float(low[1])) > 1e-5 or any(
        abs(float(actual) - expected) > 1e-4
        for actual, expected in zip(dimensions, config["dimensions"], strict=True)
    ):
        raise ValueError(f"V9 {asset_name} dimensions/anchor changed: {dimensions}, {low}")
    material = document["materials"][int(primitive["material"])]
    if material.get("name") != config["material"]:
        raise ValueError(f"V9 {asset_name} material name changed")
    bindings = material_bindings(material)
    if int(bindings["occlusion"]["index"]) != int(
        bindings["metallicRoughness"]["index"]
    ):
        raise ValueError(f"V9 {asset_name} AO is no longer packed into ORM")
    image_rows: dict[str, dict[str, object]] = {}
    for role, binding in bindings.items():
        image_index = texture_image_index(document, int(binding["index"]))
        payload = image_payload(document, binary, image_index)
        opened = PILImage.open(BytesIO(payload))
        image_rows[role] = {
            "imageIndex": image_index,
            "dimensions": list(opened.size),
            "bytes": len(payload),
            "sha256": digest_bytes(payload),
        }
    unique_images = {
        image_rows[role]["imageIndex"]
        for role in ("baseColor", "normal", "metallicRoughness")
    }
    if len(unique_images) != 3:
        raise ValueError(f"V9 {asset_name} runtime roles must have three distinct images")
    extensions = set(document.get("extensionsUsed", [])) | set(
        document.get("extensionsRequired", [])
    )
    forbidden = sorted(
        extension
        for extension in extensions
        if "draco" in extension.lower() or "meshopt" in extension.lower()
    )
    if forbidden:
        raise ValueError(
            f"V9 {asset_name} candidate introduced unsupported geometry codecs: {forbidden}"
        )

    variants = manifest.get("variants", {})
    variant = variants.get(manifest_key) if isinstance(variants, dict) else None
    if not isinstance(variant, dict):
        raise ValueError(f"Candidate manifest has no {manifest_key!r} variant")
    if variant.get("file") != art_path(path):
        raise ValueError("Candidate manifest points at a different variant file")
    if variant.get("sha256") != digest_bytes(raw) or int(variant.get("bytes", -1)) != len(raw):
        raise ValueError(f"V9 {asset_name} variant no longer matches its manifest hash/size")
    if int(variant.get("triangles", -1)) != triangle_count:
        raise ValueError(f"V9 {asset_name} manifest triangle count changed")
    if variant.get("attributes") != sorted(attributes):
        raise ValueError(f"V9 {asset_name} manifest attribute contract changed")
    manifest_images = variant.get("images", {})
    for role, actual in image_rows.items():
        expected = manifest_images.get(role) if isinstance(manifest_images, dict) else None
        if not isinstance(expected, dict) or any(
            expected.get(key) != actual[key]
            for key in ("imageIndex", "dimensions", "bytes", "sha256")
        ):
            raise ValueError(f"V9 {asset_name} manifest {role} image record changed")
    return document, binary, {
        "asset": asset_name,
        "file": art_path(path),
        "bytes": len(raw),
        "sha256": digest_bytes(raw),
        "triangles": triangle_count,
        "dimensionsGlTfYUpMetres": dimensions,
        "anchorErrorMetres": abs(float(low[1])),
        "attributes": sorted(attributes),
        "bindings": bindings,
        "images": image_rows,
        "forbiddenGeometryCodecExtensions": forbidden,
    }


def validate_candidate_provenance(
    asset_name: str,
    manifest: dict[str, object],
    candidate_path: Path,
    variant: str,
) -> dict[str, object]:
    config = ASSETS[asset_name]
    source = manifest.get("source", {})
    if not isinstance(source, dict):
        raise ValueError(f"V9 {asset_name} manifest has no source record")
    source_file = source.get("file")
    source_receipt = source.get("receipt")
    if not isinstance(source_file, str) or not isinstance(source_receipt, str):
        raise ValueError(f"V9 {asset_name} source lineage is incomplete")
    source_path = REPO / source_file
    receipt_path = REPO / source_receipt
    require_file(source_path, f"Archived V9 {asset_name} PBR source")
    require_file(receipt_path, f"Archived V9 {asset_name} retexture receipt")
    if source.get("sha256") != digest(source_path):
        raise ValueError(f"V9 {asset_name} PBR source hash changed")
    receipt = json.loads(receipt_path.read_text())
    receipt_file = receipt.get("file", {})
    if (
        receipt.get("state") != "archived"
        or not isinstance(receipt_file, dict)
        or receipt_file.get("sha256") != digest(source_path)
    ):
        raise ValueError(f"V9 {asset_name} receipt does not archive the current PBR source")
    context = source.get("receiptContext", {})
    if (
        not isinstance(context, dict)
        or context.get("retextureTaskId") != receipt.get("taskId")
        or context.get("sourceSha256") != digest(source_path)
    ):
        raise ValueError(f"V9 {asset_name} receipt context changed")
    packed = manifest.get("packedBlend")
    if not isinstance(packed, dict):
        raise ValueError(f"V9 {asset_name} manifest has no packed editable source record")
    validate_file_record(packed, f"V9 {asset_name} packed editable source")

    selection_path = config["selection"]
    require_file(selection_path, f"V9 {asset_name} visual-selection receipt")
    selection = json.loads(selection_path.read_text())
    if selection.get("schema") != 1 or selection.get("decision") != "accepted-for-runtime-packing":
        raise ValueError(f"V9 {asset_name} visual-selection receipt is missing or pending")
    if selection.get("selectedVariant") != variant:
        raise ValueError(f"CLI {asset_name} variant differs from the reviewed selection")
    if not selection.get("reviewedAtUtc"):
        raise ValueError(f"V9 {asset_name} selection has no review time")
    manifest_record = selection.get("candidateManifest")
    if not isinstance(manifest_record, dict):
        raise ValueError("Visual-selection receipt has no candidate-manifest record")
    manifest_path = config["manifest"]
    if manifest_record.get("file") != art_path(manifest_path):
        raise ValueError("Visual-selection receipt points at a different candidate manifest")
    if manifest_record.get("sha256") != digest(manifest_path):
        raise ValueError("Candidate manifest changed after the visual decision")
    candidate_record = selection.get("selectedCandidate")
    if not isinstance(candidate_record, dict):
        raise ValueError("Visual-selection receipt has no candidate record")
    if candidate_record.get("file") != art_path(candidate_path):
        raise ValueError("Visual-selection receipt names a different candidate file")
    if candidate_record.get("sha256") != digest(candidate_path):
        raise ValueError("Reviewed candidate changed after the visual decision")
    proofs = selection.get("proofs")
    if not isinstance(proofs, list) or not proofs:
        raise ValueError("Visual-selection receipt must pin at least one proof")
    for index, proof in enumerate(proofs):
        validate_file_record(proof, f"Visual-selection proof {index}")
    review = selection.get("review")
    if (
        not isinstance(review, dict)
        or not review.get("finding")
        or "knownLimitations" not in review
    ):
        raise ValueError("Visual-selection receipt must record its finding and known limitations")
    return {
        "file": art_path(selection_path),
        "bytes": selection_path.stat().st_size,
        "sha256": digest(selection_path),
        "decision": selection["decision"],
        "reviewedAtUtc": selection["reviewedAtUtc"],
        "selectedVariant": selection["selectedVariant"],
        "selectedNormalSource": selection["selectedNormalSource"],
        "proofs": proofs,
        "review": review,
        "source": {
            "file": repo_path(source_path),
            "bytes": source_path.stat().st_size,
            "sha256": digest(source_path),
            "receipt": repo_path(receipt_path),
            "receiptSha256": digest(receipt_path),
        },
    }


def psnr(reference: np.ndarray, candidate: np.ndarray) -> float:
    error = float(np.mean((reference.astype(np.float32) - candidate.astype(np.float32)) ** 2))
    return float("inf") if error == 0 else 10.0 * math.log10(255.0 * 255.0 / error)


def encode_runtime_image(
    role: str, source_payload: bytes
) -> tuple[bytes, str, dict[str, object]]:
    source = PILImage.open(BytesIO(source_payload)).convert("RGB")
    target_size = BASE_COLOR_SIZE if role == "baseColor" else DATA_MAP_SIZE
    if source.width < target_size[0] or source.height < target_size[1]:
        raise ValueError(
            f"{role} source {source.size} is below the {target_size} runtime baseline"
        )
    target = (
        source
        if source.size == target_size
        else source.resize(target_size, PILImage.Resampling.LANCZOS)
    )
    reference = np.asarray(target, dtype=np.uint8)
    if role == "baseColor":
        output = BytesIO()
        target.save(
            output,
            format="WEBP",
            quality=WEBP_QUALITY,
            method=WEBP_METHOD,
            exact=True,
        )
        encoded = output.getvalue()
        mime_type = "image/webp"
        encoding = {
            "format": "WebP",
            "lossless": False,
            "quality": WEBP_QUALITY,
            "method": WEBP_METHOD,
        }
    else:
        webp = BytesIO()
        target.save(
            webp,
            format="WEBP",
            lossless=True,
            quality=100,
            method=WEBP_METHOD,
            exact=True,
        )
        png = BytesIO()
        target.save(png, format="PNG", optimize=True, compress_level=9)
        candidates = [
            (webp.getvalue(), "image/webp", "lossless WebP"),
            (png.getvalue(), "image/png", "optimized PNG"),
        ]
        encoded, mime_type, chosen = min(candidates, key=lambda row: len(row[0]))
        encoding = {
            "format": chosen,
            "lossless": True,
            "alternatives": {
                "losslessWebpBytes": len(candidates[0][0]),
                "optimizedPngBytes": len(candidates[1][0]),
            },
        }
    decoded_image = PILImage.open(BytesIO(encoded)).convert("RGB")
    decoded = np.asarray(decoded_image, dtype=np.uint8)
    if decoded_image.size != target_size:
        raise ValueError(f"Encoded {role} dimensions changed: {decoded_image.size}")
    if role != "baseColor" and not np.array_equal(reference, decoded):
        raise ValueError(f"Lossless {role} encoding changed channel values")
    return encoded, mime_type, {
        "sourceDimensions": list(source.size),
        "sourceBytes": len(source_payload),
        "sourceSha256": digest_bytes(source_payload),
        "runtimeDimensions": list(target_size),
        "runtimeBytes": len(encoded),
        "runtimeSha256": digest_bytes(encoded),
        "runtimeMimeType": mime_type,
        "encoding": encoding,
        "compressionPsnrDb": (
            "infinite" if np.array_equal(reference, decoded) else round(psnr(reference, decoded), 4)
        ),
        "compressionMeanAbsoluteError": round(
            float(np.mean(np.abs(reference.astype(np.float32) - decoded.astype(np.float32)))),
            4,
        ),
    }


def add_view_at(
    views: list[dict[str, object] | None],
    binary: bytearray,
    index: int,
    template: dict[str, object],
    payload: bytes,
) -> None:
    while len(views) <= index:
        views.append(None)
    if views[index] is not None:
        raise ValueError(f"Buffer-view slot {index} is already occupied")
    while len(binary) % 4:
        binary.append(0)
    record = deepcopy(template)
    record["buffer"] = 0
    record["byteOffset"] = len(binary)
    record["byteLength"] = len(payload)
    views[index] = record
    binary.extend(payload)


def descendants(root: bpy.types.Object) -> list[bpy.types.Object]:
    result: list[bpy.types.Object] = []
    pending = list(root.children)
    while pending:
        current = pending.pop()
        result.append(current)
        pending.extend(current.children)
    return result


def triangles(mesh: bpy.types.Mesh) -> int:
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)


def object_bounds(objects: Iterable[bpy.types.Object]) -> tuple[Vector, Vector]:
    points = [
        obj.matrix_world @ vertex.co
        for obj in objects
        if obj.type == "MESH"
        for vertex in obj.data.vertices
    ]
    if not points:
        raise ValueError("Cannot measure an empty mesh set")
    return (
        Vector(min(point[axis] for point in points) for axis in range(3)),
        Vector(max(point[axis] for point in points) for axis in range(3)),
    )


def texture_record(image_index: int, mime_type: str) -> dict[str, object]:
    record: dict[str, object] = {"sampler": 0}
    if mime_type == "image/webp":
        record["extensions"] = {"EXT_texture_webp": {"source": image_index}}
    else:
        record["source"] = image_index
    return record


def remap_material(
    source: dict[str, object],
    name: str,
    *,
    normal: int,
    base_color: int,
    orm: int,
    occlusion: int,
) -> dict[str, object]:
    material = deepcopy(source)
    material["name"] = name
    bindings = material_bindings(material)
    bindings["normal"]["index"] = normal
    bindings["baseColor"]["index"] = base_color
    bindings["metallicRoughness"]["index"] = orm
    bindings["occlusion"]["index"] = occlusion
    return material


def encode_candidate_maps(
    document: dict[str, object], binary: bytes
) -> dict[str, dict[str, object]]:
    primitive = document["meshes"][0]["primitives"][0]
    material = document["materials"][int(primitive["material"])]
    bindings = material_bindings(material)
    result: dict[str, dict[str, object]] = {}
    for role in ("normal", "baseColor", "metallicRoughness"):
        image_index = texture_image_index(document, int(bindings[role]["index"]))
        payload, mime_type, report = encode_runtime_image(
            role, image_payload(document, binary, image_index)
        )
        result[role] = {
            "payload": payload,
            "mimeType": mime_type,
            "report": report,
        }
    return result


def encode_variant_base(record: dict[str, object], label: str) -> dict[str, object]:
    path = validate_file_record(record, label)
    payload, mime_type, report = encode_runtime_image("baseColor", path.read_bytes())
    return {
        "payload": payload,
        "mimeType": mime_type,
        "report": {**report, "sourceFile": art_path(path)},
    }


def encode_index_payload(values: list[int], component_type: int) -> bytes:
    dtypes = {5121: "<u1", 5123: "<u2", 5125: "<u4"}
    if component_type not in dtypes:
        raise ValueError(f"Unsupported index component type {component_type}")
    maximum = int(np.iinfo(np.dtype(dtypes[component_type])).max)
    if values and (min(values) < 0 or max(values) > maximum):
        raise ValueError("Partitioned index value exceeds its preserved component type")
    return np.asarray(values, dtype=dtypes[component_type]).tobytes()


def float3_rows(
    document: dict[str, object], binary: bytes, accessor_index: int
) -> list[tuple[float, float, float]]:
    accessor = document["accessors"][accessor_index]
    if int(accessor.get("componentType", -1)) != 5126 or accessor.get("type") != "VEC3":
        raise ValueError("Expected a FLOAT VEC3 accessor")
    return list(struct.iter_unpack("<3f", accessor_payload(document, binary, accessor_index)))


def partition_temple_indices(
    document: dict[str, object], binary: bytes
) -> tuple[list[int], list[int], dict[str, object]]:
    primitive = document["meshes"][0]["primitives"][0]
    positions = float3_rows(document, binary, int(primitive["attributes"]["POSITION"]))
    source = scalar_indices(document, binary, int(primitive["indices"]))
    structure: list[int] = []
    dome: list[int] = []
    source_triangles = []
    structure_triangles = []
    dome_triangles = []
    for offset in range(0, len(source), 3):
        triangle = tuple(source[offset : offset + 3])
        source_triangles.append(triangle)
        centre_y = sum(positions[index][1] for index in triangle) / 3.0
        if centre_y >= TEMPLE_DOME_Y:
            dome.extend(triangle)
            dome_triangles.append(triangle)
        else:
            structure.extend(triangle)
            structure_triangles.append(triangle)
    if not structure or not dome:
        raise ValueError("Temple partition produced an empty structure or dome")
    if sorted(structure_triangles + dome_triangles) != sorted(source_triangles):
        raise ValueError("Temple face partition changed the accepted triangle multiset")
    return structure, dome, {
        "criterion": f"glTF face-centre Y >= {TEMPLE_DOME_Y:.2f}m",
        "equivalentAuthoringCriterion": f"Blender face-centre Z >= {TEMPLE_DOME_Y:.2f}m",
        "triangles": {
            "source": len(source_triangles),
            "structure": len(structure_triangles),
            "dome": len(dome_triangles),
        },
        "indexValues": {
            "source": len(source),
            "structure": len(structure),
            "dome": len(dome),
        },
        "sourceIndexSha256": digest_bytes(
            encode_index_payload(
                source,
                int(document["accessors"][int(primitive["indices"])]["componentType"]),
            )
        ),
        "exactTriangleMultiset": True,
        "positionsNormalsTangentsUvsChanged": False,
    }


def view_record_without_offset(record: dict[str, object]) -> dict[str, object]:
    result = deepcopy(record)
    result.pop("byteOffset", None)
    return result


def preservation_report(
    source: dict[str, object],
    source_binary: bytes,
    output: dict[str, object],
    output_binary: bytes,
) -> dict[str, object]:
    exact_records = {
        "nodesJsonExact": all(
            output["nodes"][index] == source["nodes"][index]
            for index in PRESERVED_NODE_INDICES
        ),
        "meshesJsonExact": all(
            output["meshes"][index] == source["meshes"][index]
            for index in PRESERVED_MESH_INDICES
        ),
        "materialsJsonExact": all(
            output["materials"][index] == source["materials"][index]
            for index in PRESERVED_MATERIAL_INDICES
        ),
        "texturesJsonExact": all(
            output["textures"][index] == source["textures"][index]
            for index in PRESERVED_TEXTURE_INDICES
        ),
        "imagesJsonExact": all(
            output["images"][index] == source["images"][index]
            for index in PRESERVED_IMAGE_INDICES
        ),
        "accessorsJsonExact": all(
            output["accessors"][index] == source["accessors"][index]
            for index in PRESERVED_ACCESSOR_INDICES
        ),
        "samplersJsonExact": output.get("samplers", []) == source.get("samplers", []),
        "bufferViewLogicalRecordsExact": all(
            view_record_without_offset(output["bufferViews"][index])
            == view_record_without_offset(source["bufferViews"][index])
            for index in PRESERVED_VIEW_INDICES
        ),
    }
    accessor_rows = []
    for index in PRESERVED_ACCESSOR_INDICES:
        before = accessor_payload(source, source_binary, index)
        after = accessor_payload(output, output_binary, index)
        accessor_rows.append(
            {
                "accessor": index,
                "bytes": len(before),
                "sha256": digest_bytes(before),
                "outputSha256": digest_bytes(after),
                "exact": before == after,
            }
        )
    image_rows = []
    for index in PRESERVED_IMAGE_INDICES:
        before = image_payload(source, source_binary, index)
        after = image_payload(output, output_binary, index)
        image_rows.append(
            {
                "image": index,
                "bytes": len(before),
                "sha256": digest_bytes(before),
                "outputSha256": digest_bytes(after),
                "exact": before == after,
            }
        )
    view_rows = []
    for index in PRESERVED_VIEW_INDICES:
        before = view_payload(source, source_binary, index)
        after = view_payload(output, output_binary, index)
        view_rows.append(
            {
                "bufferView": index,
                "bytes": len(before),
                "sha256": digest_bytes(before),
                "outputSha256": digest_bytes(after),
                "exact": before == after,
            }
        )
    if not all(exact_records.values()):
        raise ValueError(f"V4 cliff/flower logical records changed: {exact_records}")
    if not all(row["exact"] for row in accessor_rows + image_rows + view_rows):
        raise ValueError("V4 cliff/flower referenced payload bytes changed")
    return {
        "source": repo_path(V4_GLB),
        "sourceSha256": digest(V4_GLB),
        "stableIndices": {
            "nodes": list(PRESERVED_NODE_INDICES),
            "meshes": list(PRESERVED_MESH_INDICES),
            "materials": list(PRESERVED_MATERIAL_INDICES),
            "textures": list(PRESERVED_TEXTURE_INDICES),
            "images": list(PRESERVED_IMAGE_INDICES),
            "accessors": list(PRESERVED_ACCESSOR_INDICES),
            "bufferViews": list(PRESERVED_VIEW_INDICES),
        },
        **exact_records,
        "accessorPayloads": accessor_rows,
        "imagePayloads": image_rows,
        "bufferViewPayloads": view_rows,
    }


def validate_no_orphans(document: dict[str, object]) -> dict[str, bool]:
    referenced_views = {
        int(record["bufferView"])
        for collection in (document["accessors"], document["images"])
        for record in collection
        if "bufferView" in record
    }
    referenced_accessors = {
        int(index)
        for mesh in document["meshes"]
        for primitive in mesh.get("primitives", [])
        for index in (
            [primitive["indices"]] if "indices" in primitive else []
        )
        + list(primitive.get("attributes", {}).values())
    }
    referenced_images = {
        texture_image_index(document, index) for index in range(len(document["textures"]))
    }
    referenced_textures = set()
    for material in document["materials"]:
        pbr = material.get("pbrMetallicRoughness", {})
        for binding in (
            pbr.get("baseColorTexture"),
            pbr.get("metallicRoughnessTexture"),
            material.get("normalTexture"),
            material.get("occlusionTexture"),
            material.get("emissiveTexture"),
        ):
            if isinstance(binding, dict):
                referenced_textures.add(int(binding["index"]))
    referenced_meshes = {int(node["mesh"]) for node in document["nodes"] if "mesh" in node}
    referenced_materials = {
        int(primitive["material"])
        for mesh in document["meshes"]
        for primitive in mesh.get("primitives", [])
        if "material" in primitive
    }
    checks = {
        "bufferViews": referenced_views == set(range(len(document["bufferViews"]))),
        "accessors": referenced_accessors == set(range(len(document["accessors"]))),
        "images": referenced_images == set(range(len(document["images"]))),
        "textures": referenced_textures == set(range(len(document["textures"]))),
        "meshes": referenced_meshes == set(range(len(document["meshes"]))),
        "materials": referenced_materials == set(range(len(document["materials"]))),
    }
    if not all(checks.values()):
        raise ValueError(f"V9 compact repack retained orphan records: {checks}")
    return checks


def build_v9_document(
    candidates: dict[str, tuple[dict[str, object], bytes]],
    manifests: dict[str, dict[str, object]],
    variants: dict[str, str],
) -> tuple[dict[str, object], bytes, dict[str, object]]:
    v4, v4_binary, _ = read_glb(V4_GLB)
    if [node.get("name") for node in v4.get("nodes", [])] != [
        "map_cliff_geometry",
        "map_cliff",
        "map_cypress_geometry",
        "map_cypress",
        "map_flower_cluster_bloom_a",
        "map_flower_cluster_bloom_b",
        "map_flower_cluster_bloom_c",
        "map_flower_cluster",
        "map_temple_amber_dome",
        "map_temple_amber_structure",
        "map_temple_amber",
        "map_temple_teal_dome",
        "map_temple_teal_structure",
        "map_temple_teal",
        ROOT_NAME,
    ]:
        raise ValueError("V4 stable node order changed")
    if (
        len(v4.get("meshes", [])) != 6
        or len(v4.get("materials", [])) != 6
        or len(v4.get("textures", [])) != 24
        or len(v4.get("images", [])) != 18
        or len(v4.get("accessors", [])) != 23
        or len(v4.get("bufferViews", [])) != 41
    ):
        raise ValueError("V4 stable finish-kit table layout changed")

    temple, temple_binary = candidates["temple"]
    cypress, cypress_binary = candidates["cypress"]
    if temple.get("samplers", []) != v4.get("samplers", []) or cypress.get(
        "samplers", []
    ) != v4.get("samplers", []):
        raise ValueError("V9 candidate sampler differs from the stable V4 sampler")
    temple_maps = encode_candidate_maps(temple, temple_binary)
    cypress_maps = encode_candidate_maps(cypress, cypress_binary)
    material_variants = manifests["temple"].get("runtimeContract", {}).get(
        "materialVariants", {}
    )
    if not isinstance(material_variants, dict):
        raise ValueError("Temple candidate manifest lost its runtime material variants")
    amber_base = encode_variant_base(material_variants.get("amber"), "Amber dome base")
    teal_base = encode_variant_base(material_variants.get("teal"), "Teal dome base")
    structure_indices, dome_indices, partition = partition_temple_indices(
        temple, temple_binary
    )

    views: list[dict[str, object] | None] = [None] * 35
    output_binary = bytearray()
    for index in PRESERVED_VIEW_INDICES:
        add_view_at(
            views,
            output_binary,
            index,
            v4["bufferViews"][index],
            view_payload(v4, v4_binary, index),
        )

    cypress_primitive = cypress["meshes"][0]["primitives"][0]
    cypress_view_map: dict[int, int] = {}
    for semantic, output_view in zip(
        ("POSITION", "NORMAL", "TEXCOORD_0", "TANGENT"),
        (8, 9, 10, 11),
        strict=True,
    ):
        source_accessor = cypress["accessors"][
            int(cypress_primitive["attributes"][semantic])
        ]
        source_view = int(source_accessor["bufferView"])
        cypress_view_map[source_view] = output_view
        add_view_at(
            views,
            output_binary,
            output_view,
            cypress["bufferViews"][source_view],
            view_payload(cypress, cypress_binary, source_view),
        )
    cypress_index = cypress["accessors"][int(cypress_primitive["indices"])]
    cypress_index_view = int(cypress_index["bufferView"])
    cypress_view_map[cypress_index_view] = 12
    add_view_at(
        views,
        output_binary,
        12,
        cypress["bufferViews"][cypress_index_view],
        view_payload(cypress, cypress_binary, cypress_index_view),
    )
    for role, output_view in zip(
        ("normal", "baseColor", "metallicRoughness"), (13, 14, 15), strict=True
    ):
        add_view_at(
            views,
            output_binary,
            output_view,
            {"buffer": 0},
            cypress_maps[role]["payload"],
        )

    temple_primitive = temple["meshes"][0]["primitives"][0]
    temple_view_map: dict[int, int] = {}
    for semantic, output_view in zip(
        ("POSITION", "NORMAL", "TEXCOORD_0", "TANGENT"),
        (24, 25, 26, 27),
        strict=True,
    ):
        source_accessor = temple["accessors"][
            int(temple_primitive["attributes"][semantic])
        ]
        source_view = int(source_accessor["bufferView"])
        temple_view_map[source_view] = output_view
        add_view_at(
            views,
            output_binary,
            output_view,
            temple["bufferViews"][source_view],
            view_payload(temple, temple_binary, source_view),
        )
    temple_index = temple["accessors"][int(temple_primitive["indices"])]
    temple_index_type = int(temple_index["componentType"])
    add_view_at(
        views,
        output_binary,
        28,
        {"buffer": 0, "target": 34963},
        encode_index_payload(structure_indices, temple_index_type),
    )
    add_view_at(
        views,
        output_binary,
        29,
        {"buffer": 0, "target": 34963},
        encode_index_payload(dome_indices, temple_index_type),
    )
    temple_runtime_images = (
        (temple_maps["normal"], 30),
        (temple_maps["baseColor"], 31),
        (temple_maps["metallicRoughness"], 32),
        (amber_base, 33),
        (teal_base, 34),
    )
    for image, output_view in temple_runtime_images:
        add_view_at(
            views,
            output_binary,
            output_view,
            {"buffer": 0},
            image["payload"],
        )
    if any(view is None for view in views):
        raise ValueError("V9 buffer-view table has an unfilled slot")

    accessors: list[dict[str, object] | None] = [None] * 19
    for index in PRESERVED_ACCESSOR_INDICES:
        accessors[index] = deepcopy(v4["accessors"][index])
    cypress_accessor_map: dict[int, int] = {}
    for semantic, output_accessor in zip(
        ("POSITION", "NORMAL", "TEXCOORD_0", "TANGENT"),
        (4, 5, 6, 7),
        strict=True,
    ):
        source_index = int(cypress_primitive["attributes"][semantic])
        copied = deepcopy(cypress["accessors"][source_index])
        copied["bufferView"] = cypress_view_map[int(copied["bufferView"])]
        accessors[output_accessor] = copied
        cypress_accessor_map[source_index] = output_accessor
    copied_cypress_index = deepcopy(cypress_index)
    copied_cypress_index["bufferView"] = 12
    accessors[12] = copied_cypress_index
    cypress_accessor_map[int(cypress_primitive["indices"])] = 12

    temple_accessor_map: dict[int, int] = {}
    for semantic, output_accessor in zip(
        ("POSITION", "NORMAL", "TEXCOORD_0", "TANGENT"),
        (13, 14, 15, 16),
        strict=True,
    ):
        source_index = int(temple_primitive["attributes"][semantic])
        copied = deepcopy(temple["accessors"][source_index])
        copied["bufferView"] = temple_view_map[int(copied["bufferView"])]
        accessors[output_accessor] = copied
        temple_accessor_map[source_index] = output_accessor
    for output_accessor, output_view, values in (
        (17, 28, structure_indices),
        (18, 29, dome_indices),
    ):
        copied = deepcopy(temple_index)
        copied["bufferView"] = output_view
        copied["count"] = len(values)
        accessors[output_accessor] = copied
    if any(accessor is None for accessor in accessors):
        raise ValueError("V9 accessor table has an unfilled slot")

    meshes = deepcopy(v4["meshes"])
    cypress_mesh = deepcopy(cypress["meshes"][0])
    cypress_mesh["name"] = "map_cypress_geometry_mesh_v9"
    cypress_output_primitive = cypress_mesh["primitives"][0]
    cypress_output_primitive["attributes"] = {
        semantic: cypress_accessor_map[int(source_index)]
        for semantic, source_index in cypress_primitive["attributes"].items()
    }
    cypress_output_primitive["indices"] = 12
    cypress_output_primitive["material"] = 1
    meshes[1] = cypress_mesh
    temple_attributes = {
        semantic: temple_accessor_map[int(source_index)]
        for semantic, source_index in temple_primitive["attributes"].items()
    }
    primitive_template = {
        key: deepcopy(value)
        for key, value in temple_primitive.items()
        if key not in {"attributes", "indices", "material"}
    }
    meshes[3] = {
        "name": "map_temple_dome_amber_mesh",
        "primitives": [
            {
                **deepcopy(primitive_template),
                "attributes": deepcopy(temple_attributes),
                "indices": 18,
                "material": 3,
            }
        ],
    }
    meshes[4] = {
        "name": "map_temple_structure_mesh",
        "primitives": [
            {
                **deepcopy(primitive_template),
                "attributes": deepcopy(temple_attributes),
                "indices": 17,
                "material": 4,
            }
        ],
    }
    meshes[5] = {
        "name": "map_temple_dome_teal_mesh",
        "primitives": [
            {
                **deepcopy(primitive_template),
                "attributes": deepcopy(temple_attributes),
                "indices": 18,
                "material": 5,
            }
        ],
    }

    cypress_material = cypress["materials"][
        int(cypress_primitive["material"])
    ]
    temple_material = temple["materials"][int(temple_primitive["material"])]
    materials = deepcopy(v4["materials"])
    materials[1] = remap_material(
        cypress_material,
        "map_cypress_atlas",
        normal=4,
        base_color=5,
        orm=6,
        occlusion=7,
    )
    materials[3] = remap_material(
        temple_material,
        "map_temple_dome_amber_atlas",
        normal=12,
        base_color=13,
        orm=14,
        occlusion=15,
    )
    materials[4] = remap_material(
        temple_material,
        "map_temple_structure_atlas",
        normal=16,
        base_color=17,
        orm=18,
        occlusion=19,
    )
    materials[5] = remap_material(
        temple_material,
        "map_temple_dome_teal_atlas",
        normal=20,
        base_color=21,
        orm=22,
        occlusion=23,
    )

    images: list[dict[str, object] | None] = [None] * 16
    for index in PRESERVED_IMAGE_INDICES:
        images[index] = deepcopy(v4["images"][index])
    new_image_records = {
        4: (
            13,
            cypress_maps["normal"],
            f"cypress-v9-{variants['cypress']}-normal-1k",
        ),
        5: (14, cypress_maps["baseColor"], "cypress-v9-base-2k"),
        6: (15, cypress_maps["metallicRoughness"], "cypress-v9-orm-1k"),
        7: (
            30,
            temple_maps["normal"],
            f"temple-v9-{variants['temple']}-normal-1k",
        ),
        12: (33, amber_base, "temple-v9-dome-amber-base-2k"),
        13: (31, temple_maps["baseColor"], "temple-v9-structure-base-2k"),
        14: (32, temple_maps["metallicRoughness"], "temple-v9-orm-1k"),
        15: (34, teal_base, "temple-v9-dome-teal-base-2k"),
    }
    for index, (view_index, runtime_image, name) in new_image_records.items():
        images[index] = {
            "bufferView": view_index,
            "mimeType": runtime_image["mimeType"],
            "name": name,
        }
    if any(image is None for image in images):
        raise ValueError("V9 image table has an unfilled slot")

    textures: list[dict[str, object] | None] = [None] * 24
    for index in PRESERVED_TEXTURE_INDICES:
        textures[index] = deepcopy(v4["textures"][index])
    texture_images = {
        4: (4, cypress_maps["normal"]),
        5: (5, cypress_maps["baseColor"]),
        6: (6, cypress_maps["metallicRoughness"]),
        7: (6, cypress_maps["metallicRoughness"]),
        12: (7, temple_maps["normal"]),
        13: (12, amber_base),
        14: (14, temple_maps["metallicRoughness"]),
        15: (14, temple_maps["metallicRoughness"]),
        16: (7, temple_maps["normal"]),
        17: (13, temple_maps["baseColor"]),
        18: (14, temple_maps["metallicRoughness"]),
        19: (14, temple_maps["metallicRoughness"]),
        20: (7, temple_maps["normal"]),
        21: (15, teal_base),
        22: (14, temple_maps["metallicRoughness"]),
        23: (14, temple_maps["metallicRoughness"]),
    }
    for index, (image_index, runtime_image) in texture_images.items():
        textures[index] = texture_record(image_index, runtime_image["mimeType"])
    if any(texture is None for texture in textures):
        raise ValueError("V9 texture table has an unfilled slot")

    nodes = deepcopy(v4["nodes"])
    nodes[14].setdefault("extras", {})["assetId"] = ARTIFACT_ID
    extensions_used = set(v4.get("extensionsUsed", []))
    extensions_required = set(v4.get("extensionsRequired", []))
    for candidate, _binary in candidates.values():
        extensions_used.update(candidate.get("extensionsUsed", []))
        extensions_required.update(candidate.get("extensionsRequired", []))
    extensions_used.add("EXT_texture_webp")
    extensions_required.add("EXT_texture_webp")
    forbidden = sorted(
        extension
        for extension in extensions_used | extensions_required
        if "draco" in extension.lower() or "meshopt" in extension.lower()
    )
    if forbidden:
        raise ValueError(f"V9 kit would require unsupported geometry codecs: {forbidden}")
    document = {
        "asset": {
            "generator": "MercuryPitch V9 deterministic twin-finish packer",
            "version": "2.0",
        },
        "scene": 0,
        "scenes": deepcopy(v4["scenes"]),
        "nodes": nodes,
        "meshes": meshes,
        "materials": materials,
        "textures": textures,
        "images": images,
        "samplers": deepcopy(v4.get("samplers", [])),
        "accessors": accessors,
        "bufferViews": views,
        "buffers": [{"byteLength": 0}],
        "extensionsUsed": sorted(extensions_used),
        "extensionsRequired": sorted(extensions_required),
    }
    binary = bytes(output_binary)
    preserved = preservation_report(v4, v4_binary, document, binary)
    cypress_payloads = []
    for source_index, output_index in cypress_accessor_map.items():
        before = accessor_payload(cypress, cypress_binary, source_index)
        after = accessor_payload(document, binary, output_index)
        cypress_payloads.append(
            {
                "sourceAccessor": source_index,
                "outputAccessor": output_index,
                "sha256": digest_bytes(before),
                "outputSha256": digest_bytes(after),
                "exact": before == after,
            }
        )
    temple_payloads = []
    for source_index, output_index in temple_accessor_map.items():
        before = accessor_payload(temple, temple_binary, source_index)
        after = accessor_payload(document, binary, output_index)
        temple_payloads.append(
            {
                "semantic": next(
                    semantic
                    for semantic, index in temple_primitive["attributes"].items()
                    if int(index) == source_index
                ),
                "sourceAccessor": source_index,
                "outputAccessor": output_index,
                "sha256": digest_bytes(before),
                "outputSha256": digest_bytes(after),
                "exact": before == after,
            }
        )
    if not all(row["exact"] for row in cypress_payloads + temple_payloads):
        raise ValueError("V9 selected candidate geometry attribute payload changed")
    no_orphans = validate_no_orphans(document)
    return document, binary, {
        "v4CliffFlower": preserved,
        "cypressGeometry": {
            "normalVariant": variants["cypress"],
            "accessorPayloads": cypress_payloads,
            "secondGeometryReduction": False,
        },
        "templeGeometry": {
            "normalVariant": variants["temple"],
            "attributeAccessorPayloads": temple_payloads,
            "partition": partition,
            "sharedStructureMeshIndex": 4,
            "sharedDomeAccessorIndices": {
                "attributes": temple_attributes,
                "indices": 18,
            },
            "secondGeometryReduction": False,
        },
        "runtimeTextures": {
            "cypress": {role: value["report"] for role, value in cypress_maps.items()},
            "temple": {
                "normal": temple_maps["normal"]["report"],
                "structureBaseColor": temple_maps["baseColor"]["report"],
                "metallicRoughnessAndOcclusion": temple_maps["metallicRoughness"]["report"],
                "amberDomeBaseColor": amber_base["report"],
                "tealDomeBaseColor": teal_base["report"],
            },
        },
        "noOrphanRecords": no_orphans,
        "copiedV4BufferViewIndices": list(PRESERVED_VIEW_INDICES),
        "oldV4CypressTemplePayloadsCopied": False,
    }


def validate_v9_document(
    path: Path, temple_triangles: int, cypress_triangles: int
) -> dict[str, object]:
    document, binary, raw = read_glb(path)
    extensions = set(document.get("extensionsUsed", [])) | set(
        document.get("extensionsRequired", [])
    )
    forbidden = sorted(
        extension
        for extension in extensions
        if "draco" in extension.lower() or "meshopt" in extension.lower()
    )
    if forbidden:
        raise ValueError(f"V9 runtime GLB introduced unsupported codecs: {forbidden}")
    expected_names = [node.get("name") for node in read_glb(V4_GLB)[0]["nodes"]]
    if [node.get("name") for node in document["nodes"]] != expected_names:
        raise ValueError("V9 runtime GLB changed the stable V4 node order/names")
    root = document["nodes"][14]
    if root.get("extras", {}).get("assetId") != ARTIFACT_ID:
        raise ValueError("V9 runtime GLB root assetId changed")
    if root.get("children") != [1, 3, 7, 10, 13]:
        raise ValueError("V9 runtime GLB root hierarchy changed")
    primitive_triangles = [
        int(document["accessors"][int(mesh["primitives"][0]["indices"])]["count"]) // 3
        for mesh in document["meshes"]
    ]
    structure_triangles = primitive_triangles[4]
    dome_triangles = primitive_triangles[3]
    if primitive_triangles[5] != dome_triangles:
        raise ValueError("Amber/teal dome triangle counts diverged")
    if structure_triangles + dome_triangles != temple_triangles:
        raise ValueError("Temple partition changed the reviewed triangle count")
    if primitive_triangles[1] != cypress_triangles:
        raise ValueError("Cypress assembly changed the reviewed triangle count")
    if (
        primitive_triangles[0] != CLIFF_TRIANGLES
        or primitive_triangles[2] != FLOWER_STORED_TRIANGLES
    ):
        raise ValueError("V4 cliff/flower triangle counts changed")
    amber_dome = document["meshes"][3]["primitives"][0]
    structure = document["meshes"][4]["primitives"][0]
    teal_dome = document["meshes"][5]["primitives"][0]
    if (
        amber_dome["attributes"] != teal_dome["attributes"]
        or amber_dome["indices"] != teal_dome["indices"]
    ):
        raise ValueError("Amber/teal dome mesh records no longer share geometry accessors")
    if document["nodes"][9].get("mesh") != 4 or document["nodes"][12].get("mesh") != 4:
        raise ValueError("Amber/teal structure nodes no longer share one mesh record")
    if structure["attributes"] != amber_dome["attributes"]:
        raise ValueError("Temple structure/dome no longer share accepted vertex attributes")
    image_rows = []
    for index, image in enumerate(document["images"]):
        payload = image_payload(document, binary, index)
        opened = PILImage.open(BytesIO(payload))
        image_rows.append(
            {
                "name": image.get("name"),
                "mimeType": image.get("mimeType"),
                "dimensions": list(opened.size),
                "bytes": len(payload),
                "sha256": digest_bytes(payload),
            }
        )
    stored_unique = CLIFF_TRIANGLES + cypress_triangles + FLOWER_STORED_TRIANGLES + temple_triangles
    projected_rendered = (
        CLIFF_TRIANGLES
        + cypress_triangles
        + FLOWER_STORED_TRIANGLES * FLOWER_INSTANCE_COUNT
        + temple_triangles * 2
    )
    return {
        "file": art_path(path),
        "bytes": len(raw),
        "sha256": digest_bytes(raw),
        "triangles": {
            "storedUniqueGeometry": stored_unique,
            "declaredMeshPrimitives": sum(primitive_triangles),
            "projectedRuntimeAcrossNodeInstances": projected_rendered,
            "map_cliff": CLIFF_TRIANGLES,
            "map_cypress": cypress_triangles,
            "map_flower_clusterStored": FLOWER_STORED_TRIANGLES,
            "map_flower_clusterRendered": FLOWER_STORED_TRIANGLES
            * FLOWER_INSTANCE_COUNT,
            "map_templeStored": temple_triangles,
            "map_templeRenderedTwinInstances": temple_triangles * 2,
            "map_templeStructure": structure_triangles,
            "map_templeDome": dome_triangles,
        },
        "geometrySharing": {
            "amberTealStructureMeshIndex": 4,
            "amberTealDomeAttributeAccessors": amber_dome["attributes"],
            "amberTealDomeIndexAccessor": amber_dome["indices"],
            "templeStructureAndDomeShareVertexAttributes": True,
        },
        "nodes": expected_names,
        "images": image_rows,
        "extensionsUsed": document.get("extensionsUsed", []),
        "extensionsRequired": document.get("extensionsRequired", []),
        "forbiddenGeometryCodecExtensions": forbidden,
    }


def fresh_reimport_v9(
    temple_triangles: int, cypress_triangles: int
) -> tuple[dict[str, object], dict[str, object]]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(KIT_GLB))
    root = bpy.data.objects.get(ROOT_NAME)
    if root is None:
        raise ValueError("Fresh import lost the V9 twin-finish root")
    specs = {
        CLIFF_NAME: {
            "dimensions": CLIFF_TARGET_DIMENSIONS,
            "triangles": CLIFF_TRIANGLES,
            "children": 1,
            "anchor": "top",
        },
        CYPRESS_NAME: {
            "dimensions": ASSETS["cypress"]["dimensions"],
            "triangles": cypress_triangles,
            "children": 1,
            "anchor": "bottom",
        },
        FLOWER_NAME: {
            "dimensions": FLOWER_TARGET_DIMENSIONS,
            "triangles": FLOWER_STORED_TRIANGLES * FLOWER_INSTANCE_COUNT,
            "children": FLOWER_INSTANCE_COUNT,
            "anchor": "bottom",
        },
        TEMPLE_AMBER_NAME: {
            "dimensions": ASSETS["temple"]["dimensions"],
            "triangles": temple_triangles,
            "children": 2,
            "anchor": "bottom",
        },
        TEMPLE_TEAL_NAME: {
            "dimensions": ASSETS["temple"]["dimensions"],
            "triangles": temple_triangles,
            "children": 2,
            "anchor": "bottom",
        },
    }
    rows: dict[str, object] = {}
    for name, spec in specs.items():
        group = bpy.data.objects.get(name)
        if group is None or group.parent != root:
            raise ValueError(f"Fresh import lost hierarchy for {name}")
        meshes = [obj for obj in descendants(group) if obj.type == "MESH"]
        if len(meshes) != spec["children"]:
            raise ValueError(f"Fresh import {name} mesh-child count changed")
        low, high = object_bounds(meshes)
        dimensions = [high.x - low.x, high.z - low.z, high.y - low.y]
        anchor_error = abs(high.z) if spec["anchor"] == "top" else abs(low.z)
        if anchor_error > 1e-5 or any(
            abs(actual - expected) > 1e-4
            for actual, expected in zip(dimensions, spec["dimensions"], strict=True)
        ):
            raise ValueError(
                f"Fresh import {name} dimensions/anchor changed: {dimensions}, {anchor_error}"
            )
        rendered_triangles = sum(triangles(obj.data) for obj in meshes)
        if rendered_triangles != spec["triangles"]:
            raise ValueError(
                f"Fresh import {name} triangle count changed: {rendered_triangles}"
            )
        if any(obj.data.uv_layers.active is None for obj in meshes):
            raise ValueError(f"Fresh import {name} lost UV0")
        rows[name] = {
            "meshChildren": [obj.name for obj in meshes],
            "trianglesRendered": rendered_triangles,
            "uniqueMeshDatablocks": len({obj.data.as_pointer() for obj in meshes}),
            "dimensionsGlTfYUpMetres": dimensions,
            "anchorErrorMetres": anchor_error,
            "uv0Present": True,
            "materials": sorted(
                {
                    material.name
                    for obj in meshes
                    for material in obj.data.materials
                    if material is not None
                }
            ),
        }
    amber_structure = bpy.data.objects.get("map_temple_amber_structure")
    teal_structure = bpy.data.objects.get("map_temple_teal_structure")
    if (
        amber_structure is None
        or teal_structure is None
        or amber_structure.data.as_pointer() != teal_structure.data.as_pointer()
    ):
        raise ValueError("Fresh import lost amber/teal structure mesh instancing")
    bpy.ops.file.pack_all()
    missing = sorted(
        image.filepath
        for image in bpy.data.images
        if image.source != "GENERATED" and image.packed_file is None
    )
    if missing:
        raise ValueError(f"Packed V9 runtime source retains external images: {missing}")
    KIT_BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(KIT_BLEND), compress=True, check_existing=False)
    packed = {
        "file": art_path(KIT_BLEND),
        "bytes": KIT_BLEND.stat().st_size,
        "sha256": digest(KIT_BLEND),
        "imagesPacked": True,
        "missingExternalFiles": missing,
    }
    return {
        "root": ROOT_NAME,
        "coordinates": (
            "Fresh GLB reimport into Blender Z-up; dimensions listed in glTF "
            "X/Y/Z order."
        ),
        "nodes": rows,
        "amberTealStructureMeshDatablockShared": True,
        "images": [
            {
                "name": image.name,
                "dimensions": [int(image.size[0]), int(image.size[1])],
                "colorSpace": image.colorspace_settings.name,
                "packed": image.packed_file is not None,
            }
            for image in bpy.data.images
            if image.type == "IMAGE"
        ],
    }, packed


def main() -> None:
    args = parse_args()
    variants = {
        "temple": args.temple_normal_variant,
        "cypress": args.cypress_normal_variant,
    }
    require_file(V4_GLB, "Approved V4 twin-finish kit")
    manifests: dict[str, dict[str, object]] = {}
    candidates: dict[str, tuple[dict[str, object], bytes]] = {}
    candidate_reports: dict[str, dict[str, object]] = {}
    provenance: dict[str, dict[str, object]] = {}
    for asset_name in ("temple", "cypress"):
        config = ASSETS[asset_name]
        manifest_path = config["manifest"]
        variant = variants[asset_name]
        candidate_path = config["variants"][variant]
        require_file(manifest_path, f"V9 {asset_name} candidate manifest")
        manifest = json.loads(manifest_path.read_text())
        document, binary, report = validate_candidate(
            asset_name, candidate_path, manifest, variant
        )
        manifests[asset_name] = manifest
        candidates[asset_name] = (document, binary)
        candidate_reports[asset_name] = report
        provenance[asset_name] = validate_candidate_provenance(
            asset_name, manifest, candidate_path, variant
        )

    document, binary, build = build_v9_document(candidates, manifests, variants)
    write_glb(KIT_GLB, document, binary)
    temple_triangles = int(candidate_reports["temple"]["triangles"])
    cypress_triangles = int(candidate_reports["cypress"]["triangles"])
    glb = validate_v9_document(KIT_GLB, temple_triangles, cypress_triangles)
    fresh, packed = fresh_reimport_v9(temple_triangles, cypress_triangles)
    manifest = {
        "schema": 1,
        "assetId": ARTIFACT_ID,
        "runtimeLogicalAssetIdBeforeIntegration": "floating-museum-twin-finish-kit-v4",
        "status": "review-only combined derivative; public/runtime integration not performed",
        "coordinates": "Blender Z-up authoring; exported glTF +Y up; metres",
        "root": ROOT_NAME,
        "normalSelections": {
            "explicitNoDefault": True,
            "temple": {
                "cliVariant": variants["temple"],
                "visualSelectionReceipt": provenance["temple"],
            },
            "cypress": {
                "cliVariant": variants["cypress"],
                "visualSelectionReceipt": provenance["cypress"],
            },
        },
        "sources": {
            "v4TwinFinishKit": {
                "file": repo_path(V4_GLB),
                "bytes": V4_GLB.stat().st_size,
                "sha256": digest(V4_GLB),
            },
            "templeCandidateManifest": {
                "file": art_path(ASSETS["temple"]["manifest"]),
                "bytes": ASSETS["temple"]["manifest"].stat().st_size,
                "sha256": digest(ASSETS["temple"]["manifest"]),
            },
            "templeCandidate": candidate_reports["temple"],
            "cypressCandidateManifest": {
                "file": art_path(ASSETS["cypress"]["manifest"]),
                "bytes": ASSETS["cypress"]["manifest"].stat().st_size,
                "sha256": digest(ASSETS["cypress"]["manifest"]),
            },
            "cypressCandidate": candidate_reports["cypress"],
        },
        "glb": glb,
        "packedBlend": packed,
        "v4CliffFlowerPreservation": build["v4CliffFlower"],
        "selectedCandidateGeometryPreservation": {
            "temple": build["templeGeometry"],
            "cypress": build["cypressGeometry"],
        },
        "runtimeTexturePass": {
            "baseColor": "2K review-quality WebP",
            "dataMaps": "1K lossless; smaller of lossless WebP and optimized PNG",
            "maps": build["runtimeTextures"],
        },
        "sceneInstancing": {
            "storedUniqueGeometryTriangles": glb["triangles"]["storedUniqueGeometry"],
            "glbSceneNodeRenderedTriangles": glb["triangles"][
                "projectedRuntimeAcrossNodeInstances"
            ],
            "runtimeMapCypressPlacementSource": (
                "packages/glass-game/src/journey/vegetation.ts:cypressTransforms"
            ),
            "runtimeMapCypressInstanceCount": RUNTIME_MAP_CYPRESS_INSTANCES,
            "runtimeMapCypressRenderedTriangles": cypress_triangles
            * RUNTIME_MAP_CYPRESS_INSTANCES,
            "runtimeMapProjectionAuthority": (
                "source-derived placement count; browser renderer QA remains "
                "authoritative"
            ),
        },
        "freshReimport": fresh,
        "validation": {
            "explicitReviewedNormalSelections": True,
            "candidateManifestsAndSelectionHashesMatched": True,
            "freshGlbReimport": True,
            "packedEditableRuntimeSource": True,
            "requiredNamedHierarchy": True,
            "reviewedCandidateTriangleCountsExact": True,
            "templeFacePartitionExact": True,
            "templeVertexAttributePayloadsExact": True,
            "amberTealGeometrySharingPassed": True,
            "noSecondGeometryReduction": True,
            "dimensionsAndGroundAnchorsPassed": True,
            "uv0Present": True,
            "v4CliffFlowerLogicalRecordsAndPayloadsExact": True,
            "noOrphanRecords": build["noOrphanRecords"],
            "oldV4CypressTemplePayloadsCopied": False,
            "noDracoOrMeshopt": True,
            "runtimeIntegration": "not performed",
        },
        "rebuild": {
            "workingDirectory": "repository root",
            "command": (
                "rtk proxy timeout 1800 env ALSOFT_DRIVERS=null blender -b --factory-startup "
                "--python-exit-code 1 --python "
                "art/glass-adventure/journey-map/v9/production/build_twin_finish_kit_runtime.py "
                f"-- --temple-normal-variant {variants['temple']} "
                f"--cypress-normal-variant {variants['cypress']}"
            ),
            "blender": bpy.app.version_string,
        },
    }
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(
        "FLOATING_MUSEUM_TWIN_FINISH_KIT_V9_BUILT="
        + json.dumps(
            {
                "normalVariants": variants,
                "glbBytes": glb["bytes"],
                "glbSha256": glb["sha256"],
                "blendBytes": packed["bytes"],
                "triangles": glb["triangles"],
                "v4CliffFlowerExact": True,
            }
        ),
        flush=True,
    )
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
