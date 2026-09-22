"""Build the packed, review-only V7 twin-connector candidate without runtime integration."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
import struct

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree


HERE = Path(__file__).resolve().parent
ART = HERE.parent
SOURCE = ART / "meshy" / "twin-connector-remesh-100k-retexture-pbr.glb"
RECEIPT = ART / "meshy" / "twin-connector-remesh-100k-retexture-pbr-receipt.json"
BLEND = ART / "sources" / "floating-museum-twin-connector-candidate-v7.blend"
GLB = ART / "exports" / "floating-museum-twin-connector-candidate-v7.glb"
MANIFEST = ART / "exports" / "floating-museum-twin-connector-candidate-v7.json"
ROOT_NAME = "map_museum_polish_kit_root"
GROUP_NAME = "map_twin_connector"
GEOMETRY_NAME = "map_twin_connector_geometry"
TARGET_DIMENSIONS = (1.70, 2.80, 0.80)
MINIMUM_APERTURE = 0.80
EXPECTED_SOURCE_SHA256 = "3e3011719a7b5599f2dde35a4f5685cbc1cc68c136509a0ba498409c1689f459"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require_complete_glb(path: Path) -> None:
    raw = path.read_bytes()
    if (
        len(raw) < 12
        or raw[:4] != b"glTF"
        or struct.unpack_from("<I", raw, 8)[0] != len(raw)
    ):
        raise ValueError(f"Incomplete GLB at {path.name}")


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


def vertex_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points = [
        obj.matrix_world @ vertex.co
        for obj in objects
        for vertex in obj.data.vertices
    ]
    return (
        Vector(min(point[axis] for point in points) for axis in range(3)),
        Vector(max(point[axis] for point in points) for axis in range(3)),
    )


def normalize_objects(objects: list[bpy.types.Object]) -> dict[str, object]:
    low, high = vertex_bounds(objects)
    source_dimensions = Vector((high.x - low.x, high.z - low.z, high.y - low.y))
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
    dimensions = [
        final_high.x - final_low.x,
        final_high.z - final_low.z,
        final_high.y - final_low.y,
    ]
    if abs(final_low.z) > 1e-6:
        raise ValueError("Normalized connector missed its ground anchor")
    for actual, target in zip(dimensions, TARGET_DIMENSIONS, strict=True):
        if abs(actual - target) > 1e-5:
            raise ValueError(f"Normalized dimension {actual} missed {target}")
    return {
        "scaleBlenderXYZ": list(scales),
        "sourceDimensionsGlTfYUp": list(source_dimensions),
        "dimensionsGlTfYUpMetres": dimensions,
        "anchor": "ground/bottom Y=0",
        "anchorErrorMetres": abs(final_low.z),
    }


def widen_connector_aperture(objects: list[bpy.types.Object]) -> dict[str, object]:
    target_width, target_height, _ = TARGET_DIMENSIONS
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
        "method": "Same bounded lower-arch widening used by the V6 connector build",
        "verticesShifted": shifted,
        "maximumShiftMetres": largest,
        "exteriorBoundsPreserved": True,
    }


def clear_aperture_widths(objects: list[bpy.types.Object]) -> dict[str, object]:
    low, high = vertex_bounds(objects)
    trees = []
    for obj in objects:
        vertices = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
        polygons = [tuple(polygon.vertices) for polygon in obj.data.polygons]
        trees.append(BVHTree.FromPolygons(vertices, polygons, all_triangles=False))
    samples = 401
    rows = []
    for fraction in (0.16, 0.28, 0.40):
        height = low.z + (high.z - low.z) * fraction
        clear = []
        for index in range(samples):
            x = low.x + (high.x - low.x) * index / (samples - 1)
            origin = Vector((x, low.y - 0.1, height))
            blocked = any(
                tree.ray_cast(origin, Vector((0.0, 1.0, 0.0)), (high.y - low.y) + 0.2)[0]
                is not None
                for tree in trees
            )
            clear.append(not blocked)
        centre = min(
            range(samples),
            key=lambda index: abs(low.x + (high.x - low.x) * index / (samples - 1)),
        )
        left = centre
        right = centre
        if clear[centre]:
            while left > 0 and clear[left - 1]:
                left -= 1
            while right + 1 < samples and clear[right + 1]:
                right += 1
        width = (high.x - low.x) * (right - left) / (samples - 1) if clear[centre] else 0.0
        rows.append(
            {
                "heightFraction": fraction,
                "heightMetres": height,
                "clearWidthMetres": width,
            }
        )
    return {
        "method": "Front-to-back ray grid through the central opening",
        "samplesAcrossWidth": samples,
        "rows": rows,
        "minimumSampledClearWidthMetres": min(row["clearWidthMetres"] for row in rows),
    }


def image_rows() -> list[dict[str, object]]:
    return [
        {
            "name": image.name,
            "dimensions": list(image.size),
            "colorSpace": image.colorspace_settings.name,
            "packed": image.packed_file is not None,
        }
        for image in bpy.data.images
        if image.type == "IMAGE"
    ]


def descendants(root: bpy.types.Object) -> list[bpy.types.Object]:
    result: list[bpy.types.Object] = []
    pending = list(root.children)
    while pending:
        current = pending.pop()
        result.append(current)
        pending.extend(current.children)
    return result


def glb_document(path: Path) -> dict[str, object]:
    raw = path.read_bytes()
    json_length, json_type = struct.unpack_from("<II", raw, 12)
    if json_type != 0x4E4F534A:
        raise ValueError("Exported connector GLB has no JSON chunk")
    return json.loads(raw[20 : 20 + json_length].decode("utf-8").rstrip(" \x00"))


def fresh_reimport() -> dict[str, object]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(GLB))
    root = bpy.data.objects.get(ROOT_NAME)
    group = bpy.data.objects.get(GROUP_NAME)
    if root is None or group is None:
        raise ValueError("Fresh GLB import lost the stable museum connector nodes")
    meshes = [obj for obj in descendants(group) if obj.type == "MESH"]
    if not meshes:
        raise ValueError("Fresh GLB import has no connector mesh")
    low, high = vertex_bounds(meshes)
    dimensions = [high.x - low.x, high.z - low.z, high.y - low.y]
    for actual, target in zip(dimensions, TARGET_DIMENSIONS, strict=True):
        if abs(actual - target) > 1e-4:
            raise ValueError(f"Fresh reimport dimension {actual} missed {target}")
    aperture = clear_aperture_widths(meshes)
    if aperture["minimumSampledClearWidthMetres"] < MINIMUM_APERTURE:
        raise ValueError(f"Fresh connector aperture is too narrow: {aperture}")
    images = image_rows()
    if len(images) != 4 or any(row["dimensions"] != [2048, 2048] for row in images):
        raise ValueError(f"Fresh GLB lost its four 2K provider texture maps: {images}")
    if any(obj.data.uv_layers.active is None for obj in meshes):
        raise ValueError("Fresh GLB import lost UV0")
    return {
        "triangles": sum(triangles(obj.data) for obj in meshes),
        "vertices": sum(len(obj.data.vertices) for obj in meshes),
        "dimensionsGlTfYUpMetres": dimensions,
        "anchorErrorMetres": abs(low.z),
        "aperture": aperture,
        "uvLayers": {obj.name: [layer.name for layer in obj.data.uv_layers] for obj in meshes},
        "topology": {obj.name: topology(obj.data) for obj in meshes},
        "materials": sorted(
            {
                material.name
                for obj in meshes
                for material in obj.data.materials
                if material is not None
            }
        ),
        "images": images,
    }


def main() -> None:
    require_complete_glb(SOURCE)
    receipt = json.loads(RECEIPT.read_text())
    if receipt.get("state") != "archived" or receipt.get("file", {}).get("sha256") != digest(SOURCE):
        raise ValueError("Provider PBR source does not match its archived receipt")
    if digest(SOURCE) != EXPECTED_SOURCE_SHA256:
        raise ValueError("Provider PBR source changed")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    before_objects = set(bpy.data.objects)
    before_materials = set(bpy.data.materials)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    imported = [obj for obj in bpy.data.objects if obj not in before_objects]
    meshes = [obj for obj in imported if obj.type == "MESH"]
    if not meshes:
        raise ValueError("Provider PBR source has no mesh")
    raw_topology = {obj.name: topology(obj.data) for obj in meshes}
    normalization = normalize_objects(meshes)
    aperture_correction = widen_connector_aperture(meshes)
    aperture = clear_aperture_widths(meshes)
    if aperture["minimumSampledClearWidthMetres"] < MINIMUM_APERTURE:
        raise ValueError(f"Connector aperture is too narrow after correction: {aperture}")

    root = bpy.data.objects.new(ROOT_NAME, None)
    bpy.context.scene.collection.objects.link(root)
    root["assetId"] = "floating-museum-twin-connector-candidate-v7"
    root["status"] = "review-only"
    group = bpy.data.objects.new(GROUP_NAME, None)
    bpy.context.scene.collection.objects.link(group)
    group.parent = root
    group["assetId"] = "floating-museum-twin-connector-v7"
    group["anchor"] = "bottom"
    group["front"] = "exported glTF +Z (Blender -Y)"
    for index, obj in enumerate(meshes):
        suffix = "" if len(meshes) == 1 else f"_{index:02d}"
        obj.name = GEOMETRY_NAME + suffix
        obj.data.name = obj.name + "_mesh"
        obj["role"] = "map-landmark"
        obj.parent = group
    for obj in imported:
        if obj not in meshes:
            bpy.data.objects.remove(obj, do_unlink=True)

    imported_materials = [material for material in bpy.data.materials if material not in before_materials]
    if len(imported_materials) != 1:
        raise ValueError(f"Expected one provider atlas material, found {len(imported_materials)}")
    imported_materials[0].name = "map_twin_connector_atlas"
    for index, image in enumerate(sorted((image for image in bpy.data.images if image.type == "IMAGE"), key=lambda item: item.name)):
        image.name = f"map_twin_connector_texture_{index:02d}"
        image.pack()
    images = image_rows()
    if len(images) != 4 or any(row["dimensions"] != [2048, 2048] for row in images):
        raise ValueError(f"Provider PBR source lost its four 2K maps: {images}")
    if any(obj.data.uv_layers.active is None for obj in meshes):
        raise ValueError("Provider PBR source lost UV0")

    bpy.ops.file.pack_all()
    BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND), compress=True, check_existing=False)
    packed = {
        "file": str(BLEND.relative_to(ART)),
        "bytes": BLEND.stat().st_size,
        "sha256": digest(BLEND),
        "imagesPacked": True,
    }

    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for obj in descendants(root):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    GLB.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(GLB),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_materials="EXPORT",
    )
    require_complete_glb(GLB)
    document = glb_document(GLB)
    names = {node.get("name") for node in document.get("nodes", [])}
    if not {ROOT_NAME, GROUP_NAME, GEOMETRY_NAME}.issubset(names):
        raise ValueError(f"Exported GLB lost stable node names: {names}")
    structure = {
        "file": str(GLB.relative_to(ART)),
        "bytes": GLB.stat().st_size,
        "sha256": digest(GLB),
        "nodes": len(document.get("nodes", [])),
        "meshes": len(document.get("meshes", [])),
        "materials": len(document.get("materials", [])),
        "images": len(document.get("images", [])),
        "textures": len(document.get("textures", [])),
        "extensionsUsed": document.get("extensionsUsed", []),
        "requiredNamedNodesPresent": True,
    }
    fresh = fresh_reimport()
    if fresh["triangles"] != 102_607:
        raise ValueError(f"Fresh export triangle count changed: {fresh['triangles']}")

    manifest = {
        "schema": 1,
        "assetId": "floating-museum-twin-connector-candidate-v7",
        "status": "review-only provider PBR connector; visual approval and runtime integration pending",
        "coordinates": "Blender Z-up authoring; exported glTF +Y up; metres",
        "root": ROOT_NAME,
        "node": GROUP_NAME,
        "source": {
            "file": str(SOURCE.relative_to(ART)),
            "bytes": SOURCE.stat().st_size,
            "sha256": digest(SOURCE),
            "receipt": str(RECEIPT.relative_to(ART)),
            "taskId": receipt.get("taskId"),
            "consumedCredits": receipt.get("finalStatus", {}).get("consumedCredits"),
            "rawTopology": raw_topology,
            "providerTextureImages": images,
        },
        "normalization": normalization,
        "apertureCorrection": aperture_correction,
        "authoringAperture": aperture,
        "packedBlend": packed,
        "glb": structure,
        "freshReimport": fresh,
        "validation": {
            "providerReceiptMatched": True,
            "packedEditableSource": True,
            "requiredNamedHierarchy": True,
            "freshGlbReimport": True,
            "triangleCountPreserved": True,
            "four2kProviderMapsPreserved": True,
            "uv0Present": True,
            "dimensionsAndAnchorPassed": True,
            "connectorAperturePassed": True,
            "visualApproval": "pending",
            "runtimeIntegration": "not performed",
        },
        "rebuild": {
            "workingDirectory": "repository root",
            "command": (
                "rtk proxy env ALSOFT_DRIVERS=null blender -b --factory-startup "
                "--python-exit-code 1 --python "
                "art/glass-adventure/journey-map/v7/production/build_connector_candidate.py"
            ),
            "blender": bpy.app.version_string,
        },
        "proofs": [],
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(
        "MUSEUM_CONNECTOR_CANDIDATE_BUILT="
        + json.dumps(
            {
                "glbBytes": structure["bytes"],
                "glbSha256": structure["sha256"],
                "triangles": fresh["triangles"],
                "dimensions": fresh["dimensionsGlTfYUpMetres"],
                "minimumAperture": fresh["aperture"]["minimumSampledClearWidthMetres"],
            }
        ),
        flush=True,
    )
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
