"""Build the review-only V7 runtime kit while preserving the V6 conservatory.

The V6 conservatory already meets its visual and runtime contract. This packer
copies its glTF geometry, material records, and embedded image payloads exactly,
then replaces only the connector with the approved 102k V7 candidate. Connector
textures are repacked as a 2K base-color WebP and 1K normal/ORM WebPs. No geometry
codec or runtime decoder is introduced.
"""

from __future__ import annotations

from copy import deepcopy
import hashlib
from io import BytesIO
import json
import math
from pathlib import Path
import struct

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import numpy as np
from PIL import Image as PILImage


HERE = Path(__file__).resolve().parent
ART = HERE.parent
V6 = ART.parent / "v6"
V6_GLB = V6 / "exports" / "floating-museum-architecture-kit-v6.glb"
CONNECTOR_GLB = ART / "exports" / "floating-museum-twin-connector-candidate-v7.glb"
KIT_GLB = ART / "exports" / "floating-museum-architecture-kit-v7.glb"
KIT_BLEND = ART / "sources" / "floating-museum-architecture-kit-v7.blend"
MANIFEST = ART / "exports" / "floating-museum-architecture-kit-v7.json"

ROOT_NAME = "map_museum_polish_kit_root"
CONSERVATORY_NAME = "map_conservatory"
CONNECTOR_NAME = "map_twin_connector"
ASSET_ID = "floating-museum-architecture-kit-v7"
WEBP_QUALITY = 92
WEBP_METHOD = 6
CONNECTOR_TARGET_DIMENSIONS = (1.70, 2.80, 0.80)
CONSERVATORY_TARGET_DIMENSIONS = (2.30, 2.65, 2.30)
MINIMUM_APERTURE = 0.80


def digest_bytes(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def digest(path: Path) -> str:
    return digest_bytes(path.read_bytes())


def read_glb(path: Path) -> tuple[dict[str, object], bytes, bytes]:
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
    if len(binary) != int(document["buffers"][0]["byteLength"]):
        raise ValueError(f"{path.name} BIN length differs from its glTF declaration")
    return document, binary, raw


def view_payload(document: dict[str, object], binary: bytes, index: int) -> bytes:
    view = document["bufferViews"][index]
    offset = int(view.get("byteOffset", 0))
    return binary[offset : offset + int(view["byteLength"])]


def append_view(
    views: list[dict[str, object]],
    binary: bytearray,
    template: dict[str, object],
    payload: bytes,
) -> int:
    while len(binary) % 4:
        binary.append(0)
    record = deepcopy(template)
    record["buffer"] = 0
    record["byteOffset"] = len(binary)
    record["byteLength"] = len(payload)
    views.append(record)
    binary.extend(payload)
    return len(views) - 1


def write_glb(path: Path, document: dict[str, object], binary: bytes) -> None:
    padded_binary = bytearray(binary)
    while len(padded_binary) % 4:
        padded_binary.append(0)
    document["buffers"] = [{"byteLength": len(padded_binary)}]
    encoded_json = json.dumps(document, separators=(",", ":")).encode("utf-8")
    encoded_json += b" " * ((-len(encoded_json)) % 4)
    result = bytearray(struct.pack("<III", 0x46546C67, 2, 0))
    result.extend(struct.pack("<II", len(encoded_json), 0x4E4F534A))
    result.extend(encoded_json)
    result.extend(struct.pack("<II", len(padded_binary), 0x004E4942))
    result.extend(padded_binary)
    struct.pack_into("<I", result, 8, len(result))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(result)


def named_index(records: list[dict[str, object]], name: str) -> int:
    matches = [index for index, record in enumerate(records) if record.get("name") == name]
    if len(matches) != 1:
        raise ValueError(f"Expected exactly one {name!r}, found {matches}")
    return matches[0]


def texture_image_index(document: dict[str, object], texture_index: int) -> int:
    texture = document["textures"][texture_index]
    if "source" not in texture:
        raise ValueError("Review connector unexpectedly uses an extension-only texture")
    return int(texture["source"])


def psnr(reference: np.ndarray, candidate: np.ndarray) -> float:
    error = float(np.mean((reference.astype(np.float32) - candidate.astype(np.float32)) ** 2))
    return float("inf") if error == 0 else 10.0 * math.log10(255.0 * 255.0 / error)


def encode_webp(
    image: PILImage.Image,
    target_size: tuple[int, int],
) -> tuple[bytes, dict[str, object]]:
    source = image.convert("RGB")
    target = (
        source
        if source.size == target_size
        else source.resize(target_size, PILImage.Resampling.LANCZOS)
    )
    output = BytesIO()
    target.save(
        output,
        format="WEBP",
        quality=WEBP_QUALITY,
        method=WEBP_METHOD,
        exact=True,
    )
    encoded = output.getvalue()
    decoded_image = PILImage.open(BytesIO(encoded)).convert("RGB")
    decoded = np.asarray(decoded_image)
    reference = np.asarray(target)
    if decoded_image.size != target_size:
        raise ValueError(f"WebP dimensions are {decoded_image.size}, expected {target_size}")
    return encoded, {
        "sourceDimensions": list(source.size),
        "runtimeDimensions": list(target_size),
        "runtimeBytes": len(encoded),
        "runtimeSha256": digest_bytes(encoded),
        "compressionPsnrDb": round(psnr(reference, decoded), 4),
        "compressionMeanAbsoluteError": round(
            float(np.mean(np.abs(reference.astype(np.float32) - decoded.astype(np.float32)))),
            4,
        ),
    }


def connector_images(
    document: dict[str, object], binary: bytes
) -> tuple[dict[str, bytes], dict[str, object]]:
    material_index = named_index(document["materials"], "map_twin_connector_atlas")
    material = document["materials"][material_index]
    pbr = material["pbrMetallicRoughness"]
    texture_indices = {
        "baseColor": int(pbr["baseColorTexture"]["index"]),
        "normal": int(material["normalTexture"]["index"]),
        "metallicRoughness": int(pbr["metallicRoughnessTexture"]["index"]),
    }
    target_sizes = {
        "baseColor": (2048, 2048),
        "normal": (1024, 1024),
        "metallicRoughness": (1024, 1024),
    }
    payloads: dict[str, bytes] = {}
    report: dict[str, object] = {}
    for role, texture_index in texture_indices.items():
        image_index = texture_image_index(document, texture_index)
        image_record = document["images"][image_index]
        source = view_payload(document, binary, int(image_record["bufferView"]))
        opened = PILImage.open(BytesIO(source)).convert("RGB")
        encoded, metrics = encode_webp(opened, target_sizes[role])
        metrics.update(
            {
                "sourceImage": image_record.get("name"),
                "sourceMimeType": image_record.get("mimeType"),
                "sourceBytes": len(source),
                "sourceSha256": digest_bytes(source),
                "runtimeMimeType": "image/webp",
                "quality": WEBP_QUALITY,
                "method": WEBP_METHOD,
            }
        )
        payloads[role] = encoded
        report[role] = metrics
    emissive = material.get("emissiveTexture")
    if emissive is not None:
        image_index = texture_image_index(document, int(emissive["index"]))
        image_record = document["images"][image_index]
        source = view_payload(document, binary, int(image_record["bufferView"]))
        pixels = np.asarray(PILImage.open(BytesIO(source)).convert("RGB"))
        report["discardedEmissive"] = {
            "reason": "Provider map is effectively black and contributes no visible runtime illumination",
            "sourceImage": image_record.get("name"),
            "sourceBytes": len(source),
            "sourceSha256": digest_bytes(source),
            "maximumChannelValue": int(pixels.max()),
            "p99ChannelValue": float(np.percentile(pixels, 99)),
            "meanChannelValue": round(float(pixels.mean()), 4),
        }
    return payloads, report


def build_document() -> tuple[dict[str, object], bytes, dict[str, object]]:
    v6, v6_binary, _ = read_glb(V6_GLB)
    v7, v7_binary, _ = read_glb(CONNECTOR_GLB)

    if [node.get("name") for node in v6["nodes"]] != [
        "map_conservatory_geometry",
        "map_conservatory",
        "map_twin_connector_geometry",
        "map_twin_connector",
        ROOT_NAME,
    ]:
        raise ValueError("V6 stable node order changed")
    if [mesh.get("name") for mesh in v6["meshes"]] != [
        "map_conservatory_geometry_mesh",
        "map_twin_connector_geometry_mesh",
    ]:
        raise ValueError("V6 mesh contract changed")
    if named_index(v7["nodes"], "map_twin_connector_geometry") != 0:
        raise ValueError("V7 connector geometry node order changed")
    if named_index(v7["materials"], "map_twin_connector_atlas") != 0:
        raise ValueError("V7 connector material order changed")

    views: list[dict[str, object]] = []
    binary = bytearray()
    for index in range(8):
        copied_index = append_view(
            views,
            binary,
            v6["bufferViews"][index],
            view_payload(v6, v6_binary, index),
        )
        if copied_index != index:
            raise ValueError("Conservatory buffer-view order changed")
        if views[index] != v6["bufferViews"][index]:
            raise ValueError("Conservatory buffer-view metadata changed")

    connector_view_map: dict[int, int] = {}
    for index in range(4):
        connector_view_map[index] = append_view(
            views,
            binary,
            v7["bufferViews"][index],
            view_payload(v7, v7_binary, index),
        )

    runtime_images, texture_report = connector_images(v7, v7_binary)
    connector_image_indices: dict[str, int] = {}
    images = deepcopy(v6["images"][:4])
    image_names = {
        "normal": "twin-connector-v7-normal-1k",
        "baseColor": "twin-connector-v7-base-2k",
        "metallicRoughness": "twin-connector-v7-orm-1k",
    }
    for role in ("normal", "baseColor", "metallicRoughness"):
        view_index = append_view(views, binary, {"buffer": 0}, runtime_images[role])
        connector_image_indices[role] = len(images)
        images.append(
            {
                "bufferView": view_index,
                "mimeType": "image/webp",
                "name": image_names[role],
            }
        )

    accessors = deepcopy(v6["accessors"][:4])
    connector_accessor_map: dict[int, int] = {}
    for index, accessor in enumerate(v7["accessors"]):
        copied = deepcopy(accessor)
        copied["bufferView"] = connector_view_map[int(accessor["bufferView"])]
        connector_accessor_map[index] = len(accessors)
        accessors.append(copied)

    conservatory_mesh = deepcopy(v6["meshes"][0])
    connector_mesh = deepcopy(v7["meshes"][0])
    connector_mesh["name"] = "map_twin_connector_geometry_mesh"
    for primitive in connector_mesh["primitives"]:
        primitive["indices"] = connector_accessor_map[int(primitive["indices"])]
        primitive["attributes"] = {
            semantic: connector_accessor_map[int(accessor)]
            for semantic, accessor in primitive["attributes"].items()
        }
        primitive["material"] = 1

    textures = deepcopy(v6["textures"][:4])
    connector_texture_indices: dict[str, int] = {}
    for role in ("normal", "baseColor", "metallicRoughness"):
        connector_texture_indices[role] = len(textures)
        textures.append(
            {
                "sampler": 0,
                "extensions": {
                    "EXT_texture_webp": {"source": connector_image_indices[role]}
                },
            }
        )

    connector_material = {
        "doubleSided": True,
        "name": "map_twin_connector_atlas",
        "normalTexture": {"index": connector_texture_indices["normal"]},
        "pbrMetallicRoughness": {
            "baseColorTexture": {"index": connector_texture_indices["baseColor"]},
            "metallicRoughnessTexture": {
                "index": connector_texture_indices["metallicRoughness"]
            },
        },
    }

    nodes = deepcopy(v6["nodes"])
    nodes[2] = deepcopy(v7["nodes"][0])
    nodes[2]["mesh"] = 1
    nodes[3] = deepcopy(v7["nodes"][1])
    nodes[3]["children"] = [2]
    nodes[3].setdefault("extras", {})["assetId"] = "floating-museum-twin-connector-v7"
    nodes[4]["children"] = [1, 3]
    nodes[4].setdefault("extras", {})["assetId"] = ASSET_ID

    document = {
        "asset": {
            "generator": "MercuryPitch V7 deterministic runtime packer",
            "version": "2.0",
        },
        "scene": 0,
        "scenes": deepcopy(v6["scenes"]),
        "nodes": nodes,
        "meshes": [conservatory_mesh, connector_mesh],
        "materials": [deepcopy(v6["materials"][0]), connector_material],
        "textures": textures,
        "images": images,
        "samplers": deepcopy(v6["samplers"]),
        "accessors": accessors,
        "bufferViews": views,
        "buffers": [{"byteLength": 0}],
        "extensionsUsed": [
            "KHR_materials_transmission",
            "KHR_materials_ior",
            "EXT_texture_webp",
        ],
        "extensionsRequired": ["EXT_texture_webp"],
    }

    prefix_length = int(v6["bufferViews"][7]["byteOffset"]) + int(
        v6["bufferViews"][7]["byteLength"]
    )
    preservation = {
        "source": str(V6_GLB.relative_to(ART.parent.parent.parent.parent)),
        "sourceSha256": digest(V6_GLB),
        "geometryAccessorsExact": document["accessors"][:4] == v6["accessors"][:4],
        "meshJsonExact": document["meshes"][0] == v6["meshes"][0],
        "materialJsonExact": document["materials"][0] == v6["materials"][0],
        "texturesJsonExact": document["textures"][:4] == v6["textures"][:4],
        "imagesJsonExact": document["images"][:4] == v6["images"][:4],
        "bufferViewsJsonExact": document["bufferViews"][:8] == v6["bufferViews"][:8],
        "binaryPrefixBytes": prefix_length,
        "binaryPrefixSha256": digest_bytes(bytes(binary[:prefix_length])),
        "sourceBinaryPrefixSha256": digest_bytes(v6_binary[:prefix_length]),
        "binaryPrefixExact": bytes(binary[:prefix_length]) == v6_binary[:prefix_length],
    }
    if not all(
        preservation[key]
        for key in (
            "geometryAccessorsExact",
            "meshJsonExact",
            "materialJsonExact",
            "texturesJsonExact",
            "imagesJsonExact",
            "bufferViewsJsonExact",
            "binaryPrefixExact",
        )
    ):
        raise ValueError(f"V6 conservatory preservation failed: {preservation}")
    return document, bytes(binary), {
        "conservatory": preservation,
        "connectorTextures": texture_report,
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


def object_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points = [
        obj.matrix_world @ vertex.co
        for obj in objects
        if obj.type == "MESH"
        for vertex in obj.data.vertices
    ]
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


def validate_document(path: Path) -> dict[str, object]:
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
    if "EXT_texture_webp" not in extensions:
        raise ValueError("Runtime connector lost its WebP declaration")
    required_names = {
        ROOT_NAME,
        CONSERVATORY_NAME,
        "map_conservatory_geometry",
        CONNECTOR_NAME,
        "map_twin_connector_geometry",
    }
    names = {node.get("name") for node in document["nodes"]}
    if missing := sorted(required_names - names):
        raise ValueError(f"Runtime GLB lost stable nodes: {missing}")
    connector_mesh = document["meshes"][1]
    connector_indices = document["accessors"][connector_mesh["primitives"][0]["indices"]]
    connector_triangles = int(connector_indices["count"]) // 3
    conservatory_mesh = document["meshes"][0]
    conservatory_indices = document["accessors"][
        conservatory_mesh["primitives"][0]["indices"]
    ]
    conservatory_triangles = int(conservatory_indices["count"]) // 3
    if connector_triangles != 102_607 or conservatory_triangles != 22_870:
        raise ValueError(
            f"Triangle contract changed: connector={connector_triangles}, conservatory={conservatory_triangles}"
        )
    image_rows = []
    for image in document["images"]:
        payload = view_payload(document, binary, int(image["bufferView"]))
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
        "file": str(path.relative_to(ART)),
        "bytes": len(raw),
        "sha256": digest_bytes(raw),
        "triangles": {
            "map_conservatory": conservatory_triangles,
            "map_twin_connector": connector_triangles,
            "total": conservatory_triangles + connector_triangles,
        },
        "nodes": [node.get("name") for node in document["nodes"]],
        "images": image_rows,
        "extensionsUsed": document.get("extensionsUsed", []),
        "extensionsRequired": document.get("extensionsRequired", []),
        "forbiddenGeometryCodecExtensions": forbidden,
    }


def fresh_reimport_and_save() -> tuple[dict[str, object], dict[str, object]]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(KIT_GLB))
    root = bpy.data.objects.get(ROOT_NAME)
    if root is None:
        raise ValueError("Fresh import lost the museum kit root")
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
        for actual, expected in zip(dimensions, target, strict=True):
            if abs(actual - expected) > 1e-4:
                raise ValueError(f"{name} dimensions {dimensions} missed {target}")
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
    if rows[CONNECTOR_NAME]["triangles"] != 102_607:
        raise ValueError("Fresh import changed the V7 connector triangle count")
    if rows[CONSERVATORY_NAME]["triangles"] != 22_870:
        raise ValueError("Fresh import changed the V6 conservatory triangle count")

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
    bpy.ops.wm.save_as_mainfile(
        filepath=str(KIT_BLEND),
        compress=True,
        check_existing=False,
    )
    packed = {
        "file": str(KIT_BLEND.relative_to(ART)),
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
    document, binary, build = build_document()
    write_glb(KIT_GLB, document, binary)
    glb = validate_document(KIT_GLB)
    fresh, packed = fresh_reimport_and_save()
    manifest = {
        "schema": 1,
        "assetId": ASSET_ID,
        "status": "review-only runtime derivative; public integration not performed",
        "coordinates": "Blender Z-up authoring; exported glTF +Y up; metres",
        "root": ROOT_NAME,
        "sources": {
            "v6ArchitectureKit": {
                "file": str(V6_GLB.relative_to(ART.parent.parent.parent.parent)),
                "bytes": V6_GLB.stat().st_size,
                "sha256": digest(V6_GLB),
            },
            "v7ConnectorCandidate": {
                "file": str(CONNECTOR_GLB.relative_to(ART)),
                "bytes": CONNECTOR_GLB.stat().st_size,
                "sha256": digest(CONNECTOR_GLB),
            },
        },
        "glb": glb,
        "packedBlend": packed,
        "v6ConservatoryPreservation": build["conservatory"],
        "connectorTexturePass": {
            "format": "WebP",
            "quality": WEBP_QUALITY,
            "method": WEBP_METHOD,
            "maps": build["connectorTextures"],
        },
        "freshReimport": fresh,
        "validation": {
            "freshGlbReimport": True,
            "packedEditableRuntimeSource": True,
            "requiredNamedHierarchy": True,
            "exactTriangleCounts": True,
            "dimensionsAndGroundAnchorsPassed": True,
            "connectorAperturePassed": True,
            "uv0Present": True,
            "v6ConservatoryGeometryMaterialAndImagesExact": True,
            "noDracoOrMeshopt": True,
            "runtimeIntegration": "not performed",
        },
        "rebuild": {
            "workingDirectory": "repository root",
            "command": (
                "rtk proxy env ALSOFT_DRIVERS=null blender -b --factory-startup "
                "--python-exit-code 1 --python "
                "art/glass-adventure/journey-map/v7/production/build_architecture_kit_runtime.py"
            ),
            "blender": bpy.app.version_string,
        },
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(
        "FLOATING_MUSEUM_ARCHITECTURE_KIT_V7_BUILT="
        + json.dumps(
            {
                "glbBytes": glb["bytes"],
                "glbSha256": glb["sha256"],
                "blendBytes": packed["bytes"],
                "triangles": glb["triangles"],
                "conservatoryExact": build["conservatory"]["binaryPrefixExact"],
            }
        ),
        flush=True,
    )
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
