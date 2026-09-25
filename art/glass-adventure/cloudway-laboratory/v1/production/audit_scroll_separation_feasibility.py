#!/usr/bin/env python3
"""Audit whether the dense gilt scroll can separate without cutting its surface."""

from __future__ import annotations

import argparse
import bmesh
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import sys
from typing import Any, Iterable

import bpy
from mathutils import Matrix, Vector
import numpy as np


HERE = Path(__file__).resolve().parent
PREPARE_PATH = HERE / "prepare_dense_master.py"


def load_prepare() -> Any:
    spec = importlib.util.spec_from_file_location(
        "cloudway_prepare_dense_master", PREPARE_PATH
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load prepare_dense_master.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


PREPARE = load_prepare()
SOURCE = PREPARE.SOURCE
ASSET = "gilt-scroll-bridge"
CUT_Y = 0.30
MIN_LENGTH_RATIO = 0.25
SOURCE_TO_CANONICAL_Z_DEGREES = -90.0
ROLE_ORDER = ("negativeRoller", "deck", "positiveRoller")
ROLE_COLORS = {
    "negativeRoller": (1.0, 0.18, 0.04),
    "deck": (0.02, 0.65, 1.0),
    "positiveRoller": (0.88, 0.03, 0.72),
}
ROLE_BITS = {role: 1 << index for index, role in enumerate(ROLE_ORDER)}
SOURCE_VERTEX_ID = "cloudway_source_vertex_id"
SOURCE_POLYGON_ID = "cloudway_source_polygon_id"
SOURCE_LOOP_ID = "cloudway_source_loop_id"


def paths() -> dict[str, Path]:
    asset_dir = SOURCE / "blender" / ASSET
    proof_dir = SOURCE / "proofs" / "blender" / ASSET / "separation-feasibility"
    report_dir = SOURCE / "production" / ASSET
    return {
        "baseline": asset_dir / f"{ASSET}-dense-master.blend",
        "baselineReport": HERE / "reports" / f"{ASSET}-dense-master.json",
        "proofDir": proof_dir,
        "report": report_dir / "scroll-separation-feasibility-report.json",
        "mirror": HERE / "reports" / f"{ASSET}-scroll-separation-feasibility.json",
    }


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def digest_array(values: np.ndarray) -> str:
    return hashlib.sha256(np.ascontiguousarray(values).tobytes()).hexdigest()


def percentile_rows(values: np.ndarray) -> dict[str, float | int | None]:
    if len(values) == 0:
        return {"count": 0, "min": None, "median": None, "p95": None, "max": None}
    return {
        "count": int(len(values)),
        "min": round(float(values.min()), 9),
        "median": round(float(np.median(values)), 9),
        "p95": round(float(np.percentile(values, 95)), 9),
        "max": round(float(values.max()), 9),
    }


class UnionFind:
    def __init__(self, count: int) -> None:
        self.parent = np.arange(count, dtype=np.int32)
        self.size = np.ones(count, dtype=np.int32)

    def root(self, value: int) -> int:
        while self.parent[value] != value:
            self.parent[value] = self.parent[self.parent[value]]
            value = int(self.parent[value])
        return value

    def union(self, first_value: int, second_value: int) -> None:
        first = self.root(first_value)
        second = self.root(second_value)
        if first == second:
            return
        if self.size[first] < self.size[second]:
            first, second = second, first
        self.parent[second] = first
        self.size[first] += self.size[second]

    def labels(self) -> np.ndarray:
        for value in range(len(self.parent)):
            self.parent[value] = self.root(value)
        _, labels = np.unique(self.parent, return_inverse=True)
        return labels.astype(np.int32)


def mesh_edges(mesh: bpy.types.Mesh) -> np.ndarray:
    values = np.empty(len(mesh.edges) * 2, dtype=np.int32)
    mesh.edges.foreach_get("vertices", values)
    return values.reshape((-1, 2))


def connected_labels(vertex_count: int, edges: np.ndarray) -> np.ndarray:
    graph = UnionFind(vertex_count)
    for first_value, second_value in edges:
        graph.union(int(first_value), int(second_value))
    return graph.labels()


def corner_uvs(mesh: bpy.types.Mesh) -> np.ndarray:
    require(len(mesh.uv_layers) == 1, "Expected exactly one source UV layer")
    values = np.empty(len(mesh.loops) * 2, dtype=np.float32)
    mesh.uv_layers[0].data.foreach_get("uv", values)
    return values.reshape((-1, 2))


def encoded_custom_normals(mesh: bpy.types.Mesh) -> np.ndarray:
    attribute = mesh.attributes.get("custom_normal")
    require(attribute is not None, "Source custom_normal corner attribute is absent")
    require(attribute.domain == "CORNER", "Source custom normals are not per-corner")
    require(attribute.data_type == "INT16_2D", "Unexpected custom normal encoding")
    values = np.empty(len(attribute.data) * 2, dtype=np.int16)
    attribute.data.foreach_get("value", values)
    return values.reshape((-1, 2))


def evaluated_corner_normals(mesh: bpy.types.Mesh) -> np.ndarray:
    require(mesh.has_custom_normals, "Source mesh no longer reports custom normals")
    values = np.empty(len(mesh.corner_normals) * 3, dtype=np.float32)
    mesh.corner_normals.foreach_get("vector", values)
    return values.reshape((-1, 3))


def source_payload(mesh: bpy.types.Mesh) -> dict[str, Any]:
    positions, triangles = PREPARE.mesh_arrays(mesh)
    require(len(mesh.polygons) == len(triangles), "Source polygons are not triangles")
    require(
        all(len(polygon.vertices) == 3 for polygon in mesh.polygons),
        "Source contains a non-triangle polygon",
    )
    uvs = corner_uvs(mesh)
    encoded_normals = encoded_custom_normals(mesh)
    corner_normals = evaluated_corner_normals(mesh)
    return {
        "positions": positions,
        "triangles": triangles,
        "uvs": uvs,
        "encodedNormals": encoded_normals,
        "cornerNormals": corner_normals,
        "fingerprints": {
            "vertexPositionsFloat32Sha256": digest_array(positions),
            "triangleIndicesInt32Sha256": digest_array(triangles),
            "cornerUvsFloat32Sha256": digest_array(uvs),
            "customCornerNormalsInt16Sha256": digest_array(encoded_normals),
            "evaluatedCornerNormalsFloat32Sha256": digest_array(corner_normals),
        },
    }


def component_partition(
    positions: np.ndarray,
    triangles: np.ndarray,
    edges: np.ndarray,
) -> dict[str, Any]:
    labels = connected_labels(len(positions), edges)
    component_count = int(labels.max()) + 1
    counts = np.bincount(labels, minlength=component_count)
    centres_y = np.zeros(component_count, dtype=np.float64)
    low_y = np.full(component_count, np.inf, dtype=np.float64)
    high_y = np.full(component_count, -np.inf, dtype=np.float64)
    np.add.at(centres_y, labels, positions[:, 1])
    np.minimum.at(low_y, labels, positions[:, 1])
    np.maximum.at(high_y, labels, positions[:, 1])
    centres_y /= counts
    component_regions = np.where(
        centres_y < -CUT_Y,
        0,
        np.where(centres_y > CUT_Y, 2, 1),
    ).astype(np.int32)
    vertex_regions = component_regions[labels]
    triangle_components = labels[triangles[:, 0]]
    require(
        np.all(labels[triangles] == triangle_components[:, None]),
        "An indexed connected component contains a mixed triangle",
    )
    triangle_regions = component_regions[triangle_components]
    region_rows: dict[str, Any] = {}
    for role_id, role in enumerate(ROLE_ORDER):
        vertex_mask = vertex_regions == role_id
        triangle_mask = triangle_regions == role_id
        points = positions[vertex_mask]
        region_rows[role] = {
            "indexedComponentCount": int(np.count_nonzero(component_regions == role_id)),
            "indexedVertices": int(vertex_mask.sum()),
            "triangles": int(triangle_mask.sum()),
            "sourceBounds": {
                "min": [round(float(value), 9) for value in points.min(axis=0)],
                "max": [round(float(value), 9) for value in points.max(axis=0)],
            },
        }

    first = positions[triangles[:, 0], 1]
    second = positions[triangles[:, 1], 1]
    third = positions[triangles[:, 2], 1]
    triangle_low = np.minimum(np.minimum(first, second), third)
    triangle_high = np.maximum(np.maximum(first, second), third)
    boundary_rows: dict[str, Any] = {}
    for name, plane in (("negative", -CUT_Y), ("positive", CUT_Y)):
        component_crossing = (low_y < plane) & (high_y > plane)
        triangle_crossing = (triangle_low < plane) & (triangle_high > plane)
        boundary_rows[name] = {
            "sourcePlaneY": plane,
            "indexedComponentsCrossingPlane": int(component_crossing.sum()),
            "trianglesCrossingPlane": int(triangle_crossing.sum()),
        }
    return {
        "vertexLabels": labels,
        "vertexRegions": vertex_regions,
        "triangleRegions": triangle_regions,
        "componentRegions": component_regions,
        "componentCount": component_count,
        "regions": region_rows,
        "planes": boundary_rows,
    }


def role_mask_name(mask: int) -> str:
    return "+".join(
        role for role in ROLE_ORDER if mask & ROLE_BITS[role]
    ) or "none"


def boundary_graph_summary(
    edges: np.ndarray,
    positions: np.ndarray,
    nominal_plane_y: float | None,
) -> dict[str, Any]:
    if len(edges) == 0:
        return {
            "edges": 0,
            "vertices": 0,
            "connectedNetworks": 0,
            "closedLoops": 0,
            "openChains": 0,
            "branchedNetworks": 0,
        }
    vertices = np.unique(edges)
    local_edges = np.searchsorted(vertices, edges)
    graph = UnionFind(len(vertices))
    for first_value, second_value in local_edges:
        graph.union(int(first_value), int(second_value))
    labels = graph.labels()
    edge_labels = labels[local_edges[:, 0]]
    degree = np.bincount(local_edges.reshape(-1), minlength=len(vertices))
    component_count = int(labels.max()) + 1
    loops = 0
    chains = 0
    branched = 0
    maximum_edges = 0
    for component in range(component_count):
        vertex_mask = labels == component
        component_degrees = degree[vertex_mask]
        edge_count = int(np.count_nonzero(edge_labels == component))
        maximum_edges = max(maximum_edges, edge_count)
        if np.all(component_degrees == 2):
            loops += 1
        elif (
            np.count_nonzero(component_degrees == 1) == 2
            and not np.any(component_degrees > 2)
        ):
            chains += 1
        else:
            branched += 1
    points = positions[vertices]
    lengths = np.linalg.norm(
        positions[edges[:, 1]] - positions[edges[:, 0]], axis=1
    )
    row: dict[str, Any] = {
        "edges": int(len(edges)),
        "vertices": int(len(vertices)),
        "connectedNetworks": component_count,
        "closedLoops": loops,
        "openChains": chains,
        "branchedNetworks": branched,
        "endpoints": int(np.count_nonzero(degree == 1)),
        "branchVertices": int(np.count_nonzero(degree > 2)),
        "maximumEdgesInOneNetwork": maximum_edges,
        "totalRawEdgeLength": round(float(lengths.sum()), 9),
        "sourceBounds": {
            "min": [round(float(value), 9) for value in points.min(axis=0)],
            "max": [round(float(value), 9) for value in points.max(axis=0)],
        },
    }
    if nominal_plane_y is not None:
        deviations = np.abs(points[:, 1] - nominal_plane_y)
        row["distanceFromNominalPlaneRaw"] = percentile_rows(deviations)
        row["verticesWithin1e-4RawOfPlane"] = int(
            np.count_nonzero(deviations <= 1e-4)
        )
    return row


def gap_summary(
    positions: np.ndarray,
    role_masks: np.ndarray,
    first_role: str,
    second_role: str,
    scale: float,
) -> dict[str, Any]:
    mask = (
        ((role_masks & ROLE_BITS[first_role]) != 0)
        & ((role_masks & ROLE_BITS[second_role]) != 0)
    )
    y_values = positions[mask, 1].astype(np.float64)
    ratio = MIN_LENGTH_RATIO

    def moved_y(role: str) -> np.ndarray:
        if role == "deck":
            return y_values * ratio
        if role == "negativeRoller":
            return y_values + CUT_Y * (1.0 - ratio)
        if role == "positiveRoller":
            return y_values - CUT_Y * (1.0 - ratio)
        raise ValueError(role)

    gaps = np.abs(moved_y(first_role) - moved_y(second_role)) * scale
    return {
        **percentile_rows(gaps),
        "units": "metres",
        "coincidentWithin0.1Millimetre": int(np.count_nonzero(gaps <= 0.0001)),
        "separatedBeyond1Centimetre": int(np.count_nonzero(gaps > 0.01)),
    }


def welded_analysis(
    positions: np.ndarray,
    triangles: np.ndarray,
    indexed_edges: np.ndarray,
    triangle_regions: np.ndarray,
    scale: float,
) -> dict[str, Any]:
    welded_positions, index_to_welded = np.unique(
        positions, axis=0, return_inverse=True
    )
    welded_indexed_edges = np.sort(index_to_welded[indexed_edges], axis=1)
    welded_indexed_edges = welded_indexed_edges[
        welded_indexed_edges[:, 0] != welded_indexed_edges[:, 1]
    ]
    welded_indexed_edges = np.unique(welded_indexed_edges, axis=0)
    welded_labels = connected_labels(len(welded_positions), welded_indexed_edges)
    welded_component_count = int(welded_labels.max()) + 1
    welded_component_sizes = np.bincount(welded_labels)

    welded_triangles = index_to_welded[triangles]
    role_masks = np.zeros(len(welded_positions), dtype=np.uint8)
    for corner in range(3):
        np.bitwise_or.at(
            role_masks,
            welded_triangles[:, corner],
            (1 << triangle_regions).astype(np.uint8),
        )

    edge_rows = np.concatenate(
        (
            welded_triangles[:, (0, 1)],
            welded_triangles[:, (1, 2)],
            welded_triangles[:, (2, 0)],
        ),
        axis=0,
    )
    edge_roles = np.concatenate((triangle_regions, triangle_regions, triangle_regions))
    edge_rows = np.sort(edge_rows, axis=1)
    nonzero = edge_rows[:, 0] != edge_rows[:, 1]
    edge_rows = edge_rows[nonzero]
    edge_roles = edge_roles[nonzero]
    unique_edges, inverse, incident_counts = np.unique(
        edge_rows, axis=0, return_inverse=True, return_counts=True
    )
    edge_role_masks = np.zeros(len(unique_edges), dtype=np.uint8)
    np.bitwise_or.at(
        edge_role_masks,
        inverse,
        (1 << edge_roles).astype(np.uint8),
    )

    mask_counts = {
        role_mask_name(mask): int(np.count_nonzero(role_masks == mask))
        for mask in range(1, 8)
        if np.any(role_masks == mask)
    }
    edge_mask_counts = {
        role_mask_name(mask): int(np.count_nonzero(edge_role_masks == mask))
        for mask in range(1, 8)
        if np.any(edge_role_masks == mask)
    }
    pairs = (
        ("negativeRoller", "deck", -CUT_Y),
        ("deck", "positiveRoller", CUT_Y),
        ("negativeRoller", "positiveRoller", None),
    )
    boundary_rows: dict[str, Any] = {}
    gap_rows: dict[str, Any] = {}
    for first_role, second_role, plane in pairs:
        key = f"{first_role}+{second_role}"
        both = (
            ((edge_role_masks & ROLE_BITS[first_role]) != 0)
            & ((edge_role_masks & ROLE_BITS[second_role]) != 0)
        )
        boundary_rows[key] = boundary_graph_summary(
            unique_edges[both], welded_positions, plane
        )
        gap_rows[key] = gap_summary(
            welded_positions,
            role_masks,
            first_role,
            second_role,
            scale,
        )

    plane_rows: dict[str, Any] = {}
    for name, plane in (("negative", -CUT_Y), ("positive", CUT_Y)):
        first_y = welded_positions[unique_edges[:, 0], 1]
        second_y = welded_positions[unique_edges[:, 1], 1]
        crossings = ((first_y < plane) & (second_y > plane)) | (
            (first_y > plane) & (second_y < plane)
        )
        plane_rows[name] = {
            "sourcePlaneY": plane,
            "weldedEdgesStrictlyCrossingPlane": int(np.count_nonzero(crossings)),
        }

    require(welded_component_count == 1, "Expected exact-position weld to be connected")
    return {
        "positions": welded_positions,
        "indexToWelded": index_to_welded,
        "uniquePositionCount": int(len(welded_positions)),
        "indexedVertexCount": int(len(positions)),
        "duplicateIndexedVerticesAtExactPositions": int(
            len(positions) - len(welded_positions)
        ),
        "componentCountAfterExactPositionWeld": welded_component_count,
        "largestWeldedComponentPositions": int(welded_component_sizes.max()),
        "componentCountAtAnyNonnegativeTolerance": 1,
        "toleranceInference": (
            "Exact equal-position welding is already one connected component; "
            "allowing any positive positional tolerance can only add connections."
        ),
        "positionRoleMaskCounts": mask_counts,
        "edgeRoleMaskCounts": edge_mask_counts,
        "weldedEdges": int(len(unique_edges)),
        "weldedEdgeIncidentTriangleCounts": {
            "one": int(np.count_nonzero(incident_counts == 1)),
            "two": int(np.count_nonzero(incident_counts == 2)),
            "moreThanTwo": int(np.count_nonzero(incident_counts > 2)),
        },
        "crossRoleBoundaryGraphs": boundary_rows,
        "minimumRetractionSharedPositionGaps": gap_rows,
        "cutPlaneEvidence": plane_rows,
    }


def add_source_id_attributes(mesh: bpy.types.Mesh) -> None:
    definitions = (
        (SOURCE_VERTEX_ID, "POINT", len(mesh.vertices)),
        (SOURCE_POLYGON_ID, "FACE", len(mesh.polygons)),
        (SOURCE_LOOP_ID, "CORNER", len(mesh.loops)),
    )
    for name, domain, count in definitions:
        require(mesh.attributes.get(name) is None, f"Source already has {name}")
        attribute = mesh.attributes.new(name, "INT", domain)
        attribute.data.foreach_set("value", np.arange(count, dtype=np.int32))


def split_mesh(
    template: bpy.types.Mesh,
    vertex_regions: np.ndarray,
    region: int,
    name: str,
) -> bpy.types.Mesh:
    result = template.copy()
    result.name = name
    edit = bmesh.new()
    edit.from_mesh(result)
    edit.verts.ensure_lookup_table()
    id_layer = edit.verts.layers.int.get(SOURCE_VERTEX_ID)
    require(id_layer is not None, "BMesh lost source vertex IDs")
    rejected = [
        vertex
        for vertex in edit.verts
        if vertex_regions[int(vertex[id_layer])] != region
    ]
    bmesh.ops.delete(edit, geom=rejected, context="VERTS")
    edit.to_mesh(result)
    edit.free()
    result.update()
    require(result.has_custom_normals, f"{name} lost custom normals")
    return result


def attribute_values(mesh: bpy.types.Mesh, name: str, count: int) -> np.ndarray:
    attribute = mesh.attributes.get(name)
    require(attribute is not None, f"{mesh.name} lacks {name}")
    values = np.empty(count, dtype=np.int32)
    attribute.data.foreach_get("value", values)
    return values


def reassembled_payload(
    source_mesh: bpy.types.Mesh,
    parts: dict[str, bpy.types.Mesh],
) -> dict[str, Any]:
    source = source_payload(source_mesh)
    position_counts = np.zeros(len(source_mesh.vertices), dtype=np.uint8)
    polygon_counts = np.zeros(len(source_mesh.polygons), dtype=np.uint8)
    loop_counts = np.zeros(len(source_mesh.loops), dtype=np.uint8)
    positions = np.empty_like(source["positions"])
    triangles = np.empty_like(source["triangles"])
    uvs = np.empty_like(source["uvs"])
    encoded_normals = np.empty_like(source["encodedNormals"])
    corner_normals = np.empty_like(source["cornerNormals"])
    for role in ROLE_ORDER:
        mesh = parts[role]
        vertex_ids = attribute_values(mesh, SOURCE_VERTEX_ID, len(mesh.vertices))
        polygon_ids = attribute_values(mesh, SOURCE_POLYGON_ID, len(mesh.polygons))
        loop_ids = attribute_values(mesh, SOURCE_LOOP_ID, len(mesh.loops))
        position_counts[vertex_ids] += 1
        polygon_counts[polygon_ids] += 1
        loop_counts[loop_ids] += 1
        values = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
        mesh.vertices.foreach_get("co", values)
        positions[vertex_ids] = values.reshape((-1, 3))
        for polygon, source_polygon_id in zip(mesh.polygons, polygon_ids):
            triangles[source_polygon_id] = vertex_ids[list(polygon.vertices)]
        uvs[loop_ids] = corner_uvs(mesh)
        encoded_normals[loop_ids] = encoded_custom_normals(mesh)
        corner_normals[loop_ids] = evaluated_corner_normals(mesh)
    require(np.all(position_counts == 1), "Diagnostic split vertex coverage differs")
    require(np.all(polygon_counts == 1), "Diagnostic split face coverage differs")
    require(np.all(loop_counts == 1), "Diagnostic split corner coverage differs")
    fingerprints = {
        "vertexPositionsFloat32Sha256": digest_array(positions),
        "triangleIndicesInt32Sha256": digest_array(triangles),
        "cornerUvsFloat32Sha256": digest_array(uvs),
        "customCornerNormalsInt16Sha256": digest_array(encoded_normals),
        "evaluatedCornerNormalsFloat32Sha256": digest_array(corner_normals),
    }
    require(fingerprints == source["fingerprints"], "Diagnostic split changed source channels")
    return {
        "purpose": "Rejected chart-component motion diagnostic only",
        "positionsCoveredExactlyOnce": int(np.count_nonzero(position_counts == 1)),
        "trianglesCoveredExactlyOnce": int(np.count_nonzero(polygon_counts == 1)),
        "cornersCoveredExactlyOnce": int(np.count_nonzero(loop_counts == 1)),
        "fingerprints": fingerprints,
        "byteExactReassembly": True,
    }


def make_empty(
    name: str,
    collection: bpy.types.Collection,
) -> bpy.types.Object:
    result = bpy.data.objects.new(name, None)
    result.empty_display_type = "PLAIN_AXES"
    collection.objects.link(result)
    return result


def diagnostic_material(name: str, color: tuple[float, float, float]) -> Any:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = (*color, 1.0)
    shader = material.node_tree.nodes.get("Principled BSDF")
    require(shader is not None, f"{name} has no Principled shader")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Metallic"].default_value = 0.05
    shader.inputs["Roughness"].default_value = 0.36
    return material


def world_points(points: np.ndarray, matrix: Matrix) -> np.ndarray:
    homogeneous = np.concatenate(
        (points.astype(np.float64), np.ones((len(points), 1), dtype=np.float64)),
        axis=1,
    )
    return (homogeneous @ np.asarray(matrix, dtype=np.float64).T)[:, :3]


def configure_end_view(
    camera: bpy.types.Object,
    bounds: tuple[np.ndarray, np.ndarray],
) -> None:
    low, high = bounds
    dimensions = high - low
    radius = float(max(dimensions[0], dimensions[1], dimensions[2] * 1.8))
    target = Vector((0.0, 0.0, float((low[2] + high[2]) * 0.42)))
    camera.data.type = "PERSP"
    camera.data.lens = 58
    camera.location = (0.0, -radius * 2.75, float(target.z + radius * 0.50))
    PREPARE.point_at(camera, target)


def set_motion_state(
    roots: dict[str, bpy.types.Object],
    ratio: float,
    edge_metres: float,
) -> None:
    for root in roots.values():
        root.location = (0.0, 0.0, 0.0)
        root.scale = (1.0, 1.0, 1.0)
    roots["deck"].scale.x = ratio
    inward = edge_metres * (1.0 - ratio)
    roots["negativeRoller"].location.x = inward
    roots["positiveRoller"].location.x = -inward


def render_diagnostics(
    scene: bpy.types.Scene,
    camera: bpy.types.Object,
    objects: dict[str, bpy.types.Object],
    roots: dict[str, bpy.types.Object],
    bounds: tuple[np.ndarray, np.ndarray],
    edge_metres: float,
    proof_dir: Path,
) -> dict[str, Any]:
    materials = {
        role: diagnostic_material(f"Rejected partition {role}", ROLE_COLORS[role])
        for role in ROLE_ORDER
    }
    for role, obj in objects.items():
        obj.material_slots[0].link = "OBJECT"
        obj.material_slots[0].material = materials[role]
    scene.render.resolution_x = PREPARE.RESOLUTION[0]
    scene.render.resolution_y = PREPARE.RESOLUTION[1]
    scene.render.resolution_percentage = 100
    set_motion_state(roots, 1.0, edge_metres)
    views: dict[str, Any] = {}
    for view in ("three-quarter", "top", "end"):
        if view == "end":
            configure_end_view(camera, bounds)
        else:
            PREPARE.configure_view(camera, view, bounds)
        target = proof_dir / f"rejected-chart-partition-regions-{view}.png"
        PREPARE.render_atomic(scene, target)
        views[view] = PREPARE.file_record(target, PREPARE.RESOLUTION)
    motion: dict[str, Any] = {}
    PREPARE.configure_view(camera, "three-quarter", bounds)
    for progress, label in ((0.0, "000"), (0.25, "025")):
        ratio = MIN_LENGTH_RATIO + (1.0 - MIN_LENGTH_RATIO) * progress
        set_motion_state(roots, ratio, edge_metres)
        target = proof_dir / f"rejected-chart-partition-motion-{label}.png"
        PREPARE.render_atomic(scene, target)
        motion[label] = {
            "progress": progress,
            "lengthRatio": ratio,
            **PREPARE.file_record(target, PREPARE.RESOLUTION),
        }
    return {
        "legend": {
            "negativeRoller": "orange",
            "deck": "blue",
            "positiveRoller": "magenta",
        },
        "fullExtensionViews": views,
        "invalidMotionViews": motion,
        "warning": (
            "The moving proofs intentionally expose why the chart-component split "
            "is rejected. They are not motion approval or a runtime candidate."
        ),
    }


def build() -> dict[str, Any]:
    output = paths()
    output["proofDir"].mkdir(parents=True, exist_ok=True)
    baseline_report = json.loads(output["baselineReport"].read_text())
    require(output["baseline"].is_file(), "Packed dense master is absent")
    require(
        PREPARE.digest(output["baseline"])
        == baseline_report["packedBlend"]["sha256"],
        "Packed dense master differs from its report",
    )
    bpy.ops.wm.open_mainfile(filepath=str(output["baseline"]), load_ui=False)
    source_object = bpy.data.objects.get(f"{ASSET}__raw_import")
    review_object = bpy.data.objects.get(f"{ASSET}__normalized_review")
    require(source_object is not None, "Hidden raw source object is absent")
    require(review_object is not None, "Normalized review object is absent")
    source_mesh = source_object.data
    source = source_payload(source_mesh)
    require(
        source["fingerprints"]["vertexPositionsFloat32Sha256"]
        == baseline_report["geometry"]["vertexPositionsFloat32Sha256"],
        "Dense source positions differ from baseline report",
    )
    require(
        source["fingerprints"]["triangleIndicesInt32Sha256"]
        == baseline_report["geometry"]["triangleIndicesInt32Sha256"],
        "Dense source triangles differ from baseline report",
    )
    indexed_edges = mesh_edges(source_mesh)
    partition = component_partition(
        source["positions"], source["triangles"], indexed_edges
    )
    normalization = Matrix(baseline_report["geometry"]["normalizationMatrix"])
    scale = float(normalization[0][0])
    welded = welded_analysis(
        source["positions"],
        source["triangles"],
        indexed_edges,
        partition["triangleRegions"],
        scale,
    )

    template = source_mesh.copy()
    template.name = f"{ASSET}__rejected_split_template"
    add_source_id_attributes(template)
    part_meshes = {
        role: split_mesh(
            template,
            partition["vertexRegions"],
            role_id,
            f"RejectedChartPartition_{role}",
        )
        for role_id, role in enumerate(ROLE_ORDER)
    }
    bpy.data.meshes.remove(template)
    reassembly = reassembled_payload(source_mesh, part_meshes)

    alignment = Matrix.Rotation(
        math.radians(SOURCE_TO_CANONICAL_Z_DEGREES), 4, "Z"
    )
    source_to_canonical = alignment @ normalization
    canonical_points = world_points(source["positions"], source_to_canonical)
    canonical_bounds = (canonical_points.min(axis=0), canonical_points.max(axis=0))
    diagnostic_collection = bpy.data.collections.new(
        "Rejected Scroll Chart Partition Diagnostic"
    )
    bpy.context.scene.collection.children.link(diagnostic_collection)
    roots: dict[str, bpy.types.Object] = {}
    objects: dict[str, bpy.types.Object] = {}
    for role in ROLE_ORDER:
        root = make_empty(f"Rejected_{role}_Root", diagnostic_collection)
        obj = bpy.data.objects.new(f"Rejected_{role}_Geometry", part_meshes[role])
        diagnostic_collection.objects.link(obj)
        obj.parent = root
        obj.matrix_local = source_to_canonical
        roots[role] = root
        objects[role] = obj
    review_object.hide_render = True
    review_object.hide_viewport = True
    camera = bpy.data.objects.get("Cloudway_Proof_Camera")
    require(camera is not None, "Dense master proof camera is absent")
    proofs = render_diagnostics(
        bpy.context.scene,
        camera,
        objects,
        roots,
        canonical_bounds,
        CUT_Y * scale,
        output["proofDir"],
    )

    covariance = np.cov(source["positions"].astype(np.float64), rowvar=False)
    eigenvalues, eigenvectors = np.linalg.eigh(covariance)
    order = np.argsort(eigenvalues)[::-1]
    report = {
        "schema": 1,
        "assetId": ASSET,
        "status": "rejected-chart-component-split",
        "conclusion": (
            "The provider mesh has 3,083 disconnected index islands but only one "
            "connected surface after exact equal-position welding. Those islands "
            "are UV/hard-normal charts, not mechanically separable deck and roller "
            "shells. Moving them independently tears the visible surface."
        ),
        "scope": (
            "Read-only source audit plus disposable colored diagnostics. The dense "
            "master and raw GLB are unchanged. No candidate Blend, GLB, adapter "
            "metadata, collider, or accepted material split is written."
        ),
        "source": {
            "denseMaster": PREPARE.file_record(output["baseline"]),
            "modelSha256": baseline_report["source"]["sha256"],
            "fingerprints": source["fingerprints"],
            "uvLayer": source_mesh.uv_layers[0].name,
            "hasCustomCornerNormals": bool(source_mesh.has_custom_normals),
        },
        "authoredAxes": {
            "source": {
                "extension": "+Y, short direction between roller assemblies",
                "roller": "+X, long roller direction",
                "up": "+Z",
                "bounds": {
                    "min": [
                        round(float(value), 9)
                        for value in source["positions"].min(axis=0)
                    ],
                    "max": [
                        round(float(value), 9)
                        for value in source["positions"].max(axis=0)
                    ],
                },
                "pca": {
                    "eigenvalues": [
                        round(float(value), 12) for value in eigenvalues[order]
                    ],
                    "unitAxesSourceXyz": [
                        [round(float(value), 12) for value in eigenvectors[:, index]]
                        for index in order
                    ],
                },
            },
            "futureDerivative": {
                "blenderExtension": "+X",
                "blenderRoller": "-Y",
                "blenderUp": "+Z",
                "sourceToCanonicalRotationZDegrees": SOURCE_TO_CANONICAL_Z_DEGREES,
                "runtimeExtension": "local +X",
                "runtimeUp": "+Y",
            },
        },
        "rejectedIndexedComponentPartition": {
            "rule": (
                "Assign every complete indexed component by source-space centroid Y: "
                "negative below -0.30, deck through +/-0.30, positive above +0.30."
            ),
            "sourceCutY": CUT_Y,
            "indexedComponentCount": partition["componentCount"],
            "regions": partition["regions"],
            "planeCrossings": partition["planes"],
            "sourceChannelReassembly": reassembly,
            "whyReassemblyIsInsufficient": (
                "Exact static reassembly proves byte preservation only. It does not "
                "prove that duplicated seam vertices may move independently."
            ),
        },
        "weldedSurfaceEvidence": {
            key: value
            for key, value in welded.items()
            if key not in ("positions", "indexToWelded")
        },
        "diagnosticMotion": {
            "minLengthRatio": MIN_LENGTH_RATIO,
            "rule": (
                "For the rejected diagnostic, only the center region scales along "
                "canonical X and both side regions translate to the nominal cut "
                "planes. Shared welded positions away from those planes separate."
            ),
            "proofs": proofs,
        },
        "decision": {
            "candidateBlendWritten": False,
            "runtimeGlbWritten": False,
            "platformAdapterJsonWritten": False,
            "runtimeReady": False,
            "acceptedRoleNodes": [],
            "acceptedMaterialSlots": [],
            "requiredRefinement": [
                "Bisect a derivative at reviewed deck/roller planes while leaving the dense master immutable.",
                "Retain every unaffected source triangle, UV corner, custom normal, and provider PBR assignment.",
                "Create new closed cap faces at both cut planes with explicit provenance and a separate cap material slot.",
                "Name the three disjoint derivative roots ScrollDeck, ScrollRollerNegative, and ScrollRollerPositive only after reopen and motion proof.",
                "Render full, quarter, and minimum extension states and audit boundary closure before any platform_adapter_json or runtime export.",
                "Treat clear glass/gold replacement and gameplay collision as later acceptance gates; the source remains opaque provider PBR.",
            ],
        },
        "tool": {"blender": bpy.app.version_string, "numpy": np.__version__},
        "rebuild": (
            "rtk proxy timeout 1200 env ALSOFT_DRIVERS=null /usr/bin/blender "
            "--background --factory-startup --python-exit-code 1 --python "
            "art/glass-adventure/cloudway-laboratory/v1/production/"
            "audit_scroll_separation_feasibility.py"
        ),
    }
    PREPARE.durable_json(output["report"], report)
    PREPARE.durable_json(output["mirror"], report)
    require(
        PREPARE.digest(output["report"]) == PREPARE.digest(output["mirror"]),
        "Report mirror differs from Proton report",
    )
    print("CLOUDWAY_SCROLL_FEASIBILITY=" + json.dumps(report), flush=True)
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])
    build()
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
