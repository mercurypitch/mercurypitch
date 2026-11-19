# Before and after of a move's drawn position per frame (from track.py / track-fade.py output), as a step chart: the
# before in grey, the after in blue; a whole-pixel step shows as a stair, a sub-pixel move as a ramp.
#   python3 stepplot.py <out.png> <title> <before.txt> <after.txt> [t0 t1] [title2 before2 after2 t0 t1 ...]
import sys
from PIL import Image, ImageDraw
out = sys.argv[1]
args = sys.argv[2:]
panels = [args[i:i + 5] for i in range(0, len(args), 5)]
W, H, M = 900, 300, 56
img = Image.new('RGB', (W, (H + 20) * len(panels) + 10), (12, 15, 20))
d = ImageDraw.Draw(img)
def read(f, t0, t1):
    rows = []
    for l in open(f):
        p = l.split()
        if not p: continue
        t = float(p[0]); v = float(p[p.index('drawn') + 1])
        if t0 <= t <= t1: rows.append((t, v))
    return rows
for k, (title, bf, af, t0, t1) in enumerate(panels):
    t0, t1 = float(t0), float(t1)
    B, A = read(bf, t0, t1), read(af, t0, t1)
    vs = [v for _, v in B + A]; lo, hi = min(vs), max(vs)
    if hi - lo < 1: hi = lo + 1
    oy = 10 + k * (H + 20)
    X = lambda t: M + (t - t0) / (t1 - t0) * (W - M - 20)
    Y = lambda v: oy + H - 30 - (v - lo) / (hi - lo) * (H - 70)
    d.text((M, oy + 4), title, fill=(230, 237, 243))
    d.text((W - 300, oy + 4), 'grey: before F-01   blue: after', fill=(168, 179, 191))
    import math
    for px in range(math.floor(lo), math.ceil(hi) + 1):
        y = Y(px); d.line([(M, y), (W - 20, y)], fill=(30, 36, 44)); d.text((8, y - 6), f'{px:+d} px', fill=(120, 130, 140))
    d.text((M, oy + H - 22), f'{t0:.2f} s', fill=(120, 130, 140)); d.text((W - 80, oy + H - 22), f'{t1:.2f} s', fill=(120, 130, 140))
    for rows, col in ((B, (150, 156, 164)), (A, (88, 166, 255))):
        for (ta, va), (tb, vb) in zip(rows, rows[1:]):
            d.line([(X(ta), Y(va)), (X(tb), Y(va))], fill=col, width=2); d.line([(X(tb), Y(va)), (X(tb), Y(vb))], fill=col, width=2)
        for t, v in rows:
            d.ellipse([X(t) - 3, Y(v) - 3, X(t) + 3, Y(v) + 3], fill=col)
img.save(out); print(out, img.size)
