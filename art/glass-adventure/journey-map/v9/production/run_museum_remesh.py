"""Archive receipt-guarded Meshy remesh candidates for the V9 temple or cypress."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import importlib.util
import json
from pathlib import Path
import time
from urllib.parse import urlsplit


HERE = Path(__file__).resolve().parent
ART = HERE.parent
REPO = HERE.parents[4]
V3 = ART.parent / "v3"
V7 = ART.parent / "v7"
V8 = ART.parent / "v8"


@dataclass(frozen=True)
class Asset:
    name: str
    asset_id: str
    source: Path
    expected_source_sha256: str
    parent_receipt: Path
    target_triangles: int
    receipt: Path
    output: Path
    incomplete_download: Path
    review_note: str


ASSETS = {
    "temple": Asset(
        name="temple",
        asset_id="floating-museum-temple-v9-candidate",
        source=V3 / "meshy" / "floating-museum-temple-v3-pre-remesh.glb",
        expected_source_sha256="9081197e97545d873eca2773ccebfeeadb919acc4e2f96e62ac99a6faa929023",
        parent_receipt=V3 / "meshy" / "temple-receipt.json",
        target_triangles=90_000,
        receipt=ART / "meshy" / "temple-remesh-90k-receipt.json",
        output=ART / "meshy" / "temple-remesh-90k.glb",
        incomplete_download=ART
        / "meshy"
        / "raw"
        / "temple-remesh-native-download-incomplete.glb.part",
        review_note=(
            "Review-only untextured geometry candidate. Compare dome curvature, column and arch "
            "profiles, statue anatomy and drapery, ornaments, steps, and the rear silhouette "
            "against the dense archive before any UV, bake, texture, or runtime work."
        ),
    ),
    "cypress": Asset(
        name="cypress",
        asset_id="floating-museum-cypress-v9-candidate",
        source=V3 / "meshy" / "floating-museum-cypress-v3-pre-remesh.glb",
        expected_source_sha256="cb6f436f48909cfa3c449d085dc48ff3ba9dfc71dbc230332878e32c95cbeda1",
        parent_receipt=V3 / "meshy" / "cypress-receipt.json",
        target_triangles=20_000,
        receipt=ART / "meshy" / "cypress-remesh-20k-receipt.json",
        output=ART / "meshy" / "cypress-remesh-20k.glb",
        incomplete_download=ART
        / "meshy"
        / "raw"
        / "cypress-remesh-native-download-incomplete.glb.part",
        review_note=(
            "Review-only untextured geometry candidate. Compare the continuous tree silhouette, "
            "rounded foliage masses, branch and trunk reads, planter, and vines against the dense "
            "archive before any UV, bake, texture, or runtime work."
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


def load_v8_helpers():
    """Import V8's pure receipt/transport helpers without running its main function."""

    path = V8 / "production" / "run_conservatory_remesh.py"
    spec = importlib.util.spec_from_file_location("journey_map_v8_remesh_helpers", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


V8_HELPERS = load_v8_helpers()
now = V8_HELPERS.now
digest = V8_HELPERS.digest
check_glb = V8_HELPERS.check_glb
download_complete = V8_HELPERS.download_complete
safe_status = V8_HELPERS.safe_status
task_rows = V8_HELPERS.task_rows
load_meshy_pipeline = V8_HELPERS.load_meshy_pipeline


def save(path: Path, receipt: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(receipt, indent=2) + "\n")
    temporary.replace(path)


def read_balance(client: object) -> int:
    response = client.tool("meshy_check_balance", {"response_format": "json"})
    balance = response.get("balance") if isinstance(response, dict) else None
    if isinstance(balance, bool) or not isinstance(balance, (int, float)):
        raise RuntimeError("Meshy balance is unavailable; stop before any charged submission")
    return int(balance)


def validate_source(asset: Asset) -> tuple[str, dict[str, object]]:
    check_glb(asset.source)
    source_sha = digest(asset.source)
    if source_sha != asset.expected_source_sha256:
        raise ValueError(f"The archived {asset.name} source hash changed")
    parent = json.loads(asset.parent_receipt.read_text())
    source_rows = [
        row for row in parent.get("files", []) if row.get("role") == "pre_remeshed_glb"
    ]
    if (
        len(source_rows) != 1
        or source_rows[0].get("sha256") != source_sha
        or int(source_rows[0].get("bytes", -1)) != asset.source.stat().st_size
    ):
        raise ValueError(f"The V3 provider receipt does not identify the {asset.name} source")
    task_id = str(parent.get("taskId", ""))
    if not task_id or parent.get("taskType") != "image-to-3d":
        raise ValueError(f"The V3 {asset.name} receipt has no valid parent task")
    return task_id, parent


def initial_receipt(asset: Asset, parent_task_id: str, parent: dict[str, object]) -> dict[str, object]:
    return {
        "schema": 1,
        "provider": "Meshy",
        "assetId": asset.asset_id,
        "operation": "remesh",
        "parentTaskId": parent_task_id,
        "sourceVariant": "pre_remeshed_glb",
        "source": {
            "file": str(asset.source.relative_to(REPO)),
            "bytes": asset.source.stat().st_size,
            "sha256": digest(asset.source),
            "providerTaskType": parent.get("taskType"),
        },
        "request": {
            "topology": "triangle",
            "target_polycount": asset.target_triangles,
            "target_formats": ["glb"],
            "origin_at": "bottom",
            "response_format": "json",
        },
        "authorization": {
            "sourceTransferApproval": "pending-specific-user-confirmation",
            "assertedBySubmitFlag": False,
        },
        "estimatedCredits": 5,
        "credentialsPersisted": False,
        "providerUrlsPersisted": False,
        "state": "not-submitted",
    }


def validate_receipt(
    asset: Asset,
    receipt: dict[str, object],
    parent_task_id: str,
) -> None:
    if receipt.get("parentTaskId") != parent_task_id:
        raise ValueError("Receipt parent task changed")
    if receipt.get("source", {}).get("sha256") != digest(asset.source):
        raise ValueError("Receipt source changed")
    request = receipt.get("request", {})
    if (
        request.get("target_polycount") != asset.target_triangles
        or request.get("topology") != "triangle"
        or request.get("target_formats") != ["glb"]
        or request.get("origin_at") != "bottom"
    ):
        raise ValueError("Receipt request contract changed")
    if receipt.get("state") == "submission-unconfirmed" and not receipt.get("taskId"):
        raise RuntimeError("Earlier submission is ambiguous; reconcile it before any retry")


def related_receipts() -> list[Path]:
    return [
        V7 / "meshy" / "twin-connector-remesh-100k-receipt.json",
        V7 / "meshy" / "twin-connector-remesh-100k-retexture-pbr-receipt.json",
        V8 / "meshy" / "conservatory-remesh-110k-receipt.json",
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
            raise RuntimeError(f"Ambiguous paid submission must be resolved first: {path}")
        if receipt.get("taskId"):
            result.add(str(receipt["taskId"]))
    return result


def reconcile_provider(client: object, asset: Asset) -> dict[str, object]:
    result: dict[str, object] = {
        "checkedAtUtc": now(),
        "purpose": f"Prevent an unreceipted or duplicate submission before {asset.name} V9.",
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
            row
            for row in rows
            if int(row.get("createdAt", 0)) > int(baseline["createdAt"])
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
    client: object,
    asset: Asset,
    receipt: dict[str, object],
) -> tuple[dict[str, object], int]:
    task_id = str(receipt["taskId"])
    task: dict[str, object] | None = None
    deadline = time.monotonic() + 900
    while time.monotonic() < deadline:
        task = client.tool(
            "meshy_get_task_status",
            {
                "task_id": task_id,
                "task_type": "remesh",
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
        raise RuntimeError("Meshy remesh was not queried")
    outcome = task.get("outcome") or task.get("status")
    if outcome != "SUCCEEDED":
        raise RuntimeError(f"Meshy remesh did not succeed: {outcome}")

    if asset.output.exists():
        try:
            check_glb(asset.output)
        except ValueError:
            asset.incomplete_download.parent.mkdir(parents=True, exist_ok=True)
            if asset.incomplete_download.exists():
                raise RuntimeError("Two incomplete candidate downloads need manual reconciliation")
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
                raise RuntimeError(
                    "A valid but unreceipted candidate GLB already occupies the output path"
                )
    if not asset.output.exists():
        receipt["archiveDownloadTaskId"] = task_id
        receipt["archiveDownloadStartedAtUtc"] = now()
        save(asset.receipt, receipt)
        source_url = task.get("model_urls", {}).get("glb")
        if source_url:
            download_complete(str(source_url), asset.output)
        else:
            client.tool(
                "meshy_download_model",
                {
                    "task_id": task_id,
                    "task_type": "remesh",
                    "format": "glb",
                    "include_textures": False,
                    "save_to": str(asset.output),
                },
            )
    balance = read_balance(client)
    return task, balance


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
        "--authorized-source-transfer",
        action="store_true",
        help="Assert that the specific source transfer and charged remesh were approved.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    asset = ASSETS[args.asset]
    parent_task_id, parent = validate_source(asset)
    receipt = (
        json.loads(asset.receipt.read_text())
        if asset.receipt.exists()
        else initial_receipt(asset, parent_task_id, parent)
    )
    validate_receipt(asset, receipt, parent_task_id)
    save(asset.receipt, receipt)

    if not args.submit and not args.resume:
        print(
            "MUSEUM_REMESH_LOCAL_PREFLIGHT="
            + json.dumps(
                {
                    "asset": asset.name,
                    "source": str(asset.source.relative_to(REPO)),
                    "sourceSha256": digest(asset.source),
                    "targetTriangles": asset.target_triangles,
                    "receipt": str(asset.receipt.relative_to(REPO)),
                    "receiptState": receipt["state"],
                    "networkUsed": False,
                    "creditsCharged": 0,
                }
            ),
            flush=True,
        )
        return
    if args.resume and not receipt.get("taskId"):
        raise RuntimeError("Resume requires a task ID already saved in the receipt")
    if args.submit and not receipt.get("taskId") and not args.authorized_source_transfer:
        raise RuntimeError(
            "Submission requires --authorized-source-transfer after specific user approval"
        )

    pipeline = load_meshy_pipeline()
    with pipeline.MCP() as client:
        if args.submit and not receipt.get("taskId"):
            reconciliation = reconcile_provider(client, asset)
            balance_before = int(reconciliation["balance"])
            receipt["providerReconciliation"] = reconciliation
            receipt["balanceBefore"] = balance_before
            receipt["authorization"] = {
                "sourceTransferApproval": "asserted-by-operator-after-specific-user-confirmation",
                "assertedBySubmitFlag": True,
                "assertedAtUtc": now(),
            }
            save(asset.receipt, receipt)

            parent_status = client.tool(
                "meshy_get_task_status",
                {
                    "task_id": parent_task_id,
                    "task_type": "image-to-3d",
                    "wait": False,
                    "response_format": "json",
                },
            )
            parent_outcome = parent_status.get("outcome") or parent_status.get("status")
            if parent_outcome != "SUCCEEDED":
                raise RuntimeError(f"Parent Meshy task is unavailable: {parent_outcome}")
            source_url = parent_status.get("model_urls", {}).get("pre_remeshed_glb")
            source_parts = urlsplit(str(source_url))
            if source_parts.scheme != "https" or source_parts.hostname != "assets.meshy.ai":
                raise RuntimeError("Parent task returned no trusted pre-remesh artifact URL")
            receipt.update(
                {
                    "parentStatusAtSubmission": safe_status(parent_status),
                    "submittedAtUtc": now(),
                    "state": "submission-unconfirmed",
                }
            )
            save(asset.receipt, receipt)
            result = client.tool(
                "meshy_remesh",
                {"model_url": source_url, **receipt["request"]},
            )
            task_id = result.get("task_id")
            if not task_id:
                raise RuntimeError("Meshy remesh returned no task ID; do not retry")
            receipt.update(
                {
                    "taskId": task_id,
                    "state": "submitted",
                }
            )
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
                "method": "bounded CDN byte ranges or authenticated MCP download",
                "sourceHost": "assets.meshy.ai",
                "signedUrlPersisted": False,
            },
            "file": {
                "path": str(asset.output.relative_to(REPO)),
                "bytes": asset.output.stat().st_size,
                "sha256": digest(asset.output),
            },
            "readiness": asset.review_note,
        }
    )
    save(asset.receipt, receipt)
    print(
        "MUSEUM_REMESH_ARCHIVED="
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
