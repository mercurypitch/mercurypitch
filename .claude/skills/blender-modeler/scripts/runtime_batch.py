"""Run several candidate GLBs through the game, one after another, and measure each.

    python3 -I runtime_batch.py --config <asset_dir>/proof.json --out DIR a.glb b.glb c.glb \\
        [--shots entry] [--measure 920,177,972,206]

`runtime_proof.mjs` starts the game's dev server on one fixed port, so proofs cannot
run side by side: each takes a lock on the port and waits its turn behind any other
(a pipeline's, another batch's), and this runs its candidates in turn. --shots keeps only the named shots
(the entry shot is the like-for-like frame and takes about two minutes alone).
--measure runs `colour_stats.py` on that box of each candidate's first shot, so a
sweep of material probes (`glb_patch.py`, `glb_recolour.py`) ends in a table to
compare with the concept (`references/qa.md` § Colour in the game).

Writes DIR/<candidate name>/ per candidate (screenshots, runtime-proof.json) and
DIR/<candidate name>.log; exits 1 if any proof failed.
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('candidates', nargs='+')
    ap.add_argument('--config', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--shots', help='comma-separated shot names to keep, e.g. entry')
    ap.add_argument('--measure', help='x0,y0,x1,y1 box for colour_stats on the first shot')
    ap.add_argument('--timeout', type=int, default=3600, help='seconds a proof may take, waiting for the port included')
    args = ap.parse_args()

    config = json.load(open(args.config))
    if args.shots:
        keep = set(args.shots.split(','))
        config['shots'] = [s for s in config['shots'] if s['name'] in keep]
        if not config['shots']:
            raise SystemExit(f'none of {sorted(keep)} in {args.config}')
    os.makedirs(args.out, exist_ok=True)
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False, dir=args.out) as handle:
        json.dump(config, handle, indent=1)
        config_path = handle.name

    failed = 0
    for glb in args.candidates:
        name = os.path.splitext(os.path.basename(glb))[0]
        out_dir = os.path.join(os.path.abspath(args.out), name)
        start = time.time()
        with open(out_dir + '.log', 'w') as log:
            code = subprocess.run(['node', os.path.join(HERE, 'runtime_proof.mjs'), '--config', config_path,
                                   '--candidate', os.path.abspath(glb), '--out', out_dir],
                                  cwd=REPO, stdout=log, stderr=subprocess.STDOUT, timeout=args.timeout).returncode
        print(f'{name}: proof exit {code} in {time.time() - start:.0f}s', flush=True)
        if code:
            failed += 1
            continue
        proof = json.load(open(os.path.join(out_dir, 'runtime-proof.json')))
        view = proof['viewports'][0]
        print(f'   served {view.get("served")} errors {view.get("errors")}', flush=True)
        if args.measure:
            shot = view['shots'][0] if view.get('shots') else os.path.join(out_dir, 'desktop-entry.png')
            subprocess.run([sys.executable, '-I', os.path.join(HERE, 'colour_stats.py'), shot, args.measure])
    os.unlink(config_path)
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
