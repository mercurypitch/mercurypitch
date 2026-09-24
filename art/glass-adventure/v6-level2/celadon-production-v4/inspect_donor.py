"""Measure the clean and textured Celadon donors before V4 retopology."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import math
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector


HERE = Path(__file__).resolve().parent
LEVEL = HERE.parent
CLEAN = LEVEL / "meshy" / "celadon-lark-decanter-regenerated-v2-pre-remesh.glb"
TEXTURED = LEVEL / "meshy" / "celadon-lark-decanter-regenerated-v2.glb"
REPORT = HERE / "donor-inspection.json"
HEIGHT = 1.15


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_pipeline():
    path = LEVEL / "finalize_vessels.py"
    spec = importlib.util.spec_from_file_location("celadon_v4_inspection_pipeline", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def normalized_import(pipeline, path: Path):
    return pipeline.normalized_import(
        {
            "donor": str(path.relative_to(LEVEL)),
            "donorSha256": digest(path),
            "height": HEIGHT,
        }
    )


def radial_hits(tree, z: float, angle: float, maximum: float = 0.5) -> list[float]:
    direction = Vector((math.cos(angle), math.sin(angle), 0.0))
    cursor = Vector((0.0, 0.0, z))
    travelled = 0.0
    hits = []
    while travelled < maximum and len(hits) < 12:
        location, _normal, _face, distance = tree.ray_cast(
            cursor, direction, maximum - travelled
        )
        if location is None or distance is None:
            break
        radial = math.hypot(location.x, location.y)
        if not hits or radial - hits[-1] > 1e-5:
            hits.append(radial)
        step = 2e-6
        cursor = location + direction * step
        travelled = math.hypot(cursor.x, cursor.y)
    return hits


def radial_report(pipeline, obj) -> list[dict[str, object]]:
    tree = pipeline.mesh_tree(obj)
    rows = []
    for z in np.linspace(0.002, HEIGHT - 0.002, 24):
        samples = [radial_hits(tree, float(z), math.tau * index / 32) for index in range(32)]
        counts = [len(sample) for sample in samples]
        columns = []
        for hit_index in range(max(counts, default=0)):
            values = [sample[hit_index] for sample in samples if len(sample) > hit_index]
            columns.append(
                {
                    "sampleCount": len(values),
                    "minimumMetres": min(values),
                    "medianMetres": float(np.median(values)),
                    "maximumMetres": max(values),
                }
            )
        rows.append(
            {
                "zMetres": float(z),
                "hitCounts": {str(count): counts.count(count) for count in sorted(set(counts))},
                "radialHits": columns,
            }
        )
    return rows


def top_profile(obj) -> dict[str, object]:
    sectors = 64
    buckets: list[list[float]] = [[] for _ in range(sectors)]
    for vertex in obj.data.vertices:
        if vertex.co.z < HEIGHT * 0.90:
            continue
        angle = math.atan2(vertex.co.y, vertex.co.x) % math.tau
        index = min(sectors - 1, int(angle / math.tau * sectors))
        buckets[index].append(float(vertex.co.z))
    maxima = [max(bucket) if bucket else None for bucket in buckets]
    populated = [value for value in maxima if value is not None]
    return {
        "sectors": sectors,
        "populated": len(populated),
        "minimumSectorMaximumMetres": min(populated),
        "maximumSectorMaximumMetres": max(populated),
        "sectorMaximumZMetres": maxima,
    }


def material_report(obj) -> list[dict[str, object]]:
    result = []
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
        result.append({"name": material.name, "images": images})
    return result


def main() -> None:
    pipeline = load_pipeline()
    clean, clean_normalization = normalized_import(pipeline, CLEAN)
    pipeline.weld_and_triangulate(clean)
    clean_snapshot = pipeline.geometry_snapshot(clean)
    clean_report = {
        "file": str(CLEAN.relative_to(LEVEL)),
        "bytes": CLEAN.stat().st_size,
        "sha256": digest(CLEAN),
        "normalization": clean_normalization,
        "topology": pipeline.topology(clean),
        "centralVerticalRayZMetres": pipeline.central_ray_hits(clean),
        "radialCrossSections": radial_report(pipeline, clean),
        "topRimProfile": top_profile(clean),
    }

    textured, textured_normalization = normalized_import(pipeline, TEXTURED)
    pipeline.weld_and_triangulate(textured)
    textured_report = {
        "file": str(TEXTURED.relative_to(LEVEL)),
        "bytes": TEXTURED.stat().st_size,
        "sha256": digest(TEXTURED),
        "normalization": textured_normalization,
        "topology": pipeline.topology(textured),
        "materials": material_report(textured),
        "uvLayers": [layer.name for layer in textured.data.uv_layers],
        "distanceToCleanMaster": pipeline.fidelity(textured, clean_snapshot),
    }
    report = {
        "schema": 1,
        "assetId": "celadon-lark-decanter",
        "purpose": "Establish whether the clean donor is a reliable shape/normal master and whether the textured donor remains close enough for atlas transfer.",
        "cleanProjectionMaster": clean_report,
        "texturedTransferSource": textured_report,
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print(
        "CELADON_V4_DONOR_INSPECTION="
        + json.dumps(
            {
                "cleanTriangles": clean_report["topology"]["triangles"],
                "cleanTopology": clean_report["topology"],
                "centralHits": clean_report["centralVerticalRayZMetres"],
                "texturedTriangles": textured_report["topology"]["triangles"],
                "texturedDistanceP95Metres": textured_report["distanceToCleanMaster"][
                    "sourceToFinalMetres"
                ]["p95"],
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
