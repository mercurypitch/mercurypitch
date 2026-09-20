"""Audit exact-union repair and bounded LODs from the recovered Celadon source."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import bpy


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent


def load_pipeline():
    path = ROOT / "finalize_vessels.py"
    spec = importlib.util.spec_from_file_location("celadon_vessel_pipeline", path)
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


def main() -> None:
    pipeline = load_pipeline()
    config = {
        "donor": "meshy/celadon-lark-decanter-pre-remesh.glb",
        "donorSha256": "34e4883dd62c2f1bdd09e7b899e6cd624ba51592e5da0358a1f8c72344f96f24",
        "height": 1.15,
    }
    obj, normalization = pipeline.normalized_import(config)
    source = pipeline.geometry_snapshot(obj)
    weld = pipeline.weld_and_triangulate(obj)
    union = pipeline.exact_self_union(obj)
    collapsed = pipeline.solid.remove_collapsed_components(obj)
    repaired = pipeline.topology(obj)
    repaired_fidelity = pipeline.fidelity(obj, source)
    lods = []
    for target in (12000, 9000):
        candidate = copy_object(obj, f"celadon_lod_{target}")
        decimation = pipeline.decimate(candidate, target)
        low, high = pipeline.mesh_bounds([candidate])
        source_low, source_high = source["bounds"]
        bounds_delta = max(
            max(abs(low[axis] - source_low[axis]) for axis in range(3)),
            max(abs(high[axis] - source_high[axis]) for axis in range(3)),
        )
        lods.append(
            {
                "targetTriangles": target,
                "decimation": decimation,
                "topology": pipeline.topology(candidate),
                "fidelity": pipeline.fidelity(candidate, source),
                "boundsMetres": {"min": list(low), "max": list(high)},
                "sourceBoundsMaxDeltaMetres": bounds_delta,
            }
        )
    report = {
        "schema": 1,
        "assetId": "celadon-lark-decanter",
        "source": {
            "file": config["donor"],
            "bytes": (ROOT / config["donor"]).stat().st_size,
            "sha256": config["donorSha256"],
        },
        "normalization": normalization,
        "weld": weld,
        "exactSelfUnion": union,
        "collapsedComponents": collapsed,
        "repairedTopology": repaired,
        "repairedFidelity": repaired_fidelity,
        "lods": lods,
    }
    path = HERE / "celadon-source-repair-probe.json"
    path.write_text(json.dumps(report, indent=2) + "\n")
    print("CELADON_SOURCE_REPAIR_PROBE=" + json.dumps(report), flush=True)


if __name__ == "__main__":
    main()
