"""Test one bounded local repair of the 25K Celadon exact-union residue."""

from __future__ import annotations

from collections import Counter
import importlib.util
import json
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
REPORT = HERE / "celadon-union-residue-probe.json"


def load_pipeline():
    path = ROOT / "finalize_vessels.py"
    spec = importlib.util.spec_from_file_location("celadon_union_residue_pipeline", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def clusters(edges: list[bmesh.types.BMEdge]) -> list[dict[str, object]]:
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
        rows.append(
            {
                "edges": len(cluster_edges),
                "vertices": len(vertices),
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
    return sorted(rows, key=lambda row: -row["edges"])


def main() -> None:
    pipeline = load_pipeline()
    donor = "meshy/celadon-lark-decanter-regenerated-v2-pre-remesh.glb"
    path = ROOT / donor
    config = {"donor": donor, "donorSha256": pipeline.digest(path), "height": 1.15}
    obj, normalization = pipeline.normalized_import(config)
    pipeline.weld_and_triangulate(obj)
    source = pipeline.geometry_snapshot(obj)
    decimation = pipeline.decimate(obj, 25000)
    pre_union = pipeline.topology(obj)
    union = pipeline.exact_self_union(obj)

    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bad_edges = [edge for edge in bm.edges if not edge.is_manifold or not edge.is_contiguous]
    cluster_report = clusters(bad_edges)
    incident_faces = {face for edge in bad_edges for face in edge.link_faces}
    max_cluster_extent = max(
        max(row["boundsMetres"]["dimensions"]) for row in cluster_report
    )
    if len(bad_edges) > 32 or max_cluster_extent > 0.03:
        bm.free()
        raise ValueError(
            "Exact-union residue exceeded bounded local repair limits: "
            + json.dumps({"edges": len(bad_edges), "maxExtentMetres": max_cluster_extent})
        )
    bmesh.ops.delete(bm, geom=list(incident_faces), context="FACES")
    wires = [edge for edge in bm.edges if not edge.link_faces]
    if wires:
        bmesh.ops.delete(bm, geom=wires, context="EDGES")
    boundary = [edge for edge in bm.edges if edge.is_boundary]
    fill = bmesh.ops.holes_fill(bm, edges=boundary, sides=0)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-7)
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()

    after = pipeline.topology(obj)
    fidelity = pipeline.fidelity(obj, source)
    low, high = pipeline.mesh_bounds([obj])
    source_low, source_high = source["bounds"]
    bounds_delta = max(
        max(abs(low[axis] - source_low[axis]) for axis in range(3)),
        max(abs(high[axis] - source_high[axis]) for axis in range(3)),
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
        "decimation": decimation,
        "preUnionTopology": pre_union,
        "exactSelfUnion": union,
        "residue": {
            "clusters": cluster_report,
            "badEdges": len(bad_edges),
            "deletedIncidentFaces": len(incident_faces),
            "boundaryEdgesAfterDelete": len(boundary),
            "createdPatchFaces": len(fill.get("faces", [])),
            "maximumClusterExtentMetres": max_cluster_extent,
            "limits": {"maximumBadEdges": 32, "maximumClusterExtentMetres": 0.03},
        },
        "afterTopology": after,
        "topologyPassed": pipeline.topology_passes(after),
        "fidelity": fidelity,
        "sourceBoundsMaxDeltaMetres": bounds_delta,
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print(
        "CELADON_UNION_RESIDUE_PROBE="
        + json.dumps(
            {
                "clusters": len(cluster_report),
                "badEdges": len(bad_edges),
                "deletedFaces": len(incident_faces),
                "maxExtentMetres": max_cluster_extent,
                "after": after,
                "p99Metres": fidelity["sourceToFinalMetres"]["p99"],
                "maxMetres": fidelity["sourceToFinalMetres"]["max"],
                "boundsDeltaMetres": bounds_delta,
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
