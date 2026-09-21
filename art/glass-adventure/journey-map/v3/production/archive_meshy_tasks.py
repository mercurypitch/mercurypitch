"""Archive the three already-submitted floating-museum Meshy tasks safely."""

from __future__ import annotations

import argparse
import datetime
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import struct
import sys
import termios
import time
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


HERE = Path(__file__).resolve().parent
ART = HERE.parent
REPO = HERE.parents[4]
TASKS = ART / "meshy" / "tasks.json"

ASSETS = {
    "temple": {
        "taskId": "01a0c1ef-9a17-7153-b8b2-384093df5d82",
        "guide": "concepts/temple-guide.png",
        "final": "meshy/floating-museum-temple-v3.glb",
        "preRemesh": "meshy/floating-museum-temple-v3-pre-remesh.glb",
    },
    "cliff": {
        "taskId": "01a0c1ef-fb0b-7173-9943-cb904a0e8df7",
        "guide": "concepts/cliff-guide.png",
        "final": "meshy/floating-museum-cliff-v3.glb",
        "preRemesh": "meshy/floating-museum-cliff-v3-pre-remesh.glb",
    },
    "cypress": {
        "taskId": "01a0c1f0-927c-76c7-8338-df243b4faa9f",
        "guide": "concepts/cypress-guide.png",
        "final": "meshy/floating-museum-cypress-v3.glb",
        "preRemesh": "meshy/floating-museum-cypress-v3-pre-remesh.glb",
    },
}


def now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(path: Path, value: dict[str, object]) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n")
    temporary.replace(path)


def load_meshy_pipeline():
    path = REPO / "art" / "glass-adventure" / "v2" / "meshy_pipeline.py"
    spec = importlib.util.spec_from_file_location("journey_map_v3_meshy_pipeline", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


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
    if (
        len(raw) < 12
        or raw[:4] != b"glTF"
        or struct.unpack_from("<I", raw, 8)[0] != len(raw)
    ):
        raise ValueError(f"Incomplete GLB at {path.name}")


def download_complete(url: str, destination: Path) -> None:
    """Download bounded CDN byte ranges while retaining the signed URL only in memory."""

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
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--status-stdin",
        action="store_true",
        help="Read authenticated task results and balance from stdin without persisting URLs.",
    )
    args = parser.parse_args()
    ledger = json.loads(TASKS.read_text())
    task_rows = {str(row["asset"]): row for row in ledger["tasks"]}
    if set(task_rows) != set(ASSETS):
        raise RuntimeError("tasks.json does not contain the exact approved three-asset batch")
    for asset, expected in ASSETS.items():
        if task_rows[asset].get("taskId") != expected["taskId"]:
            raise RuntimeError(f"Unexpected task ID for {asset}; refusing to substitute a job")

    tasks: dict[str, dict[str, object]] = {}
    if args.status_stdin:
        terminal = termios.tcgetattr(sys.stdin.fileno())
        terminal[3] &= ~termios.ECHO
        termios.tcsetattr(sys.stdin.fileno(), termios.TCSANOW, terminal)
        payload = json.loads(sys.stdin.readline())
        balance = int(payload["balance"])
        supplied = payload.get("tasks", {})
        for asset, expected in ASSETS.items():
            task = supplied.get(asset)
            if not isinstance(task, dict) or task.get("task_id") != expected["taskId"]:
                raise RuntimeError(f"Missing or mismatched authenticated status for {asset}")
            tasks[asset] = task
    else:
        pipeline = load_meshy_pipeline()
        with pipeline.MCP() as client:
            for asset, expected in ASSETS.items():
                tasks[asset] = client.tool(
                    "meshy_get_task_status",
                    {
                        "task_id": expected["taskId"],
                        "task_type": "image-to-3d",
                        "wait": False,
                        "response_format": "json",
                    },
                )
            balance = client.tool(
                "meshy_check_balance", {"response_format": "json"}
            )["balance"]

    archived_at = now()
    receipts: dict[str, dict[str, object]] = {}
    for asset, expected in ASSETS.items():
        task = tasks[asset]
        outcome = task.get("outcome") or task.get("status")
        if outcome != "SUCCEEDED":
            raise RuntimeError(f"Approved {asset} task is not complete: {outcome}")
        final = ART / str(expected["final"])
        pre_remesh = ART / str(expected["preRemesh"])
        if not final.is_file():
            raise FileNotFoundError(
                f"Final {asset} GLB must be downloaded through the Meshy tool first"
            )
        check_glb(final)
        source_url = task.get("model_urls", {}).get("pre_remeshed_glb")
        if not pre_remesh.is_file():
            if not source_url:
                raise RuntimeError(f"Meshy omitted the requested {asset} pre-remesh source")
            try:
                download_complete(str(source_url), pre_remesh)
            except Exception as error:
                code = getattr(error, "code", None)
                raise RuntimeError(
                    f"{asset} pre-remesh archive failed: {type(error).__name__} "
                    f"(HTTP {code}); URL suppressed"
                ) from None
        check_glb(pre_remesh)
        guide = ART / str(expected["guide"])
        receipts[asset] = {
            "schema": 1,
            "provider": "Meshy",
            "assetId": f"floating-museum-{asset}-v3",
            "taskType": "image-to-3d",
            "state": "archived",
            "authorization": ledger["authorization"],
            "taskId": expected["taskId"],
            "guide": {
                "file": str(expected["guide"]),
                "bytes": guide.stat().st_size,
                "sha256": digest(guide),
            },
            "finalStatus": safe_status(task),
            "archivedAtUtc": archived_at,
            "credentialsPersisted": False,
            "signedArtifactUrlsPersisted": False,
            "files": [
                {
                    "role": "glb",
                    "file": str(expected["final"]),
                    "bytes": final.stat().st_size,
                    "sha256": digest(final),
                },
                {
                    "role": "pre_remeshed_glb",
                    "file": str(expected["preRemesh"]),
                    "bytes": pre_remesh.stat().st_size,
                    "sha256": digest(pre_remesh),
                    "sourceHost": urlsplit(str(source_url)).hostname,
                },
            ],
            "balanceBeforeBatch": ledger["balanceBefore"],
            "balanceAfterArchiveCheck": balance,
            "readiness": (
                "Raw source archive only; Blender normalization, LOD, material sizing, "
                "fresh-export validation, and visual proof remain separate gates."
            ),
        }

    for asset, receipt in receipts.items():
        save(ART / "meshy" / f"{asset}-receipt.json", receipt)
        task_rows[asset].update(
            {
                "status": "archived",
                "consumedCredits": receipt["finalStatus"].get("consumed_credits"),
                "receipt": f"meshy/{asset}-receipt.json",
            }
        )
    ledger.update(
        {
            "state": "archived",
            "archivedAtUtc": archived_at,
            "balanceAfterArchiveCheck": balance,
            "consumedCreditsTotal": sum(
                int(receipt["finalStatus"].get("consumed_credits", 0))
                for receipt in receipts.values()
            ),
            "credentialsPersisted": False,
            "signedArtifactUrlsPersisted": False,
        }
    )
    save(TASKS, ledger)
    print(
        json.dumps(
            {
                "archived": sorted(receipts),
                "consumedCreditsTotal": ledger["consumedCreditsTotal"],
                "balance": balance,
            }
        )
    )


if __name__ == "__main__":
    main()
