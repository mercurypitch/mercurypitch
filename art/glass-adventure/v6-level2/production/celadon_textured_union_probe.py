"""Audit a bounded exact-union repair of the textured 9K Celadon donor."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent


def load_pipeline():
    path = ROOT / "finalize_vessels.py"
    spec = importlib.util.spec_from_file_location("celadon_textured_pipeline", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> None:
    pipeline = load_pipeline()
    config = {
        "donor": "meshy/celadon-lark-decanter-donor.glb",
        "donorSha256": "7b1c1a1f712f13b005458ae306fbbd54e7bc808d36fc5ff9614245efd6b31e4b",
        "height": 1.15,
    }
    obj, normalization = pipeline.normalized_import(config)
    source = pipeline.geometry_snapshot(obj)
    weld = pipeline.weld_and_triangulate(obj)
    union = pipeline.exact_self_union(obj)
    collapsed = pipeline.solid.remove_collapsed_components(obj)
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
        "finalTopology": pipeline.topology(obj),
        "fidelity": pipeline.fidelity(obj, source),
    }
    path = HERE / "celadon-textured-union-probe.json"
    path.write_text(json.dumps(report, indent=2) + "\n")
    print("CELADON_TEXTURED_UNION_PROBE=" + json.dumps(report), flush=True)


if __name__ == "__main__":
    main()
