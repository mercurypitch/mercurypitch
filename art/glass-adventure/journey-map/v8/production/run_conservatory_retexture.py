"""Archive one receipt-guarded Meshy PBR retexture of the accepted V8 remesh."""

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
REMESH_RECEIPT = ART / "meshy" / "conservatory-remesh-110k-receipt.json"
SOURCE = ART / "meshy" / "conservatory-remesh-110k.glb"
CLAY_MANIFEST = ART / "proofs" / "conservatory-geometry-comparison-v8.json"
CLAY_REVIEW = ART / "proofs" / "conservatory-remesh-clay-review-v8.json"
RECEIPT = ART / "meshy" / "conservatory-remesh-110k-retexture-pbr-receipt.json"
OUTPUT = ART / "meshy" / "conservatory-remesh-110k-retexture-pbr.glb"
INCOMPLETE_NATIVE_DOWNLOAD = (
    ART / "meshy" / "raw" / "conservatory-retexture-native-download-incomplete.glb.part"
)
TEXTURE_PROMPT = (
    "Premium magical floating-museum botanical conservatory. Ivory Carrara marble columns, "
    "plinth, steps and carved ribs; restrained warm brass Corinthian capitals, gold ribs and "
    "finial; pale celadon clear glass canopy; deep emerald ivy with individually readable "
    "leaves and sparse ivory and blush flowers. Preserve the open arched bays, planters and "
    "central urn as geometry. Clean physically based materials, no baked shadows, no opaque "
    "turquoise panels, no dirt, and no painted-on geometry."
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


def triangle_count(path: Path) -> int:
    raw = path.read_bytes()
    json_length, json_type = struct.unpack_from("<II", raw, 12)
    if json_type != 0x4E4F534A:
        raise ValueError(f"{path.name} has no JSON chunk")
    document = json.loads(raw[20 : 20 + json_length].decode("utf-8").rstrip(" \x00"))
    total = 0
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            if int(primitive.get("mode", 4)) != 4:
                raise ValueError("Retexture source contains a non-triangle primitive")
            if "indices" in primitive:
                count = int(document["accessors"][int(primitive["indices"])]["count"])
            else:
                position = int(primitive["attributes"]["POSITION"])
                count = int(document["accessors"][position]["count"])
            if count % 3:
                raise ValueError("Retexture source has an incomplete triangle")
            total += count // 3
    return total


def validate_clay_review(source_sha: str, triangles: int) -> dict[str, object]:
    if not CLAY_MANIFEST.is_file() or not CLAY_REVIEW.is_file():
        raise FileNotFoundError("Hash-bound clay comparison and review are required before retexture")
    manifest = json.loads(CLAY_MANIFEST.read_text())
    review = json.loads(CLAY_REVIEW.read_text())
    if review.get("decision") != "accepted-for-pbr-retexture":
        raise ValueError("Clay review did not accept this remesh for PBR retexture")
    if review.get("source", {}).get("sha256") != source_sha:
        raise ValueError("Clay review source hash differs from the remesh")
    if int(review.get("source", {}).get("triangles", -1)) != triangles:
        raise ValueError("Clay review triangle count differs from the remesh")
    expected_manifest = review.get("comparisonManifest", {})
    if expected_manifest.get("sha256") != digest(CLAY_MANIFEST):
        raise ValueError("Clay comparison manifest changed after review")
    rows = [row for row in manifest.get("assets", []) if row.get("name") == "v8-remesh-110k"]
    if len(rows) != 1 or rows[0].get("sha256") != source_sha or int(rows[0].get("triangles", -1)) != triangles:
        raise ValueError("Clay comparison did not render the reviewed remesh")
    manifest_proofs = {
        str(row.get("file")): str(row.get("sha256"))
        for row in manifest.get("proofs", [])
    }
    reviewed_proofs = {
        str(row.get("file")): str(row.get("sha256"))
        for row in review.get("proofs", [])
    }
    if reviewed_proofs != manifest_proofs or len(reviewed_proofs) != 2:
        raise ValueError("Clay review proof set differs from the rendered comparison")
    for relative, expected_sha in reviewed_proofs.items():
        proof = ART / relative
        if not proof.is_file() or digest(proof) != expected_sha:
            raise ValueError(f"Reviewed clay proof changed: {relative}")
    return {
        "file": str(CLAY_REVIEW.relative_to(ART)),
        "sha256": digest(CLAY_REVIEW),
        "decision": review["decision"],
        "comparisonManifestSha256": digest(CLAY_MANIFEST),
        "proofs": review["proofs"],
    }


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
    spec = importlib.util.spec_from_file_location("journey_map_v8_meshy_pipeline", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> None:
    check_glb(SOURCE)
    source_sha = digest(SOURCE)
    remesh = json.loads(REMESH_RECEIPT.read_text())
    if remesh.get("state") != "archived" or remesh.get("file", {}).get("sha256") != source_sha:
        raise ValueError("The remesh receipt does not archive the inspected source")
    triangles = triangle_count(SOURCE)
    if not 90_000 <= triangles <= 125_000:
        raise ValueError(f"The remesh missed the ~110k geometry gate: {triangles}")
    clay_review = validate_clay_review(source_sha, triangles)
    parent_task_id = str(remesh.get("taskId", ""))
    if not parent_task_id:
        raise ValueError("The remesh receipt has no provider task ID")

    receipt = (
        json.loads(RECEIPT.read_text())
        if RECEIPT.exists()
        else {
            "schema": 1,
            "provider": "Meshy",
            "assetId": "floating-museum-conservatory-v8-candidate",
            "operation": "retexture",
            "parentTaskId": parent_task_id,
            "source": {
                "file": str(SOURCE.relative_to(ART)),
                "bytes": SOURCE.stat().st_size,
                "sha256": source_sha,
                "triangles": triangles,
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
                "Owner explicitly approved transferring the preserved source models to Meshy "
                "and using the credits needed for this repair."
            ),
            "clayReview": clay_review,
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
    if receipt.get("clayReview", {}).get("sha256") != clay_review["sha256"]:
        raise ValueError("Receipt clay-review gate changed")
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
            if int(balance_before) < int(receipt["estimatedCredits"]):
                raise RuntimeError("Insufficient Meshy balance for the prepared retexture")
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
            receipt.update({"taskId": task_id, "state": "submitted"})
            save(receipt)
            balance_after_submit = client.tool(
                "meshy_check_balance", {"response_format": "json"}
            )["balance"]
            receipt.update(
                {
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
        "CONSERVATORY_V8_RETEXTURE_ARCHIVED="
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
