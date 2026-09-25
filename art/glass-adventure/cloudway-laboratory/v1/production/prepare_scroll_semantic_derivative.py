#!/usr/bin/env python3
"""Build a closed, source-preserving scroll deck/roller derivative for review."""

from __future__ import annotations

import argparse
import bmesh
import importlib.util
import json
import math
import os
from pathlib import Path
import sys
from typing import Any

import bpy
from mathutils import Matrix, Vector
import numpy as np


HERE = Path(__file__).resolve().parent


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load {path.name}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


PREPARE = load_module("cloudway_prepare_dense_master", HERE / "prepare_dense_master.py")
FEASIBILITY = load_module(
    "cloudway_scroll_feasibility", HERE / "audit_scroll_separation_feasibility.py"
)
SOURCE = PREPARE.SOURCE
ASSET = "gilt-scroll-bridge"
CUT_Y = 0.30
MIN_LENGTH_RATIO = 0.25
SOURCE_TO_CANONICAL_Z_DEGREES = -90.0
ROOT_NAME = "Cloudway_GiltScrollBridge_SemanticDerivative"
ROLE_ORDER = ("negativeRoller", "deck", "positiveRoller")
ROLE_ROOTS = {
    "negativeRoller": "ScrollRollerNegative",
    "deck": "ScrollDeck",
    "positiveRoller": "ScrollRollerPositive",
}
ROLE_OBJECTS = {
    "negativeRoller": "ScrollRollerNegativeGeometry",
    "deck": "ScrollDeckGeometry",
    "positiveRoller": "ScrollRollerPositiveGeometry",
}
ROLE_COLORS = {
    "negativeRoller": (1.0, 0.18, 0.04),
    "deck": (0.02, 0.65, 1.0),
    "positiveRoller": (0.88, 0.03, 0.72),
}
SOURCE_VERTEX_ID = FEASIBILITY.SOURCE_VERTEX_ID
SOURCE_POLYGON_ID = FEASIBILITY.SOURCE_POLYGON_ID
SOURCE_LOOP_ID = FEASIBILITY.SOURCE_LOOP_ID
FACE_KIND = "cloudway_face_kind"
FACE_RETAINED = 0
FACE_CLIPPED = 1
FACE_CAP = 2
CAP_MATERIAL_NAME = "GiltScrollCutCap_Diagnostic"
BOUNDARY_EPSILON = 1e-7


def paths() -> dict[str, Path]:
    asset_dir = SOURCE / "blender" / ASSET
    proof_dir = SOURCE / "proofs" / "blender" / ASSET / "semantic-derivative"
    report_dir = SOURCE / "production" / ASSET
    return {
        "baseline": asset_dir / f"{ASSET}-dense-master.blend",
        "baselineReport": HERE / "reports" / f"{ASSET}-dense-master.json",
        "feasibility": HERE / "reports" / f"{ASSET}-scroll-separation-feasibility.json",
        "candidate": asset_dir / f"{ASSET}-semantic-derivative.blend",
        "proofDir": proof_dir,
        "report": report_dir / "scroll-semantic-derivative-report.json",
        "mirror": HERE / "reports" / f"{ASSET}-scroll-semantic-derivative.json",
    }


def require(condition: bool, message: str) -> None:
    FEASIBILITY.require(condition, message)


def add_provenance_attributes(mesh: bpy.types.Mesh) -> None:
    definitions = (
        (SOURCE_VERTEX_ID, "POINT", len(mesh.vertices), np.arange(len(mesh.vertices))),
        (SOURCE_POLYGON_ID, "FACE", len(mesh.polygons), np.arange(len(mesh.polygons))),
        (SOURCE_LOOP_ID, "CORNER", len(mesh.loops), np.arange(len(mesh.loops))),
        (FACE_KIND, "FACE", len(mesh.polygons), np.zeros(len(mesh.polygons))),
    )
    for name, domain, count, values in definitions:
        require(mesh.attributes.get(name) is None, f"Source already has {name}")
        attribute = mesh.attributes.new(name, "INT", domain)
        attribute.data.foreach_set("value", np.asarray(values, dtype=np.int32))
        require(len(attribute.data) == count, f"{name} length differs")


def boundary_edges(edit: bmesh.types.BMesh, plane: float) -> list[Any]:
    return [
        edge
        for edge in edit.edges
        if len(edge.link_faces) == 1
        and all(abs(float(vertex.co.y) - plane) <= BOUNDARY_EPSILON for vertex in edge.verts)
    ]


def boundary_components(edges: list[Any]) -> list[list[Any]]:
    edge_set = set(edges)
    unseen = set(edges)
    components: list[list[Any]] = []
    while unseen:
        pending = [unseen.pop()]
        component: list[Any] = []
        while pending:
            current = pending.pop()
            component.append(current)
            for vertex in current.verts:
                for neighbour in vertex.link_edges:
                    if neighbour in edge_set and neighbour in unseen:
                        unseen.remove(neighbour)
                        pending.append(neighbour)
        components.append(component)
    return components


def cut_and_close(
    edit: bmesh.types.BMesh,
    plane: float,
    keep: str,
    desired_cap_normal_y: float,
) -> dict[str, Any]:
    require(keep in ("below", "above"), "Invalid bisect half-space")
    result = bmesh.ops.bisect_plane(
        edit,
        geom=list(edit.verts) + list(edit.edges) + list(edit.faces),
        dist=1e-8,
        plane_co=Vector((0.0, plane, 0.0)),
        plane_no=Vector((0.0, 1.0, 0.0)),
        clear_inner=keep == "above",
        clear_outer=keep == "below",
        use_snap_center=False,
    )
    initial_boundary = boundary_edges(edit, plane)
    require(initial_boundary, f"No boundary at source Y={plane}")
    boundary_vertices = list({vertex for edge in initial_boundary for vertex in edge.verts})
    vertex_count_before_weld = len(edit.verts)
    bmesh.ops.remove_doubles(edit, verts=boundary_vertices, dist=1e-8)
    edit.verts.ensure_lookup_table()
    edit.edges.ensure_lookup_table()
    final_boundary = boundary_edges(edit, plane)
    final_vertices = list({vertex for edge in final_boundary for vertex in edge.verts})
    source_vertex_layer = edit.verts.layers.int.get(SOURCE_VERTEX_ID)
    require(source_vertex_layer is not None, "Source vertex provenance layer is absent")
    for vertex in final_vertices:
        vertex[source_vertex_layer] = -1
    degree = {vertex: 0 for vertex in final_vertices}
    for edge in final_boundary:
        for vertex in edge.verts:
            degree[vertex] += 1
    require(
        final_vertices and all(value == 2 for value in degree.values()),
        f"Cut boundary at source Y={plane} is not closed degree-two loops",
    )
    components = boundary_components(final_boundary)
    fill = bmesh.ops.holes_fill(edit, edges=final_boundary, sides=0)
    cap_ngons = list(fill.get("faces", []))
    require(
        len(cap_ngons) == len(components),
        f"Cap count differs from boundary-loop count at source Y={plane}",
    )
    triangle_result = bmesh.ops.triangulate(
        edit,
        faces=cap_ngons,
        quad_method="BEAUTY",
        ngon_method="BEAUTY",
    )
    cap_faces = list(triangle_result.get("faces", []))
    require(cap_faces, f"Cap triangulation is empty at source Y={plane}")
    source_face_layer = edit.faces.layers.int.get(SOURCE_POLYGON_ID)
    face_kind_layer = edit.faces.layers.int.get(FACE_KIND)
    source_loop_layer = edit.loops.layers.int.get(SOURCE_LOOP_ID)
    require(source_face_layer is not None, "Source face provenance layer is absent")
    require(face_kind_layer is not None, "Face-kind provenance layer is absent")
    require(source_loop_layer is not None, "Source loop provenance layer is absent")
    for face in cap_faces:
        face[source_face_layer] = -1
        face[face_kind_layer] = FACE_CAP
        face.material_index = 1
        face.normal_update()
        if float(face.normal.y) * desired_cap_normal_y < 0.0:
            face.normal_flip()
        for loop in face.loops:
            loop[source_loop_layer] = -1
    return {
        "sourcePlaneY": plane,
        "keptHalfSpace": keep,
        "initialBoundaryEdges": len(initial_boundary),
        "boundaryVerticesWelded": vertex_count_before_weld - len(edit.verts),
        "closedBoundaryEdges": len(final_boundary),
        "closedBoundaryVertices": len(final_vertices),
        "closedBoundaryLoops": len(components),
        "boundaryLoopEdgeCounts": sorted(len(component) for component in components),
        "capTriangles": len(cap_faces),
        "desiredOutwardNormalSourceY": desired_cap_normal_y,
    }


def classify_surface_faces(
    edit: bmesh.types.BMesh,
    source_triangles: np.ndarray,
) -> dict[str, int]:
    source_vertex_layer = edit.verts.layers.int.get(SOURCE_VERTEX_ID)
    source_face_layer = edit.faces.layers.int.get(SOURCE_POLYGON_ID)
    source_loop_layer = edit.loops.layers.int.get(SOURCE_LOOP_ID)
    face_kind_layer = edit.faces.layers.int.get(FACE_KIND)
    require(source_vertex_layer is not None, "Source vertex layer is absent")
    require(source_face_layer is not None, "Source face layer is absent")
    require(source_loop_layer is not None, "Source loop layer is absent")
    require(face_kind_layer is not None, "Face kind layer is absent")
    non_triangles = [
        face
        for face in edit.faces
        if face[face_kind_layer] != FACE_CAP and len(face.verts) != 3
    ]
    if non_triangles:
        bmesh.ops.triangulate(
            edit,
            faces=non_triangles,
            quad_method="BEAUTY",
            ngon_method="BEAUTY",
        )
    edit.faces.ensure_lookup_table()
    retained = 0
    clipped = 0
    cap = 0
    for face in edit.faces:
        if face[face_kind_layer] == FACE_CAP:
            cap += 1
            continue
        source_face_id = int(face[source_face_layer])
        vertex_ids = [int(vertex[source_vertex_layer]) for vertex in face.verts]
        exact = False
        if 0 <= source_face_id < len(source_triangles) and min(vertex_ids) >= 0:
            expected = source_triangles[source_face_id].tolist()
            exact = len(vertex_ids) == 3 and set(vertex_ids) == set(expected)
        if exact:
            face[face_kind_layer] = FACE_RETAINED
            retained += 1
            expected = source_triangles[source_face_id].tolist()
            for loop in face.loops:
                source_vertex_id = int(loop.vert[source_vertex_layer])
                loop[source_loop_layer] = source_face_id * 3 + expected.index(
                    source_vertex_id
                )
        else:
            face[face_kind_layer] = FACE_CLIPPED
            clipped += 1
            for loop in face.loops:
                loop[source_loop_layer] = -1
    return {"retainedSourceTriangles": retained, "clippedSurfaceTriangles": clipped, "capTriangles": cap}


def planar_cap_uvs(edit: bmesh.types.BMesh, source_bounds: tuple[np.ndarray, np.ndarray]) -> None:
    uv_layer = edit.loops.layers.uv.active
    face_kind_layer = edit.faces.layers.int.get(FACE_KIND)
    require(uv_layer is not None, "Source UV layer is absent in BMesh")
    require(face_kind_layer is not None, "Face kind layer is absent")
    low, high = source_bounds
    width = max(float(high[0] - low[0]), 1e-9)
    height = max(float(high[2] - low[2]), 1e-9)
    for face in edit.faces:
        if face[face_kind_layer] != FACE_CAP:
            continue
        for loop in face.loops:
            loop[uv_layer].uv = (
                (float(loop.vert.co.x) - float(low[0])) / width,
                (float(loop.vert.co.z) - float(low[2])) / height,
            )


def set_cap_normals(mesh: bpy.types.Mesh, desired_by_plane: dict[float, float]) -> None:
    kind_attribute = mesh.attributes.get(FACE_KIND)
    require(kind_attribute is not None, "Derivative face-kind attribute is absent")
    normals = np.empty(len(mesh.corner_normals) * 3, dtype=np.float32)
    mesh.corner_normals.foreach_get("vector", normals)
    normals = normals.reshape((-1, 3))
    for polygon in mesh.polygons:
        if int(kind_attribute.data[polygon.index].value) != FACE_CAP:
            continue
        plane = round(float(mesh.vertices[polygon.vertices[0]].co.y), 6)
        desired = desired_by_plane.get(plane)
        require(desired is not None, f"Unexpected cap plane {plane}")
        normals[polygon.loop_start : polygon.loop_start + polygon.loop_total] = (
            0.0,
            desired,
            0.0,
        )
    mesh.normals_split_custom_set([tuple(value) for value in normals])
    mesh.update()


def restore_retained_normal_directions(
    mesh: bpy.types.Mesh,
    source_corner_normals: np.ndarray,
) -> None:
    source_loop_attribute = mesh.attributes.get(SOURCE_LOOP_ID)
    require(source_loop_attribute is not None, "Derivative source loop IDs are absent")
    loop_ids = np.empty(len(mesh.loops), dtype=np.int32)
    source_loop_attribute.data.foreach_get("value", loop_ids)
    normals = np.empty(len(mesh.corner_normals) * 3, dtype=np.float32)
    mesh.corner_normals.foreach_get("vector", normals)
    normals = normals.reshape((-1, 3))
    retained = loop_ids >= 0
    normals[retained] = source_corner_normals[loop_ids[retained]]
    mesh.normals_split_custom_set([tuple(value) for value in normals])
    mesh.update()


def welded_closure(mesh: bpy.types.Mesh) -> dict[str, Any]:
    positions, triangles = PREPARE.mesh_arrays(mesh)
    welded_positions, index_to_welded = np.unique(
        positions, axis=0, return_inverse=True
    )
    welded_triangles = index_to_welded[triangles]
    edges = np.concatenate(
        (
            welded_triangles[:, (0, 1)],
            welded_triangles[:, (1, 2)],
            welded_triangles[:, (2, 0)],
        ),
        axis=0,
    )
    edges = np.sort(edges, axis=1)
    edges = edges[edges[:, 0] != edges[:, 1]]
    unique_edges, incident_counts = np.unique(edges, axis=0, return_counts=True)
    require(
        np.all(incident_counts == 2),
        f"{mesh.name} is not closed after exact-position welding",
    )
    labels = FEASIBILITY.connected_labels(len(welded_positions), unique_edges)
    return {
        "indexedVertices": len(positions),
        "triangles": len(triangles),
        "exactWeldedPositions": len(welded_positions),
        "exactWeldedEdges": len(unique_edges),
        "weldedEdgesWithOneIncidentTriangle": int(np.count_nonzero(incident_counts == 1)),
        "weldedEdgesWithTwoIncidentTriangles": int(np.count_nonzero(incident_counts == 2)),
        "weldedEdgesWithMoreThanTwoIncidentTriangles": int(np.count_nonzero(incident_counts > 2)),
        "weldedConnectedComponents": int(labels.max()) + 1,
        "closedTwoManifoldAfterExactPositionWeld": True,
    }


def derivative_channel_audit(
    mesh: bpy.types.Mesh,
    source: dict[str, Any],
) -> dict[str, Any]:
    source_vertex_attribute = mesh.attributes.get(SOURCE_VERTEX_ID)
    source_face_attribute = mesh.attributes.get(SOURCE_POLYGON_ID)
    source_loop_attribute = mesh.attributes.get(SOURCE_LOOP_ID)
    face_kind_attribute = mesh.attributes.get(FACE_KIND)
    require(source_vertex_attribute is not None, "Derivative source vertex IDs absent")
    require(source_face_attribute is not None, "Derivative source face IDs absent")
    require(source_loop_attribute is not None, "Derivative source loop IDs absent")
    require(face_kind_attribute is not None, "Derivative face kinds absent")
    vertex_ids = np.empty(len(mesh.vertices), dtype=np.int32)
    source_vertex_attribute.data.foreach_get("value", vertex_ids)
    positions = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
    mesh.vertices.foreach_get("co", positions)
    positions = positions.reshape((-1, 3))
    retained_vertex_mask = vertex_ids >= 0
    require(
        np.array_equal(
            positions[retained_vertex_mask], source["positions"][vertex_ids[retained_vertex_mask]]
        ),
        "Retained source vertex positions changed",
    )
    loop_ids = np.empty(len(mesh.loops), dtype=np.int32)
    source_loop_attribute.data.foreach_get("value", loop_ids)
    retained_loop_mask = loop_ids >= 0
    uvs = FEASIBILITY.corner_uvs(mesh)
    encoded_normals = FEASIBILITY.encoded_custom_normals(mesh)
    evaluated_normals = FEASIBILITY.evaluated_corner_normals(mesh)
    require(
        np.array_equal(uvs[retained_loop_mask], source["uvs"][loop_ids[retained_loop_mask]]),
        "Retained source corner UVs changed",
    )
    encoded_matches = np.all(
        encoded_normals[retained_loop_mask]
        == source["encodedNormals"][loop_ids[retained_loop_mask]],
        axis=1,
    )
    normal_deltas = np.linalg.norm(
        evaluated_normals[retained_loop_mask]
        - source["cornerNormals"][loop_ids[retained_loop_mask]],
        axis=1,
    )
    normal_dots = np.sum(
        evaluated_normals[retained_loop_mask]
        * source["cornerNormals"][loop_ids[retained_loop_mask]],
        axis=1,
    )
    normal_angles = np.degrees(np.arccos(np.clip(normal_dots, -1.0, 1.0)))
    face_ids = np.empty(len(mesh.polygons), dtype=np.int32)
    kinds = np.empty(len(mesh.polygons), dtype=np.int32)
    source_face_attribute.data.foreach_get("value", face_ids)
    face_kind_attribute.data.foreach_get("value", kinds)
    retained_face_ids = face_ids[kinds == FACE_RETAINED]
    require(len(np.unique(retained_face_ids)) == len(retained_face_ids), "Retained faces repeat")
    return {
        "retainedSourceVertices": int(retained_vertex_mask.sum()),
        "retainedSourceCorners": int(retained_loop_mask.sum()),
        "retainedSourceTriangles": int(np.count_nonzero(kinds == FACE_RETAINED)),
        "clippedSurfaceTriangles": int(np.count_nonzero(kinds == FACE_CLIPPED)),
        "authoredCapTriangles": int(np.count_nonzero(kinds == FACE_CAP)),
        "retainedPositionsFloat32Exact": True,
        "retainedUvsFloat32Exact": True,
        "retainedEncodedNormalCoefficientsExact": int(encoded_matches.sum()),
        "retainedEncodedNormalCoefficientsChangedAtNewTopology": int(
            len(encoded_matches) - encoded_matches.sum()
        ),
        "retainedEvaluatedNormalMaxDelta": round(float(normal_deltas.max(initial=0.0)), 9),
        "retainedEvaluatedNormalP95Delta": round(
            float(np.percentile(normal_deltas, 95)) if len(normal_deltas) else 0.0,
            9,
        ),
        "retainedExportedNormalMaxAngleDegrees": round(
            float(normal_angles.max(initial=0.0)), 9
        ),
        "retainedExportedNormalP95AngleDegrees": round(
            float(np.percentile(normal_angles, 95)) if len(normal_angles) else 0.0,
            9,
        ),
        "retainedExportedNormalsOverOneDegree": int(
            np.count_nonzero(normal_angles > 1.0)
        ),
        "retainedFaceIdsUnique": True,
    }


def build_role_mesh(
    source_mesh: bpy.types.Mesh,
    source: dict[str, Any],
    role: str,
    cap_material: bpy.types.Material,
) -> tuple[bpy.types.Mesh, dict[str, Any]]:
    mesh = source_mesh.copy()
    mesh.name = f"{ROLE_OBJECTS[role]}Data"
    add_provenance_attributes(mesh)
    mesh.materials.append(cap_material)
    edit = bmesh.new()
    edit.from_mesh(mesh)
    source_bounds = (source["positions"].min(axis=0), source["positions"].max(axis=0))
    if role == "negativeRoller":
        cut_rows = [cut_and_close(edit, -CUT_Y, "below", 1.0)]
        desired_by_plane = {-CUT_Y: 1.0}
    elif role == "deck":
        cut_rows = [
            cut_and_close(edit, -CUT_Y, "above", -1.0),
            cut_and_close(edit, CUT_Y, "below", 1.0),
        ]
        desired_by_plane = {-CUT_Y: -1.0, CUT_Y: 1.0}
    elif role == "positiveRoller":
        cut_rows = [cut_and_close(edit, CUT_Y, "above", -1.0)]
        desired_by_plane = {CUT_Y: -1.0}
    else:
        raise ValueError(role)
    face_counts = classify_surface_faces(edit, source["triangles"])
    planar_cap_uvs(edit, source_bounds)
    edit.to_mesh(mesh)
    edit.free()
    mesh.update()
    set_cap_normals(mesh, {round(key, 6): value for key, value in desired_by_plane.items()})
    restore_retained_normal_directions(mesh, source["cornerNormals"])
    channel_audit = derivative_channel_audit(mesh, source)
    require(
        channel_audit["retainedExportedNormalMaxAngleDegrees"] <= 1.0,
        f"{role} changed retained exported custom-normal directions: "
        f"max={channel_audit['retainedExportedNormalMaxAngleDegrees']} degrees, "
        f"p95={channel_audit['retainedExportedNormalP95AngleDegrees']} degrees",
    )
    closure = welded_closure(mesh)
    return mesh, {
        "cuts": cut_rows,
        "faceCounts": face_counts,
        "channelPreservation": channel_audit,
        "closure": closure,
        "materialSlots": [material.name for material in mesh.materials],
    }


def make_empty(
    name: str,
    collection: bpy.types.Collection,
    parent: bpy.types.Object | None = None,
) -> bpy.types.Object:
    result = bpy.data.objects.new(name, None)
    result.empty_display_type = "PLAIN_AXES"
    collection.objects.link(result)
    result.parent = parent
    return result


def diagnostic_material(name: str, color: tuple[float, float, float]) -> Any:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = (*color, 1.0)
    shader = material.node_tree.nodes.get("Principled BSDF")
    require(shader is not None, f"{name} has no Principled shader")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Metallic"].default_value = 0.05
    shader.inputs["Roughness"].default_value = 0.34
    return material


def cap_material() -> bpy.types.Material:
    material = bpy.data.materials.get(CAP_MATERIAL_NAME) or bpy.data.materials.new(
        CAP_MATERIAL_NAME
    )
    material.use_nodes = True
    material.diffuse_color = (1.0, 0.72, 0.03, 1.0)
    shader = material.node_tree.nodes.get("Principled BSDF")
    require(shader is not None, "Cap material has no Principled shader")
    shader.inputs["Base Color"].default_value = (1.0, 0.38, 0.015, 1.0)
    shader.inputs["Metallic"].default_value = 0.0
    shader.inputs["Roughness"].default_value = 0.28
    return material


def set_motion_state(
    roots: dict[str, bpy.types.Object],
    ratio: float,
    edge_metres: float,
) -> None:
    require(MIN_LENGTH_RATIO <= ratio <= 1.0, "Motion ratio is outside review range")
    for root in roots.values():
        root.location = (0.0, 0.0, 0.0)
        root.scale = (1.0, 1.0, 1.0)
    roots["deck"].scale.x = ratio
    inward = edge_metres * (1.0 - ratio)
    roots["negativeRoller"].location.x = inward
    roots["positiveRoller"].location.x = -inward


def proof_record(path: Path) -> dict[str, Any]:
    return PREPARE.file_record(path, PREPARE.RESOLUTION)


def render_proofs(
    scene: bpy.types.Scene,
    camera: bpy.types.Object,
    objects: dict[str, bpy.types.Object],
    roots: dict[str, bpy.types.Object],
    provider_material: bpy.types.Material,
    cap: bpy.types.Material,
    bounds: tuple[np.ndarray, np.ndarray],
    edge_metres: float,
    proof_dir: Path,
) -> dict[str, Any]:
    role_materials = {
        role: diagnostic_material(f"Semantic derivative {role}", ROLE_COLORS[role])
        for role in ROLE_ORDER
    }
    scene.render.resolution_x = PREPARE.RESOLUTION[0]
    scene.render.resolution_y = PREPARE.RESOLUTION[1]
    scene.render.resolution_percentage = 100
    for role, obj in objects.items():
        obj.data.materials[0] = role_materials[role]
        obj.data.materials[1] = cap
    motion: dict[str, Any] = {}
    PREPARE.configure_view(camera, "three-quarter", bounds)
    for progress, label in ((0.0, "000"), (0.25, "025"), (1.0, "100")):
        ratio = MIN_LENGTH_RATIO + (1.0 - MIN_LENGTH_RATIO) * progress
        set_motion_state(roots, ratio, edge_metres)
        target = proof_dir / f"semantic-motion-{label}.png"
        PREPARE.render_atomic(scene, target)
        motion[label] = {
            "progress": progress,
            "lengthRatio": ratio,
            **proof_record(target),
        }
    set_motion_state(roots, 1.0, edge_metres)
    PREPARE.configure_view(camera, "top", bounds)
    top = proof_dir / "semantic-regions-top.png"
    PREPARE.render_atomic(scene, top)

    roots["negativeRoller"].location.x = -0.10
    roots["positiveRoller"].location.x = 0.10
    PREPARE.configure_view(camera, "three-quarter", bounds)
    exploded = proof_dir / "semantic-cut-caps-exploded.png"
    PREPARE.render_atomic(scene, exploded)

    for obj in objects.values():
        obj.data.materials[0] = provider_material
        obj.data.materials[1] = cap
    pbr: dict[str, Any] = {}
    for progress, label in ((1.0, "100"), (0.0, "000")):
        ratio = MIN_LENGTH_RATIO + (1.0 - MIN_LENGTH_RATIO) * progress
        set_motion_state(roots, ratio, edge_metres)
        PREPARE.configure_view(camera, "three-quarter", bounds)
        target = proof_dir / f"provider-pbr-motion-{label}.png"
        PREPARE.render_atomic(scene, target)
        pbr[label] = {
            "progress": progress,
            "lengthRatio": ratio,
            **proof_record(target),
        }
    set_motion_state(roots, 1.0, edge_metres)
    return {
        "resolution": list(PREPARE.RESOLUTION),
        "semanticMotion": motion,
        "semanticTop": proof_record(top),
        "explodedCapInspection": proof_record(exploded),
        "providerPbrMotion": pbr,
        "legend": {
            "negativeRoller": "orange",
            "deck": "blue",
            "positiveRoller": "magenta",
            "authoredCutCaps": "amber",
        },
    }


def boundary_position_set(
    mesh: bpy.types.Mesh,
    source_plane: float,
    matrix: Matrix,
) -> np.ndarray:
    points = np.asarray(
        [tuple(vertex.co) for vertex in mesh.vertices if abs(vertex.co.y - source_plane) <= BOUNDARY_EPSILON],
        dtype=np.float64,
    )
    require(len(points) > 0, f"No derivative boundary vertices at {source_plane}")
    world = FEASIBILITY.world_points(points, matrix)
    return np.unique(np.round(world, decimals=9), axis=0)


def motion_boundary_audit(
    meshes: dict[str, bpy.types.Mesh],
    matrix: Matrix,
    edge_metres: float,
) -> dict[str, Any]:
    deck_negative = boundary_position_set(meshes["deck"], -CUT_Y, matrix)
    roller_negative = boundary_position_set(meshes["negativeRoller"], -CUT_Y, matrix)
    deck_positive = boundary_position_set(meshes["deck"], CUT_Y, matrix)
    roller_positive = boundary_position_set(meshes["positiveRoller"], CUT_Y, matrix)
    require(np.array_equal(deck_negative, roller_negative), "Negative full boundary differs")
    require(np.array_equal(deck_positive, roller_positive), "Positive full boundary differs")
    states: dict[str, Any] = {}
    for progress, label in ((0.0, "000"), (0.25, "025"), (1.0, "100")):
        ratio = MIN_LENGTH_RATIO + (1.0 - MIN_LENGTH_RATIO) * progress
        transformed_deck_negative = deck_negative.copy()
        transformed_deck_positive = deck_positive.copy()
        transformed_roller_negative = roller_negative.copy()
        transformed_roller_positive = roller_positive.copy()
        transformed_deck_negative[:, 0] *= ratio
        transformed_deck_positive[:, 0] *= ratio
        inward = edge_metres * (1.0 - ratio)
        transformed_roller_negative[:, 0] += inward
        transformed_roller_positive[:, 0] -= inward
        negative_delta = np.abs(
            transformed_deck_negative - transformed_roller_negative
        ).max(initial=0.0)
        positive_delta = np.abs(
            transformed_deck_positive - transformed_roller_positive
        ).max(initial=0.0)
        require(
            max(negative_delta, positive_delta) <= 1e-7,
            "Motion boundaries separate: "
            f"negative={negative_delta}, positive={positive_delta}, edge={edge_metres}",
        )
        states[label] = {
            "progress": progress,
            "lengthRatio": ratio,
            "negativeBoundaryMaxDeltaMetres": round(float(negative_delta), 12),
            "positiveBoundaryMaxDeltaMetres": round(float(positive_delta), 12),
        }
    return {
        "negativeBoundaryPositions": len(deck_negative),
        "positiveBoundaryPositions": len(deck_positive),
        "states": states,
        "coincidentAtAllProofStates": True,
    }


def save_atomic(target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(f".{target.stem}.tmp{target.suffix}")
    temporary.unlink(missing_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(temporary), check_existing=False)
    require(temporary.is_file(), f"Blender did not save {temporary}")
    os.replace(temporary, target)


def build() -> dict[str, Any]:
    output = paths()
    output["proofDir"].mkdir(parents=True, exist_ok=True)
    baseline_report = json.loads(output["baselineReport"].read_text())
    feasibility = json.loads(output["feasibility"].read_text())
    require(
        feasibility["status"] == "rejected-chart-component-split",
        "The required split rejection report is absent",
    )
    require(
        PREPARE.digest(output["baseline"]) == baseline_report["packedBlend"]["sha256"],
        "Dense master differs from its report",
    )
    bpy.ops.wm.open_mainfile(filepath=str(output["baseline"]), load_ui=False)
    bpy.context.preferences.filepaths.save_version = 0
    source_object = bpy.data.objects.get(f"{ASSET}__raw_import")
    review_object = bpy.data.objects.get(f"{ASSET}__normalized_review")
    require(source_object is not None, "Hidden raw source object is absent")
    require(review_object is not None, "Normalized dense review object is absent")
    source_mesh = source_object.data
    source = FEASIBILITY.source_payload(source_mesh)
    cap = cap_material()
    role_meshes: dict[str, bpy.types.Mesh] = {}
    role_reports: dict[str, Any] = {}
    for role in ROLE_ORDER:
        mesh, row = build_role_mesh(source_mesh, source, role, cap)
        role_meshes[role] = mesh
        role_reports[role] = row

    normalization = Matrix(baseline_report["geometry"]["normalizationMatrix"])
    alignment = Matrix.Rotation(
        math.radians(SOURCE_TO_CANONICAL_Z_DEGREES), 4, "Z"
    )
    source_to_canonical = alignment @ normalization
    source_to_canonical[0][3] = 0.0
    determinant = float(source_to_canonical.to_3x3().determinant())
    require(determinant > 0.0, "Canonical transform mirrors the source")
    canonical_positive_boundary = boundary_position_set(
        role_meshes["deck"], CUT_Y, source_to_canonical
    )
    edge_metres = float(np.median(np.abs(canonical_positive_boundary[:, 0])))
    canonical_points = FEASIBILITY.world_points(source["positions"], source_to_canonical)
    canonical_bounds = (canonical_points.min(axis=0), canonical_points.max(axis=0))
    canonical_dimensions = canonical_bounds[1] - canonical_bounds[0]

    collection = bpy.data.collections.new("Cloudway Gilt Scroll Semantic Derivative")
    bpy.context.scene.collection.children.link(collection)
    root = make_empty(ROOT_NAME, collection)
    roots: dict[str, bpy.types.Object] = {}
    objects: dict[str, bpy.types.Object] = {}
    for role in ROLE_ORDER:
        role_root = make_empty(ROLE_ROOTS[role], collection, root)
        role_root["platformRole"] = role
        obj = bpy.data.objects.new(ROLE_OBJECTS[role], role_meshes[role])
        collection.objects.link(obj)
        obj.parent = role_root
        obj.matrix_local = source_to_canonical
        obj["sourceAssetId"] = ASSET
        obj["sourceRole"] = role
        obj["retainedSourceSurface"] = True
        obj["authoredCutCaps"] = True
        roots[role] = role_root
        objects[role] = obj
    root["status"] = "semantic derivative; review required"
    root["sourceAssetId"] = ASSET
    root["sourceMasterSha256"] = baseline_report["packedBlend"]["sha256"]
    root["sourceModelSha256"] = baseline_report["source"]["sha256"]
    root["canonicalExtensionAxis"] = "+X"
    root["canonicalRollerAxis"] = "-Y"
    root["canonicalUpAxis"] = "+Z"
    root["walkableTopZMetres"] = 0.0
    root["runtimeReady"] = False
    root["platformAdapterJsonPresent"] = False
    root["glassMaterialAccepted"] = False
    root["goldMaterialAccepted"] = False
    root["semanticMaterialSeparationComplete"] = False
    root["rollerIvoryGoldSplitAccepted"] = False
    root["deckGlassDetailSplitAccepted"] = False
    require("platform_adapter_json" not in root, "Adapter metadata must remain absent")
    review_object.hide_render = True
    review_object.hide_viewport = True

    motion_audit = motion_boundary_audit(role_meshes, source_to_canonical, edge_metres)
    camera = bpy.data.objects.get("Cloudway_Proof_Camera")
    require(camera is not None, "Dense master proof camera is absent")
    provider_material = source_mesh.materials[0]
    proofs = render_proofs(
        bpy.context.scene,
        camera,
        objects,
        roots,
        provider_material,
        cap,
        canonical_bounds,
        edge_metres,
        output["proofDir"],
    )
    set_motion_state(roots, 1.0, edge_metres)
    for obj in objects.values():
        obj.data.materials[0] = provider_material
        obj.data.materials[1] = cap
    for image in bpy.data.images:
        if image.source == "FILE" and image.packed_file is None:
            image.pack()
    bpy.ops.file.pack_all()
    save_atomic(output["candidate"])

    source_face_coverage = sum(
        row["channelPreservation"]["retainedSourceTriangles"]
        for row in role_reports.values()
    )
    crossing_source_faces = int(
        feasibility["rejectedIndexedComponentPartition"]["planeCrossings"]["negative"]["trianglesCrossingPlane"]
        + feasibility["rejectedIndexedComponentPartition"]["planeCrossings"]["positive"]["trianglesCrossingPlane"]
    )
    require(
        source_face_coverage + crossing_source_faces == len(source["triangles"]),
        "Uncut source face coverage differs",
    )
    report = {
        "schema": 1,
        "assetId": ASSET,
        "status": "semantic-derivative-review-required",
        "scope": (
            "A deliberate two-plane cut creates three closed review roles while "
            "retaining every unaffected source triangle, position, and UV, and "
            "reapplying its exported corner-normal direction with a measured error "
            "below one degree. New cap triangles are explicit. This is not a runtime "
            "GLB, accepted material treatment, collider, or gameplay proof."
        ),
        "source": {
            "denseMaster": PREPARE.file_record(output["baseline"]),
            "modelSha256": baseline_report["source"]["sha256"],
            "fingerprints": source["fingerprints"],
            "feasibilityReport": PREPARE.file_record(output["feasibility"]),
            "sourceMasterUnchanged": (
                PREPARE.digest(output["baseline"]) == baseline_report["packedBlend"]["sha256"]
            ),
        },
        "axesAndScale": {
            "source": {
                "extension": "+Y",
                "roller": "+X",
                "up": "+Z",
                "cutPlanesY": [-CUT_Y, CUT_Y],
            },
            "candidateBlender": {
                "extension": "+X",
                "roller": "-Y",
                "up": "+Z",
                "sourceToCanonicalRotationZDegrees": SOURCE_TO_CANONICAL_Z_DEGREES,
                "sourceToCanonicalMatrix": PREPARE.matrix_record(source_to_canonical),
                "uniformScale": round(float(normalization[0][0]), 12),
                "nonUniformScaleUsed": False,
                "walkableTopZMetres": 0.0,
                "fullBoundsMetres": {
                    "min": [round(float(value), 9) for value in canonical_bounds[0]],
                    "max": [round(float(value), 9) for value in canonical_bounds[1]],
                    "dimensions": [round(float(value), 9) for value in canonical_dimensions],
                },
            },
            "runtimeConventionAfterAcceptance": {
                "localExtensionAxis": "x",
                "upAxis": "+Y",
                "note": (
                    "The future export converts Blender +Z to runtime +Y without "
                    "changing the accepted local +X extension axis."
                ),
            },
        },
        "hierarchy": {
            "candidateRoot": ROOT_NAME,
            "roleRoots": ROLE_ROOTS,
            "meshObjects": ROLE_OBJECTS,
            "roleRootsAreDirectChildren": True,
            "persistentRoles": [],
        },
        "geometry": {
            "method": (
                "BMesh plane bisect on source copies; weld only the new cut boundary, "
                "fill each closed boundary loop, triangulate caps, and retain the raw "
                "source/master objects unchanged."
            ),
            "sourceTriangles": len(source["triangles"]),
            "unaffectedSourceTrianglesRetainedExactlyOnce": source_face_coverage,
            "sourceTrianglesIntersectedByCuts": crossing_source_faces,
            "normalPolicy": (
                "Unchanged source corners receive their original evaluated exported "
                "normal direction. Blender re-encodes those directions against the "
                "new cut topology, so INT16 basis coefficients may change; every "
                "retained direction is independently audited below one degree and "
                "the 95th-percentile error is reported per role."
            ),
            "roles": role_reports,
            "motionBoundaryAudit": motion_audit,
        },
        "materials": {
            "retainedSourceSurface": provider_material.name,
            "authoredCutCaps": CAP_MATERIAL_NAME,
            "providerAlphaMode": "OPAQUE",
            "glassAccepted": False,
            "goldAccepted": False,
            "semanticMaterialInferenceUsed": False,
            "semanticRegions": {
                "rollerIvoryBody": {
                    "current": "preserved inside the single opaque provider PBR slot",
                    "acceptedSeparateMaskOrSubmesh": False,
                },
                "rollerGoldTrim": {
                    "current": "preserved inside the single opaque provider PBR slot",
                    "acceptedSeparateMaskOrSubmesh": False,
                },
                "deckGlassSubstrate": {
                    "current": "opaque ivory provider surface; not accepted as glass",
                    "acceptedSeparateMaskOrSubmesh": False,
                },
                "deckStarAndEtchedDetail": {
                    "current": (
                        "visible source geometry and PBR detail retained; future "
                        "glass treatment must preserve it as reviewed geometry, "
                        "detail layer, or decal"
                    ),
                    "acceptedSeparateMaskOrSubmesh": False,
                },
                "cutCaps": {
                    "current": "amber diagnostic provenance material",
                    "acceptedAsGoldOrGlass": False,
                },
            },
            "limitation": (
                "The derivative preserves the opaque provider PBR on retained "
                "surfaces, including ivory roller bodies, gold trim, and visible "
                "deck star/etching. Cap amber is diagnostic provenance. No pixel "
                "or texture inferred semantic split is claimed."
            ),
        },
        "motion": {
            "minLengthRatio": MIN_LENGTH_RATIO,
            "fullyExtendedCutDistanceFromCentreMetres": round(edge_metres, 9),
            "rule": (
                "Only ScrollDeck scales along local X. Both roller roots translate "
                "to the live deck edges and retain unit scale."
            ),
            "savedState": "fully-extended",
            "wholeDecoratedModelScaled": False,
            "rollerScaleAtEveryProof": [1.0, 1.0, 1.0],
        },
        "adapterGate": {
            "platformAdapterJsonPresent": False,
            "runtimeReady": False,
            "reason": (
                "A blanket gold replacement on either roller would erase its ivory "
                "body, and a blanket glass replacement on the deck could erase its "
                "star and etched detail. Accepted ivory/gold/glass/detail mapping, "
                "strict support dimensions, collider/contact metadata, and runtime "
                "export remain separate gates."
            ),
        },
        "proofs": proofs,
        "candidateBlend": {
            **PREPARE.file_record(output["candidate"]),
            "packed": True,
            "sourceRawAndDenseReviewRetained": True,
        },
        "tool": {"blender": bpy.app.version_string, "numpy": np.__version__},
        "rebuild": (
            "rtk proxy timeout 1200 env ALSOFT_DRIVERS=null /usr/bin/blender "
            "--background --factory-startup --python-exit-code 1 --python "
            "art/glass-adventure/cloudway-laboratory/v1/production/"
            "prepare_scroll_semantic_derivative.py"
        ),
    }
    PREPARE.durable_json(output["report"], report)
    PREPARE.durable_json(output["mirror"], report)
    require(
        PREPARE.digest(output["report"]) == PREPARE.digest(output["mirror"]),
        "Semantic derivative report mirror differs",
    )
    print("CLOUDWAY_SCROLL_DERIVATIVE=" + json.dumps(report), flush=True)
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])
    build()
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
