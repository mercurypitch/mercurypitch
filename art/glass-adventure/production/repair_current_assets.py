"""Reproduce the eight reviewed, attribute-only repairs from immutable receipts."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import tempfile

REPO = Path(__file__).resolve().parents[3]
ROOT = REPO / "art/glass-adventure/attribute-repair-v1"


def file_sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def promote_atomically(candidate, target):
    """Replace a target only after its candidate has passed all receipt checks."""
    if target.exists() and file_sha256(target) == file_sha256(candidate):
        return False
    target.parent.mkdir(parents=True, exist_ok=True)
    mode = (
        stat.S_IMODE(target.stat().st_mode)
        if target.exists()
        else stat.S_IMODE(candidate.stat().st_mode)
    )
    descriptor, staged_name = tempfile.mkstemp(
        prefix=f".{target.name}.", suffix=".tmp", dir=target.parent
    )
    staged = Path(staged_name)
    try:
        with os.fdopen(descriptor, "wb") as destination, candidate.open("rb") as source:
            shutil.copyfileobj(source, destination)
            destination.flush()
            os.fsync(destination.fileno())
        staged.chmod(mode)
        os.replace(staged, target)
    finally:
        staged.unlink(missing_ok=True)
    return True


def verify_candidate_receipt(candidate, accepted, candidate_output):
    """Validate accepted fields while allowing unaccepted diagnostic metadata."""
    assert candidate.get("source") == accepted["source"], (
        "Candidate report changed the immutable source path."
    )
    assert Path(candidate.get("output", "")).resolve() == candidate_output.resolve(), (
        "Candidate report did not describe its staged output."
    )
    normalized = dict(candidate)
    normalized["output"] = accepted["output"]
    for key, value in accepted.items():
        assert normalized.get(key) == value, f"Candidate report drifted from accepted field {key!r}."


def reproduce_receipt(path, repo=REPO, runner=subprocess.run):
    """Rebuild one accepted derivative without exposing it to an unverified write."""
    accepted_bytes = path.read_bytes()
    accepted = json.loads(accepted_bytes)
    source = repo / accepted["source"]
    target = repo / accepted["output"]
    assert file_sha256(source) == accepted["sourceSha256"], "Immutable repair source hash changed."

    with tempfile.TemporaryDirectory(prefix="glass-attribute-repair-") as directory:
        staging = Path(directory)
        candidate_output = staging / target.name
        candidate_report = staging / path.name
        runner(
            [
                sys.executable,
                str(repo / "art/glass-adventure/production/repair_export_attributes.py"),
                accepted["source"],
                str(candidate_output),
                "--report",
                str(candidate_report),
            ],
            cwd=repo,
            check=True,
            timeout=30,
            stdout=subprocess.DEVNULL,
        )

        assert candidate_output.is_file(), "Repair did not produce a staged candidate."
        assert file_sha256(candidate_output) == accepted["outputSha256"], (
            "Candidate output hash drifted; accepted artifact was not replaced."
        )
        candidate = json.loads(candidate_report.read_bytes())
        verify_candidate_receipt(candidate, accepted, candidate_output)

        # The receipt is the acceptance authority, not regenerated output. Extra
        # diagnostics from a newer repair tool therefore never rewrite it.
        assert path.read_bytes() == accepted_bytes, (
            "Accepted receipt changed during staged verification."
        )
        return promote_atomically(candidate_output, target)


def main():
    reports = sorted((ROOT / "reports").glob("*.json"))
    assert len(reports) == 8, "Review any change to the accepted repair set."
    for path in reports:
        reproduce_receipt(path)
    print("Eight attribute repairs reproduced with identical accepted output hashes.")


if __name__ == "__main__":
    main()
