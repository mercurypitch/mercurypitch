"""Draw measure.json callouts (dimension lines, ticks, dots, part legend) over the part-ID render.

python3 -I annotate_measure.py MEASURE_DIR OUT.png [TITLE]
"""
import json, sys, os
from PIL import Image, ImageDraw, ImageFont

d = sys.argv[1]; out = sys.argv[2]; title = sys.argv[3] if len(sys.argv) > 3 else ''
m = json.load(open(os.path.join(d, 'measure.json')))
im = Image.open(m['image']).convert('RGB')
dr = ImageDraw.Draw(im)
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 17)
bold = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 19)
ink = (255, 236, 140)
for ln in m['lines']:
    (ax, ay), (bx, by) = ln['a'], ln['b']
    dr.line([(ax, ay), (bx, by)], fill=ink, width=2)
    vertical = abs(bx - ax) < abs(by - ay)
    for x, y in ((ax, ay), (bx, by)):
        if vertical:
            dr.line([(x - 8, y), (x + 8, y)], fill=ink, width=2)
        else:
            dr.line([(x, y - 8), (x, y + 8)], fill=ink, width=2)
    tw = dr.textlength(ln['label'], font=font)
    if vertical:
        tx, ty = ax + 10, (ay + by) / 2 - 10
    elif ln['side'] == 'below':
        tx, ty = (ax + bx) / 2 - tw / 2, max(ay, by) + 8
    else:
        tx, ty = (ax + bx) / 2 - tw / 2, min(ay, by) - 24
    dr.rectangle([tx - 3, ty - 1, tx + tw + 3, ty + 21], fill=(0, 0, 0))
    dr.text((tx, ty), ln['label'], fill=ink, font=font)
for x, y in m['dots']:
    dr.ellipse([x - 5, y - 5, x + 5, y + 5], fill=(255, 80, 80), outline=(0, 0, 0))
y = 10
if title:
    dr.text((12, y), title, fill=(255, 255, 255), font=bold); y += 30
for p in m['parts']:
    dr.rectangle([12, y + 3, 28, y + 19], fill=tuple(p['rgb']), outline=(0, 0, 0))
    dr.text((36, y), p['name'], fill=(230, 230, 230), font=font); y += 24
y += 6
for k, v in m['ratios'].items():
    dr.text((12, y), f'{k} = {v}', fill=(200, 220, 255), font=font); y += 22
im.save(out); print('ANNOTATED', out)
