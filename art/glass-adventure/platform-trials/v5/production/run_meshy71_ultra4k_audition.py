#!/usr/bin/env python3
"""Receipt-first direct-API producer for the Frost and Glide Ultra 4K auditions."""

from __future__ import annotations

import argparse
import base64
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import struct
import sys
import time
from typing import Any
import urllib.error
import urllib.parse
import urllib.request

from PIL import Image


HERE = Path(__file__).resolve().parent
V5 = HERE.parent
PLATFORM_TRIALS = V5.parent
V2 = PLATFORM_TRIALS / "v2"
V4 = PLATFORM_TRIALS / "v4"
REPO = HERE.parents[4]


@dataclass(frozen=True)
class Asset:
    name: str
    asset_id: str
    guide: Path
    guide_bytes: int
    guide_sha256: str
    guide_dimensions: tuple[int, int]
    authority_receipt: Path
    authority_receipt_sha256: str
    texture_prompt: str

    @property
    def archive(self) -> Path:
        return V5 / "meshy" / f"{self.name}-ultra4k"

    @property
    def receipt(self) -> Path:
        return self.archive / "receipt.json"

    @property
    def model(self) -> Path:
        return self.archive / "dense-donor.glb"

    @property
    def textures(self) -> Path:
        return self.archive / "textures"


ASSETS = {
    "frost": Asset(
        name="frost",
        asset_id="cloudway-frost-platform-meshy71-ultra4k-v5",
        guide=V2 / "guides" / "frost-platform-guide.png",
        guide_bytes=1_126_005,
        guide_sha256="f79a6e0de0bf2fe87c66443aa7abd87911d0377b59e872ff4fd91c9c3c525f45",
        guide_dimensions=(1254, 1254),
        authority_receipt=V2 / "meshy" / "frost" / "receipt.json",
        authority_receipt_sha256="972d32976d002d55d62170092551789c297a714820a751fdc5ef159b13988100",
        texture_prompt=(
            "Pale aquamarine ice-glass platform with translucent depth, softly frosted bevels, "
            "subtle internal bubbles, a restrained etched crystalline flower on the broad clean "
            "landing top, four compact aged-gold corner clasps, and a small number of blunt clear "
            "crystal facets below. Preserve the flat safe top and shallow 1.5:1 slab proportions. "
            "Clean PBR without baked light, snow, cracks, loose shards, extra spikes, text or scene."
        ),
    ),
    "glide": Asset(
        name="glide",
        asset_id="cloudway-glide-platform-meshy71-ultra4k-v5",
        guide=V2 / "guides" / "glide-platform-guide.png",
        guide_bytes=1_269_012,
        guide_sha256="70acf421f63536dc18ca09f507fcf22b736647c7d92878bd3130b8b567f830c4",
        guide_dimensions=(1254, 1254),
        authority_receipt=V2 / "meshy" / "glide" / "receipt.json",
        authority_receipt_sha256="e073f699bdaf379eded5a10f56319000094d2877a6404cebc7dbbfa4ef6695a4",
        texture_prompt=(
            "Teal-celadon opaline glass moving platform with watery translucent depth, a broad "
            "perfectly flat landing top, narrow restrained aged-gold edge trim, four compact gold "
            "corner caps, a crisp inlaid moon-and-orbit motif, and shallow carved glass facets "
            "below. Preserve the shallow 1.5:1 raft proportions. Clean PBR without baked light, "
            "route rails, endpoint posts, wheels, machinery, glow, debris, text or scene."
        ),
    ),
}

MARBLE_BASELINE_RECEIPT = V4 / "meshy" / "marble-ultra4k" / "receipt.json"
MARBLE_BASELINE_TASK = "01a0cef2-fffb-726e-8659-b4e06c21149a"
MARBLE_BASELINE_CREATED_AT = 1_790_178_430_560

API_ROOT = "https://api.meshy.ai"
TASK_ENDPOINT = API_ROOT + "/openapi/v1/image-to-3d"
BALANCE_ENDPOINT = API_ROOT + "/openapi/v1/balance"
EXPECTED_MINIMUM_BALANCE = 35
MAX_MODEL_BYTES = 768 * 1024 * 1024
MAX_TEXTURE_BYTES = 192 * 1024 * 1024

def fixed_request(asset: Asset) -> dict[str, Any]:
    return {
        "model_type": "standard",
        "ai_model": "meshy-7.1",
        "geometry_resolution": "4k",
        "should_remesh": False,
        "should_texture": True,
        "texture_resolution": "4k",
        "enable_pbr": True,
        "texture_prompt": asset.texture_prompt,
        "image_enhancement": True,
        "target_formats": ["glb"],
        "alpha_thumbnail": True,
    }

SAFE_STATUS_FIELDS = (
    "id",
    "type",
    "status",
    "progress",
    "created_at",
    "started_at",
    "finished_at",
    "expires_at",
    "preceding_tasks",
    "consumed_credits",
    "ai_model",
    "model_type",
    "geometry_resolution",
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def relative(path: Path) -> str:
    return str(path.relative_to(REPO))


def atomic_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n")
    os.replace(temporary, path)


def load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object in {relative(path)}")
    return value


def validate_source(asset: Asset) -> dict[str, Any]:
    if not asset.guide.is_file() or asset.guide.stat().st_size != asset.guide_bytes:
        raise ValueError(f"The accepted {asset.name} guide byte count changed")
    if digest(asset.guide) != asset.guide_sha256:
        raise ValueError(f"The accepted {asset.name} guide hash changed")
    with Image.open(asset.guide) as image:
        if image.format != "PNG" or image.size != asset.guide_dimensions:
            raise ValueError(f"The accepted {asset.name} guide dimensions or format changed")
    if (
        not asset.authority_receipt.is_file()
        or digest(asset.authority_receipt) != asset.authority_receipt_sha256
    ):
        raise ValueError(f"The V2 {asset.name} source receipt changed")
    source_receipt = load_json(asset.authority_receipt)
    guide = source_receipt.get("guide", {})
    if (
        guide.get("sha256") != asset.guide_sha256
        or int(guide.get("bytes", -1)) != asset.guide_bytes
    ):
        raise ValueError(f"The V2 receipt no longer identifies the accepted {asset.name} guide")
    return {
        "file": relative(asset.guide),
        "bytes": asset.guide_bytes,
        "sha256": asset.guide_sha256,
        "dimensions": list(asset.guide_dimensions),
        "mimeType": "image/png",
        "authorityReceipt": {
            "file": relative(asset.authority_receipt),
            "sha256": asset.authority_receipt_sha256,
        },
    }


def validate_request(asset: Asset, request: dict[str, Any]) -> None:
    expected = {
        "model_type": "standard",
        "ai_model": "meshy-7.1",
        "geometry_resolution": "4k",
        "should_remesh": False,
        "should_texture": True,
        "texture_resolution": "4k",
        "enable_pbr": True,
        "image_enhancement": True,
        "target_formats": ["glb"],
        "alpha_thumbnail": True,
    }
    for key, value in expected.items():
        if request.get(key) != value:
            raise ValueError(f"Fixed request drifted at {key}")
    if request.get("texture_prompt") != asset.texture_prompt:
        raise ValueError("Fixed request no longer uses the asset texture prompt")
    if len(asset.texture_prompt) > 800:
        raise ValueError("Texture prompt exceeds the documented 800-character limit")
    forbidden = {"remove_lighting", "target_polycount", "decimation_mode", "topology"}
    if forbidden & request.keys():
        raise ValueError("Dense Meshy 7.1 trial must not request remesh-only or Meshy-6 fields")


def base_receipt(
    asset: Asset, source: dict[str, Any], request: dict[str, Any]
) -> dict[str, Any]:
    return {
        "schema": 1,
        "provider": "Meshy direct API",
        "assetId": asset.asset_id,
        "operation": "image-to-3d",
        "state": "not-submitted",
        "source": source,
        "request": request,
        "imageTransport": {
            "method": "base64 PNG data URI created in memory at submission",
            "payloadPersisted": False,
        },
        "apiContract": {
            "create": "POST /openapi/v1/image-to-3d",
            "retrieve": "GET /openapi/v1/image-to-3d/:id",
            "balance": "GET /openapi/v1/balance",
            "checkedAtUtc": "2026-09-23",
            "officialDocs": "https://docs.meshy.ai/en/api/image-to-3d",
            "officialPricing": "https://docs.meshy.ai/en/api/pricing",
        },
        "estimatedCredits": {
            "baseImageTo3dWithPbr4k": 30,
            "ultraGeometry4kSurcharge": 5,
            "expectedTotal": EXPECTED_MINIMUM_BALANCE,
            "actualSourceOfTruth": "provider consumed_credits and balance delta",
        },
        "authorization": {
            "requiredFlags": ["--submit", "--authorized-source-transfer"],
            "asserted": False,
        },
        "credentialsPersisted": False,
        "signedArtifactUrlsPersisted": False,
        "readiness": (
            "Preflight only. A dense donor archive is still subject to clay, PBR, "
            "topology, bake, memory and runtime-scale review."
        ),
    }


def compatible(
    receipt: dict[str, Any], expected: dict[str, Any], request: dict[str, Any]
) -> None:
    for key in ("schema", "provider", "assetId", "operation"):
        if receipt.get(key) != expected.get(key):
            raise ValueError(f"Existing receipt does not match {key}")
    if receipt.get("source") != expected.get("source"):
        raise ValueError("Existing receipt source differs from the fixed trial source")
    if receipt.get("request") != request:
        raise ValueError("Existing receipt request differs from the fixed trial request")


def api_key() -> str:
    value = os.environ.get("MESHY_API_KEY", "")
    if not value:
        raise RuntimeError("MESHY_API_KEY is unavailable in the credential-scoped child")
    return value


def api_json(method: str, url: str, key: str, body: dict[str, Any] | None = None) -> Any:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or parsed.hostname != "api.meshy.ai":
        raise ValueError("Refusing a non-Meshy API endpoint")
    payload = None if body is None else json.dumps(body, separators=(",", ":")).encode()
    headers = {
        "Authorization": "Bearer " + key,
        "Accept": "application/json",
        "User-Agent": "MercuryPitch-Meshy71-Audition/1",
    }
    if payload is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=payload, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"Meshy API {method} failed with HTTP {exc.code}") from None
    except urllib.error.URLError:
        raise RuntimeError(f"Meshy API {method} failed before a JSON response") from None
    return result


def read_balance(key: str) -> int:
    result = api_json("GET", BALANCE_ENDPOINT, key)
    if not isinstance(result, dict) or not isinstance(result.get("balance"), int):
        raise RuntimeError("Meshy balance response omitted an integer balance")
    return int(result["balance"])


def safe_status(task: dict[str, Any]) -> dict[str, Any]:
    result = {field: task[field] for field in SAFE_STATUS_FIELDS if field in task}
    error = task.get("task_error")
    if isinstance(error, dict):
        safe_error = {key: error[key] for key in ("type", "code") if key in error}
        if safe_error:
            result["task_error"] = safe_error
    return result


def task_rows(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, list):
        return [row for row in value if isinstance(row, dict)]
    if isinstance(value, dict):
        for key in ("result", "data", "tasks"):
            rows = value.get(key)
            if isinstance(rows, list):
                return [row for row in rows if isinstance(row, dict)]
    raise RuntimeError("Meshy task list response omitted a task list")


def related_receipts() -> list[Path]:
    return [
        V2 / "meshy" / "marble" / "receipt.json",
        V2 / "meshy" / "frost" / "receipt.json",
        V2 / "meshy" / "glide" / "receipt.json",
        MARBLE_BASELINE_RECEIPT,
        ASSETS["frost"].receipt,
        ASSETS["glide"].receipt,
    ]


def locally_receipted_task_ids() -> set[str]:
    result: set[str] = set()
    for path in related_receipts():
        if not path.exists():
            continue
        receipt = load_json(path)
        if receipt.get("state") == "submission-unconfirmed" and not receipt.get("taskId"):
            raise RuntimeError(
                f"Ambiguous image-to-3D submission must be reconciled before any retry: {relative(path)}"
            )
        task_id = receipt.get("taskId")
        if isinstance(task_id, str) and task_id:
            result.add(task_id)
    return result


def reconcile_provider(key: str, asset: Asset) -> dict[str, Any]:
    baseline = load_json(MARBLE_BASELINE_RECEIPT)
    if (
        baseline.get("state") != "archived"
        or baseline.get("taskId") != MARBLE_BASELINE_TASK
        or int(baseline.get("finalStatus", {}).get("created_at", -1))
        != MARBLE_BASELINE_CREATED_AT
    ):
        raise RuntimeError("The known V4 image-to-3D reconciliation baseline changed")
    query = urllib.parse.urlencode(
        {"page_num": 1, "page_size": 100, "sort_by": "-created_at"}
    )
    rows = task_rows(api_json("GET", TASK_ENDPOINT + "?" + query, key))
    safe_rows = [
        safe_status(row)
        for row in rows
        if int(row.get("created_at", 0)) >= MARBLE_BASELINE_CREATED_AT
    ]
    if not any(row.get("id") == MARBLE_BASELINE_TASK for row in safe_rows):
        raise RuntimeError("Known V4 image-to-3D baseline is absent from provider history")
    known_ids = locally_receipted_task_ids()
    unknown = [
        row
        for row in safe_rows
        if int(row.get("created_at", 0)) > MARBLE_BASELINE_CREATED_AT
        and str(row.get("id")) not in known_ids
    ]
    if unknown:
        raise RuntimeError(
            "Unreceipted image-to-3D task exists after the V4 baseline: "
            + ", ".join(str(row.get("id")) for row in unknown)
        )
    return {
        "checkedAtUtc": utc_now(),
        "purpose": f"Prevent an unreceipted or duplicate image-to-3D submission before {asset.name} V5.",
        "baselineTaskId": MARBLE_BASELINE_TASK,
        "tasksAtOrAfterBaseline": safe_rows,
        "conclusion": "Every image-to-3D task newer than the V4 baseline has a local receipt.",
    }


def make_data_uri(asset: Asset) -> str:
    encoded = base64.b64encode(asset.guide.read_bytes()).decode("ascii")
    return "data:image/png;base64," + encoded


def submit(
    asset: Asset, receipt: dict[str, Any], request: dict[str, Any], key: str
) -> dict[str, Any]:
    if receipt.get("taskId"):
        raise RuntimeError("Receipt already has a task ID; use --resume")
    if receipt.get("state") != "not-submitted":
        raise RuntimeError("Receipt is not safely submit-ready; reconcile it manually")
    reconciliation = reconcile_provider(key, asset)
    balance_before = read_balance(key)
    if balance_before < EXPECTED_MINIMUM_BALANCE:
        raise RuntimeError("Meshy balance is below the fixed trial estimate")
    receipt["providerReconciliation"] = reconciliation
    receipt["state"] = "submission-unconfirmed"
    receipt["balanceBefore"] = balance_before
    receipt["authorization"] = {
        "requiredFlags": ["--submit", "--authorized-source-transfer"],
        "asserted": True,
        "assertedAtUtc": utc_now(),
    }
    receipt["submissionStartedAtUtc"] = utc_now()
    atomic_json(asset.receipt, receipt)

    payload = dict(request)
    payload["image_url"] = make_data_uri(asset)
    created = api_json("POST", TASK_ENDPOINT, key, payload)
    task_id = created.get("result") if isinstance(created, dict) else None
    if not isinstance(task_id, str) or not task_id:
        raise RuntimeError("Meshy create response omitted a task ID; do not resubmit")

    receipt["taskId"] = task_id
    receipt["state"] = "submitted"
    receipt["submittedAtUtc"] = utc_now()
    atomic_json(asset.receipt, receipt)
    try:
        receipt["balanceAfterSubmit"] = read_balance(key)
        receipt["observedBalanceDeltaAtSubmit"] = (
            balance_before - int(receipt["balanceAfterSubmit"])
        )
    except RuntimeError:
        receipt["balanceAfterSubmit"] = None
        receipt["observedBalanceDeltaAtSubmit"] = None
    atomic_json(asset.receipt, receipt)
    return receipt


def artifact_host(url: str) -> None:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or parsed.hostname != "assets.meshy.ai":
        raise ValueError("Refusing an artifact outside assets.meshy.ai")


def download(url: str, target: Path, maximum_bytes: int) -> None:
    artifact_host(url)
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(target.suffix + ".part")
    request = urllib.request.Request(url, headers={"User-Agent": "MercuryPitch-Meshy71-Audition/1"})
    try:
        with urllib.request.urlopen(request, timeout=180) as response, temporary.open("wb") as out:
            final_url = response.geturl()
            artifact_host(final_url)
            total = 0
            while True:
                block = response.read(1024 * 1024)
                if not block:
                    break
                total += len(block)
                if total > maximum_bytes:
                    raise RuntimeError("Provider artifact exceeded the bounded archive size")
                out.write(block)
        if total <= 0:
            raise RuntimeError("Provider artifact download was empty")
        os.replace(temporary, target)
    except urllib.error.HTTPError as exc:
        temporary.unlink(missing_ok=True)
        raise RuntimeError(f"Artifact download failed with HTTP {exc.code}") from None
    except urllib.error.URLError:
        temporary.unlink(missing_ok=True)
        raise RuntimeError("Artifact download failed before a response") from None
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


def glb_report(path: Path) -> dict[str, Any]:
    with path.open("rb") as handle:
        header = handle.read(12)
        if len(header) != 12:
            raise ValueError("Archived GLB has a truncated header")
        magic, version, declared_length = struct.unpack("<4sII", header)
        if magic != b"glTF" or version != 2 or declared_length != path.stat().st_size:
            raise ValueError("Archived GLB header or declared length is invalid")
        chunk_header = handle.read(8)
        json_length, chunk_type = struct.unpack("<II", chunk_header)
        if chunk_type != 0x4E4F534A:
            raise ValueError("Archived GLB does not begin with a JSON chunk")
        document = json.loads(handle.read(json_length).decode("utf-8"))
    triangles = 0
    vertices = 0
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            if int(primitive.get("mode", 4)) != 4:
                continue
            indices = document["accessors"][int(primitive["indices"])]
            positions = document["accessors"][int(primitive["attributes"]["POSITION"])]
            triangles += int(indices["count"]) // 3
            vertices += int(positions["count"])
    return {
        "file": relative(path),
        "bytes": path.stat().st_size,
        "sha256": digest(path),
        "glbVersion": version,
        "meshes": len(document.get("meshes", [])),
        "materials": len(document.get("materials", [])),
        "images": len(document.get("images", [])),
        "referencedVertices": vertices,
        "triangles": triangles,
    }


def image_report(path: Path, role: str, set_index: int) -> dict[str, Any]:
    with Image.open(path) as image:
        image.load()
        return {
            "role": role,
            "setIndex": set_index,
            "file": relative(path),
            "bytes": path.stat().st_size,
            "sha256": digest(path),
            "format": image.format,
            "dimensions": list(image.size),
            "mode": image.mode,
        }


def archive_outputs(
    asset: Asset,
    receipt: dict[str, Any],
    task: dict[str, Any],
    request: dict[str, Any],
    key: str,
) -> dict[str, Any]:
    task_id = str(receipt["taskId"])
    model_urls = task.get("model_urls")
    glb_url = model_urls.get("glb") if isinstance(model_urls, dict) else None
    if not isinstance(glb_url, str):
        raise RuntimeError("Successful Meshy task omitted model_urls.glb")
    if asset.model.exists() and receipt.get("archiveDownloadTaskId") != task_id:
        raise RuntimeError("A model already occupies the archive without a matching task receipt")
    if not asset.model.exists():
        receipt["archiveDownloadTaskId"] = task_id
        receipt["archiveDownloadStartedAtUtc"] = utc_now()
        atomic_json(asset.receipt, receipt)
        download(glb_url, asset.model, MAX_MODEL_BYTES)
    model_report = glb_report(asset.model)

    texture_reports = []
    required_roles = {"base_color", "normal", "metallic", "roughness"}
    missing_roles = set(required_roles)
    texture_sets = task.get("texture_urls")
    if not isinstance(texture_sets, list):
        texture_sets = []
    for set_index, texture_set in enumerate(texture_sets):
        if not isinstance(texture_set, dict):
            continue
        missing_roles -= required_roles & texture_set.keys()
        for role in sorted(required_roles & texture_set.keys()):
            url = texture_set[role]
            if not isinstance(url, str):
                raise RuntimeError("Meshy texture URL has the wrong type")
            suffix = Path(urllib.parse.urlparse(url).path).suffix.lower()
            if suffix not in {".png", ".jpg", ".jpeg", ".webp"}:
                suffix = ".png"
            target = asset.textures / f"set-{set_index}-{role}{suffix}"
            download(url, target, MAX_TEXTURE_BYTES)
            texture_reports.append(image_report(target, role, set_index))

    provider_confirmation = {
        "requestedAiModel": request["ai_model"],
        "returnedAiModel": task.get("ai_model"),
        "requestedGeometryResolution": request["geometry_resolution"],
        "returnedGeometryResolution": task.get("geometry_resolution"),
        "explicitRequestRecorded": True,
    }
    returned_resolution = task.get("geometry_resolution")
    if returned_resolution not in (None, "4k"):
        raise RuntimeError("Provider returned a geometry resolution other than 4k")

    receipt["state"] = "archived"
    receipt["finalStatus"] = safe_status(task)
    receipt["providerConfirmation"] = provider_confirmation
    receipt["archiveDownload"] = {
        "sourceHost": "assets.meshy.ai",
        "signedUrlsPersisted": False,
        "model": model_report,
        "textures": texture_reports,
        "missingRequestedPbrMaps": sorted(missing_roles),
    }
    receipt["archivedAtUtc"] = utc_now()
    try:
        receipt["balanceAfterArchive"] = read_balance(key)
        before = receipt.get("balanceBefore")
        receipt["observedBalanceDeltaFinal"] = (
            int(before) - int(receipt["balanceAfterArchive"])
            if isinstance(before, int)
            else None
        )
    except RuntimeError:
        receipt["balanceAfterArchive"] = None
        receipt["observedBalanceDeltaFinal"] = None
    if missing_roles:
        receipt["readiness"] = (
            "Dense source model archived, but the provider response omitted requested PBR "
            f"maps: {', '.join(sorted(missing_roles))}. Do not resubmit automatically. "
            "Clay review and an explicit texture follow-up remain pending."
        )
    else:
        receipt["readiness"] = (
            "Dense source archive only. Clay comparison, contact-surface review, Blender "
            "normal/AO bake, runtime LOD, texture-memory audition and integration remain pending."
        )
    atomic_json(asset.receipt, receipt)
    return receipt


def poll_and_archive(
    asset: Asset,
    receipt: dict[str, Any],
    request: dict[str, Any],
    key: str,
    timeout_seconds: int,
    poll_seconds: int,
) -> dict[str, Any]:
    task_id = receipt.get("taskId")
    if not isinstance(task_id, str) or not task_id:
        raise RuntimeError("Receipt has no task ID; submission cannot be resumed safely")
    deadline = time.monotonic() + timeout_seconds
    while True:
        task = api_json("GET", TASK_ENDPOINT + "/" + urllib.parse.quote(task_id), key)
        if not isinstance(task, dict) or task.get("id") != task_id:
            raise RuntimeError("Meshy status response did not match the receipted task ID")
        receipt["lastStatus"] = safe_status(task)
        receipt["lastCheckedAtUtc"] = utc_now()
        status = task.get("status")
        receipt["state"] = "in-progress" if status in {"PENDING", "IN_PROGRESS"} else str(status).lower()
        atomic_json(asset.receipt, receipt)
        print(json.dumps({"taskId": task_id, "status": status, "progress": task.get("progress")}))
        if status == "SUCCEEDED":
            return archive_outputs(asset, receipt, task, request, key)
        if status in {"FAILED", "CANCELED"}:
            raise RuntimeError(f"Meshy task reached terminal state {status}")
        if time.monotonic() >= deadline:
            raise TimeoutError("Polling timed out; rerun with --resume")
        time.sleep(poll_seconds)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", choices=sorted(ASSETS), required=True)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--submit", action="store_true")
    mode.add_argument("--resume", action="store_true")
    parser.add_argument("--authorized-source-transfer", action="store_true")
    parser.add_argument("--timeout-seconds", type=int, default=2700)
    parser.add_argument("--poll-seconds", type=int, default=15)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    asset = ASSETS[args.asset]
    if args.timeout_seconds < 60 or args.poll_seconds < 5 or args.poll_seconds > 60:
        raise ValueError("Use timeout >=60 seconds and poll interval 5..60 seconds")
    request = fixed_request(asset)
    validate_request(asset, request)
    source = validate_source(asset)
    expected = base_receipt(asset, source, request)
    if asset.receipt.exists():
        receipt = load_json(asset.receipt)
        compatible(receipt, expected, request)
    else:
        receipt = expected
        atomic_json(asset.receipt, receipt)

    if not args.submit and not args.resume:
        print(
            json.dumps(
                {
                    "asset": asset.name,
                    "state": receipt.get("state"),
                    "receipt": relative(asset.receipt),
                    "sourceSha256": asset.guide_sha256,
                    "request": request,
                    "networkCalled": False,
                }
            )
        )
        return

    if args.submit:
        if not args.authorized_source_transfer:
            raise RuntimeError("Submission requires --authorized-source-transfer")
    elif args.authorized_source_transfer:
        raise RuntimeError("--authorized-source-transfer is only valid with --submit")
    if args.resume and not receipt.get("taskId"):
        raise RuntimeError("Receipt has no task ID; submission cannot be resumed safely")
    key = api_key()
    if args.submit:
        receipt = submit(asset, receipt, request, key)
    if receipt.get("state") == "archived":
        print(json.dumps({"state": "archived", "receipt": relative(asset.receipt)}))
        return
    receipt = poll_and_archive(
        asset, receipt, request, key, args.timeout_seconds, args.poll_seconds
    )
    print(
        json.dumps(
            {
                "asset": asset.name,
                "state": receipt.get("state"),
                "taskId": receipt.get("taskId"),
                "consumedCredits": receipt.get("finalStatus", {}).get("consumed_credits"),
                "receipt": relative(asset.receipt),
                "modelSha256": receipt["archiveDownload"]["model"]["sha256"],
            }
        )
    )


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError, TimeoutError) as exc:
        raise SystemExit(f"error: {exc}") from None
