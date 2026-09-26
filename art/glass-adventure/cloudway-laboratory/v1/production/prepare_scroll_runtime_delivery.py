#!/usr/bin/env python3
"""Build the certified gilt-scroll runtime Blend, GLB, and delivery manifest."""

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
from mathutils import Matrix, Vector
import numpy as np


HERE = Path(__file__).resolve().parent


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load {path.name}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


CANDIDATE = load_module(
    "cloudway_scroll_transmissive_candidate",
    HERE / "prepare_scroll_transmissive_candidate.py",
)
PREPARE = CANDIDATE.PREPARE
SEMANTIC = CANDIDATE.SEMANTIC
SOURCE = PREPARE.SOURCE
ASSET = CANDIDATE.ASSET
RUNTIME_ID = "gilt-scroll-bridge-runtime-v1"
ROOT_NAME = "Cloudway_GiltScrollBridge_RuntimeV1"
ACCEPTED_CANDIDATE_SHA256 = (
    "34e919c1bfe1da286c525fc6c413463abbb9702ecfe537553baf50abad3a669b"
)
SUPPORT_EDGE_METRES = 0.378747028
SUPPORT_WIDTH_METRES = SUPPORT_EDGE_METRES * 2.0
COLLIDER_HEIGHT_METRES = 0.100
MIN_LENGTH_RATIO = 0.25
RUNTIME_MATERIALS = {
    "deckGlass": "CloudwayScroll_DeckGlass_v1",
    "goldDetail": "CloudwayScroll_GoldDetail_v1",
    "frostEtch": "CloudwayScroll_FrostEtch_v1",
    "rollerPbr": "CloudwayScroll_RollerIvoryGoldPBR_v1",
}
MESH_BINDING_KINDS = {
    CANDIDATE.DECK_OBJECT: "glass",
    CANDIDATE.GOLD_DETAIL_OBJECT: "opaque",
    CANDIDATE.ETCH_DETAIL_OBJECT: "glass",
    CANDIDATE.ROLLER_OBJECTS[0]: "opaque",
    CANDIDATE.ROLLER_OBJECTS[1]: "opaque",
}


def paths() -> dict[str, Path]:
    asset_dir = SOURCE / "blender" / ASSET
    runtime_dir = SOURCE / "runtime" / ASSET
    report_dir = SOURCE / "production" / ASSET
    return {
        "candidate": asset_dir / f"{ASSET}-transmissive-deck-candidate.blend",
        "candidateReport": (
            HERE / "reports" / f"{ASSET}-scroll-transmissive-deck-candidate.json"
        ),
        "semantic": asset_dir / f"{ASSET}-semantic-derivative.blend",
        "runtimeBlend": asset_dir / f"{ASSET}-runtime-v1.blend",
        "runtimeGlb": runtime_dir / f"{ASSET}-runtime-v1-full-detail.glb",
        "runtimeManifest": runtime_dir / "full-detail-manifest.json",
        "report": report_dir / "scroll-runtime-v1-full-detail-report.json",
        "mirror": HERE / "reports" / f"{ASSET}-runtime-v1-full-detail.json",
    }


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def descendants(root: bpy.types.Object) -> list[bpy.types.Object]:
    result: list[bpy.types.Object] = []

    def visit(parent: bpy.types.Object) -> None:
        for child in parent.children:
            result.append(child)
            visit(child)

    visit(root)
    return result


def rounded_vector(values: Iterable[float]) -> list[float]:
    return [round(float(value), 9) for value in values]


def matrix_record(matrix: Matrix) -> list[list[float]]:
    return [rounded_vector(row) for row in matrix]


def world_bounds(obj: bpy.types.Object) -> dict[str, list[float]]:
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return {
        "min": rounded_vector(min(point[index] for point in points) for index in range(3)),
        "max": rounded_vector(max(point[index] for point in points) for index in range(3)),
    }


def bounds_max_delta(
    before: dict[str, list[float]], after: dict[str, list[float]]
) -> float:
    return max(
        abs(before[side][axis] - after[side][axis])
        for side in ("min", "max")
        for axis in range(3)
    )


def flat_top_bounds(obj: bpy.types.Object) -> dict[str, Any]:
    mesh = obj.data
    mesh.calc_loop_triangles()
    points: list[Vector] = []
    triangles = 0
    for triangle in mesh.loop_triangles:
        corners = [obj.matrix_world @ mesh.vertices[index].co for index in triangle.vertices]
        normal = (corners[1] - corners[0]).cross(corners[2] - corners[0]).normalized()
        if normal.z > 0.999999 and max(abs(corner.z) for corner in corners) <= 1e-7:
            triangles += 1
            points.extend(corners)
    require(triangles > 0, "Runtime deck has no flat top triangles")
    minimum = [min(point[index] for point in points) for index in range(3)]
    maximum = [max(point[index] for point in points) for index in range(3)]
    return {
        "triangles": triangles,
        "min": rounded_vector(minimum),
        "max": rounded_vector(maximum),
        "dimensions": rounded_vector(
            maximum[index] - minimum[index] for index in range(3)
        ),
        "centre": rounded_vector(
            (maximum[index] + minimum[index]) * 0.5 for index in range(3)
        ),
    }


def geometry_fingerprint(obj: bpy.types.Object) -> dict[str, Any]:
    mesh = obj.data
    record = CANDIDATE.authored_mesh_fingerprint(mesh)
    normals = np.empty(len(mesh.corner_normals) * 3, dtype=np.float32)
    mesh.corner_normals.foreach_get("vector", normals)
    uv_layers: dict[str, str] = {}
    for layer in sorted(mesh.uv_layers, key=lambda item: item.name):
        values = np.empty(len(layer.data) * 2, dtype=np.float32)
        layer.data.foreach_get("uv", values)
        uv_layers[layer.name] = hashlib.sha256(values.tobytes()).hexdigest()
    record.update(
        {
            "loops": len(mesh.loops),
            "cornerNormalsFloat32Sha256": hashlib.sha256(
                normals.tobytes()
            ).hexdigest(),
            "uvLayersFloat32Sha256": uv_layers,
        }
    )
    if obj.name in CANDIDATE.ROLLER_OBJECTS:
        record["sourcePreservationFingerprint"] = CANDIDATE.mesh_fingerprint(mesh)
    return record


def material_principled(material: bpy.types.Material) -> bpy.types.Node:
    require(material.use_nodes and material.node_tree is not None, f"{material.name}: nodes absent")
    candidates = [
        node
        for node in material.node_tree.nodes
        if node.bl_idname == "ShaderNodeBsdfPrincipled"
    ]
    require(len(candidates) == 1, f"{material.name}: expected one Principled shader")
    return candidates[0]


def set_socket(shader: bpy.types.Node, name: str, value: Any) -> None:
    socket = shader.inputs.get(name)
    require(socket is not None, f"{shader.name}: missing {name}")
    socket.default_value = value


def consolidate_runtime_materials() -> dict[str, dict[str, Any]]:
    provider = bpy.data.materials.get(CANDIDATE.PROVIDER_MATERIAL)
    glass = bpy.data.materials.get(CANDIDATE.GLASS_MATERIAL)
    gold = bpy.data.materials.get(CANDIDATE.GOLD_DETAIL_MATERIAL)
    etch = bpy.data.materials.get(CANDIDATE.ETCH_DETAIL_MATERIAL)
    require(all(material is not None for material in (provider, glass, gold, etch)), "Candidate materials are incomplete")

    provider.name = RUNTIME_MATERIALS["rollerPbr"]
    glass.name = RUNTIME_MATERIALS["deckGlass"]
    gold.name = RUNTIME_MATERIALS["goldDetail"]
    etch.name = RUNTIME_MATERIALS["frostEtch"]

    glass_shader = material_principled(glass)
    set_socket(glass_shader, "Metallic", 0.0)
    set_socket(glass_shader, "Transmission Weight", 0.985)
    set_socket(glass_shader, "IOR", 1.46)
    set_socket(glass_shader, "Roughness", 0.075)

    gold_shader = material_principled(gold)
    set_socket(gold_shader, "Transmission Weight", 0.0)
    set_socket(gold_shader, "Alpha", 1.0)

    etch_shader = material_principled(etch)
    set_socket(etch_shader, "Metallic", 0.0)
    set_socket(etch_shader, "Transmission Weight", 0.36)
    set_socket(etch_shader, "IOR", 1.43)
    set_socket(etch_shader, "Roughness", 0.31)

    for name in CANDIDATE.ROLLER_OBJECTS:
        roller = bpy.data.objects.get(name)
        require(roller is not None and roller.type == "MESH", f"{name}: roller mesh absent")
        for polygon in roller.data.polygons:
            polygon.material_index = 0
        roller.data.materials.clear()
        roller.data.materials.append(provider)

    bindings = {
        CANDIDATE.DECK_OBJECT: glass,
        CANDIDATE.GOLD_DETAIL_OBJECT: gold,
        CANDIDATE.ETCH_DETAIL_OBJECT: etch,
        CANDIDATE.ROLLER_OBJECTS[0]: provider,
        CANDIDATE.ROLLER_OBJECTS[1]: provider,
    }
    rows: dict[str, dict[str, Any]] = {}
    for mesh_name, material in bindings.items():
        obj = bpy.data.objects.get(mesh_name)
        require(obj is not None and obj.type == "MESH", f"{mesh_name}: binding mesh absent")
        require(len(obj.data.materials) == 1 and obj.data.materials[0] == material, f"{mesh_name}: material binding differs")
        shader = material_principled(material)
        transmission = float(shader.inputs["Transmission Weight"].default_value)
        metalness = float(shader.inputs["Metallic"].default_value)
        kind = MESH_BINDING_KINDS[mesh_name]
        if kind == "glass":
            require(transmission > 0.0 and abs(metalness) <= 1e-8, f"{mesh_name}: glass policy differs")
        else:
            require(abs(transmission) <= 1e-8, f"{mesh_name}: opaque policy differs")
        rows[mesh_name] = {
            "kind": kind,
            "material": material.name,
            "principled": {
                "metalness": round(metalness, 9),
                "roughness": round(float(shader.inputs["Roughness"].default_value), 9),
                "transmission": round(transmission, 9),
                "ior": round(float(shader.inputs["IOR"].default_value), 9),
            },
        }
    return rows


def anchor_roller_role(role_name: str, x: float) -> dict[str, Any]:
    role = bpy.data.objects.get(role_name)
    require(role is not None and role.type == "EMPTY", f"{role_name}: role root absent")
    children = descendants(role)
    require(children, f"{role_name}: role has no descendants")
    before_matrices = {child.name: child.matrix_world.copy() for child in children}
    before_bounds = {
        child.name: world_bounds(child) for child in children if child.type == "MESH"
    }
    role.location = (x, 0.0, 0.0)
    role.rotation_euler = (0.0, 0.0, 0.0)
    role.scale = (1.0, 1.0, 1.0)
    bpy.context.view_layer.update()
    for child in children:
        child.matrix_world = before_matrices[child.name]
    bpy.context.view_layer.update()
    after_bounds = {
        child.name: world_bounds(child) for child in children if child.type == "MESH"
    }
    maximum_delta = max(
        bounds_max_delta(before_bounds[name], after_bounds[name]) for name in before_bounds
    )
    require(
        maximum_delta <= 1e-6,
        f"{role_name}: anchoring moved visible geometry by {maximum_delta:.12g} m",
    )
    return {
        "role": role_name,
        "anchorBlenderZUp": rounded_vector(role.location),
        "visibleWorldBoundsBefore": before_bounds,
        "visibleWorldBoundsAfter": after_bounds,
        "visibleBoundsMaxDeltaMetres": round(maximum_delta, 12),
        "childMatricesAfter": {
            child.name: matrix_record(child.matrix_local) for child in children
        },
    }


def recenter_deck_support() -> dict[str, Any]:
    deck = bpy.data.objects.get(CANDIDATE.DECK_OBJECT)
    require(deck is not None and deck.type == "MESH", "Runtime deck mesh absent")
    top_before = flat_top_bounds(deck)
    shift = -float(top_before["centre"][1])
    deck_root = bpy.data.objects.get(SEMANTIC.ROLE_ROOTS["deck"])
    require(deck_root is not None, "Deck role root absent")
    moved: dict[str, list[float]] = {}
    for obj in (deck, bpy.data.objects.get(CANDIDATE.GOLD_DETAIL_OBJECT), bpy.data.objects.get(CANDIDATE.ETCH_DETAIL_OBJECT)):
        require(obj is not None and obj.parent == deck_root, "Deck runtime child hierarchy differs")
        obj.location.y += shift
        moved[obj.name] = rounded_vector(obj.location)
    bpy.context.view_layer.update()
    top_after = flat_top_bounds(deck)
    require(abs(top_after["centre"][0]) <= 1e-7 and abs(top_after["centre"][1]) <= 1e-7, "Flat support top is not centred")
    require(abs(top_after["max"][2]) <= 1e-7, "Flat support top is not at Z=0")
    return {
        "shiftAlongBlenderYMetres": round(shift, 12),
        "flatTopBefore": top_before,
        "flatTopAfter": top_after,
        "movedObjectLocations": moved,
    }


def runtime_metadata(support_depth: float) -> tuple[dict[str, Any], dict[str, Any]]:
    collider = {
        "shape": "box",
        "width": round(SUPPORT_WIDTH_METRES, 9),
        "depth": round(support_depth, 9),
        "height": COLLIDER_HEIGHT_METRES,
        "topY": 0,
        "center": [0, -COLLIDER_HEIGHT_METRES / 2.0, 0],
    }
    adapter = {
        "version": 1,
        "coordinates": {
            "upAxis": "+Y",
            "units": "metres",
            "origin": "top-centre-of-fully-extended-support",
        },
        "support": {
            "state": "fully-extended",
            "topY": 0,
            "width": round(SUPPORT_WIDTH_METRES, 9),
            "depth": round(support_depth, 9),
        },
        "motion": {
            "kind": "scroll",
            "localExtensionAxis": "x",
            "roles": {
                "deck": SEMANTIC.ROLE_ROOTS["deck"],
                "negativeRoller": SEMANTIC.ROLE_ROOTS["negativeRoller"],
                "positiveRoller": SEMANTIC.ROLE_ROOTS["positiveRoller"],
                "persistent": [],
            },
            "rollerEdgeAnchors": {
                "negative": [-round(SUPPORT_EDGE_METRES, 9), 0, 0],
                "positive": [round(SUPPORT_EDGE_METRES, 9), 0, 0],
            },
        },
    }
    return collider, adapter


def prepare_root(
    root: bpy.types.Object,
    collider: dict[str, Any],
    adapter: dict[str, Any],
) -> None:
    root.name = ROOT_NAME
    root.location = (0.0, 0.0, 0.0)
    root.rotation_euler = (0.0, 0.0, 0.0)
    root.scale = (1.0, 1.0, 1.0)
    root.matrix_parent_inverse.identity()
    for key in (
        "runtimeReady",
        "platformAdapterJsonPresent",
        "glassMaterialAccepted",
        "goldMaterialAccepted",
        "semanticMaterialSeparationComplete",
        "rollerIvoryGoldSplitAccepted",
        "deckGlassDetailSplitAccepted",
        "deckDetailTreatmentAccepted",
    ):
        if key in root:
            del root[key]
    root["assetId"] = RUNTIME_ID
    root["deliveryVersion"] = 1
    root["coordinates"] = "glTF +Y up; metres; top-centre of fully extended support"
    root["sourceCandidateSha256"] = ACCEPTED_CANDIDATE_SHA256
    root["opticalMaterialCheckpointAccepted"] = True
    root["supportColliderCertified"] = True
    root["minLengthRatio"] = MIN_LENGTH_RATIO
    root["collider_json"] = json.dumps(collider, separators=(",", ":"))
    root["platform_adapter_json"] = json.dumps(adapter, separators=(",", ":"))


def clean_runtime_scene(root: bpy.types.Object) -> None:
    review_reference = bpy.data.objects.get(CANDIDATE.SOURCE_DECK_REFERENCE_OBJECT)
    require(review_reference is not None, "Rejected source relief reference is absent")
    bpy.data.objects.remove(review_reference, do_unlink=True)
    keep = {root, *descendants(root)}
    for obj in list(bpy.data.objects):
        if obj not in keep:
            bpy.data.objects.remove(obj, do_unlink=True)
    for obj in keep:
        obj.hide_viewport = False
        obj.hide_render = False
        obj.hide_set(False)
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.length_unit = "METERS"
    bpy.context.scene.unit_settings.scale_length = 1.0
    for _ in range(3):
        if bpy.ops.outliner.orphans_purge(do_recursive=True) == {"CANCELLED"}:
            break


def save_runtime_blend(path: Path) -> None:
    for image in bpy.data.images:
        if image.source == "FILE" and image.packed_file is None:
            image.pack()
    bpy.ops.file.pack_all()
    CANDIDATE.save_atomic(path)


def export_runtime_glb(root: bpy.types.Object, path: Path) -> None:
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
    )
    require(result == {"FINISHED"} and temporary.is_file(), "Blender GLB export failed")
    os.replace(temporary, path)


def read_glb(path: Path) -> tuple[dict[str, Any], bytes]:
    payload = path.read_bytes()
    require(len(payload) >= 20, "Runtime GLB is incomplete")
    magic, version, length = struct.unpack_from("<4sII", payload, 0)
    require(magic == b"glTF" and version == 2 and length == len(payload), "Runtime GLB header differs")
    offset = 12
    document: dict[str, Any] | None = None
    binary = b""
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


def node_transform(node: dict[str, Any]) -> dict[str, list[float]]:
    return {
        "translation": rounded_vector(node.get("translation", [0.0, 0.0, 0.0])),
        "rotation": rounded_vector(node.get("rotation", [0.0, 0.0, 0.0, 1.0])),
        "scale": rounded_vector(node.get("scale", [1.0, 1.0, 1.0])),
    }


def vector_nearly_equals(
    actual: Iterable[float], expected: Iterable[float], tolerance: float = 1e-6
) -> bool:
    actual_values = list(actual)
    expected_values = list(expected)
    return len(actual_values) == len(expected_values) and all(
        abs(float(left) - float(right)) <= tolerance
        for left, right in zip(actual_values, expected_values)
    )


def image_dimensions(payload: bytes) -> list[int] | None:
    if payload.startswith(b"\x89PNG\r\n\x1a\n") and len(payload) >= 24:
        return list(struct.unpack_from(">II", payload, 16))
    if payload.startswith(b"\xff\xd8"):
        offset = 2
        while offset + 9 < len(payload):
            if payload[offset] != 0xFF:
                offset += 1
                continue
            marker = payload[offset + 1]
            offset += 2
            if marker in {0xD8, 0xD9}:
                continue
            if offset + 2 > len(payload):
                break
            size = struct.unpack_from(">H", payload, offset)[0]
            if marker in {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF} and offset + 7 <= len(payload):
                height, width = struct.unpack_from(">HH", payload, offset + 3)
                return [width, height]
            offset += size
    return None


def glb_inventory(
    path: Path,
    expected_collider: dict[str, Any],
    expected_adapter: dict[str, Any],
    material_bindings: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    document, binary = read_glb(path)
    forbidden = [
        extension
        for extension in document.get("extensionsUsed", [])
        if "draco" in extension.lower() or "meshopt" in extension.lower()
    ]
    require(not forbidden, f"Runtime GLB introduced unsupported codecs: {forbidden}")
    nodes = document.get("nodes", [])
    named: dict[str, list[tuple[int, dict[str, Any]]]] = {}
    for index, node in enumerate(nodes):
        named.setdefault(node.get("name", ""), []).append((index, node))
    expected_nodes = {
        ROOT_NAME,
        *SEMANTIC.ROLE_ROOTS.values(),
        *material_bindings.keys(),
    }
    for name in expected_nodes:
        require(len(named.get(name, [])) == 1, f"GLB node {name} is missing or ambiguous")
    require(CANDIDATE.SOURCE_DECK_REFERENCE_OBJECT not in named, "Rejected relief entered runtime GLB")

    root_index, root = named[ROOT_NAME][0]
    identity = node_transform(root)
    require(identity == {"translation": [0.0, 0.0, 0.0], "rotation": [0.0, 0.0, 0.0, 1.0], "scale": [1.0, 1.0, 1.0]}, "GLB family root is not identity")
    extras = root.get("extras", {})
    require(isinstance(extras.get("collider_json"), str), "GLB collider_json extra is not a string")
    require(isinstance(extras.get("platform_adapter_json"), str), "GLB platform_adapter_json extra is not a string")
    require(json.loads(extras["collider_json"]) == expected_collider, "GLB collider metadata differs")
    require(json.loads(extras["platform_adapter_json"]) == expected_adapter, "GLB adapter metadata differs")

    role_transforms = {
        name: node_transform(named[name][0][1])
        for name in SEMANTIC.ROLE_ROOTS.values()
    }
    require(vector_nearly_equals(role_transforms[SEMANTIC.ROLE_ROOTS["deck"]]["translation"], [0.0, 0.0, 0.0]), "Deck role origin differs")
    require(vector_nearly_equals(role_transforms[SEMANTIC.ROLE_ROOTS["negativeRoller"]]["translation"], [-SUPPORT_EDGE_METRES, 0.0, 0.0]), "Negative roller anchor differs")
    require(vector_nearly_equals(role_transforms[SEMANTIC.ROLE_ROOTS["positiveRoller"]]["translation"], [SUPPORT_EDGE_METRES, 0.0, 0.0]), "Positive roller anchor differs")

    materials = document.get("materials", [])
    material_names = [material.get("name", "") for material in materials]
    meshes = document.get("meshes", [])
    accessors = document.get("accessors", [])
    mesh_rows: dict[str, Any] = {}
    total_triangles = 0
    for mesh_name, binding in material_bindings.items():
        node = named[mesh_name][0][1]
        require("mesh" in node, f"GLB node {mesh_name} has no mesh")
        primitives = meshes[node["mesh"]].get("primitives", [])
        require(len(primitives) == 1, f"GLB mesh {mesh_name} must export as one primitive")
        primitive = primitives[0]
        require("indices" in primitive and "material" in primitive, f"GLB mesh {mesh_name} lacks indices or material")
        triangles = int(accessors[primitive["indices"]]["count"]) // 3
        total_triangles += triangles
        material_name = material_names[primitive["material"]]
        require(material_name == binding["material"], f"GLB material for {mesh_name} differs")
        mesh_rows[mesh_name] = {
            "triangles": triangles,
            "attributes": sorted(primitive.get("attributes", {}).keys()),
            "material": material_name,
            "materialIndex": primitive["material"],
        }

    buffer_views = document.get("bufferViews", [])
    image_rows: list[dict[str, Any]] = []
    for image in document.get("images", []):
        require("bufferView" in image and "uri" not in image, "Runtime GLB contains an external image")
        view = buffer_views[image["bufferView"]]
        start = int(view.get("byteOffset", 0))
        end = start + int(view["byteLength"])
        image_payload = binary[start:end]
        image_rows.append(
            {
                "name": image.get("name"),
                "mimeType": image.get("mimeType"),
                "bytes": len(image_payload),
                "sha256": hashlib.sha256(image_payload).hexdigest(),
                "dimensions": image_dimensions(image_payload),
            }
        )
    require(not any("uri" in buffer for buffer in document.get("buffers", [])), "Runtime GLB contains an external buffer")
    return {
        "assetVersion": document.get("asset", {}).get("version"),
        "generator": document.get("asset", {}).get("generator"),
        "sceneRootNode": root_index,
        "nodes": len(nodes),
        "meshes": len(meshes),
        "materials": material_names,
        "textures": len(document.get("textures", [])),
        "images": image_rows,
        "extensionsUsed": document.get("extensionsUsed", []),
        "extensionsRequired": document.get("extensionsRequired", []),
        "forbiddenGeometryCodecs": forbidden,
        "externalDependencies": [],
        "roleTransformsGlTfYUp": role_transforms,
        "meshRows": mesh_rows,
        "totalTriangles": total_triangles,
        "metadataStrings": {
            "collider_json": extras["collider_json"],
            "platform_adapter_json": extras["platform_adapter_json"],
        },
    }


def build() -> dict[str, Any]:
    output = paths()
    candidate_report = json.loads(output["candidateReport"].read_text())
    require(PREPARE.digest(output["candidate"]) == ACCEPTED_CANDIDATE_SHA256, "Accepted optical candidate changed")
    require(candidate_report["candidateBlend"]["sha256"] == ACCEPTED_CANDIDATE_SHA256, "Candidate report does not name accepted Blend")

    bpy.ops.wm.open_mainfile(filepath=str(output["candidate"]), load_ui=False)
    bpy.context.preferences.filepaths.save_version = 0
    root = bpy.data.objects.get(CANDIDATE.ROOT_NAME)
    require(root is not None and root.parent is None, "Accepted candidate root is absent")

    geometry_before = {
        name: geometry_fingerprint(bpy.data.objects[name])
        for name in MESH_BINDING_KINDS
    }
    roller_bounds_before = {
        name: world_bounds(bpy.data.objects[name]) for name in CANDIDATE.ROLLER_OBJECTS
    }
    deck_recentre = recenter_deck_support()
    support_depth = float(deck_recentre["flatTopAfter"]["dimensions"][1])
    require(abs(support_depth - 2.205964088) <= 1e-6, "Certified support depth changed")

    anchor_rows = {
        "negative": anchor_roller_role(
            SEMANTIC.ROLE_ROOTS["negativeRoller"], -SUPPORT_EDGE_METRES
        ),
        "positive": anchor_roller_role(
            SEMANTIC.ROLE_ROOTS["positiveRoller"], SUPPORT_EDGE_METRES
        ),
    }
    material_bindings = consolidate_runtime_materials()
    collider, adapter = runtime_metadata(support_depth)
    prepare_root(root, collider, adapter)
    clean_runtime_scene(root)
    bpy.context.view_layer.update()

    geometry_after = {
        name: geometry_fingerprint(bpy.data.objects[name])
        for name in MESH_BINDING_KINDS
    }
    require(geometry_after == geometry_before, "Runtime preparation changed mesh positions or triangle indices")
    roller_bounds_after = {
        name: world_bounds(bpy.data.objects[name]) for name in CANDIDATE.ROLLER_OBJECTS
    }
    roller_bounds_delta = {
        name: round(bounds_max_delta(roller_bounds_before[name], roller_bounds_after[name]), 12)
        for name in CANDIDATE.ROLLER_OBJECTS
    }
    require(
        max(roller_bounds_delta.values()) <= 1e-6,
        f"Runtime role anchoring changed roller world geometry: {roller_bounds_delta}",
    )

    save_runtime_blend(output["runtimeBlend"])
    runtime_blend_record = PREPARE.file_record(output["runtimeBlend"])
    export_runtime_glb(root, output["runtimeGlb"])
    inventory = glb_inventory(output["runtimeGlb"], collider, adapter, material_bindings)
    require(inventory["totalTriangles"] == 527368, "Runtime GLB triangle count differs")

    manifest = {
        "schema": 1,
        "assetId": RUNTIME_ID,
        "status": "certified-full-detail-export-preserved-for-source-review",
        "bundle": {
            **PREPARE.file_record(output["runtimeGlb"]),
            "logicalId": RUNTIME_ID,
            "deliveryClass": "source-full-detail",
            "rootNode": ROOT_NAME,
            "decoderPolicy": "plain glTF 2.0 GLB; no Draco or Meshopt decoder",
            "externalDependencies": [],
        },
        "coordinates": {
            "upAxis": "+Y",
            "units": "metres",
            "origin": "top-centre-of-fully-extended-support",
            "localExtensionAxis": "+X",
            "perpendicularAxis": "+Z",
            "noNonUniformArtScaling": True,
        },
        "supportCertification": {
            "collider": collider,
            "adapter": adapter,
            "flatTopBlenderZUpAfterRecentre": deck_recentre["flatTopAfter"],
            "glassOuterDimensionsMetres": candidate_report["roleGeometry"]["planarInsetSpecification"]["dimensionsMetres"],
            "rollerAnchorSpanMetres": round(SUPPORT_WIDTH_METRES, 9),
            "glassOverlapUnderEachRollerMetres": 0.006,
            "widthPolicy": (
                "The motion/collider width terminates at the source cut planes and certified roller anchors. "
                "The glass extends 6 mm beneath each roller; its 12 mm edge bevel places the fully flat top "
                "6 mm inside each X anchor. This bounded covered bevel is intentional and recorded rather "
                "than enlarging the simple collider to decorative roller geometry."
            ),
            "depthPolicy": (
                "Collider depth is the exactly centred flat top between the authored 12 mm end bevels. "
                "The outer glass and decorative roller bodies extend beyond this support depth."
            ),
            "landingContactPlanesLocal": {
                "negativeX": -round(SUPPORT_EDGE_METRES, 9),
                "positiveX": round(SUPPORT_EDGE_METRES, 9),
                "minimumLandingDepth": round(support_depth, 9),
                "topY": 0,
            },
            "courseIntegrationFootprint": {
                "extensionLengthLocalXMetres": round(SUPPORT_WIDTH_METRES, 9),
                "walkableCorridorWidthLocalZMetres": round(support_depth, 9),
                "uniformScaleOnly": True,
                "note": (
                    "This donor is a compact crossing: retraction runs along its short local X span, "
                    "while the long local Z span is the walkable corridor width. Do not stretch it "
                    "non-uniformly to the provisional 3.0 x 1.8 metre study footprint."
                ),
            },
            "minimumLengthRatio": MIN_LENGTH_RATIO,
        },
        "roles": adapter["motion"]["roles"],
        "materialBindings": material_bindings,
        "lineage": {
            "acceptedOpticalCandidate": PREPARE.file_record(output["candidate"]),
            "semanticDerivative": PREPARE.file_record(output["semantic"]),
            "acceptedCandidateReport": PREPARE.file_record(output["candidateReport"]),
            "originalReliefPreservedInSource": True,
            "rejectedReliefExcludedFromRuntime": True,
        },
        "geometryPreservation": {
            "meshFingerprintsBefore": geometry_before,
            "meshFingerprintsAfter": geometry_after,
            "meshPositionsAndTriangleIndicesUnchanged": True,
            "rollerWorldBoundsBefore": roller_bounds_before,
            "rollerWorldBoundsAfter": roller_bounds_after,
            "rollerWorldBoundsMaxDeltaMetres": roller_bounds_delta,
            "roleAnchorTransformCompensation": anchor_rows,
            "deckRecentre": deck_recentre,
            "diagnosticCapTrianglesRetained": True,
            "diagnosticCapMaterialReplacedByReviewedRollerPbr": True,
            "blanketDecimationUsed": False,
        },
        "runtimeBlend": {
            **runtime_blend_record,
            "packed": True,
            "editableSourceCandidatePreservedSeparately": True,
        },
        "glbInventory": inventory,
        "remainingGate": "Bounded texture and meshopt delivery derivative plus actual GLTFLoader, adapter, and WebGL renderer proof.",
        "tool": {"blender": bpy.app.version_string, "numpy": np.__version__},
        "rebuild": (
            "rtk proxy flock -w 1200 /tmp/glass-cloudway-blender.lock timeout 1200 "
            "env ALSOFT_DRIVERS=null /usr/bin/blender --background --factory-startup "
            "--python-exit-code 1 --python "
            "art/glass-adventure/cloudway-laboratory/v1/production/prepare_scroll_runtime_delivery.py"
        ),
    }
    PREPARE.durable_json(output["runtimeManifest"], manifest)
    PREPARE.durable_json(output["report"], manifest)
    PREPARE.durable_json(output["mirror"], manifest)
    require(PREPARE.digest(output["runtimeManifest"]) == PREPARE.digest(output["mirror"]), "Runtime manifest mirror differs")
    require(PREPARE.digest(output["report"]) == PREPARE.digest(output["mirror"]), "Runtime report mirror differs")
    require(PREPARE.digest(output["candidate"]) == ACCEPTED_CANDIDATE_SHA256, "Runtime export mutated accepted candidate")
    return manifest


if __name__ == "__main__":
    print(json.dumps(build(), indent=2))
