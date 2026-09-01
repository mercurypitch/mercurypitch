"""Merc, from a raw Meshy generation to a scene-ready animated asset.

Run headless:
    blender --background --python make_merc.py -- <source.glb>

Default source is the Meshy 7 High Detail generation kept in dotfiles
(it is 33 MB and does not belong in the repo); pass a path to override.

Writes, next to this file:
    merc.blend         the working scene
    merc-preview.glb   parts + animations, ready for the optimize pass

What this script is for
-----------------------
The Meshy output is a single 33 MB mesh at print resolution with 4K PBR
maps. Three things have to happen before it can be in a frame budget:

1. **Split into parts.** glTF import splits vertices at UV seams, so a
   loose-parts separation on the raw mesh explodes it into ~115
   fragments. Welding first collapses it back to the three shells the
   silhouette actually has: body and two hands.

2. **Decimate to budget.** §6.3 gives the scene 50,000 triangles in
   total, and Merc is one prop in a room that also holds a glass, 150
   shards and the walls.

3. **Resize the textures.** 4K maps are the bulk of the 33 MB. They are
   resized in Blender rather than with gltf-transform's texture
   commands, which need sharp -- whose native build fails on this
   machine.

Then the animation set. Merc has no skeleton and does not need one: his
hands are separate objects, so `sing`, `listen`, `celebrate` and `fall`
are keyframed transforms on three nodes. glTF stores those as node
animations, three.js plays them through AnimationMixer, and the whole
set costs almost nothing.
"""

import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_SRC = (
    "/home/maff/.dotfiles/personal/besidecue/assets/main_higgsfield_ref/"
    "meshy/Meshy_AI_Iridescent_Tear_Spiri_0831231604_generate.glb"
)
TARGET_TRIS = 12000     # Merc's share of the 50k scene budget
TEXTURE_SIZE = 1024     # §6.3: one 1024 map is the scene's texture budget
FPS = 30


def isolate(obj):
    for o in bpy.data.objects:
        o.select_set(o is obj)
    bpy.context.view_layer.objects.active = obj


def split_parts():
    """Weld, separate, and name the three shells. Returns (body, l, r)."""
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    src = meshes[0]
    isolate(src)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    # Without this the UV-seam duplicates read as separate islands.
    bpy.ops.mesh.remove_doubles(threshold=1e-5)
    bpy.ops.mesh.separate(type="LOOSE")
    bpy.ops.object.mode_set(mode="OBJECT")

    parts = [o for o in bpy.data.objects if o.type == "MESH"]
    parts.sort(key=lambda o: -len(o.data.polygons))
    body = parts[0]
    # Hands by x: the model faces -y, so -x is his left.
    hands = sorted(parts[1:3], key=lambda o: o.location.x)
    for o in parts[3:]:
        bpy.data.objects.remove(o, do_unlink=True)

    body.name, hands[0].name, hands[1].name = (
        "merc_body", "merc_hand_l", "merc_hand_r",
    )
    for o in (body, *hands):
        o.data.name = o.name
        isolate(o)
        bpy.ops.object.origin_set(type="ORIGIN_CENTER_OF_VOLUME")
    return body, hands[0], hands[1]


def decimate(objs):
    total = sum(len(o.data.polygons) for o in objs)
    if total <= TARGET_TRIS:
        return total
    ratio = TARGET_TRIS / total
    for o in objs:
        isolate(o)
        mod = o.modifiers.new("decimate", "DECIMATE")
        mod.ratio = ratio
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return sum(len(o.data.polygons) for o in objs)


def shrink_textures():
    for img in bpy.data.images:
        if img.size[0] > TEXTURE_SIZE or img.size[1] > TEXTURE_SIZE:
            img.scale(TEXTURE_SIZE, TEXTURE_SIZE)


def key(obj, frame, loc=None, rot=None, scale=None):
    if loc is not None:
        obj.location = loc
        obj.keyframe_insert("location", frame=frame)
    if rot is not None:
        obj.rotation_euler = rot
        obj.keyframe_insert("rotation_euler", frame=frame)
    if scale is not None:
        obj.scale = scale
        obj.keyframe_insert("scale", frame=frame)


def stash(name, objs):
    """Push the current keys of `objs` into an NLA track named `name`.

    Every object gets a track under the same name, and the exporter's
    NLA_TRACKS mode collapses same-named tracks into one glTF animation.
    That is how four clips, each moving three nodes, come out of one file.
    """
    for o in objs:
        ad = o.animation_data
        if ad is None or ad.action is None:
            continue
        track = ad.nla_tracks.new()
        track.name = name
        track.strips.new(name, 1, ad.action)
        ad.action = None


def reset_pose(objs):
    """Return to rest so the next clip is authored from a clean pose.

    Deliberately NOT animation_data_clear(): that removes the NLA tracks
    too, so every clip stashed above would be destroyed the moment the
    next one began -- the file exports three tidy nodes and no animations
    at all, with nothing failing along the way.
    """
    for o in objs:
        o.location = tuple(o["rest_loc"])
        o.rotation_euler = (0, 0, 0)
        o.scale = (1, 1, 1)


def build_animations(body, hl, hr):
    objs = [body, hl, hr]
    for o in objs:
        o["rest_loc"] = tuple(o.location)
    rest = {o.name: tuple(o.location) for o in objs}
    h = max(body.dimensions.z, 0.001)

    def rl(o):
        return rest[o.name]

    def offset(o, dx=0.0, dy=0.0, dz=0.0):
        b = rl(o)
        return (b[0] + dx * h, b[1] + dy * h, b[2] + dz * h)

    # sing: he stretches upward and the hands lift, a held note made visible.
    for o in objs:
        key(o, 1, loc=rl(o), scale=(1, 1, 1))
    key(body, 15, loc=offset(body, dz=0.06), scale=(0.94, 0.94, 1.12))
    key(hl, 15, loc=offset(hl, dx=-0.10, dz=0.22))
    key(hr, 15, loc=offset(hr, dx=0.10, dz=0.22))
    for o in objs:
        key(o, 30, loc=rl(o), scale=(1, 1, 1))
    stash("sing", objs)
    reset_pose(objs)

    # listen: a small lean, hands drawn in. Idle, and deliberately still --
    # the room is supposed to be quiet until the player sings.
    for o in objs:
        key(o, 1, loc=rl(o), rot=(0, 0, 0))
    key(body, 20, loc=offset(body, dz=0.02), rot=(0.10, 0, 0))
    key(hl, 20, loc=offset(hl, dx=0.05, dz=0.04))
    key(hr, 20, loc=offset(hr, dx=-0.05, dz=0.04))
    for o in objs:
        key(o, 40, loc=rl(o), rot=(0, 0, 0))
    stash("listen", objs)
    reset_pose(objs)

    # celebrate: two hops, hands thrown up.
    for o in objs:
        key(o, 1, loc=rl(o), scale=(1, 1, 1))
    for i, f in enumerate((8, 20)):
        key(body, f - 4, loc=offset(body, dz=-0.04), scale=(1.10, 1.10, 0.88))
        key(body, f, loc=offset(body, dz=0.30), scale=(0.90, 0.90, 1.15))
        key(hl, f, loc=offset(hl, dx=-0.18, dz=0.38))
        key(hr, f, loc=offset(hr, dx=0.18, dz=0.38))
    for o in objs:
        key(o, 32, loc=rl(o), scale=(1, 1, 1))
    stash("celebrate", objs)
    reset_pose(objs)

    # fall: the comedy beat. He topples, lands, and the hands arrive late.
    for o in objs:
        key(o, 1, loc=rl(o), rot=(0, 0, 0), scale=(1, 1, 1))
    key(body, 10, rot=(0, 0.5, 0), loc=offset(body, dz=0.04))
    key(body, 22, rot=(0, 1.7, 0), loc=offset(body, dx=0.25, dz=-0.30),
        scale=(1.12, 1.12, 0.86))
    key(body, 30, rot=(0, 1.55, 0), loc=offset(body, dx=0.28, dz=-0.28),
        scale=(1.0, 1.0, 1.0))
    key(hl, 26, loc=offset(hl, dx=0.10, dz=-0.34))
    key(hr, 28, loc=offset(hr, dx=0.34, dz=-0.34))
    stash("fall", objs)
    reset_pose(objs)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    src = argv[0] if argv else DEFAULT_SRC

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    bpy.context.scene.render.fps = FPS

    body, hl, hr = split_parts()
    tris = decimate([body, hl, hr])
    shrink_textures()
    build_animations(body, hl, hr)

    for o in (body, hl, hr):
        isolate(o)
        bpy.ops.object.shade_smooth()

    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "merc.blend"))

    for o in bpy.data.objects:
        o.select_set(o.type == "MESH")
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(HERE, "merc-preview.glb"),
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_tangents=False,
        export_animations=True,
        # NLA_TRACKS groups by track name, so the three objects' strips
        # named "sing" become ONE glTF animation with three channels --
        # which is what AnimationMixer wants. The default mode keys off
        # action names instead and emits sing_merc_body, sing_merc_hand_l,
        # sing_merc_hand_r as three unrelated clips.
        export_animation_mode="NLA_TRACKS",
        export_bake_animation=False,
        export_image_format="JPEG",
    )
    print("MERC_STATS=", {
        "tris": tris,
        "images": [(i.name, tuple(i.size)) for i in bpy.data.images],
    })


main()
