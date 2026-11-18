"""Compose render_views.py panels into one labelled contact sheet.

python3 -I compose_sheet.py PANEL_DIR OUT.png [TITLE]
"""
import json, sys, os
from PIL import Image, ImageDraw, ImageFont

panel_dir, out = sys.argv[1], sys.argv[2]
title = sys.argv[3] if len(sys.argv) > 3 else os.path.basename(panel_dir)
meta = json.load(open(os.path.join(panel_dir, 'meta.json')))
views, modes = [], []
for p in meta['panels']:
    if p['view'] not in views: views.append(p['view'])
    if p['mode'] not in modes: modes.append(p['mode'])
first = Image.open(meta['panels'][0]['path'])
w, h = first.size
header = 54
sheet = Image.new('RGB', (w * len(modes), header + h * len(views)), (24, 26, 30))
d = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 15)
    big = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 18)
except OSError:
    font = big = ImageFont.load_default()
d.text((10, 6), title, fill=(240, 240, 240), font=big)
d.text((10, 30), f"tris {meta['tris']:,}  objects {meta['visibleObjects']}  hidden shards {meta['hiddenShards']}  hidden collision proxies {meta.get('hiddenProxies', 0)}  "
                 f"dims {meta['dims_m']} m", fill=(190, 200, 210), font=font)
for p in meta['panels']:
    im = Image.open(p['path']).convert('RGB')
    x = modes.index(p['mode']) * w; y = header + views.index(p['view']) * h
    sheet.paste(im, (x, y))
    d.rectangle([x, y, x + 150, y + 20], fill=(0, 0, 0))
    d.text((x + 5, y + 2), f"{p['mode']} / {p['view']}", fill=(255, 255, 255), font=font)
sheet.save(out)
print('SHEET', out, sheet.size)
