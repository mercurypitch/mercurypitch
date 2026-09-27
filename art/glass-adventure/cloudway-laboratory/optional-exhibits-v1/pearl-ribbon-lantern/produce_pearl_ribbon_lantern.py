#!/usr/bin/env python3
"""Finish the dense pearl-ribbon lantern donor as two validated runtime LODs."""

from __future__ import annotations

import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile
from typing import Any, Iterable

import bpy
from mathutils import Vector


HERE = Path(__file__).resolve().parent
REPO = HERE.parents[4]
ARCHIVE_ROOT = Path(
    os.environ.get(
        "GLASS_CLOUDWAY_SOURCE_ROOT",
        str(
            Path.home()
            / "Documents/root/5-Creative/besidecue/assets/glass-adventure/cloudway-laboratory/v1"
        ),
    )
).expanduser().resolve()
OUTPUT_ROOT = Path(
    os.environ.get(
        "GLASS_PEARL_LANTERN_SOURCE_ROOT",
        str(
            Path.home()
            / "Documents/root/5-Creative/besidecue/assets/glass-adventure/cloudway-laboratory/optional-exhibits-v1/pearl-ribbon-lantern"
        ),
    )
).expanduser().resolve()
SOURCE_MASTER = (
    ARCHIVE_ROOT
    / "blender/pearl-ribbon-lantern/pearl-ribbon-lantern-dense-master.blend"
)
AUTHORING_MASTER = OUTPUT_ROOT / "blender/pearl-ribbon-lantern-authoring-v1.blend"
RUNTIME_DIR = OUTPUT_ROOT / "runtime"
PROOF_DIR = OUTPUT_ROOT / "proofs/blender"
FULL_RECEIPT = OUTPUT_ROOT / "production-receipt.json"
COMPACT_RECEIPT = HERE / "production-receipt.json"
PORTABLE_FULL_RECEIPT = (
    "<creative-archive>/glass-adventure/cloudway-laboratory/"
    "optional-exhibits-v1/pearl-ribbon-lantern/production-receipt.json"
)
PORTABLE_OUTPUT_ROOT = (
    "<creative-archive>/glass-adventure/cloudway-laboratory/"
    "optional-exhibits-v1/pearl-ribbon-lantern"
)
PUBLIC_DIR = (
    REPO
    / "apps/beside-cue/public/games/cloudway-laboratory-v1/optional-exhibits/pearl-ribbon-lantern"
)
MESHOPT = REPO / "apps/beside-cue/node_modules/.bin/gltf-transform"
ROOT_NODE = "Cloudway_PearlRibbonLantern_OptionalExhibitV1"
GEOMETRY_NODE = "PearlRibbonLanternGeometry"
LIGHT_NODE = "PearlRibbonLanternLightAnchor"
SUPPORT_NODE = "PearlRibbonLanternSupportAnchor"
LOD_TARGETS = {"lod0": 120_000, "lod1": 36_000}
TEXTURE_LIMITS = {"lod0": 2048, "lod1": 1024}
PROOF_RESOLUTION = (720, 720)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def durable_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=path.parent
    )
    temporary = Path(name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(value, handle, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def atomic_copy(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".incomplete")
    shutil.copy2(source, temporary)
    os.replace(temporary, destination)


def mesh_triangles(obj: bpy.types.Object) -> int:
    require(obj.type == "MESH", f"{obj.name} must be a mesh")
    return sum(max(0, len(polygon.vertices) - 2) for polygon in obj.data.polygons)


def mesh_bounds(obj: bpy.types.Object) -> tuple[list[float], list[float]]:
    require(obj.type == "MESH", f"{obj.name} must be a mesh")
    minimum = Vector((math.inf, math.inf, math.inf))
    maximum = Vector((-math.inf, -math.inf, -math.inf))
    for corner in obj.bound_box:
        value = obj.matrix_world @ Vector(corner)
        minimum.x = min(minimum.x, value.x)
        minimum.y = min(minimum.y, value.y)
        minimum.z = min(minimum.z, value.z)
        maximum.x = max(maximum.x, value.x)
        maximum.y = max(maximum.y, value.y)
        maximum.z = max(maximum.z, value.z)
    return list(minimum), list(maximum)


def measured_support(obj: bpy.types.Object) -> dict[str, Any]:
    minimum, maximum = mesh_bounds(obj)
    band_top = minimum[2] + 0.04
    band_min = Vector((math.inf, math.inf, math.inf))
    band_max = Vector((-math.inf, -math.inf, -math.inf))
    samples = 0
    for vertex in obj.data.vertices:
        value = obj.matrix_world @ vertex.co
        if value.z > band_top:
            continue
        samples += 1
        band_min.x = min(band_min.x, value.x)
        band_min.y = min(band_min.y, value.y)
        band_min.z = min(band_min.z, value.z)
        band_max.x = max(band_max.x, value.x)
        band_max.y = max(band_max.y, value.y)
        band_max.z = max(band_max.z, value.z)
    require(samples >= 20, "Resting-base measurement has too few vertices")
    width = band_max.x - band_min.x
    depth = band_max.y - band_min.y
    require(width > 0.1 and depth > 0.1, "Resting-base support is degenerate")
    centre_blender_xy = [
        float((band_min.x + band_max.x) / 2),
        float((band_min.y + band_max.y) / 2),
    ]
    return {
        "kind": "resting-base",
        "walkable": False,
        "centreBlenderXY": centre_blender_xy,
        "centreXZ": [centre_blender_xy[0], -centre_blender_xy[1]],
        "width": float(width),
        "depth": float(depth),
        "datumY": 0.0,
        "measurementBandMetres": 0.04,
        "sampleVertices": samples,
        "fullBoundsBlenderZUp": {"min": minimum, "max": maximum},
    }


def remove_review_stage() -> tuple[bpy.types.Object, bpy.types.Object]:
    roots = [obj for obj in bpy.data.objects if obj.name == "Cloudway_PearlRibbonLantern_DenseMaster"]
    reviews = [obj for obj in bpy.data.objects if obj.name == "pearl-ribbon-lantern__normalized_review"]
    require(len(roots) == 1 and len(reviews) == 1, "Dense master nodes are missing or duplicated")
    root = roots[0]
    review = reviews[0]
    for obj in list(bpy.data.objects):
        if obj not in {root, review}:
            bpy.data.objects.remove(obj, do_unlink=True)
    root.name = "Cloudway_PearlRibbonLantern_AuthoringV1"
    review.name = "PearlRibbonLanternDenseSource"
    bpy.context.view_layer.objects.active = review
    review.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    review.select_set(False)
    minimum, maximum = mesh_bounds(review)
    require(abs(minimum[2]) <= 1e-5, "Normalized source no longer rests at Z=0")
    require(abs((maximum[2] - minimum[2]) - 1.4) <= 1e-4, "Normalized source height changed")
    return root, review


def create_proxy(
    parent: bpy.types.Object,
    bounds: tuple[list[float], list[float]],
) -> bpy.types.Object:
    minimum, maximum = bounds
    radius = max(maximum[0] - minimum[0], maximum[1] - minimum[1]) / 2 + 0.012
    height = maximum[2] - minimum[2]
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=24,
        radius=radius,
        depth=height,
        location=(0, 0, minimum[2] + height / 2),
    )
    proxy = bpy.context.object
    proxy.name = "PearlRibbonLanternColliderProxy"
    proxy.parent = parent
    proxy.display_type = "WIRE"
    proxy.hide_render = True
    proxy["proxy_only"] = True
    proxy["shape"] = "cylinder"
    proxy["radius"] = radius
    proxy["height"] = height
    return proxy


def create_anchor(name: str, location: tuple[float, float, float], parent: bpy.types.Object) -> bpy.types.Object:
    anchor = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(anchor)
    anchor.location = location
    anchor.parent = parent
    return anchor


def principled(material: bpy.types.Material) -> bpy.types.Node:
    require(material.use_nodes and material.node_tree is not None, "Provider material needs nodes")
    nodes = [node for node in material.node_tree.nodes if node.bl_idname == "ShaderNodeBsdfPrincipled"]
    require(len(nodes) == 1, "Provider material needs exactly one Principled BSDF")
    return nodes[0]


def configure_material(review: bpy.types.Object) -> dict[str, Any]:
    materials = [slot.material for slot in review.material_slots if slot.material]
    require(len(materials) == 1, "Lantern must remain one batched provider material")
    material = materials[0]
    material.name = "PearlRibbonLantern__PearlGiltIvoryPBR"
    shader = principled(material)
    require(shader.inputs.get("Base Color") is not None, "Provider material lost base colour")
    return {
        "drawMaterials": 1,
        "name": material.name,
        "roles": [
            "pearl-chamber",
            "gilt-ribbon-and-trim",
            "ivory-base-and-finial",
        ],
        "roleEncoding": "provider base-colour, metallic, roughness, and normal textures",
    }


def setup_stage() -> tuple[bpy.types.Object, bpy.types.Object]:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = PROOF_RESOLUTION[0]
    scene.render.resolution_y = PROOF_RESOLUTION[1]
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.look = "AgX - Medium High Contrast"
    if scene.world is None:
        scene.world = bpy.data.worlds.new("PearlLanternWorld")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.008, 0.014, 0.028, 1)
    background.inputs["Strength"].default_value = 0.28

    floor_material = bpy.data.materials.new("PearlLanternProofFloor")
    floor_material.use_nodes = True
    floor_shader = principled(floor_material)
    floor_shader.inputs["Base Color"].default_value = (0.035, 0.065, 0.085, 1)
    floor_shader.inputs["Roughness"].default_value = 0.31
    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, -0.006))
    floor = bpy.context.object
    floor.name = "PearlLanternProofFloor"
    floor.data.materials.append(floor_material)

    def point_at(obj: bpy.types.Object, target: Vector) -> None:
        obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()

    for name, location, energy, size, color in (
        ("PearlLanternProofKey", (2.8, -3.0, 3.8), 950, 3.0, (1.0, 0.76, 0.5)),
        ("PearlLanternProofFill", (-2.6, -1.2, 2.4), 700, 2.7, (0.4, 0.65, 1.0)),
        ("PearlLanternProofRim", (0.8, 3.1, 3.0), 1000, 2.3, (0.75, 0.45, 1.0)),
    ):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.shape = "DISK"
        data.size = size
        data.color = color
        light = bpy.data.objects.new(name, data)
        light.location = location
        point_at(light, Vector((0, 0, 0.75)))
        scene.collection.objects.link(light)

    camera_data = bpy.data.cameras.new("PearlLanternProofCamera")
    camera_data.lens = 58
    camera = bpy.data.objects.new("PearlLanternProofCamera", camera_data)
    camera.location = (2.35, -2.7, 1.95)
    point_at(camera, Vector((0, 0, 0.72)))
    scene.collection.objects.link(camera)
    scene.camera = camera
    return floor, camera


def render_proof(obj: bpy.types.Object, lod: str, view: str, camera: bpy.types.Object) -> dict[str, Any]:
    positions = {
        "three-quarter": ((2.35, -2.7, 1.95), (0, 0, 0.72), 58),
        "front": ((0, -3.3, 1.45), (0, 0, 0.7), 62),
        "close": ((1.55, -1.8, 1.5), (0, 0, 0.76), 68),
    }
    location, target, lens = positions[view]
    camera.location = location
    camera.data.lens = lens
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()
    obj.hide_render = False
    output = PROOF_DIR / f"pearl-ribbon-lantern-{lod}-{view}.png"
    temporary = output.with_suffix(".incomplete.png")
    bpy.context.scene.render.filepath = str(temporary)
    bpy.ops.render.render(write_still=True)
    os.replace(temporary, output)
    obj.hide_render = True
    return {
        "lod": lod,
        "view": view,
        "file": output.relative_to(OUTPUT_ROOT).as_posix(),
        "bytes": output.stat().st_size,
        "sha256": digest(output),
        "resolution": list(PROOF_RESOLUTION),
    }


def decimated_copy(source: bpy.types.Object, lod: str, target_triangles: int) -> bpy.types.Object:
    duplicate = source.copy()
    duplicate.data = source.data.copy()
    duplicate.name = GEOMETRY_NODE
    duplicate.data.name = f"PearlRibbonLantern__{lod}__mesh"
    bpy.context.scene.collection.objects.link(duplicate)
    duplicate.parent = None
    source_triangles = mesh_triangles(duplicate)
    modifier = duplicate.modifiers.new(f"{lod} bounded collapse", "DECIMATE")
    modifier.decimate_type = "COLLAPSE"
    modifier.ratio = min(1.0, target_triangles / source_triangles)
    modifier.use_collapse_triangulate = True
    modifier.use_symmetry = False
    bpy.context.view_layer.objects.active = duplicate
    for obj in bpy.context.selected_objects:
        obj.select_set(False)
    duplicate.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    duplicate.data.validate(verbose=False, clean_customdata=False)
    duplicate.data.update()
    actual = mesh_triangles(duplicate)
    require(actual <= target_triangles * 1.03, f"{lod} exceeded triangle target: {actual}")
    require(actual >= target_triangles * 0.8, f"{lod} decimated unexpectedly far: {actual}")
    duplicate["lod"] = lod
    duplicate["source_triangles"] = source_triangles
    duplicate["runtime_triangles"] = actual
    duplicate["material_roles_json"] = json.dumps(
        ["pearl-chamber", "gilt-ribbon-and-trim", "ivory-base-and-finial"],
        separators=(",", ":"),
    )
    return duplicate


def resize_images(maximum: int) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for image in bpy.data.images:
        if not image.name.startswith("pearl-ribbon-lantern__"):
            continue
        before = [int(image.size[0]), int(image.size[1])]
        scale = min(1.0, maximum / max(before))
        after = [max(1, round(before[0] * scale)), max(1, round(before[1] * scale))]
        if after != before:
            image.scale(*after)
        image.pack()
        records.append({"image": image.name, "before": before, "after": after})
    require(len(records) == 4, "Expected four packed provider textures")
    return records


def contract(
    lod: str,
    support: dict[str, Any],
    bounds: tuple[list[float], list[float]],
    triangles: int,
) -> dict[str, Any]:
    minimum, maximum = bounds
    radius = max(maximum[0] - minimum[0], maximum[1] - minimum[1]) / 2 + 0.012
    return {
        "schema": 1,
        "assetId": "pearl-ribbon-lantern",
        "version": "optional-exhibit-v1",
        "lod": lod,
        "coordinates": "metres; glTF +Y up; origin at resting-base centre",
        "renderNode": GEOMETRY_NODE,
        "lightAnchor": LIGHT_NODE,
        "supportAnchor": SUPPORT_NODE,
        "support": {
            "kind": support["kind"],
            "walkable": False,
            "width": support["width"],
            "depth": support["depth"],
            "centreXZ": support["centreXZ"],
            "datumY": 0,
        },
        "obstacle": {
            "kind": "cylinder",
            "radius": radius,
            "height": maximum[2] - minimum[2],
            "centreY": (maximum[2] + minimum[2]) / 2,
        },
        "triangles": triangles,
        "drawCalls": 1,
        "physics": "decorative non-walkable obstacle; no gameplay behavior",
    }


def export_runtime(
    obj: bpy.types.Object,
    lod: str,
    support: dict[str, Any],
    bounds: tuple[list[float], list[float]],
) -> tuple[Path, dict[str, Any]]:
    triangles = mesh_triangles(obj)
    root = bpy.data.objects.new(ROOT_NODE, None)
    bpy.context.scene.collection.objects.link(root)
    obj.parent = root
    root["asset_contract_json"] = json.dumps(
        contract(lod, support, bounds, triangles), separators=(",", ":")
    )
    create_anchor(LIGHT_NODE, (0, 0, 0.88), root)
    create_anchor(
        SUPPORT_NODE,
        (support["centreBlenderXY"][0], support["centreBlenderXY"][1], 0),
        root,
    )
    selected = [root, obj, *root.children]
    for candidate in bpy.context.selected_objects:
        candidate.select_set(False)
    for candidate in selected:
        candidate.select_set(True)
    bpy.context.view_layer.objects.active = obj
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    output = RUNTIME_DIR / f"pearl-ribbon-lantern-{lod}.glb"
    temporary_dir = Path(tempfile.mkdtemp(prefix=f"pearl-lantern-{lod}-"))
    uncompressed = temporary_dir / f"{lod}-uncompressed.glb"
    compressed = temporary_dir / f"{lod}-meshopt.glb"
    try:
        result = bpy.ops.export_scene.gltf(
            filepath=str(uncompressed),
            check_existing=False,
            export_format="GLB",
            use_selection=True,
            export_extras=True,
            export_yup=True,
            export_apply=False,
            export_animations=False,
            export_cameras=False,
            export_lights=False,
            export_materials="EXPORT",
            export_texcoords=True,
            export_normals=True,
            export_tangents=True,
            export_image_format="WEBP",
            export_image_quality=88 if lod == "lod0" else 82,
            export_image_add_webp=False,
            export_image_webp_fallback=False,
            export_unused_images=False,
        )
        require("FINISHED" in result, f"{lod} glTF export did not finish")
        subprocess.run(
            [
                str(MESHOPT),
                "meshopt",
                str(uncompressed),
                str(compressed),
                "--level",
                "high",
                "--quantization-volume",
                "mesh",
                "--quantize-position",
                "16",
                "--quantize-normal",
                "12",
                "--quantize-texcoord",
                "14",
                "--quantize-generic",
                "14",
            ],
            cwd=REPO,
            check=True,
        )
        atomic_copy(compressed, output)
    finally:
        shutil.rmtree(temporary_dir, ignore_errors=True)
    for candidate in list(root.children):
        if candidate != obj:
            bpy.data.objects.remove(candidate, do_unlink=True)
    obj.parent = None
    bpy.data.objects.remove(root, do_unlink=True)
    return output, contract(lod, support, bounds, triangles)


def glb_document(path: Path) -> dict[str, Any]:
    payload = path.read_bytes()
    require(payload[:4] == b"glTF", f"{path.name} is not a GLB")
    version, total = struct.unpack_from("<II", payload, 4)
    require(version == 2 and total == len(payload), f"{path.name} has invalid framing")
    length, kind = struct.unpack_from("<II", payload, 12)
    require(kind == 0x4E4F534A, f"{path.name} has no JSON chunk")
    return json.loads(payload[20 : 20 + length].decode("utf-8"))


def validate_glb(
    path: Path, expected_triangles: int, expected_contract: dict[str, Any]
) -> dict[str, Any]:
    document = glb_document(path)
    nodes_by_name = {
        node.get("name"): node
        for node in document.get("nodes", [])
        if isinstance(node.get("name"), str)
    }
    names = set(nodes_by_name)
    require(ROOT_NODE in names, f"{path.name} lost root node")
    require(GEOMETRY_NODE in names, f"{path.name} lost geometry node")
    require(LIGHT_NODE in names and SUPPORT_NODE in names, f"{path.name} lost anchors")
    require(not document.get("animations"), f"{path.name} unexpectedly has animations")
    require(not document.get("cameras"), f"{path.name} unexpectedly has cameras")
    accessors = document.get("accessors", [])
    triangles = 0
    primitives = 0
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            primitives += 1
            index = primitive.get("indices")
            require(isinstance(index, int), f"{path.name} primitive is unindexed")
            triangles += int(accessors[index]["count"]) // 3
            attributes = primitive.get("attributes", {})
            require(
                {"POSITION", "NORMAL", "TANGENT", "TEXCOORD_0"}.issubset(attributes),
                f"{path.name} is missing runtime vertex attributes",
            )
    require(triangles == expected_triangles, f"{path.name} triangle count changed")
    require(primitives == 1, f"{path.name} must remain one draw primitive")
    require(len(document.get("materials", [])) == 1, f"{path.name} must use one material")
    root_extras = nodes_by_name[ROOT_NODE].get("extras", {})
    embedded_contract = json.loads(root_extras.get("asset_contract_json", "null"))
    require(embedded_contract == expected_contract, f"{path.name} contract changed during export")
    support_translation = nodes_by_name[SUPPORT_NODE].get("translation", [0, 0, 0])
    expected_support_xz = expected_contract["support"]["centreXZ"]
    require(
        len(support_translation) == 3
        and abs(support_translation[0] - expected_support_xz[0]) <= 1e-9
        and abs(support_translation[1]) <= 1e-9
        and abs(support_translation[2] - expected_support_xz[1]) <= 1e-9,
        f"{path.name} support contract does not match its exported anchor",
    )
    extensions = set(document.get("extensionsUsed", []))
    require("EXT_meshopt_compression" in extensions, f"{path.name} is not meshopt-compressed")
    return {
        "file": path.relative_to(OUTPUT_ROOT).as_posix(),
        "bytes": path.stat().st_size,
        "sha256": digest(path),
        "triangles": triangles,
        "primitives": primitives,
        "materials": len(document.get("materials", [])),
        "images": len(document.get("images", [])),
        "textures": len(document.get("textures", [])),
        "extensionsUsed": sorted(extensions),
        "rootNode": ROOT_NODE,
        "renderNode": GEOMETRY_NODE,
        "supportAnchorTranslation": support_translation,
    }


def main() -> None:
    require(SOURCE_MASTER.is_file(), f"Missing dense master {SOURCE_MASTER}")
    require(MESHOPT.is_file(), f"Missing glTF Transform CLI {MESHOPT}")
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    PROOF_DIR.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE_MASTER))
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0
    authoring_root, dense = remove_review_stage()
    material = configure_material(dense)
    bounds = mesh_bounds(dense)
    support = measured_support(dense)
    proxy = create_proxy(authoring_root, bounds)
    create_anchor(f"{LIGHT_NODE}__AuthoringGuide", (0, 0, 0.88), authoring_root)
    create_anchor(
        f"{SUPPORT_NODE}__AuthoringGuide",
        (support["centreBlenderXY"][0], support["centreBlenderXY"][1], 0),
        authoring_root,
    )
    setup_stage()
    dense["material_roles_json"] = json.dumps(material["roles"], separators=(",", ":"))
    authoring_root["production_recipe_json"] = json.dumps(
        {
            "schema": 1,
            "sourceSha256": digest(SOURCE_MASTER),
            "support": support,
            "lodTargets": LOD_TARGETS,
            "runtimeRoot": ROOT_NODE,
        },
        separators=(",", ":"),
    )
    AUTHORING_MASTER.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(AUTHORING_MASTER), check_existing=False)
    dense.hide_render = True
    proxy.hide_render = True

    proofs: list[dict[str, Any]] = []
    runtimes: list[dict[str, Any]] = []
    texture_records: dict[str, list[dict[str, Any]]] = {}
    camera = bpy.data.objects["PearlLanternProofCamera"]
    for lod in ("lod0", "lod1"):
        texture_records[lod] = resize_images(TEXTURE_LIMITS[lod])
        runtime = decimated_copy(dense, lod, LOD_TARGETS[lod])
        runtime_bounds = mesh_bounds(runtime)
        for axis in range(3):
            require(
                abs(runtime_bounds[0][axis] - bounds[0][axis]) <= 0.012
                and abs(runtime_bounds[1][axis] - bounds[1][axis]) <= 0.012,
                f"{lod} changed the reviewed bounds on axis {axis}",
            )
        for view in ("three-quarter", "front", "close"):
            proofs.append(render_proof(runtime, lod, view, camera))
        runtime.hide_render = False
        output, runtime_contract = export_runtime(runtime, lod, support, bounds)
        validation = validate_glb(output, mesh_triangles(runtime), runtime_contract)
        runtime_record: dict[str, Any] = {
            "lod": lod,
            "contract": runtime_contract,
            "validation": validation,
        }
        public = PUBLIC_DIR / output.name
        if lod == "lod1":
            atomic_copy(output, public)
            runtime_record.update(
                {
                    "distribution": "shipping-runtime",
                    "publicFile": public.relative_to(REPO).as_posix(),
                    "publicSha256": digest(public),
                }
            )
        else:
            public.unlink(missing_ok=True)
            runtime_record.update(
                {
                    "distribution": "creative-archive-proof-only",
                    "archiveFile": f"{PORTABLE_OUTPUT_ROOT}/{validation['file']}",
                    "archiveSha256": validation["sha256"],
                }
            )
        runtimes.append(runtime_record)
        bpy.data.objects.remove(runtime, do_unlink=True)

    receipt = {
        "schema": 1,
        "assetId": "pearl-ribbon-lantern",
        "version": "optional-exhibit-v1",
        "status": "production-ready static optional exhibit",
        "source": {
            "file": str(SOURCE_MASTER),
            "bytes": SOURCE_MASTER.stat().st_size,
            "sha256": digest(SOURCE_MASTER),
            "triangles": mesh_triangles(dense),
            "regenerated": False,
        },
        "authoringMaster": {
            "file": AUTHORING_MASTER.relative_to(OUTPUT_ROOT).as_posix(),
            "bytes": AUTHORING_MASTER.stat().st_size,
            "sha256": digest(AUTHORING_MASTER),
            "packed": True,
            "blenderVersion": bpy.app.version_string,
        },
        "coordinates": "Blender authoring +Z up; runtime glTF +Y up; metres",
        "boundsBlenderZUp": {"min": bounds[0], "max": bounds[1]},
        "support": support,
        "material": material,
        "textureScaling": texture_records,
        "runtimes": runtimes,
        "proofs": proofs,
        "quality": {
            "oneDrawPerLod": True,
            "sourcePreserved": True,
            "noWalkableSurface": True,
            "noAnimation": True,
            "proxyValidatedFromBounds": True,
        },
        "rebuild": (
            "rtk proxy timeout 7200 flock -w 7200 /tmp/glass-pearl-ribbon-lantern.lock "
            "env ALSOFT_DRIVERS=null blender --background --factory-startup --python-exit-code 1 "
            "--python art/glass-adventure/cloudway-laboratory/optional-exhibits-v1/"
            "pearl-ribbon-lantern/produce_pearl_ribbon_lantern.py"
        ),
    }
    durable_json(FULL_RECEIPT, receipt)
    durable_json(
        COMPACT_RECEIPT,
        {
            "schema": 1,
            "assetId": receipt["assetId"],
            "version": receipt["version"],
            "status": receipt["status"],
            "rootNode": ROOT_NODE,
            "renderNode": GEOMETRY_NODE,
            "boundsBlenderZUp": receipt["boundsBlenderZUp"],
            "support": support,
            "material": material,
            "runtimes": runtimes,
            "authoringMaster": receipt["authoringMaster"],
            "proofCount": len(proofs),
            "fullReceipt": PORTABLE_FULL_RECEIPT,
        },
    )
    print("PEARL_RIBBON_LANTERN=" + json.dumps(receipt, separators=(",", ":")))


if __name__ == "__main__":
    main()
