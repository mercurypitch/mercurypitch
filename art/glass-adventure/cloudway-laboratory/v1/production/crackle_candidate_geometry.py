#!/usr/bin/env python3
"""Build closed crackle-platform shells, ornament, and deterministic shards."""

from __future__ import annotations

from dataclasses import dataclass
from math import cos, pi, sin
from typing import Iterable, Sequence

import bpy
from mathutils import Matrix, Vector


Point2 = tuple[float, float]
Point3 = tuple[float, float, float]
Segment = tuple[Point3, Point3, float]


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


@dataclass
class MeshBuilder:
    vertices: list[Point3]
    faces: list[list[int]]

    @classmethod
    def empty(cls) -> "MeshBuilder":
        return cls([], [])

    def add_prism(self, polygon: Sequence[Point2], bottom: float, top: float) -> None:
        require(len(polygon) >= 3, "A prism needs at least three footprint points")
        offset = len(self.vertices)
        count = len(polygon)
        self.vertices.extend((x, y, bottom) for x, y in polygon)
        self.vertices.extend((x, y, top) for x, y in polygon)
        self.faces.append([offset + index for index in reversed(range(count))])
        self.faces.append([offset + count + index for index in range(count)])
        for index in range(count):
            following = (index + 1) % count
            self.faces.append(
                [
                    offset + index,
                    offset + following,
                    offset + count + following,
                    offset + count + index,
                ]
            )

    def add_tube(self, start: Point3, end: Point3, radius: float, sides: int = 8) -> None:
        require(radius > 0.0 and sides >= 6, "Tube dimensions must be positive")
        a = Vector(start)
        b = Vector(end)
        axis = b - a
        require(axis.length > 1e-6, "Tube endpoints must differ")
        direction = axis.normalized()
        reference = Vector((0.0, 0.0, 1.0))
        if abs(direction.dot(reference)) > 0.92:
            reference = Vector((0.0, 1.0, 0.0))
        basis_u = direction.cross(reference).normalized()
        basis_v = direction.cross(basis_u).normalized()
        offset = len(self.vertices)
        for centre in (a, b):
            for index in range(sides):
                angle = 2.0 * pi * index / sides
                point = centre + radius * (cos(angle) * basis_u + sin(angle) * basis_v)
                self.vertices.append(tuple(point))
        self.faces.append([offset + index for index in reversed(range(sides))])
        self.faces.append([offset + sides + index for index in range(sides)])
        for index in range(sides):
            following = (index + 1) % sides
            self.faces.append(
                [
                    offset + index,
                    offset + following,
                    offset + sides + following,
                    offset + sides + index,
                ]
            )

    def add_star(
        self,
        centre: Point3,
        outer_radius: float,
        inner_radius: float,
        bottom: float,
        top: float,
        points: int = 8,
    ) -> None:
        polygon = []
        cx, cy, _cz = centre
        for index in range(points * 2):
            angle = pi * index / points + pi / 8.0
            radius = outer_radius if index % 2 == 0 else inner_radius
            polygon.append((cx + cos(angle) * radius, cy + sin(angle) * radius))
        self.add_prism(polygon, bottom, top)

    def add_ellipsoid(
        self,
        centre: Point3,
        radii: Point3,
        rotation: Matrix | None = None,
        rings: int = 7,
        segments: int = 14,
    ) -> None:
        require(rings >= 3 and segments >= 8, "Ellipsoid tessellation is too low")
        transform = rotation or Matrix.Identity(3)
        offset = len(self.vertices)
        cx, cy, cz = centre
        self.vertices.append((cx, cy, cz + radii[2]))
        for ring in range(1, rings):
            polar = pi * ring / rings
            for segment in range(segments):
                azimuth = 2.0 * pi * segment / segments
                local = Vector(
                    (
                        radii[0] * sin(polar) * cos(azimuth),
                        radii[1] * sin(polar) * sin(azimuth),
                        radii[2] * cos(polar),
                    )
                )
                point = Vector((cx, cy, cz)) + transform @ local
                self.vertices.append(tuple(point))
        bottom_index = len(self.vertices)
        self.vertices.append((cx, cy, cz - radii[2]))
        first_ring = offset + 1
        for segment in range(segments):
            following = (segment + 1) % segments
            self.faces.append([offset, first_ring + segment, first_ring + following])
        for ring in range(rings - 2):
            lower = first_ring + ring * segments
            upper = lower + segments
            for segment in range(segments):
                following = (segment + 1) % segments
                self.faces.append(
                    [
                        lower + segment,
                        upper + segment,
                        upper + following,
                        lower + following,
                    ]
                )
        last_ring = first_ring + (rings - 2) * segments
        for segment in range(segments):
            following = (segment + 1) % segments
            self.faces.append([last_ring + following, last_ring + segment, bottom_index])

    def mesh(self, name: str) -> bpy.types.Mesh:
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.update()
        require(not mesh.validate(verbose=False), f"{name} failed Blender mesh validation")
        return mesh


def object_from_mesh(
    name: str,
    mesh: bpy.types.Mesh,
    collection: bpy.types.Collection,
    parent: bpy.types.Object | None = None,
    material: bpy.types.Material | None = None,
) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.parent = parent
    if material is not None:
        mesh.materials.append(material)
    return obj


def rounded_box(
    name: str,
    dimensions: Point3,
    centre_z: float,
    bevel: float,
    collection: bpy.types.Collection,
    parent: bpy.types.Object,
    material: bpy.types.Material,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, 0.0, centre_z))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    modifier = obj.modifiers.new("Closed crystal edge bevel", "BEVEL")
    modifier.width = bevel
    modifier.segments = 5
    modifier.limit_method = "ANGLE"
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)
    obj.parent = parent
    obj.data.name = f"{name}Geometry"
    obj.data.materials.append(material)
    obj["closed"] = True
    obj["sourceGeometry"] = "authored rounded support shell"
    return obj


def clip_polygon(
    polygon: Sequence[Point2], normal_x: float, normal_y: float, limit: float
) -> list[Point2]:
    if not polygon:
        return []
    result: list[Point2] = []
    previous = polygon[-1]
    previous_value = normal_x * previous[0] + normal_y * previous[1] - limit
    for current in polygon:
        current_value = normal_x * current[0] + normal_y * current[1] - limit
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


def deterministic_rose_seeds() -> tuple[Point2, ...]:
    """Irregular, deliberately non-grid seed layout for the fast fracture."""
    return (
        (-0.690, -0.612),
        (-0.407, -0.664),
        (-0.030, -0.574),
        (0.363, -0.696),
        (0.681, -0.486),
        (-0.711, -0.247),
        (-0.326, -0.249),
        (0.126, -0.302),
        (0.531, -0.144),
        (-0.618, 0.155),
        (-0.181, 0.116),
        (0.246, 0.089),
        (0.680, 0.240),
        (-0.694, 0.568),
        (-0.280, 0.518),
        (0.085, 0.662),
        (0.397, 0.427),
        (0.708, 0.649),
    )


def voronoi_cells(seeds: Sequence[Point2], extent: float) -> list[list[Point2]]:
    half = extent * 0.5
    rectangle: list[Point2] = [(-half, -half), (half, -half), (half, half), (-half, half)]
    cells = []
    for seed in seeds:
        polygon = list(rectangle)
        for other in seeds:
            if other == seed:
                continue
            normal_x = other[0] - seed[0]
            normal_y = other[1] - seed[1]
            limit = (
                other[0] * other[0]
                + other[1] * other[1]
                - seed[0] * seed[0]
                - seed[1] * seed[1]
            ) * 0.5
            polygon = clip_polygon(polygon, normal_x, normal_y, limit)
        require(len(polygon) >= 3, "Voronoi shard cell collapsed")
        cells.append(polygon)
    return cells


def faceted_shard_mesh(
    name: str,
    polygon: Sequence[Point2],
    bottom: float,
    top: float,
    facet_seed: int,
) -> tuple[bpy.types.Mesh, Vector]:
    """Create a closed shard with a triangulated, subtly faceted upper surface."""
    count = len(polygon)
    top_heights = []
    for index in range(count):
        ripple = 0.0022 * sin((facet_seed + 3) * 1.73 + index * 2.11)
        top_heights.append(top + ripple)
    crown_height = top + 0.006 + 0.0015 * cos(facet_seed * 1.91)
    centre = Vector(
        (
            (min(point[0] for point in polygon) + max(point[0] for point in polygon)) * 0.5,
            (min(point[1] for point in polygon) + max(point[1] for point in polygon)) * 0.5,
            (bottom + max([crown_height, *top_heights])) * 0.5,
        )
    )
    local = [(x - centre.x, y - centre.y) for x, y in polygon]
    vertices: list[Point3] = [(x, y, bottom - centre.z) for x, y in local]
    for (x, y), height in zip(local, top_heights):
        vertices.append((x, y, height - centre.z))
    top_centre = len(vertices)
    polygon_centre = (
        sum(point[0] for point in polygon) / count - centre.x,
        sum(point[1] for point in polygon) / count - centre.y,
    )
    vertices.append((polygon_centre[0], polygon_centre[1], crown_height - centre.z))
    faces: list[list[int]] = [[index for index in reversed(range(count))]]
    for index in range(count):
        following = (index + 1) % count
        faces.append([count + index, count + following, top_centre])
        faces.append([index, following, count + following, count + index])
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    require(not mesh.validate(verbose=False), f"{name} failed Blender mesh validation")
    mesh["closed"] = True
    mesh["fractureLanguage"] = "deterministic irregular Voronoi with faceted crown"
    return mesh, centre


def rose_internal_faceted_core() -> bpy.types.Mesh:
    """Create a closed inset crystal core with large, light-catching facets."""
    count = 5
    extent = 0.72
    top_vertices: list[Point3] = []
    for row in range(count):
        y = -extent + (2.0 * extent * row / (count - 1))
        for column in range(count):
            x = -extent + (2.0 * extent * column / (count - 1))
            if 0 < row < count - 1:
                x += 0.045 * sin(row * 1.31 + column * 2.17)
            if 0 < column < count - 1:
                y_offset = 0.038 * cos(row * 2.03 - column * 1.47)
            else:
                y_offset = 0.0
            z = -0.076 + 0.043 * sin(row * 1.71 + column * 2.39)
            if row in (0, count - 1) or column in (0, count - 1):
                z = min(z, -0.046)
            top_vertices.append((x, y + y_offset, z))
    faces: list[list[int]] = []
    for row in range(count - 1):
        for column in range(count - 1):
            a = row * count + column
            b = a + 1
            c = (row + 1) * count + column
            d = c + 1
            if (row + column) % 2 == 0:
                faces.extend(([a, b, d], [a, d, c]))
            else:
                faces.extend(([a, b, c], [b, d, c]))
    boundary = [
        *(column for column in range(count)),
        *(row * count + count - 1 for row in range(1, count)),
        *((count - 1) * count + column for column in reversed(range(count - 1))),
        *(row * count for row in reversed(range(1, count - 1))),
    ]
    vertices = list(top_vertices)
    bottom_offset = len(vertices)
    bottom_z = -0.205
    vertices.extend((top_vertices[index][0], top_vertices[index][1], bottom_z) for index in boundary)
    for index, top_index in enumerate(boundary):
        following = (index + 1) % len(boundary)
        next_top = boundary[following]
        faces.append(
            [
                top_index,
                bottom_offset + index,
                bottom_offset + following,
                next_top,
            ]
        )
    faces.append([bottom_offset + index for index in reversed(range(len(boundary)))])
    mesh = bpy.data.meshes.new("RoseInternalFacetedCoreGeometry")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    require(not mesh.validate(verbose=False), "Rose internal faceted core failed mesh validation")
    colours = mesh.color_attributes.new(
        name="rose_facet_tint", type="FLOAT_COLOR", domain="CORNER"
    )
    palette = (
        (0.94, 0.16, 0.34, 1.0),
        (1.0, 0.44, 0.58, 1.0),
        (0.58, 0.08, 0.31, 1.0),
        (1.0, 0.72, 0.78, 1.0),
        (0.72, 0.20, 0.48, 1.0),
    )
    for polygon in mesh.polygons:
        colour = palette[(polygon.index * 3 + len(polygon.vertices)) % len(palette)]
        if polygon.normal.z < -0.5:
            colour = (0.34, 0.035, 0.15, 1.0)
        for loop_index in polygon.loop_indices:
            colours.data[loop_index].color = colour
    mesh["closed"] = True
    mesh["sourceGeometry"] = "new authored inset jewel-facet volume"
    mesh["collision"] = False
    return mesh


def rose_faceted_glass_shell(extent: float, bottom: float) -> bpy.types.Mesh:
    """Create the closed support crystal with broad, deterministic jewel facets."""
    count = 6
    half = extent * 0.5
    top_vertices: list[Point3] = []
    for row in range(count):
        base_y = -half + extent * row / (count - 1)
        for column in range(count):
            base_x = -half + extent * column / (count - 1)
            x = base_x
            y = base_y
            if 0 < row < count - 1 and 0 < column < count - 1:
                x += 0.038 * sin(row * 1.91 + column * 1.37)
                y += 0.034 * cos(row * 1.43 - column * 2.17)
            z = -0.006 + 0.003 * sin(row * 1.73 + column * 2.31)
            if row in (0, count - 1) or column in (0, count - 1):
                z = min(z, -0.005)
            top_vertices.append((x, y, z))

    faces: list[list[int]] = []
    for row in range(count - 1):
        for column in range(count - 1):
            a = row * count + column
            b = a + 1
            c = (row + 1) * count + column
            d = c + 1
            if (row * 3 + column) % 2 == 0:
                faces.extend(([a, b, d], [a, d, c]))
            else:
                faces.extend(([a, b, c], [b, d, c]))

    boundary = [
        *(column for column in range(count)),
        *(row * count + count - 1 for row in range(1, count)),
        *((count - 1) * count + column for column in reversed(range(count - 1))),
        *(row * count for row in reversed(range(1, count - 1))),
    ]
    vertices = list(top_vertices)
    bottom_offset = len(vertices)
    vertices.extend((top_vertices[index][0], top_vertices[index][1], bottom) for index in boundary)
    for index, top_index in enumerate(boundary):
        following = (index + 1) % len(boundary)
        faces.append(
            [
                top_index,
                bottom_offset + index,
                bottom_offset + following,
                boundary[following],
            ]
        )
    faces.append([bottom_offset + index for index in reversed(range(len(boundary)))])

    mesh = bpy.data.meshes.new("RoseRuntimeCrystalShellGeometry")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    require(not mesh.validate(verbose=False), "Rose faceted shell failed Blender mesh validation")
    mesh["closed"] = True
    mesh["facetLanguage"] = "broad irregular jewel planes; deterministic authored topology"
    return mesh


def rose_framework_geometry() -> tuple[bpy.types.Mesh, bpy.types.Mesh, dict[str, int | str]]:
    """Create only the fixed perimeter and quiet accents around the donor exterior."""
    gold = MeshBuilder.empty()
    ivory = MeshBuilder.empty()
    rail_radius = 0.0018
    outer = 0.848
    top = 0.005
    bottom = -0.238
    corners = (
        (-outer, -outer),
        (outer, -outer),
        (outer, outer),
        (-outer, outer),
    )
    for index, (x, y) in enumerate(corners):
        following_x, following_y = corners[(index + 1) % len(corners)]
        gold.add_tube((x, y, top), (following_x, following_y, top), rail_radius)
        gold.add_tube((x, y, bottom), (following_x, following_y, bottom), rail_radius)
        gold.add_tube((x, y, top), (x, y, bottom), rail_radius * 1.15)
        ivory.add_ellipsoid(
            (x * 0.928, y * 0.928, top + 0.006),
            (0.012, 0.012, 0.008),
            rings=8,
            segments=16,
        )
    return (
        gold.mesh("RoseGoldFrameworkGeometry"),
        ivory.mesh("RoseIvoryInlayGeometry"),
        {
            "persistentPerimeterFaces": len(gold.faces),
            "ivoryDisconnectedClosedParts": len(ivory.faces),
            "intactTopLattice": "provided by exact dense donor and hidden atomically with intact",
        },
    )


def mesh_bounds(mesh: bpy.types.Mesh) -> tuple[Vector, Vector]:
    require(len(mesh.vertices) > 0, f"{mesh.name} has no vertices")
    minimum = Vector((float("inf"), float("inf"), float("inf")))
    maximum = Vector((float("-inf"), float("-inf"), float("-inf")))
    for vertex in mesh.vertices:
        for axis in range(3):
            minimum[axis] = min(minimum[axis], vertex.co[axis])
            maximum[axis] = max(maximum[axis], vertex.co[axis])
    return minimum, maximum


def all_finite(meshes: Iterable[bpy.types.Mesh]) -> bool:
    return all(
        all(value == value and abs(value) != float("inf") for value in vertex.co)
        for mesh in meshes
        for vertex in mesh.vertices
    )
