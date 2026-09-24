"""Select intelligible provisional sources while retaining every audition for listening."""
from __future__ import annotations

import json
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parent
plan = json.loads((ROOT / "phrase-plan.json").read_text())
audit = json.loads((ROOT / "analysis" / "source-audit.json").read_text())
metrics = {take["id"]: take for take in audit["takes"]}


def normalized(value: str) -> str:
    return " ".join(re.findall(r"[a-z]+", value.casefold()))


def asr(identity: str) -> dict:
    body = json.loads((ROOT / "analysis" / f"{identity}-asr.json").read_text())
    transcript = " ".join(
        segment["text"].strip() for segment in body["transcription"]
    ).strip()
    tokens = [
        token
        for segment in body["transcription"]
        for token in segment.get("tokens", [])
        if not token["text"].startswith("[")
        and re.search(r"[A-Za-z]", token["text"])
    ]
    return {
        "transcript": transcript,
        "lexical_token_mean_probability": sum(t["p"] for t in tokens) / len(tokens),
        "lexical_token_minimum_probability": min(t["p"] for t in tokens),
    }


report = {
    "revision": plan["revision"],
    "status": "provisional-mechanical-selection-owner-listening-required",
    "method": "exact unprompted Whisper base.en transcript, then highest mean lexical-token probability; zero clipping required",
    "phrases": [],
}
for phrase in plan["phrases"]:
    candidates = []
    for identity in phrase["auditions"]:
        candidate = {"id": identity, **asr(identity), **metrics[identity]}
        candidate["exact_transcript"] = normalized(candidate["transcript"]) == normalized(
            phrase["words"]
        )
        candidates.append(candidate)
    eligible = [
        candidate
        for candidate in candidates
        if candidate["exact_transcript"] and candidate["clipped_samples"] == 0
    ]
    if not eligible:
        raise SystemExit(f"No intelligible unclipped source for {phrase['id']}")
    selected = max(
        eligible,
        key=lambda candidate: candidate["lexical_token_mean_probability"],
    )
    report["phrases"].append(
        {
            "id": phrase["id"],
            "melody_id": phrase["melody_id"],
            "words": phrase["words"],
            "selected_source": selected["id"],
            "candidates": candidates,
        }
    )

(ROOT / "analysis" / "source-selection.json").write_text(
    json.dumps(report, indent=2) + "\n"
)
print(
    json.dumps(
        {
            "status": report["status"],
            "selected": [phrase["selected_source"] for phrase in report["phrases"]],
        }
    )
)
