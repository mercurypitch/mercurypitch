"""Colour of one region of an image, as numbers: compare a runtime shot with the concept.

    python3 -I colour_stats.py IMAGE x0,y0,x1,y1 [--width W]

--width resizes the image to W pixels wide first (Lanczos), so the concept can be
measured at the size the game draws the asset: a painted concept at 1254 px holds
detail the game's 70 px never shows, and its colour spread falls as it shrinks.
Pick the same part of the asset in both images, between landmarks (a gold band, a
rim), not a fixed box: a box that caught a gold collar read b* five units yellow.

Prints luminance percentiles (sRGB weights, 0-255), the median sRGB with its HSV
hue, saturation and value, Lab means, the Lab chroma spread (sqrt of var a* plus
var b*: how far the colour wanders, the opal's play of colour), a*/b* tails, and
hue shares of the chromatic pixels (saturation 0.08 or more) in the bins the eye
uses (`lessons.md`: coarse bins once called yellow-green mint).
"""

import argparse
import colorsys

import numpy as np
from PIL import Image

BINS = (('warm', 0, 60), ('yellow-green', 60, 130), ('mint', 130, 180), ('cyan-blue', 180, 250),
        ('lavender', 250, 330), ('warm', 330, 361))


def lab(rgb):
    c = rgb / 255.0
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = lin @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def stats(img, box):
    px = np.asarray(img.crop(box)).astype(float).reshape(-1, 3)
    lum = px @ np.array([0.2126, 0.7152, 0.0722])
    med = np.median(px, 0)
    h, s, v = colorsys.rgb_to_hsv(*(med / 255))
    L = lab(px)
    hsv = np.array([colorsys.rgb_to_hsv(*p) for p in px / 255])
    chroma = hsv[:, 1] >= 0.08
    shares = {}
    for name, lo, hi in BINS:
        k = chroma & (hsv[:, 0] * 360 >= lo) & (hsv[:, 0] * 360 < hi)
        shares[name] = shares.get(name, 0.0) + k.sum() / max(1, chroma.sum())
    return {
        'luminance p5/p50/p95': [round(float(np.percentile(lum, q))) for q in (5, 50, 95)],
        'median rgb': [int(c) for c in med],
        'median hue/sat/val': [round(h * 360), round(float(s), 2), round(float(v), 2)],
        'Lab mean': [round(float(L[:, i].mean()), 1) for i in range(3)],
        'chroma spread': round(float(np.sqrt(L[:, 1].var() + L[:, 2].var())), 1),
        'a*5 / b*5 / b*95': [round(float(np.percentile(L[:, 1], 5)), 1), round(float(np.percentile(L[:, 2], 5)), 1),
                             round(float(np.percentile(L[:, 2], 95)), 1)],
        'neutral share': round(float(1 - chroma.mean()), 2),
        'hue shares': {k: round(float(v), 2) for k, v in shares.items()},
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('image')
    ap.add_argument('box', help='x0,y0,x1,y1 in the (resized) image')
    ap.add_argument('--width', type=int, help='resize to this width first')
    args = ap.parse_args()
    img = Image.open(args.image).convert('RGB')
    if args.width:
        img = img.resize((args.width, round(img.height * args.width / img.width)), Image.LANCZOS)
    box = tuple(int(v) for v in args.box.split(','))
    for key, value in stats(img, box).items():
        print(f'{key:22s} {value}')


if __name__ == '__main__':
    main()
