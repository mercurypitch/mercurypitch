"""Run one bounded exact-union repair probe on the textured Celadon regeneration."""

from __future__ import annotations

from collections import Counter
import importlib.util
import json
from pathlib import Path

import bmesh
from mathutils import Vector


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
REPORT = HERE / "celadon-regenerated-union-probe.json"


def load_pipeline():
    path = ROOT / "finalize_vessels.py"
    spec = importlib.util.spec_from_file_location("celadon_regenerated_union_pipeline", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def clusters(obj) -> list[dict[str, object]]:
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    edges = {edge for edge in bm.edges if not edge.is_manifold or not edge.is_contiguous}
    remaining = set(edges)
    rows = []
    while remaining:
        first = remaining.pop()
        cluster_edges = {first}
        vertices = set(first.verts)
        pending = list(first.verts)
        while pending:
            vertex = pending.pop()
            for edge in vertex.link_edges:
                if edge not in remaining:
                    continue
                remaining.remove(edge)
                cluster_edges.add(edge)
                for other in edge.verts:
                    if other not in vertices:
                        vertices.add(other)
                        pending.append(other)
        low = Vector(min(vertex.co[axis] for vertex in vertices) for axis in range(3))
        high = Vector(max(vertex.co[axis] for vertex in vertices) for axis in range(3))
        incident = {face for edge in cluster_edges for face in edge.link_faces}
        rows.append(
            {
                "edges": len(cluster_edges),
                "vertices": len(vertices),
                "incidentFaces": len(incident),
                "linkedFaceCounts": dict(
                    sorted(Counter(len(edge.link_faces) for edge in cluster_edges).items())
                ),
                "boundsMetres": {
                    "min": list(low),
                    "max": list(high),
                    "dimensions": list(high - low),
                    "centre": list((low + high) * 0.5),
                },
            }
        )
    bm.free()
    return sorted(rows, key=lambda row: -row["edges"])


def main() -> None:
    pipeline = load_pipeline()
    donor = "meshy/celadon-lark-decanter-regenerated-v2.glb"
    path = ROOT / donor
    config = {"donor": donor, "donorSha256": pipeline.digest(path), "height": 1.15}
    obj, normalization = pipeline.normalized_import(config)
    source = pipeline.geometry_snapshot(obj)
    weld = pipeline.weld_and_triangulate(obj)
    before = pipeline.topology(obj)
    union = pipeline.exact_self_union(obj)
    pipeline.solid.remove_collapsed_components(obj)
    after = pipeline.topology(obj)
    residue = clusters(obj)
    fidelity = pipeline.fidelity(obj, source)
    low, high = pipeline.mesh_bounds([obj])
    source_low, source_high = source["bounds"]
    bounds_delta = max(
        max(abs(low[axis] - source_low[axis]) for axis in range(3)),
        max(abs(high[axis] - source_high[axis]) for axis in range(3)),
    )
    maximum_extent = max(
        (max(row["boundsMetres"]["dimensions"]) for row in residue), default=0.0
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
        "weld": weld,
        "before": before,
        "exactSelfUnion": union,
        "after": after,
        "residueClusters": residue,
        "residueMaximumExtentMetres": maximum_extent,
        "topologyPassed": pipeline.topology_passes(after),
        "boundedLocalRepairCandidate": (
            after["selfIntersectionPairs"] == 0
            and after["nonManifoldEdges"] <= 32
            and maximum_extent <= 0.03
        ),
        "fidelity": fidelity,
        "sourceBoundsMaxDeltaMetres": bounds_delta,
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print(
        "CELADON_REGENERATED_UNION_PROBE="
        + json.dumps(
            {
                "before": before,
                "after": after,
                "clusters": len(residue),
                "maximumExtentMetres": maximum_extent,
                "boundedCandidate": report["boundedLocalRepairCandidate"],
                "p99Metres": fidelity["sourceToFinalMetres"]["p99"],
                "maxMetres": fidelity["sourceToFinalMetres"]["max"],
                "boundsDeltaMetres": bounds_delta,
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
