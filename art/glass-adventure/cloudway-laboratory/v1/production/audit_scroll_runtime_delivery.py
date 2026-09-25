#!/usr/bin/env python3
"""Fresh-open audit for the certified gilt-scroll runtime Blend and GLB."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import sys
from typing import Any

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


DELIVERY = load_module(
    "cloudway_scroll_runtime_delivery",
    HERE / "prepare_scroll_runtime_delivery.py",
)
CANDIDATE = DELIVERY.CANDIDATE
SEMANTIC = DELIVERY.SEMANTIC
PREPARE = DELIVERY.PREPARE


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def close(left: float, right: float, tolerance: float = 1e-6) -> bool:
    return abs(float(left) - float(right)) <= tolerance


def exact_named(name: str) -> bpy.types.Object:
    matches = [obj for obj in bpy.data.objects if obj.name == name]
    require(len(matches) == 1, f"Expected one object named {name}; found {len(matches)}")
    return matches[0]


def ancestors(obj: bpy.types.Object) -> list[str]:
    result: list[str] = []
    cursor = obj.parent
    while cursor is not None:
        result.append(cursor.name)
        cursor = cursor.parent
    return result


def triangle_count(obj: bpy.types.Object) -> int:
    require(obj.type == "MESH", f"{obj.name}: expected mesh")
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def gltf_y_up_bounds(obj: bpy.types.Object) -> dict[str, list[float]]:
    """Record imported Blender world bounds expressed back in glTF +Y-up axes."""
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    converted = [(point.x, point.z, -point.y) for point in points]
    return {
        "min": [
            round(min(point[index] for point in converted), 9) for index in range(3)
        ],
        "max": [
            round(max(point[index] for point in converted), 9) for index in range(3)
        ],
    }


def audit_runtime_blend(
    path: Path, report: dict[str, Any]
) -> dict[str, Any]:
    bpy.ops.wm.open_mainfile(filepath=str(path), load_ui=False)
    root = exact_named(DELIVERY.ROOT_NAME)
    require(root.parent is None, "Runtime Blend root must be top-level")
    require(all(close(value, 0.0) for value in root.location), "Runtime Blend root location differs")
    require(all(close(value, 1.0) for value in root.scale), "Runtime Blend root scale differs")
    collider = json.loads(root["collider_json"])
    adapter = json.loads(root["platform_adapter_json"])
    require(collider == report["supportCertification"]["collider"], "Runtime Blend collider metadata differs")
    require(adapter == report["supportCertification"]["adapter"], "Runtime Blend adapter metadata differs")

    role_rows: dict[str, Any] = {}
    for role_key, role_name in report["roles"].items():
        if role_key == "persistent":
            require(role_name == [], "Runtime Blend persistent roles differ")
            continue
        role = exact_named(role_name)
        require(role.parent == root, f"{role_name}: role is not a direct root child")
        expected_x = 0.0
        if role_key == "negativeRoller":
            expected_x = -DELIVERY.SUPPORT_EDGE_METRES
        elif role_key == "positiveRoller":
            expected_x = DELIVERY.SUPPORT_EDGE_METRES
        require(close(role.location.x, expected_x), f"{role_name}: X anchor differs")
        require(close(role.location.y, 0.0) and close(role.location.z, 0.0), f"{role_name}: off-axis anchor")
        role_rows[role_key] = {
            "name": role.name,
            "locationBlenderZUp": DELIVERY.rounded_vector(role.location),
            "children": sorted(child.name for child in role.children),
        }

    fingerprints = {
        name: DELIVERY.geometry_fingerprint(exact_named(name))
        for name in DELIVERY.MESH_BINDING_KINDS
    }
    require(
        fingerprints == report["geometryPreservation"]["meshFingerprintsAfter"],
        "Fresh-open Runtime Blend mesh fingerprints differ",
    )
    material_rows: dict[str, Any] = {}
    for mesh_name, binding in report["materialBindings"].items():
        obj = exact_named(mesh_name)
        require(len(obj.data.materials) == 1, f"{mesh_name}: expected one material slot")
        material = obj.data.materials[0]
        require(material is not None and material.name == binding["material"], f"{mesh_name}: material differs")
        require(material.use_nodes and material.node_tree is not None, f"{mesh_name}: material nodes absent")
        textures = sorted({
            node.image.name
            for node in material.node_tree.nodes
            if node.bl_idname == "ShaderNodeTexImage" and node.image is not None
        })
        material_rows[mesh_name] = {
            "material": material.name,
            "imageTextures": textures,
        }
    roller_textures = material_rows[CANDIDATE.ROLLER_OBJECTS[0]]["imageTextures"]
    require(
        len(roller_textures) == 4,
        "Runtime Blend roller PBR must retain base color, metallic, normal, and roughness textures",
    )
    require(
        roller_textures == material_rows[CANDIDATE.ROLLER_OBJECTS[1]]["imageTextures"],
        "Roller roles do not share the same source PBR textures",
    )
    packed_images = [
        image.name
        for image in bpy.data.images
        if image.source == "FILE" and image.packed_file is not None
    ]
    require(len(packed_images) >= 4, "Runtime Blend does not pack the source PBR images")
    require(
        bpy.data.objects.get(CANDIDATE.SOURCE_DECK_REFERENCE_OBJECT) is None,
        "Rejected fused relief remains in Runtime Blend",
    )
    return {
        "root": root.name,
        "metadataStrings": {
            "collider_json": root["collider_json"],
            "platform_adapter_json": root["platform_adapter_json"],
        },
        "roles": role_rows,
        "meshFingerprints": fingerprints,
        "materialBindings": material_rows,
        "packedImages": sorted(packed_images),
        "rejectedReliefAbsent": True,
    }


def audit_imported_glb(
    path: Path, report: dict[str, Any]
) -> dict[str, Any]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    result = bpy.ops.import_scene.gltf(filepath=str(path), import_pack_images=True)
    require(result == {"FINISHED"}, "Fresh GLB import failed")
    bpy.context.view_layer.update()
    root = exact_named(DELIVERY.ROOT_NAME)
    require(root.parent is None, "Imported GLB root must be top-level")
    collider = json.loads(root["collider_json"])
    adapter = json.loads(root["platform_adapter_json"])
    require(collider == report["supportCertification"]["collider"], "Imported GLB collider differs")
    require(adapter == report["supportCertification"]["adapter"], "Imported GLB adapter metadata differs")

    role_names = [
        report["roles"]["deck"],
        report["roles"]["negativeRoller"],
        report["roles"]["positiveRoller"],
    ]
    for role_name in role_names:
        exact_named(role_name)
    mesh_rows: dict[str, Any] = {}
    for mesh_name, binding in report["materialBindings"].items():
        obj = exact_named(mesh_name)
        require(obj.type == "MESH", f"{mesh_name}: imported object is not a mesh")
        containing_roles = [name for name in role_names if name in ancestors(obj)]
        require(len(containing_roles) == 1, f"{mesh_name}: expected exactly one semantic role")
        require(len(obj.data.materials) == 1, f"{mesh_name}: imported mesh must use one material")
        material = obj.data.materials[0]
        require(material is not None and material.name == binding["material"], f"{mesh_name}: imported material differs")
        expected_triangles = report["glbInventory"]["meshRows"][mesh_name]["triangles"]
        actual_triangles = triangle_count(obj)
        require(actual_triangles == expected_triangles, f"{mesh_name}: imported triangle count differs")
        mesh_rows[mesh_name] = {
            "role": containing_roles[0],
            "material": material.name,
            "triangles": actual_triangles,
            "boundsGlTfYUp": gltf_y_up_bounds(obj),
        }

    deck_bounds = mesh_rows[CANDIDATE.DECK_OBJECT]["boundsGlTfYUp"]
    require(close(deck_bounds["max"][1], 0.0), "Imported GLB deck top is not y=0")
    require(
        close(deck_bounds["min"][0], -0.384747028)
        and close(deck_bounds["max"][0], 0.384747028),
        "Imported GLB outer glass X bounds differ",
    )
    require(
        close(deck_bounds["min"][2], -1.114981964)
        and close(deck_bounds["max"][2], 1.114981964),
        "Imported GLB outer glass Z bounds differ",
    )
    imported_total = sum(row["triangles"] for row in mesh_rows.values())
    require(imported_total == report["glbInventory"]["totalTriangles"], "Imported GLB total triangle count differs")
    require(
        bpy.data.objects.get(CANDIDATE.SOURCE_DECK_REFERENCE_OBJECT) is None,
        "Rejected fused relief remains in imported GLB",
    )
    return {
        "root": root.name,
        "rootIdentity": {
            "location": DELIVERY.rounded_vector(root.location),
            "rotationQuaternion": DELIVERY.rounded_vector(root.rotation_quaternion),
            "scale": DELIVERY.rounded_vector(root.scale),
        },
        "roleNodes": role_names,
        "meshes": mesh_rows,
        "totalTriangles": imported_total,
        "metadataRoundTrip": True,
        "rejectedReliefAbsent": True,
    }


def audit() -> dict[str, Any]:
    paths = DELIVERY.paths()
    report = json.loads(paths["mirror"].read_text())
    require(PREPARE.digest(paths["candidate"]) == DELIVERY.ACCEPTED_CANDIDATE_SHA256, "Accepted candidate changed")
    require(PREPARE.digest(paths["runtimeGlb"]) == report["bundle"]["sha256"], "Runtime GLB hash differs")
    require(PREPARE.digest(paths["runtimeBlend"]) == report["runtimeBlend"]["sha256"], "Runtime Blend hash differs")
    require(PREPARE.digest(paths["runtimeManifest"]) == PREPARE.digest(paths["mirror"]), "Runtime manifest mirror differs")
    require(PREPARE.digest(paths["report"]) == PREPARE.digest(paths["mirror"]), "Runtime external report mirror differs")
    document, binary = DELIVERY.read_glb(paths["runtimeGlb"])
    require(document.get("asset", {}).get("version") == "2.0" and binary, "Runtime GLB structure differs")

    blend_audit = audit_runtime_blend(paths["runtimeBlend"], report)
    glb_audit = audit_imported_glb(paths["runtimeGlb"], report)
    output = {
        "schema": 1,
        "assetId": DELIVERY.RUNTIME_ID,
        "status": "fresh-open-full-detail-export-audited",
        "runtimeGlb": PREPARE.file_record(paths["runtimeGlb"]),
        "runtimeBlend": PREPARE.file_record(paths["runtimeBlend"]),
        "acceptedCandidate": PREPARE.file_record(paths["candidate"]),
        "plainGlb": {
            "version": document["asset"]["version"],
            "extensionsUsed": document.get("extensionsUsed", []),
            "extensionsRequired": document.get("extensionsRequired", []),
            "externalDependencies": report["glbInventory"]["externalDependencies"],
            "forbiddenGeometryCodecs": report["glbInventory"]["forbiddenGeometryCodecs"],
        },
        "runtimeBlendFreshOpen": blend_audit,
        "runtimeGlbFreshImport": glb_audit,
        "supportCertification": report["supportCertification"],
        "checks": {
            "metadataRoundTrip": True,
            "exactRoleOwnership": True,
            "exactPerMeshMaterialBindings": True,
            "meshAndSourceDetailPreservedInRuntimeBlend": True,
            "sourcePbrTexturesPacked": True,
            "runtimeGlbSelfContained": True,
            "rejectedReliefExcluded": True,
            "acceptedCandidateImmutable": True,
        },
        "tool": {"blender": bpy.app.version_string},
        "remainingGate": "Bounded texture and meshopt delivery derivative plus actual GLTFLoader, adapter, and WebGL renderer proof.",
        "rebuild": (
            "rtk proxy flock -w 1200 /tmp/glass-cloudway-blender.lock timeout 1200 "
            "env ALSOFT_DRIVERS=null /usr/bin/blender --background --factory-startup "
            "--python-exit-code 1 --python "
            "art/glass-adventure/cloudway-laboratory/v1/production/audit_scroll_runtime_delivery.py"
        ),
    }
    external = DELIVERY.SOURCE / "production" / DELIVERY.ASSET / "scroll-runtime-v1-full-detail-audit.json"
    mirror = HERE / "reports" / f"{DELIVERY.ASSET}-runtime-v1-full-detail-audit.json"
    PREPARE.durable_json(external, output)
    PREPARE.durable_json(mirror, output)
    require(PREPARE.digest(external) == PREPARE.digest(mirror), "Audit report mirror differs")
    require(PREPARE.digest(paths["candidate"]) == DELIVERY.ACCEPTED_CANDIDATE_SHA256, "Audit mutated accepted candidate")
    return output


if __name__ == "__main__":
    print(json.dumps(audit(), indent=2))
