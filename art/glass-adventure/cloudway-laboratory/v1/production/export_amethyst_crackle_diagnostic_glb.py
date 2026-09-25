#!/usr/bin/env python3
"""Export a temporary bounded-map GLB for early Three material review."""

from __future__ import annotations

import bpy
import hashlib
import json
import os
from pathlib import Path
import struct
from typing import Any


ASSET = "amethyst-crackle-slow"
ROOT_NAME = "CloudwayLab_AmethystCrackleSlow"
OUTPUT = Path("/tmp/cloudway-amethyst-diagnostic/amethyst-crackle-slow-diagnostic.glb")
REPORT = Path("/tmp/cloudway-amethyst-diagnostic/export-report.json")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def descendants(root: bpy.types.Object) -> list[bpy.types.Object]:
    pending = list(root.children)
    result: list[bpy.types.Object] = []
    while pending:
        child = pending.pop()
        result.append(child)
        pending.extend(child.children)
    return result


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def read_document(path: Path) -> dict[str, Any]:
    payload = path.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", payload, 0)
    require(magic == b"glTF" and version == 2 and length == len(payload), "Invalid GLB header")
    offset = 12
    while offset + 8 <= len(payload):
        chunk_length, chunk_type = struct.unpack_from("<I4s", payload, offset)
        offset += 8
        chunk = payload[offset : offset + chunk_length]
        offset += chunk_length
        if chunk_type == b"JSON":
            return json.loads(chunk.rstrip(b" \t\r\n\0"))
    raise ValueError("GLB JSON chunk missing")


def main() -> None:
    root = bpy.data.objects.get(ROOT_NAME)
    require(root is not None, "Amethyst candidate root missing")
    image_sizes: dict[str, list[int]] = {}
    for role, target in {
        "base_color": 1024,
        "normal": 512,
        "metallic": 512,
        "roughness": 512,
    }.items():
        image = bpy.data.images.get(f"{ASSET}__{role}")
        require(image is not None, f"Packed {role} image missing")
        image.scale(target, target)
        image_sizes[image.name] = [int(image.size[0]), int(image.size[1])]

    keep = {root, *descendants(root)}
    bpy.ops.object.select_all(action="DESELECT")
    for obj in keep:
        obj.hide_viewport = False
        obj.hide_render = False
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    temporary = OUTPUT.with_name(f".{OUTPUT.stem}.tmp{OUTPUT.suffix}")
    temporary.unlink(missing_ok=True)
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
    )
    require(result == {"FINISHED"} and temporary.is_file(), "Diagnostic GLB export failed")
    os.replace(temporary, OUTPUT)
    document = read_document(OUTPUT)
    materials = document.get("materials", [])
    material_records = [
        {
            "name": material.get("name"),
            "alphaMode": material.get("alphaMode", "OPAQUE"),
            "extensions": sorted(material.get("extensions", {}).keys()),
            "metallicFactor": material.get("pbrMetallicRoughness", {}).get("metallicFactor", 1),
        }
        for material in materials
    ]
    required_transmission = {"CloudwayLab_Amethyst__glass"}
    transmissive = {
        material["name"]
        for material in material_records
        if "KHR_materials_transmission" in material["extensions"]
    }
    require(required_transmission <= transmissive, "Amethyst transmission extension was not exported")
    glass_record = next(item for item in material_records if item["name"] == "CloudwayLab_Amethyst__glass")
    require(glass_record["metallicFactor"] == 0, "Primary glass exported with nonzero metalness")
    detail_record = next(
        item for item in material_records if item["name"] == "CloudwayLab_Amethyst__internal_detail"
    )
    require(
        "KHR_materials_transmission" not in detail_record["extensions"],
        "Exact provider intact body unexpectedly exported transmission",
    )
    report = {
        "schema": "cloudway-amethyst-early-gltf-material-proof/v1",
        "status": "diagnostic only; not a delivery asset",
        "glb": {"file": str(OUTPUT), "bytes": OUTPUT.stat().st_size, "sha256": digest(OUTPUT)},
        "temporaryTextureSizes": image_sizes,
        "extensionsUsed": sorted(document.get("extensionsUsed", [])),
        "materials": material_records,
        "nodes": len(document.get("nodes", [])),
        "meshes": len(document.get("meshes", [])),
        "scope": "Early actual-GLTFLoader material review. Source Blend and packed full-resolution maps remain unchanged.",
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print("AMETHYST_DIAGNOSTIC_GLB=" + json.dumps(report, separators=(",", ":")))


if __name__ == "__main__":
    main()
