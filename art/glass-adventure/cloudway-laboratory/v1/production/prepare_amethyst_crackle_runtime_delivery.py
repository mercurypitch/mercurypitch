#!/usr/bin/env python3
"""Export and inventory the source-full-detail Amethyst crackle runtime candidate."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import os
from pathlib import Path
import struct
import sys
from typing import Any, Iterable

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


BUILD = load_module(
    "cloudway_prepare_amethyst_runtime_candidate_delivery",
    HERE / "prepare_amethyst_crackle_runtime_candidate.py",
)
PREPARE = BUILD.PREPARE
VISUALS = BUILD.VISUALS
SOURCE = PREPARE.SOURCE
ASSET = BUILD.ASSET
RUNTIME_ID = "cloudway-lab-amethyst-crackle-v1"


def paths() -> dict[str, Path]:
    runtime_dir = SOURCE / "runtime" / ASSET
    return {
        **BUILD.paths(),
        "audit": HERE / "reports" / f"{ASSET}-runtime-hybrid-audit.json",
        "runtimeGlb": runtime_dir / f"{ASSET}-runtime-v1-full-detail.glb",
        "runtimeManifest": runtime_dir / "full-detail-manifest.json",
        "sourceReport": SOURCE / "production" / ASSET / "runtime-v1-full-detail-report.json",
        "mirrorReport": HERE / "reports" / f"{ASSET}-runtime-v1-full-detail.json",
    }


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def descendants(root: bpy.types.Object) -> list[bpy.types.Object]:
    result: list[bpy.types.Object] = []
    pending = list(root.children)
    while pending:
        current = pending.pop()
        result.append(current)
        pending.extend(current.children)
    return result


def runtime_bindings() -> dict[str, dict[str, str]]:
    result = {
        "AmethystRuntimeCrystalShell": {
            "kind": "glass",
            "material": VISUALS.GLASS_MATERIAL,
        },
        "AmethystRuntimeSourceIntactBody": {
            "kind": "opaque",
            "material": VISUALS.DETAIL_MATERIAL,
        },
        "AmethystRuntimePersistentPerimeter": {
            "kind": "opaque",
            "material": VISUALS.FRAMEWORK_MATERIAL,
        },
        "AmethystRuntimeLuminousAccents": {
            "kind": "opaque",
            "material": VISUALS.ACCENT_MATERIAL,
        },
        "AmethystRuntimeSourceCornerFiligree": {
            "kind": "opaque",
            "material": VISUALS.CORNER_MATERIAL,
        },
    }
    for index in range(18):
        result[f"AmethystRuntimeShardGlass_{index:03d}"] = {
            "kind": "glass",
            "material": VISUALS.GLASS_MATERIAL,
        }
        result[f"AmethystRuntimeShardSurfaceDetail_{index:03d}"] = {
            "kind": "opaque",
            "material": VISUALS.DETAIL_MATERIAL,
        }
    return result


def clean_runtime_scene(root: bpy.types.Object) -> None:
    keep = {root, *descendants(root)}
    for obj in list(bpy.data.objects):
        if obj not in keep:
            bpy.data.objects.remove(obj, do_unlink=True)
    for obj in keep:
        obj.hide_render = False
        obj.hide_viewport = False
        obj.hide_set(False)
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.length_unit = "METERS"
    bpy.context.scene.unit_settings.scale_length = 1.0
    for _ in range(3):
        if bpy.ops.outliner.orphans_purge(do_recursive=True) == {"CANCELLED"}:
            break


def export_glb(root: bpy.types.Object, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.stem}.tmp{path.suffix}")
    temporary.unlink(missing_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for child in descendants(root):
        child.select_set(True)
    bpy.context.view_layer.objects.active = root
    result = bpy.ops.export_scene.gltf(
        filepath=str(temporary),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_animations=False,
        export_materials="EXPORT",
        export_normals=True,
        export_tangents=True,
        export_attributes=False,
        export_image_format="AUTO",
        export_unused_images=False,
    )
    require(result == {"FINISHED"} and temporary.is_file(), "Blender GLB export failed")
    os.replace(temporary, path)


def read_glb(path: Path) -> tuple[dict[str, Any], bytes]:
    payload = path.read_bytes()
    require(len(payload) >= 20, "Runtime GLB is incomplete")
    magic, version, length = struct.unpack_from("<4sII", payload, 0)
    require(
        magic == b"glTF" and version == 2 and length == len(payload),
        "Runtime GLB header differs",
    )
    document: dict[str, Any] | None = None
    binary = b""
    offset = 12
    while offset + 8 <= len(payload):
        chunk_length, chunk_type = struct.unpack_from("<I4s", payload, offset)
        offset += 8
        chunk = payload[offset : offset + chunk_length]
        offset += chunk_length
        if chunk_type == b"JSON":
            document = json.loads(chunk.rstrip(b" \t\r\n\0"))
        elif chunk_type == b"BIN\0":
            binary = chunk
    require(document is not None and binary, "Runtime GLB lacks JSON or BIN data")
    return document, binary


def rounded(values: Iterable[float]) -> list[float]:
    return [round(float(value), 9) for value in values]


def node_transform(node: dict[str, Any]) -> dict[str, list[float]]:
    return {
        "translation": rounded(node.get("translation", [0, 0, 0])),
        "rotation": rounded(node.get("rotation", [0, 0, 0, 1])),
        "scale": rounded(node.get("scale", [1, 1, 1])),
    }


def image_dimensions(payload: bytes) -> list[int] | None:
    if payload.startswith(b"\x89PNG\r\n\x1a\n") and len(payload) >= 24:
        return list(struct.unpack_from(">II", payload, 16))
    if not payload.startswith(b"\xff\xd8"):
        return None
    offset = 2
    while offset + 9 < len(payload):
        if payload[offset] != 0xFF:
            offset += 1
            continue
        marker = payload[offset + 1]
        offset += 2
        if marker in {0xD8, 0xD9}:
            continue
        size = struct.unpack_from(">H", payload, offset)[0]
        if marker in {
            0xC0,
            0xC1,
            0xC2,
            0xC3,
            0xC5,
            0xC6,
            0xC7,
            0xC9,
            0xCA,
            0xCB,
            0xCD,
            0xCE,
            0xCF,
        }:
            height, width = struct.unpack_from(">HH", payload, offset + 3)
            return [width, height]
        offset += size
    return None


def glb_inventory(
    path: Path,
    expected_adapter: dict[str, Any],
    expected_collider: dict[str, Any],
) -> dict[str, Any]:
    document, binary = read_glb(path)
    bindings = runtime_bindings()
    nodes = document.get("nodes", [])
    named: dict[str, list[tuple[int, dict[str, Any]]]] = {}
    for index, node in enumerate(nodes):
        named.setdefault(node.get("name", ""), []).append((index, node))
    expected_nodes = {
        BUILD.ROOT_NAME,
        BUILD.PERSISTENT_NAME,
        BUILD.INTACT_NAME,
        BUILD.CONTACT_NAME,
        *expected_adapter["motion"]["roles"]["shards"],
        *bindings,
    }
    for name in expected_nodes:
        require(len(named.get(name, [])) == 1, f"GLB node {name} is missing or ambiguous")
    prefixed = sorted(name for name in named if name.startswith(BUILD.SHARD_PREFIX))
    require(
        prefixed == expected_adapter["motion"]["roles"]["shards"],
        "GLB shard-prefix nodes are not exactly the semantic roots",
    )
    root_index, root = named[BUILD.ROOT_NAME][0]
    require(
        node_transform(root)
        == {
            "translation": [0.0, 0.0, 0.0],
            "rotation": [0.0, 0.0, 0.0, 1.0],
            "scale": [1.0, 1.0, 1.0],
        },
        "GLB family root is not identity",
    )
    extras = root.get("extras", {})
    require(
        json.loads(extras.get("platform_adapter_json", "null")) == expected_adapter,
        "GLB adapter metadata differs",
    )
    require(
        json.loads(extras.get("collider_json", "null")) == expected_collider,
        "GLB collider metadata differs",
    )
    root_children = {nodes[index].get("name") for index in root.get("children", [])}
    require(
        root_children
        == {
            BUILD.PERSISTENT_NAME,
            BUILD.INTACT_NAME,
            BUILD.CONTACT_NAME,
            *expected_adapter["motion"]["roles"]["shards"],
        },
        "GLB role roots are not exact direct children",
    )

    materials = document.get("materials", [])
    material_names = [material.get("name", "") for material in materials]
    require(
        set(material_names)
        == {
            VISUALS.GLASS_MATERIAL,
            VISUALS.FRAMEWORK_MATERIAL,
            VISUALS.DETAIL_MATERIAL,
            VISUALS.ACCENT_MATERIAL,
            VISUALS.CORNER_MATERIAL,
        },
        "GLB material set differs from reviewed semantic bindings",
    )
    meshes = document.get("meshes", [])
    accessors = document.get("accessors", [])
    mesh_rows: dict[str, Any] = {}
    total_triangles = 0
    for mesh_name, binding in bindings.items():
        node = named[mesh_name][0][1]
        require("mesh" in node, f"{mesh_name} has no GLB mesh")
        primitives = meshes[node["mesh"]].get("primitives", [])
        require(len(primitives) == 1, f"{mesh_name} must export as one primitive")
        primitive = primitives[0]
        require("indices" in primitive and "material" in primitive, f"{mesh_name} is incomplete")
        material = material_names[primitive["material"]]
        require(material == binding["material"], f"{mesh_name} material differs")
        triangles = int(accessors[primitive["indices"]]["count"]) // 3
        total_triangles += triangles
        mesh_rows[mesh_name] = {
            **binding,
            "triangles": triangles,
            "attributes": sorted(primitive.get("attributes", {})),
        }
    contact_node = named[BUILD.CONTACT_NAME][0][1]
    require("mesh" in contact_node, "Contact rectangle did not export")
    contact_primitives = meshes[contact_node["mesh"]].get("primitives", [])
    require(len(contact_primitives) == 1, "Contact rectangle primitive differs")
    contact_triangles = int(accessors[contact_primitives[0]["indices"]]["count"]) // 3
    require(contact_triangles == 2, "Contact rectangle is not two triangles")

    glass_index = material_names.index(VISUALS.GLASS_MATERIAL)
    glass = materials[glass_index]
    glass_pbr = glass.get("pbrMetallicRoughness", {})
    glass_base_color = glass_pbr.get("baseColorFactor", [1, 1, 1, 1])
    glass_emissive = glass.get("emissiveFactor", [0, 0, 0])
    require(
        glass.get("alphaMode", "OPAQUE") == "OPAQUE"
        and glass_pbr.get("metallicFactor", 1) == 0
        and glass.get("extensions", {})
        .get("KHR_materials_transmission", {})
        .get("transmissionFactor", 0)
        > 0,
        "Glass did not export as opaque-surface zero-metal physical transmission",
    )
    require(
        len(glass_base_color) == 4
        and all(
            abs(float(actual) - expected) <= 1e-6
            for actual, expected in zip(glass_base_color, [0.58, 0.40, 0.72, 1.0])
        )
        and len(glass_emissive) == 3
        and all(abs(float(value)) <= 1e-9 for value in glass_emissive),
        "Glass did not export with the reviewed pale non-emissive tint",
    )
    for material in materials:
        if material.get("name") == VISUALS.GLASS_MATERIAL:
            continue
        require(
            material.get("alphaMode", "OPAQUE") == "OPAQUE"
            and "KHR_materials_transmission" not in material.get("extensions", {}),
            f"Opaque semantic material {material.get('name')} became transmissive",
        )

    buffer_views = document.get("bufferViews", [])
    images = []
    for image in document.get("images", []):
        require("bufferView" in image and "uri" not in image, "GLB image is external")
        view = buffer_views[image["bufferView"]]
        start = int(view.get("byteOffset", 0))
        payload = binary[start : start + int(view["byteLength"])]
        images.append(
            {
                "name": image.get("name"),
                "mimeType": image.get("mimeType"),
                "bytes": len(payload),
                "sha256": hashlib.sha256(payload).hexdigest(),
                "dimensions": image_dimensions(payload),
            }
        )
    require(
        not any("uri" in buffer for buffer in document.get("buffers", [])),
        "GLB buffer is external",
    )
    forbidden = [
        name
        for name in document.get("extensionsUsed", [])
        if "draco" in name.lower() or "meshopt" in name.lower()
    ]
    require(not forbidden, f"Full-detail candidate unexpectedly uses {forbidden}")
    return {
        "assetVersion": document.get("asset", {}).get("version"),
        "generator": document.get("asset", {}).get("generator"),
        "sceneRootNode": root_index,
        "nodes": len(nodes),
        "meshes": len(meshes),
        "materials": material_names,
        "materialCheckpoints": {
            "glass": {
                "name": VISUALS.GLASS_MATERIAL,
                "baseColorFactorLinear": [round(float(value), 9) for value in glass_base_color],
                "emissiveFactorLinear": [round(float(value), 9) for value in glass_emissive],
                "metallicFactor": glass_pbr.get("metallicFactor", 1),
                "transmissionFactor": glass.get("extensions", {})
                .get("KHR_materials_transmission", {})
                .get("transmissionFactor", 0),
            }
        },
        "meshRows": mesh_rows,
        "contactTriangles": contact_triangles,
        "totalVisibleTriangles": total_triangles,
        "images": images,
        "textures": len(document.get("textures", [])),
        "extensionsUsed": document.get("extensionsUsed", []),
        "extensionsRequired": document.get("extensionsRequired", []),
        "externalDependencies": [],
        "metadataStrings": {
            "platform_adapter_json": extras["platform_adapter_json"],
            "collider_json": extras["collider_json"],
        },
    }


def main() -> None:
    resolved = paths()
    candidate_report = json.loads(resolved["mirror"].read_text())
    audit = json.loads(resolved["audit"].read_text())
    require(
        PREPARE.digest(resolved["candidate"])
        == candidate_report["candidateBlend"]["sha256"]
        == audit["candidate"]["sha256"],
        "Fresh-open audited candidate lineage differs",
    )
    bpy.ops.wm.open_mainfile(filepath=str(resolved["candidate"]), load_ui=False)
    root = bpy.data.objects.get(BUILD.ROOT_NAME)
    require(root is not None and root.parent is None, "Runtime family root is absent")
    require(
        root.location.length <= 1e-9
        and root.rotation_euler.to_matrix().is_identity
        and all(abs(float(value) - 1) <= 1e-9 for value in root.scale),
        "Runtime family root is not identity",
    )
    expected_adapter = BUILD.platform_metadata()
    expected_collider = {
        "shape": "box",
        "width": BUILD.CONTACT_WIDTH,
        "depth": BUILD.CONTACT_DEPTH,
        "height": BUILD.CONTACT_HEIGHT,
        "topY": 0,
        "center": [0, -BUILD.CONTACT_HEIGHT * 0.5, 0],
    }
    require(
        json.loads(root["platform_adapter_json"]) == expected_adapter
        and json.loads(root["collider_json"]) == expected_collider,
        "Candidate metadata differs before export",
    )
    clean_runtime_scene(root)
    export_glb(root, resolved["runtimeGlb"])
    inventory = glb_inventory(resolved["runtimeGlb"], expected_adapter, expected_collider)
    manifest = {
        "schema": 1,
        "assetId": RUNTIME_ID,
        "status": "source-full-detail runtime candidate; actual Three renderer acceptance pending",
        "bundle": {
            **PREPARE.file_record(resolved["runtimeGlb"]),
            "logicalId": RUNTIME_ID,
            "deliveryClass": "source-full-detail",
            "rootNode": BUILD.ROOT_NAME,
            "decoderPolicy": "plain glTF 2.0 GLB; no Draco or Meshopt decoder",
            "externalDependencies": [],
        },
        "coordinates": expected_adapter["coordinates"],
        "support": {
            "adapter": expected_adapter,
            "collider": expected_collider,
            "uniformScaleOnly": True,
        },
        "roles": expected_adapter["motion"]["roles"],
        "materialBindings": runtime_bindings(),
        "lineage": {
            "candidateBlend": candidate_report["candidateBlend"],
            "freshOpenAudit": PREPARE.file_record(resolved["audit"]),
            "denseMaster": candidate_report["source"]["denseMaster"],
            "sourceExteriorDecimated": False,
            "providerFacePartitionComplete": True,
        },
        "inventory": inventory,
        "remainingGate": (
            "Load with the real GLTFLoader and production crackle adapter, render intact and released "
            "states in WebGL, and compare the intact source finish before catalog registration."
        ),
    }
    PREPARE.durable_json(resolved["runtimeManifest"], manifest)
    PREPARE.durable_json(resolved["sourceReport"], manifest)
    PREPARE.durable_json(resolved["mirrorReport"], manifest)
    print(
        "AMETHYST_RUNTIME_FULL_DETAIL="
        + json.dumps(
            {
                "bundle": manifest["bundle"],
                "triangles": inventory["totalVisibleTriangles"],
                "images": inventory["images"],
                "status": "candidate-exported",
            },
            separators=(",", ":"),
        )
    )


if __name__ == "__main__":
    main()
