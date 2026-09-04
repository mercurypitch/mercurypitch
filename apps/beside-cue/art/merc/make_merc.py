"""Merc, from a raw Meshy generation to a scene-ready animated asset.

Run headless:
    blender --background --python make_merc.py -- <source.glb>

Default source is the Meshy 7 High Detail generation kept in dotfiles
(it is 33 MB and does not belong in the repo); pass a path to override.

Writes, next to this file:
    merc-sculpt.blend  the split, decimated shells -- stage one's output
    merc.blend         the working scene: face, rig, clips
    merc-preview.glb   everything above, ready for the optimize pass

Two stages, because they iterate at different speeds. Splitting and
decimating a 34 MB sculpt takes minutes and changes only when the
source does; the face, the rig and the clips take seconds and change
every time someone has a better idea for a blink. So stage one is
cached in merc-sculpt.blend and skipped while it exists -- pass
`--resculpt` to redo it -- and stage two runs from the cache. The
cache is committed, which also means the rig can be rebuilt on a
machine that has never seen the source.

What this script is for
-----------------------
The Meshy output is a single 33 MB mesh at print resolution and NOTHING
else: no materials, no images, no UVs, no skeleton. That is worth
stating plainly, because it decides everything below. Three things have
to happen before it can be in a frame budget:

1. **Split into parts.** glTF import splits vertices at UV seams, so a
   loose-parts separation on the raw mesh explodes it into ~115
   fragments. Welding first collapses it back to the three shells the
   silhouette actually has: body and two hands.

2. **Decimate to budget.** §6.3 gives the scene 50,000 triangles in
   total, and Merc is one prop in a room that also holds a glass, 150
   shards and the walls.

3. **Give him a face.** The sculpt HAS a face: two big convex eyeballs
   (tall ovals, about 0.21 x 0.31 in his 1.65-unit height, each with a
   pupil dip at its centre), lips, and a mouth slit under them. In the
   finished room all of it is invisible. Merc's locked material is
   mirror chrome, and a mirror shows the room, not its own shape, so
   relief has nothing to shade it. A roughness sweep settled this: from
   mirror to matte, from full metal down to 0.2, the eyes never stop
   being faint white-on-white outlines.

   So the face is real geometry laid over the sculpt's own features --
   a dark bead centred on each pupil and sized to its eyeball, one in
   the mouth slit -- with its own dark dielectric material, which is how
   stylised eyes have always been done. It is built HERE rather than in
   the renderer, because a face drawn by the renderer floats in front of
   a face carved by the sculpt, and Merc spent a build with two sets of
   eyes at different sizes.

   The positions were measured, not eyeballed: a raycast height map of
   the face minus its local mean shows the eyeballs as bulges with a dip
   at each centre (the pupils, at x = +/-0.215, z = +0.02) and the mouth
   as a dent (x = 0, z = -0.23). The first placement went by dent
   detection alone and landed the beads in the crease at the LOWER edge
   of each eyeball -- off-centre and too small, which is how a mistake
   in a face reads: not as wrong numbers but as a character who looks
   slightly unwell.

Then the rig. Merc is a droplet: no limbs, no joints, no walk cycle.
What he does need is the one thing object-level scaling cannot do --
deform unevenly, so his top lags behind his bottom and he reads as
liquid rather than as a ball being resized. That is five bones:

    root ─┬─ base ── head
          ├─ hand_l
          └─ hand_r

`root` does not deform; it is the handle the whole character hangs from.
`base` and `head` split the body across a soft ramp, so a squash
compresses the mass and lets the face ride on top of it. The hands are
their own shells and get a bone each. The face is skinned rigidly to
`head`, which is what keeps the eyes inside their sockets while the
sockets are moving.

Expressions are shape keys on that one face mesh -- `blink`, `wide`,
`sing` -- so they cost three morph targets on ~900 vertices and are
played by the same AnimationMixer that plays everything else.

glTF stores all of it: skin, morph targets, and one animation per NLA
track name. three.js reads it with no decoder and no extension of ours.
"""

import math
import os
import sys

import bpy
from mathutils import Quaternion, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_SRC = (
    "/home/maff/.dotfiles/personal/besidecue/assets/main_higgsfield_ref/"
    "meshy/Meshy_AI_Iridescent_Tear_Spiri_0831231604_generate.glb"
)
# The face costs ~900 triangles on top of this, so the budgeted 12,000
# is spent as 11,100 of sculpt plus a face that is worth more per
# triangle than any 900 the decimator would have kept.
TARGET_TRIS = 11100
TEXTURE_SIZE = 1024     # §6.3: one 1024 map is the scene's texture budget
FPS = 30

# The face, in the model's own units (the body is ~1.65 tall). Centres
# are the sculpt's pupil dips and mouth slit from the relief map above;
# the sculpt is a little asymmetric (left pupil at -0.225, right at
# +0.206) and the beads are placed at the symmetric mean, with the
# raycast in `socket()` seating each one on its own real surface.
EYE_X = 0.215
EYE_Z = 0.020
EYE_RX = 0.100          # the eyeball bulge is ~0.105 half-wide
EYE_RY = 0.140          # ...and ~0.155 half-tall: a tall oval, not a disc
MOUTH_Z = -0.230
MOUTH_RX = 0.085        # the slit is ~0.16 wide
MOUTH_RY = 0.038


def isolate(obj):
    for o in bpy.data.objects:
        o.select_set(o is obj)
    bpy.context.view_layer.objects.active = obj


def world_bounds(obj):
    pts = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def smoothstep(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3.0 - 2.0 * t)


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
    """No-op on the current source, and kept for the day it is not.

    The Meshy 7 generation in use carries zero images -- it is raw
    geometry -- so nothing here fires. A future regenerate with maps
    turned on would arrive at 4K, which is most of a phone's texture
    budget in one asset, and this is where that gets caught.
    """
    for img in bpy.data.images:
        if img.size[0] > TEXTURE_SIZE or img.size[1] > TEXTURE_SIZE:
            img.scale(TEXTURE_SIZE, TEXTURE_SIZE)


# ---------------------------------------------------------------- face


def socket(body, x, z):
    """Where the surface actually is at (x, z), and which way it faces.

    Fired from well in front of him along +y. The sculpt is not
    symmetric -- his two pupils are 19 mm apart in x -- so the positions
    here are the symmetric ideal and the RAYCAST is what seats each bead
    on its own real, slightly-off eyeball.
    """
    m = body.matrix_world
    origin = m.inverted() @ Vector((x, -4.0, z))
    direction = m.inverted().to_3x3() @ Vector((0.0, 1.0, 0.0))
    hit, loc, nrm, _ = body.ray_cast(origin, direction)
    if not hit:
        raise RuntimeError(f"no surface at ({x}, {z}) -- did the sculpt change?")
    point = m @ loc
    normal = (m.to_3x3() @ nrm).normalized()
    # Frame: out along the surface, up as close to world +z as the
    # surface allows, right completing it.
    out = normal
    up = (Vector((0.0, 0.0, 1.0)) - out * out.z).normalized()
    right = up.cross(out).normalized()
    return point, right, up, out


def eye_material():
    """Dark, smooth, and NOT metal.

    The instinct is to make the eyes dark chrome so they match the body,
    and it is wrong: a metal's specular highlight takes the colour of
    the metal, so a near-black metal has a near-black highlight and the
    eye comes out as a hole. A dielectric reflects white whatever its
    base colour, which is exactly the wet bead of light that makes an
    eye look alive -- and against a mirror body it also reads as a
    different substance, which is the point.
    """
    mat = bpy.data.materials.new("merc_eye")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]

    def put(name, value):
        if name in bsdf.inputs:
            bsdf.inputs[name].default_value = value

    put("Base Color", (0.012, 0.014, 0.022, 1.0))
    put("Metallic", 0.0)
    put("Roughness", 0.07)
    put("IOR", 1.55)
    put("Specular IOR Level", 1.0)
    return mat


def lens(name, centre, right, up, out, rx, ry, depth, proud):
    """One dark bead, sunk into the surface at `centre`.

    A sphere squashed along the surface normal, placed so `proud` of its
    depth stands out of the socket. Fully proud is a googly eye stuck
    on; fully sunk is invisible; the fraction is the whole look.
    """
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=10, radius=1.0)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.name = name
    origin = centre - out * (depth * (1.0 - proud))
    for v in obj.data.vertices:
        p = v.co
        v.co = origin + right * (p.x * rx) + up * (p.y * ry) + out * (p.z * depth)
    obj.location = (0.0, 0.0, 0.0)
    return obj


def build_face(body):
    """Two eyes and a mouth, as one object with one material.

    One object rather than three, because a blink is symmetric and an
    expression is a whole-face event: three morph targets on one mesh
    beat nine on three, and it is one draw call instead of three.
    """
    feats = {}
    parts = []
    for name, x, z, rx, ry, depth, proud in (
        ("eye_l", -EYE_X, EYE_Z, EYE_RX, EYE_RY, EYE_RY * 0.75, 0.40),
        ("eye_r", EYE_X, EYE_Z, EYE_RX, EYE_RY, EYE_RY * 0.75, 0.40),
        ("mouth", 0.0, MOUTH_Z, MOUTH_RX, MOUTH_RY, MOUTH_RY * 1.3, 0.35),
    ):
        centre, right, up, out = socket(body, x, z)
        feats[name] = (centre, right, up, out)
        parts.append(lens(f"merc_{name}", centre, right, up, out, rx, ry, depth, proud))

    isolate(parts[0])
    for o in parts:
        o.select_set(True)
    bpy.ops.object.join()
    face = bpy.context.active_object
    face.name = face.data.name = "merc_face"
    face.data.materials.append(eye_material())
    bpy.ops.object.shade_smooth()
    bpy.ops.object.origin_set(type="ORIGIN_CENTER_OF_VOLUME")
    return face, feats


def shape_keys(face, feats):
    """blink, wide, sing -- authored per feature, in each feature's frame.

    Every vertex belongs to whichever of the three beads it is nearest,
    and is edited in that bead's own (right, up, out) frame, so a blink
    closes each eye about its OWN centre on its OWN slanted socket. Do
    it in object space instead and the two eyes shear towards each other.
    """
    face.shape_key_add(name="Basis", from_mix=False)
    m = face.matrix_world
    inv = m.inverted()
    names = list(feats)
    owner, frames = [], []
    for v in face.data.vertices:
        w = m @ v.co
        near = min(names, key=lambda n: (w - feats[n][0]).length_squared)
        owner.append(near)
        c, r, u, o = feats[near]
        d = w - c
        frames.append((d.dot(r), d.dot(u), d.dot(o)))

    # Per feature: (right, up, out) multipliers, and how far to push the
    # bead along its normal (in units of its own size).
    poses = {
        # Lids shut. The bead flattens to a slit and withdraws, so a
        # closed eye is a dark line in the socket, not a dark disc.
        "blink": {"eye_l": (1.0, 0.06, 0.55), "eye_r": (1.0, 0.06, 0.55),
                  "mouth": (1.0, 1.0, 1.0)},
        # Alarm, and delight. Both use it; the clip decides which.
        "wide": {"eye_l": (1.18, 1.34, 1.10), "eye_r": (1.18, 1.34, 1.10),
                 "mouth": (0.9, 1.3, 1.0)},
        # A held note: the mouth opens tall and the eyes narrow with the
        # effort, which is the difference between singing and yawning.
        "sing": {"eye_l": (1.0, 0.72, 1.0), "eye_r": (1.0, 0.72, 1.0),
                 "mouth": (1.05, 3.0, 1.25)},
    }
    for key_name, per in poses.items():
        sk = face.shape_key_add(name=key_name, from_mix=False)
        for i, v in enumerate(face.data.vertices):
            name = owner[i]
            c, r, u, o = feats[name]
            sr, su, so = per[name]
            fr, fu, fo = frames[i]
            sk.data[i].co = inv @ (c + r * (fr * sr) + u * (fu * su) + o * (fo * so))
    return list(poses)


# ----------------------------------------------------------------- rig


def build_rig(body, hl, hr, face):
    """Five bones, and the weights that decide what each one owns."""
    arm = bpy.data.armatures.new("merc_rig")
    rig = bpy.data.objects.new("merc_rig", arm)
    bpy.context.collection.objects.link(rig)
    # Armature space and world space are the same space, which is what
    # lets `to_bone` below take plain world directions.
    rig.location = (0.0, 0.0, 0.0)

    lo, hi = world_bounds(body)
    isolate(rig)
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm.edit_bones

    def bone(name, z0, z1, parent=None, x=0.0, y=0.0):
        b = eb.new(name)
        b.head = (x, y, z0)
        b.tail = (x, y, z1)
        if parent is not None:
            b.parent = parent
            b.use_connect = abs(parent.tail.z - z0) < 1e-6 and abs(parent.tail.x - x) < 1e-6
        return b

    root = bone("root", lo.z, lo.z + 0.12 * (hi.z - lo.z))
    base = bone("base", root.tail.z, -0.30, root)
    bone("head", -0.30, hi.z, base)
    root.use_deform = False

    # `base` must be able to TRANSLATE, and a connected bone cannot.
    #
    # `bone()` connects a child whose head sits on its parent's tail,
    # which is what `base` does -- and Blender then ignores the location
    # channel on it outright. Not an error, not a warning: the keys go in,
    # the curves show up in the graph editor, and the bone does not move.
    # Every `up=` and `side=` ever written for `base` was a no-op, which
    # is why the fall could never be made to touch the floor.
    #
    # Disconnecting changes nothing else. The parenting stays, so `base`
    # still follows `root`; it only stops being pinned to root's tail.
    base.use_connect = False

    for name, hand in (("hand_l", hl), ("hand_r", hr)):
        hlo, hhi = world_bounds(hand)
        c = (hlo + hhi) * 0.5
        bone(name, c.z - 0.06, c.z + 0.10, root, x=c.x, y=c.y)

    bpy.ops.object.mode_set(mode="OBJECT")

    def attach(obj, weights):
        obj.parent = rig
        obj.matrix_parent_inverse = rig.matrix_world.inverted()
        mod = obj.modifiers.new("armature", "ARMATURE")
        mod.object = rig
        groups = {}
        for v in obj.data.vertices:
            w = obj.matrix_world @ v.co
            for name, amount in weights(w).items():
                if amount <= 1e-4:
                    continue
                g = groups.get(name) or groups.setdefault(name, obj.vertex_groups.new(name=name))
                g.add([v.index], amount, "REPLACE")

    # The body's only real decision. Above the mouth it is all head, so
    # the face and its sockets move as one rigid piece and the beads
    # never drift out of the dents they sit in; below the waist it is
    # all base; the ramp between is wide enough that a hard squash has
    # somewhere to bend. Getting this backwards -- a narrow ramp, or one
    # that crosses the face -- is what makes a rigged blob crease.
    attach(body, lambda w: {
        "head": smoothstep(-0.55, -0.25, w.z),
        "base": 1.0 - smoothstep(-0.55, -0.25, w.z),
    })
    attach(hl, lambda w: {"hand_l": 1.0})
    attach(hr, lambda w: {"hand_r": 1.0})
    attach(face, lambda w: {"head": 1.0})

    for pb in rig.pose.bones:
        pb.rotation_mode = "XYZ"
    return rig


def to_bone(pb, world_vec):
    """A world direction, said in the bone's own axes.

    Pose-bone location and rotation are expressed along the bone's local
    axes, and a bone's Y always runs head to tail -- but which way its X
    and Z point is decided by a roll Blender computes, not by anything
    written here. Asking the bone matrix is the difference between
    animation that works and animation that is mysteriously mirrored.
    """
    return pb.bone.matrix_local.to_3x3().inverted() @ Vector(world_vec)


# ---------------------------------------------------------- animations

UP = (0.0, 0.0, 1.0)
SIDE = (1.0, 0.0, 0.0)
FWD = (0.0, -1.0, 0.0)
# Rotation axes, with their signs pinned by what the tip of him does:
# positive `lean` nods the tip forward, towards the viewer; positive
# `roll` tips it to screen-right. Both are checked in preview.py's
# sheet, not assumed from a right-hand rule.
LEAN_AXIS = (1.0, 0.0, 0.0)
ROLL_AXIS = (0.0, 1.0, 0.0)


def build_animations(rig, face, unit):
    """Five clips, each one NLA track per animated datablock.

    `unit` is Merc's own height, so every offset below is a fraction of
    him and survives a re-sculpt at a different scale.
    """
    pose = rig.pose.bones
    skb = face.data.shape_keys.key_blocks
    face.data.shape_keys.animation_data_create()

    def bkey(name, frame, up=0.0, side=0.0, fwd=0.0,
             lean=None, roll=None, stretch=None, squash=None, scale=None):
        pb = pose[name]
        offset = (Vector(UP) * up + Vector(SIDE) * side + Vector(FWD) * fwd) * unit
        pb.location = to_bone(pb, offset)
        pb.keyframe_insert("location", frame=frame)
        if lean is not None or roll is not None:
            q = Quaternion((1, 0, 0, 0))
            if lean:
                q = Quaternion(to_bone(pb, LEAN_AXIS).normalized(), lean) @ q
            if roll:
                q = Quaternion(to_bone(pb, ROLL_AXIS).normalized(), roll) @ q
            pb.rotation_euler = q.to_euler("XYZ")
            pb.keyframe_insert("rotation_euler", frame=frame)
        if scale is not None:
            # All three bone axes, named outright. `squash`/`stretch`
            # below cannot flatten anything: they drive the cross-section
            # as ONE number, so a squashed bone gets thinner in both
            # directions at once and reads as a thinner character rather
            # than a flattened one. That is fine for a hover or a gulp,
            # and useless for a body hitting a floor -- a splat needs the
            # vertical to lose exactly what the horizontal gains.
            #
            # X is the axis to reach for after a roll. The bone points up
            # at rest, so its Y is his length and its X and Z are girth;
            # roll him onto his side and that X is the one pointing at
            # the ceiling. Which is only true once he is over, so this is
            # an impact-and-after tool, not something to key mid-topple.
            pb.scale = scale
            pb.keyframe_insert("scale", frame=frame)
        elif stretch is not None or squash is not None:
            across = squash if squash is not None else 1.0
            along = stretch if stretch is not None else 1.0
            # Y is the bone's own axis; X and Z are its cross-section.
            pb.scale = (across, along, across)
            pb.keyframe_insert("scale", frame=frame)

    def face_key(frame, **values):
        for k in ("blink", "wide", "sing"):
            skb[k].value = values.get(k, 0.0)
            skb[k].keyframe_insert("value", frame=frame)

    def blink_at(frame):
        """Four frames, and closed for one. Any slower reads as a wince."""
        face_key(frame, blink=0.0)
        face_key(frame + 2, blink=1.0)
        face_key(frame + 5, blink=0.0)

    def rest(frame, bones):
        for name in bones:
            bkey(name, frame, stretch=1.0, squash=1.0, lean=0.0, roll=0.0)

    ALL = ("root", "base", "head", "hand_l", "hand_r")

    def stash(name):
        """Push every current action into a track called `name`.

        The exporter's NLA_TRACKS mode collapses SAME-NAMED tracks into
        one glTF animation, which is how the armature's pose and the
        face's shape keys come out as a single clip three.js can play
        with one `mixer.clipAction`.
        """
        for holder in (rig, face.data.shape_keys):
            ad = holder.animation_data
            if ad is None or ad.action is None:
                continue
            track = ad.nla_tracks.new()
            track.name = name
            track.strips.new(name, 1, ad.action)
            ad.action = None
        for pb in pose:
            pb.location = (0.0, 0.0, 0.0)
            pb.rotation_euler = (0.0, 0.0, 0.0)
            pb.scale = (1.0, 1.0, 1.0)
        for k in ("blink", "wide", "sing"):
            skb[k].value = 0.0

    # sing: he stretches upward into the note and the hands lift with
    # it. The mouth carries the clip; the body is the follow-through.
    rest(1, ALL)
    face_key(1)
    bkey("head", 8, up=0.03, stretch=1.06, squash=0.97)
    bkey("head", 15, up=0.06, stretch=1.14, squash=0.93, lean=-0.05)
    bkey("base", 15, squash=1.04, stretch=0.96)
    bkey("hand_l", 15, side=-0.10, up=0.22)
    bkey("hand_r", 15, side=0.10, up=0.22)
    face_key(6, sing=0.85)
    face_key(15, sing=1.0)
    face_key(26, sing=0.55)
    rest(30, ALL)
    face_key(30)
    stash("sing")

    # listen: a small lean, hands drawn in. Idle, and deliberately still
    # -- the room is quiet until the player sings. This is the clip he
    # spends most of his life in, so it is the one that carries blinks.
    rest(1, ALL)
    face_key(1)
    bkey("head", 20, up=0.02, lean=0.10)
    bkey("hand_l", 20, side=0.05, up=0.04)
    bkey("hand_r", 20, side=-0.05, up=0.04)
    blink_at(9)
    blink_at(28)
    rest(40, ALL)
    face_key(40)
    stash("listen")

    # celebrate: two hops. The anticipation crouch before each one is
    # what sells the jump -- without it he teleports upward.
    rest(1, ALL)
    face_key(1)
    for f in (8, 20):
        bkey("root", f - 4, up=-0.04)
        bkey("head", f - 4, squash=1.10, stretch=0.86)
        bkey("base", f - 4, squash=1.12, stretch=0.84)
        bkey("root", f, up=0.30)
        bkey("head", f, squash=0.90, stretch=1.18)
        bkey("base", f, squash=0.92, stretch=1.12)
        # root carries the hands up with the hop; this is the throw on top.
        bkey("hand_l", f, side=-0.18, up=0.10)
        bkey("hand_r", f, side=0.18, up=0.10)
    face_key(4, wide=0.4)
    face_key(12, wide=1.0)
    face_key(24, wide=1.0, sing=0.35)
    rest(32, ALL)
    face_key(32)
    stash("celebrate")

    # move: the travel bob. Deliberately in place -- the stage drives
    # the root's position, and this is what the body does while that
    # happens. He hovers, so locomotion is a bob with the hands trailing
    # in counter-swing: the one clip the limbless body plan makes EASIER
    # than a walk cycle would have been.
    rest(1, ALL)
    face_key(1)
    bkey("head", 1, lean=-0.06)
    bkey("head", 11, up=0.05, lean=-0.10, stretch=1.05, squash=0.98)
    bkey("head", 21, lean=-0.06, stretch=1.0, squash=1.0)
    bkey("head", 31, up=0.05, lean=-0.10, stretch=1.05, squash=0.98)
    bkey("hand_l", 11, fwd=0.08, up=0.03)
    bkey("hand_l", 31, fwd=-0.08, up=0.01)
    bkey("hand_r", 11, fwd=-0.08, up=0.01)
    bkey("hand_r", 31, fwd=0.08, up=0.03)
    blink_at(16)
    rest(41, ALL)
    bkey("head", 41, lean=-0.06)
    face_key(41)
    stash("move")

    # fall: the comedy beat.
    # ------------------------------------------------------------
    #
    # He teeters, goes over to screen-right, hits, and wobbles down to a
    # puddle. Four beats, and each one is a different problem:
    #
    #   1-9    ANTICIPATION. He leans the wrong way first and stretches
    #          up off his base, because a fall that starts the instant
    #          the clip does has nothing to fall FROM. The eyes go wide
    #          two frames before the body commits -- he works out what is
    #          happening slightly before it happens to him.
    #   9-18   THE TOPPLE, accelerating. Even spacing here is what makes
    #          a fall look like a door closing, so the roll covers 0.16
    #          to 1.56 with most of it in the last four frames. He
    #          elongates on the way over; a liquid does.
    #   18     IMPACT, one frame past flat, with the splat.
    #   18-37  THE SETTLE, three wobbles of decreasing size and
    #          alternating sign. He is mercury: he does not stop, he
    #          rings down. The head runs opposite the body throughout,
    #          which is the only secondary motion this rig can express.
    #
    # The topple is keyed on `base` (which carries the head) and not on
    # `root` (which would carry the hands too, and lose the late hands
    # that are the joke). `base` pivots at his bottom, so lying flat IS
    # the pose and there is no downward offset to author.
    rest(1, ALL)
    face_key(1)

    # Anticipation: away from the fall, and up onto his toes.
    bkey("base", 5, roll=-0.08, stretch=1.06, squash=0.97)
    bkey("head", 5, roll=-0.06, lean=-0.05)
    face_key(5)
    face_key(7, wide=1.0)

    # The commit. Still slow -- this is the beat the audience gets to
    # see coming.
    bkey("base", 9, roll=0.16, stretch=1.04, squash=0.98)
    bkey("head", 9, roll=0.13, lean=-0.14)

    # Over he goes, and stretched out with it.
    bkey("base", 13, roll=0.55, stretch=1.12, squash=0.94)
    bkey("head", 13, roll=0.26, lean=0.06)
    bkey("base", 16, roll=1.05, stretch=1.10, squash=0.95)
    bkey("head", 16, roll=0.20, lean=0.14)

    # IMPACT. One frame, one frame past flat, and the flattest he gets:
    # the vertical loses a quarter and the length and depth take it.
    bkey("base", 18, roll=1.58, side=0.05, up=-0.128, scale=(0.74, 1.10, 1.18))
    bkey("head", 18, roll=0.16, lean=-0.08, scale=(0.80, 1.06, 1.14))
    face_key(18, blink=1.0)

    # First rebound, and the biggest: he comes back up past round.
    bkey("base", 22, roll=1.43, side=0.06, up=0.030, scale=(1.11, 0.95, 0.94))
    bkey("head", 22, roll=-0.12, scale=(1.09, 0.97, 0.96))
    face_key(21, blink=0.55, wide=0.5)

    # Second, smaller, and the other way.
    bkey("base", 26, roll=1.54, side=0.06, up=-0.047, scale=(0.91, 1.04, 1.06))
    bkey("head", 26, roll=0.07, scale=(0.95, 1.02, 1.03))
    face_key(26, wide=0.75)

    # Third, nearly gone.
    bkey("base", 31, roll=1.47, side=0.06, scale=(1.04, 0.99, 0.98))
    bkey("head", 31, roll=-0.04, scale=(1.02, 0.99, 0.99))

    # Settled -- and still a little spread, because he is a puddle now
    # and a puddle that returns to a sphere was never liquid.
    bkey("base", 37, roll=1.50, side=0.06, up=-0.040, scale=(0.95, 1.01, 1.04))
    bkey("head", 37, roll=0.0, scale=(0.98, 1.0, 1.01))
    bkey("base", 42, roll=1.50, side=0.06, up=-0.040, scale=(0.95, 1.01, 1.04))
    bkey("head", 42, roll=0.0, scale=(0.98, 1.0, 1.01))

    # Which hand goes where is not a choice, it is the roll direction.
    #
    # The bones are named from Merc's own left and right, so `hand_l`
    # sits at +X -- the viewer's right -- and positive `roll` tips him
    # that way. He therefore falls ONTO HIS LEFT, and that settles both
    # hands before any taste is involved:
    #
    #   hand_l  the side he lands on. It cannot stay where the body is
    #           about to be, so it is shoved out towards the camera and
    #           comes to rest flat on the floor beside him.
    #   hand_r  the side that ends up facing the sky. It swings up and
    #           over and lands ON him, which is what a hand does when
    #           the shoulder it hangs from turns 86 degrees.
    #
    # Where they end up is the rotation's answer too, not the animator's.
    # Both hands hang low on him, so the roll carries their sockets to
    # his TAIL -- the end that is now screen-left. Rotating the rest
    # position about `base`'s pivot (z = -0.502) gives the anchors:
    #
    #   hand_l  (+0.747, -0.045, -0.697)  ->  (-0.14, -0.05, -1.26)
    #   hand_r  (-0.747, -0.045, -0.697)  ->  (-0.25, -0.05, +0.23)
    #
    # One under the floor and one above him, so hand_l comes up to floor
    # level and steps out towards the camera to clear his side, and
    # hand_r stays where the rotation put it and settles onto him.
    # `side` negative for the left hand and positive for the right is
    # the giveaway that the first version was wrong: both were positive,
    # so both hands travelled the same way and neither ended up where
    # its socket did.
    #
    # They ROLL with him as well. A hand that goes on hanging cuff-up
    # while the body turns 86 degrees is the tell that nothing joins
    # them. The roll runs behind the body's and does not quite reach it,
    # which is the drag an arm would have supplied.
    #
    # And they land AFTER him -- after the first rebound, not with the
    # impact. Hands that arrive on the same frame as the body read as
    # one pose change; hands that arrive two beats later read as parts
    # that were never told.

    # Trailing: he is already going over, they have not caught up.
    bkey("hand_l", 12, side=-0.05, fwd=0.15, up=-0.03, roll=0.25)
    # Thrown clear by the impact. The body splats widest on frame 18 and
    # reaches further towards the camera than it ever does at rest, so
    # the hand is pushed out ahead of it and drifts back in as the splat
    # relaxes -- which is both what gets it out of the mesh and what a
    # landing would have done to it.
    bkey("hand_l", 18, side=-0.42, fwd=0.54, up=-0.090, roll=0.90)
    bkey("hand_r", 12, side=0.05, up=0.06, roll=0.20)

    # hand_l gets out towards the camera and drops to the floor, with a
    # small bounce of its own.
    bkey("hand_l", 22, side=-0.46, fwd=0.45, up=-0.10, roll=1.10)
    bkey("hand_l", 28, side=-0.483, fwd=0.340, up=-0.100, roll=1.62)
    bkey("hand_l", 31, side=-0.470, fwd=0.330, up=-0.060, roll=1.50)
    bkey("hand_l", 37, side=-0.483, fwd=0.320, up=-0.100, roll=1.55)
    bkey("hand_l", 42, side=-0.483, fwd=0.320, up=-0.100, roll=1.55)

    # hand_r comes over the top -- on an arc, because keyed only at
    # either end it cut the corner and went through his shoulder -- and
    # lands on him last of all, pressing in a little on arrival and
    # rising back off it. The heights are set by closest APPROACH, not
    # by penetration: a hand that is merely outside the mesh can be a
    # hand hanging 10cm above him in mid-air, which is what the first
    # version of this was, and only a distance measurement says so.
    bkey("hand_r", 22, side=0.25, up=0.30, roll=0.80)
    bkey("hand_r", 28, side=0.38, up=0.62, roll=1.20)
    bkey("hand_r", 31, side=0.44, up=0.60, roll=1.32)
    bkey("hand_r", 34, side=0.483, fwd=0.033, up=0.545, roll=1.45)
    bkey("hand_r", 37, side=0.483, fwd=0.033, up=0.575, roll=1.38)
    bkey("hand_r", 42, side=0.483, fwd=0.033, up=0.535, roll=1.40)

    # He gets his eyes back, looks at where he is, and blinks once.
    face_key(33, wide=0.35)
    blink_at(37)
    face_key(42)
    stash("fall")


SCULPT = os.path.join(HERE, "merc-sculpt.blend")


def sculpt(src):
    """Stage one: source glb to three decimated shells, cached on disk."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    body, hl, hr = split_parts()
    tris = decimate([body, hl, hr])
    shrink_textures()
    for o in (body, hl, hr):
        isolate(o)
        bpy.ops.object.shade_smooth()
    bpy.ops.wm.save_as_mainfile(filepath=SCULPT)
    print("MERC_SCULPT=", {"tris": tris})


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    resculpt = "--resculpt" in argv
    paths = [a for a in argv if not a.startswith("--")]
    src = paths[0] if paths else DEFAULT_SRC

    if resculpt or not os.path.exists(SCULPT):
        sculpt(src)
    bpy.ops.wm.open_mainfile(filepath=SCULPT)
    bpy.context.scene.render.fps = FPS
    body = bpy.data.objects["merc_body"]
    hl = bpy.data.objects["merc_hand_l"]
    hr = bpy.data.objects["merc_hand_r"]
    tris = sum(len(o.data.polygons) for o in (body, hl, hr))

    face, feats = build_face(body)
    keys = shape_keys(face, feats)
    unit = world_bounds(body)[1].z - world_bounds(body)[0].z
    rig = build_rig(body, hl, hr, face)
    build_animations(rig, face, unit)

    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "merc.blend"))

    for o in bpy.data.objects:
        o.select_set(o.type in {"MESH", "ARMATURE"})
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(HERE, "merc-preview.glb"),
        export_format="GLB",
        export_yup=True,
        # False, and it matters now that there is a skin. `export_apply`
        # evaluates modifiers into the exported mesh, and the Armature
        # modifier is a modifier: applying it would bake the rest pose
        # into the vertices and ship a skeleton attached to nothing. The
        # decimate is already applied in place, so there is nothing left
        # for this to do anyway.
        export_apply=False,
        export_tangents=False,
        export_skins=True,
        export_morph=True,
        export_animations=True,
        # NLA_TRACKS groups by track name, so the armature's "sing"
        # strip and the face's "sing" strip become ONE glTF animation
        # with both channel sets -- which is what AnimationMixer wants.
        # The default mode keys off action names instead and emits them
        # as unrelated clips.
        export_animation_mode="NLA_TRACKS",
        # Sampling, because the poses are keyed as XYZ euler and glTF
        # only stores quaternions. Without this the exporter has to
        # convert curve by curve and silently drops the ones it cannot.
        # Five bones over forty frames is a rounding error.
        export_bake_animation=True,
        export_image_format="JPEG",
    )
    print("MERC_STATS=", {
        "tris": tris,
        "face_tris": len(face.data.polygons),
        "shape_keys": keys,
        "bones": [b.name for b in rig.data.bones],
        "images": [(i.name, tuple(i.size)) for i in bpy.data.images],
    })


main()
