#!/usr/bin/env python3
"""Author Rose crackle materials and matched candidate proof renders."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Iterable

import bpy
from mathutils import Vector


ASSET = "rose-quartz-crackle-fast"
GLASS_MATERIAL = "CloudwayLab_RoseQuartz__glass"
FRAMEWORK_MATERIAL = "CloudwayLab_RoseQuartz__framework"
DETAIL_MATERIAL = "CloudwayLab_RoseQuartz__internal_detail"
IVORY_MATERIAL = "CloudwayLab_RoseQuartz__ivory"
CORNER_MATERIAL = "CloudwayLab_RoseQuartz__corner_provider_pbr"


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


def source_images(mask_path: Path) -> dict[str, bpy.types.Image]:
    images = {
        role: bpy.data.images.get(f"{ASSET}__{role}")
        for role in ("base_color", "normal", "metallic", "roughness")
    }
    require(all(image is not None for image in images.values()), "Packed PBR images missing")
    mask = bpy.data.images.load(str(mask_path), check_existing=False)
    mask.name = "rose-quartz-crackle-fast__gold_semantic_mask_v1_hybrid"
    mask.colorspace_settings.name = "Non-Color"
    mask["semanticRole"] = "detail-exclusion-mask"
    images["mask"] = mask
    return images  # type: ignore[return-value]


def glass_material() -> bpy.types.Material:
    material = bpy.data.materials.new(GLASS_MATERIAL)
    material.use_nodes = True
    material.surface_render_method = "DITHERED"
    material.use_raytrace_refraction = True
    material.use_screen_refraction = True
    material.thickness_mode = "SLAB"
    material.refraction_depth = 0.24
    material["semanticRole"] = "runtime-crystal-glass"
    material["runtimePolicy"] = "replace with MeshPhysicalMaterial; metalness zero"
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (480, 80)
    surface = nodes.new("ShaderNodeBsdfPrincipled")
    surface.location = (100, 120)
    surface.inputs["Base Color"].default_value = (1.0, 0.48, 0.65, 1.0)
    surface.inputs["Roughness"].default_value = 0.075
    surface.inputs["IOR"].default_value = 1.46
    surface.inputs["Metallic"].default_value = 0.0
    surface.inputs["Transmission Weight"].default_value = 0.965
    surface.inputs["Coat Weight"].default_value = 0.24
    surface.inputs["Coat Roughness"].default_value = 0.065
    surface.inputs["Emission Color"].default_value = (0.34, 0.012, 0.055, 1.0)
    surface.inputs["Emission Strength"].default_value = 0.05
    volume = nodes.new("ShaderNodeVolumeAbsorption")
    volume.location = (100, -130)
    volume.inputs["Color"].default_value = (1.0, 0.52, 0.68, 1.0)
    volume.inputs["Density"].default_value = 0.065
    links.new(surface.outputs[0], output.inputs["Surface"])
    links.new(volume.outputs[0], output.inputs["Volume"])
    return material


def framework_material() -> bpy.types.Material:
    material = bpy.data.materials.new(FRAMEWORK_MATERIAL)
    material.use_nodes = True
    material["semanticRole"] = "runtime-persistent-gold-framework"
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (0.79, 0.34, 0.055, 1.0)
    shader.inputs["Metallic"].default_value = 0.92
    shader.inputs["Roughness"].default_value = 0.19
    shader.inputs["Coat Weight"].default_value = 0.18
    return material


def ivory_material() -> bpy.types.Material:
    material = bpy.data.materials.new(IVORY_MATERIAL)
    material.use_nodes = True
    material["semanticRole"] = "runtime-persistent-ivory-inlay"
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (0.92, 0.69, 0.57, 1.0)
    shader.inputs["Metallic"].default_value = 0.0
    shader.inputs["Roughness"].default_value = 0.2
    shader.inputs["IOR"].default_value = 1.53
    shader.inputs["Coat Weight"].default_value = 0.28
    shader.inputs["Coat Roughness"].default_value = 0.08
    return material


def corner_provider_material(images: dict[str, bpy.types.Image]) -> bpy.types.Material:
    material = bpy.data.materials.new(CORNER_MATERIAL)
    material.use_nodes = True
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
    surface.inputs["Coat Weight"].default_value = 0.14
    links.new(surface.outputs[0], output.inputs["Surface"])
    return material


def internal_detail_material(source: bpy.types.Material) -> bpy.types.Material:
    material = source.copy()
    material.name = DETAIL_MATERIAL
    material["semanticRole"] = "runtime-subordinate-internal-donor-detail"
    material["sourceUse"] = "exact dense provider exterior with full archived PBR maps"
    material["runtimePolicy"] = "opaque provider-intact exterior and open shard surface detail; never collision"
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
    material = bpy.data.materials.new("Rose hybrid transmission witness")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    checker = nodes.new("ShaderNodeTexChecker")
    coordinates = nodes.new("ShaderNodeTexCoord")
    checker.inputs["Color1"].default_value = (0.015, 0.20, 0.40, 1.0)
    checker.inputs["Color2"].default_value = (0.72, 0.04, 0.18, 1.0)
    checker.inputs["Scale"].default_value = 8.0
    shader.inputs["Roughness"].default_value = 0.40
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
    scene.eevee.taa_render_samples = 128
    scene.render.resolution_x = 1100
    scene.render.resolution_y = 820
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = False
    scene.render.dither_intensity = 0.0
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.world = scene.world or bpy.data.worlds.new("Rose hybrid proof world")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.32, 0.48, 0.82, 1.0)
    background.inputs["Strength"].default_value = 0.48

    bpy.ops.mesh.primitive_plane_add(size=6.0, location=(0.0, 0.0, -0.315))
    board = bpy.context.object
    board.name = "Rose_Hybrid_Proof_Field"
    for current in list(board.users_collection):
        current.objects.unlink(board)
    collection.objects.link(board)
    board.data.materials.append(
        floor_material("Rose pastel-sky beauty field", (0.61, 0.74, 0.96, 1.0), 0.34)
    )
    board.data.materials.append(checker_material())

    camera_data = bpy.data.cameras.new("Rose hybrid proof camera")
    camera_data.lens = 42.0
    camera_data.sensor_width = 36.0
    camera_data.clip_start = 0.01
    camera_data.clip_end = 100.0
    camera = bpy.data.objects.new("Rose_Hybrid_Proof_Camera", camera_data)
    collection.objects.link(camera)
    scene.camera = camera
    target = Vector((0.0, 0.0, -0.10))
    prepare.add_area(collection, "Rose hybrid key", (2.6, -2.8, 3.3), 1250.0, 2.5, (1.0, 0.68, 0.53), target)
    prepare.add_area(collection, "Rose hybrid fill", (-2.8, -0.3, 2.0), 920.0, 3.1, (0.50, 0.69, 1.0), target)
    prepare.add_area(collection, "Rose hybrid rim", (0.0, 3.0, 2.7), 1120.0, 2.3, (0.74, 0.92, 1.0), target)
    return scene, camera, board


def configure_camera(prepare: Any, camera: bpy.types.Object, view: str) -> None:
    target = Vector((0.0, 0.0, -0.105))
    camera.data.type = "PERSP"
    if view == "game-camera":
        camera.location = (2.62, -2.62, 1.34)
        camera.data.lens = 40.4
    elif view == "side":
        camera.location = (2.85, -0.12, 0.34)
        camera.data.lens = 55.0
    elif view == "top":
        camera.location = (0.0, -0.02, 4.15)
        camera.data.type = "ORTHO"
        camera.data.ortho_scale = 2.25
        target = Vector((0.0, 0.0, -0.03))
    else:
        raise ValueError(f"Unknown proof view {view}")
    prepare.point_at(camera, target)


def set_visible(objects: Iterable[bpy.types.Object], visible: bool) -> None:
    for obj in objects:
        obj.hide_render = not visible


def render_atomic(
    prepare: Any,
    scene: bpy.types.Scene,
    path: Path,
    samples: int,
) -> Path:
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


def isolate_render_meshes(
    label: str,
    visible: Iterable[bpy.types.Object],
    inventories: list[dict[str, Any]],
) -> None:
    allowed = {obj.name for obj in visible}
    for obj in bpy.data.objects:
        if obj.type == "MESH":
            obj.hide_render = obj.name not in allowed
    actual = sorted(
        obj.name for obj in bpy.data.objects if obj.type == "MESH" and not obj.hide_render
    )
    require(actual == sorted(allowed), f"Render isolation failed for {label}: {actual}")
    inventories.append({"render": label, "visibleMeshes": actual})


def render_proofs(
    prepare: Any,
    proof_dir: Path,
    source_review: bpy.types.Object,
    candidate_objects: list[bpy.types.Object],
    shell: bpy.types.Object,
    detail: bpy.types.Object,
    framework: bpy.types.Object,
    ivory: bpy.types.Object,
    corners: bpy.types.Object,
    shard_roots: list[bpy.types.Object],
    shard_meshes: list[bpy.types.Object],
    shard_details: list[bpy.types.Object],
) -> tuple[list[Path], list[dict[str, Any]]]:
    proof_dir.mkdir(parents=True, exist_ok=True)
    proof_collection = bpy.data.collections.new("Cloudway_Rose_Runtime_Hybrid_Proof_Stage")
    bpy.context.scene.collection.children.link(proof_collection)
    scene, camera, board = create_proof_stage(prepare, proof_collection)
    outputs: list[Path] = []
    inventories: list[dict[str, Any]] = []
    source_material = source_review.material_slots[0].material
    candidate_materials = {
        shell: shell.material_slots[0].material,
        detail: detail.material_slots[0].material,
        framework: framework.material_slots[0].material,
        ivory: ivory.material_slots[0].material,
        corners: corners.material_slots[0].material,
    }
    beauty_background = scene.world.node_tree.nodes.get("Background")
    beauty_colour = tuple(beauty_background.inputs["Color"].default_value)
    beauty_strength = float(beauty_background.inputs["Strength"].default_value)
    for view in ("game-camera", "top", "side"):
        configure_camera(prepare, camera, view)
        source_review.material_slots[0].link = "OBJECT"
        source_review.material_slots[0].material = source_material
        isolate_render_meshes(f"provider-pbr-{view}", [source_review, board], inventories)
        outputs.append(
            render_atomic(prepare, scene, proof_dir / f"provider-pbr-{view}.png", 384)
        )
        isolate_render_meshes(
            f"hybrid-beauty-{view}", [*candidate_objects, board], inventories
        )
        outputs.append(
            render_atomic(prepare, scene, proof_dir / f"hybrid-beauty-{view}.png", 512)
        )
        if view in ("top", "side"):
            isolate_render_meshes(
                f"hybrid-detail-off-{view}",
                [shell, framework, ivory, corners, board],
                inventories,
            )
            outputs.append(
                render_atomic(
                    prepare, scene, proof_dir / f"hybrid-detail-off-{view}.png", 384
                )
            )

    configure_camera(prepare, camera, "game-camera")
    isolate_render_meshes(
        "hybrid-clay-game-camera", [*candidate_objects, board], inventories
    )
    clay = prepare.clay_material()
    for obj in (shell, detail, framework, ivory, corners):
        obj.material_slots[0].material = clay
    outputs.append(
        render_atomic(prepare, scene, proof_dir / "hybrid-clay-game-camera.png", 160)
    )
    diagnostic = {
        shell: diagnostic_material("Rose semantic glass", (0.05, 0.38, 1.0, 1.0)),
        detail: diagnostic_material(
            "Rose semantic internal detail", (0.12, 0.95, 0.88, 1.0)
        ),
        framework: diagnostic_material(
            "Rose semantic gold framework", (1.0, 0.23, 0.025, 1.0)
        ),
        ivory: diagnostic_material(
            "Rose semantic ivory inlay", (1.0, 0.94, 0.66, 1.0)
        ),
        corners: diagnostic_material(
            "Rose semantic source corner detail", (0.68, 0.18, 0.92, 1.0)
        ),
    }
    for obj, material in diagnostic.items():
        obj.material_slots[0].material = material
    isolate_render_meshes(
        "hybrid-semantic-game-camera", [*candidate_objects, board], inventories
    )
    outputs.append(
        render_atomic(prepare, scene, proof_dir / "hybrid-semantic-game-camera.png", 128)
    )
    for obj, material in candidate_materials.items():
        obj.material_slots[0].material = material

    beauty_floor = board.material_slots[0].material
    board.material_slots[0].material = board.material_slots[1].material
    beauty_background.inputs["Color"].default_value = (0.008, 0.014, 0.026, 1.0)
    beauty_background.inputs["Strength"].default_value = 0.24
    isolate_render_meshes(
        "hybrid-transmission-game-camera", [*candidate_objects, board], inventories
    )
    outputs.append(
        render_atomic(
            prepare, scene, proof_dir / "hybrid-transmission-game-camera.png", 256
        )
    )
    board.material_slots[0].material = beauty_floor
    beauty_background.inputs["Color"].default_value = beauty_colour
    beauty_background.inputs["Strength"].default_value = beauty_strength

    offsets = []
    for index, shard_root in enumerate(shard_roots):
        assembled = shard_root.location.copy()
        direction = Vector((assembled.x, assembled.y, 0.44 + 0.04 * (index % 3)))
        if direction.length_squared > 0.0:
            direction.normalize()
        shard_root.location = assembled + direction * (0.26 + 0.025 * (index % 4))
        shard_root.rotation_euler = (
            0.06 * ((index % 3) - 1),
            0.05 * (((index * 2) % 3) - 1),
            0.04 * ((index % 5) - 2),
        )
        offsets.append(assembled)
    isolate_render_meshes(
        "hybrid-shards-exploded-game-camera",
        [framework, ivory, corners, *shard_meshes, *shard_details, board],
        inventories,
    )
    outputs.append(
        render_atomic(
            prepare,
            scene,
            proof_dir / "hybrid-shards-exploded-game-camera.png",
            384,
        )
    )
    for shard_root, assembled in zip(shard_roots, offsets):
        shard_root.location = assembled
        shard_root.rotation_euler = (0.0, 0.0, 0.0)
    isolate_render_meshes("saved-candidate-state", candidate_objects, inventories)
    return outputs, inventories
