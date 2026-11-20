#!/usr/bin/env python3
"""A pass's own motion as measure.py would count it, without a scene: the chunk's frames over the
room's obsidian at the size a scene shows them, the frame as measure.py reduces it (1920 to 320 px
wide: a sixth), in grey, and the largest change of any pixel between frames 0.1 s apart.

  python3 lab/passes-proto/passmotion.py CHUNK.webm [--shown 240] [--from F --to F] [--label NAME]
          [--first-film-time T --scene-start T]

Prints one row a 0.1 s sample: the frames, the largest change (16 or more is what measure.py's hold
test needs from some pixel of the whole frame) and the mean change over the host's square. An
estimate for comparing two passes: the scene's clip, measured by measure.py, is the proof.
Reads the WebM with ffmpeg (libvpx-vp9, alpha kept) and numpy.
"""
import argparse
import json
import subprocess

import numpy as np

BG = np.array([13, 17, 23], np.float32)


def frames(webm):
    info = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                                      'stream=width,height,r_frame_rate', '-of', 'json', webm],
                                     capture_output=True, text=True, check=True).stdout)['streams'][0]
    w, h = int(info['width']), int(info['height'])
    num, den = info['r_frame_rate'].split('/')
    raw = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-c:v', 'libvpx-vp9', '-i', webm,
                          '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 4), float(num) / float(den)


def seen(fr, shown):
    """The frames as measure.py sees the host: over the obsidian, at `shown` px, a sixth of that, grey."""
    a = fr[..., 3:4].astype(np.float32) / 255
    rgb = fr[..., :3].astype(np.float32) * a + BG * (1 - a)
    g = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    n, h, w = g.shape
    side = max(6, round(shown / 6) * 6)           # the shown square, to a whole number of sixths
    # area resample h x w -> side/6 x side/6 by way of an integer grid
    k = side // 6
    ys = (np.arange(h * k) // h).reshape(k, h) if False else None
    out = np.zeros((n, k, k), np.float32)
    # each output pixel averages the block of source pixels it covers (fractional edges ignored: h / k = 5.6)
    edges_y = np.linspace(0, h, k + 1)
    edges_x = np.linspace(0, w, k + 1)
    for i in range(k):
        y0, y1 = int(round(edges_y[i])), max(int(round(edges_y[i + 1])), int(round(edges_y[i])) + 1)
        for j in range(k):
            x0, x1 = int(round(edges_x[j])), max(int(round(edges_x[j + 1])), int(round(edges_x[j])) + 1)
            out[:, i, j] = g[:, y0:y1, x0:x1].mean(axis=(1, 2))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('webm')
    ap.add_argument('--shown', type=int, default=240)
    ap.add_argument('--from', dest='f0', type=int, default=0)
    ap.add_argument('--to', dest='f1', type=int, default=10 ** 9)
    ap.add_argument('--label', default='')
    ap.add_argument('--t0', type=float, default=0.0, help='the time to print for the chunk\'s first frame')
    ap.add_argument('--quiet', action='store_true')
    a = ap.parse_args()
    fr, fps = frames(a.webm)
    g = seen(fr, a.shown)
    step = max(1, round(0.1 * fps))
    rows = []
    for i in range(max(step, a.f0 + step), min(len(g), a.f1 + 1), step):
        d = np.abs(g[i] - g[i - step])
        rows.append((i - step, i, float(d.max()), float(d.mean())))
    low = [r for r in rows if r[2] < 16]
    print(f'{a.label or a.webm}: {len(rows)} samples of {step} frames at {fps:g} fps, shown at {a.shown} px; '
          f'{len(low)} under 16 ({len(low) * step / fps:.1f} s); median largest change {np.median([r[2] for r in rows]):.0f}')
    if not a.quiet:
        for f0, f1, mx, mean in rows:
            print(f'  {a.t0 + f0 / fps:7.2f}  frames {f0:4d}-{f1:4d}  largest {mx:6.1f}  mean {mean:5.2f}  {"under 16" if mx < 16 else ""}')


if __name__ == '__main__':
    main()
