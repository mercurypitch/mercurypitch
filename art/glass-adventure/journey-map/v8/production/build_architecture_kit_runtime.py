"""Assemble a review-only V8 architecture kit from one approved Conservatory variant.

The approved V7 connector is copied without changing its logical glTF records or
referenced payload bytes. Only the Conservatory is replaced. The normal-map choice
has no default: the caller must name it and provide a hash-pinned visual-selection
receipt produced after the candidate and bake-projection review.
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
from mathutils.bvhtree import BVHTree
import numpy as np
from PIL import Image as PILImage


HERE = Path(__file__).resolve().parent
ART = HERE.parent
REPO = HERE.parents[4]
V7 = ART.parent / "v7"
V7_GLB = V7 / "exports" / "floating-museum-architecture-kit-v7.glb"
CANDIDATE_MANIFEST = ART / "exports" / "floating-museum-conservatory-candidate-v8.json"
RETEXTURE_RECEIPT = ART / "meshy" / "conservatory-remesh-110k-retexture-pbr-receipt.json"
PBR_SOURCE = ART / "meshy" / "conservatory-remesh-110k-retexture-pbr.glb"
SELECTION_RECEIPT = ART / "proofs" / "conservatory-candidate-selection-v8.json"
KIT_GLB = ART / "exports" / "floating-museum-architecture-kit-v8.glb"
KIT_BLEND = ART / "sources" / "floating-museum-architecture-kit-v8.blend"
MANIFEST = ART / "exports" / "floating-museum-architecture-kit-v8.json"

VARIANTS = {
    "meshy-normal": {
        "manifestKey": "meshy",
        "normalSource": "meshy",
        "file": ART
        / "exports"
        / "floating-museum-conservatory-candidate-v8-meshy-normal.glb",
    },
    "dense-bake-normal": {
        "manifestKey": "dense-bake",
        "normalSource": "dense-bake",
        "file": ART
        / "exports"
        / "floating-museum-conservatory-candidate-v8-dense-bake-normal.glb",
    },
}

ROOT_NAME = "map_museum_polish_kit_root"
CONSERVATORY_NAME = "map_conservatory"
CONSERVATORY_GEOMETRY_NAME = "map_conservatory_geometry"
CONSERVATORY_MATERIAL_NAME = "map_conservatory_atlas"
CONNECTOR_NAME = "map_twin_connector"
CONNECTOR_GEOMETRY_NAME = "map_twin_connector_geometry"
CONNECTOR_MATERIAL_NAME = "map_twin_connector_atlas"
ARTIFACT_ID = "floating-museum-architecture-kit-v8"
RUNTIME_ASSET_ID = "floating-museum-architecture-kit-v6"
CONSERVATORY_TARGET_DIMENSIONS = (2.30, 2.65, 2.30)
CONNECTOR_TARGET_DIMENSIONS = (1.70, 2.80, 0.80)
CONNECTOR_TRIANGLES = 102_607
MINIMUM_APERTURE = 0.80
MINIMUM_CONSERVATORY_TRIANGLES = 90_000
MAXIMUM_CONSERVATORY_TRIANGLES = 125_000
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
        description="Build V8 only after an explicit reviewed Conservatory normal choice."
    )
    parser.add_argument(
        "--normal-variant",
        choices=tuple(VARIANTS),
        required=True,
        help="Reviewed Conservatory normal variant; there is intentionally no default.",
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
        raise ValueError("V8 Conservatory TANGENT must be a FLOAT VEC4 accessor")
    if accessor.get("normalized"):
        raise ValueError("V8 Conservatory TANGENT must not set normalized")
    count = int(accessor.get("count", -1))
    if count != expected_count:
        raise ValueError(
            f"V8 Conservatory TANGENT count differs from POSITION: {count} != {expected_count}"
        )
    raw = accessor_payload(document, binary, index)
    invalid: list[tuple[int, tuple[float, float, float, float], float]] = []
    for vertex, tangent in enumerate(struct.iter_unpack("<4f", raw)):
        xyz_length = math.sqrt(sum(component * component for component in tangent[:3]))
        if (
            not all(math.isfinite(component) for component in tangent)
            or abs(xyz_length - 1.0) > 1e-4
            or abs(abs(tangent[3]) - 1.0) > 1e-4
        ):
            invalid.append((vertex, tangent, xyz_length))
            if len(invalid) == 4:
                break
    if invalid:
        raise ValueError(
            "V8 Conservatory TANGENT contains non-unit or non-finite values: "
            + "; ".join(
                f"vertex {vertex}={tuple(round(value, 7) for value in tangent)}, "
                f"xyzLength={length:.7f}"
                for vertex, tangent, length in invalid
            )
        )


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


def named_index(records: list[dict[str, object]], name: str) -> int:
    matches = [index for index, record in enumerate(records) if record.get("name") == name]
    if len(matches) != 1:
        raise ValueError(f"Expected exactly one {name!r}, found {matches}")
    return matches[0]


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
    transmission = material.get("extensions", {}).get("KHR_materials_transmission", {})
    bindings = {
        "baseColor": pbr.get("baseColorTexture"),
        "normal": material.get("normalTexture"),
        "metallicRoughness": pbr.get("metallicRoughnessTexture"),
        "occlusion": material.get("occlusionTexture"),
        "transmission": transmission.get("transmissionTexture"),
    }
    if any(not isinstance(binding, dict) for binding in bindings.values()):
        raise ValueError(f"Conservatory material lacks a required texture binding: {bindings}")
    return bindings


def validate_candidate(
    path: Path, manifest: dict[str, object], manifest_key: str
) -> tuple[dict[str, object], bytes, dict[str, object]]:
    document, binary, raw = read_glb(path)
    if [node.get("name") for node in document.get("nodes", [])] != [
        CONSERVATORY_GEOMETRY_NAME,
        CONSERVATORY_NAME,
        ROOT_NAME,
    ]:
        raise ValueError("V8 Conservatory candidate lost its stable node hierarchy")
    if len(document.get("meshes", [])) != 1 or len(document.get("materials", [])) != 1:
        raise ValueError("V8 Conservatory candidate must have one mesh and one material")
    mesh = document["meshes"][0]
    if mesh.get("name") != CONSERVATORY_GEOMETRY_NAME + "_mesh":
        raise ValueError("V8 Conservatory candidate mesh name changed")
    primitives = mesh.get("primitives", [])
    if len(primitives) != 1:
        raise ValueError("V8 Conservatory candidate must have one primitive")
    primitive = primitives[0]
    required_attributes = {"POSITION", "NORMAL", "TANGENT", "TEXCOORD_0"}
    attributes = primitive.get("attributes", {})
    if missing := sorted(required_attributes - set(attributes)):
        raise ValueError(f"V8 Conservatory candidate lost attributes: {missing}")
    position_count = int(document["accessors"][int(attributes["POSITION"])]["count"])
    validate_tangent_accessor(
        document, binary, int(attributes["TANGENT"]), position_count
    )
    used_accessors = {int(primitive["indices"]), *(int(value) for value in attributes.values())}
    if used_accessors != set(range(len(document.get("accessors", [])))):
        raise ValueError("V8 Conservatory candidate has unexpected unused accessors")
    index_accessor = document["accessors"][int(primitive["indices"])]
    if int(index_accessor["count"]) % 3:
        raise ValueError("V8 Conservatory index count is not triangular")
    triangle_count = int(index_accessor["count"]) // 3
    if not MINIMUM_CONSERVATORY_TRIANGLES <= triangle_count <= MAXIMUM_CONSERVATORY_TRIANGLES:
        raise ValueError(f"V8 Conservatory triangle count is outside review bounds: {triangle_count}")
    position = document["accessors"][int(attributes["POSITION"])]
    low = position.get("min")
    high = position.get("max")
    if not isinstance(low, list) or not isinstance(high, list):
        raise ValueError("V8 Conservatory POSITION accessor has no bounds")
    dimensions = [high[axis] - low[axis] for axis in range(3)]
    if abs(float(low[1])) > 1e-5 or any(
        abs(float(actual) - expected) > 1e-4
        for actual, expected in zip(dimensions, CONSERVATORY_TARGET_DIMENSIONS, strict=True)
    ):
        raise ValueError(f"V8 Conservatory dimensions/anchor changed: {dimensions}, {low}")
    material = document["materials"][int(primitive["material"])]
    if material.get("name") != CONSERVATORY_MATERIAL_NAME:
        raise ValueError("V8 Conservatory material name changed")
    bindings = material_bindings(material)
    if int(bindings["occlusion"]["index"]) != int(
        bindings["metallicRoughness"]["index"]
    ):
        raise ValueError("V8 Conservatory AO is no longer packed into ORM")
    ior = material.get("extensions", {}).get("KHR_materials_ior", {}).get("ior")
    if ior is None or abs(float(ior) - 1.45) > 1e-4:
        raise ValueError(f"V8 Conservatory IOR changed: {ior}")
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
        for role in ("baseColor", "normal", "metallicRoughness", "transmission")
    }
    if len(unique_images) != 4:
        raise ValueError("V8 Conservatory runtime roles must have four distinct source images")
    extensions = set(document.get("extensionsUsed", [])) | set(
        document.get("extensionsRequired", [])
    )
    forbidden = sorted(
        extension
        for extension in extensions
        if "draco" in extension.lower() or "meshopt" in extension.lower()
    )
    if forbidden:
        raise ValueError(f"V8 Conservatory introduced unsupported geometry codecs: {forbidden}")

    variants = manifest.get("variants", {})
    variant = variants.get(manifest_key) if isinstance(variants, dict) else None
    if not isinstance(variant, dict):
        raise ValueError(f"Candidate manifest has no {manifest_key!r} variant")
    if variant.get("file") != art_path(path):
        raise ValueError("Candidate manifest points at a different variant file")
    if variant.get("sha256") != digest_bytes(raw) or int(variant.get("bytes", -1)) != len(raw):
        raise ValueError("Candidate variant no longer matches its manifest hash/size")
    if int(variant.get("triangles", -1)) != triangle_count:
        raise ValueError("Candidate manifest triangle count changed")
    if variant.get("attributes") != sorted(attributes):
        raise ValueError("Candidate manifest attribute contract changed")
    manifest_images = variant.get("images", {})
    for role, actual in image_rows.items():
        expected = manifest_images.get(role) if isinstance(manifest_images, dict) else None
        if not isinstance(expected, dict) or any(
            expected.get(key) != actual[key]
            for key in ("imageIndex", "dimensions", "bytes", "sha256")
        ):
            raise ValueError(f"Candidate manifest {role} image record changed")
    return document, binary, {
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
    manifest: dict[str, object], candidate_path: Path, normal_source: str
) -> dict[str, object]:
    require_file(PBR_SOURCE, "Archived V8 PBR source")
    require_file(RETEXTURE_RECEIPT, "Archived V8 retexture receipt")
    receipt = json.loads(RETEXTURE_RECEIPT.read_text())
    source = manifest.get("source", {})
    if not isinstance(source, dict):
        raise ValueError("Candidate manifest has no source record")
    if source.get("file") != art_path(PBR_SOURCE) or source.get("sha256") != digest(PBR_SOURCE):
        raise ValueError("Candidate manifest does not identify the current archived PBR source")
    if source.get("receipt") != art_path(RETEXTURE_RECEIPT):
        raise ValueError("Candidate manifest identifies a different retexture receipt")
    receipt_file = receipt.get("file", {})
    if (
        receipt.get("state") != "archived"
        or not isinstance(receipt_file, dict)
        or receipt_file.get("sha256") != digest(PBR_SOURCE)
    ):
        raise ValueError("Retexture receipt does not archive the current PBR source")
    context = source.get("receiptContext", {})
    if (
        not isinstance(context, dict)
        or context.get("retextureTaskId") != receipt.get("taskId")
        or context.get("sourceSha256") != digest(PBR_SOURCE)
    ):
        raise ValueError("Candidate receipt context no longer matches the archived retexture")
    packed = manifest.get("packedBlend")
    if not isinstance(packed, dict):
        raise ValueError("Candidate manifest has no packed editable source record")
    validate_file_record(packed, "Candidate packed editable source")

    require_file(SELECTION_RECEIPT, "Conservatory visual-selection receipt")
    selection = json.loads(SELECTION_RECEIPT.read_text())
    if selection.get("schema") != 1 or selection.get("decision") != "accepted-for-runtime-assembly":
        raise ValueError("Conservatory visual-selection receipt is missing or pending")
    if selection.get("selectedNormalSource") != normal_source:
        raise ValueError("CLI normal variant differs from the reviewed normal source")
    if not selection.get("reviewedAtUtc"):
        raise ValueError("Conservatory visual-selection receipt has no review time")
    manifest_record = selection.get("candidateManifest")
    if not isinstance(manifest_record, dict):
        raise ValueError("Visual-selection receipt has no candidate-manifest record")
    if manifest_record.get("file") != art_path(CANDIDATE_MANIFEST):
        raise ValueError("Visual-selection receipt points at a different candidate manifest")
    if manifest_record.get("sha256") != digest(CANDIDATE_MANIFEST):
        raise ValueError("Candidate manifest changed after the visual decision")
    candidate_record = selection.get("candidate")
    if not isinstance(candidate_record, dict):
        raise ValueError("Visual-selection receipt has no candidate record")
    if candidate_record.get("file") != art_path(candidate_path):
        raise ValueError("Visual-selection receipt names a different candidate file")
    if candidate_record.get("sha256") != digest(candidate_path):
        raise ValueError("Reviewed candidate changed after the visual decision")
    audit = selection.get("bakeProjectionAudit")
    if not isinstance(audit, dict) or audit.get("decision") != "accepted":
        raise ValueError("Bake-projection audit is absent or not accepted")
    validate_file_record(audit, "Accepted bake-projection audit")
    proofs = selection.get("proofs")
    if not isinstance(proofs, list) or not proofs:
        raise ValueError("Visual-selection receipt must pin at least one proof")
    for index, proof in enumerate(proofs):
        validate_file_record(proof, f"Visual-selection proof {index}")
    review = selection.get("review")
    if not isinstance(review, dict) or not review.get("finding") or "knownLimitations" not in review:
        raise ValueError("Visual-selection receipt must record its finding and known limitations")
    return {
        "file": art_path(SELECTION_RECEIPT),
        "bytes": SELECTION_RECEIPT.stat().st_size,
        "sha256": digest(SELECTION_RECEIPT),
        "decision": selection["decision"],
        "reviewedAtUtc": selection["reviewedAtUtc"],
        "selectedNormalSource": selection["selectedNormalSource"],
        "bakeProjectionAudit": audit,
        "proofs": proofs,
        "review": review,
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


def candidate_slots(count: int) -> list[int]:
    slots = list(range(8))
    slots.extend(range(15, 15 + max(0, count - 8)))
    if count < 8:
        raise ValueError("Candidate payload does not fill the slots before the stable connector views")
    return slots[:count]


def resolve_sampler(
    candidate: dict[str, object], source_texture_index: int, samplers: list[dict[str, object]]
) -> int | None:
    texture = candidate["textures"][source_texture_index]
    if "sampler" not in texture:
        return None
    source_sampler = candidate.get("samplers", [])[int(texture["sampler"])]
    for index, sampler in enumerate(samplers):
        if sampler == source_sampler:
            return index
    samplers.append(deepcopy(source_sampler))
    return len(samplers) - 1


def build_document(
    candidate: dict[str, object],
    candidate_binary: bytes,
    normal_variant: str,
) -> tuple[dict[str, object], bytes, dict[str, object]]:
    v7, v7_binary, _ = read_glb(V7_GLB)
    expected_nodes = [
        CONSERVATORY_GEOMETRY_NAME,
        CONSERVATORY_NAME,
        CONNECTOR_GEOMETRY_NAME,
        CONNECTOR_NAME,
        ROOT_NAME,
    ]
    if [node.get("name") for node in v7.get("nodes", [])] != expected_nodes:
        raise ValueError("V7 stable node order changed")
    if len(v7.get("accessors", [])) != 8 or len(v7.get("bufferViews", [])) != 15:
        raise ValueError("V7 stable accessor/buffer-view layout changed")
    if len(v7.get("images", [])) != 7 or len(v7.get("textures", [])) != 7:
        raise ValueError("V7 stable texture layout changed")
    if named_index(v7["materials"], CONNECTOR_MATERIAL_NAME) != 1:
        raise ValueError("V7 connector material index changed")
    if named_index(v7["meshes"], CONNECTOR_GEOMETRY_NAME + "_mesh") != 1:
        raise ValueError("V7 connector mesh index changed")

    primitive = candidate["meshes"][0]["primitives"][0]
    candidate_accessor_indices = sorted(
        {int(primitive["indices"]), *(int(value) for value in primitive["attributes"].values())}
    )
    candidate_geometry_views = sorted(
        {int(candidate["accessors"][index]["bufferView"]) for index in candidate_accessor_indices}
    )
    material = candidate["materials"][int(primitive["material"])]
    bindings = material_bindings(material)
    runtime_roles = ("transmission", "normal", "baseColor", "metallicRoughness")
    source_image_indices = {
        role: texture_image_index(candidate, int(bindings[role]["index"]))
        for role in runtime_roles
    }
    if len(set(source_image_indices.values())) != 4:
        raise ValueError("Candidate runtime maps must resolve to four distinct images")
    runtime_images: dict[str, dict[str, object]] = {}
    for role in runtime_roles:
        payload, mime_type, report = encode_runtime_image(
            role, image_payload(candidate, candidate_binary, source_image_indices[role])
        )
        runtime_images[role] = {
            "payload": payload,
            "mimeType": mime_type,
            "report": report,
        }

    item_count = len(candidate_geometry_views) + len(runtime_roles)
    output_slots = iter(candidate_slots(item_count))
    views: list[dict[str, object] | None] = [None] * 15
    binary = bytearray()
    candidate_view_map: dict[int, int] = {}
    for source_index in candidate_geometry_views:
        output_index = next(output_slots)
        candidate_view_map[source_index] = output_index
        add_view_at(
            views,
            binary,
            output_index,
            candidate["bufferViews"][source_index],
            view_payload(candidate, candidate_binary, source_index),
        )
    runtime_view_indices: dict[str, int] = {}
    for role in runtime_roles:
        output_index = next(output_slots)
        runtime_view_indices[role] = output_index
        add_view_at(
            views,
            binary,
            output_index,
            {"buffer": 0},
            runtime_images[role]["payload"],
        )
    for index in range(8, 15):
        add_view_at(
            views,
            binary,
            index,
            v7["bufferViews"][index],
            view_payload(v7, v7_binary, index),
        )
    if any(view is None for view in views):
        raise ValueError("Combined buffer-view table has an unfilled slot")

    accessors: list[dict[str, object] | None] = [None] * 8
    candidate_accessor_map: dict[int, int] = {}
    for order, source_index in enumerate(candidate_accessor_indices):
        output_index = order if order < 4 else len(accessors)
        if output_index == len(accessors):
            accessors.append(None)
        copied = deepcopy(candidate["accessors"][source_index])
        copied["bufferView"] = candidate_view_map[int(copied["bufferView"])]
        accessors[output_index] = copied
        candidate_accessor_map[source_index] = output_index
    for index in range(4, 8):
        accessors[index] = deepcopy(v7["accessors"][index])
    if any(accessor is None for accessor in accessors):
        raise ValueError("Combined accessor table has an unfilled slot")

    candidate_mesh = deepcopy(candidate["meshes"][0])
    candidate_mesh["name"] = CONSERVATORY_GEOMETRY_NAME + "_mesh"
    candidate_primitive = candidate_mesh["primitives"][0]
    candidate_primitive["indices"] = candidate_accessor_map[int(candidate_primitive["indices"])]
    candidate_primitive["attributes"] = {
        semantic: candidate_accessor_map[int(index)]
        for semantic, index in candidate_primitive["attributes"].items()
    }
    candidate_primitive["material"] = 0

    samplers = deepcopy(v7.get("samplers", []))
    image_names = {
        "transmission": "conservatory-v8-transmission-1k",
        "normal": f"conservatory-v8-{normal_variant}-1k",
        "baseColor": "conservatory-v8-base-2k",
        "metallicRoughness": "conservatory-v8-orm-1k",
    }
    images = [
        {
            "bufferView": runtime_view_indices[role],
            "mimeType": runtime_images[role]["mimeType"],
            "name": image_names[role],
        }
        for role in runtime_roles
    ] + deepcopy(v7["images"][4:7])
    textures: list[dict[str, object]] = []
    role_texture_indices = {role: index for index, role in enumerate(runtime_roles)}
    for role in runtime_roles:
        source_texture_index = int(bindings[role]["index"])
        sampler = resolve_sampler(candidate, source_texture_index, samplers)
        record: dict[str, object] = {}
        if sampler is not None:
            record["sampler"] = sampler
        image_index = role_texture_indices[role]
        if runtime_images[role]["mimeType"] == "image/webp":
            record["extensions"] = {"EXT_texture_webp": {"source": image_index}}
        else:
            record["source"] = image_index
        textures.append(record)
    textures.extend(deepcopy(v7["textures"][4:7]))

    candidate_material = deepcopy(material)
    candidate_material["name"] = CONSERVATORY_MATERIAL_NAME
    remapped_bindings = material_bindings(candidate_material)
    for role, binding in remapped_bindings.items():
        target_role = "metallicRoughness" if role == "occlusion" else role
        binding["index"] = role_texture_indices[target_role]

    nodes = deepcopy(v7["nodes"])
    nodes[0] = deepcopy(candidate["nodes"][0])
    nodes[0]["mesh"] = 0
    nodes[0]["name"] = CONSERVATORY_GEOMETRY_NAME
    nodes[1] = deepcopy(candidate["nodes"][1])
    nodes[1]["children"] = [0]
    nodes[1]["name"] = CONSERVATORY_NAME
    nodes[1].setdefault("extras", {})["assetId"] = "floating-museum-conservatory-v8"
    nodes[4].setdefault("extras", {})["assetId"] = RUNTIME_ASSET_ID

    extensions_used = set(v7.get("extensionsUsed", [])) | set(
        candidate.get("extensionsUsed", [])
    )
    extensions_used.add("EXT_texture_webp")
    extensions_required = set(v7.get("extensionsRequired", [])) | set(
        candidate.get("extensionsRequired", [])
    )
    extensions_required.add("EXT_texture_webp")
    forbidden = sorted(
        extension
        for extension in extensions_used | extensions_required
        if "draco" in extension.lower() or "meshopt" in extension.lower()
    )
    if forbidden:
        raise ValueError(f"Combined kit would require unsupported geometry codecs: {forbidden}")

    document = {
        "asset": {
            "generator": "MercuryPitch V8 deterministic architecture packer",
            "version": "2.0",
        },
        "scene": 0,
        "scenes": deepcopy(v7["scenes"]),
        "nodes": nodes,
        "meshes": [candidate_mesh, deepcopy(v7["meshes"][1])],
        "materials": [candidate_material, deepcopy(v7["materials"][1])],
        "textures": textures,
        "images": images,
        "samplers": samplers,
        "accessors": accessors,
        "bufferViews": views,
        "buffers": [{"byteLength": 0}],
        "extensionsUsed": sorted(extensions_used),
        "extensionsRequired": sorted(extensions_required),
    }

    connector_checks = {
        "nodesJsonExact": document["nodes"][2:4] == v7["nodes"][2:4],
        "meshJsonExact": document["meshes"][1] == v7["meshes"][1],
        "materialJsonExact": document["materials"][1] == v7["materials"][1],
        "texturesJsonExact": document["textures"][4:7] == v7["textures"][4:7],
        "imagesJsonExact": document["images"][4:7] == v7["images"][4:7],
        "accessorsJsonExact": document["accessors"][4:8] == v7["accessors"][4:8],
        "samplersJsonExact": document["samplers"][: len(v7.get("samplers", []))]
        == v7.get("samplers", []),
    }
    output_binary = bytes(binary)
    connector_checks["accessorPayloads"] = [
        {
            "accessor": index,
            "bytes": len(accessor_payload(v7, v7_binary, index)),
            "sha256": digest_bytes(accessor_payload(v7, v7_binary, index)),
            "outputSha256": digest_bytes(accessor_payload(document, output_binary, index)),
            "exact": accessor_payload(v7, v7_binary, index)
            == accessor_payload(document, output_binary, index),
        }
        for index in range(4, 8)
    ]
    connector_checks["imagePayloads"] = [
        {
            "image": index,
            "bytes": len(image_payload(v7, v7_binary, index)),
            "sha256": digest_bytes(image_payload(v7, v7_binary, index)),
            "outputSha256": digest_bytes(image_payload(document, output_binary, index)),
            "exact": image_payload(v7, v7_binary, index)
            == image_payload(document, output_binary, index),
        }
        for index in range(4, 7)
    ]
    connector_checks["bufferViewPayloads"] = [
        {
            "bufferView": index,
            "bytes": len(view_payload(v7, v7_binary, index)),
            "sha256": digest_bytes(view_payload(v7, v7_binary, index)),
            "outputSha256": digest_bytes(view_payload(document, output_binary, index)),
            "exact": view_payload(v7, v7_binary, index)
            == view_payload(document, output_binary, index),
        }
        for index in range(8, 15)
    ]
    if not all(value for key, value in connector_checks.items() if key.endswith("Exact")):
        raise ValueError(f"V7 connector logical records changed: {connector_checks}")
    if not all(row["exact"] for row in connector_checks["accessorPayloads"]):
        raise ValueError("V7 connector accessor payload changed")
    if not all(row["exact"] for row in connector_checks["imagePayloads"]):
        raise ValueError("V7 connector image payload changed")
    if not all(row["exact"] for row in connector_checks["bufferViewPayloads"]):
        raise ValueError("V7 connector buffer-view payload changed")

    candidate_payloads = []
    for source_index, output_index in candidate_accessor_map.items():
        source_payload = accessor_payload(candidate, candidate_binary, source_index)
        output_payload = accessor_payload(document, output_binary, output_index)
        candidate_payloads.append(
            {
                "sourceAccessor": source_index,
                "outputAccessor": output_index,
                "bytes": len(source_payload),
                "sha256": digest_bytes(source_payload),
                "outputSha256": digest_bytes(output_payload),
                "exact": source_payload == output_payload,
            }
        )
    if not all(row["exact"] for row in candidate_payloads):
        raise ValueError("V8 Conservatory geometry payload changed during assembly")
    return document, output_binary, {
        "v7Connector": {
            "source": repo_path(V7_GLB),
            "sourceSha256": digest(V7_GLB),
            **connector_checks,
        },
        "v8Conservatory": {
            "normalVariant": normal_variant,
            "geometryAccessorPayloads": candidate_payloads,
            "secondGeometryReduction": False,
        },
        "conservatoryRuntimeTextures": {
            role: runtime_images[role]["report"] for role in runtime_roles
        },
    }


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


def clear_aperture_widths(objects: list[bpy.types.Object]) -> dict[str, object]:
    low, high = object_bounds(objects)
    trees = []
    for obj in objects:
        vertices = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
        polygons = [tuple(polygon.vertices) for polygon in obj.data.polygons]
        trees.append(BVHTree.FromPolygons(vertices, polygons, all_triangles=False))
    samples = 401
    rows = []
    for fraction in (0.16, 0.28, 0.40):
        height = low.z + (high.z - low.z) * fraction
        clear = []
        for index in range(samples):
            x = low.x + (high.x - low.x) * index / (samples - 1)
            origin = Vector((x, low.y - 0.1, height))
            blocked = any(
                tree.ray_cast(
                    origin,
                    Vector((0.0, 1.0, 0.0)),
                    (high.y - low.y) + 0.2,
                )[0]
                is not None
                for tree in trees
            )
            clear.append(not blocked)
        centre = min(
            range(samples),
            key=lambda index: abs(low.x + (high.x - low.x) * index / (samples - 1)),
        )
        left = centre
        right = centre
        if clear[centre]:
            while left > 0 and clear[left - 1]:
                left -= 1
            while right + 1 < samples and clear[right + 1]:
                right += 1
        width = (high.x - low.x) * (right - left) / (samples - 1) if clear[centre] else 0.0
        rows.append(
            {
                "heightFraction": fraction,
                "heightMetres": height,
                "clearWidthMetres": width,
            }
        )
    return {
        "method": "front-to-back ray grid through the central opening after fresh GLB import",
        "samplesAcrossWidth": samples,
        "rows": rows,
        "minimumSampledClearWidthMetres": min(row["clearWidthMetres"] for row in rows),
    }


def validate_document(
    path: Path, expected_conservatory_triangles: int
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
        raise ValueError(f"Runtime GLB introduced unsupported geometry codecs: {forbidden}")
    required_names = {
        ROOT_NAME,
        CONSERVATORY_NAME,
        CONSERVATORY_GEOMETRY_NAME,
        CONNECTOR_NAME,
        CONNECTOR_GEOMETRY_NAME,
    }
    names = {node.get("name") for node in document["nodes"]}
    if missing := sorted(required_names - names):
        raise ValueError(f"Runtime GLB lost stable nodes: {missing}")
    root = document["nodes"][named_index(document["nodes"], ROOT_NAME)]
    if root.get("extras", {}).get("assetId") != RUNTIME_ASSET_ID:
        raise ValueError("Runtime GLB changed the stable architecture-kit logical ID")
    triangle_counts = {}
    for mesh_name, logical_name in (
        (CONSERVATORY_GEOMETRY_NAME + "_mesh", CONSERVATORY_NAME),
        (CONNECTOR_GEOMETRY_NAME + "_mesh", CONNECTOR_NAME),
    ):
        mesh = document["meshes"][named_index(document["meshes"], mesh_name)]
        if len(mesh.get("primitives", [])) != 1:
            raise ValueError(f"Runtime {logical_name} no longer has one primitive")
        accessor = document["accessors"][int(mesh["primitives"][0]["indices"])]
        triangle_counts[logical_name] = int(accessor["count"]) // 3
    if triangle_counts[CONSERVATORY_NAME] != expected_conservatory_triangles:
        raise ValueError("Runtime assembly changed the reviewed Conservatory triangle count")
    if triangle_counts[CONNECTOR_NAME] != CONNECTOR_TRIANGLES:
        raise ValueError("Runtime assembly changed the V7 connector triangle count")
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
    return {
        "file": art_path(path),
        "bytes": len(raw),
        "sha256": digest_bytes(raw),
        "triangles": {
            **triangle_counts,
            "total": sum(triangle_counts.values()),
        },
        "nodes": [node.get("name") for node in document["nodes"]],
        "images": image_rows,
        "extensionsUsed": document.get("extensionsUsed", []),
        "extensionsRequired": document.get("extensionsRequired", []),
        "forbiddenGeometryCodecExtensions": forbidden,
    }


def fresh_reimport_and_save(
    expected_conservatory_triangles: int,
) -> tuple[dict[str, object], dict[str, object]]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(KIT_GLB))
    root = bpy.data.objects.get(ROOT_NAME)
    if root is None:
        raise ValueError("Fresh import lost the museum-kit root")
    rows: dict[str, object] = {}
    targets = {
        CONSERVATORY_NAME: CONSERVATORY_TARGET_DIMENSIONS,
        CONNECTOR_NAME: CONNECTOR_TARGET_DIMENSIONS,
    }
    for name, target in targets.items():
        group = bpy.data.objects.get(name)
        if group is None or group.parent != root:
            raise ValueError(f"Fresh import lost hierarchy for {name}")
        meshes = [obj for obj in descendants(group) if obj.type == "MESH"]
        low, high = object_bounds(meshes)
        dimensions = [high.x - low.x, high.z - low.z, high.y - low.y]
        if abs(low.z) > 1e-5 or any(
            abs(actual - expected) > 1e-4
            for actual, expected in zip(dimensions, target, strict=True)
        ):
            raise ValueError(f"Fresh import {name} dimensions/anchor changed: {dimensions}")
        triangle_count = sum(triangles(obj.data) for obj in meshes)
        if any(obj.data.uv_layers.active is None for obj in meshes):
            raise ValueError(f"Fresh import lost UV0 for {name}")
        aperture = clear_aperture_widths(meshes) if name == CONNECTOR_NAME else None
        if aperture is not None and aperture["minimumSampledClearWidthMetres"] < MINIMUM_APERTURE:
            raise ValueError(f"Fresh import connector aperture is too narrow: {aperture}")
        rows[name] = {
            "meshChildren": [obj.name for obj in meshes],
            "triangles": triangle_count,
            "dimensionsGlTfYUpMetres": dimensions,
            "anchorErrorMetres": abs(low.z),
            "uv0Present": True,
            "materials": sorted(
                {
                    material.name
                    for obj in meshes
                    for material in obj.data.materials
                    if material is not None
                }
            ),
            "aperture": aperture,
        }
    if rows[CONSERVATORY_NAME]["triangles"] != expected_conservatory_triangles:
        raise ValueError("Fresh import changed the reviewed Conservatory triangle count")
    if rows[CONNECTOR_NAME]["triangles"] != CONNECTOR_TRIANGLES:
        raise ValueError("Fresh import changed the V7 connector triangle count")
    bpy.ops.file.pack_all()
    missing = sorted(
        image.filepath
        for image in bpy.data.images
        if image.source != "GENERATED" and image.packed_file is None
    )
    if missing:
        raise ValueError(f"Packed runtime source retains external images: {missing}")
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
        "coordinates": "Fresh GLB reimport into Blender Z-up; dimensions listed in glTF X/Y/Z order.",
        "nodes": rows,
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
    variant = VARIANTS[args.normal_variant]
    require_file(V7_GLB, "Approved V7 architecture kit")
    require_file(CANDIDATE_MANIFEST, "V8 Conservatory candidate manifest")
    candidate_manifest = json.loads(CANDIDATE_MANIFEST.read_text())
    candidate_path = variant["file"]
    candidate, candidate_binary, candidate_report = validate_candidate(
        candidate_path, candidate_manifest, str(variant["manifestKey"])
    )
    provenance = validate_candidate_provenance(
        candidate_manifest, candidate_path, str(variant["normalSource"])
    )
    document, binary, build = build_document(candidate, candidate_binary, args.normal_variant)
    write_glb(KIT_GLB, document, binary)
    glb = validate_document(KIT_GLB, int(candidate_report["triangles"]))
    fresh, packed = fresh_reimport_and_save(int(candidate_report["triangles"]))
    manifest = {
        "schema": 1,
        "assetId": ARTIFACT_ID,
        "runtimeLogicalAssetId": RUNTIME_ASSET_ID,
        "status": "review-only combined derivative; public/runtime integration not performed",
        "coordinates": "Blender Z-up authoring; exported glTF +Y up; metres",
        "root": ROOT_NAME,
        "normalSelection": {
            "cliVariant": args.normal_variant,
            "normalSource": variant["normalSource"],
            "explicitNoDefault": True,
            "visualSelectionReceipt": provenance,
        },
        "sources": {
            "v7ArchitectureKit": {
                "file": repo_path(V7_GLB),
                "bytes": V7_GLB.stat().st_size,
                "sha256": digest(V7_GLB),
            },
            "v8ConservatoryCandidateManifest": {
                "file": art_path(CANDIDATE_MANIFEST),
                "bytes": CANDIDATE_MANIFEST.stat().st_size,
                "sha256": digest(CANDIDATE_MANIFEST),
            },
            "v8ConservatoryCandidate": candidate_report,
            "retextureReceipt": {
                "file": art_path(RETEXTURE_RECEIPT),
                "bytes": RETEXTURE_RECEIPT.stat().st_size,
                "sha256": digest(RETEXTURE_RECEIPT),
            },
        },
        "glb": glb,
        "packedBlend": packed,
        "v7ConnectorPreservation": build["v7Connector"],
        "v8ConservatoryGeometryPreservation": build["v8Conservatory"],
        "conservatoryRuntimeTexturePass": {
            "baseColor": "2K review-quality WebP",
            "dataMaps": "1K lossless; smaller of lossless WebP and optimized PNG",
            "maps": build["conservatoryRuntimeTextures"],
        },
        "freshReimport": fresh,
        "validation": {
            "explicitReviewedNormalSelection": True,
            "candidateManifestAndSelectionHashesMatched": True,
            "freshGlbReimport": True,
            "packedEditableRuntimeSource": True,
            "requiredNamedHierarchy": True,
            "reviewedConservatoryTriangleCountExact": True,
            "noSecondGeometryReduction": True,
            "dimensionsAndGroundAnchorsPassed": True,
            "connectorAperturePassed": True,
            "uv0Present": True,
            "v7ConnectorLogicalRecordsAndPayloadsExact": True,
            "noDracoOrMeshopt": True,
            "runtimeIntegration": "not performed",
        },
        "rebuild": {
            "workingDirectory": "repository root",
            "command": (
                "rtk proxy timeout 1800 env ALSOFT_DRIVERS=null blender -b --factory-startup "
                "--python-exit-code 1 --python "
                "art/glass-adventure/journey-map/v8/production/build_architecture_kit_runtime.py "
                f"-- --normal-variant {args.normal_variant}"
            ),
            "blender": bpy.app.version_string,
        },
    }
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(
        "FLOATING_MUSEUM_ARCHITECTURE_KIT_V8_BUILT="
        + json.dumps(
            {
                "normalVariant": args.normal_variant,
                "glbBytes": glb["bytes"],
                "glbSha256": glb["sha256"],
                "blendBytes": packed["bytes"],
                "triangles": glb["triangles"],
                "connectorExact": True,
            }
        ),
        flush=True,
    )
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
