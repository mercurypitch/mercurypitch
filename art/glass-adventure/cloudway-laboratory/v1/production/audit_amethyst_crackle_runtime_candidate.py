#!/usr/bin/env python3
"""Fresh-open audit the Amethyst hybrid hierarchy, geometry, and metadata contract."""

from __future__ import annotations

from collections import Counter
import importlib.util
import json
from math import isfinite
from pathlib import Path
import sys
from typing import Any, Iterable

import bpy
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


PREPARE = load_module("cloudway_prepare_dense_master_audit", HERE / "prepare_dense_master.py")
BUILD = load_module(
    "cloudway_prepare_amethyst_runtime_candidate_audit",
    HERE / "prepare_amethyst_crackle_runtime_candidate.py",
)
GEOMETRY = BUILD.GEOMETRY
VISUALS = BUILD.VISUALS
SOURCE = PREPARE.SOURCE


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def mesh_audit(mesh: bpy.types.Mesh) -> dict[str, Any]:
    require(len(mesh.vertices) > 0 and len(mesh.polygons) > 0, f"{mesh.name} is empty")
    require(
        all(isfinite(float(value)) for vertex in mesh.vertices for value in vertex.co),
        f"{mesh.name} has non-finite positions",
    )
    incidence: Counter[tuple[int, int]] = Counter()
    directed: Counter[tuple[int, int]] = Counter()
    for polygon in mesh.polygons:
        vertices = list(polygon.vertices)
        for index, start in enumerate(vertices):
            end = vertices[(index + 1) % len(vertices)]
            incidence[tuple(sorted((start, end)))] += 1
            directed[(start, end)] += 1
    boundary = sum(count == 1 for count in incidence.values())
    non_manifold = sum(count != 2 for count in incidence.values())
    orientation_errors = 0
    for a, b in incidence:
        if incidence[(a, b)] == 2 and not (directed[(a, b)] == 1 and directed[(b, a)] == 1):
            orientation_errors += 1
    mesh.calc_loop_triangles()
    signed_volume = 0.0
    for triangle in mesh.loop_triangles:
        a, b, c = (mesh.vertices[index].co for index in triangle.vertices)
        signed_volume += float(a.dot(b.cross(c))) / 6.0
    minimum, maximum = GEOMETRY.mesh_bounds(mesh)
    return {
        "vertices": len(mesh.vertices),
        "polygons": len(mesh.polygons),
        "triangles": len(mesh.loop_triangles),
        "uniqueEdges": len(incidence),
        "boundaryEdges": boundary,
        "nonTwoFaceEdges": non_manifold,
        "orientationMismatchEdges": orientation_errors,
        "signedVolume": round(signed_volume, 12),
        "closedOriented": non_manifold == 0 and orientation_errors == 0,
        "bounds": {
            "min": [round(float(value), 9) for value in minimum],
            "max": [round(float(value), 9) for value in maximum],
        },
    }


def only_object(name: str) -> bpy.types.Object:
    matches = [obj for obj in bpy.data.objects if obj.name == name]
    require(len(matches) == 1, f"Expected one exact object named {name}; found {len(matches)}")
    return matches[0]


def descendants(root: bpy.types.Object) -> list[bpy.types.Object]:
    result = []
    pending = list(root.children)
    while pending:
        current = pending.pop()
        result.append(current)
        pending.extend(current.children)
    return result


def material_names(objects: Iterable[bpy.types.Object]) -> set[str]:
    return {
        slot.material.name
        for obj in objects
        if obj.type == "MESH"
        for slot in obj.material_slots
        if slot.material is not None
    }


def exact_child(root: bpy.types.Object, name: str) -> bpy.types.Object:
    matches = [child for child in root.children if child.name == name]
    require(len(matches) == 1, f"{name} must be one direct child of {root.name}")
    return matches[0]


def audit_contact(contact: bpy.types.Object) -> dict[str, Any]:
    require(contact.type == "MESH", "Contact node must own the reference rectangle")
    require(len(contact.data.vertices) == 4 and len(contact.data.polygons) == 1, "Contact is not one rectangle")
    require(len(contact.material_slots) == 0, "Contact must not render ornamental material")
    coordinates = sorted(
        (round(vertex.co.x, 6), round(vertex.co.y, 6), round(vertex.co.z, 6))
        for vertex in contact.data.vertices
    )
    expected = sorted(
        [
            (-0.82, -0.55, 0.0),
            (-0.82, 0.55, 0.0),
            (0.82, -0.55, 0.0),
            (0.82, 0.55, 0.0),
        ]
    )
    require(coordinates == expected, "Contact rectangle is not exact 1.64 x 1.10m at Z=0")
    require(contact.hide_render and contact.hide_viewport, "Contact reference became visible")
    return {"vertices": coordinates, "rendered": not contact.hide_render}


def audit_shard(root: bpy.types.Object, expected_name: str) -> dict[str, Any]:
    require(root.name == expected_name, f"Unexpected shard root {root.name}")
    require(root.parent is not None and root.parent.name == BUILD.ROOT_NAME, f"{root.name} parent changed")
    children = [child for child in root.children if child.type == "MESH"]
    require(len(children) == 2, f"{root.name} must own glass and provider-detail mesh children")
    glass = [child for child in children if material_names([child]) == {VISUALS.GLASS_MATERIAL}]
    details = [child for child in children if material_names([child]) == {VISUALS.DETAIL_MATERIAL}]
    require(len(glass) == 1 and len(details) == 1, f"{root.name} shard material roles changed")
    geometry = glass[0]
    surface_detail = details[0]
    topology = mesh_audit(geometry.data)
    surface_topology = mesh_audit(surface_detail.data)
    require(topology["closedOriented"], f"{root.name} is not a closed oriented manifold")
    require(not surface_topology["closedOriented"], f"{root.name} provider surface detail became a volume")
    require(surface_detail.get("collision") is False, f"{root.name} surface detail became collision")
    require(len(surface_detail.data.uv_layers) > 0, f"{root.name} surface detail lost provider UVs")
    require(
        topology["signedVolume"] > 1e-8,
        f"{root.name} must have positive outward volume in right-handed local space",
    )
    minimum = Vector(topology["bounds"]["min"])
    maximum = Vector(topology["bounds"]["max"])
    require((minimum + maximum).length < 3e-6, f"{root.name} origin is not the local AABB centre")
    require(all(abs(value) < 1e-8 for value in root.rotation_euler), f"{root.name} is not assembled unrotated")
    return {
        "root": root.name,
        "geometry": geometry.name,
        "surfaceDetail": surface_detail.name,
        "assembledTranslationBlenderZUp": [round(float(value), 9) for value in root.location],
        "topology": topology,
        "surfaceDetailTopology": surface_topology,
    }


def main() -> None:
    resolved = BUILD.paths()
    report = json.loads(resolved["mirror"].read_text())
    baseline_report = json.loads(resolved["baselineReport"].read_text())
    require(PREPARE.digest(resolved["baseline"]) == baseline_report["packedBlend"]["sha256"], "Dense master hash changed")
    require(PREPARE.digest(resolved["candidate"]) == report["candidateBlend"]["sha256"], "Candidate hash differs from report")
    bpy.ops.wm.open_mainfile(filepath=str(resolved["candidate"]), load_ui=False)

    root = only_object(BUILD.ROOT_NAME)
    require(root.parent is None, "Runtime asset root must be top-level")
    require(
        root.location.length <= 1e-9
        and root.rotation_euler.to_matrix().is_identity
        and all(abs(float(value) - 1) <= 1e-9 for value in root.scale),
        "Runtime asset root transform is not identity",
    )
    require("cloudway_lab_platform_json" not in root, "Obsolete lab-only metadata key remains")
    require("platform_adapter_json" in root, "Authoritative platform_adapter_json is missing")
    metadata = json.loads(root["platform_adapter_json"])
    require(metadata == BUILD.platform_metadata(), "platform_adapter_json differs from frozen crackle contract")
    collider = json.loads(root["collider_json"])
    expected_collider = {
        "shape": "box",
        "width": 1.64,
        "depth": 1.10,
        "height": 0.25,
        "topY": 0,
        "center": [0, -0.125, 0],
    }
    require(collider == expected_collider, "collider_json differs from strict box schema")

    persistent = exact_child(root, BUILD.PERSISTENT_NAME)
    intact = exact_child(root, BUILD.INTACT_NAME)
    contact = exact_child(root, BUILD.CONTACT_NAME)
    shard_names = [f"{BUILD.SHARD_PREFIX}{index:03d}" for index in range(18)]
    shards = [exact_child(root, name) for name in shard_names]
    actual_prefixed = sorted(obj.name for obj in bpy.data.objects if obj.name.startswith(BUILD.SHARD_PREFIX))
    require(actual_prefixed == shard_names, "Shard prefix roots are not exactly contiguous 000..017")
    expected_root_children = {BUILD.PERSISTENT_NAME, BUILD.INTACT_NAME, BUILD.CONTACT_NAME, *shard_names}
    require({child.name for child in root.children} == expected_root_children, "Runtime root has unexpected direct children")

    persistent_materials = material_names(descendants(persistent))
    require(
        persistent_materials
        == {
            VISUALS.FRAMEWORK_MATERIAL,
            VISUALS.CORNER_MATERIAL,
        },
        "Persistent material bindings changed",
    )
    intact_materials = material_names(descendants(intact))
    require(
        intact_materials
        == {
            VISUALS.GLASS_MATERIAL,
            VISUALS.DETAIL_MATERIAL,
            VISUALS.ACCENT_MATERIAL,
        },
        "Intact material bindings changed",
    )
    shell = only_object("AmethystRuntimeCrystalShell")
    detail = only_object("AmethystRuntimeSourceIntactBody")
    accent = only_object("AmethystRuntimeLuminousAccents")
    corner_detail = only_object("AmethystRuntimeSourceCornerFiligree")
    require(detail.parent == intact, "Exact provider exterior must vanish with the intact role")
    require(material_names([detail]) == {VISUALS.DETAIL_MATERIAL}, "Provider exterior material changed")
    require(detail.get("collision") is False, "Provider exterior became collision geometry")
    require(len(detail.data.uv_layers) > 0, "Provider exterior lost archived UVs")
    require(accent.parent == intact, "Luminous accent must vanish with the intact role")
    require(material_names([accent]) == {VISUALS.ACCENT_MATERIAL}, "Accent material changed")
    require(corner_detail.parent == persistent, "Source corner detail must remain persistent")
    require(
        material_names([corner_detail]) == {VISUALS.CORNER_MATERIAL},
        "Source corner provider-PBR binding changed",
    )
    require(corner_detail.get("collision") is False, "Source corner detail became collision geometry")
    require(len(corner_detail.data.uv_layers) > 0, "Source corner detail lost provider UVs")
    shell_topology = mesh_audit(shell.data)
    detail_topology = mesh_audit(detail.data)
    corner_topology = mesh_audit(corner_detail.data)
    require(shell_topology["closedOriented"], "Authored glass shell is not closed and oriented")
    require(shell_topology["signedVolume"] > 1e-8, "Authored glass shell has non-positive volume")
    require(not corner_topology["closedOriented"], "Source corner decoration unexpectedly became a closed shell")
    source_review = only_object(BUILD.SOURCE_REVIEW_NAME)
    require(
        detail_topology["polygons"] + corner_topology["polygons"]
        == len(source_review.data.polygons),
        "Intact body and persistent corner cutout do not partition every donor face",
    )
    require(
        max(
            float(shard.location.z + vertex.co.z)
            for shard in shards
            for child in shard.children
            if material_names([child]) == {VISUALS.GLASS_MATERIAL}
            for vertex in child.data.vertices
        )
        <= -0.0274,
        "Closed shard glass reaches the retained donor exterior",
    )

    shard_audits = [audit_shard(shard, name) for shard, name in zip(shards, shard_names)]
    require(
        sum(row["surfaceDetailTopology"]["polygons"] for row in shard_audits)
        == detail_topology["polygons"],
        "Shard provider details do not partition every intact exterior face exactly once",
    )
    image_failures = []
    for proof in report["proofs"]:
        absolute = resolved["proofDir"] / Path(proof["file"]).name
        if not absolute.exists() or PREPARE.digest(absolute) != proof["sha256"]:
            image_failures.append(proof["file"])
    require(not image_failures, f"Proof files changed or vanished: {image_failures}")

    audit = {
        "schema": "cloudway-amethyst-crackle-runtime-hybrid-audit/v1",
        "assetId": BUILD.ASSET,
        "status": "fresh-open candidate audit passed; runtime acceptance tracked separately",
        "candidate": PREPARE.file_record(resolved["candidate"]),
        "denseMasterSha256": baseline_report["packedBlend"]["sha256"],
        "metadata": metadata,
        "collider": collider,
        "contact": audit_contact(contact),
        "materials": {
            "persistent": sorted(persistent_materials),
            "intact": sorted(intact_materials),
        },
        "geometry": {
            "shell": shell_topology,
            "internalDetail": detail_topology,
            "sourceCornerDetail": corner_topology,
            "shards": shard_audits,
        },
        "proofHashesVerified": len(report["proofs"]),
        "checks": [
            "authoritative platform_adapter_json only",
            "strict collider_json box schema",
            "exact direct role roots and contiguous 18 shard names",
            "closed oriented inner shell and shard glass volumes",
            "exact dense provider intact exterior preserves archived UVs and remains non-collision",
            "open provider-PBR shard details partition every intact exterior face exactly once",
            "intact body and persistent corner cutout partition every original donor face",
            "open non-collision source corner cutout preserves provider UVs under persistent",
            "provider top lattice hides atomically with the intact exterior",
            "each shard root at its local assembled AABB centre",
            "explicit glass, internal detail, framework, corner detail, and accent material bindings",
            "exact 1.64 x 1.10m non-rendered contact rectangle with no ornament",
            "dense master and proof hashes unchanged",
        ],
    }
    output = HERE / "reports" / f"{BUILD.ASSET}-runtime-hybrid-audit.json"
    source_output = SOURCE / "production" / BUILD.ASSET / "runtime-hybrid-audit.json"
    PREPARE.durable_json(output, audit)
    PREPARE.durable_json(source_output, audit)
    print(
        "AMETHYST_RUNTIME_HYBRID_AUDIT="
        + json.dumps(
            {
                "candidate": audit["candidate"],
                "shards": len(shard_audits),
                "proofs": audit["proofHashesVerified"],
                "status": "passed",
            },
            separators=(",", ":"),
        )
    )


if __name__ == "__main__":
    main()
