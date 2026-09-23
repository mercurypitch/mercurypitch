"""Archive one receipt-guarded 110k Meshy remesh of the preserved V6 conservatory."""

from __future__ import annotations

import datetime
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import struct
import time
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


HERE = Path(__file__).resolve().parent
ART = HERE.parent
REPO = HERE.parents[4]
V6 = ART.parent / "v6"
PARENT_RECEIPT = V6 / "meshy" / "conservatory-receipt.json"
SOURCE = ART / "meshy" / "raw" / "conservatory-pre-remesh-v6.glb"
RECEIPT = ART / "meshy" / "conservatory-remesh-110k-receipt.json"
OUTPUT = ART / "meshy" / "conservatory-remesh-110k.glb"
INCOMPLETE_NATIVE_DOWNLOAD = (
    ART / "meshy" / "raw" / "conservatory-remesh-native-download-incomplete.glb.part"
)
TARGET_TRIANGLES = 110_000
EXPECTED_SOURCE_SHA256 = "7f9eefd963e7fdb7b4d9863a4588ad293d3f8a17c27a68fd359306d647b5b6f4"
KNOWN_LATEST_TASKS = {
    "remesh": {
        "taskId": "01a0c93d-d575-745f-9f91-c7206c4bab5d",
        "createdAt": 1_790_082_668_648,
    },
    "retexture": {
        "taskId": "01a0c946-928b-70b7-b8e0-7019de0d936e",
        "createdAt": 1_790_083_241_392,
    },
}


def now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(receipt: dict[str, object]) -> None:
    RECEIPT.parent.mkdir(parents=True, exist_ok=True)
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


def download_complete(url: str, destination: Path) -> None:
    """Download bounded CDN byte ranges while retaining the signed URL only in memory."""

    parts = urlsplit(url)
    if parts.scheme != "https" or parts.hostname != "assets.meshy.ai":
        raise ValueError("Remesh task returned no trusted GLB artifact URL")
    partial = destination.with_suffix(destination.suffix + ".part")
    partial.write_bytes(b"")
    offset = 0
    total = None
    started = time.monotonic()
    try:
        for _attempt in range(128):
            if time.monotonic() - started > 300:
                raise TimeoutError("Remesh archive exceeded five minutes")
            request = Request(
                url,
                headers={
                    "Accept-Encoding": "identity",
                    "Range": f"bytes={offset}-{offset + 2 * 1024 * 1024 - 1}",
                },
            )
            with urlopen(request, timeout=30) as response:
                if response.status == 206:
                    match = re.fullmatch(
                        r"bytes (\d+)-(\d+)/(\d+)",
                        response.headers.get("Content-Range", ""),
                    )
                    if not match or int(match[1]) != offset:
                        raise ValueError("Unexpected archive byte range")
                    response_total = int(match[3])
                    if total is not None and total != response_total:
                        raise ValueError("Remote remesh changed during archive")
                    total = response_total
                elif response.status == 200 and offset == 0:
                    length = response.headers.get("Content-Length")
                    total = int(length) if length else None
                else:
                    raise ValueError("Archive server did not honor requested range")
                before = offset
                with partial.open("ab") as output:
                    while chunk := response.read(256 * 1024):
                        output.write(chunk)
                        offset += len(chunk)
                if total is not None and offset == total:
                    check_glb(partial)
                    partial.replace(destination)
                    return
                if total is None and response.status == 200:
                    check_glb(partial)
                    partial.replace(destination)
                    return
                if offset <= before or (total is not None and offset > total):
                    raise ValueError("Archive download made no valid progress")
    except BaseException:
        partial.unlink(missing_ok=True)
        raise
    raise TimeoutError("Remesh archive exhausted its range attempts")


def safe_status(task: dict[str, object]) -> dict[str, object]:
    aliases = {
        "taskId": ("task_id", "taskId", "id"),
        "status": ("status",),
        "outcome": ("outcome",),
        "progress": ("progress",),
        "createdAt": ("created_at", "createdAt"),
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


def task_rows(value: object) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []

    def visit(item: object) -> None:
        if isinstance(item, dict):
            row = safe_status(item)
            if row.get("taskId"):
                rows.append(row)
            for child in item.values():
                visit(child)
        elif isinstance(item, list):
            for child in item:
                visit(child)

    visit(value)
    unique: dict[str, dict[str, object]] = {}
    for row in rows:
        unique[str(row["taskId"])] = row
    return sorted(
        unique.values(), key=lambda row: int(row.get("createdAt", 0)), reverse=True
    )


def load_meshy_pipeline():
    path = REPO / "art" / "glass-adventure" / "v2" / "meshy_pipeline.py"
    spec = importlib.util.spec_from_file_location("journey_map_v8_meshy_pipeline", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def validate_source() -> tuple[str, dict[str, object]]:
    check_glb(SOURCE)
    source_sha = digest(SOURCE)
    if source_sha != EXPECTED_SOURCE_SHA256:
        raise ValueError("The archived V8 source does not match the approved V6 pre-remesh GLB")
    parent = json.loads(PARENT_RECEIPT.read_text())
    source_rows = [
        row for row in parent.get("files", []) if row.get("role") == "pre_remeshed_glb"
    ]
    if len(source_rows) != 1 or source_rows[0].get("sha256") != source_sha:
        raise ValueError("The V6 provider receipt does not identify the archived source")
    task_id = str(parent.get("taskId", ""))
    if not task_id:
        raise ValueError("The V6 provider receipt has no parent task ID")
    return task_id, parent


def reconcile_provider(client: object) -> dict[str, object]:
    result: dict[str, object] = {
        "checkedAtUtc": now(),
        "purpose": "Confirm the interrupted V8 attempt created no unreceipted paid task.",
        "taskLists": {},
    }
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
        baseline = KNOWN_LATEST_TASKS[task_type]
        newer = [
            row
            for row in rows
            if int(row.get("createdAt", 0)) > int(baseline["createdAt"])
        ]
        if newer:
            raise RuntimeError(
                f"Unreconciled {task_type} task exists after the V7 baseline: "
                + ", ".join(str(row.get("taskId")) for row in newer)
            )
        if not any(row.get("taskId") == baseline["taskId"] for row in rows):
            raise RuntimeError(f"The known V7 {task_type} task is absent from provider history")
    result["balance"] = client.tool(
        "meshy_check_balance", {"response_format": "json"}
    )["balance"]
    result["conclusion"] = "No remesh or retexture task exists after the archived V7 tasks."
    return result


def main() -> None:
    parent_task_id, parent = validate_source()
    receipt = (
        json.loads(RECEIPT.read_text())
        if RECEIPT.exists()
        else {
            "schema": 1,
            "provider": "Meshy",
            "assetId": "floating-museum-conservatory-v8-candidate",
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
                "Owner explicitly authorized Meshy credits needed for the V8 conservatory repair."
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
            reconciliation = reconcile_provider(client)
            receipt["providerReconciliation"] = reconciliation
            balance_before = int(reconciliation["balance"])
            receipt["balanceBefore"] = balance_before
            save(receipt)

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
            save(receipt)
            result = client.tool(
                "meshy_remesh",
                {
                    "model_url": source_url,
                    **receipt["request"],
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
            save(receipt)
            if outcome in {"SUCCEEDED", "FAILED", "CANCELED"}:
                break
            time.sleep(8)
        if task is None:
            raise RuntimeError("Meshy remesh was not queried")
        outcome = task.get("outcome") or task.get("status")
        if outcome != "SUCCEEDED":
            raise RuntimeError(f"Meshy remesh did not succeed: {outcome}")
        if OUTPUT.exists():
            try:
                check_glb(OUTPUT)
            except ValueError:
                INCOMPLETE_NATIVE_DOWNLOAD.parent.mkdir(parents=True, exist_ok=True)
                if INCOMPLETE_NATIVE_DOWNLOAD.exists():
                    raise RuntimeError("Two incomplete native downloads need manual reconciliation")
                receipt["incompleteNativeDownload"] = {
                    "file": str(INCOMPLETE_NATIVE_DOWNLOAD.relative_to(ART)),
                    "bytes": OUTPUT.stat().st_size,
                    "sha256": digest(OUTPUT),
                    "cause": "MCP download exceeded its bounded request deadline",
                }
                OUTPUT.replace(INCOMPLETE_NATIVE_DOWNLOAD)
                save(receipt)
        if not OUTPUT.exists():
            source_url = task.get("model_urls", {}).get("glb")
            if source_url:
                download_complete(str(source_url), OUTPUT)
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
            "archiveDownload": {
                "method": "bounded CDN byte ranges or authenticated MCP download",
                "sourceHost": "assets.meshy.ai",
                "signedUrlPersisted": False,
            },
            "file": {
                "path": str(OUTPUT.relative_to(ART)),
                "bytes": OUTPUT.stat().st_size,
                "sha256": digest(OUTPUT),
            },
            "readiness": (
                "Review-only untextured geometry candidate. Inspect ribs, bays, foliage silhouette, "
                "circular plinth, primary openings, and finial before retexture."
            ),
        }
    )
    save(receipt)
    print(
        "CONSERVATORY_REMESH_ARCHIVED="
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
