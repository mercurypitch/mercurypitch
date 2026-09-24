"""Archive Cloudway Meshy donors, pre-remesh sources, PBR maps, and safe receipts."""

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
TASKS = ART / "meshy" / "tasks.json"
PIPELINE = REPO / "art" / "glass-adventure" / "v2" / "meshy_pipeline.py"


def now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(path: Path, value: object) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n")
    temporary.replace(path)


def load_pipeline():
    spec = importlib.util.spec_from_file_location("cloudway_meshy_pipeline", PIPELINE)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {PIPELINE}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def check_glb(path: Path) -> None:
    raw = path.read_bytes()
    if len(raw) < 12 or raw[:4] != b"glTF" or struct.unpack_from("<I", raw, 8)[0] != len(raw):
        raise ValueError(f"Incomplete GLB at {path}")


def png_dimensions(path: Path) -> list[int]:
    raw = path.read_bytes()[:24]
    if raw[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"Expected PNG at {path}")
    return list(struct.unpack(">II", raw[16:24]))


def download_complete(url: str, destination: Path) -> None:
    """Download bounded CDN byte ranges while retaining the signed URL only in memory."""

    partial = destination.with_suffix(destination.suffix + ".part")
    partial.write_bytes(b"")
    offset = 0
    total = None
    started = time.monotonic()
    try:
        for _attempt in range(256):
            if time.monotonic() - started > 300:
                raise TimeoutError("Pre-remesh archive exceeded five minutes")
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
    ledger = json.loads(TASKS.read_text())
    rows = {str(row["id"]): row for row in ledger["tasks"]}
    if set(rows) != {"marble", "frost", "glide"}:
        raise RuntimeError("Expected exactly the approved marble/frost/glide batch")
    pipeline = load_pipeline()
    tasks: dict[str, dict[str, object]] = {}
    with pipeline.MCP() as client:
        for asset, row in rows.items():
            tasks[asset] = client.tool(
                "meshy_get_task_status",
                {
                    "task_id": row["taskId"],
                    "task_type": "image-to-3d",
                    "wait": False,
                    "response_format": "json",
                },
            )
        balance = client.tool("meshy_check_balance", {"response_format": "json"})["balance"]

    archived_at = now()
    total_credits = 0
    for asset, row in rows.items():
        task = tasks[asset]
        if (task.get("outcome") or task.get("status")) != "SUCCEEDED":
            raise RuntimeError(f"{asset} task is not complete")
        folder = ART / "meshy" / asset
        final = folder / "donor.glb"
        pre_remesh = folder / "pre-remeshed.glb"
        check_glb(final)
        source_url = task.get("model_urls", {}).get("pre_remeshed_glb")
        if not source_url:
            raise RuntimeError(f"Meshy omitted the {asset} pre-remesh source")
        if not pre_remesh.is_file():
            try:
                download_complete(str(source_url), pre_remesh)
            except Exception as error:
                code = getattr(error, "code", None)
                raise RuntimeError(
                    f"{asset} pre-remesh archive failed: {type(error).__name__} "
                    f"(HTTP {code}); URL suppressed"
                ) from None
        check_glb(pre_remesh)
        guide = (ART / "meshy" / str(row["guide"])).resolve()
        textures = []
        for texture in sorted((folder / "donor_textures").glob("*.png")):
            textures.append(
                {
                    "file": str(texture.relative_to(ART)),
                    "bytes": texture.stat().st_size,
                    "sha256": digest(texture),
                    "dimensions": png_dimensions(texture),
                }
            )
        credits = int(task.get("consumed_credits", 0))
        total_credits += credits
        receipt = {
            "schema": 1,
            "provider": "Meshy",
            "assetId": f"cloudway-{asset}-platform-v1",
            "taskType": "image-to-3d",
            "state": "raw-source-archived",
            "authorization": ledger["authorization"],
            "taskId": row["taskId"],
            "submittedSettings": ledger["sharedRequest"],
            "texturePrompt": row["texturePrompt"],
            "guide": {
                "file": str(guide.relative_to(ART)),
                "bytes": guide.stat().st_size,
                "sha256": digest(guide),
            },
            "finalStatus": safe_status(task),
            "archivedAtUtc": archived_at,
            "credentialsPersisted": False,
            "signedArtifactUrlsPersisted": False,
            "files": [
                {
                    "role": "remeshed_glb",
                    "file": str(final.relative_to(ART)),
                    "bytes": final.stat().st_size,
                    "sha256": digest(final),
                },
                {
                    "role": "pre_remeshed_glb",
                    "file": str(pre_remesh.relative_to(ART)),
                    "bytes": pre_remesh.stat().st_size,
                    "sha256": digest(pre_remesh),
                    "sourceHost": urlsplit(str(source_url)).hostname,
                },
                *[{"role": "pbr_map", **entry} for entry in textures],
            ],
            "readiness": "Raw source archive; Blender normalization, landing-plane repair, LOD, fracture, export validation, and proof remain separate gates.",
        }
        # Persist only the provider state and local, hashed archive references.
        # Even redacted signed URLs retain query-parameter names and do not
        # belong in the source archive.
        save(
            folder / "provider-status.json",
            {
                "schema": 1,
                "provider": "Meshy",
                "taskType": "image-to-3d",
                "taskId": row["taskId"],
                "finalStatus": safe_status(task),
                "archivedAtUtc": archived_at,
                "artifacts": [
                    {
                        key: value
                        for key, value in file.items()
                        if key in {"role", "file", "bytes", "sha256", "dimensions"}
                    }
                    for file in receipt["files"]
                ],
                "credentialsPersisted": False,
                "signedArtifactUrlsPersisted": False,
            },
        )
        save(folder / "receipt.json", receipt)
        row.update(
            {
                "status": "raw-source-archived",
                "consumedCredits": credits,
                "receipt": f"{asset}/receipt.json",
            }
        )

    ledger.update(
        {
            "state": "raw-source-archived",
            "archivedAtUtc": archived_at,
            "balanceAfterArchiveCheck": balance,
            "consumedCreditsTotal": total_credits,
            "credentialsPersisted": False,
            "signedArtifactUrlsPersisted": False,
        }
    )
    save(TASKS, ledger)
    print(json.dumps({"archived": sorted(rows), "credits": total_credits, "balance": balance}))


if __name__ == "__main__":
    main()
