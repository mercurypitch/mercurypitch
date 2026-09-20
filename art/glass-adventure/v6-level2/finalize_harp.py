"""Finalize the preserved Twin-Tone Resonance Harp for authored runtime use."""

from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[2]
DONOR = HERE / "meshy" / "twin-tone-resonance-harp-donor.glb"
SOURCE_BLEND = HERE / "sources" / "twin-tone-resonance-harp-final-v2.blend"
EXPORT = HERE / "exports" / "twin-tone-resonance-harp-final-v2.glb"
PUBLIC_EXPORT = (
    REPO_ROOT
    / "apps"
    / "beside-cue"
    / "public"
    / "games"
    / "adventure-v6"
    / "twin-tone-resonance-harp.glb"
)
PROOF = HERE / "proofs" / "twin-tone-resonance-harp-final-v2.png"
RECEIPT = HERE / "exports" / "twin-tone-resonance-harp-final-v2.json"

ASSET_ID = "twin-tone-resonance-harp"
ROOT_NODE = "decor_l2_twin_tone_resonance_harp"
MESH_NODE = "twin_tone_resonance_harp_mesh_01"
MATERIAL_NAME = "twin_tone_resonance_harp_atlas_01"
COLLIDER_NODE = f"COLLIDER_{ROOT_NODE}"
TARGET_HEIGHT = 1.65
BASE_PROFILE_HEIGHT = 0.24
BASE_PROXY_DIMS = (1.30, 0.70, BASE_PROFILE_HEIGHT)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def relative(path: Path) -> str:
    return str(path.relative_to(REPO_ROOT))


def descendants(root: bpy.types.Object) -> list[bpy.types.Object]:
    result: list[bpy.types.Object] = []
    pending = list(root.children)
    while pending:
        item = pending.pop(0)
        result.append(item)
        pending.extend(item.children)
    return result


def mesh_objects(root: bpy.types.Object) -> list[bpy.types.Object]:
    return [item for item in descendants(root) if item.type == "MESH"]


def world_vertices(objects: list[bpy.types.Object]) -> list[Vector]:
    return [
        item.matrix_world @ vertex.co
        for item in objects
        for vertex in item.data.vertices
    ]


def bounds(points: list[Vector]) -> dict[str, list[float]]:
    low = [min(point[axis] for point in points) for axis in range(3)]
    high = [max(point[axis] for point in points) for axis in range(3)]
    return {
        "min": low,
        "max": high,
        "dimensions": [high[axis] - low[axis] for axis in range(3)],
    }


def topology(objects: list[bpy.types.Object]) -> dict[str, int]:
    result = {
        "meshObjects": len(objects),
        "vertices": 0,
        "triangles": 0,
        "uvLayers": 0,
        "materialSlots": 0,
    }
    for item in objects:
        item.data.calc_loop_triangles()
        result["vertices"] += len(item.data.vertices)
        result["triangles"] += len(item.data.loop_triangles)
        result["uvLayers"] += len(item.data.uv_layers)
        result["materialSlots"] += len(item.data.materials)
    return result


def referenced_images(materials: list[bpy.types.Material]) -> list[bpy.types.Image]:
    found: dict[str, bpy.types.Image] = {}
    for material in materials:
        if not material.use_nodes:
            continue
        for node in material.node_tree.nodes:
            if node.type == "TEX_IMAGE" and node.image is not None:
                found[node.image.name] = node.image
    return [found[name] for name in sorted(found)]


def image_inventory(images: list[bpy.types.Image]) -> list[dict[str, object]]:
    return [
        {
            "name": image.name,
            "dimensions": list(image.size),
            "colorSpace": image.colorspace_settings.name,
            "packed": image.packed_file is not None,
        }
        for image in images
    ]


def point_at(item: bpy.types.Object, target: Vector) -> None:
    item.rotation_euler = (target - item.location).to_track_quat("-Z", "Y").to_euler()


def add_area_light(
    name: str,
    location: tuple[float, float, float],
    energy: float,
    size: float,
    color: tuple[float, float, float],
    target: Vector,
) -> bpy.types.Object:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    item = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(item)
    item.location = location
    point_at(item, target)
    return item


def render_proof(root: bpy.types.Object, asset_bounds: dict[str, list[float]]) -> None:
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 768
    scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.filepath = str(PROOF)

    span = max(asset_bounds["dimensions"])
    height = asset_bounds["dimensions"][2]
    target = Vector((0.0, 0.0, height * 0.48))
    world = scene.world or bpy.data.worlds.new("harp-proof-world")
    scene.world = world
    world.use_nodes = True
    background = next(
        node for node in world.node_tree.nodes if node.type == "BACKGROUND"
    )
    background.inputs["Color"].default_value = (0.018, 0.026, 0.038, 1.0)
    background.inputs["Strength"].default_value = 0.35

    bpy.ops.mesh.primitive_plane_add(size=max(20.0, span * 12), location=(0, 0, -0.004))
    floor = bpy.context.object
    floor.name = "proof_floor"
    floor_material = bpy.data.materials.new("proof_floor_material")
    floor_material.use_nodes = True
    shader = next(
        node for node in floor_material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"
    )
    shader.inputs["Base Color"].default_value = (0.025, 0.034, 0.048, 1.0)
    shader.inputs["Roughness"].default_value = 0.76
    floor.data.materials.append(floor_material)

    camera_data = bpy.data.cameras.new("proof_camera")
    camera_data.lens = 58
    camera = bpy.data.objects.new("proof_camera", camera_data)
    scene.collection.objects.link(camera)
    distance = span * 2.45
    camera.location = (distance * 0.72, -distance, height * 0.78)
    point_at(camera, target)
    scene.camera = camera

    helpers = [floor, camera]
    helpers.append(
        add_area_light(
            "proof_key",
            (span * 2.1, -span * 2.4, height * 2.2),
            950,
            span * 1.7,
            (1.0, 0.82, 0.64),
            target,
        )
    )
    helpers.append(
        add_area_light(
            "proof_fill",
            (-span * 2.2, -span * 0.8, height * 1.35),
            620,
            span * 2.1,
            (0.52, 0.72, 1.0),
            target,
        )
    )
    helpers.append(
        add_area_light(
            "proof_rim",
            (span * 0.6, span * 2.0, height * 1.7),
            760,
            span * 1.4,
            (0.52, 0.9, 1.0),
            target,
        )
    )

    PROOF.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.render.render(write_still=True)
    if not PROOF.is_file() or PROOF.stat().st_size == 0:
        raise RuntimeError("Harp proof render failed")

    for helper in helpers:
        bpy.data.objects.remove(helper, do_unlink=True)
    bpy.data.materials.remove(floor_material, do_unlink=True)
    root.hide_render = False


def normalize_donor() -> tuple[
    bpy.types.Object,
    list[bpy.types.Object],
    dict[str, object],
]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "METERS"
    bpy.ops.import_scene.gltf(filepath=str(DONOR))

    imported = list(scene.objects)
    donor_meshes = [item for item in imported if item.type == "MESH"]
    if len(donor_meshes) != 1:
        raise RuntimeError(f"Expected one donor mesh, found {len(donor_meshes)}")
    donor_points = world_vertices(donor_meshes)
    donor_bounds = bounds(donor_points)
    donor_topology = topology(donor_meshes)

    centre_x = (donor_bounds["min"][0] + donor_bounds["max"][0]) / 2
    centre_y = (donor_bounds["min"][1] + donor_bounds["max"][1]) / 2
    scale = TARGET_HEIGHT / donor_bounds["dimensions"][2]
    normalizer = Matrix.Scale(scale, 4) @ Matrix.Translation(
        (-centre_x, -centre_y, -donor_bounds["min"][2])
    )
    top_level = [item for item in imported if item.parent is None]
    for item in top_level:
        item.matrix_world = normalizer @ item.matrix_world
    bpy.context.view_layer.update()

    root = bpy.data.objects.new(ROOT_NODE, None)
    scene.collection.objects.link(root)
    root["asset_id"] = ASSET_ID
    root["asset_kind"] = "reusable-decoration"
    root["gallery_family"] = "shared-court"
    root["units"] = "metres"
    for item in top_level:
        world = item.matrix_world.copy()
        item.parent = root
        item.matrix_world = world

    art_meshes = mesh_objects(root)
    if len(art_meshes) != 1:
        raise RuntimeError(f"Expected one normalized art mesh, found {len(art_meshes)}")
    art_meshes[0].name = MESH_NODE
    art_meshes[0].data.name = f"{MESH_NODE}_geometry"

    materials = [material for material in art_meshes[0].data.materials if material]
    if len(materials) != 1:
        raise RuntimeError(f"Expected one atlas material, found {len(materials)}")
    materials[0].name = MATERIAL_NAME
    images = referenced_images(materials)
    if len(images) != 4:
        raise RuntimeError(f"Expected four PBR atlas images, found {len(images)}")
    for image in images:
        image.pack()

    final_points = world_vertices(art_meshes)
    final_bounds = bounds(final_points)
    if abs(final_bounds["min"][2]) > 1e-5:
        raise RuntimeError("Normalized harp is not grounded")
    if abs(final_bounds["dimensions"][2] - TARGET_HEIGHT) > 1e-5:
        raise RuntimeError("Normalized harp height changed")
    if topology(art_meshes) != donor_topology:
        raise RuntimeError("Normalization changed donor topology or UV/material slots")

    profile_points = [
        point for point in final_points if point.z <= BASE_PROFILE_HEIGHT + 1e-6
    ]
    profile_bounds = bounds(profile_points)
    proxy_half_x = BASE_PROXY_DIMS[0] / 2
    proxy_half_y = BASE_PROXY_DIMS[1] / 2
    if (
        profile_bounds["min"][0] < -proxy_half_x
        or profile_bounds["max"][0] > proxy_half_x
        or profile_bounds["min"][1] < -proxy_half_y
        or profile_bounds["max"][1] > proxy_half_y
    ):
        raise RuntimeError("Base-only proxy no longer covers the measured lower profile")

    return root, art_meshes, {
        "donorBounds": donor_bounds,
        "donorTopology": donor_topology,
        "normalizedBounds": final_bounds,
        "baseProfileBounds": profile_bounds,
        "materials": materials,
        "images": images,
    }


def add_source_proxy(root: bpy.types.Object) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(
        size=1.0,
        location=(0.0, 0.0, BASE_PROXY_DIMS[2] / 2),
    )
    proxy = bpy.context.object
    proxy.name = COLLIDER_NODE
    proxy.data.name = f"{COLLIDER_NODE}_mesh"
    proxy.dimensions = BASE_PROXY_DIMS
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    proxy.display_type = "WIRE"
    proxy.hide_render = True
    proxy["collision_proxy"] = True
    proxy["runtime_authority"] = "authored-level-solid"
    proxy.parent = root
    return proxy


def export_runtime(root: bpy.types.Object, art_meshes: list[bpy.types.Object]) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for item in descendants(root):
        if item in art_meshes or item.type != "MESH":
            item.select_set(True)
    bpy.context.view_layer.objects.active = root
    EXPORT.parent.mkdir(parents=True, exist_ok=True)
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


def reimport_runtime() -> dict[str, object]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(EXPORT))
    root = bpy.data.objects.get(ROOT_NODE)
    if root is None:
        raise RuntimeError("Stable harp root did not survive GLB reimport")
    if bpy.data.objects.get(COLLIDER_NODE) is not None:
        raise RuntimeError("Authoring collision proxy leaked into the render GLB")
    meshes = [item for item in bpy.context.scene.objects if item.type == "MESH"]
    if [item.name for item in meshes] != [MESH_NODE]:
        raise RuntimeError(f"Unexpected runtime meshes: {[item.name for item in meshes]}")
    runtime_bounds = bounds(world_vertices(meshes))
    runtime_topology = topology(meshes)
    material_names = sorted(material.name for material in bpy.data.materials)
    if material_names != [MATERIAL_NAME]:
        raise RuntimeError(f"Unexpected runtime materials: {material_names}")
    return {
        "rootNode": root.name,
        "meshNodes": [item.name for item in meshes],
        "colliderNodePresent": False,
        "bounds": runtime_bounds,
        "topology": runtime_topology,
        "materialNames": material_names,
    }


def run() -> dict[str, object]:
    root, art_meshes, audit = normalize_donor()
    materials = audit.pop("materials")
    images = audit.pop("images")
    source_images = image_inventory(images)
    source_topology = topology(art_meshes)

    proxy = add_source_proxy(root)
    bpy.ops.file.pack_all()
    SOURCE_BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_BLEND), check_existing=False)
    source_hash = digest(SOURCE_BLEND)

    render_proof(root, audit["normalizedBounds"])

    bpy.data.objects.remove(proxy, do_unlink=True)
    for image in images:
        width, height = image.size
        if max(width, height) > 1024:
            ratio = 1024 / max(width, height)
            image.scale(max(1, round(width * ratio)), max(1, round(height * ratio)))
    runtime_images = image_inventory(images)
    export_runtime(root, art_meshes)
    if digest(SOURCE_BLEND) != source_hash:
        raise RuntimeError("Packed 2K authoring source changed during runtime export")

    reimport = reimport_runtime()
    preserved_runtime_fields = ("meshObjects", "triangles", "uvLayers", "materialSlots")
    if any(
        reimport["topology"][field] != source_topology[field]
        for field in preserved_runtime_fields
    ):
        raise RuntimeError(
            "Runtime reimport changed triangle, UV or material structure: "
            f"source={source_topology}, runtime={reimport['topology']}"
        )
    if any(
        abs(actual - expected) > 1e-5
        for actual, expected in zip(
            reimport["bounds"]["dimensions"],
            audit["normalizedBounds"]["dimensions"],
        )
    ):
        raise RuntimeError("Runtime reimport changed normalized dimensions")

    PUBLIC_EXPORT.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(EXPORT, PUBLIC_EXPORT)
    if digest(EXPORT) != digest(PUBLIC_EXPORT):
        raise RuntimeError("Public runtime copy differs from the authored derivative")

    receipt = {
        "schema": 2,
        "assetId": ASSET_ID,
        "kind": "reusable-static-decoration",
        "rootNode": ROOT_NODE,
        "units": "metres",
        "origin": "bottom-centre",
        "intendedUse": "Off-route landmark in the Twin Galleries listening court.",
        "donor": {
            "file": relative(DONOR),
            "bytes": DONOR.stat().st_size,
            "sha256": digest(DONOR),
            "boundsBeforeNormalization": audit["donorBounds"],
            "topology": audit["donorTopology"],
            "preservation": "Vertex, triangle, UV-layer and material-slot counts unchanged.",
        },
        "packedBlenderSource": {
            "file": relative(SOURCE_BLEND),
            "bytes": SOURCE_BLEND.stat().st_size,
            "sha256": source_hash,
            "textureImages": source_images,
            "containsReviewOnlyCollider": COLLIDER_NODE,
        },
        "runtimeDerivative": {
            "file": relative(EXPORT),
            "bytes": EXPORT.stat().st_size,
            "sha256": digest(EXPORT),
            "publicFile": relative(PUBLIC_EXPORT),
            "publicBytes": PUBLIC_EXPORT.stat().st_size,
            "publicSha256": digest(PUBLIC_EXPORT),
            "textureImages": runtime_images,
            "reimport": reimport,
            "vertexSplitNote": (
                "glTF attribute seams split "
                f"{reimport['topology']['vertices'] - source_topology['vertices']} "
                "runtime vertices without changing triangles, UV layers or materials."
            ),
            "renderBudget": {
                "artTriangles": source_topology["triangles"],
                "meshPrimitives": source_topology["meshObjects"],
                "atlasMaterials": len(materials),
                "expectedBaseDrawCallsPerPass": 1,
            },
        },
        "normalizedBounds": audit["normalizedBounds"],
        "collision": {
            "authority": "Authored SolidPropDefinition; runtime GLB contains no collision mesh.",
            "measuredLowerProfileThroughMetres": BASE_PROFILE_HEIGHT,
            "measuredLowerProfileBounds": audit["baseProfileBounds"],
            "recommendedLocalBox": {
                "dimensionsMetres": list(BASE_PROXY_DIMS),
                "centreMetres": [0.0, 0.0, BASE_PROXY_DIMS[2] / 2],
            },
            "reason": "Covers only the grounded plinth footprint and leaves the open harp silhouette nonblocking.",
        },
        "proof": {
            "file": relative(PROOF),
            "bytes": PROOF.stat().st_size,
            "sha256": digest(PROOF),
        },
        "gameplayReadiness": "Integrated as a static Twin Galleries decoration with an authored base-only proxy.",
    }
    RECEIPT.write_text(json.dumps(receipt, indent=2) + "\n")
    return receipt


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))
    bpy.ops.wm.quit_blender()
