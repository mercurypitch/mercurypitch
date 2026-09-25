#!/usr/bin/env python3
"""Build a source-preserving Rose Quartz glass and framework candidate."""

from __future__ import annotations

import bmesh
import importlib.util
import json
from pathlib import Path
from typing import Any

import bpy
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
VISUALS = load_module(
    "cloudway_rose_crackle_candidate_visuals",
    HERE / "rose_crackle_candidate_visuals.py",
)
SOURCE = PREPARE.SOURCE
ASSET = "rose-quartz-crackle-fast"
ROOT_NAME = "Cloudway_RoseQuartzCrackleFast_SemanticCandidate"
SOURCE_ROOT_NAME = "Cloudway_RoseQuartzCrackleFast_DenseMaster"
SOURCE_REVIEW_NAME = f"{ASSET}__normalized_review"
CRYSTAL_NAME = "RoseCrystalBody"
FRAMEWORK_NAME = "RoseGoldFramework"
CONTACT_NAME = "RoseContactPlane"
SHARD_ROOT_NAME = "RoseShardCandidate"
CONTACT_EXTENT = 1.64
CONTACT_TOP_Z = 0.0
SHARD_BOTTOM_Z = -0.244
SHARD_TOP_Z = -0.004
CORNER_THRESHOLD_SOURCE = 0.76
PROOF_VIEWS = ("game-camera", "close")


def paths() -> dict[str, Path]:
    asset_dir = SOURCE / "blender" / ASSET
    proof_dir = SOURCE / "proofs" / "blender" / ASSET / "semantic-candidate"
    production_dir = SOURCE / "production" / ASSET
    return {
        "baseline": asset_dir / f"{ASSET}-dense-master.blend",
        "baselineReport": HERE / "reports" / f"{ASSET}-dense-master.json",
        "feasibility": HERE / "reports" / f"{ASSET}-crackle-feasibility.json",
        "maskReport": HERE / "reports" / f"{ASSET}-gold-mask.json",
        "mask": production_dir / "rose-gold-mask-v1.png",
        "reference": SOURCE / "references" / f"{ASSET}.png",
        "candidate": asset_dir / f"{ASSET}-semantic-candidate.blend",
        "proofDir": proof_dir,
        "report": production_dir / "semantic-candidate-report.json",
        "mirror": HERE / "reports" / f"{ASSET}-semantic-candidate.json",
    }


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def collection(name: str, parent: bpy.types.Collection | None = None) -> bpy.types.Collection:
    result = bpy.data.collections.new(name)
    (parent.children if parent is not None else bpy.context.scene.collection.children).link(
        result
    )
    return result


def link_only(obj: bpy.types.Object, target: bpy.types.Collection) -> None:
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    target.objects.link(obj)


def clear_old_proof_stage() -> None:
    for obj in list(bpy.data.objects):
        if obj.name.startswith("Cloudway proof") or obj.name.startswith(
            "Cloudway_Proof"
        ):
            bpy.data.objects.remove(obj, do_unlink=True)
    for current in list(bpy.data.collections):
        if current.name.startswith("Cloudway_Proof"):
            bpy.data.collections.remove(current)


def weld_exact_source_mesh(source: bpy.types.Mesh) -> tuple[bpy.types.Mesh, dict[str, int]]:
    mesh = source.copy()
    mesh.name = "RoseCrystalBodyGeometry"
    before_vertices = len(mesh.vertices)
    before_polygons = len(mesh.polygons)
    edit = bmesh.new()
    edit.from_mesh(mesh)
    bmesh.ops.remove_doubles(edit, verts=list(edit.verts), dist=1e-9)
    edit.to_mesh(mesh)
    edit.free()
    mesh.update()
    mesh.calc_loop_triangles()
    require(len(mesh.vertices) == 259_335, "Rose exact-position weld count changed")
    require(len(mesh.loop_triangles) == 518_742, "Rose source triangles changed")
    mesh["sourceGeometry"] = "dense donor surface"
    mesh["sourceTopologyChange"] = "exact-position seam weld only"
    mesh["decimated"] = False
    return mesh, {
        "sourceVertices": before_vertices,
        "weldedVertices": len(mesh.vertices),
        "coincidentSeamVerticesWelded": before_vertices - len(mesh.vertices),
        "sourcePolygons": before_polygons,
        "candidateTriangles": len(mesh.loop_triangles),
        "newSurfaceTriangles": 0,
        "capTriangles": 0,
    }


def add_corner_attribute(mesh: bpy.types.Mesh) -> dict[str, Any]:
    positions = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
    mesh.vertices.foreach_get("co", positions)
    positions = positions.reshape((-1, 3))
    corner_values = np.zeros(len(mesh.polygons), dtype=np.float32)
    selected_area = 0.0
    for polygon in mesh.polygons:
        centre = positions[np.asarray(polygon.vertices, dtype=np.int32)].mean(axis=0)
        if (
            abs(float(centre[0])) >= CORNER_THRESHOLD_SOURCE
            and abs(float(centre[1])) >= CORNER_THRESHOLD_SOURCE
        ):
            corner_values[polygon.index] = 1.0
            selected_area += float(polygon.area)
    attribute = mesh.attributes.get("rose_corner_region")
    if attribute is not None:
        mesh.attributes.remove(attribute)
    attribute = mesh.attributes.new("rose_corner_region", "FLOAT", "FACE")
    attribute.data.foreach_set("value", corner_values)
    selected = int((corner_values > 0.5).sum())
    require(selected > 0, "Geometry-space corner audit selected no faces")
    return {
        "method": "face-centroid source-space corner quadrants",
        "thresholdAbsoluteSourceXY": CORNER_THRESHOLD_SOURCE,
        "selectedFaces": selected,
        "selectedSourceArea": round(selected_area, 9),
        "guardrail": (
            "The corner region preserves complete provider appearance, including "
            "ivory inlay and dark recesses; it is not inferred from metallic pixels."
        ),
    }


def object_with_material(
    name: str,
    mesh: bpy.types.Mesh,
    material: bpy.types.Material,
    target: bpy.types.Collection,
    matrix_world: Any,
) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, mesh)
    target.objects.link(obj)
    obj.matrix_world = matrix_world.copy()
    if len(mesh.materials) == 0:
        mesh.materials.append(material)
    obj.material_slots[0].link = "OBJECT"
    obj.material_slots[0].material = material
    return obj


def clip_polygon(
    polygon: list[tuple[float, float]],
    normal_x: float,
    normal_y: float,
    limit: float,
) -> list[tuple[float, float]]:
    if not polygon:
        return []
    result: list[tuple[float, float]] = []
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


def voronoi_cells() -> list[tuple[tuple[float, float], list[tuple[float, float]]]]:
    seeds = [
        (-0.61, -0.58),
        (-0.22, -0.55),
        (0.22, -0.59),
        (0.60, -0.48),
        (-0.58, -0.14),
        (-0.15, -0.12),
        (0.29, -0.10),
        (0.61, 0.02),
        (-0.59, 0.43),
        (-0.22, 0.50),
        (0.20, 0.39),
        (0.58, 0.52),
    ]
    half = CONTACT_EXTENT * 0.5
    rectangle = [(-half, -half), (half, -half), (half, half), (-half, half)]
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
        cells.append((seed, polygon))
    return cells


def prism_mesh(name: str, polygon: list[tuple[float, float]]) -> bpy.types.Mesh:
    count = len(polygon)
    vertices = [
        (x, y, SHARD_BOTTOM_Z) for x, y in polygon
    ] + [(x, y, SHARD_TOP_Z) for x, y in polygon]
    faces: list[list[int]] = [
        list(reversed(range(count))),
        list(range(count, count * 2)),
    ]
    for index in range(count):
        following = (index + 1) % count
        faces.append([index, following, following + count, index + count])
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    require(not mesh.validate(verbose=False), f"{name} failed mesh validation")
    return mesh


def create_shards(
    parent: bpy.types.Object,
    target: bpy.types.Collection,
    material: bpy.types.Material,
) -> list[bpy.types.Object]:
    shards = []
    for index, (_seed, polygon) in enumerate(voronoi_cells()):
        mesh = prism_mesh(f"RoseShardGeometry_{index:02d}", polygon)
        obj = bpy.data.objects.new(f"RoseCrystalShard_{index:02d}", mesh)
        target.objects.link(obj)
        obj.parent = parent
        obj.data.materials.append(material)
        obj["role"] = "closed-crystal-shard-candidate"
        obj["sourceGeometry"] = "new authored Voronoi prism"
        obj["closed"] = True
        obj.hide_render = True
        obj.hide_viewport = True
        shards.append(obj)
    return shards


def create_contact_plane(
    parent: bpy.types.Object, target: bpy.types.Collection
) -> bpy.types.Object:
    half = CONTACT_EXTENT * 0.5
    mesh = bpy.data.meshes.new("RoseContactPlaneGeometry")
    mesh.from_pydata(
        [(-half, -half, 0.0), (half, -half, 0.0), (half, half, 0.0), (-half, half, 0.0)],
        [],
        [[0, 1, 2, 3]],
    )
    mesh.update()
    obj = bpy.data.objects.new(CONTACT_NAME, mesh)
    target.objects.link(obj)
    obj.parent = parent
    obj["role"] = "walkable-contact-plane"
    obj["widthMetres"] = CONTACT_EXTENT
    obj["depthMetres"] = CONTACT_EXTENT
    obj["topBlenderZ"] = CONTACT_TOP_Z
    obj["sourceGeometry"] = "new gameplay contract geometry"
    obj.display_type = "WIRE"
    obj.hide_render = True
    obj.hide_viewport = True
    return obj


def main() -> None:
    resolved = paths()
    baseline_report = json.loads(resolved["baselineReport"].read_text())
    feasibility = json.loads(resolved["feasibility"].read_text())
    mask_report = json.loads(resolved["maskReport"].read_text())
    baseline_sha = baseline_report["packedBlend"]["sha256"]
    require(PREPARE.digest(resolved["baseline"]) == baseline_sha, "Dense master changed")
    require(PREPARE.digest(resolved["mask"]) == mask_report["output"]["sha256"], "Gold mask changed")
    require(
        feasibility["geometry"]["exactPositionWeldAudit"]["edgeIncidence"][
            "closedOrientedTwoManifold"
        ],
        "Feasibility audit no longer proves an exact-weld closed source",
    )
    bpy.ops.wm.open_mainfile(filepath=str(resolved["baseline"]), load_ui=False)
    clear_old_proof_stage()
    source_root = bpy.data.objects.get(SOURCE_ROOT_NAME)
    source_review = bpy.data.objects.get(SOURCE_REVIEW_NAME)
    require(source_root is not None and source_review is not None, "Dense source hierarchy missing")
    source_root["candidateUse"] = "hidden exact provider reference"
    candidate_collection = collection("Cloudway_Rose_Semantic_Candidate")
    root = bpy.data.objects.new(ROOT_NAME, None)
    candidate_collection.objects.link(root)
    root["assetId"] = ASSET
    root["status"] = "visual semantic candidate; runtime integration pending acceptance"
    root["coordinates"] = "Blender Z-up; walkable contact plane Z=0"
    root["sourceMasterSha256"] = baseline_sha
    root["sourceTopologyMutation"] = False
    root["candidateDecimation"] = False
    root["semanticContract"] = "crystal body, gold framework, contact plane, shard candidate"
    welded_mesh, weld_record = weld_exact_source_mesh(source_review.data)
    corner_record = add_corner_attribute(welded_mesh)
    images = VISUALS.source_images(resolved["mask"])
    materials = {
        "composite": VISUALS.composite_material(
            "RoseCrystalAndFramework_CompositeReview", images
        ),
        "framework": VISUALS.framework_material(
            "RoseGoldFramework_ProviderPBR", images
        ),
        "compositeDiagnostic": VISUALS.composite_material(
            "RoseCrystalAndFramework_MaskDiagnostic", images, True
        ),
    }
    crystal = object_with_material(
        CRYSTAL_NAME,
        welded_mesh,
        materials["composite"],
        candidate_collection,
        source_review.matrix_world,
    )
    crystal.parent = root
    crystal["role"] = "closed-crystal-body"
    crystal["sourceGeometry"] = "dense donor surface after exact seam weld"
    crystal["glassTransmissionAuthored"] = True
    framework = object_with_material(
        FRAMEWORK_NAME,
        welded_mesh,
        materials["framework"],
        candidate_collection,
        source_review.matrix_world,
    )
    framework.parent = root
    framework["role"] = "persistent-gold-framework"
    framework["includes"] = "UV-masked top/side lattice plus geometry-audited full corners"
    framework["sourceGeometry"] = "dense donor surface; shader-visible semantic region"
    framework["glassTransmissionAuthored"] = False
    contact = create_contact_plane(root, candidate_collection)
    shard_collection = collection("Cloudway_Rose_Shard_Candidate", candidate_collection)
    shard_root = bpy.data.objects.new(SHARD_ROOT_NAME, None)
    shard_collection.objects.link(shard_root)
    shard_root.parent = root
    shard_root["role"] = "closed-crystal-shard-set-candidate"
    shard_root["sourceGeometry"] = "new authored volumes"
    shards = create_shards(
        shard_root,
        shard_collection,
        VISUALS.shard_material(SHARD_TOP_Z - SHARD_BOTTOM_Z),
    )
    proof_collection = collection("Cloudway_Rose_Proof_Stage")
    scene, camera, board = VISUALS.create_proof_stage(PREPARE, proof_collection)
    source_review.hide_render = True
    source_review.hide_viewport = True
    source_root.hide_render = False
    source_review["candidateUse"] = "exact provider PBR proof only"
    proof_files = VISUALS.render_modes(
        PREPARE,
        PROOF_VIEWS,
        scene,
        camera,
        board,
        resolved["proofDir"],
        source_review,
        crystal,
        framework,
        shards,
        materials,
    )
    crystal.hide_render = False
    crystal.hide_viewport = False
    framework.hide_render = True
    framework.hide_viewport = False
    contact.hide_render = True
    contact.hide_viewport = True
    source_review.hide_render = True
    source_review.hide_viewport = True
    board.hide_render = False
    for shard in shards:
        shard.hide_render = True
        shard.hide_viewport = True
    bpy.ops.file.pack_all()
    resolved["candidate"].parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(resolved["candidate"]), check_existing=False)
    require(PREPARE.digest(resolved["baseline"]) == baseline_sha, "Dense master mutated")
    report = {
        "schema": "cloudway-rose-crackle-semantic-candidate/v1",
        "assetId": ASSET,
        "status": "visual candidate; runtime and course integration prohibited pending acceptance",
        "source": {
            "denseMaster": baseline_report["packedBlend"],
            "reference": PREPARE.file_record(resolved["reference"]),
            "denseMasterUnchangedAfterBuild": True,
            "fullPbrMapsPacked": True,
            "decimation": False,
        },
        "semanticMask": {
            "report": PREPARE.logical_path(resolved["maskReport"]),
            "file": mask_report["output"],
            "cornerGeometryAudit": corner_record,
            "acceptance": (
                "Combined UV and geometry mask is a candidate only; the proof renders "
                "must be reviewed before any runtime metadata is authored."
            ),
        },
        "roles": {
            "crystalBody": {
                "object": CRYSTAL_NAME,
                "closedSourceSurface": True,
                "sourcePreserved": True,
                "topology": weld_record,
                "material": materials["composite"].name,
            },
            "goldFramework": {
                "object": FRAMEWORK_NAME,
                "includes": "top lattice, side lattice, studs, complete corner assemblies",
                "sourcePreserved": True,
                "geometryCut": False,
                "newCaps": 0,
                "restState": "bound in the composite material without co-planar overlap",
                "fractureState": "separate masked framework object becomes visible",
                "material": materials["framework"].name,
            },
            "contactPlane": {
                "object": CONTACT_NAME,
                "sourcePreserved": False,
                "newGeometry": True,
                "dimensionsMetres": [CONTACT_EXTENT, CONTACT_EXTENT],
                "topBlenderZ": CONTACT_TOP_Z,
                "sourceRayEvidence": feasibility["surface"]["verticalRayAudit"],
            },
            "shards": {
                "root": SHARD_ROOT_NAME,
                "sourcePreserved": False,
                "newGeometry": True,
                "count": len(shards),
                "verticalExtentMetres": [SHARD_BOTTOM_Z, SHARD_TOP_Z],
                "footprintMetres": [CONTACT_EXTENT, CONTACT_EXTENT],
                "closed": True,
                "use": "fracture-shape candidate only",
            },
        },
        "candidateBlend": PREPARE.file_record(resolved["candidate"]),
        "proofMethod": {
            "cameras": [
                "48-degree-field-of-view game camera",
                "fixed close inspection camera",
            ],
            "transmissionWitness": "checker field beneath the candidate",
            "beauty": (
                "same cameras, pastel-sky field, 512 Eevee samples, no spatial "
                "blur or ornament smoothing"
            ),
        },
        "proofs": VISUALS.proof_records(PREPARE, proof_files),
        "rebuild": [
            "python art/glass-adventure/cloudway-laboratory/v1/production/author_rose_crackle_mask.py",
            "blender -b --python art/glass-adventure/cloudway-laboratory/v1/production/prepare_rose_crackle_semantic_candidate.py",
        ],
    }
    PREPARE.durable_json(resolved["report"], report)
    PREPARE.durable_json(resolved["mirror"], report)
    print(
        "ROSE_CANDIDATE="
        + json.dumps(
            {
                "candidate": report["candidateBlend"],
                "proofs": len(report["proofs"]),
                "weld": weld_record,
                "corners": corner_record,
            },
            separators=(",", ":"),
        )
    )


if __name__ == "__main__":
    main()
