"""Finish two review-only V8 conservatory variants from one archived PBR remesh.

The provider normal and a selected-to-active normal baked from the preserved dense
donor are kept as separate variants.  Both variants use the same low mesh, UVs,
dense-donor AO, dimensions, and ground anchor so visual review can choose between
them without conflating geometry or material changes.  This script never installs
or combines a runtime asset.
"""

from __future__ import annotations

from io import BytesIO
import hashlib
import json
import math
from pathlib import Path
import struct

import bmesh
import bpy
from mathutils import Matrix, Vector
import numpy as np
from PIL import Image as PILImage


HERE = Path(__file__).resolve().parent
ART = HERE.parent
SOURCE = ART / "meshy" / "conservatory-remesh-110k-retexture-pbr.glb"
SOURCE_RECEIPT = ART / "meshy" / "conservatory-remesh-110k-retexture-pbr-receipt.json"
REMESH_RECEIPT = ART / "meshy" / "conservatory-remesh-110k-receipt.json"
DENSE_DONOR = ART / "meshy" / "raw" / "conservatory-pre-remesh-v6.glb"
TEXTURE_DIR = ART / "sources" / "conservatory-bake-v8"
BLEND = ART / "sources" / "floating-museum-conservatory-candidate-v8.blend"
MANIFEST = ART / "exports" / "floating-museum-conservatory-candidate-v8.json"
VARIANTS = {
    "meshy": ART / "exports" / "floating-museum-conservatory-candidate-v8-meshy-normal.glb",
    "dense-bake": ART / "exports" / "floating-museum-conservatory-candidate-v8-dense-bake-normal.glb",
}

ROOT_NAME = "map_museum_polish_kit_root"
GROUP_NAME = "map_conservatory"
GEOMETRY_NAME = "map_conservatory_geometry"
MATERIAL_NAME = "map_conservatory_atlas"
TARGET_DIMENSIONS = (2.30, 2.65, 2.30)
MIN_TRIANGLES = 90_000
MAX_TRIANGLES = 125_000
BAKE_SIZE = 2048
BAKE_MARGIN = 24
CAGE_EXTRUSION = 0.012
MAX_RAY_DISTANCE = 0.045
EXPECTED_DENSE_SHA256 = "7f9eefd963e7fdb7b4d9863a4588ad293d3f8a17c27a68fd359306d647b5b6f4"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def digest_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def require_complete_glb(path: Path) -> None:
    if not path.is_file():
        raise FileNotFoundError(f"Required candidate input is absent: {path}")
    raw = path.read_bytes()
    if len(raw) < 28 or raw[:4] != b"glTF" or struct.unpack_from("<I", raw, 8)[0] != len(raw):
        raise ValueError(f"Incomplete GLB at {path}")


def read_glb(path: Path) -> tuple[dict[str, object], bytes]:
    require_complete_glb(path)
    raw = path.read_bytes()
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
        raise ValueError(f"{path.name} BIN length differs from its declaration")
    return document, binary


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
    path.write_bytes(result)


def view_payload(document: dict[str, object], binary: bytes, index: int) -> bytes:
    view = document["bufferViews"][index]
    offset = int(view.get("byteOffset", 0))
    return binary[offset : offset + int(view["byteLength"])]


def texture_source(document: dict[str, object], binding: dict[str, object]) -> int:
    texture = document["textures"][int(binding["index"])]
    if "source" in texture:
        return int(texture["source"])
    for extension in ("EXT_texture_webp", "KHR_texture_basisu"):
        source = texture.get("extensions", {}).get(extension, {}).get("source")
        if source is not None:
            return int(source)
    raise ValueError("PBR texture has no supported image source")


def image_payload(document: dict[str, object], binary: bytes, image_index: int) -> bytes:
    image = document["images"][image_index]
    if "bufferView" not in image:
        raise ValueError("Provider PBR GLB unexpectedly uses an external image")
    return view_payload(document, binary, int(image["bufferView"]))


def source_pbr_maps() -> tuple[dict[str, PILImage.Image], dict[str, object]]:
    document, binary = read_glb(SOURCE)
    materials = document.get("materials", [])
    if len(materials) != 1:
        raise ValueError(f"Expected one provider atlas material, found {len(materials)}")
    material = materials[0]
    pbr = material.get("pbrMetallicRoughness", {})
    bindings = {
        "baseColor": pbr.get("baseColorTexture"),
        "normal": material.get("normalTexture"),
        "metallicRoughness": pbr.get("metallicRoughnessTexture"),
    }
    if any(binding is None for binding in bindings.values()):
        raise ValueError(f"Provider PBR material lacks a core map: {sorted(bindings)}")
    images: dict[str, PILImage.Image] = {}
    report: dict[str, object] = {}
    used_sources: set[int] = set()
    for role, binding in bindings.items():
        image_index = texture_source(document, binding)
        if image_index in used_sources:
            raise ValueError(f"Provider PBR roles unexpectedly share image {image_index}")
        used_sources.add(image_index)
        payload = image_payload(document, binary, image_index)
        opened = PILImage.open(BytesIO(payload)).convert("RGB")
        if min(opened.size) < 1024:
            raise ValueError(f"Provider {role} map is too small: {opened.size}")
        images[role] = opened
        report[role] = {
            "imageIndex": image_index,
            "name": document["images"][image_index].get("name"),
            "mimeType": document["images"][image_index].get("mimeType"),
            "dimensions": list(opened.size),
            "bytes": len(payload),
            "sha256": digest_bytes(payload),
        }
    occlusion = material.get("occlusionTexture")
    report["providerOcclusionBinding"] = (
        None
        if occlusion is None
        else {
            "textureIndex": int(occlusion["index"]),
            "sharesMetallicRoughness": int(occlusion["index"])
            == int(bindings["metallicRoughness"]["index"]),
        }
    )
    return images, report


def validate_receipts() -> dict[str, object]:
    require_complete_glb(SOURCE)
    require_complete_glb(DENSE_DONOR)
    if digest(DENSE_DONOR) != EXPECTED_DENSE_SHA256:
        raise ValueError("Preserved dense donor hash changed")
    if not SOURCE_RECEIPT.is_file() or not REMESH_RECEIPT.is_file():
        raise FileNotFoundError("Archived remesh and retexture receipts are required")
    retexture = json.loads(SOURCE_RECEIPT.read_text())
    remesh = json.loads(REMESH_RECEIPT.read_text())
    source_sha = digest(SOURCE)
    if retexture.get("state") != "archived" or retexture.get("file", {}).get("sha256") != source_sha:
        raise ValueError("PBR source does not match its archived receipt")
    if remesh.get("state") != "archived" or retexture.get("parentTaskId") != remesh.get("taskId"):
        raise ValueError("PBR receipt does not descend from the archived V8 remesh")
    return {
        "remeshTaskId": remesh.get("taskId"),
        "retextureTaskId": retexture.get("taskId"),
        "sourceSha256": source_sha,
        "denseDonorSha256": digest(DENSE_DONOR),
    }


def triangles(mesh: bpy.types.Mesh) -> int:
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)


def topology(mesh: bpy.types.Mesh) -> dict[str, int | bool]:
    copy = mesh.copy()
    invalid = copy.validate(verbose=False, clean_customdata=False)
    bpy.data.meshes.remove(copy)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    result = {
        "vertices": len(bm.verts),
        "triangles": triangles(mesh),
        "boundaryEdges": sum(len(edge.link_faces) == 1 for edge in bm.edges),
        "nonManifoldEdges": sum(len(edge.link_faces) != 2 for edge in bm.edges),
        "looseEdges": sum(not edge.link_faces for edge in bm.edges),
        "zeroAreaFaces": sum(face.calc_area() <= 1e-12 for face in bm.faces),
        "blenderMeshInvalid": bool(invalid),
    }
    bm.free()
    return result


def object_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points = [obj.matrix_world @ vertex.co for obj in objects for vertex in obj.data.vertices]
    if not points:
        raise ValueError("Cannot measure an empty mesh set")
    return (
        Vector(min(point[axis] for point in points) for axis in range(3)),
        Vector(max(point[axis] for point in points) for axis in range(3)),
    )


def transform_mesh_preserving_corner_normals(
    mesh: bpy.types.Mesh, transform: Matrix
) -> None:
    """Apply an affine transform and explicitly preserve inverse-transpose normals.

    Blender 5.2's ``Mesh.transform`` moves vertices correctly but does not apply
    the inverse transpose to stored split normals under non-uniform scale.  Capture
    every corner normal before the position transform, transform it explicitly,
    and restore the result as custom split normals.
    """

    source_normals = [corner.vector.copy() for corner in mesh.corner_normals]
    normal_matrix = transform.inverted().transposed().to_3x3()
    transformed_normals = []
    for normal in source_normals:
        transformed = normal_matrix @ normal
        if transformed.length_squared <= 1e-16:
            raise ValueError("Affine normalization collapsed a corner normal")
        transformed.normalize()
        transformed_normals.append(transformed)
    mesh.transform(transform)
    mesh.normals_split_custom_set(transformed_normals)
    mesh.update()


def normalize_objects(objects: list[bpy.types.Object], label: str) -> dict[str, object]:
    low, high = object_bounds(objects)
    source_dimensions = Vector((high.x - low.x, high.z - low.z, high.y - low.y))
    if min(source_dimensions) <= 0:
        raise ValueError(f"{label} has a zero source dimension")
    target_width, target_height, target_depth = TARGET_DIMENSIONS
    scales = Vector(
        (
            target_width / source_dimensions.x,
            target_depth / source_dimensions.z,
            target_height / source_dimensions.y,
        )
    )
    centre_x = (low.x + high.x) * 0.5
    centre_y = (low.y + high.y) * 0.5
    normalization = Matrix(
        (
            (scales.x, 0.0, 0.0, -centre_x * scales.x),
            (0.0, scales.y, 0.0, -centre_y * scales.y),
            (0.0, 0.0, scales.z, -low.z * scales.z),
            (0.0, 0.0, 0.0, 1.0),
        )
    )
    for obj in objects:
        combined = normalization @ obj.matrix_world
        obj.parent = None
        obj.data = obj.data.copy()
        transform_mesh_preserving_corner_normals(obj.data, combined)
        obj.matrix_world = Matrix.Identity(4)
    final_low, final_high = object_bounds(objects)
    dimensions = [
        final_high.x - final_low.x,
        final_high.z - final_low.z,
        final_high.y - final_low.y,
    ]
    if abs(final_low.z) > 1e-6 or any(
        abs(actual - expected) > 1e-5
        for actual, expected in zip(dimensions, TARGET_DIMENSIONS, strict=True)
    ):
        raise ValueError(f"{label} normalization failed: {dimensions}, ground {final_low.z}")
    return {
        "sourceDimensionsGlTfYUp": list(source_dimensions),
        "scaleBlenderXYZ": list(scales),
        "dimensionsGlTfYUpMetres": dimensions,
        "anchorErrorMetres": abs(final_low.z),
    }


def import_meshes(path: Path) -> tuple[list[bpy.types.Object], list[bpy.types.Object]]:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    meshes = [obj for obj in imported if obj.type == "MESH"]
    if not meshes:
        raise ValueError(f"{path.name} imported no mesh")
    return imported, meshes


def save_png(image: PILImage.Image, path: Path) -> dict[str, object]:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=True)
    return {
        "file": str(path.relative_to(ART)),
        "bytes": path.stat().st_size,
        "sha256": digest(path),
        "dimensions": list(image.size),
    }


def prepare_provider_textures(maps: dict[str, PILImage.Image]) -> dict[str, object]:
    rows = {}
    names = {
        "baseColor": "provider-base-color.png",
        "normal": "provider-normal.png",
        "metallicRoughness": "provider-metallic-roughness.png",
    }
    for role, name in names.items():
        rows[role] = save_png(maps[role], TEXTURE_DIR / name)
    return rows


def bake_image(
    low: bpy.types.Object,
    high: list[bpy.types.Object],
    material: bpy.types.Material,
    name: str,
    bake_type: str,
    path: Path,
) -> dict[str, object]:
    image = bpy.data.images.new(name, width=BAKE_SIZE, height=BAKE_SIZE, alpha=False)
    image.colorspace_settings.name = "Non-Color"
    node = material.node_tree.nodes.new("ShaderNodeTexImage")
    node.name = f"Bake Target {name}"
    node.image = image
    material.node_tree.nodes.active = node
    for obj in bpy.context.selected_objects:
        obj.select_set(False)
    for obj in high:
        obj.hide_render = False
        obj.hide_set(False)
        obj.select_set(True)
    low.select_set(True)
    bpy.context.view_layer.objects.active = low
    bpy.context.scene.render.engine = "CYCLES"
    bpy.context.scene.cycles.device = "CPU"
    settings = bpy.context.scene.render.bake
    settings.use_selected_to_active = True
    settings.use_clear = True
    settings.margin = BAKE_MARGIN
    settings.cage_extrusion = CAGE_EXTRUSION
    settings.max_ray_distance = MAX_RAY_DISTANCE
    if bake_type == "NORMAL":
        settings.normal_space = "TANGENT"
    result = bpy.ops.object.bake(type=bake_type)
    if "FINISHED" not in result:
        raise RuntimeError(f"Blender {bake_type} bake did not finish: {result}")
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.save()
    image.pack()
    material.node_tree.nodes.remove(node)
    for obj in high:
        obj.hide_render = True
        obj.hide_set(True)
    opened = PILImage.open(path).convert("RGB")
    pixels = np.asarray(opened, dtype=np.uint8)
    if opened.size != (BAKE_SIZE, BAKE_SIZE) or int(pixels.max()) == int(pixels.min()):
        raise ValueError(f"{bake_type} bake is blank or has the wrong size")
    return {
        "file": str(path.relative_to(ART)),
        "bytes": path.stat().st_size,
        "sha256": digest(path),
        "dimensions": list(opened.size),
        "channelRange": [int(pixels.min()), int(pixels.max())],
    }


def compare_normals(meshy: PILImage.Image, baked: PILImage.Image) -> dict[str, object]:
    reference = np.asarray(meshy.resize(baked.size, PILImage.Resampling.LANCZOS), dtype=np.float32)
    candidate = np.asarray(baked, dtype=np.float32)
    reference = reference / 127.5 - 1.0
    candidate = candidate / 127.5 - 1.0
    reference /= np.maximum(np.linalg.norm(reference, axis=2, keepdims=True), 1e-6)
    candidate /= np.maximum(np.linalg.norm(candidate, axis=2, keepdims=True), 1e-6)
    cosine = np.clip(np.sum(reference * candidate, axis=2), -1.0, 1.0)
    angles = np.degrees(np.arccos(cosine))
    return {
        "method": "per-texel angular difference after resizing the Meshy normal to the dense-bake resolution",
        "meanDegrees": round(float(angles.mean()), 4),
        "medianDegrees": round(float(np.median(angles)), 4),
        "p95Degrees": round(float(np.percentile(angles, 95)), 4),
        "maximumDegrees": round(float(angles.max()), 4),
        "selection": "none; both variants must be reviewed at the same camera",
    }


def build_derived_maps(
    provider: dict[str, PILImage.Image], ao_path: Path
) -> tuple[dict[str, object], dict[str, PILImage.Image]]:
    ao = PILImage.open(ao_path).convert("L")
    orm_source = provider["metallicRoughness"].resize(ao.size, PILImage.Resampling.LANCZOS)
    orm = np.asarray(orm_source, dtype=np.uint8).copy()
    orm[:, :, 0] = np.asarray(ao, dtype=np.uint8)
    orm_image = PILImage.fromarray(orm, "RGB")
    orm_row = save_png(orm_image, TEXTURE_DIR / "runtime-orm-with-dense-ao.png")

    base = provider["baseColor"].resize((1024, 1024), PILImage.Resampling.LANCZOS)
    pixels = np.asarray(base, dtype=np.float32) / 255.0
    red, green, blue = pixels[:, :, 0], pixels[:, :, 1], pixels[:, :, 2]
    maximum = np.max(pixels, axis=2)
    celadon = (green + blue) * 0.5 - red
    t = np.clip((celadon - 0.005) / (0.08 - 0.005), 0.0, 1.0)
    t = t * t * (3.0 - 2.0 * t)
    light = np.clip((maximum - 0.32) / (0.72 - 0.32), 0.0, 1.0)
    light = light * light * (3.0 - 2.0 * light)
    transmission = np.clip(t * light * 0.42, 0.0, 0.42)
    mask = np.repeat(np.round(transmission * 255).astype(np.uint8)[:, :, None], 3, axis=2)
    transmission_image = PILImage.fromarray(mask, "RGB")
    transmission_row = save_png(transmission_image, TEXTURE_DIR / "runtime-transmission.png")
    return (
        {
            "orm": orm_row,
            "transmission": {
                **transmission_row,
                "method": "V6 celadon texture-space mask applied to the provider PBR base color",
                "range": [float(transmission.min()), float(transmission.max())],
            },
        },
        {"orm": orm_image, "transmission": transmission_image},
    )


def load_runtime_image(path: Path, name: str, color_space: str) -> bpy.types.Image:
    image = bpy.data.images.load(str(path), check_existing=False)
    image.name = name
    image.colorspace_settings.name = color_space
    image.pack()
    return image


def configure_material(material: bpy.types.Material, normal_source: str) -> None:
    paths = {
        "base": TEXTURE_DIR / "provider-base-color.png",
        "normal": (
            TEXTURE_DIR / "dense-donor-normal.png"
            if normal_source == "dense-bake"
            else TEXTURE_DIR / "provider-normal.png"
        ),
        "orm": TEXTURE_DIR / "runtime-orm-with-dense-ao.png",
        "transmission": TEXTURE_DIR / "runtime-transmission.png",
    }
    material.name = MATERIAL_NAME
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.name = "Principled BSDF"
    links = material.node_tree.links

    base_node = nodes.new("ShaderNodeTexImage")
    base_node.name = "Runtime Base Color"
    base_node.image = load_runtime_image(paths["base"], "conservatory-v8-base", "sRGB")
    links.new(base_node.outputs["Color"], shader.inputs["Base Color"])

    orm_node = nodes.new("ShaderNodeTexImage")
    orm_node.name = "Runtime ORM with Dense AO"
    orm_node.image = load_runtime_image(paths["orm"], "conservatory-v8-orm", "Non-Color")
    separate = nodes.new("ShaderNodeSeparateColor")
    links.new(orm_node.outputs["Color"], separate.inputs["Color"])
    links.new(separate.outputs["Green"], shader.inputs["Roughness"])
    links.new(separate.outputs["Blue"], shader.inputs["Metallic"])

    normal_node = nodes.new("ShaderNodeTexImage")
    normal_node.name = f"Runtime Normal ({normal_source})"
    normal_node.image = load_runtime_image(paths["normal"], f"conservatory-v8-normal-{normal_source}", "Non-Color")
    normal_map = nodes.new("ShaderNodeNormalMap")
    links.new(normal_node.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], shader.inputs["Normal"])

    transmission_node = nodes.new("ShaderNodeTexImage")
    transmission_node.name = "Runtime Celadon Transmission"
    transmission_node.image = load_runtime_image(paths["transmission"], "conservatory-v8-transmission", "Non-Color")
    links.new(transmission_node.outputs["Color"], shader.inputs["Transmission Weight"])
    shader.inputs["IOR"].default_value = 1.45
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    material.diffuse_color = (0.72, 0.70, 0.65, 1.0)
    material["normalSource"] = normal_source


def descendants(root: bpy.types.Object) -> list[bpy.types.Object]:
    result: list[bpy.types.Object] = []
    pending = list(root.children)
    while pending:
        current = pending.pop()
        result.append(current)
        pending.extend(current.children)
    return result


def patch_occlusion_binding(path: Path) -> None:
    document, binary = read_glb(path)
    if len(document.get("materials", [])) != 1:
        raise ValueError("Review export unexpectedly has more than one material")
    material = document["materials"][0]
    metallic_roughness = material.get("pbrMetallicRoughness", {}).get("metallicRoughnessTexture")
    if metallic_roughness is None:
        raise ValueError("Review export lost metallic-roughness")
    material["occlusionTexture"] = {
        "index": int(metallic_roughness["index"]),
        "strength": 1,
    }
    write_glb(path, document, binary)


def validate_export(path: Path, expected_triangles: int) -> dict[str, object]:
    document, binary = read_glb(path)
    node_indices = [
        index for index, node in enumerate(document.get("nodes", []))
        if node.get("name") == GEOMETRY_NAME
    ]
    if len(node_indices) != 1:
        raise ValueError(f"Fresh export lost {GEOMETRY_NAME}")
    mesh = document["meshes"][int(document["nodes"][node_indices[0]]["mesh"])]
    if len(mesh.get("primitives", [])) != 1:
        raise ValueError("Candidate export must retain one primitive")
    primitive = mesh["primitives"][0]
    attributes = primitive.get("attributes", {})
    required = {"POSITION", "NORMAL", "TANGENT", "TEXCOORD_0"}
    if missing := sorted(required - set(attributes)):
        raise ValueError(f"Candidate export lost vertex attributes: {missing}")
    position = document["accessors"][int(attributes["POSITION"])]
    low = position.get("min")
    high = position.get("max")
    dimensions = [high[0] - low[0], high[1] - low[1], high[2] - low[2]]
    if abs(low[1]) > 1e-5 or any(
        abs(actual - expected) > 1e-4
        for actual, expected in zip(dimensions, TARGET_DIMENSIONS, strict=True)
    ):
        raise ValueError(f"Candidate export dimensions/anchor failed: {dimensions}, {low}")
    count = int(document["accessors"][int(primitive["indices"])]["count"]) // 3
    if count != expected_triangles:
        raise ValueError(f"Candidate export changed triangle count: {count} != {expected_triangles}")
    material = document["materials"][int(primitive["material"])]
    pbr = material.get("pbrMetallicRoughness", {})
    transmission = material.get("extensions", {}).get("KHR_materials_transmission")
    bindings = {
        "baseColor": pbr.get("baseColorTexture"),
        "normal": material.get("normalTexture"),
        "metallicRoughness": pbr.get("metallicRoughnessTexture"),
        "occlusion": material.get("occlusionTexture"),
        "transmission": None if transmission is None else transmission.get("transmissionTexture"),
    }
    if any(binding is None for binding in bindings.values()):
        raise ValueError(f"Candidate export lost a runtime material binding: {bindings}")
    image_rows = {}
    for role, binding in bindings.items():
        index = texture_source(document, binding)
        payload = image_payload(document, binary, index)
        opened = PILImage.open(BytesIO(payload))
        image_rows[role] = {
            "imageIndex": index,
            "dimensions": list(opened.size),
            "bytes": len(payload),
            "sha256": digest_bytes(payload),
        }
    if bindings["occlusion"]["index"] != bindings["metallicRoughness"]["index"]:
        raise ValueError("Dense AO is not channel-packed with metallic-roughness")
    return {
        "file": str(path.relative_to(ART)),
        "bytes": path.stat().st_size,
        "sha256": digest(path),
        "triangles": count,
        "dimensionsGlTfYUpMetres": dimensions,
        "anchorErrorMetres": abs(low[1]),
        "attributes": sorted(attributes),
        "materialBindings": bindings,
        "images": image_rows,
        "extensionsUsed": document.get("extensionsUsed", []),
        "normalUvTangentPbrPassed": True,
    }


def export_variant(normal_source: str, material: bpy.types.Material, expected_triangles: int) -> dict[str, object]:
    bpy.ops.wm.open_mainfile(filepath=str(BLEND), load_ui=False)
    root = bpy.data.objects.get(ROOT_NAME)
    low = bpy.data.objects.get(GEOMETRY_NAME)
    material = bpy.data.materials.get(MATERIAL_NAME)
    if root is None or low is None or material is None:
        raise ValueError("Packed candidate source lost its stable authoring records")
    configure_material(material, normal_source)
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for obj in descendants(root):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    path = VARIANTS[normal_source]
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_materials="EXPORT",
        export_normals=True,
        export_tangents=True,
    )
    patch_occlusion_binding(path)
    return validate_export(path, expected_triangles)


def main() -> None:
    receipt_context = validate_receipts()
    provider_maps, provider_report = source_pbr_maps()
    provider_files = prepare_provider_textures(provider_maps)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "METERS"
    imported_low, low_meshes = import_meshes(SOURCE)
    if len(low_meshes) != 1:
        raise ValueError(f"Selected-to-active bake requires one low mesh, found {len(low_meshes)}")
    low = low_meshes[0]
    low_topology = topology(low.data)
    if not MIN_TRIANGLES <= int(low_topology["triangles"]) <= MAX_TRIANGLES:
        raise ValueError(f"PBR candidate missed the ~110k triangle gate: {low_topology}")
    if low.data.uv_layers.active is None:
        raise ValueError("PBR candidate has no UV0 for the high-to-low bake")
    low_normalization = normalize_objects(low_meshes, "PBR candidate")
    for obj in imported_low:
        if obj is not low:
            bpy.data.objects.remove(obj, do_unlink=True)

    imported_high, high_meshes = import_meshes(DENSE_DONOR)
    high_topology = {obj.name: topology(obj.data) for obj in high_meshes}
    high_normalization = normalize_objects(high_meshes, "dense donor")
    for obj in imported_high:
        if obj not in high_meshes:
            bpy.data.objects.remove(obj, do_unlink=True)
    for index, obj in enumerate(high_meshes):
        obj.name = f"bake_high_conservatory_{index:02d}"
        obj.data.materials.clear()

    for material in list(bpy.data.materials):
        bpy.data.materials.remove(material, do_unlink=True)
    material = bpy.data.materials.new(MATERIAL_NAME)
    material.use_nodes = True
    low.data.materials.append(material)
    baked_normal = bake_image(
        low,
        high_meshes,
        material,
        "dense-donor-normal",
        "NORMAL",
        TEXTURE_DIR / "dense-donor-normal.png",
    )
    baked_ao = bake_image(
        low,
        high_meshes,
        material,
        "dense-donor-ao",
        "AO",
        TEXTURE_DIR / "dense-donor-ao.png",
    )
    normal_comparison = compare_normals(
        provider_maps["normal"],
        PILImage.open(TEXTURE_DIR / "dense-donor-normal.png").convert("RGB"),
    )
    derived_report, _derived_images = build_derived_maps(
        provider_maps, TEXTURE_DIR / "dense-donor-ao.png"
    )

    root = bpy.data.objects.new(ROOT_NAME, None)
    bpy.context.scene.collection.objects.link(root)
    root["assetId"] = "floating-museum-conservatory-candidate-v8"
    root["status"] = "review-only"
    group = bpy.data.objects.new(GROUP_NAME, None)
    bpy.context.scene.collection.objects.link(group)
    group.parent = root
    group["assetId"] = "floating-museum-conservatory-v8"
    group["anchor"] = "ground/bottom Y=0"
    group["front"] = "exported glTF +Z (Blender -Y)"
    low.name = GEOMETRY_NAME
    low.data.name = GEOMETRY_NAME + "_mesh"
    low["role"] = "map-landmark"
    low.parent = group
    for obj in high_meshes:
        obj.hide_render = True
        obj.hide_set(True)
    configure_material(material, "dense-bake")

    bpy.ops.file.pack_all()
    missing = sorted(
        image.filepath for image in bpy.data.images
        if image.source != "GENERATED" and image.packed_file is None
    )
    if missing:
        raise ValueError(f"Packed candidate source retains external images: {missing}")
    BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND), compress=True, check_existing=False)
    packed = {
        "file": str(BLEND.relative_to(ART)),
        "bytes": BLEND.stat().st_size,
        "sha256": digest(BLEND),
        "imagesPacked": True,
        "denseDonorRetained": True,
        "missingExternalFiles": missing,
    }

    variants = {
        name: export_variant(name, material, int(low_topology["triangles"]))
        for name in ("meshy", "dense-bake")
    }
    manifest = {
        "schema": 1,
        "assetId": "floating-museum-conservatory-candidate-v8",
        "status": "review-only; normal-map choice and runtime integration pending",
        "coordinates": "Blender Z-up authoring; exported glTF +Y up; metres",
        "source": {
            "file": str(SOURCE.relative_to(ART)),
            "bytes": SOURCE.stat().st_size,
            "sha256": digest(SOURCE),
            "receipt": str(SOURCE_RECEIPT.relative_to(ART)),
            "receiptContext": receipt_context,
            "providerPbr": provider_report,
            "providerTextureFiles": provider_files,
            "topology": low_topology,
        },
        "denseDonor": {
            "file": str(DENSE_DONOR.relative_to(ART)),
            "bytes": DENSE_DONOR.stat().st_size,
            "sha256": digest(DENSE_DONOR),
            "topology": high_topology,
        },
        "boundingBoxNormalization": {
            "candidate": low_normalization,
            "denseDonor": high_normalization,
            "sameTargetBoundsAndGroundAnchor": True,
            "surfaceRegistration": (
                "unverified; equal bounding boxes do not prove remeshed surface correspondence"
            ),
            "requiredReview": (
                "inspect donor/low overlap, ray misses, cage coverage, and bake artifacts before "
                "choosing either normal variant"
            ),
        },
        "selectedToActiveBake": {
            "engine": "Cycles CPU",
            "resolution": [BAKE_SIZE, BAKE_SIZE],
            "marginPixels": BAKE_MARGIN,
            "cageExtrusionMetres": CAGE_EXTRUSION,
            "maximumRayDistanceMetres": MAX_RAY_DISTANCE,
            "normal": baked_normal,
            "ambientOcclusion": baked_ao,
            "derivedRuntimeMaps": derived_report,
            "normalComparison": normal_comparison,
            "normalSelection": "pending same-camera visual review",
            "surfaceRegistration": "pending donor/low overlap review",
            "cageAndBakeCoverage": "pending visual review",
        },
        "packedBlend": packed,
        "variants": variants,
        "validation": {
            "archivedProviderReceiptsMatched": True,
            "preservedDenseDonorMatched": True,
            "candidateAndDonorBoundingBoxesNormalized": True,
            "surfaceRegistration": "pending visual review",
            "cageAndBakeCoverage": "pending visual review",
            "providerNormalRetainedSeparately": True,
            "denseBakeNormalRetainedSeparately": True,
            "denseBakeAoChannelPacked": True,
            "packedEditableSource": True,
            "dimensionsAndGroundAnchorPassed": True,
            "uv0NormalAndTangentPassed": True,
            "pbrBindingsPassed": True,
            "visualApproval": "pending",
            "runtimeIntegration": "not performed",
        },
        "rebuild": {
            "workingDirectory": "repository root",
            "command": (
                "rtk proxy timeout 3600 env ALSOFT_DRIVERS=null blender -b --factory-startup "
                "--python-exit-code 1 --python "
                "art/glass-adventure/journey-map/v8/production/finish_conservatory_candidate.py"
            ),
            "blender": bpy.app.version_string,
        },
        "proofs": [],
    }
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(
        "CONSERVATORY_V8_CANDIDATES_BUILT="
        + json.dumps(
            {
                "triangles": low_topology["triangles"],
                "packedBlendSha256": packed["sha256"],
                "variants": {name: row["sha256"] for name, row in variants.items()},
                "normalSelection": "pending-review",
            }
        ),
        flush=True,
    )
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
