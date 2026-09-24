"""Reproduce the eight reviewed, attribute-only repairs from immutable receipts."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

REPO = Path(__file__).resolve().parents[3]
ROOT = REPO / "art/glass-adventure/attribute-repair-v1"
reports = sorted((ROOT / "reports").glob("*.json"))
assert len(reports) == 8, "Review any change to the accepted repair set."
for path in reports:
    receipt = json.loads(path.read_text())
    source = REPO / receipt["source"]
    target = REPO / receipt["output"]
    assert hashlib.sha256(source.read_bytes()).hexdigest() == receipt["sourceSha256"]
    subprocess.run([
        sys.executable, str(REPO / "art/glass-adventure/production/repair_export_attributes.py"),
        receipt["source"], receipt["output"], "--report", str(path.relative_to(REPO)),
    ], cwd=REPO, check=True, timeout=30, stdout=subprocess.DEVNULL)
    assert hashlib.sha256(target.read_bytes()).hexdigest() == receipt["outputSha256"]
print("Eight attribute repairs reproduced with identical accepted output hashes.")
