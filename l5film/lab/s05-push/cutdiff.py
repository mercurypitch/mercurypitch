# Group B: compare the two frames either side of a cut, region by region. For each region, the shift (within +-3 px)
# that best matches the incoming frame to the outgoing one, and the mean absolute residual (0 to 255) at that shift and
# at no shift. A carried object that holds still across the cut gives a best shift of (0, 0).
# python3 lab/s05-push/cutdiff.py <outgoing.png> <incoming.png> name:x0,y0,x1,y1 ...
import sys
import numpy as np
from PIL import Image

a = np.asarray(Image.open(sys.argv[1]).convert('L'), dtype=np.float32)
b = np.asarray(Image.open(sys.argv[2]).convert('L'), dtype=np.float32)
R = 3
for spec in sys.argv[3:]:
    name, box = spec.split(':')
    x0, y0, x1, y1 = (int(v) for v in box.split(','))
    ref = a[y0:y1, x0:x1]
    best = None
    for dy in range(-R, R + 1):
        for dx in range(-R, R + 1):
            cand = b[y0 + dy:y1 + dy, x0 + dx:x1 + dx]
            if cand.shape != ref.shape:
                continue
            e = float(np.abs(cand - ref).mean())
            if best is None or e < best[0]:
                best = (e, dx, dy)
    e0 = float(np.abs(b[y0:y1, x0:x1] - ref).mean())
    ink = float((ref > 120).mean() * 100)
    print(f'{name:14s} best shift ({best[1]:+d}, {best[2]:+d}) residual {best[0]:.2f}; at (0, 0) {e0:.2f}; bright pixels {ink:.1f} %')
