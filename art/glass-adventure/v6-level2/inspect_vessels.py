"""Audit preserved Level 2 vessel donors without changing their source bytes."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree


HERE = Path(__file__).resolve().parent
REPORT = HERE / "exports" / "vessel-topology-audit.json"
SOURCES = (
    ("amber-cadence-urn", "meshy/amber-cadence-urn-donor.glb", 0.72),
    ("celadon-lark-decanter", "meshy/celadon-lark-decanter-donor.glb", 1.15),
    (
        "celadon-lark-decanter-pre-remesh",
        "meshy/celadon-lark-decanter-pre-remesh.glb",
        1.15,
    ),
    ("opaline-echo-amphora", "meshy/opaline-echo-amphora-donor.glb", 0.92),
)
WELD_TOLERANCES = (1e-7, 1e-6, 1e-5)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def mesh_objects() -> list[bpy.types.Object]:
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]


def bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    return (
        Vector(min(point[axis] for point in points) for axis in range(3)),
        Vector(max(point[axis] for point in points) for axis in range(3)),
    )


def normalize(objects: list[bpy.types.Object], height: float) -> dict[str, object]:
    low, high = bounds(objects)
    dimensions = high - low
    if dimensions.z <= 0:
        raise ValueError("Donor has no positive height")
    scale = height / dimensions.z
    transform = Matrix.Scale(scale, 4) @ Matrix.Translation(
        (-((low.x + high.x) / 2), -((low.y + high.y) / 2), -low.z)
    )
    top_level = [obj for obj in bpy.context.scene.objects if obj.parent is None]
    for obj in top_level:
        obj.matrix_world = transform @ obj.matrix_world
    bpy.context.view_layer.update()
    final_low, final_high = bounds(objects)
    return {
        "scale": scale,
        "boundsMetres": {"min": list(final_low), "max": list(final_high)},
        "dimensionsMetres": list(final_high - final_low),
    }


def combined_bmesh(objects: list[bpy.types.Object]) -> bmesh.types.BMesh:
    result = bmesh.new()
    for obj in objects:
        source = bmesh.new()
        source.from_mesh(obj.data)
        source.transform(obj.matrix_world)
        temporary = bpy.data.meshes.new("audit_combined_part")
        source.to_mesh(temporary)
        source.free()
        result.from_mesh(temporary)
        bpy.data.meshes.remove(temporary)
    return result


def component_sizes(bm: bmesh.types.BMesh) -> list[dict[str, int]]:
    remaining = set(bm.verts)
    components: list[dict[str, int]] = []
    while remaining:
        first = remaining.pop()
        pending = [first]
        vertices = {first}
        while pending:
            current = pending.pop()
            for edge in current.link_edges:
                other = edge.other_vert(current)
                if other in remaining:
                    remaining.remove(other)
                    vertices.add(other)
                    pending.append(other)
        edges = {edge for vertex in vertices for edge in vertex.link_edges}
        faces = {face for vertex in vertices for face in vertex.link_faces}
        components.append(
            {"vertices": len(vertices), "edges": len(edges), "faces": len(faces)}
        )
    return sorted(components, key=lambda row: (-row["faces"], -row["vertices"]))


def self_intersections(bm: bmesh.types.BMesh) -> tuple[int, list[dict[str, object]]]:
    tree = BVHTree.FromBMesh(bm)
    bm.faces.ensure_lookup_table()
    pairs = [
        (first, second)
        for first, second in tree.overlap(tree)
        if first < second
        and not set(bm.faces[first].verts).intersection(bm.faces[second].verts)
    ]
    regions = []
    for first, second in pairs[:50]:
        faces = (bm.faces[first], bm.faces[second])
        centres = [face.calc_center_median() for face in faces]
        regions.append(
            {
                "faces": [first, second],
                "centresMetres": [list(point) for point in centres],
                "separationMetres": (centres[0] - centres[1]).length,
            }
        )
    return len(pairs), regions


def edge_regions(edges: list[bmesh.types.BMEdge], limit: int = 100) -> list[dict[str, object]]:
    return [
        {
            "verticesMetres": [list(vertex.co) for vertex in edge.verts],
            "lengthMetres": edge.calc_length(),
            "linkedFaces": len(edge.link_faces),
        }
        for edge in edges[:limit]
    ]


def ray_intersections(
    bm: bmesh.types.BMesh, low: Vector, high: Vector
) -> list[dict[str, object]]:
    tree = BVHTree.FromBMesh(bm)
    span = high - low
    z_start = low.z - max(0.02, span.z * 0.1)
    max_distance = span.z * 1.25
    samples = []
    for x_factor, y_factor in ((0.0, 0.0), (0.12, 0.0), (-0.12, 0.0), (0.0, 0.12), (0.0, -0.12)):
        origin = Vector(
            (
                (low.x + high.x) / 2 + span.x * x_factor,
                (low.y + high.y) / 2 + span.y * y_factor,
                z_start,
            )
        )
        hits = []
        travelled = 0.0
        cursor = origin.copy()
        while travelled < max_distance and len(hits) < 32:
            location, _normal, _index, distance = tree.ray_cast(
                cursor, Vector((0.0, 0.0, 1.0)), max_distance - travelled
            )
            if location is None or distance is None:
                break
            hits.append(location.z)
            step = max(1e-6, span.z * 1e-6)
            cursor = location + Vector((0.0, 0.0, step))
            travelled = cursor.z - origin.z
        samples.append(
            {
                "xyMetres": [origin.x, origin.y],
                "intersectionCount": len(hits),
                "zMetres": hits,
            }
        )
    return samples


def topology(objects: list[bpy.types.Object], tolerance: float) -> dict[str, object]:
    bm = combined_bmesh(objects)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=tolerance)
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    bm.normal_update()
    bm.verts.ensure_lookup_table()
    bm.edges.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    low = Vector(min(vertex.co[axis] for vertex in bm.verts) for axis in range(3))
    high = Vector(max(vertex.co[axis] for vertex in bm.verts) for axis in range(3))
    non_manifold_edges = sum(not edge.is_manifold for edge in bm.edges)
    non_manifold_vertices = sum(not vertex.is_manifold for vertex in bm.verts)
    non_contiguous_edges = sum(not edge.is_contiguous for edge in bm.edges)
    intersections, intersection_regions = self_intersections(bm)
    boundary = [edge for edge in bm.edges if edge.is_boundary]
    non_manifold = [edge for edge in bm.edges if not edge.is_manifold]
    report = {
        "weldToleranceMetres": tolerance,
        "vertices": len(bm.verts),
        "edges": len(bm.edges),
        "triangles": len(bm.faces),
        "boundaryEdges": len(boundary),
        "nonManifoldEdges": non_manifold_edges,
        "nonManifoldVertices": non_manifold_vertices,
        "nonContiguousEdges": non_contiguous_edges,
        "connectedComponents": component_sizes(bm),
        "signedVolumeCubicMetres": bm.calc_volume(signed=True),
        "absoluteVolumeCubicMetres": abs(bm.calc_volume(signed=True)),
        "boundaryEdgeRegions": edge_regions(boundary),
        "nonManifoldEdgeRegions": edge_regions(non_manifold),
        "selfIntersectionPairs": intersections,
        "selfIntersectionRegions": intersection_regions,
        "verticalRaySamples": ray_intersections(bm, low, high),
        "closedOrientedSolidCandidate": (
            non_manifold_edges == 0
            and non_manifold_vertices == 0
            and non_contiguous_edges == 0
        ),
    }
    bm.free()
    return report


def raw_object_report(obj: bpy.types.Object) -> dict[str, object]:
    mesh = obj.data
    return {
        "name": obj.name,
        "vertices": len(mesh.vertices),
        "edges": len(mesh.edges),
        "polygons": len(mesh.polygons),
        "triangles": sum(max(1, len(face.vertices) - 2) for face in mesh.polygons),
        "uvLayers": [layer.name for layer in mesh.uv_layers],
        "materials": [material.name if material else None for material in mesh.materials],
        "hasShapeKeys": obj.data.shape_keys is not None,
        "modifierCount": len(obj.modifiers),
        "matrixWorld": [list(row) for row in obj.matrix_world],
        "materialGraphs": [
            {
                "name": material.name,
                "nodes": [
                    {
                        "name": node.name,
                        "type": node.type,
                        "image": (
                            {
                                "name": node.image.name,
                                "dimensions": list(node.image.size),
                                "colorSpace": node.image.colorspace_settings.name,
                            }
                            if node.type == "TEX_IMAGE" and node.image
                            else None
                        ),
                    }
                    for node in material.node_tree.nodes
                ],
                "links": [
                    {
                        "from": f"{link.from_node.name}.{link.from_socket.name}",
                        "to": f"{link.to_node.name}.{link.to_socket.name}",
                    }
                    for link in material.node_tree.links
                ],
            }
            for material in mesh.materials
            if material and material.use_nodes
        ],
    }


def audit(asset_id: str, source: str, height: float) -> dict[str, object]:
    donor = HERE / source
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(donor))
    objects = mesh_objects()
    if not objects:
        raise ValueError(f"{asset_id}: no mesh objects")
    normalization = normalize(objects, height)
    tolerance_reports = [topology(objects, tolerance) for tolerance in WELD_TOLERANCES]
    stable = all(
        report["vertices"] == tolerance_reports[0]["vertices"]
        and report["triangles"] == tolerance_reports[0]["triangles"]
        for report in tolerance_reports[1:]
    )
    if not all(
        math.isfinite(report["signedVolumeCubicMetres"])
        for report in tolerance_reports
    ):
        raise ValueError(f"{asset_id}: non-finite volume")
    return {
        "assetId": asset_id,
        "donor": {
            "file": str(donor.relative_to(HERE)),
            "bytes": donor.stat().st_size,
            "sha256": digest(donor),
        },
        "normalization": normalization,
        "rawObjects": [raw_object_report(obj) for obj in objects],
        "weldToleranceStable": stable,
        "topologyByWeldTolerance": tolerance_reports,
    }


def run() -> dict[str, object]:
    report = {
        "schema": 1,
        "method": (
            "Fresh GLB import, bottom-centre normalization, world-space merge, "
            "coincident-position weld at three tolerances, triangulation, topology, "
            "self-intersection and vertical-ray inspection. Source files are read-only."
        ),
        "assets": [audit(asset_id, source, height) for asset_id, source, height in SOURCES],
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print("VESSEL_TOPOLOGY_AUDIT=" + json.dumps(report))
    return report


if __name__ == "__main__":
    run()
