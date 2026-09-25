#!/usr/bin/env python3
"""Reopen and audit the packed gilt-scroll semantic derivative."""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
import sys
from typing import Any

import bpy
from mathutils import Matrix
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
FEASIBILITY = load_module(
    "cloudway_scroll_feasibility", HERE / "audit_scroll_separation_feasibility.py"
)
DERIVATIVE = load_module(
    "cloudway_scroll_semantic_derivative", HERE / "prepare_scroll_semantic_derivative.py"
)
SOURCE = PREPARE.SOURCE


def paths() -> dict[str, Path]:
    asset_dir = SOURCE / "blender" / DERIVATIVE.ASSET
    report_dir = SOURCE / "production" / DERIVATIVE.ASSET
    return {
        "candidate": asset_dir / f"{DERIVATIVE.ASSET}-semantic-derivative.blend",
        "report": HERE / "reports" / f"{DERIVATIVE.ASSET}-scroll-semantic-derivative.json",
        "audit": report_dir / "scroll-semantic-derivative-audit.json",
        "auditMirror": HERE / "reports" / f"{DERIVATIVE.ASSET}-scroll-semantic-derivative-audit.json",
    }


def require(condition: bool, message: str) -> None:
    FEASIBILITY.require(condition, message)


def descendants(root: bpy.types.Object) -> list[bpy.types.Object]:
    result: list[bpy.types.Object] = []
    pending = list(root.children)
    while pending:
        current = pending.pop()
        result.append(current)
        pending.extend(current.children)
    return result


def vector_is_zero(vector: Any, tolerance: float = 1e-9) -> bool:
    return all(abs(float(value)) <= tolerance for value in vector)


def vector_is_one(vector: Any, tolerance: float = 1e-9) -> bool:
    return all(abs(float(value) - 1.0) <= tolerance for value in vector)


def cap_audit(mesh: bpy.types.Mesh, role: str) -> dict[str, Any]:
    face_kind = mesh.attributes.get(DERIVATIVE.FACE_KIND)
    require(face_kind is not None, f"{role}: face-kind attribute is absent")
    uvs = FEASIBILITY.corner_uvs(mesh)
    require(np.isfinite(uvs).all(), f"{role}: UVs contain a non-finite value")
    corner_normals = FEASIBILITY.evaluated_corner_normals(mesh)
    require(np.isfinite(corner_normals).all(), f"{role}: normals contain a non-finite value")
    cap_rows: dict[str, dict[str, Any]] = {}
    cap_count = 0
    for polygon in mesh.polygons:
        if int(face_kind.data[polygon.index].value) != DERIVATIVE.FACE_CAP:
            continue
        cap_count += 1
        require(polygon.material_index == 1, f"{role}: a cap does not use material slot 1")
        plane = round(float(mesh.vertices[polygon.vertices[0]].co.y), 6)
        require(
            all(
                abs(float(mesh.vertices[vertex].co.y) - plane)
                <= DERIVATIVE.BOUNDARY_EPSILON
                for vertex in polygon.vertices
            ),
            f"{role}: a cap triangle is not planar",
        )
        row = cap_rows.setdefault(
            str(plane),
            {"sourcePlaneY": plane, "triangles": 0, "polygonNormalYMin": 1.0, "polygonNormalYMax": -1.0},
        )
        row["triangles"] += 1
        row["polygonNormalYMin"] = min(row["polygonNormalYMin"], float(polygon.normal.y))
        row["polygonNormalYMax"] = max(row["polygonNormalYMax"], float(polygon.normal.y))
    require(cap_count > 0, f"{role}: no authored cap triangles")
    for row in cap_rows.values():
        row["polygonNormalYMin"] = round(float(row["polygonNormalYMin"]), 9)
        row["polygonNormalYMax"] = round(float(row["polygonNormalYMax"]), 9)
    return {"capTriangles": cap_count, "planes": cap_rows, "finiteUvs": True, "finiteNormals": True}


def build() -> dict[str, Any]:
    output = paths()
    report = json.loads(output["report"].read_text())
    require(report["status"] == "semantic-derivative-review-required", "Unexpected report status")
    require(
        PREPARE.digest(output["candidate"]) == report["candidateBlend"]["sha256"],
        "Candidate Blend differs from its report",
    )
    bpy.ops.wm.open_mainfile(filepath=str(output["candidate"]), load_ui=False)
    root = bpy.data.objects.get(DERIVATIVE.ROOT_NAME)
    require(root is not None, "Semantic derivative root is absent")
    require(root.type == "EMPTY", "Semantic derivative root is not an Empty")
    require(root.get("runtimeReady") is False, "Candidate incorrectly claims runtime readiness")
    require(
        root.get("platformAdapterJsonPresent") is False,
        "Candidate incorrectly claims adapter metadata",
    )
    require(
        root.get("semanticMaterialSeparationComplete") is False,
        "Candidate incorrectly claims semantic material completion",
    )
    require(
        root.get("rollerIvoryGoldSplitAccepted") is False,
        "Candidate incorrectly claims roller material acceptance",
    )
    require(
        root.get("deckGlassDetailSplitAccepted") is False,
        "Candidate incorrectly claims deck material acceptance",
    )
    require("platform_adapter_json" not in root, "Candidate has forbidden adapter metadata")
    require(
        not any("platform_adapter_json" in obj for obj in bpy.data.objects),
        "A saved object contains platform_adapter_json",
    )

    source_object = bpy.data.objects.get(f"{DERIVATIVE.ASSET}__raw_import")
    review_object = bpy.data.objects.get(f"{DERIVATIVE.ASSET}__normalized_review")
    require(source_object is not None, "Hidden dense source object is absent")
    require(review_object is not None, "Dense review object is absent")
    require(source_object.data is review_object.data, "Dense raw/review no longer share mesh data")
    source = FEASIBILITY.source_payload(source_object.data)
    require(source["fingerprints"] == report["source"]["fingerprints"], "Source channels changed")

    reported_matrix = Matrix(report["axesAndScale"]["candidateBlender"]["sourceToCanonicalMatrix"])
    role_meshes: dict[str, bpy.types.Mesh] = {}
    role_rows: dict[str, Any] = {}
    for role in DERIVATIVE.ROLE_ORDER:
        role_root = bpy.data.objects.get(DERIVATIVE.ROLE_ROOTS[role])
        require(role_root is not None, f"{role}: role root absent")
        require(role_root.parent is root, f"{role}: role root is not a direct child")
        require(role_root.type == "EMPTY", f"{role}: role root is not an Empty")
        require(vector_is_zero(role_root.location), f"{role}: saved location is not zero")
        require(vector_is_zero(role_root.rotation_euler), f"{role}: saved rotation is not zero")
        require(vector_is_one(role_root.scale), f"{role}: saved scale is not one")
        meshful = [obj for obj in descendants(role_root) if obj.type == "MESH"]
        require(len(meshful) == 1, f"{role}: expected one meshful descendant")
        obj = meshful[0]
        require(obj.name == DERIVATIVE.ROLE_OBJECTS[role], f"{role}: mesh object name differs")
        require(
            np.allclose(np.asarray(obj.matrix_local), np.asarray(reported_matrix), atol=1e-6),
            f"{role}: canonical source transform differs",
        )
        mesh = obj.data
        role_meshes[role] = mesh
        materials = [material.name for material in mesh.materials]
        require(
            materials
            == [f"{DERIVATIVE.ASSET}__provider_full_pbr", DERIVATIVE.CAP_MATERIAL_NAME],
            f"{role}: material slots differ",
        )
        channels = DERIVATIVE.derivative_channel_audit(mesh, source)
        require(
            channels["retainedExportedNormalMaxAngleDegrees"] <= 1.0,
            f"{role}: retained exported normal error exceeds one degree",
        )
        closure = DERIVATIVE.welded_closure(mesh)
        caps = cap_audit(mesh, role)
        expected = report["geometry"]["roles"][role]
        require(closure == expected["closure"], f"{role}: closure audit differs from build")
        require(
            channels == expected["channelPreservation"],
            f"{role}: channel audit differs from build",
        )
        require(
            caps["capTriangles"] == expected["channelPreservation"]["authoredCapTriangles"],
            f"{role}: cap count differs from build",
        )
        role_rows[role] = {
            "roleRoot": role_root.name,
            "meshObject": obj.name,
            "materials": materials,
            "channelPreservation": channels,
            "closure": closure,
            "caps": caps,
        }

    scale = float(report["axesAndScale"]["candidateBlender"]["uniformScale"])
    edge_metres = float(report["motion"]["fullyExtendedCutDistanceFromCentreMetres"])
    motion = DERIVATIVE.motion_boundary_audit(role_meshes, reported_matrix, edge_metres)
    require(
        motion == report["geometry"]["motionBoundaryAudit"],
        "Reopened motion-boundary audit differs",
    )
    file_images = [image for image in bpy.data.images if image.source == "FILE"]
    unpacked = [image.name for image in file_images if image.packed_file is None]
    require(not unpacked, f"Candidate contains unpacked file images: {unpacked}")
    require(scale > 0.0, "Candidate scale is not positive")

    audit = {
        "schema": 1,
        "assetId": DERIVATIVE.ASSET,
        "status": "reopen-audit-passed",
        "candidateBlend": PREPARE.file_record(output["candidate"]),
        "sourceFingerprints": source["fingerprints"],
        "hierarchy": {
            "candidateRoot": root.name,
            "roleRootsAreExactDirectChildren": True,
            "oneMeshfulDescendantPerRole": True,
            "savedFullyExtendedWithIdentityRoleTransforms": True,
        },
        "adapterGate": {
            "platformAdapterJsonAbsent": True,
            "runtimeReadyFalse": True,
            "semanticMaterialSeparationCompleteFalse": True,
            "rollerIvoryGoldSplitAcceptedFalse": True,
            "deckGlassDetailSplitAcceptedFalse": True,
        },
        "roles": role_rows,
        "motionBoundaryAudit": motion,
        "packedFileImages": len(file_images),
        "unpackedFileImages": unpacked,
        "sourceRawAndReviewShareMesh": True,
        "tool": {"blender": bpy.app.version_string, "numpy": np.__version__},
        "rebuild": (
            "rtk proxy timeout 1200 env ALSOFT_DRIVERS=null /usr/bin/blender "
            "--background --factory-startup --python-exit-code 1 --python "
            "art/glass-adventure/cloudway-laboratory/v1/production/"
            "audit_scroll_semantic_derivative.py"
        ),
    }
    PREPARE.durable_json(output["audit"], audit)
    PREPARE.durable_json(output["auditMirror"], audit)
    require(
        PREPARE.digest(output["audit"]) == PREPARE.digest(output["auditMirror"]),
        "Reopen audit mirror differs",
    )
    print("CLOUDWAY_SCROLL_DERIVATIVE_AUDIT=" + json.dumps(audit), flush=True)
    return audit


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])
    build()
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
