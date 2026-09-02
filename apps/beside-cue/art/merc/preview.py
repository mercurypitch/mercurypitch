"""The contact sheet: every clip at its telling frame, in one image.

    blender --background merc.blend --python preview.py -- <out_dir>

Renders eight tiles on clay (the body has no material of its own, and
grey shows the sculpt; the face keeps its real material) and leaves the
PNGs in <out_dir>, which defaults to preview/ next to this file. Run
`magick montage` over them, or just open the folder.

This exists because the question "does the rig work" has to be answered
by looking, and looking has to be cheap enough to do after every change.
The stage-two build takes seconds; this takes seconds; together they
are the iteration loop.

One thing this script gets right that its first version got wrong, and
it is worth the paragraph: soloing an NLA track. `NlaTrack.is_solo`
also owns a flag on the AnimData, and setting it FALSE on any track
clears that flag -- so "set every track's is_solo to (name matches)"
solos the right track and then un-solos the block on the very next
iteration. Every tile rendered the top track of the stack, which was
`fall`, and the sheet said the rig was broken when the rig was fine.
Clear all first, then set the one.
"""

import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else os.path.join(HERE, "preview")
os.makedirs(OUT, exist_ok=True)

sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE"
sc.eevee.taa_render_samples = 24
sc.render.resolution_x = sc.render.resolution_y = 512
sc.world = bpy.data.worlds.new("preview")
sc.world.use_nodes = True
bg = sc.world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.35, 0.36, 0.38, 1.0)

clay = bpy.data.materials.new("clay")
clay.use_nodes = True
bsdf = clay.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (0.85, 0.82, 0.78, 1.0)
bsdf.inputs["Roughness"].default_value = 0.5
for name in ("merc_body", "merc_hand_l", "merc_hand_r"):
    obj = bpy.data.objects[name]
    if not obj.data.materials:
        obj.data.materials.append(clay)


def add(name, data, location=(0, 0, 0), rotation=(0, 0, 0)):
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    obj.rotation_euler = rotation
    sc.collection.objects.link(obj)
    return obj


sun = add("sun", bpy.data.lights.new("sun", "SUN"),
          rotation=(math.radians(55), math.radians(-20), math.radians(-35)))
sun.data.energy = 3.5
fill = add("fill", bpy.data.lights.new("fill", "AREA"), (2.5, -3.0, 1.5),
           (math.radians(60), 0.0, math.radians(40)))
fill.data.energy = 400
fill.data.size = 4
cam = add("cam", bpy.data.cameras.new("cam"))
cam.data.type = "ORTHO"
cam.data.ortho_scale = 3.0
sc.camera = cam


def aim(pos, target=(0.0, 0.0, 0.1)):
    cam.location = pos
    d = Vector(target) - Vector(pos)
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


rig = bpy.data.objects["merc_rig"]
face = bpy.data.objects["merc_face"]
holders = [rig.animation_data, face.data.shape_keys.animation_data]


def solo(name):
    for ad in holders:
        for t in ad.nla_tracks:
            t.is_solo = False
        for t in ad.nla_tracks:
            if t.name == name:
                t.is_solo = True


def shot(fname, clip, frame, pos):
    solo(clip)
    sc.frame_set(frame)
    aim(pos)
    sc.render.filepath = os.path.join(OUT, fname)
    bpy.ops.render.render(write_still=True)


FRONT = (0.0, -6.0, 0.1)
THREE_Q = (-4.2, -4.2, 1.4)
# Rest is rendered with no track soloed, which stacks every clip's
# frame 1 -- all of which ARE rest. A clip whose frame 1 drifts from
# rest shows up here as a wrong rest pose, which is the point.
shot("00-rest-front.png", None, 1, FRONT)
shot("01-rest-3q.png", None, 1, THREE_Q)
shot("02-sing-f15.png", "sing", 15, FRONT)
shot("03-listen-f11-blink.png", "listen", 11, FRONT)
shot("04-celebrate-f20.png", "celebrate", 20, FRONT)
shot("05-move-f11.png", "move", 11, THREE_Q)
shot("06-fall-f22.png", "fall", 22, FRONT)
shot("07-fall-f38.png", "fall", 38, THREE_Q)
shot("08-fall-f38-front.png", "fall", 38, FRONT)
print("PREVIEW_DONE", OUT)
