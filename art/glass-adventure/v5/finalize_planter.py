"""Finalize the preserved Meshy planter and export a measured playable derivative."""

import hashlib
import json
import struct
import tempfile
from pathlib import Path

import bpy
from mathutils import Vector


HERE = Path(__file__).resolve().parent
SOURCE = HERE / "sources/planter-imported.blend"
DONOR = HERE / "meshy/planter-donor.glb"
FINAL_BLEND = HERE / "sources/crystal-planter-final-v1.blend"
EXPORT = HERE / "exports/crystal-planter.glb"
PROOF = HERE / "proofs/crystal-planter-front-three-quarter.png"
RECEIPT = HERE / "exports/crystal-planter-receipt.json"

ROOT_NAME = "decor_crystal_planter"
MESH_NAME = "decor_crystal_planter_mesh"
MATERIAL_NAME = "meshy_crystal_planter_atlas"
TARGET_HEIGHT_METRES = 1.4

TEXTURE_ROLES = {
    "Image_0": ("basecolor", True),
    "Image_1": ("orm", False),
    "Image_3": ("emission", True),
    "normal": ("normal", False),
}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def bounds_for_vertices(vertices):
    low = [min(vertex.co[axis] for vertex in vertices) for axis in range(3)]
    high = [max(vertex.co[axis] for vertex in vertices) for axis in range(3)]
    return {
        "min": low,
        "max": high,
        "dimensions": [high[axis] - low[axis] for axis in range(3)],
    }


def world_bounds(obj):
    points = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
    low = [min(point[axis] for point in points) for axis in range(3)]
    high = [max(point[axis] for point in points) for axis in range(3)]
    return {
        "min": low,
        "max": high,
        "dimensions": [high[axis] - low[axis] for axis in range(3)],
    }


def topology_digest(mesh):
    value = hashlib.sha256()
    for polygon in mesh.polygons:
        value.update(struct.pack("<I", len(polygon.vertices)))
        for vertex_index in polygon.vertices:
            value.update(struct.pack("<I", vertex_index))
    return value.hexdigest()


def uv_digest(mesh):
    value = hashlib.sha256()
    layer = mesh.uv_layers.active
    assert layer is not None, "The planter donor must retain its UV map"
    for loop in layer.data:
        value.update(struct.pack("<ff", loop.uv.x, loop.uv.y))
    return value.hexdigest()


def image_nodes(material):
    assert material.use_nodes, "The planter atlas material must use nodes"
    return [
        node
        for node in material.node_tree.nodes
        if node.type == "TEX_IMAGE" and node.image is not None
    ]


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_area_light(name, location, energy, size, colour):
    light = bpy.data.lights.new(name, "AREA")
    light.energy = energy
    light.shape = "DISK"
    light.size = size
    light.color = colour
    obj = bpy.data.objects.new(name, light)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    point_at(obj, (0.0, 0.0, 0.68))
    return obj


def render_proof(planter):
    scene = bpy.context.scene
    scene.render.resolution_x = 768
    scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.filepath = str(PROOF)

    world = scene.world or bpy.data.worlds.new("planter-proof-world")
    scene.world = world
    world.use_nodes = True
    background = next(node for node in world.node_tree.nodes if node.type == "BACKGROUND")
    background.inputs["Color"].default_value = (0.018, 0.026, 0.038, 1.0)
    background.inputs["Strength"].default_value = 0.32

    bpy.ops.mesh.primitive_plane_add(size=200.0, location=(0.0, 0.0, -0.004))
    floor = bpy.context.object
    floor.name = "proof_floor"
    floor_material = bpy.data.materials.new("proof_floor_material")
    floor_material.use_nodes = True
    floor_shader = next(
        node for node in floor_material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"
    )
    floor_shader.inputs["Base Color"].default_value = (0.035, 0.045, 0.06, 1.0)
    floor_shader.inputs["Roughness"].default_value = 0.82
    floor.data.materials.append(floor_material)

    camera_data = bpy.data.cameras.new("planter-proof-camera")
    camera_data.lens = 58
    camera = bpy.data.objects.new("planter-proof-camera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = (2.25, -2.75, 1.82)
    point_at(camera, (0.0, 0.0, 0.69))
    scene.camera = camera

    add_area_light(
        "planter-proof-key", (2.4, -2.9, 3.4), 850, 2.6, (1.0, 0.88, 0.74)
    )
    add_area_light(
        "planter-proof-fill", (-2.5, -1.2, 2.25), 520, 3.2, (0.61, 0.77, 1.0)
    )
    add_area_light(
        "planter-proof-rim", (1.4, 2.3, 2.8), 700, 2.1, (0.58, 0.88, 1.0)
    )

    planter.select_set(False)
    PROOF.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.render.render(write_still=True)
    assert PROOF.is_file() and PROOF.stat().st_size > 0, "Proof render was not written"


def runtime_texture_derivatives(material, originals, temp):
    textures = []
    referenced = {node.image.name for node in image_nodes(material)}
    assert referenced == set(TEXTURE_ROLES), (
        f"Unexpected planter atlas images: {sorted(referenced)}"
    )

    for original in originals:
        role, use_jpeg = TEXTURE_ROLES[original.name]
        assert tuple(original.size) == (2048, 2048), (
            f"{original.name} must remain a packed 2K authoring atlas"
        )
        assert original.packed_file is not None, f"{original.name} must remain packed"
        colour_space = original.colorspace_settings.name
        assert use_jpeg == (colour_space == "sRGB"), (
            f"Unexpected colour space for {original.name}: {colour_space}"
        )
        if use_jpeg:
            alpha = original.pixels[3::4]
            assert min(alpha) == 1.0 and max(alpha) == 1.0, (
                f"{original.name} cannot be flattened to JPEG because it uses alpha"
            )

        working = original.copy()
        working.name = f"{original.name}_runtime_work"
        working.scale(1024, 1024)
        working.file_format = "JPEG" if use_jpeg else "PNG"
        suffix = "jpg" if use_jpeg else "png"
        path = Path(temp) / f"crystal-planter-{role}.{suffix}"
        working.filepath_raw = str(path)
        working.save(quality=95)

        replacement = bpy.data.images.load(str(path), check_existing=False)
        replacement.name = f"crystal-planter-{role}"
        replacement.colorspace_settings.name = colour_space
        for node in image_nodes(material):
            if node.image == original:
                node.image = replacement

        textures.append(
            {
                "sourceName": original.name,
                "role": role,
                "format": "JPEG" if use_jpeg else "PNG",
                "quality": 95 if use_jpeg else None,
                "colorSpace": colour_space,
                "dimensions": list(replacement.size),
                "bytes": path.stat().st_size,
                "sha256": digest(path),
            }
        )
    return textures


def run():
    source_hash_before = digest(SOURCE)
    source_bytes = SOURCE.stat().st_size
    donor_hash = digest(DONOR)
    donor_bytes = DONOR.stat().st_size
    assert Path(bpy.data.filepath).resolve() == SOURCE.resolve(), (
        f"Run this script in Blender background mode with {SOURCE}"
    )

    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    assert len(mesh_objects) == 1, "Expected one isolated donor mesh"
    obj = mesh_objects[0]
    assert obj.parent is None, "The imported donor mesh should be a root object"
    assert obj.matrix_world.is_identity, "The imported donor transform must be identity"
    mesh = obj.data
    assert len(mesh.vertices) == 15898, "Unexpected donor vertex count"
    assert len(mesh.polygons) == 9236, "Unexpected donor polygon count"
    assert all(len(polygon.vertices) == 3 for polygon in mesh.polygons), (
        "The donor is expected to contain triangles only"
    )
    assert len(mesh.materials) == 1, "Expected one donor atlas material"
    assert len(mesh.uv_layers) == 1, "Expected one donor UV layer"

    material = mesh.materials[0]
    originals = sorted(
        {node.image for node in image_nodes(material)}, key=lambda image: image.name
    )
    assert {image.name for image in originals} == set(TEXTURE_ROLES)

    source_bounds = bounds_for_vertices(mesh.vertices)
    topology_before = topology_digest(mesh)
    uv_before = uv_digest(mesh)
    source_positions = [vertex.co.copy() for vertex in mesh.vertices]

    scale = TARGET_HEIGHT_METRES / source_bounds["dimensions"][2]
    centre_x = (source_bounds["min"][0] + source_bounds["max"][0]) / 2
    centre_y = (source_bounds["min"][1] + source_bounds["max"][1]) / 2
    min_z = source_bounds["min"][2]
    offset = Vector((centre_x, centre_y, min_z))
    for vertex in mesh.vertices:
        vertex.co = (vertex.co - offset) * scale
    mesh.update()
    bpy.context.view_layer.update()

    transform_error = max(
        (
            vertex.co - (source_position - offset) * scale
        ).length
        for vertex, source_position in zip(mesh.vertices, source_positions)
    )
    final_bounds = bounds_for_vertices(mesh.vertices)
    assert abs(final_bounds["min"][2]) < 1e-7, "Planter bottom must sit at Z=0"
    assert abs(final_bounds["dimensions"][2] - TARGET_HEIGHT_METRES) < 1e-6
    assert topology_digest(mesh) == topology_before, "Topology changed during normalization"
    assert uv_digest(mesh) == uv_before, "UVs changed during normalization"

    obj.name = ROOT_NAME
    mesh.name = MESH_NAME
    material.name = MATERIAL_NAME
    obj["source_kind"] = "meshy-donor-finalized-in-blender"
    obj["coordinates"] = "GLB +Y up, +Z front, bottom-centre origin, metres"
    obj["geometry_policy"] = "Uniform scale and origin normalization only"
    obj.location = (0.0, 0.0, 0.0)
    obj.rotation_euler = (0.0, 0.0, 0.0)
    obj.scale = (1.0, 1.0, 1.0)

    for image in originals:
        assert tuple(image.size) == (2048, 2048)
        assert image.packed_file is not None
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0
    bpy.ops.file.pack_all()
    FINAL_BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(FINAL_BLEND))
    final_blend_hash = digest(FINAL_BLEND)
    final_blend_bytes = FINAL_BLEND.stat().st_size

    # The proof is rendered from the packed 2K authoring textures. Studio
    # objects are added only after saving and never enter the playable export.
    render_proof(obj)

    EXPORT.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="glass-planter-export-") as temp:
        textures = runtime_texture_derivatives(material, originals, temp)
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.export_scene.gltf(
            filepath=str(EXPORT),
            export_format="GLB",
            use_selection=True,
            export_yup=True,
            export_texcoords=True,
            export_normals=True,
            export_tangents=True,
            export_materials="EXPORT",
            export_image_format="AUTO",
            export_jpeg_quality=95,
        )

    assert digest(SOURCE) == source_hash_before, "Imported source Blend was modified"
    assert digest(FINAL_BLEND) == final_blend_hash, "Final authoring Blend was modified"

    export_hash = digest(EXPORT)
    export_bytes = EXPORT.stat().st_size
    proof_hash = digest(PROOF)
    proof_bytes = PROOF.stat().st_size

    authoring = {
        "rootNode": ROOT_NAME,
        "mesh": MESH_NAME,
        "material": MATERIAL_NAME,
        "vertices": len(mesh.vertices),
        "polygons": len(mesh.polygons),
        "triangles": sum(len(polygon.vertices) - 2 for polygon in mesh.polygons),
        "uvLayers": len(mesh.uv_layers),
        "sourceBoundsBlenderZUp": source_bounds,
        "finalBoundsBlenderZUp": final_bounds,
        "uniformScale": scale,
        "uniformTransformMaxErrorMetres": transform_error,
        "topologySha256Before": topology_before,
        "topologySha256After": topology_digest(mesh),
        "uvSha256Before": uv_before,
        "uvSha256After": uv_digest(mesh),
    }

    # Re-import the GLB into an empty file so the receipt describes the
    # derivative the game will consume rather than only the authoring scene.
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(EXPORT))
    imported = bpy.data.objects.get(ROOT_NAME)
    assert imported is not None, f"Export is missing root node {ROOT_NAME}"
    assert imported.parent is None, "Playable root must remain top-level"
    assert imported.type == "MESH", "Playable root must be the planter mesh"
    assert imported.data.materials[0].name == MATERIAL_NAME
    imported_bounds = world_bounds(imported)
    imported_triangles = sum(
        len(polygon.vertices) - 2 for polygon in imported.data.polygons
    )
    assert imported_triangles == authoring["triangles"]
    assert abs(imported_bounds["min"][2]) < 1e-5
    assert abs(imported_bounds["dimensions"][2] - TARGET_HEIGHT_METRES) < 1e-5
    runtime_images = sorted(
        {
            node.image
            for node in image_nodes(imported.data.materials[0])
            if node.image is not None
        },
        key=lambda image: image.name,
    )
    assert len(runtime_images) == 4
    assert all(tuple(image.size) == (1024, 1024) for image in runtime_images)

    receipt = {
        "schema": 1,
        "assetId": "crystal-planter-v5",
        "blender": bpy.app.version_string,
        "source": {
            "blend": str(SOURCE.relative_to(HERE)),
            "blendBytes": source_bytes,
            "blendSha256": source_hash_before,
            "donorGlb": str(DONOR.relative_to(HERE)),
            "donorGlbBytes": donor_bytes,
            "donorGlbSha256": donor_hash,
            "vertices": authoring["vertices"],
            "triangles": authoring["triangles"],
        },
        "authoring": {
            **authoring,
            "blend": str(FINAL_BLEND.relative_to(HERE)),
            "blendBytes": final_blend_bytes,
            "blendSha256": final_blend_hash,
            "packedTextureDimensions": [2048, 2048],
        },
        "playable": {
            "glb": str(EXPORT.relative_to(HERE)),
            "glbBytes": export_bytes,
            "glbSha256": export_hash,
            "coordinates": "GLB +Y up, +Z front, bottom-centre origin, metres",
            "boundsReimportedBlenderZUp": imported_bounds,
            "verticesReimported": len(imported.data.vertices),
            "trianglesReimported": imported_triangles,
            "textures": textures,
        },
        "proof": {
            "image": str(PROOF.relative_to(HERE)),
            "bytes": proof_bytes,
            "sha256": proof_hash,
            "view": "Front three-quarter studio render from packed 2K authoring textures",
        },
        "collisionProxyRecommendation": {
            "shape": "cylinder",
            "radiusTopMetres": 0.29,
            "radiusBottomMetres": 0.17,
            "topMetres": 0.48,
            "thicknessMetres": 0.48,
            "scope": "Marble-and-brass bowl only; foliage and crystal fronds remain nonblocking",
        },
        "edits": [
            "Uniformly scaled the donor to 1.4 metres high",
            "Moved the origin to the horizontal centre and lowest geometry point",
            "Renamed the root, mesh and original atlas material for stable reuse",
            "Preserved donor topology, UVs and packed 2K PBR atlas",
            "Exported fresh 1K JPEG colour and lossless PNG data texture datablocks",
        ],
    }
    RECEIPT.write_text(json.dumps(receipt, indent=2) + "\n")
    return receipt


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))
