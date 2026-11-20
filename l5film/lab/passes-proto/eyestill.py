#!/usr/bin/env python3
"""Item 3: is an eye moving across the S6 to S7 cut? Each eye's dark pixels in the pass's own frames
(over the obsidian, in grey, at the chunk's 225 px): where their middle is and how many there are, frame
by frame, before (the film's chunks) and after (the final profile).

  python3 lab/passes-proto/eyestill.py
"""
import os
import subprocess

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
BG = np.array([13, 17, 23], np.float32)
P0 = 1768          # film frame of m-blue's frame 0 at 30 fps (58.933 s)
CUT = 5145         # the first film frame of S7 (171.500 s)


def grey(webm, first, frames):
    """{pass frame: grey image} for the pass frames asked, from a chunk whose frame 0 is pass frame `first`."""
    ks = [f - first for f in frames]
    sel = '+'.join(f'eq(n\\,{k})' for k in ks)
    raw = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-c:v', 'libvpx-vp9', '-i', os.path.join(ROOT, webm),
                          '-vf', f'select={sel}', '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'],
                         capture_output=True, check=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(len(ks), 225, 225, 4).astype(np.float32)
    a = fr[..., 3:4] / 255
    rgb = fr[..., :3] * a + BG * (1 - a)
    return dict(zip(frames, 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]))


def eyes(g):
    """The two eyes of a grey frame: the dark pixels (under 45) in the rows and columns that hold them,
    split at the body's middle: ((x, y, area) of the nearer eye, (x, y, area) of the farther one)."""
    out = []
    for c0, c1 in ((60, 112), (112, 175)):
        reg = g[75:140, c0:c1] < 45
        ys, xs = np.nonzero(reg)
        out.append((c0 + xs.mean(), 75 + ys.mean(), len(xs)) if len(xs) else (0.0, 0.0, 0))
    return out


def main():
    span = list(range(CUT - P0 - 9, CUT - P0 + 16))            # pass frames from 0.3 s before the cut to 0.5 s after
    cutp = CUT - P0
    before = {}
    before.update(grey('assets/merc/m-blue-s06-merc.webm', 1313, [f for f in span if f < cutp]))
    before.update(grey('assets/merc/m-blue-s07-merc.webm', 3376, [f for f in span if f >= cutp]))
    after = grey('lab/passes-proto/eye-turn/m-blue-3355-3420-merc.webm', 3355, span)
    print('Each eye\'s dark pixels at 225 px: how far their middle moves from the frame before (px) and their area (px).')
    print()
    print('| Film time | From the cut | Before: eyes move | areas | After: eyes move | areas |')
    print('| --------- | ------------ | ----------------- | ----- | ---------------- | ----- |')
    worst = {'before': 0.0, 'after': 0.0}
    for f in span[1:]:
        t = (P0 + f) / 30
        row = [f'{t:.3f}', f'{t - 171.495:+.3f} s' + (' (the first S7 frame)' if f == cutp else '')]
        for name, d in (('before', before), ('after', after)):
            e0, e1 = eyes(d[f - 1]), eyes(d[f])
            mv = max(float(np.hypot(b[0] - a[0], b[1] - a[1])) for a, b in zip(e0, e1))
            row += [f'{mv:.2f}', f'{e1[0][2]} and {e1[1][2]}']
            if abs(t - 171.495) <= 0.2 + 1e-9:
                worst[name] = max(worst[name], mv, max(abs(b[2] - a[2]) / max(1, a[2]) for a, b in zip(e0, e1)))
        print('| ' + ' | '.join(row) + ' |')
    print()
    print(f"From 0.2 s before the cut to 0.2 s after it, the eyes' largest move or change of area in a frame: "
          f"before {worst['before']:.2f}, after {worst['after']:.2f} (px, or a share of the area).")


if __name__ == '__main__':
    main()
