# drawn vertical shift of a crop through a window's frames (row-profile match at 0.01 px), with each frame's step
import sys, glob, math
import numpy as np
from PIL import Image
d, t0 = sys.argv[1], float(sys.argv[2])
fs = sorted(glob.glob(f'{d}/f-*.png'))
prof = lambda f: np.asarray(Image.open(f).convert('L'), dtype=np.float64).sum(axis=1)
p0 = prof(fs[0]); ys = np.arange(len(p0), dtype=float); win = (ys >= 20) & (ys <= len(p0) - 20)
prev = 0
for i, f in enumerate(fs):
    pk = prof(f)
    best = min((float(np.sum((pk[win] - np.interp(ys[win] + s, ys, p0)) ** 2)), s) for s in np.arange(0, 16, 0.01))
    print(f'{t0 + i / 30:7.3f} drawn {best[1]:6.2f} step {best[1] - prev:+5.2f}')
    prev = best[1]
