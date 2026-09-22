"""Archive one receipt-guarded 100k Meshy remesh of the V6 connector source."""

from __future__ import annotations

import datetime
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import time
from urllib.parse import urlsplit


HERE = Path(__file__).resolve().parent
ART = HERE.parent
REPO = HERE.parents[4]
V6 = ART.parent / "v6"
PARENT_RECEIPT = V6 / "meshy" / "twin-connector-receipt.json"
SOURCE = ART / "meshy" / "raw" / "twin-connector-pre-remesh-v6.glb"
RECEIPT = ART / "meshy" / "twin-connector-remesh-100k-receipt.json"
OUTPUT = ART / "meshy" / "twin-connector-remesh-100k.glb"
TARGET_TRIANGLES = 100_000
EXPECTED_SOURCE_SHA256 = "77bbff7370682ed153e290af7c267e2bbf49ad87dfa63fe20dba32b5e2828e4d"


def now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(receipt: dict[str, object]) -> None:
    temporary = RECEIPT.with_suffix(RECEIPT.suffix + ".tmp")
    temporary.write_text(json.dumps(receipt, indent=2) + "\n")
    temporary.replace(RECEIPT)


def check_glb(path: Path) -> None:
    raw = path.read_bytes()
    if (
        len(raw) < 12
        or raw[:4] != b"glTF"
        or struct.unpack_from("<I", raw, 8)[0] != len(raw)
    ):
        raise ValueError(f"Incomplete GLB at {path.name}")


def safe_status(task: dict[str, object]) -> dict[str, object]:
    aliases = {
        "taskId": ("task_id", "taskId"),
        "status": ("status",),
        "outcome": ("outcome",),
        "progress": ("progress",),
        "consumedCredits": ("consumed_credits", "consumedCredits"),
        "faceCount": ("face_count", "faceCount"),
        "vertexCount": ("vertex_count", "vertexCount"),
        "errorCode": ("error_code", "errorCode"),
        "errorMessage": ("error_message", "errorMessage"),
    }
    result: dict[str, object] = {}
    for output_key, input_keys in aliases.items():
        for input_key in input_keys:
            if task.get(input_key) is not None:
                result[output_key] = task[input_key]
                break
    return result


def load_meshy_pipeline():
    path = REPO / "art" / "glass-adventure" / "v2" / "meshy_pipeline.py"
    spec = importlib.util.spec_from_file_location("journey_map_v7_meshy_pipeline", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def validate_source() -> tuple[str, dict[str, object]]:
    check_glb(SOURCE)
    source_sha = digest(SOURCE)
    if source_sha != EXPECTED_SOURCE_SHA256:
        raise ValueError("The archived V7 source does not match the approved V6 pre-remesh GLB")
    parent = json.loads(PARENT_RECEIPT.read_text())
    source_rows = [
        row
        for row in parent.get("files", [])
        if row.get("role") == "pre_remeshed_glb"
    ]
    if len(source_rows) != 1 or source_rows[0].get("sha256") != source_sha:
        raise ValueError("The V6 provider receipt does not identify the archived source")
    task_id = str(parent.get("taskId", ""))
    if not task_id:
        raise ValueError("The V6 provider receipt has no parent task ID")
    return task_id, parent


def main() -> None:
    parent_task_id, parent = validate_source()
    receipt = (
        json.loads(RECEIPT.read_text())
        if RECEIPT.exists()
        else {
            "schema": 1,
            "provider": "Meshy",
            "assetId": "floating-museum-twin-connector-v7-candidate",
            "operation": "remesh",
            "parentTaskId": parent_task_id,
            "sourceVariant": "pre_remeshed_glb",
            "source": {
                "file": str(SOURCE.relative_to(ART)),
                "bytes": SOURCE.stat().st_size,
                "sha256": digest(SOURCE),
                "providerTaskType": parent.get("taskType"),
            },
            "request": {
                "topology": "triangle",
                "target_polycount": TARGET_TRIANGLES,
                "target_formats": ["glb"],
                "origin_at": "bottom",
                "response_format": "json",
            },
            "authorization": (
                "Owner authorized unrestricted Meshy use for Glassworks asset production; "
                "this is the first bounded one-connector quality candidate."
            ),
            "estimatedCredits": 5,
            "credentialsPersisted": False,
            "providerUrlsPersisted": False,
            "state": "not-submitted",
        }
    )
    if receipt.get("parentTaskId") != parent_task_id:
        raise ValueError("Receipt parent task changed")
    if receipt.get("source", {}).get("sha256") != digest(SOURCE):
        raise ValueError("Receipt source changed")
    if receipt.get("request", {}).get("target_polycount") != TARGET_TRIANGLES:
        raise ValueError("Receipt target changed")
    if receipt.get("state") == "submission-unconfirmed" and not receipt.get("taskId"):
        raise RuntimeError("Earlier submission is ambiguous; reconcile it before any retry")

    pipeline = load_meshy_pipeline()
    with pipeline.MCP() as client:
        if not receipt.get("taskId"):
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
            balance_before = client.tool(
                "meshy_check_balance", {"response_format": "json"}
            )["balance"]
            receipt.update(
                {
                    "balanceBefore": balance_before,
                    "parentStatusAtSubmission": safe_status(parent_status),
                    "submittedAtUtc": now(),
                    "state": "submission-unconfirmed",
                }
            )
            save(receipt)
            result = client.tool(
                "meshy_remesh",
                {
                    "model_url": source_url,
                    "topology": "triangle",
                    "target_polycount": TARGET_TRIANGLES,
                    "target_formats": ["glb"],
                    "origin_at": "bottom",
                    "response_format": "json",
                },
            )
            task_id = result.get("task_id")
            if not task_id:
                raise RuntimeError("Meshy remesh returned no task ID; do not retry")
            balance_after_submit = client.tool(
                "meshy_check_balance", {"response_format": "json"}
            )["balance"]
            receipt.update(
                {
                    "taskId": task_id,
                    "state": "submitted",
                    "balanceAfterSubmit": balance_after_submit,
                    "observedBalanceDeltaAtSubmit": balance_before - balance_after_submit,
                }
            )
            save(receipt)

        task_id = str(receipt["taskId"])
        task: dict[str, object] | None = None
        for _attempt in range(36):
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
            save(receipt)
            if outcome in {"SUCCEEDED", "FAILED", "CANCELED"}:
                break
            time.sleep(8)
        if task is None:
            raise RuntimeError("Meshy remesh was not queried")
        outcome = task.get("outcome") or task.get("status")
        if outcome != "SUCCEEDED":
            raise RuntimeError(f"Meshy remesh did not succeed: {outcome}")
        if not OUTPUT.exists():
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
        balance_final = client.tool(
            "meshy_check_balance", {"response_format": "json"}
        )["balance"]

    check_glb(OUTPUT)
    receipt.update(
        {
            "state": "archived",
            "finalStatus": safe_status(task),
            "balanceAfterArchiveCheck": balance_final,
            "observedBalanceDeltaFinal": receipt.get("balanceBefore", balance_final)
            - balance_final,
            "archivedAtUtc": now(),
            "file": {
                "path": str(OUTPUT.relative_to(ART)),
                "bytes": OUTPUT.stat().st_size,
                "sha256": digest(OUTPUT),
            },
            "readiness": (
                "Review-only untextured geometry candidate. Inspect silhouette, rail alignment, "
                "foliage separation, and primary openings before authorizing the retexture stage."
            ),
        }
    )
    save(receipt)
    print(
        "MUSEUM_CONNECTOR_REMESH_ARCHIVED="
        + json.dumps(
            {
                "taskId": task_id,
                "status": receipt["finalStatus"],
                "observedBalanceDelta": receipt["observedBalanceDeltaFinal"],
                "balance": balance_final,
                "bytes": OUTPUT.stat().st_size,
                "sha256": digest(OUTPUT),
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
