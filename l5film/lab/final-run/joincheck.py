"""Every join of the pieces against a single-frame snapshot of the film's root (DECISIONS 269).

  python3 lab/final-run/joincheck.py review/final-film/joins

Reads <dir>/snap/frame-<i>-at-<t>.png (hyperframes snapshot, --at in the order k = 1..18, frames
1800k - 1 then 1800k) and <dir>/film-f<frame>.png (the joined picture's frames), and prints a
markdown table. A snapshot does not draw a video inside a scene (BUILD-GUIDE, trap 5), so the hosts
and their reflections (the band from y 520 down) differ by design; above y 520 a frame must match to
the encoder's noise. Changed = a pixel whose largest channel differs by more than 24 levels.
"""
import glob
import os
import sys

import numpy as np
from PIL import Image

D = sys.argv[1]
CHUNK, N, Y = 1800, 19, 520
frames = [f for k in range(1, N) for f in (k * CHUNK - 1, k * CHUNK)]
snaps = {int(os.path.basename(p).split('-')[1]): p for p in glob.glob(os.path.join(D, 'snap', 'frame-*-at-*.png'))}
print('| join | film frame | time (s) | above y 520: changed px, largest diff | whole frame: changed px | changed box |')
print('| --- | --- | --- | --- | --- | --- |')
worst = 0
for i, f in enumerate(frames):
    if i not in snaps:
        print(f'| {i // 2 + 1} | {f} | {f / 60:.3f} | no snapshot | | |')
        worst = max(worst, 10 ** 9)
        continue
    a = np.asarray(Image.open(snaps[i]).convert('RGB'), dtype=np.int16)
    b = np.asarray(Image.open(os.path.join(D, f'film-f{f}.png')).convert('RGB'), dtype=np.int16)
    d = np.abs(a - b).max(axis=2)
    ch = d > 24
    top = ch[:Y]
    worst = max(worst, int(top.sum()))
    ys, xs = np.nonzero(ch)
    box = f'x {xs.min()} to {xs.max()}, y {ys.min()} to {ys.max()}' if len(xs) else '-'
    print(f'| {i // 2 + 1} | {f} | {f / 60:.3f} | {int(top.sum())}, {int(d[:Y].max())} | {int(ch.sum())} | {box} |')
print(f'\nAbove y {Y}, the most changed pixels in any join frame: {worst}.')
