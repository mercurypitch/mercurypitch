"""A strip of merc-pass.mjs --stills frames with their film times (the final run's look at the breaths).

  python3 lab/final-run/strip.py <stills dir> <out.png> <pass id>:<filmStart>:<film time>,... [...]

One row per argument; each tile is the still nearest that film time, drawn at twice its size.
"""
import glob, os, re, sys
from PIL import Image, ImageDraw, ImageFont

d, out, rows = sys.argv[1], sys.argv[2], sys.argv[3:]
font = ImageFont.truetype(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets/fonts/Outfit-wght.ttf'), 20)
tiles = []
for r in rows:
    pid, t0, ts = r.split(':')
    have = {float(re.search(r'-(\d+\.\d+)\.png$', f).group(1)): f for f in glob.glob(os.path.join(d, pid + '-*.png'))}
    row = []
    for t in map(float, ts.split(',')):
        k = min(have, key=lambda x: abs(x - (t - float(t0))))
        im = Image.open(have[k]).convert('RGB')
        im = im.resize((im.width * 2, im.height * 2), Image.LANCZOS)
        ImageDraw.Draw(im).text((8, 6), f'{pid} {k + float(t0):.2f}', fill=(230, 237, 243), font=font)
        row.append(im)
    tiles.append(row)
W = max(sum(im.width for im in row) for row in tiles)
H = sum(row[0].height for row in tiles)
sheet = Image.new('RGB', (W, H), (13, 17, 23))
y = 0
for row in tiles:
    x = 0
    for im in row:
        sheet.paste(im, (x, y))
        x += im.width
    y += row[0].height
sheet.save(out)
print(out, sheet.size)
