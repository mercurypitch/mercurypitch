# Group B: where a measure.py "pop" is. For each time, the frames before, at and after it (frame-exact, 30 fps), and
# the boxes of the pixels that change by more than 24 (luma) from the frame before and to the frame after, with counts.
# python3 lab/s05-push/popwhere.py <clip.mp4> <out-dir> t1 t2 ...
import os
import subprocess
import sys
import numpy as np
from PIL import Image

clip, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)


def frame(n):
    p = os.path.join(out, f'f{n:05d}.png')
    if not os.path.exists(p):
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', clip, '-vf', f'select=eq(n\\,{n})', '-fps_mode', 'passthrough',
                        '-frames:v', '1', p], check=True)
    return np.asarray(Image.open(p).convert('L'), dtype=np.int16)


def boxes(d):
    m = d > 24
    if not m.any():
        return 'none'
    # cluster by coarse 40 px cells
    ys, xs = np.nonzero(m)
    cells = {}
    for y, x in zip(ys, xs):
        cells.setdefault((y // 40, x // 40), []).append((x, y))
    groups = []
    for (cy, cx), pts in sorted(cells.items(), key=lambda kv: -len(kv[1]))[:4]:
        a = np.array(pts)
        groups.append(f'{len(pts)} px at x {a[:, 0].min()}-{a[:, 0].max()}, y {a[:, 1].min()}-{a[:, 1].max()}')
    return f'{int(m.sum())} px; ' + '; '.join(groups)


for ts in sys.argv[3:]:
    n = round(float(ts) * 30)
    a, b, c = frame(n - 1), frame(n), frame(n + 1)
    print(f'{ts} (frame {n}): in  {boxes(np.abs(b - a))}')
    print(f'{" " * len(ts)}               out {boxes(np.abs(c - b))}')
