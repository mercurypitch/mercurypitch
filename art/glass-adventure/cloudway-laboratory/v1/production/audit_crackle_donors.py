#!/usr/bin/env python3
"""Audit dense crackle donors without modifying their packed Blender masters."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import tempfile
from typing import Any

import bpy
from mathutils import Vector
import numpy as np


HERE = Path(__file__).resolve().parent
KIT = HERE.parent
SOURCE = Path(
    os.environ.get("GLASS_SOURCE_ROOT", str(KIT / "source-assets"))
).expanduser().resolve()
MIRRORS = HERE / "reports"
ASSETS = {
    "rose-quartz-crackle-fast": {
        "root": "Cloudway_RoseQuartzCrackleFast_DenseMaster",
        "review": "rose-quartz-crackle-fast__normalized_review",
    },
    "amethyst-crackle-slow": {
        "root": "Cloudway_AmethystCrackleSlow_DenseMaster",
        "review": "amethyst-crackle-slow__normalized_review",
    },
}


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def durable_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=path.parent
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(value, handle, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def mesh_arrays(mesh: bpy.types.Mesh) -> tuple[np.ndarray, np.ndarray]:
    mesh.calc_loop_triangles()
    positions = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
    triangles = np.empty(len(mesh.loop_triangles) * 3, dtype=np.int32)
    mesh.vertices.foreach_get("co", positions)
    mesh.loop_triangles.foreach_get("vertices", triangles)
    return positions.reshape((-1, 3)), triangles.reshape((-1, 3))


def world_positions(positions: np.ndarray, obj: bpy.types.Object) -> np.ndarray:
    matrix = np.asarray([list(row) for row in obj.matrix_world], dtype=np.float64)
    return positions.astype(np.float64) @ matrix[:3, :3].T + matrix[:3, 3]


def edge_incidence(triangles: np.ndarray, vertex_count: int) -> dict[str, Any]:
    first = np.concatenate(
        (triangles[:, 0], triangles[:, 1], triangles[:, 2])
    ).astype(np.uint64, copy=False)
    second = np.concatenate(
        (triangles[:, 1], triangles[:, 2], triangles[:, 0])
    ).astype(np.uint64, copy=False)
    low = np.minimum(first, second)
    high = np.maximum(first, second)
    nonzero = low != high
    collapsed = int((~nonzero).sum())
    low = low[nonzero]
    high = high[nonzero]
    direction = first[nonzero] < second[nonzero]
    codes = low * np.uint64(vertex_count) + high
    order = np.argsort(codes)
    codes = codes[order]
    direction = direction[order]
    starts = np.concatenate(
        (np.array([0], dtype=np.int64), np.flatnonzero(np.diff(codes)) + 1)
    )
    counts = np.diff(np.append(starts, len(codes)))
    forward_counts = np.add.reduceat(direction.astype(np.int8), starts)
    two_face = counts == 2
    inconsistent = two_face & ((forward_counts == 0) | (forward_counts == 2))
    return {
        "uniqueEdges": int(len(starts)),
        "boundaryEdges": int((counts == 1).sum()),
        "twoFaceEdges": int(two_face.sum()),
        "nonManifoldEdges": int((counts > 2).sum()),
        "inconsistentTwoFaceOrientationEdges": int(inconsistent.sum()),
        "maximumFaceIncidence": int(counts.max(initial=0)),
        "collapsedTriangleEdges": collapsed,
        "closedOrientedTwoManifold": bool(
            (counts == 1).sum() == 0
            and (counts > 2).sum() == 0
            and inconsistent.sum() == 0
            and collapsed == 0
        ),
    }


def connected_components(
    triangles: np.ndarray, vertex_count: int
) -> dict[str, Any]:
    parent = list(range(vertex_count))
    sizes = [1] * vertex_count

    def root(value: int) -> int:
        while parent[value] != value:
            parent[value] = parent[parent[value]]
            value = parent[value]
        return value

    def join(first: int, second: int) -> None:
        first_root = root(first)
        second_root = root(second)
        if first_root == second_root:
            return
        if sizes[first_root] < sizes[second_root]:
            first_root, second_root = second_root, first_root
        parent[second_root] = first_root
        sizes[first_root] += sizes[second_root]

    for first, second, third in triangles:
        join(int(first), int(second))
        join(int(first), int(third))
    counts: dict[int, int] = {}
    for vertex in range(vertex_count):
        component = root(vertex)
        counts[component] = counts.get(component, 0) + 1
    ordered = sorted(counts.values(), reverse=True)
    return {
        "count": len(ordered),
        "largestVertexCounts": ordered[:12],
        "largestVertexFractions": [
            round(value / max(vertex_count, 1), 9) for value in ordered[:12]
        ],
        "interpretation": (
            "Exact-position connectivity can disprove UV-chart fragmentation, but "
            "does not assign crystal or gold semantics."
        ),
    }


def welded_topology(
    positions: np.ndarray, triangles: np.ndarray
) -> dict[str, Any]:
    unique_positions, inverse, duplicate_counts = np.unique(
        positions, axis=0, return_inverse=True, return_counts=True
    )
    remapped = inverse[triangles]
    valid = (
        (remapped[:, 0] != remapped[:, 1])
        & (remapped[:, 1] != remapped[:, 2])
        & (remapped[:, 2] != remapped[:, 0])
    )
    incidence = edge_incidence(remapped[valid], len(unique_positions))
    components = connected_components(remapped[valid], len(unique_positions))
    return {
        "method": (
            "Exact float32 position welding only. It reconnects duplicated UV/normal "
            "seams without merging merely nearby authored geometry."
        ),
        "sourceVertices": int(len(positions)),
        "uniquePositionVertices": int(len(unique_positions)),
        "duplicatedPositionVertices": int(len(positions) - len(unique_positions)),
        "largestCoincidentVertexMultiplicity": int(duplicate_counts.max(initial=0)),
        "trianglesCollapsedByExactWeld": int((~valid).sum()),
        "edgeIncidence": incidence,
        "connectedComponents": components,
    }


def quantiles(values: list[float]) -> dict[str, float] | None:
    if not values:
        return None
    array = np.asarray(values, dtype=np.float64)
    values_at = np.quantile(array, (0.0, 0.05, 0.5, 0.95, 1.0))
    return {
        label: round(float(value), 6)
        for label, value in zip(("min", "p05", "median", "p95", "max"), values_at)
    }


def vertical_samples(obj: bpy.types.Object, positions: np.ndarray) -> dict[str, Any]:
    low = positions.min(axis=0).astype(np.float64)
    high = positions.max(axis=0).astype(np.float64)
    dimensions = high - low
    margin = 0.07
    sample_count = 31
    xs = np.linspace(low[0] + dimensions[0] * margin, high[0] - dimensions[0] * margin, sample_count)
    ys = np.linspace(low[1] + dimensions[1] * margin, high[1] - dimensions[1] * margin, sample_count)
    ray_margin = max(float(dimensions[2]), 0.1)
    down = Vector((0.0, 0.0, -1.0))
    up = Vector((0.0, 0.0, 1.0))
    matrix = obj.matrix_world
    plane_z = float(obj.get("landingCandidateBlenderZ", 0.0))
    top_offsets_mm: list[float] = []
    thickness_mm: list[float] = []
    misses = 0
    unpaired = 0
    for x in xs:
        for y in ys:
            top_hit, top_location, _normal, _face = obj.ray_cast(
                Vector((float(x), float(y), float(high[2] + ray_margin))), down
            )
            if not top_hit:
                misses += 1
                continue
            top_world = matrix @ top_location
            top_offsets_mm.append((float(top_world.z) - plane_z) * 1000.0)
            bottom_hit, bottom_location, _normal, _face = obj.ray_cast(
                Vector((float(x), float(y), float(low[2] - ray_margin))), up
            )
            if not bottom_hit:
                unpaired += 1
                continue
            bottom_world = matrix @ bottom_location
            thickness_mm.append((float(top_world.z) - float(bottom_world.z)) * 1000.0)
    total = sample_count * sample_count
    offsets = np.asarray(top_offsets_mm, dtype=np.float64)
    return {
        "method": (
            "A 31x31 vertical-ray grid over the inset 86% of the source XY bounds. "
            "Top offsets include raised ornament and are not a collider definition."
        ),
        "samples": total,
        "topHits": len(top_offsets_mm),
        "topCoverage": round(len(top_offsets_mm) / total, 6),
        "misses": misses,
        "pairedTopBottomHits": len(thickness_mm),
        "unpairedTopHits": unpaired,
        "topOffsetFromLandingPlaneMillimetres": quantiles(top_offsets_mm),
        "topHitsWithin2mmOfLandingPlaneFraction": round(
            float((np.abs(offsets) <= 2.0).mean()) if len(offsets) else 0.0, 6
        ),
        "topHitsWithin5mmOfLandingPlaneFraction": round(
            float((np.abs(offsets) <= 5.0).mean()) if len(offsets) else 0.0, 6
        ),
        "visualThicknessMillimetres": quantiles(thickness_mm),
    }


def material_record(mesh: bpy.types.Mesh) -> dict[str, Any]:
    material_indices = np.empty(len(mesh.polygons), dtype=np.int32)
    mesh.polygons.foreach_get("material_index", material_indices)
    materials = []
    for material in mesh.materials:
        if material is None:
            continue
        materials.append(
            {
                "name": material.name,
                "surfaceRenderMethod": material.surface_render_method,
                "sourceAppearance": material.get("sourceAppearance"),
                "glassTransmissionAuthored": material.get(
                    "glassTransmissionAuthored"
                ),
            }
        )
    return {
        "slotCount": len(mesh.materials),
        "materials": materials,
        "faceMaterialIndices": sorted(int(value) for value in np.unique(material_indices)),
        "uvLayers": [layer.name for layer in mesh.uv_layers],
        "semanticMaterialSlotsPresent": False,
        "interpretation": (
            "The provider's single opaque PBR slot spans crystal and gold. Metallic "
            "pixels and UV or connectivity islands are not semantic role evidence."
        ),
    }


def audit(asset: str) -> dict[str, Any]:
    config = ASSETS[asset]
    master = SOURCE / "blender" / asset / f"{asset}-dense-master.blend"
    dense_report_path = MIRRORS / f"{asset}-dense-master.json"
    dense_report = json.loads(dense_report_path.read_text())
    expected_master = dense_report["packedBlend"]
    if digest(master) != expected_master["sha256"]:
        raise ValueError(f"{asset}: packed master differs from its accepted report")
    bpy.ops.wm.open_mainfile(filepath=str(master), load_ui=False)
    root = bpy.data.objects.get(config["root"])
    review = bpy.data.objects.get(config["review"])
    if root is None or review is None or review.type != "MESH":
        raise ValueError(f"{asset}: expected dense-master hierarchy is missing")
    if review.parent != root or not bool(review.get("topologyPreserved")):
        raise ValueError(f"{asset}: normalized review no longer preserves its source")
    positions, triangles = mesh_arrays(review.data)
    world = world_positions(positions, review)
    raw_incidence = edge_incidence(triangles, len(positions))
    welded = welded_topology(positions, triangles)
    sample = vertical_samples(review, positions)
    bounds_low = world.min(axis=0)
    bounds_high = world.max(axis=0)
    result = {
        "schema": "cloudway-crackle-donor-feasibility/v1",
        "assetId": asset,
        "status": "read-only donor audit; no semantic derivative accepted",
        "scope": {
            "master": expected_master["file"],
            "masterSha256": expected_master["sha256"],
            "masterBytes": expected_master["bytes"],
            "sourceTopologyMutation": False,
            "semanticDerivativeWritten": False,
        },
        "geometry": {
            "vertices": int(len(positions)),
            "triangles": int(len(triangles)),
            "boundsMetresBlenderZUp": {
                "min": [round(float(value), 9) for value in bounds_low],
                "max": [round(float(value), 9) for value in bounds_high],
                "dimensions": [
                    round(float(value), 9) for value in bounds_high - bounds_low
                ],
            },
            "reportedLooseConnectivity": dense_report["geometry"][
                "connectedComponents"
            ],
            "sourceIndexTopology": raw_incidence,
            "exactPositionWeldAudit": welded,
        },
        "surface": {
            "materialContract": material_record(review.data),
            "reportedContactCandidate": dense_report["contactCandidate"],
            "verticalRayAudit": sample,
        },
        "semanticReadiness": {
            "crystalBodyRole": "missing",
            "goldClaspRole": "missing",
            "authoredClosedShards": "missing",
            "safeAutomaticClassification": False,
            "blockingReason": (
                "Crystal, gold framework, and ornament share one opaque material and "
                "one unlabeled mesh. Authored semantic face regions and closed shard "
                "volumes are required before runtime material or fracture binding."
            ),
        },
    }
    external = SOURCE / "production" / asset / "crackle-feasibility.json"
    mirror = MIRRORS / f"{asset}-crackle-feasibility.json"
    durable_json(external, result)
    durable_json(mirror, result)
    if digest(master) != expected_master["sha256"]:
        raise RuntimeError(f"{asset}: packed master changed during read-only audit")
    return result


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", choices=sorted(ASSETS), required=True)
    argv = list(__import__("sys").argv)
    return parser.parse_args(argv[argv.index("--") + 1 :] if "--" in argv else [])


def main() -> None:
    options = arguments()
    result = audit(options.asset)
    print(
        "CRACKLE_AUDIT="
        + json.dumps(
            {
                "assetId": options.asset,
                "weldedTopology": result["geometry"]["exactPositionWeldAudit"][
                    "edgeIncidence"
                ],
                "contact": result["surface"]["verticalRayAudit"],
            },
            separators=(",", ":"),
        )
    )


if __name__ == "__main__":
    main()
