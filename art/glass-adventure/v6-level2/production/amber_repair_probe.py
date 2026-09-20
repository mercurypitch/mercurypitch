"""Measure bounded local repairs for the Amber donor's exact-union residue."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent


def load_pipeline():
    path = ROOT / "finalize_vessels.py"
    spec = importlib.util.spec_from_file_location("amber_vessel_pipeline", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def bad_region(obj: bpy.types.Object) -> dict[str, object]:
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bad = [edge for edge in bm.edges if not edge.is_manifold or not edge.is_contiguous]
    vertices = {vertex for edge in bad for vertex in edge.verts}
    points = [vertex.co.copy() for vertex in vertices]
    result = {
        "edges": [
            {
                "vertices": [list(vertex.co) for vertex in edge.verts],
                "linkedFaces": len(edge.link_faces),
                "lengthMetres": edge.calc_length(),
                "manifold": edge.is_manifold,
                "contiguous": edge.is_contiguous,
            }
            for edge in bad
        ],
        "vertexCount": len(vertices),
    }
    if points:
        low = Vector(min(point[axis] for point in points) for axis in range(3))
        high = Vector(max(point[axis] for point in points) for axis in range(3))
        result["boundsMetres"] = {
            "min": list(low),
            "max": list(high),
            "dimensions": list(high - low),
        }
    bm.free()
    return result


def copy_object(source: bpy.types.Object, name: str) -> bpy.types.Object:
    result = source.copy()
    result.data = source.data.copy()
    result.name = name
    bpy.context.scene.collection.objects.link(result)
    return result


def cleanup_trial(source: bpy.types.Object, distance: float) -> bpy.types.Object:
    obj = copy_object(source, f"cleanup_{distance:.0e}")
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=distance)
    bmesh.ops.dissolve_degenerate(bm, edges=list(bm.edges), dist=distance)
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return obj


def local_repatch_trial(source: bpy.types.Object) -> bpy.types.Object:
    obj = copy_object(source, "local_repatch")
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bad = [edge for edge in bm.edges if not edge.is_manifold or not edge.is_contiguous]
    faces = {face for edge in bad for face in edge.link_faces}
    bmesh.ops.delete(bm, geom=list(faces), context="FACES")
    wires = [edge for edge in bm.edges if not edge.link_faces]
    if wires:
        bmesh.ops.delete(bm, geom=wires, context="EDGES")
    boundary = [edge for edge in bm.edges if edge.is_boundary]
    bmesh.ops.holes_fill(bm, edges=boundary, sides=0)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-7)
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return obj


def split_bowtie_vertices(source: bpy.types.Object) -> tuple[bpy.types.Object, list[dict[str, object]]]:
    obj = copy_object(source, "local_repatch_split_bowties")
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    actions = []
    for vertex in [candidate for candidate in bm.verts if not candidate.is_manifold]:
        remaining = set(vertex.link_faces)
        components = []
        while remaining:
            seed = remaining.pop()
            component = {seed}
            stack = [seed]
            while stack:
                face = stack.pop()
                for edge in face.edges:
                    if vertex not in edge.verts:
                        continue
                    for neighbour in edge.link_faces:
                        if neighbour in remaining:
                            remaining.remove(neighbour)
                            component.add(neighbour)
                            stack.append(neighbour)
            components.append(component)
        if len(components) < 2:
            continue
        components.sort(key=len, reverse=True)
        actions.append(
            {
                "vertexMetres": list(vertex.co),
                "faceFanSizes": [len(component) for component in components],
            }
        )
        for component in components[1:]:
            bmesh.ops.split(bm, geom=list(component), use_only_faces=True)
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return obj, actions


def remove_bowtie_fans(source: bpy.types.Object) -> tuple[bpy.types.Object, list[dict[str, object]]]:
    obj = copy_object(source, "local_repatch_remove_bowtie_fans")
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    actions = []
    faces_to_delete = set()
    for vertex in [candidate for candidate in bm.verts if not candidate.is_manifold]:
        remaining = set(vertex.link_faces)
        components = []
        while remaining:
            seed = remaining.pop()
            component = {seed}
            stack = [seed]
            while stack:
                face = stack.pop()
                for edge in face.edges:
                    if vertex not in edge.verts:
                        continue
                    for neighbour in edge.link_faces:
                        if neighbour in remaining:
                            remaining.remove(neighbour)
                            component.add(neighbour)
                            stack.append(neighbour)
            components.append(component)
        if len(components) < 2:
            continue
        components.sort(key=len, reverse=True)
        actions.append(
            {
                "vertexMetres": list(vertex.co),
                "faceFanSizes": [len(component) for component in components],
                "deletedFaces": sum(len(component) for component in components[1:]),
            }
        )
        for component in components[1:]:
            faces_to_delete.update(component)
    if faces_to_delete:
        bmesh.ops.delete(bm, geom=list(faces_to_delete), context="FACES")
    wires = [edge for edge in bm.edges if not edge.link_faces]
    if wires:
        bmesh.ops.delete(bm, geom=wires, context="EDGES")
    boundary = [edge for edge in bm.edges if edge.is_boundary]
    if boundary:
        bmesh.ops.holes_fill(bm, edges=boundary, sides=0)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-7)
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return obj, actions


def main() -> None:
    pipeline = load_pipeline()
    config = pipeline.ASSETS["amber-cadence-urn"]
    obj, normalization = pipeline.normalized_import(config)
    source = pipeline.geometry_snapshot(obj)
    weld = pipeline.weld_and_triangulate(obj)
    exact_union = pipeline.exact_self_union(obj)
    collapsed = pipeline.solid.remove_collapsed_components(obj)
    baseline = pipeline.topology(obj)
    trials = []
    for distance in (1e-7, 1e-6, 1e-5, 5e-5, 1e-4):
        trial = cleanup_trial(obj, distance)
        trials.append(
            {
                "method": "remove doubles plus dissolve degenerate",
                "distanceMetres": distance,
                "topology": pipeline.topology(trial),
                "fidelity": pipeline.fidelity(trial, source),
                "badRegion": bad_region(trial),
            }
        )
    repatch = local_repatch_trial(obj)
    trials.append(
        {
            "method": "delete faces incident to residual edges, then fill local boundary",
            "topology": pipeline.topology(repatch),
            "fidelity": pipeline.fidelity(repatch, source),
            "badRegion": bad_region(repatch),
        }
    )
    split_repatch, split_actions = split_bowtie_vertices(repatch)
    trials.append(
        {
            "method": "local repatch plus split disconnected face fans at bow-tie vertices",
            "splitActions": split_actions,
            "topology": pipeline.topology(split_repatch),
            "fidelity": pipeline.fidelity(split_repatch, source),
            "badRegion": bad_region(split_repatch),
        }
    )
    reunioned = copy_object(repatch, "local_repatch_reunion")
    reunion = pipeline.exact_self_union(reunioned)
    trials.append(
        {
            "method": "local repatch followed by exact self-union",
            "exactSelfUnion": reunion,
            "topology": pipeline.topology(reunioned),
            "fidelity": pipeline.fidelity(reunioned, source),
            "badRegion": bad_region(reunioned),
        }
    )
    trimmed_repatch, trim_actions = remove_bowtie_fans(repatch)
    trials.append(
        {
            "method": "local repatch plus delete smaller disconnected face fan and refill",
            "trimActions": trim_actions,
            "topology": pipeline.topology(trimmed_repatch),
            "fidelity": pipeline.fidelity(trimmed_repatch, source),
            "badRegion": bad_region(trimmed_repatch),
        }
    )
    report = {
        "schema": 1,
        "assetId": "amber-cadence-urn",
        "normalization": normalization,
        "weld": weld,
        "exactSelfUnion": exact_union,
        "collapsedComponents": collapsed,
        "baseline": baseline,
        "baselineBadRegion": bad_region(obj),
        "trials": trials,
    }
    path = HERE / "amber-repair-probe.json"
    path.write_text(json.dumps(report, indent=2) + "\n")
    print("AMBER_REPAIR_PROBE=" + json.dumps(report), flush=True)


if __name__ == "__main__":
    main()
