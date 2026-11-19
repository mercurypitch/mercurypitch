# Group D's F-01 round (DECISIONS 231): WCAG contrast of the dimmed feel block's type, measured on pixels. For each text,
# in its box: the glyph pixels are where the frame with the text differs from the frame without it by more than 8; the
# glyphs' colour is the 95th percentile of their luminance (the cores of the strokes), the ground the median of the frame
# without the text over the same pixels. Usage: python3 contrast.py <out dir> <boxes.json>
import json, sys, numpy as np
from PIL import Image
d, boxes = sys.argv[1], json.load(open(sys.argv[2]))
def lin(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def lum(rgb): r, g, b = lin(rgb[..., 0]), lin(rgb[..., 1]), lin(rgb[..., 2]); return 0.2126 * r + 0.7152 * g + 0.0722 * b
for t, bx in boxes.items():
    W = np.asarray(Image.open(f'{d}/c-{float(t):.2f}-with.png').convert('RGB')).astype(float)
    O = np.asarray(Image.open(f'{d}/c-{float(t):.2f}-without.png').convert('RGB')).astype(float)
    print(f'== {float(t):.2f}')
    for k, (x0, y0, x1, y1) in bx.items():
        w, o = W[y0:y1, x0:x1], O[y0:y1, x0:x1]
        m = np.abs(w - o).max(axis=2) > 8
        lw, lo = lum(w), lum(o)
        Lt = np.percentile(lw[m], 95); Lb = np.median(lo[m])
        print(f'  {k:9s} glyph L {Lt:.4f}  ground L {Lb:.4f}  contrast {(max(Lt, Lb) + 0.05) / (min(Lt, Lb) + 0.05):.2f}:1  ({int(m.sum())} glyph px)')
