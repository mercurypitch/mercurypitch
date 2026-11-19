# Group D's fix round (D-01): the ring's bounds from the isolated shots (geomshots.js): ink is any pixel brighter than
# 16 of 255 over black. Prints each element's ink box, the gaps between them (nearest pixels), and from the floor
# horizon at screen y 840. Usage: python3 geom.py <out dir>
import sys, numpy as np
from PIL import Image
OUT = sys.argv[1]
def mask(name, thr=16):
    a = np.asarray(Image.open(f'{OUT}/geom-{name}.png').convert('L')).astype(int)
    return a > thr
def box(m):
    ys, xs = np.nonzero(m)
    return (xs.min(), ys.min(), xs.max(), ys.max()) if len(xs) else None
def gap(m1, m2):
    # nearest pixels between two masks, on their edge pixels (chunked brute force)
    def edge(m):
        e = m.copy(); e[1:-1, 1:-1] &= ~(m[:-2, 1:-1] & m[2:, 1:-1] & m[1:-1, :-2] & m[1:-1, 2:])
        return np.argwhere(e).astype(np.float32)
    p1, p2 = edge(m1), edge(m2)
    if not len(p1) or not len(p2): return None
    best = 1e9
    for k in range(0, len(p1), 2000):
        d = ((p1[k:k + 2000, None, :] - p2[None, :, :]) ** 2).sum(-1)
        best = min(best, float(d.min()))
    return best ** 0.5
for name, parts in [('breath', ['ring', 'breathe', 'nothing']), ('hold', ['ring', 'nothing']), ('echo', ['echo']), ('f0', ['ring', 'row', 'line1', 'line2', 'nothing'])]:
    ms = {p: mask(f'{name}-{p}') for p in parts}
    print(f'== {name}')
    for p, m in ms.items():
        b = box(m); print(f'  {p:8s} ink x {b[0]} to {b[2]}, y {b[1]} to {b[3]}' + (f'; {839 - b[3]} px rows clear above the floor horizon (y 840)' if b else ''))
    if name == 'breath':
        r, bm = ms['ring'], ms['breathe'].copy(); bm[:, 1560:] = False   # "Breathe in," without "low and quiet"
        print(f'  the ring\'s top row {box(r)[1]} against the foot row of "Breathe in," {box(bm)[3]}: {box(r)[1] - box(bm)[3] - 1} rows between')
    ps = list(ms)
    for i in range(len(ps)):
        for j in range(i + 1, len(ps)):
            print(f'  gap {ps[i]} / {ps[j]}: {gap(ms[ps[i]], ms[ps[j]]):.1f} px')
