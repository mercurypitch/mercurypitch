#!/usr/bin/env python3
"""Receipt-first Meshy production for the reviewed Cloudway laboratory catalogue."""

from __future__ import annotations

import argparse
import base64
from contextlib import contextmanager
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import sys
import tempfile
from typing import Any, Iterator
import urllib.parse

from PIL import Image


HERE = Path(__file__).resolve().parent
KIT = HERE.parent
REPO = HERE.parents[4]
PRODUCER = (
    REPO
    / "art/glass-adventure/platform-trials/v4/production/run_meshy71_ultra4k_trial.py"
)
SOURCE = Path(
    os.environ.get("GLASS_SOURCE_ROOT", str(KIT / "source-assets"))
).expanduser().resolve()

ASSET_ID = re.compile(r"^[a-z0-9][a-z0-9-]*$")
PBR_ROLES = frozenset({"base_color", "normal", "metallic", "roughness"})
EXPECTED_TEXTURE_DIMENSIONS = [8192, 8192]
MIRROR_FIELDS = frozenset(
    {
        "schema",
        "provider",
        "assetId",
        "operation",
        "state",
        "source",
        "request",
        "imageTransport",
        "apiContract",
        "estimatedCredits",
        "authorization",
        "credentialsPersisted",
        "signedArtifactUrlsPersisted",
        "readiness",
        "balanceBefore",
        "submissionStartedAtUtc",
        "taskId",
        "submittedAtUtc",
        "balanceAfterSubmit",
        "observedBalanceDeltaAtSubmit",
        "lastStatus",
        "lastCheckedAtUtc",
        "finalStatus",
        "providerConfirmation",
        "providerQuality",
        "archiveDownload",
        "archivedAtUtc",
        "previewArchivedAtUtc",
        "balanceAfterArchive",
        "observedBalanceDeltaFinal",
    }
)
FORBIDDEN_MIRROR_KEYS = frozenset(
    {
        "api_key",
        "authorization_header",
        "access_token",
        "image_url",
        "thumbnail_url",
        "model_urls",
        "texture_urls",
    }
)


def backend():
    spec = importlib.util.spec_from_file_location("meshy_archive", PRODUCER)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load the reviewed Meshy archive backend")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def durable_json(path: Path, value: dict[str, Any]) -> None:
    """Replace JSON only after its bytes are durable on the local filesystem."""
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=path.parent
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(value, handle, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
        directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        temporary.unlink(missing_ok=True)


def load_object(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object in {path}")
    return value


def _assert_mirror_safe(value: Any) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            if key.lower() in FORBIDDEN_MIRROR_KEYS:
                raise ValueError(f"Refusing to mirror sensitive receipt field {key}")
            _assert_mirror_safe(child)
    elif isinstance(value, list):
        for child in value:
            _assert_mirror_safe(child)
    elif isinstance(value, str):
        lowered = value.lower()
        if lowered.startswith("data:") or "bearer " in lowered:
            raise ValueError("Refusing to mirror an embedded payload or credential")
        if "x-amz-signature=" in lowered or "x-goog-signature=" in lowered:
            raise ValueError("Refusing to mirror a signed artifact URL")


def sanitized_mirror(receipt: dict[str, Any]) -> dict[str, Any]:
    mirror = {
        key: json.loads(json.dumps(value))
        for key, value in receipt.items()
        if key in MIRROR_FIELDS
    }
    _assert_mirror_safe(mirror)
    mirror["credentialsPersisted"] = False
    mirror["signedArtifactUrlsPersisted"] = False
    return mirror


def write_receipts(module: Any, receipt: dict[str, Any]) -> None:
    # The shared source receipt is authoritative. Write it before the Git mirror.
    durable_json(module.RECEIPT, receipt)
    durable_json(module.MIRROR_RECEIPT, sanitized_mirror(receipt))


def pristine(receipt: dict[str, Any]) -> bool:
    return (
        receipt.get("state") == "not-submitted"
        and not receipt.get("taskId")
        and not receipt.get("submissionStartedAtUtc")
    )


@contextmanager
def asset_lock(asset: dict[str, Any]) -> Iterator[None]:
    asset_id = asset.get("id")
    if not isinstance(asset_id, str) or not ASSET_ID.fullmatch(asset_id):
        raise ValueError("Catalogue asset ID must be a lowercase slug")
    if not SOURCE.is_dir():
        raise ValueError(
            "Source storage is unavailable; restore source-assets symlink or set "
            "GLASS_SOURCE_ROOT"
        )
    archive = SOURCE / "meshy" / asset_id
    archive.mkdir(parents=True, exist_ok=True)
    with (archive / ".production.lock").open("a+b") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(lock.fileno(), fcntl.LOCK_UN)


def _relative(path: Path) -> str:
    resolved = path.resolve()
    try:
        return "source-assets/" + resolved.relative_to(SOURCE).as_posix()
    except ValueError:
        return resolved.relative_to(REPO).as_posix()


def _source_details(module: Any, asset: dict[str, Any]) -> dict[str, Any]:
    reference = asset.get("reference")
    if not isinstance(reference, str):
        raise ValueError("Catalogue reference path is missing")
    guide = (SOURCE / reference).resolve()
    if not guide.is_relative_to(SOURCE) or not guide.is_file():
        raise ValueError("Catalogue reference must resolve inside source storage")
    module.GUIDE = guide
    expected_hash = asset.get("referenceSha256")
    if not isinstance(expected_hash, str) or module.digest(guide) != expected_hash:
        raise ValueError("Reference changed; review it before changing the catalogue hash")
    with Image.open(guide) as image:
        image_format = image.format
        dimensions = list(image.size)
        image.verify()
    if image_format != "PNG":
        raise ValueError("Reviewed reference must remain a PNG")
    return {
        "file": _relative(guide),
        "sha256": expected_hash,
        "bytes": guide.stat().st_size,
        "dimensions": dimensions,
        "mimeType": "image/png",
    }


def _expected_receipt(module: Any, asset: dict[str, Any]) -> dict[str, Any]:
    texture_prompt = asset.get("texturePrompt")
    if not isinstance(texture_prompt, str) or len(texture_prompt) > 800:
        raise ValueError("Texture prompt is missing or exceeds the API limit")
    module.FIXED_REQUEST = {
        "model_type": "standard",
        "ai_model": "meshy-7.1",
        "geometry_resolution": "4k",
        "should_remesh": False,
        "should_texture": True,
        "texture_resolution": "8k",
        "enable_pbr": True,
        "texture_prompt": texture_prompt,
        "image_enhancement": False,
        "target_formats": ["glb"],
        "alpha_thumbnail": True,
    }
    expected = module.base_receipt(_source_details(module, asset))
    expected["apiContract"]["checkedAtUtc"] = "2026-09-25"
    expected["estimatedCredits"] = {
        "baseImageTo3dWith8kTextures": 35,
        "ultraGeometry4kSurcharge": 5,
        "expectedTotal": 40,
        "actualSourceOfTruth": "provider consumed_credits",
    }
    expected["authorization"] = {
        "source": (
            "Owner explicitly authorized this 20-asset batch and Meshy credits "
            "in this conversation"
        ),
        "asserted": True,
    }
    return expected


def configure(asset: dict[str, Any]):
    """Configure one backend while the caller owns this asset's source lock."""
    module = backend()
    module.REPO = REPO
    module.ARCHIVE = SOURCE / "meshy" / asset["id"]
    module.RECEIPT = module.ARCHIVE / "receipt.json"
    module.MIRROR_RECEIPT = KIT / "meshy" / asset["id"] / "receipt.json"
    module.MODEL = module.ARCHIVE / "dense-donor.glb"
    module.TEXTURES = module.ARCHIVE / "textures"
    module.ASSET_ID = asset["id"]
    module.EXPECTED_MINIMUM_BALANCE = 40
    module.relative = _relative
    module.atomic_json = durable_json
    expected = _expected_receipt(module, asset)

    mirror = None
    if module.MIRROR_RECEIPT.exists():
        mirror = load_object(module.MIRROR_RECEIPT)
        module.compatible(mirror, expected)

    if module.RECEIPT.exists():
        receipt = load_object(module.RECEIPT)
        module.compatible(receipt, expected)
        if mirror is not None:
            authority_task = receipt.get("taskId")
            mirror_task = mirror.get("taskId")
            if mirror_task and mirror_task != authority_task:
                raise RuntimeError(
                    "Git mirror is ahead of the authoritative source receipt; "
                    "reconcile it manually"
                )
            if pristine(receipt) and not pristine(mirror):
                raise RuntimeError(
                    "Git mirror records a submission absent from the authoritative "
                    "source receipt; reconcile it manually"
                )
    elif mirror is not None:
        if not pristine(mirror):
            raise RuntimeError(
                "Cannot migrate a submitted Git-only receipt automatically; "
                "reconcile it manually"
            )
        receipt = mirror
    else:
        receipt = expected

    write_receipts(module, receipt)
    return module, receipt


def _verified_source_bytes(module: Any, receipt: dict[str, Any]) -> bytes:
    payload = module.GUIDE.read_bytes()
    source = receipt.get("source")
    expected_hash = source.get("sha256") if isinstance(source, dict) else None
    expected_bytes = source.get("bytes") if isinstance(source, dict) else None
    if hashlib.sha256(payload).hexdigest() != expected_hash:
        raise RuntimeError("Reference changed after receipt preparation; refusing upload")
    if len(payload) != expected_bytes:
        raise RuntimeError("Reference byte count changed after receipt preparation")
    return payload


def submit_receipt(module: Any, receipt: dict[str, Any], key: str) -> dict[str, Any]:
    if receipt.get("taskId"):
        raise RuntimeError("Receipt already has a task ID; use resume")
    if receipt.get("state") != "not-submitted":
        raise RuntimeError("Receipt is not safely submit-ready; reconcile it manually")
    authorization = receipt.get("authorization")
    if (
        not isinstance(authorization, dict)
        or authorization.get("asserted") is not True
        or not isinstance(authorization.get("source"), str)
    ):
        raise RuntimeError("Owner authorization provenance is absent from the receipt")

    source_bytes = _verified_source_bytes(module, receipt)
    balance_before = module.read_balance(key)
    if balance_before < module.EXPECTED_MINIMUM_BALANCE:
        raise RuntimeError("Meshy balance is below the fixed production estimate")
    receipt["state"] = "submission-unconfirmed"
    receipt["balanceBefore"] = balance_before
    receipt["authorization"] = {
        **authorization,
        "appliedAtUtc": module.utc_now(),
    }
    receipt["submissionStartedAtUtc"] = module.utc_now()
    # Both durable receipts precede the only paid call.
    write_receipts(module, receipt)

    payload = dict(module.FIXED_REQUEST)
    payload["image_url"] = (
        "data:image/png;base64," + base64.b64encode(source_bytes).decode("ascii")
    )
    created = module.api_json("POST", module.TASK_ENDPOINT, key, payload)
    task_id = created.get("result") if isinstance(created, dict) else None
    if not isinstance(task_id, str) or not task_id:
        raise RuntimeError("Meshy create response omitted a task ID; do not resubmit")

    receipt["taskId"] = task_id
    receipt["state"] = "submitted"
    receipt["submittedAtUtc"] = module.utc_now()
    write_receipts(module, receipt)
    try:
        receipt["balanceAfterSubmit"] = module.read_balance(key)
        receipt["observedBalanceDeltaAtSubmit"] = balance_before - int(
            receipt["balanceAfterSubmit"]
        )
    except RuntimeError:
        receipt["balanceAfterSubmit"] = None
        receipt["observedBalanceDeltaAtSubmit"] = None
    write_receipts(module, receipt)
    return receipt


def retrieve_task(module: Any, task_id: str, key: str) -> dict[str, Any]:
    encoded = urllib.parse.quote(task_id, safe="")
    task = module.api_json("GET", module.TASK_ENDPOINT + "/" + encoded, key)
    if not isinstance(task, dict) or task.get("id") != task_id:
        raise RuntimeError("Meshy status response did not match the receipted task ID")
    return task


def _preview_complete(module: Any, receipt: dict[str, Any]) -> bool:
    archive = receipt.get("archiveDownload")
    preview = archive.get("preview") if isinstance(archive, dict) else None
    if isinstance(preview, dict) and preview.get("status") == "provider-omitted":
        return True
    if not isinstance(preview, dict) or not isinstance(preview.get("sha256"), str):
        return False
    path = module.ARCHIVE / "preview.png"
    return path.is_file() and module.digest(path) == preview["sha256"]


def archive_preview(module: Any, receipt: dict[str, Any], task: dict[str, Any]) -> None:
    archive = receipt.setdefault("archiveDownload", {})
    preview_url = task.get("thumbnail_url")
    if not isinstance(preview_url, str):
        archive["preview"] = {"status": "provider-omitted"}
        return
    target = module.ARCHIVE / "preview.png"
    module.download(preview_url, target, module.MAX_TEXTURE_BYTES)
    report = module.image_report(target, "preview", 0)
    report.pop("role", None)
    report.pop("setIndex", None)
    archive["preview"] = report
    receipt["previewArchivedAtUtc"] = module.utc_now()


def provider_quality(
    module: Any, receipt: dict[str, Any], task: dict[str, Any]
) -> dict[str, Any]:
    request = receipt["request"]
    archive = receipt.get("archiveDownload", {})
    model = archive.get("model") if isinstance(archive, dict) else None
    textures = archive.get("textures", []) if isinstance(archive, dict) else []
    issues: list[str] = []

    if task.get("ai_model") != request["ai_model"]:
        issues.append("Provider did not confirm the requested Meshy 7.1 model.")
    if task.get("geometry_resolution") != request["geometry_resolution"]:
        issues.append("Provider did not confirm requested 4K geometry.")
    if (
        not isinstance(model, dict)
        or int(model.get("meshes", 0)) <= 0
        or int(model.get("triangles", 0)) <= 0
    ):
        issues.append("Archived GLB has no reported mesh triangles.")

    texture_reports = [item for item in textures if isinstance(item, dict)]
    base_colors = [item for item in texture_reports if item.get("role") == "base_color"]
    if not base_colors:
        issues.append("Provider archive omitted a base-color texture.")
    elif any(item.get("dimensions") != EXPECTED_TEXTURE_DIMENSIONS for item in base_colors):
        issues.append("At least one base-color texture is not 8192 x 8192.")

    roles_by_set: dict[int, set[str]] = {}
    for report in texture_reports:
        set_index = report.get("setIndex")
        role = report.get("role")
        if isinstance(set_index, int) and isinstance(role, str):
            roles_by_set.setdefault(set_index, set()).add(role)
    if not roles_by_set:
        issues.append("Provider archive omitted the requested PBR texture set.")
    else:
        for set_index, roles in sorted(roles_by_set.items()):
            missing = sorted(PBR_ROLES - roles)
            if missing:
                issues.append(
                    f"Texture set {set_index} omitted PBR maps: {', '.join(missing)}."
                )
    missing_by_set = archive.get("missingRequestedPbrMapsBySet", [])
    if isinstance(missing_by_set, list):
        reported_sets = {
            item.get("setIndex")
            for item in missing_by_set
            if isinstance(item, dict) and item.get("roles")
        }
        for set_index in sorted(
            reported_sets - roles_by_set.keys(),
            key=lambda value: -1 if value is None else value,
        ):
            label = "unknown" if set_index is None else str(set_index)
            issues.append(f"Texture set {label} omitted requested PBR maps.")

    return {
        "status": "confirmed" if not issues else "needs-review",
        "requested": {
            "aiModel": request["ai_model"],
            "geometryResolution": request["geometry_resolution"],
            "textureResolution": request["texture_resolution"],
            "pbr": request["enable_pbr"],
            "remesh": request["should_remesh"],
        },
        "observed": {
            "aiModel": task.get("ai_model"),
            "geometryResolution": task.get("geometry_resolution"),
            "baseColorDimensions": [item.get("dimensions") for item in base_colors],
        },
        "issues": issues,
        "scope": (
            "Provider response and archive evidence only; Blender and runtime art "
            "acceptance remain pending."
        ),
    }


def archive_outputs(
    module: Any, receipt: dict[str, Any], task: dict[str, Any], key: str
) -> dict[str, Any]:
    model_urls = task.get("model_urls")
    glb_url = model_urls.get("glb") if isinstance(model_urls, dict) else None
    if not isinstance(glb_url, str):
        raise RuntimeError("Successful Meshy task omitted model_urls.glb")
    module.download(glb_url, module.MODEL, module.MAX_MODEL_BYTES)
    model_report = module.glb_report(module.MODEL)

    texture_reports: list[dict[str, Any]] = []
    missing_by_set: list[dict[str, Any]] = []
    texture_sets = task.get("texture_urls")
    if not isinstance(texture_sets, list):
        texture_sets = []
    for set_index, texture_set in enumerate(texture_sets):
        if not isinstance(texture_set, dict):
            missing_by_set.append(
                {"setIndex": set_index, "roles": sorted(PBR_ROLES)}
            )
            continue
        present = PBR_ROLES & texture_set.keys()
        missing = sorted(PBR_ROLES - present)
        if missing:
            missing_by_set.append({"setIndex": set_index, "roles": missing})
        for role in sorted(present):
            url = texture_set[role]
            if not isinstance(url, str):
                raise RuntimeError("Meshy texture URL has the wrong type")
            suffix = Path(urllib.parse.urlparse(url).path).suffix.lower()
            if suffix not in {".png", ".jpg", ".jpeg", ".webp"}:
                suffix = ".png"
            target = module.TEXTURES / f"set-{set_index}-{role}{suffix}"
            module.download(url, target, module.MAX_TEXTURE_BYTES)
            texture_reports.append(module.image_report(target, role, set_index))
    if not texture_sets:
        missing_by_set.append({"setIndex": None, "roles": sorted(PBR_ROLES)})

    receipt["state"] = "archived"
    receipt["finalStatus"] = module.safe_status(task)
    receipt["providerConfirmation"] = {
        "requestedAiModel": module.FIXED_REQUEST["ai_model"],
        "returnedAiModel": task.get("ai_model"),
        "requestedGeometryResolution": module.FIXED_REQUEST[
            "geometry_resolution"
        ],
        "returnedGeometryResolution": task.get("geometry_resolution"),
        "explicitRequestRecorded": True,
    }
    receipt["archiveDownload"] = {
        "sourceHost": "assets.meshy.ai",
        "signedUrlsPersisted": False,
        "model": model_report,
        "textures": texture_reports,
        "missingRequestedPbrMaps": sorted(
            {role for item in missing_by_set for role in item["roles"]}
        ),
        "missingRequestedPbrMapsBySet": missing_by_set,
    }
    receipt["archivedAtUtc"] = module.utc_now()
    try:
        receipt["balanceAfterArchive"] = module.read_balance(key)
        before = receipt.get("balanceBefore")
        receipt["observedBalanceDeltaFinal"] = (
            int(before) - int(receipt["balanceAfterArchive"])
            if isinstance(before, int)
            else None
        )
    except RuntimeError:
        receipt["balanceAfterArchive"] = None
        receipt["observedBalanceDeltaFinal"] = None

    receipt["providerQuality"] = provider_quality(module, receipt, task)
    if receipt["providerQuality"]["status"] == "needs-review":
        receipt["readiness"] = (
            "Dense source files are archived, but requested provider quality needs "
            "review: "
            + " ".join(receipt["providerQuality"]["issues"])
            + " Do not resubmit automatically."
        )
    else:
        receipt["readiness"] = (
            "Requested provider settings have matching response and archive evidence. "
            "Clay comparison, contact-surface review, Blender normal/AO bake, runtime "
            "LOD, texture-memory audition and integration remain pending."
        )
    archive_preview(module, receipt, task)
    write_receipts(module, receipt)
    return receipt


def repair_archived_receipt(
    module: Any, receipt: dict[str, Any], task: dict[str, Any]
) -> dict[str, Any]:
    changed = False
    if not isinstance(receipt.get("providerQuality"), dict):
        receipt["providerQuality"] = provider_quality(module, receipt, task)
        changed = True
    if not _preview_complete(module, receipt):
        archive_preview(module, receipt, task)
        changed = True
    if changed:
        write_receipts(module, receipt)
    return receipt


def resume_receipt(module: Any, receipt: dict[str, Any]) -> dict[str, Any]:
    task_id = receipt.get("taskId")
    if not isinstance(task_id, str) or not task_id:
        raise RuntimeError("No task ID; reconcile uncertain submissions, never retry")
    if (
        receipt.get("state") == "archived"
        and isinstance(receipt.get("providerQuality"), dict)
        and _preview_complete(module, receipt)
    ):
        return receipt

    key = module.api_key()
    task = retrieve_task(module, task_id, key)
    status = task.get("status")
    if receipt.get("state") == "archived":
        if status != "SUCCEEDED":
            raise RuntimeError("Archived task no longer reports SUCCEEDED")
        return repair_archived_receipt(module, receipt, task)

    receipt["lastStatus"] = module.safe_status(task)
    receipt["lastCheckedAtUtc"] = module.utc_now()
    if status in {"PENDING", "IN_PROGRESS"}:
        receipt["state"] = "in-progress"
        write_receipts(module, receipt)
    elif status == "SUCCEEDED":
        receipt["state"] = "succeeded"
        write_receipts(module, receipt)
        receipt = archive_outputs(module, receipt, task, key)
    elif status in {"FAILED", "CANCELED"}:
        receipt["state"] = status.lower()
        write_receipts(module, receipt)
    else:
        write_receipts(module, receipt)
        raise RuntimeError(f"Meshy returned unsupported task status {status!r}")
    return receipt


def run_asset(action: str, asset: dict[str, Any]) -> dict[str, Any]:
    with asset_lock(asset):
        module, receipt = configure(asset)
        if action == "submit":
            receipt = submit_receipt(module, receipt, module.api_key())
        elif action == "resume":
            receipt = resume_receipt(module, receipt)
        return receipt


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "action", choices=["prepare", "submit", "resume", "balance", "reconcile"]
    )
    parser.add_argument("--asset", help="Exact catalogue ID; required for submit/resume")
    args = parser.parse_args()
    if args.action == "balance":
        module = backend()
        print(json.dumps({"balance": module.read_balance(module.api_key())}))
        return
    if args.action == "reconcile":
        module = backend()
        tasks = module.api_json(
            "GET",
            module.TASK_ENDPOINT + "?page_size=100&sort_by=-created_at",
            module.api_key(),
        )
        if not isinstance(tasks, list):
            raise RuntimeError("Unexpected task-list response")
        print(json.dumps([module.safe_status(task) for task in tasks], indent=2))
        return
    catalogue = json.loads((KIT / "catalogue.json").read_text())["assets"]
    assets = [
        asset for asset in catalogue if args.asset is None or asset["id"] == args.asset
    ]
    if not assets or (args.action != "prepare" and len(assets) != 1):
        raise ValueError("Choose one exact asset ID for a paid submission or resume")
    for asset in assets:
        receipt = run_asset(args.action, asset)
        print(
            json.dumps(
                {
                    "asset": asset["id"],
                    "state": receipt["state"],
                    "taskId": receipt.get("taskId"),
                    "status": receipt.get("lastStatus", {}).get("status"),
                    "providerQuality": receipt.get("providerQuality", {}).get(
                        "status"
                    ),
                }
            )
        )


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ValueError, OSError) as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1) from None
