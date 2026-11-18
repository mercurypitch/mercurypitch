"""Two-row comparison of the same panels from two render_views.py runs."""
import sys, os
from PIL import Image, ImageDraw, ImageFont
a_dir, a_label, b_dir, b_label, out = sys.argv[1:6]
panels = ['clay_three_quarter', 'zebra_front', 'wire_three_quarter', 'material_three_quarter']
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 17)
small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 14)
w = h = 400; lab = 34
sheet = Image.new('RGB', (w * len(panels), (h + lab) * 2), (24, 26, 30))
d = ImageDraw.Draw(sheet)
for row, (dirp, label) in enumerate([(a_dir, a_label), (b_dir, b_label)]):
    y = row * (h + lab)
    d.text((10, y + 8), label, fill=(240, 240, 240), font=font)
    for i, p in enumerate(panels):
        im = Image.open(os.path.join(dirp, p + '.png')).convert('RGB').resize((w, h))
        sheet.paste(im, (i * w, y + lab))
        d.rectangle([i * w, y + lab, i * w + 190, y + lab + 19], fill=(0, 0, 0))
        d.text((i * w + 5, y + lab + 2), p.replace('_', ' / ', 1), fill=(255, 255, 255), font=small)
sheet.save(out); print('SAVED', out, sheet.size)
