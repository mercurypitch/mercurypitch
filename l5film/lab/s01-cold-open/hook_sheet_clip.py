# The shipped pass into the bead (the critic's form, DECISIONS 164) from the clip itself: every frame from 38.30 to
# 38.65 (frames 1149 to 1159 at 30 fps), each tile stamped with its scene time, its time from the push, the frame's
# mean luma (0-255) and its edge detail (the mean absolute Laplacian of the frame's luma at 480 px wide), as
# hook_sheet.py stamps round 1's snapshot sheets (kept beside it). The clip is a draft encode, which drops the
# field's fine grain, so its edge floor sits under the snapshots' 0.9.
#   python3 -I hook_sheet_clip.py   (from lab/s01-cold-open)
import json, os, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
cues = json.loads(open(os.path.join(HERE, '../../assets/cues.js')).read().split('=', 1)[1].strip().rstrip(';'))['cues']
PUSH = cues['hook']['start'] + 0.41
OUT = os.path.join(HERE, 'hook-critic-clip')
os.makedirs(OUT, exist_ok=True)
N0, N1 = round(38.30 * 30), int(38.65 * 30)
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', os.path.join(HERE, 'clip.mp4'), '-vf',
                f'select=between(n\\,{N0}\\,{N1})', '-vsync', '0', '-start_number', str(N0),
                os.path.join(OUT, 'frame-%04d.png')], check=True)
font = ImageFont.truetype(os.path.join(HERE, '../../assets/fonts/JetBrainsMono-wght.ttf'), 18)
tiles, stats = [], []
for n in range(N0, N1 + 1):
    t = n / 30
    im = Image.open(os.path.join(OUT, f'frame-{n:04d}.png')).convert('RGB')
    g = np.asarray(im.convert('L').resize((480, 270), Image.BILINEAR), dtype=np.float32)
    lap = np.abs(4 * g[1:-1, 1:-1] - g[:-2, 1:-1] - g[2:, 1:-1] - g[1:-1, :-2] - g[1:-1, 2:])
    luma, edge = float(np.asarray(im.convert('L'), dtype=np.float32).mean()), float(lap.mean())
    stats.append({'frame': n, 't': round(t, 3), 'u': round(t - PUSH, 3), 'luma': round(luma, 1), 'edge': round(edge, 2)})
    tile = im.resize((480, 270), Image.LANCZOS)
    d = ImageDraw.Draw(tile)
    d.rectangle([0, 0, 480, 26], fill=(0, 0, 0))
    d.text((6, 3), f'{t:.3f} (push{t - PUSH:+.2f}) L{luma:5.1f} E{edge:4.2f}', fill=(230, 237, 243), font=font)
    tiles.append(tile)
cols = 4
sheet = Image.new('RGB', (cols * 480, ((len(tiles) + cols - 1) // cols) * 270), (0, 0, 0))
for i, tl in enumerate(tiles):
    sheet.paste(tl, ((i % cols) * 480, (i // cols) * 270))
sheet.save(os.path.join(HERE, 'hook-sheet-critic-clip.png'))
json.dump({'push': round(PUSH, 3), 'frames': stats}, open(os.path.join(HERE, 'hook-sheet-critic-clip.json'), 'w'), indent=1)
for s in stats:
    print(f"  frame {s['frame']}  {s['t']:.3f}  push{s['u']:+.3f}  luma {s['luma']:6.1f}  edge {s['edge']:5.2f}")
