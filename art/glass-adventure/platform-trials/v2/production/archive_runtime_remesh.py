"""Archive safe receipts for the three Meshy runtime-remesh tasks."""

from __future__ import annotations

import datetime
import hashlib
import importlib.util
import json
from pathlib import Path
import struct


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


def artifact(path: Path, role: str) -> dict[str, object]:
    record: dict[str, object] = {
        "role": role,
        "file": str(path.relative_to(ART)),
        "bytes": path.stat().st_size,
        "sha256": digest(path),
    }
    if path.suffix.lower() == ".png":
        record["dimensions"] = png_dimensions(path)
    return record


def main() -> None:
    ledger = json.loads(TASKS.read_text())
    rows = {str(row["id"]): row for row in ledger["tasks"]}
    if set(rows) != {"marble", "frost", "glide"}:
        raise RuntimeError("Expected exactly the approved marble/frost/glide batch")
    pipeline = load_pipeline()
    statuses: dict[str, dict[str, object]] = {}
    with pipeline.MCP() as client:
        for asset, row in rows.items():
            statuses[asset] = client.tool(
                "meshy_get_task_status",
                {
                    "task_id": row["runtimeRemeshTaskId"],
                    "task_type": "remesh",
                    "wait": False,
                    "response_format": "json",
                },
            )
        balance = int(client.tool("meshy_check_balance", {"response_format": "json"})["balance"])

    archived_at = now()
    runtime_credits = 0
    for asset, row in rows.items():
        task = statuses[asset]
        if (task.get("outcome") or task.get("status")) != "SUCCEEDED":
            raise RuntimeError(f"{asset} runtime remesh is not complete")
        folder = ART / "meshy" / asset
        output = folder / "runtime-remesh.glb"
        check_glb(output)
        files = [artifact(output, "runtime_remesh_glb")]
        files.extend(
            artifact(path, "runtime_pbr_map")
            for path in sorted((folder / "runtime-remesh_textures").glob("*.png"))
        )
        credits = int(task.get("consumed_credits", 0))
        if credits <= 0:
            raise RuntimeError(f"Meshy did not report consumed credits for {asset} runtime remesh")
        runtime_credits += credits
        final_status = safe_status(task)
        receipt = {
            "schema": 1,
            "provider": "Meshy",
            "assetId": f"cloudway-{asset}-platform-runtime-remesh-v1",
            "taskType": "remesh",
            "state": "runtime-source-archived",
            "authorization": ledger["authorization"],
            "taskId": row["runtimeRemeshTaskId"],
            "submittedSettings": ledger["runtimeRemeshRequest"],
            "input": artifact(folder / "donor.glb", "source_donor_glb"),
            "finalStatus": final_status,
            "archivedAtUtc": archived_at,
            "credentialsPersisted": False,
            "signedArtifactUrlsPersisted": False,
            "files": files,
        }
        receipt_path = folder / "runtime-remesh-receipt.json"
        status_path = folder / "runtime-remesh-provider-status.json"
        save(receipt_path, receipt)
        save(
            status_path,
            {
                "schema": 1,
                "provider": "Meshy",
                "taskType": "remesh",
                "taskId": row["runtimeRemeshTaskId"],
                "finalStatus": final_status,
                "archivedAtUtc": archived_at,
                "artifacts": files,
                "credentialsPersisted": False,
                "signedArtifactUrlsPersisted": False,
            },
        )
        row.update(
            {
                "runtimeRemeshStatus": "runtime-source-archived",
                "runtimeRemeshConsumedCredits": credits,
                "runtimeRemeshReceipt": str(receipt_path.relative_to(ART / "meshy")),
            }
        )

    original_credits = sum(int(row.get("consumedCredits", 0)) for row in rows.values())
    ledger.update(
        {
            "state": "all-provider-sources-archived",
            "runtimeRemeshArchivedAtUtc": archived_at,
            "balanceAfterRuntimeRemeshArchiveCheck": balance,
            "consumedCreditsTotal": original_credits + runtime_credits,
            "credentialsPersisted": False,
            "signedArtifactUrlsPersisted": False,
        }
    )
    save(TASKS, ledger)
    print(
        json.dumps(
            {
                "archived": sorted(rows),
                "runtimeRemeshCredits": runtime_credits,
                "consumedCreditsTotal": original_credits + runtime_credits,
                "balance": balance,
            }
        )
    )


if __name__ == "__main__":
    main()
