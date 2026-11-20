#!/usr/bin/env python3
"""The hosts either side of a cut: each host's body box and how sharp it is drawn, on the last frame
before the cut and the first after it.

  python3 lab/passes-proto/cutbox.py CLIP.mp4 --cut M [--hosts mercRight] [--label NAME] [--pair OUT.png]

M is the clip's first frame after the cut. For each host, on frames M - 1 and M: the box of the body
(the pixels brighter than BODY inside the host's square), and three measures of sharpness over that
box: the mean gradient of the luma (levels a px), the fine detail (the mean size of the luma's second
difference) and the steepest step across the crown's edge (the largest luma change between
neighbouring rows at the body's top, a mean over the middle columns; it moves with where the edge
falls between two rows, so read it with the other two). A chunk drawn at fewer px than it is shown
at reads softer. The last line gives the change across the cut and the mean change of the host's
whole square, frame against frame. With --pair, a 3x crop of both
hosts on both frames. Uses ffmpeg, numpy and PIL.
"""
import argparse
import subprocess

import numpy as np
from PIL import Image, ImageDraw

PLACES = {'mercRight': {'Merc': (1290, 840, 300), 'Tavi': (1800, 840, 300)},
          'small': {'Merc': (100, 840, 240), 'Tavi': (1820, 840, 240)}}
BODY = 70


def frames(clip, ks):
    sel = '+'.join(f'eq(n\\,{k})' for k in ks)
    raw = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', clip, '-vf', f'select={sel}',
                          '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(len(ks), 1080, 1920, 3)


def measure(rgb, x, fy, s):
    x0, x1, y0, y1 = int(x - 0.4 * s), int(x + 0.4 * s), int(fy - 0.8 * s), int(fy + 4)
    x0, x1 = max(0, x0), min(1920, x1)
    reg = rgb[y0:y1, x0:x1].astype(np.float32)
    g = 0.299 * reg[..., 0] + 0.587 * reg[..., 1] + 0.114 * reg[..., 2]
    ys, xs = np.nonzero(g > BODY)
    bx0, bx1, by0, by1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    body = g[by0:by1, bx0:bx1]
    gy, gx = np.gradient(body)
    grad = float(np.hypot(gx, gy).mean())
    cx = (bx0 + bx1) // 2
    col = g[max(0, by0 - 8):by0 + 12, cx - 6:cx + 7].mean(axis=1)
    edge = float(np.abs(np.diff(col)).max())
    # fine detail: the mean size of the luma's second difference (what a soft upscale loses first)
    lap = np.abs(4 * body[1:-1, 1:-1] - body[:-2, 1:-1] - body[2:, 1:-1] - body[1:-1, :-2] - body[1:-1, 2:])
    return (x0 + bx0, y0 + by0, x0 + bx1, y0 + by1), grad, edge, (x0, y0, x1, y1), float(lap.mean()), g


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('clip')
    ap.add_argument('--cut', type=int, required=True)
    ap.add_argument('--hosts', default='mercRight')
    ap.add_argument('--label', default='')
    ap.add_argument('--pair')
    a = ap.parse_args()
    fr = frames(a.clip, [a.cut - 1, a.cut])
    print(f'{a.label or a.clip}: frames {a.cut - 1} (before the cut) and {a.cut} (after)')
    print('| Host | Frame | Body box (x0, y0, x1, y1) | Width x height | Mean gradient | Fine detail | Crown edge step |')
    print('| ---- | ----- | ------------------------- | -------------- | ------------- | ----------- | --------------- |')
    crops, across = [], []
    for who, (x, fy, s) in PLACES[a.hosts].items():
        got = []
        for k, name in ((0, 'before'), (1, 'after')):
            box, grad, edge, reg, lap, g = measure(fr[k], x, fy, s)
            got.append((grad, lap, g))
            print(f'| {who} | {name} | {box[0]}, {box[1]}, {box[2]}, {box[3]} | {box[2] - box[0]} x {box[3] - box[1]} | {grad:.2f} | {lap:.2f} | {edge:.1f} |')
            crops.append((who, name, Image.fromarray(fr[k][reg[1]:reg[3], reg[0]:reg[2]])))
        across.append(f'{who}: mean gradient {100 * (got[1][0] / got[0][0] - 1):+.1f} %, fine detail {100 * (got[1][1] / got[0][1] - 1):+.1f} %, '
                      f'the square\'s mean change {float(np.abs(got[1][2] - got[0][2]).mean()):.2f} levels')
    print('Across the cut (after against before). ' + '; '.join(across) + '.')
    if a.pair:
        z = 3
        # the face: the middle of each host's square
        tiles = []
        for who, name, im in crops:
            w, h = im.size
            c = im.crop((int(w * 0.2), int(h * 0.25), int(w * 0.8), int(h * 0.7)))
            tiles.append((f'{who}, {name} the cut', c.resize((c.width * z, c.height * z), Image.NEAREST)))
        W = sum(t.width for _, t in tiles) + 10 * (len(tiles) + 1)
        H = max(t.height for _, t in tiles) + 40
        sheet = Image.new('RGB', (W, H), (22, 27, 34))
        d = ImageDraw.Draw(sheet)
        xx = 10
        for lab, t in tiles:
            sheet.paste(t, (xx, 30))
            d.text((xx, 8), f'{a.label}: {lab} (3x, nearest)', fill=(230, 237, 243))
            xx += t.width + 10
        sheet.save(a.pair)
        print(a.pair)


if __name__ == '__main__':
    main()
