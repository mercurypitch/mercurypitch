"""Align generated Merc phrases to authored words; retain paid-request receipts."""
import hashlib
import json
import os
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parent
KEY = os.environ["BESIDECUE_ELEVENLABS_API_KEY"]
for identity, text in [("light-a", "Let light sing."), ("home-a", "Two small lights come home.")]:
    path = ROOT / "analysis" / f"{identity}-alignment.json"
    if path.exists():
        saved = json.loads(path.read_text())
        if saved["status"] != "complete":
            raise SystemExit(f"Inspect existing alignment attempt: {identity}")
        continue
    audio = (ROOT / "raw" / f"{identity}.wav").read_bytes()
    receipt = {"id": identity, "text": text, "sha256": hashlib.sha256(audio).hexdigest(), "status": "reserved"}
    path.write_text(json.dumps(receipt, indent=2) + "\n")
    try:
        result = requests.post("https://api.elevenlabs.io/v1/forced-alignment",
            headers={"xi-api-key": KEY}, data={"text": text},
            files={"file": (f"{identity}.wav", audio, "audio/wav")}, timeout=60)
        receipt["http_status"] = result.status_code
        receipt["request_id"] = result.headers.get("request-id")
        if result.status_code != 200:
            receipt["status"] = "rejected"
            raise ValueError("Alignment rejected")
        body = result.json()
        receipt.update(status="complete", words=body["words"], characters=body["characters"], loss=body.get("loss"))
    except Exception:
        if receipt["status"] == "reserved": receipt["status"] = "uncertain"
    path.write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps({"id": identity, "status": receipt["status"], "words": receipt.get("words")}))
    if receipt["status"] != "complete": raise SystemExit("Inspect receipt before retrying.")
