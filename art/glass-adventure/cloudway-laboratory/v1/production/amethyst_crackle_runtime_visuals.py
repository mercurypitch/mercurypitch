#!/usr/bin/env python3
"""Author Amethyst crackle materials and matched candidate proof renders."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Iterable

import bpy
from mathutils import Vector


ASSET = "amethyst-crackle-slow"
GLASS_MATERIAL = "CloudwayLab_Amethyst__glass"
FRAMEWORK_MATERIAL = "CloudwayLab_Amethyst__framework"
DETAIL_MATERIAL = "CloudwayLab_Amethyst__internal_detail"
ACCENT_MATERIAL = "CloudwayLab_Amethyst__luminous_accent"
CORNER_MATERIAL = "CloudwayLab_Amethyst__corner_provider_pbr"


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


def source_images() -> dict[str, bpy.types.Image]:
    images = {
        role: bpy.data.images.get(f"{ASSET}__{role}")
        for role in ("base_color", "normal", "metallic", "roughness")
    }
    require(all(image is not None for image in images.values()), "Packed Amethyst PBR images missing")
    return images  # type: ignore[return-value]


def glass_material() -> bpy.types.Material:
    material = bpy.data.materials.new(GLASS_MATERIAL)
    material.use_nodes = True
    material.surface_render_method = "DITHERED"
    material.use_raytrace_refraction = True
    material.use_screen_refraction = True
    material.thickness_mode = "SLAB"
    material.refraction_depth = 0.25
    material["semanticRole"] = "runtime-amethyst-glass"
    material["runtimePolicy"] = "physical transmission; metalness zero"
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (480, 80)
    surface = nodes.new("ShaderNodeBsdfPrincipled")
    surface.location = (100, 120)
    # Keep new fracture cut faces subordinate to the exact pale provider exterior.
    # The earlier saturated violet made the interior volumes read electric blue in
    # Three even though the opaque source surface was restrained lavender.
    surface.inputs["Base Color"].default_value = (0.58, 0.40, 0.72, 1.0)
    surface.inputs["Roughness"].default_value = 0.055
    surface.inputs["IOR"].default_value = 1.47
    surface.inputs["Metallic"].default_value = 0.0
    surface.inputs["Transmission Weight"].default_value = 0.975
    surface.inputs["Coat Weight"].default_value = 0.30
    surface.inputs["Coat Roughness"].default_value = 0.045
    surface.inputs["Emission Color"].default_value = (0.0, 0.0, 0.0, 1.0)
    surface.inputs["Emission Strength"].default_value = 0.0
    volume = nodes.new("ShaderNodeVolumeAbsorption")
    volume.location = (100, -130)
    volume.inputs["Color"].default_value = (0.47, 0.12, 0.94, 1.0)
    volume.inputs["Density"].default_value = 0.018
    links.new(surface.outputs[0], output.inputs["Surface"])
    links.new(volume.outputs[0], output.inputs["Volume"])
    return material


def framework_material() -> bpy.types.Material:
    material = bpy.data.materials.new(FRAMEWORK_MATERIAL)
    material.use_nodes = True
    material["semanticRole"] = "runtime-persistent-rose-gold-framework"
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (0.70, 0.24, 0.055, 1.0)
    shader.inputs["Metallic"].default_value = 0.93
    shader.inputs["Roughness"].default_value = 0.17
    shader.inputs["Coat Weight"].default_value = 0.22
    shader.inputs["Coat Roughness"].default_value = 0.07
    return material


def accent_material() -> bpy.types.Material:
    material = bpy.data.materials.new(ACCENT_MATERIAL)
    material.use_nodes = True
    material["semanticRole"] = "runtime-persistent-sparse-luminous-accent"
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (0.28, 0.035, 0.92, 1.0)
    shader.inputs["Metallic"].default_value = 0.18
    shader.inputs["Roughness"].default_value = 0.18
    shader.inputs["Emission Color"].default_value = (0.18, 0.01, 1.0, 1.0)
    shader.inputs["Emission Strength"].default_value = 2.2
    return material


def internal_detail_material(images: dict[str, bpy.types.Image]) -> bpy.types.Material:
    """Rebuild the accepted opaque provider PBR under the semantic runtime name."""
    material = bpy.data.materials.new(DETAIL_MATERIAL)
    material.use_nodes = True
    material.use_backface_culling = False
    material["semanticRole"] = "runtime-subordinate-exact-provider-intact-body"
    material["sourceUse"] = "provider base colour, normal, metallic, and roughness maps"
    material["runtimePolicy"] = "accepted opaque provider appearance; no semantic pixel inference"
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (760, 80)
    surface = nodes.new("ShaderNodeBsdfPrincipled")
    surface.location = (460, 80)
    surface.inputs["IOR"].default_value = 1.45
    base = image_node(nodes, "Provider base_color", images["base_color"], (-640, 320))
    normal_texture = image_node(nodes, "Provider normal", images["normal"], (-640, -340))
    metallic = image_node(nodes, "Provider metallic", images["metallic"], (-640, -120))
    roughness = image_node(nodes, "Provider roughness", images["roughness"], (-640, 100))
    normal = nodes.new("ShaderNodeNormalMap")
    normal.location = (170, -140)
    normal.inputs["Strength"].default_value = 1.0
    links.new(base.outputs["Color"], surface.inputs["Base Color"])
    links.new(metallic.outputs["Color"], surface.inputs["Metallic"])
    links.new(roughness.outputs["Color"], surface.inputs["Roughness"])
    links.new(normal_texture.outputs["Color"], normal.inputs["Color"])
    links.new(normal.outputs["Normal"], surface.inputs["Normal"])
    links.new(surface.outputs[0], output.inputs["Surface"])
    return material


def corner_provider_material(images: dict[str, bpy.types.Image]) -> bpy.types.Material:
    material = bpy.data.materials.new(CORNER_MATERIAL)
    material.use_nodes = True
    material.use_backface_culling = False
    material["semanticRole"] = "persistent-reviewed-source-corner-detail"
    material["selectionPolicy"] = "geometry-space corner faces; never metallic-pixel inference"
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (520, 80)
    surface = nodes.new("ShaderNodeBsdfPrincipled")
    surface.location = (160, 90)
    base = image_node(nodes, "Provider corner base colour", images["base_color"], (-620, 320))
    roughness = image_node(nodes, "Provider corner roughness", images["roughness"], (-620, 90))
    metallic = image_node(nodes, "Provider corner metallic", images["metallic"], (-620, 520))
    normal_texture = image_node(nodes, "Provider corner normal", images["normal"], (-620, -140))
    normal = nodes.new("ShaderNodeNormalMap")
    normal.location = (-180, -100)
    normal.inputs["Strength"].default_value = 1.0
    links.new(normal_texture.outputs["Color"], normal.inputs["Color"])
    links.new(base.outputs["Color"], surface.inputs["Base Color"])
    links.new(roughness.outputs["Color"], surface.inputs["Roughness"])
    links.new(metallic.outputs["Color"], surface.inputs["Metallic"])
    links.new(normal.outputs["Normal"], surface.inputs["Normal"])
    surface.inputs["Transmission Weight"].default_value = 0.0
    links.new(surface.outputs[0], output.inputs["Surface"])
    return material


def diagnostic_material(name: str, colour: tuple[float, float, float, float]) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = colour
    emission.inputs["Strength"].default_value = 0.85
    links.new(emission.outputs[0], output.inputs["Surface"])
    return material


def floor_material(name: str, colour: tuple[float, float, float, float], roughness: float) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = colour
    shader.inputs["Roughness"].default_value = roughness
    return material


def checker_material() -> bpy.types.Material:
    material = bpy.data.materials.new("Amethyst transmission witness")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    checker = nodes.new("ShaderNodeTexChecker")
    coordinates = nodes.new("ShaderNodeTexCoord")
    checker.inputs["Color1"].default_value = (0.015, 0.28, 0.52, 1.0)
    checker.inputs["Color2"].default_value = (0.88, 0.08, 0.19, 1.0)
    checker.inputs["Scale"].default_value = 9.0
    shader.inputs["Roughness"].default_value = 0.42
    links.new(coordinates.outputs["Generated"], checker.inputs["Vector"])
    links.new(checker.outputs["Color"], shader.inputs["Base Color"])
    links.new(shader.outputs[0], output.inputs["Surface"])
    return material


def create_proof_stage(
    prepare: Any, collection: bpy.types.Collection
) -> tuple[bpy.types.Scene, bpy.types.Object, bpy.types.Object]:
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.use_raytracing = True
    scene.eevee.ray_tracing_method = "SCREEN"
    scene.eevee.taa_render_samples = 160
    scene.render.resolution_x = 1100
    scene.render.resolution_y = 820
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = False
    scene.render.dither_intensity = 0.0
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.world = scene.world or bpy.data.worlds.new("Amethyst hybrid proof world")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.24, 0.40, 0.68, 1.0)
    background.inputs["Strength"].default_value = 0.42

    bpy.ops.mesh.primitive_plane_add(size=6.0, location=(0.0, 0.0, -0.325))
    board = bpy.context.object
    board.name = "Amethyst_Hybrid_Proof_Field"
    for current in list(board.users_collection):
        current.objects.unlink(board)
    collection.objects.link(board)
    board.data.materials.append(
        floor_material("Amethyst cool-sky beauty field", (0.48, 0.64, 0.84, 1.0), 0.34)
    )
    board.data.materials.append(checker_material())

    camera_data = bpy.data.cameras.new("Amethyst hybrid proof camera")
    camera_data.lens = 43.0
    camera_data.sensor_width = 36.0
    camera_data.clip_start = 0.01
    camera_data.clip_end = 100.0
    camera = bpy.data.objects.new("Amethyst_Hybrid_Proof_Camera", camera_data)
    collection.objects.link(camera)
    scene.camera = camera
    target = Vector((0.0, 0.0, -0.10))
    prepare.add_area(collection, "Amethyst warm key", (2.5, -2.7, 3.2), 1320.0, 2.5, (1.0, 0.67, 0.54), target)
    prepare.add_area(collection, "Amethyst blue fill", (-2.6, -0.3, 2.1), 940.0, 3.0, (0.48, 0.66, 1.0), target)
    prepare.add_area(collection, "Amethyst violet rim", (0.0, 2.8, 2.6), 1180.0, 2.2, (0.73, 0.55, 1.0), target)
    return scene, camera, board


def configure_camera(prepare: Any, camera: bpy.types.Object, view: str) -> None:
    target = Vector((0.0, 0.0, -0.10))
    camera.data.type = "PERSP"
    if view == "game-camera":
        camera.location = (2.48, -2.42, 1.36)
        camera.data.lens = 42.0
    elif view == "side":
        camera.location = (2.75, -0.05, 0.32)
        camera.data.lens = 58.0
    elif view == "top":
        camera.location = (0.0, -0.01, 4.0)
        camera.data.type = "ORTHO"
        camera.data.ortho_scale = 2.15
        target = Vector((0.0, 0.0, -0.04))
    else:
        raise ValueError(f"Unknown proof view {view}")
    prepare.point_at(camera, target)


def render_atomic(prepare: Any, scene: bpy.types.Scene, path: Path, samples: int) -> Path:
    scene.eevee.taa_render_samples = samples
    prepare.render_atomic(scene, path)
    return path


def proof_records(prepare: Any, files: Iterable[Path]) -> list[dict[str, Any]]:
    records = []
    for path in files:
        image = bpy.data.images.load(str(path), check_existing=False)
        records.append(prepare.file_record(path, [int(image.size[0]), int(image.size[1])]))
        bpy.data.images.remove(image)
    return records
