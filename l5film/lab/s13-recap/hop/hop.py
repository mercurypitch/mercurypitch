# Merc's hop height on the rendered frames of m-blue-s13 (pass frames 826 to 896, the two hops in `break`):
# the lowest row with alpha >= 128 over 15 px or more (the feet; the hop's dotted arc is single dots) and the body's top row, each frame, against the frames at rest;
# in screen px at the shown size 300 (the drawn square is 225 px: 300 / 225 a drawn px).
import glob, json, sys
import numpy as np
from PIL import Image
root = json.load(open(sys.argv[1]))['root']
rows = []
for f in sorted(glob.glob('f-*.png')):
    i = int(f[2:6])
    im = Image.open(f)
    a = np.asarray(im.convert('RGBA'))[:, :, 3]
    ys = np.where((a >= 128).sum(axis=1) >= 15)[0]   # rows 15 px or more wide: the feet, not the dotted arc
    sole, top = (int(ys.max()), int(ys.min())) if len(ys) else (None, None)
    rows.append((i, sole, top, root[i][1]))
rest = [r for r in rows if abs(r[3]) < 1e-9 and r[1] is not None]
sole0 = float(np.median([r[1] for r in rest])); top0 = float(np.median([r[2] for r in rest]))
k = 300 / 225
best = max(rows, key=lambda r: (sole0 - r[1]) if r[1] is not None else -1)
print(f'rest: sole row {sole0:.0f}, top row {top0:.0f} (drawn px of 225)')
for i, s, tp, ry in rows:
    print(f'{i:5d} sole {s} top {tp} lift {((sole0 - s) * k):6.1f} px  body top {((top0 - tp) * k):6.1f} px  root y {ry:.4f} ({ry * 0.4353 * 300:5.1f} px)')
print(f'highest: frame {best[0]}, the sole {((sole0 - best[1]) * k):.1f} screen px over its rest row (root y {best[3]:.4f}: {best[3] * 0.4353 * 300:.1f} px)')
