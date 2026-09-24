"""Try one bounded topology repair of the Celadon remesh and gate its output."""

from __future__ import annotations

import json
import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree


HERE = Path(__file__).resolve().parents[1]
SOURCE = HERE / "meshy" / "celadon-lark-decanter-remesh-50k.glb"
REPORT = Path(__file__).with_name("celadon-remesh-repair-trial.json")
OUTPUT = Path(__file__).with_name("celadon-remesh-repaired-trial.glb")
TARGET_HEIGHT_METRES = 1.15
WELD_TOLERANCE_METRES = 1e-7
SAMPLE_LIMIT = 24_000


def mesh_objects() -> list[bpy.types.Object]:
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]


def world_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    return (
        Vector(min(point[axis] for point in points) for axis in range(3)),
        Vector(max(point[axis] for point in points) for axis in range(3)),
    )


def normalize(obj: bpy.types.Object) -> None:
    low, high = world_bounds([obj])
    scale = TARGET_HEIGHT_METRES / (high.z - low.z)
    centre = Vector(((low.x + high.x) / 2, (low.y + high.y) / 2, low.z))
    obj.data.transform(Matrix.Scale(scale, 4) @ Matrix.Translation(-centre) @ obj.matrix_world)
    obj.matrix_world = Matrix.Identity(4)
    obj.data.update()


def select_only(obj: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def weld_and_triangulate(obj: bpy.types.Object) -> None:
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    bmesh.ops.remove_doubles(mesh, verts=list(mesh.verts), dist=WELD_TOLERANCE_METRES)
    bmesh.ops.triangulate(mesh, faces=list(mesh.faces))
    bmesh.ops.recalc_face_normals(mesh, faces=list(mesh.faces))
    mesh.to_mesh(obj.data)
    mesh.free()
    obj.data.update()


def snapshot(obj: bpy.types.Object) -> dict[str, object]:
    obj.data.calc_loop_triangles()
    positions = [vertex.co.copy() for vertex in obj.data.vertices]
    triangles = [tuple(triangle.vertices) for triangle in obj.data.loop_triangles]
    return {
        "points": positions,
        "tree": BVHTree.FromPolygons(positions, triangles, all_triangles=True),
    }


def topology(obj: bpy.types.Object) -> dict[str, object]:
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    bmesh.ops.triangulate(mesh, faces=list(mesh.faces))
    mesh.normal_update()
    mesh.verts.ensure_lookup_table()
    mesh.edges.ensure_lookup_table()
    mesh.faces.ensure_lookup_table()
    tree = BVHTree.FromBMesh(mesh)
    intersections = sum(
        1
        for first, second in tree.overlap(tree)
        if first < second
        and not set(mesh.faces[first].verts).intersection(mesh.faces[second].verts)
    )
    result = {
        "vertices": len(mesh.verts),
        "edges": len(mesh.edges),
        "triangles": len(mesh.faces),
        "boundaryEdges": sum(edge.is_boundary for edge in mesh.edges),
        "nonManifoldEdges": sum(not edge.is_manifold for edge in mesh.edges),
        "nonManifoldVertices": sum(not vertex.is_manifold for vertex in mesh.verts),
        "nonContiguousEdges": sum(not edge.is_contiguous for edge in mesh.edges),
        "selfIntersectionPairs": intersections,
        "signedVolumeCubicMetres": mesh.calc_volume(signed=True),
    }
    result["passed"] = all(
        result[key] == 0
        for key in (
            "boundaryEdges",
            "nonManifoldEdges",
            "nonManifoldVertices",
            "nonContiguousEdges",
            "selfIntersectionPairs",
        )
    ) and result["signedVolumeCubicMetres"] > 0
    mesh.free()
    return result


def fill_boundaries(obj: bpy.types.Object) -> dict[str, object]:
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    boundaries = [edge for edge in mesh.edges if edge.is_boundary]
    result = bmesh.ops.holes_fill(mesh, edges=boundaries, sides=0)
    faces = list(result.get("faces", []))
    report = {
        "boundaryEdgesBefore": len(boundaries),
        "createdFaces": len(faces),
        "createdAreaSquareMetres": sum(face.calc_area() for face in faces),
        "maximumCreatedFaceAreaSquareMetres": max(
            (face.calc_area() for face in faces), default=0.0
        ),
    }
    bmesh.ops.triangulate(mesh, faces=list(mesh.faces))
    bmesh.ops.recalc_face_normals(mesh, faces=list(mesh.faces))
    mesh.to_mesh(obj.data)
    mesh.free()
    obj.data.update()
    return report


def exact_self_union(obj: bpy.types.Object) -> None:
    select_only(obj)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.intersect_boolean(operation="UNION", use_self=True, solver="EXACT")
    bpy.ops.object.mode_set(mode="OBJECT")
    obj.data.update()


def percentile(values: list[float], fraction: float) -> float:
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, round((len(ordered) - 1) * fraction))]


def summarize(values: list[float]) -> dict[str, float | int]:
    return {
        "samples": len(values),
        "meanMetres": sum(values) / len(values),
        "rmsMetres": math.sqrt(sum(value * value for value in values) / len(values)),
        "p95Metres": percentile(values, 0.95),
        "p99Metres": percentile(values, 0.99),
        "maxMetres": max(values),
    }


def sampled(points: list[Vector]) -> list[Vector]:
    stride = max(1, math.ceil(len(points) / SAMPLE_LIMIT))
    return points[::stride]


def fidelity(obj: bpy.types.Object, source: dict[str, object]) -> dict[str, object]:
    repaired = snapshot(obj)
    source_tree = source["tree"]
    repaired_tree = repaired["tree"]
    repaired_to_source = [
        source_tree.find_nearest(point)[3] for point in sampled(repaired["points"])
    ]
    source_to_repaired = [
        repaired_tree.find_nearest(point)[3] for point in sampled(source["points"])
    ]
    return {
        "repairedToRemesh": summarize(repaired_to_source),
        "remeshToRepaired": summarize(source_to_repaired),
    }


def run() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    objects = mesh_objects()
    if len(objects) != 1:
        raise ValueError(f"Expected one remesh object, found {len(objects)}")
    obj = objects[0]
    normalize(obj)
    weld_and_triangulate(obj)
    source = snapshot(obj)
    before = topology(obj)
    fill_report = fill_boundaries(obj)
    after_fill = topology(obj)
    exact_self_union(obj)
    weld_and_triangulate(obj)
    after_union = topology(obj)
    report = {
        "schema": 1,
        "method": (
            "One bounded trial: normalize and weld the Meshy 50k remesh, fill its "
            "small boundary loops, then apply Blender's exact self-union."
        ),
        "before": before,
        "boundaryFill": fill_report,
        "afterBoundaryFill": after_fill,
        "afterExactSelfUnion": after_union,
        "fidelityToUnrepairedRemesh": fidelity(obj, source),
        "outputWritten": False,
    }
    if after_union["passed"]:
        select_only(obj)
        obj.name = "celadon_remesh_repaired_trial"
        obj.data.name = obj.name + "_geometry"
        bpy.ops.export_scene.gltf(
            filepath=str(OUTPUT),
            export_format="GLB",
            use_selection=True,
            export_yup=True,
            export_apply=True,
        )
        report["outputWritten"] = True
        report["output"] = str(OUTPUT.relative_to(HERE))
    elif OUTPUT.exists():
        OUTPUT.unlink()
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print(f"CELADON_REPAIR_TRIAL={REPORT}", flush=True)
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    run()
