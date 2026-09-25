#!/usr/bin/env python3
"""Derive the bounded, meshopt scroll runtime bundle from the packed source export."""

from __future__ import annotations

import importlib.util
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from typing import Any

import bpy


HERE = Path(__file__).resolve().parent


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load {path.name}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


DELIVERY = load_module(
    "cloudway_scroll_full_detail_delivery",
    HERE / "prepare_scroll_runtime_delivery.py",
)
PREPARE = DELIVERY.PREPARE
SOURCE = DELIVERY.SOURCE
REPO = HERE.parents[4]
MESHOPT = REPO / "apps/beside-cue/node_modules/.bin/gltf-transform"
BASE_COLOR_LIMIT = 2048
DATA_TEXTURE_LIMIT = 2048
WEBP_QUALITY = 90
POSITION_BITS = 16
NORMAL_BITS = 12
TEXCOORD_BITS = 14
SOURCE_IMAGES = {
    "baseColor": ("gilt-scroll-bridge__base_color", BASE_COLOR_LIMIT),
    "normal": ("gilt-scroll-bridge__normal", DATA_TEXTURE_LIMIT),
    "metallic": ("gilt-scroll-bridge__metallic", DATA_TEXTURE_LIMIT),
    "roughness": ("gilt-scroll-bridge__roughness", DATA_TEXTURE_LIMIT),
}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def bounded_paths() -> dict[str, Path]:
    runtime_dir = SOURCE / "runtime" / DELIVERY.ASSET
    production_dir = SOURCE / "production" / DELIVERY.ASSET
    return {
        "glb": runtime_dir / f"{DELIVERY.ASSET}-runtime-v1.glb",
        "manifest": runtime_dir / "manifest.json",
        "report": production_dir / "scroll-runtime-v1-report.json",
        "mirror": HERE / "reports" / f"{DELIVERY.ASSET}-runtime-v1.json",
    }


def resize_source_images() -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for role, (name, maximum) in SOURCE_IMAGES.items():
        image = bpy.data.images.get(name)
        require(image is not None, f"Packed runtime source image {name} is absent")
        before = [int(image.size[0]), int(image.size[1])]
        scale = min(1.0, maximum / max(before))
        after = [max(1, round(before[0] * scale)), max(1, round(before[1] * scale))]
        require(max(after) <= maximum, f"{name}: bounded dimensions exceed policy")
        if after != before:
            image.scale(*after)
        image.pack()
        records.append(
            {
                "role": role,
                "image": name,
                "sourceDimensions": before,
                "runtimeDimensions": after,
            }
        )
    return records


def export_webp_source(root: bpy.types.Object, path: Path) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for child in DELIVERY.descendants(root):
        child.select_set(True)
    bpy.context.view_layer.objects.active = root
    result = bpy.ops.export_scene.gltf(
        filepath=str(path),
        check_existing=False,
        export_format="GLB",
        use_selection=True,
        export_extras=True,
        export_yup=True,
        export_apply=False,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
        export_materials="EXPORT",
        export_texcoords=True,
        export_normals=True,
        export_tangents=True,
        export_attributes=False,
        export_image_format="WEBP",
        export_image_quality=WEBP_QUALITY,
        export_image_add_webp=False,
        export_image_webp_fallback=False,
        export_unused_images=False,
    )
    require(result == {"FINISHED"} and path.is_file(), "Blender WebP GLB export failed")


def compress_meshopt(source: Path, output: Path) -> None:
    require(MESHOPT.is_file(), f"Pinned glTF Transform CLI is absent: {MESHOPT}")
    subprocess.run(
        [
            str(MESHOPT),
            "meshopt",
            str(source),
            str(output),
            "--level",
            "high",
            "--quantization-volume",
            "mesh",
            "--quantize-position",
            str(POSITION_BITS),
            "--quantize-normal",
            str(NORMAL_BITS),
            "--quantize-texcoord",
            str(TEXCOORD_BITS),
            "--quantize-generic",
            "14",
        ],
        cwd=REPO,
        check=True,
    )
    require(output.is_file(), "glTF Transform did not emit the meshopt bundle")


def webp_dimensions(payload: bytes) -> list[int]:
    require(payload[:4] == b"RIFF" and payload[8:12] == b"WEBP", "Expected embedded WebP")
    chunk = payload[12:16]
    body = payload[20:]
    if chunk == b"VP8X":
        return [
            1 + int.from_bytes(body[4:7], "little"),
            1 + int.from_bytes(body[7:10], "little"),
        ]
    if chunk == b"VP8 ":
        marker = body.find(b"\x9d\x01\x2a")
        require(marker >= 0, "Malformed VP8 WebP")
        return [
            int.from_bytes(body[marker + 3 : marker + 5], "little") & 0x3FFF,
            int.from_bytes(body[marker + 5 : marker + 7], "little") & 0x3FFF,
        ]
    if chunk == b"VP8L" and body[:1] == b"\x2f":
        bits = int.from_bytes(body[1:5], "little")
        return [1 + (bits & 0x3FFF), 1 + ((bits >> 14) & 0x3FFF)]
    raise RuntimeError(f"Unsupported embedded WebP chunk {chunk!r}")


def resource_inventory(
    path: Path,
    full_report: dict[str, Any],
) -> dict[str, Any]:
    document, binary = DELIVERY.read_glb(path)
    used = set(document.get("extensionsUsed", []))
    required = set(document.get("extensionsRequired", []))
    require("EXT_meshopt_compression" in required, "Bounded bundle is not meshopt-required")
    require("EXT_texture_webp" in required, "Bounded bundle is not WebP-required")
    require("KHR_mesh_quantization" in required, "Bounded bundle is not quantized")
    require(not any("draco" in item.lower() for item in used), "Bounded bundle introduced Draco")

    nodes = document.get("nodes", [])
    named_nodes: dict[str, list[dict[str, Any]]] = {}
    for node in nodes:
        named_nodes.setdefault(node.get("name", ""), []).append(node)
    expected_nodes = {
        DELIVERY.ROOT_NAME,
        *DELIVERY.SEMANTIC.ROLE_ROOTS.values(),
        *DELIVERY.MESH_BINDING_KINDS.keys(),
    }
    for name in expected_nodes:
        require(len(named_nodes.get(name, [])) == 1, f"Bounded bundle node {name} is absent or ambiguous")
    root = named_nodes[DELIVERY.ROOT_NAME][0]
    require(
        DELIVERY.node_transform(root)
        == {
            "translation": [0.0, 0.0, 0.0],
            "rotation": [0.0, 0.0, 0.0, 1.0],
            "scale": [1.0, 1.0, 1.0],
        },
        "Bounded bundle root is not identity",
    )
    extras = root.get("extras", {})
    require(
        extras.get("collider_json")
        == full_report["glbInventory"]["metadataStrings"]["collider_json"],
        "Bounded bundle collider metadata differs",
    )
    require(
        extras.get("platform_adapter_json")
        == full_report["glbInventory"]["metadataStrings"]["platform_adapter_json"],
        "Bounded bundle adapter metadata differs",
    )

    accessors = document.get("accessors", [])
    meshes = document.get("meshes", [])
    materials = document.get("materials", [])
    material_names = [material.get("name", "") for material in materials]
    mesh_rows: dict[str, Any] = {}
    total_triangles = 0
    for mesh_name, binding in full_report["materialBindings"].items():
        node = named_nodes[mesh_name][0]
        require(isinstance(node.get("mesh"), int), f"{mesh_name}: bounded node lacks mesh")
        primitives = meshes[node["mesh"]].get("primitives", [])
        require(len(primitives) == 1, f"{mesh_name}: bounded mesh needs one primitive")
        primitive = primitives[0]
        require(isinstance(primitive.get("indices"), int), f"{mesh_name}: bounded mesh lacks indices")
        triangles = int(accessors[primitive["indices"]]["count"]) // 3
        material = material_names[primitive["material"]]
        require(material == binding["material"], f"{mesh_name}: bounded material differs")
        expected = full_report["glbInventory"]["meshRows"][mesh_name]
        require(triangles == expected["triangles"], f"{mesh_name}: triangle count changed")
        mesh_rows[mesh_name] = {
            "triangles": triangles,
            "material": material,
            "attributes": sorted(primitive.get("attributes", {}).keys()),
        }
        total_triangles += triangles
    require(total_triangles == 527368, "Bounded bundle total triangle count changed")

    views = document.get("bufferViews", [])
    image_view_indices: set[int] = set()
    image_rows: list[dict[str, Any]] = []
    for image in document.get("images", []):
        view_index = image.get("bufferView")
        require(isinstance(view_index, int) and "uri" not in image, "Bounded image is external")
        image_view_indices.add(view_index)
        view = views[view_index]
        start = int(view.get("byteOffset", 0))
        end = start + int(view["byteLength"])
        payload = binary[start:end]
        require(image.get("mimeType") == "image/webp", "Bounded image is not WebP")
        image_rows.append(
            {
                "name": image.get("name"),
                "mimeType": image["mimeType"],
                "bytes": len(payload),
                "sha256": hashlib.sha256(payload).hexdigest(),
                "dimensions": webp_dimensions(payload),
            }
        )
    expected_dimensions = sorted(
        [[BASE_COLOR_LIMIT, BASE_COLOR_LIMIT]]
        + [[DATA_TEXTURE_LIMIT, DATA_TEXTURE_LIMIT]] * 2
    )
    require(
        sorted(row["dimensions"] for row in image_rows) == expected_dimensions,
        "Bounded WebP dimensions differ from policy",
    )
    decoded_meshopt_bytes = 0
    other_buffer_bytes = 0
    for index, view in enumerate(views):
        meshopt = view.get("extensions", {}).get("EXT_meshopt_compression")
        if meshopt:
            decoded_meshopt_bytes += int(meshopt["count"]) * int(meshopt["byteStride"])
        elif index not in image_view_indices:
            other_buffer_bytes += int(view.get("byteLength", 0))
    rgba8_base = (BASE_COLOR_LIMIT**2 + 2 * DATA_TEXTURE_LIMIT**2) * 4
    return {
        "assetVersion": document.get("asset", {}).get("version"),
        "generator": document.get("asset", {}).get("generator"),
        "extensionsUsed": sorted(used),
        "extensionsRequired": sorted(required),
        "nodes": len(nodes),
        "meshes": len(meshes),
        "materials": material_names,
        "meshRows": mesh_rows,
        "totalTriangles": total_triangles,
        "images": image_rows,
        "resourceBudget": {
            "bundleBytes": path.stat().st_size,
            "embeddedImageBytes": sum(row["bytes"] for row in image_rows),
            "meshoptDecodedBufferBytes": decoded_meshopt_bytes,
            "otherBufferBytes": other_buffer_bytes,
            "estimatedRgba8BaseLevelTextureBytes": rgba8_base,
            "estimatedRgba8MipmappedTextureBytes": math.ceil(rgba8_base * 4 / 3),
            "scope": (
                "Texture estimates include base color, normal, and the packed metallic/roughness image. "
                "They are arithmetic upload estimates, not measured device memory or performance."
            ),
        },
        "metadataStrings": {
            "collider_json": extras["collider_json"],
            "platform_adapter_json": extras["platform_adapter_json"],
        },
        "externalDependencies": [],
    }


def build() -> dict[str, Any]:
    full_paths = DELIVERY.paths()
    output = bounded_paths()
    full_report = json.loads(full_paths["mirror"].read_text())
    require(
        PREPARE.digest(full_paths["runtimeGlb"]) == full_report["bundle"]["sha256"],
        "Full-detail GLB differs from its checkpoint report",
    )
    require(
        PREPARE.digest(full_paths["runtimeBlend"])
        == full_report["runtimeBlend"]["sha256"],
        "Packed runtime Blend differs from its checkpoint report",
    )
    require(
        PREPARE.digest(full_paths["candidate"])
        == DELIVERY.ACCEPTED_CANDIDATE_SHA256,
        "Accepted optical candidate changed",
    )

    bpy.ops.wm.open_mainfile(filepath=str(full_paths["runtimeBlend"]), load_ui=False)
    root = bpy.data.objects.get(DELIVERY.ROOT_NAME)
    require(root is not None and root.parent is None, "Packed runtime root is absent")
    textures = resize_source_images()
    temporary_directory = Path(
        tempfile.mkdtemp(prefix=f".{DELIVERY.ASSET}-bounded-", dir=output["glb"].parent)
    )
    uncompressed = temporary_directory / "webp.glb"
    compressed = temporary_directory / "meshopt.glb"
    try:
        export_webp_source(root, uncompressed)
        compress_meshopt(uncompressed, compressed)
        output["glb"].parent.mkdir(parents=True, exist_ok=True)
        os.replace(compressed, output["glb"])
    finally:
        shutil.rmtree(temporary_directory, ignore_errors=True)

    inventory = resource_inventory(output["glb"], full_report)
    report = {
        "schema": 1,
        "assetId": DELIVERY.RUNTIME_ID,
        "status": "bounded-runtime-delivery-prepared-pending-real-renderer-proof",
        "scope": (
            "The accepted full-detail GLB and packed source remain immutable. This delivery derivative "
            "keeps all 527,368 triangles, exact semantic nodes, support metadata, and per-mesh material "
            "assignments while bounding texture upload size and applying meshopt quantization/compression."
        ),
        "bundle": {
            **PREPARE.file_record(output["glb"]),
            "logicalId": DELIVERY.RUNTIME_ID,
            "rootNode": DELIVERY.ROOT_NAME,
            "deliveryClass": "bounded-playable-candidate",
            "externalDependencies": [],
        },
        "sourceCheckpoints": {
            "acceptedOpticalCandidate": PREPARE.file_record(full_paths["candidate"]),
            "packedRuntimeBlend": PREPARE.file_record(full_paths["runtimeBlend"]),
            "fullDetailGlb": PREPARE.file_record(full_paths["runtimeGlb"]),
            "fullDetailReport": PREPARE.file_record(full_paths["mirror"]),
            "sourceFilesUnchanged": True,
        },
        "coordinates": full_report["coordinates"],
        "supportCertification": full_report["supportCertification"],
        "roles": full_report["roles"],
        "materialBindings": full_report["materialBindings"],
        "geometry": {
            "triangles": inventory["totalTriangles"],
            "decimated": False,
            "remeshed": False,
            "semanticNodesUnchanged": True,
            "materialAssignmentsUnchanged": True,
            "meshopt": {
                "level": "high",
                "quantizationVolume": "mesh",
                "positionBits": POSITION_BITS,
                "normalBits": NORMAL_BITS,
                "texcoordBits": TEXCOORD_BITS,
                "positionQuantizationStepUpperBoundMetres": round(2.4 / ((1 << POSITION_BITS) - 1), 9),
                "note": "Compression may reorder encoded vertices and indices; it does not simplify or remove triangles.",
            },
        },
        "textures": {
            "policy": {
                "baseColorMaximum": BASE_COLOR_LIMIT,
                "dataMaximum": DATA_TEXTURE_LIMIT,
                "format": "WebP",
                "quality": WEBP_QUALITY,
            },
            "qualityDecision": {
                "rejectedDiagnostic": {
                    "baseColorMaximum": 2048,
                    "dataMaximum": 1024,
                    "bundleBytes": 4546908,
                    "sha256": "e11870e8bd49b59c2110ed0a77ab85c2e7a51d30bb3f471214a6e44d17007718",
                    "estimatedRgba8MipmappedTextureBytes": 33554432,
                    "reason": (
                        "Matched close-play review showed visible mottling in the ivory inlay "
                        "relative to the full-detail reference."
                    ),
                },
                "selectedPolicy": (
                    "Keep the 2K base-color limit and raise normal plus packed metallic/roughness "
                    "to 2K. The matched close-play proof restores continuous ivory veining while "
                    "retaining a bounded delivery budget."
                ),
            },
            "sourceImages": textures,
            "embeddedImages": inventory["images"],
            "fullResolutionPackedSourceUnchanged": True,
        },
        "glbInventory": inventory,
        "remainingGate": (
            "Actual GLTFLoader with MeshoptDecoder, production scroll adapter, and WebGLRenderer proof, "
            "including close comparison for visible texture degradation."
        ),
        "tool": {
            "blender": bpy.app.version_string,
            "gltfTransform": "4.4.2",
        },
        "rebuild": (
            "rtk proxy flock -w 1200 /tmp/glass-cloudway-blender.lock timeout 1200 "
            "env ALSOFT_DRIVERS=null /usr/bin/blender --background --factory-startup "
            "--python-exit-code 1 --python "
            "art/glass-adventure/cloudway-laboratory/v1/production/prepare_scroll_runtime_bundle.py"
        ),
    }
    PREPARE.durable_json(output["manifest"], report)
    PREPARE.durable_json(output["report"], report)
    PREPARE.durable_json(output["mirror"], report)
    require(PREPARE.digest(output["manifest"]) == PREPARE.digest(output["mirror"]), "Bounded manifest mirror differs")
    require(PREPARE.digest(output["report"]) == PREPARE.digest(output["mirror"]), "Bounded report mirror differs")
    require(PREPARE.digest(full_paths["runtimeGlb"]) == full_report["bundle"]["sha256"], "Build mutated full-detail GLB")
    require(PREPARE.digest(full_paths["runtimeBlend"]) == full_report["runtimeBlend"]["sha256"], "Build mutated packed runtime Blend")
    require(PREPARE.digest(full_paths["candidate"]) == DELIVERY.ACCEPTED_CANDIDATE_SHA256, "Build mutated accepted optical candidate")
    return report


if __name__ == "__main__":
    print(json.dumps(build(), indent=2))
