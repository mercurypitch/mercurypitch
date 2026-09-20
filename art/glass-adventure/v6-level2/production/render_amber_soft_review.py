"""Render soft-light Amber material checks without modifying the packed source."""

from __future__ import annotations

from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parent.parent
HEIGHT = 0.72


def point_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def matte(name: str, color: tuple[float, float, float]) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1.0)
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Roughness"].default_value = 0.72
    return material


def main() -> None:
    blend = ROOT / "sources/amber-cadence-urn-fracture-v2.blend"
    bpy.ops.wm.open_mainfile(filepath=str(blend))
    intact = bpy.data.objects["breakable_l2_low_amber_urn_intact"]
    intact.hide_render = False
    for obj in bpy.data.objects:
        if obj.get("role") == "shard" or obj.get("collision_proxy"):
            obj.hide_render = True

    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -1.1
    world = scene.world or bpy.data.worlds.new("amber_soft_world")
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.018, 0.025, 0.038, 1.0)
    background.inputs["Strength"].default_value = 0.20

    bpy.ops.mesh.primitive_plane_add(size=HEIGHT * 20, location=(0.0, 0.0, -0.004))
    floor = bpy.context.object
    floor.data.materials.append(matte("amber_soft_floor", (0.045, 0.060, 0.072)))
    target = Vector((0.0, 0.0, HEIGHT * 0.48))
    for name, location, energy, size, color in (
        ("soft_key", (HEIGHT * 1.6, -HEIGHT * 2.0, HEIGHT * 2.1), 430.0, HEIGHT * 2.7, (1.0, 0.82, 0.70)),
        ("soft_fill", (-HEIGHT * 1.8, -HEIGHT * 0.5, HEIGHT * 1.25), 260.0, HEIGHT * 3.1, (0.65, 0.82, 1.0)),
        ("soft_rim", (HEIGHT * 0.4, HEIGHT * 1.9, HEIGHT * 1.7), 300.0, HEIGHT * 2.5, (0.72, 1.0, 0.90)),
    ):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.shape = "DISK"
        data.size = size
        data.color = color
        light = bpy.data.objects.new(name, data)
        scene.collection.objects.link(light)
        light.location = location
        point_at(light, target)

    camera_data = bpy.data.cameras.new("amber_soft_camera")
    camera_data.lens = 62
    camera = bpy.data.objects.new("amber_soft_camera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = (HEIGHT * 1.25, -HEIGHT * 2.25, HEIGHT * 1.12)
    point_at(camera, target)
    scene.camera = camera

    output = ROOT / "proofs/amber-cadence-urn-soft-v2.png"
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)

    material = bpy.data.materials["amber_shell"]
    shader = material.node_tree.nodes.get("Principled BSDF")
    normal_node = shader.inputs["Normal"].links[0].from_node
    normal_node.inputs["Strength"].default_value = 0.0
    scene.render.filepath = "/tmp/amber-cadence-urn-soft-no-normal-v2.png"
    bpy.ops.render.render(write_still=True)
    print(f"AMBER_SOFT_REVIEW={output}", flush=True)


if __name__ == "__main__":
    main()
