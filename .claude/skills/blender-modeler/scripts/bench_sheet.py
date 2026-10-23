"""Contact sheet and numbers for a glass bench capture (bench_capture.mjs).

    python3 -I bench_sheet.py CAPTURE_DIR [--out sheet.png] [--cell 300]

Rows are hero, look and tone mapping; columns are the bench environments. Each
cell is measured inside its mask (the hero alone, white on black): mean CIELAB,
chroma and the 95th-percentile luminance. Each row then reports CIEDE2000 from
every cell to the row's median colour. A look that reads the same under every
light keeps that number small; a look tuned to one room does not (glass look
plan, section 7.1). Writes metrics.json beside the sheet.
"""

import argparse
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from colour_stats import lab  # noqa: E402

ENVIRONMENTS = ['room', 'grey', 'hdr', 'gallery', 'kit']
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'


def ciede2000(lab1, lab2):
    """CIEDE2000 (Sharma, Wu and Dalal 2005) between two L*a*b* triples."""
    l1, a1, b1 = lab1
    l2, a2, b2 = lab2
    c1, c2 = np.hypot(a1, b1), np.hypot(a2, b2)
    cbar = (c1 + c2) / 2
    g = 0.5 * (1 - np.sqrt(cbar ** 7 / (cbar ** 7 + 25 ** 7)))
    a1p, a2p = (1 + g) * a1, (1 + g) * a2
    c1p, c2p = np.hypot(a1p, b1), np.hypot(a2p, b2)
    h1p = np.degrees(np.arctan2(b1, a1p)) % 360
    h2p = np.degrees(np.arctan2(b2, a2p)) % 360
    dlp, dcp = l2 - l1, c2p - c1p
    dh = h2p - h1p
    if c1p * c2p == 0:
        dh = 0
    elif dh > 180:
        dh -= 360
    elif dh < -180:
        dh += 360
    dhp = 2 * np.sqrt(c1p * c2p) * np.sin(np.radians(dh) / 2)
    lbp, cbp = (l1 + l2) / 2, (c1p + c2p) / 2
    if c1p * c2p == 0:
        hbp = h1p + h2p
    elif abs(h1p - h2p) <= 180:
        hbp = (h1p + h2p) / 2
    else:
        hbp = (h1p + h2p + 360) / 2 if h1p + h2p < 360 else (h1p + h2p - 360) / 2
    t = (1 - 0.17 * np.cos(np.radians(hbp - 30)) + 0.24 * np.cos(np.radians(2 * hbp))
         + 0.32 * np.cos(np.radians(3 * hbp + 6)) - 0.20 * np.cos(np.radians(4 * hbp - 63)))
    sl = 1 + 0.015 * (lbp - 50) ** 2 / np.sqrt(20 + (lbp - 50) ** 2)
    sc = 1 + 0.045 * cbp
    sh = 1 + 0.015 * cbp * t
    rt = (-2 * np.sqrt(cbp ** 7 / (cbp ** 7 + 25 ** 7))
          * np.sin(np.radians(60 * np.exp(-(((hbp - 275) / 25) ** 2)))))
    return float(np.sqrt((dlp / sl) ** 2 + (dcp / sc) ** 2 + (dhp / sh) ** 2
                         + rt * (dcp / sc) * (dhp / sh)))


def measure(shot_file, mask_file):
    image = np.asarray(Image.open(shot_file).convert('RGB'), dtype=float)
    mask = np.asarray(Image.open(mask_file).convert('L'), dtype=float) > 128
    if mask.sum() < 50:
        return None
    pixels = image[mask]
    values = lab(pixels)
    luminance = pixels @ np.array([0.2126, 0.7152, 0.0722])
    mean = values.mean(axis=0)
    return {
        'lab': [round(float(v), 2) for v in mean],
        'chroma': round(float(np.hypot(mean[1], mean[2])), 2),
        'p95_luminance': round(float(np.percentile(luminance, 95)), 1),
        'pixels': int(mask.sum()),
    }


def row_key(entry):
    shot = entry['shot']
    return f"{entry.get('hero') or shot['hero']} · {shot['look']} · {shot['toneMapping']} · {shot['subject']} · {shot['camera']}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('capture')
    parser.add_argument('--out')
    parser.add_argument('--cell', type=int, default=300)
    options = parser.parse_args()
    data = json.load(open(os.path.join(options.capture, 'shots.json')))
    rows = {}
    for entry in data['shots']:
        rows.setdefault(row_key(entry), {})[entry['shot']['environment']] = entry
    metrics = {}
    for key, cells in rows.items():
        measured = {env: measure(e['file'], e['mask']) for env, e in cells.items() if e.get('mask')}
        labs = [m['lab'] for m in measured.values() if m]
        median = np.median(np.array(labs), axis=0).tolist() if labs else None
        for env, m in measured.items():
            if m and median:
                m['de2000_to_row_median'] = round(ciede2000(m['lab'], median), 2)
        spread = [m['de2000_to_row_median'] for m in measured.values() if m and 'de2000_to_row_median' in m]
        metrics[key] = {'cells': measured, 'max_de2000_across_environments': max(spread) if spread else None}

    cell = options.cell
    label_w, head_h, foot_h = 330, 34, 46
    columns = [env for env in ENVIRONMENTS if any(env in c for c in rows.values())]
    sheet = Image.new('RGB', (label_w + cell * len(columns), head_h + (cell + foot_h) * len(rows)), (16, 18, 20))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype(FONT, 15)
    small = ImageFont.truetype(FONT, 12)
    for j, env in enumerate(columns):
        draw.text((label_w + j * cell + 8, 8), env, fill=(220, 226, 230), font=font)
    for i, (key, cells) in enumerate(rows.items()):
        y = head_h + i * (cell + foot_h)
        for line, text in enumerate(key.split(' · ')):
            draw.text((10, y + 8 + line * 20), text, fill=(220, 226, 230) if line == 0 else (160, 170, 176), font=font)
        spread = metrics[key]['max_de2000_across_environments']
        if spread is not None:
            draw.text((10, y + 120), f'max ΔE2000 across lights {spread}', fill=(240, 200, 120), font=small)
        for j, env in enumerate(columns):
            entry = cells.get(env)
            if not entry:
                continue
            tile = Image.open(entry['file']).convert('RGB').resize((cell, cell), Image.LANCZOS)
            sheet.paste(tile, (label_w + j * cell, y))
            m = metrics[key]['cells'].get(env)
            if m:
                text = f"L*a*b* {m['lab'][0]:.0f}/{m['lab'][1]:.0f}/{m['lab'][2]:.0f}  C {m['chroma']:.0f}  p95 {m['p95_luminance']:.0f}"
                draw.text((label_w + j * cell + 6, y + cell + 4), text, fill=(200, 208, 212), font=small)
                if 'de2000_to_row_median' in m:
                    draw.text((label_w + j * cell + 6, y + cell + 22), f"ΔE to row {m['de2000_to_row_median']}", fill=(150, 160, 166), font=small)
    out = options.out or os.path.join(options.capture, 'sheet.png')
    sheet.save(out)
    json.dump(metrics, open(os.path.join(os.path.dirname(out) or '.', 'metrics.json'), 'w'), indent=2)
    print(out)
    for key, value in metrics.items():
        print(f"{key}: max ΔE2000 across lights {value['max_de2000_across_environments']}")


if __name__ == '__main__':
    main()
