"""Render exact dense-source versus direct-derivative Cloudway V4 review proofs."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import sys

import bpy
from mathutils import Vector


HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import marble_runtime_common as COMMON  # noqa: E402
import render_marble_runtime_normal_review as REVIEW  # noqa: E402


RAW_4K = COMMON.V4 / "exports" / "cloudway-marble-ultra-v4-4k-blender.glb"
RAW_2K = COMMON.V4 / "exports" / "cloudway-marble-ultra-v4-2k-blender.glb"
BUILD_REPORT = COMMON.V4 / "production" / "cloudway-marble-runtime-v4-build.json"
PROOFS = COMMON.V4 / "proofs"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def import_candidate(path: Path) -> tuple[bpy.types.Object, bpy.types.Object, list[bpy.types.Object]]:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    roots = [
        obj
        for obj in imported
        if obj.parent is None and obj.name.startswith("Cloudway_Marble")
    ]
    if len(roots) != 1:
        raise ValueError(f"{path.name} lost its sole Cloudway_Marble root")
    meshes = [obj for obj in imported if obj.type == "MESH"]
    shells = [obj for obj in meshes if "DonorShell" in obj.name]
    if len(meshes) != 2 or len(shells) != 1:
        raise ValueError(f"{path.name} should contain one shell and one boundary")
    return roots[0], shells[0], meshes


def region_counts(obj: bpy.types.Object) -> dict[str, object]:
    regions = {
        "lowerOrnament": lambda point: point.z < -0.035,
        "frontBackArchitecture": lambda point: abs(point.y) > 0.50,
        "endArchitecture": lambda point: abs(point.x) > 0.74,
        "raisedRimOrFoliage": lambda point: point.z > 0.028,
        "broadCentralSlab": lambda point: (
            abs(point.x) <= 0.74 and abs(point.y) <= 0.50 and -0.035 <= point.z <= 0.028
        ),
    }
    counts = {name: 0 for name in regions}
    for polygon in obj.data.polygons:
        points = [obj.matrix_world @ obj.data.vertices[index].co for index in polygon.vertices]
        for name, predicate in regions.items():
            if any(predicate(point) for point in points):
                counts[name] += 1
    total = len(obj.data.polygons)
    return {
        "triangles": total,
        "regions": {
            name: {"triangles": count, "share": count / total}
            for name, count in counts.items()
        },
    }


def proof(path: Path) -> dict[str, object]:
    return {
        "file": COMMON.relative(path),
        "bytes": path.stat().st_size,
        "sha256": digest(path),
        "dimensions": [2400, 900],
    }


def clay_scene() -> tuple[dict[str, object], list[Path]]:
    scene, camera = REVIEW.setup()
    camera.data.ortho_scale = 4.75
    dense, _ = COMMON.import_single_mesh(COMMON.DENSE)
    dense_fit = COMMON.fit_to_v3_envelope(dense)
    bpy.context.view_layer.update()
    dense_regions = region_counts(dense)
    dense.location.x = -1.35
    dense.data.materials.clear()
    neutral_clay = REVIEW.material("matched neutral clay", (0.72, 0.72, 0.69))
    dense.data.materials.append(neutral_clay)
    root, shell, meshes = import_candidate(RAW_4K)
    bpy.context.view_layer.update()
    direct_regions = region_counts(shell)
    root.location.x = 1.35
    boundary_clay = REVIEW.material("direct boundary clay", (0.48, 0.46, 0.42))
    for obj in meshes:
        obj.data.materials.clear()
        obj.data.materials.append(boundary_clay if "LandingBoundary" in obj.name else neutral_clay)
    REVIEW.add_label("Dense 1.256M source", -1.35)
    REVIEW.add_label("Direct 238K derivative", 1.35)
    front = PROOFS / "marble-direct-dense-clay-front.png"
    angle = PROOFS / "marble-direct-dense-clay-three-quarter.png"
    REVIEW.render(scene, camera, (0.0, -7.0, 1.25), (0.0, 0.0, -0.11), front)
    print("DIRECT_CLAY_FRONT=" + str(front), flush=True)
    camera.data.ortho_scale = 5.0
    REVIEW.render(scene, camera, (5.2, -7.2, 3.0), (0.0, 0.0, -0.10), angle)
    print("DIRECT_CLAY_ANGLE=" + str(angle), flush=True)
    retention = {
        "method": "Triangles with any vertex inside each fitted coordinate region; regions overlap.",
        "dense": dense_regions,
        "direct": direct_regions,
        "directToDenseTriangleRatio": {
            name: direct_regions["regions"][name]["triangles"]
            / dense_regions["regions"][name]["triangles"]
            for name in dense_regions["regions"]
        },
        "directShareToDenseShare": {
            name: direct_regions["regions"][name]["share"]
            / dense_regions["regions"][name]["share"]
            for name in dense_regions["regions"]
        },
    }
    return {"denseFit": dense_fit, "regionRetention": retention}, [front, angle]


def pbr_scene() -> list[Path]:
    scene, camera = REVIEW.setup()
    dense, _ = COMMON.import_single_mesh(COMMON.DENSE)
    COMMON.fit_to_v3_envelope(dense)
    dense.location.x = -2.35
    root_4k, _, _ = import_candidate(RAW_4K)
    root_4k.location.x = 0.0
    root_2k, _, _ = import_candidate(RAW_2K)
    root_2k.location.x = 2.35
    REVIEW.add_label("Dense provider 4K", -2.35)
    REVIEW.add_label("Direct runtime 4K", 0.0)
    REVIEW.add_label("Direct runtime 2K", 2.35)
    front = PROOFS / "marble-direct-pbr-front.png"
    angle = PROOFS / "marble-direct-pbr-three-quarter.png"
    close = PROOFS / "marble-direct-pbr-front-close.png"
    REVIEW.render(scene, camera, (0.0, -7.0, 1.25), (0.0, 0.0, -0.11), front)
    print("DIRECT_PBR_FRONT=" + str(front), flush=True)
    camera.data.ortho_scale = 7.75
    REVIEW.render(scene, camera, (6.0, -8.0, 3.2), (0.0, 0.0, -0.10), angle)
    print("DIRECT_PBR_ANGLE=" + str(angle), flush=True)
    camera.data.ortho_scale = 4.5
    REVIEW.render(scene, camera, (0.0, -7.0, 0.55), (0.0, -0.18, -0.14), close)
    print("DIRECT_PBR_CLOSE=" + str(close), flush=True)
    return [front, angle, close]


def main() -> None:
    PROOFS.mkdir(parents=True, exist_ok=True)
    clay, clay_paths = clay_scene()
    pbr_paths = pbr_scene()
    build = json.loads(BUILD_REPORT.read_text())
    report = {
        "schema": 1,
        "asset": "cloudway-marble-ultra-v4-direct-dense-review",
        "decision": "rejected at matched clay/PBR visual gate; source-only retention",
        "sources": {
            "dense": {"file": COMMON.relative(COMMON.DENSE), "sha256": digest(COMMON.DENSE)},
            "direct4k": {"file": COMMON.relative(RAW_4K), "sha256": digest(RAW_4K)},
            "direct2k": {"file": COMMON.relative(RAW_2K), "sha256": digest(RAW_2K)},
            "buildReport": {"file": COMMON.relative(BUILD_REPORT), "sha256": digest(BUILD_REPORT)},
        },
        "clay": {
            "purpose": (
                "Matched dense-versus-direct geometry and exported split-normal comparison. "
                "No texture normal is attached to either neutral-clay material."
            ),
            "proofs": [proof(path) for path in clay_paths],
            **clay,
        },
        "pbr": {
            "purpose": (
                "Matched provider dense 4K versus exact direct 4K and 2K raw GLBs. Direct "
                "variants retain the provider normal directly; no selected-to-active bake or AO."
            ),
            "proofs": [proof(path) for path in pbr_paths],
            "textureMemory": {
                "4k": build["variants"]["4k"]["decodedTextureMemory"],
                "2k": build["variants"]["2k"]["decodedTextureMemory"],
            },
        },
        "render": {
            "engine": "Blender Eevee",
            "resolution": [2400, 900],
            "camera": "matched orthographic",
            "lighting": "matched warm/cool grazing area lights",
            "blender": bpy.app.version_string,
        },
        "rebuild": (
            "rtk proxy timeout 900 env ALSOFT_DRIVERS=null blender -b --factory-startup "
            "--python-exit-code 1 --python art/glass-adventure/platform-trials/v4/production/"
            "render_marble_dense_direct_review.py"
        ),
    }
    report_path = PROOFS / "marble-direct-dense-review.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n")
    print("DIRECT_DENSE_REVIEW=" + str(report_path), flush=True)


if __name__ == "__main__":
    main()
