"""contrast-sweep.mjs's shots measured (group A's labs): each label's contrast over what passes under it, frame by
frame, as lab/s04-recall/contrast_pass.py measures S4's passes (DECISIONS 168): the label's paint at its drawn
opacity against the median of the pixels behind its glyphs, and against the brightest 5 % of them; the worst
frame is the lowest median ratio with the label at rest (frames still fading in or out left out and counted).

    python3 lab/s01-cold-open/contrast_sweep.py lab/<sid>/contrast-<name>

Writes <folder>.json and <folder>-worst.png beside the folder.
"""
import json
import os
import re

import numpy as np
from PIL import Image, ImageDraw, ImageFont

import sys
D = os.path.abspath(sys.argv[1].rstrip('/'))
HERE = os.path.dirname(D)
meta = json.load(open(os.path.join(D, 'meta.json')))


def lin(c):
    c = np.asarray(c, dtype=float) / 255.0
    return np.where(c <= 0.03928, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lum(rgb):
    l = lin(rgb)
    return 0.2126 * l[..., 0] + 0.7152 * l[..., 1] + 0.0722 * l[..., 2]


def ratio(l1, l2):
    hi, lo = np.maximum(l1, l2), np.minimum(l1, l2)
    return (hi + 0.05) / (lo + 0.05)


def parse(c):
    return [float(v) for v in re.findall(r'[\d.]+', c)[:3]]


rows = []
for fr in meta['frames']:
    a = np.asarray(Image.open(os.path.join(D, fr['name'] + '-a.png')).convert('RGB')).astype(int)
    b = np.asarray(Image.open(os.path.join(D, fr['name'] + '-b.png')).convert('RGB')).astype(int)
    cx, cy = fr['clip']['x'], fr['clip']['y']
    for lab in fr['labels']:
        l, t, r, btm = lab['box']
        x0, x1 = max(0, int(np.floor(l - cx))), min(a.shape[1], int(np.ceil(r - cx)))
        y0, y1 = max(0, int(np.floor(t - cy))), min(a.shape[0], int(np.ceil(btm - cy)))
        da, db = a[y0:y1, x0:x1], b[y0:y1, x0:x1]
        mask = np.abs(da - db).max(axis=2) >= 6
        if mask.sum() < 20:
            continue
        bg = db[mask]
        fill = np.array(parse(lab['fill']))
        al = lab['alpha']
        bl = lum(bg)
        med = np.median(bg, axis=0)
        fg_med = fill * al + med * (1 - al)
        r_med = float(ratio(lum(fg_med), lum(med)))
        # the brightest 5 % of the background behind the glyphs, the paint composited over each
        hi = bg[bl >= np.percentile(bl, 95)]
        r_hi = float(np.min(ratio(lum(fill * al + hi * (1 - al)), lum(hi))))
        rows.append({'pass': fr['pass'], 'k': fr['k'], 't': round(fr['t'], 4), 'label': lab['text'], 'fill': lab['fill'],
                     'alpha': round(al, 3), 'glyph_px': int(mask.sum()), 'bg_median': [int(v) for v in med],
                     'bg_max_luma': float(bl.max()), 'ratio_median': round(r_med, 2), 'ratio_p95': round(r_hi, 2),
                     'name': fr['name'], 'box': [x0, y0, x1, y1]})

out = {'plan': meta['plan'], 'worst': {}, 'baseline': {}, 'frames': rows}
for p in sorted({r['pass'] for r in rows}):
    for name in sorted({r['label'] for r in rows if r['pass'] == p}):
        every = [r for r in rows if r['pass'] == p and r['label'] == name]
        # the pass is measured with the label at rest: frames where it is still fading in or out (its opacity under
        # 98 % of its full) are left out, and counted
        full = max(r['alpha'] for r in every)
        rs = [r for r in every if r['alpha'] >= 0.98 * full]
        w = min(rs, key=lambda r: r['ratio_median'])
        best = max(rs, key=lambda r: r['ratio_median'])
        out['worst'][f'{p}: {name}'] = {k: w[k] for k in ('t', 'k', 'ratio_median', 'ratio_p95', 'bg_median', 'alpha', 'fill', 'name')}
        out['worst'][f'{p}: {name}']['lowest_p95_over_pass'] = min(r['ratio_p95'] for r in rs)
        out['worst'][f'{p}: {name}']['frames'] = len(rs)
        out['worst'][f'{p}: {name}']['fading_frames_left_out'] = len(every) - len(rs)
        out['worst'][f'{p}: {name}']['span'] = [min(r['t'] for r in rs), max(r['t'] for r in rs)]
        out['baseline'][f'{p}: {name}'] = {'t': best['t'], 'ratio_median': best['ratio_median']}
json.dump(out, open(D + '.json', 'w'), indent=1)

# the worst frames, drawn and with the glyphs hidden, at 3x
tiles = []
for key, w in out['worst'].items():
    r = next(x for x in rows if x['name'] == w['name'] and f"{x['pass']}: {x['label']}" == key)
    x0, y0, x1, y1 = r['box']
    pad = 10
    ims = []
    for s in ('a', 'b'):
        im = Image.open(os.path.join(D, r['name'] + f'-{s}.png')).convert('RGB')
        im = im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))
        ims.append(im.resize((im.width * 3, im.height * 3), Image.NEAREST))
    tiles.append((f"{key}  t {w['t']:.3f}  {w['ratio_median']}:1 (median bg), brightest 5 % {w['ratio_p95']}:1", ims))
W = max(max(i.width for i in ims) for _, ims in tiles) + 40
H = sum(ims[0].height + ims[1].height + 70 for _, ims in tiles) + 20
sheet = Image.new('RGB', (W, H), (16, 18, 24))
dr = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 20)
except OSError:
    font = ImageFont.load_default()
y = 10
for cap, ims in tiles:
    dr.text((20, y), cap, fill=(230, 237, 243), font=font)
    y += 30
    for im in ims:
        sheet.paste(im, (20, y))
        y += im.height + 4
    y += 32
sheet.save(D + '-worst.png')

for k, w in out['worst'].items():
    print(f"{k:42s} worst t {w['t']:.3f} (frame {w['k']}): {w['ratio_median']}:1 over the median bg {w['bg_median']}, "
          f"brightest 5 % {w['ratio_p95']}:1; lowest p95 over the pass {w['lowest_p95_over_pass']}; "
          f"best {out['baseline'][k]['ratio_median']}:1; {w['frames']} frames at rest ({w['span'][0]:.3f} to {w['span'][1]:.3f}), "
          f"{w['fading_frames_left_out']} fading left out; alpha {w['alpha']}")
