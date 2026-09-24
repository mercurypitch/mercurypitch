"""Measure the authored Merc loader clips in the packed Blender source.

Run from the repository root after rebuilding Merc:

    blender --background apps/beside-cue/art/merc/merc.blend \
      --python-exit-code 1 \
      --python art/glass-adventure/loader/v1/production/audit_merc_loader.py \
      -- art/glass-adventure/loader/v1/proofs/animation-audit.json
"""

from __future__ import annotations

import json
import math
import os
import sys
from datetime import datetime, timezone

import bpy
from mathutils import Vector


EXPECTED_TRACKS = (
    "sing",
    "listen",
    "welcome",
    "laugh",
    "celebrate",
    "move",
    "fall",
)
END_FRAMES = {"listen": 40, "welcome": 49, "laugh": 37}
POSE_BONES = ("root", "base", "head", "hand_l", "hand_r")
MORPHS = ("blink", "wide", "sing")
MESHES = ("merc_body", "merc_hand_l", "merc_hand_r", "merc_face")


def output_path() -> str:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if argv:
        return os.path.abspath(argv[0])
    return os.path.abspath(
        "art/glass-adventure/loader/v1/proofs/animation-audit.json"
    )


def holders(rig: bpy.types.Object, face: bpy.types.Object):
    return (rig.animation_data, face.data.shape_keys.animation_data)


def solo(track_name: str, rig: bpy.types.Object, face: bpy.types.Object) -> None:
    for animation_data in holders(rig, face):
        for track in animation_data.nla_tracks:
            track.is_solo = False
        for track in animation_data.nla_tracks:
            if track.name == track_name:
                track.is_solo = True


def pose_snapshot(rig: bpy.types.Object, face: bpy.types.Object, frame: int) -> dict:
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    return {
        "bones": {
            name: {
                "location": list(rig.pose.bones[name].location),
                "rotationEuler": list(rig.pose.bones[name].rotation_euler),
                "scale": list(rig.pose.bones[name].scale),
            }
            for name in POSE_BONES
        },
        "morphs": {
            name: float(face.data.shape_keys.key_blocks[name].value)
            for name in MORPHS
        },
    }


def maximum_pose_delta(a: dict, b: dict) -> float:
    delta = 0.0
    for bone_name in POSE_BONES:
        for property_name in ("location", "rotationEuler", "scale"):
            delta = max(
                delta,
                *(
                    abs(left - right)
                    for left, right in zip(
                        a["bones"][bone_name][property_name],
                        b["bones"][bone_name][property_name],
                    )
                ),
            )
    for morph_name in MORPHS:
        delta = max(delta, abs(a["morphs"][morph_name] - b["morphs"][morph_name]))
    return delta


def evaluated_min_z(mesh_names: tuple[str, ...]) -> float:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    minimum = math.inf
    for name in mesh_names:
        evaluated = bpy.data.objects[name].evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            minimum = min(
                minimum,
                min((evaluated.matrix_world @ vertex.co).z for vertex in mesh.vertices),
            )
        finally:
            evaluated.to_mesh_clear()
    return minimum


def track_ranges(animation_data) -> dict[str, dict]:
    ranges = {}
    for track in animation_data.nla_tracks:
        strip = track.strips[0]
        ranges[track.name] = {
            "frameStart": float(strip.action_frame_start),
            "frameEnd": float(strip.action_frame_end),
            "stripStart": float(strip.frame_start),
            "stripEnd": float(strip.frame_end),
        }
    return ranges


def main() -> None:
    scene = bpy.context.scene
    rig = bpy.data.objects["merc_rig"]
    face = bpy.data.objects["merc_face"]
    fps = scene.render.fps / scene.render.fps_base
    rig_ranges = track_ranges(rig.animation_data)
    face_ranges = track_ranges(face.data.shape_keys.animation_data)

    missing_rig = sorted(set(EXPECTED_TRACKS) - set(rig_ranges))
    missing_face = sorted(set(EXPECTED_TRACKS) - set(face_ranges))

    solo("listen", rig, face)
    listen_pose = pose_snapshot(rig, face, END_FRAMES["listen"])
    listen_floor = evaluated_min_z(MESHES)

    clips = {}
    failures = []
    for clip_name in ("welcome", "laugh"):
        end_frame = END_FRAMES[clip_name]
        solo(clip_name, rig, face)
        endpoint = pose_snapshot(rig, face, end_frame)
        endpoint_delta = maximum_pose_delta(endpoint, listen_pose)
        root_max_abs = 0.0
        minimum_floor = math.inf
        minimum_floor_frame = 1
        for frame in range(1, end_frame + 1):
            scene.frame_set(frame)
            bpy.context.view_layer.update()
            root_max_abs = max(
                root_max_abs,
                rig.pose.bones["root"].location.length,
                Vector(rig.pose.bones["root"].rotation_euler).length,
            )
            frame_floor = evaluated_min_z(MESHES)
            if frame_floor < minimum_floor:
                minimum_floor = frame_floor
                minimum_floor_frame = frame

        key_span = (end_frame - 1) / fps
        clips[clip_name] = {
            "frameStart": 1,
            "frameEnd": end_frame,
            "authoredKeySpanSeconds": key_span,
            "expectedGltfPlaybackDurationSeconds": end_frame / fps,
            "rootMaxLocationOrRotationMagnitude": root_max_abs,
            "minimumEvaluatedZ": minimum_floor,
            "minimumEvaluatedZFrame": minimum_floor_frame,
            "listenFloorZ": listen_floor,
            "floorDeltaFromListen": minimum_floor - listen_floor,
            "endpointMaxChannelDeltaFromListen": endpoint_delta,
        }
        if endpoint_delta > 1e-6:
            failures.append(f"{clip_name} does not end in the listen pose")
        if root_max_abs > 1e-7:
            failures.append(f"{clip_name} moves or rotates the root bone")
        if minimum_floor < listen_floor - 0.002:
            failures.append(f"{clip_name} penetrates the listen floor by over 2 mm")

    for animation_data in holders(rig, face):
        for track in animation_data.nla_tracks:
            track.is_solo = False

    if missing_rig:
        failures.append(f"rig is missing tracks: {', '.join(missing_rig)}")
    if missing_face:
        failures.append(f"face is missing tracks: {', '.join(missing_face)}")

    report = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "apps/beside-cue/art/merc/merc.blend",
        "fps": fps,
        "expectedTracks": list(EXPECTED_TRACKS),
        "rigTrackRanges": rig_ranges,
        "faceTrackRanges": face_ranges,
        "clips": clips,
        "checks": {
            "allTracksOnRig": not missing_rig,
            "allTracksOnFaceMorphs": not missing_face,
            "loaderClipsAreGrounded": all(
                clip["minimumEvaluatedZ"] >= listen_floor - 0.002
                and clip["rootMaxLocationOrRotationMagnitude"] <= 1e-7
                for clip in clips.values()
            ),
            "loaderClipsEndAtListenPose": all(
                clip["endpointMaxChannelDeltaFromListen"] <= 1e-6
                for clip in clips.values()
            ),
            "passed": not failures,
        },
        "failures": failures,
    }
    destination = output_path()
    os.makedirs(os.path.dirname(destination), exist_ok=True)
    with open(destination, "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2, sort_keys=True)
        handle.write("\n")
    print("MERC_ANIMATION_AUDIT", destination, "PASS" if not failures else "FAIL")
    if failures:
        raise RuntimeError("; ".join(failures))


main()
