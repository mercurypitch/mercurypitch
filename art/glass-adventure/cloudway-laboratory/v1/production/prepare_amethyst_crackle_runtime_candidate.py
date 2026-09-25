#!/usr/bin/env python3
"""Build and render the source-preserving Amethyst crackle candidate."""

from __future__ import annotations

import bmesh
import bpy
import importlib.util
import json
from pathlib import Path
import sys
from typing import Any, Iterable, Sequence

from mathutils import Vector


HERE = Path(__file__).resolve().parent


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load {path.name}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


PREPARE = load_module("cloudway_prepare_dense_master", HERE / "prepare_dense_master.py")
GEOMETRY = load_module(
    "cloudway_crackle_candidate_geometry", HERE / "crackle_candidate_geometry.py"
)
VISUALS = load_module(
    "cloudway_amethyst_runtime_visuals", HERE / "amethyst_crackle_runtime_visuals.py"
)


SOURCE = PREPARE.SOURCE
ASSET = "amethyst-crackle-slow"
ROOT_NAME = "CloudwayLab_AmethystCrackleSlow"
PERSISTENT_NAME = f"{ROOT_NAME}__persistent"
INTACT_NAME = f"{ROOT_NAME}__intact"
CONTACT_NAME = f"{ROOT_NAME}__contact"
SHARD_PREFIX = f"{ROOT_NAME}__shard_"
SOURCE_ROOT_NAME = "Cloudway_AmethystCrackleSlow_DenseMaster"
SOURCE_REVIEW_NAME = f"{ASSET}__normalized_review"

# The donor is 1.700 x 1.178 m. The gameplay rectangle stays inside the
# measured broad upper patch; it is deliberately rectangular and unstretched.
CONTACT_WIDTH = 1.64
CONTACT_DEPTH = 1.10
SOURCE_WIDTH = 1.70
SOURCE_DEPTH = 1.178027339
SHELL_WIDTH = CONTACT_WIDTH
SHELL_DEPTH = CONTACT_DEPTH
CONTACT_HEIGHT = 0.25
# Keep the authored glass underlay clear of the exact provider exterior.  A
# coincident top face at the contact datum z-fought the donor's faceted top and
# replaced its pale lavender read with the shell's saturated diagnostic colour.
SHELL_HEIGHT = 0.20
SHELL_TOP = -0.025
# The bevel can extend roughly 7.5 mm beyond the authored cap.  Keep the cap
# far enough below the contact datum that neither it nor the bevel competes
# with the donor's shallow faceted exterior.
SHARD_TOP = -0.035
SHARD_BOTTOM = -CONTACT_HEIGHT
CORNER_X_THRESHOLD = 0.690
CORNER_Y_THRESHOLD = 0.455


def paths() -> dict[str, Path]:
    asset_dir = SOURCE / "blender" / ASSET
    proof_dir = SOURCE / "proofs" / "blender" / ASSET / "runtime-hybrid-candidate"
    production_dir = SOURCE / "production" / ASSET
    return {
        "baseline": asset_dir / f"{ASSET}-dense-master.blend",
        "baselineReport": HERE / "reports" / f"{ASSET}-dense-master.json",
        "feasibility": HERE / "reports" / f"{ASSET}-crackle-feasibility.json",
        "reference": SOURCE / "references" / f"{ASSET}.png",
        "candidate": asset_dir / f"{ASSET}-runtime-hybrid-candidate.blend",
        "proofDir": proof_dir,
        "report": production_dir / "runtime-hybrid-candidate-report.json",
        "mirror": HERE / "reports" / f"{ASSET}-runtime-hybrid-candidate.json",
    }


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def new_collection(
    name: str, parent: bpy.types.Collection | None = None
) -> bpy.types.Collection:
    result = bpy.data.collections.new(name)
    (parent.children if parent is not None else bpy.context.scene.collection.children).link(result)
    return result


def empty(
    name: str,
    collection: bpy.types.Collection,
    parent: bpy.types.Object | None,
) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    collection.objects.link(obj)
    obj.parent = parent
    return obj


def clear_old_proof_stage() -> None:
    for obj in list(bpy.data.objects):
        if obj.name.startswith("Amethyst_Hybrid_Proof_"):
            bpy.data.objects.remove(obj, do_unlink=True)
    for collection in list(bpy.data.collections):
        if collection.name.startswith("Cloudway_Amethyst_Runtime_Hybrid_Proof_"):
            bpy.data.collections.remove(collection)


def source_body_mesh(
    source_review: bpy.types.Object,
) -> tuple[bpy.types.Mesh, dict[str, Any]]:
    """Keep every non-corner source face, UV, and source-scale position."""
    mesh = source_review.data.copy()
    mesh.name = "AmethystSourceIntactBodyGeometry"
    matrix = source_review.matrix_world.copy()
    edit = bmesh.new()
    edit.from_mesh(mesh)
    edit.faces.ensure_lookup_table()
    corner_faces = [
        face
        for face in edit.faces
        if (
            abs(float((matrix @ face.calc_center_median()).x)) >= CORNER_X_THRESHOLD
            and abs(float((matrix @ face.calc_center_median()).y)) >= CORNER_Y_THRESHOLD
        )
    ]
    require(corner_faces, "Amethyst body partition found no corner faces")
    bmesh.ops.delete(edit, geom=corner_faces, context="FACES")
    loose = [vertex for vertex in edit.verts if not vertex.link_faces]
    if loose:
        bmesh.ops.delete(edit, geom=loose, context="VERTS")
    for vertex in edit.verts:
        vertex.co = matrix @ vertex.co
    edit.to_mesh(mesh)
    edit.free()
    mesh.update()
    mesh.calc_loop_triangles()
    require(bool(mesh.uv_layers), "Amethyst source-body UVs were lost")
    minimum, maximum = GEOMETRY.mesh_bounds(mesh)
    mesh.materials.clear()
    mesh["sourceGeometry"] = "exact non-corner dense donor faces at normalized source scale"
    mesh["collision"] = False
    return mesh, {
        "sourceVertices": len(source_review.data.vertices),
        "retainedVertices": len(mesh.vertices),
        "sourcePolygons": len(source_review.data.polygons),
        "retainedPolygons": len(mesh.polygons),
        "retainedTriangles": len(mesh.loop_triangles),
        "uvLayers": [layer.name for layer in mesh.uv_layers],
        "transform": {
            "sourceNormalizationMatrixApplied": True,
            "additionalScale": [1, 1, 1],
            "additionalTranslation": [0, 0, 0],
        },
        "boundsBlenderZUpMetres": {
            "min": [round(float(value), 9) for value in minimum],
            "max": [round(float(value), 9) for value in maximum],
        },
    }


def source_corner_mesh(
    source_review: bpy.types.Object,
) -> tuple[bpy.types.Mesh, dict[str, Any]]:
    """Extract the four ornate corner brackets by geometry-space position."""
    mesh = source_review.data.copy()
    mesh.name = "AmethystSourceCornerFiligreeGeometry"
    matrix = source_review.matrix_world.copy()
    edit = bmesh.new()
    edit.from_mesh(mesh)
    edit.faces.ensure_lookup_table()
    keep = []
    discard = []
    quadrants: set[tuple[int, int]] = set()
    for face in edit.faces:
        centre = matrix @ face.calc_center_median()
        target = (
            abs(float(centre.x)) >= CORNER_X_THRESHOLD
            and abs(float(centre.y)) >= CORNER_Y_THRESHOLD
        )
        if target:
            keep.append(face)
            quadrants.add((1 if centre.x >= 0 else -1, 1 if centre.y >= 0 else -1))
        else:
            discard.append(face)
    require(keep, "Geometry-space Amethyst corner extraction selected no faces")
    require(len(quadrants) == 4, "Amethyst corner extraction did not cover all four quadrants")
    bmesh.ops.delete(edit, geom=discard, context="FACES")
    loose = [vertex for vertex in edit.verts if not vertex.link_faces]
    if loose:
        bmesh.ops.delete(edit, geom=loose, context="VERTS")
    for vertex in edit.verts:
        vertex.co = matrix @ vertex.co
    edit.to_mesh(mesh)
    edit.free()
    mesh.update()
    require(len(mesh.polygons) > 0, "Amethyst corner extraction became empty")
    require(bool(mesh.uv_layers), "Amethyst corner extraction lost source UVs")
    minimum, maximum = GEOMETRY.mesh_bounds(mesh)
    mesh.materials.clear()
    mesh["sourceGeometry"] = "dense donor geometry-space four-corner face extraction"
    mesh["closed"] = False
    mesh["collision"] = False
    return mesh, {
        "method": "face-centroid absolute world X/Y thresholds",
        "thresholdMetres": {"x": CORNER_X_THRESHOLD, "y": CORNER_Y_THRESHOLD},
        "selectedSourceFaces": len(mesh.polygons),
        "selectedVertices": len(mesh.vertices),
        "quadrants": 4,
        "transform": "source normalized world positions retained exactly",
        "boundsBlenderZUpMetres": {
            "min": [round(float(value), 9) for value in minimum],
            "max": [round(float(value), 9) for value in maximum],
        },
        "topology": "open static decoration by design; never fracture or collision",
    }


def add_tubes(
    builder: Any,
    nodes: dict[str, tuple[float, float]],
    links: Sequence[tuple[str, str]],
    z: float,
    radius: float,
) -> None:
    for start, end in links:
        a = nodes[start]
        b = nodes[end]
        builder.add_tube((a[0], a[1], z), (b[0], b[1], z), radius, sides=8)


def authored_framework_geometry() -> tuple[bpy.types.Mesh, bpy.types.Mesh, dict[str, Any]]:
    """Add only a quiet persistent rim and sparse intact light catches."""
    perimeter_builder = GEOMETRY.MeshBuilder.empty()
    accent = GEOMETRY.MeshBuilder.empty()
    perimeter_z = -0.006
    accent_z = 0.016
    radius = 0.0025
    x0, x1 = -0.792, 0.792
    y0, y1 = -0.508, 0.508
    nodes = {
        "tl": (x0, y1), "tr": (x1, y1), "br": (x1, y0), "bl": (x0, y0),
    }
    perimeter = (("tl", "tr"), ("tr", "br"), ("br", "bl"), ("bl", "tl"))
    add_tubes(perimeter_builder, nodes, perimeter, perimeter_z, radius)
    accent_points = (
        (-0.46, 0.37), (0.26, 0.37), (0.55, 0.37),
        (-0.03, 0.00), (0.54, 0.00), (-0.46, -0.37), (0.26, -0.37),
    )
    for index, (x, y) in enumerate(accent_points):
        accent.add_star(
            (x, y, accent_z),
            0.010 + 0.001 * (index % 2),
            0.004,
            accent_z - 0.002,
            accent_z + 0.003,
            5,
        )
    perimeter_mesh = perimeter_builder.mesh("AmethystPersistentPerimeterGeometry")
    accent_mesh = accent.mesh("AmethystLuminousAccentGeometry")
    return perimeter_mesh, accent_mesh, {
        "method": "quiet authored perimeter plus sparse source-referenced light catches",
        "persistentPerimeterVertices": len(perimeter_mesh.vertices),
        "persistentPerimeterPolygons": len(perimeter_mesh.polygons),
        "accentVertices": len(accent_mesh.vertices),
        "accentPolygons": len(accent_mesh.polygons),
        "fracturePolicy": "source top lattice and luminous accents are under intactGlass and vanish on release",
        "accentPolicy": "sparse opaque emissive geometry at reviewed lattice junctions",
    }


def rectangular_voronoi_cells(
    seeds: Sequence[tuple[float, float]], width: float, depth: float
) -> list[list[tuple[float, float]]]:
    half_x = width * 0.5
    half_y = depth * 0.5
    rectangle = [(-half_x, -half_y), (half_x, -half_y), (half_x, half_y), (-half_x, half_y)]
    cells: list[list[tuple[float, float]]] = []
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
            polygon = GEOMETRY.clip_polygon(polygon, normal_x, normal_y, limit)
        require(len(polygon) >= 3, "Amethyst Voronoi shard cell collapsed")
        cells.append(polygon)
    return cells


def amethyst_seeds() -> tuple[tuple[float, float], ...]:
    return (
        (-0.710, -0.455), (-0.385, -0.475), (-0.055, -0.415), (0.285, -0.480), (0.685, -0.390),
        (-0.705, -0.130), (-0.300, -0.165), (0.095, -0.205), (0.510, -0.100),
        (-0.660, 0.185), (-0.235, 0.135), (0.205, 0.105), (0.690, 0.205),
        (-0.710, 0.455), (-0.330, 0.430), (0.035, 0.485), (0.390, 0.385), (0.720, 0.475),
    )


def contact_object(
    collection: bpy.types.Collection, root: bpy.types.Object
) -> bpy.types.Object:
    half_x = CONTACT_WIDTH * 0.5
    half_y = CONTACT_DEPTH * 0.5
    mesh = bpy.data.meshes.new("AmethystRuntimeContactRectangleGeometry")
    mesh.from_pydata(
        [(-half_x, -half_y, 0.0), (half_x, -half_y, 0.0), (half_x, half_y, 0.0), (-half_x, half_y, 0.0)],
        [],
        [[0, 1, 2, 3]],
    )
    mesh.update()
    obj = GEOMETRY.object_from_mesh(CONTACT_NAME, mesh, collection, root)
    obj["semanticRole"] = "non-rendered-contact-reference"
    obj["width"] = CONTACT_WIDTH
    obj["depth"] = CONTACT_DEPTH
    obj["topBlenderZ"] = 0.0
    obj.hide_render = True
    obj.hide_viewport = True
    obj.display_type = "WIRE"
    return obj


def platform_metadata() -> dict[str, Any]:
    return {
        "version": 1,
        "coordinates": {
            "upAxis": "+Y",
            "units": "metres",
            "origin": "top-centre-of-fully-extended-support",
        },
        "support": {
            "state": "intact",
            "topY": 0,
            "width": CONTACT_WIDTH,
            "depth": CONTACT_DEPTH,
        },
        "motion": {
            "kind": "crackle",
            "roles": {
                "persistent": [PERSISTENT_NAME],
                "intactGlass": INTACT_NAME,
                "contact": CONTACT_NAME,
                "shards": [f"{SHARD_PREFIX}{index:03d}" for index in range(18)],
            },
            "materials": {
                "glass": VISUALS.GLASS_MATERIAL,
                "framework": VISUALS.FRAMEWORK_MATERIAL,
                "internalDetail": VISUALS.DETAIL_MATERIAL,
                "cornerDetail": VISUALS.CORNER_MATERIAL,
                "accent": VISUALS.ACCENT_MATERIAL,
            },
        },
    }


def create_shards(
    collection: bpy.types.Collection,
    root: bpy.types.Object,
    glass: bpy.types.Material,
) -> tuple[list[bpy.types.Object], list[bpy.types.Object], list[dict[str, Any]]]:
    cells = rectangular_voronoi_cells(amethyst_seeds(), CONTACT_WIDTH, CONTACT_DEPTH)
    require(len(cells) == 18, "Amethyst runtime contract requires exactly 18 shards")
    roots: list[bpy.types.Object] = []
    meshes: list[bpy.types.Object] = []
    records: list[dict[str, Any]] = []
    for index, polygon in enumerate(cells):
        name = f"{SHARD_PREFIX}{index:03d}"
        geometry_name = f"AmethystRuntimeShardGlass_{index:03d}"
        mesh, centre = GEOMETRY.faceted_shard_mesh(
            f"{geometry_name}Geometry", polygon, SHARD_BOTTOM, SHARD_TOP, index + 41
        )
        shard_root = empty(name, collection, root)
        shard_root.location = centre
        shard_root["semanticRole"] = "closed-runtime-fracture-shard"
        shard_root["assembledAabbCentre"] = True
        geometry = GEOMETRY.object_from_mesh(
            geometry_name, mesh, collection, shard_root, glass
        )
        geometry["semanticRole"] = "runtime-crystal-glass"
        geometry["closed"] = True
        bpy.context.view_layer.objects.active = geometry
        geometry.select_set(True)
        bevel = geometry.modifiers.new("Closed shard micro bevel", "BEVEL")
        bevel.width = 0.0040 + 0.0005 * (index % 3)
        bevel.segments = 1
        bevel.limit_method = "ANGLE"
        bpy.ops.object.modifier_apply(modifier=bevel.name)
        geometry.select_set(False)
        minimum, maximum = GEOMETRY.mesh_bounds(mesh)
        local_correction = (minimum + maximum) * 0.5
        for vertex in mesh.vertices:
            vertex.co -= local_correction
        mesh.update()
        shard_root.location += local_correction
        centre = shard_root.location.copy()
        shard_root.hide_render = True
        shard_root.hide_viewport = True
        minimum, maximum = GEOMETRY.mesh_bounds(mesh)
        for axis in range(3):
            require(abs(minimum[axis] + maximum[axis]) < 1e-6, f"{name} origin is not its AABB centre")
        records.append(
            {
                "root": name,
                "geometry": geometry.name,
                "assembledTranslationBlenderZUp": [round(float(value), 9) for value in centre],
                "localBounds": {
                    "min": [round(float(value), 9) for value in minimum],
                    "max": [round(float(value), 9) for value in maximum],
                },
                "vertices": len(mesh.vertices),
                "polygons": len(mesh.polygons),
            }
        )
        roots.append(shard_root)
        meshes.append(geometry)
    return roots, meshes, records


def create_shard_surface_details(
    provider_mesh: bpy.types.Mesh,
    shard_roots: list[bpy.types.Object],
    collection: bpy.types.Collection,
    material: bpy.types.Material,
) -> tuple[list[bpy.types.Object], list[dict[str, Any]]]:
    """Mount every exact donor face once on its nearest assembled shard.

    The closed authored glass child supplies volume.  These open, non-collision
    children preserve the provider's vertices, UVs, smoothing and corner
    normals so fracture keeps the accepted facets and gold lattice.
    """
    seeds = amethyst_seeds()
    require(len(seeds) == len(shard_roots), "Amethyst detail seed/root count mismatch")
    groups: list[list[int]] = [[] for _seed in seeds]
    for polygon in provider_mesh.polygons:
        centre = polygon.center
        index = min(
            range(len(seeds)),
            key=lambda candidate: (
                (float(centre.x) - seeds[candidate][0]) ** 2
                + (float(centre.y) - seeds[candidate][1]) ** 2
            ),
        )
        groups[index].append(polygon.index)
    require(all(groups), "Amethyst provider face partition produced an empty shard detail")

    source_corner_normals = provider_mesh.corner_normals
    details: list[bpy.types.Object] = []
    records: list[dict[str, Any]] = []
    for index, (root, polygon_indices) in enumerate(zip(shard_roots, groups)):
        vertex_map: dict[int, int] = {}
        vertices: list[tuple[float, float, float]] = []
        faces: list[list[int]] = []
        source_polygons: list[bpy.types.MeshPolygon] = []
        for polygon_index in polygon_indices:
            source_polygon = provider_mesh.polygons[polygon_index]
            face: list[int] = []
            for source_vertex_index in source_polygon.vertices:
                mapped = vertex_map.get(source_vertex_index)
                if mapped is None:
                    mapped = len(vertices)
                    vertex_map[source_vertex_index] = mapped
                    local = provider_mesh.vertices[source_vertex_index].co - root.location
                    vertices.append(tuple(float(value) for value in local))
                face.append(mapped)
            faces.append(face)
            source_polygons.append(source_polygon)

        mesh = bpy.data.meshes.new(f"AmethystRuntimeShardSurfaceDetail_{index:03d}Geometry")
        mesh.from_pydata(vertices, [], faces)
        mesh.update()
        require(
            not mesh.validate(verbose=False),
            f"Amethyst shard detail {index:03d} failed mesh validation",
        )
        loop_normals: list[tuple[float, float, float]] = []
        for target_polygon, source_polygon in zip(mesh.polygons, source_polygons):
            target_polygon.use_smooth = source_polygon.use_smooth
            loop_normals.extend(
                tuple(float(value) for value in source_corner_normals[loop_index].vector)
                for loop_index in source_polygon.loop_indices
            )
        require(
            len(loop_normals) == len(mesh.loops),
            f"Amethyst shard detail {index:03d} corner-normal count changed",
        )
        mesh.normals_split_custom_set(loop_normals)
        for source_layer in provider_mesh.uv_layers:
            target_layer = mesh.uv_layers.new(name=source_layer.name)
            for target_polygon, source_polygon in zip(mesh.polygons, source_polygons):
                for target_loop, source_loop in zip(
                    target_polygon.loop_indices, source_polygon.loop_indices
                ):
                    target_layer.data[target_loop].uv = source_layer.data[source_loop].uv
        mesh["sourceGeometry"] = "deterministic nearest-seed exact donor-face partition"
        mesh["closed"] = False
        mesh["collision"] = False
        detail = GEOMETRY.object_from_mesh(
            f"AmethystRuntimeShardSurfaceDetail_{index:03d}",
            mesh,
            collection,
            root,
            material,
        )
        detail["semanticRole"] = "open-provider-pbr-shard-surface-detail"
        detail["collision"] = False
        details.append(detail)
        records.append(
            {
                "object": detail.name,
                "sourceFaces": len(polygon_indices),
                "vertices": len(mesh.vertices),
                "polygons": len(mesh.polygons),
                "loops": len(mesh.loops),
                "uvLayers": [layer.name for layer in mesh.uv_layers],
                "customCornerNormals": True,
                "closed": False,
                "collision": False,
            }
        )
    require(
        sum(record["sourceFaces"] for record in records) == len(provider_mesh.polygons),
        "Amethyst shard detail partition lost donor faces",
    )
    return details, records


def isolate_render_meshes(
    label: str,
    visible: Iterable[bpy.types.Object],
    inventories: list[dict[str, Any]],
) -> None:
    allowed = {obj.name for obj in visible}
    for obj in bpy.data.objects:
        if obj.type == "MESH":
            obj.hide_render = obj.name not in allowed
    actual = sorted(obj.name for obj in bpy.data.objects if obj.type == "MESH" and not obj.hide_render)
    require(actual == sorted(allowed), f"Render isolation failed for {label}: {actual}")
    inventories.append({"render": label, "visibleMeshes": actual})


def render_proofs(
    proof_dir: Path,
    source_review: bpy.types.Object,
    candidate_objects: list[bpy.types.Object],
    shell: bpy.types.Object,
    source_body: bpy.types.Object,
    perimeter: bpy.types.Object,
    accent: bpy.types.Object,
    corners: bpy.types.Object,
    shard_roots: list[bpy.types.Object],
    shard_meshes: list[bpy.types.Object],
    shard_details: list[bpy.types.Object],
) -> tuple[list[Path], list[dict[str, Any]]]:
    proof_dir.mkdir(parents=True, exist_ok=True)
    proof_collection = new_collection("Cloudway_Amethyst_Runtime_Hybrid_Proof_Stage")
    scene, camera, board = VISUALS.create_proof_stage(PREPARE, proof_collection)
    outputs: list[Path] = []
    inventories: list[dict[str, Any]] = []
    source_material = source_review.material_slots[0].material
    candidate_materials = {
        shell: shell.material_slots[0].material,
        source_body: source_body.material_slots[0].material,
        perimeter: perimeter.material_slots[0].material,
        accent: accent.material_slots[0].material,
        corners: corners.material_slots[0].material,
    }
    background = scene.world.node_tree.nodes.get("Background")
    beauty_colour = tuple(background.inputs["Color"].default_value)
    beauty_strength = float(background.inputs["Strength"].default_value)

    for view in ("game-camera", "top", "side"):
        VISUALS.configure_camera(PREPARE, camera, view)
        source_review.material_slots[0].link = "OBJECT"
        source_review.material_slots[0].material = source_material
        isolate_render_meshes(f"provider-pbr-{view}", [source_review, board], inventories)
        outputs.append(
            VISUALS.render_atomic(PREPARE, scene, proof_dir / f"provider-pbr-{view}.png", 320)
        )
        isolate_render_meshes(f"hybrid-beauty-{view}", [*candidate_objects, board], inventories)
        outputs.append(
            VISUALS.render_atomic(PREPARE, scene, proof_dir / f"hybrid-beauty-{view}.png", 448)
        )

    VISUALS.configure_camera(PREPARE, camera, "game-camera")
    diagnostic = {
        shell: VISUALS.diagnostic_material("Amethyst semantic glass", (0.05, 0.38, 1.0, 1.0)),
        source_body: VISUALS.diagnostic_material("Amethyst semantic exact source body", (0.08, 0.90, 0.82, 1.0)),
        perimeter: VISUALS.diagnostic_material("Amethyst semantic persistent perimeter", (1.0, 0.23, 0.025, 1.0)),
        accent: VISUALS.diagnostic_material("Amethyst semantic accent", (0.54, 0.02, 1.0, 1.0)),
        corners: VISUALS.diagnostic_material("Amethyst semantic corner detail", (1.0, 0.75, 0.08, 1.0)),
    }
    for obj, material in diagnostic.items():
        obj.material_slots[0].material = material
    isolate_render_meshes("hybrid-semantic-game-camera", [*candidate_objects, board], inventories)
    outputs.append(
        VISUALS.render_atomic(PREPARE, scene, proof_dir / "hybrid-semantic-game-camera.png", 128)
    )
    for obj, material in candidate_materials.items():
        obj.material_slots[0].material = material

    beauty_floor = board.material_slots[0].material
    board.material_slots[0].material = board.material_slots[1].material
    background.inputs["Color"].default_value = (0.008, 0.014, 0.026, 1.0)
    background.inputs["Strength"].default_value = 0.24
    isolate_render_meshes("hybrid-transmission-game-camera", [*candidate_objects, board], inventories)
    outputs.append(
        VISUALS.render_atomic(PREPARE, scene, proof_dir / "hybrid-transmission-game-camera.png", 320)
    )
    board.material_slots[0].material = beauty_floor
    background.inputs["Color"].default_value = beauty_colour
    background.inputs["Strength"].default_value = beauty_strength

    assembled_transforms: list[tuple[Vector, tuple[float, float, float]]] = []
    for index, shard_root in enumerate(shard_roots):
        assembled = shard_root.location.copy()
        assembled_rotation = tuple(float(value) for value in shard_root.rotation_euler)
        direction = Vector((assembled.x, assembled.y, 0.52 + 0.03 * (index % 4)))
        if direction.length_squared > 0.0:
            direction.normalize()
        shard_root.location = assembled + direction * (0.22 + 0.026 * (index % 5))
        shard_root.rotation_euler = (
            0.07 * ((index % 3) - 1),
            0.06 * (((index * 2) % 3) - 1),
            0.045 * ((index % 5) - 2),
        )
        assembled_transforms.append((assembled, assembled_rotation))
    isolate_render_meshes(
        "hybrid-shards-exploded-game-camera",
        [perimeter, corners, *shard_meshes, *shard_details, board],
        inventories,
    )
    outputs.append(
        VISUALS.render_atomic(
            PREPARE, scene, proof_dir / "hybrid-shards-exploded-game-camera.png", 384
        )
    )
    for shard_root, (assembled, rotation) in zip(shard_roots, assembled_transforms):
        shard_root.location = assembled
        shard_root.rotation_euler = rotation
    isolate_render_meshes("saved-candidate-state", candidate_objects, inventories)
    return outputs, inventories


def main() -> None:
    resolved = paths()
    baseline_report = json.loads(resolved["baselineReport"].read_text())
    feasibility = json.loads(resolved["feasibility"].read_text())
    baseline_sha = baseline_report["packedBlend"]["sha256"]
    require(PREPARE.digest(resolved["baseline"]) == baseline_sha, "Dense Amethyst master changed")
    bpy.ops.wm.open_mainfile(filepath=str(resolved["baseline"]), load_ui=False)
    clear_old_proof_stage()
    source_root = bpy.data.objects.get(SOURCE_ROOT_NAME)
    source_review = bpy.data.objects.get(SOURCE_REVIEW_NAME)
    require(source_root is not None and source_review is not None, "Dense Amethyst hierarchy missing")
    source_root["candidateUse"] = "hidden immutable provider reference"

    collection = new_collection("Cloudway_Amethyst_Runtime_Hybrid_Candidate")
    root = empty(ROOT_NAME, collection, None)
    persistent = empty(PERSISTENT_NAME, collection, root)
    intact = empty(INTACT_NAME, collection, root)
    root["assetId"] = ASSET
    root["status"] = "visual checkpoint; GLB export and runtime integration pending acceptance"
    root["sourceMasterSha256"] = baseline_sha
    root["sourceDecimated"] = False
    metadata = platform_metadata()
    collider = {
        "shape": "box",
        "width": CONTACT_WIDTH,
        "depth": CONTACT_DEPTH,
        "height": CONTACT_HEIGHT,
        "topY": 0,
        "center": [0, -CONTACT_HEIGHT * 0.5, 0],
    }
    root["platform_adapter_json"] = json.dumps(metadata, separators=(",", ":"))
    root["collider_json"] = json.dumps(collider, separators=(",", ":"))

    images = VISUALS.source_images()
    materials = {
        "glass": VISUALS.glass_material(),
        "framework": VISUALS.framework_material(),
        "internalDetail": VISUALS.internal_detail_material(images),
        "cornerDetail": VISUALS.corner_provider_material(images),
        "accent": VISUALS.accent_material(),
    }
    shell = GEOMETRY.rounded_box(
        "AmethystRuntimeCrystalShell",
        (SHELL_WIDTH, SHELL_DEPTH, SHELL_HEIGHT),
        SHELL_TOP - SHELL_HEIGHT * 0.5,
        0.023,
        collection,
        intact,
        materials["glass"],
    )
    shell["semanticRole"] = "runtime-intact-crystal-glass"
    body_mesh, body_record = source_body_mesh(source_review)
    source_body = GEOMETRY.object_from_mesh(
        "AmethystRuntimeSourceIntactBody",
        body_mesh,
        collection,
        intact,
        materials["internalDetail"],
    )
    source_body["semanticRole"] = "subordinate-exact-provider-intact-body"
    source_body["collision"] = False

    perimeter_mesh, accent_mesh, framework_record = authored_framework_geometry()
    perimeter = GEOMETRY.object_from_mesh(
        "AmethystRuntimePersistentPerimeter",
        perimeter_mesh,
        collection,
        persistent,
        materials["framework"],
    )
    perimeter["semanticRole"] = "persistent-authored-source-referenced-perimeter"
    accent = GEOMETRY.object_from_mesh(
        "AmethystRuntimeLuminousAccents",
        accent_mesh,
        collection,
        intact,
        materials["accent"],
    )
    accent["semanticRole"] = "intact-only-sparse-luminous-accent"
    corner_mesh, corner_record = source_corner_mesh(source_review)
    corners = GEOMETRY.object_from_mesh(
        "AmethystRuntimeSourceCornerFiligree",
        corner_mesh,
        collection,
        persistent,
        materials["cornerDetail"],
    )
    corners["semanticRole"] = "persistent-reviewed-source-corner-filigree"
    corners["collision"] = False
    require(
        body_record["retainedPolygons"] + corner_record["selectedSourceFaces"]
        == len(source_review.data.polygons),
        "Amethyst source body/corner partition does not cover every source face exactly once",
    )

    contact = contact_object(collection, root)
    shard_roots, shard_meshes, shard_records = create_shards(collection, root, materials["glass"])
    shard_details, shard_detail_records = create_shard_surface_details(
        body_mesh,
        shard_roots,
        collection,
        materials["internalDetail"],
    )
    for shard_record, surface_record in zip(shard_records, shard_detail_records):
        shard_record["surfaceDetail"] = surface_record
    require(
        GEOMETRY.all_finite(
            [
                shell.data,
                source_body.data,
                perimeter_mesh,
                accent_mesh,
                corner_mesh,
                *(obj.data for obj in shard_meshes),
                *(obj.data for obj in shard_details),
            ]
        ),
        "Amethyst candidate contains non-finite geometry",
    )

    source_review.hide_render = True
    source_review.hide_viewport = True
    source_root.hide_render = False
    candidate_objects = [shell, source_body, perimeter, accent, corners]
    proof_files, render_inventories = render_proofs(
        resolved["proofDir"],
        source_review,
        candidate_objects,
        shell,
        source_body,
        perimeter,
        accent,
        corners,
        shard_roots,
        shard_meshes,
        shard_details,
    )

    source_review.hide_render = True
    source_review.hide_viewport = True
    source_root.hide_render = False
    for obj in candidate_objects:
        obj.hide_render = False
        obj.hide_viewport = False
    contact.hide_render = True
    contact.hide_viewport = True
    for obj in shard_roots:
        obj.hide_render = True
        obj.hide_viewport = True
    bpy.ops.file.pack_all()
    resolved["candidate"].parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(resolved["candidate"]), check_existing=False)
    require(PREPARE.digest(resolved["baseline"]) == baseline_sha, "Dense Amethyst master mutated")

    report = {
        "schema": "cloudway-amethyst-crackle-runtime-hybrid-candidate/v1",
        "assetId": ASSET,
        "status": "geometry and pale-glass material checkpoint complete; runtime proof tracked separately",
        "source": {
            "denseMaster": baseline_report["packedBlend"],
            "reference": PREPARE.file_record(resolved["reference"]),
            "visibleExteriorDimensionsMetres": [SOURCE_WIDTH, SOURCE_DEPTH, 0.286381668],
            "denseMasterUnchangedAfterBuild": True,
            "fullPbrMapsPacked": True,
            "decimation": False,
        },
        "runtimeContract": {
            "logicalId": "cloudway-lab-amethyst-crackle-v1",
            "root": ROOT_NAME,
            "metadata": metadata,
            "collider": collider,
            "coordinateConversion": "Blender Z-up source exports to glTF +Y; origin remains contact top-centre",
        },
        "contact": {
            "node": CONTACT_NAME,
            "shape": "rectangle",
            "widthMetres": CONTACT_WIDTH,
            "depthMetres": CONTACT_DEPTH,
            "topBlenderZ": 0.0,
            "topRuntimeY": 0.0,
            "ornamentalFaces": 0,
            "sourceRayEvidence": feasibility["surface"]["verticalRayAudit"],
            "certification": (
                "Conservative 1.64 x 1.10 m rectangle inside the measured broad top patch. "
                "The 1.64 m square proposal was rejected because the donor is only 1.178 m deep."
            ),
        },
        "intact": {
            "root": INTACT_NAME,
            "shell": {
                "object": shell.name,
                "dimensionsMetres": [SHELL_WIDTH, SHELL_DEPTH, SHELL_HEIGHT],
                "topBlenderZ": SHELL_TOP,
                "newClosedGeometry": True,
                "material": materials["glass"].name,
                "materialDecision": {
                    "baseColorLinear": [0.58, 0.40, 0.72],
                    "emissionLinear": [0.0, 0.0, 0.0],
                    "emissionStrength": 0.0,
                    "reason": (
                        "pale non-emissive lavender keeps new cut faces subordinate to the exact "
                        "provider exterior under Three lighting"
                    ),
                },
                "placement": (
                    "optical underlay 0.025 m below the contact datum, inside the exact source exterior; "
                    "separation prevents coincident-face artefacts while the independent contact proxy "
                    "remains the gameplay support authority"
                ),
            },
            "internalDetail": {
                "object": source_body.name,
                "sourcePreserved": True,
                "subordinate": True,
                "collision": False,
                "material": materials["internalDetail"].name,
                "runtimeMaterialPolicy": "exact opaque provider PBR accepted for intact fidelity",
                **body_record,
            },
        },
        "persistent": {
            "root": PERSISTENT_NAME,
            "perimeter": {
                "object": perimeter.name,
                "material": materials["framework"].name,
            },
            "sourceCorners": {
                "object": corners.name,
                "material": materials["cornerDetail"].name,
                "collision": False,
                "fractures": False,
                **corner_record,
            },
            "geometry": framework_record,
            "sourceCornerDecision": (
                "Four geometry-selected donor corner regions retain exact original PBR as open, "
                "non-collision persistent filigree. The complementary intact body retains every "
                "other source face, including the original top lattice and faceted crystal sides. "
                "No semantic region was inferred from metallic pixels."
            ),
        },
        "intactDecoration": {
            "accent": {
                "object": accent.name,
                "material": materials["accent"].name,
                "fractureBehavior": "child of intactGlass; hidden when shards release",
            },
        },
        "fracture": {
            "prefix": SHARD_PREFIX,
            "count": len(shard_records),
            "seedLayout": "fixed irregular 18-cell rectangular Voronoi; no grid or runtime randomness",
            "closed": True,
            "material": materials["glass"].name,
            "rootOrigin": "each assembled AABB centre",
            "verticalExtentMetres": [SHARD_BOTTOM, SHARD_TOP + 0.0075],
            "closedGlassInset": {
                "plan": (
                    "1.64 x 1.10 m shard union remains inside the 1.70 x 1.178027339 m "
                    "provider exterior"
                ),
                "capTopBlenderZ": SHARD_TOP,
                "maximumBevelTopBlenderZ": SHARD_TOP + 0.0075,
                "reason": (
                    "keep the closed glass volumes below the retained provider exterior; "
                    "glass remains visible on new inner cut faces without depth-fighting the top"
                ),
            },
            "surfaceDetailPolicy": (
                "Every complementary provider-body face is assigned exactly once by nearest "
                "deterministic shard seed. Open UV- and custom-corner-normal-preserving detail "
                "rides the matching closed glass shard; corner filigree remains persistent."
            ),
            "shards": shard_records,
            "runtimeTimerSeconds": 4,
        },
        "candidateBlend": PREPARE.file_record(resolved["candidate"]),
        "proofMethod": {
            "views": ["matched game camera", "orthographic top", "matched low side"],
            "beauty": "448 Eevee samples, pastel field, no post blur",
            "transmissionWitness": "separate blue/coral checker render",
            "exploded": "persistent framework fixed; 18 deterministic closed shard roots displaced",
            "renderIsolation": render_inventories,
        },
        "proofs": VISUALS.proof_records(PREPARE, proof_files),
        "rebuild": (
            "rtk proxy flock -w 1200 /tmp/glass-cloudway-blender.lock timeout 1200 "
            "env ALSOFT_DRIVERS=null /usr/bin/blender --background --python-exit-code 1 "
            "--python art/glass-adventure/cloudway-laboratory/v1/production/"
            "prepare_amethyst_crackle_runtime_candidate.py"
        ),
    }
    PREPARE.durable_json(resolved["report"], report)
    PREPARE.durable_json(resolved["mirror"], report)
    print(
        "AMETHYST_RUNTIME_HYBRID_CANDIDATE="
        + json.dumps(
            {
                "candidate": report["candidateBlend"],
                "proofs": len(report["proofs"]),
                "shards": len(shard_records),
                "contact": [CONTACT_WIDTH, CONTACT_DEPTH],
                "sourceBodyBounds": body_record["boundsBlenderZUpMetres"],
            },
            separators=(",", ":"),
        )
    )


if __name__ == "__main__":
    main()
