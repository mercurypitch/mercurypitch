"""Reads measure.py's output for a whole-film render and says where each thing falls.

  python3 tools/film-events.py renders/film-draft-01.mp4 --measure review/film-01-measure

Writes into the measure folder:
  holds-30s.md   hard holds (measure.py's rule: a 0.1 s sample with mean change under 0.1 and no pixel
                 changing by 16) summed in each 30 s of the film, each run with its scene
  events.md      every single-frame event in events.csv with its frame, its scene and time in it, the
                 cut it is (if any), the cue edges and words within 0.2 s, and the boxes that change
  events/NN.png  the frame before, the frame, and their change x4, with the changed boxes, per event;
                 events/sheet-NN.png stacks four events a sheet
Uses ffmpeg, numpy and PIL (the system python3), and tools/film-cuts.py's frame picking.
"""
import argparse
import csv
import importlib.util
import json
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
_spec = importlib.util.spec_from_file_location('film_cuts', os.path.join(HERE, 'film-cuts.py'))
fc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fc)
CUES = json.load(open(os.path.join(ROOT, 'cues.json')))['cues']
FREEZE, NOISE = 0.1, 16


def scene_at(table, t):
    for sid, s in table:
        if s['start'] <= t < s['end'] + 1e-9:
            return sid, t - s['start']
    return table[-1][0], t - table[-1][1]['start']


def near_cues(t, reach=0.2):
    out = []
    for cid, c in CUES.items():
        for edge in ('start', 'end'):
            if abs(c[edge] - t) <= reach and not (edge == 'end' and c['dur'] == 0):
                out.append((abs(c[edge] - t), f"{cid} {edge} {c[edge]:.2f} ({c['type']})"))
        for w in c.get('words', []):
            if abs(w[1] - t) <= reach:
                out.append((abs(w[1] - t), f'"{w[0]}" {w[1]:.2f} ({cid})'))
    return [s for _, s in sorted(out)[:3]]


def holds(samples, step):
    runs, cur = [], []
    for s in samples + [None]:
        if s is not None and s[1] < FREEZE and s[2] < NOISE:
            cur.append(s)
            continue
        if cur:
            runs.append((cur[0][0] - step, len(cur) * step))
            cur = []
    return runs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('film')
    ap.add_argument('--measure', required=True)
    ap.add_argument('--fps', type=float, default=30.0)
    args = ap.parse_args()
    table = fc.scenes()
    cut_frames = {math.ceil(s['start'] * args.fps - 1e-6): f'{p} -> {sid}'
                  for (p, _), (sid, s) in zip(table, table[1:])}
    total = table[-1][1]['end']

    samples = [(float(r['t']), float(r['mean_change']), float(r['largest_change']))
               for r in csv.DictReader(open(os.path.join(args.measure, 'motion.csv')))]
    step = round(samples[1][0] - samples[0][0], 4)
    runs = holds(samples, step)
    ending = samples[-1][0]
    final = [r for r in runs if r[0] + r[1] >= ending - 0.05]
    windows = [0.0] * math.ceil(total / 30)
    for start, length in runs:
        if (start, length) in final:
            continue
        a, b = start, start + length
        for w in range(len(windows)):
            lo, hi = w * 30, (w + 1) * 30
            windows[w] += max(0.0, min(b, hi) - max(a, lo))
    lines = ['# Hard holds per 30 s', '',
             f'measure.py\'s rule: a {step:g} s sample with mean change under {FREEZE} and no pixel '
             f'changing by {NOISE} or more. The final hold is left out, as measure.py does.', '',
             '| Window | Held | Runs in it |', '| --- | --- | --- |']
    for w, held in enumerate(windows):
        lo, hi = w * 30, min((w + 1) * 30, total)
        inside = [f'{s:.2f} +{l:.1f} ({scene_at(table, s)[0]})' for s, l in runs
                  if s < hi and s + l > lo and (s, l) not in final]
        lines.append(f'| {lo:.0f}-{hi:.0f} s | {held:.1f} s | {", ".join(inside)} |')
    inner = [r for r in runs if r not in final]
    if inner:
        s, l = max(inner, key=lambda r: r[1])
        sid, off = scene_at(table, s)
        lines += ['', f'Longest inside the film: {l:.1f} s from {s:.2f} s ({sid}, {off:.2f} s in).']
    lines += [f"Final hold: {final[0][1]:.1f} s from {final[0][0]:.2f} s." if final
              else 'Final hold: none.', '']
    open(os.path.join(args.measure, 'holds-30s.md'), 'w').write('\n'.join(lines) + '\n')
    print('\n'.join(lines))

    events = [(float(r['t']), r['kind'], float(r['mean_change']), float(r['changed_share']))
              for r in csv.DictReader(open(os.path.join(args.measure, 'events.csv')))]
    out_dir = os.path.join(args.measure, 'events')
    frames_dir = os.path.join(out_dir, 'frames')
    os.makedirs(out_dir, exist_ok=True)
    font = ImageFont.truetype(fc.FONT, 20) if os.path.exists(fc.FONT) else ImageFont.load_default()
    rows, panels = [], []
    for n, (t, kind, mean, share) in enumerate(events, 1):
        k = round(t * args.fps)
        fc.dump(args.film, k + 1, frames_dir, args.fps)      # frames k-1 .. k+2
        y = {o: fc.luma(fc.load(frames_dir, k + o)) for o in (-1, 0, 1)}
        d = np.abs(y[0] - y[-1])
        regs, _ = fc.regions(d > fc.CHANGED, np.ones_like(d, bool))
        sid, off = scene_at(table, t)
        cut = cut_frames.get(k, '')
        boxes = '; '.join(f"{r['box'][0]},{r['box'][1]}-{r['box'][2]},{r['box'][3]}"
                          for r in regs[:3])
        rows.append(f"| {n} | {t:.3f} | {k} | {kind} | {share * 100:.2f}% | {sid} +{off:.2f} | "
                    f"{cut or ', '.join(near_cues(t))} | {boxes} |")
        tiles = [fc.load(frames_dir, k - 1), fc.load(frames_dir, k),
                 np.repeat(np.clip(d * 4, 0, 255).astype(np.uint8)[..., None], 3, -1)]
        strip = Image.new('RGB', (1920, 360 + 30), (13, 17, 23))
        dr = ImageDraw.Draw(strip)
        dr.text((8, 4), f'{n}  {t:.3f} s  frame {k}  {kind}  {share * 100:.2f}%  {sid} +{off:.2f}'
                        f'  {cut}', fill=(230, 237, 243), font=font)
        for i, tile in enumerate(tiles):
            im = Image.fromarray(tile)
            di = ImageDraw.Draw(im)
            for r in regs[:3]:
                di.rectangle(r['box'], outline=(255, 170, 40), width=6)
            strip.paste(im.resize((640, 360), Image.BILINEAR), (i * 640, 30))
        strip.save(os.path.join(out_dir, f'{n:02d}.png'))
        panels.append(strip)
    for s in range(0, len(panels), 4):
        group = panels[s:s + 4]
        sheet = Image.new('RGB', (1920, 390 * len(group)), (13, 17, 23))
        for i, p in enumerate(group):
            sheet.paste(p, (0, i * 390))
        sheet.save(os.path.join(out_dir, f'sheet-{s // 4 + 1:02d}.png'))
    lines = ['# Single-frame events', '',
             'Every event in events.csv. The frame is the one that differs (its time is the event\'s). '
             'Near: the cut it is, or the cue edges and words within 0.2 s. Boxes: the largest '
             'regions that change by more than 24 against the frame before (x0,y0-x1,y1).', '',
             '| # | t (s) | Frame | Kind | Pixels | Scene + s | Cut or near | Boxes |',
             '| --- | --- | --- | --- | --- | --- | --- | --- |'] + rows + ['']
    open(os.path.join(args.measure, 'events.md'), 'w').write('\n'.join(lines) + '\n')
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
