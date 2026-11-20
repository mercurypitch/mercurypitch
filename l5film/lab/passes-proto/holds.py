#!/usr/bin/env python3
"""Where a clip's holds are, and which part of the frame keeps it from holding: measure.py's own
motion samples (every Nth frame about 0.1 s apart, the frame at 320 px wide in gray, the change
against the sample before), split by region.

  python3 lab/passes-proto/holds.py CLIP.mp4 [--scene s08-breathe] [--hosts small|corners|mercRight|end]
          [--from T --to T] [--csv OUT.csv]

Prints one row a sample: its time, the mean change, the largest change in the whole frame (measure.py's
two numbers: a hold is mean < 0.1 and largest < 16), the largest change inside Merc's box, inside
Tavi's box and outside both, and, with --scene, what is said at that time (cues.json's words; the
clip is the scene from its own time 0, as tools/lab.mjs renders it).
Reads the clip with ffmpeg (the same filter chain as measure.py up to the difference) and numpy.
"""
import argparse
import json
import os
import subprocess

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
# the hosts' places (assets/lib/hosts.js, L.HOSTS): x, feetY, size; the body box is 0.53 wide, 0.64 tall
PLACES = {
    'small': {'merc': (100, 840, 240), 'tavi': (1820, 840, 240)},
    'corners': {'merc': (110, 840, 300), 'tavi': (1800, 840, 300)},
    'mercRight': {'merc': (1290, 840, 300), 'tavi': (1800, 840, 300)},
    'end': {'merc': (1290, 840, 400), 'tavi': (1610, 840, 400)},
}


def samples(clip):
    info = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                                      'stream=width,height,r_frame_rate', '-of', 'json', clip],
                                     capture_output=True, text=True, check=True).stdout)['streams'][0]
    num, den = info['r_frame_rate'].split('/')
    fps = float(num) / float(den)
    n = max(1, round(0.1 * fps))
    w, h = 320, round(int(info['height']) * 320 / int(info['width']) / 2) * 2
    raw = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', clip, '-vf',
                          f"select='not(mod(n\\,{n}))',scale=320:-2,format=gray", '-fps_mode', 'passthrough',
                          '-f', 'rawvideo', '-'], capture_output=True, check=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.int16)
    return fr, n / fps, w / int(info['width'])


def said(scene, t):
    """The word being said at scene time t, or the gap it falls in."""
    C = json.load(open(os.path.join(ROOT, 'cues.json')))['cues']
    sj = open(os.path.join(ROOT, 'assets/scenes.js')).read()
    SC = json.loads(sj[sj.index('=') + 1:].strip().rstrip(';'))
    T = SC[scene]['start'] + t
    for cid, c in C.items():
        if c['type'] == 'line' and c['start'] <= T < c['end']:
            ws = c.get('words') or []
            for i, (w, a, b) in enumerate(ws):
                if a <= T < b:
                    return f"{cid} ({c['who']}) \"{w}\""
                if i + 1 < len(ws) and b <= T < ws[i + 1][1]:
                    return f"{cid} ({c['who']}) between \"{w}\" and \"{ws[i + 1][0]}\" ({ws[i + 1][1] - b:.2f} s)"
            return f"{cid} ({c['who']})"
    before = max((c for c in C.values() if c['type'] in ('line', 'sound') and c['end'] <= T), key=lambda c: c['end'], default=None)
    after = min((c for c in C.values() if c['type'] in ('line', 'sound') and c['start'] > T), key=lambda c: c['start'], default=None)
    name = lambda c: next(k for k, v in C.items() if v is c)
    return f"between {name(before) if before else 'the start'} and {name(after) if after else 'the end'}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('clip')
    ap.add_argument('--scene')
    ap.add_argument('--hosts', default='small')
    ap.add_argument('--from', dest='t0', type=float, default=0.0)
    ap.add_argument('--to', dest='t1', type=float, default=1e9)
    ap.add_argument('--csv')
    ap.add_argument('--only-holds', action='store_true')
    a = ap.parse_args()
    fr, step, k = samples(a.clip)
    boxes = {}
    for who, (x, fy, s) in PLACES[a.hosts].items():
        # the body box grown by 0.1 of the size (the glow, the arcs)
        x0, x1, y0, y1 = x - 0.37 * s, x + 0.37 * s, fy - 0.74 * s, fy + 0.2 * s
        boxes[who] = (max(0, int(x0 * k)), int(x1 * k) + 1, max(0, int(y0 * k)), int(y1 * k) + 1)
    rows = []
    for i in range(1, len(fr)):
        d = np.abs(fr[i] - fr[i - 1])
        t = i * step
        m = {}
        rest = d.copy()
        for who, (x0, x1, y0, y1) in boxes.items():
            m[who] = int(d[y0:y1, x0:x1].max())
            rest[y0:y1, x0:x1] = 0
        rows.append((t, float(d.mean()), int(d.max()), m['merc'], m['tavi'], int(rest.max())))
    if a.csv:
        with open(a.csv, 'w') as f:
            f.write('t,mean,largest,merc,tavi,rest\n')
            for r in rows:
                f.write(f'{r[0]:.3f},{r[1]:.4f},{r[2]},{r[3]},{r[4]},{r[5]}\n')
    hold = lambda r: r[1] < 0.1 and r[2] < 16
    total = sum(step for r in rows if hold(r))
    print(f'{a.clip}: {len(rows)} samples {step:.3f} s apart; holds {total:.1f} s')
    print('    t   mean largest  merc  tavi  rest  hold  said')
    for r in rows:
        if not (a.t0 <= r[0] <= a.t1) or (a.only_holds and not hold(r)):
            continue
        print(f'{r[0] - step:6.2f} {r[1]:6.3f} {r[2]:6d} {r[3]:5d} {r[4]:5d} {r[5]:5d}  {"HOLD" if hold(r) else "    "}  '
              + (said(a.scene, r[0] - step / 2) if a.scene else ''))


if __name__ == '__main__':
    main()
