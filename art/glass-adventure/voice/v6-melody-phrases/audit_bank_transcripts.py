"""Gate decoded Merc variants on hash-bound unprompted lyric recognition."""
from __future__ import annotations

from collections import defaultdict
import json
import os
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parent
ANALYSIS = ROOT / "analysis"
BANK_REPORT = os.environ.get("MERC_BANK_REPORT", "bank-full.json")
EXPECTED = {
    "first-arc": "Let it shine",
    "sunlit-steps": "Tiny sparks can glow",
    "gallery-arch": "Another beautiful mess",
}


def normalized(value: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", value.casefold()))


bank = json.loads((ANALYSIS / BANK_REPORT).read_text())
index = json.loads((ANALYSIS / "asr-full" / "index.json").read_text())
audits = []
for variant in bank["variants"]:
    receipt = index["variants"].get(variant["id"])
    if receipt is None or receipt["sourceSha256"] != variant["sha256"]:
        raise SystemExit(f"Missing current ASR receipt for {variant['id']}")
    transcript_path = ANALYSIS / "asr-full" / f"{variant['id']}.json"
    result = json.loads(transcript_path.read_text())
    transcript = " ".join(part["text"].strip() for part in result["transcription"])
    probabilities = [
        token["p"]
        for part in result["transcription"]
        for token in part["tokens"]
        if token["text"] and not token["text"].startswith("[")
    ]
    expected = EXPECTED[variant["melodyId"]]
    audits.append(
        {
            "id": variant["id"],
            "melodyId": variant["melodyId"],
            "rootMidi": variant["rootMidi"],
            "pace": variant["pace"],
            "sourceSha256": receipt["sourceSha256"],
            "modelSha256": receipt["modelSha256"],
            "expected": expected,
            "transcript": transcript,
            "exact": normalized(transcript) == normalized(expected),
            "meanTokenProbability": sum(probabilities) / len(probabilities),
        }
    )

counts = defaultdict(lambda: {"total": 0, "exact": 0})
for audit in audits:
    counts[audit["melodyId"]]["total"] += 1
    counts[audit["melodyId"]]["exact"] += int(audit["exact"])
report = {
    "revision": bank["revision"],
    "bankReport": BANK_REPORT,
    "gate": "hash-bound unprompted Whisper base.en transcript equals intended lyric after case/punctuation normalization",
    "ownerListening": "pending",
    "variantCount": len(audits),
    "exactCount": sum(audit["exact"] for audit in audits),
    "counts": dict(counts),
    "variants": audits,
}
suffix = "" if BANK_REPORT == "bank-full.json" else f"-{Path(BANK_REPORT).stem}"
output = ANALYSIS / f"bank-intelligibility{suffix}.json"
output.write_text(json.dumps(report, indent=2) + "\n")
print(
    json.dumps(
        {key: report[key] for key in ("variantCount", "exactCount", "counts")},
        indent=2,
    )
)
for audit in audits:
    if not audit["exact"]:
        print(f"{audit['id']}: {audit['transcript']!r}")
