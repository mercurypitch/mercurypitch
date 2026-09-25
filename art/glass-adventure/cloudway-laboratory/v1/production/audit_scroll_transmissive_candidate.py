#!/usr/bin/env python3
"""Reopen and independently audit the gilt scroll transmissive-deck candidate."""

from __future__ import annotations

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


CANDIDATE = load_module(
    "cloudway_scroll_transmissive_candidate",
    HERE / "prepare_scroll_transmissive_candidate.py",
)
PREPARE = CANDIDATE.PREPARE
SEMANTIC = CANDIDATE.SEMANTIC
FEASIBILITY = CANDIDATE.FEASIBILITY
SOURCE = PREPARE.SOURCE
ASSET = CANDIDATE.ASSET


def paths() -> dict[str, Path]:
    output = CANDIDATE.paths()
    report_dir = SOURCE / "production" / ASSET
    return {
        **output,
        "audit": report_dir / "scroll-transmissive-deck-candidate-audit.json",
        "auditMirror": HERE / "reports" / f"{ASSET}-scroll-transmissive-deck-candidate-audit.json",
    }


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def socket_value(shader: bpy.types.Node, name: str) -> float:
    socket = shader.inputs.get(name)
    require(socket is not None, f"Glass shader is missing {name}")
    return float(socket.default_value)


def audit() -> dict[str, Any]:
    output = paths()
    report = json.loads(output["mirror"].read_text())
    require(report["status"] == "planar-transmissive-deck-candidate-review-required", "Candidate report status differs")
    candidate_sha = PREPARE.digest(output["candidate"])
    require(candidate_sha == report["candidateBlend"]["sha256"], "Candidate Blend differs from its report")
    require(PREPARE.digest(output["source"]) == report["sourceCheckpoint"]["blend"]["sha256"], "Semantic source checkpoint changed")

    bpy.ops.wm.open_mainfile(filepath=str(output["candidate"]), load_ui=False)
    root = bpy.data.objects.get(CANDIDATE.ROOT_NAME)
    require(root is not None, "Candidate root is absent")
    require("platform_adapter_json" not in root, "Candidate must not contain adapter metadata")
    require(root.get("runtimeReady") is False, "Candidate must remain runtime-blocked")
    require(root.get("platformAdapterJsonPresent") is False, "Adapter gate flag differs")
    require(root.get("glassMaterialAccepted") is False, "Review candidate was incorrectly accepted")
    require(root.get("supportColliderCertified") is False, "Collider was incorrectly certified")
    require(root.get("authoredPlanarGlassInset") is True, "Planar inset flag is absent")
    require(root.get("sourceDeckGeometryReused") is False, "Rejected source deck was reused")

    role_roots = {
        role: bpy.data.objects.get(name)
        for role, name in SEMANTIC.ROLE_ROOTS.items()
    }
    require(all(value is not None for value in role_roots.values()), "A semantic role root is absent")
    require(all(value.parent == root for value in role_roots.values()), "Role roots are not direct root children")

    provider = bpy.data.materials.get(CANDIDATE.PROVIDER_MATERIAL)
    require(provider is not None, "Provider PBR is absent")
    roller_rows: dict[str, Any] = {}
    for name in CANDIDATE.ROLLER_OBJECTS:
        roller = bpy.data.objects.get(name)
        require(roller is not None and roller.type == "MESH", f"{name} is absent")
        require(len(roller.data.materials) >= 1 and roller.data.materials[0] == provider, f"{name}: mixed provider PBR is not retained")
        fingerprint = CANDIDATE.mesh_fingerprint(roller.data)
        require(fingerprint == report["roleGeometry"]["rollerFingerprintsAfter"][name], f"{name}: geometry differs")
        roller_rows[name] = {
            "materialSlots": [material.name for material in roller.data.materials],
            "fingerprint": fingerprint,
            "providerPbrPreserved": True,
        }

    deck = bpy.data.objects.get(CANDIDATE.DECK_OBJECT)
    require(deck is not None and deck.type == "MESH", "Deck geometry is absent")
    require(deck.get("authoredPlanarGlassInset") is True, "Deck is not the authored planar inset")
    require(deck.get("sourceDeckGeometryReused") is False, "Deck incorrectly claims source reuse")
    require(len(deck.data.materials) == 1, "Deck must have one candidate glass material")
    glass = deck.data.materials[0]
    require(glass is not None and glass.name == CANDIDATE.GLASS_MATERIAL, "Deck glass material differs")
    inset_audit = CANDIDATE.planar_inset_audit(deck)
    require(inset_audit == report["roleGeometry"]["planarInsetAudit"], "Planar inset audit differs")
    deck_fingerprint = inset_audit["fingerprint"]
    closure = inset_audit["closure"]
    z_range = [
        float(inset_audit["canonicalBoundsMetres"]["min"][2]),
        float(inset_audit["canonicalBoundsMetres"]["max"][2]),
    ]
    thickness = z_range[1] - z_range[0]
    require(abs(thickness - report["roleGeometry"]["planarInsetSpecification"]["dimensionsMetres"][2]) <= 1e-8, "Deck thickness differs")

    source_reference = bpy.data.objects.get(CANDIDATE.SOURCE_DECK_REFERENCE_OBJECT)
    require(source_reference is not None and source_reference.type == "MESH", "Source deck review reference is absent")
    require(source_reference.hide_render and source_reference.hide_viewport, "Source deck reference is not hidden")
    require(source_reference.get("reviewReferenceOnly") is True, "Source deck reference lacks review flag")
    require(source_reference.get("excludeFromRuntime") is True, "Source deck reference lacks runtime exclusion")
    source_reference_fingerprint = CANDIDATE.mesh_fingerprint(source_reference.data)
    require(source_reference_fingerprint == report["roleGeometry"]["sourceRoleFingerprints"][CANDIDATE.DECK_OBJECT], "Source deck reference changed")

    nodes = glass.node_tree.nodes
    shader = nodes.get("Candidate Principled")
    volume = nodes.get("Pale cyan glass absorption")
    require(shader is not None and volume is not None, "Candidate glass nodes are incomplete")
    require(abs(socket_value(shader, "Transmission Weight") - 0.985) <= 1e-6, "Glass transmission differs")
    require(abs(socket_value(shader, "IOR") - 1.46) <= 1e-6, "Glass IOR differs")
    require(abs(socket_value(shader, "Roughness") - 0.075) <= 1e-6, "Glass roughness differs")
    image_nodes = [node for node in nodes if node.bl_idname == "ShaderNodeTexImage"]
    image_names = [node.image.name if node.image else None for node in image_nodes]
    require(image_names == [], "Deck glass must not use the fused provider image atlas")
    require(PREPARE.digest(output["normalTexture"]) == report["materials"]["deckGlass"]["sourceNormalTexture"]["sha256"], "Source normal texture differs")

    detail_rows: dict[str, Any] = {}
    for key, name in (("gold", CANDIDATE.GOLD_DETAIL_OBJECT), ("etch", CANDIDATE.ETCH_DETAIL_OBJECT)):
        detail = bpy.data.objects.get(name)
        require(detail is not None and detail.type == "MESH", f"{name} is absent")
        require(detail.parent == role_roots["deck"], f"{name} is not attached to the moving deck role")
        require(detail.get("reviewOnlyDetailLayer") is True and detail.get("nonCollider") is True, f"{name} lacks review-only flags")
        fingerprint = CANDIDATE.detail_fingerprint(detail)
        require(fingerprint == report["materials"]["detailLayers"]["objects"][key], f"{name}: fingerprint differs")
        detail_rows[key] = fingerprint

    card = bpy.data.objects.get("Cloudway_Transmission_Test_Card")
    require(card is not None and card.get("reviewEnvironmentOnly") is True, "Transmission proof card is absent")
    proof_rows: dict[str, dict[str, Any]] = {"source": {}, "candidate": {}}
    for mode in ("source", "candidate"):
        for view in ("three-quarter", "top", "side", "central-detail-closeup"):
            path = output["proofDir"] / f"matched-{mode}-{view}.png"
            require(path.is_file(), f"Missing matched proof {path.name}")
            record = PREPARE.file_record(path, PREPARE.RESOLUTION)
            require(record == report["proofs"][mode][view], f"{path.name}: proof differs from report")
            proof_rows[mode][view] = record
    witness_rows: dict[str, Any] = {}
    for mode in ("source", "candidate"):
        path = output["proofDir"] / f"transmission-witness-{mode}-top.png"
        require(path.is_file(), f"Missing transmission witness {path.name}")
        record = PREPARE.file_record(path, PREPARE.RESOLUTION)
        require(record == report["proofs"]["transmissionWitness"][mode], f"{path.name}: witness differs from report")
        witness_rows[mode] = record

    unpacked = [image.name for image in bpy.data.images if image.source == "FILE" and image.packed_file is None]
    require(not unpacked, f"Candidate has unpacked source images: {unpacked}")
    require(report["materials"]["rollers"]["perPixelSemanticInference"] is False, "Report claims texture inference")
    require(report["materials"]["rollers"]["blanketGoldReplacement"] is False, "Report claims blanket roller gold")
    require(report["materials"]["deckGlass"]["providerBaseColorConnected"] is False, "Deck base color policy differs")
    require(report["materials"]["deckGlass"]["providerMetallicConnected"] is False, "Deck metallic policy differs")
    require(report["materials"]["deckGlass"]["providerRoughnessConnected"] is False, "Deck roughness policy differs")

    result = {
        "schema": 1,
        "assetId": ASSET,
        "status": "reopen-audit-passed",
        "scope": "Fresh-process audit of the separate transmissive-deck review candidate; no runtime acceptance is conferred.",
        "candidateBlend": PREPARE.file_record(output["candidate"]),
        "sourceCheckpoint": PREPARE.file_record(output["source"]),
        "hierarchy": {
            "root": root.name,
            "roleRootsDirectChildren": True,
            "detailLayersMoveWithDeck": True,
            "platformAdapterJsonPresent": False,
        },
        "geometry": {
            "rollerFingerprintsMatchReport": True,
            "sourceDeckReferenceFingerprintMatchesReport": True,
            "sourceDeckReferenceHidden": True,
            "planarInset": inset_audit,
            "deckCanonicalZRangeMetres": [round(value, 9) for value in z_range],
            "deckClosedThicknessMetres": round(thickness, 9),
            "detailLayers": detail_rows,
        },
        "materials": {
            "rollerRows": roller_rows,
            "rollerProviderPbrPreserved": True,
            "deckGlassMaterial": glass.name,
            "transmissionWeight": socket_value(shader, "Transmission Weight"),
            "ior": socket_value(shader, "IOR"),
            "roughness": socket_value(shader, "Roughness"),
            "providerImageNodesOnDeckGlass": image_names,
            "providerNormalConnected": False,
            "unpackedFileImages": unpacked,
            "semanticPixelClassificationUsed": False,
        },
        "proofs": {**proof_rows, "transmissionWitness": witness_rows},
        "gates": {
            "runtimeReady": False,
            "materialCandidateAccepted": False,
            "supportColliderCertified": False,
            "runtimeGlbProduced": False,
        },
        "tool": {"blender": bpy.app.version_string, "numpy": np.__version__},
        "rerun": (
            "rtk proxy flock -w 1200 /tmp/glass-cloudway-blender.lock timeout 1200 "
            "env ALSOFT_DRIVERS=null /usr/bin/blender --background --factory-startup "
            "--python-exit-code 1 --python "
            "art/glass-adventure/cloudway-laboratory/v1/production/audit_scroll_transmissive_candidate.py"
        ),
    }
    PREPARE.durable_json(output["audit"], result)
    PREPARE.durable_json(output["auditMirror"], result)
    require(PREPARE.digest(output["audit"]) == PREPARE.digest(output["auditMirror"]), "Audit mirror differs")
    return result


if __name__ == "__main__":
    print(json.dumps(audit(), indent=2))
