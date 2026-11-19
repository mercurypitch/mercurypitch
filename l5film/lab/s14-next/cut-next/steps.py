# The carried object's step from frame to frame through a cut's 30 fps frames (frame 15 is the first after the cut):
# the centroid of the bright pixels in a box, so the step across the cut (14 to 15) can be read against its neighbours.
#   python3 steps.py <dir> x0,y0,x1,y1 [threshold] [blue]   (blue: only the lit beads' blue, B - R over the threshold)
import sys
import numpy as np
from PIL import Image
d, box = sys.argv[1], [int(v) for v in sys.argv[2].split(',')]
th = int(sys.argv[3]) if len(sys.argv) > 3 else 120
prev = None
for i in range(31):
    im = Image.open(f'{d}/frame-{i:03d}.png').convert('RGB')
    if len(sys.argv) > 4 and sys.argv[4] == 'blue':
        rgb = np.asarray(im, dtype=np.float32)[box[1]:box[3], box[0]:box[2]]
        a = rgb[:, :, 2] - rgb[:, :, 0]
    else:
        a = np.asarray(im.convert('L'), dtype=np.float32)[box[1]:box[3], box[0]:box[2]]
    ys, xs = np.where(a > th)
    if not len(xs):
        print(f'{i:3d} none'); prev = None; continue
    w = a[ys, xs]
    cx, cy = box[0] + float((xs * w).sum() / w.sum()), box[1] + float((ys * w).sum() / w.sum())
    step = '' if prev is None else f'step {np.hypot(cx - prev[0], cy - prev[1]):6.2f} px ({cx - prev[0]:+.2f}, {cy - prev[1]:+.2f})'
    print(f'{i:3d} {"after " if i >= 15 else "before"} centroid ({cx:7.2f}, {cy:7.2f})  {step}')
    prev = (cx, cy)
