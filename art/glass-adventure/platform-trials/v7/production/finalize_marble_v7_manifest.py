#!/usr/bin/env python3
"""Generate the V7 manifest from the final on-disk marble artifacts."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


HERE = Path(__file__).resolve().parent
V7 = HERE.parent
REPO = HERE.parents[4]
BUILD_REPORT = HERE / "dense-baseline-build-report.json"
AUDIT_REPORT = V7 / "proofs" / "diagnostics" / "dense-baseline-delivery-audit.json"
BROWSER_REPORT = V7 / "proofs" / "diagnostics" / "dense-baseline-browser-loader-smoke.json"
PACKED_BLEND = V7 / "sources" / "cloudway-marble-dense-baseline-v7.blend"
RAW_GLB = V7 / "exports" / "cloudway-marble-v7-dense-baseline-2k.glb"
DELIVERY = V7 / "exports" / "delivery" / "cloudway-marble-v7-dense-baseline-delivery-2k.glb"
VALIDATOR = V7 / "exports" / "delivery" / "cloudway-marble-v7-dense-baseline-delivery-2k-validator.txt"
MANIFEST = V7 / "manifest.json"


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def relative(path: Path) -> str:
    return str(path.relative_to(REPO))


def record(path: Path) -> dict[str, object]:
    return {"file": relative(path), "bytes": path.stat().st_size, "sha256": digest(path)}


def load(path: Path) -> dict[str, object]:
    return json.loads(path.read_text())


def main() -> None:
    build = load(BUILD_REPORT)
    audit = load(AUDIT_REPORT)
    browser = load(BROWSER_REPORT)
    if build.get("status") != "review-only exact dense baseline; runtime integration not authorized":
        raise ValueError("Unexpected baseline build status")
    if audit.get("status") != "passed" or browser.get("status") != "passed":
        raise ValueError("Delivery audit or browser smoke did not pass")
    delivery = record(DELIVERY)
    if audit["artifacts"]["delivery"] != {
        **delivery,
        "gzipBytes": audit["artifacts"]["delivery"]["gzipBytes"],
    }:
        raise ValueError("Delivery audit no longer matches the final GLB")
    if browser["artifact"] != delivery:
        raise ValueError("Browser smoke no longer matches the final GLB")
    packed = record(PACKED_BLEND)
    if build["artifacts"]["packedBlend"] != packed:
        raise ValueError("Build report no longer matches the packed Blender source")
    raw = record(RAW_GLB)
    if build["artifacts"]["raw2kGlb"] != raw:
        raise ValueError("Build report no longer matches the raw 2K GLB")
    if "no errors found" not in VALIDATOR.read_text().lower():
        raise ValueError("Khronos validator does not report zero errors")

    proof = {}
    for mode in ("clay", "pbr"):
        proof[mode] = {}
        for view in ("front", "three-quarter", "gameplay", "top", "side"):
            row = build["matchedProof"]["views"][mode][view]
            path = REPO / row["contactSheet"]["file"]
            current = record(path)
            if current != row["contactSheet"]:
                raise ValueError(f"Proof changed after build: {mode}/{view}")
            proof[mode][view] = current

    cost = audit["runtimeCost"]
    manifest = {
        "schema": 1,
        "asset": "Cloudway_Marble",
        "status": "review-ready exact-source quality baseline; runtime integration pending",
        "decision": (
            "Preserve the fitted dense donor because the reviewed semantic shell displaced arches, "
            "cut corner connections, and left fascia remnants."
        ),
        "source": {
            "file": build["source"]["file"],
            "bytes": build["source"]["bytes"],
            "sha256": build["source"]["sha256"],
            "authoringVertices": build["source"]["topologyBeforeFit"]["vertices"],
            "triangles": build["source"]["topologyBeforeFit"]["triangles"],
            "triangleIndicesInt32Sha256": build["source"]["topologyBeforeFit"][
                "triangleIndicesInt32Sha256"
            ],
        },
        "fit": build["fit"],
        "delivery": {
            **delivery,
            "root": "Cloudway_Marble",
            "meshes": cost["meshes"],
            "primitives": cost["primitives"],
            "triangles": cost["triangles"],
            "uploadedVertices": cost["uploadedVertices"],
            "requiredExtensions": cost["extensionsRequired"],
            "decoderRequired": False,
            "topologyReduction": False,
        },
        "packedSource": packed,
        "raw2kMaster": raw,
        "textures": build["textures"],
        "runtimeCost": {
            "geometryPayloadBytes": cost["geometryPayloadBytes"],
            "geometryPayloadMiB": cost["geometryPayloadMiB"],
            "decodedTextureWithMipmapsBytes": cost["decodedTextureWithMipmapsBytes"],
            "decodedTextureWithMipmapsMiB": cost["decodedTextureWithMipmapsMiB"],
            "estimatedGeometryPlusMippedTexturesMiB": cost[
                "estimatedGeometryPlusMippedTexturesMiB"
            ],
            "browserParseMilliseconds": browser["asset"]["parsedMilliseconds"],
            "browserTimingIsHostSpecific": True,
        },
        "quantization": audit["quantization"],
        "proofs": proof,
        "verification": {
            "buildReport": record(BUILD_REPORT),
            "deliveryAudit": record(AUDIT_REPORT),
            "browserLoaderSmoke": record(BROWSER_REPORT),
            "khronosValidator": record(VALIDATOR),
            "claySilhouetteIntersectionOverUnion": {
                view: build["matchedProof"]["views"]["clay"][view]["pixelComparison"][
                    "silhouetteIntersectionOverUnion"
                ]
                for view in ("front", "three-quarter", "gameplay", "top", "side")
            },
        },
        "reviewBoundary": {
            "installed": False,
            "mobileDefaultDeclaredReady": False,
            "reason": (
                "The exact source is the visual quality baseline; its measured 44.28 MB transfer "
                "and 94.47 MiB decoded geometry-plus-texture estimate require owner cost review."
            ),
        },
        "excluded": [
            "authored reconstruction rejected at clay review",
            "whole-shell collapse, decimation, or remesh",
            "visible-surface flatten",
            "provider call or credit use",
            "runtime/public installation",
            "commit or push",
        ],
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print("V7_MARBLE_MANIFEST=" + json.dumps(record(MANIFEST)), flush=True)


if __name__ == "__main__":
    main()
