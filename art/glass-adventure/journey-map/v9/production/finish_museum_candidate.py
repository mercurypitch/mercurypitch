"""Bake and finish review-only V9 temple or cypress PBR candidates.

The provider normal and a selected-to-active normal baked from the preserved dense
donor remain separate exports. Both use one accepted low mesh, its reviewed UVs,
the same dense-donor AO, stable dimensions and a ground anchor. This script never
installs a runtime asset or modifies the preserved source files.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import struct
import sys

import bpy
from mathutils import Vector
import numpy as np
from PIL import Image as PILImage


HERE = Path(__file__).resolve().parent
ART = HERE.parent
REPO = HERE.parents[4]
V3 = ART.parent / "v3"
V8 = ART.parent / "v8"

BAKE_SIZE = 2048
BAKE_MARGIN = 24
BAKE_SAMPLES = 64
BAKE_THREADS = 8


@dataclass(frozen=True)
class Asset:
    name: str
    asset_id: str
    source: Path
    source_receipt: Path
    remesh_receipt: Path
    clay_review: Path
    dense: Path
    dense_sha256: str
    texture_dir: Path
    blend: Path
    manifest: Path
    variants: dict[str, Path]
    root_name: str
    group_name: str
    geometry_name: str
    material_name: str
    target_dimensions: tuple[float, float, float]
    minimum_triangles: int
    maximum_triangles: int
    cage_extrusion: float
    maximum_ray_distance: float


ASSETS = {
    "temple": Asset(
        name="temple",
        asset_id="floating-museum-temple-candidate-v9",
        source=ART / "meshy" / "temple-remesh-90k-retexture-pbr.glb",
        source_receipt=ART / "meshy" / "temple-remesh-90k-retexture-pbr-receipt.json",
        remesh_receipt=ART / "meshy" / "temple-remesh-90k-receipt.json",
        clay_review=ART / "proofs" / "temple-remesh-clay-review-v9.json",
        dense=V3 / "meshy" / "floating-museum-temple-v3-pre-remesh.glb",
        dense_sha256="9081197e97545d873eca2773ccebfeeadb919acc4e2f96e62ac99a6faa929023",
        texture_dir=ART / "sources" / "temple-bake-v9",
        blend=ART / "sources" / "floating-museum-temple-candidate-v9.blend",
        manifest=ART / "exports" / "floating-museum-temple-candidate-v9.json",
        variants={
            "meshy": ART
            / "exports"
            / "floating-museum-temple-candidate-v9-meshy-normal.glb",
            "dense-bake": ART
            / "exports"
            / "floating-museum-temple-candidate-v9-dense-bake-normal.glb",
        },
        root_name="map_museum_v9_temple_candidate_root",
        group_name="map_temple",
        geometry_name="map_temple_geometry",
        material_name="map_temple_atlas",
        target_dimensions=(2.4000000953674316, 2.667686939239502, 2.6624226570129395),
        minimum_triangles=82_000,
        maximum_triangles=98_000,
        cage_extrusion=0.008,
        maximum_ray_distance=0.040,
    ),
    "cypress": Asset(
        name="cypress",
        asset_id="floating-museum-cypress-candidate-v9",
        source=ART / "meshy" / "cypress-remesh-20k-retexture-pbr.glb",
        source_receipt=ART / "meshy" / "cypress-remesh-20k-retexture-pbr-receipt.json",
        remesh_receipt=ART / "meshy" / "cypress-remesh-20k-receipt.json",
        clay_review=ART / "proofs" / "cypress-remesh-clay-review-v9.json",
        dense=V3 / "meshy" / "floating-museum-cypress-v3-pre-remesh.glb",
        dense_sha256="cb6f436f48909cfa3c449d085dc48ff3ba9dfc71dbc230332878e32c95cbeda1",
        texture_dir=ART / "sources" / "cypress-bake-v9",
        blend=ART / "sources" / "floating-museum-cypress-candidate-v9.blend",
        manifest=ART / "exports" / "floating-museum-cypress-candidate-v9.json",
        variants={
            "meshy": ART
            / "exports"
            / "floating-museum-cypress-candidate-v9-meshy-normal.glb",
            "dense-bake": ART
            / "exports"
            / "floating-museum-cypress-candidate-v9-dense-bake-normal.glb",
        },
        root_name="map_museum_v9_cypress_candidate_root",
        group_name="map_cypress",
        geometry_name="map_cypress_geometry",
        material_name="map_cypress_atlas",
        target_dimensions=(0.38449329137802124, 1.7999999523162842, 0.45893892645835876),
        minimum_triangles=17_000,
        maximum_triangles=24_000,
        cage_extrusion=0.003,
        maximum_ray_distance=0.018,
    ),
}


def load_finish_helpers():
    path = V8 / "production" / "finish_conservatory_candidate.py"
    spec = importlib.util.spec_from_file_location("journey_map_v8_finish_helpers", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


FINISH = load_finish_helpers()


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def configure_helpers(asset: Asset) -> None:
    FINISH.ART = ART
    FINISH.SOURCE = asset.source
    FINISH.TEXTURE_DIR = asset.texture_dir
    FINISH.TARGET_DIMENSIONS = asset.target_dimensions
    FINISH.BAKE_SIZE = BAKE_SIZE
    FINISH.BAKE_MARGIN = BAKE_MARGIN
    FINISH.BAKE_SAMPLES = BAKE_SAMPLES
    FINISH.BAKE_THREADS = BAKE_THREADS
    FINISH.CAGE_EXTRUSION = asset.cage_extrusion
    FINISH.MAX_RAY_DISTANCE = asset.maximum_ray_distance


def validate_receipts(asset: Asset) -> dict[str, object]:
    FINISH.require_complete_glb(asset.source)
    FINISH.require_complete_glb(asset.dense)
    if digest(asset.dense) != asset.dense_sha256:
        raise ValueError(f"Preserved dense {asset.name} source hash changed")
    if not asset.source_receipt.is_file() or not asset.remesh_receipt.is_file():
        raise FileNotFoundError("Archived remesh and PBR retexture receipts are required")
    pbr = json.loads(asset.source_receipt.read_text())
    remesh = json.loads(asset.remesh_receipt.read_text())
    source_sha = digest(asset.source)
    if pbr.get("state") != "archived" or pbr.get("file", {}).get("sha256") != source_sha:
        raise ValueError("PBR source does not match its archived receipt")
    if remesh.get("state") != "archived" or pbr.get("parentTaskId") != remesh.get("taskId"):
        raise ValueError("PBR receipt does not descend from the archived V9 remesh")
    clay = json.loads(asset.clay_review.read_text())
    if clay.get("decision") != "accepted-for-pbr-retexture":
        raise ValueError("Clay decision no longer accepts the remesh")
    clay_sha = digest(asset.clay_review)
    if pbr.get("clayReview", {}).get("sha256") != clay_sha:
        raise ValueError("PBR receipt is not bound to the accepted clay decision")
    return {
        "remeshTaskId": remesh.get("taskId"),
        "retextureTaskId": pbr.get("taskId"),
        "sourceSha256": source_sha,
        "denseDonorSha256": digest(asset.dense),
        "clayReview": {
            "file": str(asset.clay_review.relative_to(REPO)),
            "sha256": clay_sha,
        },
    }


def save_provider_textures(
    asset: Asset, maps: dict[str, PILImage.Image]
) -> dict[str, object]:
    names = {
        "baseColor": "provider-base-color.png",
        "normal": "provider-normal.png",
        "metallicRoughness": "provider-metallic-roughness.png",
    }
    result = {}
    for role, name in names.items():
        result[role] = FINISH.save_png(maps[role], asset.texture_dir / name)
    return result


def build_runtime_orm(
    asset: Asset, provider: dict[str, PILImage.Image], ao_path: Path
) -> dict[str, object]:
    ao = PILImage.open(ao_path).convert("L")
    metallic_roughness = provider["metallicRoughness"].resize(
        ao.size, PILImage.Resampling.LANCZOS
    )
    pixels = np.asarray(metallic_roughness, dtype=np.uint8).copy()
    pixels[:, :, 0] = np.asarray(ao, dtype=np.uint8)
    return FINISH.save_png(
        PILImage.fromarray(pixels, "RGB"),
        asset.texture_dir / "runtime-orm-with-dense-ao.png",
    )


def make_temple_variants(
    asset: Asset, base: PILImage.Image
) -> dict[str, dict[str, object]]:
    if asset.name != "temple":
        return {}
    source = np.asarray(base.convert("RGB"), dtype=np.float32) / 255.0
    red, green, blue = source[..., 0], source[..., 1], source[..., 2]
    maximum = source.max(axis=2)
    minimum = source.min(axis=2)
    chroma = maximum - minimum
    bright = np.clip((maximum - 0.42) / 0.42, 0.0, 1.0)
    pale = np.clip((0.22 - chroma) / 0.17, 0.0, 1.0)
    gold = (red > green * 1.04) & (green > blue * 1.10) & (chroma > 0.07)
    emerald = (green > red * 1.12) & (green > blue * 0.88) & (chroma > 0.08)
    mask = bright * pale * (~gold) * (~emerald)
    luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722
    targets = {
        "amber": np.array([1.0, 0.57, 0.20], dtype=np.float32),
        "teal": np.array([0.10, 0.68, 0.64], dtype=np.float32),
    }
    rows = {}
    for variant, target in targets.items():
        target_luminance = float(target @ np.array([0.2126, 0.7152, 0.0722]))
        tinted = target[None, None, :] * (luminance[..., None] / target_luminance)
        blend = (mask * 0.78)[..., None]
        result = np.clip(source * (1.0 - blend) + np.clip(tinted, 0.0, 1.0) * blend, 0.0, 1.0)
        image = PILImage.fromarray(np.round(result * 255).astype(np.uint8), "RGB")
        row = FINISH.save_png(
            image, asset.texture_dir / f"temple-dome-{variant}-base.png"
        )
        row["method"] = (
            "Brightness-preserving tint of pale low-chroma dome texels; warm gold and emerald "
            "texels are protected. Apply only to the dome face partition."
        )
        rows[variant] = row
    return rows


def repair_tangent_singularities(mesh: bpy.types.Mesh) -> dict[str, object]:
    active_uv = mesh.uv_layers.active
    if active_uv is None:
        raise ValueError("Accepted PBR candidate has no active UV0")
    mesh.calc_tangents(uvmap=active_uv.name)
    bad = [index for index, loop in enumerate(mesh.loops) if loop.tangent.length <= 1e-6]
    mesh.free_tangents()
    if not bad:
        return {"method": "none-needed", "repairedCorners": [], "remainingZeroTangents": 0}
    loop_polygons = {
        loop_index: polygon
        for polygon in mesh.polygons
        for loop_index in polygon.loop_indices
    }
    normals = [corner.vector.copy() for corner in mesh.corner_normals]
    rows = []
    for loop_index in bad:
        polygon = loop_polygons[loop_index]
        before = list(normals[loop_index])
        normals[loop_index] = polygon.normal.copy().normalized()
        rows.append(
            {
                "loop": loop_index,
                "polygon": polygon.index,
                "normalBefore": before,
                "normalAfter": list(normals[loop_index]),
            }
        )
    mesh.normals_split_custom_set(normals)
    mesh.update()
    mesh.calc_tangents(uvmap=active_uv.name)
    remaining = sum(loop.tangent.length <= 1e-6 for loop in mesh.loops)
    maximum_unit_error = max(
        (abs(loop.tangent.length - 1.0) for loop in mesh.loops), default=0.0
    )
    mesh.free_tangents()
    if remaining:
        raise ValueError(f"Tangent repair left {remaining} zero-length corners")
    return {
        "method": (
            "Replace only each singular corner normal with its polygon normal, leaving positions, "
            "indices and UVs unchanged; then regenerate tangent space."
        ),
        "repairedCorners": rows,
        "remainingZeroTangents": remaining,
        "maximumTangentUnitError": maximum_unit_error,
    }


def load_runtime_image(path: Path, name: str, color_space: str) -> bpy.types.Image:
    image = bpy.data.images.load(str(path), check_existing=False)
    image.name = name
    image.colorspace_settings.name = color_space
    image.pack()
    return image


def configure_material(
    asset: Asset, material: bpy.types.Material, normal_source: str
) -> None:
    paths = {
        "base": asset.texture_dir / "provider-base-color.png",
        "normal": asset.texture_dir
        / ("dense-donor-normal.png" if normal_source == "dense-bake" else "provider-normal.png"),
        "orm": asset.texture_dir / "runtime-orm-with-dense-ao.png",
    }
    material.name = asset.material_name
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    links = material.node_tree.links
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.name = "Principled BSDF"

    base_node = nodes.new("ShaderNodeTexImage")
    base_node.name = "Runtime Base Color"
    base_node.image = load_runtime_image(
        paths["base"], f"{asset.name}-v9-base", "sRGB"
    )
    links.new(base_node.outputs["Color"], shader.inputs["Base Color"])

    orm_node = nodes.new("ShaderNodeTexImage")
    orm_node.name = "Runtime ORM with Dense AO"
    orm_node.image = load_runtime_image(
        paths["orm"], f"{asset.name}-v9-orm", "Non-Color"
    )
    separate = nodes.new("ShaderNodeSeparateColor")
    links.new(orm_node.outputs["Color"], separate.inputs["Color"])
    links.new(separate.outputs["Green"], shader.inputs["Roughness"])
    links.new(separate.outputs["Blue"], shader.inputs["Metallic"])

    normal_node = nodes.new("ShaderNodeTexImage")
    normal_node.name = f"Runtime Normal ({normal_source})"
    normal_node.image = load_runtime_image(
        paths["normal"], f"{asset.name}-v9-normal-{normal_source}", "Non-Color"
    )
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.inputs["Strength"].default_value = 1.0
    links.new(normal_node.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], shader.inputs["Normal"])
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    material.diffuse_color = (0.72, 0.70, 0.65, 1.0)
    material["normalSource"] = normal_source


def descendants(root: bpy.types.Object) -> list[bpy.types.Object]:
    result = []
    pending = list(root.children)
    while pending:
        current = pending.pop()
        result.append(current)
        pending.extend(current.children)
    return result


def accessor_float_vectors(
    document: dict[str, object], binary: bytes, accessor_index: int, width: int
) -> list[tuple[float, ...]]:
    accessor = document["accessors"][accessor_index]
    if int(accessor["componentType"]) != 5126:
        raise ValueError("Expected a float accessor")
    view = document["bufferViews"][int(accessor["bufferView"])]
    stride = int(view.get("byteStride", width * 4))
    offset = int(view.get("byteOffset", 0)) + int(accessor.get("byteOffset", 0))
    count = int(accessor["count"])
    return [
        struct.unpack_from("<" + "f" * width, binary, offset + index * stride)
        for index in range(count)
    ]


def validate_export(
    asset: Asset, path: Path, expected_triangles: int
) -> dict[str, object]:
    document, binary = FINISH.read_glb(path)
    matches = [
        node
        for node in document.get("nodes", [])
        if node.get("name") == asset.geometry_name
    ]
    if len(matches) != 1 or "mesh" not in matches[0]:
        raise ValueError(f"Fresh export lost {asset.geometry_name}")
    mesh = document["meshes"][int(matches[0]["mesh"])]
    if len(mesh.get("primitives", [])) != 1:
        raise ValueError("Review export must retain one primitive")
    primitive = mesh["primitives"][0]
    attributes = primitive.get("attributes", {})
    required = {"POSITION", "NORMAL", "TANGENT", "TEXCOORD_0"}
    if missing := sorted(required - set(attributes)):
        raise ValueError(f"Review export lost vertex attributes: {missing}")
    position = document["accessors"][int(attributes["POSITION"])]
    low = position.get("min")
    high = position.get("max")
    dimensions = [high[0] - low[0], high[1] - low[1], high[2] - low[2]]
    if abs(low[1]) > 1e-5 or any(
        abs(actual - expected) > 1e-4
        for actual, expected in zip(dimensions, asset.target_dimensions, strict=True)
    ):
        raise ValueError(f"Export dimensions/anchor failed: {dimensions}, {low}")
    count = int(document["accessors"][int(primitive["indices"])]["count"]) // 3
    if count != expected_triangles:
        raise ValueError(f"Export changed triangle count: {count} != {expected_triangles}")
    normals = accessor_float_vectors(
        document, binary, int(attributes["NORMAL"]), 3
    )
    normal_lengths = [math.sqrt(sum(value * value for value in row)) for row in normals]
    if not all(math.isfinite(value) for row in normals for value in row):
        raise ValueError("Export contains a non-finite normal")
    if any(abs(length - 1.0) > 1e-3 for length in normal_lengths):
        raise ValueError("Export contains a non-unit normal")
    tangents = accessor_float_vectors(
        document, binary, int(attributes["TANGENT"]), 4
    )
    tangent_lengths = [math.sqrt(sum(value * value for value in row[:3])) for row in tangents]
    if not all(math.isfinite(value) for row in tangents for value in row):
        raise ValueError("Export contains a non-finite tangent")
    if any(abs(length - 1.0) > 1e-3 for length in tangent_lengths):
        raise ValueError("Export contains a non-unit tangent")
    if any(value[3] not in (-1.0, 1.0) for value in tangents):
        raise ValueError("Export contains a tangent handedness outside {-1,+1}")
    material = document["materials"][int(primitive["material"])]
    pbr = material.get("pbrMetallicRoughness", {})
    bindings = {
        "baseColor": pbr.get("baseColorTexture"),
        "normal": material.get("normalTexture"),
        "metallicRoughness": pbr.get("metallicRoughnessTexture"),
        "occlusion": material.get("occlusionTexture"),
    }
    if any(binding is None for binding in bindings.values()):
        raise ValueError(f"Review export lost a PBR binding: {bindings}")
    if bindings["occlusion"]["index"] != bindings["metallicRoughness"]["index"]:
        raise ValueError("Dense AO is not packed with metallic-roughness")
    images = {}
    for role, binding in bindings.items():
        image_index = FINISH.texture_source(document, binding)
        payload = FINISH.image_payload(document, binary, image_index)
        opened = PILImage.open(FINISH.BytesIO(payload))
        images[role] = {
            "imageIndex": image_index,
            "dimensions": list(opened.size),
            "bytes": len(payload),
            "sha256": hashlib.sha256(payload).hexdigest(),
        }
    return {
        "file": str(path.relative_to(ART)),
        "bytes": path.stat().st_size,
        "sha256": digest(path),
        "triangles": count,
        "dimensionsGlTfYUpMetres": dimensions,
        "anchorErrorMetres": abs(low[1]),
        "attributes": sorted(attributes),
        "normalCount": len(normals),
        "minimumNormalLength": min(normal_lengths),
        "maximumNormalUnitError": max(abs(value - 1.0) for value in normal_lengths),
        "tangentCount": len(tangents),
        "minimumTangentLength": min(tangent_lengths),
        "maximumTangentUnitError": max(abs(value - 1.0) for value in tangent_lengths),
        "materialBindings": bindings,
        "images": images,
        "normalUvTangentPbrPassed": True,
    }


def export_variant(
    asset: Asset, normal_source: str, expected_triangles: int
) -> dict[str, object]:
    bpy.ops.wm.open_mainfile(filepath=str(asset.blend), load_ui=False)
    root = bpy.data.objects.get(asset.root_name)
    low = bpy.data.objects.get(asset.geometry_name)
    material = bpy.data.materials.get(asset.material_name)
    if root is None or low is None or material is None:
        raise ValueError("Packed candidate lost stable V9 authoring records")
    configure_material(asset, material, normal_source)
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for obj in descendants(root):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    path = asset.variants[normal_source]
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
    FINISH.patch_occlusion_binding(path)
    return validate_export(asset, path, expected_triangles)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", choices=sorted(ASSETS), required=True)
    script_args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(script_args)


def main() -> None:
    args = parse_args()
    asset = ASSETS[args.asset]
    configure_helpers(asset)
    receipt_context = validate_receipts(asset)
    provider_maps, provider_report = FINISH.source_pbr_maps()
    provider_files = save_provider_textures(asset, provider_maps)
    temple_variants = make_temple_variants(asset, provider_maps["baseColor"])

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "METERS"
    imported_low, low_meshes = FINISH.import_meshes(asset.source)
    if len(low_meshes) != 1:
        raise ValueError(f"Selected-to-active bake needs one low mesh, found {len(low_meshes)}")
    low = low_meshes[0]
    low_topology = FINISH.topology(low.data)
    if not asset.minimum_triangles <= int(low_topology["triangles"]) <= asset.maximum_triangles:
        raise ValueError(f"PBR candidate missed its triangle gate: {low_topology}")
    if low.data.uv_layers.active is None:
        raise ValueError("PBR candidate has no UV0")
    active_uv_name = low.data.uv_layers.active.name
    low_normalization = FINISH.normalize_objects(low_meshes, "PBR candidate")
    for obj in imported_low:
        if obj is not low:
            bpy.data.objects.remove(obj, do_unlink=True)
    tangent_repair = repair_tangent_singularities(low.data)

    imported_high, high_meshes = FINISH.import_meshes(asset.dense)
    high_topology = {obj.name: FINISH.topology(obj.data) for obj in high_meshes}
    high_normalization = FINISH.normalize_objects(high_meshes, "dense donor")
    for obj in imported_high:
        if obj not in high_meshes:
            bpy.data.objects.remove(obj, do_unlink=True)
    for index, obj in enumerate(high_meshes):
        obj.name = f"bake_high_{asset.name}_{index:02d}"
        obj.data.materials.clear()

    for material in list(bpy.data.materials):
        bpy.data.materials.remove(material, do_unlink=True)
    for image in list(bpy.data.images):
        bpy.data.images.remove(image, do_unlink=True)
    material = bpy.data.materials.new(asset.material_name)
    material.use_nodes = True
    low.data.materials.clear()
    low.data.materials.append(material)
    baked_normal = FINISH.bake_image(
        low,
        high_meshes,
        material,
        "dense-donor-normal",
        "NORMAL",
        asset.texture_dir / "dense-donor-normal.png",
    )
    baked_ao = FINISH.bake_image(
        low,
        high_meshes,
        material,
        "dense-donor-ao",
        "AO",
        asset.texture_dir / "dense-donor-ao.png",
    )
    normal_comparison = FINISH.compare_normals(
        provider_maps["normal"],
        PILImage.open(asset.texture_dir / "dense-donor-normal.png").convert("RGB"),
    )
    runtime_orm = build_runtime_orm(
        asset, provider_maps, asset.texture_dir / "dense-donor-ao.png"
    )

    root = bpy.data.objects.new(asset.root_name, None)
    bpy.context.scene.collection.objects.link(root)
    root["assetId"] = asset.asset_id
    root["status"] = "review-only"
    group = bpy.data.objects.new(asset.group_name, None)
    bpy.context.scene.collection.objects.link(group)
    group.parent = root
    group["assetId"] = asset.asset_id
    group["anchor"] = "ground/bottom Y=0"
    group["front"] = "exported glTF +Z (Blender -Y)"
    low.name = asset.geometry_name
    low.data.name = asset.geometry_name + "_mesh"
    low["role"] = "map-landmark"
    low.parent = group
    for obj in high_meshes:
        obj.hide_render = True
        obj.hide_set(True)
    configure_material(asset, material, "dense-bake")

    bpy.ops.file.pack_all()
    missing = sorted(
        image.filepath
        for image in bpy.data.images
        if image.source != "GENERATED" and image.packed_file is None
    )
    if missing:
        raise ValueError(f"Packed candidate retains external images: {missing}")
    asset.blend.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(
        filepath=str(asset.blend), compress=True, check_existing=False
    )
    packed = {
        "file": str(asset.blend.relative_to(ART)),
        "bytes": asset.blend.stat().st_size,
        "sha256": digest(asset.blend),
        "imagesPacked": True,
        "denseDonorRetained": True,
        "missingExternalFiles": missing,
    }

    variants = {
        name: export_variant(asset, name, int(low_topology["triangles"]))
        for name in ("meshy", "dense-bake")
    }
    runtime_contract = (
        {
            "requiredNodes": [
                "map_temple_amber",
                "map_temple_amber_structure",
                "map_temple_amber_dome",
                "map_temple_teal",
                "map_temple_teal_structure",
                "map_temple_teal_dome",
            ],
            "sharedGeometry": asset.geometry_name,
            "domeFaceThresholdBlenderZMetres": 1.65,
            "materialVariants": temple_variants,
            "normalPartitionRule": (
                "Partition by face-centre Z without moving vertices or recalculating loop "
                "normals/tangents; both colour variants share the same structure/dome geometry."
            ),
        }
        if asset.name == "temple"
        else {
            "requiredNodes": ["map_cypress", "map_cypress_geometry"],
            "sharedGeometry": asset.geometry_name,
            "instancingRule": "Every runtime placement reuses this one finished mesh.",
        }
    )
    manifest = {
        "schema": 1,
        "asset": asset.name,
        "assetId": asset.asset_id,
        "status": "review-only; normal-map selection and runtime integration pending",
        "coordinates": "Blender Z-up authoring; exported glTF +Y up; metres",
        "source": {
            "file": str(asset.source.relative_to(REPO)),
            "bytes": asset.source.stat().st_size,
            "sha256": digest(asset.source),
            "receipt": str(asset.source_receipt.relative_to(REPO)),
            "receiptContext": receipt_context,
            "providerPbr": provider_report,
            "providerTextureFiles": provider_files,
            "topology": low_topology,
        },
        "denseDonor": {
            "file": str(asset.dense.relative_to(REPO)),
            "bytes": asset.dense.stat().st_size,
            "sha256": digest(asset.dense),
            "topology": high_topology,
        },
        "boundingBoxNormalization": {
            "candidate": low_normalization,
            "denseDonor": high_normalization,
            "sameTargetBoundsAndGroundAnchor": True,
            "surfaceRegistration": (
                "unverified; equal bounding boxes do not prove remeshed surface correspondence"
            ),
        },
        "uvAndTangent": {
            "activeUv": active_uv_name,
            "tangentRepair": tangent_repair,
            "positionsIndicesAndUvsChangedByRepair": False,
        },
        "selectedToActiveBake": {
            "engine": "Cycles CPU",
            "resolution": [BAKE_SIZE, BAKE_SIZE],
            "marginPixels": BAKE_MARGIN,
            "samples": BAKE_SAMPLES,
            "cpuThreads": BAKE_THREADS,
            "cageExtrusionMetres": asset.cage_extrusion,
            "maximumRayDistanceMetres": asset.maximum_ray_distance,
            "normal": baked_normal,
            "ambientOcclusion": baked_ao,
            "runtimeOrm": runtime_orm,
            "normalComparison": normal_comparison,
            "normalSelection": "pending same-camera visual review",
            "surfaceRegistration": "pending donor/low overlap review",
            "cageAndBakeCoverage": "pending visual review",
        },
        "packedBlend": packed,
        "variants": variants,
        "runtimeContract": runtime_contract,
        "validation": {
            "archivedProviderReceiptsMatched": True,
            "preservedDenseDonorMatched": True,
            "candidateAndDonorBoundingBoxesNormalized": True,
            "providerNormalRetainedSeparately": True,
            "denseBakeNormalRetainedSeparately": True,
            "denseBakeAoChannelPacked": True,
            "packedEditableSource": True,
            "dimensionsAndGroundAnchorPassed": True,
            "uv0NormalAndFullTangentCoveragePassed": True,
            "pbrBindingsPassed": True,
            "visualApproval": "pending",
            "runtimeIntegration": "not performed",
        },
        "rebuild": {
            "workingDirectory": "repository root",
            "command": (
                "rtk proxy timeout 3600 env ALSOFT_DRIVERS=null blender -b "
                "--factory-startup --python-exit-code 1 --python "
                "art/glass-adventure/journey-map/v9/production/finish_museum_candidate.py "
                f"-- --asset {asset.name}"
            ),
            "blender": bpy.app.version_string,
        },
        "proofs": [],
    }
    asset.manifest.parent.mkdir(parents=True, exist_ok=True)
    asset.manifest.write_text(json.dumps(manifest, indent=2) + "\n")
    print(
        "MUSEUM_V9_CANDIDATES_BUILT="
        + json.dumps(
            {
                "asset": asset.name,
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
