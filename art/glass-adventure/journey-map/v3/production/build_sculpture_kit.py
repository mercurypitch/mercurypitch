"""Build the packed map-scale temple, cliff, and cypress sculpture kit."""

from __future__ import annotations

import hashlib
from io import BytesIO
import json
from pathlib import Path
import struct

import bmesh
import bpy
from mathutils import Matrix, Vector
from PIL import Image as PILImage


HERE = Path(__file__).resolve().parent
ART = HERE.parent
KIT_BLEND = ART / "sources" / "floating-museum-sculpture-kit-v3.blend"
KIT_GLB = ART / "exports" / "floating-museum-sculpture-kit-v3.glb"
MANIFEST = ART / "exports" / "floating-museum-sculpture-kit-v3.json"

ASSETS = {
    "temple": {
        "source": ART / "meshy" / "floating-museum-temple-v3.glb",
        "receipt": ART / "meshy" / "temple-receipt.json",
        "node": "map_temple",
        "targetTriangles": 10_000,
        "textureLimit": 1024,
        "targetDimension": ("width", 2.4),
        "anchor": "bottom",
        "front": "exported glTF +Z (Blender -Y)",
    },
    "cliff": {
        "source": ART / "meshy" / "floating-museum-cliff-v3.glb",
        "receipt": ART / "meshy" / "cliff-receipt.json",
        "node": "map_cliff",
        "targetTriangles": 8_000,
        "textureLimit": 1024,
        "targetDimension": ("width", 4.5),
        "anchor": "top",
        "front": "not directional; broad crag face toward exported glTF +Z",
    },
    "cypress": {
        "source": ART / "meshy" / "floating-museum-cypress-v3.glb",
        "receipt": ART / "meshy" / "cypress-receipt.json",
        "node": "map_cypress",
        "targetTriangles": 1_200,
        "textureLimit": 512,
        "targetDimension": ("height", 1.8),
        "anchor": "bottom",
        "front": "exported glTF +Z (Blender -Y)",
    },
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def triangles(mesh: bpy.types.Mesh) -> int:
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)


def mesh_bounds(mesh: bpy.types.Mesh) -> tuple[Vector, Vector]:
    low = Vector(min(vertex.co[axis] for vertex in mesh.vertices) for axis in range(3))
    high = Vector(max(vertex.co[axis] for vertex in mesh.vertices) for axis in range(3))
    return low, high


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


def weld_and_triangulate(mesh: bpy.types.Mesh) -> dict[str, int]:
    before_vertices = len(mesh.vertices)
    before_triangles = triangles(mesh)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-7)
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    loose_edges = [edge for edge in bm.edges if not edge.link_faces]
    if loose_edges:
        bmesh.ops.delete(bm, geom=loose_edges, context="EDGES")
    loose_vertices = [vertex for vertex in bm.verts if not vertex.link_faces]
    if loose_vertices:
        bmesh.ops.delete(bm, geom=loose_vertices, context="VERTS")
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    return {
        "sourceVertices": before_vertices,
        "sourceTriangles": before_triangles,
        "weldedVertices": len(mesh.vertices),
        "weldedTriangles": triangles(mesh),
    }


def select_only(obj: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def decimate(obj: bpy.types.Object, target: int) -> dict[str, int | float]:
    before = triangles(obj.data)
    ratio = min(1.0, target / max(before, 1))
    if before > target:
        modifier = obj.modifiers.new("map camera LOD", "DECIMATE")
        modifier.ratio = ratio
        modifier.use_collapse_triangulate = True
        select_only(obj)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    after = triangles(obj.data)
    if after > target + 16:
        raise ValueError(f"{obj.name} LOD exceeded target: {after} > {target}")
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return {
        "sourceTriangles": before,
        "targetTriangles": target,
        "collapseRatio": ratio,
        "lodTriangles": after,
    }


def normalize(mesh: bpy.types.Mesh, dimension: tuple[str, float], anchor: str) -> dict[str, object]:
    low, high = mesh_bounds(mesh)
    centre_x = (low.x + high.x) * 0.5
    centre_y = (low.y + high.y) * 0.5
    axis, target = dimension
    source = high.x - low.x if axis == "width" else high.z - low.z
    scale = target / source
    z_anchor = low.z if anchor == "bottom" else high.z
    for vertex in mesh.vertices:
        vertex.co.x = (vertex.co.x - centre_x) * scale
        vertex.co.y = (vertex.co.y - centre_y) * scale
        vertex.co.z = (vertex.co.z - z_anchor) * scale
    mesh.update()
    final_low, final_high = mesh_bounds(mesh)
    anchor_error = abs(final_low.z) if anchor == "bottom" else abs(final_high.z)
    if anchor_error > 1e-6:
        raise ValueError(f"{mesh.name} anchor error is {anchor_error}")
    return {
        "uniformScale": scale,
        "anchor": "ground/bottom Y=0" if anchor == "bottom" else "walking/top surface Y=0",
        "authoringBoundsBlenderZUp": {"min": list(final_low), "max": list(final_high)},
        "dimensionsGlTfYUpMetres": [
            final_high.x - final_low.x,
            final_high.z - final_low.z,
            final_high.y - final_low.y,
        ],
        "anchorErrorMetres": anchor_error,
    }


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


def import_asset(asset: str, config: dict[str, object]) -> tuple[bpy.types.Object, dict[str, object]]:
    source = Path(config["source"])
    receipt = json.loads(Path(config["receipt"]).read_text())
    archived = [row for row in receipt["files"] if row["role"] == "glb"]
    if len(archived) != 1 or archived[0]["sha256"] != digest(source):
        raise RuntimeError(f"{asset} source does not match its archive receipt")
    before_objects = set(bpy.data.objects)
    before_materials = set(bpy.data.materials)
    bpy.ops.import_scene.gltf(filepath=str(source))
    imported = [obj for obj in bpy.data.objects if obj not in before_objects]
    mesh_objects = [obj for obj in imported if obj.type == "MESH"]
    if len(mesh_objects) != 1:
        raise ValueError(f"{asset} expected one mesh object, got {len(mesh_objects)}")
    obj = mesh_objects[0]
    obj.data.transform(obj.matrix_world)
    obj.matrix_world = Matrix.Identity(4)
    obj.parent = None
    raw_topology = topology(obj.data)
    weld = weld_and_triangulate(obj.data)
    welded_topology = topology(obj.data)
    lod = decimate(obj, int(config["targetTriangles"]))
    normalized = normalize(obj.data, config["targetDimension"], str(config["anchor"]))
    obj.name = f"{config['node']}_geometry"
    obj.data.name = obj.name + "_mesh"
    obj["role"] = "map-sculpture"
    imported_materials = [
        material for material in bpy.data.materials if material not in before_materials
    ]
    if len(imported_materials) != 1:
        raise ValueError(f"{asset} expected one PBR atlas material, got {len(imported_materials)}")
    material = imported_materials[0]
    material.name = f"map_{asset}_atlas"
    images = material_images(imported_materials)
    if not images:
        raise ValueError(f"{asset} lost its texture atlas")
    for index, image in enumerate(sorted(images, key=lambda item: item.name)):
        image.name = f"map_{asset}_texture_{index:02d}"
        image.pack()
    if obj.data.uv_layers.active is None:
        raise ValueError(f"{asset} lost UV0")
    for other in imported:
        if other != obj:
            bpy.data.objects.remove(other, do_unlink=True)
    return obj, {
        "source": {
            "file": str(source.relative_to(ART)),
            "bytes": source.stat().st_size,
            "sha256": digest(source),
            "receipt": str(Path(config["receipt"]).relative_to(ART)),
            "taskId": receipt["taskId"],
            "consumedCredits": receipt["finalStatus"]["consumed_credits"],
        },
        "rawTopology": raw_topology,
        "weld": weld,
        "weldedTopology": welded_topology,
        "lod": lod,
        "normalization": normalized,
        "front": config["front"],
        "uvLayers": [layer.name for layer in obj.data.uv_layers],
        "fullTextureImages": image_rows(images),
        "material": material.name,
    }


def descendants(root: bpy.types.Object) -> list[bpy.types.Object]:
    result: list[bpy.types.Object] = []
    pending = list(root.children)
    while pending:
        current = pending.pop()
        result.append(current)
        pending.extend(current.children)
    return result


def object_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points = [
        obj.matrix_world @ Vector(corner)
        for obj in objects
        if obj.type == "MESH"
        for corner in obj.bound_box
    ]
    low = Vector(min(point[axis] for point in points) for axis in range(3))
    high = Vector(max(point[axis] for point in points) for axis in range(3))
    return low, high


def glb_structure(path: Path, required: set[str]) -> dict[str, object]:
    raw = path.read_bytes()
    if raw[:4] != b"glTF" or struct.unpack_from("<I", raw, 8)[0] != len(raw):
        raise ValueError("Incomplete sculpture-kit GLB")
    chunk_length, chunk_type = struct.unpack_from("<II", raw, 12)
    if chunk_type != 0x4E4F534A:
        raise ValueError("Sculpture-kit GLB has no JSON chunk")
    document = json.loads(raw[20 : 20 + chunk_length].decode("utf-8").rstrip(" \x00"))
    names = {node.get("name") for node in document.get("nodes", [])}
    if missing := sorted(required - names):
        raise ValueError(f"Sculpture-kit GLB missing named nodes: {missing}")
    return {
        "file": str(path.relative_to(ART)),
        "bytes": len(raw),
        "sha256": digest(path),
        "nodes": len(document.get("nodes", [])),
        "meshes": len(document.get("meshes", [])),
        "primitives": sum(
            len(mesh.get("primitives", [])) for mesh in document.get("meshes", [])
        ),
        "materials": len(document.get("materials", [])),
        "images": len(document.get("images", [])),
        "textures": len(document.get("textures", [])),
        "requiredNamedNodesPresent": True,
        "extensionsUsed": document.get("extensionsUsed", []),
    }


def compress_glb_images(path: Path) -> dict[str, object]:
    """Repack lossy-safe PBR maps as JPEG while retaining normal maps as PNG."""

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
    image_rows = []
    for image_index, image in enumerate(document.get("images", [])):
        view_index = image["bufferView"]
        view = document["bufferViews"][view_index]
        offset = int(view.get("byteOffset", 0))
        source = binary[offset : offset + int(view["byteLength"])]
        roles = sorted(image_roles.get(image_index, set()))
        convert = bool(set(roles) & {"baseColor", "metallicRoughness", "emissive"}) and "normal" not in roles
        output = source
        source_image = PILImage.open(BytesIO(source))
        source_dimensions = list(source_image.size)
        if convert:
            opened = source_image.convert("RGB")
            encoded = BytesIO()
            quality = 78 if "metallicRoughness" in roles else 84
            opened.save(
                encoded,
                format="JPEG",
                quality=quality,
                optimize=True,
                subsampling=0 if "metallicRoughness" in roles else 1,
            )
            output = encoded.getvalue()
            image["mimeType"] = "image/jpeg"
        replacements[view_index] = output
        image_rows.append(
            {
                "name": image.get("name"),
                "roles": roles,
                "mimeType": image.get("mimeType"),
                "encodedDimensions": source_dimensions,
                "sourceBytes": len(source),
                "runtimeBytes": len(output),
            }
        )

    rebuilt = bytearray()
    views = document.get("bufferViews", [])
    for view_index in sorted(
        range(len(views)), key=lambda index: int(views[index].get("byteOffset", 0))
    ):
        while len(rebuilt) % 4:
            rebuilt.append(0)
        view = views[view_index]
        old_offset = int(view.get("byteOffset", 0))
        payload = replacements.get(
            view_index,
            binary[old_offset : old_offset + int(view["byteLength"])],
        )
        view["byteOffset"] = len(rebuilt)
        view["byteLength"] = len(payload)
        rebuilt.extend(payload)
    while len(rebuilt) % 4:
        rebuilt.append(0)
    document["buffers"][0]["byteLength"] = len(rebuilt)
    encoded_json = json.dumps(document, separators=(",", ":")).encode("utf-8")
    encoded_json += b" " * ((-len(encoded_json)) % 4)
    result = bytearray()
    result.extend(struct.pack("<III", 0x46546C67, 2, 0))
    result.extend(struct.pack("<II", len(encoded_json), 0x4E4F534A))
    result.extend(encoded_json)
    result.extend(struct.pack("<II", len(rebuilt), 0x004E4942))
    result.extend(rebuilt)
    struct.pack_into("<I", result, 8, len(result))
    path.write_bytes(result)
    return {
        "method": "JPEG quality 84 for base-color/emissive and 78 with 4:4:4 sampling for channel-packed metallic-roughness; PNG normals retained",
        "sourceBytes": len(raw),
        "runtimeBytes": len(result),
        "images": image_rows,
    }


def fresh_reimport() -> dict[str, object]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(KIT_GLB))
    root = bpy.data.objects.get("map_sculpture_kit_root")
    if root is None:
        raise ValueError("Fresh import lost map_sculpture_kit_root")
    rows: dict[str, object] = {}
    for asset, config in ASSETS.items():
        node = bpy.data.objects.get(str(config["node"]))
        if node is None or node.parent != root:
            raise ValueError(f"Fresh import lost hierarchy for {config['node']}")
        meshes = [obj for obj in descendants(node) if obj.type == "MESH"]
        if len(meshes) != 1:
            raise ValueError(f"{config['node']} expected one mesh child, got {len(meshes)}")
        low, high = object_bounds(meshes)
        anchor_error = abs(low.z) if config["anchor"] == "bottom" else abs(high.z)
        if anchor_error > 1e-5:
            raise ValueError(f"Fresh import anchor failed for {config['node']}: {anchor_error}")
        tri_count = sum(triangles(obj.data) for obj in meshes)
        if tri_count > int(config["targetTriangles"]) + 16:
            raise ValueError(f"Fresh import triangle budget failed for {config['node']}")
        images = material_images(
            [
                material
                for obj in meshes
                for material in obj.data.materials
                if material is not None
            ]
        )
        texture_limit = int(config["textureLimit"])
        if any(max(image.size) > texture_limit for image in images):
            raise ValueError(f"Fresh import texture budget failed for {config['node']}")
        if any(obj.data.uv_layers.active is None for obj in meshes):
            raise ValueError(f"Fresh import lost UV0 for {config['node']}")
        rows[str(config["node"])] = {
            "meshChildren": [obj.name for obj in meshes],
            "triangles": tri_count,
            "boundsBlenderZUpMetres": {"min": list(low), "max": list(high)},
            "dimensionsGlTfYUpMetres": [high.x - low.x, high.z - low.z, high.y - low.y],
            "anchorErrorMetres": anchor_error,
            "uvLayers": [layer.name for layer in meshes[0].data.uv_layers],
            "topology": topology(meshes[0].data),
            "runtimeTextureImages": image_rows(images),
        }
    return {
        "root": root.name,
        "coordinates": "Fresh GLB reimport into Blender Z-up; dimensions listed in glTF X/Y/Z order.",
        "nodes": rows,
    }


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "METERS"
    root = bpy.data.objects.new("map_sculpture_kit_root", None)
    bpy.context.scene.collection.objects.link(root)
    root["assetId"] = "floating-museum-sculpture-kit-v3"
    root["units"] = "metres"
    receipts: dict[str, object] = {}
    geometry_objects = []
    for asset, config in ASSETS.items():
        geometry, receipt = import_asset(asset, config)
        group = bpy.data.objects.new(str(config["node"]), None)
        bpy.context.scene.collection.objects.link(group)
        group.parent = root
        group["assetId"] = f"floating-museum-{asset}-v3"
        group["anchor"] = receipt["normalization"]["anchor"]
        group["front"] = config["front"]
        geometry.parent = group
        geometry_objects.append(geometry)
        receipts[asset] = receipt
    bpy.context.view_layer.update()
    bpy.ops.file.pack_all()
    missing = sorted(
        image.filepath
        for image in bpy.data.images
        if image.source != "GENERATED" and image.packed_file is None
    )
    if missing:
        raise ValueError(f"Packed source retains external images: {missing}")
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

    for asset, config in ASSETS.items():
        material = bpy.data.materials.get(f"map_{asset}_atlas")
        if material is None:
            raise ValueError(f"Missing map_{asset}_atlas before runtime export")
        roles = material_image_roles(material)
        images = material_images([material])
        limit = int(config["textureLimit"])
        for image in images:
            image_limit = limit // 2 if "normal" in roles.get(image, []) else limit
            if max(image.size) > image_limit:
                image.scale(image_limit, image_limit)
            image.pack()
        receipts[asset]["runtimeTextureImages"] = image_rows(images)
        receipts[asset]["runtimeImageRoles"] = {
            image.name: image_roles for image, image_roles in roles.items()
        }

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
    structure = glb_structure(
        KIT_GLB,
        {"map_sculpture_kit_root", "map_temple", "map_cliff", "map_cypress"},
    )
    fresh = fresh_reimport()
    manifest = {
        "schema": 1,
        "assetId": "floating-museum-sculpture-kit-v3",
        "status": "structurally validated map-scale kit; isolated visual proof pending",
        "coordinates": "Blender Z-up authoring; exported glTF +Y up; metres",
        "root": "map_sculpture_kit_root",
        "sources": receipts,
        "packedBlend": packed_source,
        "glb": structure,
        "runtimeCompression": compression,
        "freshReimport": fresh,
        "validation": {
            "rawArchiveReceiptsMatched": True,
            "packedFullResolutionSource": True,
            "requiredNamedHierarchy": True,
            "freshGlbReimport": True,
            "triangleBudgetsPassed": True,
            "runtimeTextureBudgetsPassed": True,
            "uv0Present": True,
            "anchorsPassed": True,
            "visualProof": "pending",
            "runtimeIntegration": "not performed",
            "staticTopologyScope": (
                "Static map scenery may contain open textured surfaces; topology counts are "
                "recorded but airtight fracture gates do not apply."
            ),
        },
        "rebuild": {
            "workingDirectory": "repository root",
            "command": (
                "rtk proxy blender -b --factory-startup --python "
                "art/glass-adventure/journey-map/v3/production/build_sculpture_kit.py"
            ),
            "blender": bpy.app.version_string,
        },
        "proofs": [],
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(
        "FLOATING_MUSEUM_SCULPTURE_KIT_BUILT="
        + json.dumps(
            {
                "glbBytes": structure["bytes"],
                "glbSha256": structure["sha256"],
                "nodes": {
                    name: {
                        "triangles": row["triangles"],
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
