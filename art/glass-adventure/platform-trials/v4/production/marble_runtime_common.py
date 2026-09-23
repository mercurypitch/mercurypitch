"""Shared geometry and audit helpers for the Cloudway V4 marble runtime build."""

from __future__ import annotations

import hashlib
import math
from pathlib import Path
from typing import Any

import bmesh
import bpy
from mathutils import Matrix, Vector


HERE = Path(__file__).resolve().parent
V4 = HERE.parent
PLATFORM_TRIALS = V4.parent
V3 = PLATFORM_TRIALS / "v3"
REPO = HERE.parents[4]

DENSE = V4 / "meshy" / "marble-ultra4k" / "dense-donor.glb"
REMESH = V4 / "meshy" / "marble-ultra4k" / "runtime-remesh-90k.glb"
REMESH_RECEIPT = V4 / "meshy" / "marble-ultra4k" / "runtime-remesh-90k-receipt.json"
V3_SOURCE = V3 / "exports" / "cloudway-platform-kit-v3.glb"
V3_RUNTIME = V3 / "exports" / "cloudway-platform-kit-v3-runtime.glb"

EXPECTED_DENSE_SHA256 = "fa4d01900561e257be18c7190ef893aa789f178d1d4ccd13c2da22427d1033bb"
EXPECTED_REMESH_SHA256 = "fcb61f6e902ebea8ab3d10ac128c0ebc4bfa08a1342dced32b5753bb30d82906"
EXPECTED_REMESH_TRIANGLES = 89_984

# Exact V3 marble visual envelope after fresh Blender import. The contact plane
# remains Z=0 in Blender and Y=0 in glTF.
TARGET_MIN = Vector((-0.899768, -0.700478, -0.425646))
TARGET_MAX = Vector((0.901900, 0.699575, 0.146525))
LANDING_WIDTH = 1.70
LANDING_DEPTH = 1.30
COLLIDER_HEIGHT = 0.24


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def relative(path: Path) -> str:
    return str(path.relative_to(REPO))


def descendants(root: bpy.types.Object) -> list[bpy.types.Object]:
    result: list[bpy.types.Object] = []
    pending = list(root.children)
    while pending:
        obj = pending.pop()
        result.append(obj)
        pending.extend(obj.children)
    return result


def object_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points = [
        obj.matrix_world @ vertex.co
        for obj in objects
        if obj.type == "MESH"
        for vertex in obj.data.vertices
    ]
    if not points:
        raise ValueError("Cannot measure an empty mesh set")
    return (
        Vector(min(point[axis] for point in points) for axis in range(3)),
        Vector(max(point[axis] for point in points) for axis in range(3)),
    )


def vector(value: Vector) -> list[float]:
    return [round(float(component), 6) for component in value]


def triangle_count(mesh: bpy.types.Mesh) -> int:
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)


def import_single_mesh(path: Path) -> tuple[bpy.types.Object, list[bpy.types.Object]]:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    meshes = [obj for obj in imported if obj.type == "MESH"]
    if len(meshes) != 1:
        raise ValueError(f"Expected one mesh in {relative(path)}, found {len(meshes)}")
    obj = meshes[0]
    obj.data = obj.data.copy()
    obj.data.transform(obj.matrix_world)
    obj.matrix_world = Matrix.Identity(4)
    obj.parent = None
    for other in imported:
        if other is not obj:
            bpy.data.objects.remove(other, do_unlink=True)
    obj.data.update()
    return obj, imported


def dominant_landing_height(obj: bpy.types.Object) -> float:
    low, high = object_bounds([obj])
    size = high - low
    bin_size = max(size.z / 192.0, 1e-6)
    area_by_bin: dict[int, float] = {}
    for polygon in obj.data.polygons:
        center = polygon.center
        if polygon.normal.z < 0.86:
            continue
        if not (low.x + size.x * 0.10 <= center.x <= high.x - size.x * 0.10):
            continue
        if not (low.y + size.y * 0.10 <= center.y <= high.y - size.y * 0.10):
            continue
        if center.z < low.z + size.z * 0.42:
            continue
        key = round((center.z - low.z) / bin_size)
        area_by_bin[key] = area_by_bin.get(key, 0.0) + float(polygon.area)
    if not area_by_bin:
        raise ValueError(f"No broad landing plane found for {obj.name}")
    winner = max(area_by_bin, key=area_by_bin.get)
    return float(low.z + winner * bin_size)


def _depth_side_parameters(source_half: float, target_half: float, edge_scale: float) -> tuple[float, float]:
    if source_half <= 0 or target_half <= 0:
        raise ValueError("Depth fit received a degenerate half-extent")
    cubic = (edge_scale * source_half / target_half - 1.0) * 0.5
    linear = 1.0 - cubic
    if linear + 3.0 * cubic <= 0:
        raise ValueError("Depth fit would fold at the protected outer edge")
    return linear, cubic


def fit_to_v3_envelope(obj: bpy.types.Object) -> dict[str, Any]:
    """Fit to V3 while preserving edge-band scale and the contact datum.

    X maps linearly. Depth uses an odd cubic on each half: the front/back edge
    derivative equals the uniform width scale, so corner caps, arches and edge
    foliage keep their local silhouette scale; the additional depth is absorbed
    progressively across the broad central landing. Height maps independently
    above and below the sampled landing so Z=0 and the exact V3 visual envelope
    remain unchanged.
    """

    mesh = obj.data
    low, high = object_bounds([obj])
    landing = dominant_landing_height(obj)
    source_dimensions = high - low
    target_dimensions = TARGET_MAX - TARGET_MIN
    source_center_y = (low.y + high.y) * 0.5
    target_center_y = (TARGET_MIN.y + TARGET_MAX.y) * 0.5
    x_scale = target_dimensions.x / source_dimensions.x
    negative_source_half = source_center_y - low.y
    positive_source_half = high.y - source_center_y
    negative_target_half = target_center_y - TARGET_MIN.y
    positive_target_half = TARGET_MAX.y - target_center_y
    negative_linear, negative_cubic = _depth_side_parameters(
        negative_source_half, negative_target_half, x_scale
    )
    positive_linear, positive_cubic = _depth_side_parameters(
        positive_source_half, positive_target_half, x_scale
    )
    below_scale = -TARGET_MIN.z / (landing - low.z)
    above_scale = TARGET_MAX.z / (high.z - landing)

    source_corner_normals = [corner.vector.copy() for corner in mesh.corner_normals]
    source_positions = [vertex.co.copy() for vertex in mesh.vertices]

    def mapped_y_and_derivative(value: float) -> tuple[float, float]:
        delta = value - source_center_y
        if delta < 0:
            side = -1.0
            source_half = negative_source_half
            target_half = negative_target_half
            linear, cubic = negative_linear, negative_cubic
        else:
            side = 1.0
            source_half = positive_source_half
            target_half = positive_target_half
            linear, cubic = positive_linear, positive_cubic
        unit = min(1.0, abs(delta) / source_half)
        curve = linear * unit + cubic * unit**3
        derivative = target_half / source_half * (linear + 3.0 * cubic * unit**2)
        return target_center_y + side * target_half * curve, derivative

    for vertex, source in zip(mesh.vertices, source_positions, strict=True):
        vertex.co.x = TARGET_MIN.x + (source.x - low.x) * x_scale
        vertex.co.y = mapped_y_and_derivative(source.y)[0]
        if source.z <= landing:
            vertex.co.z = (source.z - landing) * below_scale
        else:
            vertex.co.z = (source.z - landing) * above_scale

    transformed_normals: list[Vector] = []
    for loop, normal in zip(mesh.loops, source_corner_normals, strict=True):
        source = source_positions[loop.vertex_index]
        depth_derivative = mapped_y_and_derivative(source.y)[1]
        height_derivative = below_scale if source.z <= landing else above_scale
        transformed = Vector(
            (
                normal.x / x_scale,
                normal.y / depth_derivative,
                normal.z / height_derivative,
            )
        )
        if transformed.length_squared <= 1e-16:
            raise ValueError("Envelope fit collapsed a corner normal")
        transformed.normalize()
        transformed_normals.append(transformed)
    mesh.normals_split_custom_set(transformed_normals)
    mesh.update()

    fitted_low, fitted_high = object_bounds([obj])
    if max(abs(fitted_low[i] - TARGET_MIN[i]) for i in range(3)) > 2e-6:
        raise ValueError(f"Fitted minimum drifted: {fitted_low}")
    if max(abs(fitted_high[i] - TARGET_MAX[i]) for i in range(3)) > 2e-6:
        raise ValueError(f"Fitted maximum drifted: {fitted_high}")
    return {
        "method": (
            "linear width fit; edge-protected cubic depth fit with front/back local scale "
            "equal to the width scale; piecewise vertical fit around the sampled landing datum"
        ),
        "sourceBoundsBlenderZUpMetres": {"min": vector(low), "max": vector(high)},
        "sourceDimensionsBlenderZUpMetres": vector(source_dimensions),
        "sourceLandingBlenderZ": round(landing, 9),
        "targetBoundsBlenderZUpMetres": {"min": vector(fitted_low), "max": vector(fitted_high)},
        "targetDimensionsBlenderZUpMetres": vector(fitted_high - fitted_low),
        "contactPlaneBlenderZ": 0.0,
        "widthScale": round(x_scale, 9),
        "depthFit": {
            "negativeHalf": {
                "linear": round(negative_linear, 9),
                "cubic": round(negative_cubic, 9),
                "edgeDerivative": round(x_scale, 9),
            },
            "positiveHalf": {
                "linear": round(positive_linear, 9),
                "cubic": round(positive_cubic, 9),
                "edgeDerivative": round(x_scale, 9),
            },
        },
        "verticalScale": {
            "belowContact": round(below_scale, 9),
            "aboveContact": round(above_scale, 9),
        },
    }


def topology(mesh: bpy.types.Mesh) -> dict[str, Any]:
    bm = bmesh.new()
    bm.from_mesh(mesh)
    result = {
        "vertices": len(bm.verts),
        "triangles": triangle_count(mesh),
        "boundaryEdges": sum(len(edge.link_faces) == 1 for edge in bm.edges),
        "nonManifoldEdges": sum(len(edge.link_faces) != 2 for edge in bm.edges),
        "looseEdges": sum(not edge.link_faces for edge in bm.edges),
        "zeroAreaFaces": sum(face.calc_area() <= 1e-12 for face in bm.faces),
    }
    bm.free()
    uv = mesh.uv_layers.active
    if uv is None:
        result["uv0"] = None
        result["uvFinite"] = False
        result["tangentCoverage"] = False
        return result
    uv_values = [item.uv for item in uv.data]
    result["uv0"] = uv.name
    result["uvCorners"] = len(uv_values)
    result["uvFinite"] = all(math.isfinite(value) for uv_value in uv_values for value in uv_value)
    result["uvRange"] = {
        "min": [min(value.x for value in uv_values), min(value.y for value in uv_values)],
        "max": [max(value.x for value in uv_values), max(value.y for value in uv_values)],
    }
    mesh.calc_tangents(uvmap=uv.name)
    tangent_lengths = [loop.tangent.length for loop in mesh.loops]
    valid_tangents = [
        math.isfinite(length) and abs(length - 1.0) <= 1e-4 for length in tangent_lengths
    ]
    result["tangentCoverage"] = all(valid_tangents)
    result["validTangentCorners"] = sum(valid_tangents)
    result["invalidTangentCorners"] = len(valid_tangents) - sum(valid_tangents)
    result["minimumTangentLength"] = min(tangent_lengths)
    result["maximumTangentUnitError"] = max(abs(length - 1.0) for length in tangent_lengths)
    mesh.free_tangents()
    return result
