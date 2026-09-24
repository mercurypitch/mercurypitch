#!/usr/bin/env python3
"""Render hash-bound V3 versus Meshy 7.1 Ultra 4K Frost or Glide auditions."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import sys
from typing import Any

import bpy
from mathutils import Vector


HERE = Path(__file__).resolve().parent
V5 = HERE.parent
TRIALS = V5.parent
V3 = TRIALS / "v3"
V4 = TRIALS / "v4"
REPO = HERE.parents[4]
V3_MANIFEST = V3 / "exports" / "manifest.json"
V3_MODEL = V3 / "exports" / "cloudway-platform-kit-v3.glb"
PROOFS = V5 / "proofs"

EXPECTED_V3_MANIFEST_SHA256 = (
    "d3f5c1c136c4964f2cc8b3e1d7ed34a3664c861fd7c8d0b831e0c193894d76f0"
)
EXPECTED_V3_MODEL_SHA256 = (
    "5daf655fd51f8c4ac93342c20024d3df803ecef0cbc6d2a4c48bcb85bedf25fe"
)
EXPECTED_V3_BYTES = 42_929_408
EXPECTED_GUIDES = {
    "frost": {
        "file": "art/glass-adventure/platform-trials/v2/guides/frost-platform-guide.png",
        "bytes": 1_126_005,
        "sha256": "f79a6e0de0bf2fe87c66443aa7abd87911d0377b59e872ff4fd91c9c3c525f45",
    },
    "glide": {
        "file": "art/glass-adventure/platform-trials/v2/guides/glide-platform-guide.png",
        "bytes": 1_269_012,
        "sha256": "70acf421f63536dc18ca09f507fcf22b736647c7d92878bd3130b8b567f830c4",
    },
}


@dataclass(frozen=True)
class Asset:
    name: str
    asset_id: str
    v3_root: str
    v3_triangles: int

    @property
    def receipt(self) -> Path:
        return V5 / "meshy" / f"{self.name}-ultra4k" / "receipt.json"

    @property
    def model(self) -> Path:
        return V5 / "meshy" / f"{self.name}-ultra4k" / "dense-donor.glb"

    @property
    def report(self) -> Path:
        return PROOFS / f"{self.name}-ultra4k-v3-source-comparison.json"


ASSETS = {
    "frost": Asset(
        name="frost",
        asset_id="cloudway-frost-platform-meshy71-ultra4k-v5",
        v3_root="Cloudway_Frost",
        v3_triangles=35_032,
    ),
    "glide": Asset(
        name="glide",
        asset_id="cloudway-glide-platform-meshy71-ultra4k-v5",
        v3_root="Cloudway_Glide",
        v3_triangles=35_032,
    ),
}


def load_helpers():
    path = V4 / "production" / "render_ultra4k_v3_comparison.py"
    spec = importlib.util.spec_from_file_location("platform_trials_v4_comparison_helpers", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


H = load_helpers()


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def relative(path: Path) -> str:
    return str(path.relative_to(REPO))


def load_object(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object in {relative(path)}")
    return value


def require_file(path: Path, label: str) -> None:
    if not path.is_file() or path.stat().st_size <= 0:
        raise FileNotFoundError(f"{label} is missing: {relative(path)}")


def validate_sources(asset: Asset) -> dict[str, Any]:
    for path, label in (
        (asset.receipt, f"{asset.name} Ultra receipt"),
        (asset.model, f"{asset.name} Ultra dense donor"),
        (V3_MANIFEST, "V3 manifest"),
        (V3_MODEL, "V3 source platform kit"),
    ):
        require_file(path, label)
    if digest(V3_MANIFEST) != EXPECTED_V3_MANIFEST_SHA256:
        raise ValueError("V3 source manifest changed")
    if V3_MODEL.stat().st_size != EXPECTED_V3_BYTES or digest(V3_MODEL) != EXPECTED_V3_MODEL_SHA256:
        raise ValueError("V3 source platform kit changed")

    receipt = load_object(asset.receipt)
    if (
        receipt.get("state") != "archived"
        or receipt.get("assetId") != asset.asset_id
        or receipt.get("operation") != "image-to-3d"
    ):
        raise ValueError(f"{asset.name} receipt is not the archived V5 audition")
    task_id = receipt.get("taskId")
    if not isinstance(task_id, str) or not task_id:
        raise ValueError(f"{asset.name} receipt has no provider task ID")
    guide = EXPECTED_GUIDES[asset.name]
    if receipt.get("source", {}).get("file") != guide["file"]:
        raise ValueError(f"{asset.name} receipt names a different guide")
    for key in ("bytes", "sha256"):
        if receipt.get("source", {}).get(key) != guide[key]:
            raise ValueError(f"{asset.name} guide {key} changed")

    request = receipt.get("request")
    if not isinstance(request, dict):
        raise ValueError(f"{asset.name} receipt has no fixed request")
    expected_request = {
        "model_type": "standard",
        "ai_model": "meshy-7.1",
        "geometry_resolution": "4k",
        "should_remesh": False,
        "should_texture": True,
        "texture_resolution": "4k",
        "enable_pbr": True,
        "image_enhancement": True,
        "target_formats": ["glb"],
        "alpha_thumbnail": True,
    }
    for key, value in expected_request.items():
        if request.get(key) != value:
            raise ValueError(f"{asset.name} request drifted at {key}")
    if not isinstance(request.get("texture_prompt"), str) or not request["texture_prompt"]:
        raise ValueError(f"{asset.name} texture prompt is missing")

    final_status = receipt.get("finalStatus")
    if (
        not isinstance(final_status, dict)
        or final_status.get("status") != "SUCCEEDED"
        or int(final_status.get("consumed_credits", -1)) != 35
    ):
        raise ValueError(f"{asset.name} provider task is not a successful 35-credit task")
    confirmation = receipt.get("providerConfirmation")
    if (
        not isinstance(confirmation, dict)
        or confirmation.get("requestedAiModel") != "meshy-7.1"
        or confirmation.get("requestedGeometryResolution") != "4k"
        or confirmation.get("returnedGeometryResolution") not in (None, "4k")
    ):
        raise ValueError(f"{asset.name} provider confirmation changed")

    archive = receipt.get("archiveDownload")
    if not isinstance(archive, dict) or archive.get("missingRequestedPbrMaps") != []:
        raise ValueError(f"{asset.name} archive is missing requested PBR maps")
    archive_model = archive.get("model")
    if not isinstance(archive_model, dict):
        raise ValueError(f"{asset.name} archive has no model record")
    if (
        archive_model.get("file") != relative(asset.model)
        or archive_model.get("bytes") != asset.model.stat().st_size
        or archive_model.get("sha256") != digest(asset.model)
    ):
        raise ValueError(f"{asset.name} model differs from its receipt")

    ultra = H.glb_inventory(asset.model, None)
    for key in ("bytes", "sha256", "triangles", "referencedVertices"):
        if ultra.get(key) != archive_model.get(key):
            raise ValueError(f"{asset.name} model {key} differs from its receipt")
    external_maps = H.external_map_inventory(receipt)

    manifest = load_object(V3_MANIFEST)
    source = manifest.get("bundle", {}).get("sourceQuality", {})
    if (
        source.get("source") != relative(V3_MODEL)
        or source.get("bytes") != EXPECTED_V3_BYTES
        or source.get("sha256") != EXPECTED_V3_MODEL_SHA256
    ):
        raise ValueError("V3 manifest no longer identifies the source-quality kit")
    matches = [
        node
        for node in manifest.get("nodes", [])
        if isinstance(node, dict) and node.get("name") == asset.v3_root
    ]
    if len(matches) != 1 or int(matches[0].get("triangles", -1)) != asset.v3_triangles:
        raise ValueError(f"V3 manifest no longer identifies {asset.v3_root}")
    visual = matches[0].get("visualBoundsGlTfYUpMetres")
    if not isinstance(visual, dict):
        raise ValueError(f"V3 visual bounds are absent for {asset.v3_root}")
    v3_dimensions = [
        float(visual["max"][axis]) - float(visual["min"][axis]) for axis in range(3)
    ]
    target_width = v3_dimensions[0]
    if not math.isclose(target_width, 1.8, rel_tol=0.0, abs_tol=0.01):
        raise ValueError(f"V3 {asset.name} source width changed unexpectedly")

    v3 = H.glb_inventory(V3_MODEL, asset.v3_root)
    if int(v3["triangles"]) != asset.v3_triangles:
        raise ValueError(f"V3 {asset.name} GLB triangle count differs from its manifest")
    return {
        "targetDisplayWidthMetres": target_width,
        "v3VisualDimensionsGlTfYUpMetres": v3_dimensions,
        "v3Manifest": {
            "file": relative(V3_MANIFEST),
            "bytes": V3_MANIFEST.stat().st_size,
            "sha256": EXPECTED_V3_MANIFEST_SHA256,
        },
        "ultraReceipt": {
            "file": relative(asset.receipt),
            "bytes": asset.receipt.stat().st_size,
            "sha256": digest(asset.receipt),
            "taskId": task_id,
            "credits": 35,
            "providerConfirmation": confirmation,
        },
        "v3": v3,
        "ultra": ultra,
        "ultraExternalMaps": external_maps,
    }


def render_mode(
    asset: Asset, mode: str, source: dict[str, Any]
) -> tuple[list[dict[str, Any]], list[Path]]:
    scene, camera = H.setup_scene()
    neutral = H.clay_material() if mode == "clay" else None
    target_width = float(source["targetDisplayWidthMetres"])
    order = [f"Current V3 {asset.name} source", "Meshy 7.1 Ultra 4K dense donor"]
    rows = [
        H.import_for_display(
            order[0],
            V3_MODEL,
            asset.v3_root,
            target_width,
            H.DISPLAY_CENTRES_X[0],
            neutral,
            asset.v3_triangles,
        ),
        H.import_for_display(
            order[1],
            asset.model,
            None,
            target_width,
            H.DISPLAY_CENTRES_X[1],
            neutral,
            int(source["ultra"]["triangles"]),
        ),
    ]
    PROOFS.mkdir(parents=True, exist_ok=True)
    front = PROOFS / f"{asset.name}-ultra4k-v3-{mode}-front.png"
    angle = PROOFS / f"{asset.name}-ultra4k-v3-{mode}-three-quarter.png"
    target = Vector((0.0, 0.0, 0.31))
    camera.data.ortho_scale = H.FRONT_ORTHO_SCALE
    H.render(scene, camera, target, (0.0, -6.2, 1.75), front)
    camera.data.ortho_scale = H.ANGLE_ORTHO_SCALE
    H.render(scene, camera, target, (4.5, -6.4, 2.25), angle)
    return rows, [front, angle]


def proof_record(path: Path) -> dict[str, Any]:
    return H.proof_record(path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", choices=sorted(ASSETS), required=True)
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(argv)


def main() -> None:
    asset = ASSETS[parse_args().asset]
    source = validate_sources(asset)
    groups: list[dict[str, Any]] = []
    all_proofs: list[Path] = []
    authoritative_rows: list[dict[str, Any]] | None = None
    order = [f"Current V3 {asset.name} source", "Meshy 7.1 Ultra 4K dense donor"]
    for mode in ("clay", "textured"):
        rows, proofs = render_mode(asset, mode, source)
        if authoritative_rows is None:
            authoritative_rows = rows
        elif rows != authoritative_rows:
            raise ValueError("Clay and textured imports produced different source measurements")
        groups.append(
            {
                "mode": mode,
                "order": order,
                "sameScale": True,
                "sameCameraAndLighting": True,
                "proofs": [proof_record(path) for path in proofs],
            }
        )
        all_proofs.extend(proofs)

    if authoritative_rows is None:
        raise ValueError("Comparison produced no source measurements")
    source_scene = V5 / "sources" / f"{asset.name}-ultra4k-source-review.blend"
    source_scene.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.file.pack_all()
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(source_scene), check_existing=False)
    v3_dimensions = authoritative_rows[0]["displayDimensionsBlenderZUpMetres"]
    ultra_dimensions = authoritative_rows[1]["displayDimensionsBlenderZUpMetres"]
    depth_delta_percent = (float(ultra_dimensions[1]) / float(v3_dimensions[1]) - 1.0) * 100.0
    height_delta_percent = (float(ultra_dimensions[2]) / float(v3_dimensions[2]) - 1.0) * 100.0

    report = {
        "schema": 1,
        "asset": f"cloudway-{asset.name}-platform-source-audition-v5",
        "purpose": (
            f"Source-only same-scale comparison of the current V3 {asset.name} platform and "
            "the archived Meshy 7.1 Ultra 4K dense donor. No remesh, bake, runtime export or "
            "public integration is performed."
        ),
        "decision": {
            "state": "pending-source-review",
            "candidate": relative(asset.model),
            "runtimeIntegrationAuthorized": False,
            "requiredReview": [
                "Compare silhouette, top-plane safety, corners, underside forms and motif coherence in neutral clay.",
                "Compare PBR region separation, baked-light contamination, seams and guide fidelity.",
                "Reject or accept only as a dense high-detail donor for a later professional high-to-low workflow.",
            ],
        },
        "normalization": {
            "method": (
                f"Uniformly scale each source to the current V3 {asset.name} visual X width, "
                "preserve aspect ratio, center in X/Y, then ground minimum Blender Z at zero."
            ),
            "targetWidthMetres": source["targetDisplayWidthMetres"],
            "axisWiseStretching": False,
        },
        "shapeFitAudit": {
            "v3DisplayDimensionsBlenderZUpMetres": v3_dimensions,
            "ultraDisplayDimensionsBlenderZUpMetres": ultra_dimensions,
            "ultraDepthDeltaPercent": round(depth_delta_percent, 2),
            "ultraHeightDeltaPercent": round(height_delta_percent, 2),
            "gameplayColliderMetres": [1.70, 1.30, 0.24],
            "interpretation": (
                "Matched width exposes depth and height drift. Landing contact and collider fit "
                "remain later authored low-mesh gates and are not inferred from equal width."
            ),
        },
        "order": order,
        "sourceMeasurements": authoritative_rows,
        "sourceArchives": {
            "v3Manifest": source["v3Manifest"],
            "ultraReceipt": source["ultraReceipt"],
        },
        "packedSourceReviewScene": {
            "file": relative(source_scene),
            "bytes": source_scene.stat().st_size,
            "sha256": digest(source_scene),
            "purpose": "Packed comparison scene with unchanged source topology and uniformly matched display width; not a runtime export.",
        },
        "glbInventories": {
            "currentV3": source["v3"],
            "ultra4kDense": source["ultra"],
        },
        "ultraExternalPbrMaps": source["ultraExternalMaps"],
        "groups": groups,
        "proofFiles": [proof_record(path) for path in all_proofs],
        "render": {
            "engine": "Cycles CPU",
            "samples": 16,
            "seed": 23,
            "cpuThreads": 8,
            "resolution": [1800, 1000],
            "camera": "orthographic",
            "blender": bpy.app.version_string,
        },
        "command": (
            "rtk proxy timeout 3600 env ALSOFT_DRIVERS=null blender -b --factory-startup "
            "--python-exit-code 1 --python "
            "art/glass-adventure/platform-trials/v5/production/"
            "render_ultra4k_v3_comparison.py -- --asset "
            + asset.name
        ),
    }
    asset.report.write_text(json.dumps(report, indent=2) + "\n")
    print("ULTRA4K_V3_SOURCE_COMPARISON=" + json.dumps(report), flush=True)
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
