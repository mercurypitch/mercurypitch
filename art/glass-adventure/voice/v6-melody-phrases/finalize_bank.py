"""Publish only lyric-verified variants and remove rejected delivery files."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[3]
ANALYSIS = ROOT / "analysis"
PUBLIC = REPO / "apps" / "beside-cue" / "public" / "games" / "adventure-voice-v6"

bank = json.loads((ANALYSIS / "bank-full.json").read_text())
intelligibility = json.loads((ANALYSIS / "bank-intelligibility.json").read_text())
approved_ids = {
    variant["id"] for variant in intelligibility["variants"] if variant["exact"]
}
approved = [variant for variant in bank["variants"] if variant["id"] in approved_ids]
rejected = [variant for variant in bank["variants"] if variant["id"] not in approved_ids]
approved_paths = {
    variant["asset"].removeprefix("adventure-voice-v6/") for variant in approved
}

removed_paths = []
for path in PUBLIC.rglob("*.mp3"):
    relative = str(path.relative_to(PUBLIC))
    if relative not in approved_paths:
        path.unlink()
        removed_paths.append(relative)

report = {
    "revision": bank["revision"],
    "status": "approved",
    "availability": "Only approved variants are shipped; every missing key/pace uses the exact instrumental guide.",
    "codec": bank["codec"],
    "synthesis": bank["synthesis"],
    "automatedAcceptance": intelligibility["gate"],
    "ownerListening": intelligibility["ownerListening"],
    "roots": bank["roots"],
    "paces": bank["paces"],
    "approvedVariantCount": len(approved),
    "rejectedVariantCount": len(rejected),
    "totalBytes": sum(variant["bytes"] for variant in approved),
    "maximumBytes": max(variant["bytes"] for variant in approved),
    "rejectedVariantIds": [variant["id"] for variant in rejected],
    "removedPublicPaths": sorted(removed_paths),
    "variants": approved,
}
(ANALYSIS / "bank-approved.json").write_text(json.dumps(report, indent=2) + "\n")
manifest = {
    "revision": bank["revision"],
    "kind": "merc-exact-contour-bank",
    "availability": report["availability"],
    "lazyLoadOneVariant": True,
    "synthesis": report["synthesis"],
    "automatedAcceptance": report["automatedAcceptance"],
    "ownerListening": report["ownerListening"],
    "roots": bank["roots"],
    "paces": bank["paces"],
    "approvedVariantCount": len(approved),
    "rejectedVariantCount": len(rejected),
    "totalBytes": report["totalBytes"],
    "files": [
        {
            "path": variant["asset"].removeprefix("adventure-voice-v6/"),
            "bytes": variant["bytes"],
            "sha256": variant["sha256"],
        }
        for variant in approved
    ],
}
manifest_path = PUBLIC / "manifest.json"
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
subprocess.run(
    ["pnpm", "exec", "prettier", "--write", str(manifest_path)],
    cwd=REPO,
    check=True,
    stdout=subprocess.DEVNULL,
)
print(
    json.dumps(
        {
            key: report[key]
            for key in (
                "approvedVariantCount",
                "rejectedVariantCount",
                "totalBytes",
                "maximumBytes",
            )
        },
        indent=2,
    )
)
