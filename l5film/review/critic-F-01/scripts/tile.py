import sys, os, glob
from PIL import Image, ImageDraw, ImageFont
src, out, step = sys.argv[1], sys.argv[2], float(sys.argv[3])
cols, rows = int(sys.argv[4]), int(sys.argv[5])
files = sorted(glob.glob(os.path.join(src, '*.png')))
os.makedirs(out, exist_ok=True)
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 18)
except Exception:
    font = ImageFont.load_default()
n = cols*rows
for s in range(0, len(files), n):
    chunk = files[s:s+n]
    w, h = Image.open(chunk[0]).size
    sheet = Image.new('RGB', (cols*w, rows*h), (0,0,0))
    d = ImageDraw.Draw(sheet)
    for i, f in enumerate(chunk):
        idx = int(os.path.basename(f).split('.')[0]) - 1
        t = idx*step
        im = Image.open(f).convert('RGB')
        x, y = (i % cols)*w, (i//cols)*h
        sheet.paste(im, (x, y))
        d.rectangle([x, y+h-22, x+70, y+h], fill=(0,0,0))
        d.text((x+3, y+h-21), f"{t:.1f}", fill=(255,255,0), font=font)
    t0 = (int(os.path.basename(chunk[0]).split('.')[0])-1)*step
    sheet.save(os.path.join(out, f"ov-{t0:06.1f}.jpg"), quality=85)
