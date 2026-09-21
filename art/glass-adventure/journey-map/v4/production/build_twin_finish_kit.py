"""Build the V4 twin-temple finish kit from accepted packed museum donors."""

from __future__ import annotations

from io import BytesIO
import hashlib
import json
import math
from pathlib import Path
import shutil
import struct

import bmesh
import bpy
from mathutils import Matrix, Vector
import numpy as np
from PIL import Image as PILImage


HERE = Path(__file__).resolve().parent
ART = HERE.parent
REPO = HERE.parents[4]
V3_ART = REPO / "art" / "glass-adventure" / "journey-map" / "v3"
V2_ART = REPO / "art" / "glass-adventure" / "journey-map" / "v2"
V3_BLEND = V3_ART / "sources" / "floating-museum-sculpture-kit-v3.blend"
V3_MANIFEST = V3_ART / "exports" / "floating-museum-sculpture-kit-v3.json"
V1_KIT_GLB = V2_ART / "exports" / "floating-museum-map-kit-v1.glb"
V1_KIT_MANIFEST = V2_ART / "exports" / "floating-museum-map-kit-v1.json"
KIT_BLEND = ART / "sources" / "floating-museum-twin-finish-kit-v4.blend"
KIT_GLB = ART / "exports" / "floating-museum-twin-finish-kit-v4.glb"
MANIFEST = ART / "exports" / "floating-museum-twin-finish-kit-v4.json"
PUBLIC_DIR = REPO / "apps" / "beside-cue" / "public" / "games" / "journey-map-v4"
PUBLIC_GLB = PUBLIC_DIR / KIT_GLB.name
PUBLIC_MANIFEST = PUBLIC_DIR / "manifest.json"
TEXTURE_DIR = ART / "sources" / "textures"

ROOT_NAME = "map_twin_finish_kit_root"
DOME_FACE_Z = 1.65
TEMPLE_VARIANTS = {
    "amber": np.array([1.0, 0.57, 0.20], dtype=np.float32),
    "teal": np.array([0.10, 0.68, 0.64], dtype=np.float32),
}
REQUIRED_NODES = {
    ROOT_NAME,
    "map_temple_amber",
    "map_temple_amber_structure",
    "map_temple_amber_dome",
    "map_temple_teal",
    "map_temple_teal_structure",
    "map_temple_teal_dome",
    "map_cliff",
    "map_cliff_geometry",
    "map_cypress",
    "map_cypress_geometry",
    "map_flower_cluster",
    "map_flower_cluster_bloom_a",
    "map_flower_cluster_bloom_b",
    "map_flower_cluster_bloom_c",
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def triangles(mesh: bpy.types.Mesh) -> int:
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)


def descendants(root: bpy.types.Object) -> list[bpy.types.Object]:
    result: list[bpy.types.Object] = []
    pending = list(root.children)
    while pending:
        item = pending.pop()
        result.append(item)
        pending.extend(item.children)
    return result


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
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    low = Vector(min(point[axis] for point in points) for axis in range(3))
    high = Vector(max(point[axis] for point in points) for axis in range(3))
    return low, high


def material_images(materials: list[bpy.types.Material]) -> set[bpy.types.Image]:
    images: set[bpy.types.Image] = set()
    for material in materials:
        if not material.use_nodes:
            continue
        for node in material.node_tree.nodes:
            if node.type == "TEX_IMAGE" and node.image is not None:
                images.add(node.image)
    return images


def upstream_images(
    socket: bpy.types.NodeSocket,
    visited: set[int] | None = None,
) -> set[bpy.types.Image]:
    if visited is None:
        visited = set()
    result: set[bpy.types.Image] = set()
    for link in socket.links:
        node = link.from_node
        pointer = node.as_pointer()
        if pointer in visited:
            continue
        visited.add(pointer)
        if node.type == "TEX_IMAGE" and node.image is not None:
            result.add(node.image)
            continue
        for node_input in node.inputs:
            if node_input.is_linked:
                result.update(upstream_images(node_input, visited))
    return result


def material_image_roles(material: bpy.types.Material) -> dict[bpy.types.Image, list[str]]:
    shader = material.node_tree.nodes.get("Principled BSDF")
    if shader is None:
        raise ValueError(f"{material.name} lost its Principled BSDF")
    roles: dict[bpy.types.Image, set[str]] = {}
    for role, socket_name in (
        ("baseColor", "Base Color"),
        ("metallicRoughness", "Metallic"),
        ("metallicRoughness", "Roughness"),
        ("normal", "Normal"),
        ("emissive", "Emission Color"),
    ):
        socket = shader.inputs.get(socket_name)
        if socket is None:
            continue
        for image in upstream_images(socket):
            roles.setdefault(image, set()).add(role)
    return {image: sorted(values) for image, values in roles.items()}


def image_rows(images: set[bpy.types.Image]) -> list[dict[str, object]]:
    return [
        {
            "name": image.name,
            "dimensions": [int(image.size[0]), int(image.size[1])],
            "colorSpace": image.colorspace_settings.name,
            "packed": image.packed_file is not None,
        }
        for image in sorted(images, key=lambda item: item.name)
    ]


def packed_pil(image: bpy.types.Image) -> PILImage.Image:
    if image.packed_file is None:
        raise ValueError(f"{image.name} is not packed")
    return PILImage.open(BytesIO(bytes(image.packed_file.data))).convert("RGB")


def recolor_celadon(source: PILImage.Image, target: np.ndarray) -> PILImage.Image:
    """Shift cool glass pixels while leaving neutral stone and warm gold intact."""

    pixels = np.asarray(source, dtype=np.float32) / 255.0
    red, green, blue = pixels[..., 0], pixels[..., 1], pixels[..., 2]
    maximum = pixels.max(axis=2)
    minimum = pixels.min(axis=2)
    chroma = maximum - minimum
    coolness = (green + blue) * 0.5 - red
    cool_mask = np.clip((coolness - 0.005) / 0.09, 0.0, 1.0)
    chroma_mask = np.clip((chroma - 0.025) / 0.10, 0.0, 1.0)
    brightness_mask = np.clip((maximum - 0.10) / 0.45, 0.0, 1.0)
    gold = (red > green * 1.04) & (green > blue * 1.12) & (chroma > 0.08)
    mask = cool_mask * chroma_mask * brightness_mask * (~gold)
    luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722
    target_luminance = float(target @ np.array([0.2126, 0.7152, 0.0722]))
    tinted = target[None, None, :] * (luminance[..., None] / target_luminance)
    tinted = np.clip(tinted, 0.0, 1.0)
    blend = (mask * 0.90)[..., None]
    result = pixels * (1.0 - blend) + tinted * blend
    return PILImage.fromarray(np.round(np.clip(result, 0.0, 1.0) * 255).astype(np.uint8), "RGB")


def save_variant_image(
    source: bpy.types.Image,
    variant: str,
    target: np.ndarray,
) -> tuple[bpy.types.Image, dict[str, object]]:
    TEXTURE_DIR.mkdir(parents=True, exist_ok=True)
    path = TEXTURE_DIR / f"temple-dome-{variant}-base-2k.png"
    recolor_celadon(packed_pil(source), target).save(path, format="PNG", optimize=True)
    image = bpy.data.images.load(str(path), check_existing=False)
    image.name = f"map_temple_dome_{variant}_base"
    image.colorspace_settings.name = "sRGB"
    image.pack()
    return image, {
        "file": str(path.relative_to(ART)),
        "bytes": path.stat().st_size,
        "sha256": digest(path),
        "dimensions": list(PILImage.open(path).size),
        "method": "Cool-celadon pixel mask shifted to target hue; neutral ivory and warm gold pixels protected.",
    }


def linked_image(material: bpy.types.Material, input_name: str) -> bpy.types.Image:
    shader = material.node_tree.nodes.get("Principled BSDF")
    if shader is None:
        raise ValueError(f"{material.name} has no Principled BSDF")
    images = upstream_images(shader.inputs[input_name])
    if len(images) != 1:
        raise ValueError(f"{material.name} expected one image for {input_name}, got {len(images)}")
    return next(iter(images))


def dome_material(
    source: bpy.types.Material,
    variant: str,
    base_image: bpy.types.Image,
) -> bpy.types.Material:
    result = source.copy()
    result.name = f"map_temple_dome_{variant}_atlas"
    donor_base = linked_image(result, "Base Color")
    for node in result.node_tree.nodes:
        if node.type == "TEX_IMAGE" and node.image == donor_base:
            node.image = base_image
    return result


def subset_mesh(
    source: bpy.types.Mesh,
    name: str,
    keep_dome: bool,
) -> bpy.types.Mesh:
    mesh = source.copy()
    mesh.name = name
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.faces.ensure_lookup_table()
    rejected = []
    for face in bm.faces:
        centre_z = sum(vertex.co.z for vertex in face.verts) / len(face.verts)
        is_dome = centre_z >= DOME_FACE_Z
        if is_dome != keep_dome:
            rejected.append(face)
    bmesh.ops.delete(bm, geom=rejected, context="FACES")
    loose_vertices = [vertex for vertex in bm.verts if not vertex.link_faces]
    if loose_vertices:
        bmesh.ops.delete(bm, geom=loose_vertices, context="VERTS")
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return mesh


def add_empty(name: str, parent: bpy.types.Object | None = None) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    return obj


def add_mesh_object(
    name: str,
    mesh: bpy.types.Mesh,
    parent: bpy.types.Object,
) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    return obj


def clear_objects() -> None:
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)


def import_flower_mesh() -> tuple[bpy.types.Mesh, dict[str, object]]:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(V1_KIT_GLB))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    planter = bpy.data.objects.get("map_planter")
    if planter is None:
        raise ValueError("Accepted V1 kit lost map_planter")
    meshes = ([planter] if planter.type == "MESH" else []) + [
        obj for obj in descendants(planter) if obj.type == "MESH"
    ]
    if len(meshes) != 1:
        raise ValueError(f"Accepted V1 map_planter expected one mesh, got {len(meshes)}")
    source = meshes[0]
    mesh = source.data.copy()
    mesh.name = "map_flower_cluster_shared_mesh"
    mesh.transform(planter.matrix_world.inverted() @ source.matrix_world)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    receipt = {
        "sourceNode": "map_planter",
        "sourceMesh": source.name,
        "storedTriangles": triangles(mesh),
        "materialSlots": [material.name for material in mesh.materials if material],
        "topology": topology(mesh),
    }
    for obj in imported:
        bpy.data.objects.remove(obj, do_unlink=True)
    return mesh, receipt


def create_flower_cluster(root: bpy.types.Object, mesh: bpy.types.Mesh) -> dict[str, object]:
    group = add_empty("map_flower_cluster", root)
    group["anchor"] = "ground/bottom Y=0"
    transforms = (
        ("a", (-0.26, -0.02, 0.0), 0.15, 0.34),
        ("b", (0.05, 0.18, 0.0), -0.55, 0.29),
        ("c", (0.28, -0.12, 0.0), 0.70, 0.32),
    )
    children = []
    for suffix, location, rotation, scale in transforms:
        obj = add_mesh_object(f"map_flower_cluster_bloom_{suffix}", mesh, group)
        obj.location = location
        obj.rotation_euler.z = rotation
        obj.scale = (scale, scale, scale)
        children.append(obj)
    bpy.context.view_layer.update()
    low, high = object_bounds(children)
    centre = Vector(((low.x + high.x) * 0.5, (low.y + high.y) * 0.5, low.z))
    for obj in children:
        obj.location -= centre
    bpy.context.view_layer.update()
    low, high = object_bounds(children)
    return {
        "children": [obj.name for obj in children],
        "storedTriangles": triangles(mesh),
        "renderedTriangles": triangles(mesh) * len(children),
        "boundsBlenderZUpMetres": {"min": list(low), "max": list(high)},
        "dimensionsGlTfYUpMetres": [high.x - low.x, high.z - low.z, high.y - low.y],
        "anchorErrorMetres": abs(low.z),
    }


def configure_runtime_images(root: bpy.types.Object) -> list[dict[str, object]]:
    materials = [
        material
        for obj in descendants(root)
        if obj.type == "MESH"
        for material in obj.data.materials
        if material is not None
    ]
    roles: dict[bpy.types.Image, set[str]] = {}
    for material in set(materials):
        for image, image_roles in material_image_roles(material).items():
            roles.setdefault(image, set()).update(image_roles)
    rows = []
    for image in sorted(roles, key=lambda item: item.name):
        image_roles = sorted(roles[image])
        if image.name.startswith("map_cypress_"):
            limit = 256 if "normal" in image_roles else 512
        elif image.name.startswith("map_planter_"):
            limit = 512
        else:
            limit = 512 if "normal" in image_roles else 1024
        if max(image.size) > limit:
            image.scale(limit, limit)
        image.pack()
        rows.append(
            {
                "name": image.name,
                "roles": image_roles,
                "dimensions": [int(image.size[0]), int(image.size[1])],
                "limit": limit,
            }
        )
    return rows


def compress_glb_images(path: Path) -> dict[str, object]:
    raw = path.read_bytes()
    json_length, json_type = struct.unpack_from("<II", raw, 12)
    if json_type != 0x4E4F534A:
        raise ValueError("Runtime GLB has no JSON chunk")
    document = json.loads(raw[20 : 20 + json_length].decode("utf-8").rstrip(" \x00"))
    binary_header = 20 + json_length
    binary_length, binary_type = struct.unpack_from("<II", raw, binary_header)
    if binary_type != 0x004E4942:
        raise ValueError("Runtime GLB has no BIN chunk")
    binary = raw[binary_header + 8 : binary_header + 8 + binary_length]
    image_roles: dict[int, set[str]] = {}
    textures = document.get("textures", [])
    for material in document.get("materials", []):
        pbr = material.get("pbrMetallicRoughness", {})
        for role, texture_record in (
            ("baseColor", pbr.get("baseColorTexture")),
            ("metallicRoughness", pbr.get("metallicRoughnessTexture")),
            ("emissive", material.get("emissiveTexture")),
            ("normal", material.get("normalTexture")),
        ):
            if texture_record is None:
                continue
            image_index = textures[texture_record["index"]]["source"]
            image_roles.setdefault(image_index, set()).add(role)
    replacements: dict[int, bytes] = {}
    image_rows_out = []
    for image_index, image in enumerate(document.get("images", [])):
        view_index = image["bufferView"]
        view = document["bufferViews"][view_index]
        offset = int(view.get("byteOffset", 0))
        source = binary[offset : offset + int(view["byteLength"])]
        roles = sorted(image_roles.get(image_index, set()))
        opened_source = PILImage.open(BytesIO(source))
        dimensions = list(opened_source.size)
        convert = bool(set(roles) & {"baseColor", "metallicRoughness", "emissive"}) and "normal" not in roles
        output = source
        if convert:
            encoded = BytesIO()
            quality = 78 if "metallicRoughness" in roles else 84
            opened_source.convert("RGB").save(
                encoded,
                format="JPEG",
                quality=quality,
                optimize=True,
                subsampling=0 if "metallicRoughness" in roles else 1,
            )
            output = encoded.getvalue()
            image["mimeType"] = "image/jpeg"
        replacements[view_index] = output
        image_rows_out.append(
            {
                "name": image.get("name"),
                "roles": roles,
                "mimeType": image.get("mimeType"),
                "encodedDimensions": dimensions,
                "sourceBytes": len(source),
                "runtimeBytes": len(output),
            }
        )
    rebuilt = bytearray()
    views = document.get("bufferViews", [])
    for view_index in sorted(range(len(views)), key=lambda index: int(views[index].get("byteOffset", 0))):
        while len(rebuilt) % 4:
            rebuilt.append(0)
        view = views[view_index]
        old_offset = int(view.get("byteOffset", 0))
        payload = replacements.get(view_index, binary[old_offset : old_offset + int(view["byteLength"])])
        view["byteOffset"] = len(rebuilt)
        view["byteLength"] = len(payload)
        rebuilt.extend(payload)
    while len(rebuilt) % 4:
        rebuilt.append(0)
    document["buffers"][0]["byteLength"] = len(rebuilt)
    encoded_json = json.dumps(document, separators=(",", ":")).encode("utf-8")
    encoded_json += b" " * ((-len(encoded_json)) % 4)
    result = bytearray(struct.pack("<III", 0x46546C67, 2, 0))
    result.extend(struct.pack("<II", len(encoded_json), 0x4E4F534A))
    result.extend(encoded_json)
    result.extend(struct.pack("<II", len(rebuilt), 0x004E4942))
    result.extend(rebuilt)
    struct.pack_into("<I", result, 8, len(result))
    path.write_bytes(result)
    return {
        "method": "JPEG quality 84 for color/emissive, 78 with 4:4:4 sampling for packed metallic-roughness; PNG normals retained",
        "sourceBytes": len(raw),
        "runtimeBytes": len(result),
        "images": image_rows_out,
    }


def glb_structure(path: Path) -> dict[str, object]:
    raw = path.read_bytes()
    if raw[:4] != b"glTF" or struct.unpack_from("<I", raw, 8)[0] != len(raw):
        raise ValueError("Incomplete V4 finish-kit GLB")
    chunk_length, chunk_type = struct.unpack_from("<II", raw, 12)
    if chunk_type != 0x4E4F534A:
        raise ValueError("V4 finish-kit GLB has no JSON chunk")
    document = json.loads(raw[20 : 20 + chunk_length].decode("utf-8").rstrip(" \x00"))
    names = {node.get("name") for node in document.get("nodes", [])}
    if missing := sorted(REQUIRED_NODES - names):
        raise ValueError(f"V4 finish-kit GLB missing named nodes: {missing}")
    return {
        "file": str(path.relative_to(ART)),
        "bytes": len(raw),
        "sha256": digest(path),
        "nodes": len(document.get("nodes", [])),
        "meshes": len(document.get("meshes", [])),
        "primitives": sum(len(mesh.get("primitives", [])) for mesh in document.get("meshes", [])),
        "materials": len(document.get("materials", [])),
        "images": len(document.get("images", [])),
        "textures": len(document.get("textures", [])),
        "requiredNamedNodesPresent": True,
        "extensionsUsed": document.get("extensionsUsed", []),
    }


def fresh_reimport(expected_temple_dimensions: list[float]) -> dict[str, object]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(KIT_GLB))
    root = bpy.data.objects.get(ROOT_NAME)
    if root is None:
        raise ValueError(f"Fresh import lost {ROOT_NAME}")
    specs = {
        "map_temple_amber": {"anchor": "bottom", "triangles": 10_000, "children": 2},
        "map_temple_teal": {"anchor": "bottom", "triangles": 10_000, "children": 2},
        "map_cliff": {"anchor": "top", "triangles": 8_000, "children": 1},
        "map_cypress": {"anchor": "bottom", "triangles": 1_200, "children": 1},
        "map_flower_cluster": {"anchor": "bottom", "triangles": 5_400, "children": 3},
    }
    rows: dict[str, object] = {}
    for node_name, spec in specs.items():
        node = bpy.data.objects.get(node_name)
        if node is None or node.parent != root:
            raise ValueError(f"Fresh import lost hierarchy for {node_name}")
        meshes = [obj for obj in descendants(node) if obj.type == "MESH"]
        if len(meshes) != spec["children"]:
            raise ValueError(f"{node_name} expected {spec['children']} mesh children, got {len(meshes)}")
        low, high = object_bounds(meshes)
        anchor_error = abs(low.z) if spec["anchor"] == "bottom" else abs(high.z)
        if anchor_error > 1e-5:
            raise ValueError(f"Fresh import anchor failed for {node_name}: {anchor_error}")
        tri_count = sum(triangles(obj.data) for obj in meshes)
        if abs(tri_count - int(spec["triangles"])) > 32:
            raise ValueError(f"Fresh import triangle budget failed for {node_name}: {tri_count}")
        if any(obj.data.uv_layers.active is None for obj in meshes):
            raise ValueError(f"Fresh import lost UV0 for {node_name}")
        dimensions = [high.x - low.x, high.z - low.z, high.y - low.y]
        if node_name.startswith("map_temple_") and any(
            abs(actual - expected) > 1e-4 for actual, expected in zip(dimensions, expected_temple_dimensions)
        ):
            raise ValueError(f"{node_name} changed the accepted V3 temple bounds: {dimensions}")
        materials = sorted(
            {
                material.name
                for obj in meshes
                for material in obj.data.materials
                if material is not None
            }
        )
        rows[node_name] = {
            "meshChildren": [obj.name for obj in meshes],
            "trianglesRendered": tri_count,
            "uniqueMeshDatablocks": len({obj.data.as_pointer() for obj in meshes}),
            "boundsBlenderZUpMetres": {"min": list(low), "max": list(high)},
            "dimensionsGlTfYUpMetres": dimensions,
            "anchorErrorMetres": anchor_error,
            "materials": materials,
            "uv0Present": True,
            "topology": {obj.name: topology(obj.data) for obj in meshes},
        }
    return {
        "root": root.name,
        "coordinates": "Fresh GLB reimport into Blender Z-up; dimensions listed in glTF X/Y/Z order.",
        "nodes": rows,
    }


def public_manifest(structure: dict[str, object]) -> None:
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(KIT_GLB, PUBLIC_GLB)
    if digest(PUBLIC_GLB) != structure["sha256"]:
        raise ValueError("Public V4 GLB does not match validated source export")
    data = {
        "version": 1,
        "description": "Twin Gallery amber/teal temple variants, accepted cliff and cypress, and reusable crystal-flower cluster for the live Floating Museum map.",
        "assets": [
            {
                "id": "floating-museum-twin-finish-kit-v4",
                "file": PUBLIC_GLB.name,
                "source": str(KIT_GLB.relative_to(REPO)),
                "sourceReceipt": str(MANIFEST.relative_to(REPO)),
                "sha256": structure["sha256"],
                "bytes": structure["bytes"],
                "root": ROOT_NAME,
                "nodes": [
                    "map_temple_amber",
                    "map_temple_teal",
                    "map_cliff",
                    "map_cypress",
                    "map_flower_cluster",
                ],
            }
        ],
    }
    PUBLIC_MANIFEST.write_text(json.dumps(data, indent=2) + "\n")


def main() -> None:
    v3_manifest = json.loads(V3_MANIFEST.read_text())
    v1_manifest = json.loads(V1_KIT_MANIFEST.read_text())
    if digest(V3_BLEND) != v3_manifest["packedBlend"]["sha256"]:
        raise ValueError("Accepted V3 packed source hash changed")
    if digest(V1_KIT_GLB) != v1_manifest["glb"]["sha256"]:
        raise ValueError("Accepted V1 planter-kit source hash changed")
    expected_temple_dimensions = v3_manifest["freshReimport"]["nodes"]["map_temple"]["dimensionsGlTfYUpMetres"]

    bpy.ops.wm.open_mainfile(filepath=str(V3_BLEND))
    source_temple = bpy.data.objects.get("map_temple_geometry")
    source_cliff = bpy.data.objects.get("map_cliff_geometry")
    source_cypress = bpy.data.objects.get("map_cypress_geometry")
    if source_temple is None or source_cliff is None or source_cypress is None:
        raise ValueError("Accepted V3 packed source lost required geometry")
    temple_source_mesh = source_temple.data
    cliff_mesh = source_cliff.data.copy()
    cliff_mesh.name = "map_cliff_geometry_mesh_v4"
    cypress_mesh = source_cypress.data.copy()
    cypress_mesh.name = "map_cypress_geometry_mesh_v4"
    source_material = temple_source_mesh.materials[0]
    donor_base = linked_image(source_material, "Base Color")
    structure_material = source_material.copy()
    structure_material.name = "map_temple_structure_atlas"
    structure_mesh = subset_mesh(temple_source_mesh, "map_temple_structure_mesh", keep_dome=False)
    structure_mesh.materials.clear()
    structure_mesh.materials.append(structure_material)
    variant_images: dict[str, dict[str, object]] = {}
    variant_meshes: dict[str, bpy.types.Mesh] = {}
    for variant, target in TEMPLE_VARIANTS.items():
        image, image_receipt = save_variant_image(donor_base, variant, target)
        material = dome_material(source_material, variant, image)
        mesh = subset_mesh(temple_source_mesh, f"map_temple_dome_{variant}_mesh", keep_dome=True)
        mesh.materials.clear()
        mesh.materials.append(material)
        variant_images[variant] = image_receipt
        variant_meshes[variant] = mesh
    split_triangles = {
        "source": triangles(temple_source_mesh),
        "structure": triangles(structure_mesh),
        "dome": triangles(variant_meshes["amber"]),
    }
    if split_triangles["structure"] + split_triangles["dome"] != split_triangles["source"]:
        raise ValueError(f"Temple face partition lost triangles: {split_triangles}")

    clear_objects()
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "METERS"
    root = add_empty(ROOT_NAME)
    root["assetId"] = "floating-museum-twin-finish-kit-v4"
    root["units"] = "metres"
    for variant in TEMPLE_VARIANTS:
        group = add_empty(f"map_temple_{variant}", root)
        group["anchor"] = "ground/bottom Y=0"
        group["front"] = "exported glTF +Z (Blender -Y)"
        add_mesh_object(f"map_temple_{variant}_structure", structure_mesh, group)
        add_mesh_object(f"map_temple_{variant}_dome", variant_meshes[variant], group)
    cliff_group = add_empty("map_cliff", root)
    cliff_group["anchor"] = "walking/top surface Y=0"
    add_mesh_object("map_cliff_geometry", cliff_mesh, cliff_group)
    cypress_group = add_empty("map_cypress", root)
    cypress_group["anchor"] = "ground/bottom Y=0"
    add_mesh_object("map_cypress_geometry", cypress_mesh, cypress_group)
    flower_mesh, flower_source = import_flower_mesh()
    flower_cluster = create_flower_cluster(root, flower_mesh)
    bpy.context.view_layer.update()

    bpy.ops.file.pack_all()
    missing = sorted(
        image.filepath
        for image in bpy.data.images
        if image.source != "GENERATED" and image.packed_file is None
    )
    if missing:
        raise ValueError(f"Packed V4 source retains external images: {missing}")
    KIT_BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(KIT_BLEND), compress=True, check_existing=False)
    packed_source = {
        "file": str(KIT_BLEND.relative_to(ART)),
        "bytes": KIT_BLEND.stat().st_size,
        "sha256": digest(KIT_BLEND),
        "fullTextureResolution": True,
        "missingExternalFiles": missing,
    }

    runtime_images = configure_runtime_images(root)
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for obj in descendants(root):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    KIT_GLB.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(KIT_GLB),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_materials="EXPORT",
    )
    compression = compress_glb_images(KIT_GLB)
    structure = glb_structure(KIT_GLB)
    fresh = fresh_reimport(expected_temple_dimensions)
    manifest = {
        "schema": 1,
        "assetId": "floating-museum-twin-finish-kit-v4",
        "status": "structurally validated map-scale replacement kit; isolated visual proof pending",
        "coordinates": "Blender Z-up authoring; exported glTF +Y up; metres",
        "root": ROOT_NAME,
        "sources": {
            "v3PackedSculptureKit": {
                "file": str(V3_BLEND.relative_to(REPO)),
                "bytes": V3_BLEND.stat().st_size,
                "sha256": digest(V3_BLEND),
                "receipt": str(V3_MANIFEST.relative_to(REPO)),
                "reuse": ["temple donor geometry/materials", "map_cliff", "map_cypress"],
            },
            "v1CrystalPlanterLod": {
                "file": str(V1_KIT_GLB.relative_to(REPO)),
                "bytes": V1_KIT_GLB.stat().st_size,
                "sha256": digest(V1_KIT_GLB),
                "receipt": str(V1_KIT_MANIFEST.relative_to(REPO)),
                "reuse": "map_planter accepted 1,800-triangle LOD",
                **flower_source,
            },
            "newExternalGeneration": False,
            "creditsConsumed": 0,
        },
        "templeVariants": {
            "partition": {
                "criterion": f"face-centre authoring Z >= {DOME_FACE_Z:.2f}m",
                "triangles": split_triangles,
                "exactFaceParity": True,
                "exteriorGeometryChanged": False,
            },
            "materials": {
                "structure": "map_temple_structure_atlas",
                "amberDome": "map_temple_dome_amber_atlas",
                "tealDome": "map_temple_dome_teal_atlas",
            },
            "derivedTextures": variant_images,
            "policy": "Only cool celadon pixels used by the dome face set are hue-shifted; ivory stone and warm gold remain donor-authored.",
        },
        "flowerCluster": flower_cluster,
        "packedBlend": packed_source,
        "runtimeImagesBeforeGlbCompression": runtime_images,
        "runtimeCompression": compression,
        "glb": structure,
        "freshReimport": fresh,
        "validation": {
            "acceptedSourceHashesMatched": True,
            "packedFullResolutionSource": True,
            "requiredNamedHierarchy": True,
            "freshGlbReimport": True,
            "templeExactFaceParity": True,
            "templeBoundsParity": True,
            "uv0Present": True,
            "anchorsPassed": True,
            "runtimeTextureBudgetsPassed": True,
            "encodedImageDimensionsRecorded": True,
            "visualProof": "pending",
            "runtimeIntegration": "not performed",
            "staticTopologyScope": "Static map scenery preserves accepted open textured donor surfaces; fracture/manifold gates do not apply.",
        },
        "rebuild": {
            "workingDirectory": "repository root",
            "command": "rtk proxy blender -b --factory-startup --python art/glass-adventure/journey-map/v4/production/build_twin_finish_kit.py",
            "blender": bpy.app.version_string,
        },
        "proofs": [],
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    public_manifest(structure)
    print(
        "FLOATING_MUSEUM_TWIN_FINISH_KIT_BUILT="
        + json.dumps(
            {
                "glbBytes": structure["bytes"],
                "glbSha256": structure["sha256"],
                "nodes": {
                    name: {
                        "triangles": row["trianglesRendered"],
                        "dimensions": row["dimensionsGlTfYUpMetres"],
                    }
                    for name, row in fresh["nodes"].items()
                },
            }
        ),
        flush=True,
    )
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
