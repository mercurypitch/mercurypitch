#!/usr/bin/env python3
"""Build a separate transmissive-deck review candidate for the gilt scroll."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import sys
from typing import Any, Iterable

import bpy
from mathutils import Vector
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
SEMANTIC = load_module(
    "cloudway_prepare_scroll_semantic",
    HERE / "prepare_scroll_semantic_derivative.py",
)
FEASIBILITY = SEMANTIC.FEASIBILITY
SOURCE = PREPARE.SOURCE
ASSET = "gilt-scroll-bridge"
ROOT_NAME = "Cloudway_GiltScrollBridge_TransmissiveDeckCandidate"
SOURCE_ROOT_NAME = SEMANTIC.ROOT_NAME
DECK_OBJECT = SEMANTIC.ROLE_OBJECTS["deck"]
SOURCE_DECK_REFERENCE_OBJECT = "ScrollDeckProviderReliefReference"
ROLLER_OBJECTS = (
    SEMANTIC.ROLE_OBJECTS["negativeRoller"],
    SEMANTIC.ROLE_OBJECTS["positiveRoller"],
)
DECK_ROOT = SEMANTIC.ROLE_ROOTS["deck"]
GLASS_MATERIAL = "GiltScrollDeck_TransmissiveGlass_Candidate"
GOLD_DETAIL_MATERIAL = "GiltScrollDeck_GoldStarDetail_Candidate"
ETCH_DETAIL_MATERIAL = "GiltScrollDeck_FrostEtchDetail_Candidate"
GOLD_DETAIL_OBJECT = "ScrollDeckGoldStarDetailLayer"
ETCH_DETAIL_OBJECT = "ScrollDeckFrostEtchDetailLayer"
PROVIDER_MATERIAL = "gilt-scroll-bridge__provider_full_pbr"
SOURCE_NORMAL_IMAGE = "gilt-scroll-bridge__normal"
MIN_LENGTH_RATIO = SEMANTIC.MIN_LENGTH_RATIO
DETAIL_Z_METRES = 0.0028
INSET_EDGE_OVERLAP_METRES = 0.006
INSET_END_MARGIN_METRES = 0.035
INSET_TOP_Z_METRES = 0.0
INSET_BOTTOM_Z_METRES = -0.100
INSET_BEVEL_METRES = 0.012

# These positions are a manual vector trace from the reviewed, canonical top proof.
# They are intentionally explicit rather than inferred from provider metallic pixels.
CENTRAL_MEDALLION = {
    "center": [0.0, 0.30],
    "ringRadiiMetres": [0.082, 0.128, 0.184],
    "radialStartMetres": 0.139,
    "radialEndMetres": 0.176,
}
STAR_MOTIFS = [
    {"center": [0.0, 0.30], "points": 8, "outerRadiusMetres": 0.073, "innerRadiusMetres": 0.030},
    {"center": [-0.018, 0.812], "points": 4, "outerRadiusMetres": 0.030, "innerRadiusMetres": 0.012},
    {"center": [0.160, 0.705], "points": 4, "outerRadiusMetres": 0.024, "innerRadiusMetres": 0.010},
    {"center": [-0.010, -0.360], "points": 4, "outerRadiusMetres": 0.028, "innerRadiusMetres": 0.011},
    {"center": [-0.012, -0.720], "points": 4, "outerRadiusMetres": 0.026, "innerRadiusMetres": 0.010},
]
CRYSTAL_FILIGREE = [
    {"center": [0.218, 0.300], "halfWidthMetres": 0.014, "halfHeightMetres": 0.025},
    {"center": [0.247, 0.342], "halfWidthMetres": 0.011, "halfHeightMetres": 0.020},
    {"center": [0.247, 0.258], "halfWidthMetres": 0.011, "halfHeightMetres": 0.020},
]


def paths() -> dict[str, Path]:
    asset_dir = SOURCE / "blender" / ASSET
    proof_dir = SOURCE / "proofs" / "blender" / ASSET / "transmissive-deck-candidate"
    report_dir = SOURCE / "production" / ASSET
    return {
        "source": asset_dir / f"{ASSET}-semantic-derivative.blend",
        "sourceReport": HERE / "reports" / f"{ASSET}-scroll-semantic-derivative.json",
        "candidate": asset_dir / f"{ASSET}-transmissive-deck-candidate.blend",
        "proofDir": proof_dir,
        "report": report_dir / "scroll-transmissive-deck-candidate-report.json",
        "mirror": HERE / "reports" / f"{ASSET}-scroll-transmissive-deck-candidate.json",
        "normalTexture": SOURCE / "meshy" / ASSET / "textures" / "set-0-normal.png",
    }


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def hash_array(values: np.ndarray) -> str:
    return hashlib.sha256(np.ascontiguousarray(values).tobytes()).hexdigest()


def int_attribute(mesh: bpy.types.Mesh, name: str) -> np.ndarray:
    attribute = mesh.attributes.get(name)
    require(attribute is not None, f"{mesh.name}: missing {name}")
    result = np.empty(len(attribute.data), dtype=np.int32)
    attribute.data.foreach_get("value", result)
    return result


def mesh_fingerprint(mesh: bpy.types.Mesh) -> dict[str, Any]:
    positions, triangles = PREPARE.mesh_arrays(mesh)
    uvs = FEASIBILITY.corner_uvs(mesh)
    return {
        "vertices": len(positions),
        "triangles": len(triangles),
        "loops": len(mesh.loops),
        "positionsFloat32Sha256": hash_array(positions.astype(np.float32, copy=False)),
        "trianglesInt32Sha256": hash_array(triangles.astype(np.int32, copy=False)),
        "cornerUvsFloat32Sha256": hash_array(uvs.astype(np.float32, copy=False)),
        "sourceVertexIdsInt32Sha256": hash_array(int_attribute(mesh, SEMANTIC.SOURCE_VERTEX_ID)),
        "sourcePolygonIdsInt32Sha256": hash_array(int_attribute(mesh, SEMANTIC.SOURCE_POLYGON_ID)),
        "sourceLoopIdsInt32Sha256": hash_array(int_attribute(mesh, SEMANTIC.SOURCE_LOOP_ID)),
        "faceKindsInt32Sha256": hash_array(int_attribute(mesh, SEMANTIC.FACE_KIND)),
    }


def authored_mesh_fingerprint(mesh: bpy.types.Mesh) -> dict[str, Any]:
    positions, triangles = PREPARE.mesh_arrays(mesh)
    return {
        "vertices": len(positions),
        "triangles": len(triangles),
        "positionsFloat32Sha256": hash_array(positions.astype(np.float32, copy=False)),
        "trianglesInt32Sha256": hash_array(triangles.astype(np.int32, copy=False)),
    }


def source_deck_relief_audit(obj: bpy.types.Object) -> dict[str, Any]:
    mesh = obj.data
    mesh.calc_loop_triangles()
    positions = np.empty(len(mesh.vertices) * 3, dtype=np.float64)
    mesh.vertices.foreach_get("co", positions)
    positions = positions.reshape((-1, 3))
    world = FEASIBILITY.world_points(positions, obj.matrix_world)
    triangles = np.empty(len(mesh.loop_triangles) * 3, dtype=np.int32)
    mesh.loop_triangles.foreach_get("vertices", triangles)
    triangles = triangles.reshape((-1, 3))
    triangle_loops = np.empty(len(mesh.loop_triangles) * 3, dtype=np.int32)
    mesh.loop_triangles.foreach_get("loops", triangle_loops)
    triangle_loops = triangle_loops.reshape((-1, 3))
    points = world[triangles]
    centres = points.mean(axis=1)
    cross = np.cross(points[:, 1] - points[:, 0], points[:, 2] - points[:, 0])
    lengths = np.linalg.norm(cross, axis=1)
    normals = cross / np.maximum(lengths[:, None], 1e-15)

    encoded = np.empty(len(mesh.corner_normals) * 3, dtype=np.float64)
    mesh.corner_normals.foreach_get("vector", encoded)
    corner_normals = encoded.reshape((-1, 3))
    rotation_scale = np.asarray([list(row) for row in obj.matrix_world], dtype=np.float64)[:3, :3]
    corner_normals = corner_normals @ rotation_scale.T
    corner_normals /= np.maximum(np.linalg.norm(corner_normals, axis=1)[:, None], 1e-15)

    regions = {
        "fullTop": (
            (np.abs(centres[:, 0]) < 0.34)
            & (np.abs(centres[:, 1]) < 1.05)
            & (centres[:, 2] > -0.04)
            & (normals[:, 2] > 0.20)
        ),
        "centralRelief": (
            (np.abs(centres[:, 0]) < 0.27)
            & (centres[:, 1] > -0.10)
            & (centres[:, 1] < 0.38)
            & (centres[:, 2] > -0.04)
            & (normals[:, 2] > 0.05)
        ),
        "belowMedallionPatch": (
            (np.abs(centres[:, 0]) < 0.27)
            & (centres[:, 1] > -0.16)
            & (centres[:, 1] < 0.18)
            & (centres[:, 2] > -0.04)
            & (normals[:, 2] > 0.05)
        ),
        "bottom": (
            (np.abs(centres[:, 0]) < 0.34)
            & (np.abs(centres[:, 1]) < 1.05)
            & (centres[:, 2] < -0.04)
            & (normals[:, 2] < -0.20)
        ),
    }
    rows: dict[str, Any] = {}
    for name, mask in regions.items():
        indices = np.flatnonzero(mask)
        require(len(indices) > 0, f"Source deck relief region {name} is empty")
        loops = triangle_loops[indices].reshape(-1)
        direction = 1.0 if name != "bottom" else -1.0
        geometric_tilt = np.degrees(
            np.arccos(np.clip(normals[indices, 2] * direction, -1.0, 1.0))
        )
        corner_tilt = np.degrees(
            np.arccos(np.clip(corner_normals[loops, 2] * direction, -1.0, 1.0))
        )
        centre_z = centres[indices, 2]
        rows[name] = {
            "triangles": len(indices),
            "canonicalZMinMetres": round(float(centre_z.min()), 12),
            "canonicalZMaxMetres": round(float(centre_z.max()), 12),
            "canonicalZSpanMetres": round(float(np.ptp(centre_z)), 12),
            "geometricNormalTiltDegrees": {
                "median": round(float(np.percentile(geometric_tilt, 50)), 9),
                "p95": round(float(np.percentile(geometric_tilt, 95)), 9),
                "max": round(float(geometric_tilt.max()), 9),
            },
            "cornerNormalTiltDegrees": {
                "median": round(float(np.percentile(corner_tilt, 50)), 9),
                "p95": round(float(np.percentile(corner_tilt, 95)), 9),
                "max": round(float(corner_tilt.max()), 9),
            },
        }
    return {
        "canonicalBoundsMetres": {
            "min": [round(float(value), 12) for value in world.min(axis=0)],
            "max": [round(float(value), 12) for value in world.max(axis=0)],
        },
        "patchCanonicalBoundsMetres": {
            "x": [-0.27, 0.27],
            "y": [-0.16, 0.18],
            "topCandidateZGreaterThan": -0.04,
        },
        "regions": rows,
        "finding": (
            "The visually rejected patch is fused relief geometry, not a provider texture. "
            "Its small height variation carries steep geometric and split-normal slopes that "
            "magnify background refraction on clear glass."
        ),
    }


def set_socket(node: bpy.types.Node, name: str, value: Any) -> None:
    socket = node.inputs.get(name)
    require(socket is not None, f"{node.name}: missing {name}")
    socket.default_value = value


def new_principled_material(
    name: str,
    color: tuple[float, float, float, float],
    metallic: float,
    roughness: float,
) -> tuple[bpy.types.Material, bpy.types.Node, bpy.types.NodeTree]:
    existing = bpy.data.materials.get(name)
    if existing is not None:
        bpy.data.materials.remove(existing)
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = color
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    output.name = "Material Output"
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.name = "Candidate Principled"
    set_socket(shader, "Base Color", color)
    set_socket(shader, "Metallic", metallic)
    set_socket(shader, "Roughness", roughness)
    material.node_tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return material, shader, material.node_tree


def glass_material() -> bpy.types.Material:
    material, shader, tree = new_principled_material(
        GLASS_MATERIAL,
        (0.54, 0.86, 0.92, 1.0),
        0.0,
        0.075,
    )
    set_socket(shader, "IOR", 1.46)
    set_socket(shader, "Transmission Weight", 0.985)
    set_socket(shader, "Coat Weight", 0.22)
    set_socket(shader, "Coat Roughness", 0.055)
    set_socket(shader, "Specular IOR Level", 0.50)

    volume = tree.nodes.new("ShaderNodeVolumeAbsorption")
    volume.name = "Pale cyan glass absorption"
    volume.inputs["Color"].default_value = (0.58, 0.88, 0.94, 1.0)
    volume.inputs["Density"].default_value = 0.10
    output = tree.nodes["Material Output"]
    tree.links.new(volume.outputs["Volume"], output.inputs["Volume"])
    if hasattr(material, "surface_render_method"):
        try:
            material.surface_render_method = "DITHERED"
        except TypeError:
            pass
    return material


def gold_detail_material() -> bpy.types.Material:
    material, shader, _ = new_principled_material(
        GOLD_DETAIL_MATERIAL,
        (0.83, 0.39, 0.055, 1.0),
        0.88,
        0.20,
    )
    set_socket(shader, "Coat Weight", 0.28)
    set_socket(shader, "Coat Roughness", 0.08)
    return material


def etch_detail_material() -> bpy.types.Material:
    material, shader, _ = new_principled_material(
        ETCH_DETAIL_MATERIAL,
        (0.62, 0.90, 0.96, 1.0),
        0.05,
        0.31,
    )
    set_socket(shader, "IOR", 1.43)
    set_socket(shader, "Transmission Weight", 0.36)
    set_socket(shader, "Coat Weight", 0.18)
    return material


def create_planar_inset(
    source_deck: bpy.types.Object,
    deck_root: bpy.types.Object,
    collection: bpy.types.Collection,
    glass: bpy.types.Material,
    edge_metres: float,
    source_y_bounds: tuple[float, float],
) -> tuple[bpy.types.Object, dict[str, Any]]:
    source_deck.name = SOURCE_DECK_REFERENCE_OBJECT
    source_deck.data.name = f"{SOURCE_DECK_REFERENCE_OBJECT}Data"
    source_deck.hide_render = True
    source_deck.hide_viewport = True
    source_deck["reviewReferenceOnly"] = True
    source_deck["excludeFromRuntime"] = True
    source_deck["rejectedAsOpticalGlassSurface"] = True

    minimum_y = source_y_bounds[0] + INSET_END_MARGIN_METRES
    maximum_y = source_y_bounds[1] - INSET_END_MARGIN_METRES
    centre_y = (minimum_y + maximum_y) * 0.5
    dimensions = (
        2.0 * (edge_metres + INSET_EDGE_OVERLAP_METRES),
        maximum_y - minimum_y,
        INSET_TOP_Z_METRES - INSET_BOTTOM_Z_METRES,
    )
    bpy.ops.mesh.primitive_cube_add(
        size=1.0,
        location=(0.0, centre_y, (INSET_TOP_Z_METRES + INSET_BOTTOM_Z_METRES) * 0.5),
    )
    inset = bpy.context.object
    require(inset is not None, "Could not create planar deck inset")
    inset.name = DECK_OBJECT
    PREPARE.link_only(inset, collection)
    inset.parent = deck_root
    inset.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    inset.data.name = f"{DECK_OBJECT}Data"
    inset.data.materials.append(glass)

    bevel = inset.modifiers.new("Authored edge bevel", "BEVEL")
    bevel.width = INSET_BEVEL_METRES
    bevel.segments = 3
    bevel.limit_method = "ANGLE"
    if hasattr(bevel, "harden_normals"):
        bevel.harden_normals = True
    bpy.context.view_layer.objects.active = inset
    inset.select_set(True)
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    inset.select_set(False)
    inset["authoredPlanarGlassInset"] = True
    inset["sourceDeckGeometryReused"] = False
    inset["nonUniformSourceScalingUsed"] = False
    inset["edgeOverlapMetres"] = INSET_EDGE_OVERLAP_METRES
    inset["walkableTopZMetres"] = INSET_TOP_Z_METRES
    return inset, {
        "dimensionsMetres": [round(float(value), 9) for value in dimensions],
        "canonicalBoundsMetres": {
            "min": [
                round(-dimensions[0] * 0.5, 9),
                round(minimum_y, 9),
                INSET_BOTTOM_Z_METRES,
            ],
            "max": [
                round(dimensions[0] * 0.5, 9),
                round(maximum_y, 9),
                INSET_TOP_Z_METRES,
            ],
        },
        "edgeOverlapIntoRollerFrameMetres": INSET_EDGE_OVERLAP_METRES,
        "endMarginFromSourceDeckBoundsMetres": INSET_END_MARGIN_METRES,
        "bevelMetres": INSET_BEVEL_METRES,
        "topZMetres": INSET_TOP_Z_METRES,
        "bottomZMetres": INSET_BOTTOM_Z_METRES,
    }


def planar_inset_audit(obj: bpy.types.Object) -> dict[str, Any]:
    closure = SEMANTIC.welded_closure(obj.data)
    require(closure["closedTwoManifoldAfterExactPositionWeld"], "Planar inset is not closed")
    positions, triangles = PREPARE.mesh_arrays(obj.data)
    world = FEASIBILITY.world_points(positions, obj.matrix_world)
    points = world[triangles]
    centres = points.mean(axis=1)
    cross = np.cross(points[:, 1] - points[:, 0], points[:, 2] - points[:, 0])
    lengths = np.linalg.norm(cross, axis=1)
    normals = cross / np.maximum(lengths[:, None], 1e-15)
    top = (
        (centres[:, 2] >= INSET_TOP_Z_METRES - 1e-8)
        & (np.abs(normals[:, 2] - 1.0) <= 1e-7)
    )
    require(np.count_nonzero(top) > 0, "Planar inset has no flat upward top triangles")
    top_z = centres[top, 2]
    return {
        "fingerprint": authored_mesh_fingerprint(obj.data),
        "closure": closure,
        "canonicalBoundsMetres": {
            "min": [round(float(value), 9) for value in world.min(axis=0)],
            "max": [round(float(value), 9) for value in world.max(axis=0)],
        },
        "flatTopTriangles": int(np.count_nonzero(top)),
        "flatTopZSpanMetres": round(float(np.ptp(top_z)), 12),
        "flatTopGeometricNormalMaxTiltDegrees": round(
            float(np.degrees(np.arccos(np.clip(normals[top, 2], -1.0, 1.0))).max()),
            12,
        ),
        "authoredClosedPlanarOpticalSurface": True,
    }


def add_poly_spline(
    curve: bpy.types.Curve,
    points: Iterable[tuple[float, float, float]],
    cyclic: bool,
) -> None:
    values = list(points)
    require(len(values) >= 2, "Detail spline has too few points")
    spline = curve.splines.new("POLY")
    spline.points.add(len(values) - 1)
    for point, coordinate in zip(spline.points, values):
        point.co = (*coordinate, 1.0)
    spline.use_cyclic_u = cyclic


def circle_points(
    center: tuple[float, float], radius: float, count: int = 96
) -> list[tuple[float, float, float]]:
    return [
        (
            center[0] + math.cos(index * math.tau / count) * radius,
            center[1] + math.sin(index * math.tau / count) * radius,
            DETAIL_Z_METRES,
        )
        for index in range(count)
    ]


def star_points(motif: dict[str, Any]) -> list[tuple[float, float, float]]:
    center_x, center_y = motif["center"]
    count = int(motif["points"]) * 2
    outer = float(motif["outerRadiusMetres"])
    inner = float(motif["innerRadiusMetres"])
    result = []
    for index in range(count):
        angle = math.pi / 2.0 + index * math.tau / count
        radius = outer if index % 2 == 0 else inner
        result.append(
            (
                center_x + math.cos(angle) * radius,
                center_y + math.sin(angle) * radius,
                DETAIL_Z_METRES + 0.0006,
            )
        )
    return result


def crystal_points(motif: dict[str, Any]) -> list[tuple[float, float, float]]:
    center_x, center_y = motif["center"]
    half_width = float(motif["halfWidthMetres"])
    half_height = float(motif["halfHeightMetres"])
    return [
        (center_x, center_y + half_height, DETAIL_Z_METRES + 0.0003),
        (center_x + half_width, center_y, DETAIL_Z_METRES + 0.0003),
        (center_x, center_y - half_height, DETAIL_Z_METRES + 0.0003),
        (center_x - half_width, center_y, DETAIL_Z_METRES + 0.0003),
    ]


def convert_curve_to_mesh(obj: bpy.types.Object) -> bpy.types.Object:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    result = bpy.context.object
    require(result is not None and result.type == "MESH", f"Could not convert {obj.name}")
    result.select_set(False)
    return result


def detail_object(
    name: str,
    material: bpy.types.Material,
    parent: bpy.types.Object,
    collection: bpy.types.Collection,
    bevel_depth: float,
    splines: list[tuple[list[tuple[float, float, float]], bool]],
) -> bpy.types.Object:
    old = bpy.data.objects.get(name)
    if old is not None:
        bpy.data.objects.remove(old, do_unlink=True)
    curve = bpy.data.curves.new(f"{name}Curve", "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = bevel_depth
    curve.bevel_resolution = 3
    curve.resolution_u = 2
    for points, cyclic in splines:
        add_poly_spline(curve, points, cyclic)
    obj = bpy.data.objects.new(name, curve)
    collection.objects.link(obj)
    obj.parent = parent
    obj.data.materials.append(material)
    obj = convert_curve_to_mesh(obj)
    obj.name = name
    obj.data.name = f"{name}Data"
    obj["reviewOnlyDetailLayer"] = True
    obj["nonCollider"] = True
    obj["authoredFromCanonicalTopReview"] = True
    return obj


def create_detail_layers(
    deck_root: bpy.types.Object,
    collection: bpy.types.Collection,
    gold: bpy.types.Material,
    etch: bpy.types.Material,
) -> dict[str, bpy.types.Object]:
    gold_splines = [(star_points(motif), True) for motif in STAR_MOTIFS]
    gold_object = detail_object(
        GOLD_DETAIL_OBJECT,
        gold,
        deck_root,
        collection,
        0.0032,
        gold_splines,
    )

    center = tuple(CENTRAL_MEDALLION["center"])
    etch_splines: list[tuple[list[tuple[float, float, float]], bool]] = [
        (circle_points(center, float(radius)), True)
        for radius in CENTRAL_MEDALLION["ringRadiiMetres"]
    ]
    for index in range(8):
        angle = index * math.tau / 8.0
        start = float(CENTRAL_MEDALLION["radialStartMetres"])
        end = float(CENTRAL_MEDALLION["radialEndMetres"])
        etch_splines.append(
            (
                [
                    (
                        center[0] + math.cos(angle) * start,
                        center[1] + math.sin(angle) * start,
                        DETAIL_Z_METRES,
                    ),
                    (
                        center[0] + math.cos(angle) * end,
                        center[1] + math.sin(angle) * end,
                        DETAIL_Z_METRES,
                    ),
                ],
                False,
            )
        )
    for motif in CRYSTAL_FILIGREE:
        etch_splines.append((crystal_points(motif), True))
    # Four restrained panel strokes echo the source top proof without using a
    # texture threshold as a semantic mask.
    for y_value, direction in ((0.930, 1.0), (0.610, -1.0), (-0.480, 1.0), (-0.890, -1.0)):
        etch_splines.append(
            (
                [
                    (-0.315, y_value - 0.050 * direction, DETAIL_Z_METRES),
                    (0.315, y_value + 0.050 * direction, DETAIL_Z_METRES),
                ],
                False,
            )
        )
    etch_object = detail_object(
        ETCH_DETAIL_OBJECT,
        etch,
        deck_root,
        collection,
        0.00155,
        etch_splines,
    )
    return {"gold": gold_object, "etch": etch_object}


def checker_floor(scene: bpy.types.Scene) -> None:
    floor = bpy.data.objects.get("Cloudway_Proof_Floor")
    require(floor is not None, "Proof floor is absent")
    floor.location.z = -0.34
    material = bpy.data.materials.get("Cloudway transmission proof floor")
    if material is not None:
        bpy.data.materials.remove(material)
    material = bpy.data.materials.new("Cloudway transmission proof floor")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    checker = nodes.new("ShaderNodeTexChecker")
    texcoord = nodes.new("ShaderNodeTexCoord")
    mapping = nodes.new("ShaderNodeMapping")
    checker.inputs["Color1"].default_value = (0.012, 0.060, 0.085, 1.0)
    checker.inputs["Color2"].default_value = (0.28, 0.24, 0.16, 1.0)
    checker.inputs["Scale"].default_value = 7.0
    shader.inputs["Roughness"].default_value = 0.30
    shader.inputs["Metallic"].default_value = 0.08
    material.node_tree.links.new(texcoord.outputs["Generated"], mapping.inputs["Vector"])
    material.node_tree.links.new(mapping.outputs["Vector"], checker.inputs["Vector"])
    material.node_tree.links.new(checker.outputs["Color"], shader.inputs["Base Color"])
    material.node_tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    floor.data.materials.clear()
    floor.data.materials.append(material)

    world = scene.world or bpy.data.worlds.new("Cloudway transmission sky")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes.clear()
    world_output = world.node_tree.nodes.new("ShaderNodeOutputWorld")
    background = world.node_tree.nodes.new("ShaderNodeBackground")
    background.inputs["Color"].default_value = (0.040, 0.115, 0.220, 1.0)
    background.inputs["Strength"].default_value = 0.38
    world.node_tree.links.new(background.outputs["Background"], world_output.inputs["Surface"])

    light_energy = {
        "Cloudway proof key": 390.0,
        "Cloudway proof fill": 260.0,
        "Cloudway proof rim": 340.0,
    }
    for name, energy in light_energy.items():
        light = bpy.data.objects.get(name)
        if light is not None and light.type == "LIGHT":
            light.data.energy = energy

    card = bpy.data.objects.get("Cloudway_Transmission_Test_Card")
    if card is not None:
        bpy.data.objects.remove(card, do_unlink=True)
    bpy.ops.mesh.primitive_plane_add(size=2.0, location=(0.0, 0.0, -0.225))
    card = bpy.context.object
    card.name = "Cloudway_Transmission_Test_Card"
    card.scale = (0.34, 1.40, 1.0)
    card["reviewEnvironmentOnly"] = True
    PREPARE.link_only(card, floor.users_collection[0])
    card_material = bpy.data.materials.get("Cloudway transmission test card")
    if card_material is not None:
        bpy.data.materials.remove(card_material)
    card_material = bpy.data.materials.new("Cloudway transmission test card")
    card_material.use_nodes = True
    card_nodes = card_material.node_tree.nodes
    card_nodes.clear()
    card_output = card_nodes.new("ShaderNodeOutputMaterial")
    card_shader = card_nodes.new("ShaderNodeBsdfPrincipled")
    wave = card_nodes.new("ShaderNodeTexWave")
    wave.wave_type = "BANDS"
    wave.bands_direction = "X"
    wave.inputs["Scale"].default_value = 2.0
    ramp = card_nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.42
    ramp.color_ramp.elements[0].color = (0.005, 0.060, 0.80, 1.0)
    ramp.color_ramp.elements[1].position = 0.58
    ramp.color_ramp.elements[1].color = (1.0, 0.055, 0.018, 1.0)
    card_shader.inputs["Roughness"].default_value = 0.29
    card_shader.inputs["Coat Weight"].default_value = 0.16
    card_material.node_tree.links.new(wave.outputs["Color"], ramp.inputs["Fac"])
    card_material.node_tree.links.new(ramp.outputs["Color"], card_shader.inputs["Base Color"])
    card_material.node_tree.links.new(card_shader.outputs["BSDF"], card_output.inputs["Surface"])
    card.data.materials.append(card_material)


def configure_renderer(scene: bpy.types.Scene) -> None:
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 8
    scene.cycles.transmission_bounces = 6
    scene.cycles.transparent_max_bounces = 8
    scene.render.resolution_x = PREPARE.RESOLUTION[0]
    scene.render.resolution_y = PREPARE.RESOLUTION[1]
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = False
    scene.render.dither_intensity = 0.0
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -0.35


def apply_deck_material(deck: bpy.types.Object, material: bpy.types.Material) -> None:
    deck.data.materials.clear()
    deck.data.materials.append(material)
    for polygon in deck.data.polygons:
        polygon.material_index = 0


def detail_fingerprint(obj: bpy.types.Object) -> dict[str, Any]:
    positions, triangles = PREPARE.mesh_arrays(obj.data)
    return {
        "object": obj.name,
        "vertices": len(positions),
        "triangles": len(triangles),
        "positionsFloat32Sha256": hash_array(positions.astype(np.float32, copy=False)),
        "trianglesInt32Sha256": hash_array(triangles.astype(np.int32, copy=False)),
        "material": obj.data.materials[0].name,
        "parent": obj.parent.name if obj.parent else None,
    }


def proof_record(path: Path) -> dict[str, Any]:
    return PREPARE.file_record(path, PREPARE.RESOLUTION)


def render_matched_proofs(
    scene: bpy.types.Scene,
    camera: bpy.types.Object,
    source_deck: bpy.types.Object,
    deck: bpy.types.Object,
    details: dict[str, bpy.types.Object],
    bounds: tuple[np.ndarray, np.ndarray],
    proof_dir: Path,
    quick: bool,
) -> dict[str, Any]:
    proof_dir.mkdir(parents=True, exist_ok=True)
    views = ("three-quarter",) if quick else ("three-quarter", "top", "side")
    proofs: dict[str, dict[str, Any]] = {
        "source": {},
        "candidate": {},
        "transmissionWitness": {},
    }
    card = bpy.data.objects.get("Cloudway_Transmission_Test_Card")
    require(card is not None, "Transmission witness card is absent")
    card.hide_render = True
    for view in views:
        PREPARE.configure_view(camera, view, bounds)
        for mode, show_details in (
            ("source", False),
            ("candidate", True),
        ):
            source_deck.hide_render = mode != "source"
            deck.hide_render = mode != "candidate"
            for detail in details.values():
                detail.hide_render = not show_details
            target = proof_dir / f"matched-{mode}-{view}.png"
            PREPARE.render_atomic(scene, target)
            proofs[mode][view] = proof_record(target)
    if not quick:
        camera.data.type = "ORTHO"
        camera.data.ortho_scale = 0.82
        camera.location = (0.0, 0.30, 4.0)
        PREPARE.point_at(camera, Vector((0.0, 0.30, 0.0)))
        for mode, show_details in (
            ("source", False),
            ("candidate", True),
        ):
            source_deck.hide_render = mode != "source"
            deck.hide_render = mode != "candidate"
            for detail in details.values():
                detail.hide_render = not show_details
            target = proof_dir / f"matched-{mode}-central-detail-closeup.png"
            PREPARE.render_atomic(scene, target)
            proofs[mode]["central-detail-closeup"] = proof_record(target)
        card.hide_render = False
        PREPARE.configure_view(camera, "top", bounds)
        for mode, show_details in (
            ("source", False),
            ("candidate", True),
        ):
            source_deck.hide_render = mode != "source"
            deck.hide_render = mode != "candidate"
            for detail in details.values():
                detail.hide_render = not show_details
            target = proof_dir / f"transmission-witness-{mode}-top.png"
            PREPARE.render_atomic(scene, target)
            proofs["transmissionWitness"][mode] = proof_record(target)
    source_deck.hide_render = True
    deck.hide_render = False
    for detail in details.values():
        detail.hide_render = False
    card.hide_render = True
    return proofs


def save_atomic(target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(f".{target.stem}.tmp{target.suffix}")
    temporary.unlink(missing_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(temporary), check_existing=False)
    require(temporary.is_file(), f"Blender did not save {temporary}")
    os.replace(temporary, target)


def build(quick: bool = False) -> dict[str, Any]:
    output = paths()
    source_report = json.loads(output["sourceReport"].read_text())
    require(source_report["status"] == "semantic-derivative-review-required", "Semantic checkpoint report is invalid")
    require(PREPARE.digest(output["source"]) == source_report["candidateBlend"]["sha256"], "Semantic checkpoint differs from its report")
    normal_record = PREPARE.file_record(output["normalTexture"])

    bpy.ops.wm.open_mainfile(filepath=str(output["source"]), load_ui=False)
    bpy.context.preferences.filepaths.save_version = 0
    source_root = bpy.data.objects.get(SOURCE_ROOT_NAME)
    require(source_root is not None, "Semantic derivative root is absent")
    source_root.name = ROOT_NAME
    source_root["status"] = "planar transmissive deck inset candidate; review required"
    source_root["runtimeReady"] = False
    source_root["platformAdapterJsonPresent"] = False
    source_root["glassMaterialAccepted"] = False
    source_root["semanticMaterialSeparationComplete"] = False
    source_root["rollerOpaqueProviderPbrPreserved"] = True
    source_root["deckDetailTreatmentAccepted"] = False
    source_root["supportColliderCertified"] = False
    source_root["materialCandidateVersion"] = 2
    source_root["sourceDeckGeometryReused"] = False
    source_root["authoredPlanarGlassInset"] = True
    require("platform_adapter_json" not in source_root, "Adapter metadata must remain absent")

    source_deck = bpy.data.objects.get(DECK_OBJECT)
    require(source_deck is not None and source_deck.type == "MESH", "Source deck mesh is absent")
    role_fingerprints_before = {
        obj_name: mesh_fingerprint(bpy.data.objects[obj_name].data)
        for obj_name in (DECK_OBJECT, *ROLLER_OBJECTS)
    }
    source_deck_relief = source_deck_relief_audit(source_deck)
    provider = bpy.data.materials.get(PROVIDER_MATERIAL)
    require(provider is not None, "Provider PBR material is absent")
    for name in ROLLER_OBJECTS:
        roller = bpy.data.objects.get(name)
        require(roller is not None and roller.data.materials[0] == provider, f"{name}: provider PBR changed")
    normal_image = bpy.data.images.get(SOURCE_NORMAL_IMAGE)
    require(normal_image is not None, "Provider normal image is absent from the preserved roller PBR")

    glass = glass_material()
    gold = gold_detail_material()
    etch = etch_detail_material()
    deck_root = bpy.data.objects.get(DECK_ROOT)
    require(deck_root is not None, "Deck role root is absent")
    collection = source_deck.users_collection[0]
    edge_metres = float(source_report["motion"]["fullyExtendedCutDistanceFromCentreMetres"])
    source_y_bounds = (
        float(source_deck_relief["canonicalBoundsMetres"]["min"][1]),
        float(source_deck_relief["canonicalBoundsMetres"]["max"][1]),
    )
    deck, inset_spec = create_planar_inset(
        source_deck,
        deck_root,
        collection,
        glass,
        edge_metres,
        source_y_bounds,
    )
    details = create_detail_layers(deck_root, collection, gold, etch)
    roller_fingerprints_after = {
        obj_name: mesh_fingerprint(bpy.data.objects[obj_name].data)
        for obj_name in ROLLER_OBJECTS
    }
    require(
        all(role_fingerprints_before[name] == roller_fingerprints_after[name] for name in ROLLER_OBJECTS),
        "Planar inset work changed a roller role mesh",
    )

    semantic_bounds = source_report["axesAndScale"]["candidateBlender"]["fullBoundsMetres"]
    bounds = (
        np.asarray(semantic_bounds["min"], dtype=np.float64),
        np.asarray(semantic_bounds["max"], dtype=np.float64),
    )
    roots = {
        role: bpy.data.objects.get(name)
        for role, name in SEMANTIC.ROLE_ROOTS.items()
    }
    require(all(root is not None for root in roots.values()), "One or more motion role roots are absent")
    SEMANTIC.set_motion_state(roots, 1.0, edge_metres)

    scene = bpy.context.scene
    camera = bpy.data.objects.get("Cloudway_Proof_Camera")
    require(camera is not None, "Proof camera is absent")
    configure_renderer(scene)
    checker_floor(scene)
    proofs = render_matched_proofs(
        scene,
        camera,
        source_deck,
        deck,
        details,
        bounds,
        output["proofDir"],
        quick,
    )
    source_deck.hide_render = True
    deck.hide_render = False
    for detail in details.values():
        detail.hide_render = False

    for image in bpy.data.images:
        if image.source == "FILE" and image.packed_file is None:
            image.pack()
    bpy.ops.file.pack_all()
    save_atomic(output["candidate"])

    inset_audit = planar_inset_audit(deck)

    detail_rows = {name: detail_fingerprint(obj) for name, obj in details.items()}
    report = {
        "schema": 1,
        "assetId": ASSET,
        "status": "planar-transmissive-deck-candidate-review-required",
        "scope": (
            "A second visual candidate keeps both dense roller/frame roles on their reviewed opaque provider "
            "PBR and replaces only the optically unsuitable fused relief deck with an explicitly authored, "
            "closed planar glass inset. Source geometry remains in the immutable semantic derivative and as a "
            "hidden review reference in this packed Blend. Source-referenced vector star, ring, panel, and crystal "
            "detail layers sit above the inset. This is not a runtime asset or collider proof."
        ),
        "sourceCheckpoint": {
            "blend": PREPARE.file_record(output["source"]),
            "report": PREPARE.file_record(output["sourceReport"]),
            "unchanged": PREPARE.digest(output["source"]) == source_report["candidateBlend"]["sha256"],
        },
        "roleGeometry": {
            "sourceRoleFingerprints": role_fingerprints_before,
            "rollerFingerprintsAfter": roller_fingerprints_after,
            "rollersUnchanged": all(
                role_fingerprints_before[name] == roller_fingerprints_after[name]
                for name in ROLLER_OBJECTS
            ),
            "sourceDeckReliefInspection": source_deck_relief,
            "sourceDeckGeometryReusedAsGlass": False,
            "sourceDeckReviewReferenceObject": SOURCE_DECK_REFERENCE_OBJECT,
            "sourceDeckReviewReferenceHidden": True,
            "planarInsetSpecification": inset_spec,
            "planarInsetAudit": inset_audit,
            "authoredCutCapsCarriedIntoPlanarInset": False,
            "planarInsetClosedByConstruction": True,
        },
        "materials": {
            "rollers": {
                "material": PROVIDER_MATERIAL,
                "policy": "unchanged opaque mixed ivory/gold provider PBR on both complete roller roles",
                "perPixelSemanticInference": False,
                "blanketGoldReplacement": False,
            },
            "deckGlass": {
                "material": GLASS_MATERIAL,
                "principled": {
                    "baseColor": [0.54, 0.86, 0.92, 1.0],
                    "roughness": 0.075,
                    "ior": 1.46,
                    "transmissionWeight": 0.985,
                    "coatWeight": 0.22,
                },
                "volumeAbsorption": {"color": [0.58, 0.88, 0.94, 1.0], "density": 0.10},
                "sourceNormalTexture": normal_record,
                "sourceNormalConnected": False,
                "sourceNormalRejectionReason": (
                    "The first material-only candidate proved that fused source relief geometry, not just the "
                    "normal atlas, produced an ambiguous bright patch and sawtooth refraction. Version 2 uses "
                    "a clean authored planar inset plus explicit vector detail."
                ),
                "providerBaseColorConnected": False,
                "providerMetallicConnected": False,
                "providerRoughnessConnected": False,
                "providerNormalConnected": False,
                "semanticPixelClassificationUsed": False,
            },
            "detailLayers": {
                "policy": (
                    "Manual canonical-space vector trace from the reviewed top proof. The layer does not "
                    "classify metallic or color pixels and is explicitly non-collider review geometry."
                ),
                "goldMaterial": GOLD_DETAIL_MATERIAL,
                "etchMaterial": ETCH_DETAIL_MATERIAL,
                "zOffsetMetres": DETAIL_Z_METRES,
                "centralMedallion": CENTRAL_MEDALLION,
                "starMotifs": STAR_MOTIFS,
                "crystalFiligree": CRYSTAL_FILIGREE,
                "objects": detail_rows,
                "sourceExactMaskClaimed": False,
            },
        },
        "proofEnvironment": {
            "renderer": scene.render.engine,
            "resolution": list(PREPARE.RESOLUTION),
            "sky": "bounded blue world reflection environment",
            "floor": "teal/stone checker 0.34m below canonical top for beauty views; a separately rendered broad-band blue/coral card 0.225m below top exposes transmission and refraction",
            "matchedCameraLightingAndMotionState": True,
        },
        "proofs": proofs,
        "candidateBlend": {
            **PREPARE.file_record(output["candidate"]),
            "packed": True,
            "savedState": "fully-extended",
            "sourceSemanticDerivativeRetainedSeparately": True,
            "sourceDeckReviewReferenceRetainedHidden": True,
        },
        "adapterGate": {
            "platformAdapterJsonPresent": False,
            "runtimeReady": False,
            "supportColliderCertified": False,
            "materialCandidateAccepted": False,
            "reason": (
                "Root visual acceptance, explicit final role/material mapping, strict support dimensions, "
                "collider/contact metadata, runtime export, and live renderer proof remain outstanding."
            ),
        },
        "tool": {"blender": bpy.app.version_string, "numpy": np.__version__},
        "rebuild": (
            "rtk proxy flock -w 1200 /tmp/glass-cloudway-blender.lock timeout 1200 "
            "env ALSOFT_DRIVERS=null /usr/bin/blender --background "
            "--factory-startup --python-exit-code 1 --python "
            "art/glass-adventure/cloudway-laboratory/v1/production/prepare_scroll_transmissive_candidate.py"
        ),
    }
    PREPARE.durable_json(output["report"], report)
    PREPARE.durable_json(output["mirror"], report)
    require(PREPARE.digest(output["report"]) == PREPARE.digest(output["mirror"]), "Report mirror differs")
    return report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--quick", action="store_true", help="Render only the matched three-quarter pair")
    arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(arguments)


if __name__ == "__main__":
    arguments = parse_args()
    result = build(arguments.quick)
    print(json.dumps({
        "status": result["status"],
        "candidate": result["candidateBlend"],
        "deckThicknessMetres": result["roleGeometry"]["planarInsetSpecification"]["dimensionsMetres"][2],
        "proofs": result["proofs"],
    }, indent=2))
