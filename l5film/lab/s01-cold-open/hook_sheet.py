# LAB-CHECKS 1's dense sheets: the pass into the head bead, frame by frame (1/30 s), in both forms, each tile stamped
# with its scene time, its board-relative time, the frame's mean luma (0-255) and its edge detail (the mean absolute
# Laplacian of the frame's luma at 480 px wide: 0 for a smooth field, a few units while the bead's rim and type are
# sharp). Lesson 2's study (l4film/study/lesson-02/NOTES.md, 24.20 to 25.55) gives its numbers in words only: the
# approach 0.75 s, edge detail from 5.9 to 0.0 by 24.90, the field's mean luma 113 to 122; its frames are not kept.
#   python3 -I hook_sheet.py   (from lab/s01-cold-open)
import glob, json, os, re
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
cues = json.loads(open(os.path.join(HERE, '../../assets/cues.js')).read().split('=', 1)[1].strip().rstrip(';'))['cues']
PUSH = cues['hook']['start'] + 0.41
font = ImageFont.truetype(os.path.join(HERE, '../../assets/fonts/JetBrainsMono-wght.ttf'), 15)
rows = {}
for form in ('board', 'critic'):
    files = sorted(glob.glob(os.path.join(HERE, f'hook-{form}', 'still-*.png')), key=lambda f: float(re.search(r'still-([\d.]+)\.png', f).group(1)))
    tiles, stats = [], []
    for f in files:
        t = float(re.search(r'still-([\d.]+)\.png', f).group(1))
        im = Image.open(f).convert('RGB')
        g = np.asarray(im.convert('L').resize((480, 270), Image.BILINEAR), dtype=np.float32)
        lap = np.abs(4 * g[1:-1, 1:-1] - g[:-2, 1:-1] - g[2:, 1:-1] - g[1:-1, :-2] - g[1:-1, 2:])
        luma, edge = float(np.asarray(im.convert('L'), dtype=np.float32).mean()), float(lap.mean())
        stats.append({'t': t, 'u': round(t - PUSH, 3), 'luma': round(luma, 1), 'edge': round(edge, 2)})
        tile = im.resize((384, 216), Image.LANCZOS)
        d = ImageDraw.Draw(tile)
        d.rectangle([0, 0, 384, 20], fill=(0, 0, 0))
        d.text((4, 2), f'{t:.3f} (push+{t - PUSH:+.2f}) L{luma:5.1f} E{edge:4.2f}', fill=(230, 237, 243), font=font)
        tiles.append(tile)
    cols = 6
    sheet = Image.new('RGB', (cols * 384, ((len(tiles) + cols - 1) // cols) * 216), (0, 0, 0))
    for i, tl in enumerate(tiles): sheet.paste(tl, ((i % cols) * 384, (i // cols) * 216))
    sheet.save(os.path.join(HERE, f'hook-sheet-{form}.png'))
    rows[form] = stats
json.dump(rows, open(os.path.join(HERE, 'hook-sheets.json'), 'w'), indent=1)
for form, st in rows.items():
    print(form)
    for s in st: print(f"  {s['t']:.3f}  push{s['u']:+.3f}  luma {s['luma']:6.1f}  edge {s['edge']:5.2f}")
