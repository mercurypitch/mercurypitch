#!/usr/bin/env python3
"""Create Rose crackle semantic materials and bounded visual proof renders."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Iterable

import bpy
from mathutils import Vector


ASSET = "rose-quartz-crackle-fast"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def image_node(
    nodes: bpy.types.Nodes,
    name: str,
    image: bpy.types.Image,
    location: tuple[float, float],
) -> bpy.types.Node:
    node = nodes.new("ShaderNodeTexImage")
    node.name = name
    node.label = name
    node.image = image
    node.location = location
    node.interpolation = "Linear"
    return node


def semantic_mask_nodes(
    nodes: bpy.types.Nodes,
    mask_image: bpy.types.Image,
) -> bpy.types.NodeSocket:
    mask = image_node(
        nodes,
        "Authored warm-gold plus metallic mask",
        mask_image,
        (-760, -500),
    )
    attribute = nodes.new("ShaderNodeAttribute")
    attribute.attribute_name = "rose_corner_region"
    attribute.location = (-760, -680)
    maximum = nodes.new("ShaderNodeMath")
    maximum.operation = "MAXIMUM"
    maximum.location = (-480, -540)
    nodes.id_data.links.new(mask.outputs["Color"], maximum.inputs[0])
    nodes.id_data.links.new(attribute.outputs["Fac"], maximum.inputs[1])
    return maximum.outputs[0]


def source_images(mask_path: Path) -> dict[str, bpy.types.Image]:
    images = {
        role: bpy.data.images.get(f"{ASSET}__{role}")
        for role in ("base_color", "normal", "metallic", "roughness")
    }
    require(all(image is not None for image in images.values()), "Packed PBR images missing")
    mask = bpy.data.images.load(str(mask_path), check_existing=False)
    mask.name = "rose-quartz-crackle-fast__gold_semantic_mask_v1"
    mask.colorspace_settings.name = "Non-Color"
    mask["semanticRole"] = "gold-framework-mask"
    mask["authoredFrom"] = (
        "base-color warmth plus metallic support; separately audited corners"
    )
    images["mask"] = mask
    return images  # type: ignore[return-value]


def framework_material(
    name: str,
    images: dict[str, bpy.types.Image],
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.surface_render_method = "DITHERED"
    material.thickness_mode = "SLAB"
    material.refraction_depth = 0.24
    material["semanticRole"] = "framework"
    material["goldMaskInference"] = "base color plus metallic, never metallic alone"
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (780, 80)
    mix = nodes.new("ShaderNodeMixShader")
    mix.location = (520, 80)
    transparent = nodes.new("ShaderNodeBsdfTransparent")
    transparent.location = (220, -180)
    mask_output = semantic_mask_nodes(nodes, images["mask"])
    links.new(mask_output, mix.inputs[0])
    surface = nodes.new("ShaderNodeBsdfPrincipled")
    surface.location = (180, 170)
    base = image_node(nodes, "Provider base color", images["base_color"], (-760, 310))
    roughness = image_node(nodes, "Provider roughness", images["roughness"], (-760, 90))
    normal_texture = image_node(nodes, "Provider normal", images["normal"], (-760, -140))
    metallic = image_node(nodes, "Provider metallic", images["metallic"], (-760, 520))
    normal = nodes.new("ShaderNodeNormalMap")
    normal.location = (-220, -110)
    normal.inputs["Strength"].default_value = 1.0
    links.new(normal_texture.outputs["Color"], normal.inputs["Color"])
    links.new(base.outputs["Color"], surface.inputs["Base Color"])
    links.new(roughness.outputs["Color"], surface.inputs["Roughness"])
    links.new(normal.outputs["Normal"], surface.inputs["Normal"])
    links.new(metallic.outputs["Color"], surface.inputs["Metallic"])
    surface.inputs["IOR"].default_value = 1.46
    surface.inputs["Transmission Weight"].default_value = 0.0
    links.new(transparent.outputs[0], mix.inputs[1])
    links.new(surface.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs["Surface"])
    return material


def composite_material(
    name: str,
    images: dict[str, bpy.types.Image],
    diagnostic: bool = False,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.surface_render_method = "DITHERED"
    material.use_raytrace_refraction = not diagnostic
    material.use_screen_refraction = not diagnostic
    material.thickness_mode = "SLAB"
    material.refraction_depth = 0.24
    material["semanticRole"] = "closed-crystal-with-reviewed-framework-binding"
    material["goldMaskInference"] = "base color plus metallic, never metallic alone"
    material["crystalColorTreatment"] = (
        "source base color screened with pale rose; provider roughness retained only on framework"
    )
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (780, 80)
    mix = nodes.new("ShaderNodeMixShader")
    mix.location = (510, 80)
    mask_output = semantic_mask_nodes(nodes, images["mask"])
    links.new(mask_output, mix.inputs[0])
    if diagnostic:
        crystal = nodes.new("ShaderNodeEmission")
        crystal.inputs["Color"].default_value = (0.02, 0.48, 1.0, 1.0)
        crystal.inputs["Strength"].default_value = 0.8
        crystal.location = (160, 180)
        framework = nodes.new("ShaderNodeEmission")
        framework.inputs["Color"].default_value = (1.0, 0.16, 0.015, 1.0)
        framework.inputs["Strength"].default_value = 0.8
        framework.location = (160, -80)
    else:
        crystal = nodes.new("ShaderNodeBsdfPrincipled")
        crystal.location = (150, 210)
        framework = nodes.new("ShaderNodeBsdfPrincipled")
        framework.location = (150, -100)
        base = image_node(nodes, "Provider base color", images["base_color"], (-760, 320))
        roughness = image_node(nodes, "Provider roughness", images["roughness"], (-760, 90))
        normal_texture = image_node(nodes, "Provider normal", images["normal"], (-760, -140))
        metallic = image_node(nodes, "Provider metallic", images["metallic"], (-760, 540))
        normal = nodes.new("ShaderNodeNormalMap")
        normal.location = (-220, -110)
        normal.inputs["Strength"].default_value = 0.6
        links.new(normal_texture.outputs["Color"], normal.inputs["Color"])
        crystal_base = nodes.new("ShaderNodeMixRGB")
        crystal_base.name = "Source-preserving pale rose lift"
        crystal_base.blend_type = "SCREEN"
        crystal_base.inputs[0].default_value = 1.0
        crystal_base.inputs[2].default_value = (0.34, 0.055, 0.11, 1.0)
        crystal_base.location = (-220, 250)
        links.new(base.outputs["Color"], crystal_base.inputs[1])
        links.new(crystal_base.outputs["Color"], crystal.inputs["Base Color"])
        links.new(base.outputs["Color"], framework.inputs["Base Color"])
        for shader in (crystal, framework):
            links.new(normal.outputs["Normal"], shader.inputs["Normal"])
            shader.inputs["IOR"].default_value = 1.46
        links.new(roughness.outputs["Color"], framework.inputs["Roughness"])
        crystal.inputs["Roughness"].default_value = 0.08
        crystal.inputs["Metallic"].default_value = 0.0
        crystal.inputs["Transmission Weight"].default_value = 0.94
        crystal.inputs["Coat Weight"].default_value = 0.14
        crystal.inputs["Coat Roughness"].default_value = 0.08
        links.new(metallic.outputs["Color"], framework.inputs["Metallic"])
        framework.inputs["Transmission Weight"].default_value = 0.0
    links.new(crystal.outputs[0], mix.inputs[1])
    links.new(framework.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs["Surface"])
    return material


def shard_material(shard_depth: float) -> bpy.types.Material:
    material = bpy.data.materials.new("RoseCrystalShardGlass")
    material.use_nodes = True
    material.use_raytrace_refraction = True
    material.use_screen_refraction = True
    material.thickness_mode = "SLAB"
    material.refraction_depth = shard_depth
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (0.92, 0.28, 0.42, 1.0)
    shader.inputs["Roughness"].default_value = 0.12
    shader.inputs["IOR"].default_value = 1.46
    shader.inputs["Transmission Weight"].default_value = 0.92
    shader.inputs["Coat Weight"].default_value = 0.18
    return material


def checker_material() -> bpy.types.Material:
    material = bpy.data.materials.new("Rose transmission proof field")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    checker = nodes.new("ShaderNodeTexChecker")
    coordinates = nodes.new("ShaderNodeTexCoord")
    checker.inputs["Color1"].default_value = (0.015, 0.18, 0.34, 1.0)
    checker.inputs["Color2"].default_value = (0.64, 0.08, 0.20, 1.0)
    checker.inputs["Scale"].default_value = 7.0
    shader.inputs["Roughness"].default_value = 0.42
    links.new(coordinates.outputs["Generated"], checker.inputs["Vector"])
    links.new(checker.outputs["Color"], shader.inputs["Base Color"])
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return material


def beauty_floor_material() -> bpy.types.Material:
    material = bpy.data.materials.new("Rose pastel-sky beauty field")
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (0.58, 0.69, 0.92, 1.0)
    shader.inputs["Roughness"].default_value = 0.46
    shader.inputs["Metallic"].default_value = 0.0
    return material


def create_proof_stage(
    prepare: Any,
    target: bpy.types.Collection,
) -> tuple[Any, Any, Any]:
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.use_raytracing = True
    scene.eevee.ray_tracing_method = "SCREEN"
    scene.eevee.taa_render_samples = 64
    scene.render.resolution_x = 1100
    scene.render.resolution_y = 820
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = False
    scene.render.use_file_extension = True
    scene.render.dither_intensity = 0.0
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.world = scene.world or bpy.data.worlds.new("Rose semantic proof world")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.008, 0.014, 0.026, 1.0)
    background.inputs["Strength"].default_value = 0.24
    board_mesh = bpy.data.meshes.new("Rose proof transmission field geometry")
    board_mesh.from_pydata(
        [
            (-2.3, -2.3, -0.31),
            (2.3, -2.3, -0.31),
            (2.3, 2.3, -0.31),
            (-2.3, 2.3, -0.31),
        ],
        [],
        [[0, 1, 2, 3]],
    )
    board_mesh.update()
    board = bpy.data.objects.new("Rose_Proof_Transmission_Field", board_mesh)
    target.objects.link(board)
    board.data.materials.append(checker_material())
    board.data.materials.append(beauty_floor_material())
    camera_data = bpy.data.cameras.new("Rose semantic proof camera")
    camera_data.lens = 40.4
    camera_data.sensor_width = 36.0
    camera_data.clip_start = 0.01
    camera_data.clip_end = 100.0
    camera = bpy.data.objects.new("Rose_Proof_Camera", camera_data)
    target.objects.link(camera)
    scene.camera = camera
    look_at = Vector((0.0, 0.0, -0.08))
    prepare.add_area(
        target,
        "Rose proof key",
        (2.2, -2.8, 3.2),
        1050.0,
        2.6,
        (1.0, 0.72, 0.55),
        look_at,
    )
    prepare.add_area(
        target,
        "Rose proof fill",
        (-2.8, -0.2, 1.8),
        780.0,
        3.0,
        (0.48, 0.68, 1.0),
        look_at,
    )
    prepare.add_area(
        target,
        "Rose proof rim",
        (0.2, 2.9, 2.4),
        920.0,
        2.4,
        (0.62, 1.0, 0.86),
        look_at,
    )
    return scene, camera, board


def configure_camera(prepare: Any, camera: bpy.types.Object, view: str) -> None:
    target = Vector((0.0, 0.0, -0.085))
    if view == "game-camera":
        camera.location = (2.62, -2.62, 1.34)
        camera.data.lens = 40.4
    elif view == "close":
        camera.location = (1.62, -1.78, 0.86)
        camera.data.lens = 52.0
    else:
        raise ValueError(f"Unknown proof view {view}")
    prepare.point_at(camera, target)


def render_modes(
    prepare: Any,
    proof_views: Iterable[str],
    scene: bpy.types.Scene,
    camera: bpy.types.Object,
    board: bpy.types.Object,
    proof_dir: Path,
    source_review: bpy.types.Object,
    crystal: bpy.types.Object,
    framework: bpy.types.Object,
    shards: list[bpy.types.Object],
    materials: dict[str, bpy.types.Material],
) -> list[Path]:
    proof_dir.mkdir(parents=True, exist_ok=True)
    provider_material = source_review.material_slots[0].material
    crystal_pbr = crystal.material_slots[0].material
    framework_pbr = framework.material_slots[0].material
    checker = board.data.materials[0]
    beauty_floor = board.data.materials[1]
    background = scene.world.node_tree.nodes.get("Background")
    witness_background = tuple(background.inputs["Color"].default_value)
    witness_strength = float(background.inputs["Strength"].default_value)
    clay = prepare.clay_material()
    outputs: list[Path] = []
    for view in proof_views:
        configure_camera(prepare, camera, view)
        modes = (
            "provider-pbr",
            "provider-clay",
            "candidate-pbr",
            "candidate-clay",
            "semantic-mask",
        )
        for mode in modes:
            source_review.hide_render = not mode.startswith("provider")
            crystal.hide_render = mode.startswith("provider")
            framework.hide_render = True
            source_review.material_slots[0].link = "OBJECT"
            source_review.material_slots[0].material = (
                clay if mode == "provider-clay" else provider_material
            )
            if mode == "candidate-clay":
                crystal.material_slots[0].material = clay
            elif mode == "semantic-mask":
                crystal.material_slots[0].material = materials["compositeDiagnostic"]
            else:
                crystal.material_slots[0].material = crystal_pbr
                framework.material_slots[0].material = framework_pbr
            for shard in shards:
                shard.hide_render = True
            board.hide_render = False
            target = proof_dir / f"{mode}-{view}.png"
            prepare.render_atomic(scene, target)
            outputs.append(target)
        source_review.hide_render = True
        crystal.hide_render = False
        framework.hide_render = True
        crystal.material_slots[0].material = crystal_pbr
        for shard in shards:
            shard.hide_render = True
        board.data.materials[0] = beauty_floor
        background.inputs["Color"].default_value = (0.58, 0.74, 1.0, 1.0)
        background.inputs["Strength"].default_value = 0.62
        scene.eevee.taa_render_samples = 512
        target = proof_dir / f"candidate-beauty-{view}.png"
        prepare.render_atomic(scene, target)
        outputs.append(target)
        board.data.materials[0] = checker
        background.inputs["Color"].default_value = witness_background
        background.inputs["Strength"].default_value = witness_strength
        scene.eevee.taa_render_samples = 64
    source_review.hide_render = True
    crystal.hide_render = False
    framework.hide_render = False
    crystal.material_slots[0].material = crystal_pbr
    framework.material_slots[0].material = framework_pbr
    configure_camera(prepare, camera, "game-camera")
    shard_offsets = []
    for shard in shards:
        centre = shard.data.vertices[0].co.copy()
        for vertex in shard.data.vertices:
            centre += vertex.co
        centre /= len(shard.data.vertices) + 1
        direction = Vector((centre.x, centre.y, 0.65))
        if direction.length_squared > 0:
            direction.normalize()
        offset = direction * 0.30
        shard.location = offset
        shard.hide_render = False
        shard_offsets.append(tuple(offset))
    crystal.hide_render = True
    framework.hide_render = False
    target = proof_dir / "candidate-shards-exploded-game-camera.png"
    prepare.render_atomic(scene, target)
    outputs.append(target)
    for shard, offset in zip(shards, shard_offsets):
        shard.location -= Vector(offset)
        shard.hide_render = True
    crystal.hide_render = False
    framework.hide_render = True
    return outputs


def proof_records(prepare: Any, files: Iterable[Path]) -> list[dict[str, Any]]:
    result = []
    for path in files:
        image = bpy.data.images.load(str(path), check_existing=False)
        result.append(prepare.file_record(path, [int(image.size[0]), int(image.size[1])]))
        bpy.data.images.remove(image)
    return result
