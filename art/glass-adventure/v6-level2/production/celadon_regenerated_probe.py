"""Measure the regenerated Celadon donors before production finishing."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import bpy


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
REPORT = HERE / "celadon-regenerated-probe.json"


def load_pipeline():
    path = ROOT / "finalize_vessels.py"
    spec = importlib.util.spec_from_file_location("celadon_regenerated_pipeline", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def material_report(obj: bpy.types.Object) -> list[dict[str, object]]:
    rows = []
    for material in obj.data.materials:
        if material is None:
            continue
        images = []
        if material.use_nodes:
            for node in material.node_tree.nodes:
                if node.type == "TEX_IMAGE" and node.image is not None:
                    images.append(
                        {
                            "name": node.image.name,
                            "dimensions": [int(node.image.size[0]), int(node.image.size[1])],
                            "colorSpace": node.image.colorspace_settings.name,
                        }
                    )
        rows.append({"name": material.name, "images": images})
    return rows


def audit(pipeline, role: str, relative: str) -> dict[str, object]:
    path = ROOT / relative
    config = {"donor": relative, "donorSha256": pipeline.digest(path), "height": 1.15}
    obj, normalization = pipeline.normalized_import(config)
    raw = {
        "vertices": len(obj.data.vertices),
        "polygons": len(obj.data.polygons),
        "triangles": sum(max(1, len(face.vertices) - 2) for face in obj.data.polygons),
        "materials": material_report(obj),
        "uvLayers": [layer.name for layer in obj.data.uv_layers],
        "topology": pipeline.topology(obj),
        "centralVerticalRayZMetres": pipeline.central_ray_hits(obj),
    }
    weld = pipeline.weld_and_triangulate(obj)
    post_weld = pipeline.topology(obj)
    return {
        "role": role,
        "source": {
            "file": relative,
            "bytes": path.stat().st_size,
            "sha256": pipeline.digest(path),
        },
        "normalization": normalization,
        "raw": raw,
        "weld": weld,
        "postWeldTopology": post_weld,
        "productionSurfaceCandidate": pipeline.topology_passes(post_weld),
    }


def main() -> None:
    pipeline = load_pipeline()
    report = {
        "schema": 1,
        "assetId": "celadon-lark-decanter",
        "method": "Fresh Blender GLB import, 1.15 m bottom-centre normalization, 0.1 micrometre coincident weld, triangulation, closedness/orientation/self-intersection checks, and central vertical-ray sampling.",
        "sources": [
            audit(
                pipeline,
                "regenerated_game_donor",
                "meshy/celadon-lark-decanter-regenerated-v2.glb",
            ),
            audit(
                pipeline,
                "regenerated_pre_remesh",
                "meshy/celadon-lark-decanter-regenerated-v2-pre-remesh.glb",
            ),
            audit(
                pipeline,
                "provider_remesh_35k_v3",
                "meshy/celadon-lark-decanter-remesh-35k-v3.glb",
            ),
        ],
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print(
        "CELADON_REGENERATED_PROBE="
        + json.dumps(
            {
                row["role"]: {
                    "triangles": row["postWeldTopology"]["triangles"],
                    "nonManifoldEdges": row["postWeldTopology"]["nonManifoldEdges"],
                    "selfIntersectionPairs": row["postWeldTopology"]["selfIntersectionPairs"],
                    "candidate": row["productionSurfaceCandidate"],
                }
                for row in report["sources"]
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
