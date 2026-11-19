#!/usr/bin/env python3
"""A frame-exact sheet of a cut's frames (frame 15 is the first after the cut), each cropped to a box, labelled.
  python3 lab/s13-recap/tools/cutsheet.py <cut dir> x0,y0,x1,y1 <first> <last> <out.png> [scale]
(Kept here: lab/s13-recap/cutprobe.mjs clears its output folder on every run.)"""
import sys
from PIL import Image, ImageDraw
d, box, f0, f1, out = sys.argv[1], [int(v) for v in sys.argv[2].split(',')], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
sc = float(sys.argv[6]) if len(sys.argv) > 6 else 0.5
w, h = int((box[2] - box[0]) * sc), int((box[3] - box[1]) * sc)
n = f1 - f0 + 1
cols = min(n, 4)
rows = (n + cols - 1) // cols
sheet = Image.new('RGB', (cols * (w + 8) + 8, rows * (h + 30) + 8), (8, 10, 14))
dr = ImageDraw.Draw(sheet)
for k, i in enumerate(range(f0, f1 + 1)):
    im = Image.open(f'{d}/frame-{i:03d}.png').convert('RGB').crop(box).resize((w, h), Image.LANCZOS)
    x, y = 8 + (k % cols) * (w + 8), 8 + (k // cols) * (h + 30)
    sheet.paste(im, (x, y + 22))
    dr.text((x, y + 4), f'frame {i}' + (' (first after the cut)' if i == 15 else ' (last before)' if i == 14 else ''), fill=(230, 237, 243))
sheet.save(out)
print(out, sheet.size)
