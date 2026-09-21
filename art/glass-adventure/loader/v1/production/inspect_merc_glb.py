"""Inspect the final Merc GLB contract without changing either binary.

Blender exports the first keyed frame at 1/30 s. The authored key span is
therefore one frame shorter than Three.js's AnimationClip duration, which is
the largest input time rather than ``last - first``. Both values are recorded
explicitly so runtime tests use the actual GLTFLoader convention.

Run from the repository root:

    python3 art/glass-adventure/loader/v1/production/inspect_merc_glb.py
"""

from __future__ import annotations

import hashlib
import json
import os
import struct
import sys
from datetime import datetime, timezone


EXPECTED_CLIPS = {
    "sing": {"keySpan": 29 / 30, "playback": 30 / 30},
    "listen": {"keySpan": 39 / 30, "playback": 40 / 30},
    "welcome": {"keySpan": 48 / 30, "playback": 49 / 30},
    "laugh": {"keySpan": 36 / 30, "playback": 37 / 30},
    "celebrate": {"keySpan": 31 / 30, "playback": 32 / 30},
    "move": {"keySpan": 40 / 30, "playback": 41 / 30},
    "fall": {"keySpan": 41 / 30, "playback": 42 / 30},
}
EXPECTED_BONES = {"root", "base", "head", "hand_l", "hand_r"}
EXPECTED_MORPHS = {"blink", "wide", "sing"}
DEFAULT_OPTIMIZED = "apps/beside-cue/art/merc/merc.opt.glb"
DEFAULT_PUBLIC = "apps/beside-cue/public/games/glass3d/merc.glb"
DEFAULT_OUTPUT = "art/glass-adventure/loader/v1/proofs/glb-contract.json"


def read_glb(path: str) -> tuple[dict, int, str]:
    payload = open(path, "rb").read()
    if len(payload) < 20 or payload[:4] != b"glTF":
        raise ValueError(f"{path} is not a GLB")
    version, declared_length = struct.unpack_from("<II", payload, 4)
    if version != 2 or declared_length != len(payload):
        raise ValueError(f"{path} has an invalid GLB header")
    offset = 12
    document = None
    while offset < len(payload):
        chunk_length, chunk_type = struct.unpack_from("<II", payload, offset)
        offset += 8
        chunk = payload[offset : offset + chunk_length]
        offset += chunk_length
        if chunk_type == 0x4E4F534A:
            document = json.loads(chunk.rstrip(b" \t\r\n\x00"))
    if document is None:
        raise ValueError(f"{path} has no JSON chunk")
    return document, len(payload), hashlib.sha256(payload).hexdigest()


def accessor_range(document: dict, accessor_index: int) -> tuple[float, float]:
    accessor = document["accessors"][accessor_index]
    return float(accessor["min"][0]), float(accessor["max"][0])


def animation_contract(document: dict) -> dict[str, dict]:
    result = {}
    for animation in document.get("animations", []):
        starts = []
        ends = []
        for sampler in animation["samplers"]:
            start, end = accessor_range(document, sampler["input"])
            starts.append(start)
            ends.append(end)
        result[animation["name"]] = {
            "firstKeySeconds": min(starts),
            "lastKeySeconds": max(ends),
            "authoredKeySpanSeconds": max(ends) - min(starts),
            "gltfPlaybackDurationSeconds": max(ends),
            "channelCount": len(animation["channels"]),
            "targetPaths": sorted(
                {channel["target"]["path"] for channel in animation["channels"]}
            ),
        }
    return result


def triangle_count(document: dict) -> int:
    total = 0
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            if primitive.get("mode", 4) != 4:
                continue
            if "indices" in primitive:
                count = document["accessors"][primitive["indices"]]["count"]
            else:
                count = document["accessors"][primitive["attributes"]["POSITION"]][
                    "count"
                ]
            total += count // 3
    return total


def main() -> None:
    optimized_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_OPTIMIZED
    public_path = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_PUBLIC
    output_path = sys.argv[3] if len(sys.argv) > 3 else DEFAULT_OUTPUT
    document, optimized_bytes, optimized_sha = read_glb(optimized_path)
    public_document, public_bytes, public_sha = read_glb(public_path)
    animations = animation_contract(document)
    node_names = [node.get("name", "") for node in document.get("nodes", [])]
    joints = {
        node_names[index]
        for skin in document.get("skins", [])
        for index in skin.get("joints", [])
    }
    morphs = {
        name
        for mesh in document.get("meshes", [])
        for name in mesh.get("extras", {}).get("targetNames", [])
    }
    failures = []
    if set(animations) != set(EXPECTED_CLIPS):
        failures.append(
            "animation names differ: "
            f"expected {sorted(EXPECTED_CLIPS)}, found {sorted(animations)}"
        )
    for name, expected in EXPECTED_CLIPS.items():
        if name not in animations:
            continue
        if abs(animations[name]["authoredKeySpanSeconds"] - expected["keySpan"]) > 1e-5:
            failures.append(
                f"{name} key span {animations[name]['authoredKeySpanSeconds']} "
                f"differs from {expected['keySpan']}"
            )
        if abs(
            animations[name]["gltfPlaybackDurationSeconds"] - expected["playback"]
        ) > 1e-5:
            failures.append(
                f"{name} playback duration "
                f"{animations[name]['gltfPlaybackDurationSeconds']} differs from "
                f"{expected['playback']}"
            )
    if not EXPECTED_BONES.issubset(joints):
        failures.append(f"missing bones: {sorted(EXPECTED_BONES - joints)}")
    if not EXPECTED_MORPHS.issubset(morphs):
        failures.append(f"missing morphs: {sorted(EXPECTED_MORPHS - morphs)}")
    if optimized_sha != public_sha:
        failures.append("optimized and public GLBs differ")
    if public_document != document:
        failures.append("optimized and public GLB JSON documents differ")
    if optimized_bytes >= 500 * 1024:
        failures.append(f"runtime GLB is {optimized_bytes} bytes, at or above 500 KiB")
    if document.get("images") or document.get("textures"):
        failures.append("unexpected external or embedded image texture payload")

    report = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "optimized": {
            "path": optimized_path,
            "bytes": optimized_bytes,
            "sha256": optimized_sha,
        },
        "public": {
            "path": public_path,
            "bytes": public_bytes,
            "sha256": public_sha,
        },
        "assetGenerator": document.get("asset", {}).get("generator"),
        "animations": animations,
        "bones": sorted(joints),
        "morphTargets": sorted(morphs),
        "triangleCount": triangle_count(document),
        "meshCount": len(document.get("meshes", [])),
        "materialCount": len(document.get("materials", [])),
        "imageCount": len(document.get("images", [])),
        "checks": {
            "optimizedAndPublicByteIdentical": optimized_sha == public_sha,
            "under500KiB": optimized_bytes < 500 * 1024,
            "allSevenClipsPresent": set(animations) == set(EXPECTED_CLIPS),
            "fiveJointRigPresent": EXPECTED_BONES.issubset(joints),
            "allMorphTargetsPresent": EXPECTED_MORPHS.issubset(morphs),
            "noTexturePayload": not document.get("images")
            and not document.get("textures"),
            "passed": not failures,
        },
        "failures": failures,
    }
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2, sort_keys=True)
        handle.write("\n")
    print("MERC_GLB_CONTRACT", output_path, "PASS" if not failures else "FAIL")
    if failures:
        raise RuntimeError("; ".join(failures))


main()
