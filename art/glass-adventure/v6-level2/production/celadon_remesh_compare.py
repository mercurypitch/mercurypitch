"""Compare Celadon's recovered source and remeshes without mutating them."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree


HERE = Path(__file__).resolve().parents[1]
REPORT = Path(__file__).with_name("celadon-remesh-comparison.json")
TARGET_HEIGHT_METRES = 1.15
WELD_TOLERANCE_METRES = 1e-7
SURFACE_SAMPLE_LIMIT = 24_000
SILHOUETTE_RESOLUTION = 192
SOURCES = (
    (
        "donor-9k",
        HERE / "meshy" / "celadon-lark-decanter-donor.glb",
        "7b1c1a1f712f13b005458ae306fbbd54e7bc808d36fc5ff9614245efd6b31e4b",
    ),
    (
        "source-473k",
        HERE / "meshy" / "celadon-lark-decanter-pre-remesh.glb",
        "34e4883dd62c2f1bdd09e7b899e6cd624ba51592e5da0358a1f8c72344f96f24",
    ),
    (
        "remesh-50k",
        HERE / "meshy" / "celadon-lark-decanter-remesh-50k.glb",
        "5b9b101c7660251d64c82dedf8e1c2d361ec1b0980d7f3edcef65026cb6aabaa",
    ),
)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def mesh_objects() -> list[bpy.types.Object]:
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]


def world_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    return (
        Vector(min(point[axis] for point in points) for axis in range(3)),
        Vector(max(point[axis] for point in points) for axis in range(3)),
    )


def normalize(objects: list[bpy.types.Object]) -> dict[str, object]:
    low, high = world_bounds(objects)
    dimensions = high - low
    if dimensions.z <= 0:
        raise ValueError("Celadon source has no positive height")
    scale = TARGET_HEIGHT_METRES / dimensions.z
    transform = Matrix.Scale(scale, 4) @ Matrix.Translation(
        (-((low.x + high.x) / 2), -((low.y + high.y) / 2), -low.z)
    )
    for obj in [item for item in bpy.context.scene.objects if item.parent is None]:
        obj.matrix_world = transform @ obj.matrix_world
    bpy.context.view_layer.update()
    final_low, final_high = world_bounds(objects)
    return {
        "scale": scale,
        "sourceBounds": {"min": list(low), "max": list(high)},
        "normalizedBoundsMetres": {
            "min": list(final_low),
            "max": list(final_high),
        },
        "normalizedDimensionsMetres": list(final_high - final_low),
    }


def combined_bmesh(objects: list[bpy.types.Object]) -> bmesh.types.BMesh:
    result = bmesh.new()
    for obj in objects:
        source = bmesh.new()
        source.from_mesh(obj.data)
        source.transform(obj.matrix_world)
        temporary = bpy.data.meshes.new("celadon_compare_part")
        source.to_mesh(temporary)
        source.free()
        result.from_mesh(temporary)
        bpy.data.meshes.remove(temporary)
    bmesh.ops.remove_doubles(
        result,
        verts=list(result.verts),
        dist=WELD_TOLERANCE_METRES,
    )
    bmesh.ops.triangulate(result, faces=list(result.faces))
    result.normal_update()
    result.verts.ensure_lookup_table()
    result.edges.ensure_lookup_table()
    result.faces.ensure_lookup_table()
    return result


def component_count(mesh: bmesh.types.BMesh) -> int:
    remaining = set(mesh.verts)
    count = 0
    while remaining:
        count += 1
        pending = [remaining.pop()]
        while pending:
            current = pending.pop()
            for edge in current.link_edges:
                other = edge.other_vert(current)
                if other in remaining:
                    remaining.remove(other)
                    pending.append(other)
    return count


def self_intersection_count(mesh: bmesh.types.BMesh) -> int:
    tree = BVHTree.FromBMesh(mesh)
    return sum(
        1
        for first, second in tree.overlap(tree)
        if first < second
        and not set(mesh.faces[first].verts).intersection(mesh.faces[second].verts)
    )


def mesh_bounds(mesh: bmesh.types.BMesh) -> tuple[Vector, Vector]:
    return (
        Vector(min(vertex.co[axis] for vertex in mesh.verts) for axis in range(3)),
        Vector(max(vertex.co[axis] for vertex in mesh.verts) for axis in range(3)),
    )


def vertical_rays(mesh: bmesh.types.BMesh) -> list[dict[str, object]]:
    low, high = mesh_bounds(mesh)
    span = high - low
    tree = BVHTree.FromBMesh(mesh)
    results = []
    for x_factor, y_factor in (
        (0.0, 0.0),
        (0.12, 0.0),
        (-0.12, 0.0),
        (0.0, 0.12),
        (0.0, -0.12),
    ):
        origin = Vector(
            (
                (low.x + high.x) / 2 + span.x * x_factor,
                (low.y + high.y) / 2 + span.y * y_factor,
                low.z - TARGET_HEIGHT_METRES * 0.05,
            )
        )
        hits: list[float] = []
        cursor = origin.copy()
        limit = high.z + TARGET_HEIGHT_METRES * 0.05
        while cursor.z < limit and len(hits) < 64:
            location, _normal, _face, _distance = tree.ray_cast(
                cursor,
                Vector((0.0, 0.0, 1.0)),
                limit - cursor.z,
            )
            if location is None:
                break
            hits.append(location.z)
            cursor = location + Vector((0.0, 0.0, TARGET_HEIGHT_METRES * 1e-6))
        results.append(
            {
                "xyMetres": [origin.x, origin.y],
                "intersectionCount": len(hits),
                "zMetres": hits,
            }
        )
    return results


def raw_inventory(objects: list[bpy.types.Object]) -> list[dict[str, object]]:
    return [
        {
            "name": obj.name,
            "vertices": len(obj.data.vertices),
            "edges": len(obj.data.edges),
            "triangles": sum(max(1, len(face.vertices) - 2) for face in obj.data.polygons),
            "uvLayers": [layer.name for layer in obj.data.uv_layers],
            "materials": [material.name if material else None for material in obj.data.materials],
        }
        for obj in objects
    ]


def load_source(label: str, path: Path, expected_hash: str) -> dict[str, object]:
    actual_hash = digest(path)
    if actual_hash != expected_hash:
        raise ValueError(f"{label}: expected {expected_hash}, got {actual_hash}")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    objects = mesh_objects()
    if not objects:
        raise ValueError(f"{label}: no mesh objects")
    normalization = normalize(objects)
    inventory = raw_inventory(objects)
    mesh = combined_bmesh(objects)
    boundary_edges = sum(edge.is_boundary for edge in mesh.edges)
    non_manifold_edges = sum(not edge.is_manifold for edge in mesh.edges)
    non_manifold_vertices = sum(not vertex.is_manifold for vertex in mesh.verts)
    non_contiguous_edges = sum(not edge.is_contiguous for edge in mesh.edges)
    low, high = mesh_bounds(mesh)
    return {
        "label": label,
        "file": str(path.relative_to(HERE)),
        "bytes": path.stat().st_size,
        "sha256": actual_hash,
        "normalization": normalization,
        "rawObjects": inventory,
        "topology": {
            "weldToleranceMetres": WELD_TOLERANCE_METRES,
            "vertices": len(mesh.verts),
            "edges": len(mesh.edges),
            "triangles": len(mesh.faces),
            "boundaryEdges": boundary_edges,
            "nonManifoldEdges": non_manifold_edges,
            "nonManifoldVertices": non_manifold_vertices,
            "nonContiguousEdges": non_contiguous_edges,
            "connectedComponents": component_count(mesh),
            "signedVolumeCubicMetres": mesh.calc_volume(signed=True),
            "selfIntersectionPairs": self_intersection_count(mesh),
            "closedOrientedSolidCandidate": (
                boundary_edges == 0
                and non_manifold_edges == 0
                and non_manifold_vertices == 0
                and non_contiguous_edges == 0
            ),
            "verticalRaySamples": vertical_rays(mesh),
        },
        "_mesh": mesh,
        "_tree": BVHTree.FromBMesh(mesh),
        "_bounds": (low, high),
    }


def sampled_vertices(mesh: bmesh.types.BMesh) -> list[Vector]:
    step = max(1, math.ceil(len(mesh.verts) / SURFACE_SAMPLE_LIMIT))
    points = [mesh.verts[index].co.copy() for index in range(0, len(mesh.verts), step)]
    if points[-1] != mesh.verts[-1].co:
        points.append(mesh.verts[-1].co.copy())
    return points


def percentile(values: list[float], fraction: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, round((len(ordered) - 1) * fraction))]


def distance_summary(points: list[Vector], tree: BVHTree) -> dict[str, float | int]:
    distances = []
    for point in points:
        nearest = tree.find_nearest(point)
        if nearest[0] is None:
            raise ValueError("Nearest-surface query unexpectedly missed")
        distances.append((point - nearest[0]).length)
    return {
        "samples": len(distances),
        "meanMetres": sum(distances) / len(distances),
        "rmsMetres": math.sqrt(sum(value * value for value in distances) / len(distances)),
        "p50Metres": percentile(distances, 0.5),
        "p95Metres": percentile(distances, 0.95),
        "p99Metres": percentile(distances, 0.99),
        "maxMetres": max(distances),
    }


VIEW_AXES = {
    "front": (0, 2, 1),
    "side": (1, 2, 0),
    "top": (0, 1, 2),
}


def silhouette_mask(
    tree: BVHTree,
    plane_bounds: tuple[float, float, float, float],
    ray_bounds: tuple[float, float],
    axes: tuple[int, int, int],
) -> set[int]:
    horizontal, vertical, ray_axis = axes
    min_h, max_h, min_v, max_v = plane_bounds
    min_ray, max_ray = ray_bounds
    direction = Vector((0.0, 0.0, 0.0))
    direction[ray_axis] = 1.0
    mask: set[int] = set()
    for row in range(SILHOUETTE_RESOLUTION):
        vertical_value = min_v + (row + 0.5) / SILHOUETTE_RESOLUTION * (max_v - min_v)
        for column in range(SILHOUETTE_RESOLUTION):
            horizontal_value = min_h + (column + 0.5) / SILHOUETTE_RESOLUTION * (max_h - min_h)
            origin = Vector((0.0, 0.0, 0.0))
            origin[horizontal] = horizontal_value
            origin[vertical] = vertical_value
            origin[ray_axis] = min_ray
            if tree.ray_cast(origin, direction, max_ray - min_ray)[0] is not None:
                mask.add(row * SILHOUETTE_RESOLUTION + column)
    return mask


def boundary(mask: set[int]) -> set[int]:
    result = set()
    for index in mask:
        row, column = divmod(index, SILHOUETTE_RESOLUTION)
        if (
            row == 0
            or column == 0
            or row == SILHOUETTE_RESOLUTION - 1
            or column == SILHOUETTE_RESOLUTION - 1
            or index - 1 not in mask
            or index + 1 not in mask
            or index - SILHOUETTE_RESOLUTION not in mask
            or index + SILHOUETTE_RESOLUTION not in mask
        ):
            result.add(index)
    return result


def boundary_distances(
    source: set[int],
    target: set[int],
    pixel_width: float,
    pixel_height: float,
) -> list[float]:
    target_boundary = boundary(target)
    tree = KDTree(len(target_boundary))
    for slot, index in enumerate(target_boundary):
        row, column = divmod(index, SILHOUETTE_RESOLUTION)
        tree.insert((column * pixel_width, row * pixel_height, 0.0), slot)
    tree.balance()
    distances = []
    for index in boundary(source):
        row, column = divmod(index, SILHOUETTE_RESOLUTION)
        _position, _slot, distance = tree.find(
            (column * pixel_width, row * pixel_height, 0.0)
        )
        distances.append(distance)
    return distances


def compare_silhouettes(reference: dict[str, object], candidate: dict[str, object]) -> dict[str, object]:
    reference_low, reference_high = reference["_bounds"]
    candidate_low, candidate_high = candidate["_bounds"]
    low = Vector(min(reference_low[i], candidate_low[i]) for i in range(3))
    high = Vector(max(reference_high[i], candidate_high[i]) for i in range(3))
    span = high - low
    padding = TARGET_HEIGHT_METRES * 0.025
    result = {}
    for name, axes in VIEW_AXES.items():
        horizontal, vertical, ray_axis = axes
        plane_bounds = (
            low[horizontal] - padding,
            high[horizontal] + padding,
            low[vertical] - padding,
            high[vertical] + padding,
        )
        ray_bounds = (low[ray_axis] - padding, high[ray_axis] + padding)
        reference_mask = silhouette_mask(reference["_tree"], plane_bounds, ray_bounds, axes)
        candidate_mask = silhouette_mask(candidate["_tree"], plane_bounds, ray_bounds, axes)
        intersection = len(reference_mask.intersection(candidate_mask))
        union = len(reference_mask.union(candidate_mask))
        pixel_width = (plane_bounds[1] - plane_bounds[0]) / SILHOUETTE_RESOLUTION
        pixel_height = (plane_bounds[3] - plane_bounds[2]) / SILHOUETTE_RESOLUTION
        forward = boundary_distances(
            candidate_mask,
            reference_mask,
            pixel_width,
            pixel_height,
        )
        reverse = boundary_distances(
            reference_mask,
            candidate_mask,
            pixel_width,
            pixel_height,
        )
        result[name] = {
            "resolution": SILHOUETTE_RESOLUTION,
            "referencePixels": len(reference_mask),
            "candidatePixels": len(candidate_mask),
            "intersectionOverUnion": intersection / union,
            "referenceMissingFraction": len(reference_mask - candidate_mask)
            / len(reference_mask),
            "candidateExcessFraction": len(candidate_mask - reference_mask)
            / len(reference_mask),
            "candidateToReferenceBoundaryP95Metres": percentile(forward, 0.95),
            "referenceToCandidateBoundaryP95Metres": percentile(reverse, 0.95),
            "symmetricBoundaryMaxMetres": max([*forward, *reverse]),
        }
    return result


def comparison(reference: dict[str, object], candidate: dict[str, object]) -> dict[str, object]:
    return {
        "surfaceDistance": {
            "candidateToReference": distance_summary(
                sampled_vertices(candidate["_mesh"]),
                reference["_tree"],
            ),
            "referenceToCandidate": distance_summary(
                sampled_vertices(reference["_mesh"]),
                candidate["_tree"],
            ),
        },
        "silhouette": compare_silhouettes(reference, candidate),
    }


def public_source(source: dict[str, object]) -> dict[str, object]:
    return {key: value for key, value in source.items() if not key.startswith("_")}


def run() -> dict[str, object]:
    sources = {
        label: load_source(label, path, expected_hash)
        for label, path, expected_hash in SOURCES
    }
    reference = sources["source-473k"]
    report = {
        "schema": 1,
        "method": (
            "Fresh Blender GLB import; common 1.15m bottom-centre normalization; "
            "world-space 0.1 micrometre weld and triangulation; manifold, volume, "
            "self-intersection and vertical-ray audit; deterministic bidirectional "
            "nearest-surface samples; fixed-grid front, side and top ray-cast silhouettes."
        ),
        "sources": [public_source(sources[label]) for label, _path, _hash in SOURCES],
        "comparisonsToRecoveredSource": {
            "donor-9k": comparison(reference, sources["donor-9k"]),
            "remesh-50k": comparison(reference, sources["remesh-50k"]),
        },
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    for source in sources.values():
        source["_mesh"].free()
    print(f"CELADON_COMPARISON={REPORT}")
    return report


if __name__ == "__main__":
    run()
