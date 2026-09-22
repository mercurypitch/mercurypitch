"""Archive one receipt-guarded Meshy PBR retexture of the V7 connector remesh."""

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
REMESH_RECEIPT = ART / "meshy" / "twin-connector-remesh-100k-receipt.json"
SOURCE = ART / "meshy" / "twin-connector-remesh-100k.glb"
RECEIPT = ART / "meshy" / "twin-connector-remesh-100k-retexture-pbr-receipt.json"
OUTPUT = ART / "meshy" / "twin-connector-remesh-100k-retexture-pbr.glb"
INCOMPLETE_NATIVE_DOWNLOAD = (
    ART / "meshy" / "raw" / "twin-connector-retexture-native-download-incomplete.glb.part"
)
EXPECTED_SOURCE_SHA256 = "862ff6575fdd69bf2da46f65f51b85519b6d65304eaaaf2e2f2990161f468f91"
TEXTURE_PROMPT = (
    "Premium magical floating-museum architecture. Ivory Carrara marble piers, arches, "
    "ribs and balustrades with restrained warm brass and gold acanthus trim and finials. "
    "Botanical drapery is deep realistic emerald foliage with individually readable green "
    "leaves and sparse ivory and blush-pink flowers. Clean physically based materials, fine "
    "carved relief, no baked shadows, no blue panels, no dirt, and no painted-on geometry."
)


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


def download_complete(url: str, destination: Path) -> None:
    """Download bounded CDN byte ranges while retaining the signed URL only in memory."""

    parts = urlsplit(url)
    if parts.scheme != "https" or parts.hostname != "assets.meshy.ai":
        raise ValueError("Retexture task returned no trusted GLB artifact URL")
    partial = destination.with_suffix(destination.suffix + ".part")
    partial.write_bytes(b"")
    offset = 0
    total = None
    started = time.monotonic()
    try:
        for _attempt in range(128):
            if time.monotonic() - started > 300:
                raise TimeoutError("Retexture archive exceeded five minutes")
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
                        raise ValueError("Remote retexture changed during archive")
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
    raise TimeoutError("Retexture archive exhausted its range attempts")


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


def main() -> None:
    check_glb(SOURCE)
    source_sha = digest(SOURCE)
    if source_sha != EXPECTED_SOURCE_SHA256:
        raise ValueError("The retexture source differs from the inspected 100k remesh")
    remesh = json.loads(REMESH_RECEIPT.read_text())
    if remesh.get("state") != "archived" or remesh.get("file", {}).get("sha256") != source_sha:
        raise ValueError("The remesh receipt does not archive the inspected source")
    parent_task_id = str(remesh.get("taskId", ""))
    if not parent_task_id:
        raise ValueError("The remesh receipt has no provider task ID")

    receipt = (
        json.loads(RECEIPT.read_text())
        if RECEIPT.exists()
        else {
            "schema": 1,
            "provider": "Meshy",
            "assetId": "floating-museum-twin-connector-v7-candidate",
            "operation": "retexture",
            "parentTaskId": parent_task_id,
            "source": {
                "file": str(SOURCE.relative_to(ART)),
                "bytes": SOURCE.stat().st_size,
                "sha256": source_sha,
                "triangles": 102_607,
            },
            "request": {
                "text_style_prompt": TEXTURE_PROMPT,
                "ai_model": "meshy-6",
                "enable_original_uv": True,
                "enable_pbr": True,
                "hd_texture": False,
                "remove_lighting": True,
                "target_formats": ["glb"],
                "alpha_thumbnail": True,
                "response_format": "json",
            },
            "authorization": (
                "Owner authorized unrestricted Meshy use for Glassworks asset production; "
                "this finishes the first bounded one-connector quality candidate."
            ),
            "estimatedCredits": 10,
            "expectedTextureResolution": "2K base color and PBR maps",
            "credentialsPersisted": False,
            "providerUrlsPersisted": False,
            "state": "not-submitted",
        }
    )
    if receipt.get("parentTaskId") != parent_task_id:
        raise ValueError("Receipt parent task changed")
    if receipt.get("source", {}).get("sha256") != source_sha:
        raise ValueError("Receipt source changed")
    if receipt.get("request", {}).get("text_style_prompt") != TEXTURE_PROMPT:
        raise ValueError("Receipt texture prompt changed")
    if receipt.get("state") == "submission-unconfirmed" and not receipt.get("taskId"):
        raise RuntimeError("Earlier submission is ambiguous; reconcile it before any retry")

    pipeline = load_meshy_pipeline()
    with pipeline.MCP() as client:
        if not receipt.get("taskId"):
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
                "meshy_retexture",
                {
                    "input_task_id": parent_task_id,
                    **receipt["request"],
                },
            )
            task_id = result.get("task_id")
            if not task_id:
                raise RuntimeError("Meshy retexture returned no task ID; do not retry")
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
        for _attempt in range(42):
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
            save(receipt)
            if outcome in {"SUCCEEDED", "FAILED", "CANCELED"}:
                break
            time.sleep(8)
        if task is None:
            raise RuntimeError("Meshy retexture was not queried")
        outcome = task.get("outcome") or task.get("status")
        if outcome != "SUCCEEDED":
            raise RuntimeError(f"Meshy retexture did not succeed: {outcome}")
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
            if not source_url:
                raise RuntimeError("Completed retexture task omitted its GLB artifact URL")
            download_complete(str(source_url), OUTPUT)
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
                "method": "bounded CDN byte ranges from authenticated task status",
                "sourceHost": "assets.meshy.ai",
                "signedUrlPersisted": False,
            },
            "file": {
                "path": str(OUTPUT.relative_to(ART)),
                "bytes": OUTPUT.stat().st_size,
                "sha256": digest(OUTPUT),
            },
            "readiness": (
                "Review-only provider PBR candidate. Blender normalization, material audit, "
                "fresh-export validation, and visual acceptance remain separate gates."
            ),
        }
    )
    save(receipt)
    print(
        "MUSEUM_CONNECTOR_RETEXTURE_ARCHIVED="
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
