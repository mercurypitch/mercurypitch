#!/usr/bin/env python3
"""Archive one receipt-guarded 90k remesh of the accepted Ultra 4K marble donor.

The dense Meshy 7.1 output remains immutable. This producer asks Meshy's remesh
endpoint for a topology candidate only, records the paid task before any
follow-up request, and never persists credentials or signed provider URLs.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import struct
import time
from typing import Any
from urllib.parse import urlsplit


HERE = Path(__file__).resolve().parent
V4 = HERE.parent
GLASS = V4.parent.parent
REPO = HERE.parents[4]
V8_PRODUCER = GLASS / "journey-map" / "v8" / "production" / "run_conservatory_remesh.py"

ARCHIVE = V4 / "meshy" / "marble-ultra4k"
SOURCE = ARCHIVE / "dense-donor.glb"
PARENT_RECEIPT = ARCHIVE / "receipt.json"
RECEIPT = ARCHIVE / "runtime-remesh-90k-receipt.json"
OUTPUT = ARCHIVE / "runtime-remesh-90k.glb"
INCOMPLETE = ARCHIVE / "runtime-remesh-90k-incomplete.glb.part"

ASSET_ID = "cloudway-marble-ultra4k-runtime-remesh-v4"
EXPECTED_SOURCE_BYTES = 65_096_584
EXPECTED_SOURCE_SHA256 = "fa4d01900561e257be18c7190ef893aa789f178d1d4ccd13c2da22427d1033bb"
EXPECTED_PARENT_TASK = "01a0cef2-fffb-726e-8659-b4e06c21149a"
TARGET_TRIANGLES = 90_000
ESTIMATED_CREDITS = 5


def load_transport_helpers() -> Any:
    spec = importlib.util.spec_from_file_location("cloudway_v4_meshy_transport", V8_PRODUCER)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load receipt transport helpers from {V8_PRODUCER}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


HELPERS = load_transport_helpers()
check_glb = HELPERS.check_glb
download_complete = HELPERS.download_complete
load_meshy_pipeline = HELPERS.load_meshy_pipeline
safe_status = HELPERS.safe_status


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def relative(path: Path) -> str:
    return str(path.relative_to(REPO))


def save(value: dict[str, Any]) -> None:
    RECEIPT.parent.mkdir(parents=True, exist_ok=True)
    temporary = RECEIPT.with_suffix(RECEIPT.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n")
    os.replace(temporary, RECEIPT)


def read_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    if not isinstance(value, dict):
        raise ValueError(f"Expected an object in {relative(path)}")
    return value


def triangle_inventory(path: Path) -> dict[str, int]:
    data = path.read_bytes()
    if len(data) < 20 or data[:4] != b"glTF" or struct.unpack_from("<I", data, 4)[0] != 2:
        raise ValueError(f"Not a complete GLB 2.0 file: {relative(path)}")
    json_length, json_type = struct.unpack_from("<II", data, 12)
    if json_type != 0x4E4F534A:
        raise ValueError("GLB first chunk is not JSON")
    document = json.loads(data[20 : 20 + json_length].decode("utf-8"))
    triangles = 0
    vertices = 0
    primitives = 0
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            primitives += 1
            attributes = primitive.get("attributes", {})
            position = attributes.get("POSITION")
            if isinstance(position, int):
                vertices += int(document["accessors"][position]["count"])
            indices = primitive.get("indices")
            if isinstance(indices, int):
                triangles += int(document["accessors"][indices]["count"]) // 3
            elif isinstance(position, int):
                triangles += int(document["accessors"][position]["count"]) // 3
    return {
        "meshes": len(document.get("meshes", [])),
        "primitives": primitives,
        "referencedVertices": vertices,
        "triangles": triangles,
    }


def validate_source() -> tuple[dict[str, Any], dict[str, Any]]:
    if SOURCE.stat().st_size != EXPECTED_SOURCE_BYTES or digest(SOURCE) != EXPECTED_SOURCE_SHA256:
        raise ValueError("The accepted Ultra 4K dense donor changed")
    check_glb(SOURCE)
    parent = read_json(PARENT_RECEIPT)
    archive = parent.get("archiveDownload", {}).get("model", {})
    if (
        parent.get("state") != "archived"
        or parent.get("taskId") != EXPECTED_PARENT_TASK
        or archive.get("sha256") != EXPECTED_SOURCE_SHA256
        or int(archive.get("bytes", -1)) != EXPECTED_SOURCE_BYTES
    ):
        raise ValueError("The accepted parent receipt no longer identifies the dense donor")
    source = {
        "file": relative(SOURCE),
        "bytes": EXPECTED_SOURCE_BYTES,
        "sha256": EXPECTED_SOURCE_SHA256,
        "triangles": int(archive.get("triangles", -1)),
        "referencedVertices": int(archive.get("referencedVertices", -1)),
        "providerTaskType": "image-to-3d",
    }
    return source, parent


def base_receipt(source: dict[str, Any]) -> dict[str, Any]:
    return {
        "schema": 1,
        "provider": "Meshy",
        "assetId": ASSET_ID,
        "operation": "remesh",
        "state": "not-submitted",
        "parentTaskId": EXPECTED_PARENT_TASK,
        "sourceVariant": "dense provider GLB",
        "source": source,
        "budgetBasis": {
            "targetTriangles": TARGET_TRIANGLES,
            "currentV3MarbleTriangles": 40_032,
            "denseDonorTriangles": 1_256_556,
            "runtimeInstancesInCurrentCloudway": 6,
            "projectedFrontPassTrianglesAtCurrentInstanceCount": TARGET_TRIANGLES * 6,
            "reason": (
                "The accepted dense donor has silhouette-bearing arches, feet, medallions and "
                "foliage absent at V3's 40k budget. Ninety thousand triangles more than doubles "
                "the per-platform detail while bounding the six-instance front pass near 540k."
            ),
        },
        "request": {
            "topology": "triangle",
            "target_polycount": TARGET_TRIANGLES,
            "target_formats": ["glb"],
            "origin_at": "bottom",
            "response_format": "json",
        },
        "authorization": {
            "sourceTransferApproval": "pending-authorized-submit-flag",
            "assertedBySubmitFlag": False,
        },
        "estimatedCredits": ESTIMATED_CREDITS,
        "credentialsPersisted": False,
        "providerUrlsPersisted": False,
        "readiness": (
            "Topology candidate only. It must pass dense-source clay comparison, fitted "
            "high-to-low bake, UV/normal/tangent validation and runtime texture audition."
        ),
    }


def validate_receipt(receipt: dict[str, Any], source: dict[str, Any]) -> None:
    if receipt.get("assetId") != ASSET_ID or receipt.get("parentTaskId") != EXPECTED_PARENT_TASK:
        raise ValueError("Existing remesh receipt belongs to a different task")
    if receipt.get("source") != source:
        raise ValueError("Existing remesh receipt source differs from the accepted donor")
    request = receipt.get("request", {})
    if request != base_receipt(source)["request"]:
        raise ValueError("Existing remesh receipt request differs from the fixed 90k contract")
    if receipt.get("state") == "submission-unconfirmed" and not receipt.get("taskId"):
        raise RuntimeError("An earlier paid submission is ambiguous; reconcile it before retrying")


def read_balance(client: Any) -> int:
    raw = client.tool("meshy_check_balance", {"response_format": "json"})
    value = raw.get("balance") if isinstance(raw, dict) else None
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise RuntimeError("Meshy balance is unavailable")
    return int(value)


def archive_completed(client: Any, receipt: dict[str, Any]) -> tuple[dict[str, Any], int]:
    task_id = str(receipt["taskId"])
    task: dict[str, Any] | None = None
    deadline = time.monotonic() + 1200
    while time.monotonic() < deadline:
        raw = client.tool(
            "meshy_get_task_status",
            {
                "task_id": task_id,
                "task_type": "remesh",
                "wait": False,
                "response_format": "json",
            },
        )
        if not isinstance(raw, dict):
            raise RuntimeError("Meshy returned a non-object task status")
        task = raw
        outcome = task.get("outcome") or task.get("status")
        receipt["lastStatus"] = safe_status(task)
        receipt["lastCheckedAtUtc"] = utc_now()
        save(receipt)
        if outcome in {"SUCCEEDED", "FAILED", "CANCELED"}:
            break
        time.sleep(8)
    if task is None:
        raise RuntimeError("Meshy remesh was never queried")
    outcome = task.get("outcome") or task.get("status")
    if outcome != "SUCCEEDED":
        raise RuntimeError(f"Meshy remesh did not succeed: {outcome}")

    if OUTPUT.exists():
        try:
            check_glb(OUTPUT)
        except ValueError:
            if INCOMPLETE.exists():
                raise RuntimeError("Two incomplete remesh downloads require reconciliation")
            OUTPUT.replace(INCOMPLETE)
        else:
            if receipt.get("archiveDownloadTaskId") != task_id:
                raise RuntimeError("A valid but unreceipted remesh already occupies the output path")
    if not OUTPUT.exists():
        receipt["archiveDownloadTaskId"] = task_id
        receipt["archiveDownloadStartedAtUtc"] = utc_now()
        save(receipt)
        model_url = task.get("model_urls", {}).get("glb")
        parsed = urlsplit(str(model_url))
        if parsed.scheme == "https" and parsed.hostname == "assets.meshy.ai":
            download_complete(str(model_url), OUTPUT)
        else:
            client.tool(
                "meshy_download_model",
                {
                    "task_id": task_id,
                    "task_type": "remesh",
                    "format": "glb",
                    "include_textures": False,
                    "save_to": str(OUTPUT),
                },
            )
    return task, read_balance(client)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--submit", action="store_true")
    mode.add_argument("--resume", action="store_true")
    parser.add_argument("--authorized-source-transfer", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source, _parent = validate_source()
    receipt = read_json(RECEIPT) if RECEIPT.exists() else base_receipt(source)
    validate_receipt(receipt, source)
    save(receipt)

    if not args.submit and not args.resume:
        print(
            "CLOUDWAY_MARBLE_REMESH_PREFLIGHT="
            + json.dumps(
                {
                    "source": source,
                    "targetTriangles": TARGET_TRIANGLES,
                    "receipt": relative(RECEIPT),
                    "receiptState": receipt["state"],
                    "networkUsed": False,
                    "creditsCharged": 0,
                }
            ),
            flush=True,
        )
        return
    if args.resume and not receipt.get("taskId"):
        raise RuntimeError("Resume requires a task ID already stored in the receipt")
    if args.submit and not receipt.get("taskId") and not args.authorized_source_transfer:
        raise RuntimeError("Submission requires --authorized-source-transfer")

    pipeline = load_meshy_pipeline()
    with pipeline.MCP() as client:
        if args.submit and not receipt.get("taskId"):
            balance_before = read_balance(client)
            if balance_before < ESTIMATED_CREDITS:
                raise RuntimeError("Insufficient Meshy balance for the fixed remesh")
            receipt["balanceBefore"] = balance_before
            receipt["authorization"] = {
                "sourceTransferApproval": "asserted-by-operator-from-current-user-authorization",
                "assertedBySubmitFlag": True,
                "assertedAtUtc": utc_now(),
            }
            save(receipt)

            parent_status = client.tool(
                "meshy_get_task_status",
                {
                    "task_id": EXPECTED_PARENT_TASK,
                    "task_type": "image-to-3d",
                    "wait": False,
                    "response_format": "json",
                },
            )
            if not isinstance(parent_status, dict):
                raise RuntimeError("Meshy returned a non-object parent task status")
            parent_outcome = parent_status.get("outcome") or parent_status.get("status")
            if parent_outcome != "SUCCEEDED":
                raise RuntimeError(f"Dense parent task is unavailable: {parent_outcome}")
            source_url = parent_status.get("model_urls", {}).get("glb")
            parsed = urlsplit(str(source_url))
            if parsed.scheme != "https" or parsed.hostname != "assets.meshy.ai":
                raise RuntimeError("Dense parent task returned no trusted GLB URL")

            receipt["parentStatusAtSubmission"] = safe_status(parent_status)
            receipt["submittedAtUtc"] = utc_now()
            receipt["state"] = "submission-unconfirmed"
            save(receipt)
            result = client.tool("meshy_remesh", {"model_url": source_url, **receipt["request"]})
            task_id = result.get("task_id") if isinstance(result, dict) else None
            if not task_id:
                raise RuntimeError("Meshy remesh returned no task ID; do not retry")
            receipt["taskId"] = task_id
            receipt["state"] = "submitted"
            save(receipt)
            receipt["balanceAfterSubmit"] = read_balance(client)
            receipt["observedBalanceDeltaAtSubmit"] = (
                balance_before - int(receipt["balanceAfterSubmit"])
            )
            save(receipt)

        task, balance_final = archive_completed(client, receipt)

    check_glb(OUTPUT)
    inventory = triangle_inventory(OUTPUT)
    receipt.update(
        {
            "state": "archived",
            "finalStatus": safe_status(task),
            "balanceAfterArchiveCheck": balance_final,
            "observedBalanceDeltaFinal": int(receipt.get("balanceBefore", balance_final))
            - balance_final,
            "archivedAtUtc": utc_now(),
            "archiveDownload": {
                "method": "bounded CDN byte ranges or authenticated MCP download",
                "sourceHost": "assets.meshy.ai",
                "signedUrlPersisted": False,
            },
            "file": {
                "path": relative(OUTPUT),
                "bytes": OUTPUT.stat().st_size,
                "sha256": digest(OUTPUT),
                **inventory,
            },
        }
    )
    save(receipt)
    print(
        "CLOUDWAY_MARBLE_REMESH_ARCHIVED="
        + json.dumps(
            {
                "taskId": receipt["taskId"],
                "status": receipt["finalStatus"],
                "observedBalanceDelta": receipt["observedBalanceDeltaFinal"],
                "balance": balance_final,
                **receipt["file"],
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
