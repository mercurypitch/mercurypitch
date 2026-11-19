#!/usr/bin/env python3
"""Every frame (1/30 s) of a window of a clip, cropped and laid out on one labelled sheet: the proof that a card's edge
never sweeps through a line as it lands.
  python3 lab/s13-recap/tools/stepframes.py <clip.mp4> <out.png> <t0> <t1> x0,y0,x1,y1 <title> [scale] [cols]
Frames are picked by number (round(t * 30)), so each label is the frame's own scene time."""
import os, subprocess, sys, tempfile, glob
from PIL import Image, ImageDraw
clip, out, t0, t1, box, title = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4]), [int(v) for v in sys.argv[5].split(',')], sys.argv[6]
sc = float(sys.argv[7]) if len(sys.argv) > 7 else 0.5
cols = int(sys.argv[8]) if len(sys.argv) > 8 else 6
n0, n1 = round(t0 * 30), round(t1 * 30)
x0, y0, x1, y1 = box
with tempfile.TemporaryDirectory() as d:
    subprocess.run(['ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-i', clip, '-vf',
                    f"select='between(n\\,{n0}\\,{n1})',crop={x1 - x0}:{y1 - y0}:{x0}:{y0}", '-fps_mode', 'passthrough', f'{d}/f-%04d.png'], check=True)
    fs = sorted(glob.glob(f'{d}/f-*.png'))
    w, h = int((x1 - x0) * sc), int((y1 - y0) * sc)
    rows = (len(fs) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * (w + 6) + 6, rows * (h + 20) + 30), (8, 10, 14))
    dr = ImageDraw.Draw(sheet)
    dr.text((6, 8), title, fill=(230, 237, 243))
    for k, f in enumerate(fs):
        x, y = 6 + (k % cols) * (w + 6), 30 + (k // cols) * (h + 20)
        sheet.paste(Image.open(f).convert('RGB').resize((w, h), Image.LANCZOS), (x, y + 16))
        dr.text((x, y + 2), f'{(n0 + k) / 30:.3f}', fill=(168, 179, 191))
    sheet.save(out)
    print(out, len(fs), sheet.size)
