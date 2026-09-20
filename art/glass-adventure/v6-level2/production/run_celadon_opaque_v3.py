"""Submit and archive one receipt-guarded Celadon donor from the opaque guide."""

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
ROOT = HERE.parent
GUIDE = ROOT / "concepts" / "celadon-lark-opaque-guide-v3.png"
REQUEST = ROOT / "meshy" / "celadon-lark-decanter-opaque-v3-request.json"
RECEIPT = ROOT / "meshy" / "celadon-lark-decanter-opaque-v3-receipt.json"
FINAL = ROOT / "meshy" / "celadon-lark-decanter-opaque-v3.glb"
PRE_REMESH = ROOT / "meshy" / "celadon-lark-decanter-opaque-v3-pre-remesh.glb"
TARGET_TRIANGLES = 16_000


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


def save(path: Path, value: dict[str, object]) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n")
    temporary.replace(path)


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


def check_glb(path: Path) -> None:
    raw = path.read_bytes()
    if len(raw) < 12 or raw[:4] != b"glTF" or struct.unpack_from("<I", raw, 8)[0] != len(raw):
        raise ValueError(f"Incomplete GLB at {path.name}")


def download_complete(url: str, destination: Path) -> None:
    """Resume bounded CDN ranges while keeping the signed URL only in memory."""

    partial = destination.with_suffix(destination.suffix + ".part")
    partial.write_bytes(b"")
    offset = 0
    total = None
    started = time.monotonic()
    try:
        for _attempt in range(128):
            if time.monotonic() - started > 240:
                raise TimeoutError("Pre-remesh archive exceeded four minutes")
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
                        raise ValueError("Remote source changed during archive")
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
    raise TimeoutError("Pre-remesh archive exhausted its range attempts")


def main() -> None:
    if not GUIDE.is_file():
        raise FileNotFoundError(GUIDE)
    parameters = {
        "ai_model": "meshy-6",
        "file_path": str(GUIDE),
        "model_type": "standard",
        "should_texture": True,
        "enable_pbr": True,
        "should_remesh": True,
        "target_polycount": TARGET_TRIANGLES,
        "topology": "triangle",
        "target_formats": ["glb"],
        "texture_prompt": (
            "Opaque pale celadon glazed ceramic body with restrained champagne-gold fused "
            "bands and trim, two pale celadon cabochons, and an ivory marble foot. Preserve "
            "the tall pear silhouette, scalloped rim, large clean facets, and integrated low "
            "relief ornament. No transparency, refraction, floating parts, ground, or scene."
        ),
        "remove_lighting": True,
        "save_pre_remeshed_model": True,
        "image_enhancement": False,
        "multi_view_thumbnails": True,
        "origin_at": "bottom",
        "response_format": "json",
    }
    request_record: dict[str, object] = {
        "schema": 1,
        "provider": "Meshy",
        "assetId": "celadon-lark-decanter",
        "variant": "opaque-guide-v3",
        "taskType": "image-to-3d",
        "authorization": (
            "Standing user authorization covers broad Meshy asset generation and credit spend. "
            "Upload of this exact locally generated guide to Meshy awaits the automatic-review-"
            "requested explicit confirmation."
        ),
        "submissionApproval": "pending exact guide upload confirmation",
        "guide": {
            "file": str(GUIDE.relative_to(ROOT)),
            "bytes": GUIDE.stat().st_size,
            "sha256": digest(GUIDE),
        },
        "request": {key: value for key, value in parameters.items() if key != "file_path"},
        "credentialsPersisted": False,
        "signedArtifactUrlsPersisted": False,
        "readiness": (
            "Generation request only; strict topology, cavity, fracture, runtime export, and "
            "proofs remain gated."
        ),
    }
    if REQUEST.exists():
        previous = json.loads(REQUEST.read_text())
        if previous.get("guide", {}).get("sha256") != request_record["guide"]["sha256"]:
            raise RuntimeError("Existing request belongs to a different guide; do not resubmit")
        request_record = previous
    else:
        save(REQUEST, request_record)

    receipt: dict[str, object] = json.loads(RECEIPT.read_text()) if RECEIPT.exists() else {
        "schema": 1,
        "provider": "Meshy",
        "assetId": "celadon-lark-decanter",
        "variant": "opaque-guide-v3",
        "taskType": "image-to-3d",
        "state": "not-submitted",
        "guideSha256": digest(GUIDE),
        "credentialsPersisted": False,
        "signedArtifactUrlsPersisted": False,
    }
    if not RECEIPT.exists():
        save(RECEIPT, receipt)
    pipeline = load_meshy_pipeline()
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
            save(RECEIPT, receipt)
            result = client.tool("meshy_image_to_3d", parameters)
            task_id = result.get("task_id")
            if not task_id:
                raise RuntimeError("Meshy returned no task ID; reconcile receipt before retrying")
            balance_after = client.tool("meshy_check_balance", {"response_format": "json"})[
                "balance"
            ]
            receipt.update(
                {
                    "taskId": task_id,
                    "state": "submitted",
                    "balanceAfterSubmit": balance_after,
                    "observedBalanceDelta": balance_before - balance_after,
                }
            )
            request_record["taskId"] = task_id
            save(REQUEST, request_record)
            save(RECEIPT, receipt)
            print(
                "CELADON_OPAQUE_SUBMITTED="
                + json.dumps(
                    {
                        "taskId": task_id,
                        "observedBalanceDelta": balance_before - balance_after,
                        "balance": balance_after,
                    }
                ),
                flush=True,
            )

        task_id = str(receipt["taskId"])
        task: dict[str, object] | None = None
        for _attempt in range(90):
            task = client.tool(
                "meshy_get_task_status",
                {
                    "task_id": task_id,
                    "task_type": "image-to-3d",
                    "wait": False,
                    "response_format": "json",
                },
            )
            outcome = task.get("outcome") or task.get("status")
            receipt["lastStatus"] = safe_status(task)
            receipt["lastCheckedAtUtc"] = now()
            save(RECEIPT, receipt)
            print(
                "CELADON_OPAQUE_PROGRESS="
                + json.dumps({"taskId": task_id, "outcome": outcome, "progress": task.get("progress")}),
                flush=True,
            )
            if outcome in {"SUCCEEDED", "FAILED", "CANCELED"}:
                break
            time.sleep(8)
        if task is None:
            raise RuntimeError("Meshy task was not queried")
        outcome = task.get("outcome") or task.get("status")
        if outcome != "SUCCEEDED":
            raise RuntimeError(f"Meshy task did not succeed: {outcome}")
        if not FINAL.exists():
            client.tool(
                "meshy_download_model",
                {
                    "task_id": task_id,
                    "task_type": "image-to-3d",
                    "format": "glb",
                    "include_textures": False,
                    "save_to": str(FINAL),
                },
            )
        check_glb(FINAL)
        source_url = task.get("model_urls", {}).get("pre_remeshed_glb")
        if not PRE_REMESH.exists():
            if not source_url:
                raise RuntimeError("Meshy result omitted the requested pre-remesh source")
            try:
                download_complete(str(source_url), PRE_REMESH)
            except Exception as error:
                code = getattr(error, "code", None)
                raise RuntimeError(
                    f"Pre-remesh archive failed: {type(error).__name__} (HTTP {code}); URL suppressed"
                ) from None
        check_glb(PRE_REMESH)
        balance_final = client.tool("meshy_check_balance", {"response_format": "json"})[
            "balance"
        ]

    receipt.update(
        {
            "state": "archived",
            "finalStatus": safe_status(task),
            "balanceAfterArchiveCheck": balance_final,
            "archivedAtUtc": now(),
            "files": [
                {
                    "role": "glb",
                    "file": str(FINAL.relative_to(ROOT)),
                    "bytes": FINAL.stat().st_size,
                    "sha256": digest(FINAL),
                },
                {
                    "role": "pre_remeshed_glb",
                    "file": str(PRE_REMESH.relative_to(ROOT)),
                    "bytes": PRE_REMESH.stat().st_size,
                    "sha256": digest(PRE_REMESH),
                    "sourceHost": urlsplit(str(source_url)).hostname,
                },
            ],
            "readiness": (
                "Raw Meshy sources only; the separate strict topology audit determines whether "
                "cavity and fracture work may begin."
            ),
        }
    )
    save(RECEIPT, receipt)
    print(
        "CELADON_OPAQUE_ARCHIVED="
        + json.dumps(
            {
                "taskId": task_id,
                "consumedCredits": receipt.get("finalStatus", {}).get("consumed_credits"),
                "balance": balance_final,
                "glbBytes": FINAL.stat().st_size,
                "glbSha256": digest(FINAL),
                "preRemeshBytes": PRE_REMESH.stat().st_size,
                "preRemeshSha256": digest(PRE_REMESH),
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
