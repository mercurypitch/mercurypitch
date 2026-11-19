# drawn vertical shift of type that fades as it moves (a leave): each frame's row profile less the background's
# (the last frame, the type gone), normalised to its own sum, matched to the first frame's at 0.01 px
#   python3 track-fade.py <dir of f-*.png> <t0> [fps] [in]
# 'in' reads an entrance instead: the background is the first frame (the type not yet there), the reference the last
# (the type settled), and the shift is how far below its place each frame draws it
import sys, glob
import numpy as np
from PIL import Image
d, t0 = sys.argv[1], float(sys.argv[2]); fps = float(sys.argv[3]) if len(sys.argv) > 3 else 30
fs = sorted(glob.glob(f'{d}/f-*.png'))
if len(sys.argv) > 4 and sys.argv[4] == 'in':
    fs = fs[::-1]
prof = lambda f: np.asarray(Image.open(f).convert('L'), dtype=np.float64).sum(axis=1)
bg = prof(fs[-1])
norm = lambda p: (lambda q: q / max(q.sum(), 1e-9))(np.clip(p - bg, 0, None))
p0 = norm(prof(fs[0])); ys = np.arange(len(p0), dtype=float); win = (ys >= 20) & (ys <= len(p0) - 20)
prev = 0
rows = []
for i, f in enumerate(fs[:-1]):
    raw = np.clip(prof(f) - bg, 0, None); ink = raw.sum()
    pk = raw / max(ink, 1e-9)
    best = min((float(np.sum((pk[win] - np.interp(ys[win] + s, ys, p0)) ** 2)), s) for s in np.arange(-24, 24, 0.01))
    rows.append((i, ink / max(np.clip(prof(fs[0]) - bg, 0, None).sum(), 1e-9), best[1]))
if fs is not sorted(fs) and len(sys.argv) > 4 and sys.argv[4] == 'in':
    n = len(fs)
    rows = [(n - 1 - i, a, b) for i, a, b in rows][::-1]
for i, a, b in rows:
    print(f'{t0 + i / fps:7.3f} ink {a:5.2f} drawn {b:6.2f} step {b - prev:+5.2f}')
    prev = b
