"""Archive the Celadon regeneration pre-remesh source without persisting signed URLs."""

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
REQUEST = ROOT / "meshy" / "celadon-lark-decanter-regeneration-v2-request.json"
FINAL = ROOT / "meshy" / "celadon-lark-decanter-regenerated-v2.glb"
PRE_REMESH = ROOT / "meshy" / "celadon-lark-decanter-regenerated-v2-pre-remesh.glb"
RECEIPT = ROOT / "meshy" / "celadon-lark-decanter-regeneration-v2-receipt.json"


def load_meshy_pipeline():
    path = ROOT.parent / "v2" / "meshy_pipeline.py"
    spec = importlib.util.spec_from_file_location("v2_meshy_pipeline", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def check_glb(path: Path) -> None:
    raw = path.read_bytes()
    if len(raw) < 12 or raw[:4] != b"glTF" or struct.unpack_from("<I", raw, 8)[0] != len(raw):
        raise ValueError(f"Incomplete GLB at {path.name}")


def download_complete(url: str, partial: Path) -> None:
    """Resume bounded CDN ranges while keeping the signed URL inside this process."""

    started = time.monotonic()
    offset = 0
    total = None
    partial.write_bytes(b"")
    for _attempt in range(128):
        if time.monotonic() - started > 240:
            raise TimeoutError("Celadon source archive exceeded four minutes")
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
                    r"bytes (\d+)-(\d+)/(\d+)", response.headers.get("Content-Range", "")
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
                raise ValueError("Archive server did not honor the requested range")
            before = offset
            with partial.open("ab") as output:
                while chunk := response.read(256 * 1024):
                    output.write(chunk)
                    offset += len(chunk)
            if total is not None and offset == total:
                return
            if total is None and response.status == 200:
                return
            if offset <= before or (total is not None and offset > total):
                raise ValueError("Archive download made no valid progress")
    raise TimeoutError("Celadon source archive exhausted its range attempts")


def main() -> None:
    request = json.loads(REQUEST.read_text())
    task_id = request["taskId"]
    pipeline = load_meshy_pipeline()
    with pipeline.MCP() as client:
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
        if outcome != "SUCCEEDED":
            raise RuntimeError(f"Celadon task is not ready: {outcome}")
        source_url = task.get("model_urls", {}).get("pre_remeshed_glb")
        if not source_url:
            raise RuntimeError("Celadon task did not expose a pre-remesh GLB")
        balance = client.tool("meshy_check_balance", {"response_format": "json"})["balance"]

    check_glb(FINAL)
    if PRE_REMESH.exists():
        check_glb(PRE_REMESH)
    else:
        partial = PRE_REMESH.with_suffix(".glb.part")
        try:
            download_complete(source_url, partial)
            check_glb(partial)
            partial.replace(PRE_REMESH)
        except Exception as error:
            partial.unlink(missing_ok=True)
            code = getattr(error, "code", None)
            raise RuntimeError(
                f"Celadon pre-remesh archive failed: {type(error).__name__} (HTTP {code}); URL suppressed"
            ) from None

    receipt = {
        "schema": 1,
        "provider": "Meshy",
        "assetId": "celadon-lark-decanter",
        "taskType": "image-to-3d",
        "taskId": task_id,
        "status": "SUCCEEDED",
        "progress": task.get("progress"),
        "consumedCredits": task.get("consumed_credits", 30),
        "balanceAfterArchiveCheck": balance,
        "archivedAtUtc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
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
                "sourceHost": urlsplit(source_url).hostname,
            },
        ],
        "providerUrlsPersisted": False,
        "credentialsPersisted": False,
        "readiness": "Raw Meshy sources only; topology, cavity, fracture, runtime export, and proofs remain gated.",
    }
    RECEIPT.write_text(json.dumps(receipt, indent=2) + "\n")
    print(
        "CELADON_REGENERATION_ARCHIVED="
        + json.dumps(
            {
                "taskId": task_id,
                "status": receipt["status"],
                "consumedCredits": receipt["consumedCredits"],
                "balance": balance,
                "preRemeshBytes": PRE_REMESH.stat().st_size,
                "preRemeshSha256": digest(PRE_REMESH),
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
