#!/usr/bin/env python3
"""Build audited opaque-trim/glass derivatives from immutable Cloudway masters."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import struct
import sys
from typing import Any

import bpy
import numpy as np


HERE = Path(__file__).resolve().parent
KIT = HERE.parent
SOURCE = Path(
    os.environ.get("GLASS_SOURCE_ROOT", str(KIT / "source-assets"))
).expanduser().resolve()


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


STATIC = load_module("cloudway_prepare_static_runtime", HERE / "prepare_static_runtime.py")
DENSE = load_module("cloudway_prepare_dense_master", HERE / "prepare_dense_master.py")

ASSETS: dict[str, dict[str, Any]] = {
    "frost-lily-step": {
        "masterSha256": "23509d843bc518cdc721ed8e1f1ea986fb25b54add5fbeec462fc023b20c585b",
        "donorSha256": "8ac87902a43f9be9e7735726b8504ccce6716eb3086d439d07a1f1dd8d0eb5f4",
        "triangles": 355_472,
        "bundleId": "cloudway-lab-frost-lily-step-v1",
        "rootNode": "CloudwayLab_FrostLilyStep",
        "materials": {
            "opaque": "CloudwayLab_FrostLilyStep__opaque_trim",
            "glass": "CloudwayLab_FrostLilyStep__glass",
        },
        "metallicMedianThreshold": 0.65,
        "cornerSeed": {"absoluteXAtLeast": 0.62, "absoluteYAtLeast": 0.88},
        "rejected": {
            "id": "uv-metallic-only",
            "description": (
                "Provider metallic samples alone omit low-metallic faces within the four "
                "pearl/gold corner cages; the deterministic cardinal corner seed restores "
                "those connected visual fittings without selecting the broad ice field."
            ),
        },
    },
    "aurora-glide-raft": {
        "masterSha256": "e64ae128be996d8b41d5b0215d1788a05eab050b0aa2dec7a7fe4b21052ab607",
        "donorSha256": "f498f437f77eb68975affe6190faae0c78931a890a7563ace6c3946f7adaa17a",
        "triangles": 302_054,
        "bundleId": "cloudway-lab-aurora-glide-raft-v1",
        "rootNode": "CloudwayLab_AuroraGlideRaft",
        "materials": {
            "opaque": "CloudwayLab_AuroraGlideRaft__opaque_trim",
            "glass": "CloudwayLab_AuroraGlideRaft__glass",
        },
        "metallicMedianThreshold": 0.45,
        "cornerSeed": {"absoluteXAtLeast": 0.90, "absoluteYAtLeast": 0.38},
        "rejected": {
            "id": "metallic-median-0.65",
            "description": (
                "A 0.65 median threshold visibly fragments the thin gold top inlay/rim. "
                "The reviewed 0.45 threshold keeps the line continuous while the broad "
                "turquoise body remains in the glass region."
            ),
        },
    },
}

SAMPLES_PER_FACE = 7


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def digest_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def uint_hash(values: np.ndarray) -> str:
    return digest_bytes(np.asarray(values, dtype="<u4").tobytes())


def paths_for(asset: str) -> dict[str, Path]:
    runtime = SOURCE / "runtime" / asset
    return {
        "master": SOURCE / "blender" / asset / f"{asset}-dense-master.blend",
        "working": SOURCE / "blender" / asset / f"{asset}-runtime-v2-working.blend",
        "runtimeV1": runtime / f"{asset}-runtime-v1.glb",
        "runtime": runtime / f"{asset}-runtime-v2.glb",
        "sourceReport": runtime / f"{asset}-runtime-v2.json",
        "mirrorReport": HERE / "reports" / f"{asset}-runtime-v2.json",
        "proofs": SOURCE / "proofs" / "runtime" / asset / "runtime-v2",
    }


def polygon_loop_indices(mesh: bpy.types.Mesh) -> np.ndarray:
    starts = np.empty(len(mesh.polygons), dtype=np.int32)
    totals = np.empty(len(mesh.polygons), dtype=np.int32)
    mesh.polygons.foreach_get("loop_start", starts)
    mesh.polygons.foreach_get("loop_total", totals)
    require(bool(np.all(totals == 3)), "Dense material split requires triangulated faces")
    return starts[:, None] + np.arange(3, dtype=np.int32)[None, :]


def world_corner_arrays(obj: bpy.types.Object) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    mesh = obj.data
    loop_indices = polygon_loop_indices(mesh)
    loop_vertices = np.empty(len(mesh.loops), dtype=np.int32)
    mesh.loops.foreach_get("vertex_index", loop_vertices)
    positions = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
    mesh.vertices.foreach_get("co", positions)
    positions = positions.reshape((-1, 3))
    world = DENSE.world_positions(positions, obj.matrix_world).astype(np.float32)
    corner_positions = world[loop_vertices[loop_indices]]

    uv_layer = mesh.uv_layers.active
    require(uv_layer is not None, "Dense material split requires an active UV layer")
    loop_uvs = np.empty(len(mesh.loops) * 2, dtype=np.float32)
    uv_layer.data.foreach_get("uv", loop_uvs)
    corner_uvs = loop_uvs.reshape((-1, 2))[loop_indices]

    if hasattr(mesh, "calc_normals_split"):
        mesh.calc_normals_split()
    loop_normals = np.empty(len(mesh.corner_normals) * 3, dtype=np.float32)
    mesh.corner_normals.foreach_get("vector", loop_normals)
    loop_normals = loop_normals.reshape((-1, 3))
    unresolved = np.linalg.norm(loop_normals, axis=1) < 0.5
    if np.any(unresolved):
        auto_mesh = mesh.copy()
        custom = auto_mesh.attributes.get("custom_normal")
        if custom is not None:
            auto_mesh.attributes.remove(custom)
        auto_mesh.update()
        automatic = np.empty(len(auto_mesh.corner_normals) * 3, dtype=np.float32)
        auto_mesh.corner_normals.foreach_get("vector", automatic)
        automatic = automatic.reshape((-1, 3))
        require(
            bool(np.all(np.linalg.norm(automatic[unresolved], axis=1) > 0.5)),
            "Could not resolve automatic source corner normals",
        )
        loop_normals[unresolved] = automatic[unresolved]
        bpy.data.meshes.remove(auto_mesh)
    corner_normals = loop_normals[loop_indices]
    return corner_positions, corner_uvs, corner_normals


def corner_fingerprint(
    positions: np.ndarray,
    uvs: np.ndarray,
    normals: np.ndarray,
) -> dict[str, Any]:
    return {
        "triangles": int(len(positions)),
        "worldCornerPositionsFloat32Sha256": digest_bytes(
            np.asarray(positions, dtype="<f4").tobytes()
        ),
        "cornerUvsFloat32Sha256": digest_bytes(np.asarray(uvs, dtype="<f4").tobytes()),
        "cornerNormalsFloat32Sha256": digest_bytes(
            np.asarray(normals, dtype="<f4").tobytes()
        ),
    }


def sample_metallic_medians(
    obj: bpy.types.Object,
) -> tuple[np.ndarray, np.ndarray, tuple[np.ndarray, np.ndarray]]:
    mesh = obj.data
    mesh.calc_loop_triangles()
    require(
        len(mesh.loop_triangles) == len(mesh.polygons)
        and all(triangle.polygon_index == index for index, triangle in enumerate(mesh.loop_triangles)),
        "Dense source must remain one triangle per ordered polygon",
    )
    triangle_loops = np.empty(len(mesh.loop_triangles) * 3, dtype=np.int32)
    mesh.loop_triangles.foreach_get("loops", triangle_loops)
    triangle_loops = triangle_loops.reshape((-1, 3))
    uv_layer = mesh.uv_layers.active
    require(uv_layer is not None, "Dense source has no UV map")
    loop_uvs = np.empty(len(mesh.loops) * 2, dtype=np.float32)
    uv_layer.data.foreach_get("uv", loop_uvs)
    triangle_uvs = loop_uvs.reshape((-1, 2))[triangle_loops]
    centres = triangle_uvs.mean(axis=1)
    sample_uvs = np.concatenate(
        [
            centres[:, None, :],
            triangle_uvs * 0.82 + centres[:, None, :] * 0.18,
            triangle_uvs * 0.55 + centres[:, None, :] * 0.45,
        ],
        axis=1,
    )
    require(sample_uvs.shape[1] == SAMPLES_PER_FACE, "Unexpected UV sample count")

    asset = obj.name.removesuffix("__normalized_review")
    image = bpy.data.images.get(f"{asset}__metallic")
    require(image is not None, f"Missing packed metallic provider map for {asset}")
    width, height = map(int, image.size)
    pixels = np.empty(width * height * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    pixels = pixels.reshape((height, width, 4))
    wrapped = np.mod(sample_uvs, 1.0)
    xs = np.minimum((wrapped[..., 0] * width).astype(np.int32), width - 1)
    ys = np.minimum((wrapped[..., 1] * height).astype(np.int32), height - 1)
    medians = np.median(pixels[ys, xs, 0], axis=1).astype(np.float32)
    del pixels

    positions = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
    mesh.vertices.foreach_get("co", positions)
    positions = positions.reshape((-1, 3))
    world = DENSE.world_positions(positions, obj.matrix_world)
    triangle_vertices = np.empty(len(mesh.loop_triangles) * 3, dtype=np.int32)
    mesh.loop_triangles.foreach_get("vertices", triangle_vertices)
    triangle_vertices = triangle_vertices.reshape((-1, 3))
    world_centres = world[triangle_vertices].mean(axis=1)
    return medians, world_centres, (world.min(axis=0), world.max(axis=0))


def classify_faces(
    asset: str,
    medians: np.ndarray,
    centres: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    config = ASSETS[asset]
    seed = config["cornerSeed"]
    corner = (np.abs(centres[:, 0]) >= float(seed["absoluteXAtLeast"])) & (
        np.abs(centres[:, 1]) >= float(seed["absoluteYAtLeast"])
    )
    accepted = (medians >= float(config["metallicMedianThreshold"])) | corner
    if asset == "frost-lily-step":
        rejected = medians >= float(config["metallicMedianThreshold"])
    else:
        rejected = (medians >= 0.65) | corner
    require(bool(np.any(accepted) and np.any(~accepted)), "Mask must retain both roles")
    return accepted, corner, rejected


def emission_material(name: str, color: tuple[float, float, float]) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeEmission")
    shader.inputs["Color"].default_value = (*color, 1.0)
    shader.inputs["Strength"].default_value = 1.0
    material.node_tree.links.new(shader.outputs["Emission"], output.inputs["Surface"])
    return material


def render_classification_masks(
    asset: str,
    obj: bpy.types.Object,
    accepted: np.ndarray,
    rejected: np.ndarray,
    bounds: tuple[np.ndarray, np.ndarray],
    proof_dir: Path,
    render: bool,
) -> list[dict[str, Any]]:
    targets = [
        ("accepted", "three-quarter"),
        ("accepted", "top"),
        (f"rejected-{ASSETS[asset]['rejected']['id']}", "top"),
    ]
    if not render:
        records: list[dict[str, Any]] = []
        for label, view in targets:
            target = proof_dir / f"classification-{label}-{view}.png"
            require(target.is_file(), f"Missing existing classification proof {target}")
            records.append(
                {
                    "label": label,
                    "view": view,
                    "file": STATIC.logical_path(target),
                    "bytes": target.stat().st_size,
                    "sha256": STATIC.digest(target),
                    "resolution": list(DENSE.RESOLUTION),
                }
            )
        return records
    mesh = obj.data
    original = STATIC.provider_material(obj)
    glass = emission_material("MASK__glass", (0.0, 0.52, 0.85))
    trim = emission_material("MASK__opaque_trim", (1.0, 0.12, 0.015))
    mesh.materials.clear()
    mesh.materials.append(glass)
    mesh.materials.append(trim)
    scene = bpy.context.scene
    require(scene.camera is not None, "Packed master has no proof camera")
    records: list[dict[str, Any]] = []
    for label, mask, views in (
        ("accepted", accepted, ("three-quarter", "top")),
        (f"rejected-{ASSETS[asset]['rejected']['id']}", rejected, ("top",)),
    ):
        for polygon, opaque in zip(mesh.polygons, mask, strict=True):
            polygon.material_index = 1 if bool(opaque) else 0
        for view in views:
            DENSE.configure_view(scene.camera, view, bounds)
            target = proof_dir / f"classification-{label}-{view}.png"
            DENSE.render_atomic(scene, target)
            records.append(
                {
                    "label": label,
                    "view": view,
                    "file": STATIC.logical_path(target),
                    "bytes": target.stat().st_size,
                    "sha256": STATIC.digest(target),
                    "resolution": [int(scene.render.resolution_x), int(scene.render.resolution_y)],
                }
            )
    mesh.materials.clear()
    mesh.materials.append(original)
    for polygon in mesh.polygons:
        polygon.material_index = 0
    for material in (glass, trim):
        bpy.data.materials.remove(material, do_unlink=True)
    return records


def socket(shader: bpy.types.Node, *names: str) -> bpy.types.NodeSocket:
    for name in names:
        found = shader.inputs.get(name)
        if found is not None:
            return found
    raise ValueError(f"Principled BSDF is missing any of {names}")


def set_unlinked(material: bpy.types.Material, target: bpy.types.NodeSocket, value: float) -> None:
    for link in list(target.links):
        material.node_tree.links.remove(link)
    target.default_value = value


def authored_materials(
    provider: bpy.types.Material,
    config: dict[str, Any],
    target_glass: dict[str, Any],
) -> tuple[bpy.types.Material, bpy.types.Material]:
    opaque = provider.copy()
    opaque.name = config["materials"]["opaque"]
    opaque_shader = STATIC.principled_node(opaque)
    set_unlinked(opaque, socket(opaque_shader, "Transmission Weight", "Transmission"), 0.0)
    set_unlinked(opaque, socket(opaque_shader, "Alpha"), 1.0)
    opaque["cloudwayMaterialRole"] = "opaque"
    opaque["glassTransmissionAuthored"] = False
    opaque["sourceAppearance"] = "provider PBR maps retained"

    glass = provider.copy()
    glass.name = config["materials"]["glass"]
    glass_shader = STATIC.principled_node(glass)
    set_unlinked(glass, socket(glass_shader, "Metallic"), 0.0)
    set_unlinked(glass, socket(glass_shader, "Roughness"), float(target_glass["roughness"]))
    set_unlinked(
        glass,
        socket(glass_shader, "Transmission Weight", "Transmission"),
        float(target_glass["transmission"]),
    )
    set_unlinked(glass, socket(glass_shader, "IOR"), float(target_glass["ior"]))
    set_unlinked(glass, socket(glass_shader, "Alpha"), 1.0)
    glass["cloudwayMaterialRole"] = "glass"
    glass["glassTransmissionAuthored"] = True
    glass["sourceAppearance"] = "provider base-color and normal maps retained"
    glass["authoredThicknessMetres"] = float(target_glass["thickness"])
    return opaque, glass


def assign_material_regions(
    obj: bpy.types.Object,
    opaque_mask: np.ndarray,
    opaque: bpy.types.Material,
    glass: bpy.types.Material,
    source_arrays: tuple[np.ndarray, np.ndarray, np.ndarray],
) -> dict[str, Any]:
    asset = obj.name.removesuffix("__normalized_review")
    mesh = obj.data
    require(len(mesh.polygons) == len(opaque_mask), "Mask and polygon counts differ")
    mesh.materials.clear()
    mesh.materials.append(glass)
    mesh.materials.append(opaque)
    for polygon, is_opaque in zip(mesh.polygons, opaque_mask, strict=True):
        polygon.material_index = 1 if bool(is_opaque) else 0
    rebuilt = corner_fingerprint(*world_corner_arrays(obj))
    original = corner_fingerprint(*source_arrays)
    require(rebuilt == original, "Material assignment changed geometry, UVs, or corner normals")
    opaque_indices = np.flatnonzero(opaque_mask)
    glass_indices = np.flatnonzero(~opaque_mask)
    obj.name = f"{ASSETS[asset]['rootNode']}__authored_detail"
    mesh.name = f"{obj.name}__mesh"
    obj["role"] = "authored-pbr-regions"
    obj["opaqueSourceFaceIndexSha256"] = uint_hash(opaque_indices)
    obj["glassSourceFaceIndexSha256"] = uint_hash(glass_indices)
    role_records = {
        "opaque": {
            "material": opaque.name,
            "triangles": int(len(opaque_indices)),
            "sourceFaceIndexSha256": uint_hash(opaque_indices),
            "minimumSourceFaceIndex": int(opaque_indices.min()),
            "maximumSourceFaceIndex": int(opaque_indices.max()),
        },
        "glass": {
            "material": glass.name,
            "triangles": int(len(glass_indices)),
            "sourceFaceIndexSha256": uint_hash(glass_indices),
            "minimumSourceFaceIndex": int(glass_indices.min()),
            "maximumSourceFaceIndex": int(glass_indices.max()),
        },
    }
    return {
        "sourceFaceCoverageSha256": uint_hash(
            np.arange(len(opaque_mask), dtype=np.uint32)
        ),
        "sourceCornerFingerprint": original,
        "postAssignmentCornerFingerprint": rebuilt,
        "roles": role_records,
        "everySourceTriangleAssignedExactlyOnce": True,
        "surfaceGeometryDuplicated": False,
    }


def clean_orphans() -> None:
    for material in list(bpy.data.materials):
        if material.users == 0:
            bpy.data.materials.remove(material)
    for mesh in list(bpy.data.meshes):
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)


def split_glb_material_primitives(
    path: Path,
    config: dict[str, Any],
) -> dict[str, Any]:
    payload = path.read_bytes()
    require(payload[:4] == b"glTF", "Runtime output is not a GLB")
    version, total = struct.unpack_from("<II", payload, 4)
    require(version == 2 and total == len(payload), "Runtime GLB framing is invalid")
    chunks: list[tuple[int, bytes]] = []
    offset = 12
    while offset < len(payload):
        length, chunk_type = struct.unpack_from("<II", payload, offset)
        start = offset + 8
        end = start + length
        require(end <= len(payload), "Runtime GLB chunk exceeds file length")
        chunks.append((chunk_type, payload[start:end]))
        offset = end
    require(chunks and chunks[0][0] == 0x4E4F534A, "Runtime GLB lacks JSON first")
    document = json.loads(chunks[0][1].decode("utf-8"))
    material_names = [row.get("name") for row in document.get("materials", [])]
    expected_names = set(config["materials"].values())
    candidates: list[tuple[int, dict[str, Any]]] = []
    for mesh_index, mesh in enumerate(document.get("meshes", [])):
        primitive_names = {
            material_names[int(primitive["material"])]
            for primitive in mesh.get("primitives", [])
            if isinstance(primitive.get("material"), int)
        }
        if primitive_names == expected_names:
            candidates.append((mesh_index, mesh))
    require(len(candidates) == 1, "Expected one authored two-material GLB mesh")
    mesh_index, source_mesh = candidates[0]
    primitives = source_mesh.get("primitives", [])
    require(len(primitives) == 2, "Authored GLB mesh needs exactly two primitives")
    source_nodes = [
        (index, node)
        for index, node in enumerate(document.get("nodes", []))
        if node.get("mesh") == mesh_index
    ]
    require(len(source_nodes) == 1, "Authored GLB mesh must have one source node")
    _, source_node = source_nodes[0]
    source_node.pop("mesh")
    child_indices = list(source_node.get("children", []))
    non_json_sha = digest_bytes(b"".join(data for kind, data in chunks[1:]))
    role_rows: list[dict[str, Any]] = []
    for role in ("opaque", "glass"):
        material_name = config["materials"][role]
        matches = [
            primitive
            for primitive in primitives
            if material_names[int(primitive["material"])] == material_name
        ]
        require(len(matches) == 1, f"GLB has no unique {role} primitive")
        runtime_mesh = {
            "name": f"{config['rootNode']}__{role}_detail__mesh",
            "primitives": [matches[0]],
        }
        if role == "opaque":
            document["meshes"][mesh_index] = runtime_mesh
            runtime_mesh_index = mesh_index
        else:
            runtime_mesh_index = len(document["meshes"])
            document["meshes"].append(runtime_mesh)
        runtime_node_index = len(document["nodes"])
        document["nodes"].append(
            {
                "name": f"{config['rootNode']}__{role}_detail",
                "mesh": runtime_mesh_index,
                "extras": {"role": f"authored-{role}-region"},
            }
        )
        child_indices.append(runtime_node_index)
        role_rows.append(
            {
                "role": role,
                "material": material_name,
                "mesh": runtime_mesh_index,
                "node": runtime_node_index,
            }
        )
    source_node["children"] = child_indices
    for material in document.get("materials", []):
        name = material.get("name")
        if name not in expected_names:
            continue
        extras = material.setdefault("extras", {})
        extras["glassTransmissionAuthored"] = name == config["materials"]["glass"]
    encoded = json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode(
        "utf-8"
    )
    encoded += b" " * ((-len(encoded)) % 4)
    rewritten_chunks = [(0x4E4F534A, encoded), *chunks[1:]]
    body = b"".join(
        struct.pack("<II", len(data), chunk_type) + data
        for chunk_type, data in rewritten_chunks
    )
    rewritten = b"glTF" + struct.pack("<II", 2, 12 + len(body)) + body
    temporary = path.with_name(f".{path.name}.primitive-split.tmp")
    try:
        with temporary.open("wb") as handle:
            handle.write(rewritten)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)
    require(
        digest_bytes(b"".join(data for kind, data in rewritten_chunks[1:])) == non_json_sha,
        "Primitive node split changed binary GLB payload",
    )
    return {
        "method": "JSON-only primitive-to-child-node separation",
        "sourcePrimitiveCount": 2,
        "runtimeMeshNodes": 2,
        "binaryPayloadSha256": non_json_sha,
        "binaryPayloadUnchanged": True,
        "roles": role_rows,
    }


def glb_material_audit(
    document: dict[str, Any],
    config: dict[str, Any],
    target_glass: dict[str, Any],
) -> dict[str, Any]:
    materials = {row.get("name"): row for row in document.get("materials", [])}
    require(set(materials) == set(config["materials"].values()), "GLB material set differs")
    opaque = materials[config["materials"]["opaque"]]
    glass = materials[config["materials"]["glass"]]
    require(opaque.get("alphaMode", "OPAQUE") == "OPAQUE", "Opaque trim is not OPAQUE")
    require(glass.get("alphaMode", "OPAQUE") == "OPAQUE", "Glass region is not alpha-opaque")
    opaque_transmission = opaque.get("extensions", {}).get("KHR_materials_transmission")
    require(opaque_transmission is None, "Opaque trim exported physical transmission")
    transmission = glass.get("extensions", {}).get("KHR_materials_transmission", {}).get(
        "transmissionFactor"
    )
    require(
        transmission is not None
        and abs(float(transmission) - float(target_glass["transmission"])) <= 1e-6,
        "Glass transmission differs from authored target",
    )
    ior = glass.get("extensions", {}).get("KHR_materials_ior", {}).get("ior")
    require(
        ior is not None and abs(float(ior) - float(target_glass["ior"])) <= 1e-6,
        "Glass IOR differs from authored target",
    )
    pbr = glass.get("pbrMetallicRoughness", {})
    require(float(pbr.get("metallicFactor", 1.0)) == 0.0, "Glass remained metallic")
    require(
        abs(float(pbr.get("roughnessFactor", 1.0)) - float(target_glass["roughness"]))
        <= 1e-6,
        "Glass roughness differs from authored target",
    )
    return {
        "materialNames": sorted(materials),
        "opaqueTransmissionExtensionAbsent": True,
        "glassTransmission": float(transmission),
        "glassIor": float(ior),
        "glassMetallic": float(pbr.get("metallicFactor", 1.0)),
        "glassRoughness": float(pbr.get("roughnessFactor", 1.0)),
        "alphaMode": "OPAQUE",
    }


def prepare(asset: str, render_proofs: bool) -> dict[str, Any]:
    config = ASSETS[asset]
    paths = paths_for(asset)
    for key in ("working", "runtime", "sourceReport", "mirrorReport", "proofs"):
        paths[key].parent.mkdir(parents=True, exist_ok=True)
    require(paths["master"].is_file(), f"Missing immutable master {paths['master']}")
    require(STATIC.digest(paths["master"]) == config["masterSha256"], "Master hash changed")
    require(paths["runtimeV1"].is_file(), f"Missing accepted runtime v1 {paths['runtimeV1']}")

    catalogue = STATIC.load_catalogue()
    catalogue_config = STATIC.asset_config(catalogue, asset)
    require(catalogue_config["rootNode"] == config["rootNode"], "Root name changed")
    require(catalogue_config["bundleId"] == config["bundleId"], "Bundle ID changed")
    target_glass = dict(catalogue_config["material"]["targetGlass"])

    bpy.ops.wm.open_mainfile(filepath=str(paths["master"]), load_ui=False)
    bpy.context.preferences.filepaths.save_version = 0
    review = bpy.data.objects.get(f"{asset}__normalized_review")
    require(review is not None and review.type == "MESH", "Missing normalized dense review")
    geometry = STATIC.geometry_record(review)
    require(geometry["triangles"] == config["triangles"], "Master triangle count changed")
    require(
        review.get("sourceSha256") == config["donorSha256"],
        "Normalized review donor lineage changed",
    )
    contact_audit = STATIC.certify_contact(review, catalogue_config["contact"])
    source_arrays = world_corner_arrays(review)
    medians, centres, bounds = sample_metallic_medians(review)
    accepted, corner, rejected = classify_faces(asset, medians, centres)
    proof_records = render_classification_masks(
        asset, review, accepted, rejected, bounds, paths["proofs"], render_proofs
    )

    provider = STATIC.provider_material(review)
    opaque, glass = authored_materials(provider, config, target_glass)
    split_audit = assign_material_regions(review, accepted, opaque, glass, source_arrays)

    root = bpy.data.objects.new(config["rootNode"], None)
    bpy.context.scene.collection.objects.link(root)
    root.location = (0.0, 0.0, 0.0)
    root.rotation_euler = (0.0, 0.0, 0.0)
    root.scale = (1.0, 1.0, 1.0)
    review.parent = root
    review.hide_render = False
    review.hide_set(False)
    STATIC.keep_runtime_object(review, root)
    clean_orphans()

    texture_records = STATIC.resize_images(asset, dict(catalogue_config["textures"]))
    material_metadata = {
        "kind": "authored-pbr-regions",
        "appearanceStatus": "authored-regions",
        "intendedAppearance": "glass-and-trim",
        "roles": {
            "opaque": [config["materials"]["opaque"]],
            "glass": [config["materials"]["glass"]],
        },
        "targetGlass": target_glass,
    }
    metadata = {
        "schema": "cloudway-lab-static-v1",
        "assetId": asset,
        "kind": catalogue_config["kind"],
        "coordinates": {
            "upAxis": "+Y",
            "units": "metres",
            "origin": "landing-or-resting-datum",
        },
        "contact": catalogue_config["contact"],
        "material": material_metadata,
        "source": {
            "denseMaster": STATIC.logical_path(paths["master"]),
            "denseMasterSha256": config["masterSha256"],
            "donorSha256": config["donorSha256"],
        },
        "geometry": geometry,
        "textures": texture_records,
    }
    root[catalogue["metadataKey"]] = json.dumps(metadata, separators=(",", ":"))
    contact = catalogue_config["contact"]
    root["collider_json"] = json.dumps(
        {
            "shape": "box",
            "width": contact["width"],
            "depth": contact["depth"],
            "height": contact["height"],
            "topY": contact["topY"],
            "center": [0, -contact["height"] / 2, 0],
        },
        separators=(",", ":"),
    )

    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(paths["working"]), check_existing=False)
    STATIC.export_runtime(
        paths["runtime"], [root], int(catalogue_config["textures"]["quality"])
    )
    primitive_node_split = split_glb_material_primitives(paths["runtime"], config)
    document = STATIC.glb_json(paths["runtime"])
    required_extensions = sorted(document.get("extensionsRequired", []))
    require("EXT_meshopt_compression" in required_extensions, "Runtime GLB lacks meshopt")
    require(
        STATIC.glb_triangle_count(document) == config["triangles"],
        "Runtime GLB changed triangle count",
    )
    glb_materials = glb_material_audit(document, config, target_glass)
    require(STATIC.digest(paths["master"]) == config["masterSha256"], "Master was modified")

    texture_by_role = {row["role"]: row for row in texture_records}
    base_texture_bytes = sum(
        int(texture_by_role[role]["runtimeDimensions"][0])
        * int(texture_by_role[role]["runtimeDimensions"][1])
        * 4
        for role in ("base_color", "normal", "metallic")
    )
    report = {
        "schema": 2,
        "assetId": asset,
        "status": "runtime material-region derivative prepared; fresh reopen audit pending",
        "scope": (
            "Dense source triangles, UVs, and corner normals are preserved across an exact "
            "face partition. The immutable master and full provider maps remain unchanged."
        ),
        "source": metadata["source"],
        "lineage": {
            "runtimeV1": {
                "file": STATIC.logical_path(paths["runtimeV1"]),
                "sha256": STATIC.digest(paths["runtimeV1"]),
            },
            "packedWorkingBlend": {
                "file": STATIC.logical_path(paths["working"]),
                "bytes": paths["working"].stat().st_size,
                "sha256": STATIC.digest(paths["working"]),
            },
            "bundleIdPreserved": config["bundleId"],
            "rootNodePreserved": config["rootNode"],
        },
        "runtime": {
            "file": STATIC.logical_path(paths["runtime"]),
            "bytes": paths["runtime"].stat().st_size,
            "sha256": STATIC.digest(paths["runtime"]),
            "bundleId": config["bundleId"],
            "rootNode": config["rootNode"],
            "requiredExtensions": required_extensions,
            "materials": glb_materials,
            "primitiveNodeSplit": primitive_node_split,
            "resourceBudget": {
                **STATIC.glb_resource_budget(document),
                "estimatedRgba8BaseLevelTextureBytes": base_texture_bytes,
                "estimatedRgba8MipmappedTextureBytes": int(np.ceil(base_texture_bytes * 4 / 3)),
            },
        },
        "material": material_metadata,
        "classification": {
            "method": (
                "Median of seven deterministic provider-metallic samples per existing UV "
                "triangle (centroid plus 18% and 45% inset samples toward each corner), "
                "combined with an authored cardinal-corner spatial seed."
            ),
            "samplesPerFace": SAMPLES_PER_FACE,
            "metallicMedianThreshold": config["metallicMedianThreshold"],
            "cornerSeed": config["cornerSeed"],
            "cornerSeedTriangles": int(np.count_nonzero(corner)),
            "opaqueTriangles": int(np.count_nonzero(accepted)),
            "glassTriangles": int(np.count_nonzero(~accepted)),
            "opaqueSourceFaceIndexSha256": uint_hash(np.flatnonzero(accepted)),
            "glassSourceFaceIndexSha256": uint_hash(np.flatnonzero(~accepted)),
            "rejectedCandidate": config["rejected"],
            "proofs": proof_records,
        },
        "geometry": {**geometry, "partitionAudit": split_audit},
        "textures": {
            "policy": catalogue_config["textures"],
            "images": texture_records,
            "sourceMapsUnchanged": True,
        },
        "contact": {"declaration": contact, "audit": contact_audit},
        "rebuild": (
            "timeout 1200 flock -w 1200 "
            '"${GLASS_BLENDER_LOCK:-/tmp/glass-cloudway-blender.lock}" '
            'env ALSOFT_DRIVERS=null "${BLENDER_BIN:-blender}" '
            "--background --factory-startup "
            "--python-exit-code 1 --python "
            "art/glass-adventure/cloudway-laboratory/v1/production/"
            f"prepare_static_material_split_runtime.py -- --asset {asset}"
        ),
    }
    STATIC.durable_json(paths["sourceReport"], report)
    STATIC.durable_json(paths["mirrorReport"], report)
    print("RUNTIME_V2_REPORT=" + json.dumps(report, separators=(",", ":")))
    return report


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", required=True, choices=sorted(ASSETS))
    parser.add_argument("--skip-proofs", action="store_true")
    arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(arguments)


if __name__ == "__main__":
    options = arguments()
    prepare(options.asset, not options.skip_proofs)
