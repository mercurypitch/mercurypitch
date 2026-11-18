#!/usr/bin/env python3
"""Contact sheets of one audit folder's screenshots: sheet.py <dir> <cols> <tile width> [per sheet]

Writes <dir>/sheet-1.png, sheet-2.png ...: the shots in order, each under its
name, small enough to look over in one view.
"""
import glob
import os
import sys

from PIL import Image, ImageDraw

d, cols, tw = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
per = int(sys.argv[4]) if len(sys.argv) > 4 else cols * 2
files = sorted(f for f in glob.glob(os.path.join(d, "*.png")) if not os.path.basename(f).startswith("sheet-"))
LABEL = 18
for s in range(0, len(files), per):
    batch = files[s : s + per]
    tiles = []
    for f in batch:
        im = Image.open(f).convert("RGB")
        th = round(im.height * tw / im.width)
        tiles.append((os.path.basename(f)[:-4], im.resize((tw, th), Image.LANCZOS)))
    th = max(t.height for _, t in tiles)
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (tw + 6) + 6, rows * (th + LABEL + 6) + 6), (245, 245, 245))
    draw = ImageDraw.Draw(sheet)
    for i, (name, t) in enumerate(tiles):
        x = 6 + (i % cols) * (tw + 6)
        y = 6 + (i // cols) * (th + LABEL + 6)
        draw.text((x + 2, y + 2), name, fill=(0, 0, 0))
        sheet.paste(t, (x, y + LABEL))
    out = os.path.join(d, f"sheet-{s // per + 1}.png")
    sheet.save(out)
    print(out, sheet.size)
