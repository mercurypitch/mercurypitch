"""Locate defects in the Celadon 50k remesh without modifying the source GLB."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree


HERE = Path(__file__).resolve().parents[1]
SOURCE = HERE / "meshy" / "celadon-lark-decanter-remesh-50k.glb"
REPORT = Path(__file__).with_name("celadon-remesh-defects.json")
TARGET_HEIGHT_METRES = 1.15
WELD_TOLERANCE_METRES = 1e-7


def mesh_objects() -> list[bpy.types.Object]:
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]


def bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    return (
        Vector(min(point[axis] for point in points) for axis in range(3)),
        Vector(max(point[axis] for point in points) for axis in range(3)),
    )


def normalize(objects: list[bpy.types.Object]) -> None:
    low, high = bounds(objects)
    scale = TARGET_HEIGHT_METRES / (high.z - low.z)
    transform = Matrix.Scale(scale, 4) @ Matrix.Translation(
        (-((low.x + high.x) / 2), -((low.y + high.y) / 2), -low.z)
    )
    for obj in [item for item in bpy.context.scene.objects if item.parent is None]:
        obj.matrix_world = transform @ obj.matrix_world
    bpy.context.view_layer.update()


def combined_mesh(objects: list[bpy.types.Object]) -> bmesh.types.BMesh:
    mesh = bmesh.new()
    for obj in objects:
        part = bmesh.new()
        part.from_mesh(obj.data)
        part.transform(obj.matrix_world)
        temporary = bpy.data.meshes.new("celadon_defect_part")
        part.to_mesh(temporary)
        part.free()
        mesh.from_mesh(temporary)
        bpy.data.meshes.remove(temporary)
    bmesh.ops.remove_doubles(mesh, verts=list(mesh.verts), dist=WELD_TOLERANCE_METRES)
    bmesh.ops.triangulate(mesh, faces=list(mesh.faces))
    mesh.normal_update()
    mesh.verts.ensure_lookup_table()
    mesh.edges.ensure_lookup_table()
    mesh.faces.ensure_lookup_table()
    return mesh


def vector_row(point: Vector) -> list[float]:
    return [float(value) for value in point]


def geometry_bounds(vertices: set[bmesh.types.BMVert]) -> dict[str, object]:
    low = Vector(min(vertex.co[axis] for vertex in vertices) for axis in range(3))
    high = Vector(max(vertex.co[axis] for vertex in vertices) for axis in range(3))
    return {
        "minMetres": vector_row(low),
        "maxMetres": vector_row(high),
        "dimensionsMetres": vector_row(high - low),
        "centreMetres": vector_row((low + high) * 0.5),
    }


def edge_clusters(edges: list[bmesh.types.BMEdge]) -> list[dict[str, object]]:
    remaining = set(edges)
    clusters = []
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
        clusters.append(
            {
                "edges": len(cluster_edges),
                "vertices": len(vertices),
                "linkedFaceCounts": dict(
                    sorted(Counter(len(edge.link_faces) for edge in cluster_edges).items())
                ),
                "totalEdgeLengthMetres": sum(edge.calc_length() for edge in cluster_edges),
                "bounds": geometry_bounds(vertices),
            }
        )
    return sorted(clusters, key=lambda row: (-row["edges"], row["bounds"]["minMetres"]))


def intersection_clusters(mesh: bmesh.types.BMesh) -> list[dict[str, object]]:
    tree = BVHTree.FromBMesh(mesh)
    pairs = [
        (first, second)
        for first, second in tree.overlap(tree)
        if first < second
        and not set(mesh.faces[first].verts).intersection(mesh.faces[second].verts)
    ]
    remaining = set(range(len(pairs)))
    clusters = []
    while remaining:
        first = remaining.pop()
        pending = [first]
        face_indices = set(pairs[first])
        pair_indices = {first}
        while pending:
            current = pending.pop()
            current_faces = set(pairs[current])
            joined = [
                index
                for index in remaining
                if current_faces.intersection(pairs[index])
            ]
            for index in joined:
                remaining.remove(index)
                pending.append(index)
                pair_indices.add(index)
                face_indices.update(pairs[index])
        faces = [mesh.faces[index] for index in face_indices]
        vertices = {vertex for face in faces for vertex in face.verts}
        clusters.append(
            {
                "pairs": len(pair_indices),
                "faces": len(faces),
                "vertices": len(vertices),
                "bounds": geometry_bounds(vertices),
            }
        )
    return sorted(clusters, key=lambda row: (-row["pairs"], row["bounds"]["minMetres"]))


def run() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    objects = mesh_objects()
    normalize(objects)
    mesh = combined_mesh(objects)
    boundaries = [edge for edge in mesh.edges if edge.is_boundary]
    non_manifold = [edge for edge in mesh.edges if not edge.is_manifold]
    multi_face = [edge for edge in mesh.edges if len(edge.link_faces) > 2]
    non_contiguous = [edge for edge in mesh.edges if not edge.is_contiguous]
    duplicate_faces = Counter(tuple(sorted(vertex.index for vertex in face.verts)) for face in mesh.faces)
    report = {
        "schema": 1,
        "method": (
            "Fresh Blender import normalized to 1.15m and welded at 0.1 micrometre; "
            "connected defect clusters are reported in normalized vessel coordinates."
        ),
        "boundaryClusters": edge_clusters(boundaries),
        "multiFaceClusters": edge_clusters(multi_face),
        "nonManifoldClusters": edge_clusters(non_manifold),
        "nonContiguousClusters": edge_clusters(non_contiguous),
        "intersectionClusters": intersection_clusters(mesh),
        "exactDuplicateFaceGroups": sum(count > 1 for count in duplicate_faces.values()),
        "maximumExactDuplicateMultiplicity": max(duplicate_faces.values()),
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    mesh.free()
    print(f"CELADON_DEFECTS={REPORT}", flush=True)


if __name__ == "__main__":
    run()
