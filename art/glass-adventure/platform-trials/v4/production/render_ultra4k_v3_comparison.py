#!/usr/bin/env python3
"""Render a hash-bound, source-only V3 versus Ultra 4K platform audition."""

from __future__ import annotations

from io import BytesIO
import hashlib
import json
import math
from pathlib import Path
import struct
from typing import Any

import bpy
from mathutils import Matrix, Vector
from PIL import Image


HERE = Path(__file__).resolve().parent
V4 = HERE.parent
TRIALS = V4.parent
V3 = TRIALS / "v3"
REPO = HERE.parents[4]

ULTRA_RECEIPT = V4 / "meshy" / "marble-ultra4k" / "receipt.json"
ULTRA_MODEL = V4 / "meshy" / "marble-ultra4k" / "dense-donor.glb"
V3_MANIFEST = V3 / "exports" / "manifest.json"
V3_MODEL = V3 / "exports" / "cloudway-platform-kit-v3.glb"
PROOFS = V4 / "proofs"
REPORT = PROOFS / "marble-ultra4k-v3-source-comparison.json"

EXPECTED_ULTRA_RECEIPT_SHA256 = (
    "eda46fffe201c8a673f469ae4fec8c7b89dfca5742d61b366d4ec00004710a04"
)
EXPECTED_ULTRA_MODEL_SHA256 = (
    "fa4d01900561e257be18c7190ef893aa789f178d1d4ccd13c2da22427d1033bb"
)
EXPECTED_ULTRA_BYTES = 65_096_584
EXPECTED_ULTRA_TRIANGLES = 1_256_556
EXPECTED_ULTRA_VERTICES = 702_537
EXPECTED_ULTRA_TASK = "01a0cef2-fffb-726e-8659-b4e06c21149a"

EXPECTED_V3_MANIFEST_SHA256 = (
    "d3f5c1c136c4964f2cc8b3e1d7ed34a3664c861fd7c8d0b831e0c193894d76f0"
)
EXPECTED_V3_MODEL_SHA256 = (
    "5daf655fd51f8c4ac93342c20024d3df803ecef0cbc6d2a4c48bcb85bedf25fe"
)
EXPECTED_V3_BYTES = 42_929_408
EXPECTED_V3_TRIANGLES = 40_032
V3_ROOT = "Cloudway_Marble"

ORDER = ["Current V3 source platform", "Meshy 7.1 Ultra 4K dense donor"]
DISPLAY_CENTRES_X = (-1.12, 1.12)
FRONT_ORTHO_SCALE = 4.8
ANGLE_ORTHO_SCALE = 5.2
REQUIRED_EXTERNAL_MAPS = {"base_color", "normal", "metallic", "roughness"}
CHANNELS = {
    "baseColor": "RGB color; A alpha when present",
    "normal": "RGB tangent-space normal",
    "metallicRoughness": "B metallic; G roughness",
    "occlusion": "R occlusion",
    "emissive": "RGB emissive",
}


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def relative(path: Path) -> str:
    return str(path.relative_to(REPO))


def require_file(path: Path, label: str) -> None:
    if not path.is_file() or path.stat().st_size <= 0:
        raise FileNotFoundError(f"{label} is missing: {relative(path)}")


def load_object(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object in {relative(path)}")
    return value


def read_glb(path: Path) -> tuple[dict[str, Any], bytes]:
    data = path.read_bytes()
    if len(data) < 20:
        raise ValueError(f"Truncated GLB: {relative(path)}")
    magic, version, declared = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2 or declared != len(data):
        raise ValueError(f"Invalid GLB header: {relative(path)}")
    offset = 12
    document: dict[str, Any] | None = None
    binary: bytes | None = None
    while offset < len(data):
        if offset + 8 > len(data):
            raise ValueError(f"Truncated GLB chunk header: {relative(path)}")
        length, kind = struct.unpack_from("<II", data, offset)
        offset += 8
        payload = data[offset : offset + length]
        if len(payload) != length:
            raise ValueError(f"Truncated GLB chunk: {relative(path)}")
        offset += length
        if kind == 0x4E4F534A:
            document = json.loads(payload.decode("utf-8").rstrip(" \x00"))
        elif kind == 0x004E4942:
            binary = payload
    if document is None or binary is None:
        raise ValueError(f"GLB must contain JSON and BIN chunks: {relative(path)}")
    return document, binary


def buffer_view_payload(document: dict[str, Any], binary: bytes, index: int) -> bytes:
    view = document["bufferViews"][index]
    if int(view.get("buffer", 0)) != 0:
        raise ValueError("Comparison supports only the embedded GLB buffer")
    start = int(view.get("byteOffset", 0))
    end = start + int(view["byteLength"])
    if start < 0 or end > len(binary):
        raise ValueError("GLB buffer view falls outside the BIN chunk")
    return binary[start:end]


def selected_node_indices(document: dict[str, Any], root_name: str | None) -> set[int]:
    nodes = document.get("nodes", [])
    if root_name is None:
        return set(range(len(nodes)))
    matches = [index for index, node in enumerate(nodes) if node.get("name") == root_name]
    if len(matches) != 1:
        raise ValueError(f"Expected one glTF node named {root_name}; found {len(matches)}")
    selected: set[int] = set()
    pending = matches[:]
    while pending:
        index = pending.pop()
        if index in selected:
            continue
        selected.add(index)
        pending.extend(int(child) for child in nodes[index].get("children", []))
    return selected


def texture_source(texture: dict[str, Any]) -> tuple[int, str]:
    extensions = texture.get("extensions", {})
    for name in ("EXT_texture_webp", "KHR_texture_basisu"):
        value = extensions.get(name)
        if isinstance(value, dict) and "source" in value:
            return int(value["source"]), name
    if "source" not in texture:
        raise ValueError("Texture has no supported image source")
    return int(texture["source"]), "core"


def image_record(
    document: dict[str, Any], binary: bytes, image_index: int
) -> dict[str, Any]:
    image = document["images"][image_index]
    if "bufferView" not in image or "uri" in image:
        raise ValueError("Comparison requires embedded GLB images")
    payload = buffer_view_payload(document, binary, int(image["bufferView"]))
    with Image.open(BytesIO(payload)) as decoded:
        decoded.load()
        dimensions = list(decoded.size)
        image_format = decoded.format
        mode = decoded.mode
    return {
        "imageIndex": image_index,
        "name": image.get("name"),
        "mimeType": image.get("mimeType"),
        "bytes": len(payload),
        "sha256": hashlib.sha256(payload).hexdigest(),
        "format": image_format,
        "dimensions": dimensions,
        "mode": mode,
    }


def glb_inventory(path: Path, root_name: str | None) -> dict[str, Any]:
    document, binary = read_glb(path)
    selected = selected_node_indices(document, root_name)
    mesh_indices = sorted(
        {
            int(document["nodes"][index]["mesh"])
            for index in selected
            if "mesh" in document["nodes"][index]
        }
    )
    if not mesh_indices:
        raise ValueError(f"No meshes selected in {relative(path)}")

    material_indices: set[int] = set()
    triangles = 0
    vertices = 0
    for mesh_index in mesh_indices:
        for primitive in document["meshes"][mesh_index].get("primitives", []):
            if int(primitive.get("mode", 4)) != 4:
                raise ValueError("Comparison requires triangle primitives")
            position = document["accessors"][int(primitive["attributes"]["POSITION"])]
            vertices += int(position["count"])
            if "indices" in primitive:
                triangles += int(document["accessors"][int(primitive["indices"])]["count"]) // 3
            else:
                triangles += int(position["count"]) // 3
            if "material" in primitive:
                material_indices.add(int(primitive["material"]))

    role_paths = (
        ("baseColor", ("pbrMetallicRoughness", "baseColorTexture")),
        ("metallicRoughness", ("pbrMetallicRoughness", "metallicRoughnessTexture")),
        ("normal", ("normalTexture",)),
        ("occlusion", ("occlusionTexture",)),
        ("emissive", ("emissiveTexture",)),
    )
    bindings: list[dict[str, Any]] = []
    used_images: set[int] = set()
    for material_index in sorted(material_indices):
        material = document["materials"][material_index]
        for role, path_keys in role_paths:
            value: Any = material
            for key in path_keys:
                value = value.get(key) if isinstance(value, dict) else None
            if not isinstance(value, dict) or "index" not in value:
                continue
            texture_index = int(value["index"])
            image_index, source_contract = texture_source(document["textures"][texture_index])
            used_images.add(image_index)
            bindings.append(
                {
                    "role": role,
                    "channels": CHANNELS[role],
                    "materialIndex": material_index,
                    "materialName": material.get("name"),
                    "textureIndex": texture_index,
                    "texCoord": int(value.get("texCoord", 0)),
                    "imageIndex": image_index,
                    "sourceContract": source_contract,
                }
            )
    images = [image_record(document, binary, index) for index in sorted(used_images)]
    return {
        "file": relative(path),
        "bytes": path.stat().st_size,
        "sha256": digest(path),
        "selectedRoot": root_name,
        "selectedNodeCount": len(selected),
        "meshIndices": mesh_indices,
        "materialIndices": sorted(material_indices),
        "referencedVertices": vertices,
        "triangles": triangles,
        "textureBindings": bindings,
        "embeddedImages": images,
    }


def external_map_inventory(receipt: dict[str, Any]) -> list[dict[str, Any]]:
    archive = receipt.get("archiveDownload")
    if not isinstance(archive, dict):
        raise ValueError("Ultra receipt has no archiveDownload record")
    if archive.get("missingRequestedPbrMaps") != []:
        raise ValueError("Ultra archive is missing one or more requested PBR maps")
    records = archive.get("textures")
    if not isinstance(records, list):
        raise ValueError("Ultra receipt has no external texture records")
    result: list[dict[str, Any]] = []
    for record in records:
        if not isinstance(record, dict) or not isinstance(record.get("file"), str):
            raise ValueError("Ultra receipt contains a malformed texture record")
        path = REPO / record["file"]
        require_file(path, "Archived Ultra texture")
        if digest(path) != record.get("sha256") or path.stat().st_size != int(
            record.get("bytes", -1)
        ):
            raise ValueError(f"Archived texture changed: {relative(path)}")
        with Image.open(path) as image:
            image.load()
            actual = {
                "dimensions": list(image.size),
                "format": image.format,
                "mode": image.mode,
            }
        for key, value in actual.items():
            if record.get(key) != value:
                raise ValueError(f"Archived texture {key} changed: {relative(path)}")
        result.append(dict(record))
    roles = {str(record.get("role")) for record in result}
    if roles != REQUIRED_EXTERNAL_MAPS:
        raise ValueError(f"Expected external maps {sorted(REQUIRED_EXTERNAL_MAPS)}; found {sorted(roles)}")
    return sorted(result, key=lambda item: (int(item["setIndex"]), str(item["role"])))


def validate_sources() -> dict[str, Any]:
    for path, label in (
        (ULTRA_RECEIPT, "Ultra receipt"),
        (ULTRA_MODEL, "Ultra dense donor"),
        (V3_MANIFEST, "V3 manifest"),
        (V3_MODEL, "V3 source platform kit"),
    ):
        require_file(path, label)
    if digest(ULTRA_RECEIPT) != EXPECTED_ULTRA_RECEIPT_SHA256:
        raise ValueError("Ultra receipt changed after archive acceptance")
    if (
        ULTRA_MODEL.stat().st_size != EXPECTED_ULTRA_BYTES
        or digest(ULTRA_MODEL) != EXPECTED_ULTRA_MODEL_SHA256
    ):
        raise ValueError("Ultra dense donor differs from the accepted archive")
    if digest(V3_MANIFEST) != EXPECTED_V3_MANIFEST_SHA256:
        raise ValueError("V3 source manifest changed")
    if V3_MODEL.stat().st_size != EXPECTED_V3_BYTES or digest(V3_MODEL) != EXPECTED_V3_MODEL_SHA256:
        raise ValueError("V3 source platform kit changed")

    receipt = load_object(ULTRA_RECEIPT)
    if receipt.get("state") != "archived" or receipt.get("taskId") != EXPECTED_ULTRA_TASK:
        raise ValueError("Ultra trial is not the accepted archived task")
    final_status = receipt.get("finalStatus")
    if not isinstance(final_status, dict) or final_status.get("status") != "SUCCEEDED":
        raise ValueError("Ultra provider task is not recorded as successful")
    if int(final_status.get("consumed_credits", -1)) != 35:
        raise ValueError("Ultra provider task credit record changed")
    confirmation = receipt.get("providerConfirmation")
    if not isinstance(confirmation, dict) or confirmation.get("returnedGeometryResolution") != "4k":
        raise ValueError("Ultra provider did not confirm 4K geometry")
    request = receipt.get("request")
    if not isinstance(request, dict) or request.get("ai_model") != "meshy-7.1":
        raise ValueError("Ultra receipt no longer records the explicit Meshy 7.1 request")
    if request.get("should_remesh") is not False or request.get("texture_resolution") != "4k":
        raise ValueError("Ultra receipt no longer identifies the dense, 4K-texture request")

    ultra = glb_inventory(ULTRA_MODEL, None)
    archive_model = receipt["archiveDownload"]["model"]
    for key, expected in (
        ("bytes", EXPECTED_ULTRA_BYTES),
        ("sha256", EXPECTED_ULTRA_MODEL_SHA256),
        ("triangles", EXPECTED_ULTRA_TRIANGLES),
        ("referencedVertices", EXPECTED_ULTRA_VERTICES),
    ):
        if archive_model.get(key) != expected or ultra.get(key) != expected:
            raise ValueError(f"Ultra model {key} differs from its accepted archive")

    v3_manifest = load_object(V3_MANIFEST)
    source = v3_manifest.get("bundle", {}).get("sourceQuality", {})
    if (
        source.get("source") != relative(V3_MODEL)
        or source.get("bytes") != EXPECTED_V3_BYTES
        or source.get("sha256") != EXPECTED_V3_MODEL_SHA256
    ):
        raise ValueError("V3 manifest no longer identifies the accepted source-quality kit")
    nodes = v3_manifest.get("nodes")
    matches = [node for node in nodes if isinstance(node, dict) and node.get("name") == V3_ROOT]
    if len(matches) != 1 or int(matches[0].get("triangles", -1)) != EXPECTED_V3_TRIANGLES:
        raise ValueError("V3 manifest no longer identifies the marble platform")
    visual = matches[0].get("visualBoundsGlTfYUpMetres")
    if not isinstance(visual, dict):
        raise ValueError("V3 marble visual bounds are absent")
    target_width = float(visual["max"][0]) - float(visual["min"][0])
    if not math.isclose(target_width, 1.801668, rel_tol=0.0, abs_tol=1e-6):
        raise ValueError("V3 marble source width changed")

    v3 = glb_inventory(V3_MODEL, V3_ROOT)
    if int(v3["triangles"]) != EXPECTED_V3_TRIANGLES:
        raise ValueError("V3 marble GLB triangle count differs from its manifest")
    return {
        "targetDisplayWidthMetres": target_width,
        "v3Manifest": {
            "file": relative(V3_MANIFEST),
            "bytes": V3_MANIFEST.stat().st_size,
            "sha256": EXPECTED_V3_MANIFEST_SHA256,
        },
        "ultraReceipt": {
            "file": relative(ULTRA_RECEIPT),
            "bytes": ULTRA_RECEIPT.stat().st_size,
            "sha256": EXPECTED_ULTRA_RECEIPT_SHA256,
            "taskId": EXPECTED_ULTRA_TASK,
            "credits": 35,
            "providerConfirmation": confirmation,
        },
        "v3": v3,
        "ultra": ultra,
        "ultraExternalMaps": external_map_inventory(receipt),
    }


def descendants(root: bpy.types.Object) -> set[bpy.types.Object]:
    result: set[bpy.types.Object] = {root}
    pending = list(root.children)
    while pending:
        item = pending.pop()
        if item in result:
            continue
        result.add(item)
        pending.extend(item.children)
    return result


def bounds(meshes: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points = [
        obj.matrix_world @ vertex.co
        for obj in meshes
        for vertex in obj.data.vertices
    ]
    if not points:
        raise ValueError("Imported asset contains no vertices")
    return (
        Vector(min(point[axis] for point in points) for axis in range(3)),
        Vector(max(point[axis] for point in points) for axis in range(3)),
    )


def vector(values: Vector) -> list[float]:
    return [round(float(value), 6) for value in values]


def clay_material() -> bpy.types.Material:
    result = bpy.data.materials.new("neutral-source-clay")
    result.diffuse_color = (0.66, 0.63, 0.57, 1.0)
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (0.66, 0.63, 0.57, 1.0)
    shader.inputs["Roughness"].default_value = 0.58
    shader.inputs["Metallic"].default_value = 0.0
    return result


def import_for_display(
    label: str,
    path: Path,
    root_name: str | None,
    target_width: float,
    offset_x: float,
    clay: bpy.types.Material | None,
    expected_triangles: int,
) -> dict[str, Any]:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    if root_name is None:
        selected = [obj for obj in imported if obj.type == "MESH"]
    else:
        roots = [obj for obj in imported if obj.name == root_name]
        if len(roots) != 1:
            raise ValueError(f"Expected one Blender object named {root_name}; found {len(roots)}")
        owned = descendants(roots[0])
        selected = [obj for obj in imported if obj.type == "MESH" and obj in owned]
    if not selected:
        raise ValueError(f"No display meshes imported from {relative(path)}")

    low, high = bounds(selected)
    dimensions = high - low
    if dimensions.x <= 0 or dimensions.y <= 0 or dimensions.z <= 0:
        raise ValueError(f"Degenerate source bounds in {relative(path)}")
    triangles = 0
    vertices = 0
    for obj in selected:
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
        vertices += len(obj.data.vertices)
    if triangles != expected_triangles:
        raise ValueError(
            f"{label} imported with {triangles} triangles; expected {expected_triangles}"
        )

    scale = target_width / dimensions.x
    centre_x = (low.x + high.x) * 0.5
    centre_y = (low.y + high.y) * 0.5
    for index, obj in enumerate(selected):
        world = obj.matrix_world.copy()
        obj.parent = None
        obj.data = obj.data.copy()
        obj.data.transform(world)
        obj.matrix_world = Matrix.Identity(4)
        for vertex in obj.data.vertices:
            vertex.co.x = (vertex.co.x - centre_x) * scale + offset_x
            vertex.co.y = (vertex.co.y - centre_y) * scale
            vertex.co.z = (vertex.co.z - low.z) * scale
        if clay is not None:
            obj.data.materials.clear()
            obj.data.materials.append(clay)
            for polygon in obj.data.polygons:
                polygon.material_index = 0
        obj.name = f"{label}-{index:02d}"
        obj.data.name = f"{label}-{index:02d}-mesh"
        obj.data.update()
    for obj in imported:
        if obj not in selected:
            bpy.data.objects.remove(obj, do_unlink=True)

    normalized_low, normalized_high = bounds(selected)
    normalized_dimensions = normalized_high - normalized_low
    return {
        "label": label,
        "file": relative(path),
        "selectedRoot": root_name,
        "meshObjects": len(selected),
        "verticesAfterImport": vertices,
        "trianglesAfterImport": triangles,
        "rawBoundsBlenderZUpMetres": {"min": vector(low), "max": vector(high)},
        "rawDimensionsBlenderZUpMetres": vector(dimensions),
        "rawDimensionsGlTfYUpMetres": vector(Vector((dimensions.x, dimensions.z, dimensions.y))),
        "uniformDisplayScale": round(float(scale), 9),
        "displayWidthAuthority": "Current V3 source visual X width",
        "displayCentreXMetres": offset_x,
        "displayGroundAnchorZMetres": 0.0,
        "displayDimensionsBlenderZUpMetres": vector(normalized_dimensions),
    }


def add_area(
    name: str,
    location: tuple[float, float, float],
    energy: float,
    size: float,
    color: tuple[float, float, float],
    target: Vector,
) -> None:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def setup_scene() -> tuple[bpy.types.Scene, bpy.types.Object]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 16
    scene.cycles.seed = 23
    scene.cycles.use_denoising = True
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 8
    scene.render.resolution_x = 1800
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"

    world = bpy.data.worlds.new("Ultra 4K platform comparison world")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.055, 0.072, 0.095, 1.0)
    background.inputs["Strength"].default_value = 0.38
    scene.world = world

    floor_material = bpy.data.materials.new("comparison floor")
    floor_material.use_nodes = True
    floor_shader = floor_material.node_tree.nodes.get("Principled BSDF")
    floor_shader.inputs["Base Color"].default_value = (0.12, 0.14, 0.17, 1.0)
    floor_shader.inputs["Roughness"].default_value = 0.74
    bpy.ops.mesh.primitive_plane_add(size=12.0, location=(0.0, 0.0, -0.012))
    bpy.context.object.data.materials.append(floor_material)

    target = Vector((0.0, 0.0, 0.31))
    add_area("warm key", (-4.2, -4.8, 5.6), 1050.0, 4.0, (1.0, 0.78, 0.59), target)
    add_area("cool fill", (4.6, -2.8, 4.2), 760.0, 3.6, (0.69, 0.84, 1.0), target)
    add_area("soft rim", (0.0, 4.0, 4.8), 900.0, 3.5, (0.70, 1.0, 0.88), target)

    camera_data = bpy.data.cameras.new("comparison camera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = FRONT_ORTHO_SCALE
    camera = bpy.data.objects.new("comparison camera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    scene.camera = camera
    return scene, camera


def render(scene: bpy.types.Scene, camera: bpy.types.Object, target: Vector, location: tuple[float, float, float], path: Path) -> None:
    camera.location = location
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def render_mode(
    mode: str, source: dict[str, Any]
) -> tuple[list[dict[str, Any]], list[Path]]:
    scene, camera = setup_scene()
    neutral = clay_material() if mode == "clay" else None
    target_width = float(source["targetDisplayWidthMetres"])
    rows = [
        import_for_display(
            ORDER[0],
            V3_MODEL,
            V3_ROOT,
            target_width,
            DISPLAY_CENTRES_X[0],
            neutral,
            EXPECTED_V3_TRIANGLES,
        ),
        import_for_display(
            ORDER[1],
            ULTRA_MODEL,
            None,
            target_width,
            DISPLAY_CENTRES_X[1],
            neutral,
            EXPECTED_ULTRA_TRIANGLES,
        ),
    ]
    PROOFS.mkdir(parents=True, exist_ok=True)
    front = PROOFS / f"marble-ultra4k-v3-{mode}-front.png"
    angle = PROOFS / f"marble-ultra4k-v3-{mode}-three-quarter.png"
    target = Vector((0.0, 0.0, 0.31))
    camera.data.ortho_scale = FRONT_ORTHO_SCALE
    render(scene, camera, target, (0.0, -6.2, 1.75), front)
    camera.data.ortho_scale = ANGLE_ORTHO_SCALE
    render(scene, camera, target, (4.5, -6.4, 2.25), angle)
    return rows, [front, angle]


def proof_record(path: Path) -> dict[str, Any]:
    with Image.open(path) as image:
        image.load()
        dimensions = list(image.size)
    return {
        "file": relative(path),
        "bytes": path.stat().st_size,
        "sha256": digest(path),
        "dimensions": dimensions,
    }


def main() -> None:
    source = validate_sources()
    groups: list[dict[str, Any]] = []
    all_proofs: list[Path] = []
    authoritative_rows: list[dict[str, Any]] | None = None
    for mode in ("clay", "textured"):
        rows, proofs = render_mode(mode, source)
        if authoritative_rows is None:
            authoritative_rows = rows
        elif rows != authoritative_rows:
            raise ValueError("Clay and textured imports produced different source measurements")
        groups.append(
            {
                "mode": mode,
                "order": ORDER,
                "sameScale": True,
                "sameCameraAndLighting": True,
                "proofs": [proof_record(path) for path in proofs],
            }
        )
        all_proofs.extend(proofs)

    if authoritative_rows is None:
        raise ValueError("Comparison produced no source measurements")
    v3_dimensions = authoritative_rows[0]["displayDimensionsBlenderZUpMetres"]
    ultra_dimensions = authoritative_rows[1]["displayDimensionsBlenderZUpMetres"]
    depth_delta_percent = (float(ultra_dimensions[1]) / float(v3_dimensions[1]) - 1.0) * 100.0
    height_delta_percent = (float(ultra_dimensions[2]) / float(v3_dimensions[2]) - 1.0) * 100.0

    report = {
        "schema": 1,
        "asset": "cloudway-marble-platform-source-audition-v4",
        "purpose": (
            "Source-only same-scale comparison of the current V3 marble platform and the "
            "archived Meshy 7.1 Ultra 4K dense donor. This is audition evidence only: no "
            "remesh, bake, generation, runtime export or public integration is performed."
        ),
        "decision": {
            "state": "accepted-as-high-detail-source-donor",
            "selectedSource": relative(ULTRA_MODEL),
            "scope": "dense source donor for a later professional high-to-low workflow",
            "runtimeIntegrationAuthorized": False,
            "basis": [
                (
                    "Neutral clay shows cleaner and more coherent apron arches, corner blocks, "
                    "feet, flower medallions, framed top inlay and foliage than the current V3 source."
                ),
                (
                    "Textured views preserve legible marble, teal and gold regions while the V3 "
                    "source still exposes dark top-surface tears and jagged foliage."
                ),
                (
                    "The dense archive carries 4K base color and normal plus 2K metallic and "
                    "roughness maps, suitable as high-detail bake inputs."
                ),
            ],
            "fitRiskAtMatchedWidth": {
                "v3DepthMetres": v3_dimensions[1],
                "ultraDepthMetres": ultra_dimensions[1],
                "ultraDepthDeltaPercent": round(depth_delta_percent, 2),
                "v3HeightMetres": v3_dimensions[2],
                "ultraHeightMetres": ultra_dimensions[2],
                "ultraHeightDeltaPercent": round(height_delta_percent, 2),
            },
            "remainingGates": [
                "Fit a low mesh to the V3 1.801668 x 1.400053 metre landing envelope and collider contract.",
                "Retopologize and unwrap without changing the accepted silhouette or landing surface.",
                "Bake normal and AO from this dense donor, then validate UVs, finite unit normals and tangents.",
                "Review texture memory and runtime performance before any asset integration.",
            ],
            "reviewEvidence": [proof_record(path) for path in all_proofs],
        },
        "normalization": {
            "method": (
                "Uniformly scale each source to the current V3 marble visual X width, preserve "
                "aspect ratio, center in X/Y, then ground its minimum Blender Z at zero."
            ),
            "targetWidthMetres": source["targetDisplayWidthMetres"],
            "why": (
                "Width is the stable V3 runtime-space authority. Uniform scaling exposes depth "
                "and height proportion changes instead of hiding them with axis-wise stretching."
            ),
        },
        "order": ORDER,
        "sourceMeasurements": authoritative_rows,
        "sourceArchives": {
            "v3Manifest": source["v3Manifest"],
            "ultraReceipt": source["ultraReceipt"],
        },
        "glbInventories": {
            "currentV3": source["v3"],
            "ultra4kDense": source["ultra"],
        },
        "ultraExternalPbrMaps": source["ultraExternalMaps"],
        "groups": groups,
        "proofFiles": [proof_record(path) for path in all_proofs],
        "render": {
            "engine": "Cycles CPU",
            "samples": 16,
            "seed": 23,
            "cpuThreads": 8,
            "resolution": [1800, 1000],
            "camera": "orthographic",
            "orthoScale": {
                "front": FRONT_ORTHO_SCALE,
                "threeQuarter": ANGLE_ORTHO_SCALE,
            },
            "blender": bpy.app.version_string,
        },
        "command": (
            "rtk proxy timeout 3600 env ALSOFT_DRIVERS=null blender -b --factory-startup "
            "--python-exit-code 1 --python "
            "art/glass-adventure/platform-trials/v4/production/"
            "render_ultra4k_v3_comparison.py"
        ),
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print("ULTRA4K_V3_SOURCE_COMPARISON=" + json.dumps(report), flush=True)
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
