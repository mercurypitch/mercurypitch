#!/usr/bin/env python3
"""A strip of a pass's own frames, each a real frame of the WebM (alpha kept) over the room's obsidian,
labelled with its frame and time; rows of strips for a before-and-after.

  python3 lab/passes-proto/strip.py OUT.png [--scale 1.0] [--cols 15] [--mirror] [--crop x0,y0,x1,y1]
          ROW ...
  ROW = "label|chunk.webm|first frame|last frame|step|time of the chunk's frame 0|fps shown"

Frames are counted in the chunk (0 is its first). `--crop` is in fractions of the frame (the face:
0.2,0.25,0.8,0.75). Uses ffmpeg (libvpx-vp9), numpy and PIL.
"""
import argparse
import os
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
FONT = os.path.join(ROOT, 'assets/fonts/Outfit-wght.ttf')
BG = np.array([13, 17, 23], np.float32)


def grab(webm, ks):
    w, h = (int(v) for v in subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                                            'stream=width,height', '-of', 'csv=p=0', webm],
                                           capture_output=True, text=True, check=True).stdout.strip().split(','))
    sel = '+'.join(f'eq(n\\,{k})' for k in ks)
    raw = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-c:v', 'libvpx-vp9', '-i', webm,
                          '-vf', f'select={sel}', '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
                         capture_output=True, check=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, h, w, 4).astype(np.float32)
    a = fr[..., 3:4] / 255
    return (fr[..., :3] * a + BG * (1 - a)).clip(0, 255).astype(np.uint8)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('out')
    ap.add_argument('rows', nargs='+')
    ap.add_argument('--scale', type=float, default=1.0)
    ap.add_argument('--cols', type=int, default=15)
    ap.add_argument('--mirror', action='store_true')
    ap.add_argument('--crop', default='0,0,1,1')
    ap.add_argument('--title', default='')
    a = ap.parse_args()
    cx0, cy0, cx1, cy1 = (float(v) for v in a.crop.split(','))
    f_l, f_s = ImageFont.truetype(FONT, 17), ImageFont.truetype(FONT, 12)
    blocks = []
    for row in a.rows:
        label, webm, f0, f1, step, t0, fps = row.split('|')
        ks = list(range(int(f0), int(f1) + 1, int(step)))
        fr = grab(webm if os.path.isabs(webm) else os.path.join(ROOT, webm), ks)
        tiles = []
        for k, f in zip(ks, fr):
            h, w = f.shape[:2]
            im = Image.fromarray(f[int(cy0 * h):int(cy1 * h), int(cx0 * w):int(cx1 * w)])
            if a.mirror:
                im = im.transpose(Image.FLIP_LEFT_RIGHT)
            if a.scale != 1.0:
                im = im.resize((round(im.width * a.scale), round(im.height * a.scale)), Image.LANCZOS)
            tiles.append((im, f'{k}  {float(t0) + k / float(fps):.3f}'))
        blocks.append((label, tiles))
    tw, th = blocks[0][1][0][0].size
    pad, lab = 6, 16
    H = (30 if a.title else 0)
    for label, tiles in blocks:
        H += 26 + ((len(tiles) + a.cols - 1) // a.cols) * (th + lab + pad)
    W = pad + a.cols * (tw + pad)
    sheet = Image.new('RGB', (W, H + pad), (22, 27, 34))
    d = ImageDraw.Draw(sheet)
    y = 4
    if a.title:
        d.text((pad, y), a.title, font=f_l, fill=(230, 237, 243))
        y += 30
    for label, tiles in blocks:
        d.text((pad, y + 2), label, font=f_l, fill=(230, 237, 243))
        y += 26
        for i, (im, cap) in enumerate(tiles):
            x = pad + (i % a.cols) * (tw + pad)
            yy = y + (i // a.cols) * (th + lab + pad)
            sheet.paste(im, (x, yy))
            d.text((x + 2, yy + th + 1), cap, font=f_s, fill=(139, 148, 158))
        y += ((len(tiles) + a.cols - 1) // a.cols) * (th + lab + pad)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    sheet.save(a.out)
    print(a.out, sheet.size)


if __name__ == '__main__':
    main()
