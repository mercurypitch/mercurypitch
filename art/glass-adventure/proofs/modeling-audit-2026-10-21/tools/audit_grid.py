"""Grid of clay + zebra panels across many assets (two assets per row)."""
import sys, os, json
from PIL import Image, ImageDraw, ImageFont
panels_root, out = sys.argv[1], sys.argv[2]
items = [a.split('=', 1) for a in sys.argv[3:]]  # dirname=label
tile = 300; lab = 26
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 14)
cols = 2
rows = (len(items) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tile * 2, rows * (tile + lab)), (24, 26, 30))
d = ImageDraw.Draw(sheet)
for i, (dirname, label) in enumerate(items):
    r, c = divmod(i, cols)
    x = c * tile * 2; y = r * (tile + lab)
    meta = json.load(open(os.path.join(panels_root, dirname, 'meta.json')))
    d.text((x + 6, y + 5), f"{label}  ({meta['tris']:,} tris)", fill=(235, 235, 235), font=font)
    for j, p in enumerate(['clay_three_quarter', 'zebra_front']):
        im = Image.open(os.path.join(panels_root, dirname, p + '.png')).convert('RGB').resize((tile, tile))
        sheet.paste(im, (x + j * tile, y + lab))
sheet.save(out, quality=88); print('SAVED', out, sheet.size)
