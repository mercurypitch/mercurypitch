"""The wine glass, as a script.

Run headless:  blender --background --python make_glass.py
Produces, next to this file:
  glass.blend        the saved scene (glass_intact + glass_foot)
  glass-preview.glb  a quick export for eyeballing, NOT the shipped asset
The shipped asset comes from the T8 export pass (gltf-transform), and the
shards from Cell Fracture in T7 — both start from glass.blend.

The profile is the single source of truth. Radii/heights in metres,
(r, z) pairs, outer surface first, then the inner wall of the bowl.
"""

import os

import bmesh
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
SEGMENTS = 64  # spin steps; mobile budget over silhouette perfection

# Outer contour, foot -> stem -> tulip bowl -> rim.
OUTER = [
    (0.0000, 0.0000),
    (0.0350, 0.0000),   # foot edge
    (0.0340, 0.0030),   # foot top
    (0.0080, 0.0140),   # sweep into stem
    (0.0042, 0.0300),   # stem bottom
    (0.0040, 0.0900),   # stem top
    (0.0075, 0.0960),   # bowl base
    (0.0350, 0.1250),   # bowl swell
    (0.0460, 0.1700),   # widest point
    (0.0400, 0.2050),   # tulip turn-in
    (0.0360, 0.2200),   # rim, outside
]
WALL = 0.0015  # bowl wall thickness at the rim
# Inner wall, rim back down to the bowl floor.
INNER = [
    (0.0345, 0.2200),
    (0.0385, 0.2050),
    (0.0445, 0.1700),
    (0.0335, 0.1250),
    (0.0070, 0.1000),
    (0.0000, 0.0985),   # bowl floor, on the axis
]


def spin_profile(name, points):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    verts = [bm.verts.new(Vector((r, 0.0, z))) for r, z in points]
    for a, b in zip(verts, verts[1:]):
        bm.edges.new((a, b))
    bmesh.ops.spin(
        bm,
        geom=bm.verts[:] + bm.edges[:],
        cent=(0, 0, 0),
        axis=(0, 0, 1),
        angle=6.283185307179586,
        steps=SEGMENTS,
        use_merge=True,
        use_duplicate=False,
    )
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)

    profile = OUTER + INNER
    glass = spin_profile("glass_intact", profile)

    # The foot as its own node: solveShatter treats it as the part that
    # stays put, so the exporter contract wants it separable. Duplicate
    # of the foot+stem region rather than a split — the intact glass
    # must stay watertight for Cell Fracture.
    foot_profile = [p for p in OUTER if p[1] <= 0.0960]
    foot = spin_profile("glass_foot", foot_profile)
    foot.hide_render = True

    for obj in (glass, foot):
        bpy.context.view_layer.objects.active = obj
        for o in bpy.data.objects:
            o.select_set(o is obj)
        bpy.ops.object.shade_smooth()

    mat = bpy.data.materials.new("glass_clear")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Transmission Weight"].default_value = 1.0
    bsdf.inputs["Roughness"].default_value = 0.04
    bsdf.inputs["IOR"].default_value = 1.5
    glass.data.materials.append(mat)
    foot.data.materials.append(mat)

    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "glass.blend"))

    for o in bpy.data.objects:
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(HERE, "glass-preview.glb"),
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_tangents=False,
    )
    stats = {o.name: len(o.data.polygons) for o in bpy.data.objects if o.type == "MESH"}
    print("GLASS_STATS=", stats)


main()
