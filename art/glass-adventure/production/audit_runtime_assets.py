"""Read-only inventory, geometry screen and validation of loaded glTF assets."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

REPO = Path(__file__).resolve().parents[3]
PUBLIC = REPO / "apps/beside-cue/public/games"
SKILL = REPO / ".agents/skills/game-asset-production/scripts"
CLI = REPO / "apps/beside-cue/node_modules/.bin/gltf-transform"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    source = (REPO / "packages/glass-game/src/browser/assets.ts").read_text()
    # The shared asset contract declares glTF paths as literal strings. Do not scan
    # archived/public leftovers or execute application code to discover inputs.
    paths = sorted(set(re.findall(r"'([^'\n]+\.(?:glb|gltf))'", source)))
    if not paths or not CLI.is_file():
        raise SystemExit(
            "Expected shared glTF/GLB paths and installed gltf-transform CLI."
        )
    files = []
    for path in paths:
        resolved = (PUBLIC / path).resolve()
        if not resolved.is_relative_to(PUBLIC.resolve()) or not resolved.is_file():
            raise SystemExit(f"Missing or invalid game asset path: {path}")
        files.append(str(resolved.relative_to(REPO)))

    inventory_path = output / "runtime-glb-inventory.json"
    for script, report in [
        ("glb_inventory.py", "runtime-glb-inventory.json"),
        ("glb_geometry_audit.py", "runtime-geometry-audit.json"),
    ]:
        subprocess.run(
            [
                sys.executable,
                str(SKILL / script),
                *files,
                "--output",
                str(output / report),
            ],
            cwd=REPO,
            check=True,
            timeout=180,
        )

    inventory = json.loads(inventory_path.read_text())
    provenance = {asset["file"]: asset for asset in inventory["assets"]}
    if set(provenance) != set(files):
        raise SystemExit("Runtime inventory did not preserve every selected asset.")

    version = subprocess.check_output(
        [str(CLI), "--version"], cwd=REPO, timeout=30, text=True
    ).strip()

    def validate(path):
        filename = (
            path.removeprefix("apps/beside-cue/public/games/").replace("/", "-")
            + ".txt"
        )
        result = subprocess.run(
            [str(CLI), "validate", path],
            cwd=REPO,
            text=True,
            capture_output=True,
            timeout=180,
        )
        log = (result.stdout + result.stderr).replace(str(REPO) + "/", "")
        (output / filename).write_text(log.rstrip() + "\n")
        record = provenance[path]
        actual = (REPO / path).read_bytes()
        if (
            len(actual) != record["bytes"]
            or hashlib.sha256(actual).hexdigest() != record["sha256"]
        ):
            raise RuntimeError(f"Asset changed during runtime audit: {path}")
        for dependency in record["dependencies"]:
            dependency_bytes = (REPO / dependency["file"]).read_bytes()
            if (
                len(dependency_bytes) != dependency["bytes"]
                or hashlib.sha256(dependency_bytes).hexdigest()
                != dependency["sha256"]
            ):
                raise RuntimeError(
                    "Asset dependency changed during runtime audit: "
                    f"{dependency['file']}"
                )
        return {
            "file": path,
            "bytes": record["bytes"],
            "sha256": record["sha256"],
            "dependencies": record["dependencies"],
            "exitCode": result.returncode,
            "report": filename,
            "validatorVersion": version,
        }

    with ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(validate, files))
    (output / "validation-index.json").write_text(json.dumps(results, indent=2) + "\n")
    failures = [row["file"] for row in results if row["exitCode"] != 0]
    print(
        json.dumps(
            {
                "assets": len(files),
                "validationFailures": failures,
                "output": str(output),
            }
        )
    )
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
