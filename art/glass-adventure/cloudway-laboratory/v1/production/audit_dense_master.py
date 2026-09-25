#!/usr/bin/env python3
"""Reopen and audit one packed Cloudway dense-source Blender master."""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
import sys
from typing import Any

import bpy
import numpy as np


HERE = Path(__file__).resolve().parent
PREPARE_PATH = HERE / "prepare_dense_master.py"


def load_prepare() -> Any:
    spec = importlib.util.spec_from_file_location("cloudway_prepare_dense_master", PREPARE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load prepare_dense_master.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


PREPARE = load_prepare()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def packed_digest(image: bpy.types.Image) -> str:
    packed = image.packed_file
    if packed is None:
        raise ValueError(f"Image {image.name} is not packed")
    return PREPARE.digest_bytes(memoryview(packed.data))


def audit(asset: str) -> dict[str, Any]:
    config = PREPARE.ASSETS[asset]
    paths = PREPARE.paths_for(asset)
    receipt = PREPARE.load_receipt(asset, paths)
    external_report = json.loads(paths["report"].read_text())
    mirror_report = json.loads(paths["mirror"].read_text())
    require(external_report == mirror_report, f"{asset}: report mirror differs")
    require(external_report.get("assetId") == asset, f"{asset}: report identity changed")
    before_hash = PREPARE.digest(paths["master"])
    require(
        external_report["packedBlend"]["sha256"] == before_hash,
        f"{asset}: packed master hash differs from build report",
    )

    bpy.ops.wm.open_mainfile(filepath=str(paths["master"]), load_ui=False)
    roots = [obj for obj in bpy.data.objects if obj.name == config["root"]]
    require(len(roots) == 1, f"{asset}: expected one semantic root")
    root = roots[0]
    raw = bpy.data.objects.get(f"{asset}__raw_import")
    review = bpy.data.objects.get(f"{asset}__normalized_review")
    raw_collection = bpy.data.collections.get(f"{asset}__raw_source")
    review_collection = bpy.data.collections.get(f"{asset}__review")
    require(raw is not None and raw.type == "MESH", f"{asset}: raw mesh is absent")
    require(
        review is not None and review.type == "MESH",
        f"{asset}: normalized review mesh is absent",
    )
    require(review.parent is root, f"{asset}: review mesh lost its semantic root")
    require(raw.data is review.data, f"{asset}: raw and review no longer share geometry")
    require(raw_collection is not None, f"{asset}: raw source collection is absent")
    require(review_collection is not None, f"{asset}: review collection is absent")
    require(raw.name in raw_collection.objects, f"{asset}: raw mesh left its source collection")
    require(
        review.name in review_collection.objects,
        f"{asset}: review mesh left its review collection",
    )
    require(raw_collection.hide_render, f"{asset}: raw source is no longer render-hidden")
    require(raw_collection.hide_viewport, f"{asset}: raw source is no longer viewport-hidden")
    require(
        root.get("sourceSha256") == receipt["archiveDownload"]["model"]["sha256"],
        f"{asset}: root source hash changed",
    )
    require(
        root.get("sourceTopologyMutation") is False,
        f"{asset}: root claims topology mutation",
    )
    require(
        root.get("glassTransmissionAuthored") is False,
        f"{asset}: source master falsely claims glass",
    )

    positions, triangles = PREPARE.mesh_arrays(raw.data)
    topology = PREPARE.topology_record(positions, triangles)
    expected_topology = external_report["geometry"]
    for field in (
        "vertices",
        "triangles",
        "nonFinitePositionValues",
        "degenerateTriangles",
        "vertexPositionsFloat32Sha256",
        "triangleIndicesInt32Sha256",
    ):
        require(
            topology[field] == expected_topology[field],
            f"{asset}: packed topology changed at {field}",
        )
    del positions, triangles

    material = bpy.data.materials.get(f"{asset}__provider_full_pbr")
    require(material is not None, f"{asset}: provider PBR material is absent")
    require(
        material.get("glassTransmissionAuthored") is False,
        f"{asset}: material falsely claims glass",
    )
    require(len(raw.data.materials) == 1, f"{asset}: source mesh material topology changed")
    require(raw.data.materials[0] is material, f"{asset}: source mesh lost provider PBR material")
    require(len(review.material_slots) == 1, f"{asset}: review material topology changed")
    require(
        review.material_slots[0].material is material,
        f"{asset}: review lost provider PBR material",
    )
    expected_maps = {row["role"]: row for row in external_report["appearance"]["maps"]}
    packed_maps = []
    for role in PREPARE.PBR_ROLES:
        image = bpy.data.images.get(f"{asset}__{role}")
        require(image is not None, f"{asset}: packed {role} image is absent")
        expected = expected_maps[role]
        actual_dimensions = [int(image.size[0]), int(image.size[1])]
        actual_hash = packed_digest(image)
        require(actual_dimensions == expected["dimensions"], f"{asset}: {role} dimensions changed")
        require(actual_hash == expected["sha256"], f"{asset}: packed {role} bytes changed")
        expected_space = "sRGB" if role == "base_color" else "Non-Color"
        require(
            image.colorspace_settings.name == expected_space,
            f"{asset}: {role} color space changed",
        )
        packed_maps.append(
            {
                "role": role,
                "name": image.name,
                "dimensions": actual_dimensions,
                "sha256": actual_hash,
                "colorSpace": image.colorspace_settings.name,
                "packed": True,
            }
        )

    proof_rows = []
    for mode in ("clay", "pbr"):
        for view in PREPARE.VIEWS:
            expected = external_report["proofs"]["views"][mode][view]
            proof = PREPARE.SOURCE / expected["file"].removeprefix("source-assets/")
            require(proof.is_file(), f"{asset}: proof {mode}/{view} is absent")
            require(
                PREPARE.digest(proof) == expected["sha256"],
                f"{asset}: proof {mode}/{view} changed",
            )
            proof_rows.append(
                {
                    "mode": mode,
                    "view": view,
                    **PREPARE.file_record(proof, PREPARE.RESOLUTION),
                }
            )

    after_hash = PREPARE.digest(paths["master"])
    require(after_hash == before_hash, f"{asset}: reopening changed packed master bytes")
    report = {
        "schema": 1,
        "assetId": asset,
        "status": "passed fresh packed-master reopen audit",
        "scope": (
            "Structural, topology, packed-map, proof-hash, and non-mutation checks. "
            "This does not certify runtime cost, motion, collision, fracture, or "
            "transparent glass."
        ),
        "packedBlend": {
            **PREPARE.file_record(paths["master"]),
            "reopenMutatedFile": False,
        },
        "sourceSha256": root["sourceSha256"],
        "topology": topology,
        "rawAndReviewShareMeshData": raw.data is review.data,
        "objectMaterialTopology": {
            "semanticRoot": root.name,
            "rawObject": raw.name,
            "reviewObject": review.name,
            "meshData": raw.data.name,
            "material": material.name,
            "materialSlots": len(raw.data.materials),
            "rawSourceHidden": raw_collection.hide_render and raw_collection.hide_viewport,
        },
        "packedMaps": packed_maps,
        "proofs": proof_rows,
        "limitationsRetained": {
            "opaqueProviderPbr": True,
            "semanticPartSeparation": False,
            "runtimeReadiness": False,
        },
        "tool": {"blender": bpy.app.version_string, "numpy": np.__version__},
        "command": (
            "rtk proxy timeout 1200 env ALSOFT_DRIVERS=null /usr/bin/blender "
            "--background --factory-startup --python-exit-code 1 --python "
            "art/glass-adventure/cloudway-laboratory/v1/production/"
            f"audit_dense_master.py -- --asset {asset}"
        ),
    }
    PREPARE.durable_json(paths["audit"], report)
    PREPARE.durable_json(paths["auditMirror"], report)
    print("CLOUDWAY_DENSE_MASTER_AUDIT=" + json.dumps(report), flush=True)
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--asset", choices=sorted(PREPARE.ASSETS), required=True)
    arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    args = parser.parse_args(arguments)
    audit(args.asset)
    bpy.ops.wm.quit_blender()


if __name__ == "__main__":
    main()
