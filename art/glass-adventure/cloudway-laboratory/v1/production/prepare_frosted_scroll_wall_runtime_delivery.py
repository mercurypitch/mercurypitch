#!/usr/bin/env python3
"""Prepare, reopen-audit, and ship the bounded Frosted Scroll Wall runtime."""

from __future__ import annotations

from io import BytesIO
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import shutil
import struct
import sys
import tempfile
from typing import Any, Iterable

import bpy
from PIL import Image, ImageChops, ImageStat


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
    "cloudway_prepare_frost_wall_semantic_candidate",
    HERE / "prepare_frosted_scroll_wall_semantic_candidate.py",
)
STATIC = load_module("cloudway_prepare_static_runtime", HERE / "prepare_static_runtime.py")
PREPARE = BUILD.PREPARE
VISUALS = BUILD.VISUALS
GEOMETRY = BUILD.GEOMETRY
SOURCE = PREPARE.SOURCE
REPO = PREPARE.REPO
BUNDLE_ID = "cloudway-lab-frosted-scroll-wall-v1"
TEXTURE_MAXIMUM = 2048
TEXTURE_QUALITY = 88


def paths() -> dict[str, Path]:
    runtime_dir = SOURCE / "runtime" / BUILD.ASSET
    return {
        **BUILD.paths(),
        "runtimeBlend": SOURCE
        / "blender"
        / BUILD.ASSET
        / f"{BUILD.ASSET}-runtime-v1.blend",
        "runtimeGlb": runtime_dir / f"{BUILD.ASSET}-runtime-v1.glb",
        "runtimeManifest": runtime_dir / "runtime-v1-manifest.json",
        "runtimeProofDir": SOURCE
        / "proofs"
        / "blender"
        / BUILD.ASSET
        / "runtime-v1-2k",
        "sourceReport": SOURCE
        / "production"
        / BUILD.ASSET
        / "runtime-v1-report.json",
        "mirrorReport": HERE / "reports" / f"{BUILD.ASSET}-runtime-v1.json",
        "shippingGlb": REPO
        / "apps"
        / "beside-cue"
        / "public"
        / "games"
        / "cloudway-laboratory-v1"
        / BUILD.ASSET
        / f"{BUILD.ASSET}-runtime-v1.glb",
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


def resize_runtime_images() -> list[dict[str, Any]]:
    expected = (
        (f"{BUILD.ASSET}__base_color", "provider-base-color"),
        (f"{BUILD.ASSET}__normal", "provider-normal"),
        (f"{BUILD.ASSET}__metallic", "provider-metallic"),
        (f"{BUILD.ASSET}__roughness", "provider-roughness"),
        (f"{BUILD.ASSET}__pane_base_color", "pane-base-color"),
        (f"{BUILD.ASSET}__pane_metallic", "pane-metallic"),
    )
    records: list[dict[str, Any]] = []
    for name, role in expected:
        image = bpy.data.images.get(name)
        require(image is not None, f"Packed runtime image {name} is missing")
        before = [int(image.size[0]), int(image.size[1])]
        scale = min(1.0, TEXTURE_MAXIMUM / max(before))
        after = [max(1, round(value * scale)) for value in before]
        if before != after:
            image.scale(*after)
        image.pack()
        records.append(
            {
                "name": name,
                "role": role,
                "sourceDimensions": before,
                "runtimeDimensions": after,
                "packed": image.packed_file is not None,
            }
        )
    return records


def proof_comparison(reference: Path, runtime: Path) -> dict[str, Any]:
    with Image.open(reference).convert("RGB") as first, Image.open(runtime).convert("RGB") as second:
        require(first.size == second.size, f"Proof dimensions differ for {reference.name}")
        difference = ImageChops.difference(first, second)
        stats = ImageStat.Stat(difference)
        pixels = first.size[0] * first.size[1]
        changed = sum(
            1 for pixel in difference.convert("L").get_flattened_data() if pixel > 2
        )
        return {
            "stateView": reference.stem,
            "meanAbsoluteRgb": [round(float(value), 5) for value in stats.mean],
            "rmsRgb": [round(float(value), 5) for value in stats.rms],
            "changedPixelFractionAbove2": round(changed / pixels, 7),
        }


def render_runtime_proofs(resolved: dict[str, Path]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    scene = bpy.context.scene
    camera = bpy.data.objects.get("FrostWall_ProofCamera")
    witness = bpy.data.objects.get("FrostWall_TransmissionWitness")
    frame = tuple(
        bpy.data.objects[name]
        for name in (BUILD.FRAME_VISUAL_NAME, BUILD.FRAME_BACKING_NAME, BUILD.FRAME_TRIM_NAME)
    )
    intact = (bpy.data.objects[BUILD.INTACT_VOLUME_NAME],)
    shards = tuple(
        bpy.data.objects[f"{BUILD.SHARD_PREFIX}{index:03d}"] for index in range(32)
    )
    require(camera is not None and witness is not None, "Candidate proof stage is incomplete")
    rows = VISUALS.render_semantic_proofs(
        scene,
        camera,
        witness,
        resolved["runtimeProofDir"],
        frame=frame,
        intact=intact,
        shards=shards,
    )
    comparisons = [
        proof_comparison(resolved["proofDir"] / Path(row["file"]).name, Path(row["file"]))
        for row in rows
    ]
    return rows, comparisons


def clean_runtime_scene(root: bpy.types.Object) -> None:
    keep = {root, *descendants(root)}
    for obj in list(bpy.data.objects):
        if obj not in keep:
            bpy.data.objects.remove(obj, do_unlink=True)
    for obj in keep:
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.hide_render = False
    for index in range(32):
        shard = bpy.data.objects[f"{BUILD.SHARD_PREFIX}{index:03d}"]
        shard.hide_viewport = True
        shard.hide_render = True
    for name in (
        BUILD.CONTACT_NAME,
        "frost_wall_frame_left",
        "frost_wall_frame_right",
        "frost_wall_frame_top",
    ):
        node = bpy.data.objects[name]
        node.hide_viewport = True
        node.hide_render = True
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.length_unit = "METERS"
    bpy.context.scene.unit_settings.scale_length = 1.0
    for _ in range(3):
        if bpy.ops.outliner.orphans_purge(do_recursive=True) == {"CANCELLED"}:
            break


def mesh_triangle_count(root: bpy.types.Object) -> int:
    total = 0
    for obj in descendants(root):
        if obj.type != "MESH":
            continue
        obj.data.calc_loop_triangles()
        total += len(obj.data.loop_triangles)
    return total


def fresh_blend_audit(root: bpy.types.Object) -> dict[str, Any]:
    require(root.parent is None, "Runtime wall root must remain a scene root")
    require(
        root.location.length <= 1e-9
        and root.rotation_euler.to_matrix().is_identity
        and all(abs(float(value) - 1.0) <= 1e-9 for value in root.scale),
        "Runtime wall root transform is not identity",
    )
    children = {child.name for child in root.children}
    expected_shards = [f"{BUILD.SHARD_PREFIX}{index:03d}" for index in range(32)]
    require(
        children == {BUILD.FRAME_NAME, BUILD.INTACT_NAME, BUILD.CONTACT_NAME, *expected_shards},
        "Runtime wall direct semantic children differ",
    )
    intact = bpy.data.objects.get(BUILD.INTACT_VOLUME_NAME)
    require(intact is not None, "Runtime intact pane volume is missing")
    intact_bounds = BUILD.object_bounds(intact)
    expected_min = [-GEOMETRY.PANE_WIDTH * 0.5, -GEOMETRY.PANE_HALF_DEPTH, 0.0]
    expected_max = [GEOMETRY.PANE_WIDTH * 0.5, GEOMETRY.PANE_HALF_DEPTH, GEOMETRY.PANE_HEIGHT]
    for actual, expected in zip((*intact_bounds[0], *intact_bounds[1]), (*expected_min, *expected_max)):
        require(abs(actual - expected) <= 1e-6, "Intact pane bounds differ after reopen")
    intact_closed = BUILD.mesh_closed_audit(intact)
    shard_rows: list[dict[str, Any]] = []
    for name in expected_shards:
        shard = bpy.data.objects.get(name)
        require(shard is not None and shard.parent is root, f"Runtime shard {name} is misplaced")
        require(shard.data.uv_layers.get("frost_wall_pane_uv") is not None, f"{name} lost pane UVs")
        shard_rows.append({"name": name, **BUILD.mesh_closed_audit(shard)})
    frame = bpy.data.objects.get(BUILD.FRAME_VISUAL_NAME)
    require(frame is not None, "Persistent provider frame is missing")
    frame_bounds = BUILD.object_bounds(frame)
    require(abs(frame_bounds[0][2]) <= 5e-5, "Persistent frame floor differs")
    image_rows = []
    for image in bpy.data.images:
        if image.name == "Render Result":
            continue
        dimensions = [int(image.size[0]), int(image.size[1])]
        require(max(dimensions) <= TEXTURE_MAXIMUM, f"Runtime image {image.name} exceeds 2K")
        require(image.packed_file is not None, f"Runtime image {image.name} is not packed")
        image_rows.append({"name": image.name, "dimensions": dimensions})
    return {
        "root": root.name,
        "directChildren": sorted(children),
        "intactBoundsBlenderZUpMetres": {"min": intact_bounds[0], "max": intact_bounds[1]},
        "intactClosedAudit": intact_closed,
        "shards": shard_rows,
        "frameBoundsBlenderZUpMetres": {"min": frame_bounds[0], "max": frame_bounds[1]},
        "images": sorted(image_rows, key=lambda row: row["name"]),
        "triangles": mesh_triangle_count(root),
    }


def read_glb(path: Path) -> tuple[dict[str, Any], bytes]:
    payload = path.read_bytes()
    require(len(payload) >= 20, "Runtime GLB is incomplete")
    magic, version, length = struct.unpack_from("<4sII", payload, 0)
    require(magic == b"glTF" and version == 2 and length == len(payload), "Invalid GLB header")
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


def write_glb(path: Path, document: dict[str, Any], binary: bytes) -> None:
    json_chunk = json.dumps(document, separators=(",", ":"), ensure_ascii=False).encode(
        "utf-8"
    )
    json_chunk += b" " * (-len(json_chunk) % 4)
    binary_chunk = binary + b"\0" * (-len(binary) % 4)
    length = 12 + 8 + len(json_chunk) + 8 + len(binary_chunk)
    payload = b"".join(
        (
            struct.pack("<4sII", b"glTF", 2, length),
            struct.pack("<I4s", len(json_chunk), b"JSON"),
            json_chunk,
            struct.pack("<I4s", len(binary_chunk), b"BIN\0"),
            binary_chunk,
        )
    )
    require(len(payload) == length, "Rewritten GLB length differs")
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    os.close(descriptor)
    temporary = Path(temporary_name)
    try:
        temporary.write_bytes(payload)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def restore_semantic_metadata_nodes(path: Path) -> list[dict[str, Any]]:
    """Restore inert semantic empties pruned by glTF Transform's meshopt pass."""
    document, binary = read_glb(path)
    nodes = document.get("nodes", [])
    names = [node.get("name", "") for node in nodes]
    definitions = (
        (BUILD.CONTACT_NAME, BUILD.ROOT_NAME),
        ("frost_wall_frame_left", BUILD.FRAME_NAME),
        ("frost_wall_frame_right", BUILD.FRAME_NAME),
        ("frost_wall_frame_top", BUILD.FRAME_NAME),
    )
    records: list[dict[str, Any]] = []
    for name, parent_name in definitions:
        source = bpy.data.objects.get(name)
        require(source is not None, f"Runtime semantic source {name} is missing")
        extras = {key: source[key] for key in source.keys()}
        require(names.count(parent_name) == 1, f"GLB parent {parent_name} is ambiguous")
        if name in names:
            require(names.count(name) == 1, f"GLB semantic node {name} is ambiguous")
            node_index = names.index(name)
            nodes[node_index]["extras"] = extras
            restored = False
        else:
            node_index = len(nodes)
            nodes.append({"name": name, "extras": extras})
            names.append(name)
            restored = True
        parent = nodes[names.index(parent_name)]
        children = parent.setdefault("children", [])
        if node_index not in children:
            children.append(node_index)
        records.append(
            {
                "name": name,
                "parent": parent_name,
                "restoredAfterMeshopt": restored,
                "extras": extras,
            }
        )
    write_glb(path, document, binary)
    return records


def glb_inventory(path: Path, expected_triangles: int) -> dict[str, Any]:
    document, binary = read_glb(path)
    nodes = document.get("nodes", [])
    names = [node.get("name", "") for node in nodes]
    for name in (
        BUILD.ROOT_NAME,
        BUILD.FRAME_NAME,
        BUILD.INTACT_NAME,
        BUILD.CONTACT_NAME,
        "frost_wall_frame_left",
        "frost_wall_frame_right",
        "frost_wall_frame_top",
        *[f"{BUILD.SHARD_PREFIX}{index:03d}" for index in range(32)],
    ):
        require(names.count(name) == 1, f"GLB semantic node {name} is missing or ambiguous")
    require(BUILD.ARCHIVED_PANE_NAME not in names, "Archived provider pane leaked into runtime")
    shard_names = sorted(name for name in names if name.startswith(BUILD.SHARD_PREFIX))
    require(
        shard_names == [f"{BUILD.SHARD_PREFIX}{index:03d}" for index in range(32)],
        "GLB shard node set differs",
    )
    triangles = STATIC.glb_triangle_count(document)
    require(triangles == expected_triangles, "GLB compression changed triangle count")
    required = sorted(document.get("extensionsRequired", []))
    require("EXT_meshopt_compression" in required, "Runtime GLB does not require Meshopt")
    require("EXT_texture_webp" in required, "Runtime GLB does not require WebP textures")
    require(
        not any("uri" in image for image in document.get("images", []))
        and not any("uri" in buffer for buffer in document.get("buffers", [])),
        "Runtime GLB has external dependencies",
    )
    buffer_views = document.get("bufferViews", [])
    image_rows = []
    for image in document.get("images", []):
        view = buffer_views[int(image["bufferView"])]
        start = int(view.get("byteOffset", 0))
        payload = binary[start : start + int(view["byteLength"])]
        with Image.open(BytesIO(payload)) as decoded:
            dimensions = list(decoded.size)
        require(max(dimensions) <= TEXTURE_MAXIMUM, "Embedded runtime texture exceeds 2K")
        image_rows.append(
            {
                "name": image.get("name"),
                "mimeType": image.get("mimeType"),
                "bytes": len(payload),
                "sha256": hashlib.sha256(payload).hexdigest(),
                "dimensions": dimensions,
            }
        )
    material_names = sorted(material.get("name", "") for material in document.get("materials", []))
    expected_materials = sorted(
        (
            "FrostWallFrame__provider_pbr",
            "FrostWallFrameBacking__authored_pbr",
            "FrostWallGlass__cut_edge",
            "FrostWallGlass__surface",
            "FrostWallInnerTrim__authored_pbr",
        )
    )
    require(material_names == expected_materials, "Runtime GLB material roles differ")
    root = nodes[names.index(BUILD.ROOT_NAME)]
    extras = root.get("extras", {})
    require(extras.get("bundleId") == BUNDLE_ID, "Runtime GLB bundle metadata differs")
    semantic_rows = []
    for name, role in (
        (BUILD.CONTACT_NAME, "breakable-pane-collider-metadata"),
        ("frost_wall_frame_left", "persistent-frame-solid-metadata"),
        ("frost_wall_frame_right", "persistent-frame-solid-metadata"),
        ("frost_wall_frame_top", "persistent-frame-solid-metadata"),
    ):
        node_extras = nodes[names.index(name)].get("extras", {})
        require(node_extras.get("role") == role, f"GLB semantic role differs for {name}")
        bounds = json.loads(node_extras.get("bounds_y_up_json", "null"))
        require(
            isinstance(bounds, dict) and set(bounds) == {"min", "max"},
            f"GLB semantic bounds differ for {name}",
        )
        semantic_rows.append({"name": name, "role": role, "boundsYUpMetres": bounds})
    return {
        "assetVersion": document.get("asset", {}).get("version"),
        "generator": document.get("asset", {}).get("generator"),
        "nodes": len(nodes),
        "meshes": len(document.get("meshes", [])),
        "materials": material_names,
        "images": image_rows,
        "textures": len(document.get("textures", [])),
        "triangles": triangles,
        "extensionsUsed": sorted(document.get("extensionsUsed", [])),
        "extensionsRequired": required,
        "resourceBudget": STATIC.glb_resource_budget(document),
        "semanticMetadataNodes": semantic_rows,
        "externalDependencies": [],
    }


def atomic_copy(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{target.name}.", dir=target.parent)
    os.close(descriptor)
    temporary = Path(temporary_name)
    try:
        shutil.copyfile(source, temporary)
        os.replace(temporary, target)
    finally:
        temporary.unlink(missing_ok=True)


def main() -> None:
    resolved = paths()
    semantic = json.loads(resolved["mirrorReport"].with_name(f"{BUILD.ASSET}-semantic-candidate.json").read_text())
    candidate_sha = semantic["candidateBlend"]["sha256"]
    require(PREPARE.digest(resolved["candidate"]) == candidate_sha, "Semantic candidate changed")
    source_hashes = {
        "denseMaster": PREPARE.digest(resolved["baseline"]),
        "surfaceBaseColor": PREPARE.digest(resolved["surfaceBaseColor"]),
        "surfaceMetallic": PREPARE.digest(resolved["surfaceMetallic"]),
    }
    bpy.ops.wm.open_mainfile(filepath=str(resolved["candidate"]), load_ui=False)
    root = bpy.data.objects.get(BUILD.ROOT_NAME)
    require(root is not None, "Semantic wall root is missing")
    texture_rows = resize_runtime_images()
    proof_rows, proof_comparisons = render_runtime_proofs(resolved)
    root["runtimeSchema"] = "cloudway-frosted-scroll-wall-runtime/v1"
    root["bundleId"] = BUNDLE_ID
    root["frontAxis"] = "+Z"
    root["sourceCandidateSha256"] = candidate_sha
    root["texturePolicyJson"] = json.dumps(
        {"maximumDimension": TEXTURE_MAXIMUM, "quality": TEXTURE_QUALITY}, separators=(",", ":")
    )
    clean_runtime_scene(root)
    bpy.ops.file.pack_all()
    resolved["runtimeBlend"].parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(resolved["runtimeBlend"]), check_existing=False)
    runtime_blend_record = PREPARE.file_record(resolved["runtimeBlend"])

    bpy.ops.wm.open_mainfile(filepath=str(resolved["runtimeBlend"]), load_ui=False)
    root = bpy.data.objects.get(BUILD.ROOT_NAME)
    require(root is not None, "Fresh-open runtime root is missing")
    blend_audit = fresh_blend_audit(root)
    for obj in (root, *descendants(root)):
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.hide_render = False
    STATIC.export_runtime(resolved["runtimeGlb"], [root], TEXTURE_QUALITY)
    semantic_metadata = restore_semantic_metadata_nodes(resolved["runtimeGlb"])
    inventory = glb_inventory(resolved["runtimeGlb"], blend_audit["triangles"])
    atomic_copy(resolved["runtimeGlb"], resolved["shippingGlb"])
    runtime_record = PREPARE.file_record(resolved["runtimeGlb"])
    shipping_record = PREPARE.file_record(resolved["shippingGlb"])
    require(runtime_record["sha256"] == shipping_record["sha256"], "Shipping GLB copy differs")
    require(PREPARE.digest(resolved["candidate"]) == candidate_sha, "Candidate mutated during delivery")
    require(
        source_hashes
        == {
            "denseMaster": PREPARE.digest(resolved["baseline"]),
            "surfaceBaseColor": PREPARE.digest(resolved["surfaceBaseColor"]),
            "surfaceMetallic": PREPARE.digest(resolved["surfaceMetallic"]),
        },
        "Archived source hashes changed during delivery",
    )
    base_level_bytes = sum(
        row["runtimeDimensions"][0] * row["runtimeDimensions"][1] * 4
        for row in texture_rows
        if row["role"] not in {"provider-roughness"}
    )
    report = {
        "schema": "cloudway-frosted-scroll-wall-runtime/v1",
        "assetId": BUILD.ASSET,
        "bundleId": BUNDLE_ID,
        "status": "runtime GLB prepared and fresh-open audited; actual Three/WebGL proof pending",
        "coordinates": {
            "upAxis": "+Y",
            "frontAxis": "+Z",
            "units": "metres",
            "root": "centred pane floor",
        },
        "lineage": {
            "semanticCandidate": semantic["candidateBlend"],
            "denseMaster": semantic["source"]["denseMaster"],
            "denseDonor": semantic["source"]["denseDonor"],
            "archivedSourceHashesUnchanged": True,
            "sourceTopologyReduced": False,
            "providerFrameTriangles": semantic["classification"]["frameTriangles"],
            "archivedPaneTrianglesExcluded": semantic["classification"]["archivedPaneTriangles"],
        },
        "runtime": {
            "packedBlend": runtime_blend_record,
            "glb": runtime_record,
            "shippingCopy": shipping_record,
            "rootNode": BUILD.ROOT_NAME,
            "frameNode": BUILD.FRAME_NAME,
            "intactNode": BUILD.INTACT_NAME,
            "shardPrefix": BUILD.SHARD_PREFIX,
            "shardCount": 32,
        },
        "geometry": blend_audit,
        "textures": {
            "policy": {
                "maximumDimension": TEXTURE_MAXIMUM,
                "webpQuality": TEXTURE_QUALITY,
                "choice": "2K preserves the 960px matched proof while bounding Android upload cost",
            },
            "images": texture_rows,
            "estimatedRgba8BaseLevelBytes": base_level_bytes,
            "estimatedRgba8MipmappedBytes": math.ceil(base_level_bytes * 4 / 3),
            "fullResolutionMastersArchived": True,
        },
        "proofs": {
            "runtime": BUILD.logical_records(proof_rows),
            "matchedAgainstFullResolution": proof_comparisons,
            "states": ["intact", "shards", "open"],
            "views": list(VISUALS.VIEWS),
        },
        "glbInventory": inventory,
        "semanticMetadata": semantic_metadata,
        "rebuild": (
            "rtk proxy timeout 1200 env ALSOFT_DRIVERS=null /usr/bin/blender "
            "--background --factory-startup --python-exit-code 1 --python "
            "art/glass-adventure/cloudway-laboratory/v1/production/"
            "prepare_frosted_scroll_wall_runtime_delivery.py"
        ),
    }
    PREPARE.durable_json(resolved["runtimeManifest"], report)
    PREPARE.durable_json(resolved["sourceReport"], report)
    PREPARE.durable_json(resolved["mirrorReport"], report)
    print(
        "FROST_WALL_RUNTIME="
        + json.dumps(
            {
                "glb": runtime_record,
                "shipping": shipping_record,
                "triangles": inventory["triangles"],
                "shards": 32,
                "images": inventory["images"],
            },
            separators=(",", ":"),
        )
    )


if __name__ == "__main__":
    main()
