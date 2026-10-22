"""Build an asset and run every gate on it, in order, with one summary at the end.

python3 -I asset_pipeline.py ASSET_DIR OUT_DIR [--intact-only] [--sheet] [--shards-sheet] [--seed N]

ASSET_DIR holds build.py and asset.json:
  {"name": "opaline-echo-amphora",
   "contract": "contract.json",           validate_asset.py gates (skipped with --intact-only)
   "optics": "optics.json",               gltf_finish.py extension blocks (optional)
   "concept": "../../v6-level2/concepts/opaline-echo-amphora.png",
   "elevation_deg": 8}                    camera elevation of the concept, for the silhouette gate
Paths are relative to ASSET_DIR. Writes OUT_DIR/<name>.glb and OUT_DIR/pipeline.json,
and exits 1 when any gate fails. The gates decide; the sheets are for eyes.
"""

import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))


def blender():
    found = os.environ.get('BLENDER')
    if found:
        return found
    out = subprocess.run(['bash', os.path.join(HERE, 'preflight.sh')], capture_output=True, text=True, check=True)
    return [line for line in out.stdout.splitlines() if line.startswith('BLENDER=')][-1].split('=', 1)[1]


def run(cmd, log, cwd=None):
    with open(log, 'w') as handle:
        result = subprocess.run(cmd, stdout=handle, stderr=subprocess.STDOUT, cwd=cwd)
    with open(log) as handle:
        text = handle.read()
    return result.returncode, text


def main():
    args = sys.argv[1:]
    asset_dir, out_dir = os.path.abspath(args[0]), os.path.abspath(args[1])
    intact_only = '--intact-only' in args
    seed = args[args.index('--seed') + 1] if '--seed' in args else None
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(asset_dir, 'asset.json')) as handle:
        asset = json.load(handle)
    path = lambda key: os.path.normpath(os.path.join(asset_dir, asset[key]))  # noqa: E731
    exe = blender()
    raw = os.path.join(out_dir, 'raw.glb')
    glb = os.path.join(out_dir, f"{asset['name']}.glb")
    summary = {'asset': asset['name'], 'glb': glb, 'gates': {}}

    cmd = [exe, '-b', '--factory-startup', '--python-exit-code', '1', '--python', os.path.join(asset_dir, 'build.py'),
           '--', '--out', raw, '--blend', os.path.join(out_dir, f"{asset['name']}.blend")]
    if intact_only:
        cmd.append('--intact-only')
    if seed:
        cmd += ['--seed', seed]
    code, text = run(cmd, os.path.join(out_dir, 'build.log'), cwd=asset_dir)
    built = [line for line in text.splitlines() if line.startswith('BUILD ')]
    summary['gates']['build'] = code == 0 and bool(built)
    if not summary['gates']['build']:
        print(text[-3000:])
        raise SystemExit(f'build failed; see {out_dir}/build.log')
    summary['build'] = json.loads(built[-1][6:])

    if 'optics' in asset:
        code, text = run([sys.executable, '-I', os.path.join(HERE, 'gltf_finish.py'), raw, glb,
                          '--optics', path('optics')], os.path.join(out_dir, 'finish.log'))
        summary['gates']['finish'] = code == 0
        if code:
            print(text)
            raise SystemExit('gltf_finish failed')
    else:
        os.replace(raw, glb)

    if not intact_only and 'contract' in asset:
        code, text = run([exe, '-b', '--factory-startup', '--python-exit-code', '1', '--python',
                          os.path.join(HERE, 'validate_asset.py'), '--', glb, path('contract'),
                          '--out', os.path.join(out_dir, 'validate.json')], os.path.join(out_dir, 'validate.log'))
        summary['gates']['contract'] = code == 0
        summary['contract_problems'] = [line for line in text.splitlines() if line.startswith('FAIL')]

    code, text = run(['node', os.path.join(HERE, 'gltf_validate.mjs'), glb, '--json',
                      os.path.join(out_dir, 'gltf-validator.json')], os.path.join(out_dir, 'gltf-validator.log'))
    summary['gates']['khronos'] = code == 0
    with open(os.path.join(out_dir, 'gltf-validator.json')) as handle:
        report = json.load(handle)
    summary['khronos'] = {k: report[k] for k in ('errors', 'warnings', 'extensionsUsed')}

    if 'concept' in asset:
        mask = os.path.join(out_dir, 'silhouette-mask.png')
        run([exe, '-b', '--factory-startup', '--python', os.path.join(HERE, 'silhouette_render.py'), '--', glb, mask,
             '--elevation', str(asset.get('elevation_deg', 0))], os.path.join(out_dir, 'silhouette-render.log'))
        code, text = run([sys.executable, '-I', os.path.join(HERE, 'silhouette_compare.py'), path('concept'), mask,
                          os.path.join(out_dir, 'silhouette')], os.path.join(out_dir, 'silhouette.log'))
        result = json.loads(text.strip().splitlines()[-1])
        summary['silhouette'] = {k: result[k] for k in ('iou', 'worst_band', 'worst_delta', 'band_delta')}
        summary['gates']['silhouette'] = result['forms_pass']

    if '--sheet' in args or '--shards-sheet' in args:
        for kind in (['intact'] if '--sheet' in args else []) + (['shards'] if '--shards-sheet' in args else []):
            panels = os.path.join(out_dir, f'panels-{kind}')
            cmd = [exe, '-b', '--factory-startup', '--python', os.path.join(HERE, 'render_views.py'), '--', glb, panels,
                   '--res', '420', '--samples', '48']
            if kind == 'intact':
                cmd += ['--modes', 'clay,zebra,matids,material,game', '--views', 'three_quarter,front,side,top,low']
            else:  # the shard set on its own, as it sits before the break
                cmd += ['--show-shards', '--hide', '_intact$', '--modes', 'clay,matids,material',
                        '--views', 'three_quarter,front,top']
            run(cmd, os.path.join(out_dir, f'render-{kind}.log'))
            run([sys.executable, '-I', os.path.join(HERE, 'compose_sheet.py'), panels,
                 os.path.join(out_dir, f'sheet-{kind}.png'), f"{asset['name']} ({kind})"],
                os.path.join(out_dir, f'compose-{kind}.log'))

    summary['pass'] = all(summary['gates'].values())
    with open(os.path.join(out_dir, 'pipeline.json'), 'w') as handle:
        json.dump(summary, handle, indent=1, default=str)
    print(json.dumps({'pass': summary['pass'], 'gates': summary['gates'],
                      'intact_tris': summary['build'].get('intact', {}).get('tris'),
                      'silhouette': summary.get('silhouette'), 'khronos': summary['khronos'],
                      'contract_problems': summary.get('contract_problems', [])}, indent=1))
    if not summary['pass']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
