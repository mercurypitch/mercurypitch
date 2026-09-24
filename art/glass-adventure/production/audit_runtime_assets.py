"""Read-only inventory, geometry screen and glTF validation of the game's loaded GLBs."""
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
    # The shared asset contract declares GLB paths as literal strings. Do not scan
    # archived/public leftovers or execute application code to discover inputs.
    paths = sorted(set(re.findall(r"'([^'\n]+\.glb)'", source)))
    if not paths or not CLI.is_file():
        raise SystemExit("Expected shared GLB paths and installed gltf-transform CLI.")
    files = []
    for path in paths:
        resolved = (PUBLIC / path).resolve()
        if not resolved.is_relative_to(PUBLIC.resolve()) or not resolved.is_file():
            raise SystemExit(f"Missing or invalid game asset path: {path}")
        files.append(str(resolved.relative_to(REPO)))

    for script, report in [
        ("glb_inventory.py", "runtime-glb-inventory.json"),
        ("glb_geometry_audit.py", "runtime-geometry-audit.json"),
    ]:
        subprocess.run([sys.executable, str(SKILL / script), *files,
                        "--output", str(output / report)],
                       cwd=REPO, check=True, timeout=180)

    version = subprocess.check_output([str(CLI), "--version"], cwd=REPO,
                                      timeout=30, text=True).strip()

    def validate(path):
        filename = path.removeprefix("apps/beside-cue/public/games/").replace("/", "-") + ".txt"
        result = subprocess.run([str(CLI), "validate", path], cwd=REPO,
                                text=True, capture_output=True, timeout=180)
        log = (result.stdout + result.stderr).replace(str(REPO) + "/", "")
        (output / filename).write_text(log.rstrip() + "\n")
        return dict(file=path, sha256=hashlib.sha256((REPO / path).read_bytes()).hexdigest(),
                    exitCode=result.returncode, report=filename, validatorVersion=version)

    with ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(validate, files))
    (output / "validation-index.json").write_text(json.dumps(results, indent=2) + "\n")
    failures = [row["file"] for row in results if row["exitCode"] != 0]
    print(json.dumps(dict(assets=len(files), validationFailures=failures, output=str(output))))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
