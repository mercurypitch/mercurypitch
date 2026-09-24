"""Probe bounded Blender reductions and exact-union cleanup from clean Celadon."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import bpy


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
REPORT = HERE / "celadon-clean-decimate-probe.json"


def load_pipeline():
    path = ROOT / "finalize_vessels.py"
    spec = importlib.util.spec_from_file_location("celadon_clean_decimate_pipeline", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def copy_object(source: bpy.types.Object, name: str) -> bpy.types.Object:
    result = source.copy()
    result.data = source.data.copy()
    result.name = name
    bpy.context.scene.collection.objects.link(result)
    return result


def bounds_delta(pipeline, obj, source) -> float:
    low, high = pipeline.mesh_bounds([obj])
    source_low, source_high = source["bounds"]
    return max(
        max(abs(low[axis] - source_low[axis]) for axis in range(3)),
        max(abs(high[axis] - source_high[axis]) for axis in range(3)),
    )


def main() -> None:
    pipeline = load_pipeline()
    donor = "meshy/celadon-lark-decanter-regenerated-v2-pre-remesh.glb"
    path = ROOT / donor
    config = {"donor": donor, "donorSha256": pipeline.digest(path), "height": 1.15}
    obj, normalization = pipeline.normalized_import(config)
    pipeline.weld_and_triangulate(obj)
    source = pipeline.geometry_snapshot(obj)
    source_check = pipeline.topology(obj)
    candidates = []
    for target in (25000, 16000):
        reduced = copy_object(obj, f"celadon_blender_decimate_{target}")
        reduction = pipeline.decimate(reduced, target)
        reduced_check = pipeline.topology(reduced)
        reduced_fidelity = pipeline.fidelity(reduced, source)
        reduced_bounds_delta = bounds_delta(pipeline, reduced, source)
        union = pipeline.exact_self_union(reduced)
        pipeline.solid.remove_collapsed_components(reduced)
        union_check = pipeline.topology(reduced)
        candidates.append(
            {
                "targetTriangles": target,
                "decimation": reduction,
                "decimatedTopology": reduced_check,
                "decimatedFidelity": reduced_fidelity,
                "decimatedBoundsMaxDeltaMetres": reduced_bounds_delta,
                "exactSelfUnion": union,
                "postUnionTopology": union_check,
                "postUnionTopologyPassed": pipeline.topology_passes(union_check),
                "postUnionFidelity": pipeline.fidelity(reduced, source),
                "postUnionBoundsMaxDeltaMetres": bounds_delta(pipeline, reduced, source),
            }
        )
    report = {
        "schema": 1,
        "assetId": "celadon-lark-decanter",
        "source": {
            "file": donor,
            "bytes": path.stat().st_size,
            "sha256": pipeline.digest(path),
        },
        "normalization": normalization,
        "sourceTopology": source_check,
        "method": "Blender collapse decimation from the clean source, followed by a diagnostic exact self-union. No candidate is accepted without fresh strict topology and fidelity checks.",
        "candidates": candidates,
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print(
        "CELADON_CLEAN_DECIMATE_PROBE="
        + json.dumps(
            {
                str(row["targetTriangles"]): {
                    "decimated": {
                        "triangles": row["decimatedTopology"]["triangles"],
                        "nonManifoldEdges": row["decimatedTopology"]["nonManifoldEdges"],
                        "selfIntersections": row["decimatedTopology"]["selfIntersectionPairs"],
                    },
                    "union": {
                        "triangles": row["postUnionTopology"]["triangles"],
                        "nonManifoldEdges": row["postUnionTopology"]["nonManifoldEdges"],
                        "selfIntersections": row["postUnionTopology"]["selfIntersectionPairs"],
                        "passed": row["postUnionTopologyPassed"],
                    },
                }
                for row in candidates
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
