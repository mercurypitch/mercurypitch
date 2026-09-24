"""Reserve and create word/character alignments for selected Merc phrase sources."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path

import requests


ROOT = Path(__file__).resolve().parent
KEY = os.environ["BESIDECUE_ELEVENLABS_API_KEY"]
if not KEY or KEY.startswith("pass://"):
    raise SystemExit("Missing injected key.")
selection = json.loads((ROOT / "analysis" / "source-selection.json").read_text())

for phrase in selection["phrases"]:
    identity = phrase["selected_source"]
    text = f"{phrase['words']}."
    path = ROOT / "analysis" / f"{identity}-alignment.json"
    audio_path = ROOT / "raw" / f"{identity}.wav"
    audio = audio_path.read_bytes()
    source_hash = hashlib.sha256(audio).hexdigest()
    if path.exists():
        saved = json.loads(path.read_text())
        if (
            saved.get("status") != "complete"
            or saved.get("text") != text
            or saved.get("sha256") != source_hash
        ):
            raise SystemExit(f"Inspect existing alignment attempt: {identity}")
        print(json.dumps({"id": identity, "status": "already-complete"}))
        continue

    receipt = {
        "revision": selection["revision"],
        "id": identity,
        "text": text,
        "sha256": source_hash,
        "status": "reserved",
    }
    path.write_text(json.dumps(receipt, indent=2) + "\n")
    try:
        result = requests.post(
            "https://api.elevenlabs.io/v1/forced-alignment",
            headers={"xi-api-key": KEY},
            data={"text": text},
            files={"file": (audio_path.name, audio, "audio/wav")},
            timeout=60,
        )
        receipt["http_status"] = result.status_code
        receipt["request_id"] = result.headers.get("request-id")
        if result.status_code != 200:
            receipt["status"] = "rejected"
            detail = result.json().get("detail", {})
            receipt["error"] = {
                "code": detail.get("code", detail.get("status"))
                if isinstance(detail, dict)
                else None,
                "message": str(
                    detail.get("message", "")
                    if isinstance(detail, dict)
                    else detail
                ).replace(KEY, "<redacted>"),
            }
        else:
            body = result.json()
            receipt.update(
                status="complete",
                words=body["words"],
                characters=body["characters"],
                loss=body.get("loss"),
            )
    except Exception as error:
        if receipt["status"] == "reserved":
            receipt["status"] = "uncertain"
            receipt["error"] = {"name": type(error).__name__}
    path.write_text(json.dumps(receipt, indent=2) + "\n")
    print(
        json.dumps(
            {
                "id": identity,
                "status": receipt["status"],
                "words": len(receipt.get("words", [])),
                "characters": len(receipt.get("characters", [])),
            }
        )
    )
    if receipt["status"] != "complete":
        raise SystemExit("Inspect receipt before retrying.")
