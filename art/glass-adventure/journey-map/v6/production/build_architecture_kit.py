"""Build the packed V6 connector and conservatory map landmark kit."""

from __future__ import annotations

import hashlib
from io import BytesIO
import json
import math
from pathlib import Path
import shutil
import struct

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
import numpy as np
from PIL import Image as PILImage


HERE = Path(__file__).resolve().parent
ART = HERE.parent
REPO = HERE.parents[4]
KIT_BLEND = ART / "sources" / "floating-museum-architecture-kit-v6.blend"
KIT_GLB = ART / "exports" / "floating-museum-architecture-kit-v6.glb"
MANIFEST = ART / "exports" / "floating-museum-architecture-kit-v6.json"
PUBLIC_DIR = REPO / "apps" / "beside-cue" / "public" / "games" / "journey-map-v6"
PUBLIC_GLB = PUBLIC_DIR / KIT_GLB.name
PUBLIC_MANIFEST = PUBLIC_DIR / "manifest.json"
TEXTURE_DIR = ART / "sources" / "textures"
ROOT_NAME = "map_museum_polish_kit_root"
ASSET_ID = "floating-museum-architecture-kit-v6"

ASSETS = {
    "twin_connector": {
        "source": ART / "meshy" / "twin-connector-final.glb",
        "receipt": ART / "meshy" / "twin-connector-receipt.json",
        "node": "map_twin_connector",
        "targetTriangles": 19_000,
        "textureLimit": 1024,
        "targetDimensions": (1.70, 2.80, 0.80),
        "anchor": "bottom",
        "front": "exported glTF +Z (Blender -Y)",
        "minimumAperture": 0.80,
    },
    "conservatory": {
        "source": ART / "meshy" / "conservatory-final.glb",
        "receipt": ART / "meshy" / "conservatory-receipt.json",
        "node": "map_conservatory",
        "targetTriangles": 24_000,
        "textureLimit": 1024,
        "targetDimensions": (2.30, 2.65, 2.30),
        "anchor": "bottom",
        "front": "exported glTF +Z (Blender -Y)",
    },
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require_complete_glb(path: Path) -> None:
    header = path.read_bytes()[:12]
    if len(header) != 12 or header[:4] != b"glTF":
        raise ValueError(f"{path} is not a GLB")
    declared = struct.unpack_from("<I", header, 8)[0]
    if declared != path.stat().st_size:
        raise ValueError(
            f"{path} is incomplete: header declares {declared} bytes, found {path.stat().st_size}"
        )


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


def object_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points = [
        obj.matrix_world @ Vector(corner)
        for obj in objects
        if obj.type == "MESH"
        for corner in obj.bound_box
    ]
    return (
        Vector(min(point[axis] for point in points) for axis in range(3)),
        Vector(max(point[axis] for point in points) for axis in range(3)),
    )


def vertex_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points = [
        obj.matrix_world @ vertex.co
        for obj in objects
        if obj.type == "MESH"
        for vertex in obj.data.vertices
    ]
    return (
        Vector(min(point[axis] for point in points) for axis in range(3)),
        Vector(max(point[axis] for point in points) for axis in range(3)),
    )


def normalize_objects(
    objects: list[bpy.types.Object], target_dimensions: tuple[float, float, float]
) -> dict[str, object]:
    low, high = vertex_bounds(objects)
    source_dimensions = Vector((high.x - low.x, high.z - low.z, high.y - low.y))
    target_width, target_height, target_depth = target_dimensions
    scales = Vector(
        (
            target_width / source_dimensions.x,
            target_depth / source_dimensions.z,
            target_height / source_dimensions.y,
        )
    )
    centre_x = (low.x + high.x) * 0.5
    centre_y = (low.y + high.y) * 0.5
    for obj in objects:
        world = obj.matrix_world.copy()
        obj.parent = None
        obj.data = obj.data.copy()
        obj.data.transform(world)
        obj.matrix_world = Matrix.Identity(4)
        for vertex in obj.data.vertices:
            vertex.co.x = (vertex.co.x - centre_x) * scales.x
            vertex.co.y = (vertex.co.y - centre_y) * scales.y
            vertex.co.z = (vertex.co.z - low.z) * scales.z
        obj.data.update()
    final_low, final_high = vertex_bounds(objects)
    anchor_error = abs(final_low.z)
    dimensions = [
        final_high.x - final_low.x,
        final_high.z - final_low.z,
        final_high.y - final_low.y,
    ]
    if anchor_error > 1e-6:
        raise ValueError(f"Normalized group anchor error is {anchor_error}")
    for actual, target in zip(dimensions, target_dimensions, strict=True):
        if abs(actual - target) > 1e-5:
            raise ValueError(f"Normalized dimension {actual} missed target {target}")
    return {
        "scaleBlenderXYZ": list(scales),
        "sourceDimensionsGlTfYUp": list(source_dimensions),
        "anchor": "ground/bottom Y=0",
        "authoringBoundsBlenderZUp": {"min": list(final_low), "max": list(final_high)},
        "dimensionsGlTfYUpMetres": dimensions,
        "anchorErrorMetres": anchor_error,
    }


def widen_connector_aperture(
    objects: list[bpy.types.Object], target_dimensions: tuple[float, float, float]
) -> dict[str, object]:
    """Open the lower donor arch without changing its exterior silhouette or balcony."""

    target_width, target_height, _ = target_dimensions
    half_width = target_width * 0.5
    maximum_shift = 0.065
    full_height = target_height * 0.46
    fade_height = target_height * 0.62
    shifted = 0
    largest = 0.0
    for obj in objects:
        for vertex in obj.data.vertices:
            absolute_x = abs(vertex.co.x)
            if absolute_x >= half_width or vertex.co.z >= fade_height:
                continue
            height_weight = (
                1.0
                if vertex.co.z <= full_height
                else (fade_height - vertex.co.z) / (fade_height - full_height)
            )
            interior_weight = 1.0 - absolute_x / half_width
            shift = maximum_shift * interior_weight * height_weight
            if shift <= 0.0:
                continue
            vertex.co.x += math.copysign(shift, vertex.co.x if vertex.co.x else 1.0)
            shifted += 1
            largest = max(largest, shift)
        obj.data.update()
    return {
        "method": (
            "symmetric lower-inner arch expansion with linear falloff to the fixed outer "
            "silhouette and zero influence above the balcony spring line"
        ),
        "maximumConfiguredShiftMetresPerSide": maximum_shift,
        "largestAppliedShiftMetres": largest,
        "fullInfluenceBelowMetres": full_height,
        "zeroInfluenceAboveMetres": fade_height,
        "verticesAdjusted": shifted,
        "outerWidthPreservedMetres": target_width,
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


def packed_pil(image: bpy.types.Image) -> PILImage.Image:
    if image.packed_file is not None:
        return PILImage.open(BytesIO(bytes(image.packed_file.data))).convert("RGB")
    path = Path(bpy.path.abspath(image.filepath))
    if not path.is_file():
        raise ValueError(f"Image {image.name} is neither packed nor readable from {path}")
    return PILImage.open(path).convert("RGB")


def resize_max(image: PILImage.Image, limit: int) -> PILImage.Image:
    copy = image.copy()
    copy.thumbnail((limit, limit), PILImage.Resampling.LANCZOS)
    return copy


def smoothstep(low: float, high: float, values: np.ndarray) -> np.ndarray:
    scaled = np.clip((values - low) / (high - low), 0.0, 1.0)
    return scaled * scaled * (3.0 - 2.0 * scaled)


def semantic_maps(base: PILImage.Image, glazing: bool) -> tuple[PILImage.Image, PILImage.Image, dict[str, object]]:
    pixels = np.asarray(base, dtype=np.float32) / 255.0
    red, green, blue = pixels[:, :, 0], pixels[:, :, 1], pixels[:, :, 2]
    maximum = np.max(pixels, axis=2)
    minimum = np.min(pixels, axis=2)
    chroma = maximum - minimum
    warm_excess = red - blue
    green_excess = green - np.maximum(red, blue)
    celadon_excess = (green + blue) * 0.5 - red

    foliage = smoothstep(0.025, 0.13, green_excess) * smoothstep(0.06, 0.22, chroma)
    foliage *= 1.0 - smoothstep(0.64, 0.90, maximum)
    # Meshy's warm image lighting makes shaded ivory slightly yellow.  Require a
    # stronger warm/chroma signal so columns stay stone while true ornament reads gold.
    gold = smoothstep(0.07, 0.20, warm_excess) * smoothstep(0.12, 0.30, chroma)
    gold *= smoothstep(0.22, 0.58, maximum) * (1.0 - foliage)
    glass = np.zeros_like(maximum)
    if glazing:
        # Pale celadon is low-saturation, so classify its relative cyan bias instead
        # of requiring the high chroma that only foliage reaches in this atlas.
        glass = smoothstep(0.005, 0.08, celadon_excess)
        glass *= smoothstep(0.32, 0.72, maximum)
        glass *= 1.0 - np.maximum(gold, foliage)

    metallic = np.clip(0.015 + gold * 0.62, 0.0, 0.65)
    roughness = np.full_like(maximum, 0.56)
    roughness = roughness * (1.0 - gold) + 0.27 * gold
    roughness = roughness * (1.0 - foliage) + 0.68 * foliage
    roughness = roughness * (1.0 - glass) + 0.20 * glass
    transmission = np.clip(glass * 0.42, 0.0, 0.42)

    orm = np.empty((*maximum.shape, 3), dtype=np.uint8)
    orm[:, :, 0] = 255
    orm[:, :, 1] = np.round(roughness * 255).astype(np.uint8)
    orm[:, :, 2] = np.round(metallic * 255).astype(np.uint8)
    mask = np.repeat(
        np.round(transmission * 255).astype(np.uint8)[:, :, None], 3, axis=2
    )
    report = {
        "method": "continuous texture-space material masks; no face-level material boundaries",
        "goldPixelsAboveHalf": int(np.sum(gold > 0.5)),
        "goldCoverageAboveHalf": float(np.mean(gold > 0.5)),
        "foliagePixelsAboveHalf": int(np.sum(foliage > 0.5)),
        "foliageCoverageAboveHalf": float(np.mean(foliage > 0.5)),
        "glazingPixelsAboveHalf": int(np.sum(glass > 0.5)),
        "glazingCoverageAboveHalf": float(np.mean(glass > 0.5)),
        "totalPixels": int(maximum.size),
        "metallicRange": [float(metallic.min()), float(metallic.max())],
        "roughnessRange": [float(roughness.min()), float(roughness.max())],
        "transmissionRange": [float(transmission.min()), float(transmission.max())],
    }
    return PILImage.fromarray(orm, "RGB"), PILImage.fromarray(mask, "RGB"), report


def load_runtime_image(path: Path, name: str, color_space: str) -> bpy.types.Image:
    image = bpy.data.images.load(str(path), check_existing=False)
    image.name = name
    image.colorspace_settings.name = color_space
    image.pack()
    return image


def configure_runtime_material(
    asset: str,
    material: bpy.types.Material,
    material_index: int,
    texture_limit: int,
    glazing: bool,
) -> dict[str, object]:
    roles = material_image_roles(material)
    base_sources = [image for image, values in roles.items() if "baseColor" in values]
    normal_sources = [image for image, values in roles.items() if "normal" in values]
    if len(base_sources) != 1:
        raise ValueError(f"{material.name} expected one base-color image, got {len(base_sources)}")
    TEXTURE_DIR.mkdir(parents=True, exist_ok=True)
    stem = f"{asset}-{material_index:02d}"
    base = resize_max(packed_pil(base_sources[0]), texture_limit)
    base_path = TEXTURE_DIR / f"{stem}-base-1k.jpg"
    base.save(base_path, format="JPEG", quality=88, optimize=True, subsampling=1)
    semantic_source = resize_max(base, min(texture_limit, 512))
    orm, transmission, semantic_report = semantic_maps(semantic_source, glazing)
    orm_path = TEXTURE_DIR / f"{stem}-orm-512.png"
    orm.save(orm_path, format="PNG", optimize=True)
    transmission_path: Path | None = None
    if glazing:
        transmission_path = TEXTURE_DIR / f"{stem}-transmission-512.png"
        transmission.save(transmission_path, format="PNG", optimize=True)

    normal_path: Path | None = None
    normal: PILImage.Image | None = None
    if len(normal_sources) > 1:
        raise ValueError(f"{material.name} has ambiguous normal images")
    if normal_sources:
        normal = resize_max(packed_pil(normal_sources[0]), min(texture_limit, 512))
        normal_path = TEXTURE_DIR / f"{stem}-normal-512.png"
        normal.save(normal_path, format="PNG", optimize=True)

    runtime_base = load_runtime_image(base_path, f"{stem}_base", "sRGB")
    runtime_orm = load_runtime_image(orm_path, f"{stem}_orm", "Non-Color")
    runtime_transmission = (
        load_runtime_image(transmission_path, f"{stem}_transmission", "Non-Color")
        if transmission_path is not None
        else None
    )
    runtime_normal = (
        load_runtime_image(normal_path, f"{stem}_normal", "Non-Color")
        if normal_path is not None
        else None
    )

    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.name = "Principled BSDF"
    base_node = nodes.new("ShaderNodeTexImage")
    base_node.name = "Runtime Base Color"
    base_node.image = runtime_base
    orm_node = nodes.new("ShaderNodeTexImage")
    orm_node.name = "Runtime ORM"
    orm_node.image = runtime_orm
    separate = nodes.new("ShaderNodeSeparateColor")
    separate.name = "Runtime ORM Channels"
    links = material.node_tree.links
    links.new(base_node.outputs["Color"], shader.inputs["Base Color"])
    links.new(orm_node.outputs["Color"], separate.inputs["Color"])
    links.new(separate.outputs["Green"], shader.inputs["Roughness"])
    links.new(separate.outputs["Blue"], shader.inputs["Metallic"])
    if glazing:
        if runtime_transmission is None:
            raise ValueError(f"{material.name} expected a glazing transmission mask")
        transmission_node = nodes.new("ShaderNodeTexImage")
        transmission_node.name = "Runtime Glazing Mask"
        transmission_node.image = runtime_transmission
        links.new(
            transmission_node.outputs["Color"], shader.inputs["Transmission Weight"]
        )
    shader.inputs["IOR"].default_value = 1.45
    if runtime_normal is not None:
        normal_node = nodes.new("ShaderNodeTexImage")
        normal_node.name = "Runtime Normal"
        normal_node.image = runtime_normal
        normal_map = nodes.new("ShaderNodeNormalMap")
        normal_map.inputs["Strength"].default_value = 0.55
        links.new(normal_node.outputs["Color"], normal_map.inputs["Color"])
        links.new(normal_map.outputs["Normal"], shader.inputs["Normal"])
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    material.diffuse_color = (0.72, 0.70, 0.65, 1.0)

    files = [base_path, orm_path]
    if transmission_path is not None:
        files.append(transmission_path)
    if normal_path is not None:
        files.append(normal_path)
    return {
        "material": material.name,
        "semanticResponse": semantic_report,
        "runtimeTextures": [
            {
                "file": str(path.relative_to(ART)),
                "bytes": path.stat().st_size,
                "sha256": digest(path),
                "dimensions": list(PILImage.open(path).size),
            }
            for path in files
        ],
    }


def receipt_contains_hash(value: object, expected: str) -> bool:
    if isinstance(value, dict):
        return any(receipt_contains_hash(item, expected) for item in value.values())
    if isinstance(value, list):
        return any(receipt_contains_hash(item, expected) for item in value)
    return isinstance(value, str) and value == expected


def decimate_group(
    objects: list[bpy.types.Object], target: int
) -> dict[str, int | float]:
    before = sum(triangles(obj.data) for obj in objects)
    ratio = min(1.0, target / max(before, 1))
    if ratio < 1.0:
        for obj in objects:
            modifier = obj.modifiers.new("map camera LOD", "DECIMATE")
            modifier.ratio = ratio
            modifier.use_collapse_triangulate = True
            select_only(obj)
            bpy.ops.object.modifier_apply(modifier=modifier.name)
    after = sum(triangles(obj.data) for obj in objects)
    if after > target + len(objects) * 16:
        raise ValueError(f"Group LOD exceeded target: {after} > {target}")
    return {
        "sourceTriangles": before,
        "targetTriangles": target,
        "collapseRatio": ratio,
        "lodTriangles": after,
    }


def import_asset(
    asset: str, config: dict[str, object]
) -> tuple[list[bpy.types.Object], dict[str, object]]:
    source = Path(config["source"])
    require_complete_glb(source)
    receipt_path = Path(config["receipt"])
    receipt = json.loads(receipt_path.read_text())
    source_hash = digest(source)
    if not receipt_contains_hash(receipt, source_hash):
        raise RuntimeError(f"{asset} source does not match its archive receipt")
    before_objects = set(bpy.data.objects)
    before_materials = set(bpy.data.materials)
    bpy.ops.import_scene.gltf(filepath=str(source))
    imported = [obj for obj in bpy.data.objects if obj not in before_objects]
    mesh_objects = [obj for obj in imported if obj.type == "MESH"]
    if not mesh_objects:
        raise ValueError(f"{asset} expected at least one mesh object")
    raw_topology = {obj.name: topology(obj.data) for obj in mesh_objects}
    normalized = normalize_objects(mesh_objects, config["targetDimensions"])
    aperture_correction = (
        widen_connector_aperture(mesh_objects, config["targetDimensions"])
        if asset == "twin_connector"
        else None
    )
    weld = {obj.name: weld_and_triangulate(obj.data) for obj in mesh_objects}
    welded_topology = {obj.name: topology(obj.data) for obj in mesh_objects}
    lod = decimate_group(mesh_objects, int(config["targetTriangles"]))
    for index, obj in enumerate(mesh_objects):
        suffix = "" if len(mesh_objects) == 1 else f"_{index:02d}"
        obj.name = f"{config['node']}_geometry{suffix}"
        obj.data.name = obj.name + "_mesh"
        obj["role"] = "map-landmark"
    imported_materials = [
        material for material in bpy.data.materials if material not in before_materials
    ]
    if not imported_materials:
        raise ValueError(f"{asset} lost its PBR material")
    for index, material in enumerate(imported_materials):
        suffix = "" if len(imported_materials) == 1 else f"_{index:02d}"
        material.name = f"map_{asset}_atlas{suffix}"
    images = material_images(imported_materials)
    if not images:
        raise ValueError(f"{asset} lost its texture atlas")
    for index, image in enumerate(sorted(images, key=lambda item: item.name)):
        image.name = f"map_{asset}_texture_{index:02d}"
        image.pack()
    if any(obj.data.uv_layers.active is None for obj in mesh_objects):
        raise ValueError(f"{asset} lost UV0 on a mesh")
    for other in imported:
        if other not in mesh_objects:
            bpy.data.objects.remove(other, do_unlink=True)
    return mesh_objects, {
        "source": {
            "file": str(source.relative_to(ART)),
            "bytes": source.stat().st_size,
            "sha256": source_hash,
            "receipt": str(receipt_path.relative_to(ART)),
            "taskId": receipt.get("taskId", receipt.get("task_id")),
            "consumedCredits": receipt.get("finalStatus", {}).get(
                "consumed_credits",
                receipt.get("consumedCredits", receipt.get("consumed_credits")),
            ),
        },
        "rawTopology": raw_topology,
        "weld": weld,
        "weldedTopology": welded_topology,
        "lod": lod,
        "normalization": normalized,
        "apertureCorrection": aperture_correction,
        "front": config["front"],
        "uvLayers": {
            obj.name: [layer.name for layer in obj.data.uv_layers]
            for obj in mesh_objects
        },
        "fullTextureImages": image_rows(images),
        "materials": [material.name for material in imported_materials],
    }


def descendants(root: bpy.types.Object) -> list[bpy.types.Object]:
    result: list[bpy.types.Object] = []
    pending = list(root.children)
    while pending:
        current = pending.pop()
        result.append(current)
        pending.extend(current.children)
    return result


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
    textures = document.get("textures", [])
    images = document.get("images", [])

    def texture_binding(record: dict[str, object] | None) -> dict[str, object] | None:
        if record is None:
            return None
        texture_index = int(record["index"])
        image_index = int(textures[texture_index]["source"])
        return {
            "textureIndex": texture_index,
            "imageIndex": image_index,
            "imageName": images[image_index].get("name"),
            "mimeType": images[image_index].get("mimeType"),
        }

    material_contract = []
    for material in document.get("materials", []):
        pbr = material.get("pbrMetallicRoughness", {})
        transmission = material.get("extensions", {}).get(
            "KHR_materials_transmission"
        )
        material_contract.append(
            {
                "name": material.get("name"),
                "baseColor": texture_binding(pbr.get("baseColorTexture")),
                "metallicRoughness": texture_binding(
                    pbr.get("metallicRoughnessTexture")
                ),
                "normal": texture_binding(material.get("normalTexture")),
                "transmissionFactor": (
                    transmission.get("transmissionFactor")
                    if transmission is not None
                    else None
                ),
                "transmission": texture_binding(
                    transmission.get("transmissionTexture")
                    if transmission is not None
                    else None
                ),
            }
        )
    by_name = {row["name"]: row for row in material_contract}
    connector = by_name.get("map_twin_connector_atlas")
    conservatory = by_name.get("map_conservatory_atlas")
    if connector is None or connector["transmission"] is not None:
        raise ValueError("Connector material contract lost matte ivory/gold response")
    if conservatory is None or conservatory["transmission"] is None:
        raise ValueError("Conservatory material contract lost celadon transmission map")
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
        "materialContract": material_contract,
    }


def clear_aperture_widths(objects: list[bpy.types.Object]) -> dict[str, object]:
    low, high = object_bounds(objects)
    trees = []
    for obj in objects:
        vertices = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
        polygons = [tuple(polygon.vertices) for polygon in obj.data.polygons]
        trees.append(BVHTree.FromPolygons(vertices, polygons, all_triangles=False))
    samples = 401
    xs = np.linspace(low.x, high.x, samples)
    direction = Vector((0.0, 1.0, 0.0))
    distance = (high.y - low.y) + 0.2
    rows = []
    for fraction in (0.16, 0.28, 0.40):
        height = low.z + (high.z - low.z) * fraction
        clear = []
        for x in xs:
            origin = Vector((float(x), low.y - 0.1, height))
            blocked = any(
                tree.ray_cast(origin, direction, distance)[0] is not None
                for tree in trees
            )
            clear.append(not blocked)
        centre = min(range(samples), key=lambda index: abs(xs[index]))
        left = centre
        right = centre
        if clear[centre]:
            while left > 0 and clear[left - 1]:
                left -= 1
            while right + 1 < samples and clear[right + 1]:
                right += 1
        width = float(xs[right] - xs[left]) if clear[centre] else 0.0
        rows.append(
            {
                "heightFraction": fraction,
                "heightMetres": height,
                "clearWidthMetres": width,
            }
        )
    return {
        "method": "front-to-back ray grid through the central opening after fresh GLB import",
        "samplesAcrossWidth": samples,
        "rows": rows,
        "minimumSampledClearWidthMetres": min(row["clearWidthMetres"] for row in rows),
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
        convert = (
            bool(set(roles) & {"baseColor", "emissive"})
            and "normal" not in roles
            and image.get("mimeType") != "image/jpeg"
        )
        output = source
        source_image = PILImage.open(BytesIO(source))
        source_dimensions = list(source_image.size)
        if convert:
            opened = source_image.convert("RGB")
            encoded = BytesIO()
            opened.save(
                encoded,
                format="JPEG",
                quality=84,
                optimize=True,
                subsampling=1,
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
        "method": "JPEG quality 84 for base-color/emissive; channel-packed metallic-roughness, transmission masks, and normals remain PNG",
        "sourceBytes": len(raw),
        "runtimeBytes": len(result),
        "images": image_rows,
    }


def fresh_reimport() -> dict[str, object]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(KIT_GLB))
    root = bpy.data.objects.get(ROOT_NAME)
    if root is None:
        raise ValueError(f"Fresh import lost {ROOT_NAME}")
    rows: dict[str, object] = {}
    for asset, config in ASSETS.items():
        node = bpy.data.objects.get(str(config["node"]))
        if node is None or node.parent != root:
            raise ValueError(f"Fresh import lost hierarchy for {config['node']}")
        meshes = [obj for obj in descendants(node) if obj.type == "MESH"]
        if not meshes:
            raise ValueError(f"{config['node']} expected mesh children")
        low, high = object_bounds(meshes)
        anchor_error = abs(low.z) if config["anchor"] == "bottom" else abs(high.z)
        if anchor_error > 1e-5:
            raise ValueError(f"Fresh import anchor failed for {config['node']}: {anchor_error}")
        tri_count = sum(triangles(obj.data) for obj in meshes)
        if tri_count > int(config["targetTriangles"]) + len(meshes) * 16:
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
        dimensions = [high.x - low.x, high.z - low.z, high.y - low.y]
        for actual, target in zip(dimensions, config["targetDimensions"], strict=True):
            if abs(actual - target) > 1e-4:
                raise ValueError(
                    f"Fresh import bounds failed for {config['node']}: {dimensions}"
                )
        aperture = None
        if "minimumAperture" in config:
            aperture = clear_aperture_widths(meshes)
            if aperture["minimumSampledClearWidthMetres"] < float(
                config["minimumAperture"]
            ):
                raise ValueError(
                    f"Fresh import aperture failed for {config['node']}: {aperture}"
                )
        rows[str(config["node"])] = {
            "meshChildren": [obj.name for obj in meshes],
            "triangles": tri_count,
            "boundsBlenderZUpMetres": {"min": list(low), "max": list(high)},
            "dimensionsGlTfYUpMetres": dimensions,
            "anchorErrorMetres": anchor_error,
            "uvLayers": {
                obj.name: [layer.name for layer in obj.data.uv_layers]
                for obj in meshes
            },
            "topology": {obj.name: topology(obj.data) for obj in meshes},
            "runtimeTextureImages": image_rows(images),
            "aperture": aperture,
        }
    return {
        "root": ROOT_NAME,
        "coordinates": "Fresh GLB reimport into Blender Z-up; dimensions listed in glTF X/Y/Z order.",
        "nodes": rows,
    }


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if TEXTURE_DIR.exists():
        shutil.rmtree(TEXTURE_DIR)
    TEXTURE_DIR.mkdir(parents=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "METERS"
    root = bpy.data.objects.new(ROOT_NAME, None)
    bpy.context.scene.collection.objects.link(root)
    root["assetId"] = ASSET_ID
    root["units"] = "metres"
    receipts: dict[str, object] = {}
    for asset, config in ASSETS.items():
        geometry_objects, receipt = import_asset(asset, config)
        group = bpy.data.objects.new(str(config["node"]), None)
        bpy.context.scene.collection.objects.link(group)
        group.parent = root
        group["assetId"] = f"floating-museum-{asset.replace('_', '-')}-v6"
        group["anchor"] = receipt["normalization"]["anchor"]
        group["front"] = config["front"]
        for geometry in geometry_objects:
            geometry.parent = group
        receipts[asset] = receipt
    bpy.context.view_layer.update()

    for asset, config in ASSETS.items():
        material_reports = []
        for index, material_name in enumerate(receipts[asset]["materials"]):
            material = bpy.data.materials.get(material_name)
            if material is None:
                raise ValueError(f"Missing {material_name} before runtime finishing")
            material_reports.append(
                configure_runtime_material(
                    asset,
                    material,
                    index,
                    int(config["textureLimit"]),
                    asset == "conservatory",
                )
            )
        receipts[asset]["runtimeMaterials"] = material_reports
    for image in list(bpy.data.images):
        if image.users == 0:
            bpy.data.images.remove(image)
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
        "exactProductionTexturesPacked": True,
        "missingExternalFiles": missing,
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
        {ROOT_NAME, "map_twin_connector", "map_conservatory"},
    )
    fresh = fresh_reimport()
    total_triangles = sum(row["triangles"] for row in fresh["nodes"].values())
    if total_triangles >= 45_000:
        raise ValueError(f"Combined triangle budget failed: {total_triangles}")
    manifest = {
        "schema": 1,
        "assetId": ASSET_ID,
        "status": "structurally validated map landmark kit; isolated visual proof pending",
        "coordinates": "Blender Z-up authoring; exported glTF +Y up; metres",
        "root": ROOT_NAME,
        "sources": receipts,
        "packedBlend": packed_source,
        "glb": structure,
        "runtimeCompression": compression,
        "freshReimport": fresh,
        "totalTriangles": total_triangles,
        "validation": {
            "rawArchiveReceiptsMatched": True,
            "packedEditableProductionSource": True,
            "requiredNamedHierarchy": True,
            "freshGlbReimport": True,
            "triangleBudgetsPassed": True,
            "runtimeTextureBudgetsPassed": True,
            "uv0Present": True,
            "anchorsPassed": True,
            "connectorAperturePassed": True,
            "continuousSemanticMaterialMaps": True,
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
                "rtk proxy env ALSOFT_DRIVERS=null blender -b --factory-startup "
                "--python-exit-code 1 --python "
                "art/glass-adventure/journey-map/v6/production/build_architecture_kit.py"
            ),
            "blender": bpy.app.version_string,
        },
        "proofs": [],
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(KIT_GLB, PUBLIC_GLB)
    if digest(PUBLIC_GLB) != structure["sha256"]:
        raise ValueError("Public V6 GLB differs from the validated export")
    public_manifest = {
        "version": 1,
        "description": (
            "Twin Galleries connector and distinct botanical conservatory landmarks "
            "for the live Floating Museum map."
        ),
        "assets": [
            {
                "id": ASSET_ID,
                "file": KIT_GLB.name,
                "source": str(KIT_GLB.relative_to(REPO)),
                "sourceReceipt": str(MANIFEST.relative_to(REPO)),
                "sha256": structure["sha256"],
                "bytes": structure["bytes"],
                "root": ROOT_NAME,
                "nodes": ["map_twin_connector", "map_conservatory"],
            }
        ],
    }
    PUBLIC_MANIFEST.write_text(json.dumps(public_manifest, indent=2) + "\n")
    print(
        "FLOATING_MUSEUM_ARCHITECTURE_KIT_BUILT="
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
