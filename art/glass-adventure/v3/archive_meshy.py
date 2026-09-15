"""Archive completed Meshy outputs and hashes without persisting signed URLs.

Uses only the existing authenticated MCP launcher. No generation, retry of a
charged request, credential access, or shared-ledger mutation occurs here.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import struct
import sys
import time
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "v2"))
from meshy_pipeline import MCP, load, now, redact_signed_urls


def url_leaves(value, prefix):
    if isinstance(value, dict):
        for key, item in value.items():
            yield from url_leaves(item, f"{prefix}-{key}")
    elif isinstance(value, list):
        for index, item in enumerate(value):
            yield from url_leaves(item, f"{prefix}-{index}")
    elif isinstance(value, str) and value.startswith("https://"):
        yield prefix, value


def download_complete(url, partial):
    """Resume short CDN responses with verified ranges under a fixed deadline."""
    started = time.monotonic()
    offset = 0
    total = None
    partial.write_bytes(b"")
    for attempt in range(128):
        if time.monotonic() - started > 210:
            raise TimeoutError()
        request = Request(url, headers={
            "Accept-Encoding": "identity",
            "Range": f"bytes={offset}-{offset + 2 * 1024 * 1024 - 1}",
        })
        with urlopen(request, timeout=30) as response:
            if response.status == 206:
                match = re.fullmatch(r"bytes (\d+)-(\d+)/(\d+)",
                                     response.headers.get("Content-Range", ""))
                if not match or int(match[1]) != offset:
                    raise ValueError("Unexpected HTTP range")
                response_total = int(match[3])
                if total is not None and total != response_total:
                    raise ValueError("Remote file changed during archive")
                total = response_total
            elif response.status == 200 and offset == 0:
                length = response.headers.get("Content-Length")
                total = int(length) if length else None
            else:
                raise ValueError("Server did not honor archive resume range")
            before = offset
            with partial.open("ab") as output:
                while chunk := response.read(256 * 1024):
                    output.write(chunk)
                    offset += len(chunk)
                    if time.monotonic() - started > 210:
                        raise TimeoutError()
            if total is not None and offset == total:
                return
            if total is None and response.status == 200:
                return
            if offset <= before or (total is not None and offset > total):
                raise ValueError("Archive download made no valid progress")
    raise TimeoutError()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("name")
    args = parser.parse_args()
    job = next(j for j in load()["jobs"] if j["name"] == args.name)
    target = ROOT / "v2" / "meshy" / job["name"]
    target.mkdir(parents=True, exist_ok=True)
    with MCP() as client:
        result = client.request("tools/call", {
            "name": "meshy_get_task_status",
            "arguments": {"task_id": job["taskId"], "task_type": "image-to-3d",
                          "wait": False, "response_format": "json"},
        })
    if result.get("isError"):
        raise RuntimeError("Read-only Meshy status request failed; no output printed")
    task = None
    for block in result.get("content", []):
        if block.get("type") == "text":
            try:
                parsed = json.loads(block["text"])
                if isinstance(parsed, dict) and "status" in parsed:
                    task = parsed
                    break
            except ValueError:
                continue
    if not task or task["status"] != "SUCCEEDED":
        raise RuntimeError("No completed raw task response; no downloads attempted")
    (target / "provider-task.json").write_text(
        json.dumps(redact_signed_urls(task), indent=2) + "\n")
    receipt_path = target / "archive.json"
    receipt = json.loads(receipt_path.read_text()) if receipt_path.exists() else {
        "taskId": job["taskId"], "sourceReference": job["reference"],
        "inputSha256": job["inputSha256"], "parameters": job["parameters"],
        "files": [],
    }
    candidates = []
    for role, url in task.get("model_urls", {}).items():
        if url and role in {"glb", "pre_remeshed_glb"}:
            candidates.append((role, url, "donor.glb" if role == "glb" else "pre-remeshed.glb"))
    for field in ("texture_urls", "thumbnail_url", "thumbnail_urls"):
        for role, url in url_leaves(task.get(field), field):
            ext = Path(urlsplit(url).path).suffix.lower()
            if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
                ext = ".png"
            candidates.append((role, url, re.sub(r"[^a-zA-Z0-9_-]", "-", role) + ext))
    for role, url, filename in candidates:
        path = target / filename
        previous = next((f for f in receipt["files"] if f["role"] == role), None)
        if path.exists() and role in {"glb", "pre_remeshed_glb"}:
            with path.open("rb") as check:
                header = check.read(12)
            complete_glb = (len(header) == 12 and header[:4] == b"glTF"
                            and struct.unpack_from("<I", header, 8)[0] == path.stat().st_size)
            if not complete_glb:
                if previous:
                    raise RuntimeError(f"Previously archived GLB is incomplete: {filename}")
                path.replace(path.with_suffix(path.suffix + ".incomplete"))
        if path.exists():
            current_hash = hashlib.sha256(path.read_bytes()).hexdigest()
            if previous and previous["sha256"] != current_hash:
                raise RuntimeError(f"Preserved file changed: {filename}")
        else:
            partial = path.with_suffix(path.suffix + ".part")
            try:
                download_complete(url, partial)
                if role in {"glb", "pre_remeshed_glb"}:
                    with partial.open("rb") as check:
                        header = check.read(12)
                    if (len(header) != 12 or header[:4] != b"glTF"
                            or struct.unpack_from("<I", header, 8)[0] != partial.stat().st_size):
                            raise ValueError(f"Incomplete GLB: actual {partial.stat().st_size}, "
                                             f"declared {struct.unpack_from('<I', header, 8)[0] if len(header) == 12 else 0}")
                else:
                    with Image.open(partial) as decoded:
                        decoded.verify()
                    with Image.open(partial) as decoded:
                        decoded.load()
                partial.replace(path)
            except Exception as error:
                partial.unlink(missing_ok=True)
                code = getattr(error, "code", None)
                diagnostic = str(error) if isinstance(error, ValueError) else ""
                raise RuntimeError(f"Archive download failed for {role}: {type(error).__name__}"
                                   f" (HTTP {code}); {diagnostic}; URL suppressed") from None
            current_hash = hashlib.sha256(path.read_bytes()).hexdigest()
        item = {"role": role, "file": filename, "bytes": path.stat().st_size,
                "sha256": current_hash, "sourceHost": urlsplit(url).hostname}
        receipt["files"] = [f for f in receipt["files"] if f["role"] != role] + [item]
        receipt["archivedAt"] = now()
        temporary = receipt_path.with_suffix(".tmp")
        temporary.write_text(json.dumps(receipt, indent=2) + "\n")
        temporary.replace(receipt_path)
        if role == "glb":
            print(json.dumps({"name": job["name"], "donorReady": str(path),
                              "bytes": item["bytes"], "sha256": current_hash}), flush=True)
    receipt["complete"] = all(any(f["role"] == role for f in receipt["files"])
                              for role, _, _ in candidates)
    receipt["preRemeshedAvailable"] = bool(task.get("model_urls", {}).get("pre_remeshed_glb"))
    receipt_path.write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps({"name": job["name"], "complete": receipt["complete"],
                      "files": len(receipt["files"]),
                      "bytes": sum(f["bytes"] for f in receipt["files"]),
                      "preRemeshed": receipt["preRemeshedAvailable"]}))


if __name__ == "__main__":
    main()
