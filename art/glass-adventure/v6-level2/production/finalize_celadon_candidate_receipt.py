"""Freeze Celadon source provenance and strict-gate rejection evidence."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
STATUS = ROOT / "exports" / "celadon-lark-decanter-production-status-v2.json"
INVENTORY = ROOT / "exports" / "celadon-lark-decanter-binary-inventory-v2.json"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def entry(relative: str) -> dict[str, object]:
    path = ROOT / relative
    return {"file": relative, "bytes": path.stat().st_size, "sha256": digest(path)}


def source_by_role(report: dict[str, object], role: str) -> dict[str, object]:
    return next(row for row in report["sources"] if row["role"] == role)


def main() -> None:
    regenerated = json.loads(
        (ROOT / "production" / "celadon-regenerated-probe.json").read_text()
    )
    union = json.loads(
        (ROOT / "production" / "celadon-regenerated-union-probe.json").read_text()
    )
    clean_decimate = json.loads(
        (ROOT / "production" / "celadon-clean-decimate-probe.json").read_text()
    )
    manifold = json.loads(
        (ROOT / "production" / "celadon-manifold-simplify-probe.json").read_text()
    )
    voxel = json.loads((ROOT / "production" / "celadon-voxel-probe.json").read_text())

    game = source_by_role(regenerated, "regenerated_game_donor")
    clean = source_by_role(regenerated, "regenerated_pre_remesh")
    provider = source_by_role(regenerated, "provider_remesh_35k_v3")
    status = {
        "schema": 1,
        "assetId": "celadon-lark-decanter",
        "status": "rejected production candidate; no V2 runtime breakable was exported",
        "decision": "Every bounded reduction path violated the strict closed, oriented, self-intersection-free surface gate. Preserve all raw sources and receipts; retain the existing vase representation rather than integrating any attempted V2 derivative.",
        "selectedRuntimeBundle": None,
        "cavityPrepared": False,
        "fracturePrepared": False,
        "visualProofApproved": False,
        "rawSources": {
            "regeneratedTextured12k": game["source"],
            "regeneratedCleanPreRemesh": clean["source"],
            "providerRemesh35k": provider["source"],
        },
        "strictGateEvidence": {
            "regeneratedTextured12k": {
                "report": "production/celadon-regenerated-probe.json",
                "triangles": game["postWeldTopology"]["triangles"],
                "nonManifoldEdges": game["postWeldTopology"]["nonManifoldEdges"],
                "selfIntersectionPairs": game["postWeldTopology"][
                    "selfIntersectionPairs"
                ],
            },
            "regeneratedCleanPreRemesh": {
                "report": "production/celadon-regenerated-probe.json",
                "triangles": clean["postWeldTopology"]["triangles"],
                "nonManifoldEdges": clean["postWeldTopology"]["nonManifoldEdges"],
                "selfIntersectionPairs": clean["postWeldTopology"][
                    "selfIntersectionPairs"
                ],
                "finding": "The only clean surface is too dense for the bounded runtime budget; it remains the preserved source of truth.",
            },
            "providerRemesh35k": {
                "report": "production/celadon-regenerated-probe.json",
                "triangles": provider["postWeldTopology"]["triangles"],
                "nonManifoldEdges": provider["postWeldTopology"]["nonManifoldEdges"],
                "selfIntersectionPairs": provider["postWeldTopology"][
                    "selfIntersectionPairs"
                ],
            },
            "textured12kExactSelfUnion": {
                "report": "production/celadon-regenerated-union-probe.json",
                "triangles": union["after"]["triangles"],
                "nonManifoldEdges": union["after"]["nonManifoldEdges"],
                "selfIntersectionPairs": union["after"]["selfIntersectionPairs"],
                "residueClusters": len(union["residueClusters"]),
                "maximumResidueExtentMetres": union[
                    "residueMaximumExtentMetres"
                ],
            },
            "cleanSourceCollapse": [
                {
                    "targetTriangles": row["targetTriangles"],
                    "report": "production/celadon-clean-decimate-probe.json",
                    "decimatedSelfIntersectionPairs": row["decimatedTopology"][
                        "selfIntersectionPairs"
                    ],
                    "postUnionNonManifoldEdges": row["postUnionTopology"][
                        "nonManifoldEdges"
                    ],
                }
                for row in clean_decimate["candidates"]
            ],
            "manifoldSimplification36k": {
                "report": "production/celadon-manifold-simplify-probe.json",
                "triangles": manifold["reductions"][0]["topology"]["triangles"],
                "nonManifoldEdges": manifold["reductions"][0]["topology"][
                    "nonManifoldEdges"
                ],
                "selfIntersectionPairs": manifold["reductions"][0]["topology"][
                    "selfIntersectionPairs"
                ],
            },
            "rawVoxelSurfaces": [
                {
                    "voxelSizeMetres": row["voxelSizeMetres"],
                    "report": "production/celadon-voxel-probe.json",
                    "triangles": row["voxelTopology"]["triangles"],
                    "nonManifoldEdges": row["voxelTopology"]["nonManifoldEdges"],
                    "selfIntersectionPairs": row["voxelTopology"][
                        "selfIntersectionPairs"
                    ],
                    "freshGlbReimportPassedAfterBoundedFinalization": row[
                        "freshGlbReimportPassed"
                    ],
                    "frontSilhouetteIntersectionOverUnion": row["silhouette"][
                        "front"
                    ]["intersectionOverUnion"],
                    "sideSilhouetteIntersectionOverUnion": row["silhouette"][
                        "side"
                    ]["intersectionOverUnion"],
                }
                for row in voxel["candidates"]
            ],
        },
        "creditSpend": {
            "regenerationImageTo3d": 30,
            "singleProviderNativeRemesh": 5,
            "total": 35,
            "balanceAfter": 4180,
        },
        "providerSafety": {
            "credentialsPersisted": False,
            "signedArtifactUrlsPersisted": False,
            "remeshSource": "provider-owned parent task ID; no local source upload",
        },
        "excludedClaims": [
            "No attempted Celadon derivative is gameplay-ready.",
            "No open cavity, matched fragments, packed production Blend, runtime GLB, or approved Blender proof exists for V2.",
            "A closed topological manifold was not accepted when geometric self-intersections remained.",
        ],
    }
    STATUS.write_text(json.dumps(status, indent=2) + "\n")

    source_files = [
        "concepts/celadon-lark-decanter.png",
        "meshy/celadon-lark-decanter-donor.glb",
        "meshy/celadon-lark-decanter-pre-remesh.glb",
        "meshy/celadon-lark-decanter-remesh-50k.glb",
        "meshy/celadon-lark-decanter-regenerated-v2.glb",
        "meshy/celadon-lark-decanter-regenerated-v2-pre-remesh.glb",
        "meshy/celadon-lark-decanter-remesh-35k-v3.glb",
        "meshy/celadon-lark-decanter-regenerated-v2_textures/base_color.png",
        "meshy/celadon-lark-decanter-regenerated-v2_textures/roughness.png",
        "meshy/celadon-lark-decanter-regenerated-v2_textures/emission.png",
        "meshy/celadon-lark-decanter-regenerated-v2_textures/metallic.png",
        "meshy/celadon-lark-decanter-regenerated-v2_textures/normal.png",
    ]
    legacy_files = [
        "sources/celadon-lark-decanter-normalized-v1.blend",
        "exports/celadon-lark-decanter-game-v1.glb",
        "proofs/celadon-lark-decanter-normalized.png",
    ]
    work_files = [
        "sources/celadon-lark-decanter-reduction-work-v2/reduction-input.npz",
        "sources/celadon-lark-decanter-reduction-work-v2/reduced-33000.npz",
        "sources/celadon-lark-decanter-reduction-work-v2/reduced-36000.npz",
    ]
    inventory = {
        "schema": 1,
        "assetId": "celadon-lark-decanter",
        "status": "Sources and rejection evidence frozen; no approved V2 production derivative",
        "immutableSources": [entry(path) for path in source_files],
        "preexistingUnvalidatedDerivative": {
            "status": "Retained for existing representation only; not promoted by this batch",
            "files": [entry(path) for path in legacy_files],
        },
        "rejectedReductionWork": [entry(path) for path in work_files],
        "textSourcesAndReceipts": [
            "concepts/celadon-lark-decanter.prompt.txt",
            "meshy/celadon-lark-decanter-request.json",
            "meshy/celadon-source-recovery.json",
            "meshy/celadon-remesh-50k-receipt.json",
            "meshy/celadon-lark-decanter-regeneration-v2-request.json",
            "meshy/celadon-lark-decanter-regeneration-v2-receipt.json",
            "meshy/celadon-lark-decanter-remesh-35k-v3-receipt.json",
            "exports/celadon-lark-decanter-inventory.json",
            "exports/celadon-lark-decanter-production-status-v2.json",
            "production/celadon-regenerated-probe.json",
            "production/celadon-regenerated-union-probe.json",
            "production/celadon-clean-decimate-probe.json",
            "production/celadon-union-residue-probe.json",
            "production/celadon-manifold-simplify-probe.json",
            "production/celadon-voxel-probe.json",
            "production/celadon-source-repair-probe.json",
            "production/celadon-textured-union-probe.json",
            "production/celadon-remesh-comparison.json",
            "production/celadon-remesh-defects.json",
            "production/celadon-remesh-repair-trial.json",
            "production/archive_celadon_regeneration.py",
            "production/run_celadon_provider_remesh.py",
            "production/celadon_regenerated_probe.py",
            "production/celadon_regenerated_union_probe.py",
            "production/celadon_clean_decimate_probe.py",
            "production/celadon_union_residue_probe.py",
            "production/celadon_simplify_backend.py",
            "production/celadon_manifold_simplify_probe.py",
            "production/celadon_voxel_probe.py",
            "production/finalize_celadon_candidate_receipt.py",
        ],
        "excludedScratch": ["__pycache__/**", "*.pyc", "*.blend1", "*.log", "/tmp/**"],
        "creditSpend": status["creditSpend"],
    }
    INVENTORY.write_text(json.dumps(inventory, indent=2) + "\n")
    print(
        "CELADON_CANDIDATE_FROZEN="
        + json.dumps(
            {
                "status": status["status"],
                "immutableSources": len(inventory["immutableSources"]),
                "rejectedWorkInputs": len(inventory["rejectedReductionWork"]),
                "creditSpend": status["creditSpend"],
                "statusReceipt": str(STATUS.relative_to(ROOT)),
                "binaryInventory": str(INVENTORY.relative_to(ROOT)),
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
