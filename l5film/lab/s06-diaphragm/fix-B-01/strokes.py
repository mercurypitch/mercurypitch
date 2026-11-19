# Group B, fix round B-01: which stretches of the gauge's strokes show on a still at F-gauge (screen = 1.05 world - (60, 25.25)).
# python3 lab/s06-diaphragm/fix-B-01/strokes.py <still.png> ...
import sys
import numpy as np
from PIL import Image


def runs(mask, x0):
    out, start = [], None
    for i, v in enumerate(mask):
        if not v and start is None:
            start = i
        if v and start is not None:
            out.append((x0 + start, x0 + i - 1)); start = None
    if start is not None:
        out.append((x0 + start, x0 + len(mask) - 1))
    return [r for r in out if r[1] - r[0] >= 3]


for f in sys.argv[1:]:
    a = np.asarray(Image.open(f).convert('RGB'), dtype=np.int16)
    X0, X1 = 740, 1660                                   # inside the frame's stroke ends
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    luma = 0.299 * R + 0.587 * G + 0.114 * B
    # each stroke: the brightest of its rows, column by column, against the ground a few px off it
    def seen(rows, test):
        return np.array([any(test(y, x) for y in rows) for x in range(X0, X1 + 1)])
    gold = seen(range(609, 614), lambda y, x: R[y, x] > 140 and R[y, x] - B[y, x] > 70)
    goldLoud = seen(range(449, 454), lambda y, x: R[y, x] > 140 and R[y, x] - B[y, x] > 70)
    if goldLoud.sum() > gold.sum():
        gold = goldLoud
    band = seen(range(225, 229), lambda y, x: R[y, x] - B[y, x] > 25 and luma[y, x] > 45)
    top = seen(range(278, 282), lambda y, x: luma[y, x] > 38)
    print(f)
    for name, m in (('gold line (y 611 Quiet, 451 Loud)', gold), ("small band's lower edge (y 227)", band), ("frame's top stroke (y 279)", top)):
        print(f'  {name}: shown {int(m.sum())} of {len(m)} columns; hidden runs {runs(m, X0) or "none"}')
