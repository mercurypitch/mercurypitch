"""Verify the paid source ledgers and make lossless WAVs for unprompted ASR."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import struct
import wave


ROOT = Path(__file__).resolve().parent
RAW = ROOT / "raw"
ANALYSIS = ROOT / "analysis"
ANALYSIS.mkdir(exist_ok=True)

batch = json.loads((ROOT / "batch.json").read_text())
report = {
    "revision": batch["revision"],
    "method": "receipt hash verification and direct signed-16-bit PCM measurements",
    "takes": [],
}

for line in batch["lines"]:
    identity = line["id"]
    receipt = json.loads((RAW / f"{identity}.json").read_text())
    pcm_path = RAW / f"{identity}.pcm"
    pcm = pcm_path.read_bytes()
    if receipt["status"] != "complete":
        raise SystemExit(f"Incomplete source receipt: {identity}")
    if hashlib.sha256(pcm).hexdigest() != receipt["sha256"]:
        raise SystemExit(f"Source hash mismatch: {identity}")
    if len(pcm) % 2:
        raise SystemExit(f"Odd PCM byte count: {identity}")

    samples = struct.unpack(f"<{len(pcm) // 2}h", pcm)
    peak = max(abs(sample) for sample in samples)
    rms = (sum(sample * sample for sample in samples) / len(samples)) ** 0.5
    clipped = sum(abs(sample) >= 32767 for sample in samples)
    wav_path = RAW / f"{identity}.wav"
    with wave.open(str(wav_path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(receipt["sample_rate_hz"])
        output.writeframes(pcm)

    report["takes"].append(
        {
            "id": identity,
            "phrase_id": line["phrase_id"],
            "duration_seconds": receipt["duration_seconds"],
            "pcm_bytes": len(pcm),
            "pcm_sha256": receipt["sha256"],
            "peak_dbfs": 20 * __import__("math").log10(max(1, peak) / 32768),
            "rms_dbfs": 20 * __import__("math").log10(max(1, rms) / 32768),
            "clipped_samples": clipped,
        }
    )

(ANALYSIS / "source-audit.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({"takes": len(report["takes"]), "clipped": sum(t["clipped_samples"] for t in report["takes"])}))
