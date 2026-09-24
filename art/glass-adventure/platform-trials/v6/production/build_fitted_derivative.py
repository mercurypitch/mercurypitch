#!/usr/bin/env python3
"""Build one review-only V6 Frost or Glide derivative without changing donor topology."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import struct
from pathlib import Path
from typing import Any

import bpy
from mathutils import Matrix, Vector
import numpy as np
from PIL import Image, ImageFilter


HERE = Path(__file__).resolve().parent
V6 = HERE.parent
TRIALS = V6.parent
V5 = TRIALS / "v5"
REPO = HERE.parents[4]
EXPORTS = V6 / "exports"
SOURCES = V6 / "sources"
TEXTURES = V6 / "textures"
REPORTS = V6 / "proofs" / "diagnostics"

VISUAL_WIDTH = 1.80
LANDING_WIDTH = 1.70
LANDING_DEPTH = 1.30
FRAME_THICKNESS = 0.070
FRAME_TOP = 0.0
BOUNDARY_WIDTH = 0.022
BOUNDARY_THICKNESS = 0.014
BOUNDARY_TOP = 0.004

ASSETS: dict[str, dict[str, Any]] = {
    "frost": {
        "taskId": "01a0d008-eb11-7661-bca6-4fb4f1986fff",
        "sha256": "5f1c6fe3ebafc293283841527392ffe0972b28b50bdaaba293bfaaeaa0bec67c",
        "bytes": 46_738_536,
        "vertices": 339_884,
        "triangles": 632_256,
        "root": "Cloudway_Frost",
        "label": "Frost",
        "ior": 1.31,
        "donorTransmission": 0.86,
        "frameTransmission": 0.94,
        "frameBase": (0.48, 0.78, 0.88),
        "absorption": (0.42, 0.81, 0.96),
        "absorptionDensity": 0.52,
        "normalStrength": 0.72,
    },
    "glide": {
        "taskId": "01a0d009-7173-7142-8f57-0c4c8be24adf",
        "sha256": "394507ad969b53c88bf007edca9d4cc013adf3bab377c10dc3867a606276e36f",
        "bytes": 30_284_496,
        "vertices": 82_069,
        "triangles": 145_370,
        "root": "Cloudway_Glide",
        "label": "Glide",
        "ior": 1.46,
        "donorTransmission": 0.74,
        "frameTransmission": 0.91,
        "frameBase": (0.31, 0.69, 0.58),
        "absorption": (0.32, 0.75, 0.61),
        "absorptionDensity": 0.70,
        "normalStrength": 0.64,
    },
}


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def relative(path: Path) -> str:
    return str(path.relative_to(REPO))


def vector(value: Vector) -> list[float]:
    return [round(float(component), 9) for component in value]


def bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points: list[Vector] = []
    for obj in objects:
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    return (
        Vector(min(point[axis] for point in points) for axis in range(3)),
        Vector(max(point[axis] for point in points) for axis in range(3)),
    )


def mesh_bounds(obj: bpy.types.Object) -> tuple[Vector, Vector]:
    points = [vertex.co for vertex in obj.data.vertices]
    return (
        Vector(min(point[axis] for point in points) for axis in range(3)),
        Vector(max(point[axis] for point in points) for axis in range(3)),
    )


def dominant_landing(obj: bpy.types.Object) -> tuple[float, float]:
    low, high = mesh_bounds(obj)
    size = high - low
    bin_size = max(size.z / 200.0, 1e-7)
    area_by_bin: dict[int, float] = {}
    for polygon in obj.data.polygons:
        center = polygon.center
        if polygon.normal.z < 0.88:
            continue
        if not (low.x + size.x * 0.10 <= center.x <= high.x - size.x * 0.10):
            continue
        if not (low.y + size.y * 0.10 <= center.y <= high.y - size.y * 0.10):
            continue
        if center.z < low.z + size.z * 0.42:
            continue
        key = round((center.z - low.z) / bin_size)
        area_by_bin[key] = area_by_bin.get(key, 0.0) + float(polygon.area)
    if not area_by_bin:
        raise ValueError(f"No landing plane found for {obj.name}")
    winner = max(area_by_bin, key=area_by_bin.get)
    return float(low.z + winner * bin_size), bin_size


def landing_patch_bounds(
    obj: bpy.types.Object, landing: float, tolerance: float
) -> tuple[Vector, Vector, int]:
    selected: set[int] = set()
    polygons = 0
    for polygon in obj.data.polygons:
        if polygon.normal.z < 0.82:
            continue
        heights = [float(obj.data.vertices[index].co.z) for index in polygon.vertices]
        if abs(float(polygon.center.z) - landing) > tolerance:
            continue
        if max(abs(height - landing) for height in heights) > tolerance * 2.0:
            continue
        selected.update(polygon.vertices)
        polygons += 1
    if not selected:
        raise ValueError(f"No landing patch found for {obj.name}")
    points = [obj.data.vertices[index].co for index in selected]
    low = Vector(min(point[axis] for point in points) for axis in range(3))
    high = Vector(max(point[axis] for point in points) for axis in range(3))
    return low, high, polygons


def mesh_hashes(mesh: bpy.types.Mesh) -> dict[str, str]:
    mesh.calc_loop_triangles()
    coordinates = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
    mesh.vertices.foreach_get("co", coordinates)
    indices = np.empty(len(mesh.loop_triangles) * 3, dtype=np.int32)
    mesh.loop_triangles.foreach_get("vertices", indices)
    return {
        "vertexPositionsFloat32Sha256": hashlib.sha256(coordinates.tobytes()).hexdigest(),
        "triangleIndicesInt32Sha256": hashlib.sha256(indices.tobytes()).hexdigest(),
    }


def inspect_topology(obj: bpy.types.Object) -> dict[str, Any]:
    mesh = obj.data
    mesh.calc_loop_triangles()
    degenerate = sum(1 for triangle in mesh.loop_triangles if triangle.area <= 1e-12)
    nonfinite = sum(
        1
        for vertex in mesh.vertices
        if not all(math.isfinite(float(value)) for value in vertex.co)
    )
    return {
        "vertices": len(mesh.vertices),
        "triangles": len(mesh.loop_triangles),
        "degenerateTriangles": degenerate,
        "nonfinitePositions": nonfinite,
        "uvLayers": [
            {
                "name": layer.name,
                "loops": len(layer.data),
                "finite": all(
                    math.isfinite(float(value))
                    for item in layer.data
                    for value in item.uv
                ),
            }
            for layer in mesh.uv_layers
        ],
        **mesh_hashes(mesh),
    }


def texture_record(path: Path) -> dict[str, Any]:
    with Image.open(path) as image:
        image.load()
        dimensions = list(image.size)
        mode = image.mode
    return {
        "file": relative(path),
        "bytes": path.stat().st_size,
        "sha256": digest(path),
        "dimensions": dimensions,
        "mode": mode,
    }


def make_runtime_maps(asset: str, config: dict[str, Any]) -> dict[str, Path]:
    source_dir = V5 / "meshy" / f"{asset}-ultra4k" / "textures"
    output_dir = TEXTURES / asset
    output_dir.mkdir(parents=True, exist_ok=True)
    base_path = source_dir / "set-0-base_color.png"
    normal_path = source_dir / "set-0-normal.png"
    provider_metal_path = source_dir / "set-0-metallic.png"
    provider_rough_path = source_dir / "set-0-roughness.png"

    with Image.open(base_path) as opened:
        base_small = opened.convert("RGB").resize((2048, 2048), Image.Resampling.LANCZOS)
    with Image.open(provider_metal_path) as opened:
        provider_metal_image = opened.convert("L")
    with Image.open(provider_rough_path) as opened:
        provider_rough_image = opened.convert("L")
    rgb = np.asarray(base_small, dtype=np.float32) / 255.0
    provider_metal = np.asarray(provider_metal_image, dtype=np.float32) / 255.0
    provider_rough = np.asarray(provider_rough_image, dtype=np.float32) / 255.0
    maximum = rgb.max(axis=2)
    minimum = rgb.min(axis=2)
    saturation = (maximum - minimum) / np.maximum(maximum, 1e-6)
    red, green, blue = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    warm = (
        (red > green * 1.035)
        & (green > blue * 1.12)
        & (red > blue * 1.24)
        & (saturation > 0.16)
        & (maximum > 0.20)
    )
    gold_binary = warm & (provider_metal > 0.38)
    mask = Image.fromarray(np.where(gold_binary, 255, 0).astype(np.uint8), mode="L")
    mask = mask.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    mask = mask.filter(ImageFilter.GaussianBlur(radius=0.55))
    mask_values = np.asarray(mask, dtype=np.float32) / 255.0

    metallic = mask_values * (0.84 + 0.14 * provider_metal)
    glass_rough = 0.16 + 0.30 * provider_rough
    gold_rough = 0.19 + 0.16 * provider_rough
    roughness = glass_rough * (1.0 - mask_values) + gold_rough * mask_values
    transmission = float(config["donorTransmission"]) * (1.0 - mask_values)

    mask_path = output_dir / f"{asset}-gold-mask-2k.png"
    metallic_path = output_dir / f"{asset}-metallic-2k.png"
    roughness_path = output_dir / f"{asset}-roughness-2k.png"
    transmission_path = output_dir / f"{asset}-transmission-2k.png"
    mask.save(mask_path, optimize=True)
    Image.fromarray(np.rint(np.clip(metallic, 0.0, 1.0) * 255.0).astype(np.uint8), mode="L").save(
        metallic_path, optimize=True
    )
    Image.fromarray(np.rint(np.clip(roughness, 0.0, 1.0) * 255.0).astype(np.uint8), mode="L").save(
        roughness_path, optimize=True
    )
    Image.fromarray(np.rint(np.clip(transmission, 0.0, 1.0) * 255.0).astype(np.uint8), mode="L").save(
        transmission_path, optimize=True
    )

    size = 1024
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    x = xx / float(size - 1)
    y = yy / float(size - 1)
    seed = 19 if asset == "frost" else 43
    rng = np.random.default_rng(seed)
    coarse = rng.normal(0.0, 1.0, (64, 64)).astype(np.float32)
    coarse_image = Image.fromarray(np.rint((coarse - coarse.min()) / (coarse.max() - coarse.min()) * 255).astype(np.uint8), mode="L")
    coarse_image = coarse_image.resize((size, size), Image.Resampling.BICUBIC).filter(ImageFilter.GaussianBlur(18.0))
    noise = np.asarray(coarse_image, dtype=np.float32) / 255.0 - 0.5
    veins = np.sin((x * 2.9 + y * 1.4) * math.tau + np.sin(y * 4.0) * 0.9)
    veins += 0.55 * np.sin((x * -1.2 + y * 3.5) * math.tau + 1.7)
    height = 0.55 * noise + 0.045 * veins
    base = np.array(config["frameBase"], dtype=np.float32)
    tint = np.clip(base[None, None, :] + height[:, :, None] * 0.075, 0.0, 1.0)
    frame_base_path = output_dir / f"{asset}-frame-base-1k.png"
    Image.fromarray(np.rint(tint * 255.0).astype(np.uint8), mode="RGB").save(frame_base_path, optimize=True)
    gradient_y, gradient_x = np.gradient(height)
    strength = 3.2
    nx = -gradient_x * strength
    ny = -gradient_y * strength
    nz = np.ones_like(nx)
    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    normal = np.stack((nx / length, ny / length, nz / length), axis=2)
    normal = normal * 0.5 + 0.5
    frame_normal_path = output_dir / f"{asset}-frame-normal-1k.png"
    Image.fromarray(np.rint(np.clip(normal, 0.0, 1.0) * 255.0).astype(np.uint8), mode="RGB").save(
        frame_normal_path, optimize=True
    )

    return {
        "base": base_path,
        "normal": normal_path,
        "providerMetallic": provider_metal_path,
        "providerRoughness": provider_rough_path,
        "goldMask": mask_path,
        "metallic": metallic_path,
        "roughness": roughness_path,
        "transmission": transmission_path,
        "frameBase": frame_base_path,
        "frameNormal": frame_normal_path,
    }


def load_image(path: Path, name: str, color_space: str) -> bpy.types.Image:
    image = bpy.data.images.load(str(path), check_existing=False)
    image.name = name
    image.colorspace_settings.name = color_space
    image.pack()
    return image


def add_volume_settings(
    material: bpy.types.Material,
    thickness: float,
    color: tuple[float, float, float],
    density: float,
) -> None:
    from io_scene_gltf2.blender.com.material_helpers import (
        create_settings_group,
        get_gltf_node_name,
    )

    nodes = material.node_tree.nodes
    links = material.node_tree.links
    output = next(node for node in nodes if node.type == "OUTPUT_MATERIAL")
    group_name = get_gltf_node_name()
    group_tree = bpy.data.node_groups.get(group_name) or create_settings_group(group_name)
    settings = nodes.new("ShaderNodeGroup")
    settings.name = group_name
    settings.node_tree = group_tree
    settings.inputs["Thickness"].default_value = thickness
    volume = nodes.new("ShaderNodeVolumeAbsorption")
    volume.name = "Physical tint absorption"
    volume.inputs["Color"].default_value = (*color, 1.0)
    volume.inputs["Density"].default_value = density
    links.new(volume.outputs["Volume"], output.inputs["Volume"])


def donor_material(asset: str, config: dict[str, Any], paths: dict[str, Path]) -> bpy.types.Material:
    material = bpy.data.materials.new(f"{asset}_glass_ice_gold")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.name = "Principled BSDF"
    links = material.node_tree.links

    base_node = nodes.new("ShaderNodeTexImage")
    base_node.name = "Provider 4K Base Color"
    base_node.image = load_image(paths["base"], f"{asset}-provider-base-4k", "sRGB")
    links.new(base_node.outputs["Color"], shader.inputs["Base Color"])

    normal_node = nodes.new("ShaderNodeTexImage")
    normal_node.name = "Provider 4K Normal"
    normal_node.image = load_image(paths["normal"], f"{asset}-provider-normal-4k", "Non-Color")
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.name = "Provider Tangent Normal"
    normal_map.inputs["Strength"].default_value = float(config["normalStrength"])
    links.new(normal_node.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], shader.inputs["Normal"])

    for key, socket in (
        ("metallic", "Metallic"),
        ("roughness", "Roughness"),
        ("transmission", "Transmission Weight"),
    ):
        node = nodes.new("ShaderNodeTexImage")
        node.name = f"V6 {key.title()} Mask"
        node.image = load_image(paths[key], f"{asset}-{key}-2k", "Non-Color")
        links.new(node.outputs["Color"], shader.inputs[socket])
    shader.inputs["IOR"].default_value = float(config["ior"])
    shader.inputs["Coat Weight"].default_value = 0.18
    shader.inputs["Coat Roughness"].default_value = 0.13
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    add_volume_settings(
        material,
        0.035,
        config["absorption"],
        float(config["absorptionDensity"]),
    )
    material.diffuse_color = (*config["frameBase"], 1.0)
    material["regionStrategy"] = "texture-space gold opacity and metallic response"
    material["goldOpaque"] = True
    material["glassIceTransmissive"] = True
    return material


def frame_material(asset: str, config: dict[str, Any], paths: dict[str, Path]) -> bpy.types.Material:
    material = bpy.data.materials.new(f"{asset}_landing_glass")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.name = "Principled BSDF"
    links = material.node_tree.links
    base_node = nodes.new("ShaderNodeTexImage")
    base_node.name = "Authored Frame Base"
    base_node.image = load_image(paths["frameBase"], f"{asset}-frame-base-1k", "sRGB")
    links.new(base_node.outputs["Color"], shader.inputs["Base Color"])
    normal_node = nodes.new("ShaderNodeTexImage")
    normal_node.name = "Authored Frame Normal"
    normal_node.image = load_image(paths["frameNormal"], f"{asset}-frame-normal-1k", "Non-Color")
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.inputs["Strength"].default_value = 0.42
    links.new(normal_node.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], shader.inputs["Normal"])
    shader.inputs["Metallic"].default_value = 0.0
    shader.inputs["Roughness"].default_value = 0.17 if asset == "frost" else 0.14
    shader.inputs["Transmission Weight"].default_value = float(config["frameTransmission"])
    shader.inputs["IOR"].default_value = float(config["ior"])
    shader.inputs["Coat Weight"].default_value = 0.26
    shader.inputs["Coat Roughness"].default_value = 0.10
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    add_volume_settings(
        material,
        FRAME_THICKNESS,
        config["absorption"],
        float(config["absorptionDensity"]) * 0.78,
    )
    material.diffuse_color = (*config["frameBase"], 1.0)
    return material


def gold_material(asset: str) -> bpy.types.Material:
    material = bpy.data.materials.new(f"{asset}_opaque_gold_boundary")
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (0.82, 0.47, 0.11, 1.0)
    shader.inputs["Metallic"].default_value = 0.94
    shader.inputs["Roughness"].default_value = 0.23
    shader.inputs["Coat Weight"].default_value = 0.22
    material.diffuse_color = (0.82, 0.47, 0.11, 1.0)
    material["opaque"] = True
    return material


def add_box(
    name: str,
    dimensions: tuple[float, float, float],
    location: tuple[float, float, float],
    material: bpy.types.Material,
    bevel: float,
    parent: bpy.types.Object,
    role: str,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}_mesh"
    obj.dimensions = dimensions
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    modifier = obj.modifiers.new("edge polish", "BEVEL")
    modifier.width = bevel
    modifier.segments = 3
    modifier.limit_method = "ANGLE"
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.materials.append(material)
    obj.parent = parent
    obj["role"] = role
    return obj


def frame_geometry(
    asset: str,
    root: bpy.types.Object,
    inner_width: float,
    inner_depth: float,
    glass: bpy.types.Material,
    gold: bpy.types.Material,
) -> list[bpy.types.Object]:
    objects: list[bpy.types.Object] = []
    overlap = 0.016
    front_depth = (LANDING_DEPTH - inner_depth) * 0.5 + overlap
    front_y = (LANDING_DEPTH * 0.5 + inner_depth * 0.5 - overlap) * 0.5
    centre_z = FRAME_TOP - FRAME_THICKNESS * 0.5
    for side, sign in (("front", -1.0), ("rear", 1.0)):
        objects.append(
            add_box(
                f"{asset}_landing_{side}",
                (LANDING_WIDTH, front_depth, FRAME_THICKNESS),
                (0.0, sign * front_y, centre_z),
                glass,
                0.012,
                root,
                "landing-extension",
            )
        )
    side_width = (LANDING_WIDTH - inner_width) * 0.5 + overlap
    if side_width > 0.018:
        side_x = (LANDING_WIDTH * 0.5 + inner_width * 0.5 - overlap) * 0.5
        for side, sign in (("left", -1.0), ("right", 1.0)):
            objects.append(
                add_box(
                    f"{asset}_landing_{side}",
                    (side_width, inner_depth, FRAME_THICKNESS),
                    (sign * side_x, 0.0, centre_z),
                    glass,
                    0.010,
                    root,
                    "landing-extension",
                )
            )

    boundary_z = BOUNDARY_TOP - BOUNDARY_THICKNESS * 0.5
    for side, sign in (("front", -1.0), ("rear", 1.0)):
        objects.append(
            add_box(
                f"{asset}_outer_gold_{side}",
                (LANDING_WIDTH, BOUNDARY_WIDTH, BOUNDARY_THICKNESS),
                (0.0, sign * (LANDING_DEPTH * 0.5 - BOUNDARY_WIDTH * 0.5), boundary_z),
                gold,
                0.005,
                root,
                "landing-boundary",
            )
        )
    side_length = LANDING_DEPTH - BOUNDARY_WIDTH * 2.0
    for side, sign in (("left", -1.0), ("right", 1.0)):
        objects.append(
            add_box(
                f"{asset}_outer_gold_{side}",
                (BOUNDARY_WIDTH, side_length, BOUNDARY_THICKNESS),
                (sign * (LANDING_WIDTH * 0.5 - BOUNDARY_WIDTH * 0.5), 0.0, boundary_z),
                gold,
                0.005,
                root,
                "landing-boundary",
            )
        )

    seam_width = 0.018
    seam_thickness = 0.010
    seam_z = 0.003 - seam_thickness * 0.5
    for side, sign in (("front", -1.0), ("rear", 1.0)):
        objects.append(
            add_box(
                f"{asset}_donor_seam_{side}",
                (min(inner_width + 0.06, LANDING_WIDTH - 0.05), seam_width, seam_thickness),
                (0.0, sign * inner_depth * 0.5, seam_z),
                gold,
                0.004,
                root,
                "donor-frame-seam",
            )
        )
    if inner_width < LANDING_WIDTH - 0.035:
        for side, sign in (("left", -1.0), ("right", 1.0)):
            objects.append(
                add_box(
                    f"{asset}_donor_seam_{side}",
                    (seam_width, inner_depth, seam_thickness),
                    (sign * inner_width * 0.5, 0.0, seam_z),
                    gold,
                    0.004,
                    root,
                    "donor-frame-seam",
                )
            )
    return objects


def descendants(root: bpy.types.Object) -> list[bpy.types.Object]:
    result: list[bpy.types.Object] = []
    pending = list(root.children)
    while pending:
        current = pending.pop()
        result.append(current)
        pending.extend(current.children)
    return result


def read_glb_json(path: Path) -> dict[str, Any]:
    with path.open("rb") as handle:
        magic, version, _length = struct.unpack("<4sII", handle.read(12))
        if magic != b"glTF" or version != 2:
            raise ValueError(f"{path.name} is not glTF 2 GLB")
        json_length, chunk_type = struct.unpack("<I4s", handle.read(8))
        if chunk_type != b"JSON":
            raise ValueError(f"{path.name} has no JSON first chunk")
        document = json.loads(handle.read(json_length).decode("utf-8").rstrip(" \t\r\n\x00"))
    return document


def fresh_import_validation(
    path: Path, asset: str, config: dict[str, Any], expected_total: int
) -> dict[str, Any]:
    document = read_glb_json(path)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    roots = [obj for obj in bpy.data.objects if obj.name == config["root"]]
    if len(roots) != 1:
        raise ValueError(f"Fresh import expected one {config['root']} root, found {len(roots)}")
    root = roots[0]
    meshes = [obj for obj in descendants(root) if obj.type == "MESH"]
    if not meshes:
        raise ValueError("Fresh import has no owned meshes")
    total_triangles = 0
    donor_rows = []
    for obj in meshes:
        obj.data.calc_loop_triangles()
        count = len(obj.data.loop_triangles)
        total_triangles += count
        if obj.name == f"{asset}_dense_donor":
            donor_rows.append({"name": obj.name, "vertices": len(obj.data.vertices), "triangles": count})
    if total_triangles != expected_total:
        raise ValueError(f"Fresh import triangles {total_triangles} != expected {expected_total}")
    if (
        len(donor_rows) != 1
        or donor_rows[0]["triangles"] != config["triangles"]
        or donor_rows[0]["vertices"] < config["vertices"]
        or donor_rows[0]["vertices"] > math.ceil(config["vertices"] * 1.01)
    ):
        raise ValueError(f"Fresh import donor topology changed: {donor_rows}")
    donor_rows[0]["authoringVertices"] = config["vertices"]
    donor_rows[0]["attributeSeamVertexSplits"] = donor_rows[0]["vertices"] - config["vertices"]
    low, high = bounds(meshes)
    extensions = sorted(document.get("extensionsUsed", []))
    required_extensions = {"KHR_materials_ior", "KHR_materials_transmission", "KHR_materials_volume"}
    missing = sorted(required_extensions.difference(extensions))
    if missing:
        raise ValueError(f"GLB lost physical material extensions: {missing}")
    materials = document.get("materials", [])
    root_extras: dict[str, Any] = {}
    for key in root.keys():
        value = root[key]
        root_extras[key] = list(value) if hasattr(value, "to_list") else value
    return {
        "root": root.name,
        "ownedMeshObjects": len(meshes),
        "donor": donor_rows[0],
        "totalTriangles": total_triangles,
        "boundsBlenderZUpMetres": {"min": vector(low), "max": vector(high)},
        "dimensionsBlenderZUpMetres": vector(high - low),
        "rootExtras": root_extras,
        "glb": {
            "extensionsUsed": extensions,
            "materials": [material.get("name") for material in materials],
            "images": len(document.get("images", [])),
            "textures": len(document.get("textures", [])),
            "meshes": len(document.get("meshes", [])),
            "nodes": len(document.get("nodes", [])),
        },
    }


def build(asset: str) -> dict[str, Any]:
    config = dict(ASSETS[asset])
    source = V5 / "meshy" / f"{asset}-ultra4k" / "dense-donor.glb"
    receipt_path = source.parent / "receipt.json"
    receipt = json.loads(receipt_path.read_text())
    if receipt.get("state") != "archived" or receipt.get("taskId") != config["taskId"]:
        raise ValueError(f"{asset} source receipt is not the accepted archive")
    if source.stat().st_size != config["bytes"] or digest(source) != config["sha256"]:
        raise ValueError(f"{asset} immutable source hash changed")
    paths = make_runtime_maps(asset, config)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "METERS"
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(source))
    meshes = [obj for obj in bpy.data.objects if obj not in before and obj.type == "MESH"]
    if len(meshes) != 1:
        raise ValueError(f"{asset} expected one imported donor mesh, found {len(meshes)}")
    donor = meshes[0]
    donor.data.transform(donor.matrix_world)
    donor.matrix_world = Matrix.Identity(4)
    donor.data.update()
    donor.data.calc_loop_triangles()
    original_topology = inspect_topology(donor)
    if original_topology["vertices"] != config["vertices"] or original_topology["triangles"] != config["triangles"]:
        raise ValueError(f"{asset} donor topology no longer matches accepted source")

    low, high = mesh_bounds(donor)
    original_dimensions = high - low
    landing, bin_size = dominant_landing(donor)
    patch_low, patch_high, patch_polygons = landing_patch_bounds(donor, landing, bin_size * 2.5)
    scale = VISUAL_WIDTH / float(original_dimensions.x)
    centre_x = (low.x + high.x) * 0.5
    centre_y = (low.y + high.y) * 0.5
    for vertex in donor.data.vertices:
        vertex.co.x = (vertex.co.x - centre_x) * scale
        vertex.co.y = (vertex.co.y - centre_y) * scale
        vertex.co.z = (vertex.co.z - landing) * scale
    donor.data.update()
    donor.data.calc_loop_triangles()
    fitted_topology = inspect_topology(donor)
    if fitted_topology["triangleIndicesInt32Sha256"] != original_topology["triangleIndicesInt32Sha256"]:
        raise ValueError("Uniform fit unexpectedly changed donor triangle indices")
    if fitted_topology["triangles"] != original_topology["triangles"]:
        raise ValueError("Uniform fit unexpectedly changed donor triangle count")

    donor.name = f"{asset}_dense_donor"
    donor.data.name = f"{asset}_dense_donor_mesh"
    donor.data.materials.clear()
    donor.data.materials.append(donor_material(asset, config, paths))
    donor["role"] = "accepted-dense-donor"
    donor["sourceTaskId"] = config["taskId"]
    donor["sourceSha256"] = config["sha256"]
    donor["topologyPreserved"] = True
    donor["uniformScale"] = scale

    root = bpy.data.objects.new(config["root"], None)
    scene.collection.objects.link(root)
    donor.parent = root
    root["assetId"] = f"cloudway-{asset}-v6-review"
    root["status"] = "review-only"
    root["coordinates"] = "Blender Z-up; glTF +Y up; metres"
    root["landingWidthMetres"] = LANDING_WIDTH
    root["landingDepthMetres"] = LANDING_DEPTH
    root["landingTopGlTfYMetres"] = 0.0
    root["colliderSizeMetres"] = [LANDING_WIDTH, 0.24, LANDING_DEPTH]
    root["sourceTopologyMutation"] = False
    root["fitMethod"] = "uniform donor fit plus authored non-overlapping landing frame"

    patch_width = float(patch_high.x - patch_low.x) * scale
    patch_depth = float(patch_high.y - patch_low.y) * scale
    inner_width = min(LANDING_WIDTH - 0.018, max(0.20, patch_width - 0.028))
    inner_depth = min(LANDING_DEPTH - 0.08, max(0.20, patch_depth - 0.030))
    authored = frame_geometry(
        asset,
        root,
        inner_width,
        inner_depth,
        frame_material(asset, config, paths),
        gold_material(asset),
    )

    for imported in list(bpy.data.objects):
        if imported is not donor and imported is not root and imported.parent is None and imported not in authored:
            bpy.data.objects.remove(imported, do_unlink=True)
    bpy.ops.outliner.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)

    all_meshes = [obj for obj in descendants(root) if obj.type == "MESH"]
    authored_triangles = 0
    for obj in authored:
        obj.data.calc_loop_triangles()
        authored_triangles += len(obj.data.loop_triangles)
    expected_total = config["triangles"] + authored_triangles
    total = 0
    for obj in all_meshes:
        obj.data.calc_loop_triangles()
        total += len(obj.data.loop_triangles)
    if total != expected_total:
        raise ValueError(f"Authored triangle accounting mismatch {total} != {expected_total}")

    EXPORTS.mkdir(parents=True, exist_ok=True)
    SOURCES.mkdir(parents=True, exist_ok=True)
    REPORTS.mkdir(parents=True, exist_ok=True)
    blend_path = SOURCES / f"{asset}-v6-derivative.blend"
    glb_path = EXPORTS / f"cloudway-{asset}-v6-derivative.glb"
    bpy.ops.file.pack_all()
    missing = sorted(
        image.filepath
        for image in bpy.data.images
        if image.type == "IMAGE" and image.source != "GENERATED" and image.packed_file is None
    )
    if missing:
        raise ValueError(f"Packed source still has external images: {missing}")
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path), compress=True, check_existing=False)

    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for obj in descendants(root):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_materials="EXPORT",
        export_animations=False,
        export_normals=True,
        export_tangents=True,
    )

    validation = fresh_import_validation(glb_path, asset, config, expected_total)
    report = {
        "schema": 1,
        "asset": asset,
        "status": "review-only fitted derivative; runtime integration not authorized",
        "source": {
            "file": relative(source),
            "bytes": source.stat().st_size,
            "sha256": digest(source),
            "receipt": relative(receipt_path),
            "receiptSha256": digest(receipt_path),
            "taskId": config["taskId"],
        },
        "fit": {
            "method": "Uniformly preserve the 1.80m donor silhouette, align its sampled landing to Z=0, and fill only the missing area with a separate glass/ice frame.",
            "axisWiseStretching": False,
            "donorDecimation": False,
            "donorVertexMutation": "uniform scale and translation only",
            "uniformScale": round(scale, 9),
            "rawDimensionsBlenderZUpMetres": vector(original_dimensions),
            "landingRawZ": round(landing, 9),
            "landingBinSizeRaw": round(bin_size, 9),
            "landingPatchPolygons": patch_polygons,
            "landingPatchAfterFitMetres": [round(patch_width, 9), round(patch_depth, 9)],
            "authoredInnerOpeningMetres": [round(inner_width, 9), round(inner_depth, 9)],
            "authoritativeLandingEnvelopeMetres": [LANDING_WIDTH, LANDING_DEPTH],
            "landingTopBlenderZMetres": 0.0,
            "landingTopGlTfYMetres": 0.0,
        },
        "topology": {
            "sourceBeforeFit": original_topology,
            "donorAfterFit": fitted_topology,
            "donorTriangleIndicesPreserved": True,
            "authoredMeshObjects": len(authored),
            "authoredTriangles": authored_triangles,
            "exportTotalTriangles": expected_total,
        },
        "materials": {
            "donor": {
                "strategy": "single fused atlas with explicit gold metallic/opaque and glass/ice transmission masks",
                "ior": config["ior"],
                "glassTransmissionMaximum": config["donorTransmission"],
                "providerBaseColorAndNormalPreserved": True,
            },
            "landingFrame": {
                "strategy": "separate bevelled transmissive glass/ice frame with authored texture",
                "ior": config["ior"],
                "transmission": config["frameTransmission"],
            },
            "goldBoundary": "separate opaque metallic gold material",
        },
        "textures": [texture_record(path) for path in dict.fromkeys(paths.values())],
        "packedBlend": {
            "file": relative(blend_path),
            "bytes": blend_path.stat().st_size,
            "sha256": digest(blend_path),
        },
        "export": {
            "file": relative(glb_path),
            "bytes": glb_path.stat().st_size,
            "sha256": digest(glb_path),
        },
        "freshImport": validation,
        "tool": {"blender": bpy.app.version_string, "numpy": np.__version__},
        "command": (
            "rtk proxy timeout 3600 env ALSOFT_DRIVERS=null blender -b --factory-startup "
            "--python-exit-code 1 --python art/glass-adventure/platform-trials/v6/production/"
            f"build_fitted_derivative.py -- --asset {asset}"
        ),
    }
    report_path = REPORTS / f"{asset}-v6-build.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n")
    print("V6_BUILD=" + json.dumps(report), flush=True)
    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", choices=sorted(ASSETS), required=True)
    arguments = parser.parse_args(__import__("sys").argv[__import__("sys").argv.index("--") + 1 :])
    build(arguments.asset)
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
