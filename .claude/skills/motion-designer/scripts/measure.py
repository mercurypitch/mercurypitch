#!/usr/bin/env python3
"""Measure a render against the motion-designer quality bar.

Standard library only; needs ffmpeg and ffprobe on PATH.

  measure.py render FILM.mp4 --out DIR [--every 0.2] [--low 0.35] [--freeze 0.1]
  measure.py dense FILM.mp4 --out DIR --at 2.4,7.0 [--window 1.0] [--fps 20]
  measure.py color FILM.mp4 --at SECONDS --box X,Y,W,H

render writes into DIR:
  summary.md    probe, frozen time at two thresholds with every run, loudness
  motion.csv    t, mean absolute luma change against the previous 0.1 s sample (0-255)
  loudness.csv  t, momentary and short-term loudness every 0.1 s (LUFS)
  frame-0.png   the first frame at full size; it must be a finished composition
  sheet-NN.jpg  timestamped contact sheets, one frame every --every seconds, 5x5 each

dense writes one timestamped sheet per time in --at: --window seconds centred on
the time, at --fps frames a second (use it around every transition).

color prints the mean colour of a box at a time as #rrggbb, for checking a
rendered background against a brand token.

Frozen time is reported at two thresholds because the right one depends on the
palette. On a bright stage a slow push reads well above 0.35; on a near-black
stage (MercuryPitch Obsidian) the same push can read 0.2-0.6 while a truly
static frame reads about 0.04. --freeze catches hard holds; --low flags stretches
a critic must look at. See references/measurement.md.
"""

import argparse
import csv
import json
import os
import re
import subprocess
import sys


def run(cmd, check=True):
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if check and proc.returncode != 0:
        sys.stderr.write(proc.stderr[-2000:])
        raise SystemExit(f"command failed: {' '.join(cmd[:4])} ...")
    return proc


def probe(film):
    out = run([
        'ffprobe', '-v', 'error', '-show_entries',
        'stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels:format=duration',
        '-of', 'json', film,
    ]).stdout
    data = json.loads(out)
    info = {'video': {}, 'audio': {}, 'duration': 0.0}
    for stream in data.get('streams', []):
        kind = stream.get('codec_type')
        if kind in info and not info[kind]:
            info[kind] = {k: str(v) for k, v in stream.items()}
    try:
        info['duration'] = float(data.get('format', {}).get('duration', 0))
    except (TypeError, ValueError):
        pass
    return info


def fps_value(rate):
    num, _, den = rate.partition('/')
    try:
        return float(num) / float(den or 1)
    except (ValueError, ZeroDivisionError):
        return 0.0


def motion_samples(film):
    """Mean absolute luma difference between successive 0.1 s samples."""
    vf = ('fps=10,scale=320:-2,format=gray,tblend=all_mode=difference,'
          'signalstats,metadata=print:key=lavfi.signalstats.YAVG')
    err = run(['ffmpeg', '-hide_banner', '-nostats', '-i', film, '-vf', vf,
               '-an', '-f', 'null', '-']).stderr
    values = [float(v) for v in re.findall(r'YAVG=([0-9.]+(?:e[-+]?[0-9]+)?)', err)]
    # tblend emits one value per pair, so value i compares sample i+1 with sample i.
    return [((i + 1) / 10.0, v) for i, v in enumerate(values)]


def runs_below(samples, threshold):
    runs, start, count = [], None, 0
    for t, v in samples:
        if v < threshold:
            if start is None:
                start = t
            count += 1
        elif start is not None:
            runs.append((start, count / 10.0))
            start, count = None, 0
    if start is not None:
        runs.append((start, count / 10.0))
    return runs


def loudness(film):
    err = run(['ffmpeg', '-hide_banner', '-nostats', '-i', film, '-af',
               'ebur128=peak=true', '-f', 'null', '-'], check=False).stderr
    rows = []
    pattern = re.compile(
        r't:\s*([0-9.]+)\s+TARGET:.*?M:\s*(-?[0-9.]+|-?inf|nan)\s+S:\s*(-?[0-9.]+|-?inf|nan)')
    for m in pattern.finditer(err):
        rows.append((float(m.group(1)), m.group(2), m.group(3)))

    def last(regex):
        found = re.findall(regex, err)
        return found[-1] if found else None

    summary = {
        'integrated': last(r'I:\s+(-?[0-9.]+) LUFS'),
        'range': last(r'LRA:\s+([0-9.]+) LU'),
        'true_peak': last(r'Peak:\s+(-?[0-9.]+|-inf) dBFS'),
    }
    return rows, summary


def draw_sheets(film, out_pattern, vf_core, tile):
    """Timestamped tiles; falls back to untimestamped when drawtext is unavailable."""
    stamp = ("drawtext=text='%{pts\\:hms}':x=8:y=8:fontsize=18:fontcolor=white:"
             "box=1:boxcolor=black@0.6:boxborderw=4")
    for vf in (f'{vf_core},{stamp},tile={tile}', f'{vf_core},tile={tile}'):
        proc = run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', film,
                    '-vf', vf, '-q:v', '3', out_pattern], check=False)
        if proc.returncode == 0:
            return vf.count('drawtext') > 0
    raise SystemExit('ffmpeg could not write contact sheets')


def cmd_render(args):
    os.makedirs(args.out, exist_ok=True)
    info = probe(args.film)
    duration = info['duration']
    video, audio = info['video'], info['audio']

    run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', args.film,
         '-frames:v', '1', os.path.join(args.out, 'frame-0.png')])
    stamped = draw_sheets(args.film, os.path.join(args.out, 'sheet-%02d.jpg'),
                          f'fps=1/{args.every},scale=384:-2', '5x5')

    samples = motion_samples(args.film)
    with open(os.path.join(args.out, 'motion.csv'), 'w', newline='') as fh:
        writer = csv.writer(fh)
        writer.writerow(['t', 'luma_change'])
        writer.writerows([(f'{t:.1f}', f'{v:.3f}') for t, v in samples])

    lines = ['# Measurement', '', f'File: `{args.film}`', '']
    lines.append('| Property | Value |')
    lines.append('| --- | --- |')
    lines.append(f'| Duration | {duration:.3f} s |')
    if video:
        lines.append(f"| Picture | {video.get('width')}x{video.get('height')} "
                     f"{fps_value(video.get('r_frame_rate', '0/1')):.2f} fps "
                     f"{video.get('codec_name', '')} |")
    lines.append(f"| Audio | {audio.get('codec_name', 'none')} "
                 f"{audio.get('sample_rate', '')} Hz {audio.get('channels', '')} ch |"
                 if audio else '| Audio | none |')
    lines.append('')

    per30 = 30.0 / duration if duration else 0.0
    lines.append('## Frozen time')
    lines.append('')
    lines.append('Sampled at 10 fps. Target: hard holds at most ~1 s per 30 s in total and '
                 'none longer than ~0.5 s, except the final CTA. Low-motion runs are for a '
                 'critic to judge, not an automatic fail.')
    lines.append('')
    ending = samples[-1][0] if samples else 0.0
    for label, threshold in (('Hard hold', args.freeze), ('Low motion', args.low)):
        runs = runs_below(samples, threshold)
        total = sum(length for _, length in runs)
        longest = max((length for _, length in runs), default=0.0)
        lines.append(f'**{label}** (change < {threshold}): {total:.1f} s in total '
                     f'({total * per30:.1f} s per 30 s), longest {longest:.1f} s')
        lines.append('')
        shown = [r for r in runs if r[1] >= 0.3]
        if shown:
            lines.append('| Starts | Length | Note |')
            lines.append('| --- | --- | --- |')
            for start, length in shown:
                note = 'reaches the end (final CTA?)' if start + length >= ending - 0.05 else ''
                if length > 0.5 and not note:
                    note = 'longer than 0.5 s'
                lines.append(f'| {start:.1f} s | {length:.1f} s | {note} |')
            lines.append('')

    lines.append('## Loudness')
    lines.append('')
    if audio:
        rows, summary = loudness(args.film)
        with open(os.path.join(args.out, 'loudness.csv'), 'w', newline='') as fh:
            writer = csv.writer(fh)
            writer.writerow(['t', 'momentary_lufs', 'short_term_lufs'])
            writer.writerows(rows)
        lines.append(f"Integrated {summary['integrated']} LUFS, range {summary['range']} LU, "
                     f"true peak {summary['true_peak']} dBFS.")
        lines.append('')
        lines.append('Targets: about -14 LUFS for punchy pieces, -16 to -19 LUFS for calm '
                     'ones, true peak at most -1 dBFS. Short-term loudness needs a full 3 s '
                     'window, so the first seconds read as silence (-120.7).')
        lines.append('')
        per_second = []
        for second in range(1, int(duration) + 1):
            nearest = min(rows, key=lambda row: abs(row[0] - second), default=None)
            if nearest is not None and abs(nearest[0] - second) < 0.06:
                per_second.append(f'{second}s {nearest[2]}')
        lines.append('Short-term per second: ' + ', '.join(per_second))
    else:
        lines.append('No audio stream.')
    lines.append('')

    sheets = sorted(f for f in os.listdir(args.out) if f.startswith('sheet-'))
    lines.append('## Look at these')
    lines.append('')
    lines.append('- `frame-0.png`: must be a finished composition.')
    lines.append(f"- {len(sheets)} contact sheet(s), one frame every {args.every} s"
                 f"{', timestamped' if stamped else ''}: "
                 + ', '.join(f'`{s}`' for s in sheets))
    lines.append('- For every transition: `measure.py dense` around its time.')
    with open(os.path.join(args.out, 'summary.md'), 'w') as fh:
        fh.write('\n'.join(lines) + '\n')
    print('\n'.join(lines))


def cmd_dense(args):
    os.makedirs(args.out, exist_ok=True)
    for raw in args.at.split(','):
        centre = float(raw)
        start = max(0.0, centre - args.window / 2)
        name = os.path.join(args.out, f'dense-{centre:06.2f}s.jpg')
        frames = max(1, round(args.window * args.fps))
        cols = 5
        rows = -(-frames // cols)
        stamp = ("drawtext=text='%{pts\\:hms}':x=6:y=6:fontsize=16:fontcolor=white:"
                 "box=1:boxcolor=black@0.6:boxborderw=3")
        base = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', f'{start:.3f}',
                '-t', f'{args.window:.3f}', '-i', args.film, '-frames:v', '1', '-q:v', '3']
        core = f'setpts=PTS+{start:.3f}/TB,fps={args.fps},scale=384:-2'
        ok = False
        for vf in (f'{core},{stamp},tile={cols}x{rows}', f'{core},tile={cols}x{rows}'):
            if run(base + ['-vf', vf, name], check=False).returncode == 0:
                ok = True
                break
        if not ok:
            raise SystemExit(f'could not write {name}')
        print(name)


def cmd_color(args):
    x, y, w, h = (int(v) for v in args.box.split(','))
    raw = subprocess.run(
        ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-ss', str(args.at), '-i', args.film,
         '-frames:v', '1', '-vf', f'crop={w}:{h}:{x}:{y},scale=1:1:flags=area',
         '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
        capture_output=True).stdout
    if len(raw) < 3:
        raise SystemExit('could not sample that box')
    print('#{:02x}{:02x}{:02x}'.format(raw[0], raw[1], raw[2]))


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='command', required=True)

    render = sub.add_parser('render', help='full quality-bar measurement of a render')
    render.add_argument('film')
    render.add_argument('--out', required=True)
    render.add_argument('--every', type=float, default=0.2)
    render.add_argument('--low', type=float, default=0.35)
    render.add_argument('--freeze', type=float, default=0.1)
    render.set_defaults(func=cmd_render)

    dense = sub.add_parser('dense', help='dense sheets around transition times')
    dense.add_argument('film')
    dense.add_argument('--out', required=True)
    dense.add_argument('--at', required=True, help='comma-separated times in seconds')
    dense.add_argument('--window', type=float, default=1.0)
    dense.add_argument('--fps', type=float, default=20)
    dense.set_defaults(func=cmd_dense)

    color = sub.add_parser('color', help='mean colour of a box at a time')
    color.add_argument('film')
    color.add_argument('--at', type=float, required=True)
    color.add_argument('--box', required=True, help='X,Y,W,H in pixels')
    color.set_defaults(func=cmd_color)

    args = parser.parse_args()
    args.func(args)


if __name__ == '__main__':
    main()
