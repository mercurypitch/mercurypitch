#!/usr/bin/env python3
"""Reopen-audit the Rose Quartz semantic candidate without mutating it."""

from __future__ import annotations

import bmesh
import importlib.util
import json
import math
from pathlib import Path
from typing import Any

import bpy


HERE = Path(__file__).resolve().parent
ASSET = "rose-quartz-crackle-fast"
ROOT_NAME = "Cloudway_RoseQuartzCrackleFast_SemanticCandidate"
CRYSTAL_NAME = "RoseCrystalBody"
FRAMEWORK_NAME = "RoseGoldFramework"
CONTACT_NAME = "RoseContactPlane"
SHARD_ROOT_NAME = "RoseShardCandidate"
MASK_IMAGE_NAME = "rose-quartz-crackle-fast__gold_semantic_mask_v1"
EXPECTED_VERTICES = 259_335
EXPECTED_TRIANGLES = 518_742
EXPECTED_EDGES = 778_113
EXPECTED_SHARDS = 12
CONTACT_EXTENT = 1.64
SHARD_BOTTOM_Z = -0.244
SHARD_TOP_Z = -0.004


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load {path.name}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


PREPARE = load_module("cloudway_prepare_dense_master", HERE / "prepare_dense_master.py")
SOURCE = PREPARE.SOURCE


def paths() -> dict[str, Path]:
    asset_dir = SOURCE / "blender" / ASSET
    production_dir = SOURCE / "production" / ASSET
    return {
        "baseline": asset_dir / f"{ASSET}-dense-master.blend",
        "candidate": asset_dir / f"{ASSET}-semantic-candidate.blend",
        "candidateReport": HERE / "reports" / f"{ASSET}-semantic-candidate.json",
        "mask": production_dir / "rose-gold-mask-v1.png",
        "report": production_dir / "semantic-candidate-audit.json",
        "mirror": HERE / "reports" / f"{ASSET}-semantic-candidate-audit.json",
    }


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def require_close(actual: float, expected: float, message: str) -> None:
    require(math.isclose(actual, expected, rel_tol=0.0, abs_tol=1e-6), message)


def object_named(name: str) -> bpy.types.Object:
    result = bpy.data.objects.get(name)
    require(result is not None, f"Missing object {name}")
    return result


def finite_mesh(mesh: bpy.types.Mesh) -> bool:
    return all(
        math.isfinite(component)
        for vertex in mesh.vertices
        for component in vertex.co
    )


def manifold_record(mesh: bpy.types.Mesh) -> dict[str, Any]:
    mesh.calc_loop_triangles()
    require(finite_mesh(mesh), f"{mesh.name} has non-finite positions")
    edit = bmesh.new()
    edit.from_mesh(mesh)
    incidence: dict[int, int] = {}
    non_contiguous = 0
    for edge in edit.edges:
        count = len(edge.link_faces)
        incidence[count] = incidence.get(count, 0) + 1
        if count == 2 and not edge.is_contiguous:
            non_contiguous += 1
    record = {
        "vertices": len(mesh.vertices),
        "edges": len(edit.edges),
        "polygons": len(mesh.polygons),
        "triangles": len(mesh.loop_triangles),
        "edgeFaceIncidence": {str(key): incidence[key] for key in sorted(incidence)},
        "orientationMismatches": non_contiguous,
        "closedOrientedTwoManifold": incidence == {2: len(edit.edges)}
        and non_contiguous == 0,
        "finitePositions": True,
    }
    edit.free()
    return record


def role_record(
    obj: bpy.types.Object,
    role: str,
    hidden_render: bool,
) -> dict[str, Any]:
    require(obj.get("role") == role, f"{obj.name} role changed")
    require(obj.hide_render is hidden_render, f"{obj.name} rest render state changed")
    require(obj.type == "MESH", f"{obj.name} is not a mesh")
    require(len(obj.material_slots) == 1, f"{obj.name} material binding is ambiguous")
    material = obj.material_slots[0].material
    require(material is not None, f"{obj.name} material is missing")
    return {
        "object": obj.name,
        "role": role,
        "mesh": obj.data.name,
        "material": material.name,
        "hiddenRenderAtRest": obj.hide_render,
        "hiddenViewportAtRest": obj.hide_viewport,
    }


def audit_contact(contact: bpy.types.Object) -> dict[str, Any]:
    require(contact.get("role") == "walkable-contact-plane", "Contact role changed")
    require(contact.type == "MESH", "Contact plane is not a mesh")
    require(contact.hide_render and contact.hide_viewport, "Contact plane is visible")
    coordinates = [contact.matrix_world @ vertex.co for vertex in contact.data.vertices]
    xs = [float(position.x) for position in coordinates]
    ys = [float(position.y) for position in coordinates]
    zs = [float(position.z) for position in coordinates]
    require(len(coordinates) == 4, "Contact plane vertex count changed")
    require(all(math.isfinite(value) for value in xs + ys + zs), "Contact plane is non-finite")
    require_close(max(xs) - min(xs), CONTACT_EXTENT, "Contact width changed")
    require_close(max(ys) - min(ys), CONTACT_EXTENT, "Contact depth changed")
    require_close(min(zs), 0.0, "Contact bottom is not the authored top")
    require_close(max(zs), 0.0, "Contact top moved")
    return {
        "object": contact.name,
        "role": "walkable-contact-plane",
        "mesh": contact.data.name,
        "hiddenRenderAtRest": contact.hide_render,
        "hiddenViewportAtRest": contact.hide_viewport,
        "dimensionsMetres": [max(xs) - min(xs), max(ys) - min(ys)],
        "topBlenderZ": max(zs),
        "finitePositions": True,
    }


def audit_shards(root: bpy.types.Object) -> dict[str, Any]:
    require(root.get("role") == "closed-crystal-shard-set-candidate", "Shard root role changed")
    shards = sorted(
        (obj for obj in bpy.data.objects if obj.name.startswith("RoseCrystalShard_")),
        key=lambda obj: obj.name,
    )
    require(len(shards) == EXPECTED_SHARDS, "Shard count changed")
    names = [f"RoseCrystalShard_{index:02d}" for index in range(EXPECTED_SHARDS)]
    require([obj.name for obj in shards] == names, "Shard names changed")
    bounds_min = [math.inf, math.inf, math.inf]
    bounds_max = [-math.inf, -math.inf, -math.inf]
    topology = []
    for shard in shards:
        require(shard.parent is root, f"{shard.name} left the shard root")
        require(shard.get("role") == "closed-crystal-shard-candidate", f"{shard.name} role changed")
        require(shard.hide_render and shard.hide_viewport, f"{shard.name} is visible at rest")
        record = manifold_record(shard.data)
        require(record["closedOrientedTwoManifold"], f"{shard.name} is not closed and oriented")
        topology.append(record)
        for vertex in shard.data.vertices:
            position = shard.matrix_world @ vertex.co
            for axis in range(3):
                bounds_min[axis] = min(bounds_min[axis], float(position[axis]))
                bounds_max[axis] = max(bounds_max[axis], float(position[axis]))
    expected_half = CONTACT_EXTENT * 0.5
    require_close(bounds_min[0], -expected_half, "Shard set minimum X changed")
    require_close(bounds_max[0], expected_half, "Shard set maximum X changed")
    require_close(bounds_min[1], -expected_half, "Shard set minimum Y changed")
    require_close(bounds_max[1], expected_half, "Shard set maximum Y changed")
    require_close(bounds_min[2], SHARD_BOTTOM_Z, "Shard set bottom changed")
    require_close(bounds_max[2], SHARD_TOP_Z, "Shard set top changed")
    return {
        "root": root.name,
        "count": len(shards),
        "names": names,
        "allClosedOrientedTwoManifold": True,
        "boundsBlenderXYZ": {"min": bounds_min, "max": bounds_max},
        "totalVertices": sum(record["vertices"] for record in topology),
        "totalTriangles": sum(record["triangles"] for record in topology),
        "sourceGeometry": "new authored Voronoi prisms",
    }


def audit_proofs(report: dict[str, Any]) -> list[dict[str, Any]]:
    records = []
    for expected in report["proofs"]:
        logical = Path(expected["file"])
        path = (
            SOURCE / logical.relative_to("source-assets")
            if logical.parts[0] == "source-assets"
            else PREPARE.REPO / logical
        )
        require(path.exists(), f"Missing proof {expected['file']}")
        require(PREPARE.digest(path) == expected["sha256"], f"Proof changed: {expected['file']}")
        image = bpy.data.images.load(str(path), check_existing=False)
        dimensions = [int(image.size[0]), int(image.size[1])]
        bpy.data.images.remove(image)
        require(dimensions == expected["dimensions"], f"Proof dimensions changed: {expected['file']}")
        records.append(
            {
                "file": expected["file"],
                "sha256": expected["sha256"],
                "dimensions": dimensions,
            }
        )
    require(len(records) == 13, "Proof set changed")
    return records


def main() -> None:
    resolved = paths()
    candidate_report = json.loads(resolved["candidateReport"].read_text())
    current_file = Path(bpy.data.filepath).resolve()
    require(current_file == resolved["candidate"].resolve(), "Audit did not reopen the candidate")
    candidate_sha = PREPARE.digest(resolved["candidate"])
    require(
        candidate_sha == candidate_report["candidateBlend"]["sha256"],
        "Candidate hash differs from the build report",
    )
    baseline_sha = candidate_report["source"]["denseMaster"]["sha256"]
    require(PREPARE.digest(resolved["baseline"]) == baseline_sha, "Dense master changed")
    mask_sha = candidate_report["semanticMask"]["file"]["sha256"]
    require(PREPARE.digest(resolved["mask"]) == mask_sha, "Authored semantic mask changed")

    root = object_named(ROOT_NAME)
    crystal = object_named(CRYSTAL_NAME)
    framework = object_named(FRAMEWORK_NAME)
    contact = object_named(CONTACT_NAME)
    shard_root = object_named(SHARD_ROOT_NAME)
    require(root.type == "EMPTY", "Semantic candidate root must remain an empty transform")
    require(root.get("sourceMasterSha256") == baseline_sha, "Root source hash changed")
    require(root.get("candidateDecimation") is False, "Candidate claims decimation")
    require(root.get("sourceTopologyMutation") is False, "Candidate claims source mutation")
    require(crystal.parent is root and framework.parent is root and contact.parent is root, "Role parent changed")
    require(crystal.data is framework.data, "Rest body and fracture framework must share the reviewed source surface")

    prohibited_metadata = []
    for block in list(bpy.data.objects) + list(bpy.data.collections) + list(bpy.data.scenes):
        if "platform_adapter_json" in block:
            prohibited_metadata.append(block.name)
    require(not prohibited_metadata, "Candidate contains premature platform_adapter_json metadata")

    crystal_record = role_record(crystal, "closed-crystal-body", False)
    crystal_topology = manifold_record(crystal.data)
    require(crystal_topology["vertices"] == EXPECTED_VERTICES, "Welded source vertex count changed")
    require(crystal_topology["edges"] == EXPECTED_EDGES, "Welded source edge count changed")
    require(crystal_topology["triangles"] == EXPECTED_TRIANGLES, "Source triangle count changed")
    require(crystal_topology["closedOrientedTwoManifold"], "Crystal source is not closed and oriented")
    corner = crystal.data.attributes.get("rose_corner_region")
    require(corner is not None and corner.domain == "FACE", "Corner semantic attribute missing")
    selected_corners = sum(1 for value in corner.data if value.value > 0.5)
    require(
        selected_corners
        == candidate_report["semanticMask"]["cornerGeometryAudit"]["selectedFaces"],
        "Corner semantic region changed",
    )
    crystal_record["topology"] = crystal_topology
    crystal_record["cornerSemanticFaces"] = selected_corners

    framework_record = role_record(framework, "persistent-gold-framework", True)
    require(
        framework_record["material"] == "RoseGoldFramework_ProviderPBR",
        "Framework lost its explicit provider-PBR mask binding",
    )
    require(
        crystal_record["material"] == "RoseCrystalAndFramework_CompositeReview",
        "Crystal rest material binding changed",
    )
    composite = crystal.material_slots[0].material
    require(
        composite.get("crystalColorTreatment")
        == "source base color screened with pale rose; provider roughness retained only on framework",
        "Crystal color or roughness treatment changed",
    )
    mask_image = bpy.data.images.get(MASK_IMAGE_NAME)
    require(mask_image is not None and mask_image.packed_file is not None, "Semantic mask is not packed")
    require(tuple(mask_image.size) == (8192, 8192), "Semantic mask dimensions changed")

    proofs = audit_proofs(candidate_report)
    report = {
        "schema": "cloudway-rose-crackle-semantic-candidate-audit/v1",
        "assetId": ASSET,
        "status": "reopen audit passed; visual and runtime acceptance remain pending",
        "candidateBlend": {
            "file": PREPARE.logical_path(resolved["candidate"]),
            "bytes": resolved["candidate"].stat().st_size,
            "sha256": candidate_sha,
            "reopened": True,
        },
        "sourceIntegrity": {
            "denseMasterSha256": baseline_sha,
            "denseMasterUnchanged": True,
            "semanticMaskSha256": mask_sha,
            "decimation": False,
            "newCapsOnDenseSource": 0,
        },
        "runtimeContract": {
            "platformAdapterMetadataPresent": False,
            "candidateRuntimeBindingPresent": False,
            "acceptanceRequired": True,
        },
        "roles": {
            "crystalBody": crystal_record,
            "goldFramework": framework_record,
            "contactPlane": audit_contact(contact),
            "shards": audit_shards(shard_root),
        },
        "materials": {
            "semanticMaskImage": MASK_IMAGE_NAME,
            "semanticMaskPacked": True,
            "semanticMaskDimensions": [8192, 8192],
            "restCompositeAvoidsCoplanarRoleSurfaces": True,
            "metallicTextureUsedAsSoleClassifier": False,
            "providerRoughnessAppliedToTransmissiveCrystal": False,
        },
        "proofs": proofs,
    }
    PREPARE.durable_json(resolved["report"], report)
    PREPARE.durable_json(resolved["mirror"], report)
    require(PREPARE.digest(resolved["candidate"]) == candidate_sha, "Audit mutated candidate")
    require(PREPARE.digest(resolved["baseline"]) == baseline_sha, "Audit mutated dense master")
    print(
        "ROSE_CANDIDATE_AUDIT="
        + json.dumps(
            {
                "candidateSha256": candidate_sha,
                "sourceTopology": crystal_topology,
                "shards": report["roles"]["shards"],
                "proofs": len(proofs),
            },
            separators=(",", ":"),
        )
    )


if __name__ == "__main__":
    main()
