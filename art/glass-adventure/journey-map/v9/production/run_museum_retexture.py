"""Archive one receipt-guarded Meshy PBR retexture after a V9 clay review."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import importlib.util
import json
from pathlib import Path
import struct
import sys
import time


HERE = Path(__file__).resolve().parent
ART = HERE.parent
REPO = HERE.parents[4]
V7 = ART.parent / "v7"
V8 = ART.parent / "v8"


@dataclass(frozen=True)
class Asset:
    name: str
    asset_id: str
    target_triangles: int
    triangle_tolerance: int
    remesh_receipt: Path
    source: Path
    clay_manifest: Path
    clay_review: Path
    receipt: Path
    output: Path
    incomplete_download: Path
    texture_prompt: str


ASSETS = {
    "temple": Asset(
        name="temple",
        asset_id="floating-museum-temple-v9-candidate",
        target_triangles=90_000,
        triangle_tolerance=8_000,
        remesh_receipt=ART / "meshy" / "temple-remesh-90k-receipt.json",
        source=ART / "meshy" / "temple-remesh-90k.glb",
        clay_manifest=ART / "proofs" / "temple-remesh-review-v9.json",
        clay_review=ART / "proofs" / "temple-remesh-clay-review-v9.json",
        receipt=ART / "meshy" / "temple-remesh-90k-retexture-pbr-receipt.json",
        output=ART / "meshy" / "temple-remesh-90k-retexture-pbr.glb",
        incomplete_download=ART
        / "meshy"
        / "raw"
        / "temple-retexture-native-download-incomplete.glb.part",
        texture_prompt=(
            "Magical floating-museum circular neoclassical temple. Ivory Carrara rotunda, stairs, "
            "fluted columns, arches and classical statue; restrained warm gold ribs, capitals, "
            "trim and finial; deep emerald banners with gold celestial ornament; pale neutral "
            "opaline dome for later amber and teal tint variants; statue holds a small teal orb. "
            "Preserve openings, stairs, dome ribs, statue, drapery and carving as geometry. Clean "
            "PBR, no baked shadows, dirt, opaque painted dome or painted-on geometry."
        ),
    ),
    "cypress": Asset(
        name="cypress",
        asset_id="floating-museum-cypress-v9-candidate",
        target_triangles=20_000,
        triangle_tolerance=4_000,
        remesh_receipt=ART / "meshy" / "cypress-remesh-20k-receipt.json",
        source=ART / "meshy" / "cypress-remesh-20k.glb",
        clay_manifest=ART / "proofs" / "cypress-remesh-review-v9.json",
        clay_review=ART / "proofs" / "cypress-remesh-clay-review-v9.json",
        receipt=ART / "meshy" / "cypress-remesh-20k-retexture-pbr-receipt.json",
        output=ART / "meshy" / "cypress-remesh-20k-retexture-pbr.glb",
        incomplete_download=ART
        / "meshy"
        / "raw"
        / "cypress-retexture-native-download-incomplete.glb.part",
        texture_prompt=(
            "Magical floating-museum Mediterranean cypress topiary in a round ivory Carrara "
            "planter. Dense layered dark emerald foliage with readable rounded clusters, subtle "
            "olive highlights, warm brown trunk glimpses and sparse trailing ivy; fine gray marble "
            "veining and restrained gold rim. Preserve continuous tapered silhouette, branches, "
            "trunk, planter and vines as geometry. Clean PBR, no baked shadows, neon green, dirt "
            "or painted-on geometry."
        ),
    ),
}

KNOWN_V7_BASELINE = {
    "remesh": {
        "taskId": "01a0c93d-d575-745f-9f91-c7206c4bab5d",
        "createdAt": 1_790_082_668_648,
    },
    "retexture": {
        "taskId": "01a0c946-928b-70b7-b8e0-7019de0d936e",
        "createdAt": 1_790_083_241_392,
    },
}


def load_remesh_helpers():
    path = HERE / "run_museum_remesh.py"
    spec = importlib.util.spec_from_file_location("journey_map_v9_remesh_helpers", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


HELPERS = load_remesh_helpers()
now = HELPERS.now
digest = HELPERS.digest
check_glb = HELPERS.check_glb
download_complete = HELPERS.download_complete
safe_status = HELPERS.safe_status
task_rows = HELPERS.task_rows
read_balance = HELPERS.read_balance
load_meshy_pipeline = HELPERS.load_meshy_pipeline


def save(path: Path, receipt: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(receipt, indent=2) + "\n")
    temporary.replace(path)


def triangle_count(path: Path) -> int:
    raw = path.read_bytes()
    json_length, json_type = struct.unpack_from("<II", raw, 12)
    if json_type != 0x4E4F534A:
        raise ValueError(f"{path.name} has no JSON chunk")
    document = json.loads(raw[20 : 20 + json_length].decode("utf-8").rstrip(" \x00"))
    total = 0
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            if int(primitive.get("mode", 4)) != 4:
                raise ValueError("Retexture source contains a non-triangle primitive")
            if "indices" in primitive:
                count = int(document["accessors"][int(primitive["indices"])]["count"])
            else:
                position = int(primitive["attributes"]["POSITION"])
                count = int(document["accessors"][position]["count"])
            if count % 3:
                raise ValueError("Retexture source has an incomplete triangle")
            total += count // 3
    return total


def validate_clay_review(
    asset: Asset, source_sha: str, triangles: int
) -> dict[str, object]:
    if not asset.clay_manifest.is_file() or not asset.clay_review.is_file():
        raise FileNotFoundError(
            f"Hash-bound {asset.name} clay comparison and acceptance are required before PBR"
        )
    manifest = json.loads(asset.clay_manifest.read_text())
    review = json.loads(asset.clay_review.read_text())
    if review.get("decision") != "accepted-for-pbr-retexture":
        raise ValueError(f"The {asset.name} clay review did not accept this remesh")
    if review.get("source", {}).get("sha256") != source_sha:
        raise ValueError("Clay review source hash differs from the remesh")
    if int(review.get("source", {}).get("triangles", -1)) != triangles:
        raise ValueError("Clay review triangle count differs from the remesh")
    if review.get("comparisonManifest", {}).get("sha256") != digest(asset.clay_manifest):
        raise ValueError("Clay comparison manifest changed after acceptance")
    if manifest.get("asset") != asset.name:
        raise ValueError("Clay comparison identifies the wrong asset")
    rows = [
        row for row in manifest.get("assets", []) if row.get("name") == "v9-remesh-candidate"
    ]
    if (
        len(rows) != 1
        or rows[0].get("sha256") != source_sha
        or int(rows[0].get("triangles", -1)) != triangles
    ):
        raise ValueError("Clay comparison did not render the accepted remesh")
    manifest_proofs = {
        str(row.get("file")): str(row.get("sha256"))
        for row in manifest.get("proofs", [])
    }
    reviewed_proofs = {
        str(row.get("file")): str(row.get("sha256"))
        for row in review.get("proofs", [])
    }
    if reviewed_proofs != manifest_proofs or len(reviewed_proofs) != 2:
        raise ValueError("Clay acceptance does not bind the rendered proof set")
    for relative, expected_sha in reviewed_proofs.items():
        proof = ART / relative
        if not proof.is_file() or digest(proof) != expected_sha:
            raise ValueError(f"Accepted clay proof changed: {relative}")
    return {
        "file": str(asset.clay_review.relative_to(REPO)),
        "sha256": digest(asset.clay_review),
        "decision": review["decision"],
        "comparisonManifest": {
            "file": str(asset.clay_manifest.relative_to(REPO)),
            "sha256": digest(asset.clay_manifest),
        },
        "proofs": review["proofs"],
    }


def initial_receipt(
    asset: Asset,
    parent_task_id: str,
    source_sha: str,
    triangles: int,
    clay_review: dict[str, object],
) -> dict[str, object]:
    return {
        "schema": 1,
        "provider": "Meshy",
        "assetId": asset.asset_id,
        "operation": "retexture",
        "parentTaskId": parent_task_id,
        "source": {
            "file": str(asset.source.relative_to(REPO)),
            "bytes": asset.source.stat().st_size,
            "sha256": source_sha,
            "triangles": triangles,
        },
        "request": {
            "text_style_prompt": asset.texture_prompt,
            "ai_model": "meshy-6",
            "enable_original_uv": True,
            "enable_pbr": True,
            "hd_texture": False,
            "remove_lighting": True,
            "target_formats": ["glb"],
            "alpha_thumbnail": True,
            "response_format": "json",
        },
        "authorization": {
            "chargedPbrApproval": "pending-reviewed-geometry-operator-assertion",
            "assertedBySubmitFlag": False,
        },
        "clayReview": clay_review,
        "estimatedCredits": 10,
        "expectedTextureResolution": "2K base color and PBR maps",
        "credentialsPersisted": False,
        "providerUrlsPersisted": False,
        "state": "not-submitted",
    }


def validate_receipt(
    asset: Asset,
    receipt: dict[str, object],
    parent_task_id: str,
    source_sha: str,
    clay_review: dict[str, object],
) -> None:
    if receipt.get("parentTaskId") != parent_task_id:
        raise ValueError("Receipt parent task changed")
    if receipt.get("source", {}).get("sha256") != source_sha:
        raise ValueError("Receipt source changed")
    if receipt.get("request", {}).get("text_style_prompt") != asset.texture_prompt:
        raise ValueError("Receipt texture prompt changed")
    if receipt.get("clayReview", {}).get("sha256") != clay_review["sha256"]:
        raise ValueError("Receipt clay-review gate changed")
    if receipt.get("state") == "submission-unconfirmed" and not receipt.get("taskId"):
        raise RuntimeError("Earlier PBR submission is ambiguous; reconcile it before any retry")


def related_receipts() -> list[Path]:
    return [
        V7 / "meshy" / "twin-connector-remesh-100k-receipt.json",
        V7 / "meshy" / "twin-connector-remesh-100k-retexture-pbr-receipt.json",
        V8 / "meshy" / "conservatory-remesh-110k-receipt.json",
        V8 / "meshy" / "conservatory-remesh-110k-retexture-pbr-receipt.json",
        ASSETS["temple"].remesh_receipt,
        ASSETS["cypress"].remesh_receipt,
        ASSETS["temple"].receipt,
        ASSETS["cypress"].receipt,
    ]


def locally_receipted_task_ids() -> set[str]:
    result = {str(row["taskId"]) for row in KNOWN_V7_BASELINE.values()}
    for path in related_receipts():
        if not path.exists():
            continue
        receipt = json.loads(path.read_text())
        if receipt.get("state") == "submission-unconfirmed" and not receipt.get("taskId"):
            raise RuntimeError(f"Ambiguous charged submission must be resolved first: {path}")
        if receipt.get("taskId"):
            result.add(str(receipt["taskId"]))
    return result


def reconcile_provider(client: object, asset: Asset) -> dict[str, object]:
    result: dict[str, object] = {
        "checkedAtUtc": now(),
        "purpose": f"Prevent an unreceipted or duplicate PBR submission before {asset.name} V9.",
        "taskLists": {},
    }
    known_ids = locally_receipted_task_ids()
    for task_type in ("remesh", "retexture"):
        raw = client.tool(
            "meshy_list_tasks",
            {
                "task_type": task_type,
                "sort_by": "-created_at",
                "limit": 100,
                "offset": 0,
                "response_format": "json",
            },
        )
        rows = task_rows(raw)
        result["taskLists"][task_type] = rows
        baseline = KNOWN_V7_BASELINE[task_type]
        newer = [
            row for row in rows if int(row.get("createdAt", 0)) > int(baseline["createdAt"])
        ]
        unknown = [row for row in newer if str(row.get("taskId")) not in known_ids]
        if unknown:
            raise RuntimeError(
                f"Unreceipted {task_type} task exists after the V7 baseline: "
                + ", ".join(str(row.get("taskId")) for row in unknown)
            )
        if not any(row.get("taskId") == baseline["taskId"] for row in rows):
            raise RuntimeError(f"Known V7 {task_type} baseline is absent from provider history")
    result["balance"] = read_balance(client)
    result["conclusion"] = "Every task newer than the V7 baseline has a local receipt."
    return result


def archive_completed_task(
    client: object, asset: Asset, receipt: dict[str, object]
) -> tuple[dict[str, object], int]:
    task_id = str(receipt["taskId"])
    task: dict[str, object] | None = None
    deadline = time.monotonic() + 900
    while time.monotonic() < deadline:
        task = client.tool(
            "meshy_get_task_status",
            {
                "task_id": task_id,
                "task_type": "retexture",
                "wait": False,
                "response_format": "json",
            },
        )
        outcome = task.get("outcome") or task.get("status")
        receipt["lastStatus"] = safe_status(task)
        receipt["lastCheckedAtUtc"] = now()
        save(asset.receipt, receipt)
        if outcome in {"SUCCEEDED", "FAILED", "CANCELED"}:
            break
        time.sleep(8)
    if task is None:
        raise RuntimeError("Meshy retexture was not queried")
    outcome = task.get("outcome") or task.get("status")
    if outcome != "SUCCEEDED":
        raise RuntimeError(f"Meshy retexture did not succeed: {outcome}")

    if asset.output.exists():
        try:
            check_glb(asset.output)
        except ValueError:
            asset.incomplete_download.parent.mkdir(parents=True, exist_ok=True)
            if asset.incomplete_download.exists():
                raise RuntimeError("Two incomplete PBR downloads need manual reconciliation")
            receipt["incompleteNativeDownload"] = {
                "file": str(asset.incomplete_download.relative_to(REPO)),
                "bytes": asset.output.stat().st_size,
                "sha256": digest(asset.output),
                "cause": "Provider download ended before a complete GLB was archived",
            }
            asset.output.replace(asset.incomplete_download)
            save(asset.receipt, receipt)
        else:
            if receipt.get("archiveDownloadTaskId") != task_id:
                raise RuntimeError("A valid but unreceipted PBR GLB occupies the output path")
    if not asset.output.exists():
        receipt["archiveDownloadTaskId"] = task_id
        receipt["archiveDownloadStartedAtUtc"] = now()
        save(asset.receipt, receipt)
        source_url = task.get("model_urls", {}).get("glb")
        if not source_url:
            raise RuntimeError("Completed retexture omitted its GLB artifact URL")
        download_complete(str(source_url), asset.output)
    return task, read_balance(client)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", choices=sorted(ASSETS), required=True)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--submit",
        action="store_true",
        help="Reconcile, submit at most once, poll, and archive. This can spend credits.",
    )
    mode.add_argument(
        "--resume",
        action="store_true",
        help="Poll and archive the task already stored in the receipt; never submit.",
    )
    parser.add_argument(
        "--authorized-pbr-retexture",
        action="store_true",
        help="Assert that the reviewed geometry may enter the charged PBR stage.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    asset = ASSETS[args.asset]
    if len(asset.texture_prompt) > 600:
        raise ValueError(
            f"{asset.name} text_style_prompt exceeds Meshy's 600-character limit: "
            f"{len(asset.texture_prompt)}"
        )
    check_glb(asset.source)
    source_sha = digest(asset.source)
    triangles = triangle_count(asset.source)
    if abs(triangles - asset.target_triangles) > asset.triangle_tolerance:
        raise ValueError(
            f"{asset.name} candidate missed its geometry budget: {triangles} triangles"
        )
    remesh = json.loads(asset.remesh_receipt.read_text())
    if remesh.get("state") != "archived" or remesh.get("file", {}).get("sha256") != source_sha:
        raise ValueError("Remesh receipt does not archive the accepted source")
    parent_task_id = str(remesh.get("taskId", ""))
    if not parent_task_id:
        raise ValueError("Remesh receipt has no provider task ID")
    clay_review = validate_clay_review(asset, source_sha, triangles)
    receipt = (
        json.loads(asset.receipt.read_text())
        if asset.receipt.exists()
        else initial_receipt(asset, parent_task_id, source_sha, triangles, clay_review)
    )
    validate_receipt(asset, receipt, parent_task_id, source_sha, clay_review)
    save(asset.receipt, receipt)

    if not args.submit and not args.resume:
        print(
            "MUSEUM_RETEXTURE_LOCAL_PREFLIGHT="
            + json.dumps(
                {
                    "asset": asset.name,
                    "sourceSha256": source_sha,
                    "triangles": triangles,
                    "clayReviewSha256": clay_review["sha256"],
                    "receiptState": receipt["state"],
                    "networkUsed": False,
                    "creditsCharged": 0,
                }
            ),
            flush=True,
        )
        return
    if args.resume and not receipt.get("taskId"):
        raise RuntimeError("Resume requires a retexture task ID already saved in the receipt")
    if args.submit and not receipt.get("taskId") and not args.authorized_pbr_retexture:
        raise RuntimeError("Submission requires --authorized-pbr-retexture after clay acceptance")

    pipeline = load_meshy_pipeline()
    with pipeline.MCP() as client:
        if args.submit and not receipt.get("taskId"):
            reconciliation = reconcile_provider(client, asset)
            balance_before = int(reconciliation["balance"])
            if balance_before < int(receipt["estimatedCredits"]):
                raise RuntimeError("Insufficient Meshy balance for the prepared PBR retexture")
            receipt["providerReconciliation"] = reconciliation
            receipt["balanceBefore"] = balance_before
            receipt["authorization"] = {
                "chargedPbrApproval": "asserted-after-hash-bound-clay-acceptance",
                "assertedBySubmitFlag": True,
                "assertedAtUtc": now(),
            }
            save(asset.receipt, receipt)

            parent_status = client.tool(
                "meshy_get_task_status",
                {
                    "task_id": parent_task_id,
                    "task_type": "remesh",
                    "wait": False,
                    "response_format": "json",
                },
            )
            parent_outcome = parent_status.get("outcome") or parent_status.get("status")
            if parent_outcome != "SUCCEEDED":
                raise RuntimeError(f"Remesh task is unavailable: {parent_outcome}")
            receipt.update(
                {
                    "parentStatusAtSubmission": safe_status(parent_status),
                    "submittedAtUtc": now(),
                    "state": "submission-unconfirmed",
                }
            )
            save(asset.receipt, receipt)
            result = client.tool(
                "meshy_retexture",
                {"input_task_id": parent_task_id, **receipt["request"]},
            )
            task_id = result.get("task_id")
            if not task_id:
                raise RuntimeError("Meshy retexture returned no task ID; do not retry")
            receipt.update({"taskId": task_id, "state": "submitted"})
            save(asset.receipt, receipt)
            receipt["balanceAfterSubmit"] = read_balance(client)
            receipt["observedBalanceDeltaAtSubmit"] = (
                balance_before - receipt["balanceAfterSubmit"]
            )
            save(asset.receipt, receipt)

        task, balance_final = archive_completed_task(client, asset, receipt)

    check_glb(asset.output)
    receipt.update(
        {
            "state": "archived",
            "finalStatus": safe_status(task),
            "balanceAfterArchiveCheck": balance_final,
            "observedBalanceDeltaFinal": receipt.get("balanceBefore", balance_final)
            - balance_final,
            "archivedAtUtc": now(),
            "archiveDownload": {
                "method": "bounded CDN byte ranges from authenticated task status",
                "sourceHost": "assets.meshy.ai",
                "signedUrlPersisted": False,
            },
            "file": {
                "path": str(asset.output.relative_to(REPO)),
                "bytes": asset.output.stat().st_size,
                "sha256": digest(asset.output),
            },
            "readiness": (
                "Review-only PBR candidate. Dense-donor normal/AO bake, Blender finish, "
                "fresh export/reimport, and runtime integration remain separate gates."
            ),
        }
    )
    save(asset.receipt, receipt)
    print(
        "MUSEUM_RETEXTURE_ARCHIVED="
        + json.dumps(
            {
                "asset": asset.name,
                "taskId": receipt["taskId"],
                "status": receipt["finalStatus"],
                "observedBalanceDelta": receipt["observedBalanceDeltaFinal"],
                "balance": balance_final,
                "bytes": asset.output.stat().st_size,
                "sha256": digest(asset.output),
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
