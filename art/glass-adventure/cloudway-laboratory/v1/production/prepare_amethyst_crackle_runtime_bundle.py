#!/usr/bin/env python3
"""Derive the all-triangle 2K Meshopt Amethyst crackle delivery candidate."""

from __future__ import annotations

import hashlib
import importlib.util
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
    "cloudway_amethyst_full_detail_delivery_bundle",
    HERE / "prepare_amethyst_crackle_runtime_delivery.py",
)
BUILD = DELIVERY.BUILD
PREPARE = DELIVERY.PREPARE
SOURCE = DELIVERY.SOURCE
REPO = HERE.parents[4]
GLTF_TRANSFORM = REPO / "apps/beside-cue/node_modules/.bin/gltf-transform"
TEXTURE_LIMIT = 2048
WEBP_QUALITY = 92
POSITION_BITS = 16
NORMAL_BITS = 12
TEXCOORD_BITS = 14
SOURCE_IMAGES = {
    "baseColor": f"{BUILD.ASSET}__base_color",
    "normal": f"{BUILD.ASSET}__normal",
    "metallic": f"{BUILD.ASSET}__metallic",
    "roughness": f"{BUILD.ASSET}__roughness",
}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def paths() -> dict[str, Path]:
    runtime_dir = SOURCE / "runtime" / BUILD.ASSET
    production_dir = SOURCE / "production" / BUILD.ASSET
    return {
        "glb": runtime_dir / f"{BUILD.ASSET}-runtime-v1.glb",
        "manifest": runtime_dir / "manifest.json",
        "sourceReport": production_dir / "runtime-v1-report.json",
        "mirrorReport": HERE / "reports" / f"{BUILD.ASSET}-runtime-v1.json",
    }


def resize_source_images() -> list[dict[str, Any]]:
    records = []
    for role, name in SOURCE_IMAGES.items():
        image = bpy.data.images.get(name)
        require(image is not None, f"Packed source image {name} is absent")
        before = [int(image.size[0]), int(image.size[1])]
        scale = min(1.0, TEXTURE_LIMIT / max(before))
        after = [max(1, round(value * scale)) for value in before]
        require(after == [TEXTURE_LIMIT, TEXTURE_LIMIT], f"{name}: expected square 2K derivative")
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


def export_webp(root: bpy.types.Object, path: Path) -> None:
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
    require(GLTF_TRANSFORM.is_file(), f"Pinned glTF Transform is absent: {GLTF_TRANSFORM}")
    subprocess.run(
        [
            str(GLTF_TRANSFORM),
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
    require(output.is_file(), "glTF Transform did not emit the Meshopt GLB")


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
    raise RuntimeError(f"Unsupported WebP chunk {chunk!r}")


def inventory(path: Path, full: dict[str, Any]) -> dict[str, Any]:
    document, binary = DELIVERY.read_glb(path)
    used = set(document.get("extensionsUsed", []))
    required = set(document.get("extensionsRequired", []))
    require("EXT_meshopt_compression" in required, "Bounded GLB is not Meshopt-required")
    require("EXT_texture_webp" in required, "Bounded GLB is not WebP-required")
    require("KHR_mesh_quantization" in required, "Bounded GLB is not quantized")
    require(not any("draco" in item.lower() for item in used), "Bounded GLB introduced Draco")

    nodes = document.get("nodes", [])
    named: dict[str, list[dict[str, Any]]] = {}
    for node in nodes:
        named.setdefault(node.get("name", ""), []).append(node)
    expected_nodes = {
        BUILD.ROOT_NAME,
        BUILD.PERSISTENT_NAME,
        BUILD.INTACT_NAME,
        BUILD.CONTACT_NAME,
        *BUILD.platform_metadata()["motion"]["roles"]["shards"],
        *DELIVERY.runtime_bindings(),
    }
    for name in expected_nodes:
        require(len(named.get(name, [])) == 1, f"Bounded GLB node {name} is absent or ambiguous")
    root = named[BUILD.ROOT_NAME][0]
    require(
        DELIVERY.node_transform(root)
        == {
            "translation": [0.0, 0.0, 0.0],
            "rotation": [0.0, 0.0, 0.0, 1.0],
            "scale": [1.0, 1.0, 1.0],
        },
        "Bounded GLB root is not identity",
    )
    extras = root.get("extras", {})
    require(
        extras.get("platform_adapter_json")
        == full["inventory"]["metadataStrings"]["platform_adapter_json"]
        and extras.get("collider_json")
        == full["inventory"]["metadataStrings"]["collider_json"],
        "Bounded GLB metadata differs from the full archive",
    )

    accessors = document.get("accessors", [])
    meshes = document.get("meshes", [])
    materials = document.get("materials", [])
    material_names = [material.get("name", "") for material in materials]
    glass = materials[material_names.index(BUILD.VISUALS.GLASS_MATERIAL)]
    glass_pbr = glass.get("pbrMetallicRoughness", {})
    glass_base_color = glass_pbr.get("baseColorFactor", [1, 1, 1, 1])
    glass_emissive = glass.get("emissiveFactor", [0, 0, 0])
    require(
        len(glass_base_color) == 4
        and all(
            abs(float(actual) - expected) <= 1e-6
            for actual, expected in zip(glass_base_color, [0.58, 0.40, 0.72, 1.0])
        )
        and len(glass_emissive) == 3
        and all(abs(float(value)) <= 1e-9 for value in glass_emissive),
        "Bounded glass does not retain the reviewed pale non-emissive tint",
    )
    require(
        {
            "baseColorFactorLinear": [round(float(value), 9) for value in glass_base_color],
            "emissiveFactorLinear": [round(float(value), 9) for value in glass_emissive],
            "metallicFactor": glass_pbr.get("metallicFactor", 1),
            "transmissionFactor": glass.get("extensions", {})
            .get("KHR_materials_transmission", {})
            .get("transmissionFactor", 0),
        }
        == {
            key: value
            for key, value in full["inventory"]["materialCheckpoints"]["glass"].items()
            if key != "name"
        },
        "Bounded glass factors differ from the full-detail archive",
    )
    mesh_rows = {}
    total_triangles = 0
    for mesh_name, binding in DELIVERY.runtime_bindings().items():
        node = named[mesh_name][0]
        require(isinstance(node.get("mesh"), int), f"{mesh_name}: bounded mesh is absent")
        primitives = meshes[node["mesh"]].get("primitives", [])
        require(len(primitives) == 1, f"{mesh_name}: bounded primitive count differs")
        primitive = primitives[0]
        require(isinstance(primitive.get("indices"), int), f"{mesh_name}: indices are absent")
        triangles = int(accessors[primitive["indices"]]["count"]) // 3
        expected = full["inventory"]["meshRows"][mesh_name]
        require(triangles == expected["triangles"], f"{mesh_name}: triangle count changed")
        material = material_names[primitive["material"]]
        require(material == binding["material"], f"{mesh_name}: material changed")
        attributes = sorted(primitive.get("attributes", {}))
        require(attributes == expected["attributes"], f"{mesh_name}: attribute channels changed")
        mesh_rows[mesh_name] = {
            **binding,
            "triangles": triangles,
            "attributes": attributes,
        }
        total_triangles += triangles
    require(
        total_triangles == full["inventory"]["totalVisibleTriangles"],
        "Bounded visible triangle count changed",
    )

    views = document.get("bufferViews", [])
    image_view_indices: set[int] = set()
    images = []
    for image in document.get("images", []):
        view_index = image.get("bufferView")
        require(isinstance(view_index, int) and "uri" not in image, "Bounded image is external")
        image_view_indices.add(view_index)
        view = views[view_index]
        start = int(view.get("byteOffset", 0))
        payload = binary[start : start + int(view["byteLength"])]
        require(image.get("mimeType") == "image/webp", "Bounded image is not WebP")
        images.append(
            {
                "name": image.get("name"),
                "mimeType": image["mimeType"],
                "bytes": len(payload),
                "sha256": hashlib.sha256(payload).hexdigest(),
                "dimensions": webp_dimensions(payload),
            }
        )
    require(
        len(images) == 3
        and all(row["dimensions"] == [TEXTURE_LIMIT, TEXTURE_LIMIT] for row in images),
        "Bounded image count or dimensions differ from the 2K policy",
    )
    decoded_meshopt_bytes = 0
    other_buffer_bytes = 0
    for index, view in enumerate(views):
        meshopt = view.get("extensions", {}).get("EXT_meshopt_compression")
        if meshopt:
            decoded_meshopt_bytes += int(meshopt["count"]) * int(meshopt["byteStride"])
        elif index not in image_view_indices:
            other_buffer_bytes += int(view.get("byteLength", 0))
    rgba8 = len(images) * TEXTURE_LIMIT * TEXTURE_LIMIT * 4
    return {
        "assetVersion": document.get("asset", {}).get("version"),
        "generator": document.get("asset", {}).get("generator"),
        "extensionsUsed": sorted(used),
        "extensionsRequired": sorted(required),
        "nodes": len(nodes),
        "meshes": len(meshes),
        "materials": material_names,
        "materialCheckpoints": full["inventory"]["materialCheckpoints"],
        "meshRows": mesh_rows,
        "totalVisibleTriangles": total_triangles,
        "images": images,
        "resourceBudget": {
            "bundleBytes": path.stat().st_size,
            "embeddedImageBytes": sum(row["bytes"] for row in images),
            "meshoptDecodedBufferBytes": decoded_meshopt_bytes,
            "otherBufferBytes": other_buffer_bytes,
            "estimatedRgba8BaseLevelTextureBytes": rgba8,
            "estimatedRgba8MipmappedTextureBytes": math.ceil(rgba8 * 4 / 3),
            "scope": "Arithmetic upload estimates for three 2K RGBA textures; not measured device memory.",
        },
        "metadataStrings": {
            "platform_adapter_json": extras["platform_adapter_json"],
            "collider_json": extras["collider_json"],
        },
        "externalDependencies": [],
    }


def main() -> None:
    full_paths = DELIVERY.paths()
    output = paths()
    full = json.loads(full_paths["mirrorReport"].read_text())
    candidate_sha = full["lineage"]["candidateBlend"]["sha256"]
    full_sha = full["bundle"]["sha256"]
    require(PREPARE.digest(full_paths["candidate"]) == candidate_sha, "Candidate Blend changed")
    require(PREPARE.digest(full_paths["runtimeGlb"]) == full_sha, "Full-detail GLB changed")

    bpy.ops.wm.open_mainfile(filepath=str(full_paths["candidate"]), load_ui=False)
    root = bpy.data.objects.get(BUILD.ROOT_NAME)
    require(root is not None and root.parent is None, "Runtime root is absent")
    DELIVERY.clean_runtime_scene(root)
    textures = resize_source_images()
    output["glb"].parent.mkdir(parents=True, exist_ok=True)
    temporary_directory = Path(
        tempfile.mkdtemp(prefix=f".{BUILD.ASSET}-bounded-", dir=output["glb"].parent)
    )
    uncompressed = temporary_directory / "webp.glb"
    compressed = temporary_directory / "meshopt.glb"
    try:
        export_webp(root, uncompressed)
        compress_meshopt(uncompressed, compressed)
        os.replace(compressed, output["glb"])
    finally:
        shutil.rmtree(temporary_directory, ignore_errors=True)

    bounded_inventory = inventory(output["glb"], full)
    report = {
        "schema": 1,
        "assetId": DELIVERY.RUNTIME_ID,
        "status": "bounded-runtime-candidate pending matched real-renderer comparison",
        "scope": (
            "The full-resolution candidate and dense source remain immutable. This derivative retains "
            "every visible triangle, role, material assignment, and attribute channel while applying "
            "a separately reviewed 2K WebP texture policy and Meshopt quantization/compression."
        ),
        "bundle": {
            **PREPARE.file_record(output["glb"]),
            "logicalId": DELIVERY.RUNTIME_ID,
            "rootNode": BUILD.ROOT_NAME,
            "deliveryClass": "bounded-playable-candidate",
            "externalDependencies": [],
        },
        "sourceCheckpoints": {
            "candidateBlend": full["lineage"]["candidateBlend"],
            "fullDetailGlb": full["bundle"],
            "sourceFilesUnchanged": True,
        },
        "coordinates": full["coordinates"],
        "support": full["support"],
        "roles": full["roles"],
        "materialBindings": full["materialBindings"],
        "geometry": {
            "triangles": bounded_inventory["totalVisibleTriangles"],
            "decimated": False,
            "remeshed": False,
            "semanticNodesUnchanged": True,
            "materialAssignmentsUnchanged": True,
            "attributeChannelsUnchanged": True,
            "meshopt": {
                "level": "high",
                "quantizationVolume": "mesh",
                "positionBits": POSITION_BITS,
                "normalBits": NORMAL_BITS,
                "texcoordBits": TEXCOORD_BITS,
                "note": (
                    "Meshopt may reorder and quantize encoded vertex attributes; it does not simplify "
                    "or remove triangles. The exact source and full-detail GLB remain archived."
                ),
            },
        },
        "textures": {
            "policy": {
                "maximum": TEXTURE_LIMIT,
                "format": "WebP",
                "quality": WEBP_QUALITY,
            },
            "sourceImages": textures,
            "embeddedImages": bounded_inventory["images"],
            "fullResolutionSourceUnchanged": True,
        },
        "inventory": bounded_inventory,
        "remainingGate": (
            "Render this bundle and the full-detail archive through GLTFLoader, MeshoptDecoder, the "
            "production crackle adapter, and WebGL at matched gameplay and close cameras."
        ),
        "tool": {"blender": bpy.app.version_string, "gltfTransform": "4.4.2"},
    }
    PREPARE.durable_json(output["manifest"], report)
    PREPARE.durable_json(output["sourceReport"], report)
    PREPARE.durable_json(output["mirrorReport"], report)
    require(PREPARE.digest(full_paths["candidate"]) == candidate_sha, "Build mutated candidate")
    require(PREPARE.digest(full_paths["runtimeGlb"]) == full_sha, "Build mutated full-detail GLB")
    print(
        "AMETHYST_RUNTIME_BOUNDED="
        + json.dumps(
            {
                "bundle": report["bundle"],
                "resourceBudget": bounded_inventory["resourceBudget"],
                "status": "candidate-exported",
            },
            separators=(",", ":"),
        )
    )


if __name__ == "__main__":
    main()
