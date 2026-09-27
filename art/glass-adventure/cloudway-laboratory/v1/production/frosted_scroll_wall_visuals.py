#!/usr/bin/env python3
"""Render matched semantic proofs for the Frosted Scroll Wall derivative."""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from pathlib import Path
from typing import Any

import bpy
from mathutils import Vector
from PIL import Image, ImageDraw, ImageFilter, ImageOps


RESOLUTION = (960, 960)
VIEWS = ("front", "back", "side")
PANE_WIDTH = 1.72
PANE_HEIGHT = 2.69


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def principled(material: bpy.types.Material) -> bpy.types.Node:
    require(
        material.use_nodes and material.node_tree is not None,
        f"Material {material.name} has no node tree",
    )
    matches = [
        node
        for node in material.node_tree.nodes
        if node.bl_idname == "ShaderNodeBsdfPrincipled"
    ]
    require(len(matches) == 1, f"Material {material.name} needs one Principled BSDF")
    return matches[0]


def set_input(shader: bpy.types.Node, name: str, value: Any) -> None:
    socket = shader.inputs.get(name)
    require(socket is not None, f"Installed Principled shader has no {name!r} input")
    socket.default_value = value


def frame_material(source: bpy.types.Material) -> bpy.types.Material:
    material = source.copy()
    material.name = "FrostWallFrame__provider_pbr"
    material["role"] = "persistent-opaque-frame"
    material["sourcePbrPreserved"] = True
    material.surface_render_method = "DITHERED"
    return material


def intact_detail_material(source: bpy.types.Material) -> bpy.types.Material:
    material = source.copy()
    material.name = "FrostWallIntactDetail__provider_pbr"
    material["role"] = "removable-provider-pane-detail"
    material["sourcePbrPreserved"] = True
    shader = principled(material)
    set_input(shader, "Alpha", 0.48)
    set_input(shader, "Transmission Weight", 0.22)
    material.diffuse_color = (*material.diffuse_color[:3], 0.48)
    material.surface_render_method = "DITHERED"
    return material


def inner_trim_material() -> bpy.types.Material:
    material = bpy.data.materials.new("FrostWallInnerTrim__authored_pbr")
    material.use_nodes = True
    shader = principled(material)
    set_input(shader, "Base Color", (0.72, 0.39, 0.075, 1.0))
    set_input(shader, "Metallic", 0.82)
    set_input(shader, "Roughness", 0.2)
    set_input(shader, "Coat Weight", 0.42)
    material.diffuse_color = (0.72, 0.39, 0.075, 1.0)
    material.use_backface_culling = False
    material["role"] = "authored-persistent-inner-trim"
    return material


def frame_backing_material() -> bpy.types.Material:
    material = bpy.data.materials.new("FrostWallFrameBacking__authored_pbr")
    material.use_nodes = True
    shader = principled(material)
    set_input(shader, "Base Color", (1.0, 0.95, 0.84, 1.0))
    set_input(shader, "Metallic", 0.06)
    set_input(shader, "Roughness", 0.24)
    set_input(shader, "Coat Weight", 0.4)
    material.diffuse_color = (1.0, 0.95, 0.84, 1.0)
    material.use_backface_culling = False
    material["role"] = "authored-persistent-frame-seam-backing"
    return material


def glass_material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    roughness: float,
    transmission: float,
    alpha: float,
    base_color_image: bpy.types.Image | None = None,
    metallic_image: bpy.types.Image | None = None,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    shader = principled(material)
    set_input(shader, "Base Color", color)
    set_input(shader, "Metallic", 0.0)
    set_input(shader, "Roughness", roughness)
    set_input(shader, "Transmission Weight", transmission)
    set_input(shader, "IOR", 1.45)
    set_input(shader, "Alpha", alpha)
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    if base_color_image is not None:
        texture = nodes.new("ShaderNodeTexImage")
        texture.name = "Shared pane-space frost and scroll color"
        texture.image = base_color_image
        texture.interpolation = "Linear"
        links.new(texture.outputs["Color"], shader.inputs["Base Color"])
    if metallic_image is not None:
        texture = nodes.new("ShaderNodeTexImage")
        texture.name = "Shared pane-space gold mask"
        texture.image = metallic_image
        texture.interpolation = "Linear"
        links.new(texture.outputs["Color"], shader.inputs["Metallic"])
    material.diffuse_color = (*color[:3], alpha)
    material.surface_render_method = "DITHERED"
    material["role"] = "authored-frosted-glass"
    material["closedVolumeRequired"] = True
    return material


def author_surface_textures(
    base_color_path: Path,
    metallic_path: Path,
    etching_paths: Sequence[tuple[Sequence[tuple[float, float, float]], bool]],
    *,
    size: int = 4096,
) -> None:
    """Author deterministic full-resolution frost and musical-scroll maps."""
    require(size >= 2048, "Frost wall surface master must be at least 2K")
    base_color_path.parent.mkdir(parents=True, exist_ok=True)
    noise = Image.effect_noise((512, 512), 18.0).filter(ImageFilter.GaussianBlur(2.0))
    frost = ImageOps.colorize(noise, black=(166, 218, 230), white=(201, 242, 248))
    frost = frost.resize((size, size), Image.Resampling.BICUBIC)
    frost = Image.blend(Image.new("RGB", (size, size), (181, 231, 241)), frost, 0.34)

    def to_pixel(point: tuple[float, float, float]) -> tuple[int, int]:
        x, _depth, z = point
        return (
            round((x / PANE_WIDTH + 0.5) * (size - 1)),
            round((1.0 - z / PANE_HEIGHT) * (size - 1)),
        )

    line_mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(line_mask)
    line_width = max(8, round(0.009 / PANE_WIDTH * size))
    for path, cyclic in etching_paths:
        pixels = [to_pixel(point) for point in path]
        if cyclic:
            pixels.append(pixels[0])
        draw.line(pixels, fill=255, width=line_width, joint="curve")
    glow = line_mask.filter(ImageFilter.GaussianBlur(max(2.0, line_width * 0.8)))
    glow = glow.point(lambda value: round(value * 0.32))
    frost = Image.composite(
        Image.new("RGB", (size, size), (215, 153, 74)),
        frost,
        glow,
    )
    frost = Image.composite(
        Image.new("RGB", (size, size), (203, 121, 29)),
        frost,
        line_mask,
    )
    metallic_mask = line_mask.point(lambda value: round(value * 0.63))
    metallic = Image.merge("RGB", (metallic_mask, metallic_mask, metallic_mask))
    frost.save(base_color_path, format="PNG", optimize=True)
    metallic.save(metallic_path, format="PNG", optimize=True)


def load_packed_image(path: Path, name: str, *, non_color: bool = False) -> bpy.types.Image:
    image = bpy.data.images.load(str(path), check_existing=False)
    image.name = name
    image.colorspace_settings.name = "Non-Color" if non_color else "sRGB"
    image.pack()
    return image


def semantic_material(
    name: str, color: tuple[float, float, float, float]
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    shader = principled(material)
    set_input(shader, "Base Color", color)
    set_input(shader, "Metallic", 0.0)
    set_input(shader, "Roughness", 0.48)
    return material


def collection(name: str) -> bpy.types.Collection:
    result = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(result)
    return result


def link_only(obj: bpy.types.Object, target: bpy.types.Collection) -> None:
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    target.objects.link(obj)


def point_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_area(
    target: bpy.types.Collection,
    name: str,
    location: tuple[float, float, float],
    energy: float,
    size: float,
    color: tuple[float, float, float],
    aim: Vector,
) -> None:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    light = bpy.data.objects.new(name, data)
    target.objects.link(light)
    light.location = location
    point_at(light, aim)


def checker_material() -> bpy.types.Material:
    material = bpy.data.materials.new("Frost wall transmission witness")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    shader = principled(material)
    checker = nodes.new("ShaderNodeTexChecker")
    checker.inputs["Color1"].default_value = (0.003, 0.01, 0.018, 1.0)
    checker.inputs["Color2"].default_value = (0.018, 0.004, 0.016, 1.0)
    checker.inputs["Scale"].default_value = 7.0
    mapping = nodes.new("ShaderNodeMapping")
    coordinates = nodes.new("ShaderNodeTexCoord")
    links.new(coordinates.outputs["Generated"], mapping.inputs["Vector"])
    links.new(mapping.outputs["Vector"], checker.inputs["Vector"])
    links.new(checker.outputs["Color"], shader.inputs["Base Color"])
    set_input(shader, "Metallic", 0.0)
    set_input(shader, "Roughness", 0.72)
    return material


def setup_scene(frame_base_z: float) -> tuple[bpy.types.Scene, bpy.types.Object, bpy.types.Object]:
    stage = collection("FrostWall_ProofStage")
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = RESOLUTION[0]
    scene.render.resolution_y = RESOLUTION[1]
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = False
    scene.render.dither_intensity = 0.0
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.world = scene.world or bpy.data.worlds.new("Frost wall proof world")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.012, 0.025, 0.05, 1.0)
    background.inputs["Strength"].default_value = 0.42

    floor_material = semantic_material(
        "Frost wall proof floor", (0.025, 0.065, 0.09, 1.0)
    )
    bpy.ops.mesh.primitive_plane_add(size=12.0, location=(0.0, 0.0, frame_base_z))
    floor = bpy.context.object
    floor.name = "FrostWall_ProofFloor"
    link_only(floor, stage)
    floor.data.materials.append(floor_material)

    bpy.ops.mesh.primitive_plane_add(size=5.6, location=(0.0, 0.8, 1.12))
    witness = bpy.context.object
    witness.name = "FrostWall_TransmissionWitness"
    link_only(witness, stage)
    witness.rotation_euler.x = 1.5707963267948966
    witness.data.materials.append(checker_material())

    camera_data = bpy.data.cameras.new("Frost wall proof camera")
    camera_data.lens = 62
    camera_data.sensor_width = 36
    camera_data.clip_start = 0.01
    camera_data.clip_end = 100.0
    camera = bpy.data.objects.new("FrostWall_ProofCamera", camera_data)
    stage.objects.link(camera)
    scene.camera = camera
    aim = Vector((0.0, 0.0, 1.50))
    add_area(stage, "Frost wall key", (3.7, -4.2, 5.4), 1150.0, 4.0, (1.0, 0.79, 0.6), aim)
    add_area(stage, "Frost wall fill", (-4.0, -1.0, 3.2), 800.0, 4.4, (0.48, 0.72, 1.0), aim)
    add_area(stage, "Frost wall rim", (0.5, 3.8, 4.2), 1050.0, 3.4, (0.58, 1.0, 0.91), aim)
    return scene, camera, witness


def configure_view(camera: bpy.types.Object, witness: bpy.types.Object, view: str) -> None:
    target = Vector((0.0, 0.0, 1.48))
    camera.data.type = "PERSP"
    camera.data.lens = 62
    if view == "front":
        camera.location = (0.0, -6.2, 1.50)
        witness.location.y = 0.80
        witness.hide_render = False
    elif view == "back":
        camera.location = (0.0, 6.2, 1.50)
        witness.location.y = -0.80
        witness.hide_render = False
    elif view == "side":
        camera.data.type = "ORTHO"
        camera.data.ortho_scale = 3.55
        camera.location = (6.2, 0.0, 1.50)
        witness.hide_render = True
    else:
        raise ValueError(f"Unknown Frost wall proof view {view}")
    point_at(camera, target)


def set_visible(objects: Iterable[bpy.types.Object], visible: bool) -> None:
    for obj in objects:
        obj.hide_render = not visible
        obj.hide_viewport = not visible


def render_atomic(scene: bpy.types.Scene, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(f".{target.stem}.tmp{target.suffix}")
    temporary.unlink(missing_ok=True)
    scene.render.filepath = str(temporary)
    bpy.ops.render.render(write_still=True)
    require(temporary.is_file(), f"Blender did not render {temporary}")
    temporary.replace(target)


def file_record(path: Path) -> dict[str, Any]:
    import hashlib

    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    return {
        "file": path.as_posix(),
        "bytes": path.stat().st_size,
        "sha256": digest,
        "dimensions": list(RESOLUTION),
    }


def render_semantic_proofs(
    scene: bpy.types.Scene,
    camera: bpy.types.Object,
    witness: bpy.types.Object,
    proof_dir: Path,
    *,
    frame: Sequence[bpy.types.Object],
    intact: Sequence[bpy.types.Object],
    shards: Sequence[bpy.types.Object],
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for state in ("intact", "shards", "open"):
        set_visible(frame, True)
        set_visible(intact, state == "intact")
        set_visible(shards, state == "shards")
        for view in VIEWS:
            configure_view(camera, witness, view)
            target = proof_dir / f"{state}-{view}.png"
            render_atomic(scene, target)
            records.append({"state": state, "view": view, **file_record(target)})
    return records
