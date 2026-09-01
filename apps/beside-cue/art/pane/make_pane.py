"""The hallway pane, fractured, and the loader's contract for it.

Run headless:
    blender --background --python make_pane.py

Writes, next to this file:
    pane.blend               the working scene
    pane-shards-preview.glb  one node per shard, ready for the optimize pass

There is deliberately NO intact-pane export. The unbroken pane is a
0.72 x 1.05 x 0.006 m box, and three lines of BoxGeometry at runtime
beat an asset that has to be loaded, versioned and kept in sync. Only
the break needs authoring.

The contract is the same one the glass shards ship under
(art/glass/make_shards.py): nodes named pane_000.., each origin at the
shard's centroid, exporter writes origins as node translations,
solveShatter reads translations as centroids.

The fracture source is different, and has to be. Cell Fracture seeds
its cells from the mesh's own vertices, and a box has eight -- eight
cells is a pane snapped in half, not a shatter. So the faces are
gridded first (subdivide), then jittered (source_noise=0.45): a regular
grid reads as tiles, and real pane breakage is radial chaos. The jitter
is moderate for the same reason the glass over-generates -- a point
thrown too far off a 6 mm sheet spawns a cell that misses it entirely,
and at noise 1.0 two-thirds of the requested cells came back empty.
"""

import os
import random

import bpy
import mathutils
import mathutils.noise

HERE = os.path.dirname(os.path.abspath(__file__))

# Blender axes here; the Y-up export maps them to the scene as
# width across the hallway (z), height up (y), thickness along travel (x).
WIDTH = 0.72      # Blender y
HEIGHT = 1.05     # Blender z, base at 0
THICK = 0.006     # Blender x

SUBDIV_CUTS = 15  # (cuts+1)^2 verts per face -> plenty of cells
SHARD_SOURCE = 200
SHARD_TARGET = 90
MIN_FACES = 4
MIN_DIMENSION = 0.0008
SEED = 11


def isolate(obj):
    for o in bpy.data.objects:
        o.select_set(o is obj)
    bpy.context.view_layer.objects.active = obj


def main():
    # read_homefile, NOT read_factory_settings: factory settings reset the
    # user preferences too, and Cell Fracture is an extension that lives
    # there -- with factory prefs the operator simply does not exist.
    bpy.ops.wm.read_homefile(use_empty=True)

    bpy.ops.mesh.primitive_cube_add(size=1)
    pane = bpy.context.active_object
    pane.name = "source_pane"  # NOT pane_*: the export filter below selects that prefix
    pane.scale = (THICK / 2, WIDTH / 2, HEIGHT / 2)
    pane.location = (0, 0, HEIGHT / 2)
    bpy.ops.object.transform_apply(location=True, scale=True)

    isolate(pane)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.subdivide(number_cuts=SUBDIV_CUTS)
    bpy.ops.object.mode_set(mode="OBJECT")

    # Same two unseeded generators as the glass fracture; same fix.
    random.seed(SEED)
    mathutils.noise.seed_set(SEED)

    isolate(pane)
    bpy.ops.object.add_fracture_cell_objects(
        source={"VERT_OWN"},
        source_limit=SHARD_SOURCE,
        source_noise=0.45,
        cell_scale=(1.0, 1.0, 1.0),
        recursion=0,
        use_smooth_faces=False,
        use_sharp_edges=True,
        use_sharp_edges_apply=False,
        use_data_match=True,
        # The addon's own island split iterates view_layer.objects right
        # after it has removed empty cells, and under an --empty homefile
        # that collection briefly contains a stale None -- the split
        # crashes before it starts. Done manually below instead, which is
        # the same two operator calls with a context that is not lying.
        use_island_split=False,
        margin=0.00005,
        material_index=0,
        use_interior_vgroup=False,
        use_recenter=True,
        collection_name="pane_shards",
        use_remove_original=False,
    )

    cells = [o for o in bpy.data.objects if o.type == "MESH" and o is not pane]
    for o in bpy.data.objects:
        o.select_set(o in cells)
    if cells:
        bpy.context.view_layer.objects.active = cells[0]
        bpy.ops.mesh.separate(type="LOOSE")

    raw = [o for o in bpy.data.objects if o.type == "MESH" and o is not pane]

    shards, dropped = [], []
    for o in raw:
        if len(o.data.polygons) < MIN_FACES or max(o.dimensions) < MIN_DIMENSION:
            dropped.append(o)
        else:
            shards.append(o)
    for o in dropped:
        bpy.data.objects.remove(o, do_unlink=True)

    shards.sort(key=lambda o: -sum(o.dimensions))
    for o in shards[SHARD_TARGET:]:
        bpy.data.objects.remove(o, do_unlink=True)
    shards = shards[:SHARD_TARGET]
    shards.sort(key=lambda o: (round(o.location.z, 5),
                               round(o.location.x, 5),
                               round(o.location.y, 5)))

    # Origin = centroid, with the same bounding-box fallback the glass
    # needed: the boolean emits non-manifold pieces whose centre-of-volume
    # is garbage, and they render fine, so they are repaired, not dropped.
    fallbacks = 0
    for o in shards:
        isolate(o)
        bpy.ops.object.origin_set(type="ORIGIN_CENTER_OF_VOLUME")
        corners = [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]
        lo = [min(c[i] for c in corners) for i in range(3)]
        hi = [max(c[i] for c in corners) for i in range(3)]
        p = o.matrix_world.translation
        if not all(lo[i] - 1e-6 <= p[i] <= hi[i] + 1e-6 for i in range(3)):
            bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
            fallbacks += 1

    for i, o in enumerate(shards):
        o.name = "pane_%03d" % i
        o.data.name = o.name

    pane.hide_render = True

    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "pane.blend"))

    for o in bpy.data.objects:
        o.select_set(o.type == "MESH" and o.name.startswith("pane_"))
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(HERE, "pane-shards-preview.glb"),
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_tangents=False,
        use_selection=True,
    )
    print("PANE_STATS=", {
        "count": len(shards),
        "faces": sum(len(o.data.polygons) for o in shards),
        "generated": len(raw),
        "dropped_empty": len(dropped),
        "origin_fallbacks": fallbacks,
    })


main()
