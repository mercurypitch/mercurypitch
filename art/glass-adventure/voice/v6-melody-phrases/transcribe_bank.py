"""Transcribe decoded delivery variants with source-hash-aware caching."""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
import os
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[3]
PUBLIC = REPO / "apps" / "beside-cue" / "public" / "games"
ANALYSIS = ROOT / "analysis"
OUTPUT = ANALYSIS / "asr-full"
MODEL = Path("/home/maff/Documents/root/local_data/models/whisper/ggml-base.en.bin")
BANK_REPORT = os.environ.get("MERC_BANK_REPORT", "bank-full.json")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


bank = json.loads((ANALYSIS / BANK_REPORT).read_text())
model_sha256 = sha256(MODEL)
index_path = OUTPUT / "index.json"
cached_index = (
    json.loads(index_path.read_text())
    if index_path.exists()
    else {"variants": {}}
)
cached_variants = cached_index.get("variants", {})


def transcribe(variant: dict) -> tuple[str, dict]:
    source = PUBLIC / variant["asset"]
    source_sha256 = sha256(source)
    if source_sha256 != variant["sha256"]:
        raise RuntimeError(f"Bank/source hash mismatch for {variant['id']}")
    destination = OUTPUT / variant["id"]
    transcript = destination.with_suffix(".json")
    cached = cached_variants.get(variant["id"])
    receipt = {
        "asset": variant["asset"],
        "bytes": source.stat().st_size,
        "sourceSha256": source_sha256,
        "modelSha256": model_sha256,
    }
    if transcript.exists() and cached == receipt:
        return f"cached {variant['id']}", receipt
    transcript.unlink(missing_ok=True)
    result = subprocess.run(
        [
            "rtk",
            "proxy",
            "whisper-cli",
            "-m",
            str(MODEL),
            "-l",
            "en",
            "-ojf",
            "-of",
            str(destination),
            "-np",
            "-ng",
            str(source),
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0 or not transcript.exists():
        raise RuntimeError(
            f"Whisper failed for {variant['id']}: {result.stderr[-800:]}"
        )
    if sha256(source) != source_sha256:
        transcript.unlink(missing_ok=True)
        raise RuntimeError(f"Source changed during transcription: {variant['id']}")
    return f"transcribed {variant['id']}", receipt


OUTPUT.mkdir(parents=True, exist_ok=True)
receipts = {}
with ThreadPoolExecutor(max_workers=4) as pool:
    futures = {pool.submit(transcribe, variant): variant for variant in bank["variants"]}
    complete = 0
    for future in as_completed(futures):
        message, receipt = future.result()
        variant = futures[future]
        receipts[variant["id"]] = receipt
        complete += 1
        print(f"{complete}/{len(futures)} {message}")

index = {
    "revision": bank["revision"],
    "bankReport": BANK_REPORT,
    "model": str(MODEL),
    "modelSha256": model_sha256,
    "variants": dict(sorted(receipts.items())),
}
index_path.write_text(json.dumps(index, indent=2) + "\n")
