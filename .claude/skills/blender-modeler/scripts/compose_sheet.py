"""Compose render_views.py panels into one labelled contact sheet (needs Pillow).

python3 -I compose_sheet.py PANEL_DIR OUT.png [TITLE]
Rows are views, columns are modes. The 128 px `game` panel is enlarged with
nearest-neighbour sampling so it shows exactly the pixels a phone would.
"""

import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

panel_dir, out = sys.argv[1], sys.argv[2]
title = sys.argv[3] if len(sys.argv) > 3 else os.path.basename(os.path.abspath(panel_dir))
with open(os.path.join(panel_dir, 'meta.json')) as handle:
    meta = json.load(handle)
views, modes = [], []
for p in meta['panels']:
    if p['view'] not in views:
        views.append(p['view'])
    if p['mode'] not in modes:
        modes.append(p['mode'])
size = max(Image.open(p['path']).size[0] for p in meta['panels'])
header = 54
sheet = Image.new('RGB', (size * len(modes), header + size * len(views)), (24, 26, 30))
draw = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 15)
    bold = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 18)
except OSError:
    font = bold = ImageFont.load_default()
draw.text((10, 6), title, fill=(240, 240, 240), font=bold)
draw.text((10, 30), f"tris {meta['tris']:,}  parts {meta['visibleObjects']}  hidden shards {meta['hiddenShards']}  "
                    f"hidden collision proxies {meta.get('hiddenProxies', 0)}  size {meta['dims_m']} m",
          fill=(190, 200, 210), font=font)
# matids legend: a swatch and the material name, right-aligned in the header
x = sheet.size[0] - 10
for name, colour in reversed(sorted(meta.get('materialColours', {}).items())):
    width = int(draw.textlength(name, font=font))
    x -= width + 26
    draw.rectangle([x, 31, x + 14, 45], fill=colour)
    draw.text((x + 18, 30), name, fill=(220, 220, 220), font=font)
for p in meta['panels']:
    image = Image.open(p['path']).convert('RGB')
    if image.size[0] != size:
        image = image.resize((size, size), Image.NEAREST)
    x = modes.index(p['mode']) * size
    y = header + views.index(p['view']) * size
    sheet.paste(image, (x, y))
    label = f"{p['mode']} / {p['view']}" + (' (128 px)' if p['mode'] == 'game' else '')
    draw.rectangle([x, y, x + 8 + int(draw.textlength(label, font=font)), y + 20], fill=(0, 0, 0))
    draw.text((x + 5, y + 2), label, fill=(255, 255, 255), font=font)
sheet.save(out)
print('SHEET', out, sheet.size)
