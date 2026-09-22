"""Audit the archived, V6, and 100k connector meshes without modifying them."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree


HERE = Path(__file__).resolve().parent
ART = HERE.parent
REPORT = HERE / "connector-candidate-audit.json"
ASSETS = {
    "archivedPreRemesh": ART / "meshy" / "raw" / "twin-connector-pre-remesh-v6.glb",
    "v6TexturedFinal": ART.parent / "v6" / "meshy" / "twin-connector-final.glb",
    "v7Remesh100k": ART / "meshy" / "twin-connector-remesh-100k.glb",
    "v7RetexturePbr": ART / "meshy" / "twin-connector-remesh-100k-retexture-pbr.glb",
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def triangles(mesh: bpy.types.Mesh) -> int:
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)


def topology(mesh: bpy.types.Mesh) -> dict[str, int | bool]:
    copy = mesh.copy()
    invalid = copy.validate(verbose=False, clean_customdata=False)
    bpy.data.meshes.remove(copy)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    result = {
        "vertices": len(bm.verts),
        "triangles": triangles(mesh),
        "boundaryEdges": sum(len(edge.link_faces) == 1 for edge in bm.edges),
        "nonManifoldEdges": sum(len(edge.link_faces) != 2 for edge in bm.edges),
        "looseEdges": sum(not edge.link_faces for edge in bm.edges),
        "zeroAreaFaces": sum(face.calc_area() <= 1e-12 for face in bm.faces),
        "blenderMeshInvalid": bool(invalid),
    }
    bm.free()
    return result


def bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points = [
        obj.matrix_world @ vertex.co
        for obj in objects
        for vertex in obj.data.vertices
    ]
    return (
        Vector(min(point[axis] for point in points) for axis in range(3)),
        Vector(max(point[axis] for point in points) for axis in range(3)),
    )


def inspect(path: Path) -> tuple[dict[str, object], list[Vector], list[tuple[int, ...]]]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not objects:
        raise ValueError(f"{path.name} has no mesh")
    low, high = bounds(objects)
    extent = high - low
    vertices: list[Vector] = []
    polygons: list[tuple[int, ...]] = []
    for obj in objects:
        offset = len(vertices)
        for vertex in obj.data.vertices:
            point = obj.matrix_world @ vertex.co
            vertices.append(
                Vector(
                    (
                        (point.x - low.x) / extent.x - 0.5,
                        (point.y - low.y) / extent.y - 0.5,
                        (point.z - low.z) / extent.z - 0.5,
                    )
                )
            )
        polygons.extend(
            tuple(offset + index for index in polygon.vertices)
            for polygon in obj.data.polygons
        )
    images = {
        image.name: {
            "dimensions": list(image.size),
            "packed": image.packed_file is not None,
            "source": image.source,
        }
        for image in bpy.data.images
        if image.type == "IMAGE"
    }
    report = {
        "file": str(path.relative_to(ART.parent.parent.parent)),
        "bytes": path.stat().st_size,
        "sha256": digest(path),
        "meshObjects": len(objects),
        "triangles": sum(triangles(obj.data) for obj in objects),
        "vertices": sum(len(obj.data.vertices) for obj in objects),
        "boundsBlenderZUp": {"min": list(low), "max": list(high)},
        "dimensionsGlTfYUp": [extent.x, extent.z, extent.y],
        "uvLayers": {
            obj.name: [layer.name for layer in obj.data.uv_layers] for obj in objects
        },
        "materials": sorted(
            {
                material.name
                for obj in objects
                for material in obj.data.materials
                if material is not None
            }
        ),
        "images": images,
        "topology": {obj.name: topology(obj.data) for obj in objects},
    }
    return report, vertices, polygons


def percentile(values: list[float], fraction: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, math.floor((len(ordered) - 1) * fraction))]


def sampled_distance(
    source_vertices: list[Vector],
    target_vertices: list[Vector],
    target_polygons: list[tuple[int, ...]],
) -> dict[str, float | int]:
    tree = BVHTree.FromPolygons(target_vertices, target_polygons, all_triangles=False)
    stride = max(1, len(source_vertices) // 10_000)
    distances = []
    for point in source_vertices[::stride]:
        nearest = tree.find_nearest(point)
        if nearest is not None:
            distances.append(float(nearest[3]))
    return {
        "sampleCount": len(distances),
        "normalizedMean": sum(distances) / max(len(distances), 1),
        "normalizedP95": percentile(distances, 0.95),
        "normalizedMax": max(distances, default=0.0),
    }


def main() -> None:
    rows: dict[str, dict[str, object]] = {}
    geometry: dict[str, tuple[list[Vector], list[tuple[int, ...]]]] = {}
    for name, path in ASSETS.items():
        report, vertices, polygons = inspect(path)
        rows[name] = report
        geometry[name] = (vertices, polygons)
    raw_vertices, raw_polygons = geometry["archivedPreRemesh"]
    comparisons = {}
    for name in ("v6TexturedFinal", "v7Remesh100k", "v7RetexturePbr"):
        candidate_vertices, candidate_polygons = geometry[name]
        comparisons[name] = {
            "candidateVerticesToArchivedSurface": sampled_distance(
                candidate_vertices, raw_vertices, raw_polygons
            ),
            "archivedVerticesToCandidateSurface": sampled_distance(
                raw_vertices, candidate_vertices, candidate_polygons
            ),
            "note": (
                "Distances use independently normalized axis-aligned bounds and a deterministic "
                "sample of at most about 10k vertices in each direction."
            ),
        }
    result = {
        "schema": 1,
        "purpose": "Read-only topology and source-fidelity audit for the review-only V7 connector candidate.",
        "assets": rows,
        "normalizedSurfaceComparisons": comparisons,
        "blender": bpy.app.version_string,
        "command": (
            "rtk proxy env ALSOFT_DRIVERS=null blender -b --factory-startup "
            "--python-exit-code 1 --python "
            "art/glass-adventure/journey-map/v7/production/audit_connector_candidates.py"
        ),
    }
    REPORT.write_text(json.dumps(result, indent=2) + "\n")
    print("MUSEUM_CONNECTOR_AUDIT=" + json.dumps(result), flush=True)
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
