"""A strip of a rendered pass's own frames, decoded from its WebM with the alpha kept and set over the
room's obsidian (Tavi mirrored, as the scenes show her), each tile with its film time.

  python3 lab/final-run/passstrip.py <out.png> <chunk id>:<t0>:<t1>:<step in frames>[:<per row>] [...]

t0 and t1 are film times; one block of rows per argument. Reads merc/shots/ and assets/merc/.
"""
import glob, json, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BG = np.array([13, 17, 23], np.float32)
font = ImageFont.truetype(os.path.join(ROOT, 'assets/fonts/Outfit-wght.ttf'), 15)
shots = {}
for p in glob.glob(os.path.join(ROOT, 'merc/shots/*.json')):
    s = json.load(open(p))
    for c in s.get('chunks') or [{'id': s['id'], 'from': 0}]:
        shots[c['id']] = (s, c['from'])


def frames(cid, idx):
    side = json.load(open(os.path.join(ROOT, 'assets/merc', cid + '-merc.json')))
    w, h = side['drawn']
    sel = '+'.join(f'eq(n\\,{k})' for k in idx)
    raw = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-c:v', 'libvpx-vp9', '-i',
                          os.path.join(ROOT, 'assets/merc', cid + '-merc.webm'), '-vf', f'select={sel}',
                          '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
                         capture_output=True, check=True).stdout
    n = w * h * 4
    return [np.frombuffer(raw[i * n:(i + 1) * n], np.uint8).reshape(h, w, 4).astype(np.float32) for i in range(len(idx))], side


rows = []
for arg in sys.argv[2:]:
    parts = arg.split(':')
    cid, t0, t1, step = parts[0], float(parts[1]), float(parts[2]), int(parts[3])
    per = int(parts[4]) if len(parts) > 4 else 12
    s, first = shots[cid]
    fps, P = s['fps'], round(s['filmStart'] * s['fps'])
    side0 = json.load(open(os.path.join(ROOT, 'assets/merc', cid + '-merc.json')))
    a = max(0, round(t0 * fps) - P - first)
    b = min(side0['frames'] - 1, round(t1 * fps) - P - first)
    idx = list(range(a, b + 1, step))
    ims, side = frames(cid, idx)
    tiles = []
    for k, im in zip(idx, ims):
        if s.get('mirror'):
            im = im[:, ::-1]
        al = im[:, :, 3:4] / 255
        rgb = np.rint(im[:, :, :3] * al + BG * (1 - al)).astype(np.uint8)
        t = Image.fromarray(rgb)
        ImageDraw.Draw(t).text((5, 3), f'{(P + first + k) / fps:.3f}', fill=(230, 237, 243), font=font)
        tiles.append(t)
    for i in range(0, len(tiles), per):
        rows.append((f'{cid}', tiles[i:i + per]))
W = max(sum(t.width for t in r) for _, r in rows)
H = sum(r[0].height for _, r in rows)
sheet = Image.new('RGB', (W, H), (13, 17, 23))
y = 0
for name, r in rows:
    x = 0
    for t in r:
        sheet.paste(t, (x, y))
        x += t.width
    ImageDraw.Draw(sheet).text((5, y + r[0].height - 20), name, fill=(139, 148, 158), font=font)
    y += r[0].height
sheet.save(sys.argv[1])
print(sys.argv[1], sheet.size)
