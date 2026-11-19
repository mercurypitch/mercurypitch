# A frame sheet from a lab clip (group A's labs): every n-th frame from t0 to t1 (scene time, the clip's own 30 fps
# frames), each tile stamped with its time, its time from an anchor (if given), the frame's mean luma (0-255) and
# its edge detail (the mean absolute Laplacian of the luma at 480 px wide), as hook_sheet.py stamps its tiles.
#   python3 -I frame_sheet.py <clip> <t0> <t1> <out.png> [--every n] [--anchor name=seconds] [--cols c]
# Writes <out.png> and <out>.json (the numbers), and keeps the frames in <out>-frames/.
import argparse, json, os, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument('clip'); ap.add_argument('t0', type=float); ap.add_argument('t1', type=float); ap.add_argument('out')
ap.add_argument('--every', type=int, default=1); ap.add_argument('--anchor', default=None); ap.add_argument('--cols', type=int, default=4)
a = ap.parse_args()
base = os.path.splitext(a.out)[0]
FR = base + '-frames'
os.makedirs(FR, exist_ok=True)
N0, N1 = round(a.t0 * 30), round(a.t1 * 30)
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', a.clip, '-vf', f'select=between(n\\,{N0}\\,{N1})', '-vsync', '0',
                '-start_number', str(N0), os.path.join(FR, 'frame-%04d.png')], check=True)
an_name, an_t = (a.anchor.split('=')[0], float(a.anchor.split('=')[1])) if a.anchor else (None, None)
font = ImageFont.truetype(os.path.join(HERE, '../../assets/fonts/JetBrainsMono-wght.ttf'), 18)
tiles, stats = [], []
for n in range(N0, N1 + 1, a.every):
    t = n / 30
    im = Image.open(os.path.join(FR, f'frame-{n:04d}.png')).convert('RGB')
    g = np.asarray(im.convert('L').resize((480, 270), Image.BILINEAR), dtype=np.float32)
    lap = np.abs(4 * g[1:-1, 1:-1] - g[:-2, 1:-1] - g[2:, 1:-1] - g[1:-1, :-2] - g[1:-1, 2:])
    luma, edge = float(np.asarray(im.convert('L'), dtype=np.float32).mean()), float(lap.mean())
    stats.append({'frame': n, 't': round(t, 3), 'luma': round(luma, 1), 'edge': round(edge, 2), **({an_name: round(t - an_t, 3)} if an_name else {})})
    tile = im.resize((480, 270), Image.LANCZOS)
    d = ImageDraw.Draw(tile)
    d.rectangle([0, 0, 480, 26], fill=(0, 0, 0))
    rel = f' ({an_name}{t - an_t:+.2f})' if an_name else ''
    d.text((6, 3), f'{t:.3f}{rel} L{luma:5.1f} E{edge:4.2f}', fill=(230, 237, 243), font=font)
    tiles.append(tile)
cols = a.cols
sheet = Image.new('RGB', (cols * 480, ((len(tiles) + cols - 1) // cols) * 270), (0, 0, 0))
for i, tl in enumerate(tiles):
    sheet.paste(tl, ((i % cols) * 480, (i // cols) * 270))
sheet.save(a.out)
json.dump({'clip': a.clip, 'anchor': a.anchor, 'frames': stats}, open(base + '.json', 'w'), indent=1)
print(f'{len(tiles)} tiles -> {a.out}')
