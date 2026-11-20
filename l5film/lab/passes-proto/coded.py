#!/usr/bin/env python3
"""The 60 fps proof: does every film frame show its own pass frame? A copy of a chunk whose every
frame carries its own number, rendered in a scene, and the numbers read back from the film's frames.

  python3 lab/passes-proto/coded.py make IN.webm OUT.webm
        OUT is IN with frame i's number written into it: a row of BLOCKS squares at the top (a white
        one, a dark one, then i in binary, the high bit first), opaque. Same size, fps and encode as
        tools/merc-pass.mjs; the two files' frame times are compared and must be the same.
  python3 lab/passes-proto/coded.py read CLIP.mp4 --left X --top Y --shown S --drawn D
        --film-frame N0 --pass-first P [--from M --to M]
        reads the number from every frame of the clip: the chunk is shown in a box whose top left is
        (X, Y) on screen, S px wide, from a D px chunk; clip frame m is film frame N0 + m; pass frame 0
        is film frame P. Prints each frame that does not show pass frame N0 + m - P, and the count.

Uses ffmpeg, ffprobe and numpy.
"""
import argparse
import json
import subprocess

import numpy as np

BITS = 12
X0, Y0, B = 44, 6, 10          # the row's left, top and a square's side, in the chunk's px
HI, LO = 255, 40


def probe(path):
    s = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                                   'stream=width,height,r_frame_rate', '-of', 'json', path],
                                  capture_output=True, text=True, check=True).stdout)['streams'][0]
    num, den = s['r_frame_rate'].split('/')
    return int(s['width']), int(s['height']), float(num) / float(den)


def times(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=pts_time',
                          '-of', 'csv=p=0', path], capture_output=True, text=True, check=True).stdout.split()
    return sorted(float(x.strip(',')) for x in out)


def make(src, dst):
    w, h, fps = probe(src)
    raw = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-c:v', 'libvpx-vp9', '-i', src,
                          '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], capture_output=True, check=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, h, w, 4).copy()
    for i, f in enumerate(fr):
        vals = [HI, LO] + [HI if (i >> (BITS - 1 - k)) & 1 else LO for k in range(BITS)]
        for k, v in enumerate(vals):
            f[Y0:Y0 + B, X0 + k * B:X0 + (k + 1) * B] = (v, v, v, 255)
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba',
                    '-s', f'{w}x{h}', '-r', f'{fps:g}', '-i', '-', '-vf', 'format=rgba,format=yuva420p',
                    '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '14', '-auto-alt-ref', '0',
                    '-row-mt', '1', dst], input=fr.tobytes(), check=True)
    a, b = times(src), times(dst)
    same = len(a) == len(b) and all(abs(x - y) < 1e-9 for x, y in zip(a, b))
    whole = all(abs(t * 1000 - round(i * 1000 / fps)) < 1e-6 for i, t in enumerate(a))
    print(f'{dst}: {len(fr)} frames at {fps:g} fps, {w}x{h}; frame times the same as {src}: {same}; '
          f'every frame time is round(1000 i / {fps:g}) ms: {whole}')
    if not same:
        raise SystemExit(1)


def read(a):
    w, h, fps = probe(a.clip)
    k = a.shown / a.drawn
    y = a.top + (Y0 + B / 2) * k
    y0 = int(y) - 2
    raw = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', a.clip, '-vf', f'crop={w}:4:0:{y0},format=gray',
                          '-f', 'rawvideo', '-'], capture_output=True, check=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, 4, w)
    xs = [a.left + (X0 + (j + 0.5) * B) * k for j in range(BITS + 2)]
    bad, unread, ok, first, last = [], 0, 0, None, None
    lo_m, hi_m = (a.m0 or 0), (a.m1 if a.m1 is not None else len(fr) - 1)
    for m in range(lo_m, min(hi_m, len(fr) - 1) + 1):
        v = [float(fr[m][:, int(x) - 2:int(x) + 3].mean()) for x in xs]
        if not (v[0] > 150 and v[1] < 110):
            unread += 1
            continue
        thr = (v[0] + v[1]) / 2
        i = 0
        for b in v[2:]:
            i = (i << 1) | (1 if b > thr else 0)
        want = a.film_frame + m - a.pass_first
        first = m if first is None else first
        last = m
        if i == want:
            ok += 1
        else:
            bad.append((m, a.film_frame + m, i, want))
    for m, n, i, want in bad[:40]:
        print(f'  clip frame {m} (film frame {n}): shows pass frame {i}, its own is {want}')
    print(f'{a.clip}: {fps:g} fps; clip frames {lo_m} to {min(hi_m, len(fr) - 1)}: {ok} show their own pass frame, '
          f'{len(bad)} show another, {unread} not read (the row not on screen); read from clip frame {first} to {last}')


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    mk = sub.add_parser('make')
    mk.add_argument('src')
    mk.add_argument('dst')
    rd = sub.add_parser('read')
    rd.add_argument('clip')
    rd.add_argument('--left', type=float, required=True)
    rd.add_argument('--top', type=float, required=True)
    rd.add_argument('--shown', type=float, required=True)
    rd.add_argument('--drawn', type=float, required=True)
    rd.add_argument('--film-frame', type=int, required=True)
    rd.add_argument('--pass-first', type=int, required=True)
    rd.add_argument('--from', dest='m0', type=int)
    rd.add_argument('--to', dest='m1', type=int)
    a = ap.parse_args()
    make(a.src, a.dst) if a.cmd == 'make' else read(a)


if __name__ == '__main__':
    main()
