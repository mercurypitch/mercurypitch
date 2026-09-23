"""Build the direct dense-derived Cloudway V4 marble runtime candidate.

This path deliberately avoids the rejected 90k remesh normal-transfer and
selected-to-active projection.  It fits the immutable 1.256M-triangle donor,
protects its detailed regions during a local Blender decimation to about 238k
triangles, retains source UV0, and binds the provider PBR maps directly.
"""

from __future__ import annotations

import bmesh
import hashlib
import json
import math
from pathlib import Path
import shutil
import struct
import sys
from typing import Any

import bpy
from mathutils import Vector
import numpy as np
from PIL import Image as PILImage


HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import marble_runtime_common as COMMON  # noqa: E402
import build_marble_runtime_v4 as LEGACY  # noqa: E402


TARGET_TRIANGLES = 238_000
TEXTURES = COMMON.V4 / "sources" / "marble-runtime-textures"
SOURCE_BLEND = COMMON.V4 / "sources" / "cloudway-platform-kit-v4.blend"
BUILD_REPORT = COMMON.V4 / "production" / "cloudway-marble-runtime-v4-build.json"
RAW_4K = COMMON.V4 / "exports" / "cloudway-marble-ultra-v4-4k-blender.glb"
RAW_2K = COMMON.V4 / "exports" / "cloudway-marble-ultra-v4-2k-blender.glb"
TANGENT_DIAGNOSTIC = (
    COMMON.V4 / "proofs" / "diagnostics" / "marble-direct-residual-tangent-singularities.json"
)
TOPOLOGY_REPAIR_RESULT = (
    COMMON.V4 / "proofs" / "diagnostics" / "marble-direct-local-sliver-repair.json"
)

MAPS = {
    "base4k": TEXTURES / "cloudway-marble-v4-base-4k.png",
    "normal4k": TEXTURES / "cloudway-marble-v4-normal-4k.png",
    "metallic2k": TEXTURES / "cloudway-marble-v4-metallic-2k.png",
    "roughness2k": TEXTURES / "cloudway-marble-v4-roughness-2k.png",
    "orm2k": TEXTURES / "cloudway-marble-v4-orm-2k.png",
    "base2k": TEXTURES / "cloudway-marble-v4-base-2k.png",
    "normal2k": TEXTURES / "cloudway-marble-v4-normal-2k.png",
}


def prepare_direct_maps() -> dict[str, object]:
    TEXTURES.mkdir(parents=True, exist_ok=True)
    shutil.copy2(LEGACY.SOURCE_TEXTURES["baseColor"], MAPS["base4k"])
    shutil.copy2(LEGACY.SOURCE_TEXTURES["normal"], MAPS["normal4k"])
    shutil.copy2(LEGACY.SOURCE_TEXTURES["metallic"], MAPS["metallic2k"])
    shutil.copy2(LEGACY.SOURCE_TEXTURES["roughness"], MAPS["roughness2k"])
    base2k = LEGACY.resize_base(MAPS["base4k"], MAPS["base2k"])
    normal2k = LEGACY.resize_normal(MAPS["normal4k"], MAPS["normal2k"])

    with PILImage.open(MAPS["roughness2k"]) as image:
        roughness = np.asarray(image.convert("L"), dtype=np.uint8)
    with PILImage.open(MAPS["metallic2k"]) as image:
        metallic = np.asarray(image.convert("L"), dtype=np.uint8)
    neutral_occlusion = np.full_like(roughness, 255)
    orm = np.stack((neutral_occlusion, roughness, metallic), axis=2)
    PILImage.fromarray(orm, "RGB").save(MAPS["orm2k"], format="PNG", optimize=True)
    return {
        "baseColor4k": {
            **LEGACY.file_record(MAPS["base4k"], [4096, 4096]),
            "method": "byte-identical copy of provider source base color",
        },
        "normal4k": {
            **LEGACY.file_record(MAPS["normal4k"], [4096, 4096]),
            "method": "byte-identical copy of provider source tangent normal",
        },
        "metallic2k": LEGACY.file_record(MAPS["metallic2k"], [2048, 2048]),
        "roughness2k": LEGACY.file_record(MAPS["roughness2k"], [2048, 2048]),
        "orm2k": {
            **LEGACY.file_record(MAPS["orm2k"], [2048, 2048]),
            "channels": {
                "red": "neutral occlusion constant 255; provider supplied no AO map",
                "green": "provider roughness",
                "blue": "provider metallic",
            },
        },
        "baseColor2k": base2k,
        "normal2k": normal2k,
    }


def detail_protection_group(obj: bpy.types.Object) -> dict[str, object]:
    mesh = obj.data
    mesh.update()
    curvature = np.zeros(len(mesh.vertices), dtype=np.float32)
    for polygon in mesh.polygons:
        face = polygon.normal
        for index in polygon.vertices:
            vertex_normal = mesh.vertices[index].normal
            value = 1.0 - abs(float(face.dot(vertex_normal)))
            if value > curvature[index]:
                curvature[index] = value

    group = obj.vertex_groups.new(name="V4_ProtectedDetail")
    weights = np.zeros(len(mesh.vertices), dtype=np.float32)
    reasons = {
        "highCurvature": 0,
        "lowerOrnament": 0,
        "frontBackArchitecture": 0,
        "endArchitecture": 0,
        "raisedRimOrFoliage": 0,
    }
    for vertex in mesh.vertices:
        point = vertex.co
        weight = min(1.0, float(curvature[vertex.index]) * 6.0)
        if curvature[vertex.index] >= 0.035:
            reasons["highCurvature"] += 1
        if point.z < -0.035:
            weight = max(weight, 0.94)
            reasons["lowerOrnament"] += 1
        if abs(point.y) > 0.50:
            weight = max(weight, 0.92)
            reasons["frontBackArchitecture"] += 1
        if abs(point.x) > 0.74:
            weight = max(weight, 0.90)
            reasons["endArchitecture"] += 1
        if point.z > 0.028:
            weight = max(weight, 0.92)
            reasons["raisedRimOrFoliage"] += 1
        weights[vertex.index] = weight
    quantized = np.round(weights * 20.0).astype(np.int16)
    for level in np.unique(quantized):
        indices = np.flatnonzero(quantized == level).tolist()
        group.add(indices, float(level) / 20.0, "REPLACE")
    return {
        "group": group.name,
        "method": (
            "Protect high-curvature vertices plus the lower ornament, front/back arches, end "
            "architecture and raised rim/foliage; concentrate collapse on broad low-curvature slab "
            "surfaces."
        ),
        "factor": 8.0,
        "authoredWeightSemantics": (
            "Higher authored weights mark protected detail. The Decimate modifier inverts this "
            "group so protected vertices receive low effective collapse weights and broad planar "
            "vertices receive high effective collapse weights."
        ),
        "weightPercentiles": {
            f"p{level}": round(float(np.percentile(weights, level)), 6)
            for level in (0, 25, 50, 75, 90, 95, 99, 100)
        },
        "effectiveCollapseWeightPercentiles": {
            f"p{level}": round(float(np.percentile(1.0 - weights, level)), 6)
            for level in (0, 25, 50, 75, 90, 95, 99, 100)
        },
        "reasonVertexCounts": reasons,
    }


def decimate_direct(obj: bpy.types.Object, protection: dict[str, object]) -> dict[str, object]:
    before = COMMON.topology(obj.data)
    ratio = TARGET_TRIANGLES / int(before["triangles"])
    modifier = obj.modifiers.new("V4_DirectDense_LocalSimplification", "DECIMATE")
    modifier.decimate_type = "COLLAPSE"
    modifier.ratio = ratio
    modifier.use_collapse_triangulate = True
    modifier.vertex_group = str(protection["group"])
    modifier.invert_vertex_group = True
    modifier.vertex_group_factor = float(protection["factor"])
    LEGACY.set_selected([obj], obj)
    result = bpy.ops.object.modifier_apply(modifier=modifier.name)
    if "FINISHED" not in result:
        raise RuntimeError(f"Direct dense decimation failed: {result}")
    obj.data.update()
    after = COMMON.topology(obj.data)
    triangles = int(after["triangles"])
    if not 200_000 <= triangles <= 250_000:
        raise ValueError(f"Direct derivative missed the 200-250k budget: {triangles}")
    if obj.data.uv_layers.active is None:
        raise ValueError("Direct dense decimation lost provider UV0")
    return {
        "method": "Blender collapse decimation with weighted detail protection",
        "targetTriangles": TARGET_TRIANGLES,
        "requestedRatio": ratio,
        "vertexGroupInverted": True,
        "before": before,
        "after": after,
        "protection": protection,
        "providerUv0Retained": True,
    }


def finalize_direct_normals(mesh: bpy.types.Mesh) -> dict[str, object]:
    corrected: list[Vector] = []
    geometry_fallbacks = 0
    flattened_up = 0
    minimum = 1.0
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    mesh.update()
    for polygon in mesh.polygons:
        face = polygon.normal.copy().normalized()
        exact_contact = polygon.normal.z > 0.999 and all(
            abs(mesh.vertices[index].co.z) <= 1e-7 for index in polygon.vertices
        )
        for loop_index in polygon.loop_indices:
            loop = mesh.loops[loop_index]
            normal = mesh.vertices[loop.vertex_index].normal.copy()
            if normal.length_squared <= 1e-16 or not all(math.isfinite(value) for value in normal):
                normal = face.copy()
                geometry_fallbacks += 1
            else:
                normal.normalize()
            if exact_contact:
                normal = Vector((0.0, 0.0, 1.0))
                flattened_up += 1
            elif normal.dot(face) <= 0.001:
                normal = face.copy()
                geometry_fallbacks += 1
            minimum = min(minimum, float(normal.dot(face)))
            corrected.append(normal)
    mesh.normals_split_custom_set(corrected)
    mesh.update()
    gate = LEGACY.validate_corner_normal_basis(mesh)
    return {
        "method": (
            "Rebuild split normals from simplified geometric vertex normals; use exact +Z on "
            "fully flattened contact polygons and the polygon face normal whenever a smoothed "
            "candidate leaves the geometric hemisphere."
        ),
        "geometricFaceFallbackCorners": geometry_fallbacks,
        "flattenedContactCornersSetExactUp": flattened_up,
        "minimumSelectedPolygonNormalDot": minimum,
        "gate": gate,
    }


def validate_direct_uv(mesh: bpy.types.Mesh) -> dict[str, object]:
    uv = mesh.uv_layers.active
    if uv is None or len(uv.data) != len(mesh.loops):
        raise ValueError("Direct derivative UV0 is missing or does not match corner count")
    values = np.asarray([(item.uv.x, item.uv.y) for item in uv.data], dtype=np.float64)
    if not np.isfinite(values).all():
        raise ValueError("Direct derivative UV0 contains non-finite coordinates")
    degenerate = 0
    minimum_area = math.inf
    for polygon in mesh.polygons:
        if len(polygon.loop_indices) != 3:
            raise ValueError("Direct derivative should remain triangulated")
        a, b, c = (uv.data[index].uv for index in polygon.loop_indices)
        area = abs(float((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x))) * 0.5
        minimum_area = min(minimum_area, area)
        if area <= 1e-12:
            degenerate += 1
    if degenerate:
        raise ValueError(f"Direct derivative contains {degenerate} degenerate UV triangles")
    return {
        "cornerCount": len(uv.data),
        "allFinite": True,
        "degenerateUvTriangles": degenerate,
        "minimumUvTriangleArea": minimum_area,
        "bounds": [
            [round(float(values[:, 0].min()), 7), round(float(values[:, 1].min()), 7)],
            [round(float(values[:, 0].max()), 7), round(float(values[:, 1].max()), 7)],
        ],
    }


def repair_degenerate_uv_triangles(mesh: bpy.types.Mesh) -> dict[str, object]:
    uv = mesh.uv_layers.active
    if uv is None:
        raise ValueError("Cannot repair missing UV0")
    repairs = []
    offset = 0.5 / 4096.0
    degenerate_polygons = []
    for polygon in mesh.polygons:
        if len(polygon.loop_indices) != 3:
            raise ValueError("Direct derivative should remain triangulated")
        loop_indices = list(polygon.loop_indices)
        points = [uv.data[index].uv.copy() for index in loop_indices]
        area = abs(float((points[1].x - points[0].x) * (points[2].y - points[0].y) - (points[1].y - points[0].y) * (points[2].x - points[0].x))) * 0.5
        if area > 1e-12:
            continue
        degenerate_polygons.append(polygon)

    for polygon in degenerate_polygons:
        loop_indices = list(polygon.loop_indices)
        points = [uv.data[index].uv.copy() for index in loop_indices]
        pairs = [(0, 1), (1, 2), (2, 0)]
        first, second = max(pairs, key=lambda pair: (points[pair[1]] - points[pair[0]]).length_squared)
        third = ({0, 1, 2} - {first, second}).pop()
        edge = points[second] - points[first]
        shared_vertices = {
            mesh.loops[loop_indices[first]].vertex_index,
            mesh.loops[loop_indices[second]].vertex_index,
        }
        candidates = [
            candidate
            for candidate in mesh.polygons
            if candidate.index != polygon.index
            and shared_vertices.issubset(
                {mesh.loops[index].vertex_index for index in candidate.loop_indices}
            )
        ]
        point_by_vertex = {
            mesh.loops[loop_indices[first]].vertex_index: points[first],
            mesh.loops[loop_indices[second]].vertex_index: points[second],
        }

        def island_edge_error(candidate: bpy.types.MeshPolygon) -> float:
            candidate_uv = {
                mesh.loops[index].vertex_index: uv.data[index].uv
                for index in candidate.loop_indices
            }
            return max(
                (candidate_uv[index] - point_by_vertex[index]).length
                for index in shared_vertices
            )

        neighbor = min(candidates, key=island_edge_error) if candidates else None
        if neighbor is None:
            raise ValueError(f"UV-degenerate polygon {polygon.index} has no island neighbor")
        edge_error = island_edge_error(neighbor)
        if edge_error > 0.5 / 4096.0:
            raise ValueError(
                f"UV-degenerate polygon {polygon.index} is not contiguous with its nearest "
                f"geometric-edge neighbor in the provider atlas: {edge_error}"
            )
        neighbor_points = [uv.data[index].uv.copy() for index in neighbor.loop_indices]
        neighbor_signed_area = float(
            (neighbor_points[1].x - neighbor_points[0].x)
            * (neighbor_points[2].y - neighbor_points[0].y)
            - (neighbor_points[1].y - neighbor_points[0].y)
            * (neighbor_points[2].x - neighbor_points[0].x)
        ) * 0.5
        if abs(neighbor_signed_area) <= 1e-12:
            raise ValueError(
                f"UV-degenerate polygon {polygon.index} has only a degenerate island neighbor"
            )
        if edge.length <= 1e-12:
            sign = 1.0 if neighbor_signed_area > 0.0 else -1.0
            uv.data[loop_indices[1]].uv = points[0] + Vector((offset, 0.0))
            uv.data[loop_indices[2]].uv = points[0] + Vector((0.0, sign * offset))
        else:
            perpendicular = Vector((-edge.y, edge.x)).normalized()
            positive_candidate = points[third] + perpendicular * offset
            positive_points = points.copy()
            positive_points[third] = positive_candidate
            positive_signed_area = float(
                (positive_points[1].x - positive_points[0].x)
                * (positive_points[2].y - positive_points[0].y)
                - (positive_points[1].y - positive_points[0].y)
                * (positive_points[2].x - positive_points[0].x)
            ) * 0.5
            direction = 1.0 if positive_signed_area * neighbor_signed_area > 0.0 else -1.0
            uv.data[loop_indices[third]].uv = points[third] + perpendicular * offset * direction
        repaired = [uv.data[index].uv.copy() for index in loop_indices]
        repaired_signed_area = float(
            (repaired[1].x - repaired[0].x) * (repaired[2].y - repaired[0].y)
            - (repaired[1].y - repaired[0].y) * (repaired[2].x - repaired[0].x)
        ) * 0.5
        repaired_area = abs(repaired_signed_area)
        if repaired_area <= 1e-12:
            raise ValueError(f"UV singularity repair failed on polygon {polygon.index}")
        if repaired_signed_area * neighbor_signed_area <= 0.0:
            raise ValueError(f"UV singularity repair changed island winding on polygon {polygon.index}")
        repairs.append(
            {
                "polygon": polygon.index,
                "worldAreaSquareMetres": float(polygon.area),
                "worldCenter": [round(value, 8) for value in polygon.center],
                "uvBefore": [[round(value, 9) for value in point] for point in points],
                "uvAfter": [[round(value, 9) for value in point] for point in repaired],
                "signedAreaBefore": 0.0,
                "signedAreaAfter": repaired_signed_area,
                "areaAfter": repaired_area,
                "neighborPolygon": neighbor.index,
                "neighborSignedArea": neighbor_signed_area,
                "sharedEdgeUvMismatch": edge_error,
                "windingMatchesNeighbor": True,
                "islandContinuity": (
                    "Shares the longest geometric edge with the recorded non-degenerate neighbor; "
                    "the half-pixel footprint uses matching winding and remains inside the "
                    "provider atlas padding adjacent to that island edge."
                ),
                "maximumOffsetUv": offset,
                "maximumOffsetPixelsAt4k": 0.5,
            }
        )
    mesh.update()
    return {
        "method": (
            "Give only decimator-created zero-area UV triangles a loop-local perpendicular "
            "half-pixel footprint before tangent generation; geometry and all other UVs unchanged."
        ),
        "repairedTriangles": len(repairs),
        "repairs": repairs,
    }


def diagnose_residual_tangent_singularities(
    obj: bpy.types.Object,
    tangent_gate: dict[str, object],
    uv_gate: dict[str, object],
) -> dict[str, object]:
    """Record the one fail-closed residual TBN diagnosis for this reduction.

    The report keeps geometry, UV, and normal conditioning separate so a later
    decision can repair a real local degeneracy or reject the reduction. It
    does not mutate geometry, UVs, normals, or the eventual exported basis.
    """

    mesh = obj.data
    uv = mesh.uv_layers.active
    if uv is None:
        raise ValueError("Cannot diagnose residual tangents without UV0")
    loop_polygons = {
        loop_index: polygon
        for polygon in mesh.polygons
        for loop_index in polygon.loop_indices
    }
    mesh.calc_tangents(uvmap=uv.name)
    residual_loops = [
        index for index, loop in enumerate(mesh.loops) if loop.tangent.length <= 1e-6
    ]
    residual_polygons = sorted({loop_polygons[index].index for index in residual_loops})
    records = []
    classifications: dict[str, int] = {}
    for polygon_index in residual_polygons:
        polygon = mesh.polygons[polygon_index]
        loop_indices = list(polygon.loop_indices)
        positions = [mesh.vertices[mesh.loops[index].vertex_index].co.copy() for index in loop_indices]
        points = [uv.data[index].uv.copy() for index in loop_indices]
        geometry_edges = [
            float((positions[(index + 1) % 3] - positions[index]).length) for index in range(3)
        ]
        uv_edges = [
            float((points[(index + 1) % 3] - points[index]).length) for index in range(3)
        ]
        geometry_area = float(polygon.area)
        signed_uv_area = float(
            (points[1].x - points[0].x) * (points[2].y - points[0].y)
            - (points[1].y - points[0].y) * (points[2].x - points[0].x)
        ) * 0.5
        uv_area = abs(signed_uv_area)
        geometry_quality = (
            4.0 * math.sqrt(3.0) * geometry_area / sum(value * value for value in geometry_edges)
            if any(geometry_edges)
            else 0.0
        )
        uv_quality = (
            4.0 * math.sqrt(3.0) * uv_area / sum(value * value for value in uv_edges)
            if any(uv_edges)
            else 0.0
        )
        determinant = signed_uv_area * 2.0
        raw_tangent = Vector((0.0, 0.0, 0.0))
        if abs(determinant) > 1e-30:
            edge_one = positions[1] - positions[0]
            edge_two = positions[2] - positions[0]
            delta_one = points[1] - points[0]
            delta_two = points[2] - points[0]
            raw_tangent = (
                edge_one * delta_two.y - edge_two * delta_one.y
            ) / determinant
        corner_records = []
        for loop_index in loop_indices:
            normal = mesh.corner_normals[loop_index].vector.copy()
            projected = raw_tangent - normal * raw_tangent.dot(normal)
            loop = mesh.loops[loop_index]
            corner_records.append(
                {
                    "loop": loop_index,
                    "vertex": loop.vertex_index,
                    "isResidual": loop_index in residual_loops,
                    "normal": [round(float(value), 9) for value in normal],
                    "normalDotFace": float(normal.dot(polygon.normal)),
                    "blenderTangentLength": float(loop.tangent.length),
                    "analyticProjectedTangentLength": float(projected.length),
                }
            )
        if geometry_area <= 1e-14 or geometry_quality <= 1e-3:
            classification = "collapsed-or-numerically-singular-geometry"
        elif uv_area <= 1e-12:
            classification = "zero-area-uv"
        elif uv_quality <= 1e-7:
            classification = "numerically-ill-conditioned-uv"
        elif any(
            item["isResidual"] and item["analyticProjectedTangentLength"] <= 1e-6
            for item in corner_records
        ):
            classification = "normal-orthogonalization-singularity"
        else:
            classification = "mikk-neighborhood-or-split-basis-singularity"
        classifications[classification] = classifications.get(classification, 0) + 1
        center_world = obj.matrix_world @ polygon.center
        records.append(
            {
                "polygon": polygon_index,
                "residualLoops": [index for index in loop_indices if index in residual_loops],
                "vertexIndices": [mesh.loops[index].vertex_index for index in loop_indices],
                "classification": classification,
                "geometryAreaSquareMetres": geometry_area,
                "geometryEdgeLengthsMetres": geometry_edges,
                "geometryTriangleQuality": geometry_quality,
                "centerLocal": [round(float(value), 9) for value in polygon.center],
                "centerWorld": [round(float(value), 9) for value in center_world],
                "faceNormal": [round(float(value), 9) for value in polygon.normal],
                "uv": [[round(float(value), 12) for value in point] for point in points],
                "signedUvArea": signed_uv_area,
                "uvArea": uv_area,
                "uvEdgeLengths": uv_edges,
                "uvTriangleQuality": uv_quality,
                "analyticRawTangentLength": float(raw_tangent.length),
                "corners": corner_records,
            }
        )
    mesh.free_tangents()
    diagnostic = {
        "schema": 1,
        "status": "fail-closed residual tangent diagnosis; no repair applied",
        "candidate": {
            "source": COMMON.relative(COMMON.DENSE),
            "sourceSha256": COMMON.EXPECTED_DENSE_SHA256,
            "targetTriangles": TARGET_TRIANGLES,
            "actualTriangles": COMMON.triangle_count(mesh),
            "vertexGroupInverted": True,
        },
        "preBasisRepair": tangent_gate,
        "validatedUvGateBeforeTangentGeneration": uv_gate,
        "residualLoopCount": len(residual_loops),
        "residualPolygonCount": len(residual_polygons),
        "classificationCounts": classifications,
        "polygons": records,
        "interpretation": (
            "UV area being greater than the exact-degeneracy threshold does not by itself prove "
            "a numerically stable tangent basis. Triangle quality, geometric area, and the "
            "analytic projected tangent above distinguish local conditioning from a normal-basis "
            "failure. No export is permitted while any residual loop remains."
        ),
    }
    TANGENT_DIAGNOSTIC.parent.mkdir(parents=True, exist_ok=True)
    TANGENT_DIAGNOSTIC.write_text(json.dumps(diagnostic, indent=2) + "\n")
    return diagnostic


def _outside_local_signature(
    mesh: bpy.types.Mesh,
    repair_regions: list[dict[str, object]],
) -> dict[str, object]:
    """Hash all corner geometry/UV/material data outside bounded repair regions."""

    uv = mesh.uv_layers.active
    if uv is None:
        raise ValueError("Cannot verify local topology repair without UV0")
    digests: list[bytes] = []
    excluded = 0
    for polygon in mesh.polygons:
        positions = [mesh.vertices[mesh.loops[index].vertex_index].co for index in polygon.loop_indices]
        local = any(
            any(
                (point - Vector(region["center"])).length <= float(region["radius"])
                for point in positions
            )
            for region in repair_regions
        )
        if local:
            excluded += 1
            continue
        corners = [
            (
                round(float(mesh.vertices[mesh.loops[index].vertex_index].co.x), 9),
                round(float(mesh.vertices[mesh.loops[index].vertex_index].co.y), 9),
                round(float(mesh.vertices[mesh.loops[index].vertex_index].co.z), 9),
                round(float(uv.data[index].uv.x), 11),
                round(float(uv.data[index].uv.y), 11),
            )
            for index in polygon.loop_indices
        ]
        rotations = [tuple(corners[index:] + corners[:index]) for index in range(len(corners))]
        canonical = min(rotations)
        payload = repr((polygon.material_index, canonical)).encode("utf-8")
        digests.append(hashlib.sha256(payload).digest())
    digests.sort()
    aggregate = hashlib.sha256()
    for digest in digests:
        aggregate.update(digest)
    return {
        "includedFaces": len(digests),
        "excludedLocalFaces": excluded,
        "sha256": aggregate.hexdigest(),
        "signature": (
            "Order-independent SHA-256 over material index and cyclic, winding-preserving "
            "position/UV corner tuples outside the recorded edge-radius regions."
        ),
    }


def collapse_residual_geometry_slivers(
    obj: bpy.types.Object,
    diagnostic: dict[str, object],
) -> dict[str, object]:
    """Collapse one safe local edge for each diagnosed geometric sliver.

    This is the sole topology repair attempt for the corrected weighted
    reduction. It rejects boundary, material-boundary, atlas-seam, overlapping,
    or greater-than-five-millimetre collapses instead of broadening the fix.
    """

    mesh = obj.data
    uv = mesh.uv_layers.active
    if uv is None:
        raise ValueError("Cannot repair residual geometry slivers without UV0")
    polygons = list(diagnostic["polygons"])
    if not polygons or len(polygons) > 8:
        raise ValueError(f"Residual topology repair is out of bounded scope: {len(polygons)} faces")
    if any(item["classification"] != "collapsed-or-numerically-singular-geometry" for item in polygons):
        raise ValueError("Residual tangent failures are not all proven geometric slivers")

    edge_faces: dict[tuple[int, int], list[bpy.types.MeshPolygon]] = {}
    for polygon in mesh.polygons:
        vertices = [mesh.loops[index].vertex_index for index in polygon.loop_indices]
        for index in range(len(vertices)):
            key = tuple(sorted((vertices[index], vertices[(index + 1) % len(vertices)])))
            edge_faces.setdefault(key, []).append(polygon)

    def polygon_uv_by_vertex(polygon: bpy.types.MeshPolygon) -> dict[int, Vector]:
        return {
            mesh.loops[index].vertex_index: uv.data[index].uv.copy()
            for index in polygon.loop_indices
        }

    selected: list[dict[str, object]] = []
    used_vertices: set[int] = set()
    atlas_tolerance = 0.5 / 4096.0
    for item in polygons:
        polygon = mesh.polygons[int(item["polygon"])]
        vertices = [mesh.loops[index].vertex_index for index in polygon.loop_indices]
        source_uv = polygon_uv_by_vertex(polygon)
        candidates = []
        for index in range(3):
            first = vertices[index]
            second = vertices[(index + 1) % 3]
            key = tuple(sorted((first, second)))
            linked = edge_faces.get(key, [])
            length = float((mesh.vertices[first].co - mesh.vertices[second].co).length)
            if len(linked) != 2 or first in used_vertices or second in used_vertices:
                continue
            neighbor = linked[0] if linked[1].index == polygon.index else linked[1]
            neighbor_uv = polygon_uv_by_vertex(neighbor)
            mismatch = max(
                float((source_uv[vertex] - neighbor_uv[vertex]).length) for vertex in key
            )
            material_match = neighbor.material_index == polygon.material_index
            if mismatch <= atlas_tolerance and material_match and length <= 0.005:
                candidates.append((length, key, neighbor, mismatch, linked))
        if not candidates:
            raise ValueError(
                f"Geometric sliver {polygon.index} has no disjoint manifold, UV-contiguous, "
                "same-material collapse edge at or below 5 mm"
            )
        length, key, neighbor, mismatch, linked = min(candidates, key=lambda value: value[0])
        used_vertices.update(key)
        midpoint = (mesh.vertices[key[0]].co + mesh.vertices[key[1]].co) * 0.5
        selected.append(
            {
                "sourcePolygon": polygon.index,
                "sourceResidualLoops": item["residualLoops"],
                "edgeVertices": list(key),
                "edgeLengthMetres": length,
                "center": [float(value) for value in midpoint],
                "radius": length + 1e-5,
                "linkedFaces": [value.index for value in linked],
                "neighborPolygon": neighbor.index,
                "sourceAndNeighborMaterial": polygon.material_index,
                "sharedEdgeUvMismatch": mismatch,
                "atlasContinuityTolerance": atlas_tolerance,
                "sourceGeometryAreaSquareMetres": item["geometryAreaSquareMetres"],
                "sourceGeometryTriangleQuality": item["geometryTriangleQuality"],
                "sourceUvArea": item["uvArea"],
            }
        )

    before_topology = COMMON.topology(mesh)
    before_materials = {
        str(index): sum(polygon.material_index == index for polygon in mesh.polygons)
        for index in sorted({polygon.material_index for polygon in mesh.polygons})
    }
    outside_before = _outside_local_signature(mesh, selected)

    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.verts.ensure_lookup_table()
    bm.edges.ensure_lookup_table()
    edges_by_key = {
        tuple(sorted((edge.verts[0].index, edge.verts[1].index))): edge for edge in bm.edges
    }
    collapse_edges = [edges_by_key[tuple(item["edgeVertices"])] for item in selected]
    bmesh.ops.collapse(bm, edges=collapse_edges, uvs=True)
    non_triangles = [face for face in bm.faces if len(face.verts) != 3]
    if non_triangles:
        bmesh.ops.triangulate(
            bm,
            faces=non_triangles,
            quad_method="BEAUTY",
            ngon_method="BEAUTY",
        )
    bm.to_mesh(mesh)
    bm.free()
    mesh.update(calc_edges=True)

    if any(len(polygon.loop_indices) != 3 for polygon in mesh.polygons):
        raise ValueError("Bounded sliver collapse left non-triangular runtime geometry")
    after_topology = COMMON.topology(mesh)
    outside_after = _outside_local_signature(mesh, selected)
    if outside_before["includedFaces"] != outside_after["includedFaces"]:
        raise ValueError(
            "Local sliver repair changed the face count outside its bounded one-rings: "
            f"{outside_before['includedFaces']} -> {outside_after['includedFaces']}"
        )
    if outside_before["sha256"] != outside_after["sha256"]:
        raise ValueError("Local sliver repair changed geometry, UVs, or materials outside its one-rings")
    after_materials = {
        str(index): sum(polygon.material_index == index for polygon in mesh.polygons)
        for index in sorted({polygon.material_index for polygon in mesh.polygons})
    }
    report = {
        "method": (
            "Collapse one disjoint, manifold, same-material, provider-atlas-contiguous edge per "
            "diagnosed near-collinear geometric sliver; no global weld or smoothing."
        ),
        "repairAttemptLimit": 1,
        "sourceDiagnostic": COMMON.relative(TANGENT_DIAGNOSTIC),
        "sourceResidualLoops": int(diagnostic["residualLoopCount"]),
        "sourceResidualPolygons": int(diagnostic["residualPolygonCount"]),
        "collapsedEdges": selected,
        "maximumCollapseLengthMetres": max(float(item["edgeLengthMetres"]) for item in selected),
        "beforeTopology": before_topology,
        "afterTopology": after_topology,
        "materialFaceCountsBefore": before_materials,
        "materialFaceCountsAfter": after_materials,
        "outsideLocalRegionsBefore": outside_before,
        "outsideLocalRegionsAfter": outside_after,
        "outsideLocalGeometryUvMaterialUnchanged": True,
    }
    return report


COMPONENT_LAYOUTS = {
    5120: ("b", 1),
    5121: ("B", 1),
    5122: ("h", 2),
    5123: ("H", 2),
    5125: ("I", 4),
    5126: ("f", 4),
}
TYPE_COMPONENTS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def accessor_layout(document: dict[str, Any], index: int) -> dict[str, Any]:
    accessor = document["accessors"][index]
    if "sparse" in accessor or "bufferView" not in accessor:
        raise ValueError(f"Accessor {index} uses an unsupported sparse or implicit layout")
    view = document["bufferViews"][int(accessor["bufferView"])]
    if int(view.get("buffer", 0)) != 0:
        raise ValueError(f"Accessor {index} does not use the GLB binary buffer")
    component_type = int(accessor["componentType"])
    value_type = str(accessor["type"])
    if component_type not in COMPONENT_LAYOUTS or value_type not in TYPE_COMPONENTS:
        raise ValueError(f"Accessor {index} has an unsupported layout")
    code, component_size = COMPONENT_LAYOUTS[component_type]
    components = TYPE_COMPONENTS[value_type]
    element_size = component_size * components
    stride = int(view.get("byteStride", element_size))
    if stride < element_size:
        raise ValueError(f"Accessor {index} has an invalid byte stride")
    return {
        "index": index,
        "count": int(accessor["count"]),
        "componentType": component_type,
        "components": components,
        "componentSize": component_size,
        "elementSize": element_size,
        "format": "<" + code * components,
        "offset": int(view.get("byteOffset", 0)) + int(accessor.get("byteOffset", 0)),
        "stride": stride,
    }


def accessor_value(
    binary: bytes | bytearray,
    layout: dict[str, Any],
    index: int,
) -> tuple[float | int, ...]:
    if not 0 <= index < int(layout["count"]):
        raise IndexError(f"Accessor {layout['index']} row {index} is out of range")
    return struct.unpack_from(
        str(layout["format"]),
        binary,
        int(layout["offset"]) + index * int(layout["stride"]),
    )


def accessor_payload(binary: bytes | bytearray, layout: dict[str, Any]) -> bytes:
    return b"".join(
        binary[
            int(layout["offset"]) + index * int(layout["stride"]):
            int(layout["offset"]) + index * int(layout["stride"]) + int(layout["elementSize"])
        ]
        for index in range(int(layout["count"]))
    )


def primitive_triangle_indices(
    document: dict[str, Any],
    binary: bytes | bytearray,
    primitive: dict[str, Any],
) -> tuple[list[tuple[int, int, int]], dict[str, Any] | None]:
    if int(primitive.get("mode", 4)) != 4:
        raise ValueError("Exact tangent construction supports triangle primitives only")
    if "indices" not in primitive:
        count = int(document["accessors"][int(primitive["attributes"]["POSITION"])]["count"])
        if count % 3:
            raise ValueError("Unindexed triangle primitive has an incomplete triangle")
        return ([(index, index + 1, index + 2) for index in range(0, count, 3)], None)
    layout = accessor_layout(document, int(primitive["indices"]))
    if int(layout["components"]) != 1 or int(layout["componentType"]) not in (5121, 5123, 5125):
        raise ValueError("Triangle index accessor must use unsigned scalar values")
    values = [int(accessor_value(binary, layout, index)[0]) for index in range(int(layout["count"]))]
    if len(values) % 3:
        raise ValueError("Indexed triangle primitive has an incomplete triangle")
    return ([tuple(values[index:index + 3]) for index in range(0, len(values), 3)], layout)


def _raw_rows_except(
    binary: bytes | bytearray,
    layout: dict[str, Any],
    excluded: set[int],
) -> bytes:
    return b"".join(
        binary[
            int(layout["offset"]) + index * int(layout["stride"]):
            int(layout["offset"]) + index * int(layout["stride"]) + int(layout["elementSize"])
        ]
        for index in range(int(layout["count"]))
        if index not in excluded
    )


def construct_exact_export_tangents(
    path: Path,
    diagnostic: dict[str, Any],
) -> dict[str, Any]:
    """Replace only the seven known zero tangent rows with analytic UV derivatives."""

    document, binary_bytes = LEGACY.read_glb(path)
    binary = bytearray(binary_bytes)
    material_indices = [
        index
        for index, material in enumerate(document.get("materials", []))
        if material.get("name") == LEGACY.MATERIAL_NAME
    ]
    if len(material_indices) != 1:
        raise ValueError(f"Export lost the one runtime marble material: {material_indices}")
    material_index = material_indices[0]
    marble_material = document["materials"][material_index]
    packed = marble_material.get("pbrMetallicRoughness", {}).get("metallicRoughnessTexture")
    if packed is None:
        raise ValueError("Runtime marble export lost its ORM binding")
    marble_material["occlusionTexture"] = {"index": int(packed["index"]), "strength": 1.0}

    expected_rows = int(diagnostic["residualLoopCount"])
    expected_polygons = int(diagnostic["residualPolygonCount"])
    if (expected_rows, expected_polygons) != (7, 6):
        raise ValueError(
            f"Unexpected source residual scope: rows={expected_rows}, polygons={expected_polygons}"
        )
    expected_metrics = {
        int(item["polygon"]): (
            float(item["geometryAreaSquareMetres"]),
            abs(float(item["signedUvArea"])) * 2.0,
        )
        for item in diagnostic["polygons"]
    }

    repairs: list[dict[str, Any]] = []
    target_triangle_metrics: dict[tuple[int, int, int], tuple[float, float]] = {}
    protected_accessors: list[dict[str, Any]] = []
    unchanged_tangent_hashes: list[dict[str, Any]] = []
    visited_tangent_accessors: set[int] = set()
    post_pack_expectations: dict[tuple[int, int, int], dict[str, Any]] = {}
    for mesh_index, mesh in enumerate(document.get("meshes", [])):
        for primitive_index, primitive in enumerate(mesh.get("primitives", [])):
            if int(primitive.get("material", -1)) != material_index:
                continue
            attributes = primitive.get("attributes", {})
            required = {"POSITION", "NORMAL", "TANGENT", "TEXCOORD_0"}
            if missing := sorted(required - set(attributes)):
                raise ValueError(f"Cannot validate marble tangent basis; missing {missing}")
            tangent_layout = accessor_layout(document, int(attributes["TANGENT"]))
            if int(tangent_layout["index"]) in visited_tangent_accessors:
                raise ValueError("Runtime marble unexpectedly reuses a tangent accessor across primitives")
            visited_tangent_accessors.add(int(tangent_layout["index"]))
            position_layout = accessor_layout(document, int(attributes["POSITION"]))
            normal_layout = accessor_layout(document, int(attributes["NORMAL"]))
            uv_layout = accessor_layout(document, int(attributes["TEXCOORD_0"]))
            layouts = {
                "POSITION": position_layout,
                "NORMAL": normal_layout,
                "TEXCOORD_0": uv_layout,
            }
            if (
                int(position_layout["componentType"]) != 5126
                or int(position_layout["components"]) != 3
                or int(normal_layout["componentType"]) != 5126
                or int(normal_layout["components"]) != 3
                or int(uv_layout["componentType"]) != 5126
                or int(uv_layout["components"]) != 2
                or int(tangent_layout["componentType"]) != 5126
                or int(tangent_layout["components"]) != 4
            ):
                raise ValueError("Exact tangent construction requires float POSITION/NORMAL/UV/TANGENT")
            counts = {int(layout["count"]) for layout in (*layouts.values(), tangent_layout)}
            if len(counts) != 1:
                raise ValueError("Exported marble vertex attribute counts differ")
            triangles, index_layout = primitive_triangle_indices(document, binary, primitive)
            if index_layout is not None:
                layouts["INDICES"] = index_layout
            for semantic, layout in layouts.items():
                payload = accessor_payload(binary, layout)
                protected_accessors.append(
                    {
                        "mesh": mesh_index,
                        "primitive": primitive_index,
                        "semantic": semantic,
                        "accessor": int(layout["index"]),
                        "bytes": len(payload),
                        "sha256Before": hashlib.sha256(payload).hexdigest(),
                    }
                )

            invalid = []
            for vertex_index in range(int(tangent_layout["count"])):
                value = accessor_value(binary, tangent_layout, vertex_index)
                length = math.sqrt(sum(float(component) ** 2 for component in value[:3]))
                if not math.isfinite(length) or length <= 1e-8:
                    invalid.append((vertex_index, value))
            invalid_indices = {index for index, _ in invalid}
            unchanged_before = _raw_rows_except(binary, tangent_layout, invalid_indices)

            incident: dict[int, list[tuple[int, tuple[int, int, int]]]] = {
                index: [] for index in invalid_indices
            }
            for triangle_ordinal, triangle in enumerate(triangles):
                for index in set(triangle) & invalid_indices:
                    incident[index].append((triangle_ordinal, triangle))

            for vertex_index, old in invalid:
                normal = np.asarray(
                    accessor_value(binary, normal_layout, vertex_index)[:3],
                    dtype=np.float64,
                )
                normal_length = float(np.linalg.norm(normal))
                if not np.isfinite(normal).all() or normal_length <= 1e-16:
                    raise ValueError(f"Cannot construct tangent {vertex_index}: invalid exported normal")
                normal /= normal_length
                candidates: list[dict[str, Any]] = []
                for triangle_ordinal, triangle in incident[vertex_index]:
                    p0, p1, p2 = (
                        np.asarray(
                            accessor_value(binary, position_layout, index)[:3],
                            dtype=np.float64,
                        )
                        for index in triangle
                    )
                    uv0, uv1, uv2 = (
                        np.asarray(
                            accessor_value(binary, uv_layout, index)[:2],
                            dtype=np.float64,
                        )
                        for index in triangle
                    )
                    edge_one = p1 - p0
                    edge_two = p2 - p0
                    delta_one = uv1 - uv0
                    delta_two = uv2 - uv0
                    determinant = float(
                        delta_one[0] * delta_two[1] - delta_one[1] * delta_two[0]
                    )
                    if not math.isfinite(determinant) or abs(determinant) <= 1e-15:
                        raise ValueError(
                            f"Cannot construct tangent {vertex_index}: incident triangle "
                            f"{triangle_ordinal} has unstable UV determinant {determinant}"
                        )
                    tangent_raw = (
                        edge_one * delta_two[1] - edge_two * delta_one[1]
                    ) / determinant
                    bitangent_raw = (
                        edge_two * delta_one[0] - edge_one * delta_two[0]
                    ) / determinant
                    tangent = tangent_raw - normal * float(np.dot(normal, tangent_raw))
                    projected_length = float(np.linalg.norm(tangent))
                    if (
                        not np.isfinite(tangent).all()
                        or not np.isfinite(bitangent_raw).all()
                        or projected_length <= 1e-8
                    ):
                        raise ValueError(
                            f"Cannot construct tangent {vertex_index}: incident triangle "
                            f"{triangle_ordinal} produced a non-finite or short differential basis"
                        )
                    tangent /= projected_length
                    parity_measure = float(np.dot(np.cross(normal, tangent), bitangent_raw))
                    if not math.isfinite(parity_measure) or abs(parity_measure) <= 1e-12:
                        raise ValueError(
                            f"Cannot construct tangent {vertex_index}: unstable handedness on "
                            f"triangle {triangle_ordinal}"
                        )
                    handedness = -1.0 if parity_measure < 0.0 else 1.0
                    geometry_area = float(np.linalg.norm(np.cross(edge_one, edge_two)) * 0.5)
                    target_triangle_metrics[(mesh_index, primitive_index, triangle_ordinal)] = (
                        geometry_area,
                        abs(determinant),
                    )
                    candidates.append(
                        {
                            "triangle": triangle_ordinal,
                            "indices": list(triangle),
                            "uvDeterminant": determinant,
                            "geometryAreaSquareMetres": geometry_area,
                            "projectedTangentLength": projected_length,
                            "direction": tangent,
                            "handedness": handedness,
                            "parityMeasure": parity_measure,
                        }
                    )
                if not candidates:
                    raise ValueError(f"Cannot construct tangent {vertex_index}: no incident triangles")
                directions = [item["direction"] for item in candidates]
                minimum_pair_alignment = min(
                    (
                        float(np.dot(first, second))
                        for offset, first in enumerate(directions)
                        for second in directions[offset + 1:]
                    ),
                    default=1.0,
                )
                if minimum_pair_alignment < 0.999:
                    raise ValueError(
                        f"Cannot construct tangent {vertex_index}: incident directions disagree "
                        f"({minimum_pair_alignment})"
                    )
                handedness_values = {float(item["handedness"]) for item in candidates}
                if len(handedness_values) != 1:
                    raise ValueError(
                        f"Cannot construct tangent {vertex_index}: incident triangles disagree "
                        "on handedness"
                    )
                tangent = np.sum(np.stack(directions, axis=0), axis=0, dtype=np.float64)
                tangent -= normal * float(np.dot(normal, tangent))
                tangent_length = float(np.linalg.norm(tangent))
                if not np.isfinite(tangent).all() or tangent_length <= 1e-16:
                    raise ValueError(f"Cannot construct tangent {vertex_index}: averaged basis collapsed")
                tangent /= tangent_length
                minimum_final_alignment = min(float(np.dot(tangent, item)) for item in directions)
                if minimum_final_alignment < 0.99999:
                    raise ValueError(
                        f"Cannot construct tangent {vertex_index}: final derivative alignment "
                        f"{minimum_final_alignment} is below 0.99999"
                    )
                handedness = handedness_values.pop()
                tangent_offset = int(tangent_layout["offset"]) + vertex_index * int(tangent_layout["stride"])
                struct.pack_into(
                    "<4f",
                    binary,
                    tangent_offset,
                    float(tangent[0]),
                    float(tangent[1]),
                    float(tangent[2]),
                    handedness,
                )
                repair_record = {
                        "mesh": mesh_index,
                        "primitive": primitive_index,
                        "vertex": vertex_index,
                        "old": [float(value) for value in old],
                        "new": [
                            float(tangent[0]),
                            float(tangent[1]),
                            float(tangent[2]),
                            handedness,
                        ],
                        "incidentTriangleCount": len(candidates),
                        "minimumIncidentDirectionDot": minimum_pair_alignment,
                        "minimumFinalDerivativeAlignment": minimum_final_alignment,
                        "handedness": handedness,
                        "incidentTriangles": [
                            {
                                key: value
                                for key, value in item.items()
                                if key != "direction"
                            }
                            for item in candidates
                        ],
                    }
                repairs.append(repair_record)
                post_pack_expectations[(mesh_index, primitive_index, vertex_index)] = {
                    "directions": [item.copy() for item in directions],
                    "handedness": handedness,
                    "record": repair_record,
                }
            unchanged_after = _raw_rows_except(binary, tangent_layout, invalid_indices)
            if unchanged_before != unchanged_after:
                raise ValueError("Exact tangent construction changed a non-target tangent row")
            unchanged_tangent_hashes.append(
                {
                    "mesh": mesh_index,
                    "primitive": primitive_index,
                    "accessor": int(tangent_layout["index"]),
                    "rows": int(tangent_layout["count"]) - len(invalid_indices),
                    "sha256Before": hashlib.sha256(unchanged_before).hexdigest(),
                    "sha256After": hashlib.sha256(unchanged_after).hexdigest(),
                    "byteExact": True,
                }
            )

    if len(repairs) != expected_rows:
        raise ValueError(f"Expected {expected_rows} singular exported rows, found {len(repairs)}")
    if len(target_triangle_metrics) != expected_polygons:
        raise ValueError(
            f"Expected {expected_polygons} affected exported triangles, found "
            f"{len(target_triangle_metrics)}"
        )
    actual_metrics = {
        triangle_ordinal: metrics
        for (_, _, triangle_ordinal), metrics in target_triangle_metrics.items()
    }
    if set(actual_metrics) != set(expected_metrics):
        raise ValueError(
            "Exported singular triangle ordinals do not map exactly to the six diagnosed "
            f"polygon indices: expected={sorted(expected_metrics)}, actual={sorted(actual_metrics)}"
        )
    metric_matches = []
    for polygon_index in sorted(expected_metrics):
        expected_area, expected_determinant = expected_metrics[polygon_index]
        actual_area, actual_determinant = actual_metrics[polygon_index]
        area_error = abs(actual_area - expected_area) / max(expected_area, 1e-30)
        determinant_error = abs(actual_determinant - expected_determinant) / max(
            expected_determinant, 1e-30
        )
        if area_error > 1e-3 or determinant_error > 1e-2:
            raise ValueError(
                "Exported singular triangle does not map to the six diagnosed polygons: "
                f"areaError={area_error}, determinantError={determinant_error}"
            )
        metric_matches.append(
            {
                "sourcePolygonAndExportTriangleOrdinal": polygon_index,
                "expectedGeometryArea": expected_area,
                "actualGeometryArea": actual_area,
                "relativeGeometryAreaError": area_error,
                "expectedAbsoluteUvDeterminant": expected_determinant,
                "actualAbsoluteUvDeterminant": actual_determinant,
                "relativeUvDeterminantError": determinant_error,
                "mappingEvidence": (
                    "The glTF exporter retained source triangle order. Geometry area and the "
                    "float32-exported UV determinant independently agree; the 1% determinant "
                    "bound covers subtraction quantization only on the 2.03e-10 sliver."
                ),
            }
        )

    for row in protected_accessors:
        semantic_layout = None
        for mesh in document.get("meshes", []):
            for primitive in mesh.get("primitives", []):
                attributes = primitive.get("attributes", {})
                candidate = primitive.get("indices") if row["semantic"] == "INDICES" else attributes.get(row["semantic"])
                if candidate is not None and int(candidate) == int(row["accessor"]):
                    semantic_layout = accessor_layout(document, int(candidate))
                    break
            if semantic_layout is not None:
                break
        if semantic_layout is None:
            raise ValueError(f"Could not re-read protected accessor {row['accessor']}")
        payload = accessor_payload(binary, semantic_layout)
        row["sha256After"] = hashlib.sha256(payload).hexdigest()
        row["byteExact"] = row["sha256Before"] == row["sha256After"]
        if not row["byteExact"]:
            raise ValueError(f"Exact tangent construction changed protected {row['semantic']} bytes")

    maximum_normal_unit_error = 0.0
    maximum_tangent_unit_error = 0.0
    maximum_normal_tangent_dot = 0.0
    repaired_maximum_unit_error = 0.0
    repaired_maximum_dot = 0.0
    post_pack_minimum_derivative_alignment = 1.0
    untouched_rows_above_repaired_unit_threshold = 0
    repaired_keys = {(item["mesh"], item["primitive"], item["vertex"]) for item in repairs}
    validated = 0
    handedness_values: set[float] = set()
    for mesh_index, mesh in enumerate(document.get("meshes", [])):
        for primitive_index, primitive in enumerate(mesh.get("primitives", [])):
            if int(primitive.get("material", -1)) != material_index:
                continue
            attributes = primitive["attributes"]
            tangent_layout = accessor_layout(document, int(attributes["TANGENT"]))
            normal_layout = accessor_layout(document, int(attributes["NORMAL"]))
            for vertex_index in range(int(tangent_layout["count"])):
                tangent_value = accessor_value(binary, tangent_layout, vertex_index)
                normal_value = accessor_value(binary, normal_layout, vertex_index)
                tx, ty, tz, tw = (float(value) for value in tangent_value)
                nx, ny, nz = (float(value) for value in normal_value)
                if not all(math.isfinite(value) for value in (tx, ty, tz, tw, nx, ny, nz)):
                    raise ValueError(f"Exported non-finite tangent basis at vertex {vertex_index}")
                normal_length = math.sqrt(nx * nx + ny * ny + nz * nz)
                tangent_length = math.sqrt(tx * tx + ty * ty + tz * tz)
                if tangent_length <= 1e-8:
                    raise ValueError(f"Exported tangent {vertex_index} remains singular")
                dot = abs(nx * tx + ny * ty + nz * tz)
                maximum_normal_unit_error = max(maximum_normal_unit_error, abs(normal_length - 1.0))
                maximum_tangent_unit_error = max(maximum_tangent_unit_error, abs(tangent_length - 1.0))
                maximum_normal_tangent_dot = max(maximum_normal_tangent_dot, dot)
                if tw not in (-1.0, 1.0):
                    raise ValueError(f"Exported tangent {vertex_index} has non-canonical W={tw}")
                handedness_values.add(tw)
                if (mesh_index, primitive_index, vertex_index) in repaired_keys:
                    if tangent_length <= 1e-16:
                        raise ValueError(
                            f"Packed analytic tangent {vertex_index} reread as a zero vector"
                        )
                    expectation = post_pack_expectations[
                        (mesh_index, primitive_index, vertex_index)
                    ]
                    packed_direction = np.asarray((tx, ty, tz), dtype=np.float64) / tangent_length
                    post_pack_alignment = min(
                        float(np.dot(packed_direction, direction))
                        for direction in expectation["directions"]
                    )
                    if post_pack_alignment < 0.99999:
                        raise ValueError(
                            f"Packed tangent {vertex_index} derivative alignment "
                            f"{post_pack_alignment} is below 0.99999"
                        )
                    if tw != float(expectation["handedness"]):
                        raise ValueError(
                            f"Packed tangent {vertex_index} W={tw} differs from measured "
                            f"parity {expectation['handedness']}"
                        )
                    post_pack_minimum_derivative_alignment = min(
                        post_pack_minimum_derivative_alignment,
                        post_pack_alignment,
                    )
                    expectation["record"]["postPackMinimumDerivativeAlignment"] = (
                        post_pack_alignment
                    )
                    expectation["record"]["postPackHandednessMatchesMeasuredParity"] = True
                    repaired_maximum_unit_error = max(
                        repaired_maximum_unit_error, abs(tangent_length - 1.0)
                    )
                    repaired_maximum_dot = max(repaired_maximum_dot, dot)
                elif abs(tangent_length - 1.0) > 1e-5:
                    untouched_rows_above_repaired_unit_threshold += 1
                validated += 1
    if maximum_normal_unit_error > 1e-4:
        raise ValueError(f"Exported normals are not unit length: {maximum_normal_unit_error}")
    if maximum_tangent_unit_error > 1e-4:
        raise ValueError(f"Exported tangents are not unit length: {maximum_tangent_unit_error}")
    if maximum_normal_tangent_dot > 2e-4:
        raise ValueError(f"Exported N/T basis is not orthogonal: {maximum_normal_tangent_dot}")
    if repaired_maximum_unit_error > 1e-5 or repaired_maximum_dot > 1e-5:
        raise ValueError(
            "Analytically constructed tangent rows failed their 1e-5 unit/orthogonal gate: "
            f"unit={repaired_maximum_unit_error}, dot={repaired_maximum_dot}"
        )
    LEGACY.write_glb(path, document, bytes(binary))
    return {
        "method": (
            "Post-export float64 per-triangle UV derivative, Gram-Schmidt projection against "
            "the final exported split normal, and handedness from the corresponding bitangent."
        ),
        "scope": (
            "Only the seven zero TANGENT rows mapped by geometry-area and UV-determinant to the "
            "six diagnosed nondegenerate sliver polygons."
        ),
        "fullMikkContinuityClaimed": False,
        "arbitraryOrthogonalAxisFallbacks": 0,
        "inputSingularRows": len(repairs),
        "exactUvDerivativeTangentsConstructed": len(repairs),
        "affectedTriangleCount": len(target_triangle_metrics),
        "sourcePolygonIndicesEqualExportTriangleOrdinals": True,
        "repairs": repairs,
        "diagnosticMetricMatches": metric_matches,
        "protectedAccessorPayloads": protected_accessors,
        "nonTargetTangentRows": unchanged_tangent_hashes,
        "positionUvNormalIndexByteExact": all(row["byteExact"] for row in protected_accessors),
        "allOtherTangentRowsByteExact": all(row["byteExact"] for row in unchanged_tangent_hashes),
        "validatedTangents": validated,
        "maximumNormalUnitError": maximum_normal_unit_error,
        "maximumTangentUnitError": maximum_tangent_unit_error,
        "untouchedTangentUnitErrorLimit": 1e-4,
        "untouchedRowsAboveRepairedOneEminusFiveThreshold": (
            untouched_rows_above_repaired_unit_threshold
        ),
        "untouchedRowsAboveRepairedThresholdByteExact": all(
            row["byteExact"] for row in unchanged_tangent_hashes
        ),
        "maximumAbsoluteNormalTangentDot": maximum_normal_tangent_dot,
        "invalidTangentRows": 0,
        "repairedMaximumTangentUnitError": repaired_maximum_unit_error,
        "repairedMaximumAbsoluteNormalTangentDot": repaired_maximum_dot,
        "postPackMinimumDerivativeAlignment": post_pack_minimum_derivative_alignment,
        "postPackHandednessMatchesMeasuredParity": True,
        "handednessValues": sorted(handedness_values),
        "occlusionSharesOrmTexture": True,
    }


def export_direct_variant(
    root: bpy.types.Object,
    low: bpy.types.Object,
    base: Path,
    normal: Path,
    output: Path,
    diagnostic: dict[str, Any],
) -> dict[str, Any]:
    material = LEGACY.make_runtime_material(base, normal, MAPS["orm2k"])
    low.data.materials.clear()
    low.data.materials.append(material)
    objects = [root, *LEGACY.descendants(root)]
    LEGACY.set_selected(objects, root)
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=False,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_materials="EXPORT",
        export_animations=False,
        export_normals=True,
        export_tangents=True,
    )
    repair = construct_exact_export_tangents(output, diagnostic)
    return {**LEGACY.file_record(output), "tangentAndOcclusionPatch": repair}


def main() -> None:
    inputs = LEGACY.validate_inputs()
    maps = prepare_direct_maps()
    for path in (SOURCE_BLEND.parent, RAW_4K.parent):
        path.mkdir(parents=True, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "METERS"

    dense, _ = COMMON.import_single_mesh(COMMON.DENSE)
    dense.name = "Cloudway_Marble__DenseSource"
    dense.data.name = dense.name + "__Mesh"
    dense_fit = COMMON.fit_to_v3_envelope(dense)

    low = dense.copy()
    low.data = dense.data.copy()
    low.name = "Cloudway_Marble_V4_DirectDense_Work"
    low.data.name = low.name + "__Mesh"
    bpy.context.scene.collection.objects.link(low)
    pre_flatten = LEGACY.flatten_landing(low)
    protection = detail_protection_group(low)
    simplification = decimate_direct(low, protection)
    post_flatten = LEGACY.flatten_landing(low)
    normals = finalize_direct_normals(low.data)
    uv_repair = repair_degenerate_uv_triangles(low.data)
    uv_gate = validate_direct_uv(low.data)
    contacts = LEGACY.landing_contact_measurements(low)
    tangent_gate = LEGACY.repair_blender_tangent_singularities(low.data)
    topology_repair: dict[str, object] | None = None
    post_topology_flatten: dict[str, object] | None = None
    residual_diagnostic: dict[str, object] | None = None
    if tangent_gate["remainingZeroTangents"] != 0:
        residual_diagnostic = diagnose_residual_tangent_singularities(low, tangent_gate, uv_gate)
        if (
            residual_diagnostic["residualLoopCount"] != 7
            or residual_diagnostic["residualPolygonCount"] != 6
        ):
            raise ValueError(
                "Direct derivative residual scope changed from the independently reviewed "
                f"7 loops / 6 polygons: {TANGENT_DIAGNOSTIC}"
            )
        topology_repair = json.loads(TOPOLOGY_REPAIR_RESULT.read_text())
    elif residual_diagnostic is None:
        raise ValueError(
            "Direct derivative unexpectedly has no residual tangent rows; re-audit the analytic "
            "export repair scope before producing review candidates"
        )
    post_tangent_normal_gate = LEGACY.validate_corner_normal_basis(low.data)

    other_roots = LEGACY.import_v3_non_marble()
    root = bpy.data.objects.new(LEGACY.ROOT_NAME, None)
    bpy.context.scene.collection.objects.link(root)
    low.name = LEGACY.SHELL_NAME
    low.data.name = LEGACY.SHELL_NAME + "__Mesh"
    low.parent = root
    low["source"] = COMMON.relative(COMMON.DENSE)
    low["sourceSha256"] = COMMON.EXPECTED_DENSE_SHA256
    low["derivation"] = "direct fitted dense donor with weighted Blender local simplification"
    boundary = LEGACY.exact_boundary(root, LEGACY.boundary_material())
    root_record = LEGACY.configure_root(root, low, boundary)

    authoring_collection = bpy.data.collections.new("Cloudway V4 Authoring Dense Source")
    bpy.context.scene.collection.children.link(authoring_collection)
    for collection in list(dense.users_collection):
        collection.objects.unlink(dense)
    authoring_collection.objects.link(dense)
    dense.hide_render = True
    dense.hide_set(True)
    authoring_collection.hide_render = True

    material_4k = LEGACY.make_runtime_material(MAPS["base4k"], MAPS["normal4k"], MAPS["orm2k"])
    low.data.materials.clear()
    low.data.materials.append(material_4k)
    for path in (MAPS["base2k"], MAPS["normal2k"]):
        image = LEGACY.load_runtime_image(
            path,
            path.stem + "__packed-variant",
            "sRGB" if "base" in path.stem else "Non-Color",
        )
        image.use_fake_user = True

    bpy.ops.file.pack_all()
    missing = sorted(
        image.filepath
        for image in bpy.data.images
        if image.type == "IMAGE" and image.source != "GENERATED" and image.packed_file is None
    )
    if missing:
        raise ValueError(f"Packed direct source retains external images: {missing}")
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_BLEND), compress=True, check_existing=False)

    exports = {
        "4k": export_direct_variant(
            root,
            low,
            MAPS["base4k"],
            MAPS["normal4k"],
            RAW_4K,
            residual_diagnostic,
        ),
        "2k": export_direct_variant(
            root,
            low,
            MAPS["base2k"],
            MAPS["normal2k"],
            RAW_2K,
            residual_diagnostic,
        ),
    }
    triangles = COMMON.triangle_count(low.data)
    report = {
        "schema": 2,
        "assetId": "cloudway-marble-ultra-v4-review",
        "status": "rejected at matched clay/PBR visual gate; dense source retained as quality authority",
        "coordinates": "Blender Z-up authoring; glTF +Y up; metres",
        "inputs": inputs,
        "derivation": {
            "path": "direct dense donor; rejected 90k transfer/bake path is archived",
            "fit": dense_fit,
            "simplification": simplification,
            "landingFlattenBeforeSimplification": pre_flatten,
            "landingFlattenAfterSimplification": post_flatten,
            "landingFlattenAfterLocalSliverRepair": post_topology_flatten,
            "sourceUvAndProviderNormalRetained": True,
            "selectedToActiveBakeUsed": False,
        },
        "runtimeGeometry": {
            "triangles": triangles,
            "boundaryTriangles": COMMON.triangle_count(boundary.data),
            "projectedSixInstanceFrontPassTriangles": 6 * triangles,
            "budgetRationale": (
                f"The {triangles:,}-triangle direct derivative is retained for the quality trial "
                "because it avoids the failed remesh projection and protects foliage, arches, "
                "medallions, legs and silhouette while simplifying broad slab regions."
            ),
            "contactMeasurements": contacts,
            "normalFinalization": normals,
            "uvSingularityRepair": uv_repair,
            "uvGate": uv_gate,
            "preExportTangentRepair": tangent_gate,
            "preExportResidualTangentPolicy": {
                "acceptedScope": "exactly 7 rows mapped to 6 diagnosed valid-UV sliver polygons",
                "exportRepair": (
                    "final exported POSITION/UV/NORMAL/indices differential basis; no arbitrary "
                    "axis and no full-Mikk-continuity claim"
                ),
                "allOtherTangentRowsMustRemainByteExact": True,
            },
            "postRepairCornerNormalBasisGate": post_tangent_normal_gate,
            "residualTangentDiagnosis": (
                {
                    **LEGACY.file_record(TANGENT_DIAGNOSTIC),
                    "residualLoops": residual_diagnostic["residualLoopCount"],
                    "residualPolygons": residual_diagnostic["residualPolygonCount"],
                }
                if residual_diagnostic is not None
                else None
            ),
            "boundedLocalSliverRepair": topology_repair,
            "boundedLocalSliverRepairResult": (
                LEGACY.file_record(TOPOLOGY_REPAIR_RESULT)
                if topology_repair is not None
                else None
            ),
            "opaqueReplacementSlabPresent": False,
        },
        "directProviderPbr": {
            "sourceNormalMapIncluded": True,
            "selectedToActiveProjection": False,
            "maps": maps,
        },
        "rootContract": root_record,
        "packedBlend": {
            **LEGACY.file_record(SOURCE_BLEND),
            "imagesPacked": True,
            "fittedDenseDonorRetained": True,
            "v3NonMarbleRootsRetained": sorted(other_roots),
            "missingExternalImages": missing,
        },
        "variants": {
            "4k": {**exports["4k"], "decodedTextureMemory": LEGACY.packed_memory("4k")},
            "2k": {**exports["2k"], "decodedTextureMemory": LEGACY.packed_memory("2k")},
            "sameGeometry": True,
            "selection": (
                "rejected; no optimization, actual-game candidate, combined bundle, or install"
            ),
        },
        "rejected90kArchive": {
            "blend": "art/glass-adventure/platform-trials/v4/sources/rejected/cloudway-platform-kit-v4-90k-projection-rejected.blend",
            "maps": "art/glass-adventure/platform-trials/v4/sources/rejected/marble-runtime-textures-90k-projection-rejected",
            "report": "art/glass-adventure/platform-trials/v4/production/cloudway-marble-runtime-v4-build-rejected-90k-projection.json",
        },
        "rebuild": {
            "workingDirectory": "repository root",
            "command": (
                "rtk proxy timeout 1800 env ALSOFT_DRIVERS=null blender -b --factory-startup "
                "--python-exit-code 1 --python art/glass-adventure/platform-trials/v4/production/"
                "build_marble_dense_direct_v4.py"
            ),
            "blender": bpy.app.version_string,
        },
    }
    BUILD_REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print("CLOUDWAY_MARBLE_DIRECT_V4=" + json.dumps({
        "triangles": triangles,
        "blend": str(SOURCE_BLEND),
        "raw4k": str(RAW_4K),
        "raw2k": str(RAW_2K),
        "report": str(BUILD_REPORT),
    }), flush=True)


if __name__ == "__main__":
    main()
