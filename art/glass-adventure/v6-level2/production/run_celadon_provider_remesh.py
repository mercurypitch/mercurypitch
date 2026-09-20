"""Reconcile one receipt-guarded Meshy remesh from its provider-owned parent task."""

from __future__ import annotations

import datetime
import hashlib
import importlib.util
import json
from pathlib import Path
import time


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
PARENT_REQUEST = ROOT / "meshy" / "celadon-lark-decanter-regeneration-v2-request.json"
RECEIPT = ROOT / "meshy" / "celadon-lark-decanter-remesh-35k-v3-receipt.json"
OUTPUT = ROOT / "meshy" / "celadon-lark-decanter-remesh-35k-v3.glb"
TARGET_TRIANGLES = 35000


def now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_meshy_pipeline():
    path = ROOT.parent / "v2" / "meshy_pipeline.py"
    spec = importlib.util.spec_from_file_location("v2_meshy_pipeline", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def save(receipt: dict[str, object]) -> None:
    temporary = RECEIPT.with_suffix(".tmp")
    temporary.write_text(json.dumps(receipt, indent=2) + "\n")
    temporary.replace(RECEIPT)


def safe_status(task: dict[str, object]) -> dict[str, object]:
    return {
        key: task.get(key)
        for key in (
            "task_id",
            "status",
            "outcome",
            "progress",
            "consumed_credits",
            "face_count",
            "vertex_count",
            "error_code",
            "error_message",
        )
        if task.get(key) is not None
    }


def main() -> None:
    parent = json.loads(PARENT_REQUEST.read_text())
    parent_task_id = parent["taskId"]
    pipeline = load_meshy_pipeline()
    receipt = json.loads(RECEIPT.read_text()) if RECEIPT.exists() else {
        "schema": 1,
        "provider": "Meshy",
        "assetId": "celadon-lark-decanter",
        "operation": "remesh",
        "parentTaskId": parent_task_id,
        "sourceVariant": "provider-owned parent task",
        "request": {
            "topology": "triangle",
            "target_polycount": TARGET_TRIANGLES,
            "target_formats": ["glb"],
            "origin_at": "bottom",
            "response_format": "json",
        },
        "authorization": "Standing user authorization for this bounded Meshy finishing stage; one 5-credit remesh attempt was explicitly authorized after local strict-topology reductions failed.",
        "credentialsPersisted": False,
        "providerUrlsPersisted": False,
        "state": "not-submitted",
    }
    with pipeline.MCP() as client:
        if not receipt.get("taskId"):
            balance_before = client.tool("meshy_check_balance", {"response_format": "json"})[
                "balance"
            ]
            receipt.update(
                {
                    "balanceBefore": balance_before,
                    "submittedAtUtc": now(),
                    "state": "submission-unconfirmed",
                }
            )
            save(receipt)
            result = client.tool(
                "meshy_remesh",
                {
                    "input_task_id": parent_task_id,
                    "topology": "triangle",
                    "target_polycount": TARGET_TRIANGLES,
                    "target_formats": ["glb"],
                    "origin_at": "bottom",
                    "response_format": "json",
                },
            )
            task_id = result.get("task_id")
            if not task_id:
                raise RuntimeError("Meshy remesh submission returned no task ID; do not retry")
            balance_after_submit = client.tool(
                "meshy_check_balance", {"response_format": "json"}
            )["balance"]
            receipt.update(
                {
                    "taskId": task_id,
                    "state": "submitted",
                    "balanceAfterSubmit": balance_after_submit,
                    "observedBalanceDelta": balance_before - balance_after_submit,
                }
            )
            save(receipt)
        task_id = receipt["taskId"]
        task = None
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
        balance_final = client.tool("meshy_check_balance", {"response_format": "json"})[
            "balance"
        ]
    raw = OUTPUT.read_bytes()
    if len(raw) < 12 or raw[:4] != b"glTF" or int.from_bytes(raw[8:12], "little") != len(raw):
        raise ValueError("Downloaded Celadon remesh GLB is incomplete")
    receipt.update(
        {
            "state": "archived",
            "finalStatus": safe_status(task),
            "balanceAfterArchiveCheck": balance_final,
            "archivedAtUtc": now(),
            "file": {
                "path": str(OUTPUT.relative_to(ROOT)),
                "bytes": OUTPUT.stat().st_size,
                "sha256": digest(OUTPUT),
            },
            "readiness": "Raw remesh only; the separate strict-topology report determines production rejection or continuation.",
        }
    )
    save(receipt)
    print(
        "CELADON_PROVIDER_REMESH_ARCHIVED="
        + json.dumps(
            {
                "taskId": task_id,
                "status": receipt["finalStatus"],
                "observedBalanceDelta": receipt.get("observedBalanceDelta"),
                "balance": balance_final,
                "bytes": OUTPUT.stat().st_size,
                "sha256": digest(OUTPUT),
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
