#!/usr/bin/env python3
"""Study a reference video before planning: a numeric pass over every frame.

Standard library only; needs ffmpeg and ffprobe on PATH.

  reference_pass.py REF.mp4 --out DIR [--cut 10] [--fast 8] [--dense-fps 20]

Writes into DIR:
  frames.csv    frame, t, change (mean absolute luma change from the previous
                frame, 0-255), brightness (mean luma), edges (mean edge strength),
                cut_score (ffmpeg scdet, 0-100)
  events.md     every detected cut and the fastest non-cut moments, with times
  overview.jpg  one timestamped sheet covering the whole video
  dense-*.jpg   one timestamped second at --dense-fps around every event
  NOTES.md      a note skeleton to fill in: the key moment, how it works, and
                how it could be used in this video

References are for study only. Never copy their footage, logos, layouts or music.
"""

import argparse
import csv
import json
import os
import re
import subprocess
import sys

STAMP = ("drawtext=text='%{pts\\:hms}':x=6:y=6:fontsize=16:fontcolor=white:"
         "box=1:boxcolor=black@0.6:boxborderw=3")


def run(cmd, check=True):
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if check and proc.returncode != 0:
        sys.stderr.write(proc.stderr[-2000:])
        raise SystemExit(f"command failed: {' '.join(cmd[:4])} ...")
    return proc


def duration_of(film):
    out = run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
               '-of', 'json', film]).stdout
    return float(json.loads(out)['format']['duration'])


def per_frame(film, chain, key):
    """Run a filter chain ending in metadata=print and return one value per frame."""
    err = run(['ffmpeg', '-hide_banner', '-nostats', '-i', film, '-vf',
               f'{chain},metadata=print:key={key}', '-an', '-f', 'null', '-'],
              check=False).stderr
    times = [float(t) for t in re.findall(r'pts_time:([0-9.]+(?:e[-+]?[0-9]+)?)', err)]
    values = [float(v) for v in re.findall(re.escape(key) + r'=([0-9.]+(?:e[-+]?[0-9]+)?)', err)]
    return list(zip(times, values))


def spaced(step):
    """Pick the first frame, then each frame at least step after the last one picked.

    Picking keeps every tile a real frame stamped with its own time, also on a
    variable frame rate download. Resampling with the fps filter stamps output
    times instead, up to half a step away from the frame shown.
    """
    return f"select='isnan(prev_selected_t)+gte(t-prev_selected_t\\,{step - 0.0005:.6f})'"


def sheet(film, out, vf_core, tile, start=None, length=None):
    base = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y']
    if start is not None:
        base += ['-ss', f'{start:.3f}', '-t', f'{length:.3f}']
    base += ['-i', film, '-frames:v', '1', '-q:v', '3']
    shift = f'setpts=PTS+{start:.3f}/TB,' if start else ''
    for vf in (f'{shift}{vf_core},{STAMP},tile={tile}', f'{shift}{vf_core},tile={tile}'):
        if run(base + ['-vf', vf, out], check=False).returncode == 0:
            return
    raise SystemExit(f'could not write {out}')


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('film')
    parser.add_argument('--out', required=True)
    parser.add_argument('--cut', type=float, default=10.0,
                        help='scdet score that counts as a cut (default 10)')
    parser.add_argument('--fast', type=int, default=8,
                        help='how many fast non-cut moments to report (default 8)')
    parser.add_argument('--dense-fps', type=float, default=20.0)
    args = parser.parse_args()
    os.makedirs(args.out, exist_ok=True)
    duration = duration_of(args.film)

    small = 'scale=320:-2,format=gray'
    change = per_frame(args.film, f'{small},tblend=all_mode=difference,signalstats',
                       'lavfi.signalstats.YAVG')
    bright = per_frame(args.film, f'{small},signalstats', 'lavfi.signalstats.YAVG')
    edges = per_frame(args.film, f'{small},edgedetect=low=0.1:high=0.3,signalstats',
                      'lavfi.signalstats.YAVG')
    cuts_raw = per_frame(args.film, 'scale=320:-2,scdet=threshold=100', 'lavfi.scd.score')

    # tblend drops the first frame, so change[i] belongs to frame i + 1.
    change_by_frame = {i + 1: v for i, (_, v) in enumerate(change)}
    rows = []
    for i, (t, b) in enumerate(bright):
        rows.append({
            'frame': i,
            't': t,
            'change': change_by_frame.get(i, 0.0),
            'brightness': b,
            'edges': edges[i][1] if i < len(edges) else 0.0,
            'cut_score': cuts_raw[i][1] if i < len(cuts_raw) else 0.0,
        })
    with open(os.path.join(args.out, 'frames.csv'), 'w', newline='') as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0].keys()) if rows else ['frame'])
        writer.writeheader()
        for row in rows:
            writer.writerow({k: (f'{v:.3f}' if isinstance(v, float) else v)
                             for k, v in row.items()})

    fps = (len(rows) / duration) if duration else 0.0
    guard = max(1, round(fps * 0.25))
    cuts = [r for r in rows if r['cut_score'] >= args.cut]
    near_cut = set()
    for r in cuts:
        near_cut.update(range(r['frame'] - guard, r['frame'] + guard + 1))
    # A fast moment must stand out from the video's own resting level, not just
    # be the largest of many near-zero values.
    ordered = sorted(row['change'] for row in rows)
    median = ordered[len(ordered) // 2] if ordered else 0.0
    floor = max(2.0, 4 * median)
    fast, taken = [], set()
    for r in sorted(rows, key=lambda row: row['change'], reverse=True):
        if len(fast) >= args.fast or r['change'] < floor:
            break
        if r['frame'] in near_cut or r['frame'] in taken:
            continue
        fast.append(r)
        taken.update(range(r['frame'] - round(fps * 0.5), r['frame'] + round(fps * 0.5) + 1))
    fast.sort(key=lambda row: row['t'])

    tiles = 48 if duration > 24 else max(12, int(duration * 2))
    cols = 8 if tiles >= 32 else 6
    sheet(args.film, os.path.join(args.out, 'overview.jpg'),
          f'{spaced(duration / tiles)},scale=320:-2', f'{cols}x{-(-(tiles + 1) // cols)}')

    events = [('cut', r) for r in cuts] + [('fast', r) for r in fast]
    events.sort(key=lambda item: item[1]['t'])
    frames_per_sheet = max(1, round(args.dense_fps))
    for kind, r in events:
        start = max(0.0, r['t'] - 0.5)
        name = os.path.join(args.out, f"dense-{r['t']:07.3f}s-{kind}.jpg")
        sheet(args.film, name, f'{spaced(1 / args.dense_fps)},scale=320:-2',
              f'5x{-(-frames_per_sheet // 5)}', start=start, length=1.0)

    avg_shot = duration / (len(cuts) + 1)
    lines = ['# Reference pass', '', f'File: `{args.film}`', '',
             f'{duration:.2f} s, {len(rows)} frames ({fps:.2f} fps), {len(cuts)} cut(s), '
             f'average shot {avg_shot:.2f} s.', '',
             '| Time | Kind | Change | Brightness | Edges | Cut score |',
             '| --- | --- | --- | --- | --- | --- |']
    for kind, r in events:
        lines.append(f"| {r['t']:.3f} s | {kind} | {r['change']:.1f} | {r['brightness']:.1f} | "
                     f"{r['edges']:.1f} | {r['cut_score']:.1f} |")
    lines += ['', 'Look at `overview.jpg`, then every `dense-*.jpg` before writing NOTES.md.']
    with open(os.path.join(args.out, 'events.md'), 'w') as fh:
        fh.write('\n'.join(lines) + '\n')

    notes = os.path.join(args.out, 'NOTES.md')
    if not os.path.exists(notes):
        with open(notes, 'w') as fh:
            fh.write('\n'.join([
                f'# Notes: {os.path.basename(args.film)}', '',
                'Study only. Never copy footage, logos, layouts or music.', '',
                '## The key moment', '', 'Time and what happens:', '',
                '## How it works', '',
                'The mechanism, in words a builder can implement (carried object, '
                'direction, scale change, easing, what is pre-positioned underneath):', '',
                '## How it could be used in this video', '', '',
                '## Rules this video follows', '', '',
            ]) + '\n')
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
