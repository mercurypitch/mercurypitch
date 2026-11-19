#!/usr/bin/env python3
"""Group E's F-01 experiments: a short window of one of my scenes, rendered alone at 30 fps (the lab renderer,
draft quality, no hosts and no sound), so a type-step fix can be tried and measured without rendering the scene
from 0. The window's time is the scene's own: the clock draws t + TOFF.

  python3 lab/s13-recap/fix-F-01/exp.py <sid> <name> <toff> <len> [<patch.json>]
     writes lab/s13-recap/fix-F-01/exp/<name>/proj; then render it through the heavy helper:
     $S/bin/heavy npx --yes hyperframes@0.8.97 render <proj> --quality draft --fps 30 --output <name>.mp4
  patch.json: [[old, new], ...] applied to the composition after the window's own patches
"""
import json
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
P = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
sid, name, toff, length = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
patches = json.load(open(sys.argv[5])) if len(sys.argv) > 5 else []

src = open(os.path.join(P, 'compositions', sid + '.html')).read()
src = re.sub(r'\s*<video [^>]*></video>', '', src)                               # no hosts
src = re.sub(r'data-duration="[\d.]+"', f'data-duration="{length:.3f}"', src, count=1)
n0 = src.count('L.clock(tl, D, (t) => {')
assert n0 == 1, 'clock'
src = src.replace('L.clock(tl, D, (t) => {', f'L.clock(tl, {length}, (t) => {{ t = t + {toff}')
src, k = re.subn(r'L\.mercGate\(room\.top, \{[^\n]*\}\)', '(() => null)', src)
assert k == 2, k
for old, new in patches:
    assert src.count(old) == 1, old[:60]
    src = src.replace(old, new)

out = os.path.join(HERE, 'exp', name)
proj = os.path.join(out, 'proj')
shutil.rmtree(proj, ignore_errors=True)
os.makedirs(os.path.join(proj, 'compositions'))
os.symlink(os.path.relpath(os.path.join(P, 'assets'), proj), os.path.join(proj, 'assets'))
open(os.path.join(proj, 'compositions', sid + '.html'), 'w').write(src)
for f in ['hyperframes.json', 'package.json']:
    shutil.copy(os.path.join(P, f), os.path.join(proj, f))
json.dump({'id': f'exp-{name}', 'name': f'exp-{name}'}, open(os.path.join(proj, 'meta.json'), 'w'))
idx = open(os.path.join(P, 'lab', sid, 'proj', 'index.html')).read()
idx = re.sub(r'\s*<audio [^>]*></audio>', '', idx)
idx = re.sub(r'data-duration="[\d.]+"', f'data-duration="{length:.3f}"', idx)
idx = re.sub(r'tl\.set\(\{\}, \{\}, [\d.]+\)', f'tl.set({{}}, {{}}, {length:.3f})', idx)
open(os.path.join(proj, 'index.html'), 'w').write(idx)
print(os.path.relpath(proj, P))
