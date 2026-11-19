#!/usr/bin/env python3
"""A contact sheet of a scene's stills, in time order, each labelled with its time.
  python3 lab/s13-recap/tools/sheet.py <lab/<sid>> <prefix: probe | clip-still> <out.png> [cols]"""
import glob, os, re, sys
from PIL import Image, ImageDraw
d, prefix, out = sys.argv[1], sys.argv[2], sys.argv[3]
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 5
fs = sorted(glob.glob(os.path.join(d, prefix + '-*.png')), key=lambda f: float(re.search(r'-([\d.]+)\.png$', f).group(1)))
w, h = 384, 216
rows = (len(fs) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (w + 6) + 6, rows * (h + 22) + 6), (8, 10, 14))
dr = ImageDraw.Draw(sheet)
for k, f in enumerate(fs):
    x, y = 6 + (k % cols) * (w + 6), 6 + (k // cols) * (h + 22)
    sheet.paste(Image.open(f).convert('RGB').resize((w, h), Image.LANCZOS), (x, y + 18))
    dr.text((x, y + 3), re.search(r'-([\d.]+)\.png$', f).group(1) + ' s', fill=(230, 237, 243))
sheet.save(out)
print(out, len(fs), sheet.size)
