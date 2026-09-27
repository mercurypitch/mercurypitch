#!/usr/bin/env python3
"""Build the source-preserving Frosted Scroll Wall semantic derivative."""

from __future__ import annotations

import bmesh
import importlib.util
import json
import math
from pathlib import Path
import sys
from typing import Any, Iterable

import bpy
from mathutils import Matrix, Vector
import numpy as np


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
GEOMETRY = load_module("cloudway_frost_wall_geometry", HERE / "frosted_scroll_wall_geometry.py")
VISUALS = load_module("cloudway_frost_wall_visuals", HERE / "frosted_scroll_wall_visuals.py")
SOURCE = PREPARE.SOURCE
ASSET = "frosted-scroll-wall"
SOURCE_ROOT_NAME = "Cloudway_FrostedScrollWall_DenseMaster"
SOURCE_REVIEW_NAME = f"{ASSET}__normalized_review"
ROOT_NAME = "CloudwayLab_FrostedScrollWall"
FRAME_NAME = "frost_wall_frame"
FRAME_VISUAL_NAME = "frost_wall_frame_visual"
FRAME_TRIM_NAME = "frost_wall_frame_inner_trim"
FRAME_BACKING_NAME = "frost_wall_frame_inner_backing"
INTACT_NAME = "frost_wall_intact"
INTACT_VOLUME_NAME = "frost_wall_intact_volume"
ARCHIVED_PANE_NAME = "frost_wall_source_pane_archive"
CONTACT_NAME = "frost_wall_pane_contact"
SHARD_PREFIX = "frost_wall_shard_"
DONOR_PANE_FLOOR_Z = 0.32
SOURCE_PANE_CENTRE_X = 0.0
PORTAL_CLASSIFICATION_MARGIN = 0.025
FRAME_DEPTH = 0.491436869
FRAME_HALF_DEPTH = FRAME_DEPTH * 0.5


def paths() -> dict[str, Path]:
    asset_dir = SOURCE / "blender" / ASSET
    proof_dir = SOURCE / "proofs" / "blender" / ASSET / "semantic-candidate"
    production_dir = SOURCE / "production" / ASSET
    texture_dir = SOURCE / "textures" / ASSET
    return {
        "baseline": asset_dir / f"{ASSET}-dense-master.blend",
        "baselineReport": HERE / "reports" / f"{ASSET}-dense-master.json",
        "candidate": asset_dir / f"{ASSET}-semantic-candidate.blend",
        "proofDir": proof_dir,
        "sourceReport": production_dir / "semantic-candidate-report.json",
        "mirrorReport": HERE / "reports" / f"{ASSET}-semantic-candidate.json",
        "surfaceBaseColor": texture_dir / "frost-wall-surface-base-color-4096.png",
        "surfaceMetallic": texture_dir / "frost-wall-surface-metallic-4096.png",
    }


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def collection(name: str) -> bpy.types.Collection:
    result = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(result)
    return result


def create_group(
    name: str,
    parent: bpy.types.Object,
    target: bpy.types.Collection,
    *,
    role: str,
) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    target.objects.link(obj)
    obj.parent = parent
    obj["role"] = role
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.12
    return obj


def descendants(root: bpy.types.Object) -> Iterable[bpy.types.Object]:
    yield root
    for child in root.children:
        yield from descendants(child)


def source_material(review: bpy.types.Object) -> bpy.types.Material:
    materials = [slot.material for slot in review.material_slots if slot.material]
    require(len(materials) == 1, "Frost wall source must have one provider material")
    return materials[0]


def canonical_positions(
    review: bpy.types.Object,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    positions, triangles = PREPARE.mesh_arrays(review.data)
    world = PREPARE.world_positions(positions, review.matrix_world)
    canonical = world.copy()
    canonical[:, 0] -= SOURCE_PANE_CENTRE_X
    return positions, triangles, canonical


def pane_face_mask(canonical: np.ndarray, triangles: np.ndarray) -> np.ndarray:
    triangle_vertices = canonical[triangles]
    x = triangle_vertices[:, :, 0]
    z = triangle_vertices[:, :, 2]
    half_width = np.full(z.shape, GEOMETRY.PANE_WIDTH * 0.5, dtype=np.float64)
    arch = z > GEOMETRY.PANE_SHOULDER_HEIGHT
    normalized = np.clip(
        (z[arch] - GEOMETRY.PANE_SHOULDER_HEIGHT) / GEOMETRY.PANE_ARCH_RISE,
        0.0,
        1.0,
    )
    half_width[arch] *= np.sqrt(np.maximum(0.0, 1.0 - normalized * normalized))
    margin = PORTAL_CLASSIFICATION_MARGIN
    vertex_inside = (
        (z >= -margin)
        & (z <= GEOMETRY.PANE_HEIGHT + margin)
        & (np.abs(x) <= half_width + margin)
    )
    return vertex_inside.any(axis=1)


def object_bounds(obj: bpy.types.Object) -> tuple[list[float], list[float]]:
    points = np.asarray(
        [tuple(obj.matrix_world @ vertex.co) for vertex in obj.data.vertices],
        dtype=np.float64,
    )
    require(len(points) > 0, f"{obj.name} has no vertices")
    return (
        [round(float(value), 9) for value in points.min(axis=0)],
        [round(float(value), 9) for value in points.max(axis=0)],
    )


def assign_material(obj: bpy.types.Object, material: bpy.types.Material) -> None:
    obj.data.materials.clear()
    obj.data.materials.append(material)


def split_source_geometry(
    review: bpy.types.Object,
    pane_mask: np.ndarray,
    target: bpy.types.Collection,
    frame_parent: bpy.types.Object,
    intact_parent: bpy.types.Object,
    frame_material: bpy.types.Material,
    detail_material: bpy.types.Material,
) -> tuple[bpy.types.Object, bpy.types.Object]:
    require(len(pane_mask) == len(review.data.polygons), "Pane mask length differs")
    candidate = review.copy()
    candidate.data = review.data.copy()
    candidate.name = "frost_wall_semantic_source"
    target.objects.link(candidate)
    candidate.matrix_world = review.matrix_world.copy()
    candidate.hide_render = False
    candidate.hide_viewport = False
    candidate.hide_set(False)
    selection = pane_mask.astype(np.bool_)
    candidate.data.polygons.foreach_set("select", selection)
    candidate.data.update()
    before = set(bpy.data.objects)
    bpy.ops.object.select_all(action="DESELECT")
    candidate.select_set(True)
    bpy.context.view_layer.objects.active = candidate
    bpy.context.tool_settings.mesh_select_mode = (False, False, True)
    bpy.ops.object.mode_set(mode="EDIT")
    result = bpy.ops.mesh.separate(type="SELECTED")
    bpy.ops.object.mode_set(mode="OBJECT")
    require(result == {"FINISHED"}, "Blender could not separate the pane region")
    created = [obj for obj in set(bpy.data.objects) - before if obj.type == "MESH"]
    require(len(created) == 1, "Pane separation did not create exactly one mesh object")
    pieces = [candidate, created[0]]
    pane_faces = int(selection.sum())
    frame_faces = len(selection) - pane_faces
    pane = next((obj for obj in pieces if len(obj.data.polygons) == pane_faces), None)
    frame = next((obj for obj in pieces if len(obj.data.polygons) == frame_faces), None)
    require(pane is not None and frame is not None and pane is not frame, "Separated roles differ")
    frame.name = FRAME_VISUAL_NAME
    frame.data.name = FRAME_VISUAL_NAME + "Geometry"
    pane.name = ARCHIVED_PANE_NAME
    pane.data.name = ARCHIVED_PANE_NAME + "Geometry"
    for obj, parent in ((frame, frame_parent), (pane, intact_parent)):
        obj.parent = parent
        obj.matrix_parent_inverse = Matrix.Identity(4)
        obj.hide_render = False
        obj.hide_viewport = False
    assign_material(frame, frame_material)
    assign_material(pane, detail_material)
    frame["role"] = "persistent-opaque-provider-frame"
    frame["sourceTopology"] = "exact donor face subset"
    frame["decimated"] = False
    pane["role"] = "removable-provider-pane-detail"
    pane["sourceTopology"] = "exact donor face subset"
    pane["decimated"] = False
    return frame, pane


def create_empty(
    name: str,
    root: bpy.types.Object,
    target: bpy.types.Collection,
    *,
    role: str,
    bounds_y_up: dict[str, list[float]],
) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    target.objects.link(obj)
    obj.parent = root
    obj["role"] = role
    obj["bounds_y_up_json"] = json.dumps(bounds_y_up, separators=(",", ":"))
    obj["coordinates"] = "glTF +Y up; X horizontal; Z depth"
    obj.empty_display_type = "CUBE"
    obj.empty_display_size = 0.08
    obj.hide_render = True
    obj.hide_viewport = True
    return obj


def frame_collision_bounds(frame_high_z: float) -> dict[str, dict[str, list[float]]]:
    pane_half = GEOMETRY.PANE_WIDTH * 0.5
    outer_half = 2.71131295 * 0.5
    base = 0.0
    shoulder = GEOMETRY.PANE_SHOULDER_HEIGHT
    return {
        "frost_wall_frame_left": {
            "min": [-outer_half, base, -FRAME_HALF_DEPTH],
            "max": [-pane_half, shoulder, FRAME_HALF_DEPTH],
        },
        "frost_wall_frame_right": {
            "min": [pane_half, base, -FRAME_HALF_DEPTH],
            "max": [outer_half, shoulder, FRAME_HALF_DEPTH],
        },
        "frost_wall_frame_top": {
            "min": [-pane_half, shoulder, -FRAME_HALF_DEPTH],
            "max": [pane_half, frame_high_z, FRAME_HALF_DEPTH],
        },
    }


def mesh_closed_audit(obj: bpy.types.Object) -> dict[str, Any]:
    mesh = obj.data
    require(mesh is not None, f"{obj.name} has no mesh")
    edit = bmesh.new()
    edit.from_mesh(mesh)
    boundary = sum(1 for edge in edit.edges if len(edge.link_faces) == 1)
    non_manifold = sum(1 for edge in edit.edges if len(edge.link_faces) != 2)
    volume = abs(float(edit.calc_volume(signed=True)))
    edit.free()
    positions = np.empty(len(mesh.vertices) * 3, dtype=np.float64)
    mesh.vertices.foreach_get("co", positions)
    require(np.isfinite(positions).all(), f"{obj.name} has non-finite positions")
    require(boundary == 0 and non_manifold == 0, f"{obj.name} is not closed")
    require(volume > 1e-9, f"{obj.name} has no enclosed volume")
    return {
        "vertices": len(mesh.vertices),
        "polygons": len(mesh.polygons),
        "boundaryEdges": boundary,
        "nonManifoldEdges": non_manifold,
        "volumeCubicMetres": round(volume, 9),
        "originBlenderZUp": [round(float(value), 9) for value in obj.location],
    }


def add_semantic_nodes(
    root: bpy.types.Object,
    frame_parent: bpy.types.Object,
    target: bpy.types.Collection,
    frame_high_z: float,
) -> list[bpy.types.Object]:
    pane_bounds = {
        "min": [-GEOMETRY.PANE_WIDTH * 0.5, 0.0, -GEOMETRY.PANE_HALF_DEPTH],
        "max": [GEOMETRY.PANE_WIDTH * 0.5, GEOMETRY.PANE_HEIGHT, GEOMETRY.PANE_HALF_DEPTH],
    }
    result = [
        create_empty(
            CONTACT_NAME,
            root,
            target,
            role="breakable-pane-collider-metadata",
            bounds_y_up=pane_bounds,
        )
    ]
    for name, bounds in frame_collision_bounds(frame_high_z).items():
        result.append(
            create_empty(
                name,
                frame_parent,
                target,
                role="persistent-frame-solid-metadata",
                bounds_y_up=bounds,
            )
        )
    return result


def logical_records(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result = []
    for row in rows:
        record = dict(row)
        record["file"] = PREPARE.logical_path(Path(record["file"]))
        result.append(record)
    return result


def rounded_bounds(bounds: tuple[list[float], list[float]]) -> dict[str, list[float]]:
    return {"min": bounds[0], "max": bounds[1]}


def main() -> None:
    resolved = paths()
    baseline_report = json.loads(resolved["baselineReport"].read_text())
    baseline_sha = baseline_report["packedBlend"]["sha256"]
    require(PREPARE.digest(resolved["baseline"]) == baseline_sha, "Dense master changed")
    bpy.ops.wm.open_mainfile(filepath=str(resolved["baseline"]), load_ui=False)
    source_root = bpy.data.objects.get(SOURCE_ROOT_NAME)
    source_review = bpy.data.objects.get(SOURCE_REVIEW_NAME)
    require(source_root is not None and source_review is not None, "Dense source hierarchy missing")
    source_root.hide_render = True
    source_root.hide_viewport = True
    source_review.hide_render = True
    source_review.hide_viewport = True
    source_positions, source_triangles, canonical = canonical_positions(source_review)
    pane_mask = pane_face_mask(canonical, source_triangles)
    pane_faces = int(pane_mask.sum())
    frame_faces = int(len(pane_mask) - pane_faces)
    require(pane_faces > 50_000, "Pane classification selected too little source detail")
    require(frame_faces > 50_000, "Frame classification selected too little source detail")

    candidate_collection = collection("Cloudway_FrostWall_SemanticCandidate")
    root = bpy.data.objects.new(ROOT_NAME, None)
    candidate_collection.objects.link(root)
    root["assetId"] = ASSET
    root["role"] = "breakable-wall-family-root"
    root["coordinates"] = "Blender Z-up authoring; glTF +Y up; X horizontal; Z depth"
    root["origin"] = "centred pane floor"
    root["sourceMasterSha256"] = baseline_sha
    root["sourceTopologyReduced"] = False
    root["paneWidthMetres"] = GEOMETRY.PANE_WIDTH
    root["paneHeightMetres"] = GEOMETRY.PANE_HEIGHT
    root["paneDepthMetres"] = GEOMETRY.PANE_DEPTH
    root["shardCount"] = len(GEOMETRY.shard_seeds())

    frame_root = create_group(
        FRAME_NAME,
        root,
        candidate_collection,
        role="persistent-frame-root",
    )
    intact_root = create_group(
        INTACT_NAME,
        root,
        candidate_collection,
        role="breakable-intact-pane-root",
    )
    archive_root = bpy.data.objects.new("FrostWall_SourcePaneArchive", None)
    candidate_collection.objects.link(archive_root)
    archive_root["role"] = "non-runtime-source-pane-archive"
    archive_root.hide_render = True
    archive_root.hide_viewport = True

    provider = source_material(source_review)
    VISUALS.author_surface_textures(
        resolved["surfaceBaseColor"],
        resolved["surfaceMetallic"],
        GEOMETRY.etching_paths(),
    )
    pane_base_color = VISUALS.load_packed_image(
        resolved["surfaceBaseColor"],
        "frosted-scroll-wall__pane_base_color",
    )
    pane_metallic = VISUALS.load_packed_image(
        resolved["surfaceMetallic"],
        "frosted-scroll-wall__pane_metallic",
        non_color=True,
    )
    materials = {
        "frame": VISUALS.frame_material(provider),
        "detail": VISUALS.intact_detail_material(provider),
        "innerTrim": VISUALS.inner_trim_material(),
        "frameBacking": VISUALS.frame_backing_material(),
        "glass": VISUALS.glass_material(
            "FrostWallGlass__surface",
            (0.72, 0.93, 1.0, 1.0),
            roughness=0.2,
            transmission=0.62,
            alpha=0.56,
            base_color_image=pane_base_color,
            metallic_image=pane_metallic,
        ),
        "edge": VISUALS.glass_material(
            "FrostWallGlass__cut_edge",
            (0.18, 0.66, 0.9, 1.0),
            roughness=0.17,
            transmission=0.72,
            alpha=0.82,
        ),
    }
    frame, pane_detail = split_source_geometry(
        source_review,
        pane_mask,
        candidate_collection,
        frame_root,
        archive_root,
        materials["frame"],
        materials["detail"],
    )
    pane_detail.name = ARCHIVED_PANE_NAME
    pane_detail.data.name = ARCHIVED_PANE_NAME + "Geometry"
    pane_detail.hide_render = True
    pane_detail.hide_viewport = True
    frame_trim = GEOMETRY.create_inner_trim_object(
        FRAME_TRIM_NAME,
        candidate_collection,
        materials["innerTrim"],
    )
    frame_trim.parent = frame_root
    frame_backing = GEOMETRY.create_inner_backing_object(
        FRAME_BACKING_NAME,
        candidate_collection,
        materials["frameBacking"],
    )
    frame_backing.parent = frame_root
    intact_volume, intact_result = GEOMETRY.create_prism_object(
        INTACT_VOLUME_NAME,
        GEOMETRY.pane_outline(),
        candidate_collection,
        (materials["glass"], materials["edge"]),
        origin_at_centroid=False,
    )
    intact_volume.parent = intact_root
    intact_volume["role"] = "breakable-intact-closed-pane-volume"
    intact_volume["closed"] = True
    intact_volume["authoredGeometry"] = True
    shards: list[bpy.types.Object] = []
    cell_areas: list[float] = []
    for index, cell in enumerate(GEOMETRY.voronoi_cells()):
        shard, result = GEOMETRY.create_prism_object(
            f"{SHARD_PREFIX}{index:03d}",
            cell,
            candidate_collection,
            (materials["glass"], materials["edge"]),
            origin_at_centroid=True,
            bevel=GEOMETRY.SHARD_BEVEL,
        )
        shard.parent = root
        shard["role"] = "closed-breakable-pane-shard"
        shard["shardIndex"] = index
        shard["closed"] = True
        shard["restTranslationYUp"] = json.dumps(
            [round(float(shard.location.x), 9), round(float(shard.location.z), 9), 0.0],
            separators=(",", ":"),
        )
        shard.hide_render = True
        shard.hide_viewport = True
        shards.append(shard)
        cell_areas.append(result.footprint_area)
    require(len(shards) == 32, "Wall shard count differs from the frozen runtime contract")
    pane_area = abs(GEOMETRY.signed_area(GEOMETRY.pane_outline()))
    require(abs(sum(cell_areas) - pane_area) < 1e-7, "Shard cells do not tile the pane")

    frame_low, frame_high = object_bounds(frame)
    metadata_nodes = add_semantic_nodes(
        root, frame_root, candidate_collection, frame_high[2]
    )
    pane_audit = mesh_closed_audit(intact_volume)
    shard_audits = [mesh_closed_audit(shard) for shard in shards]
    frame_bounds_y_up = {
        "min": [frame_low[0], frame_low[2], -frame_high[1]],
        "max": [frame_high[0], frame_high[2], -frame_low[1]],
    }

    scene, camera, witness = VISUALS.setup_scene(0.0)
    proof_rows = VISUALS.render_semantic_proofs(
        scene,
        camera,
        witness,
        resolved["proofDir"],
        frame=(frame, frame_backing, frame_trim),
        intact=(intact_volume,),
        shards=shards,
    )
    frame.hide_render = False
    frame.hide_viewport = False
    frame_trim.hide_render = False
    frame_trim.hide_viewport = False
    frame_backing.hide_render = False
    frame_backing.hide_viewport = False
    intact_volume.hide_render = False
    intact_volume.hide_viewport = False
    for shard in shards:
        shard.hide_render = True
        shard.hide_viewport = True
    for node in metadata_nodes:
        node.hide_render = True
        node.hide_viewport = True
    root["runtime_roles_json"] = json.dumps(
        {
            "frame": FRAME_NAME,
            "frameVisual": FRAME_VISUAL_NAME,
            "frameTrim": FRAME_TRIM_NAME,
            "frameBacking": FRAME_BACKING_NAME,
            "intact": INTACT_NAME,
            "intactVolume": INTACT_VOLUME_NAME,
            "archivedSourcePane": ARCHIVED_PANE_NAME,
            "shards": [shard.name for shard in shards],
            "paneContact": CONTACT_NAME,
            "frameSolids": list(frame_collision_bounds(frame_high[2])),
        },
        separators=(",", ":"),
    )
    bpy.ops.file.pack_all()
    resolved["candidate"].parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(resolved["candidate"]), check_existing=False)
    require(PREPARE.digest(resolved["baseline"]) == baseline_sha, "Dense master mutated")

    report = {
        "schema": "cloudway-frosted-scroll-wall-semantic-candidate/v1",
        "assetId": ASSET,
        "status": "semantic candidate prepared; runtime integration pending visual acceptance",
        "source": {
            "denseMaster": baseline_report["packedBlend"],
            "denseDonor": baseline_report["source"],
            "denseMasterUnchangedAfterBuild": True,
            "sourceTriangles": len(source_triangles),
            "sourceVertices": len(source_positions),
            "topologyReduction": False,
            "fullResolutionMapsPacked": True,
        },
        "coordinates": {
            "authoring": "Blender Z-up",
            "runtime": "glTF +Y up, X horizontal, Z depth",
            "root": "centred pane floor",
            "donorOriginalPaneFloorBlenderZMetres": DONOR_PANE_FLOOR_Z,
            "runtimePaneFloorBlenderZMetres": 0.0,
            "persistentFrameBelowRootMetres": round(-frame_low[2], 9),
        },
        "classification": {
            "method": "exact source triangles with any vertex inside the expanded centred arched portal",
            "marginMetres": PORTAL_CLASSIFICATION_MARGIN,
            "frameTriangles": frame_faces,
            "archivedPaneTriangles": pane_faces,
            "sumMatchesSource": frame_faces + pane_faces == len(source_triangles),
            "sourceFacesCut": False,
            "archivedPaneNode": ARCHIVED_PANE_NAME,
            "archivedPaneExcludedFromRuntime": True,
        },
        "roles": {
            "root": ROOT_NAME,
            "frame": {
                "node": FRAME_NAME,
                "visualNode": FRAME_VISUAL_NAME,
                "trimNode": FRAME_TRIM_NAME,
                "backingNode": FRAME_BACKING_NAME,
                "material": materials["frame"].name,
                "boundsYUpMetres": frame_bounds_y_up,
                "persistent": True,
                "providerTopologyPreserved": True,
            },
            "intact": {
                "node": INTACT_NAME,
                "volumeNode": INTACT_VOLUME_NAME,
                "outline": {
                    "width": GEOMETRY.PANE_WIDTH,
                    "height": GEOMETRY.PANE_HEIGHT,
                    "shoulderHeight": GEOMETRY.PANE_SHOULDER_HEIGHT,
                    "archRise": GEOMETRY.PANE_ARCH_RISE,
                    "depth": GEOMETRY.PANE_DEPTH,
                },
                "boundsYUpMetres": {
                    "min": [-GEOMETRY.PANE_WIDTH * 0.5, 0.0, -GEOMETRY.PANE_HALF_DEPTH],
                    "max": [GEOMETRY.PANE_WIDTH * 0.5, GEOMETRY.PANE_HEIGHT, GEOMETRY.PANE_HALF_DEPTH],
                },
                "closedAudit": pane_audit,
                "providerPaneDetailArchived": True,
                "sharedPaneUv": "frost_wall_pane_uv",
            },
            "shards": {
                "prefix": SHARD_PREFIX,
                "nodes": [shard.name for shard in shards],
                "count": len(shards),
                "closed": True,
                "bevelMetres": GEOMETRY.SHARD_BEVEL,
                "restFootprintAreaSquareMetres": round(sum(cell_areas), 9),
                "paneFootprintAreaSquareMetres": round(pane_area, 9),
                "audits": shard_audits,
                "sharedPaneUv": "frost_wall_pane_uv",
            },
            "paneContact": {
                "node": CONTACT_NAME,
                "boundsYUpMetres": {
                    "min": [-GEOMETRY.PANE_WIDTH * 0.5, 0.0, -GEOMETRY.PANE_HALF_DEPTH],
                    "max": [GEOMETRY.PANE_WIDTH * 0.5, GEOMETRY.PANE_HEIGHT, GEOMETRY.PANE_HALF_DEPTH],
                },
            },
            "frameSolids": frame_collision_bounds(frame_high[2]),
        },
        "materials": {
            "frame": materials["frame"].name,
            "archivedProviderPane": materials["detail"].name,
            "innerTrim": materials["innerTrim"].name,
            "frameBacking": materials["frameBacking"].name,
            "glassSurface": materials["glass"].name,
            "glassCutEdge": materials["edge"].name,
            "runtimeTextureSizing": "pending matched 2K/4K comparison",
            "sharedSurfaceMaps": {
                "baseColor": PREPARE.file_record(
                    resolved["surfaceBaseColor"], (4096, 4096)
                ),
                "metallic": PREPARE.file_record(
                    resolved["surfaceMetallic"], (4096, 4096)
                ),
                "mapping": "one pane-space UV layout shared by intact volume and every shard",
            },
        },
        "candidateBlend": PREPARE.file_record(resolved["candidate"]),
        "proofs": logical_records(proof_rows),
        "rebuild": (
            "rtk proxy timeout 1200 env ALSOFT_DRIVERS=null /usr/bin/blender "
            "--background --factory-startup --python-exit-code 1 --python "
            "art/glass-adventure/cloudway-laboratory/v1/production/"
            "prepare_frosted_scroll_wall_semantic_candidate.py"
        ),
    }
    PREPARE.durable_json(resolved["sourceReport"], report)
    PREPARE.durable_json(resolved["mirrorReport"], report)
    print(
        "FROST_WALL_CANDIDATE="
        + json.dumps(
            {
                "candidate": report["candidateBlend"],
                "frameTriangles": frame_faces,
                "archivedPaneTriangles": pane_faces,
                "shards": len(shards),
                "proofs": len(proof_rows),
            },
            separators=(",", ":"),
        )
    )


if __name__ == "__main__":
    main()
