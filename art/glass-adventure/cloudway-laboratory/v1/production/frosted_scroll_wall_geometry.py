#!/usr/bin/env python3
"""Author the Frosted Scroll Wall pane outline and closed fracture volumes."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from math import cos, pi, sin

import bpy
from mathutils import Vector


Point2 = tuple[float, float]
Point3 = tuple[float, float, float]
EtchingPath = tuple[tuple[Point3, ...], bool]

PANE_WIDTH = 1.72
PANE_SHOULDER_HEIGHT = 2.44
PANE_ARCH_RISE = 0.25
PANE_HEIGHT = PANE_SHOULDER_HEIGHT + PANE_ARCH_RISE
PANE_DEPTH = 0.055
PANE_HALF_DEPTH = PANE_DEPTH * 0.5
PANE_ARCH_SEGMENTS = 24
SHARD_BEVEL = 0.004
ETCHING_DEPTH_Y = -0.017
INNER_TRIM_RADIUS = 0.009
INNER_BACKING_FRONT_Y = -0.2457
INNER_BACKING_BACK_Y = 0.2457
VERTICAL_EXTENSION = 0.32


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def signed_area(polygon: Sequence[Point2]) -> float:
    return 0.5 * sum(
        first[0] * second[1] - second[0] * first[1]
        for first, second in zip(polygon, (*polygon[1:], polygon[0]))
    )


def polygon_centroid(polygon: Sequence[Point2]) -> Point2:
    area = signed_area(polygon)
    require(abs(area) > 1e-10, "Cannot find the centroid of a collapsed polygon")
    factor = 1.0 / (6.0 * area)
    x = 0.0
    z = 0.0
    for first, second in zip(polygon, (*polygon[1:], polygon[0])):
        cross = first[0] * second[1] - second[0] * first[1]
        x += (first[0] + second[0]) * cross
        z += (first[1] + second[1]) * cross
    return x * factor, z * factor


def pane_outline() -> list[Point2]:
    """Return the centred convex aperture, counter-clockwise from its floor."""
    half_width = PANE_WIDTH * 0.5
    result: list[Point2] = [(-half_width, 0.0), (half_width, 0.0)]
    result.append((half_width, PANE_SHOULDER_HEIGHT))
    for index in range(1, PANE_ARCH_SEGMENTS + 1):
        angle = pi * index / PANE_ARCH_SEGMENTS
        result.append(
            (
                half_width * cos(angle),
                PANE_SHOULDER_HEIGHT + PANE_ARCH_RISE * sin(angle),
            )
        )
    require(signed_area(result) > 0.0, "Pane outline winding changed")
    return result


def outline_half_width(z: float) -> float:
    if z < 0.0 or z > PANE_HEIGHT:
        return -1.0
    half_width = PANE_WIDTH * 0.5
    if z <= PANE_SHOULDER_HEIGHT:
        return half_width
    normalized = (z - PANE_SHOULDER_HEIGHT) / PANE_ARCH_RISE
    return half_width * max(0.0, 1.0 - normalized * normalized) ** 0.5


def contains_outline(x: float, z: float, margin: float = 0.0) -> bool:
    """Test a front-projected point against the pane aperture."""
    if z < -margin or z > PANE_HEIGHT + margin:
        return False
    if z <= PANE_SHOULDER_HEIGHT:
        return abs(x) <= PANE_WIDTH * 0.5 + margin
    if PANE_ARCH_RISE <= 0.0:
        return False
    normalized = (z - PANE_SHOULDER_HEIGHT) / PANE_ARCH_RISE
    if normalized > 1.0 + margin / PANE_ARCH_RISE:
        return False
    half_width = PANE_WIDTH * 0.5 * max(0.0, 1.0 - min(1.0, normalized) ** 2) ** 0.5
    return abs(x) <= half_width + margin


def clip_polygon(
    polygon: Sequence[Point2], normal_x: float, normal_z: float, limit: float
) -> list[Point2]:
    if not polygon:
        return []
    result: list[Point2] = []
    previous = polygon[-1]
    previous_value = normal_x * previous[0] + normal_z * previous[1] - limit
    for current in polygon:
        current_value = normal_x * current[0] + normal_z * current[1] - limit
        previous_inside = previous_value <= 1e-10
        current_inside = current_value <= 1e-10
        if previous_inside != current_inside:
            denominator = previous_value - current_value
            amount = previous_value / denominator if abs(denominator) > 1e-15 else 0.0
            result.append(
                (
                    previous[0] + (current[0] - previous[0]) * amount,
                    previous[1] + (current[1] - previous[1]) * amount,
                )
            )
        if current_inside:
            result.append(current)
        previous = current
        previous_value = current_value
    return result


def shard_seeds() -> tuple[Point2, ...]:
    """Return a fixed irregular thirty-piece layout inside the arched pane."""
    legacy = (
        (-0.70, 0.17),
        (-0.38, 0.11),
        (-0.03, 0.20),
        (0.38, 0.12),
        (0.72, 0.22),
        (-0.77, 0.54),
        (-0.45, 0.62),
        (-0.08, 0.50),
        (0.31, 0.60),
        (0.70, 0.53),
        (-0.64, 0.95),
        (-0.43, 0.87),
        (-0.24, 1.03),
        (0.16, 0.91),
        (0.41, 0.90),
        (0.58, 1.00),
        (-0.75, 1.38),
        (-0.42, 1.29),
        (-0.01, 1.43),
        (0.40, 1.31),
        (0.72, 1.44),
        (-0.61, 1.72),
        (-0.19, 1.82),
        (0.21, 1.69),
        (0.60, 1.80),
        (-0.69, 2.05),
        (-0.31, 2.10),
        (0.10, 2.00),
        (0.55, 2.08),
        (-0.38, 2.27),
        (0.00, 2.31),
        (0.38, 2.27),
    )
    return tuple((x, z + VERTICAL_EXTENSION) for x, z in legacy)


def voronoi_cells() -> list[list[Point2]]:
    outline = pane_outline()
    seeds = shard_seeds()
    for seed in seeds:
        require(contains_outline(*seed), f"Shard seed {seed} is outside the pane")
    cells: list[list[Point2]] = []
    for seed in seeds:
        polygon = list(outline)
        for other in seeds:
            if other == seed:
                continue
            normal_x = other[0] - seed[0]
            normal_z = other[1] - seed[1]
            limit = (
                other[0] * other[0]
                + other[1] * other[1]
                - seed[0] * seed[0]
                - seed[1] * seed[1]
            ) * 0.5
            polygon = clip_polygon(polygon, normal_x, normal_z, limit)
        require(len(polygon) >= 3, f"Shard cell at {seed} collapsed")
        if signed_area(polygon) < 0.0:
            polygon.reverse()
        cells.append(polygon)
    return cells


@dataclass(frozen=True)
class PrismResult:
    mesh: bpy.types.Mesh
    origin: Vector
    footprint_area: float


def prism_mesh(
    name: str,
    polygon: Sequence[Point2],
    *,
    origin_at_centroid: bool,
) -> PrismResult:
    points = list(polygon)
    if signed_area(points) < 0.0:
        points.reverse()
    centre_x, centre_z = polygon_centroid(points) if origin_at_centroid else (0.0, 0.0)
    origin = Vector((centre_x, 0.0, centre_z))
    local = [(x - centre_x, z - centre_z) for x, z in points]
    count = len(local)
    vertices: list[Point3] = [
        (x, -PANE_HALF_DEPTH, z) for x, z in local
    ] + [(x, PANE_HALF_DEPTH, z) for x, z in local]
    faces: list[list[int]] = [
        list(range(count)),
        list(reversed(range(count, count * 2))),
    ]
    material_indices = [0, 0]
    for index in range(count):
        following = (index + 1) % count
        faces.append([index, index + count, following + count, following])
        material_indices.append(1)
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    require(not mesh.validate(verbose=False), f"{name} failed mesh validation")
    for polygon_index, material_index in enumerate(material_indices):
        mesh.polygons[polygon_index].material_index = material_index
    return PrismResult(mesh=mesh, origin=origin, footprint_area=abs(signed_area(points)))


def create_prism_object(
    name: str,
    polygon: Sequence[Point2],
    collection: bpy.types.Collection,
    materials: Sequence[bpy.types.Material],
    *,
    origin_at_centroid: bool,
    bevel: float = 0.0,
) -> tuple[bpy.types.Object, PrismResult]:
    result = prism_mesh(name + "Geometry", polygon, origin_at_centroid=origin_at_centroid)
    obj = bpy.data.objects.new(name, result.mesh)
    collection.objects.link(obj)
    obj.location = result.origin
    assign_pane_uv(obj)
    for material in materials:
        result.mesh.materials.append(material)
    if bevel > 0.0:
        modifier = obj.modifiers.new("Closed shard edge bevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
        modifier.limit_method = "ANGLE"
        modifier.material = 1
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.select_set(False)
        obj.data.update()
        require(not obj.data.validate(verbose=False), f"{name} bevel produced invalid geometry")
    return obj, result


def assign_pane_uv(obj: bpy.types.Object) -> None:
    """Project every pane piece into one stable, shared X/Z texture space."""
    mesh = obj.data
    uv_layer = mesh.uv_layers.new(name="frost_wall_pane_uv")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            vertex = mesh.vertices[mesh.loops[loop_index].vertex_index]
            pane_x = float(vertex.co.x + obj.location.x)
            pane_z = float(vertex.co.z + obj.location.z)
            uv_layer.data[loop_index].uv = (
                min(1.0, max(0.0, (pane_x + PANE_WIDTH * 0.5) / PANE_WIDTH)),
                min(1.0, max(0.0, pane_z / PANE_HEIGHT)),
            )


def etching_paths() -> tuple[EtchingPath, ...]:
    """Return the shared musical-scroll paths used by relief and surface maps."""
    result: list[EtchingPath] = []
    samples = 72
    for strand in range(9):
        offset = (strand - 4) * 0.015
        points: list[Point3] = []
        for index in range(samples):
            amount = index / (samples - 1)
            z = 0.22 + VERTICAL_EXTENSION + amount * 1.82
            sweep = sin((amount * 1.42 - 0.62) * pi)
            taper = 0.72 + 0.28 * sin(amount * pi)
            x = 0.49 * sweep + offset * taper
            points.append((x, ETCHING_DEPTH_Y, z))
        result.append((tuple(points), False))

    rings = (
        (-0.42, 0.36 + VERTICAL_EXTENSION, 0.075),
        (0.34, 0.93 + VERTICAL_EXTENSION, 0.09),
        (-0.30, 1.55 + VERTICAL_EXTENSION, 0.065),
    )
    for centre_x, centre_z, radius in rings:
        result.append(
            (
                tuple(
                    (
                        centre_x + cos(index * 2.0 * pi / 40.0) * radius,
                        ETCHING_DEPTH_Y,
                        centre_z + sin(index * 2.0 * pi / 40.0) * radius,
                    )
                    for index in range(40)
                ),
                True,
            )
        )

    result.append(
        (
            (
                (-0.52, ETCHING_DEPTH_Y, 0.26 + VERTICAL_EXTENSION),
                (-0.43, ETCHING_DEPTH_Y, 0.36 + VERTICAL_EXTENSION),
                (-0.30, ETCHING_DEPTH_Y, 0.42 + VERTICAL_EXTENSION),
                (-0.18, ETCHING_DEPTH_Y, 0.44 + VERTICAL_EXTENSION),
            ),
            False,
        )
    )

    for strand in range(3):
        points = []
        for index in range(48):
            amount = index / 47.0
            angle = -0.7 * pi + amount * 1.75 * pi
            radius = 0.24 - amount * 0.12 + strand * 0.014
            points.append(
                (
                    -0.18 + cos(angle) * radius,
                    ETCHING_DEPTH_Y,
                    0.68 + VERTICAL_EXTENSION + sin(angle) * radius,
                )
            )
        result.append((tuple(points), False))

    for strand in range(3):
        points = []
        for index in range(48):
            amount = index / 47.0
            angle = 0.25 * pi + amount * 1.7 * pi
            radius = 0.22 - amount * 0.11 + strand * 0.013
            points.append(
                (
                    0.18 + cos(angle) * radius,
                    ETCHING_DEPTH_Y,
                    1.57 + VERTICAL_EXTENSION + sin(angle) * radius,
                )
            )
        result.append((tuple(points), False))
    return tuple(result)


def create_inner_trim_object(
    name: str,
    collection: bpy.types.Collection,
    material: bpy.types.Material,
) -> bpy.types.Object:
    curve = bpy.data.curves.new(name + "Curves", "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 1
    curve.bevel_depth = INNER_TRIM_RADIUS
    curve.bevel_resolution = 2
    outline = pane_outline()
    for depth in (-0.034, 0.034):
        spline = curve.splines.new("POLY")
        spline.points.add(len(outline) - 1)
        for target, (x, z) in zip(spline.points, outline):
            target.co = (x, depth, z, 1.0)
        spline.use_cyclic_u = True
    for side in (-1.0, 1.0):
        for depth in (INNER_BACKING_FRONT_Y, INNER_BACKING_BACK_Y):
            spline = curve.splines.new("POLY")
            spline.points.add(2)
            accent = (
                (side * (PANE_WIDTH * 0.5 + 0.16), depth, 0.0),
                (side * (PANE_WIDTH * 0.5 + 0.08), depth, 0.50),
                (side * PANE_WIDTH * 0.5, depth, 0.50),
            )
            for target, point in zip(spline.points, accent):
                target.co = (*point, 1.0)
    obj = bpy.data.objects.new(name, curve)
    collection.objects.link(obj)
    curve.materials.append(material)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.view_layer.objects.active
    require(obj is not None and obj.type == "MESH", "Inner trim conversion failed")
    obj.name = name
    obj.data.name = name + "Geometry"
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    obj.select_set(False)
    obj["role"] = "persistent-authored-inner-trim"
    return obj


def create_inner_backing_object(
    name: str,
    collection: bpy.types.Collection,
    material: bpy.types.Material,
) -> bpy.types.Object:
    """Line the donor's fused-pane cut seam without entering the aperture."""
    inner = pane_outline()
    vertices: list[Point3] = []
    faces: list[list[int]] = []
    count = len(inner)
    vertices.extend((x, INNER_BACKING_FRONT_Y, z) for x, z in inner)
    vertices.extend((x, INNER_BACKING_BACK_Y, z) for x, z in inner)
    for index in range(1, count):
        following = (index + 1) % count
        faces.append([index, following, count + following, count + index])

    def add_face(points: Sequence[Point3]) -> None:
        base = len(vertices)
        vertices.extend(points)
        faces.append([base, base + 1, base + 2, base + 3])

    def add_lower_seam_patch(side: float) -> None:
        inner_x = side * PANE_WIDTH * 0.5
        outer_x = side * (PANE_WIDTH * 0.5 + 0.20)
        add_face(
            (
                (inner_x, 0.0, 0.0),
                (outer_x, 0.0, 0.0),
                (outer_x, 0.0, 0.48),
                (inner_x, 0.0, 0.48),
            )
        )

        lower_outer_x = side * (PANE_WIDTH * 0.5 + 0.16)
        upper_outer_x = side * (PANE_WIDTH * 0.5 + 0.08)
        for depth in (INNER_BACKING_FRONT_Y, INNER_BACKING_BACK_Y):
            add_face(
                (
                    (inner_x, depth, 0.0),
                    (lower_outer_x, depth, 0.0),
                    (upper_outer_x, depth, 0.50),
                    (inner_x, depth, 0.50),
                )
            )

    add_lower_seam_patch(1.0)
    add_lower_seam_patch(-1.0)
    mesh = bpy.data.meshes.new(name + "Geometry")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    mesh.update()
    require(not mesh.validate(verbose=False), "Inner frame backing failed mesh validation")
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj["role"] = "persistent-authored-inner-backing"
    obj["outsideCertifiedPaneEnvelope"] = True
    return obj
