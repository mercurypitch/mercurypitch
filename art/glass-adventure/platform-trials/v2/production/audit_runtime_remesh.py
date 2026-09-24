"""Audit and render the Meshy 7k runtime remeshes before Blender finishing."""

from __future__ import annotations

import json
from pathlib import Path
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))

from audit_meshy_donors import (
    apply_world,
    bounds,
    digest,
    dominant_landing_height,
    render,
    reset,
    topology,
)


HERE = Path(__file__).resolve().parent
ART = HERE.parent
REPORT = ART / "proofs" / "meshy-runtime-remesh-audit.json"
ASSETS = {
    "marble": ART / "meshy" / "marble" / "runtime-remesh.glb",
    "frost": ART / "meshy" / "frost" / "runtime-remesh.glb",
    "glide": ART / "meshy" / "glide" / "runtime-remesh.glb",
}


def join_meshes(meshes: list[bpy.types.Object]) -> bpy.types.Object:
    for obj in meshes:
        apply_world(obj)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    joined = bpy.context.object
    joined.name = "runtime_remesh_audit"
    return joined


def main() -> None:
    report: dict[str, object] = {
        "schema": 1,
        "purpose": "Meshy 7k runtime remesh audit before authored normalization and kit assembly.",
        "blender": bpy.app.version_string,
        "assets": {},
    }
    for asset, source in ASSETS.items():
        reset()
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(source))
        imported = [obj for obj in bpy.data.objects if obj not in before]
        meshes = [obj for obj in imported if obj.type == "MESH"]
        if not meshes:
            raise ValueError(f"{asset} has no mesh")
        obj = join_meshes(meshes)
        low, high = bounds(obj)
        landing = dominant_landing_height(obj)
        proof = render(f"{asset}-runtime-remesh", obj, float(landing["z"]))
        report["assets"][asset] = {
            "source": str(source.relative_to(ART)),
            "bytes": source.stat().st_size,
            "sha256": digest(source),
            "sourceMeshCount": len(meshes),
            "materials": [material.name for material in obj.data.materials],
            "uvLayers": [layer.name for layer in obj.data.uv_layers],
            "rawBoundsBlenderZUp": {"min": list(low), "max": list(high)},
            "rawDimensions": list(high - low),
            "landingPlaneCandidate": landing,
            "topology": topology(obj),
            "proof": {
                "file": str(proof.relative_to(ART)),
                "bytes": proof.stat().st_size,
                "sha256": digest(proof),
            },
        }
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print("CLOUDWAY_RUNTIME_REMESH_AUDIT=" + json.dumps({"report": str(REPORT)}), flush=True)


if __name__ == "__main__":
    main()
