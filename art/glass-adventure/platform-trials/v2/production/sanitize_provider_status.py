"""Replace provider payload snapshots with key-free local archive summaries."""

from __future__ import annotations

import json
from pathlib import Path


HERE = Path(__file__).resolve().parent
ART = HERE.parent


def main() -> None:
    changed: list[str] = []
    for receipt_path in sorted((ART / "meshy").glob("*/receipt.json")):
        receipt = json.loads(receipt_path.read_text())
        status_path = receipt_path.with_name("provider-status.json")
        summary = {
            "schema": 1,
            "provider": receipt["provider"],
            "taskType": receipt["taskType"],
            "taskId": receipt["taskId"],
            "finalStatus": receipt["finalStatus"],
            "archivedAtUtc": receipt["archivedAtUtc"],
            "artifacts": [
                {
                    key: value
                    for key, value in item.items()
                    if key in {"role", "file", "bytes", "sha256", "dimensions"}
                }
                for item in receipt["files"]
            ],
            "credentialsPersisted": False,
            "signedArtifactUrlsPersisted": False,
        }
        status_path.write_text(json.dumps(summary, indent=2) + "\n")
        changed.append(str(status_path.relative_to(ART)))
    print(json.dumps({"sanitized": changed}))


if __name__ == "__main__":
    main()
