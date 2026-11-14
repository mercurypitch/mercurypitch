"""Pack the blender-modeler skill and its critic into a zip for a Claude Code install outside this repo.

    python3 -I pack_skill.py [--out blender-modeler-skill.zip]

The zip unpacks into a Claude Code config folder (`~/.claude` for every project on
the machine, or a project's `.claude`):

    skills/blender-modeler/        SKILL.md, references, scripts (bkit, gates, tools, tests)
    agents/model-critic.md         the independent critic the skill spawns each round
    INSTALL-blender-modeler.md     what works where, and how to check it

Inside this repository the skill needs no install: `.claude/skills/blender-modeler`
is picked up as it is. The zip holds the same files at the commit it was packed
from (recorded in INSTALL-blender-modeler.md), without caches.
"""

import argparse
import hashlib
import os
import subprocess
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.dirname(HERE)
CLAUDE = os.path.dirname(os.path.dirname(SKILL))
REPO = os.path.dirname(CLAUDE)
SKIP_DIRS = {'__pycache__', '.pytest_cache'}
SKIP_SUFFIXES = ('.pyc', '.pyo', '.blend1')

INSTALL = """# blender-modeler: install

Packed from mercurypitch at commit {commit}.

Unzip into `~/.claude` (all projects on this machine) or a project's `.claude`:

```bash
unzip blender-modeler-skill.zip -d ~/.claude
```

## What it needs

- **Blender 5.2 LTS.** `bash ~/.claude/skills/blender-modeler/scripts/preflight.sh` finds it,
  or on Linux downloads 5.2.2 into `~/.cache/blender-modeler` (SHA-256 checked) and smoke-renders.
  Export the path it prints: `eval "$(bash .../preflight.sh | grep '^BLENDER=')"`.
- **Python 3 with numpy and Pillow** for the tools that run outside Blender.
- **Node 22** for the Khronos validator. In the repository `gltf_validate.mjs` uses the copy the
  Beside Cue app installs; elsewhere install one beside it:
  `npm i --prefix ~/.claude/skills/blender-modeler/scripts gltf-validator`.

## What works anywhere

- `scripts/bkit/`: the modelling library (lathe, sweep, profile, trims, materials, textures,
  fracture, validate, scene, export). `scripts/tests/test_bkit.py` checks it:
  `$BLENDER -b --factory-startup --python-exit-code 1 --python scripts/tests/test_bkit.py`.
- `asset_pipeline.py`, `validate_asset.py`, `silhouette_render.py` / `silhouette_compare.py`,
  `render_views.py` / `compose_sheet.py`, `gltf_finish.py`: build, gates and sheets.
- `colour_stats.py`, `glb_patch.py`, `glb_recolour.py`, `glb_triangles.py`: measurement and
  probes on GLBs and images, no Blender.

## What needs the game's repository

- `three_preview.mjs` renders with the game's own three.js and light rig, and
  `runtime_proof.mjs` / `runtime_batch.py` serve a candidate inside the running game. Both
  resolve the Beside Cue app from the repository the skill sits in. Outside it, use the
  Blender material panels, and copy the two scripts' approach for another game.
- The Glassworks contracts (`contract.json`) and worked examples (`art/glass-adventure/procedural/`)
  live in the repository; `references/` describes them.

Start with `skills/blender-modeler/SKILL.md`.
"""


def files():
    for root, dirs, names in os.walk(SKILL):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS)
        for name in sorted(names):
            if not name.endswith(SKIP_SUFFIXES):
                path = os.path.join(root, name)
                yield path, os.path.join('skills', os.path.relpath(path, os.path.dirname(SKILL)))
    critic = os.path.join(CLAUDE, 'agents', 'model-critic.md')
    yield critic, os.path.join('agents', 'model-critic.md')


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--out', default='blender-modeler-skill.zip')
    args = ap.parse_args()
    try:
        commit = subprocess.run(['git', '-C', REPO, 'rev-parse', '--short', 'HEAD'], capture_output=True,
                                text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        commit = 'unknown'
    listing = []
    with zipfile.ZipFile(args.out, 'w', zipfile.ZIP_DEFLATED) as zf:
        for path, arc in files():
            data = open(path, 'rb').read()
            zf.writestr(arc, data)
            listing.append(f'{hashlib.sha256(data).hexdigest()[:16]}  {arc}')
        zf.writestr('INSTALL-blender-modeler.md', INSTALL.format(commit=commit) +
                    '\n## Files\n\n```\n' + '\n'.join(listing) + '\n```\n')
    print(f'{args.out}: {len(listing)} files from commit {commit}, {os.path.getsize(args.out) / 1e6:.2f} MB')


if __name__ == '__main__':
    main()
