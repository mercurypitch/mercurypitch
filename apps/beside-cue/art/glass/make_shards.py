"""Fracture the bowl into shards, and write the loader's contract.

Run headless (after make_glass.py):
    blender --background --python make_shards.py

Reads  glass.blend
Writes shards.blend, shards-preview.glb

The contract the runtime depends on, restated here because this script
is what enforces it:

  * one node per shard, named shard_000 .. shard_NNN
  * each shard's ORIGIN sits at its centroid, and the exporter writes
    that origin as the node's translation. `solveShatter` reads those
    translations as its centroids -- so no bespoke exporter, and no
    sidecar file, is needed.
  * the foot is NOT fractured. It stays behind on the plinth, which is
    why make_glass.py emits it as its own object.

Only the bowl fractures: the mesh is bisected at the bowl base and the
lower half discarded before the fracture runs.
"""

import os
import random

import bpy
import mathutils
import mathutils.noise

HERE = os.path.dirname(os.path.abspath(__file__))
BOWL_BASE_Z = 0.096   # matches make_glass.py's OUTER profile
# Over-generate: cells that land in the bowl's hollow interior intersect
# nothing and come back empty, so most of every batch is discarded
# below. Filtering is not a workaround -- an empty node still costs a
# draw and would read as a shard that never appears.
#
# The yield does not improve by asking for more. Measured on this
# profile: 260 points -> 108 solid shards, 340 -> 105. Past a point the
# cells get thinner than the 1.5 mm wall and simply miss it, so ~108 is
# this glass's ceiling, not a number that was tuned down. A denser
# break needs a thicker wall, not a bigger source_limit.
SHARD_SOURCE = 260
SHARD_TARGET = 150     # a cap, not a goal; see above
MIN_FACES = 4          # below a tetrahedron there is no solid
MIN_DIMENSION = 0.0008  # 0.8 mm: smaller than this is invisible dust
SEED = 7


def isolate(obj):
    for o in bpy.data.objects:
        o.select_set(o is obj)
    bpy.context.view_layer.objects.active = obj


def main():
    bpy.ops.wm.open_mainfile(filepath=os.path.join(HERE, "glass.blend"))

    glass = bpy.data.objects["glass_intact"]
    foot = bpy.data.objects["glass_foot"]

    # Keep the bowl only. Cell Fracture needs a closed-ish volume, and the
    # stem would otherwise produce slivers nobody sees.
    isolate(glass)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.bisect(
        plane_co=(0, 0, BOWL_BASE_Z),
        plane_no=(0, 0, 1),
        clear_inner=True,
        use_fill=True,
    )
    bpy.ops.object.mode_set(mode="OBJECT")

    # Cell Fracture jitters its source points from TWO generators and seeds
    # neither: `random` (shuffle, magnitude) and mathutils.noise's
    # random_unit_vector (direction). Seeding only Python's leaves the run
    # non-reproducible -- measured 108, 99, 109, 112 shards from identical
    # inputs -- and "shard_007" would stop meaning one particular piece.
    random.seed(SEED)
    mathutils.noise.seed_set(SEED)

    isolate(glass)
    bpy.ops.object.add_fracture_cell_objects(
        source={"VERT_OWN"},
        source_limit=SHARD_SOURCE,
        source_noise=0.15,
        cell_scale=(1.0, 1.0, 1.0),
        recursion=0,
        use_smooth_faces=False,
        use_sharp_edges=True,
        use_sharp_edges_apply=False,
        use_data_match=True,
        use_island_split=True,
        margin=0.00005,
        material_index=0,
        use_interior_vgroup=False,
        use_recenter=True,
        collection_name="shards",
        use_remove_original=False,
    )

    raw = [o for o in bpy.data.objects
           if o.type == "MESH" and o not in (glass, foot)]

    shards, dropped = [], []
    for o in raw:
        if len(o.data.polygons) < MIN_FACES or max(o.dimensions) < MIN_DIMENSION:
            dropped.append(o)
        else:
            shards.append(o)
    for o in dropped:
        bpy.data.objects.remove(o, do_unlink=True)

    # Largest first, then keep only the budget. Big pieces carry the read
    # of the break; the tail is dust that costs draws and shows nothing.
    shards.sort(key=lambda o: -sum(o.dimensions))
    for o in shards[SHARD_TARGET:]:
        bpy.data.objects.remove(o, do_unlink=True)
    shards = shards[:SHARD_TARGET]
    # Deterministic order, so shard_007 is the same piece on every run.
    shards.sort(key=lambda o: (round(o.location.z, 5),
                               round(o.location.x, 5),
                               round(o.location.y, 5)))

    # Centre each origin on the shard's volume -- that origin is what the
    # exporter writes as the node translation, and what solveShatter reads
    # as the centroid.
    #
    # Blender's centre-of-volume is only meaningful on a closed, correctly
    # wound mesh, and the boolean regularly emits pieces that are neither
    # (about a fifth of them here). It does not fail; it returns a point
    # off in space -- one landed 0.37 m out, on a bowl 0.046 m wide -- and
    # that shard would fly in from nowhere. The geometry still renders
    # fine, so those fall back to the bounding-box centre, which is inside
    # the shard by construction. Dropping them instead would throw away a
    # fifth of the break to avoid a one-line fix.
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
        o.name = "shard_%03d" % i
        o.data.name = o.name

    glass.hide_render = True   # kept in the file as the unbroken reference

    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "shards.blend"))

    for o in bpy.data.objects:
        o.select_set(o.type == "MESH" and o.name.startswith("shard_"))
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(HERE, "shards-preview.glb"),
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_tangents=False,
        use_selection=True,
    )
    faces = sum(len(o.data.polygons) for o in shards)
    print("SHARD_STATS=", {
        "count": len(shards),
        "faces": faces,
        "generated": len(raw),
        "dropped_empty": len(dropped),
        "origin_fallbacks": fallbacks,
    })


main()
