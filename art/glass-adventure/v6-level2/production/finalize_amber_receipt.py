"""Freeze the approved Amber proof receipt and immutable binary inventory."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "exports" / "amber-cadence-urn-fracture-v2.json"
INVENTORY = ROOT / "exports" / "amber-cadence-urn-binary-inventory-v2.json"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def entry(relative: str) -> dict[str, object]:
    path = ROOT / relative
    return {"file": relative, "bytes": path.stat().st_size, "sha256": digest(path)}


def main() -> None:
    manifest = json.loads(MANIFEST.read_text())
    soft = entry("proofs/amber-cadence-urn-soft-v2.png")
    manifest["proofs"]["softIntactReview"] = soft
    manifest["proofs"]["visualReview"] = {
        "status": "approved",
        "decision": "The standard cavity/shard proofs and softer-light intact proof were approved for runtime integration with the coherent donor atlas normal-map strength fixed at 0.35.",
        "reviewScope": "Silhouette, open mouth, cavity read, fragment read, coherent materials, and absence of objectionable normal-map faceting under representative softer light.",
    }
    manifest["status"] = (
        "geometry and GLB reimport gates passed; Blender proofs approved; runtime integration pending"
    )
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")

    lineage = [
        "concepts/amber-cadence-urn.png",
        "meshy/amber-cadence-urn-donor.glb",
        "sources/amber-cadence-urn-normalized-v1.blend",
        "exports/amber-cadence-urn-game-v1.glb",
        "proofs/amber-cadence-urn-normalized.png",
    ]
    approved = [
        "sources/amber-cadence-urn-cavity-v2.blend",
        "sources/amber-cadence-urn-fracture-v2.blend",
        "exports/amber-cadence-urn-fracture-v2.glb",
        "proofs/amber-cadence-urn-intact-v2.png",
        "proofs/amber-cadence-urn-mouth-v2.png",
        "proofs/amber-cadence-urn-shards-v2.png",
        "proofs/amber-cadence-urn-soft-v2.png",
        "sources/amber-cadence-urn-fracture-work-v2/cavity-input.npz",
        "sources/amber-cadence-urn-fracture-work-v2/cavity-output.npz",
        "sources/amber-cadence-urn-fracture-work-v2/cut-input.npz",
        "sources/amber-cadence-urn-fracture-work-v2/cut-output.npz",
    ]
    inventory = {
        "schema": 1,
        "assetId": "amber-cadence-urn",
        "status": "V2 geometry/GLB gates passed and Blender proofs approved; runtime integration remains external",
        "runtimeContract": {
            "bundle": entry("exports/amber-cadence-urn-fracture-v2.glb"),
            "displayHeightMetres": 0.72,
            "root": "breakable_l2_low_amber_urn",
            "intact": "breakable_l2_low_amber_urn_intact",
            "shardPrefix": "breakable_l2_low_amber_urn_shard_",
            "shardCount": 16,
            "collider": "COLLIDER_breakable_l2_low_amber_urn",
            "materials": {
                "exterior": "amber_shell",
                "cavity": "cavity_surface",
                "fractureCuts": "glass_cut",
                "normalMapStrength": 0.35,
                "strategy": "coherent opaque donor PBR atlas; no triangle-level glass/opaque split",
            },
        },
        "immutableLineage": [entry(path) for path in lineage],
        "approvedV2": {
            "status": "proof-approved production derivative; gameplay behavior remains an integration concern",
            "files": [entry(path) for path in approved],
        },
        "textSourcesAndReceipts": [
            "concepts/amber-cadence-urn.prompt.txt",
            "meshy/amber-cadence-urn-request.json",
            "exports/amber-cadence-urn-inventory.json",
            "exports/amber-cadence-urn-cavity-v2.json",
            "exports/amber-cadence-urn-fracture-v2.json",
            "exports/amber-cadence-urn-fracture-validation-v2.json",
            "production/amber-repair-probe.json",
            "production/amber-normal-audit.json",
            "production/amber_repair_probe.py",
            "production/amber_normal_audit.py",
            "production/render_amber_soft_review.py",
            "production/finalize_amber_receipt.py",
            "finalize_vessels.py",
            "vessel_cavity_backend.py",
            "inspect_vessels.py",
            "sources/amber-cadence-urn-fracture-work-v2/cavity-output.json",
            "sources/amber-cadence-urn-fracture-work-v2/cut-output.json",
        ],
        "excludedScratch": [
            "sources/amber-cadence-urn-normalized-v1.blend1",
            "__pycache__/**",
            "*.pyc",
            "*.log",
            "/tmp/amber-cadence-urn-soft-no-normal-v2.png",
        ],
        "creditSpend": {"thisFinishingPass": 0},
    }
    INVENTORY.write_text(json.dumps(inventory, indent=2) + "\n")
    print(
        "AMBER_RECEIPT_FROZEN="
        + json.dumps(
            {
                "bundleSha256": inventory["runtimeContract"]["bundle"]["sha256"],
                "approvedBinaryCount": len(inventory["approvedV2"]["files"]),
                "inventory": str(INVENTORY.relative_to(ROOT)),
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
